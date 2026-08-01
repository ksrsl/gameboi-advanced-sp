import { LEADERBOARD_GAMES, formatLeaderboardScore } from './leaderboard.js?v=4.0.0';

const PICKER_PAGE_SIZE = 6;
const SCORE_PAGE_SIZE = 5;

export function createLeaderboardUI({ client, root, tone, onExit }) {
  let view = 'picker';
  let gameIndex = 0;
  let scorePage = 0;
  let entries = [];
  let state = 'ready';
  let requestNumber = 0;

  const game = () => LEADERBOARD_GAMES[gameIndex];
  const playerLabel = () => client.player ? `PLAYER: ${client.player.residentName.toUpperCase()}` : 'PRESS A MESH BUTTON TO IDENTIFY';

  function renderPicker() {
    const page = Math.floor(gameIndex / PICKER_PAGE_SIZE);
    const pages = Math.ceil(LEADERBOARD_GAMES.length / PICKER_PAGE_SIZE);
    const start = page * PICKER_PAGE_SIZE;
    const visible = LEADERBOARD_GAMES.slice(start, start + PICKER_PAGE_SIZE);
    root.innerHTML = `
      <section class="leaderboard-screen leaderboard-picker">
        <div class="leaderboard-subtitle"><b>PICK GAME</b><span>${playerLabel()}</span></div>
        <div class="leaderboard-games">
          ${visible.map((item, offset) => `<button data-leaderboard-game="${start + offset}" class="${start + offset === gameIndex ? 'selected' : ''}"><i>${String(start + offset + 1).padStart(2, '0')}</i><span>${item.title}</span></button>`).join('')}
        </div>
        <footer><span>D-PAD MOVE</span><b>PAGE ${page + 1}/${pages}</b><span>A OPEN · B BACK</span></footer>
      </section>`;
  }

  function renderScores() {
    const pages = Math.max(1, Math.ceil(entries.length / SCORE_PAGE_SIZE));
    scorePage = Math.min(scorePage, pages - 1);
    const visible = entries.slice(scorePage * SCORE_PAGE_SIZE, (scorePage + 1) * SCORE_PAGE_SIZE);
    let body = '';
    if (state === 'loading') body = '<div class="leaderboard-state"><i></i><b>LOADING HIGHEST SCORES</b></div>';
    else if (state === 'error') body = '<div class="leaderboard-state error"><b>SCORE NETWORK OFFLINE</b><span>PRESS A TO RETRY</span></div>';
    else if (!visible.length) body = '<div class="leaderboard-state"><b>NO SCORES YET</b><span>BE THE FIRST ON THE BOARD</span></div>';
    else body = `<ol class="leaderboard-scores">${visible.map(entry => `
      <li><b>${String(entry.rank).padStart(2, '0')}</b><span>${String(entry.residentName || 'RESIDENT').toUpperCase()}</span><strong>${formatLeaderboardScore(game().id, entry.score)}</strong></li>`).join('')}</ol>`;
    root.innerHTML = `
      <section class="leaderboard-screen leaderboard-list">
        <div class="leaderboard-subtitle"><b>HIGHEST SCORES</b><span>${game().title}</span></div>
        ${body}
        <footer><button data-leaderboard-action="games">B · GAMES</button><b>PAGE ${scorePage + 1}/${pages}</b><span>A REFRESH</span></footer>
      </section>`;
  }

  function select(delta) {
    const count = LEADERBOARD_GAMES.length;
    const page = Math.floor(gameIndex / PICKER_PAGE_SIZE);
    const start = page * PICKER_PAGE_SIZE;
    const end = Math.min(count, start + PICKER_PAGE_SIZE);
    const local = gameIndex - start;
    const column = local % 2;
    let next = gameIndex;
    if (delta === 'left') next = column ? gameIndex - 1 : Math.max(0, gameIndex - PICKER_PAGE_SIZE);
    if (delta === 'right') next = !column && gameIndex + 1 < end ? gameIndex + 1 : Math.min(count - 1, gameIndex + PICKER_PAGE_SIZE);
    if (delta === 'up') next = gameIndex - 2 >= start ? gameIndex - 2 : Math.min(end - 1, gameIndex + 4);
    if (delta === 'down') next = gameIndex + 2 < end ? gameIndex + 2 : start + column;
    gameIndex = Math.max(0, Math.min(count - 1, next));
    tone(235, .025);
    renderPicker();
  }

  async function openScores() {
    view = 'scores';
    scorePage = 0;
    entries = [];
    state = 'loading';
    renderScores();
    tone(540, .04);
    const activeRequest = ++requestNumber;
    try {
      entries = await client.scores(game().id, 10);
      state = 'ready';
    } catch {
      state = 'error';
    }
    if (activeRequest === requestNumber && view === 'scores') renderScores();
  }

  function backToPicker() {
    requestNumber += 1;
    view = 'picker';
    renderPicker();
    tone(190, .035);
  }

  function input(key, pressed = true) {
    if (!pressed) return true;
    if (view === 'picker') {
      if (['up', 'down', 'left', 'right'].includes(key)) select(key);
      else if (key === 'a' || key === 'start') openScores();
      else if (key === 'b' || key === 'select') onExit();
      return true;
    }
    if (key === 'b' || key === 'select') backToPicker();
    else if (key === 'left' || key === 'up') { scorePage = Math.max(0, scorePage - 1); renderScores(); }
    else if (key === 'right' || key === 'down') { scorePage += 1; renderScores(); }
    else if (key === 'a' || key === 'start') openScores();
    return true;
  }

  function click(event) {
    const gameButton = event.target.closest?.('[data-leaderboard-game]');
    if (gameButton) {
      gameIndex = Number(gameButton.dataset.leaderboardGame) || 0;
      openScores();
      return true;
    }
    if (event.target.closest?.('[data-leaderboard-action="games"]')) {
      backToPicker();
      return true;
    }
    return false;
  }

  return Object.freeze({
    open() { view = 'picker'; renderPicker(); },
    refreshIdentity() { if (view === 'picker') renderPicker(); },
    input,
    click
  });
}
