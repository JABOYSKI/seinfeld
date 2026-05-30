// Picker modal for chain-build sounds. Click a tile to select + hear an
// ascending arpeggio preview. AudioContext is created lazily on click —
// hover would be cleaner UX but most browsers don't count hover as a user
// gesture, so audio wouldn't initialize.
import { SCALES, getSelectedSoundId, setSelectedSoundId, playPreview } from './audio.js';

export function openSoundPicker(onSelected) {
  const currentId = getSelectedSoundId();

  const overlay = document.createElement('div');
  overlay.className = 'overlay overlay-picker';
  overlay.innerHTML = `
    <div class="dialog dialog-picker dialog-sound-picker" role="dialog" aria-modal="true" aria-label="Choose chain sound">
      <div class="picker-header">
        <h2>Chain sound</h2>
        <p class="picker-sub">Mallet hits play as your chain lights up. Click a scale to hear it.</p>
      </div>
      <div class="picker-grid picker-grid-sound" id="soundPickerGrid">
        ${SCALES.map(s => `
          <button type="button"
                  class="picker-tile sound-tile ${s.id === currentId ? 'is-selected' : ''}"
                  data-sound="${s.id}"
                  title="${s.blurb}">
            <span class="sound-tile-icon">${s.id === 'off' ? '🔇' : '🎵'}</span>
            <span class="picker-label">${s.name}</span>
            <span class="sound-tile-blurb">${s.blurb}</span>
          </button>
        `).join('')}
      </div>
      <div class="dlg-actions">
        <div class="header-spacer"></div>
        <button class="btn" id="soundPickerClose">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const grid = overlay.querySelector('#soundPickerGrid');
  grid.querySelectorAll('.sound-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const id = tile.dataset.sound;
      setSelectedSoundId(id);
      grid.querySelectorAll('.sound-tile').forEach(t => t.classList.toggle('is-selected', t === tile));
      // Click is a user gesture — safe to fire the synth.
      playPreview(id);
      if (onSelected) onSelected(id);
    });
  });

  const close = () => overlay.remove();
  overlay.querySelector('#soundPickerClose').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const onKey = (e) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
}
