import { createGameContext } from '../../js/render-utils.js?v=2.0.3';

const COLS = 12;
const ROWS = 9;
const CELL = 20;
const ORIGIN_X = 7;
const ORIGIN_Y = 31;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default {
  id: 'dungeon-byte',
  title: 'Dungeon Byte',
  version: '1.0.0',
  create() {
    let root;
    let canvas;
    let ctx;
    let services;
    let frame = 0;
    let state = 'intro';
    let returning = false;
    let map = [];
    let hero;
    let enemies = [];
    let loot = [];
    let exit = { x: 10, y: 7 };
    let floor = 1;
    let gold = 0;
    let potions = 1;
    let level = 1;
    let xp = 0;
    let weapon = 0;
    let bestFloor = 1;
    let highGold = 0;
    let log = 'THE TORCHES FLICKER...';

    const markup = () => `
      <div class="dungeon-game">
        <canvas width="320" height="240" aria-label="Dungeon Byte map"></canvas>
        <div class="dungeon-hud">
          <span>FLOOR <b id="dungeon-floor">01</b></span>
          <span>HP <b id="dungeon-hp">10/10</b></span>
          <span>GOLD <b id="dungeon-gold">000</b></span>
        </div>
        <div class="dungeon-side">
          LV <b id="dungeon-level">01</b><br>
          XP <b id="dungeon-xp">0/18</b><br>
          BLADE <b id="dungeon-weapon">+0</b><br>
          POTION <b id="dungeon-potions">1</b>
        </div>
        <div class="dungeon-log" id="dungeon-log">THE TORCHES FLICKER...</div>
        <button class="dungeon-potion" data-dungeon="potion">B USE POTION</button>
        <div class="dungeon-overlay" id="dungeon-overlay">
          <strong>DUNGEON BYTE</strong>
          <small>EXPLORE • BATTLE • LOOT<br>YOUR RUN SAVES EVERY TURN</small>
          <button data-dungeon="start">BEGIN RUN</button>
          <em>D-PAD MOVE • B POTION</em>
        </div>
        <button class="dungeon-exit" data-dungeon="exit" aria-label="Exit game">×</button>
      </div>`;

    function maxHp() { return 10 + (level - 1) * 2; }
    function xpTarget() { return 12 + level * 6; }

    function randomFloorCell(blocked = []) {
      for (let attempt = 0; attempt < 250; attempt += 1) {
        const x = 1 + Math.floor(Math.random() * (COLS - 2));
        const y = 1 + Math.floor(Math.random() * (ROWS - 2));
        if (map[y][x] === 0 && !blocked.some(item => item.x === x && item.y === y)) return { x, y };
      }
      return { x: 2, y: 2 };
    }

    function makeMap() {
      map = Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 ? 1 : 0)));
      for (let y = 2; y < ROWS - 1; y += 1) {
        for (let x = 2; x < COLS - 2; x += 1) {
          if (Math.random() < Math.min(0.22, 0.1 + floor * 0.008)) map[y][x] = 1;
        }
      }
      for (let x = 1; x <= exit.x; x += 1) map[1][x] = 0;
      for (let y = 1; y <= exit.y; y += 1) map[y][exit.x] = 0;
      map[1][1] = 0;
      map[exit.y][exit.x] = 0;
    }

    function buildFloor() {
      hero.x = 1;
      hero.y = 1;
      exit = { x: 10, y: 7 };
      makeMap();
      enemies = [];
      loot = [];
      const blocked = [hero, exit];
      const enemyCount = Math.min(10, 2 + floor);
      for (let index = 0; index < enemyCount; index += 1) {
        const pos = randomFloorCell([...blocked, ...enemies]);
        enemies.push({ ...pos, hp: 1 + Math.ceil(floor * 0.55), maxHp: 1 + Math.ceil(floor * 0.55), type: index % 3 });
      }
      const lootCount = 2 + (floor % 2);
      for (let index = 0; index < lootCount; index += 1) {
        const pos = randomFloorCell([...blocked, ...enemies, ...loot]);
        const roll = Math.random();
        loot.push({ ...pos, type: roll < 0.5 ? 'gold' : roll < 0.78 ? 'potion' : 'gem' });
      }
      log = `FLOOR ${floor}: FIND THE GOLDEN STAIRS.`;
      saveRun();
    }

    function newRun() {
      floor = 1;
      gold = 0;
      potions = 1;
      level = 1;
      xp = 0;
      weapon = 0;
      hero = { x: 1, y: 1, hp: 10 };
      buildFloor();
      state = 'play';
      services.tone(420, 0.08);
      renderUi();
    }

    function saveRun() {
      if (!hero) return;
      services.storage.set('dungeonByte:run', { map, hero, enemies, loot, exit, floor, gold, potions, level, xp, weapon });
      bestFloor = Math.max(bestFloor, floor);
      highGold = Math.max(highGold, gold);
      services.storage.set('dungeonByte:bestFloor', bestFloor);
      services.storage.set('dungeonByte:highGold', highGold);
    }

    function loadRun(saved) {
      map = saved.map;
      hero = { ...saved.hero };
      enemies = saved.enemies.map(item => ({ ...item }));
      loot = saved.loot.map(item => ({ ...item }));
      exit = { ...saved.exit };
      floor = saved.floor;
      gold = saved.gold;
      potions = saved.potions;
      level = saved.level;
      xp = saved.xp;
      weapon = saved.weapon;
    }

    function updateUi() {
      if (!hero) return;
      root.querySelector('#dungeon-floor').textContent = String(floor).padStart(2, '0');
      root.querySelector('#dungeon-hp').textContent = `${Math.max(0, hero.hp)}/${maxHp()}`;
      root.querySelector('#dungeon-gold').textContent = String(gold).padStart(3, '0');
      root.querySelector('#dungeon-level').textContent = String(level).padStart(2, '0');
      root.querySelector('#dungeon-xp').textContent = `${xp}/${xpTarget()}`;
      root.querySelector('#dungeon-weapon').textContent = `+${weapon}`;
      root.querySelector('#dungeon-potions').textContent = String(potions);
      root.querySelector('#dungeon-log').textContent = log;
    }

    function showOverlay(title, copy, button, hint) {
      const overlay = root.querySelector('#dungeon-overlay');
      overlay.hidden = false;
      overlay.innerHTML = `<strong>${title}</strong><small>${copy}</small><button data-dungeon="start">${button}</button><em>${hint}</em>`;
    }

    function renderUi() {
      updateUi();
      if (state === 'intro') {
        showOverlay('DUNGEON BYTE', returning ? `SAVED RUN • FLOOR ${floor}<br>HERO LEVEL ${level}` : 'EXPLORE • BATTLE • LOOT<br>YOUR RUN SAVES EVERY TURN', returning ? 'CONTINUE RUN' : 'BEGIN RUN', returning ? 'A CONTINUE • B NEW RUN' : 'A / START');
      } else if (state === 'status') {
        showOverlay('HERO STATUS', `LEVEL ${level} • BLADE +${weapon}<br>HP ${hero.hp}/${maxHp()} • ${gold} GOLD<br>BEST FLOOR ${bestFloor}`, 'BACK TO DUNGEON', 'START / A / B');
      } else if (state === 'over') {
        showOverlay('HERO FALLEN', `REACHED FLOOR ${floor}<br>FOUND ${gold} GOLD`, 'NEW RUN', 'A / START');
      } else {
        root.querySelector('#dungeon-overlay').hidden = true;
      }
    }

    function gainXp(amount) {
      xp += amount;
      if (xp >= xpTarget()) {
        xp -= xpTarget();
        level += 1;
        hero.hp = maxHp();
        log = `LEVEL UP! MAX HP IS NOW ${maxHp()}.`;
        services.tone(900, 0.12);
      }
    }

    function enemyAt(x, y) { return enemies.find(enemy => enemy.x === x && enemy.y === y); }
    function lootAt(x, y) { return loot.find(item => item.x === x && item.y === y); }

    function collect(item) {
      loot = loot.filter(other => other !== item);
      if (item.type === 'gold') {
        const amount = 3 + Math.floor(Math.random() * (5 + floor));
        gold += amount;
        if (Math.random() < 0.14) weapon += 1;
        log = `TREASURE! +${amount} GOLD${weapon ? '' : '.'}`;
        services.tone(820, 0.07);
      } else if (item.type === 'potion') {
        potions += 1;
        log = 'FOUND A RED POTION.';
        services.tone(650, 0.07);
      } else {
        gainXp(6 + floor);
        log = 'ANCIENT DATA GEM! XP GAINED.';
        services.tone(980, 0.08);
      }
    }

    function attack(enemy) {
      const damage = 1 + weapon + Math.floor((level - 1) / 2);
      enemy.hp -= damage;
      log = `HIT THE ${['SLIME', 'BAT', 'GOLEM'][enemy.type]} FOR ${damage}.`;
      services.tone(390 + enemy.type * 80, 0.035);
      if (enemy.hp <= 0) {
        enemies = enemies.filter(item => item !== enemy);
        gold += 1 + enemy.type;
        gainXp(3 + enemy.type + floor);
        log = `${['SLIME', 'BAT', 'GOLEM'][enemy.type]} DEFEATED!`;
      }
    }

    function occupied(x, y, except) {
      return enemies.some(enemy => enemy !== except && enemy.x === x && enemy.y === y);
    }

    function enemyTurn() {
      for (const enemy of [...enemies]) {
        const distance = Math.abs(enemy.x - hero.x) + Math.abs(enemy.y - hero.y);
        if (distance === 1) {
          const damage = 1 + Math.floor((floor - 1) / 4) + (enemy.type === 2 ? 1 : 0);
          hero.hp -= damage;
          log = `${['SLIME', 'BAT', 'GOLEM'][enemy.type]} HITS FOR ${damage}!`;
          services.tone(130, 0.055, 'sawtooth');
          if (hero.hp <= 0) { gameOver(); return; }
          continue;
        }
        const moves = [
          { x: enemy.x + Math.sign(hero.x - enemy.x), y: enemy.y },
          { x: enemy.x, y: enemy.y + Math.sign(hero.y - enemy.y) }
        ].sort((a, b) => (Math.abs(a.x - hero.x) + Math.abs(a.y - hero.y)) - (Math.abs(b.x - hero.x) + Math.abs(b.y - hero.y)));
        const move = moves.find(pos => map[pos.y]?.[pos.x] === 0 && !occupied(pos.x, pos.y, enemy) && !(pos.x === hero.x && pos.y === hero.y));
        if (move && Math.random() < 0.82) { enemy.x = move.x; enemy.y = move.y; }
      }
    }

    function nextFloor() {
      floor += 1;
      hero.hp = Math.min(maxHp(), hero.hp + 3);
      if (floor % 3 === 0) weapon += 1;
      buildFloor();
      bestFloor = Math.max(bestFloor, floor);
      services.tone(780, 0.12);
    }

    function takeTurn(dx, dy) {
      if (state !== 'play') return;
      const x = hero.x + dx;
      const y = hero.y + dy;
      if (map[y]?.[x] !== 0) { log = 'A STONE WALL BLOCKS THE WAY.'; updateUi(); services.tone(100, 0.025); return; }
      const enemy = enemyAt(x, y);
      if (enemy) attack(enemy);
      else {
        hero.x = x;
        hero.y = y;
        const item = lootAt(x, y);
        if (item) collect(item);
        else log = 'THE DUNGEON SHIFTS...';
        if (hero.x === exit.x && hero.y === exit.y) { nextFloor(); renderUi(); return; }
      }
      enemyTurn();
      saveRun();
      renderUi();
    }

    function waitTurn() {
      if (state !== 'play') return;
      log = 'YOU HOLD YOUR GROUND.';
      enemyTurn();
      saveRun();
      renderUi();
    }

    function usePotion() {
      if (state !== 'play') return;
      if (potions <= 0) { log = 'NO POTIONS LEFT.'; services.tone(110, 0.05); updateUi(); return; }
      if (hero.hp >= maxHp()) { log = 'HP IS ALREADY FULL.'; updateUi(); return; }
      potions -= 1;
      hero.hp = Math.min(maxHp(), hero.hp + 6);
      log = 'THE POTION RESTORES 6 HP.';
      services.tone(620, 0.1);
      enemyTurn();
      saveRun();
      renderUi();
    }

    function gameOver() {
      state = 'over';
      bestFloor = Math.max(bestFloor, floor);
      highGold = Math.max(highGold, gold);
      services.storage.remove('dungeonByte:run');
      services.storage.set('dungeonByte:bestFloor', bestFloor);
      services.storage.set('dungeonByte:highGold', highGold);
      services.tone(90, 0.3, 'sawtooth');
      renderUi();
    }

    function startOrContinue() {
      if (state === 'intro' && returning) state = 'play';
      else if (state === 'status') state = 'play';
      else newRun();
      renderUi();
    }

    function toggleStatus() {
      if (state === 'play') state = 'status';
      else if (state === 'status') state = 'play';
      else { startOrContinue(); return; }
      services.tone(300, 0.04);
      renderUi();
    }

    function drawTile(x, y, wall) {
      const px = ORIGIN_X + x * CELL;
      const py = ORIGIN_Y + y * CELL;
      ctx.fillStyle = wall ? '#35313b' : '#201f25';
      ctx.fillRect(px, py, CELL - 1, CELL - 1);
      if (wall) {
        ctx.fillStyle = '#514a56';
        ctx.fillRect(px + 2, py + 2, CELL - 5, 3);
      } else {
        ctx.fillStyle = '#2b2930';
        ctx.fillRect(px + 3, py + 3, 2, 2);
        ctx.fillRect(px + 14, py + 12, 2, 2);
      }
    }

    function draw() {
      ctx.fillStyle = '#12151a';
      ctx.fillRect(0, 0, 320, 240);
      if (!hero || !map.length) return;
      map.forEach((row, y) => row.forEach((wall, x) => drawTile(x, y, wall)));

      const ex = ORIGIN_X + exit.x * CELL;
      const ey = ORIGIN_Y + exit.y * CELL;
      ctx.fillStyle = '#f6cc64';
      ctx.fillRect(ex + 4, ey + 4, 12, 12);
      ctx.fillStyle = '#6b5630';
      ctx.fillRect(ex + 7, ey + 7, 6, 6);

      loot.forEach(item => {
        const x = ORIGIN_X + item.x * CELL + 5;
        const y = ORIGIN_Y + item.y * CELL + 5;
        ctx.fillStyle = item.type === 'gold' ? '#f6cc64' : item.type === 'potion' ? '#d86578' : '#72e0db';
        ctx.fillRect(x, y, 10, 10);
        ctx.fillStyle = '#ffffff55';
        ctx.fillRect(x + 2, y + 2, 3, 2);
      });

      enemies.forEach(enemy => {
        const x = ORIGIN_X + enemy.x * CELL;
        const y = ORIGIN_Y + enemy.y * CELL;
        ctx.fillStyle = ['#71cf71', '#a77ae8', '#b97955'][enemy.type];
        ctx.fillRect(x + 4, y + 6, 12, 10);
        ctx.fillStyle = '#17191d';
        ctx.fillRect(x + 6, y + 9, 2, 2);
        ctx.fillRect(x + 12, y + 9, 2, 2);
        if (enemy.hp < enemy.maxHp) {
          ctx.fillStyle = '#3a1c22';
          ctx.fillRect(x + 3, y + 2, 14, 2);
          ctx.fillStyle = '#e46570';
          ctx.fillRect(x + 3, y + 2, 14 * enemy.hp / enemy.maxHp, 2);
        }
      });

      const hx = ORIGIN_X + hero.x * CELL;
      const hy = ORIGIN_Y + hero.y * CELL;
      ctx.fillStyle = '#e8e0cf';
      ctx.fillRect(hx + 5, hy + 4, 10, 13);
      ctx.fillStyle = '#4f83bd';
      ctx.fillRect(hx + 3, hy + 8, 14, 8);
      ctx.fillStyle = '#f6cc64';
      ctx.fillRect(hx + 15, hy + 4, 2, 11);
      ctx.fillRect(hx + 13, hy + 4, 6, 2);
    }

    function loop() {
      draw();
      frame = requestAnimationFrame(loop);
    }

    return {
      async mount(host, providedServices) {
        services = providedServices;
        bestFloor = services.storage.get('dungeonByte:bestFloor', 1);
        highGold = services.storage.get('dungeonByte:highGold', 0);
        const saved = services.storage.get('dungeonByte:run', null);
        returning = Boolean(saved?.map && saved?.hero && saved.hero.hp > 0);
        if (returning) loadRun(saved);
        else {
          hero = { x: 1, y: 1, hp: 10 };
          makeMap();
        }
        host.innerHTML = markup();
        root = host.firstElementChild;
        canvas = root.querySelector('canvas');
        ctx = createGameContext(canvas, 320, 240);
        state = 'intro';
        renderUi();
        frame = requestAnimationFrame(loop);

        root.addEventListener('click', event => {
          const action = event.target.closest?.('[data-dungeon]')?.dataset.dungeon;
          if (action === 'start') startOrContinue();
          if (action === 'potion') usePotion();
          if (action === 'exit') { if (state === 'play') saveRun(); services.exit(); }
        });
        canvas.addEventListener('pointerdown', event => {
          if (state !== 'play') return;
          const bounds = canvas.getBoundingClientRect();
          const x = Math.floor(((event.clientX - bounds.left) * (320 / bounds.width) - ORIGIN_X) / CELL);
          const y = Math.floor(((event.clientY - bounds.top) * (240 / bounds.height) - ORIGIN_Y) / CELL);
          const dx = x - hero.x;
          const dy = y - hero.y;
          if (Math.abs(dx) + Math.abs(dy) === 1) takeTurn(dx, dy);
        });
      },
      input(key, down) {
        if (!down) return;
        if (state === 'intro') {
          if (key === 'a' || key === 'start') startOrContinue();
          if (key === 'b') { returning = false; newRun(); }
          if (key === 'select') services.exit();
          return;
        }
        if (state === 'over') {
          if (key === 'a' || key === 'start') newRun();
          if (key === 'select') services.exit();
          return;
        }
        if (state === 'status') {
          if (key === 'a' || key === 'b' || key === 'start') toggleStatus();
          if (key === 'select') services.exit();
          return;
        }
        if (key === 'up') takeTurn(0, -1);
        if (key === 'down') takeTurn(0, 1);
        if (key === 'left') takeTurn(-1, 0);
        if (key === 'right') takeTurn(1, 0);
        if (key === 'a') waitTurn();
        if (key === 'b') usePotion();
        if (key === 'start') toggleStatus();
        if (key === 'select') { saveRun(); services.exit(); }
      },
      setAuthority() {},
      unmount() {
        if (state === 'play') saveRun();
        cancelAnimationFrame(frame);
      }
    };
  }
};
