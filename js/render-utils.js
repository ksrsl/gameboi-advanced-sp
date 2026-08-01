const MAX_RENDER_SCALE = 2;

export function createGameContext(canvas, logicalWidth, logicalHeight) {
  // Always supersample at 2x. This stays crisp even when a MOAP browser
  // reports devicePixelRatio 1, then downsamples to the 320x240 surface.
  const scale = MAX_RENDER_SCALE;

  canvas.width = Math.round(logicalWidth * scale);
  canvas.height = Math.round(logicalHeight * scale);
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
