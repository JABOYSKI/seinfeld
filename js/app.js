// Main controller — boots, routes auth vs tracker, owns app state.
import { initAuth, onAuthChange, signOut, renderAuth, getUser } from './auth.js';
import { syncSoundSettingsOnBoot } from './soundStore.js';
import { initInstallPrompt } from './install.js';
import { loadHabits, createHabit, updateHabit, deleteHabit, repairFutureCreatedDates, COLORS, DEFAULT_TEXT_COLOR, normalizeTextColor, migrationFileForColumn } from './habits.js';
import { TEXTURES, DEFAULT_TEXTURE_ID, normalizeTexture } from './textures.js';
import { buildColorWheel } from './colorWheel.js';
import { loadCompletions, loadCompletionsInRange, loadCompletionsBetween, markDay, unmarkDay } from './completions.js';
import { renderCalendar, renderAllCalendar, renderContinuousCalendar, renderContinuousAllCalendar, CONTINUOUS_YEARS } from './calendar.js';
import { currentStreak, longestStreak } from './streak.js';

import { initTheme, toggleTheme, getActiveTheme } from './theme.js';
import { toast, todayISO, daysAgoISO, canEditDay, prefersReducedMotion } from './utils.js';
import { getSelectedAnimationId, FILL_ANIMATION_DURATION_MS } from './fillAnimations.js';
import { openAnimationPicker } from './animationPicker.js';

// The audio synth + chain-animation + sound-picker graph (~2,600 lines, incl.
// the ~800-line audio.js) is only needed AFTER first paint — on a day-tick,
// the Symphony, or when a picker opens. Importing it statically would block
// the calendar's first paint on parsing all of it, so it's loaded on demand
// (the promise is cached) and prefetched once the browser is idle. The
// chainBuild graph pulls in chainAnimations -> audio, so warming it covers the
// whole tick/symphony path. (animationPicker + fillAnimations stay static —
// they're light leaves with no audio dependency.)
let _chainBuildP = null, _chainAnimP = null;
const lazyChainBuild = () => (_chainBuildP || (_chainBuildP = import('./chainBuild.js')));
const lazyChainAnim  = () => (_chainAnimP  || (_chainAnimP  = import('./chainAnimations.js')));

// Sound on/off for the header icon, read straight from localStorage so the
// header doesn't drag in audio.js at module-eval. Mirrors
// getSelectedSoundId() === 'off' (the stored value is always a validated
// scale id; absent or 'off' = muted).
function isSoundOff() {
  const v = localStorage.getItem('seinfeld_sound_scale');
  return !v || v === 'off';
}

const MAX_HABITS = 5;

const state = {
  habits: [],
  // currentHabitId === 'all' is a sentinel for the conglomerate view; any
  // real UUID = the single-habit view for that habit.
  currentHabitId: null,
  currentYear: new Date().getFullYear(),
  completions: new Set(),                 // single-mode: one habit's completions (viewed year)
  completionsByHabit: new Map(),          // all-mode: habitId -> Set<dayISO> (viewed year)
  // Today-anchored set (created_at..today) for the ACTIVE habit, used for
  // current/longest streak math so a chain that crosses New Year — or is
  // viewed from a past year — counts correctly, independent of the grid's
  // per-year fetch. Cached by habit id so year navigation doesn't refetch.
  streakSet: new Set(),
  streakSetHabitId: null,
  // Same today-anchored sets, per habit, for the Symphony (all chains at once).
  streakSetByHabit: new Map(),
};

const ALL_VIEW_ID = 'all';

// View-toggle icons — both are calendars, but visually distinct:
//   ICON_VIEW_CONTINUOUS shows a long horizontal strip with day columns
//   ICON_VIEW_MONTHS     shows a tall grid of month cells
// We show the DESTINATION view's icon: when you're in months, the toggle
// shows the continuous icon so it telegraphs what clicking does.
const ICON_VIEW_CONTINUOUS = `
  <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor"
       stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="2" y="7" width="18" height="11" rx="1.2"/>
    <line x1="2"    y1="10.5" x2="20"   y2="10.5"/>
    <line x1="5.5"  y1="10.5" x2="5.5"  y2="18"/>
    <line x1="8.5"  y1="10.5" x2="8.5"  y2="18"/>
    <line x1="11.5" y1="10.5" x2="11.5" y2="18"/>
    <line x1="14.5" y1="10.5" x2="14.5" y2="18"/>
    <line x1="17.5" y1="10.5" x2="17.5" y2="18"/>
  </svg>`;
const ICON_VIEW_MONTHS = `
  <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor"
       stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="16" height="16" rx="1.5"/>
    <line x1="3" y1="8"  x2="19" y2="8"/>
    <line x1="3" y1="13" x2="19" y2="13"/>
    <line x1="9"  y1="8" x2="9"  y2="20"/>
    <line x1="13" y1="8" x2="13" y2="20"/>
    <line x1="6.5"  y1="3" x2="6.5"  y2="5.5"/>
    <line x1="15.5" y1="3" x2="15.5" y2="5.5"/>
  </svg>`;
const viewToggleIcon = () => getViewMode() === 'months' ? ICON_VIEW_CONTINUOUS : ICON_VIEW_MONTHS;

// View mode: how the calendar lays out the year. 'months' = 3x4 grid of
// month cards (default), 'continuous' = one wide 7-row x ~53-col strip.
// Stored per-user as a UI preference, not synced via Supabase.
const VIEW_STORAGE_KEY = 'seinfeld_view_mode';
function getViewMode() {
  return localStorage.getItem(VIEW_STORAGE_KEY) === 'continuous' ? 'continuous' : 'months';
}
function setViewMode(v) {
  localStorage.setItem(VIEW_STORAGE_KEY, v);
}

