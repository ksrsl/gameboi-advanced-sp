const WIDTH = 320;
const HEIGHT = 240;
const FISH = [
  { id: 'perch', name: 'PIXEL PERCH', rarity: 1, weight: 34, min: 8, max: 22, color: '#ffd66b' },
  { id: 'koi', name: 'NEON KOI', rarity: 1, weight: 25, min: 12, max: 29, color: '#ff8b68' },
  { id: 'bass', name: 'BYTE BASS', rarity: 2, weight: 17, min: 18, max: 42, color: '#77e3aa' },
  { id: 'carp', name: 'CIRCUIT CARP', rarity: 2, weight: 11, min: 22, max: 49, color: '#6fc9ff' },
  { id: 'eel', name: 'MOON EEL', rarity: 3, weight: 7, min: 30, max: 61, color: '#b79aff' },
  { id: 'ray', name: 'GLITCH RAY', rarity: 4, weight: 3.5, min: 40, max: 78, color: '#ff82bd' },
  { id: 'tuna', name: 'CROWN TUNA', rarity: 4, weight: 1.8, min: 55, max: 96, color: '#77f1e5' },
  { id: 'leviathan', name: 'KSR LEVIATHAN', rarity: 5, weight: 0.45, min: 90, max: 160, color: '#fff176' }
];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function freshSave() {
  return { coins: 0, total: 0, bestSize: 0, rarest: 0, album: {} };
}

