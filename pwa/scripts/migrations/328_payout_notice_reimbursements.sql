-- 328_payout_notice_reimbursements.sql
-- 承認済みの立替精算を支払通知書へ合算するための列 (まさ依頼 2026-08-26)。
--
-- マニュアル 2-2 章には「承認された立替は報酬に上乗せされ、報酬+立替を合算した金額が
-- 支払通知書に載る」と書かれていたが、GAS から PWA へ移行したときに支払側の実装が落ちていて、
-- 承認済みの立替がどの支払月にも乗らないままになっていた。
--
-- payout_notices.reimbursement_yen  その通知書に合算した立替の実費合計 (税込)。報酬の total_yen (税抜) とは別に持つ
-- payout_notices.reimbursement_ids  合算した reimbursements.reimbursement_id の配列 (二重払いの追跡用)
-- reimbursements.billed_ym          どの支払月の通知書に乗せたか。ここが入っている立替は次回以降拾わない

BEGIN;

alter table payout_notices add column if not exists reimbursement_yen integer;
alter table payout_notices add column if not exists reimbursement_ids jsonb;

create index if not exists reimbursements_billed_ym_idx on reimbursements (billed_ym);
create index if not exists reimbursements_status_idx on reimbursements (status);

COMMIT;