// Week-number row toggle (continuous view only). When on, each year block
// shows a small row of 1..53 numbers under the day grid.
const WEEK_NUM_STORAGE_KEY = 'seinfeld_show_week_numbers';
function getShowWeekNumbers() {
  return localStorage.getItem(WEEK_NUM_STORAGE_KEY) === 'true';
}
function setShowWeekNumbers(v) {
  localStorage.setItem(WEEK_NUM_STORAGE_KEY, v ? 'true' : 'false');
}

// User's preferred tab order (drag-reorder). Stored client-side because
// it's a per-device UI preference, not data semantics. Unknown IDs go to
// the end so freshly-created habits still appear.
const HABIT_ORDER_STORAGE_KEY = 'seinfeld_habit_order';
function getStoredHabitOrder() {
  try {
    const raw = localStorage.getItem(HABIT_ORDER_STORAGE_KEY);
    if (!raw) return [];
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [];
  } catch { return []; }
}
function setStoredHabitOrder(ids) {
  localStorage.setItem(HABIT_ORDER_STORAGE_KEY, JSON.stringify(ids));
}
function applyStoredHabitOrder(habits) {
  const order = getStoredHabitOrder();
  if (order.length === 0) return habits;
  const byId = new Map(habits.map(h => [h.id, h]));
  const sorted = [];
  for (const id of order) {
    if (byId.has(id)) { sorted.push(byId.get(id)); byId.delete(id); }
  }
  for (const h of habits) {
    if (byId.has(h.id)) sorted.push(h);
  }
  return sorted;
}

const els = {
  boot: document.getElementById('bootSplash'),
  authMount: document.getElementById('authMount'),
  app: document.getElementById('app'),
  themeBtn: null,
  signoutBtn: null,
  tabs: null,
  yearLabel: null,
  yearPrev: null,
  yearNext: null,
  streakChip: null,
  calendar: null,
  emptyState: null,
};

async function boot() {
  initTheme();
  // Watchdog: under no circumstances should the boot splash stay forever.
  // If anything below hangs or throws without surfacing, this kills the
  // spinner after 15s so the user at least sees the auth/app shell.
  const watchdog = setTimeout(() => hideBoot(), 15000);
  try {
    const user = await initAuth();
    onAuthChange(async (u, event) => {
      // INITIAL_SESSION is already handled by the explicit initAuth() above —
      // we only react to subsequent state changes here.
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT') { showAuth(); return; }
      if (u && event === 'SIGNED_IN') {
        try { await showTracker(); }
        catch (err) { console.error('showTracker (auth-change):', err); }
      }
    });

    if (user) await showTracker();
    else showAuth();
    initInstallPrompt();   // offer to install as a home-screen app (dismissible)
  } catch (err) {
    console.error('Boot failed:', err);
    toast(`Boot failed: ${err.message || err}`, 'error');
    // Make sure SOMETHING is on screen even if auth/data totally collapses.
    if (els.app.hidden && els.authMount.hidden) showAuth();
  } finally {
    clearTimeout(watchdog);
    hideBoot();
  }
}

function hideBoot() {
  if (!els.boot) return;
  els.boot.classList.add('hide');
  setTimeout(() => els.boot.remove(), 250);
}

function showAuth() {
  els.app.hidden = true;
  els.authMount.hidden = false;
  renderAuth(els.authMount);
}

async function showTracker() {
  els.authMount.hidden = true;
  els.app.hidden = false;
  renderShell();
  // Pull this account's sound settings into localStorage so they're identical
  // across devices. Fire-and-forget: it doesn't block the calendar render and
  // completes well before the user triggers any sound.
  const u = getUser();
  if (u) syncSoundSettingsOnBoot(u.id);
  await loadAndRenderHabits();
}

