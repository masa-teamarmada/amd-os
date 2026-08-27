-- BZM 3.0 の案件ごとの入力に、パラメータ1件ずつの根拠の欄を足す。
--
-- 331 で作った seed_bzm30_inputs には、根拠を書ける欄が
-- classification_reason（型×規制）・evidence_stage_reason（証拠水準）・self_revenue_note（自走力）と、
-- 案件ぜんぶをまとめて書く note の4つしか無かった。
-- そのため手元資金・権利残件・専有可能性・産官学モメンタム・担い手・単位採算の根拠が
-- シーズ詳細の「入力の充足」の表に出ず、画面には型どおりの一般論しか並ばない状態だった。
--
-- pwa/spec「4-8 BZM 3.0 スコアパネル」§2.1 は、この表の5列目を
-- 「根拠・何を調べれば埋まるか」と定めている。案件ごとに調べた根拠がそこへ出ないと、
-- 何が観測で何が Tier 0 の既定かは色でしか分からず、なぜその値なのかが画面から追えない。
--
-- 欄を1件ずつに割るのは、まとめて1つの note に書くと必ず片方だけ古くなるため
-- （model/README.md (a-2) と同じ理由）。

ALTER TABLE seed_bzm30_inputs
  -- 手元資金 s^f_0 の根拠。いつ時点の何の数字か、残高か調達額かまで書く
  ADD COLUMN IF NOT EXISTS free_cash_reason TEXT,
  -- バーンレート。**参照実装は案件ごとのバーンレートを受け取らない**ので計算には入らないが、
  -- 実績と型別の既定が何倍ずれているかを画面から見えるようにするために残す
  ADD COLUMN IF NOT EXISTS burn_rate_yen_month BIGINT,
  ADD COLUMN IF NOT EXISTS burn_rate_reason TEXT,
  -- 権利・承認の未解決の残件 R_0 の根拠。どの残件が残っているかを書く
  ADD COLUMN IF NOT EXISTS rights_open_reason TEXT,
  -- 受託契約中 x_0 の根拠
  ADD COLUMN IF NOT EXISTS under_contract_reason TEXT,
  -- 専有可能性 κ_IP の根拠。モデルページ §6.I-9-1 の4区分のどれに当たるか
  ADD COLUMN IF NOT EXISTS kappa_ip_reason TEXT,
  -- 産官学モメンタム σ の根拠。置かない場合はその理由
  ADD COLUMN IF NOT EXISTS sigma_reason TEXT,
  -- 担い手 e の根拠。実働の記録（会議・意思決定・対外説明）だけで更新する
  ADD COLUMN IF NOT EXISTS evangelist_e_reason TEXT,
  -- 単位採算の根拠
  ADD COLUMN IF NOT EXISTS unit_margin_reason TEXT,
  -- 会社化 ι_0 の根拠
  ADD COLUMN IF NOT EXISTS incorporated_reason TEXT;

COMMENT ON COLUMN seed_bzm30_inputs.burn_rate_yen_month IS
  '案件の実績または計画のバーンレート（円／月）。参照実装 bzm30_forward.cjs は案件ごとのバーンレートを受け取らず、工程の型と会社化の有無から引く既定値（§6.I-9-2）で計算する。この欄は計算に入らない記録用で、実績と既定値のずれを画面に出すために置く。';
