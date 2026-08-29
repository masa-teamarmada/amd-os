// マニュアル検索が、まさの口語の質問文で 0 件にならないことを守る。
// 日本語は空白で区切られないため、質問文をまるごと 1 語として扱うと本文へ部分一致せず、
// つくよみ Manual Q&A が毎回「該当箇所を見つけきれなかった」に落ちる (2026-08-29 の実障害)。
//
// manual-data.ts は Next の解決に依存する相対 import を持ち --experimental-strip-types から
// 読めないため、ここでは manual/*.md を直接読んで検索対象を組む。topics / screens / tables は
// 含まないので、実際の検索より条件はわずかに厳しい。
// Run: npm run test:manual-search-japanese

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { searchManualDocuments, type ManualSearchDocument } from "../src/app/(app)/manual/manual-search.ts";

const manualDir = path.join(process.cwd(), "manual");
const docs: ManualSearchDocument[] = fs
  .readdirSync(manualDir)
  .filter((file) => file.endsWith(".md"))
  .map((file) => {
    const slug = file.replace(/\.md$/, "");
    const source = fs.readFileSync(path.join(manualDir, file), "utf8");
    const lines = source.split("\n");

    return {
      slug,
      number: slug.match(/^(\d+-\d+)/)?.[1] ?? slug,
      title: lines.find((line) => line.startsWith("# "))?.replace(/^# /, "").trim() ?? slug,
      summary: "",
      topics: [],
      screens: [],
      tables: [],
      headings: lines.filter((line) => /^#{1,3}\s+/.test(line)).map((line) => line.replace(/^#{1,3}\s+/, "").trim()),
      text: source
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/^[#>\-\s*`|:]+/gm, " ")
        .replace(/[*`]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    };
  });

assert.ok(docs.length > 10, `マニュアル本文が読めていない (docs=${docs.length})`);

// 質問文 → 上位 3 章に必ず入っていてほしい章 (画面の章番号は並び替えで動くので slug で見る)。
const cases: Array<{ question: string; expect: string }> = [
  { question: "支払フローってどこにある？", expect: "6-12-member-payout-flow" },
  { question: "支払通知書PDFを直す時はどこを見る？", expect: "6-5-admin-payouts-reward-notice-spec" },
  { question: "請求書ってどこで作るんだっけ", expect: "6-3-invoice-and-billing-routine-spec" },
  { question: "報酬の計算ってどうなってる？", expect: "7-1-reward-calc-spec" },
  { question: "コックピットの見方がわからん", expect: "2-3-pj-cockpit" },
  { question: "つくよみって何してるの", expect: "3-3-notifications-and-tsukuyomi" },
  { question: "契約書の管理はどこ", expect: "6-7-contracts-management-spec" },
];

const failures: string[] = [];

for (const { question, expect } of cases) {
  const top = searchManualDocuments(docs, question, 3);

  if (top.length === 0) {
    failures.push(`0 件: ${question}`);
    continue;
  }

  if (!top.some((result) => result.doc.slug === expect)) {
    failures.push(`${expect} が上位 3 件に無い: ${question} -> ${top.map((r) => r.doc.slug).join(", ")}`);
  }
}

assert.equal(failures.length, 0, `\n${failures.join("\n")}`);
console.log(`ok: 口語の質問 ${cases.length} 件すべてで想定章が上位 3 件に入った (docs=${docs.length})`);
