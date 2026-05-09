-- 019_vc_bwe_mirai_investment.sql
--
-- みらい創造インベストメンツ → BWE 1億 2026-05 出資予定の記録。
-- まさ情報 (2026-05-08)。投資はまだ完了していない予定段階だが、
-- 関係を残すために vc_investments + project_events に記録する。
--
-- BWE = project_id 'p11' (Blue Water Energy)
-- vc_investments には our_project_id='p11' で紐付け
-- project_events には kind='funding' で記録 → 沿革に反映される
-- 同時に project_ventures.narrative_invalidated_at を立てて、
-- 次の沿革再生成 cron (03:45 daily) で narrative_text に取り込む

DO $$
DECLARE
  v_vc_id UUID;
  v_fund_id UUID;
BEGIN
  SELECT id INTO v_vc_id FROM vcs WHERE name = 'みらい創造インベストメンツ';
  IF v_vc_id IS NULL THEN
    RAISE NOTICE 'みらい創造インベストメンツ が見つかりません。skip';
    RETURN;
  END IF;

  -- 既存のファンド情報があれば最新号を選ぶ (なければ NULL)
  SELECT id INTO v_fund_id
    FROM vc_funds
    WHERE vc_id = v_vc_id
      AND status IN ('investing', 'first_closed', 'final_closed', 'raising')
    ORDER BY fund_no DESC
    LIMIT 1;

  -- vc_investments: 重複を避けて insert
  INSERT INTO vc_investments (
    vc_id, fund_id, target_company, target_company_en,
    our_project_id, amount_jpy, round, invested_at, is_lead,
    source_url, notes
  )
  SELECT v_vc_id, v_fund_id, 'Blue Water Energy', 'Blue Water Energy',
         'p11', 100000000, 'seed', '2026-05-31', FALSE,
         NULL,
         'AMD CEO まさ情報 (2026-05-08)。出資予定段階、最終的なクローズ日 / リード有無 / ラウンド種別は確定後に更新。'
  WHERE NOT EXISTS (
    SELECT 1 FROM vc_investments
    WHERE vc_id = v_vc_id
      AND target_company = 'Blue Water Energy'
      AND our_project_id = 'p11'
  );

  -- project_events: BWE の沿革にも記録
  INSERT INTO project_events (project_id, occurred_on, kind, label, meta, source)
  SELECT 'p11', '2026-05-31', 'funding',
         'みらい創造インベストメンツから 1 億円出資予定',
         jsonb_build_object(
           'amount_yen', 100000000,
           'lead', 'みらい創造インベストメンツ',
           'round', 'seed',
           'status', 'planned',
           'note', 'AMD CEO まさ情報 2026-05-08'
         ),
         'manual'
  WHERE NOT EXISTS (
    SELECT 1 FROM project_events
    WHERE project_id = 'p11'
      AND kind = 'funding'
      AND occurred_on = '2026-05-31'
      AND label LIKE '%みらい創造%'
  );

  -- narrative 再生成を予約
  UPDATE project_ventures
    SET narrative_invalidated_at = NOW()
  WHERE project_id = 'p11';
END $$;
