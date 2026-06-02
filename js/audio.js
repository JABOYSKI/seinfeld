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

// All sound-picker PREVIEW audio routes through a dedicated bus so a new
// preview can instantly silence the previous one — only ONE preview ever
// sounds at a time, even while dragging a slider. Real chain/symphony audio
// goes straight to masterGain and is never cut by a preview.
let previewBus = null;
function previewOut() {
  const c = ensureCtx();
  if (!c) return masterGain;
  if (!previewBus) { previewBus = c.createGain(); previewBus.connect(masterGain); }
  return previewBus;
}
export function stopPreview() {
  if (previewBus) {
    // Disconnecting the bus mutes every in-flight preview note instantly; the
    // next preview builds a fresh bus.
    try { previewBus.disconnect(); } catch (e) {}
    previewBus = null;
  }
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
  // Jazz / exotic modes — the full set of "cool" tonalities
  { id: 'locrian',        name: 'Locrian',          blurb: 'Half-dim, dark, unstable',   notes: [262, 277, 311, 349, 370, 415, 466, 523, 554, 622] },
  { id: 'lydian-dom',     name: 'Lydian Dominant',  blurb: 'Bright + edgy (#4, b7)',     notes: [262, 294, 330, 370, 392, 440, 466, 523, 587, 659] },
  { id: 'altered',        name: 'Altered Scale',    blurb: 'Super Locrian — jazz tension', notes: [262, 277, 311, 330, 370, 415, 466, 523, 554, 622] },
  { id: 'bebop-dom',      name: 'Bebop Dominant',   blurb: 'Walking-bass jazz',          notes: [262, 294, 330, 349, 392, 440, 466, 494, 523, 587] },
  { id: 'diminished-wh',  name: 'Diminished W-H',   blurb: 'Symmetric octatonic',        notes: [262, 294, 311, 349, 370, 415, 440, 494, 523, 587] },
  { id: 'diminished-hw',  name: 'Diminished H-W',   blurb: 'Over dominant 7b9',          notes: [262, 277, 311, 330, 370, 392, 440, 466, 523, 554] },
  { id: 'lydian-aug',     name: 'Lydian Augmented', blurb: 'Bright + futuristic (#4 #5)', notes: [262, 294, 330, 370, 415, 440, 494, 523, 587, 659] },
  { id: 'melodic-minor',  name: 'Melodic Minor',    blurb: 'Jazz minor foundation',      notes: [262, 294, 311, 349, 392, 440, 494, 523, 587, 622] },
  { id: 'hungarian',      name: 'Hungarian Minor',  blurb: 'Exotic gypsy (#4 + 7)',      notes: [262, 294, 311, 370, 392, 415, 494, 523, 587, 622] },
  { id: 'double-harmonic', name: 'Double Harmonic', blurb: 'Spanish flamenco / Mid-East', notes: [262, 277, 330, 349, 392, 415, 494, 523, 554, 659] },
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

  // ----- 25 more themed sounds (varied scales AND synth recipes) -----
  // Nature
  { id: 'rainforest',     name: 'Rainforest',       blurb: 'Bird-like chirps',
    notes: [880, 988, 1175, 1319, 1480, 1760, 1976, 2349, 2637, 2960],
    synth: { type: 'sawtooth', duration: 0.25, attack: 0.002, harmonic: 2, harmonicGain: 0.15, filter: 2500 } },
  { id: 'desert-wind',    name: 'Desert Wind',      blurb: 'Sparse hollow',
    notes: [196, 247, 294, 370, 440, 494, 587, 740, 880, 988],
    synth: { type: 'sine', duration: 2.2, attack: 0.08, harmonic: 0, harmonicGain: 0, filter: 1200 } },
  { id: 'volcano',        name: 'Volcano',          blurb: 'Subsonic rumble',
    notes: [ 33,  41,  49,  65,  82,  98, 110, 131, 165, 196],
    synth: { type: 'triangle', duration: 2.0, attack: 0.01, harmonic: 2, harmonicGain: 0.4, filter: 300 } },
  { id: 'geyser',         name: 'Geyser',           blurb: 'Bubbly ascend',
    notes: [262, 349, 392, 466, 523, 698, 784, 932, 1047, 1397],
    synth: { type: 'square', duration: 0.22, attack: 0.001, harmonic: 2, harmonicGain: 0.2, filter: 2000 } },
  { id: 'whale-song',     name: 'Whale Song',       blurb: 'Slow deep moans',
    notes: [ 55,  65,  73,  82,  98, 110, 123, 131, 147, 165],
    synth: { type: 'sine', duration: 3.5, attack: 0.3, harmonic: 2, harmonicGain: 0.4 } },
  { id: 'bamboo-wind',    name: 'Bamboo Wind',      blurb: 'Hollow flute air',
    notes: [294, 330, 392, 440, 523, 587, 659, 784, 880, 988],
    synth: { type: 'sine', duration: 1.5, attack: 0.08, harmonic: 0, harmonicGain: 0, filter: 1200 } },
  // Sci-Fi
  { id: 'laser',          name: 'Laser',            blurb: 'Rapid sawtooth zaps',
    notes: [880, 988, 1109, 1175, 1319, 1480, 1568, 1760, 1976, 2093],
    synth: { type: 'sawtooth', duration: 0.16, attack: 0.001, harmonic: 4, harmonicGain: 0.3, filter: 5000 } },
  { id: 'plasma',         name: 'Plasma',           blurb: 'Electric buzz',
    notes: [220, 247, 277, 311, 349, 392, 440, 494, 554, 622],
    synth: { type: 'sawtooth', duration: 0.6, attack: 0.005, harmonic: 1.5, harmonicGain: 0.4, filter: 1500 } },
  { id: 'wormhole',       name: 'Wormhole',         blurb: 'Swirling, detuned',
    notes: [196, 233, 277, 311, 370, 415, 466, 554, 622, 740],
    synth: { type: 'sine', duration: 2.5, attack: 0.15, harmonic: 3, harmonicGain: 0.35, detune: 15 } },
  { id: 'robot-boop',     name: 'Robot Boop',       blurb: '8-bit chiptune',
    notes: [262, 330, 392, 440, 523, 587, 659, 784, 880, 988],
    synth: { type: 'square', duration: 0.12, attack: 0.001, harmonic: 0, harmonicGain: 0, filter: 2500 } },
  // Fantasy / mood
  { id: 'dragons-lair',   name: 'Dragon’s Lair',blurb: 'Menacing low',
    notes: [ 49,  65,  73,  82,  98, 110, 131, 147, 165, 196],
    synth: { type: 'sawtooth', duration: 1.0, attack: 0.005, harmonic: 2, harmonicGain: 0.35, filter: 500 } },
  { id: 'phoenix',        name: 'Phoenix',          blurb: 'Bright bursts',
    notes: [349, 440, 523, 587, 698, 784, 932, 1047, 1175, 1397],
    synth: { type: 'triangle', duration: 0.6, attack: 0.005, harmonic: 4, harmonicGain: 0.35, filter: 5000 } },
  { id: 'druid-grove',    name: 'Druid Grove',      blurb: 'Earthy organic',
    notes: [165, 196, 220, 262, 294, 330, 392, 440, 494, 587],
    synth: { type: 'triangle', duration: 1.2, attack: 0.02, harmonic: 3, harmonicGain: 0.3, filter: 1500, detune: 3 } },
  { id: 'midnight',       name: 'Midnight',         blurb: 'Dark sparse minor',
    notes: [110, 131, 156, 175, 196, 220, 262, 311, 349, 415],
    synth: { type: 'sine', duration: 2.0, attack: 0.05, harmonic: 2, harmonicGain: 0.4, filter: 700 } },
  { id: 'lantern',        name: 'Lantern',          blurb: 'Warm cozy mid',
    notes: [196, 247, 294, 330, 392, 440, 494, 587, 659, 740],
    synth: { type: 'triangle', duration: 0.9, attack: 0.01, harmonic: 4, harmonicGain: 0.25, filter: 2500 } },
  // World / cultural
  { id: 'african-bell',   name: 'African Bell',     blurb: 'Percussive bright',
    notes: [440, 523, 587, 659, 698, 784, 880, 988, 1047, 1175],
    synth: { type: 'triangle', duration: 0.4, attack: 0.001, harmonic: 5, harmonicGain: 0.4 } },
  { id: 'inca-pipes',     name: 'Inca Pipes',       blurb: 'Hollow flutes',
    notes: [220, 247, 294, 330, 392, 440, 494, 587, 659, 784],
    synth: { type: 'sine', duration: 1.0, attack: 0.05, harmonic: 0, harmonicGain: 0, filter: 1800 } },
  { id: 'celtic-harp',    name: 'Celtic Harp',      blurb: 'Rolling plucked',
    notes: [262, 294, 330, 392, 440, 494, 523, 587, 659, 784],
    synth: { type: 'triangle', duration: 0.7, attack: 0.001, harmonic: 4, harmonicGain: 0.18 } },
  { id: 'persian-santur', name: 'Persian Santur',   blurb: 'Hammered cascade',
    notes: [294, 330, 349, 392, 440, 466, 523, 587, 659, 698],
    synth: { type: 'triangle', duration: 0.45, attack: 0.001, harmonic: 4, harmonicGain: 0.25, filter: 4500 } },
  { id: 'bali-gong',      name: 'Bali Gong',        blurb: 'Metallic gong',
    notes: [196, 233, 277, 311, 370, 415, 466, 554, 622, 740],
    synth: { type: 'sine', duration: 2.0, attack: 0.005, harmonic: 3, harmonicGain: 0.4, harmonicDecay: 0.5 } },
  // Classical instruments
  { id: 'pipe-organ',     name: 'Pipe Organ',       blurb: 'Majestic sustained',
    notes: [ 98, 131, 165, 196, 247, 262, 330, 392, 494, 523],
    synth: { type: 'sawtooth', duration: 1.5, attack: 0.05, harmonic: 2, harmonicGain: 0.5, filter: 2000 } },
  { id: 'glockenspiel',   name: 'Glockenspiel',     blurb: 'High metallic',
    notes: [659, 784, 880, 988, 1047, 1175, 1319, 1480, 1568, 1760],
    synth: { type: 'triangle', duration: 0.35, attack: 0.001, harmonic: 4, harmonicGain: 0.25 } },
  { id: 'harpsichord',    name: 'Harpsichord',      blurb: 'Quick baroque',
    notes: [262, 294, 330, 349, 392, 440, 494, 523, 587, 659],
    synth: { type: 'sawtooth', duration: 0.4, attack: 0.001, harmonic: 2, harmonicGain: 0.3, filter: 3500 } },
  { id: 'mbira',          name: 'Mbira',            blurb: 'Thumb piano warm',
    notes: [165, 196, 220, 247, 294, 330, 392, 440, 494, 587],
    synth: { type: 'triangle', duration: 0.6, attack: 0.002, harmonic: 4, harmonicGain: 0.3, filter: 2500 } },
  { id: 'lullaby-box',    name: 'Music Box (Lullaby)', blurb: 'Soft high pentatonic',
    notes: [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760],
    synth: { type: 'triangle', duration: 0.7, attack: 0.002, harmonic: 4, harmonicGain: 0.2 } },

  // ----- 15 sounds in the Laser family -----
  // All share Laser's recipe: sawtooth + sub-ms attack + short duration +
  // bright lowpass + a 2nd-octave (or higher) harmonic for the zap shimmer.
  // What varies is the scale (register / intervals) and small tweaks to
  // duration / filter cutoff that change the staccato character.
  { id: 'pulse-cannon',   name: 'Pulse Cannon',     blurb: 'Thicker mid zaps',
    notes: [440, 494, 587, 659, 784, 880, 988, 1175, 1319, 1480],
    synth: { type: 'sawtooth', duration: 0.22, attack: 0.001, harmonic: 4, harmonicGain: 0.35, filter: 4500 } },
  { id: 'ion-bolt',       name: 'Ion Bolt',         blurb: 'Tight high zaps',
    notes: [988, 1109, 1175, 1319, 1480, 1568, 1760, 1976, 2093, 2349],
    synth: { type: 'sawtooth', duration: 0.14, attack: 0.001, harmonic: 4, harmonicGain: 0.25, filter: 6000 } },
  { id: 'photon',         name: 'Photon',           blurb: 'Bright with shimmer',
    notes: [880, 988, 1109, 1175, 1319, 1480, 1568, 1760, 1976, 2093],
    synth: { type: 'sawtooth', duration: 0.18, attack: 0.001, harmonic: 8, harmonicGain: 0.2, filter: 7000 } },
  { id: 'phaser',         name: 'Phaser',           blurb: 'Mid-range zaps',
    notes: [523, 587, 659, 698, 784, 880, 988, 1047, 1175, 1319],
    synth: { type: 'sawtooth', duration: 0.25, attack: 0.002, harmonic: 4, harmonicGain: 0.3, filter: 4000 } },
  { id: 'disruptor',      name: 'Disruptor',        blurb: 'Atonal chromatic',
    notes: [659, 698, 740, 784, 831, 880, 932, 988, 1047, 1109],
    synth: { type: 'sawtooth', duration: 0.15, attack: 0.001, harmonic: 3, harmonicGain: 0.35, filter: 5000 } },
  { id: 'tractor-beam',   name: 'Tractor Beam',     blurb: 'Wide pentatonic',
    notes: [392, 523, 659, 784, 880, 1047, 1175, 1319, 1480, 1760],
    synth: { type: 'sawtooth', duration: 0.2, attack: 0.001, harmonic: 4, harmonicGain: 0.3, filter: 5000 } },
  { id: 'quantum',        name: 'Quantum',          blurb: 'Whole-tone zaps',
    notes: [523, 587, 659, 740, 831, 932, 1047, 1175, 1319, 1480],
    synth: { type: 'sawtooth', duration: 0.16, attack: 0.001, harmonic: 4, harmonicGain: 0.3, filter: 5000 } },
  { id: 'hyperbeam',      name: 'Hyperbeam',        blurb: 'Very high range',
    notes: [1175, 1319, 1480, 1568, 1760, 1976, 2093, 2349, 2637, 2960],
    synth: { type: 'sawtooth', duration: 0.13, attack: 0.001, harmonic: 2, harmonicGain: 0.3, filter: 6500 } },
  { id: 'singularity',    name: 'Singularity',      blurb: 'Low gravity zaps',
    notes: [220, 247, 294, 330, 392, 440, 494, 587, 659, 740],
    synth: { type: 'sawtooth', duration: 0.2, attack: 0.001, harmonic: 4, harmonicGain: 0.4, filter: 3500 } },
  { id: 'particle',       name: 'Particle',         blurb: 'Sparse short bursts',
    notes: [659, 880, 1175, 1568, 2093, 2637, 3136, 3520, 4186, 4978],
    synth: { type: 'sawtooth', duration: 0.1, attack: 0.001, harmonic: 4, harmonicGain: 0.2, filter: 5500 } },
  { id: 'neutron',        name: 'Neutron',          blurb: 'Rapid same-range',
    notes: [659, 698, 740, 784, 831, 880, 932, 988, 1047, 1109],
    synth: { type: 'sawtooth', duration: 0.1, attack: 0.001, harmonic: 4, harmonicGain: 0.3, filter: 5500 } },
  { id: 'antimatter',     name: 'Antimatter',       blurb: 'Dark low sawtooth',
    notes: [196, 220, 247, 277, 311, 349, 392, 440, 494, 554],
    synth: { type: 'sawtooth', duration: 0.22, attack: 0.001, harmonic: 2, harmonicGain: 0.4, filter: 2500 } },
  { id: 'stargate',       name: 'Stargate',         blurb: 'Wide swooping leaps',
    notes: [330, 440, 587, 784, 1047, 1397, 1865, 2349, 2637, 2960],
    synth: { type: 'sawtooth', duration: 0.18, attack: 0.001, harmonic: 4, harmonicGain: 0.3, filter: 5500 } },
  { id: 'warp-drive',     name: 'Warp Drive',       blurb: 'Mid sustained zaps',
    notes: [392, 440, 494, 587, 659, 784, 880, 988, 1047, 1175],
    synth: { type: 'sawtooth', duration: 0.35, attack: 0.002, harmonic: 4, harmonicGain: 0.3, filter: 4500 } },
  { id: 'pulse-rifle',    name: 'Pulse Rifle',      blurb: 'Tight rapid mid',
    notes: [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760],
    synth: { type: 'sawtooth', duration: 0.12, attack: 0.001, harmonic: 4, harmonicGain: 0.35, filter: 5500 } },
];

