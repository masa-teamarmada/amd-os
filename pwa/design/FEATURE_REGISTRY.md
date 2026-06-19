# PWA Feature Registry

AMD OS PWA の重要機能を、画面単位で「消してはいけない契約」として列挙する。

このファイルは実装の詳細仕様ではなく、回帰防止用の登録簿。画面・API・DBのいずれかから機能を削る場合は、同じ commit でこの登録を更新し、理由を残す。未更新のまま UI を削除しない。

## 運用ルール

- 新しい業務導線を追加したら、このファイルか該当 `pwa/design/*.md` に機能契約を残す。
- `design_log/` は作業ログであり正本ではない。恒久仕様は `pwa/design/` 配下へ入れる。
- `npm run test:critical-ui` は、この登録簿と実装内の重要 anchor を検査する。
- 重要 UI を置き換える場合は、旧 anchor を消す前に新 UI の anchor と仕様を登録する。

## /manual

目的: AMD OS の使い方・仕様・運用履歴の正本を、読み手が自力で検索し、必要ならページ限定つくよみに質問できる状態にする。

必須機能:

- 左カラム検索: `pwa/manual/*.md` から生成した `ManualSearchDocument` を使い、章タイトル / summary / 見出し / 本文 / 画面パス / テーブル名を横断検索する。検索結果は章番号・タイトル・抜粋・topic/screen chip を出し、該当 `/manual/[slug]` へ遷移できる。
- 章本文と目次の維持: `/manual` はセクション別目次、`/manual/[slug]` は本文 + 左目次を表示し、検索を使っても既存の `ManualMapClient` / `MarkdownView` 導線を消さない。
- ページ限定つくよみ: `ManualTsukuyomiFloat` は `/manual` と `/manual/[slug]` だけに出す。global layout の visible mascot を復活させない。
- Gemini Q&A: `POST /api/manual/tsukuyomi/ask` は `GEMINI_API_KEY` と `gemini-2.5-flash` で該当章のマニュアル本文を根拠に回答し、「ここ見たらOK」の参照章リンクを返す。DB 書き込み、PJ 修正 tool、`tsukuyomi_chat_logs` 保存は持たせない。

回帰防止:

- global `TsukuyomiChatBridge` は従来どおり invisible event bridge のまま。`Mascot.tsx` を `(app)/layout.tsx` に戻さない。
- マニュアル章の追加・削除・構成変更は `pwa/src/app/(app)/manual/manual-chapters.ts` と `pwa/design/os_manual.md`、必要なら `pwa/manual/9-3-appendix-changelog.md` を同じ作業単位で更新する。

## /admin/payouts

目的: 支払月単位で、対象cycleの報酬確認、PJ別収支確認、支払データ保存、支払通知書発行、入金確認nudgeを一画面で運用する。

必須機能:

