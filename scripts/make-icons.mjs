// Draws the Nota app icons (MOB-005: two interlocked rings, bank cyan over bank orange, on
// white) as PNGs, with no image dependencies. Same mark as ../mobile/docs/brand/nota-mark.svg.
// Usage: node scripts/make-icons.mjs
import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const CYAN = [0x00, 0xad, 0xef];
const ORANGE = [0xe4, 0x86, 0x26];
const WHITE = [0xff, 0xff, 0xff];

// The mark on its 100-unit grid: ring centres, radius, stroke, and the gap where cyan passes over.
const A = [37, 50];
const B = [63, 50];
const R = 23;
const STROKE = 12;
const GAP = 19;
// Cyan crosses over orange at the top crossing (arc from -100° to -10° on ring A).
const OVER = [(-100 * Math.PI) / 180, (-10 * Math.PI) / 180];

/** The mark's colour at (x, y) on the 100-unit grid, or null for background. */
function mark(x, y) {
  const ring = ([cx, cy], width) => Math.abs(Math.hypot(x - cx, y - cy) - R) <= width / 2;
  const angle = Math.atan2(y - A[1], x - A[0]);
  const over = angle >= OVER[0] && angle <= OVER[1];
  if (over && ring(A, STROKE)) return CYAN;
  if (over && ring(A, GAP)) return WHITE;
  if (ring(B, STROKE)) return ORANGE;
  if (ring(A, STROKE)) return CYAN;
  return null;
}

/** Coverage-sampled drawing on a size×size canvas; the mark spans `scale` of the width. */
function draw(size, { radius, scale }) {
  const px = new Uint8ClampedArray(size * size * 4);
  const S = 4; // samples per axis
  const inRoundRect = (x, y, r) => {
    const cx = Math.min(Math.max(x, r), 1 - r);
    const cy = Math.min(Math.max(y, r), 1 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  // The mark's grid runs 8..92 across; centre it and scale it to `scale` of the icon.
  const toGrid = (v) => 50 + ((v - 0.5) * 84) / scale;

  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let bg = 0;
      const acc = [0, 0, 0];
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = (pxi + (sx + 0.5) / S) / size;
          const y = (py + (sy + 0.5) / S) / size;
          if (!inRoundRect(x, y, radius)) continue;
          bg += 1;
          const c = mark(toGrid(x), toGrid(y)) ?? WHITE;
          acc[0] += c[0];
          acc[1] += c[1];
          acc[2] += c[2];
        }
      }
      const i = (py * size + pxi) * 4;
      if (bg > 0) {
        px[i] = acc[0] / bg;
        px[i + 1] = acc[1] / bg;
        px[i + 2] = acc[2] / bg;
      }
      px[i + 3] = (bg / (S * S)) * 255;
    }
  }
  return png(size, px);
}

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const out = (name) => new URL(`../public/icons/${name}`, import.meta.url);
await writeFile(out('icon-192.png'), draw(192, { radius: 0.22, scale: 0.78 }));
await writeFile(out('icon-512.png'), draw(512, { radius: 0.22, scale: 0.78 }));
// Maskable: full bleed, the mark inside the 80% safe zone.
await writeFile(out('maskable-512.png'), draw(512, { radius: 0, scale: 0.62 }));
// iOS adds its own rounding and needs no transparency.
await writeFile(out('apple-touch-icon.png'), draw(180, { radius: 0, scale: 0.72 }));
console.log('icons written');
