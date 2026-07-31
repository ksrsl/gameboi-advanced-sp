import { createGameContext, safeDelta, smoothToward } from '../../js/render-utils.js?v=2.1.0';

const WIDTH = 320;
const HEIGHT = 240;
const COURT = { left: 39, right: 281, top: 34, bottom: 226, net: 126 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default {
  id: 'pocket-tennis', title: 'Pocket Tennis', version: '1.0.0',
  create() {
    let root, canvas, ctx, services, frame = 0, previousTime = 0;
    let state = 'title', playerX = 160, playerTarget = 160, opponentX = 160;
    let ball, playerScore = 0, opponentScore = 0, wins = 0, server = 'player';
    let serveTimer = 0, pointTimer = 0, swingTimer = 0, opponentSwing = 0;
    let message = '', leftHeld = false, rightHeld = false, particles = [];

    const markup = () => `<div class="tennis-game">
      <canvas width="640" height="480" aria-label="KSR Pocket Tennis court"></canvas>
      <div class="tennis-hud"><span>KSR <b id="tennis-player-score">0</b></span><strong id="tennis-status">SET 1</strong><span>CPU <b id="tennis-cpu-score">0</b></span></div>
      <div class="tennis-overlay" id="tennis-overlay"><strong>POCKET TENNIS</strong><small>CENTER COURT CHAMPIONSHIP<br>FIRST TO FIVE POINTS</small><button data-tennis="start">START MATCH</button><em>LEFT / RIGHT MOVE - A SWING - B LOB</em></div>
      <div class="tennis-call" id="tennis-call"></div>
      <div class="tennis-pause" id="tennis-pause" hidden>PAUSED</div>
      <button class="tennis-exit" data-tennis="exit" aria-label="Exit game">X</button>
    </div>`;

    function resetBall() {
      const fromPlayer = server === 'player';
      ball = { x: fromPlayer ? playerX : opponentX, y: fromPlayer ? 197 : 61, z: 7, vx: 0, vy: 0, vz: 0, bounces: 0, last: server, moving: false };
      serveTimer = .8;
      message = fromPlayer ? 'YOUR SERVE' : 'CPU SERVE';
      updateHud();
    }

    function resetMatch() {
      playerScore = 0; opponentScore = 0; server = 'player'; particles = [];
      playerX = playerTarget = opponentX = 160; pointTimer = 0; resetBall();
    }

    function updateHud() {
      if (!root) return;
      root.querySelector('#tennis-player-score').textContent = playerScore;
      root.querySelector('#tennis-cpu-score').textContent = opponentScore;
      root.querySelector('#tennis-status').textContent = wins ? `${wins} WIN${wins === 1 ? '' : 'S'}` : 'SET 1';
      root.querySelector('#tennis-call').textContent = message;
    }

    function showOverlay(title, copy, button) {
      const overlay = root.querySelector('#tennis-overlay');
      overlay.hidden = false;
      overlay.innerHTML = `<strong>${title}</strong><small>${copy}</small><button data-tennis="start">${button}</button><em>LEFT / RIGHT MOVE - A SWING - B LOB</em>`;
    }

    function renderUi() {
      root.querySelector('#tennis-pause').hidden = state !== 'pause';
      if (state === 'title') showOverlay('POCKET TENNIS', 'CENTER COURT CHAMPIONSHIP<br>FIRST TO FIVE POINTS', 'START MATCH');
      else if (state === 'over') showOverlay(playerScore > opponentScore ? 'MATCH WON' : 'MATCH LOST', `${playerScore} - ${opponentScore}<br>${playerScore > opponentScore ? 'KSR CUP SECURED' : 'TAKE THE REMATCH'}`, 'PLAY AGAIN');
      else root.querySelector('#tennis-overlay').hidden = true;
      updateHud();
    }

    function start() {
      resetMatch(); state = 'play'; services.tone(540, .06, 'triangle'); renderUi();
    }

    function launch(from, lob = false) {
      const isPlayer = from === 'player';
      const hitterX = isPlayer ? playerX : opponentX;
      const targetX = isPlayer ? opponentX + (Math.random() - .5) * 75 : playerX + (Math.random() - .5) * 52;
      ball.last = from; ball.moving = true; ball.bounces = 0;
      ball.z = Math.max(ball.z, 7); ball.vz = lob ? 112 : 88;
      ball.vy = isPlayer ? (lob ? -91 : -112) : (lob ? 91 : 108);
      ball.vx = clamp((targetX - hitterX) * .62 + (isPlayer ? (playerTarget - playerX) * 1.4 : 0), -62, 62);
      services.tone(lob ? 410 : 285, .045, 'triangle');
    }

    function serve() {
      if (ball.moving) return;
      launch(server, server === 'opponent' && Math.random() < .25);
      message = '';
    }

    function makeBurst(x, y, color) {
      for (let i = 0; i < 8; i += 1) particles.push({ x, y, vx: (Math.random() - .5) * 50, vy: -15 - Math.random() * 35, life: .45, color });
    }

    function scorePoint(winner) {
      if (pointTimer > 0) return;
      pointTimer = 1.15; ball.moving = false;
      if (winner === 'player') { playerScore += 1; message = 'POINT KSR'; services.tone(720, .08, 'triangle'); makeBurst(160, 113, '#ffffff'); }
      else { opponentScore += 1; message = 'POINT CPU'; services.tone(145, .11, 'square'); }
      server = server === 'player' ? 'opponent' : 'player'; updateHud();
    }

    function swing(lob = false) {
      if (state !== 'play') return;
      swingTimer = .18;
      if (!ball.moving && server === 'player' && serveTimer <= 0) { launch('player', lob); message = ''; return; }
      if (ball.moving && ball.y > 163 && ball.y < 222 && Math.abs(ball.x - playerX) < 33 && ball.z < 30) launch('player', lob);
      else services.tone(185, .018);
    }

    function awardForOut() {
      if (ball.x < COURT.left - 7 || ball.x > COURT.right + 7) scorePoint(ball.last === 'player' ? 'opponent' : 'player');
      else if (ball.y < COURT.top - 10) scorePoint('player');
      else if (ball.y > COURT.bottom + 10) scorePoint('opponent');
    }

    function update(dt) {
      particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 80 * dt; p.life -= dt; });
      particles = particles.filter(p => p.life > 0);
      if (state !== 'play') return;
      if (swingTimer > 0) swingTimer -= dt;
      if (opponentSwing > 0) opponentSwing -= dt;
      if (pointTimer > 0) {
        pointTimer -= dt;
        if (pointTimer <= 0) {
          if (playerScore >= 5 || opponentScore >= 5) {
            if (playerScore > opponentScore) { wins += 1; services.storage.set('pocketTennis:wins', wins); }
            state = 'over'; renderUi();
          } else resetBall();
        }
        return;
      }
      const move = (rightHeld ? 1 : 0) - (leftHeld ? 1 : 0);
      if (move) playerTarget += move * 148 * dt;
      playerTarget = clamp(playerTarget, 55, 265);
      playerX = smoothToward(playerX, playerTarget, 16, dt);
      if (!ball.moving) {
        if (server === 'player') { ball.x = playerX + 10; ball.y = 197; }
        else { ball.x = opponentX - 8; ball.y = 61; }
        serveTimer -= dt;
        if (serveTimer <= 0 && server === 'opponent') serve();
        return;
      }
      const previousY = ball.y;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt; ball.vz -= 174 * dt;
      if ((previousY < COURT.net && ball.y >= COURT.net) || (previousY > COURT.net && ball.y <= COURT.net)) {
        if (ball.z < 12) { ball.vy *= -.35; ball.vx *= .7; ball.z = 2; services.tone(110, .05, 'square'); }
      }
      if (ball.z <= 0) {
        ball.z = 0; ball.vz = 53; ball.vx *= .86; ball.vy *= .82; ball.bounces += 1;
        services.tone(235, .028, 'triangle'); makeBurst(ball.x, ball.y, '#a9d5e8');
        if (ball.bounces >= 2) scorePoint(ball.last === 'player' ? 'player' : 'opponent');
      }
      opponentX = smoothToward(opponentX, clamp(ball.x + Math.sin(performance.now() * .004) * 8, 58, 262), 5.8, dt);
      if (ball.last === 'player' && ball.vy < 0 && ball.y < 91 && ball.y > 42 && Math.abs(ball.x - opponentX) < 35 && ball.z < 30 && opponentSwing <= 0) {
        opponentSwing = .2; launch('opponent', Math.random() < .22);
      }
      awardForOut();
    }

    function drawCourt() {
      const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT); bg.addColorStop(0, '#10151b'); bg.addColorStop(1, '#050709'); ctx.fillStyle = bg; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#202830'; ctx.fillRect(24, 27, 272, 205);
      const court = ctx.createLinearGradient(0, COURT.top, 0, COURT.bottom); court.addColorStop(0, '#416f88'); court.addColorStop(.5, '#315d75'); court.addColorStop(1, '#244657'); ctx.fillStyle = court; ctx.fillRect(COURT.left, COURT.top, COURT.right - COURT.left, COURT.bottom - COURT.top);
      ctx.fillStyle = '#ffffff07'; for (let y = 36; y < 226; y += 12) ctx.fillRect(40, y, 240, 6);
      ctx.strokeStyle = '#edf4f7'; ctx.lineWidth = 1.35; ctx.strokeRect(COURT.left + .5, COURT.top + .5, COURT.right - COURT.left - 1, COURT.bottom - COURT.top - 1);
      ctx.beginPath(); ctx.moveTo(91, COURT.top); ctx.lineTo(91, COURT.bottom); ctx.moveTo(229, COURT.top); ctx.lineTo(229, COURT.bottom); ctx.moveTo(91, 82); ctx.lineTo(229, 82); ctx.moveTo(91, 174); ctx.lineTo(229, 174); ctx.moveTo(160, 82); ctx.lineTo(160, 174); ctx.stroke();
      ctx.fillStyle = '#dfe8ec'; ctx.fillRect(32, COURT.net - 2, 256, 4); ctx.fillStyle = '#778691'; ctx.fillRect(32, COURT.net + 2, 256, 2);
      for (let x = 36; x < 288; x += 8) { ctx.fillStyle = '#0b0e1188'; ctx.fillRect(x, COURT.net - 1, 1, 4); }
      ctx.fillStyle = '#798690'; for (let x = 17; x < 304; x += 14) { const height = 4 + (x % 5); ctx.beginPath(); ctx.arc(x, 20, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - 3, 22, 6, height); }
    }

    function drawPlayer(x, y, cpu, swinging) {
      ctx.save(); ctx.translate(x, y); if (cpu) ctx.scale(1, -1);
      ctx.fillStyle = '#05070866'; ctx.beginPath(); ctx.ellipse(0, 7, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = cpu ? '#aab7c0' : '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-4, 5); ctx.lineTo(-7, 13); ctx.moveTo(4, 5); ctx.lineTo(8, 13); ctx.stroke();
      ctx.fillStyle = cpu ? '#171d23' : '#f5f7f8'; ctx.beginPath(); ctx.roundRect(-9, -10, 18, 18, 4); ctx.fill();
      ctx.fillStyle = cpu ? '#d4dbe0' : '#11161a'; ctx.beginPath(); ctx.arc(0, -14, 6, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.rotate(swinging > 0 ? -.95 : -.2); ctx.strokeStyle = '#cbd3d8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(7, -3); ctx.lineTo(18, -16); ctx.stroke(); ctx.beginPath(); ctx.ellipse(21, -19, 5, 8, -.55, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); ctx.restore();
    }

    function draw() {
      drawCourt();
      drawPlayer(opponentX, 61, true, opponentSwing); drawPlayer(playerX, 200, false, swingTimer);
      if (ball) {
        ctx.fillStyle = '#02030466'; ctx.beginPath(); ctx.ellipse(ball.x + 2, ball.y + 2, 5, 2.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f7fbff'; ctx.shadowColor = '#d9f5ff'; ctx.shadowBlur = 5; ctx.beginPath(); ctx.arc(ball.x, ball.y - ball.z, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      }
      particles.forEach(p => { ctx.globalAlpha = clamp(p.life * 2, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 2, 2); }); ctx.globalAlpha = 1;
    }

    function loop(time) { const dt = safeDelta(time, previousTime, .034); previousTime = time; update(dt); draw(); frame = requestAnimationFrame(loop); }

    return {
      async mount(host, providedServices) {
        services = providedServices; wins = services.storage.get('pocketTennis:wins', 0); host.innerHTML = markup(); root = host.firstElementChild;
        canvas = root.querySelector('canvas'); ctx = createGameContext(canvas, WIDTH, HEIGHT); resetMatch(); renderUi(); previousTime = performance.now(); frame = requestAnimationFrame(loop);
        root.addEventListener('click', event => { const action = event.target.closest?.('[data-tennis]')?.dataset.tennis; if (action === 'start') start(); if (action === 'exit') services.exit(); });
        canvas.addEventListener('pointerdown', event => { const rect = canvas.getBoundingClientRect(); const x = (event.clientX - rect.left) * WIDTH / rect.width; playerTarget = clamp(x, 55, 265); swing(event.clientY < rect.top + rect.height * .52); });
      },
      input(key, down) {
        if (key === 'left') leftHeld = down; if (key === 'right') rightHeld = down; if (!down) return;
        if ((key === 'a' || key === 'start') && (state === 'title' || state === 'over')) start();
        else if (key === 'start') { state = state === 'pause' ? 'play' : 'pause'; renderUi(); }
        else if (state === 'play') { if (key === 'left') playerTarget -= 15; if (key === 'right') playerTarget += 15; if (key === 'a') swing(false); if (key === 'b') swing(true); }
        if (key === 'select') services.exit();
      },
      setAuthority() {}, unmount() { cancelAnimationFrame(frame); }
    };
  }
};
