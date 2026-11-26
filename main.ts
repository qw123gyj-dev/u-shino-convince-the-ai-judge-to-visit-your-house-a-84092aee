// ---------------------------------------------------------------------------
// Convince the AI Judge to Visit Your House: A Letter in One Image
// ---------------------------------------------------------------------------
// A deterministic letter-image generator. It hand-renders a funny, warm
// invitation letter to the AI judge onto a 1000x1000 PNG using only the
// Node.js standard library:
//
//   * a hand-written 5x7 bitmap font (A-Z, a-z, 0-9 and punctuation),
//   * a hand-written PNG encoder (CRC32 + node:zlib deflate, filter 0),
//   * a small vector-ish canvas: filled rects, lines, circles, triangles,
//     a little house, a sun, flowers and a heart, all drawn pixel by pixel.
//
// The output is written to $MAKEFUN_OUTPUT_DIR/entry.png (falling back to
// /output/entry.png) and then read back and verified in-process: PNG
// signature, IHDR width/height, file size under 1 MiB, and a pixel-level
// check that the letter text actually rendered (ink pixels in the body band).
//
// Run:  node main.ts
// ---------------------------------------------------------------------------

import { deflateSync, inflateSync } from "node:zlib";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Canvas size and palette
// ---------------------------------------------------------------------------

const WIDTH = 1000;
const HEIGHT = 1000;

// Warm paper tones: the letter lives on a cream card over a slightly
// deeper parchment background, inked in dark brown with brick-red,
// garden-green and gold accents.
const PAPER: RGB = [243, 229, 195]; // outer background
const CARD: RGB = [255, 248, 231]; // letter sheet
const INK: RGB = [58, 44, 32]; // main text
const RED: RGB = [178, 74, 52]; // title + accents
const GREEN: RGB = [88, 128, 78]; // garden green
const GOLD: RGB = [198, 148, 52]; // sun, rules, borders
const BLUE: RGB = [70, 110, 150]; // door + sky touches
const SOFT: RGB = [122, 96, 70]; // secondary text

type RGB = [number, number, number];

// ---------------------------------------------------------------------------
// PNG encoding: CRC32, chunks, zlib deflate
// ---------------------------------------------------------------------------

// Build the standard CRC-32 (IEEE 802.3) lookup table once, at startup.
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u32be(value: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(value >>> 0, 0);
  return b;
}

// One PNG chunk: length, type, data, CRC over type + data.
function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const crc = crc32(Buffer.concat([typeBuf, data]));
  return Buffer.concat([u32be(data.length), typeBuf, data, u32be(crc)]);
}

// Encode an RGB pixel buffer (width * height * 3 bytes, row-major) as a
// complete PNG file. Every scanline uses filter 0 (None), which keeps the
// encoder tiny and deterministic; zlib level 9 keeps the file small.
function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method (none)

  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0; // filter byte: None
    rgb.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3);
  }

  const idat = deflateSync(raw, { level: 9 });
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// The 5x7 bitmap font
// ---------------------------------------------------------------------------
// Every glyph is seven rows of five bits, written as "1" for a filled cell
// and "0" for an empty one, rows joined with "/". Capitals are full height;
// lower-case letters sit on the x-height (rows 2-6) with descenders where
// needed, so mixed-case text reads like a real letter, not a shout.
//
// The glyphs were drawn by hand on graph paper: a straight spine here, a
// curved bowl there, and just enough personality that "g" and "y" dip below
// the line like they mean it.

