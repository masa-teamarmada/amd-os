#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  classifyWorkCategory,
  classifyManagementTrack,
  mondayWeekStartJst,
  computeMemberWeeklyEffortPlan,
} from "../src/lib/member-weekly-effort-plan.ts";

// JST 月曜週境界: 日曜(7/19)は前週月曜(7/13)、月曜(7/20)は当週(7/20)
{
  assert.equal(mondayWeekStartJst("2026-07-19"), "2026-07-13");
  assert.equal(mondayWeekStartJst("2026-07-20"), "2026-07-20");
  assert.equal(mondayWeekStartJst("2026-07-26"), "2026-07-20");
}

// ISO日時は Asia/Tokyo へ変換してから月曜週境界を判定する
// 2026-07-19T15:30:00Z = 2026-07-20T00:30:00+09:00 (JST月曜) => 週開始は当週月曜 2026-07-20
{
  assert.equal(mondayWeekStartJst("2026-07-19T15:30:00Z"), "2026-07-20");
  // UTC としては月曜(7/20)の日中でも、JST では同日昼なので変わらず当週月曜
  assert.equal(mondayWeekStartJst("2026-07-20T09:00:00Z"), "2026-07-20");
  // UTC日曜終盤(7/19T23:00Z)はJSTで月曜朝(7/20T08:00+09)になり当週月曜へ繰り上がる
  assert.equal(mondayWeekStartJst("2026-07-19T23:00:00Z"), "2026-07-20");
}

// 分類: 応用 > 開発/実装/試作/設計/技術 > 基礎/研究/実験 > 資金/事業化等SU > coordination
{
  assert.equal(classifyWorkCategory("VC 面談"), "su");
  assert.equal(classifyWorkCategory("投資家MTG"), "su");
  assert.equal(classifyWorkCategory("顧客商談"), "su");
  assert.equal(classifyWorkCategory("PoC進捗確認"), "su");
  assert.equal(classifyWorkCategory("試作機の実装"), "development");
  assert.equal(classifyWorkCategory("応用研究ディスカッション"), "applied");
  assert.equal(classifyWorkCategory("基礎研究の実験"), "basic");
  assert.equal(classifyWorkCategory("定例1on1"), "coordination");
  // SX が絡んでも具体語 (応用/開発) があればそちらを優先する
  assert.equal(classifyWorkCategory("SX 技術開発ミーティング"), "development");
  assert.equal(classifyWorkCategory("SX 応用研究レビュー"), "applied");
  // "🛠 SX" 単独 (応用/開発/基礎の具体語なし) は su
  assert.equal(classifyWorkCategory("🛠 SX"), "su");
}

// track: technology_development > funding > organizational_building > business_development > null
{
  assert.equal(classifyManagementTrack("SMBC融資相談"), "funding");
  assert.equal(classifyManagementTrack("試作機の設計レビュー"), "technology_development");
  assert.equal(classifyManagementTrack("採用面接"), "organizational_building");
  assert.equal(classifyManagementTrack("営業商談"), "business_development");
  assert.equal(classifyManagementTrack("定例1on1"), null);
  // 技術語と資金語が両方あれば技術語を優先してよい
  assert.equal(classifyManagementTrack("SMBC向け技術開発デモ"), "technology_development");
}

function activity(overrides: Partial<Parameters<typeof computeMemberWeeklyEffortPlan>[0][number]>) {
  return {
    member_id: "m1",
    project_id: "p1",
    item_date: "2026-07-20",
    title: "定例",
    content_preview: "",
    raw_metadata: { evidence_refs: [] },
    ...overrides,
  };
}

// calendar + duration>0 + all_day!=true のみ計上、source_kind外は無視
{
  const activities = [
    activity({
      title: "顧客商談",
      raw_metadata: {
        evidence_refs: [
          { source_kind: "calendar", event_id: "e1", duration_minutes: 60, all_day: false },
          { source_kind: "calendar", event_id: "e2", duration_minutes: 0, all_day: false },
          { source_kind: "calendar", event_id: "e3", duration_minutes: 30, all_day: true },
          { source_kind: "gmail", event_id: "e4", duration_minutes: 60, all_day: false },
        ],
      },
    }),
  ];
  const plan = computeMemberWeeklyEffortPlan(activities, []);
  assert.equal(plan.upserts.length, 1);
  assert.equal(plan.upserts[0].work_category, "su");
  assert.equal(plan.upserts[0].actual_hours, 1);
  assert.equal(plan.upserts[0].management_track, "business_development");
  assert.equal(plan.upserts[0].source_kind, "inferred");
  assert.equal(plan.upserts[0].planned_hours, 0);
  assert.equal(plan.upserts[0].note, "Calendar実時間から自動集計");
  assert.equal(plan.upserts[0].id, null);
}

// 週は ref.start_at 優先、欠損時 activity.item_date へ fallback。分類テキストは ref.title も含む
{
  const activities = [
    activity({
      title: "定例",
      item_date: "2026-07-13",
      raw_metadata: {
        evidence_refs: [
          {
            source_kind: "calendar",
            event_id: "e1",
            duration_minutes: 60,
            all_day: false,
            start_at: "2026-07-20T09:00:00Z",
            title: "試作機の設計レビュー",
          },
        ],
      },
    }),
    activity({
      member_id: "m2",
      title: "定例",
      item_date: "2026-07-20",
      raw_metadata: {
        evidence_refs: [
          { source_kind: "calendar", event_id: "e2", duration_minutes: 45, all_day: false, title: "顧客商談" },
        ],
      },
    }),
  ];
  const plan = computeMemberWeeklyEffortPlan(activities, []);
  const first = plan.upserts.find((u) => u.member_id === "m1");
  assert.ok(first);
  // start_at (7/20, JST Mon) を使うので item_date(7/13) ではなく当週7/20になる
  assert.equal(first!.week_start, "2026-07-20");
  assert.equal(first!.work_category, "development");

  const second = plan.upserts.find((u) => u.member_id === "m2");
  assert.ok(second);
  // start_at 欠損時は item_date(7/20) を使う
  assert.equal(second!.week_start, "2026-07-20");
  // activity.title は「定例」(coordination) だが ref.title「顧客商談」を含めて su と分類する
  assert.equal(second!.work_category, "su");
}

