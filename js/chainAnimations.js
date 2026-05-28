// Registry of 25 chain-build animations. Each runs when filling today's box
// extends an existing streak; intensity scales with streak length via the
// number of "chain cells" included in the effect.
//
// Architecture:
//   - PLAYERS[id](ctx) = play function. ctx = { calendarEl, todayCell,
//     chainCells, streakLength, habit }. chainCells goes oldest → today.
//   - Helpers compose pulse / floater / burst / particle primitives.
//   - Picker preview reuses the same play function via playChainAnimationById,
//     passing synthetic preview cells in place of real day cells.

import { todayISO, daysAgoISO } from './utils.js';

// ----- Registry (display order = picker tile order) -----

export const CHAIN_ANIMATIONS = [
  // Sequential cell pulse variants
  { id: 'cascade',      name: 'Cascade',      blurb: 'Pulse rolls forward to today' },
  { id: 'backwash',     name: 'Backwash',     blurb: 'Pulse rolls back from today' },
  { id: 'wave',         name: 'Wave',         blurb: 'Soft accelerating sweep' },
  { id: 'edge-in',      name: 'Edge-in',      blurb: 'Pulses from both ends meet in middle' },
  { id: 'center-out',   name: 'Center out',   blurb: 'Pulse spreads from chain center' },

  // Per-cell effect variants
  { id: 'glow-trail',   name: 'Glow trail',   blurb: 'Glow sweeps without scale' },
  { id: 'ripple-trail', name: 'Ripple trail', blurb: 'Each cell rings as it pulses' },
  { id: 'shimmer-row',  name: 'Shimmer row',  blurb: 'Light streak sweeps the chain' },
  { id: 'dominos',      name: 'Dominos',      blurb: 'Cells tilt in sequence' },
  { id: 'flicker',      name: 'Flicker',      blurb: 'Rapid pulse pattern' },

  // All-at-once
  { id: 'surge',        name: 'Surge',        blurb: 'Whole chain pulses at once' },
  { id: 'heartbeat',    name: 'Heartbeat',    blurb: 'Two quick pulses, settle' },
  { id: 'breathe',      name: 'Breathe',      blurb: 'Slow scale in and out' },
  { id: 'whisper',      name: 'Whisper',      blurb: 'Minimal subtle pulse' },
  { id: 'gentle-glow',  name: 'Gentle glow',  blurb: 'Soft sustained glow' },

  // Today-centric effects
  { id: 'echo',         name: 'Echo',         blurb: 'Rings ripple back from today' },
  { id: 'shockwave',    name: 'Shockwave',    blurb: 'Big ring expands from today' },
  { id: 'pulse-bomb',   name: 'Pulse bomb',   blurb: 'Heavy radial glow from today' },
  { id: 'starburst',    name: 'Starburst',    blurb: 'Star rays burst from today' },
  { id: 'fireworks',    name: 'Fireworks',    blurb: 'Particle burst at today' },
  { id: 'confetti',     name: 'Confetti',     blurb: 'Colored bits fly upward' },

  // Floater-driven (text/icon variants)
  { id: 'counter',      name: 'Counter',      blurb: 'Number ticks up at today' },
  { id: 'stack',        name: 'Stack',        blurb: '+1s rise from each cell' },
  { id: 'combo',        name: 'Combo',        blurb: '"COMBO!" text + flashes' },
  { id: 'streak-fire',  name: 'Streak fire',  blurb: 'Flame rises, grows with streak' },
];

export const DEFAULT_CHAIN_ANIMATION_ID = 'cascade';
const STORAGE_KEY = 'seinfeld_chain_animation';
const VALID_IDS = new Set(CHAIN_ANIMATIONS.map(a => a.id));

export function getSelectedChainAnimationId() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return VALID_IDS.has(saved) ? saved : DEFAULT_CHAIN_ANIMATION_ID;
}

export function setSelectedChainAnimationId(id) {
  if (!VALID_IDS.has(id)) return false;
  localStorage.setItem(STORAGE_KEY, id);
  return true;
}

// ----- Public play API -----

export function playChainAnimation(calendarEl, streakLength, habit) {
  if (streakLength < 2) return;
  const todayCell = calendarEl.querySelector(`[data-day="${todayISO()}"]`);
  if (!todayCell) return;
  const chainCells = collectChainCells(calendarEl, streakLength);
  playChainAnimationById(getSelectedChainAnimationId(), {
    calendarEl, todayCell, chainCells, streakLength, habit,
  });
}