function renderShell() {
  els.app.innerHTML = `
    <header class="app-header">
      <div class="header-row">
        <div class="logo">
          <svg class="logo-icon" viewBox="0 0 22 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="2" y="4" width="18" height="18" rx="2.5" />
            <line x1="2" y1="9" x2="20" y2="9" />
            <line x1="6.5" y1="2" x2="6.5" y2="6.5" />
            <line x1="15.5" y1="2" x2="15.5" y2="6.5" />
          </svg>
          <span class="logo-text">Seinfeld</span>
        </div>
        <button class="symphony-btn" id="symphonyBtn" type="button" aria-label="Play every active chain" title="Play every active chain">
          <svg class="symphony-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8.5 6.2 L17.8 11.5 a0.6 0.6 0 0 1 0 1.04 L8.5 17.85 a0.6 0.6 0 0 1 -0.9 -0.52 V6.72 a0.6 0.6 0 0 1 0.9 -0.52 Z"/>
          </svg>
        </button>
        <div class="header-spacer"></div>
        <button class="icon-btn" id="animBtn" title="Choose fill animation" aria-label="Choose fill animation">✦</button>
        <button class="icon-btn" id="chainAnimBtn" title="Choose chain animation" aria-label="Choose chain animation">⛓</button>
        <button class="icon-btn ${!isSoundOff() ? 'is-active' : ''}" id="soundBtn" title="Choose chain sound" aria-label="Choose chain sound">${isSoundOff() ? '🔇' : '🔊'}</button>
        <button class="icon-btn" id="viewToggle" title="Toggle continuous / months view" aria-label="Toggle continuous / months view">${viewToggleIcon()}</button>
        <button class="icon-btn ${getShowWeekNumbers() ? 'is-active' : ''}" id="weekNumBtn" title="Toggle week numbers (continuous view)" aria-label="Toggle week numbers">#</button>
        <button class="icon-btn" id="themeBtn" title="Toggle theme" aria-label="Toggle theme">${getActiveTheme() === 'dark' ? '☀️' : '🌙'}</button>
        <button class="icon-btn" id="signoutBtn" title="Sign out" aria-label="Sign out">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
      <nav class="tabs" id="tabs"></nav>
    </header>

    <main class="tracker">
      <div class="year-bar">
        <button class="icon-btn" id="yearPrev" title="Previous year">‹</button>
        <div class="year-label" id="yearLabel">${state.currentYear}</div>
        <button class="icon-btn" id="yearNext" title="Next year">›</button>
        <div class="header-spacer"></div>
        <div class="streak-chip" id="streakChip" role="status" aria-live="polite" aria-label="Streak"></div>
      </div>
      <div class="calendar" id="calendar"></div>
      <div class="empty-state" id="emptyState" hidden>
        <p>No habits yet. Create one to start your chain.</p>
        <button class="btn btn-primary" id="emptyCreate">+ New habit</button>
      </div>
    </main>
  `;

  els.themeBtn   = document.getElementById('themeBtn');
  els.signoutBtn = document.getElementById('signoutBtn');
  els.tabs       = document.getElementById('tabs');
  els.yearLabel  = document.getElementById('yearLabel');
  els.yearPrev   = document.getElementById('yearPrev');
  els.yearNext   = document.getElementById('yearNext');
  els.streakChip = document.getElementById('streakChip');
  els.calendar   = document.getElementById('calendar');
  els.emptyState = document.getElementById('emptyState');

  els.themeBtn.addEventListener('click', () => {
    toggleTheme();
    els.themeBtn.textContent = getActiveTheme() === 'dark' ? '☀️' : '🌙';
  });
  document.getElementById('animBtn').addEventListener('click', () => {
    openAnimationPicker((id) => toast(`Fill: ${id}`, 'info'));
  });
  document.getElementById('chainAnimBtn').addEventListener('click', async () => {
    const { openChainPicker } = await import('./chainPicker.js');
    openChainPicker((id) => toast(`Chain: ${id}`, 'info'));
  });
  const soundBtn = document.getElementById('soundBtn');
  soundBtn.addEventListener('click', async () => {
    // Pass the current habit list + which habit is active so the picker can
    // render the per-habit queue editor tabs. ALL_VIEW_ID isn't a real
    // habit; in that case let the picker default to the first habit.
    const targetHabitId = state.currentHabitId === ALL_VIEW_ID ? null : state.currentHabitId;
    const { openSoundPicker } = await import('./soundPicker.js');
    openSoundPicker(state.habits, targetHabitId, (id) => {
      soundBtn.textContent = id === 'off' ? '🔇' : '🔊';
      soundBtn.classList.toggle('is-active', id !== 'off');
      toast(`Sound: ${id}`, 'info');
    });
  });
  const symphonyBtn = document.getElementById('symphonyBtn');
  symphonyBtn.addEventListener('click', () => playSymphony(symphonyBtn));
  els.signoutBtn.addEventListener('click', async () => {
    await signOut();
    showAuth();
  });
  els.yearPrev.addEventListener('click', () => changeYear(-1));
  els.yearNext.addEventListener('click', () => changeYear(1));
  const viewToggle = document.getElementById('viewToggle');
  viewToggle.addEventListener('click', () => {
    setViewMode(getViewMode() === 'months' ? 'continuous' : 'months');
    viewToggle.innerHTML = viewToggleIcon();
    updateYearLabel();
    if (state.currentHabitId) loadAndRenderCalendar();
  });
  const weekNumBtn = document.getElementById('weekNumBtn');
  weekNumBtn.addEventListener('click', () => {
    const next = !getShowWeekNumbers();
    setShowWeekNumbers(next);
    weekNumBtn.classList.toggle('is-active', next);
    // No re-render needed — the 16px week-num gutter is always present in
    // the months grid, and the week-num cells are always emitted; we just
    // flip CSS visibility on. Day cells don't move at all.
    els.calendar.classList.toggle('with-week-numbers', next);
  });
  els.calendar.addEventListener('click', onCalendarClick);
  document.getElementById('emptyCreate').addEventListener('click', () => openHabitDialog());

  // Warm the lazy delight graph once the browser is idle, so the first
  // day-tick celebration / Symphony doesn't wait on a network fetch. Pure
  // prefetch off the critical path — failures are ignored. (Wrapped so
  // requestIdleCallback keeps its window receiver — calling it detached
  // throws "Illegal invocation" in some engines.)
  const ric = window.requestIdleCallback
    ? (cb) => window.requestIdleCallback(cb)
    : (cb) => setTimeout(cb, 1200);
  ric(() => { lazyChainBuild().catch(() => {}); });
}

async function loadAndRenderHabits() {
  const user = getUser();
  try {
    // Best-effort self-heal of future-dated created_at (UTC skew). It now
    // batches into one UPDATE and throws on failure, so it gets its OWN
    // try/catch — a transient repair timeout must not abort the whole habit
    // load and leave the user staring at an empty wall.
    try {
      const fixed = await repairFutureCreatedDates(user.id);
      if (fixed > 0) toast(`Fixed ${fixed} habit start date${fixed > 1 ? 's' : ''}.`, 'info');
    } catch (e) {
      console.warn('repairFutureCreatedDates failed (non-fatal):', e);
    }
    state.habits = applyStoredHabitOrder(await loadHabits(user.id));
  } catch (e) {
    toast(`Failed to load habits: ${e.message}`, 'error');
    state.habits = [];
  }

  if (state.habits.length === 0) {
    state.currentHabitId = null;
    renderTabs();
    els.calendar.innerHTML = '';
    els.streakChip.textContent = '';
    els.emptyState.hidden = false;
    return;
  }

  els.emptyState.hidden = true;
  // Preserve a valid current selection: ALL_VIEW_ID is valid, or any real habit id.
  if (state.currentHabitId !== ALL_VIEW_ID && !state.habits.find(h => h.id === state.currentHabitId)) {
    state.currentHabitId = state.habits[0].id;
  }
  renderTabs();
  await loadAndRenderCalendar();
}

