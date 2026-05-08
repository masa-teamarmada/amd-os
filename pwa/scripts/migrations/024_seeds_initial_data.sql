-- 024_seeds_initial_data.sql
--
-- Phase 1 の初期投入。Web 検索 (2026-05-08) で確認できた範囲の研究シーズを 10 件登録する。
-- 内容は web_search 由来 (一次情報) なので、AMD メンバーが内容確認・接触前段階。
-- status は基本 'candidate' (候補)、まだ AMD は未接触。
-- trl/brl/hrl と amd_rating は意図的に未設定 (担当が確認後に埋める)。
--
-- 既に事業化済のシーズ (エネコート、FiberCraze など) は対象外として除外。

INSERT INTO seeds (
  title,
  summary,
  org_name,
  org_type,
  org_region,
  org_url,
  researcher_name,
  researcher_title,
  lab_name,
  domain_lane,
  industry_target,
  keywords,
  status,
  source,
  source_detail
) VALUES
  -- 1. まさ確定 (シーズリスト初期化のシード)
  (
    '下川研究室シーズ',
    '香川大学 下川先生の技術シーズ。事業化に向けた具体協議を想定。詳細は接触後に追記。',
    '香川大学',
    'university',
    '香川県',
    'https://www.kagawa-u.ac.jp/',
    '下川',
    NULL,
    NULL,
    'gx_circular',
    NULL,
    ARRAY['シーズ', '香川大学'],
    'candidate',
    'introduction',
    'まさからの確定 (Phase 1 初期投入)'
  ),

  -- 2. 大阪大学 武部貴則 / 肝臓オルガノイド
  (
    '機能的多層構造をもつ肝臓オルガノイド',
    'iPS細胞から、生体肝臓に存在するZonation (機能的な多層構造) を備えた肝臓オルガノイドの世界初の創出。重度肝不全モデル動物への移植で生存率改善。Nature 2025/4 掲載。',
    '大阪大学',
    'university',
    '大阪府吹田市',
    'https://resou.osaka-u.ac.jp/',
    '武部 貴則',
    '教授',
    NULL,
    'life',
    ARRAY['再生医療', '創薬', '医療機器'],
    ARRAY['オルガノイド', 'iPS細胞', '肝臓', 'Zonation', 'Nature'],
    'candidate',
    'web_search',
    'Web 検索 2026-05-08 / 大阪大学 ResOU 2025-04-17 プレス'
  ),

  -- 3. 東北大学 多元物質科学研究所 / 全固体電池界面形成技術
  (
    'リチウム金属-ガーネット型固体電解質の室温界面形成',
    '超音波接合で室温・数秒以内に Li 金属と LLZO (ガーネット型酸化物固体電解質) の緊密な界面を形成し、界面抵抗を約 1.5 Ω·cm² まで低減。全固体電池の実用化を後押し。2026/3 発表。',
    '東北大学',
    'university',
    '宮城県仙台市',
    'https://www.tohoku.ac.jp/',
    NULL,
    NULL,
    '材料科学高等研究所 (WPI-AIMR) / 多元物質科学研究所',
    'materials',
    ARRAY['EV', '蓄電池', 'モビリティ'],
    ARRAY['全固体電池', 'リチウム金属', 'LLZO', 'ガーネット型固体電解質'],
    'candidate',
    'web_search',
    'Web 検索 2026-05-08 / 東北大学プレス 2026-03-24'
  ),

  -- 4. 産総研 触媒化学融合研究センター / 大気濃度 CO2 → 合成ガス
  (
    '遷移金属不使用触媒による大気濃度CO2の合成ガス化',
    '大気中の400ppmという低濃度CO2から、液体燃料や化学品の原料となる合成ガスを直接製造する技術。遷移金属不使用の触媒を用いる。',
    '産業技術総合研究所',
    'national_lab',
    '茨城県つくば市',
    'https://www.aist.go.jp/',
    NULL,
    NULL,
    '触媒化学融合研究センター 固体触媒チーム',
    'gx_circular',
    ARRAY['化成品', '合成燃料', 'CCU'],
    ARRAY['カーボンリサイクル', 'CO2還元', '合成ガス', '触媒'],
    'candidate',
    'web_search',
    'Web 検索 2026-05-08 / 産総研プレス 2022-05-13'
  ),

  -- 5. 早稲田大学 / 低温 CO2 → CO 触媒
  (
    '500℃以下で動作するCO2→CO資源化触媒',
    '従来より低温域 (500℃以下) で CO2 を CO へ資源化する新しい触媒システム。低温動作で省エネ・低コスト化。',
    '早稲田大学',
    'university',
    '東京都新宿区',
    'https://www.waseda.jp/top/',
    NULL,
    NULL,
    NULL,
    'gx_circular',
    ARRAY['化成品', '合成燃料', 'CCU'],
    ARRAY['カーボンリサイクル', 'CO2還元', '低温触媒'],
    'candidate',
    'web_search',
    'Web 検索 2026-05-08 / JST CRDS 報告書'
  ),

  -- 6. 静岡大学 / メタンドライ改質 + 固体炭素回収
  (
    'メタンのドライ改質と固体炭素生成・捕集の組み合わせプロセス',
    'CO2 とメタンを反応させてシンガス化しつつ、副生する固体炭素 (カーボンブラック等) を捕集するプロセス。CO2 削減と高機能炭素材料製造を同時実現。',
    '静岡大学',
    'university',
    '静岡県',
    'https://www.shizuoka.ac.jp/',
    NULL,
    NULL,
    NULL,
    'gx_circular',
    ARRAY['カーボン素材', '化成品', 'CCU'],
    ARRAY['カーボンリサイクル', 'メタン改質', '固体炭素', 'CCU'],
    'candidate',
    'web_search',
    'Web 検索 2026-05-08 / JST CRDS 報告書'
  ),

  -- 7. 岐阜大学 竹野敏弘研究室 / ナノ多孔ファイバー
  (
    'ナノ多孔ファイバー (FiberCraze 技術派生)',
    '繊維やフィルム素材の多孔化技術 (クレーズ)。表面のナノスケール穴に有効成分 (防虫・保湿等) を内包。FiberCraze 株式会社として一部事業化済だが、別応用 (医療・電池セパレータ等) のシーズ展開余地。',
    '岐阜大学',
    'university',
    '岐阜県岐阜市',
    'https://www.gifu-u.ac.jp/',
    '竹野 敏弘',
    NULL,
    NULL,
    'materials',
    ARRAY['機能性繊維', 'フィルム', 'ヘルスケア'],
    ARRAY['多孔化', 'ナノファイバー', 'クレーズ', '機能性素材'],
    'investigating',
    'web_search',
    'Web 検索 2026-05-08 / 岐阜大学 大学広報 / 関連ベンチャー FiberCraze'
  ),

  -- 8. NIMS / 変位センサ・人声センサ
  (
    '貼り付け型変位センサ・人声センサ',
    '身体に貼り付ける高感度変位センサ、および人声センサ。ロボット可動部の柔軟センシングに応用展開可能。NIMS 一般公開 2025 で展示。',
    '物質・材料研究機構',
    'national_lab',
    '茨城県つくば市',
    'https://www.nims.go.jp/',
    NULL,
    NULL,
    NULL,
    'robo',
    ARRAY['ロボット', 'ヘルスケア', 'センサ'],
    ARRAY['変位センサ', '人声センサ', 'ウェアラブル', 'ロボット'],
    'candidate',
    'web_search',
    'Web 検索 2026-05-08 / NIMS 一般公開 2025'
  ),

  -- 9. 大阪大学 / 涙腺オルガノイド
  (
    'iPS細胞由来 涙腺オルガノイド',
    'iPS細胞から涙腺オルガノイドを作製する技術を確立。ドライアイなど涙腺機能異常への再生医療シーズ。',
    '大阪大学',
    'university',
    '大阪府吹田市',
    'https://resou.osaka-u.ac.jp/',
    NULL,
    NULL,
    NULL,
    'life',
    ARRAY['再生医療', '眼科'],
    ARRAY['オルガノイド', 'iPS細胞', '涙腺', 'ドライアイ'],
    'candidate',
    'web_search',
    'Web 検索 2026-05-08 / 大阪大学 ResOU 2022-04-21'
  ),

  -- 10. 京都大学 化学研究所 若宮研究室 / ペロブスカイト次世代研究
  (
    '次世代ペロブスカイト光電変換材料 (タンデム / 室内発電)',
    '京大化学研 若宮研究室はエネコートテクノロジーズの源流だが、当該研究室では引き続きタンデム化、室内光発電、フレキシブル化など次世代材料開発が進む。エネコートのスコープ外領域はシーズ候補。',
    '京都大学',
    'university',
    '京都府宇治市',
    'https://www.kuicr.kyoto-u.ac.jp/',
    '若宮 淳志',
    '教授',
    '化学研究所 若宮研究室',
    'gx_energy',
    ARRAY['再エネ', 'モビリティ', 'IoT'],
    ARRAY['ペロブスカイト太陽電池', 'タンデム', '室内発電', 'フレキシブル'],
    'investigating',
    'web_search',
    'Web 検索 2026-05-08 / 京大化学研 / エネコート関連プレス'
  )
;
