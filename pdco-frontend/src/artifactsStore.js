const ARTIFACTS_STORAGE_KEY = 'pdco.devstudio.artifacts.v1';

function resolveStorage(storage) {
  if (storage) {
    return storage;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function safeRead(storage, key) {
  try {
    return storage?.getItem(key) || null;
  } catch {
    return null;
  }
}

function safeWrite(storage, key, value) {
  try {
    storage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }
  return String(tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function createArtifactRecord(input = {}) {
  return {
    id: input.id || crypto.randomUUID(),
    name: String(input.name || 'Untitled artifact').trim(),
    type: String(input.type || 'text/plain').trim(),
    created_at: input.created_at || new Date().toISOString(),
    source: input.source === 'agent' ? 'agent' : 'manual',
    content: String(input.content || ''),
    tags: normalizeTags(input.tags)
  };
}

export function readArtifacts({ storage } = {}) {
  const activeStorage = resolveStorage(storage);
  const raw = safeRead(activeStorage, ARTIFACTS_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => createArtifactRecord(item))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch {
    return [];
  }
}

export function saveArtifacts(records, { storage } = {}) {
  const activeStorage = resolveStorage(storage);
  return safeWrite(activeStorage, ARTIFACTS_STORAGE_KEY, JSON.stringify(records));
}

export function saveArtifact(input, { storage } = {}) {
  const nextArtifact = createArtifactRecord(input);
  const current = readArtifacts({ storage });
  const next = [nextArtifact, ...current.filter((artifact) => artifact.id !== nextArtifact.id)];
  saveArtifacts(next, { storage });
  return nextArtifact;
}

export function exportArtifactsPack(records = []) {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    artifacts: records
  };
}

export function importArtifactsPack(pack, { storage } = {}) {
  if (!pack || !Array.isArray(pack.artifacts)) {
    return { ok: false, imported: 0 };
  }
  const imported = pack.artifacts.map((artifact) => createArtifactRecord(artifact));
  saveArtifacts(imported, { storage });
  return { ok: true, imported: imported.length };
}

export function createBlogEmbedHelpers(artifact) {
  const slug = encodeURIComponent(String(artifact?.name || 'artifact').toLowerCase().replace(/\s+/g, '-'));
  const assetUrl = `/artifacts/${artifact?.id || 'artifact'}/${slug}`;
  return {
    iframe: `<iframe src="${assetUrl}" title="${artifact?.name || 'Artifact'}" loading="lazy"></iframe>`,
    markdown: `![${artifact?.name || 'artifact'}](${assetUrl})`
  };
}

export function artifactExtension(type = '') {
  const lower = String(type).toLowerCase();
  if (lower.includes('svg')) return 'svg';
  if (lower.includes('html')) return 'html';
  if (lower.includes('json')) return 'json';
  if (lower.includes('markdown')) return 'md';
  if (lower.includes('javascript')) return 'js';
  if (lower.includes('css')) return 'css';
  if (lower.includes('plain')) return 'txt';
  return 'txt';
}
