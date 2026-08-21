-- 310_se_p10_external_workspace_access.sql
-- 2026-08-21 SE(p10)の関係者5名へ、ワークスペース（資料室）の閲覧アクセスを付与する（まさ指示）。
-- 組合設計書のHTML版をブラウザで読めるようにするため。PDFはメール添付で別途送る。
-- ログインはメールアドレス宛の確認コード方式（/api/auth/email-start）。登録済みかつ
-- status が invited/active の口にだけコードが送られる。
-- 権限は最小の readonly（資料の閲覧のみ。稼働入力や管理操作は不可）。
--   ・藤原社長、西鳥羽さん、岸本COO … 翔エンジニアリング
--   ・小林さん、及川先生（日本大学）… WiPoT市場開拓グループの協働メンバー
-- 既存の招待を復活させない仕様（route.ts の不変条件3）に合わせ、新規行のみを作る。

BEGIN;

-- email_normalized は生成列のため指定しない
INSERT INTO public.workspace_user_accounts (id, email, display_name, status)
VALUES
  ('69e303be-588f-47dc-b761-dc73ae2d225d', 'qfujiwara3192@ozzio.jp',           '藤原暉雄 様（翔エンジニアリング）', 'invited'),
  ('4bbf3bdd-da0c-4de2-b927-6f70c228c64e', 'nishitoba-takakazu@sho-eng.co.jp', '西鳥羽孝員 様（翔エンジニアリング）', 'invited'),
  ('77bfa01b-3608-4dd0-b8ab-54e63b35686c', 'kishimoto-atsushi@sho-eng.co.jp',  '岸本篤始 様（翔エンジニアリング）', 'invited'),
  ('60d04d82-cfb8-4fe8-8371-df5d69fb0a57', 'tomzmomozo0930@gmail.com',         '小林 様', 'invited'),
  ('5fcfba58-41e3-46ca-8528-b41ec483e1b4', 'oikawa19600620@gmail.com',         '及川純 先生（日本大学）', 'invited')
ON CONFLICT (email_normalized) DO NOTHING;

INSERT INTO public.project_access_memberships (user_account_id, project_id, role, status)
SELECT a.id, 'p10', 'readonly', 'invited'
FROM public.workspace_user_accounts a
WHERE a.email_normalized IN (
  'qfujiwara3192@ozzio.jp',
  'nishitoba-takakazu@sho-eng.co.jp',
  'kishimoto-atsushi@sho-eng.co.jp',
  'tomzmomozo0930@gmail.com',
  'oikawa19600620@gmail.com'
)
AND NOT EXISTS (
  SELECT 1 FROM public.project_access_memberships m
  WHERE m.user_account_id = a.id AND m.project_id = 'p10'
);

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM public.project_access_memberships m
  JOIN public.workspace_user_accounts a ON a.id = m.user_account_id
  WHERE m.project_id = 'p10' AND m.status IN ('invited','active');
  IF n <> 5 THEN
    RAISE EXCEPTION 'p10 external access expected 5 rows, got %', n;
  END IF;
END
$$;

COMMIT;