export default {
  id: 'fishing-byte',
  title: 'Fishing Byte',
  version: '1.0.0',
  create() {
    let root;
    let canvas;
    let ctx;
    let services;
    let frame = 0;
    let previousTime = 0;
    let state = 'intro';
    let resumeState = 'idle';
    let saveData;
    let message = 'THE LAKE IS CALM.';
    let power = 0;
    let powerDirection = 1;
    let castPower = 0;
    let waitTimer = 0;
    let biteTimer = 0;
    let lineX = 205;
    let hookedFish = null;
    let fishSize = 0;
    let fishPos = 0.5;
    let fishVelocity = 0.2;
    let barPos = 0.5;
    let progress = 0;
    let tension = 0;
    let reelTime = 0;
    let reelHeld = false;
    let upHeld = false;
    let downHeld = false;

    const markup = () => `
      <div class="fish-game">
        <canvas width="320" height="240" aria-label="Fishing Byte lake"></canvas>
        <div class="fish-hud">
          <span>CAUGHT <b id="fish-total">000</b></span>
          <span>COINS <b id="fish-coins">000</b></span>
          <span>BEST <b id="fish-best">000</b>CM</span>
        </div>
        <div class="fish-message" id="fish-message">THE LAKE IS CALM.</div>
        <button class="fish-action" id="fish-action" data-fish="action">A CAST</button>
        <div class="fish-overlay" id="fish-overlay">
          <strong>FISHING BYTE</strong>
          <small>CAST • HOOK • REEL<br>COLLECT ALL 8 SPECIES</small>
          <button data-fish="start">VISIT THE LAKE</button>
          <em>A ACTION • B ALBUM</em>
        </div>
        <div class="fish-pause" id="fish-pause" hidden>PAUSED</div>
        <button class="fish-exit" data-fish="exit" aria-label="Exit game">×</button>
      </div>`;

    function save() {
      services.storage.set('fishingByte:save', saveData);
      services.storage.set('fishingByte:bestSize', saveData.bestSize);
      services.storage.set('fishingByte:species', Object.keys(saveData.album).length);
    }

    function updateHud() {
      root.querySelector('#fish-total').textContent = String(saveData.total).padStart(3, '0');
      root.querySelector('#fish-coins').textContent = String(saveData.coins).padStart(3, '0');
      root.querySelector('#fish-best').textContent = String(Math.floor(saveData.bestSize)).padStart(3, '0');
      root.querySelector('#fish-message').textContent = message;
      const labels = { idle: 'A CAST', cast: 'A SET POWER', waiting: 'A PULL LINE', bite: 'A HOOK!', reel: 'HOLD A REEL', result: 'A CAST AGAIN', escaped: 'A TRY AGAIN' };
      root.querySelector('#fish-action').textContent = labels[state] || 'A ACTION';
      root.querySelector('#fish-action').hidden = ['intro', 'album', 'pause'].includes(state);
    }

    function showOverlay(title, copy, button, hint) {
      const overlay = root.querySelector('#fish-overlay');
      overlay.hidden = false;
      overlay.innerHTML = `<strong>${title}</strong><small>${copy}</small><button data-fish="start">${button}</button><em>${hint}</em>`;
    }

    function albumCopy() {
      const caught = Object.keys(saveData.album).length;
      const rarest = FISH.find(item => item.rarity === saveData.rarest)?.name || 'NONE YET';
      const recent = FISH.filter(item => saveData.album[item.id]).slice(-3).map(item => `${item.name} x${saveData.album[item.id].count}`).join('<br>') || 'NO FISH CAUGHT YET';
      return `${caught}/8 SPECIES • RAREST ${rarest}<br>${recent}`;
    }

    function renderUi() {
      updateHud();
      root.querySelector('#fish-pause').hidden = state !== 'pause';
      if (state === 'intro') showOverlay('FISHING BYTE', `${Object.keys(saveData.album).length}/8 SPECIES FOUND<br>THE LAKE REMEMBERS YOU`, 'VISIT THE LAKE', 'A ACTION • B ALBUM');
      else if (state === 'album') showOverlay('FISH ALBUM', albumCopy(), 'BACK TO LAKE', 'A / B / START');
      else if (state === 'result') {
        const stars = '★'.repeat(hookedFish.rarity) + '☆'.repeat(5 - hookedFish.rarity);
        showOverlay('FISH CAUGHT!', `${hookedFish.name} • ${Math.round(fishSize)} CM<br>${stars} • +${hookedFish.rarity * 4 + Math.floor(fishSize / 12)} COINS`, 'CAST AGAIN', 'A / START');
      } else if (state === 'escaped') showOverlay('LINE SLIPPED!', `${hookedFish?.name || 'THE FISH'} ESCAPED<br>KEEP THE MARKERS TOGETHER`, 'TRY AGAIN', 'A / START');
      else root.querySelector('#fish-overlay').hidden = true;
    }

    function enterLake() {
      state = 'idle';
      message = 'PRESS A TO START YOUR CAST.';
      renderUi();
      services.tone(540, 0.07);
    }

    function beginCast() {
      state = 'cast';
      power = 0;
      powerDirection = 1;
      message = 'PRESS A AGAIN TO SET CAST POWER.';
      services.tone(360, 0.04);
      renderUi();
    }

    function setCast() {
      castPower = power;
      lineX = 115 + castPower * 1.65;
      waitTimer = 1.1 + Math.random() * 2.6 - castPower * 0.004;
      state = 'waiting';
      message = 'WAIT FOR THE BITE...';
      services.tone(480, 0.06);
      renderUi();
    }

    function chooseFish() {
      const adjusted = FISH.map(item => ({ ...item, adjusted: item.weight * (1 + (item.rarity - 1) * castPower / 145) }));
      let roll = Math.random() * adjusted.reduce((sum, item) => sum + item.adjusted, 0);
      return adjusted.find(item => { roll -= item.adjusted; return roll <= 0; }) || adjusted[0];
    }

    function startBite() {
      state = 'bite';
      biteTimer = 0.9;
      message = 'BITE! PRESS A NOW!';
      services.tone(920, 0.1);
      renderUi();
    }

    function hookFish() {
      hookedFish = chooseFish();
      fishSize = hookedFish.min + Math.random() * (hookedFish.max - hookedFish.min);
      fishPos = 0.25 + Math.random() * 0.5;
      fishVelocity = (Math.random() - 0.5) * 0.7;
      barPos = 0.5;
      progress = 0.18;
      tension = 0;
      reelTime = 0;
      state = 'reel';
      message = `${hookedFish.name}! TRACK IT WITH ▲ ▼`;
      services.tone(690, 0.08);
      renderUi();
    }

    function catchFish() {
      state = 'result';
      const reward = hookedFish.rarity * 4 + Math.floor(fishSize / 12);
      saveData.coins += reward;
      saveData.total += 1;
      saveData.bestSize = Math.max(saveData.bestSize, fishSize);
      saveData.rarest = Math.max(saveData.rarest, hookedFish.rarity);
      const record = saveData.album[hookedFish.id] || { count: 0, best: 0 };
      record.count += 1;
      record.best = Math.max(record.best, fishSize);
      saveData.album[hookedFish.id] = record;
      save();
      services.tone(780, 0.1);
      setTimeout(() => services.tone(1040, 0.12), 110);
      renderUi();
    }

    function escapeFish() {
      state = 'escaped';
      reelHeld = false;
      services.tone(120, 0.2, 'sawtooth');
      renderUi();
    }

    function action() {
      if (state === 'intro') enterLake();
      else if (state === 'idle') beginCast();
      else if (state === 'cast') setCast();
      else if (state === 'waiting') {
        state = 'idle';
        message = 'TOO EARLY! THE WATER SETTLES.';
        services.tone(120, 0.07);
        renderUi();
      } else if (state === 'bite') hookFish();
      else if (state === 'result' || state === 'escaped') enterLake();
      else if (state === 'album') enterLake();
    }

    function toggleAlbum() {
      if (state === 'album') enterLake();
      else if (state === 'idle' || state === 'intro') { state = 'album'; renderUi(); services.tone(330, 0.04); }
    }

    function pause() {
      if (state === 'pause') { state = resumeState; renderUi(); return; }
      if (['cast', 'waiting', 'bite', 'reel'].includes(state)) {
        resumeState = state;
        state = 'pause';
        renderUi();
        services.tone(300, 0.04);
      } else if (state === 'intro' || state === 'result' || state === 'escaped') action();
      else if (state === 'idle') toggleAlbum();
    }

    function update(dt) {
      if (state === 'cast') {
        power += powerDirection * dt * 90;
        if (power >= 100) { power = 100; powerDirection = -1; }
        if (power <= 0) { power = 0; powerDirection = 1; }
      }
      if (state === 'waiting') {
        waitTimer -= dt;
        if (waitTimer <= 0) startBite();
      }
      if (state === 'bite') {
        biteTimer -= dt;
        if (biteTimer <= 0) escapeFish();
      }
      if (state !== 'reel') return;

      reelTime += dt;
      fishVelocity += (Math.random() - 0.5) * dt * (0.9 + hookedFish.rarity * 0.22);
      fishVelocity = clamp(fishVelocity, -0.8 - hookedFish.rarity * 0.08, 0.8 + hookedFish.rarity * 0.08);
      fishPos += fishVelocity * dt;
      if (fishPos < 0.05 || fishPos > 0.95) { fishPos = clamp(fishPos, 0.05, 0.95); fishVelocity *= -0.8; }

      const manual = Number(downHeld) - Number(upHeld);
      barPos = clamp(barPos + manual * dt * 0.75, 0.05, 0.95);
      if (reelHeld) barPos += (fishPos - barPos) * Math.min(1, dt * 1.7);
      const difference = Math.abs(fishPos - barPos);
      const difficulty = 0.7 + hookedFish.rarity * 0.18;
      if (difference < 0.17) progress += dt * (0.25 / difficulty);
      else progress -= dt * (0.11 + difficulty * 0.035);
      progress = clamp(progress, 0, 1);
      tension += reelHeld ? dt * (0.05 + hookedFish.rarity * 0.012) : -dt * 0.12;
      if (difference > 0.4) tension += dt * 0.16;
      tension = clamp(tension, 0, 1);
      if (progress >= 1) catchFish();
      else if (tension >= 1 || reelTime > 24 - hookedFish.rarity * 1.5 || progress <= 0 && reelTime > 3) escapeFish();
    }

    function drawLake(time) {
      ctx.fillStyle = '#78c8df';
      ctx.fillRect(0, 0, WIDTH, 106);
      ctx.fillStyle = '#fff0a0';
      ctx.fillRect(264, 36, 16, 16);
      ctx.fillStyle = '#6fb36d';
      ctx.fillRect(0, 88, WIDTH, 34);
      for (let x = 0; x < WIDTH; x += 38) ctx.fillRect(x, 78 + (x % 76 ? 4 : 0), 31, 40);
      ctx.fillStyle = '#3f9eb7';
      ctx.fillRect(0, 112, WIDTH, 128);
      ctx.fillStyle = '#7ed1df';
      for (let row = 0; row < 5; row += 1) {
        const offset = (time / (32 + row * 8)) % 34;
        for (let x = -20; x < WIDTH; x += 34) ctx.fillRect(x + offset, 125 + row * 21, 20, 2);
      }
      ctx.fillStyle = '#815f43';
      ctx.fillRect(17, 151, 84, 8);
      ctx.fillRect(29, 159, 7, 54);
      ctx.fillRect(85, 159, 7, 54);

      ctx.fillStyle = '#f1d3a0';
      ctx.fillRect(48, 118, 12, 27);
      ctx.fillStyle = '#e96f79';
      ctx.fillRect(45, 113, 18, 8);
      ctx.fillStyle = '#2d5260';
      ctx.fillRect(46, 143, 5, 14);
      ctx.fillRect(57, 143, 5, 14);
      ctx.strokeStyle = '#453a31';
      ctx.beginPath();
      ctx.moveTo(58, 128);
      ctx.lineTo(117, 81);
      ctx.stroke();
      ctx.strokeStyle = '#ecf8f7';
      ctx.beginPath();
      ctx.moveTo(117, 81);
      ctx.lineTo(lineX, state === 'idle' || state === 'intro' ? 113 : 151);
      ctx.stroke();
    }

    function drawMiniFish(x, y, fish, scale = 1) {
      ctx.fillStyle = fish.color;
      ctx.fillRect(x - 8 * scale, y - 4 * scale, 14 * scale, 8 * scale);
      ctx.fillRect(x + 5 * scale, y - 2 * scale, 5 * scale, 4 * scale);
      ctx.fillStyle = '#174355';
      ctx.fillRect(x - 5 * scale, y - 2 * scale, 2 * scale, 2 * scale);
    }

    function drawMeters() {
      if (state === 'cast') {
        ctx.fillStyle = '#174355';
        ctx.fillRect(87, 199, 146, 16);
        ctx.fillStyle = power > 82 ? '#fff176' : '#79f0c3';
        ctx.fillRect(90, 202, power * 1.4, 10);
        ctx.fillStyle = '#fff';
        ctx.font = '7px Courier New';
        ctx.fillText('CAST POWER', 130, 196);
      }
      if (state === 'bite') {
        ctx.fillStyle = '#fff176';
        ctx.font = 'bold 20px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('!', lineX, 143);
        ctx.textAlign = 'left';
      }
      if (state === 'reel') {
        const top = 62;
        const height = 139;
        ctx.fillStyle = '#174355dd';
        ctx.fillRect(256, top - 6, 56, height + 19);
        ctx.fillStyle = '#d8f8ff';
        ctx.fillRect(265, top, 13, height);
        const fy = top + fishPos * height;
        const by = top + barPos * height;
        ctx.fillStyle = '#79f0c3';
        ctx.fillRect(264, by - 12, 15, 24);
        drawMiniFish(271, fy, hookedFish, 0.65);
        ctx.fillStyle = '#173c46';
        ctx.fillRect(286, top, 7, height);
        ctx.fillStyle = '#fff176';
        ctx.fillRect(286, top + height * (1 - progress), 7, height * progress);
        ctx.fillStyle = '#173c46';
        ctx.fillRect(300, top, 7, height);
        ctx.fillStyle = tension > 0.7 ? '#ff6e7f' : '#ffae65';
        ctx.fillRect(300, top + height * (1 - tension), 7, height * tension);
        ctx.fillStyle = '#fff';
        ctx.font = '6px Courier New';
        ctx.fillText('C', 286, 57);
        ctx.fillText('T', 301, 57);
      }
    }

    function draw(time) {
      drawLake(time);
      if (state === 'waiting' || state === 'bite') {
        ctx.fillStyle = '#fff176';
        ctx.fillRect(lineX - 3, 148, 6, 5);
      }
      if (state === 'result' && hookedFish) drawMiniFish(160, 142, hookedFish, 2);
      drawMeters();
    }

    function loop(time) {
      const dt = Math.min(0.034, (time - previousTime) / 1000 || 0);
      previousTime = time;
      update(dt);
      draw(time);
      frame = requestAnimationFrame(loop);
    }

    return {
      async mount(host, providedServices) {
        services = providedServices;
        saveData = { ...freshSave(), ...services.storage.get('fishingByte:save', {}) };
        saveData.album ||= {};
        host.innerHTML = markup();
        root = host.firstElementChild;
        canvas = root.querySelector('canvas');
        ctx = canvas.getContext('2d');
        state = 'intro';
        renderUi();
        previousTime = performance.now();
        frame = requestAnimationFrame(loop);
        root.addEventListener('click', event => {
          const command = event.target.closest?.('[data-fish]')?.dataset.fish;
          if (command === 'start') action();
          if (command === 'action' && state !== 'reel') action();
          if (command === 'exit') { save(); services.exit(); }
        });
        const actionButton = root.querySelector('#fish-action');
        actionButton.addEventListener('pointerdown', () => { if (state === 'reel') reelHeld = true; });
        actionButton.addEventListener('pointerup', () => { reelHeld = false; });
        actionButton.addEventListener('pointercancel', () => { reelHeld = false; });
        canvas.addEventListener('pointerdown', () => { if (state !== 'reel') action(); else reelHeld = true; });
        canvas.addEventListener('pointerup', () => { reelHeld = false; });
        canvas.addEventListener('pointercancel', () => { reelHeld = false; });
      },
      input(key, down) {
        if (key === 'up') { upHeld = down; return; }
        if (key === 'down') { downHeld = down; return; }
        if (key === 'a') {
          if (state === 'reel') reelHeld = down;
          else if (down) action();
          return;
        }
        if (!down) return;
        if (key === 'b') toggleAlbum();
        if (key === 'start') pause();
        if (key === 'select') { save(); services.exit(); }
      },
      setAuthority() {},
      unmount() {
        save();
        cancelAnimationFrame(frame);
        reelHeld = false;
        upHeld = false;
        downHeld = false;
      }
    };
  }
};
