/**
 * 見出しテキストから決まるアンカー id。
 *
 * 日本語見出しは英数 slug 化すると全部ハイフンへ潰れて衝突するので、FNV-1a の
 * 32bit ハッシュを使う。`/model/formulas`（現行モデルの式）から
 * 「この式は正本のどの節にあるか」へ跳ぶために、描画側 (BzmMarkdown) と
 * リンク生成側 (formula-canon) が同じ関数を共有する必要がある。
 * どちらか片方だけで実装すると、id が静かにずれてリンクが死ぬ。
 */
export function headingAnchorId(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `h-${hash.toString(16).padStart(8, "0")}`;
}
