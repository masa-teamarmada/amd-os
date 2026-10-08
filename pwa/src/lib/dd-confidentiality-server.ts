import { createHash } from "node:crypto";
import { DD_CONFIDENTIALITY_NOTICE, DD_CONFIDENTIALITY_VERSION, ddEscapeHtml } from "./dd-confidentiality.ts";

export function ddContentHash(value: unknown): string {
  return createHash("sha256").update(value instanceof Uint8Array ? value : JSON.stringify(value) ?? "null").digest("hex");
}
export const DD_NOTICE_HASH = ddContentHash(DD_CONFIDENTIALITY_NOTICE);

/** 元資料のCSSから切り離した秘密指定帯。外部通信・スクリプトは追加しない。 */
export function markDdHtml(html: string): string {
  const notice = `<section data-dd-confidentiality="${DD_CONFIDENTIALITY_VERSION}" style="display:block!important;position:relative!important;z-index:2147483647!important;box-sizing:border-box!important;width:100%!important;margin:0!important;padding:12px!important;background:#f1f5f9!important;color:#334155!important;font:12px/1.7 sans-serif!important;text-align:left!important;visibility:visible!important;opacity:1!important"><strong style="font-weight:700!important">秘密情報</strong>｜${ddEscapeHtml(DD_CONFIDENTIALITY_NOTICE)}</section>`;
  // CSSのレイアウトを保ちながら、直開きと印刷にも通知を残す。
  return /<body\b[^>]*>/i.test(html) ? html.replace(/<body\b[^>]*>/i, match => `${match}${notice}`) : `${notice}${html}`;
}

/** PDFの閲覧用写し。原本はZIP内でバイト単位で保持する。余白を追加して本文を覆わない。 */
export async function markDdPdf(bytes: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const original = await PDFDocument.load(bytes);
  const output = await PDFDocument.create();
  const font = await output.embedFont(StandardFonts.HelveticaBold);
  for (const originalPage of original.getPages()) {
    const embedded = await output.embedPage(originalPage);
    const { width, height } = embedded;
    const page = output.addPage([width, height + 28]);
    page.setRotation(originalPage.getRotation());
    page.drawPage(embedded, { x: 0, y: 0, width, height });
    page.drawText("CONFIDENTIAL", { x: 10, y: height + 9, size: Math.min(11, width / 15), font, color: rgb(0.2, 0.25, 0.33) });
  }
  output.setSubject(DD_CONFIDENTIALITY_NOTICE);
  output.setKeywords(["秘密情報", DD_CONFIDENTIALITY_VERSION]);
  return output.save();
}

/** 画像原本を埋め込んだ閲覧用SVG。秘密表示の分だけ縦に余白を加える。 */
export async function markDdImage(bytes: Uint8Array, mimeType: string): Promise<Uint8Array> {
  const sharp = (await import("sharp")).default;
  const { width = 800, height = 600 } = await sharp(bytes).metadata();
  const headerHeight = Math.max(48, Math.ceil(width / 22));
  const label = "秘密情報｜適用される秘密保持契約に従って取り扱ってください";
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + headerHeight}" viewBox="0 0 ${width} ${height + headerHeight}"><rect width="100%" height="${headerHeight}" fill="#f1f5f9"/><text x="${width * 0.02}" y="${headerHeight * 0.62}" font-family="sans-serif" font-size="${width / 40}" fill="#334155">${label}</text><image x="0" y="${headerHeight}" width="${width}" height="${height}" href="data:${ddEscapeHtml(mimeType)};base64,${Buffer.from(bytes).toString("base64")}"/></svg>`);
}
