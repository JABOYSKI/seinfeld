// Picker modal for chain-build animations. Each preview tile is a row of
// 5 mini "day" cells (the last one is "today"); on hover the selected
// animation plays against that row at simulated streak=5.
import {
  CHAIN_ANIMATIONS,
  getSelectedChainAnimationId,
  setSelectedChainAnimationId,
  playChainAnimationById,
} from './chainAnimations.js';

const PREVIEW_CELL_COUNT = 5;
const PREVIEW_STREAK = 5;
const PREVIEW_DURATION_MS = 1600;

export function openChainPicker(onSelected) {
  const currentId = getSelectedChainAnimationId();

  const overlay = document.createElement('div');
  overlay.className = 'overlay overlay-picker';
  overlay.innerHTML = `
    <div class="dialog dialog-picker dialog-chain-picker" role="dialog" aria-modal="true" aria-label="Choose chain animation">
      <div class="picker-header">
        <h2>Chain animation</h2>
        <p class="picker-sub">Hover a tile to preview at streak 5. Click to use.</p>
      </div>
      <div class="picker-grid picker-grid-chain" id="chainPickerGrid">
        ${CHAIN_ANIMATIONS.map(a => `
          <button type="button"
                  class="picker-tile chain-tile ${a.id === currentId ? 'is-selected' : ''}"
                  data-anim="${a.id}"
                  title="${a.blurb}">
            <div class="chain-preview-row">
              ${Array.from({ length: PREVIEW_CELL_COUNT }, () =>
                `<span class="day day-done chain-preview-cell"></span>`
              ).join('')}
            </div>
            <span class="picker-label">${a.name}</span>
          </button>
        `).join('')}
      </div>
      <div class="dlg-actions">
        <div class="header-spacer"></div>
        <button class="btn" id="chainPickerClose">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const grid = overlay.querySelector('#chainPickerGrid');

  grid.querySelectorAll('.chain-tile').forEach(tile => {
    const row = tile.querySelector('.chain-preview-row');
    const cells = [...row.querySelectorAll('.chain-preview-cell')];
    const animId = tile.dataset.anim;
    let timer = null;

    const play = () => {
      clearTimeout(timer);
      // Strip any leftover state from a prior play so animations restart cleanly.
      // Regex catches every chain-* class so we don't need to update this list
      // when new animation variants get added — but explicitly skips
      // `chain-preview-*` structural classes (they hold the 20×20 sizing of
      // the preview cells; stripping them collapses the cells to 0 width).
      cells.forEach(c => {
        c.className = c.className.replace(/\bchain-(?!preview)[a-z][\w-]*\b/g, '').replace(/\s+/g, ' ').trim();
        c.querySelectorAll('[class*="chain-"]').forEach(n => n.remove());
      });
      // Force reflow so re-adding classes restarts keyframes.
      void row.offsetWidth;
      playChainAnimationById(animId, {
        calendarEl: row,
        todayCell: cells[cells.length - 1],
        chainCells: cells,
        streakLength: PREVIEW_STREAK,
        habit: {
          id: 'preview',
          name: 'Preview',
          color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff5a5f',
          created_at: '2020-01-01',
        },
      });
      timer = setTimeout(() => {/* cleanup happens naturally via JS timeouts in chainAnimations */}, PREVIEW_DURATION_MS);
    };

    tile.addEventListener('mouseenter', play);
    tile.addEventListener('focus', play);
    tile.addEventListener('click', () => {
      setSelectedChainAnimationId(animId);
      grid.querySelectorAll('.chain-tile').forEach(t => t.classList.toggle('is-selected', t === tile));
      play();
      setTimeout(() => {
        close();
        if (onSelected) onSelected(animId);
      }, 380);
    });
  });

  const close = () => overlay.remove();
  overlay.querySelector('#chainPickerClose').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const onKey = (e) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
}
