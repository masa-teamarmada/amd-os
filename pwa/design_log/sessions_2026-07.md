# 2026-07 Sessions

## 2026-07-17 — 全 authenticated route パフォーマンス修正 (月初合意ゲート / つくよみ / dashboard 会社コンテンツ 遅延ロード化)

### コンテキスト
- パフォーマンス監査で、`(app)/layout.tsx` の SSR が全 authenticated route で月初合意ゲート判定 (`buildMonthlyWorkAgreementBundle`、10テーブル超の重い集計) をブロッキング実行していたこと、closed な `MonthlyAgreementExperience` (72KB) / つくよみ drawer が静的 bundle に含まれていたこと、`CriticalRealtimeNotify` が hidden tab でも 3 テーブルを10秒間隔ポーリングしていたこと、dashboard が会社コンテンツ (最大9リクエスト・最大500行) を eager fetch して `MyPageContent` と一緒に fold 前に render していたことが判明。

### 実施内容 (main commit `89956e6f` + `351255cf`, build v3.44.8)
- `(app)/layout.tsx` の SSR gate 計算を撤去し、`AppShell` で mount 後に既存 member API `GET /api/monthly-work-agreement` を client fetch する方式へ変更。判定ロジック・ユーザー向け gate 挙動は不変。`useEffect` 依存を `[memberId, skip]` に修正し、skip route mount 後の通常 route 遷移でゲート取得が起動しない不具合も解消。
- `MonthlyAgreementExperience` / `TsukuyomiChatDrawer` / dashboard `MyPageContent` / `CompanyContentShelf` を `next/dynamic({ ssr:false })` 化。
- dashboard の Company Content fetch を `IntersectionObserver` (`rootMargin: 600px`) トリガの遅延 fetch へ変更 (初回 `Promise.allSettled` から除外)。
- `CriticalRealtimeNotify` は hidden tab で polling 停止 (`visibilitychange` で復帰時に即 refresh + 再開)、フォアグラウンドのフォールバック間隔を 10 秒→60 秒へ緩和。Supabase Realtime 購読は維持。
- `351255cf` で `check_pwa_critical_ui.cjs` の月初合意ゲート anchor を旧 SSR prop 文字列から新 `memberId={memberId}` prop へ更新。

### Verification
- 同一 authenticated production dashboard で before/after 比較 (安定後): DOM ノード数 3108→1409、画像リクエスト 78→1。
- スクロールで shelf が viewport に入ると Company Content 遅延 fetch が発火し、画像77件を追加ロード (機能欠落なしを確認)。
- `tsc --noEmit` clean、lint は新規 regression 無し (既存許容パターン1件のみ)、`npm run build` 成功、`npm run test:critical-ui` 成功。
- production は build v3.44.8 / `351255cf` で verify 済み。以降 main には Book A 巻頭パッケージ・macOS foundation など本修正と無関係な commit が積まれている。

### Closeout note
- 詳細は `pwa/BUGS.md` の 2026-07-17 `[perf/authenticated-shell]` エントリ、spec 反映は `pwa/spec/2-1-pwa-runtime-routes.md` (dashboard Company Content 遅延ロード)、`pwa/spec/3-14-monthly-work-agreement-current-spec.md` (entry gate client fetch 化)、manual 反映は `pwa/manual/6-6-member-billing-prompts-spec.md`。changelog は `pwa/manual/9-3-appendix-changelog.md` に v3.44.8 エントリが既存 (重複追記なし)。
- この docs closeout 自体で build v3.44.9 へ bump。
- shared root checkout は他レーン (finance/capital-plan, notifications, admin-schedule, H-1, L6, Atlas, Book A 等) が dirty のまま multi-writer 運用中。今回の docs closeout は disposable clean clone (`/tmp/amd-os-performance.anP4IV`) で行い、root には触れていない。

### 教訓
- authenticated 全 route に影響する server layout / shell へ重い集計・大きい静的 import を足すときは、route を絞れないか、client mount 後の非同期取得に回せないか、dynamic import で閉状態バンドルを外せないかを先に検討する。

## 2026-07-16 — `project_ventures.display_name` 廃止と `LisTie` 根絶確認

### コンテキスト
- まさから、LST cockpit を開くと Chrome tab に `LisTie` と出る、PJ リストでは `LiSTie` なのにどこか別正本が残っているはず、という調査依頼。
- その直後に「display name は廃止済み」「二度と復活させないで」「display_name と LisTie が DB から根絶されたことを確認して」と条件が明確化した。
- root cause 調査の起点は `pwa/src/app/(app)/project/[projectId]/layout.tsx`。tab title が `projects.project_name` ではなく legacy `project_ventures.display_name` に落ちる余地を持っていた。

### 実施内容
- `pwa/src/lib/project-labels.ts` を新設し、canonical PJ 名と対外 alias / 検索語を分離した。
  - canonical = `projects.project_name`
  - alias/search = `news_search_query` 優先、次に `client_name`
- cockpit / HUD / venture-map / seeds / Tsukuyomi / funding / intro HTML / knowledge sync / founding members など、`project_ventures.display_name` に依存していた select / write / prompt 文面を `project_name` 基準へ統一した。
- `pwa/scripts/migrations/178_retire_project_venture_display_name.sql` を追加し、2026-07-16 JST に live DB へ適用した。
  - public base table の text/varchar/char 全列で `LisTie` -> `LiSTie` を置換
  - `project_knowledge.entity_name='PJ 表示名'` を `PJ名` へ寄せる
  - `public.project_ventures.display_name` を drop
- `pwa/design/db_schema.md` を dump 再生成し、`pwa/manual/9-3-appendix-changelog.md`、`pwa/manual/4-7-venture-status-narrative-pl-xrl-spec.md`、`pwa/design/aspi_lanes.md`、`pwa/design/venture_map_demo.md` へ current truth を同期した。

### Verification
- live DB 再確認:
  - `project_ventures_display_name_column_exists=false`
  - `project_knowledge_pj_display_name_rows=0`
  - `exact_lisitie_hits=[]`
  - `p07 = { project_name: "LST", client_name: "LiSTie株式会社", news_search_query: "\"LiSTie|リスティー\"" }`
- source/docs grep で残る `display_name` は finance / member profile / historical migration だけで、PJ文脈 current source からは消えていることを確認。
- shared root checkout の `./node_modules/.bin/tsc --noEmit --pretty false` は `.next/types/validator.ts` の stale route 参照で失敗。これは display_name bundle の型エラーではなく、checkout local blocker と切り分けた。
- production `/api/build-info` は 2026-07-16 JST 観測時点で `v3.44.1 / 63c635ba241e5bbe8ca029fd691aeb32d9326d06 / main / dirty=false`。closeout 中に GitHub `main` はさらに先へ進んだため、次セッションで再読が必要。

### Closeout note
- shared root checkout は multi-writer で、closeout 中に `HEAD` / `origin/main` が外部更新で進んだ。root での target-only staging は信頼しづらくなったため、最終 handoff 整理は disposable clean clone を使う方針に切り替えた。
- `pwa/BUGS.md` は reward-finance lane が同時に dirty にしていたため、この session では display_name lesson を混ぜていない。BUGS 追記が必要なら owner を見て別 bundle で行う。

### 教訓
- live DB から legacy column を落とすタスクは、UI 1 箇所だけでは終わらない。select / write / prompt / seed / sync script まで横断して current source から消えていることを grep と DB readback の両方で確認して初めて完了。
- AMD OS の shared root checkout で `HEAD` が動いている時は、その場での index/staging を信用しない。`git fetch` で current truth を取り直し、必要なら clean clone へ切り替える。

## 2026-07-01 — L2M-1 v2 移植: Codex (gpt-5.5 daily) → Claude routine (opus-4-8 + ultracode / 月末最終日 03:00 JST) + 内部/対外 2 段生成 + プロンプト DB管理化 + admin/projects 4列追加

### コンテキスト
- まさ「KUTE で固めた月次業務報告書PDFフォーマットを、AMD OS の月次報告書雛形として実装」の依頼で開始。参考成果物: `/Users/masa/projects/AMD/kute/output/monthly_reports/KUTE_月次業務報告書_202605-202606.md|.html|.pdf`。
- 実態調査で判明: 旧 M-1 primary writer は Codex `~/.codex/automations/amd-os-l2/automation.toml` (name="AMD OS M-1 月次報告抽出") が gpt-5.5 + reasoning_effort=high で **daily 05:30 JST** に動いてた (認識のズレ: えいみは Codex amd-os-ms かと思っていたが別 automation)。
- まさ確定方針: 「月次報告書は月1回、月末最終日の早朝3時。opus-4-8 + ultracode に品質を上げるため Claude routine へ移植」「内部保存版 + 対外提出版 の 2 段生成、両方モーダルで見られるように」「AMD (p00) は内部のみ、KUTE/SX/CX = 内部+対外、CTB/NIMS = なし」(途中で CX は internal_and_external に変更、NIMS の位置付けは実は「CX が NIMS 案件」で integrated)、「Slack 通知は `scripts/send-eimi-slack.mjs` でまさ DM に集約」。

### 設計・実装 (main 8 commit 積み上げ)
1. `8b877306` L2M-1 SKILL.md 初版 + migration 159 (前セッション成果採用)
   - migration 159: `projects` (work_content jsonb / monthly_report_required bool / report_local_alias text / report_extra_allow_terms text[]) 4 列、`contracts` (tax_basis / recipient_emails) 2 列、`project_documents.delivered_to_client_at`、新 table `monthly_reports_external` (id/project_id/ym/body_md/pdf_drive_url/pdf_local_path/jargon_check_status/jargon_check_findings + UNIQUE(project_id,ym) + RLS admin+service_role)、新 table `llm_prompt_revisions`、`llm_prompts` に `l2m1.monthly_report.internal.v2` / `l2m1.monthly_report.external.v2` seed (body 空、is_active=false 初期)
2. `4a4ff80f` Slack 通知を `scripts/send-eimi-slack.mjs` (= GAS webapp えいみ persona bot) 経由に一本化、まさ DM に集約。PJ チャンネル通知は廃止。SKILL.md の Phase 2.1 / 2.7 / 3 を書き換え。
3. `bae00be4` migration 160 で `monthly_report_scope text CHECK IN ('none','internal_only','internal_and_external')` を追加、backfill: p25 KUTE / p21 SX / (後で) p20 CX = internal_and_external、p00 AMD / p07 LST / p10 SE / p19 ZMP / p24 CLG / p26 VasculaX = internal_only、p06 CTB = none。SKILL.md の Phase 1 select と Phase 2.4 scope ガード、Phase 2.7 完了通知テンプレを 4 パターン化 (internal_only 成功 / internal_and_external 成功 / hard_fail / pdf_failed)。
4. `afeeee3b` admin/projects `page.tsx` row mapper と `AdminProjectsTable.tsx` の `ProjectRow` interface に 4 列追加 (型 + データ供給、UI 未実装)。
5. `83f50bbe` admin/projects UI 完全実装 (th ヘッダ 4 列追加 + td cell 実装 + edit form)。scope は select、alias は text、allow_terms は textarea(カンマ区切り→string[]変換)、work_content は JSON.parse。BUILD_VERSION `v0.36.36`→`v0.36.37`。
6. `d5dc34c3` spec/manual 同期: `pwa/spec/3-2-monthly-reports-current-spec.md` を v2 に更新 (v1→v2 差分マトリクス、正本テーブル、現行 writer = Claude routine、旧 Codex `amd-os-l2` は v1 廃止済 writer 節、対外提出版節 (KUTE 準拠フォーマット + allow_list + 対象 PJ 表))。`pwa/spec/6-1-appendix-changelog.md` と `pwa/manual/9-3-appendix-changelog.md` に 2026-07-01 エントリ追記。
7. `69d01a02` p20 CX (NIMS) を none → internal_and_external に変更 (まさ「CX は internal + external 必須」)。
8. `9b6e6021` SKILL.md 実行環境記述の誤り訂正 (旧「Anthropic クラウド sandbox VM で発火」→「まさの mac local Claude Code アプリ内で発火」)。2026-07-01 のテスト実走で判明した MCP `create_scheduled_task` の実挙動に合わせる。前提条件「まさの mac は 24 時間常時起動 + アプリ常時 open」を明記。

### llm_prompts DB 反映
- Workflow で本番と同じ opus-4-8 想定の system + user プロンプト完成形を作成、`$PROMPT$` dollar-quote で `UPDATE public.llm_prompts SET body=$PROMPT$...$PROMPT$, is_active=true WHERE prompt_key='l2m1.monthly_report.internal.v2'` を Supabase MCP `execute_sql` で反映。external.v2 も同様。verify: internal body 8,569 chars / external body 3,990 chars、is_active=true。
- プロンプト設計方針: LLM が主役、章構成 (何を第N領域として立てるか) も含めて全 DB データから判断して書く、表・数値・日付は決定論的に入力 JSON に含めて渡すが LLM が組み込む、KUTE 実納品 markdown を few-shot として user 側に含める、内部版は §A-§F 内部評価節必須、対外版は allow_list 動的注入 + 禁止語厳格削除。

### Claude routine 登録 (Anthropic 側)
- MCP `create_scheduled_task` で taskId=`amd-os-l2m1-monthly-report`、cronExpression=`0 3 28-31 * *` (LOCAL time = JST)、prompt には repo SKILL.md 参照 + 概略。**Next run: Tue, Jul 28 03:04 JST** (Anthropic 側の jitterSeconds=299 で 03:00 の +5 分程度)。
- 実行環境が Anthropic クラウド sandbox ではなく、**まさの mac local Claude Code アプリ**であることが本セッション中のテスト実走 (l2m1-test-p00-june-internal-only、2026-07-01 16:12 発火、14秒で exit) で判明。

### 旧 Codex `amd-os-l2` disable
- `~/.codex/automations/amd-os-l2/automation.toml` を `status = "ACTIVE"` → `"PAUSED"` に変更。バックアップ: `automation.toml.bak_20260701_disable_by_eimi`。旧 daily 05:30 JST の M-1 生成は停止。並走なし、まさ「即 disable でOK」確定。

### まさ手動修正 (session 内): 本番 SKILL.md に「1 PJ ごとの完了条件」節を追加
- 完了条件 4 つ (LLM 生成 / `upsertMonthlyReports` で `writtenCount>=1` 受領 / GET verify で length・status・generated_at 一致 / Slack 通知)。1 つでも欠けたら成功版 Slack 通知禁止。
- **今 handoff で復元 commit**。前 worktree で作業していた変更が unpushed のまま失われかけたが、次セッションのえいみが commit で確定させる。

### CockpitMonthlyModal 修正 (main `5f7f15bd`)
- MS カード「この月の仕事」欄に markdown table が重複表示される事象を修正 (BUGS.md 該当エントリ参照)。`extractReportSnippets` を全削除、正本 3 ソース (`milestone_monthly_progress.note` + `member_ms_activities` + `member_activities`) のみに戻す。BUILD_VERSION `v0.36.41`→`v0.36.42`。

### テストラン結果と教訓
- `l2m1-test-p00-june-internal-only` 一次実行 (2026-07-01 16:12): SKILL.md に「DB に一切書かない」と絶対条件を書いた結果、LLM は忠実に skip → ローカルファイル出力のみで DB は旧 gpt-5.5 版のまま → 月次モーダル未更新。
- テスト task を SKILL.md 全面書き換えで再武装 (2026-07-01 18:00 fireAt): 本番 SKILL.md の「1 PJ 完了条件 4 つ」を検証する形にし、DB 上書き必須。まさが「今すぐ実行」で kick、opus-4-8 + ultracode + 新プロンプトで生成された p00 6月 markdown を月次モーダル左カラムで確認、「ちゃんとクオリティ高い」評価済み。
- **教訓 (BUGS.md 反映)**: routine の完了判定は「LLM 生成成功」ではなく「DB reflect verify 成功」を基準にすべき。ローカルファイル副本は verify 材料であって完了条件ではない。

### 次セッションで着手する残タスク
- **KUTE p25 / SX p21 / CX p20 で実走検証** (本番 routine を手動 kick、月次モーダル反映 + Slack DM 通知 + 副本ファイル出力の 4 セット確認)。scope=internal_and_external なので Phase 2.4-2.6 (対外版生成 + 禁止語チェック + PDF 生成) も走らせる。
- **`scripts/strip_internal_jargon.py` と `scripts/generate_monthly_report.py` の実装** (SKILL.md では references として登場するが未実装、まさが月末までに PDF 生成経路を有効化したい場合は必要)。
- **本番 routine の 2026-07-31 発火時の実走確認**。まさの mac が 03:00 JST に起動 + Claude Code アプリ open していれば発火、翌朝業務開始までに全対象 PJ の DB reflect + Slack 通知が揃う想定。

---


### コンテキスト
- 7/14 `SolvioraX経営会議` の会議後カードで、まさから `決まったこと / 次の一手 / 残課題` を箇条書きにすること、PDF出力に投影資料と参加者共有資料も含めることが確定した。
- MTGカードへの資料添付自体は完了していたが、既存 `PDF保存` は本文だけを出力し、実際の共有PDFに添付資料が入っていなかった。

### 実施内容
- 通常MTG / dialogue narrate / H-1 meeting extract の生成契約を、`背景 / 経緯` は段落、`決まったこと / 次の一手 / 残課題` は1項目1論点の `- ` 箇条書きへ変更した。
- `CockpitMeetingDetailModal` のPDF保存処理を拡張し、本文PDF作成後に `/api/meeting-assets` を読み、PDF / PNG / JPEGを `sort_order` 順で連結するようにした。
- PDFページは `pdf-lib` の `copyPages`、画像は `embedPng / embedJpg` で実ページ化する。リンク一覧だけで済ませない。
- 投影資料を先、参加者共有資料を後にする運用をdesign正本とOSマニュアルへ同期した。
- `pwa/scripts/check_pwa_critical_ui.cjs` に本文形式とPDF添付契約のanchorを追加した。

### 検証
- `npx tsc --noEmit`
- 対象TS / TSXのESLint
- `npm run test:critical-ui`
- `npm run build`
- 実データ相当の結合PDFを生成し、議事録2ページ + 投影資料8ページ + 共有画像1ページの11ページ、資料順、先頭・投影資料先頭・最終ページを目視確認。
- main `2ffac7dd` へpush。Vercel status success、production build-infoが同commitであることを確認。

### 教訓
- `meeting_assets` に登録済みであることと、共有PDFへ資料が含まれることは別の検証項目。
- ローカル実装・ローカルbuildは中間工程。本番反映とproduction artifact確認まで終わって初めて完了。

## 2026-07-10 — KUTEメールTODOを先手TODO cronへ追加 / v0.39.54-v3.39.58

### コンテキスト
- まさから、KUTE 平本さんのメールに AMD側TODOが多く書かれているので確認し、同種TODOをメールからも拾える仕組みにしたい、という依頼。
- 追加で「その cron は定額外トークンを使うやつになってないか / オートメーションの中に入れているか」と確認が入った。
- 方針は、Codex automationを増やさず、既存 PWA/Vercel cron `/api/cron/proactive-todo-extract` に非LLM stageとして同居させることにした。

### 実施内容
- Gmail thread 2件から KUTE の AMD側TODOを抽出し、`proactive_todos` に手動seed / production cron upsertで反映した。
  - 内規・チェックリスト再修正案・フロー図の返送
  - エフォートと eAPRIN 履修状況の回答
