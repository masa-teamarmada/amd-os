-- SOL（p21）2026-11-20 臨時経営会議の反映（2026-11-21）
--
-- まさの依頼（2026-11-21）:「経営会議昨日開催してこの件について議論したから、notion書き起こし確認しておいて。んでOSに必要な情報を入れておいてほしい。」
-- 出典: Notion AI議事録「solviorax経営会議（臨時）」の要約と書き起こし全文（Notion連携で取得）、Calendar添付の Gemini のメモ（人名・担当の照合に使用）。
-- 書き起こしの聞き違いの扱い: 「大規模アクシス」「大気アクシス」「大規約シス」→ ダイキアクシス。「堀口」「堀江」「マホロヒブ」→ DAVPの堀淵さん。
--   「山井」「山内」「山下」→ 山地。「ビヨンド」→ Beyond Next Ventures（BNV）。「三学・三角・単学共同部門」→ 産学共同部門。
-- 背景: H-1（会議カードの自動作成）が 2026-10-31 以降どのPJでも動いていないため、手動でカードを作る。
-- 1. MTGカード（新規）と議事録の取り込み台帳（recovered）
-- 2. 経営会議の決議の対応（project_config meeting_resolutions）
-- 3. 関係先: DAVP・ダイキアクシス・BNV・Partners Fund・愛媛大学を更新。DAVPのやり取り履歴に 11/12 送付と 11/17 の電話を追加
-- 4. ゴールツリーのTODO: 会議の次の一手を未承認（proposed）で6件追加
-- 気持ち・人物評はワークスペースから見える関係先・TODOに書かず、事実だけにする。カードはワークスペースに共有しない（既定のまま）。
-- 生成: scratchpad の m520.py（コミットしない）

BEGIN;

INSERT INTO project_meeting_summaries (meeting_id, project_id, ym, meeting_date, meeting_start_at, title, notion_url, notion_page_id, calendar_event_id,
  summary_short, decided, progress, next_actions, risks, source_hash, generated_at, generated_by_model, source_kinds, narrative_md)
