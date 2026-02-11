import { requestEmailLink } from '../../../../src/auth/providers/email';
import { optionsResponse, withCors } from '../../../_lib/http';

export async function onRequestOptions({ request, env }: { request: Request; env: Env }) {
  return optionsResponse(request, env);
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const response = await requestEmailLink(request, env);
  return withCors(response, request, env);
}
