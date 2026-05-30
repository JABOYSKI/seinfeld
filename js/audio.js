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

  // ----- 15 more, added later -----
  // Western modes
  { id: 'dorian',         name: 'Dorian',           blurb: 'Jazzy minor mode',   notes: [262, 294, 311, 349, 392, 440, 466, 523, 587, 622] },
  { id: 'phrygian-dom',   name: 'Phrygian Dominant',blurb: 'Arabic / Klezmer',   notes: [262, 277, 330, 349, 392, 415, 466, 523, 554, 659] },
  { id: 'harmonic-minor', name: 'Harmonic Minor',   blurb: 'Dramatic, brooding', notes: [262, 294, 311, 349, 392, 415, 494, 523, 587, 622] },
  { id: 'blues',          name: 'Blues',            blurb: 'Bluesy with flat-5', notes: [262, 311, 349, 370, 392, 466, 523, 622, 698, 740] },
  { id: 'major-hepta',    name: 'Major Heptatonic', blurb: 'Full bright scale',  notes: [262, 294, 330, 349, 392, 440, 494, 523, 587, 659] },
  // Eastern flavors
  { id: 'in-sen',         name: 'In Sen',           blurb: 'Japanese, somber',   notes: [262, 277, 349, 392, 466, 523, 554, 698, 784, 932] },
  { id: 'iwato',          name: 'Iwato',            blurb: 'Japanese, dark',     notes: [262, 277, 349, 370, 466, 523, 554, 698, 740, 932] },
  { id: 'hang-drum',      name: 'Hang Drum',        blurb: 'D Hijaz meditative', notes: [294, 349, 392, 440, 523, 587, 698, 784, 880, 1047] },
  // Instrument-flavored register/interval combos
  { id: 'kalimba',        name: 'Kalimba',          blurb: 'Warm thumb piano',   notes: [196, 220, 247, 294, 330, 392, 440, 494, 587, 659] },
  { id: 'celesta',        name: 'Celesta',          blurb: 'Glass crystalline',  notes: [659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093, 2349] },
  { id: 'steel-drum',     name: 'Steel Drum',       blurb: 'Caribbean bright',   notes: [349, 392, 440, 466, 523, 587, 659, 698, 784, 880] },
  { id: 'bell-tower',     name: 'Bell Tower',       blurb: 'Low resonant bells', notes: [ 65,  98, 131, 165, 196, 247, 294, 392, 523, 659] },
  { id: 'cathedral',      name: 'Cathedral',        blurb: 'Deep church bells',  notes: [ 65,  98, 131, 196, 262, 392, 523, 784, 1047, 1568] },
  { id: 'spirit-forest',  name: 'Spirit Forest',    blurb: 'Sparse high bells',  notes: [523, 784, 1047, 1175, 1568, 1760, 2093, 2637, 3136, 3520] },
  { id: 'sci-fi',         name: 'Sci-Fi',           blurb: 'Quartal suspended',  notes: [262, 349, 392, 523, 587, 698, 784, 880, 1047, 1175] },

  // ----- 15 themed scales (synth params dialed in per theme) -----
  // Each one sets a `synth` block that overrides the default mallet timbre.
  // Variety here comes from BOTH the notes (intervals/register) AND the
  // timbre (oscillator type / envelope / harmonic / filter).
  { id: 'underwater',     name: 'Underwater',       blurb: 'Muffled deep tones',
    notes: [131, 147, 165, 196, 220, 262, 294, 330, 392, 440],
    synth: { type: 'sine', duration: 1.4, attack: 0.04, harmonic: 2, harmonicGain: 0.45, filter: 600 } },
  { id: 'crystal-cave',   name: 'Crystal Cave',     blurb: 'Icy sparkle',
    notes: [330, 392, 440, 523, 587, 659, 784, 880, 1047, 1175],
    synth: { type: 'triangle', duration: 0.5, attack: 0.001, harmonic: 4, harmonicGain: 0.32 } },
  { id: 'tibetan-bowls',  name: 'Tibetan Bowls',    blurb: 'Singing bowls',
    notes: [196, 262, 311, 349, 392, 440, 523, 587, 659, 784],
    synth: { type: 'sine', duration: 2.6, attack: 0.1, harmonic: 3, harmonicGain: 0.5, harmonicDecay: 0.6, detune: 4 } },
  { id: 'carnival',       name: 'Carnival',         blurb: 'Playful, bouncy',
    notes: [262, 330, 392, 440, 523, 659, 784, 880, 1047, 1319],
    synth: { type: 'triangle', duration: 0.35, attack: 0.005, harmonic: 2, harmonicGain: 0.25, filter: 4000 } },
  { id: 'haunted',        name: 'Haunted House',    blurb: 'Eerie chromatic',
    notes: [220, 247, 277, 311, 330, 370, 415, 440, 494, 554],
    synth: { type: 'sawtooth', duration: 1.5, attack: 0.02, harmonic: 1.5, harmonicGain: 0.3, filter: 700 } },
  { id: 'aurora',         name: 'Aurora Borealis',  blurb: 'Shimmery, slow',
    notes: [392, 440, 494, 523, 587, 659, 740, 784, 880, 988],
    synth: { type: 'sine', duration: 2.0, attack: 0.15, harmonic: 4, harmonicGain: 0.4, detune: 10 } },
  { id: 'dark-music-box', name: 'Music Box (Dark)', blurb: 'Minor key, creepy',
    notes: [880, 932, 1047, 1109, 1175, 1319, 1397, 1480, 1568, 1760],
    synth: { type: 'triangle', duration: 0.55, attack: 0.002, harmonic: 4, harmonicGain: 0.2 } },
  { id: 'coral-reef',     name: 'Coral Reef',       blurb: 'Bright tropical',
    notes: [440, 494, 587, 659, 784, 880, 988, 1047, 1175, 1319],
    synth: { type: 'triangle', duration: 0.5, attack: 0.003, harmonic: 4, harmonicGain: 0.28 } },
  { id: 'wind-pines',     name: 'Wind Through Pines', blurb: 'Sparse + airy',
    notes: [196, 220, 262, 294, 330, 392, 440, 494, 587, 659],
    synth: { type: 'sine', duration: 1.3, attack: 0.05, harmonic: 3, harmonicGain: 0.4, filter: 1500 } },
  { id: 'steam-punk',     name: 'Steam Punk',       blurb: 'Mechanical brass',
    notes: [196, 220, 247, 294, 330, 392, 440, 494, 587, 659],
    synth: { type: 'sawtooth', duration: 0.45, attack: 0.005, harmonic: 2, harmonicGain: 0.4, filter: 1800 } },
  { id: 'spaceship',      name: 'Spaceship Console',blurb: 'Tech blips',
    notes: [440, 494, 523, 587, 659, 698, 784, 880, 988, 1047],
    synth: { type: 'square', duration: 0.18, attack: 0.001, harmonic: 8, harmonicGain: 0.12, filter: 3000 } },
  { id: 'cosmic-drift',   name: 'Cosmic Drift',     blurb: 'Long open pads',
    notes: [98, 147, 196, 262, 392, 523, 784, 1047, 1568, 2093],
    synth: { type: 'sine', duration: 3.2, attack: 0.2, harmonic: 2, harmonicGain: 0.3 } },
  { id: 'pixie-dust',     name: 'Pixie Dust',       blurb: 'Tiny fairy bells',
    notes: [1568, 1760, 2093, 2349, 2637, 2960, 3136, 3520, 3951, 4186],
    synth: { type: 'sine', duration: 0.3, attack: 0.001, harmonic: 4, harmonicGain: 0.15 } },
  { id: 'thunderclap',    name: 'Thunderclap',      blurb: 'Low rumble',
    notes: [49, 65, 82, 98, 110, 131, 165, 196, 247, 262],
    synth: { type: 'triangle', duration: 1.6, attack: 0.005, harmonic: 2, harmonicGain: 0.35, filter: 400 } },
  { id: 'sunrise',        name: 'Sunrise',          blurb: 'Warm ascending',
    notes: [262, 330, 392, 440, 523, 587, 659, 784, 880, 1047],
    synth: { type: 'triangle', duration: 1.0, attack: 0.03, harmonic: 4, harmonicGain: 0.3 } },
];

