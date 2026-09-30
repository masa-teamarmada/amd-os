-- LiSTie（p07）2026年9月取締役会の反映
--
-- 出典
--   A. 2026年9月取締役会資料「LiSTie_2026年9月度月次報告.pdf」（13ページ。Drive: p07_lst/260930_取締役会/、MTGカードに添付済み）
--   B. Notion「【web】LiSTie取締役会」2026-09-30 の文字起こし（事業開発の途中から。冒頭は録れていない）
--   C. 第3期 事業報告・計算書類（別紙1.事業報告・計算書類等.pdf、2026-06-16 取締役会書面決議の添付。MTGカード written-resolution:p07:20260616 に添付済み）
-- まさ承認: 2026-09-30 チャット「この内容をそれぞれのページに分けていれてほしい」
--
-- この migration で直すもの（変更履歴）
--   - 資金繰り表（330 で投入）: bank_borrowing_balance_yen に「(参考)SBIR補助金残高」を入れていたため、資料の「(参考)銀行借入残高」へ置き換える。
--     SBIR補助金の未入金残高は source_note に書く。2026-05/06 の SBIR 口座残高の入れ違い、2026-07 の SBIR 口座残高（誤 3,000千円 → 正 33千円）も直す。
--   - QST 現物出資（175 で投入）: 2,500株・2,500万円・1株10,000円 → 4,000株・2,000万円・1株5,000円。
--     根拠は C の大株主表（QST 4,000株・8.2%）と、資本金88,000千円＝設立300万円＋シード半額7,500万円＋QST半額1,000万円の整合。
--   - NEDO（DTSU・STS）の交付上限額: 2億円 → 3億円（C の事業報告と注記、A の p.11）。応募申請書 r3 の「2.0億」は備考に残し、要確認とする。

BEGIN;

-- 1. MTGカード（今日の取締役会）-------------------------------------------
-- 自動生成（h1-background、Notion要約だけが元）を、資料と文字起こしで書き直す。
-- source_hash は残す（同じ元データで再生成されないよう、既存の運用と同じ扱い）。
UPDATE project_meeting_summaries SET
  summary_short = $s$川崎扇町はJFEと条件合意したが、見学時の健康被害の訴えで環境調査の結果を待って契約判断。拠点は二拠点に決定。資金繰りの底は2027年6月末の974万円で、2027年9月のシリーズA（10億円）へつなぐ計画。膜は回収速度が半分になる見込みで、膜2倍の原価を11/12に報告する。$s$,
  narrative_md = $n$## 🎯背景
2026年9月の定時取締役会（30分）。月次報告資料（13ページ）に沿って、シリーズAに向けたマイルストーンの進捗、各部門の報告、8月の予実、2028年3月までの資金繰りを確認した。今月いちばんの論点は川崎扇町への移転で、JFEとの条件交渉がまとまった一方、社員見学時に健康被害の訴えが出て、契約の判断を環境調査の結果に委ねる局面に入っている。技術面では、膜の性能を保つ運転方法と、それに伴う原価の見直しが、11月12日の報告に向けた焦点になっている。

## 📊経緯
事業開発では、膜メーカーの設備投資判断に向けて購入意向書（LOI）で需要の裏付けを集めており、Evonikから獲得済み、Proxima Fusionとは秘密保持契約を締結済み、核融合関連6社と協議中と報告された。千代田化工建設とは前処理プラントの基本設計（FEED）の見積もりを2週ごとの面談で詰めている。9月29日にはDanielとフォローアップ面談を行った。塩湖かん水では不純物が結晶化して配管が詰まり装置が止まるため、すぐにかん水へ進むのは難しく、炭酸リチウムから水酸化リチウムへの変換（チリのSQMが始めている）や電解液向けの高純度精製で装置を使う提案をDanielにする方針が示された。原料は2027年分（24トン）は見込めるが、2028年分は確度の高い分が14.1%にとどまる。インドからのブラックマス輸入は、現地で実際にリサイクルしている会社と組めば当面は問題ないとの見立てだが、将来の囲い込みを見据えて海外生産も検討する。技術開発の報告は配布資料に入っておらず、星野さんが口頭で説明した。管理部からは、川崎の条件、二拠点化、人事評価制度、SBIRのつなぎ融資の再開が報告され、補助金の予実は月ごとの比較より累計と残額で見る形に変えたいとの提案があった。最後に星野さんが、移転とチームづくりを今月の最大の課題として締めた。

## ✅決まったこと
- 川崎扇町はJFEと条件で概ね合意した（敷金6,000万→1,500万円、面積6,000㎡→3,000㎡、月額賃料800万→400万円）。見学した9名中5名に喉・肌の痛みや咳が出たため、LiSTie手配で環境調査を行い、その結果をもって契約締結に進む。
- 拠点は予算の都合で二拠点にする。膜開発チームは柏の葉に残し、シリーズA後の2028年3月をめどに川崎へ集約する。
- 人事評価制度は、年内に副部長以上から導入し、リーダー、一般へ順に広げる。
- SBIRのつなぎ融資を2026年10月支払分から再開し、必要な分だけ借りる。

## ▶️次の一手
- 川崎扇町の環境調査をLiSTie手配で実施し、結果で契約を判断する（管理部）。
- Danielへ塩湖かん水の技術課題を説明し、炭酸リチウムから水酸化リチウムへの変換や電解液向け高純度精製での装置活用を提案する（事業開発部）。
- TYKで500時間の長期運転を10月5日から始め、電圧のオン・オフ運転で膜の性能が保てるかを確かめる（技術開発部）。
- 11月12日のSBIRフォローアップ委員会に向けて、膜を2倍にした場合のコスト試算を整理する（技術開発部）。
- 膜メーカーへ評価セルを有償で貸す共同研究の形にするかを社内で結論づける（技術開発部）。
- 2028年分の原料の確度を上げるため、LOIの候補先との交渉を続ける（事業開発部）。
- 日本酸素と組んでキングサーモンプロジェクト（最大3億円）に申請する。第一段階のAgoraには口頭の報告で申請済み（事業開発部）。
- CFO・CTOの採用を続け、COO候補（Plug and Playの是洞さん）の着任を2027年1月で調整する（星野さん）。
- 10月以降の支出を絞り、2027年4〜8月の資金繰りに備える（管理部）。

