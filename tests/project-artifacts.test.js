import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createArtifactRecord,
  createBlogEmbedHelpers,
  exportArtifactsPack,
  importArtifactsPack,
  readArtifacts,
  saveArtifact
} from '../pdco-frontend/src/artifactsStore.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
}

test('saveArtifact persists and readArtifacts restores across sessions', () => {
  const storage = createMemoryStorage();
  const artifact = saveArtifact({
    name: 'Landing demo',
    type: 'text/html',
    source: 'agent',
    content: '<h1>demo</h1>',
    tags: 'landing,demo'
  }, { storage });

  assert.equal(artifact.source, 'agent');
  const records = readArtifacts({ storage });
  assert.equal(records.length, 1);
  assert.equal(records[0].name, 'Landing demo');
  assert.deepEqual(records[0].tags, ['landing', 'demo']);
});

test('export/import round trip restores artifact payload', () => {
  const storage = createMemoryStorage();
  saveArtifact({ name: 'Prompt', type: 'application/json', content: '{"prompt":"hi"}', tags: ['prompt'] }, { storage });

  const exported = exportArtifactsPack(readArtifacts({ storage }));
  const restoreStorage = createMemoryStorage();
  const result = importArtifactsPack(exported, { storage: restoreStorage });

  assert.equal(result.ok, true);
  const restored = readArtifacts({ storage: restoreStorage });
  assert.equal(restored.length, 1);
  assert.equal(restored[0].content, '{"prompt":"hi"}');
});

test('blog helpers include iframe and markdown snippets', () => {
  const record = createArtifactRecord({ id: 'artifact-1', name: 'Hero SVG', type: 'image/svg+xml', content: '<svg />' });
  const helpers = createBlogEmbedHelpers(record);

  assert.match(helpers.iframe, /<iframe/);
  assert.match(helpers.markdown, /!\[/);
  assert.match(helpers.markdown, /\/artifacts\/artifact-1/);
});
