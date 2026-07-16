-- 175_lst_cap_table_history.sql
--
-- LST (project_id = p07) の株式イベント履歴を、原本 xlsx:LST_captable_250415.xlsx を
-- source_ref に持つ正規の株式イベント台帳 (project_equity_transactions / project_equity_entries)
-- として復元する。migration 174 で project_shareholders の現在スナップショットから
-- 機械的に作った opening_balance を無効化し、正しい設立→Seed→QST現物出資の3イベントへ置き換える。
--
-- 新規テーブル・新規カラムは追加しない。DROP / DELETE は行わない。
-- 全ステートメントは複数回実行しても行数・値が変わらないよう UPDATE-if-exists / INSERT-if-not-exists で書く。
--
-- 検算コメント (発行済株式数):
--   星野毅 (founder, 普通株式)          30,000株
--   UMI3号投資事業有限責任組合 (vc, シード種優先株式) 15,000株
--   QST (other, 普通株式, 現物出資)        2,500株
--   合計                                  47,500株  (= 30,000 + 15,000 + 2,500)
--
--   出資比率検算 (分母 47,500株):
--     星野毅: 30,000 / 47,500 = 0.631578947368...  => 63.1578947368%
--     UMI  : 15,000 / 47,500 = 0.315789473684...  => 31.5789473684%
--     QST  :  2,500 / 47,500 = 0.052631578947...  =>  5.2631578947%
--     合計 : 63.1578947368 + 31.5789473684 + 5.2631578947 = 100.0000000000% (丸め誤差除く)

-- ============================================================
-- 1. 旧 opening_balance (migration 174 backfill) を無効化する。
--    entries は原本履歴の参照用にそのまま残す。
-- ============================================================
UPDATE public.project_equity_transactions
SET status     = 'void',
    notes      = '原本の株式イベント履歴 (xlsx:LST_captable_250415.xlsx) に置き換えたため無効化。entries はそのまま保持する。',
    updated_by_email = 'migration_175',
    updated_at = now()
WHERE project_id = 'p07'
  AND source_ref = 'migration:project_shareholders:opening'
  AND status IS DISTINCT FROM 'void';

-- ============================================================
-- 2. 既存 Seed ラウンドを原本の値へ補正する。source_ref は既存値を維持する。
-- ============================================================
UPDATE public.project_valuation_rounds
SET pre_money_yen        = 300000000,
    post_money_yen       = 450000000,
    raised_yen           = 150000000,
    price_per_share_yen  = 10000,
    status               = 'closed',
    updated_at           = now()
WHERE project_id = 'p07'
  AND (round_date = '2023-12-01' OR round_name ILIKE '%Seed%')
  AND (
    pre_money_yen       IS DISTINCT FROM 300000000 OR
    post_money_yen      IS DISTINCT FROM 450000000 OR
    raised_yen          IS DISTINCT FROM 150000000 OR
    price_per_share_yen IS DISTINCT FROM 10000 OR
    status               IS DISTINCT FROM 'closed'
  );

-- ============================================================
-- 3. QST 現物出資ラウンドを原本参照 (source_ref) 単位で新規登録する。
-- ============================================================
INSERT INTO public.project_valuation_rounds (
  project_id, round_name, round_date, round_ym,
  pre_money_yen, post_money_yen, raised_yen, price_per_share_yen,
  lead_investor, security_type, status, source_ref
)
SELECT
  'p07', 'QST現物出資', '2025-03-01', '202503',
  450000000, 475000000, 25000000, 10000,
  'QST', '普通株式', 'closed', 'xlsx:LST_captable_250415.xlsx#qst-202503'
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_valuation_rounds
  WHERE project_id = 'p07'
    AND source_ref = 'xlsx:LST_captable_250415.xlsx#qst-202503'
);

-- ============================================================
-- 4. 原本 (xlsx:LST_captable_250415.xlsx) 由来の 3 つの確定株式イベントを
--    source_ref 単位で復元し、対応するラウンドへ link する。
-- ============================================================

-- 4a. 設立 (2023-07-01)
INSERT INTO public.project_equity_transactions (
  project_id, round_id, effective_on, transaction_type, description, status, source_ref, created_by_email
)
SELECT
  'p07', NULL, '2023-07-01', 'incorporation', '設立', 'confirmed',
  'xlsx:LST_captable_250415.xlsx#incorporation-202307', 'migration_175'
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_equity_transactions
  WHERE project_id = 'p07' AND source_ref = 'xlsx:LST_captable_250415.xlsx#incorporation-202307'
);