## ⚠️残課題
- 資金繰りの底は2027年6月末で、月末の預金は974万円（うち運転資金口座217万円）。6月のSBIR入金を当てにした借入と、7月の消費税還付・SusHi Tech入金で、2027年9月のシリーズA（10億円）までつなぐ計画。
- 資料12ページの2027年3月末の預金（7,470万円）と13ページの4月初めの預金（8,778万円）が1,307万円食い違う。3月末の値が正しいと、6月末は約334万円の不足になる計算で、管理部に確認が必要。
- 電圧を下げる運転ではリチウムの回収速度が当初の半分ほどになる可能性が高く、当初の量を作るには膜が2倍要る。原価の上振れを11月12日の委員会で報告する。
- 2028年の調達目標780トン（水酸化リチウム換算）のうち、確度の高い分は14.1%。交渉中の分も確度は低い。
- 社員に移転への反発があり、星野さんが不在のときに雰囲気が悪くなる。星野さんは人事の専任や会社を引っ張る人をもう1人ほしいと発言。移転ができないと、2027年2月に予定している現地実証2号機のお披露目（資金調達を始める場）がずれる。
- CTOの採用は難航している。COO候補の着任は2027年1月へ1か月遅れる見込み。
- 技術開発のマイルストーン表が配布資料に入っていない（資料3ページの技術開発部の欄にはCOO候補の文が入っている）。口頭では原価の項目が雨マーク。
- 拠点の地名が資料内で食い違う（管理部の報告は「川崎扇町」、技術開発計画（案）は「川崎・水江」「川崎・南渡田」）。$n$,
  decided = jsonb_build_array(
    $d$川崎扇町はJFEと条件で概ね合意（敷金1,500万円・3,000㎡・月額賃料400万円）。見学時の健康被害の訴えを受け、LiSTie手配の環境調査の結果をもって契約締結に進む。$d$,
    $d$拠点は二拠点に決定。膜開発チームは柏の葉に残し、シリーズA後の2028年3月をめどに川崎へ集約する。$d$,
    $d$人事評価制度は年内に副部長以上から導入し、リーダー、一般へ順に広げる。$d$,
    $d$SBIRのつなぎ融資を2026年10月支払分から再開し、必要な分だけ借りる。$d$
  ),
  progress = jsonb_build_array(
    $d$JFEとの川崎扇町の条件交渉が概ね決着（敷金6,000万→1,500万円、面積6,000㎡→3,000㎡、月額賃料800万→400万円）。$d$,
    $d$EvonikのLOIを獲得済み。Proxima Fusionと秘密保持契約を締結済み、核融合関連6社とLOIに向けて協議中。$d$,
    $d$千代田化工建設と前処理プラントの基本設計（FEED）の見積条件を2週ごとの面談で調整中。$d$,
    $d$9月29日にDanielとフォローアップ面談を実施。$d$,
    $d$本番材料（PEEK）のセルスタックが完成し、9月29日に室温・水だけの通液で液漏れが無いことを確認（電極は未装着）。$d$,
    $d$稲熊さん（膜開発リーダー）が9月18日に入社。10月1日に内藤さん（メカ設計）と在原さん（リチウム6の専任）が加わる。$d$,
    $d$8月の税引前損益は、運転資金＋SusHi補助金の区分で計画▲955万円に対し実績▲810万円、全社で計画▲5,275万円に対し実績▲2,830万円。$d$
  ),
  next_actions = jsonb_build_array(
    $d$川崎扇町の環境調査をLiSTie手配で実施し、結果で契約を判断する（管理部）。$d$,
    $d$Danielへ塩湖かん水の技術課題を説明し、変換・高純度精製での装置活用を提案する（事業開発部）。$d$,
    $d$TYKで500時間の長期運転を10月5日から始め、電圧のオン・オフ運転で膜の性能を確かめる（技術開発部）。$d$,
    $d$11月12日のSBIRフォローアップ委員会に向けて、膜2倍の場合のコスト試算を整理する（技術開発部）。$d$,
    $d$膜メーカーへ評価セルを有償で貸す共同研究にするかを社内で結論づける（技術開発部）。$d$,
    $d$2028年分の原料の確度を上げるため、LOIの候補先との交渉を続ける（事業開発部）。$d$,
    $d$日本酸素と組んでキングサーモンプロジェクト（最大3億円）に申請する（事業開発部）。$d$,
    $d$CFO・CTOの採用を続け、COO候補の着任を2027年1月で調整する（星野さん）。$d$,
    $d$10月以降の支出を絞り、2027年4〜8月の資金繰りに備える（管理部）。$d$
  ),
  risks = jsonb_build_array(
    $d$資金繰りの底は2027年6月末の974万円（運転資金口座は217万円）。2027年9月のシリーズAまでつなぐ計画に余裕が無い。$d$,
    $d$資料の2027年3月末と4月初めの預金が1,307万円食い違う。3月末の値が正しいと6月末は約334万円の不足になる。$d$,
    $d$回収速度が当初の半分になり膜が2倍要ると、原価が上振れする。$d$,
    $d$2028年の原料は確度の高い分が14.1%のみ。$d$,
    $d$社員に移転への反発がある。移転できないと2027年2月の2号機お披露目と資金調達の開始がずれる。$d$,
    $d$CTOの採用が難航し、COO候補の着任も1か月遅れる。$d$
  ),
  source_kinds = 'notion+calendar+drive',
  generated_by_model = 'manual-amie-board-pdf-2026-09-30',
  generated_at = NOW(),
  updated_at = NOW()
WHERE project_id = 'p07' AND meeting_id = '3iud8925losc46r456e5s0b4k4';

-- 2. 経営ハイライト -----------------------------------------------------------
-- まさがチャットで一覧を承認したので confirmed で入れる（confirmed_by は既存の運用どおり「まさ」）。
WITH src AS (
  SELECT
    jsonb_build_object('source','drive','title','LiSTie_2026年9月度月次報告.pdf（2026年9月取締役会資料）','date','2026-09-30',
      'url','https://drive.google.com/file/d/11x5mSMP771zUmDMaeH3Z0RKvoazBwCHx/view') AS pdf,
    jsonb_build_object('source','notion','title','【web】LiSTie取締役会','date','2026-09-30',
      'page_id','3eb97749-c608-8144-abd2-f9da85b54110','url','https://www.notion.so/3eb97749c6088144abd2f9da85b54110') AS notion
), rows(signal_type, title, summary, impact_level, decision_state, polarity, score_impact_summary, refs) AS (
  SELECT 'management_decision',
    '川崎扇町はJFEと条件合意、契約は環境調査の結果で判断',
    '敷金6,000万→1,500万円、面積6,000㎡→3,000㎡、月額賃料800万→400万円で概ね合意した。一方、見学した9名中5名に喉・肌の痛みや咳が出たため、LiSTie手配の環境調査の結果をもって契約締結に進む。',
    'critical','executing','forward',
    '📊 影響: 拠点費は月400万円まで下がった。契約は環境調査しだいで、2027年2月の現地実証2号機のお披露目の前提になる。',
    jsonb_build_array((SELECT pdf FROM src) || jsonb_build_object('page','p.3','snippet','川崎扇町への移転についてJFE側との交渉が敷金・賃料含め概ね完了。見学時に9名中5名から各種症状'),
                      (SELECT notion FROM src) || jsonb_build_object('snippet','6000万の請求から1500万まで下げ、面積も6000平米が3000、月額賃料800万から400万まで。当社手配で環境調査を実施'))
  UNION ALL SELECT 'management_decision',
    '拠点は二拠点に決定、膜開発は柏の葉に残し2028年3月に川崎へ集約',
    '研究設備の移設費で予算を超えることと、千葉から移れない社員への配慮から、膜開発チームを柏の葉に残す。シリーズA後の2028年3月をめどに川崎へ集約する。',
    'high','decided','forward',
    '📊 影響: 移転費を抑えて資金繰りを守る。2028年3月までは二拠点の運営になる。',
    jsonb_build_array((SELECT pdf FROM src) || jsonb_build_object('page','p.3','snippet','予算の都合上２拠点化することとし、膜開発チームを柏の葉に残留させる。シリーズA後2028年3月に川崎に集約'))
  UNION ALL SELECT 'funding',
    'シリーズAは2027年9月に10億円の計画',
    '2026年9月取締役会資料の資金繰り見込み（p.13）は、2027年9月にシリーズAで10億円を調達する前提になっている。2027年2月に川崎で現地実証2号機をお披露目し、資金調達を始める予定（星野さん、口頭）。応募申請書（2026年2月）の時点では2027年3月・6億円の計画だった。',
    'critical','proposed','forward',
    '📊 影響: 調達時期が半年後ろにずれ、2027年4〜8月の資金繰りが最も厳しくなる。',
    jsonb_build_array((SELECT pdf FROM src) || jsonb_build_object('page','p.13','snippet','2027年9月にシリーズAにて10億円を調達予定'),
                      (SELECT notion FROM src) || jsonb_build_object('snippet','2月に現地実証機の2号機のお披露目会、資金調達を開始'))
  UNION ALL SELECT 'risk',
    '資金繰りの底は2027年6月末の974万円',
    '6月のSBIR入金を当てにした借入で4月をつなぎ、7月の消費税還付とSusHi Tech入金で9月のシリーズAまで持たせる計画。6月末の運転資金口座は217万円まで下がる。資料内で2027年3月末と4月初めの預金が1,307万円食い違っており、3月末の値が正しければ6月末は約334万円の不足になる計算。',
    'critical','observed','risk',
    '📊 影響: 10〜3月の支出が2027年4月以降の資金に直結する。シリーズAが遅れると資金が尽きる。',
    jsonb_build_array((SELECT pdf FROM src) || jsonb_build_object('page','p.12-13','snippet','SBIR補助金残高は2027年6月の入金によりゼロとなる'),
                      (SELECT notion FROM src) || jsonb_build_object('snippet','27の6月で月末残が900万。4 5 6 7 8あたりはかなり慎重に資金繰りを管理'))
  UNION ALL SELECT 'funding',
    'NEDO補助事業の期間が2027年3月末まで延長',
    '当初2026年10月末だった期間が2027年3月末まで延び、研究開発費をNEDO側へ寄せる（着地見込みで1億円）。今期のNEDO対象費用は計画3,638万円に対し見込1億3,651万円。',
    'high','decided','forward',
    '📊 影響: 運転資金側の研究開発費が減り、今期の予実は下振れ（良い方向）になる。',
    jsonb_build_array((SELECT pdf FROM src) || jsonb_build_object('page','p.11','snippet','NEDO予算との入り繰り▲100,000千円'),
                      (SELECT notion FROM src) || jsonb_build_object('snippet','ネドがもともと10月末までだったのが3月まで伸びました'))
  UNION ALL SELECT 'funding',
    '日本酸素と組んでキングサーモンプロジェクト（最大3億円）へ申請',
    '核融合炉向けの開発資金として、日本酸素と連携して申請を目指す。第一段階として、申請書を磨く場であるAgoraへ申請した（資料では「予定」、口頭では「申請した」）。',
    'medium','executing','forward',
    '📊 影響: 採択されれば核融合向け（リチウム6）の開発資金が増える。',
    jsonb_build_array((SELECT pdf FROM src) || jsonb_build_object('page','p.3','snippet','日本酸素と連携し、キングサーモンプロジェクト（最大3億円）への申請を目指す'),
                      (SELECT notion FROM src) || jsonb_build_object('snippet','今アゴラに申請をしたというところでございます'))
  UNION ALL SELECT 'tech_progress',
    '膜の回収速度が当初の半分に下がる見込み、膜2倍で原価上振れ',
    '連続通電では膜の性能が時間とともに落ちるため、電圧のオン・オフ運転に切り替え、数日単位では低下を抑えられている。ただし電圧を下げるため回収速度が当初の半分程度になる可能性が高く、当初の量を作るには膜が2倍要る。10月5日からTYKで500時間運転し、11月12日のSBIRフォローアップ委員会で原価を報告する。',
    'high','executing','risk',
    '📊 影響: 装置1台あたりの膜コストが上がり、目標製造コスト（水酸化リチウム1kgあたり430円）の前提が崩れうる。',
    jsonb_build_array((SELECT notion FROM src) || jsonb_build_object('snippet','当初のリチウム回収速度の半分ぐらいしか出ない可能性が高い。膜の枚数2倍にしないと'))
  UNION ALL SELECT 'risk',
    '2028年分の原料は確度の高い分が14.1%のみ',
    '2028年の調達目標は水酸化リチウム換算780トン。日亜化学の匣鉢と未利用溶液の110トン（14.1%）は事業性を議論中で確度が高いが、交渉中の670トン（交渉中の総量1,250トン）は確度が低い。2029年は140トン、2030年は1,640トン足りない。',
    'high','observed','risk',
    '📊 影響: 量産立ち上げ期の原料が確保できないと、売上計画の前提が崩れる。',
    jsonb_build_array((SELECT pdf FROM src) || jsonb_build_object('page','p.7-8','snippet','交渉中も現状の調達確度は低い'))
)
INSERT INTO project_strategy_signals (
  project_id, ym, signal_date, signal_type, title, summary, impact_level, decision_state, status,
  source_refs_json, source_hash, confidence, extraction_run_id, created_by, confirmed_by, confirmed_at,
  polarity, score_impact_summary, signal_scope, applies_to_company_score, scope_reason, origin_kind
)
SELECT 'p07', '202609', DATE '2026-09-30', signal_type, title, summary, impact_level, decision_state, 'confirmed',
  refs, encode(sha256(convert_to('lst-board-20260930:' || title, 'UTF8')), 'hex'), 0.9, 'manual_lst_board_20260930', 'amie', 'まさ', NOW(),
  polarity, score_impact_summary, 'project', false,
  'p07 LiSTie個別の取締役会の事項。AMD全社のManagement Scoreではなく、PJコックピットの経営ハイライトに置く。', 'internal'
