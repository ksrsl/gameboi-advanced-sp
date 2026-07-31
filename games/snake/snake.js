const WIDTH = 30;
const HEIGHT = 20;
const CELL = 10;

export default {
  id: 'snake',
  title: 'Snake Byte',
  version: '1.1.0',
  create() {
    let root;
    let canvas;
    let ctx;
    let services;
    let timer = null;
    let authority = true;
    let state = 'title';
    let score = 0;
    let high = 0;
    let snake = [];
    let food = {};
    let direction = { x: 1, y: 0 };
    let nextDirection = { x: 1, y: 0 };
    let speed = 145;

    const markup = () => `
      <div class="snake-game">
        <div class="snake-hud"><span>SCORE <b id="snake-score">0000</b></span><span>HI <b id="snake-hi">0000</b></span></div>
        <canvas width="300" height="200" aria-label="Snake game board"></canvas>
        <div class="snake-overlay" id="snake-overlay"><strong>SNAKE BYTE</strong><small>THE NEON GARDEN</small><button data-snake="start">START GAME</button><em>START / A</em></div>
        <button class="snake-exit" data-snake="exit" aria-label="Exit game">×</button>
        <div class="snake-pause" id="snake-pause" hidden>PAUSED</div>
      </div>`;

    function snapshot() {
      return {
        state, score, high, speed,
        snake: snake.map(part => ({ ...part })),
        food: { ...food },
        direction: { ...direction },
        nextDirection: { ...nextDirection }
      };
    }

    function publish() {
      if (authority) services.publishState(snapshot());
    }

    function updateHud() {
      root.querySelector('#snake-score').textContent = String(score).padStart(4, '0');
      root.querySelector('#snake-hi').textContent = String(high).padStart(4, '0');
    }

    function spawnFood() {
      do {
        food = { x: Math.floor(Math.random() * WIDTH), y: Math.floor(Math.random() * HEIGHT) };
      } while (snake.some(part => part.x === food.x && part.y === food.y));
    }

    function reset() {
      score = 0;
      speed = 145;
      snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
      direction = nextDirection = { x: 1, y: 0 };
      spawnFood();
      updateHud();
    }

    function draw() {
      ctx.fillStyle = '#101b18';
      ctx.fillRect(0, 0, 300, 200);
      ctx.fillStyle = '#182721';
      for (let x = 0; x < WIDTH; x += 2) {
        for (let y = 0; y < HEIGHT; y += 2) ctx.fillRect(x * CELL, y * CELL, 1, 1);
      }
      ctx.fillStyle = '#ffcf4a';
      ctx.fillRect(food.x * CELL + 2, food.y * CELL + 2, 6, 6);
      snake.forEach((part, index) => {
        ctx.fillStyle = index ? '#43b967' : '#9af5aa';
        ctx.fillRect(part.x * CELL + 1, part.y * CELL + 1, 8, 8);
      });
    }

    function renderState() {
      updateHud();
      draw();
      const overlay = root.querySelector('#snake-overlay');
      const paused = root.querySelector('#snake-pause');
      paused.hidden = state !== 'pause';
      if (state === 'title') {
        overlay.hidden = false;
        overlay.innerHTML = '<strong>SNAKE BYTE</strong><small>THE NEON GARDEN</small><button data-snake="start">START GAME</button><em>START / A</em>';
      } else if (state === 'over') {
        overlay.hidden = false;
        overlay.innerHTML = `<strong>GAME OVER</strong><small>SCORE ${String(score).padStart(4, '0')}</small><button data-snake="start">RESTART</button><em>A / START</em>`;
      } else {
        overlay.hidden = true;
      }
    }

    function scheduleLoop() {
      clearTimeout(timer);
      if (!authority || state !== 'play') return;
      timer = setTimeout(loop, speed);
    }

    function loop() {
      clearTimeout(timer);
      if (!authority || state !== 'play') return;
      direction = nextDirection;
      const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

      if (head.x < 0 || head.x >= WIDTH || head.y < 0 || head.y >= HEIGHT || snake.some(part => part.x === head.x && part.y === head.y)) {
        gameOver();
        return;
      }

      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 10;
        high = Math.max(high, score);
        services.storage.set('snake:highScore', high);
        speed = Math.max(55, 145 - Math.floor(score / 40) * 10);
        spawnFood();
        services.tone(760, 0.045);
      } else {
        snake.pop();
      }

      renderState();
      publish();
      scheduleLoop();
    }

    function start() {
      if (!authority) return;
      reset();
      state = 'play';
      services.tone(520, 0.06);
      renderState();
      publish();
      scheduleLoop();
    }

    function gameOver() {
      state = 'over';
      clearTimeout(timer);
      high = Math.max(high, score);
      services.storage.set('snake:highScore', high);
      services.tone(150, 0.22, 'sawtooth');
      renderState();
      publish();
    }

    function pause() {
      if (!authority) return;
      if (state === 'play') {
        state = 'pause';
        clearTimeout(timer);
        services.tone(300, 0.04);
      } else if (state === 'pause') {
        state = 'play';
        scheduleLoop();
      }
      renderState();
      publish();
    }

    function move(x, y) {
      if (!authority || state !== 'play') return;
      if (x !== -direction.x || y !== -direction.y) nextDirection = { x, y };
    }

    return {
      async mount(host, providedServices) {
        services = providedServices;
        authority = services.isAuthority();
        high = services.storage.get('snake:highScore', 0);
        host.innerHTML = markup();
        root = host.firstElementChild;
        canvas = root.querySelector('canvas');
        ctx = canvas.getContext('2d');
        reset();
        renderState();
        root.addEventListener('click', event => {
          const action = event.target.dataset.snake;
          if (action === 'start') services.requestInput('a');
          if (action === 'exit') services.requestInput('select');
        });
        publish();
      },
      input(key, down) {
        if (!down) return;
        if (key === 'up') move(0, -1);
        if (key === 'down') move(0, 1);
        if (key === 'left') move(-1, 0);
        if (key === 'right') move(1, 0);
        if ((key === 'a' || key === 'start') && (state === 'title' || state === 'over')) start();
        else if (key === 'start' && state !== 'title' && state !== 'over') pause();
        if (key === 'select' || (key === 'b' && state !== 'play')) services.exit();
      },
      hydrate(remote) {
        if (!remote) return;
        clearTimeout(timer);
        state = remote.state || 'title';
        score = Number(remote.score) || 0;
        high = Number(remote.high) || 0;
        speed = Number(remote.speed) || 145;
        snake = Array.isArray(remote.snake) ? remote.snake.map(part => ({ x: part.x, y: part.y })) : [];
        food = remote.food ? { x: remote.food.x, y: remote.food.y } : { x: 5, y: 5 };
        direction = remote.direction ? { ...remote.direction } : { x: 1, y: 0 };
        nextDirection = remote.nextDirection ? { ...remote.nextDirection } : { ...direction };
        renderState();
        scheduleLoop();
      },
      setAuthority(value) {
        authority = Boolean(value);
        if (!authority) clearTimeout(timer);
        else scheduleLoop();
      },
      unmount() {
        clearTimeout(timer);
      }
    };
  }
};