VALUES ($m$jrco0eud1ngrvqifl87en2skt4$m$, 'p21', '202611', DATE '2026-11-20', TIMESTAMPTZ '2026-11-20 04:00:00+00', $m$solviorax経営会議（臨時）$m$,
  $m$https://app.notion.com/p/41e97749c60881d0bd7dd4e434ab17b9$m$, $m$41e97749-c608-81d0-bd7d-d4e434ab17b9$m$, $m$jrco0eud1ngrvqifl87en2skt4$m$,
  $m$DAVPの堀淵さんから石原先生への電話を受け、会社の形とダイキアクシスとの関わり方を協議。燃料も含めてSolvioraXで進め、ダイキアクシスとの共同研究はSolvioraXが結んで杉浦研究室と共同研究する形を基本にした。大学側は産学共同部門、拠点はオフィスとオープンラボの併用の方向。出資額と約2億円の範囲は未確認。$m$, $m$["ダイキアクシスとの燃料（油）の研究は、SolvioraXがダイキアクシスと共同研究を結び、その資金で杉浦研究室と共同研究する形を基本にする。ダイキアクシスからは研究員を出してもらう。", "SolvioraXは燃料も含めて進める。山地が堀淵さんへこの形を伝えて出資を最大限お願いし、排水処理と一緒のため数千万円にとどまる場合もこの形で進める。", "大学側の受け入れは産学共同部門の方向で進める（寄附講座より研究部門として使いやすい）。", "拠点は、イノベーションコモンズのオフィスを会社名義（一般料金）で借り、ラボは共同研究費の直接経費を1,000万円以上にしてオープンラボを使う形にする。", "研究室の博士課程の留学生の採用に向け、会社から就労ビザを出せるよう手続きを早めに進める。"]$m$::jsonb, $m$["杉浦先生はこの1年重金属に注力し、燃料の研究はほぼ止まっていた。重金属が定型作業になったため、燃料に本腰を入れる。", "ダイキアクシスとのリアクター開発は共同研究ではなくNDAのもとで進めている。メイトの現地で使う装置の設計はほぼ決まり、次は50L、最終的に1tへ大きくする。", "石原先生がSolvioraXオープンイノベーションハブ（資源循環・環境技術の産学共同部門）の構想資料を共有した。"]$m$::jsonb, $m$["石原先生：堀淵さんと山地の間を調整し、現在は共同研究の段階であることと、SolvioraXが窓口になる形を伝える。", "山地：堀淵さんへ、燃料も含めて進めることとこの形での出資のお願いを伝え、約2億円が共同研究費を含むかを確認する。", "山地：Partners FundとBNVにも早めに相談する。来週BNVの有馬さんと会う。", "石原先生：産学連携部門に、産学共同部門の構想と共同研究費の扱いを確認する。", "山地：留学生本人と直接話す。会社から就労ビザを出す条件と手続きを調べる。", "担当未定：オフィスとオープンラボの費用と、共同研究費の直接経費を1,000万円以上にする積算をまとめる。"]$m$::jsonb, $m$["堀淵さんの約2億円が共同研究費を含むか、燃料への出資額とリードの有無は未確認（石原先生経由の話のみ）。", "油を細胞の外へ出す遺伝子を、既存の特許に抵触せずに見つけられるか。探索にかかる期間は不明。", "SolvioraXを介した共同研究の形をダイキアクシスが受け入れるかは未確認。", "産学共同部門の設置（最低2年、5年で更新）を大学が認めるかは、産学連携部門の確認待ち。", "就労ビザの取得には時間がかかり、設立と同時に出せるかは未定。"]$m$::jsonb, $m$notion+gemini:6dca2af0d28e4dde194f4c09152cdff48ac66f012b0c5c139bcfadf03144b7cb$m$, NOW(), 'manual-amie-2026-11-21',
  $m$notion+gemini+calendar$m$, $m$## 🎯背景
2026年11月20日13時から約1時間、SolvioraXの臨時の経営会議をオンラインで開いた（山地・杉浦先生・石原先生）。11月17日、DAVPの堀淵さんから石原先生へ、新会社の事業化の進め方を確かめる電話があった。山地は10月26日に燃料事業の提案を、11月12日に排水処理・金属回収・燃料の3事業をまとめた事業概要を堀淵さんへ送っており、2つの資料の順番で受け止めが混乱した可能性がある。石原先生経由で伝わった堀淵さんの見方は、燃料だけなら約2億円、排水処理を含むなら数千万円の出資というもの。会社の形とダイキアクシスとの関わり方を3人で決めるために開いた。

## 📊経緯
石原先生によると、堀淵さんは燃料だけに絞るよう求めたのではなく、水も油も事業化に時間がかかるという認識で、燃料への投資判断なら早いという話だった。ダイキアクシスとのリアクター開発は共同研究ではなくNDAのもとで進めており、現場から断片的に伝わる情報で判断されている面がある。BNVがリードを希望しているとの話も出た。

杉浦先生は、この1年は重金属に注力して燃料の研究がほぼ止まっていたが、重金属が定型作業になったので燃料に本腰を入れたいと説明した。懸念は、油を細胞の外へ出す遺伝子を既存の特許に抵触せずに見つけられるか。ダイキアクシスから人が来れば3年かかる作業が1年に縮む可能性があり、地方では人を探すこと自体が最大の課題だという。研究費は窓口が一つの方が管理しやすく、直接でもSolvioraX経由でも構わないとした。

山地は、分泌させる方法と分解して取り出す方法の両方で開発する考えを示した。ダイキアクシスと大学が直接共同研究すると成果が両者の共有になり、会社として将来の選択肢を残しにくい。そこでSolvioraXがダイキアクシスと共同研究を結び、その資金で杉浦研究室と共同研究する形を提案し、了承された。

大学側の受け入れ方として、石原先生から産学共同部門（設置は最低2年、5年で更新）が提案された。寄附講座より研究部門として使いやすく、会社から来る人も大学内で身分を持て、技術や関係企業が増えても契約を一つにまとめられる。山地は、投資家に杉浦先生との関係を説明するうえでも有効だとした。拠点は、イノベーションコモンズのオフィスを会社名義で借りると一般料金（年約67万円）になり、共同研究費の直接経費が1,000万円以上あればオープンラボを52万円で使える。最後に杉浦先生から、研究室の博士課程3年の留学生が入社を希望していると共有があった。9月卒業の見込みで、会社から就労ビザを出す必要がある。

## ✅決まったこと
- ダイキアクシスとの燃料（油）の研究は、SolvioraXがダイキアクシスと共同研究を結び、その資金で杉浦研究室と共同研究する形を基本にする。ダイキアクシスからは研究員を出してもらう。
- SolvioraXは燃料も含めて進める。山地が堀淵さんへこの形を伝えて出資を最大限お願いし、排水処理と一緒のため数千万円にとどまる場合もこの形で進める。
- 大学側の受け入れは産学共同部門の方向で進める（寄附講座より研究部門として使いやすい）。
- 拠点は、イノベーションコモンズのオフィスを会社名義（一般料金）で借り、ラボは共同研究費の直接経費を1,000万円以上にしてオープンラボを使う形にする。
- 研究室の博士課程の留学生の採用に向け、会社から就労ビザを出せるよう手続きを早めに進める。

## ▶️次の一手
- 石原先生：堀淵さんと山地の間を調整し、現在は共同研究の段階であることと、SolvioraXが窓口になる形を伝える。
- 山地：堀淵さんへ、燃料も含めて進めることとこの形での出資のお願いを伝え、約2億円が共同研究費を含むかを確認する。
- 山地：Partners FundとBNVにも早めに相談する。来週BNVの有馬さんと会う。
- 石原先生：産学連携部門に、産学共同部門の構想と共同研究費の扱いを確認する。
- 山地：留学生本人と直接話す。会社から就労ビザを出す条件と手続きを調べる。
- 担当未定：オフィスとオープンラボの費用と、共同研究費の直接経費を1,000万円以上にする積算をまとめる。

## ⚠️残課題
- 堀淵さんの約2億円が共同研究費を含むか、燃料への出資額とリードの有無は未確認（石原先生経由の話のみ）。
- 油を細胞の外へ出す遺伝子を、既存の特許に抵触せずに見つけられるか。探索にかかる期間は不明。
- SolvioraXを介した共同研究の形をダイキアクシスが受け入れるかは未確認。
- 産学共同部門の設置（最低2年、5年で更新）を大学が認めるかは、産学連携部門の確認待ち。
- 就労ビザの取得には時間がかかり、設立と同時に出せるかは未定。$m$)
ON CONFLICT (meeting_id) DO UPDATE SET summary_short = EXCLUDED.summary_short, decided = EXCLUDED.decided, progress = EXCLUDED.progress,
  next_actions = EXCLUDED.next_actions, risks = EXCLUDED.risks, narrative_md = EXCLUDED.narrative_md, notion_url = EXCLUDED.notion_url,
  notion_page_id = EXCLUDED.notion_page_id, source_kinds = EXCLUDED.source_kinds, source_hash = EXCLUDED.source_hash, title = EXCLUDED.title,
  generated_by_model = EXCLUDED.generated_by_model, generated_at = NOW(), updated_at = NOW();