FROM rows
ON CONFLICT (project_id, scope_key, signal_type, source_hash) DO NOTHING;

-- 3. 助成金 ------------------------------------------------------------------
UPDATE project_grants SET
  amount_yen = 300000000,
  period_start_ym = '202508',
  period_end_ym = '202703',
  notes = $g$交付上限額3億円・補助率3分の2（第3期 事業報告と計算書類の注記。2026年9月取締役会資料 p.11 も「総額3億円、補助率2/3」）。2025年8月にSTSフェーズへ採択（事業報告）。交付額の最終確定は2027年3月期の予定。
期間: 当初は2026年10月末までだったが、2027年3月末まで延長された（2026-09-30 取締役会の口頭報告。資料 p.11 の注記は「〜2026/10」のまま）。延長にあわせて研究開発費をNEDO側へ寄せ、今期のNEDO対象費用は計画3,638万円→実績・見込1億3,651万円（p.11）。
要確認: 応募申請書 r3（2026年2月）では「NEDO・ディープテック・スタートアップ支援事業 2.0億」。3億円が上限で2億円が計画額なのか、谷さんに確認する。
テーマ「固体中に含まれるLi成分の高純度分離回収技術の開発」。リサイクルリチウム事業の開発に充てる。
2026-06-17 登録時のメモ: 10月末の期限をシリーズAに合わせて3月末まで延長する計画変更届を提出予定。電気透析装置（205万円）等の購入はNEDOの承認待ち。$g$,
  updated_by = 'amie', updated_at = NOW()
WHERE id = '00ad1961-dad1-4844-947f-7f20c2f0ca63' AND project_id = 'p07';

UPDATE project_grants SET
  period_start_ym = '202310',
  period_end_ym = '202803',
  notes = $g$2023年10月に文部科学省 中小企業イノベーション創出推進事業（SBIRフェーズ3）核融合分野へ採択、交付上限額15億円（第3期 事業報告）。全額補助、期間は2028年3月まで（2026年9月取締役会資料 p.11）。交付額の最終確定は2028年3月期の予定で、入金は概算払いのため長期預り金に計上（計算書類の注記）。
今期のSBIR対象費用は計画7億131万円→実績・見込7億7,476万円（p.11）。未入金の残りは2027年6月の入金でゼロになる見込み（p.13）。2026年10月支払分からSBIRのつなぎ融資を再開し、金利がかかる（p.3）。
LiSMICユニット（40フィートコンテナ、水酸化リチウム年570トン）をQSTとのコンソーシアムで開発する。ユニット原価2億円/台が開発目標（応募申請書 r3 p18・p31）。
採択額15億円（まさ確定 2026-06-17）。2024-03 決算期変更の理由にも本補助金の会計処理が明記。$g$,
  updated_by = 'amie', updated_at = NOW()
WHERE id = 'ce0e76bb-331f-4ff7-8923-cafadf5e1cf2' AND project_id = 'p07';

INSERT INTO project_grants (project_id, grant_name, agency, grant_type, amount_yen, status, is_current, source_ref, notes, created_by, updated_by, amd_contribution_status, attachments_json)
SELECT 'p07', 'キングサーモンプロジェクト（核融合炉向けの開発資金）', '未確認', '補助金（最大3億円）', 300000000, 'applied', true,
  '2026年9月取締役会資料 p.3 / 2026-09-30 取締役会の口頭報告',
  $g$日本酸素と連携して申請を目指す（最大3億円）。第一段階として、申請書を磨く場であるAgoraへ申請: 資料 p.3 では「申請を予定」、会議の口頭報告では「申請した」。制度の正式名・所管・本申請の時期は未確認。採択額には計上しない（申請段階）。$g$,
  'amie', 'amie', 'unreviewed', '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM project_grants WHERE project_id = 'p07' AND grant_name LIKE 'キングサーモン%');

-- 4. 資金調達履歴 --------------------------------------------------------------
-- QST 現物出資: 4,000株・2,000万円・1株5,000円（事業報告の大株主表と資本金の整合）。
UPDATE project_valuation_rounds SET
  raised_yen = 20000000,
  price_per_share_yen = 5000,
  pre_money_yen = 225000000,
  post_money_yen = 245000000,
  source_ref = '第3期 事業報告 p.4 大株主（QST 普通株式4,000株・8.2%）／応募申請書 r3 p22・p23',
  notes = 'QSTの現物出資は普通株式4,000株・2,000万円・1株5,000円。第3期 事業報告の大株主表（星野 30,000株 61.2%、UMI3号 15,000株 30.6%、QST 4,000株 8.2%）と、資本金88,000千円＝設立300万円＋シードの半額7,500万円＋QSTの半額1,000万円の整合で確かめた（2026-09-30）。評価額は1株5,000円×株数から計算（前 45,000株、後 49,000株）。日付は月だけ判明。',
  updated_at = NOW()
WHERE id = '0474cf9c-161f-4645-abaa-1b6c3ab84dd2' AND project_id = 'p07';

UPDATE project_equity_entries SET outstanding_delta = 4000, diluted_delta = 4000, paid_in_yen_delta = 20000000
WHERE id = '801529ad-9517-487d-b099-903afb10dfe9' AND project_id = 'p07';

UPDATE project_equity_transactions SET
  source_ref = '第3期 事業報告 p.4 大株主（QST 4,000株）／xlsx:LST_captable_250415.xlsx#qst-202503',
  notes = '株数・金額は事業報告と資本金の整合で確かめた値（4,000株・2,000万円）。旧 cap table xlsx の2,500株・2,500万円は採らない。',
  updated_by_email = 'amie', updated_at = NOW()
WHERE id = 'e3dccbb4-efe7-44e3-a799-a018fae63e20' AND project_id = 'p07';

