-- =============================================================
-- AMD OS v2: 立替精算テーブル + billing_cycles 明細テンプレート列
-- =============================================================

-- 1. reimbursements テーブル
CREATE TABLE IF NOT EXISTS reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('transport', 'lodging', 'supplies', 'meal', 'other')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  tax_rate NUMERIC(4,2) NOT NULL DEFAULT 0.10 CHECK (tax_rate IN (0, 0.08, 0.10)),
  description TEXT NOT NULL,

  -- 交通費用フィールド
  transport_mode TEXT CHECK (transport_mode IN ('train', 'bus', 'taxi', 'car')),
  transport_from TEXT,
  transport_to TEXT,
  transport_trip TEXT CHECK (transport_trip IN ('one_way', 'round')),

  -- レシート
  receipt_path TEXT,  -- Supabase Storage path
  receipt_file_name TEXT,

  -- 承認フロー
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'pm_approved', 'approved', 'rejected', 'paid')),
  created_by UUID NOT NULL REFERENCES members(id),
  pm_approved_by UUID REFERENCES members(id),
  pm_approved_at TIMESTAMPTZ,
  admin_approved_by UUID REFERENCES members(id),
  admin_approved_at TIMESTAMPTZ,

  -- 請求書組込
  billed_ym TEXT,           -- 請求済みの月 "YYYY-MM"
  billed_at TIMESTAMPTZ,
  billed_by UUID REFERENCES members(id),
  billing_cycle_id UUID REFERENCES billing_cycles(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- updated_at トリガー
CREATE TRIGGER reimbursements_updated_at
  BEFORE UPDATE ON reimbursements
  FOR EACH ROW EXECUTE FUNCTION update_settings_updated_at();

-- インデックス
CREATE INDEX idx_reimbursements_project_status ON reimbursements(project_id, status);
CREATE INDEX idx_reimbursements_billed ON reimbursements(project_id, billed_ym);

-- RLS
ALTER TABLE reimbursements ENABLE ROW LEVEL SECURITY;

-- SELECT: プロジェクトメンバーが閲覧可
CREATE POLICY "reimb_select" ON reimbursements FOR SELECT TO authenticated
  USING (project_id IN (SELECT my_project_ids()));

-- INSERT: プロジェクトメンバーが作成可
CREATE POLICY "reimb_insert" ON reimbursements FOR INSERT TO authenticated
  WITH CHECK (project_id IN (SELECT my_project_ids()));

-- UPDATE: プロジェクトメンバーが更新可（承認含む）
CREATE POLICY "reimb_update" ON reimbursements FOR UPDATE TO authenticated
  USING (project_id IN (SELECT my_project_ids()))
  WITH CHECK (project_id IN (SELECT my_project_ids()));

-- 2. billing_cycles に明細テンプレート列追加
ALTER TABLE billing_cycles ADD COLUMN IF NOT EXISTS invoice_subject TEXT;
ALTER TABLE billing_cycles ADD COLUMN IF NOT EXISTS invoice_base_lines_json JSONB;
ALTER TABLE billing_cycles ADD COLUMN IF NOT EXISTS invoice_reimb_prefix TEXT DEFAULT '[立替]';
ALTER TABLE billing_cycles ADD COLUMN IF NOT EXISTS invoice_remark TEXT;
ALTER TABLE billing_cycles ADD COLUMN IF NOT EXISTS invoice_custom_lines_json JSONB;
ALTER TABLE billing_cycles ADD COLUMN IF NOT EXISTS invoice_reimb_total INTEGER;

-- 3. projects にテンプレート列追加
ALTER TABLE projects ADD COLUMN IF NOT EXISTS invoice_base_lines_template_json JSONB;

-- 4. Supabase Storage バケット（レシート保存用）
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "receipt_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');

CREATE POLICY "receipt_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');
