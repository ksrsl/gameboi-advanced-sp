import { createGameContext, safeDelta, smoothToward } from '../../js/render-utils.js?v=3.0.0';

const WIDTH = 320;
const HEIGHT = 240;
const HORIZON = 47;
const TRACK_LENGTH = 1400;
const LAPS = 3;
const FINISH_DISTANCE = TRACK_LENGTH * LAPS;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const RACERS = [
  { name: 'NOVA', color: '#f3f5f6', trim: '#15191d', speed: 86.2 },
  { name: 'VEX', color: '#506f86', trim: '#e7edf0', speed: 84.4 },
  { name: 'BYTE', color: '#b6bec5', trim: '#252b31', speed: 83.2 },
  { name: 'LUX', color: '#252b31', trim: '#e9edf0', speed: 87.1 },
  { name: 'JET', color: '#748693', trim: '#111519', speed: 82.6 }
];
const TRACKS = [
  {
    id: 'night', name: 'NIGHT CIRCUIT',
    skyTop: '#05070b', skyBottom: '#294052', horizon: '#0d151b', ground: '#252b30',
    roadA: '#3b444b', roadB: '#32393f', edgeA: '#f0f3f5', edgeB: '#14191d',
    lightA: '#9be4ff', lightB: '#f5f7f8', curveA: .0047, curveB: .0113, curveScale: 1
  },
  {
    id: 'coast', name: 'SILVER COAST',
    skyTop: '#6f8fa1', skyBottom: '#d6e2e7', horizon: '#566d79', ground: '#35434b',
    roadA: '#59636b', roadB: '#4d565e', edgeA: '#f8f9fa', edgeB: '#6ea5bd',
    lightA: '#ffffff', lightB: '#a9ddf1', curveA: .0058, curveB: .0138, curveScale: .8
  },
  {
    id: 'foundry', name: 'NEON FOUNDRY',
    skyTop: '#100b17', skyBottom: '#4b3c57', horizon: '#211829', ground: '#241f29',
    roadA: '#48404e', roadB: '#3b3541', edgeA: '#e9e4ec', edgeB: '#8f76ae',
    lightA: '#d9c2ff', lightB: '#85dfff', curveA: .0064, curveB: .0151, curveScale: 1.15
  }
];

