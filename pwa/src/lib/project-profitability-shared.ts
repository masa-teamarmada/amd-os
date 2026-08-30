// PJ別 利益構造ダッシュボード — サーバと画面の両方が使う定数。
//
// project-profitability.ts は `server-only` なので、画面から値として import できない
// (型だけなら消えるので import type は可)。時間単価はサーバの既定値としても、
// 画面のスライダーの範囲としても要るため、ここに置いて両方から読む。
//
// 正本: pwa/spec/5-14-project-profitability-current-spec.md

/**
 * まさの時間単価の既定値 (円/時)。
 *
 * 根拠: OSがまさの労働へ実際に配賦している額 (reward_summary_json の
 * members[].companyReserveYen のシーズン合計) を、同じ期間のまさの投下時間で
 * 割った実績平均が 25,514円/時 (8,306,769円 ÷ 325.6時間、2026-08-30 時点)。
 * それを丸めた値。
 *
 * PJ別では 2,344〜38,913円/時 とばらつくが、これはMS設計とポイント配分の差なので
 * PJ横断で1つの単価に固定する。PJごとに変えると、PJ間の比較へ配分設計の差が混ざる。
 * 画面のスライダーで動かせる。
 */
export const DEFAULT_MASA_HOURLY_RATE_YEN = 25000;
export const MASA_HOURLY_RATE_MIN_YEN = 5000;
export const MASA_HOURLY_RATE_MAX_YEN = 60000;
