export const INTERNAL_MONTHLY_REPORT_HEADINGS = [
  "概要",
  "今月進んだこと",
  "重要な判断・合意",
  "顧客・共同研究・外部関係者の動き",
  "技術・知財・実験・資料",
  "リスク・未確定事項",
  "来月の焦点",
  "根拠",
] as const;

const PROCESS_LOG_PATTERN = /(?:既存|前回).{0,12}draft|draft.{0,12}(?:生成|更新|追補)|collection[_ ]summary|source[_ ]refs?|OS内L2|L2(?:の|を|から|\s)*(?:要約|証跡|件数|カウント)|snapshot|確認した根拠|今回の追補|今回確認したL2断面|新しい根拠の扱い|本文は.{0,30}(?:構成|作成)|raw(?:メール|データ)|Slack本文|議事録全文|月次断面|補強した/gi;

function sectionBody(content: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const start = new RegExp(`^##\\s+${escaped}\\s*$`, "m").exec(content);
  if (!start) return "";
  const rest = content.slice(start.index + start[0].length);
  const next = /^##\s+/m.exec(rest);
  return rest.slice(0, next?.index ?? rest.length).trim();
}

export interface MonthlyReportValidation {
  ok: boolean;
  errors: string[];
  normalized: string;
}

export function validateInternalMonthlyReport(content: string): MonthlyReportValidation {
  if (typeof content !== "string" || !content.trim()) {
    return { ok: false, errors: ["月次報告書本文が空です"], normalized: content };
  }

  const normalized = content.replace(/eLAD/gi, "e-Rad").trim();
  const errors: string[] = [];
  const foundHeadings = Array.from(normalized.matchAll(/^##\s+(.+?)\s*$/gm), (match) =>
    match[1].replace(/[:：]\s*$/, "").trim()
  ).filter((heading) => INTERNAL_MONTHLY_REPORT_HEADINGS.includes(heading as typeof INTERNAL_MONTHLY_REPORT_HEADINGS[number]));

  for (const heading of INTERNAL_MONTHLY_REPORT_HEADINGS) {
    const count = foundHeadings.filter((found) => found === heading).length;
    if (count === 0) errors.push(`見出し「${heading}」が見つかりません`);
    if (count > 1) errors.push(`見出し「${heading}」は1回だけ使用してください`);
  }
  if (foundHeadings.length === INTERNAL_MONTHLY_REPORT_HEADINGS.length) {
    const ordered = INTERNAL_MONTHLY_REPORT_HEADINGS.every((heading, index) => foundHeadings[index] === heading);
    if (!ordered) errors.push(`見出しの順序が不正です: ${foundHeadings.join(" > ")}`);
  }

  const noActivity = /(?:確認できる実進捗はない|実進捗を確認できなかった|進捗なし)/.test(normalized);
  if (!noActivity && normalized.length < 1000) {
    errors.push("実進捗がある月の社内版は1000文字以上で、経緯・到達点・残課題まで統合してください");
  }

  const overview = sectionBody(normalized, "概要");
  if (overview.length < 120 || overview.length > 600) {
    errors.push("概要は120〜600文字の範囲で、当月の進展・判断・次の焦点をまとめてください");
  }
  const overviewSentenceCount = (overview.match(/[。！？]/g) || []).length;
  if (overviewSentenceCount < 3 || overviewSentenceCount > 5) {
    errors.push(`概要は3〜5文にしてください（現在${overviewSentenceCount}文）`);
  }
  if (/^(?:\s*[-*]|\s*\|)/m.test(overview)) {
    errors.push("概要は箇条書きや表ではなく、3〜5文の文章で書いてください");
  }

  const processTerms = normalized.match(PROCESS_LOG_PATTERN) || [];
  if (processTerms.length > 0) {
    errors.push(`本文に生成・収集プロセスの作業ログが残っています: ${Array.from(new Set(processTerms)).slice(0, 4).join(" / ")}`);
  }
  if (/^\s*(?:決定(?:\/確認)?|確認|次アクション)\s*[:：]/m.test(normalized)) {
    errors.push("本文に生の決定・確認・次アクション行が残っています");
  }
  if (/。\s*,/.test(normalized)) errors.push("句点直後にASCIIカンマが連結しています");
  if (/(?:\.\.\.|…)/.test(normalized)) errors.push("途中省略記号を使わず、文を最後まで書いてください");

  const progress = sectionBody(normalized, "今月進んだこと");
  if (!noActivity) {
    const proseBlocks = progress
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter((block) => block && !/^[-*|]/.test(block));
    if (progress.length < 250 || proseBlocks.length < 2) {
      errors.push("「今月進んだこと」は会議ログを並べず、2つ以上の業務領域を文章で統合してください");
    }
  }

  for (const heading of INTERNAL_MONTHLY_REPORT_HEADINGS) {
    if (sectionBody(normalized, heading).length < 20) {
      errors.push(`「${heading}」の内容が不足しています`);
    }
  }

  const evidence = sectionBody(normalized, "根拠");
  if (/https?:\/\/|\/mypage\?|\b(?:source|meeting|cache|signal)[-_ ]?id\b/i.test(evidence)) {
    errors.push("根拠には内部IDやURLを載せず、日付・種別・自然な件名だけを書いてください");
  }

  return { ok: errors.length === 0, errors, normalized };
}