- 支払月選択: `ym=YYYYMM` で対象月を選び、`billing_cycles.invoice_ym` を優先する。未設定cycleは `/admin/projects` の `projects.payment_due_rule` から支払月を判定する。
- 高速初期表示: 通常GETは `billing_cycles.reward_summary_json` の報酬キャッシュを読むだけにする。毎回 `syncRewardSummariesForBillingCycles()` を再計算しない。
- 報酬キャッシュ再計算: 明示的な「報酬キャッシュ再計算」操作または保存系処理だけが `refreshRewards=1` / `refreshRewards: true` で再計算する。
- 報酬キャッシュ日次更新: `payout-reward-cache-refresh` cron が毎日03:05 JSTに、前月・当月・翌月の支払月について `billing_cycles.reward_summary_json` を再生成する。
- 予定担当比率のみ: 報酬計算は MS の期間按分で当月消化ptを出し、`milestone_responsibility.share` で分配する。活動ログ由来の実績配分や手入力報酬 override は使わない。
- 保存済み支払額の優先: `monthly_reward_payout.total_pay` に保存済みの確定額があれば、画面の支払額・`payout_notices.total_yen`・PDF生成の元データをこの保存済み額に揃える。`reward_summary_json` の再計算値で上書きしない。
- 縦型PJ収支表: 「全体収支」列とPJ列を並べ、クライアント支払、バッファ、本契約cap、本契約支払、別財布支払、役員分、役員相殺、本契約残り、メンバー別支払を確認できる。
- 先12か月 本契約cap / 別財布: `/admin/payouts` と `/management-score` 下部表の両方で、セル表示を `本契約` / `別財布` の2行にし、それぞれ `入/出/残` だけを並べる。残がマイナスなら `払いすぎ確認` を出す。MS月割やstockをこの表の主表示に混ぜず、合算収支だけを主表示にしない。
- 手入力予算確定なし: `/admin/payouts` では請求額や追加支払枠を手入力して `billing_cycles.budget_yen` を書き換えない。契約から解ける通常capと、MSタグから解ける別財布発生だけを表示する。
- 別財布支払: ZMP のような月額固定PJは通常枠を `fee_amount × 65%` に保ち、OkuDoor追加開発など追加受託分は `tag='cap_extra'` のMSとして `extraBasePay` / `extraPaidYen` / `extraCompanyReserveYen` に分ける。画面上で `本契約発生` / `別財布発生` / `別財布使用` を別表示する。
- 支払データ保存: `monthly_reward_payout` に明細、`payout_notices.total_yen` にメンバー別通知額を保存する。役員または `exclude_from_payout_notice` のメンバーは通知対象外にする。
- 支払通知書発行: 「メンバー別支払」行に `支払通知書発行` / `PDF確認` / `送付` の3操作を置く。`PDF確認` は支払データ確定前でも改善版フォーマットの確認用PDFを生成して開くが、`payout_notices` には保存しない。正式な `支払通知書発行` は `monthly_reward_payout` 保存後に活性化し、`payout_notices.notice_no` / `pdf_url` を保存する。`送付` はPDF保存後に `sent_at` を保存する。PDF URLの手入力欄は置かない。
- 支払通知書PDFフォーマット: 正本は `gas/064_PayoutFreeeNotice.js` の `payoutBuildNoticePdfBlob_`。2026-04改善版の白地・青アクセント・正本ロゴ画像フォーマットを維持する。admin/payouts の支払額 (`monthly_reward_payout.total_pay` / `payout_notices.total_yen`) は税抜として扱い、PDF上で消費税10%を上乗せして「お支払金額」「合計（税込）」に表示する。宛先は `members.contractor_name` (= 未設定時は `member_name` / `code_name`) と `members.member_address`、インボイス登録番号は `members.invoice_registration_number`、振込先は `members.bank_info` を使う。必須要素は、中央青見出し `支払通知書`、青ライン、右上の `作成日` / `通知書番号` (= 2026-05-28 まさ要望で「支払通知日」→「作成日」に変更)、公式ロゴ画像 (`PAYOUT_LOGO_FILE_ID` / `PAYOUT_LOGOTYPE_FILE_ID`)、「お支払金額」サマリbox、青ヘッダ明細表 (`摘要` / `数量` / `単価` / `金額`)、右寄せ合計 (`小計（税抜）` / `消費税（10%）` / `合計（税込）`)、`支払予定日` / `支払方法` / `振込先` / `備考`。旧GASの黒罫線フォーマット、テキストで作った `team ARMADA` ロゴ、PDF URL手入力欄へ戻さない。
- 入金確認nudge: `payment-confirm-nudges` を手動実行でき、Slack DMの `/payment-confirm` とつながる。
- 月次モーダル導線: cycle明細やPJ収支表の稼働月から `CockpitMonthlyModal` を開き、報酬根拠に戻れる。

回帰防止:

- `pwa/scripts/check_pwa_critical_ui.cjs` が `/admin/payouts` の支払通知書PDF確認、報酬キャッシュ、報酬キャッシュ日次cron、縦型PJ収支表、GAS側の改善版支払通知書PDFフォーマット anchor を検査する。
- `pwa/scripts/check_pwa_critical_ui.cjs` が `本契約発生` / `別財布発生` / `regularBasePay` / `extraBasePay` anchor も検査する。
- 支払通知書PDFの golden PNG は `pwa/scripts/__fixtures__/payout_notice_golden.png` (改善版フォーマットの 1 ページ目を PNG 化したもの) を正本とし、`pwa/scripts/__fixtures__/payout_notice_golden.png.sha256` に SHA256 を固定する。`npm run test:critical-ui` が golden の存在と SHA256 一致を検査し、 fixture が壊れていれば落ちる。
- 改善版PDFを意図的に更新したら、まさが新PNGを目視確認したうえで `payout_notice_golden.png` と `payout_notice_golden.png.sha256` を再生成して commit する。新規 PDF を PNG 化したファイルとの突合は `npm run test:payout-notice-pdf -- --diff <input.png>` で同じスクリプトを再利用する。
- この画面で UI を削る変更は、`FEATURE_REGISTRY.md` と `SPEC_pwa.md` を同時に更新する。

## /admin/private-wiki

目的: admin だけが、AMDメンバー・取引先・クライアント・研究者・外部協力者などの人物単位の趣味・プライベート・関係性メモを PJ ごとに保存・検索・更新できる。

必須機能:

- admin-only route: `/admin` layout の admin gate 内に置き、通常 PJ cockpit、公開ページ、研究機関外部 workspace から参照しない。
- PJ別グルーピング: `private_wiki_entries.project_id` で PJ 別に grouping し、null は AMD 全体 / 未紐付けとして扱う。
- 手作業編集: 追加 / 編集 / archive が UI からできる。直接削除を主導線にしない。
- フィルタ: 検索、PJ、人物種別、tag、status で絞り込める。
- evidence 表示: `source_kind` / `source_ref` / `source_excerpt` / `confidence` / `updated_by` を一覧上で確認できる。
- source hygiene: `source_excerpt` は短い抜粋だけ。メール全文・議事録全文・資料全文を保存する場所にしない。
- API 境界: browser 直接DB writeではなく `/api/admin/private-wiki` の `requireAdmin()` + service_role 経由で list/create/update/archive する。

回帰防止:

- `private_wiki_entries.visibility` は `admin_private` 固定。別画面へ再利用するときは `FEATURE_REGISTRY.md` と `/spec/2-1` を先に更新し、admin-only を崩さない。
- seed は入れない。必要なテストデータはダミーだけにする。

## /dashboard

目的: まさと司令塔が全PJの現状と、今日先に打つべき一手を最初に見る入口。

必須機能:

- TODO: `ProactiveQueuePanel` で `proactive_outbox` の `queued` / `sent_to_commander` / `blocked` を最大3件 read-only 表示する。状態、誰のボールか、期限、優先度、資料の種類、トリガー理由、担当司令塔、推奨 first move を出す。Dashboard から状態更新・外部送付はしない。行クリックはPJ遷移ではなく、発生経緯・資料リンク・次アクションを読むモーダルを開く。
- PJ一覧: Active / Sales-Draft / Ended-Frozen の横長 stripe 一覧を維持する。KUTE (`p25`) など研究機関エコシステム構築PJは通常PJ一覧に二重表示せず、研究機関ERSリスト側へ寄せる。
- 研究機関ERSリスト: PJ一覧と同じ左/mainカラム内で、PJ一覧の直下に `InstitutionReadinessList` を表示し、PJリストの続きとして苗床レイヤーを確認できるようにする。MyPage右カラムの下や全幅下段に落とさない。表示名はPJ名を主タイトルに寄せ、KUTE / KGW / NIMS を title、工学院大学 / 香川大学 / 物質・材料研究機構を subtitle にする。KUTEカードは `/institutions/inst_kute/cockpit`、NIMSカードは `/institutions/inst_nims/cockpit` へ遷移する。
- Company Content shelf: 研究機関ERSリストの下に、`CompanyContentShelf` を4カラムで表示する。列はメンバー / 沿革 / メディア掲載 / photo。`member_profiles` / `company_history_events` / `media_assets` の approved rows を優先し、未適用環境では既存 `members` + `project_members`、`project_events` / `project_ventures`、photo permission placeholder に fallback する。Notion photo URL や個人情報本文は表示しない。
- MyPage embed: `/dashboard` 右カラムでは `<MyPageContent embedded showMonthlyProjects={false} />` を使い、「今週やったこと」より下の月別PJカードを出さない。`/mypage` 単体では従来どおり月別PJカードを維持する。
- Dashboard上部: Management Score と明示 action queue を維持する。月次ルーティン由来の自動タスクは生成しない。