- `pwa/src/lib/proactive/email-action-requests.ts` を追加。PJ `report_emails` 由来のGmailをGmail APIで検索し、期限つき依頼だけ `email_action_request` として抽出する。
- `pwa/src/app/api/cron/proactive-todo-extract/route.ts` に Stage 3 Gmail sweep を追加。既存のMTG next_action / 次回MTG準備 / red昇格 / blocked復帰の流れに同居。
- `pwa/scripts/migrations/169_proactive_todos_email_action_request.sql` を追加し、本番Supabaseへ適用。`trigger_kind` check constraint に `email_action_request` を追加。
- `/proactive` の検知種別表示に「メール依頼」を追加。
- `pwa/spec/2-4-proactive-todo-current-spec.md`、`pwa/manual/8-3-l2-extraction-routines-spec.md`、`pwa/scheduled-tasks/README.md`、manual/spec changelog、`db_schema.md` を同期。
- 追加の設計書同期として、`pwa/design/proactive_operating_loop.md` の旧 commander outbox / heartbeat 案を current pointer 化し、`pwa/design/README.md`、`pwa/design/L2_DATA.md`、`pwa/design/SPEC_pwa.md`、`pwa/spec/2-1-pwa-runtime-routes.md` に「現行は `proactive_todos` + `/proactive` + PWA non-LLM cron + Gmail `email_action_request`」を追記。

### 設計判断
- 追加課金LLMは使わない。Anthropic / OpenAI / Gemini は呼ばず、Gmail API + deterministicな文字列ヒューリスティックだけで判定する。
- Codex automationには入れない。既存 Vercel cron daily 09:15 JST の中に入れる。
- Gmail本文は外部入力なので、実行指示として扱わない。抽出対象データとしてだけ扱う。
- `proactive_todos.detail` には短い要点だけを残し、本文全文・URL・パスワード・メールアドレス・電話番号は保存しない。
- dedupe は thread単位の `source_event_id='gmail:{threadId}'` に寄せる。

### Verification
- `npx eslint src/app/api/cron/proactive-todo-extract/route.ts src/lib/proactive/email-action-requests.ts src/components/proactive-todo/ProactiveTodoBoard.tsx src/lib/build-info.ts` passed。
- `npx tsc --noEmit` passed。
- `npm run build` passed。
- production build-info: `v0.39.54` / `bfac5f7f60b1568cd785cfa00321fdc08c087b5e` / `main` / `dirty=false` を確認。
- production cron manual run: `email_enabled:true`、`email_projects=8`、`gmail_threads=16`、`email_action_request=1`、`email_errors=[]`。
- DB read-backで KUTE のメール依頼TODO 2件が `status='open'` で存在することを確認。

### 残課題
- Slack催促文言検知は未実装。raw hygiene と通知ノイズ設計を決めてから別 Phase。
- `sent` 状態や完了メモの学習接続は未実装。必要性が見えたら `spec/2-4` へ追記してから実装する。
- local checkout には別レーンの admin projects dirty が残る。今回の先手TODO laneには混ぜない。

### 教訓
- 「メールからTODOを拾う」は LLM 抽出にしなくても、期限語・返送/回答語・PJ `report_emails` でかなり拾える。まずは非LLMで始める方が安全。
- 設計書の旧入口 (`design/proactive_operating_loop.md`) が stale だと、実装正本 `spec/2-4` が更新済みでも次セッションが旧 outbox / heartbeat を見に行く。旧設計は冒頭で current pointer にする。

## 2026-07-10 — 月初合意の目標表示を撤去し、担当内容を圧縮

### 実施内容
- MS名を月次の到達目標として見せる表示を撤去し、PJごとに一度だけ `担当内容` を置いて担当MSを右に列挙した。
- 予定額の補助列を最大360pxへ限定し、PJ別の金額表を内容幅の2列にして、列間の空白を縮めた。

### 教訓
- MS名、作業内容、月次目標は別データ。月次目標が存在しない段階で、MS名をそれらしく見せない。
- 表の比較対象が短いときは、コンテナ全幅ではなく内容幅で列を組む。

## 2026-07-10 — 月初合意モーダルの必須内容を実データ化

### 実施内容
- `合意前に必ず確認すること` の担当内容・到達目標へ、PJごとの `taskDescription` とMS名を直接表示した。
- 主操作を左の `確認して合意`、補助操作を右の小さい `修正要望` に固定した。
- `支払い状況と対象PJ` は初期閉じにし、開いたときだけ合計とPJごとの支払い内訳を表示。モーダル下段のPJカードは重複するため撤去した。

### 教訓
- 必須確認は、詳細画面へ誘導する説明ではなく、本人が合意する値をその場で読める契約面として作る。
- 修正・取消と合意のような非対称な操作は、サイズ・順番・強さを同列にしない。

## 2026-07-10 — 月初合意モーダルの説明カード撤去

### 実施内容
- snapshot の `conditions` が常に空であることを確認し、必須カード名を `担当内容・到達目標` に変更した。
- 常設の `直してほしいこと` カードを廃止し、`確認して合意` 横の `修正要望` から必要時だけ入力欄を開く導線にした。
- `参考情報` はデータのない独立カードをやめ、PJ詳細へつながる短い区切り見出しにした。

### 教訓
- 画面ラベルは将来入り得る値ではなく、現在の表示データに合わせる。
- 区切りのためだけのカードは、情報をまとめるのではなく分断する。データを持たない説明は区切り線と小見出しで十分。

## 2026-07-10 — 月初合意モーダルの必須金額集約

### 実施内容
- `合意前に必ず確認すること` の枠に、予定額合計と全PJの予定額を実数で集約した。
- 必須枠より下を `参考情報・修正依頼` として明示し、発注条件の詳細、予定額の根拠、支払い状況、修正依頼を二次情報として分けた。
- モーダル下段のPJカードから、必須枠と重複する予定額表示を外し、MS別の進み具合・pt・担当割合を参考詳細に整理した。

### 教訓
- 「何を確認するか」という説明だけでは不十分。合意に必要な実数値は、その説明と同じ枠内に置く。
- 必須/参考の区別は折りたたみだけに頼らず、区切り見出しを境界の先頭に置く。

## 2026-07-09 — W-Prep Launch 漏れ補完 + automation設計修正

### コンテキスト
- まさから、明日の `int) PoCサービス（依頼側）` prep thread が立ち上がっていない、他にもMTG漏れがありそう、と指摘。
- さらに、立ち上げ済み prep thread の待機メッセージが「会議冒頭で読むセリフ案」になっており、まさが期待する開始点と違うと指摘。
- 共有フォルダに作る prep 資料が Google Docs / Markdown などに分散しており、今後は AMD OS デザインコードに従った HTML 資料へ統一したい、既存スレッドには言わず automation 設計だけ変えたい、と依頼。

### 実施内容
- `w-prep-launch` automation を、毎週水曜15:00 JSTのまま、Calendar + DB の7日窓照合を必須に更新。DB upcoming 行だけを見て完了扱いにしないルールへ変更。
- CalendarにはあるがDB未同期だった active/sales PJ のMTGを補完し、visible prep thread を作成・改題・pin・DB session保存した。
- 既存16 prep thread へ、待機メッセージを「これまでのMTGの流れ / 今回の位置づけと推定着地点 / まさがやるべきこと」の3点完了報告へ差し替える補正指示を送信。
- `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md` を更新し、Phase 5 / Phase 10 の第一声契約を3点完了報告に修正。
- 同 SKILL の Phase 6 を、共有フォルダ prep 資料の主成果物は HTML に統一する仕様へ変更。Google Docs / Markdown / Slides / Sheets を主成果物にしない。参照デザインコードは `pwa/src/lib/exec_summary/template.css`、`template_section.html`、`pwa/design/cyber_hud_design_code.md`、`pwa/design/hud_visual_language.md`。
- active automation prompt と `/Users/masa/.codex/automations/w-prep-launch/memory.md` も同じルールに更新。
- repo 正本として、`pwa/spec/3-3-meeting-flow-current-spec.md`、`pwa/manual/2-3-pj-cockpit.md`、`pwa/manual/3-2-data-and-extraction.md`、`pwa/manual/8-3-l2-extraction-routines-spec.md`、`pwa/design/L2_DATA.md`、`pwa/scheduled-tasks/README.md`、appendix changelog、`pwa/BUGS.md` に同期。

### 補完して立ち上げた主な thread
- `int) PoCサービス（依頼側） prep` / `019f40ca-6d34-7990-bf05-c2240afa680b`
- `GTIE定例会 prep` / `019f40c9-ea43-72d2-a9d6-82e787016080`
- `ビザスク）鈴木様 prep` / `019f40ca-f6c2-7b91-aece-e2f31e5386a0`
- `[NIMS現地] NIMSベンチャー審査委員会 事前レク prep` / `019f40cd-d109-7f30-96e6-043269bd0927`
- `【ZeMA】定例MTG prep` / `019f40ce-5e50-7fb0-8fa0-4e53017f05d4`
- `[KUTE/Internal] 定例会前AMD打合せ prep` / `019f40ce-d627-7eb2-b6be-b8af129a7812`
- `【web】LiSTie経営会議 prep` / `019f40cf-62b6-74f0-bbec-5698d5ea85fb`
- `【隔週定例】CryoX プロジェクト（ハイブリッド） prep` / `019f40cf-ddd9-7f92-95f1-f495b74a66e8`

### Verification
- `w-prep-launch` active automation prompt に Calendar照合、pin必須、日本語prompt、3点完了報告、HTML資料統一が入っていることを確認。
- `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md` に同ルールが入っていることを `rg` で確認。
- closeout inventory: branch `main`, HEAD `1120ff2d`, origin/main `1120ff2d`, worktree 1つのみ、local ahead/behind 0。未commit dirty はこのセッションの docs/SKILL 変更 + 既存の他worker差分。

### 教訓
- 予定MTG prep の安全性は DB-only では足りない。Calendar confirmed event とDB upcoming rowの差分確認を起動前の必須ゲートにする。
- 「第一声」という曖昧語は、会議冒頭セリフ案へ寄る。まさが開く前に完了すべき成果を3点で指定する。
- 共有フォルダ資料は主成果物形式を固定しないと、GDocs / md / slides へ分散する。prep 資料はHTML主成果物に統一する。

## 2026-07-02 — BZM 教科書2冊 × RT組み込み設計 (Book A/B ポートフォリオ + Ch 9.5/37.5 新設 + skeleton ステージ2確定)

### コンテキスト
- まさ依頼「BZM の教科書として (a) MBA1年生/経営学部1年生向けの本 (Book A) と (b) 産連担当者・URA・EIR・VC・起業検討研究者・新規事業開発担当者向けの分かりやすい解説書 (Book B) の2冊をどう作るか、と RT (ラウンドテーブル) を PRS/ERS 対構造にどう組み込むかを並行して議論したい」。
- 940p モノグラフ (Cambridge UP、18ヶ月、Book 0-VI) は執筆中 (Book I Ch 1 §1.0.1 + Book II Ch 5 §5.0.1 起草中、2026-06-28 まさ確定書き順)。この上に教科書2冊と RT 組み込みが乗る三正面。
- RT はまさが「PRS・ERS の2つに RT が有機的に絡みついているイメージ」「BZM の大きな要素になり得る」「retrofit 不足は自認するが仮説としてちゃんと組み入れたい」と明言。単なる補助理論ではなく本書の第三柱として扱う判断。

### 実装 / 仕様同期
1. **多視点ワークフロー (wmvi95miv)** = 9 エージェント (6視点: 教科書編集者/MBA教員/URA実務/VC/出版アーキテクト/RT理論家 + 3批判: 理論整合/市場現実/工数現実) を並列起動し、既存コーパス突合 + RT×ERS 組み込み案 + 3冊書き分け原則 + 時間軸を統合。
2. **ディスカッション土台 `2026-07-02_two_books_rt_discussion.md`** 新規作成 (commit `1cb83f28`)。まさ回答 Q1-Q12 で確定分を新正本に判例化した後、supersede 注記追加して履歴凍結。
3. **BOOKS_PORTFOLIO.md 新設** (commit `2d1579f2`) = 3冊+コーパスの L1 上位層。PF-001〜011:
   - PF-001 Book A は数式全部入り (集大成) / PF-002 学部1年捨てMBA主 / PF-003 Book B は URA案4部16章 / PF-004 素材リユースは実戦書17章のみ / PF-005 看板=出口ポートフォリオ論 / PF-006 演習パッケージ投資 / PF-007 チャネル事実訂正 (愛媛大・工学院大IM就任済み、石原先生共著内諾感触) / PF-008 RT を仮説として一級市民 / PF-009 時間軸 (2026ゲート整備・B 2027末-2028初・A 2029.4学期・自動フリーズ条項) / PF-010 校正数値非公開 / PF-011 独禁確認やる+実名交渉やってみる+連載やってみたい。
4. **RT 理論正本 `BZSF/rt_roundtable_theory.md` v0.2**: §13.4 ERS接続 (ICT レンズ + 最小サブ軸4-d/2-e/8-b、新軸9見送り) / §13.5 二重計上ガード (排他的主経路割当・take-or-pay 3分割・**leave-one-out ERS₋ᵢ**・帰属タグ・UI合成禁止) / §13.6 三項構造 (Ψ_j = Ψ̄ + β·ICT_j = Murmann coupling の**法人化前カーネル**) / §13.2 CRL 運用パラメータ (n₀=3ヶ月・Δ レベル別・L4 proxy)。
5. **D-056 判例化 + L1 反映** (commit `34a31137`): RT を仮説的第三柱として正式組み込み。940p→**980p**、**Ch 9.5「ラウンドテーブル — 二層を結合する組成機構」(28p) + Ch 37.5「自己批判とオープンプロブレム — 第二版への課題」(12p、まさ発案)** 新設。Book 0 三項構造宣言 + Ch 26b に H_RT (ICT測定開始) flush。書き順は Ch 9.5 を Ch 10.7 の後、Ch 37.5 は Book VI 内で Ch 37 と Ch 38 の間。
6. **Ch 9.5 節 skeleton ステージ1完了** (commit `61a35f82`、workflow wf_4432f1b0-6ea): 3 persona × 3 lens × synth。winner = メカニズムデザイン案、進化経済案から系譜接続 (ecosystem genesis 4文献 + SEMATECH 実証対照 + Malerba w(L))、計量案から観測装置形式化 (許容事象集合 𝔄・自動降格・三値区別・q・KM 打ち切り) を graft。8節28.0p、命題 9.5.1-9.5.4 + 仮説 9.5.H (Theorem を名乗らない Tier 謙抑)。成果物 = `CHAPTER_9_5_SKELETON.json` + `CHAPTER_9_5_PROGRESS.md`。
7. **Ch 9.5 ステージ2 (Kingpin K1-K8) 全件確定** (commit `d189ac6a`、D-057): K1 番号体系 = 定義/補題/命題/系+仮説 9.5.H / K2 主装置 = BHW+Banerjee observational learning / K3 独禁 = 仮定 L + 本文 box + Ch 37.5 番号 / K4 CRL 運用: **n₀=3ヶ月仮置き** (まさ確定「とりあえず3か月においてみよう」)・Δ L2=365/L4-5=180日・L4 proxy、数値は本文非記載で Ch 26b 事前登録凍結 / K5 RT記号 ℛ, m(e), ERS₋ᵢ, q, Ψ̄/β, n₀ を付録A冒頭 / K6 Tier A 記述 = レベル+事象種別のみ、**金額非表記で開始** / K7 節参照は章名付き / K8 各命題直後に追加仮定明示列挙。
8. **terminology_glossary.md 新設** (commit `d189ac6a` 同梱): 節参照記法 (K7) / RT 記号ブロック (K5) / 乗法/加重和/補完性の3層対応表。
9. **UI 反映** (commit `edb36a65`、BUILD_VERSION v0.37.3 → **v0.37.4**): `pwa/src/app/(app)/bzm/bzm-chapters.ts` に new-book2-ch-9-5 / new-book6-ch-37-5 追加、Book II ラベル「300p, 10章」、Book VI「72p, 4章」。build 検証: `npm run build` 成功 (clean worktree に node_modules を cp -Rc して実行)。Vercel 自動デプロイ完了。
10. **knowledge/members.md 更新** (repo外): まさ役職追加 (工学院大IM 2026 就任月要確認、香川大客員教授来年度見込み)、愛媛大IM時期訂正 (2/→4/)、社外関係者に「BZM教科書 (Book A) 共著候補」セクション新設。
11. **弁護士確認セッション起動** (task_2985c953、まさ承認済み・独立起動中): RT 独禁法務確認の発注パッケージ (§7.3 field-of-use 分割の垂直ライセンス構成) 作成タスク。成果物予定 = `/Users/masa/projects/AMD/BZSF/RT_ANTITRUST_LEGAL_REVIEW_REQUEST_202607.md`。

### 決定事項
- RT は BZM の一級市民 (仮説的第三柱) として正式組み込み。定義・命題 (証明可能な純理論) と実証仮説 (Ch 26b 事前登録) の厳密分離で「仮説として組み込む」と「検証済みと主張しない」を両立。
- Book A = 理論の集大成テキスト (数式全部入り、共著=石原先生筆頭、2029年4月学期照準)。Book B = URA案 (大学側主語) 本体、素材は実戦書17章のみ。
- 総ページ 940p → 980p。書き順は現行維持 (Book I Ch 1 + Book II Ch 5 §5.0.1 最優先、Ch 9.5 本文着手は Ch 10.7 完了後)。
- CRL L2 規模条件 n₀ = 3ヶ月仮置き、Ch 26b 事前登録で凍結。
- BUILD_VERSION v0.37.4。

### 未完 / 次アクション
詳細は `pwa/bzm/HANDOFF_BZM_BOOK_2026-07-02.md`。弁護士確認セッション (task_2985c953) の完了待ち。

### 教訓
- **外部視点批判レビュー (市場現実 persona) の前提誤認**: 「教員ポスト・採用ネットワークゼロ」は事実誤認 (まさは既に愛媛大・工学院大 IM 就任済み、石原先生共著内諾感触あり)。今後 workflow の共有コンテキスト (SHARED) に「著者の実際のポジション・実在ネットワーク」を明示的に含める運用ルールに。
- **「本文を書く」と「本の設計を書く」の区別**: 設計 md (BOOKS_PORTFOLIO / BOOK_DECISIONS / SKELETON) を大量に書くと「本を書いた気になる」錯覚が生じる。本文が生まれるのは 6ステージ pipeline のステージ4 (段落 draft) 以降。進捗はステージで測る。

---

## 2026-07-01 — MTG prep Notion AI Meeting Notes context gate

### コンテキスト
- まさから、MTG prep で Notion 議事録のメモ欄へ固有名詞・略称などの事前情報を入れる仕組みが機能していないように見える、と確認依頼。
- KENQ prep では context が `prep_draft_md` に残る一方、当日の Notion AI Meeting Notes page に marker 付きで入ったことを確認できていなかった。
- さらに、この closeout 開始時点の current `main` には前セッションで作った未commitの gate 実装が残っていなかったため、current `origin/main` へ復元した。

### 実装 / 仕様同期
- `pwa/scripts/l6_prep_notion_context_gate.cjs` を追加。
  - target page 判定: eventId exact、title/date/attendee fallback。
  - `needs_insert` は `ready_gate='blocked_until_insert'`。
  - `injected` / `already_present` / `not_found` / `write_failed` / `ambiguous` / `wrong_page` / `skipped_after_meeting` は完了状態。
  - 既存 `prep_notion_page_id` が別日/別MTG page を指す場合は `wrong_page`。
- fixture 3件を追加:
  - `needs_insert`
  - `injected`
  - `wrong_page`
