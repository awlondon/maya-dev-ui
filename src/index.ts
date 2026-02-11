import { handleAuth } from './auth';
import { handleMe } from './auth/me';

const DEFAULT_PLANS = [
  {
    tier: 'free',
    display_name: 'Free',
    monthly_credits: 500,
    daily_cap: 100,
    price_label: '$0',
    stripe_price_id: null
  },
  {
    tier: 'starter',
    display_name: 'Starter',
    monthly_credits: 5000,
    daily_cap: 500,
    price_label: '$12/mo',
    stripe_price_id: null
  },
  {
    tier: 'pro',
    display_name: 'Pro',
    monthly_credits: 20000,
    daily_cap: 2000,
    price_label: '$29/mo',
    stripe_price_id: null
  },
  {
    tier: 'enterprise',
    display_name: 'Enterprise',
    monthly_credits: 100000,
    daily_cap: 10000,
    price_label: 'Contact sales',
    stripe_price_id: null
  }
];

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

function allowedOrigins(env: Env) {
  return [
    ...new Set([
      ...DEFAULT_ALLOWED_ORIGINS,
      ...parseEnvOriginList(env.CORS_ALLOWED_ORIGINS || ''),
      ...parseEnvOriginList(env.FRONTEND_URL || '')
    ])
  ];
}

function corsHeaders(request: Request, env: Env) {
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = allowedOrigins(env).includes(origin)
    ? origin
    : DEFAULT_ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    Vary: 'Origin'
  };
}

function jsonWithCors(payload: unknown, request: Request, env: Env, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request, env)
    }
  });
}

function normalizePathname(pathname: string) {
  const withoutApiPrefix = pathname.startsWith('/api/') ? pathname.slice(4) : pathname;
  return withoutApiPrefix.startsWith('/v1/')
    ? withoutApiPrefix.slice(3)
    : withoutApiPrefix;
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env)
      });
    }

    const url = new URL(request.url);
    const pathname = normalizePathname(url.pathname);

    if (pathname.startsWith('/auth/')) {
      const response = await handleAuth(new Request(new URL(pathname, request.url), request), env);
      const body = await response.text();
      const parsed = body ? JSON.parse(body) : {};
      return jsonWithCors(parsed, request, env, response.status);
    }

    if (pathname === '/me') {
      if (request.method !== 'GET') {
        return jsonWithCors({ ok: false, error: 'Method not allowed' }, request, env, 405);
      }
      const response = await handleMe(request, env);
      const body = await response.text();
      const parsed = body ? JSON.parse(body) : {};
      return jsonWithCors(parsed, request, env, response.status);
    }

    if (pathname === '/plans' && request.method === 'GET') {
      return jsonWithCors({ ok: true, plans: DEFAULT_PLANS }, request, env);
    }

    if (pathname === '/usage/overview' && request.method === 'GET') {
      return jsonWithCors(
        {
          ok: true,
          overview: {
            total_requests: 0,
            total_credits: 0,
            avg_latency_ms: 0,
            success_rate: 1
          },
          credits_used_today: 0,
          daily_limit: 100
        },
        request,
        env
      );
    }

    return jsonWithCors({ ok: false, error: 'Not found' }, request, env, 404);
  }
};