INSERT INTO meeting_minutes_backfill_ledger (calendar_event_id, project_id, title, meeting_start_at, meeting_end_at, status, attempt_count, max_attempts,
  first_detected_at, last_attempt_at, last_outcome, detected_by, notes, created_at, updated_at)
VALUES ($m$jrco0eud1ngrvqifl87en2skt4$m$, 'p21', $m$solviorax経営会議（臨時）$m$, TIMESTAMPTZ '2026-11-20 04:00:00+00', TIMESTAMPTZ '2026-11-20 05:00:00+00', 'recovered', 0, 5, NOW(), NOW(),
  'backfilled_manually', 'manual', $m$Notionの要約と書き起こし全文とGeminiのメモから手動でカードを作成（2026-11-21、migration 520）。H-1は2026-10-31以降停止中$m$, NOW(), NOW())
ON CONFLICT (calendar_event_id) DO UPDATE SET status = 'recovered', last_outcome = 'backfilled_manually', notes = EXCLUDED.notes, updated_at = NOW();

INSERT INTO project_config (project_id, key, value, updated_at)
VALUES ('p21', $m$meeting_resolutions:jrco0eud1ngrvqifl87en2skt4$m$, $m${"version": 1, "sourceHash": "notion+gemini:6dca2af0d28e4dde194f4c09152cdff48ac66f012b0c5c139bcfadf03144b7cb", "entries": [{"agenda": "ダイキアクシスとの燃料（油）の共同研究の枠組み", "outcome": "方針確認", "detail": "SolvioraXがダイキアクシスと共同研究を結び、その資金で杉浦研究室と共同研究する形を基本にする。ダイキアクシスから研究員を出してもらう。先方との協議はこれから。", "evidence": "ダイキアクシスとの燃料（油）の研究は、SolvioraXがダイキアクシスと共同研究を結び、その資金で杉浦研究室と共同研究する形を基本にする。ダイキアクシスからは研究員を出してもらう。"}, {"agenda": "DAVPへの出資依頼の進め方", "outcome": "方針確認", "detail": "燃料も含めてSolvioraXで進める。山地が堀淵さんへこの形を伝えて出資を最大限お願いする。出資額と約2億円の範囲は未確認。", "evidence": "SolvioraXは燃料も含めて進める。山地が堀淵さんへこの形を伝えて出資を最大限お願いし、排水処理と一緒のため数千万円にとどまる場合もこの形で進める。"}, {"agenda": "大学側の受け入れ枠組み", "outcome": "方針確認", "detail": "産学共同部門の方向で進める。設置の可否と期間は石原先生が産学連携部門に確認する。", "evidence": "大学側の受け入れは産学共同部門の方向で進める（寄附講座より研究部門として使いやすい）。"}, {"agenda": "設立後の拠点（オフィスとラボ）", "outcome": "方針確認", "detail": "オフィスは会社名義（一般料金）、ラボは共同研究費の直接経費を1,000万円以上にしてオープンラボを使う。費用の積算は担当未定。", "evidence": "拠点は、イノベーションコモンズのオフィスを会社名義（一般料金）で借り、ラボは共同研究費の直接経費を1,000万円以上にしてオープンラボを使う形にする。"}, {"agenda": "博士課程の留学生の採用と就労ビザ", "outcome": "方針確認", "detail": "会社から就労ビザを出せるよう手続きを早めに進める。設立と同時に出せるかは未定。", "evidence": "研究室の博士課程の留学生の採用に向け、会社から就労ビザを出せるよう手続きを早めに進める。"}]}$m$, NOW())
ON CONFLICT (project_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

UPDATE project_management_partners SET owner_label = $m$まさ$m$, agreed_scope = $m$事業計画・月次計画・顧客候補を基に出資・協業を協議。10/26に燃料事業の提案を、11/12に排水処理・金属回収・燃料の3事業の事業概要を送付。$m$, unagreed_scope = $m$出資額・評価額・投資条件・リードの有無・着金時期。11/17の石原先生経由の話では、燃料だけなら約2億円、排水処理を含むなら数千万円との見方。約2億円が共同研究費を含むかは未確認。出資する場合、代表に設立後も継続して経営に関わることを求める意見。$m$, next_commitment = $m$山地が堀淵さんへ、SolvioraXが燃料も含めて進めることと、ダイキアクシスとの共同研究をSolvioraXが結ぶ形を伝え、出資をお願いする。約2億円の範囲を確認する。石原先生が事前に堀淵さんとの間を調整する。$m$, last_contact_date = DATE '2026-11-17', current_ball_side = $m$sx$m$, current_ball_owner = $m$まさ$m$, activity_state = $m$active$m$, last_verified_at = DATE '2026-11-21', source_kind = 'manual', source_ref = $m$2026-11-20 臨時経営会議（Notionの要約と書き起こし・Geminiのメモ）$m$, version = version + 1 WHERE project_id = 'p21' AND slug = $m$davp$m$ AND deleted_at IS NULL;

UPDATE project_management_partners SET agreed_scope = $m$NDA締結済み（2026-05-13）。リアクター開発は共同研究契約ではなくNDAのもとで進めている。試作リアクター製作済み。メイトの現地で使う装置の設計はほぼ決まり、次は50L、最終的に1tへ大きくする（2026-11-20 杉浦先生）。$m$, unagreed_scope = $m$納品日と受入確認条件。燃料（油）の共同研究：SolvioraXとダイキアクシスで結び、ダイキアクシスから研究員を出してもらう形（2026-11-20 経営会議の方針。先方との協議はこれから）。$m$, last_verified_at = DATE '2026-11-21', source_kind = 'manual', source_ref = $m$2026-11-20 臨時経営会議（Notionの要約と書き起こし・Geminiのメモ）$m$, version = version + 1 WHERE project_id = 'p21' AND slug = $m$daiki-axis$m$ AND deleted_at IS NULL;

UPDATE project_management_partners SET owner_label = $m$まさ$m$, unagreed_scope = $m$出資判断・金額・条件と参加時期、リードの引受け（2026-11-20の経営会議で、BNVがリードを希望しているとの話が出た）。BNVが求めるCEOの稼働と、山地が説明した現時点の約7割稼働の扱い。$m$, next_commitment = $m$来週、山地が有馬さんと会い、DAVPとの進め方（SolvioraXが燃料も含めて進める形）を相談する。CEOの稼働・経営体制と今回ラウンドへの参加条件も確認する。$m$, last_verified_at = DATE '2026-11-21', source_kind = 'manual', source_ref = $m$2026-11-20 臨時経営会議（Notionの要約と書き起こし・Geminiのメモ）$m$, version = version + 1 WHERE project_id = 'p21' AND slug = $m$bnv$m$ AND deleted_at IS NULL;

UPDATE project_management_partners SET next_commitment = $m$DAVPとの進め方（SolvioraXが燃料も含めて進める形）を山地が早めに相談する。資料の検討状況とリードの可否、他投資家と協議する条件も確認する。$m$, last_verified_at = DATE '2026-11-21', source_kind = 'manual', source_ref = $m$2026-11-20 臨時経営会議（Notionの要約と書き起こし・Geminiのメモ）$m$, version = version + 1 WHERE project_id = 'p21' AND slug = $m$partners-fund$m$ AND deleted_at IS NULL;

UPDATE project_management_partners SET owner_label = $m$まさ$m$, agreed_scope = $m$PSI STEP2の研究実証を進める関係。設立後の受け入れは産学共同部門（資源循環・環境技術）の方向で進める（2026-11-20 経営会議で方針確認）。拠点はイノベーションコモンズのオフィスを会社名義で借り、ラボは共同研究費（直接経費1,000万円以上）でオープンラボを使う形。$m$, unagreed_scope = $m$NewCoの契約主体・知財・大学発ベンチャー条件。産学共同部門の設置（最低2年、5年で更新）の承認。共同研究費の扱い。$m$, next_commitment = $m$石原先生が産学連携部門に、産学共同部門の構想（構想資料は送付済み）と共同研究費の扱いを確認する。$m$, due_date = NULL, due_date_precision = $m$unknown$m$, last_contact_date = DATE '2026-11-20', current_ball_side = $m$shared$m$, current_ball_owner = $m$石原先生$m$, activity_state = $m$active$m$, last_verified_at = DATE '2026-11-21', source_kind = 'manual', source_ref = $m$2026-11-20 臨時経営会議（Notionの要約と書き起こし・Geminiのメモ）$m$, version = version + 1 WHERE project_id = 'p21' AND slug = $m$ehime-university$m$ AND deleted_at IS NULL;

INSERT INTO project_management_partner_interactions (project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary,
  ball_side_after, ball_owner_after, confidence, source_kind, source_ref, actor_side, actor_label)
SELECT 'p21', p.id, $m$email$m$, DATE '2026-11-12', 'day', $m$排水処理・金属回収・燃料の3事業の事業概要資料を送付$m$, $m$10/26の燃料事業の提案に続き、会社全体の事業像を共有した。$m$, $m$partner$m$, $m$堀淵さん$m$, 'high', 'manual', $m$2026-11-20 臨時経営会議（Notionの要約と書き起こし・Geminiのメモ）$m$, $m$sx$m$, $m$まさ$m$
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$davp$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_interactions i WHERE i.partner_id = p.id AND i.occurred_on = DATE '2026-11-12' AND i.summary = $m$排水処理・金属回収・燃料の3事業の事業概要資料を送付$m$ AND i.deleted_at IS NULL);

