#!/usr/bin/env node
/**
 * 研究機関 ECR × 所属シーズ SPS 観測基盤の回帰テスト。
 *
 * 実行:
 *   node --experimental-strip-types scripts/check_institution_soil_seeds.mts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  collectObservationDates,
  computeSpsDistributionStats,
  formatSourceDateRange,
  rankSeedsBySps,
  selectLatestAsOf,
  selectLatestPerKeyAsOf,
} from "../src/lib/institution-soil-seeds.ts";

// 未評価は0へ置換せず除外し、R-7線形補間で四分位を計算する。
{
  const stats = computeSpsDistributionStats([null, 0.1, 0.5, 0.7, 0.9, 1.1]);
  assert.equal(stats.n, 5);
  assert.equal(stats.min, 0.1);
  assert.equal(stats.q1, 0.5);
  assert.equal(stats.median, 0.7);
  assert.equal(stats.q3, 0.9);
  assert.equal(stats.max, 1.1);
}

// 同点はcompetition ranking、未評価は順位なしで末尾。
{
  const ranked = rankSeedsBySps([
    { seedId: "s-low", score: 0.2 },
    { seedId: "s-top-a", score: 0.9 },
    { seedId: "s-none", score: null },
    { seedId: "s-top-b", score: 0.9 },
    { seedId: "s-mid", score: 0.5 },
  ]);
  assert.deepEqual(
    ranked.map(({ seedId, rank }) => [seedId, rank]),
    [
      ["s-top-a", 1],
      ["s-top-b", 1],
      ["s-mid", 3],
      ["s-low", 4],
      ["s-none", null],
    ]
  );
}

// ECRは評価点ごとにas-of以前の最新だけをcarry-forwardする。
{
  const rows = [
    { criterionId: "c1", evaluatedAt: "2026-05-29", level: 2 },
    { criterionId: "c2", evaluatedAt: "2026-05-29", level: 3 },
    { criterionId: "c1", evaluatedAt: "2026-05-31", level: 4 },
    { criterionId: "c2", evaluatedAt: "2026-08-01", level: 5 },
  ];
  const selected = selectLatestPerKeyAsOf(rows, "2026-07-20", (row) => row.criterionId)
    .sort((a, b) => a.criterionId.localeCompare(b.criterionId));
  assert.deepEqual(
    selected.map(({ criterionId, evaluatedAt, level }) => [criterionId, evaluatedAt, level]),
    [
      ["c1", "2026-05-31", 4],
      ["c2", "2026-05-29", 3],
    ]
  );
}

// SPSの最新が欠損なら、過去のreadyへ黙って戻らず最新行そのものを選ぶ。
{
  const selected = selectLatestAsOf(
    [
      { evaluatedAt: "2026-07-01", status: "ready", score: 0.8 },
      { evaluatedAt: "2026-07-20", status: "missing", score: null },
    ],
    "2026-07-30"
  ).selected;
  assert.equal(selected?.evaluatedAt, "2026-07-20");
  assert.equal(selected?.score, null);
}

// 観測日は実在するECR/SPS日だけ。元日は単日または範囲として別表示する。
{
  assert.deepEqual(
    collectObservationDates(
      ["2026-05-29", "2026-05-31"],
      ["2026-07-20", "2026-05-31"]
    ),
    ["2026-07-20", "2026-05-31", "2026-05-29"]
  );
  assert.equal(formatSourceDateRange([]), "—");
  assert.equal(formatSourceDateRange(["2026-07-20"]), "2026-07-20");
  assert.equal(
    formatSourceDateRange(["2026-05-31", "2026-05-29", "2026-05-31"]),
    "2026-05-29〜2026-05-31"
  );
}

// UI/DB契約: 元日を別表示し、最小2列追加だけで既存テーブルを再利用する。
{
  const component = readFileSync(
    new URL("../src/components/cockpit/CockpitSoilSeeds.tsx", import.meta.url),
    "utf8"
  );
  const migration = readFileSync(
    new URL("./migrations/202_soil_seeds_institution_link.sql", import.meta.url),
    "utf8"
  );
  const seedsData = readFileSync(new URL("../src/lib/seeds-data.ts", import.meta.url), "utf8");

  assert.match(component, /ECR元日/);
  assert.match(component, /SPS元日/);
  assert.match(component, /n \/ 所属/);
  assert.match(component, /未評価.*0へ置換せず/);
  assert.doesNotMatch(component, /同日観測|同日時点の観測事実/);

  assert.match(migration, /ADD COLUMN IF NOT EXISTS institution_id/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS evaluation_version/);
  assert.doesNotMatch(migration, /CREATE TABLE/i);
  assert.match(migration, /org_name = '工学院大学'/);

  assert.doesNotMatch(seedsData, /\.map\(calculateSeedSpsScore\)/);
  assert.match(seedsData, /fetchSeedSpsHistoryForSeeds/);
}

console.log("check_institution_soil_seeds.mts: all checks passed");
