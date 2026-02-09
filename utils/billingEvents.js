import crypto from 'node:crypto';
import { getUsageAnalyticsPool } from './usageAnalytics.js';

function ensurePool(pool) {
  const activePool = pool || getUsageAnalyticsPool();
  return activePool;
}

export function computePayloadHash(payload) {
  const input = payload || '';
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function recordBillingEvent({
  stripeEventId,
  type,
  userId,
  status = 'received',
  payloadHash,
  pool
} = {}) {
  const activePool = ensurePool(pool);
  if (!activePool) {
    return { inserted: false, skipped: true };
  }
  if (!stripeEventId) {
    throw new Error('stripe_event_id is required');
  }
  const result = await activePool.query(
    `INSERT INTO billing_events
      (stripe_event_id, type, user_id, processed_at, status, payload_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (stripe_event_id) DO NOTHING`,
    [
      stripeEventId,
      type || '',
      userId || null,
      new Date(),
      status,
      payloadHash || ''
    ]
  );
  return { inserted: result.rowCount > 0, skipped: false };
}

export async function updateBillingEventStatus({
  stripeEventId,
  status,
  userId,
  pool
} = {}) {
  const activePool = ensurePool(pool);
  if (!activePool) {
    return { updated: false, skipped: true };
  }
  if (!stripeEventId) {
    throw new Error('stripe_event_id is required');
  }

  const updates = ['status = $1', 'processed_at = $2'];
  const values = [status || 'processed', new Date()];
  let index = 3;
  if (userId) {
    updates.push(`user_id = $${index++}`);
    values.push(userId);
  }
  values.push(stripeEventId);

  const result = await activePool.query(
    `UPDATE billing_events
     SET ${updates.join(', ')}
     WHERE stripe_event_id = $${index}`,
    values
  );
  return { updated: result.rowCount > 0, skipped: false };
}
