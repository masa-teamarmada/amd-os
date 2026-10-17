/**
 * 画像の縦横を見出しだけから読む処理（src/lib/image-dimensions.ts）の検査。
 *
 * 実行: npm run test:image-dimensions
 * 使う場所: DDの画像プレビュー（dd-confidentiality-server.ts の markDdImage）。
 *
 * 以前は画像処理ライブラリ sharp で縦横を読んでいた。置き換えても同じ縦横になることを、
 * 手元の sharp（Next.js の任意依存として入る。本番の関数には入れない）で実際の画像を作って突き合わせる。
 * DDが画像として開く PNG・JPEG・GIF・WebP の4形式と、読めない入力の扱いを見る。
 */

import sharp from "sharp";
import { readImageDimensions } from "../src/lib/image-dimensions.ts";

let failures = 0;
function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) return;
  failures++;
  console.error(`✗ ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
}

function canvas(width: number, height: number, alpha = false) {
  return sharp({
    create: { width, height, channels: alpha ? 4 : 3, background: alpha ? { r: 200, g: 30, b: 30, alpha: 0.5 } : { r: 200, g: 30, b: 30 } },
  });
}

const SIZES: Array<[number, number]> = [[1, 1], [37, 19], [320, 240], [1925, 817], [4000, 3000]];

const cases: Array<{ label: string; make: (w: number, h: number) => Promise<Buffer> }> = [
  { label: "PNG", make: (w, h) => canvas(w, h).png().toBuffer() },
  { label: "PNG 透過", make: (w, h) => canvas(w, h, true).png().toBuffer() },
  { label: "PNG パレット", make: (w, h) => canvas(w, h).png({ palette: true }).toBuffer() },
  { label: "JPEG", make: (w, h) => canvas(w, h).jpeg().toBuffer() },
  { label: "JPEG プログレッシブ", make: (w, h) => canvas(w, h).jpeg({ progressive: true }).toBuffer() },
  { label: "JPEG EXIF付き", make: (w, h) => canvas(w, h).jpeg().withMetadata({ orientation: 6 }).toBuffer() },
  { label: "GIF", make: (w, h) => canvas(w, h).gif().toBuffer() },
  { label: "WebP 非可逆", make: (w, h) => canvas(w, h).webp({ quality: 80 }).toBuffer() },
  { label: "WebP 可逆", make: (w, h) => canvas(w, h).webp({ lossless: true }).toBuffer() },
  { label: "WebP 透過", make: (w, h) => canvas(w, h, true).webp({ quality: 80 }).toBuffer() },
];

for (const { label, make } of cases) {
  for (const [w, h] of SIZES) {
    const bytes = await make(w, h);
    const expected = await sharp(bytes).metadata();
    const actual = readImageDimensions(new Uint8Array(bytes));
    check(`${label} ${w}x${h}: sharp と同じ縦横`, actual?.width === expected.width && actual?.height === expected.height, { actual, expected: { width: expected.width, height: expected.height } });
  }
}

// 動くGIF・WebPは画面に描かれる枠の縦横（1コマの大きさ）を返す。
{
  const frame = (r: number) => sharp({ create: { width: 64, height: 48, channels: 3, background: { r, g: 120, b: 200 } } }).png().toBuffer();
  const frames = await Promise.all([frame(0), frame(120), frame(240)]);
  for (const format of ["gif", "webp"] as const) {
    const animated = await sharp(frames, { join: { animated: true } }).toFormat(format).toBuffer();
    const meta = await sharp(animated).metadata();
    const dims = readImageDimensions(new Uint8Array(animated));
    check(`動く${format}: 1コマの枠と同じ縦横`, meta.pages === 3 && dims?.width === 64 && dims?.height === 48 && meta.width === 64 && (meta.pageHeight ?? meta.height) === 48, { dims, meta: { width: meta.width, height: meta.height, pages: meta.pages, pageHeight: meta.pageHeight } });
  }
}

// 読めない入力は null（呼び出し側は秘密表示付きの写しを作らずエラーを返す）。
const unreadable: Array<[string, Uint8Array]> = [
  ["空", new Uint8Array()],
  ["文字列", new TextEncoder().encode("not an image")],
  ["PNG署名だけ", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ["JPEGの始まりだけ", new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00])],
  ["RIFFだがWebPでない", new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WAVEfmt ")],
];
for (const [label, bytes] of unreadable) {
  check(`${label}: 読めないので null`, readImageDimensions(bytes) === null, readImageDimensions(bytes));
}
{
  const png = await canvas(320, 240).png().toBuffer();
  check("PNG 途中で切れたもの: null", readImageDimensions(new Uint8Array(png.subarray(0, 20))) === null);
  const jpeg = await canvas(320, 240).jpeg().toBuffer();
  const sof = jpeg.findIndex((value, index) => value === 0xff && jpeg[index + 1] === 0xc0);
  check("JPEG SOFの手前で切れたもの: null", readImageDimensions(new Uint8Array(jpeg.subarray(0, sof))) === null);
}

if (failures > 0) {
  console.error(`\n画像の縦横の読み取り: ${failures} 件失敗`);
  process.exit(1);
}
console.log("画像の縦横の読み取り: ok");
