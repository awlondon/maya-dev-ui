import { jsonResponse, optionsResponse } from './_lib/http';

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

export async function onRequestOptions({ request, env }: { request: Request; env: Env }) {
  return optionsResponse(request, env);
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  return jsonResponse({ ok: true, plans: DEFAULT_PLANS }, request, env);
}
