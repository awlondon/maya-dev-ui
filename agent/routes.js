import express from 'express';
import crypto from 'node:crypto';
import {
  getAgentRunById,
  getFindingsByRunId,
  getFindingById,
  insertAgentFindings,
  markAgentRunFinished
} from './store.js';
import { runSimulatedAgentChecks } from './simulatedRunner.js';
import { buildCodexPatchPlan } from './codexPlan.js';
import { appendEvent } from './events.js';
import { requireDbPool } from '../utils/queryLayer.js';

function mapRunSummary(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    active: row.active || null,
    phase: row.phase || null,
    started_at: Number(row.started_at_ms || 0),
    updated_at: Number(row.updated_at_ms || 0),
    last_event_id: Number(row.last_event_id || 0)
  };
}

export function createAgentRouter({ getSessionFromRequest, verifyStripeSignature }) {
  const router = express.Router();

  router.get('/runs', async (req, res) => {
    try {
      const session = await getSessionFromRequest(req);
      if (!session) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const pool = requireDbPool();
      const result = await pool.query(
        `SELECT id,
                status,
                active,
                phase,
                COALESCE((EXTRACT(EPOCH FROM started_at) * 1000)::bigint, 0) AS started_at_ms,
                COALESCE((EXTRACT(EPOCH FROM updated_at) * 1000)::bigint, 0) AS updated_at_ms,
                COALESCE(last_event_id, 0) AS last_event_id
         FROM agent_runs
         WHERE user_id = $1::uuid
         ORDER BY created_at DESC`,
        [session.sub]
      );

      return res.json({ runs: result.rows.map(mapRunSummary) });
    } catch (error) {
      console.error('Failed to list agent runs.', error);
      return res.status(500).json({ ok: false, error: 'Failed to list runs' });
    }
  });

  router.post('/runs', async (req, res) => {
    try {
      const session = await getSessionFromRequest(req);
      if (!session) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const pool = requireDbPool();
      const runId = crypto.randomUUID();
      const now = new Date();
      await pool.query(
        `INSERT INTO agent_runs (id, user_id, status, started_at, created_at, updated_at)
         VALUES ($1, $2::uuid, $3, $4, $4, $4)`,
        [runId, session.sub, 'IDLE', now]
      );

      const startEvent = await appendEvent({
        runId,
        userId: session.sub,
        type: 'AGENT_START'
      });

      if (req.body?.simulate === false) {
        return res.status(201).json({
          ok: true,
          runId,
          lastEventId: startEvent.id
        });
      }

      const target = String(req.body?.target || 'api');
      const configJson = req.body?.config_json && typeof req.body.config_json === 'object'
        ? req.body.config_json
        : {};

      await appendEvent({ runId, userId: session.sub, type: 'AGENT_READY', payload: { target } });

      const simulation = await runSimulatedAgentChecks({
        verifyStripeSignature,
        authRoutes: ['/api/auth/google', '/api/auth/email/request', '/api/auth/logout'],
        authRateLimitEnabled: true,
        analyticsEndpoint: '/admin/usage/summary',
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'test_webhook_secret'
      });

      const insertedFindings = await insertAgentFindings({
        runId,
        findings: simulation.findings
      });

      await markAgentRunFinished({ runId, status: 'completed' });
      const completeEvent = await appendEvent({
        runId,
        userId: session.sub,
        type: 'AGENT_COMPLETE',
        payload: { findings_count: insertedFindings.length, config_json: configJson }
      });

      const completedRun = await getAgentRunById({ runId, userId: session.sub });
      return res.status(201).json({
        ok: true,
        run: completedRun,
        runId,
        lastEventId: completeEvent.id,
        findings_count: insertedFindings.length,
        simulation_summary: simulation.summary
      });
    } catch (error) {
      console.error('Failed to create agent run.', error);
      return res.status(500).json({ ok: false, error: 'Failed to create agent run' });
    }
  });

  router.get('/runs/:id', async (req, res) => {
    try {
      const session = await getSessionFromRequest(req);
      if (!session) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const run = await getAgentRunById({ runId: req.params.id, userId: session.sub });
      if (!run) {
        return res.status(404).json({ ok: false, error: 'Run not found' });
      }

      return res.json({
        ok: true,
        run,
        lastEventId: Number(run.last_event_id || 0)
      });
    } catch (error) {
      console.error('Failed to fetch agent run.', error);
      return res.status(500).json({ ok: false, error: 'Failed to fetch agent run' });
    }
  });

  router.get('/runs/:id/events', async (req, res) => {
    try {
      const session = await getSessionFromRequest(req);
      if (!session) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const after = Number(req.query.after || 0);
      const limit = Math.min(Number(req.query.limit || 500), 1000);
      const pool = requireDbPool();

      const result = await pool.query(
        `SELECT id, type, ts, payload_json
         FROM agent_events
         WHERE run_id = $1::uuid
           AND user_id = $2::uuid
           AND id > $3
         ORDER BY id ASC
         LIMIT $4`,
        [req.params.id, session.sub, after, limit]
      );

      const events = result.rows.map((row) => ({
        id: Number(row.id),
        type: row.type,
        ts: Number(row.ts),
        payload_json: row.payload_json || {}
      }));

      const lastEventId = events.length ? events[events.length - 1].id : after;
      return res.json({ events, lastEventId });
    } catch (error) {
      console.error('Failed to fetch run events.', error);
      return res.status(500).json({ ok: false, error: 'Failed to fetch run events' });
    }
  });

  router.post('/runs/:id/cancel', async (req, res) => {
    try {
      const session = await getSessionFromRequest(req);
      if (!session) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      await appendEvent({
        runId: req.params.id,
        userId: session.sub,
        type: 'AGENT_CANCEL'
      });

      return res.json({ ok: true });
    } catch (error) {
      console.error('Failed to cancel agent run.', error);
      return res.status(500).json({ ok: false, error: 'Failed to cancel run' });
    }
  });

  router.get('/runs/:id/findings', async (req, res) => {
    try {
      const session = await getSessionFromRequest(req);
      if (!session) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }
      const findings = await getFindingsByRunId({ runId: req.params.id, userId: session.sub });
      return res.json({ ok: true, findings });
    } catch (error) {
      console.error('Failed to fetch run findings.', error);
      return res.status(500).json({ ok: false, error: 'Failed to fetch run findings' });
    }
  });

  router.get('/findings/:id/codex', async (req, res) => {
    try {
      const session = await getSessionFromRequest(req);
      if (!session) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }
      const finding = await getFindingById({ findingId: req.params.id, userId: session.sub });
      if (!finding) {
        return res.status(404).json({ ok: false, error: 'Finding not found' });
      }

      const plan = buildCodexPatchPlan(finding);
      return res.json({ ok: true, finding_id: finding.id, codex_patch_plan: plan });
    } catch (error) {
      console.error('Failed to generate codex patch plan.', error);
      return res.status(500).json({ ok: false, error: 'Failed to generate codex patch plan' });
    }
  });

  return router;
}
