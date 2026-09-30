-- LiSTie（p07）9/16・9/30 経営会議の反映と、技術タブの相手ごとの状況4行を関係先へ移す（2026-09-30）
--
-- まさの依頼（2026-09-30）:
--   「9/16の経営会議のカードを作って」「前処理の表の相手とのやり取り4行を関係先へ移して」
--   「さっき経営会議も完了してnotion文字起こし記録してあるから、それも確認してほしい」
-- 出典: Notion「【web】LiSTie経営会議」2026-09-16（3dd97749…、13:00〜14:30）・2026-09-30（3eb97749…8178、13:00〜約14:00）の
--       Notion AI 要約と文字起こし本文（ローカルの Notion データベースから読んだ）。予定表の予定は定例の繰り返し予定の各回。
-- 文字起こしの「山下さん」は山地さん（まさ）の聞き違いとして扱った（9/16 にフジミとメタルドゥの話をしたのは山地さん）。
-- 1. MTGカード2枚（narrative-gate の5見出し・500字以上・段落と箇条書きの形を生成時に確認）と議事録の取り込み台帳を recovered に
-- 2. 関係先: 新規11社（出資候補・共同開発・原料・委託先）、日本酸素・JFE・日亜化学を更新
-- 3. 技術タブ: 前処理の表の相手ごとの状況4行（日亜化学・住友金属鉱山・四国化成・ホンダ）を消す。中身は2の関係先へ移した（spec 3-20 §1.1）
-- 4. ゴールツリー: 到達点の下に「事業会社を中心に10億円を集め切れるか」と仮説・問い、分かったこと15件、やること9件。すべて提案（まさの承認待ち）
--    人事の個別の話と社内の雰囲気の細部は、共有ワークスペースの外部メンバーも見るゴールツリー・タスク・関係先に書かない（MTGカードはAMD内）
-- 生成: scratchpad の m454.py（コミットしない）

BEGIN;

INSERT INTO project_meeting_summaries (meeting_id, project_id, ym, meeting_date, meeting_start_at, title, notion_url, calendar_event_id,
  summary_short, decided, progress, next_actions, risks, source_hash, generated_at, generated_by_model, notion_page_id, source_kinds, narrative_md)
