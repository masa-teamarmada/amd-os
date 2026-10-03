-- SOL（p21）2026-10-01〜02 愛媛訪問の反映（2026-10-03）
--
-- まさの依頼（2026-10-03）:
--   「今回の瀬戸内ツアーで得られた知見をコックピットに入れていってほしい」「議事録はサマリだけじゃなく一次情報の書き起こしデータもすべて確認すること」
--   一覧の確認後「うん、おねがい」。窓口はすべてまさ（今後もできるだけまさ）。車中の話（社名・COO候補・eウェーブ）は4人で話したので
--   ワークスペースに出てよいが、気持ちや人物評は書かず事実だけ。愛知時計電機は「協業の余地がないと分かっただけ」でそれ以上は不要。
--   鉛・クロム・亜鉛・カドミウム等は検証済み（新しい証跡を正本にする）。餌になるかと分解するかは別の話。
-- 出典: Notion 議事録6件（いよぎん・愛知時計電機 10/1、ハタダ・日泉化学・住友金属鉱山・アドバンテック 10/2）の要約と書き起こし全文
--       （ローカルの Notion データベースから読んだ。愛知時計電機は録音が冒頭で止まり、最後の数分だけ）、いよぎん面談の Circleback の記録、
--       10/2 にまさが送ったお礼メール（ハタダ・日泉化学・住友金属鉱山・アドバンテック/eウェーブ・いよぎんキャピタル）。
-- 書き起こしの聞き違いの扱い: 「山下さん」「山井さん」→ 山地（まさ）。「コリブス」「ホリグス」→ DAVP の堀淵さん。「記憶帳」「紀北町」→ 愛媛県鬼北町
--   （柚子・久万高原・西条から約2時間の話から判断）。「ソルビラックス」「ツルビオラックス」等 → SolvioraX。半減期は「0.2分と十数秒」→ 約0.2分（Circleback と一致）。
-- 1. MTGカード: 10/1 いよぎん（新規）、10/2 の4枚を書き起こしに合わせて書き直す（鬼北町、eウェーブ同席、サンプル受領、展示会の件は SOL と無関係なので外す）
-- 2. 議事録の取り込み台帳: いよぎん recovered、愛知時計電機 no_material（カードは作らない）
-- 3. 関係先: 9件を更新、2件（木質素研究所・eウェーブ）を追加。窓口はすべてまさ。やり取り履歴と、相手側・SOL側のボール
-- 4. 技術タブ: 検証済みの金属を新しい証跡に合わせて更新、取り込みの順番、10Lリアクター、カートリッジ、菌の量、低温、PoC用の実排液
-- 5. ビジネスモデル: 「顧客の現場で分かったこと — 2026年10月の愛媛訪問」
-- 6. タスク: 社名の確認（solvio 案）、COO候補の探索
-- 生成: scratchpad の m460.py（コミットしない）

BEGIN;

INSERT INTO project_meeting_summaries (meeting_id, project_id, ym, meeting_date, meeting_start_at, title, notion_url, calendar_event_id,
  summary_short, decided, progress, next_actions, risks, source_hash, generated_at, generated_by_model, notion_page_id, source_kinds, narrative_md)
VALUES ($m$3klep1ffefhfskq3o75gnm9tp7$m$, 'p21', '202610', DATE '2026-10-01', TIMESTAMPTZ '2026-10-01 01:30:00+00', $m$SOL MTG いよぎん（伊予銀行・いよぎんキャピタル）$m$, $m$https://app.notion.com/p/3ec97749c60881a68f17c852655b3a10$m$, $m$3klep1ffefhfskq3o75gnm9tp7$m$,
  $m$伊予銀行・いよぎんキャピタルと面談。会社の設立前から出資の検討（DD）を始めてもらうことになり、NDAはチームアルマダを当事者に結ぶ。シードは評価額の上限5億円で1億円規模、シリーズAは約1年3か月後にプレ12億円超という計画と、色素分解の原価が約400円/m³まで下がった試算を説明した。新しいリアクターで鉄の排液10Lが約1時間で浄化された結果も共有した。$m$, $m$["いよぎんキャピタルとのNDAは、PSIステップ2で業務を受託しているチームアルマダを当事者にして結ぶ。", "出資は、設立する会社へ直接入れてもらう形で進める。", "会社の設立前から、DDに向けた情報の共有を始める。"]$m$::jsonb, $m$["いよぎんキャピタル: 会社の設立前でも投資委員会での検討は始められる。DDを経て承認されれば1か月程度で出資まで進められ、3月中に投資委員会を通れば翌月に出資できる見込み。", "コスト試算: 色素分解は、工場の排液・排ガス・排熱を使えるなど有利な条件をそろえると約400円/m³。市場の処理価格は500〜700円/m³で、規模の効果を入れる前の数字。", "資本政策: 創業時はまさが約8割、杉浦先生ら研究者側に約2割を想定。シードは評価額の上限5億円で1億円（〜1.5億円）を集め、放出は2割程度に抑えたい。シリーズAは約1年3か月後にプレ12億円超、条件は有償PoC3件の売上。最終的にはIPOを視野に入れる（海外展開と重ねる）。", "投資家候補: Partners Fund（1億円規模で検討していると聞いている）とDAVP（東京で面談してDDを始めてもらう予定）。地元の企業・投資家を優先したい。", "資金: NEDOのSTS（調達後の10月交付回）、商工中金などの融資も検討。売上が立った後に株式の一部を会社が買い戻す条項を株主間契約に入れたい。", "技術: 新しいリアクターで10Lの鉄の排液が予定の1日ではなく約1時間で浄化され、1時間後の鉄は0.09ppm（半分になるまで約0.2分）。酸性の排液（pH3〜4）も1時間でpH7に戻った。磁性材料メーカーの実排液でネオジムを30分でほぼ取り込んだ。", "排液: 当初の目標の10社を超え、20種類以上を集めて試験している（銀行・自治体の紹介）。", "SIER（瀬戸内産業排水ラウンドテーブル）: 排液を出す企業・設備メーカー・金融機関・地元メディアが同じ場で状況を共有する。まずMOU、役割が見えたら個別の契約。金融機関には、顧客候補の企業への働きかけと出資の両面を期待している。"]$m$::jsonb, $m$["杉浦先生がPSI-GAPファンド ステップ2の申請書を送る（10/2 送付済み）。", "いよぎんキャピタルがNDAのひな形を送る（10/2 受領）。まさがチームアルマダ名義の修正案と、事業概要資料・SIERのパンフレットを返す（10/2 送付済み）。", "DDの資料として、コスト試算の詳細、事業領域と市場規模、シリーズBまでの月次の数字を共有する（まさ）。", "杉浦先生が水処理の実験の動画を共有する。", "設立時期（3月末の案）を関係者と詰める。大学には杉浦先生から早期事業化の利点を説明する。", "リアクターの通気を4〜5か所に増やし、来週頭に大型化・縦型化に向けた次の実験をする（杉浦先生）。"]$m$::jsonb, $m$["出資の額・条件と投資委員会の時期は未合意。", "大学側は年度内（3月）の設立は難しいとしている。研究費の期間が終わる3月と設立日の間に、装置の改良費（数十万円）を残しておく必要がある。", "装置の納品は、光を通すプラスチック部材の調達が遅れている。", "STSが採択されない場合は、ブリッジの調達が要る。"]$m$::jsonb,
  $m$h1-local-notion:02f56cf782e0eb660589245e15574990108b768424f1a99b9bd1b25d0372df70$m$, NOW(), 'manual-amie-2026-10-03', $m$3ec97749-c608-81a6-8f17-c852655b3a10$m$, $m$notion-local+circleback+gmail+calendar$m$, $m$## 🎯背景
2026年10月1日の午前、松山で伊予銀行・いよぎんキャピタルと面談した（約1時間）。愛媛の企業訪問の初日で、目的は2つ。設立予定の会社（2027年4月1日設立予定、社名は検討中）への出資の検討（デューデリジェンス）を始めてもらうことと、瀬戸内産業排水ラウンドテーブル（SIER）に向けて情報を共有すること。SOLからはまさ・杉浦先生らが出席した。

## 📊経緯
いよぎんキャピタルからは、会社の設立前でも投資委員会での検討は始められ、DDを経て承認されれば1か月程度で出資まで進められること、3月中に投資委員会を通れば翌月に出資できる見込みが示された。まさは、事業として成り立つかを確かめるのがPSIステップ2の役割だとして、コスト試算の仕組みを画面で見せた。色素分解は、工場の排液・排ガス・排熱を使えるなど有利な条件をそろえると約400円/m³で、市場の処理価格500〜700円/m³の内に入る（規模の効果を入れる前の数字）。資本政策は、創業時はまさが約8割、杉浦先生ら研究者側に約2割を想定し、シードは評価額の上限5億円で1億円（〜1.5億円）を集めて放出を2割程度に抑えたいこと、シリーズAは約1年3か月後にプレ12億円超を目標とし、有償PoC3件の売上を条件と見ていること、最終的にはIPOを視野に入れていることを説明した。投資家候補はPartners Fund（1億円規模で検討していると聞いている）とDAVP（東京で面談してDDを始めてもらう予定）で、地元の企業・投資家を優先したいと伝えた。NEDOのSTS、商工中金などの融資、売上が立った後に株式の一部を会社が買い戻す条項も検討している。杉浦先生は新しいリアクターの実験を動画で示し、10Lの鉄の排液が予定の1日ではなく約1時間で浄化されたこと（1時間後0.09ppm）、酸性の排液がpH3〜4から1時間でpH7に戻ること、ネオジムを30分でほぼ取り込むことを報告した。いよぎん側からは、排液の入手に苦労しているか、菌は同じものを培養して使うのか、混ざった金属をどう取り出すのか、といった質問が出た。後半はSIERの構想を説明し、金融機関には顧客候補の企業への働きかけと出資の両面を期待していると伝えた。最後に、会社がないなかでのNDAの結び方と、設立時期（3月末の案）を話した。

## ✅決まったこと
- いよぎんキャピタルとのNDAは、PSIステップ2で業務を受託しているチームアルマダを当事者にして結ぶ。
- 出資は、設立する会社へ直接入れてもらう形で進める。
- 会社の設立前から、DDに向けた情報の共有を始める。

## ▶️次の一手
- 杉浦先生がPSI-GAPファンド ステップ2の申請書を送る（10/2 送付済み）。
- いよぎんキャピタルがNDAのひな形を送る（10/2 受領）。まさがチームアルマダ名義の修正案と、事業概要資料・SIERのパンフレットを返す（10/2 送付済み）。
- DDの資料として、コスト試算の詳細、事業領域と市場規模、シリーズBまでの月次の数字を共有する（まさ）。
- 杉浦先生が水処理の実験の動画を共有する。
- 設立時期（3月末の案）を関係者と詰める。大学には杉浦先生から早期事業化の利点を説明する。
- リアクターの通気を4〜5か所に増やし、来週頭に大型化・縦型化に向けた次の実験をする（杉浦先生）。

## ⚠️残課題
- 出資の額・条件と投資委員会の時期は未合意。
- 大学側は年度内（3月）の設立は難しいとしている。研究費の期間が終わる3月と設立日の間に、装置の改良費（数十万円）を残しておく必要がある。
- 装置の納品は、光を通すプラスチック部材の調達が遅れている。
- STSが採択されない場合は、ブリッジの調達が要る。$m$)
ON CONFLICT (meeting_id) DO UPDATE SET summary_short = EXCLUDED.summary_short, decided = EXCLUDED.decided, progress = EXCLUDED.progress,
  next_actions = EXCLUDED.next_actions, risks = EXCLUDED.risks, narrative_md = EXCLUDED.narrative_md, notion_url = EXCLUDED.notion_url,
  notion_page_id = EXCLUDED.notion_page_id, source_kinds = EXCLUDED.source_kinds, source_hash = EXCLUDED.source_hash, title = EXCLUDED.title,
  generated_by_model = EXCLUDED.generated_by_model, generated_at = NOW(), updated_at = NOW();

INSERT INTO meeting_minutes_backfill_ledger (calendar_event_id, project_id, title, meeting_start_at, meeting_end_at, status, attempt_count, max_attempts,
  first_detected_at, last_attempt_at, last_outcome, detected_by, notes, created_at, updated_at)
VALUES ($m$3klep1ffefhfskq3o75gnm9tp7$m$, 'p21', $m$SOL MTG いよぎん（伊予銀行・いよぎんキャピタル）$m$, TIMESTAMPTZ '2026-10-01 01:30:00+00', TIMESTAMPTZ '2026-10-01 02:30:00+00', 'recovered', 0, 5, NOW(), NOW(), 'backfilled_manually', 'manual',
  'Notionのローカル記録（要約と書き起こし）と Circleback の記録から手動でカードを作成（2026-10-03、migration 460）', NOW(), NOW())