// 15 scale-traversal patterns. Each `step(i, n)` takes the cell index and the
// scale's note count and returns the conceptual "ascending step number" — a
// non-negative integer that gets fed through the standard octave-wrap logic
// (`step % n` for note, `floor(step / n)` for octave climb). That keeps long
// chains naturally climbing in pitch regardless of which internal pattern
// they use. Pattern #1 (ascending) is the original/default behavior.
export const PATTERNS = [
  // "Base" — the chosen sound played plainly, exactly as it auditions: a
  // straight run through the scale's own notes (this IS the default traversal
  // a bare sound previews with). Listed first so it reads as the "just this
  // sound" choice. Behaviorally identical to Ascending by design.
  { id: 'base',       name: 'Base',        blurb: 'The sound itself, as auditioned',
    step: (i) => i },
  { id: 'ascending',  name: 'Ascending',   blurb: 'Up the scale (default)',
    step: (i) => i },
  { id: 'descending', name: 'Descending',  blurb: 'Down within each octave',
    step: (i, n) => Math.floor(i / n) * n + (n - 1 - (i % n)) },
  { id: 'ping-pong',  name: 'Ping-Pong',   blurb: 'Up then down, climb octave',
    step: (i, n) => {
      const period = 2 * (n - 1);
      const cycle = Math.floor(i / period);
      const p = i % period;
      const within = p < n ? p : 2 * (n - 1) - p;
      return cycle * n + within;
    } },
  { id: 'pong-ping',  name: 'Pong-Ping',   blurb: 'Down then up, climb octave',
    step: (i, n) => {
      const period = 2 * (n - 1);
      const cycle = Math.floor(i / period);
      const p = i % period;
      const within = p < n ? (n - 1 - p) : (p - (n - 1));
      return cycle * n + within;
    } },
  { id: 'zigzag',     name: 'Zigzag',      blurb: 'Alternate low and high',
    step: (i, n) => {
      const cycle = Math.floor(i / n);
      const k = i % n;
      const within = (k % 2 === 0) ? Math.floor(k / 2) : n - 1 - Math.floor(k / 2);
      return cycle * n + within;
    } },
  { id: 'spiral-out', name: 'Spiral Out',  blurb: 'From center outward',
    step: (i, n) => {
      const cycle = Math.floor(i / n);
      const k = i % n;
      const mid = Math.floor((n - 1) / 2);
      let within;
      if (k === 0) within = mid;
      else if (k % 2 === 1) within = mid + Math.ceil(k / 2);
      else within = mid - k / 2;
      within = Math.max(0, Math.min(n - 1, within));
      return cycle * n + within;
    } },
  { id: 'spiral-in',  name: 'Spiral In',   blurb: 'From edges inward',
    step: (i, n) => {
      const cycle = Math.floor(i / n);
      const k = i % n;
      const within = (k % 2 === 0) ? k / 2 : n - 1 - Math.floor(k / 2);
      return cycle * n + within;
    } },
  { id: 'thirds',     name: 'Thirds',      blurb: 'Skip every other note',
    step: (i, n) => {
      const cycle = Math.floor(i / n);
      const k = i % n;
      const half = Math.floor(n / 2);
      const within = (k < half) ? (k * 2) % n : (k * 2 - n + 1);
      return cycle * n + within;
    } },
  { id: 'fourths',    name: 'Fourths',     blurb: 'Skip every two notes',
    step: (i, n) => {
      const cycle = Math.floor(i / n);
      const k = i % n;
      const within = (k * 3) % n;
      return cycle * n + within;
    } },
  { id: 'arpeggio',   name: 'Arpeggio',    blurb: 'Triadic climb (1-3-5)',
    step: (i) => {
      const triadStep = i % 3;
      const triad = Math.floor(i / 3);
      return triad + triadStep * 2;
    } },
  { id: 'echo',       name: 'Echo',        blurb: 'Each note twice',
    step: (i) => Math.floor(i / 2) },
  { id: 'triplet',    name: 'Triplet',     blurb: 'Each note three times',
    step: (i) => Math.floor(i / 3) },
  { id: 'root-pedal', name: 'Root Pedal',  blurb: 'Root alternates with climb',
    step: (i) => (i % 2 === 0) ? 0 : Math.floor(i / 2) + 1 },
  { id: 'random',     name: 'Random',      blurb: 'Pseudo-random per cell',
    step: (i, n) => {
      const cycle = Math.floor(i / n);
      const k = i % n;
      // Deterministic 32-bit hash so the same chain plays the same notes.
      const h = (Math.imul(k + 1, 2654435761) ^ Math.imul(cycle + 1, 40503)) >>> 0;
      return cycle * n + (h % n);
    } },
  { id: 'mountain',   name: 'Mountain',    blurb: 'Climb half, descend half',
    step: (i, n) => {
      const half = Math.floor(n / 2);
      const period = 2 * half;
      const cycle = Math.floor(i / period);
      const p = i % period;
      const within = (p < half) ? p : (2 * half - 1 - p);
      return cycle * n + within;
    } },

  // ----- 6 melodic-loop patterns (whiteboyops / plugg-rage aesthetic) -----
  // Built like actual song hooks — 6 to 12-note phrases with real melodic
  // shape and identity, rather than abstract motion. The loop is the
  // point: each phrase repeats long enough to read as a recognizable
  // melody, drifting up only every couple of phrases so the hook stays
  // identifiable instead of marching off into the stratosphere.
  //
  // These read very differently depending on scale:
  //   • Bright scales (lullaby-box, crystal-cave, music-box, celesta,
  //     maj-pent) → plugg sparkle, "Your Stepdad" / Bjorn Bozelli leads
  //   • Dark scales (harmonic-minor, phrygian-dom, haunted, dragons-lair,
  //     hirajoshi, iwato) → menacing hyperphonk / rage lead

  // STEPDAD — the defining bouncy mid-to-high lead phrase. Bounces around
  // the upper register then drops to a low anchor and back. Reads as a
  // memorable hook on the first listen.
  { id: 'stepdad',   name: 'Stepdad',   blurb: 'Bouncy 8-note plugg hook',
    step: (i) => Math.floor(i / 16) + [4, 7, 4, 9, 7, 4, 2, 4][i % 8] },

  // SLINGSHOT — interlocking ascending fifths. Each pair leaps up a fifth
  // and the pairs themselves climb by step, giving an aggressive, taut,
  // accelerating-rope-pull feel.
  { id: 'slingshot', name: 'Slingshot', blurb: 'Interlocking ascending fifths',
    step: (i) => Math.floor(i / 24) + [0, 5, 1, 6, 2, 7, 3, 8][i % 8] },

  // MIRAGE — wavy ascending line that doubles back on itself: up-2, back-2,
  // up-3, back-2, up-4, back-2. Reads like a melody trying to climb but
  // pulled back, then breaking through.
  { id: 'mirage',    name: 'Mirage',    blurb: 'Climbing with mirror backsteps',
    step: (i) => Math.floor(i / 16) + [0, 2, 4, 2, 5, 7, 5, 9][i % 8] },

  // FREEFALL — climbs to the top of the second octave then plunges all
  // the way back to the floor in one drop. The vertical asymmetry is the
  // signature: slow rise, instant fall.
  { id: 'freefall',  name: 'Freefall',  blurb: 'Slow climb, sudden plunge',
    step: (i) => Math.floor(i / 16) + [0, 2, 4, 7, 9, 12, 4, 0][i % 8] },

  // PHANTOM — root-fifth-third broken chord that jumps an octave on the
  // 4th note, then returns. Spinning, hovering quality — sounds like a
  // suspended chord turning in mid-air.
  { id: 'phantom',   name: 'Phantom',   blurb: 'Spinning octave-leap arpeggio',
    step: (i) => Math.floor(i / 12) + [0, 7, 4, 11, 7, 4][i % 6] },

  // DRIFT — 12-note rise-and-fall arc, smooth and elegant. Sounds like a
  // melodic riser that crests in the upper register and slides back down
  // through the chord tones — drift-phonk lead bending through a corner.
  { id: 'drift',     name: 'Drift',     blurb: 'Elegant 12-note rise-and-fall arc',
    step: (i) => Math.floor(i / 24) + [0, 2, 4, 5, 7, 9, 11, 9, 7, 5, 4, 2][i % 12] },
];