VALUES ($m$_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g64r3gghk6oskad1o8d0k8ghg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g74r38d1k74p36ghm852k8c1k690j0dq56p0kcc9l60q44e266l2g_20260916T040000Z$m$, 'p07', '202609', DATE '2026-09-16', TIMESTAMPTZ '2026-09-16 04:00:00+00', '【web】LiSTie経営会議', $m$https://www.notion.so/3dd97749c60881529128e80f6c7500ec$m$, $m$_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g64r3gghk6oskad1o8d0k8ghg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g74r38d1k74p36ghm852k8c1k690j0dq56p0kcc9l60q44e266l2g_20260916T040000Z$m$,
  $m$川崎は視察した9人中5人が目や喉の痛みを訴え、第三者の環境調査の結果で契約を判断することにした。家賃は月800万円から400万円まで下がった。整備費5億円に合わせて生産計画を下げ、2027年の売上20億円は難しい見通し。資金調達は新日本電工・SMBCHなどと面談し、バリュエーションは35億円を検討。$m$, $m$["川崎の拠点の環境調査は、JFE側ではなくLiSTieが第三者の機関に頼む（社員の安全と、リチウム回収に混ざる不純物の確認を兼ねる）。依頼書を先方に出す。", "9月30日の取締役会は10:00〜10:30。二拠点化の契約が間に合わなければ、月次報告で説明して書面決議にする。", "スタック組み立て用のジグ（税抜約130万円、納期12月25日）の購入を承認。開発用で仕様が変わると使えないため、消耗品として処理する。", "川崎市への申請は行政書士に頼む方向。笹島総合事務所（税抜250万円・前払い）の件に異論は出なかった。", "ユニット開発の採用候補1名に内定を出す。川崎の拠点がまだ確定していないことを通知に書く。", "廃液・匣鉢くずを「廃棄物」と呼ばず、「中間原料」「副産物」などの言い方に改める。"]$m$::jsonb, $m$["川崎の家賃は交渉で月800万円から600万円、400万円（面積は半分）まで下がった。事務所の費用も400万円に含める交渉を続けている。代わりの候補だった鹿島の物件は他社が買い取った。", "山地さんの紹介でフジミ（研磨材メーカー）と面談。出資は当面できないが、研磨のプロセスなどで共同開発ができないかを先方が社内で検討する。大阪のメタルドゥ（産業廃棄物の回収からレアアースの精製まで）もリチウムへの関心が高い。", "SMBCH（原さんの紹介）はリチウム回収と核融合の両方に関心。出資額は0.5〜11億円と幅があり、5億円程度が目安。今のファンドは残りが少なく、次のファンドからになりそう。", "新日本電工は9月9日に取締役専務執行役員が来訪し、膜の事業連携（共同開発）と出資に強い関心を示した。次回調達の大半を出す可能性にも触れた。", "グローバル・ブレインは、核融合ベンチャーはまだ材料まで意識が回っていない段階との見方。", "バリュエーションはこれまで30億円で計算しており、核融合分を5億円乗せた35億円を検討中。", "ニッケル・コバルトの精錬は、JOH・JX金属・日本化学産業と協業の交渉を続けている。インド・欧州からのブラックマス輸入は複数社と打ち合わせ中。", "生産計画を修正: 2026年は月1kgの炭酸リチウム、2027年第2四半期から月1t、第3四半期から炭酸・水酸化リチウム各月1t、2028年第3四半期から月50t。", "TYKでは10月5日から11月13日まで500時間の運転を予定。装置の撤去の余裕を含めて、契約を12月末まで延長する申請をしている。"]$m$::jsonb, $m$["NEDOの申請書の出資の欄に、既存投資家（UMIなど）の名前を書く（管理部）。", "川崎の家賃を、事務所の費用込みで月400万円に収める交渉を続ける（星野さん）。", "行政書士の委託先を決める。既存の行政書士への見積もりも検討する（管理部）。", "ガスケットの金型代の扱いを補助金の事務局に確認する。スタック組み立て用のジグは2社目の見積もりを取る（管理部）。", "新日本電工との事業連携（膜の共同開発、LZP膜の扱い）を整理する（事業開発部）。", "リーテムのブラックマスが品質の要求を満たすかを確認する（事業開発部）。", "TYKでの試験を12月末まで延長する合意を取る（技術開発部）。", "メタルドゥへ、山地さんが別件とあわせて10月以降に話をしにいく。", "比較対象の会社（ミレッソ）の調達額とバリュエーションを、PitchBookで確認する。", "人事担当の候補者と10月1日に東京で面談する（星野さん）。"]$m$::jsonb, $m$["川崎市が廃液・匣鉢くずを廃棄物と見なすと、LiSTieが廃棄物の取扱業者の扱いになり、環境アセスなどの申請に約2年かかる。有価で取引した実績を作る、廃棄物処理業者を買う、といった選択肢も挙がった。", "整備費5億円の範囲では当初の生産量に届かず、2027年の売上20億円は難しい。数値計画の作り直しが要る。", "投資家の関心は高い一方で、需要家の核融合ベンチャーからリチウム6の問い合わせが来ない。リチウム回収と核融合の2つの価値を足したバリュエーションの根拠をどう示すかが論点で、回収の方を事業会社中心で組む案も出た。", "新日本電工の出資は、LZP膜の技術連携が条件になる可能性がある。", "国内のリーテムは2年後に約2,000トンのブラックマスを出せる計画だが、品質の要求を満たすかは分からない。欧州からの輸入は輸出規制で難しい見込み。", "日亜化学の排液はpHが14を超えると上がらない現象があり、原因を調べている。電解装置（デノラ製）の購入を検討中。", "将来、月50t規模になったときの膜の安定調達のため、膜メーカーとの合弁（JV）を考える価値があるとの意見が出た。第2の供給元は約3億円の設備投資の資金が無いと言っている。"]$m$::jsonb,
  $m$h1-local-notion:93d165d5297c033b630fd11752a8b8985f57a98033a43fce62766b6fd04f5150$m$, NOW(), 'manual-amie-2026-09-30', $m$3dd97749-c608-8152-9128-e80f6c7500ec$m$, 'notion-local+calendar', $m$## 🎯背景
2026年9月16日の定例の経営会議（13:00〜14:30）。9月30日の取締役会を前に、川崎の新拠点の契約と環境、資金調達の状況、原料の調達、生産計画の見直しを確認した。前週に川崎の条件交渉が進んだ一方、拠点を見学した社員の体調不良が報告され、契約の進め方が論点になった。

## 📊経緯
冒頭で、NEDOの申請書の出資の欄に既存投資家（UMIなど）の名前を書くことを確認した。山地さんからは、紹介したフジミ（研磨材メーカー）との面談の結果と、大阪のメタルドゥへ改めて話をしにいく予定が共有された。9月30日の取締役会は10時からの30分に変え、川崎・柏の葉の二拠点化の契約が間に合わない場合は月次報告で説明して書面決議で対応すると決めた。川崎の拠点を見学した9人のうち5人が目や喉の痛みを訴え、元は塗装の工場だったこともあり、第三者の機関に環境調査を頼む方針になった（症状は土曜日までに全員消えた）。家賃は交渉で月800万円から400万円（面積は半分）まで下がり、事務所の費用も含める交渉を続けている。購買では、スタック組み立て用のジグを消耗品として承認し、ガスケットの金型代の扱いは補助金の事務局に確認する。川崎市への申請は行政書士に頼む方向で、笹島総合事務所の件に異論は出なかった。資金調達では、SMBCH、新日本電工、グローバル・ブレインとの面談が報告され、バリュエーションは35億円（核融合分5億円を上乗せ）を検討していると共有された。原料では、川崎市が廃液や匣鉢くずを廃棄物と見なすと申請に約2年かかるおそれが示され、呼び方の見直しや有価での取引実績づくりを議論した。技術開発からは、整備費5億円に合わせた生産計画の修正と、2027年の売上20億円は難しいとの見通しが報告された。次回は1週休み、9月30日（取締役会と同じ日）。

## ✅決まったこと
- 川崎の拠点の環境調査は、JFE側ではなくLiSTieが第三者の機関に頼む（社員の安全と、リチウム回収に混ざる不純物の確認を兼ねる）。依頼書を先方に出す。
- 9月30日の取締役会は10:00〜10:30。二拠点化の契約が間に合わなければ、月次報告で説明して書面決議にする。
- スタック組み立て用のジグ（税抜約130万円、納期12月25日）の購入を承認。開発用で仕様が変わると使えないため、消耗品として処理する。
- 川崎市への申請は行政書士に頼む方向。笹島総合事務所（税抜250万円・前払い）の件に異論は出なかった。
- ユニット開発の採用候補1名に内定を出す。川崎の拠点がまだ確定していないことを通知に書く。
- 廃液・匣鉢くずを「廃棄物」と呼ばず、「中間原料」「副産物」などの言い方に改める。

## ▶️次の一手
- NEDOの申請書の出資の欄に、既存投資家（UMIなど）の名前を書く（管理部）。
- 川崎の家賃を、事務所の費用込みで月400万円に収める交渉を続ける（星野さん）。
- 行政書士の委託先を決める。既存の行政書士への見積もりも検討する（管理部）。
- ガスケットの金型代の扱いを補助金の事務局に確認する。スタック組み立て用のジグは2社目の見積もりを取る（管理部）。
- 新日本電工との事業連携（膜の共同開発、LZP膜の扱い）を整理する（事業開発部）。
- リーテムのブラックマスが品質の要求を満たすかを確認する（事業開発部）。
- TYKでの試験を12月末まで延長する合意を取る（技術開発部）。
- メタルドゥへ、山地さんが別件とあわせて10月以降に話をしにいく。
- 比較対象の会社（ミレッソ）の調達額とバリュエーションを、PitchBookで確認する。
- 人事担当の候補者と10月1日に東京で面談する（星野さん）。

## ⚠️残課題
- 川崎市が廃液・匣鉢くずを廃棄物と見なすと、LiSTieが廃棄物の取扱業者の扱いになり、環境アセスなどの申請に約2年かかる。有価で取引した実績を作る、廃棄物処理業者を買う、といった選択肢も挙がった。
- 整備費5億円の範囲では当初の生産量に届かず、2027年の売上20億円は難しい。数値計画の作り直しが要る。
- 投資家の関心は高い一方で、需要家の核融合ベンチャーからリチウム6の問い合わせが来ない。リチウム回収と核融合の2つの価値を足したバリュエーションの根拠をどう示すかが論点で、回収の方を事業会社中心で組む案も出た。
- 新日本電工の出資は、LZP膜の技術連携が条件になる可能性がある。
- 国内のリーテムは2年後に約2,000トンのブラックマスを出せる計画だが、品質の要求を満たすかは分からない。欧州からの輸入は輸出規制で難しい見込み。
- 日亜化学の排液はpHが14を超えると上がらない現象があり、原因を調べている。電解装置（デノラ製）の購入を検討中。
- 将来、月50t規模になったときの膜の安定調達のため、膜メーカーとの合弁（JV）を考える価値があるとの意見が出た。第2の供給元は約3億円の設備投資の資金が無いと言っている。$m$)
ON CONFLICT (meeting_id) DO UPDATE SET summary_short = EXCLUDED.summary_short, decided = EXCLUDED.decided, progress = EXCLUDED.progress,
  next_actions = EXCLUDED.next_actions, risks = EXCLUDED.risks, narrative_md = EXCLUDED.narrative_md, notion_url = EXCLUDED.notion_url,
  notion_page_id = EXCLUDED.notion_page_id, source_kinds = EXCLUDED.source_kinds, source_hash = EXCLUDED.source_hash,
  generated_by_model = EXCLUDED.generated_by_model, generated_at = NOW(), updated_at = NOW();

INSERT INTO meeting_minutes_backfill_ledger (calendar_event_id, project_id, title, meeting_start_at, meeting_end_at, status, attempt_count, max_attempts,
  first_detected_at, last_attempt_at, last_outcome, detected_by, notes, created_at, updated_at)
VALUES ($m$_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g64r3gghk6oskad1o8d0k8ghg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g74r38d1k74p36ghm852k8c1k690j0dq56p0kcc9l60q44e266l2g_20260916T040000Z$m$, 'p07', '【web】LiSTie経営会議', TIMESTAMPTZ '2026-09-16 04:00:00+00', TIMESTAMPTZ '2026-09-16 05:30:00+00', 'recovered', 0, 5, NOW(), NOW(), 'backfilled_manually', 'manual',
  'Notionのローカル記録（要約と文字起こし）から手動でカードを作成（2026-09-30、migration 454）', NOW(), NOW())
ON CONFLICT (calendar_event_id) DO UPDATE SET status = 'recovered', last_outcome = 'backfilled_manually', notes = EXCLUDED.notes, updated_at = NOW();

INSERT INTO project_meeting_summaries (meeting_id, project_id, ym, meeting_date, meeting_start_at, title, notion_url, calendar_event_id,
  summary_short, decided, progress, next_actions, risks, source_hash, generated_at, generated_by_model, notion_page_id, source_kinds, narrative_md)
