import { createGameContext, safeDelta } from '../../js/render-utils.js?v=3.0.0';

const WIDTH = 320;
const HEIGHT = 240;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default {
  id: 'astro-defender',
  title: 'Astro Defender',
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
    let wave = 1;
    let bestWave = 1;
    let lives = 3;
    let bombs = 2;
    let player;
    let enemies = [];
    let shots = [];
    let enemyShots = [];
    let drops = [];
    let sparks = [];
    let stars = [];
    let enemyDirection = 1;
    let enemyStepTimer = 0;
    let enemyShotTimer = 0;
    let shootTimer = 0;
    let rapidUntil = 0;
    let spreadUntil = 0;
    let shieldUntil = 0;
    let hitFlash = 0;
    let pointerActive = false;
    const held = { left: false, right: false, fire: false };

    const markup = () => `
      <div class="astro-game">
        <canvas width="320" height="240" aria-label="Astro Defender game field"></canvas>
        <div class="astro-hud">
          <span>SCORE <b id="astro-score">000000</b></span>
          <span>WAVE <b id="astro-wave">01</b></span>
          <span>SHIP <b id="astro-lives">3</b></span>
          <span>HI <b id="astro-hi">000000</b></span>
        </div>
        <div class="astro-overlay" id="astro-overlay">
          <strong>ASTRO DEFENDER</strong>
          <small>HOLD THE LAST STARLINE<br>COLLECT TECH CORES</small>
          <button data-astro="start">START MISSION</button>
          <em>◀ ▶ MOVE • A FIRE • B BOMB</em>
        </div>
        <div class="astro-pause" id="astro-pause" hidden>PAUSED</div>
        <button class="astro-exit" data-astro="exit" aria-label="Exit game">×</button>
        <button class="astro-bomb" data-astro="bomb">BOMB <span id="astro-bombs">2</span></button>
      </div>`;

    function saveRecords() {
      high = Math.max(high, score);
      bestWave = Math.max(bestWave, wave);
      services.storage.set('astroDefender:highScore', high);
      services.storage.set('astroDefender:bestWave', bestWave);
    }

    function makeStars() {
      stars = Array.from({ length: 45 }, (_, index) => ({
        x: (index * 71 + 13) % WIDTH,
        y: (index * 37 + 19) % HEIGHT,
        speed: 7 + (index % 4) * 6,
        size: index % 7 === 0 ? 2 : 1
      }));
    }

    function buildWave() {
      enemies = [];
      const rows = Math.min(5, 2 + Math.ceil(wave / 2));
      const columns = Math.min(9, 6 + Math.floor(wave / 3));
      const startX = (WIDTH - columns * 27) / 2;
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          enemies.push({
            x: startX + column * 27,
            y: 37 + row * 19,
            w: 15,
            h: 10,
            type: row % 3,
            hp: wave >= 4 && row === 0 ? 2 : 1,
            phase: column * 0.7 + row
          });
        }
      }
      enemyDirection = 1;
      enemyShotTimer = 0.8;
      enemyStepTimer = 0;
      shots = [];
      enemyShots = [];
      drops = [];
    }

    function resetGame() {
      score = 0;
      wave = 1;
      lives = 3;
      bombs = 2;
      player = { x: WIDTH / 2, y: 213, speed: 150 };
      rapidUntil = 0;
      spreadUntil = 0;
      shieldUntil = 0;
      buildWave();
    }

    function updateHud() {
      root.querySelector('#astro-score').textContent = String(score).padStart(6, '0');
      root.querySelector('#astro-wave').textContent = String(wave).padStart(2, '0');
      root.querySelector('#astro-lives').textContent = String(lives);
      root.querySelector('#astro-hi').textContent = String(high).padStart(6, '0');
      root.querySelector('#astro-bombs').textContent = String(bombs);
    }

    function showOverlay(title, copy, button, hint = 'A / START') {
      const overlay = root.querySelector('#astro-overlay');
      overlay.hidden = false;
      overlay.innerHTML = `<strong>${title}</strong><small>${copy}</small><button data-astro="start">${button}</button><em>${hint}</em>`;
    }

    function renderUi() {
      updateHud();
      root.querySelector('#astro-pause').hidden = state !== 'pause';
      if (state === 'title') showOverlay('ASTRO DEFENDER', 'HOLD THE LAST STARLINE<br>COLLECT TECH CORES', 'START MISSION', '◀ ▶ MOVE • A FIRE • B BOMB');
      else if (state === 'over') showOverlay('STARLINE LOST', `SCORE ${String(score).padStart(6, '0')}<br>WAVE ${wave}`, 'RETRY MISSION');
      else if (state === 'wave') showOverlay('WAVE CLEARED', `SECTOR BONUS ${wave * 300}<br>INCOMING WAVE ${wave + 1}`, 'CONTINUE');
      else root.querySelector('#astro-overlay').hidden = true;
    }

    function spark(x, y, color = '#ffdf6b', count = 7) {
      for (let index = 0; index < count; index += 1) {
        sparks.push({ x, y, vx: (Math.random() - 0.5) * 100, vy: (Math.random() - 0.5) * 100, life: 0.45, color });
      }
    }

    function fire() {
      if (state !== 'play' || shootTimer > 0) return;
      const spread = performance.now() < spreadUntil;
      const rapid = performance.now() < rapidUntil;
      shots.push({ x: player.x, y: player.y - 9, vx: 0, vy: -205 });
      if (spread) {
        shots.push({ x: player.x - 3, y: player.y - 7, vx: -58, vy: -195 });
        shots.push({ x: player.x + 3, y: player.y - 7, vx: 58, vy: -195 });
      }
      shootTimer = rapid ? 0.095 : 0.22;
      services.tone(spread ? 660 : 590, 0.018);
    }

    function rectHit(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function dropCore(enemy) {
      if (Math.random() > 0.16) return;
      const roll = Math.random();
      const type = roll < 0.4 ? 'R' : roll < 0.78 ? 'T' : 'S';
      drops.push({ x: enemy.x + enemy.w / 2, y: enemy.y, vy: 45, type });
    }

    function collectCore(type) {
      const now = performance.now();
      if (type === 'R') rapidUntil = now + 10000;
      if (type === 'T') spreadUntil = now + 9000;
      if (type === 'S') shieldUntil = now + 12000;
      score += 100;
      services.tone(type === 'S' ? 880 : 720, 0.11);
      saveRecords();
      updateHud();
    }

    function damagePlayer() {
      if (performance.now() < shieldUntil) {
        shieldUntil = 0;
        hitFlash = 0.14;
        services.tone(360, 0.08);
        return;
      }
      lives -= 1;
      enemyShots = [];
      hitFlash = 0.3;
      spark(player.x, player.y, '#ff5d73', 14);
      services.tone(100, 0.24, 'sawtooth');
      if (lives <= 0) {
        state = 'over';
        saveRecords();
        renderUi();
      }
      updateHud();
    }

    function enemyFire() {
      if (!enemies.length) return;
      const candidates = [...enemies].sort(() => Math.random() - 0.5).slice(0, Math.min(2, 1 + Math.floor(wave / 4)));
      candidates.forEach(enemy => enemyShots.push({ x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h, vy: 70 + wave * 7 }));
    }

    function useBomb() {
      if (state !== 'play' || bombs <= 0) return;
      bombs -= 1;
      enemyShots = [];
      hitFlash = 0.22;
      enemies.forEach(enemy => { enemy.hp -= 1; spark(enemy.x + 7, enemy.y + 5, '#ffdf6b', 3); });
      const destroyed = enemies.filter(enemy => enemy.hp <= 0);
      score += destroyed.length * 35;
      enemies = enemies.filter(enemy => enemy.hp > 0);
      services.tone(80, 0.28, 'sawtooth');
      saveRecords();
      updateHud();
      if (!enemies.length) finishWave();
    }

    function finishWave() {
      if (state !== 'play') return;
      score += wave * 300;
      saveRecords();
      state = 'wave';
      services.tone(840, 0.13);
      renderUi();
    }

    function updateEnemies(dt) {
      if (!enemies.length) return;
      enemyStepTimer += dt;
      const speed = 18 + wave * 3 + (1 - enemies.length / 45) * 16;
      const edge = enemies.some(enemy => (enemyDirection > 0 && enemy.x + enemy.w >= WIDTH - 8) || (enemyDirection < 0 && enemy.x <= 8));
      if (edge) {
        enemyDirection *= -1;
        enemies.forEach(enemy => { enemy.y += 8; });
      } else {
        enemies.forEach(enemy => { enemy.x += enemyDirection * speed * dt; enemy.phase += dt * 5; });
      }

      if (enemies.some(enemy => enemy.y + enemy.h >= player.y - 8)) {
        lives = 1;
        damagePlayer();
        return;
      }

      enemyShotTimer -= dt;
      if (enemyShotTimer <= 0) {
        enemyFire();
        enemyShotTimer = Math.max(0.35, 1.25 - wave * 0.055) + Math.random() * 0.5;
      }
    }

    function update(dt) {
      stars.forEach(star => { star.y += star.speed * dt; if (star.y > HEIGHT) star.y = 24; });
      sparks.forEach(item => { item.x += item.vx * dt; item.y += item.vy * dt; item.life -= dt; });
      sparks = sparks.filter(item => item.life > 0);
      hitFlash = Math.max(0, hitFlash - dt);
      if (state !== 'play') return;

      const direction = Number(held.right) - Number(held.left);
      player.x = clamp(player.x + direction * player.speed * dt, 13, WIDTH - 13);
      shootTimer = Math.max(0, shootTimer - dt);
      if (held.fire) fire();

      shots.forEach(shot => { shot.x += shot.vx * dt; shot.y += shot.vy * dt; });
      enemyShots.forEach(shot => { shot.y += shot.vy * dt; });
      drops.forEach(drop => { drop.y += drop.vy * dt; });
      updateEnemies(dt);

      for (const shot of shots) {
        const shotBox = { x: shot.x - 1, y: shot.y - 4, w: 3, h: 7 };
        const enemy = enemies.find(item => rectHit(shotBox, item));
        if (!enemy) continue;
        shot.dead = true;
        enemy.hp -= 1;
        spark(shot.x, shot.y, enemy.type === 0 ? '#ff6b83' : '#7bffca', 5);
        if (enemy.hp <= 0) {
          enemy.dead = true;
          score += 60 + enemy.type * 20 + wave * 5;
          dropCore(enemy);
          services.tone(460 + enemy.type * 90, 0.025);
          saveRecords();
        }
      }
      shots = shots.filter(shot => !shot.dead && shot.y > 20 && shot.x > 0 && shot.x < WIDTH);
      enemies = enemies.filter(enemy => !enemy.dead);

      const playerBox = { x: player.x - 8, y: player.y - 5, w: 16, h: 11 };
      for (const shot of enemyShots) {
        if (rectHit({ x: shot.x - 2, y: shot.y - 2, w: 4, h: 7 }, playerBox)) {
          shot.dead = true;
          damagePlayer();
          break;
        }
      }
      enemyShots = enemyShots.filter(shot => !shot.dead && shot.y < HEIGHT + 8);

      drops = drops.filter(drop => {
        if (rectHit({ x: drop.x - 5, y: drop.y - 5, w: 10, h: 10 }, playerBox)) {
          collectCore(drop.type);
          return false;
        }
        return drop.y < HEIGHT + 8;
      });

      if (!enemies.length) finishWave();
      updateHud();
    }

    function drawEnemy(enemy) {
      const colors = ['#ff6b83', '#ffb55f', '#8c7dff'];
      ctx.fillStyle = colors[enemy.type];
      ctx.fillRect(enemy.x + 3, enemy.y, 9, 3);
      ctx.fillRect(enemy.x, enemy.y + 3, 15, 5);
      ctx.fillRect(enemy.x + 2, enemy.y + 8, 3, 2);
      ctx.fillRect(enemy.x + 10, enemy.y + 8, 3, 2);
      ctx.fillStyle = '#070914';
      ctx.fillRect(enemy.x + 3, enemy.y + 4, 2, 2);
      ctx.fillRect(enemy.x + 10, enemy.y + 4, 2, 2);
      if (enemy.hp > 1) {
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(enemy.x - 1.5, enemy.y - 1.5, 18, 13);
      }
    }

    function drawPlayer() {
      const shielded = performance.now() < shieldUntil;
      if (shielded) {
        ctx.strokeStyle = '#7bffca';
        ctx.strokeRect(player.x - 13.5, player.y - 11.5, 27, 19);
      }
      ctx.fillStyle = '#d9f7ff';
      ctx.fillRect(player.x - 3, player.y - 8, 6, 13);
      ctx.fillRect(player.x - 10, player.y, 20, 5);
      ctx.fillStyle = '#5ce1e6';
      ctx.fillRect(player.x - 1, player.y - 5, 2, 7);
      ctx.fillStyle = '#ffdf6b';
      ctx.fillRect(player.x - 7, player.y + 5, 3, 3);
      ctx.fillRect(player.x + 4, player.y + 5, 3, 3);
    }

    function draw() {
      ctx.fillStyle = hitFlash > 0 ? '#28102d' : '#070914';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      stars.forEach(star => {
        ctx.fillStyle = star.size === 2 ? '#7bffca88' : '#ffffff55';
        ctx.fillRect(star.x, star.y, star.size, star.size);
      });

      enemies.forEach(drawEnemy);
      ctx.fillStyle = '#7bffca';
      shots.forEach(shot => ctx.fillRect(shot.x - 1, shot.y - 4, 3, 7));
      ctx.fillStyle = '#ff6b83';
      enemyShots.forEach(shot => ctx.fillRect(shot.x - 2, shot.y - 2, 4, 7));

      drops.forEach(drop => {
        const color = drop.type === 'R' ? '#ffdf6b' : drop.type === 'T' ? '#8c7dff' : '#7bffca';
        ctx.fillStyle = color;
        ctx.fillRect(drop.x - 5, drop.y - 5, 10, 10);
        ctx.fillStyle = '#070914';
        ctx.font = 'bold 7px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(drop.type, drop.x, drop.y + 3);
      });

      sparks.forEach(item => {
        ctx.globalAlpha = clamp(item.life * 2.5, 0, 1);
        ctx.fillStyle = item.color;
        ctx.fillRect(item.x, item.y, 2, 2);
      });
      ctx.globalAlpha = 1;
      if (player) drawPlayer();

      const active = [];
      if (performance.now() < rapidUntil) active.push('RAPID');
      if (performance.now() < spreadUntil) active.push('TRI-SHOT');
      if (performance.now() < shieldUntil) active.push('SHIELD');
      if (active.length) {
        ctx.fillStyle = '#7bffca';
        ctx.font = '7px Courier New';
        ctx.textAlign = 'left';
        ctx.fillText(active.join(' + '), 7, 233);
      }
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
        services.tone(600, 0.07);
      } else if (state === 'wave') {
        wave += 1;
        bombs = Math.min(3, bombs + (wave % 2 === 0 ? 1 : 0));
        buildWave();
        state = 'play';
        services.tone(820, 0.09);
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
      player.x = clamp((event.clientX - bounds.left) * (WIDTH / bounds.width), 13, WIDTH - 13);
    }

    return {
      async mount(host, providedServices) {
        services = providedServices;
        high = services.storage.get('astroDefender:highScore', 0);
        bestWave = services.storage.get('astroDefender:bestWave', 1);
        host.innerHTML = markup();
        root = host.firstElementChild;
        canvas = root.querySelector('canvas');
        ctx = createGameContext(canvas, WIDTH, HEIGHT);
        makeStars();
        resetGame();
        state = 'title';
        renderUi();
        previousTime = performance.now();
        frame = requestAnimationFrame(loop);

        root.addEventListener('click', event => {
          const action = event.target.closest?.('[data-astro]')?.dataset.astro;
          if (action === 'start') startOrAdvance();
          if (action === 'exit') services.exit();
          if (action === 'bomb') useBomb();
        });
        canvas.addEventListener('pointerdown', event => {
          pointerActive = true;
          movePointer(event);
          held.fire = true;
          if (state === 'play') fire();
          try { canvas.setPointerCapture?.(event.pointerId); } catch {}
        });
        canvas.addEventListener('pointermove', event => { if (pointerActive) movePointer(event); });
        canvas.addEventListener('pointerup', () => { pointerActive = false; held.fire = false; });
        canvas.addEventListener('pointercancel', () => { pointerActive = false; held.fire = false; });
      },
      input(key, down) {
        if (key === 'left' || key === 'right') { held[key] = down; return; }
        if (key === 'a') {
          held.fire = down;
          if (down && state === 'play') fire();
          else if (down && (state === 'title' || state === 'over' || state === 'wave')) startOrAdvance();
          return;
        }
        if (!down) return;
        if (key === 'b') useBomb();
        if (key === 'start') pause();
        if (key === 'select') services.exit();
      },
      setAuthority() {},
      unmount() {
        saveRecords();
        cancelAnimationFrame(frame);
        held.left = false;
        held.right = false;
        held.fire = false;
      }
    };
  }
};
