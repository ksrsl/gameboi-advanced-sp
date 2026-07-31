import { createGameContext } from '../../js/render-utils.js?v=2.0.2';

const SAVE_KEY = 'petByte:save';
const ACTIONS = [
  { id: 'feed', label: 'FEED', icon: '◆' },
  { id: 'play', label: 'PLAY', icon: '●' },
  { id: 'clean', label: 'CLEAN', icon: '✦' },
  { id: 'sleep', label: 'SLEEP', icon: 'Z' },
  { id: 'train', label: 'TRAIN', icon: '▲' }
];
const clamp = value => Math.max(0, Math.min(100, value));

function freshPet() {
  return {
    name: 'BYTE',
    level: 1,
    xp: 0,
    coins: 20,
    hunger: 82,
    happiness: 78,
    clean: 86,
    energy: 76,
    adoptedAt: Date.now(),
    lastSeen: Date.now()
  };
}

export default {
  id: 'pet-byte',
  title: 'Pet Byte',
  version: '1.0.0',
  create() {
    let root;
    let canvas;
    let ctx;
    let services;
    let frame = 0;
    let needsTimer = 0;
    let messageTimer = 0;
    let previousTime = 0;
    let state = 'intro';
    let selected = 0;
    let pet;
    let returning = false;
    let message = 'BYTE IS WAITING FOR YOU!';
    let animation = 'idle';
    let animationUntil = 0;
    let lastPat = 0;

    const markup = () => `
      <div class="pet-game">
        <canvas width="320" height="240" aria-label="Pet Byte room"></canvas>
        <div class="pet-hud">
          <span>BYTE LV <b id="pet-level">01</b></span>
          <span>XP <b id="pet-xp">00/30</b></span>
          <span>COINS <b id="pet-coins">020</b></span>
        </div>
        <div class="pet-stats" aria-label="Pet needs">
          <div class="pet-stat"><span>FOOD</span><i id="pet-hunger"></i></div>
          <div class="pet-stat"><span>FUN</span><i id="pet-happiness"></i></div>
          <div class="pet-stat"><span>CLEAN</span><i id="pet-clean"></i></div>
          <div class="pet-stat"><span>ENERGY</span><i id="pet-energy"></i></div>
        </div>
        <div class="pet-message" id="pet-message">BYTE IS WAITING FOR YOU!</div>
        <div class="pet-actions" id="pet-actions">
          ${ACTIONS.map((action, index) => `<button data-pet-action="${action.id}" class="${index === 0 ? 'selected' : ''}"><span>${action.icon}</span>${action.label}</button>`).join('')}
        </div>
        <div class="pet-overlay" id="pet-overlay">
          <strong>PET BYTE</strong>
          <small>A TINY DIGITAL FRIEND<br>WHO REMEMBERS YOU</small>
          <button data-pet="start">ADOPT BYTE</button>
          <em>A / START</em>
        </div>
        <button class="pet-exit" data-pet="exit" aria-label="Exit game">×</button>
      </div>`;

    function applyOfflineDecay() {
      const now = Date.now();
      const elapsedMinutes = Math.min(24 * 60, Math.max(0, now - (pet.lastSeen || now)) / 60000);
      pet.hunger = clamp(pet.hunger - elapsedMinutes * 0.24);
      pet.happiness = clamp(pet.happiness - elapsedMinutes * 0.16);
      pet.clean = clamp(pet.clean - elapsedMinutes * 0.19);
      pet.energy = clamp(pet.energy - elapsedMinutes * 0.11);
      pet.lastSeen = now;
    }

    function savePet() {
      pet.lastSeen = Date.now();
      services.storage.set(SAVE_KEY, pet);
      services.storage.set('petByte:bestLevel', pet.level);
    }

    function setMessage(text, duration = 2400) {
      message = text;
      if (root) root.querySelector('#pet-message').textContent = message;
      clearTimeout(messageTimer);
      if (duration > 0) {
        messageTimer = setTimeout(() => {
          message = moodText();
          if (root) root.querySelector('#pet-message').textContent = message;
        }, duration);
      }
    }

    function averageMood() {
      return (pet.hunger + pet.happiness + pet.clean + pet.energy) / 4;
    }

    function moodText() {
      const lowest = Math.min(pet.hunger, pet.happiness, pet.clean, pet.energy);
      if (lowest < 18) {
        if (pet.hunger === lowest) return 'BYTE IS VERY HUNGRY.';
        if (pet.happiness === lowest) return 'BYTE NEEDS SOME PLAYTIME.';
        if (pet.clean === lowest) return 'BYTE NEEDS A BATH.';
        return 'BYTE NEEDS TO REST.';
      }
      if (averageMood() > 84) return 'BYTE FEELS AMAZING!';
      if (averageMood() > 60) return 'BYTE IS HAPPY TO SEE YOU!';
      return 'BYTE COULD USE SOME CARE.';
    }

    function bar(id, value, color) {
      const element = root.querySelector(id);
      element.style.setProperty('--value', `${Math.round(value)}%`);
      element.style.setProperty('--bar', color);
    }

    function updateUi() {
      root.querySelector('#pet-level').textContent = String(pet.level).padStart(2, '0');
      root.querySelector('#pet-xp').textContent = `${Math.floor(pet.xp)}/${pet.level * 30}`;
      root.querySelector('#pet-coins').textContent = String(Math.floor(pet.coins)).padStart(3, '0');
      root.querySelector('#pet-message').textContent = message;
      bar('#pet-hunger', pet.hunger, '#ffb866');
      bar('#pet-happiness', pet.happiness, '#ff7fa6');
      bar('#pet-clean', pet.clean, '#69e8e3');
      bar('#pet-energy', pet.energy, '#b491ff');
      [...root.querySelectorAll('[data-pet-action]')].forEach((button, index) => button.classList.toggle('selected', index === selected));
    }

    function showIntro() {
      const overlay = root.querySelector('#pet-overlay');
      overlay.hidden = false;
      overlay.innerHTML = returning
        ? '<strong>WELCOME BACK!</strong><small>BYTE MISSED YOU<br>YOUR PROGRESS WAS SAVED</small><button data-pet="start">VISIT BYTE</button><em>A / START</em>'
        : '<strong>PET BYTE</strong><small>A TINY DIGITAL FRIEND<br>WHO REMEMBERS YOU</small><button data-pet="start">ADOPT BYTE</button><em>A / START</em>';
    }

    function showStatus() {
      const overlay = root.querySelector('#pet-overlay');
      overlay.hidden = false;
      overlay.innerHTML = `<strong>BYTE STATUS</strong><small>MOOD ${Math.round(averageMood())}%<br>LEVEL ${pet.level} • ${Math.floor(pet.coins)} COINS<br>SELECT AN ACTIVITY TO CARE</small><button data-pet="start">BACK TO ROOM</button><em>START / A / B</em>`;
    }

    function renderState() {
      updateUi();
      if (state === 'intro') showIntro();
      else if (state === 'status') showStatus();
      else root.querySelector('#pet-overlay').hidden = true;
    }

    function animate(action, duration = 1100) {
      animation = action;
      animationUntil = performance.now() + duration;
    }

    function gainXp(amount) {
      pet.xp += amount;
      let leveled = false;
      while (pet.xp >= pet.level * 30) {
        pet.xp -= pet.level * 30;
        pet.level += 1;
        pet.coins += 10;
        pet.energy = clamp(pet.energy + 18);
        pet.happiness = clamp(pet.happiness + 18);
        leveled = true;
      }
      if (leveled) {
        setMessage(`LEVEL UP! BYTE IS NOW LEVEL ${pet.level}!`, 3200);
        services.tone(880, 0.14);
        setTimeout(() => services.tone(1100, 0.12), 130);
      }
    }

    function perform(action) {
      if (state !== 'room') return;
      if (action === 'feed') {
        if (pet.coins < 2) { setMessage('BYTE NEEDS 2 COINS FOR A SNACK.'); services.tone(120, 0.08); return; }
        if (pet.hunger > 94) { setMessage('BYTE IS ALREADY FULL!'); return; }
        pet.coins -= 2;
        pet.hunger = clamp(pet.hunger + 29);
        pet.happiness = clamp(pet.happiness + 3);
        gainXp(3);
        animate('feed');
        setMessage('CRUNCH! BYTE LOVED THAT SNACK.');
        services.tone(520, 0.06);
      }
      if (action === 'play') {
        if (pet.energy < 10) { setMessage('BYTE IS TOO TIRED TO PLAY.'); services.tone(120, 0.08); return; }
        pet.energy = clamp(pet.energy - 10);
        pet.hunger = clamp(pet.hunger - 4);
        pet.happiness = clamp(pet.happiness + 26);
        pet.coins += 1;
        gainXp(5);
        animate('play');
        setMessage('BOUNCE! BYTE FOUND A COIN.');
        services.tone(700, 0.06);
      }
      if (action === 'clean') {
        pet.clean = clamp(pet.clean + 38);
        pet.happiness = clamp(pet.happiness + 5);
        gainXp(3);
        animate('clean');
        setMessage('SPARKLY CLEAN!');
        services.tone(820, 0.08);
      }
      if (action === 'sleep') {
        pet.energy = clamp(pet.energy + 42);
        pet.hunger = clamp(pet.hunger - 6);
        gainXp(2);
        animate('sleep', 1500);
        setMessage('BYTE TOOK A POWER NAP.');
        services.tone(310, 0.11, 'sine');
      }
      if (action === 'train') {
        if (pet.energy < 15 || pet.hunger < 12) { setMessage('BYTE NEEDS FOOD AND ENERGY FIRST.'); services.tone(120, 0.08); return; }
        pet.energy = clamp(pet.energy - 15);
        pet.hunger = clamp(pet.hunger - 7);
        pet.happiness = clamp(pet.happiness + 7);
        pet.coins += 5;
        gainXp(12);
        animate('train');
        if (!message.startsWith('LEVEL UP')) setMessage('GREAT TRAINING! +5 COINS.');
        services.tone(640, 0.07);
      }
      savePet();
      updateUi();
    }

    function drawRoom() {
      ctx.fillStyle = '#8bd3c7';
      ctx.fillRect(0, 0, 320, 157);
      ctx.fillStyle = '#75beb5';
      for (let y = 28; y < 155; y += 16) ctx.fillRect(0, y, 320, 1);
      ctx.fillStyle = '#4f7d78';
      ctx.fillRect(0, 157, 320, 83);
      ctx.fillStyle = '#416c68';
      for (let x = 0; x < 320; x += 32) ctx.fillRect(x, 157, 1, 83);
      for (let y = 157; y < 240; y += 16) ctx.fillRect(0, y, 320, 1);

      ctx.fillStyle = '#183943';
      ctx.fillRect(111, 31, 66, 51);
      ctx.fillStyle = '#bcecff';
      ctx.fillRect(116, 36, 56, 41);
      ctx.fillStyle = '#ffffff88';
      ctx.fillRect(144, 36, 2, 41);
      ctx.fillRect(116, 56, 56, 2);
      ctx.fillStyle = '#f8df82';
      ctx.fillRect(157, 43, 8, 8);

      ctx.fillStyle = '#30635e';
      ctx.fillRect(226, 105, 63, 12);
      ctx.fillRect(233, 117, 6, 38);
      ctx.fillRect(277, 117, 6, 38);
      ctx.fillStyle = '#ffe877';
      ctx.fillRect(233, 96, 13, 9);
      ctx.fillStyle = '#ff7fa6';
      ctx.fillRect(251, 92, 11, 13);
    }

    function drawPet(time) {
      const average = averageMood();
      const bounce = animation === 'sleep' ? 0 : Math.round(Math.sin(time / 260) * (animation === 'play' ? 4 : 2));
      const x = 184;
      const y = 117 + bounce;
      const body = average > 55 ? '#9dffe3' : '#89bbb1';
      const accent = average > 35 ? '#ff9fc0' : '#8b829d';

      if (pet.clean < 25) {
        ctx.fillStyle = '#6b5740';
        ctx.fillRect(x - 23, y + 28, 7, 4);
        ctx.fillRect(x + 17, y + 25, 6, 5);
      }

      ctx.fillStyle = body;
      ctx.fillRect(x - 18, y - 16, 36, 34);
      ctx.fillRect(x - 13, y + 18, 10, 7);
      ctx.fillRect(x + 4, y + 18, 10, 7);
      ctx.fillRect(x - 14, y - 23, 9, 9);
      ctx.fillRect(x + 5, y - 23, 9, 9);
      ctx.fillStyle = accent;
      ctx.fillRect(x - 11, y - 20, 4, 4);
      ctx.fillRect(x + 7, y - 20, 4, 4);

      const asleep = animation === 'sleep';
      ctx.fillStyle = '#15333b';
      if (asleep) {
        ctx.fillRect(x - 10, y - 5, 7, 2);
        ctx.fillRect(x + 3, y - 5, 7, 2);
      } else if (average < 25) {
        ctx.fillRect(x - 9, y - 4, 5, 3);
        ctx.fillRect(x + 4, y - 4, 5, 3);
      } else {
        ctx.fillRect(x - 9, y - 6, 5, 6);
        ctx.fillRect(x + 4, y - 6, 5, 6);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 8, y - 5, 2, 2);
        ctx.fillRect(x + 5, y - 5, 2, 2);
      }
      ctx.fillStyle = '#15333b';
      ctx.fillRect(x - 2, y + 3, 4, 3);
      if (average > 55) {
        ctx.fillRect(x - 6, y + 9, 4, 2);
        ctx.fillRect(x + 2, y + 9, 4, 2);
        ctx.fillRect(x - 2, y + 11, 4, 2);
      }

      if (animation === 'feed') {
        ctx.fillStyle = '#ffb866';
        ctx.fillRect(x - 10, y + 29, 20, 7);
        ctx.fillStyle = '#fff0b0';
        ctx.fillRect(x - 6, y + 27, 12, 4);
      }
      if (animation === 'play') {
        ctx.fillStyle = '#ff7fa6';
        ctx.fillRect(x + 30, y + 9, 12, 12);
        ctx.fillStyle = '#ffe877';
        ctx.fillRect(x + 34, y + 13, 4, 4);
      }
      if (animation === 'clean') {
        ctx.strokeStyle = '#d8ffff';
        ctx.strokeRect(x - 28, y - 16, 7, 7);
        ctx.strokeRect(x + 23, y - 6, 5, 5);
        ctx.strokeRect(x + 17, y - 23, 8, 8);
      }
      if (animation === 'sleep') {
        ctx.fillStyle = '#fff0b0';
        ctx.font = 'bold 10px Courier New';
        ctx.fillText('Z', x + 24, y - 23);
        ctx.font = 'bold 7px Courier New';
        ctx.fillText('Z', x + 17, y - 14);
      }
      if (animation === 'train') {
        ctx.fillStyle = '#ffe877';
        ctx.fillRect(x + 24, y - 18, 4, 18);
        ctx.fillRect(x + 17, y - 11, 18, 4);
      }
    }

    function draw(time) {
      drawRoom();
      if (performance.now() > animationUntil) animation = 'idle';
      drawPet(time);
    }

    function loop(time) {
      previousTime = time;
      draw(time);
      frame = requestAnimationFrame(loop);
    }

    function enterRoom() {
      state = 'room';
      message = moodText();
      savePet();
      renderState();
      services.tone(660, 0.07);
    }

    function toggleStatus() {
      if (state === 'intro') { enterRoom(); return; }
      state = state === 'status' ? 'room' : 'status';
      renderState();
      services.tone(320, 0.04);
    }

    function selectAction(delta) {
      selected = (selected + delta + ACTIONS.length) % ACTIONS.length;
      updateUi();
      services.tone(230, 0.02);
    }

    return {
      async mount(host, providedServices) {
        services = providedServices;
        const saved = services.storage.get(SAVE_KEY, null);
        returning = Boolean(saved);
        pet = saved ? { ...freshPet(), ...saved } : freshPet();
        applyOfflineDecay();
        message = moodText();
        host.innerHTML = markup();
        root = host.firstElementChild;
        canvas = root.querySelector('canvas');
        ctx = createGameContext(canvas, 320, 240);
        state = 'intro';
        renderState();
        previousTime = performance.now();
        frame = requestAnimationFrame(loop);
        needsTimer = setInterval(() => {
          if (state !== 'room') return;
          pet.hunger = clamp(pet.hunger - 0.12);
          pet.happiness = clamp(pet.happiness - 0.08);
          pet.clean = clamp(pet.clean - 0.1);
          pet.energy = clamp(pet.energy - 0.06);
          savePet();
          updateUi();
        }, 30000);

        root.addEventListener('click', event => {
          const shellAction = event.target.closest?.('[data-pet]')?.dataset.pet;
          const petAction = event.target.closest?.('[data-pet-action]')?.dataset.petAction;
          if (shellAction === 'start') {
            if (state === 'status') toggleStatus();
            else enterRoom();
          }
          if (shellAction === 'exit') { savePet(); services.exit(); }
          if (petAction) {
            selected = ACTIONS.findIndex(action => action.id === petAction);
            perform(petAction);
          }
        });
        canvas.addEventListener('pointerdown', event => {
          const bounds = canvas.getBoundingClientRect();
          const x = (event.clientX - bounds.left) * (320 / bounds.width);
          const y = (event.clientY - bounds.top) * (240 / bounds.height);
          if (state === 'room' && x > 145 && x < 225 && y > 75 && y < 165 && Date.now() - lastPat > 1000) {
            lastPat = Date.now();
            pet.happiness = clamp(pet.happiness + 1);
            animate('play', 500);
            setMessage('BYTE LOVES HEAD PATS!', 1200);
            services.tone(760, 0.04);
            savePet();
            updateUi();
          }
        });
      },
      input(key, down) {
        if (!down) return;
        if (state === 'intro') {
          if (key === 'a' || key === 'start') enterRoom();
          if (key === 'select') services.exit();
          return;
        }
        if (state === 'status') {
          if (key === 'a' || key === 'b' || key === 'start') toggleStatus();
          if (key === 'select') { savePet(); services.exit(); }
          return;
        }
        if (key === 'left' || key === 'up') selectAction(-1);
        if (key === 'right' || key === 'down') selectAction(1);
        if (key === 'a') perform(ACTIONS[selected].id);
        if (key === 'start') toggleStatus();
        if (key === 'select') { savePet(); services.exit(); }
      },
      setAuthority() {},
      unmount() {
        savePet();
        cancelAnimationFrame(frame);
        clearInterval(needsTimer);
        clearTimeout(messageTimer);
      }
    };
  }
};