## /tasks

目的: 全PJ・全員のタスク状況を、マインドマップとガントチャートの2視点で横断管理する。

必須機能:

- GlobalNav に `タスク` 導線を置く。
- PJ / 担当 / status / text search で全PJタスクを絞り込める。
- マインドマップビュー: 空白クリックで新規タスクを作成する。タスクカードをドラッグして移動し、別タスクへdropすると drop先が親、drag元が子として `tasks.parent_task_id` に保存される。edge は画面上に線で表示する。
- ガントビュー: PJごとにsectionを分け、タスク行に担当・status・start/due・progress・期間バーを表示する。PJ section の空白行クリックでそのPJの新規タスクを作成する。
- 書き込みは `/api/tasks` 経由。browser client から直接 `tasks` を更新しない。
- タスクを消す導線は置かず、非表示は `active=false` を使う。

回帰防止:

- `tasks` 既存カンバン列 (`task_id`, `project_id`, `title`, `status`, `assignee`, `priority`) の意味を変えない。
- `parent_task_id` の循環は API で拒否する。
- DDL変更時は `pwa/scripts/migrations/` と `/spec/5-7-task-management-current-spec` を同時更新する。

## /project/[projectId]/cockpit

目的: PJの現在地、MS進捗、経営ハイライト、月次カード、TODO/nudgeを一画面で見る。

必須機能:

- レイアウト: `max-w-[1600px]` の幅広 container、上 Header → hero (PJ Status) → MS / 経営ハイライト / ステータス・nudge → 下段 2 カラム (`月次カード / 休止期間 + MTGサマリ`) の案C系構成。`max-w-[1060px]` + 左 720 / 右 220 の旧 2 カラムには戻さない。最下段の旧 TODO かんばんは主要導線から外す。
- 上 hero: PJ ごとに出し分け。p00 (= AMD 会社全体) は `CockpitManagementScoreHero` で AMD Management Score の時系列折れ線 + 最新値カード。SU 系 PJ は `CockpitVentureStatus` 内で AMD Score 折れ線と XRL 折れ線を `xl:flex-row` で横並びにする。`xl` 未満では縦並びへ自動 fallback する。
- Hero 下タブ: SU 系 PJ は `進捗管理` / `スコア詳細` を切り替える。AMD Score / XRL hero はタブ外に置いて常時表示し、`進捗管理` に従来の cockpit 本文、`スコア詳細` に `AmdScoreView` の embedded 表示を出す。
- 今期MSリスト: `CockpitGoalsCompact` / `MilestoneGanttChart` でMS期間、pt、担当、sub itemを表示する。
- TODO: `ProactiveQueuePanel` でそのPJの `proactive_outbox` を read-only 表示する。状態、誰のボールか、期限、優先度、資料の種類、トリガー理由、担当司令塔、推奨 first move、遅れた場合のリスクを出す。Cockpit UI から状態更新・外部送付はしない。行クリックはモーダルで詳細を開く。
- 経営ハイライト: MSリスト横の col2 として `CockpitStrategySignals` を表示し、`project_strategy_signals` の candidate/confirmed を日付・type・impact・summary・source refs付きで表示する。
- 月次モーダル: 月次カードから `CockpitMonthlyModal` を開き、report / reward / invoice を確認できる。routine step 起動は廃止済み。p00 (= AMD 会社全体) でも他 PJ と同じく月次カード + 月次モーダルが出る (`billing_cycles` を 12 行 backfill 済)。
- PM月次ルーティン: 廃止済み。cockpit の col3 に月次 step/TODO は出さず、月次状態は月次カード + `CockpitMonthlyModal` で確認する。
- MTGサマリ: `CockpitMeetingSummary` 各行に source link (Notion / Slack / Drive / Gmail / Calendar event の元データへ直リンク) を `元 ↗` の形で出す。各行クリック時は `?meeting=<meeting_id>` を URL に反映し、共有 URL から同じ detail modal を auto-open できるようにする。`summary_short` は一覧カードの2行サマリとして出す。`source_kinds='upcoming'` の row は「予定MTG / 準備中」ブロックに出し、`決めること / 準備物` を表示する。H-1が今後60日の確定Calendar予定を `POST /api/meeting-prep/calendar-sync` に渡すことで、前回議事録が空のPJでも未来MTGカードを作る。`source_kinds='upcoming_tentative'` や `meeting_id` が `upcoming:` で始まるだけの row は日程未確定の仮置きとして「日程調整中MTG」ブロックに残し、確定予定 count には含めない。予定MTG詳細では、配列を箇条書きで並べるのではなく `narrative_md` の「初見ブリーフ」を主役にし、「会議後に残したい状態」「いまの状況」「当日までに揃えるもの」「必ず確認すること」を文章カードとして見せる。既存 `risks` の内容は破壊せず、この「必ず確認すること」として表示・編集する。MTG詳細モーダルの「表示内容を編集」は、表示している section を同じ位置で textarea 化する。通常MTG / dialogue は `narrative_md` が表示されている場合は `narrative_md` を編集し、raw 配列表示の場合だけ `decided / progress / next_actions / risks` を編集する。予定MTGは同じ `POST /api/meeting-prep`、通常MTG / dialogue は `POST /api/meeting-summary/manual-update` で保存する。MTG詳細モーダルには「つくよみに修正依頼」を置かず、LLM再解釈ではなく手動編集を正本にする。詳細モーダルの「添付資料」は `meeting_assets` に、ファイル選択 / drag & drop / clipboard paste / browser screen capture の4経路で一般ファイルを保存できる。新規添付実体はDriveの `PJフォルダ / YYMMDD_会議名` に置き、保存先をカード上に表示する。旧Storage添付は互換表示し、`POST /api/meeting-assets/insert-markdown` で `narrative_md` に Markdown 画像/リンクとして挿入できる。`dialogue:*` で始まる meeting_id は「提案整理」チップ付きで識別し、`CockpitMeetingDetailModal` でラベルを「提案前の論点整理 (チームへの相談)」に置き換える (= 「決まったこと」と書かない)。dialogue meeting は `narrative_md` があれば 1 本の Markdown narrative として表示する。`narrative_md` は `POST /api/dialogue-meeting/narrate` で生成する。各 TopicList の項目は border-l フレーム枠ではなく、`<ul>` + 太字 / マーカー / 見出しの強弱で読ませる。
- MTG詳細Markdownのメンバーリンク: `CockpitMeetingDetailModal` で表示する `narrative_md` / `summary_short` / raw 配列 / 予定MTGブリーフは `MarkdownView memberLinks` を通し、active AMDメンバーの `members.code_name` が standalone mention として出る場合だけ `/mypage?memberId=<members.member_id>` へリンクする。既存 Markdown link / code / pre は対象外で、`しかるべき` の `かる`、`こうして` の `こう` のような部分一致はリンクしない。

回帰防止:

- `pwa/scripts/check_pwa_critical_ui.cjs` が `経営ハイライト`、`CockpitStrategySignals`、`project_strategy_signals`、`project_strategy_signal` の anchor を検査する。
- MTGサマリの予定MTG block / `POST /api/meeting-prep` / `POST /api/meeting-prep/calendar-sync` / `MeetingPrepInlineEditor` / `POST /api/meeting-summary/manual-update` / `MeetingSummaryInlineEditor` / `MeetingAssetsPanel` / `POST /api/meeting-assets` も `check_pwa_critical_ui.cjs` で検査する。
- 案C レイアウト anchor (`max-w-[1600px]`、`lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_300px]`、`xl:flex-row` Hero) も `check_pwa_critical_ui.cjs` で検査する。`max-w-[1060px]` や旧 left/right 2 カラム構造に巻き戻ったら `npm run test:critical-ui` で落ちる。

## /institutions/[institutionId]/cockpit

目的: 研究機関カードから、機関の箱を保ったまま関連PJの進捗・月次・MTG履歴へ入る。

必須機能:

- KUTEカードは `/dashboard` の研究機関ERSリストから `/institutions/inst_kute/cockpit` へ遷移する。KUTEは通常PJリストには二重表示せず、既存KUTE PJ (`p25`) は関連PJコックピットのデータソースとして残す。
- NIMSカードは `/dashboard` の研究機関ERSリストから `/institutions/inst_nims/cockpit` へ遷移する。新規NIMS PJは作らない。
- 研究機関コックピットは `inst_kute -> p25` / `inst_nims -> p20` の静的関連付けを使い、既存PJコックピットの `CockpitView` を同画面にマウントする。これによりMS進捗、月次カード/モーダル、MTGサマリを既存データのまま使う。
- 上部にERS充足率、関連PJ、今期MS件数、MTG履歴件数を出す。
- `project_meeting_summaries` を月ごとに束ねたMTGツリーを表示し、各行から通常PJコックピットのMTG詳細 (`?meeting=`) へ遷移する。
- `/institutions/[institutionId]` の詳細画面からも研究機関コックピットと通常PJコックピットへ戻れる。

## 株主・ガバナンス + 要対応 (2026-06-15 追加)

設計: `pwa/design/governance_action_items.md`。DB: migration `137_governance_and_action_items.sql` (`action_items` / `project_shareholders` / `project_valuation_rounds` / `project_shareholder_meetings`)。

- **PJ cockpit「🏛 株主・ガバナンス」欄** (`CockpitGovernance`、col2 の `CockpitStrategySignals` 直下): AMD/まさ保有株式 + 概算保有価値、総会・取締役会履歴一覧 + 決議 + AMD対応、資金調達ラウンド/バリュエーション、株主構成、このPJの要対応を表示。総会/取締役会の添付資料は `attachments_json.url` / `webViewLink` をクリック可能リンクとして出す。**終了PJでも表示する** (L2_DATA「ended でも清算・株主総会等は残す」)。データは admin 限定 API `/api/governance` から client fetch (非admin には出さない)。削除禁止理由: 終了後も残る AMD 持分・ガバナンス可視化 (まさ確定 2026-06-15)。
- **要対応（期日順）面** (`ActionItemsPanel`): `/dashboard` (ProactiveQueuePanel 直下、limit 5) と `/notifications` 先頭。全PJ横断 + personal/company scope の `action_items` を期日順 + 「あと何日/期限超過」chip で表示、「対応済にする」で `status=responded`。データは admin 限定 API `/api/action-items`。削除禁止理由: 期日付き inbound 義務を埋もれさせない導線 (まさ確定 2026-06-15)。
- **`/admin/governance`**: 株主/ラウンド/総会/要対応の手動記録 CRUD。AdminSidebar に「🏛 株主・ガバナンス」。
- **`/api/governance/extract`**: Gmail/Drive/Calendar 等から抽出された総会・取締役会・書面決議候補の受け口。既定は `l2_coverage_gaps` review candidate、`apply=true` のときだけ `project_shareholder_meetings` に canonical insert。`attachments` に `content_base64` / `data_url` があれば、確認済み反映時に `projects.drive_folder_id` 直下の `YYMMDD_会議名` folder へ保存し、Drive link を `attachments_json` に残す。削除禁止理由: LST の取締役書面決議のようなメール由来ガバナンス履歴を資料リンク込みで OS 化するための入口 (まさ依頼 2026-06-16)。
- **`/admin/projects` の「総会」「役会」checkbox + `/api/cron/governance-email-sweep`**: `projects.governance_watch_shareholder_meetings` / `governance_watch_board_meetings` がONのPJだけ、`report_emails` とのGmailやりとりを総会/役会keywordで狭く検索し、`/api/governance/extract` に candidate / apply を渡す。削除禁止理由: D-14G の検索範囲をPJ台帳から明示的に制御し、全メール横断の誤検知・取りこぼしを減らすため (まさ依頼 2026-06-16)。
- 既存 `tasks` (`/tasks` 手動プランニング) とは別レーン。`action_items` は5生データ抽出 + 採否ループ + personal scope を持つ inbound 義務で、手動 mindmap/gantt の `tasks` を置換しない。