-- J-KISS: 発行日（事業報告）と、シリーズAの最新計画（2027年9月・10億円）
UPDATE project_valuation_rounds SET
  round_date = '2025-06-23',
  notes = '評価上限（CAP）21億円、割引率30%。2025年6月17日の定時株主総会の決議に基づき、2025年6月23日に第1回J-KISS型新株予約権100個（1個100万円）を発行（第3期 事業報告）。株式への転換は次の優先株式ラウンドで行う想定。シリーズAは応募申請書（2026年2月）では2027年3月・6億円、2026年9月取締役会資料では2027年9月・10億円。',
  updated_at = NOW()
WHERE id = '60ea2a39-96bf-47d8-8375-3ddffa0200fb' AND project_id = 'p07';

UPDATE project_valuation_rounds SET
  round_date = '2025-11-28',
  notes = '出資者はシンデン・ハイテックス株式会社（0.1億円）。資本政策表のリード欄はUMI。評価上限21億円、割引率25%。2025年11月12日の臨時株主総会の決議に基づき、2025年11月28日に第1回の2J-KISS型新株予約権10個（1個100万円）を発行（第3期 事業報告）。株式への転換はシリーズAで行う想定（転換後の持株0.5%、応募申請書）。シリーズAは2026年9月取締役会資料では2027年9月・10億円。',
  updated_at = NOW()
WHERE id = '0a108d06-3176-4511-8cda-c86eb90e09a1' AND project_id = 'p07';

UPDATE project_convertible_instruments SET
  issued_on = '2025-06-23',
  conversion_trigger = '次の優先株式ラウンドで転換。シリーズAは応募申請書（2026年2月）では2027年3月、2026年9月取締役会資料では2027年9月・10億円。'
WHERE id = 'db9b69b9-14e1-41ad-8c21-ae237bf7c655' AND project_id = 'p07';

UPDATE project_convertible_instruments SET
  issued_on = '2025-11-28',
  conversion_trigger = '次の優先株式ラウンドで転換。シリーズAは応募申請書（2026年2月）では2027年3月、2026年9月取締役会資料では2027年9月・10億円。'
WHERE id = 'adc2fc0d-81f9-492b-8245-6e997fbf637b' AND project_id = 'p07';

-- 5. 会社概要・年度決算 ------------------------------------------------------------
UPDATE project_company_profiles SET
  has_auditor = true,
  board_structure = '取締役会・監査役設置会社（2025年6月17日の定時株主総会で移行）',
  business_purpose = 'リチウムの分離に関する装置・分離膜の開発、販売及びメンテナンス／リチウムの回収・分離技術の開発及びライセンス／核融合炉用リチウムの濃縮技術の開発及びライセンス（第3期 事業報告「主要な事業内容」。定款の目的は未確認）',
  notes = coalesce(notes, '') || E'\n2026-09-30追記（第3期 事業報告）: 役員は代表取締役 星野毅、取締役 山地正洋（チームアルマダ代表取締役）、社外取締役 木場祥介（UMI代表取締役）、社外監査役 渡部晃（UMI取締役会長）。2025年6月17日の定時株主総会で取締役会設置会社・監査役設置会社へ移行。従業員15名（2026年3月末、前期末比+7名）。借入は青森みちのく銀行 8,300万円（2026年3月末）。',
  source_verified_on = '2026-09-30',
  updated_by_email = 'amie',
  updated_at = NOW()
WHERE project_id = 'p07';

INSERT INTO project_financial_periods (project_id, fiscal_year, period_start_on, period_end_on, statement_status,
  revenue_yen, operating_income_yen, ordinary_income_yen, net_income_yen, total_assets_yen, total_liabilities_yen, net_assets_yen, cash_yen, debt_yen,
  source_ref, notes, created_by_email, updated_by_email)
SELECT 'p07', 2025, '2025-04-01', '2026-03-31', 'final',
  450000, -348873000, -350846000, -351426000, 375475000, 671110000, -295634000, 46080000, 83000000,
  '第3期 事業報告・計算書類（2026-06-16 取締役会書面決議で承認、第3回定時株主総会に報告）',
  '2026年3月期（第3期）。売上高45万円、営業損失3億4,887万円、当期純損失3億5,143万円。負債のうち長期預り金5億6,368万円はSBIRの概算払い（交付額の確定は2028年3月期）。設備投資1億2,191万円（LiSMIC自動制御装置3,884万円、LiSMIC長期特性評価用装置1,706万円、粒子径測定装置998万円、海水濃縮装置768万円）。',
  'amie', 'amie'
WHERE NOT EXISTS (SELECT 1 FROM project_financial_periods WHERE project_id = 'p07' AND fiscal_year = 2025);

UPDATE project_financial_periods SET
  operating_income_yen = -208015000, ordinary_income_yen = -211502000, net_income_yen = -211941000,
  total_assets_yen = 323174000, net_assets_yen = -54208000,
  source_ref = '第3期 事業報告（財産及び損益の状況）／応募申請書 r3 p3',
  notes = '2025年3月期（第2期）。売上高0円、営業損失2億802万円、経常損失2億1,150万円、当期純損失2億1,194万円、総資産3億2,317万円、純資産▲5,421万円（第3期 事業報告の3期比較）。',
  updated_by_email = 'amie', updated_at = NOW()
WHERE project_id = 'p07' AND fiscal_year = 2024;

UPDATE project_financial_periods SET
  ordinary_income_yen = -15058000, net_income_yen = -15267000, total_assets_yen = 141627000, net_assets_yen = 137732000,
  source_ref = '第3期 事業報告（財産及び損益の状況）／応募申請書 r3 p3',
  notes = '2024年3月期（第1期、2023-07-06〜2024-03-31の9か月）。売上高0円、経常損失1,506万円、当期純損失1,527万円、総資産1億4,163万円、純資産1億3,773万円（第3期 事業報告の3期比較）。2024-03-28 の株主総会書面決議で決算期を6月末から3月末へ変更したため短い期になった。',
  updated_by_email = 'amie', updated_at = NOW()
WHERE project_id = 'p07' AND fiscal_year = 2023;

-- 6. メンバー（役職のある人と新しく入る人。全員分は取締役会カードに添付の組織図 p.9）---------
UPDATE project_venture_members SET note = coalesce(note, '') || E'\n2026年10月の組織図では、事業開発部長と技術開発部長（CTO）を兼務。'
WHERE id = '0c27ca9b-682f-42cb-95d2-66a9e9a0dc7a' AND project_id = 'p07' AND coalesce(note, '') NOT LIKE '%2026年10月の組織図%';
UPDATE project_venture_members SET note = coalesce(note, '') || E'\n2026年10月の組織図では、外部（業務委託等）の区分で海外顧客の開拓（塩湖・鉱石を含む）を担当。'
WHERE id = 'b727bb83-1a29-4f7f-8a56-57aa9fd19226' AND project_id = 'p07' AND coalesce(note, '') NOT LIKE '%2026年10月の組織図%';

INSERT INTO project_venture_members (project_id, full_name, role, started_at, note, member_kind, amd_member_id)
SELECT v.* FROM (VALUES
  ('p07', '山地 正洋', '取締役', DATE '2024-01-18', 'チームアルマダ代表取締役。2024-01-18の株主総会書面決議で取締役に選任（2023-07〜2025-07はCOO）。', 'amd_internal', 'ID001'),
  ('p07', '木場 祥介', '社外取締役', NULL::date, 'ユニバーサルマテリアルズインキュベーター（UMI）代表取締役（第3期 事業報告）。', 'support_org', NULL),
  ('p07', '渡部 晃', '社外監査役', DATE '2025-06-17', 'UMI取締役会長。2025年6月17日の定時株主総会で監査役設置会社へ移行した際に選任（第3期 事業報告）。', 'support_org', NULL),
  ('p07', '谷', '管理部長（外部）', NULL::date, '資金管理の起案責任者、システム・IT運用、株主総会・取締役会の事務の責任者（2026年10月の組織図）。取締役会では予実・資金繰りを報告。', 'su_internal', NULL),
  ('p07', '稲熊', '技術開発部 膜開発チームリーダー', DATE '2026-09-18', 'チーム統括と後処理を担当（2026年10月の組織図）。星野さんはコスト感覚の高さを評価（2026-09-30 取締役会）。', 'su_internal', NULL),
  ('p07', '西村', '技術開発部 ユニット開発リーダー', NULL::date, 'ユニット開発計画の具体化、全体の工程・予算執行・安全衛生の管理、製作品の発注（2026年10月の組織図）。', 'su_internal', NULL),
  ('p07', '堤', '技術開発部 メカチームリーダー', NULL::date, '設計製作・改良（2026年10月の組織図）。3D CADによるメカ設計を担ってきた。', 'su_internal', NULL),
  ('p07', '高畑', '技術開発部 前処理リーダー', NULL::date, '前処理・後処理の開発（2026年10月の組織図）。前処理・後処理チームは2026年8月に発足。', 'su_internal', NULL),
  ('p07', '在原', '技術開発部 リチウム6', DATE '2026-10-01', 'リチウム6に専念（2026年10月の組織図で10/1入社確定）。', 'su_internal', NULL),
  ('p07', '内藤', '技術開発部 メカチーム', DATE '2026-10-01', 'メカ設計の若手（2026年10月の組織図で10/1着任予定）。', 'su_internal', NULL),
  ('p07', '土屋 佳奈', '技術開発部 知財担当', NULL::date, '知財戦略・出願（2026年10月の組織図）。', 'su_internal', NULL),
  ('p07', '村上', '管理部', NULL::date, '給与・社会保険・福利厚生の責任者、研究開発費の起案、競争的資金の管理、SBIR・業務委託・購買・契約の窓口（2026年10月の組織図）。', 'su_internal', NULL),
  ('p07', 'Cui', '事業開発部', NULL::date, '事業開発部（2026年10月の組織図）。', 'su_internal', NULL),
  ('p07', '是洞', 'COO候補（事業開発部長）', NULL::date, 'Plug and Playから、SusHi Techの枠組みで参画予定。着任は2026年12月から2027年1月へ1か月後ろ倒しを調整中（2026年9月取締役会資料 p.2）。', 'su_internal', NULL)
) AS v(project_id, full_name, role, started_at, note, member_kind, amd_member_id)
WHERE NOT EXISTS (SELECT 1 FROM project_venture_members m WHERE m.project_id = v.project_id AND m.full_name = v.full_name);

