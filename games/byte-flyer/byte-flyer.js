import { createGameContext, safeDelta } from '../../js/render-utils.js?v=3.1.0';

const WIDTH = 320;
const HEIGHT = 240;
const GROUND = 218;
const SKINS = [
  { name: 'SUN', body: '#fff176', wing: '#ff9f5a' },
  { name: 'MINT', body: '#8fffd4', wing: '#45cdb4' },
  { name: 'BERRY', body: '#ff85b4', wing: '#a873ff' }
];
const UNLOCKS = [0, 15, 40];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default {
  id: 'byte-flyer',
  title: 'Sky Pulse',
  version: '1.1.0',
  create() {
    let root;
    let canvas;
    let ctx;
    let services;
    let frame = 0;
    let previousTime = 0;
    let lastPublishedAt = 0;
    let simulationTime = 0;
    let localFlapGuardUntil = 0;
    let authority = true;
    let state = 'title';
    let bird;
    let gates = [];
    let spawnTimer = 0;
    let score = 0;
    let high = 0;
    let runCoins = 0;
    let totalCoins = 0;
    let skinIndex = 0;
    let wingTick = 0;
    let scoreNode;
    let coinsNode;
    let highNode;
    let overlayNode;
    let pauseNode;
    let hudSignature = '';
    let overlaySignature = '';
    let uiSignature = '';

    function snapshot() {
      return {
        state,
        bird: bird ? { ...bird } : null,
        gates: gates.map(gate => ({ ...gate })),
        spawnTimer,
        score,
        high,
        runCoins,
        totalCoins,
        skinIndex,
        wingTick,
        simulationTime
      };
    }

    function publish(force = false) {
      if (!authority) return;
      const now = performance.now();
      if (!force && now - lastPublishedAt < 80) return;
      lastPublishedAt = now;
      services.publishState(snapshot());
    }

    const markup = () => `
      <div class="flyer-game">
        <canvas width="320" height="240" aria-label="Sky Pulse game field"></canvas>
        <div class="flyer-hud">
          <span>SCORE <b id="flyer-score">000</b></span>
          <span>COINS <b id="flyer-coins">000</b></span>
          <span>HI <b id="flyer-hi">000</b></span>
        </div>
        <div class="flyer-overlay" id="flyer-overlay">
          <strong>SKY PULSE</strong>
          <small>FLAP THROUGH THE DATA GATES<br>COLLECT MEMORY COINS</small>
          <button data-flyer="start">START FLIGHT</button>
          <em>A / TAP FLAP • B SKIN</em>
        </div>
        <div class="flyer-pause" id="flyer-pause" hidden>PAUSED</div>
        <button class="flyer-exit" data-flyer="exit" aria-label="Exit game">×</button>
      </div>`;

    function save() {
      high = Math.max(high, score);
      services.storage.set('byteFlyer:highScore', high);
      services.storage.set('byteFlyer:coins', totalCoins);
      services.storage.set('byteFlyer:skin', skinIndex);
    }

    function updateHud() {
      const signature = `${score}|${totalCoins}|${high}`;
      if (signature === hudSignature) return;
      hudSignature = signature;
      scoreNode.textContent = String(score).padStart(3, '0');
      coinsNode.textContent = String(totalCoins).padStart(3, '0');
      highNode.textContent = String(high).padStart(3, '0');
    }

    function showOverlay(title, copy, button, hint) {
      const signature = `${title}|${copy}|${button}|${hint}`;
      overlayNode.hidden = false;
      if (signature === overlaySignature) return;
      overlaySignature = signature;
      overlayNode.innerHTML = `<strong>${title}</strong><small>${copy}</small><button data-flyer="start">${button}</button><em>${hint}</em>`;
    }

    function renderUi() {
      updateHud();
      const signature = state === 'title'
        ? `${state}|${totalCoins}|${skinIndex}`
        : state === 'over'
          ? `${state}|${score}|${runCoins}`
          : state;
      if (signature === uiSignature) return;
      uiSignature = signature;
      pauseNode.hidden = state !== 'pause';
      if (state === 'title') {
        const nextUnlock = UNLOCKS.find(value => value > totalCoins);
        const unlockText = nextUnlock ? `NEXT SKIN AT ${nextUnlock} COINS` : 'ALL SKINS UNLOCKED';
        showOverlay('SKY PULSE', `${SKINS[skinIndex].name} GLIDER • ${unlockText}`, 'START FLIGHT', 'A / TAP FLAP • B SKIN');
      } else if (state === 'over') {
        const medal = score >= 25 ? 'PLATINUM' : score >= 15 ? 'GOLD' : score >= 7 ? 'SILVER' : 'BRONZE';
        showOverlay('SIGNAL LOST', `SCORE ${score} • ${medal}<br>COINS FOUND ${runCoins}`, 'FLY AGAIN', 'A / START');
      } else {
        overlayNode.hidden = true;
      }
    }

    function reset() {
      bird = { x: 78, y: 115, vy: 0, rotation: 0 };
      gates = [];
      spawnTimer = 0.45;
      score = 0;
      runCoins = 0;
      wingTick = 0;
      simulationTime = 0;
    }

    function start() {
      reset();
      state = 'play';
      services.tone(620, 0.06);
      flap();
      renderUi();
      publish(true);
    }

    function flap() {
      if (state === 'title' || state === 'over') { start(); return; }
      if (state !== 'play') return;
      bird.vy = -178;
      wingTick = 0.12;
      if (!authority) localFlapGuardUntil = performance.now() + 170;
      services.tone(570, 0.025);
      publish(true);
    }

    function pause() {
      if (state === 'play') state = 'pause';
      else if (state === 'pause') state = 'play';
      else { start(); return; }
      services.tone(300, 0.04);
      renderUi();
      publish(true);
    }

    function cycleSkin() {
      if (state !== 'title') return;
      const unlocked = UNLOCKS.filter(value => value <= totalCoins).length;
      skinIndex = (skinIndex + 1) % unlocked;
      save();
      services.tone(720, 0.05);
      renderUi();
      publish(true);
    }

    function spawnGate() {
      const gap = Math.max(53, 82 - score * 1.15);
      const gapY = 52 + Math.random() * (GROUND - 105 - gap);
      gates.push({ x: WIDTH + 8, gapY, gap, width: 34, passed: false, coin: Math.random() < 0.72, coinTaken: false });
    }

    function hitGate(gate) {
      const bx = bird.x - 6;
      const by = bird.y - 5;
      const inX = bx + 12 > gate.x && bx < gate.x + gate.width;
      if (!inX) return false;
      return by < gate.gapY || by + 10 > gate.gapY + gate.gap;
    }

    function gameOver() {
      if (state !== 'play') return;
      state = 'over';
      save();
      services.tone(105, 0.24, 'sawtooth');
      renderUi();
      publish(true);
    }

    function update(dt) {
      if (state !== 'play') return;
      simulationTime += dt;
      bird.vy += 485 * dt;
      bird.y += bird.vy * dt;
      bird.rotation = clamp(bird.vy / 260, -0.55, 0.9);
      wingTick = Math.max(0, wingTick - dt);
      if (bird.y < 27 || bird.y + 6 >= GROUND) { gameOver(); return; }

      const speed = Math.min(148, 73 + score * 2.1);
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnGate();
        spawnTimer = Math.max(1.12, 1.48 - score * 0.012);
      }

      gates.forEach(gate => {
        gate.x -= speed * dt;
        if (!gate.passed && gate.x + gate.width < bird.x) {
          gate.passed = true;
          score += 1;
          high = Math.max(high, score);
          services.tone(760, 0.035);
          save();
          updateHud();
        }
        if (gate.coin && !gate.coinTaken) {
          const coinX = gate.x + gate.width / 2;
          const coinY = gate.gapY + gate.gap / 2;
          if (Math.abs(bird.x - coinX) < 11 && Math.abs(bird.y - coinY) < 11) {
            gate.coinTaken = true;
            runCoins += 1;
            totalCoins += 1;
            services.tone(960, 0.06);
            save();
            updateHud();
          }
        }
        if (hitGate(gate)) gameOver();
      });
      gates = gates.filter(gate => gate.x + gate.width > -8);
      publish();
    }

    function updateReplica(dt) {
      if (state !== 'play' || !bird) return;
      simulationTime += dt;
      bird.vy += 485 * dt;
      bird.y += bird.vy * dt;
      bird.rotation = clamp(bird.vy / 260, -0.55, 0.9);
      wingTick = Math.max(0, wingTick - dt);
      const speed = Math.min(148, 73 + score * 2.1);
      gates.forEach(gate => { gate.x -= speed * dt; });
    }

    function drawBackground() {
      const night = Math.floor(score / 8) % 2 === 1;
      ctx.fillStyle = night ? '#18244d' : '#76cbd4';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      if (night) {
        ctx.fillStyle = '#ffffff99';
        for (let index = 0; index < 28; index += 1) ctx.fillRect((index * 53 + 17) % WIDTH, 28 + (index * 31) % 135, 1, 1);
        ctx.fillStyle = '#fff3b0';
        ctx.fillRect(260, 39, 14, 14);
        ctx.fillStyle = '#18244d';
        ctx.fillRect(255, 34, 12, 12);
      } else {
        ctx.fillStyle = '#fff2a6';
        ctx.fillRect(258, 37, 18, 18);
        ctx.fillStyle = '#ffffff88';
        ctx.fillRect(25, 62, 37, 8);
        ctx.fillRect(39, 56, 22, 8);
        ctx.fillRect(209, 91, 45, 7);
      }
      ctx.fillStyle = night ? '#202f63' : '#5bb7bf';
      ctx.fillRect(0, 180, WIDTH, 38);
      for (let x = 0; x < WIDTH; x += 30) ctx.fillRect(x, 170 + (x % 60 ? 5 : 0), 22, 48);
      ctx.fillStyle = '#5bbd73';
      ctx.fillRect(0, GROUND, WIDTH, 22);
      ctx.fillStyle = '#9be36f';
      ctx.fillRect(0, GROUND, WIDTH, 5);
    }

    function drawGate(gate) {
      ctx.fillStyle = '#4bd690';
      ctx.fillRect(gate.x, 24, gate.width, gate.gapY - 24);
      ctx.fillRect(gate.x, gate.gapY + gate.gap, gate.width, GROUND - gate.gapY - gate.gap);
      ctx.fillStyle = '#83f2aa';
      ctx.fillRect(gate.x + 3, 24, 4, gate.gapY - 24);
      ctx.fillRect(gate.x + 3, gate.gapY + gate.gap, 4, GROUND - gate.gapY - gate.gap);
      ctx.fillStyle = '#249a67';
      ctx.fillRect(gate.x - 4, gate.gapY - 7, gate.width + 8, 7);
      ctx.fillRect(gate.x - 4, gate.gapY + gate.gap, gate.width + 8, 7);
      if (gate.coin && !gate.coinTaken) {
        const cx = gate.x + gate.width / 2;
        const cy = gate.gapY + gate.gap / 2;
        ctx.fillStyle = '#fff176';
        ctx.fillRect(cx - 5, cy - 6, 10, 12);
        ctx.fillStyle = '#ffb84d';
        ctx.fillRect(cx - 1, cy - 4, 2, 8);
      }
    }

    function drawBird() {
      const skin = SKINS[skinIndex];
      ctx.save();
      ctx.translate(Math.round(bird.x), Math.round(bird.y));
      ctx.rotate(bird.rotation);
      ctx.fillStyle = skin.body;
      ctx.fillRect(-7, -6, 14, 12);
      ctx.fillStyle = skin.wing;
      ctx.fillRect(-10, wingTick > 0 ? -7 : 0, 8, 6);
      ctx.fillStyle = '#fff';
      ctx.fillRect(2, -5, 5, 5);
      ctx.fillStyle = '#173c46';
      ctx.fillRect(5, -4, 2, 2);
      ctx.fillStyle = '#ff9f5a';
      ctx.fillRect(7, 0, 6, 3);
      ctx.restore();
    }

    function draw() {
      drawBackground();
      gates.forEach(drawGate);
      if (bird) drawBird();
    }

    function loop(time) {
      const dt = safeDelta(time, previousTime);
      previousTime = time;
      if (authority) update(dt);
      else updateReplica(dt);
      draw();
      frame = requestAnimationFrame(loop);
    }

    return {
      async mount(host, providedServices) {
        services = providedServices;
        authority = services.isAuthority();
        high = services.storage.get('byteFlyer:highScore', 0);
        totalCoins = services.storage.get('byteFlyer:coins', 0);
        skinIndex = Math.min(services.storage.get('byteFlyer:skin', 0), UNLOCKS.filter(value => value <= totalCoins).length - 1);
        host.innerHTML = markup();
        root = host.firstElementChild;
        canvas = root.querySelector('canvas');
        scoreNode = root.querySelector('#flyer-score');
        coinsNode = root.querySelector('#flyer-coins');
        highNode = root.querySelector('#flyer-hi');
        overlayNode = root.querySelector('#flyer-overlay');
        pauseNode = root.querySelector('#flyer-pause');
        ctx = createGameContext(canvas, WIDTH, HEIGHT);
        reset();
        state = 'title';
        renderUi();
        previousTime = performance.now();
        frame = requestAnimationFrame(loop);
        root.addEventListener('click', event => {
          const action = event.target.closest?.('[data-flyer]')?.dataset.flyer;
          if (action === 'start') start();
          if (action === 'exit') services.exit();
        });
        canvas.addEventListener('pointerdown', event => {
          event.preventDefault();
          services.requestInput('a', true);
          queueMicrotask(() => services.requestInput('a', false));
        });
      },
      input(key, down) {
        if (!down) return;
        if (key === 'a' || key === 'up') flap();
        if (key === 'b') cycleSkin();
        if (key === 'start') pause();
        if (key === 'select') services.exit();
      },
      hydrate(remote) {
        if (!remote) return;
        const nextState = remote.state || 'title';
        const remoteBird = remote.bird ? { ...remote.bird } : null;
        const remoteTime = Number.isFinite(Number(remote.simulationTime)) ? Number(remote.simulationTime) : simulationTime;
        const stateChanged = nextState !== state;
        const remoteGates = Array.isArray(remote.gates) ? remote.gates.map(gate => ({ ...gate })) : [];

        if (stateChanged || nextState !== 'play' || !bird || !remoteBird) {
          state = nextState;
          bird = remoteBird || bird;
          gates = remoteGates;
          simulationTime = remoteTime;
        } else {
          const prediction = clamp(simulationTime - remoteTime, 0, 0.18);
          const predictedVy = remoteBird.vy + 485 * prediction;
          const predictedY = remoteBird.y + remoteBird.vy * prediction + 242.5 * prediction * prediction;
          const positionError = predictedY - bird.y;
          const velocityError = predictedVy - bird.vy;

          if (performance.now() >= localFlapGuardUntil) {
            if (Math.abs(positionError) > 28) bird.y = predictedY;
            else bird.y += positionError * 0.38;
            if (Math.abs(velocityError) > 125) bird.vy = predictedVy;
            else bird.vy += velocityError * 0.46;
            bird.rotation = clamp(bird.vy / 260, -0.55, 0.9);
          }

          const speed = Math.min(148, 73 + (Number(remote.score) || 0) * 2.1);
          const predictedGates = remoteGates.map(gate => ({ ...gate, x: gate.x - speed * prediction }));
          const canBlendGates = gates.length === predictedGates.length
            && gates.every((gate, index) => Math.abs(gate.x - predictedGates[index].x) < 42);
          if (canBlendGates) {
            gates = gates.map((gate, index) => {
              const target = predictedGates[index];
              const error = target.x - gate.x;
              return { ...target, x: Math.abs(error) > 16 ? target.x : gate.x + error * 0.3 };
            });
          } else {
            gates = predictedGates;
          }
          state = nextState;
          simulationTime = Math.max(simulationTime, remoteTime);
        }
        spawnTimer = Number(remote.spawnTimer) || 0;
        score = Number(remote.score) || 0;
        high = Number(remote.high) || 0;
        runCoins = Number(remote.runCoins) || 0;
        totalCoins = Number(remote.totalCoins) || 0;
        skinIndex = Math.max(0, Math.min(SKINS.length - 1, Number(remote.skinIndex) || 0));
        if (performance.now() >= localFlapGuardUntil) wingTick = Number(remote.wingTick) || 0;
        renderUi();
      },
      setAuthority(value) {
        authority = Boolean(value);
        previousTime = performance.now();
        if (authority) publish(true);
      },
      unmount() {
        if (authority) save();
        cancelAnimationFrame(frame);
      }
    };
  }
};
