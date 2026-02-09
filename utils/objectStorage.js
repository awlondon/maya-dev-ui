import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

function resolvePublicBaseUrl({ publicBaseUrl, bucket, endpoint, region }) {
  if (publicBaseUrl) {
    return publicBaseUrl.replace(/\/$/, '');
  }
  if (endpoint) {
    return `${endpoint.replace(/\/$/, '')}/${bucket}`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com`;
}

function hmac(key, value) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest();
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getSignatureKey(secretAccessKey, dateStamp, region) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

async function putObjectS3({
  bucket,
  endpoint,
  region,
  accessKeyId,
  secretAccessKey,
  key,
  body,
  contentType
}) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\..+/g, '') + 'Z';
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hash(body);

  const resolvedEndpoint = endpoint
    ? endpoint.replace(/\/$/, '')
    : `https://${bucket}.s3.${region}.amazonaws.com`;
  const url = endpoint
    ? `${resolvedEndpoint}/${bucket}/${key}`
    : `${resolvedEndpoint}/${key}`;
  const urlObj = new URL(url);
  const host = urlObj.host;
  const canonicalUri = urlObj.pathname;

  const canonicalHeaders = `host:${host}\n`
    + `x-amz-content-sha256:${payloadHash}\n`
    + `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
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
    hash(canonicalRequest)
  ].join('\n');
  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region);
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(stringToSign, 'utf8')
    .digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization
    },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`S3 upload failed: ${response.status} ${text}`);
  }
}

export function createObjectStorage({
  mode = 'local',
  artifactUploadsDir,
  profileUploadsDir,
  publicPathPrefix = '/uploads',
  bucket = process.env.S3_BUCKET,
  endpoint = process.env.S3_ENDPOINT,
  region = process.env.S3_REGION || 'us-east-1',
  accessKeyId = process.env.S3_ACCESS_KEY_ID,
  secretAccessKey = process.env.S3_SECRET_ACCESS_KEY,
  publicBaseUrl = process.env.STORAGE_PUBLIC_BASE_URL
} = {}) {
  if (mode === 's3') {
    if (!bucket) {
      throw new Error('S3 bucket is required for object storage mode.');
    }
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('S3 access key and secret are required for object storage mode.');
    }
    const baseUrl = resolvePublicBaseUrl({ publicBaseUrl, bucket, endpoint, region });

    return {
      mode,
      async uploadArtifactScreenshot({ buffer, artifactId, contentType }) {
        const key = `artifacts/${artifactId}.png`;
        await putObjectS3({
          bucket,
          endpoint,
          region,
          accessKeyId,
          secretAccessKey,
          key,
          body: buffer,
          contentType: contentType || 'image/png'
        });
        return `${baseUrl}/${key}`;
      },
      async uploadProfileAvatar({ buffer, userId, extension, contentType }) {
        const key = `profiles/${userId}-${Date.now()}.${extension}`;
        await putObjectS3({
          bucket,
          endpoint,
          region,
          accessKeyId,
          secretAccessKey,
          key,
          body: buffer,
          contentType: contentType || `image/${extension}`
        });
        return `${baseUrl}/${key}`;
      }
    };
  }

  return {
    mode: 'local',
    async uploadArtifactScreenshot({ buffer, artifactId }) {
      const filename = `${artifactId}.png`;
      const filePath = path.join(artifactUploadsDir, filename);
      await fs.mkdir(artifactUploadsDir, { recursive: true });
      await fs.writeFile(filePath, buffer);
      return `${publicPathPrefix}/artifacts/${filename}`;
    },
    async uploadProfileAvatar({ buffer, userId, extension }) {
      const filename = `${userId}-${Date.now()}.${extension}`;
      const filePath = path.join(profileUploadsDir, filename);
      await fs.mkdir(profileUploadsDir, { recursive: true });
      await fs.writeFile(filePath, buffer);
      return `${publicPathPrefix}/profiles/${filename}`;
    }
  };
}
