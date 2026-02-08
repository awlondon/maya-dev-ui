import { handleAuth } from './auth';
import { getSession } from './auth/session';

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/auth/')) {
      return handleAuth(request, env);
    }

    if (url.pathname === '/me') {
      if (request.method !== 'GET') {
        return new Response('Method not allowed', { status: 405 });
      }
      const session = await getSession(request, env);
      if (!session) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify(session), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }
};
