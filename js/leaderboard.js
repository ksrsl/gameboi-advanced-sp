const DEFAULT_ENDPOINT = 'https://ksr-gameboi-leaderboard.felix-bruno-c.workers.dev';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const LEADERBOARD_GAMES = Object.freeze([
  { id: 'snake', title: 'NEON SERPENT', storageKey: 'snake:highScore', order: 'desc' },
  { id: 'block-drop', title: 'BLOCK DROP', storageKey: 'blockDrop:highScore', order: 'desc' },
  { id: 'brick-blaster', title: 'BRICK BLASTER', storageKey: 'brickBlaster:highScore', order: 'desc' },
  { id: 'astro-defender', title: 'ASTRO DEFENDER', storageKey: 'astroDefender:highScore', order: 'desc' },
  { id: 'pet-byte', title: 'KSR COMPANION', storageKey: 'petByte:bestLevel', order: 'desc', suffix: ' LV' },
  { id: 'byte-flyer', title: 'SKY PULSE', storageKey: 'byteFlyer:highScore', order: 'desc' },
  { id: 'road-rush', title: 'ROAD RUSH', storageKey: 'roadRush:highScore', order: 'desc' },
  { id: 'dungeon-byte', title: 'SHADOW CIRCUIT', storageKey: 'dungeonByte:bestFloor', order: 'desc', prefix: 'F' },
  { id: 'fishing-byte', title: 'NEON ANGLER', storageKey: 'fishingByte:bestSize', order: 'desc', encode: value => Math.round(Number(value) * 10), format: value => `${(value / 10).toFixed(1)}CM` },
  { id: 'maze-muncher', title: 'MAZE MUNCHER', storageKey: 'mazeMuncher:highScore', order: 'desc' },
  { id: 'mini-golf', title: 'MINI GOLF', storageKey: 'miniGolf:bestScore', order: 'asc', suffix: ' ST' },
  { id: 'pocket-tennis', title: 'POCKET TENNIS', storageKey: 'pocketTennis:wins', order: 'desc', suffix: ' W' },
  { id: 'pixel-kart', title: 'PIXEL KART', storageKey: 'pixelKart:bestTime', order: 'asc', format: value => formatTime(value) },
  { id: 'survivor-byte', title: 'NEON ONSLAUGHT', storageKey: 'survivorByte:highScore', order: 'desc' },
  { id: 'bomb-grid', title: 'BOMB GRID', storageKey: 'bombGrid:wins', order: 'desc', suffix: ' W' },
  { id: 'pixel-quest', title: 'PIXEL QUEST', storageKey: 'pixelQuest:highScore', order: 'desc' },
  { id: 'battle-tanks', title: 'BATTLE TANKS', storageKey: 'battleTanks:highScore', order: 'desc' },
  { id: 'pocket-fighter', title: 'POCKET FIGHTER', storageKey: 'pocketFighter:wins', order: 'desc', suffix: ' W' },
  { id: 'street-hoops', title: 'STREET HOOPS', storageKey: 'streetHoops:highScore', order: 'desc' },
  { id: 'pocket-bowling', title: 'POCKET BOWLING', storageKey: 'pocketBowling:bestScore', order: 'desc' },
  { id: 'neon-cycle', title: 'TRON CYCLE', storageKey: 'neonCycle:highScore', order: 'desc' }
]);

const gameById = new Map(LEADERBOARD_GAMES.map(game => [game.id, game]));
const gameByStorageKey = new Map(LEADERBOARD_GAMES.map(game => [game.storageKey, game]));