ON CONFLICT (calendar_event_id) DO UPDATE SET status = 'recovered', last_outcome = 'backfilled_manually', notes = EXCLUDED.notes, updated_at = NOW();

UPDATE project_meeting_summaries SET summary_short = $m$ハタダ本社の排水処理設備を見学。COD・BODは基準内で、困りごとは油脂と窒素・リン（瀬戸内法の対象）。原水・油分解槽の後・最終放流水の3地点の排液サンプルと分析資料を受け取り、窒素・リン・CODの低減を確かめる。$m$, decided = $m$["原水・油分解槽の後・最終放流水の3地点の排液サンプル（各500mL）を受け取り、研究チームで窒素・リン・CODの低減を確かめる。", "社名は出さず「食品工場A」などで扱う。NDAの要否と結び方は、まさから相談する。", "油脂そのものではなく、油分解槽の後の液と窒素・リンの低減から検証する（既存の処理との併用が前提）。"]$m$::jsonb, progress = $m$["処理の流れ: 原水槽 → SSスクリーン → 油脂分解槽 → 曝気槽（活性汚泥）→ 沈殿槽 → 接触曝気 → 最終沈殿槽 → 放流。平成2年（1990年）築で、管理は髙橋さんがほぼ一人で担う。", "量と温度: 毎時5t（状態により3〜7t）× 約8時間で、1日約40t。流入は約40℃で、大半がお湯の洗浄水。", "規制: 排水量が49tを超えるため瀬戸内法の対象。COD・BODは基準の1/3〜1/5で問題ないが、窒素・リンの規制が厳しい。", "困りごと: 生クリームなどの油脂。冬（クリスマスケーキの時期）に処理が追いつかない。原水槽が約10tと小さく、浮いた油を取り切れない。洗剤由来の窒素・リン、大雨のときの雨水の流入（20〜30t増）も負担。", "かかっている費用: 油分解菌が1Lあたり3,000〜4,000円で月約20L、水質分析（西条環境分析センター）が年約50万円、産業廃棄物として出すと1tあたり数万円。油を手前で取る設備を入れると1,000万円以上。膜は交換と洗浄の手間が重く、現場としては勧めない。", "新居浜の工場ではあんこを作っており、小豆の研ぎ汁は熱くてBOD・CODが高い。タルトは松山の工場で作っている。"]$m$::jsonb,
  next_actions = $m$["研究チームが3地点のサンプルで、窒素・リン・CODの低減を確かめる（杉浦先生）。", "NDAの相談をハタダへ送る（まさ）。", "結果をもとに、油分解槽の後への適用、既存の処理との併用、追加のサンプルの要否を判断する。"]$m$::jsonb, risks = $m$["油脂が多い液では細胞が死ぬおそれがあり、油そのものへの効果は分からない。", "冬は油脂の負荷が上がり、水質が日によって変わる。1回のサンプルでは代表にならない可能性がある。", "設備が古く（約35年）、配管・コンクリート・地盤沈下の問題を抱えている。"]$m$::jsonb, narrative_md = $m$## 🎯背景
2026年10月2日の9:30〜10:30、新居浜のハタダ本社を訪問した（伊予銀行の紹介）。7月のオンライン面談に続く2回目で、排水処理の設備を見せてもらい、困りごととPoCの可能性を確かめることが目的。先方は管理技術部 施設管理課の髙橋さん、SOLからはまさ・杉浦先生・石原先生らが出席した。

## 📊経緯
杉浦先生が技術を説明した（CO2を使って増え、薬品も冷却も要らない、雑菌が入りにくい、重金属はおよそ30分・色素は数時間、食品工場の排液でCODが2,000超から500程度まで下がった例）。髙橋さんからは処理の流れと分析資料の説明があった。処理は原水槽からSSスクリーン、油脂分解槽、活性汚泥の曝気槽、沈殿槽を経て、接触曝気と最終沈殿槽で仕上げる多段の構成で、毎時5t前後を約8時間、1日約40tを処理している。流入は約40℃で、大半がお湯の洗浄水。排水量が49tを超えるため瀬戸内法の対象で、COD・BODは基準の1/3〜1/5と問題ないが、窒素・リンの規制が厳しく、いちばん気を使っているところだという。最大の困りごとは生クリームなどの油脂で、市販の油分解菌（1L 3,000〜4,000円を月約20L）を入れているが、冬のクリスマスケーキの時期には追いつかない。原水槽が約10tと小さく浮いた油を取り切れないこと、洗剤由来の窒素・リン、大雨の雨水の流入、約35年たった設備の傷みも挙がった。膜処理は交換と洗浄の手間が重く、現場としては勧めないという意見だった。杉浦先生は、油そのものは得意ではなく細胞が死ぬおそれもあるので、油分解槽の後の液と窒素・リンから試すのが現実的だと答えた。最後に、3地点の排液サンプルと分析資料のコピーを受け取った。

## ✅決まったこと
- 原水・油分解槽の後・最終放流水の3地点の排液サンプル（各500mL）を受け取り、研究チームで窒素・リン・CODの低減を確かめる。
- 社名は出さず「食品工場A」などで扱う。NDAの要否と結び方は、まさから相談する。
- 油脂そのものではなく、油分解槽の後の液と窒素・リンの低減から検証する（既存の処理との併用が前提）。

## ▶️次の一手
- 研究チームが3地点のサンプルで、窒素・リン・CODの低減を確かめる（杉浦先生）。
- NDAの相談をハタダへ送る（まさ）。
- 結果をもとに、油分解槽の後への適用、既存の処理との併用、追加のサンプルの要否を判断する。

## ⚠️残課題
- 油脂が多い液では細胞が死ぬおそれがあり、油そのものへの効果は分からない。
- 冬は油脂の負荷が上がり、水質が日によって変わる。1回のサンプルでは代表にならない可能性がある。
- 設備が古く（約35年）、配管・コンクリート・地盤沈下の問題を抱えている。$m$, notion_url = $m$https://app.notion.com/p/3ed97749c60881f4913ff12e25bc6e53$m$,
  notion_page_id = $m$3ed97749-c608-81f4-913f-f12e25bc6e53$m$, source_kinds = $m$notion-local+gmail+calendar$m$, generated_by_model = 'manual-amie-2026-10-03', generated_at = NOW(), updated_at = NOW()
WHERE meeting_id = $m$1j8p80v0ub5jpg6fnudkmie1c8$m$ AND project_id = 'p21';

UPDATE project_meeting_summaries SET summary_short = $m$日泉化学（プラスチックの加工）を訪問。工程から出る水は金型を冷やす冷却水のあふれ分だけで、重金属・色素を含まず、PoCの対象外と分かった。顧客の自動車会社からCO2削減のロードマップを求められ、スコープ3の報告も始まりつつある。$m$, decided = $m$["日泉化学の排水はPoCの対象にしない（重金属・色素を含む工程排水がない）。", "プラスチックの加工業は対象外で、触媒を使う原材料の製造の側が対象になりうると、探索の方針に反映する。"]$m$::jsonb, progress = $m$["事業: 射出成形・押出成形によるプラスチックの加工（ペレットを溶かして成形）。愛媛では新居浜工場（射出成形）、ニッセンポリテック（大洲・長浜。シート、フィルム、ゴミ袋）、西条工場。県外に三重・埼玉・滋賀。トラックの泥除け（シェアが高い）、冷凍食品のトレーなど。", "排水: 工程の水は金型を冷やす冷却水で、基本は循環。クーリングタワーのあふれ分がグリストラップを通って出るだけで、量も測っていない。水は水道水（昔は住友化学から工業用水を分けてもらっていた）。", "サステナビリティ: 自動車（ホンダ）が最も厳しく、CO2削減のロードマップを求められている。家電（ダイキン）は自動車業界に追随する姿勢。スコープ3の報告を一部の顧客から求められ始めた。今はスコープ1・2をExcelで管理し、設備の更新・無駄取り・サーボモーター化で対応できているが、いずれ頭打ちになると見ている。", "新しい技術を外から取り入れる具体的な計画は、今のところない。"]$m$::jsonb,
  next_actions = $m$["排液を出す業種の探索を、重金属・色素・分解しにくい物を含む工程（原材料の製造など）へ寄せる。", "日泉化学とは、CO2削減の情報交換先としてつながりを保つ。"]$m$::jsonb, risks = $m$["CO2削減は工場全体で求められており、排水処理を買う理由にはなりにくい。"]$m$::jsonb, narrative_md = $m$## 🎯背景
2026年10月2日の11:00〜、新居浜のテクノセンター新居浜内にある日泉化学を訪問した。伊予銀行の紹介で、工場排水のサンプル提供を打診していた先で、石原先生が9/30に日程を調整した。先方は目黒さん、SOLからはまさ・杉浦先生・石原先生・中島先生が出席した。

## 📊経緯
杉浦先生が技術を、まさが事業化の計画（来年4月1日の設立、自社で菌を作ってカートリッジで届ける形、回収した金属の再販、将来のバイオ燃料）を説明した。先方は事前に愛媛県内の工場の排水を確かめてくれていて、どの拠点も工程から出る水は金型を冷やす冷却水のあふれ分だけで、重金属も色もないと説明があった。プラスチックを作る段階では触媒を使うので特殊な排液が出るが、同社は出来上がったペレットを買って加工する側なので、そうした排液はない。続いてサステナビリティへの圧力を聞いた。顧客によって温度差があり、自動車（ホンダ）が最も厳しく、工場ごとのCO2削減のロードマップと管理を求められている。家電のダイキンは自動車業界を横目で見ながら追随する姿勢。スコープ3の報告も一部の顧客から求められ始めたが、今はスコープ1・2をExcelで管理し、設備の更新や無駄取りで当面のロードマップは達成できる見込みだという。新しい技術を外から取り入れる具体的な計画はまだない。SOLにとっては、加工業と原材料の製造で排水が大きく違うことが分かった訪問だった。

## ✅決まったこと
- 日泉化学の排水はPoCの対象にしない（重金属・色素を含む工程排水がない）。
- プラスチックの加工業は対象外で、触媒を使う原材料の製造の側が対象になりうると、探索の方針に反映する。

## ▶️次の一手
- 排液を出す業種の探索を、重金属・色素・分解しにくい物を含む工程（原材料の製造など）へ寄せる。
- 日泉化学とは、CO2削減の情報交換先としてつながりを保つ。

## ⚠️残課題
- CO2削減は工場全体で求められており、排水処理を買う理由にはなりにくい。$m$, notion_url = $m$https://app.notion.com/p/3ed97749c608817a90c3ea8f87a329af$m$,
  notion_page_id = $m$3ed97749-c608-817a-90c3-ea8f87a329af$m$, source_kinds = $m$notion-local+gmail+calendar$m$, generated_by_model = 'manual-amie-2026-10-03', generated_at = NOW(), updated_at = NOW()
WHERE meeting_id = $m$ll8auiqe0rkb7uk9t9bd7psl9s$m$ AND project_id = 'p21';

