import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DD_CONFIDENTIALITY_NOTICE, DD_CONFIDENTIALITY_VERSION, ddEscapeHtml } from "./dd-confidentiality.ts";

export function ddContentHash(value: unknown): string {
  return createHash("sha256").update(value instanceof Uint8Array ? value : JSON.stringify(value) ?? "null").digest("hex");
}
export const DD_NOTICE_HASH = ddContentHash(DD_CONFIDENTIALITY_NOTICE);
let stampBytes: Uint8Array | undefined;
export function loadDdStamp(): Uint8Array {
  return stampBytes ??= readFileSync(join(process.cwd(), "public/dd/confidential-stamp-20261012.png"));
}

/** 元資料のCSSから切り離した秘密指定帯。外部通信・スクリプトは追加しない。 */
export function markDdHtml(html: string): string {
  const notice = `<section data-dd-confidentiality="${DD_CONFIDENTIALITY_VERSION}" style="display:block!important;position:relative!important;z-index:2147483647!important;box-sizing:border-box!important;width:100%!important;margin:0!important;padding:16px!important;border-bottom:1px solid #fecaca!important;background:white!important;color:#7f1d1d!important;font:13px/1.7 sans-serif!important;text-align:left!important;visibility:visible!important;opacity:1!important"><img alt="CONFIDENTIAL — 秘密情報" width="1925" height="817" src="data:image/png;base64,${Buffer.from(loadDdStamp()).toString("base64")}" style="display:block!important;width:320px!important;max-width:100%!important;height:auto!important;margin:0 0 12px!important;visibility:visible!important;opacity:1!important">${ddEscapeHtml(DD_CONFIDENTIALITY_NOTICE)}</section>`;
  // CSSのレイアウトを保ちながら、直開きと印刷にも通知を残す。
  return /<body\b[^>]*>/i.test(html) ? html.replace(/<body\b[^>]*>/i, match => `${match}${notice}`) : `${notice}${html}`;
}

/** PDFの閲覧用写し。原本はZIP内でバイト単位で保持する。余白を追加して本文を覆わない。 */
export async function markDdPdf(bytes: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const original = await PDFDocument.load(bytes);
  const output = await PDFDocument.create();
  const stamp = await output.embedPng(loadDdStamp());
  for (const originalPage of original.getPages()) {
    const embedded = await output.embedPage(originalPage);
    const { width, height } = embedded;
    const stampWidth = Math.min(220, Math.max(1, width - 24));
    const stampHeight = stampWidth * stamp.height / stamp.width;
    const page = output.addPage([width, height + stampHeight + 16]);
    page.setRotation(originalPage.getRotation());
    page.drawPage(embedded, { x: 0, y: 0, width, height });
    page.drawImage(stamp, { x: 12, y: height + 8, width: stampWidth, height: stampHeight });
  }
  output.setSubject(DD_CONFIDENTIALITY_NOTICE);
  output.setKeywords(["秘密情報", DD_CONFIDENTIALITY_VERSION]);
  return output.save();
}

/** 画像原本を埋め込んだ閲覧用SVG。秘密表示の分だけ縦に余白を加える。 */
export async function markDdImage(bytes: Uint8Array, mimeType: string): Promise<Uint8Array> {
  const sharp = (await import("sharp")).default;
  const { width = 800, height = 600 } = await sharp(bytes).metadata();
  const stampWidth = Math.min(320, width * 0.92);
  const stampHeight = stampWidth * 817 / 1925;
  const headerHeight = stampHeight + 24;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + headerHeight}" viewBox="0 0 ${width} ${height + headerHeight}"><title>${ddEscapeHtml(`CONFIDENTIAL — 秘密情報。${DD_CONFIDENTIALITY_NOTICE}`)}</title><rect width="100%" height="${headerHeight}" fill="white"/><image x="${width * 0.04}" y="12" width="${stampWidth}" height="${stampHeight}" href="data:image/png;base64,${Buffer.from(loadDdStamp()).toString("base64")}"/><image x="0" y="${headerHeight}" width="${width}" height="${height}" href="data:${ddEscapeHtml(mimeType)};base64,${Buffer.from(bytes).toString("base64")}"/></svg>`);
}
