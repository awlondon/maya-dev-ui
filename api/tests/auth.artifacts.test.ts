import assert from 'node:assert/strict';
import test from 'node:test';
import { mapArtifactRow, mapArtifactVersionRow } from '../../utils/artifactDb.js';
import { mapProfileRow } from '../../utils/profileDb.js';

test('mapArtifactRow shapes artifact payload', () => {
  const row = {
    id: 'artifact-1',
    owner_user_id: 'user-1',
    visibility: 'private',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: '2024-01-02T00:00:00Z',
    title: 'Test artifact',
    description: 'Description',
    code_language: 'html',
    code_content: '<div />',
    screenshot_url: 'https://cdn.example.com/artifacts/a.png',
    forked_from_id: 'artifact-0',
    forked_from_owner_user_id: 'user-0',
    forked_from_version_id: 'version-0',
    forked_from_version_label: 'v1',
    forks_count: 2,
    imports_count: 3,
    likes_count: 4,
    comments_count: 5,
    versioning_enabled: true,
    chat_history_public: false,
    source_session: { session_id: 'session-1', credits_used_estimate: 7 },
    artifact_current_version_id: 'version-1'
  };

  const artifact = mapArtifactRow(row);
  assert.equal(artifact?.artifact_id, 'artifact-1');
  assert.equal(artifact?.code.language, 'html');
  assert.equal(artifact?.code.content, '<div />');
  assert.equal(artifact?.screenshot_url, row.screenshot_url);
  assert.equal(artifact?.derived_from.artifact_id, row.forked_from_id);
  assert.equal(artifact?.stats.forks, 2);
  assert.equal(artifact?.versioning.enabled, true);
});

test('mapArtifactVersionRow shapes version payload', () => {
  const row = {
    id: 'version-1',
    artifact_id: 'artifact-1',
    session_id: 'session-1',
    created_at: new Date('2024-02-01T00:00:00Z'),
    label: 'v1',
    summary: 'Initial',
    version_index: 1,
    code_language: 'html',
    code_content: '<div />',
    code_versions: [{ language: 'html', content: '<div />' }],
    chat: { included: true, messages: [] },
    stats: { turns: 0 }
  };

  const version = mapArtifactVersionRow(row);
  assert.equal(version?.version_id, 'version-1');
  assert.equal(version?.version_index, 1);
  assert.equal(version?.code.language, 'html');
});

test('mapProfileRow shapes profile payload', () => {
  const row = {
    user_id: 'user-1',
    handle: 'maya',
    display_name: 'Maya',
    bio: 'hello',
    avatar_url: 'https://cdn.example.com/profile.png',
    age: 30,
    gender: 'female',
    city: 'Seattle',
    country: 'USA',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-02T00:00:00Z')
  };

  const profile = mapProfileRow(row);
  assert.equal(profile?.handle, 'maya');
  assert.equal(profile?.demographics.city, 'Seattle');
});