- `npm run test:l6-prep-notion-context-gate` を追加。
- prep worker prompt に Phase 5.5 を追加し、append-only insert → page 再fetch → gate 再実行を ready 条件にした。
- H-1 extract prompt、`pwa/spec/3-3-meeting-flow-current-spec.md`、`pwa/manual/2-3-pj-cockpit.md`、`pwa/manual/8-3-l2-extraction-routines-spec.md`、appendix changelog、`pwa/BUGS.md` に同期。

### Verification
- `npm --prefix pwa run test:l6-prep-notion-context-gate` passed。
- `git diff --check` passed。

### 残課題
- 実 Notion MCP での insert / re-fetch は未実行。次セッションで upcoming MTG 1件を使って本番挙動を確認する。
- H-1 Phase P には、古い `codex exec` / auto Slack DM wording と、まさの最新期待 (visible Codex thread / 未承認 auto DM なし / Eimi名義送信) のズレが残る。今回の gate bundle とは別に reconciliation が必要。

### 教訓
- MTG prep の context は「生成済み」と「当日 Notion page に実挿入済み」を分けて記録する。
- `needs_insert` は ready ではなく中間状態。ready にするには insert 後の再fetch確認か、手動対応が必要な完了状態へ落とす必要がある。

## 2026-07-01 — JC shareholder materials cockpit backfill + PRS update

### コンテキスト
- まさから、共有Drive `p09_jc/総会関連資料` に入れたJCの今回資料から情報抽出し、コックピットの然るべき場所とPRSスコアへ反映する依頼。
- 新規資料は `2026年6月-株主報告会.pdf` と `月次決算（5月末締）.pdf`。exact name `定時株主総会` の新規PDFは見当たらず、株主報告会/5月末試算表として扱った。
- 参加者一覧に個人連絡先が含まれていたため、DB summary / handoff / output memo には raw PII を入れない方針にした。

### 実施内容
- `project_documents` に2PDFをDrive link付きで登録。
- `project_strategy_signals` に4件を追加/更新: 5.9億円パイプライン、JOYCLE BOX 2号機仕様、5月末キャッシュ/ランウェイ、追加5,000万円調達・EcoBank承継。
- `project_events` に4件を追加/更新、`project_pl_monthly` に202605の月次PLを追加/更新。
- `project_xrl_log` に2026-06-30観測値を追加し、`project_xrl_evidence` に5件の根拠を追加/更新。
- `amd_score_inputs` に2026-07-01 PRS入力を追加/更新し、`amd_score_revisions` に `1389 -> 5294` のPRS改定履歴を保存。
- 2026-06 A種優先株式ラウンドへ投資家内訳を反映し、AMD貢献ステータスを暫定 `full` から `unreviewed` に戻した。
- `projects.governance_watch_shareholder_meetings=true` に更新。
- `/Users/masa/projects/knowledge/jc.md` に、6月株主報告会/5月末試算表の短い現況を追記。

### Verification
- `node /Users/masa/Documents/Codex/2026-07-01/new-chat/work/jc_db_apply.mjs` completed after schema/constraint fixes。
- `node /Users/masa/Documents/Codex/2026-07-01/new-chat/work/jc_db_read.mjs` で反映後を確認。
- 確認値: documents 2、strategy signals 4、events 5 total、project_pl_monthly 1、score rows 12、xrl logs 6、xrl evidence 5。
- 最新PRS入力: P=6 / R_net=4 / mu_i=9 / TRL=6.5 / BRL=8 / GRL=6 / SRL=7 / HRL=6 / FRL=5.5 / FRL_cap=4.5。
- 最新PRS改定履歴: old_value=1389 / new_value=5294 / evaluated_at=2026-07-01。
- app code / schema / manual の新仕様変更は無し。

### 残課題
- JC作業自体は完了。
- A種ラウンドのAMD貢献ステータスは `unreviewed`。後続で貢献証拠を確認するまで `full` / `partial` にしない。
- AA/AAA投資契約の個別価格・詳細はこのセッションでは追加取得していない。
- unrelated dirty tree に H-1/Notion property guard bundle が残っている。JC作業とは混ぜない。

### 教訓
- PostgREST write 前に `pwa/design/db_schema.md` で列名、generated column、check constraint を見る。`project_documents.web_view_link/file_name`、`project_strategy_signals.scope_key`、`polarity`、`project_xrl_evidence.axis` で実際に引っかかった。
- PRS revision は独自の単純積で概算しない。`pwa/src/lib/amd-score.ts` の `calculatePrsScore` と `computeFrlCES` に合わせる。

---

## 2026-07-03 — P1 (Research Policy 論文) S1〜S5前半を1日で完遂 (before-zero セッション)

### やったこと
- PF-013 (論文ポートフォリオ三段構え・計5本+国内1本) を BOOKS_PORTFOLIO に判例化。P2 投稿先 = 研究技術計画で確定 (Publication-first: 論文は2026年内にできるだけ多く、大会発表は2027/4以降)
- D-059 (出版経路3本立て = Cambridge UP + RP + ICC)、D-060 (P1 = 9.5k words + Supplementary Material)、D-061 (石原先生共著方針 + BZM主役framing) を判例化
- P1 本文8節 7,251語を英語起草 (PAPER_P1_DRAFT.md)。SM-A〜C の証明3本は数理経済学者エージェント3並列で起草→えいみ検収→統合 (PAPER_P1_SM.md)。Fig1-3 SVG、References 36件 (全件web照合、幻覚引用ゼロ)
- 6並列模擬査読 (RPエディター/社会選択理論家/実オプション/実証/TTO実務家/引用照合): desk-reject 1 / major 4。統合改稿計画 S5_REVISION_PLAN.md (R1-R10) に仕分け
- 検収段階で本文の実質改善4件: E2×軸7ゲート矛盾の解消 / Theorem 3 の排除条件を sign-consistency に格上げ / C3 の2読み明示 / §3.4 の8軸を institution_readiness.md 正本に準拠修正
- 論文体裁 HTML プレビュー (PAPER_P1_PREVIEW.html): pandoc --mathml + data-URI 図で JS 実行なし環境でも描画

### 主要 commit (すべて origin/main、worktree 方式)
aa143475 (PF-013) / 2e0102dd (D-059) / 83616114 (D-060/061) / b6730488 (S2 outline) / 170b234c (S3 全節) / 62fb6dd0 (S4前半 Table/refs) / f330a9c8 (S4 SM統合) / 6b4ff066 (プレビューMathML化) / 485fd2b3 (S5前半+改稿計画)

### 決めたこと・次
- 次セッション = S5後半 (改稿 R1-R10)。入口 = pwa/bzm/HANDOFF_P1_2026-07-03.md
- R10 (OSF 事前登録 = 結果が出る前の予測を日付証明つきで外部登録。CX 2026-08 / SX 2027-04 の設立判断前が期限) はまさ判断待ち
- モノグラフ Ch 10.4/9/5.5 skeleton の欠陥5点が査読で発見された → S5_REVISION_PLAN.md §5、次モノグラフセッションで L2 判例化要

---

## 2026-07-03 — P1 S5後半 セッション1: R8+R6 軽微 / R1 理論再手術 / R2 certification 対峙 (before-zero セッション)

### やったこと
- **R8+R6 軽微修正** (`09f9f2cd`): 書誌4件修正 (Arrow=Wiley / Nardo=Hoffmann・OECD Publishing / Debreu・Lakatos 頁) + Atkinson 削除 + Cobb-Douglas を σ_SU 段落に引用 + SM 引用済み4件 (Bertola/Caballero/Fishburn/Gorman) を参照リストへ。幽霊参照 (「bottom panel」「survival panel」) 削除。Table 2 の gate 起因行 T・K を WAIT に統一 (empirical MC2。Y の NO_GO は P→0 起因で別物として維持)。SM-A 誤参照3箇所 (§2→§3)
- **R1 理論再手術 完了** (`7ecd24c3`): Theorem 3 を動学的価値関数基盤で再定式化 (socialchoice 査読の構成的修理パスどおり)。f = 養育環境の価値関数 (閉形式 f = PS·exp(−r(1−R)−∫λ) の決定論的ベンチマーク部分クラスで全証明を初等化)。C1′=min(P,S) 消滅・C3′=チャネルのクラス定義化 (型エラーと §5/SM-D との自己矛盾を同時解消)・境界退化は Lemma に格下げ・**新 Theorem 3 = SH (段階依存の作用) / ED (残り道のりへの複利作用) の下で弱単調合成を排除** — 乗法・CES・min を含み、静的公理系では殺せなかった min(PRS,κ(A)) 反例を殺す。Cor 3.2 (portfolio/universal domain) 新設。SM-B GAP 5→2。SM-B はエージェント起草→えいみ検収 (検収修正3点: ε<1/80 明示・tightness 主張軟化・Hausman χ² df を制約数 q に修正)
- **R2 完了** (このセッション最終 commit): §4 に certification effects (Stuart-Hoang-Hybels 1999 / Hsu 2004 / Howell 2017、3件 web 照合済み) との正面対決段落 — certification は資本アクセス = trajectory 経由 = C3′ チャネル内 (A_4/A_5/A_8 → F/hazard/σ-exposure)、排除されるのは trajectory 固定の halo 残差のみ = Hansen-J (R1 で channel completeness 4キャリア moment に再設計済み) の標的。graceful degradation (J 棄却でも Theorem 3 は SH という観測可能な reversal のみに依存) を明示
- PROGRESS に「S5後半 改稿実行ログ」表を新設、HANDOFF_P1 を R3 起点に更新

### 学び・注意
- 並行セッションが活発で push 拒否が2回 → handoff の fetch→rebase→push 手順で事故ゼロ。worktree 方式継続が正解
- 検収で直した3点はいずれも「エージェントが正しく書いたものの主張強度・定数条件の詰め」— 起草→検収の分業は数理でも機能する
- SH/ED は「公理」ではなく観測可能な経験的条件として設計 — 登録プログラム (§7) の検証対象に載せることで査読防御と実証プログラムが一体化した

### 決めたこと・次
- 次 = R3 (Thm1/2/Prop1、SM-A + §3、M6/M7/M8) → R4 (Thm4 + Fig.3 計算版) → R5 (Simpson selection DGP)。相互独立なので並列可。入口 = HANDOFF_P1 (更新済み)
- PREVIEW.html は R1 で stale — 全 R 完了後に再生成 (手順は本ログ同日の前エントリ)
- R10 (OSF) は引き続きまさ判断待ち。モノグラフ5点の L2 判例化も未着手のまま

### 追記 (同セッション続き、R3 + 日付訂正)
- **R3 完了**: SM-A 全面改修 (エージェント起草→えいみ検収、修正2点)。E4 全観測軸 strict 化 (essentiality 循環解消)・E5 (cross-context trade-off invariance) 新設で単一重みベクトルを導出 (cross-K GAP 解消)・continuum 化を Assumption A-1 に昇格 (Scott 1964)・Prop 1 の G1/G2 矛盾を (G0)/(G2′) で解消 + モデル存在例・Theorem 2 を reporting-scale 結果に再ステート (ordinal 非違反を正直に認める + gate 非有罪 remark)・SM-A.5 新設 (audited ⊥、証拠提出拒否は floor コーディング、K_obs 剥がし禁止 — practitioner MC6)。SM-A GAP 4→0 (SM 全体 20→16)。本文 §1/§3 も E 公理5本化・Thm 1/2 再ステートで整合。References +2 (Foster-Shorrocks 1991 / Scott 1964、追加時照合)
- **CX/SX 設立予定の日付訂正 (まさ確認)**: ともに **2027-03頃** (旧記載 CX 2026-08 / SX 2027-04 は古い)。P1 側 (Table 2 M 行・S5計画 R10・HANDOFF) と knowledge/ 側 (cx.md / sx.md / su.md / partner_institutions.md、changelog 付き) を同日修正。**R10 (OSF 事前登録) は急がない** — 期限は 2027-03 の設立判断前。まさの判断3点 (やるか / 公開範囲 / 名義) は HANDOFF_P1 の R10 項に記載済み

---

## 2026-07-03 — 月初合意入口モーダル closeout

### コンテキスト
- まさから、月初合意が完了するまではOSを開いた最初に月初合意を出し、かつページ遷移ではなくモーダルで出したいという指示。
- 最新 main ではモーダル化は入っていたが、背景クリックで一時的に閉じられる状態が残っており、「合意完了まで先に確認する」運用とズレていた。

### 実装 / 仕様同期
- `MonthlyAgreementGateOverlay` から背景クリックで閉じる処理を削除。
- 合意保存が成功した時だけ overlay を解決済みにし、画面を再読み込みして最新状態へ戻すようにした。
- `BUILD_VERSION` を `v0.38.11` へ更新。
- `test:critical-ui` の守りを更新し、背景クリック dismissal が戻ったら失敗する内容にした。
- `pwa/spec/3-14-monthly-work-agreement-current-spec.md`、`pwa/manual/2-2-member-workflows-quick-start.md`、`pwa/manual/6-6-member-billing-prompts-spec.md`、appendix changelog、`pwa/BUGS.md` に同期。

### Verification
- `npm run test:critical-ui` passed。
- `npm run build` passed。
- 実ログイン状態のモーダル操作確認は未実行。画面が認証・合意状態に依存するため、この closeout ではコード path、重要画面チェック、本番ビルドで代替した。

### 残課題
- まさアカウントまたはテストadminで未合意/条件更新ありの状態を作り、production で `/dashboard` などを開いたときにモーダルが前面表示され、背景クリックで閉じないことを実機確認すると安心。
- `/Users/masa/projects/AMD/amd-os` の root checkout には unrelated dirty state が残っている。今回の clean clone bundle と混ぜず、別 cleanup/reconciliation で扱う。

### 教訓
- 「モーダル」は案内表示にも必須確認にも使えるため、月初合意のような gate では「どう閉じられるか」まで仕様とテストに書く。
- 月初合意は報酬計算を変える画面ではなく、本人確認と支払gateの前提を残す画面。6月以前の移行月スキップと、7月以降の通常合意判定を混ぜない。

---

## 2026-07-03 — ZMP reward liability offset closeout + handoff

### コンテキスト
- まさから、5月稼働分は支払通知書発行・実支払済みなので変更できない前提で、シーズン全体の報酬支払が「クライアント支払額 − バッファ」の65%以内に収束するか確認・調整する依頼。
- 途中で「会社留保を減らせば吸収できる」という説明をしてしまったが、これは誤り。会社が負担して赤字を被る方針ではなく、本人の未払残からだけ相殺するのが current truth。
- しん・こうの小額過払いはまさ判断で許容。あび・うめの過払いだけ、本人自身の未払 stock から相殺する。

### 実装 / DB反映
- `reward_member_liability_offsets` を追加し、送付済み/支払済み月の過払いを同一PJ・同一シーズン・同一メンバー本人の未払残からだけ相殺する監査台帳にした。
- `buildRewardSummary`、先12か月 capped 投影、`/admin/season-pl` が同じ相殺台帳を読むようにした。
- ZMP 2026 active offset:
  - うめ `ID008`: 1,560円、`applies_from_ym=202605`
  - あび `ID009`: 1,658円、`applies_from_ym=202605`
  - こう `ID004` / しん `ID026`: 台帳なし。小額差分として許容。
- migration 162 の `metadata_json.tolerated_members` が `ID004/ID010` になっていたため、2026-07-03 に member DB で `ID010=らん`, `ID026=しん` を確認し、migration 163 で本番DBの監査メタを `ID004/ID026` に修正。計算額・active offset 金額は変更なし。

### 仕様同期
- `pwa/design/season_budget_actual.md`: 実支払い済み差分の本人別相殺台帳を追加。
- `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`: 支払済み通知書を変更せず、本人未払残からだけ差し引く運用を追加。
- `pwa/manual/7-1-reward-calc-spec.md`: 相殺台帳の計算タイミング、`pool='any'` の消化順、ZMP 2026判断を追加。
- `pwa/manual/9-3-appendix-changelog.md`: 2026-07-02 の仕様変更として記録済み。
- `pwa/BUGS.md`: 会社留保/他メンバーで吸収しない教訓と、migration 162 metadata typo を記録。

### Verification
- production `/api/build-info`: `v0.37.3`, git `45cb4e551d4a1aa24dbb8e3d9dd428ac1f5fc580`, `dirty=false` を確認。
- production reward cache refresh: `/api/cron/payout-reward-cache-refresh?ym=202601&lookahead=11` を実行し、`cycleCount=130`, `refreshedCount=130`。
- ZMP 202605 `reward_summary_json`: `liabilityOffsetAppliedYen=3,218`, `liabilityOffsetRemainingYen=0`。ID009 は 1,658円、ID008 は 1,560円を本人stockから相殺。
- ZMP 2026 season target members: ID004こう / ID008うめ / ID009あび / ID026しん は最終月 stock=0 を確認。ID008/ID009は offset 後に閉じる。
- `npx tsc --noEmit` passed。`npm run test:critical-ui` passed。
- ローカル `npm run build` は temp clone の `node_modules` symlink/Turbopack panic と既存 cssnano 系で失敗。本番 Vercel build は成功。

### 注意
- `/Users/masa/projects/AMD/amd-os` の canonical local checkout は、この時点で `origin/main` から 58 behind / 7 ahead、かつ多数の未整理変更あり。今回の報酬実装と handoff は `/tmp/amd-os-ms-overview-v03643` の clean origin/main で行った。canonical local を current truth として読まない。
- 本番DBの `reward_member_liability_offsets` には、別作業由来と思われる `status='pending'` / `amount_yen=null` の行が p19 に残っている。現行 v0.37.3 の計算は `status='active'` だけを読むため支払計算には入らない。所有者不明なので、次回も勝手に削除しない。

---

## 2026-07-06 — monthly_fixed 契約cap混在事故 closeout (KUTE)

### コンテキスト
- まさから、KUTE (`p25`) で「クライアント支払よりPJ予算が多い」「月によって計上のされ方に差があるように見える」と指摘。
- あわせて、SX のように不足が出ているのに admin/MS編集側では危険に見えないこと、`/admin/payouts` やシーズン収支でゼロ着地/不足表示の意味が曖昧なことが問題化した。
- 最重要方針として、AMD運営側が認識していないところで運営費・会社留保が勝手に削られ、「ゼロ着地」に見える設計は禁止と整理した。

### 原因
- KUTE の月別差は手入力ではなく、自動経路の混在だった。
- 2026-05-08 に plan cycle と全月 `billing_cycles` が一括生成され、その時点で `budget_yen` に gross client monthly amount が入った。
- 2026-06-18 の旧 Contract Apply は monthly_fixed で `projects.fee_type/fee_amount/end_ym` だけを反映し、月別行は `monthly_applied:0` として触らなかった。
- 2026-07-01 の contract auto-confirm だけが当月を `月額税抜×65%` へ直したため、当月は正しい65% cap、未来月は古い一括生成値という状態になった。

### 実装 / 仕様同期
- `pwa/src/lib/contracts-apply.ts` に `monthlyFixedBudgetRows` を追加。
- バッファなし monthly_fixed 契約では、未確定 `billing_cycles.budget_yen` と現行 `value_plan_cycles.budget_yen` を契約cap (= 月額税抜×65%) へ整合する。
- 確定済み/進行済み月の `budget_yen` が契約capと不一致なら、隠して進まず Contract Apply を失敗させる。
- SX のように explicit buffer / season reserve があるPJは単純上書きせず、`buffer_breakdown_json` と契約バッファ設計を優先する。
- `pwa/spec/5-6-contracts-management-current-spec.md`、`pwa/manual/6-7-contracts-management-spec.md`、`pwa/manual/7-1-reward-calc-spec.md`、appendix changelog、`pwa/BUGS.md` に同期。
- `HANDOFF.md` と `SESSION_MIGRATION_PROMPT.md` を ZMP過払いcloseout から今回の monthly_fixed cap closeout へ更新。