INSERT INTO project_management_partner_interactions (project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary,
  ball_side_after, ball_owner_after, confidence, source_kind, source_ref, actor_side, actor_label)
SELECT 'p21', p.id, $m$status_update$m$, DATE '2026-11-17', 'day', $m$堀淵さんから石原先生へ、新会社の事業化の進め方を確かめる電話$m$, $m$燃料だけなら約2億円、排水処理を含むなら数千万円との見方。水も油も事業化に時間がかかるとの認識で、燃料への投資判断なら早いとの話。出資する場合は代表に設立後も継続して経営に関わってほしいとの意見。いずれも石原先生経由。$m$, $m$sx$m$, $m$まさ$m$, 'high', 'manual', $m$2026-11-20 臨時経営会議（Notionの要約と書き起こし・Geminiのメモ）$m$, $m$partner$m$, $m$堀淵さん→石原先生$m$
FROM project_management_partners p WHERE p.project_id = 'p21' AND p.slug = $m$davp$m$ AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_management_partner_interactions i WHERE i.partner_id = p.id AND i.occurred_on = DATE '2026-11-17' AND i.summary = $m$堀淵さんから石原先生へ、新会社の事業化の進め方を確かめる電話$m$ AND i.deleted_at IS NULL);

INSERT INTO project_actions (project_id, title, detail, action_kind, status, owner_label, planned_start, date_certainty, done_criteria,
  origin_kind, origin_ref, sort_order, review_state, proposed_question_id, proposal_reason, created_by, updated_by)
