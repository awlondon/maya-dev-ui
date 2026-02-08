import { getSessionFromRequest } from './session';

export async function handleMe(request: Request, env: Env) {
  const session = await getSessionFromRequest(request, env);

  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  return Response.json({ user: session.user });
}
