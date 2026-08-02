import { storage } from './storage.js?v=4.0.1';
import { registerCartridge, loadCartridge, listCartridges } from './game-loader.js';
import { GameSync, syncConfigFromLocation } from './sync.js?v=4.0.5';
import { setupPointerRelay } from './pointer-relay.js?v=4.0.5';
import { setupLslBridge } from './lsl-bridge.js?v=4.0.1';
import { createArcadeFX } from './arcade-fx.js?v=3.4.0';
import { LeaderboardClient } from './leaderboard.js?v=4.0.3';
import { createLeaderboardUI } from './leaderboard-ui.js?v=4.0.3';
import snakeCartridge from '../games/snake/snake.js?v=3.4.1';
import blockDropCartridge from '../games/block-drop/block-drop.js?v=3.0.1';
import brickBlasterCartridge from '../games/brick-blaster/brick-blaster.js?v=3.0.1';
import astroDefenderCartridge from '../games/astro-defender/astro-defender.js?v=3.0.1';
import petByteCartridge from '../games/pet-byte/pet-byte.js?v=3.2.3';
import byteFlyerCartridge from '../games/byte-flyer/byte-flyer.js?v=3.2.4';
import roadRushCartridge from '../games/road-rush/road-rush.js?v=3.0.0';
import dungeonByteCartridge from '../games/dungeon-byte/dungeon-byte.js?v=3.2.3';
import fishingByteCartridge from '../games/fishing-byte/fishing-byte.js?v=3.2.3';
import mazeMuncherCartridge from '../games/maze-muncher/maze-muncher.js?v=3.0.0';
import miniGolfCartridge from '../games/mini-golf/mini-golf.js?v=3.0.0';
import pocketTennisCartridge from '../games/pocket-tennis/pocket-tennis.js?v=3.0.0';
import pixelKartCartridge from '../games/pixel-kart/pixel-kart.js?v=3.2.4';
import survivorByteCartridge from '../games/survivor-byte/survivor-byte.js?v=3.2.3';
import bombGridCartridge from '../games/bomb-grid/bomb-grid.js?v=3.0.0';
import pixelQuestCartridge from '../games/pixel-quest/pixel-quest.js?v=3.0.0';
import battleTanksCartridge from '../games/battle-tanks/battle-tanks.js?v=3.0.0';
import pocketFighterCartridge from '../games/pocket-fighter/pocket-fighter.js?v=3.0.0';
import streetHoopsCartridge from '../games/street-hoops/street-hoops.js?v=4.0.1';
import pocketBowlingCartridge from '../games/pocket-bowling/pocket-bowling.js?v=3.0.0';
import neonCycleCartridge from '../games/neon-cycle/neon-cycle.js?v=3.3.0';

registerCartridge(snakeCartridge);
registerCartridge(blockDropCartridge);
registerCartridge(brickBlasterCartridge);
registerCartridge(astroDefenderCartridge);
registerCartridge(petByteCartridge);
registerCartridge(byteFlyerCartridge);
registerCartridge(roadRushCartridge);
registerCartridge(dungeonByteCartridge);
registerCartridge(fishingByteCartridge);
registerCartridge(mazeMuncherCartridge);
registerCartridge(miniGolfCartridge);
registerCartridge(pocketTennisCartridge);
registerCartridge(pixelKartCartridge);
registerCartridge(survivorByteCartridge);
registerCartridge(bombGridCartridge);
registerCartridge(pixelQuestCartridge);
registerCartridge(battleTanksCartridge);
registerCartridge(pocketFighterCartridge);
registerCartridge(streetHoopsCartridge);
registerCartridge(pocketBowlingCartridge);
registerCartridge(neonCycleCartridge);

