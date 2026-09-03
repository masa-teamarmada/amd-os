#!/usr/bin/env node
/**
 * 議事録本文の品質gateの検査。DBにも外部サービスにも触らない。
 *
 *   npm run test:meeting-narrative-gate
 *
 * 後から欠損を埋める経路が、自動抽出より緩い基準で保存してしまわないことを守る。
 * SKILL Phase D-1: 「手動 backfill でもこの gate は同じ」。
 */
import process from "node:process";
import { checkNarrative, NARRATIVE_HEADINGS, MIN_NARRATIVE_LENGTH } from "../src/lib/meeting/narrative-gate.ts";

const failures: string[] = [];
function check(name: string, condition: boolean, detail?: string) {
  if (!condition) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
}

const filler = (n: number) => "あ".repeat(n);

function build({
  headings = NARRATIVE_HEADINGS as readonly string[],
  backgroundBullet = false,
  numberedItems = false,
  pad = 700,
}: { headings?: readonly string[]; backgroundBullet?: boolean; numberedItems?: boolean; pad?: number } = {}) {
  const body: string[] = [];
  for (const heading of headings) {
    body.push(heading);
    if (heading === "## 🎯背景") {
      body.push(backgroundBullet ? `- ${filler(pad)}` : filler(pad));
    } else if (heading === "## 📊経緯") {
      body.push(filler(pad));
    } else {
      body.push(numberedItems ? "1. 決めた" : "- 決めた");
    }
    body.push("");
  }
  return body.join("\n");
}

// 1. 正しい議事録は通る
check("正しい議事録は通る", checkNarrative(build()).ok === true, JSON.stringify(checkNarrative(build())));

// 2. 空は落とす
check("空は落とす", checkNarrative("").ok === false);
check("null は落とす", checkNarrative(null).ok === false);

// 3. 短すぎるものは落とす (summary_short と配列だけの直書きを防ぐ)
{
  const short = `${NARRATIVE_HEADINGS.join("\n短い\n")}\n短い`;
  const result = checkNarrative(short);
  check("短すぎる本文を落とす", result.ok === false && result.code === "blocked_low_quality_narrative", JSON.stringify(result));
  check("最低字数は500字", MIN_NARRATIVE_LENGTH === 500);
}

// 4. 見出しが欠けていたら落とす
for (const missing of NARRATIVE_HEADINGS) {
  const headings = (NARRATIVE_HEADINGS as readonly string[]).filter((h) => h !== missing);
  const result = checkNarrative(build({ headings }));
  check(`見出し「${missing}」欠落を落とす`, result.ok === false && result.code === "blocked_wrong_narrative_headings", JSON.stringify(result));
}

// 5. 見出しの順序が違ったら落とす
{
  const swapped = ["## 📊経緯", "## 🎯背景", "## ✅決まったこと", "## ▶️次の一手", "## ⚠️残課題"];
  const result = checkNarrative(build({ headings: swapped }));
  check("見出しの順序違いを落とす", result.ok === false, JSON.stringify(result));
}

// 6. 表記ゆれを落とす (`## 🎯 背景` のような空白入り)
{
  const drifted = ["## 🎯 背景", "## 📊経緯", "## ✅決まったこと", "## ▶️次の一手", "## ⚠️残課題"];
  const result = checkNarrative(build({ headings: drifted }));
  check("見出しの表記ゆれを落とす", result.ok === false, JSON.stringify(result));
}

// 7. 背景・経緯が箇条書きなら落とす (段落で書く節)
{
  const result = checkNarrative(build({ backgroundBullet: true }));
  check("背景の箇条書きを落とす", result.ok === false, JSON.stringify(result));
}

// 8. 後半3節の番号付きリストを落とす
{
  const result = checkNarrative(build({ numberedItems: true }));
  check("番号付きリストを落とす", result.ok === false, JSON.stringify(result));
}

// 9. チェックボックスを落とす
{
  const withCheckbox = build().replace("- 決めた", "- [ ] 決めた");
  const result = checkNarrative(withCheckbox);
  check("チェックボックスを落とす", result.ok === false, JSON.stringify(result));
}

if (failures.length) {
  process.stderr.write(`議事録本文の品質gate検査に失敗しました (${failures.length}件)\n`);
  for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
  process.exit(1);
}
process.stdout.write("meeting narrative gate: all checks passed\n");
