/**
 * 画像の縦横ピクセル数を、ファイル先頭の見出し部分だけから読む。
 *
 * DDの画像プレビュー（秘密表示付きSVG、dd-confidentiality-server.ts の markDdImage）が使う。
 * 以前は画像処理ライブラリ sharp で縦横だけを読んでいたが、sharp の実行ファイル一式（約25MB）が
 * DDの各サーバ処理へ重複して同梱され、Vercel の Functions Storage を1デプロイあたり約47MB押し上げていた
 * （2026-10-17 実測）。DDが画像として開くのは PNG・JPEG・GIF・WebP の4形式だけ
 * （dd-payload.ts の ddDocumentPreview）なので、この4形式の見出しを直接読む。
 *
 * 返す値は sharp の metadata() と同じく、保存されている縦横（JPEG の EXIF 回転は適用しない）。
 * 動くGIF・WebPは画面に描かれる枠（論理画面・キャンバス）の縦横を返す。
 * 形式が分からない・見出しが壊れている場合は null。
 */
export type ImageDimensions = { width: number; height: number };

export function readImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  return readPng(bytes) ?? readGif(bytes) ?? readWebp(bytes) ?? readJpeg(bytes);
}

function sized(width: number, height: number): ImageDimensions | null {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 ? { width, height } : null;
}

function ascii(b: Uint8Array, offset: number, length: number): string {
  if (offset + length > b.length) return "";
  return String.fromCharCode(...b.subarray(offset, offset + length));
}

function u16be(b: Uint8Array, o: number): number {
  return o + 2 <= b.length ? (b[o] << 8) | b[o + 1] : NaN;
}

function u16le(b: Uint8Array, o: number): number {
  return o + 2 <= b.length ? b[o] | (b[o + 1] << 8) : NaN;
}

function u24le(b: Uint8Array, o: number): number {
  return o + 3 <= b.length ? b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) : NaN;
}

function u32be(b: Uint8Array, o: number): number {
  return o + 4 <= b.length ? ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0 : NaN;
}

function u32le(b: Uint8Array, o: number): number {
  return o + 4 <= b.length ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : NaN;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** PNG: 署名8バイトの直後に必ず IHDR が来て、幅・高さ（各4バイト、ビッグエンディアン）が入る。 */
function readPng(b: Uint8Array): ImageDimensions | null {
  if (b.length < 24 || !PNG_SIGNATURE.every((value, index) => b[index] === value)) return null;
  if (ascii(b, 12, 4) !== "IHDR") return null;
  return sized(u32be(b, 16), u32be(b, 20));
}

/** GIF: 6バイトの署名の直後が論理画面の幅・高さ（各2バイト、リトルエンディアン）。 */
function readGif(b: Uint8Array): ImageDimensions | null {
  const signature = ascii(b, 0, 6);
  if (signature !== "GIF87a" && signature !== "GIF89a") return null;
  return sized(u16le(b, 6), u16le(b, 8));
}

/** WebP: RIFF の最初の chunk が VP8（非可逆）・VP8L（可逆）・VP8X（拡張）のどれかで、書き方が違う。 */
function readWebp(b: Uint8Array): ImageDimensions | null {
  if (ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 ") {
    // frame tag 3バイトの後に開始コード 9d 01 2a、続いて14ビットずつの幅・高さ。
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return sized(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
  }
  if (chunk === "VP8L") {
    // 署名 0x2f の後に「幅-1」「高さ-1」を14ビットずつ詰めた4バイト。
    if (b[20] !== 0x2f) return null;
    const bits = u32le(b, 21);
    return sized((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (chunk === "VP8X") {
    // キャンバスの「幅-1」「高さ-1」が3バイトずつ。
    return sized(u24le(b, 24) + 1, u24le(b, 27) + 1);
  }
  return null;
}

// SOF（フレーム開始）。C4=DHT、C8=予約、CC=DAC は縦横を持たない。
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

/** JPEG: 区切り（0xFF + 種類）を順にたどり、最初の SOF の高さ・幅（各2バイト、ビッグエンディアン）を読む。 */
function readJpeg(b: Uint8Array): ImageDimensions | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 1 < b.length) {
    // 区切りの前に余計なバイトがある画像もあるので、次の 0xFF まで読み飛ばす（libjpeg と同じ扱い）。
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = b[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    i += 2;
    // 長さを持たない区切り
    if (marker === 0x00 || marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    // 画像データの開始・終端まで SOF が無ければ読めない
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = u16be(b, i);
    if (!(length >= 2)) return null;
    if (isStartOfFrame(marker)) {
      // [長さ2][精度1][高さ2][幅2]
      return sized(u16be(b, i + 5), u16be(b, i + 3));
    }
    i += length;
  }
  return null;
}