UPDATE project_meeting_summaries SET summary_short = $m$住友金属鉱山 別子事業所を訪問。工場の廃液（ニッケル系の電池材料。ニッケル・銅・アルミが混ざる、毎分3〜4m³）と、旧別子銅山の湧き水（毎分4〜5m³、薄くて冷たい）の2系統のサンプルを依頼した。提供できるかは事業部門が判断し、断る可能性もある。実用化には、今の排水処理と比べた処理量・速度・容量を示すことが前提と言われた。$m$, decided = $m$["先方が事業部門に、工場の廃液と旧別子銅山の湧き水のサンプル・データの提供可否を確認する。断る可能性もある。", "提供できる場合は、NDAを結んでからデータとサンプル（500mL程度）を受け取る。", "評価には、中和剤を入れる前の液が要る。", "問い合わせは4名全員宛てのメールで送る（技術は杉浦先生、NDAは石原先生）。"]$m$::jsonb, progress = $m$["工場: 非鉄の製錬で、ニッケル系をベースにした車載電池の材料を作っている。廃液はニッケル・銅・アルミが混ざったものを1系統で処理し、pHを調整して沈殿させ、上澄みを流す。量は毎分3〜4m³（冷却水を含む）で、昼は人が動かし、夜は自動運転。", "廃液の中身: 溶媒抽出の工程から有機溶媒が混ざる（活性炭などで前処理）。CODは高め、窒素・リンも含む。中和剤（苛性ソーダなど）を入れるので、ナトリウムが多い可能性がある。", "旧別子銅山: 約270年の歴史があり、約50年前に休止。湧き水は毎分4〜5m³で、工場より量が多く濃度は薄い。安全環境センターの旧廃止鉱山のグループが処理している。", "先方の見方: 評価だけなら結果は出せそうだが、実用化には、今ある排水処理に対して処理量・速度・容量がどうかを示すことが前提。", "排水処理のコスト削減やCO2削減を求められてはいない。研究開発の技術本部は大学との連携の実績があるが、スタートアップとの協業は多くない。", "杉浦先生の回答: ニッケルは取り込むが、銅・アルミがあると先に銅・アルミを取り込み、ニッケルは最後になる。海水並み（約3.4%）の塩分では働かない。菌の量は今の約100倍まで増やせる見込み。10〜20℃では働きが落ち、取り込みの低温のデータはまだない。"]$m$::jsonb,
  next_actions = $m$["先方が事業部門に確認し、提供可否を連絡する（住友金属鉱山）。", "提供が決まったら、NDAと評価の条件を詰める（まさ・石原先生）。", "冷たい湧き水を想定して、低温での取り込みを確かめる（研究チーム）。", "既存の排水処理と比べた処理量・速度・容量を示せる形を考える。"]$m$::jsonb, risks = $m$["事業部門の判断で、提供を見送られる可能性がある。", "工場の規模（毎分3〜4m³）に対して、カートリッジの速度・容量・菌の量が足りるかは分からない。", "ナトリウム・有機溶媒・低温など、働きを落とす条件の実データがない。"]$m$::jsonb, narrative_md = $m$## 🎯背景
2026年10月2日の14:00〜15:00、新居浜の住友金属鉱山 別子事業所を訪問した（伊予銀行の紹介）。目的は、技術を説明し、工場の廃液と旧別子銅山の湧き水のサンプル提供をお願いすること。先方は総務センター（総務・人事・資材・会計）の方と安全環境センターの方（東前さん・松下さん・松木さん）、SOLからはまさ・杉浦先生・石原先生らが出席した。

## 📊経緯
杉浦先生が、高熱性のシアノバクテリアがCO2を使って増え、薬品を使わずに重金属を細胞に取り込むこと、90℃近くまで働くので冷やさなくてよいこと、既存の設備に後付けするカートリッジにすることを説明し、まさが事業化の計画を説明した。先方からは工場の排水の説明があった。ニッケル系の電池材料を作る工程の廃液は、ニッケル・銅・アルミが混ざったものを1系統で中和・沈殿させ、量は冷却水を含めて毎分3〜4m³。溶媒抽出の有機溶媒も混ざる。さらに、約50年前に休止した旧別子銅山から出る湧き水も事業所で処理しており、量は毎分4〜5m³と多く、濃度は薄い。先方は、評価だけなら結果は出せそうだが、実用化には今ある排水処理に対して処理量・速度・容量がどうかを示すことが基準になると指摘した。SOLは塩分の影響を説明し、中和剤を入れた後の液ではナトリウムが多くて菌が働かないおそれがあるので、中和の前の液が要ると伝えた。先方からは、取り込んだ金属は細胞に溜まるのか、データはバッチ式か、菌の量と速さの関係、勝手に増えるのか、10〜20℃でも働くのか、といった質問が出た。最後に、提供できるかは事業部門が判断し、断る可能性もあると明言された。

## ✅決まったこと
- 先方が事業部門に、工場の廃液と旧別子銅山の湧き水のサンプル・データの提供可否を確認する。断る可能性もある。
- 提供できる場合は、NDAを結んでからデータとサンプル（500mL程度）を受け取る。
- 評価には、中和剤を入れる前の液が要る。
- 問い合わせは4名全員宛てのメールで送る（技術は杉浦先生、NDAは石原先生）。

## ▶️次の一手
- 先方が事業部門に確認し、提供可否を連絡する（住友金属鉱山）。
- 提供が決まったら、NDAと評価の条件を詰める（まさ・石原先生）。
- 冷たい湧き水を想定して、低温での取り込みを確かめる（研究チーム）。
- 既存の排水処理と比べた処理量・速度・容量を示せる形を考える。

## ⚠️残課題
- 事業部門の判断で、提供を見送られる可能性がある。
- 工場の規模（毎分3〜4m³）に対して、カートリッジの速度・容量・菌の量が足りるかは分からない。
- ナトリウム・有機溶媒・低温など、働きを落とす条件の実データがない。$m$, notion_url = $m$https://app.notion.com/p/3ed97749c60881388f1fcbaf809743b6$m$,
  notion_page_id = $m$3ed97749-c608-8138-8f1f-cbaf809743b6$m$, source_kinds = $m$notion-local+gmail+calendar$m$, generated_by_model = 'manual-amie-2026-10-03', generated_at = NOW(), updated_at = NOW()
WHERE meeting_id = $m$ufec8kv8ou32rkf155o7vv6nk4$m$ AND project_id = 'p21';

UPDATE project_meeting_summaries SET summary_short = $m$アドバンテック愛媛本社を訪問（eウェーブの前田社長が同席）。対象は木質素研究所の改質リグニンの量産実証プラント（愛媛県鬼北町）の排液で、1番絞りはCOD約11万mg/L、2番絞りはCOD 3,800〜5,000mg/Lで1日約120t。前例のない排液で、先方はサンプル提供を申し出た。NDAを結んでから評価に進み、会社の設立後に排水処理の開発を会社として受ける形も検討する。$m$, decided = $m$["NDAを結んだうえで、1番絞り・2番絞りの排液サンプルの評価（水質分析・凝集テスト・処理の可否）に進む（10/2 まさからNDAの締結をお願いした）。", "会社の設立後に、排水処理の開発を会社として受ける形を検討する。"]$m$::jsonb, progress = $m$["アドバンテック: 設立約30年、従業員約700名、売上約500億円。半導体製造装置向けの真空配管・プロセスガス配管が主力で、評価用のテストウェハーは世界シェア1位。スパッタリングターゲット、レアメタルの加工品、再生可能エネルギー（西条のいとまち）も手がける。", "木質素研究所: 改質リグニンを社会に出すためのスタートアップで、アドバンテックが資本ではなく、プラントの設計・装置の調達・販売（総代理店）で全面的に支える。CTOは開発者の山田博士（元・森林総合研究所）。国産のスギだけを原料に、PEGで改質して粉末にする（スギ1tから約300kg）。薬剤と木粉は1:1（リグノマテリアの旧方式は5:1）。", "量産実証: 愛媛県鬼北町に年1,000t規模のプラントを建てる。農水省のSBIRで約22億円、建屋・木粉の加工工場・小型バイオマス発電は地域未来交付金（町が申請）を使う。豊田合成のウレタン部品で採用実績があり、東京エレクトロンなど装置メーカーにも提案している。", "排液: 1番絞りはCOD約11万mg/Lで処理は現実的でなく、PEGを回収して使い回すことを検討中（未確立）。2番絞り（洗浄水）はCOD 3,800〜5,000mg/Lで1日約120t、これが処理の対象。計画はスクリーン → pH調整 → 加圧浮上 → 流量調整 → MBR → 活性炭で、栗田工業と設計している。BOD約1,000に対してCOD約3,500と生物で分解しにくく、通常の活性汚泥では栄養塩を足す必要がある。カビが生えるので、生物での分解はできる。ジオキサンが副生する可能性がある。", "eウェーブ: アドバンテックの酸洗い排水（ステンレスの溶接焼けを酸で取る工程。フッ素が多い）を担当し、凝集沈殿（PAC）と石灰系のアルカリ剤で処理している。薬品が値上がりしており、代わりになる方法を求めている。", "杉浦先生の見解: 処理だけなら光は室内灯程度で足りる。培養は別の槽で行い、できた菌をMBRの槽に入れる形が考えられる。高分子のリグニンを直接取り込むのは難しいが、分解されて糖になった状態なら処理に入れる。ジオキサンは試したことがない。"]$m$::jsonb,
  next_actions = $m$["NDAを結ぶ（アドバンテックの返答待ち）。", "NDAの後、1番絞り・2番絞りのサンプルで水質分析・凝集テスト・処理の可否を確かめる（研究チーム）。", "会社の設立後に排水処理の開発を受ける形と、その資金（SBIRの対象外）を検討する（まさ）。"]$m$::jsonb, risks = $m$["改質リグニンの排液は前例がなく、処理できるかは実サンプルで確かめるまで分からない。", "排水処理の開発は農水省SBIRの対象外で、別の資金が要る。", "1番絞りは濃すぎるため、処理ではなくPEGの回収・精製の工程に入れる形になる。"]$m$::jsonb, narrative_md = $m$## 🎯背景
2026年10月2日の16:00〜17:00、西条のアドバンテック愛媛本社を訪問した。伊予銀行の玉井さん（地域創生部）の紹介で、木質素研究所の改質リグニン事業がPoCの相手を探していることが発端。先方はアドバンテックの福島さんら、アドバンテックの排水処理を担当するeウェーブの前田社長が同席した。SOLからはまさ・杉浦先生・石原先生・中島先生が出席した。

## 📊経緯
まず先方から会社と事業の説明があった。アドバンテックは半導体製造装置の部品（真空配管・プロセスガス配管）が主力で、テストウェハーは世界シェア1位。3年ほど前に改質リグニンに出会い、木質素研究所を資本ではなく設計・調達・販売で全面的に支えている。愛媛県鬼北町に年1,000t規模の量産実証プラントを建て、農水省SBIR（約22億円）と地域未来交付金を使う。排液は2種類で、1番絞りはCOD約11万mg/Lと濃すぎるためPEGを回収して使い回す方向、2番絞りの洗浄水（COD 3,800〜5,000mg/L、1日約120t）が処理の対象。計画はスクリーン・pH調整・加圧浮上・流量調整・MBR・活性炭で、栗田工業と設計しているが、BODに比べてCODが高く、栄養塩を足さないと活性汚泥が育たない。前例がなく、どこに頼んでも未知の排液だという。eウェーブの前田社長からは、アドバンテックの酸洗い排水（フッ素が多い）の処理と、薬品の値上がりで代わりの方法を求めていることが話された。SOLからは、処理は室内灯程度の光で足りること、培養は別の槽で行い菌をMBRの槽に入れる形がありうること、PEGの回収工程で不純物を取る使い方もありうることを伝えた。先方はサンプル提供を申し出て、全国にプラントを広げたいので排液の問題を解決してほしいという期待を示した。

## ✅決まったこと
- NDAを結んだうえで、1番絞り・2番絞りの排液サンプルの評価（水質分析・凝集テスト・処理の可否）に進む（10/2 まさからNDAの締結をお願いした）。
- 会社の設立後に、排水処理の開発を会社として受ける形を検討する。

## ▶️次の一手
- NDAを結ぶ（アドバンテックの返答待ち）。
- NDAの後、1番絞り・2番絞りのサンプルで水質分析・凝集テスト・処理の可否を確かめる（研究チーム）。
- 会社の設立後に排水処理の開発を受ける形と、その資金（SBIRの対象外）を検討する（まさ）。

## ⚠️残課題
- 改質リグニンの排液は前例がなく、処理できるかは実サンプルで確かめるまで分からない。
- 排水処理の開発は農水省SBIRの対象外で、別の資金が要る。
- 1番絞りは濃すぎるため、処理ではなくPEGの回収・精製の工程に入れる形になる。$m$, notion_url = $m$https://app.notion.com/p/3ed97749c60881b2a1dbce143b19547a$m$,
  notion_page_id = $m$3ed97749-c608-81b2-a1db-ce143b19547a$m$, source_kinds = $m$notion-local+gmail+calendar$m$, generated_by_model = 'manual-amie-2026-10-03', generated_at = NOW(), updated_at = NOW()
WHERE meeting_id = $m$s1aggb976i1s6uquulapjue4bk$m$ AND project_id = 'p21';

INSERT INTO meeting_minutes_backfill_ledger (calendar_event_id, project_id, title, meeting_start_at, meeting_end_at, status, attempt_count, max_attempts,
  first_detected_at, last_attempt_at, last_outcome, detected_by, notes, created_at, updated_at)
VALUES ('ek9vt9m86fq8396aajpr94639s', 'p21', 'SX MTG 愛知時計電機（今治第1工場）', TIMESTAMPTZ '2026-10-01 05:30:00+00', TIMESTAMPTZ '2026-10-01 06:30:00+00', 'no_material', 0, 5, NOW(), NOW(), 'no_material_confirmed', 'manual',
  '録音は最後の数分だけ。工業排水が出ておらず協業の余地がないと分かっただけなので、カードは作らず関係先にだけ残す（まさ 2026-10-03、migration 460）', NOW(), NOW())