export default {
  id: 'pixel-kart', title: 'Pixel Kart', version: '1.1.0',
  create() {
    let root, canvas, ctx, services, frame = 0, previousTime = 0;
    let state = 'title', total = 0, speed = 0, raceTime = 0, bestTime = 0;
    let playerOffset = 0, steerVelocity = 0, rivals = [], pickups = [], particles = [];
    let item = '', boostTimer = 0, shieldTimer = 0, pulseTimer = 0, countdown = 0;
    let leftHeld = false, rightHeld = false, brakeHeld = false, driftHeld = false, driftCharge = 0;
    let position = 6, finishPosition = 6, touchPointer = null;
    let trackIndex = 0, bestTimes = {}, bumpTimer = 0, announcementTimer = 0, lastLap = 1;

    const markup = () => `<div class="kart-game">
      <canvas width="640" height="480" aria-label="KSR Pixel Kart circuit"></canvas>
      <div class="kart-hud"><span>LAP <b id="kart-lap">1/3</b></span><span>POS <b id="kart-position">6/6</b></span><span>TIME <b id="kart-time">00:00</b></span></div>
      <div class="kart-speed"><b id="kart-speed">000</b><small id="kart-gear">KM/H</small></div>
      <div class="kart-item" id="kart-item">NO ITEM</div>
      <div class="kart-overlay" id="kart-overlay"><strong>PIXEL KART</strong><small>KSR NIGHT CIRCUIT<br>THREE LAPS - SIX RACERS - ITEM BOXES</small><button data-kart="start">START RACE</button><button data-kart="track">CHANGE TRACK</button><em>LEFT / RIGHT STEER - A ITEM - HOLD B DRIFT</em></div>
      <div class="kart-countdown" id="kart-countdown"></div>
      <div class="kart-pause" id="kart-pause" hidden>PAUSED</div>
      <button class="kart-exit" data-kart="exit" aria-label="Exit game">X</button>
    </div>`;

    function formatTime(seconds) {
      const minutes = Math.floor(seconds / 60); const secs = Math.floor(seconds % 60); const centis = Math.floor((seconds % 1) * 100);
      return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
    }

    function activeTrack() { return TRACKS[trackIndex]; }
    function curveAt(distance) {
      const track = activeTrack();
      return (Math.sin(distance * track.curveA) * 42 + Math.sin(distance * track.curveB) * 17) * track.curveScale;
    }
    function project(distanceAhead, offset = 0) {
      const z = Math.max(7, distanceAhead);
      const y = HORIZON + 1390 / z;
      const half = 970 / z;
      const center = 160 + (curveAt(total + z) - curveAt(total)) * .72;
      return { x: center + offset * half * .76, y, scale: clamp(13 / z, .035, 1.5), half, center };
    }

    function buildPickups() {
      pickups = [];
      for (let lap = 0; lap < LAPS; lap += 1) {
        [210, 555, 925, 1235].forEach((distance, group) => {
          [-.58, 0, .58].forEach((offset, lane) => pickups.push({ type: 'box', total: lap * TRACK_LENGTH + distance + lane * 4, offset, used: false, spin: group + lane }));
        });
        [370, 1080].forEach(distance => pickups.push({ type: 'pad', total: lap * TRACK_LENGTH + distance, offset: distance === 370 ? -.42 : .44, used: false, spin: 0 }));
      }
    }

    function resetRace() {
      total = 0; speed = 0; raceTime = 0; playerOffset = 0; steerVelocity = 0; particles = [];
      item = ''; boostTimer = 0; shieldTimer = 0; pulseTimer = 0; driftCharge = 0; finishPosition = 6;
      bumpTimer = 0; announcementTimer = 0; lastLap = 1;
      rivals = RACERS.map((racer, index) => ({ ...racer, total: 12 + index * 11, offset: [-.55, .42, -.15, .65, .1][index], targetOffset: [-.55, .42, -.15, .65, .1][index], wobble: index * 1.7, boostTimer: 0 }));
      buildPickups(); countdown = 3; updateHud();
    }

    function updateHud() {
      if (!root) return;
      const lap = Math.min(LAPS, Math.floor(total / TRACK_LENGTH) + 1);
      root.querySelector('#kart-lap').textContent = `${lap}/${LAPS}`;
      root.querySelector('#kart-position').textContent = `${position}/6`;
      root.querySelector('#kart-time').textContent = formatTime(raceTime);
      root.querySelector('#kart-speed').textContent = String(Math.round(Math.abs(speed) * 2.35)).padStart(3, '0');
      root.querySelector('#kart-gear').textContent = speed < -1 ? 'REVERSE' : 'KM/H';
      root.querySelector('#kart-item').textContent = item ? item.toUpperCase() : 'NO ITEM';
      root.querySelector('#kart-item').classList.toggle('ready', Boolean(item));
    }

    function showOverlay(title, copy, button) {
      const overlay = root.querySelector('#kart-overlay'); overlay.hidden = false;
      const trackButton = state === 'title' ? '<button data-kart="track">CHANGE TRACK</button>' : '';
      overlay.innerHTML = `<strong>${title}</strong><small>${copy}</small><button data-kart="start">${button}</button>${trackButton}<em>LEFT / RIGHT STEER - A ITEM - HOLD B DRIFT</em>`;
    }

    function renderUi() {
      root.querySelector('#kart-pause').hidden = state !== 'pause';
      if (state === 'title') showOverlay('PIXEL KART', `${activeTrack().name}<br>THREE LAPS - SIX RACERS - BEST ${bestTime ? formatTime(bestTime / 1000) : '--:--'}`, 'START RACE');
      else if (state === 'over') showOverlay(`${finishPosition}${finishPosition === 1 ? 'ST' : finishPosition === 2 ? 'ND' : finishPosition === 3 ? 'RD' : 'TH'} PLACE`, `${formatTime(raceTime)}<br>${finishPosition === 1 ? 'CIRCUIT CHAMPION' : 'RACE THE CIRCUIT AGAIN'}`, 'RACE AGAIN');
      else root.querySelector('#kart-overlay').hidden = true;
      updateHud();
    }

    function start() {
      resetRace(); state = 'play'; services.tone(190, .06, 'square'); renderUi();
    }

    function cycleTrack() {
      if (state !== 'title') return;
      trackIndex = (trackIndex + 1) % TRACKS.length;
      bestTime = bestTimes[activeTrack().id] || 0;
      services.storage.set('pixelKart:track', trackIndex);
      services.tone(520 + trackIndex * 90, .05, 'triangle');
      renderUi();
    }

    function burst(x, y, color, amount = 8) {
      for (let i = 0; i < amount; i += 1) particles.push({ x, y, vx: (Math.random() - .5) * 70, vy: -12 - Math.random() * 48, life: .35 + Math.random() * .35, color, size: 1 + Math.random() * 2 });
    }

    function collect(pickup) {
      pickup.used = true;
      if (pickup.type === 'pad') { boostTimer = Math.max(boostTimer, 1.25); services.tone(680, .06, 'sawtooth'); burst(160, 198, '#9de4ff', 12); return; }
      const roll = Math.random(); item = roll < .5 ? 'turbo' : roll < .78 ? 'shield' : 'pulse';
      services.tone(520, .035, 'triangle'); setTimeout(() => services.tone(780, .045, 'triangle'), 45); updateHud();
    }

    function useItem() {
      if (state !== 'play' || countdown > 0 || !item) { if (state === 'play') services.tone(130, .02); return; }
      if (item === 'turbo') { boostTimer = 2.2; burst(160, 204, '#e9fbff', 18); services.tone(820, .09, 'sawtooth'); }
      if (item === 'shield') { shieldTimer = 5; services.tone(610, .11, 'sine'); }
      if (item === 'pulse') { pulseTimer = 2.5; rivals.forEach(rival => { if (rival.total > total && rival.total - total < 240) rival.total -= 34; }); services.tone(235, .13, 'square'); burst(160, 179, '#a9dfff', 20); }
      item = ''; updateHud();
    }

    function finish() {
      if (state !== 'play') return;
      finishPosition = position; state = 'over'; speed = 0;
      if (finishPosition === 1 && (!bestTime || raceTime * 1000 < bestTime)) {
        bestTime = Math.round(raceTime * 1000);
        bestTimes[activeTrack().id] = bestTime;
        services.storage.set('pixelKart:bestTimes', bestTimes);
        const overallBest = Object.values(bestTimes).filter(Number.isFinite).reduce((smallest, value) => Math.min(smallest, value), bestTime);
        services.storage.set('pixelKart:bestTime', overallBest);
      }
      services.tone(finishPosition === 1 ? 880 : 470, .14, 'triangle'); renderUi();
    }

    function updateRivals(dt) {
      rivals.forEach((rival, index) => {
        const gap = rival.total - total;
        const rubberBand = clamp((total - rival.total) * .014, -3.1, 9.5);
        const pulsePenalty = pulseTimer > 0 && rival.total > total && rival.total - total < 240 ? 14 : 0;
        rival.boostTimer = Math.max(0, rival.boostTimer - dt);
        if (gap < -28 && Math.random() < dt * .18) rival.boostTimer = 1 + Math.random() * .65;
        const lapPressure = (lastLap - 1) * 1.4 + clamp(total / FINISH_DISTANCE, 0, 1) * 2.2;
        const podiumPressure = position <= 2 ? 2.4 : 0;
        const aiBoost = rival.boostTimer > 0 ? 15 : 0;
        rival.total += Math.max(52, rival.speed + rubberBand + lapPressure + podiumPressure + aiBoost - pulsePenalty) * dt;
        rival.wobble += dt * (.7 + index * .06);
        if (gap > 5 && gap < 78 && Math.abs(rival.offset - playerOffset) < .5) rival.targetOffset = clamp(playerOffset + Math.sin(rival.wobble) * .08, -.78, .78);
        else if (Math.sin(rival.wobble) > .96) rival.targetOffset = clamp((Math.random() - .5) * 1.45, -.78, .78);
        rival.offset = smoothToward(rival.offset, rival.targetOffset, gap > 5 && gap < 78 ? 2.8 : 1.8, dt);
      });
      position = 1 + rivals.filter(rival => rival.total > total).length;
    }

    function collideWithRivals() {
      if (bumpTimer > 0 || speed < 25) return;
      const rival = rivals.find(candidate => Math.abs(candidate.total - total) < 4.5 && Math.abs(candidate.offset - playerOffset) < .2);
      if (!rival) return;
      bumpTimer = .7;
      if (shieldTimer > 0) {
        rival.total -= 16;
        burst(160 + playerOffset * 70, 191, '#b7edff', 14);
        services.tone(690, .06, 'triangle');
      } else {
        speed *= .58;
        playerOffset = clamp(playerOffset + (playerOffset <= rival.offset ? -.16 : .16), -1.04, 1.04);
        burst(160 + playerOffset * 70, 201, '#e5e8ea', 12);
        services.tone(105, .09, 'square');
      }
    }

    function update(dt) {
      particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 70 * dt; p.life -= dt; }); particles = particles.filter(p => p.life > 0);
      if (state !== 'play') return;
      if (countdown > -.55) {
        const previous = Math.ceil(countdown); countdown -= dt;
        const current = Math.ceil(countdown);
        if (current !== previous && previous > 0) services.tone(current <= 0 ? 720 : 260 + current * 55, .06, 'square');
        root.querySelector('#kart-countdown').textContent = countdown <= 0 ? 'GO!' : Math.ceil(countdown);
        if (countdown <= -.55) root.querySelector('#kart-countdown').textContent = '';
        return;
      }
      raceTime += dt;
      boostTimer = Math.max(0, boostTimer - dt); shieldTimer = Math.max(0, shieldTimer - dt); pulseTimer = Math.max(0, pulseTimer - dt);
      bumpTimer = Math.max(0, bumpTimer - dt);
      if (announcementTimer > 0) {
        announcementTimer -= dt;
        if (announcementTimer <= 0) root.querySelector('#kart-countdown').textContent = '';
      }
      const steer = (rightHeld ? 1 : 0) - (leftHeld ? 1 : 0);
      steerVelocity = smoothToward(steerVelocity, steer * (driftHeld ? 1.18 : .8), driftHeld ? 8 : 12, dt);
      playerOffset += steerVelocity * dt;
      if (driftHeld && Math.abs(steer) > 0) driftCharge = clamp(driftCharge + dt, 0, 1.35);
      playerOffset = clamp(playerOffset, -1.04, 1.04);
      const offRoad = Math.abs(playerOffset) > .84;
      let targetSpeed = 84;
      if (brakeHeld) targetSpeed = speed > 4 ? 0 : -22;
      if (offRoad) targetSpeed = targetSpeed < 0 ? -12 : targetSpeed - 24;
      if (boostTimer > 0) targetSpeed += 34;
      speed = smoothToward(speed, targetSpeed, boostTimer > 0 ? 5 : 2.8, dt);
      total = Math.max(0, total + speed * dt);
      updateRivals(dt);
      collideWithRivals();
      const currentLap = Math.min(LAPS, Math.floor(total / TRACK_LENGTH) + 1);
      if (currentLap !== lastLap) {
        lastLap = currentLap;
        announcementTimer = 1.25;
        root.querySelector('#kart-countdown').textContent = currentLap === LAPS ? 'FINAL LAP' : `LAP ${currentLap}`;
        services.tone(currentLap === LAPS ? 860 : 650, .09, 'triangle');
      }
      pickups.forEach(pickup => {
        if (pickup.used) return;
        const gap = pickup.total - total;
        if (gap > -4 && gap < 8 && Math.abs(playerOffset - pickup.offset) < (pickup.type === 'pad' ? .28 : .22)) collect(pickup);
      });
      if (offRoad && Math.random() < dt * 15) burst(160 + playerOffset * 70, 210, '#899098', 1);
      if (total >= FINISH_DISTANCE) finish();
      updateHud();
    }

    function roadCenter(distanceAhead) { return project(distanceAhead).center; }
    function drawTrack() {
      const track = activeTrack();
      const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 20); sky.addColorStop(0, track.skyTop); sky.addColorStop(1, track.skyBottom); ctx.fillStyle = sky; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#dce5ea'; for (let i = 0; i < 22; i += 1) { const x = (i * 41 + 13) % WIDTH; const y = 11 + (i * 17) % 31; ctx.globalAlpha = .25 + (i % 3) * .18; ctx.fillRect(x, y, 1, 1); } ctx.globalAlpha = 1;
      ctx.fillStyle = track.horizon; for (let x = -5, i = 0; x < 330; i += 1) { const w = 12 + (i * 7) % 15; const h = 7 + (i * 11) % 20; ctx.fillRect(x, HORIZON - h, w, h); if (i % 3 === 0) { ctx.fillStyle = track.lightA + '55'; ctx.fillRect(x + 3, HORIZON - h + 4, 2, 3); ctx.fillStyle = track.horizon; } x += w - 1; }
      ctx.fillStyle = track.ground; ctx.fillRect(0, HORIZON, WIDTH, HEIGHT - HORIZON);
      for (let far = 420; far > 8; far -= 7) {
        const near = far - 7; const a = project(far), b = project(near);
        const band = Math.floor((total + near) / 28) % 2;
        ctx.fillStyle = band ? track.roadA : track.roadB;
        ctx.beginPath(); ctx.moveTo(a.center - a.half, a.y); ctx.lineTo(a.center + a.half, a.y); ctx.lineTo(b.center + b.half, b.y); ctx.lineTo(b.center - b.half, b.y); ctx.fill();
        ctx.fillStyle = band ? track.edgeA : track.edgeB;
        const edgeA = Math.max(1, a.half * .08), edgeB = Math.max(1, b.half * .08);
        ctx.beginPath(); ctx.moveTo(a.center - a.half, a.y); ctx.lineTo(a.center - a.half + edgeA, a.y); ctx.lineTo(b.center - b.half + edgeB, b.y); ctx.lineTo(b.center - b.half, b.y); ctx.fill();
        ctx.beginPath(); ctx.moveTo(a.center + a.half - edgeA, a.y); ctx.lineTo(a.center + a.half, a.y); ctx.lineTo(b.center + b.half, b.y); ctx.lineTo(b.center + b.half - edgeB, b.y); ctx.fill();
      }
      const firstMarker = Math.floor((total + 12) / 42) * 42;
      for (let marker = firstMarker; marker < total + 420; marker += 42) {
        const z1 = marker - total, z2 = z1 + 18; if (z1 < 8 || z2 > 420) continue;
        const a = project(z2), b = project(z1); ctx.fillStyle = track.edgeA;
        const wa = Math.max(.5, a.half * .018), wb = Math.max(.7, b.half * .018);
        ctx.beginPath(); ctx.moveTo(a.center - wa, a.y); ctx.lineTo(a.center + wa, a.y); ctx.lineTo(b.center + wb, b.y); ctx.lineTo(b.center - wb, b.y); ctx.fill();
      }
      const finishStart = Math.ceil(total / TRACK_LENGTH) * TRACK_LENGTH; const finishGap = finishStart - total;
      if (finishGap > 8 && finishGap < 420) {
        const a = project(finishGap + 8), b = project(finishGap); const cells = 10;
        for (let i = 0; i < cells; i += 1) { const xa = a.center - a.half + a.half * 2 * i / cells; const xb = b.center - b.half + b.half * 2 * i / cells; const xa2 = a.center - a.half + a.half * 2 * (i + 1) / cells; const xb2 = b.center - b.half + b.half * 2 * (i + 1) / cells; ctx.fillStyle = i % 2 ? '#080a0c' : '#f4f6f7'; ctx.beginPath(); ctx.moveTo(xa, a.y); ctx.lineTo(xa2, a.y); ctx.lineTo(xb2, b.y); ctx.lineTo(xb, b.y); ctx.fill(); }
      }

      const speedRush = clamp((Math.abs(speed) - 58) / 55, 0, 1);
      if (state === 'play' && countdown <= 0 && speedRush > 0) {
        ctx.strokeStyle = track.lightA;
        ctx.lineWidth = .65;
        ctx.globalAlpha = .08 + speedRush * .18;
        for (let index = 0; index < 12; index += 1) {
          const lane = ((index * 37) % 100) / 100 * 1.8 - .9;
          const phase = (total * 2.8 + index * 31) % 165;
          const far = 175 - phase;
          if (far < 10) continue;
          const a = project(far + 18, lane);
          const b = project(far, lane);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    function drawPickup(pickup) {
      const gap = pickup.total - total; if (pickup.used || gap < 8 || gap > 420) return;
      const p = project(gap, pickup.offset); const size = clamp(9 * p.scale, 1.5, 11);
      if (pickup.type === 'pad') { ctx.fillStyle = '#82dfff'; ctx.globalAlpha = .8; ctx.beginPath(); ctx.ellipse(p.x, p.y, size * 1.8, size * .45, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; return; }
      ctx.save(); ctx.translate(p.x, p.y - size); ctx.rotate(performance.now() * .0018 + pickup.spin); ctx.fillStyle = '#d8f4ff'; ctx.strokeStyle = '#537f96'; ctx.lineWidth = Math.max(.5, size * .13); ctx.fillRect(-size, -size, size * 2, size * 2); ctx.strokeRect(-size, -size, size * 2, size * 2); ctx.fillStyle = '#203b4a'; ctx.font = `${Math.max(3, size * 1.25)}px monospace`; ctx.textAlign = 'center'; ctx.fillText('?', 0, size * .45); ctx.restore();
    }

    function drawRoadside() {
      const firstPost = Math.floor((total + 24) / 64) * 64;
      for (let marker = firstPost; marker < total + 400; marker += 64) {
        const gap = marker - total;
        if (gap < 14) continue;
        [-1, 1].forEach(side => {
          const p = project(gap, side * 1.18);
          const height = clamp(19 * p.scale, 1.5, 16);
          const width = clamp(2.2 * p.scale, .6, 2.4);
          ctx.fillStyle = '#0a0d10';
          ctx.fillRect(p.x - width / 2, p.y - height, width, height);
          const track = activeTrack();
          ctx.fillStyle = marker % 128 ? track.lightA : track.lightB;
          ctx.globalAlpha = .85;
          ctx.beginPath();
          ctx.arc(p.x, p.y - height, clamp(3.2 * p.scale, .7, 3), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      }
    }

    function drawKart(x, y, scale, body, trim, tilt = 0, player = false) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(scale, scale);
      ctx.fillStyle = '#04050688'; ctx.beginPath(); ctx.ellipse(0, 5, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#080a0c'; ctx.fillRect(-17, -1, 6, 10); ctx.fillRect(11, -1, 6, 10);
      ctx.fillStyle = trim; ctx.fillRect(-16, -8, 32, 3); ctx.fillRect(-13, -11, 3, 5); ctx.fillRect(10, -11, 3, 5);
      ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-13, -10); ctx.lineTo(13, -10); ctx.lineTo(16, 4); ctx.quadraticCurveTo(0, 10, -16, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = trim; ctx.fillRect(-10, -2, 20, 5); ctx.fillRect(-7, -13, 14, 7);
      ctx.fillStyle = '#f5fbff'; ctx.globalAlpha = .75; ctx.fillRect(-11, 4, 4, 2); ctx.fillRect(7, 4, 4, 2); ctx.globalAlpha = 1;
      ctx.fillStyle = player ? '#f8fafb' : '#cbd3d8'; ctx.beginPath(); ctx.arc(0, -15, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#26323a'; ctx.fillRect(-4, -17, 8, 3);
      ctx.fillStyle = '#cfd7dc'; ctx.fillRect(-13, 7, 8, 2); ctx.fillRect(5, 7, 8, 2); ctx.restore();
    }

    function drawObjects() {
      drawRoadside();
      pickups.slice().sort((a, b) => b.total - a.total).forEach(drawPickup);
      rivals.slice().sort((a, b) => b.total - a.total).forEach(rival => {
        const gap = rival.total - total; if (gap < 8 || gap > 420) return; const p = project(gap, rival.offset);
        const kartScale = clamp(p.scale * 1.05, .12, .95);
        drawKart(p.x, p.y, kartScale, rival.color, rival.trim, Math.sin(rival.wobble) * .04);
        if (kartScale > .32) {
          ctx.fillStyle = '#050709bb';
          ctx.fillRect(p.x - 13, p.y - 29 * kartScale, 26, 6);
          ctx.fillStyle = '#f4f7f8';
          ctx.font = '4px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(rival.name, p.x, p.y - 24.5 * kartScale);
        }
      });
    }

    function drawPlayer() {
      if (boostTimer > 0) { ctx.fillStyle = '#9ce8ff'; ctx.globalAlpha = .55 + Math.random() * .4; ctx.beginPath(); ctx.moveTo(151, 212); ctx.lineTo(157, 226 + Math.random() * 8); ctx.lineTo(162, 212); ctx.fill(); ctx.beginPath(); ctx.moveTo(164, 212); ctx.lineTo(169, 226 + Math.random() * 8); ctx.lineTo(173, 212); ctx.fill(); ctx.globalAlpha = 1; }
      const x = 160 + playerOffset * 91; drawKart(x, 205, 1, '#f4f6f7', '#12161a', steerVelocity * .13, true);
      if (shieldTimer > 0) { ctx.strokeStyle = '#a9e8ff'; ctx.lineWidth = 1.5; ctx.globalAlpha = .45 + Math.sin(performance.now() * .01) * .2; ctx.beginPath(); ctx.ellipse(x, 197, 23, 24, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
      if (driftHeld && driftCharge > .25) { ctx.fillStyle = driftCharge > .9 ? '#e9faff' : '#80bcd8'; ctx.fillRect(x - 18, 211, 3, 3); ctx.fillRect(x + 15, 211, 3, 3); }
    }

    function draw() {
      drawTrack(); drawObjects(); drawPlayer();
      particles.forEach(p => { ctx.globalAlpha = clamp(p.life * 2, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }); ctx.globalAlpha = 1;
      if (pulseTimer > 0) { ctx.strokeStyle = '#b8ecff'; ctx.globalAlpha = pulseTimer / 2.5; ctx.beginPath(); ctx.ellipse(160, 188, 42 + (2.5 - pulseTimer) * 50, 16 + (2.5 - pulseTimer) * 20, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    }

    function releaseDrift() {
      if (driftHeld && driftCharge > .38 && state === 'play') { boostTimer = Math.max(boostTimer, .55 + driftCharge * .55); services.tone(560 + driftCharge * 150, .055, 'sawtooth'); burst(160 + playerOffset * 70, 211, '#bcefff', 10); }
      driftHeld = false; driftCharge = 0;
    }

    function loop(time) { const dt = safeDelta(time, previousTime, .034); previousTime = time; update(dt); draw(); frame = requestAnimationFrame(loop); }

    return {
      async mount(host, providedServices) {
        services = providedServices;
        bestTimes = services.storage.get('pixelKart:bestTimes', {});
        trackIndex = clamp(services.storage.get('pixelKart:track', 0), 0, TRACKS.length - 1);
        const legacyBest = services.storage.get('pixelKart:bestTime', 0);
        if (legacyBest && !bestTimes.night) bestTimes.night = legacyBest;
        bestTime = bestTimes[activeTrack().id] || 0;
        host.innerHTML = markup(); root = host.firstElementChild;
        canvas = root.querySelector('canvas'); ctx = createGameContext(canvas, WIDTH, HEIGHT); resetRace(); state = 'title'; renderUi(); previousTime = performance.now(); frame = requestAnimationFrame(loop);
        root.addEventListener('click', event => { const action = event.target.closest?.('[data-kart]')?.dataset.kart; if (action === 'start') start(); if (action === 'track') cycleTrack(); if (action === 'exit') services.exit(); });
        canvas.addEventListener('pointerdown', event => { const rect = canvas.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width; touchPointer = event.pointerId; canvas.setPointerCapture?.(event.pointerId); if (x < .36) leftHeld = true; else if (x > .64) rightHeld = true; else useItem(); });
        canvas.addEventListener('pointerup', event => { if (touchPointer !== event.pointerId) return; leftHeld = false; rightHeld = false; touchPointer = null; });
        canvas.addEventListener('pointercancel', () => { leftHeld = false; rightHeld = false; touchPointer = null; });
      },
      input(key, down) {
        if (key === 'left') leftHeld = down; if (key === 'right') rightHeld = down; if (key === 'down') brakeHeld = down;
        if (key === 'b' && state === 'title') { if (down) cycleTrack(); return; }
        if (key === 'b') { if (down) driftHeld = true; else releaseDrift(); }
        if (!down) return;
        if ((key === 'a' || key === 'start') && (state === 'title' || state === 'over')) start();
        else if (key === 'start') { state = state === 'pause' ? 'play' : 'pause'; renderUi(); }
        else if (state === 'play') { if (key === 'left') playerOffset -= .1; if (key === 'right') playerOffset += .1; if (key === 'a') useItem(); }
        if (key === 'select') services.exit();
      },
      setAuthority() {}, unmount() { cancelAnimationFrame(frame); }
    };
  }
};
