// Main controller — boots, routes auth vs tracker, owns app state.
import { initAuth, onAuthChange, signOut, renderAuth, getUser } from './auth.js';
import { loadHabits, createHabit, updateHabit, deleteHabit, repairFutureCreatedDates, COLORS } from './habits.js';
import { loadCompletions, markDay, unmarkDay } from './completions.js';
import { renderCalendar } from './calendar.js';
import { currentStreak, longestStreak } from './streak.js';
import { initTheme, toggleTheme, getActiveTheme } from './theme.js';
import { toast, todayISO, canEditDay } from './utils.js';

const MAX_HABITS = 5;

const state = {
  habits: [],
  currentHabitId: null,
  currentYear: new Date().getFullYear(),
  completions: new Set(),
};

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
        <div class="logo">📅 <span class="logo-text">Seinfeld</span></div>
        <div class="header-spacer"></div>
        <button class="icon-btn" id="themeBtn" title="Toggle theme">${getActiveTheme() === 'dark' ? '☀️' : '🌙'}</button>
        <button class="icon-btn" id="signoutBtn" title="Sign out">⎋</button>
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
  els.signoutBtn.addEventListener('click', async () => {
    await signOut();
    showAuth();
  });
  els.yearPrev.addEventListener('click', () => changeYear(-1));
  els.yearNext.addEventListener('click', () => changeYear(1));
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
  if (!state.habits.find(h => h.id === state.currentHabitId)) {
    state.currentHabitId = state.habits[0].id;
  }
  renderTabs();
  await loadAndRenderCalendar();
}

function renderTabs() {
  const tabs = state.habits.map(h => `
    <button class="tab ${h.id === state.currentHabitId ? 'tab-active' : ''}"
            data-habit="${h.id}"
            style="--tab-color:${h.color}">
      <span class="tab-dot"></span>
      <span class="tab-name">${escapeHTML(h.name)}</span>
      <span class="tab-edit" data-edit="${h.id}" title="Edit habit">✎</span>
    </button>
  `).join('');
  const canAdd = state.habits.length < MAX_HABITS;
  const addBtn = canAdd
    ? `<button class="tab tab-add" id="tabAdd" title="New habit">+</button>`
    : '';
  els.tabs.innerHTML = tabs + addBtn;

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
  const habit = state.habits.find(h => h.id === state.currentHabitId);
  if (!habit) return;
  try {
    state.completions = await loadCompletions(habit.id, state.currentYear);
  } catch (e) {
    toast(`Failed to load days: ${e.message}`, 'error');
    state.completions = new Set();
  }
  renderCalendar(els.calendar, habit, state.completions, state.currentYear);
  renderStreak(habit);
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

function changeYear(delta) {
  state.currentYear += delta;
  els.yearLabel.textContent = state.currentYear;
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
    cell.classList.remove('day-done', 'day-just-filled');
  } else {
    state.completions.add(day);
    cell.classList.add('day-done');
    playFillAnimation(cell);
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

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="dialog" role="dialog" aria-modal="true">
      <h2>${isEdit ? 'Edit habit' : 'New habit'}</h2>
      <div class="form-group">
        <label for="dlgName">Name</label>
        <input class="field" id="dlgName" maxlength="40" placeholder="e.g. Write 500 words" value="${escapeAttr(existing?.name || '')}" />
      </div>
      <div class="form-group">
        <label>Color</label>
        <div class="color-row" id="dlgColors">
          ${COLORS.map(c => `<button type="button" class="color-swatch ${c === defaultColor ? 'is-selected' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}
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
  const nameEl = overlay.querySelector('#dlgName');
  nameEl.focus();

  overlay.querySelector('#dlgColors').addEventListener('click', (e) => {
    const sw = e.target.closest('.color-swatch');
    if (!sw) return;
    chosenColor = sw.dataset.color;
    overlay.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('is-selected', s === sw));
  });

  const close = () => overlay.remove();
  overlay.querySelector('#dlgCancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#dlgSave').addEventListener('click', async () => {
    const name = nameEl.value.trim();
    if (!name) { toast('Give it a name.', 'error'); return; }
    try {
      if (isEdit) {
        const updated = await updateHabit(existing.id, { name, color: chosenColor });
        Object.assign(existing, updated);
        renderTabs();
        if (existing.id === state.currentHabitId) await loadAndRenderCalendar();
      } else {
        const created = await createHabit(getUser().id, name, chosenColor);
        state.habits.push(created);
        state.currentHabitId = created.id;
        renderTabs();
        els.emptyState.hidden = true;
        await loadAndRenderCalendar();
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

// Drive the .day-just-filled CSS animation. Strip the class first and force
// a reflow so re-clicking a cell within one session restarts the animation
// — without the reflow, re-adding the same class won't re-run keyframes.
function playFillAnimation(cell) {
  cell.classList.remove('day-just-filled');
  void cell.offsetWidth;
  cell.classList.add('day-just-filled');
  setTimeout(() => cell.classList.remove('day-just-filled'), 650);
}

boot().catch(err => {
  console.error('Boot failed:', err);
  document.body.innerHTML = `<pre style="padding:20px;color:#f88">Boot failed: ${err.message}\n\nCheck console for details.</pre>`;
});