SELECT 'p21', $m$堀淵さんへ燃料も含めて進めることを伝え、出資をお願いする$m$, $m$燃料も含めてSolvioraXで進めること、ダイキアクシスとの共同研究をSolvioraXが結んで杉浦研究室と共同研究する形を伝え、出資を最大限お願いする。約2億円が共同研究費を含むかを確認する。$m$, 'work', 'not_started', $m$まさ$m$, DATE '2026-11-20', 'provisional', $m$堀淵さんの回答（出資の意向と金額の範囲）を得ている$m$,
  'meeting', $m$project_meeting_summaries:jrco0eud1ngrvqifl87en2skt4$m$, 100, 'proposed', $m$21000000-2026-4000-8000-000000009102$m$::uuid, $m$2026-11-20 臨時経営会議の次の一手$m$, 'amie', 'amie'
WHERE NOT EXISTS (SELECT 1 FROM project_actions a WHERE a.project_id = 'p21' AND a.origin_ref = $m$project_meeting_summaries:jrco0eud1ngrvqifl87en2skt4$m$ AND a.title = $m$堀淵さんへ燃料も含めて進めることを伝え、出資をお願いする$m$ AND a.deleted_at IS NULL);

INSERT INTO project_actions (project_id, title, detail, action_kind, status, owner_label, planned_start, date_certainty, done_criteria,
  origin_kind, origin_ref, sort_order, review_state, proposed_question_id, proposal_reason, created_by, updated_by)
