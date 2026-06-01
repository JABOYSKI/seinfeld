// Picker modal for chain-build sounds.
//
// Layout:
//   - Simulator (length / octave / pitch sliders + Play)
//   - Per-habit pattern queue editor: tab strip across habits, then a chip
//     bar for the selected habit's queue. Each chip is one (pattern, scale)
//     pair; "+ Add" opens the pattern panel — clicking a pattern pushes a
//     new entry into the queue that captures whatever scale is currently
//     selected in the grid below. So workflow is: pick scale, click pattern,
//     repeat with a different scale, etc.
//   - Scale grid (the global default sound — used as the per-entry scale
//     when adding new queue entries, and as fallback for habits with no
//     queue at all).
import {
  SCALES, getSelectedSoundId, setSelectedSoundId, playSimulation,
  getOctaveShift, setOctaveShift, OCTAVE_RANGE,
  getPitchShift, setPitchShift, PITCH_RANGE,
  PATTERNS, MAX_PATTERN_QUEUE, PATTERN_QUEUE_SECTION,
  MIN_SECTION_LENGTH, MAX_SECTION_LENGTH,
  getPatternQueue, addToPatternQueue, removeFromPatternQueue, clearPatternQueue,
  updateQueueEntry, playPatternPreview,
} from './audio.js';