VALUES ($m$_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g64r3gghk6oskad1o8d0k8ghg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g74r38d1k74p36ghm852k8c1k690j0dq56p0kcc9l60q44e266l2g_20260930T040000Z$m$, 'p07', '202609', DATE '2026-09-30', TIMESTAMPTZ '2026-09-30 04:00:00+00', '【web】LiSTie経営会議', $m$https://www.notion.so/3eb97749c608817884b1ed7aceaa17af$m$, $m$_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g64r3gghk6oskad1o8d0k8ghg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g74r38d1k74p36ghm852k8c1k690j0dq56p0kcc9l60q44e266l2g_20260930T040000Z$m$,
  $m$取締役会の後の短い経営会議。LiSMIC評価用ヒーターの購入と、炭酸リチウムのスケールアップ試験の木村加工機械への委託（税抜130万円）を決議。日本酸素（希望1億円）・四国化成が出資に前向きで、LOIのドラフトをレビュー中。エクイティストーリーは、リサイクル・回収を近い収益の柱にし、核融合向けリチウム6はアップサイドとして説明する方針。$m$, $m$["LiSMIC評価用の連続運転用ヒーター（税抜100万円超、SBIR、納期10月末、2社見積）の購入を承認。勘定科目は機械設備費に直す。", "炭酸リチウムのスケールアップ初期検討試験（設備とプロセスの検討）を、木村加工機械に全面委託する（SBIRの外注費、税抜130万円、納期12月25日、後払い）。", "エクイティストーリー: 近い収益の柱はリチウムのリサイクル・回収から塩湖かん水の精製。核融合向けリチウム6はIPO以降の大きな話として、事業計画には織り込まずアップサイドとして説明する。", "川崎は、健康への影響の確認と、移転そのものへの抵抗を切り離して扱う。健康への影響は必ず確かめ、入居までに清掃と空気の入れ替えを行う。", "柏の葉のパート1名の契約は12月末まで延長したうえで終了し、業務を引き継ぐ。"]$m$::jsonb, $m$["前回からの確認: JFE関連の件は完了。フジミは山地さんが進捗を確かめた。", "日本酸素は出資に前向きで、希望額は1億円（ガス会社として核融合燃料のトリチウム供給に関心。J-Fusionの参加企業）。核融合向けの資金を回収・濃縮の開発に充てることにも担当者は前向き。", "四国化成は本体からの出資に強い関心。日本材料技研（JMTC）とは別に単独で話が進んでいる。新日本電工も関心が高い。", "日本酸素・四国化成へLOIのドラフトを送り、先方がレビュー中。", "ABSベンチャーズは関心がリチウム回収の方に寄っており、1社あたりの出資は累計4億円が上限。", "川崎の賃貸借契約は先方がレビュー中。環境・健康の測定は3社に見積を頼んでおり、早くて10月下旬。アスベストなどだけでも先に報告してもらうよう頼んだ。", "10月1日に2名が着任する（手続き中）。", "月170〜200万円台の低い支出（バーンレート）は投資家から高く評価されている。"]$m$::jsonb, $m$["再来週のメタルドゥとの面談で、LiSTieを紹介する（山地さん）。", "ヒーター購入の決議を機械設備費に直して、決裁の処理をする（管理部）。", "炭酸リチウムのスケールアップ試験を木村加工機械に正式に発注する（技術開発部）。", "日本酸素・四国化成のLOIのレビュー結果を受けて、締結に進める（星野さん）。", "ABSベンチャーズとは付き合いを続ける（事業開発部）。", "ほかの投資家との面談で、核融合向けの資金を回収の開発にも使ってよいかを確かめる（事業開発部）。", "川崎の健康影響・環境の測定を急ぐ。急ぐなら健康面だけJFEに頼むことも検討する（管理部）。", "川崎の清掃と空気の入れ替えを手配し、社内のメンバー1〜2名にも加わってもらって、状況を社内に伝えてもらう（管理部）。", "研究開発から製造の段階に移ることへの覚悟を、健康の話と切り離して社内に伝える（星野さん）。", "10月1日に着任する2名の手続きを進め、人事担当の候補者と10月1日に東京で面談する。採用候補1名は川崎への移転が決まってから改めて判断する（星野さん・管理部）。", "社員向けのマンスリーマンションの候補を絞り、会社として決める（管理部）。"]$m$::jsonb, $m$["環境・健康の測定の結果は早くて10月下旬で、それまで契約と移転の判断が決まらない。", "社内に移転に否定的な声があり、測定で問題が出なくても移転を拒まれる懸念がある。現地を見た社員が「普通だ」と伝える方が効くとの意見。", "日亜化学・住友金属鉱山向けのサンプルは、クリーンルーム（約2億円）が無いと川崎では作れない。整備費が出せないため、後処理（粉末づくり）は柏の葉のラボに残す案を検討中。評価がもらえないままシリーズAを迎える可能性もある。", "リチウム6を作れるのが当社だけかの検証が進んでいない。核融合ベンチャーの側ではリチウム6の重要性がまだ認識されておらず、働きかけが要る。", "5%で2億円規模の出資という発言があったが、どの会社の話かは文字起こしでは確定できない（Notionの要約は四国化成としている）。"]$m$::jsonb,
  $m$h1-local-notion:30cceebaa2482c5a51f5c30fd4886f1e3b9f1c4b62ad63ab143db9b27e8b9dab$m$, NOW(), 'manual-amie-2026-09-30', $m$3eb97749-c608-8178-84b1-ed7aceaa17af$m$, 'notion-local+calendar', $m$## 🎯背景
2026年9月30日の定例の経営会議（13:00〜14:00）。同じ日の午前に取締役会を開いたため、短い確認の会にした（UMIからの出席はなし。木場さんは途中から参加）。決議2件のほか、資金調達の先ごとの感触とエクイティストーリーの方針、川崎の新拠点の環境の問題、人事と採用を扱った。

## 📊経緯
前回からの確認では、JFE関連の件は完了とし、フジミは山地さんが進捗を確かめた。決議では、LiSMICの評価に使う連続運転用のヒーターの購入を、勘定科目を機械設備費に直して承認した。顧客候補が水酸化リチウムではなく炭酸リチウムを求めているため、炭酸リチウム向けの設備とプロセスの検討を木村加工機械に全面委託することも決めた。水酸化リチウムの試験では、水を蒸発させる工程で配管などから金属が混ざる問題があり、炭酸リチウムでも同じ観点で設備を評価する。資金調達では、日本酸素と四国化成が前向きで、両社にLOIのドラフトを送ってレビューしてもらっている。日本酸素の担当者は、核融合向けに出した資金をリチウム回収の開発に使うことにも前向きで、多段の濃縮の一段目が回収装置そのものだという説明で社内を通せるとの見方だった。ABSベンチャーズは関心がリチウム回収の方に寄っており、前向きさは低い。木場さんが加わった後にエクイティストーリーを議論し、近い収益はリチウムのリサイクル・回収から塩湖かん水の精製へつなぎ、核融合向けリチウム6はIPO以降の大きな話として事業計画に織り込まずアップサイドで説明する方針で一致した。勢いのある今のうちに集められるだけ集めるべきとの意見も出た。川崎の件では、賃貸借契約は先方がレビュー中で、環境・健康の測定は3社に見積を頼んで早くて10月下旬。社内には移転に否定的な声があり、健康への影響の確認と移転そのものへの抵抗を切り離して扱う方針を確認した。人事では、パート1名の契約の扱い、10月1日の着任、採用の保留、社員向けの住まいを確認した。

## ✅決まったこと
- LiSMIC評価用の連続運転用ヒーター（税抜100万円超、SBIR、納期10月末、2社見積）の購入を承認。勘定科目は機械設備費に直す。
- 炭酸リチウムのスケールアップ初期検討試験（設備とプロセスの検討）を、木村加工機械に全面委託する（SBIRの外注費、税抜130万円、納期12月25日、後払い）。
- エクイティストーリー: 近い収益の柱はリチウムのリサイクル・回収から塩湖かん水の精製。核融合向けリチウム6はIPO以降の大きな話として、事業計画には織り込まずアップサイドとして説明する。
- 川崎は、健康への影響の確認と、移転そのものへの抵抗を切り離して扱う。健康への影響は必ず確かめ、入居までに清掃と空気の入れ替えを行う。
- 柏の葉のパート1名の契約は12月末まで延長したうえで終了し、業務を引き継ぐ。

## ▶️次の一手
- 再来週のメタルドゥとの面談で、LiSTieを紹介する（山地さん）。
- ヒーター購入の決議を機械設備費に直して、決裁の処理をする（管理部）。
- 炭酸リチウムのスケールアップ試験を木村加工機械に正式に発注する（技術開発部）。
- 日本酸素・四国化成のLOIのレビュー結果を受けて、締結に進める（星野さん）。
- ABSベンチャーズとは付き合いを続ける（事業開発部）。
- ほかの投資家との面談で、核融合向けの資金を回収の開発にも使ってよいかを確かめる（事業開発部）。
- 川崎の健康影響・環境の測定を急ぐ。急ぐなら健康面だけJFEに頼むことも検討する（管理部）。
- 川崎の清掃と空気の入れ替えを手配し、社内のメンバー1〜2名にも加わってもらって、状況を社内に伝えてもらう（管理部）。
- 研究開発から製造の段階に移ることへの覚悟を、健康の話と切り離して社内に伝える（星野さん）。
- 10月1日に着任する2名の手続きを進め、人事担当の候補者と10月1日に東京で面談する。採用候補1名は川崎への移転が決まってから改めて判断する（星野さん・管理部）。
- 社員向けのマンスリーマンションの候補を絞り、会社として決める（管理部）。

## ⚠️残課題
- 環境・健康の測定の結果は早くて10月下旬で、それまで契約と移転の判断が決まらない。
- 社内に移転に否定的な声があり、測定で問題が出なくても移転を拒まれる懸念がある。現地を見た社員が「普通だ」と伝える方が効くとの意見。
- 日亜化学・住友金属鉱山向けのサンプルは、クリーンルーム（約2億円）が無いと川崎では作れない。整備費が出せないため、後処理（粉末づくり）は柏の葉のラボに残す案を検討中。評価がもらえないままシリーズAを迎える可能性もある。
- リチウム6を作れるのが当社だけかの検証が進んでいない。核融合ベンチャーの側ではリチウム6の重要性がまだ認識されておらず、働きかけが要る。
- 5%で2億円規模の出資という発言があったが、どの会社の話かは文字起こしでは確定できない（Notionの要約は四国化成としている）。$m$)
ON CONFLICT (meeting_id) DO UPDATE SET summary_short = EXCLUDED.summary_short, decided = EXCLUDED.decided, progress = EXCLUDED.progress,
  next_actions = EXCLUDED.next_actions, risks = EXCLUDED.risks, narrative_md = EXCLUDED.narrative_md, notion_url = EXCLUDED.notion_url,
  notion_page_id = EXCLUDED.notion_page_id, source_kinds = EXCLUDED.source_kinds, source_hash = EXCLUDED.source_hash,
  generated_by_model = EXCLUDED.generated_by_model, generated_at = NOW(), updated_at = NOW();

