
/* ============================================
   CHIMPAS LEAGUE - Tournament Logic (Groups + KO)
   ============================================ */

const PLAYERS = [
  'David', 'Flavio', 'Gustavo', 'Arroz', 'Bloado',
  'Fabricio', 'Global', 'Gordo', 'MV', 'Pericles'
];

const CL_TEAMS = [
  { name: 'Real Madrid',       short: 'R. Madrid', logo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',                                              color: '#FEBE10', initials: 'RM' },
  { name: 'Manchester City',   short: 'Man City',  logo: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',                                     color: '#6CABDD', initials: 'MC' },
  { name: 'Bayern Munich',     short: 'Bayern',    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg',                 color: '#DC052D', initials: 'BM' },
  { name: 'Liverpool',         short: 'Liverpool', logo: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',                                                 color: '#C8102E', initials: 'LV' },
  { name: 'Arsenal',           short: 'Arsenal',   logo: 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',                                                   color: '#EF0107', initials: 'AR' },
  { name: 'PSG',               short: 'PSG',       logo: 'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg',                                    color: '#004170', initials: 'PS' },
  { name: 'Inter Milan',       short: 'Inter',     logo: 'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg',                           color: '#0068A8', initials: 'IM' },
  { name: 'Barcelona',         short: 'Barca',     logo: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',                                    color: '#A50044', initials: 'FC' },
  { name: 'Atletico Madrid',   short: 'Atletico',  logo: 'https://media.api-sports.io/football/teams/530.png',                                                              color: '#CB3524', initials: 'AT' },
  { name: 'Chelsea',           short: 'Chelsea',   logo: 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg',                                                    color: '#034694', initials: 'CH' }
];

const STORAGE_KEY = 'chimpas_v5';
const EXCLUDED_PLAYERS = [3, 7]; // Arroz, Gordo
const GROUP_IDS = ['A'];
const GROUP_DRAW_TOTAL_SLOTS = 8;
const GROUP_DRAW_SLOTS_PER_GROUP = 8;
const GROUP_DRAW_ROLL_MS = 11250;
const GROUP_DRAW_LOCK_PAUSE_MS = 1200;
const GROUP_DRAW_INITIAL_DELAY_MS = 500;
const GROUP_DRAW_CAROUSEL_VISIBLE = 7;

let S = {};
let groupDrawStepTimer = null;
let groupDrawRollTimer = null;
let groupDrawTransitionCleanup = null;

// ============================================
// INIT
// ============================================
window.addEventListener('DOMContentLoaded', () => {
  const bgImg = "url('background.jpg')";
  document.querySelectorAll('.bg-image').forEach(el => {
    el.style.backgroundImage = bgImg;
  });

  // Try migrating from v4
  const oldSaved = localStorage.getItem('chimpas_v4');
  if (oldSaved) {
    try {
      const oldState = JSON.parse(oldSaved);
      if (isValidState(oldState)) {
        S = migrateV4toV5(oldState);
        save();
        localStorage.removeItem('chimpas_v4');
        restoreScreen();
        return;
      }
    } catch (e) {
      // Ignore broken state.
    }
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (isValidState(parsed)) {
        S = parsed;
        restoreScreen();
        return;
      }
    } catch (e) {
      // Ignore broken state.
    }
  }

  S = createInitialState();
  showScreen('splash');
});

function migrateV4toV5(old) {
  const groupAPlayers = old.groups.A.players; // [2,4,6,0,8]
  const groupBPlayersFiltered = old.groups.B.players.filter(p => !EXCLUDED_PLAYERS.includes(p)); // [5,9,1]
  const allPlayers = [...groupAPlayers, ...groupBPlayersFiltered]; // [2,4,6,0,8,5,9,1]

  const newMatches = {};
  let seq = 1;    // sequential label counter
  let nextId = 1; // sequential match id counter

  // Keep all group A matches, renaming labels sequentially
  const keptAMatches = [];
  old.groups.A.regularMatchIds.forEach(id => {
    const newId = `G-A-${nextId++}`;
    newMatches[newId] = { ...old.matches[id], id: newId, label: `Jogo ${seq++}` };
    keptAMatches.push(newId);
  });

  // Keep group B matches that don't involve excluded players, re-id them
  const keptBMatches = [];
  old.groups.B.regularMatchIds.forEach(id => {
    const m = old.matches[id];
    if (EXCLUDED_PLAYERS.includes(m.playerA) || EXCLUDED_PLAYERS.includes(m.playerB)) return;
    const newId = `G-A-${nextId++}`;
    newMatches[newId] = { ...m, id: newId, groupId: 'A', label: `Jogo ${seq++}` };
    keptBMatches.push(newId);
  });

  // Generate cross-group matches (A players × B remaining players)
  const existingPairs = new Set();
  Object.values(newMatches).forEach(m => {
    if (m.playerA !== null && m.playerB !== null) {
      const key = [Math.min(m.playerA, m.playerB), Math.max(m.playerA, m.playerB)].join('-');
      existingPairs.add(key);
    }
  });

  const crossMatches = [];
  for (const pA of groupAPlayers) {
    for (const pB of groupBPlayersFiltered) {
      const key = [Math.min(pA, pB), Math.max(pA, pB)].join('-');
      if (existingPairs.has(key)) continue;
      const newId = `G-A-${nextId++}`;
      newMatches[newId] = {
        id: newId,
        label: `Jogo ${seq++}`,
        phase: 'groups',
        kind: 'group-regular',
        mode: 'league',
        round: null,
        groupId: 'A',
        tieStageId: null,
        playerA: pA,
        playerB: pB,
        score: { a: null, b: null },
        winner: null,
        decidedByPenalties: false
      };
      crossMatches.push(newId);
    }
  }

  const allMatchIds = [
    ...keptAMatches,
    ...keptBMatches,
    ...crossMatches
  ];

  // Create knockout matches (PI1, PI2, SF1, SF2, F1)
  const koIds = ['PI1', 'PI2', 'SF1', 'SF2', 'F1'];
  const koLabels = { PI1: 'Play-in 1', PI2: 'Play-in 2', SF1: 'Semi 1', SF2: 'Semi 2', F1: 'Final' };
  const koRounds = { PI1: 'playin', PI2: 'playin', SF1: 'semis', SF2: 'semis', F1: 'final' };

  koIds.forEach(id => {
    newMatches[id] = {
      id,
      label: koLabels[id],
      phase: 'knockout',
      kind: 'knockout',
      mode: 'elimination',
      round: koRounds[id],
      groupId: null,
      tieStageId: null,
      playerA: null,
      playerB: null,
      score: { a: null, b: null },
      winner: null,
      decidedByPenalties: false
    };
  });

  return {
    screen: 'groups',
    playerTeams: old.playerTeams,
    groups: {
      A: {
        id: 'A',
        players: allPlayers,
        regularMatchIds: allMatchIds,
        tieStages: []
      }
    },
    groupDraw: {
      order: allPlayers,
      step: allPlayers.length,
      isAnimating: false,
      currentTarget: { groupId: 'A', slotIndex: allPlayers.length - 1 },
      rollingPreview: allPlayers[allPlayers.length - 1],
      slots: { A: [...allPlayers] }
    },
    matches: newMatches,
    knockout: { ready: false, seeds: null },
    nextTieStage: 1,
    nextTieMatch: 1
  };
}

function createInitialState() {
  return {
    screen: 'splash',
    playerTeams: null,
    groups: null,
    groupDraw: null,
    matches: {},
    knockout: {
      ready: false,
      seeds: null
    },
    nextTieStage: 1,
    nextTieMatch: 1
  };
}

function isValidState(candidate) {
  return !!candidate && typeof candidate === 'object' && 'screen' in candidate;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
}

function restoreScreen() {
  const s = S.screen;
  if (s === 'draw') {
    showScreen('draw');
    renderDrawComplete();
  } else if (s === 'bracket-draw') {
    showScreen('bracket-draw');
    renderBracketDrawComplete();
  } else if (s === 'groups' || s === 'qualifiers' || s === 'tournament') {
    restoreTournamentFlow();
  } else if (s === 'champion') {
    showScreen('champion');
    renderChampion();
  } else {
    showScreen('splash');
  }
}

function restoreTournamentFlow() {
  if (!S.groups) {
    showScreen('splash');
    return;
  }

  syncTournamentState(true);
  save();

  const target = S.knockout.ready ? 'qualifiers' : 'groups';

  if (target === 'groups') {
    showScreen('groups');
    renderGroupsScreen();
  } else {
    showScreen('qualifiers');
    renderQualifiersScreen();
  }
}

function showScreen(name) {
  if (name !== 'bracket-draw') clearGroupDrawTimers();
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) {
    el.classList.add('active');
    S.screen = name;
    save();
  }
}

function clearGroupDrawTimers() {
  if (groupDrawStepTimer) {
    clearTimeout(groupDrawStepTimer);
    groupDrawStepTimer = null;
  }

  if (groupDrawRollTimer) {
    clearTimeout(groupDrawRollTimer);
    groupDrawRollTimer = null;
  }

  if (groupDrawTransitionCleanup) {
    groupDrawTransitionCleanup();
    groupDrawTransitionCleanup = null;
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

function playerName(playerIdx) {
  return PLAYERS[playerIdx];
}

function teamOf(playerIdx) {
  return CL_TEAMS[S.playerTeams[playerIdx]];
}

function logoImg(team, cssClass) {
  return `<img src="${team.logo}" alt="${team.name}" class="${cssClass}"
    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <div class="card-logo-fallback" style="display:none;background:${team.color};color:#000">${team.initials}</div>`;
}

function participantsKey(participants) {
  return [...participants].sort((a, b) => a - b).join('-');
}

function unique(arr) {
  return [...new Set(arr)];
}

// ============================================
// SPLASH -> DRAW TEAMS
// ============================================
function getActivePlayers() {
  return PLAYERS.map((_, i) => i).filter(i => !EXCLUDED_PLAYERS.includes(i));
}

function getActiveTeams() {
  return CL_TEAMS.map((_, i) => i).filter(i => !EXCLUDED_PLAYERS.includes(i));
}

function startDraw() {
  const activeTeams = getActiveTeams();
  const teamOrder = shuffleArray(activeTeams);
  // Build full array with nulls for excluded
  const fullOrder = new Array(PLAYERS.length).fill(null);
  const activePlayers = getActivePlayers();
  activePlayers.forEach((playerIdx, i) => {
    fullOrder[playerIdx] = teamOrder[i];
  });
  S.playerTeams = fullOrder;
  save();
  showScreen('draw');
  renderDrawAnimated();
}

function renderDrawAnimated() {
  const grid = document.getElementById('draw-cards');
  grid.innerHTML = '';
  document.getElementById('draw-btn-row').classList.add('hidden');

  const active = getActivePlayers();
  active.forEach(i => {
    grid.appendChild(buildDrawCard(i, false));
  });

  requestAnimationFrame(() => shuffleDrawCards(grid, (visualOrder) => {
    visualOrder.forEach((playerIdx, pos) => {
      setTimeout(() => {
        const wrap = document.getElementById(`dc-${playerIdx}`);
        if (wrap) wrap.querySelector('.draw-card').classList.add('flipped');
        if (pos === visualOrder.length - 1) {
          setTimeout(() => document.getElementById('draw-btn-row').classList.remove('hidden'), 700);
        }
      }, pos * 650 + 600);
    });
  }));
}

function shuffleDrawCards(grid, callback) {
  const wraps = Array.from(grid.querySelectorAll('.draw-card-wrap'));
  if (wraps.length === 0) { callback(); return; }

  const positions = wraps.map(el => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top };
  });

  grid.classList.add('shuffling');

  const ROUNDS = 8;
  const INTERVAL = 300;
  let round = 0;
  let lastPerm = wraps.map((_, i) => i);

  function doRound() {
    const perm = shuffleArray([...Array(wraps.length).keys()]);
    lastPerm = perm;

    wraps.forEach((el, i) => {
      const target = perm[i];
      const dx = positions[target].x - positions[i].x;
      const dy = positions[target].y - positions[i].y;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    round++;
    if (round < ROUNDS) {
      setTimeout(doRound, INTERVAL);
    } else {
      setTimeout(() => {
        grid.classList.remove('shuffling');
        const visualOrder = new Array(wraps.length);
        lastPerm.forEach((target, i) => { visualOrder[target] = i; });
        callback(visualOrder);
      }, INTERVAL);
    }
  }

  setTimeout(doRound, 400);
}

function renderDrawComplete() {
  const grid = document.getElementById('draw-cards');
  grid.innerHTML = '';
  getActivePlayers().forEach(i => grid.appendChild(buildDrawCard(i, true)));
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
// GROUP DRAW
// ============================================
function startBracketDraw() {
  clearGroupDrawTimers();

  const order = shuffleArray(getActivePlayers());

  const slots = {};
  const groups = {};
  GROUP_IDS.forEach(id => {
    slots[id] = new Array(GROUP_DRAW_SLOTS_PER_GROUP).fill(null);
    groups[id] = { id, players: [], regularMatchIds: [], tieStages: [] };
  });

  S.groupDraw = {
    order,
    step: 0,
    isAnimating: true,
    currentTarget: null,
    rollingPreview: null,
    slots
  };

  S.groups = groups;

  S.matches = {};
  S.knockout = { ready: false, seeds: null };
  S.nextTieStage = 1;
  S.nextTieMatch = 1;

  save();
  showScreen('bracket-draw');
  animateBracketDraw();
}

function hasCompletedGroupDraw() {
  if (!S.groups) return false;
  return GROUP_IDS.every(id =>
    S.groups[id] &&
    Array.isArray(S.groups[id].players) &&
    S.groups[id].players.length === GROUP_DRAW_SLOTS_PER_GROUP
  );
}

function getGroupDrawTarget(step) {
  const groupCount = GROUP_IDS.length;
  return {
    groupId: GROUP_IDS[step % groupCount],
    slotIndex: Math.floor(step / groupCount)
  };
}

function createEmptyGroupSlots() {
  const slots = {};
  GROUP_IDS.forEach(id => {
    slots[id] = new Array(GROUP_DRAW_SLOTS_PER_GROUP).fill(null);
  });
  return slots;
}

function fillSlotsFromOrder(order) {
  const slots = createEmptyGroupSlots();
  order.forEach((playerIdx, step) => {
    const target = getGroupDrawTarget(step);
    slots[target.groupId][target.slotIndex] = playerIdx;
  });
  return slots;
}

function finalizeGroupDrawState() {
  if (!S.groupDraw) return;
  clearGroupDrawTimers();

  const order = S.groupDraw.order || [];
  const slots = fillSlotsFromOrder(order);

  S.groupDraw.slots = slots;
  S.groupDraw.step = order.length;
  S.groupDraw.isAnimating = false;

  const groups = {};
  GROUP_IDS.forEach(id => {
    groups[id] = { id, players: slots[id].filter(v => v !== null), regularMatchIds: [], tieStages: [] };
  });
  S.groups = groups;

  S.matches = {};
  S.knockout = { ready: false, seeds: null };
  S.nextTieStage = 1;
  S.nextTieMatch = 1;

  GROUP_IDS.forEach(id => createGroupRoundRobin(id));
  createKnockoutMatches();
  save();
}

function buildGroupDrawTargetLabel(target, done = false) {
  const slot = `${target.groupId}${target.slotIndex + 1}`;
  return done ? `SORTEADO: ${slot}` : `SORTEANDO: ${slot}`;
}

function renderGroupDrawCarousel(target, pool, centerPoolIndex, winner = false) {
  const labelEl = document.getElementById('gd-carousel-label');
  const trackEl = document.getElementById('gd-carousel-track');
  if (!labelEl || !trackEl) return;
  if (!pool || pool.length === 0) return;

  labelEl.textContent = buildGroupDrawTargetLabel(target, winner);

  const cards = [];
  const size = GROUP_DRAW_CAROUSEL_VISIBLE;
  const half = Math.floor(size / 2);
  const n = pool.length;

  for (let i = -half; i <= half; i++) {
    const idx = (centerPoolIndex + i + n * 3) % n;
    const playerIdx = pool[idx];

    cards.push(buildGroupDrawCarouselCard(playerIdx, {
      isCenter: i === 0,
      isWinner: winner && i === 0
    }));
  }

  trackEl.className = `gd-carousel-track ${winner ? 'winner' : ''}`;
  trackEl.style.transition = 'none';
  trackEl.style.transform = 'translate3d(0px,0px,0px)';
  trackEl.innerHTML = cards.join('');

}

function buildGroupDrawCarouselCard(playerIdx, opts = {}) {
  const isCenter = !!opts.isCenter;
  const isWinner = !!opts.isWinner;
  const spinIndex = typeof opts.spinIndex === 'number' ? opts.spinIndex : null;
  const spinAttr = spinIndex !== null ? ` data-spin-index="${spinIndex}"` : '';

  if (playerIdx === null || playerIdx === undefined) {
    return `<div class="gd-carousel-card${isCenter ? ' center' : ''}"${spinAttr}>
      <div class="gd-carousel-player">Aguardando</div>
    </div>`;
  }

  const team = teamOf(playerIdx);
  return `<div class="gd-carousel-card${isCenter ? ' center' : ''}${isWinner ? ' winner' : ''}"${spinAttr}>
    <img src="${team.logo}" class="gd-carousel-logo" alt="${team.name}" onerror="this.style.display='none'">
    <div class="gd-carousel-player">${playerName(playerIdx)}</div>
    <div class="gd-carousel-team">${team.short}</div>
  </div>`;
}

function animateNextGroupDrawSlot() {
  if (!S.groupDraw || !S.groupDraw.isAnimating) return;

  if (S.groupDraw.step >= GROUP_DRAW_TOTAL_SLOTS) {
    finalizeGroupDrawState();
    renderBracketDrawComplete();
    return;
  }

  const step = S.groupDraw.step;
  const selectedPlayerIdx = S.groupDraw.order[step];
  const target = getGroupDrawTarget(step);
  const slotEl = document.getElementById(`gd-slot-${target.groupId}-${target.slotIndex}`);
  const viewportEl = document.querySelector('.gd-carousel-viewport');
  const trackEl = document.getElementById('gd-carousel-track');
  if (!slotEl || !viewportEl || !trackEl) return;

  const remaining = S.groupDraw.order.slice(step);
  const spinPool = shuffleArray([...remaining]);
  const poolSize = spinPool.length;
  const selectedPoolIndex = spinPool.indexOf(selectedPlayerIdx);
  const halfVisible = Math.floor(GROUP_DRAW_CAROUSEL_VISIBLE / 2);
  const startPoolIndex = Math.max(halfVisible + 1, (poolSize * 2) + Math.floor(Math.random() * poolSize));
  const loops = Math.max(4, Math.ceil(GROUP_DRAW_ROLL_MS / 450));
  const offsetToWinner = (selectedPoolIndex - (startPoolIndex % poolSize) + poolSize) % poolSize;
  const stopIndex = startPoolIndex + (poolSize * loops) + offsetToWinner;
  const totalCards = stopIndex + GROUP_DRAW_CAROUSEL_VISIBLE + poolSize;

  const cards = [];
  for (let i = 0; i < totalCards; i++) {
    cards.push(buildGroupDrawCarouselCard(spinPool[i % poolSize], { spinIndex: i }));
  }

  const rollingPreview = spinPool[startPoolIndex % poolSize];
  S.groupDraw.currentTarget = target;
  S.groupDraw.rollingPreview = rollingPreview;
  const labelEl = document.getElementById('gd-carousel-label');
  if (labelEl) labelEl.textContent = buildGroupDrawTargetLabel(target, false);

  slotEl.className = 'gd-slot-row rolling';
  slotEl.innerHTML = buildGroupDrawSlotInner(target.groupId, target.slotIndex, null, 'rolling');

  trackEl.className = 'gd-carousel-track rolling';
  trackEl.style.transition = 'none';
  trackEl.innerHTML = cards.join('');

  const viewportRect = viewportEl.getBoundingClientRect();
  trackEl.style.transform = 'translate3d(0px,0px,0px)';
  trackEl.getBoundingClientRect();

  const sampleCardEl = trackEl.querySelector('.gd-carousel-card');
  if (!sampleCardEl) return;
  viewportEl.style.setProperty('--selector-w', `${sampleCardEl.offsetWidth}px`);
  viewportEl.style.setProperty('--selector-h', `${sampleCardEl.offsetHeight}px`);
  const sampleCardRect = sampleCardEl.getBoundingClientRect();
  const selectorCenterY = (sampleCardRect.top - viewportRect.top) + (sampleCardRect.height / 2);
  viewportEl.style.setProperty('--selector-center-y', `${selectorCenterY}px`);

  const markerX = viewportRect.left + (viewportEl.offsetWidth / 2);

  const offsetFor = (idx) => {
    const cardEl = trackEl.querySelector(`[data-spin-index="${idx}"]`);
    if (!cardEl) return 0;
    const rect = cardEl.getBoundingClientRect();
    return markerX - (rect.left + rect.width / 2);
  };
  const startX = offsetFor(startPoolIndex);
  const endX = offsetFor(stopIndex);

  trackEl.style.transform = `translate3d(${startX}px,0px,0px)`;
  trackEl.getBoundingClientRect();

  let spinFinished = false;
  const finishSpin = () => {
    if (spinFinished) return;
    spinFinished = true;

    if (groupDrawRollTimer) {
      clearTimeout(groupDrawRollTimer);
      groupDrawRollTimer = null;
    }
    if (groupDrawTransitionCleanup) {
      groupDrawTransitionCleanup();
      groupDrawTransitionCleanup = null;
    }

    trackEl.style.transition = 'none';
    trackEl.style.transform = `translate3d(${endX}px,0px,0px)`;
    trackEl.getBoundingClientRect();

    trackEl.querySelectorAll('.gd-carousel-card.center, .gd-carousel-card.winner')
      .forEach(el => el.classList.remove('center', 'winner'));
    const winnerEl = trackEl.querySelector(`[data-spin-index="${stopIndex}"]`);
    if (winnerEl) winnerEl.classList.add('center', 'winner');

    S.groupDraw.slots[target.groupId][target.slotIndex] = selectedPlayerIdx;
    S.groupDraw.step += 1;
    S.groupDraw.currentTarget = target;
    S.groupDraw.rollingPreview = selectedPlayerIdx;
    save();

    if (labelEl) labelEl.textContent = buildGroupDrawTargetLabel(target, true);

    slotEl.className = 'gd-slot-row locked lock-flash';
    slotEl.innerHTML = buildGroupDrawSlotInner(target.groupId, target.slotIndex, selectedPlayerIdx, 'locked');
    setTimeout(() => slotEl.classList.remove('lock-flash'), 420);

    if (S.groupDraw.step >= GROUP_DRAW_TOTAL_SLOTS) {
      groupDrawStepTimer = setTimeout(() => {
        finalizeGroupDrawState();
        renderBracketDrawComplete();
      }, GROUP_DRAW_LOCK_PAUSE_MS);
    } else {
      groupDrawStepTimer = setTimeout(animateNextGroupDrawSlot, GROUP_DRAW_LOCK_PAUSE_MS);
    }
  };

  const onTransitionEnd = (ev) => {
    if (ev.target !== trackEl || ev.propertyName !== 'transform') return;
    finishSpin();
  };
  trackEl.addEventListener('transitionend', onTransitionEnd);
  groupDrawTransitionCleanup = () => {
    trackEl.removeEventListener('transitionend', onTransitionEnd);
    trackEl.style.transition = 'none';
  };

  groupDrawRollTimer = setTimeout(finishSpin, GROUP_DRAW_ROLL_MS + 650);
  trackEl.style.transition = `transform ${GROUP_DRAW_ROLL_MS}ms cubic-bezier(0.12, 0.78, 0.18, 1)`;
  trackEl.style.transform = `translate3d(${endX}px,0px,0px)`;
}

function createGroupRoundRobin(groupId) {
  const players = S.groups[groupId].players;
  let seq = 1;

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const matchId = `G-${groupId}-${seq++}`;
      createMatch({
        id: matchId,
        label: `Jogo ${seq - 1}`,
        phase: 'groups',
        kind: 'group-regular',
        mode: 'league',
        groupId,
        playerA: players[i],
        playerB: players[j]
      });
      S.groups[groupId].regularMatchIds.push(matchId);
    }
  }
}

function createKnockoutMatches() {
  createMatch({ id: 'PI1', label: 'Play-in 1', phase: 'knockout', kind: 'knockout', mode: 'elimination', round: 'playin', playerA: null, playerB: null });
  createMatch({ id: 'PI2', label: 'Play-in 2', phase: 'knockout', kind: 'knockout', mode: 'elimination', round: 'playin', playerA: null, playerB: null });
  createMatch({ id: 'SF1', label: 'Semi 1', phase: 'knockout', kind: 'knockout', mode: 'elimination', round: 'semis', playerA: null, playerB: null });
  createMatch({ id: 'SF2', label: 'Semi 2', phase: 'knockout', kind: 'knockout', mode: 'elimination', round: 'semis', playerA: null, playerB: null });
  createMatch({ id: 'F1', label: 'Final', phase: 'knockout', kind: 'knockout', mode: 'elimination', round: 'final', playerA: null, playerB: null });
}

function createMatch({ id, label, phase, kind, mode, round = null, groupId = null, playerA = null, playerB = null, tieStageId = null }) {
  S.matches[id] = {
    id,
    label,
    phase,
    kind,
    mode,
    round,
    groupId,
    tieStageId,
    playerA,
    playerB,
    score: { a: null, b: null },
    winner: null,
    decidedByPenalties: false
  };
}

function animateBracketDraw() {
  document.getElementById('bracket-draw-btn-row').classList.add('hidden');
  renderGroupDrawSkeleton();
}

function startGroupDrawSpin() {
  const btnRow = document.getElementById('gd-start-btn-row');
  if (btnRow) btnRow.remove();
  if (!S.groupDraw || !S.groupDraw.isAnimating) return;
  groupDrawStepTimer = setTimeout(animateNextGroupDrawSlot, GROUP_DRAW_INITIAL_DELAY_MS);
}

function renderBracketDrawComplete() {
  clearGroupDrawTimers();

  if (S.groupDraw && S.groupDraw.isAnimating) {
    finalizeGroupDrawState();
  } else if (!hasCompletedGroupDraw() && S.groupDraw) {
    finalizeGroupDrawState();
  }

  if (!hasCompletedGroupDraw()) return;

  const content = document.getElementById('bracket-draw-content');
  content.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'gd-grid';
  GROUP_IDS.forEach(id => grid.appendChild(buildGroupDrawCard(id)));

  content.appendChild(grid);
  document.getElementById('bracket-draw-btn-row').classList.remove('hidden');
}

function renderGroupDrawSkeleton() {
  if (!S.groupDraw) return;

  const content = document.getElementById('bracket-draw-content');
  content.innerHTML = '';

  const stageWrap = document.createElement('div');
  stageWrap.className = 'gd-carousel-stage animate-pop';

  const currentTarget = getGroupDrawTarget(S.groupDraw.step >= GROUP_DRAW_TOTAL_SLOTS ? GROUP_DRAW_TOTAL_SLOTS - 1 : S.groupDraw.step);
  stageWrap.innerHTML = `
    <div id="gd-carousel-label" class="gd-carousel-label">${buildGroupDrawTargetLabel(currentTarget, false)}</div>
    <div class="gd-carousel-viewport">
      <div id="gd-carousel-track" class="gd-carousel-track"></div>
    </div>
  `;

  const grid = document.createElement('div');
  grid.className = 'gd-grid';
  GROUP_IDS.forEach(id => grid.appendChild(buildGroupDrawAnimatedCard(id)));

  const startBtnRow = document.createElement('div');
  startBtnRow.id = 'gd-start-btn-row';
  startBtnRow.className = 'gd-start-btn-row';
  startBtnRow.innerHTML = `<button class="btn-primary btn-glow" onclick="startGroupDrawSpin()">INICIAR SORTEIO</button>`;

  const drawLayout = document.createElement('div');
  drawLayout.className = 'gd-draw-layout';
  drawLayout.appendChild(stageWrap);
  drawLayout.appendChild(grid);
  content.appendChild(startBtnRow);
  content.appendChild(drawLayout);

  setTimeout(() => {
    document.querySelectorAll('.gd-group').forEach((el, idx) => {
      setTimeout(() => el.classList.add('animate-pop'), idx * 180);
    });
  }, 140);

  if (S.groupDraw && S.groupDraw.order && S.groupDraw.order.length) {
    const pool = S.groupDraw.order.slice(S.groupDraw.step);
    const fallback = pool[0] ?? S.groupDraw.order[Math.min(S.groupDraw.step, S.groupDraw.order.length - 1)];
    const preview = S.groupDraw.rollingPreview ?? fallback;
    const previewIndex = Math.max(0, pool.indexOf(preview));
    renderGroupDrawCarousel(currentTarget, pool, previewIndex, false);
  }
}

function buildGroupDrawAnimatedCard(groupId) {
  const slots = (S.groupDraw && S.groupDraw.slots && S.groupDraw.slots[groupId]) || new Array(GROUP_DRAW_SLOTS_PER_GROUP).fill(null);
  const card = document.createElement('div');
  card.className = 'gd-group';

  let slotsHtml = '';
  for (let i = 0; i < GROUP_DRAW_SLOTS_PER_GROUP; i++) {
    const playerIdx = slots[i];
    const mode = playerIdx === null ? 'empty' : 'locked';
    slotsHtml += `<div id="gd-slot-${groupId}-${i}" class="gd-slot-row ${mode}">
      ${buildGroupDrawSlotInner(groupId, i, playerIdx, mode)}
    </div>`;
  }

  card.innerHTML = `
    <div class="gd-group-title">GRUPO ${groupId}</div>
    <div class="gd-slot-list">${slotsHtml}</div>
  `;

  return card;
}

function buildGroupDrawSlotInner(groupId, slotIndex, playerIdx, mode) {
  const badge = `${groupId}${slotIndex + 1}`;

  if (mode === 'locked' && playerIdx !== null) {
    const team = teamOf(playerIdx);
    return `
      <span class="gd-slot-badge">${badge}</span>
      <img src="${team.logo}" class="gd-player-logo" alt="${team.name}" onerror="this.style.display='none'">
      <span class="gd-player-name">${playerName(playerIdx)}</span>
      <span class="gd-player-team">${team.short}</span>
    `;
  }

  if (mode === 'rolling') {
    return `
      <span class="gd-slot-badge">${badge}</span>
      <span class="gd-slot-placeholder">Sorteando...</span>
    `;
  }

  return `
    <span class="gd-slot-badge">${badge}</span>
    <span class="gd-slot-placeholder">Aguardando sorteio</span>
  `;
}

function buildGroupDrawCard(groupId) {
  const group = S.groups[groupId];
  const card = document.createElement('div');
  card.className = 'gd-group';

  const playersHtml = group.players.map(playerIdx => {
    const team = teamOf(playerIdx);
    return `<div class="gd-player-row">
      <img src="${team.logo}" class="gd-player-logo" alt="${team.name}" onerror="this.style.display='none'">
      <span class="gd-player-name">${playerName(playerIdx)}</span>
      <span class="gd-player-team">${team.short}</span>
    </div>`;
  }).join('');

  card.innerHTML = `
    <div class="gd-group-title">GRUPO ${groupId}</div>
    <div class="gd-player-list">${playersHtml}</div>
  `;

  return card;
}

// ============================================
// TOURNAMENT SCREEN
// ============================================
function startTournament() {
  if (!S.groups || !hasCompletedGroupDraw()) return;
  if (S.groupDraw && S.groupDraw.isAnimating) return;
  const state = prepareTournamentState();
  if (!state) return;

  if (S.knockout.ready) {
    showScreen('qualifiers');
    renderQualifiersScreen();
  } else {
    showScreen('groups');
    renderGroupsScreen();
  }
}

function openGroupsScreen() {
  if (!S.groups) return;
  showScreen('groups');
  renderGroupsScreen();
}

function openQualifiersScreen() {
  if (!S.groups) return;
  showScreen('qualifiers');
  renderQualifiersScreen();
}

function renderTournament() {
  const current = S.screen === 'qualifiers' ? 'qualifiers' : 'groups';
  if (current === 'qualifiers') {
    renderQualifiersScreen();
  } else {
    renderGroupsScreen();
  }
}

function prepareTournamentState() {
  if (!S.groups) return;

  const state = syncTournamentState(true);
  save();
  return state;
}

function renderGroupsScreen() {
  const state = prepareTournamentState();
  if (!state) return;

  const container = document.getElementById('groups-container');
  if (!container) return;
  container.innerHTML = '';

  const layout = document.createElement('div');
  layout.className = 'groups-layout';

  const groupsSection = document.createElement('section');
  groupsSection.className = 'groups-section';
  groupsSection.innerHTML = '<div class="section-title">FASE DE GRUPOS</div>';

  const groupsGrid = document.createElement('div');
  groupsGrid.className = 'group-stage-grid';
  GROUP_IDS.forEach(groupId => {
    groupsGrid.appendChild(buildGroupPanel(groupId, state[`group${groupId}`]));
  });
  groupsSection.appendChild(groupsGrid);
  layout.appendChild(groupsSection);
  container.appendChild(layout);
}

function renderQualifiersScreen() {
  const state = prepareTournamentState();
  if (!state) return;

  const container = document.getElementById('qualifiers-container');
  if (!container) return;
  container.innerHTML = '';

  const layout = document.createElement('div');
  layout.className = 'qualifiers-layout';

  const koSection = document.createElement('section');
  koSection.className = 'knockout-section';

  const koHeader = document.createElement('div');
  koHeader.className = 'section-title-row';
  koHeader.innerHTML = `
    <div class="section-title">QUALIFICATÓRIAS</div>
    <div class="knockout-status ${S.knockout.ready ? 'ok' : 'wait'}">${S.knockout.ready ? 'Mata-mata liberado' : 'Aguardando definicao dos grupos'}</div>
  `;
  koSection.appendChild(koHeader);

  const board = document.createElement('div');
  board.className = 'knockout-board';
  renderKnockoutBoard(board);
  koSection.appendChild(board);

  layout.appendChild(koSection);
  container.appendChild(layout);
}

function buildGroupPanel(groupId, groupResult) {
  const group = S.groups[groupId];

  const panel = document.createElement('div');
  panel.className = 'group-panel';

  const subtitle = groupResult.regularComplete
    ? (groupResult.resolved ? 'Classificacao definida.' : 'Desempates pendentes.')
    : `Faltam ${groupResult.pendingRegularMatches} jogos da fase regular.`;

  panel.innerHTML = `
    <div class="group-panel-head">
      <div class="group-panel-title">${GROUP_IDS.length === 1 ? 'CLASSIFICAÇÃO' : `GRUPO ${groupId}`}</div>
      <div class="group-panel-subtitle">${subtitle}</div>
    </div>
    ${buildStandingsTable(groupResult.rows)}
    <div class="group-note ${groupResult.blockers.length ? 'warn' : ''}">${groupResult.blockers.length ? groupResult.blockers.join(' | ') : 'Sem pendencias de desempate.'}</div>
    <div class="group-matches-title">Jogos do grupo</div>
    <div class="group-match-list" id="group-matches-${groupId}"></div>
  `;

  const list = panel.querySelector(`#group-matches-${groupId}`);

  const played = group.regularMatchIds.filter(id => isMatchScored(S.matches[id]));
  const pending = shuffleArray(group.regularMatchIds.filter(id => !isMatchScored(S.matches[id])));
  [...played, ...pending].forEach(matchId => list.appendChild(buildMatchCard(matchId)));

  if (groupResult.tieMatchIds.length) {
    const tieTitle = document.createElement('div');
    tieTitle.className = 'group-matches-title extra';
    tieTitle.textContent = 'Desempates';
    list.appendChild(tieTitle);
    groupResult.tieMatchIds.forEach(matchId => list.appendChild(buildMatchCard(matchId)));
  }

  return panel;
}

function buildStandingsTable(rows) {
  const body = rows.map(row => {
    const team = teamOf(row.player);
    return `<tr>
      <td>${row.pos}</td>
      <td class="st-player">
        <img src="${team.logo}" class="st-logo" alt="${team.name}" onerror="this.style.display='none'">
        <span>${playerName(row.player)}</span>
      </td>
      <td>${row.played}</td>
      <td>${row.points}</td>
      <td>${row.gd}</td>
      <td>${row.gf}</td>
    </tr>`;
  }).join('');

  return `
    <table class="standings-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Jogador</th>
          <th>J</th>
          <th>P</th>
          <th>SG</th>
          <th>GM</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function renderKnockoutBoard(board) {
  const rounds = [
    { title: 'PLAY-IN', ids: ['PI1', 'PI2'], cls: 'col-pi' },
    { title: 'SEMIFINAIS', ids: ['SF1', 'SF2'], cls: 'col-sf' },
    { title: 'FINAL', ids: ['F1'], cls: 'col-final' }
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
    board.appendChild(col);
  });
}

function buildMatchCard(matchId) {
  const m = S.matches[matchId];
  const card = document.createElement('div');
  card.id = `mc-${matchId}`;

  const scored = isMatchScored(m);
  const complete = isMatchComplete(m);
  const ready = m.playerA !== null && m.playerB !== null;

  card.className = `match-card ${complete ? 'match-done' : ready ? 'match-ready' : 'match-pending-players'}`;

  const badgeText = m.kind === 'group-regular'
    ? 'Grupo'
    : m.kind === 'tie-duel'
      ? 'Jogo extra'
      : m.kind === 'tie-mini'
        ? 'Mini-tabela'
        : 'Mata-mata';

  const unresolvedPenalty = m.mode === 'elimination' && scored && m.winner === null;

  const playerRow = (pIdx, side) => {
    const scoreValue = scored ? (side === 'A' ? m.score.a : m.score.b) : '-';
    if (pIdx === null) {
      return `<div class="match-player tbd">
        <div class="match-logo-placeholder">?</div>
        <span class="match-player-name">A definir</span>
        <span class="match-player-score">-</span>
      </div>`;
    }

    const team = teamOf(pIdx);
    const isWinner = complete && m.winner === pIdx;
    const isLoser = complete && m.winner !== null && m.winner !== pIdx;

    return `<div class="match-player ${isWinner ? 'winner' : ''} ${isLoser ? 'loser' : ''}">
      <img src="${team.logo}" class="match-team-logo" alt="${team.name}"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="match-logo-placeholder" style="display:none">${team.initials}</div>
      <span class="match-player-name">${playerName(pIdx)}</span>
      <span class="match-player-score">${scoreValue}</span>
    </div>`;
  };

  const actionLabel = unresolvedPenalty
    ? 'Definir penalti'
    : (scored ? 'Editar placar' : 'Inserir placar');

  const winnerLabel = m.mode === 'elimination' && complete
    ? `<div class="match-winner-label">${playerName(m.winner)}${m.decidedByPenalties ? ' (pen.)' : ''}</div>`
    : '';

  const warningLabel = unresolvedPenalty
    ? '<div class="match-warning">Empate - selecione vencedor nos penaltis</div>'
    : '';

  card.innerHTML = `
    <div class="match-head">
      <span class="match-type-badge">${badgeText}</span>
      <span class="match-label">${m.label}</span>
    </div>
    ${playerRow(m.playerA, 'A')}
    <div class="match-divider">
      <span class="match-vs">VS</span>
    </div>
    ${playerRow(m.playerB, 'B')}
    ${ready ? `<button class="match-btn" onclick="openModal('${matchId}')">${actionLabel}</button>` : ''}
    ${warningLabel}
    ${winnerLabel}
  `;

  return card;
}

// ============================================
// GROUP RESOLUTION + TIEBREAKS
// ============================================
function syncTournamentState(allowCreateStages) {
  const result = {};
  GROUP_IDS.forEach(id => {
    result[`group${id}`] = getGroupResolution(id, allowCreateStages);
  });

  syncKnockoutSeeds(result.groupA);
  syncKnockoutProgress();

  return result;
}

function getGroupResolution(groupId, allowCreateStages) {
  const group = S.groups[groupId];
  const players = [...group.players];
  const stats = computeStats(players, group.regularMatchIds);
  const base = rankPlayersByRules(players, stats, group.regularMatchIds);

  const regularComplete = group.regularMatchIds.every(id => isMatchScored(S.matches[id]));
  const pendingRegularMatches = group.regularMatchIds.filter(id => !isMatchScored(S.matches[id])).length;

  let order = [...base.order];
  const blockers = [];

  if (regularComplete) {
    base.unresolvedSets.forEach(setPlayers => {
      const stage = allowCreateStages ? ensureTieStage(groupId, 'regular', null, setPlayers) : findTieStage(groupId, 'regular', null, setPlayers);
      if (!stage) {
        blockers.push(`Desempate pendente no Grupo ${groupId}.`);
        return;
      }

      const stageResult = evaluateTieStage(stage, allowCreateStages);
      order = replacePlayers(order, setPlayers, stageResult.order);
      if (!stageResult.resolved) blockers.push(...stageResult.blockers);
    });
  }

  const rows = order.map((player, idx) => {
    const p = stats[player];
    return {
      pos: idx + 1,
      player,
      played: p.played,
      points: p.points,
      gd: p.gd,
      gf: p.gf
    };
  });

  return {
    groupId,
    order,
    rows,
    regularComplete,
    pendingRegularMatches,
    tieMatchIds: collectTieMatchIds(group),
    blockers: unique(blockers),
    resolved: regularComplete && blockers.length === 0
  };
}

function collectTieMatchIds(group) {
  return unique(group.tieStages.flatMap(stage => stage.matchIds));
}

function computeStats(players, matchIds) {
  const stats = {};
  players.forEach(p => {
    stats[p] = {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0
    };
  });

  matchIds.forEach(matchId => {
    const m = S.matches[matchId];
    if (!m || !isMatchScored(m) || m.playerA === null || m.playerB === null) return;

    const a = m.playerA;
    const b = m.playerB;
    const ga = m.score.a;
    const gb = m.score.b;

    if (!stats[a] || !stats[b]) return;

    stats[a].played += 1;
    stats[b].played += 1;
    stats[a].gf += ga;
    stats[a].ga += gb;
    stats[b].gf += gb;
    stats[b].ga += ga;

    if (ga > gb) {
      stats[a].wins += 1;
      stats[b].losses += 1;
      stats[a].points += 3;
    } else if (gb > ga) {
      stats[b].wins += 1;
      stats[a].losses += 1;
      stats[b].points += 3;
    } else {
      stats[a].draws += 1;
      stats[b].draws += 1;
      stats[a].points += 1;
      stats[b].points += 1;
    }
  });

  players.forEach(p => {
    stats[p].gd = stats[p].gf - stats[p].ga;
  });

  return stats;
}

function rankPlayersByRules(players, stats, matchIds) {
  const pointsBuckets = new Map();
  players.forEach(player => {
    const pts = stats[player].points;
    if (!pointsBuckets.has(pts)) pointsBuckets.set(pts, []);
    pointsBuckets.get(pts).push(player);
  });

  const sortedPointKeys = [...pointsBuckets.keys()].sort((a, b) => b - a);

  const order = [];
  const unresolvedSets = [];

  sortedPointKeys.forEach(points => {
    const bucket = pointsBuckets.get(points);

    if (bucket.length === 2) {
      const [x, y] = bucket;
      const h2hWinner = headToHeadWinner(x, y, matchIds);
      if (h2hWinner !== null) {
        order.push(h2hWinner, h2hWinner === x ? y : x);
        return;
      }
    }

    const sorted = [...bucket].sort((a, b) => {
      const gdDiff = stats[b].gd - stats[a].gd;
      if (gdDiff !== 0) return gdDiff;

      const gfDiff = stats[b].gf - stats[a].gf;
      if (gfDiff !== 0) return gfDiff;

      return playerName(a).localeCompare(playerName(b));
    });

    order.push(...sorted);

    const tiesByGdGf = findGdGfTieSets(sorted, stats);
    tiesByGdGf.forEach(setPlayers => {
      if (setPlayers.length > 1) unresolvedSets.push(setPlayers);
    });
  });

  return { order, unresolvedSets };
}

function findGdGfTieSets(sortedPlayers, stats) {
  const sets = [];

  let i = 0;
  while (i < sortedPlayers.length) {
    let j = i + 1;
    while (
      j < sortedPlayers.length &&
      stats[sortedPlayers[i]].gd === stats[sortedPlayers[j]].gd &&
      stats[sortedPlayers[i]].gf === stats[sortedPlayers[j]].gf
    ) {
      j += 1;
    }

    if (j - i > 1) {
      sets.push(sortedPlayers.slice(i, j));
    }

    i = j;
  }

  return sets;
}

function headToHeadWinner(a, b, matchIds) {
  let pointsA = 0;
  let pointsB = 0;
  let gdA = 0;

  matchIds.forEach(matchId => {
    const m = S.matches[matchId];
    if (!m || !isMatchScored(m)) return;

    const isAB = m.playerA === a && m.playerB === b;
    const isBA = m.playerA === b && m.playerB === a;
    if (!isAB && !isBA) return;

    const ga = isAB ? m.score.a : m.score.b;
    const gb = isAB ? m.score.b : m.score.a;

    gdA += ga - gb;

    if (ga > gb) pointsA += 3;
    else if (gb > ga) pointsB += 3;
    else {
      pointsA += 1;
      pointsB += 1;
    }
  });

  if (pointsA > pointsB) return a;
  if (pointsB > pointsA) return b;
  if (gdA > 0) return a;
  if (gdA < 0) return b;

  return null;
}

function ensureTieStage(groupId, sourceType, sourceId, participants) {
  const existing = findTieStage(groupId, sourceType, sourceId, participants);
  if (existing) return existing;

  const group = S.groups[groupId];
  const sortedParticipants = [...participants].sort((a, b) => a - b);
  const key = `${sourceType}|${sourceId || 'root'}|${participantsKey(sortedParticipants)}`;

  const type = sortedParticipants.length === 2 ? 'duel' : 'mini';
  const stageId = `TS-${groupId}-${S.nextTieStage++}`;

  const stage = {
    id: stageId,
    key,
    groupId,
    sourceType,
    sourceId,
    participants: sortedParticipants,
    type,
    matchIds: []
  };

  if (type === 'duel') {
    const matchId = `TB-${groupId}-${S.nextTieMatch++}`;
    const duelLabel = sourceType === 'regular'
      ? `Desempate Grupo ${groupId}`
      : `Jogo extra Grupo ${groupId}`;

    createMatch({
      id: matchId,
      label: duelLabel,
      phase: 'groups',
      kind: 'tie-duel',
      mode: 'elimination',
      groupId,
      playerA: sortedParticipants[0],
      playerB: sortedParticipants[1],
      tieStageId: stageId
    });

    stage.matchIds.push(matchId);
  } else {
    let seq = 1;
    for (let i = 0; i < sortedParticipants.length; i++) {
      for (let j = i + 1; j < sortedParticipants.length; j++) {
        const matchId = `TB-${groupId}-${S.nextTieMatch++}`;
        createMatch({
          id: matchId,
          label: `Mini Grupo ${groupId} - Jogo ${seq++}`,
          phase: 'groups',
          kind: 'tie-mini',
          mode: 'league',
          groupId,
          playerA: sortedParticipants[i],
          playerB: sortedParticipants[j],
          tieStageId: stageId
        });
        stage.matchIds.push(matchId);
      }
    }
  }

  group.tieStages.push(stage);
  return stage;
}

function findTieStage(groupId, sourceType, sourceId, participants) {
  const group = S.groups[groupId];
  const key = `${sourceType}|${sourceId || 'root'}|${participantsKey(participants)}`;
  return group.tieStages.find(stage => stage.key === key) || null;
}

function evaluateTieStage(stage, allowCreateStages) {
  if (stage.type === 'duel') {
    const m = S.matches[stage.matchIds[0]];
    if (m && m.winner !== null) {
      const loser = stage.participants.find(p => p !== m.winner);
      return {
        resolved: true,
        order: [m.winner, loser],
        blockers: []
      };
    }

    return {
      resolved: false,
      order: [...stage.participants],
      blockers: [`Jogo extra pendente: ${playerName(stage.participants[0])} x ${playerName(stage.participants[1])}.`]
    };
  }

  const miniMatchesDone = stage.matchIds.every(matchId => isMatchScored(S.matches[matchId]));
  const miniStats = computeStats(stage.participants, stage.matchIds);
  const miniRank = rankPlayersByRules(stage.participants, miniStats, stage.matchIds);
  let order = [...miniRank.order];

  if (!miniMatchesDone) {
    return {
      resolved: false,
      order,
      blockers: [`Mini-tabela pendente no Grupo ${stage.groupId}.`]
    };
  }

  const blockers = [];

  miniRank.unresolvedSets.forEach(setPlayers => {
    const childStage = allowCreateStages
      ? ensureTieStage(stage.groupId, 'mini', stage.id, setPlayers)
      : findTieStage(stage.groupId, 'mini', stage.id, setPlayers);

    if (!childStage) {
      blockers.push(`Desempate extra pendente no Grupo ${stage.groupId}.`);
      return;
    }

    const childResult = evaluateTieStage(childStage, allowCreateStages);
    order = replacePlayers(order, setPlayers, childResult.order);
    if (!childResult.resolved) blockers.push(...childResult.blockers);
  });

  return {
    resolved: blockers.length === 0,
    order,
    blockers
  };
}

function replacePlayers(order, targetPlayers, replacementOrder) {
  const targetSet = new Set(targetPlayers);
  const targetIndexes = [];

  order.forEach((player, idx) => {
    if (targetSet.has(player)) targetIndexes.push(idx);
  });

  if (targetIndexes.length !== replacementOrder.length) return order;

  const next = [...order];
  targetIndexes.forEach((idx, i) => {
    next[idx] = replacementOrder[i];
  });

  return next;
}

// ============================================
// KNOCKOUT SEEDS + PROGRESSION
// ============================================
function syncKnockoutSeeds(groupA) {
  const ready = groupA.resolved;
  S.knockout.ready = ready;

  if (!ready) {
    setMatchPlayers('PI1', null, null);
    setMatchPlayers('PI2', null, null);
    setMatchPlayers('SF1', null, null);
    setMatchPlayers('SF2', null, null);
    return;
  }

  const order = groupA.order; // 8 players ranked

  S.knockout.seeds = { A: order.slice(0, 6) };

  // 3rd vs 6th → PI1, 4th vs 5th → PI2
  setMatchPlayers('PI1', order[2], order[5]);
  setMatchPlayers('PI2', order[3], order[4]);

  // 1st → SF1 playerA, 2nd → SF2 playerA (keep playerB from progression)
  const sf1 = S.matches.SF1;
  if (sf1.playerA !== order[0]) {
    sf1.playerA = order[0];
    resetMatchResult(sf1);
  }
  const sf2 = S.matches.SF2;
  if (sf2.playerA !== order[1]) {
    sf2.playerA = order[1];
    resetMatchResult(sf2);
  }
}

function syncKnockoutProgress() {
  assignWinnerTo('PI1', 'SF2', 'B');
  assignWinnerTo('PI2', 'SF1', 'B');
  assignWinnerTo('SF1', 'F1', 'A');
  assignWinnerTo('SF2', 'F1', 'B');
}

function assignWinnerTo(fromMatchId, toMatchId, slot) {
  const fromMatch = S.matches[fromMatchId];
  const toMatch = S.matches[toMatchId];
  const nextPlayer = fromMatch.winner;

  if (slot === 'A') {
    if (toMatch.playerA !== nextPlayer) {
      toMatch.playerA = nextPlayer;
      resetMatchResult(toMatch);
    }
  } else {
    if (toMatch.playerB !== nextPlayer) {
      toMatch.playerB = nextPlayer;
      resetMatchResult(toMatch);
    }
  }
}

function setMatchPlayers(matchId, playerA, playerB) {
  const m = S.matches[matchId];
  const changed = m.playerA !== playerA || m.playerB !== playerB;

  if (changed) {
    m.playerA = playerA;
    m.playerB = playerB;
    resetMatchResult(m);
  }
}

function resetMatchResult(match) {
  match.score = { a: null, b: null };
  match.winner = null;
  match.decidedByPenalties = false;
}

// ============================================
// MATCH MODAL
// ============================================
function openModal(matchId) {
  const m = S.matches[matchId];
  if (!m || m.playerA === null || m.playerB === null) return;

  const pA = playerName(m.playerA);
  const pB = playerName(m.playerB);
  const tA = teamOf(m.playerA);
  const tB = teamOf(m.playerB);

  const titleHint = m.mode === 'elimination'
    ? 'Empate no placar vai para penaltis.'
    : 'Vitoria 3 pts, empate 1 pt, derrota 0 pt.';

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${m.label}</h3>
      <button class="modal-close" onclick="closeModal()">X</button>
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
      <div class="modal-leg" style="flex:unset;width:100%">
        <div class="modal-leg-title">PLACAR</div>
        <div class="modal-score-row">
          <input type="number" min="0" max="20" class="score-input" id="score-a" value="${m.score.a !== null ? m.score.a : ''}">
          <span class="score-dash">x</span>
          <input type="number" min="0" max="20" class="score-input" id="score-b" value="${m.score.b !== null ? m.score.b : ''}">
        </div>
      </div>
    </div>

    <div class="modal-aggregate" id="modal-summary">${buildModalSummary(m)}</div>

    <div id="modal-tie" class="modal-tiebreak" style="display:none">
      <p>Empate no placar. Escolha quem venceu nos penaltis.</p>
      <div class="tiebreak-btns">
        <button class="btn-tiebreak" onclick="savePenaltyWinner('${matchId}', ${m.playerA})">${pA}</button>
        <button class="btn-tiebreak" onclick="savePenaltyWinner('${matchId}', ${m.playerB})">${pB}</button>
      </div>
    </div>

    <div class="modal-hint">${titleHint}</div>
    <button class="btn-primary btn-save-score" onclick="saveScores('${matchId}')">Salvar placar</button>
  `;

  ['score-a', 'score-b'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
      document.getElementById('modal-summary').innerHTML = buildModalSummary(m, {
        a: readScore('score-a'),
        b: readScore('score-b')
      });
      document.getElementById('modal-tie').style.display = 'none';
    });
  });

  document.getElementById('match-modal').style.display = 'flex';
}

function buildModalSummary(match, preview = null) {
  const a = preview ? preview.a : match.score.a;
  const b = preview ? preview.b : match.score.b;

  if (a === null || b === null) {
    return '<p class="agg-placeholder">Insira o placar para salvar.</p>';
  }

  if (match.mode === 'league') {
    if (a > b) return `<p class="agg-label">Resultado</p><p class="agg-tie">${playerName(match.playerA)} venceu.</p>`;
    if (b > a) return `<p class="agg-label">Resultado</p><p class="agg-tie">${playerName(match.playerB)} venceu.</p>`;
    return '<p class="agg-label">Resultado</p><p class="agg-tie">Empate.</p>';
  }

  if (a === b) {
    return '<p class="agg-label">Resultado</p><p class="agg-tie">Empate: definir vencedor nos penaltis.</p>';
  }

  return `<p class="agg-label">Resultado</p><p class="agg-tie">${a > b ? playerName(match.playerA) : playerName(match.playerB)} avanca.</p>`;
}

function readScore(id) {
  const el = document.getElementById(id);
  if (!el || el.value === '') return null;
  return parseInt(el.value, 10);
}

function saveScores(matchId) {
  const m = S.matches[matchId];
  if (!m) return;

  const a = readScore('score-a');
  const b = readScore('score-b');

  m.score = { a, b };
  m.decidedByPenalties = false;

  if (m.mode === 'league') {
    m.winner = null;
    postScoreUpdate(matchId);
    return;
  }

  if (a === null || b === null) {
    m.winner = null;
    postScoreUpdate(matchId);
    return;
  }

  if (a > b) {
    m.winner = m.playerA;
    postScoreUpdate(matchId);
    return;
  }

  if (b > a) {
    m.winner = m.playerB;
    postScoreUpdate(matchId);
    return;
  }

  m.winner = null;
  save();
  document.getElementById('modal-tie').style.display = 'block';
}

function savePenaltyWinner(matchId, winnerIdx) {
  const m = S.matches[matchId];
  if (!m) return;
  m.winner = winnerIdx;
  m.decidedByPenalties = true;
  postScoreUpdate(matchId);
}

function postScoreUpdate(matchId) {
  syncTournamentState(true);
  save();

  closeModal();

  if (matchId === 'F1' && S.matches.F1.winner !== null) {
    showScreen('champion');
    renderChampion();
    return;
  }

  const match = S.matches[matchId];
  if (match && match.phase === 'groups') {
    if (S.knockout.ready) {
      showScreen('qualifiers');
      renderQualifiersScreen();
    } else {
      showScreen('groups');
      renderGroupsScreen();
    }
    return;
  }

  showScreen('qualifiers');
  renderQualifiersScreen();
}

function closeModal() {
  document.getElementById('match-modal').style.display = 'none';
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('match-modal')) closeModal();
}

function isMatchScored(match) {
  return match && match.score.a !== null && match.score.b !== null;
}

function isMatchComplete(match) {
  if (!match) return false;
  if (match.mode === 'league') return isMatchScored(match);
  return match.winner !== null;
}

// ============================================
// CHAMPION
// ============================================
function renderChampion() {
  const m = S.matches.F1;
  if (!m || m.winner === null) return;

  const team = teamOf(m.winner);
  document.getElementById('champion-details').innerHTML = `
    <img src="${team.logo}" class="champ-logo" alt="${team.name}" onerror="this.style.display='none'">
    <div class="champ-player-name">${playerName(m.winner)}</div>
    <div class="champ-team-name">${team.name}</div>
    <div class="champ-note">${m.decidedByPenalties ? 'Titulo decidido nos penaltis.' : 'Titulo decidido no tempo normal.'}</div>
  `;

  spawnConfetti();
}

function spawnConfetti() {
  const cont = document.getElementById('confetti-container');
  cont.innerHTML = '';
  const colors = ['#FFD700', '#9333EA', '#ffffff', '#FFA500', '#6B21A8', '#FFF5B0'];

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
  if (!confirm('Reiniciar o torneio? Todo progresso sera perdido.')) return;
  clearGroupDrawTimers();
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('chimpas_v4');
  S = createInitialState();
  showScreen('splash');
}