function renderTabs() {
  // 'All' tab is only useful when there are 2+ habits. With just one habit
  // the conglomerate view is identical to the single-habit view.
  const showAllTab = state.habits.length >= 2;
  const allTab = showAllTab
    ? `<button class="tab tab-all ${state.currentHabitId === ALL_VIEW_ID ? 'tab-active' : ''}"
               data-habit="${ALL_VIEW_ID}" title="See every habit at once" aria-label="All habits"${state.currentHabitId === ALL_VIEW_ID ? ' aria-current="true"' : ''}>
         <span class="tab-all-icon" aria-hidden="true">▦</span>
         <span class="tab-name">All</span>
       </button>`
    : '';

  const tabs = state.habits.map(h => `
    <button class="tab ${h.id === state.currentHabitId ? 'tab-active' : ''}"
            data-habit="${h.id}"
            draggable="true"
            title="Drag to reorder"
            aria-label="${escapeAttr(h.name)}"${h.id === state.currentHabitId ? ' aria-current="true"' : ''}
            style="--tab-color:${h.color};--tab-text-color:${h.text_color || '#ffffff'}">
      <span class="tab-dot" aria-hidden="true"></span>
      <span class="tab-name">${escapeHTML(h.name)}</span>
      <span class="tab-edit" data-edit="${h.id}" title="Edit habit">✎</span>
    </button>
  `).join('');
  const canAdd = state.habits.length < MAX_HABITS;
  const addBtn = canAdd
    ? `<button class="tab tab-add" id="tabAdd" title="New habit">+</button>`
    : '';
  els.tabs.innerHTML = allTab + tabs + addBtn;

  els.tabs.querySelectorAll('.tab[data-habit]').forEach(t => {
    t.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-edit')) return;
      const id = t.dataset.habit;
      if (id !== state.currentHabitId) {
        state.currentHabitId = id;
        renderTabs();
        loadAndRenderCalendar();
      }
    });
  });
  els.tabs.querySelectorAll('.tab-edit').forEach(e => {
    e.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const id = ev.target.dataset.edit;
      openHabitDialog(state.habits.find(h => h.id === id));
    });
  });
  document.getElementById('tabAdd')?.addEventListener('click', () => openHabitDialog());
  wireTabDragReorder();
}

// HTML5 drag-and-drop for habit tabs. Only real habits can be dragged; the
// 'All' tab is fixed at the front and the 'Add' button stays at the end.
// On drop, the new order is saved to localStorage and applied to state.
let _dragHabitId = null;
function wireTabDragReorder() {
  els.tabs.querySelectorAll('.tab[data-habit]').forEach(tab => {
    const habitId = tab.dataset.habit;
    if (habitId === ALL_VIEW_ID) { tab.draggable = false; return; }

    tab.addEventListener('dragstart', (e) => {
      _dragHabitId = habitId;
      tab.classList.add('is-dragging');
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', habitId);
      } catch {}
    });
    tab.addEventListener('dragend', () => {
      tab.classList.remove('is-dragging');
      _dragHabitId = null;
      els.tabs.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('drop-before', 'drop-after');
      });
    });
    tab.addEventListener('dragover', (e) => {
      if (!_dragHabitId || _dragHabitId === habitId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = tab.getBoundingClientRect();
      const isBefore = e.clientX < rect.left + rect.width / 2;
      tab.classList.toggle('drop-before', isBefore);
      tab.classList.toggle('drop-after', !isBefore);
    });
    tab.addEventListener('dragleave', () => {
      tab.classList.remove('drop-before', 'drop-after');
    });
    tab.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!_dragHabitId || _dragHabitId === habitId) return;
      const insertBefore = tab.classList.contains('drop-before');
      tab.classList.remove('drop-before', 'drop-after');

      const fromIdx = state.habits.findIndex(h => h.id === _dragHabitId);
      if (fromIdx === -1) return;
      const [moved] = state.habits.splice(fromIdx, 1);
      let toIdx = state.habits.findIndex(h => h.id === habitId);
      if (toIdx === -1) { state.habits.splice(fromIdx, 0, moved); return; }
      if (!insertBefore) toIdx++;
      state.habits.splice(toIdx, 0, moved);

      setStoredHabitOrder(state.habits.map(h => h.id));
      renderTabs();
    });
  });
}

// Monotonic token shared by the calendar loaders. A tab switch or year change
// fires loadAndRender* WITHOUT awaiting, so two loads can be in flight at once;
// after each await we bail unless we're still the newest load, so a slow
// earlier fetch can't paint stale data over a newer one.
let _renderToken = 0;