export function openSoundPicker(habits, initialHabitId, onSelected) {
  const currentScaleId = getSelectedSoundId();
  // The habit whose queue is currently being edited inside the picker. If
  // the caller didn't pass an initial habit (e.g. no habits exist yet),
  // fall back to the first habit available; if there are none, leave null
  // and the queue UI will show a friendly empty state.
  const realHabits = Array.isArray(habits) ? habits : [];
  let editingHabitId = (initialHabitId && realHabits.some(h => h.id === initialHabitId))
    ? initialHabitId
    : (realHabits[0]?.id || null);

  const overlay = document.createElement('div');
  overlay.className = 'overlay overlay-picker';
  overlay.innerHTML = `
    <div class="dialog dialog-picker dialog-sound-picker" role="dialog" aria-modal="true" aria-label="Choose chain sound">
      <div class="picker-header">
        <h2>Chain sound</h2>
        <p class="picker-sub">Each habit has its own queue of (pattern, scale) pairs the chain rotates through.</p>
      </div>

      <div class="sound-simulator">
        <label class="sim-label" for="simLength">Simulate chain length</label>
        <div class="sim-row">
          <input type="range" id="simLength" min="2" max="256" value="16" />
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
          Queue for
          <span class="queue-habit-tabs" id="queueHabitTabs"></span>
          <span class="queue-count" id="queueCount">0/${MAX_PATTERN_QUEUE}</span>
          <button type="button" class="queue-clear-link" id="queueClear" title="Clear this habit's queue">Clear</button>
        </label>
        <div class="sim-row pattern-row">
          <div class="pattern-picker-wrap">
            <div class="pattern-queue-bar" id="patternQueueBar"></div>
            <div class="pattern-picker-panel" id="patternPanel" role="listbox" hidden>
              <div class="pattern-panel-header">
                <span class="pattern-panel-title">Add a pattern</span>
                <span class="pattern-panel-hint">Pairs with the scale you've selected below</span>
                <label class="dbl-add-toggle" title="When on, clicking an already-armed pattern commits it to the queue (skip the Add button)">
                  <input type="checkbox" id="dblAddToggle" />
                  <span>Double-click to add</span>
                </label>
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
              <div class="pattern-confirm-bar" id="patternConfirmBar" hidden>
                <span class="pcb-label">Add</span>
                <span class="pcb-pattern" id="pcbPattern"></span>
                <span class="pcb-sep">with</span>
                <span class="pcb-scale" id="pcbScale"></span>
                <span class="pcb-actions">
                  <button type="button" class="pcb-cancel" id="pcbCancel">Cancel</button>
                  <button type="button" class="pcb-add btn-primary" id="pcbAdd">Add to queue</button>
                </span>
              </div>
            </div>
          </div>
        </div>
        <p class="sim-hint">
          Each entry plays for ${PATTERN_QUEUE_SECTION} cells, then the next.
          Up to ${MAX_PATTERN_QUEUE} entries (≈5 years of daily plays).
        </p>
      </div>

      <div class="chip-editor" id="chipEditor" hidden role="dialog" aria-label="Edit queue step">
        <div class="ce-head">
          <span class="ce-title">Step <span id="ceStepNum">1</span></span>
          <span class="ce-meta" id="ceMeta">Pattern · Scale</span>
          <button type="button" class="ce-close" id="ceClose" aria-label="Close">×</button>
        </div>
        <div class="ce-row">
          <label for="cePattern">Pattern</label>
          <select id="cePattern" class="ce-select">
            ${PATTERNS.map(p => `<option value="${p.id}">${escapeHTML(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="ce-row">
          <label for="ceScale">Sound</label>
          <select id="ceScale" class="ce-select">
            <option value="">Default (global)</option>
            ${SCALES.map(s => `<option value="${s.id}">${escapeHTML(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="ce-row">
          <label for="ceOctave">Octave shift</label>
          <input type="range" id="ceOctave" min="${OCTAVE_RANGE.min}" max="${OCTAVE_RANGE.max}" step="1" value="0" />
          <span class="ce-value" id="ceOctaveValue">0</span>
        </div>
        <div class="ce-row">
          <label for="cePitch">Pitch (semitones)</label>
          <input type="range" id="cePitch" min="${PITCH_RANGE.min}" max="${PITCH_RANGE.max}" step="1" value="0" />
          <span class="ce-value" id="cePitchValue">0</span>
        </div>
        <div class="ce-row">
          <label for="ceTones">Tones (cells)</label>
          <input type="range" id="ceTones" min="${MIN_SECTION_LENGTH}" max="${MAX_SECTION_LENGTH}" step="1" value="${PATTERN_QUEUE_SECTION}" />
          <span class="ce-value" id="ceTonesValue">${PATTERN_QUEUE_SECTION}</span>
        </div>
        <div class="ce-actions">
          <button type="button" class="ce-reset" id="ceReset">Reset to defaults</button>
          <button type="button" class="ce-done btn-primary" id="ceDone">Done</button>
        </div>
      </div>

      <div class="picker-grid picker-grid-sound" id="soundPickerGrid">
        ${SCALES.map(s => `
          <button type="button"
                  class="picker-tile sound-tile ${s.id === currentScaleId ? 'is-selected' : ''}"
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
  const queueHabitTabs = overlay.querySelector('#queueHabitTabs');
  const patternPanel = overlay.querySelector('#patternPanel');

  simLength.addEventListener('input', () => { simValue.textContent = simLength.value; });

  simOctave.addEventListener('input', () => {
    const v = setOctaveShift(parseInt(simOctave.value, 10));
    simOctaveValue.textContent = formatSigned(v);
  });

  simPitch.addEventListener('input', () => {
    const v = setPitchShift(parseInt(simPitch.value, 10));
    simPitchValue.textContent = formatSigned(v);
  });

  // ----- pattern queue (per-habit) -----

  // Positions the (fixed) pattern panel relative to the trigger each time
  // it opens and on viewport resize. Opens in the direction with more
  // available space and constrains max-height to EXACTLY that space (no
  // floor) so the panel can never extend past the viewport edge even when
  // both above/below are tight. The confirm bar / Add button stay pinned
  // because the inner grid scrolls within the panel.
  const positionPanel = () => {
    if (patternPanel.hidden) return;
    const trigger = overlay.querySelector('#patternTrigger');
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const margin = 10;
    const gap = 6;
    const panelW = Math.min(380, vw - 2 * margin);
    patternPanel.style.width = `${panelW}px`;
    let left = r.left;
    if (left + panelW + margin > vw) left = vw - panelW - margin;
    if (left < margin) left = margin;
    patternPanel.style.left = `${left}px`;
    const spaceBelow = Math.max(0, vh - r.bottom - margin - gap);
    const spaceAbove = Math.max(0, r.top - margin - gap);
    if (spaceBelow >= spaceAbove) {
      patternPanel.style.top = `${r.bottom + gap}px`;
      patternPanel.style.bottom = 'auto';
      patternPanel.style.maxHeight = `${spaceBelow}px`;
    } else {
      patternPanel.style.top = 'auto';
      patternPanel.style.bottom = `${vh - r.top + gap}px`;
      patternPanel.style.maxHeight = `${spaceAbove}px`;
    }
  };

  const closePatternPanel = () => {
    patternPanel.hidden = true;
    const trigger = overlay.querySelector('#patternTrigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    // Always drop any pending arm so reopening starts fresh.
    if (typeof disarm === 'function') disarm();
  };
  const openPatternPanel = () => {
    if (!editingHabitId) return; // no habit to add to
    patternPanel.hidden = false;
    const trigger = overlay.querySelector('#patternTrigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    positionPanel();
  };

  const onResize = () => {
    positionPanel();
    if (!chipEditor || chipEditor.hidden) return;
    const chip = queueBar.querySelector(`.pattern-queue-chip[data-index="${editingChipIndex}"]`);
    positionChipEditor(chip ? chip.getBoundingClientRect() : null);
  };
  window.addEventListener('resize', onResize);

  const previewSim = () => {
    playSimulation(parseInt(simLength.value, 10), editingHabitId);
  };

  const renderHabitTabs = () => {
    if (realHabits.length === 0) {
      queueHabitTabs.innerHTML = `<span class="queue-no-habits">— create a habit to set up a queue —</span>`;
      return;
    }
    queueHabitTabs.innerHTML = realHabits.map(h => `
      <button type="button"
              class="queue-habit-tab ${h.id === editingHabitId ? 'is-active' : ''}"
              data-habit="${h.id}"
              title="${escapeAttr(h.name)}"
              style="--qh-color:${h.color}">
        <span class="qh-dot"></span>
        <span class="qh-name">${escapeHTML(h.name)}</span>
      </button>
    `).join('');
    queueHabitTabs.querySelectorAll('.queue-habit-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = tab.dataset.habit;
        if (id === editingHabitId) return;
        editingHabitId = id;
        if (typeof disarm === 'function') disarm();
        renderHabitTabs();
        renderQueueChips();
        closePatternPanel();
      });
    });
  };

  const renderQueueChips = () => {
    const q = editingHabitId ? getPatternQueue(editingHabitId) : [];
    const chips = q.map((entry, idx) => {
      const p = PATTERNS.find(x => x.id === entry.pattern);
      const s = entry.scale ? SCALES.find(x => x.id === entry.scale) : null;
      const scaleLabel = s ? s.name : 'default';
      const scaleClass = s ? 'has-scale' : 'no-scale';
      return `
        <span class="pattern-queue-chip ${scaleClass}" data-index="${idx}" title="${p ? p.name : '?'} · ${scaleLabel}">
          <span class="chip-num">${idx + 1}</span>
          <span class="chip-body">
            <span class="chip-pattern">${p ? escapeHTML(p.name) : '?'}</span>
            <span class="chip-scale">${escapeHTML(scaleLabel)}</span>
          </span>
          <button type="button" class="chip-remove" data-index="${idx}" aria-label="Remove from queue" tabindex="-1">×</button>
        </span>
      `;
    }).join('');
    const isFull = q.length >= MAX_PATTERN_QUEUE;
    const isEmpty = q.length === 0;
    const disabledReason = !editingHabitId
      ? 'disabled title="Create a habit first"'
      : isFull
        ? 'disabled title="Queue full"'
        : 'title="Add pattern using the currently selected scale"';
    const trigger = `
      <button type="button"
              class="pattern-queue-add"
              id="patternTrigger"
              aria-haspopup="listbox"
              aria-expanded="${patternPanel.hidden ? 'false' : 'true'}"
              ${disabledReason}>
        <span class="add-plus">+</span>${isEmpty ? '<span class="add-label">Add pattern</span>' : ''}
      </button>
    `;
    queueBar.innerHTML = chips + trigger;
    queueCount.textContent = `${q.length}/${MAX_PATTERN_QUEUE}`;
    queueBar.classList.toggle('is-empty', isEmpty);

    queueBar.querySelectorAll('.chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!editingHabitId) return;
        const idx = parseInt(btn.dataset.index, 10);
        removeFromPatternQueue(editingHabitId, idx);
        closeChipEditor();
        renderQueueChips();
        previewSim();
      });
    });
    // Clicking the chip body (not the × button) opens the per-step editor.
    queueBar.querySelectorAll('.pattern-queue-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (e.target.closest('.chip-remove')) return;
        e.stopPropagation();
        if (!editingHabitId) return;
        openChipEditor(parseInt(chip.dataset.index, 10), chip);
      });
    });
    const trig = queueBar.querySelector('#patternTrigger');
    if (trig) {
      trig.addEventListener('click', (e) => {
        e.stopPropagation();
        if (trig.disabled) return;
        if (patternPanel.hidden) openPatternPanel(); else closePatternPanel();
      });
    }
  };

  // Initial render
  renderHabitTabs();
  renderQueueChips();

  // Clicking a panel option ARMS it for confirmation instead of adding
  // straight away — prevents the "click click click oh no I added three"
  // problem. The confirm bar at the bottom of the panel shows the armed
  // pattern + the scale it will be paired with; clicking "Add to queue"
  // (or pressing Enter) commits, clicking "Cancel" (or Escape, or another
  // pattern) re-arms or dismisses.
  let armedPatternId = null;
  const confirmBar = overlay.querySelector('#patternConfirmBar');
  const pcbPattern = overlay.querySelector('#pcbPattern');
  const pcbScale = overlay.querySelector('#pcbScale');
  const pcbAdd = overlay.querySelector('#pcbAdd');
  const pcbCancel = overlay.querySelector('#pcbCancel');

  const updateConfirmBar = () => {
    if (!armedPatternId) {
      confirmBar.hidden = true;
      return;
    }
    const p = PATTERNS.find(x => x.id === armedPatternId);
    const s = SCALES.find(x => x.id === getSelectedSoundId());
    pcbPattern.textContent = p ? p.name : '?';
    pcbScale.textContent = s ? s.name : 'default';
    const queueLen = editingHabitId ? getPatternQueue(editingHabitId).length : 0;
    const full = queueLen >= MAX_PATTERN_QUEUE || !editingHabitId;
    pcbAdd.disabled = full;
    pcbAdd.title = full ? (!editingHabitId ? 'Pick a habit first' : 'Queue full') : 'Commit to queue';
    confirmBar.hidden = false;
  };

  const previewArmed = () => {
    if (!armedPatternId) return;
    playPatternPreview(armedPatternId, getSelectedSoundId(), PATTERN_QUEUE_SECTION);
  };
  const armPattern = (id) => {
    armedPatternId = id;
    patternPanel.querySelectorAll('.pattern-option').forEach(opt => {
      opt.classList.toggle('is-armed', opt.dataset.pattern === id);
    });
    updateConfirmBar();
    // Click = audition. Only the explicit Add button commits to queue.
    previewArmed();
  };
  const disarm = () => {
    armedPatternId = null;
    patternPanel.querySelectorAll('.pattern-option').forEach(opt => {
      opt.classList.remove('is-armed');
    });
    updateConfirmBar();
  };
  const commitArmed = () => {
    if (!armedPatternId || !editingHabitId) return;
    const scaleId = getSelectedSoundId();
    const before = getPatternQueue(editingHabitId).length;
    const after = addToPatternQueue(editingHabitId, { pattern: armedPatternId, scale: scaleId }).length;
    if (after === before) return;
    disarm();
    renderQueueChips();
    previewSim();
    if (after >= MAX_PATTERN_QUEUE) closePatternPanel();
  };

  // Opt-in shortcut: clicking an already-armed pattern can commit it
  // directly (skipping the Add button). Off by default — the explicit Add
  // button is the only way to land an entry in the queue unless the user
  // turns this on.
  const DBL_ADD_STORAGE_KEY = 'seinfeld_sound_dblclick_add';
  const dblAddToggle = overlay.querySelector('#dblAddToggle');
  dblAddToggle.checked = localStorage.getItem(DBL_ADD_STORAGE_KEY) === 'true';
  dblAddToggle.addEventListener('change', () => {
    localStorage.setItem(DBL_ADD_STORAGE_KEY, dblAddToggle.checked ? 'true' : 'false');
  });

  patternPanel.querySelectorAll('.pattern-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!editingHabitId) return;
      const patternId = opt.dataset.pattern;
      // Re-click on the armed pattern: commit only if the user has opted
      // into double-click-to-add; otherwise just re-audition.
      if (armedPatternId === patternId) {
        if (dblAddToggle.checked) commitArmed();
        else previewArmed();
        return;
      }
      armPattern(patternId);
    });
  });
  pcbAdd.addEventListener('click', (e) => { e.stopPropagation(); commitArmed(); });
  pcbCancel.addEventListener('click', (e) => { e.stopPropagation(); disarm(); });

  overlay.querySelector('#queueClear').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!editingHabitId) return;
    clearPatternQueue(editingHabitId);
    renderQueueChips();
    previewSim();
  });

  // Click anywhere outside panel + trigger → close panel.
  overlay.addEventListener('click', (e) => {
    if (patternPanel.hidden) return;
    if (patternPanel.contains(e.target)) return;
    const trigger = overlay.querySelector('#patternTrigger');
    if (trigger && (e.target === trigger || trigger.contains(e.target))) return;
    closePatternPanel();
  });

  // ----- per-chip editor -----
  //
  // Click a queue chip → opens a popover anchored near the chip. Sliders
  // override that single entry's octave shift, pitch shift, and section
  // length (how many cells this entry plays for); a Reset button drops
  // the per-entry overrides so the entry falls back to the global
  // sliders. Changes auto-save + auto-preview the queue.
  const chipEditor = overlay.querySelector('#chipEditor');
  const ceStepNum = overlay.querySelector('#ceStepNum');
  const ceMeta = overlay.querySelector('#ceMeta');
  const ceOctave = overlay.querySelector('#ceOctave');
  const ceOctaveValue = overlay.querySelector('#ceOctaveValue');
  const cePitch = overlay.querySelector('#cePitch');
  const cePitchValue = overlay.querySelector('#cePitchValue');
  const ceTones = overlay.querySelector('#ceTones');
  const ceTonesValue = overlay.querySelector('#ceTonesValue');
  const ceReset = overlay.querySelector('#ceReset');
  const ceDone = overlay.querySelector('#ceDone');
  const ceClose = overlay.querySelector('#ceClose');
  const cePattern = overlay.querySelector('#cePattern');
  const ceScale = overlay.querySelector('#ceScale');
  let editingChipIndex = -1;

  const positionChipEditor = (anchorRect) => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const margin = 10;
    const gap = 6;
    const w = Math.min(320, vw - 2 * margin);
    chipEditor.style.width = `${w}px`;
    let left = anchorRect ? anchorRect.left : (vw - w) / 2;
    if (left + w + margin > vw) left = vw - w - margin;
    if (left < margin) left = margin;
    chipEditor.style.left = `${left}px`;
    const refTop = anchorRect ? anchorRect.bottom : vh / 2;
    const refBottom = anchorRect ? anchorRect.top : vh / 2;
    const spaceBelow = Math.max(0, vh - refTop - margin - gap);
    const spaceAbove = Math.max(0, refBottom - margin - gap);
    if (spaceBelow >= spaceAbove) {
      chipEditor.style.top = `${refTop + gap}px`;
      chipEditor.style.bottom = 'auto';
      chipEditor.style.maxHeight = `${spaceBelow}px`;
    } else {
      chipEditor.style.top = 'auto';
      chipEditor.style.bottom = `${vh - refBottom + gap}px`;
      chipEditor.style.maxHeight = `${spaceAbove}px`;
    }
  };

  const openChipEditor = (idx, anchorEl) => {
    if (!editingHabitId) return;
    const q = getPatternQueue(editingHabitId);
    if (idx < 0 || idx >= q.length) return;
    const entry = q[idx];
    editingChipIndex = idx;
    const p = PATTERNS.find(x => x.id === entry.pattern);
    const s = entry.scale ? SCALES.find(x => x.id === entry.scale) : null;
    ceStepNum.textContent = String(idx + 1);
    ceMeta.textContent = `${p ? p.name : '?'} · ${s ? s.name : 'default'}`;
    cePattern.value = entry.pattern;
    ceScale.value = entry.scale || '';
    ceOctave.value = (typeof entry.octaveShift === 'number') ? entry.octaveShift : getOctaveShift();
    cePitch.value = (typeof entry.pitchShift === 'number') ? entry.pitchShift : getPitchShift();
    ceTones.value = entry.sectionLength || PATTERN_QUEUE_SECTION;
    ceOctaveValue.textContent = formatSigned(parseInt(ceOctave.value, 10));
    cePitchValue.textContent = formatSigned(parseInt(cePitch.value, 10));
    ceTonesValue.textContent = ceTones.value;
    chipEditor.hidden = false;
    positionChipEditor(anchorEl ? anchorEl.getBoundingClientRect() : null);
    // Visually mark the chip being edited.
    queueBar.querySelectorAll('.pattern-queue-chip').forEach(c => {
      c.classList.toggle('is-editing', parseInt(c.dataset.index, 10) === idx);
    });
  };
  const closeChipEditor = () => {
    chipEditor.hidden = true;
    editingChipIndex = -1;
    queueBar.querySelectorAll('.pattern-queue-chip').forEach(c => c.classList.remove('is-editing'));
  };

  const applyChipChange = (updates) => {
    if (editingChipIndex < 0 || !editingHabitId) return;
    updateQueueEntry(editingHabitId, editingChipIndex, updates);
    renderQueueChips();
    // re-mark editing chip (renderQueueChips wipes classes)
    const chip = queueBar.querySelector(`.pattern-queue-chip[data-index="${editingChipIndex}"]`);
    if (chip) chip.classList.add('is-editing');
    previewSim();
  };

  ceOctave.addEventListener('input', () => {
    const v = parseInt(ceOctave.value, 10);
    ceOctaveValue.textContent = formatSigned(v);
    applyChipChange({ octaveShift: v });
  });
  cePitch.addEventListener('input', () => {
    const v = parseInt(cePitch.value, 10);
    cePitchValue.textContent = formatSigned(v);
    applyChipChange({ pitchShift: v });
  });
  ceTones.addEventListener('input', () => {
    const v = parseInt(ceTones.value, 10);
    ceTonesValue.textContent = String(v);
    applyChipChange({ sectionLength: v });
  });
  // Change this step's pattern / sound in place. The chip relabels + the queue
  // re-previews so the edit is immediately audible.
  const refreshCeMeta = () => {
    const p = PATTERNS.find(x => x.id === cePattern.value);
    const s = ceScale.value ? SCALES.find(x => x.id === ceScale.value) : null;
    ceMeta.textContent = `${p ? p.name : '?'} · ${s ? s.name : 'default'}`;
  };
  cePattern.addEventListener('change', () => {
    applyChipChange({ pattern: cePattern.value });
    refreshCeMeta();
  });
  ceScale.addEventListener('change', () => {
    applyChipChange({ scale: ceScale.value || null });
    refreshCeMeta();
  });
  ceReset.addEventListener('click', (e) => {
    e.stopPropagation();
    applyChipChange({ octaveShift: undefined, pitchShift: undefined, sectionLength: undefined });
    // Reflect the cleared (global-default) values back into the sliders.
    ceOctave.value = getOctaveShift();
    cePitch.value = getPitchShift();
    ceTones.value = PATTERN_QUEUE_SECTION;
    ceOctaveValue.textContent = formatSigned(parseInt(ceOctave.value, 10));
    cePitchValue.textContent = formatSigned(parseInt(cePitch.value, 10));
    ceTonesValue.textContent = ceTones.value;
  });
  ceDone.addEventListener('click', (e) => { e.stopPropagation(); closeChipEditor(); });
  ceClose.addEventListener('click', (e) => { e.stopPropagation(); closeChipEditor(); });

  // Click outside chip editor closes it (but clicks inside the editor or
  // on another chip don't — clicking another chip will reopen for that
  // chip via the chip click handler).
  overlay.addEventListener('click', (e) => {
    if (chipEditor.hidden) return;
    if (chipEditor.contains(e.target)) return;
    if (e.target.closest('.pattern-queue-chip')) return;
    closeChipEditor();
  });

  // ----- simulator + scales -----

  simPlay.addEventListener('click', previewSim);

  grid.querySelectorAll('.sound-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const id = tile.dataset.sound;
      setSelectedSoundId(id);
      grid.querySelectorAll('.sound-tile').forEach(t => t.classList.toggle('is-selected', t === tile));
      // If a pattern is currently armed for confirmation, refresh the bar
      // + re-audition the armed pattern with this new scale so the user
      // can hear the combo they're about to commit. Otherwise, play the
      // full queue so the scale change is audible in context.
      updateConfirmBar();
      if (armedPatternId) previewArmed();
      else previewSim();
      if (onSelected) onSelected(id);
    });
  });

  const close = () => {
    window.removeEventListener('resize', onResize);
    overlay.remove();
  };
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

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s) { return escapeHTML(s); }

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
