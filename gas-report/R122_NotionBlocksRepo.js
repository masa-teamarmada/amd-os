/** R122_NotionBlocksRepo.gs
 * 役割：
 * - Notionページの本文（blocks）を /v1/blocks/{blockId}/children から取得して、プレーンテキスト化する
 * - nav_repo_notion_collectMinutesTextForProject_ が「内容」未転記でも抽出できるようにする
 *
 * 注意：
 * - Notion APIはページ本文が blocks として返るので、そこを総ざらいして text を抜く
 * - API叩きすぎ防止で maxChars をかける
 */

function nav_repo_notion_fetchPageBodyText(token, pageId, opts){
  const o = opts || {};
  const maxChars = (o.maxChars !== undefined && o.maxChars !== null) ? Number(o.maxChars||0) : 12000;
  const pid = String(pageId || "").trim();
  if (!pid) return "";

  // pageId を Notion仕様のIDに寄せる（既存utilがあるなら使う）
  const blockId = (typeof _notion_normId_ === "function") ? _notion_normId_(pid) : pid;
  if (!blockId) return "";

  const urlBase = "https://api.notion.com/v1/blocks/" + blockId + "/children?page_size=100";

  let cursor = null;
  const lines = [];
  let total = 0;

  function pushLine(s){
    const t = String(s || "").trim();
    if (!t) return;
    lines.push(t);
    total += t.length + 1;
  }

  while (true){
    let url = urlBase;
    if (cursor) url += "&start_cursor=" + encodeURIComponent(cursor);

    const res = _notion_fetch_(token, url, "get", null);
    const results = Array.isArray(res && res.results) ? res.results : [];

    for (let i=0; i<results.length; i++){
      const b = results[i] || {};
      const type = String(b.type || "").trim();

      // rich_text を持つタイプだけ拾う（必要になったら増やす）
      const rt =
        (type === "paragraph" && b.paragraph && b.paragraph.rich_text) ? b.paragraph.rich_text :
        (type === "heading_1" && b.heading_1 && b.heading_1.rich_text) ? b.heading_1.rich_text :
        (type === "heading_2" && b.heading_2 && b.heading_2.rich_text) ? b.heading_2.rich_text :
        (type === "heading_3" && b.heading_3 && b.heading_3.rich_text) ? b.heading_3.rich_text :
        (type === "bulleted_list_item" && b.bulleted_list_item && b.bulleted_list_item.rich_text) ? b.bulleted_list_item.rich_text :
        (type === "numbered_list_item" && b.numbered_list_item && b.numbered_list_item.rich_text) ? b.numbered_list_item.rich_text :
        (type === "to_do" && b.to_do && b.to_do.rich_text) ? b.to_do.rich_text :
        (type === "toggle" && b.toggle && b.toggle.rich_text) ? b.toggle.rich_text :
        null;

      if (Array.isArray(rt) && rt.length){
        const text = rt.map(x=>String(x && x.plain_text ? x.plain_text : "")).join("").trim();
        if (text) pushLine(text);
      }

      if (maxChars > 0 && total >= maxChars) break;
    }

    if (maxChars > 0 && total >= maxChars) break;

    cursor = res && res.next_cursor ? String(res.next_cursor) : "";
    if (!cursor) break;
  }

  return lines.join("\n").trim();
}
