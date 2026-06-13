// Dev-only icon generator: writes the PWA PNG icons with zero dependencies
// (pure Node: builds raw RGBA pixels and encodes a PNG via zlib). Re-run with
// `node tools/make-icons.mjs` if the brand art changes.

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = join(ROOT, 'icons');

// ---- Brand colors (RGBA) ------------------------------------------------
const BG = [79, 70, 229, 255]; // indigo-600 (#4f46e5)
const BG2 = [99, 102, 241, 255]; // indigo-500, used for a soft vertical gradient
const GOLD = [251, 191, 36, 255]; // amber-400
const GOLD_HI = [253, 224, 71, 255]; // amber-300 (peak jewels)
const RUBY = [244, 63, 94, 255]; // rose-500 (band jewels)

// ---- Crown geometry in art space [0,1] (y points down) ------------------
const BODY = [
  [0.16, 0.60],
  [0.16, 0.28],
  [0.34, 0.46],
  [0.50, 0.20],
  [0.66, 0.46],
  [0.84, 0.28],
  [0.84, 0.60],
];
const BAND = { x0: 0.16, y0: 0.60, x1: 0.84, y1: 0.74 };
const PEAKS = [
  [0.16, 0.28],
  [0.50, 0.20],
  [0.84, 0.28],
];
const BAND_JEWELS = [
  [0.30, 0.67],
  [0.50, 0.67],
  [0.70, 0.67],
];

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

const inRect = (x, y, r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

// Sample the art at normalized (u,v) in [0,1]; returns RGBA.
function sample(u, v, margin) {
  // Background vertical gradient (always covers the full tile, edge to edge).
  const t = v;
  const bg = [
    Math.round(BG[0] * (1 - t) + BG2[0] * t),
    Math.round(BG[1] * (1 - t) + BG2[1] * t),
    Math.round(BG[2] * (1 - t) + BG2[2] * t),
    255,
  ];

  // Map into the padded art region so the crown stays inside the safe area.
  const span = 1 - 2 * margin;
  const a = (u - margin) / span;
  const b = (v - margin) / span;
  if (a < 0 || a > 1 || b < 0 || b > 1) return bg;

  for (const [px, py] of PEAKS) if (inCircle(a, b, px, py, 0.045)) return GOLD_HI;
  for (const [jx, jy] of BAND_JEWELS) if (inCircle(a, b, jx, jy, 0.032)) return RUBY;
  if (inRect(a, b, BAND)) return GOLD;
  if (pointInPolygon(a, b, BODY)) return GOLD;
  return bg;
}

function renderPng(size, margin) {
  const SS = 4; // supersample for smooth edges
  const big = size * SS;
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, bl = 0, al = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x * SS + sx + 0.5) / big;
          const v = (y * SS + sy + 0.5) / big;
          const c = sample(u, v, margin);
          r += c[0]; g += c[1]; bl += c[2]; al += c[3];
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      out[i] = Math.round(r / n);
      out[i + 1] = Math.round(g / n);
      out[i + 2] = Math.round(bl / n);
      out[i + 3] = Math.round(al / n);
    }
  }
  return encodePng(size, size, out);
}

// ---- Minimal PNG encoder (8-bit RGBA) -----------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- Emit the files -----------------------------------------------------
const targets = [
  ['icon-192.png', 192, 0.08],
  ['icon-512.png', 512, 0.08],
  ['maskable-512.png', 512, 0.18], // extra padding for the maskable safe zone
  ['favicon.png', 48, 0.06],
  ['apple-touch-icon.png', 180, 0.08],
];

for (const [name, size, margin] of targets) {
  const png = renderPng(size, margin);
  writeFileSync(join(ICONS, name), png);
  console.log(`wrote icons/${name} (${size}x${size}, ${png.length} bytes)`);
}
