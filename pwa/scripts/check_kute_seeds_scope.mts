import assert from "node:assert/strict";
import {
  researchInstitutionSeedsOrgNameForProject,
  computeKuteSeedScore,
  SEED_COMMERCIALIZATION_TYPE_LABEL,
  SEED_COMMERCIALIZATION_TYPE_ORDER,
} from "../src/lib/kute-seeds-scoring.ts";
import { SEED_PUBLIC_VIEW_COLUMNS, type SeedPublicView } from "../src/types/seeds.ts";

// 1. p25 → 工学院大学、それ以外は null (境界ヘルパーが唯一の scope 定義)
{
  assert.equal(researchInstitutionSeedsOrgNameForProject("p25"), "工学院大学", "p25 は工学院大学にマップされていません");
  assert.equal(researchInstitutionSeedsOrgNameForProject("p01"), null, "未定義の project_id は null を返すべきです");
  assert.equal(researchInstitutionSeedsOrgNameForProject(""), null, "空文字は null を返すべきです");
}

// 2. SeedPublicView のホワイトリストは confidential フィールドを含まない
{
  const forbidden = [
    "internal_notes",
    "source_detail",
    "amd_rating_note",
    "amd_owner_member_id",
    "amd_rating",
    "next_action",
    "created_by",
    "updated_by",
  ];
  for (const col of forbidden) {
    assert.ok(
      !(SEED_PUBLIC_VIEW_COLUMNS as readonly string[]).includes(col),
      `SEED_PUBLIC_VIEW_COLUMNS に confidential フィールド ${col} が含まれています`
    );
  }
  assert.ok(SEED_PUBLIC_VIEW_COLUMNS.includes("kute_score_support"), "score フィールドが欠けています");
}

// 3. 事業化タイプのラベル・順序は5種類そろっている
{
  const types = ["large_startup", "small_business_1b_yen", "license", "jv_ma", "joint_research_poc"];
  for (const t of types) {
    assert.ok(SEED_COMMERCIALIZATION_TYPE_LABEL[t], `${t} のラベルがありません`);
    assert.ok(SEED_COMMERCIALIZATION_TYPE_ORDER.includes(t), `${t} が順序リストにありません`);
  }
  assert.equal(SEED_COMMERCIALIZATION_TYPE_ORDER.length, 5);
}

function emptySeedScoreInput(): Pick<
  SeedPublicView,
  | "kute_score_future_need"
  | "kute_score_future_market"
  | "kute_score_future_technical_advantage"
  | "kute_score_future_ip_barrier"
  | "kute_score_current_trl"
  | "kute_score_current_brl"
  | "kute_score_current_hrl"
  | "kute_score_support"
> {
  return {
    kute_score_future_need: null,
    kute_score_future_market: null,
    kute_score_future_technical_advantage: null,
    kute_score_future_ip_barrier: null,
    kute_score_current_trl: null,
    kute_score_current_brl: null,
    kute_score_current_hrl: null,
    kute_score_support: null,
  };
}

// 4. 全フィールド null の場合、total は捏造せず null
{
  const score = computeKuteSeedScore(emptySeedScoreInput());
  assert.equal(score.total, null, "全未評価なのに total が数値になっています");
  assert.equal(score.future.subtotal, null);
  assert.equal(score.current.subtotal, null);
  assert.equal(score.support.subtotal, null);
  assert.equal(score.filledCount, 0);
  assert.equal(score.totalCount, 8);
}

// 5. 一部のみ埋まっている場合、部分点を総合点・群合計として見せない
{
  const input = emptySeedScoreInput();
  input.kute_score_future_need = 10;
  input.kute_score_current_trl = 5;
  const score = computeKuteSeedScore(input);
  assert.equal(score.total, null, "未評価項目があるのに総合点が数値になっています");
  assert.equal(score.future.subtotal, null, "将来性の未評価項目があるのに群合計が数値になっています");
  assert.equal(score.future.filledCount, 1);
  assert.equal(score.current.subtotal, null, "現在地の未評価項目があるのに群合計が数値になっています");
  assert.equal(score.support.subtotal, null, "未評価の support グループが値を持っています");
  assert.equal(score.filledCount, 2);
}

// 6. 全フィールドが埋まっている場合、100点満点で正しく合計される
{
  const input = emptySeedScoreInput();
  input.kute_score_future_need = 15;
  input.kute_score_future_market = 15;
  input.kute_score_future_technical_advantage = 15;
  input.kute_score_future_ip_barrier = 15;
  input.kute_score_current_trl = 10;
  input.kute_score_current_brl = 10;
  input.kute_score_current_hrl = 10;
  input.kute_score_support = 10;
  const score = computeKuteSeedScore(input);
  assert.equal(score.total, 100);
  assert.equal(score.future.subtotal, 60);
  assert.equal(score.current.subtotal, 30);
  assert.equal(score.support.subtotal, 10);
  assert.equal(score.filledCount, 8);
}

console.log("check_kute_seeds_scope.mts: all checks passed");