ON CONFLICT (calendar_event_id) DO UPDATE SET status = 'no_material', last_outcome = EXCLUDED.last_outcome, notes = EXCLUDED.notes, updated_at = NOW();

UPDATE project_management_partners SET owner_label = $m$まさ$m$, last_verified_at = DATE '2026-10-03', source_kind = $m$manual$m$, next_meeting_on = NULL, next_meeting_time = NULL, next_meeting_mode = NULL, next_meeting_place = NULL, next_meeting_prep = NULL, next_meeting_goal = NULL, relationship_stage = $m$executing$m$, agreement_state = $m$partial$m$, activity_state = $m$active$m$, agreed_scope = $m$SolvioraXのPoC候補企業の紹介と接続。ハタダ・日泉化学・住友金属鉱山・アドバンテック（地域創生部の玉井さん経由）への訪問を仲介した（2026-10-01〜02）。SIERでは、排液を出す企業への働きかけ役を期待している（2026-10-01 面談）。$m$, unagreed_scope = $m$SIERへの参画の形とMOUの中身。$m$, next_commitment = $m$SIERの参画とMOUの形を詰める。紹介先との進み具合を共有する。$m$, current_ball_side = $m$shared$m$, current_ball_owner = $m$まさ・伊予銀行$m$, due_date = NULL, due_date_precision = $m$unknown$m$, last_contact_date = DATE '2026-10-01', target_state = $m$SIERに参画し、紹介先の企業とのPoCが進んでいる状態$m$, source_ref = $m$2026-10-01 いよぎん面談（Notion書き起こし・Circleback）／2026-10-01〜02 愛媛訪問$m$, updated_at = NOW() WHERE project_id = 'p21' AND slug = $m$iyo-bank$m$ AND deleted_at IS NULL;

UPDATE project_management_partners SET owner_label = $m$まさ$m$, last_verified_at = DATE '2026-10-03', source_kind = $m$manual$m$, relationship_stage = $m$condition_alignment$m$, agreement_state = $m$partial$m$, activity_state = $m$waiting_partner$m$, agreed_scope = $m$会社の設立前から出資の検討（DD）を始める。NDAはチームアルマダを当事者に結ぶ（10/2 ひな形を受領し、まさがチームアルマダ名義の修正案と事業概要資料・SIERのパンフレットを返送）。出資は設立する会社へ直接。DDを経て承認されれば1か月程度で出資まで進められ、3月中に投資委員会を通れば翌月に出資できる見込み（2026-10-01 面談）。$m$, unagreed_scope = $m$NDAの締結、投資委員会の時期、出資の額と条件。$m$, next_commitment = $m$NDAの修正案への返答を受けて締結し、DDの資料（コスト試算の詳細、事業領域と市場規模、シリーズBまでの月次計画）を共有する。$m$, current_ball_side = $m$partner$m$, current_ball_owner = $m$いよぎんキャピタル（高瀨さん）$m$, last_contact_date = DATE '2026-10-02', due_date = NULL, due_date_precision = $m$unknown$m$, target_state = $m$NDAを結び、DDを経て投資委員会で出資を判断してもらえる状態$m$, source_ref = $m$2026-10-01 いよぎん面談（Notion書き起こし・Circleback）／2026-10-02 メール（NDAひな形の受領と修正案の返送）$m$, updated_at = NOW() WHERE project_id = 'p21' AND slug = $m$iyogin-capital$m$ AND deleted_at IS NULL;

UPDATE project_management_partners SET owner_label = $m$まさ$m$, last_verified_at = DATE '2026-10-03', source_kind = $m$manual$m$, next_meeting_on = NULL, next_meeting_time = NULL, next_meeting_mode = NULL, next_meeting_place = NULL, next_meeting_prep = NULL, next_meeting_goal = NULL, relationship_stage = $m$on_hold$m$, agreement_state = $m$unagreed$m$, activity_state = $m$dropped$m$, agreed_scope = $m$2026-10-01に今治第1工場（アイセイテック）を訪問。水道メーター・ガスメーターの工場で、工業排水は出ておらず、協業の余地はないと分かった。$m$, unagreed_scope = $m$なし$m$, next_commitment = $m$追わない。$m$, current_ball_side = $m$none$m$, current_ball_owner = NULL, due_date = NULL, due_date_precision = $m$unknown$m$, last_contact_date = DATE '2026-10-01', poc_grade = $m$x$m$, poc_likelihood = $m$low$m$, customer_value = $m$low$m$, source_ref = $m$2026-10-01 SX MTG 愛知時計電機（Notionのメモ「特に工業排水は出ていない」）$m$, updated_at = NOW() WHERE project_id = 'p21' AND slug = $m$aichi-tokei$m$ AND deleted_at IS NULL;

UPDATE project_management_partners SET owner_label = $m$まさ$m$, last_verified_at = DATE '2026-10-03', source_kind = $m$manual$m$, next_meeting_on = NULL, next_meeting_time = NULL, next_meeting_mode = NULL, next_meeting_place = NULL, next_meeting_prep = NULL, next_meeting_goal = NULL, relationship_stage = $m$validation_preparation$m$, agreement_state = $m$partial$m$, activity_state = $m$active$m$, agreed_scope = $m$2026-10-02に本社の排水処理設備を見学し、原水・油分解槽の後・最終放流水の3地点の排液サンプル（各500mL）と分析資料（計量証明書）のコピーを受け取った。社名は出さず「食品工場A」などで扱う。窒素・リン・CODの低減を主に見る。$m$, unagreed_scope = $m$NDAの要否と結び方、結果の返し方、PoCの範囲。$m$, next_commitment = $m$研究チームが3地点のサンプルで窒素・リン・CODの低減を確かめる。NDAの相談をまさから送る。$m$, current_ball_side = $m$sx$m$, current_ball_owner = $m$研究チーム（杉浦先生）・まさ$m$, due_date = NULL, due_date_precision = $m$unknown$m$, last_contact_date = DATE '2026-10-02', effluent_procured = true, effluent_volume_annual = $m$約40t/日（毎時5t前後×約8時間）$m$, effluent_cost_annual = $m$油分解菌 月6〜8万円（1L 3,000〜4,000円×月約20L）、水質分析 年約50万円$m$, effluent_note = $m$油分（原水のノルマルヘキサン37）、BOD 8.3×10²・COD 4.2×10²。放流水はBOD 0.7・COD 7.5・SS 4・窒素17・リン2.6。重金属の話は出ていない。流入は約40℃で大半がお湯の洗浄水。瀬戸内法の対象（49t超）で窒素・リンの規制が厳しい。冬（クリスマスケーキの時期）に油脂で悪化。原水槽は約10t。2026-10-02に3地点のサンプルと計量証明書のコピーを受領。$m$, source_ref = $m$2026-10-02 SOL MTG ハタダ（Notion書き起こし）／2026-10-02 お礼メール$m$, updated_at = NOW() WHERE project_id = 'p21' AND slug = $m$poc-talk-07-x$m$ AND deleted_at IS NULL;

UPDATE project_management_partners SET owner_label = $m$まさ$m$, last_verified_at = DATE '2026-10-03', source_kind = $m$manual$m$, next_meeting_on = NULL, next_meeting_time = NULL, next_meeting_mode = NULL, next_meeting_place = NULL, next_meeting_prep = NULL, next_meeting_goal = NULL, relationship_stage = $m$on_hold$m$, agreement_state = $m$unagreed$m$, activity_state = $m$on_hold$m$, agreed_scope = $m$2026-10-02に訪問（伊予銀行の紹介、石原先生が調整）。射出成形・押出成形の加工業で、工程から出る水は金型を冷やす冷却水のあふれ分だけ。重金属・色素を含まず、PoCの対象外。顧客の自動車会社からCO2削減のロードマップを求められ、スコープ3の報告も始まりつつある。$m$, unagreed_scope = $m$なし$m$, next_commitment = $m$PoCの対象外。CO2削減の情報交換先としてつながりを保つ。$m$, current_ball_side = $m$none$m$, current_ball_owner = NULL, due_date = NULL, due_date_precision = $m$unknown$m$, last_contact_date = DATE '2026-10-02', poc_grade = $m$x$m$, poc_likelihood = $m$low$m$, introducer_label = $m$伊予銀行$m$, role_label = $m$情報交換先（PoCの対象外）$m$, source_ref = $m$2026-10-02 SOL MTG 日泉化学（Notion書き起こし）／2026-10-02 お礼メール$m$, updated_at = NOW() WHERE project_id = 'p21' AND slug = $m$weekly-partner-mspfqqja$m$ AND deleted_at IS NULL;

UPDATE project_management_partners SET owner_label = $m$まさ$m$, last_verified_at = DATE '2026-10-03', source_kind = $m$manual$m$, next_meeting_on = NULL, next_meeting_time = NULL, next_meeting_mode = NULL, next_meeting_place = NULL, next_meeting_prep = NULL, next_meeting_goal = NULL, relationship_stage = $m$condition_alignment$m$, agreement_state = $m$partial$m$, activity_state = $m$waiting_partner$m$, agreed_scope = $m$2026-10-02に別子事業所を訪問（総務センター・安全環境センター）。工場の廃液（ニッケル系の電池材料。ニッケル・銅・アルミが混ざる。中和して沈殿、毎分3〜4m³）と、旧別子銅山の湧き水（毎分4〜5m³、薄くて冷たい）の2系統のサンプルとデータをお願いした。提供できる場合はNDAを結んでから受け取る。$m$, unagreed_scope = $m$サンプルとデータの提供可否（事業部門が判断。断る可能性もあると明言）、NDA、評価の条件。$m$, next_commitment = $m$先方が事業部門に確認する。提供できるならNDAを結び、中和剤を入れる前の液とデータ（500mL程度）を受け取る。$m$, current_ball_side = $m$partner$m$, current_ball_owner = $m$住友金属鉱山（事業部門）$m$, due_date = NULL, due_date_precision = $m$unknown$m$, last_contact_date = DATE '2026-10-02', effluent_components = $m$ニッケル、銅、アルミ、有機溶媒、COD、窒素、リン、ナトリウム（中和剤由来）$m$, effluent_volume_annual = $m$工場 毎分3〜4m³（冷却水を含む）／旧別子銅山の湧き水 毎分4〜5m³$m$, effluent_note = $m$中和剤（苛性ソーダなど）を入れた後の液はナトリウムが多く菌が働かないおそれがあるため、中和の前の液で評価する。溶媒抽出の有機溶媒が混ざる（活性炭で前処理）。排水処理のコスト削減やCO2削減は求められていない。実用化には、今ある排水処理と比べた処理量・速度・容量を示すことが前提。$m$, source_ref = $m$2026-10-02 SOL MTG 住友金属鉱山 別子事業所（Notion書き起こし）／2026-10-02 お礼メール$m$, updated_at = NOW() WHERE project_id = 'p21' AND slug = $m$poc-talk-10-x$m$ AND deleted_at IS NULL;

UPDATE project_management_partners SET owner_label = $m$まさ$m$, last_verified_at = DATE '2026-10-03', source_kind = $m$manual$m$, next_meeting_on = NULL, next_meeting_time = NULL, next_meeting_mode = NULL, next_meeting_place = NULL, next_meeting_prep = NULL, next_meeting_goal = NULL, relationship_stage = $m$condition_alignment$m$, agreement_state = $m$partial$m$, activity_state = $m$waiting_partner$m$, role_label = $m$排液の提供候補・技術協力（改質リグニンの量産実証）$m$, agreed_scope = $m$2026-10-02に愛媛本社を訪問（eウェーブの前田社長が同席）。対象は木質素研究所の改質リグニンの量産実証プラント（愛媛県鬼北町）の排液で、1番絞り（COD約11万mg/L）と2番絞り（洗浄水、COD 3,800〜5,000mg/L、1日約120t）。先方はサンプル提供を申し出た。NDAを結んでからサンプルの評価に進む（10/2 まさからNDAの締結をお願いした）。$m$, unagreed_scope = $m$NDA、評価の方法と処理の条件、会社の設立後に排水処理の開発を会社として受ける形、その資金（排水処理の開発は農水省SBIRの対象外）。$m$, next_commitment = $m$NDAを結び、1番絞り・2番絞りのサンプルで水質分析・凝集テスト・処理の可否を確かめる。$m$, current_ball_side = $m$partner$m$, current_ball_owner = $m$アドバンテック（福島さん）$m$, due_date = NULL, due_date_precision = $m$unknown$m$, last_contact_date = DATE '2026-10-02', classifications = ARRAY[$m$tech_partner$m$,$m$sample_provider$m$,$m$poc_candidate$m$]::text[], effluent_components = $m$改質リグニンの製造排液（PEG・グリセリン・木粉に由来。CODが高い）$m$, effluent_volume_annual = $m$2番絞り 約120t/日（計画）$m$, effluent_note = $m$1番絞りはCOD約11万mg/LでPEGの回収・再利用を検討中。2番絞りはBOD約1,000に対してCOD約3,500で、活性汚泥には栄養塩を足す必要がある。計画はスクリーン→pH調整→加圧浮上→流量調整→MBR→活性炭（栗田工業と設計）。ジオキサンが副生する可能性がある。$m$, source_ref = $m$2026-10-02 SOL MTG アドバンテック愛媛本社（Notion書き起こし）／2026-10-02 お礼メール（NDA締結のお願い）$m$, updated_at = NOW() WHERE project_id = 'p21' AND slug = $m$advantech$m$ AND deleted_at IS NULL;

