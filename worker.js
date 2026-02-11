const DEFAULT_ALLOWED_ORIGINS = [
  'https://maya-dev-ui.pages.dev',
  'https://dev.primarydesignco.com',
  'http://localhost:3000',
  'http://localhost:5173'
];

function parseEnvOriginList(raw = '') {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function allowedOrigins(env) {
  return [
    ...new Set([
      ...DEFAULT_ALLOWED_ORIGINS,
      ...parseEnvOriginList(env.CORS_ALLOWED_ORIGINS || ''),
      ...parseEnvOriginList(env.FRONTEND_URL || '')
    ])
  ];
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = allowedOrigins(env).includes(origin)
    ? origin
    : DEFAULT_ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers')
      || 'Content-Type,Authorization',
    Vary: 'Origin'
  };
}

function normalizePathname(pathname) {
  const withoutApiPrefix = pathname.startsWith('/api/') ? pathname.slice(4) : pathname;
  return withoutApiPrefix.startsWith('/v1/')
    ? withoutApiPrefix.slice(3)
    : withoutApiPrefix;
}

async function upsertUserBillingState(env, userId, patch) {
  try {
    return await upsertUserToStore(env, userId, patch);
  } catch (error) {
    if (String(error?.message || '').includes('GitHub user writes are disabled')) {
      return null;
    }
    throw error;
  }
}

async function findUserIdByStripeCustomer(env, stripeCustomerId) {
  return findUserIdByStripeCustomerInStore(env, stripeCustomerId);
}

async function getUserFromStore(env, userId) {
  const { rows } = await readUsersCSV(env);
  return rows.find((row) => row.user_id === userId) || null;
}

async function upsertUserToStore(env, userId, patch) {
  assertLegacyUserStoreEnabled(env);
  if (env.GITHUB_USER_WRITES_ENABLED !== 'true') {
    throw new Error('GitHub user writes are disabled. Persist billing state in Postgres.');
  }
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || 'main';

  const { sha, rows } = await readUsersCSV(env);

  const user = rows.find((row) => row.user_id === userId);
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }
  return origin.replace(/\/$/, '');
}

function withCors(response, headers) {
  const nextHeaders = new Headers(response.headers);
  Object.entries(headers).forEach(([key, value]) => nextHeaders.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders
  });
}

export default {
  async fetch(request, env) {
    const baseCorsHeaders = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: baseCorsHeaders
      });
    }

    let origin;
    try {
      origin = canonicalApiOrigin(env);
    } catch (error) {
      return withCors(
        new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Bad gateway' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        }),
        baseCorsHeaders
      );
    }

    const url = new URL(request.url);
    const upstreamPath = normalizePathname(url.pathname);
    const upstreamUrl = new URL(`${origin}${upstreamPath}${url.search}`);

    const headers = new Headers(request.headers);
    headers.set('x-forwarded-host', url.host);
    headers.set('x-forwarded-proto', url.protocol.replace(':', ''));

    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual'
    });

    return withCors(upstreamResponse, baseCorsHeaders);
  }
};