export const DEFAULT_SOUND_ID = 'off';
export const DEFAULT_PATTERN_ID = 'ascending';
// Per-habit queue of {pattern, scale} entries the chain rotates through.
// Each entry plays for PATTERN_QUEUE_SECTION cells, then the next entry
// takes over (looping when the queue runs out). Max length is ~5 years of
// daily plays (5 × 365 = 1825) so a user can compose a year-after-year
// sound for a single habit if they want. Empty queue → fall back to the
// single-pattern + global-scale selection for backwards compat.
export const MAX_PATTERN_QUEUE = 1825;
export const PATTERN_QUEUE_SECTION = 8;
const STORAGE_KEY = 'seinfeld_sound_scale';
const OCTAVE_STORAGE_KEY = 'seinfeld_sound_octave';
const PITCH_STORAGE_KEY = 'seinfeld_sound_pitch';
const PATTERN_STORAGE_KEY = 'seinfeld_sound_pattern';
// v2 — per-habit map of queue arrays; values are arrays of {pattern, scale}
// objects (scale may be null = "use global default at play time").
const PATTERN_QUEUES_STORAGE_KEY = 'seinfeld_sound_pattern_queues_v2';
const VALID_IDS = new Set(SCALES.map(s => s.id));
const VALID_PATTERN_IDS = new Set(PATTERNS.map(p => p.id));
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