INSERT INTO meeting_minutes_backfill_ledger (calendar_event_id, project_id, title, meeting_start_at, meeting_end_at, status, attempt_count, max_attempts,
  first_detected_at, last_attempt_at, last_outcome, detected_by, notes, created_at, updated_at)
VALUES ($m$_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g64r3gghk6oskad1o8d0k8ghg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g74r38d1k74p36ghm852k8c1k690j0dq56p0kcc9l60q44e266l2g_20260930T040000Z$m$, 'p07', '【web】LiSTie経営会議', TIMESTAMPTZ '2026-09-30 04:00:00+00', TIMESTAMPTZ '2026-09-30 05:30:00+00', 'recovered', 0, 5, NOW(), NOW(), 'backfilled_manually', 'manual',
  'Notionのローカル記録（要約と文字起こし）から手動でカードを作成（2026-09-30、migration 454）', NOW(), NOW())
ON CONFLICT (calendar_event_id) DO UPDATE SET status = 'recovered', last_outcome = 'backfilled_manually', notes = EXCLUDED.notes, updated_at = NOW();

INSERT INTO project_management_partners (
  project_id, slug, name, role_label, primary_track, relationship_stage, agreement_state, agreed_scope, unagreed_scope,
  last_contact_date, next_commitment, owner_label, last_verified_at, confidence, source_kind, source_ref, sort_order,
  current_ball_side, current_ball_owner, target_state, activity_state, customer_value, classifications, introducer_label, due_date_precision
)
SELECT 'p07', v.slug, v.name, v.role_label, v.track, v.stage, v.agreement, v.agreed, v.unagreed,
  v.last_contact::date, v.next_commitment, v.owner, DATE '2026-09-30', v.confidence, 'manual', v.source_ref, v.sort_order,
  v.ball_side, v.ball_owner, v.target_state, v.activity, v.customer_value, v.classifications::text[], v.introducer, 'unknown'
