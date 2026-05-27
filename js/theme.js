// Theme toggle (light/dark) — persists in localStorage, applies attribute to <html>

const STORAGE_KEY = 'seinfeld_theme';
const VALID = new Set(['light', 'dark']);

export function getStoredTheme() {
  const v = localStorage.getItem(STORAGE_KEY);
  return VALID.has(v) ? v : null;
}

export function getActiveTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

export function applyTheme(theme) {
  if (!VALID.has(theme)) return;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

// Called from an inline script in index.html BEFORE CSS paints, so users
// don't see a flash of the wrong theme on load.
export function initTheme() {
  const stored = getStoredTheme();
  if (stored) { applyTheme(stored); return; }
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  applyTheme(prefersLight ? 'light' : 'dark');
}

export function toggleTheme() {
  applyTheme(getActiveTheme() === 'dark' ? 'light' : 'dark');
}