async function loadAndRenderCalendar() {
  if (state.currentHabitId === ALL_VIEW_ID) {
    await loadAndRenderAllCalendar();
    return;
  }
  const habit = state.habits.find(h => h.id === state.currentHabitId);
  if (!habit) return;
  const token = ++_renderToken;
  const continuous = getViewMode() === 'continuous';
  // streakSet covers created_at..today and is year-independent, so refetch it
  // only when the active habit changes — year navigation reuses the cache
  // (which also carries any optimistic toggles made since the load).
  const needStreakSet = state.streakSetHabitId !== habit.id;
  try {
    // Continuous spans CONTINUOUS_YEARS years STARTING at currentYear so
    // toggling between views keeps the focused year stable (the year shown
    // in months mode === the first year shown in continuous mode).
    const gridP = continuous
      ? loadCompletionsInRange(habit.id, state.currentYear, state.currentYear + (CONTINUOUS_YEARS - 1))
      : loadCompletions(habit.id, state.currentYear);
    const streakP = needStreakSet
      ? loadCompletionsBetween(habit.id, habit.created_at, todayISO())
      : Promise.resolve(state.streakSet);
    const [gridSet, streakSet] = await Promise.all([gridP, streakP]);
    if (token !== _renderToken) return;           // a newer load superseded us
    state.completions = gridSet;
    state.streakSet = streakSet;
    state.streakSetHabitId = habit.id;
  } catch (e) {
    if (token !== _renderToken) return;
    toast(`Failed to load days: ${e.message}`, 'error');
    state.completions = new Set();
    // Leave the streak cache INVALID (not habit.id) so a transient failure
    // isn't remembered as a valid-but-empty set: the next render retries the
    // fetch, and renderStreak/onCalendarClick fall back to the grid set
    // meanwhile instead of mutating a known-bad streakSet.
    state.streakSet = new Set();
    state.streakSetHabitId = null;
  }
  if (continuous) {
    renderContinuousCalendar(els.calendar, habit, state.completions, state.currentYear);
  } else {
    renderCalendar(els.calendar, habit, state.completions, state.currentYear);
  }
  // Reapply the week-number visibility class after each re-render so it
  // survives view-mode + year navigation.
  els.calendar.classList.toggle('with-week-numbers', getShowWeekNumbers());
  updateYearLabel();
  renderStreak(habit);
}

function updateYearLabel() {
  if (!els.yearLabel) return;
  els.yearLabel.textContent = getViewMode() === 'continuous'
    ? `${state.currentYear}–${state.currentYear + (CONTINUOUS_YEARS - 1)}`
    : String(state.currentYear);
}

// Re-render the calendar synchronously from already-loaded state (no
// Supabase fetch). Used by toggles that only change layout — view mode,
// week-numbers — so the swap is one atomic browser paint without an
// intermediate frame where new classes meet old HTML.
function rerenderCalendarSync() {
  if (!state.currentHabitId) return;
  const wn = getShowWeekNumbers();
  if (state.currentHabitId === ALL_VIEW_ID) {
    if (getViewMode() === 'continuous') {
      renderContinuousAllCalendar(els.calendar, state.habits, state.completionsByHabit, state.currentYear);
    } else {
      renderAllCalendar(els.calendar, state.habits, state.completionsByHabit, state.currentYear);
    }
    els.calendar.classList.toggle('with-week-numbers', wn);
    renderAllSummary();
    return;
  }
  const habit = state.habits.find(h => h.id === state.currentHabitId);
  if (!habit) return;
  if (getViewMode() === 'continuous') {
    renderContinuousCalendar(els.calendar, habit, state.completions, state.currentYear);
  } else {
    renderCalendar(els.calendar, habit, state.completions, state.currentYear);
  }
  els.calendar.classList.toggle('with-week-numbers', wn);
  renderStreak(habit);
}

async function loadAndRenderAllCalendar() {
  // Fire all per-habit fetches in parallel — small N (max 5) keeps this cheap.
  // Continuous mode spans CONTINUOUS_YEARS years starting at currentYear,
  // matching single-habit continuous behavior.
  const token = ++_renderToken;
  const continuous = getViewMode() === 'continuous';
  const fromYear = state.currentYear;
  const toYear   = continuous ? state.currentYear + (CONTINUOUS_YEARS - 1) : state.currentYear;
  try {
    const results = await Promise.all(
      state.habits.map(h =>
        loadCompletionsInRange(h.id, fromYear, toYear).then(set => [h.id, set])
      )
    );
    if (token !== _renderToken) return;           // a newer load superseded us
    state.completionsByHabit = new Map(results);
  } catch (e) {
    if (token !== _renderToken) return;
    toast(`Failed to load days: ${e.message}`, 'error');
    state.completionsByHabit = new Map();
  }
  if (continuous) {
    renderContinuousAllCalendar(els.calendar, state.habits, state.completionsByHabit, state.currentYear);
  } else {
    renderAllCalendar(els.calendar, state.habits, state.completionsByHabit, state.currentYear);
  }
  els.calendar.classList.toggle('with-week-numbers', getShowWeekNumbers());
  renderAllSummary();
}

// Ensures every habit has a today-anchored streak Set (created_at..today) in
// state.streakSetByHabit, so the Symphony computes each chain's TRUE current
// length regardless of the viewed year or a New-Year boundary. Reuses the
// active habit's already-loaded streakSet and fetches the rest.
async function ensureStreakSetsLoaded() {
  if (state.streakSetHabitId) {
    state.streakSetByHabit.set(state.streakSetHabitId, state.streakSet);
  }
  const missing = state.habits.filter(h => !state.streakSetByHabit.has(h.id));
  if (missing.length === 0) return;
  const today = todayISO();
  const results = await Promise.all(
    missing.map(h =>
      loadCompletionsBetween(h.id, h.created_at, today).then(set => [h.id, set])
    )
  );
  for (const [id, set] of results) state.streakSetByHabit.set(id, set);
}

// Fires every habit's current chain at once. Chains start with a small
// per-habit stagger so the opening attack is an orchestral roll-in instead
// of a wall-of-sound chord, and so the visual pulses don't all collide on
// the same anchor cell in the same frame.
const SYMPHONY_STAGGER_MS = 70;
const SYMPHONY_FINAL_PULSE_MS = 460;
// The per-step beat is no longer computed here: it comes from the SELECTED
// chain animation's own base step (chainStepMsFor in chainAnimations.js), so
// the button beat tracks whatever animation is playing — not just the default.