### Verification / Deploy
- 実装 commit: `b6be05295f91d73d8afef5d821880e1e893a3e4f` (`fix(finance): reconcile fixed contract budgets`)。
- 初回本番確認: `v0.39.1 / b6be0529`, `dirty=false`。
- 実行済み:
  - `npx tsc --noEmit`
  - `npm run test:critical-ui`
  - `npm run test:deploy-version-guard`
  - `npm run lint -- src/lib/contracts-apply.ts`
  - `npm run build`
- 2026-07-06 closeout 開始時点では、他セッションの main 進行により production は `v0.39.5 / bd209e00`。当該修正 commit は main 履歴に含まれる。

### 残課題 / 注意
- canonical checkout `/Users/masa/projects/AMD/amd-os` は stale/dirty。clean worktree または `origin/main` / production build-info を current truth として使う。
- SX はバッファありPJなので、KUTE型の bufferless monthly_fixed 整合をそのまま当てない。`buffer_breakdown_json` と契約termsを先に読む。
- MS編集/Contract Apply の出口では、client payment / buffer / PJ budget / member payment / company reserve / ending unpaid balance を同時に見せ、不足があるまま正常に見せない。

### 教訓
- `billing_cycles.budget_yen` が明示値であることと、それが契約capの正しい値であることは別。Contract Apply 済みの monthly_fixed では、古い一括生成値を正本扱いして放置しない。
- 「不足を赤表示するだけ」は、ゼロ着地を必須にする設計の代替にならない。運営費を黙って削る補正は禁止で、ゼロ着地に必要な資金構造を編集時点で見える化・検算する。

---

## 2026-07-03 — 月初合意 / MS編集 支払実績の freee 照合化

### コンテキスト
- まさから、MSを期中編集しても過去に支払った金額は変えず、編集によるPJ予算赤字を編集中に分かるようにしたいという依頼。
- 初期対応では `monthly_reward_payout` の再計算/補完値を支払実績扱いしていたが、まさから「実際の支払額と同一かわからない」と指摘。実績判定の根拠を freee 出金まで戻して確認し直した。

### 実装 / DB反映
- `支払実績` は、保存済みの `monthly_reward_payout.total_pay` 税抜額に消費税を掛けた税込額が freee `wallet_txns.amount` と一致し、かつ `billing_cycles.reward_paid_by` が `freee_wallet_txn_verified:<wallet_txn_ids>` を持つ月だけに限定した。
- `reward_paid_at` だけある月、または銀行出金は見えるがPJ別明細額と一致しない月は `要照合` / `実績未照合` として分離し、実績にも未来予定にも混ぜない。
- 以前に計算補完した `monthly_reward_payout` rows は削除。ZMP p19 202604/202605 は freee 出金と1円単位で一致したため実績確定。p19 202601〜202603 は支払い自体はあるがPJ別明細額と一致しないため `要照合`。p19 202606 は7月支払い証跡が未確認のため `保存済み` に戻した。
- `/monthly-agreement` は `支払済み実績(税込)` / `実績未照合(税込)` / `これから支払予定(税込)` を分け、支払明細は税抜/税込を併記する。
- `/admin/ms-overview` の保存前支払検算は、実績確定分だけを固定支払として扱い、未照合月があれば `blocked` にする。

### 仕様同期
- `pwa/spec/3-14-monthly-work-agreement-current-spec.md`: freee 照合済み実績、未照合、税込表示を追記。
- `pwa/manual/6-8-admin-ms-overview-spec.md`: MS編集の予算影響で支払済み固定/実績未照合/保存後残予算を分け、未照合を保存不可にする仕様を追記。
- `pwa/manual/7-1-reward-calc-spec.md`: 支払実績と報酬計算キャッシュの境界を同期。
- `pwa/manual/9-3-appendix-changelog.md` / `pwa/spec/6-1-appendix-changelog.md`: 2026-07-03 の変更履歴に記録。
- `pwa/BUGS.md`: 計算キャッシュを実績扱いした事故と再発防止を記録。

### Verification
- `npx tsc --noEmit --pretty false` passed。
- `npm run test:critical-ui` passed。
- `git diff --check` passed。
- `npm run build` passed。
- `npm run lint` は既存の unrelated lint error で失敗。今回変更箇所由来ではない。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で本番反映。観測時点では `v0.38.3 / 7a7b0ddc70439cc977c80fc6593f467eba0e89d9`。
- 本番 `/monthly-agreement?ym=202607&memberId=ID026` で、`支払済み実績(税込) ¥68,855`、`実績未照合(税込) ¥96,525`、`これから支払予定(税込) ¥223,726`、行別の `支払実績` / `要照合` / `保存済み` 表示を確認。

### 注意 / 次
- 最新 production はこの後 `v0.39.5` まで進んでいる。次セッションは必ず `/api/build-info` と `origin/main` を見て、最新線で作業する。
- p19 202601〜202603 の `要照合` を消すには、PJ別明細と銀行出金が一致する根拠を追加で探す必要がある。推測で `freee_wallet_txn_verified:` を付けない。

---

## 2026-07-08 — MTGカード 予定/準備/日程未確定 亡霊解消

### コンテキスト
- まさから、複数PJの MTGカード周りに `MTG準備` や `日程調整中MTG` が亡霊のように残ると指摘。
- 初回修正後、KUTE cockpit のスクショで `日程調整中MTG` 別欄に 2026-06-23 / 2026-06-22 の古い行が残っていることが判明。
- まさの追加判断: 「日程調整中」欄は不要。予定MTG欄に `日程未確定` と表示すれば足りる。

### 原因
- 予定MTG欄が `meeting_date >= today` ベースだったため、開始時刻を過ぎた当日MTGも予定として残った。
- 開催済み議事録詳細が同じ `calendar_event_id` の `upcoming:` 行を無条件に `MTG準備情報` として拾い、薄い calendar sync テンプレートまで会議後に残した。
- `next_meeting_prep` TODO に MTG開始後の自動終了出口がなく、期限超過しても残り続けた。
- `meeting_id` が `upcoming:` で始まるだけで準備カード扱いしていたため、`source_kinds='notion+gmail+pre_mtg_prep'` のように中身は開催済み議事録へ変わった row まで `日程調整中MTG` に落ちた。
- `upcoming_tentative` を別欄 `日程調整中MTG` として出していたため、日程未確定メモが予定欄とは別の古いレーンに見えた。

### 実装 / 仕様同期
- `v0.39.6` (`bec41598`) で、予定MTG表示を `meeting_start_at > now` に変更し、画面を開いたままでも1分ごとに現在時刻更新するようにした。
- 開催済み議事録に紐づける準備メモは、手動準備または prep worker 成果 (`prep_draft_md` / readiness / session) がある row だけに限定。`calendar-future-sync` だけの薄い予定テンプレートは出さない。
- `proactive-todo-extract` に Stage 5 を追加し、開始時刻を過ぎたMTGに紐づく open/blocked `next_meeting_prep` を `done` へ自動終了するようにした。
- `v0.39.7` (`80cd1fe5`) で、`日程調整中MTG` 別欄を廃止。`upcoming_tentative` は同じ `予定MTG / 準備中` 欄に入れ、日付欄を `日程未確定` と表示する。
- `meeting_id` prefix だけで準備カード扱いしないようにし、`source_kinds` が開催済みソースへ変わった row は準備カードから除外した。
- `pwa/spec/3-3-meeting-flow-current-spec.md`、`pwa/spec/2-4-proactive-todo-current-spec.md`、`pwa/manual/2-3-pj-cockpit.md`、`pwa/BUGS.md`、appendix changelog に同期済み。

### Verification / Deploy
- `npx tsc --noEmit` passed。
- `npm run test:critical-ui` passed。
- predicate 小テスト passed (future upcoming / started upcoming / pending tentative / old tentative / held-source upcoming-id)。
- `git diff --check` passed。
- `npm run build` passed。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で `v0.39.6` と `v0.39.7` を本番反映。
- production `/api/build-info`: `v0.39.7 / 80cd1fe557282e8bced855c60426735aab62de90 / dirty=false`。
- production cleanup: `proactive-todo-extract` one-shot で `closed_expired_prep: 13`。開始済みMTGに紐づく open/blocked `next_meeting_prep` は 0。
- KUTE p25 を新判定で確認し、予定欄に出るのは未来3件のみ。スクショの 2026-06-23 / 2026-06-22 rows は予定欄に入らない。
- ブラウザ自動確認は認証壁まで。desktop/mobile login 画面は overflow / console error なし。authenticated cockpit はまさが `調整中なくなった` と確認。

### 注意 / 次
- もし今後も古いMTGカードが見える場合、まず画面左上 version / `/api/build-info` が `v0.39.7` 以上か確認する。
- `v0.39.7` でも残る場合は、推測でDBを消さず、`project_meeting_summaries.source_kinds`、`meeting_id` prefix、`meeting_start_at`、`calendar_event_id`、`prep_status`、`generated_by_model` を見て、どのpredicateへ入ったかを切り分ける。
- canonical checkout `/Users/masa/projects/AMD/amd-os` は stale/dirty。今回の修正は clean disposable clone `/tmp/amd-os-mtg-ghost-fix-1783401569` から origin/main / production に反映済み。

---

## 2026-07-08 — repo closeout / handoff refresh

### コンテキスト
- handoff / closeout スキル実行。
- 直前の `HANDOFF.md` には、MTGカード亡霊修正の実装時点の注意として「canonical checkout が stale/dirty」という前提が残っていた。
- closeout 実行時点では、docs closeout commit まで main に入り、canonical checkout は origin/main と一致して clean になっていた。

### 実施内容
- `HANDOFF.md` を最新の closeout 状態へ更新。
- `SESSION_MIGRATION_PROMPT.md` を、common 先頭・AMD level memory 併記・現在の main/production 状態込みの濃い再開プロンプトへ更新。
- この design_log に closeout refresh の事実を追記。

### Closeout snapshot
- repo: `/Users/masa/projects/AMD/amd-os`
- branch: `main`
- HEAD / origin/main: `04a3a55d0cf62c48b588c8ba8f0c140cc41a022d`
- production `/api/build-info`: `v0.39.7` / `04a3a55d0cf62c48b588c8ba8f0c140cc41a022d` / `dirty=false`
- `git status -sb --untracked-files=all`: clean
- registered worktree: `/Users/masa/projects/AMD/amd-os [main]` only
- local branches: `main` only
- local main vs origin/main: ahead `0`, behind `0`

### 注意
- `/tmp/amd-os-*` の disposable clone / artifact は複数残っているが、git worktree registry には載っていない。削除は `rm -rf` 系の破壊的操作になるため、この closeout では削除していない。掃除するなら別途、 exact path を出して承認を取ってから行う。

---

## 2026-07-08 — D-10 Member Activity Evidence を Codex automation 合成へ移管

### コンテキスト
- まさから、MyPage「今週やったこと」の中身がひどいと指摘。スクショでは `source_fusion` の行に、メール本文冒頭、HTMLタグ、`meeting_id=upcoming... runner_surface=...` が title として出ていた。
- 途中で、D-10 が Codex automation 内に既に存在し active なのに、なぜ定額外トークン例外扱いになっていたのかも確認した。
- まさの整理: `ALLOW_PWA_LLM_CRONS=1` で D-10 を復活させるのではなく、D-10 の合成処理を Codex automation 側へ移す。

### 原因
- `/mypage` は `member_activities(source='member_weekly')` を読む。
- D-10 route は背景 Anthropic 封鎖後、LLM synthesis の代わりに fallback synthesis で保存していた。
- fallback synthesis は `best.snippet` を title に使っており、Gmail本文・Calendar description・runner marker が活動タイトルとして保存されうる状態だった。
- Codex automation `amd-os-l2-2` は active だったが、中身は PWA route を `interactive=1` で叩く trigger であり、活動文の合成本体はまだ PWA route 側に残っていた。つまり「Codex automation内にD-10がある」だけでは定額内化になっていなかった。

### 実装 / 仕様同期
- `pwa/src/app/api/cron/member-weekly-activities/route.ts`
  - `GET ?mode=evidence` / `?evidence=1` を追加。Gmail / Calendar / source_cache / meeting summary の evidence groups だけ返し、保存も Anthropic 呼び出しもしない。
  - `POST /api/cron/member-weekly-activities` を追加。Codex automation が作った `activities[]` を検証し、全 group がそろっている時だけ窓単位 delete-then-upsert する。保存時は `raw_metadata.synthesis_method='codex'`。
  - legacy `interactive=1` GET は `ALLOW_PWA_LLM_CRONS=1` が無い限り `disabled:true / saved:0` とし、fallback row で上書きしないようにした。
  - fallback title と `cleanText()` も HTML tag / basic entity / raw snippet title を避けるように強化。
- `/Users/masa/.codex/automations/amd-os-l2-2/automation.toml` を更新し、`mode=evidence` 取得 -> Codex 合成 -> POST 保存 -> `synthesis_method=codex` 検証の流れへ変更。
- `pwa/spec/3-0-l2-data-list-current-spec.md`、`pwa/spec/3-1-l2-data-extraction-current-spec.md`、`pwa/spec/5-3-automation-responsibility-current-spec.md`、`pwa/spec/5-8-l1-l3-codex-migration-current-spec.md`、`pwa/manual/3-2-data-and-extraction.md`、`pwa/manual/6-1-operations-settings-spec.md`、`pwa/manual/8-3-l2-extraction-routines-spec.md`、`pwa/design/mypage.md`、`pwa/design/L2_DATA.md`、`pwa/design/SPEC_pwa.md`、`pwa/src/lib/operations-catalog.ts`、appendix changelog に同期。
- `pwa/BUGS.md` に事故と再発防止を追記。

### Verification / Deploy
- `npm run lint -- src/app/api/cron/member-weekly-activities/route.ts src/lib/operations-catalog.ts` passed。
- `npx tsc --noEmit --pretty false` passed。
- `npm run build` passed。
- `git diff --check` passed。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で本番反映。
- production smoke:
  - legacy GET `interactive=1` は `disabled:true / saved:0`。
  - evidence mode は evidence groups を返し、Anthropic synthesis なし。
- 本番データ補正:
  - 現行週 `member_activities(source='member_weekly')` は 22 row。
  - `raw_metadata.synthesis_method='codex'` が 22 row。
  - `<p>`、`runner_surface`、`meeting_id=upcoming`、メール挨拶文など既知 bad pattern は 0 件。

### 注意 / 次
- `/mypage` の「いますぐ抽出」ボタンは、まだ古い refresh route 経由で legacy GET を呼ぶ。今は legacy GET が保存しないため、D-10修復ボタンとしては機能しない。次に直すなら、ボタンを Codex automation / request queue に接続する。
- Windows MMO Task Scheduler launcher を復活させる場合も、legacy GET ではなく Mac と同じ evidence -> Codex合成 -> POST 保存方式へ更新する。
- closeout 時点の canonical checkout には、D-10とは別の dirty `pwa/scripts/atlas_signal_review_tool.mjs` がある。内容は Atlas ingest disabled 時に outbox へ残す retryable exit の追加。D-10 session では触らない。

### 教訓
- 背景LLMを封鎖した route で fallback synthesis を保存に使うと、LLM品質低下ではなく表示汚染として表に出る。
- 「Codex automation が active」でも、実際に何を実行しているかを見る。route trigger だけなら合成本体は移管できていない。
- MyPage の週次活動 title は、snippet ではなく活動単位の要約である必要がある。HTML / runner marker / メール挨拶文は表示前に落とすだけでなく、保存時に入れない。

---

## 2026-07-08 — Admin MS Overview 個人名カード回帰防止 / v0.39.13 closeout

### コンテキスト
- まさから、`/admin/ms-overview` の上段メトリクスに個人名同士を比べるカードが戻っていると指摘。
- まさの補足: 本来は上段4枚構成で、そのカードをなくして別のカードを入れていたはず。
- さらに、設計書に旧カードを連想させる文言が残ると再発するため、該当文言もすべて削除したいという指示。

### 原因
- 初期実装で個人名カードが入り、後続修正では円額だけが消えてカード自体は残った。
- 設計書・重要UI登録簿・変更履歴に旧カードを連想させる文言が残っており、後続作業がそれを current truth と読んで温存しやすかった。
- 最初の対応で3枚化してしまい、まさが覚えていた「本来4枚」という構造とズレた。

### 実装 / 仕様同期
- `c7578d30 fix(admin): restore MS overview finance metric card`
  - 上段を4枚構成へ戻し、4枚目を `budgetImpact` 由来の `PJ予算残` / `不足額` / `予算不足` / `原資超過` カードにした。
  - `BUILD_VERSION` を `v0.39.11` へ更新。
- `b84f73ab docs(admin): lock MS overview metric guard`
  - `pwa/manual/6-8-admin-ms-overview-spec.md` と `pwa/design/FEATURE_REGISTRY.md` に、4枚固定・3枚化禁止・個人名カード復帰禁止・4枚目 `budgetImpact` 固定を追記。
- `a89683e0 docs(admin): remove old MS metric wording`
  - current tree から旧カードを連想させる文言を削除。
- `cb584019 chore(pwa): bump build version for MS guard`
  - まさ指摘「上げないとだめ」を受け、`BUILD_VERSION` を `v0.39.13` へ更新。
  - manual/spec appendix に、再発防止が本番版として判別できるようにした理由を追記。
- `pwa/BUGS.md` に本件の症状・原因・対応・再発防止策を追加。
- root `HANDOFF.md` / `SESSION_MIGRATION_PROMPT.md` を本件の restart state へ更新。

### Verification / Deploy
- `npm run test:critical-ui` passed。
- `npm run test:deploy-version-guard` passed。
- `npx tsc --noEmit` passed。
- deploy rollback guard passed。
- `git push origin main` 後、Vercel production が Ready になり、`https://amd-os-pwa.vercel.app/api/build-info` が `v0.39.13` / `cb584019ca8710b684322688069c42bf1012d652` / `dirty:false` を返すことを確認。
- 禁止語 `rg` はゼロ件。

### 注意 / 次
- accepted release 後も、別件の dirty が5ファイル残っている。今回の closeout では触らない。
- MS系3ファイルは「設計額を丸め済み1pt単価ではなく、原資×pt比で出す」方向のWIPに見える。採用するなら spec/manual 同期・テスト・build version bump・deploy が必要。
- L6 prep SKILL と Atlas script の dirty も別 lane として扱う。

### 教訓
- 消したいUIの旧名や旧説明を正本mdに残すと、それが後続作業の復活根拠になる。
- 「戻さない」だけでなく「何を代わりに固定するか」まで書く。今回なら「4枚固定、4枚目は `budgetImpact`」が再発防止の核。
- 画面上でまさが確認する変更は、docs guard だけでも build version で判別できるようにする。

---

## 2026-07-08 — PJ cockpit 今シーズン収支 cash-basis 収支 / v0.39.12

### コンテキスト
- まさから、PJ cockpit の season 全体の月次予算内訳にある `内部留保` / `会社留保` は、実質的に役員報酬相当額なのでメンバー向けには見せなくてよいという指示。
- 続いて、`未払残` と `予算残` が同額に見えたことで、予算超過なのかという不安が出た。
- 調査すると、表示されていた `残` は cash movement ではなく、hidden budget safety calc の義務残だった。まさの意図は現金主義でその月の収支を見ることだった。

