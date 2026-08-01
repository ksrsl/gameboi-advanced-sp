const VALID_INPUTS = new Set(['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select']);

function makeClientId() {
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return randomId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 48);
}

export function setupLslBridge({ onInput, onStatus = () => {} } = {}) {
  const params = new URLSearchParams(location.search);
  const endpoint = params.get('bridge') || '';
  const token = params.get('bridgeToken') || '';

  if (!endpoint || !token || typeof onInput !== 'function') {
    return Object.freeze({ enabled: false, close() {} });
  }

  let bridgeUrl;
  try {
    bridgeUrl = new URL(endpoint);
    if (bridgeUrl.protocol !== 'https:' && bridgeUrl.hostname !== '127.0.0.1' && bridgeUrl.hostname !== 'localhost') {
      throw new Error('The input bridge must use HTTPS.');
    }
  } catch {
    onStatus({ connected: false, label: 'BUTTON ERROR' });
    return Object.freeze({ enabled: false, close() {} });
  }

  const frame = document.createElement('iframe');
  frame.hidden = true;
  frame.tabIndex = -1;
  frame.title = 'KSR mesh-button input bridge';
  frame.setAttribute('aria-hidden', 'true');
  document.body.append(frame);

  const clientId = makeClientId();
  let lastSequence = 0;
  let closed = false;
  let pollTimer = 0;
  let watchdogTimer = 0;

  function poll(delay = 0) {
    clearTimeout(pollTimer);
    clearTimeout(watchdogTimer);
    if (closed) return;

    pollTimer = window.setTimeout(() => {
      if (closed) return;
      const target = new URL(bridgeUrl);
      target.searchParams.set('client', clientId);
      target.searchParams.set('after', String(lastSequence));
      target.searchParams.set('token', token);
      target.searchParams.set('_', String(Date.now()));
      frame.src = target.toString();
      watchdogTimer = window.setTimeout(() => poll(250), 24000);
    }, delay);
  }

  function receive(event) {
    if (closed || event.source !== frame.contentWindow) return;
    const message = event.data;
    if (!message || message.source !== 'ksr-gameboi-bridge' || message.token !== token) return;

    clearTimeout(watchdogTimer);
    const events = Array.isArray(message.events) ? message.events : [];
    events.forEach(input => {
      const key = String(input?.key || '').toLowerCase();
      const sequence = Number(input?.seq) || 0;
      if (sequence <= lastSequence || !VALID_INPUTS.has(key)) return;
      lastSequence = sequence;
      onInput(key, Boolean(input.down), sequence);
    });

    if (Number(message.seq) > lastSequence) lastSequence = Number(message.seq);
    onStatus({ connected: true, label: 'BUTTONS READY' });
    poll(0);
  }

  window.addEventListener('message', receive);
  poll(0);

  return Object.freeze({
    enabled: true,
    close() {
      closed = true;
      clearTimeout(pollTimer);
      clearTimeout(watchdogTimer);
      window.removeEventListener('message', receive);
      frame.remove();
    }
  });
}
