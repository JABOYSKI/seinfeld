// Picker modal for chain-build sounds. Now includes a simulator at the top:
// drag the slider to a chain length, then click any tile to hear what that
// scale would sound like at that length (the timing matches the real
// cascade's adaptiveStep).
import {
  SCALES, getSelectedSoundId, setSelectedSoundId, playSimulation,
  getOctaveShift, setOctaveShift, OCTAVE_RANGE,
  getPitchShift, setPitchShift, PITCH_RANGE,
  PATTERNS, getSelectedPatternId, setSelectedPatternId,
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
        <label class="sim-label" for="simOctave">Octave shift</label>
        <div class="sim-row">
          <input type="range" id="simOctave" min="${OCTAVE_RANGE.min}" max="${OCTAVE_RANGE.max}" step="1" value="${getOctaveShift()}" />
          <span class="sim-value" id="simOctaveValue">${formatSigned(getOctaveShift())}</span>
        </div>
        <label class="sim-label" for="simPitch">Pitch (semitones)</label>
        <div class="sim-row">
          <input type="range" id="simPitch" min="${PITCH_RANGE.min}" max="${PITCH_RANGE.max}" step="1" value="${getPitchShift()}" />
          <span class="sim-value" id="simPitchValue">${formatSigned(getPitchShift())}</span>
        </div>
        <label class="sim-label" for="patternTrigger">Pattern</label>
        <div class="sim-row pattern-row">
          <div class="pattern-picker-wrap">
            <button type="button" class="pattern-picker-trigger" id="patternTrigger"
                    aria-haspopup="listbox" aria-expanded="false">
              <span class="pattern-trigger-name" id="patternTriggerName">${getPatternName()}</span>
              <span class="pattern-trigger-blurb" id="patternTriggerBlurb">${getPatternBlurb()}</span>
              <span class="pattern-trigger-caret" aria-hidden="true">▾</span>
            </button>
            <div class="pattern-picker-panel" id="patternPanel" role="listbox" hidden>
              <div class="pattern-panel-header">
                <span class="pattern-panel-title">Traversal pattern</span>
                <span class="pattern-panel-hint">Shape shows note order in a chain</span>
              </div>
              <div class="pattern-grid">
                ${PATTERNS.map(p => `
                  <button type="button"
                          class="pattern-option ${p.id === getSelectedPatternId() ? 'is-selected' : ''}"
                          data-pattern="${p.id}"
                          role="option"
                          aria-selected="${p.id === getSelectedPatternId()}"
                          title="${p.blurb}">
                    <span class="pattern-option-name">${p.name}</span>
                    ${patternSparkline(p)}
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
        <p class="sim-hint">Click any tile to hear it at these settings.</p>
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
  const simOctave = overlay.querySelector('#simOctave');
  const simOctaveValue = overlay.querySelector('#simOctaveValue');
  const simPitch = overlay.querySelector('#simPitch');
  const simPitchValue = overlay.querySelector('#simPitchValue');
  const patternTrigger = overlay.querySelector('#patternTrigger');
  const patternPanel = overlay.querySelector('#patternPanel');
  const patternTriggerName = overlay.querySelector('#patternTriggerName');
  const patternTriggerBlurb = overlay.querySelector('#patternTriggerBlurb');

  simLength.addEventListener('input', () => { simValue.textContent = simLength.value; });

  simOctave.addEventListener('input', () => {
    const v = setOctaveShift(parseInt(simOctave.value, 10));
    simOctaveValue.textContent = formatSigned(v);
  });

  simPitch.addEventListener('input', () => {
    const v = setPitchShift(parseInt(simPitch.value, 10));
    simPitchValue.textContent = formatSigned(v);
  });

  const closePatternPanel = () => {
    patternPanel.hidden = true;
    patternTrigger.setAttribute('aria-expanded', 'false');
  };
  const openPatternPanel = () => {
    patternPanel.hidden = false;
    patternTrigger.setAttribute('aria-expanded', 'true');
  };
  patternTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (patternPanel.hidden) openPatternPanel(); else closePatternPanel();
  });
  patternPanel.querySelectorAll('.pattern-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = opt.dataset.pattern;
      setSelectedPatternId(id);
      patternPanel.querySelectorAll('.pattern-option').forEach(o => {
        const sel = o === opt;
        o.classList.toggle('is-selected', sel);
        o.setAttribute('aria-selected', sel ? 'true' : 'false');
      });
      patternTriggerName.textContent = getPatternName();
      patternTriggerBlurb.textContent = getPatternBlurb();
      closePatternPanel();
      // Auto-preview the new pattern with the current scale + length.
      playSimulation(getSelectedSoundId(), parseInt(simLength.value, 10));
    });
  });
  // Click anywhere else inside the modal closes the panel.
  overlay.addEventListener('click', (e) => {
    if (!patternPanel.hidden && !patternPanel.contains(e.target) && e.target !== patternTrigger && !patternTrigger.contains(e.target)) {
      closePatternPanel();
    }
  });

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

function formatSigned(v) {
  if (v === 0) return '0';
  return v > 0 ? `+${v}` : `${v}`;
}

function getPatternBlurb() {
  const id = getSelectedPatternId();
  const p = PATTERNS.find(x => x.id === id);
  return p ? p.blurb : '';
}

function getPatternName() {
  const id = getSelectedPatternId();
  const p = PATTERNS.find(x => x.id === id);
  return p ? p.name : '';
}

// Render a compact line+dot sparkline of how `pattern` traverses a 10-note
// scale over its first 12 cells. Strokes use `currentColor` so the line
// inherits the tile's text color (faded when idle, bright when selected).
function patternSparkline(pattern, points = 12, n = 10) {
  const steps = [];
  for (let i = 0; i < points; i++) steps.push(pattern.step(i, n));
  const min = Math.min.apply(null, steps);
  const max = Math.max.apply(null, steps);
  const range = Math.max(1, max - min);
  const w = 100, h = 22, pad = 2;
  const xs = (i) => pad + (i / (points - 1)) * (w - 2 * pad);
  const ys = (v) => h - pad - ((v - min) / range) * (h - 2 * pad);
  let line = `M${xs(0).toFixed(1)} ${ys(steps[0]).toFixed(1)}`;
  let dots = '';
  for (let i = 0; i < points; i++) {
    if (i > 0) line += ` L${xs(i).toFixed(1)} ${ys(steps[i]).toFixed(1)}`;
    dots += `<circle cx="${xs(i).toFixed(1)}" cy="${ys(steps[i]).toFixed(1)}" r="1.4" fill="currentColor"/>`;
  }
  return `<svg class="pattern-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${line}" fill="none" stroke="currentColor" stroke-width="0.8" stroke-opacity="0.55" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
  </svg>`;
}