export const DEFAULT_SOUND_ID = 'off';
const STORAGE_KEY = 'seinfeld_sound_scale';
const OCTAVE_STORAGE_KEY = 'seinfeld_sound_octave';
const PITCH_STORAGE_KEY = 'seinfeld_sound_pitch';
const VALID_IDS = new Set(SCALES.map(s => s.id));
const MIN_OCTAVE = -4;   // wider downward range so low scales can rumble
const MAX_OCTAVE = 3;
const MIN_PITCH = -12;   // semitones — full octave each way for fine tuning
const MAX_PITCH = 12;

export function getSelectedSoundId() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return VALID_IDS.has(saved) ? saved : DEFAULT_SOUND_ID;
}
export function setSelectedSoundId(id) {
  if (!VALID_IDS.has(id)) return false;
  localStorage.setItem(STORAGE_KEY, id);
  return true;
}
// Octave shift (integer) — multiplies every note frequency by 2^shift.
export function getOctaveShift() {
  const v = parseInt(localStorage.getItem(OCTAVE_STORAGE_KEY), 10);
  if (Number.isNaN(v) || v < MIN_OCTAVE || v > MAX_OCTAVE) return 0;
  return v;
}
export function setOctaveShift(n) {
  const v = Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, Math.round(n)));
  localStorage.setItem(OCTAVE_STORAGE_KEY, String(v));
  return v;
}
// Pitch shift (semitones, integer) — finer than octave shift. Stacks with
// octave shift, so e.g. octave=+1 + pitch=+5 = +17 semitones total.
export function getPitchShift() {
  const v = parseInt(localStorage.getItem(PITCH_STORAGE_KEY), 10);
  if (Number.isNaN(v) || v < MIN_PITCH || v > MAX_PITCH) return 0;
  return v;
}
export function setPitchShift(n) {
  const v = Math.max(MIN_PITCH, Math.min(MAX_PITCH, Math.round(n)));
  localStorage.setItem(PITCH_STORAGE_KEY, String(v));
  return v;
}
export const OCTAVE_RANGE = { min: MIN_OCTAVE, max: MAX_OCTAVE };
export const PITCH_RANGE  = { min: MIN_PITCH,  max: MAX_PITCH };
export function getCurrentScale() {
  return SCALES.find(s => s.id === getSelectedSoundId());
}
export function isSoundEnabled() {
  const s = getCurrentScale();
  return !!(s && s.notes);
}