UPDATE project_management_partners SET owner_label = $m$まさ$m$, last_verified_at = DATE '2026-10-03', agreed_scope = $m$情報交換中。1億円規模での出資を検討していると聞いている（2026-10-01 いよぎん面談でまさが説明）。$m$, source_ref = $m$2026-10-01 いよぎん面談（Notion書き起こし・Circleback）$m$, updated_at = NOW() WHERE project_id = 'p21' AND slug = $m$partners-fund$m$ AND deleted_at IS NULL;

UPDATE project_management_partners SET owner_label = $m$まさ$m$, last_verified_at = DATE '2026-10-03', next_commitment = $m$10/15に東京（東日本橋）で対面し、正式にDDを始めてもらう。$m$, next_meeting_on = DATE '2026-10-15', next_meeting_time = $m$10:30$m$, next_meeting_mode = $m$onsite$m$, next_meeting_place = $m$東京（東日本橋）$m$, source_ref = $m$2026-10-01 いよぎん面談（書き起こしの「コリブス」「ホリグス」は堀淵さん）／カレンダー 10/15 sol mtg DAVP@東京$m$, updated_at = NOW() WHERE project_id = 'p21' AND slug = $m$davp$m$ AND deleted_at IS NULL;

INSERT INTO project_management_partners (
  project_id, slug, name, role_label, primary_track, relationship_stage, agreement_state, agreed_scope, unagreed_scope,
  last_contact_date, next_commitment, owner_label, last_verified_at, confidence, source_kind, source_ref, sort_order,
  current_ball_side, current_ball_owner, target_state, activity_state, classifications, introducer_label, due_date_precision, poc_category,
  effluent_components, effluent_volume_annual, effluent_note
)
SELECT 'p21', v.slug, v.name, v.role_label, 'business_development', v.stage, v.agreement, v.agreed, v.unagreed,
  DATE '2026-10-02', v.next_commitment, 'まさ', DATE '2026-10-03', 'medium', 'manual', v.source_ref, v.sort_order,
  v.ball_side, v.ball_owner, v.target_state, v.activity, v.classifications::text[], v.introducer, 'unknown', v.poc_category,
  v.eff_components, v.eff_volume, v.eff_note
FROM (VALUES

  ($m$mokushitsuso-lignin-lab$m$, $m$木質素研究所（リグニンラボ）$m$, $m$排液の提供候補（改質リグニンの量産実証プラント）$m$, $m$condition_alignment$m$, $m$partial$m$, $m$改質リグニンを社会に出すためのスタートアップ。アドバンテックが資本ではなく、プラントの設計・装置の調達・販売（総代理店）で全面的に支える。CTOは開発者の山田博士（元・森林総合研究所）。愛媛県鬼北町に年1,000t規模の量産実証プラントを建て、農水省SBIR（約22億円）と地域未来交付金を使う。排水設備は栗田工業と設計中。2026-10-02 アドバンテック愛媛本社での面談で説明を受けた。$m$, $m$NDA、サンプルの評価、排水処理の開発の受け方と資金。窓口はアドバンテックと同じ。$m$, $m$アドバンテックとNDAを結び、1番絞り・2番絞りのサンプルを評価する。$m$, $m$2026-10-02 SOL MTG アドバンテック愛媛本社（Notion書き起こし。「記憶帳」「紀北町」は愛媛県鬼北町と判断）$m$, 145, $m$partner$m$, $m$アドバンテック（福島さん）$m$, $m$改質リグニンの排液でPoCを始められる状態$m$, $m$waiting_partner$m$, $m${sample_provider,poc_candidate}$m$, $m$伊予銀行$m$, $m$poc_candidate$m$, $m$改質リグニンの製造排液（PEG・グリセリン・木粉に由来）$m$, $m$2番絞り 約120t/日（計画）$m$, $m$1番絞り COD約11万mg/L、2番絞り COD 3,800〜5,000mg/L。前例のない排液。詳細はアドバンテックの行。$m$),
  ($m$e-wave$m$, $m$eウェーブ$m$, $m$アドバンテックの排水処理の担当$m$, $m$information_exchange$m$, $m$unagreed$m$, $m$2026-10-02のアドバンテック愛媛本社での面談に前田社長が同席。アドバンテックの酸洗い排水（フッ素が多い）を凝集沈殿（PAC）と石灰系のアルカリ剤で処理しており、薬品の値上がりで代わりの方法を求めている。鬼北町の改質リグニンのプラントは地域未来交付金も使う事業で、地元の議員にも説明している（議員の氏名は要確認）。窓口はまさ。$m$, $m$連携の形。$m$, $m$アドバンテックとのNDAとサンプル評価を進めながら、関係を保つ。$m$, $m$2026-10-02 SOL MTG アドバンテック愛媛本社（Notion書き起こし）／2026-10-02 車中の相談$m$, 146, $m$shared$m$, $m$まさ$m$, $m$排水処理の現場の知見を交換でき、アドバンテックの案件を一緒に進められる状態$m$, $m$active$m$, $m${tech_partner}$m$, $m$アドバンテック$m$, $m$tech_partner$m$, NULL, NULL, NULL)
) AS v(slug, name, role_label, stage, agreement, agreed, unagreed, next_commitment, source_ref, sort_order, ball_side, ball_owner, target_state,
  activity, classifications, introducer, poc_category, eff_components, eff_volume, eff_note)
WHERE NOT EXISTS (SELECT 1 FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = v.slug);

INSERT INTO project_management_partner_interactions (project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary,
  ball_side_after, ball_owner_after, confidence, source_kind, source_ref, actor_side, actor_label)
SELECT 'p21', p.id, $m$meeting$m$, DATE '2026-10-01', 'day', $m$松山で面談（いよぎんキャピタルと同席）$m$, $m$SIERの構想を説明し、顧客候補の企業への働きかけと出資の両面を期待していると伝えた。10/2の4社訪問を仲介してもらった。$m$, $m$shared$m$, $m$まさ・伊予銀行$m$, 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, $m$shared$m$, $m$まさ・杉浦先生・伊予銀行・いよぎんキャピタル$m$
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$iyo-bank$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_interactions i WHERE i.partner_id = p.id AND i.occurred_on = DATE '2026-10-01' AND i.summary = $m$松山で面談（いよぎんキャピタルと同席）$m$);

INSERT INTO project_management_partner_interactions (project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary,
  ball_side_after, ball_owner_after, confidence, source_kind, source_ref, actor_side, actor_label)
SELECT 'p21', p.id, $m$meeting$m$, DATE '2026-10-01', 'day', $m$松山で面談。会社の設立前から出資の検討を始める$m$, $m$DDを経て承認されれば1か月程度で出資まで進められる見込み。NDAはチームアルマダを当事者に結ぶ。資本政策・コスト試算・実験結果を説明した。$m$, $m$sx$m$, $m$まさ$m$, 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, $m$shared$m$, $m$まさ・杉浦先生・いよぎんキャピタル$m$
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$iyogin-capital$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_interactions i WHERE i.partner_id = p.id AND i.occurred_on = DATE '2026-10-01' AND i.summary = $m$松山で面談。会社の設立前から出資の検討を始める$m$);

INSERT INTO project_management_partner_interactions (project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary,
  ball_side_after, ball_owner_after, confidence, source_kind, source_ref, actor_side, actor_label)
SELECT 'p21', p.id, $m$email$m$, DATE '2026-10-02', 'day', $m$NDAのひな形を受領し、チームアルマダ名義の修正案を返送$m$, $m$修正は乙の名称・記名欄・第1条の目的（PSIステップ2の課題を事業化する設立予定会社への出資検討）・第8条の管轄の4点。事業概要資料とSIERのパンフレットも送付。杉浦先生がGAPファンドの申請書を送付。$m$, $m$partner$m$, $m$いよぎんキャピタル（高瀨さん）$m$, 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, $m$shared$m$, $m$高瀨さん・まさ$m$
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$iyogin-capital$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_interactions i WHERE i.partner_id = p.id AND i.occurred_on = DATE '2026-10-02' AND i.summary = $m$NDAのひな形を受領し、チームアルマダ名義の修正案を返送$m$);

INSERT INTO project_management_partner_interactions (project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary,
  ball_side_after, ball_owner_after, confidence, source_kind, source_ref, actor_side, actor_label)
SELECT 'p21', p.id, $m$meeting$m$, DATE '2026-10-01', 'day', $m$今治第1工場（アイセイテック）を訪問$m$, $m$水道メーター・ガスメーターの工場で、工業排水は出ていない。協業の余地はないと分かった。$m$, $m$none$m$, NULL, 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, $m$shared$m$, $m$まさ・杉浦先生$m$
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$aichi-tokei$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_interactions i WHERE i.partner_id = p.id AND i.occurred_on = DATE '2026-10-01' AND i.summary = $m$今治第1工場（アイセイテック）を訪問$m$);

INSERT INTO project_management_partner_interactions (project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary,
  ball_side_after, ball_owner_after, confidence, source_kind, source_ref, actor_side, actor_label)
SELECT 'p21', p.id, $m$meeting$m$, DATE '2026-10-02', 'day', $m$本社の排水処理設備を見学$m$, $m$3地点（原水・油分解槽の後・最終放流水）の排液サンプルと計量証明書のコピーを受け取った。困りごとは油脂と窒素・リン。$m$, $m$sx$m$, $m$研究チーム（杉浦先生）・まさ$m$, 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, $m$shared$m$, $m$まさ・杉浦先生・石原先生・髙橋さん$m$
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$poc-talk-07-x$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_interactions i WHERE i.partner_id = p.id AND i.occurred_on = DATE '2026-10-02' AND i.summary = $m$本社の排水処理設備を見学$m$);

INSERT INTO project_management_partner_interactions (project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary,
  ball_side_after, ball_owner_after, confidence, source_kind, source_ref, actor_side, actor_label)
SELECT 'p21', p.id, $m$meeting$m$, DATE '2026-10-02', 'day', $m$新居浜で訪問$m$, $m$工程の水は冷却水のあふれ分だけで、PoCの対象外と分かった。顧客からCO2削減のロードマップとスコープ3を求められ始めている。$m$, $m$none$m$, NULL, 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, $m$shared$m$, $m$まさ・杉浦先生・石原先生・目黒さん$m$
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$weekly-partner-mspfqqja$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_interactions i WHERE i.partner_id = p.id AND i.occurred_on = DATE '2026-10-02' AND i.summary = $m$新居浜で訪問$m$);

INSERT INTO project_management_partner_interactions (project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary,
  ball_side_after, ball_owner_after, confidence, source_kind, source_ref, actor_side, actor_label)
SELECT 'p21', p.id, $m$meeting$m$, DATE '2026-10-02', 'day', $m$別子事業所を訪問$m$, $m$工場の廃液と旧別子銅山の湧き水の2系統のサンプルをお願いした。提供可否は事業部門が判断する（断る可能性もある）。中和の前の液が要る。$m$, $m$partner$m$, $m$住友金属鉱山（事業部門）$m$, 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, $m$shared$m$, $m$まさ・杉浦先生・石原先生・東前さん・松下さん・松木さん$m$
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$poc-talk-10-x$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_interactions i WHERE i.partner_id = p.id AND i.occurred_on = DATE '2026-10-02' AND i.summary = $m$別子事業所を訪問$m$);

INSERT INTO project_management_partner_interactions (project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary,
  ball_side_after, ball_owner_after, confidence, source_kind, source_ref, actor_side, actor_label)
