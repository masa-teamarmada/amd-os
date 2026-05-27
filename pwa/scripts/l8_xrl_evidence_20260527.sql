-- L8 XRL Evidence INSERT — claude_routine_l8 / 2026-05-27 06:28 JST
-- 生成: Phase 0-E 実行 (active 5 PJ × 当月202605/前月202504、L2+MTGサマリ+PJナレッジ起点)
-- 適用方法: python -X utf8 scripts/apply_ddl.py scripts/l8_xrl_evidence_20260527.sql
--
-- 抽出サマリ: 5 PJ チェック、新規 9 evidences
--   p07 (LST): TRL=1, BRL=2, GRL=1  ← TYKベンチ実証機・Adlib投資・NEDO延長・JOH顧客
--   p06 (CTB): TRL=1, HRL=1          ← 原薬異物混入遅延・チーム強化
--   p20 (CX):  TRL=1                  ← NIMS神谷REBCO実証活動開始
--   p21 (SX):  TRL=1                  ← シアノ実装周辺技術マップv0.1
--   p19 (ZMP): TRL=1                  ← OkuDoor LINEログイン連携動作確認
-- 既存 evidence (重複回避済): 27 rows (202605)

INSERT INTO project_xrl_evidence
  (project_id, ym, axis, evidence_kind, summary,
   structured_value_json, source_refs_json, source_hash, confidence, status, created_by)
