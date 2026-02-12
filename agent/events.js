import { requireDbPool } from '../utils/queryLayer.js';

export async function appendEvent({ runId, userId, type, payload = {} }) {
  const pool = requireDbPool();
  const ts = Date.now();

  const eventResult = await pool.query(
    `INSERT INTO agent_events (run_id, user_id, type, ts, payload_json)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id`,
    [runId, userId, type, ts, JSON.stringify(payload || {})]
  );

  const eventId = Number(eventResult.rows[0]?.id || 0);

  await reduceRunState({ runId, type, eventId });

  return { id: eventId, type, ts, payload };
}

async function reduceRunState({ runId, type, eventId }) {
  const pool = requireDbPool();
  let status = null;
  let active = null;
  let phase = null;

  switch (type) {
    case 'AGENT_START':
      status = 'PREPARING';
      break;
    case 'AGENT_READY':
      status = 'ACTIVE';
      active = 'RUNNING';
      break;
    case 'AGENT_STREAM':
      status = 'ACTIVE';
      active = 'STREAMING';
      phase = 'TOKENIZING';
      break;
    case 'STREAM_TOKEN':
      phase = 'TOKENIZING';
      break;
    case 'STREAM_CHUNK':
      phase = 'RECEIVING';
      break;
    case 'STREAM_RENDER':
      phase = 'RENDERING';
      break;
    case 'STREAM_DONE':
      phase = 'FINALIZING';
      break;
    case 'AGENT_COMPLETE':
      status = 'COMPLETED';
      active = 'DONE';
      phase = 'DONE';
      break;
    case 'AGENT_FAIL':
      status = 'FAILED';
      active = 'ERROR';
      break;
    case 'AGENT_CANCEL':
      status = 'CANCELLED';
      active = 'CANCELLED';
      break;
    default:
      break;
  }

  await pool.query(
    `UPDATE agent_runs
     SET
       status = COALESCE($2, status),
       active = COALESCE($3, active),
       phase = COALESCE($4, phase),
       last_event_id = $5,
       updated_at = NOW()
     WHERE id = $1`,
    [runId, status, active, phase, eventId]
  );
}