const $ = selector => document.querySelector(selector);
const screens = [...document.querySelectorAll('.screen')];
const home = $('#home');
const host = $('#game-host');
const menuButtons = [...document.querySelectorAll('#main-menu button')];
const cartridgeButtons = [...document.querySelectorAll('#cartridge-menu button')];
const cartridgePage = $('#cartridge-page');
const cartridgeInfo = new Map(listCartridges().map(item => [item.id, item]));
const validInputs = new Set(['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select']);
const sync = new GameSync(syncConfigFromLocation());
const arcadeFx = createArcadeFX({ display: $('#display'), host, storage });
const leaderboard = new LeaderboardClient({ storage });
const mediaParams = new URLSearchParams(location.search);
const duoEmbedded = mediaParams.get('embed') === 'duo';
if (duoEmbedded) document.body.classList.add('duo-embed');
leaderboard.identify({
  residentId: mediaParams.get('ownerId'),
  residentName: mediaParams.get('ownerName'),
  displayName: mediaParams.get('ownerDisplay')
});
leaderboard.setAuthority(!sync.enabled || sync.isHost);
const CARTRIDGE_PAGE_SIZE = 7;
const CARTRIDGE_COLUMNS = 2;
const BOOT_DURATION_MS = 6500;

let menuIndex = 0;
let cartridgeIndex = 0;
let currentGame = null;
let currentGameId = '';
let gameLoadPromise = null;
let currentScreen = 'boot';
let currentPanel = '';
let muted = storage.get('muted', false);
let audio;
let audioBus;
let audioInput;
let powerTimer = null;
let bootTimers = [];
let viewerCount = 1;

const leaderboardUI = createLeaderboardUI({
  client: leaderboard,
  root: $('#panel-content'),
  tone,
  onExit: () => {
    show('home');
    publishConsole('home');
  }
});

function fitConsole() {
  const scaleX = window.innerWidth / 320;
  const scaleY = window.innerHeight / 240;
  $('#console').style.transform = `scale(${scaleX},${scaleY})`;
}

function show(id) {
  screens.forEach(screen => { screen.hidden = screen.id !== id; });
  currentScreen = id;
}

function clearBootSequence() {
  bootTimers.forEach(clearTimeout);
  bootTimers = [];
}

function scheduleBoot(callback, delay) {
  const timer = setTimeout(callback, delay);
  bootTimers.push(timer);
}

function restartBootAnimations() {
  const boot = $('#boot');
  const animatedElements = [...boot.querySelectorAll('*')];
  animatedElements.forEach(element => { element.style.animation = 'none'; });
  void boot.offsetWidth;
  animatedElements.forEach(element => { element.style.removeProperty('animation'); });
}

function runBootSequence({ publish = false, connectAfter = false, tvAnimation = false } = {}) {
  clearBootSequence();
  const boot = $('#boot');
  menuIndex = 0;
  menuButtons.forEach((button, index) => button.classList.toggle('selected', index === 0));
  $('#mute').hidden = false;
  $('#live-status').hidden = true;
  boot.classList.remove('tv-on');
  show('boot');
  restartBootAnimations();

  if (tvAnimation) {
    void boot.offsetWidth;
    boot.classList.add('tv-on');
    scheduleBoot(() => boot.classList.remove('tv-on'), 500);
  }

  scheduleBoot(() => tone(230, 0.035, 'square'), 1820);
  scheduleBoot(() => tone(330, 0.035, 'square'), 2220);
  scheduleBoot(() => tone(460, 0.04, 'triangle'), 2620);
  scheduleBoot(() => tone(620, 0.055, 'triangle'), 3020);
  scheduleBoot(() => tone(780, 0.07, 'sawtooth'), 3650);
  scheduleBoot(() => tone(900, 0.075, 'triangle'), 4850);
  scheduleBoot(() => {
    if (currentScreen !== 'boot') return;
    boot.classList.remove('tv-on');
    show('home');
    tone(720, 0.1);
    setTimeout(() => tone(1080, 0.14, 'triangle'), 100);
    if (sync.enabled) {
      $('#live-status').hidden = false;
      updateLiveBadge({ connected: sync.connected, label: sync.connected ? 'LIVE' : 'CONNECT' });
      if (connectAfter && !sync.connected) sync.connect();
    }
    if (publish) publishConsole('home');
  }, BOOT_DURATION_MS);
}