export function playChainAnimationById(id, ctx) {
  const play = PLAYERS[id] || PLAYERS[DEFAULT_CHAIN_ANIMATION_ID];
  play(ctx);
}

function collectChainCells(calendarEl, streakLength) {
  // Returns cells oldest → today, length = cascadeLength + 1 (today included).
  const len = cascadeLengthForStreak(streakLength);
  const cells = [];
  for (let i = len; i >= 0; i--) {
    const cell = calendarEl.querySelector(`[data-day="${daysAgoISO(i)}"]`);
    if (cell) cells.push(cell);
  }
  return cells;
}

// Cascade length stays consistent across animation types — defines how many
// cells back from today get included in the effect.
function cascadeLengthForStreak(streak) {
  if (streak < 3)  return 0;
  if (streak < 7)  return Math.min(streak - 1, 3);
  if (streak < 14) return Math.min(streak - 1, 6);
  if (streak < 30) return Math.min(streak - 1, 10);
  return Math.min(streak - 1, 14);
}

function floaterSize(streak) {
  if (streak < 7)  return 16;
  if (streak < 14) return 22;
  if (streak < 30) return 28;
  return 34;
}

// ----- Helpers -----

function pulseCell(cell, color, opts = {}) {
  const { klass = 'chain-pulse', duration = 460, glow = null, scale = null } = opts;
  cell.style.setProperty('--pulse-color', color);
  if (glow  !== null) cell.style.setProperty('--pulse-glow', glow);
  if (scale !== null) cell.style.setProperty('--pulse-scale', scale);
  cell.classList.add(klass);
  setTimeout(() => {
    cell.classList.remove(klass);
    cell.style.removeProperty('--pulse-color');
    cell.style.removeProperty('--pulse-glow');
    cell.style.removeProperty('--pulse-scale');
  }, duration + 40);
}

function showFloater(cell, text, color, opts = {}) {
  const { size = 16, klass = 'chain-floater', duration = 1300 } = opts;
  const fl = document.createElement('span');
  fl.className = klass;
  fl.textContent = text;
  fl.style.setProperty('--floater-color', color);
  fl.style.fontSize = `${size}px`;
  cell.appendChild(fl);
  setTimeout(() => fl.remove(), duration);
}

function defaultFloater(ctx, delay = 0) {
  setTimeout(() => showFloater(
    ctx.todayCell, `+${ctx.streakLength}`, ctx.habit.color,
    { size: floaterSize(ctx.streakLength) }
  ), delay);
}

// Generic burst overlay at a cell — div absolutely positioned, animated by CSS.
function burstAt(cell, color, klass = 'chain-burst', duration = 700) {
  const b = document.createElement('span');
  b.className = klass;
  b.style.setProperty('--burst-color', color);
  cell.appendChild(b);
  setTimeout(() => b.remove(), duration + 40);
}

// Spawn N particle dots that fly outward from a cell.
function particlesAt(cell, color, count = 8, opts = {}) {
  const {
    klass = 'chain-particle',
    spread = 50,        // px max distance
    duration = 900,
  } = opts;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = klass;
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const dist  = spread * (0.6 + Math.random() * 0.5);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    p.style.setProperty('--p-color', color);
    p.style.setProperty('--p-dx', `${dx.toFixed(0)}px`);
    p.style.setProperty('--p-dy', `${dy.toFixed(0)}px`);
    p.style.animationDelay = `${Math.random() * 80}ms`;
    cell.appendChild(p);
  }
  setTimeout(() => {
    cell.querySelectorAll(`.${klass}`).forEach(p => p.remove());
  }, duration + 200);
}

// Spawn N colored confetti rectangles that rise + drift.
function confettiAt(cell, color, count = 12) {
  const palette = [color, '#ff5a5f', '#ffc857', '#3498db', '#2ecc71', '#9b59b6'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'chain-confetti';
    const dx = (Math.random() - 0.5) * 80;
    const rot = (Math.random() - 0.5) * 720;
    const c = palette[i % palette.length];
    p.style.setProperty('--c-color', c);
    p.style.setProperty('--c-dx', `${dx.toFixed(0)}px`);
    p.style.setProperty('--c-rot', `${rot.toFixed(0)}deg`);
    p.style.animationDelay = `${Math.random() * 120}ms`;
    cell.appendChild(p);
  }
  setTimeout(() => {
    cell.querySelectorAll('.chain-confetti').forEach(p => p.remove());
  }, 1500);
}