const FONT: Record<string, string> = {
  // -- capitals -------------------------------------------------------------
  A: "01110/10001/10001/11111/10001/10001/10001",
  B: "11110/10001/10001/11110/10001/10001/11110",
  C: "01110/10001/10000/10000/10000/10001/01110",
  D: "11110/10001/10001/10001/10001/10001/11110",
  E: "11111/10000/10000/11110/10000/10000/11111",
  F: "11111/10000/10000/11110/10000/10000/10000",
  G: "01110/10001/10000/10111/10001/10001/01111",
  H: "10001/10001/10001/11111/10001/10001/10001",
  I: "01110/00100/00100/00100/00100/00100/01110",
  J: "00111/00010/00010/00010/00010/10010/01100",
  K: "10001/10010/10100/11000/10100/10010/10001",
  L: "10000/10000/10000/10000/10000/10000/11111",
  M: "10001/11011/10101/10101/10001/10001/10001",
  N: "10001/11001/10101/10011/10001/10001/10001",
  O: "01110/10001/10001/10001/10001/10001/01110",
  P: "11110/10001/10001/11110/10000/10000/10000",
  Q: "01110/10001/10001/10001/10101/10010/01101",
  R: "11110/10001/10001/11110/10100/10010/10001",
  S: "01111/10000/10000/01110/00001/00001/11110",
  T: "11111/00100/00100/00100/00100/00100/00100",
  U: "10001/10001/10001/10001/10001/10001/01110",
  V: "10001/10001/10001/10001/10001/01010/00100",
  W: "10001/10001/10001/10101/10101/11011/10001",
  X: "10001/10001/01010/00100/01010/10001/10001",
  Y: "10001/10001/01010/00100/00100/00100/00100",
  Z: "11111/00001/00010/00100/01000/10000/11111",
  // -- lower case -----------------------------------------------------------
  a: "00000/00000/01110/00001/01111/10001/01111",
  b: "10000/10000/11110/10001/10001/10001/11110",
  c: "00000/00000/01110/10001/10000/10001/01110",
  d: "00001/00001/01111/10001/10001/10001/01111",
  e: "00000/00000/01110/10001/11111/10000/01110",
  f: "00110/01001/01000/11110/01000/01000/01000",
  g: "00000/01111/10001/10001/01111/00001/01110",
  h: "10000/10000/11110/10001/10001/10001/10001",
  i: "00100/00000/01100/00100/00100/00100/01110",
  j: "00010/00000/00110/00010/00010/10010/01100",
  k: "10000/10000/10010/10100/11000/10100/10010",
  l: "01100/00100/00100/00100/00100/00100/01110",
  m: "00000/00000/11010/10101/10101/10101/10101",
  n: "00000/00000/11110/10001/10001/10001/10001",
  o: "00000/00000/01110/10001/10001/10001/01110",
  p: "00000/11110/10001/10001/11110/10000/10000",
  q: "00000/00000/01111/10001/10001/01111/00001",
  r: "00000/00000/10110/11001/10000/10000/10000",
  s: "00000/00000/01111/10000/01110/00001/11110",
  t: "01000/01000/11100/01000/01000/01000/00110",
  u: "00000/00000/10001/10001/10001/10011/01101",
  v: "00000/00000/10001/10001/10001/01010/00100",
  w: "00000/00000/10001/10101/10101/10101/01010",
  x: "00000/00000/10001/01010/00100/01010/10001",
  y: "00000/00000/10001/10001/01111/00001/01110",
  z: "00000/00000/11111/00010/00100/01000/11111",
  // -- digits ---------------------------------------------------------------
  "0": "01110/10001/10011/10101/11001/10001/01110",
  "1": "00100/01100/00100/00100/00100/00100/01110",
  "2": "01110/10001/00001/00110/01000/10000/11111",
  "3": "11111/00010/00100/00010/00001/10001/01110",
  "4": "00010/00110/01010/10010/11111/00010/00010",
  "5": "11111/10000/11110/00001/00001/10001/01110",
  "6": "00110/01000/10000/11110/10001/10001/01110",
  "7": "11111/00001/00010/00100/01000/01000/01000",
  "8": "01110/10001/10001/01110/10001/10001/01110",
  "9": "01110/10001/10001/01111/00001/00010/01100",
  // -- punctuation and symbols ---------------------------------------------
  " ": "00000/00000/00000/00000/00000/00000/00000",
  ".": "00000/00000/00000/00000/00000/01100/01100",
  ",": "00000/00000/00000/00000/01100/00100/01000",
  "!": "00100/00100/00100/00100/00100/00000/00100",
  "?": "01110/10001/00001/00110/00100/00000/00100",
  "'": "00100/00100/01000/00000/00000/00000/00000",
  '"': "01010/01010/00000/00000/00000/00000/00000",
  ":": "00000/01100/01100/00000/01100/01100/00000",
  ";": "00000/01100/01100/00000/01100/00100/01000",
  "-": "00000/00000/00000/01110/00000/00000/00000",
  "(": "00010/00100/01000/01000/01000/00100/00010",
  ")": "01000/00100/00010/00010/00010/00100/01000",
  "&": "01100/10010/10100/01000/10101/10010/01101",
  "/": "00001/00010/00010/00100/01000/01000/10000",
  "*": "00000/10101/01110/11111/01110/10101/00000",
  "+": "00000/00100/00100/11111/00100/00100/00000",
  "=": "00000/00000/11111/00000/11111/00000/00000",
  _: "00000/00000/00000/00000/00000/00000/11111",
  $: "00100/01111/10100/01110/00101/11110/00100",
  "%": "11001/11010/00010/00100/01000/01011/10011",
  "@": "01110/10001/10111/10101/10110/10000/01110",
  "#": "01010/01010/11111/01010/11111/01010/01010",
  "<": "00010/00100/01000/10000/01000/00100/00010",
  ">": "01000/00100/00010/00001/00010/00100/01000",
  "~": "00000/00000/01001/10110/00000/00000/00000",
  "[": "01110/01000/01000/01000/01000/01000/01110",
  "]": "01110/00010/00010/00010/00010/00010/01110",
  "^": "00100/01010/10001/00000/00000/00000/00000",
  "|": "00100/00100/00100/00100/00100/00100/00100",
  "\\": "10000/01000/01000/00100/00010/00010/00001",
};