SELECT 'p21', $m$堀淵さんと山地の間を調整する$m$, $m$現在は共同研究の段階であることと、SolvioraXが窓口になる形を堀淵さんへ伝え、山地からの説明の前さばきをする。$m$, 'work', 'not_started', $m$石原先生$m$, DATE '2026-11-20', 'provisional', $m$堀淵さんへ説明し、山地が話す段取りができている$m$,
  'meeting', $m$project_meeting_summaries:jrco0eud1ngrvqifl87en2skt4$m$, 101, 'proposed', $m$21000000-2026-4000-8000-000000009102$m$::uuid, $m$2026-11-20 臨時経営会議の次の一手$m$, 'amie', 'amie'
WHERE NOT EXISTS (SELECT 1 FROM project_actions a WHERE a.project_id = 'p21' AND a.origin_ref = $m$project_meeting_summaries:jrco0eud1ngrvqifl87en2skt4$m$ AND a.title = $m$堀淵さんと山地の間を調整する$m$ AND a.deleted_at IS NULL);

INSERT INTO project_actions (project_id, title, detail, action_kind, status, owner_label, planned_start, date_certainty, done_criteria,
  origin_kind, origin_ref, sort_order, review_state, proposed_question_id, proposal_reason, created_by, updated_by)
SELECT 'p21', $m$Partners FundとBNVにDAVPとの進め方を相談する$m$, $m$SolvioraXが燃料も含めて進める形と、DAVPとの関係を早めに相談する。BNVは来週、有馬さんと会う席で話す。$m$, 'work', 'not_started', $m$まさ$m$, DATE '2026-11-20', 'provisional', $m$両社に相談し、それぞれの反応を記録している$m$,
  'meeting', $m$project_meeting_summaries:jrco0eud1ngrvqifl87en2skt4$m$, 102, 'proposed', $m$21000000-2026-4000-8000-000000009102$m$::uuid, $m$2026-11-20 臨時経営会議の次の一手$m$, 'amie', 'amie'
