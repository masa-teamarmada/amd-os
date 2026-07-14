-- 172_business_cards.sql
--
-- 名刺画像を保護された台帳へ保存し、OCR結果を人が確認してから
-- D-3 project_knowledge(category='people') へ反映する。
-- 連絡先そのものは project_knowledge へ複製しない。

CREATE TABLE IF NOT EXISTS public.business_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NULL,
  full_name_kana text NULL,
  company_name text NULL,
  department text NULL,
  job_title text NULL,
  email text NULL,
  normalized_email text NULL,
  phone text NULL,
  mobile text NULL,
  normalized_phone text NULL,
  postal_code text NULL,
  address text NULL,
  website text NULL,
  relationship_note text NULL,
  met_on date NULL,
  raw_ocr_text text NULL,
  field_confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ocr_confidence numeric NULL CHECK (ocr_confidence IS NULL OR (ocr_confidence >= 0 AND ocr_confidence <= 1)),
  ocr_model text NULL,
  ocr_prompt_key text NOT NULL DEFAULT 'business_card.ocr',
  ocr_error text NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','needs_review','confirmed','ocr_failed','archived')),
  storage_bucket text NOT NULL DEFAULT 'business-cards',
  storage_path text NOT NULL,
  original_file_name text NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL DEFAULT 0 CHECK (file_size_bytes >= 0),
  image_sha256 text NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid NULL,
  created_by_email text NOT NULL,
  confirmed_by_email text NULL,
  confirmed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_email text NULL
);

CREATE INDEX IF NOT EXISTS idx_business_cards_status_updated
  ON public.business_cards(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_cards_name
  ON public.business_cards(lower(full_name));
CREATE INDEX IF NOT EXISTS idx_business_cards_company
  ON public.business_cards(lower(company_name));
CREATE INDEX IF NOT EXISTS idx_business_cards_normalized_email
  ON public.business_cards(normalized_email)
  WHERE normalized_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_business_cards_normalized_phone
  ON public.business_cards(normalized_phone)
  WHERE normalized_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_business_cards_image_sha256
  ON public.business_cards(image_sha256)
  WHERE image_sha256 IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.business_card_project_links (
  business_card_id uuid NOT NULL REFERENCES public.business_cards(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  project_knowledge_id uuid NULL REFERENCES public.project_knowledge(id) ON DELETE SET NULL,
  created_by_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_card_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_business_card_project_links_project
  ON public.business_card_project_links(project_id, updated_at DESC);

ALTER TABLE public.business_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_card_project_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.business_cards FROM anon, authenticated;
REVOKE ALL ON TABLE public.business_card_project_links FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.business_cards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.business_card_project_links TO service_role;

DROP POLICY IF EXISTS business_cards_service_role_all ON public.business_cards;
CREATE POLICY business_cards_service_role_all
  ON public.business_cards
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS business_card_project_links_service_role_all ON public.business_card_project_links;
CREATE POLICY business_card_project_links_service_role_all
  ON public.business_card_project_links
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-cards',
  'business-cards',
  false,
  4194304,
  ARRAY['image/jpeg','image/png','image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO public.llm_prompts (
  prompt_key,
  description,
  body,
  model,
  max_tokens,
  is_active,
  notes,
  updated_by
)
VALUES (
  'business_card.ocr',
  '名刺画像から氏名・所属・役職・連絡先を構造化するOCR。結果は必ず人が確認してから確定する。',
  $$あなたは日本語と英語の名刺を正確に読み取るOCR担当。画像に見える内容だけを転記し、推測で補完しない。

次のキーを持つJSONオブジェクトだけを返す。
{
  "full_name": "氏名。読めなければnull",
  "full_name_kana": "ふりがな・ローマ字表記。明記がなければnull",
  "company_name": "会社・大学・組織名。読めなければnull",
  "department": "部署・研究室。読めなければnull",
  "job_title": "役職。読めなければnull",
  "email": "メール。読めなければnull",
  "phone": "代表・固定電話。読めなければnull",
  "mobile": "携帯電話。読めなければnull",
  "postal_code": "郵便番号。読めなければnull",
  "address": "住所。読めなければnull",
  "website": "Webサイト。読めなければnull",
  "raw_text": "画像で読めた文字を改行つきで転記。読めない文字を創作しない",
  "confidence": 0.0,
  "field_confidence": {
    "full_name": 0.0,
    "company_name": 0.0,
    "department": 0.0,
    "job_title": 0.0,
    "email": 0.0,
    "phone": 0.0,
    "mobile": 0.0,
    "postal_code": 0.0,
    "address": 0.0,
    "website": 0.0
  }
}

ルール:
- confidenceは0から1。
- 複数候補がある場合も最も明確な1人分だけを入れる。
- QRコードのURLはwebsiteとして読める場合だけ入れる。
- JSON以外の説明、Markdown、コードフェンスは返さない。$$,
  'gemini-2.5-flash',
  2048,
  true,
  'AMD OS /admin/prompts で全文編集可能。名刺確定前に人の確認を必須とする。',
  'migration_172'
)
ON CONFLICT (prompt_key) DO NOTHING;

COMMENT ON TABLE public.business_cards IS
  '保護された名刺台帳。OCR結果はneeds_reviewを経てconfirmedにする。画像・連絡先はproject_knowledgeへ複製しない。';
COMMENT ON TABLE public.business_card_project_links IS
  '名刺とPJの多対多対応。confirmed時に生成・更新したD-3 people行をproject_knowledge_idで追跡する。';
