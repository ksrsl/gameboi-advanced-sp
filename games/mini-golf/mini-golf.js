import { createGameContext, safeDelta } from '../../js/render-utils.js?v=3.1.0';

const WIDTH = 320;
const HEIGHT = 240;
const COURSES = [
  { par: 2, start: [55, 194], hole: [263, 61], walls: [[105, 76, 18, 116], [195, 42, 18, 116]], sand: [[128, 164, 62, 27]], water: [] },
  { par: 3, start: [51, 61], hole: [269, 192], walls: [[78, 84, 153, 14], [78, 142, 153, 14]], sand: [], water: [[139, 99, 44, 42]] },
  { par: 3, start: [160, 198], hole: [160, 54], walls: [[55, 91, 92, 14], [173, 91, 92, 14], [94, 147, 132, 14]], sand: [[34, 46, 56, 42], [230, 46, 56, 42]], water: [] },
  { par: 4, start: [48, 190], hole: [273, 55], walls: [[82, 38, 14, 132], [82, 170, 128, 14], [196, 84, 14, 100], [210, 84, 70, 14]], sand: [[110, 54, 60, 27]], water: [[225, 117, 48, 39]] },
  { par: 4, start: [160, 198], hole: [160, 55], walls: [[57, 72, 83, 13], [180, 72, 83, 13], [98, 116, 124, 13], [57, 159, 83, 13], [180, 159, 83, 13]], sand: [[139, 132, 42, 24]], water: [[29, 92, 48, 47], [243, 92, 48, 47]] }
];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default {
  id: 'mini-golf', title: 'Mini Golf', version: '1.0.0',
  create() {
    let root, canvas, ctx, services, frame = 0, previousTime = 0;
    let state = 'title', courseIndex = 0, course, ball, aim = -0.7, power = 58;
    let strokes = 0, totalStrokes = 0, best = 0, message = '', advanceTimer = 0;

    const markup = () => `<div class="golf-game">
      <canvas width="640" height="480" aria-label="KSR Mini Golf course"></canvas>
      <div class="golf-hud"><span>HOLE <b id="golf-hole">1/5</b></span><span>PAR <b id="golf-par">2</b></span><span>SHOT <b id="golf-strokes">0</b></span><span>BEST <b id="golf-best">--</b></span></div>
      <div class="golf-message" id="golf-message"></div>
      <div class="golf-overlay" id="golf-overlay"><strong>MINI GOLF</strong><small>FIVE KSR COURSES<br>AIM · SET POWER · SHOOT</small><button data-golf="start">TEE OFF</button><em>◀ ▶ AIM · ▲ ▼ POWER · A SHOOT</em></div>
      <div class="golf-pause" id="golf-pause" hidden>PAUSED</div><button class="golf-exit" data-golf="exit" aria-label="Exit game">×</button>
    </div>`;

    const moving = () => Math.hypot(ball.vx, ball.vy) > 2;
    const inside = (x, y, rect, padding = 0) => x > rect[0] - padding && x < rect[0] + rect[2] + padding && y > rect[1] - padding && y < rect[1] + rect[3] + padding;

    function loadCourse(index) {
      courseIndex = index;
      course = COURSES[index];
      ball = { x: course.start[0], y: course.start[1], vx: 0, vy: 0, lastX: course.start[0], lastY: course.start[1] };
      strokes = 0;
      aim = Math.atan2(course.hole[1] - ball.y, course.hole[0] - ball.x);
      power = 58;
      message = `HOLE ${index + 1}`;
      advanceTimer = 0;
      updateHud();
    }

    function resetGame() { totalStrokes = 0; loadCourse(0); }

    function updateHud() {
      if (!root) return;
      root.querySelector('#golf-hole').textContent = `${courseIndex + 1}/5`;
      root.querySelector('#golf-par').textContent = course.par;
      root.querySelector('#golf-strokes').textContent = strokes;
      root.querySelector('#golf-best').textContent = best || '--';
      root.querySelector('#golf-message').textContent = message;
    }

    function showOverlay(title, copy, button) {
      const overlay = root.querySelector('#golf-overlay');
      overlay.hidden = false;
      overlay.innerHTML = `<strong>${title}</strong><small>${copy}</small><button data-golf="start">${button}</button><em>◀ ▶ AIM · ▲ ▼ POWER · A SHOOT</em>`;
    }

    function renderUi() {
      root.querySelector('#golf-pause').hidden = state !== 'pause';
      if (state === 'title') showOverlay('MINI GOLF', 'FIVE KSR COURSES<br>AIM · SET POWER · SHOOT', 'TEE OFF');
      else if (state === 'over') showOverlay('ROUND COMPLETE', `${totalStrokes} STROKES · PAR 16<br>${totalStrokes <= 16 ? 'KSR TOUR QUALITY' : 'KEEP PRACTICING'}`, 'PLAY AGAIN');
      else root.querySelector('#golf-overlay').hidden = true;
      updateHud();
    }

    function start() { resetGame(); state = 'play'; services.tone(520, .06, 'triangle'); renderUi(); }

    function shoot() {
      if (state !== 'play' || moving() || advanceTimer > 0) return;
      const speed = 70 + power * 2.25;
      ball.lastX = ball.x; ball.lastY = ball.y;
      ball.vx = Math.cos(aim) * speed; ball.vy = Math.sin(aim) * speed;
      strokes += 1; totalStrokes += 1; message = '';
      services.tone(170 + power * 2, .05, 'triangle'); updateHud();
    }

    function resetBall(penalty = true) {
      ball.x = ball.lastX; ball.y = ball.lastY; ball.vx = ball.vy = 0;
      if (penalty) { strokes += 1; totalStrokes += 1; message = 'PENALTY'; }
      updateHud();
    }

    function collideWalls(previousX, previousY) {
      const walls = [...course.walls, [21, 34, 278, 8], [21, 218, 278, 8], [21, 34, 8, 192], [291, 34, 8, 192]];
      walls.forEach(wall => {
        if (!inside(ball.x, ball.y, wall, 4)) return;
        const wasOutsideX = previousX <= wall[0] - 4 || previousX >= wall[0] + wall[2] + 4;
        if (wasOutsideX) { ball.x = previousX; ball.vx *= -.72; }
        else { ball.y = previousY; ball.vy *= -.72; }
        services.tone(250, .018);
      });
    }

    function finishHole() {
      if (advanceTimer > 0) return;
      advanceTimer = 1;
      message = strokes === 1 ? 'HOLE IN ONE!' : strokes <= course.par ? 'ON PAR!' : `+${strokes - course.par}`;
      ball.vx = ball.vy = 0;
      services.tone(820, .1, 'triangle'); updateHud();
    }

    function update(dt) {
      if (state !== 'play') return;
      if (advanceTimer > 0) {
        advanceTimer -= dt;
        if (advanceTimer <= 0) {
          if (courseIndex === COURSES.length - 1) {
            if (!best || totalStrokes < best) { best = totalStrokes; services.storage.set('miniGolf:bestScore', best); }
            state = 'over'; renderUi();
          } else loadCourse(courseIndex + 1);
        }
        return;
      }
      if (!moving()) { ball.vx = ball.vy = 0; return; }
      const previousX = ball.x, previousY = ball.y;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      collideWalls(previousX, previousY);
      const inSand = course.sand.some(rect => inside(ball.x, ball.y, rect));
      const drag = inSand ? .955 : .985;
      ball.vx *= Math.pow(drag, dt * 60); ball.vy *= Math.pow(drag, dt * 60);
      if (course.water.some(rect => inside(ball.x, ball.y, rect))) resetBall(true);
      if (Math.hypot(ball.x - course.hole[0], ball.y - course.hole[1]) < 6 && Math.hypot(ball.vx, ball.vy) < 58) finishHole();
    }

    function drawCourse() {
      ctx.fillStyle = '#07090a'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      const turf = ctx.createLinearGradient(0, 34, 0, 226); turf.addColorStop(0, '#405a53'); turf.addColorStop(1, '#172a26');
      ctx.fillStyle = turf; ctx.fillRect(21, 34, 278, 192);
      for (let stripe = 0; stripe < 10; stripe += 1) { ctx.fillStyle = stripe % 2 ? '#ffffff05' : '#00000008'; ctx.fillRect(22 + stripe * 28, 35, 28, 190); }
      course.sand.forEach(rect => { ctx.fillStyle = '#a99d80'; ctx.fillRect(...rect); ctx.fillStyle = '#ffffff18'; for (let x = rect[0] + 5; x < rect[0] + rect[2]; x += 9) ctx.fillRect(x, rect[1] + 6 + x % 11, 2, 2); });
      course.water.forEach(rect => { const water = ctx.createLinearGradient(rect[0], rect[1], rect[0], rect[1] + rect[3]); water.addColorStop(0, '#5a91ad'); water.addColorStop(1, '#1f536c'); ctx.fillStyle = water; ctx.fillRect(...rect); });
      ctx.fillStyle = '#171a1e'; course.walls.forEach(rect => { ctx.fillRect(...rect); ctx.strokeStyle = '#c8cdd2'; ctx.strokeRect(rect[0] + .5, rect[1] + .5, rect[2] - 1, rect[3] - 1); });
      ctx.fillStyle = '#020304'; ctx.beginPath(); ctx.arc(course.hole[0], course.hole[1], 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f7f8f9'; ctx.beginPath(); ctx.moveTo(course.hole[0], course.hole[1]); ctx.lineTo(course.hole[0], course.hole[1] - 19); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(course.hole[0], course.hole[1] - 19); ctx.lineTo(course.hole[0] + 12, course.hole[1] - 15); ctx.lineTo(course.hole[0], course.hole[1] - 11); ctx.fill();
    }

    function draw() {
      drawCourse();
      if (state === 'play' && !moving() && advanceTimer <= 0) {
        const length = 18 + power * .45;
        ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(ball.x + Math.cos(aim) * length, ball.y + Math.sin(aim) * length); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#08090acc'; ctx.fillRect(99, 226, 122, 9); ctx.fillStyle = '#fff'; ctx.fillRect(101, 228, power * 1.18, 5);
      }
      ctx.fillStyle = '#0007'; ctx.beginPath(); ctx.ellipse(ball.x + 2, ball.y + 3, 5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ball.x, ball.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#9ba3ac'; ctx.stroke();
    }

    function loop(time) { const dt = safeDelta(time, previousTime, .034); previousTime = time; update(dt); draw(); frame = requestAnimationFrame(loop); }

    return {
      async mount(host, providedServices) {
        services = providedServices; best = services.storage.get('miniGolf:bestScore', 0); host.innerHTML = markup(); root = host.firstElementChild;
        canvas = root.querySelector('canvas'); ctx = createGameContext(canvas, WIDTH, HEIGHT); resetGame(); renderUi(); previousTime = performance.now(); frame = requestAnimationFrame(loop);
        root.addEventListener('click', event => { const action = event.target.closest?.('[data-golf]')?.dataset.golf; if (action === 'start') start(); if (action === 'exit') services.exit(); });
        canvas.addEventListener('pointerdown', event => { if (state !== 'play' || moving()) return; const rect = canvas.getBoundingClientRect(); const x = (event.clientX - rect.left) * WIDTH / rect.width; const y = (event.clientY - rect.top) * HEIGHT / rect.height; aim = Math.atan2(y - ball.y, x - ball.x); power = clamp(Math.hypot(x - ball.x, y - ball.y) * .65, 20, 100); shoot(); });
      },
      input(key, down) { if (!down) return; if ((key === 'a' || key === 'start') && (state === 'title' || state === 'over')) start(); else if (key === 'start') { state = state === 'pause' ? 'play' : 'pause'; renderUi(); } else if (state === 'play' && !moving()) { if (key === 'left') aim -= .09; if (key === 'right') aim += .09; if (key === 'up') power = clamp(power + 7, 20, 100); if (key === 'down') power = clamp(power - 7, 20, 100); if (key === 'a') shoot(); if (key === 'b') resetBall(false); } if (key === 'select') services.exit(); },
      setAuthority() {}, unmount() { cancelAnimationFrame(frame); }
    };
  }
};