WHERE NOT EXISTS (SELECT 1 FROM project_actions a WHERE a.project_id = 'p21' AND a.origin_ref = $m$project_meeting_summaries:jrco0eud1ngrvqifl87en2skt4$m$ AND a.title = $m$Partners FundとBNVにDAVPとの進め方を相談する$m$ AND a.deleted_at IS NULL);

INSERT INTO project_actions (project_id, title, detail, action_kind, status, owner_label, planned_start, date_certainty, done_criteria,
  origin_kind, origin_ref, sort_order, review_state, proposed_question_id, proposal_reason, created_by, updated_by)
SELECT 'p21', $m$産学共同部門の構想と共同研究費の扱いを産学連携部門に確認する$m$, $m$資源循環・環境技術の産学共同部門（SolvioraXオープンイノベーションハブ）の構想資料を基に、設置の可否・期間（最低2年、5年で更新）と、共同研究費の扱いを確認する。$m$, 'work', 'not_started', $m$石原先生$m$, DATE '2026-11-20', 'provisional', $m$産学連携部門の回答（設置の可否・期間・共同研究費の扱い）を得ている$m$,
  'meeting', $m$project_meeting_summaries:jrco0eud1ngrvqifl87en2skt4$m$, 103, 'proposed', $m$21000000-2026-4000-8000-000000009104$m$::uuid, $m$2026-11-20 臨時経営会議の次の一手$m$, 'amie', 'amie'
WHERE NOT EXISTS (SELECT 1 FROM project_actions a WHERE a.project_id = 'p21' AND a.origin_ref = $m$project_meeting_summaries:jrco0eud1ngrvqifl87en2skt4$m$ AND a.title = $m$産学共同部門の構想と共同研究費の扱いを産学連携部門に確認する$m$ AND a.deleted_at IS NULL);

INSERT INTO project_actions (project_id, title, detail, action_kind, status, owner_label, planned_start, date_certainty, done_criteria,
  origin_kind, origin_ref, sort_order, review_state, proposed_question_id, proposal_reason, created_by, updated_by)
