import { handleGoogle } from './providers/google';
import { jsonError } from './errors';

export async function handleAuth(request: Request, env: Env) {
  const url = new URL(request.url);

  if (request.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  switch (url.pathname) {
    case '/auth/google':
      return handleGoogle(request, env);

    // future
    // case '/auth/apple':
    //   return handleApple(request, env);

    // case '/auth/email':
    //   return handleEmail(request, env);

    default:
      return jsonError('Unknown auth provider', 404);
  }
}