async function playSymphony(btn) {
  if (!state.habits.length) { toast('No habits yet — create one first.', 'info'); return; }
  try {
    await ensureStreakSetsLoaded();
  } catch (e) {
    toast(`Couldn't load chains: ${e.message}`, 'error');
    return;
  }

  const today = todayISO();
  const yesterday = daysAgoISO(1);
  const playable = [];
  for (const habit of state.habits) {
    const set = state.streakSetByHabit.get(habit.id);
    if (!set || set.size === 0) continue;
    const streak = currentStreak(set, habit.created_at);
    if (streak < 2) continue;
    const anchor = set.has(today) ? today : (set.has(yesterday) ? yesterday : null);
    if (!anchor) continue;
    playable.push({ habit, streak, anchor, set });
  }

  if (playable.length === 0) {
    toast('No active chains — fill in some days first.', 'info');
    return;
  }

  // Sort longest-first so the biggest cascade leads and the shorter chains
  // layer in beneath it — feels like the principal voice plus accompaniment.
  // Also: the button's beat tracks this principal (the longest) cadence.
  playable.sort((a, b) => b.streak - a.streak);

  // Lazy-load the chain-animation graph, then beat the button at the SELECTED
  // animation's own per-step cadence (each animation has its own base step), so
  // the flash tracks the cells for any animation — not just the default. With
  // constant tempo the step is the same for every chain, so compute it once.
  const chainMod = await lazyChainAnim();
  const playChainAnimationDirect = chainMod.playChainAnimation;
  const stepMs = chainMod.chainStepMsFor(chainMod.getSelectedChainAnimationId());

  const withTiming = playable.map((p, i) => ({
    ...p,
    cells: p.streak,
    stepMs,
    startAt: i * SYMPHONY_STAGGER_MS,
    dur: (p.streak - 1) * stepMs + SYMPHONY_FINAL_PULSE_MS,
  }));

  // Kick the chains.
  for (const p of withTiming) {
    setTimeout(() => {
      playChainAnimationDirect(els.calendar, p.cells, p.habit, p.anchor, p.set);
    }, p.startAt);
  }

  // Sync the button: one .beat class-add per principal note. Audio + visual
  // pulse fire on the matching setTimeout inside the chain animation, so all
  // three (button flash, cell pulse, note hit) land in the same JS turn.
  // Cleanup happens at totalDur — the button settles back to idle the same
  // instant the last principal note decays.
  if (btn) {
    const principal = withTiming[0];
    const totalDur = Math.max.apply(null, withTiming.map(p => p.startAt + p.dur));
    for (let i = 0; i < principal.cells; i++) {
      setTimeout(() => {
        btn.classList.remove('beat');
        // Force reflow so the keyframe restarts cleanly when beats land
        // faster than the keyframe's own duration.
        void btn.offsetWidth;
        btn.classList.add('beat');
      }, principal.startAt + i * principal.stepMs);
    }
    setTimeout(() => btn.classList.remove('beat'), totalDur);
  }
}

function renderStreak(habit) {
  // Compute both streaks from the today-anchored set (created_at..today) so a
  // chain that crosses New Year — or is viewed from a past year — counts
  // correctly, and "longest" means all-time rather than within-the-viewed-year.
  // Fall back to the grid set only before the streak fetch has landed.
  const src = state.streakSetHabitId === habit.id ? state.streakSet : state.completions;
  const cur = currentStreak(src, habit.created_at);
  const longest = longestStreak(src);
  els.streakChip.innerHTML = `
    <span class="streak-current">current <b>${cur}</b></span>
    <span class="streak-sep">·</span>
    <span class="streak-longest">longest <b>${longest}</b></span>
  `;
}

function renderAllSummary() {
  // "Perfect days" = days where every habit that existed by that date got
  // its slice filled. Most useful metric in the conglomerate view because it
  // rewards consistency across the whole portfolio. In continuous mode we
  // count across the whole 5-year window the user is looking at.
  const continuous = getViewMode() === 'continuous';
  const startYear = state.currentYear;
  const endYear   = continuous ? state.currentYear + (CONTINUOUS_YEARS - 1) : state.currentYear;
  const today = todayISO();
  let perfectDays = 0;
  let totalFills = 0;
  for (const [, set] of state.completionsByHabit) totalFills += set.size;

  const rangeStart = new Date(startYear, 0, 1);
  const rangeEnd   = new Date(endYear, 11, 31);
  const stop = today < `${startYear}-01-01` ? rangeStart
             : today > `${endYear}-12-31`   ? rangeEnd
             : new Date();
  for (let d = new Date(rangeStart); d <= stop; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    let existing = 0, done = 0;
    for (const h of state.habits) {
      if (h.created_at <= iso) {
        existing++;
        if (state.completionsByHabit.get(h.id)?.has(iso)) done++;
      }
    }
    if (existing > 0 && done === existing) perfectDays++;
  }

  els.streakChip.innerHTML = `
    <span class="streak-current">perfect days <b>${perfectDays}</b></span>
    <span class="streak-sep">·</span>
    <span class="streak-longest">total fills <b>${totalFills}</b></span>
  `;
}

function changeYear(delta) {
  state.currentYear += delta;
  updateYearLabel();
  if (state.currentHabitId) loadAndRenderCalendar();
}

