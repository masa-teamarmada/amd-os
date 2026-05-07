-- 021: 凍結予定 / 再開予定の状態カラムを追加 (#18, 2026-05-07)
--
-- 背景:
--   - CTB は来月から凍結予定。契約は継続なので status=ended にも frozen にも
--     できないが、来月以降は月次ルーティン非表示にしたい。
--   - CX は 3月で契約終了、6月から再開予定。frozen でもないし ended でもない、
--     再開待ちの宙ぶらりん状態。
--
-- 設計:
--   - status (active/sales/ended/frozen/lost) は変えない (履歴扱いを乱さないため)
--   - freeze_from_ym: この ym 以降 凍結中扱い (UI で月次ルーティン非表示等)
--   - restart_expected_ym: この ym から再開予定 (UI で再開待ちバッジ)
--   - 両方 null なら通常運用 (現行と同じ)

alter table projects
  add column if not exists freeze_from_ym text,
  add column if not exists restart_expected_ym text;

comment on column projects.freeze_from_ym is '凍結予定 ym (yyyymm)。この ym 以降は凍結中扱い、月次ルーティン非表示。null なら通常';
comment on column projects.restart_expected_ym is '再開予定 ym (yyyymm)。frozen / 期間終了後の再開待ち PJ 用。null なら通常';
