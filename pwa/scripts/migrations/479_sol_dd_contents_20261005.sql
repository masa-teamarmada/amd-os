-- 479: SOLのDD共通ページのコンテンツ整備（2026-10-05）
-- まさ: コスト試算と月次試算表は別セッション。ここではOSのDD各ページを埋める。
-- 技術・契約・役割の新しい計画は案と明示し、確定の契約・実績・権利へ置き換えない。
-- 9記事、会社の詳しい説明・設立前プロフィール、大学関連出願4件、事業計画の非財務補足。
-- DD添付2件は非公開の掲載候補。公開状態・外部付与・コスト・月次・資本政策の値は変更しない。
-- 変更履歴は既存のamd_os_data_change_historyとworkspace監査triggerに残る。
BEGIN;
SELECT set_config('request.headers', '{"x-amd-os-actor":"amie-sol-dd-content-20261005"}', true);
SELECT set_config('app.workspace_migration', '479', true);
SELECT pg_advisory_xact_lock(hashtext('sol-dd-content-20261005'));
DO $guard$ BEGIN
IF NOT EXISTS (SELECT 1 FROM public.dd_packages WHERE id='b0540a9f-7bde-426c-81a7-8a56a59f5b15' AND project_id='p21' AND slug='sol' AND status='draft') THEN RAISE EXCEPTION 'SOL DD draft state changed'; END IF;
IF EXISTS (SELECT 1 FROM public.dd_package_grants WHERE package_id='b0540a9f-7bde-426c-81a7-8a56a59f5b15') THEN RAISE EXCEPTION 'SOL external grants changed; review disclosure before continuing'; END IF;
IF EXISTS (SELECT 1 FROM public.project_company_profiles WHERE project_id='p21') OR EXISTS (SELECT 1 FROM public.project_ip_assets WHERE project_id='p21') THEN RAISE EXCEPTION 'Company/IP contents changed since snapshot'; END IF;
IF EXISTS (SELECT 1 FROM public.project_tech_topics WHERE tech_topic_id IN ('ptt_sol_dd_validation','ptt_sol_dd_supply','ptt_sol_dd_ip_use','ptt_sol_bm_adoption','ptt_sol_bm_market_scope','ptt_sol_bm_contract_path','ptt_sol_bm_team','ptt_sol_bm_dd_evidence','ptt_sol_comp_validation')) THEN RAISE EXCEPTION 'DD contents already exist'; END IF;
IF NOT EXISTS (SELECT 1 FROM public.project_business_summaries WHERE project_id='p21' AND detail IS NULL AND summary='愛媛大学発のシアノバクテリアによる排水処理（重金属の回収・着色排水の浄化）と、菌体のバイオ燃料への利用' AND updated_at='2026-10-04T07:08:01.066044+00:00'::timestamptz) THEN RAISE EXCEPTION 'Business summary changed since snapshot'; END IF;
IF NOT EXISTS (SELECT 1 FROM public.project_business_plans WHERE project_id='p21' AND updated_at='2026-10-03T08:27:18.101622+00:00'::timestamptz) THEN RAISE EXCEPTION 'Business plan changed since snapshot'; END IF;
END $guard$;
INSERT INTO public.project_tech_topics (tech_topic_id,project_id,block_kind,title,tech_domain,sort_order,summary,body_md,status,confidentiality,source_kind,source_ref,source_url,created_by,updated_by,needs_check,check_reason) VALUES ('ptt_sol_dd_validation','p21','article','実証で示すこと — 試験条件・再現性・現場運転','実証と製品化',70,'ラボの取り込み実績から、顧客の排水ラインで使える証拠へ進むための試験計画案。','### いま説明できること

重金属の取り込みと色素処理には実験実績があり、10Lリアクターでの鉄排液の処理も報告されている。
物質ごとの確認済みの結果と条件は「シアノバクテリアの性能一覧」「対象にできる物質」「装置と実験の到達実績」を参照する。
2026年9月30日付の研究者説明資料は、銅・アルミの実排液の30分の処理例を示す。
この結果を、全金属・全排液で30分以内に処理できる保証へ広げない。
10Lの試験結果だけでは、工場の連続流量への適合、カートリッジ寿命、供給品質までは確定しない。

### ラボから現場へ進む試験計画案

次の項目は、研究チーム・顧客と合意して試験票に落とすための案であり、実施済みの記録ではない。

| 段階 | 取る記録 | 次へ進む判断 |
|---|---|---|
| 排液を特定する | 匿名の試料番号、工程と採取位置、採取・受領日時、保存条件、成分表、処理フロー | サンプルと分析値が同じ排液を指し、安全な受領・保管・廃棄の条件が決まる |
| 効果を確認する | 株、菌体の乾燥重量、初期濃度、pH、温度、塩分、光、接触時間、原水と処理後水の分析 | 無処理対照との差と測定のばらつきを説明でき、顧客が必要とする水質に届く |
| 再現性を確認する | 同条件の反復、独立した菌体ロット、採取日の違う排液、分析方法と検出限界 | 偶然の1点ではなく、適用できる条件と失敗する条件を示せる |
| 連続運転を確認する | 実流量、滞留時間、差圧、破過、交換、洗浄・逆洗、停止・復旧、菌体流出 | 既存ラインに影響を与えず、予定する運転期間で水質と処理量を維持できる |
| 顧客拠点で確認する | 設置前後の水質・運転時間・薬品使用量・残渣量・作業量、安全確認、顧客の検収 | 性能、安全、運転負担について事前に合意した採用条件を満たす |

金属では、原水・処理後水・菌体・回収金属の物質収支も確認する。
取り込みと、純度を満たす金属を取り出して販売することは別の検証として扱う。
食品排水では、菌が増えたこと、見た目の色の変化、COD・窒素・リンが下がったことを別々に測る。
脂肪酸の分析値も、燃料を抽出・製造して規格を満たした実績と区別する。

### 報告書に揃える証拠

試験計画、試料受領記録、全測定値、分析証明、装置・運転記録、失敗を含む結果、顧客確認を1組にする。
処理率だけでなく、初期濃度と最終濃度、時間、菌体量を併記する。
原本未取得の口頭報告は、その旨と発言日を明示する。
反復回数、合格値、連続運転期間は試験前に研究チームと顧客が決める。
本ページはその合意を代わりに確定するものではない。

### 開示条件

研究者説明資料では、企業名・廃液情報を公開せず、成果公表には企業の事前確認を取るとしている。
匿名化しても、水質・写真・試験結果の投資家への開示可否は相手先ごとに確認する。','active','internal','manual','環境浄化事業化の説明Ver3（2026-09-30）p5–8・11／技術台帳（2026-10-03更新）／2026-06 PoC設計テンプレートを顧客名・価格前提を外して再構成。試験計画は2026-10-05の整備案','https://drive.google.com/file/d/126lYRZBbbhe_IIxf4C1Fkgouf0HhyYUG/view?usp=drivesdk','amie-sol-dd-content-20261005','amie-sol-dd-content-20261005',false,NULL);
INSERT INTO public.project_tech_topics (tech_topic_id,project_id,block_kind,title,tech_domain,sort_order,summary,body_md,status,confidentiality,source_kind,source_ref,source_url,created_by,updated_by,needs_check,check_reason) VALUES ('ptt_sol_dd_supply','p21','article','菌体と装置の供給 — 品質・輸送・保守を揃える','実証と製品化',71,'供給する製品と運用の単位を定め、研究室の手順を出荷・現場保守へ移すための計画案。','### 提供する単位

事業の構想は、培養拠点で菌体をつくり、カートリッジと処理装置を顧客の排水ラインで使ってもらう形。
培養・包装・輸送・顧客投入・回収をつないだ条件が揃って初めて、継続供給できる製品になる。
現在の実験条件を、そのまま製品の保証仕様と扱わない。

### 開発で揃える仕様案

| 工程 | 記録・仕様にする項目 | 未取得の証拠 |
|---|---|---|
| 種株・培養 | 株の識別、自然株／組換え株の区別、継代、培養条件、汚染検知、バックアップ | 種株保全と同等性を確認した運用記録 |
| 出荷判定 | 乾燥重量・活性・汚染・処理性能、検査方法、合否基準、ロット番号 | 合格基準と独立ロットの検査成績 |
| 包装・保存 | 容器、カートリッジ容量、漏洩防止、保存温度、使用期限 | 保存期間別の活性・性能試験 |
| 輸送・設置 | 温度履歴、輸送後性能、設置条件、導入手順、既存設備との接続 | 輸送後の試験と現場受入記録 |
| 運転・交換 | 流量、差圧、水質、破過、交換頻度、逆洗、作業時間 | 連続運転・交換・再起動の記録 |
| 回収・廃棄 | 菌体・残渣・処理後水の扱い、金属回収、必要な不活化、委託先 | 法令上の取扱いの確認と処理記録 |

事業計画の「3ロット連続合格・輸送後性能合格・顧客現場で再現」は到達目標で、達成実績ではない。
量産能力は培養槽の容量だけで判断せず、培養時間、回収歩留まり、出荷合格率、包装・輸送を含めて確かめる。
設備メーカーの製造能力・納期・保守範囲も、個別の仕様・見積・契約で確認する。

### 運用を誰が担うか

大学の研究チームは株と試験条件の研究を担う。
事業側には、出荷判定、設置、顧客への手順説明、障害対応、回収を担当する役割が必要になる。
担当者、作業手順、教育、代理担当、事故時の連絡先を導入前に揃える。
採用・委託先・設備の確保は、契約や稼働の確認が取れるまで計画として扱う。','active','internal','manual','事業計画の技術・組織レーン（2026-10-03）／2025年度研究開発報告書（2026-04-01）／環境浄化事業化の説明Ver3（2026-09-30）。品質・運用仕様は2026-10-05の整備案','https://drive.google.com/file/d/126lYRZBbbhe_IIxf4C1Fkgouf0HhyYUG/view?usp=drivesdk','amie-sol-dd-content-20261005','amie-sol-dd-content-20261005',false,NULL);
INSERT INTO public.project_tech_topics (tech_topic_id,project_id,block_kind,title,tech_domain,sort_order,summary,body_md,status,confidentiality,source_kind,source_ref,source_url,created_by,updated_by,needs_check,check_reason) VALUES ('ptt_sol_dd_ip_use','p21','article','知財の事業利用 — 大学特許・ノウハウ・実施許諾','知財の事業利用',72,'出願の存在と、設立予定会社が事業で使える権利を分けて説明する。','### 確認できた出願

知財ページに、研究者の説明資料にある国内出願2件、汚染水処理方法の国際出願、処理装置の国内出願を登録した。
WO2025/028350の公開公報には、2023年の国内出願2件を優先権とすることと、出願人が国立大学法人愛媛大学であることが記載されている。
国内の優先権出願2件と国際出願を、独立した3つの発明として数えない。
公開公報の存在は、登録済み・現在有効・独占実施権取得済みを意味しない。
各出願の現在の審査・権利状態、国内外の移行先、名義は大学の出願管理資料で照合する。

### 会社が使える条件として揃えるもの

| 確認事項 | 必要な原本・合意 |
|---|---|
| 対象の技術 | 特許の一覧、菌株・培養・改変・装置ノウハウの範囲、提供物 |
| 事業での利用 | 実施許諾契約、独占／非独占、用途・地域・期間、再許諾、委託製造の可否 |
| 改良と共同開発 | 新しい発明、データ、装置設計の帰属、共同出願、成果公表の条件 |
| 継続利用 | 契約終了時の扱い、譲渡・組織変更・資金調達時の同意、研究者離脱後の技術提供 |
| 対価と管理 | ライセンス料・不実施補償の協議記録、維持費・期限の担当、未解決の条件 |

これらの条件の締結原本は、今回確認した資料では取得できていない。
大学から会社への自動承継や、独占実施が確定しているとは記載しない。

### ノウハウを引き継ぐ計画

技術台帳には、株の改変のタイミング・選抜の仕方に研究室のノウハウがあるとの2026年9月15日の記録がある。
大学・研究者と、権利帰属、秘密情報の範囲、引継ぎ先、開示許可を合意する。
手順書や動画を作る場合も、作成済み・会社へ移管済みの実績に置き換えない。
事業化の説明には技術の構造と引継ぎ計画を使い、具体的な未公開レシピは別に管理する。

### 他社特許と未照合の出願

2026年2月の特許検索一覧は、過去の調査の入口であり、現在の事業で他社特許を侵害しないことを示す結論ではない。
採用する株・装置・金属回収工程・販売地域を固定した後、請求項との照合を専門家に依頼する。
2025年度研究開発報告書にはPCT/JP2025/043584の記載もある。
名称・対象技術・他出願との関係が資料だけでは特定できないため、大学の一覧と照合してから台帳を拡張する。','active','internal','manual','環境浄化事業化の説明Ver3（2026-09-30）p5／WO2025/028350公開公報の表紙（2026-10-05確認）／2025年度研究開発報告書（2026-04-01）／技術台帳の2026-09-15記録','https://patents.google.com/patent/WO2025028350A1/ja','amie-sol-dd-content-20261005','amie-sol-dd-content-20261005',false,NULL);
INSERT INTO public.project_tech_topics (tech_topic_id,project_id,block_kind,title,tech_domain,sort_order,summary,body_md,status,confidentiality,source_kind,source_ref,source_url,created_by,updated_by,needs_check,check_reason) VALUES ('ptt_sol_bm_adoption','p21','article','対象顧客と採用条件 — オンサイトの最初の用途','ビジネスモデル',60,'業種の広さより、どの工程のどんな問題を解き、誰が採用を決めるかを示す。','### 最初に提案する価値

既存の排水処理ラインへ処理段階を追加し、対象の金属・色・窒素などを取り除く構想。
顧客にとっての価値は、水質、薬品・残渣、運転の手間、設備の使い方について現場で判断する。
CO2を資源にすることだけを、全顧客に共通する購入理由にはしない。

### 用途ごとの入口と判断条件

| 用途 | 顧客が困っていること／聞くこと | 試す位置・条件 | 採用に必要な証拠 |
|---|---|---|---|
| 金属を含む排水 | 必要な水質、現在の処理能力、混合金属、薬品・残渣、金属回収の用途 | 中和前など、塩分が増える前の位置を候補にする。液と工程ごとに決める | 各金属の最終濃度、処理量、速度、交換頻度、既存方式との比較 |
| 食品・着色排水 | 窒素・リン、着色、季節変動、油脂、少人数での運転負担 | 油が多い液は前処理後を候補にする。菌の増殖と水質改善を分ける | COD・窒素・リン・色など必要指標の処理前後分析と作業量 |
| 新しい化学工程の排液 | 濃度・共存物質・現在の処理経路が未確立 | 対象液を入手して阻害と処理可能性を確認する | 試験による適合判断。未試験物質を処理できる前提にしない |
| 鉱山の湧き水など | 薄い濃度、低い水温、多い流量 | 低温条件での働きを先に確認する | 温度別の性能と大量流量での装置条件 |

2026年10月の訪問では、排水がほとんど出ない加工・組立工程もあった。
同じ業種名の企業を一律に顧客候補へ数えず、排液が出る工程と用途から選ぶ。
優先する業界・顧客の最終選定は、サンプル評価と採用条件の確認を踏まえて行う。

### 商談を実証・導入へ進める

紹介・関心表明 → 排液情報とサンプル → ラボ評価 → 顧客拠点での実証 → 採用判断 → 継続供給の順で進める。
各段階で、現場担当、決裁・予算の担当、設備・安全の担当、契約窓口を確認する。
紹介元やサンプル提供者の人数を、そのまま有償顧客数にしない。
無償・有償、費用負担、検収、導入契約の条件は案件ごとに合意する。

### 現在の案件の読み方

食品工場では2026年10月2日に3地点のサンプルと分析資料を受領した。
非鉄金属の会社ではサンプル提供の可否を先方が判断中で、改質リグニンの会社ではNDAを依頼した段階。
これらを契約済みの現場実証や導入確定へ置き換えない。
顧客ごとの現在のボール・次の行動は「関係先」の台帳を正本にし、本ページでは採用条件を説明する。','active','internal','manual','2026-10-01〜02愛媛訪問の会議記録・関係先台帳（2026-10-03反映）／環境浄化事業化の説明Ver3（2026-09-30）p11。用途の選定と採用条件は整備案','https://drive.google.com/file/d/126lYRZBbbhe_IIxf4C1Fkgouf0HhyYUG/view?usp=drivesdk','amie-sol-dd-content-20261005','amie-sol-dd-content-20261005',false,NULL);
INSERT INTO public.project_tech_topics (tech_topic_id,project_id,block_kind,title,tech_domain,sort_order,summary,body_md,status,confidentiality,source_kind,source_ref,source_url,created_by,updated_by,needs_check,check_reason) VALUES ('ptt_sol_bm_market_scope','p21','article','市場の捉え方 — 排水の量から導入可能な工場へ','ビジネスモデル',61,'オンサイト、オフサイト、金属回収、燃料を同じ市場額として足さず、導入条件から市場を絞る。','### 分けて捉える市場

主力として検証するオンサイトは、工場の排水ラインに装置と菌体を提供する市場。
オフサイト案Cは、許可を持つ既存処理業者の拠点へ菌体・装置を提供する市場。
回収金属は、処理した水の量ではなく、金属種・回収量・純度と買い手で成立を判断する。
バイオ燃料は、抽出・製造・品質の検証と販売先を要する将来の事業として分ける。

### 統計の使い方

「対象になる廃液と量」の公的統計は、特別管理産業廃棄物の廃酸・廃アルカリなどの排出量を示す。
工場で自ら処理・放流するオンサイトの排水量全体や、菌で処理できる量と同じではない。
排出量から自動的に自社の売上市場を算出せず、量の範囲・年度・委託量・処理適合性を確認する。
研究者説明資料のTAM・SAM・SOMは、算定の出所と対象範囲を別途確認する必要がある。
市場の確定値として採用する前に、用途別の根拠表を作る。

### 導入可能な市場へ絞るための根拠表

| 絞り込み | 集める情報 | 除外・区別するもの |
|---|---|---|
| 排液がある工場 | 工程、事業所数、対象物質、排水・廃液の量、季節変動 | 対象排水の出ない加工・組立工場 |
| 技術が適合する工場 | 塩分、温度、油・薬剤・共存物、必要水質、流量、設置位置 | 未試験・阻害条件・必要流量を満たさないもの |
| 採用の理由がある工場 | 既存処理の課題、顧客内の採用条件、設備更新の時期、担当部門 | 関心表明だけで購入理由が分からないもの |
| 到達できる工場 | 既存の紹介経路、設備会社・処理業者との接点、決裁者、評価・調達の時期 | 紹介者と利用者の重複、契約未合意の販路 |
| 供給できる範囲 | 菌体・装置の供給能力、設置・保守担当、輸送と回収 | 将来の工場拡張を現在の供給能力に含めること |

### 顧客へ届く経路

大学、自治体、地域金融機関からの紹介で、排液情報・サンプル評価の入口を作る。
設備会社とは既存ラインへの接続・保守、処理業者とは案Cの運用を個別に協議する。
瀬戸内産業排水ラウンドテーブルは連携の場としての構想であり、参加を受注・独占販路・出資の確約として扱わない。
用途を広げる判断は、最初の顧客で再現できる実証・運転・供給の証拠を踏まえる。','active','internal','manual','ビジネスモデル「対象になる廃液と量」「オフサイトの廃液処理の評価」／2026-10-01〜02会議記録／環境浄化事業化の説明Ver3（2026-09-30）p9。市場絞り込みは2026-10-05の整備案','https://drive.google.com/file/d/126lYRZBbbhe_IIxf4C1Fkgouf0HhyYUG/view?usp=drivesdk','amie-sol-dd-content-20261005','amie-sol-dd-content-20261005',false,NULL);
INSERT INTO public.project_tech_topics (tech_topic_id,project_id,block_kind,title,tech_domain,sort_order,summary,body_md,status,confidentiality,source_kind,source_ref,source_url,created_by,updated_by,needs_check,check_reason) VALUES ('ptt_sol_bm_contract_path','p21','article','契約と責任の分担 — 設立前から顧客導入まで','ビジネスモデル',62,'秘密保持、試料提供、実証、継続供給を分け、当事者・成果・安全・承継の条件を確認する。','### 設立前の進め方

設立前DDを進める一方、まだ存在しない会社の契約・許認可・雇用を締結済みとして扱わない。
2026年10月1日の面談では、秘密保持契約を株式会社チームアルマダ、設立前の基本合意書を愛媛大学名義で進める方針が説明された。
この方針と、相手先ごとの締結原本・大学の承認は別に確認する。
設立後への承継は、対象の権利義務、必要な相手方同意、時期を個別に定める。

### 段階ごとに揃える合意

| 段階 | 決めること | 次へ進む条件 |
|---|---|---|
| 情報交換・NDA | 当事者と署名権限、情報の範囲、大学・分析先・投資家へ共有できる範囲 | 相手先の秘密情報と未公開技術を扱える条件が決まる |
| 試料提供 | 利用目的、採取・輸送・保管、外部分析、残試料の返却・廃棄、結果の帰属と開示 | 安全な試料受領と試験、報告の条件が決まる |
| ラボ実証 | 対象液、試験条件、成果物、合否、期間、費用負担、発表・改良発明 | 報告結果を顧客と確認し、現場試験の条件を決められる |
| 顧客拠点での実証 | 設置・運転・停止、既存設備への影響、菌体回収、安全、事故対応、保険、検収 | 顧客・研究側・事業側の責任と、現場試験の許可条件が決まる |
| 継続供給 | 製品仕様、出荷検査、供給・交換・保守、障害対応、保証範囲、契約終了 | 顧客の採用条件と供給能力を満たし、契約が締結される |

NDA、サンプル提供、導入検討意向、現場実証、継続供給は別の状態として記録する。
締結済みの契約は、日付、当事者、対象、期限、重要な義務、変更・承継条項と原本を紐づける。
原本未取得の場合は「締結を確認できていない」と記載し、契約が存在しないと断定しない。

### 大学・事業側・顧客の境界

大学との間では、特許・菌株・ノウハウの実施許諾、共同研究、設備・試料、データ、兼業・利益相反の扱いを確認する。
事業側と装置会社の間では、仕様、製造・検査、設置、保守、事故、設計変更と改良発明を定める。
顧客との間では、投入位置、原水の変動、日常運転、回収、結果の検収、対外利用を定める。
大学の研究費・受託業務と、設立する会社の契約・資産を分けて管理する。

### 許認可の確認先

強化株を使う場合は、株・用途・設備・運用に対応するカルタヘナ法上の区分と手続きを、技術ページの「閉鎖系」の論点から確認する。
自然株でも、排水基準、試料輸送、菌体・残渣の取扱いなどの確認は残る。
使用済み菌体の引取りや案Cは、廃棄物該当性、排出者、収集運搬・処分・施設の許可、既存業者の許可範囲を所管行政と確認する。
許可を持つ業者と組む案であっても、処理方法の追加が既存許可に含まれると決めつけない。
法令の区分・手続きの確定や許可取得は、実際の行政回答・契約・許可書を取得した後に記録する。','active','internal','manual','2026-10-01いよぎん面談／2026-10-02返送・依頼の記録／環境浄化事業化の説明Ver3 p11／既存の閉鎖系・許可トピック／2026-06法務論点表を匿名・一般化。契約条件は整備案','https://drive.google.com/file/d/126lYRZBbbhe_IIxf4C1Fkgouf0HhyYUG/view?usp=drivesdk','amie-sol-dd-content-20261005','amie-sol-dd-content-20261005',false,NULL);
INSERT INTO public.project_tech_topics (tech_topic_id,project_id,block_kind,title,tech_domain,sort_order,summary,body_md,status,confidentiality,source_kind,source_ref,source_url,created_by,updated_by,needs_check,check_reason) VALUES ('ptt_sol_bm_team','p21','article','事業化の体制 — 現在の担い手と必要な役割','ビジネスモデル',63,'研究・事業開発の現在の担い手と、設立・供給・現場実証のために必要な役割を区別する。','### 現在の担い手

杉浦美羽氏を中心とする愛媛大学の研究チームが、好熱性シアノバクテリアの技術開発と実験を担う。
杉浦氏の専門は光合成・生物物理・機能生物化学・応用微生物学で、技術の出自は大学での研究にある。
株式会社チームアルマダは、事業計画、顧客・協力先との調整、DD資料の整備、設立準備を担う。
山地正洋氏は設立予定会社のCEOを担う方針で、登記済みの代表者ではない。
石原裕香氏は大学側の産学連携・事業化を支える立場で関与している。
研究者、支援機関、投資家候補、協力企業を、設立する会社の従業員数に合算しない。

### 設立・実証・供給に必要な役割

以下は役割を埋める計画であり、採用済みの組織図ではない。

| 役割 | 責任 | 確認するもの |
|---|---|---|
| 経営・事業開発 | 顧客の採用条件、提携・契約、設立と実証の全体判断 | 役員の合意、兼務・稼働、権限、代理担当 |
| 研究・技術移管 | 株・培養・処理条件、試験の再現性、技術の引継ぎ | 大学との契約、技術提供の範囲、研究者の関与 |
| 製品・装置開発 | リアクターと包装、設置仕様、連続運転、安全設計 | 開発担当・製造委託先の契約と成果物 |
| 運転・品質・現場支援 | 培養・出荷判定、設置・保守、回収、顧客障害対応 | 責任者、手順、教育、交代要員、出荷・対応記録 |
| 契約・知財・管理 | 許諾・期限管理、行政確認、文書・労務・資産の管理 | 担当分担、専門家との契約、必要な承認 |

2026年10月2日の相談では、大学側から学生への声掛けを行い、反応を見てCOO候補として面談する方針が共有された。
候補の参画、採用条件、CEOへの移行は確定していない。
大学の教員・学生が会社へ関与する場合の兼業、利益相反、雇用、発明・秘密情報の扱いも確認する。

### 人に依存するリスクへの対応案

株の取扱い・実験・出荷・設置の手順を文書化し、別の担当が同じ条件で再現できるか確かめる。
大学と会社の技術移管、種株の保全、代替担当の育成、装置保守を組み合わせる。
関与時間や雇用契約の原本がない人を、専任・常勤・採用確定として提示しない。','active','internal','manual','2026-06-10創業体制方針（project_venture_members）／2026-10-02車中相談（2026-10-03反映）／J-GLOBAL 杉浦美羽研究者情報（2026-09-17更新、2026-10-05確認）。必要役割は整備案','https://jglobal.jst.go.jp/detail?JGLOBAL_ID=200901046665626251','amie-sol-dd-content-20261005','amie-sol-dd-content-20261005',false,NULL);
INSERT INTO public.project_tech_topics (tech_topic_id,project_id,block_kind,title,tech_domain,sort_order,summary,body_md,status,confidentiality,source_kind,source_ref,source_url,created_by,updated_by,needs_check,check_reason) VALUES ('ptt_sol_bm_dd_evidence','p21','article','DDの確認状況 — 各ページの根拠と残る資料','ビジネスモデル',64,'会社設立前のDDとして、説明を揃えた項目と原本・実証・合意が残る項目を示す。','### このDDの読み方

SolvioraXは設立前の事業化プロジェクトで、会社の登記情報・会社名義の契約・雇用・権利をすべて保有している段階ではない。
研究の実績、現在の方針、将来の到達目標、確認が残る条件を区別して読む。
説明文が揃ったことと、原本・実証・合意が揃ったことも分ける。

一般的なVCのDDでは、会社・株式・機関決定、知財、経営陣・雇用、重要契約、法令・環境責任、事業計画と財務資料を確認する。
本パッケージは、この構成に技術実証・供給・顧客の採用条件を加え、設立前に存在しない資料は予定と現在の資料で区別する。
構成の参考は[CooleyのVC向け確認資料一覧](https://www.cooleygo.com/wp-content/uploads/2014/07/Cooley-GO-Tip-Sheet-Sample-VC-Due-Diligence-Request-List.pdf)と[TDK VenturesのDD資料](https://tdk-ventures.com/wp-content/uploads/2024/04/6Pages-Report-for-TDK-Ventures-Apr-2024-Doing-Diligence-Well-in-Venture-Investing.pdf)。
米国の確認例を、日本で一律に必要な法定書類として扱わない。

### ページと根拠の対応

| ページ | 説明・根拠の現在地 | 次に取得・確認するもの |
|---|---|---|
| 会社概要 | 事業の詳しい説明と設立前の状態を整理 | 商号・本店・役員・定款目的の合意、設立後の登記事項・定款 |
| 技術 | 実験記録・性能条件、閉鎖系、実証と供給の計画 | 試料・全測定値・反復・分析証明・連続運転・出荷検査の記録 |
| 知財 | 研究者説明資料と公開公報から出願を台帳化 | 大学の出願管理一覧、現在の権利状態、実施許諾原本、ノウハウ移管条件 |
| 市場・競合 | 既存方式と企業の比較、排出量の公的統計、顧客の現場の記録 | 用途別の事業所数・適合量・採用条件、同条件の比較実証 |
| ビジネスモデル | 提供物と収益の形、顧客の採用条件、契約・役割の段階 | 顧客・大学・装置会社との合意、対象ごとの検収・責任・開示条件 |
| 事業計画・ガント | フェーズの目標と実行中の工程 | 担当・期限・成果物の確認、目標に対する実績 |
| 関係先・沿革 | 顧客・協力先の現在の状態と会議・活動記録 | 返答・サンプル・実証・契約の進展に応じた一次記録 |
| ドライブ | 既存の事業概要・PoC資料。研究者説明資料・公開公報を掲載候補へ追加 | DDで利用できる原本の取得、顧客データの開示可否と添付の選定 |
| 資金調達履歴 | 設立予定会社の確定した株式調達記録は未登録 | 実際の発行・払込・契約・株主名簿に基づいて登録 |

### 主要な未解決事項

実排液での性能・供給品質・連続運転、大学技術の利用権、必要な許認可、顧客の採用合意、専任の運転・開発体制が残る。
訴訟・紛争、事故・環境責任、関連当事者との取引、大学の兼業・利益相反も確認先と対象期間を定めて照会する。
資料が見つからない項目を「該当なし」「安全」「契約なし」と断定しない。
コスト試算・月次試算表・資本政策の数値検証は別の作業として、各ページの現在の正本を参照する。','active','internal','manual','2026-10-05 DD構成リサーチとOS・Drive現物の照合。Cooleyの資料一覧とTDK Venturesの報告を設立前のSOLへ適用','https://www.cooleygo.com/wp-content/uploads/2014/07/Cooley-GO-Tip-Sheet-Sample-VC-Due-Diligence-Request-List.pdf','amie-sol-dd-content-20261005','amie-sol-dd-content-20261005',false,NULL);
INSERT INTO public.project_tech_topics (tech_topic_id,project_id,block_kind,title,tech_domain,sort_order,summary,body_md,status,confidentiality,source_kind,source_ref,source_url,created_by,updated_by,needs_check,check_reason) VALUES ('ptt_sol_comp_validation','p21','article','既存方式に対する価値 — 同じ条件で何を比べるか','競合比較',90,'既存の星取り表を、顧客の同じ排液・必要水質・流量に対する比較試験へつなぐ。','### 競合比較を実証につなぐ

既存の星取り表と方式別の説明は、公開情報や個別の実験条件で比べた整理。
自社技術の優位性を示すには、顧客の同じ排液と要求水質、処理量で比較する必要がある。
異なる金属種・濃度・菌体量・接触時間の結果を並べて、処理速度が一律に優れると断定しない。

### 用途ごとの比較の設計案

| 比較する用途 | 既存の選択肢 | 共通の物差し |
|---|---|---|
| 金属の除去・回収 | 凝集沈殿、イオン交換・キレート樹脂、微生物を用いる回収 | 元素ごとの原水・処理後濃度、実流量、接触時間、回収量・純度、薬品、残渣、交換・再生 |
| 色・有機物の処理 | 活性汚泥、凝集沈殿、活性炭、オゾン・フェントンなどの追加処理 | 色、COD・BODなど必要指標、温度と季節変動、薬品、残渣、運転時間と作業量 |
| 既存設備への追加 | 現行ラインの継続運転、設備更新、別方式の追加 | 設置面積、停止期間、接続、安全、菌体回収、保守、最終水質 |

比較相手は、対象液で実際に採用・検討される方式から選ぶ。
単独で全工程を代替するのか、既存処理の一部を補完するのかも揃えて比較する。
経済性は別途、同じ処理量と工程の範囲を揃えたコスト試算で確認する。

### 差別化の仮説と証拠

高温への適合、菌体による金属の濃縮、薬品・残渣を減らす余地、既存ラインへの追加が価値の仮説になる。
どれが価値を生むかは、対象排液、前処理、菌体・装置の運転、回収後の処理によって変わる。
自然株と強化株は、性能だけでなく使用できる設備と法令上の条件が異なるため、別々に示す。
塩分・低温・油・薬剤の制約、菌体の供給とカートリッジ寿命、連続処理量が弱点になりうる。
これらを含めた結果から、向く用途・向かない用途を説明する。

### 他社の状況の確認

他社の事業化・導入・規制の情報には確認日と出典を付ける。
既存の会社別・方式別のトピックを正本にし、未確認の情報で成熟度の評価を書き換えない。
他社特許との重なりは、性能や公開情報の比較とは別に、採用する技術の請求項との照合で確認する。','active','internal','manual','既存の競合比較13トピック／2026-10-02顧客面談／環境浄化事業化の説明Ver3。比較試験は2026-10-05の整備案','https://drive.google.com/file/d/126lYRZBbbhe_IIxf4C1Fkgouf0HhyYUG/view?usp=drivesdk','amie-sol-dd-content-20261005','amie-sol-dd-content-20261005',false,NULL);
INSERT INTO public.project_company_profiles (project_id,legal_status,business_purpose,source_ref,source_verified_on,notes,created_by_email,updated_by_email) VALUES ('p21','pre_incorporation','好熱性シアノバクテリアを利用した排水処理、菌体・処理装置の供給、資源回収およびバイオ燃料への利用（事業の構想。定款目的の正式文言は設立時に確定）','2026-10-01いよぎん面談・2026-10-02創業体制相談／2026-10-05社名候補の確認。設立前。2027-04-01設立予定、正式商号・本店・役員等は未確定','2026-10-05','プロジェクトの呼称はSolvioraX。正式商号は未確定。solvioは提案で、採用決定ではない。設立日・代表者・法人番号・株式数・資本金・定款・機関設計は確定した登記値として入力しない。設立前に事業内容、創業者・役員の役割、大学との権利境界を確認し、設立後に原本を登録する。','amie-sol-dd-content-20261005','amie-sol-dd-content-20261005');
UPDATE public.project_business_summaries SET detail='愛媛大学で研究された好熱性シアノバクテリアを使い、工場排水に含まれる重金属の回収や有機系色素の処理を行う事業。
光とCO2を利用して培養した菌体をカートリッジに収め、処理装置とともに顧客の排水ラインへ提供する。
対象は、金属を含む排水を出す製造業や、着色排水を出す食品・繊維などの工場。
装置、菌体の継続供給、運転・保守を組み合わせ、既存の排水処理に処理段階を追加する。
金属を取り込んだ菌体からの資源回収と、菌体を原料にしたバイオ燃料への利用も事業領域に含む。',updated_by_email='amie-sol-dd-content-20261005',updated_at=now() WHERE project_id='p21';
INSERT INTO public.project_ip_assets (ip_asset_id,project_id,relation,ip_kind,title,abstract_text,jurisdiction,family_key,application_number,application_date,priority_date,status,tech_domain,importance,confidentiality,source_kind,note_md,external_url,pct_status,pct_number,created_by,updated_by) SELECT ip_asset_id,project_id,relation,ip_kind,title,abstract_text,jurisdiction,family_key,application_number,application_date,priority_date,status,tech_domain,importance,confidentiality,source_kind,note_md,external_url,pct_status,pct_number,created_by,updated_by FROM jsonb_populate_record(NULL::public.project_ip_assets, '{"ip_asset_id": "ip_sol_jp_2023127024", "project_id": "p21", "relation": "university", "ip_kind": "patent", "title": "好熱性シアノバクテリアによる重金属濃縮・分離", "abstract_text": "研究者説明資料の国内出願。WO2025/028350の優先権出願。", "jurisdiction": "JP", "family_key": "sol_water_treatment_20230803", "application_number": "特願2023-127024", "application_date": "2023-08-03", "priority_date": "2023-08-03", "status": "unknown", "tech_domain": "重金属処理", "importance": 5, "confidentiality": "internal", "source_kind": "manual", "note_md": "出願番号・用途は環境浄化事業化の説明Ver3（2026-09-30）p5、日付と優先権の関係はWO2025/028350公開公報の表紙を2026-10-05に確認。\n国際出願と同一の系列として整理。独立した特許権数へ合算しない。国内出願の出願人・発明者は個別の出願原本で確認する。\n設立予定会社への実施許諾、独占性、用途・地域・再許諾、対価、改良発明、ノウハウ移管の条件は未確認。締結原本と大学の出願管理一覧を取得して確認する。\n現在の審査・権利状態と名義は未照合。登録済み・自社保有・権利が有効と断定しない。", "external_url": "https://patents.google.com/patent/WO2025028350A1/ja", "pct_status": "pct_filed", "pct_number": "PCT/JP2024/026378", "created_by": "amie-sol-dd-content-20261005", "updated_by": "amie-sol-dd-content-20261005"}'::jsonb);
INSERT INTO public.project_ip_assets (ip_asset_id,project_id,relation,ip_kind,title,abstract_text,jurisdiction,family_key,application_number,application_date,priority_date,status,tech_domain,importance,confidentiality,source_kind,note_md,external_url,pct_status,pct_number,created_by,updated_by) SELECT ip_asset_id,project_id,relation,ip_kind,title,abstract_text,jurisdiction,family_key,application_number,application_date,priority_date,status,tech_domain,importance,confidentiality,source_kind,note_md,external_url,pct_status,pct_number,created_by,updated_by FROM jsonb_populate_record(NULL::public.project_ip_assets, '{"ip_asset_id": "ip_sol_jp_2023127044", "project_id": "p21", "relation": "university", "ip_kind": "patent", "title": "好熱性シアノバクテリアによる色素分解", "abstract_text": "研究者説明資料の国内出願。WO2025/028350の優先権出願。", "jurisdiction": "JP", "family_key": "sol_water_treatment_20230803", "application_number": "特願2023-127044", "application_date": "2023-08-03", "priority_date": "2023-08-03", "status": "unknown", "tech_domain": "色素処理", "importance": 5, "confidentiality": "internal", "source_kind": "manual", "note_md": "出願番号・用途は環境浄化事業化の説明Ver3（2026-09-30）p5、日付と優先権の関係はWO2025/028350公開公報の表紙を2026-10-05に確認。\n国際出願と同一の系列として整理。独立した特許権数へ合算しない。国内出願の出願人・発明者は個別の出願原本で確認する。\n設立予定会社への実施許諾、独占性、用途・地域・再許諾、対価、改良発明、ノウハウ移管の条件は未確認。締結原本と大学の出願管理一覧を取得して確認する。\n現在の審査・権利状態と名義は未照合。登録済み・自社保有・権利が有効と断定しない。", "external_url": "https://patents.google.com/patent/WO2025028350A1/ja", "pct_status": "pct_filed", "pct_number": "PCT/JP2024/026378", "created_by": "amie-sol-dd-content-20261005", "updated_by": "amie-sol-dd-content-20261005"}'::jsonb);
INSERT INTO public.project_ip_assets (ip_asset_id,project_id,relation,ip_kind,title,abstract_text,jurisdiction,family_key,application_number,publication_number,application_date,publication_date,priority_date,applicants,inventors,status,tech_domain,importance,confidentiality,source_kind,note_md,external_url,pct_status,pct_number,created_by,updated_by) SELECT ip_asset_id,project_id,relation,ip_kind,title,abstract_text,jurisdiction,family_key,application_number,publication_number,application_date,publication_date,priority_date,applicants,inventors,status,tech_domain,importance,confidentiality,source_kind,note_md,external_url,pct_status,pct_number,created_by,updated_by FROM jsonb_populate_record(NULL::public.project_ip_assets, '{"ip_asset_id": "ip_sol_wo_2025028350", "project_id": "p21", "relation": "university", "ip_kind": "patent", "title": "汚染水の処理方法", "abstract_text": "好熱性シアノバクテリアを用いる汚染水の処理に関する公開出願。重金属処理と有機系色素処理を含む。", "jurisdiction": "WO", "family_key": "sol_water_treatment_20230803", "application_number": "PCT/JP2024/026378", "publication_number": "WO2025/028350 A1", "application_date": "2024-07-23", "publication_date": "2025-02-06", "priority_date": "2023-08-03", "applicants": ["国立大学法人愛媛大学"], "inventors": ["日浅杉浦美羽", "野村信福", "中島純一"], "status": "published", "tech_domain": "重金属・色素処理", "importance": 5, "confidentiality": "internal", "source_kind": "manual", "note_md": "公開公報の表紙を2026-10-05に確認。優先権: 特願2023-127024・特願2023-127044（ともに2023-08-03）。出願人・発明者は公報の記載であり、現在の名義を保証しない。\n国際公開を登録済みの国際特許と呼ばない。各国の国内移行先・審査請求・登録・維持は大学の管理資料で確認する。\n設立予定会社への実施許諾、独占性、用途・地域・再許諾、対価、改良発明、ノウハウ移管の条件は未確認。締結原本と大学の出願管理一覧を取得して確認する。\n現在の審査・権利状態と名義は未照合。登録済み・自社保有・権利が有効と断定しない。", "external_url": "https://patents.google.com/patent/WO2025028350A1/ja", "pct_status": "pct_filed", "pct_number": "PCT/JP2024/026378", "created_by": "amie-sol-dd-content-20261005", "updated_by": "amie-sol-dd-content-20261005"}'::jsonb);
INSERT INTO public.project_ip_assets (ip_asset_id,project_id,relation,ip_kind,title,abstract_text,jurisdiction,application_number,status,tech_domain,importance,confidentiality,source_kind,note_md,external_url,created_by,updated_by) SELECT ip_asset_id,project_id,relation,ip_kind,title,abstract_text,jurisdiction,application_number,status,tech_domain,importance,confidentiality,source_kind,note_md,external_url,created_by,updated_by FROM jsonb_populate_record(NULL::public.project_ip_assets, '{"ip_asset_id": "ip_sol_jp_2026073552", "project_id": "p21", "relation": "university", "ip_kind": "patent", "title": "汚染水の処理装置", "abstract_text": "研究者説明資料に記載された処理装置の国内出願。明細書・請求項と現在の権利状態は確認待ち。", "jurisdiction": "JP", "application_number": "特願2026-73552", "status": "filed", "tech_domain": "処理装置", "importance": 5, "confidentiality": "internal", "source_kind": "manual", "note_md": "環境浄化事業化の説明Ver3（2026-09-30）p5で出願番号と名称を確認。大学技術の出願として整理した。\n出願日・出願人・発明者・優先権・公開番号は受領書・出願原本で確認してから入力する。\n設立予定会社への実施許諾、独占性、用途・地域・再許諾、対価、改良発明、ノウハウ移管の条件は未確認。締結原本と大学の出願管理一覧を取得して確認する。\n現在の審査・権利状態と名義は未照合。登録済み・自社保有・権利が有効と断定しない。", "external_url": "https://drive.google.com/file/d/126lYRZBbbhe_IIxf4C1Fkgouf0HhyYUG/view?usp=drivesdk", "created_by": "amie-sol-dd-content-20261005", "updated_by": "amie-sol-dd-content-20261005"}'::jsonb);
UPDATE public.project_business_plans SET phases_json=jsonb_set(phases_json,'{0,lanes,business,activities}','["優先顧客2業界と最初の用途を固定", "排水基準・環境安全・菌体/包装物の取扱いと顧客設備側の責任分界を整理", "有償PoC候補2社の意向を確認", "対象液・採用条件・決裁者を案件ごとに確認し、紹介・サンプル提供・実証・導入合意を区別する"]'::jsonb,false) WHERE project_id='p21';
UPDATE public.project_business_plans SET phases_json=jsonb_set(phases_json,'{0,lanes,technology,activities}','["培養株・培養レシピ・品質指標を絞る", "培養→回収→包装→輸送→顧客投入の一連条件を設計", "PoC用リアクター仕様と測定計画を固定", "試料番号、原水と処理後水、菌体量、反復・対照、分析方法をそろえた実証計画を研究チームと顧客に確認する"]'::jsonb,false) WHERE project_id='p21';
UPDATE public.project_business_plans SET phases_json=jsonb_set(phases_json,'{0,lanes,organization,activities}','["設立前DDの技術・法務・財務・知財論点を完了", "NewCo設立とCEO候補の役割確定", "大学・発明者・SX間の知財境界を整理", "CEO予定・研究・製品開発・運転品質の役割、大学の兼業・利益相反、許諾と設立後への承継を文書で確認する"]'::jsonb,false) WHERE project_id='p21';
UPDATE public.project_business_plans SET phases_json=jsonb_set(phases_json,'{1,lanes,business,activities}','["顧客拠点で有償PoCを3件実施", "包装単位・納品頻度・顧客側運転手順と既存制度への適合要件を商品仕様化", "単価、粗利、継続条件を顧客別に検証", "現場ごとに水質・処理量・運転負担・検収を合意し、試料と結果の投資家向け開示条件を記録する"]'::jsonb,false) WHERE project_id='p21';
UPDATE public.project_business_plans SET phases_json=jsonb_set(phases_json,'{1,lanes,technology,activities}','["自社内の小規模培養・包装パイロット設備を構築", "輸送後の活性・保存期限・ロット品質基準を確立", "顧客設備での再現運転とユニットエコノミクスを証明", "差圧・破過・交換・停止復旧と、原水・処理後水・菌体・回収金属の物質収支を記録する"]'::jsonb,false) WHERE project_id='p21';
UPDATE public.project_business_plans SET phases_json=jsonb_set(phases_json,'{1,lanes,organization,activities}','["製品開発担当を確保し、必要な役割を段階的に補う", "品質記録、出荷判定、顧客障害対応の標準手順を導入", "取締役会・月次資金管理を開始", "出荷判定、設置保守、回収、事故・漏洩、代理担当を手順と契約の責任分担に落とす"]'::jsonb,false) WHERE project_id='p21';
UPDATE public.project_business_plans SET matrix_note='シード〜2028年6月の支払予算・調達方針は2026年9月30日改定。詳細は「試算表」。4レーン別の費用配賦とシリーズA以降の予算は再精査中。長期の事業・工場拡張は仮説として扱う。 技術・事業・体制の検証内容は2026-10-05に補足。出口条件は将来の到達目標で、現在の実績ではない。',source_note='SOL 事業計画 2026-09-30 改定版／非財務の補足: 2026-10-01〜02会議記録、研究者説明Ver3、DD整備案（2026-10-05）',updated_by_email='amie-sol-dd-content-20261005',updated_at=now() WHERE project_id='p21';
INSERT INTO public.workspace_documents (document_id,scope_kind,project_id,entry_kind,visibility,folder_path,display_name,external_url,mime_type,file_size_bytes,upload_status,source_kind,source_ref,created_by_member_id) VALUES ('e9c1f515-0428-5225-9dba-d156733002ac','project','p21','link','amd_internal','DD整備/2026-10-05','研究者説明_Ver3_20260930.pdf','https://drive.google.com/file/d/126lYRZBbbhe_IIxf4C1Fkgouf0HhyYUG/view?usp=drivesdk','application/pdf',0,'active','manual_link','sol-dd-content-20261005:researcher; 原本確認済み、掲載候補、未公開。','ID001');
INSERT INTO public.dd_package_items (package_id,project_id,section_key,item_kind,source_key,source_options,title,summary,sort_order) VALUES ('b0540a9f-7bde-426c-81a7-8a56a59f5b15','p21','evidence','document','workspace_document:e9c1f515-0428-5225-9dba-d156733002ac','{}'::jsonb,'研究者説明_Ver3_20260930.pdf','原本への参照。DD掲載候補。研究者説明の市場額・性能表現は適用条件と根拠を別途確認。',30);
INSERT INTO public.workspace_documents (document_id,scope_kind,project_id,entry_kind,visibility,folder_path,display_name,external_url,mime_type,file_size_bytes,upload_status,source_kind,source_ref,created_by_member_id) VALUES ('e6cb49c0-30ec-5cde-9a9b-10e2179d6f9b','project','p21','link','amd_internal','DD整備/2026-10-05','WO2025028350_公開公報.pdf','https://patentimages.storage.googleapis.com/58/c9/f7/87c0a55e9e7d17/WO2025028350A1.pdf','application/pdf',0,'active','manual_link','sol-dd-content-20261005:patent; 公開公報表紙確認済み、掲載候補、未公開。','ID001');
INSERT INTO public.dd_package_items (package_id,project_id,section_key,item_kind,source_key,source_options,title,summary,sort_order) VALUES ('b0540a9f-7bde-426c-81a7-8a56a59f5b15','p21','evidence','document','workspace_document:e6cb49c0-30ec-5cde-9a9b-10e2179d6f9b','{}'::jsonb,'WO2025028350_公開公報.pdf','国際公開公報。公開の確認は登録・現在の権利状態・実施許諾の確定を意味しない。',40);
COMMIT;