async function onCalendarClick(e) {
  const cell = e.target.closest('.day-clickable');
  if (!cell) return;
  const day = cell.dataset.day;
  const habit = state.habits.find(h => h.id === state.currentHabitId);
  if (!habit) return;
  const wasDone = state.completions.has(day);
  if (!canEditDay(day, habit.created_at)) {
    // Outside the edit window. Empty cells stay locked (can't retroactively
    // "do" a habit) but filled cells can be unfilled with a confirm — they
    // may want to correct an old miscount.
    if (!wasDone) {
      toast('That day is locked. Can only fill the last 3 days.', 'info');
      return;
    }
    const ok = await confirmUnfillOldCell(day, habit);
    if (!ok) return;
  }

  // Mirror the toggle into the today-anchored streakSet too, so the streak
  // chip and chain detection stay correct (and cross-year-aware) without a
  // refetch. Only visible (current-year, in-window) cells are clickable, so
  // they always fall inside the streakSet's created_at..today range.
  const useStreakSet = state.streakSetHabitId === habit.id;
  const streakSrc = useStreakSet ? state.streakSet : state.completions;

  // Optimistic UI: flip immediately, revert on error.
  if (wasDone) {
    state.completions.delete(day);
    if (useStreakSet) state.streakSet.delete(day);
    // Strip any fill-* class along with done/flash so the cell goes inert.
    cell.classList.remove('day-done', 'day-just-filled');
    cell.className = cell.className.replace(/\bfill-[a-z-]+\b/g, '').replace(/\s+/g, ' ').trim();
  } else {
    // Compute streak BEFORE adding so we can detect a chain extension. Fire
    // the chain animation whenever the new fill extends the current streak
    // — covers both filling today AND backfilling a past day that links
    // yesterday's fill to today's. The animation always plays on today's
    // cell because that's where the chain ends.
    const oldStreak = currentStreak(streakSrc, habit.created_at);
    state.completions.add(day);
    if (useStreakSet) state.streakSet.add(day);
    cell.classList.add('day-done');
    playFillAnimation(cell);
    const newStreak = currentStreak(streakSrc, habit.created_at);
    // Reduced-motion: suppress the auto chain cascade (and its coupled audio)
    // on a routine tick. The explicit Symphony button + picker previews still
    // animate, since those are deliberately user-invoked.
    if (newStreak > oldStreak && newStreak >= 2 && !prefersReducedMotion()) {
      // Anchor on the cell that was just clicked — that's where the user's
      // attention is and (in their mental model) the new end of the chain.
      // The old behavior anchored on today, which felt wrong when filling
      // yesterday with today still empty. The animation skips any chain cells
      // that fall outside the loaded grid (e.g. a streak reaching last year).
      const { playChainAnimation } = await lazyChainBuild();
      playChainAnimation(els.calendar, newStreak, habit, day, state.completions);
    }
  }
  renderStreak(habit);

  try {
    if (wasDone) await unmarkDay(habit.id, day);
    else         await markDay(habit.id, getUser().id, day);
  } catch (err) {
    toast(`Save failed: ${err.message}`, 'error');
    if (wasDone) {
      state.completions.add(day);
      if (useStreakSet) state.streakSet.add(day);
      cell.classList.add('day-done');
    } else {
      state.completions.delete(day);
      if (useStreakSet) state.streakSet.delete(day);
      cell.classList.remove('day-done');
    }
    renderStreak(habit);
  }
}

// Modal that asks the user to confirm un-filling a cell outside the normal
// edit window. Resolves true if confirmed, false if cancelled.
function confirmUnfillOldCell(dayISO, habit) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="dialog dialog-confirm" role="dialog" aria-modal="true">
        <h2>Un-fill this day?</h2>
        <p class="confirm-day">
          <span class="confirm-swatch" style="background:${habit.color}"></span>
          <span><b>${escapeHTML(habit.name)}</b> &middot; ${dayISO}</span>
        </p>
        <p class="confirm-body">
          This day is outside your 3-day edit window. Un-filling it will
          <b>break the chain</b> that runs through it. You can't undo this
          — to re-fill, you'd have to do it within the next 3 days.
        </p>
        <div class="dlg-actions">
          <button class="btn" id="ufCancel" type="button">Keep it</button>
          <button class="btn btn-danger" id="ufConfirm" type="button">Un-fill</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const finish = (yes) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(yes);
    };
    overlay.querySelector('#ufCancel').addEventListener('click', () => finish(false));
    overlay.querySelector('#ufConfirm').addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(false); });
    const onKey = (e) => { if (e.key === 'Escape') finish(false); };
    document.addEventListener('keydown', onKey);
    // Default focus on Cancel so an accidental Enter doesn't destroy data.
    overlay.querySelector('#ufCancel').focus();
  });
}

// ---- Habit create/edit dialog -------------------------------------------

