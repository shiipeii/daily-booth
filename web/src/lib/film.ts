// the film look. everything happens on-device in a canvas:
//   capture  -> crop to 4:5            (the "original" we keep)
//   develop  -> tone curve, colour, grain, vignette
//   print    -> paper border with the date typed along the bottom
//
// to add a film stock, add an entry to FILMS.

import type { Film } from "./types";

export interface FilmStock {
  id: Film;
  label: string;
  /** css filter used for the live viewfinder (an approximation of develop()) */
  preview: string;
  lift: number;       // how far blacks are raised (0-255)
  ceiling: number;    // where whites top out (0-255)
  contrast: number;   // 1 = unchanged
  saturation: number; // 1 = unchanged, 0 = black and white
  tint: [number, number, number];
  grain: number;      // noise strength
  vignette: number;   // 0-1
}

export const FILMS: Record<Film, FilmStock> = {
  warm: {
    id: "warm",
    label: "warm",
    preview: "sepia(0.22) saturate(1.05) contrast(0.92) brightness(1.04)",
    lift: 20, ceiling: 246, contrast: 0.94, saturation: 0.92,
    tint: [1.06, 1.0, 0.88], grain: 14, vignette: 0.28,
  },
  faded: {
    id: "faded",
    label: "faded",
    preview: "saturate(0.62) contrast(0.84) brightness(1.08) sepia(0.08)",
    lift: 36, ceiling: 238, contrast: 0.86, saturation: 0.62,
    tint: [1.03, 1.0, 0.95], grain: 16, vignette: 0.22,
  },
  mono: {
    id: "mono",
    label: "mono",
    preview: "grayscale(1) contrast(0.96) brightness(1.05)",
    lift: 22, ceiling: 240, contrast: 1.04, saturation: 0,
    tint: [1.03, 1.0, 0.97], grain: 18, vignette: 0.3,
  },
};

export const FILM_ORDER: Film[] = ["warm", "faded", "mono"];

const ASPECT = 4 / 5;
const MAX_ORIGINAL_EDGE = 3000;
const MAX_FILM_EDGE = 2000;

// capture -----------------------------------------------------------------------------

/** crop a frame to 4:5 portrait, optionally mirrored (front camera) */
export function cropToCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  mirror: boolean,
): HTMLCanvasElement {
  let cw = sourceWidth;
  let ch = cw / ASPECT;
  if (ch > sourceHeight) {
    ch = sourceHeight;
    cw = ch * ASPECT;
  }
  const sx = (sourceWidth - cw) / 2;
  const sy = (sourceHeight - ch) / 2;

  const scale = Math.min(1, MAX_ORIGINAL_EDGE / ch);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cw * scale);
  canvas.height = Math.round(ch * scale);
  const ctx = canvas.getContext("2d")!;
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function cropFile(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const canvas = cropToCanvas(bitmap, bitmap.width, bitmap.height, false);
  bitmap.close();
  return canvas;
}

// develop -------------------------------------------------------------------------------

function curve(stock: FilmStock): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    // gentle s-curve around the midpoint, then squeeze into [lift, ceiling]
    const s = 0.5 + (x - 0.5) * stock.contrast;
    const y = stock.lift + Math.min(1, Math.max(0, s)) * (stock.ceiling - stock.lift);
    lut[i] = y;
  }
  return lut;
}

export function develop(original: HTMLCanvasElement, film: Film): HTMLCanvasElement {
  const stock = FILMS[film];
  const scale = Math.min(1, MAX_FILM_EDGE / original.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(original.width * scale);
  canvas.height = Math.round(original.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(original, 0, 0, canvas.width, canvas.height);

  const { width: w, height: h } = canvas;
  const image = ctx.getImageData(0, 0, w, h);
  const px = image.data;
  const lut = curve(stock);
  const [tr, tg, tb] = stock.tint;
  const sat = stock.saturation;
  const cx = w / 2;
  const cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = px[i];
      let g = px[i + 1];
      let b = px[i + 2];

      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      r = luma + (r - luma) * sat;
      g = luma + (g - luma) * sat;
      b = luma + (b - luma) * sat;

      r = lut[r < 0 ? 0 : r > 255 ? 255 : r | 0] * tr;
      g = lut[g < 0 ? 0 : g > 255 ? 255 : g | 0] * tg;
      b = lut[b < 0 ? 0 : b > 255 ? 255 : b | 0] * tb;

      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const v = 1 - stock.vignette * d * d;

      const noise = (Math.random() + Math.random() - 1) * stock.grain;

      px[i] = r * v + noise;
      px[i + 1] = g * v + noise;
      px[i + 2] = b * v + noise;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

// print ---------------------------------------------------------------------------------

const PAPER = "#F4F1EB";
const PRINT_INK = "#5A534C";

/** wraps a developed photo in a paper border; the date goes in the bottom margin */
export async function makePrint(photo: HTMLCanvasElement, dateText: string | null): Promise<HTMLCanvasElement> {
  const side = Math.round(photo.width * 0.045);
  const bottom = Math.round(photo.width * 0.16);
  const canvas = document.createElement("canvas");
  canvas.width = photo.width + side * 2;
  canvas.height = photo.height + side + bottom;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(photo, side, side);

  if (dateText) {
    const size = Math.round(photo.width * 0.042);
    try {
      await document.fonts.load(`700 ${size}px "Courier Prime"`);
    } catch {
      // fall back to the system monospace font
    }
    ctx.fillStyle = PRINT_INK;
    ctx.font = `700 ${size}px "Courier Prime", ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(dateText, canvas.width / 2, photo.height + side + bottom / 2);
  }
  return canvas;
}

export function toJpeg(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("could not save the photo"))), "image/jpeg", quality),
  );
}
