// Registry of 25 chain-build animations. Each runs when filling today's box
// extends an existing streak; intensity scales with streak length via the
// number of "chain cells" included in the effect.
//
// Design principle: every animation has a distinctive "today signature" so
// they're recognisable even at streak 2 (where the chain is just 1 past cell
// + today). The cascade richness scales up from there.

import { todayISO, daysAgoISO, fromISO, toISO } from './utils.js';
import { playNoteAt, playChord, playBurst, getSpeedFactor } from './audio.js';

// Audio policy: exactly one mallet hit per visual event.
//   - Sequential chains: pulseCell({note: i}) fires note i at the same time
//     the cell lights, perfect visual/audio sync via shared setTimeout.
//   - Simultaneous chains: playChord(N) stacks N notes the instant all
//     cells light together.
//   - Today-centric bursts: playBurst() plays one bright note alongside
//     the shockwave/fireworks/etc. visual.

// ----- Registry (display order = picker tile order) -----

export const CHAIN_ANIMATIONS = [
  // Sequential cell pulse — direction differentiates them at higher streaks,
  // and each gets a different today signature so they read as distinct even
  // when there's only 1 past cell.
  { id: 'cascade',      name: 'Cascade',      blurb: 'Pulse rolls forward, ring lands on today' },
  { id: 'backwash',     name: 'Backwash',     blurb: 'Ring at today, pulse rolls back' },
  { id: 'wave',         name: 'Wave',         blurb: 'Squash-stretch wave propagates' },
  { id: 'edge-in',      name: 'Edge-in',      blurb: 'Ends pulse, ring converges at today' },
  { id: 'center-out',   name: 'Center out',   blurb: 'Center pulses, rings spread to ends' },

  // Per-cell effect variants — each cell gets a distinctive treatment
  { id: 'glow-trail',   name: 'Glow trail',   blurb: 'Pure color glow, no scale' },
  { id: 'ripple-trail', name: 'Ripple trail', blurb: 'Each cell emits a ring' },
  { id: 'shimmer-row',  name: 'Shimmer row',  blurb: 'Light streak sweeps each cell' },
  { id: 'dominos',      name: 'Dominos',      blurb: 'Cells tilt in sequence, today snaps' },
  { id: 'flicker',      name: 'Flicker',      blurb: 'Rapid pulse pattern across chain' },

  // Simultaneous chain effects
  { id: 'surge',        name: 'Surge',        blurb: 'Whole chain pulses at once' },
  { id: 'heartbeat',    name: 'Heartbeat',    blurb: 'Two beats, then settle' },
  { id: 'breathe',      name: 'Breathe',      blurb: 'Slow scale in and out' },
  { id: 'bloom',        name: 'Bloom',        blurb: 'Radial color bloom from today' },
  { id: 'gentle-glow',  name: 'Gentle glow',  blurb: 'Long, atmospheric glow' },

  // Today-centric effects (already distinctive at any streak)
  { id: 'echo',         name: 'Echo',         blurb: 'Rings ripple back from today' },
  { id: 'shockwave',    name: 'Shockwave',    blurb: 'Big ring expands from today' },
  { id: 'pulse-bomb',   name: 'Pulse bomb',   blurb: 'Heavy radial glow from today' },
  { id: 'starburst',    name: 'Starburst',    blurb: 'Star rays burst from today' },
  { id: 'fireworks',    name: 'Fireworks',    blurb: 'Particle burst at today' },
  { id: 'confetti',     name: 'Confetti',     blurb: 'Colored bits fly upward' },

  // Floater-driven
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

// anchorDayISO = the day the user just filled (where the animation should
// emanate from). This is "today" in the chain sense — the newest end of the
// chain from the user's perspective — which is usually but not always the
// calendar's current date. Falls back to today if not provided.
//
// completionsSet is optional; when present we only include consecutively
// filled past cells in the cascade so the chain visual matches the actual
// connected segment instead of pulsing empty cells next to the anchor.
export function playChainAnimation(calendarEl, streakLength, habit, anchorDayISO, completionsSet) {
  if (streakLength < 2) return;
  const day = anchorDayISO || todayISO();
  const anchorCell = calendarEl.querySelector(`[data-day="${day}"]`);
  if (!anchorCell) return;
  const chainCells = collectChainCellsFromAnchor(calendarEl, day, streakLength, completionsSet);
  playChainAnimationById(getSelectedChainAnimationId(), {
    calendarEl,
    // Kept as `todayCell` so existing play functions don't need renaming —
    // it just means "the anchor cell where the animation lands".
    todayCell: anchorCell,
    chainCells,
    streakLength,
    habit,
  });
}

export function playChainAnimationById(id, ctx) {
  const play = PLAYERS[id] || PLAYERS[DEFAULT_CHAIN_ANIMATION_ID];
  play(ctx);
}

// Returns cells in time order: [oldest connected fill] → anchor.
// Cells before the anchor are only included if they're consecutively filled
// (no gaps). Without completionsSet we fall back to including all calendar
// dates in the window — old behavior, for callers like the picker preview
// that don't have a real completions set.
function collectChainCellsFromAnchor(calendarEl, anchorDayISO, streakLength, completionsSet) {
  const len = cascadeLengthForStreak(streakLength);
  const cells = [];
  const anchor = fromISO(anchorDayISO);
  let broken = false;
  for (let i = len; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(d.getDate() - i);
    const iso = toISO(d);
    if (i > 0 && completionsSet) {
      // Walk strictly backward from the anchor; once we hit an unfilled day
      // the chain is "broken" and we don't include anything older even if it
      // happens to be filled.
      if (broken || !completionsSet.has(iso)) { broken = true; continue; }
    }
    const cell = calendarEl.querySelector(`[data-day="${iso}"]`);
    if (cell) cells.push(cell);
  }
  return cells;
}

// Cascade length = number of PAST cells included = streak - 1 (so the
// whole connected chain back to its oldest day lights up + plays a note).
// No cap: a 30-day chain plays 30 notes, a 100-day chain plays 100 notes.
// playNoteAt octave-shifts so every cell gets a distinct pitch.
// In practice the chain is also bounded by the on-screen DOM — chain cells
// that don't have a [data-day] element (outside the loaded range) just
// silently drop out of the cells array, so the visible cascade caps to
// what's actually rendered (~365 in months view, ~1825 in continuous).
function cascadeLengthForStreak(streak) {
  return streak < 2 ? 0 : streak - 1;
}

// Per-step delay for the cascade. Held CONSTANT (no length-based compression)
// so the chain plays at a steady pace regardless of how long it is — the speed
// slider alone decides the tempo. A longer chain therefore takes proportionally
// longer (e.g. at 1x, ~65 ms/cell: 100 cells ~= 6.5 s, 365 ~= 24 s); crank the
// speed slider (up to 4x) to shorten very long cascades.
function adaptiveStep(baseMs, count) {
  // CONSTANT tempo: the per-step delay is baseMs scaled ONLY by the global
  // speed factor. The chain no longer auto-accelerates as it grows — a longer
  // chain just plays longer at the same pace, and the speed slider is the sole
  // determinant of how fast it goes. (`count` is kept for the call signature
  // but intentionally unused now.)
  return Math.max(2, Math.round(baseMs / getSpeedFactor()));
}

// Each cascade animation's base per-step delay (ms at 1x). MIRRORS the
// adaptiveStep(<base>, ...) literal inside each player below — keep in sync.
// Animations not listed (surge/heartbeat/breathe + the radial bursts) have no
// per-cell cascade, so they fall back to the default for beat-timing only.
const CHAIN_BASE_STEP = {
  cascade: 65, backwash: 65, wave: 80, 'edge-in': 75, 'center-out': 75,
  'glow-trail': 65, 'ripple-trail': 65, 'shimmer-row': 55, dominos: 75,
  flicker: 40, bloom: 50, echo: 70, stack: 80, 'streak-fire': 50,
};
const DEFAULT_BASE_STEP = 65;
// Speed-adjusted per-step ms for a given animation id. The Symphony button uses
// this so its beat tracks the SELECTED animation's actual cadence instead of
// assuming the default 65 ms.
export function chainStepMsFor(id) {
  return adaptiveStep(CHAIN_BASE_STEP[id] || DEFAULT_BASE_STEP, 0);
}

function floaterSize(streak) {
  if (streak < 7)  return 16;
  if (streak < 14) return 22;
  if (streak < 30) return 28;
  return 34;
}

// ----- Helpers -----

function pulseCell(cell, color, opts = {}) {
  const { klass = 'chain-pulse', duration = 460, note, habitId } = opts;
  cell.style.setProperty('--pulse-color', color);
  cell.classList.add(klass);
  // Audio fires in the same JS turn as the visual class-add so the user
  // perceives them as one combined event. habitId routes the note through
  // that habit's (pattern, scale) queue.
  if (typeof note === 'number') playNoteAt(note, { habitId });
  setTimeout(() => {
    cell.classList.remove(klass);
    cell.style.removeProperty('--pulse-color');
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

// Generic burst overlay at a cell.
function burstAt(cell, color, klass = 'chain-burst-ring', duration = 600) {
  const b = document.createElement('span');
  b.className = klass;
  b.style.setProperty('--burst-color', color);
  cell.appendChild(b);
  setTimeout(() => b.remove(), duration + 40);
}

// Spawn N particle dots that fly outward from a cell.
function particlesAt(cell, color, count = 8, opts = {}) {
  const { klass = 'chain-particle', spread = 50, duration = 900 } = opts;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = klass;
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const dist  = spread * (0.6 + Math.random() * 0.5);
    p.style.setProperty('--p-color', color);
    p.style.setProperty('--p-dx', `${(Math.cos(angle) * dist).toFixed(0)}px`);
    p.style.setProperty('--p-dy', `${(Math.sin(angle) * dist).toFixed(0)}px`);
    p.style.animationDelay = `${Math.random() * 80}ms`;
    cell.appendChild(p);
  }
  setTimeout(() => {
    cell.querySelectorAll(`.${klass}`).forEach(p => p.remove());
  }, duration + 200);
}

function confettiAt(cell, color, count = 12) {
  const palette = [color, '#ff5a5f', '#ffc857', '#3498db', '#2ecc71', '#9b59b6'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'chain-confetti';
    const dx  = (Math.random() - 0.5) * 80;
    const rot = (Math.random() - 0.5) * 720;
    p.style.setProperty('--c-color', palette[i % palette.length]);
    p.style.setProperty('--c-dx', `${dx.toFixed(0)}px`);
    p.style.setProperty('--c-rot', `${rot.toFixed(0)}deg`);
    p.style.animationDelay = `${Math.random() * 120}ms`;
    cell.appendChild(p);
  }
  setTimeout(() => {
    cell.querySelectorAll('.chain-confetti').forEach(p => p.remove());
  }, 1500);
}

function runSequence(cells, perCellFn, opts = {}) {
  const { stepMs = 65, reverse = false } = opts;
  const ordered = reverse ? [...cells].reverse() : cells;
  ordered.forEach((cell, i) => {
    setTimeout(() => perCellFn(cell, i, ordered.length), i * stepMs);
  });
}

// ----- 25 play functions -----
//
// Every audio call (pulseCell with a note, playChord, playBurst, playNoteAt)
// is routed through `ctx.habit.id` so the audio engine can look up THAT
// habit's queue (pattern + scale per section). Each player extracts the id
// once at the top as `H` for readability — chain animations are 1:1 with
// a habit, so the id is the same across every call inside a player.

const PLAYERS = {};

// 1. CASCADE — forward pulse on past cells, ring "lands" on today, floater
PLAYERS['cascade'] = (ctx) => {
  const H = ctx.habit.id;
  const past = ctx.chainCells.slice(0, -1);
  const stepMs = adaptiveStep(65, past.length + 1);
  runSequence(past, (cell, i) => pulseCell(cell, ctx.habit.color, { note: i, habitId: H }), { stepMs });
  const arrivalDelay = Math.max(0, (past.length - 1) * stepMs + 80);
  setTimeout(() => {
    burstAt(ctx.todayCell, ctx.habit.color, 'chain-burst-ring', 500);
    playNoteAt(past.length, { habitId: H });
  }, arrivalDelay);
  defaultFloater(ctx, arrivalDelay);
};

// 2. BACKWASH — ring at today first, then pulse rolls back through past
PLAYERS['backwash'] = (ctx) => {
  const H = ctx.habit.id;
  burstAt(ctx.todayCell, ctx.habit.color, 'chain-burst-ring', 500);
  playNoteAt(0, { habitId: H });
  const past = ctx.chainCells.slice(0, -1);
  const stepMs = adaptiveStep(65, past.length);
  setTimeout(() => {
    runSequence(past, (cell, i) => pulseCell(cell, ctx.habit.color, { note: i + 1, habitId: H }), { stepMs, reverse: true });
  }, 120);
  defaultFloater(ctx, 200);
};

// 3. WAVE — actual squash-stretch wave propagating through cells
PLAYERS['wave'] = (ctx) => {
  const H = ctx.habit.id;
  const past = ctx.chainCells.slice(0, -1);
  const stepMs = adaptiveStep(80, past.length + 1);
  runSequence(past, (cell, i) => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-wave', duration: 520, note: i, habitId: H }), { stepMs });
  const arrivalDelay = Math.max(0, (past.length - 1) * stepMs + 100);
  setTimeout(() => pulseCell(ctx.todayCell, ctx.habit.color, { klass: 'chain-pulse-wave', duration: 520, note: past.length, habitId: H }), arrivalDelay);
  defaultFloater(ctx, arrivalDelay + 200);
};

// 4. EDGE-IN — both ends pulse simultaneously, ring converges on today
PLAYERS['edge-in'] = (ctx) => {
  const H = ctx.habit.id;
  const past = ctx.chainCells.slice(0, -1);
  const mid = Math.ceil(past.length / 2);
  const stepMs = adaptiveStep(75, mid + 1);
  for (let i = 0; i < mid; i++) {
    setTimeout(() => pulseCell(past[i], ctx.habit.color, { note: i, habitId: H }), i * stepMs);
    const right = past[past.length - 1 - i];
    if (right && right !== past[i]) setTimeout(() => pulseCell(right, ctx.habit.color, { habitId: H }), i * stepMs);
  }
  const arrivalDelay = Math.max(0, mid * stepMs + 60);
  setTimeout(() => {
    burstAt(ctx.todayCell, ctx.habit.color, 'chain-burst-ring', 500);
    playNoteAt(mid, { habitId: H });
  }, arrivalDelay);
  defaultFloater(ctx, arrivalDelay);
};

// 5. CENTER-OUT — middle cell first, then pulses spread outward + ring at today
PLAYERS['center-out'] = (ctx) => {
  const H = ctx.habit.id;
  const past = ctx.chainCells.slice(0, -1);
  const mid = Math.floor(past.length / 2);
  const maxDist = Math.ceil((past.length || 1) / 2);
  const stepMs = adaptiveStep(75, maxDist + 1);
  if (past.length > 0) {
    const distSeen = new Set();
    past.forEach((cell, i) => {
      const dist = Math.abs(i - mid);
      const noteOpt = distSeen.has(dist) ? { habitId: H } : { note: dist, habitId: H };
      distSeen.add(dist);
      setTimeout(() => pulseCell(cell, ctx.habit.color, noteOpt), dist * stepMs);
    });
  }
  const arrivalDelay = maxDist * stepMs;
  setTimeout(() => {
    burstAt(ctx.todayCell, ctx.habit.color, 'chain-shockwave', 600);
    playNoteAt(maxDist, { habitId: H });
  }, arrivalDelay);
  defaultFloater(ctx, arrivalDelay + 100);
};

// 6. GLOW-TRAIL — pure color glow trailing through cells, no scale at all
PLAYERS['glow-trail'] = (ctx) => {
  const H = ctx.habit.id;
  const past = ctx.chainCells.slice(0, -1);
  const stepMs = adaptiveStep(65, past.length + 1);
  runSequence(past, (cell, i) => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-glow', duration: 700, note: i, habitId: H }), { stepMs });
  const arrivalDelay = Math.max(0, (past.length - 1) * stepMs + 100);
  setTimeout(() => pulseCell(ctx.todayCell, ctx.habit.color, { klass: 'chain-pulse-glow-strong', duration: 900, note: past.length, habitId: H }), arrivalDelay);
  defaultFloater(ctx, arrivalDelay + 200);
};

// 7. RIPPLE-TRAIL — each cell emits its own ring as it pulses, including today
PLAYERS['ripple-trail'] = (ctx) => {
  const H = ctx.habit.id;
  const stepMs = adaptiveStep(65, ctx.chainCells.length);
  runSequence(ctx.chainCells, (cell, i) => {
    pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-soft', duration: 360, note: i, habitId: H });
    burstAt(cell, ctx.habit.color, 'chain-burst-ring', 500);
  }, { stepMs });
  defaultFloater(ctx, Math.max(0, (ctx.chainCells.length - 1) * stepMs + 200));
};

// 8. SHIMMER-ROW — diagonal light sweep across each cell in sequence, including today
PLAYERS['shimmer-row'] = (ctx) => {
  const H = ctx.habit.id;
  const stepMs = adaptiveStep(55, ctx.chainCells.length);
  runSequence(ctx.chainCells, (cell, i) => {
    cell.classList.add('chain-shimmer');
    playNoteAt(i, { habitId: H });
    setTimeout(() => cell.classList.remove('chain-shimmer'), 520);
  }, { stepMs });
  defaultFloater(ctx, Math.max(0, (ctx.chainCells.length - 1) * stepMs + 200));
};

// 9. DOMINOS — sequential tilt-and-fall, today snaps with extra emphasis
PLAYERS['dominos'] = (ctx) => {
  const H = ctx.habit.id;
  const past = ctx.chainCells.slice(0, -1);
  const stepMs = adaptiveStep(75, past.length + 1);
  runSequence(past, (cell, i) => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-tilt', duration: 500, note: i, habitId: H }), { stepMs });
  const arrivalDelay = Math.max(0, (past.length - 1) * stepMs + 80);
  setTimeout(() => {
    pulseCell(ctx.todayCell, ctx.habit.color, { klass: 'chain-pulse-tilt', duration: 500, note: past.length, habitId: H });
    burstAt(ctx.todayCell, ctx.habit.color, 'chain-burst-ring', 400);
  }, arrivalDelay);
  defaultFloater(ctx, arrivalDelay + 100);
};

// 10. FLICKER — rapid on/off across cells including today
PLAYERS['flicker'] = (ctx) => {
  const H = ctx.habit.id;
  const stepMs = adaptiveStep(40, ctx.chainCells.length);
  runSequence(ctx.chainCells, (cell, i) => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-flicker', duration: 360, note: i, habitId: H }), { stepMs });
  defaultFloater(ctx, Math.max(0, (ctx.chainCells.length - 1) * stepMs + 200));
};

// 11. SURGE — whole chain pulses simultaneously, today gets extra ring
PLAYERS['surge'] = (ctx) => {
  const H = ctx.habit.id;
  playChord(ctx.chainCells.length, H);
  ctx.chainCells.forEach(cell => pulseCell(cell, ctx.habit.color, { habitId: H }));
  burstAt(ctx.todayCell, ctx.habit.color, 'chain-burst-ring', 500);
  defaultFloater(ctx, 300);
};

// 12. HEARTBEAT — two simultaneous beats on all cells, today gets emphasis
PLAYERS['heartbeat'] = (ctx) => {
  const H = ctx.habit.id;
  const beat = () => ctx.chainCells.forEach(cell =>
    pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-soft', duration: 240, habitId: H })
  );
  beat();
  playChord(ctx.chainCells.length, H);
  setTimeout(() => { beat(); playChord(ctx.chainCells.length, H); }, 300);
  setTimeout(() => burstAt(ctx.todayCell, ctx.habit.color, 'chain-burst-ring', 500), 280);
  defaultFloater(ctx, 600);
};

// 13. BREATHE — slow simultaneous scale across all cells
PLAYERS['breathe'] = (ctx) => {
  const H = ctx.habit.id;
  playChord(ctx.chainCells.length, H);
  ctx.chainCells.forEach(cell => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-breathe', duration: 900, habitId: H }));
  defaultFloater(ctx, 500);
};

// 14. BLOOM — radial color bloom expanding from today across the chain
PLAYERS['bloom'] = (ctx) => {
  const H = ctx.habit.id;
  burstAt(ctx.todayCell, ctx.habit.color, 'chain-bloom', 800);
  playNoteAt(0, { habitId: H });
  const past = ctx.chainCells.slice(0, -1);
  const stepMs = adaptiveStep(50, past.length);
  runSequence(past, (cell, i) =>
    pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-soft', duration: 400, note: i + 1, habitId: H }),
    { stepMs, reverse: true }
  );
  defaultFloater(ctx, 200);
};

// 15. GENTLE-GLOW — long, atmospheric simultaneous glow
PLAYERS['gentle-glow'] = (ctx) => {
  const H = ctx.habit.id;
  playChord(ctx.chainCells.length, H);
  ctx.chainCells.forEach(cell => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-glow-long', duration: 1200, habitId: H }));
  defaultFloater(ctx, 600);
};

// 16. ECHO — rings ripple OUT from today through past cells in reverse
PLAYERS['echo'] = (ctx) => {
  const H = ctx.habit.id;
  burstAt(ctx.todayCell, ctx.habit.color, 'chain-burst-ring', 600);
  playNoteAt(0, { habitId: H });
  const past = ctx.chainCells.slice(0, -1);
  const stepMs = adaptiveStep(70, past.length);
  runSequence(past, (cell, i) => {
    burstAt(cell, ctx.habit.color, 'chain-burst-ring', 500);
    playNoteAt(i + 1, { habitId: H });
  }, { stepMs, reverse: true });
  defaultFloater(ctx, 200);
};

// 17. SHOCKWAVE — single large expanding ring from today
PLAYERS['shockwave'] = (ctx) => {
  playBurst(ctx.habit.id);
  burstAt(ctx.todayCell, ctx.habit.color, 'chain-shockwave', 850);
  defaultFloater(ctx, 100);
};

// 18. PULSE-BOMB — heavy radial glow at today
PLAYERS['pulse-bomb'] = (ctx) => {
  playBurst(ctx.habit.id);
  burstAt(ctx.todayCell, ctx.habit.color, 'chain-pulse-bomb', 700);
  defaultFloater(ctx, 50);
};

// 19. STARBURST — star rays at today
PLAYERS['starburst'] = (ctx) => {
  playBurst(ctx.habit.id);
  burstAt(ctx.todayCell, ctx.habit.color, 'chain-starburst', 700);
  defaultFloater(ctx, 100);
};

// 20. FIREWORKS — particle burst at today (count scales with streak)
PLAYERS['fireworks'] = (ctx) => {
  const count = Math.min(6 + ctx.streakLength, 24);
  particlesAt(ctx.todayCell, ctx.habit.color, count, { spread: 90 });
  playBurst(ctx.habit.id);
  defaultFloater(ctx, 100);
};

// 21. CONFETTI — colored particles rise from today
PLAYERS['confetti'] = (ctx) => {
  const count = Math.min(8 + ctx.streakLength, 28);
  confettiAt(ctx.todayCell, ctx.habit.color, count);
  playBurst(ctx.habit.id);
  defaultFloater(ctx, 100);
};

// 22. COUNTER — animated tick from 1 to N at today (no chain effect)
PLAYERS['counter'] = (ctx) => {
  const H = ctx.habit.id;
  const target = ctx.streakLength;
  const stepMs = Math.max(40, 600 / target);
  const fl = document.createElement('span');
  fl.className = 'chain-floater chain-floater-counter';
  fl.style.setProperty('--floater-color', ctx.habit.color);
  fl.style.fontSize = `${floaterSize(ctx.streakLength)}px`;
  fl.textContent = '+1';
  ctx.todayCell.appendChild(fl);
  // Initial "+1" gets its own note
  playNoteAt(0, { habitId: H });
  let i = 1;
  const tick = setInterval(() => {
    i++;
    if (i > target) { clearInterval(tick); return; }
    fl.textContent = `+${i}`;
    playNoteAt(i - 1, { habitId: H });
  }, stepMs);
  setTimeout(() => fl.remove(), 1500);
};

// 23. STACK — small +1s float up from each cell, default floater at today
PLAYERS['stack'] = (ctx) => {
  const H = ctx.habit.id;
  const past = ctx.chainCells.slice(0, -1);
  const stepMs = adaptiveStep(80, past.length);
  past.forEach((cell, i) => {
    setTimeout(() => {
      showFloater(cell, '+1', ctx.habit.color, { size: 12, klass: 'chain-floater chain-floater-mini', duration: 900 });
      playNoteAt(i, { habitId: H });
    }, i * stepMs);
  });
  defaultFloater(ctx, past.length * stepMs + 120);
};

// 24. COMBO — "COMBO!" themed text + cell flickers (all at once)
PLAYERS['combo'] = (ctx) => {
  const H = ctx.habit.id;
  ctx.chainCells.forEach(cell => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-flicker', duration: 320, habitId: H }));
  playChord(ctx.chainCells.length, H);
  const fl = document.createElement('span');
  fl.className = 'chain-floater chain-floater-combo';
  fl.style.setProperty('--floater-color', ctx.habit.color);
  fl.innerHTML = `<span class="combo-x">${ctx.streakLength}x</span><span class="combo-label">COMBO</span>`;
  ctx.todayCell.appendChild(fl);
  setTimeout(() => fl.remove(), 1400);
};

// 25. STREAK-FIRE — flame floater that grows with streak + warming chain
PLAYERS['streak-fire'] = (ctx) => {
  const H = ctx.habit.id;
  const past = ctx.chainCells.slice(0, -1);
  const stepMs = adaptiveStep(50, past.length);
  const fl = document.createElement('span');
  fl.className = 'chain-floater chain-floater-fire';
  fl.style.setProperty('--floater-color', ctx.habit.color);
  const flames = ctx.streakLength >= 30 ? '🔥🔥🔥' : ctx.streakLength >= 14 ? '🔥🔥' : '🔥';
  fl.innerHTML = `<span class="fire-emoji">${flames}</span><span class="fire-num">${ctx.streakLength}</span>`;
  fl.style.fontSize = `${floaterSize(ctx.streakLength)}px`;
  ctx.todayCell.appendChild(fl);
  past.forEach((cell, i) => {
    setTimeout(() => pulseCell(cell, ctx.habit.color, { klass: 'chain-pulse-glow', duration: 500, note: i, habitId: H }), i * stepMs);
  });
  setTimeout(() => fl.remove(), 1400);
};
