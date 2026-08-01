import { createGameContext, safeDelta, smoothToward } from '../../js/render-utils.js?v=3.0.0';

const WIDTH = 320;
const HEIGHT = 240;
const HOOP_X = 258;
const HOOP_Y = 79;
const SHOT_SPOTS = [52, 86, 122, 158, 198, 222];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default {
  id: 'street-hoops',
  title: 'Street Hoops',
  version: '2.0.0',
  create() {
    let root;
    let canvas;
    let ctx;
    let services;
    let frame = 0;
    let previousTime = 0;
    let state = 'title';
    let playerX = SHOT_SPOTS[2];
    let targetX = SHOT_SPOTS[2];
    let spotIndex = 2;
    let ball = null;
    let clock = 60;
    let score = 0;
    let high = 0;
    let shots = 0;
    let makes = 0;
    let streak = 0;
    let bestStreak = 0;
    let power = .2;
    let powerDirection = 1;
    let shotCooldown = 0;
    let message = '';
    let messageTimer = 0;
    let netPulse = 0;
    let flash = 0;
    let particles = [];

    const markup = () => `
      <div class="hoops-game">
        <canvas width="640" height="480" aria-label="Street Hoops one minute shooting challenge"></canvas>
        <div class="hoops-hud">
          <span>SCORE <b id="hoops-score">000</b></span>
          <strong id="hoops-clock">01:00</strong>
          <span>HIGH <b id="hoops-high">000</b></span>
        </div>
        <div class="hoops-streak">STREAK <b id="hoops-streak">0</b></div>
        <div class="hoops-message" id="hoops-message"></div>
        <div class="hoops-meter"><i id="hoops-power"></i><b id="hoops-perfect"></b></div>
        <div class="hoops-overlay" id="hoops-overlay">
          <strong>STREET HOOPS</strong>
          <small>ONE MINUTE SCORE ATTACK<br>BREAK THE KSR COURT RECORD</small>
          <button data-hoops="start">START CHALLENGE</button>
          <em>LEFT / RIGHT SPOT - A SHOOT - B NEXT SPOT</em>
        </div>
        <div class="hoops-pause" id="hoops-pause" hidden>PAUSED</div>
        <button class="hoops-exit" data-hoops="exit" aria-label="Exit game">X</button>
      </div>`;

    function formatClock() {
      const total = Math.max(0, Math.ceil(clock));
      return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }

    function idealPower() {
      return clamp(.54 + (HOOP_X - playerX) / 430, .61, .96);
    }

    function shotValue() {
      return playerX <= 122 ? 3 : 2;
    }

    function reset() {
      playerX = targetX = SHOT_SPOTS[2];
      spotIndex = 2;
      ball = null;
      clock = 60;
      score = 0;
      shots = 0;
      makes = 0;
      streak = 0;
      power = .2;
      powerDirection = 1;
      shotCooldown = 0;
      message = 'FIND THE PERFECT RELEASE';
      messageTimer = 1.7;
      netPulse = 0;
      flash = 0;
      particles = [];
    }

    function updateHud() {
      if (!root) return;
      root.querySelector('#hoops-score').textContent = String(score).padStart(3, '0');
      root.querySelector('#hoops-high').textContent = String(high).padStart(3, '0');
      root.querySelector('#hoops-clock').textContent = formatClock();
      root.querySelector('#hoops-streak').textContent = streak;
      root.querySelector('#hoops-message').textContent = message;
      root.querySelector('#hoops-power').style.width = `${power * 100}%`;
      root.querySelector('#hoops-perfect').style.left = `${idealPower() * 100}%`;
    }

    function showOverlay(title, copy, button) {
      const overlay = root.querySelector('#hoops-overlay');
      overlay.hidden = false;
      overlay.innerHTML = `<strong>${title}</strong><small>${copy}</small><button data-hoops="start">${button}</button><em>LEFT / RIGHT SPOT - A SHOOT - B NEXT SPOT</em>`;
    }

    function renderUi() {
      root.querySelector('#hoops-pause').hidden = state !== 'pause';
      if (state === 'title') {
        showOverlay('STREET HOOPS', `ONE MINUTE SCORE ATTACK<br>COURT RECORD ${String(high).padStart(3, '0')}`, 'START CHALLENGE');
      } else if (state === 'over') {
        const accuracy = shots ? Math.round(makes / shots * 100) : 0;
        const record = score >= high && score > 0 ? 'NEW COURT RECORD!' : `COURT RECORD ${String(high).padStart(3, '0')}`;
        showOverlay('TIME!', `${String(score).padStart(3, '0')} POINTS - ${accuracy}% MADE<br>${record}`, 'SHOOT AGAIN');
      } else {
        root.querySelector('#hoops-overlay').hidden = true;
      }
      updateHud();
    }

    function start() {
      reset();
      state = 'play';
      services.tone(430, .06, 'square');
      setTimeout(() => services.tone(620, .07, 'triangle'), 70);
      renderUi();
    }

    function moveSpot(delta) {
      if (state !== 'play' || ball) return;
      spotIndex = (spotIndex + delta + SHOT_SPOTS.length) % SHOT_SPOTS.length;
      targetX = SHOT_SPOTS[spotIndex];
      message = shotValue() === 3 ? 'THREE POINT SPOT' : 'TWO POINT SPOT';
      messageTimer = .55;
      services.tone(240 + spotIndex * 28, .025, 'square');
      updateHud();
    }

    function burst(x, y, color, amount = 12) {
      for (let index = 0; index < amount; index += 1) {
        particles.push({
          x, y,
          vx: (Math.random() - .5) * 72,
          vy: -25 - Math.random() * 68,
          life: .35 + Math.random() * .45,
          color,
          size: 1 + Math.random() * 2
        });
      }
    }

    function shoot() {
      if (state !== 'play' || ball || shotCooldown > 0) return;
      const selectedPower = power;
      const perfect = idealPower();
      const error = selectedPower - perfect;
      const startY = 181;
      const gravity = 250;
      const velocityY = -250 - selectedPower * 73;
      const verticalDistance = startY - HOOP_Y;
      const discriminant = Math.max(1, velocityY * velocityY - 2 * gravity * verticalDistance);
      const travelTime = (-velocityY + Math.sqrt(discriminant)) / gravity;
      const target = HOOP_X + error * 67;
      const moneyBall = (shots + 1) % 5 === 0;
      const basePoints = shotValue();

      shots += 1;
      ball = {
        x: playerX + 7,
        y: startY,
        previousY: startY,
        vx: (target - (playerX + 7)) / travelTime,
        vy: velocityY,
        gravity,
        basePoints,
        moneyBall,
        resolved: false,
        trail: []
      };
      message = moneyBall ? 'MONEY BALL!' : `${basePoints} POINT SHOT`;
      messageTimer = .7;
      services.tone(260 + selectedPower * 210, .04, 'triangle');
      updateHud();
    }

    function madeShot() {
      if (!ball || ball.resolved) return;
      ball.resolved = true;
      makes += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      const streakBonus = streak > 0 && streak % 3 === 0 ? 1 : 0;
      const points = ball.basePoints + (ball.moneyBall ? 1 : 0) + streakBonus;
      score += points;
      high = Math.max(high, score);
      netPulse = .42;
      flash = .15;
      message = streakBonus ? `HEAT CHECK +${points}` : ball.moneyBall ? `MONEY +${points}` : `SWISH +${points}`;
      messageTimer = .9;
      burst(HOOP_X, HOOP_Y + 5, ball.moneyBall ? '#ffd264' : '#a9ecff', 16);
      services.tone(790, .07, 'triangle');
      setTimeout(() => services.tone(980, .055, 'triangle'), 55);
    }

    function missedShot() {
      if (!ball || ball.resolved) return;
      ball.resolved = true;
      streak = 0;
      message = Math.abs(power - idealPower()) < .05 ? 'RIMMED OUT' : power < idealPower() ? 'SHORT' : 'TOO STRONG';
      messageTimer = .7;
      services.tone(145, .045, 'square');
    }

    function finish() {
      if (state !== 'play') return;
      state = 'over';
      if (score >= high) {
        high = score;
        services.storage.set('streetHoops:highScore', high);
        services.storage.set('streetHoops:bestStreak', Math.max(services.storage.get('streetHoops:bestStreak', 0), bestStreak));
        services.tone(900, .16, 'triangle');
      } else {
        services.tone(230, .12, 'square');
      }
      renderUi();
    }

    function updateBall(dt) {
      if (!ball) return;
      ball.previousY = ball.y;
      ball.trail.push({ x: ball.x, y: ball.y, life: .24 });
      if (ball.trail.length > 9) ball.trail.shift();
      ball.trail.forEach(point => { point.life -= dt; });
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.vy += ball.gravity * dt;

      if (!ball.resolved && ball.previousY < HOOP_Y && ball.y >= HOOP_Y && ball.vy > 0) {
        if (ball.x > HOOP_X - 9 && ball.x < HOOP_X + 10) madeShot();
        else missedShot();
      }

      if (ball.y > 228 || ball.x > 335 || ball.x < -15) {
        if (!ball.resolved) missedShot();
        ball = null;
        shotCooldown = .16;
      }
    }

    function update(dt) {
      particles.forEach(particle => {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 110 * dt;
        particle.life -= dt;
      });
      particles = particles.filter(particle => particle.life > 0);
      netPulse = Math.max(0, netPulse - dt);
      flash = Math.max(0, flash - dt);
      messageTimer = Math.max(0, messageTimer - dt);
      shotCooldown = Math.max(0, shotCooldown - dt);

      if (state !== 'play') return;
      clock -= dt;
      if (clock <= 0) {
        clock = 0;
        finish();
        return;
      }

      power += powerDirection * dt * 1.08;
      if (power >= 1) { power = 1; powerDirection = -1; }
      if (power <= .15) { power = .15; powerDirection = 1; }
      playerX = smoothToward(playerX, targetX, 14, dt);
      updateBall(dt);
      if (messageTimer <= 0 && !ball) message = shotValue() === 3 ? '3 POINT RANGE' : '2 POINT RANGE';
      updateHud();
    }

    function drawPlayer() {
      ctx.save();
      ctx.translate(playerX, 190);
      ctx.fillStyle = '#05060766';
      ctx.beginPath();
      ctx.ellipse(0, 15, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f4f6f7';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-3, 2); ctx.lineTo(-7, 15);
      ctx.moveTo(3, 2); ctx.lineTo(8, 15);
      ctx.stroke();
      ctx.fillStyle = '#f4f6f7';
      ctx.beginPath();
      ctx.roundRect(-8, -13, 16, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#101418';
      ctx.beginPath();
      ctx.arc(0, -18, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawCourt() {
      const sky = ctx.createLinearGradient(0, 0, 0, 132);
      sky.addColorStop(0, flash > 0 ? '#344d5d' : '#0d1720');
      sky.addColorStop(.6, '#395a6b');
      sky.addColorStop(1, '#9ab0ba');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = '#10161b';
      for (let x = -2, index = 0; x < 322; index += 1) {
        const width = 18 + (index * 11) % 25;
        const height = 22 + (index * 17) % 48;
        ctx.fillRect(x, 106 - height, width, height);
        ctx.fillStyle = index % 3 ? '#ffe38a33' : '#9ee8ff3d';
        ctx.fillRect(x + 5, 76 - height, 3, 4);
        ctx.fillStyle = '#10161b';
        x += width + 2;
      }

      const court = ctx.createLinearGradient(0, 106, 0, 240);
      court.addColorStop(0, '#4b5962');
      court.addColorStop(1, '#1c2429');
      ctx.fillStyle = court;
      ctx.fillRect(0, 106, WIDTH, 134);

      ctx.strokeStyle = '#b9c8cf';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(HOOP_X, 202, 82, Math.PI, Math.PI * 2);
      ctx.moveTo(0, 202); ctx.lineTo(WIDTH, 202);
      ctx.stroke();

      SHOT_SPOTS.forEach((spot, index) => {
        const selected = index === spotIndex;
        ctx.fillStyle = selected ? '#a9ecff' : '#dbe2e555';
        ctx.globalAlpha = selected ? .9 : .45;
        ctx.beginPath();
        ctx.ellipse(spot, 215, selected ? 8 : 5, selected ? 3 : 2, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#e4eaed';
      ctx.fillRect(278, 40, 5, 78);
      ctx.fillStyle = '#d9e5eaee';
      ctx.fillRect(246, 51, 32, 25);
      ctx.strokeStyle = '#8396a0';
      ctx.strokeRect(246, 51, 32, 25);
      ctx.strokeStyle = netPulse > 0 ? '#fff1a5' : '#ffffff';
      ctx.lineWidth = netPulse > 0 ? 2.4 : 1.4;
      ctx.beginPath();
      ctx.moveTo(246, HOOP_Y); ctx.lineTo(270, HOOP_Y);
      ctx.stroke();
      ctx.strokeStyle = '#94a8b2';
      ctx.beginPath();
      ctx.moveTo(249, HOOP_Y + 2); ctx.lineTo(252, HOOP_Y + 15);
      ctx.moveTo(258, HOOP_Y + 2); ctx.lineTo(258, HOOP_Y + 16);
      ctx.moveTo(267, HOOP_Y + 2); ctx.lineTo(264, HOOP_Y + 15);
      ctx.stroke();
    }

    function drawBall() {
      if (!ball) {
        ctx.fillStyle = '#ffd264';
        ctx.beginPath();
        ctx.arc(playerX + 8, 181, 5, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      ball.trail.forEach((point, index) => {
        ctx.globalAlpha = clamp(point.life * 2.5, 0, .45);
        ctx.fillStyle = ball.moneyBall ? '#ffe893' : '#a9ecff';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 1 + index * .12, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = ball.moneyBall ? '#fff0a2' : '#ffd264';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#553b19';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 5, 0, Math.PI * 2);
      ctx.moveTo(ball.x - 5, ball.y); ctx.lineTo(ball.x + 5, ball.y);
      ctx.stroke();
    }

    function draw() {
      drawCourt();
      drawPlayer();
      drawBall();
      particles.forEach(particle => {
        ctx.globalAlpha = clamp(particle.life * 2.4, 0, 1);
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      });
      ctx.globalAlpha = 1;
    }

    function loop(time) {
      const dt = safeDelta(time, previousTime, .034);
      previousTime = time;
      update(dt);
      draw();
      frame = requestAnimationFrame(loop);
    }

    return {
      async mount(host, providedServices) {
        services = providedServices;
        high = services.storage.get('streetHoops:highScore', 0);
        bestStreak = services.storage.get('streetHoops:bestStreak', 0);
        host.innerHTML = markup();
        root = host.firstElementChild;
        canvas = root.querySelector('canvas');
        ctx = createGameContext(canvas, WIDTH, HEIGHT);
        reset();
        state = 'title';
        renderUi();
        previousTime = performance.now();
        frame = requestAnimationFrame(loop);

        root.addEventListener('click', event => {
          const action = event.target.closest?.('[data-hoops]')?.dataset.hoops;
          if (action === 'start') start();
          if (action === 'exit') services.exit();
        });
        canvas.addEventListener('pointerdown', event => {
          if (state !== 'play') return;
          const rect = canvas.getBoundingClientRect();
          const x = (event.clientX - rect.left) * WIDTH / rect.width;
          spotIndex = SHOT_SPOTS.reduce((best, spot, index) => Math.abs(spot - x) < Math.abs(SHOT_SPOTS[best] - x) ? index : best, 0);
          targetX = SHOT_SPOTS[spotIndex];
          if (!ball) shoot();
        });
      },
      input(key, down) {
        if (!down) return;
        if ((key === 'a' || key === 'start') && (state === 'title' || state === 'over')) start();
        else if (key === 'start') {
          state = state === 'pause' ? 'play' : 'pause';
          renderUi();
        } else if (state === 'play') {
          if (key === 'left') moveSpot(-1);
          if (key === 'right' || key === 'b') moveSpot(1);
          if (key === 'a') shoot();
        }
        if (key === 'select') services.exit();
      },
      setAuthority() {},
      unmount() { cancelAnimationFrame(frame); }
    };
  }
};
