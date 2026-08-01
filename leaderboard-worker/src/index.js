const GAME_CATALOG = Object.freeze({
  snake: { title: 'NEON SERPENT', order: 'desc', max: 2000000000 },
  'block-drop': { title: 'BLOCK DROP', order: 'desc', max: 2000000000 },
  'brick-blaster': { title: 'BRICK BLASTER', order: 'desc', max: 2000000000 },
  'astro-defender': { title: 'ASTRO DEFENDER', order: 'desc', max: 2000000000 },
  'pet-byte': { title: 'KSR COMPANION', order: 'desc', max: 10000 },
  'byte-flyer': { title: 'SKY PULSE', order: 'desc', max: 2000000000 },
  'road-rush': { title: 'ROAD RUSH', order: 'desc', max: 2000000000 },
  'dungeon-byte': { title: 'SHADOW CIRCUIT', order: 'desc', max: 1000000 },
  'fishing-byte': { title: 'NEON ANGLER', order: 'desc', max: 1000000 },
  'maze-muncher': { title: 'MAZE MUNCHER', order: 'desc', max: 2000000000 },
  'mini-golf': { title: 'MINI GOLF', order: 'asc', max: 10000 },
  'pocket-tennis': { title: 'POCKET TENNIS', order: 'desc', max: 1000000 },
  'pixel-kart': { title: 'PIXEL KART', order: 'asc', max: 36000000 },
  'survivor-byte': { title: 'NEON ONSLAUGHT', order: 'desc', max: 2000000000 },
  'bomb-grid': { title: 'BOMB GRID', order: 'desc', max: 1000000 },
  'pixel-quest': { title: 'PIXEL QUEST', order: 'desc', max: 2000000000 },
  'battle-tanks': { title: 'BATTLE TANKS', order: 'desc', max: 2000000000 },
  'pocket-fighter': { title: 'POCKET FIGHTER', order: 'desc', max: 1000000 },
  'street-hoops': { title: 'STREET HOOPS', order: 'desc', max: 2000000000 },
  'pocket-bowling': { title: 'POCKET BOWLING', order: 'desc', max: 300 },
  'neon-cycle': { title: 'TRON CYCLE', order: 'desc', max: 2000000000 }
});

const ALLOWED_ORIGINS = new Set([
  'https://ksrsl.github.io',
  'http://127.0.0.1:8790',
  'http://127.0.0.1:8791',
  'http://localhost:8790',
  'http://localhost:8791'
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESIDENT_PATTERN = /^[a-z0-9][a-z0-9._-]{0,62}$/i;

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://ksrsl.github.io';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin'
  };
}

function json(request, value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: corsHeaders(request) });
}

function cleanText(value, maximumLength) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maximumLength);
}

function normalizeResidentName(value) {
  let name = cleanText(value, 63).toLowerCase();
  if (name.endsWith('.resident')) name = name.slice(0, -9);
  return name;
}

function originAllowed(request) {
  const origin = request.headers.get('Origin');
  return !origin || ALLOWED_ORIGINS.has(origin);
}

async function listScores(request, env, gameId) {
  const game = GAME_CATALOG[gameId];
  if (!game) return json(request, { ok: false, error: 'UNKNOWN_GAME' }, 404);
  const requestUrl = new URL(request.url);
  const limit = Math.min(25, Math.max(1, Number.parseInt(requestUrl.searchParams.get('limit') || '10', 10) || 10));
  const order = game.order === 'asc' ? 'ASC' : 'DESC';
  const result = await env.DB.prepare(
    `SELECT resident_name, display_name, score, updated_at
       FROM leaderboard_scores
      WHERE game_id = ?1
      ORDER BY score ${order}, updated_at ASC
      LIMIT ?2`
  ).bind(gameId, limit).all();
  const entries = (result.results || []).map((entry, index) => ({
    rank: index + 1,
    residentName: entry.resident_name,
    score: Number(entry.score),
    updatedAt: Number(entry.updated_at)
  }));
  return json(request, { ok: true, game: { id: gameId, title: game.title, order: game.order }, entries });
}

async function submitScore(request, env) {
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 4096) return json(request, { ok: false, error: 'PAYLOAD_TOO_LARGE' }, 413);

  let body;
  try {
    body = await request.json();
  } catch {
    return json(request, { ok: false, error: 'INVALID_JSON' }, 400);
  }

  const gameId = cleanText(body?.gameId, 40);
  const game = GAME_CATALOG[gameId];
  if (!game) return json(request, { ok: false, error: 'UNKNOWN_GAME' }, 400);

  const residentId = cleanText(body?.residentId, 36).toLowerCase();
  const residentName = normalizeResidentName(body?.residentName);
  const displayName = cleanText(body?.displayName, 63);
  const score = Number(body?.score);
  if (!UUID_PATTERN.test(residentId)) return json(request, { ok: false, error: 'INVALID_RESIDENT_ID' }, 400);
  if (!RESIDENT_PATTERN.test(residentName)) return json(request, { ok: false, error: 'INVALID_RESIDENT_NAME' }, 400);
  if (!Number.isSafeInteger(score) || score <= 0 || score > game.max) {
    return json(request, { ok: false, error: 'INVALID_SCORE' }, 400);
  }

  const updatedAt = Date.now();
  const comparison = game.order === 'asc' ? '<' : '>';
  const result = await env.DB.prepare(
    `INSERT INTO leaderboard_scores
       (game_id, resident_id, resident_name, display_name, score, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(game_id, resident_id) DO UPDATE SET
       resident_name = excluded.resident_name,
       display_name = excluded.display_name,
       score = excluded.score,
       updated_at = excluded.updated_at
     WHERE excluded.score ${comparison} leaderboard_scores.score`
  ).bind(gameId, residentId, residentName, displayName, score, updatedAt).run();

  const current = await env.DB.prepare(
    `SELECT resident_name, score, updated_at
       FROM leaderboard_scores
      WHERE game_id = ?1 AND resident_id = ?2`
  ).bind(gameId, residentId).first();

  return json(request, {
    ok: true,
    improved: Number(result.meta?.changes || 0) > 0,
    entry: {
      residentName: current.resident_name,
      score: Number(current.score),
      updatedAt: Number(current.updated_at)
    }
  });
}

export async function handleRequest(request, env) {
  if (!originAllowed(request)) return json(request, { ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (request.method === 'GET' && path === '/v1/health') {
    return json(request, { ok: true, service: 'ksr-gameboi-leaderboard', games: Object.keys(GAME_CATALOG).length });
  }
  if (request.method === 'GET' && path === '/v1/games') {
    const games = Object.entries(GAME_CATALOG).map(([id, game]) => ({ id, title: game.title, order: game.order }));
    return json(request, { ok: true, games });
  }
  if (request.method === 'GET' && path.startsWith('/v1/leaderboard/')) {
    return listScores(request, env, decodeURIComponent(path.slice('/v1/leaderboard/'.length)));
  }
  if (request.method === 'POST' && path === '/v1/scores') return submitScore(request, env);
  return json(request, { ok: false, error: 'NOT_FOUND' }, 404);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error('Leaderboard request failed', error);
      return json(request, { ok: false, error: 'SERVICE_ERROR' }, 500);
    }
  }
};
