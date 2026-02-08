import jwt from '@tsndr/cloudflare-worker-jwt';

export async function issueSession(user: any, env: Env) {
  const token = await jwt.sign(
    {
      sub: user.id,
      email: user.email,
      provider: user.provider,
      iat: Math.floor(Date.now() / 1000)
    },
    env.SESSION_SECRET
  );

  return new Response(
    JSON.stringify({
      token,
      user,
      session: { token, user }
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `session=${token}; Path=/; HttpOnly; Secure; SameSite=None`
      }
    }
  );
}

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }
  const cookies = cookieHeader.split(';');
  for (const entry of cookies) {
    const [key, ...rest] = entry.trim().split('=');
    if (key === name) {
      return rest.join('=');
    }
  }
  return null;
}

export async function getSession(request: Request, env: Env) {
  const token = getCookieValue(request.headers.get('Cookie'), 'session');
  if (!token) {
    return null;
  }
  const valid = await jwt.verify(token, env.SESSION_SECRET);
  if (!valid) {
    return null;
  }
  const payload: any = jwt.decode(token).payload;
  return {
    token,
    user: {
      id: payload.sub,
      email: payload.email,
      provider: payload.provider
    }
  };
}
