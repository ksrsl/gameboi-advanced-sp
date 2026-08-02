const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class DuoSync {
  constructor({ endpoint = '', room = '', token = '', device = 'preview' } = {}) {
    this.endpoint = endpoint.replace(/\/$/, '');
    this.room = room;
    this.token = token;
    this.device = device;
    this.remoteEnabled = Boolean(this.endpoint && this.room && this.token);
    this.isHost = !this.remoteEnabled;
    this.connected = !this.remoteEnabled;
    this.socket = null;
    this.closed = false;
    this.retry = 0;
    this.listeners = new Map();
    this.seen = new Set();
    this.seenOrder = [];
    this.channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(`ksr-duo-${device}`) : null;
    this.channel?.addEventListener('message', event => this.receive(event.data));
    this.storageKey = `ksr-duo-link-${device}`;
    this.storageListener = event => {
      if (event.key !== this.storageKey || !event.newValue) return;
      try { this.receive(JSON.parse(event.newValue)); } catch {}
    };
    window.addEventListener('storage', this.storageListener);
  }

  on(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
    return () => this.listeners.get(type)?.delete(handler);
  }

  emit(type, value) {
    this.listeners.get(type)?.forEach(handler => handler(value));
  }

  remember(id) {
    if (!id || this.seen.has(id)) return false;
    this.seen.add(id);
    this.seenOrder.push(id);
    if (this.seenOrder.length > 256) this.seen.delete(this.seenOrder.shift());
    return true;
  }

  receive(message) {
    if (!message || message.product !== 'ksr-duo' || !this.remember(message.eventId)) return;
    if (message.type === 'action') this.emit('action', message.payload || {});
    if (message.type === 'snapshot') this.emit('snapshot', message.payload || {});
  }

  shareLocal(message) {
    this.channel?.postMessage(message);
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(message));
      localStorage.removeItem(this.storageKey);
    } catch {}
  }

  sendSocket(message) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }

  sendAction(payload) {
    const message = { product: 'ksr-duo', type: 'action', payload, eventId: makeId() };
    this.remember(message.eventId);
    this.shareLocal(message);
    if (this.remoteEnabled) this.sendSocket({ type: 'command', name: 'duoAction', data: message });
  }

  publishSnapshot(payload) {
    const message = { product: 'ksr-duo', type: 'snapshot', payload, eventId: makeId() };
    this.remember(message.eventId);
    this.shareLocal(message);
    if (this.remoteEnabled && this.isHost) {
      this.sendSocket({ type: 'state', state: { gameId: 'duo', snapshot: message } });
    }
  }

  connect() {
    if (!this.remoteEnabled || this.closed || this.socket) return;
    const target = new URL(this.endpoint);
    target.protocol = target.protocol === 'https:' ? 'wss:' : 'ws:';
    target.pathname = `${target.pathname.replace(/\/$/, '')}/room/${encodeURIComponent(this.room)}`;
    target.search = new URLSearchParams({ token: this.token }).toString();
    const socket = new WebSocket(target);
    this.socket = socket;
    this.emit('status', { connected: false, label: 'LINKING' });

    socket.addEventListener('open', () => {
      this.connected = true;
      this.retry = 0;
      this.emit('status', { connected: true, label: 'DUO LINK' });
    });

    socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'welcome' || message.type === 'role') {
        this.isHost = Boolean(message.host);
        if (message.state?.gameId === 'duo') this.receive(message.state.snapshot);
      } else if (message.type === 'command' && message.name === 'duoAction') {
        this.receive(message.data);
      } else if (message.type === 'state' && message.state?.gameId === 'duo') {
        this.receive(message.state.snapshot);
      }
    });

    const reconnect = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.connected = false;
      this.isHost = false;
      this.emit('status', { connected: false, label: 'RECONNECT' });
      if (!this.closed) {
        const delay = Math.min(10000, 500 * (2 ** this.retry++));
        setTimeout(() => this.connect(), delay);
      }
    };

    socket.addEventListener('close', reconnect);
    socket.addEventListener('error', () => socket.close());
  }

  close() {
    this.closed = true;
    this.channel?.close();
    window.removeEventListener('storage', this.storageListener);
    this.socket?.close(1000, 'Duo screen closed');
    this.socket = null;
  }
}

export function duoConfig(locationObject = window.location) {
  const params = new URLSearchParams(locationObject.search);
  return {
    mode: ['top', 'bottom'].includes(params.get('screen')) ? params.get('screen') : 'preview',
    endpoint: params.get('sync') || '',
    room: params.get('room') || '',
    token: params.get('token') || '',
    device: params.get('device') || params.get('room') || 'preview'
  };
}
