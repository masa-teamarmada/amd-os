-- 021_vc_more_from_sheet.sql
--
-- AMD VC リスト (Google Sheet) からまだ取り込めていない VC を stub として追加。
-- thesis / fund_size 等は後から cron (vc-news-ingest) や手入力で埋める前提。
-- type と amd_rating はえいみが知ってる範囲で付与。
--
-- 全部 ON CONFLICT (name) DO NOTHING (既存があれば触らない)。

INSERT INTO vcs (name, name_en, slug, type, amd_rating, amd_rating_note, amd_rating_updated_at, notes)
VALUES
  -- 独立系 / DT 関連
  ('Skyland Ventures', 'Skyland Ventures', 'skyland-ventures', 'independent', 2, 'シード特化、SaaS / web3 主軸。DT 案件で接点あったが本筋ではない。', NOW(), NULL),
  ('East Ventures', 'East Ventures', 'east-ventures', 'independent', 2, 'シード〜A、東南アジア中心。DT は限定的。', NOW(), NULL),
  ('Hakobune', 'Hakobune', 'hakobune', 'independent', 3, 'AMD 案件で接点あり、DT 触れる感あり。確認継続。', NOW(), NULL),
  ('Genesia Ventures', 'Genesia Ventures (ジェネシアベンチャーズ)', 'genesia-ventures', 'independent', 3, '日越でアーリー。DT 触る場面あり。', NOW(), NULL),
  ('Antler', 'Antler', 'antler', 'independent', 2, 'グローバル創業期投資。DT 専門ではない。', NOW(), NULL),
  ('Incubate Fund', 'Incubate Fund', 'incubate-fund', 'independent', 3, 'シード特化大手。DT も時々。', NOW(), NULL),
  ('Spiral Capital', 'Spiral Capital', 'spiral-capital', 'independent', 2, 'SaaS / B2B 主軸、DT は薄い。', NOW(), NULL),
  ('DCM Ventures', 'DCM Ventures', 'dcm-ventures', 'overseas', 2, 'グローバル、DT は時々。', NOW(), NULL),
  ('Scrum Ventures', 'Scrum Ventures', 'scrum-ventures', 'independent', 2, 'クロスボーダーアーリー、DT 触れる場面あり。', NOW(), NULL),
  ('D4V', 'Design for Ventures (D4V)', 'd4v', 'independent', 2, 'デザイン経営支援系、DT は弱い。', NOW(), NULL),
  ('千葉道場ファンド', 'Chiba Dojo Fund', 'chiba-dojo-fund', 'independent', 2, '起業家輩出系、DT 専門ではない。', NOW(), NULL),
  ('Unicorn Venture Partners', 'Unicorn Venture Partners', 'unicorn-venture-partners', 'independent', 2, 'グローバル指向。DT は限定的。', NOW(), NULL),
  ('Spurcle', 'Spurcle', 'spurcle', 'independent', 3, 'AMD 案件で接点あり、KT / LST。', NOW(), NULL),
  ('W Fund', 'W Fund', 'w-fund', 'independent', 2, '早期 / アクセラ型。DT は薄い。', NOW(), NULL),
  ('Catalys', 'Catalys', 'catalys', 'independent', 3, 'AMD 案件で CTB に接点。', NOW(), NULL),
  ('A-Start', 'A-Start', 'a-start', 'independent', 2, 'AMD 案件 KT / r3kt で接点。', NOW(), NULL),

  -- アクセラ / シードファンド (DT 隣接)
  ('THVP', 'TOMY Innovation Fund (THVP)', 'thvp', 'cvc', 2, 'TOMY 系 CVC。MC / KT で接点あり。', NOW(), NULL),
  ('NOBUNAGA', 'NOBUNAGA Capital Village', 'nobunaga-capital-village', 'independent', 2, '名古屋圏アーリー。DT は薄い。', NOW(), NULL),

  -- バイオ / ライフ系
  ('Medical Incubator Japan', 'Medical Incubator Japan (MIJ)', 'medical-incubator-japan', 'independent', 3, 'CTB 系で接点、ライフサイエンス DT に強い。', NOW(), NULL),
  ('MedVenture Partners', 'MedVenture Partners', 'medventure-partners', 'independent', 3, 'CTB 系で接点、医療機器 DT 特化。', NOW(), NULL),
  ('AN Venture Partners', 'AN Venture Partners', 'an-venture-partners', 'independent', 3, 'CTB 系で接点、ヘルスケア DT。', NOW(), NULL),
  ('NEWTON BIOCAPITAL', 'NEWTON BIOCAPITAL', 'newton-biocapital', 'overseas', 2, 'グローバル創薬特化、CTB 系で打診履歴。', NOW(), NULL),

  -- 大学 / GAP 系
  ('Keio Innovation Initiative', 'Keio Innovation Initiative (KII)', 'keio-innovation-initiative', 'university_affiliated', 4, '慶應発、サイエンス系強い。アーリー DT 候補。', NOW(), NULL),
  ('ケーエスピー', 'KSP', 'ksp', 'independent', 3, '神奈川発、ハードテック系一部。', NOW(), NULL),
  ('日本ベンチャーキャピタル', 'Japan Venture Capital (NVCC)', 'nvcc', 'independent', 2, '老舗 VC、A 以降中心。', NOW(), NULL),

  -- 大手 / CVC
  ('NTTドコモベンチャーズ', 'NTT Docomo Ventures', 'ntt-docomo-ventures', 'cvc', 2, 'CVC、通信領域中心。DT は薄い。', NOW(), NULL),
  ('KDDI Open Innovation Fund', 'KDDI Open Innovation Fund (KOIF)', 'kddi-open-innovation-fund', 'cvc', 2, 'CVC、AMD 案件で「シード不可」扱いだった。', NOW(), NULL),
  ('博報堂DYベンチャーズ', 'Hakuhodo DY Ventures (HDYV)', 'hakuhodo-dy-ventures', 'cvc', 1, 'CVC、広告 / マーケ中心、DT は対象外。', NOW(), NULL),
  ('SMBCベンチャーキャピタル', 'SMBC Venture Capital (SMBCVC)', 'smbcvc', 'cvc', 2, 'CVC、フォロー枠で関わり可。CTB / KT で接点。', NOW(), NULL),
  ('DBJキャピタル', 'DBJ Capital', 'dbj-capital', 'government', 3, 'DBJ 系の VC アーム (DBJ Startup ファンドとは別)。', NOW(), NULL),
  ('東京センチュリーキャピタル', 'Tokyo Century Capital', 'tokyo-century-capital', 'cvc', 2, 'リース系 CVC、LST で接点。', NOW(), NULL),
  ('PKSHA Capital', 'PKSHA Capital', 'pksha-capital', 'independent', 3, 'PKSHA + 松尾研系、AI 中心だが資金規模あり。', NOW(), NULL),
  ('Bandai Namco 021 Fund', 'Bandai Namco Entertainment 021 Fund', 'bandai-namco-021-fund', 'cvc', 1, 'CVC、エンタメ特化。DT は対象外。', NOW(), NULL),
  ('LifeX Ventures', 'LifeX Ventures', 'lifex-ventures', 'cvc', 2, 'KT 系で接点、ライフ DT 触る。', NOW(), NULL)
ON CONFLICT (name) DO NOTHING;
