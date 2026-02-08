export async function onRequest() {
  return new Response(
    JSON.stringify({ ok: true, source: 'cloudflare-pages-function' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
