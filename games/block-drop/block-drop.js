import { createGameContext } from '../../js/render-utils.js?v=2.0.3';

const COLS = 10;
const ROWS = 18;
const CELL = 10;

const SHAPES = {
  I: [[1, 1, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  T: [[0, 1, 0], [1, 1, 1]],
  Z: [[1, 1, 0], [0, 1, 1]]
};

const COLORS = {
  I: '#66e6e0', J: '#6f8cff', L: '#ffad5c', O: '#ffe06a',
  S: '#62db7d', T: '#c879ef', Z: '#f16673'
};

function rotateMatrix(matrix) {
  return matrix[0].map((_, column) => matrix.map(row => row[column]).reverse());
}

function cellsFor(type, rotation) {
  let matrix = SHAPES[type].map(row => [...row]);
  for (let index = 0; index < rotation % 4; index += 1) matrix = rotateMatrix(matrix);
  const cells = [];
  matrix.forEach((row, y) => row.forEach((filled, x) => { if (filled) cells.push({ x, y }); }));
  return cells;
}

export default {
  id: 'block-drop',
  title: 'Block Drop',
  version: '0.9.0',
  create() {
    let root;
    let canvas;
    let ctx;
    let services;
    let timer = null;
    let authority = true;
    let state = 'title';
    let board = [];
    let current = null;
    let nextType = 'T';
    let bag = [];
    let score = 0;
    let lines = 0;
    let level = 1;
    let high = 0;

    const markup = () => `
      <div class="blockdrop-game">
        <div class="blockdrop-hud"><span>SCORE <b id="blockdrop-score">000000</b></span><span>HI <b id="blockdrop-hi">000000</b></span></div>
        <canvas width="300" height="200" aria-label="Block Drop game board"></canvas>
        <div class="blockdrop-overlay" id="blockdrop-overlay"><strong>BLOCK DROP</strong><small>STACK • CLEAR • SURVIVE</small><button data-blockdrop="start">START GAME</button><em>A / START</em></div>
        <button class="blockdrop-exit" data-blockdrop="exit" aria-label="Exit game">×</button>
        <div class="blockdrop-pause" id="blockdrop-pause" hidden>PAUSED</div>
      </div>`;

    function emptyBoard() {
      return Array.from({ length: ROWS }, () => Array(COLS).fill(''));
    }

    function shuffledBag() {
      const pieces = Object.keys(SHAPES);
      for (let index = pieces.length - 1; index > 0; index -= 1) {
        const target = Math.floor(Math.random() * (index + 1));
        [pieces[index], pieces[target]] = [pieces[target], pieces[index]];
      }
      return pieces;
    }

    function takePiece() {
      if (bag.length === 0) bag = shuffledBag();
      return bag.shift();
    }

    function snapshot() {
      return {
        state, score, lines, level, high, nextType,
        board: board.map(row => [...row]),
        current: current ? { ...current } : null,
        bag: [...bag]
      };
    }

    function publish() {
      if (authority) services.publishState(snapshot());
    }

    function collision(piece = current, offsetX = 0, offsetY = 0, rotation = piece?.rotation || 0) {
      if (!piece) return true;
      return cellsFor(piece.type, rotation).some(cell => {
        const x = piece.x + cell.x + offsetX;
        const y = piece.y + cell.y + offsetY;
        return x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x]);
      });
    }

    function spawnPiece() {
      const type = nextType || takePiece();
      nextType = takePiece();
      current = { type, rotation: 0, x: 3, y: 0 };
      if (collision()) gameOver();
    }

    function drawCell(x, y, color, size = CELL) {
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
      ctx.fillStyle = '#ffffff44';
      ctx.fillRect(x + 2, y + 2, size - 4, 1);
      ctx.fillRect(x + 2, y + 2, 1, size - 4);
      ctx.fillStyle = '#00000044';
      ctx.fillRect(x + 2, y + size - 3, size - 4, 1);
    }

    function draw() {
      ctx.fillStyle = '#12111f';
      ctx.fillRect(0, 0, 300, 200);

      const originX = 20;
      const originY = 10;
      ctx.fillStyle = '#0a0c14';
      ctx.fillRect(originX - 3, originY - 3, COLS * CELL + 6, ROWS * CELL + 6);
      ctx.strokeStyle = '#454263';
      ctx.strokeRect(originX - 2.5, originY - 2.5, COLS * CELL + 5, ROWS * CELL + 5);

      board.forEach((row, y) => row.forEach((type, x) => {
        if (type) drawCell(originX + x * CELL, originY + y * CELL, COLORS[type]);
        else {
          ctx.fillStyle = '#171927';
          ctx.fillRect(originX + x * CELL + 1, originY + y * CELL + 1, CELL - 2, CELL - 2);
        }
      }));

      if (current) {
        cellsFor(current.type, current.rotation).forEach(cell => {
          const y = current.y + cell.y;
          if (y >= 0) drawCell(originX + (current.x + cell.x) * CELL, originY + y * CELL, COLORS[current.type]);
        });
      }

      ctx.fillStyle = '#d9d5ef';
      ctx.font = 'bold 10px Courier New';
      ctx.fillText('NEXT', 156, 27);
      ctx.fillText(`LEVEL ${level}`, 156, 96);
      ctx.fillText(`LINES ${lines}`, 156, 116);
      ctx.fillStyle = '#232238';
      ctx.fillRect(151, 34, 68, 45);
      cellsFor(nextType, 0).forEach(cell => drawCell(164 + cell.x * 8, 42 + cell.y * 8, COLORS[nextType], 8));
      ctx.fillStyle = '#8d89a8';
      ctx.font = '8px Courier New';
      ctx.fillText('← → MOVE', 156, 145);
      ctx.fillText('↑ / A ROTATE', 156, 159);
      ctx.fillText('B HARD DROP', 156, 173);
      ctx.fillText('START PAUSE', 156, 187);
    }

    function updateHud() {
      root.querySelector('#blockdrop-score').textContent = String(score).padStart(6, '0');
      root.querySelector('#blockdrop-hi').textContent = String(high).padStart(6, '0');
    }

    function renderState() {
      updateHud();
      draw();
      const overlay = root.querySelector('#blockdrop-overlay');
      root.querySelector('#blockdrop-pause').hidden = state !== 'pause';
      if (state === 'title') {
        overlay.hidden = false;
        overlay.innerHTML = '<strong>BLOCK DROP</strong><small>STACK • CLEAR • SURVIVE</small><button data-blockdrop="start">START GAME</button><em>A / START</em>';
      } else if (state === 'over') {
        overlay.hidden = false;
        overlay.innerHTML = `<strong>STACK OVER</strong><small>SCORE ${String(score).padStart(6, '0')}</small><button data-blockdrop="start">RESTART</button><em>A / START</em>`;
      } else {
        overlay.hidden = true;
      }
    }

    function dropDelay() {
      return Math.max(90, 680 - (level - 1) * 58);
    }

    function schedule() {
      clearTimeout(timer);
      if (!authority || state !== 'play') return;
      timer = setTimeout(tick, dropDelay());
    }

    function merge() {
      cellsFor(current.type, current.rotation).forEach(cell => {
        const x = current.x + cell.x;
        const y = current.y + cell.y;
        if (y >= 0) board[y][x] = current.type;
      });
    }

    function clearLines() {
      let cleared = 0;
      for (let y = ROWS - 1; y >= 0; y -= 1) {
        if (board[y].every(Boolean)) {
          board.splice(y, 1);
          board.unshift(Array(COLS).fill(''));
          cleared += 1;
          y += 1;
        }
      }
      if (cleared) {
        const awards = [0, 100, 300, 500, 800];
        score += awards[cleared] * level;
        lines += cleared;
        level = 1 + Math.floor(lines / 10);
        high = Math.max(high, score);
        services.storage.set('blockDrop:highScore', high);
        services.tone(680 + cleared * 90, 0.09);
      }
    }

    function lockPiece() {
      merge();
      clearLines();
      spawnPiece();
    }

    function tick() {
      clearTimeout(timer);
      if (!authority || state !== 'play') return;
      if (!collision(current, 0, 1)) current.y += 1;
      else lockPiece();
      renderState();
      publish();
      schedule();
    }

    function reset() {
      board = emptyBoard();
      bag = shuffledBag();
      nextType = takePiece();
      score = 0;
      lines = 0;
      level = 1;
      current = null;
      spawnPiece();
    }

    function start() {
      if (!authority) return;
      reset();
      state = 'play';
      services.tone(520, 0.06);
      renderState();
      publish();
      schedule();
    }

    function gameOver() {
      state = 'over';
      clearTimeout(timer);
      high = Math.max(high, score);
      services.storage.set('blockDrop:highScore', high);
      services.tone(120, 0.26, 'sawtooth');
      renderState();
      publish();
    }

    function move(horizontal) {
      if (!authority || state !== 'play' || collision(current, horizontal, 0)) return;
      current.x += horizontal;
      services.tone(205, 0.018);
      renderState();
      publish();
    }

    function softDrop() {
      if (!authority || state !== 'play') return;
      if (!collision(current, 0, 1)) {
        current.y += 1;
        score += 1;
      } else lockPiece();
      renderState();
      publish();
      schedule();
    }

    function hardDrop() {
      if (!authority || state !== 'play') return;
      let distance = 0;
      while (!collision(current, 0, 1)) {
        current.y += 1;
        distance += 1;
      }
      score += distance * 2;
      services.tone(110, 0.045);
      lockPiece();
      renderState();
      publish();
      schedule();
    }

    function rotate() {
      if (!authority || state !== 'play') return;
      const rotation = (current.rotation + 1) % 4;
      const kick = [0, -1, 1, -2, 2].find(offset => !collision(current, offset, 0, rotation));
      if (kick === undefined) return;
      current.rotation = rotation;
      current.x += kick;
      services.tone(390, 0.025);
      renderState();
      publish();
    }

    function pause() {
      if (!authority) return;
      if (state === 'play') {
        state = 'pause';
        clearTimeout(timer);
      } else if (state === 'pause') {
        state = 'play';
        schedule();
      }
      services.tone(300, 0.04);
      renderState();
      publish();
    }

    return {
      async mount(host, providedServices) {
        services = providedServices;
        authority = services.isAuthority();
        high = services.storage.get('blockDrop:highScore', 0);
        board = emptyBoard();
        bag = shuffledBag();
        nextType = takePiece();
        current = { type: takePiece(), rotation: 0, x: 3, y: 0 };
        host.innerHTML = markup();
        root = host.firstElementChild;
        canvas = root.querySelector('canvas');
        ctx = createGameContext(canvas, 300, 200);
        renderState();
        root.addEventListener('click', event => {
          const action = event.target.dataset.blockdrop;
          if (action === 'start') services.requestInput('a');
          if (action === 'exit') services.requestInput('select');
        });
        publish();
      },
      input(key, down) {
        if (!down) return;
        if ((key === 'a' || key === 'start') && (state === 'title' || state === 'over')) { start(); return; }
        if (key === 'left') move(-1);
        if (key === 'right') move(1);
        if (key === 'down') softDrop();
        if (key === 'up' || key === 'a') rotate();
        if (key === 'b') hardDrop();
        if (key === 'start') pause();
        if (key === 'select') services.exit();
      },
      hydrate(remote) {
        if (!remote) return;
        clearTimeout(timer);
        state = remote.state || 'title';
        score = Number(remote.score) || 0;
        lines = Number(remote.lines) || 0;
        level = Number(remote.level) || 1;
        high = Number(remote.high) || 0;
        nextType = SHAPES[remote.nextType] ? remote.nextType : 'T';
        board = Array.isArray(remote.board) ? remote.board.map(row => [...row]) : emptyBoard();
        current = remote.current ? { ...remote.current } : null;
        bag = Array.isArray(remote.bag) ? [...remote.bag] : [];
        renderState();
        schedule();
      },
      setAuthority(value) {
        authority = Boolean(value);
        if (!authority) clearTimeout(timer);
        else schedule();
      },
      unmount() {
        clearTimeout(timer);
      }
    };
  }
};