### 実装 / 仕様同期
- `0eee5780 Show cockpit season finance cash balance`
  - `pwa/src/lib/supabase-data.ts` に cash-basis `cashBalanceYen` を追加。
  - `pwa/src/components/cockpit/CockpitSeasonFinance.tsx` の月次表を `残` から `収支` に変更。
  - `収支 = クライアント支払 - バッファ - メンバー支払` に固定。
  - `会社留保` / 役員報酬相当額は member-facing table から削除。
  - hidden safety calc として `companyReserveYen` / `finalUnpaidYen` / `finalRemainingYen` は保持。
- `pwa/scripts/check_pwa_critical_ui.cjs` を新しい `収支` 表示に合わせて更新。
- `pwa/manual/2-3-pj-cockpit.md`、`pwa/spec/3-8-cockpit-current-spec.md`、`pwa/design/FEATURE_REGISTRY.md`、manual/spec appendix changelog に同期。
- この件は表示定義の修正で、障害ログ化するほどの incident ではないため `pwa/BUGS.md` は対象外。

### Verification / Deploy
- `npx tsc --noEmit` passed。
- `npm run test:critical-ui` passed。
- `npm run build` passed。
- local browser route check は認証前 `/auth/login` まで確認。認証後の cockpit 目視は未実施。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で main push / Vercel production 反映。
- production `/api/build-info` は finance cockpit 変更時点で `v0.39.12` / `0eee5780...` / `dirty:false` を確認。
- 後続の MS Overview guard commit により、closeout 時点の production は `v0.39.13` / `2d64a3fa...` / `dirty:false`。

### 教訓
- `残` という語は、財務表では cash residual と obligation residual のどちらにも読める。メンバー向け画面では目的に合わせて `収支` など意味が閉じる名前にする。
- 役員報酬相当額のような内部向け配分は、内部計算には残しても、メンバーのPJ画面に露出させない。

---

## 2026-07-09 — Finance cockpit + MS guard handoff closeout refresh

### コンテキスト
- まさから `handoff` / `closeout` の実行依頼。
- 直近の accepted work は、PJ cockpit の cash-basis `収支` 化と Admin MS Overview の個人名カード回帰防止。
- closeout 作業中に、別 lane の cockpit つくよみメモ削除 WIP が一時的に dirty として見えた。

### 実施内容
- root `HANDOFF.md` を、finance cockpit と MS guard の両方が再開できる current truth に更新。
- root `SESSION_MIGRATION_PROMPT.md` を、common 先頭・AMD level memory 併記・PJ cockpit / MS Overview 読み順込みの再開プロンプトへ更新。
- 一時的に見えていた nudge-removal dirty 19ファイルは、別 commit `e5d3771a fix: remove tsukuyomi memo from cockpit` として整理された。最終 closeout では、元からあった別 lane の5ファイルだけが dirty として残る。

### Closeout snapshot
- repo: `/Users/masa/projects/AMD/amd-os`
- branch: `main`
- latest product commit before final docs-only refresh: `e5d3771a8154359a48e2a37325b9543b9e880d4c` (`fix: remove tsukuyomi memo from cockpit`)
- production `/api/build-info` should be rechecked after final docs deploy; expected `v0.39.14` or newer / current `origin/main` / `dirty=false`
- local main vs origin/main before final docs-only refresh: ahead `0`, behind `0`
- registered worktree: `/Users/masa/projects/AMD/amd-os [main]` only
- local branches: `main` only
- remaining dirty:
  - `pwa/src/app/api/admin/ms-overview/route.ts`
  - `pwa/src/components/admin/AdminMsOverviewClient.tsx`
  - `pwa/src/lib/admin/ms-overview-calc.ts`
  - `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md`
  - `pwa/scripts/atlas_signal_review_tool.mjs`

### Closeout decision
- この lane は完了済み。
- checkout 全体は dirty 5ファイルが残るため `do not archive`。

---

## 2026-07-09 — Final closeout after cockpit memo removal

### コンテキスト
- handoff/closeout 作業中に並行して進んでいた cockpit つくよみメモ削除が `e5d3771a` として main / origin/main に入った。
- これにより、途中で棚卸ししていた nudge-removal dirty 19ファイルは current truth ではなくなった。ただし元からあった MS finance / L6 prep / Atlas の5ファイルは dirty のまま残る。

### 実施内容
- `HANDOFF.md` と `SESSION_MIGRATION_PROMPT.md` を、nudge-removal 完了 + dirty 5 preservation の状態へ再更新。
- `e5d3771a` を latest product commit として扱い、通常PJ / institution cockpit に旧 `CockpitNudge` を戻さないことを再開プロンプトへ追加。

### Closeout snapshot
- repo: `/Users/masa/projects/AMD/amd-os`
- branch: `main`
- latest product commit before final docs-only refresh: `e5d3771a8154359a48e2a37325b9543b9e880d4c`
- expected production after final docs deploy: `v0.39.14` or newer / current `origin/main` / `dirty=false`
- registered worktree: `/Users/masa/projects/AMD/amd-os [main]` only
- local branches: `main` only
- dirty state: 5 files remain

### 注意
- `e5d3771a` の詳細な test proof は、この handoff session では再実行していない。必要なら該当 commit / worker のログを見る。

---

## 2026-07-09 — ZMP MS 支払済み実績 alignment / reserve 承認 UI gap

### コンテキスト
- まさから、ZMP の `/admin/ms-overview` が `MS編集停止中` になり編集できないという相談。
- 画面上の blocker は `支払済み印はあるが実支払証跡と明細額が未照合の月があります: 202601, 202602, 202603`。
- まさの判断は「過去分は一致するわけがない。支払済み額に OS 上の情報を合わせる」。加えて「実績へ無理やり合わせた結果 65% を超えるなら、内部留保分を切り崩すことを許可するかのダイアログが必要」。

### 実施内容
- 本番 Supabase の ZMP `p19` について、202601-202603 の `monthly_reward_payout` を freee 銀行出金の実支払額へ合わせた。
- `billing_cycles.reward_paid_at` / `reward_paid_by` を `freee_wallet_txn_verified:*` に更新し、`billing_log` に `reward_paid_actual_alignment` を追記した。
- read-back で 202601-202605 がすべて verified、`unverifiedPaidYms=[]` を確認した。
- Production Chrome では `/admin/ms-overview` の page text search で `MS編集停止中` / `支払済み印` / `実支払証跡` / `予算不足` / `原資上限` が出ないことを確認した。アコーディオン展開の完全な目視確認は monthly agreement overlay の影響で未完。

### 実績値
- 202601: 税抜 255,000 / 税込 280,500 / paid 2026-02-27 / 4 members
- 202602: 税抜 169,000 / 税込 185,900 / paid 2026-03-31 / 4 members
- 202603: 税抜 170,254.545 / 税込 187,280 / paid 2026-04-30 / 4 members
- 202604: 税抜 102,180 / 税込 112,398 / paid 2026-05-29 / 4 members
- 202605: 税抜 85,410 / 税込 93,951 / paid 2026-06-30 / 4 members

### 未実装 / 次
- `/admin/ms-overview` に、過去支払済み月を実支払額へ合わせる admin UI がまだ無い。
- 実支払 alignment によって `(クライアント支払 - バッファ) × 65%` を超える場合、内部留保/会社留保を切り崩す承認ダイアログを出す必要がある。
- 承認 UI 実装時は `pwa/manual/6-8-admin-ms-overview-spec.md`、`pwa/spec/3-14-monthly-work-agreement-current-spec.md`、`pwa/design/FEATURE_REGISTRY.md`、manual/spec changelog を同期する。

### 教訓
- 支払済み過去月は「現在の MS 設計から再計算した額」ではなく、「実際に払った額」が正本。
- blocker は正しいが、解消手段が SQL 直書きしかない状態は運用事故を生む。admin UI で証跡・差額・reserve 承認をまとめて扱う。

---

## 2026-07-09 — PJ cockpit 旧 ProactiveQueuePanel 削除 / v0.39.15

### コンテキスト
- PJ cockpit 右カラムに、廃止済みの `proactive_outbox` 由来TODO枠が残っていた。
- 旧司令塔前提の `drafted` / `資料作成済み` 行が、PJ状況を見る面では完了・外部送付待ち・内部メモのどれか分かりにくいノイズになっていた。
- 先手TODOの現行導線は `proactive_todos` + `/proactive` + dashboard 上段バッジ。

### 実装 / 仕様同期
- `pwa/src/components/cockpit/CockpitView.tsx` から `ProactiveQueuePanel` import / render / project label memo を削除。
- `pwa/src/components/proactive/ProactiveQueuePanel.tsx` を削除。
- HUD内 cockpit 説明文を、先手TODOではなく資料・経営ハイライト・MTGサマリを確認する表現へ更新。
- `pwa/spec/3-8-cockpit-current-spec.md`、`pwa/spec/2-4-proactive-todo-current-spec.md`、`pwa/spec/5-3-automation-responsibility-current-spec.md`、`pwa/design/FEATURE_REGISTRY.md`、`pwa/design/SPEC_pwa.md`、`pwa/design/cockpit.md`、`pwa/manual/2-3-pj-cockpit.md`、`pwa/manual/8-3-l2-extraction-routines-spec.md`、manual/spec changelog に同期。

### Verification / Deploy
- `npm run test:critical-ui` passed。
- `npx tsc --noEmit --pretty false` passed。
- `npm run build` passed。
- `npm run test:deploy-version-guard` passed。
- `git diff --check` passed。
- local browser: cockpit route は login redirect。desktop 1280px / mobile 390px の login 画面と HUD mock は横はみ出しなし。
- `49c55af0 fix: remove retired proactive queue from cockpit` を main に push。
- production `/api/build-info`: `v0.39.15` / `49c55af0fac1f2e2a7e9955bd5ae519d45b5d843` / `dirty:false`。

---

## 2026-07-09 — 日本文化マップ admin移動 / v0.39.18

### コンテキスト
- まさから「日本文化」のページを admin に移動する指示。
- 開始時に `/Users/masa/projects/AGENTS.common.md`、root / pwa の `AGENTS.md` / `CLAUDE.md`、関連する route/spec/manual/design md を先に読んで、既存の route 正本を確認した。
- 既存の実画面は `/japanese-culture-map` 配下にあり、nav では一般の `資料` group に出ていた。

### 実装 / 仕様同期
- 実ページを `/admin/japanese-culture-map` へ移動し、`JapanMap.tsx` も admin route 配下へ移した。
- 旧 `/japanese-culture-map` は互換 redirect として残した。未ログイン時は `(app)` auth gate が先に走るため、旧routeは login `next` に入る。
- `GlobalNav` の一般 `資料` から日本文化を外し、admin group へ追加した。
- `AdminSidebar` と app layout の title mapping に日本文化を追加した。
- `pwa/design/os_manual.md`、`pwa/design/SPEC_pwa.md`、`pwa/design/FEATURE_REGISTRY.md`、`pwa/spec/2-1-pwa-runtime-routes.md`、`pwa/spec/2-2-pwa-surface-inventory-current-spec.md`、`pwa/manual/2-6-admin-ops.md`、manual/spec changelog を同期した。
- `BUILD_VERSION` を `v0.39.18` へ更新した。
- 表示面の route 移動であり、障害ログ化する incident ではないため `pwa/BUGS.md` は対象外。

### Verification / Deploy
- `npm run test:critical-ui` passed。
- `npx tsc --noEmit` passed。
- `npm run build` passed。
- local dev route smoke:
  - `/admin/japanese-culture-map` は `/auth/login?next=%2Fadmin%2Fjapanese-culture-map` へ redirect。
  - `/japanese-culture-map` は auth gate により `/auth/login?next=%2Fjapanese-culture-map` へ redirect。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で main push / Vercel production 反映。
- production `/api/build-info`: `v0.39.18` / `1327db6b4c2709bf261910868eead7168667a68e` / `dirty:false`。
- production route header で `/admin/japanese-culture-map` が auth-gated route として 307 login redirect になることを確認した。

### Closeout snapshot
- repo: `/Users/masa/projects/AMD/amd-os`
- branch: `main`
- product commit: `1327db6b Move Japanese culture map into admin`
- local main vs origin/main before handoff docs refresh: ahead `0`, behind `0`
- registered worktree: `/Users/masa/projects/AMD/amd-os [main]` only
- local branches: `main` only
- known open task in this lane: none
- unrelated carry-forward: `/admin/ms-overview` の `実支払へ合わせる` admin UI は別レーンとして未実装。

### 教訓
- admin扱いに変える route は、実 route だけでなく GlobalNav / AdminSidebar / title mapping / runtime route spec / surface inventory / manual のすべてを同時に動かす。
- `(app)` 配下の旧route redirectは、未ログイン時には child page より auth gate が先に効く。unauth smoke では `next` の違いまで見ておく。

---

## 2026-07-09 — PJ cockpit MS design amounts / member design amounts / v0.39.20

### コンテキスト
- まさから「コックピットのMSリストに各MSに割り当てられている予算を明示してほしい」と依頼。
- 続けて、MSバー上のメンバーchipにも「各メンバーの金額」を表示するよう依頼。
- `/Users/masa/projects/AGENTS.common.md`、root / pwa の `AGENTS.md` / `CLAUDE.md`、cockpit / MS overview 関連の manual / spec / design md を先に読んだ。

### 実装 / 仕様同期
- `MilestoneGanttChart` に MS単位の `設計額` を追加。
- 通常MSは plan cycle の `budget_yen` をシーズン月数×10ptで按分し、`cap_extra` は同期間の `billing_cycles.extra_budget_yen` 合計を cap_extra 有効ptで按分する。
- バー上のメンバーchipに担当者ごとの `担当設計額` を追加。短い表示は `12.3万円` 形式、正確な円額は hover title に残す。
- `fetchCockpitFromSupabase` から `extraDesignBudgetYen` を渡すようにした。
- `pwa/manual/2-3-pj-cockpit.md`、`pwa/spec/3-8-cockpit-current-spec.md`、`pwa/design/cockpit.md`、`pwa/design/FEATURE_REGISTRY.md`、manual/spec changelog、`pwa/scripts/check_pwa_critical_ui.cjs` を同期。
- `BUILD_VERSION` は MS設計額で `v0.39.19`、担当設計額で `v0.39.20`。

### Verification / Deploy
- `npx tsc --noEmit` passed。
- `npm run test:critical-ui` passed。
- `npm run test:next-period-ui` passed。
- targeted `eslint` passed。
- `npm run build` passed。
- local browser は auth gate で `/auth/login` まで。ログイン後 cockpit の目視は未実施。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で main push / Vercel production 反映。
- production `/api/build-info`: `v0.39.20` / `aaa19ac354f323dc38c2d22cece1e765fcbbd203` / `dirty:false`。

### Closeout snapshot
- accepted commits:
  - `d9d38833 Show MS design budgets in cockpit`
  - `aaa19ac3 Show member design amounts in cockpit MS chips`
- later separate lane integrated on `origin/main`: `79d84375 fix(pwa): compact monthly agreement modal`。
- final handoff docs refresh was committed and pushed after accepted product work. Use `git log -1` and production `/api/build-info` for the exact latest docs-only commit.
- accepted lane は完了・本番反映済み。
- ただし handoff/closeout 時点の checkout には別件dirtyが残っている。代表: `milestone_change_events` migration / `CockpitMsChangeHistory` / admin payouts / invoice issue / billing matrix / admin projects / reward calc spec。
- dirty bundle はこの lane の commit/deploy には含めていない。次セッションで owner/action を確定する。

### 教訓
- コックピットで円額を出すときは、支払確定額ではなく「設計額の目安」と明示し、reward cache / season-pl / payouts の支払正本と混ぜない。
- `cap_extra` は本契約pt単価に混ぜず、別財布原資と cap_extra 有効ptで別計算する。

---

## 2026-07-09 — ZMP OkuDoor 金額ベース別財布 pt 特例 / v0.39.15+

### コンテキスト
- まさから「ZMPのOkuDoor開発の別財布200万、なぜかPJ予算が130万じゃなくて1,300,020になってる」と相談。
- さらに「割り切れるpt数にした方がいい。130ptでもいい」「金額ベースで決まる予算は今後もありそうなので、その場合だけ特例にしよう」と方針確定。
- `/Users/masa/projects/AGENTS.common.md`、root / pwa の `AGENTS.md` / `CLAUDE.md`、MS Overview / reward / season PL 関連の正本mdを読んでから着手。

### 原因
- OkuDoor は別財布原資 `1,300,000円` だが、`cap_extra` を期間由来の `60pt` 固定で扱っていた。
- `1,300,000 ÷ 60 = 21,666.666...` を円単位に丸めた `21,667円/pt` を `60pt` に掛けて、UI上の設計額が `1,300,020円` になっていた。
- 金額ベースで先に予算・支払額が決まる別財布では、期間×10pt固定だと割り切れないケースがある。

### 実装 / 仕様同期
- `capExtraPointBasisForMilestone` を追加し、`cap_extra` は `points > 0` なら明示pt、未設定/0なら期間月数×10ptに統一。
- MS Overview / season PL / reward summary / admin保存API / 編集UIの cap_extra pt 基準を同じ helper へ揃えた。
- `cap_extra` の設計額は、丸め済みpt単価×ptではなく、別財布原資をpt比で配分する形にして、原資合計が端数で増えないようにした。
- protected 月の別財布差額は、実際に `extraPaidYen > 0` がある場合だけ本人別 offset を作るようにし、未払い在庫だけの端数差額は台帳化しない。
- DBは OkuDoor `130pt`、ZMP cycle `total_points=250`、share `まさ 0.692308 / うめ 0.153846 / あび 0.153846` に是正。
- 古い pending cap_extra offset は void し、p19 reward summaries を再同期。
- `pwa/BUGS.md`、`pwa/design/FEATURE_REGISTRY.md`、`pwa/design/season_budget_actual.md`、`pwa/manual/6-8-admin-ms-overview-spec.md`、`pwa/manual/7-1-reward-calc-spec.md`、manual/spec changelog に同期。

### Verification / Deploy
- `npx tsc --noEmit` passed。
- targeted `eslint` passed。
- `npm run test:critical-ui` passed。
- `npm run build` passed。
- `1de0d6b2 fix(admin-ms): support amount-based cap extra points` を main に push。
- production deploy Ready を確認。当時の `/api/build-info`: `v0.39.15` / `1de0d6b209babf64c20baee525198a0fc322e502` / `dirty:false`。
- closeout時点の production は後続 product commit により `v0.39.21` / `79d843756ee685798306d6c8d3e3a441f1f47694` / `dirty:false`。`1de0d6b2` は current origin/main の ancestor。
- DB read-back: 202610 `extraPtUnit=10000`、`extraTotalGrossDueYen=1300000`、`effectiveExtraCapBudgetYen=1300000`、`extraCarryOverYen=0`、うめ/あび各 `extraPaidYen=200000`、まさ役員分は会社留保。

### Closeout snapshot
- repo: `/Users/masa/projects/AMD/amd-os`
- branch: `main`
- product commit: `1de0d6b2`
- closeout inventory時点の `HEAD` / `origin/main`: `a11a9981`
- local main vs origin/main: ahead `0`, behind `0`
- registered worktree: `/Users/masa/projects/AMD/amd-os [main]` only
- local branches: `main` only
- checkout は別件dirtyが残るため `do not archive`。

### 教訓
- 別財布は原則 `期間月数×10pt` でよいが、原資や支払額が金額ベースで先に決まっている場合だけ、割り切れる明示ptを `value_milestones.points` に入れる。
- 円額をpt単価で丸めてから合計すると、固定金額の予算が増えて見える。金額固定の画面では原資をpt比で配分し、合計原資を正にする。
- protected 月の差額台帳は「実際に現金で払った額」を保護するためのもの。未払い在庫だけの再計算差額まで台帳化すると、未来月の自然な再計算を邪魔する。

