/**
 * 「AMDがこのPJへ行ってきたこと」の契約テスト。
 * 正本: pwa/spec/4-7-amd-contributions-current-spec.md
 *
 * 守らせること:
 *   - 日付の新しい順。impact / 件数で並べ替えない
 *   - source=inferred は推定のまま。観測へ昇格させない
 *   - 日付が採れない行は捨てる (日付を捏造しない)
 *   - 予定MTGを「行ってきたこと」に混ぜない
 *   - 専用テーブルと手入力の口を作らない
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAmdContributionsPayload,
  normalizeActivityRow,
  normalizeMeetingRow,
  type AmdContributionItem,
} from "../src/lib/amd-contributions.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const codeNameOf = (memberId: string) => ({ ID001: "まさ", ID002: "かる" })[memberId] ?? memberId;

// 本番 member_activities の実形状に合わせた fixture。
const observed = normalizeActivityRow({
  id: "a1",
  member_id: "ID001",
  ym: "202606",
  source: "member_weekly",
  title: "KUTEの平本さんとメール連絡・打ち合わせ対応",
  content_preview: "連絡・調整を実施したとみられる。",
  item_date: "2026-06-04T10:00:00+00:00",
}, codeNameOf);
assert.ok(observed);
assert.equal(observed.evidenceStage, "observed");
assert.equal(observed.occurredOn, "2026-06-04");
assert.deepEqual(observed.memberNames, ["まさ"]);
assert.equal(observed.sourceLabel, "週次の活動記録");

const inferred = normalizeActivityRow({
  id: "a2", member_id: "ID002", ym: "202605", source: "inferred",
  title: "推定された活動", content_preview: "", item_date: "2026-05-20T00:00:00+00:00",
}, codeNameOf);
assert.equal(inferred?.evidenceStage, "inferred", "推定を観測へ昇格させない");

// 日付が採れない行は捨てる。
assert.equal(normalizeActivityRow({ id: "a3", member_id: "ID001", source: "gmail", item_date: null }, codeNameOf), null);

// 未知の source は観測扱いにしない。
const unknownSource = normalizeActivityRow({
  id: "a4", member_id: "ID001", source: "mystery", title: "x", item_date: "2026-06-01T00:00:00Z",
}, codeNameOf);
assert.equal(unknownSource?.evidenceStage, "inferred", "出所不明を観測にしない");

const meeting = normalizeMeetingRow({
  meeting_id: "m1", ym: "202607", meeting_date: "2026-07-15",
  title: "定例", summary_short: "進捗と次の一手を確認した。", decided: [],
});
assert.ok(meeting);
assert.equal(meeting.kind, "meeting");
assert.equal(meeting.evidenceStage, "observed");

const payload = buildAmdContributionsPayload({
  projectId: "p21",
  items: [observed, inferred, meeting].filter((item): item is AmdContributionItem => item !== null),
  truncated: false,
});

// 日付の新しい順。impact や種別で上へ持ち上げない。
assert.deepEqual(payload.items.map((item) => item.occurredOn), ["2026-07-15", "2026-06-04", "2026-05-20"]);
assert.equal(payload.lastOn, "2026-07-15");
assert.equal(payload.firstOn, "2026-05-20");
assert.equal(payload.activeMonths, 3);
assert.equal(payload.recordedCount, 3);
assert.deepEqual(payload.members.map((member) => member.memberId), ["ID001", "ID002"], "登場月の新しい順。件数順にしない");

// 専用テーブル・手入力の口を作らない。
const libSource = fs.readFileSync(path.join(here, "../src/lib/amd-contributions.ts"), "utf8");
const routeSource = fs.readFileSync(path.join(here, "../src/app/api/project/[projectId]/amd-contributions/route.ts"), "utf8");
const uiSource = fs.readFileSync(path.join(here, "../src/components/cockpit/CockpitAmdContributions.tsx"), "utf8");
for (const [name, source] of [["lib", libSource], ["route", routeSource], ["ui", uiSource]] as const) {
  assert.doesNotMatch(source, /amd_contributions|project_contributions/, `${name}: 貢献用の専用テーブルを作らない`);
}
assert.doesNotMatch(routeSource, /\.insert\(|\.upsert\(|\.update\(/, "貢献欄は読み取り専用");
assert.doesNotMatch(uiSource, /<textarea|<input/, "貢献欄に手入力の口を付けない");
assert.match(routeSource, /source_kinds[\s\S]{0,80}upcoming/, "予定MTGを行ってきたことに混ぜない");
assert.match(uiSource, /拾えた記録の母数/, "件数を貢献の大きさに見せない注記を残す");
assert.match(uiSource, /やっていない/, "無記録を「やっていない」に見せない注記を残す");

// 進捗タブ末尾の対の2枠が同じ場所にあること。
const viewSource = fs.readFileSync(path.join(here, "../src/components/cockpit/CockpitView.tsx"), "utf8");
const tailIndex = viewSource.indexOf("CockpitAmdContributions projectId");
assert.ok(tailIndex > 0, "進捗タブに貢献欄がある");
assert.ok(
  viewSource.lastIndexOf("Bzm22AcquisitionLedger projectId", tailIndex) > 0,
  "獲得台帳は貢献欄の直前 (進捗タブ末尾) にある",
);

console.log(JSON.stringify({
  ok: true,
  order: payload.items.map((item) => `${item.occurredOn}:${item.kind}`),
  members: payload.members.map((member) => member.codeName),
}, null, 2));
