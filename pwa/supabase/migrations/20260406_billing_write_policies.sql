-- =============================================================
-- AMD OS v2: Billing 書き込みポリシー + settings テーブル
-- =============================================================

-- 1. settings テーブル（freeeトークン等のKV保存用）
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS settings_updated_at ON settings;
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_settings_updated_at();

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
-- settings は Edge Functions (service_role) のみアクセス。anon/authenticated には非公開
CREATE POLICY "settings_no_public" ON settings FOR ALL TO authenticated USING (false);

-- freee認証情報の初期行
INSERT INTO settings (key, value, description)
VALUES (
  'freee_credentials',
  '{"access_token":"","refresh_token":"","expires_at":0}'::jsonb,
  'freee OAuth tokens managed by Edge Functions'
) ON CONFLICT (key) DO NOTHING;

-- 2. projects テーブルに freee_invoice_template_id 追加
ALTER TABLE projects ADD COLUMN IF NOT EXISTS freee_invoice_template_id TEXT;

-- 3. Supabase Storage バケット（請求書PDF保存用）
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- 4. RLS 書き込みポリシー

-- billing_cycles: プロジェクトメンバーが更新可能
CREATE POLICY "bc_update" ON billing_cycles FOR UPDATE TO authenticated
  USING (project_id IN (SELECT my_project_ids()))
  WITH CHECK (project_id IN (SELECT my_project_ids()));

-- invoices: プロジェクトメンバーが作成・更新可能
CREATE POLICY "inv_insert" ON invoices FOR INSERT TO authenticated
  WITH CHECK (billing_cycle_id IN (
    SELECT id FROM billing_cycles WHERE project_id IN (SELECT my_project_ids())
  ));

CREATE POLICY "inv_update" ON invoices FOR UPDATE TO authenticated
  USING (billing_cycle_id IN (
    SELECT id FROM billing_cycles WHERE project_id IN (SELECT my_project_ids())
  ))
  WITH CHECK (billing_cycle_id IN (
    SELECT id FROM billing_cycles WHERE project_id IN (SELECT my_project_ids())
  ));

-- payment_confirmations: プロジェクトメンバーが作成可能（kyoko制限はEdge Function側）
CREATE POLICY "pc_insert" ON payment_confirmations FOR INSERT TO authenticated
  WITH CHECK (billing_cycle_id IN (
    SELECT id FROM billing_cycles WHERE project_id IN (SELECT my_project_ids())
  ));

-- billing_logs: 全アクティブメンバーが追記可能（append-only）
CREATE POLICY "bl_insert" ON billing_logs FOR INSERT TO authenticated
  WITH CHECK (is_active_member());

-- payout_notices: 自分のレコードのみ更新可能
CREATE POLICY "pn_update" ON payout_notices FOR UPDATE TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- billing_allocations: プロジェクトメンバーが作成・更新可能
CREATE POLICY "ba_insert" ON billing_allocations FOR INSERT TO authenticated
  WITH CHECK (billing_cycle_id IN (
    SELECT id FROM billing_cycles WHERE project_id IN (SELECT my_project_ids())
  ));

CREATE POLICY "ba_update" ON billing_allocations FOR UPDATE TO authenticated
  USING (billing_cycle_id IN (
    SELECT id FROM billing_cycles WHERE project_id IN (SELECT my_project_ids())
  ))
  WITH CHECK (billing_cycle_id IN (
    SELECT id FROM billing_cycles WHERE project_id IN (SELECT my_project_ids())
  ));

-- billing_cycles: プロジェクトメンバーが新規サイクル作成可能
CREATE POLICY "bc_insert" ON billing_cycles FOR INSERT TO authenticated
  WITH CHECK (project_id IN (SELECT my_project_ids()));

-- storage: invoices バケットへのアクセスポリシー
CREATE POLICY "invoice_pdf_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoices');

CREATE POLICY "invoice_pdf_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoices');
