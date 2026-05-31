// Generates the PWA PNG icons from scratch (no image-library dependency) so
// the app meets install criteria on platforms that require PNG/maskable icons.
// Draws the same line-art calendar glyph as the favicon: brand red (#ff5a5f)
// on the app's dark background (#0f1115).
//   node make-icons.mjs   ->   icons/icon-192.png, icon-512.png, icon-maskable-512.png
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const BG = [15, 17, 21, 255];     // #0f1115
const FG = [255, 90, 95, 255];    // #ff5a5f

const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let crc = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) crc = CRC[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8); return (crc ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

// pad = fractional safe-zone inset (bigger for maskable so the platform mask
// can't clip the glyph).
function makePNG(S, pad) {
  const rowLen = 1 + S * 4;
  const raw = Buffer.alloc(S * rowLen);
  const px = (x, y, c) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const o = y * rowLen + 1 + x * 4;
    raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = c[3];
  };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };

  rect(0, 0, S, S, BG);                              // background fill (maskable-safe)

  const r = (v) => Math.round(v);
  const cx0 = r(S * pad), cx1 = r(S * (1 - pad));
  const boxW = cx1 - cx0;
  const t = Math.max(2, r(S * 0.045));               // stroke weight
  const tick = r(S * 0.07);                          // binder-tick height
  const y0 = r(S * pad) + tick;                      // calendar top (room for ticks)
  const y1 = r(S * (1 - pad));                        // calendar bottom

  // calendar body outline
  rect(cx0, y0, boxW, t, FG);                        // top
  rect(cx0, y1 - t, boxW, t, FG);                    // bottom
  rect(cx0, y0, t, y1 - y0, FG);                     // left
  rect(cx1 - t, y0, t, y1 - y0, FG);                 // right
  // header divider
  rect(cx0, y0 + r((y1 - y0) * 0.30), boxW, t, FG);
  // two binder ticks above the top edge
  rect(cx0 + r(boxW * 0.26), y0 - tick, t, tick + t, FG);
  rect(cx0 + r(boxW * 0.74) - t, y0 - tick, t, tick + t, FG);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;  // 8-bit RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('icons', { recursive: true });
writeFileSync('icons/icon-192.png', makePNG(192, 0.20));
writeFileSync('icons/icon-512.png', makePNG(512, 0.20));
writeFileSync('icons/icon-maskable-512.png', makePNG(512, 0.30));
console.log('wrote icons/icon-192.png, icons/icon-512.png, icons/icon-maskable-512.png');
