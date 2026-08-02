const BALANCED_RENDER_SCALE = 1.5;
const PERFORMANCE_RENDER_SCALE = 1.25;
const HIGH_RENDER_SCALE = 2;

function selectRenderScale() {
  const quality = new URLSearchParams(globalThis.location?.search || '').get('quality');
  if (quality === 'high') return HIGH_RENDER_SCALE;
  if (quality === 'performance') return PERFORMANCE_RENDER_SCALE;
  if (document.querySelector('#display')?.classList.contains('arcade-lite')) {
    return PERFORMANCE_RENDER_SCALE;
  }
  return BALANCED_RENDER_SCALE;
}

export function createGameContext(canvas, logicalWidth, logicalHeight) {
  // Balanced supersampling stays crisp on a 320x240 MOAP surface without
  // forcing every cartridge to shade four times the visible pixel count.
  const scale = selectRenderScale();

  canvas.width = Math.round(logicalWidth * scale);
  canvas.height = Math.round(logicalHeight * scale);
  canvas.dataset.renderScale = String(scale);
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;
  canvas.style.contain = 'strict';
  canvas.style.backfaceVisibility = 'hidden';

  const context = canvas.getContext('2d', {
    alpha: false,
    desynchronized: true
  });

  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.lineCap = 'round';
  context.lineJoin = 'round';
  return context;
}

export function smoothToward(current, target, responsiveness, deltaTime) {
  const blend = 1 - Math.exp(-Math.max(0, responsiveness) * Math.max(0, deltaTime));
  return current + (target - current) * blend;
}

export function safeDelta(time, previousTime, maximum = 1 / 30) {
  return Math.min(maximum, Math.max(0, (time - previousTime) / 1000 || 0));
}