// Apply perCellFn to cells with timing pattern.
function runSequence(cells, perCellFn, opts = {}) {
  const { stepMs = 65, reverse = false } = opts;
  const ordered = reverse ? [...cells].reverse() : cells;
  ordered.forEach((cell, i) => {
    setTimeout(() => perCellFn(cell, i, ordered.length), i * stepMs);
  });
}

// ----- 25 play functions -----

const PLAYERS = {};

// 1. Cascade — sequential pulse forward to today (default)
PLAYERS['cascade'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  runSequence(past, (cell) => pulseCell(cell, ctx.habit.color));
  defaultFloater(ctx, Math.max(0, (past.length - 1) * 65));
};

// 2. Backwash — sequential pulse running back from today
PLAYERS['backwash'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  runSequence(past, (cell) => pulseCell(cell, ctx.habit.color), { reverse: true });
  defaultFloater(ctx, 0);
};

// 3. Wave — accelerating step intervals
PLAYERS['wave'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  past.forEach((cell, i) => {
    const delay = Math.round(180 * (1 - Math.cos((i / past.length) * Math.PI)) / 2);
    setTimeout(() => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-soft' }), delay * (i + 1) * 0.5);
  });
  defaultFloater(ctx, past.length * 50);
};

// 4. Edge-in — both ends pulse, meet in the middle
PLAYERS['edge-in'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  const mid = Math.ceil(past.length / 2);
  for (let i = 0; i < mid; i++) {
    setTimeout(() => pulseCell(past[i], ctx.habit.color), i * 75);
    const right = past[past.length - 1 - i];
    if (right && right !== past[i]) setTimeout(() => pulseCell(right, ctx.habit.color), i * 75);
  }
  defaultFloater(ctx, mid * 75);
};

// 5. Center-out — middle cell first, expands outward
PLAYERS['center-out'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  const mid = Math.floor(past.length / 2);
  past.forEach((cell, i) => {
    const dist = Math.abs(i - mid);
    setTimeout(() => pulseCell(cell, ctx.habit.color), dist * 75);
  });
  defaultFloater(ctx, Math.ceil(past.length / 2) * 75);
};

// 6. Glow trail — sequential glow only, no scale
PLAYERS['glow-trail'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  runSequence(past, (cell) => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-glow', duration: 600 }));
  defaultFloater(ctx, Math.max(0, (past.length - 1) * 65));
};

// 7. Ripple trail — each cell emits a ring as it pulses
PLAYERS['ripple-trail'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  runSequence(past, (cell) => {
    pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-soft' });
    burstAt(cell, ctx.habit.color, 'chain-burst-ring', 600);
  });
  defaultFloater(ctx, Math.max(0, (past.length - 1) * 65));
};

// 8. Shimmer row — diagonal light streak sweeps each cell
PLAYERS['shimmer-row'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  runSequence(past, (cell) => {
    cell.classList.add('chain-shimmer');
    setTimeout(() => cell.classList.remove('chain-shimmer'), 520);
  }, { stepMs: 55 });
  defaultFloater(ctx, Math.max(0, (past.length - 1) * 55));
};

// 9. Dominos — sequential tilt as if falling
PLAYERS['dominos'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  runSequence(past, (cell) => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-tilt' }), { stepMs: 75 });
  defaultFloater(ctx, Math.max(0, (past.length - 1) * 75));
};

// 10. Flicker — rapid on-off pulse on each cell
PLAYERS['flicker'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  runSequence(past, (cell) => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-flicker', duration: 350 }), { stepMs: 40 });
  defaultFloater(ctx, Math.max(0, (past.length - 1) * 40));
};

// 11. Surge — all chain cells pulse simultaneously
PLAYERS['surge'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  past.forEach(cell => pulseCell(cell, ctx.habit.color));
  defaultFloater(ctx, 200);
};

// 12. Heartbeat — two quick simultaneous pulses
PLAYERS['heartbeat'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  past.forEach(cell => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-soft', duration: 240 }));
  setTimeout(() => past.forEach(cell => pulseCell(cell, ctx.habit.color, { duration: 340 })), 280);
  defaultFloater(ctx, 500);
};

// 13. Breathe — slow simultaneous scale in and out
PLAYERS['breathe'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  past.forEach(cell => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-breathe', duration: 900 }));
  defaultFloater(ctx, 400);
};

// 14. Whisper — minimal subtle pulse
PLAYERS['whisper'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  runSequence(past, (cell) => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-soft', duration: 380 }), { stepMs: 50 });
  defaultFloater(ctx, Math.max(0, (past.length - 1) * 50));
};

// 15. Gentle glow — soft sustained glow on chain, no movement
PLAYERS['gentle-glow'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  past.forEach(cell => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-glow', duration: 900 }));
  defaultFloater(ctx, 400);
};

// 16. Echo — pulse on today, then ripple back along chain
PLAYERS['echo'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  burstAt(ctx.todayCell, ctx.habit.color, 'chain-burst-ring', 600);
  runSequence(past, (cell) => burstAt(cell, ctx.habit.color, 'chain-burst-ring', 500), { stepMs: 70, reverse: true });
  defaultFloater(ctx, 200);
};

// 17. Shockwave — single large ring expands from today
PLAYERS['shockwave'] = (ctx) => {
  burstAt(ctx.todayCell, ctx.habit.color, 'chain-shockwave', 850);
  defaultFloater(ctx, 100);
};

// 18. Pulse bomb — heavy radial glow at today
PLAYERS['pulse-bomb'] = (ctx) => {
  burstAt(ctx.todayCell, ctx.habit.color, 'chain-pulse-bomb', 700);
  defaultFloater(ctx, 50);
};

// 19. Starburst — star rays at today
PLAYERS['starburst'] = (ctx) => {
  burstAt(ctx.todayCell, ctx.habit.color, 'chain-starburst', 700);
  defaultFloater(ctx, 100);
};

// 20. Fireworks — particle burst at today (count scales with streak)
PLAYERS['fireworks'] = (ctx) => {
  const count = Math.min(6 + ctx.streakLength, 24);
  particlesAt(ctx.todayCell, ctx.habit.color, count, { spread: 60 });
  defaultFloater(ctx, 100);
};

// 21. Confetti — colored particle rise from today
PLAYERS['confetti'] = (ctx) => {
  const count = Math.min(8 + ctx.streakLength, 28);
  confettiAt(ctx.todayCell, ctx.habit.color, count);
  defaultFloater(ctx, 100);
};

// 22. Counter — animated tick from 1 to N at today
PLAYERS['counter'] = (ctx) => {
  const fl = document.createElement('span');
  fl.className = 'chain-floater chain-floater-counter';
  fl.style.setProperty('--floater-color', ctx.habit.color);
  fl.style.fontSize = `${floaterSize(ctx.streakLength)}px`;
  fl.textContent = '+1';
  ctx.todayCell.appendChild(fl);
  const target = ctx.streakLength;
  const stepMs = Math.max(40, 600 / target);
  let i = 1;
  const tick = setInterval(() => {
    i++;
    if (i > target) { clearInterval(tick); return; }
    fl.textContent = `+${i}`;
  }, stepMs);
  setTimeout(() => fl.remove(), 1500);
};

// 23. Stack — small +1s float up from each chain cell, converging
PLAYERS['stack'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  past.forEach((cell, i) => {
    setTimeout(() => showFloater(cell, '+1', ctx.habit.color, { size: 12, klass: 'chain-floater chain-floater-mini', duration: 900 }), i * 60);
  });
  defaultFloater(ctx, past.length * 60 + 100);
};

// 24. Combo — "COMBO!" themed text + cell flashes
PLAYERS['combo'] = (ctx) => {
  const past = ctx.chainCells.slice(0, -1);
  past.forEach(cell => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-flicker', duration: 300 }));
  const fl = document.createElement('span');
  fl.className = 'chain-floater chain-floater-combo';
  fl.style.setProperty('--floater-color', ctx.habit.color);
  fl.innerHTML = `<span class="combo-x">${ctx.streakLength}x</span><span class="combo-label">COMBO</span>`;
  ctx.todayCell.appendChild(fl);
  setTimeout(() => fl.remove(), 1400);
};

// 25. Streak fire — flame floater that grows with streak
PLAYERS['streak-fire'] = (ctx) => {
  const fl = document.createElement('span');
  fl.className = 'chain-floater chain-floater-fire';
  fl.style.setProperty('--floater-color', ctx.habit.color);
  const flames = ctx.streakLength >= 30 ? '🔥🔥🔥' : ctx.streakLength >= 14 ? '🔥🔥' : '🔥';
  fl.innerHTML = `<span class="fire-emoji">${flames}</span><span class="fire-num">${ctx.streakLength}</span>`;
  fl.style.fontSize = `${floaterSize(ctx.streakLength)}px`;
  ctx.todayCell.appendChild(fl);
  // Quick warming pulse on chain too
  const past = ctx.chainCells.slice(0, -1);
  past.forEach((cell, i) => {
    setTimeout(() => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-glow', duration: 500 }), i * 50);
  });
  setTimeout(() => fl.remove(), 1400);
};
