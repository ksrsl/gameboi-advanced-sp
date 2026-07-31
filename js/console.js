import { storage } from './storage.js';
import { registerCartridge, loadCartridge, listCartridges } from './game-loader.js';
import { GameSync, syncConfigFromLocation } from './sync.js';
import snakeCartridge from '../games/snake/snake.js?v=2.0.3';
import blockDropCartridge from '../games/block-drop/block-drop.js?v=2.0.3';
import brickBlasterCartridge from '../games/brick-blaster/brick-blaster.js?v=2.0.3';
import astroDefenderCartridge from '../games/astro-defender/astro-defender.js?v=2.0.3';
import petByteCartridge from '../games/pet-byte/pet-byte.js?v=2.0.3';
import byteFlyerCartridge from '../games/byte-flyer/byte-flyer.js?v=2.0.3';
import roadRushCartridge from '../games/road-rush/road-rush.js?v=2.0.3';
import dungeonByteCartridge from '../games/dungeon-byte/dungeon-byte.js?v=2.0.3';
import fishingByteCartridge from '../games/fishing-byte/fishing-byte.js?v=2.0.3';
import mazeMuncherCartridge from '../games/maze-muncher/maze-muncher.js?v=2.1.2';
import miniGolfCartridge from '../games/mini-golf/mini-golf.js?v=2.1.0';
import pocketTennisCartridge from '../games/pocket-tennis/pocket-tennis.js?v=2.1.2';
import pixelKartCartridge from '../games/pixel-kart/pixel-kart.js?v=2.1.2';
import survivorByteCartridge from '../games/survivor-byte/survivor-byte.js?v=2.2.0';
import bombGridCartridge from '../games/bomb-grid/bomb-grid.js?v=2.2.0';
import pixelQuestCartridge from '../games/pixel-quest/pixel-quest.js?v=2.2.0';
import battleTanksCartridge from '../games/battle-tanks/battle-tanks.js?v=2.2.0';
import pocketFighterCartridge from '../games/pocket-fighter/pocket-fighter.js?v=2.2.0';
import streetHoopsCartridge from '../games/street-hoops/street-hoops.js?v=2.2.0';
import pocketBowlingCartridge from '../games/pocket-bowling/pocket-bowling.js?v=2.2.0';

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

const $ = selector => document.querySelector(selector);
const screens = [...document.querySelectorAll('.screen')];
const home = $('#home');
const host = $('#game-host');
const menuButtons = [...document.querySelectorAll('#main-menu button')];
const cartridgeButtons = [...document.querySelectorAll('#cartridge-menu button')];
const cartridgeInfo = new Map(listCartridges().map(item => [item.id, item]));
const validInputs = new Set(['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select']);
const sync = new GameSync(syncConfigFromLocation());

let menuIndex = 0;
let cartridgeIndex = 0;
let currentGame = null;
let currentGameId = '';
let gameLoadPromise = null;
let currentScreen = 'boot';
let currentPanel = '';
let muted = storage.get('muted', false);
let audio;
let powerTimer = null;
let viewerCount = 1;

function fitConsole() {
  const scaleX = window.innerWidth / 320;
  const scaleY = window.innerHeight / 240;
  $('#console').style.transform = `scale(${scaleX},${scaleY})`;
}

function show(id) {
  screens.forEach(screen => { screen.hidden = screen.id !== id; });
  currentScreen = id;
}

