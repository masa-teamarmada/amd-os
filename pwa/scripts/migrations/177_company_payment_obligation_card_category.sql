-- 177_company_payment_obligation_card_category.sql
--
-- カード請求と銀行の引落案内を同一義務として分類できるようにする。

ALTER TABLE public.company_payment_obligations
  DROP CONSTRAINT IF EXISTS company_payment_obligations_category_check;

ALTER TABLE public.company_payment_obligations
  ADD CONSTRAINT company_payment_obligations_category_check
  CHECK (category IN (
    'tax',
    'social_insurance',
    'payroll',
    'reimbursement',
    'reward',
    'invoice',
    'subscription',
    'loan',
    'card_payment',
    'other'
  ));
