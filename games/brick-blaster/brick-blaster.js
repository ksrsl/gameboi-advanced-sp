import { createGameContext, safeDelta } from '../../js/render-utils.js?v=3.0.0';

const WIDTH = 320;
const HEIGHT = 240;
const BRICK_COLS = 10;
const BRICK_ROWS = 6;
const BRICK_W = 27;
const BRICK_H = 10;
const BRICK_GAP = 2;
const COLORS = ['#ff5d73', '#ff9361', '#ffe16a', '#68e09b', '#5ce1e6', '#8c7dff'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default {
  id: 'brick-blaster',
  title: 'Brick Blaster',
  version: '1.0.0',
  create() {
    let root;
    let canvas;
    let ctx;
    let services;
    let frame = 0;
    let previousTime = 0;
    let state = 'title';
    let score = 0;
    let high = 0;
    let level = 1;
    let bestLevel = 1;
    let lives = 3;
    let paddle;
    let balls = [];
    let bricks = [];
    let drops = [];
    let particles = [];
    let launched = false;
    let pointerActive = false;
    let flash = 0;
    const held = { left: false, right: false };

    const markup = () => `
      <div class="brick-game">
        <canvas width="320" height="240" aria-label="Brick Blaster game field"></canvas>
        <div class="brick-hud">
          <span>SCORE <b id="brick-score">000000</b></span>
          <span>LV <b id="brick-level">01</b></span>
          <span>LIVES <b id="brick-lives">3</b></span>
          <span>HI <b id="brick-hi">000000</b></span>
        </div>
        <div class="brick-overlay" id="brick-overlay">
          <strong>BRICK BLASTER</strong>
          <small>BREAK THE WALL<br>GRAB THE POWER CORES</small>
          <button data-brick="start">START GAME</button>
          <em>◀ ▶ MOVE • A LAUNCH</em>
        </div>
        <div class="brick-pause" id="brick-pause" hidden>PAUSED</div>
        <button class="brick-exit" data-brick="exit" aria-label="Exit game">×</button>
        <div class="brick-touch-hint">TOUCH FIELD TO MOVE</div>
      </div>`;

    function saveRecords() {
      high = Math.max(high, score);
      bestLevel = Math.max(bestLevel, level);
      services.storage.set('brickBlaster:highScore', high);
      services.storage.set('brickBlaster:bestLevel', bestLevel);
    }

    function buildBricks() {
      bricks = [];
      const toughRows = Math.min(3, Math.floor((level - 1) / 2));
      for (let row = 0; row < BRICK_ROWS; row += 1) {
        for (let column = 0; column < BRICK_COLS; column += 1) {
          const patternHole = level > 1 && (column + row + level) % 11 === 0;
          if (patternHole) continue;
          const hp = row < toughRows ? 2 : 1;
          bricks.push({
            x: 15 + column * (BRICK_W + BRICK_GAP),
            y: 34 + row * (BRICK_H + BRICK_GAP),
            w: BRICK_W,
            h: BRICK_H,
            color: COLORS[row],
            hp
          });
        }
      }
    }

    function attachBall() {
      balls = [{ x: paddle.x + paddle.w / 2, y: paddle.y - 5, vx: 88, vy: -112, r: 3 }];
      launched = false;
    }

    function prepareLevel() {
      paddle = { x: 139, y: 218, w: 42, h: 6, speed: 190, wideUntil: 0 };
      drops = [];
      particles = [];
      buildBricks();
      attachBall();
    }

    function resetGame() {
      score = 0;
      level = 1;
      lives = 3;
      prepareLevel();
    }

    function updateHud() {
      root.querySelector('#brick-score').textContent = String(score).padStart(6, '0');
      root.querySelector('#brick-level').textContent = String(level).padStart(2, '0');
      root.querySelector('#brick-lives').textContent = String(lives);
      root.querySelector('#brick-hi').textContent = String(high).padStart(6, '0');
    }

    function showOverlay(title, copy, button, hint = 'A / START') {
      const overlay = root.querySelector('#brick-overlay');
      overlay.hidden = false;
      overlay.innerHTML = `<strong>${title}</strong><small>${copy}</small><button data-brick="start">${button}</button><em>${hint}</em>`;
    }

    function renderUi() {
      updateHud();
      root.querySelector('#brick-pause').hidden = state !== 'pause';
      if (state === 'title') showOverlay('BRICK BLASTER', 'BREAK THE WALL<br>GRAB THE POWER CORES', 'START GAME', '◀ ▶ MOVE • A LAUNCH');
      else if (state === 'over') showOverlay('WALL WINS', `SCORE ${String(score).padStart(6, '0')}<br>LEVEL ${level}`, 'RESTART');
      else if (state === 'level') showOverlay('SECTOR CLEAR', `BONUS ${level * 250}<br>NEXT WALL: ${level + 1}`, 'NEXT LEVEL');
      else root.querySelector('#brick-overlay').hidden = true;
    }

    function burst(x, y, color) {
      for (let index = 0; index < 6; index += 1) {
        particles.push({ x, y, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, life: 0.35, color });
      }
    }

    function powerDrop(brick) {
      if (Math.random() > 0.19) return;
      const roll = Math.random();
      const type = roll < 0.42 ? 'W' : roll < 0.82 ? 'S' : 'L';
      drops.push({ x: brick.x + brick.w / 2, y: brick.y, vy: 45, type });
    }

    function applyPower(type) {
      if (type === 'W') {
        paddle.w = 66;
        paddle.wideUntil = performance.now() + 11000;
        services.tone(620, 0.08);
      } else if (type === 'S') {
        balls.forEach(ball => { ball.vx *= 0.78; ball.vy *= 0.78; });
        services.tone(430, 0.1);
      } else {
        lives = Math.min(5, lives + 1);
        services.tone(880, 0.12);
      }
      score += 75;
      saveRecords();
      updateHud();
    }

    function circleHitsRect(ball, rect) {
      const nearestX = clamp(ball.x, rect.x, rect.x + rect.w);
      const nearestY = clamp(ball.y, rect.y, rect.y + rect.h);
      const dx = ball.x - nearestX;
      const dy = ball.y - nearestY;
      return dx * dx + dy * dy <= ball.r * ball.r;
    }

    function loseBall() {
      lives -= 1;
      services.tone(120, 0.18, 'sawtooth');
      if (lives <= 0) {
        state = 'over';
        saveRecords();
        renderUi();
      } else {
        attachBall();
        updateHud();
      }
    }

    function hitBrick(ball, brick) {
      brick.hp -= 1;
      ball.vy *= -1;
      if (brick.hp > 0) {
        flash = 0.08;
        services.tone(260, 0.02);
        return;
      }
      const index = bricks.indexOf(brick);
      if (index >= 0) bricks.splice(index, 1);
      score += 40 + level * 10;
      powerDrop(brick);
      burst(ball.x, ball.y, brick.color);
      services.tone(480 + (BRICK_ROWS * 30 - brick.y), 0.025);
      saveRecords();
      if (bricks.length === 0) {
        score += level * 250;
        saveRecords();
        state = 'level';
        renderUi();
      }
    }

    function updateBall(ball, dt) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x - ball.r <= 4 && ball.vx < 0) { ball.x = 4 + ball.r; ball.vx *= -1; }
      if (ball.x + ball.r >= WIDTH - 4 && ball.vx > 0) { ball.x = WIDTH - 4 - ball.r; ball.vx *= -1; }
      if (ball.y - ball.r <= 25 && ball.vy < 0) { ball.y = 25 + ball.r; ball.vy *= -1; }

      if (ball.vy > 0 && circleHitsRect(ball, paddle)) {
        ball.y = paddle.y - ball.r - 1;
        const angle = clamp((ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2), -1, 1);
        const speed = Math.min(235, Math.hypot(ball.vx, ball.vy) * 1.015);
        ball.vx = speed * angle * 0.86;
        ball.vy = -Math.sqrt(Math.max(70, speed * speed - ball.vx * ball.vx));
        services.tone(320, 0.018);
      }

      for (const brick of bricks) {
        if (circleHitsRect(ball, brick)) { hitBrick(ball, brick); break; }
      }
    }

    function update(dt) {
      if (state !== 'play') return;
      const direction = Number(held.right) - Number(held.left);
      paddle.x = clamp(paddle.x + direction * paddle.speed * dt, 5, WIDTH - 5 - paddle.w);
      if (paddle.wideUntil && performance.now() > paddle.wideUntil) {
        paddle.w = 42;
        paddle.wideUntil = 0;
      }

      if (!launched && balls[0]) {
        balls[0].x = paddle.x + paddle.w / 2;
        balls[0].y = paddle.y - 5;
      } else {
        balls.forEach(ball => updateBall(ball, dt));
        if (balls.some(ball => ball.y > HEIGHT + 8)) {
          balls = balls.filter(ball => ball.y <= HEIGHT + 8);
          if (balls.length === 0) loseBall();
        }
      }

      drops.forEach(drop => { drop.y += drop.vy * dt; });
      drops = drops.filter(drop => {
        if (drop.y > paddle.y && drop.y < paddle.y + 12 && drop.x >= paddle.x && drop.x <= paddle.x + paddle.w) {
          applyPower(drop.type);
          return false;
        }
        return drop.y < HEIGHT + 10;
      });

      particles.forEach(particle => {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 65 * dt;
        particle.life -= dt;
      });
      particles = particles.filter(particle => particle.life > 0);
      flash = Math.max(0, flash - dt);
    }

    function draw() {
      ctx.fillStyle = flash > 0 ? '#142c4c' : '#081126';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = '#ffffff20';
      for (let index = 0; index < 32; index += 1) {
        const x = (index * 67 + 11) % WIDTH;
        const y = 25 + ((index * 31 + level * 7) % 175);
        ctx.fillRect(x, y, 1, 1);
      }

      bricks.forEach(brick => {
        ctx.fillStyle = brick.color;
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
        ctx.fillStyle = '#ffffff55';
        ctx.fillRect(brick.x + 2, brick.y + 2, brick.w - 4, 2);
        ctx.fillStyle = '#00000045';
        ctx.fillRect(brick.x + 2, brick.y + brick.h - 2, brick.w - 4, 1);
        if (brick.hp > 1) {
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(brick.x + 0.5, brick.y + 0.5, brick.w - 1, brick.h - 1);
        }
      });

      drops.forEach(drop => {
        const color = drop.type === 'W' ? '#5ce1e6' : drop.type === 'S' ? '#8c7dff' : '#ff6b83';
        ctx.fillStyle = color;
        ctx.fillRect(drop.x - 6, drop.y - 4, 12, 8);
        ctx.fillStyle = '#081126';
        ctx.font = 'bold 7px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(drop.type, drop.x, drop.y + 3);
      });

      ctx.fillStyle = '#d9faff';
      ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
      ctx.fillStyle = '#5ce1e6';
      ctx.fillRect(paddle.x + 3, paddle.y + 1, paddle.w - 6, 2);

      balls.forEach(ball => {
        ctx.fillStyle = '#fff6bd';
        ctx.fillRect(Math.round(ball.x - 3), Math.round(ball.y - 3), 6, 6);
      });

      particles.forEach(particle => {
        ctx.globalAlpha = clamp(particle.life * 3, 0, 1);
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, 2, 2);
      });
      ctx.globalAlpha = 1;

      if (state === 'play' && !launched) {
        ctx.fillStyle = '#ffe16a';
        ctx.font = '8px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('PRESS A TO LAUNCH', WIDTH / 2, 204);
      }
      ctx.textAlign = 'left';
    }

    function loop(time) {
      const dt = safeDelta(time, previousTime);
      previousTime = time;
      update(dt);
      draw();
      frame = requestAnimationFrame(loop);
    }

    function startOrAdvance() {
      if (state === 'title' || state === 'over') {
        resetGame();
        state = 'play';
        services.tone(560, 0.06);
      } else if (state === 'level') {
        level += 1;
        bestLevel = Math.max(bestLevel, level);
        prepareLevel();
        state = 'play';
        saveRecords();
        services.tone(760, 0.09);
      } else if (state === 'play' && !launched) {
        launched = true;
        services.tone(440, 0.035);
      }
      renderUi();
    }

    function pause() {
      if (state === 'play') state = 'pause';
      else if (state === 'pause') state = 'play';
      else { startOrAdvance(); return; }
      services.tone(300, 0.04);
      renderUi();
    }

    function movePointer(event) {
      const bounds = canvas.getBoundingClientRect();
      const x = (event.clientX - bounds.left) * (WIDTH / bounds.width);
      paddle.x = clamp(x - paddle.w / 2, 5, WIDTH - 5 - paddle.w);
      if (!launched && balls[0]) balls[0].x = paddle.x + paddle.w / 2;
    }

    return {
      async mount(host, providedServices) {
        services = providedServices;
        high = services.storage.get('brickBlaster:highScore', 0);
        bestLevel = services.storage.get('brickBlaster:bestLevel', 1);
        host.innerHTML = markup();
        root = host.firstElementChild;
        canvas = root.querySelector('canvas');
        ctx = createGameContext(canvas, WIDTH, HEIGHT);
        resetGame();
        state = 'title';
        renderUi();
        previousTime = performance.now();
        frame = requestAnimationFrame(loop);

        root.addEventListener('click', event => {
          const action = event.target.dataset.brick;
          if (action === 'start') startOrAdvance();
          if (action === 'exit') services.exit();
        });
        canvas.addEventListener('pointerdown', event => {
          pointerActive = true;
          movePointer(event);
          if (state === 'play' && !launched) startOrAdvance();
          canvas.setPointerCapture?.(event.pointerId);
        });
        canvas.addEventListener('pointermove', event => { if (pointerActive) movePointer(event); });
        canvas.addEventListener('pointerup', () => { pointerActive = false; });
        canvas.addEventListener('pointercancel', () => { pointerActive = false; });
      },
      input(key, down) {
        if (key === 'left' || key === 'right') { held[key] = down; return; }
        if (!down) return;
        if (key === 'a') startOrAdvance();
        if (key === 'start') pause();
        if (key === 'select') services.exit();
      },
      setAuthority() {},
      unmount() {
        cancelAnimationFrame(frame);
        held.left = false;
        held.right = false;
      }
    };
  }
};
