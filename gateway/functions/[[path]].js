const ROUTES = Object.freeze({
  leaderboard: 'LEADERBOARD',
  relay: 'RELAY'
});

function notFound() {
  return new Response(JSON.stringify({ ok: false, error: 'NOT_FOUND' }), {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function serviceInfo() {
  return new Response('Gameboi KSR services are online.', {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const route = segments.shift();
  if (!route) return serviceInfo();
  const bindingName = ROUTES[route];
  if (!bindingName || !context.env[bindingName]) return notFound();

  url.pathname = `/${segments.join('/')}`;
  const request = new Request(url.toString(), context.request);
  return context.env[bindingName].fetch(request);
}
