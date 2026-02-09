CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  age INTEGER,
  gender TEXT,
  city TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL CHECK (visibility IN ('public','private')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  forked_from_id UUID,
  forked_from_owner_user_id UUID,
  forked_from_version_id UUID,
  forked_from_version_label TEXT,
  source_session_id TEXT,
  source_session_credits_estimate NUMERIC,
  current_version_id UUID,
  versioning_enabled BOOLEAN NOT NULL DEFAULT false,
  chat_history_public BOOLEAN NOT NULL DEFAULT false,
  forks_count INTEGER NOT NULL DEFAULT 0,
  imports_count INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_artifacts_owner
  ON artifacts (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_artifacts_visibility_updated
  ON artifacts (visibility, updated_at DESC);

CREATE TABLE IF NOT EXISTS artifact_versions (
  id UUID PRIMARY KEY,
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version_index INTEGER NOT NULL,
  code_blob_ref TEXT NOT NULL,
  code_language TEXT NOT NULL,
  code_content TEXT NOT NULL,
  code_versions JSONB,
  chat JSONB,
  session_id TEXT,
  credits_used_estimate NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT,
  label TEXT,
  UNIQUE (artifact_id, version_index)
);

CREATE INDEX IF NOT EXISTS idx_artifact_versions_artifact
  ON artifact_versions (artifact_id, created_at DESC);

CREATE TABLE IF NOT EXISTS artifact_media (
  artifact_id UUID PRIMARY KEY REFERENCES artifacts(id) ON DELETE CASCADE,
  screenshot_url TEXT,
  thumb_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