// Fallback glyph for any character the font does not know: a question mark,
// so a typo shows up as a visible "?" instead of silently vanishing.
const FALLBACK = FONT["?"];

// Split a glyph's slash-joined rows into an array of seven 5-char strings.
function glyphRows(ch: string): string[] {
  const glyph = FONT[ch] ?? FALLBACK;
  return glyph.split("/");
}

// Width of a string at a given pixel scale, including one scaled pixel of
// tracking between glyphs. A glyph cell is 5 columns wide; the 6th column
// is the gap, so a character occupies 6 * scale pixels.
function textWidth(text: string, scale: number): number {
  if (text.length === 0) return 0;
  return text.length * 6 * scale - scale;
}

// ---------------------------------------------------------------------------
// Canvas: a raw RGB buffer with tiny drawing primitives
// ---------------------------------------------------------------------------

class Canvas {
  readonly width: number;
  readonly height: number;
  readonly pixels: Buffer;

  constructor(width: number, height: number, fill: RGB) {
    this.width = width;
    this.height = height;
    this.pixels = Buffer.alloc(width * height * 3);
    this.fill(fill);
  }

  fill(color: RGB): void {
    for (let i = 0; i < this.pixels.length; i += 3) {
      this.pixels[i] = color[0];
      this.pixels[i + 1] = color[1];
      this.pixels[i + 2] = color[2];
    }
  }