-- 9. 資金繰り表（試算表 › 取締役会資料 C/F・資金繰り）: 2026年9月取締役会資料 p.12〜13 の24か月 ------
INSERT INTO project_monthly_cashflow (
  project_id, ym, source_status, cash_inflow_yen, sbir_payment_yen, nedo_payment_yen, working_capital_payment_yen,
  free_cash_flow_yen, financing_cash_flow_yen, net_cash_flow_yen, opening_cash_yen, closing_cash_yen,
  sbir_account_balance_yen, working_capital_balance_yen, bank_borrowing_balance_yen, source_note
) VALUES
  ('p07','2026-04','actual',495000,-19241000,-1827000,-5865000,-26438000,93805000,67367000,46081000,113448000,18307000,95141000,97000000,$n$2026年9月取締役会資料 p.12（実績）。（参考）SBIR補助金の未入金残高 8億3,710万円。$n$),
  ('p07','2026-05','actual',26025000,-22922000,-1586000,-6410000,-4892000,0,-4892000,113448000,108556000,17186000,91370000,97000000,$n$2026年9月取締役会資料 p.12（実績）。（参考）SBIR補助金の未入金残高 8億1,107万円。$n$),
  ('p07','2026-06','actual',132226000,-40598000,-3346000,-10511000,77772000,-83298000,-5527000,108556000,103029000,15961000,87068000,14000000,$n$2026年9月取締役会資料 p.12（実績）。（参考）SBIR補助金の未入金残高 7億1,153万円。$n$),
  ('p07','2026-07','actual',0,-17088000,-2771000,-8797000,-28656000,149864000,121208000,103029000,224238000,33000,224205000,14000000,$n$2026年9月取締役会資料 p.12（実績）。（参考）SBIR補助金の未入金残高 7億1,153万円。$n$),
  ('p07','2026-08','actual',6959000,-106521000,-2200000,-15794000,-117555000,-136000,-117691000,224238000,106547000,13476000,93071000,14000000,$n$2026年9月取締役会資料 p.12（実績）。（参考）SBIR補助金の未入金残高 7億1,153万円。$n$),
  ('p07','2026-09','forecast',82760000,-35687000,-2808000,-14136000,30129000,-14000000,16129000,106547000,122675000,46549000,76127000,0,$n$2026年9月取締役会資料 p.12（見込）。（参考）SBIR補助金の未入金残高 6億2,877万円。$n$),
  ('p07','2026-10','forecast',50000000,-70387000,-74807000,-20444000,-115638000,49275000,-66363000,122675000,56313000,25437000,30876000,50000000,$n$2026年9月取締役会資料 p.12（見込）。（参考）SBIR補助金の未入金残高 6億2,877万円。$n$),
  ('p07','2026-11','forecast',53210000,-34013000,-3940000,-9359000,5897000,30000000,35897000,56313000,92210000,21424000,70786000,80000000,$n$2026年9月取締役会資料 p.12（見込）。（参考）SBIR補助金の未入金残高 6億2,877万円。$n$),
  ('p07','2026-12','forecast',89296000,-89013000,-17370000,-22105000,-39192000,50000000,10808000,92210000,103018000,71707000,31311000,130000000,$n$2026年9月取締役会資料 p.12（見込）。（参考）SBIR補助金の未入金残高 5億3,948万円。$n$),
  ('p07','2027-01','forecast',50000000,-75063000,-9370000,-14080000,-48513000,73894000,25381000,103018000,128399000,50537000,77861000,205000000,$n$2026年9月取締役会資料 p.12（見込）。（参考）SBIR補助金の未入金残高 5億3,948万円。$n$),
  ('p07','2027-02','forecast',20453000,-91113000,-3337000,-15082000,-89078000,45000000,-44078000,128399000,84321000,9424000,74897000,250000000,$n$2026年9月取締役会資料 p.12（見込）。（参考）SBIR補助金の未入金残高 5億3,948万円。$n$),
  ('p07','2027-03','forecast',140413000,-106113000,-3337000,-16582000,14382000,-24000000,-9618000,84321000,74702000,9724000,64978000,226000000,$n$2026年9月取締役会資料 p.12（見込）。（参考）SBIR補助金の未入金残高 3億9,906万円。要確認: 月末預金7,470万円は次ページ（p.13）の2027年4月の月初預金8,778万円と1,307万円食い違う。管理部に確認中。$n$),
  ('p07','2027-04','forecast',50090000,-94907000,-2000000,-39749000,-86566000,127951000,41385000,87776000,129161000,56974000,72188000,370000000,$n$2026年9月取締役会資料 p.13（見込）。（参考）SBIR補助金の未入金残高 3億8,906万円。要確認: 月初預金8,778万円は前ページ（p.12）の2027年3月末7,470万円と1,307万円食い違う。3月末の値が正しいと、以後の残高は1,307万円ずつ低くなり、2027年6月末は約334万円の不足になる。$n$),
  ('p07','2027-05','forecast',7282000,-19468000,0,-12755000,-24941000,-136000,-25077000,129161000,104085000,37506000,66579000,370000000,$n$2026年9月取締役会資料 p.13（見込）。（参考）SBIR補助金の未入金残高 3億8,328万円。$n$),
  ('p07','2027-06','forecast',384781000,-58218000,0,-50781000,275782000,-370132000,-94349000,104085000,9736000,7570000,2166000,0,$n$2026年9月取締役会資料 p.13（見込）。（参考）SBIR補助金の未入金残高 0円（2027年6月の入金で完了）。資金繰りの底。運転資金口座は217万円。6月のSBIR入金で銀行借入3.7億円を返済する計画。$n$),
  ('p07','2027-07','forecast',124038000,-19468000,0,-19131000,85439000,-136000,85304000,9736000,95039000,18102000,76937000,0,$n$2026年9月取締役会資料 p.13（見込）。（参考）SBIR補助金の未入金残高 0円（2027年6月の入金で完了）。$n$),
  ('p07','2027-08','forecast',1500000,-24468000,0,-19631000,-42599000,-136000,-42735000,95039000,52304000,3634000,48670000,0,$n$2026年9月取締役会資料 p.13（見込）。（参考）SBIR補助金の未入金残高 0円（2027年6月の入金で完了）。$n$),
  ('p07','2027-09','forecast',1500000,-62218000,0,-45401000,-106119000,999868000,893750000,52304000,946054000,241417000,704637000,0,$n$2026年9月取締役会資料 p.13（見込）。（参考）SBIR補助金の未入金残高 0円（2027年6月の入金で完了）。シリーズAで10億円を調達する計画（p.13）。$n$),
  ('p07','2027-10','forecast',600000,-13468000,0,-30124000,-42992000,-136000,-43128000,946054000,902926000,227949000,674977000,0,$n$2026年9月取締役会資料 p.13（見込）。（参考）SBIR補助金の未入金残高 0円（2027年6月の入金で完了）。$n$),
  ('p07','2027-11','forecast',600000,-13468000,0,-25634000,-38502000,-132000,-38633000,902926000,864293000,214482000,649811000,0,$n$2026年9月取締役会資料 p.13（見込）。（参考）SBIR補助金の未入金残高 0円（2027年6月の入金で完了）。$n$),
  ('p07','2027-12','forecast',1200000,-52218000,0,-29509000,-80527000,-136000,-80663000,864293000,783630000,162264000,621366000,0,$n$2026年9月取締役会資料 p.13（見込）。（参考）SBIR補助金の未入金残高 0円（2027年6月の入金で完了）。$n$),
  ('p07','2028-01','forecast',1200000,-13468000,0,-26672000,-38940000,-136000,-39076000,783630000,744554000,149996000,594558000,0,$n$2026年9月取締役会資料 p.13（見込）。（参考）SBIR補助金の未入金残高 0円（2027年6月の入金で完了）。$n$),
  ('p07','2028-02','forecast',6000000,-13468000,0,-26672000,-34140000,-123000,-34263000,744554000,710292000,136529000,573763000,0,$n$2026年9月取締役会資料 p.13（見込）。（参考）SBIR補助金の未入金残高 0円（2027年6月の入金で完了）。$n$),
  ('p07','2028-03','forecast',6000000,-62218000,0,-47737000,-103955000,-136000,-104091000,710292000,606201000,74311000,531890000,0,$n$2026年9月取締役会資料 p.13（見込）。（参考）SBIR補助金の未入金残高 0円（2027年6月の入金で完了）。$n$)
