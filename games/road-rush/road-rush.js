const WIDTH = 320;
const HEIGHT = 240;
const ROAD_TOP = 42;
const PLAYER_Y = 202;
const CARS = [
  { name: 'CRIMSON', body: '#ff5f73', glass: '#8ee8ff' },
  { name: 'VOLT', body: '#ffe66d', glass: '#9f8cff' },
  { name: 'NEON', body: '#79f5c4', glass: '#ff8fc1' }
];
const UNLOCKS = [0, 20, 60];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default {
  id: 'road-rush',
  title: 'Road Rush',
  version: '1.0.0',
  create() {
    let root;
    let canvas;
    let ctx;
    let services;
    let frame = 0;
    let previousTime = 0;
    let state = 'title';
    let lane = 1;
    let playerX = 160;
    let traffic = [];
    let pickups = [];
    let distance = 0;
    let high = 0;
    let lives = 3;
    let boost = 100;
    let totalTokens = 0;
    let runTokens = 0;
    let carIndex = 0;
    let spawnTimer = 0;
    let invulnerable = 0;
    let shield = false;
    let boostHeld = false;
    let brakeHeld = false;
    let tapBoostUntil = 0;
    let roadOffset = 0;
    let flash = 0;

    const markup = () => `
      <div class="road-game">
        <canvas width="320" height="240" aria-label="Road Rush game field"></canvas>
        <div class="road-hud">
          <span>KM <b id="road-score">00000</b></span>
          <span>TOKENS <b id="road-tokens">000</b></span>
          <span>CAR <b id="road-lives">3</b></span>
          <span>HI <b id="road-hi">00000</b></span>
        </div>
        <div class="road-overlay" id="road-overlay">
          <strong>ROAD RUSH</strong>
          <small>DODGE TRAFFIC<br>COLLECT ROAD TOKENS</small>
          <button data-road="start">START ENGINE</button>
          <em>◀ ▶ LANE • A BOOST • B CAR</em>
        </div>
        <div class="road-pause" id="road-pause" hidden>PAUSED</div>
        <button class="road-exit" data-road="exit" aria-label="Exit game">×</button>
        <button class="road-boost" data-road="boost">BOOST <span id="road-boost">100</span></button>
      </div>`;

    function laneX(which, y = PLAYER_Y) {
      const spread = 19 + (y - ROAD_TOP) / (PLAYER_Y - ROAD_TOP) * 30;
      return WIDTH / 2 + (which - 1) * spread;
    }

    function save() {
      high = Math.max(high, Math.floor(distance));
      services.storage.set('roadRush:highScore', high);
      services.storage.set('roadRush:tokens', totalTokens);
      services.storage.set('roadRush:car', carIndex);
    }

    function updateHud() {
      root.querySelector('#road-score').textContent = String(Math.floor(distance)).padStart(5, '0');
      root.querySelector('#road-tokens').textContent = String(totalTokens).padStart(3, '0');
      root.querySelector('#road-lives').textContent = String(lives);
      root.querySelector('#road-hi').textContent = String(high).padStart(5, '0');
      root.querySelector('#road-boost').textContent = String(Math.floor(boost)).padStart(3, '0');
    }

    function showOverlay(title, copy, button, hint) {
      const overlay = root.querySelector('#road-overlay');
      overlay.hidden = false;
      overlay.innerHTML = `<strong>${title}</strong><small>${copy}</small><button data-road="start">${button}</button><em>${hint}</em>`;
    }

    function renderUi() {
      updateHud();
      root.querySelector('#road-pause').hidden = state !== 'pause';
      if (state === 'title') {
        const nextUnlock = UNLOCKS.find(value => value > totalTokens);
        showOverlay('ROAD RUSH', `${CARS[carIndex].name} • ${nextUnlock ? `NEXT CAR ${nextUnlock} TOKENS` : 'ALL CARS UNLOCKED'}`, 'START ENGINE', '◀ ▶ LANE • A BOOST • B CAR');
      } else if (state === 'over') {
        showOverlay('RIDE OVER', `DISTANCE ${Math.floor(distance)} KM<br>TOKENS FOUND ${runTokens}`, 'RACE AGAIN', 'A / START');
      } else {
        root.querySelector('#road-overlay').hidden = true;
      }
    }

    function reset() {
      lane = 1;
      playerX = laneX(lane);
      traffic = [];
      pickups = [];
      distance = 0;
      lives = 3;
      boost = 100;
      runTokens = 0;
      spawnTimer = 0.45;
      invulnerable = 0;
      shield = false;
      roadOffset = 0;
    }

    function start() {
      reset();
      state = 'play';
      services.tone(180, 0.08, 'sawtooth');
      renderUi();
    }

    function pause() {
      if (state === 'play') state = 'pause';
      else if (state === 'pause') state = 'play';
      else { start(); return; }
      services.tone(300, 0.04);
      renderUi();
    }

    function changeLane(delta) {
      if (state !== 'play') return;
      lane = clamp(lane + delta, 0, 2);
      services.tone(260 + lane * 35, 0.025);
    }

    function cycleCar() {
      if (state !== 'title') return;
      const unlocked = UNLOCKS.filter(value => value <= totalTokens).length;
      carIndex = (carIndex + 1) % unlocked;
      save();
      services.tone(640, 0.05);
      renderUi();
    }

    function spawnTraffic() {
      const occupied = traffic.filter(car => car.y < 85).map(car => car.lane);
      const available = [0, 1, 2].filter(value => !occupied.includes(value));
      if (!available.length) return;
      const trafficLane = available[Math.floor(Math.random() * available.length)];
      traffic.push({ lane: trafficLane, y: ROAD_TOP - 20, speed: 0.8 + Math.random() * 0.42, color: ['#6e7cff', '#ff9b54', '#d46eff'][Math.floor(Math.random() * 3)] });
      if (Math.random() < 0.5) {
        const pickupLane = [0, 1, 2].filter(value => value !== trafficLane)[Math.floor(Math.random() * 2)];
        pickups.push({ lane: pickupLane, y: ROAD_TOP - 45, type: Math.random() < 0.12 ? 'shield' : 'token' });
      }
    }

    function crash(car) {
      car.dead = true;
      if (shield) {
        shield = false;
        flash = 0.16;
        services.tone(420, 0.08);
        return;
      }
      lives -= 1;
      invulnerable = 1.4;
      flash = 0.28;
      services.tone(95, 0.22, 'sawtooth');
      if (lives <= 0) {
        state = 'over';
        save();
        renderUi();
      }
    }

    function update(dt) {
      flash = Math.max(0, flash - dt);
      if (state !== 'play') return;
      invulnerable = Math.max(0, invulnerable - dt);
      const boosting = (boostHeld || performance.now() < tapBoostUntil) && boost > 0;
      const braking = brakeHeld && !boosting;
      const baseSpeed = Math.min(190, 88 + distance * 0.045);
      const speed = baseSpeed * (boosting ? 1.55 : braking ? 0.68 : 1);
      if (boosting) boost = Math.max(0, boost - dt * 30);
      else boost = Math.min(100, boost + dt * 10);
      distance += speed * dt * 0.045;
      high = Math.max(high, Math.floor(distance));
      roadOffset = (roadOffset + speed * dt) % 36;
      playerX += (laneX(lane) - playerX) * Math.min(1, dt * 12);

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTraffic();
        spawnTimer = Math.max(0.48, 1.05 - distance * 0.0015) + Math.random() * 0.28;
      }

      traffic.forEach(car => { car.y += speed * car.speed * dt; });
      pickups.forEach(item => { item.y += speed * 0.95 * dt; });

      for (const car of traffic) {
        if (!car.dead && invulnerable <= 0 && car.lane === lane && Math.abs(car.y - PLAYER_Y) < 17) crash(car);
      }
      traffic = traffic.filter(car => !car.dead && car.y < HEIGHT + 25);

      pickups = pickups.filter(item => {
        if (item.lane === lane && Math.abs(item.y - PLAYER_Y) < 16) {
          if (item.type === 'token') {
            totalTokens += 1;
            runTokens += 1;
            services.tone(920, 0.055);
          } else {
            shield = true;
            services.tone(700, 0.09);
          }
          save();
          return false;
        }
        return item.y < HEIGHT + 15;
      });
      updateHud();
    }

    function drawRoad() {
      ctx.fillStyle = flash > 0 ? '#5a2831' : '#27436a';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#6dad69';
      ctx.fillRect(0, ROAD_TOP, WIDTH, HEIGHT - ROAD_TOP);
      ctx.fillStyle = '#343b4b';
      ctx.beginPath();
      ctx.moveTo(135, ROAD_TOP);
      ctx.lineTo(46, HEIGHT);
      ctx.lineTo(274, HEIGHT);
      ctx.lineTo(185, ROAD_TOP);
      ctx.fill();
      ctx.fillStyle = '#f3e8c8';
      ctx.fillRect(132, ROAD_TOP, 3, 6);
      ctx.fillRect(185, ROAD_TOP, 3, 6);
      for (let step = -1; step < 8; step += 1) {
        const y = ROAD_TOP + ((step * 36 + roadOffset) % 252);
        if (y < ROAD_TOP || y > HEIGHT) continue;
        const scale = (y - ROAD_TOP) / (HEIGHT - ROAD_TOP);
        const h = 4 + scale * 11;
        ctx.fillStyle = '#f6f0d6';
        [0.5, 1.5].forEach(divider => {
          const x = WIDTH / 2 + (divider - 1) * (38 + scale * 58);
          ctx.fillRect(x - 1 - scale, y, 2 + scale * 2, h);
        });
      }
      ctx.fillStyle = '#ffffff55';
      for (let index = 0; index < 6; index += 1) {
        const y = 55 + index * 31;
        ctx.fillRect(24, y, 5, 2);
        ctx.fillRect(291, y + 12, 5, 2);
      }
    }

    function drawCar(x, y, color, player = false) {
      const scale = player ? 1 : clamp(0.45 + (y - ROAD_TOP) / 230, 0.45, 1);
      const w = 17 * scale;
      const h = 25 * scale;
      ctx.fillStyle = color;
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.fillStyle = player ? CARS[carIndex].glass : '#9bd8e8';
      ctx.fillRect(x - w * 0.31, y - h * 0.27, w * 0.62, h * 0.28);
      ctx.fillStyle = '#111827';
      ctx.fillRect(x - w * 0.62, y - h * 0.3, w * 0.18, h * 0.35);
      ctx.fillRect(x + w * 0.44, y - h * 0.3, w * 0.18, h * 0.35);
      ctx.fillStyle = '#ffe66d';
      ctx.fillRect(x - w * 0.33, y - h * 0.48, w * 0.18, 2);
      ctx.fillRect(x + w * 0.15, y - h * 0.48, w * 0.18, 2);
    }

    function draw() {
      drawRoad();
      traffic.forEach(car => drawCar(laneX(car.lane, car.y), car.y, car.color));
      pickups.forEach(item => {
        const x = laneX(item.lane, item.y);
        if (item.type === 'token') {
          ctx.fillStyle = '#ffe66d';
          ctx.fillRect(x - 5, item.y - 6, 10, 12);
          ctx.fillStyle = '#ff9b54';
          ctx.fillRect(x - 1, item.y - 4, 2, 8);
        } else {
          ctx.strokeStyle = '#79f5c4';
          ctx.strokeRect(x - 6.5, item.y - 6.5, 13, 13);
          ctx.fillStyle = '#79f5c4';
          ctx.fillRect(x - 2, item.y - 4, 4, 8);
        }
      });
      if (!playerX) return;
      if (shield) {
        ctx.strokeStyle = '#79f5c4';
        ctx.strokeRect(playerX - 13.5, PLAYER_Y - 17.5, 27, 35);
      }
      if (invulnerable <= 0 || Math.floor(invulnerable * 10) % 2 === 0) drawCar(playerX, PLAYER_Y, CARS[carIndex].body, true);
      ctx.fillStyle = '#17263c';
      ctx.fillRect(7, 225, 72, 8);
      ctx.fillStyle = boost > 25 ? '#ffe66d' : '#ff5f73';
      ctx.fillRect(9, 227, boost * 0.68, 4);
      ctx.fillStyle = '#fff';
      ctx.font = '6px Courier New';
      ctx.fillText('BOOST', 9, 223);
    }

    function loop(time) {
      const dt = Math.min(0.034, (time - previousTime) / 1000 || 0);
      previousTime = time;
      update(dt);
      draw();
      frame = requestAnimationFrame(loop);
    }

    return {
      async mount(host, providedServices) {
        services = providedServices;
        high = services.storage.get('roadRush:highScore', 0);
        totalTokens = services.storage.get('roadRush:tokens', 0);
        carIndex = Math.min(services.storage.get('roadRush:car', 0), UNLOCKS.filter(value => value <= totalTokens).length - 1);
        host.innerHTML = markup();
        root = host.firstElementChild;
        canvas = root.querySelector('canvas');
        ctx = canvas.getContext('2d');
        reset();
        state = 'title';
        renderUi();
        previousTime = performance.now();
        frame = requestAnimationFrame(loop);
        root.addEventListener('click', event => {
          const action = event.target.closest?.('[data-road]')?.dataset.road;
          if (action === 'start') start();
          if (action === 'exit') services.exit();
          if (action === 'boost' && state === 'play') tapBoostUntil = performance.now() + 900;
        });
        canvas.addEventListener('pointerdown', event => {
          if (state !== 'play') return;
          const bounds = canvas.getBoundingClientRect();
          const x = (event.clientX - bounds.left) * (WIDTH / bounds.width);
          if (x < WIDTH / 2 - 15) changeLane(-1);
          else if (x > WIDTH / 2 + 15) changeLane(1);
          else tapBoostUntil = performance.now() + 700;
        });
      },
      input(key, down) {
        if (key === 'a') { boostHeld = down; if (down && (state === 'title' || state === 'over')) start(); return; }
        if (key === 'down') { brakeHeld = down; return; }
        if (!down) return;
        if (key === 'left') changeLane(-1);
        if (key === 'right') changeLane(1);
        if (key === 'b') cycleCar();
        if (key === 'start') pause();
        if (key === 'select') services.exit();
      },
      setAuthority() {},
      unmount() {
        save();
        cancelAnimationFrame(frame);
        boostHeld = false;
        brakeHeld = false;
      }
    };
  }
};
