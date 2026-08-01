import { DurableObject } from 'cloudflare:workers';

const ALLOWED_ORIGINS = new Set([
  'https://ksrsl.github.io',
  'http://127.0.0.1:8790',
  'http://127.0.0.1:8791',
  'http://localhost:8790',
  'http://localhost:8791'
]);
const VALID_INPUTS = new Set(['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select']);
const ROOM_PATTERN = /^[a-z0-9][a-z0-9_-]{7,79}$/i;
const TOKEN_PATTERN = /^[a-f0-9]{20,64}$/i;
const COMMAND_PATTERN = /^[a-z][a-zA-Z0-9_-]{0,31}$/;
const MAX_VIEWERS = 32;
const MAX_MESSAGE_BYTES = 16384;

function json(value, status = 200, origin = 'https://ksrsl.github.io') {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      Vary: 'Origin'
    }
  });
}

function requestOrigin(request) {
  return request.headers.get('Origin') || '';
}

function originAllowed(request) {
  const origin = requestOrigin(request);
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function openSockets(ctx) {
  return ctx.getWebSockets().filter(socket => socket.readyState === WebSocket.OPEN);
}

function attachment(socket) {
  return socket.deserializeAttachment() || {};
}

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.lastState = null;
    this.lastPersistedAt = 0;
    this.recentEvents = new Map();
    this.ctx.blockConcurrencyWhile(async () => {
      this.lastState = await this.ctx.storage.get('lastState') || null;
    });
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  hostSocket() {
    return openSockets(this.ctx).sort((left, right) => {
      const leftState = attachment(left);
      const rightState = attachment(right);
      if (leftState.joinedAt !== rightState.joinedAt) return leftState.joinedAt - rightState.joinedAt;
      return String(leftState.id).localeCompare(String(rightState.id));
    })[0] || null;
  }

  safeSend(socket, value) {
    try {
      if (socket.readyState === WebSocket.OPEN) socket.send(typeof value === 'string' ? value : JSON.stringify(value));
    } catch {}
  }

  broadcast(value) {
    const message = typeof value === 'string' ? value : JSON.stringify(value);
    openSockets(this.ctx).forEach(socket => this.safeSend(socket, message));
  }

  broadcastViewersAndRoles() {
    const sockets = openSockets(this.ctx);
    const host = this.hostSocket();
    const viewerMessage = JSON.stringify({ type: 'viewers', count: sockets.length });
    sockets.forEach(socket => {
      this.safeSend(socket, viewerMessage);
      this.safeSend(socket, { type: 'role', host: socket === host, state: this.lastState });
    });
  }

  async fetch(request) {
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return json({ ok: false, error: 'EXPECTED_WEBSOCKET' }, 426, requestOrigin(request) || undefined);
    }
    if (openSockets(this.ctx).length >= MAX_VIEWERS) {
      return json({ ok: false, error: 'ROOM_FULL' }, 503, requestOrigin(request) || undefined);
    }

    const [client, server] = Object.values(new WebSocketPair());
    const state = {
      id: crypto.randomUUID(),
      joinedAt: Date.now(),
      windowStartedAt: Date.now(),
      messagesInWindow: 0
    };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(state);

    const host = this.hostSocket();
    this.safeSend(server, { type: 'welcome', host: server === host, state: this.lastState });
    this.broadcastViewersAndRoles();
    return new Response(null, { status: 101, webSocket: client });
  }

  rateAllowed(socket) {
    const state = attachment(socket);
    const now = Date.now();
    if (!state.windowStartedAt || now - state.windowStartedAt >= 1000) {
      state.windowStartedAt = now;
      state.messagesInWindow = 0;
    }
    state.messagesInWindow += 1;
    socket.serializeAttachment(state);
    return state.messagesInWindow <= 90;
  }

  rememberEvent(eventId) {
    if (!eventId) return true;
    if (this.recentEvents.has(eventId)) return false;
    this.recentEvents.set(eventId, Date.now());
    if (this.recentEvents.size > 256) {
      const oldest = this.recentEvents.keys().next().value;
      this.recentEvents.delete(oldest);
    }
    return true;
  }

  persistState() {
    const now = Date.now();
    if (now - this.lastPersistedAt < 1000) return;
    this.lastPersistedAt = now;
    this.ctx.waitUntil(this.ctx.storage.put('lastState', this.lastState));
  }

  async webSocketMessage(socket, rawMessage) {
    if (typeof rawMessage !== 'string' || rawMessage.length > MAX_MESSAGE_BYTES) {
      socket.close(1009, 'Message too large');
      return;
    }
    if (!this.rateAllowed(socket)) {
      socket.close(1008, 'Rate limit exceeded');
      return;
    }

    let message;
    try {
      message = JSON.parse(rawMessage);
    } catch {
      return;
    }

    if (message?.type === 'input') {
      const key = String(message.key || '').toLowerCase();
      const eventId = String(message.eventId || '').slice(0, 96);
      if (!VALID_INPUTS.has(key) || !this.rememberEvent(eventId)) return;
      this.broadcast({ type: 'input', key, pressed: message.pressed !== false, eventId });
      return;
    }

    if (message?.type === 'command') {
      const name = String(message.name || '');
      if (!COMMAND_PATTERN.test(name)) return;
      this.broadcast({ type: 'command', name, data: message.data && typeof message.data === 'object' ? message.data : {} });
      return;
    }

    if (message?.type === 'state' && socket === this.hostSocket()) {
      const state = message.state;
      if (!state || typeof state !== 'object' || typeof state.gameId !== 'string' || state.gameId.length > 48) return;
      this.lastState = state;
      this.persistState();
      this.broadcast({ type: 'state', state });
    }
  }

  async webSocketClose(socket, code, reason) {
    try { socket.close(code, reason); } catch {}
    this.broadcastViewersAndRoles();
  }

  async webSocketError(socket) {
    try { socket.close(1011, 'Connection error'); } catch {}
    this.broadcastViewersAndRoles();
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = requestOrigin(request);
    if (!originAllowed(request)) return json({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403);
    if (request.method === 'GET' && url.pathname === '/v1/health') {
      return json({ ok: true, service: 'ksr-gameboi-relay', protocol: 1 }, 200, origin || undefined);
    }
    if (request.method !== 'GET' || !url.pathname.startsWith('/room/')) {
      return json({ ok: false, error: 'NOT_FOUND' }, 404, origin || undefined);
    }
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return json({ ok: false, error: 'EXPECTED_WEBSOCKET' }, 426, origin || undefined);
    }

    const room = decodeURIComponent(url.pathname.slice('/room/'.length));
    const token = url.searchParams.get('token') || '';
    if (!ROOM_PATTERN.test(room) || !TOKEN_PATTERN.test(token)) {
      return json({ ok: false, error: 'INVALID_ROOM' }, 400, origin || undefined);
    }

    const id = env.ROOMS.idFromName(`${room}:${token}`);
    return env.ROOMS.get(id).fetch(request);
  }
};