ON CONFLICT (project_id, ym) DO UPDATE SET
  source_status = EXCLUDED.source_status, cash_inflow_yen = EXCLUDED.cash_inflow_yen, sbir_payment_yen = EXCLUDED.sbir_payment_yen,
  nedo_payment_yen = EXCLUDED.nedo_payment_yen, working_capital_payment_yen = EXCLUDED.working_capital_payment_yen,
  free_cash_flow_yen = EXCLUDED.free_cash_flow_yen, financing_cash_flow_yen = EXCLUDED.financing_cash_flow_yen,
  net_cash_flow_yen = EXCLUDED.net_cash_flow_yen, opening_cash_yen = EXCLUDED.opening_cash_yen, closing_cash_yen = EXCLUDED.closing_cash_yen,
  sbir_account_balance_yen = EXCLUDED.sbir_account_balance_yen, working_capital_balance_yen = EXCLUDED.working_capital_balance_yen,
  bank_borrowing_balance_yen = EXCLUDED.bank_borrowing_balance_yen, source_note = EXCLUDED.source_note, updated_at = NOW();


-- 7. 関係先（進捗管理 › 関係先）--------------------------------------------------
-- 資料 p.6（NDA・LOI の状況）、p.8（原料調達の進捗）、p.1（マイルストーン）、p.2〜3 と口頭報告から。
-- 技術の性状は技術タブ、相手ごとの約束・状況はここ（spec 3-20 §1.1）。
INSERT INTO project_management_partners (
  project_id, slug, name, role_label, primary_track, relationship_stage, agreement_state, agreed_scope, unagreed_scope,
  last_contact_date, next_commitment, owner_label, last_verified_at, confidence, source_kind, source_ref, sort_order,
  current_ball_side, current_ball_owner, target_state, activity_state, customer_value, classifications, introducer_label, due_date_precision
)
SELECT 'p07', v.slug, v.name, v.role_label, v.track, v.stage, v.agreement, v.agreed, v.unagreed,
  v.last_contact::date, v.next_commitment, v.owner, DATE '2026-09-30', v.confidence, 'manual', v.source_ref, v.sort_order,
  v.ball_side, v.ball_owner, v.target_state, v.activity, v.customer_value, v.classifications::text[], v.introducer, 'unknown'