function tone(frequency = 440, duration = 0.06, type = 'square') {
  arcadeFx.tone(frequency, duration);
  if (muted) return;
  try {
    if (!audio) {
      const AudioEngine = window.AudioContext || window.webkitAudioContext;
      try {
        audio = new AudioEngine({ latencyHint: 'interactive' });
      } catch {
        audio = new AudioEngine();
      }
      const compressor = audio.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.12;
      audioBus = audio.createGain();
      audioBus.gain.value = 0.82;
      compressor.connect(audioBus).connect(audio.destination);
      audioInput = compressor;
    }
    if (audio.state === 'suspended') audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.04, audio.currentTime + Math.min(0.008, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(gain).connect(audioInput);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);

    if (duration >= 0.045) {
      const harmonic = audio.createOscillator();
      const harmonicGain = audio.createGain();
      harmonic.type = type === 'square' ? 'triangle' : 'sine';
      harmonic.frequency.value = frequency * 2.005;
      harmonicGain.gain.setValueAtTime(0.0001, audio.currentTime);
      harmonicGain.gain.exponentialRampToValueAtTime(0.007, audio.currentTime + 0.006);
      harmonicGain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration * 0.82);
      harmonic.connect(harmonicGain).connect(audioInput);
      harmonic.start();
      harmonic.stop(audio.currentTime + duration);
    }
  } catch {}
}

function setMuted(value) {
  muted = value;
  storage.set('muted', muted);
  $('#mute').textContent = muted ? '×' : '♪';
  $('#mute').setAttribute('aria-pressed', String(muted));
}

function selectMenu(delta) {
  menuIndex = (menuIndex + delta + menuButtons.length) % menuButtons.length;
  menuButtons.forEach((button, index) => button.classList.toggle('selected', index === menuIndex));
  tone(210, 0.025);
  publishConsole('home', { menuIndex });
}

function selectCartridge(delta) {
  cartridgeIndex = (cartridgeIndex + delta + cartridgeButtons.length) % cartridgeButtons.length;
  updateCartridgePage();
  cartridgeButtons.forEach((button, index) => button.classList.toggle('selected', index === cartridgeIndex));
  tone(235, 0.025);
  publishConsole('cartridges', { cartridgeIndex });
}

function moveCartridge(key) {
  const count = cartridgeButtons.length;
  const page = Math.floor(cartridgeIndex / CARTRIDGE_PAGE_SIZE);
  const pageCount = Math.ceil(count / CARTRIDGE_PAGE_SIZE);
  const pageStart = page * CARTRIDGE_PAGE_SIZE;
  const pageEnd = Math.min(count, pageStart + CARTRIDGE_PAGE_SIZE);
  const localIndex = cartridgeIndex - pageStart;
  const column = localIndex % CARTRIDGE_COLUMNS;
  const row = Math.floor(localIndex / CARTRIDGE_COLUMNS);
  const rows = Math.ceil((pageEnd - pageStart) / CARTRIDGE_COLUMNS);
  let next = cartridgeIndex;
  if (key === 'left') {
    if (column > 0) next -= 1;
    else if (page > 0) next = Math.max(0, cartridgeIndex - CARTRIDGE_PAGE_SIZE);
  }
  if (key === 'right') {
    if (column < CARTRIDGE_COLUMNS - 1 && next + 1 < pageEnd) next += 1;
    else if (page < pageCount - 1) next = Math.min(count - 1, cartridgeIndex + CARTRIDGE_PAGE_SIZE);
  }
  if (key === 'up') {
    const targetRow = (row + rows - 1) % rows;
    next = pageStart + targetRow * CARTRIDGE_COLUMNS + column;
    if (next >= pageEnd) next -= CARTRIDGE_COLUMNS;
  }
  if (key === 'down') {
    const targetRow = (row + 1) % rows;
    next = pageStart + targetRow * CARTRIDGE_COLUMNS + column;
    if (next >= pageEnd) next = pageStart + column;
  }
  if (next === cartridgeIndex) return;
  selectCartridge(next - cartridgeIndex);
}

