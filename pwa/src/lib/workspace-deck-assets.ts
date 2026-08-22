/**
 * デッキが参照する画像の判定。純粋関数だけで、`server-only` もDOM APIも使わない。
 *
 * 受け取ったバイト列を自分で読んで形式と寸法を決める。クライアントが名乗ったMIMEを信じない。
 * publish出力では画像をdata URIとしてHTMLへ埋め込むので、「画像だと言われた別の何か」を
 * そのまま資料へ入れないことが、ここでの一番の仕事。
 *
 * **縮小はしない。** このリポには画像処理ライブラリ (sharp等) が入っておらず、
 * Vercelのnode functionでネイティブ依存を足すのは割に合わない。長辺の上限を超える画像は
 * ここで断り、縮小はブラウザ側 (canvas) の責任にする。断る側に倒すのは、黙って原寸を
 * 貼ると publish後のHTMLが5MB上限を越え、プレビューごと開けなくなるため。
 */

import { WORKSPACE_DOCUMENT_ASSET_MAX_EDGE_PX } from "@/lib/workspace-documents-core";

export type WorkspaceDeckAssetMimeType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

/**
 * 受け付ける画像形式と、Storageのpathへ付ける拡張子。
 * SVGは入れない。マークアップとしてサニタイズが要る一方、写真・図として得るものが無い
 * (図はデッキのブロックで組む)。
 */
export const WORKSPACE_DECK_ASSET_EXTENSIONS: Record<WorkspaceDeckAssetMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type WorkspaceDeckImageProbe = {
  mimeType: WorkspaceDeckAssetMimeType;
  width: number;
  height: number;
};

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function matchesAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}

function probePng(bytes: Uint8Array): WorkspaceDeckImageProbe | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((byte, index) => bytes[index] !== byte)) return null;
  // 先頭チャンクはIHDRでなければならない。ここが違うPNGは壊れている。
  if (!matchesAscii(bytes, 12, "IHDR")) return null;
  return { mimeType: "image/png", width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) };
}

function probeGif(bytes: Uint8Array): WorkspaceDeckImageProbe | null {
  if (bytes.length < 10) return null;
  if (!matchesAscii(bytes, 0, "GIF87a") && !matchesAscii(bytes, 0, "GIF89a")) return null;
  return { mimeType: "image/gif", width: readUint16LE(bytes, 6), height: readUint16LE(bytes, 8) };
}

function probeJpeg(bytes: Uint8Array): WorkspaceDeckImageProbe | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    // 0xd0-0xd9 はサイズを持たないマーカー。0xff の連続はパディング。
    if (marker === 0xff) { offset += 1; continue; }
    if (marker >= 0xd0 && marker <= 0xd9) { offset += 2; continue; }
    const length = readUint16BE(bytes, offset + 2);
    if (length < 2) return null;
    const isFrameHeader = (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf);
    if (isFrameHeader) {
      return {
        mimeType: "image/jpeg",
        width: readUint16BE(bytes, offset + 7),
        height: readUint16BE(bytes, offset + 5),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function probeWebp(bytes: Uint8Array): WorkspaceDeckImageProbe | null {
  if (bytes.length < 30 || !matchesAscii(bytes, 0, "RIFF") || !matchesAscii(bytes, 8, "WEBP")) return null;
  if (matchesAscii(bytes, 12, "VP8X")) {
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { mimeType: "image/webp", width, height };
  }
  if (matchesAscii(bytes, 12, "VP8L")) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return {
      mimeType: "image/webp",
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >>> 14) & 0x3fff),
    };
  }
  if (matchesAscii(bytes, 12, "VP8 ")) {
    // キーフレームの同期コード。ここが違うものはロッシーVP8のフレームではない。
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return {
      mimeType: "image/webp",
      width: readUint16LE(bytes, 26) & 0x3fff,
      height: readUint16LE(bytes, 28) & 0x3fff,
    };
  }
  return null;
}

/** バイト列から形式と寸法を読む。画像だと判定できなければ null。 */
export function probeWorkspaceDeckImage(bytes: Uint8Array): WorkspaceDeckImageProbe | null {
  const probe = probePng(bytes) || probeJpeg(bytes) || probeWebp(bytes) || probeGif(bytes);
  if (!probe) return null;
  if (!Number.isInteger(probe.width) || !Number.isInteger(probe.height)) return null;
  if (probe.width < 1 || probe.height < 1) return null;
  return probe;
}

export function workspaceDeckImageExceedsMaxEdge(probe: WorkspaceDeckImageProbe): boolean {
  return Math.max(probe.width, probe.height) > WORKSPACE_DOCUMENT_ASSET_MAX_EDGE_PX;
}

/** publish出力へ埋め込む形。外部参照ゼロを守る唯一の埋め込み方法。 */
export function workspaceDeckAssetDataUri(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}
