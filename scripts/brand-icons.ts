// Draws the Noon face mark (the round face and its smile) as SVG, PNG and ICO favicons in the
// app's own face colour. Pure Node (node:zlib only): no native image library, so it runs the same
// in the Replit build, in CI and on a laptop. The Vite plugin in ./vite-brand.ts calls it.

import { deflateSync } from 'node:zlib';

// The face circle and the smile, in the coordinates of client/brand/NoonLogo.tsx (from
// noon2-frontend ic_noon_logo_full.svg). Keep the two files in step.
export const FACE = { cx: 96.2618, cy: 28.7261, r: 27.9886 };
export const SMILE_PATH =
  'M96.0642 40.1616C104.661 48.4605 118.8 48.4605 127.396 40.1616C128.753 38.8158 126.491 37.1336 125.36 38.3672C117.895 45.6568 105.792 45.6568 98.2133 38.3672C96.9691 37.1336 94.7069 38.8158 96.0642 40.1616Z';
export const SMILE_COLOR = '#151515';
export const DEFAULT_FACE = '#64d8ae';
// The square box around the face and the end of the smile, shared by every mark rendering.
export const MARK_VIEWBOX = { x: 66.5, y: -3.3, size: 64 };

export function markSvg(face: string): string {
  const { x, y, size } = MARK_VIEWBOX;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${size} ${size}">`,
    `<circle cx="${FACE.cx}" cy="${FACE.cy}" r="${FACE.r}" fill="${face}"/>`,
    `<path d="${SMILE_PATH}" fill="${SMILE_COLOR}"/>`,
    '</svg>',
  ].join('');
}

// Reads `--app-face` from the `:root { }` blocks of client/app/theme.css. The last declaration
// wins, as in CSS, so the favicon matches the logo. Falls back to the Noon green when the value is
// missing or is not a plain hex colour (the favicon needs real pixels).
export function faceFromThemeCss(css: string): string {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rootBlocks = [...withoutComments.matchAll(/(?:^|[}\s;])\s*:root\s*\{([^}]*)\}/g)];
  const values = rootBlocks.flatMap((block) =>
    [...(block[1] ?? '').matchAll(/--app-face\s*:\s*([^;]*)/g)].map((m) => (m[1] ?? '').trim()),
  );
  const last = values.at(-1) ?? '';
  return /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(last) ? normalizeHex(last) : DEFAULT_FACE;
}

function normalizeHex(hex: string): string {
  const h = hex.slice(1).toLowerCase();
  return h.length === 3 ? `#${[...h].map((c) => c + c).join('')}` : `#${h}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex).slice(1);
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

type Point = [number, number];

// Supports the absolute M, C, L and Z commands that the logo paths use.
export function flattenPath(d: string, steps = 16): Point[] {
  const tokens = d.match(/[MCLZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const points: Point[] = [];
  let i = 0;
  let command = '';
  let current: Point = [0, 0];
  const next = (): number => Number(tokens[i++]);
  while (i < tokens.length) {
    const token = tokens[i] ?? '';
    if (/[MCLZ]/i.test(token)) {
      command = token.toUpperCase();
      i++;
      if (command === 'Z') continue;
    }
    if (command === 'M' || command === 'L') {
      current = [next(), next()];
      points.push(current);
    } else if (command === 'C') {
      const c1: Point = [next(), next()];
      const c2: Point = [next(), next()];
      const end: Point = [next(), next()];
      const start = current;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const u = 1 - t;
        points.push([
          u * u * u * start[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * end[0],
          u * u * u * start[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * end[1],
        ]);
      }
      current = end;
    } else {
      i++;
    }
  }
  return points;
}

function insidePolygon(x: number, y: number, polygon: Point[]): boolean {
  let inside = false;
  for (let a = 0, b = polygon.length - 1; a < polygon.length; b = a++) {
    const [xa, ya] = polygon[a] as Point;
    const [xb, yb] = polygon[b] as Point;
    if (ya > y !== yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) inside = !inside;
  }
  return inside;
}

// RGBA pixels of the mark at `size` x `size`, 4x4 supersampled. `background` fills the square
// (apple-touch-icon needs an opaque tile); without it the corners stay transparent.
export function rasterizeMark(size: number, face: string, background?: string): Uint8Array {
  const pixels = new Uint8Array(size * size * 4);
  const smile = flattenPath(SMILE_PATH);
  const faceRgb = hexToRgb(face);
  const smileRgb = hexToRgb(SMILE_COLOR);
  const backgroundRgb = background ? hexToRgb(background) : null;
  // The tile keeps a margin so the mark does not touch the edge of a rounded app icon.
  const inset = background ? 0.14 : 0;
  const box = MARK_VIEWBOX.size / (1 - 2 * inset);
  const originX = MARK_VIEWBOX.x - inset * box;
  const originY = MARK_VIEWBOX.y - inset * box;
  const samples = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let alpha = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = originX + ((px + (sx + 0.5) / samples) / size) * box;
          const y = originY + ((py + (sy + 0.5) / samples) / size) * box;
          let rgb: [number, number, number] | null = backgroundRgb;
          if ((x - FACE.cx) ** 2 + (y - FACE.cy) ** 2 <= FACE.r ** 2) rgb = faceRgb;
          if (insidePolygon(x, y, smile)) rgb = smileRgb;
          if (rgb) {
            r += rgb[0];
            g += rgb[1];
            b += rgb[2];
            alpha += 1;
          }
        }
      }
      const offset = (py * size + px) * 4;
      if (alpha > 0) {
        pixels[offset] = Math.round(r / alpha);
        pixels[offset + 1] = Math.round(g / alpha);
        pixels[offset + 2] = Math.round(b / alpha);
      }
      pixels[offset + 3] = Math.round((alpha / (samples * samples)) * 255);
    }
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function encodePng(size: number, rgba: Uint8Array): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * size * 4, size * 4).copy(
      rows,
      y * (size * 4 + 1) + 1,
    );
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// An ICO file whose frames are PNGs (supported by every browser that still asks for /favicon.ico).
export function encodeIco(frames: { size: number; png: Buffer }[]): Buffer {
  const directorySize = 6 + frames.length * 16;
  const header = Buffer.alloc(directorySize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = directorySize;
  frames.forEach((frame, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(frame.size >= 256 ? 0 : frame.size, entry);
    header.writeUInt8(frame.size >= 256 ? 0 : frame.size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frame.png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frame.png.length;
  });
  return Buffer.concat([header, ...frames.map((frame) => frame.png)]);
}

export interface BrandIcon {
  fileName: string;
  contentType: string;
  body: Buffer | string;
}

// Page colour of the light theme, used behind the apple-touch-icon (iOS fills transparency black).
const TILE_BACKGROUND = '#f8f5ef';

export function brandIcons(face: string): BrandIcon[] {
  const png = (size: number, background?: string) =>
    encodePng(size, rasterizeMark(size, face, background));
  return [
    { fileName: 'favicon.svg', contentType: 'image/svg+xml', body: markSvg(face) },
    { fileName: 'favicon-32.png', contentType: 'image/png', body: png(32) },
    {
      fileName: 'favicon.ico',
      contentType: 'image/x-icon',
      body: encodeIco([16, 32, 48].map((size) => ({ size, png: png(size) }))),
    },
    { fileName: 'apple-touch-icon.png', contentType: 'image/png', body: png(180, TILE_BACKGROUND) },
  ];
}
