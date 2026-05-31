-- 116_institution_policy_assessments_seed.sql
-- ERS institution policy matrix first evidence-backed seed.
--
-- Scope:
-- - inst_kagawa: public official regulation only; unknowns remain hearing TODOs.
-- - inst_kute: internal KUTE regulation/workshop materials plus official startup page.
-- - inst_nims: public official NIMS venture regulation/pages plus existing AMD/CX docs.
--
-- Do not collapse unknown into not_started. unknown = not yet confirmed.

with rows (
  institution_id,
  policy_item_id,
  status,
  attribute_value,
  evidence_note,
  source_type,
  source_url,
  source_path,
  confirmed_at,
  evaluator
) as (
  values
  -- ---------------------------------------------------------------------------
  -- 香川大学: official regulation gives certification baseline; ecosystem support
  -- details stay unknown until next hearing.
  -- ---------------------------------------------------------------------------
  ('inst_kagawa','pol_cert_rule','established',null,'公式PDF「国立大学法人香川大学における大学発ベンチャーの認定に関する規則」。学長がセンター会議の議を経て認定し、認定証を交付。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_cert_pre_registration','not_started',null,'公式規則の申請書添付資料は登記簿謄本・定款等を前提。登記前申請、認定予定通知、条件付認定の条項は確認できない。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_cert_update','established',null,'認定有効期間は3年。満了1年前から3か月前までに更新申請でき、更新時も認定手続・基準を準用。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_title_restriction','established',null,'申請様式に、称号使用により第三者損害等が生じても申請者側で処理し大学法人へ損害賠償請求しない旨の誓約あり。製品品質保証禁止の明文は未確認。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_cancellation','established',null,'定義逸脱、社会的信用失墜、報告事由、企業活動実態喪失、不名誉となるおそれ等で学長がセンター会議の議を経て取消可能。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_report_change','established',null,'センター長が事業報告書等を請求でき、解散・破産等は速やかに報告。代表者・所在地・資本構成変更届の専用条項は未確認。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_support_request','unknown',null,'認定規則本文は認定中心。認定後支援の個別申請・審査フローは公開規則からは未確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_facility_registration','unknown',null,'施設利用・商業登記支援の公開規程/制度は未確認。次回ヒアリングで確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_shared_equipment','unknown',null,'認定SUによる共有機器・研究設備利用制度は未確認。次回ヒアリングで確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_gap_fund','unknown',null,'GAP/POC資金導線は現時点の公式認定規則からは未確認。次回ヒアリングで確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_accelerator','unknown',null,'アクセラ/伴走メンタリング制度は現時点の公開資料からは未確認。次回ヒアリングで確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_vc_connection','unknown',null,'VC・金融機関接続導線は未確認。次回ヒアリングで確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_eir','unknown',null,'外部CEO/CXO/EIRの招聘・循環制度は未確認。次回ヒアリングで確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_cxo_pool','unknown',null,'CEO/CXO人材プールやマッチング制度は未確認。次回ヒアリングで確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_coi_sidejob','established',null,'認定基準で、教職員設立の場合は香川大学職員兼業規則、利益相反に係る諸規則等の手続・許可が適正になされていることを要求。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_ip_license','unknown',null,'認定定義に知的財産権活用型はあるが、認定とライセンス契約・優遇措置の切り分け規程は未確認。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_equity_rule','unknown',null,'株式/SO取得、管理、処分の規程は公開認定規則からは未確認。次回ヒアリングで重点確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_ip_equity','unknown',null,'IPライセンス対価としての株式/SO受領可否は未確認。次回ヒアリングで重点確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','pol_fund_investment','unknown',null,'大学VC、LP出資、指定ファンド等の規程は未確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','attr_regulation_owner','established','国立大学法人香川大学の規則','規程名は「国立大学法人香川大学における大学発ベンチャーの認定に関する規則」。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','attr_recognition_decider','established','学長','学長が産学連携・知的財産センター会議の議を経て認定可否を決定。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','attr_review_body','established','産学連携・知的財産センター会議','センター長は審議に際し外部有識者意見又は申請者面接を行うことができる。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','attr_equity_decider','unknown',null,'株式/SO取得決裁者は未確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','attr_amendment_decider','established','事前に産学連携・知的財産センターの意見を徴する','規則及び雑則の制定改廃時は事前にセンターの意見を徴する。最終決裁主体は公開PDFの該当抜粋だけでは追加確認余地あり。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','attr_eligible_scope','established','知財活用型、教職員/退職教職員、学生/卒業・修了者、学長が準ずると認めるもの','NPO法人を除く法人格を有する株式会社等。知財活用型、研究成果/技術型、学生の知識・技術型など。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','attr_post_grad_limit','established','退職・卒業・修了から企業設立まで3年以内','退職教職員、卒業・修了者とも3年以内を対象に含む。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','attr_validity_years','established','3年','認定の日から起算して3年。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','attr_renewal_rule','established','満了1年前から3か月前までに更新申請。更新は認定手続・基準を準用','更新後の有効期間は前有効期間満了日の翌日から起算。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','attr_naming','established','香川大学発ベンチャー','認定大学発ベンチャーは有効期間に限り称号を使用可能。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','attr_support_period','unknown',null,'認定後支援期間は未確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','attr_support_contents','unknown',null,'認定後支援メニューは未確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_kagawa','attr_source_docs','established','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf','公開公式PDFを一次根拠。AMD内部の香川大訪問メモは制度詳細の根拠には使わず、次回質問票の文脈として使用。','official','https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf','/Users/masa/projects/AMD/kagawa/2026-05-28_meeting_notes.md','2026-05-31','えいみ-worker'),

  -- ---------------------------------------------------------------------------
  -- KUTE / 工学院大学: current truth is drafting for certification regulation,
  -- established for public startup support program and existing COI/IP rules.
  -- ---------------------------------------------------------------------------
  ('inst_kute','pol_cert_rule','drafting',null,'内部規程案「学校法人工学院大学における大学発ベンチャーの認定に関する規程」は作成済みだが、4/30資料では5/18・6/22・9月教授総会に向けた素案/修正案スケジュール。制定済みとしては扱わない。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt; /Users/masa/projects/AMD/kute/tmp/extract/20260430（チームアルマダ様）工学院大学_ver2.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_cert_pre_registration','drafting',null,'作業記録で「設立前でも申請又は事前相談を受けられる余地」「認定予定通知又は条件付認定」を検討事項として整理。条文化は未確定。','internal_doc',null,'/Users/masa/projects/AMD/kute/docs/20260512_大学発ベンチャー認定規程_作業記録.md','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_cert_update','drafting',null,'規程案では称号使用期間5年、再申請可。まだ教授総会前の規程案段階。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_title_restriction','drafting',null,'規程案に免責条項と取消後の認定事実の事業活用禁止あり。作業記録では保証誤認防止条項の補強を確認事項化。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt; /Users/masa/projects/AMD/kute/docs/20260512_大学発ベンチャー認定規程_作業記録.md','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_cancellation','drafting',null,'規程案に解除申請、取消事由、称号返付、取消後利用停止あり。まだ規程案段階。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_report_change','drafting',null,'規程案に年度ごとの事業報告・解散/破産等報告あり。変更届は作業記録で追加検討事項。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt; /Users/masa/projects/AMD/kute/docs/20260512_大学発ベンチャー認定規程_作業記録.md','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_support_request','drafting',null,'規程案第13条に支援申請書、認定委員会の議、支援決定がある。まだ規程案段階。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_facility_registration','drafting',null,'規程案第13条に施設貸与と所在地としての商業登記許可がある。4/30資料では共有機器等と同じく規程整備中。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt; /Users/masa/projects/AMD/kute/tmp/extract/20260430（チームアルマダ様）工学院大学_ver2.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_shared_equipment','drafting',null,'規程案第13条に研究設備・共有機器等利用許可あり。4/30資料では共有機器利用規程は既存無しで整備対象。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt; /Users/masa/projects/AMD/kute/tmp/extract/20260430（チームアルマダ様）工学院大学_ver2.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_gap_fund','established',null,'公式スタートアップ支援ページにGAPファンド申請やNEDO NEP申請への継続支援が明記。4/30資料にもGTIE GAPファンド申請、NEP採択状況あり。','official','https://www.kogakuin.ac.jp/research/collaboration/startup.html','/Users/masa/projects/AMD/kute/tmp/extract/20260430（チームアルマダ様）工学院大学_ver2.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_accelerator','established',null,'公式ページで基調講演、ワークショップ、2026年度インキュベーションプログラム、ピッチコンテスト、個別メンタリングが明記。','official','https://www.kogakuin.ac.jp/research/collaboration/startup.html','/Users/masa/projects/AMD/kute/tmp/extract/20260430（チームアルマダ様）工学院大学_ver2.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_vc_connection','established',null,'公式ページで伴走支援者、インキュベーター、金融機関、公募制資金援助プログラムの紹介を明記。内部4/30資料にも金融機関・VC/CVCコミュニティ形成あり。','official','https://www.kogakuin.ac.jp/research/collaboration/startup.html','/Users/masa/projects/AMD/kute/tmp/extract/20260430（チームアルマダ様）工学院大学_ver2.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_eir','unknown',null,'スタートアップ推進フェローは確認できるが、EIR制度としての招聘・循環制度は未確認。','official','https://www.kogakuin.ac.jp/research/collaboration/startup.html',null,'2026-05-31','えいみ-worker'),
  ('inst_kute','pol_cxo_pool','drafting',null,'Phase3/4ヒアリング設計で学外人材活用、みらいワークス/ビズリーチ等との接続を検討。CEO/CXOプールとして制度化済みかは未確認。','internal_doc',null,'/Users/masa/projects/AMD/kute/output/mtg_20260526/04_シーズ掘り起こし_ファンド形成_ヒアリング設計.md','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_coi_sidejob','established',null,'利益相反マネジメントポリシー/利益相反管理規程が存在。認定規程案も二重就業、COI、関係規則の手続を申請要件に接続。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/工学院大学利益相反マネジメントポリシー.txt; /Users/masa/projects/AMD/kute/tmp/extract/工学院大学利益相反管理規程.txt; /Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_ip_license','established',null,'4/30資料で大学発SUへのライセンスも含む特許等知財取扱規定は既存有。認定規程案も実施許諾/権利譲渡等契約を要求。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/20260430（チームアルマダ様）工学院大学_ver2.txt; /Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_equity_rule','drafting',null,'4/30資料で株式及び新株予約権取得等規程は既存無し、整備対象として明記。決裁者比較資料では理事長決裁を標準案として整理。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/20260430（チームアルマダ様）工学院大学_ver2.txt; /Users/masa/projects/AMD/kute/output/mtg_20260526/03_決裁者pros_cons比較.md','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_ip_equity','drafting',null,'4/30資料で新株予約権規程が整備対象。IPライセンス対価として株式/SOを受ける運用可否は未確定のためdrafting扱い。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/20260430（チームアルマダ様）工学院大学_ver2.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','pol_fund_investment','drafting',null,'Phase4ヒアリング設計で大学独自ファンド、既存VC共同ファンド、マッチングファンド、学校法人出資制限を検討。現行制度としては未確定。','internal_doc',null,'/Users/masa/projects/AMD/kute/output/mtg_20260526/04_シーズ掘り起こし_ファンド形成_ヒアリング設計.md','2026-05-31','えいみ-worker'),
  ('inst_kute','attr_regulation_owner','drafting','学校法人工学院大学規程案','現行案は学校法人工学院大学としての規程。決裁者整理では法人主体/大学主体/ハイブリッドの論点が残る。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt; /Users/masa/projects/AMD/kute/output/mtg_20260526/03_決裁者pros_cons比較.md','2026-05-31','えいみ-worker'),
  ('inst_kute','attr_recognition_decider','drafting','現行案: 理事長が認定決定、学長が称号授与。推奨案: ハイブリッドで認定/称号/更新/解除は学長、取消・株式/SOは理事長','5/25決裁者比較資料で3案比較し、アルマダ推奨はC案ハイブリッド。最終決定はKUTE意向次第。','internal_doc',null,'/Users/masa/projects/AMD/kute/output/mtg_20260526/03_決裁者pros_cons比較.md','2026-05-31','えいみ-worker'),
  ('inst_kute','attr_review_body','drafting','大学発ベンチャー認定委員会','規程案第4条で認定委員会を設置し、認定審査を行う。必要事項は別に定める。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','attr_equity_decider','drafting','推奨案: 理事長決裁','株式・新株予約権取得処分は法人マターとして理事長決裁が標準、C案ハイブリッドでも理事長決裁と整理。','internal_doc',null,'/Users/masa/projects/AMD/kute/output/mtg_20260526/03_決裁者pros_cons比較.md','2026-05-31','えいみ-worker'),
  ('inst_kute','attr_amendment_decider','drafting','推奨案: 理事会議決','決裁者比較資料のC案で規程改廃は理事会議決と整理。最終決定はKUTE側確認待ち。','internal_doc',null,'/Users/masa/projects/AMD/kute/output/mtg_20260526/03_決裁者pros_cons比較.md','2026-05-31','えいみ-worker'),
  ('inst_kute','attr_eligible_scope','drafting','研究成果型、知財型、教職員・学生型、退職・卒業後3年以内、その他学長が必要と認めたもの','規程案第2条。第三者代表会社は実質的関連性をどう拾うか追加確認余地あり。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','attr_post_grad_limit','drafting','退職・卒業等から起業まで3年以内。ただし「他職に就かず」要件の削除/緩和を検討','作業記録で3年要件は説明しやすいが、他職不就業要件は限定的に読まれるため削除又は緩和を検討。','internal_doc',null,'/Users/masa/projects/AMD/kute/docs/20260512_大学発ベンチャー認定規程_作業記録.md','2026-05-31','えいみ-worker'),
  ('inst_kute','attr_validity_years','drafting','5年','規程案第6条で称号は5年間使用可能、再申請可。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','attr_renewal_rule','drafting','再申請可。再申請は認定手続を準用','更新審査の粒度・要件再確認は追加確認余地あり。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','attr_naming','drafting','工学院大学発ベンチャー','規程案は「工学院大学発ベンチャー」称号。スタートアップ呼称との併記は未確定。','internal_doc',null,'/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','attr_support_period','drafting','称号期間5年とは別に支援内容ごとの期間・条件・対価を個別決定する方向','作業記録で称号期間と支援期間を分ける整理。','internal_doc',null,'/Users/masa/projects/AMD/kute/docs/20260512_大学発ベンチャー認定規程_作業記録.md','2026-05-31','えいみ-worker'),
  ('inst_kute','attr_support_contents','established','公式: WS、インキュベーション、ピッチ、NEDO NEP/GAP支援、個別メンタリング、専門家/金融機関紹介。規程案: 施設、登記、共有機器、相談、紹介、広報','公式支援プログラムは稼働中。認定規程に紐づく支援メニューはdrafting。','official','https://www.kogakuin.ac.jp/research/collaboration/startup.html','/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt','2026-05-31','えいみ-worker'),
  ('inst_kute','attr_source_docs','established','https://www.kogakuin.ac.jp/research/collaboration/startup.html; internal KUTE regulation/workshop extracts','主要内部資料はKUTE規程案、4/30打合せ資料、5/12作業記録、5/25決裁者比較、COIポリシー。','internal_doc','https://www.kogakuin.ac.jp/research/collaboration/startup.html','/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt; /Users/masa/projects/AMD/kute/tmp/extract/20260430（チームアルマダ様）工学院大学_ver2.txt; /Users/masa/projects/AMD/kute/docs/20260512_大学発ベンチャー認定規程_作業記録.md','2026-05-31','えいみ-worker'),

  -- ---------------------------------------------------------------------------
  -- NIMS: official NIMS venture regulation is the primary source.
  -- ---------------------------------------------------------------------------
  ('inst_nims','pol_cert_rule','established',null,'公式「NIMSベンチャー援助等規程」。NIMSベンチャー名称使用申請/許可、区分「NIMS発ベンチャー」「NIMS成果活用ベンチャー」が規程化。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','pol_cert_pre_registration','established',null,'様式で設立又は定款変更予定年月日、定款案、設立後の登記簿提出を扱う。設立前/計画中の申請を前提にできる。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','pol_cert_update','established',null,'援助対象期間と継続的援助措置が規程化。詳細な名称使用期間・更新手続の全体像は追加精査余地あり。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','pol_title_restriction','established',null,'名称使用許可書・取消/停止系の様式があり、NIMSベンチャー名称を許可制で管理。保証誤認防止の詳細文言は追加精査余地あり。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','pol_cancellation','established',null,'規程に援助措置取消/継続的援助措置対象決定取消の様式があり、許可・援助の取消処理が制度化。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','pol_report_change','established',null,'援助措置の対象事業者に報告/届出を求める規程体系。代表者・資本構成変更届の粒度は追加精査余地あり。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','pol_support_request','established',null,'援助対象の決定を受けた成果活用事業者に対し、事業・法人の成長蓋然性や収益性を踏まえて協議の上、援助措置を実施可能。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','pol_facility_registration','established',null,'施設等の貸付・利用料減額、所在地/研究拠点の制度的支援が規程化。施設等利用料は75%減額可能、実費徴収あり。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','pol_shared_equipment','established',null,'研究設備等の有償利用許可と利用料減額が規程化。共同研究外でも一定条件下で利用可能。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','pol_gap_fund','unknown',null,'NIMSベンチャー援助等規程には出資・施設/設備減額等はあるが、GAP/POC資金制度としての導線は未確認。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','pol_accelerator','established',null,'援助措置に専門家による助言、第三者への紹介、情報提供等が含まれる。公式ページでもNIMS人材・技術・施設・設備を活用した積極支援を明記。','official','https://www.nims.go.jp/business/venture-lab.html',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','pol_vc_connection','established',null,'援助措置に第三者への紹介・情報提供等が含まれる。AMD/CX現物資料でもBUILD/CEO候補/VC調達連携が進行中。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf','/Users/masa/projects/AMD/CX/docs/20260507_CX_funding_path_comparison.md','2026-05-31','えいみ-worker'),
  ('inst_nims','pol_eir','unknown',null,'NIMS公式規程からEIR制度としての招聘・循環制度は未確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_nims','pol_cxo_pool','unknown',null,'CX案件ではCEO候補検討が進行しているが、NIMS制度としてCEO/CXOプールがあるかは未確認。','internal_doc',null,'/Users/masa/projects/AMD/CX/docs/20260507_CX_funding_path_comparison.md','2026-05-31','えいみ-worker'),
  ('inst_nims','pol_coi_sidejob','established',null,'NIMS職員が起業する「NIMS発ベンチャー」区分を持ち、職員関与を前提にした規程体系。兼業/COI詳細規程の列名レベル確認は追加余地あり。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','pol_ip_license','established',null,'特許等の実施許諾等、契約一時金免除、独占的通常実施権又は再実施権付実施、新発明の優先開示が援助措置に含まれる。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','pol_equity_rule','established',null,'出資等業務実施規程に基づく出資が援助措置に含まれる。施設等利用料支払いを株式又は新株予約権譲渡で行える旨も明記。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','pol_ip_equity','unknown',null,'施設等利用料は株式/SOで支払えるが、特許等実施許諾の対価として株式/SOを受ける明文は今回確認範囲では未確認。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','pol_fund_investment','established',null,'NIMSベンチャーの要請を受け、出資等業務実施規程に基づき当該企業への出資を行うことが援助措置に含まれる。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','attr_regulation_owner','established','国立研究開発法人物質・材料研究機構の規程','公式「NIMSベンチャー援助等規程」。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','attr_recognition_decider','established','理事長','様式上、名称使用申請書の宛先と名称使用許可書の発出者は理事長。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','attr_review_body','unknown',null,'審査/審議主体の詳細は今回確認範囲では未確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_nims','attr_equity_decider','established','出資等業務実施規程に基づく機構側決裁','出資は国立研究開発法人物質･材料研究機構出資等業務実施規程に従う。具体決裁者は追加確認余地あり。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','attr_amendment_decider','unknown',null,'規程改廃決裁者は今回確認範囲では未確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_nims','attr_eligible_scope','established','NIMS発ベンチャー、NIMS成果活用ベンチャー','NIMS職員が起業したものをNIMS発ベンチャー、それ以外をNIMS成果活用ベンチャーとして区分。','official','https://www.nims.go.jp/business/venture-lab.html',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','attr_post_grad_limit','unknown',null,'退職後期限に相当する条件は今回確認範囲では未確認。','unknown',null,null,'2026-05-31','えいみ-worker'),
  ('inst_nims','attr_validity_years','established','援助措置は決定期間管理。継続的援助措置あり','NIMS発ベンチャーには継続的援助措置の制度あり。年数の詳細は追加精査余地あり。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','attr_renewal_rule','established','継続的援助措置の対象決定あり','継続的援助措置の対象決定/取消様式がある。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','attr_naming','established','NIMS発ベンチャー / NIMS成果活用ベンチャー','公式ページで名称区分を明記。','official','https://www.nims.go.jp/business/venture-lab.html',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','attr_support_period','established','通常援助措置に加え、NIMS発ベンチャー向け継続的援助措置あり','NIMS成果活用ベンチャーは継続的援助措置の対象外。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','attr_support_contents','established','特許等実施許諾、出資、施設等貸付/減額、研究設備利用/減額、助言、紹介、情報提供等','公式規程別記「援助措置の種類及び内容」。公式ページでもNIMS人材・技術・施設・設備を活用した支援を明記。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf',null,'2026-05-31','えいみ-worker'),
  ('inst_nims','attr_source_docs','established','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf; https://www.nims.go.jp/business/venture-lab.html','公式NIMSベンチャー援助等規程と公式NIMSベンチャー企業情報を一次根拠。CX内部資料は運用実例の補助根拠。','official','https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf','/Users/masa/projects/AMD/CX/docs/20260507_CX_funding_path_comparison.md; /Users/masa/projects/AMD/CX/docs/20260508_CX_2026_MS_design.md','2026-05-31','えいみ-worker')
)
insert into institution_policy_assessments (
  institution_id,
  policy_item_id,
  status,
  attribute_value,
  evidence_note,
  source_type,
  source_url,
  source_path,
  confirmed_at,
  evaluator
)
select
  institution_id,
  policy_item_id,
  status,
  attribute_value,
  evidence_note,
  source_type,
  source_url,
  source_path,
  confirmed_at::date,
  evaluator
from rows
on conflict (institution_id, policy_item_id) do update set
  status = excluded.status,
  attribute_value = excluded.attribute_value,
  evidence_note = excluded.evidence_note,
  source_type = excluded.source_type,
  source_url = excluded.source_url,
  source_path = excluded.source_path,
  confirmed_at = excluded.confirmed_at,
  evaluator = excluded.evaluator,
  updated_at = now();
