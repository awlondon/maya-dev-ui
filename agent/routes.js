import express from 'express';
import crypto from 'node:crypto';
import {
  getAgentRunById,
  getAgentRunByIdAny,
  getFindingsByRunId,
  getFindingById,
  insertAgentFindings,
  listAgentEventsAfter,
  listAgentRunsByUserId,
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

function serializeRunForList(run) {
  return {
    id: run.id,
    status: run.status,
    active: run.active,
    phase: run.phase,
    startedAt: run.started_at,
    updatedAt: run.updated_at,
    lastEventId: run.last_event_id || 0
  };
}

function serializeRunSnapshot(run) {
  return {
    ...serializeRunForList(run),
    userId: run.user_id,
    partialOutput: run.partial_output || null
  };
}

export function createAgentRouter({ getSessionFromRequest, verifyStripeSignature, store = {} }) {
  const router = express.Router();
  const db = {
    createAgentRun: store.createAgentRun || createAgentRun,
    getAgentRunById: store.getAgentRunById || getAgentRunById,
    getAgentRunByIdAny: store.getAgentRunByIdAny || getAgentRunByIdAny,
    listAgentEventsAfter: store.listAgentEventsAfter || listAgentEventsAfter,
    listAgentRunsByUserId: store.listAgentRunsByUserId || listAgentRunsByUserId,
    appendEvent: store.appendEvent || appendEvent,
    getFindingsByRunId: store.getFindingsByRunId || getFindingsByRunId,
    getFindingById: store.getFindingById || getFindingById,
    insertAgentFindings: store.insertAgentFindings || insertAgentFindings,
    markAgentRunFinished: store.markAgentRunFinished || markAgentRunFinished
  };

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
      req.user = session;
      return next();
    } catch (error) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }

  async function loadOwnedRun(req, res, next) {
    const run = await db.getAgentRunByIdAny({ runId: req.params.id });
    if (!run) {
      return res.status(404).json({ ok: false, error: 'Run not found' });
    }
    if (!req.user?.sub || run.user_id !== req.user.sub) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    req.agentRun = run;
    return next();
  }

  router.get('/runs', requireAuth, async (req, res) => {
    try {
      const runs = await db.listAgentRunsByUserId({ userId: req.user.sub });
      return res.json({ ok: true, runs: runs.map(serializeRunForList) });
    } catch (error) {
      console.error('Failed to list agent runs.', error);
      return res.status(500).json({ ok: false, error: 'Failed to list runs' });
    }
  });

  router.get('/runs/:id', requireAuth, loadOwnedRun, async (req, res) => {
    return res.json({
      ok: true,
      run: serializeRunSnapshot(req.agentRun),
      lastEventId: req.agentRun.last_event_id || 0
    });
  });

  router.get('/runs/:id/events', requireAuth, loadOwnedRun, async (req, res) => {
    try {
      const after = Math.max(0, Number(req.query.after || 0));
      const limit = Math.min(500, Math.max(1, Number(req.query.limit || 500)));
      const events = await db.listAgentEventsAfter({ runId: req.agentRun.id, after, limit });
      const maxId = events.length > 0 ? events[events.length - 1].id : req.agentRun.last_event_id || 0;
      return res.json({ ok: true, events, lastEventId: maxId });
    } catch (error) {
      console.error('Failed to load run events.', error);
      return res.status(500).json({ ok: false, error: 'Failed to load run events' });
    }
  });

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

  router.post('/runs/:id/cancel', requireAuth, loadOwnedRun, async (req, res) => {
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
      console.error('Failed to cancel run.', error);
      return res.status(500).json({ ok: false, error: 'Failed to cancel run' });
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
      const findings = await db.getFindingsByRunId({ runId: req.params.id, userId: req.user.sub });
      return res.json({ ok: true, findings });
    } catch (error) {
      console.error('Failed to fetch run findings.', error);
      return res.status(500).json({ ok: false, error: 'Failed to fetch run findings' });
    }
  });

  router.get('/findings/:id/codex', requireAuth, async (req, res) => {
    try {
      const finding = await db.getFindingById({ findingId: req.params.id, userId: req.user.sub });
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
