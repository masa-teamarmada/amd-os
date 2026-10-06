/** 表示位置だけを分け、元の本文・注記・出所を削らない。 */
export function splitProductDescriptionLayout(bodyMd: string) {
  const firstHeading = bodyMd.search(/^## /m);
  const prefix = firstHeading < 0 ? "" : bodyMd.slice(0, firstHeading);
  const blocks = prefix.trim().split(/\n\s*\n/);
  const figures: string[] = [];
  let index = 0;
  while (/^!\[[^\]]*\]\([^\s)]+\)$/.test(blocks[index] ?? "")) {
    const image = blocks[index++];
    const caption = blocks[index] && !blocks[index].startsWith("![") ? blocks[index++] : "";
    figures.push([image, caption].filter(Boolean).join("\n\n"));
  }
  const lead = blocks.slice(index).join("\n\n");
  const rest = firstHeading < 0 ? bodyMd : bodyMd.slice(firstHeading);
  const sections = rest.split(/(?=^## )/m).filter(part => part.trim()).map(source => ({
    source,
    // 図や長い比較表のある節には全幅を使う。
    wide: /```(?:mermaid|pictogram)|sol-trl-roadmap/.test(source),
  }));
  return { figures, lead, sections };
}
