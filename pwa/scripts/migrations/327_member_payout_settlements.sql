-- 327_member_payout_settlements.sql
-- AMD → メンバーの業務委託費の「実支払」を freee の出金から自動で取り込むための台帳 (2026-08-26 まさ指摘)。
--
-- これまで OS が持っていた支払の情報は、支払通知書を送った記録 (payout_notices.sent_at) と、
-- 手で押す報酬支払済み印 (billing_cycles.reward_paid_at) だけだった。実際に振り込んだかどうかは
-- どこにも入らず、画面が「未払い残」と言っているものが本当に未払いなのかを人に聞くしかなかった。
-- クライアントからの入金は freee から自動で取り込んでいる (/api/cron/freee-payment-sync) ので、
-- 出金側にも同じ経路を用意する。
--
-- member_payout_settlements     freee の出金1件 = 1行。誰宛か、どの支払通知書に対応するかまで持つ。
-- member_bank_transfer_aliases  口座明細の振込名義 (カタカナ) とメンバーの対応。
--                               金額が支払通知書と一致した振込から自動で学習する。
-- payout_notices.paid_on/paid_amount_yen  その通知書が実際にいつ・いくら振り込まれたか。
--
-- ここは検知と台帳化だけ。報酬計算の未払い残 (reward_summary_json) や報酬債務の控除
-- (reward_member_liability_offsets) を自動では書き換えない。差分の反映はまさの承認を経る。

BEGIN;

create table if not exists member_payout_settlements (
  id uuid primary key default gen_random_uuid(),
  -- freee のどの記録から来たか。deal = 取引 (取引先名を持つ) / wallet_txn = 口座明細 (摘要を持つ)
  source text not null check (source in ('freee_deal', 'freee_wallet_txn')),
  source_id text not null,
  paid_on date not null,
  amount_yen integer not null,
  member_id text references members(member_id),
  -- どの手がかりでメンバーを特定したか (取引先名一致 / 学習済み振込名義 / 支払通知書の金額一致)
  member_match_method text check (member_match_method in ('partner_name', 'transfer_alias', 'notice_amount', 'unmatched')),
  member_match_reason text,
  partner_name text,
  description text,
  transfer_name text,
  notice_ym text,
  notice_no text,
  notice_total_yen integer,
  amount_match text check (amount_match in ('exact', 'within_transfer_fee', 'mismatch', 'no_notice')),
  confidence text not null default 'low' check (confidence in ('high', 'medium', 'low')),
  synced_at timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists member_payout_settlements_member_paid_idx
  on member_payout_settlements (member_id, paid_on desc);
create index if not exists member_payout_settlements_notice_idx
  on member_payout_settlements (member_id, notice_ym);

create table if not exists member_bank_transfer_aliases (
  alias text primary key,
  member_id text not null references members(member_id),
  raw_text text,
  learned_from text,
  learned_at timestamptz not null default now()
);

alter table payout_notices add column if not exists paid_on date;
alter table payout_notices add column if not exists paid_amount_yen integer;

alter table member_payout_settlements enable row level security;
alter table member_bank_transfer_aliases enable row level security;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['member_payout_settlements', 'member_bank_transfer_aliases'] LOOP
    EXECUTE format('drop policy if exists %I on %I', t || '_admin_all', t);
    EXECUTE format('drop policy if exists %I on %I', t || '_service_role', t);
    -- 支払の実績は admin だけが読む (メンバー本人向けの表示は別途 API で絞る)
    EXECUTE format('create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())', t || '_admin_all', t);
    EXECUTE format('create policy %I on %I for all to service_role using (true) with check (true)', t || '_service_role', t);
  END LOOP;
END $$;

COMMIT;