FROM (VALUES
  ('bm-lohum','Lohum','ブラックマス供給候補（インド）','business_development','information_exchange','partial',
   'NDA締結済み。面談1回。','サンプル評価、供給量・価格・輸出入の条件。調達計画では混合ブラックマスで年2,000トン（水酸化リチウム換算）を準備中。',
   NULL,'Lohumからの次回面談の返事を待つ（依頼済み。必要なら再送）。','事業開発部','medium','2026年9月取締役会資料 p.6・p.8',10,
   'partner','Lohum','サンプル評価と供給条件の協議に進む','waiting_partner',NULL,'{sample_provider}',NULL),
  ('bm-metastable','Metastable Materials','ブラックマス供給候補（インド）','business_development','sample_acquisition','partial',
   'NDA締結済み。面談1回。分析証明書（COA）とブラックマスの種別を問い合わせ、サンプル輸入を準備中。','サンプルの評価結果、供給量・価格。調達計画では混合で年50トン（換算）。',
   NULL,'COAと種別の回答を受けてサンプルを輸入し、評価する。','事業開発部','medium','2026年9月取締役会資料 p.1・p.6・p.8',20,
   'partner','Metastable Materials','サンプル評価を終えて供給条件を協議する','waiting_partner',NULL,'{sample_provider}',NULL),
  ('bm-blackmass-energies','Black Mass Energies','ブラックマス供給候補（インド）','business_development','information_exchange','unagreed',
   '面談1回。','NDA（調整中）、サンプルの輸入と評価、供給条件。調達計画ではLFP年600トン（交渉中）、NMC年900トン（準備中）（換算）。',
   NULL,'NDAを締結し、サンプルを輸入して評価する。','事業開発部','medium','2026年9月取締役会資料 p.1・p.6・p.8',30,
   'shared',NULL,'NDA締結とサンプル評価','active',NULL,'{sample_provider}',NULL),
  ('bm-rubamin','Rubamin','ブラックマス供給候補（インド）','business_development','first_contact','unagreed',
   'Plug and Playが紹介に協力できる。質問リストを送付済み。','面談、NDA、サンプル。',
   NULL,'質問リストへの回答を待つ。','事業開発部','low','2026年9月取締役会資料 p.6',40,
   'partner','Rubamin','面談の実施','waiting_partner',NULL,'{}','Plug and Play'),
  ('bm-dainen','Dainen Materials India','ブラックマス供給候補（インド）','business_development','first_contact','unagreed',
   '問い合わせと追加フォローのメールを送付済み。','返信、面談、NDA。',
   NULL,'返信を待つ。','事業開発部','low','2026年9月取締役会資料 p.6',50,
   'partner',NULL,'面談の実施','waiting_partner',NULL,'{}',NULL),
  ('bm-ecoreco','Ecoreco','ブラックマス供給候補（インド）','business_development','first_contact','unagreed',
   '問い合わせと追加フォローのメールを送付済み。','返信、面談、NDA。',
   NULL,'返信を待つ。','事業開発部','low','2026年9月取締役会資料 p.6',60,
   'partner',NULL,'面談の実施','waiting_partner',NULL,'{}',NULL),
  ('bm-attero','Attero Recycling','ブラックマス供給候補（インド）','business_development','first_contact','unagreed',
   '問い合わせと追加フォローのメールを送付済み。','返信、面談、NDA。',
   NULL,'返信を待つ。','事業開発部','low','2026年9月取締役会資料 p.6',70,
   'partner',NULL,'面談の実施','waiting_partner',NULL,'{}',NULL),
  ('bm-cylib','Cylib GmbH','ブラックマス供給候補（ドイツ）','business_development','meeting_coordination','unagreed',
   '9月にウェブ面談を設定したとの記載。','面談の日付・実施状況と結果（資料では確認中）。',
   NULL,'面談の日付と実施状況を確認する。','事業開発部','low','2026年9月取締役会資料 p.6',80,
   'sx','事業開発部','面談の結果を確認','unknown',NULL,'{}',NULL),
  ('feed-mitsui','三井物産','ブラックマス供給候補（LFP・NMC）','business_development','sample_acquisition','unagreed',
   'LFPは交渉中でサンプル入手を準備中（年200トン、換算）。NMCは準備中（年300トン）。','引取条件、NMCのニッケル・コバルトの扱い。',
   NULL,'LFPのサンプルを入手して評価し、引取条件を協議する（タスク「三井物産との引取協議」）。','事業開発部','medium','2026年9月取締役会資料 p.8',90,
   'shared',NULL,'LFPの引取条件の合意','active',NULL,'{sample_provider}',NULL),
  ('feed-joh','JOH','ブラックマス供給候補（NMC）','business_development','information_exchange','unagreed',
   '準備中（NMC 年200トン、換算）。','ニッケル・コバルトの扱い、供給条件。',
   NULL,'NMCのニッケル・コバルトの扱いを検討する。','事業開発部','low','2026年9月取締役会資料 p.8',100,
   'sx','事業開発部','供給条件の協議','active',NULL,'{}',NULL),
  ('feed-cirba','Cirba','ブラックマス供給候補（北米・LFP）','business_development','on_hold','unagreed',
   '量の見込みは大きい（LFP 年800トン、換算）。','米国の輸出規制で保留。',
   NULL,'輸出規制の動きを見て再開を判断する。','事業開発部','medium','2026年9月取締役会資料 p.8',110,
   'none',NULL,'輸出規制が緩めば再開','on_hold',NULL,'{}',NULL),
  ('feed-nichia','日亜化学工業','原料（匣鉢・未利用リチウム溶液）','business_development','condition_alignment','partial',
   '匣鉢と未利用のリチウム溶液の事業性を議論中。調達計画では2027年に各12トン、2028年以降は年60トン（匣鉢）と年50トン（未利用溶液）（換算）。日亜・TYKの匣鉢と日亜の廃液を評価中。','事業化の条件（価格・量・期間）。',
   NULL,'匣鉢と廃液の評価を進め、事業性の議論を続ける。','事業開発部','high','2026年9月取締役会資料 p.1・p.8',120,
   'shared',NULL,'2027年からの原料供給の合意','active',NULL,'{sample_provider}',NULL),
  ('feed-sumitomo-mm','住友金属鉱山','原料（未利用リチウム溶液）','business_development','technical_review','unagreed',
   '交渉中・テスト試験中（調達計画では年450トン、換算）。現物の廃液はまだ受け取っておらず、模擬廃液で評価している。','現物廃液の提供、事業化の条件。',
   NULL,'模擬廃液での評価を進め、現物廃液の提供を相談する。','事業開発部','medium','2026年9月取締役会資料 p.1・p.8／2026-09-30 取締役会の口頭報告',130,
   'shared',NULL,'現物廃液での評価','active',NULL,'{sample_provider}',NULL),
  ('feed-tyk','TYK','共同研究先（ベンチ実証・匣鉢）','technology_development','executing','agreed',
   '共同研究としてベンチプラント実証試験を実施中（2026年5月開始、第3期 事業報告）。TYKの匣鉢くずも原料として評価中。','量産時の原料供給の条件。',
   NULL,'10月5日から500時間の長期運転（電圧のオン・オフ）を始める。','技術開発部','high','2026-09-30 取締役会の口頭報告／2026年9月取締役会資料 p.1',140,
   'sx','技術開発部','ベンチ実証で長期運転のデータを取る','active',NULL,'{tech_partner,sample_provider}',NULL),
  ('feed-mdk-sustech','MDK SUSTECH','ブラックマス調達の相談先','business_development','meeting_coordination','unagreed',
   '9月25日に面談の予定（資料の時点）。','面談の結果。',
   NULL,'9月25日の面談の結果を確認する。','事業開発部','low','2026年9月取締役会資料 p.1',150,
   'unknown',NULL,'面談結果の確認','unknown',NULL,'{}',NULL),
  ('feed-scimplify','Scimplify','インドのブラックマス調達の相談先（UMIの投資先）','business_development','information_exchange','partial',
   'インドで実際にリサイクルしている会社と組めば、当面は輸入に問題ないとの見立てを得た（2026-09-30 取締役会の口頭報告）。','具体的な調達経路の紹介、UMIを交えた調達戦略。',
   NULL,'UMI・Scimplifyと調達戦略を協議する（9月25日の予定、資料の時点）。','事業開発部','medium','2026年9月取締役会資料 p.1／2026-09-30 取締役会の口頭報告',160,
   'shared',NULL,'インドからの調達経路の確立','active',NULL,'{sample_route}','UMI'),
  ('fusion-evonik','Evonik','LOI取得先（JDA・出資を協議）','business_development','condition_alignment','partial',
   'LOIを取得済み（2026年8月の取締役会で報告）。膜メーカーの設備投資判断に向けた需要の裏付けの1社目。','JDA（共同開発契約）と出資の可能性。',
   NULL,'JDAの締結と出資の可能性を協議する。','事業開発部','high','2026年9月取締役会資料 p.1・p.6／2026-08-26 取締役会',200,
   'shared',NULL,'JDAの締結','active',NULL,'{}',NULL),
  ('fusion-proxima','Proxima Fusion','リチウム6の需要先候補（核融合）','business_development','condition_alignment','partial',
   '8月12日に会議。NDA締結済み、LOIを送付。','LOIの締結。',
   '2026-08-12','LOIへの回答を待つ（NDA完了の確認も）。','事業開発部','medium','2026年9月取締役会資料 p.1・p.6',210,
   'partner','Proxima Fusion','LOIの締結','waiting_partner',NULL,'{}',NULL),
  ('fusion-focused','Focused Energy','リチウム6の需要先候補（核融合）','business_development','condition_alignment','unagreed',
   'NDAを確認中。条件が合えばLOIを締結する方向。','NDA、LOIの条件。',
   NULL,'9月11日の面談（予定）の結果を確認し、LOIの条件を詰める。','事業開発部','medium','2026年9月取締役会資料 p.1・p.6',220,
   'shared',NULL,'LOIの締結','active',NULL,'{}',NULL),
  ('fusion-marvel','Marvel Fusion','リチウム6の需要先候補（核融合）','business_development','information_exchange','unagreed',
   'NDAを確認中。技術には関心がある。','リチウム6の供給先としての関心は低い。',
   NULL,'LOIの要否を見極める。','事業開発部','low','2026年9月取締役会資料 p.6',230,
   'partner',NULL,'LOIの要否の判断','active','low','{}',NULL),
  ('fusion-aspl','ASPL Fusion','リチウム6の需要先候補（核融合）','business_development','condition_alignment','unagreed',
   '9月7日に面談。リチウム6・リチウム7のニーズを確認し、LOIを送付。','LOIの締結。',
   '2026-09-07','LOIへの回答を待つ。','事業開発部','medium','2026年9月取締役会資料 p.6',240,
   'partner','ASPL Fusion','LOIの締結','waiting_partner',NULL,'{}',NULL),
  ('fusion-starlight','Starlight Energy','リチウム6の需要先候補（核融合）','business_development','hearing','unagreed',
   '9月7日に面談。リチウム6の需要は10トン。','需要の時期、LOI。',
   '2026-09-07','需要の時期を確認する。','事業開発部','medium','2026年9月取締役会資料 p.6',250,
   'sx','事業開発部','LOIの締結','active',NULL,'{}',NULL),
  ('fusion-helical','Helical Fusion','リチウム6の需要先候補（核融合）','business_development','meeting_coordination','unagreed',
   'LOIのひな形を送付。TYKでのベンチの見学を調整中。','LOIの締結。',
   NULL,'TYKの見学日程を決める。','事業開発部','medium','2026年9月取締役会資料 p.6',260,
   'shared',NULL,'見学を経てLOIの締結','active',NULL,'{}',NULL),
  ('fusion-tokamak','Tokamak Energy','リチウム6の需要先候補（核融合）','business_development','meeting_coordination','unagreed',
   'ピッチ資料を送付し、面談日程の調整を依頼。','面談、NDA。',
   NULL,'面談日程の返事を待つ。','事業開発部','low','2026年9月取締役会資料 p.6',270,
   'partner','Tokamak Energy','面談の実施','waiting_partner',NULL,'{}',NULL),
  ('fusion-cfs','CFS（Commonwealth Fusion Systems）','リチウム6の需要先候補（核融合）','business_development','meeting_coordination','unagreed',
   '9月18日にウェブ面談を設定済み。','面談の結果（資料には未記載）。',
   NULL,'9月18日の面談の結果を確認する。','事業開発部','low','2026年9月取締役会資料 p.6',280,
   'sx','事業開発部','面談結果の確認','unknown',NULL,'{}',NULL),
  ('fusion-xcimer','Xcimer Energy','リチウム6の需要先候補（核融合）','business_development','candidate','unagreed',
   '候補として一覧に掲載。','接触の状況（資料の進捗欄は未記載）。',
   NULL,'接触の状況を確認する。','事業開発部','low','2026年9月取締役会資料 p.6',290,
   'unknown',NULL,'接触の開始','unknown',NULL,'{}',NULL),
  ('fusion-helion','Helion Energy','リチウム6の需要先候補（核融合）','business_development','candidate','unagreed',
   '候補として一覧に掲載。','接触の状況（資料の進捗欄は未記載）。',
   NULL,'接触の状況を確認する。','事業開発部','low','2026年9月取締役会資料 p.6',300,
   'unknown',NULL,'接触の開始','unknown',NULL,'{}',NULL),
  ('fusion-novatron','Novatron Fusion','リチウム6の需要先候補（核融合）','business_development','first_contact','unagreed',
   '問い合わせを送付済み。','返信、面談。',
   NULL,'返信を待つ。','事業開発部','low','2026年9月取締役会資料 p.6',310,
   'partner',NULL,'面談の実施','waiting_partner',NULL,'{}',NULL),
  ('fusion-gauss','Gauss Fusion','リチウム6の需要先候補（核融合）','business_development','first_contact','unagreed',
   '問い合わせを送付済み。','返信、面談。',
   NULL,'返信を待つ。','事業開発部','low','2026年9月取締役会資料 p.6',320,
   'partner',NULL,'面談の実施','waiting_partner',NULL,'{}',NULL),
  ('fusion-renaissance','Renaissance Fusion','リチウム6の需要先候補（核融合）','business_development','first_contact','unagreed',
   '問い合わせを送付済み。','返信、面談。',
   NULL,'返信を待つ。','事業開発部','low','2026年9月取締役会資料 p.6',330,
   'partner',NULL,'面談の実施','waiting_partner',NULL,'{}',NULL),
  ('fusion-firefly','Firefly Fusion','リチウム6の需要先候補（核融合）','business_development','on_hold','unagreed',
   '返信あり。','リチウム6の調達は現時点で重点外とのこと。',
   NULL,'時期を置いて再接触するか判断する。','事業開発部','medium','2026年9月取締役会資料 p.6',340,
   'none',NULL,'需要が出た時点で再接触','on_hold','low','{}',NULL),
  ('fusion-tae','TAE Technologies','リチウム6の需要先候補（核融合）','business_development','on_hold','unagreed',
   '接触済み。','リチウム6の重要度は小さいとの記載。',
   NULL,'優先度を下げる。','事業開発部','medium','2026年9月取締役会資料 p.6',350,
   'none',NULL,'需要が出た時点で再接触','on_hold','low','{}',NULL),
  ('fusion-linea','LINEAイノベーション','リチウム6の需要先候補（核融合）','business_development','declined','unagreed',
   '接触済み。','リチウム6は不要との記載。',
   NULL,'対象から外す。','事業開発部','medium','2026年9月取締役会資料 p.6',360,
   'none',NULL,'対象外','dropped','low','{}',NULL),
  ('tech-chiyoda','千代田化工建設','前処理プラントの基本設計（FEED）の相手','technology_development','condition_alignment','unagreed',
   '前処理プラントの基本設計（FEED）の見積もりを協議中。2週ごとの面談で設計内容と見積条件を調整。','FEEDの見積額と契約条件。',
   NULL,'FEEDの見積条件を詰めて契約する（マイルストーン: 2027年3月までにベンチプラント建設の契約）。','技術開発部','high','2026年9月取締役会資料 p.1',400,
   'shared',NULL,'FEEDの契約','active',NULL,'{tech_partner}',NULL),
  ('tech-technosigma','テクノシグマ','自動制御装置2号機の製作','technology_development','executing','agreed',
   '自動制御装置2号機（膜100枚で立ち上げ、1,000枚規模まで拡張できる設計）を税込2億円弱で発注。支払は40%・30%・30%（2026-09-09 経営会議）。','組立の日程（11月中旬に開始の見込み）。',
   NULL,'2号機の組立を進める。','技術開発部','medium','2026-09-09 経営会議（技術タブ「装置の到達実績」）',410,
   'partner','テクノシグマ','2号機の完成と通液試験','active',NULL,'{tech_partner}',NULL),
  ('tech-qst','QST（量子科学技術研究開発機構）','技術の出どころ・共同研究先・株主','technology_development','executing','agreed',
   'LiSMICはQSTで発案された技術。SBIRをQSTとのコンソーシアムで実施。現物出資の株主（普通株式4,000株）。膜20枚でリチウム6の濃縮実験を実施中。','共同特許の外国出願の範囲、リチウム6濃縮の結果。',
   NULL,'リチウム6濃縮実験の結果を確認する。','技術開発部','high','第3期 事業報告／応募申請書 r3／2026-09-09 経営会議',420,
   'shared',NULL,'リチウム6濃縮の実証','active',NULL,'{tech_partner}',NULL),
  ('fund-nippon-sanso','日本酸素','キングサーモンプロジェクトの連携先','funding','condition_alignment','partial',
   'キングサーモンプロジェクト（核融合炉向けの開発資金、最大3億円）に連携して申請する。第一段階のAgoraに申請済み（口頭の報告）。','本申請の役割分担と時期。LOIの一覧にはまだ載っていない。',
   NULL,'本申請の準備を進める。','事業開発部','medium','2026年9月取締役会資料 p.3／2026-09-30 取締役会の口頭報告',500,
   'shared',NULL,'本申請と採択','active',NULL,'{}',NULL),
  ('org-jfe-ogimachi','JFE（川崎扇町の拠点）','新拠点の貸主','organizational_building','agreement_confirmation','partial',
   '敷金1,500万円（当初6,000万円）、面積3,000㎡（当初6,000㎡）、月額賃料400万円（当初800万円）で概ね合意。','契約の締結（LiSTie手配の環境調査の結果で判断）。見学した9名中5名に健康被害の訴えがあった。',
   NULL,'LiSTie手配の環境調査を行い、結果で契約を判断する。','管理部','high','2026年9月取締役会資料 p.3／2026-09-30 取締役会の口頭報告',600,
   'sx','管理部','契約締結と移転','active',NULL,'{}',NULL),
  ('org-plug-and-play','Plug and Play','COO候補の出身元・紹介元','organizational_building','agreement_confirmation','partial',
   '是洞さんをCOO候補（事業開発部長）として採用予定（SusHi Techの枠組み）。Rubaminの紹介にも協力。','着任時期（2026年12月から2027年1月へ1か月後ろ倒しを調整中）。先方の部署で人の流出が続いている。',
   NULL,'是洞さんの着任を2027年1月で調整する。','星野さん','high','2026年9月取締役会資料 p.2／2026-09-30 取締役会の口頭報告',610,
   'shared',NULL,'是洞さんの着任','active',NULL,'{}',NULL)
) AS v(slug, name, role_label, track, stage, agreement, agreed, unagreed, last_contact, next_commitment, owner, confidence, source_ref, sort_order,
       ball_side, ball_owner, target_state, activity, customer_value, classifications, introducer)