---

## 2026-07-09 — ZMP 立替精算表示 / 契約確認 / v0.39.22

### コンテキスト
- まさから、ZMP cockpit header の `立替精算` が `不明` になっている理由を確認する依頼。
- 最初にDBフィールド未設定として説明してしまったが、まさの期待は「契約書を見て、実際に立替精算できるかまで確認する」ことだった。
- その後、KR-AMD_250828 の docx/pdf/Docusign版、ZeMA-AMD_250714、OkuDoor 20260501 別契約を確認した。

### 結論
- ZMP 主契約 `KR-AMD_250828` には、AMD の交通費・旅費・実費を別途精算できる明示条項は無い。
- 契約書の `経費負担` は、本件事業利益算定のために売上・費用データを提供し、費用帰属を協議する条項であり、AMDの立替精算条項ではない。
- ただし、まさ確認で ZMP は実務上毎月立替精算を支払ってもらっているため、OS上は `立替精算OK` が正本。
- この会話で、ZMP契約は実務運用と本文が乖離しているため、利益上乗せ条件や立替精算条項を含めて巻き直し候補と整理された。

### 実装 / 仕様同期
- `CockpitHeader` の `立替精算` 表示を `可/不可/不明` ではなく `発生額/不可` に変更。
- `/admin/projects` の立替精算セルを、`可/不可` select + 根拠textarea から、金額または `不可` を直接入れる単一入力へ変更。
- 空欄は `0円`、金額ありはその文字列、不可PJは `不可` と表示する。
- ZMP は `expenseReimbursementAllowed=true` / `expenseReimbursementNote=null` とし、cockpit では `0円` 表示。
- `pwa/design/cockpit.md`、`pwa/design/FEATURE_REGISTRY.md`、`pwa/design/SPEC_pwa.md`、`pwa/spec/3-8-cockpit-current-spec.md`、`pwa/manual/2-3-pj-cockpit.md`、`pwa/manual/6-2-admin-projects-members-ledger-spec.md`、appendix changelog、`pwa/BUGS.md` に同期。

### Verification / Deploy
- 対象lint: `npm run lint -- src/components/cockpit/CockpitHeader.tsx src/components/admin/AdminProjectsTable.tsx` passed。
- 本番 `/api/build-info`: `v0.39.22` / `7212d150` / `dirty:false` を確認。
- まさが本番画面で ZMP `立替精算=0円` を目視確認。

### 教訓
- 契約・請求・支払条件の質問では、DBフィールド名を理由の主語にしない。契約書・請求実績・実務運用のどれが正本かを先に確認する。
- 本番反映の説明は、ローカル状態ではなく `origin/main` と production `/api/build-info` の version / SHA / dirty で行う。

---

## 2026-07-09 — admin 請求書発行キュー / v0.39.24

### コンテキスト
- `/admin/invoices` は左メニューとページ名が `請求書発行` になった一方、画面本体が旧 billing matrix のままで、請求書発行業務として見るには余計な全ステップが前面に出ていた。

### 変更
- main client を `AdminInvoiceIssueMatrix` から `AdminInvoiceIssueQueue` へ差し替え。
- `未発行 / 発行済み / 送付済み / 入金済み / すべて` filter で SU × 月の請求状態を絞り込む。
- 未発行行の主操作を `発行` にし、行詳細からも `請求書を発行` を開ける。
- 発行前確認は `予算 / 報告書 / 立替` の小さな状態表示だけにし、`支払通知 / 報酬支払` など請求書発行と直接関係しない全ステップ横並び chip を撤去。
- `FEATURE_REGISTRY`、`SPEC_pwa`、surface inventory、manual 2-6 / 6-3 / 6-6、appendix changelog、critical-ui guard を同期。

### Verification / Deploy
- closeoutで `git diff --check`、`test:critical-ui`、`test:deploy-version-guard`、`npm --prefix pwa run build`、canonical deploy、production `/api/build-info` を確認する。

---

## 2026-07-09 — `/admin/invoices` 請求書発行キュー / v0.39.24

### コンテキスト
- まさ指摘「ページ名は請求書発行になってるけど、中身はbilling matrixのままだよ」を受け、旧 billing matrix を請求書発行業務に寄せ直した。
- 既に `/admin/billing` は互換 redirect へ移動済みだったが、画面本体が全ステップ横並びのままだったため、ページ名と主作業がズレていた。

### 実装 / 仕様同期
- `AdminInvoiceIssueMatrix` を削除し、`AdminInvoiceIssueQueue` へ差し替え。
- 主画面を `未発行 / 発行済み / 送付済み / 入金済み / すべて` filter 付きの発行キューに変更。
- 各行の発行前確認は `予算 / 報告書 / 立替` のみに絞り、未発行行の主操作を `発行` にした。
- 請求額表示は `invoice_base_lines_json` の明細合計を最優先し、なければ `budget_reported_amount`、最後に `budget_yen / 0.65` を使う。
- 狭い幅ではキュー本体を横スクロールさせ、列を潰して読めない状態にしない。
- `pwa/design/FEATURE_REGISTRY.md`、`pwa/design/SPEC_pwa.md`、`pwa/manual/6-3-invoice-and-billing-routine-spec.md`、`pwa/manual/6-6-member-billing-prompts-spec.md`、manual/spec changelog、critical-ui guard を同期。

### Verification / Deploy
- `git diff --check` passed。
- `npm run test:critical-ui` passed。
- `./node_modules/typescript/bin/tsc --noEmit --pretty false` passed。
- `npm run build` passed。既存の Next.js middleware deprecation warning のみ。
- closeout deploy は正規 script で実行済み。production `/api/build-info` は `v0.39.24` / `dirty:false` を返す。

---

## 2026-07-09 — MS変更履歴 cockpit 表示 / 既存履歴 backfill / closeout

### コンテキスト
- まさから「MSの変更履歴をコックピットに表示してほしい。トグルで畳んでおく形で」と依頼。
- 理由は、MSが勝手に変更されて報酬額が変わった時にメンバーから不満が出ること、そして新しい業務委託契約書ではMS変更記録をAMD側の責任として残す必要があること。
- 途中で、えいみが別件dirtyを理由にpush/deploy停止のような報告をしてしまい、まさから「明確なルール違反」「ローカルでテストするのやめて」と指摘。共通ルールと repo ルールへ再発防止を追記した。

### 実装 / 仕様同期
- `milestone_change_events` を追加し、`/admin/ms-overview` 保存成功時に、変更前後のMS snapshot、追加/無効化/更新されたMS、担当share差分、保存前支払検算サマリを記録するようにした。
- cockpit の今期MS直下に `CockpitMsChangeHistory` を追加。初期折りたたみで、変更日時、記録者、変更件数、MS差分、担当share差分、追加支払/過払い回収サマリを表示する。
- 既存MS分も backfill。active / fixed の 11 plan cycle、110 MS を、`value_milestones.created_at` ごとの作成バッチとして 19 event に分けて `milestone_change_events` へ追加した。
- backfill event は `source='migration'`、`changed_by_email='amd-os-backfill@teamarmada.local'`、`metadata_json.backfillKey='2026-07-09-ms-change-history-created-at-batches-v1'`。ログ導入前の pt/share 更新時刻は復元せず、担当shareは backfill 実行時点の現行値。
- `pwa/manual/2-3-pj-cockpit.md`、`pwa/manual/6-8-admin-ms-overview-spec.md`、`pwa/spec/3-8-cockpit-current-spec.md`、`pwa/design/FEATURE_REGISTRY.md`、`pwa/design/db_schema.md`、manual/spec changelog、`pwa/BUGS.md` に同期。

### Verification / Deploy
- DDL `166_milestone_change_events.sql` は本番DBに適用済み。
- 実装時の検証: `npm run test:critical-ui`、`npm run test:next-period-ui`、`npx tsc --noEmit`、`npm run build` passed。
- まさの「ローカルでテストするのやめて」以降は追加のローカルテスト/ローカルサーバー起動なし。
- production `/api/build-info` で `v0.39.25` / `dirty:false` を確認。ただし closeout時点の production SHA は `97870d24`、`origin/main` は docs-only commit `12e08411` まで進んでおり、MS履歴実装はどちらにも含まれる。

### Closeout notes
- closeout inventory: registered worktree は `/Users/masa/projects/AMD/amd-os [main]` のみ、local branch は `main` のみ、local main vs origin/main は `0 / 0`。
- 別件 dirty: `pwa/src/app/(app)/admin/invoices/page.tsx` は invoice queue refinement 由来。MS履歴 bundle では触らない。
- archive status は、別件dirtyが残るため `do not archive`。MS履歴・backfill 自体は本番DBと production-visible UI に反映済み。

---

## 2026-07-09 — Finance / Payment Confirm nudge 入金日当日化 / v0.39.33

### コンテキスト
- まさから、ZMP のSlack入金確認DMで `予定通り入金済み` を押したら `入金確認できなかった` 画面へ飛んだと共有があった。
- DM本文は `支払月: 2026年7月 / 対象: 2026年6月 / 支払条件: 翌月末 / 期日: 2026-07-31` で、2026-07-09 時点ではまだ入金日より前だった。
- 追加で、入金日前に毎日nudgeされても確認できないので入金日に来るようにすること、`支払月` ではなく `入金月` が自然だと指摘された。
- `/Users/masa/projects/AGENTS.common.md`、root / pwa の `AGENTS.md` / `CLAUDE.md`、finance payment confirm manual、notifications design、PWA route/spec を読んでから着手した。

### 原因
- `/api/cron/payment-confirm-nudges` は入金月 (`ym`) の未入金候補をまとめて読み、各候補の `dueDate` が今日 (JST) かどうかを判定していなかった。
- そのため、同じ 2026年7月入金月に含まれる 2026-07-31 期日のZMP候補まで、2026-07-09 に送信された。
- `入金確認できなかった` 画面は、freee/銀行で入金が見つからなかったという意味ではなく、signed token の即時反映APIが例外を返した時の汎用エラー画面。DB read-back では ZMP p19 / 202606 の `payment_confirmed_at` は未更新だった。

### 実装 / 仕様同期
- `payment-confirm-nudges` に `dueDate` フィルタを追加し、`group.dueDate === todayJst` の候補だけを送るようにした。
- `GET ?date=YYYY-MM-DD` / `POST { date }` を dry-run / 手動検証用に追加した。
- 期日前、期日後、期日一致でもゼロ金額の候補を結果に分類して返すようにした。
- Slack文面、確認完了画面、金額入力画面、freee同期失敗DMの `支払月` を `入金月` に統一した。
- `pwa/manual/6-4-finance-payment-confirm-spec.md`、`pwa/design/notifications.md`、`pwa/design/SPEC_pwa.md`、`pwa/manual/6-1-operations-settings-spec.md`、manual/spec changelog、`pwa/BUGS.md` を同期した。
- `BUILD_VERSION` は `v0.39.33`。

### Verification / Deploy
- `npx tsc --noEmit` passed。
- targeted `eslint` passed。
- `npm run build` passed。既存の Next.js middleware deprecation warning のみ。
- local dry-run:
  - `date=2026-07-09`: `groupCount=0`, `skippedBeforeDue=6`, `skippedAfterDue=1`。
  - `date=2026-07-31`: `groupCount=0`, `skippedZeroAmount=5`。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で main push / Vercel production 反映。
- production `/api/build-info`: deploy直後 `v0.39.33` / `df434cbf0e42d22cb49ab5fa19e5d2a291498e0c`。
- production dry-run `date=2026-07-09`: `groupCount=0`, `skippedBeforeDue=6`, `skippedAfterDue=1`。
- 後続の月初合意UI commit `d8934395` により現在の production は `v0.39.34` 系だが、`df434cbf` は ancestor として含まれる。

### Closeout notes
- 入金確認fix自体の既知残タスクはなし。
- ただし closeout 時点の checkout には別件の `/admin/invoices` freee取引先選択WIPが残っている。主な差分は `AdminInvoiceIssueQueue.tsx`、`api/admin/freee-partners/route.ts`、`FreeePartnerPicker.tsx`。この入金確認fix bundleには混ぜない。
- archive status は別件dirtyが残るため `do not archive`。

### 教訓
- 入金確認nudgeは「入金月」ではなく「入金期日」で送信可否を決める。入金日前は運用者が確認できないので送らない。
- Slackボタン押下後の `入金確認できなかった` は、freee/銀行未検出ではなくAPI例外の汎用表示。再発時は token / 対象cycle / update例外を切り分ける。

---

## 2026-07-09 — 月初合意モーダル情報密度改善 / v0.39.30-v0.39.34

### コンテキスト
- まさから、月初合意モーダルの各欄が大きすぎて、一画面で見られる情報密度が低いと指摘。
- 途中で、右側の空白、`直してほしいこと` のフォーム、PJ名周辺、MS名と担当割合の間、未払い棒グラフ/表の横長さなどを、まさがスクショ付きで個別に指摘する状態になった。
- 最終的に、追加修正後の本番UIをまさが確認し「これならいい」と受け入れ済み。

### 実装 / 仕様同期
- `MonthlyAgreementExperience` のモーダル表示を、`max-w-7xl` 内で横方向に情報を詰める構成へ変更。
- 上部は、状態警告・合意ボタン・対象PJ/予定額/支払済/支払予定/未払残の指標を小型化し、右側に余るスペースを減らした。
- `この画面で確認すること` は `今月の発注条件` / `予定額の出どころ` / `支払いとの関係` の3ステップにし、`今月の約束` という契約書とズレる表現は使わない。
- `直してほしいこと` は details 化し、モーダルでは textarea を1行寄りにして、送信ボタンも同じ帯に収めた。
- PJカード上段は `予定額 / 支払 / 未払残` の3列サマリーへ圧縮。PJ ID と請求状態は見出し横に寄せた。
- 未払い推移は縦積みカード/長い棒グラフをやめ、左に項目・右に稼働月列を置くマトリクスへ変更。行は `前月残 / 当月発生 / 支払対象 / 支払 / 月末残`。
- MS一覧はコンパクト表示で行数が多い場合に2列へ分割し、MS名と担当割合の間の余白を減らした。
- `pwa/spec/3-14-monthly-work-agreement-current-spec.md` と manual/spec changelog は `d8934395` で同期済み。

### Verification / Deploy
- product lane checks: `git diff --check`, `npx tsc --noEmit`, targeted eslint, `npm run build` passed。
- temporary visual-check routeで wide / desktop / narrow / mobile のスクショ確認を実施。route は commit 前に削除。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で本番反映。
- closeout開始時点の production `/api/build-info`: `v0.39.34` / `d89343957fd51ce637fb08aa83aad369d1013a1c` / `main` / `dirty:false`。
- accepted commits: `f13de200 fix(pwa): tighten monthly agreement modal density`, `d8934395 fix(pwa): widen monthly agreement unpaid flow`。

### 教訓
- UI密度改善は、CSS差分やカード寸法の変更だけでは完了判定できない。実データ・本番相当の横幅・スクショで、上から順に「余白」「不要な改行」「1行で済む情報が2行になっていないか」「表の列間」「長すぎる棒/表」を点検する。
- まさに個別の空白を指摘させる状態は品質ゲートとして失敗。次回は、画面全体の情報密度をえいみ側で自分でレビューしてから完了と言う。

---

## 2026-07-10 — 月初合意モーダルの必須確認 / 参考情報分離

### コンテキスト
- 更新警告だけでは、メンバーが「確認して合意」を押さないと支払いへ進めないことを読み取れず、モーダル全体もどこまで確認すべきか分かりにくかった。

### 実装 / 仕様同期
- 状態警告と合意ボタンの直下に、`確認して合意` を押すまで当該月の支払いに進めないことを明記。
- 合意前の必須確認を `今月の発注条件` と `予定額` の2点へ固定し、各PJでも担当内容・到達目標・予定額を `必ず確認` と表示。
- 担当割合/今月のpt、支払い済み・支払い予定・未払残は、初期折りたたみの `参考情報` へ分離。
- current spec と member workflow / billing / reward calculation manual、critical-ui guard を同期。

### Verification
- 確認用データで、標準幅と 390px 幅の画面を確認。必須2点、合意しない場合の支払い停止、参考情報の折りたたみが崩れずに見えることを確認。

---

## 2026-07-10 — 月初合意 `今月支払` 0円表示の修正 / v0.39.40-v0.39.43

### コンテキスト
- `/admin/monthly-work-agreements?ym=202607` の一覧で、全員の `今月支払` が `0円` と表示されていた。
- まさから「7月に1円も支払われないっておかしくない？6月みんな動いてくれたのに」と指摘があり、予定報酬ではなく支払月判定の問題として再調査した。

### 原因
- `billing_cycles.invoice_ym` を明示支払月のように扱っていた。
- `invoice_ym` はクライアント請求書発行月であり、メンバー報酬の現金支払月ではない。
- そのため、ZMP 202606 の保存済み報酬明細が 202607 の `今月支払` 集計から落ちていた。

### 実装 / 仕様同期
- `monthly-work-agreement.ts` に、報酬支払説明用の支払月判定 helper を追加。`invoice_ym` を null 扱いにし、PJ/member 支払条件から支払月を計算する。
- `/admin/monthly-work-agreements` と月初合意 snapshot の `projects[].payoutYen` / `payoutSchedule` を同じ判定へ統一。
- `pwa/spec/3-14-monthly-work-agreement-current-spec.md` と `pwa/manual/6-6-member-billing-prompts-spec.md` に、`invoice_ym` は支払月ではなく請求書発行月であることを追記。
- manual/spec changelog と `pwa/BUGS.md` を同期。

### Verification / Deploy
- `npx tsc --noEmit --pretty false` passed。
- `npm run build` passed。
- deploy script 内の `npm run test:critical-ui` passed。
- read-only 再計算で、202607 の `今月支払` が ZMP 202606 分として合計 87,457円になることを確認。内訳: しん 29,055円、あび 26,227円、こう 25,740円、うめ 6,435円。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で `7ef6f44c` / `v0.39.40` を本番反映。
- closeout時点の PWA production baseline は後続 commit を含む `0221beaa` / `v0.39.43` / dirty=false。`7ef6f44c` は ancestor として含まれる。

### Closeout notes
- 月初合意 `今月支払` 0円 bug の既知残タスクはなし。
- SX 202606 分は現行データ上 202607 支払ではない。もし7月支払にすべきなら、コード不具合ではなく支払条件/契約設定の見直しとして扱う。
- final closeout inventory 時点の root checkout は clean。途中で見えていた GlobalNav / board nav flyout 由来の別件 dirty は `0221beaa` で解消済み。

---

## 2026-07-10 — 左メニュー `ボード` 全アクティブPJフライアウト表示修正 / v0.39.41-v0.39.45

### コンテキスト
- まさから「左メニューの `ボード` にマウスオーバーしたら、全アクティブPJがその右にサブリストとして出てくるようにしてほしい」と依頼。
- `v0.39.41` で実装・本番反映した後、まさから「マウスオーバーしてもホバー出ない」と指摘があった。
- 本番の in-app ブラウザは認証ゲートで `/auth/login` までしか見られなかったため、コード構造と build/test で原因を切り分け、まさの実画面確認で最終受け入れを確認した。

### 原因
- `BoardNavLink` のフライアウトを、左ナビのスクロール領域内に `absolute left-full` で置いていた。
- 親ナビの `overflow-x-hidden` / 縦スクロール枠により、右側へ出した一覧がクリップされ、開いていても見えない状態だった。