-- 4b. Seed 新株発行 (2023-12-01) — 既存 Seed ラウンドへ link
INSERT INTO public.project_equity_transactions (
  project_id, round_id, effective_on, transaction_type, description, status, source_ref, created_by_email
)
SELECT
  'p07',
  (SELECT id FROM public.project_valuation_rounds
    WHERE project_id = 'p07' AND (round_date = '2023-12-01' OR round_name ILIKE '%Seed%')
    ORDER BY round_date NULLS LAST LIMIT 1),
  '2023-12-01', 'new_issue', 'Seed', 'confirmed',
  'xlsx:LST_captable_250415.xlsx#seed-202312', 'migration_175'
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_equity_transactions
  WHERE project_id = 'p07' AND source_ref = 'xlsx:LST_captable_250415.xlsx#seed-202312'
);

-- 4c. QST 現物出資 (2025-03-01) — QST ラウンドへ link
INSERT INTO public.project_equity_transactions (
  project_id, round_id, effective_on, transaction_type, description, status, source_ref, created_by_email
)
SELECT
  'p07',
  (SELECT id FROM public.project_valuation_rounds
    WHERE project_id = 'p07' AND source_ref = 'xlsx:LST_captable_250415.xlsx#qst-202503'),
  '2025-03-01', 'in_kind_contribution', 'QST現物出資', 'confirmed',
  'xlsx:LST_captable_250415.xlsx#qst-202503', 'migration_175'
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_equity_transactions
  WHERE project_id = 'p07' AND source_ref = 'xlsx:LST_captable_250415.xlsx#qst-202503'
);

-- 4b-fix. 部分適用 (transaction は既に作成済みだが round 未紐付け) を補修する。
--         INSERT は既存 source_ref があると skip されるため、その場合でも round_id を正しく揃える。
UPDATE public.project_equity_transactions tx
SET round_id = r.id
FROM public.project_valuation_rounds r
WHERE tx.project_id = 'p07'
  AND tx.source_ref = 'xlsx:LST_captable_250415.xlsx#seed-202312'
  AND r.project_id = 'p07'
  AND (r.round_date = '2023-12-01' OR r.round_name ILIKE '%Seed%')
  AND tx.round_id IS DISTINCT FROM r.id;

-- 4c-fix. 同様に QST 現物出資 transaction の round 紐付けを補修する。
UPDATE public.project_equity_transactions tx
SET round_id = r.id
FROM public.project_valuation_rounds r
WHERE tx.project_id = 'p07'
  AND tx.source_ref = 'xlsx:LST_captable_250415.xlsx#qst-202503'
  AND r.project_id = 'p07'
  AND r.source_ref = 'xlsx:LST_captable_250415.xlsx#qst-202503'
  AND tx.round_id IS DISTINCT FROM r.id;

-- 4d. entries を、対応する transaction が存在し当該 holder/security_class の行がまだ無い場合だけ補完する。
--     (部分適用: transaction は既に作成済みだが entry が欠けているケースにも対応)
INSERT INTO public.project_equity_entries (
  transaction_id, project_id, holder_type, holder_name, security_class,
  outstanding_delta, diluted_delta, paid_in_yen_delta
)
SELECT tx.id, 'p07', 'founder', '星野毅', '普通株式', 30000, 30000, 3000000
FROM public.project_equity_transactions tx
WHERE tx.project_id = 'p07'
  AND tx.source_ref = 'xlsx:LST_captable_250415.xlsx#incorporation-202307'
  AND NOT EXISTS (
    SELECT 1 FROM public.project_equity_entries e
    WHERE e.transaction_id = tx.id AND e.holder_name = '星野毅' AND e.security_class = '普通株式'
  );

INSERT INTO public.project_equity_entries (
  transaction_id, project_id, holder_type, holder_name, security_class,
  outstanding_delta, diluted_delta, paid_in_yen_delta
)
SELECT tx.id, 'p07', 'vc', 'UMI3号投資事業有限責任組合', 'シード種優先株式', 15000, 15000, 150000000
FROM public.project_equity_transactions tx
WHERE tx.project_id = 'p07'
  AND tx.source_ref = 'xlsx:LST_captable_250415.xlsx#seed-202312'
  AND NOT EXISTS (
    SELECT 1 FROM public.project_equity_entries e
    WHERE e.transaction_id = tx.id AND e.holder_name = 'UMI3号投資事業有限責任組合' AND e.security_class = 'シード種優先株式'
  );

INSERT INTO public.project_equity_entries (
  transaction_id, project_id, holder_type, holder_name, security_class,
  outstanding_delta, diluted_delta, paid_in_yen_delta
)
SELECT tx.id, 'p07', 'other', 'QST', '普通株式', 2500, 2500, 25000000
FROM public.project_equity_transactions tx
WHERE tx.project_id = 'p07'
  AND tx.source_ref = 'xlsx:LST_captable_250415.xlsx#qst-202503'
  AND NOT EXISTS (
    SELECT 1 FROM public.project_equity_entries e
    WHERE e.transaction_id = tx.id AND e.holder_name = 'QST' AND e.security_class = '普通株式'
  );

