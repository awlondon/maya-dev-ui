ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS active TEXT,
  ADD COLUMN IF NOT EXISTS phase TEXT,
  ADD COLUMN IF NOT EXISTS last_event_id BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS agent_events (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  ts BIGINT NOT NULL,
  payload_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_agent_events_run ON agent_events(run_id, id);
CREATE INDEX IF NOT EXISTS idx_agent_events_user ON agent_events(user_id);
