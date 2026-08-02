import { DuoSync, duoConfig } from './duo-sync.js?v=0.2.0';

const $ = selector => document.querySelector(selector);
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const config = duoConfig();
document.body.classList.add(`screen-${config.mode}`);

const svg = body => `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const icons = {
  vault: svg('<path d="M8 20h18l6 7h24v27H8z"/><path d="M15 13h19l5 7H15z"/><path d="M20 38h24"/>'),
  kart: svg('<path d="M14 38l5-13h26l7 13v10H12V38z"/><path d="M23 25l5-8h12l5 8"/><circle cx="20" cy="48" r="6"/><circle cx="46" cy="48" r="6"/><path d="M27 35h11"/>'),
  companion: svg('<circle cx="20" cy="21" r="7"/><circle cx="44" cy="21" r="7"/><circle cx="13" cy="36" r="6"/><circle cx="51" cy="36" r="6"/><path d="M20 47c0-9 6-15 12-15s12 6 12 15c0 7-6 10-12 6-6 4-12 1-12-6z"/>'),
  shadow: svg('<path d="M32 7l19 11-4 27-15 12-15-12-4-27z"/><path d="M21 23l11 8 11-8-4 17H25z"/>'),
  pass: svg('<circle cx="32" cy="32" r="23"/><circle cx="32" cy="32" r="12"/><circle cx="32" cy="32" r="3" fill="currentColor"/><path d="M32 9v6M55 32h-6M32 55v-6M9 32h6"/>'),
  friends: svg('<circle cx="23" cy="24" r="9"/><circle cx="44" cy="27" r="7"/><path d="M7 52c2-12 9-18 17-18s15 6 17 18M38 39c8-3 16 2 19 13"/>'),
  notes: svg('<path d="M14 8h31l7 7v41H14z"/><path d="M43 8v10h9M22 29h22M22 38h22M22 47h14"/>'),
  sketch: svg('<rect x="8" y="9" width="48" height="39" rx="5"/><path d="M18 39l10-11 8 8 9-13 6 9M19 55h26"/>'),
  camera: svg('<path d="M9 21h11l5-7h15l5 7h10v31H9z"/><circle cx="32" cy="36" r="11"/><path d="M49 27h1"/>'),
  music: svg('<path d="M25 48V17l27-6v31"/><circle cx="17" cy="49" r="8"/><circle cx="44" cy="43" r="8"/><path d="M25 26l27-6"/>'),
  settings: svg('<circle cx="32" cy="32" r="10"/><path d="M32 8v7M32 49v7M8 32h7M49 32h7M15 15l5 5M44 44l5 5M49 15l-5 5M20 44l-5 5"/>'),
  power: svg('<path d="M32 8v23"/><path d="M18 16a22 22 0 1 0 28 0"/>')
};

const apps = [
  { id: 'vault', title: 'GAME VAULT', subtitle: '21 CLASSICS READY', description: 'YOUR KSR ARCADE COLLECTION', kicker: 'KSR SYSTEM', badge: '21 READY', color: '#f2ad37', stats: ['21 INSTALLED', '4 FAVORITES'], icon: icons.vault },
  { id: 'kart', gameId: 'pixel-kart', title: 'KSR KART WORLD', subtitle: 'DUO EXCLUSIVE', description: 'RACE NEW CIRCUITS WITH A LIVE TOUCH MAP', kicker: 'FEATURED GAME', badge: 'PLAY', color: '#e65f63', stats: ['6 RACERS', '3 CIRCUITS'], icon: icons.kart, notice: true },
  { id: 'companion', gameId: 'pet-byte', title: 'COMPANION WORLD', subtitle: 'NOVA IS WAITING', description: 'CARE, PLAY AND EXPLORE WITH NOVA', kicker: 'KSR LIFE', badge: 'PLAY', color: '#f08bbb', stats: ['NOVA LV 12', '84% HAPPY'], icon: icons.companion },
  { id: 'shadow', gameId: 'dungeon-byte', title: 'SHADOW CIRCUIT II', subtitle: 'CONTINUE FLOOR 07', description: 'A DEEPER DUAL-SCREEN DUNGEON ADVENTURE', kicker: 'CONTINUE QUEST', badge: 'PLAY', color: '#745cd9', stats: ['FLOOR 07', '3 RELICS'], icon: icons.shadow },
  { id: 'pass', title: 'KSR PASS', subtitle: '3 NEARBY SIGNALS', description: 'MEET PLAYERS, TRADE CARDS AND FIND CHALLENGES', kicker: 'NEARBY LINK', badge: '3 FOUND', color: '#30b997', stats: ['3 NEARBY', '18 CARDS'], icon: icons.pass, notice: true },
  { id: 'friends', title: 'FRIENDS', subtitle: '4 ONLINE', description: 'SEE WHO IS ONLINE AND WHAT THEY ARE PLAYING', kicker: 'SOCIAL LINK', badge: '4 ONLINE', color: '#4ca6e8', stats: ['42 FRIENDS', '4 ONLINE'], icon: icons.friends },
  { id: 'notes', title: 'GAME NOTES', subtitle: '7 SAVED NOTES', description: 'KEEP CLUES, RECORDS AND ARCADE GOALS', kicker: 'QUICK TOOL', badge: '7 NOTES', color: '#54bf6c', stats: ['7 NOTES', 'AUTO SAVED'], icon: icons.notes },
  { id: 'sketch', title: 'SKETCH LINK', subtitle: 'DRAW AND SHARE', description: 'MAKE QUICK TOUCH DRAWINGS FOR YOUR FRIENDS', kicker: 'CREATIVE LINK', badge: 'TOUCH', color: '#ef8b42', stats: ['12 COLORS', '8 SLOTS'], icon: icons.sketch },
  { id: 'camera', title: 'KSR CAMERA', subtitle: 'PHOTO GALLERY', description: 'FRAME YOUR SECOND LIFE MOMENTS', kicker: 'MEDIA TOOL', badge: '24 SAVED', color: '#687a8e', stats: ['24 PHOTOS', '6 FRAMES'], icon: icons.camera },
  { id: 'music', title: 'BEAT DISTRICT', subtitle: 'RHYTHM STUDIO', description: 'PERFORM ON THE TOP SCREEN WITH TOUCH PADS BELOW', kicker: 'DUO EXCLUSIVE', badge: '8 TRACKS', color: '#e55caa', stats: ['8 TRACKS', 'BEST A+'], icon: icons.music },
  { id: 'settings', title: 'SYSTEM SETTINGS', subtitle: 'PERSONALIZE YOUR DUO', description: 'THEMES, AUDIO, PROFILE AND CONNECTIONS', kicker: 'KSR SYSTEM', badge: 'READY', color: '#7392a8', stats: ['VERSION 0.2', 'LINK READY'], icon: icons.settings },
  { id: 'power', title: 'SLEEP MODE', subtitle: 'SAVE POWER', description: 'SUSPEND BOTH SCREENS UNTIL YOUR NEXT TOUCH', kicker: 'POWER CONTROL', badge: 'SLEEP', color: '#40556a', stats: ['QUICK RESUME', 'SAVE SAFE'], icon: icons.power }
];

const cartridges = [
  { id: 'snake', title: 'NEON SERPENT', genre: 'ARCADE', mark: 'NS', color: '#2fbf89' },
  { id: 'block-drop', title: 'BLOCK DROP', genre: 'PUZZLE', mark: 'BD', color: '#6f62dd' },
  { id: 'brick-blaster', title: 'BRICK BLASTER', genre: 'ACTION', mark: 'BB', color: '#ef7c42' },
  { id: 'astro-defender', title: 'ASTRO DEFENDER', genre: 'SHOOTER', mark: 'AD', color: '#408cd9' },
  { id: 'pet-byte', title: 'KSR COMPANION', genre: 'VIRTUAL PET', mark: 'KC', color: '#ed82ad' },
  { id: 'byte-flyer', title: 'SKY PULSE', genre: 'ONE BUTTON', mark: 'SP', color: '#54b9e7' },
  { id: 'road-rush', title: 'ROAD RUSH', genre: 'RACING', mark: 'RR', color: '#e65f63' },
  { id: 'dungeon-byte', title: 'SHADOW CIRCUIT', genre: 'RPG', mark: 'SC', color: '#745cd9' },
  { id: 'fishing-byte', title: 'NEON ANGLER', genre: 'COLLECTION', mark: 'NA', color: '#27aeb6' },
  { id: 'maze-muncher', title: 'MAZE MUNCHER', genre: 'MAZE CHASE', mark: 'MM', color: '#efb637' },
  { id: 'mini-golf', title: 'MINI GOLF', genre: 'SPORTS', mark: 'MG', color: '#42ad68' },
  { id: 'pocket-tennis', title: 'POCKET TENNIS', genre: 'SPORTS', mark: 'PT', color: '#75b845' },
  { id: 'pixel-kart', title: 'PIXEL KART', genre: 'KART RACING', mark: 'PK', color: '#ec5f61' },
  { id: 'survivor-byte', title: 'NEON ONSLAUGHT', genre: 'ROGUELITE', mark: 'NO', color: '#b05bdb' },
  { id: 'bomb-grid', title: 'BOMB GRID', genre: 'ACTION', mark: 'BG', color: '#ef9142' },
  { id: 'pixel-quest', title: 'PIXEL QUEST', genre: 'PLATFORM', mark: 'PQ', color: '#42a4df' },
  { id: 'battle-tanks', title: 'BATTLE TANKS', genre: 'COMBAT', mark: 'BT', color: '#6a9666' },
  { id: 'pocket-fighter', title: 'POCKET FIGHTER', genre: 'FIGHTING', mark: 'PF', color: '#d65378' },
  { id: 'street-hoops', title: 'STREET HOOPS', genre: 'SPORTS', mark: 'SH', color: '#eb883d' },
  { id: 'pocket-bowling', title: 'POCKET BOWLING', genre: 'SPORTS', mark: 'PB', color: '#4e97d2' },
  { id: 'neon-cycle', title: 'TRON CYCLE', genre: 'LIGHT GRID', mark: 'TC', color: '#22cbd2' }
];

const PAGE_SIZE = 8;
const PAGE_COUNT = Math.ceil(apps.length / PAGE_SIZE);
const VAULT_PAGE_SIZE = 6;
const VAULT_PAGE_COUNT = Math.ceil(cartridges.length / VAULT_PAGE_SIZE);
const params = new URLSearchParams(location.search);
const ownerName = (params.get('ownerDisplay') || params.get('ownerName') || 'Corp').trim().slice(0, 24);
const saveKey = 'ksrDuo:system:v1';

function readSave() {
  try { return JSON.parse(localStorage.getItem(saveKey) || '{}'); } catch { return {}; }
}

const saved = readSave();
const state = {
  selected: clamp(Number(saved.selected) || 0, 0, apps.length - 1),
  page: clamp(Number(saved.page) || 0, 0, PAGE_COUNT - 1),
  openApp: '',
  gameId: '',
  vaultPage: 0,
  sleeping: false,
  theme: ['pearl', 'midnight', 'sunset'].includes(saved.theme) ? saved.theme : 'pearl',
  muted: Boolean(saved.muted)
};

const sync = new DuoSync(config);
let booting = true;
let audio = null;
let suppressTileClick = false;
let lastTileTap = { index: -1, at: 0 };
let bootTimers = [];
let settledSnapshotTimer = 0;

function save() {
  try {
    localStorage.setItem(saveKey, JSON.stringify({
      selected: state.selected,
      page: state.page,
      theme: state.theme,
      muted: state.muted
    }));
  } catch {}
}

function tone(frequency = 520, duration = .04, type = 'sine') {
  if (state.muted) return;
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    if (audio.state === 'suspended') audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.045, audio.currentTime + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  } catch {}
}

function setTheme(theme, broadcast = true) {
  if (!['pearl', 'midnight', 'sunset'].includes(theme)) return;
  state.theme = theme;
  document.body.classList.remove('theme-midnight', 'theme-sunset');
  if (theme !== 'pearl') document.body.classList.add(`theme-${theme}`);
  save();
  renderApplicationContent();
  if (broadcast) sendAction('theme', { theme });
}

function updateSoundButton() {
  $('#sound-button').classList.toggle('muted', state.muted);
  $('#sound-button').setAttribute('aria-pressed', String(state.muted));
  $('.sound-glyph').textContent = state.muted ? '×' : '♪';
}

function setMuted(muted, broadcast = true) {
  state.muted = Boolean(muted);
  save();
  updateSoundButton();
  renderApplicationContent();
  if (!state.muted) tone(720, .055);
  if (broadcast) sendAction('mute', { muted: state.muted });
}

function currentApp() {
  return apps[state.selected] || apps[0];
}

function renderTiles() {
  const pages = $('#tile-pages');
  pages.replaceChildren();
  for (let pageIndex = 0; pageIndex < PAGE_COUNT; pageIndex += 1) {
    const page = document.createElement('div');
    page.className = 'tile-page';
    apps.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE).forEach((app, offset) => {
      const index = pageIndex * PAGE_SIZE + offset;
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'app-tile';
      tile.dataset.index = String(index);
      tile.dataset.notice = String(Boolean(app.notice));
      tile.style.setProperty('--tile-color', app.color);
      tile.setAttribute('aria-label', app.title);
      tile.innerHTML = `<span class="tile-icon">${app.icon}</span><span class="tile-label">${app.title}</span>`;
      page.append(tile);
    });
    pages.append(page);
  }

  const dots = $('#page-dots');
  dots.replaceChildren();
  for (let index = 0; index < PAGE_COUNT; index += 1) {
    const dot = document.createElement('i');
    dot.dataset.page = String(index);
    dots.append(dot);
  }
}

function renderSelection() {
  const app = currentApp();
  const selectedTile = $(`.app-tile[data-index="${state.selected}"]`);
  document.querySelectorAll('.app-tile').forEach(tile => tile.classList.toggle('selected', tile === selectedTile));
  $('#selected-title').textContent = app.title;
  $('#selected-subtitle').textContent = app.subtitle;
  $('#hero-title').textContent = app.title;
  $('#hero-description').textContent = app.description;
  $('#hero-kicker').textContent = app.kicker;
  $('#hero-badge').textContent = app.badge;
  $('#hero-icon').innerHTML = app.icon;
  $('#hero-icon').style.setProperty('--tile-color', app.color);
  $('#top-page').textContent = `${state.page + 1} / ${PAGE_COUNT}`;
  $('#tile-pages').style.transform = `translateX(${-state.page * 320}px)`;
  document.querySelectorAll('#page-dots i').forEach((dot, index) => dot.classList.toggle('active', index === state.page));
}

function setPage(page, broadcast = true) {
  state.page = (page + PAGE_COUNT) % PAGE_COUNT;
  const start = state.page * PAGE_SIZE;
  const end = Math.min(apps.length, start + PAGE_SIZE);
  if (state.selected < start || state.selected >= end) state.selected = start;
  save();
  renderSelection();
  tone(330, .025);
  if (broadcast) sendAction('page', { page: state.page, selected: state.selected });
}

function select(index, broadcast = true) {
  state.selected = clamp(index, 0, apps.length - 1);
  state.page = Math.floor(state.selected / PAGE_SIZE);
  save();
  renderSelection();
  tone(430 + (state.selected % 4) * 35, .028);
  if (broadcast) sendAction('select', { selected: state.selected });
}

function snapshot() {
  return {
    selected: state.selected,
    page: state.page,
    openApp: state.openApp,
    gameId: state.gameId,
    vaultPage: state.vaultPage,
    sleeping: state.sleeping,
    theme: state.theme,
    muted: state.muted
  };
}

function sendAction(action, data = {}) {
  sync.sendAction({ action, ...data });
  sync.publishSnapshot(snapshot());
  scheduleSettledSnapshot();
}

function scheduleSettledSnapshot() {
  clearTimeout(settledSnapshotTimer);
  settledSnapshotTimer = setTimeout(() => {
    if (sync.isHost) sync.publishSnapshot(snapshot());
  }, 1250);
}

function setNotice(title, copy) {
  $('#notice-title').textContent = title;
  $('#notice-copy').textContent = copy;
}

function appCards(items) {
  return `<div class="app-card-grid">${items.map(item => `<button class="app-card" type="button" data-card="${item[0]}"><span class="card-chip">${item[2] || 'OPEN'}</span><b>${item[0]}</b><small>${item[1]}</small></button>`).join('')}</div>`;
}

function vaultMarkup() {
  const page = clamp(state.vaultPage, 0, VAULT_PAGE_COUNT - 1);
  const visible = cartridges.slice(page * VAULT_PAGE_SIZE, (page + 1) * VAULT_PAGE_SIZE);
  return `<div class="cartridge-vault">
    <div class="cartridge-grid">${visible.map(game => `<button class="cartridge-card" type="button" data-game="${game.id}" style="--game-color:${game.color}"><span>${game.mark}</span><div><b>${game.title}</b><small>${game.genre}</small></div></button>`).join('')}</div>
    <div class="vault-pages"><button type="button" data-vault-page="-1">PREV</button><span>${page + 1} / ${VAULT_PAGE_COUNT}</span><button type="button" data-vault-page="1">NEXT</button></div>
  </div>`;
}

function applicationMarkup(app) {
  if (app.id === 'vault') return vaultMarkup();
  if (app.id === 'kart') return appCards([
    ['QUICK RACE', 'JUMP INTO A THREE-LAP CIRCUIT', 'GO'],
    ['GRAND PRIX', 'FOUR RACES - ONE CHAMPION', '0%'],
    ['GARAGE', 'KARTS, COLORS AND TRAIL EFFECTS', '6'],
    ['RECORDS', 'GLOBAL AND PERSONAL BEST TIMES', 'TOP']
  ]);
  if (app.id === 'companion') return appCards([
    ['VISIT NOVA', 'HUNGER 82% - ENERGY 76%', 'LV12'],
    ['WARDROBE', '18 ITEMS COLLECTED', '18'],
    ['PLAYROOM', 'TOUCH TOYS AND MINI GAMES', 'NEW'],
    ['FRIEND PARK', 'MEET OTHER KSR COMPANIONS', '3']
  ]);
  if (app.id === 'shadow') return appCards([
    ['CONTINUE RUN', 'FLOOR 07 - ONYX CATACOMBS', 'GO'],
    ['EQUIPMENT', '3 RELICS - 12 ITEMS', '12'],
    ['MAP ARCHIVE', 'SIX FLOORS DISCOVERED', '6'],
    ['CHALLENGES', 'DAILY DUNGEON RECORDS', 'NEW']
  ]);
  if (app.id === 'pass') return appCards([
    ['NEARBY PLAYERS', 'THREE KSR SIGNALS DETECTED', '3'],
    ['PROFILE CARDS', '18 UNIQUE CARDS COLLECTED', '18'],
    ['CHALLENGES', 'TWO NEW SCORE CHALLENGES', '2'],
    ['GIFT BOX', 'ONE UNOPENED DELIVERY', '1']
  ]);
  if (app.id === 'friends') return appCards([
    ['ONLINE NOW', 'FOUR FRIENDS ARE ACTIVE', '4'],
    ['FRIEND LIST', '42 KSR FRIENDS', '42'],
    ['PARTY ROOM', 'CREATE A MULTIPLAYER ROOM', 'NEW'],
    ['RECENT PLAYERS', 'PEOPLE MET ON KSR PASS', '12']
  ]);
  if (app.id === 'notes') return appCards([
    ['NEW NOTE', 'START A TOUCH NOTE', '+'],
    ['GAME CLUES', 'THREE SAVED CLUES', '3'],
    ['ARCADE GOALS', 'FOUR RECORDS TO BEAT', '4'],
    ['ARCHIVE', 'ALL SEVEN SAVED NOTES', '7']
  ]);
  if (app.id === 'sketch') return appCards([
    ['NEW SKETCH', 'OPEN THE TOUCH CANVAS', '+'],
    ['GALLERY', 'EIGHT SAVED DRAWINGS', '8'],
    ['SEND TO FRIEND', 'SHARE THROUGH KSR LINK', 'SEND'],
    ['COLOR SET', 'TWELVE ARCADE COLORS', '12']
  ]);
  if (app.id === 'camera') return appCards([
    ['PHOTO MODE', 'FRAME A SECOND LIFE MOMENT', 'OPEN'],
    ['GALLERY', '24 SAVED MEMORIES', '24'],
    ['DUO FRAMES', 'SIX KSR OVERLAYS', '6'],
    ['SLIDESHOW', 'PLAY ON THE UPPER SCREEN', 'PLAY']
  ]);
  if (app.id === 'music') return appCards([
    ['ARCADE SET', 'FOUR-BUTTON RHYTHM STAGE', 'PLAY'],
    ['TOUCH MIX', 'LIVE PADS AND FILTERS', 'MIX'],
    ['TRACK LIST', 'EIGHT ORIGINAL TRACKS', '8'],
    ['RECORDS', 'BEST RANK A+', 'A+']
  ]);
  if (app.id === 'settings') return `<div class="setting-list">
    <button class="setting-option" type="button" data-setting="theme"><div><b>COLOR THEME</b><small>PEARL, MIDNIGHT OR SUNSET</small></div><span>${state.theme.toUpperCase()}</span></button>
    <button class="setting-option" type="button" data-setting="sound"><div><b>SYSTEM SOUND</b><small>TOUCH AND MENU AUDIO</small></div><span>${state.muted ? 'OFF' : 'ON'}</span></button>
    <button class="setting-option" type="button" data-setting="sleep"><div><b>SLEEP MODE</b><small>SUSPEND BOTH DISPLAYS</small></div><span>SLEEP</span></button>
  </div>`;
  if (app.id === 'power') return `<div class="profile-card"><div class="profile-avatar">K</div><div><h3>READY TO SLEEP</h3><p>YOUR MENU POSITION AND SYSTEM SETTINGS ARE SAVED.<br>TOUCH SLEEP TO SUSPEND BOTH DISPLAYS.</p></div></div><button class="open-app" type="button" data-setting="sleep" style="width:130px;margin:12px auto 0"><span>SLEEP NOW</span><small>●</small></button>`;
  return `<div class="profile-card"><div class="profile-avatar">${ownerName.slice(0, 1).toUpperCase()}</div><div><h3>${ownerName.toUpperCase()}</h3><p>KSR DUO PLAYER<br>PROFILE SYSTEM ONLINE<br>LOCAL SAVES READY</p></div></div>`;
}

function renderApplicationContent() {
  if (!state.openApp) return;
  const app = apps.find(item => item.id === state.openApp) || currentApp();
  $('#app-content').innerHTML = applicationMarkup(app);
}

function gameFrameURL(gameId) {
  const target = new URL('../', location.href);
  target.searchParams.set('embed', 'duo');
  target.searchParams.set('game', gameId);
  target.searchParams.set('duoVersion', '0.2.0');
  ['ownerId', 'ownerName', 'ownerDisplay', 'leaderboard'].forEach(name => {
    const value = params.get(name);
    if (value) target.searchParams.set(name, value);
  });
  if (config.endpoint && config.room && config.token) {
    target.searchParams.set('sync', config.endpoint);
    target.searchParams.set('room', `${config.room}-game`);
    target.searchParams.set('token', config.token);
  }
  return target.toString();
}

function renderGame(game) {
  document.documentElement.style.setProperty('--active-color', game.color);
  $('#game-control-title').textContent = game.title;
  if (config.mode === 'bottom') return;
  const frame = $('#game-frame');
  if (frame.dataset.gameId === game.id) return;
  frame.dataset.gameId = game.id;
  frame.src = gameFrameURL(game.id);
}

function showInterface() {
  const app = apps.find(item => item.id === state.openApp);
  const game = cartridges.find(item => item.id === state.gameId);
  $('.top-home').hidden = Boolean(app || game);
  $('.bottom-home').hidden = Boolean(app || game);
  $('.top-app').hidden = !app || Boolean(game);
  $('.bottom-app').hidden = !app || Boolean(game);
  $('.top-game').hidden = !game;
  $('.bottom-game').hidden = !game;
  if (game) renderGame(game);
  else if (app) renderOpenApplication(app);
}

function renderOpenApplication(app) {
  document.documentElement.style.setProperty('--active-color', app.color);
  $('#app-top-kicker').textContent = app.kicker;
  $('#app-scene-kicker').textContent = 'APPLICATION ONLINE';
  $('#app-scene-title').textContent = app.title;
  $('#app-scene-description').textContent = app.description;
  $('#app-scene-icon').innerHTML = app.icon;
  $('#app-scene-stats').innerHTML = app.stats.map(stat => `<span>${stat}</span>`).join('');
  $('#app-bottom-title').textContent = app.title;
  $('#app-bottom-subtitle').textContent = app.subtitle;
  $('#app-bottom-icon').innerHTML = app.icon;
  renderApplicationContent();
}

function openApplication(id = currentApp().id, broadcast = true) {
  const app = apps.find(item => item.id === id);
  if (!app || state.sleeping || booting) return;
  if (app.gameId) return launchGame(app.gameId, broadcast);
  if (app.id === 'power') {
    state.openApp = 'power';
  } else {
    state.openApp = app.id;
  }
  state.selected = apps.indexOf(app);
  showInterface();
  tone(650, .055);
  setTimeout(() => tone(920, .08), 55);
  if (broadcast) sendAction('open', { id: app.id, selected: state.selected });
}

function launchGame(gameId, broadcast = true) {
  const game = cartridges.find(item => item.id === gameId);
  if (!game || state.sleeping || booting) return;
  state.gameId = game.id;
  state.openApp = 'vault';
  showInterface();
  tone(720, .065);
  setTimeout(() => tone(1040, .09), 70);
  if (broadcast) sendAction('launchGame', { gameId: game.id });
}

function exitDuoGame(broadcast = true) {
  if (!state.gameId) return;
  state.gameId = '';
  const frame = $('#game-frame');
  frame.dataset.gameId = '';
  frame.src = 'about:blank';
  showInterface();
  renderApplicationContent();
  tone(300, .05);
  if (broadcast) sendAction('exitGame');
}

function closeApplication(broadcast = true) {
  if (state.gameId) return exitDuoGame(broadcast);
  if (!state.openApp) return;
  state.openApp = '';
  showInterface();
  renderSelection();
  tone(310, .045);
  if (broadcast) sendAction('close');
}

function sleep(broadcast = true) {
  if (state.sleeping) return;
  state.sleeping = true;
  document.querySelectorAll('.duo-screen').forEach(screen => screen.classList.add('powering-down'));
  tone(180, .15, 'triangle');
  setTimeout(() => {
    document.querySelectorAll('.duo-screen').forEach(screen => {
      screen.classList.remove('powering-down');
      screen.querySelector('.wake-layer').hidden = false;
    });
  }, 640);
  if (broadcast) sendAction('sleep');
}

function clearBootTimers() {
  bootTimers.forEach(clearTimeout);
  bootTimers = [];
}

function runBoot() {
  clearBootTimers();
  booting = true;
  state.sleeping = false;
  document.querySelectorAll('.wake-layer').forEach(layer => { layer.hidden = true; });
  document.querySelectorAll('.boot-layer').forEach(layer => {
    layer.hidden = false;
    layer.classList.remove('exit');
    layer.querySelectorAll('*').forEach(child => child.style.removeProperty('animation'));
  });
  showInterface();
  bootTimers.push(setTimeout(() => tone(340, .045), 850));
  bootTimers.push(setTimeout(() => tone(520, .05), 1600));
  bootTimers.push(setTimeout(() => tone(710, .055), 2450));
  bootTimers.push(setTimeout(() => tone(940, .08), 3550));
  bootTimers.push(setTimeout(() => document.querySelectorAll('.boot-layer').forEach(layer => layer.classList.add('exit')), 4200));
  bootTimers.push(setTimeout(() => {
    document.querySelectorAll('.boot-layer').forEach(layer => { layer.hidden = true; });
    booting = false;
    showInterface();
    tone(780, .08);
    setTimeout(() => tone(1080, .11), 70);
  }, 4750));
}

function wake(broadcast = true) {
  if (!state.sleeping) return;
  runBoot();
  if (broadcast) sendAction('wake');
}

function moveSelection(key) {
  if (state.openApp || state.sleeping || booting) return;
  const pageStart = state.page * PAGE_SIZE;
  const pageEnd = Math.min(apps.length, pageStart + PAGE_SIZE);
  let next = state.selected;
  if (key === 'left') next -= 1;
  if (key === 'right') next += 1;
  if (key === 'up') next -= 4;
  if (key === 'down') next += 4;
  if (next < pageStart) {
    if (key === 'left') return setPage(state.page - 1);
    next = pageStart;
  }
  if (next >= pageEnd) {
    if (key === 'right') return setPage(state.page + 1);
    next = pageEnd - 1;
  }
  select(next);
}

function makeInputId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function forwardGameInput(key, pressed, eventId) {
  if (!state.gameId || config.mode === 'bottom') return;
  const frame = $('#game-frame');
  if (!frame.contentWindow) return;
  frame.contentWindow.postMessage({
    type: 'ksr-duo-input',
    key,
    pressed: pressed !== false,
    eventId
  }, location.origin);
}

function sendGameInput(key, pressed = true) {
  if (!state.gameId) return;
  const eventId = makeInputId();
  forwardGameInput(key, pressed, eventId);
  sync.sendAction({ action: 'gameInput', key, pressed: pressed !== false, eventId });
}

function applyAction(payload, broadcast = false) {
  if (!payload || typeof payload.action !== 'string') return;
  if (payload.action === 'select') select(Number(payload.selected), broadcast);
  if (payload.action === 'page') {
    state.selected = clamp(Number(payload.selected) || 0, 0, apps.length - 1);
    setPage(Number(payload.page) || 0, broadcast);
  }
  if (payload.action === 'open') openApplication(payload.id, broadcast);
  if (payload.action === 'close') closeApplication(broadcast);
  if (payload.action === 'launchGame') launchGame(payload.gameId, broadcast);
  if (payload.action === 'exitGame') exitDuoGame(broadcast);
  if (payload.action === 'gameInput') forwardGameInput(String(payload.key || ''), payload.pressed !== false, String(payload.eventId || ''));
  if (payload.action === 'vaultPage') {
    state.vaultPage = clamp(Number(payload.page) || 0, 0, VAULT_PAGE_COUNT - 1);
    renderApplicationContent();
  }
  if (payload.action === 'theme') setTheme(payload.theme, broadcast);
  if (payload.action === 'mute') setMuted(payload.muted, broadcast);
  if (payload.action === 'sleep') sleep(broadcast);
  if (payload.action === 'wake') runBoot();
  if (payload.action === 'notice') setNotice(payload.title || 'KSR DUO', payload.copy || 'SYSTEM READY');
  if (!broadcast && payload.action !== 'gameInput' && sync.isHost) {
    sync.publishSnapshot(snapshot());
    scheduleSettledSnapshot();
  }
}

function hydrate(data) {
  if (!data || typeof data !== 'object') return;
  state.selected = clamp(Number(data.selected) || 0, 0, apps.length - 1);
  state.page = clamp(Number(data.page) || 0, 0, PAGE_COUNT - 1);
  state.openApp = apps.some(app => app.id === data.openApp) ? data.openApp : '';
  state.gameId = cartridges.some(game => game.id === data.gameId) ? data.gameId : '';
  state.vaultPage = clamp(Number(data.vaultPage) || 0, 0, VAULT_PAGE_COUNT - 1);
  setTheme(data.theme || state.theme, false);
  setMuted(Boolean(data.muted), false);
  renderSelection();
  showInterface();
  if (data.sleeping && !state.sleeping) sleep(false);
  if (!data.sleeping && state.sleeping) runBoot();
}

function fit() {
  const device = $('#duo-device');
  if (config.mode === 'top') {
    device.style.transform = `scale(${window.innerWidth / 400}, ${window.innerHeight / 240})`;
    device.style.transformOrigin = 'top left';
    return;
  }
  if (config.mode === 'bottom') {
    device.style.transform = `scale(${window.innerWidth / 320}, ${window.innerHeight / 240})`;
    device.style.transformOrigin = 'top left';
    return;
  }
  const scale = Math.min(window.innerWidth / 440, window.innerHeight / 596) * .965;
  device.style.transform = `translate(-50%, -50%) scale(${scale})`;
  device.style.transformOrigin = 'center';
}

function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
  $('#clock-time').textContent = time;
  $('#clock-date').textContent = date;
  $('#app-top-clock').textContent = time;
}

renderTiles();
setTheme(state.theme, false);
updateSoundButton();
renderSelection();
$('#profile-button span').textContent = ownerName.slice(0, 1).toUpperCase();
$('#profile-button b').textContent = ownerName.toUpperCase();
setNotice(`WELCOME BACK, ${ownerName.toUpperCase()}`, 'TOUCH AN ICON BELOW TO BEGIN');
updateClock();
setInterval(updateClock, 15000);

$('#tile-pages').addEventListener('click', event => {
  if (suppressTileClick || booting || state.sleeping || config.mode === 'top') return;
  const tile = event.target.closest('.app-tile');
  if (!tile) return;
  const index = Number(tile.dataset.index);
  const now = Date.now();
  if (state.selected === index && lastTileTap.index === index && now - lastTileTap.at < 850) {
    openApplication(apps[index].id);
    lastTileTap = { index: -1, at: 0 };
    return;
  }
  select(index);
  lastTileTap = { index, at: now };
});

$('#open-app').addEventListener('click', () => openApplication());
$('#app-back').addEventListener('click', () => closeApplication());
$('#previous-page').addEventListener('click', () => setPage(state.page - 1));
$('#next-page').addEventListener('click', () => setPage(state.page + 1));
$('#sound-button').addEventListener('click', () => setMuted(!state.muted));
$('#profile-button').addEventListener('click', () => openApplication('friends'));
document.querySelectorAll('.wake-layer').forEach(layer => layer.addEventListener('click', () => wake()));

$('#app-content').addEventListener('click', event => {
  const gameButton = event.target.closest('[data-game]');
  if (gameButton) return launchGame(gameButton.dataset.game);
  const vaultPageButton = event.target.closest('[data-vault-page]');
  if (vaultPageButton) {
    state.vaultPage = (state.vaultPage + Number(vaultPageButton.dataset.vaultPage) + VAULT_PAGE_COUNT) % VAULT_PAGE_COUNT;
    renderApplicationContent();
    tone(420, .035);
    sendAction('vaultPage', { page: state.vaultPage });
    return;
  }
  const setting = event.target.closest('[data-setting]')?.dataset.setting;
  if (setting === 'theme') {
    const themes = ['pearl', 'midnight', 'sunset'];
    setTheme(themes[(themes.indexOf(state.theme) + 1) % themes.length]);
    tone(760, .06);
    return;
  }
  if (setting === 'sound') return setMuted(!state.muted);
  if (setting === 'sleep') return sleep();
  const card = event.target.closest('[data-card]');
  if (!card) return;
  tone(690, .05);
  const title = card.dataset.card;
  const copy = 'FEATURE PREVIEW SELECTED ON THE TOUCH SCREEN';
  setNotice(title, copy);
  sendAction('notice', { title, copy });
});

$('#game-home').addEventListener('click', () => exitDuoGame());

function releaseGameButton(button) {
  if (!button.classList.contains('pressed')) return;
  button.classList.remove('pressed');
  sendGameInput(button.dataset.gameInput, false);
}

$('.game-controls').addEventListener('pointerdown', event => {
  if (config.mode === 'top' || !state.gameId) return;
  const button = event.target.closest('[data-game-input]');
  if (!button) return;
  event.preventDefault();
  button.classList.add('pressed');
  try { button.setPointerCapture(event.pointerId); } catch {}
  sendGameInput(button.dataset.gameInput, true);
});

['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
  $('.game-controls').addEventListener(type, event => {
    const button = event.target.closest?.('[data-game-input]');
    if (button) releaseGameButton(button);
  });
});

let swipe = null;
$('#tile-viewport').addEventListener('pointerdown', event => {
  if (config.mode === 'top' || booting || state.sleeping) return;
  swipe = { id: event.pointerId, startX: event.clientX, lastX: event.clientX };
  try { $('#tile-viewport').setPointerCapture(event.pointerId); } catch {}
});

$('#tile-viewport').addEventListener('pointermove', event => {
  if (!swipe || event.pointerId !== swipe.id) return;
  swipe.lastX = event.clientX;
  const delta = clamp(swipe.lastX - swipe.startX, -90, 90);
  if (Math.abs(delta) > 8) suppressTileClick = true;
  $('#tile-pages').style.transform = `translateX(${-state.page * 320 + delta}px)`;
});

function finishSwipe(event) {
  if (!swipe || event.pointerId !== swipe.id) return;
  const delta = swipe.lastX - swipe.startX;
  swipe = null;
  if (delta < -35) setPage(state.page + 1);
  else if (delta > 35) setPage(state.page - 1);
  else renderSelection();
  setTimeout(() => { suppressTileClick = false; }, 0);
}

$('#tile-viewport').addEventListener('pointerup', finishSwipe);
$('#tile-viewport').addEventListener('pointercancel', finishSwipe);

const keyMap = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  z: 'a', Z: 'a', Enter: 'a', x: 'b', X: 'b', Backspace: 'b', Shift: 'b',
  q: 'page-left', Q: 'page-left', e: 'page-right', E: 'page-right'
};

const gameKeyMap = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  z: 'a', Z: 'a', x: 'b', X: 'b', Enter: 'start', Shift: 'select'
};

document.addEventListener('keydown', event => {
  if (config.mode === 'top' || event.repeat) return;
  if (state.gameId) {
    if (event.key === 'Escape') {
      event.preventDefault();
      return exitDuoGame();
    }
    const gameKey = gameKeyMap[event.key];
    if (!gameKey) return;
    event.preventDefault();
    return sendGameInput(gameKey, true);
  }
  const key = keyMap[event.key];
  if (!key) return;
  event.preventDefault();
  if (state.sleeping) return wake();
  if (key === 'b') return closeApplication();
  if (state.openApp || booting) return;
  if (key === 'a') return openApplication();
  if (key === 'page-left') return setPage(state.page - 1);
  if (key === 'page-right') return setPage(state.page + 1);
  moveSelection(key);
});

document.addEventListener('keyup', event => {
  if (config.mode === 'top' || !state.gameId) return;
  const gameKey = gameKeyMap[event.key];
  if (!gameKey) return;
  event.preventDefault();
  sendGameInput(gameKey, false);
});

$('#top-screen').addEventListener('pointermove', event => {
  if (config.mode === 'bottom' || state.openApp || state.sleeping || booting) return;
  const bounds = $('#top-screen').getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width - .5) * 8;
  const y = ((event.clientY - bounds.top) / bounds.height - .5) * 5;
  $('#hero-icon').style.transform = `perspective(180px) translate(${x}px, ${y}px) rotateY(${x * .7}deg) rotateX(${-y * .8}deg)`;
});

$('#top-screen').addEventListener('pointerleave', () => $('#hero-icon').style.removeProperty('transform'));
window.addEventListener('message', event => {
  const frame = $('#game-frame');
  if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
  if (event.data?.type === 'ksr-duo-game-exit') exitDuoGame();
});
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('dragstart', event => event.preventDefault());
window.addEventListener('resize', fit);

sync.on('action', payload => applyAction(payload, false));
sync.on('snapshot', hydrate);
sync.on('status', status => {
  $('#wireless-state').textContent = status.connected ? 'DUO LINK' : status.label;
  $('#wireless-state').style.color = status.connected ? '#3fa75a' : '#c2822c';
});

window.addEventListener('beforeunload', () => {
  clearBootTimers();
  clearTimeout(settledSnapshotTimer);
  sync.close();
  audio?.close?.();
});

window.KSRDuo = Object.freeze({
  select,
  open: openApplication,
  play: launchGame,
  close: closeApplication,
  sleep,
  wake,
  mode: config.mode
});

fit();
runBoot();
sync.connect();
