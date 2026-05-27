// Chain-build reward animation — fires when filling TODAY's box extends an
// existing streak. Intensity scales with the chain length so longer chains
// feel more satisfying to extend:
//
//   streak 1        : nothing extra (just the per-cell fill animation)
//   streak 2        : "+2" floater above today
//   streak 3-6      : floater + 3-cell cascade pulse rolling up to today
//   streak 7-13     : larger floater + 6-cell cascade
//   streak 14-29    : larger floater + 10-cell cascade
//   streak 30+      : largest floater + 14-cell cascade
//   milestones      : celebratory toast (7, 14, 21, 30, 50, 100, every 100, 365)

import { todayISO, daysAgoISO } from './utils.js';

const CASCADE_STEP_MS = 65; // gap between successive pulses in the cascade

export function playChainAnimation(calendarEl, streakLength, habit) {
  if (streakLength < 2) return;

  const todayCell = calendarEl.querySelector(`[data-day="${todayISO()}"]`);
  if (!todayCell) return;

  const cascadeLen = cascadeLengthForStreak(streakLength);

  // Cascade: pulse cells from (cascadeLen) days ago forward to yesterday, so
  // the wave visually "arrives" at today as the floater appears. We skip
  // today itself because its fill animation is already playing.
  for (let i = cascadeLen; i >= 1; i--) {
    const cell = calendarEl.querySelector(`[data-day="${daysAgoISO(i)}"]`);
    if (!cell) continue;
    const delay = (cascadeLen - i) * CASCADE_STEP_MS;
    setTimeout(() => pulseCell(cell, habit.color), delay);
  }

  // Floater on today, timed to land just as the cascade reaches it.
  const floaterDelay = Math.max(0, (cascadeLen - 1) * CASCADE_STEP_MS);
  setTimeout(() => showFloater(todayCell, streakLength, habit.color), floaterDelay);

  // Milestone celebration on top of everything else.
  if (isMilestone(streakLength)) {
    setTimeout(
      () => showMilestoneToast(streakLength, habit.color, habit.name),
      floaterDelay + 320
    );
  }
}

function cascadeLengthForStreak(streak) {
  if (streak < 3) return 0;
  if (streak < 7)  return Math.min(streak - 1, 3);
  if (streak < 14) return Math.min(streak - 1, 6);
  if (streak < 30) return Math.min(streak - 1, 10);
  return Math.min(streak - 1, 14);
}

function floaterSizePx(streak) {
  if (streak < 7)  return 16;
  if (streak < 14) return 20;
  if (streak < 30) return 26;
  return 32;
}

function isMilestone(streak) {
  if ([7, 14, 21, 30, 50, 100, 200, 365].includes(streak)) return true;
  if (streak > 100 && streak % 100 === 0) return true;
  return false;
}

function showFloater(cell, streak, color) {
  const fl = document.createElement('span');
  fl.className = 'chain-floater';
  fl.textContent = `+${streak}`;
  fl.style.setProperty('--floater-color', color);
  fl.style.fontSize = `${floaterSizePx(streak)}px`;
  cell.appendChild(fl);
  // The CSS animation runs ~1.05s with `forwards`; remove the node after so
  // it doesn't accumulate in the DOM if the user marks a habit many times.
  setTimeout(() => fl.remove(), 1200);
}

function pulseCell(cell, color) {
  cell.style.setProperty('--pulse-color', color);
  cell.classList.add('chain-pulse');
  setTimeout(() => {
    cell.classList.remove('chain-pulse');
    cell.style.removeProperty('--pulse-color');
  }, 500);
}

function showMilestoneToast(streak, color, habitName) {
  const host = document.getElementById('toastHost') || (() => {
    const h = document.createElement('div');
    h.id = 'toastHost';
    document.body.appendChild(h);
    return h;
  })();
  const t = document.createElement('div');
  t.className = 'toast toast-milestone';
  t.style.setProperty('--milestone-color', color);
  t.innerHTML = `
    <span class="milestone-num">${streak}</span>
    <span class="milestone-meta">
      <span class="milestone-label">day chain</span>
      <span class="milestone-habit">${escapeHTML(habitName)}</span>
    </span>
  `;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, 3800);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
