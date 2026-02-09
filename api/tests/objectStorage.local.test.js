import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createObjectStorage } from '../../utils/objectStorage.js';

test('local storage writes artifact screenshots', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maya-storage-'));
  const storage = createObjectStorage({
    mode: 'local',
    artifactUploadsDir: path.join(tmpDir, 'artifacts'),
    profileUploadsDir: path.join(tmpDir, 'profiles'),
    publicPathPrefix: '/uploads'
  });

  const pngHeader = Buffer.from('89504e470d0a1a0a', 'hex');
  const url = await storage.uploadArtifactScreenshot({
    buffer: pngHeader,
    artifactId: 'artifact-123',
    contentType: 'image/png'
  });

  assert.equal(url, '/uploads/artifacts/artifact-123.png');
  const stored = await fs.readFile(path.join(tmpDir, 'artifacts', 'artifact-123.png'));
  assert.equal(stored.toString('hex'), pngHeader.toString('hex'));
});

test('local storage writes profile avatars', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maya-storage-'));
  const storage = createObjectStorage({
    mode: 'local',
    artifactUploadsDir: path.join(tmpDir, 'artifacts'),
    profileUploadsDir: path.join(tmpDir, 'profiles'),
    publicPathPrefix: '/uploads'
  });

  const avatar = Buffer.from('avatar-bytes');
  const url = await storage.uploadProfileAvatar({
    buffer: avatar,
    userId: 'user-123',
    extension: 'png',
    contentType: 'image/png'
  });

  assert.match(url, /\/uploads\/profiles\/user-123-\d+\.png/);
  const filename = url.split('/').pop();
  const stored = await fs.readFile(path.join(tmpDir, 'profiles', filename));
  assert.equal(stored.toString(), avatar.toString());
});
