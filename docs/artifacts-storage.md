# Artifacts + profiles storage

This project now stores profiles and artifacts in PostgreSQL, with images persisted to object storage (S3-compatible). JSON files in `data/` are no longer used for these entities.

## Migrations

Apply the migration in `migrations/001_profiles_artifacts.sql` to create the schema:

```sh
psql "$APP_DATABASE_URL" -f migrations/001_profiles_artifacts.sql
```

If you prefer, set `DATABASE_URL` instead of `APP_DATABASE_URL`; the server will use either.

## Schema overview

### profiles

| column | type | notes |
| --- | --- | --- |
| user_id | uuid | PK |
| handle | text | unique handle |
| display_name | text | display name |
| bio | text | profile bio |
| avatar_url | text | object storage URL |
| age | integer | demographic |
| gender | text | demographic |
| city | text | demographic |
| country | text | demographic |
| created_at | timestamptz | defaults to now |
| updated_at | timestamptz | defaults to now |

### artifacts

| column | type | notes |
| --- | --- | --- |
| id | uuid | PK |
| owner_user_id | uuid | owner |
| title | text | title |
| description | text | description |
| visibility | text | public/private |
| created_at | timestamptz | defaults to now |
| updated_at | timestamptz | defaults to now |
| forked_from_id | uuid | source artifact |
| forked_from_owner_user_id | uuid | source owner |
| forked_from_version_id | uuid | source version |
| forked_from_version_label | text | version label |
| source_session_id | text | originating session |
| source_session_credits_estimate | numeric | estimated credits |
| current_version_id | uuid | points to `artifact_versions.id` |
| versioning_enabled | boolean | publish setting |
| chat_history_public | boolean | publish setting |
| forks_count | integer | fork count |
| imports_count | integer | import count |
| likes_count | integer | placeholder for future |
| comments_count | integer | placeholder for future |

### artifact_versions

| column | type | notes |
| --- | --- | --- |
| id | uuid | PK |
| artifact_id | uuid | FK -> artifacts |
| version_index | integer | 1-based version number |
| code_blob_ref | text | reference (currently `db:{version_id}`) |
| code_language | text | language |
| code_content | text | code payload |
| code_versions | jsonb | raw versions array |
| chat | jsonb | chat transcript metadata |
| session_id | text | originating session |
| credits_used_estimate | numeric | estimated credits |
| created_at | timestamptz | defaults to now |
| summary | text | optional summary |
| label | text | optional label |

### artifact_media

| column | type | notes |
| --- | --- | --- |
| artifact_id | uuid | PK, FK -> artifacts |
| screenshot_url | text | object storage URL |
| thumb_url | text | optional thumb |
| updated_at | timestamptz | defaults to now |

## Object storage

Set `STORAGE_MODE=s3` to use S3-compatible storage for screenshots and avatars. For local development, leave `STORAGE_MODE` unset to keep writing to `data/`.

Required environment variables for S3 mode:

- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_ENDPOINT` (optional, for R2/GCS)
- `STORAGE_PUBLIC_BASE_URL` (recommended for R2/GCS public URLs)

In S3 mode, uploaded images persist across restarts because they are stored in object storage instead of local disk.