// event 重複: 同一 member/project/week/event は一度だけ計上 (meeting_summary が calendar と同じ event_id を持つケース)
{
  const activities = [
    activity({
      title: "顧客商談",
      raw_metadata: {
        evidence_refs: [{ source_kind: "calendar", event_id: "e1", duration_minutes: 60, all_day: false }],
      },
    }),
    activity({
      title: "顧客商談 (要約)",
      raw_metadata: {
        evidence_refs: [{ source_kind: "meeting_summary", event_id: "e1", duration_minutes: 60, all_day: false }],
      },
    }),
  ];
  const plan = computeMemberWeeklyEffortPlan(activities, []);
  assert.equal(plan.upserts.length, 1);
  assert.equal(plan.upserts[0].actual_hours, 1);
}

// evidence_id フォールバック (event_id 欠損時)
{
  const activities = [
    activity({
      title: "顧客商談",
      raw_metadata: {
        evidence_refs: [{ source_kind: "calendar", evidence_id: "ev-1", duration_minutes: 45, all_day: false }],
      },
    }),
  ];
  const plan = computeMemberWeeklyEffortPlan(activities, []);
  assert.equal(plan.upserts.length, 1);
  assert.equal(plan.upserts[0].actual_hours, 0.75);
}

// 同一 category 内は duration 最大の track を採用
{
  const activities = [
    activity({
      title: "SMBC融資相談",
      raw_metadata: {
        evidence_refs: [{ source_kind: "calendar", event_id: "e1", duration_minutes: 30, all_day: false }],
      },
    }),
    activity({
      title: "顧客商談",
      raw_metadata: {
        evidence_refs: [{ source_kind: "calendar", event_id: "e2", duration_minutes: 90, all_day: false }],
      },
    }),
  ];
  const plan = computeMemberWeeklyEffortPlan(activities, []);
  assert.equal(plan.upserts.length, 1);
  assert.equal(plan.upserts[0].work_category, "su");
  assert.equal(plan.upserts[0].management_track, "business_development");
  assert.equal(plan.upserts[0].actual_hours, 2);
}

// 既存 manual/imported は unique key が同じなら upsert しない (保護)
{
  const activities = [
    activity({
      title: "顧客商談",
      raw_metadata: {
        evidence_refs: [{ source_kind: "calendar", event_id: "e1", duration_minutes: 60, all_day: false }],
      },
    }),
  ];
  const existing = [
    {
      id: "existing-1",
      member_id: "m1",
      project_id: "p1",
      week_start: "2026-07-20",
      work_category: "su" as const,
      source_kind: "manual" as const,
    },
  ];
  const plan = computeMemberWeeklyEffortPlan(activities, existing);
  assert.equal(plan.upserts.length, 0);
  assert.equal(plan.deleteIds.length, 0);
}

// 既存 inferred は id を引き継いで update (id 付き upsert)
{
  const activities = [
    activity({
      title: "顧客商談",
      raw_metadata: {
        evidence_refs: [{ source_kind: "calendar", event_id: "e1", duration_minutes: 60, all_day: false }],
      },
    }),
  ];
  const existing = [
    {
      id: "existing-2",
      member_id: "m1",
      project_id: "p1",
      week_start: "2026-07-20",
      work_category: "su" as const,
      source_kind: "inferred" as const,
    },
  ];
  const plan = computeMemberWeeklyEffortPlan(activities, existing);
  assert.equal(plan.upserts.length, 1);
  assert.equal(plan.upserts[0].id, "existing-2");
}

// obsolete inferred 削除: 集計に現れない既存 inferred は deleteIds へ
{
  const existing = [
    {
      id: "obsolete-1",
      member_id: "m1",
      project_id: "p1",
      week_start: "2026-07-20",
      work_category: "su" as const,
      source_kind: "inferred" as const,
    },
    {
      id: "keep-manual",
      member_id: "m1",
      project_id: "p1",
      week_start: "2026-07-20",
      work_category: "development" as const,
      source_kind: "manual" as const,
    },
  ];
  const plan = computeMemberWeeklyEffortPlan([], existing);
  assert.deepEqual(plan.deleteIds, ["obsolete-1"]);
}

// 0分 all-day だけの activity は集計に現れず、既存 inferred があれば obsolete 削除される
{
  const activities = [
    activity({
      title: "顧客商談",
      raw_metadata: {
        evidence_refs: [{ source_kind: "calendar", event_id: "e1", duration_minutes: 0, all_day: true }],
      },
    }),
  ];
  const existing = [
    {
      id: "obsolete-2",
      member_id: "m1",
      project_id: "p1",
      week_start: "2026-07-20",
      work_category: "su" as const,
      source_kind: "inferred" as const,
    },
  ];
  const plan = computeMemberWeeklyEffortPlan(activities, existing);
  assert.equal(plan.upserts.length, 0);
  assert.deepEqual(plan.deleteIds, ["obsolete-2"]);
}

console.log(JSON.stringify({ ok: true, checks: "member-weekly-effort-plan" }, null, 2));