ON CONFLICT (project_id, slug) DO NOTHING;

-- 8. タスク（進捗管理 › タスク）: 既存の承認待ちタスクのうち、今日の会議で状況が分かったもの ---
UPDATE project_actions SET status = 'done', actual_end = DATE '2026-09-30', progress_pct = 100,
  done_evidence = '2026年9月取締役会資料 p.3「敷金・賃料含め概ね完了」。口頭で敷金1,500万円・面積3,000㎡・月額賃料400万円と報告（2026-09-30）。',
  last_verified_at = DATE '2026-09-30', updated_by = 'amie', updated_at = NOW(), version = version + 1
WHERE id = '7349633d-6311-5812-afce-5ebf23ff9b57' AND project_id = 'p07' AND status <> 'done';

UPDATE project_actions SET status = 'done', actual_end = DATE '2026-09-30', progress_pct = 100,
  done_evidence = '取締役会は2026-09-30 10時に開催（カレンダーの予定とNotionの記録が一致）。',
  last_verified_at = DATE '2026-09-30', updated_by = 'amie', updated_at = NOW(), version = version + 1
WHERE id = 'e994a87a-3f5d-5492-a2cb-c51b98f1d99f' AND project_id = 'p07' AND status <> 'done';

UPDATE project_actions SET status = 'running',
  actual = '2026年9月取締役会資料 p.12〜13 で2027年4月〜2028年3月の月次資金繰りが出た（1ケース、2027年9月にシリーズA10億円を想定。底は2027年6月末の974万円）。補助金あり／なしの2ケース比較と最低必要調達額はまだ無い。',
  last_verified_at = DATE '2026-09-30', updated_by = 'amie', updated_at = NOW(), version = version + 1
WHERE id = 'e5315b1a-4439-5a45-a9b0-60cf16c3f4f0' AND project_id = 'p07';

UPDATE project_actions SET status = 'running',
  actual = '本番材料（PEEK）のセルスタック（デモスタック）が完成し、9/29に室温・水だけで通液して液漏れなし（電極は未装着。入れると膨らむおそれがあり引き続き確認）。2号機の組立開始は11月中旬の見込み（9/9時点）。設計条件での運転は未実施。',
  last_verified_at = DATE '2026-09-30', updated_by = 'amie', updated_at = NOW(), version = version + 1
WHERE id = '526c4d55-b26f-40aa-a57e-84ff0c3533e9' AND project_id = 'p07';

COMMIT;
