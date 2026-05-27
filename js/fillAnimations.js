// Registry of fill animations. Each entry's `id` matches a CSS class
// `.fill-<id>` defined in css/animations.css.
//
// Order in the list = display order in the picker. Group by feel (impact →
// ripple → spread → sweep → liquid → spring → 3d → light → mechanical) so
// neighbors in the grid feel related.

export const FILL_ANIMATIONS = [
  // Impact / stamp family
  { id: 'stamp',         name: 'Stamp',         blurb: 'Spring pop with a radiating ring' },
  { id: 'kick',          name: 'Kick',          blurb: 'Sharper, faster stamp' },
  { id: 'soft-stamp',    name: 'Soft stamp',    blurb: 'Gentle, slow exhale' },
  { id: 'double-stamp',  name: 'Double stamp',  blurb: 'Two pulses in a row' },
  { id: 'knock',         name: 'Knock',         blurb: 'Tilts and bounces' },

  // Ripple / wave family
  { id: 'ripple',        name: 'Ripple',        blurb: 'Single soft ring' },
  { id: 'sonar',         name: 'Sonar',         blurb: 'Two staggered rings' },
  { id: 'echo',          name: 'Echo',          blurb: 'Three rings, layered' },

  // Bloom / spread
  { id: 'bloom',         name: 'Bloom',         blurb: 'Ink-in-water spread' },
  { id: 'burst',         name: 'Burst',         blurb: 'Quick radial flare' },
  { id: 'fade',          name: 'Fade',          blurb: 'Soft scale + blur in' },

  // Sweep / wipe
  { id: 'wipe',          name: 'Wipe',          blurb: 'Color sweeps in from the left' },
  { id: 'diagonal',      name: 'Diagonal',      blurb: 'Sweeps from the top-left corner' },
  { id: 'iris',          name: 'Iris',          blurb: 'Circle opens from the center' },

  // Liquid
  { id: 'rise',          name: 'Rise',          blurb: 'Fills from the bottom up' },
  { id: 'drip',          name: 'Drip',          blurb: 'Falls from the top down' },

  // Spring / bounce
  { id: 'pop',           name: 'Pop',           blurb: 'Pure scale spring' },
  { id: 'jelly',         name: 'Jelly',         blurb: 'Wobbly squash + stretch' },
  { id: 'bubble',        name: 'Bubble',        blurb: 'Lifts and settles' },

  // 3D
  { id: 'flip',          name: 'Flip',          blurb: '3D rotation reveal' },
  { id: 'fold',          name: 'Fold',          blurb: 'Unfolds from the center' },

  // Light
  { id: 'glow',          name: 'Glow',          blurb: 'Pulsing brightness halo' },
  { id: 'shimmer',       name: 'Shimmer',       blurb: 'Light streaks across' },
  { id: 'sparkle',       name: 'Sparkle',       blurb: 'Tiny twinkles around it' },

  // Mechanical
  { id: 'snap',          name: 'Snap',          blurb: 'Quick spin + flash' },
];

export const DEFAULT_ANIMATION_ID = 'stamp';

// Longest animation (sparkle/echo/sonar trail) is ~850ms. Pad to 1000ms so
// the class is removed safely after every animation type finishes.
export const FILL_ANIMATION_DURATION_MS = 1000;

const STORAGE_KEY = 'seinfeld_fill_animation';
const VALID_IDS = new Set(FILL_ANIMATIONS.map(a => a.id));

export function getSelectedAnimationId() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return VALID_IDS.has(saved) ? saved : DEFAULT_ANIMATION_ID;
}

export function setSelectedAnimationId(id) {
  if (!VALID_IDS.has(id)) return false;
  localStorage.setItem(STORAGE_KEY, id);
  return true;
}

export function getAnimationById(id) {
  return FILL_ANIMATIONS.find(a => a.id === id);
}
