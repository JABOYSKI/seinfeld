// Standalone color picker: 2D saturation/lightness pad + vertical hue slider
// + hex input + preview swatch. Renders into a host element, calls `onChange`
// with a normalized hex string whenever the color is updated.
//
// Architecture: state lives in HSL because the UI is HSL-native (the pad and
// hue strip are HSL gradients). hex is the canonical export format because
// that's what we store on habits / pass to CSS.

export function buildColorWheel(host, initialHex, onChange) {
  const state = hexToHsl(initialHex) || { h: 0, s: 100, l: 50 };

  host.innerHTML = `
    <div class="cw-row">
      <div class="cw-pad" tabindex="0" role="slider" aria-label="Saturation and lightness"
           aria-valuemin="0" aria-valuemax="100"></div>
      <div class="cw-hue" tabindex="0" role="slider" aria-label="Hue"
           aria-valuemin="0" aria-valuemax="360"></div>
    </div>
    <div class="cw-meta">
      <span class="cw-swatch"></span>
      <input type="text" class="cw-hex field" maxlength="7" autocomplete="off" spellcheck="false" />
    </div>
  `;

  const pad      = host.querySelector('.cw-pad');
  const padThumb = document.createElement('span');
  padThumb.className = 'cw-pad-thumb';
  pad.appendChild(padThumb);

  const hue       = host.querySelector('.cw-hue');
  const hueThumb  = document.createElement('span');
  hueThumb.className = 'cw-hue-thumb';
  hue.appendChild(hueThumb);

  const swatch = host.querySelector('.cw-swatch');
  const hexEl  = host.querySelector('.cw-hex');

  function paint() {
    // Pad background reflects current hue
    pad.style.setProperty('--cw-hue', state.h);
    // Thumb positions: saturation drives X, lightness drives Y (inverted —
    // top = 100% lightness, bottom = 0%).
    // For the SL pad we use S × V (HSV), since that's what photoshop-style
    // pickers expect: x = saturation, y = inverted value/brightness.
    const { x, y } = hslToPadXY(state.h, state.s, state.l);
    padThumb.style.left = `${x * 100}%`;
    padThumb.style.top  = `${y * 100}%`;

    // Hue thumb vertical position (0deg at top, 360 at bottom)
    hueThumb.style.top = `${(state.h / 360) * 100}%`;

    const hex = hslToHex(state.h, state.s, state.l);
    swatch.style.background = hex;
    if (document.activeElement !== hexEl) hexEl.value = hex;
  }

  function emit() {
    const hex = hslToHex(state.h, state.s, state.l);
    onChange(hex);
  }

  // --- Pad interaction (saturation × value) ---
  function padUpdate(clientX, clientY) {
    const rect = pad.getBoundingClientRect();
    const x = clamp01((clientX - rect.left) / rect.width);
    const y = clamp01((clientY - rect.top)  / rect.height);
    const { s, l } = padXYToHsl(state.h, x, y);
    state.s = s;
    state.l = l;
    paint();
    emit();
  }

  attachDrag(pad, padUpdate);
  pad.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 2;
    const { x, y } = hslToPadXY(state.h, state.s, state.l);
    let nx = x, ny = y;
    if (e.key === 'ArrowLeft')  nx = clamp01(x - step / 100);
    else if (e.key === 'ArrowRight') nx = clamp01(x + step / 100);
    else if (e.key === 'ArrowUp')    ny = clamp01(y - step / 100);
    else if (e.key === 'ArrowDown')  ny = clamp01(y + step / 100);
    else return;
    e.preventDefault();
    const { s, l } = padXYToHsl(state.h, nx, ny);
    state.s = s; state.l = l;
    paint(); emit();
  });

  // --- Hue strip interaction ---
  function hueUpdate(_clientX, clientY) {
    const rect = hue.getBoundingClientRect();
    const y = clamp01((clientY - rect.top) / rect.height);
    state.h = Math.round(y * 360);
    paint();
    emit();
  }
  attachDrag(hue, hueUpdate);
  hue.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 15 : 3;
    if (e.key === 'ArrowUp')        state.h = (state.h - step + 360) % 360;
    else if (e.key === 'ArrowDown') state.h = (state.h + step) % 360;
    else return;
    e.preventDefault();
    paint(); emit();
  });

  // --- Hex input ---
  hexEl.addEventListener('input', () => {
    const v = hexEl.value.trim();
    const parsed = hexToHsl(v);
    if (parsed) {
      state.h = parsed.h; state.s = parsed.s; state.l = parsed.l;
      paint(); emit();
    }
  });
  hexEl.addEventListener('blur', () => {
    paint(); // reformat on blur
  });

  paint();

  return {
    setHex(hex) {
      const parsed = hexToHsl(hex);
      if (!parsed) return;
      state.h = parsed.h; state.s = parsed.s; state.l = parsed.l;
      paint();
    },
    getHex() { return hslToHex(state.h, state.s, state.l); },
  };
}

// ----- Drag helper: pointer events with capture for smooth tracking ------

function attachDrag(el, update) {
  let pid = null;
  el.addEventListener('pointerdown', (e) => {
    pid = e.pointerId;
    el.setPointerCapture(pid);
    update(e.clientX, e.clientY);
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid) return;
    update(e.clientX, e.clientY);
  });
  const end = (e) => {
    if (e.pointerId !== pid) return;
    el.releasePointerCapture(pid);
    pid = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

// ----- Color math -------------------------------------------------------
// The SL pad maps hex coordinates to HSL via HSV-style behavior:
//   x = HSV saturation, y = inverted HSV value.
// This gives the standard "photoshop" feel where (0,0) is pure white,
// (1,0) is pure hue, and the bottom edge is pure black.

function padXYToHsl(h, x, y) {
  const sV = x;       // HSV saturation
  const vV = 1 - y;   // HSV value
  // HSV → HSL conversion
  const l = vV * (1 - sV / 2);
  const s = (l === 0 || l === 1) ? 0 : (vV - l) / Math.min(l, 1 - l);
  return { s: clamp(s * 100, 0, 100), l: clamp(l * 100, 0, 100) };
}

function hslToPadXY(h, s, l) {
  const ls = l / 100, ss = s / 100;
  // HSL → HSV
  const vV = ls + ss * Math.min(ls, 1 - ls);
  const sV = vV === 0 ? 0 : 2 * (1 - ls / vV);
  return { x: clamp01(sV), y: clamp01(1 - vV) };
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function clamp01(v) { return clamp(v, 0, 1); }

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex) {
  if (!hex) return null;
  let m = hex.trim().replace(/^#/, '');
  if (m.length === 3) m = m.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h, s;
  if (max === min) { h = 0; s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}
