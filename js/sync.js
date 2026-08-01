const VALID_INPUTS = new Set(['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select']);
const makeEventId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class GameSync {
  constructor({ endpoint, room, token }) {
    this.endpoint = endpoint?.replace(/\/$/, '') || '';
    this.room = room || '';
    this.token = token || '';
    this.enabled = Boolean(this.endpoint && this.room && this.token);
    this.isHost = !this.enabled;
    this.connected = !this.enabled;
    this.socket = null;
    this.closed = false;
    this.retry = 0;
    this.queue = [];
    this.listeners = new Map();
  }

  on(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
    return () => this.listeners.get(type)?.delete(handler);
  }

  emit(type, detail) {
    this.listeners.get(type)?.forEach(handler => handler(detail));
  }

  connect() {
    if (!this.enabled || this.closed || this.socket) return;

    const target = new URL(this.endpoint);
    target.protocol = target.protocol === 'https:' ? 'wss:' : 'ws:';
    target.pathname = `${target.pathname.replace(/\/$/, '')}/room/${encodeURIComponent(this.room)}`;
    target.search = new URLSearchParams({ token: this.token }).toString();

    const socket = new WebSocket(target);
    this.socket = socket;
    this.emit('status', { connected: false, label: 'CONNECTING' });

    socket.addEventListener('open', () => {
      this.connected = true;
      this.retry = 0;
      this.emit('status', { connected: true, label: 'LIVE' });
      this.queue.splice(0).forEach(message => this.send(message));
    });

    socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }

      if (message.type === 'welcome') {
        this.isHost = Boolean(message.host);
        this.emit('role', { host: this.isHost });
        if (message.state) this.emit('state', message.state);
      } else if (message.type === 'role') {
        this.isHost = Boolean(message.host);
        this.emit('role', { host: this.isHost });
        if (message.state) this.emit('state', message.state);
      } else if (message.type === 'input') {
        this.emit('input', { key: message.key, pressed: message.pressed !== false });
      } else if (message.type === 'command') {
        this.emit('command', { name: message.name, data: message.data || {} });
      } else if (message.type === 'state') {
        this.emit('state', message.state);
      } else if (message.type === 'viewers') {
        this.emit('viewers', message.count);
      }
    });

    const reconnect = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.connected = false;
      this.isHost = false;
      this.emit('role', { host: false });
      this.emit('status', { connected: false, label: 'RECONNECT' });
      if (!this.closed) {
        const delay = Math.min(10000, 500 * (2 ** this.retry++));
        setTimeout(() => this.connect(), delay);
      }
    };

    socket.addEventListener('close', reconnect);
    socket.addEventListener('error', () => socket.close());
  }

  send(message) {
    if (!this.enabled) return false;
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      if (this.queue.length < 20) this.queue.push(message);
      return false;
    }
    this.socket.send(JSON.stringify(message));
    return true;
  }

  sendInput(key, pressed = true, eventId = makeEventId()) {
    if (!VALID_INPUTS.has(key)) return;
    this.send({ type: 'input', key, pressed: pressed !== false, eventId });
  }

  sendCommand(name, data = {}) {
    this.send({ type: 'command', name, data });
  }

  publish(gameId, snapshot) {
    if (!this.enabled || !this.isHost) return;
    this.send({ type: 'state', state: { gameId, snapshot } });
  }

  close() {
    this.closed = true;
    this.socket?.close(1000, 'Console closed');
    this.socket = null;
  }
}

export function syncConfigFromLocation(locationObject = window.location) {
  const params = new URLSearchParams(locationObject.search);
  return {
    endpoint: params.get('sync') || '',
    room: params.get('room') || '',
    token: params.get('token') || ''
  };
}
