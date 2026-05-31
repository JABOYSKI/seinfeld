// Picker modal for chain-build sounds. The simulator at the top lets you
// preview at any chain length; the pattern queue below it lets you stitch
// up to MAX_PATTERN_QUEUE patterns into a sequence that the chain rotates
// through (PATTERN_QUEUE_SECTION cells per pattern).
import {
  SCALES, getSelectedSoundId, setSelectedSoundId, playSimulation,
  getOctaveShift, setOctaveShift, OCTAVE_RANGE,
  getPitchShift, setPitchShift, PITCH_RANGE,
  PATTERNS, MAX_PATTERN_QUEUE, PATTERN_QUEUE_SECTION,
  getPatternQueue, addToPatternQueue, removeFromPatternQueue, clearPatternQueue,
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
          <input type="range" id="simLength" min="2" max="128" value="16" />
          <span class="sim-value" id="simLengthValue">16</span>
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
        <label class="sim-label">
          Pattern queue
          <span class="queue-count" id="queueCount">0/${MAX_PATTERN_QUEUE}</span>
          <button type="button" class="queue-clear-link" id="queueClear" title="Clear queue">Clear</button>
        </label>
        <div class="sim-row pattern-row">
          <div class="pattern-picker-wrap">
            <div class="pattern-queue-bar" id="patternQueueBar"></div>
            <div class="pattern-picker-panel" id="patternPanel" role="listbox" hidden>
              <div class="pattern-panel-header">
                <span class="pattern-panel-title">Add to queue</span>
                <span class="pattern-panel-hint">Click to add — sparkline shows note order</span>
              </div>
              <div class="pattern-grid">
                ${PATTERNS.map(p => `
                  <button type="button"
                          class="pattern-option"
                          data-pattern="${p.id}"
                          role="option"
                          title="${p.blurb}">
                    <span class="pattern-option-name">${p.name}</span>
                    ${patternSparkline(p)}
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
        <p class="sim-hint">Each queued pattern plays for ${PATTERN_QUEUE_SECTION} cells, then the next.</p>
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
  const queueBar = overlay.querySelector('#patternQueueBar');
  const queueCount = overlay.querySelector('#queueCount');
  const patternPanel = overlay.querySelector('#patternPanel');
  const wrap = overlay.querySelector('.pattern-picker-wrap');

  simLength.addEventListener('input', () => { simValue.textContent = simLength.value; });

  simOctave.addEventListener('input', () => {
    const v = setOctaveShift(parseInt(simOctave.value, 10));
    simOctaveValue.textContent = formatSigned(v);
  });

  simPitch.addEventListener('input', () => {
    const v = setPitchShift(parseInt(simPitch.value, 10));
    simPitchValue.textContent = formatSigned(v);
  });

  // ----- pattern queue -----

  const closePatternPanel = () => {
    patternPanel.hidden = true;
    const trigger = overlay.querySelector('#patternTrigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  };
  const openPatternPanel = () => {
    patternPanel.hidden = false;
    const trigger = overlay.querySelector('#patternTrigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
  };

  const previewSim = () => {
    playSimulation(getSelectedSoundId(), parseInt(simLength.value, 10));
  };

  const renderQueueChips = () => {
    const q = getPatternQueue();
    const chips = q.map((id, idx) => {
      const p = PATTERNS.find(x => x.id === id);
      return `
        <span class="pattern-queue-chip" data-index="${idx}" title="${p ? p.blurb : ''}">
          <span class="chip-num">${idx + 1}</span>
          <span class="chip-name">${p ? p.name : 'Unknown'}</span>
          <button type="button" class="chip-remove" data-index="${idx}" aria-label="Remove from queue" tabindex="-1">×</button>
        </span>
      `;
    }).join('');
    const isFull = q.length >= MAX_PATTERN_QUEUE;
    const isEmpty = q.length === 0;
    const trigger = `
      <button type="button"
              class="pattern-queue-add"
              id="patternTrigger"
              aria-haspopup="listbox"
              aria-expanded="${patternPanel.hidden ? 'false' : 'true'}"
              ${isFull ? 'disabled' : ''}
              title="${isFull ? 'Queue full' : 'Add pattern to queue'}">
        <span class="add-plus">+</span>${isEmpty ? '<span class="add-label">Add pattern</span>' : ''}
      </button>
    `;
    queueBar.innerHTML = chips + trigger;
    queueCount.textContent = `${q.length}/${MAX_PATTERN_QUEUE}`;
    queueBar.classList.toggle('is-empty', isEmpty);

    // Wire the dynamically-created chip removes
    queueBar.querySelectorAll('.chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        removeFromPatternQueue(idx);
        renderQueueChips();
        updatePanelSelection();
        previewSim();
      });
    });
    // Wire the dynamically-created + Add trigger
    const trig = queueBar.querySelector('#patternTrigger');
    if (trig) {
      trig.addEventListener('click', (e) => {
        e.stopPropagation();
        if (trig.disabled) return;
        if (patternPanel.hidden) openPatternPanel(); else closePatternPanel();
      });
    }
  };

  const updatePanelSelection = () => {
    const queued = new Set(getPatternQueue());
    patternPanel.querySelectorAll('.pattern-option').forEach(opt => {
      const inQueue = queued.has(opt.dataset.pattern);
      opt.classList.toggle('is-selected', inQueue);
      opt.setAttribute('aria-selected', inQueue ? 'true' : 'false');
    });
  };

  // Initial render
  renderQueueChips();
  updatePanelSelection();

  // Clicking a panel option ADDS to queue (and keeps the panel open so the
  // user can rapidly build a sequence). The panel auto-closes only when
  // the queue hits its cap.
  patternPanel.querySelectorAll('.pattern-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = opt.dataset.pattern;
      const before = getPatternQueue().length;
      const after = addToPatternQueue(id).length;
      if (after === before) return; // queue full and add rejected
      renderQueueChips();
      updatePanelSelection();
      previewSim();
      if (after >= MAX_PATTERN_QUEUE) closePatternPanel();
    });
  });

  overlay.querySelector('#queueClear').addEventListener('click', (e) => {
    e.stopPropagation();
    clearPatternQueue();
    renderQueueChips();
    updatePanelSelection();
    previewSim();
  });

  // Click anywhere outside the panel and trigger → close panel.
  overlay.addEventListener('click', (e) => {
    if (patternPanel.hidden) return;
    if (patternPanel.contains(e.target)) return;
    const trigger = overlay.querySelector('#patternTrigger');
    if (trigger && (e.target === trigger || trigger.contains(e.target))) return;
    closePatternPanel();
  });

  // ----- simulator + scales -----

  simPlay.addEventListener('click', previewSim);

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