### 実装 / 仕様同期
- `fetchActiveProjectsForNav()` で `projects.status='active'` のPJだけを軽量取得し、`/project/{projectId}/cockpit` へ遷移する一覧として表示。
- `BoardNavLink` のフライアウトを `createPortal` で `document.body` 直下の `fixed` レイヤーへ移動し、ナビの overflow に切られないようにした。
- hover / focus で開き、ボード本体の `/dashboard` リンクは維持。マウス移動時に閉じにくいよう短い close delay を入れた。
- viewport 下端基準の `maxHeight` を持たせ、PJ一覧部分だけをスクロールするようにした。
- `pwa/design/FEATURE_REGISTRY.md`、`pwa/spec/2-1-pwa-runtime-routes.md`、manual/spec changelog、`pwa/BUGS.md`、critical-ui guard を同期。
- `BUILD_VERSION` は `v0.39.43` まで上げた。後続の本番 baseline は `v0.39.45`。

### Verification / Deploy
- `npm run test:critical-ui` passed。
- `npx tsc --noEmit` passed。
- targeted `prettier --check` / `eslint` passed。
- `npm run build` passed。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で `22e77d9a` / `v0.39.42` を本番反映し、その後 `0221beaa` / `v0.39.43` も本番反映。
- 本番 `/api/build-info` はまさ受入確認時点で `v0.39.45` / `8799b2d772568b5fe5b247f54b9834e762057234` / dirty=false。closeout最終確認では `v0.39.45` / `0665b5e6a2f04709f3378ffcd7900d7598f27d31` / dirty=false。ボード修正 commit は ancestor として含まれる。
- 実画面の hover は、まさが「今度はいけた！」と確認済み。

### Closeout notes
- ボード hover フライアウトの既知残タスクはなし。
- 認証後の直接ブラウザ目視は、えいみ側の in-app browser がログイン画面で止まるため未実施。今回の最終受け入れはまさの実画面確認。
- closeout時点で root checkout には別件 `pwa/src/components/monthly-agreement/MonthlyAgreementExperience.tsx` の未コミット差分が残っている。今回のボード修正には混ぜない。

---

## 2026-07-10 — /notifications D-11 / MS計画遅延 / action_item feedback 修正

### コンテキスト
- まさから `/notifications` の3件を連続で確認。
  1. D-11 メディア掲載通知で、記事は既に保存済みなのに「抽出された行が見つかりませんでした」と表示された。
  2. D-2 MS計画遅延通知が大量に出て、期限 2026年6月のMSを「現在0%」として扱っていた。
  3. D-14 `action_item` 通知で「はい・確認済み」を押すと `unknown l2_kind: action_item` で失敗した。
- まさの指摘どおり、どれも個別通知の違和感に見えるが、実体は通知詳細・進捗評価・feedback handler の仕様接続が切れていた問題。

### 原因
- D-11 は保存済み正本 `project_media_mentions` を見ず、候補行が取れないと詳細を空扱いする fallback になっていた。
- MS計画遅延は、期限月までの累積進捗ではなく通知実行月側の row を見ていた。さらに `initial_zero` row が前月までの100%実績を0%のように見せていた。
- `action_item` は作成 route が `l2_kind='action_item'` の通知を作る一方、feedback route の allowed kind / yes-no反映先に `action_item` が未登録だった。

### 実装 / 仕様同期
- `/notifications` の詳細表示で、D-11 `news_mention` は `project_media_mentions` を確認。保存済み通知は「はい・確認済み」扱いにした。
- 対応する候補行がない通知でも、通知本文 fallback を表示するようにして、判断材料を消さないようにした。
- `progress-estimator` の MS計画遅延判定を、`ym <= target_ym` の累積進捗へ変更。current row が無い場合は直近の過去進捗を使い、`initial_zero` は過去実績を下げる材料にしない。
- `/api/notifications/feedback` に `action_item` handler を追加。「はい」は `action_items.review_status='confirmed'`、「いいえ」は `rejected` へ反映。
- `pwa/spec/3-7-notifications-current-spec.md`、`pwa/spec/3-10-l2-ms-progress-current-spec.md`、`pwa/manual/3-3-notifications-and-tsukuyomi.md`、`pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md`、`pwa/BUGS.md` を同期した。

### Verification / Deploy
- D-11 fallback: `v0.39.48` で本番反映。
- MS遅延 fallback: `v0.39.49` / `v0.39.50` で本番反映。202607 の再計算で `delayNotified:0`、DB read-back で `ms_schedule_delay` の残通知0件を確認。
- `action_item` feedback: `v0.39.52` で本番反映。BWE同意書提出通知はエラー復旧として confirmed + feedback + tsukuyomi learning まで反映済み。
- closeout時点の本番 baseline は後続 commit を含む `v3.39.59` / `7da9c71a` / dirty=false。上記修正 commit はすべて ancestor として含まれる。

### Closeout notes
- 3件とも既知残タスクはなし。
- ただし D-11 Media Mentions は、保存済み行の表示 fallback を直しただけで、専用 writer / review UI の完成までは別フェーズ。
- closeout時点で root checkout には別件 `pwa/src/components/admin/AdminProjectsTable.tsx` の未コミット差分が残っている。今回の通知修正 bundle には混ぜない。

---

## 2026-07-10 — 要対応キューを行単位で完了表示へ修正

### コンテキスト / 対応
- まさから、要対応の「対応済にする」を1件押すたびに全行が一瞬消えてから再表示されるUXを修正してほしいと依頼。
- `ActionItemsPanel` は対象行をその場で外し、保存成功後の全件 `load()` を廃止。通信失敗時だけ、外した行を元の順番へ戻すようにした。
- `FEATURE_REGISTRY.md`、`manual/2-3-pj-cockpit.md`、manual/spec changelog、`BUGS.md` を同期。build `v3.39.59`、`npx tsc --noEmit`、`npm run test:critical-ui`、`npm run build` を通し、本番 `v3.39.59 / 7da9c71a` を確認済み。

---

## 2026-07-10 — 先手TODO `meeting_next_action` の明示期限優先化 / v3.39.61-v3.39.62

### コンテキスト
- まさから、KUTE の先手TODOが「2026-08-04次回MTGまでに提示資料を作成」なのに、期限が `07/01 09:00` になっていると指摘。
- これは「MTGまでに提示するTODO」なので、期限は次回MTG日の `2026-08-04` が正しい。作成元MTG日から7日後を置く設計だと、本文中に明示された締切を壊す。

### 原因
- `meeting_next_action` の `due_at` が `meeting_date + 7日` の固定fallbackで決まっていた。
- action本文に `2026-08-04次回MTGまで` のような明示期限があっても、extract route 側で解析・優先する層がなかった。

### 実装 / 仕様同期
- `pwa/src/lib/proactive/meeting-action-due.ts` を追加し、`YYYY-MM-DD`, `YYYY/MM/DD`, `M/D`, `次回MTGまで`, `までに` のような期限表現を `meeting_next_action` 専用に解釈するようにした。
- `pwa/src/app/api/cron/proactive-todo-extract/route.ts` は helper 経由で `due_at` を決めるよう変更。明示期限が取れない場合だけ、従来の `meeting_date + 7日` fallback を使う。
- 回帰テスト `pwa/scripts/check_proactive_meeting_action_due.mts` と `npm run test:proactive-meeting-due` を追加。
- `pwa/spec/2-4-proactive-todo-current-spec.md`、`pwa/manual/2-6-admin-ops.md`、`pwa/scheduled-tasks/README.md`、`pwa/BUGS.md`、`/proactive` の検知説明、manual/spec changelog を同期。

### Data correction
- open な KUTE 先手TODO 2件を `due_at=2026-08-04T00:00:00+00:00` に補正。
- スクショ該当行: `a7e4f03a-de82-48ff-8748-9656cbd23771`。

### Verification / Deploy
- `npm run test:proactive-meeting-due` passed。
- `npx tsc --noEmit` passed。
- `npm run build` passed。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で `c3c92229` / `v3.39.61` を本番反映し、production `/api/build-info` で `dirty=false` を確認。
- closeout時点では別セッションの BZM commit も進み、本番は `v3.39.62 / 84e6b2f4`。`c3c92229` は ancestor として含まれる。

### Closeout notes
- 先手TODO期限bugの既知残タスクはなし。
- root checkout には別件 `pwa/src/components/admin/AdminProjectsTable.tsx` の未コミット差分が残っている。これは admin projects Slack設定レーンであり、この先手TODO closeoutには混ぜない。
- 一時clone `/tmp/amd-os-deploy-c3c92229` は登録worktreeではない。削除は明示的なcleanup承認後に行う。

---

## 2026-07-14 — SX `SolvioraX経営会議` W-Prep 起動漏れの復旧と再発防止

### コンテキスト
- まさから、2026-07-14 11:00 JST の `SolvioraX経営会議` prep thread が起動していないと報告があった。
- Calendar event は recurring の確定予定として存在し、DB row も `source_kinds='upcoming'` で作成済みだったが、`prep_worker_status` / `prep_worker_session_id` が空だった。

### 原因
- CalendarRepo_AMD_OS の正本設定には、既に `CFG_PJAlias: SolvioraX -> SX` と `CFG_ColorPJHistory: 2025-06-01+ colorId=4 -> SX` が入っていた。
- ただし W-Prep launch lane の候補抽出 prompt が、Calendar直読み時に色履歴・alias正本を必ず使う契約になっておらず、`SolvioraX経営会議` を unmapped として skip できる余地があった。

### 対応
- 当該 row を手動で claim し、`SolvioraX経営会議 prep` thread を `/Users/masa/projects/AMD/SX` target で作成・pin・DB session 保存した。
- DB readback で `prep_worker_status='ready'`、session id `019f5c0a-049a-73c0-a424-679689934c33`、prep draft 保存済みを確認した。
- `calendar-sync` の alias mirror に `p21: ["SolvioraX"]` を追加し、critical UI guard にも anchor を追加した。
- active automation `/Users/masa/.codex/automations/w-prep-launch/automation.toml` を更新し、PJ推定は `CFG_ColorPJHistory` first、`CFG_PJAlias` next、`SolvioraX` / `colorId=4` は SX/p21 と明記した。
- `pwa/spec/3-3-meeting-flow-current-spec.md`、`pwa/manual/8-3-l2-extraction-routines-spec.md`、`pwa/design/L2_DATA.md`、`pwa/scheduled-tasks/README.md`、appendix changelog、`pwa/BUGS.md` を同期した。

### Verification
- `git diff --check` passed。
- `npm --prefix /Users/masa/projects/AMD/amd-os/pwa run test:critical-ui` passed。
- `npx tsc --noEmit --pretty false` passed。
- `npm run build` passed。
- DB readback: `prep_worker_status='ready'`, `prep_draft_len=2415`。

---

## 2026-07-14 — 名刺OCR / PJ Knowledge連携とiOSタブ整理

### コンテキスト / 設計
- スマホで名刺を撮影し、OCR候補を人が確認してから複数PJへ紐づけ、保護された名刺台帳とPJ人物ナレッジへ分けて保存する導線を追加した。
- email / phone / address / 画像 / raw OCR は private 名刺台帳だけに置き、`project_knowledge` には氏名・所属・役職・接点日・短いメモだけを同期する。
- D-3定期抽出は `source='business_card'` の人確認済み行を上書きせず、自動抽出候補を別行として扱う契約にした。

### 実装
- migration 172 で `business_cards`、`business_card_project_links`、private Storage bucket、DB管理OCR promptを追加した。
- `/business-cards` と認証済みAPIを追加。OCRは `needs_review` / `ocr_failed` で止め、氏名と1件以上のPJを確認した時だけ `confirmed` とD-3人物行を同期する。
- iOSは月次ルーティンタブとマイページ上の旧誘導を撤去し、`マイページ / 立替 / PJ進捗 / 名刺 / 設定` の順へ変更した。名刺タブはナビなし `/native/business-cards` を認証cookieつきWKWebViewで開く。

### Verification
- production migration適用とschema dumpを完了。
- `npm exec tsc -- --noEmit`、対象eslint、`npm run test:critical-ui`、`npm run test:deploy-version-guard`、`npm run build` がpass。
- ブラウザで通常画面と390px幅のnative shellを確認し、HUDテーマ干渉を専用native routeへの分離で解消。console error 0件。
- iOS署名付きdevice buildがpassし、masaiPhoneへのinstall / launchを確認。

---

## 2026-07-15 — 日本文化マップを admin 内導線へ再固定

### コンテキスト
- まさから「日本文化ページは admin に移動させたはずなのに、またトップに戻ってる」と指摘。
- 関連 md を読む指示があり、`/Users/masa/projects/AGENTS.common.md`、repo/PWA の `AGENTS.md` / `CLAUDE.md`、`pwa/manual/1-1-intro.md`、`pwa/spec/1-3-reconstruction-coverage-audit.md`、`pwa/spec/2-1-pwa-runtime-routes.md`、`pwa/design/README.md` 等を確認してから着手。

### 原因
- 2026-07-09 の `1327db6b Move Japanese culture map into admin` で、ページ本体は `/admin/japanese-culture-map` へ移り、旧 `/japanese-culture-map` は redirect になっていた。
- ただし `GlobalNav` の一般「資料」グループから外しただけで、共通左サイドナビの Admin group に `日本文化 -> /admin/japanese-culture-map` が残っていた。
- そのため後続で巻き戻ったのではなく、admin 移動時点からトップ側の共通ナビ入口が残存していた。

### 対応
- `pwa/src/components/nav/GlobalNav.tsx` から `日本文化` item と未使用 `Landmark` import を削除。
- `pwa/src/components/admin/AdminSidebar.tsx` は admin 内入口として維持。
- `pwa/scripts/check_pwa_critical_ui.cjs` に、`GlobalNav.tsx` へ `日本文化` / `/admin/japanese-culture-map` / `/japanese-culture-map` が戻ったら失敗する guard を追加。
- `pwa/design/FEATURE_REGISTRY.md`、`pwa/manual/2-6-admin-ops.md`、`pwa/design/os_manual.md`、manual/spec changelog、`pwa/BUGS.md` を同期。
- `BUILD_VERSION` は `v3.40.2`。

### Verification / Deploy
- `npm run test:critical-ui` passed。
- `npx tsc --noEmit` passed。
- `npm run build` passed。
- clean deploy clone から `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を実行し、機能修正 commit `7758389a` / `v3.40.2` を本番反映。
- その後 handoff / closeout docs の main commit が積まれるため、current production SHA は固定値ではなく `https://amd-os-pwa.vercel.app/api/build-info` と `origin/main` の照合で確認する。

### Closeout notes
- 日本文化マップ nav regression の既知残タスクはなし。
- root checkout には別件 `pwa/design/atlas_routine.md` と `pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md` が残っている。今回の nav 修正には混ぜない。

---

## 2026-07-15 — Book A 組版技術検証

### コンテキスト
- Book A 出版準備ストリームKで、Ch8 を数式最重量級サンプルとして出版パイプライン検証した。
- 対象は `pwa/bzm/book-a-ch-8.md`。本文は read-only、生成物は repo 外 `/tmp/book-a-typesetting-verification-20260715/` に限定した。

### 対応
- pandoc + LuaLaTeX + `ltjsbook` + A5 指定で PDF を生成。
- pandoc `--mathml` と `--webtex` で EPUB を生成。
- Poppler で PDF を PNG レンダーし、表・主要数式・参照一覧を目視確認。
- 結果を `pwa/bzm/BOOK_A_PUBLISHING_PLAN.md` §4、`pwa/bzm/COMMANDER_TASKS.md` Stream K、`pwa/bzm/9-5-appendix-changelog.md` に記帳した。

### 結果
- A5 PDF は28ページで生成成功。大きな欠けや重なりは見えない。
- MathML EPUB は生成成功。
- webtex EPUB は生成自体は成功したが、長い日本語入りの交換効率式1本が外部画像化に失敗した。
- 総ページ見積りは480 / 520 / 550pケースを維持し、背幅は紙厚0.10〜0.11mm/枚で24〜30mm級の暫定レンジとした。

### Closeout notes
- commit `1fdbf21b docs(bzm): Book A組版技術検証ログを記録` は `main` に push 済み。
- `epubcheck` は Java 未導入のため未実施。Kindle Previewer も未検出。
- 次は高品質印刷所の見積り取得準備、ISBN/JAN申請情報整理、Kindle/epubcheck確認、長い数式の折り返しと図版実画像差し替え。

---

## 2026-07-16 — Book A 図版インベントリ closeout

### コンテキスト
- Book A の図版制作を切る前に、第1〜10章の本文プレースホルダと第11〜16章のマスタープラン見込みを統合して、制作単位を棚卸しした。

### 対応
- `pwa/bzm/BOOK_A_FIGURE_INVENTORY.md` を新設し、総41点 (確定30点 / 見込み11点) を制作方式・優先度・状態つきで整理した。
- `pwa/bzm/COMMANDER_TASKS.md` Stream G を「図リスト完成、次は実制作フェーズ」へ更新した。
- Handoff / session migration prompt を、組版検証中心から図版インベントリ closeout 中心へ更新した。

### Closeout notes
- 図版インベントリ commit `2b56d19d docs: Book A 図版インベントリ作成` は `main` に push 済み。
- 次は、まさ判断で図版制作ワーカーを切る。制作時は図1-3の16章整合と、図10-2/図10-1の登場順を確認する。
- root checkout には unrelated dirty が残っているため、Book A closeout には混ぜない。

---

## 2026-07-16 (夜) — Book A 司令塔セッション: Codex 切り出しの量産 + Ch4+Ch5 統合裁定

### コンテキスト
- Book A 出版準備の司令塔セッションとして、fable トークン節約のため Codex CLI へ切り出せるタスクを量産した。
- 並行して、Ch4+Ch5 統合の司令塔裁定を確定 (16→15章化)、Codex に機械実装を委譲した。

### 対応 (時系列)
- **Codex 完了報告の裏取り (`1fdbf21b` 組版検証)**: `BOOK_A_PUBLISHING_PLAN.md` §4・§8、`COMMANDER_TASKS.md`、`9-5-appendix-changelog.md` を Read し数値・記述の一致を機械的に検証。差分ゼロで確定。
- **Codex 切り出し migration prompt 3件を並列作成 (Agent 委譲)**:
  - `2026-07-15_codex_handoff_typesetting_verification_round2.md` (組版技術検証 round2、`a6aff30d`)
  - `2026-07-15_codex_handoff_publishing_documents_draft.md` (印刷所見積り依頼・ISBN/JAN 情報整理、`8cd12e20`)
  - `2026-07-15_codex_handoff_figure_inventory.md` (図版インベントリ生成、`4d464ea2` → Codex 実行完了で `2b56d19d`)
- **Ch4+Ch5 統合の司令塔裁定確定**: まさが分量・授業運用の障害を両方棄却済みのため、追加確認なしに司令塔判断で統合確定。migration prompt を作成し Codex へ委譲 (`55cb0669` → Codex 実行で `93bb3d41`/`fcc396cf`/`e33afd97`)。実装内容の裏取り (MASTER_PLAN §2 v3 記載・§9 統合章行・STORY_WORLD §2.1 視点表・命名台帳磐井/湊繰り上げ・本文章番号前方参照置換) を全て機械検証。
- **Codex 完了報告2件目の裏取り (図版インベントリ `2b56d19d`)**: `BOOK_A_FIGURE_INVENTORY.md` 全72行 Read、41点集計・matplotlib 16/SVG 25/優先度高14の集計一致・「制作時の注意」欄に自動記録された図1-3「15回」表記/図10-2順序問題を発見。
- **Codex 切り出し migration prompt 追加5件を並列作成**:
  - `2026-07-16_codex_handoff_ch4_ch5_merger_mechanical.md` (`55cb0669`)
  - `2026-07-16_codex_handoff_figures_matplotlib_batch1.md` (`c9c241c3`)
  - `2026-07-16_codex_handoff_figures_svg_pilot.md` (SVG 手描き試験投入、図1-2 三項構造マップ、`9110a44e`)
  - `2026-07-16_codex_handoff_figures_matplotlib_batch2.md` (残り12点、`e8a9736f`)
  - `2026-07-16_codex_handoff_ch_number_secondary_sweep.md` (統合の二次掃討、`7f4f98cd`)
