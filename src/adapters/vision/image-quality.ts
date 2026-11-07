import sharp from "sharp";

export interface ImageAnalysis {
  width: number;
  height: number;
  /** Variance of the Laplacian on a 1240-px-wide greyscale copy. Legible scans score 900+. */
  blurScore: number;
  /** Signed rotation of the text lines in degrees (positive = rotated clockwise). */
  skewDeg: number;
}

const BLUR_WIDTH = 1240;
const SKEW_WIDTH = 600;

/** Laplacian variance: low when edges are soft (blur), high when text is crisp. */
async function blurScore(buf: Buffer): Promise<number> {
  const { data, info } = await sharp(buf).greyscale().resize({ width: BLUR_WIDTH, withoutEnlargement: false }).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = data[i - w] + data[i + w] + data[i - 1] + data[i + 1] - 4 * data[i];
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/**
 * Projection-profile skew estimate: rotate the dark (ink) pixels by candidate angles and
 * pick the angle where rows of text line up best (sharpest row histogram).
 */
async function skewAngle(buf: Buffer): Promise<number> {
  const { data, info } = await sharp(buf).greyscale().resize({ width: SKEW_WIDTH }).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const xs: number[] = [], ys: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[y * w + x] < 110) { xs.push(x); ys.push(y); }
  if (xs.length < 200) return 0;
  const step = Math.max(1, Math.floor(xs.length / 30000));
  const score = (deg: number) => {
    const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
    const bins = new Map<number, number>();
    for (let i = 0; i < xs.length; i += step) {
      const row = Math.round(ys[i] * c - xs[i] * s);
      bins.set(row, (bins.get(row) ?? 0) + 1);
    }
    let sq = 0;
    for (const v of bins.values()) sq += v * v;
    return sq;
  };
  let best = 0, bestScore = -1;
  for (let d = -15; d <= 15; d += 0.5) {
    const sc = score(d);
    if (sc > bestScore) { bestScore = sc; best = d; }
  }
  for (let d = best - 0.5; d <= best + 0.5; d += 0.1) {
    const sc = score(d);
    if (sc > bestScore) { bestScore = sc; best = d; }
  }
  return Math.round(best * 10) / 10;
}

export async function analyseImage(buf: Buffer): Promise<ImageAnalysis> {
  const meta = await sharp(buf).metadata();
  const [blur, skew] = await Promise.all([blurScore(buf), skewAngle(buf)]);
  return { width: meta.width ?? 0, height: meta.height ?? 0, blurScore: Math.round(blur), skewDeg: skew };
}

/** Straighten an image by rotating it back by the measured skew (white fill). */
export async function deskew(buf: Buffer, skewDeg: number): Promise<Buffer> {
  if (Math.abs(skewDeg) < 0.5) return buf;
  return sharp(buf).rotate(-skewDeg, { background: "#ffffff" }).png().toBuffer();
}
