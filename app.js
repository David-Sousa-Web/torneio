/* ============================================
   CHIMPAS LEAGUE — Tournament Logic
   ============================================ */

const PLAYERS = [
  'David', 'Flavio', 'Gustavo', 'Arroz', 'Bloado',
  'Fabricio', 'Global', 'Gordo', 'MV', 'Pericles'
];

const CL_TEAMS = [
  { name: 'Real Madrid',        short: 'R. Madrid',  logo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',                                               color: '#FEBE10', initials: 'RM' },
  { name: 'Manchester City',    short: 'Man City',   logo: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',                                      color: '#6CABDD', initials: 'MC' },
  { name: 'Bayern Munich',      short: 'Bayern',     logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg',                  color: '#DC052D', initials: 'BM' },
  { name: 'Liverpool',          short: 'Liverpool',  logo: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',                                                  color: '#C8102E', initials: 'LV' },
  { name: 'Arsenal',            short: 'Arsenal',    logo: 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',                                                    color: '#EF0107', initials: 'AR' },
  { name: 'PSG',                short: 'PSG',        logo: 'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg',                                     color: '#004170', initials: 'PS' },
  { name: 'Inter Milan',        short: 'Inter',      logo: 'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg',                            color: '#0068A8', initials: 'IM' },
  { name: 'Barcelona',          short: 'Barça',      logo: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',                                     color: '#A50044', initials: 'FC' },
  { name: 'Atlético Madrid',    short: 'Atlético',   logo: 'https://media.api-sports.io/football/teams/530.png',                                                                    color: '#CB3524', initials: 'AT' },
  { name: 'Borussia Dortmund',  short: 'Dortmund',   logo: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg',                                  color: '#FDE100', initials: 'BD' }
];

// ---- State ----
let S = {};

// ============================================
// INIT
// ============================================
window.addEventListener('DOMContentLoaded', () => {
  // Set background images
  const bgImg = "url('background.jpg')";
  document.querySelectorAll('.bg-image').forEach(el => {
    el.style.backgroundImage = bgImg;
  });

  const saved = localStorage.getItem('chimpas_v3');
  if (saved) {
    try {
      S = JSON.parse(saved);
      restoreScreen();
      return;
    } catch (e) { /* fall through */ }
  }
  S = { screen: 'splash', playerTeams: null, matches: null };
  showScreen('splash');
});

function save() {
  localStorage.setItem('chimpas_v3', JSON.stringify(S));
}

function restoreScreen() {
  const s = S.screen;
  if (s === 'draw')         { showScreen('draw');         renderDrawComplete(); }
  else if (s === 'bracket-draw')  { showScreen('bracket-draw');  renderBracketDrawComplete(); }
  else if (s === 'tournament')    { showScreen('tournament');    renderTournament(); }
  else if (s === 'champion')      { showScreen('champion');      renderChampion(); }
  else                            { showScreen('splash'); }
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) {
    el.classList.add('active');
    S.screen = name;
    save();
  }
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================
// SPLASH → DRAW TEAMS
// ============================================
function startDraw() {
  const teamOrder = shuffleArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  S.playerTeams = teamOrder; // S.playerTeams[playerIdx] = teamIdx
  save();
  showScreen('draw');
  renderDrawAnimated();
}

// ---- Helpers ----
function teamOf(playerIdx) { return CL_TEAMS[S.playerTeams[playerIdx]]; }

function logoImg(team, cssClass) {
  return `<img src="${team.logo}" alt="${team.name}" class="${cssClass}"
    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <div class="card-logo-fallback" style="display:none;background:${team.color};color:#000">${team.initials}</div>`;
}

// ---- Draw animated ----
function renderDrawAnimated() {
  const grid = document.getElementById('draw-cards');
  grid.innerHTML = '';
  document.getElementById('draw-btn-row').classList.add('hidden');

  PLAYERS.forEach((name, i) => {
    grid.appendChild(buildDrawCard(i, false));
  });

  PLAYERS.forEach((_, i) => {
    setTimeout(() => {
      const wrap = document.getElementById(`dc-${i}`);
      if (wrap) wrap.querySelector('.draw-card').classList.add('flipped');
      if (i === PLAYERS.length - 1) {
        setTimeout(() => document.getElementById('draw-btn-row').classList.remove('hidden'), 700);
      }
    }, i * 650 + 600);
  });
}

function renderDrawComplete() {
  const grid = document.getElementById('draw-cards');
  grid.innerHTML = '';
  PLAYERS.forEach((_, i) => grid.appendChild(buildDrawCard(i, true)));
  document.getElementById('draw-btn-row').classList.remove('hidden');
}

function buildDrawCard(playerIdx, faceUp) {
  const team = teamOf(playerIdx);
  const name = PLAYERS[playerIdx];

  const wrap = document.createElement('div');
  wrap.className = 'draw-card-wrap';
  wrap.id = `dc-${playerIdx}`;
  wrap.innerHTML = `
    <div class="draw-card${faceUp ? ' flipped' : ''}">
      <div class="draw-card-front">
        <div class="card-question">?</div>
        <div class="card-front-name">${name}</div>
      </div>
      <div class="draw-card-back" style="--team-bg:${team.color}">
        <div class="card-logo-wrap">
          ${logoImg(team, 'card-logo')}
        </div>
        <div class="card-back-player">${name}</div>
        <div class="card-back-team">${team.name}</div>
      </div>
    </div>`;
  return wrap;
}

// ============================================
// BRACKET DRAW
// ============================================
function startBracketDraw() {
  const order = shuffleArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  /*
    order[0],order[1]  → P1 (A vs B)
    order[2],order[3]  → P2 (A vs B)
    order[4]           → Q1 seed (playerB — waits for P1 winner)
    order[5]           → Q2 seed (playerB — waits for P2 winner)
    order[6],order[7]  → Q3
    order[8],order[9]  → Q4
  */
  const leg = () => ({ a: null, b: null });
  S.matches = {
    P1: { id:'P1', label:'Preliminar 1', round:'preliminary', playerA: order[0], playerB: order[1], leg1: leg(), leg2: leg(), winner: null },
    P2: { id:'P2', label:'Preliminar 2', round:'preliminary', playerA: order[2], playerB: order[3], leg1: leg(), leg2: leg(), winner: null },
    Q1: { id:'Q1', label:'Quartas 1',    round:'quarters',   playerA: null, playerB: order[4], feederA:'P1', leg1: leg(), leg2: leg(), winner: null },
    Q2: { id:'Q2', label:'Quartas 2',    round:'quarters',   playerA: null, playerB: order[5], feederA:'P2', leg1: leg(), leg2: leg(), winner: null },
    Q3: { id:'Q3', label:'Quartas 3',    round:'quarters',   playerA: order[6], playerB: order[7], leg1: leg(), leg2: leg(), winner: null },
    Q4: { id:'Q4', label:'Quartas 4',    round:'quarters',   playerA: order[8], playerB: order[9], leg1: leg(), leg2: leg(), winner: null },
    S1: { id:'S1', label:'Semi 1',       round:'semis',      playerA: null, playerB: null, feederA:'Q1', feederB:'Q2', leg1: leg(), leg2: leg(), winner: null },
    S2: { id:'S2', label:'Semi 2',       round:'semis',      playerA: null, playerB: null, feederA:'Q3', feederB:'Q4', leg1: leg(), leg2: leg(), winner: null },
    F1: { id:'F1', label:'Final',        round:'final',      playerA: null, playerB: null, feederA:'S1', feederB:'S2', leg1: leg(), leg2: leg(), winner: null },
  };
  save();
  showScreen('bracket-draw');
  animateBracketDraw();
}

function animateBracketDraw() {
  const content = document.getElementById('bracket-draw-content');
  content.innerHTML = `
    <div class="bd-section">
      <div class="bd-phase-title">FASE PRELIMINAR</div>
      <div class="bd-matches" id="bd-prelim"></div>
    </div>
    <div class="bd-section">
      <div class="bd-phase-title">QUARTAS DE FINAL</div>
      <div class="bd-matches" id="bd-qf"></div>
    </div>`;
  document.getElementById('bracket-draw-btn-row').classList.add('hidden');

  const sequence = [
    () => appendBDMatch('bd-prelim', 'P1'),
    () => appendBDMatch('bd-prelim', 'P2'),
    () => appendBDMatch('bd-qf', 'Q1'),
    () => appendBDMatch('bd-qf', 'Q2'),
    () => appendBDMatch('bd-qf', 'Q3'),
    () => appendBDMatch('bd-qf', 'Q4'),
  ];
  sequence.forEach((fn, i) => setTimeout(fn, i * 750 + 400));
  setTimeout(() => document.getElementById('bracket-draw-btn-row').classList.remove('hidden'), sequence.length * 750 + 600);
}

function renderBracketDrawComplete() {
  const content = document.getElementById('bracket-draw-content');
  content.innerHTML = `
    <div class="bd-section">
      <div class="bd-phase-title">FASE PRELIMINAR</div>
      <div class="bd-matches" id="bd-prelim"></div>
    </div>
    <div class="bd-section">
      <div class="bd-phase-title">QUARTAS DE FINAL</div>
      <div class="bd-matches" id="bd-qf"></div>
    </div>`;
  ['P1','P2'].forEach(id => appendBDMatch('bd-prelim', id));
  ['Q1','Q2','Q3','Q4'].forEach(id => appendBDMatch('bd-qf', id));
  document.getElementById('bracket-draw-btn-row').classList.remove('hidden');
}

function appendBDMatch(containerId, matchId) {
  const match = S.matches[matchId];
  const container = document.getElementById(containerId);

  const playerSlot = (pIdx, feeder) => {
    if (pIdx === null) {
      return `<div class="bd-player tbd"><span class="tbd-text">Venc. ${feeder}</span></div>`;
    }
    const team = teamOf(pIdx);
    return `<div class="bd-player">
      <img src="${team.logo}" class="bd-logo" onerror="this.style.display='none'">
      <div>
        <div class="bd-player-name">${PLAYERS[pIdx]}</div>
        <div class="bd-team-sm">${team.short}</div>
      </div>
    </div>`;
  };

  const el = document.createElement('div');
  el.className = 'bd-match-item animate-pop';
  el.innerHTML = `
    ${playerSlot(match.playerA, match.feederA)}
    <span class="bd-vs">VS</span>
    ${playerSlot(match.playerB, match.feederB)}`;
  container.appendChild(el);
}

// ============================================
// TOURNAMENT BRACKET
// ============================================
function startTournament() {
  showScreen('tournament');
  renderTournament();
}

function renderTournament() {
  const container = document.getElementById('bracket-container');
  container.innerHTML = '';

  const rounds = [
    { title: 'PRELIMINAR', ids: ['P1', 'P2'],             cls: 'col-prelim' },
    { title: 'QUARTAS',    ids: ['Q1', 'Q2', 'Q3', 'Q4'], cls: 'col-qf'     },
    { title: 'SEMIFINAIS', ids: ['S1', 'S2'],             cls: 'col-sf'     },
    { title: 'FINAL',      ids: ['F1'],                   cls: 'col-final'  },
  ];

  rounds.forEach(round => {
    const col = document.createElement('div');
    col.className = `bracket-col ${round.cls}`;

    const title = document.createElement('div');
    title.className = 'bracket-round-title';
    title.textContent = round.title;
    col.appendChild(title);

    const matchesDiv = document.createElement('div');
    matchesDiv.className = 'bracket-matches';
    round.ids.forEach(id => matchesDiv.appendChild(buildMatchCard(id)));
    col.appendChild(matchesDiv);
    container.appendChild(col);
  });
}

function buildMatchCard(matchId) {
  const m = S.matches[matchId];
  const card = document.createElement('div');
  card.id = `mc-${matchId}`;

  const isFinal = matchId === 'F1';
  const aggA = isFinal ? (m.leg1.a ?? 0) : (m.leg1.a ?? 0) + (m.leg2.a ?? 0);
  const aggB = isFinal ? (m.leg1.b ?? 0) : (m.leg1.b ?? 0) + (m.leg2.b ?? 0);
  const hasAnyScore = m.leg1.a !== null;
  const done = m.winner !== null;
  const ready = m.playerA !== null && m.playerB !== null && !done;
  const pending = m.playerA === null || m.playerB === null;

  card.className = `match-card ${done ? 'match-done' : ready ? 'match-ready' : 'match-pending-players'}`;

  const playerRow = (pIdx, feeder, side) => {
    const isWinner = done && m.winner === pIdx;
    const isLoser  = done && m.winner !== pIdx;
    const isTbd    = pIdx === null;

    let logoHtml = '';
    let nameHtml = '';

    if (isTbd) {
      logoHtml = `<div class="match-logo-placeholder">?</div>`;
      nameHtml = feeder ? `Venc. ${feeder}` : 'A definir';
    } else {
      const team = teamOf(pIdx);
      logoHtml = `<img src="${team.logo}" class="match-team-logo" alt="${team.name}"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="match-logo-placeholder" style="display:none">${team.initials}</div>`;
      nameHtml = PLAYERS[pIdx];
    }

    const aggVal = side === 'A' ? aggA : aggB;
    const aggClass = isWinner ? 'agg-win' : '';

    return `<div class="match-player ${isWinner ? 'winner' : ''} ${isLoser ? 'loser' : ''} ${isTbd ? 'tbd' : ''}">
      ${logoHtml}
      <span class="match-player-name">${nameHtml}</span>
      ${hasAnyScore && !isTbd ? `<span class="match-agg ${aggClass}">${aggVal}</span>` : ''}
    </div>`;
  };

  const feederA = m.feederA || null;
  const feederB = m.feederB || null;

  card.innerHTML = `
    ${playerRow(m.playerA, feederA, 'A')}
    <div class="match-divider">
      <span class="match-vs">${done ? '' : 'VS'}</span>
      ${done ? '<span class="match-done-badge">✓</span>' : ''}
    </div>
    ${playerRow(m.playerB, feederB, 'B')}
    ${ready ? `<button class="match-btn" onclick="openModal('${matchId}')">
      ${hasAnyScore ? 'Editar Placar' : 'Inserir Placar'}
    </button>` : ''}
    ${done ? `<div class="match-winner-label">${PLAYERS[m.winner]}</div>` : ''}
  `;

  return card;
}

// ============================================
// MATCH MODAL
// ============================================
function openModal(matchId) {
  const m = S.matches[matchId];
  const tA = teamOf(m.playerA);
  const tB = teamOf(m.playerB);
  const pA = PLAYERS[m.playerA];
  const pB = PLAYERS[m.playerB];

  const v = id => { const el = document.getElementById(id); return el && el.value !== '' ? parseInt(el.value, 10) : null; };

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${m.label}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>

    <div class="modal-matchup">
      <div class="modal-player">
        <img src="${tA.logo}" class="modal-logo" onerror="this.style.display='none'">
        <div class="modal-player-name">${pA}</div>
        <div class="modal-team-name">${tA.name}</div>
      </div>
      <div class="modal-vs-text">VS</div>
      <div class="modal-player">
        <img src="${tB.logo}" class="modal-logo" onerror="this.style.display='none'">
        <div class="modal-player-name">${pB}</div>
        <div class="modal-team-name">${tB.name}</div>
      </div>
    </div>

    <div class="modal-scores">
      <div class="modal-leg" style="${matchId === 'F1' ? 'flex:unset;width:100%;max-width:260px;margin:0 auto' : ''}">
        <div class="modal-leg-title">${matchId === 'F1' ? 'PLACAR' : 'IDA &nbsp;·&nbsp; ' + pA + ' em casa'}</div>
        <div class="modal-score-row">
          <input type="number" min="0" max="20" class="score-input" id="l1a" value="${m.leg1.a !== null ? m.leg1.a : ''}">
          <span class="score-dash">—</span>
          <input type="number" min="0" max="20" class="score-input" id="l1b" value="${m.leg1.b !== null ? m.leg1.b : ''}">
        </div>
      </div>
      ${matchId !== 'F1' ? `<div class="modal-leg">
        <div class="modal-leg-title">VOLTA &nbsp;·&nbsp; ${pB} em casa</div>
        <div class="modal-score-row">
          <input type="number" min="0" max="20" class="score-input" id="l2a" value="${m.leg2.a !== null ? m.leg2.a : ''}">
          <span class="score-dash">—</span>
          <input type="number" min="0" max="20" class="score-input" id="l2b" value="${m.leg2.b !== null ? m.leg2.b : ''}">
        </div>
      </div>` : ''}
    </div>

    <div class="modal-aggregate" id="modal-agg">${buildAggHtml(m, null, matchId === 'F1')}</div>
    <div id="modal-tie" class="modal-tiebreak" style="display:none">
      <p>Empate — Quem avança?</p>
      <div class="tiebreak-btns">
        <button class="btn-tiebreak" onclick="saveTiebreak('${matchId}',${m.playerA})">${pA}</button>
        <button class="btn-tiebreak" onclick="saveTiebreak('${matchId}',${m.playerB})">${pB}</button>
      </div>
    </div>

    <button class="btn-primary btn-save-score" onclick="saveScores('${matchId}')">Salvar Placar</button>
  `;

  // Live aggregate on input
  const isFinal = matchId === 'F1';
  ['l1a','l1b','l2a','l2b'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      const vals = { a1: v('l1a'), b1: v('l1b'), a2: v('l2a'), b2: v('l2b') };
      document.getElementById('modal-agg').innerHTML = buildAggHtml(m, vals, isFinal);
    });
  });

  document.getElementById('match-modal').style.display = 'flex';
}

function buildAggHtml(m, vals, isFinal = false) {
  const a1 = vals ? vals.a1 : m.leg1.a;
  const b1 = vals ? vals.b1 : m.leg1.b;
  const a2 = isFinal ? null : (vals ? vals.a2 : m.leg2.a);
  const b2 = isFinal ? null : (vals ? vals.b2 : m.leg2.b);

  if (a1 === null && b1 === null) {
    return `<p class="agg-placeholder">Insira o placar acima</p>`;
  }

  const aggA = (a1 ?? 0) + (isFinal ? 0 : (a2 ?? 0));
  const aggB = (b1 ?? 0) + (isFinal ? 0 : (b2 ?? 0));
  const tie = aggA === aggB;

  const pA = PLAYERS[m.playerA];
  const pB = PLAYERS[m.playerB];

  return `
    <p class="agg-label">AGREGADO</p>
    <div class="agg-display">
      <span class="agg-name" style="text-align:right">${pA}</span>
      <span class="agg-score ${aggA > aggB ? 'agg-lead' : aggA < aggB ? 'agg-trail' : ''}">${aggA}</span>
      <span class="agg-dash-sep">—</span>
      <span class="agg-score ${aggB > aggA ? 'agg-lead' : aggB < aggA ? 'agg-trail' : ''}">${aggB}</span>
      <span class="agg-name">${pB}</span>
    </div>
    ${tie ? '<p class="agg-tie">Empate — pênaltis necessários</p>' : ''}
  `;
}

function saveScores(matchId) {
  const get = id => { const el = document.getElementById(id); return el && el.value !== '' ? parseInt(el.value, 10) : null; };
  const l1a = get('l1a'), l1b = get('l1b'), l2a = get('l2a'), l2b = get('l2b');
  const isFinal = matchId === 'F1';

  const m = S.matches[matchId];
  m.leg1 = { a: l1a, b: l1b };
  m.leg2 = isFinal ? { a: null, b: null } : { a: l2a, b: l2b };

  // Resolve winner: final needs only leg1, others need both legs
  const ready = isFinal ? (l1a !== null && l1b !== null) : (l1a !== null && l1b !== null && l2a !== null && l2b !== null);
  if (ready) {
    const aggA = isFinal ? l1a : l1a + l2a;
    const aggB = isFinal ? l1b : l1b + l2b;

    if (aggA > aggB) {
      m.winner = m.playerA;
      advanceWinner(matchId);
      save();
      closeModal();
      renderTournament();
    } else if (aggB > aggA) {
      m.winner = m.playerB;
      advanceWinner(matchId);
      save();
      closeModal();
      renderTournament();
    } else {
      // Tie — show tiebreak UI
      save();
      document.getElementById('modal-tie').style.display = 'block';
    }
  } else {
    save();
    closeModal();
    renderTournament();
  }
}

function saveTiebreak(matchId, winnerIdx) {
  const m = S.matches[matchId];
  m.winner = winnerIdx;
  advanceWinner(matchId);
  save();
  closeModal();
  renderTournament();
}

function advanceWinner(matchId) {
  const winner = S.matches[matchId].winner;
  Object.values(S.matches).forEach(m => {
    if (m.feederA === matchId) m.playerA = winner;
    if (m.feederB === matchId) m.playerB = winner;
  });

  if (matchId === 'F1') {
    setTimeout(() => {
      S.screen = 'champion';
      save();
      showScreen('champion');
      renderChampion();
    }, 600);
  }
}

function closeModal() {
  document.getElementById('match-modal').style.display = 'none';
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('match-modal')) closeModal();
}

// ============================================
// CHAMPION
// ============================================
function renderChampion() {
  const m = S.matches['F1'];
  if (!m || m.winner === null) return;

  const team = teamOf(m.winner);
  document.getElementById('champion-details').innerHTML = `
    <img src="${team.logo}" class="champ-logo" alt="${team.name}" onerror="this.style.display='none'">
    <div class="champ-player-name">${PLAYERS[m.winner]}</div>
    <div class="champ-team-name">${team.name}</div>
  `;
  spawnConfetti();
}

function spawnConfetti() {
  const cont = document.getElementById('confetti-container');
  cont.innerHTML = '';
  const colors = ['#FFD700','#9333EA','#ffffff','#FFA500','#6B21A8','#FFF5B0'];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    const size = 6 + Math.random() * 9;
    p.style.cssText = `
      left:${Math.random() * 100}%;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      width:${size}px; height:${size}px;
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      animation-delay:${Math.random() * 2.5}s;
      animation-duration:${2.5 + Math.random() * 2.5}s;
    `;
    cont.appendChild(p);
  }
}

// ============================================
// RESET
// ============================================
function resetTournament() {
  if (!confirm('Reiniciar o torneio? Todo progresso será perdido.')) return;
  localStorage.removeItem('chimpas_v3');
  S = { screen: 'splash', playerTeams: null, matches: null };
  showScreen('splash');
}