// One mallet hit. Default is a sine fundamental + soft sine harmonic two
// octaves up — that's a classic xylophone/marimba ping. Themed scales pass
// `synth: {...}` to dial it in to a different timbre: longer decay for
// bells, sawtooth for steampunk, square for spaceship beeps, lowpass
// filter for "underwater" muffling, slow attack for shimmery pads, etc.
function playMalletNote(freq, opts = {}) {
  const c = ensureCtx();
  if (!c) return;
  const {
    duration = 0.6,
    gain = 0.5,
    when = 0,
    type = 'sine',
    attack = 0.004,
    harmonic = 4,           // multiplier on freq for the partial
    harmonicGain = 0.18,    // partial loudness relative to fundamental
    harmonicDecay = 0.35,   // partial decay relative to fundamental duration
    detune = 0,             // cents — slight detune gives shimmer/ensemble
    filter = null,          // lowpass cutoff Hz, null = no filter
  } = opts;
  const t = c.currentTime + when;

  // Build a per-note signal chain. Filter goes between the env and master
  // when requested; otherwise we go straight to master.
  const sink = filter ? (() => {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    f.connect(masterGain);
    return f;
  })() : masterGain;

  const osc1 = c.createOscillator();
  osc1.type = type;
  osc1.frequency.value = freq;
  if (detune) osc1.detune.value = detune;
  const env1 = c.createGain();
  env1.gain.setValueAtTime(0.0001, t);
  env1.gain.exponentialRampToValueAtTime(gain, t + attack);
  env1.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc1.connect(env1).connect(sink);
  osc1.start(t);
  osc1.stop(t + duration + 0.05);

  if (harmonicGain > 0 && harmonic > 0) {
    const osc2 = c.createOscillator();
    osc2.type = type;
    osc2.frequency.value = freq * harmonic;
    if (detune) osc2.detune.value = -detune;
    const env2 = c.createGain();
    env2.gain.setValueAtTime(0.0001, t);
    env2.gain.exponentialRampToValueAtTime(gain * harmonicGain, t + attack);
    env2.gain.exponentialRampToValueAtTime(0.0001, t + duration * harmonicDecay);
    osc2.connect(env2).connect(sink);
    osc2.start(t);
    osc2.stop(t + duration * harmonicDecay + 0.05);
  }
}