VALUES
  ('p07', '202605', 'brl', 'commercial_validation',
   'アドリブテックベンチャーズが投資委員会を通過し2,000万円出資が決定。LiSTieへの外部投資が実行フェーズに入ったBRL根拠。',
   '{"event": "Adlib Tech Ventures投資委員会通過", "amount_jpy": 20000000, "round": "pre-seed", "date": "2026-05-27"}'::jsonb,
   '[{"source": "project_knowledge", "ref_id": "p07-k-adlib-20260527", "snippet": "アドリブテックベンチャーズが投資委員会を通過し2,000万円出資が決定したと記録。2026-05-27経営会議確認。", "source_url": "https://www.notion.so/36d97749c6088002a6c1c6f4901267fd", "hash": "2bf5993dc7d5d243340db1c3e819ca38998ee79761b0c4184c5285e941574137"}]'::jsonb,
   '2905afe8243eb086cd5bf174ae3bb4d4652d33bc19f845c7567a90af2d435a22',
   0.92, 'candidate', 'claude_routine_l8'),

  ('p07', '202605', 'grl', 'grant_signal',
   'NEDO補助金期限を2026-10末→2027-03末に延長検討中。シリーズAクローズに合わせた計画変更届提出で承認可能性高い。',
   '{"grant": "NEDO補助金", "action": "期限延長検討", "from_deadline": "2026-10末", "to_deadline": "2027-03末", "reason": "シリーズAファイナンス合わせ"}'::jsonb,
   '[{"source": "project_knowledge", "ref_id": "p07-k-nedo-ext", "snippet": "NEDO補助金の期限をシリーズAファイナンスに合わせ3月末まで延長検討。計画変更届提出予定で承認可能性が高い。", "source_url": "https://www.notion.so/36d97749c6088002a6c1c6f4901267fd", "hash": "edbf25b2a1bf35adf23cfec0ba499083b841808fb33a08849814d7b4233156b3"}]'::jsonb,
   'fc2b17fa481eaa91e5000c31c0ee1ccf056899f2f4c87f7ae2e75303394cda48',
   0.85, 'candidate', 'claude_routine_l8'),

  ('p07', '202605', 'trl', 'technical_validation',
   'TYKとのベンチ実証機据付が開始。日亜化学向け水酸化Li販売+3社NDA推進で実証→商業化パスが具体化した。',
   '{"event": "TYKベンチ実証機据付開始", "partner": "TYK", "customer": "日亜化学", "product": "水酸化Li", "action": "TYK-日亜3社NDA推進", "date": "2026-05-20"}'::jsonb,
   '[{"source": "project_meeting_summaries", "ref_id": "p07-mtg-20260520", "snippet": "TYKベンチ実証機据付開始、日亜化学向け水酸化Li販売とTYK-日亜3社間NDA推進。2026-05-20会議。", "hash": "b3ac4ec2d2889e5d5adb1e208494b9c3704f412a50e717440f7c877692915bef"}]'::jsonb,
   'd2e2aae91b3f2ac20a86dfe258ef6627798911b0ebfbf1c111b1144deb02baed',
   0.88, 'candidate', 'claude_routine_l8'),

  ('p07', '202605', 'brl', 'customer_signal',
   'JOH社がNMC系ブラックマス月30トン規模でLiSMIC技術のレンタルモデル利用を検討中。LiSTieの顧客候補として高優先度。',
   '{"customer": "JOH社", "material": "NMCブラックマス", "scale_monthly_tons": 30, "model": "レンタルモデル検討中", "priority": "高優先"}'::jsonb,
   '[{"source": "project_knowledge", "ref_id": "p07-k-joh", "snippet": "JOH社がNMCブラックマスを保有し、レンタルモデル検討中。月30トン規模で高優先度。", "source_url": "https://www.notion.so/36d97749c6088002a6c1c6f4901267fd", "hash": "2c6ed850c77104bbaa3854069766d30763f2850eee2c74f02f2faab35359a681"}]'::jsonb,
   'df056772bc1c7159b9adc3500167783498b13c33e202bf93c704b0c877aaba74',
   0.82, 'candidate', 'claude_routine_l8'),

  ('p06', '202605', 'trl', 'technical_validation',
   '原薬異物混入でGMP試験が約1ヶ月遅延。AMED助成金Q1定期報告体制は並行構築中。製造工程品質管理TRL根拠。',
   '{"event": "原薬異物混入判明→GMP試験遅延", "delay_months": 1, "impact": "次工程・CF影響大", "concurrent_action": "AMED事務体制構築", "grant": "Go-Tech/NEDO DTSU検討"}'::jsonb,
   '[{"source": "project_meeting_summaries", "ref_id": "p06-mtg-20260507", "snippet": "GW直前に納品済原薬への異物混入が判明、次工程およびキャッシュフローへ大きな影響。約1か月遅延。Go-TechやNEDO DTSUの大型補助金獲得を並行進行。", "hash": "6dd79df7df0bb8994b854a9b8391071e7fa2a1be73798a353e80a56f0c80923d"}]'::jsonb,
   'be7a210f77884af47dbfb45ee2238056d7ab36ecf1d9957aa28cf4d2583c0a83',
   0.80, 'candidate', 'claude_routine_l8'),

  ('p06', '202504', 'hrl', 'team_signal',
   '2025-04に遠藤千穂・小田切理沙がCTBに参加し、AMD深山主導でバックオフィス内製化支援チームが形成された。HRLチーム強化根拠。',
   '{"new_members": ["遠藤千穂", "小田切理沙"], "lead": "深山", "date": "2025-04", "action": "バックオフィス内製化支援"}'::jsonb,
   '[{"source": "monthly_reports", "ref_id": "p06-202504", "snippet": "新メンバーとして遠藤千穂、小田切理沙が参加し、深山の統括のもとでチーム体制を構築。バックオフィス機能の内製化支援に着手。", "hash": "0e9fa99f2768ef2ead9bb4c57f2bb1e20db6f6c6c8add458f48d84760e639d35"}]'::jsonb,
   '6362be63b5e47b876f70fa38fb954035ff4368f64dafb446b765070980c0fb0a',
   0.85, 'candidate', 'claude_routine_l8'),

  ('p20', '202605', 'trl', 'technical_validation',
   'NIMS神谷氏との新規契約締結・ビーム実験棟でのREBCO/磁気冷凍実証活動開始。低ACロス細線技術の実証フェーズが具体化。',
   '{"researcher": "神谷氏", "affiliation": "NIMS", "tech": ["低ACロスREBCO細線", "磁気冷凍技術"], "activity": "桜地区ビーム実験棟での実証実験", "contract": "税込100万円未満新規契約締結", "date": "2026-05-19", "next": "あきが週1-2回現場伴走開始"}'::jsonb,
   '[{"source": "project_meeting_summaries", "ref_id": "p20-mtg-20260519", "snippet": "資金調達方針を政府系助成金・コンソーシアム優先に決定。NIMS新規契約(税込100万円未満)締結。あきが6月から週1-2回NIMS現場訪問開始。", "hash": "66c0a2decc42fe80cb833a800b0f5360e41e9dd925b17cdd677e8aed397ed45b"}, {"source": "monthly_reports", "ref_id": "p20-202605", "snippet": "低ACロスREBCO細線・磁気冷凍技術を起点とした事業化へ、戦略資料cryox_national_strategy_v22.pdfが更新。政府成長戦略との連携を意識。", "hash": "449d8dc7525e65f138e1ee53661d529647c400689c8539dde55dc6e309df7f27"}]'::jsonb,
   '019be9e5631f96326834abc185ef973aa5448065584a6f8898254237541e60ac',
   0.87, 'candidate', 'claude_routine_l8'),

  ('p21', '202605', 'trl', 'technical_validation',
   'シアノ産業実装に必要な12技術レイヤ(L1-L12)×5ユースケース(U1-U5)のMECEマップv0.1を策定。技術アーキテクチャが明確化。',
   '{"event": "シアノ実装周辺技術マップv0.1策定", "architecture": "シアノ=コア技術、周辺=実装スタック", "layers": "L1-L12 (12技術レイヤ)", "usecases": "U1-U5 (5ユースケース)", "method": "MECE", "date": "2026-05-23"}'::jsonb,
   '[{"source": "project_meeting_summaries", "ref_id": "p21-mtg-20260523", "snippet": "シアノ=コア/周辺=実装スタックの整理が確定。12技術レイヤ(L1-L12)と5ユースケース(U1-U5)をMECE配置。ダイキアクシス(DAVP)はL4/L5/L7 U1-U3限定と暫定整理。", "hash": "fc1bba265d9a70faf2ffc3aa09b2475bf3f0cef111275ddc56406d3640788103"}]'::jsonb,
   '7addabe60e7fad270c7ee5891b80c73359ae6522ff8eaa7c483c60f016422276',
   0.83, 'candidate', 'claude_routine_l8'),

  ('p19', '202605', 'trl', 'technical_validation',
   'OkuDoorシステムでLINEログイン/LIFF/Supabase連携の動作確認完了。葛飾ロードの事業システム技術基盤が実装フェーズに入ったTRL根拠。',
   '{"event": "OkuDoorシステム開発進捗", "tech_stack": ["LINE公式アカウント", "LINEログイン", "LIFF", "Supabase", "リッチメニュー"], "milestone": "LINEログイン連携動作確認", "date": "2026-05-22"}'::jsonb,
   '[{"source": "project_meeting_summaries", "ref_id": "p19-mtg-20260522", "snippet": "OkuDoorシステム開発、LINE公式アカウント、LINEログイン、LIFF、Supabase連携、リッチメニュー/デモ導線の設定を具体化。LINEログイン連携は動作表示まで確認した。", "hash": "4bb7cd33831ac76d0f191617c8567196c497f5dca2fb5055aeafcb913b7397ee"}]'::jsonb,
   '194771b5f830ae3b4562bc7c1f4e4c64a82580e8e04c58405d521d7e446ce050',
   0.78, 'candidate', 'claude_routine_l8')

