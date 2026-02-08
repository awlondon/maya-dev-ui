import jwt from '@tsndr/cloudflare-worker-jwt';
import { issueSession } from '../session';
import { jsonError } from '../errors';

export async function handleGoogle(request: Request, env: Env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const { id_token } = body;
  if (!id_token) {
    return jsonError('Missing id_token', 400);
  }

  const decoded = jwt.decode(id_token);
  if (!decoded?.payload) {
    return jsonError('Invalid token', 401);
  }

  const payload: any = decoded.payload;

  // Hard security checks
  if (payload.aud !== env.GOOGLE_CLIENT_ID) {
    return jsonError('Invalid audience', 401);
  }

  if (
    payload.iss !== 'https://accounts.google.com' &&
    payload.iss !== 'accounts.google.com'
  ) {
    return jsonError('Invalid issuer', 401);
  }

  const user = {
    id: `google:${payload.sub}`,
    email: payload.email,
    name: payload.name,
    provider: 'google'
  };

  return issueSession(user, env);
}