function openHabitDialog(existing = null) {
  const isEdit = !!existing;
  const used = new Set(state.habits.filter(h => !isEdit || h.id !== existing.id).map(h => h.color));
  const defaultColor = existing?.color || COLORS.find(c => !used.has(c)) || COLORS[0];
  const defaultTexture = normalizeTexture(existing?.texture);
  const defaultTextColor = normalizeTextColor(existing?.text_color);

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="dialog dialog-habit" role="dialog" aria-modal="true">
      <h2>${isEdit ? 'Edit habit' : 'New habit'}</h2>
      <div class="form-group">
        <label for="dlgName">Name</label>
        <input class="field" id="dlgName" maxlength="40" placeholder="e.g. Write 500 words" value="${escapeAttr(existing?.name || '')}" />
      </div>
      <div class="form-group">
        <div class="color-target-toggle" role="tablist">
          <button type="button" class="color-target-btn is-selected" data-target="box" role="tab" aria-selected="true">
            <span class="color-target-icon color-target-icon-box"></span>
            <span>Box</span>
          </button>
          <button type="button" class="color-target-btn" data-target="text" role="tab" aria-selected="false">
            <span class="color-target-icon color-target-icon-text">26</span>
            <span>Text</span>
          </button>
        </div>
        <div class="color-wheel-host" id="dlgWheel"></div>
      </div>
      <div class="form-group">
        <label>Texture</label>
        <div class="texture-grid" id="dlgTextures">
          ${TEXTURES.map(t => `
            <button type="button"
                    class="texture-tile ${t.id === defaultTexture ? 'is-selected' : ''}"
                    data-texture="${t.id}"
                    title="${t.blurb}">
              <span class="texture-swatch tx-${t.id}"></span>
              <span class="texture-label">${t.name}</span>
            </button>
          `).join('')}
        </div>
      </div>
      ${isEdit ? `<p class="dlg-meta">Chain started ${existing.created_at}</p>` : ''}
      <div class="dlg-actions">
        ${isEdit ? `<button class="btn btn-danger" id="dlgDelete">Delete</button>` : ''}
        <div class="header-spacer"></div>
        <button class="btn" id="dlgCancel">Cancel</button>
        <button class="btn btn-primary" id="dlgSave">${isEdit ? 'Save' : 'Create'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  let chosenColor = defaultColor;
  let chosenTexture = defaultTexture;
  let chosenTextColor = defaultTextColor;
  let activeTarget = 'box';

  const nameEl = overlay.querySelector('#dlgName');
  const dlg = overlay.querySelector('.dialog-habit');
  // Live CSS vars drive every texture swatch + the toggle's Text icon so
  // they update in real time as the wheel moves or the target changes.
  dlg.style.setProperty('--habit-color', chosenColor);
  dlg.style.setProperty('--habit-text-color', chosenTextColor);

  // Single color wheel; its onChange routes to whichever target is active.
  const wheel = buildColorWheel(overlay.querySelector('#dlgWheel'), chosenColor, (hex) => {
    if (activeTarget === 'box') {
      chosenColor = hex;
      dlg.style.setProperty('--habit-color', hex);
    } else {
      chosenTextColor = normalizeTextColor(hex);
      dlg.style.setProperty('--habit-text-color', chosenTextColor);
    }
  });

  // Toggle swaps which target the wheel is editing — and refills the wheel
  // with that target's current color so the user picks up where they left
  // off on it. setHex doesn't fire onChange, so this is a clean swap.
  const targetBtns = overlay.querySelectorAll('.color-target-btn');
  targetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      activeTarget = btn.dataset.target;
      targetBtns.forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-selected', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      wheel.setHex(activeTarget === 'box' ? chosenColor : chosenTextColor);
    });
  });

  overlay.querySelector('#dlgTextures').addEventListener('click', (e) => {
    const tile = e.target.closest('.texture-tile');
    if (!tile) return;
    chosenTexture = tile.dataset.texture;
    overlay.querySelectorAll('.texture-tile').forEach(t => t.classList.toggle('is-selected', t === tile));
  });

  nameEl.focus();

  const close = () => overlay.remove();
  overlay.querySelector('#dlgCancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#dlgSave').addEventListener('click', async () => {
    const name = nameEl.value.trim();
    if (!name) { toast('Give it a name.', 'error'); return; }
    try {
      let saved;
      if (isEdit) {
        const fields = { name, color: chosenColor, texture: chosenTexture, text_color: chosenTextColor };
        saved = await updateHabit(existing.id, fields);
        Object.assign(existing, saved);
        renderTabs();
        if (existing.id === state.currentHabitId) await loadAndRenderCalendar();
      } else {
        saved = await createHabit(getUser().id, name, chosenColor, chosenTexture, chosenTextColor);
        state.habits.push(saved);
        state.currentHabitId = saved.id;
        renderTabs();
        els.emptyState.hidden = true;
        await loadAndRenderCalendar();
      }
      // If the schema was missing optional columns, the habit was still
      // saved but those fields were dropped. Tell the user which migration
      // to run so persistence works next time.
      if (saved && saved._droppedColumns?.length) {
        const files = saved._droppedColumns.map(migrationFileForColumn).filter(Boolean);
        toast(`Saved, but run ${files.join(' + ')} in Supabase to persist ${saved._droppedColumns.join(' + ')}.`, 'error');
      }
      close();
    } catch (err) {
      toast(`Save failed: ${err.message}`, 'error');
    }
  });

  if (isEdit) {
    overlay.querySelector('#dlgDelete').addEventListener('click', async () => {
      if (!confirm(`Delete "${existing.name}" and all of its history? This can't be undone.`)) return;
      try {
        await deleteHabit(existing.id);
        state.habits = state.habits.filter(h => h.id !== existing.id);
        // Drop now-orphaned per-habit state: the localStorage sound queue
        // (lazy-import audio.js, since it's off the critical path) and the
        // cached streak/completion maps keyed by this id.
        import('./audio.js').then(m => m.clearPatternQueue(existing.id)).catch(() => {});
        state.streakSetByHabit.delete(existing.id);
        state.completionsByHabit.delete(existing.id);
        if (state.streakSetHabitId === existing.id) state.streakSetHabitId = null;
        if (state.currentHabitId === existing.id) {
          state.currentHabitId = state.habits[0]?.id || null;
        }
        close();
        await loadAndRenderHabits();
      } catch (err) {
        toast(`Delete failed: ${err.message}`, 'error');
      }
    });
  }
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s) { return escapeHTML(s); }

// Drive whichever fill animation the user has picked. Strip + reflow + re-add
// so re-clicking restarts the keyframes; without the reflow, re-adding the
// same class won't re-fire them.
function playFillAnimation(cell) {
  // Respect reduced-motion: the cell already carries the static `day-done`
  // fill, so just skip the keyframe flourish + reflow on a routine tick.
  if (prefersReducedMotion()) return;
  const id = getSelectedAnimationId();
  const cls = `fill-${id}`;
  cell.classList.remove(cls, 'day-just-filled');
  void cell.offsetWidth;
  cell.classList.add(cls, 'day-just-filled');
  setTimeout(() => cell.classList.remove(cls, 'day-just-filled'), FILL_ANIMATION_DURATION_MS);
}

boot().catch(err => {
  console.error('Boot failed:', err);
  document.body.innerHTML = `<pre style="padding:20px;color:#f88">Boot failed: ${err.message}\n\nCheck console for details.</pre>`;
});