FROM (VALUES
  ($m$fund-shikoku-kasei$m$, $m$四国化成$m$, $m$出資候補・引き合い先（全固体電池用リチウムの高純度化）$m$, $m$funding$m$, $m$condition_alignment$m$, $m$partial$m$, $m$本体からの出資に強い関心。日本材料技研（JMTC）とは別に単独で話が進んでいる。LOIのドラフトを送り、先方がレビュー中（2026-09-30 経営会議）。全固体電池用リチウム（水素化リチウム）の純度不良品を高純度化する引き合いがあり、枠組みを議論している（2026-09-02 経営会議。技術タブから移した内容）。$m$, $m$LOIの締結、出資の条件。高純度化の引き合いを用途として立てるか。Notionの要約には5%・2億円規模の出資の示唆とあるが、文字起こしでは会社の特定があいまい。$m$, NULL, $m$LOIのレビュー結果を受けて締結する。$m$, $m$星野さん$m$, $m$medium$m$, $m$2026-09-02・09-30 LiSTie経営会議（Notion文字起こし）$m$, 505, $m$partner$m$, $m$四国化成$m$, $m$LOIの締結と出資の条件の合意$m$, $m$waiting_partner$m$, NULL, $m${vc}$m$, NULL),
  ($m$fund-shin-nihon-denko$m$, $m$新日本電工$m$, $m$出資候補・膜の事業連携の相手$m$, $m$funding$m$, $m$information_exchange$m$, $m$unagreed$m$, $m$9月9日に取締役専務執行役員が来訪。膜の事業連携（共同開発）と出資に強い関心を示し、次回調達の大半を出す可能性にも触れた（2026-09-16 経営会議）。9月30日の経営会議でも関心は高いと報告。$m$, $m$出資の条件。LZP膜の技術連携を出資の条件にするか（同社の膜材料の評価は技術タブ「膜の材料・表面処理・供給」）。$m$, NULL, $m$膜の共同開発とLZP膜の扱いを整理して、条件を詰める。$m$, $m$事業開発部$m$, $m$medium$m$, $m$2026-09-16・09-30 LiSTie経営会議（Notion文字起こし）$m$, 510, $m$sx$m$, $m$LiSTie$m$, $m$事業連携と出資の条件の合意$m$, $m$active$m$, NULL, $m${vc}$m$, NULL),
  ($m$fund-smbch$m$, $m$SMBCH$m$, $m$出資候補（VC）$m$, $m$funding$m$, $m$information_exchange$m$, $m$unagreed$m$, $m$9月に面談。リチウム回収と核融合の両方に関心。出資額は0.5〜11億円と幅があり、5億円程度が目安（2026-09-16 経営会議）。$m$, $m$今のファンドは残りが少なく、次のファンドからの出資になりそう。正式な社名は会議の記録だけでは確かめられない。$m$, NULL, $m$次のファンドの時期を確かめながら関係を続ける。$m$, $m$事業開発部$m$, $m$low$m$, $m$2026-09-16 LiSTie経営会議（Notion文字起こし）$m$, 515, $m$shared$m$, NULL, $m$次のファンドでの出資の検討$m$, $m$active$m$, NULL, $m${vc}$m$, $m$原さん$m$),
  ($m$fund-global-brain$m$, $m$グローバル・ブレイン$m$, $m$出資候補（VC）$m$, $m$funding$m$, $m$information_exchange$m$, $m$unagreed$m$, $m$9月上旬に紹介で面談。核融合ベンチャーはまだ材料まで意識が回っていない段階との見方を聞いた（2026-09-16 経営会議）。$m$, $m$出資の検討。$m$, NULL, $m$関係を続ける。$m$, $m$事業開発部$m$, $m$low$m$, $m$2026-09-16 LiSTie経営会議（Notion文字起こし）$m$, 520, $m$shared$m$, NULL, $m$出資の検討$m$, $m$active$m$, NULL, $m${vc}$m$, NULL),
  ($m$fund-abs-ventures$m$, $m$ABSベンチャーズ$m$, $m$出資候補（VC）$m$, $m$funding$m$, $m$information_exchange$m$, $m$unagreed$m$, $m$9月に面談（先方3名）。関心はリチウム回収の方に寄っている。1社あたりの出資は累計4億円が上限（2026-09-30 経営会議）。$m$, $m$出資の検討（前向きさは低いとの見立て）。$m$, NULL, $m$付き合いを続ける。$m$, $m$事業開発部$m$, $m$low$m$, $m$2026-09-30 LiSTie経営会議（Notion文字起こし）$m$, 525, $m$shared$m$, NULL, $m$出資の検討$m$, $m$active$m$, NULL, $m${vc}$m$, NULL),
  ($m$bd-fujimi$m$, $m$フジミインコーポレーテッド$m$, $m$共同開発の候補（研磨材メーカー）$m$, $m$business_development$m$, $m$information_exchange$m$, $m$unagreed$m$, $m$9月に面談し、現状を共有した。出資は当面できないが、研磨のプロセスなどで共同開発ができないかを先方が社内で検討する。膜技術の概要は共有済み（2026-09-16 経営会議）。9月30日の時点で山地さんが進捗を確かめた。$m$, $m$共同開発のテーマにするかの先方の判断。出資は難しいが、合弁（JV）なら加わりやすいとの見方もある。$m$, NULL, $m$先方からの連絡を待つ。$m$, $m$山地さん$m$, $m$low$m$, $m$2026-09-16・09-30 LiSTie経営会議（Notion文字起こし）$m$, 170, $m$partner$m$, $m$フジミインコーポレーテッド$m$, $m$共同開発のテーマの合意$m$, $m$waiting_partner$m$, NULL, $m${}$m$, $m$山地さん$m$),
  ($m$bd-metaldo$m$, $m$メタルドゥ（大阪）$m$, $m$リチウムに関心のある金属リサイクル会社$m$, $m$business_development$m$, $m$meeting_coordination$m$, $m$unagreed$m$, $m$産業廃棄物の回収からレアアースの精製まで手がけ、リチウムへの関心が高い（2026-09-16 経営会議）。再来週に面談が設定された（2026-09-30 経営会議）。$m$, $m$LiSTieとの連携の可能性。$m$, NULL, $m$面談で山地さんがLiSTieを紹介する。$m$, $m$山地さん$m$, $m$low$m$, $m$2026-09-16・09-30 LiSTie経営会議（Notion文字起こし）$m$, 175, $m$sx$m$, $m$山地さん$m$, $m$連携の可能性を見極める$m$, $m$active$m$, NULL, $m${}$m$, $m$山地さん$m$),
  ($m$feed-reetem$m$, $m$リーテム$m$, $m$ブラックマス供給候補（国内）$m$, $m$business_development$m$, $m$information_exchange$m$, $m$unagreed$m$, $m$2年後に約2,000トンのブラックマスを出せる計画がある（2026-09-16 経営会議）。$m$, $m$LiSTieが求める品質を満たすか。$m$, NULL, $m$品質の基準と現状を確認する。$m$, $m$事業開発部$m$, $m$low$m$, $m$2026-09-16 LiSTie経営会議（Notion文字起こし）$m$, 165, $m$sx$m$, $m$事業開発部$m$, $m$品質の確認$m$, $m$active$m$, NULL, $m${}$m$, NULL),
  ($m$cust-honda$m$, $m$ホンダ$m$, $m$引き合い（北米のLFP工場のリサイクル）$m$, $m$business_development$m$, $m$information_exchange$m$, $m$unagreed$m$, $m$北米のLFP工場のリサイクルについて引き合いがあり、議論している（2026-09-02 経営会議。技術タブから移した内容）。$m$, $m$LFPのブラックマスは、輸入の手続きと溶かす工程の難しさが残る（2026年7月の経営会議）。$m$, NULL, $m$議論を続ける。$m$, $m$事業開発部$m$, $m$low$m$, $m$2026-09-02 LiSTie経営会議$m$, 180, $m$shared$m$, NULL, $m$リサイクルの協業の形を決める$m$, $m$active$m$, NULL, $m${}$m$, NULL),
  ($m$tech-kimura$m$, $m$木村加工機械$m$, $m$炭酸リチウムの設備・プロセス検討の委託先$m$, $m$technology_development$m$, $m$agreement_confirmation$m$, $m$agreed$m$, $m$炭酸リチウムのスケールアップ初期検討試験（設備とプロセスの検討）を全面委託することを決議（SBIRの外注費、税抜130万円、納期12月25日、後払い。2026-09-30 経営会議）。$m$, $m$正式な発注と、試験の結果。$m$, NULL, $m$正式に発注する。$m$, $m$技術開発部$m$, $m$high$m$, $m$2026-09-30 LiSTie経営会議（Notion文字起こし）$m$, 430, $m$sx$m$, $m$技術開発部$m$, $m$試験の結果を受け取る$m$, $m$active$m$, NULL, $m${tech_partner}$m$, NULL),
  ($m$org-sasajima$m$, $m$笹島総合事務所（行政書士）$m$, $m$川崎市への申請の委託先候補$m$, $m$organizational_building$m$, $m$condition_alignment$m$, $m$partial$m$, $m$川崎市への申請を引き受けられるとの返事（税抜250万円・前払い）。2026-09-16 の経営会議で審議し、異論は出なかった。$m$, $m$委託の確定（既存の行政書士への見積もりも検討）。費用を補助金のどの区分から出すか。$m$, NULL, $m$委託先を決めて、申請の準備を始める。$m$, $m$管理部$m$, $m$medium$m$, $m$2026-09-16 LiSTie経営会議（Notion文字起こし）$m$, 620, $m$sx$m$, $m$管理部$m$, $m$委託契約$m$, $m$active$m$, NULL, $m${}$m$, NULL)
) AS v(slug, name, role_label, track, stage, agreement, agreed, unagreed, last_contact, next_commitment, owner, confidence, source_ref, sort_order,
       ball_side, ball_owner, target_state, activity, customer_value, classifications, introducer)
ON CONFLICT (project_id, slug) DO NOTHING;

UPDATE project_management_partners SET role_label = $m$キングサーモンの連携先・出資候補$m$, agreed_scope = $m$キングサーモンプロジェクト（核融合炉向けの開発資金、最大3億円）に連携して申請する。出資にも前向きで、希望額は1億円（ガス会社として核融合燃料のトリチウム供給に関心。J-Fusionの参加企業）。核融合向けの資金を回収・濃縮の開発に充てることにも担当者は前向き。LOIのドラフトを送り、先方がレビュー中（2026-09-30 経営会議）。$m$, unagreed_scope = $m$LOIの締結、出資の条件（金額・時期）。キングサーモン本申請の役割分担と時期。$m$, next_commitment = $m$LOIのレビュー結果を受けて締結する。$m$, current_ball_side = $m$partner$m$, current_ball_owner = $m$日本酸素$m$, activity_state = $m$waiting_partner$m$, source_ref = $m$2026年9月取締役会資料／2026-09-30 LiSTie経営会議（Notion文字起こし）$m$, classifications = ARRAY['vc']::text[], last_verified_at = DATE '2026-09-30', updated_at = NOW() WHERE project_id = 'p07' AND slug = $m$fund-nippon-sanso$m$;

