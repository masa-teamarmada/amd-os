-- 103_p26_fix_mu_notes_and_xrl.sql
--
-- 2026-05-27 修正 (まさ #σ定義 指摘):
--   migration 101 で p26 GreenPulse の mu_notes.a に「下川先生個人の業績
--   (NTT 27年 / 特許6件 / KAKEN 15H03545 ¥1,703万 等)」を書いていたが、
--   これは μ_A (= Triple Helix の学術界『全体』動向) ではなく、PJ レベルの
--   X 軸 (TRL: 技術成熟度、HRL: 人的資源) に属する情報。
--
-- 修正方針:
--   - mu_notes.a → 「植物センシング分野の学術界全体の動向」に書き直し
--   - xrl_notes.trl → 下川先生の MEMS 業績 + KAKEN を統合
--   - xrl_notes.hrl → 下川先生のキャリア (NTT 27年) を統合

UPDATE amd_score_inputs
SET
  mu_notes = jsonb_build_object(
    'a', '植物センシング (precision agriculture / phytosensing) 分野は精密農業の中核技術として、論文・KAKEN・IEEE Sensors / Transducers 等の国際会議で継続的に活発。海外は Cornell (FloraPulse 起源) / UC Davis / Wageningen、国内は東大・農研機構などが研究を進める。ただし「MEMS + 維管束センサ」という特定領域では論文数限定的、世界的ニッチ',
    'i', 'FloraPulse / Dynamax / ICT International が活動中、ただし VC 投資控えめ (FloraPulse 調達 $1.7M total、ほぼ全額グラント)。樹液流センサー市場 CAGR 8%、精密農業 IoT CAGR 12.2%',
    'g', '2026年度「農業構造転換集中対策」494億円 (前年 2 倍超)、スマート農業技術活用促進 182億円、みどりの食料システム戦略 (化学肥料 30% 減・農薬 50% 減) = 政策追い風強い'
  ),
  xrl_notes = jsonb_build_object(
    'trl', '下川先生の MEMS 型維管束センサ: ラボでトマト計測成功 (昼夜差実測)、特許 6 件、IEEE Sensors 2016 / Transducers 2017 ファイナリスト、KAKEN 15H03545 基盤研究B ¥1,703万 (2015-2018)。耐久性検証・量産設計・圃場長期試験は未着手 = TRL 4 (ラボ環境での小規模試作)',
    'brl', '既存 md に市場分析・3 モデル仮説 (Model A SaaS / B OEM / C Marketplace)・Phase 1-3 戦略あり。顧客検証ゼロ、売上ゼロ = BRL 1.5 (仮説段階)',
    'grl', '農業規制・自動制御規制・認証未着手 = GRL 1 (規制リスク特定段階)',
    'srl', '学会発表のみ、一般認知なし = SRL 1.5',
    'hrl', '下川先生 (PI、NTT 研究所 27年経験ありビジネス対応力高い = 大学一筋型と違う) + 高尾英邦・寺尾京平 (共同研究者) + AMD まさ伴走候補。CEO 未定 = HRL 2.5 (創業期 1-3 名段階)'
  ),
  updated_at = NOW()
WHERE project_id = 'p26'
  AND evaluator = 'amie_session_2026-05-27';
