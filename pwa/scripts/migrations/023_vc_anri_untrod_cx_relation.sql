-- 023_vc_anri_untrod_cx_relation.sql
--
-- Web 調査結果に基づくデータ追加 (2026-05-08):
--
-- 1. ANRI に HARDCORE サブファンド (60 億、2017 設立) を追加
--    GP は鮫島昌弘 (核融合 / 量子コンピュータカンパニークリエーション中心)
--
-- 2. UntroD に新ファンド 2 つ追加:
--    - Real Tech Fund 4: 125 億、2025-04 ファイナルクローズ
--    - Real Tech Debt Fund: 三菱UFJ信託銀行と提携、UntroD Bridge Capital
--      (子会社、2025-07-08 設立) が運営、規模未公表
--
-- 3. ANRI 鮫島昌弘 GP を vc_contacts に追加
--
-- 4. CryoX (p20) × ANRI のリレーションを作成 (status=pitching、contact=鮫島)
--    まさ情報: 「鮫島さんが作ったファンド」が CX にコンタクトしてきている
--
-- 出典:
--   - https://www.fastgrow.jp/articles/anri-sameshima
--   - https://prtimes.jp/main/html/rd/p/000000160.000036405.html
--   - https://untrod.inc/en/news/

DO $$
DECLARE
  v_anri_id UUID;
  v_anri_contact_id UUID;
  v_untrod_id UUID;
