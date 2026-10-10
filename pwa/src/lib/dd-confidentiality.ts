import { strToU8, strFromU8, unzipSync, zipSync } from "fflate";

/** 秘密指定の正本。文言を変えるときは版も更新する。契約成立や開示許可の判定には使わない。 */
export const DD_CONFIDENTIALITY_VERSION = "2026-10-10.1";
export const DD_CONFIDENTIALITY_LABEL = "CONFIDENTIAL";
export const DD_CONFIDENTIALITY_NOTICE = "本スペースに表示・提供されるすべての情報は、秘密情報として開示します。追加・更新される情報も含みます。取扱いは適用される秘密保持契約に従ってください。";

export function ddEscapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function ddDisclosureText(fileName: string, issuedAt: string, sourceHash: string): string {
  return `${DD_CONFIDENTIALITY_LABEL}\n\n${DD_CONFIDENTIALITY_NOTICE}\n\n対象資料：${fileName}\n発行日時：${issuedAt}\n秘密指定の版：${DD_CONFIDENTIALITY_VERSION}\n原本SHA-256：${sourceHash}\n\n同封した「原本」フォルダ内の資料全体を秘密情報として指定します。原本の内容は変更していません。\nこの通知は秘密指定を伝えるもので、秘密保持契約の締結・変更や第三者情報の開示許可を意味しません。\n`;
}

/** 原本を加工せず、対象と版を特定できる開示通知と一緒に渡す。 */
export function ddDisclosureZip(bytes: Uint8Array, fileName: string, issuedAt: string, sourceHash: string): Uint8Array {
  const safeName = fileName.split(/[\\/]/).pop()?.replace(/[\x00-\x1f]/g, "_") || "資料";
  const notice = ddDisclosureText(safeName, issuedAt, sourceHash);
  return zipSync({
    "開示通知.txt": strToU8(notice),
    "開示通知.html": strToU8(`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>開示通知</title><body style="margin:24px;font:14px/1.8 sans-serif;color:#7f1d1d"><h1 style="margin:0 0 16px;padding:12px 16px;border-left:4px solid #b91c1c;background:#fff1f2;color:#b91c1c;font-size:24px;letter-spacing:.08em">${DD_CONFIDENTIALITY_LABEL}</h1><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font:inherit">${ddEscapeHtml(notice)}</pre></body></html>`),
    [`原本/${safeName}`]: bytes,
  }, { level: 0 });
}

/** OS生成のExcelだけに通知シートと印刷ヘッダーを加える。原本資料には使わない。 */
export function markDdWorkbook(bytes: Uint8Array): Uint8Array {
  const files = unzipSync(bytes);
  const xml = ddEscapeHtml;
  const workbook = strFromU8(files["xl/workbook.xml"]);
  const rels = strFromU8(files["xl/_rels/workbook.xml.rels"]);
  // 既存のフォント・セル書式の番号は保持し、通知見出し専用の赤い太字を末尾に追加する。
  const styles = strFromU8(files["xl/styles.xml"]);
  const fontId = Number(styles.match(/<fonts count="(\d+)"/)?.[1]);
  const styleId = Number(styles.match(/<cellXfs count="(\d+)"/)?.[1]);
  if (!Number.isInteger(fontId) || !Number.isInteger(styleId)) throw new Error("dd_workbook_styles_missing");
  files["xl/styles.xml"] = strToU8(styles
    .replace(/<fonts count="\d+"/, `<fonts count="${fontId + 1}"`)
    .replace("</fonts>", '<font><b/><color rgb="FFB91C1C"/><sz val="18"/><name val="Yu Gothic"/></font></fonts>')
    .replace(/<cellXfs count="\d+"/, `<cellXfs count="${styleId + 1}"`)
    .replace("</cellXfs>", `<xf numFmtId="0" fontId="${fontId}" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>`));
  const sheetId = Math.max(0, ...Array.from(workbook.matchAll(/sheetId="(\d+)"/g), m => Number(m[1]))) + 1;
  const relId = Math.max(0, ...Array.from(rels.matchAll(/Id="rId(\d+)"/g), m => Number(m[1]))) + 1;
  const sheetPath = `worksheets/dd-disclosure.xml`;
  files["xl/workbook.xml"] = strToU8(workbook.replace("<sheets>", `<sheets><sheet name="開示通知" sheetId="${sheetId}" r:id="rId${relId}"/>`));
  files["xl/_rels/workbook.xml.rels"] = strToU8(rels.replace("</Relationships>", `<Relationship Id="rId${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${sheetPath}"/></Relationships>`));
  files["[Content_Types].xml"] = strToU8(strFromU8(files["[Content_Types].xml"]).replace("</Types>", `<Override PartName="/xl/${sheetPath}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`));
  files[`xl/${sheetPath}`] = strToU8(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="100" customWidth="1"/></cols><sheetData>${[DD_CONFIDENTIALITY_LABEL, DD_CONFIDENTIALITY_NOTICE, `出力日時：${new Date().toISOString()}`, `秘密指定の版：${DD_CONFIDENTIALITY_VERSION}`].map((text, i) => `<row r="${i + 1}"${i === 0 ? ' ht="30" customHeight="1"' : ""}><c r="A${i + 1}"${i === 0 ? ` s="${styleId}"` : ""} t="inlineStr"><is><t>${xml(text)}</t></is></c></row>`).join("")}</sheetData></worksheet>`);
  for (const name of Object.keys(files).filter(name => /^xl\/worksheets\/.*\.xml$/.test(name))) {
    files[name] = strToU8(strFromU8(files[name]).replace("</worksheet>", `<headerFooter><oddHeader>&amp;C&amp;B&amp;16&amp;KB91C1CCONFIDENTIAL — 秘密情報</oddHeader><oddFooter>&amp;R秘密指定 ${DD_CONFIDENTIALITY_VERSION}</oddFooter></headerFooter></worksheet>`));
  }
  return zipSync(files, { level: 6 });
}
