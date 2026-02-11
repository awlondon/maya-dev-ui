# Artifact + profile storage schema (Postgres)

Canonical schema lives in `data/migrations/002_create_artifacts_profiles.sql`.

## Tables

### `profiles`

| Field | Type | Description |
| --- | --- | --- |
| user_id | uuid | Primary key, FK to users. |
| handle | text | Unique handle (lowercased in API). |
| display_name | text | Display name. |
| bio | text | Profile bio. |
| avatar_url | text | Avatar URL (object storage or local). |
| age | int | Optional age. |
| gender | text | Optional gender. |
| city | text | City. |
| country | text | Country. |
| created_at | timestamptz | Creation timestamp. |
| updated_at | timestamptz | Update timestamp. |

### `artifacts`

| Field | Type | Description |
| --- | --- | --- |
| id | uuid | Primary key. |
| owner_user_id | uuid | FK to users. |
| title | text | Artifact title. |
| description | text | Artifact description. |
| visibility | text | `public` or `private`. |
| created_at | timestamptz | Creation timestamp. |
| updated_at | timestamptz | Update timestamp. |
| forked_from_id | uuid | FK to parent artifact. |
| forked_from_owner_user_id | uuid | FK to parent owner. |
| forked_from_version_id | uuid | FK to parent version. |
| forked_from_version_label | text | Label for parent version. |
| origin_artifact_id | uuid | FK to root/original artifact in fork lineage. |
| origin_owner_user_id | uuid | FK to root/original artifact owner. |
| forks_count | int | Total forks. |
| imports_count | int | Total imports. |
| likes_count | int | Like count. |
| comments_count | int | Comment count. |
| current_version_id | uuid | Current version pointer. |
| versioning_enabled | boolean | Version list visibility. |
| chat_history_public | boolean | Chat history visibility. |
| source_session | jsonb | Session metadata for analytics. |

### `artifact_versions`

| Field | Type | Description |
| --- | --- | --- |
| id | uuid | Primary key. |
| artifact_id | uuid | FK to artifacts. |
| version_index | int | Monotonic version index. |
| code_blob_ref | text | Reference to code blob. |
| created_at | timestamptz | Version timestamp. |
| summary | text | Optional summary. |
| label | text | Optional label. |
| session_id | text | Session identifier. |
| code_language | text | Code language. |
| code_content | text | Code content (inline). |
| code_versions | jsonb | Optional code versions array. |
| chat | jsonb | Chat payload. |
| stats | jsonb | Version stats. |
| version_metadata | jsonb | Structured version metadata snapshot (title/visibility/source details). |
| code_references | jsonb | Code blob references + hashes/size for auditability. |
| parent_version_id | uuid | Optional previous version link for diff chain traversal. |

### `artifact_media`

| Field | Type | Description |
| --- | --- | --- |
| artifact_id | uuid | Primary key, FK to artifacts. |
| screenshot_url | text | Screenshot URL. |
| thumb_url | text | Thumbnail URL. |
| created_at | timestamptz | Creation timestamp. |
| updated_at | timestamptz | Update timestamp. |
