import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

function resolveStorageMode() {
  return (process.env.OBJECT_STORAGE_DRIVER || 'local').toLowerCase();
}

function resolvePublicBaseUrl() {
  const raw = process.env.OBJECT_STORAGE_PUBLIC_URL || '';
  return raw.replace(/\/$/, '');
}

function buildDefaultPublicUrl({ bucket, region, endpoint }) {
  if (!bucket) return '';
  if (endpoint) {
    return `${endpoint.replace(/\/$/, '')}/${bucket}`;
  }
  const resolvedRegion = region || 'us-east-1';
  return `https://${bucket}.s3.${resolvedRegion}.amazonaws.com`;
}

function buildObjectUrl(key) {
  const bucket = process.env.OBJECT_STORAGE_BUCKET || '';
  const region = process.env.OBJECT_STORAGE_REGION || '';
  const endpoint = process.env.OBJECT_STORAGE_ENDPOINT || '';
  const base = resolvePublicBaseUrl() || buildDefaultPublicUrl({ bucket, region, endpoint });
  if (!base) return '';
  return `${base.replace(/\/$/, '')}/${key}`;
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding);
}

function getSigningKey(secretAccessKey, date, region, service) {
  const kDate = hmac(`AWS4${secretAccessKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function buildSignedHeaders(headers) {
  return Object.keys(headers)
    .map((key) => key.toLowerCase())
    .sort()
    .join(';');
}

function buildCanonicalHeaders(headers) {
  return Object.entries(headers)
    .map(([key, value]) => `${key.toLowerCase()}:${String(value).trim()}\n`)
    .sort()
    .join('');
}

function resolveS3Endpoint() {
  const raw = process.env.OBJECT_STORAGE_ENDPOINT || '';
  return raw.replace(/\/$/, '');
}

function resolveS3Host({ bucket, endpoint, forcePathStyle }) {
  if (endpoint) {
    const url = new URL(endpoint);
    return forcePathStyle ? url.host : `${bucket}.${url.host}`;
  }
  return `${bucket}.s3.amazonaws.com`;
}

function resolveS3Url({ bucket, key, endpoint, forcePathStyle }) {
  const resolvedEndpoint = endpoint || 'https://s3.amazonaws.com';
  if (forcePathStyle) {
    return `${resolvedEndpoint}/${bucket}/${key}`;
  }
  return `${resolvedEndpoint.replace('://', `://${bucket}.`)}/${key}`;
}

async function uploadToS3({ key, contentType, body }) {
  const bucket = process.env.OBJECT_STORAGE_BUCKET || '';
  const region = process.env.OBJECT_STORAGE_REGION || 'us-east-1';
  const accessKeyId = process.env.OBJECT_STORAGE_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY || '';
  const endpoint = resolveS3Endpoint();
  const forcePathStyle = process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === 'true';
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 uploads require OBJECT_STORAGE_BUCKET and access credentials.');
  }

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const host = resolveS3Host({ bucket, endpoint, forcePathStyle });
  const canonicalUri = forcePathStyle ? `/${bucket}/${key}` : `/${key}`;
  const headers = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    'content-type': contentType
  };
  const canonicalHeaders = buildCanonicalHeaders(headers);
  const signedHeaders = buildSignedHeaders(headers);
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');
  const signingKey = getSigningKey(secretAccessKey, dateStamp, region, 's3');
  const signature = hmac(signingKey, stringToSign, 'hex');
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(', ');

  const url = resolveS3Url({ bucket, key, endpoint: endpoint || 'https://s3.amazonaws.com', forcePathStyle });
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...headers,
      Authorization: authorization
    },
    body
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`S3 upload failed: ${response.status} ${text}`);
  }
  return buildObjectUrl(key);
}

function buildLocalUrl(kind, filename) {
  return `/uploads/${kind}/${filename}`;
}

async function uploadToLocal({ dir, filename, body }) {
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, body);
  return filePath;
}

export function createObjectStorageAdapter({ artifactUploadsDir, profileUploadsDir }) {
  const mode = resolveStorageMode();

  return {
    async saveArtifactScreenshot(dataUrl, artifactId) {
      if (!dataUrl || typeof dataUrl !== 'string') {
        return '';
      }
      const match = dataUrl.match(/^data:image\/png;base64,(.*)$/);
      if (!match) {
        return '';
      }
      const buffer = Buffer.from(match[1], 'base64');
      const filename = `${artifactId}.png`;
      const key = `artifacts/${filename}`;
      if (mode === 's3') {
        return uploadToS3({ key, contentType: 'image/png', body: buffer });
      }
      await uploadToLocal({
        dir: artifactUploadsDir,
        filename,
        body: buffer
      });
      return buildLocalUrl('artifacts', filename);
    },

    async saveProfileAvatar(file, userId) {
      if (!file?.data || !file?.contentType) {
        return '';
      }
      const extension = file.contentType.includes('jpeg')
        ? 'jpg'
        : file.contentType.includes('webp')
          ? 'webp'
          : 'png';
      const filename = `${userId}-${Date.now()}.${extension}`;
      const key = `profiles/${filename}`;
      if (mode === 's3') {
        return uploadToS3({ key, contentType: file.contentType, body: file.data });
      }
      await uploadToLocal({
        dir: profileUploadsDir,
        filename,
        body: file.data
      });
      return buildLocalUrl('profiles', filename);
    }
  };
}
