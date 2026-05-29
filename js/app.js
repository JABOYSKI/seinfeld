// Main controller — boots, routes auth vs tracker, owns app state.
import { initAuth, onAuthChange, signOut, renderAuth, getUser } from './auth.js';
import { loadHabits, createHabit, updateHabit, deleteHabit, repairFutureCreatedDates, COLORS, DEFAULT_TEXT_COLOR, normalizeTextColor, migrationFileForColumn } from './habits.js';
import { TEXTURES, DEFAULT_TEXTURE_ID, normalizeTexture } from './textures.js';
import { buildColorWheel } from './colorWheel.js';
import { loadCompletions, loadCompletionsInRange, markDay, unmarkDay } from './completions.js';
import { renderCalendar, renderAllCalendar, renderContinuousCalendar, CONTINUOUS_YEARS } from './calendar.js';
import { currentStreak, longestStreak } from './streak.js';

import { initTheme, toggleTheme, getActiveTheme } from './theme.js';
import { toast, todayISO, canEditDay } from './utils.js';
import { getSelectedAnimationId, FILL_ANIMATION_DURATION_MS } from './fillAnimations.js';
import { openAnimationPicker } from './animationPicker.js';
import { openChainPicker } from './chainPicker.js';
import { playChainAnimation } from './chainBuild.js';

const MAX_HABITS = 5;

const state = {
  habits: [],
  // currentHabitId === 'all' is a sentinel for the conglomerate view; any
  // real UUID = the single-habit view for that habit.
  currentHabitId: null,
  currentYear: new Date().getFullYear(),
  completions: new Set(),                 // single-mode: one habit's completions
  completionsByHabit: new Map(),          // all-mode: habitId -> Set<dayISO>
};

const ALL_VIEW_ID = 'all';

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
  const user = await initAuth();
  onAuthChange(async (u, event) => {
    // INITIAL_SESSION is already handled by the explicit initAuth() above —
    // we only react to subsequent state changes here.
    if (event === 'INITIAL_SESSION') return;
    if (event === 'SIGNED_OUT') { showAuth(); return; }
    if (u && event === 'SIGNED_IN') await showTracker();
  });

  if (user) await showTracker();
  else showAuth();
  hideBoot();
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
        <div class="header-spacer"></div>
        <button class="icon-btn" id="animBtn" title="Choose fill animation">✦</button>
        <button class="icon-btn" id="chainAnimBtn" title="Choose chain animation">⛓</button>
        <button class="icon-btn" id="viewToggle" title="Toggle continuous / months view">${getViewMode() === 'months' ? '≡' : '▦'}</button>
        <button class="icon-btn" id="themeBtn" title="Toggle theme">${getActiveTheme() === 'dark' ? '☀️' : '🌙'}</button>
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
        <div class="streak-chip" id="streakChip"></div>
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
  document.getElementById('chainAnimBtn').addEventListener('click', () => {
    openChainPicker((id) => toast(`Chain: ${id}`, 'info'));
  });
  els.signoutBtn.addEventListener('click', async () => {
    await signOut();
    showAuth();
  });
  els.yearPrev.addEventListener('click', () => changeYear(-1));
  els.yearNext.addEventListener('click', () => changeYear(1));
  const viewToggle = document.getElementById('viewToggle');
  viewToggle.addEventListener('click', () => {
    setViewMode(getViewMode() === 'months' ? 'continuous' : 'months');
    viewToggle.textContent = getViewMode() === 'months' ? '≡' : '▦';
    updateYearLabel();
    if (state.currentHabitId) loadAndRenderCalendar();
  });
  els.calendar.addEventListener('click', onCalendarClick);
  document.getElementById('emptyCreate').addEventListener('click', () => openHabitDialog());
}

