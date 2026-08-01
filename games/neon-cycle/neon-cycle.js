import { createGameContext, safeDelta, smoothToward } from '../../js/render-utils.js?v=3.0.0';

const WIDTH = 320;
const HEIGHT = 240;
const GRID_WIDTH = 150;
const GRID_HEIGHT = 100;
const CELL = 10;
const DIRECTIONS = {
  up: { x: 0, y: -1, name: 'up' },
  right: { x: 1, y: 0, name: 'right' },
  down: { x: 0, y: 1, name: 'down' },
  left: { x: -1, y: 0, name: 'left' }
};
const RIDER_COLORS = ['#f8fbff', '#00ddff', '#ff45d0', '#ffd23f', '#8cff73', '#9d7cff', '#ff765b', '#5affcb'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const keyFor = (x, y) => `${x},${y}`;

export default {
  id: 'neon-cycle',
  title: 'Tron Cycle',
  version: '1.0.0',
  create() {
    let root;
    let canvas;
    let ctx;
    let services;
    let frame = 0;
    let timer = 0;
    let previousTime = 0;
    let moveStartedAt = 0;
    let state = 'title';
    let round = 1;
    let score = 0;
    let high = 0;
    let wins = 0;
    let boost = 100;
    let boostTicks = 0;
    let riders = [];
    let player = null;
    let nextDirection = DIRECTIONS.right;
    let occupied = new Set();
    let trailCells = [];
    let obstacleCells = new Set();
    let obstacleRects = [];
    let particles = [];
    let cameraX = 0;
    let cameraY = 0;
    let message = '';
    let messageTimer = 0;
    let flash = 0;

    const markup = () => `
      <div class="cycle-game">
        <canvas width="640" height="480" aria-label="Tron Cycle large light grid"></canvas>
        <div class="cycle-hud">
          <span>ROUND <b id="cycle-round">01</b></span>
          <span>ALIVE <b id="cycle-alive">08</b></span>
          <span>SCORE <b id="cycle-score">000000</b></span>
          <span>HI <b id="cycle-high">000000</b></span>
        </div>
        <div class="cycle-boost"><i id="cycle-boost"></i><span>BOOST</span></div>
        <div class="cycle-message" id="cycle-message"></div>
        <div class="cycle-overlay" id="cycle-overlay">
          <strong>TRON CYCLE</strong>
          <small>1500 x 1000 LIGHT GRID<br>YOU VS SEVEN CPU RIDERS</small>
          <button data-cycle="start">ENTER THE GRID</button>
          <em>D-PAD TURN - A BOOST - START PAUSE</em>
        </div>
        <div class="cycle-pause" id="cycle-pause" hidden>GRID PAUSED</div>
        <button class="cycle-exit" data-cycle="exit" aria-label="Exit game">X</button>
      </div>`;

    function tickDuration() {
      return Math.max(62, 88 - (round - 1) * 4);
    }

    function addObstacle(x, y, width, height) {
      obstacleRects.push({ x, y, width, height });
      for (let gridX = x; gridX < x + width; gridX += 1) {
        for (let gridY = y; gridY < y + height; gridY += 1) {
          obstacleCells.add(keyFor(gridX, gridY));
        }
      }
    }

    function buildArena() {
      obstacleCells = new Set();
      obstacleRects = [];
      addObstacle(69, 43, 12, 14);
      addObstacle(38, 24, 10, 8);
      addObstacle(102, 68, 10, 8);
      addObstacle(103, 22, 8, 11);
      addObstacle(40, 68, 8, 11);
      addObstacle(16, 43, 6, 14);
      addObstacle(128, 43, 6, 14);
      addObstacle(68, 9, 14, 5);
      addObstacle(68, 86, 14, 5);
    }

    function makeRider(index, x, y, direction) {
      return {
        index,
        name: index === 0 ? 'KSR' : `CPU-${index}`,
        color: RIDER_COLORS[index],
        x, y,
        previousX: x,
        previousY: y,
        direction,
        alive: true,
        cpu: index !== 0,
        think: index * .7,
        hunter: index % 3 === 1
      };
    }

    function addTrail(rider) {
      const key = keyFor(rider.x, rider.y);
      occupied.add(key);
      trailCells.push({ x: rider.x, y: rider.y, color: rider.color });
    }

    function resetRound() {
      occupied = new Set(obstacleCells);
      trailCells = [];
      particles = [];
      boost = 100;
      boostTicks = 0;
      nextDirection = DIRECTIONS.right;
      const starts = [
        [24, 50, DIRECTIONS.right],
        [135, 36, DIRECTIONS.left],
        [75, 18, DIRECTIONS.down],
        [75, 82, DIRECTIONS.up],
        [18, 18, DIRECTIONS.right],
        [132, 82, DIRECTIONS.left],
        [18, 82, DIRECTIONS.right],
        [132, 18, DIRECTIONS.left]
      ];
      riders = starts.map((start, index) => makeRider(index, start[0], start[1], start[2]));
      player = riders[0];
      riders.forEach(addTrail);
      cameraX = clamp(player.x * CELL - WIDTH / 2, 0, GRID_WIDTH * CELL - WIDTH);
      cameraY = clamp(player.y * CELL - HEIGHT / 2, 0, GRID_HEIGHT * CELL - HEIGHT);
      moveStartedAt = performance.now();
      message = `ROUND ${round} // 7 RIVALS`;
      messageTimer = 1.4;
      updateHud();
    }

    function updateHud() {
      if (!root) return;
      root.querySelector('#cycle-round').textContent = String(round).padStart(2, '0');
      root.querySelector('#cycle-alive').textContent = String(riders.filter(rider => rider.alive).length).padStart(2, '0');
      root.querySelector('#cycle-score').textContent = String(score).padStart(6, '0');
      root.querySelector('#cycle-high').textContent = String(high).padStart(6, '0');
      root.querySelector('#cycle-boost').style.width = `${boost}%`;
      root.querySelector('#cycle-message').textContent = message;
    }

    function showOverlay(title, copy, button) {
      const overlay = root.querySelector('#cycle-overlay');
      overlay.hidden = false;
      overlay.innerHTML = `<strong>${title}</strong><small>${copy}</small><button data-cycle="start">${button}</button><em>D-PAD TURN - A BOOST - START PAUSE</em>`;
    }

    function renderUi() {
      root.querySelector('#cycle-pause').hidden = state !== 'pause';
      if (state === 'title') {
        showOverlay('TRON CYCLE', `1500 x 1000 LIGHT GRID<br>8 RIDERS - RECORD ${String(high).padStart(6, '0')}`, 'ENTER THE GRID');
      } else if (state === 'over') {
        showOverlay('CYCLE ERASED', `SCORE ${String(score).padStart(6, '0')}<br>${riders.filter(rider => rider.alive && rider.cpu).length} RIVALS SURVIVED`, 'REBUILD CYCLE');
      } else if (state === 'win') {
        showOverlay('GRID CHAMPION', `ROUND ${round} CLEARED<br>${String(score).padStart(6, '0')} POINTS`, 'NEXT GRID');
      } else {
        root.querySelector('#cycle-overlay').hidden = true;
      }
      updateHud();
    }

    function start() {
      if (state === 'title' || state === 'over') {
        round = 1;
        score = 0;
      } else if (state === 'win') {
        round += 1;
      }
      resetRound();
      state = 'play';
      services.tone(180, .08, 'sawtooth');
      setTimeout(() => services.tone(440, .07, 'triangle'), 75);
      renderUi();
      message = 'GET READY';
      messageTimer = 1.25;
      updateHud();
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (state !== 'play') return;
        message = 'GO!';
        messageTimer = .55;
        moveStartedAt = performance.now();
        riders.forEach(rider => { rider.previousX = rider.x; rider.previousY = rider.y; });
        services.tone(760, .07, 'triangle');
        scheduleTick();
      }, 1200);
    }

    function isReverse(first, second) {
      return first.x === -second.x && first.y === -second.y;
    }

    function isBlocked(x, y) {
      return x < 1 || x >= GRID_WIDTH - 1 || y < 1 || y >= GRID_HEIGHT - 1 || occupied.has(keyFor(x, y));
    }

    function clearance(rider, direction, limit = 18) {
      let open = 0;
      for (let step = 1; step <= limit; step += 1) {
        const x = rider.x + direction.x * step;
        const y = rider.y + direction.y * step;
        if (isBlocked(x, y)) break;
        open += 1;
      }
      return open;
    }

    function chooseCpuDirection(rider) {
      rider.think -= 1;
      const forwardClearance = clearance(rider, rider.direction);
      const urgency = forwardClearance < 6 || rider.think <= 0 || Math.random() < .025 + round * .003;
      if (!urgency) return;

      const choices = Object.values(DIRECTIONS).filter(direction => !isReverse(direction, rider.direction));
      let bestDirection = rider.direction;
      let bestScore = -Infinity;
      choices.forEach(direction => {
        const nextX = rider.x + direction.x;
        const nextY = rider.y + direction.y;
        if (isBlocked(nextX, nextY)) return;
        const space = clearance(rider, direction, 22);
        const sideA = { x: -direction.y, y: direction.x };
        const sideB = { x: direction.y, y: -direction.x };
        const sideSpace = clearance({ ...rider, x: nextX, y: nextY }, sideA, 7)
          + clearance({ ...rider, x: nextX, y: nextY }, sideB, 7);
        const playerDistance = player?.alive ? Math.abs(nextX - player.x) + Math.abs(nextY - player.y) : 100;
        const pursuit = rider.hunter ? -playerDistance * .075 : playerDistance * .012;
        const straightBonus = direction === rider.direction ? 2.5 : 0;
        const value = space * 3 + sideSpace * .85 + pursuit + straightBonus + Math.random() * 5;
        if (value > bestScore) {
          bestScore = value;
          bestDirection = direction;
        }
      });
      rider.direction = bestDirection;
      rider.think = Math.max(2, 7 - round) + Math.floor(Math.random() * 5);
    }

    function currentPosition(rider, time = performance.now()) {
      const progress = state === 'play' ? clamp((time - moveStartedAt) / tickDuration(), 0, 1) : 1;
      return {
        x: rider.previousX + (rider.x - rider.previousX) * progress,
        y: rider.previousY + (rider.y - rider.previousY) * progress
      };
    }

    function burst(rider) {
      for (let index = 0; index < 18; index += 1) {
        particles.push({
          x: rider.x * CELL + CELL / 2,
          y: rider.y * CELL + CELL / 2,
          vx: (Math.random() - .5) * 105,
          vy: (Math.random() - .5) * 105,
          life: .35 + Math.random() * .55,
          color: rider.color
        });
      }
    }

    function crash(rider) {
      if (!rider.alive) return;
      rider.alive = false;
      burst(rider);
      flash = .12;
      if (rider.cpu) {
        score += 150 + round * 25;
        message = `${rider.name} ERASED`;
        messageTimer = .8;
        services.tone(520 + rider.index * 32, .055, 'square');
      } else {
        message = 'CYCLE ERASED';
        messageTimer = 1;
        services.tone(82, .2, 'sawtooth');
      }
    }

    function advance(activeRiders) {
      const plans = activeRiders.filter(rider => rider.alive).map(rider => ({
        rider,
        x: rider.x + rider.direction.x,
        y: rider.y + rider.direction.y
      }));
      const destinationCounts = new Map();
      plans.forEach(plan => {
        const key = keyFor(plan.x, plan.y);
        destinationCounts.set(key, (destinationCounts.get(key) || 0) + 1);
      });

      plans.forEach(plan => {
        const blocked = isBlocked(plan.x, plan.y);
        const pileup = destinationCounts.get(keyFor(plan.x, plan.y)) > 1;
        if (blocked || pileup) {
          crash(plan.rider);
          return;
        }
        plan.rider.x = plan.x;
        plan.rider.y = plan.y;
      });
      plans.forEach(plan => {
        if (plan.rider.alive) addTrail(plan.rider);
      });
    }

    function finishIfNeeded() {
      if (!player.alive) {
        state = 'over';
        high = Math.max(high, score);
        services.storage.set('neonCycle:highScore', high);
        clearTimeout(timer);
        renderUi();
        return true;
      }
      if (!riders.some(rider => rider.alive && rider.cpu)) {
        state = 'win';
        score += 1000 * round;
        high = Math.max(high, score);
        wins += 1;
        services.storage.set('neonCycle:highScore', high);
        services.storage.set('neonCycle:wins', wins);
        services.tone(860, .16, 'triangle');
        clearTimeout(timer);
        renderUi();
        return true;
      }
      return false;
    }

    function tick() {
      clearTimeout(timer);
      if (state !== 'play') return;
      const now = performance.now();
      riders.forEach(rider => {
        const position = currentPosition(rider, now);
        rider.previousX = position.x;
        rider.previousY = position.y;
      });
      if (!isReverse(nextDirection, player.direction)) player.direction = nextDirection;
      riders.filter(rider => rider.alive && rider.cpu).forEach(chooseCpuDirection);
      advance(riders);
      if (boostTicks > 0 && player.alive) {
        boostTicks -= 1;
        advance([player]);
      }
      moveStartedAt = now;
      score += player.alive ? 2 + (boostTicks > 0 ? 1 : 0) : 0;
      high = Math.max(high, score);
      updateHud();
      if (!finishIfNeeded()) scheduleTick();
    }

    function scheduleTick() {
      clearTimeout(timer);
      if (state !== 'play') return;
      timer = setTimeout(tick, tickDuration());
    }

    function steer(direction) {
      if (state !== 'play' || !player.alive || isReverse(direction, player.direction)) return;
      nextDirection = direction;
    }

    function activateBoost() {
      if (state !== 'play' || !player.alive) return;
      if (boost < 25 || boostTicks > 0) {
        services.tone(110, .025, 'square');
        return;
      }
      boost -= 25;
      boostTicks = 6;
      message = 'LIGHT BOOST';
      messageTimer = .65;
      services.tone(720, .08, 'sawtooth');
      updateHud();
    }

    function update(dt) {
      particles.forEach(particle => {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= Math.pow(.08, dt);
        particle.vy *= Math.pow(.08, dt);
        particle.life -= dt;
      });
      particles = particles.filter(particle => particle.life > 0);
      flash = Math.max(0, flash - dt);
      messageTimer = Math.max(0, messageTimer - dt);
      if (state === 'play') {
        boost = Math.min(100, boost + dt * 7);
        if (messageTimer <= 0) message = boostTicks > 0 ? 'BOOST ACTIVE' : 'CUT THE GRID';
      }
      const playerPosition = player ? currentPosition(player) : { x: 20, y: 50 };
      const targetCameraX = clamp(playerPosition.x * CELL - WIDTH / 2, 0, GRID_WIDTH * CELL - WIDTH);
      const targetCameraY = clamp(playerPosition.y * CELL - HEIGHT / 2, 0, GRID_HEIGHT * CELL - HEIGHT);
      cameraX = smoothToward(cameraX, targetCameraX, 10, dt);
      cameraY = smoothToward(cameraY, targetCameraY, 10, dt);
      updateHud();
    }

    function drawGrid() {
      ctx.fillStyle = flash > 0 ? '#172330' : '#03070b';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      const offsetX = -cameraX % CELL;
      const offsetY = -cameraY % CELL;
      ctx.strokeStyle = '#123245';
      ctx.lineWidth = .5;
      ctx.globalAlpha = .7;
      ctx.beginPath();
      for (let x = offsetX; x < WIDTH; x += CELL) { ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); }
      for (let y = offsetY; y < HEIGHT; y += CELL) { ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function drawArena() {
      obstacleRects.forEach(rect => {
        const x = rect.x * CELL - cameraX;
        const y = rect.y * CELL - cameraY;
        const width = rect.width * CELL;
        const height = rect.height * CELL;
        if (x > WIDTH || y > HEIGHT || x + width < 0 || y + height < 0) return;
        ctx.fillStyle = '#09141c';
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = '#2c7ca3';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + .75, y + .75, width - 1.5, height - 1.5);
        ctx.fillStyle = '#52d9ff22';
        for (let line = 6; line < width; line += 14) ctx.fillRect(x + line, y + 3, 2, height - 6);
      });

      ctx.strokeStyle = '#48dfff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-cameraX + CELL, -cameraY + CELL, (GRID_WIDTH - 2) * CELL, (GRID_HEIGHT - 2) * CELL);

      trailCells.forEach(cell => {
        const x = cell.x * CELL + CELL / 2 - cameraX;
        const y = cell.y * CELL + CELL / 2 - cameraY;
        if (x < -4 || x > WIDTH + 4 || y < -4 || y > HEIGHT + 4) return;
        ctx.fillStyle = cell.color;
        ctx.globalAlpha = .72;
        ctx.fillRect(x - 2, y - 2, 4, 4);
      });
      ctx.globalAlpha = 1;
    }

    function drawRider(rider) {
      if (!rider.alive) return;
      const position = currentPosition(rider);
      const x = position.x * CELL + CELL / 2 - cameraX;
      const y = position.y * CELL + CELL / 2 - cameraY;
      if (x < -12 || x > WIDTH + 12 || y < -12 || y > HEIGHT + 12) return;
      const angle = Math.atan2(rider.direction.y, rider.direction.x);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.shadowBlur = rider.index === 0 ? 12 : 7;
      ctx.shadowColor = rider.color;
      ctx.fillStyle = rider.color;
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-5, -4);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-5, 4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#030609';
      ctx.fillRect(-2, -1, 4, 2);
      ctx.restore();
    }

    function drawRadar() {
      const x = 245;
      const y = 31;
      const width = 68;
      const height = 45;
      ctx.fillStyle = '#020508d9';
      ctx.fillRect(x, y, width, height);
      ctx.strokeStyle = '#4f6f82';
      ctx.strokeRect(x + .5, y + .5, width - 1, height - 1);
      obstacleRects.forEach(rect => {
        ctx.fillStyle = '#315064';
        ctx.fillRect(x + rect.x / GRID_WIDTH * width, y + rect.y / GRID_HEIGHT * height,
          Math.max(1, rect.width / GRID_WIDTH * width), Math.max(1, rect.height / GRID_HEIGHT * height));
      });
      riders.filter(rider => rider.alive).forEach(rider => {
        ctx.fillStyle = rider.color;
        ctx.fillRect(x + rider.x / GRID_WIDTH * width - 1, y + rider.y / GRID_HEIGHT * height - 1, rider.index === 0 ? 3 : 2, rider.index === 0 ? 3 : 2);
      });
      ctx.fillStyle = '#9ab4c2';
      ctx.font = '4px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('1500 x 1000', x + 3, y + height - 3);
    }

    function draw() {
      drawGrid();
      drawArena();
      riders.forEach(drawRider);
      particles.forEach(particle => {
        const x = particle.x - cameraX;
        const y = particle.y - cameraY;
        ctx.globalAlpha = clamp(particle.life * 2, 0, 1);
        ctx.fillStyle = particle.color;
        ctx.fillRect(x, y, 2, 2);
      });
      ctx.globalAlpha = 1;
      drawRadar();
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
        high = services.storage.get('neonCycle:highScore', 0);
        wins = services.storage.get('neonCycle:wins', 0);
        host.innerHTML = markup();
        root = host.firstElementChild;
        canvas = root.querySelector('canvas');
        ctx = createGameContext(canvas, WIDTH, HEIGHT);
        buildArena();
        resetRound();
        state = 'title';
        renderUi();
        previousTime = performance.now();
        frame = requestAnimationFrame(loop);

        root.addEventListener('click', event => {
          const action = event.target.closest?.('[data-cycle]')?.dataset.cycle;
          if (action === 'start') start();
          if (action === 'exit') services.exit();
        });
        canvas.addEventListener('pointerdown', event => {
          if (state !== 'play') return;
          const rect = canvas.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - .5;
          const y = (event.clientY - rect.top) / rect.height - .5;
          if (Math.abs(x) > Math.abs(y)) steer(x > 0 ? DIRECTIONS.right : DIRECTIONS.left);
          else steer(y > 0 ? DIRECTIONS.down : DIRECTIONS.up);
        });
      },
      input(key, down) {
        if (!down) return;
        if ((key === 'a' || key === 'start') && (state === 'title' || state === 'over' || state === 'win')) start();
        else if (key === 'start') {
          if (state === 'play') {
            state = 'pause';
            clearTimeout(timer);
          } else if (state === 'pause') {
            state = 'play';
            moveStartedAt = performance.now();
            riders.forEach(rider => { rider.previousX = rider.x; rider.previousY = rider.y; });
            scheduleTick();
          }
          renderUi();
        } else if (state === 'play') {
          if (DIRECTIONS[key]) steer(DIRECTIONS[key]);
          if (key === 'a') activateBoost();
        }
        if (key === 'select') services.exit();
      },
      setAuthority() {},
      unmount() {
        clearTimeout(timer);
        cancelAnimationFrame(frame);
      }
    };
  }
};