SELECT 'p21', p.id, $m$meeting$m$, DATE '2026-10-02', 'day', $m$愛媛本社を訪問（eウェーブ同席）$m$, $m$改質リグニンの排液（1番絞り・2番絞り）が対象。先方はサンプル提供を申し出た。NDAの後に評価へ進む。$m$, $m$sx$m$, $m$まさ$m$, 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, $m$shared$m$, $m$まさ・杉浦先生・石原先生・中島先生・福島さん・前田社長$m$
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$advantech$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_interactions i WHERE i.partner_id = p.id AND i.occurred_on = DATE '2026-10-02' AND i.summary = $m$愛媛本社を訪問（eウェーブ同席）$m$);

INSERT INTO project_management_partner_interactions (project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary,
  ball_side_after, ball_owner_after, confidence, source_kind, source_ref, actor_side, actor_label)
SELECT 'p21', p.id, $m$email$m$, DATE '2026-10-02', 'day', $m$お礼とNDA締結のお願いを送付$m$, $m$NDAを結んでから、サンプルの評価方法や処理条件の具体的なやり取りに進みたいと伝えた。$m$, $m$partner$m$, $m$アドバンテック（福島さん）$m$, 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, $m$sx$m$, $m$まさ$m$
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$advantech$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_interactions i WHERE i.partner_id = p.id AND i.occurred_on = DATE '2026-10-02' AND i.summary = $m$お礼とNDA締結のお願いを送付$m$);

INSERT INTO project_management_partner_interactions (project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary,
  ball_side_after, ball_owner_after, confidence, source_kind, source_ref, actor_side, actor_label)
SELECT 'p21', p.id, $m$meeting$m$, DATE '2026-10-02', 'day', $m$アドバンテック愛媛本社で事業と排液の説明を受けた$m$, $m$鬼北町の量産実証プラント（年1,000t）、SBIR約22億円、排液の性状と処理計画（栗田工業と設計）を聞いた。$m$, $m$partner$m$, $m$アドバンテック（福島さん）$m$, 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, $m$shared$m$, $m$まさ・杉浦先生・石原先生・中島先生・アドバンテック$m$
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$mokushitsuso-lignin-lab$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_interactions i WHERE i.partner_id = p.id AND i.occurred_on = DATE '2026-10-02' AND i.summary = $m$アドバンテック愛媛本社で事業と排液の説明を受けた$m$);

INSERT INTO project_management_partner_interactions (project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary,
  ball_side_after, ball_owner_after, confidence, source_kind, source_ref, actor_side, actor_label)
SELECT 'p21', p.id, $m$meeting$m$, DATE '2026-10-02', 'day', $m$アドバンテック愛媛本社での面談に同席$m$, $m$アドバンテックの酸洗い排水（フッ素が多い）の処理と、薬品の値上がりで代わりの方法を求めていることを聞いた。窓口はまさ。$m$, $m$shared$m$, $m$まさ$m$, 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, $m$shared$m$, $m$まさ・前田社長$m$
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$e-wave$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_interactions i WHERE i.partner_id = p.id AND i.occurred_on = DATE '2026-10-02' AND i.summary = $m$アドバンテック愛媛本社での面談に同席$m$);

INSERT INTO project_management_partner_work_items (project_id, partner_id, side, item_kind, title, detail, owner_label, status, due_date_precision,
  completion_criteria, last_verified_at, confidence, source_kind, source_ref, sort_order)
SELECT 'p21', p.id, $m$partner$m$, $m$response$m$, $m$NDAの修正案（チームアルマダ名義）への返答$m$, $m$10/2に送った修正案への返答を待つ。$m$, $m$いよぎんキャピタル（高瀨さん）$m$, $m$waiting$m$, 'unknown', $m$NDAを締結する$m$, DATE '2026-10-03', 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, 100
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$iyogin-capital$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_work_items w WHERE w.partner_id = p.id AND w.title = $m$NDAの修正案（チームアルマダ名義）への返答$m$);

INSERT INTO project_management_partner_work_items (project_id, partner_id, side, item_kind, title, detail, owner_label, status, due_date_precision,
  completion_criteria, last_verified_at, confidence, source_kind, source_ref, sort_order)
SELECT 'p21', p.id, $m$sx$m$, $m$deliverable$m$, $m$DD資料の共有（コスト試算の詳細・事業領域と市場規模・シリーズBまでの月次計画）$m$, $m$10/1の面談でDDの資料として共有すると伝えた。DDパッケージで共有する。$m$, $m$まさ$m$, $m$open$m$, 'unknown', $m$いよぎんキャピタルがDDの資料を見られる$m$, DATE '2026-10-03', 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, 101
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$iyogin-capital$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_work_items w WHERE w.partner_id = p.id AND w.title = $m$DD資料の共有（コスト試算の詳細・事業領域と市場規模・シリーズBまでの月次計画）$m$);

INSERT INTO project_management_partner_work_items (project_id, partner_id, side, item_kind, title, detail, owner_label, status, due_date_precision,
  completion_criteria, last_verified_at, confidence, source_kind, source_ref, sort_order)
SELECT 'p21', p.id, $m$sx$m$, $m$task$m$, $m$3地点のサンプルで窒素・リン・CODの低減を確かめる$m$, $m$原水・油分解槽の後・最終放流水（各500mL、10/2受領）。$m$, $m$研究チーム（杉浦先生）$m$, $m$open$m$, 'unknown', $m$3地点の処理前後の数値が出ている$m$, DATE '2026-10-03', 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, 102
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$poc-talk-07-x$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_work_items w WHERE w.partner_id = p.id AND w.title = $m$3地点のサンプルで窒素・リン・CODの低減を確かめる$m$);

INSERT INTO project_management_partner_work_items (project_id, partner_id, side, item_kind, title, detail, owner_label, status, due_date_precision,
  completion_criteria, last_verified_at, confidence, source_kind, source_ref, sort_order)
SELECT 'p21', p.id, $m$sx$m$, $m$task$m$, $m$NDAの相談をハタダへ送る$m$, $m$10/2のお礼メールで「追って連絡」と伝えた。$m$, $m$まさ$m$, $m$open$m$, 'unknown', $m$NDAの要否と結び方が決まっている$m$, DATE '2026-10-03', 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, 103
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$poc-talk-07-x$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_work_items w WHERE w.partner_id = p.id AND w.title = $m$NDAの相談をハタダへ送る$m$);

INSERT INTO project_management_partner_work_items (project_id, partner_id, side, item_kind, title, detail, owner_label, status, due_date_precision,
  completion_criteria, last_verified_at, confidence, source_kind, source_ref, sort_order)
SELECT 'p21', p.id, $m$partner$m$, $m$decision$m$, $m$事業部門でサンプル・データの提供可否を判断$m$, $m$工場の廃液と旧別子銅山の湧き水の2系統。断る可能性もあると明言。$m$, $m$住友金属鉱山（事業部門）$m$, $m$waiting$m$, 'unknown', $m$提供可否の返事がある$m$, DATE '2026-10-03', 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, 104
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$poc-talk-10-x$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_work_items w WHERE w.partner_id = p.id AND w.title = $m$事業部門でサンプル・データの提供可否を判断$m$);

INSERT INTO project_management_partner_work_items (project_id, partner_id, side, item_kind, title, detail, owner_label, status, due_date_precision,
  completion_criteria, last_verified_at, confidence, source_kind, source_ref, sort_order)
SELECT 'p21', p.id, $m$partner$m$, $m$response$m$, $m$NDAの締結への返答$m$, $m$10/2にまさからNDAの締結をお願いした。$m$, $m$アドバンテック（福島さん）$m$, $m$waiting$m$, 'unknown', $m$NDAを締結する$m$, DATE '2026-10-03', 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, 105
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$advantech$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_work_items w WHERE w.partner_id = p.id AND w.title = $m$NDAの締結への返答$m$);

INSERT INTO project_management_partner_work_items (project_id, partner_id, side, item_kind, title, detail, owner_label, status, due_date_precision,
  completion_criteria, last_verified_at, confidence, source_kind, source_ref, sort_order)
SELECT 'p21', p.id, $m$sx$m$, $m$task$m$, $m$1番絞り・2番絞りのサンプルで水質分析・凝集テスト・処理の可否を確かめる$m$, $m$NDAの締結後に行う。$m$, $m$研究チーム（杉浦先生・中島先生）$m$, $m$open$m$, 'unknown', $m$処理の可否と前処理の条件が分かっている$m$, DATE '2026-10-03', 'high', 'manual', $m$2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）$m$, 106
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$advantech$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_work_items w WHERE w.partner_id = p.id AND w.title = $m$1番絞り・2番絞りのサンプルで水質分析・凝集テスト・処理の可否を確かめる$m$);

UPDATE project_tech_entries SET value_text = $m$◎ 検証済み（実排液を含む）$m$, value_min = NULL, value_max = NULL, condition_text = $m$2026-10-02の杉浦先生の説明資料で検証済みと記載（鉛・クロム・亜鉛・カドミウム・銅・アルミ・鉄・ストロンチウム）$m$, observed_on = DATE '2026-10-02', confidence = $m$high$m$, source_kind = $m$meeting$m$, source_ref = $m$2026-10-02 住友金属鉱山・日泉化学の面談での杉浦先生の説明資料と説明（Notion書き起こし）。まさ確認 2026-10-03「検証済みだよ」$m$, note = $m$ペロブスカイト太陽電池の鉛の回収も視野（2026-10-01 いよぎん面談）。取り込みの数値はこの台帳に未収録。$m$, needs_check = false, check_reason = NULL, updated_by = 'amie', updated_at = NOW() WHERE project_id = 'p21' AND tech_entry_id = $m$pte_sx_e10$m$;

UPDATE project_tech_entries SET value_text = $m$◎ 検証済み$m$, value_min = NULL, value_max = NULL, condition_text = $m$2026-10-02の杉浦先生の説明資料で検証済みと記載（鉛・クロム・亜鉛・カドミウム・銅・アルミ・鉄・ストロンチウム）$m$, observed_on = DATE '2026-10-02', confidence = $m$high$m$, source_kind = $m$meeting$m$, source_ref = $m$2026-10-02 住友金属鉱山・日泉化学の面談での杉浦先生の説明資料と説明（Notion書き起こし）。まさ確認 2026-10-03「検証済みだよ」$m$, note = $m$2026-10-02の説明で検証済みと確認。取り込みの数値はこの台帳に未収録。$m$, needs_check = false, check_reason = NULL, updated_by = 'amie', updated_at = NOW() WHERE project_id = 'p21' AND tech_entry_id = $m$pte_sx_e11$m$;

UPDATE project_tech_entries SET value_text = $m$◎ 検証済み。カドミウム系の実排液はpH5.64から1時間でpH7に戻った（2026-10-01）$m$, value_min = NULL, value_max = NULL, condition_text = $m$2026-10-02の杉浦先生の説明資料で検証済みと記載（鉛・クロム・亜鉛・カドミウム・銅・アルミ・鉄・ストロンチウム）$m$, observed_on = DATE '2026-10-02', confidence = $m$high$m$, source_kind = $m$meeting$m$, source_ref = $m$2026-10-02 住友金属鉱山・日泉化学の面談での杉浦先生の説明資料と説明（Notion書き起こし）。まさ確認 2026-10-03「検証済みだよ」$m$, note = $m$取り込みの数値はこの台帳に未収録。$m$, needs_check = false, check_reason = NULL, updated_by = 'amie', updated_at = NOW() WHERE project_id = 'p21' AND tech_entry_id = $m$pte_sx_e09$m$;

UPDATE project_tech_entries SET value_text = $m$◎ 検証済み。ある金属加工工場の実排液で、銅とともに30分で浄化$m$, value_min = NULL, value_max = NULL, condition_text = $m$2026-10-02の杉浦先生の説明資料で検証済みと記載（鉛・クロム・亜鉛・カドミウム・銅・アルミ・鉄・ストロンチウム）$m$, observed_on = DATE '2026-10-02', confidence = $m$high$m$, source_kind = $m$meeting$m$, source_ref = $m$2026-10-02 住友金属鉱山・日泉化学の面談での杉浦先生の説明資料と説明（Notion書き起こし）。まさ確認 2026-10-03「検証済みだよ」$m$, note = $m$取り込みの数値はこの台帳に未収録。$m$, needs_check = false, check_reason = NULL, updated_by = 'amie', updated_at = NOW() WHERE project_id = 'p21' AND tech_entry_id = $m$pte_sx_e08$m$;