UPDATE project_management_partners SET agreed_scope = $m$敷金1,500万円（当初6,000万円）、面積3,000㎡（当初6,000㎡）、月額賃料400万円（当初800万円）で概ね合意。賃貸借契約書は先方がレビュー中で、返答がそろってから弁護士の最終確認を取る（2026-09-30 経営会議）。$m$, next_commitment = $m$環境・健康の測定（3社に見積を依頼中、早くて10月下旬）の結果で契約を判断する。急ぐなら健康面の測定だけJFEに頼む案もある。$m$, source_ref = $m$2026年9月取締役会資料 p.3／2026-09-30 取締役会・経営会議$m$, last_verified_at = DATE '2026-09-30', updated_at = NOW() WHERE project_id = 'p07' AND slug = $m$org-jfe-ogimachi$m$;

UPDATE project_management_partners SET agreed_scope = $m$匣鉢と未利用のリチウム溶液の事業性を議論中。調達計画では2027年に各12トン、2028年に水酸化リチウム換算で各約30トン。未利用のリチウム溶液は実液がラボに届き、製造計画を立てている（2026-09-02 経営会議。技術タブから移した内容）。$m$, last_verified_at = DATE '2026-09-30', updated_at = NOW() WHERE project_id = 'p07' AND slug = $m$feed-nichia$m$;

DO $$
DECLARE n int;
BEGIN
  DELETE FROM project_tech_entries WHERE project_id = 'p07' AND tech_entry_id IN ('pte_lst_pre_nichia', 'pte_lst_pre_smm', 'pte_lst_pre_shikoku', 'pte_lst_pre_honda');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION '454: 技術タブから移す4行のうち % 行しか見つからない', n; END IF;
END $$;

INSERT INTO project_questions (
  id, project_id, parent_id, contribution, title, background, question_kind, status, answer, answered_on, answered_by,
  confidence, owner_label, due_date, origin_kind, origin_ref, sort_order, last_verified_at, created_by, updated_by,
  client_token, review_state, proposed_parent_id, proposed_contribution, proposal_reason, children_logic
)
SELECT v.id::uuid, 'p07', NULL, NULL, v.title, v.background, v.kind, 'open', NULL, NULL, NULL,
  v.confidence, v.owner, v.due::date, 'meeting', $m$meeting:_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g64r3gghk6oskad1o8d0k8ghg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g74r38d1k74p36ghm852k8c1k690j0dq56p0kcc9l60q44e266l2g_20260930T040000Z$m$, v.sort_order, DATE '2026-09-30', 'amie', 'amie',
  v.id::uuid, 'proposed', v.parent::uuid, v.contribution, v.reason, v.logic
FROM (VALUES
  ($m$07000000-2026-4930-8000-000000000137$m$, $m$07000000-2026-4930-8000-000000000101$m$, $m$required$m$, $m$open$m$, $m$事業会社を中心に、シリーズAの10億円を集め切れるか$m$, $m$2026-09-16・09-30 経営会議: 日本酸素・四国化成・新日本電工など事業会社の関心が強く、今回のラウンドは事業会社中心で組めると良いとの意見。勢いのある今のうちに集められるだけ集める方針。$m$, $m$medium$m$, $m$星野さん・事業開発部$m$, $m$2027-09-30$m$, 5, $m$all$m$, $m$9/16・9/30 経営会議で資金調達の中身が具体的になったため、到達点の直下に置いた。まさの承認待ち。$m$),
  ($m$07000000-2026-4930-8000-000000000138$m$, $m$07000000-2026-4930-8000-000000000137$m$, $m$required$m$, $m$hypothesis$m$, $m$リサイクルで地に足のついた収益を示し、核融合向けリチウム6は唯一の供給元になり得るアップサイドとして語れば、投資家に通る$m$, $m$2026-09-30 経営会議で合意したエクイティストーリー。近い収益はリチウムのリサイクル・回収から塩湖かん水の精製へ。核融合向けリチウム6はIPO以降の大きな話として、事業計画には織り込まない。$m$, $m$medium$m$, $m$星野さん$m$, NULL, 10, $m$all$m$, $m$9/30 経営会議で合意した説明の仕方。まさの承認待ち。$m$),
  ($m$07000000-2026-4930-8000-000000000139$m$, $m$07000000-2026-4930-8000-000000000137$m$, $m$required$m$, $m$open$m$, $m$リチウム6を作れるのが当社だけかを確かめられるか$m$, $m$2026-09-30 経営会議: 独占性の検証はまだ手が回っていない。投資家は重要性を認識しているが、核融合ベンチャーの側ではまだ材料まで意識が回っていない。$m$, $m$low$m$, $m$事業開発部・技術開発部$m$, NULL, 20, $m$all$m$, $m$エクイティストーリーの前提になる点として挙がった。まさの承認待ち。$m$)
) AS v(id, parent, contribution, kind, title, background, confidence, owner, due, sort_order, logic, reason)
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_findings (
  id, project_id, summary, finding_kind, observed_on, source_label, source_url, confidence, sort_order,
  last_verified_at, created_by, updated_by, client_token, review_state, proposed_question_id, proposal_reason
)
SELECT v.id::uuid, 'p07', v.summary, v.kind, v.observed::date, v.source, v.url, v.confidence, v.sort_order,
  DATE '2026-09-30', 'amie', 'amie', v.id::uuid, 'proposed', v.question::uuid, '2026-09-16・09-30 経営会議の文字起こしから。まさの承認待ち。'
