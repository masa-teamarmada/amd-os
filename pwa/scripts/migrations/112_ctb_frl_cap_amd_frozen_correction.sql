-- 112_ctb_frl_cap_amd_frozen_correction.sql
-- CTB frozen correction (2026-05-31, masa instruction).
--
-- Instruction:
--   "CTBもfrozenだし、amd activeは無しにしといて。"
--
-- Meaning:
--   p06 CTB should not have category='amd' active related members in the
--   current state. Keep the historical AMD row as non-active evidence, but do
--   not count it for current F_capability.

UPDATE project_founding_members
   SET status = 'left',
       notes = CASE
         WHEN notes IS NULL OR notes = ''
         THEN '[2026-05-31 #112] まさ指示: CTB frozen のため current AMD active なし。FRL_cap_amd 算定対象から除外。'
         WHEN notes LIKE '%[2026-05-31 #112]%'
         THEN notes
         ELSE notes || ' / [2026-05-31 #112] まさ指示: CTB frozen のため current AMD active なし。FRL_cap_amd 算定対象から除外。'
       END,
       updated_at = now()
 WHERE project_id = 'p06'
   AND category = 'amd'
   AND status = 'active';

UPDATE amd_score_inputs
   SET frl_cap = 3,
       frl_cap_amd = 0,
       frl_cap_notes = '[2026-05-31 #112 correction] まさ指示「CTBもfrozenだし、amd activeは無し」。current state では AMD active なしのため F_cap(全員)=F_cap(AMD抜き)=3、frl_cap_amd=0。丸島=医師・研究者CEOで創薬/AMED実務を回す基礎力はLv3。過去のまさCOO参画は履歴として残すが、current active寄与には算入しない。',
       frl_ces_a = COALESCE(frl_ces_a, 0.6),
       frl_ces_rho = COALESCE(frl_ces_rho, -2),
       updated_at = now()
 WHERE id = '0f785a63-4229-4da5-90e3-b4d85a59d242';