UPDATE project_tech_entries SET value_text = $m$◎ 検証済み$m$, value_min = NULL, value_max = NULL, condition_text = $m$2026-10-02の杉浦先生の説明資料で検証済みと記載（鉛・クロム・亜鉛・カドミウム・銅・アルミ・鉄・ストロンチウム）$m$, observed_on = DATE '2026-10-02', confidence = $m$high$m$, source_kind = $m$meeting$m$, source_ref = $m$2026-10-02 住友金属鉱山・日泉化学の面談での杉浦先生の説明資料と説明（Notion書き起こし）。まさ確認 2026-10-03「検証済みだよ」$m$, note = $m$めっき排水では亜鉛が主成分になる。取り込みの数値はこの台帳に未収録。$m$, needs_check = false, check_reason = NULL, updated_by = 'amie', updated_at = NOW() WHERE project_id = 'p21' AND tech_entry_id = $m$pte_sx_e14$m$;

INSERT INTO project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, unit, condition_text, observed_on, confidence,
  source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sx_1002_e01$m$, $m$ptt_sx_elements$m$, 'p21', $m$ストロンチウム$m$, $m$◎ 検証済み$m$, NULL, $m$2026-10-02の杉浦先生の説明資料で検証済みと記載$m$, DATE '2026-10-02', $m$high$m$, $m$meeting$m$, $m$2026-10-02 住友金属鉱山・日泉化学の面談での杉浦先生の説明資料と説明（Notion書き起こし）。まさ確認 2026-10-03「検証済みだよ」$m$, $m$取り込みの数値はこの台帳に未収録。$m$, 172,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, source_ref = EXCLUDED.source_ref, note = EXCLUDED.note, updated_by = 'amie', updated_at = NOW();

UPDATE project_tech_entries SET note = $m$杉浦先生「実験室のレベルではニッケルは取り込みます」。銅・アルミと混ざると、銅・アルミを先に取り込み、ニッケルは最後になる（2026-10-02）。$m$, updated_by = 'amie', updated_at = NOW() WHERE project_id = 'p21' AND tech_entry_id = $m$pte_sx_e02$m$;

UPDATE project_tech_entries SET value_text = $m$○ Dy・Ndの取り込みを確認。磁性材料メーカーの実排液でネオジムを30分でほぼ取り込んだ（2026-10-01）。濃い液での実証へ$m$, observed_on = DATE '2026-10-01', source_ref = $m$2026-07-10 杉浦先生の速報／2026-09-15 BNV定例／2026-10-01 いよぎん面談（Notion書き起こし・Circleback）$m$, updated_by = 'amie', updated_at = NOW() WHERE project_id = 'p21' AND tech_entry_id = $m$pte_sx_e07$m$;

UPDATE project_tech_entries SET value_text = $m$○ 試験中。食品工場の排液でCODが2,000超から500程度まで下がった（条件による）$m$, condition_text = $m$いよぎん紹介の食品関係の排液。2026-09-14 から COD を継続測定。増殖の炭素源はCO2で、有機物の分解（COD低減）とは別に扱う（まさ 2026-10-03）$m$, observed_on = DATE '2026-10-02', source_ref = $m$2026-09-15 BNV定例／2026-10-02 ハタダ面談での杉浦先生の説明（Notion書き起こし）$m$, updated_by = 'amie', updated_at = NOW() WHERE project_id = 'p21' AND tech_entry_id = $m$pte_sx_0915_01$m$;

INSERT INTO project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, unit, condition_text, observed_on, confidence,
  source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sx_1002_e02$m$, $m$ptt_sx_elements$m$, 'p21', $m$1,4-ジオキサン$m$, $m$△ 未試験$m$, NULL, $m$改質リグニンの製造で副生する可能性がある（2026-10-02 アドバンテックで質問）$m$, DATE '2026-10-02', $m$unverified$m$, $m$meeting$m$, $m$2026-10-02 アドバンテック面談（Notion書き起こし）$m$, NULL, 174,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, source_ref = EXCLUDED.source_ref, note = EXCLUDED.note, updated_by = 'amie', updated_at = NOW();

INSERT INTO project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, unit, condition_text, observed_on, confidence,
  source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sx_1002_e03$m$, $m$ptt_sx_elements$m$, 'p21', $m$リグニン由来の排液$m$, $m$△ 高分子のリグニンは細胞に直接取り込みにくい。分解されてできた糖など（CODの元）は処理の対象になりうる$m$, NULL, $m$杉浦先生の見解（2026-10-02 アドバンテック）。リグニンの分解そのものは試していない$m$, DATE '2026-10-02', $m$low$m$, $m$meeting$m$, $m$2026-10-02 アドバンテック面談（Notion書き起こし）$m$, NULL, 176,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, source_ref = EXCLUDED.source_ref, note = EXCLUDED.note, updated_by = 'amie', updated_at = NOW();

UPDATE project_tech_entries SET value_text = $m$銅・アルミ・鉄を先に取り込み、ニッケルは最後になる$m$, condition_text = $m$銅・アルミ・ニッケルが混ざった液の場合（2026-10-02 杉浦先生）$m$, observed_on = DATE '2026-10-02', confidence = $m$medium$m$, source_kind = $m$meeting$m$, source_ref = $m$2026-10-02 住友金属鉱山の面談（Notion書き起こし）／2026-10-01 いよぎん面談「若干の優先順位はある」$m$, note = $m$理由は分かっていない。以前は記録が無かった項目。$m$, updated_by = 'amie', updated_at = NOW() WHERE project_id = 'p21' AND tech_entry_id = $m$pte_sx_f03$m$;

UPDATE project_tech_entries SET value_text = $m$銅・アルミ・鉄を先に取り込み、ニッケルは最後（2026-10-02）。鉄と亜鉛は速度が速く濃度も高い傾向$m$, observed_on = DATE '2026-10-02', confidence = $m$medium$m$, source_ref = $m$pte_sx_f03 ／ 2026-10-02 住友金属鉱山の面談$m$, updated_by = 'amie', updated_at = NOW() WHERE project_id = 'p21' AND tech_entry_id = $m$pte_sx_ss17$m$;

UPDATE project_tech_entries SET value_text = $m$銅 / 鉄 / ニッケル / 鉛 / クロム / 亜鉛 / カドミウム / アルミ / ストロンチウム / 反応性窒素 / 色素 / レアアース（Dy・Nd。磁性材料メーカーの実排液で30分でほぼ取り込み）$m$, condition_text = $m$銅は取り込み効率30 mg/g-DCW、除去速度75 mg/L・h。鉛・クロム・亜鉛・カドミウム・アルミ・ストロンチウムは2026-10-02の杉浦先生の説明資料で検証済み$m$, observed_on = DATE '2026-10-02', source_ref = $m$対象にできる物質（pte_sx_e*）／2026-10-02 住友金属鉱山・日泉化学の面談での杉浦先生の説明資料と説明（Notion書き起こし）。まさ確認 2026-10-03「検証済みだよ」$m$, updated_by = 'amie', updated_at = NOW() WHERE project_id = 'p21' AND tech_entry_id = $m$pte_sx_ss14$m$;

UPDATE project_tech_entries SET value_text = $m$Dy・Ndの濃い実排液 / コバルト / ヒ素 / モリブデン / 1,4-ジオキサン$m$, observed_on = DATE '2026-10-02', note = $m$モリブデンは海水ベースの排液で一度失敗。鉛・クロム・亜鉛・カドミウム・アルミは2026-10-02に検証済みへ移した。$m$, updated_by = 'amie', updated_at = NOW() WHERE project_id = 'p21' AND tech_entry_id = $m$pte_sx_ss15$m$;

UPDATE project_tech_entries SET value_text = $m$死なないが増えない。10〜20℃では働きが落ちる。取り込みの低温のデータはまだない$m$, observed_on = DATE '2026-10-02', source_ref = $m$2026-01-20 定例／2026-10-02 住友金属鉱山の面談（冷たい湧き水の質問への杉浦先生の回答）$m$, updated_by = 'amie', updated_at = NOW() WHERE project_id = 'p21' AND tech_entry_id = $m$pte_sx_ss02$m$;

UPDATE project_tech_entries SET note = $m$実際に受け取った排液で確認済み。短時間なら取り込むが、その後すべて吐き出して死滅した。海水並み（約3.4%）の塩分では働かない。中和剤（苛性ソーダなど）を入れた後の液はナトリウムが多いので、評価は中和の前の液で行う（2026-10-02）。$m$, updated_by = 'amie', updated_at = NOW() WHERE project_id = 'p21' AND tech_entry_id = $m$pte_sx_l01$m$;

INSERT INTO project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, unit, condition_text, observed_on, confidence,
  source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sx_1001_r01$m$, $m$ptt_sx_record$m$, 'p21', $m$10Lリアクターでの鉄排液の処理$m$, $m$10Lを約1時間で処理（予定は1日）。1時間後の鉄は0.09ppm。半分になるまで約0.2分（十数秒）$m$, NULL, $m$新しいリアクター（横型）。撮影用に集めた細胞を使用。測ったのは1時間後だけ$m$, DATE '2026-10-01', $m$medium$m$, $m$meeting$m$, $m$2026-10-01 いよぎん面談の杉浦先生の報告（Notion書き起こし・Circleback）$m$, $m$それまでの小さい規模の試験より大幅に速い。$m$, 180,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, source_ref = EXCLUDED.source_ref, note = EXCLUDED.note, updated_by = 'amie', updated_at = NOW();

INSERT INTO project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, unit, condition_text, observed_on, confidence,
  source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sx_1001_r02$m$, $m$ptt_sx_record$m$, 'p21', $m$酸性の実排液のpH$m$, $m$pH3〜4から1時間でpH7。カドミウム系の排液もpH5.64から1時間でpH7$m$, NULL, $m$実排液$m$, DATE '2026-10-01', $m$medium$m$, $m$meeting$m$, $m$2026-10-01 いよぎん面談の杉浦先生の報告（Notion書き起こし・Circleback）$m$, NULL, 182,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, source_ref = EXCLUDED.source_ref, note = EXCLUDED.note, updated_by = 'amie', updated_at = NOW();

INSERT INTO project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, unit, condition_text, observed_on, confidence,
  source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sx_1001_r03$m$, $m$ptt_sx_record$m$, 'p21', $m$リアクターの改良点$m$, $m$細胞が底に溜まる、通気が弱い。通気を4〜5か所に増やし、横型から縦型へ。10/5の週に実験を再開$m$, NULL, $m$新しいリアクター$m$, DATE '2026-10-01', $m$high$m$, $m$meeting$m$, $m$2026-10-01 いよぎん面談の杉浦先生の報告（Notion書き起こし・Circleback）$m$, NULL, 184,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, source_ref = EXCLUDED.source_ref, note = EXCLUDED.note, updated_by = 'amie', updated_at = NOW();

INSERT INTO project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, unit, condition_text, observed_on, confidence,
  source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sx_1001_r04$m$, $m$ptt_sx_record$m$, 'p21', $m$装置の調達の遅れ$m$, $m$光を通すプラスチック部材が手に入りにくく、装置の納品が遅れている。開発そのものは想定より早く進んでいる$m$, NULL, $m$装置の納品$m$, DATE '2026-10-01', $m$medium$m$, $m$meeting$m$, $m$2026-10-01 いよぎん面談の杉浦先生の報告（Notion書き起こし・Circleback）$m$, NULL, 186,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, source_ref = EXCLUDED.source_ref, note = EXCLUDED.note, updated_by = 'amie', updated_at = NOW();

INSERT INTO project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, unit, condition_text, observed_on, confidence,
  source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sx_1002_r01$m$, $m$ptt_sx_record$m$, 'p21', $m$カートリッジ式とバッチ式の速さ$m$, $m$カートリッジ（少しずつ通す）方が、バッチ式より速い傾向$m$, NULL, $m$菌の量は同じ。データの取りまとめはこれから$m$, DATE '2026-10-02', $m$medium$m$, $m$meeting$m$, $m$2026-10-02 住友金属鉱山の面談（Notion書き起こし）$m$, NULL, 188,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, source_ref = EXCLUDED.source_ref, note = EXCLUDED.note, updated_by = 'amie', updated_at = NOW();

UPDATE project_tech_entries SET value_text = $m$20社以上・20種類以上の実排液を試験（当初の目標は10社）$m$, observed_on = DATE '2026-10-02', source_ref = $m$2026-09-15 BNV定例／2026-10-01 いよぎん面談／2026-10-02 住友金属鉱山の面談$m$, updated_by = 'amie', updated_at = NOW() WHERE project_id = 'p21' AND tech_entry_id = $m$pte_sx_0915_02$m$;