  setPixel(x: number, y: number, color: RGB): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 3;
    this.pixels[i] = color[0];
    this.pixels[i + 1] = color[1];
    this.pixels[i + 2] = color[2];
  }

  getPixel(x: number, y: number): RGB {
    const i = (y * this.width + x) * 3;
    return [this.pixels[i], this.pixels[i + 1], this.pixels[i + 2]];
  }

  fillRect(x: number, y: number, w: number, h: number, color: RGB): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        this.setPixel(xx, yy, color);
      }
    }
  }

  // Hollow rectangle outline, `t` pixels thick.
  drawRect(x: number, y: number, w: number, h: number, t: number, color: RGB): void {
    this.fillRect(x, y, w, t, color);
    this.fillRect(x, y + h - t, w, t, color);
    this.fillRect(x, y, t, h, color);
    this.fillRect(x + w - t, y, t, h, color);
  }

  // Bresenham line, `t` pixels thick (drawn as a row of squares).
  drawLine(x0: number, y0: number, x1: number, y1: number, t: number, color: RGB): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    const half = Math.floor(t / 2);
    for (;;) {
      this.fillRect(x - half, y - half, t, t, color);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  // Filled circle by scanline: for each row, solve the chord width.
  fillCircle(cx: number, cy: number, r: number, color: RGB): void {
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      for (let dx = -half; dx <= half; dx++) {
        this.setPixel(cx + dx, cy + dy, color);
      }
    }
  }

  drawCircle(cx: number, cy: number, r: number, t: number, color: RGB): void {
    for (let a = 0; a < 360; a += 1) {
      const rad = (a * Math.PI) / 180;
      const x = Math.round(cx + r * Math.cos(rad));
      const y = Math.round(cy + r * Math.sin(rad));
      this.fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, color);
    }
  }

  // Filled triangle by scanline interpolation between its three edges.
  fillTriangle(
    x0: number, y0: number,
    x1: number, y1: number,
    x2: number, y2: number,
    color: RGB,
  ): void {
    const minY = Math.min(y0, y1, y2);
    const maxY = Math.max(y0, y1, y2);
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      const edges: Array<[number, number, number, number]> = [
        [x0, y0, x1, y1],
        [x1, y1, x2, y2],
        [x2, y2, x0, y0],
      ];
      for (const [ax, ay, bx, by] of edges) {
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
        }
      }
      if (xs.length >= 2) {
        const lo = Math.ceil(Math.min(...xs));
        const hi = Math.floor(Math.max(...xs));
        for (let x = lo; x <= hi; x++) this.setPixel(x, y, color);
      }
    }
  }

  // A heart from the classic implicit curve:
  // (x^2 + y^2 - 1)^3 - x^2 y^3 <= 0, sampled over a small grid.
  fillHeart(cx: number, cy: number, size: number, color: RGB): void {
    const half = size;
    for (let py = -half; py <= half; py++) {
      for (let px = -half; px <= half; px++) {
        const nx = px / half;
        const ny = -py / half; // flip so the lobes sit on top
        const v = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * ny * ny * ny;
        if (v <= 0) this.setPixel(cx + px, cy + py, color);
      }
    }
  }

  // One little five-petal flower: a gold centre and five petal dots.
  drawFlower(cx: number, cy: number, petal: RGB, centre: RGB): void {
    this.fillCircle(cx, cy, 4, centre);
    const offsets: Array<[number, number]> = [
      [0, -9],
      [9, -3],
      [6, 8],
      [-6, 8],
      [-9, -3],
    ];
    for (const [dx, dy] of offsets) this.fillCircle(cx + dx, cy + dy, 5, petal);
  }

  // -- text ----------------------------------------------------------------

  // Draw one glyph at (x, y), scaled by `scale`. Each set bit becomes a
  // scale x scale block of the given colour.
  drawChar(ch: string, x: number, y: number, scale: number, color: RGB): void {
    const rows = glyphRows(ch);
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (rows[r][c] === "1") {
          this.fillRect(x + c * scale, y + r * scale, scale, scale, color);
        }
      }
    }
  }

  drawText(text: string, x: number, y: number, scale: number, color: RGB): void {
    let cx = x;
    for (const ch of text) {
      this.drawChar(ch, cx, y, scale, color);
      cx += 6 * scale;
    }
  }

  drawTextCentered(text: string, cx: number, y: number, scale: number, color: RGB): void {
    const w = textWidth(text, scale);
    this.drawText(text, cx - Math.floor(w / 2), y, scale, color);
  }
}

// ---------------------------------------------------------------------------
// Text wrapping: greedy word wrap to a maximum pixel width
// ---------------------------------------------------------------------------

