CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  handle text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  age int,
  gender text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_unique ON profiles (LOWER(handle));

CREATE TABLE IF NOT EXISTS artifacts (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  forked_from_id uuid REFERENCES artifacts(id) ON DELETE SET NULL,
  forked_from_owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  forked_from_version_id uuid,
  forked_from_version_label text,
  origin_artifact_id uuid REFERENCES artifacts(id) ON DELETE SET NULL,
  origin_owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  forks_count int NOT NULL DEFAULT 0,
  imports_count int NOT NULL DEFAULT 0,
  likes_count int NOT NULL DEFAULT 0,
  comments_count int NOT NULL DEFAULT 0,
  current_version_id uuid,
  versioning_enabled boolean NOT NULL DEFAULT FALSE,
  chat_history_public boolean NOT NULL DEFAULT FALSE,
  source_session jsonb
);

CREATE INDEX IF NOT EXISTS artifacts_owner_visibility_idx ON artifacts (owner_user_id, visibility);
CREATE INDEX IF NOT EXISTS artifacts_visibility_updated_idx ON artifacts (visibility, updated_at DESC);
CREATE INDEX IF NOT EXISTS artifacts_forked_from_idx ON artifacts (forked_from_owner_user_id);
CREATE INDEX IF NOT EXISTS artifacts_origin_idx ON artifacts (origin_artifact_id);

CREATE TABLE IF NOT EXISTS artifact_versions (
  id uuid PRIMARY KEY,
  artifact_id uuid NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version_index int NOT NULL,
  code_blob_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  summary text,
  label text,
  session_id text,
  code_language text,
  code_content text,
  code_versions jsonb,
  chat jsonb,
  stats jsonb,
  version_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  code_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  parent_version_id uuid REFERENCES artifact_versions(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS artifact_versions_unique_idx ON artifact_versions (artifact_id, version_index);
CREATE INDEX IF NOT EXISTS artifact_versions_artifact_idx ON artifact_versions (artifact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS artifact_versions_parent_idx ON artifact_versions (parent_version_id);

CREATE TABLE IF NOT EXISTS artifact_media (
  artifact_id uuid PRIMARY KEY REFERENCES artifacts(id) ON DELETE CASCADE,
  screenshot_url text,
  thumb_url text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
