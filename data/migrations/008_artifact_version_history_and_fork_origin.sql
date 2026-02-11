ALTER TABLE artifact_versions
  ADD COLUMN IF NOT EXISTS version_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS code_references JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS parent_version_id UUID REFERENCES artifact_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS artifact_versions_parent_idx
  ON artifact_versions (parent_version_id);

ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS origin_artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

UPDATE artifacts
SET
  origin_artifact_id = COALESCE(origin_artifact_id, forked_from_id, id),
  origin_owner_user_id = COALESCE(origin_owner_user_id, forked_from_owner_user_id, owner_user_id)
WHERE origin_artifact_id IS NULL OR origin_owner_user_id IS NULL;

CREATE INDEX IF NOT EXISTS artifacts_origin_idx
  ON artifacts (origin_artifact_id);
