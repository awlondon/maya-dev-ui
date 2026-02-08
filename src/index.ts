import { handleAuth } from './auth';

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/auth/')) {
      return handleAuth(request, env);
    }

    return new Response('Not found', { status: 404 });
  }
};
