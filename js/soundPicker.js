// Picker modal for chain-build sounds. Now includes a simulator at the top:
// drag the slider to a chain length, then click any tile to hear what that
// scale would sound like at that length (the timing matches the real
// cascade's adaptiveStep).
import {
  SCALES, getSelectedSoundId, setSelectedSoundId, playSimulation,
} from './audio.js';

export function openSoundPicker(onSelected) {
  const currentId = getSelectedSoundId();

  const overlay = document.createElement('div');
  overlay.className = 'overlay overlay-picker';
  overlay.innerHTML = `
    <div class="dialog dialog-picker dialog-sound-picker" role="dialog" aria-modal="true" aria-label="Choose chain sound">
      <div class="picker-header">
        <h2>Chain sound</h2>
        <p class="picker-sub">Mallet hits play as your chain lights up.</p>
      </div>

      <div class="sound-simulator">
        <label class="sim-label" for="simLength">Simulate chain length</label>
        <div class="sim-row">
          <input type="range" id="simLength" min="2" max="60" value="8" />
          <span class="sim-value" id="simLengthValue">8</span>
          <button type="button" class="btn btn-primary sim-play" id="simPlay">Play</button>
        </div>
        <p class="sim-hint">Click any tile to hear it at this length.</p>
      </div>

      <div class="picker-grid picker-grid-sound" id="soundPickerGrid">
        ${SCALES.map(s => `
          <button type="button"
                  class="picker-tile sound-tile ${s.id === currentId ? 'is-selected' : ''}"
                  data-sound="${s.id}"
                  title="${s.blurb}">
            <span class="sound-tile-icon">${s.id === 'off' ? '🔇' : '🎵'}</span>
            <span class="picker-label">${s.name}</span>
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
  const simLength = overlay.querySelector('#simLength');
  const simValue = overlay.querySelector('#simLengthValue');
  const simPlay = overlay.querySelector('#simPlay');

  simLength.addEventListener('input', () => { simValue.textContent = simLength.value; });

  simPlay.addEventListener('click', () => {
    playSimulation(getSelectedSoundId(), parseInt(simLength.value, 10));
  });

  grid.querySelectorAll('.sound-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const id = tile.dataset.sound;
      setSelectedSoundId(id);
      grid.querySelectorAll('.sound-tile').forEach(t => t.classList.toggle('is-selected', t === tile));
      // Preview at the simulator length so the user can A/B scales quickly.
      playSimulation(id, parseInt(simLength.value, 10));
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