SELECT 'p21', $m$オフィスとオープンラボの費用を積算する$m$, $m$イノベーションコモンズのオフィス（会社名義・一般料金、年約67万円）と、共同研究費の直接経費を1,000万円以上にしてオープンラボ（52万円）を使う形の費用をまとめる。$m$, 'work', 'not_started', $m$担当未確認$m$, DATE '2026-11-20', 'provisional', $m$拠点の年間費用と共同研究費の直接経費の内訳がまとまっている$m$,
  'meeting', $m$project_meeting_summaries:jrco0eud1ngrvqifl87en2skt4$m$, 104, 'proposed', $m$21000000-2026-4000-8000-000000009104$m$::uuid, $m$2026-11-20 臨時経営会議の次の一手$m$, 'amie', 'amie'
WHERE NOT EXISTS (SELECT 1 FROM project_actions a WHERE a.project_id = 'p21' AND a.origin_ref = $m$project_meeting_summaries:jrco0eud1ngrvqifl87en2skt4$m$ AND a.title = $m$オフィスとオープンラボの費用を積算する$m$ AND a.deleted_at IS NULL);

INSERT INTO project_actions (project_id, title, detail, action_kind, status, owner_label, planned_start, date_certainty, done_criteria,
  origin_kind, origin_ref, sort_order, review_state, proposed_question_id, proposal_reason, created_by, updated_by)
SELECT 'p21', $m$留学生の就労ビザを会社から出す条件と手続きを調べる$m$, $m$研究室の博士課程3年の留学生が入社を希望（9月卒業見込み）。会社から就労ビザを出す条件・必要書類・期間を調べる。山地が本人と直接話す。$m$, 'work', 'not_started', $m$まさ$m$, DATE '2026-11-20', 'provisional', $m$就労ビザの条件と手続きの段取りがまとまり、本人と話している$m$,
  'meeting', $m$project_meeting_summaries:jrco0eud1ngrvqifl87en2skt4$m$, 105, 'proposed', $m$21000000-2026-4000-8000-000000009103$m$::uuid, $m$2026-11-20 臨時経営会議の次の一手$m$, 'amie', 'amie'
WHERE NOT EXISTS (SELECT 1 FROM project_actions a WHERE a.project_id = 'p21' AND a.origin_ref = $m$project_meeting_summaries:jrco0eud1ngrvqifl87en2skt4$m$ AND a.title = $m$留学生の就労ビザを会社から出す条件と手続きを調べる$m$ AND a.deleted_at IS NULL);

DO $chk$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM project_meeting_summaries WHERE meeting_id = $m$jrco0eud1ngrvqifl87en2skt4$m$ AND project_id = 'p21' AND length(narrative_md) >= 500;
  IF n <> 1 THEN RAISE EXCEPTION 'meeting card: expected 1, got %', n; END IF;
  SELECT count(*) INTO n FROM project_config WHERE project_id = 'p21' AND key = $m$meeting_resolutions:jrco0eud1ngrvqifl87en2skt4$m$;
  IF n <> 1 THEN RAISE EXCEPTION 'resolutions: expected 1, got %', n; END IF;
  SELECT count(*) INTO n FROM project_management_partners WHERE project_id = 'p21' AND deleted_at IS NULL AND source_ref = $m$2026-11-20 臨時経営会議（Notionの要約と書き起こし・Geminiのメモ）$m$
    AND slug IN ('davp','daiki-axis','bnv','partners-fund','ehime-university');
  IF n <> 5 THEN RAISE EXCEPTION 'partners: expected 5, got %', n; END IF;
  SELECT count(*) INTO n FROM project_management_partner_interactions WHERE project_id = 'p21' AND source_ref = $m$2026-11-20 臨時経営会議（Notionの要約と書き起こし・Geminiのメモ）$m$ AND deleted_at IS NULL;
  IF n <> 2 THEN RAISE EXCEPTION 'interactions: expected 2, got %', n; END IF;
  SELECT count(*) INTO n FROM project_actions WHERE project_id = 'p21' AND origin_ref = $m$project_meeting_summaries:jrco0eud1ngrvqifl87en2skt4$m$ AND deleted_at IS NULL;
  IF n <> 6 THEN RAISE EXCEPTION 'actions: expected 6, got %', n; END IF;
END $chk$;

COMMIT;
