const POINTER_PHASES = new Set(['down', 'move', 'up', 'cancel', 'click']);
const MOVE_INTERVAL_MS = 24;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function setupPointerRelay({ root, sync }) {
  let replaying = false;
  let lastMoveSentAt = 0;
  const remoteTargets = new Map();
  const removers = [];

  function pointFromEvent(event) {
    const bounds = root.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1)
    };
  }

  function relayEvent(phase, event) {
    if (replaying || !sync.enabled) return;

    if (!sync.isHost) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const point = pointFromEvent(event);
    if (!point) return;
    if (phase === 'move') {
      const now = performance.now();
      if (now - lastMoveSentAt < MOVE_INTERVAL_MS) return;
      lastMoveSentAt = now;
    }

    sync.sendPointer({
      phase,
      x: point.x,
      y: point.y,
      pointerId: Number.isInteger(event.pointerId) ? event.pointerId : 1,
      button: Number.isInteger(event.button) ? event.button : 0,
      buttons: Number.isInteger(event.buttons) ? event.buttons : 0,
      pressure: Number.isFinite(event.pressure) ? event.pressure : (event.buttons ? 0.5 : 0)
    });
  }

  function listen(type, phase) {
    const handler = event => relayEvent(phase, event);
    root.addEventListener(type, handler, true);
    removers.push(() => root.removeEventListener(type, handler, true));
  }

  listen('pointerdown', 'down');
  listen('pointermove', 'move');
  listen('pointerup', 'up');
  listen('pointercancel', 'cancel');
  listen('click', 'click');

  function targetAt(x, y) {
    const bounds = root.getBoundingClientRect();
    const clientX = bounds.left + clamp(x, 0, 1) * bounds.width;
    const clientY = bounds.top + clamp(y, 0, 1) * bounds.height;
    const target = document.elementFromPoint(clientX, clientY);
    return {
      clientX,
      clientY,
      target: target && root.contains(target) ? target : root
    };
  }

  function replay(detail) {
    if (!detail || !POINTER_PHASES.has(detail.phase) || sync.isHost) return;
    const pointerId = Number.isInteger(detail.pointerId) ? detail.pointerId : 1;
    const point = targetAt(detail.x, detail.y);
    let target = point.target;
    if (detail.phase !== 'down' && detail.phase !== 'click') {
      target = remoteTargets.get(pointerId) || target;
      if (!target?.isConnected) target = point.target;
    }

    const common = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: point.clientX,
      clientY: point.clientY,
      button: detail.button,
      buttons: detail.buttons,
      detail: 1,
      view: window
    };

    let event;
    if (detail.phase === 'click') {
      event = new MouseEvent('click', common);
    } else {
      const type = `pointer${detail.phase}`;
      const pointerOptions = {
        ...common,
        pointerId,
        pointerType: 'mouse',
        isPrimary: true,
        pressure: detail.pressure
      };
      event = typeof PointerEvent === 'function'
        ? new PointerEvent(type, pointerOptions)
        : new MouseEvent(type, common);
    }

    if (detail.phase === 'down') remoteTargets.set(pointerId, target);
    replaying = true;
    try {
      target.dispatchEvent(event);
    } finally {
      replaying = false;
      if (detail.phase === 'up' || detail.phase === 'cancel') remoteTargets.delete(pointerId);
    }
  }

  return {
    replay,
    close() {
      removers.forEach(remove => remove());
      remoteTargets.clear();
    }
  };
}
