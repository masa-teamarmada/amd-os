export type MonthlyReportKind = "internal" | "external";

export type MonthlyReportHistoryAction =
  | "generate"
  | "draft_save"
  | "confirm"
  | "external_save"
  | "legacy_seed";

export type MonthlyReportHistoryListItem = {
  id: string;
  reportKind: MonthlyReportKind;
  action: MonthlyReportHistoryAction;
  actorKind: "member" | "automation" | "system" | "legacy";
  actorMemberId: string | null;
  actorName: string;
  changedSections: string[];
  detailAvailable: boolean;
  source: string | null;
  createdAt: string;
};

type SectionBlock = { key: string; label: string; content: string };

function splitSections(markdown: string): SectionBlock[] {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const sections: SectionBlock[] = [];
  let label = "本文冒頭";
  let key = "__preamble__";
  let body: string[] = [];
  const occurrences = new Map<string, number>();

  const push = () => {
    const content = body.join("\n").trimEnd();
    if (content || sections.length > 0 || label !== "本文冒頭") {
      sections.push({ key, label, content });
    }
  };

  for (const line of lines) {
    const match = /^(#{1,2})[ \t]+(.+?)\s*$/u.exec(line);
    if (!match) {
      body.push(line);
      continue;
    }
    push();
    label = match[2].trim();
    const baseKey = `${match[1].length}:${label}`;
    const occurrence = (occurrences.get(baseKey) ?? 0) + 1;
    occurrences.set(baseKey, occurrence);
    key = `${baseKey}:${occurrence}`;
    body = [line];
  }
  push();
  return sections;
}

/** H1/H2単位で本文を比較し、章内の変更も章名として返す。 */
export function changedMonthlyReportSections(before: string | null | undefined, after: string | null | undefined): string[] {
  const beforeText = before ?? "";
  const afterText = after ?? "";
  if (beforeText === afterText) return [];

  const beforeMap = new Map(splitSections(beforeText).map((section) => [section.key, section]));
  const afterMap = new Map(splitSections(afterText).map((section) => [section.key, section]));
  const keys = [...new Set([...beforeMap.keys(), ...afterMap.keys()])];
  const labels: string[] = [];
  for (const key of keys) {
    const previous = beforeMap.get(key);
    const next = afterMap.get(key);
    if (previous?.content === next?.content) continue;
    const label = next?.label ?? previous?.label ?? "本文";
    if (!labels.includes(label)) labels.push(label);
  }
  return labels.length > 0 ? labels : ["本文"];
}

export type LineDiffRow = {
  kind: "same" | "removed" | "added";
  beforeLine: number | null;
  afterLine: number | null;
  text: string;
};

/** 詳細を開いた時だけ使う、行単位の正確なLCS差分。 */
export function diffMonthlyReportLines(before: string, after: string): LineDiffRow[] {
  const normalizedBefore = before.replace(/\r\n?/gu, "\n");
  const normalizedAfter = after.replace(/\r\n?/gu, "\n");
  const left = normalizedBefore === "" ? [] : normalizedBefore.split("\n");
  const right = normalizedAfter === "" ? [] : normalizedAfter.split("\n");
  const table = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i][j] = left[i] === right[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const rows: LineDiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      rows.push({ kind: "same", beforeLine: i + 1, afterLine: j + 1, text: left[i] });
      i += 1;
      j += 1;
    } else if (j >= right.length || (i < left.length && table[i + 1][j] >= table[i][j + 1])) {
      rows.push({ kind: "removed", beforeLine: i + 1, afterLine: null, text: left[i] });
      i += 1;
    } else {
      rows.push({ kind: "added", beforeLine: null, afterLine: j + 1, text: right[j] });
      j += 1;
    }
  }
  return rows;
}

export function monthlyReportHistoryActionLabel(action: MonthlyReportHistoryAction): string {
  const labels: Record<MonthlyReportHistoryAction, string> = {
    generate: "自動生成",
    draft_save: "下書きを保存",
    confirm: "確定版に反映",
    external_save: "提出版を保存",
    legacy_seed: "過去履歴を移行",
  };
  return labels[action] ?? action;
}