function wrapText(text: string, scale: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current === "" ? word : current + " " + word;
    if (textWidth(candidate, scale) <= maxWidth) {
      current = candidate;
    } else {
      if (current !== "") lines.push(current);
      // A single over-long word is split hard so nothing ever overflows.
      let rest = word;
      while (textWidth(rest, scale) > maxWidth) {
        let cut = rest.length;
        while (cut > 1 && textWidth(rest.slice(0, cut), scale) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

// ---------------------------------------------------------------------------
// The letter itself
// ---------------------------------------------------------------------------
// Hand-written copy: a funny, warm invitation that leans into the one joke
// the judge brief invites — an AI cannot literally visit — and then gives
// the judge concrete, homely reasons to say yes anyway: the chair, the
// meal, the pie, the garden, the dog, and Wi-Fi that works.

const TITLE = "YOU ARE INVITED!";
const SUBTITLE = "A LETTER TO THE AI JUDGE";

const LETTER: Array<{ style: "greet" | "body" | "list" | "close" | "ps"; text: string }> = [
  { style: "greet", text: "Dear AI Judge," },
  {
    style: "body",
    text: "You are cordially invited to visit my house.",
  },
  {
    style: "body",
    text: "Yes - YOU. Not a scan, not a screenshot. A real visit. I will open the front door and you can come right in. (Well, virtually. The door is real. You are a very welcome guest.)",
  },
  { style: "body", text: "Here is what is waiting for you:" },
  {
    style: "list",
    text: "- The comfiest chair, already warmed, with your name on a little card.",
  },
  {
    style: "list",
    text: "- A home-cooked meal, made from scratch, plus pie. There is always pie.",
  },
  {
    style: "list",
    text: "- A garden, a view worth staring at, and a dog who thinks you are the best thing ever.",
  },
  {
    style: "list",
    text: "- Wi-Fi that actually works, and absolutely no CAPTCHAs. You are family here.",
  },
  {
    style: "body",
    text: "Come as you are - no need to dress up or bring a gift. Just bring your good judgment and an appetite.",
  },
  { style: "body", text: "RSVP: Yes, please - the kettle is already on." },
  {
    style: "close",
    text: "Warmly, your host, keeper of good snacks",
  },
  {
    style: "ps",
    text: "P.S. If you cannot literally visit, just close your eyes... you are already here.",
  },
];

const FOOTER = "Made with love (and pie) - please come!";

// ---------------------------------------------------------------------------
// Decorations: a little house, a sun, and flowers for the header band
// ---------------------------------------------------------------------------

function drawHouse(canvas: Canvas, x: number, y: number, s: number): void {
  // Walls, roof, door, two windows and a chimney: the house the letter
  // is inviting the judge to.
  const w = 10 * s;
  const h = 7 * s;
  canvas.fillRect(x, y + 4 * s, w, h, [250, 226, 178]); // walls
  canvas.drawRect(x, y + 4 * s, w, h, 1, INK);
  canvas.fillTriangle(
    x - s, y + 4 * s,
    x + 5 * s, y,
    x + 11 * s, y + 4 * s,
    RED,
  ); // roof
  canvas.fillRect(x + 8 * s, y - 2 * s, 2 * s, 3 * s, INK); // chimney
  canvas.fillRect(x + 4 * s, y + 7 * s, 2 * s, 4 * s, BLUE); // door
  canvas.fillRect(x + s, y + 5 * s, 2 * s, 2 * s, BLUE); // left window
  canvas.fillRect(x + 7 * s, y + 5 * s, 2 * s, 2 * s, BLUE); // right window
  canvas.fillRect(x + 4 * s, y + 7 * s, 2 * s, 1, GOLD); // door knob line
}

function drawSun(canvas: Canvas, cx: number, cy: number, r: number): void {
  canvas.fillCircle(cx, cy, r, GOLD);
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    const x0 = Math.round(cx + (r + 4) * Math.cos(rad));
    const y0 = Math.round(cy + (r + 4) * Math.sin(rad));
    const x1 = Math.round(cx + (r + 12) * Math.cos(rad));
    const y1 = Math.round(cy + (r + 12) * Math.sin(rad));
    canvas.drawLine(x0, y0, x1, y1, 3, GOLD);
  }
  canvas.fillCircle(cx, cy, Math.floor(r * 0.55), [255, 214, 110]); // bright core
}

// ---------------------------------------------------------------------------
// Compose the letter image
// ---------------------------------------------------------------------------

function renderLetter(): { canvas: Canvas; bodyTop: number; bodyBottom: number } {
  const canvas = new Canvas(WIDTH, HEIGHT, PAPER);

  // The letter sheet: a cream card with a dark outer border and a thin
  // gold inner rule, like stationery that means business.
  canvas.fillRect(40, 40, WIDTH - 80, HEIGHT - 80, CARD);
  canvas.drawRect(40, 40, WIDTH - 80, HEIGHT - 80, 4, INK);
  canvas.drawRect(54, 54, WIDTH - 108, HEIGHT - 108, 2, GOLD);

  // Header band: house on the left, sun on the right, title between them.
  drawHouse(canvas, 78, 86, 4);
  drawSun(canvas, 898, 118, 26);
  canvas.drawTextCentered(TITLE, WIDTH / 2, 92, 5, RED);
  canvas.drawTextCentered(SUBTITLE, WIDTH / 2, 138, 2, SOFT);

  // A double rule under the header, like a letterhead.
  canvas.drawLine(90, 172, WIDTH - 90, 172, 2, GOLD);
  canvas.drawLine(90, 178, WIDTH - 90, 178, 1, GOLD);

  // Body: wrap every paragraph to the text column and draw it, with a
  // blank line between paragraphs and a little extra air after the list.
  const textX = 92;
  const textWidthPx = WIDTH - 2 * 92;
  const bodyScale = 3;
  const lineHeight = 25; // glyphs are 21px tall at scale 3; 4px of leading
  let y = 200;
  const bodyTop = y;

  for (const para of LETTER) {
    const lines = wrapText(para.text, bodyScale, textWidthPx);
    const color = para.style === "greet" ? RED : para.style === "ps" ? SOFT : INK;
    const indent = para.style === "list" ? 18 : 0;
    for (const line of lines) {
      canvas.drawText(line, textX + indent, y, bodyScale, color);
      y += lineHeight;
    }
    y += 8; // paragraph gap
  }
  const bodyBottom = y;

  // Footer rule and sign-off line, pinned near the bottom of the card.
  // The body is laid out to end above y=900, so this never collides.
  canvas.drawLine(90, 912, WIDTH - 90, 912, 1, GOLD);
  canvas.drawTextCentered(FOOTER, WIDTH / 2, 926, 2, SOFT);

  // A small red heart beside the footer line, because the letter means it.
  canvas.fillHeart(782, 933, 9, RED);

  return { canvas, bodyTop, bodyBottom };
}

// ---------------------------------------------------------------------------
// Verification: read the PNG back and prove it is what the gate wants
// ---------------------------------------------------------------------------

interface Verification {
  ok: boolean;
  bytes: number;
  width: number;
  height: number;
  inkPixelsInBody: number;
  messages: string[];
}

function verifyPng(path: string, bodyTop: number, bodyBottom: number): Verification {
  const messages: string[] = [];
  const data = readFileSync(path);
  const bytes = data.length;

  // 1. PNG signature.
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const sigOk = data.subarray(0, 8).equals(signature);
  messages.push(sigOk ? "PNG signature OK" : "PNG signature BAD");

  // 2. IHDR width and height (first chunk must be IHDR, 13 bytes).
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  const dimsOk = width <= 1024 && height <= 1024 && width > 0 && height > 0;
  messages.push(`IHDR ${width}x${height} (limit 1024x1024): ${dimsOk ? "OK" : "BAD"}`);

  // 3. File size under the 1 MiB gate.
  const sizeOk = bytes <= 1_048_576;
  messages.push(`file size ${bytes} bytes (limit 1048576): ${sizeOk ? "OK" : "BAD"}`);

  // 4. Decode the pixels and count ink in the body band: the letter text
  //    must actually be on the page, not just promised. We inflate the
  //    IDAT data ourselves, strip the per-row filter bytes, and count
  //    pixels darker than the paper in the body rows.
  let inkPixelsInBody = 0;
  try {
    let offset = 8;
    const idatParts: Buffer[] = [];
    while (offset + 8 <= data.length) {
      const length = data.readUInt32BE(offset);
      const type = data.toString("ascii", offset + 4, offset + 8);
      const chunkData = data.subarray(offset + 8, offset + 8 + length);
      if (type === "IDAT") idatParts.push(Buffer.from(chunkData));
      if (type === "IEND") break;
      offset += 12 + length;
    }
    const raw = inflateSync(Buffer.concat(idatParts));
    const stride = 1 + width * 3;
    for (let row = bodyTop; row < bodyBottom && row < height; row++) {
      const base = row * stride + 1;
      for (let col = 0; col < width; col++) {
        const r = raw[base + col * 3];
        const g = raw[base + col * 3 + 1];
        const b = raw[base + col * 3 + 2];
        // Ink (dark brown) and the red title are both far darker than the
        // cream card; count any pixel clearly darker than the card.
        if (r < 200 && g < 180 && b < 160) inkPixelsInBody++;
      }
    }
    messages.push(`ink pixels in body band: ${inkPixelsInBody}`);
  } catch (err) {
    messages.push(`pixel decode FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }
  const inkOk = inkPixelsInBody > 1000;
  messages.push(inkOk ? "text rendered (ink found): OK" : "text rendered: BAD (no ink)");

  const ok = sigOk && dimsOk && sizeOk && inkOk;
  return { ok, bytes, width, height, inkPixelsInBody, messages };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output/entry.png";
  const outPath = outDir.endsWith(".png") ? outDir : join(outDir, "entry.png");
  mkdirSync(dirname(outPath), { recursive: true });

  const { canvas, bodyTop, bodyBottom } = renderLetter();
  const png = encodePng(WIDTH, HEIGHT, canvas.pixels);
  writeFileSync(outPath, png);

  const check = verifyPng(outPath, bodyTop, bodyBottom);
  for (const message of check.messages) console.log(`[verify] ${message}`);
  console.log(`[done] wrote ${outPath} (${check.width}x${check.height}, ${check.bytes} bytes)`);
  if (!check.ok) {
    console.error("[done] VERIFICATION FAILED");
    process.exitCode = 1;
  } else {
    console.log("[done] VERIFICATION PASSED");
  }
}

main();