FROM (VALUES
  ($m$07000000-2026-4930-8000-000000000411$m$, $m$07000000-2026-4930-8000-000000000137$m$, $m$supports$m$, $m$2026-09-30$m$, $m$日本酸素は出資に前向きで、希望額は1億円。ガス会社として核融合燃料のトリチウム供給に関心がある（J-Fusionの参加企業）。LOIのドラフトを送り、先方がレビュー中。核融合向けの資金を回収・濃縮の開発に充てることにも担当者は前向き。$m$, $m$2026-09-30 LiSTie経営会議（Notion文字起こし）$m$, $m$https://www.notion.so/3eb97749c608817884b1ed7aceaa17af$m$, $m$medium$m$, 10),
  ($m$07000000-2026-4930-8000-000000000412$m$, $m$07000000-2026-4930-8000-000000000137$m$, $m$supports$m$, $m$2026-09-30$m$, $m$四国化成は本体からの出資に強い関心があり、LOIのドラフトを送って先方がレビュー中。日本材料技研（JMTC）とは別に単独で話が進んでいる。$m$, $m$2026-09-30 LiSTie経営会議（Notion文字起こし）$m$, $m$https://www.notion.so/3eb97749c608817884b1ed7aceaa17af$m$, $m$medium$m$, 20),
  ($m$07000000-2026-4930-8000-000000000413$m$, $m$07000000-2026-4930-8000-000000000137$m$, $m$supports$m$, $m$2026-09-16$m$, $m$新日本電工の取締役専務執行役員が来訪し、膜の事業連携（共同開発）と出資に強い関心を示した。次回調達の大半を出す可能性にも触れた一方、LZP膜の技術連携が条件になる可能性がある。$m$, $m$2026-09-16 LiSTie経営会議（Notion文字起こし）$m$, $m$https://www.notion.so/3dd97749c60881529128e80f6c7500ec$m$, $m$medium$m$, 30),
  ($m$07000000-2026-4930-8000-000000000414$m$, $m$07000000-2026-4930-8000-000000000137$m$, $m$neutral$m$, $m$2026-09-16$m$, $m$SMBCHはリチウム回収と核融合の両方に関心。出資額は0.5〜11億円と幅があり、5億円程度が目安。今のファンドは残りが少なく、次のファンドからの出資になりそう。$m$, $m$2026-09-16 LiSTie経営会議（Notion文字起こし）$m$, $m$https://www.notion.so/3dd97749c60881529128e80f6c7500ec$m$, $m$low$m$, 40),
  ($m$07000000-2026-4930-8000-000000000415$m$, $m$07000000-2026-4930-8000-000000000137$m$, $m$neutral$m$, $m$2026-09-30$m$, $m$ABSベンチャーズは関心がリチウム回収の方に寄っており、1社あたりの出資は累計4億円が上限。前向きさは低いが付き合いは続ける。$m$, $m$2026-09-30 LiSTie経営会議（Notion文字起こし）$m$, $m$https://www.notion.so/3eb97749c608817884b1ed7aceaa17af$m$, $m$low$m$, 50),
  ($m$07000000-2026-4930-8000-000000000416$m$, $m$07000000-2026-4930-8000-000000000137$m$, $m$neutral$m$, $m$2026-09-16$m$, $m$バリュエーションはこれまで30億円で計算しており、核融合分を5億円乗せた35億円を検討中。リチウム回収と核融合の2つの価値を足す根拠をどう示すかが論点で、回収の方を事業会社中心で組む案も出た。$m$, $m$2026-09-16 LiSTie経営会議（Notion文字起こし）$m$, $m$https://www.notion.so/3dd97749c60881529128e80f6c7500ec$m$, $m$medium$m$, 60),
  ($m$07000000-2026-4930-8000-000000000417$m$, $m$07000000-2026-4930-8000-000000000138$m$, $m$supports$m$, $m$2026-09-30$m$, $m$近い収益はリサイクル・回収から塩湖かん水の精製へ、核融合向けリチウム6は事業計画に織り込まずアップサイドとして説明する方針で合意した。月170〜200万円台の低い支出（バーンレート）は投資家から高く評価されている。$m$, $m$2026-09-30 LiSTie経営会議（Notion文字起こし）$m$, $m$https://www.notion.so/3eb97749c608817884b1ed7aceaa17af$m$, $m$medium$m$, 10),
  ($m$07000000-2026-4930-8000-000000000418$m$, $m$07000000-2026-4930-8000-000000000139$m$, $m$missing$m$, $m$2026-09-30$m$, $m$リチウム6を作れるのが当社だけかの検証は、まだ手が回っていない。需要側に重要性を認識してもらう働きかけも要る。$m$, $m$2026-09-30 LiSTie経営会議（Notion文字起こし）$m$, $m$https://www.notion.so/3eb97749c608817884b1ed7aceaa17af$m$, $m$medium$m$, 10),
  ($m$07000000-2026-4930-8000-000000000419$m$, $m$07000000-2026-4930-8000-000000000139$m$, $m$neutral$m$, $m$2026-09-16$m$, $m$核融合ベンチャーからリチウム6の問い合わせは来ておらず、投資家の関心の高さとずれがある。グローバル・ブレインの見方は「まだ材料まで意識が回らない段階」。$m$, $m$2026-09-16 LiSTie経営会議（Notion文字起こし）$m$, $m$https://www.notion.so/3dd97749c60881529128e80f6c7500ec$m$, $m$medium$m$, 20),
  ($m$07000000-2026-4930-8000-000000000420$m$, $m$07000000-2026-4930-8000-00000000011a$m$, $m$neutral$m$, $m$2026-09-30$m$, $m$賃貸借契約書は先方がレビュー中で、返答がそろってから弁護士の最終確認を取る。$m$, $m$2026-09-30 LiSTie経営会議（Notion文字起こし）$m$, $m$https://www.notion.so/3eb97749c608817884b1ed7aceaa17af$m$, $m$medium$m$, 60),
  ($m$07000000-2026-4930-8000-000000000421$m$, $m$07000000-2026-4930-8000-00000000012a$m$, $m$neutral$m$, $m$2026-09-30$m$, $m$急ぐなら、健康面の測定だけJFEに頼む案が出た。当初は第三者として評価するため自社で手配していた。$m$, $m$2026-09-30 LiSTie経営会議（Notion文字起こし）$m$, $m$https://www.notion.so/3eb97749c608817884b1ed7aceaa17af$m$, $m$medium$m$, 30),
  ($m$07000000-2026-4930-8000-000000000422$m$, $m$07000000-2026-4930-8000-00000000012b$m$, $m$neutral$m$, $m$2026-09-30$m$, $m$健康への影響の確認と、移転そのものへの抵抗を切り離して扱う方針。入居までに清掃と空気の入れ替えを行い、社内のメンバーも加わって状況を社内に伝える。$m$, $m$2026-09-30 LiSTie経営会議（Notion文字起こし）$m$, $m$https://www.notion.so/3eb97749c608817884b1ed7aceaa17af$m$, $m$medium$m$, 20),
  ($m$07000000-2026-4930-8000-000000000423$m$, $m$07000000-2026-4930-8000-000000000136$m$, $m$supports$m$, $m$2026-09-30$m$, $m$炭酸リチウムのスケールアップ初期検討試験（設備とプロセスの検討）を、木村加工機械に全面委託することを決議（税抜130万円、納期12月25日）。配管などからの金属の混入を踏まえた設備の評価が要る。$m$, $m$2026-09-30 LiSTie経営会議（Notion文字起こし）$m$, $m$https://www.notion.so/3eb97749c608817884b1ed7aceaa17af$m$, $m$high$m$, 20),
  ($m$07000000-2026-4930-8000-000000000424$m$, $m$07000000-2026-4930-8000-000000000129$m$, $m$neutral$m$, $m$2026-09-16$m$, $m$国内のリーテムは2年後に約2,000トンのブラックマスを出せる計画だが、品質の要求を満たすかは確認が要る。ニッケル・コバルトの精錬はJOH・JX金属・日本化学産業と協業の交渉を続けている。$m$, $m$2026-09-16 LiSTie経営会議（Notion文字起こし）$m$, $m$https://www.notion.so/3dd97749c60881529128e80f6c7500ec$m$, $m$low$m$, 40),
  ($m$07000000-2026-4930-8000-000000000425$m$, $m$07000000-2026-4930-8000-000000000121$m$, $m$neutral$m$, $m$2026-09-16$m$, $m$将来、月50トン規模になったときの膜の安定調達のため、膜メーカーとの合弁（JV）を考える価値があるとの意見。第2の供給元は約3億円の設備投資の資金が無いと言っている。$m$, $m$2026-09-16 LiSTie経営会議（Notion文字起こし）$m$, $m$https://www.notion.so/3dd97749c60881529128e80f6c7500ec$m$, $m$medium$m$, 30)
) AS v(id, question, kind, observed, summary, source, url, confidence, sort_order)
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_actions (
  id, project_id, title, detail, action_kind, status, owner_label, planned_start, planned_end, date_certainty,
  target, origin_kind, origin_ref, sort_order, last_verified_at, created_by, updated_by, client_token,
  review_state, proposed_question_id, proposal_reason
)
SELECT v.id::uuid, 'p07', v.title, v.detail, v.kind, 'not_started', v.owner, v.pstart::date, v.pend::date, v.certainty,
  v.target, 'meeting', v.origin, v.sort_order, DATE '2026-09-30', 'amie', 'amie', v.id::uuid,
  'proposed', v.question::uuid, '2026-09-16・09-30 経営会議の次の一手。まさの承認待ち。'
FROM (VALUES
  ($m$07000000-2026-4930-8000-000000000214$m$, $m$日本酸素・四国化成のLOIのレビュー結果を受けて、締結まで進める$m$, $m$9/30 時点で両社にLOIのドラフトを送り、先方がレビュー中。$m$, $m$work$m$, $m$星野さん$m$, NULL, NULL, $m$provisional$m$, NULL, 10, $m$07000000-2026-4930-8000-000000000137$m$, $m$meeting:_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g64r3gghk6oskad1o8d0k8ghg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g74r38d1k74p36ghm852k8c1k690j0dq56p0kcc9l60q44e266l2g_20260930T040000Z$m$),
  ($m$07000000-2026-4930-8000-000000000215$m$, $m$投資家との面談で、核融合向けの資金を回収の開発にも使ってよいかを確かめる$m$, $m$日本酸素の担当者は前向き。多段の濃縮の一段目が回収装置そのものだと説明する。$m$, $m$work$m$, $m$事業開発部$m$, NULL, NULL, $m$provisional$m$, NULL, 20, $m$07000000-2026-4930-8000-000000000137$m$, $m$meeting:_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g64r3gghk6oskad1o8d0k8ghg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g74r38d1k74p36ghm852k8c1k690j0dq56p0kcc9l60q44e266l2g_20260930T040000Z$m$),
  ($m$07000000-2026-4930-8000-000000000216$m$, $m$新日本電工との事業連携（膜の共同開発・LZP膜の扱い）を整理する$m$, $m$出資の打診があるが、LZP膜の技術連携が条件になる可能性がある。$m$, $m$work$m$, $m$事業開発部$m$, NULL, NULL, $m$provisional$m$, NULL, 30, $m$07000000-2026-4930-8000-000000000137$m$, $m$meeting:_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g64r3gghk6oskad1o8d0k8ghg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g74r38d1k74p36ghm852k8c1k690j0dq56p0kcc9l60q44e266l2g_20260916T040000Z$m$),
  ($m$07000000-2026-4930-8000-000000000217$m$, $m$リチウム6を作れるのが当社だけかを検証する$m$, $m$エクイティストーリーの前提。需要側への働きかけとあわせて進める。$m$, $m$work$m$, $m$事業開発部$m$, NULL, NULL, $m$provisional$m$, NULL, 10, $m$07000000-2026-4930-8000-000000000139$m$, $m$meeting:_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g64r3gghk6oskad1o8d0k8ghg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g74r38d1k74p36ghm852k8c1k690j0dq56p0kcc9l60q44e266l2g_20260930T040000Z$m$),
  ($m$07000000-2026-4930-8000-000000000218$m$, $m$川崎の清掃と空気の入れ替えを手配し、社内のメンバーも加わって状況を社内に伝える$m$, $m$入居までに埃を減らし、社内のメンバー1〜2名にも取り組みに加わってもらう。$m$, $m$work$m$, $m$管理部$m$, NULL, NULL, $m$provisional$m$, NULL, 30, $m$07000000-2026-4930-8000-00000000012b$m$, $m$meeting:_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g64r3gghk6oskad1o8d0k8ghg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g74r38d1k74p36ghm852k8c1k690j0dq56p0kcc9l60q44e266l2g_20260930T040000Z$m$),
  ($m$07000000-2026-4930-8000-000000000219$m$, $m$炭酸リチウムのスケールアップ初期検討試験を、木村加工機械に発注する$m$, $m$9/30 経営会議で決議（SBIRの外注費、税抜130万円、後払い）。金属の混入を踏まえた設備の評価も頼む。$m$, $m$work$m$, $m$技術開発部$m$, NULL, $m$2026-12-25$m$, $m$provisional$m$, NULL, 30, $m$07000000-2026-4930-8000-000000000136$m$, $m$meeting:_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g64r3gghk6oskad1o8d0k8ghg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g74r38d1k74p36ghm852k8c1k690j0dq56p0kcc9l60q44e266l2g_20260930T040000Z$m$),
  ($m$07000000-2026-4930-8000-000000000220$m$, $m$川崎市への申請を行政書士に委託する$m$, $m$候補は笹島総合事務所（税抜250万円・前払い）。既存の行政書士への見積もりも検討する。$m$, $m$work$m$, $m$管理部$m$, NULL, NULL, $m$provisional$m$, NULL, 20, $m$07000000-2026-4930-8000-000000000131$m$, $m$meeting:_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g64r3gghk6oskad1o8d0k8ghg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g74r38d1k74p36ghm852k8c1k690j0dq56p0kcc9l60q44e266l2g_20260916T040000Z$m$),
  ($m$07000000-2026-4930-8000-000000000221$m$, $m$リーテムのブラックマスが品質の要求を満たすかを確認する$m$, $m$2年後に約2,000トンを出せる計画がある。$m$, $m$work$m$, $m$事業開発部$m$, NULL, NULL, $m$provisional$m$, NULL, 50, $m$07000000-2026-4930-8000-000000000129$m$, $m$meeting:_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g64r3gghk6oskad1o8d0k8ghg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g74r38d1k74p36ghm852k8c1k690j0dq56p0kcc9l60q44e266l2g_20260916T040000Z$m$),
  ($m$07000000-2026-4930-8000-000000000222$m$, $m$廃液・匣鉢くずの呼び方を「中間原料」「副産物」などに改める$m$, $m$9/16 経営会議で決定。資料や申請で「廃棄物」「廃液」の言葉を使わない。$m$, $m$work$m$, $m$事業開発部$m$, NULL, NULL, $m$provisional$m$, NULL, 30, $m$07000000-2026-4930-8000-000000000131$m$, $m$meeting:_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g64r3gghk6oskad1o8d0k8ghg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g74r38d1k74p36ghm852k8c1k690j0dq56p0kcc9l60q44e266l2g_20260916T040000Z$m$)
) AS v(id, title, detail, kind, owner, pstart, pend, certainty, target, sort_order, question, origin)
ON CONFLICT (id) DO NOTHING;

UPDATE project_actions SET status = 'running', actual = $m$3社に見積を依頼中で、早くて10月下旬。アスベストなどだけでも先に報告してもらうよう依頼した。急ぐなら健康面の測定だけJFEに頼む案も出た（2026-09-30 経営会議）。$m$, last_verified_at = DATE '2026-09-30', updated_by = 'amie', updated_at = NOW(), version = version + 1 WHERE id = $m$07000000-2026-4930-8000-000000000201$m$::uuid AND project_id = 'p07';

UPDATE project_actions SET actual = $m$10月5日から11月13日まで500時間の運転を予定。装置の撤去の余裕を含めて、契約を12月末まで延長する申請をしている（2026-09-16 経営会議）。$m$, last_verified_at = DATE '2026-09-30', updated_by = 'amie', updated_at = NOW(), version = version + 1 WHERE id = $m$89d264b0-233e-5d1b-aa1b-33072cbb213d$m$::uuid AND project_id = 'p07';

UPDATE project_actions SET status = 'done', actual_end = DATE '2026-09-16', progress_pct = 100, done_evidence = $m$9月に面談して現状を共有。出資は当面できないが、研磨のプロセスなどで共同開発ができないかを先方が社内で検討する（2026-09-16 経営会議）。9月30日の時点で山地さんが進捗を確かめた。$m$, last_verified_at = DATE '2026-09-30', updated_by = 'amie', updated_at = NOW(), version = version + 1 WHERE id = $m$df701387-19cd-5a93-a075-722743f9afc2$m$::uuid AND project_id = 'p07';

-- 仕上がりの確認
DO $$
DECLARE n_cards int; n_partners int; n_q int; n_f int; n_a int; n_tech int;
BEGIN
  SELECT count(*) INTO n_cards FROM project_meeting_summaries WHERE project_id = 'p07' AND generated_by_model = 'manual-amie-2026-09-30';
  SELECT count(*) INTO n_partners FROM project_management_partners WHERE project_id = 'p07';
  SELECT count(*) INTO n_q FROM project_questions WHERE project_id = 'p07' AND id::text LIKE '07000000-2026-4930-8000-%';
  SELECT count(*) INTO n_f FROM project_findings WHERE project_id = 'p07' AND id::text LIKE '07000000-2026-4930-8000-%';
  SELECT count(*) INTO n_a FROM project_actions WHERE project_id = 'p07' AND id::text LIKE '07000000-2026-4930-8000-%';
  SELECT count(*) INTO n_tech FROM project_tech_entries WHERE project_id = 'p07' AND tech_entry_id IN ('pte_lst_pre_nichia','pte_lst_pre_smm','pte_lst_pre_shikoku','pte_lst_pre_honda');
  IF n_cards <> 2 OR n_partners <> 50 OR n_q <> 38 OR n_f <> 51 OR n_a <> 22 OR n_tech <> 0 THEN
    RAISE EXCEPTION '454: カード % / 関係先 % / 問い % / 分かったこと % / やること % / 技術の残り % が想定と違う', n_cards, n_partners, n_q, n_f, n_a, n_tech;
  END IF;
END $$;

COMMIT;