function formatTime(milliseconds) {
  const total = Math.max(0, Math.round(Number(milliseconds) || 0));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor(total % 60000 / 1000);
  const tenths = Math.floor(total % 1000 / 100);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

function normalizePlayer(player) {
  const residentId = String(player?.residentId || '').trim().toLowerCase();
  let residentName = String(player?.residentName || '').trim().toLowerCase();
  if (residentName.endsWith('.resident')) residentName = residentName.slice(0, -9);
  const displayName = String(player?.displayName || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 63);
  if (!UUID_PATTERN.test(residentId) || !residentName) return null;
  return Object.freeze({ residentId, residentName: residentName.slice(0, 63), displayName });
}

function endpointFromLocation() {
  const override = new URLSearchParams(location.search).get('leaderboard');
  const value = override || DEFAULT_ENDPOINT;
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function formatLeaderboardScore(gameId, score) {
  const game = gameById.get(gameId);
  const numericScore = Number(score) || 0;
  if (!game) return String(numericScore);
  if (typeof game.format === 'function') return game.format(numericScore);
  const digits = numericScore < 1000 ? 3 : 6;
  return `${game.prefix || ''}${String(numericScore).padStart(digits, '0')}${game.suffix || ''}`;
}

export class LeaderboardClient {
  constructor({ storage, endpoint = endpointFromLocation() } = {}) {
    this.storage = storage;
    this.endpoint = endpoint;
    this.player = null;
    this.playerSeenAt = 0;
    this.runGameId = '';
    this.runPlayer = null;
    this.authority = true;
    this.pending = new Map();
    this.submitted = new Map();
    this.unsubscribe = storage?.subscribe?.((key, value) => this.capture(key, value)) || (() => {});
  }

  get enabled() { return Boolean(this.endpoint); }

  setAuthority(value) {
    this.authority = Boolean(value);
  }

  identify(player) {
    const normalized = normalizePlayer(player);
    if (!normalized) return null;
    this.player = normalized;
    this.playerSeenAt = Date.now();
    if (this.runGameId && !this.runPlayer) this.runPlayer = normalized;
    return normalized;
  }

  beginGame(gameId) {
    this.runGameId = gameById.has(gameId) ? gameId : '';
    this.runPlayer = Date.now() - this.playerSeenAt < 15000 ? this.player : null;
  }

  endGame() {
    this.runGameId = '';
    this.runPlayer = null;
  }

  capture(storageKey, rawValue) {
    const game = gameByStorageKey.get(storageKey);
    if (!game || game.id !== this.runGameId || !this.runPlayer || !this.enabled || !this.authority) return;
    const encoded = typeof game.encode === 'function' ? game.encode(rawValue) : Math.round(Number(rawValue));
    if (!Number.isSafeInteger(encoded) || encoded <= 0) return;
    clearTimeout(this.pending.get(game.id));
    this.pending.set(game.id, setTimeout(() => this.submit(game, encoded, this.runPlayer), 350));
  }

  async submit(game, score, player) {
    this.pending.delete(game.id);
    const submissionKey = `${game.id}:${player.residentId}`;
    const previous = this.submitted.get(submissionKey);
    if (Number.isFinite(previous)) {
      if (game.order === 'asc' && score >= previous) return;
      if (game.order !== 'asc' && score <= previous) return;
    }
    try {
      const response = await fetch(`${this.endpoint}/v1/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, score, ...player }),
        signal: AbortSignal.timeout?.(6000)
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'SUBMIT_FAILED');
      this.submitted.set(submissionKey, Number(result.entry.score));
    } catch (error) {
      console.warn('Leaderboard score could not be submitted:', error.message);
    }
  }

  async scores(gameId, limit = 10) {
    const game = gameById.get(gameId);
    if (!game) throw new Error('UNKNOWN_GAME');
    if (!this.enabled) throw new Error('SERVICE_NOT_CONFIGURED');
    const response = await fetch(`${this.endpoint}/v1/leaderboard/${encodeURIComponent(gameId)}?limit=${limit}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout?.(6000)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'SERVICE_UNAVAILABLE');
    return result.entries || [];
  }

  close() {
    this.unsubscribe();
    this.pending.forEach(clearTimeout);
    this.pending.clear();
  }
}