function updateCartridgePage() {
  const page = Math.floor(cartridgeIndex / CARTRIDGE_PAGE_SIZE);
  const pageCount = Math.ceil(cartridgeButtons.length / CARTRIDGE_PAGE_SIZE);
  cartridgeButtons.forEach((button, index) => {
    button.hidden = Math.floor(index / CARTRIDGE_PAGE_SIZE) !== page;
  });
  cartridgePage.textContent = `PAGE ${page + 1}/${pageCount}`;
}

function publishConsole(screen, extra = {}) {
  sync.publish('console', { screen, ...extra });
}

function gameServices(gameId) {
  return {
    storage,
    tone,
    fx: arcadeFx,
    exit: () => {
      exitGame();
      if (duoEmbedded && (!sync.enabled || sync.isHost)) {
        window.parent.postMessage({ type: 'ksr-duo-game-exit' }, location.origin);
      }
    },
    requestInput,
    isAuthority: () => !sync.enabled || sync.isHost,
    publishState: snapshot => sync.publish(gameId, snapshot)
  };
}

async function startGame(gameId, snapshot = null) {
  if (currentGameId === gameId && currentGame) {
    if (snapshot) currentGame.hydrate?.(snapshot);
    return currentGame;
  }

  currentGame?.unmount?.();
  currentGame = null;
  currentGameId = gameId;
  leaderboard.beginGame(gameId);
  const manifest = cartridgeInfo.get(gameId);
  show('loading');
  $('#loading-name').textContent = manifest?.title?.toUpperCase() || 'UNKNOWN CARTRIDGE';

  gameLoadPromise = (async () => {
    await new Promise(resolve => setTimeout(resolve, 70));
    try {
      const game = await loadCartridge(gameId, host, gameServices(gameId));
      currentGame = game;
      currentGame.setAuthority?.(!sync.enabled || sync.isHost);
      if (snapshot) currentGame.hydrate?.(snapshot);
      show('game-host');
      arcadeFx.gameStart(gameId);
      if (!snapshot) publishConsole('game', { gameId });
      return game;
    } catch (error) {
      currentGameId = '';
      leaderboard.endGame();
      $('#error-message').textContent = error.message;
      show('error');
      return null;
    }
  })();

  return gameLoadPromise;
}

function exitGame({ publish = true } = {}) {
  currentGame?.unmount?.();
  currentGame = null;
  currentGameId = '';
  gameLoadPromise = null;
  leaderboard.endGame();
  host.replaceChildren();
  arcadeFx.gameEnd();
  show('home');
  if (publish) publishConsole('home');
}

function showCartridges() {
  updateCartridgePage();
  show('cartridges');
  publishConsole('cartridges');
}

function powerOff({ publish = true } = {}) {
  if (currentScreen === 'power-off' || currentScreen === 'powering-off') return;
  const visible = screens.find(screen => !screen.hidden);
  if (!visible) return;
  clearBootSequence();
  currentScreen = 'powering-off';
  $('#mute').hidden = true;
  $('#live-status').hidden = true;
  visible.classList.remove('tv-off');
  void visible.offsetWidth;
  visible.classList.add('tv-off');
  tone(150, 0.18, 'sawtooth');
  clearTimeout(powerTimer);
  powerTimer = setTimeout(() => {
    show('power-off');
    visible.classList.remove('tv-off');
    if (publish) publishConsole('power-off');
  }, 700);
}

function powerOn({ publish = true } = {}) {
  clearTimeout(powerTimer);
  runBootSequence({ publish, tvAnimation: true });
}

function panel(title, html) {
  currentPanel = title;
  $('#panel').classList.toggle('leaderboard-panel', title === 'LEADERBOARD');
  $('#panel-title').textContent = title;
  $('#panel-content').innerHTML = html;
  show('panel');
  publishConsole('panel', { panel: title });
}

