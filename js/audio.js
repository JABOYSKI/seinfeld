// Synthesized mallet notes (xylophone / marimba) for chain animations.
// Web Audio API — no audio files to host. Lazy-initialized on first use to
// comply with browser autoplay policies (an AudioContext created or resumed
// after a user gesture is allowed; before a gesture it's blocked).

let ctx = null;
let masterGain = null;

function ensureCtx() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.4;
    masterGain.connect(ctx.destination);
  }
  // Browser may suspend the context (tab backgrounded etc.) — kick it.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// 10 scales of single-octave-ish ascending pitches in Hz. The cascade index
// indexes into the array; we clamp to the last note for chains longer than
// the scale.
//
// Picked for distinct moods at a glance:
//   - Major Pentatonic: bright, optimistic (no half-steps)
//   - Minor Pentatonic: bluesy, soulful
//   - Lydian: dreamy / floating (raised 4th)
//   - Mixolydian: folky / mellow (flat 7)
//   - Whole Tone: suspended, no resolution
//   - Hirajōshi: Japanese — meditative, Eastern
//   - Wind Chime: random-feeling high pitches
//   - Music Box: even higher chime tones
//   - Marimba Low: warm low fundamentals
//   - Gamelan: Indonesian-flavored intervals
export const SCALES = [
  { id: 'off',         name: 'Off',                blurb: 'Silent', notes: null },
  { id: 'maj-pent',    name: 'Major Pentatonic',   blurb: 'Bright, optimistic', notes: [262, 294, 330, 392, 440, 523, 587, 659, 784, 880] },
  { id: 'min-pent',    name: 'Minor Pentatonic',   blurb: 'Bluesy, soulful',    notes: [262, 311, 349, 392, 466, 523, 622, 698, 784, 932] },
  { id: 'lydian',      name: 'Lydian',             blurb: 'Floating, dreamy',   notes: [262, 294, 330, 370, 392, 440, 494, 523, 587, 659] },
  { id: 'mixolydian',  name: 'Mixolydian',         blurb: 'Folk, mellow',       notes: [262, 294, 330, 349, 392, 440, 466, 523, 587, 659] },
  { id: 'whole-tone',  name: 'Whole Tone',         blurb: 'Suspended, ethereal',notes: [262, 294, 330, 370, 415, 466, 523, 587, 659, 740] },
  { id: 'hirajoshi',   name: 'Hirajōshi',          blurb: 'Japanese, meditative', notes: [262, 277, 349, 392, 415, 523, 554, 698, 784, 831] },
  { id: 'wind-chime',  name: 'Wind Chime',         blurb: 'Sparkly highs',      notes: [523, 587, 698, 784, 932, 1047, 1175, 1397, 1568, 1760] },
  { id: 'music-box',   name: 'Music Box',          blurb: 'Tiny, twinkly',      notes: [880, 988, 1175, 1319, 1480, 1760, 1976, 2349, 2637, 2960] },
  { id: 'marimba-low', name: 'Marimba Low',        blurb: 'Warm, woody',        notes: [131, 147, 165, 196, 220, 262, 294, 330, 392, 440] },
  { id: 'gamelan',     name: 'Gamelan',            blurb: 'Indonesian metal',   notes: [262, 311, 349, 415, 466, 523, 622, 698, 831, 932] },
];

export const DEFAULT_SOUND_ID = 'off';
const STORAGE_KEY = 'seinfeld_sound_scale';
const VALID_IDS = new Set(SCALES.map(s => s.id));

export function getSelectedSoundId() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return VALID_IDS.has(saved) ? saved : DEFAULT_SOUND_ID;
}
export function setSelectedSoundId(id) {
  if (!VALID_IDS.has(id)) return false;
  localStorage.setItem(STORAGE_KEY, id);
  return true;
}
export function getCurrentScale() {
  return SCALES.find(s => s.id === getSelectedSoundId());
}
export function isSoundEnabled() {
  const s = getCurrentScale();
  return !!(s && s.notes);
}

// One mallet hit. The fast attack + exponential decay is what makes it sound
// like a bar being struck rather than a sustained organ note. A second
// oscillator two octaves up adds the bright transient that distinguishes
// mallets from a pure sine.
function playMalletNote(freq, opts = {}) {
  const c = ensureCtx();
  if (!c) return;
  const { duration = 0.6, gain = 0.5, when = 0 } = opts;
  const t = c.currentTime + when;

  const osc1 = c.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = freq;

  const osc2 = c.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = freq * 4;  // 2nd-octave harmonic

  const env1 = c.createGain();
  env1.gain.setValueAtTime(0.0001, t);
  env1.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  env1.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  const env2 = c.createGain();
  env2.gain.setValueAtTime(0.0001, t);
  env2.gain.exponentialRampToValueAtTime(gain * 0.18, t + 0.004);
  env2.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.35);

  osc1.connect(env1).connect(masterGain);
  osc2.connect(env2).connect(masterGain);

  osc1.start(t);
  osc1.stop(t + duration + 0.05);
  osc2.start(t);
  osc2.stop(t + duration * 0.4 + 0.05);
}

// Play a single ascending note at the given step index. Used by chain
// animations to fire one note per cell, called inside the same setTimeout
// that pulses the cell — perfect visual/audio sync.
export function playNoteAt(index, opts = {}) {
  const scale = getCurrentScale();
  if (!scale || !scale.notes) return;
  const notes = scale.notes;
  const idx = Math.min(Math.max(0, index), notes.length - 1);
  const { gain = 0.42 + Math.min(idx, 8) * 0.018, duration = 0.7 } = opts;
  playMalletNote(notes[idx], { gain, duration });
}

// All cells pulse simultaneously — play a brief stacked-note chord.
export function playChord(count) {
  const scale = getCurrentScale();
  if (!scale || !scale.notes) return;
  const n = Math.min(count, scale.notes.length);
  for (let i = 0; i < n; i++) {
    playMalletNote(scale.notes[i], { gain: 0.42 / Math.sqrt(n), duration: 0.75 });
  }
}

// Single bright impact note (for shockwave / fireworks / starburst etc.)
export function playBurst() {
  const scale = getCurrentScale();
  if (!scale || !scale.notes) return;
  // Mid-high of the scale, louder than a normal step
  const note = scale.notes[Math.min(5, scale.notes.length - 1)];
  playMalletNote(note, { gain: 0.65, duration: 0.85 });
}

// Quick ascending arpeggio for picker previews.
export function playPreview(scaleId) {
  const scale = SCALES.find(s => s.id === scaleId);
  if (!scale || !scale.notes) return;
  const c = ensureCtx();
  if (!c) return;
  const steps = Math.min(5, scale.notes.length);
  for (let i = 0; i < steps; i++) {
    playMalletNote(scale.notes[i], {
      when: i * 0.08,
      gain: 0.45,
      duration: 0.5,
    });
  }
}