async function loadAndRenderHabits() {
  const user = getUser();
  try {
    const fixed = await repairFutureCreatedDates(user.id);
    if (fixed > 0) toast(`Fixed ${fixed} habit start date${fixed > 1 ? 's' : ''}.`, 'info');
    state.habits = await loadHabits(user.id);
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
               data-habit="${ALL_VIEW_ID}" title="See every habit at once">
         <span class="tab-all-icon">▦</span>
         <span class="tab-name">All</span>
       </button>`
    : '';

  const tabs = state.habits.map(h => `
    <button class="tab ${h.id === state.currentHabitId ? 'tab-active' : ''}"
            data-habit="${h.id}"
            style="--tab-color:${h.color};--tab-text-color:${h.text_color || '#ffffff'}">
      <span class="tab-dot"></span>
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
}

async function loadAndRenderCalendar() {
  if (state.currentHabitId === ALL_VIEW_ID) {
    await loadAndRenderAllCalendar();
    return;
  }
  const habit = state.habits.find(h => h.id === state.currentHabitId);
  if (!habit) return;
  const continuous = getViewMode() === 'continuous';
  try {
    // Continuous view spans CONTINUOUS_YEARS years; months view is single-year.
    state.completions = continuous
      ? await loadCompletionsInRange(habit.id, state.currentYear - (CONTINUOUS_YEARS - 1), state.currentYear)
      : await loadCompletions(habit.id, state.currentYear);
  } catch (e) {
    toast(`Failed to load days: ${e.message}`, 'error');
    state.completions = new Set();
  }
  if (continuous) {
    renderContinuousCalendar(els.calendar, habit, state.completions, state.currentYear);
  } else {
    renderCalendar(els.calendar, habit, state.completions, state.currentYear);
  }
  updateYearLabel();
  renderStreak(habit);
}

function updateYearLabel() {
  if (!els.yearLabel) return;
  els.yearLabel.textContent = getViewMode() === 'continuous'
    ? `${state.currentYear - (CONTINUOUS_YEARS - 1)}–${state.currentYear}`
    : String(state.currentYear);
}

async function loadAndRenderAllCalendar() {
  // Fire all per-habit fetches in parallel — small N (max 5) keeps this cheap.
  try {
    const results = await Promise.all(
      state.habits.map(h =>
        loadCompletions(h.id, state.currentYear).then(set => [h.id, set])
      )
    );
    state.completionsByHabit = new Map(results);
  } catch (e) {
    toast(`Failed to load days: ${e.message}`, 'error');
    state.completionsByHabit = new Map();
  }
  renderAllCalendar(els.calendar, state.habits, state.completionsByHabit, state.currentYear);
  renderAllSummary();
}

function renderStreak(habit) {
  // For accurate current-streak math we need completions for the prior year
  // too (a chain can cross New Year). Cheap follow-up fetch only when the
  // viewed year is current and the streak might extend back.
  const cur = currentStreak(state.completions, habit.created_at);
  const longest = longestStreak(state.completions);
  els.streakChip.innerHTML = `
    <span class="streak-current">current <b>${cur}</b></span>
    <span class="streak-sep">·</span>
    <span class="streak-longest">longest <b>${longest}</b></span>
  `;
}

function renderAllSummary() {
  // "Perfect days" = days where every habit that existed by that date got
  // its slice filled. Most useful metric in the conglomerate view because it
  // rewards consistency across the whole portfolio.
  const today = todayISO();
  const year = state.currentYear;
  let perfectDays = 0;
  let totalFills = 0;
  for (const [, set] of state.completionsByHabit) totalFills += set.size;

  // Walk each day from year start to today (or year end) counting perfect days.
  const yearStart = new Date(year, 0, 1);
  const yearEnd   = new Date(year, 11, 31);
  const stop      = todayISO() < `${year}-01-01` ? yearStart
                  : todayISO() > `${year}-12-31` ? yearEnd
                  : new Date();
  for (let d = new Date(yearStart); d <= stop; d.setDate(d.getDate() + 1)) {
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
  if (!canEditDay(day, habit.created_at)) {
    toast('That day is locked.', 'info');
    return;
  }
  const wasDone = state.completions.has(day);

  // Optimistic UI: flip immediately, revert on error.
  if (wasDone) {
    state.completions.delete(day);
    // Strip any fill-* class along with done/flash so the cell goes inert.
    cell.classList.remove('day-done', 'day-just-filled');
    cell.className = cell.className.replace(/\bfill-[a-z-]+\b/g, '').replace(/\s+/g, ' ').trim();
  } else {
    // Compute streak BEFORE adding so we can detect a chain extension. Fire
    // the chain animation whenever the new fill extends the current streak
    // — covers both filling today AND backfilling a past day that links
    // yesterday's fill to today's. The animation always plays on today's
    // cell because that's where the chain ends.
    const oldStreak = currentStreak(state.completions, habit.created_at);
    state.completions.add(day);
    cell.classList.add('day-done');
    playFillAnimation(cell);
    const newStreak = currentStreak(state.completions, habit.created_at);
    if (newStreak > oldStreak && newStreak >= 2) {
      // Anchor on the cell that was just clicked — that's where the user's
      // attention is and (in their mental model) the new end of the chain.
      // The old behavior anchored on today, which felt wrong when filling
      // yesterday with today still empty.
      playChainAnimation(els.calendar, newStreak, habit, day, state.completions);
    }
  }
  renderStreak(habit);

  try {
    if (wasDone) await unmarkDay(habit.id, day);
    else         await markDay(habit.id, getUser().id, day);
  } catch (err) {
    toast(`Save failed: ${err.message}`, 'error');
    if (wasDone) { state.completions.add(day); cell.classList.add('day-done'); }
    else         { state.completions.delete(day); cell.classList.remove('day-done'); }
    renderStreak(habit);
  }
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