ON CONFLICT (project_id, axis, source_hash)
DO UPDATE SET
  summary = EXCLUDED.summary,
  structured_value_json = EXCLUDED.structured_value_json,
  confidence = EXCLUDED.confidence,
  updated_at = now()
WHERE project_xrl_evidence.status = 'candidate';

-- l2_notifications upsert (6 PJ/ym combinations)
INSERT INTO l2_notifications (target_id, l2_kind, scope_key, title, summary, saved_count, total_count, importance)
VALUES
  ('p07', 'xrl_evidence', '202605', '🧪 LST (202605) XRL 根拠候補 (4件)', 'TRL:1/BRL:2/GRL:1', 4, 4, 2),
  ('p06', 'xrl_evidence', '202605', '🧪 CTB (202605) XRL 根拠候補 (1件)', 'TRL:1', 1, 1, 2),
  ('p06', 'xrl_evidence', '202504', '🧪 CTB (202504) XRL 根拠候補 (1件)', 'HRL:1', 1, 1, 2),
  ('p20', 'xrl_evidence', '202605', '🧪 CX (202605) XRL 根拠候補 (1件)', 'TRL:1', 1, 1, 2),
  ('p21', 'xrl_evidence', '202605', '🧪 SX (202605) XRL 根拠候補 (1件)', 'TRL:1', 1, 1, 2),
  ('p19', 'xrl_evidence', '202605', '🧪 ZMP (202605) XRL 根拠候補 (1件)', 'TRL:1', 1, 1, 2)
ON CONFLICT (l2_kind, target_id, scope_key)
DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  saved_count = EXCLUDED.saved_count,
  total_count = EXCLUDED.total_count,
  updated_at = now();
