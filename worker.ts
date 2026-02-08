import { handleAuth } from './src/auth';
import { handleMe } from './src/auth/me';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // --- API ROUTES ---
    if (url.pathname.startsWith('/api/')) {
      const path = url.pathname.replace('/api', '');

      // /api/me
      if (path === '/me' && request.method === 'GET') {
        return handleMe(request, env);
      }

      // /api/auth/*
      if (path.startsWith('/auth/')) {
        return handleAuth(request, env);
      }

      return new Response('Not Found', { status: 404 });
    }

    // --- STATIC UI FALLTHROUGH ---
    // Let Pages / static hosting serve the UI
    return env.ASSETS.fetch(request);
  }
};
