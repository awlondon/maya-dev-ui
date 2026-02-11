import { jsonResponse, optionsResponse } from '../_lib/http';

const DEFAULT_OVERVIEW = {
  total_requests: 0,
  total_credits: 0,
  avg_latency_ms: 0,
  success_rate: 1
};

export async function onRequestOptions({ request, env }: { request: Request; env: Env }) {
  return optionsResponse(request, env);
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  return jsonResponse(
    {
      ok: true,
      overview: DEFAULT_OVERVIEW,
      credits_used_today: 0,
      daily_limit: 100
    },
    request,
    env
  );
}
