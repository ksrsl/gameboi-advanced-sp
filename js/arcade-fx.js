const INPUT_KEYS = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];

export function createArcadeFX({ display, host, storage }) {
  const layer = document.createElement('div');
  layer.id = 'arcade-fx';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = '<i class="arcade-scanlines"></i><i class="arcade-glass"></i><i class="arcade-flash"></i>';
  display.append(layer);

  const flash = layer.querySelector('.arcade-flash');
  let enabled = storage.get('arcadeFx:enabled', true);
  let animationFrame = 0;
  let sampleStarted = performance.now();
  let sampledFrames = 0;
  let slowSamples = 0;
  let lastPulse = 0;

  function applyEnabled() {
    display.classList.toggle('arcade-fx-disabled', !enabled);
    storage.set('arcadeFx:enabled', enabled);
  }

  function animate(element, frames, options) {
    if (!enabled || typeof element?.animate !== 'function') return;
    element.animate(frames, options);
  }

  function input(key, pressed) {
    if (!INPUT_KEYS.includes(key)) return;
    display.classList.toggle(`arcade-key-${key}`, pressed);
    if (!pressed || !enabled) return;
    if (host.dataset.cartridge === 'snake' && ['up', 'down', 'left', 'right'].includes(key)) return;

    animate(flash, [
      { opacity: 0, background: 'transparent' },
      { opacity: 0.075, background: 'radial-gradient(circle at 50% 100%, #b9eaff, transparent 62%)' },
      { opacity: 0, background: 'transparent' }
    ], { duration: 90, easing: 'ease-out' });
  }

  function tone(frequency, duration = 0.06) {
    if (!enabled || host.hidden) return;
    const now = performance.now();
    if (now - lastPulse < 22) return;
    lastPulse = now;

    if (frequency < 185) {
      animate(host, [
        { transform: 'translate3d(0,0,0)' },
        { transform: 'translate3d(-1px,.5px,0)' },
        { transform: 'translate3d(1px,-.5px,0)' },
        { transform: 'translate3d(0,0,0)' }
      ], { duration: Math.min(145, Math.max(75, duration * 700)), easing: 'ease-out' });
      animate(flash, [
        { opacity: 0.18, background: '#dff6ff' },
        { opacity: 0, background: '#dff6ff' }
      ], { duration: 130, easing: 'ease-out' });
    } else if (frequency > 700) {
      animate(flash, [
        { opacity: 0.13, background: 'radial-gradient(circle, #ffffff, #8edcff55 42%, transparent 74%)' },
        { opacity: 0, background: 'transparent' }
      ], { duration: 150, easing: 'ease-out' });
    }
  }

  function gameStart(gameId) {
    host.dataset.cartridge = gameId || '';
    animate(host, [
      { opacity: 0, transform: 'scale(1.035)', filter: 'brightness(1.65) saturate(.45)' },
      { opacity: 1, transform: 'scale(1)', filter: 'brightness(1) saturate(1)' }
    ], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  function gameEnd() {
    delete host.dataset.cartridge;
    INPUT_KEYS.forEach(key => display.classList.remove(`arcade-key-${key}`));
  }

  function monitor(time) {
    if (document.hidden) {
      sampledFrames = 0;
      sampleStarted = time;
      animationFrame = requestAnimationFrame(monitor);
      return;
    }
    sampledFrames += 1;
    const elapsed = time - sampleStarted;
    if (elapsed >= 2200) {
      const fps = sampledFrames * 1000 / elapsed;
      if (fps < 42) slowSamples += 1;
      else slowSamples = Math.max(0, slowSamples - 1);
      display.classList.toggle('arcade-lite', slowSamples >= 2);
      display.dataset.fps = String(Math.round(fps));
      sampledFrames = 0;
      sampleStarted = time;
    }
    animationFrame = requestAnimationFrame(monitor);
  }

  applyEnabled();
  animationFrame = requestAnimationFrame(monitor);

  return Object.freeze({
    get enabled() { return enabled; },
    input,
    tone,
    gameStart,
    gameEnd,
    setEnabled(value) {
      enabled = Boolean(value);
      applyEnabled();
    },
    close() {
      cancelAnimationFrame(animationFrame);
      layer.remove();
    }
  });
}
