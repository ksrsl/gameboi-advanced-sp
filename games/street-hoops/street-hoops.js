import { createGameContext, safeDelta, smoothToward } from '../../js/render-utils.js?v=3.0.0';

const WIDTH = 320;
const HEIGHT = 240;
const HOOP_X = 258;
const HOOP_Y = 79;
const SHOT_SPOTS = [52, 86, 122, 158, 198, 222];
const PERFECT_START = .48;
const PERFECT_END = .84;
const GOOD_START = .25;
const GOOD_END = .98;
const METER_FILL_SECONDS = .62;
const SHOT_RELOAD_SECONDS = .05;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default {
  id: 'street-hoops',
  title: 'Street Hoops',
  version: '4.0.0',
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
    let balls = [];
    let clock = 60;
    let buzzerTimer = 0;
    let score = 0;
    let high = 0;
    let recordAtStart = 0;
    let recordBrokenAt = -1;
    let shots = 0;
    let makes = 0;
    let streak = 0;
    let bestStreak = 0;
    let rhythm = PERFECT_START + .03;
    let shotCooldown = 0;
    let meterGrade = 'READY';
    let message = '';
    let messageTimer = 0;
    let netPulse = 0;
    let flash = 0;
    let courtPulse = 0;
    let particles = [];

    const markup = () => `
      <div class="hoops-game">
        <canvas width="640" height="480" aria-label="Street Hoops sixty second record challenge"></canvas>
        <div class="hoops-hud">
          <span>SCORE <b id="hoops-score">000</b></span>
          <strong id="hoops-clock">01:00</strong>
          <span>RECORD <b id="hoops-high">000</b></span>
        </div>
        <div class="hoops-goal" id="hoops-goal">SET THE RECORD</div>
        <div class="hoops-streak">STREAK <b id="hoops-streak">0</b></div>
        <div class="hoops-message" id="hoops-message"></div>
        <div class="hoops-meter" id="hoops-meter">
          <span>RELEASE</span>
          <div><i id="hoops-power"></i><b></b><em></em></div>
          <strong id="hoops-grade">READY</strong>
        </div>
        <div class="hoops-overlay" id="hoops-overlay">
          <strong>STREET HOOPS</strong>
          <small>60 SECOND RECORD RUN<br>FAST ONE-BALL RACK</small>
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

    function shotValue(index = spotIndex) {
      return index <= 2 ? 3 : 2;
    }

    function timingGrade(value = rhythm) {
      if (value >= PERFECT_START && value <= PERFECT_END) return 'PERFECT';
      if (value >= GOOD_START && value <= GOOD_END) return 'GOOD';
      if (value < GOOD_START) return 'RUSHED';
      return 'LATE';
    }

    function reset() {
      playerX = targetX = SHOT_SPOTS[2];
      spotIndex = 2;
      balls = [];
      clock = 60;
      buzzerTimer = 0;
      score = 0;
      recordAtStart = high;
      recordBrokenAt = -1;
      shots = 0;
      makes = 0;
      streak = 0;
      rhythm = PERFECT_START + .03;
      shotCooldown = 0;
      meterGrade = 'READY';
      message = 'TAP IN THE GOLD ZONE';
      messageTimer = 1.8;
      netPulse = 0;
      flash = 0;
      courtPulse = 0;
      particles = [];
    }

    function updateHud() {
      if (!root) return;
      root.dataset.shots = String(shots);
      root.dataset.balls = String(balls.length);
      root.querySelector('#hoops-score').textContent = String(score).padStart(3, '0');
      root.querySelector('#hoops-high').textContent = String(high).padStart(3, '0');
      root.querySelector('#hoops-clock').textContent = formatClock();
      root.querySelector('#hoops-streak').textContent = streak;
      root.querySelector('#hoops-message').textContent = message;
      root.querySelector('#hoops-power').style.width = `${rhythm * 100}%`;
      root.querySelector('#hoops-grade').textContent = meterGrade;
      root.querySelector('#hoops-meter').dataset.grade = meterGrade.toLowerCase();
      const goal = root.querySelector('#hoops-goal');
      if (recordBrokenAt >= 0) goal.textContent = `RECORD +${String(score - recordAtStart).padStart(2, '0')}`;
      else if (recordAtStart > 0) goal.textContent = `TO BEAT ${String(recordAtStart).padStart(3, '0')}`;
      else goal.textContent = 'SET THE RECORD';
      root.classList.toggle('urgent', (state === 'play' || state === 'buzzer') && clock <= 10);
    }

    function showOverlay(title, copy, button) {
      const overlay = root.querySelector('#hoops-overlay');
      overlay.hidden = false;
      overlay.innerHTML = `<strong>${title}</strong><small>${copy}</small><button data-hoops="start">${button}</button><em>LEFT / RIGHT SPOT - A SHOOT - B NEXT SPOT</em>`;
    }

    function renderUi() {
      root.querySelector('#hoops-pause').hidden = state !== 'pause';
      if (state === 'title') {
        const recordCopy = high > 0 ? `COURT RECORD ${String(high).padStart(3, '0')}` : 'NO RECORD YET';
        showOverlay('STREET HOOPS', `60 SECOND ONE-BALL CHALLENGE<br>${recordCopy}`, 'START CHALLENGE');
      } else if (state === 'over') {
        const accuracy = shots ? Math.round(makes / shots * 100) : 0;
        let result = `RECORD ${String(high).padStart(3, '0')}`;
        if (score > recordAtStart) {
          const secondsLeft = Math.max(0, 60 - recordBrokenAt).toFixed(1);
          result = `NEW COURT RECORD!<br>RECORD FELL WITH ${secondsLeft}S LEFT`;
        }
        showOverlay('FINAL BUZZER', `${String(score).padStart(3, '0')} POINTS - ${accuracy}% MADE<br>${result}`, 'RUN IT BACK');
      } else {
        root.querySelector('#hoops-overlay').hidden = true;
      }
      updateHud();
    }

    function start() {
      reset();
      state = 'play';
      services.tone(430, .05, 'square');
      setTimeout(() => services.tone(620, .06, 'triangle'), 55);
      setTimeout(() => services.tone(840, .07, 'triangle'), 110);
      renderUi();
    }

    function moveSpot(delta) {
      if (state !== 'play') return;
      spotIndex = (spotIndex + delta + SHOT_SPOTS.length) % SHOT_SPOTS.length;
      targetX = SHOT_SPOTS[spotIndex];
      message = shotValue() === 3 ? 'THREE POINT RANGE' : 'TWO POINT RANGE';
      messageTimer = .5;
      services.tone(230 + spotIndex * 25, .022, 'square');
      updateHud();
    }

    function burst(x, y, color, amount = 12) {
      for (let index = 0; index < amount; index += 1) {
        particles.push({
          x,
          y,
          vx: (Math.random() - .5) * 92,
          vy: -26 - Math.random() * 82,
          life: .32 + Math.random() * .5,
          color,
          size: 1 + Math.random() * 2
        });
      }
    }

    function makeChance(grade, basePoints) {
      const base = basePoints === 3 ? .7 : .84;
      if (grade === 'PERFECT') return 1;
      if (grade === 'GOOD') return clamp(base + streak * .012, 0, .93);
      return clamp(base - .28 + streak * .008, .34, .72);
    }

    function shoot() {
      if (state !== 'play' || shotCooldown > 0 || balls.length > 0) return;
      const grade = timingGrade();
      const startX = playerX + 7;
      const startY = 181;
      const basePoints = shotValue();
      const moneyBall = (shots + 1) % 5 === 0;
      const made = Math.random() <= makeChance(grade, basePoints);
      const distance = Math.abs(HOOP_X - startX);
      const travelTime = .43 + distance / 980;
      const gravity = 520;
      const velocityY = (HOOP_Y - startY - .5 * gravity * travelTime * travelTime) / travelTime;
      let target = HOOP_X + (Math.random() - .5) * 7;
      if (!made) {
        const side = Math.random() < .5 ? -1 : 1;
        target = HOOP_X + side * (13 + Math.random() * 13);
      }

      shots += 1;
      balls.push({
        x: startX,
        y: startY,
        startX,
        startY,
        target,
        vx: (target - startX) / travelTime,
        vy: velocityY,
        gravity,
        travelTime,
        age: 0,
        basePoints,
        moneyBall,
        made,
        grade,
        resolved: false,
        trail: []
      });

      rhythm = 0;
      shotCooldown = SHOT_RELOAD_SECONDS;
      meterGrade = 'LOAD';
      message = moneyBall ? 'MONEY BALL!' : grade === 'PERFECT' ? 'PERFECT RELEASE!' : `${grade} RELEASE`;
      messageTimer = .42;
      services.tone(275 + (grade === 'PERFECT' ? 150 : 70), .032, 'triangle');
      updateHud();
    }

    function madeShot(ball) {
      if (ball.resolved) return;
      ball.resolved = true;
      makes += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      const streakBonus = streak > 0 && streak % 3 === 0 ? 1 : 0;
      const perfectBonus = ball.grade === 'PERFECT' ? 1 : 0;
      const moneyBonus = ball.moneyBall ? 2 : 0;
      const points = ball.basePoints + moneyBonus + perfectBonus + streakBonus;
      score += points;
      netPulse = .35;
      flash = .11;
      courtPulse = .4;

      if (score > high) {
        high = score;
        services.storage.set('streetHoops:highScore', high);
      }
      if (recordBrokenAt < 0 && score > recordAtStart) {
        recordBrokenAt = 60 - clock;
        message = 'COURT RECORD BROKEN!';
        messageTimer = 1.05;
        services.tone(1120, .09, 'triangle');
      } else if (perfectBonus) {
        message = `PURE +${points}`;
        messageTimer = .55;
      } else if (streakBonus) {
        message = `HEAT CHECK +${points}`;
        messageTimer = .55;
      } else {
        message = ball.moneyBall ? `MONEY +${points}` : `SWISH +${points}`;
        messageTimer = .48;
      }

      burst(HOOP_X, HOOP_Y + 5, ball.moneyBall ? '#ffd85f' : '#6eeaff', 17);
      services.tone(810, .052, 'triangle');
      setTimeout(() => services.tone(1040, .045, 'triangle'), 45);
    }

    function missedShot(ball) {
      if (ball.resolved) return;
      ball.resolved = true;
      streak = 0;
      message = ball.grade === 'RUSHED' ? 'TOO QUICK' : ball.grade === 'LATE' ? 'LATE RELEASE' : 'RIMMED OUT';
      messageTimer = .46;
      services.tone(145, .038, 'square');
    }

    function finish() {
      if (state === 'over') return;
      state = 'over';
      high = Math.max(high, score);
      services.storage.set('streetHoops:highScore', high);
      services.storage.set('streetHoops:bestStreak', Math.max(services.storage.get('streetHoops:bestStreak', 0), bestStreak));
      if (score > recordAtStart) {
        services.tone(900, .13, 'triangle');
        setTimeout(() => services.tone(1120, .16, 'triangle'), 110);
      } else {
        services.tone(230, .12, 'square');
      }
      renderUi();
    }

    function updateBalls(dt) {
      balls.forEach(ball => {
        ball.age += dt;
        ball.x = ball.startX + ball.vx * ball.age;
        ball.y = ball.startY + ball.vy * ball.age + .5 * ball.gravity * ball.age * ball.age;
        ball.trail.push({ x: ball.x, y: ball.y, life: .2 });
        if (ball.trail.length > 7) ball.trail.shift();
        ball.trail.forEach(point => { point.life -= dt; });
        if (!ball.resolved && ball.age >= ball.travelTime) {
          if (ball.made) madeShot(ball);
          else missedShot(ball);
        }
      });
      const hadBall = balls.length > 0;
      balls = balls.filter(ball => ball.age < ball.travelTime + .1);
      if (hadBall && balls.length === 0 && state === 'play') {
        rhythm = 0;
        shotCooldown = SHOT_RELOAD_SECONDS;
        meterGrade = 'LOAD';
      }
    }

    function update(dt) {
      if (state === 'pause') {
        updateHud();
        return;
      }
      particles.forEach(particle => {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 130 * dt;
        particle.life -= dt;
      });
      particles = particles.filter(particle => particle.life > 0);
      netPulse = Math.max(0, netPulse - dt);
      flash = Math.max(0, flash - dt);
      courtPulse = Math.max(0, courtPulse - dt);
      messageTimer = Math.max(0, messageTimer - dt);
      shotCooldown = Math.max(0, shotCooldown - dt);
      updateBalls(dt);

      if (state === 'play') {
        clock -= dt;
        if (clock <= 0) {
          clock = 0;
          state = 'buzzer';
          buzzerTimer = .6;
          message = 'BUZZER!';
          messageTimer = .7;
          services.tone(105, .2, 'sawtooth');
        }
      } else if (state === 'buzzer') {
        buzzerTimer -= dt;
        if (balls.length === 0 || buzzerTimer <= 0) {
          finish();
          return;
        }
      }

      if (state !== 'play' && state !== 'buzzer') return;

      if (state === 'play') {
        if (balls.length === 0) rhythm = Math.min(1, rhythm + dt / METER_FILL_SECONDS);
        if (balls.length > 0) meterGrade = 'FLIGHT';
        else if (shotCooldown <= 0) meterGrade = timingGrade();
        else meterGrade = 'LOAD';
      }
      playerX = smoothToward(playerX, targetX, 18, dt);
      if (messageTimer <= 0) {
        if (state === 'buzzer') message = 'FINAL SHOT';
        else if (rhythm >= PERFECT_START && rhythm <= PERFECT_END) message = 'SHOOT NOW!';
        else message = shotValue() === 3 ? '3 POINT RANGE' : '2 POINT RANGE';
      }
      updateHud();
    }

    function drawPlayer() {
      ctx.save();
      ctx.translate(playerX, 190);
      ctx.fillStyle = '#02050777';
      ctx.beginPath();
      ctx.ellipse(0, 15, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e9fbff';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-3, 2); ctx.lineTo(-7, 15);
      ctx.moveTo(3, 2); ctx.lineTo(8, 15);
      ctx.stroke();
      ctx.fillStyle = '#f4f8fa';
      ctx.beginPath();
      ctx.roundRect(-8, -13, 16, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#08c9ee';
      ctx.fillRect(-8, -3, 16, 3);
      ctx.fillStyle = '#0a1015';
      ctx.beginPath();
      ctx.arc(0, -18, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawCourt() {
      const sky = ctx.createLinearGradient(0, 0, 0, 132);
      sky.addColorStop(0, flash > 0 ? '#294d60' : '#07131e');
      sky.addColorStop(.58, '#1d536b');
      sky.addColorStop(1, '#7b9fad');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = '#071018';
      for (let x = -2, index = 0; x < 322; index += 1) {
        const width = 17 + (index * 11) % 24;
        const height = 22 + (index * 17) % 48;
        ctx.fillRect(x, 106 - height, width, height);
        ctx.fillStyle = index % 3 ? '#ffdf6b42' : '#53e6ff45';
        ctx.fillRect(x + 5, 76 - height, 3, 4);
        ctx.fillStyle = '#071018';
        x += width + 2;
      }

      ctx.fillStyle = '#071018cc';
      ctx.fillRect(8, 48, 50, 22);
      ctx.strokeStyle = '#48dff0';
      ctx.strokeRect(8.5, 48.5, 49, 21);
      ctx.fillStyle = clock <= 10 && state === 'play' ? '#ff5f7d' : '#f6fbff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(formatClock(), 33, 63);

      const court = ctx.createLinearGradient(0, 106, 0, 240);
      court.addColorStop(0, courtPulse > 0 ? '#506c79' : '#354b56');
      court.addColorStop(1, '#111c24');
      ctx.fillStyle = court;
      ctx.fillRect(0, 106, WIDTH, 134);

      ctx.strokeStyle = '#8ac6d4';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(HOOP_X, 202, 82, Math.PI, Math.PI * 2);
      ctx.moveTo(0, 202); ctx.lineTo(WIDTH, 202);
      ctx.stroke();

      SHOT_SPOTS.forEach((spot, index) => {
        const selected = index === spotIndex;
        ctx.fillStyle = selected ? (shotValue(index) === 3 ? '#ffd85f' : '#65eaff') : '#dbe2e555';
        ctx.globalAlpha = selected ? .95 : .42;
        ctx.beginPath();
        ctx.ellipse(spot, 215, selected ? 8 : 5, selected ? 3 : 2, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#dce8ed';
      ctx.fillRect(278, 40, 5, 78);
      ctx.fillStyle = '#e9f7fbee';
      ctx.fillRect(246, 51, 32, 25);
      ctx.strokeStyle = '#4b788b';
      ctx.strokeRect(246, 51, 32, 25);
      ctx.strokeStyle = netPulse > 0 ? '#ffe878' : '#ff7a52';
      ctx.lineWidth = netPulse > 0 ? 2.5 : 1.6;
      ctx.beginPath();
      ctx.moveTo(246, HOOP_Y); ctx.lineTo(270, HOOP_Y);
      ctx.stroke();
      ctx.strokeStyle = netPulse > 0 ? '#f8fdff' : '#8caab7';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(249, HOOP_Y + 2); ctx.lineTo(252, HOOP_Y + 15);
      ctx.moveTo(258, HOOP_Y + 2); ctx.lineTo(258, HOOP_Y + 16);
      ctx.moveTo(267, HOOP_Y + 2); ctx.lineTo(264, HOOP_Y + 15);
      ctx.stroke();
    }

    function drawBalls() {
      balls.forEach(ball => {
        ball.trail.forEach((point, index) => {
          ctx.globalAlpha = clamp(point.life * 3, 0, .42);
          ctx.fillStyle = ball.moneyBall ? '#ffe878' : '#7deaff';
          ctx.beginPath();
          ctx.arc(point.x, point.y, 1 + index * .11, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.fillStyle = ball.moneyBall ? '#fff2a6' : '#ffb23f';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5a2f13';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 5, 0, Math.PI * 2);
        ctx.moveTo(ball.x - 5, ball.y); ctx.lineTo(ball.x + 5, ball.y);
        ctx.stroke();
      });

      if (state === 'play' && shotCooldown <= 0 && balls.length === 0) {
        ctx.fillStyle = (shots + 1) % 5 === 0 ? '#fff2a6' : '#ffb23f';
        ctx.beginPath();
        ctx.arc(playerX + 8, 181, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function draw() {
      drawCourt();
      drawPlayer();
      drawBalls();
      particles.forEach(particle => {
        ctx.globalAlpha = clamp(particle.life * 2.5, 0, 1);
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
          shoot();
        });
      },
      input(key, down) {
        if (!down) return;
        if ((key === 'a' || key === 'start') && (state === 'title' || state === 'over')) start();
        else if (key === 'start') {
          if (state === 'play') state = 'pause';
          else if (state === 'pause') state = 'play';
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
