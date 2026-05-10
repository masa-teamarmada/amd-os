-- 039_triple_helix_loading_c_compete_available.sql
--
-- C_compete (競合密度) を Phase 2-A で実装した (triple-helix-observations.ts で
-- project_ventures から quarter 別に集計)。available=TRUE に更新して観測モデルに参加させる。

UPDATE triple_helix_loading
SET available = TRUE,
    data_source = 'project_ventures (lane × quarter で alive count、内部 DB)',
    updated_at = NOW()
WHERE observation = 'C_compete';