function action(name) {
  tone(540, 0.04);
  if (name === 'play') showCartridges();
  if (name === 'leaderboard') {
    panel('LEADERBOARD', '');
    leaderboardUI.open();
  }
  if (name === 'settings') {
    panel('SETTINGS', `
      <div class="setting-row"><span>SOUND</span><button class="toggle" id="sound-setting">${muted ? 'OFF' : 'ON'}</button></div>
      <div class="setting-row"><span>ARCADE FX</span><button class="toggle" id="fx-setting">${arcadeFx.enabled ? 'ON' : 'OFF'}</button></div>
      <div class="setting-row"><span>SAVE DATA</span><button class="toggle" id="clear-save">CLEAR</button></div>
      <p>SMOOTH MOTION MODE KEEPS GAMEPLAY RESPONSIVE</p>
    `);
  }
  if (name === 'about') {
    panel('ABOUT', '<h2>KSR GAMEBOI SP</h2><p>CREATED BY CORP</p><p>KSR ARCADE SYSTEM</p><p>HIGH-DEFINITION ARCADE RENDERING</p><p>LOW-LATENCY MESH INPUT</p><p>21 CARTRIDGES INSTALLED</p>');
  }
  if (name === 'power') powerOff();
}

function applyInput(key, pressed = true) {
  arcadeFx.input(key, pressed);
  if (!pressed) {
    currentGame?.input?.(key, false);
    return;
  }
  if (currentScreen === 'power-off') {
    if (key === 'start' || key === 'a') powerOn();
    return;
  }
  if (currentScreen === 'powering-off') return;

  if (currentScreen === 'home') {
    if (key === 'up') selectMenu(-1);
    else if (key === 'down') selectMenu(1);
    else if (key === 'a' || key === 'start') action(menuButtons[menuIndex].dataset.action);
  } else if (currentScreen === 'cartridges') {
    if (key === 'up' || key === 'down' || key === 'left' || key === 'right') moveCartridge(key);
    else if (key === 'a' || key === 'start') startGame(cartridgeButtons[cartridgeIndex].dataset.game);
    else if (key === 'b' || key === 'select') { show('home'); publishConsole('home'); }
  } else if (currentScreen === 'panel') {
    if (currentPanel === 'LEADERBOARD') leaderboardUI.input(key, true);
    else if (key === 'b' || key === 'select') { show('home'); publishConsole('home'); }
    else if (key === 'a' && currentPanel === 'SETTINGS') {
      setMuted(!muted);
      const soundButton = $('#sound-setting');
      if (soundButton) soundButton.textContent = muted ? 'OFF' : 'ON';
    }
  } else {
    currentGame?.input?.(key, true);
  }
}

function requestInput(key, pressed = true, eventId) {
  if (!validInputs.has(key)) return;
  if (sync.enabled && !sync.isHost) return;
  if (sync.enabled) sync.sendInput(key, pressed, eventId);
  else applyInput(key, pressed);
}

function requestCommand(name, data, localAction) {
  if (sync.enabled && !sync.isHost) return;
  if (sync.enabled) sync.sendCommand(name, data);
  else localAction();
}

async function applyRemoteState(state) {
  if (!state || typeof state.gameId !== 'string') return;
  if (state.gameId === 'console') {
    const target = state.snapshot?.screen;
    if (Number.isInteger(state.snapshot?.menuIndex)) {
      menuIndex = Math.max(0, Math.min(menuButtons.length - 1, state.snapshot.menuIndex));
      menuButtons.forEach((button, index) => button.classList.toggle('selected', index === menuIndex));
    }
    if (Number.isInteger(state.snapshot?.cartridgeIndex)) {
      cartridgeIndex = Math.max(0, Math.min(cartridgeButtons.length - 1, state.snapshot.cartridgeIndex));
      updateCartridgePage();
      cartridgeButtons.forEach((button, index) => button.classList.toggle('selected', index === cartridgeIndex));
    }
    if (target === 'power-off') powerOff({ publish: false });
    else if (target === 'cartridges') show('cartridges');
    else if (target === 'home') exitGame({ publish: false });
    else if (target === 'game' && state.snapshot?.gameId) await startGame(state.snapshot.gameId);
    return;
  }
  await startGame(state.gameId, state.snapshot);
}

function applyCommand({ name, data }) {
  if (name === 'menuAction') action(data.name);
  if (name === 'launchGame') startGame(data.gameId);
  if (name === 'back') { exitGame(); }
  if (name === 'powerOn') powerOn();
}

