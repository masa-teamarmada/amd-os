-- Content corrected 2026-10-07; original transaction guards retained.
BEGIN;
DO $guard$ BEGIN
IF NOT EXISTS (SELECT 1 FROM project_company_profiles WHERE id='a6fcab7b-b6cc-40eb-94ed-dbd96b4ca6fb' AND project_id='p21' AND legal_status='pre_incorporation' AND updated_at='2026-10-05 13:34:29.900504+00') THEN RAISE EXCEPTION 'Company profile changed; re-read before applying'; END IF;
IF EXISTS (SELECT 1 FROM project_config WHERE project_id='p21' AND key IN ('company_incorporation_plan','founding_background')) THEN RAISE EXCEPTION 'Company content already exists; re-read before applying'; END IF;
END $guard$;
UPDATE project_company_profiles SET legal_name='SolvioraX（仮）',
legal_name_en='SolvioraX Inc.（仮）',
entity_type='株式会社（予定）',
incorporated_on='2027-04-01',
head_office='愛媛県松山市 愛媛大学 E.U. Innovation Commons（EUIC）（予定）',
business_purpose='1. シアノバクテリア等の微生物に関する研究開発、培養、製造および販売
2. 排水処理・水質改善装置の開発、製造、販売、設置および保守
3. 排水処理、資源回収および回収資源の加工・販売
4. バイオ燃料およびその原料の研究開発、製造および販売
5. 前各号に関する共同研究、技術供与およびコンサルティング
6. 前各号に附帯または関連する一切の事業（案）',
representative_name='代表取締役／CEO 山地正洋（予定）',
board_structure='株式譲渡制限会社（予定）',
public_notice_method='官報（案）',
source_ref='2026-10-06 まさの会社概要整備方針／SOL現行組織図・資本政策',
source_verified_on='2026-10-06',
notes='設立前の会社情報。数値の設立案は会社設立計画に登録。',
updated_by_email='amie-sol-company-20261006',
has_board=false, has_auditor=false, fiscal_year_end_month=3, updated_at=now() WHERE id='a6fcab7b-b6cc-40eb-94ed-dbd96b4ca6fb' AND project_id='p21';
INSERT INTO project_config(project_id,key,value) VALUES ('p21','company_incorporation_plan','{"version": 1, "capitalYen": 1080000, "issuedShares": 108000, "dilutedShares": 120000, "firstFiscalPeriod": "2027年4月1日〜2028年3月31日", "sourceRef": "2026-10-07 まさの研究開発体制・氏名・経営会議の訂正／SOL現行組織図・資本政策", "organizationRows": [{"label": "代表取締役／CEO", "value": "山地正洋（予定）"}, {"label": "技術統括／CTO", "value": "杉浦美羽（予定）"}, {"label": "技術顧問", "value": "中島純一（予定）"}, {"label": "事業開発・PM支援", "value": "石原裕香（予定）"}, {"label": "組織", "value": "経営企画部・技術開発部（案）。研究開発は杉浦研究室に委託"}, {"label": "研究・開発拠点", "value": "設立当初は自社拠点を持たない"}, {"label": "研究開発の委託先", "value": "愛媛大学 杉浦研究室（研究開発をすべて委託）"}, {"label": "装置の共同開発", "value": "ダイキアクシス：排水処理リアクター／ツウテック：培養装置（案）"}, {"label": "事業化支援", "value": "株式会社チームアルマダ：経営企画、資金調達、顧客開拓、管理業務（予定）"}], "capitalRows": [{"label": "設立時の発行株式", "value": "普通株式108,000株・1株10円・払込総額108万円（案）"}, {"label": "発行可能株式総数", "value": "1,200,000株（案）"}, {"label": "設立時の持分", "value": "CEO 75％／杉浦先生 20％／経営陣 5％（案）"}, {"label": "ストックオプション枠", "value": "12,000株・設立株式と合わせて120,000株、SO枠比率10％（案）"}, {"label": "シード調達", "value": "J-KISS 2.0で総額1億円（案）"}, {"label": "シードの転換条件", "value": "ポストマネー評価上限5億円・割引率20％（案）"}], "operationRows": [{"label": "事業年度", "value": "毎年4月1日〜翌年3月31日（案）"}, {"label": "株主総会", "value": "定時株主総会：年1回／重要事項は臨時株主総会・書面決議（予定）"}, {"label": "取締役会", "value": "非設置"}, {"label": "経営会議", "value": "週1回・重要事項は随時協議"}, {"label": "会計・管理", "value": "会計・税務を外部専門家と連携し、経営企画部で予算・契約・資金繰りを管理（案）"}, {"label": "大学との連携", "value": "杉浦研究室への研究開発委託・特許およびノウハウの利用契約（予定）"}, {"label": "設立スケジュール", "value": "2026年10〜12月：商号・創業体制・契約条件の整理／2027年1〜3月：出資・契約・設立手続／2027年4月1日：設立（案）"}]}');
INSERT INTO project_config(project_id,key,value) VALUES ('p21','founding_background','{"version": 1, "title": "創業の背景と社会課題", "summary": "愛媛大学の好熱性シアノバクテリア研究を、工場の排水処理と金属の資源循環へつなぐ。菌体・装置・供給・保守を担う会社として、愛媛から事業化を進める。", "bodyMd": "## 1. 愛媛大学の研究から、工場で使い続けられる製品へ\n\nSolvioraXは、愛媛大学の杉浦研究室で進められてきた好熱性シアノバクテリアの研究を起点とする、大学発スタートアップの創業計画である。\n菌体による金属の取り込みや色素の分解を、産業排水の処理と資源回収へ応用する。\n\n事業化では、顧客の排水に合う菌体を安定して供給し、装置の導入、運転条件の設定、交換、回収、保守まで継続して担う必要がある。\nSolvioraXは、この供給と運用を担う会社として、研究開発、装置開発、顧客との実証、販売をつなぐ。\n大学の研究チームと株式会社チームアルマダの事業化支援を組み合わせ、2027年4月1日の設立を予定している。\n\n## 2. 解決する社会課題\n\n| 社会課題 | 工場や地域で生じる問題 | SolvioraXが取り組むこと |\n|---|---|---|\n| 排水処理の負担 | 工場は排水の水質を管理しながら、処理費、運転の手間、設備負担を抑える必要がある | 既存の排水設備に菌体と処理装置を組み込み、対象排水に合う処理方法を開発する |\n| 排液中の金属の資源化 | 金属は工程液や排水へ移り、濃度や共存成分によって回収の採算が変わる | 菌体への取り込みから回収・精製までをつなぎ、回収量と費用が見合う用途を開拓する |\n| 金属資源の安定供給 | 製造業で使う重要鉱物には供給の偏りや供給途絶のリスクがある | 国内の工場から生じる液中の金属を、利用可能な資源へ戻す工程を開発する |\n| 地域の研究成果の事業化 | 研究成果を現場へ届けるには、供給、販売、保守を継続して担う体制が必要になる | 愛媛を拠点に大学、装置開発企業、顧客をつなぎ、事業と研究の循環をつくる |\n\n排水の水質管理には、金属などの健康項目と、pH、BOD、CODなどの生活環境項目がある。対象排水ごとに、顧客に適用される条件を確認して製品を設計する。[環境省・一般排水基準](https://www.env.go.jp/water/impure/haisui.html)\n金属資源の循環利用は、供給源の多角化とともに安定供給を支える取り組みとして位置づけられている。[経済産業省・重要鉱物](https://www.meti.go.jp/policy/economy/economic_security/metal/index.html)\n\n## 3. 水処理と資源回収を、ひとつの事業につなぐ\n\n最初の製品は、工場の排水ラインへ追加する処理装置と、菌体の継続供給、交換、回収、保守を組み合わせる構想である。\n着色排水では色素分解を、金属を含む排液では菌体への取り込みと金属回収を進める。\n顧客の工程や排水性状に合わせ、既存設備への接続位置、必要な前後処理、装置の運転条件を決める。\n\n排水処理向けに培養・保有する菌体を基盤として、在庫シアノによる燃料原料の生産も開発する。\n脂質分泌株による原料生産と回収を組み合わせる計画で、燃料利用は開発段階にある。\n\n## 4. 愛媛を拠点に事業化する理由\n\n本店は、愛媛大学のE.U. Innovation Commons（EUIC）を予定している。\n設立当初は自社の研究開発拠点を持たず、研究開発はすべて愛媛大学の杉浦研究室に委託する。\n杉浦研究室による実排液の試験を、装置開発企業や工場との実証につなぎ、菌体・装置・運用条件を一緒に仕上げる。\n愛媛での実証を起点に、同じ排水課題を持つ国内外の工場へ展開する方針である。\n\n山地正洋が経営を、杉浦美羽が技術開発を統括する予定である。\n装置の共同開発はダイキアクシスとツウテック、事業化支援はチームアルマダと連携する体制案を置いている。\n研究、装置、営業、運用の担当をつなぎ、導入後も使い続けられる製品をつくる。\n\n## 5. 社会への効果を何で測るか\n\n| 目指す効果 | 実証で測る指標 |\n|---|---|\n| 排水処理の負担軽減 | 対象物質の出口濃度、色度、処理流量、総処理費、薬剤量、汚泥・回収物の量、運転工数 |\n| 金属資源の循環 | 金属の取り込み量、回収率、純度、回収・精製費、回収金属の利用条件 |\n| 継続して使える製品 | 菌体のロット品質、連続運転時間、交換頻度、装置の稼働率、供給と保守の費用 |\n| 燃料原料の生産 | 在庫量と保有期間あたりの原料量、回収・精製費、排水処理向け菌体の品質維持 |\n\n初期の顧客の実排液を使い、水質、運転、供給、費用を同じ条件で評価する。\nこの結果から導入条件を定め、装置と菌体の継続供給につなげる。\n\n[製品説明資料](?tab=product-description)には製品の構成を、[技術説明資料](?tab=technology)には試験条件と研究結果を、[コスト試算](?tab=cost-model)には費用の前提を示している。\n", "sourceRefs": ["SOL技術台帳・製品説明資料・現行組織図", "2026年10月の愛媛企業訪問記録", "環境省「一般排水基準」", "経済産業省「重要鉱物」", "2026-10-07 まさ確認：研究開発はすべて杉浦研究室へ委託"]}');
COMMIT;