// Global tempo multiplier for the chain cascade + its synced audio: >1 plays
// faster (shorter per-step delay), <1 slower. Applied wherever per-step timing
// is computed (adaptiveStep in chainAnimations, the symphony beat, the picker
// preview below).
const SPEED_STORAGE_KEY = 'seinfeld_sound_speed';
export const SPEED_RANGE = { min: 0.25, max: 4 };
export function getSpeedFactor() {
  const v = parseFloat(localStorage.getItem(SPEED_STORAGE_KEY));
  if (!Number.isFinite(v) || v <= 0) return 1;
  return Math.min(SPEED_RANGE.max, Math.max(SPEED_RANGE.min, v));
}
export function setSpeedFactor(v) {
  const f = Math.min(SPEED_RANGE.max, Math.max(SPEED_RANGE.min, v));
  localStorage.setItem(SPEED_STORAGE_KEY, String(f));
  return f;
}
// Selected scale-traversal pattern (which step to play at index i).
export function getSelectedPatternId() {
  const saved = localStorage.getItem(PATTERN_STORAGE_KEY);
  return VALID_PATTERN_IDS.has(saved) ? saved : DEFAULT_PATTERN_ID;
}
export function setSelectedPatternId(id) {
  if (!VALID_PATTERN_IDS.has(id)) return false;
  localStorage.setItem(PATTERN_STORAGE_KEY, id);
  return true;
}
export function getCurrentPattern() {
  return PATTERNS.find(p => p.id === getSelectedPatternId()) || PATTERNS[0];
}
// Per-habit pattern queue: each habit owns an ordered list of
// {pattern, scale} entries; the chain cycles through them, with each
// entry playing for PATTERN_QUEUE_SECTION cells before the next takes
// over (looping when exhausted). `scale: null` on an entry means "use
// whatever the global scale selection is at play time".
function readQueuesMap() {
  try {
    const raw = localStorage.getItem(PATTERN_QUEUES_STORAGE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
  } catch { return {}; }
}
function writeQueuesMap(map) {
  localStorage.setItem(PATTERN_QUEUES_STORAGE_KEY, JSON.stringify(map));
}
// Normalize a queue entry into the canonical
// {pattern, scale, octaveShift?, pitchShift?, sectionLength?} shape.
// Accepts bare strings (legacy v1 format) as {pattern: x, scale: null}.
// octaveShift / pitchShift / sectionLength are OPTIONAL per-entry
// overrides — when absent the entry inherits the global slider values
// and the default PATTERN_QUEUE_SECTION at play time.
export const MIN_SECTION_LENGTH = 1;
export const MAX_SECTION_LENGTH = 64;
function normalizeQueueEntry(item) {
  if (typeof item === 'string') {
    return VALID_PATTERN_IDS.has(item) ? { pattern: item, scale: null } : null;
  }
  if (!item || typeof item !== 'object') return null;
  if (!VALID_PATTERN_IDS.has(item.pattern)) return null;
  const scale = (item.scale && VALID_IDS.has(item.scale)) ? item.scale : null;
  const out = { pattern: item.pattern, scale };
  if (typeof item.octaveShift === 'number' && item.octaveShift >= MIN_OCTAVE && item.octaveShift <= MAX_OCTAVE) {
    out.octaveShift = Math.round(item.octaveShift);
  }
  if (typeof item.pitchShift === 'number' && item.pitchShift >= MIN_PITCH && item.pitchShift <= MAX_PITCH) {
    out.pitchShift = Math.round(item.pitchShift);
  }
  if (typeof item.sectionLength === 'number' && item.sectionLength >= MIN_SECTION_LENGTH && item.sectionLength <= MAX_SECTION_LENGTH) {
    out.sectionLength = Math.round(item.sectionLength);
  }
  return out;
}
export function getPatternQueue(habitId) {
  if (!habitId) return [];
  const map = readQueuesMap();
  const items = map[habitId];
  if (!Array.isArray(items)) return [];
  return items.map(normalizeQueueEntry).filter(Boolean).slice(0, MAX_PATTERN_QUEUE);
}
export function setPatternQueue(habitId, items) {
  if (!habitId) return [];
  const clean = (Array.isArray(items) ? items : [])
    .map(normalizeQueueEntry)
    .filter(Boolean)
    .slice(0, MAX_PATTERN_QUEUE);
  const map = readQueuesMap();
  if (clean.length === 0) delete map[habitId];
  else map[habitId] = clean;
  writeQueuesMap(map);
  return clean;
}
export function addToPatternQueue(habitId, entry) {
  const e = normalizeQueueEntry(entry);
  if (!habitId || !e) return getPatternQueue(habitId);
  const q = getPatternQueue(habitId);
  if (q.length >= MAX_PATTERN_QUEUE) return q;
  q.push(e);
  return setPatternQueue(habitId, q);
}
export function removeFromPatternQueue(habitId, index) {
  const q = getPatternQueue(habitId);
  if (index < 0 || index >= q.length) return q;
  q.splice(index, 1);
  return setPatternQueue(habitId, q);
}
// Partial update of one entry: merge `updates` into the existing entry,
// then re-normalize. Pass an undefined value to drop an override (revert
// to the global default at play time).
export function updateQueueEntry(habitId, index, updates) {
  const q = getPatternQueue(habitId);
  if (index < 0 || index >= q.length) return q;
  const merged = { ...q[index], ...updates };
  for (const k of Object.keys(updates)) {
    if (updates[k] === undefined || updates[k] === null) delete merged[k];
  }
  const next = normalizeQueueEntry(merged);
  if (!next) return q;
  q[index] = next;
  return setPatternQueue(habitId, q);
}
export function clearPatternQueue(habitId) {
  if (!habitId) return [];
  const map = readQueuesMap();
  delete map[habitId];
  writeQueuesMap(map);
  return [];
}
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

  // Build a per-note signal chain. `out` lets previews route through the
  // preview bus (so they can be cut as a group); default is masterGain. Filter
  // goes between the env and the output when requested.
  const out = opts.out || masterGain;
  const sink = filter ? (() => {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    f.connect(out);
    return f;
  })() : out;

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
// Resolves (scale, pattern, localI, octaveShift, pitchShift) for a cell
// index given a habit context. Empty queue OR no habit context → uses
// the global selection. With a non-empty queue, walks through entries
// summing their (per-entry-or-default) sectionLengths and returns the
// entry that covers cell `i`. Per-entry octave / pitch overrides fall
// back to the global slider values when the entry doesn't set them.
function defaultAudioContext(i) {
  return {
    scale: getCurrentScale(),
    pattern: getCurrentPattern(),
    localI: i,
    octaveShift: getOctaveShift(),
    pitchShift: getPitchShift(),
  };
}
function resolveEntry(entry, localI, globalI) {
  const pattern = PATTERNS.find(p => p.id === entry.pattern) || PATTERNS[0];
  const scale = (entry.scale ? SCALES.find(s => s.id === entry.scale) : null) || getCurrentScale();
  const octaveShift = (typeof entry.octaveShift === 'number') ? entry.octaveShift : getOctaveShift();
  const pitchShift = (typeof entry.pitchShift === 'number') ? entry.pitchShift : getPitchShift();
  // 'base' plays the sound straight through: a continuous ascending run across
  // the whole chain (exactly like the sound preview), instead of restarting at
  // the section boundary the way the motif patterns do. So it uses the global
  // cell index, not the per-section position.
  const idx = entry.pattern === 'base' ? globalI : localI;
  return { scale, pattern, localI: idx, octaveShift, pitchShift };
}
function audioContextForCell(i, habitId) {
  const q = habitId ? getPatternQueue(habitId) : [];
  if (q.length === 0) return defaultAudioContext(i);
  const totalCells = q.reduce((sum, e) => sum + (e.sectionLength || PATTERN_QUEUE_SECTION), 0);
  if (totalCells === 0) return defaultAudioContext(i);
  const cycles = Math.floor(i / totalCells);
  let pos = ((i % totalCells) + totalCells) % totalCells;
  for (const entry of q) {
    const len = entry.sectionLength || PATTERN_QUEUE_SECTION;
    if (pos < len) {
      // 3rd arg = this entry's OWN cumulative index. For 'base' it ascends
      // continuously from 0 across the entry's sections, so the sound plays its
      // full innate progression from the bottom (matching the click-preview)
      // no matter where the entry sits in the queue. Other patterns ignore it.
      return resolveEntry(entry, pos, cycles * len + pos);
    }
    pos -= len;
  }
  return defaultAudioContext(i); // unreachable in practice
}
// Turns (scale, pattern, localI, shifts) into a concrete frequency,
// applying the auto-octave wrap + per-entry (or global) octave + pitch.
function freqAtWith(scale, pattern, localI, octaveShift = 0, pitchShift = 0) {
  const notes = scale.notes;
  const step = Math.max(0, pattern.step(localI, notes.length));
  const octaveWrap = Math.min(Math.floor(step / notes.length), maxOctaveWrapForScale(scale));
  const noteInOctave = step % notes.length;
  const totalOctaves = octaveWrap + octaveShift + pitchShift / 12;
  return notes[noteInOctave] * Math.pow(2, totalOctaves);
}
export function playNoteAt(index, opts = {}) {
  const i = Math.max(0, index);
  const { gain = 0.4 + Math.min(i, 20) * 0.008, habitId = null } = opts;
  const { scale, pattern, localI, octaveShift, pitchShift } = audioContextForCell(i, habitId);
  if (!scale || !scale.notes) return;
  const synth = scale.synth || {};
  playMalletNote(freqAtWith(scale, pattern, localI, octaveShift, pitchShift), { ...synth, gain });
}

// All cells pulse simultaneously — play a brief stacked-note chord. With a
// queue, each "voice" of the chord can come from a different (scale,
// pattern) section, so the chord is per-cell-context too.
//
// Voices are capped: past ~2 dozen identical-onset oscillators the extra notes
// are inaudible but cause clipping + a main-thread spike on long chains. This
// is the all-at-once pulse only — the sequential cascade (playNoteAt) is
// uncapped, so a 100-day chain still plays its full note-by-note run.
const MAX_CHORD_VOICES = 24;
export function playChord(count, habitId = null) {
  const n = Math.max(1, count);
  const voices = Math.min(n, MAX_CHORD_VOICES);
  for (let i = 0; i < voices; i++) {
    const { scale, pattern, localI, octaveShift, pitchShift } = audioContextForCell(i, habitId);
    if (!scale || !scale.notes) continue;
    const synth = scale.synth || {};
    playMalletNote(freqAtWith(scale, pattern, localI, octaveShift, pitchShift), {
      ...synth, gain: 0.42 / Math.sqrt(voices),
    });
  }
}

// Single bright impact note (for shockwave / fireworks / starburst etc.)
export function playBurst(habitId = null) {
  const focus = 5; // bright-ish position in the queue/pattern
  const { scale, pattern, localI, octaveShift, pitchShift } = audioContextForCell(focus, habitId);
  if (!scale || !scale.notes) return;
  const synth = scale.synth || {};
  const safeLocal = Math.min(localI, scale.notes.length - 1);
  playMalletNote(freqAtWith(scale, pattern, safeLocal, octaveShift, pitchShift), { ...synth, gain: 0.65 });
}

// Plays a single (pattern, scale) combo in isolation — used by the sound
// picker so clicking a pattern in the panel previews that pattern with
// the currently selected scale, without touching the habit's queue at all.
// Uses the global octave + pitch shifts at preview time.
export function playPatternPreview(patternId, scaleId, length = PATTERN_QUEUE_SECTION) {
  const pattern = PATTERNS.find(p => p.id === patternId);
  const scale = SCALES.find(s => s.id === scaleId);
  if (!pattern || !scale || !scale.notes) return;
  stopPreview();
  const c = ensureCtx();
  if (!c) return;
  const out = previewOut();
  const n = Math.max(1, Math.min(length, 64));
  const stepMs = Math.max(2, Math.round(65 / getSpeedFactor()));
  const synth = scale.synth || {};
  const startSec = c.currentTime;
  const oct = getOctaveShift();
  const pit = getPitchShift();
  for (let i = 0; i < n; i++) {
    const gain = 0.4 + Math.min(i, 20) * 0.008;
    playMalletNote(freqAtWith(scale, pattern, i, oct, pit), {
      ...synth, gain, out,
      when: (startSec - c.currentTime) + (i * stepMs) / 1000,
    });
  }
}

// Simulator-style preview: play a full chain of `length` notes using the
// queue + scale resolution as if it were a real chain of that habit (or
// the global default if no habit context is provided). Timing mirrors the
// chain animation's adaptiveStep.
export function playSimulation(length, habitId = null) {
  stopPreview();
  const c = ensureCtx();
  if (!c) return;
  const out = previewOut();
  const n = Math.max(1, Math.min(length, MAX_PATTERN_QUEUE));
  const stepMs = Math.max(2, Math.round(65 / getSpeedFactor()));
  const startSec = c.currentTime;
  for (let i = 0; i < n; i++) {
    const { scale, pattern, localI, octaveShift, pitchShift } = audioContextForCell(i, habitId);
    if (!scale || !scale.notes) continue;
    const synth = scale.synth || {};
    const gain = 0.4 + Math.min(i, 20) * 0.008;
    playMalletNote(freqAtWith(scale, pattern, localI, octaveShift, pitchShift), {
      ...synth,
      gain,
      out,
      when: (startSec - c.currentTime) + (i * stepMs) / 1000,
    });
  }
}
