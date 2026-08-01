import { createGameContext, safeDelta, smoothToward } from '../../js/render-utils.js?v=3.0.0';

const WIDTH = 320;
const HEIGHT = 240;
const HORIZON = 48;
const PLAYER_Y = 202;
const CARS = [
  { name: 'KSR WHITE', body: '#f5f6f7', trim: '#bcc4ce', glass: '#8db5cf' },
  { name: 'KSR ONYX', body: '#17191d', trim: '#6f7884', glass: '#a7c9dd' },
  { name: 'KSR SILVER', body: '#aeb5bf', trim: '#f4f6f8', glass: '#6d91aa' }
];
const TRAFFIC_COLORS = ['#e8eaed', '#707984', '#30343b', '#b8bec7'];
const UNLOCKS = [0, 20, 60];
const SKYLINE = [19, 31, 22, 42, 27, 36, 18, 48, 30, 25, 40, 20, 34, 27, 45, 24, 32, 21];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default {
  id: 'road-rush',
  title: 'Road Rush',
  version: '2.0.0',
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
    let playerTilt = 0;
    let traffic = [];
    let pickups = [];
    let particles = [];
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
    let shake = 0;

    const markup = () => `
      <div class="road-game">
        <canvas width="640" height="480" aria-label="Road Rush game field"></canvas>
        <div class="road-hud">
          <span>KM <b id="road-score">00000</b></span>
          <span>TOKENS <b id="road-tokens">000</b></span>
          <span>LIFE <b id="road-lives">3</b></span>
          <span>HI <b id="road-hi">00000</b></span>
        </div>
        <div class="road-overlay" id="road-overlay">
          <strong>ROAD RUSH</strong>
          <small>PREMIUM NIGHT CIRCUIT<br>DODGE TRAFFIC · COLLECT TOKENS</small>
          <button data-road="start">START ENGINE</button>
          <em>◀ ▶ STEER · A BOOST · B CAR</em>
        </div>
        <div class="road-pause" id="road-pause" hidden>PAUSED</div>
        <button class="road-exit" data-road="exit" aria-label="Exit game">×</button>
        <button class="road-boost" data-road="boost">BOOST <span id="road-boost">100</span></button>
      </div>`;

    function roadCurve() {
      return Math.sin(distance * 0.018) * 7 + Math.sin(distance * 0.0065) * 4;
    }

    function depthAt(y) {
      return clamp((y - HORIZON) / (PLAYER_Y - HORIZON), 0, 1.2);
    }

    function roadCenter(y) {
      const depth = depthAt(y);
      return WIDTH * 0.5 + roadCurve() * (0.12 + depth * 0.88);
    }

    function roadHalfWidth(y) {
      const depth = depthAt(y);
      return 25 + depth * 93;
    }

    function laneX(which, y = PLAYER_Y) {
      const laneCenterSpacing = roadHalfWidth(y) * (2 / 3);
      return roadCenter(y) + (which - 1) * laneCenterSpacing;
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
        const unlockCopy = nextUnlock ? `NEXT CAR ${nextUnlock} TOKENS` : 'ALL CARS UNLOCKED';
        showOverlay('ROAD RUSH', `${CARS[carIndex].name} · ${unlockCopy}`, 'START ENGINE', '◀ ▶ STEER · A BOOST · B CAR');
      } else if (state === 'over') {
        showOverlay('RUN COMPLETE', `DISTANCE ${Math.floor(distance)} KM<br>TOKENS FOUND ${runTokens}`, 'RACE AGAIN', 'A / START');
      } else {
        root.querySelector('#road-overlay').hidden = true;
      }
    }

    function reset() {
      lane = 1;
      playerX = laneX(lane);
      playerTilt = 0;
      traffic = [];
      pickups = [];
      particles = [];
      distance = 0;
      lives = 3;
      boost = 100;
      runTokens = 0;
      spawnTimer = 0.6;
      invulnerable = 0;
      shield = false;
      roadOffset = 0;
      shake = 0;
    }

    function start() {
      reset();
      state = 'play';
      services.tone(155, 0.07, 'sawtooth');
      setTimeout(() => services.tone(230, 0.06, 'triangle'), 65);
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
      const previousLane = lane;
      lane = clamp(lane + delta, 0, 2);
      if (lane !== previousLane) {
        playerTilt = delta * 0.18;
        services.tone(240 + lane * 38, 0.025, 'triangle');
      }
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
      const occupied = traffic.filter(car => car.y < 82).map(car => car.lane);
      const available = [0, 1, 2].filter(value => !occupied.includes(value));
      if (!available.length) return;

      const trafficLane = available[Math.floor(Math.random() * available.length)];
      traffic.push({
        lane: trafficLane,
        y: HORIZON - 18,
        speed: 0.82 + Math.random() * 0.35,
        color: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)]
      });

      if (Math.random() < 0.52) {
        const pickupLanes = [0, 1, 2].filter(value => value !== trafficLane);
        const pickupLane = pickupLanes[Math.floor(Math.random() * pickupLanes.length)];
        pickups.push({
          lane: pickupLane,
          y: HORIZON - 42,
          spin: Math.random() * Math.PI,
          type: Math.random() < 0.13 ? 'shield' : 'token'
        });
      }
    }

    function burst(x, y, color, amount = 12) {
      for (let index = 0; index < amount; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const force = 28 + Math.random() * 70;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * force,
          vy: Math.sin(angle) * force,
          life: 0.32 + Math.random() * 0.32,
          color,
          size: 1 + Math.random() * 2
        });
      }
    }

    function crash(car) {
      car.dead = true;
      const collisionX = laneX(car.lane, car.y);
      burst(collisionX, car.y, '#f7f8fa', 18);
      shake = 0.3;
      if (shield) {
        shield = false;
        flash = 0.14;
        services.tone(420, 0.08);
        return;
      }

      lives -= 1;
      invulnerable = 1.4;
      flash = 0.24;
      services.tone(95, 0.2, 'sawtooth');
      if (lives <= 0) {
        state = 'over';
        save();
        renderUi();
      }
    }

    function update(dt) {
      flash = Math.max(0, flash - dt);
      shake = Math.max(0, shake - dt);

      particles.forEach(particle => {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= Math.pow(0.04, dt);
        particle.vy *= Math.pow(0.1, dt);
        particle.life -= dt;
      });
      particles = particles.filter(particle => particle.life > 0);

      if (state !== 'play') return;
      invulnerable = Math.max(0, invulnerable - dt);
      const boosting = (boostHeld || performance.now() < tapBoostUntil) && boost > 0;
      const braking = brakeHeld && !boosting;
      const baseSpeed = Math.min(185, 82 + distance * 0.042);
      const speed = baseSpeed * (boosting ? 1.48 : braking ? 0.66 : 1);

      if (boosting) boost = Math.max(0, boost - dt * 28);
      else boost = Math.min(100, boost + dt * 11);

      distance += speed * dt * 0.045;
      high = Math.max(high, Math.floor(distance));
      roadOffset = (roadOffset + speed * dt) % 42;

      const targetX = laneX(lane);
      playerX = smoothToward(playerX, targetX, 10.5, dt);
      playerTilt = smoothToward(playerTilt, 0, 6.5, dt);

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTraffic();
        spawnTimer = Math.max(0.48, 1.08 - distance * 0.0016) + Math.random() * 0.28;
      }

      traffic.forEach(car => {
        const depth = depthAt(car.y);
        car.y += speed * car.speed * (0.48 + depth * 1.1) * dt;
      });
      pickups.forEach(item => {
        const depth = depthAt(item.y);
        item.y += speed * (0.5 + depth) * dt;
        item.spin += dt * 5;
      });

      for (const car of traffic) {
        if (car.dead || invulnerable > 0) continue;
        const carX = laneX(car.lane, car.y);
        if (Math.abs(car.y - PLAYER_Y) < 18 && Math.abs(carX - playerX) < 15) crash(car);
      }
      traffic = traffic.filter(car => !car.dead && car.y < HEIGHT + 32);

      pickups = pickups.filter(item => {
        const itemX = laneX(item.lane, item.y);
        if (Math.abs(item.y - PLAYER_Y) < 17 && Math.abs(itemX - playerX) < 16) {
          if (item.type === 'token') {
            totalTokens += 1;
            runTokens += 1;
            burst(itemX, item.y, '#ffffff', 8);
            services.tone(920, 0.055, 'triangle');
          } else {
            shield = true;
            burst(itemX, item.y, '#a8dcff', 10);
            services.tone(700, 0.09);
          }
          save();
          return false;
        }
        return item.y < HEIGHT + 20;
      });
      updateHud();
    }

    function drawSky() {
      const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 70);
      sky.addColorStop(0, flash > 0 ? '#291d22' : '#050608');
      sky.addColorStop(0.7, '#252930');
      sky.addColorStop(1, '#737b84');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const glow = ctx.createRadialGradient(160, 46, 1, 160, 46, 37);
      glow.addColorStop(0, '#ffffffdd');
      glow.addColorStop(0.22, '#dfe4eaaa');
      glow.addColorStop(1, '#ffffff00');
      ctx.fillStyle = glow;
      ctx.fillRect(116, 4, 88, 88);
      ctx.fillStyle = '#f5f6f7';
      ctx.beginPath();
      ctx.arc(160, 46, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0d0f12';
      let skylineX = -5;
      SKYLINE.forEach((height, index) => {
        const width = 13 + (index % 3) * 4;
        const top = HORIZON + 16 - height * 0.48;
        ctx.fillRect(skylineX, top, width, HORIZON + 19 - top);
        ctx.fillStyle = '#d8dde322';
        for (let wy = top + 5; wy < HORIZON + 12; wy += 7) {
          ctx.fillRect(skylineX + 4, wy, 2, 2);
          if (width > 16) ctx.fillRect(skylineX + 10, wy, 2, 2);
        }
        ctx.fillStyle = '#0d0f12';
        skylineX += width - 1;
      });
    }

    function drawRoad() {
      drawSky();

      const shoulder = ctx.createLinearGradient(0, HORIZON, 0, HEIGHT);
      shoulder.addColorStop(0, '#3f444a');
      shoulder.addColorStop(1, '#171a1e');
      ctx.fillStyle = shoulder;
      ctx.fillRect(0, HORIZON, WIDTH, HEIGHT - HORIZON);

      const topCenter = roadCenter(HORIZON);
      const bottomCenter = roadCenter(HEIGHT);
      const topHalf = roadHalfWidth(HORIZON);
      const bottomHalf = roadHalfWidth(HEIGHT);
      const road = ctx.createLinearGradient(0, HORIZON, 0, HEIGHT);
      road.addColorStop(0, '#24272c');
      road.addColorStop(1, '#090a0c');
      ctx.fillStyle = road;
      ctx.beginPath();
      ctx.moveTo(topCenter - topHalf, HORIZON);
      ctx.lineTo(bottomCenter - bottomHalf, HEIGHT);
      ctx.lineTo(bottomCenter + bottomHalf, HEIGHT);
      ctx.lineTo(topCenter + topHalf, HORIZON);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#e7eaed';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(topCenter - topHalf, HORIZON);
      ctx.lineTo(bottomCenter - bottomHalf, HEIGHT);
      ctx.moveTo(topCenter + topHalf, HORIZON);
      ctx.lineTo(bottomCenter + bottomHalf, HEIGHT);
      ctx.stroke();

      const markerPhase = roadOffset / 42;
      for (let step = -1; step <= 11; step += 1) {
        const worldDepth = (step + markerPhase) / 10;
        if (worldDepth < 0 || worldDepth > 1) continue;

        const perspectiveDepth = worldDepth * worldDepth;
        const y = HORIZON + perspectiveDepth * (HEIGHT - HORIZON);
        const markerHeight = 2 + perspectiveDepth * 17;
        const markerWidth = 0.8 + perspectiveDepth * 2.5;
        const y2 = Math.min(HEIGHT, y + markerHeight);
        ctx.fillStyle = '#f2f3f4';
        [0.5, 1.5].forEach(boundary => {
          const x1 = laneX(boundary, y);
          const x2 = laneX(boundary, y2);
          const nextWidth = markerWidth * (1 + perspectiveDepth * 0.18);
          ctx.beginPath();
          ctx.moveTo(x1 - markerWidth * 0.5, y);
          ctx.lineTo(x1 + markerWidth * 0.5, y);
          ctx.lineTo(x2 + nextWidth * 0.5, y2);
          ctx.lineTo(x2 - nextWidth * 0.5, y2);
          ctx.closePath();
          ctx.fill();
        });

        if (step % 2 === 0) {
          ctx.fillStyle = '#91b8cb';
          [-1, 1].forEach(side => {
            const edge1 = roadCenter(y) + roadHalfWidth(y) * side;
            const edge2 = roadCenter(y2) + roadHalfWidth(y2) * side;
            const stripWidth = 1 + perspectiveDepth * 3;
            ctx.beginPath();
            ctx.moveTo(edge1 - stripWidth * 0.5, y);
            ctx.lineTo(edge1 + stripWidth * 0.5, y);
            ctx.lineTo(edge2 + stripWidth * 0.6, y2);
            ctx.lineTo(edge2 - stripWidth * 0.6, y2);
            ctx.closePath();
            ctx.fill();
          });
        }
      }

      const boosting = (boostHeld || performance.now() < tapBoostUntil) && boost > 0 && state === 'play';
      if (boosting) {
        ctx.strokeStyle = '#ffffff44';
        ctx.lineWidth = 1;
        for (let index = 0; index < 13; index += 1) {
          const x = 8 + ((index * 29 + Math.floor(roadOffset * 3)) % 304);
          const y = 84 + ((index * 37 + roadOffset * 2) % 148);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (x < 160 ? -4 : 4), y + 13);
          ctx.stroke();
        }
      }
    }

    function drawCar(x, y, color, player = false, tilt = 0) {
      const depth = depthAt(y);
      const scale = player ? 1.08 : clamp(0.34 + depth * 0.78, 0.34, 1.08);
      const w = 19 * scale;
      const h = 30 * scale;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      ctx.fillStyle = '#00000088';
      ctx.beginPath();
      ctx.ellipse(0, h * 0.42, w * 0.72, h * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();

      const body = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
      body.addColorStop(0, '#0b0c0e');
      body.addColorStop(0.18, color);
      body.addColorStop(0.75, color);
      body.addColorStop(1, '#090a0b');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(-w * 0.36, -h * 0.5);
      ctx.quadraticCurveTo(-w * 0.58, -h * 0.18, -w * 0.55, h * 0.38);
      ctx.quadraticCurveTo(0, h * 0.55, w * 0.55, h * 0.38);
      ctx.quadraticCurveTo(w * 0.58, -h * 0.18, w * 0.36, -h * 0.5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = player ? CARS[carIndex].glass : '#7f9aaa';
      ctx.beginPath();
      ctx.moveTo(-w * 0.26, -h * 0.27);
      ctx.lineTo(w * 0.26, -h * 0.27);
      ctx.lineTo(w * 0.35, h * 0.02);
      ctx.lineTo(-w * 0.35, h * 0.02);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = player ? CARS[carIndex].trim : '#d9dde1';
      ctx.fillRect(-w * 0.04, -h * 0.48, w * 0.08, h * 0.77);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-w * 0.38, h * 0.25, w * 0.22, h * 0.09);
      ctx.fillRect(w * 0.16, h * 0.25, w * 0.22, h * 0.09);
      ctx.fillStyle = '#090a0b';
      ctx.fillRect(-w * 0.67, -h * 0.2, w * 0.16, h * 0.34);
      ctx.fillRect(w * 0.51, -h * 0.2, w * 0.16, h * 0.34);
      ctx.restore();
    }

    function drawPickup(item) {
      const x = laneX(item.lane, item.y);
      const scale = 0.45 + depthAt(item.y) * 0.7;
      ctx.save();
      ctx.translate(x, item.y);
      ctx.rotate(item.spin);
      ctx.scale(scale, scale);
      if (item.type === 'token') {
        ctx.fillStyle = '#ffffff22';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f5f6f7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#f5f6f7';
        ctx.fillRect(-1, -4, 2, 8);
      } else {
        ctx.strokeStyle = '#a8dcff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(8, -4);
        ctx.lineTo(6, 6);
        ctx.lineTo(0, 10);
        ctx.lineTo(-6, 6);
        ctx.lineTo(-8, -4);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }

    function draw() {
      ctx.save();
      if (shake > 0) {
        const amount = shake * 7;
        ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
      }

      drawRoad();
      traffic.forEach(car => drawCar(laneX(car.lane, car.y), car.y, car.color));
      pickups.forEach(drawPickup);

      if (playerX) {
        if (shield) {
          const glow = ctx.createRadialGradient(playerX, PLAYER_Y, 9, playerX, PLAYER_Y, 24);
          glow.addColorStop(0, '#9ed8ff11');
          glow.addColorStop(0.72, '#9ed8ff22');
          glow.addColorStop(1, '#9ed8ff00');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(playerX, PLAYER_Y, 24, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#a8dcff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(playerX, PLAYER_Y, 18, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (invulnerable <= 0 || Math.floor(invulnerable * 12) % 2 === 0) {
          drawCar(playerX, PLAYER_Y, CARS[carIndex].body, true, playerTilt);
        }
      }

      particles.forEach(particle => {
        ctx.globalAlpha = clamp(particle.life * 3, 0, 1);
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      });
      ctx.globalAlpha = 1;
      ctx.restore();

      ctx.fillStyle = '#060708dd';
      ctx.fillRect(7, 222, 76, 11);
      const boostGradient = ctx.createLinearGradient(9, 0, 77, 0);
      boostGradient.addColorStop(0, boost > 25 ? '#8e99a6' : '#8f4343');
      boostGradient.addColorStop(1, '#ffffff');
      ctx.fillStyle = boostGradient;
      ctx.fillRect(9, 226, boost * 0.68, 4);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 6px Courier New';
      ctx.fillText('BOOST', 9, 221);
    }

    function loop(time) {
      const dt = safeDelta(time, previousTime);
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
        carIndex = Math.min(
          services.storage.get('roadRush:car', 0),
          UNLOCKS.filter(value => value <= totalTokens).length - 1
        );
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
          const action = event.target.closest?.('[data-road]')?.dataset.road;
          if (action === 'start') start();
          if (action === 'exit') services.exit();
          if (action === 'boost' && state === 'play') tapBoostUntil = performance.now() + 900;
        });

        canvas.addEventListener('pointerdown', event => {
          if (state !== 'play') return;
          const bounds = canvas.getBoundingClientRect();
          const x = (event.clientX - bounds.left) * (WIDTH / bounds.width);
          if (x < WIDTH * 0.43) changeLane(-1);
          else if (x > WIDTH * 0.57) changeLane(1);
          else tapBoostUntil = performance.now() + 700;
        });
      },
      input(key, down) {
        if (key === 'a') {
          boostHeld = down;
          if (down && (state === 'title' || state === 'over')) start();
          return;
        }
        if (key === 'down') {
          brakeHeld = down;
          return;
        }
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
