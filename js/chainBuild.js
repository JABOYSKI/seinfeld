// Chain-build feedback orchestrator. Two pieces:
//   1. The user-selected animation (one of 25 in chainAnimations.js).
//   2. The universal milestone toast at chain anniversaries — same regardless
//      of which animation is selected.
//
// Both fire only when filling TODAY's box; backfilling past days doesn't
// trigger a chain reward.

import { playChainAnimation as playSelectedChain } from './chainAnimations.js';

export function playChainAnimation(calendarEl, streakLength, habit) {
  if (streakLength < 2) return;
  playSelectedChain(calendarEl, streakLength, habit);
  if (isMilestone(streakLength)) {
    // Slight delay so the toast doesn't compete with the per-cell effect.
    setTimeout(() => showMilestoneToast(streakLength, habit.color, habit.name), 600);
  }
}

function isMilestone(streak) {
  if ([7, 14, 21, 30, 50, 100, 200, 365].includes(streak)) return true;
  if (streak > 100 && streak % 100 === 0) return true;
  return false;
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
