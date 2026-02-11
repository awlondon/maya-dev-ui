const DEFAULT_ALLOWED_ORIGINS = [
  'https://maya-dev-ui.pages.dev',
  'https://dev.primarydesignco.com',
  'http://localhost:3000',
  'http://localhost:5173'
];

function parseOriginList(raw = '') {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function resolveAllowedOrigins(env: Env) {
  return [
    ...new Set([
      ...DEFAULT_ALLOWED_ORIGINS,
      ...parseOriginList(env.CORS_ALLOWED_ORIGINS || ''),
      ...parseOriginList(env.FRONTEND_URL || '')
    ])
  ];
}

export function buildCorsHeaders(request: Request, env: Env) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = resolveAllowedOrigins(env);
  const allowOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    Vary: 'Origin'
  };
}

export function jsonResponse(payload: unknown, request: Request, env: Env, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  const corsHeaders = buildCorsHeaders(request, env);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(JSON.stringify(payload), {
    ...init,
    headers
  });
}

export function withCors(response: Response, request: Request, env: Env) {
  const headers = new Headers(response.headers);
  const cors = buildCorsHeaders(request, env);
  Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function optionsResponse(request: Request, env: Env) {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request, env)
  });
}