function updateLiveBadge(status = {}) {
  if (!sync.enabled) return;
  const badge = $('#live-status');
  badge.hidden = currentScreen === 'power-off' || currentScreen === 'powering-off';
  badge.classList.toggle('offline', !status.connected);
  badge.textContent = status.connected ? `LIVE ${viewerCount}` : (status.label || 'CONNECT');
}

const keyMap = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  z: 'a', Z: 'a', x: 'b', X: 'b', Enter: 'start', Shift: 'select'
};

window.addEventListener('resize', fitConsole);
fitConsole();

host.addEventListener('pointerdown', event => {
  if (event.target instanceof HTMLCanvasElement && event.target.setPointerCapture) {
    try { event.target.setPointerCapture(event.pointerId); } catch {}
  }
}, true);
const pointerRelay = setupPointerRelay({ root: host, sync });
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('dragstart', event => event.preventDefault());

document.addEventListener('keydown', event => {
  const key = keyMap[event.key];
  if (!key || event.repeat) return;
  event.preventDefault();
  requestInput(key);
});

document.addEventListener('keyup', event => {
  const key = keyMap[event.key];
  if (!key) return;
  event.preventDefault();
  requestInput(key, false);
});

function readHashInput() {
  const params = new URLSearchParams(location.hash.slice(1));
  const key = params.get('input');
  if (!key) return;
  leaderboard.identify({
    residentId: params.get('residentId'),
    residentName: params.get('residentName'),
    displayName: params.get('displayName')
  });
  leaderboardUI.refreshIdentity();
  if (sync.enabled) sync.sendInput(key.toLowerCase(), true, `lsl-${params.get('seq') || location.hash}`);
  else requestInput(key.toLowerCase());
}

const lslBridge = setupLslBridge({
  onIdentity(player) {
    leaderboard.identify(player);
    leaderboardUI.refreshIdentity();
  },
  onInput(key, pressed, sequence) {
    if (sync.enabled) {
      sync.sendInput(key, pressed, `lsl-bridge-${sequence}`);
      return;
    }
    applyInput(key, pressed);
  }
});

window.GameBoiSP = Object.freeze({ press: requestInput, bridge: lslBridge.enabled });
window.addEventListener('message', event => {
  if (!duoEmbedded || event.source !== window.parent || event.origin !== location.origin) return;
  const message = event.data;
  if (!message || message.type !== 'ksr-duo-input') return;
  const key = String(message.key || '').toLowerCase();
  if (!validInputs.has(key)) return;
  requestInput(key, message.pressed !== false, String(message.eventId || ''));
});
window.addEventListener('hashchange', readHashInput);
if (location.hash) queueMicrotask(readHashInput);
document.addEventListener('gameboi-input', event => requestInput(String(event.detail?.key || '').toLowerCase(), event.detail?.pressed !== false));

// Cartridge title and exit buttons used to act only in the viewer that clicked
// them. Capture those clicks before the cartridge handles them and turn them
// into normal console inputs so the relay delivers the action to every viewer.
host.addEventListener('click', event => {
  const button = event.target.closest?.('button');
  if (!button || !host.contains(button)) return;

  const action = Object.values(button.dataset).find(value => value === 'start' || value === 'exit');
  if (!action) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  const key = action === 'exit' ? 'select' : 'a';
  requestInput(key, true);
  queueMicrotask(() => requestInput(key, false));
}, true);

menuButtons.forEach((button, index) => button.addEventListener('click', () => {
  menuIndex = index;
  menuButtons.forEach((item, itemIndex) => item.classList.toggle('selected', itemIndex === index));
  requestCommand('menuAction', { name: button.dataset.action }, () => action(button.dataset.action));
}));

cartridgeButtons.forEach((button, index) => button.addEventListener('click', () => {
  cartridgeIndex = index;
  updateCartridgePage();
  cartridgeButtons.forEach((item, itemIndex) => item.classList.toggle('selected', itemIndex === index));
  requestCommand('launchGame', { gameId: button.dataset.game }, () => startGame(button.dataset.game));
}));

