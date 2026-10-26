// Draws the Mezgeb app icons (an open dube book on ledger green) as PNGs, with no image
// dependencies. Usage: node scripts/make-icons.mjs
import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const GREEN = [0x1e, 0x6a, 0x52];
const PAPER = [0xf4, 0xf7, 0xf2];
const LINE = [0x9f, 0xc4, 0xb3];

/** Coverage-sampled drawing on a size×size canvas; shapes use 0..1 coordinates. */
function draw(size, { radius, inset }) {
  const px = new Uint8ClampedArray(size * size * 4);
  const S = 4; // samples per axis
  const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = Math.min(Math.max(x, x0 + r), x1 - r);
    const cy = Math.min(Math.max(y, y0 + r), y1 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  // The book: two pages meeting at a spine, slightly tilted like an open notebook.
  const k = 1 - 2 * inset;
  const m = (v) => inset + v * k;
  const pageL = (x, y) => inRoundRect(x, y, m(0.12), m(0.22), m(0.49), m(0.8), 0.03 * k);
  const pageR = (x, y) => inRoundRect(x, y, m(0.51), m(0.22), m(0.88), m(0.8), 0.03 * k);
  const lines = (x, y) => {
    for (const ly of [0.36, 0.48, 0.6]) {
      if (Math.abs(y - m(ly)) < 0.018 * k) {
        if ((x > m(0.18) && x < m(0.44)) || (x > m(0.56) && x < m(0.82))) return true;
      }
    }
    return false;
  };

  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let bg = 0;
      const acc = [0, 0, 0];
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = (pxi + (sx + 0.5) / S) / size;
          const y = (py + (sy + 0.5) / S) / size;
          if (!inRoundRect(x, y, 0, 0, 1, 1, radius)) continue;
          bg += 1;
          const c = lines(x, y) ? LINE : pageL(x, y) || pageR(x, y) ? PAPER : GREEN;
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
await writeFile(out('icon-192.png'), draw(192, { radius: 0.22, inset: 0 }));
await writeFile(out('icon-512.png'), draw(512, { radius: 0.22, inset: 0 }));
// Maskable: full bleed, the book inside the 80% safe zone.
await writeFile(out('maskable-512.png'), draw(512, { radius: 0, inset: 0.12 }));
// iOS adds its own rounding and needs no transparency.
await writeFile(out('apple-touch-icon.png'), draw(180, { radius: 0, inset: 0.04 }));
console.log('icons written');