INSERT INTO project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, unit, condition_text, observed_on, confidence,
  source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sx_1002_x01$m$, $m$ptt_sx_reactor$m$, 'p21', $m$処理に使う菌の量$m$, $m$実験の菌の量は、活性汚泥を使う水処理の現場より桁違いに少ない。約100倍まで増やせる見込みで、増やすほど速くなる$m$, NULL, $m$住友金属鉱山から、菌の量と取り込みの速さの関係と、工場の規模（毎分3〜4m³）で使えるかを聞かれたときの杉浦先生の回答$m$, DATE '2026-10-02', $m$low$m$, $m$meeting$m$, $m$2026-10-02 住友金属鉱山の面談（Notion書き起こし）$m$, $m$菌の量を増やすと原価（菌体の量）も増える。コスト試算の菌体濃度（5 g-DCW/L）との関係は未確認。$m$, 250,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, source_ref = EXCLUDED.source_ref, note = EXCLUDED.note, updated_by = 'amie', updated_at = NOW();

INSERT INTO project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, unit, condition_text, observed_on, confidence,
  source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sx_ef_1002_01$m$, $m$ptt_sx_effluent_sources$m$, 'p21', $m$ハタダ（食品工場）$m$, $m$原水・油分解槽の後・最終放流水の3地点、各500mL（2026-10-02 受領）。流入は約40℃で大半が洗浄水、油脂が多い。COD・BODは基準の1/3〜1/5、窒素・リンが課題$m$, NULL, $m$窒素・リン・CODの低減を見る。油は油分解槽の後の液で$m$, DATE '2026-10-02', $m$high$m$, $m$meeting$m$, $m$2026-10-01〜02 愛媛訪問（Notion書き起こし）$m$, $m$日程と次の約束は関係先タブが正本。$m$, 80,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, source_ref = EXCLUDED.source_ref, note = EXCLUDED.note, updated_by = 'amie', updated_at = NOW();

INSERT INTO project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, unit, condition_text, observed_on, confidence,
  source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sx_ef_1002_02$m$, $m$ptt_sx_effluent_sources$m$, 'p21', $m$住友金属鉱山（非鉄の製錬）$m$, $m$工場: ニッケル・銅・アルミが混ざる。有機溶媒、COD高め、窒素・リン、中和剤由来のナトリウム。毎分3〜4m³。旧別子銅山の湧き水: 薄い・冷たい・毎分4〜5m³$m$, NULL, $m$評価は中和の前の液で。提供可否は先方が判断中$m$, DATE '2026-10-02', $m$medium$m$, $m$meeting$m$, $m$2026-10-01〜02 愛媛訪問（Notion書き起こし）$m$, $m$日程と次の約束は関係先タブが正本。$m$, 82,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, source_ref = EXCLUDED.source_ref, note = EXCLUDED.note, updated_by = 'amie', updated_at = NOW();

INSERT INTO project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, unit, condition_text, observed_on, confidence,
  source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sx_ef_1002_03$m$, $m$ptt_sx_effluent_sources$m$, 'p21', $m$アドバンテック（改質リグニン）$m$, $m$1番絞り COD約11万mg/L。2番絞り（洗浄水）COD 3,800〜5,000mg/L・1日約120t。BOD約1,000に対しCOD約3,500。PEG・グリセリン・木粉に由来$m$, NULL, $m$前例のない排液。NDAの後にサンプルを評価$m$, DATE '2026-10-02', $m$medium$m$, $m$meeting$m$, $m$2026-10-01〜02 愛媛訪問（Notion書き起こし）$m$, $m$日程と次の約束は関係先タブが正本。$m$, 84,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, source_ref = EXCLUDED.source_ref, note = EXCLUDED.note, updated_by = 'amie', updated_at = NOW();

INSERT INTO project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, unit, condition_text, observed_on, confidence,
  source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sx_ef_1002_04$m$, $m$ptt_sx_effluent_sources$m$, 'p21', $m$日泉化学（プラスチックの加工）$m$, $m$対象外（工程の水は冷却水のあふれ分だけ。重金属・色素を含まない）$m$, NULL, $m$訪問で確認$m$, DATE '2026-10-02', $m$high$m$, $m$meeting$m$, $m$2026-10-01〜02 愛媛訪問（Notion書き起こし）$m$, $m$原材料の製造（触媒を使う）側なら特殊な排液が出る。$m$, 86,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, source_ref = EXCLUDED.source_ref, note = EXCLUDED.note, updated_by = 'amie', updated_at = NOW();

INSERT INTO project_tech_entries (tech_entry_id, tech_topic_id, project_id, row_label, value_text, unit, condition_text, observed_on, confidence,
  source_kind, source_ref, note, sort_order, needs_check, check_reason, created_by, updated_by)
VALUES ($m$pte_sx_ef_1001_05$m$, $m$ptt_sx_effluent_sources$m$, 'p21', $m$アイセイテック（愛知時計電機 今治第1工場）$m$, $m$対象外（工業排水が出ていない）$m$, NULL, $m$訪問で確認$m$, DATE '2026-10-01', $m$high$m$, $m$meeting$m$, $m$2026-10-01〜02 愛媛訪問（Notion書き起こし）$m$, NULL, 88,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_entry_id) DO UPDATE SET row_label = EXCLUDED.row_label, value_text = EXCLUDED.value_text, condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on, confidence = EXCLUDED.confidence, source_ref = EXCLUDED.source_ref, note = EXCLUDED.note, updated_by = 'amie', updated_at = NOW();

INSERT INTO project_tech_topics (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order, status, confidentiality,
  source_kind, source_ref, needs_check, check_reason, created_by, updated_by)
VALUES ('ptt_sol_bm_field_202610', 'p21', 'article', $m$顧客の現場で分かったこと — 2026年10月の愛媛訪問$m$,
  $m$排水が出る業種と出ない業種、大手が判断に使う基準、CO2削減が買う理由になりにくいこと、現場が払っているお金、新しい市場、入れる位置。$m$,
  $m$**対象になる業種・ならない業種**

- プラスチックの加工（日泉化学）と、水道・ガスメーターの組立（アイセイテック）は、工程から排水がほぼ出ない。出るのは冷却水のあふれ分くらい。
- 同じプラスチックでも、原材料をつくる側は触媒を使うので特殊な排液が出る。探すなら、原材料の製造、金属の製錬・表面処理、食品のように排液の多い工程。

**大手が判断に使う基準**

- 住友金属鉱山は「評価だけなら結果は出せそうだが、実用化には、今ある排水処理に対して処理量・速度・容量がどうかを示すことが前提」と言った。毎分3〜4m³の工場に対して、カートリッジの能力を既存の処理と同じ物差しで示す必要がある。

**CO2削減は買う理由になりにくい**

- 住友金属鉱山は、排水処理のコスト削減もCO2削減も求められていない。
- 日泉化学が顧客（自動車）から求められているのは工場全体のCO2で、排水処理ではない。
- 訴えるなら、薬品代・規制（窒素・リン）・人手の負担のほうが効く。

**現場の困りごと**

- 管理が一人に寄っている（ハタダは髙橋さんが排水処理から設備の管理までほぼ一人で担う）。
- 凝集剤・アルカリ剤などの薬品の値上がり（eウェーブ）。
- 油脂、冬の悪化、大雨の流入、設備の老朽化（ハタダ）。
- 瀬戸内法の対象（1日49t超）では、窒素・リンの規制が厳しい。

**現場が払っているお金（値付けの目安）**

| 項目 | 金額 | 出典 |
|---|---|---|
| 油分解菌（市販の微生物の製剤） | 1Lあたり3,000〜4,000円、月約20L（月6〜8万円） | ハタダ |
| 水質分析（計量証明） | 年約50万円 | ハタダ |
| 産業廃棄物として出す | 1tあたり数万円 | ハタダ |
| 油を手前で取る設備 | 1,000万円〜数千万円 | ハタダ |
| 膜処理 | 交換・洗浄の手間が重く、現場は勧めない | ハタダ |

現場はすでに微生物の製剤にお金を払っている。菌のカートリッジを売る形と相性がよい。

**新しい市場**

- 改質リグニンの排液: 前例がなく、2番絞りだけで1日約120t。木質素研究所は全国にプラントを広げる計画で、解決できれば各地のプラントに付く。
- 休止鉱山の湧き水: 量が多く（毎分4〜5m³）、薄くて冷たい。低温での働きを確かめる必要がある。

**入れる位置**

- 金属系は、中和剤を入れる前（ナトリウムが増える前）。
- 食品は、油分解槽の後。
- MBRの槽に菌を入れる形（アドバンテックで話した案）。
$m$, 'ビジネスモデル', 15, 'active', 'internal', 'meeting', $m$2026-10-01〜02 愛媛訪問（ハタダ・日泉化学・住友金属鉱山・アドバンテック・アイセイテック）の書き起こし$m$,
  false, NULL, 'amie', 'amie')
ON CONFLICT (tech_topic_id) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, body_md = EXCLUDED.body_md, updated_by = 'amie', updated_at = NOW();

INSERT INTO project_management_tasks (id, project_id, parent_task_id, track, title, description, status, planned_start, planned_end, date_certainty,
  owner_label, completion_criteria, sort_order, confidence, source_kind, source_ref, created_by, updated_by)
VALUES ('21000000-2026-4000-9000-000000000018', 'p21', '21000000-2026-4000-9000-000000000005', 'organizational_building', $m$社名の確認（solvio 案）$m$, $m$現行の案「SolvioraX」を「solvio」に変える案が出た（長くて覚えにくい、Xで終わるスタートアップが多い）。綴り・ドメイン・商標・同じ名前の会社を確かめてから決める（2026-10-02 車中で4人で相談）。$m$, 'not_started', DATE '2026-10-03', DATE '2026-10-23', 'provisional',
  'まさ', $m$綴り・ドメイン・商標・同じ名前の会社を確かめ、社名を決めている$m$, 10, 'medium', 'manual', $m$2026-10-02 車中の相談（まさ・杉浦先生・石原先生・中島先生）$m$, 'amie', 'amie')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, completion_criteria = EXCLUDED.completion_criteria, updated_at = NOW();

INSERT INTO project_management_tasks (id, project_id, parent_task_id, track, title, description, status, planned_start, planned_end, date_certainty,
  owner_label, completion_criteria, sort_order, confidence, source_kind, source_ref, created_by, updated_by)
VALUES ('21000000-2026-4000-9000-000000000019', 'p21', '21000000-2026-4000-9000-000000000003', 'organizational_building', $m$COO候補の探索$m$, $m$愛媛で活動できる人を優先して探す。杉浦先生が知っている優秀な学生に先生から声をかけてもらい、反応がよければ石原先生がすぐ面接する（石原先生の心当たりの1名は就職先が決まっていて難しい）。愛媛で難しければ関東でも探す。COOとして動いてもらい、よければCEOに育てることも考える（2026-10-02 車中で4人で相談）。$m$, 'not_started', DATE '2026-10-03', DATE '2026-10-30', 'provisional',
  'まさ', $m$COO候補と面接し、参画の形を話し合えている$m$, 10, 'medium', 'manual', $m$2026-10-02 車中の相談（まさ・杉浦先生・石原先生・中島先生）$m$, 'amie', 'amie')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, completion_criteria = EXCLUDED.completion_criteria, updated_at = NOW();

DO $chk$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM project_meeting_summaries WHERE project_id = 'p21' AND generated_by_model = 'manual-amie-2026-10-03';
  IF n <> 5 THEN RAISE EXCEPTION 'meeting cards: expected 5, got %', n; END IF;
  SELECT count(*) INTO n FROM project_management_partners WHERE project_id = 'p21' AND deleted_at IS NULL AND last_verified_at = DATE '2026-10-03' AND owner_label = 'まさ'
    AND slug IN ('iyo-bank','iyogin-capital','aichi-tokei','poc-talk-07-x','weekly-partner-mspfqqja','poc-talk-10-x','advantech','partners-fund','davp','mokushitsuso-lignin-lab','e-wave');
  IF n <> 11 THEN RAISE EXCEPTION 'partners: expected 11, got %', n; END IF;
  SELECT count(*) INTO n FROM project_management_partner_interactions WHERE project_id = 'p21' AND source_ref = '2026-10-01〜02 愛媛訪問（Notionの要約と書き起こし・Circleback・お礼メール）';
  IF n <> 11 THEN RAISE EXCEPTION 'interactions: expected 11, got %', n; END IF;
  SELECT count(*) INTO n FROM project_tech_entries WHERE project_id = 'p21' AND tech_entry_id IN ('pte_sx_e10','pte_sx_e11','pte_sx_e09','pte_sx_e08','pte_sx_e14','pte_sx_1002_e01') AND value_text LIKE '◎ 検証済み%';
  IF n <> 6 THEN RAISE EXCEPTION 'verified metals: expected 6, got %', n; END IF;
END $chk$;

COMMIT;