// Play a single ascending note at the given step index. Used by chain
// animations to fire one note per cell, called inside the same setTimeout
// that pulses the cell — perfect visual/audio sync.
//
// To keep notes distinct beyond the scale's length, we octave-shift: every
// notes.length steps wraps back to the first note but doubled in frequency.
// Capped at 3 octaves up so the top of a long chain doesn't go ultrasonic.
// How far the chain's auto octave-wrap can climb before repeating —
// computed per-scale so the top of a long cascade stays under ~16 kHz
// (above that it's ultrasonic for most adults). A low scale like Marimba
// Low gets ~5 octaves of distinct cells before wrap; Music Box only ~2
// because it already sits near the top of the audible range. Replaces the
// old hardcoded 3-octave cap that made long chains repeat noticeably.
const AUDIBLE_CEILING_HZ = 16000;
const _maxWrapCache = new WeakMap();
function maxOctaveWrapForScale(scale) {
  if (_maxWrapCache.has(scale)) return _maxWrapCache.get(scale);
  const highest = Math.max.apply(null, scale.notes);
  const max = Math.max(1, Math.floor(Math.log2(AUDIBLE_CEILING_HZ / highest)));
  _maxWrapCache.set(scale, max);
  return max;
}
function freqAt(scale, index) {
  const notes = scale.notes;
  const i = Math.max(0, index);
  const octaveWrap = Math.min(Math.floor(i / notes.length), maxOctaveWrapForScale(scale));
  const noteInOctave = i % notes.length;
  // Combined shift: chain auto-wrap + user's octave slider + pitch slider
  // (semitones converted to a fractional octave).
  const totalOctaves = octaveWrap + getOctaveShift() + getPitchShift() / 12;
  return notes[noteInOctave] * Math.pow(2, totalOctaves);
}
export function playNoteAt(index, opts = {}) {
  const scale = getCurrentScale();
  if (!scale || !scale.notes) return;
  const i = Math.max(0, index);
  const synth = scale.synth || {};
  const { gain = 0.4 + Math.min(i, 20) * 0.008 } = opts;
  playMalletNote(freqAt(scale, i), { ...synth, gain });
}

// All cells pulse simultaneously — play a brief stacked-note chord.
export function playChord(count) {
  const scale = getCurrentScale();
  if (!scale || !scale.notes) return;
  const synth = scale.synth || {};
  const n = Math.min(count, scale.notes.length);
  for (let i = 0; i < n; i++) {
    playMalletNote(freqAt(scale, i), { ...synth, gain: 0.42 / Math.sqrt(n) });
  }
}

// Single bright impact note (for shockwave / fireworks / starburst etc.)
export function playBurst() {
  const scale = getCurrentScale();
  if (!scale || !scale.notes) return;
  const synth = scale.synth || {};
  playMalletNote(freqAt(scale, Math.min(5, scale.notes.length - 1)), { ...synth, gain: 0.65 });
}

// Simulator-style preview: play a full chain of `length` notes using the
// given scale at the same per-step timing the chain animation would use.
// Lets the sound-picker simulator show what a streak of N actually sounds
// like with each scale.
export function playSimulation(scaleId, length) {
  const scale = SCALES.find(s => s.id === scaleId);
  if (!scale || !scale.notes) return;
  const c = ensureCtx();
  if (!c) return;
  const n = Math.max(1, Math.min(length, 200));
  // Mirror adaptiveStep from chainAnimations.js so the preview's timing
  // matches the real cascade.
  const stepMs = n <= 30 ? 65 : Math.max(4, Math.floor(30 * 65 / n));
  const synth = scale.synth || {};
  const startSec = c.currentTime;
  for (let i = 0; i < n; i++) {
    const gain = 0.4 + Math.min(i, 20) * 0.008;
    // Schedule via Web Audio's `when` for sample-accurate pacing in the
    // preview (no DOM cells to keep in sync with).
    playMalletNote(freqAt(scale, i), {
      ...synth,
      gain,
      when: (startSec - c.currentTime) + (i * stepMs) / 1000,
    });
  }
}