-- ============================================================
-- 5. 互換用 project_shareholders スナップショットを整合させる。
--    unique 制約が無いため、まず該当行を UPDATE し、無ければだけ INSERT する。
-- ============================================================

-- 5a. 旧スナップショット (as_of_ym = 202312) を current から外す。
UPDATE public.project_shareholders
SET is_current = false,
    updated_at = now()
WHERE project_id = 'p07'
  AND as_of_ym = '202312'
  AND is_current IS DISTINCT FROM false;

-- 5b. 202503 時点の 3 holder を正しい値へ揃える (UPDATE 優先、無ければ INSERT)。

UPDATE public.project_shareholders
SET holder_type   = 'founder',
    shares        = 30000,
    ownership_pct = 63.1578947368,
    invested_yen  = 3000000,
    is_current    = true,
    round_id      = (SELECT id FROM public.project_valuation_rounds
                       WHERE project_id = 'p07' AND source_ref = 'xlsx:LST_captable_250415.xlsx#qst-202503'),
    source_ref    = 'xlsx:LST_captable_250415.xlsx#qst-202503',
    updated_at    = now()
WHERE project_id = 'p07'
  AND as_of_ym = '202503'
  AND holder_name = '星野毅'
  AND share_class = '普通株式';

INSERT INTO public.project_shareholders (
  project_id, holder_type, holder_name, share_class, shares, ownership_pct,
  invested_yen, as_of_ym, is_current, round_id, source_ref
)
SELECT
  'p07', 'founder', '星野毅', '普通株式', 30000, 63.1578947368,
  3000000, '202503', true,
  (SELECT id FROM public.project_valuation_rounds
    WHERE project_id = 'p07' AND source_ref = 'xlsx:LST_captable_250415.xlsx#qst-202503'),
  'xlsx:LST_captable_250415.xlsx#qst-202503'
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_shareholders
  WHERE project_id = 'p07' AND as_of_ym = '202503' AND holder_name = '星野毅' AND share_class = '普通株式'
);

UPDATE public.project_shareholders
SET holder_type   = 'vc',
    shares        = 15000,
    ownership_pct = 31.5789473684,
    invested_yen  = 150000000,
    is_current    = true,
    round_id      = (SELECT id FROM public.project_valuation_rounds
                       WHERE project_id = 'p07' AND source_ref = 'xlsx:LST_captable_250415.xlsx#qst-202503'),
    source_ref    = 'xlsx:LST_captable_250415.xlsx#qst-202503',
    updated_at    = now()
WHERE project_id = 'p07'
  AND as_of_ym = '202503'
  AND holder_name = 'UMI3号投資事業有限責任組合'
  AND share_class = 'シード種優先株式';

INSERT INTO public.project_shareholders (
  project_id, holder_type, holder_name, share_class, shares, ownership_pct,
  invested_yen, as_of_ym, is_current, round_id, source_ref
)
SELECT
  'p07', 'vc', 'UMI3号投資事業有限責任組合', 'シード種優先株式', 15000, 31.5789473684,
  150000000, '202503', true,
  (SELECT id FROM public.project_valuation_rounds
    WHERE project_id = 'p07' AND source_ref = 'xlsx:LST_captable_250415.xlsx#qst-202503'),
  'xlsx:LST_captable_250415.xlsx#qst-202503'
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_shareholders
  WHERE project_id = 'p07' AND as_of_ym = '202503' AND holder_name = 'UMI3号投資事業有限責任組合' AND share_class = 'シード種優先株式'
);

UPDATE public.project_shareholders
SET holder_type   = 'other',
    shares        = 2500,
    ownership_pct = 5.2631578947,
    invested_yen  = 25000000,
    is_current    = true,
    round_id      = (SELECT id FROM public.project_valuation_rounds
                       WHERE project_id = 'p07' AND source_ref = 'xlsx:LST_captable_250415.xlsx#qst-202503'),
    source_ref    = 'xlsx:LST_captable_250415.xlsx#qst-202503',
    updated_at    = now()
WHERE project_id = 'p07'
  AND as_of_ym = '202503'
  AND holder_name = 'QST'
  AND share_class = '普通株式';

INSERT INTO public.project_shareholders (
  project_id, holder_type, holder_name, share_class, shares, ownership_pct,
  invested_yen, as_of_ym, is_current, round_id, source_ref
)
SELECT
  'p07', 'other', 'QST', '普通株式', 2500, 5.2631578947,
  25000000, '202503', true,
  (SELECT id FROM public.project_valuation_rounds
    WHERE project_id = 'p07' AND source_ref = 'xlsx:LST_captable_250415.xlsx#qst-202503'),
  'xlsx:LST_captable_250415.xlsx#qst-202503'
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_shareholders
  WHERE project_id = 'p07' AND as_of_ym = '202503' AND holder_name = 'QST' AND share_class = '普通株式'
);
