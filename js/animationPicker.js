// Picker modal: shows all 25 fill animations as a grid of preview cells.
// Hover (or focus) re-plays the animation on that preview; click selects.
import {
  FILL_ANIMATIONS,
  FILL_ANIMATION_DURATION_MS,
  getSelectedAnimationId,
  setSelectedAnimationId,
} from './fillAnimations.js';

// Re-trigger an animation by stripping classes, forcing reflow, re-adding.
// We strip `day-done` too so the cell starts visually empty — that way sweep/
// wipe/iris-style animations show the color actually filling in, instead of
// just shimmering on top of an already-filled cell.
function playOnce(cell, animClass) {
  cell.classList.remove(animClass, 'day-just-filled', 'day-done');
  void cell.offsetWidth;
  cell.classList.add(animClass, 'day-just-filled', 'day-done');
}

export function openAnimationPicker(onSelected) {
  const currentId = getSelectedAnimationId();

  const overlay = document.createElement('div');
  overlay.className = 'overlay overlay-picker';
  overlay.innerHTML = `
    <div class="dialog dialog-picker" role="dialog" aria-modal="true" aria-label="Choose fill animation">
      <div class="picker-header">
        <h2>Fill animation</h2>
        <p class="picker-sub">Hover a tile to preview. Click to use.</p>
      </div>
      <div class="picker-grid" id="pickerGrid">
        ${FILL_ANIMATIONS.map(a => `
          <button type="button"
                  class="picker-tile ${a.id === currentId ? 'is-selected' : ''}"
                  data-anim="${a.id}"
                  title="${a.blurb}">
            <span class="picker-cell day fill-${a.id}">
              <span class="day-num">26</span>
            </span>
            <span class="picker-label">${a.name}</span>
          </button>
        `).join('')}
      </div>
      <div class="dlg-actions">
        <div class="header-spacer"></div>
        <button class="btn" id="pickerClose">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const grid = overlay.querySelector('#pickerGrid');

  // --habit-color is set by CSS (.picker-cell { --habit-color: var(--accent) }).
  // Cells start empty; playOnce() adds day-done at the moment of animation so
  // sweep/wipe-style effects actually show color appearing.

  // Hover/focus = preview. Re-arm on each enter so users can re-watch by
  // moving the cursor off + back on. Touch falls through to click.
  grid.querySelectorAll('.picker-tile').forEach(tile => {
    const cell = tile.querySelector('.picker-cell');
    const animClass = `fill-${tile.dataset.anim}`;
    let timer = null;

    const play = () => {
      clearTimeout(timer);
      playOnce(cell, animClass);
      // Reset to empty after the animation so the next hover replays the
      // empty→filled transition cleanly.
      timer = setTimeout(() => {
        cell.classList.remove(animClass, 'day-just-filled', 'day-done');
      }, FILL_ANIMATION_DURATION_MS);
    };

    tile.addEventListener('mouseenter', play);
    tile.addEventListener('focus', play);
    tile.addEventListener('click', () => {
      const id = tile.dataset.anim;
      setSelectedAnimationId(id);
      grid.querySelectorAll('.picker-tile').forEach(t => t.classList.toggle('is-selected', t === tile));
      // One last play so the selection feels confirmed, then close.
      play();
      setTimeout(() => {
        close();
        if (onSelected) onSelected(id);
      }, 320);
    });
  });

  const close = () => overlay.remove();
  overlay.querySelector('#pickerClose').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // Escape to close.
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
}