$('#panel-back').addEventListener('click', () => {
  if (currentPanel === 'LEADERBOARD') leaderboardUI.input('b', true);
  else requestCommand('back', {}, () => { show('home'); publishConsole('home'); });
});
$('#cartridge-back').addEventListener('click', () => requestCommand('back', {}, () => { show('home'); publishConsole('home'); }));
$('#error-back').addEventListener('click', () => requestCommand('back', {}, () => exitGame()));
$('#power-on').addEventListener('click', () => requestCommand('powerOn', {}, () => powerOn()));
$('#mute').addEventListener('click', () => setMuted(!muted));

$('#panel-content').addEventListener('click', event => {
  if (currentPanel === 'LEADERBOARD' && leaderboardUI.click(event)) return;
  if (event.target.id === 'sound-setting') {
    setMuted(!muted);
    event.target.textContent = muted ? 'OFF' : 'ON';
  }
  if (event.target.id === 'fx-setting') {
    arcadeFx.setEnabled(!arcadeFx.enabled);
    event.target.textContent = arcadeFx.enabled ? 'ON' : 'OFF';
  }
  if (event.target.id === 'clear-save' && confirm('Clear all KSR Gameboi save data?')) {
    storage.remove('snake:highScore');
    storage.remove('blockDrop:highScore');
    storage.remove('brickBlaster:highScore');
    storage.remove('brickBlaster:bestLevel');
    storage.remove('astroDefender:highScore');
    storage.remove('astroDefender:bestWave');
    storage.remove('petByte:bestLevel');
    storage.remove('petByte:save');
    storage.remove('byteFlyer:highScore');
    storage.remove('byteFlyer:coins');
    storage.remove('byteFlyer:skin');
    storage.remove('roadRush:highScore');
    storage.remove('roadRush:tokens');
    storage.remove('roadRush:car');
    storage.remove('dungeonByte:run');
    storage.remove('dungeonByte:bestFloor');
    storage.remove('dungeonByte:highGold');
    storage.remove('fishingByte:save');
    storage.remove('fishingByte:species');
    storage.remove('fishingByte:bestSize');
    storage.remove('mazeMuncher:highScore');
    storage.remove('miniGolf:bestScore');
    storage.remove('pocketTennis:wins');
    storage.remove('pixelKart:bestTime');
    storage.remove('pixelKart:bestTimes');
    storage.remove('pixelKart:track');
    storage.remove('survivorByte:highScore');
    storage.remove('survivorByte:bestTime');
    storage.remove('bombGrid:wins');
    storage.remove('pixelQuest:highScore');
    storage.remove('pixelQuest:bestStage');
    storage.remove('battleTanks:highScore');
    storage.remove('pocketFighter:wins');
    storage.remove('streetHoops:highScore');
    storage.remove('streetHoops:wins');
    storage.remove('streetHoops:bestStreak');
    storage.remove('pocketBowling:bestScore');
    storage.remove('neonCycle:highScore');
    storage.remove('neonCycle:wins');
    event.target.textContent = 'CLEARED';
  }
});

sync.on('input', ({ key, pressed }) => applyInput(key, pressed));
sync.on('pointer', pointerRelay.replay);
sync.on('command', applyCommand);
sync.on('state', applyRemoteState);
sync.on('role', ({ host: authority }) => {
  currentGame?.setAuthority?.(authority);
  leaderboard.setAuthority(authority);
});
sync.on('viewers', count => { viewerCount = count; updateLiveBadge({ connected: sync.connected, label: 'LIVE' }); });
sync.on('status', updateLiveBadge);
window.addEventListener('beforeunload', () => {
  arcadeFx.close();
  lslBridge.close();
  leaderboard.close();
  pointerRelay.close();
  sync.close();
});

setMuted(muted);
updateCartridgePage();
const directGame = mediaParams.get('game') || '';
if (duoEmbedded && cartridgeInfo.has(directGame)) {
  $('#mute').hidden = true;
  $('#live-status').hidden = true;
  sync.connect();
  startGame(directGame);
} else {
  runBootSequence({ connectAfter: true });
}