BEGIN
  -- ============= ANRI =============
  SELECT id INTO v_anri_id FROM vcs WHERE name = 'ANRI';
  IF v_anri_id IS NOT NULL THEN
    -- HARDCORE 1号 (2017 設立、60億)
    INSERT INTO vc_funds (vc_id, fund_no, name, size_jpy, vintage_year, status, source_url, notes)
    VALUES (v_anri_id, 100, 'ANRI HARDCORE 1号ファンド',
            6000000000, 2017, 'investing',
            'https://thebridge.jp/2017/08/anri-6-b-yen-fund',
            'ハードテック特化、Nest Hongo 系。鮫島昌弘 GP 中心、量子・核融合・宇宙等。fund_no=100 はサブファンド扱い (本体 1〜5 号と区別)。')
    ON CONFLICT (vc_id, fund_no) DO UPDATE SET
      name = EXCLUDED.name,
      size_jpy = EXCLUDED.size_jpy,
      vintage_year = EXCLUDED.vintage_year,
      notes = EXCLUDED.notes,
      updated_at = NOW();

    -- 鮫島昌弘 GP
    INSERT INTO vc_contacts (vc_id, name, name_en, role, notes)
    SELECT v_anri_id, '鮫島 昌弘', 'Masahiro Sameshima', 'General Partner',
           '東大天文学修士 → 三菱商事 → UTEC → ANRI。ハードテック / 核融合 / 量子コンピュータのカンパニークリエーション中心。'
    WHERE NOT EXISTS (
      SELECT 1 FROM vc_contacts WHERE vc_id = v_anri_id AND name = '鮫島 昌弘'
    );
    SELECT id INTO v_anri_contact_id FROM vc_contacts WHERE vc_id = v_anri_id AND name = '鮫島 昌弘';

    -- CryoX (p20) × ANRI relation (pitching、まさ情報: 鮫島さんが contact してきている)
    INSERT INTO project_vc_relations (project_id, vc_id, vc_contact_id, status, last_touch_at, notes)
    VALUES ('p20', v_anri_id, v_anri_contact_id, 'pitching', '2026-05-08',
            'まさ情報 (2026-05-08): ANRI 鮫島さんから CryoX (磁気冷凍 / 量子コンピュータ冷却技術) にコンタクト。鮫島は核融合・量子のカンパニークリエーション専門。')
    ON CONFLICT (project_id, vc_id) DO UPDATE SET
      vc_contact_id = COALESCE(EXCLUDED.vc_contact_id, project_vc_relations.vc_contact_id),
      status = EXCLUDED.status,
      last_touch_at = EXCLUDED.last_touch_at,
      notes = EXCLUDED.notes,
      updated_at = NOW();

    -- ANRI の thesis / notes / amd_rating を強化 (ハードテック中核と分かったので)
    UPDATE vcs SET
      thesis = '国内シード VC 大手。本体 1〜5 号 + ANRI GREEN + ANRI HARDCORE。AUM 累計 780 億超。鮫島 GP 中心にハードテック (核融合 / 量子 / 宇宙) のカンパニークリエーションも。',
      amd_rating = 4,
      amd_rating_note = '本体は SaaS / web3 含むがハードテック (鮫島 GP) は AMD 案件と相性良い。CryoX に既にコンタクト中、量子・核融合領域のリード可。',
      amd_rating_updated_at = NOW(),
      notes = COALESCE(notes, '') || E'\n2026-05-08 更新: HARDCORE 1号 (60億 / 2017) 鮫島 GP 中心、CryoX 等量子冷却にもコンタクト。',
      updated_at = NOW()
    WHERE id = v_anri_id;
  END IF;

  -- ============= UntroD =============
  SELECT id INTO v_untrod_id FROM vcs WHERE name = 'UntroD Capital Japan（旧リアルテックホールディングス）';
  IF v_untrod_id IS NOT NULL THEN
    -- Real Tech Fund 4 (2025-04 ファイナルクローズ、125 億)
    INSERT INTO vc_funds (vc_id, fund_no, name, size_jpy, vintage_year, status, final_close_at, source_url, notes)
    VALUES (v_untrod_id, 4, 'Real Tech Fund 4',
            12500000000, 2025, 'investing', '2025-04-30',
            'https://untrod.inc/en/news/',
            '2025-04 ファイナルクローズ。約 125 億円。シード〜アーリーディープテック投資。')
    ON CONFLICT (vc_id, fund_no) DO UPDATE SET
      name = EXCLUDED.name,
      size_jpy = EXCLUDED.size_jpy,
      vintage_year = EXCLUDED.vintage_year,
      status = EXCLUDED.status,
      final_close_at = EXCLUDED.final_close_at,
      source_url = EXCLUDED.source_url,
      notes = EXCLUDED.notes,
      updated_at = NOW();

    -- Real Tech Debt Fund (2025-11 発表、運営: UntroD Bridge Capital + 三菱UFJ信託銀行)
    INSERT INTO vc_funds (vc_id, fund_no, name, vintage_year, status, source_url, notes)
    VALUES (v_untrod_id, 200, 'UntroD Real Tech Debt Fund',
            2025, 'raising',
            'https://prtimes.jp/main/html/rd/p/000000160.000036405.html',
            'デットファンド (融資型)。三菱UFJ信託銀行と提携。子会社 UntroD Bridge Capital (代表 東苑直樹、資本金 5,200万円、2025-07-08 設立) が運営。研究開発資金ニーズあるディープテック向け融資。fund_no=200 はデットファンド扱い (エクイティ Real Tech Fund 1〜4 と区別)。')
    ON CONFLICT (vc_id, fund_no) DO UPDATE SET
      name = EXCLUDED.name,
      vintage_year = EXCLUDED.vintage_year,
      status = EXCLUDED.status,
      source_url = EXCLUDED.source_url,
      notes = EXCLUDED.notes,
      updated_at = NOW();

    -- UntroD の notes 更新
    UPDATE vcs SET
      notes = COALESCE(notes, '') || E'\n2026-05-08 更新: Real Tech Fund 4 (125億 / 2025-04 final close) + Real Tech Debt Fund (三菱UFJ信託銀行提携、子会社 UntroD Bridge Capital 運営、2025-11 発表) を追加。',
      updated_at = NOW()
    WHERE id = v_untrod_id;
  END IF;
END $$;
