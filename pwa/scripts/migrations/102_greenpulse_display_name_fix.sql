-- 102_greenpulse_display_name_fix.sql
--
-- 2026-05-27 修正:
--   migration 101 で p26 GreenPulse の display_name を 'GreenPulse (仮称)' で登録した後、
--   まさが手動で 'GP (仮称)' に編集していたが、これは CX/SX パターン
--   (display_name=フルネーム / short_label=略称 / project_name=略称) から外れる。
--
-- CX/SX パターンに揃える:
--   p20 CX: project_name='CX', display_name='CryoX',     short_label='CX'
--   p21 SX: project_name='SX', display_name='SolvioraX', short_label='SX'
--   p26 GP: project_name='GP', display_name='GreenPulse', short_label='GP'  ← これに揃える
--
-- 「仮称」は CX/SX 共に display_name に含まれていないので、GP も含めない。

UPDATE project_ventures
SET display_name = 'GreenPulse',
    updated_at   = NOW()
WHERE project_id = 'p26';

-- projects.project_name = 'GP' は既に正しいのでそのまま。
-- short_label = 'GP' も既に正しいのでそのまま。
