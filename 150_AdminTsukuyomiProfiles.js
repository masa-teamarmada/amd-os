/**
 * 150_AdminTsukuyomiProfiles.gs
 *
 * 役割：
 * - DB_TsukuyomiProfiles の正本ヘッダを保証する
 * - 手書き・表記ゆれ・列欠損を完全に防ぐ
 *
 * ルール：
 * - ヘッダ行はこの関数のみが定義権限を持つ
 * - 本体スプレッドシートを対象とする
 */

function admin_ensureTsukuyomiProfilesHeader(){
  const SHEET_NAME = "DB_TsukuyomiProfiles";

  const headers = [
    "profileKey",          // projectId:pmMemberId
    "projectId",
    "pmMemberId",

    "avgCloseDay",         // 数値（例：18）
    "closeSamples",        // クローズ日サンプル数（平均の信頼性判定に使う）
    "stuckStatus",         // budget_confirmed / allocation_confirmed など
    "tone",                // gentle | short | process

    "lastClosedYm",        // 例：202601
    "lastClosedAtJst",     // ISO (Asia/Tokyo)
    "lastRemindedAtJst",   // ISO (Asia/Tokyo)

    // ★175が使う：行動ローテ用（同じ行動の連発を防ぐ）
    "lastActionType",      // peek | yesno | oneword
    "lastActionAtJst",     // ISO (Asia/Tokyo)

    "note",                // 自由メモ（運用用）

    "status",              // active | inactive
    "createdAtJst",
    "updatedAtJst"
  ];

  // 既存の共通基盤を使う（AMD OS ルール）
  b_ensureHeader_(SHEET_NAME, headers);
}
