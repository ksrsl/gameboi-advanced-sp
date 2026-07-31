import { createGameContext, safeDelta } from '../../js/render-utils.js?v=2.1.0';

const COLS = 21;
const ROWS = 15;
const TILE = 11;
const BOARD_X = 44.5;
const BOARD_Y = 42;
const MAP = [
  '#####################',
  '#.........#.........#',
  '#.###.###.#.###.###.#',
  '#o#.....#...#.....#o#',
  '#.#.###.#####.###.#.#',
  '#...................#',
  '#.###.#.#####.#.###.#',
  '#.....#...#...#.....#',
  '#####.###...###.#####',
  '#.....#.......#.....#',
  '#.###.#.#####.#.###.#',
  '#o..#...........#..o#',
  '###.#.###.#.###.#.###',
  '#.........#.........#',
  '#####################'
];
const DIRS = [
  { x: 1, y: 0, name: 'right' }, { x: 0, y: 1, name: 'down' },
  { x: -1, y: 0, name: 'left' }, { x: 0, y: -1, name: 'up' }
];
const DRONES = [
  { x: 9, y: 8, color: '#ff6f91', brain: 0 },
  { x: 10, y: 8, color: '#79d9ff', brain: 1 },
  { x: 11, y: 8, color: '#ffb45e', brain: 2 },
  { x: 10, y: 9, color: '#b99aff', brain: 3 }
];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default {
  id: 'maze-muncher',
  title: 'Maze Muncher',
  version: '1.0.0',
  create() {
    let root;
    let canvas;
    let ctx;
    let services;
    let frame = 0;
    let previousTime = 0;
    let state = 'title';
    let player;
    let drones = [];
    let pellets = new Set();
    let powerCores = new Set();
    let score = 0;
    let high = 0;
    let lives = 3;
    let level = 1;
    let powerTime = 0;
    let invulnerable = 0;

    const markup = () => `
      <div class="maze-game">
        <canvas width="640" height="480" aria-label="Maze Muncher game field"></canvas>
        <div class="maze-hud"><span>SCORE <b id="maze-score">000000</b></span><span>CORE <b id="maze-level">01</b></span><span>LIFE <b id="maze-lives">3</b></span><span>HI <b id="maze-hi">000000</b></span></div>
        <div class="maze-overlay" id="maze-overlay"><strong>MAZE MUNCHER</strong><small>COLLECT EVERY DATA BIT<br>POWER CORES DISABLE DRONES</small><button data-maze="start">ENTER GRID</button><em>D-PAD MOVE · START PAUSE</em></div>
        <div class="maze-pause" id="maze-pause" hidden>PAUSED</div>
        <button class="maze-exit" data-maze="exit" aria-label="Exit game">×</button>
      </div>`;

    const keyFor = (x, y) => `${x},${y}`;
    const isWall = (x, y) => MAP[Math.round(y)]?.[Math.round(x)] === '#';
    const nearCenter = actor => Math.abs(actor.x - Math.round(actor.x)) < 0.075 && Math.abs(actor.y - Math.round(actor.y)) < 0.075;

    function canMove(actor, direction, distance = 0.12) {
      const testX = actor.x + direction.x * (0.48 + distance);
      const testY = actor.y + direction.y * (0.48 + distance);
      return !isWall(testX, testY);
    }

    function resetActors() {
      player = { x: 10, y: 11, dir: DIRS[2], wanted: DIRS[2] };
      drones = DRONES.map((drone, index) => ({
        ...drone,
        homeX: drone.x,
        homeY: drone.y,
        dir: DIRS[index % DIRS.length],
        delay: 0.7 + index * 0.45
      }));
      powerTime = 0;
      invulnerable = 1.2;
    }

    function buildLevel() {
      pellets = new Set();
      powerCores = new Set();
      MAP.forEach((row, y) => [...row].forEach((cell, x) => {
        if (cell === '.') pellets.add(keyFor(x, y));
        if (cell === 'o') powerCores.add(keyFor(x, y));
      }));
      [keyFor(10, 11), ...DRONES.map(item => keyFor(item.x, item.y))].forEach(key => pellets.delete(key));
      resetActors();
    }

    function resetGame() {
      score = 0;
      lives = 3;
      level = 1;
      buildLevel();
    }

    function updateHud() {
      root.querySelector('#maze-score').textContent = String(score).padStart(6, '0');
      root.querySelector('#maze-level').textContent = String(level).padStart(2, '0');
      root.querySelector('#maze-lives').textContent = String(lives);
      root.querySelector('#maze-hi').textContent = String(high).padStart(6, '0');
    }

    function showOverlay(title, copy, button) {
      const overlay = root.querySelector('#maze-overlay');
      overlay.hidden = false;
      overlay.innerHTML = `<strong>${title}</strong><small>${copy}</small><button data-maze="start">${button}</button><em>D-PAD MOVE · START PAUSE</em>`;
    }

    function renderUi() {
      updateHud();
      root.querySelector('#maze-pause').hidden = state !== 'pause';
      if (state === 'title') showOverlay('MAZE MUNCHER', 'COLLECT EVERY DATA BIT<br>POWER CORES DISABLE DRONES', 'ENTER GRID');
      else if (state === 'over') showOverlay('GRID LOCKED', `SCORE ${String(score).padStart(6, '0')} · CORE ${level}`, 'REBOOT');
      else root.querySelector('#maze-overlay').hidden = true;
    }

    function start() {
      resetGame();
      state = 'play';
      services.tone(420, 0.06, 'triangle');
      renderUi();
    }

    function chooseDroneDirection(drone) {
      const reverse = { x: -drone.dir.x, y: -drone.dir.y };
      let options = DIRS.filter(dir => canMove(drone, dir, 0.02) && (dir.x !== reverse.x || dir.y !== reverse.y));
      if (!options.length) options = DIRS.filter(dir => canMove(drone, dir, 0.02));

      let targetX = player.x;
      let targetY = player.y;
      if (drone.brain === 1) {
        targetX += player.dir.x * 3;
        targetY += player.dir.y * 3;
      } else if (drone.brain === 2) {
        targetX = COLS - 1 - player.x;
        targetY = ROWS - 1 - player.y;
      }

      options.sort((a, b) => {
        const distanceA = Math.abs(drone.x + a.x - targetX) + Math.abs(drone.y + a.y - targetY);
        const distanceB = Math.abs(drone.x + b.x - targetX) + Math.abs(drone.y + b.y - targetY);
        if (powerTime > 0 || drone.brain === 3) return distanceB - distanceA;
        return distanceA - distanceB;
      });
      if (drone.brain === 2 && Math.random() < 0.35) return options[Math.floor(Math.random() * options.length)];
      return options[0] || drone.dir;
    }

    function moveActor(actor, speed, dt) {
      if (nearCenter(actor)) {
        actor.x = Math.round(actor.x);
        actor.y = Math.round(actor.y);
        if (actor.wanted && canMove(actor, actor.wanted, 0.01)) actor.dir = actor.wanted;
        if (!canMove(actor, actor.dir, 0.01)) return;
      }
      const step = speed * dt;
      if (canMove(actor, actor.dir, step)) {
        actor.x += actor.dir.x * step;
        actor.y += actor.dir.y * step;
      }
    }

    function collect() {
      if (!nearCenter(player)) return;
      const key = keyFor(Math.round(player.x), Math.round(player.y));
      if (pellets.delete(key)) {
        score += 10;
        services.tone(560 + (score % 20) * 8, 0.018, 'square');
      }
      if (powerCores.delete(key)) {
        score += 100;
        powerTime = 6;
        services.tone(820, 0.08, 'triangle');
      }
      high = Math.max(high, score);
      services.storage.set('mazeMuncher:highScore', high);
      if (!pellets.size && !powerCores.size) {
        level += 1;
        score += 500;
        buildLevel();
        services.tone(1040, 0.12, 'triangle');
      }
    }

    function collide() {
      if (invulnerable > 0) return;
      for (const drone of drones) {
        if (Math.hypot(player.x - drone.x, player.y - drone.y) > 0.62) continue;
        if (powerTime > 0) {
          score += 250;
          drone.x = drone.homeX;
          drone.y = drone.homeY;
          drone.delay = 1;
          services.tone(920, 0.07, 'triangle');
        } else {
          lives -= 1;
          services.tone(110, 0.2, 'sawtooth');
          if (lives <= 0) {
            state = 'over';
            renderUi();
          } else resetActors();
        }
        break;
      }
    }

    function update(dt) {
      if (state !== 'play') return;
      powerTime = Math.max(0, powerTime - dt);
      invulnerable = Math.max(0, invulnerable - dt);
      moveActor(player, 5.1 + level * 0.08, dt);
      collect();
      drones.forEach(drone => {
        if (drone.delay > 0) {
          drone.delay -= dt;
          return;
        }
        if (nearCenter(drone)) {
          drone.x = Math.round(drone.x);
          drone.y = Math.round(drone.y);
          drone.dir = chooseDroneDirection(drone);
        }
        moveActor(drone, (powerTime > 0 ? 3.15 : 3.75) + level * 0.13, dt);
      });
      collide();
      updateHud();
    }

    function drawMaze(time) {
      ctx.fillStyle = '#050607';
      ctx.fillRect(0, 0, 320, 240);
      MAP.forEach((row, y) => [...row].forEach((cell, x) => {
        const px = BOARD_X + x * TILE;
        const py = BOARD_Y + y * TILE;
        if (cell === '#') {
          ctx.fillStyle = '#181b20';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.strokeStyle = '#69737e';
          ctx.lineWidth = 0.7;
          ctx.strokeRect(px + 1.2, py + 1.2, TILE - 2.4, TILE - 2.4);
        }
      }));

      pellets.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        ctx.fillStyle = '#d9dde1';
        ctx.fillRect(BOARD_X + x * TILE + 4.5, BOARD_Y + y * TILE + 4.5, 2, 2);
      });
      powerCores.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        const pulse = 3 + Math.sin(time * 0.008) * 0.7;
        ctx.strokeStyle = '#87d7ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(BOARD_X + x * TILE + 5.5, BOARD_Y + y * TILE + 5.5, pulse, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    function drawActor(actor, color, drone = false, time = 0) {
      const x = BOARD_X + actor.x * TILE + 5.5;
      const y = BOARD_Y + actor.y * TILE + 5.5;
      ctx.save();
      ctx.translate(x, y);
      if (drone) {
        ctx.fillStyle = powerTime > 0 ? '#56616c' : color;
        ctx.rotate(time * 0.0015 + actor.brain);
        ctx.beginPath();
        for (let side = 0; side < 6; side += 1) {
          const angle = side * Math.PI / 3;
          const command = side ? 'lineTo' : 'moveTo';
          ctx[command](Math.cos(angle) * 4.4, Math.sin(angle) * 4.4);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#08090a';
        ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
      } else {
        const angle = Math.atan2(actor.dir.y, actor.dir.x);
        ctx.rotate(angle + Math.PI / 4);
        ctx.fillStyle = invulnerable > 0 && Math.floor(time / 90) % 2 ? '#737b84' : '#ffffff';
        ctx.fillRect(-4, -4, 8, 8);
        ctx.fillStyle = '#111317';
        ctx.fillRect(-1.3, -1.3, 2.6, 2.6);
      }
      ctx.restore();
    }

    function draw(time) {
      drawMaze(time);
      drones.forEach(drone => drawActor(drone, drone.color, true, time));
      drawActor(player, '#fff', false, time);
    }

    function loop(time) {
      const dt = safeDelta(time, previousTime, 0.034);
      previousTime = time;
      update(dt);
      draw(time);
      frame = requestAnimationFrame(loop);
    }

    function setDirection(name) {
      const direction = DIRS.find(item => item.name === name);
      if (direction) player.wanted = direction;
    }

    return {
      async mount(host, providedServices) {
        services = providedServices;
        high = services.storage.get('mazeMuncher:highScore', 0);
        host.innerHTML = markup();
        root = host.firstElementChild;
        canvas = root.querySelector('canvas');
        ctx = createGameContext(canvas, 320, 240);
        resetGame();
        renderUi();
        previousTime = performance.now();
        frame = requestAnimationFrame(loop);
        root.addEventListener('click', event => {
          const action = event.target.closest?.('[data-maze]')?.dataset.maze;
          if (action === 'start') start();
          if (action === 'exit') services.exit();
        });
        canvas.addEventListener('pointerdown', event => {
          if (state !== 'play') return;
          const rect = canvas.getBoundingClientRect();
          const x = event.clientX - rect.left - rect.width / 2;
          const y = event.clientY - rect.top - rect.height / 2;
          setDirection(Math.abs(x) > Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down'));
        });
      },
      input(key, down) {
        if (!down) return;
        if (['up', 'down', 'left', 'right'].includes(key)) setDirection(key);
        if ((key === 'a' || key === 'start') && (state === 'title' || state === 'over')) start();
        else if (key === 'start') {
          state = state === 'pause' ? 'play' : 'pause';
          renderUi();
        }
        if (key === 'select') services.exit();
      },
      setAuthority() {},
      unmount() { cancelAnimationFrame(frame); }
    };
  }
};
