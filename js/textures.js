// Registry of 25 textures applied to filled day cells. Each `id` matches a
// CSS class `.tx-<id>` defined in css/textures.css.

export const TEXTURES = [
  { id: 'matte',        name: 'Matte',        blurb: 'Flat solid color' },
  { id: 'metallic',     name: 'Metallic',     blurb: 'Diagonal metal sheen' },
  { id: 'glossy',       name: 'Glossy',       blurb: 'Top highlight, smooth' },
  { id: 'velvet',       name: 'Velvet',       blurb: 'Soft radial fade' },
  { id: 'pearl',        name: 'Pearl',        blurb: 'Iridescent shimmer' },
  { id: 'brushed',      name: 'Brushed',      blurb: 'Brushed metal grain' },
  { id: 'glitter',      name: 'Glitter',      blurb: 'Bright scattered specks' },
  { id: 'neon',         name: 'Neon',         blurb: 'Inner glow + outer halo' },
  { id: 'embossed',     name: 'Embossed',     blurb: 'Raised, light from top-left' },
  { id: 'crystal',      name: 'Crystal',      blurb: 'Faceted conic gradient' },
  { id: 'watercolor',   name: 'Watercolor',   blurb: 'Soft asymmetric wash' },
  { id: 'holographic',  name: 'Holographic',  blurb: 'Rainbow hue shifts' },
  { id: 'chrome',       name: 'Chrome',       blurb: 'High-contrast mirror finish' },
  { id: 'sandstone',    name: 'Sandstone',    blurb: 'Speckled grain' },
  { id: 'frosted',      name: 'Frosted',      blurb: 'Milky overlay' },
  { id: 'lava',         name: 'Lava',         blurb: 'Hot spots on dark base' },
  { id: 'marble',       name: 'Marble',       blurb: 'Veined polished stone' },
  { id: 'carbon',       name: 'Carbon',       blurb: 'Cross-hatch weave' },
  { id: 'liquid',       name: 'Liquid',       blurb: 'Wet glossy highlight' },
  { id: 'plasma',       name: 'Plasma',       blurb: 'Energetic multi-radial' },
  { id: 'foil',         name: 'Foil',         blurb: 'Crinkled angular metal' },
  { id: 'suede',        name: 'Suede',        blurb: 'Soft darkened edges' },
  { id: 'diamond',      name: 'Diamond',      blurb: 'Four-way facets' },
  { id: 'stardust',     name: 'Stardust',     blurb: 'Pinpoint star specks' },
  { id: 'smoke',        name: 'Smoke',        blurb: 'Wispy fade' },
];

export const DEFAULT_TEXTURE_ID = 'matte';
const VALID_IDS = new Set(TEXTURES.map(t => t.id));

export function isValidTextureId(id) {
  return VALID_IDS.has(id);
}

export function getTextureById(id) {
  return TEXTURES.find(t => t.id === id) || TEXTURES[0];
}

// Normalize a value coming from the database — protects against null /
// legacy rows that didn't have the column.
export function normalizeTexture(value) {
  return isValidTextureId(value) ? value : DEFAULT_TEXTURE_ID;
}