function tone(frequency = 440, duration = 0.06, type = 'square') {
  if (muted) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.04, audio.currentTime + Math.min(0.008, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
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
  cartridgeButtons.forEach((button, index) => button.classList.toggle('selected', index === cartridgeIndex));
  tone(235, 0.025);
  publishConsole('cartridges', { cartridgeIndex });
}

function moveCartridge(key) {
  const count = cartridgeButtons.length;
  const columns = 3;
  const column = cartridgeIndex % columns;
  let next = cartridgeIndex;
  if (key === 'left' && column > 0) next -= 1;
  if (key === 'right' && column < columns - 1 && next + 1 < count) next += 1;
  if (key === 'up') {
    next -= columns;
    if (next < 0) {
      next = count - 1;
      while (next >= 0 && next % columns !== column) next -= 1;
      if (next < 0) next = count - 1;
    }
  }
  if (key === 'down') {
    next += columns;
    if (next >= count) next = column < count ? column : 0;
  }
  if (next === cartridgeIndex) return;
  selectCartridge(next - cartridgeIndex);
}

function publishConsole(screen, extra = {}) {
  sync.publish('console', { screen, ...extra });
}

function gameServices(gameId) {
  return {
    storage,
    tone,
    exit: () => exitGame(),
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
  const manifest = cartridgeInfo.get(gameId);
  show('loading');
  $('#loading-name').textContent = manifest?.title?.toUpperCase() || 'UNKNOWN CARTRIDGE';

  gameLoadPromise = (async () => {
    await new Promise(resolve => setTimeout(resolve, 220));
    try {
      const game = await loadCartridge(gameId, host, gameServices(gameId));
      currentGame = game;
      currentGame.setAuthority?.(!sync.enabled || sync.isHost);
      if (snapshot) currentGame.hydrate?.(snapshot);
      show('game-host');
      if (!snapshot) publishConsole('game', { gameId });
      return game;
    } catch (error) {
      currentGameId = '';
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
  host.replaceChildren();
  show('home');
  if (publish) publishConsole('home');
}

function showCartridges() {
  show('cartridges');
  publishConsole('cartridges');
}

function powerOff({ publish = true } = {}) {
  if (currentScreen === 'power-off' || currentScreen === 'powering-off') return;
  const visible = screens.find(screen => !screen.hidden);
  if (!visible) return;
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
  $('#mute').hidden = false;
  $('#live-status').hidden = !sync.enabled;
  home.classList.remove('tv-on');
  void home.offsetWidth;
  home.classList.add('tv-on');
  show('home');
  tone(420, 0.06);
  setTimeout(() => tone(720, 0.08), 80);
  setTimeout(() => home.classList.remove('tv-on'), 500);
  if (publish) publishConsole('home');
}

function panel(title, html) {
  currentPanel = title;
  $('#panel-title').textContent = title;
  $('#panel-content').innerHTML = html;
  show('panel');
  publishConsole('panel', { panel: title });
}

function action(name) {
  tone(540, 0.04);
  if (name === 'play') showCartridges();
  if (name === 'scores') {
    panel('HIGH SCORES', `
      <div class="score-list">
        <div><span>SNAKE BYTE</span><b>${String(storage.get('snake:highScore', 0)).padStart(6, '0')}</b></div>
        <div><span>BLOCK DROP</span><b>${String(storage.get('blockDrop:highScore', 0)).padStart(6, '0')}</b></div>
        <div><span>BRICK BLASTER</span><b>${String(storage.get('brickBlaster:highScore', 0)).padStart(6, '0')} / L${String(storage.get('brickBlaster:bestLevel', 1)).padStart(2, '0')}</b></div>
        <div><span>ASTRO DEFENDER</span><b>${String(storage.get('astroDefender:highScore', 0)).padStart(6, '0')} / W${String(storage.get('astroDefender:bestWave', 1)).padStart(2, '0')}</b></div>
        <div><span>PET BYTE</span><b>LEVEL ${String(storage.get('petByte:bestLevel', 1)).padStart(2, '0')}</b></div>
        <div><span>BYTE FLYER</span><b>${String(storage.get('byteFlyer:highScore', 0)).padStart(3, '0')}</b></div>
        <div><span>ROAD RUSH</span><b>${String(storage.get('roadRush:highScore', 0)).padStart(5, '0')}</b></div>
        <div><span>DUNGEON BYTE</span><b>F${String(storage.get('dungeonByte:bestFloor', 1)).padStart(2, '0')}</b></div>
        <div><span>FISHING BYTE</span><b>${String(storage.get('fishingByte:species', 0))}/8 • ${String(Math.floor(storage.get('fishingByte:bestSize', 0))).padStart(3, '0')}CM</b></div>
        <div><span>MAZE MUNCHER</span><b>${String(storage.get('mazeMuncher:highScore', 0)).padStart(6, '0')}</b></div>
        <div><span>MINI GOLF</span><b>${storage.get('miniGolf:bestScore', 0) || '--'} STROKES</b></div>
        <div><span>POCKET TENNIS</span><b>${String(storage.get('pocketTennis:wins', 0)).padStart(3, '0')} WINS</b></div>
        <div><span>PIXEL KART</span><b>${storage.get('pixelKart:bestTime', 0) ? (storage.get('pixelKart:bestTime', 0) / 1000).toFixed(1) + 'S' : '--'}</b></div>
        <div><span>SURVIVOR BYTE</span><b>${String(storage.get('survivorByte:highScore', 0)).padStart(6, '0')}</b></div>
        <div><span>BOMB GRID</span><b>${String(storage.get('bombGrid:wins', 0)).padStart(3, '0')} WINS</b></div>
        <div><span>PIXEL QUEST</span><b>${String(storage.get('pixelQuest:highScore', 0)).padStart(6, '0')}</b></div>
        <div><span>BATTLE TANKS</span><b>${String(storage.get('battleTanks:highScore', 0)).padStart(6, '0')}</b></div>
        <div><span>POCKET FIGHTER</span><b>${String(storage.get('pocketFighter:wins', 0)).padStart(3, '0')} WINS</b></div>
        <div><span>STREET HOOPS</span><b>${String(storage.get('streetHoops:highScore', 0)).padStart(3, '0')}</b></div>
        <div><span>POCKET BOWLING</span><b>${String(storage.get('pocketBowling:bestScore', 0)).padStart(3, '0')}</b></div>
      </div>
    `);
  }
  if (name === 'settings') {
    panel('SETTINGS', `
      <div class="setting-row"><span>SOUND</span><button class="toggle" id="sound-setting">${muted ? 'OFF' : 'ON'}</button></div>
      <div class="setting-row"><span>SAVE DATA</span><button class="toggle" id="clear-save">CLEAR</button></div>
      <p>A TOGGLE SOUND • B BACK</p>
    `);
  }
  if (name === 'about') {
    panel('ABOUT', '<h2>KSR GAMEBOI SP</h2><p>KSR SYSTEM SOFTWARE v2.2</p><p>HIGH-DEFINITION RENDERING</p><p>20 CARTRIDGES INSTALLED</p>');
  }
  if (name === 'power') powerOff();
}

function applyInput(key, pressed = true) {
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
    if (key === 'b' || key === 'select') { show('home'); publishConsole('home'); }
    else if (key === 'a' && currentPanel === 'SETTINGS') {
      setMuted(!muted);
      const soundButton = $('#sound-setting');
      if (soundButton) soundButton.textContent = muted ? 'OFF' : 'ON';
    }
  } else {
    currentGame?.input?.(key, true);
  }
}

function requestInput(key) {
  if (!validInputs.has(key)) return;
  if (sync.enabled) sync.sendInput(key);
  else applyInput(key, true);
}

function requestCommand(name, data, localAction) {
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
  if (!sync.enabled) applyInput(key, false);
});

function readHashInput() {
  const params = new URLSearchParams(location.hash.slice(1));
  const key = params.get('input');
  if (!key) return;
  if (sync.enabled) sync.sendInput(key.toLowerCase(), `lsl-${params.get('seq') || location.hash}`);
  else requestInput(key.toLowerCase());
}

window.GameBoiSP = Object.freeze({ press: requestInput });
window.addEventListener('hashchange', readHashInput);
if (location.hash) queueMicrotask(readHashInput);
document.addEventListener('gameboi-input', event => requestInput(String(event.detail?.key || '').toLowerCase()));

menuButtons.forEach((button, index) => button.addEventListener('click', () => {
  menuIndex = index;
  menuButtons.forEach((item, itemIndex) => item.classList.toggle('selected', itemIndex === index));
  requestCommand('menuAction', { name: button.dataset.action }, () => action(button.dataset.action));
}));

cartridgeButtons.forEach((button, index) => button.addEventListener('click', () => {
  cartridgeIndex = index;
  cartridgeButtons.forEach((item, itemIndex) => item.classList.toggle('selected', itemIndex === index));
  requestCommand('launchGame', { gameId: button.dataset.game }, () => startGame(button.dataset.game));
}));

$('#panel-back').addEventListener('click', () => requestCommand('back', {}, () => { show('home'); publishConsole('home'); }));
$('#cartridge-back').addEventListener('click', () => requestCommand('back', {}, () => { show('home'); publishConsole('home'); }));
$('#error-back').addEventListener('click', () => requestCommand('back', {}, () => exitGame()));
$('#power-on').addEventListener('click', () => requestCommand('powerOn', {}, () => powerOn()));
$('#mute').addEventListener('click', () => setMuted(!muted));

$('#panel-content').addEventListener('click', event => {
  if (event.target.id === 'sound-setting') {
    setMuted(!muted);
    event.target.textContent = muted ? 'OFF' : 'ON';
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
    storage.remove('pocketBowling:bestScore');
    event.target.textContent = 'CLEARED';
  }
});

sync.on('input', key => applyInput(key, true));
sync.on('command', applyCommand);
sync.on('state', applyRemoteState);
sync.on('role', ({ host: authority }) => currentGame?.setAuthority?.(authority));
sync.on('viewers', count => { viewerCount = count; updateLiveBadge({ connected: sync.connected, label: 'LIVE' }); });
sync.on('status', updateLiveBadge);
window.addEventListener('beforeunload', () => sync.close());

setMuted(muted);
setTimeout(() => {
  if (currentScreen === 'boot') show('home');
  tone(660, 0.08);
  setTimeout(() => tone(880, 0.1), 90);
  if (sync.enabled) {
    $('#live-status').hidden = false;
    updateLiveBadge({ connected: false, label: 'CONNECT' });
    sync.connect();
  }
}, 1900);