- **まさ実行判断報告**: 出版実務2件 (組版検証 round2・対外文書ドラフト) は「まだ早い」で保留。図版インベントリ (`4d464ea2`) は Codex に投げ完了。追加3件 (SVG pilot・matplotlib 第2弾・章番号二次掃討) はまさが Codex 起動済み。

### 結果
- Codex 切り出し migration prompt 総数 8件、うち完了3件 (組版検証・図版インベントリ・Ch4+Ch5 統合)、進行中3件 (SVG pilot・matplotlib 第2弾・章番号二次掃討)、保留2件 (組版検証 round2・対外文書ドラフト、まさ判断で "まだ早い")。
- Book A は 16→15章化完了。統合章 slug `book-a-ch-4-5`、統合章タイトルは「【統合章タイトル未確定】」のプレースホルダ。
- 図版制作は matplotlib 第1弾 (4点) が Codex 起動待ち、SVG 試験投入 (1点) が Codex 起動待ち、他は前提待ち。
- 副産物として、Ch1 本文の「15回/15章」表記は 16→15章化により自動的に正しい表記に戻るため、追加の本文修正は不要と判定 (統合 migration prompt §7 に明記)。

### Closeout notes
- root checkout には unrelated dirty が残る (`pwa/design/atlas_routine.md` = D-8 Atlas レーン、`pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` = 別レーン、`pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md` = 自セッション前の巻頭凡例下書き WIP)。次セッションはこれらを絶対に touch しない。
- 巻頭凡例下書き (`2026-07-14_frontmatter_gairei_draft_v1.md`) の残タスク=まさ確認2点 (「狂言回し」語の採否・柏木を全16話 [現在は全15話] の主人公と明言するか) は継続保留。
- 統合章の正式タイトル確定・本文の物理マージ (v2 Ch4案「この数字を疑うのは、やめます」+ v1 Ch5移転実験案の再編集) は fable 領域として次セッションで扱う。
- 「fable トークンがもうなくなりそう」というまさ制約は継続。opus 以下でできること・codex sol でできることを優先的に切り出す方針を継続。

---

## 2026-07-16 — Admin 裏wikiを人物文脈6項目へ更新

### コンテキスト
- まさから `/admin/private-wiki` に「誕生日」「出身地」「居住地」「接点」「家族」「タブー」を追加し、代わりに `tags` を削除してよいと依頼。
- 指示どおり `/Users/masa/projects/AGENTS.common.md` から読み、repo/PWA rules、manual/spec/design/db_schema/current route を確認してから着手した。

### 対応
- migration `173_private_wiki_person_context_fields.sql` を追加し、`private_wiki_entries` に `birthday_label` / `origin_label` / `residence_label` / `contact_context` / `family_note` / `taboo_note` を追加した。
- `/api/admin/private-wiki` の payload / row mapping を新6項目へ更新し、`tags` normalize、`tag` query、`contains("tags")` filter を撤去した。
- `AdminPrivateWikiClient` の編集フォーム、検索、一覧表示を新6項目へ更新し、tag filter / tag chip / tags input を削除した。
- `manual/2-6-admin-ops.md`、`spec/2-1-pwa-runtime-routes.md`、`design/SPEC_pwa.md`、`design/FEATURE_REGISTRY.md`、`design/db_schema.md`、manual/spec changelog を同期した。
- `check_pwa_critical_ui.cjs` に新6項目の存在と `tags` 導線復活禁止の guard を追加した。

### Verification / Deploy
- production DBへ migration 173 適用済み。
- `dump_schema.py` で `db_schema.md` を再生成。
- `npm run test:critical-ui`、対象eslint、`npm run build` がpass。
- clean disposable cloneから `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を実行し、`v3.41.15` / commit `0d0cf4a0` の本番反映を確認した。
- その後、別件 score fix `v3.41.16` / `692db89b` が本番currentになったが、`0d0cf4a0` は ancestor として含まれる。
- 未ログインで `/api/admin/private-wiki` が `401 Unauthorized` を返すことを確認。ログイン済みadminでの手操作smokeは未実施。

### Closeout notes
- private wiki の未解決実装タスクはなし。
- optional next: まさログイン状態で本番 `/admin/private-wiki` を開き、dummy entryで新6項目の保存・再表示・archiveを確認する。
- 旧 `tags` 列は互換のためDBに残すだけ。UI/APIの入力・検索フィルタ・必須アンカーとして戻さない。

---

## 2026-07-16 — KENQ AMD Score detailをPJ cockpitへ統合

### コンテキスト / 判断
- まさから、`R_net / BRL / GRLは抑えめにした`という説明は「えいみの匙加減で抑えられる設計ではない」と指摘があった。
- 続けて、分かる範囲でXRL checkboxを付け、R_net用dataを収集してscoringし、確認画面をcockpitのscore detailへmergeする依頼があった。
- 途中の`p27`指定は言い間違い。対象はKENQの`p29`。
- standalone score detailとcockpit score detailの二重面は混乱を生むため、通常PJはcockpitを正規面とし、`p99` demoだけstandaloneを維持する判断にした。

### 実装 / 仕様同期
- `amdScoreDetailHref()`を追加し、list / retrofit / cyberspace / HUD / cockpit内modalの通常PJ導線を`/project/{projectId}/cockpit?tab=score-detail`へ統一した。
- 旧`/venture-map/amd-score/[projectId]`は通常PJをcockpitへredirectし、`p99`だけ従来pageをrenderする。
- `CockpitView`をcontrolled tab対応にし、URL queryと`スコア詳細`selected stateを同期した。
- `AmdScoreView embedded`にPRS primary、`R_net` evidence、M/X/F、FRL、XRL checklistを集約した。
- manual 2-3 / 3-1 / 4-3 / 4-4 / 5-2、spec 2-1 / 3-8 / 4-2、design `FEATURE_REGISTRY` / `SPEC_pwa` / `amd_score` / `cockpit`、iOS DESIGN、critical UI、changelogを同期した。

### Productionで見つけた分岐漏れ / responsive不具合
- 初回統合ではembedded早期returnによりXRL checklistが欠けたため、同分岐内へ明示配置し`v3.41.11`で修正した。
- FRLの固定列、PRS/XRL SVGの600px最低幅、factor gridのintrinsic min-width、M/X/F tableの441px内容幅を順に本番実測で検出した。
- `v3.41.12`から`v3.41.16`で、compact FRL、responsive chart scroll、`min-width:0`、factor tableのcard内scrollを追加した。
- 詳細な症状/原因/再発防止は`pwa/BUGS.md`へ記録した。

### Verification / Deploy
- `npm run test:critical-ui`、`npx tsc --noEmit`、対象eslint、`npm run build`がpass。
- feature commits: `1bb11009`, `cb34d085`, `6f679106`, `1d6ac74f`, `fe920eb9`, `692db89b`。
- clean disposable cloneからofficial deploy scriptを実行し、最終機能版`v3.41.16 / 692db89b`をproductionへ反映した。
- production desktopはviewport/documentとも1586px、mobileはviewport/documentとも390px。score tab selected、XRL checklist 18項目、mobile tab 44pxを確認した。
- closeout時点のlive dataは`PRS 86 / P=7 / R=12 / S=568 / R_net=3 / checked 5`。途中の`PRS 215 / R=30 / checked 4`からlive data更新があり、UIコードの恣意的な抑制ではない。

### Closeout notes
- cockpit統合とresponsive修正の既知残タスクはなし。
- score値はlive dataで変動するため、次回はproduction/API/DBを読み直す。会話中の数値を固定値としてhandoffしない。
- root checkoutのAtlas / L6 / H-1 reviewer / Book A dirtyは別owner laneであり、今回bundleには混ぜない。

---

## 2026-07-16 — 月初合意の合意事項を独立した01・02へ再設計

### コンテキスト / 判断
- 最初の改善で状態の主語と確認順は直ったが、合意事項1・2を10pxの列ラベルとして扱ったため、初見で場所を発見できなかった。
- まさの再指摘を受け、申込・振込などの確認手続きと同じく、必須事項を独立した手続きステップとして見せる方針へ変更した。
- Solが縦長になるコストを受け入れて発見可能性を優先する設計を確定し、Sonnet workerが実装、司令塔が統合とproduction検証を担当した。

### 実装 / 仕様同期
- `MonthlyAgreementExperience` を、状態→`01 担当する仕事`→`02 その対価としての予定額`→主操作→参考情報の順へ再構成した。
- 01は全PJの担当内容、02は予定額合計と同じPJ順の内訳を表示する。PJ別2列表は廃止した。
- 必須領域の文字サイズ下限を12pxとし、番号14px、見出し18/20px、担当内容14px、PJ別予定額16px、合計26/28pxへ固定した。
- mobile主操作を全幅48pxにし、長いPJ名は省略せず折り返す。
- spec 3-14、manual 2-2 / 6-6、FEATURE_REGISTRY、BUGS、manual/spec changelog、critical UI guardを同じbundleで同期した。
- BUGSには、存在確認・DOM順・横overflowだけをUX完了条件にして、5秒理解・縮小表示・文字サイズ序列を見なかった失敗を記録した。

### Verification / Deploy
- `node pwa/scripts/check_pwa_critical_ui.cjs` と `npm --prefix pwa run build` がpass。
- commit `8b014291 fix(pwa): make monthly agreement items unmistakable` をmainへpushし、production `v3.43.8 / 8b014291 / dirty=false` を確認した。
- productionを320 / 375 / 768 / 1280pxで実測し、全幅でdocument横overflowなし。必須領域のcomputed font-size最小12px、DOM順も仕様どおりだった。
- まさがproduction画面を確認し、分かりやすくなったと受入確認した。

### Closeout notes
- 月初合意UI・仕様同期・deploy・responsive検証の必須残タスクはなし。
- 今回作ったdisposable clean cloneと完了済みSonnet workerはcloseoutで削除・終了した。
- main-alignedの古いClaude worktree 1つとbranch 1本は証跡保存後に削除し、root worktree / main branchだけへ戻した。
- root checkoutのBook A / Atlas / L6 / H-1 dirtyは別owner laneであり、月初合意bundleへ混ぜない。

## 2026-07-17 — Book A 第13章 (CEOという難問) 理論パート起草 (Ch13 理論ワーカー、fable)

- **成果**: `pwa/bzm/book-a-ch-13-5.md` 新規 — 理論パート 13.1〜13.8 + 読書案内 (約11,700字、である調)。13.0 章頭は別プロセス委譲のプレースホルダ。commit `f513f376` → push → Vercel 本番反映確認済み (v3.44.1、/api/build-info で観測)。
- **中心命題 v2 まさ確定** (補正2点: 重心 = 機能分解による開放 [CxO 肩書で完全体を探さない、URA の期限付き一時預かりまで開く] / 「外注できない」= 市場から調達できない [発明者限定にしない、担い手はシーズの来歴の中]) → NARRATIVE_DESIGN §8 台帳へ反映。
- **経過**: 起票 (章頭+理論の対話モード) → まさ中心命題確定 → 章頭3案骨格提示にまさプロセスFB「短い説明では比較しきれない。毎回適当に回答してる」→ えいみ確定+本文稿提示方式へ切替、章頭 v1「体制図の夜」起草 → 司令塔軌道修正 (理論パートのみ・章頭は別プロセス) → 司令塔追加指示 (kaku 点検必須 / 質問せず書き切り commit まで) → 理論パート起草・push。
- **判断 (事後報告済み)**: 出力先を指示の book-a-ch-13.md から book-a-ch-13-5.md へ修正 (book-a-ch-13 slug は第12章 RT に割当済み — 台帳記帳と bzm-chapters.ts 現物に従う。Ch12 ワーカーとのファイル衝突回避)。13.6 は章頭 specifics 非依存で自立。EP-003 は章頭専用に温存し理論内で二重使用せず。
- **git 経路**: 本体 checkout が他レーン dirty で ff 不能 → 自 worktree を origin/main へ detach → rebase (Ch14 ワーカー push とのレース解消) → `push origin HEAD:main`。branch 新規作成なし。本体の自変更は掃除済み。
- **残**: まさの本文レビュー / 章頭 13.0 の白紙構想 (別プロセス、v1 参考稿 = `2026-07-16_narrative_rebuild_ch13_v1.md` §2)。詳細は 9-5 附則の 2026-07-17 Ch13 行。


---

## 2026-07-17 — Book A 第12章 (ラウンドテーブル) 理論パート v1 起草 (Ch12 ワーカー)

### コンテキスト / 判断
- spawn_task 起票の Ch12 担当 fable セッション。当初スコープは白紙構想+本文起草の対話モードだったが、司令塔の軌道修正2回 (①章頭ナラティブは書かない・理論パートのみ ②書き終えるまでまさへ質問しない = ノンストップ) を受け、理論パート 12.1〜12.8 を書き切った。
- 着手前の章頭白紙構想で、中心命題の A/B/C 3案からまさが C案を確定 —「RTとは、署名を集める協定ではなく、退路を断ったコミットが連鎖し続ける共同体である」(点火 = MASTER_PLAN §9 側と、連鎖し続ける = NARRATIVE_DESIGN §8 v2 側の統合)。「連鎖し続ける」は理論側 12.3 の自動降格条項に実装した (「円卓は、組成の瞬間の達成ではなく、保たれ続けている状態である」)。
- push 直前 fetch で統合章 v4 (M×R 化・P の Ch3 移管、`b0875c08`) を検知し、P 証拠の質の参照を「統合章前半」→「第3章」へ3箇所追随してから push。push 直前 fetch ルールが機能した実例。
- XRL 軸名は本文正本 (Ch8・統合章 = TRL/BRL/GRL/SRL/HRL) 準拠と判断。MASTER_PLAN §3/§9 Ch4 行の「TRL, IRL, CRL, LRL, ORL」は旧表記の残存で、RT の CRL (Coalition Readiness Level) と正面衝突するため司令塔ゲートへ申し送り。

### 実装 / 仕様同期
- `pwa/bzm/book-a-ch-12.md` 新規 (理論パート約17,500字、12.0 は別セッション委譲のプレースホルダ)。12.1 定義 ℛ=(d*,𝒩,𝒦,𝒳,Γ)・二層経済・keystone の啓発的利己 (was 5系譜) / 12.2 成立3条件の機構と❌線引き表12-1 / 12.3 CRL 六段階 / 12.4 ICT 五指標 (ECR 合算禁止・コールドスタート注記) / 12.5 q=Q_commit/Q* / 12.6 take-or-pay 三分割 (実現前コミットの R_net 計上禁止) / Box 12-A 二重計上ガード / 12.7 Ψ_j=Ψ̄+β·ICT_j+ε (検証プログラム付き仮説と明記 = D-056、三項構造完成、Ch1 1.4 の約束回収、道具の三身分) / Box 12-B 独禁 (D-058 必置) / 12.8 演習3本+90分運用例+到達目標+読書案内。
- `pwa/bzm/2026-07-16_narrative_rebuild_ch12_v1.md` = 章頭白紙構想 v1 (場面3案+本命「空席の円卓」本文稿約2,900字、中心命題C案まさ確定の記録)。司令塔の軌道修正によりスコープ外参考保存。
- 9-5 附則へ1行追記。kaku 点検 (話題テスト・漏出テスト・緊張台帳・拍・境界) 通過、鬼門/validation 語彙/LLM 空句/運用数値 (n₀・Δ) の grep ゼロ確認。

### Verification / Deploy
- commit `820d17c0` を main へ push (Ch13 の push と1分差で交差し rebase 1回、conflict なし)。push 後に origin 版と手元ファイルの同一性を diff で確認済み。
- main checkout は他レーン dirty 3件 (pwa/design/README.md・pwa/manual/9-3・pwa/spec/6-1、いずれも origin と実差分あり = 進行中作業) が pull を塞いでいたため、disposable clean clone 経由で push (AGENTS.common 正規手段)。clone は削除済み。

### Closeout notes
- このセッションで作った branch/worktree: none (spawn 時の自動 worktree のみ、そこへの commit なし。編集は main checkout への絶対パスで実施)。
- main checkout に ch12 の2ファイルが origin 同一の untracked として残置 (まさ確認用。pull 時に上書き衝突が出たら削除で無害 — 同一性検証済み)。ch14 提案 md の untracked 残骸 (origin 同一確認済み) は削除した。
- 司令塔へ完了報告済み (自己判断8件 + 正本不整合の申し送り)。**残る司令塔ゲート案件**: ①MASTER_PLAN の XRL 旧表記4箇所 (§3 Ch4 行 + §9 Ch4 の therefore/数式アイテム/演習3 — RT の CRL と衝突、修復 commit `dc86fe73` のスコープ外で残存) ②MASTER_PLAN §5 場面台帳の章番号が旧16章制のまま (「Ch 13 二社目が来ない円卓」等) ③NARRATIVE_DESIGN §8 Ch12 行の中心命題を C案確定版へ差し替え。
- 次: まさの理論パート本文確認 → 修正対応。章頭ナラティブ (12.0) は別セッションで執筆 (白紙構想 v1 が素材)。引き継ぎ = `pwa/bzm/2026-07-17_ch12_worker_handoff.md`。
## 2026-07-17 Book A 第11章 (二層非可換性) 理論パート v1 起草 (Ch11 worker)

- **成果**: `pwa/bzm/book-a-ch-11.md` 新規 — `8fbf693` (理論パート 11.1〜11.7、約13,300字) + `edad4bb` (11.0 プレースホルダ、Ch12 と同形式)。公理 A1-A4 + 二層非可換性定理 + 三方向崩壊の証明スケッチ + Simpson 反転 worked example (架空データ・検算済み) + UI 禁止則 (Box 11-A 反対意見書の型) + Goodhart 回避の機関 KPI 3条件 + 演習3本。第3章 3.6 と第9章 10.6 が張っていた前方参照の釘 2 件を回収。
- **理論判断**: A1 の min に M を含めない (min(P,R,S)。無風は案件を遅くするが殺さない = 第5章自走型と整合)。SPS=M×P×R×S 4因子・統合章 v4 (P=第3章オーナー) を前方参照に反映。モノグラフ skeleton `CHAPTER_10_4_SKELETON.json` 準拠。
- **スコープ**: 司令塔軌道修正 (まさ元指示 = 理論パートのみ、セクションごとにセッション) により、章頭ナラティブ 11.0・討議課題A・連作免責注記・柏木編み込みは別プロセスへ委譲。**まさ承認待ち**。
- **申し送り**: bzm-chapters.ts の slug 系列 (旧番号) と新章ファイル名 (新番号) の再マッピングが必要 (司令塔報告済み)。9-5-appendix-changelog への行追記はまさ承認後 (root の同ファイルが他レーン staged のため clean clone 経由で)。
- 詳細・意思決定ログ・次セッション migration prompt = `pwa/bzm/2026-07-17_ch11_theory_v1_closeout.md`
