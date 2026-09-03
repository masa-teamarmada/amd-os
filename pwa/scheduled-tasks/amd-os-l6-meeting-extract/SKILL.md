---
name: amd-os-l6-meeting-extract
description: AMD OS H-1 MTGサマリ + MTGフローの repo 正本。現行 writer は Windows MMO PC の Codex Desktop automation `amd-os-l6-meeting-flow` (= 毎日09:00-21:00毎時 + 候補判定後の早期exit)。Calendar/Notion/Gmail/Drive/Slack を読み、subscription 内 Codex で narrative_md + summary arrays を抽出して `project_meeting_summaries` に保存し、該当 Notion 議事録ページの eventId / PJ relation / member relation も安全に補完する。PWA/GAS/Vercel に token課金LLM cron は作らず、GAS 153 + 074 + 074b-e の業務ロジックだけを移植する。
---

# AMD OS H-1 MTG サマリ抽出 (GAS 153 + 074 移植版)

GAS 153 `nav_meeting_pollRecentlyEndedEvents` + GAS 074 `nav_meeting_processOneEvent_` の Phase 3 ロジックを **Windows MMO Codex Desktop automation** に移植したもの。GAS は完全 bypass (= kill switch のまま死んでて OK、参照すらしない)。

## 最優先: 毎時runの候補gateと所要時間

H-1は「毎時すべての知識を読み直す」仕事ではない。開始後に最小限のenvを読み、Calendarの `now-4h` から `now+24h` のbounded取得と、DBの直近24時間 `none` marker・近傍upcoming cardの状態だけを一度ずつ確認する。まず次の3種類を判定する。

1. 終了60-180分前の確定Calendar MTG
2. 直近24時間の `none` / `議事録なし` recovery row
3. 現在前後24時間のうち、newまたはCalendar metadataが変化した確定upcoming card
4. 議事録欠損台帳 (`candidates.backlog`) が出した、抽出窓を外した会議の拾い直し

4種類がすべて0件なら、H-1は対象なしのsanitized report・automation memoryだけを確定して終了する。**対象なし・変更なしではOS通知を作らない。** Notion / Gmail / Drive / Slackの本文取得、Drive folder探索、広い正本読込、git status、fixture test、browser、prep thread操作を実行してはいけない。通常3分以内に終える。

候補が1件でもある時だけ、後続の正本とその候補に必要なsourceを読む。開催済みMTGは5 source確認を省略しないが、関係のないPJ・期間・sourceを探索しない。通常は対象1件あたり12分以内を目安とし、取得不能なsourceは `review_required` と不足理由を残して次の対象へ進む。これは対象件数の上限ではなく、待機・無制限retry・無関係探索を禁止する時間設計である。

## 設計の要点 (2026-05-25 まさ #71 確定)

- **GAS 完全 bypass**: 旧 dryRun 経由は廃止。Calendar / Notion / Gmail / Drive / Slack へは MCP で直接 access
- **LLM 呼びは subscription 内 Codex automation**: Anthropic SDK 不要、Codex Desktop automation 内で JSON 生成
- **追加課金ゼロ境界**: PWA / GAS / Vercel から Anthropic・Gemini・OpenAI の従量課金 API を呼ばない。LLM を使うのはこの MMO Codex Desktop automation 内だけ。
- **token 課金LLM cron 禁止**: routine trigger は allowed path。PWA / GAS / Vercel の cron / time trigger は、LLM 非依存の deterministic sync / 通知 / キャッシュ更新なら問題なし。この H-1では Gemini 経路の 153 / 152 を復活させない。
- **業務ロジックは GAS 元コード完全保存**: 「終了 60-180 分前 filter」「Stage 1-3 Notion fallback」「source_kinds 判定 (= 30 chars 閾値)」「source_hash 差分検知」「修正依頼織り込み」「議事録なし行のマーカー upsert」を踏襲
- **5 ソース全部見る** (= まさ絶対ルール 2026-05-11): Notion + Gmail + Drive + Slack + Calendar event 本文。GAS 074 + 074b-e の集約をこの 1 routine で実現
- **議事録品質の本丸**: Notion / Gemini / CircleBack 等が既に作った会議本文を潰さず、前後 MTG・PJ 全体の流れ・現行 MS を読んだうえで `narrative_md` に「その MTG に参加していなかったメンバーでも読めば流れが分かる議事録」を残す。
- **議事録本文の固定順**: `narrative_md` は必ず `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の順で書く。見出し文言・絵文字・順序を変えない。背景と経緯は段落、決まったこと・次の一手・残課題は1項目1論点の Markdown 箇条書きで書く。
- **配列だけ保存禁止 / 単純な箇条書きだけ禁止**: `source_kinds != "none"` の開催済みMTGでは `narrative_md` が主成果物。`summary_short` / `decided` / `progress` / `next_actions` / `risks` は検索・通知用の補助であり、議事録本文の代替ではない。`narrative_md` が空・短すぎる・背景と経緯の段落を欠く場合、その event は保存せず run summary に `blocked_low_quality_narrative` として残す。
- **既存 narrative 保護**: 既存 row に 300字以上の `narrative_md` がある場合、新しい抽出結果が空 / 5見出しのセクション構造を満たさない / 既存より明らかに薄いなら upsert しない。`project_meeting_summaries` には DB trigger でも保護があるが、routine 側でも必ず判定する。
- **H-1 reviewer hook**: 開催済みMTGを保存した後、別automation `amd-os-l6-meeting-reviewer` を走らせる。raw Notion/Gmail/Drive/Slack/Calendar と保存済みH-1要約を比べ、CEO/代表/VC/地元勢/PoC/PRなど重大な経営判断が薄く丸まった疑いがあれば `l2_coverage_gaps` + `l2_notifications(l2_kind='coverage_gap')` に出す。reviewer は H-1 row を自動上書きしない。
- **直近予定カード**: H-1 は毎時動くため、毎回60日先まで見ない。終了済みMTGの議事録抽出と、現在時刻の前後24時間にあるnew/変更済みの確定Calendar予定カードだけを扱う。future cardの広い照合・visible prep thread起動・prep ready判定は W-Prep の責務であり、H-1は実行しない。
- **MTGカード→Calendar一次防御**: MTGカード/議事録側に日時・場所・対面/オンライン・持参物・返信/宿題があるのに Calendar event が無い/薄いケースは、`POST /api/meeting-calendar/upsert-plan` の dry-run で upsert payload と duplicate match を作る。PWA route は Calendar を書かない。実writeに進む場合は別途 reviewed write bundle が必要。payload は `sendUpdates=none`、外部 attendees は空、metadata は `extendedProperties.private` に寄せる。
- **TODO→tasks + owner nudge**: MTGから生まれた担当タスク / OS task / Gmail TODO / Slack TODO は、まず `POST /api/task-calendar/register-tasks` で `tasks` に自動登録し、担当者本人だけへ Slack DM nudge する。admin review queue は作らない。作業枠が必要な場合だけ `POST /api/task-calendar/schedule-plan` の dry-run で、担当メンバー + まさ の共通空き枠に `+<PJコード> <task>` 枠を作る候補にする。PWA route は Calendar を書かない。外部招待/メール送信はしない。
- **次MTGカードの境界**: 議事録内に日時まで明確な次MTGがある場合だけ、PWA `POST /api/meeting-workflow/finalize` 経由で `source_kinds='upcoming'` を作る。`6月3週目以降` のような日程未確定候補は自動で確定予定にしない。必要なものは `upcoming_tentative` として「日程調整中MTG」に残す。
- **Notion 議事録メタデータは MMO 側で埋める**: Calendar event から Notion 議事録ページを見つけたら、MMO automation は可能な範囲で Notion page の `eventId` / 相当プロパティに Calendar event id を追記し、空の `PJ` relation と member relation (`NOTION_MINUTES_MEMBER_PROP`。現行DBでは `メンバー` / `参加メンバー` 相当) も補完する。これは次回以降の冪等性、PJ別抽出、参加者文脈のためで、PWA/GAS 側ではなく L6 writer 側の責務。
- **Notion relation 補完は空欄/追加だけ**: 既存の `PJ` relation を別PJへ上書きしない。参加メンバー relation は既存値を消さず、Calendar attendees / organizer と AMD members を高信頼に照合できた member だけ union 追加する。PJ不一致、候補複数、Notion member page 未解決、外部参加者だけの場合は patch せず `review_required` / `notion_relation_backfill_skipped_*` に残す。
- **eventId 欠損で弾かない**: Notion page に `eventId` が無いのは欠落インシデントとして記録しつつ、必ず title + event date + attendees + Gemini/Drive/Gmail URL で fallback 検索する。`eventId` が無いことだけを理由に `source_kinds='none'` や `skip_no_notion_event_id` にしない。
- **Notion 再認証待ち禁止**: Notion connector が `UNAUTHORIZED oauth_token_invalid_grant` / `TRIGGER_REAUTHENTICATION` を返しても、H-1 は止まらない。Chrome / local fallback と Gmail / Drive / Slack / Calendar / AMD OS artifact を同一ターンで読み、十分な会議本文があれば Notion なしで開催済み row を作る。詳細は `pwa/design/h1_source_auth_fallback.md`。
- **Local Notion 自動 fallback**: Notion connector auth failure 時は、手動でDBを直さず、必ず `npm run h1:local-notion-fallback -- --title "<event title>" --date "<YYYY-MM-DD>" --event-id "<calendar_event_id>"` を実行する。hit したら `source_kind='notion-local'` の Notion source として扱い、`notion_page_id` / `notion_url` / `source_hash` を使って通常の H-1 narrative 抽出に進む。
- **欠損台帳の拾い直し**: gate の `candidates.backlog` は、抽出窓を外したまま議事録が作られなかった会議である。24時間の壁は無く、確定版の行が1行も無い会議も入る。通常の開催済みMTGと同じ5 source確認・同じ品質gateで処理する。本文が取れなければ `source_kinds='none'` のマーカー行を作らず、**何も保存せずに次へ進む**。台帳側は次の run が「候補として出したのにまだ確定版が無い」ことを観測して試行回数を増やすので、こちらから台帳を更新しない。`attempt_count` が上限に達した会議は gate が候補から外す。
- **直近 none row recovery**: H-1 が過去 run で `source_kinds='none'` / `summary_short='議事録なし'` を入れた開催済みMTGは、次回以降 24 時間は再探索対象に戻す。対象時間窓外でも、Calendar event id / title / meeting_start_at が残っていれば Local Notion fallback と Gmail / Drive / Slack / Calendar を再実行し、本文が取れたら `none` を `notion-local+calendar` 等へ更新する。
- **held-source preflight guard**: Calendar event に Gemini/Google Meet notes Doc 添付、Notion fallback hit、Gmail Gemini notes / follow-up がある場合は、既存 `upcoming:<event_id>` があっても開催済み `meeting_id=<event_id>` 候補へ進む。fixture guard は `npm run test:l6-held-source-guard`。これは外部サービスや DB に触らない deterministic test で、飯野さんケース相当 (`Calendar添付Geminiメモ + Notion eventId空 + report_emails空`) を落とさないことを検査する。

## ユーザー向け報告の書き方

- 報告は、コーディングが一切分からない高校生でも理解できる日本語で書く。
- 無駄なアルファベット、コード名、DB列名、英語の状態名をユーザー向け報告に出さない。必要な場合だけ、日本語の説明を先に書き、括弧内に短く補足する。例: `DB` ではなく「保存先」、`cron` ではなく「定期実行」、`source_hash` ではなく「取得元が同じかの確認」。
- Notion / Calendar / Drive / Slack / Gmail は、必要なら「ノーション」「カレンダー」「ドライブ」「スラック」「メール」と書き、サービス名の羅列だけで説明を終えない。
- 報告の最初に、H-1 が今回やるべき仕事を1-3行で説明してから結果を書く。固定の意味は「終わった会議の議事録化」「直近の議事録なし再確認」「前後24時間の予定カード同期」「ノーション議事録メタデータ補完」。今回実行しなかった仕事があれば「今回は対象なし」と明記する。
- 件数だけの報告は禁止。`6件確認`、`1件保存`、`0件要確認` のような数を出したら、その直後に必ず内訳リストを出す。H-1 の対象範囲は小さいため、原則すべて列挙する。
- 内訳リストは、会議タイトル、日付/時刻、PJ名またはPJコード、今回の扱いを 1 行で書く。例: `- ZeMA 定例MTG（7/15 09:00、ZeMA）: 予定カードを確認、変更なし`。URL、会議ID、パスコード、添付ファイル名の機微情報、raw本文は出さない。
- 開催済みMTGは「確認した開催済みMTG」、直近の議事録なし再確認は「再確認した議事録なしMTG」、予定カード同期は「同期した予定カード」、Notion 補完は「ノーションを補完したMTG」、要確認は「要確認になったMTG」の見出しで分ける。該当が無い見出しは `なし` と書いてよい。
- `確認件数` / `保存件数` / `更新件数` / `維持件数` / `見送り件数` / `予定カード同期件数` / `ノーション補完件数` / `要確認件数` / `復旧対象件数` を出す場合、対応するリスト無しの報告は不合格として書き直す。
- Notion が取れていない場合でも、対象MTGが無い / 対象MTGが抽出窓外 / 予定カード同期だけのrunなら、報告全体を「不完全」とは書かない。Notion欠落が会議本文の抽出・保存・レビュー判断に影響した場合だけ、該当MTGの説明の先頭に「ノーションが取れていないので、この報告は不完全」と明記する。代替sourceだけで会議本文を判断したrunを「問題なし」「かなり良い」「正常」と表現しない。
- raw 本文や個人情報は出さない。ただし、何が取れて何が取れていないかは、日本語で具体的に書く。

## OS通知と Codex スレッド表示の扱い

H-1 は毎時起動する。sanitized reportとautomation memoryは毎回残すが、まさの判断や操作を必要とするOS通知 (`app_notifications`) は、まさが実際に確認・判断すべき時だけ作る。日次まとめスレッドは控えの記録であり、H-1本体は作らない。

- OS通知を作るのは、人の判断が必要な `review_required`、必要な処理が止まった `blocked` のいずれかだけ。会議記録・予定カード・ノーションひも付けを新規保存または更新しただけ (`updated`) は、まさの判断や操作が不要なのでOS通知を作らない。既存カードの確認だけ、候補なし、変更なしでも同様にOS通知を作らない。`updated` を含むどの結果でも sanitized reportとautomation memoryへの保存は毎回必ず行う。
- 通知する場合は `cd /Users/masa/projects/AMD/amd-os/pwa && npm run notify:h1-report -- --outcome "<review_required|blocked>" --run-key "<JST日時またはrun id>" --body-file <sanitized_report_file>` を使う。helperは結果区分なしの送信を拒否し、本文の最初へH-1の役割と今回見るべきことを加える。`--outcome updated` を渡しても helper はOS通知を書かず成功終了する（誤った旧呼び出し・将来の呼び出しからの実装ガード。呼び出し側の完了処理は失敗にならない）。
- 通知の `kind` は `h1_report`、`source` は `h1_meeting_flow`、`link` は `/notifications`。raw議事録本文、Notion本文、個人情報、secret、Drive URL、Calendar URL、会議参加URLを本文に含めると helper が失敗するので、必ず報告文を作ってから渡す。
- OS通知が必要な結果で送信に失敗した場合は成功扱いにしない。失敗理由を最終報告とautomation memoryに残す。対象なし・変更なしで通知しないことは失敗ではない。

Codex 側の日次集約は H-1本体から分離し、**毎時45分の H-1 reviewer だけが担当する**。毎時runの並行実行は仕様として維持し、前runを待つ・実行ロックを取る・別runを理由にskipすることは禁止する。

`H1_BACKGROUND_RUNNER=1` の場合は、Codex Desktop の可視taskを作らないバックグラウンドrunである。この場合は `CODEX_THREAD_ID` を前提にせず、threadの作成・検索・送信・改名・pin・archiveを一切行わない。sanitized reportとautomation memoryを確定し、上の条件に当てはまる時だけOS通知を作る。reportを保存し、通知が必要ならその成功後に `H1_BACKGROUND_RUN_ID` を使い、`/Users/masa/.codex/automations/amd-os-l6-meeting-flow/run_state/background_completed/$H1_BACKGROUND_RUN_ID.json` に `state='reported'` と `reported_at_jst` だけを保存する。これはthread markerではなくrunner完了証跡であり、watchdogは呼ばない。

- H-1本体は `list_threads` / `read_thread` / `create_thread` / `send_message_to_thread` を呼ばず、日次まとめの作成・検索・追記をしない。2026-07-20に日次配送直前でrunが止まったため、OS通知と日次配送を同じrunへ直列化しない。
- 起動直後は `CODEX_THREAD_ID` と開始JSTを `/Users/masa/.codex/automations/amd-os-l6-meeting-flow/run_state/current_h1.json` へ書くだけにする。前回IDへ `set_thread_archived` を呼ばない。すでに閉じたIDへのapp tool callが停止点になった実績がある。
- 毎時runの最後は、sanitized報告をローカル `reports/` と automation memory に確定する。OS通知が必要な結果だけ送信し、対象なし・変更なしは通知せず完了する。通知が必要な場合はその成功後、`/Users/masa/.codex/automations/amd-os-l6-meeting-flow/run_state/completed/$CODEX_THREAD_ID.json` に `thread_id`、`state='reported'`、`reported_at_jst` を保存する。**その次操作は `node pwa/scripts/archive_stale_h1_codex_threads.mjs --thread-id "$CODEX_THREAD_ID"` だけ**とし、日次送信・追加調査・説明commentary・別tool callを挟まない。
- 非LLM LaunchAgent `jp.teamarmada.codex-h1-thread-watchdog` は、sanitized報告を確定済みの完了markerがあるrunをsession実体の有無にかかわらず回収する。完了markerのないrunは自動で閉じず、`unreported` として残留を可視化する。raw本文、他automation、日次まとめは対象にしない。
- OS通知が必要な結果で送信に失敗した場合は原因を見える化する。完了markerを書かず、次回runで配送を再試行できる状態を残す。対象なし・変更なしにはOS通知も配送再試行もない。
- reviewer は `reports/` の未集約sanitized報告とレビュワー結果を、reviewer自身のローカルreport・集約台帳・automation memoryへ確定する。日次まとめtaskは作らない。詳細は `pwa/scheduled-tasks/amd-os-l6-meeting-reviewer/SKILL.md` を見る。

## 候補がある時に必ず Read

1. `pwa/manual/3-2-data-and-extraction.md` (§3.1 取り込み path / §3.2 M/W/D/H L2正本 / §3.4 修正依頼ループ)
2. `pwa/manual/9-1-decisions-and-history.md` (§5.4 責務分担マトリクス / §5.7 L2 ghost 復旧計画)
3. `pwa/design/meeting_summaries.md` (= MTG サマリ仕様正本)
4. `pwa/design/h1_source_auth_fallback.md` (= Notion 再認証待ち禁止 / fallback ladder)
5. `pwa/design/db_schema.md` (= **列名は想像で書かない、必ず grep**)
6. `pwa/design/l2_extract_claude_routine.md` (= 設計議論)
7. `gas/074_MeetingSummaryRepo.js` (= 元実装、source_kinds 判定 / Notion 3 段 fallback / Notion AI transcription block 取得 / Gmail thread filter)
8. `gas/153_MeetingHourlyTrigger.js` (= 元 polling)
9. `gas/079_NameAliasMap.js` (= 名前正規化マップ)

═══════════════════════════════════════════════════
Phase 0: env と calendar の準備
═══════════════════════════════════════════════════

1. cwd を `/Users/masa/projects/AMD/amd-os` に固定
2. `pwa/.env.local` から以下を bash でロード:
   ```bash
   ENV=pwa/.env.local
   SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV" | cut -d= -f2- | tr -d '"')
   SRK=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV" | cut -d= -f2- | tr -d '"')
   COLOR_PJ_CONFIG_SPREADSHEET_ID=$(grep '^COLOR_PJ_CONFIG_SPREADSHEET_ID=' "$ENV" | cut -d= -f2- | tr -d '"')
   CRON_SECRET=$(grep '^CRON_SECRET=' "$ENV" | cut -d= -f2- | tr -d '"')
   WORKFLOW_SECRET=$(grep '^WORKFLOW_SECRET=' "$ENV" | cut -d= -f2- | tr -d '"')
   WORKFLOW_SECRET="${WORKFLOW_SECRET:-$CRON_SECRET}"
   APP_BASE_URL="https://amd-os-pwa.vercel.app"
   ```
3. 本番PWA URLは `https://amd-os-pwa.vercel.app` に固定する。`pwa.masa-aa.com` は Vercel に登録されていない古い/未使用ホストなので、H-1 の build-info / calendar-sync / finalize では使わない。
4. Calendar `mcp__509862f5-b23a-4c45-bf99-9978f6bc4d61__list_calendars` で primary calendar を確認 (= 通常まさの primary)。MAIN_CALENDAR_ID を `.env.local` に置く運用にしてないので、毎回 primary を採用。
5. **connector が `event.colorId` / `get_colors` を返さない場合の前段 diagnostic**:
   - `Google Calendar connector` の payload だけで色が見えないときは、待ち続けず `pwa/scripts/l6_calendar_color_diagnostic.mjs` を使う。
   - この helper は既存 PWA Google env (`GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `GOOGLE_OAUTH_REFRESH_TOKEN`、または `GOOGLE_SERVICE_ACCOUNT_JSON` + 必要なら `GOOGLE_SERVICE_ACCOUNT_SUBJECT`) で Calendar API v3 を read-only 実行する。
   - PWA 側 Google env が無い環境では、GAS Advanced Calendar Service の `l6_calendar_color_diagnostic(opts)` を `pwaApi runFunc` から呼ぶ。GAS 側は `gas/188_L6CalendarColorDiagnostic.js` が正本で、既存 `NEXT_PUBLIC_GAS_WEBAPP_URL` + `NEXT_PUBLIC_GAS_API_KEY` を使う。
   - 実行例:
     ```bash
     cd /Users/masa/projects/AMD/amd-os/pwa
     npm run diagnose:l6-calendar-colors -- \
       --calendar-id primary \
       --time-min 2026-06-01T00:00:00+09:00 \
       --time-max 2026-06-03T23:59:59+09:00 \
       --max-results 80
     ```
   - 返すのは `event_id` / `calendar_id` / `summary` / `start` / `end` / 明示 `colorId` / `calendar_default.colorId` / CFG_PJAlias の高信頼候補有無だけ。attendees / description / DB / outbox は触らない。
   - `calendar_default.colorId` は診断情報であり、明示色の代替として自動採用しない。明示 `event.colorId` が無い event でも、CFG_PJAlias の exact / regex / bracketed / ASCII whole-token title alias が high confidence で当たり、`EXCLUDE` / `AMD` でなく、duplicate guard と既存良質サマリ保護を通る場合だけ Live 候補へ進める。単なる substring は review-only で Live 候補にしない。

═══════════════════════════════════════════════════
Phase A: Calendar events 取得 → filter → PJ 判定 (= GAS 153 移植)
═══════════════════════════════════════════════════

5. **時刻計算** (= 現在 JST 起点で過去 3 時間の window):
   - `now` = 現在時刻 (UTC ISO)
   - `queryStart` = now - 240 分 (= 4 時間前、余裕 60 分含む)
   - `queryEnd` = now
   - `winStartMs` = now - 180 分 (= 終了 180 分前)
   - `winEndMs` = now - 60 分 (= 終了 60 分前)
   - **窓**: イベントの `end` datetime が `winStartMs ≦ end < winEndMs` の範囲に入るものだけ処理対象

6. Calendar `mcp__509862f5-b23a-4c45-bf99-9978f6bc4d61__list_events`:
   - `startTime` = `queryStart` ISO
   - `endTime` = `queryEnd` ISO
   - `pageSize` = 50

7. 各 event について **filter** (= GAS 153 と同じ):
   - `event.start.date` のみで `dateTime` なし (= 全日イベント) → **skip** (= 議事録対象外)
   - `title` が `+` または `＋` 始まり → **skip** (= 候補だが未確定)
   - `title` が空 → **skip**
   - `end.dateTime` を Date に変換 → `winStartMs ≦ ms < winEndMs` 窓外なら **skip**

8. **PJ 判定** (= GAS 153 完全再現。**カレンダー色が第一判定軸 =「色優先」**。まさが運用してる正本シート `CFG_ColorPJHistory` + `CFG_PJAlias` を読む):

   > 🚨 **このステップを削除・簡略化しないこと**。2026-05-29 復旧 — #71 の Claude routine 移植時に、この色→PJ 判定 (CFG_ColorPJHistory) が誤って削除され `project_name` substring match だけに簡略化されていた (= まさ未承認の機能削除事故)。正本仕様は `pwa/manual/3-2-data-and-extraction.md` の「カレンダー色→PJ判定」。色判定は AMD OS の恒久仕様。

   **(a) 設定読み込み** (= 外部スプシ正本を Drive MCP で直読み):
   - `mcp__66e633f8-4f3e-495d-aa3c-4733ce09335f__read_file_content(fileId = COLOR_PJ_CONFIG_SPREADSHEET_ID)` でシート本文 (markdown) を取得
   - 2 つの table をパース:
     - **CFG_ColorPJHistory**: `colorId | startDate | pjCode | note` (= colorId ごとに startDate 昇順の履歴)
     - **CFG_PJAlias**: `alias | pjCode | priority | matchType | note`
   - active PJ 一覧も fetch (pjCode→project_id 解決用):
     ```bash
     curl -s "$SUPABASE_URL/rest/v1/projects?select=project_id,project_name,client_name,status,slack_channel_id,drive_folder_id,drive_source_folder_ids,report_emails&status=in.(active,sales)" \
       -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
     ```

   **(b) colorId → pjCode (第一軸・色優先)**:
   - event の明示 `colorId` を取る。connector payload で見えない場合は `pwa/scripts/l6_calendar_color_diagnostic.mjs` の Calendar API v3 read-only 結果を使う。
   - `calendar_default.colorId` は診断・設定確認用に読むが、`get_colors` / event payload 不調時の Live write target には使わない。明示 `event.colorId` が無い event は color route では止め、下の CFG_PJAlias high-confidence route へ回す。
   - CFG_ColorPJHistory のうち、その colorId かつ `startDate <= event 開始日(00:00 JST)` の行で **startDate 最大** を採用 → `pjCode`
   - 例: colorId=6 は `2024-01-01→JC`、`2026-05-28→VSX`。2026-05-28 以降の colorId 6 イベントは **pjCode=VSX**

   **(c) title alias → pjCode (第二軸・色で取れない時の補完)**:
   - `(title + ' ' + description + ' ' + location)` を CFG_PJAlias の各 alias に matchType で照合 → priority 最大の pjCode
   - alias hit が `EXCLUDE` の場合は色で pjCode が取れていても **skip** (= 議事録対象外)
   - 明示 `event.colorId` が無い event を Live 候補へ上げてよいのは、CFG_PJAlias の high-confidence hit のみ:
     - `matchType=exact` の title 完全一致
     - `matchType=regex` の明示ルール一致
     - `[ZMP]` / `【ZMP】` / `(ZMP)` 形式など bracketed title alias
     - `ZMP MTG` のような ASCII whole-token title alias
   - `matchType=contains` の単純 substring や project_name / client_name substring は review-only。PJ 候補メモには残してよいが Live write target にはしない。

   **(d) pjCode → project_id 解決**:
   - `lower(projects.project_name) == lower(pjCode)` の active PJ を優先 (= SX/CX/OQC/ZMP/SE/BWE/CTB/CLG など大半は project_name==code)
   - project_name と一致しない code は既知マップで解決: **VSX → VasculaX (project_id = p26)**
   - `pjCode` が `pNN` 形式なら project_id として直接使う
   - `pjCode` が `AMD` / 空 → **skip_no_pj** (= AMD 全体 MTG、ghost にしない)

   **(e) 最終フォールバック** (= 色も alias も取れない時のみ、旧 text-only ロジック):
   - `(title+desc+loc)` lowercase に対して project_name / project_id / client_name の substring match
   - それでも取れなければ **skip_no_pj**

   - 複数候補は **明示色 > CFG_PJAlias high-confidence > review-only substring** の優先順位で 1 つに絞る。Live write は最初の 2 つだけ。

9. PJ 紐付けが取れた events を **処理キュー** に積む

10. **直近 `議事録なし` row recovery** (= `none` marker を放置しない):
   - Phase A の通常 window で処理キューが 0 件でも、ここで終わらない。先に Supabase から直近 24 時間の開催済みMTG marker を確認する。
   - 対象:
     - `meeting_start_at >= now - interval '24 hours'`
     - `meeting_start_at < now`
     - `source_kinds = 'none'` または `summary_short = '議事録なし'`
     - `narrative_md` が空または 300 字未満
     - `calendar_event_id` または `meeting_id` がある
   - 対象 row ごとに、`title` / `meeting_start_at` / `calendar_event_id` から event 相当 payload を再構成し、通常の Phase B-D に戻す。`recovery_reason='recent_none_marker'` を run summary に残す。
   - この recovery は「手動修復」ではなく H-1 自身の自動再抽出レーン。本文が見つからなければ `none` は維持するが、試した source と不足理由を `review_required` artifact に残す。

### A-2: 直近Calendar予定 → 予定MTGカード同期

終了済みMTGの議事録抽出とは別に、H-1 は毎回 **現在時刻の24時間前から24時間後** の確定Calendar予定だけを同期する。これは議事録直後の補強と Phase P 準備のための直近レーン。未来60日の予定MTGカード同期は毎時H-1では実行せず、M系の定期メンテへ移す。

1. Calendar MCP で `now - 24 hours` から `now + 24 hours` までを bounded search/list する。`title` が `+` / `＋` 始まり、全日予定、start datetime の無い予定は除外。
   - weekly recurring は `recurringEventId` / `recurring_event_id` が取れる場合はその series id、取れない場合は PJ + title + 曜日 + 開始時刻で series を推定する。
   - 6〜8日間隔で続く weekly series は **次回1件だけ** `calendar-sync` に渡す。複数の weekly がある場合は series ごとに1件ずつ残す。
2. 各 event について、PJ が解決できる場合は **Drive 関連資料も先に探す** (= LLM 不要、準備カード用 metadata):
   - `projects.drive_folder_id` と `projects.drive_source_folder_ids[]` をIDで重複排除した各rootをDrive MCPでlistし、event 日付 token (`YYMMDD` / `YYYYMMDD` / `YYYY-MM-DD`) と title token (`取締役会` / `board` / `月次` / `報告会` / `キックオフ` / PJ名 / client_name) でサブフォルダを探す。追加rootは読み取り専用で、会議資料保存先には使わない。
   - 日付フォルダが見つかったら、その直下の Docs / Slides / Sheets / PDF / Office files を最大 8 件採用。例: CLG `260527_取締役会` folder の招集通知 PDF・予算xlsx・報告xlsx。
   - 日付フォルダが無い場合だけ、folder root 直下と Drive search で title/date/PJ token を検索する。
   - 各 file は `{title,url,mime_type,modified_time,snippet}` に正規化する。本文 fetch は重ければ不要、snippet はタイトルだけでもよい。raw 本文全文は渡さない。
3. 取得した event metadata を PWA に渡す:
   ```bash
   curl -s -X POST "$APP_BASE_URL/api/meeting-prep/calendar-sync" \
     -H "Authorization: Bearer $WORKFLOW_SECRET" \
     -H "Content-Type: application/json" \
     --data '{"events":[{"calendar_event_id":"<event.id>","recurring_event_id":"<event.recurringEventId if any>","title":"<event.summary>","start":"<event.start>","end":"<event.end>","url":"<event.url>","description":"<event.description>","location":"<event.location>","drive_files":[{"title":"<file.title>","url":"<file.url>","mime_type":"<file.mime_type>","modified_time":"<file.modified_time>","snippet":"<short snippet>"}]}]}'
   ```
4. PWA 側で `projects.project_name` / `project_id` / `client_name` によりPJ判定し、`upcoming:<calendar_event_id>` を upsert する。PWA route も safety net として同じ weekly series の2件目以降を skip する。既に手動編集済みの準備本文は上書きせず、Calendar由来の日時・title・URL・Drive資料リンクだけ同期する。
5. これにより、直近48時間内の recurring board meeting も、前回MTGサマリからの `finalize` を待たずに「予定MTG / 準備中」に出る。Drive folder に会議資料がある場合は、予定カード内の `関連Drive資料` として先に見える。

**未来60日の扱い**: 60日先までの予定表メンテは H-1 では実行しない。M系の定期メンテが `calendar-sync` へ渡し、同じ `upcoming:<calendar_event_id>` と recurring series 1件化ルールを使う。H-1 は前後24時間と開催済み議事録に集中する。

═══════════════════════════════════════════════════
Phase B: 各 event について source 取得 + source_kinds 判定 (= GAS 074 移植)
═══════════════════════════════════════════════════

各 event について順に実行 (= 同期、1 件ずつ):

### B-1: Notion 議事録ページ検索 (= eventId 優先 + title/date fallback)

開催済み候補へ進む前に、connector から取得した短い metadata snapshot がある場合は repo guard を使って preflight する。

```bash
cd /Users/masa/projects/AMD/amd-os/pwa
npm run test:l6-held-source-guard
```

この guard は fixture 用の再発防止だけでなく、同じ入力形 (`projects`, `events`, `upcomingRows`, `notionPages`, `gmailThreads`) を渡せる helper (`scripts/l6_meeting_held_source_guard.cjs`) としても使える。出力に `heldCandidates[]` が出た event は、準備カードだけで終了せず Phase B-D の開催済み upsert へ進める。`prep_source_meeting_id` がある場合は `project_meeting_summaries.prep_source_meeting_id` に入れ、upcoming row 自体は消さない。fallback 紐付けは `confidence` と `needs_review` を run summary に残す。

9. **Stage 1**: Notion `notion-search` で **eventId 相当文字列** をクエリに含めて検索:
   - query = `<event.id>`
   - `data_source_url` は議事録 DB の collection URL (= 既知の Notion 議事録 DB を使う想定。後述 ScriptProperties `NOTION_DATABASE_ID` 相当を `.env.local` に追加するか、または毎回 search で十分)
   - ヒットがあれば該当ページ採用 → B-2 へ
10. **Stage 1b** (= eventId hit 時): 採用した Notion page は B-1b のメタデータ補完対象にする。書き込みに失敗しても抽出は続け、run summary に不足理由を残す。
11. **Stage 2** (= Stage 1 失敗時、または Notion page に eventId が無い時の必須 fallback): title から ISO datetime / `<mention-date>` / `@今日` / ` HH:MM以降` を除去した **prefix** で再検索:
    - query = `<prefix> <YYYY-MM-DD>` (= event 日も併記)
    - ヒット最大 30 件 → 各ページの `created_time` slice(0,10) で event 日 ±1 日内のものに filter
    - `last_edited_time` desc で 1 件採用
    - 採用後、Notion page は B-1b のメタデータ補完対象にする。追記できない場合も抽出は続ける。
12. **Stage 3** (= Stage 2 失敗時): event 日のみで search:
    - query = `<YYYY-MM-DD>` + 議事録 DB scope
    - 1 件採用
    - 複数ヒット時は title 類似度、attendees、Calendar/Drive/Gmail URL一致、created/edited time で rank し、曖昧なら Notion source なしとして他 source へ進む。
13. すべて失敗なら **notion なし** として `notionText = ""` で続行 (= Gmail / Drive / Slack 拾えるかも)。`eventId` が無いから失敗扱いにしない。

### B-1b: Notion 議事録メタデータ補完 (= eventId / PJ relation / member relation / 日付)

Notion page を採用できた event は、本文取得とは別にページプロパティを best-effort で補完する。これは抽出の前提条件ではなく、次回以降の検索性・PJ別抽出・参加者文脈を整える self-healing task。

**対象プロパティ**
- `eventId`: rich_text/text 相当。空なら Calendar event id を入れる。
- `PJ`: Notion PJ DB への relation。空なら H-1 で解決済みの `project_id` / `pjCode` から Notion PJ page を 1 件解決して入れる。
- member relation: Notion member DB への relation。property 名は `NOTION_MINUTES_MEMBER_PROP` を正とし、未設定時は `メンバー` / `参加メンバー` を順に探す。通常の H-1 では Calendar organizer / attendees の email と AMD `members.email` を exact match し、対応する Notion member page が 1 件だけ解決できた member を追加する。過去分 backfill では参加者推定をせず、`NOTION_MINUTES_DEFAULT_MEMBER_PAGE_ID` が設定されている場合だけ既定 member を既存 relation に union 追加する。
- `日付`: date 相当。空なら一意に対応した Calendar event の start を `Asia/Tokyo` へ変換した日付を入れる。

**Notion DB / property 解決**
- page fetch は空の property を省略することがあるため、採用pageの親 data source を必ず fetch し、schemaから `eventId` / `PJ` / member relation / `日付` の実在と型を解決する。page responseにpropertyが無いことを「property不存在」と解釈しない。
- `PJ` relation はまず exact property name `PJ` を使う。無い場合だけ relation property 名に `PJ` を含むものを探す。
- member relation は `NOTION_MINUTES_MEMBER_PROP` を最優先に使う。無い場合は exact property name `メンバー`、次に `参加メンバー` を使う。見つからない場合は書かない。
- Notion PJ page id は、既存 GAS の `NOTION_PJ_DATABASE_ID` 相当、または Notion search で PJ DB page title が `project_name` / `pjCode` と一致するものから解決する。複数候補なら書かない。
- Notion member page id は、Notion member DB / workspace search で AMD `members.email` または `code_name` と 1 件一致する page から解決する。DBや property が不明なら書かずに `notion_member_relation_unresolved` とする。

**書き込みルール**
- 既存 `eventId` が空なら入れる。既存値が Calendar event id と異なる場合は上書きせず `notion_event_id_conflict` として要確認に残す。
- 既存 `PJ` relation が空なら入れる。既存に別PJらしき relation がある場合は上書きせず `notion_pj_relation_conflict` として要確認に残す。
- 既存 `日付` が空なら入れる。既存日付は上書きしない。Calendar eventが一意に定まらない場合は `notion_date_unresolved` として書かない。
- 既存 member relation は消さない。通常の H-1 は高信頼に解決できた AMD member page だけを既存 relation と union して追加する。過去分 backfill は既定 member だけを追加し、外部参加者や推定参加者は追加しない。
- 外部参加者、メール不明、辞退者、optional で未参加と分かる人、候補が複数の人は自動追加しない。
- Notion connector / API 書き込みが失敗しても H-1 を止めない。議事録本文の抽出は続け、run summary に `notion_metadata_backfill_failed` と不足理由を残す。
- patch 後は同じ page を再fetchし、`eventId` / `PJ` / member relation / `日付` を readbackする。不一致は `notion_metadata_backfill_failed_readback` であり補完成功へ数えない。
- raw Calendar description、会議URL、Drive URL、参加URL、passcode、secret、Notion本文は patch payload / review artifact / user report に出さない。

**run summary に残す項目**
- `notion_metadata_backfill_checked`: Notion page を採用して補完判定した件数。
- `notion_metadata_backfill_prepared`: 空欄と根拠を確認しpatchを組み立てた件数。
- `notion_metadata_backfilled`: eventId / PJ / member relation / 日付のどれかを実際に補完しreadbackまで一致した件数。
- `notion_metadata_backfill_readback_verified`: 更新後4項目を再取得して一致した件数。
- `notion_metadata_backfill_skipped_*`: 高信頼に解決できず書かなかった理由。
- `notion_metadata_backfill_failed`: 書き込み失敗。成功扱いにしない。

### B-1c: 独立した Notion 空欄scan

held / recovery / upcoming が0件でも、gate JSONの `candidates.notion_metadata.scan_required=true` なら議事録data sourceの**全履歴**を本文なしで検索する。`start_cursor`から再開し、4項目のいずれかが空のpageを `limit` 件集めるまで最大`max_scan_pages`だけpaginationする。EOF前は`next_cursor`を次回へ保存し、EOFではcursorをnullへ戻して`cycle`を増やすため、毎回先頭25件だけで止まらず古い後半pageまで巡回する。cursor stateにはpage ID/title/本文/URLを保存しない。Calendar event、PJ、memberを一意・高信頼に解決できない項目は書かないが、他の確定項目は空欄だけ補完してよい。候補0件は正常no-op。Calendar connector不在をNotion候補0件へ読み替えない。scanまたはreadback失敗時はcursorを進めない。

**Auth failure branch**: Notion connector が `UNAUTHORIZED oauth_token_invalid_grant` / `TRIGGER_REAUTHENTICATION` / reauth required を返した場合も、ユーザーの再認証を待たない。可能なら最小 Notion connector ping だけで host 側の再認証 UI を発火し、すぐ `npm run notify:connector-auth -- --connector notion --source h1_meeting_flow --reason <reason> --context "<title / date>" --dedupe-hours 24` を実行する。この helper は connector/app ID と再認証リンクを自動解決し、`app_notifications(kind='connector_auth')` に PWA/Swift 両方が拾える復旧アクションを残す。既存未読通知がある場合は最新payloadへ更新し、Swift再通知用に `native_notified_at` も NULL に戻す。

その直後に **必ず Local Notion fallback helper を実行**する:

```bash
cd /Users/masa/projects/AMD/amd-os/pwa
npm run h1:local-notion-fallback -- \
  --title "<event title>" \
  --date "<YYYY-MM-DD>" \
  --event-id "<calendar_event_id>" \
  --max-source-chars 12000
```

`status='hit'` の場合は、最上位 match の `source_text` を `notionText` とし、`page_id` を `notion_page_id`、`url` を `notion_url/source_url`、`source_hash` を H-1 の source hash に含める。`source_kind='notion-local'` は `source_kinds` 保存時には `notion` token として扱ってよいが、run summary には `notion_local_fallback_used` を残す。`status='miss'` / `unavailable` の場合だけ、Chrome / Codex Desktop のログイン済み Notion、browser history、open tabs、その他 local cache を read-only で確認し、取れなければ `notionText=""` のまま B-3 以降へ進む。run summary には `notion_connector_reauth_bypassed`、`connector_auth_notification_created` または `connector_auth_notification_updated`、fallback 結果 (`notion_local_fallback_used` / `notion_browser_fallback_used` / `notion_browser_fallback_unavailable`) を残す。terminal status として `blocked_notion_auth` / `waiting_for_reauth` を使うのは禁止。

### B-2: Notion ページ本文取得 (= GAS 074 `_meeting_fetchAiNotesBody_` + `nav_repo_notion_fetchPageBodyText` 移植)

14. ページが取れたら `notion-fetch` で本文取得:
    - id = page URL or UUID
    - 通常 block の本文 + props `内容` rich_text + **AI 議事録 transcription block** (= type=`transcription` の children.summary_block_id + notes_block_id を再帰取得) を取得
    - 3 つを `\n\n` 結合 → `notionText`
    - 上限 ~20000 chars

### B-3: Gmail thread 取得 (= GAS 074 `_meeting_loadGmailCacheForMonth_` + `_meeting_pickRelevantGmailThreads_` 移植)

15. PJ の `report_emails` を取得 (= projects.report_emails の semicolon / comma 区切りリスト)
16. **report_emails が空 PJ** でも Gmail を完全スキップしない。Calendar event title / project_name / client_name / known keywords / Gemini notes sender (`gemini-notes@google.com`) / Meet recording 通知を使って限定検索し、run summary に `report_emails_missing_but_gmail_fallback_used` を残す。
17. Gmail `search_threads` で:
    - `report_emails` がある通常MTG: query = `(from:<email1> OR to:<email1> OR from:<email2> OR ...) after:<event 日 -1 日 YYYY/MM/DD> before:<event 日 +2 日 YYYY/MM/DD>`
    - `report_emails` が空の fallback: query = `("<event title token>" OR "<project_name>" OR "<client_name>") (from:gemini-notes@google.com OR "Gemini によるメモ" OR "meeting notes" OR "議事録") after:<event 日 -1 日> before:<event 日 +2 日>`
    - 取締役会 / 株主報告 / 月次報告 / 予算 / 招集通知 / board / monthly を title or project context に含む場合: `after:<event 日 -21 日>` まで広げる。CLGのように招集通知・資料送付が会議の1週間以上前に届くPJを拾うため。
    - pageSize = 20
18. ヒットスレッドそれぞれを `get_thread` (messageFormat=FULL_CONTENT) で本文取得
19. **chitchat 抑制**: bot 配信 (= from に noreply/no-reply/notification@ 含む) は除外。ただし Gemini notes / Google Meet recording 通知は会議本文 source なので除外しない。
20. 各 thread の subject + message bodies (= 各 message 800 chars × 最大 5 msg、合計 ~4000 chars) を format:
    ```
    --- mail [MM/dd HH:mm] subject: <subject> ---
    <body>
    ```
21. 全 thread 結合 → `gmailText` (= 上限 ~8000 chars)
22. `gmailThreadIds` = ヒットした threadId list

### B-4: Drive 関連資料取得 (= 会議資料・議事録・招集通知・予実表を拾う)

22. PJ の`drive_folder_id`と`drive_source_folder_ids[]`をIDで重複排除したrootが1件以上ある場合に実行。両方が空の場合は、Drive を「生データなし」とは扱わず、run summary に `drive roots missing` として残す。
23. **候補 folder 探索**:
    - 各rootを Drive MCP `list_folder` で最大50件listする。`drive_folder_id`は保存先でもあり、`drive_source_folder_ids[]`は抽出だけに使う。
    - event 日付 token を作る: `YYMMDD` (= 260527), `YYYYMMDD`, `YYYY-MM-DD`, `M月D日`。
    - title / PJ token を作る: event title から `CLG` / `チャレナジー` / `取締役会` / `board` / `月次` / `報告会` / `キックオフ` / `MTG` / `定例` / `議案` / `資料` などを抽出。
    - folder title が日付 token または title token を含む場合、まずその folder を候補にする。例: CLG root の `260527_取締役会`。
    - 候補 folder がある場合は、その直下を `list_folder` で最大 50 件読む。候補 folder が無い場合だけ root 直下 file と Drive search を使う。
    - 必要なら 1 階層だけ再帰してよい。深掘りしすぎて無関係資料を混ぜない。
24. **Drive search fallback** (= folder list だけで拾えない場合):
    - `query` は短く分割する。例: `CLG 取締役会`, `チャレナジー 取締役会`, `260527 取締役会`, `<project_name> <YYMMDD>`。
    - `special_filter_query_str` が使える場合は各rootに対する `'<root_id>' in parents and mimeType != 'application/vnd.google-apps.folder'` を基本に、`modifiedTime` は **会議日前後だけに狭めすぎない**。招集通知や取締役会資料は 1 週間以上前に作成されることがある。
25. **採用する file 種別**:
    - Google Docs / Slides / Sheets
    - PDF
    - Office files (`.docx` / `.pptx` / `.xlsx`)
    - text / markdown
    - folder は本文 source にはしない (= folder 内の file を読む)
26. **ranking**:
    - +5: title に event 日付 token
    - +4: title に event title の主要語 (`取締役会`, `報告会`, `キックオフ`, `MTG` など)
    - +3: title に `議事録` / `招集通知` / `議案` / `報告資料` / `予算` / `予実` / `月次`
    - +2: parent folder が event 日付 folder
    - -5: title が明らかに別月・別日
    - score 上位 8 件まで採用。
27. **本文取得**:
    - Docs: `fetch` / `get_document` で text 化。
    - Slides: `get_presentation_text` を優先。重い場合は title + outline text のみ。
    - Sheets / xlsx: `fetch` で text 化できる範囲だけ。大きい workbook は sheet 全体を読まず、file title / sheet names / first visible summary 程度に留める。
    - PDF / Office binary: `fetch` の text extraction が返れば使う。返らない場合でも title / url / mime_type / modified_time を `driveText` に入れ、「本文未抽出」と明記する。
    - 各 file 本文は最大 2000 chars、Drive 全体で最大 12000 chars。
28. `driveText` format:
    ```
    --- drive file: <title> ---
    url: <url>
    mime_type: <mime_type>
    modified_time: <modified_time>
    extraction: <text|metadata_only>
    <extracted text or short metadata note>
    ```
29. **汚染防御**:
    - Drive資料は「会議資料・補助根拠」として扱う。Drive資料に書かれているだけで、当日会議で決定されたとは書かない。
    - `decided` は Notion/Gmail/Slack/発言系 source に明確な決定がある場合を優先。Driveのみの場合は `progress` / `risks` / `next_actions` / `narrative_md` に寄せる。
    - ただし招集通知・議案資料・予実資料のように取締役会の正式資料であることが file title / folder から明確なら、`narrative_md` に「資料上の論点」として反映する。

### B-5: Slack thread 取得 (= GAS 074b 移植、optional)

30. PJ の `slack_channel_id` がある場合のみ:
    - Slack `slack_read_channel` で channel_id = `<slack_channel_id>`、oldest = `<event 日 -1 日 unix秒>.000000`、latest = `<event 日 +2 日 unix秒>.000000`、limit = 50
    - 各 message について thread root (= `thread_ts === ts` or `thread_ts` 不在) で reply_count >= 2 OR parentText >= 200 chars のものだけを対象
    - 候補スレッドそれぞれを `slack_read_thread` で message_ts = `<parent_ts>` で取得 (= 親 + replies)
    - bot メッセージ (= subtype=bot_message / app_id 存在 / user=USLACKBOT) は除外
    - parent + replies の text を結合 (= 各 800 chars 上限) → `slackText`

### B-6: source_kinds 判定 (= GAS 074 と同じ閾値 30 chars)

31. 各 source の文字数:
    - `hasNotion` = `notionText.length >= 30`
    - `hasGmail` = `gmailText.length >= 30`
    - `hasDrive` = `driveText.length >= 30`
    - `hasSlack` = `slackText.length >= 30`
32. **source_kinds 文字列** (= "+ で結合"、GAS 074 / 074b-e と同じ):
    - すべて false → `"none"`
    - 該当した source 名を `notion` / `gmail` / `drive` / `slack` のいずれかで `+` join (= 例: `"notion+gmail+slack"`)

### B-7: source_hash 計算 + 差分検知 (= GAS 074 `_meeting_sha256_` 移植)

33. **combined text** を組み立て:
    ```
    === notion ===
    <notionText>

    === gmail ===
    <gmailText>

    === drive ===
    <driveText>

    === slack ===
    <slackText>
    ```
    (= has* が true の section のみ含める)

34. **alias map + feedback の hash** を combined に混ぜる (= GAS と同じ、feedback 追加で自動再抽出):
    - alias = Phase C-2 で構築 (= members 全件、members.member_name 列が無い場合は member_id + code_name + email local だけ)
    - feedback = Phase C-3 で構築 (= l2_feedbacks の active rows)
    - `fbHashInput` = feedback 各行の `feedback_id + "|" + feedback_text` を `\n` join (= 該当なしなら "")
    - `hashInput` = `"rev=v8_hybrid_section_lists\nfb=" + fbHashInput + "\n" + combinedText`
    - **os_context は source_hash に混ぜない**。MS進捗や予定MTGが変わるたびに議事録を再生成すると credit を浪費するため、OS文脈は新規抽出時の品質向上に使い、再生成は source / feedback / prompt revision の変化だけで起こす。
    - `newHash` = bash で計算:
      ```bash
      newHash=$(printf '%s' "$hashInput" | sha256sum | awk '{print $1}')
      ```

35. **既存 row** を Supabase REST で fetch:
    ```bash
    curl -s "$SUPABASE_URL/rest/v1/project_meeting_summaries?meeting_id=eq.<event.id>&select=source_hash,narrative_md,generated_by_model,updated_at&limit=1" \
      -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
    ```
36. 既存 `source_hash == newHash` なら **skip_unchanged** (= LLM 呼ばない、idempotent)
37. 既存 row なしまたは hash 違うなら C へ

### B-8: 議事録なしケース (= source_kinds == "none"、GAS 074 移植)

38. `source_kinds == "none"` のとき:
    - `noneHash` = sha256(`"none|" + meetingDate + "|" + title`)
    - 既存 source_hash == noneHash なら skip
    - そうでなければ **マーカー行** として upsert:
      ```json
      {
        "meeting_id": "<event.id>",
        "project_id": "<projectId>",
        "ym": "<YYYYMM>",
        "meeting_date": "<YYYY-MM-DD>",
        "meeting_start_at": "<event.start.dateTime ISO>",
        "title": "<event.title sanitized>",
        "notion_url": "<notionUrl or null>",
        "notion_page_id": "<notionPageId or null>",
        "calendar_event_id": "<event.id>",
        "gmail_thread_ids": [],
        "source_kinds": "none",
        "summary_short": "議事録なし",
        "decided": [],
        "progress": [],
        "next_actions": [],
        "risks": [],
        "source_hash": "<noneHash>",
        "generated_at": "<ISO now>",
        "generated_by_model": null
      }
      ```
    - upsert:
      ```bash
      curl -s -X POST "$SUPABASE_URL/rest/v1/project_meeting_summaries?on_conflict=meeting_id" \
        -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
        -H "Content-Type: application/json" \
        -H "Prefer: resolution=merge-duplicates,return=minimal" \
        --data "$ROW_JSON"
      ```
    - meeting_notifications には upsert **しない** (= source_kinds=="none" は通知不要)
    - 続く event へ

═══════════════════════════════════════════════════
Phase C: LLM 抽出 (= サブスク内 私自身が JSON 生成)
═══════════════════════════════════════════════════

source_kinds != "none" の event について:

### C-0: OS context block (= まさ #MTGサマリ品質改善)

Supabase から、この会議を PJ 全体の流れに位置づけるための context を取得する。

1. **PJ 本体**
   ```bash
   curl -s "$SUPABASE_URL/rest/v1/projects?project_id=eq.<projectId>&select=project_id,project_name,status,project_category,start_ym,end_ym&limit=1" \
     -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
   ```
2. **直近の過去 MTG** (= 同 PJ、開催日前、`source_kinds != upcoming`、最大 4 件)
   ```bash
   curl -s "$SUPABASE_URL/rest/v1/project_meeting_summaries?project_id=eq.<projectId>&meeting_date=lt.<YYYY-MM-DD>&source_kinds=neq.upcoming&order=meeting_date.desc&limit=4&select=meeting_id,meeting_date,title,summary_short,decided,progress,next_actions,risks,narrative_md" \
     -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
   ```
3. **既にある次 MTG / 準備カード** (= `source_kinds=upcoming`、最大 3 件)
   ```bash
   curl -s "$SUPABASE_URL/rest/v1/project_meeting_summaries?project_id=eq.<projectId>&meeting_date=gte.<YYYY-MM-DD>&source_kinds=eq.upcoming&order=meeting_date.asc&limit=3&select=meeting_id,meeting_date,title,summary_short,next_actions,risks,narrative_md,prep_status" \
     -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
   ```
4. **PWA 手動添付** (= Meet/Gmail 議事録に落ちないスクショ・PDF・画面キャプチャ)
   ```bash
   curl -s "$SUPABASE_URL/rest/v1/meeting_assets?meeting_id=eq.<event.id>&select=asset_id,file_name,media_type,asset_kind,caption,extracted_text,sort_order&order=sort_order.asc,created_at.asc" \
     -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
   ```
   - 画像そのものが必要な時だけ private Storage `meeting-assets` を signed URL 経由で読む。
   - まずは `caption` / `extracted_text` / `file_name` を context に入れ、未OCRなら `file_name + caption` のみを使う。
5. **現行 plan cycle + MS**
   - `value_plan_cycles`: `project_id=<projectId>` かつ `period_start_ym <= ym <= period_end_ym`、`status in (active,confirmed,fixed,draft)`、最大 1 件
   - `value_milestones`: その `plan_cycle_id` の `is_active=true`、`sort_order asc`、最大 12 件
   - `milestone_monthly_progress`: 上記 `milestone_id` × `ym`
6. **SXワークスペース変更 (`p21`だけ)**
   - `GET $APP_BASE_URL/api/project-workspace/p21/automation-context?since=<直前の開催済みMTG日>&until=<今回MTG日>`を、`Authorization: Bearer $WORKFLOW_SECRET`（未設定時は`$CRON_SECRET`）で読む。
   - `changes[]`は件数上限で切らず、今回会議に関係する事実の照合に使う。
   - `meetingEvidence.claimBoundary='context_only'`を守る。ワークスペースに記録された事実だけで「今回会議で決まった」と書かず、会議sourceと一致した内容だけを`決まったこと`へ入れる。
   - 会議後にワークスペースへ反映すべき差分の重複確認にも使う。同じ`entity_type + entity_id`を別台帳へ作らない。

format:
```
=== os_context (AMD OS 側の文脈。今回MTGの意味づけに使う。ここだけを根拠に決定事項を捏造しない) ===
## project
project_id=... / project_name=... / status=... / category=...

## recent_previous_meetings
- YYYY-MM-DD <title>
  summary: ...
  next: ...

## known_next_or_prep_meetings
- YYYY-MM-DD <title>
  summary: ...

## sx_workspace_changes (p21 only / context_only)
- <changedOn> <entityType> <summary> / <fromStatus>→<toStatus> / source=<update_id>

## manual_meeting_assets
- <asset_kind> <file_name> (<media_type>)
  caption: ...
  extracted_text: ...

## active_milestones
- <MS title> / points=... / progress=... / criteria=...
```

長文は各項目 200-500 字で truncate。os_context 全体は最大 9000 chars。

### C-1: meeting_meta block

```
=== meeting_meta (これが対象 PJ の唯一の正解。これと無関係な内容は完全に無視) ===
projectId: <projectId>
projectName: <projects.project_name>
meetingTitle: <event.title sanitized>
meetingDate: <YYYY-MM-DD>
meetingId: <event.id>
ym: <YYYYMM>
sourceKinds: <source_kinds>
```

### C-2: alias block (= GAS 079 `nameAlias_buildBlock` 移植)

Supabase REST:
```bash
curl -s "$SUPABASE_URL/rest/v1/members?select=member_id,code_name,email,status&order=member_id" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
```

各 row について:
- `codeName` = members.code_name
- 別表記候補 = email local part (`@` 手前) (= NB: members に member_name 列があれば併用、無ければ skip)
- フォーマット:
  ```
  === 名前の正規化マップ (同一人物の別表記) ===
  [以下は AMD のメンバー一覧。同一人物が異なる表記 (姓 / 名 / 本名 / ローマ字) で
   入力に出てくることがある。LLM は以下のマップに従って **必ず code_name に正規化** して
   抽出すること。例: '山田氏' と書かれていたら 'りょー' と読み替える。'山地' は 'まさ'、
   'chiko' は 'ちこ'。誤って別人として扱わないこと。]

  - まさ = 山地 正洋, 山地, 正洋, masa  (= 同一人物、code_name は 'まさ')
  - ちこ = ... (以下続く)
  ```

### C-3: feedback block (= GAS 155 `_l2_loadFeedbackBlock_` 移植)

```bash
curl -s "$SUPABASE_URL/rest/v1/l2_feedbacks?l2_kind=eq.meeting_summary&target_id=eq.<projectId>&status=eq.active&order=created_at.desc&limit=20&select=feedback_id,scope_key,feedback_text,created_at,created_by" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
```

filter:
- `scope_key == event.id` または `scope_key == "global"` のものに絞る (= GAS と同じ)

フォーマット (= 該当ありなら):
```
=== 過去のユーザーフィードバック (重要・必ず反映すること) ===
  1. [YYYY-MM-DD masa] <feedback_text>
  2. [YYYY-MM-DD masa] <feedback_text>
  ...
```

`feedbackIds` = 上記の feedback_id list

### C-4: 抽出 prompt 生成 + Claude (= 私) が JSON 出力

入力データ:
```
=== meeting_meta ===
<C-1>

<C-0 os_context block>

<C-2 alias block>

<C-3 feedback block (該当ありなら)>

<manual_meeting_assets block (該当ありなら)>

=== combined sources ===
<combinedText>
```

**抽出ルール** (= GAS 074 prompt revision v4_alias_feedback と同じ):
- meeting_meta に書かれた `projectId` / `projectName` 以外の PJ の話題は **完全に無視**
- decided / progress / next_actions / risks は **各 1 文 1 項目**、5W1H 明確、固有名詞は alias map で **code_name に正規化**
- past_feedbacks があれば必ず反映
- summary_short は 80-180 字目安
- 該当事項なし field は `[]`、null / undefined は禁止
- 推測で書かない、combinedText に出てる事実のみ
- os_context は「今回の会議の意味づけ」に使う。前回からの流れ、MSとの関係、次MTGへ持ち越す論点は narrative_md に書く。ただし os_context だけにある内容を「今回決まったこと」にしない
- manual_meeting_assets は画面共有・表・スライドなどの補助根拠。caption / extracted_text がある場合は narrative_md の「添付資料から見えること」に反映してよいが、画像を読めていないのに中身を断定しない
- drive source は会議資料・招集通知・議案・予実表・報告資料として扱う。Drive だけを根拠に「会議で決定した」とは書かず、`資料上の論点` / `会議前に確認すべき資料` / `当日確認された資料` として narrative_md に位置づける。Notion/Gmail/Slack の発言根拠と一致する場合だけ decided に寄せる。
- 雑談 / 個人事情は除外 (= MTG として意味のある合意・進捗・課題だけ)
- narrative_md は必須。900-2200 字を目安に、**必ず次の Markdown 見出しをこの順で置く**。見出し文言・絵文字・順序を変えず、絵文字と語の間に空白を入れない。背景と経緯は、その場にいなかったメンバーが前提知識なしでも会議の流れを追える粒度の段落で書く。
  - `## 🎯背景`: なぜこのMTGが必要だったか、前提となるPJ状況・相手・直前までの文脈を書く。
  - `## 📊経緯`: 何が議題になり、議論や共有事項がどう動いたか、MSや事業判断への意味も含めて流れを書く。
  - `## ✅決まったこと`: 実際に合意・確認・採択されたことを、1項目1論点の `- ` 箇条書きで書く。未決事項やDrive資料だけの推定を決定済みにしない。
  - `## ▶️次の一手`: 次に誰が何をするかを、1項目1アクションの `- ` 箇条書きで書く。期限・担当・会議候補が分かる場合は同じ項目に含める。
  - `## ⚠️残課題`: 未決・リスク・確認待ち・根拠不足を、1項目1論点の `- ` 箇条書きで残す。
- **セクション別の表現を固定する**。`## 🎯背景` と `## 📊経緯` は段落で書き、箇条書きにしない。`## ✅決まったこと`、`## ▶️次の一手`、`## ⚠️残課題` は `- ` の Markdown 箇条書きで書く。番号付きリストとチェックボックスは禁止。Markdown table は、元データに表がある場合だけ許可。
- 元のAI議事録やNotion/Gmail/Drive資料にまとまった本文がある場合は、要点だけに潰さず、読み手が会議の流れを復元できる粒度で narrative_md に残す。`decided` / `progress` / `next_actions` / `risks` は検索・通知用の補助フィールドであり、議事録本文の代替ではない。
- **JSON 以外の文字一切出力禁止** (= markdown ブロックも禁)

**出力形式**:
```json
{
  "summary_short": "<議事録全体を 1-2 文の短いサマリ>",
  "decided": ["<決定事項 1>", "..."],
  "progress": ["<進捗事項 1>", "..."],
  "next_actions": ["<次のアクション (担当者を含める)>", "..."],
  "risks": ["<リスク 1>", "..."],
  "narrative_md": "<## 🎯背景 → ## 📊経緯 → ## ✅決まったこと → ## ▶️次の一手 → ## ⚠️残課題 の固定順。背景・経緯は段落、後半3セクションは1項目1論点の箇条書きで、欠席メンバーでも流れが分かる900-2200字の議事録 markdown>"
}
```

═══════════════════════════════════════════════════
Phase D: Supabase upsert + 通知
═══════════════════════════════════════════════════

### D-1: project_meeting_summaries upsert

upsert 前に品質 gate を必ず通す。

- `source_kinds != "none"` なのに `narrative_md` が空、または trim 後 500 字未満なら保存しない。
- `## 🎯背景` / `## 📊経緯` に箇条書き行がある、または `## ✅決まったこと` / `## ▶️次の一手` / `## ⚠️残課題` に `- ` 以外の番号付きリスト・チェックボックスがある場合は保存しない。後半3セクションに事実がある場合は、各項目が `- ` で始まることを確認する。
- `narrative_md` が `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の固定順を満たさない場合は保存しない。表記ゆれ (`## 🎯 背景`、`## 📊経緯・進捗` など) も `blocked_wrong_narrative_headings` として扱う。
- 既存 row の `narrative_md` が 300 字以上あり、新しい `narrative_md` が空・短い・セクション別の段落/箇条書き構造を満たさないなら保存せず、`skipped_preserve_existing_narrative` として run summary に書く。
- 手動 backfill でもこの gate は同じ。過去議事録を入れる時も `summary_short` と配列だけで `project_meeting_summaries` に直書きしない。

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/project_meeting_summaries?on_conflict=meeting_id" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=minimal" \
  --data @<json-file>
```

row 構造:
```json
{
  "meeting_id": "<event.id>",
  "project_id": "<projectId>",
  "ym": "<YYYYMM>",
  "meeting_date": "<YYYY-MM-DD>",
  "meeting_start_at": "<event.start.dateTime ISO>",
  "title": "<event.title sanitized>",
  "notion_url": "<notionUrl or null>",
  "notion_page_id": "<notionPageId or null>",
  "calendar_event_id": "<event.id>",
  "gmail_thread_ids": ["..."],
  "source_kinds": "<source_kinds>",
  "summary_short": "<extracted.summary_short>",
  "decided": [...],
  "progress": [...],
  "next_actions": [...],
  "risks": [...],
  "narrative_md": "<extracted.narrative_md>",
  "prep_source_meeting_id": "<upcoming:event.id が既存ならその meeting_id / 無ければ null>",
  "source_hash": "<newHash>",
  "generated_at": "<ISO now>",
  "generated_by_model": "anthropic:claude-sonnet-4-7@claude-routine"
}
```

`title` の sanitize (= GAS 074 `_meeting_sanitizeTitle_` 移植):
- ISO 8601 `\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*` → `YYYY/MM/DD HH:MM` に置換
- `<mention-date ...>...</mention-date>` 除去
- `@今日...` 除去
- 空白整理

### D-1b: Drive会議資料を MTGカードの添付として取り込む (= 毎run self-healing)

D-1 で開催済み row を保存したら、**同じ run で必ず**この route を呼ぶ。B-4 で読んだ Drive 資料は narrative の材料にしただけで、`meeting_assets` の行にはならない。行が無いと PJ コックピットのMTGカードは「添付なし」のままになり、まさは Drive を自分で開くことになる。

```bash
curl -s -X POST "$APP_BASE_URL/api/meeting-assets/adopt-drive-folder" \
  -H "Authorization: Bearer $WORKFLOW_SECRET" \
  -H "Content-Type: application/json" \
  --data '{"meeting_id":"<event.id>","dry_run":false}'
```

- `drive_folder_id` は省略してよい。route が `meeting_date` の `YYMMDD` で PJフォルダ直下を前方一致で探す。B-4 で候補 folder を特定できている場合だけ `"drive_folder_id":"<folder id>"` を足す。
- 追加専用。既に `meeting_assets` にある `drive_file_id` はスキップされるので、毎 run 呼んでも重複しない。**one-time backfill script を作らず、この呼び出しで揃える。**
- 末尾 `_prep` の folder は route 側で除外される。
- `adopted` が 0 件でも失敗ではない。`driveFolders` が空なら「その日付のMTGフォルダがまだ無い」だけなので、run summary に件数だけ残して次へ進む。
- 402/403/502 が返っても H-1 は止めない。`review_required` として run summary に残し、以降の Phase を続ける。

### D-2: meeting_notifications upsert (= iOS APNs 通知)

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/meeting_notifications?on_conflict=meeting_id" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=minimal" \
  --data '{"meeting_id":"<event.id>","project_id":"<projectId>","title":"<title>","source_kinds":"<source_kinds>","summary_short":"<extracted.summary_short>"}'
```

(= notified_at は null のまま挿入 → iOS 側 polling が APNs 送信 → notified_at=now() 更新)

### D-3: feedback applied_count++ (= feedbackIds が空でないとき)

各 feedback_id について:
1. 既存 applied_count を取得:
   ```bash
   curl -s "$SUPABASE_URL/rest/v1/l2_feedbacks?feedback_id=eq.<id>&select=applied_count" \
     -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
   ```
2. PATCH で `applied_count = (取得値 + 1)` + `last_applied_at = <ISO now>`:
   ```bash
   curl -s -X PATCH "$SUPABASE_URL/rest/v1/l2_feedbacks?feedback_id=eq.<id>" \
     -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
     -H "Content-Type: application/json" \
     -H "Prefer: return=minimal" \
	   --data '{"applied_count":<+1>,"last_applied_at":"<ISO now>"}'
	   ```

### D-4: 次MTGカード生成 (= exact date/time のみ)

保存した議事録 row の `decided` / `next_actions` / `narrative_md` に、`6/11（水）15:00` や `2026-06-11 15:00` のような **日付と時刻が両方ある** 次MTG表現があれば、PWA の deterministic workflow を呼ぶ。

```bash
curl -s -X POST "$APP_BASE_URL/api/meeting-workflow/finalize" \
  -H "Authorization: Bearer $WORKFLOW_SECRET" \
  -H "Content-Type: application/json" \
  --data '{"meeting_id":"<event.id>"}'
```

workflow 側のルール:
- 複数候補があれば最大 6 件まで `project_meeting_summaries` に `source_kinds='upcoming'` で保存する。
- `next_meeting` が明示指定されない限り Google Calendar event は作らない。Calendar は source of truth ではなく、予定カードは OS 上の準備ブリーフとして作る。
- `6月3週目以降`、`日程調整`、`候補日未定` のような曖昧な候補は確定予定として自動保存しない。必要なら `POST /api/meeting-prep` に `is_tentative=true` を渡して `source_kinds='upcoming_tentative'` として仮置き保存する。仮置き row は PWA の「日程調整中MTG」に残る。
- 旧 fallback の「次MTG指定がなければ7日後に1件」は禁止。架空カードを作らない。

═══════════════════════════════════════════════════
Archive: 廃止したH-1内 Phase P (= 2026-07-20で停止)
═══════════════════════════════════════════════════

> **実行禁止**: 下の旧Phase Pは移行履歴として残すだけで、H-1は読んでも実行しない。future upcomingのCalendar直読、claim、visible prep thread作成、Notion context gate、えいみBot nudgeはすべて `w-prep-launch` の責務。H-1が同じMTGのprepを起動すると、長時間化と重複thread事故の両方を起こす。

### 旧 Phase P-1: 対象 MTG 抽出

```sql
SELECT pms.meeting_id, pms.project_id, pms.title,
       pms.meeting_start_at, pms.calendar_event_id,
       pms.prep_worker_status, pms.prep_calendar_event_id,
       pms.prep_worker_session_id, pms.prep_worker_ready_at,
       pms.prep_concierge_nudged_at,
       p.status AS project_status
FROM project_meeting_summaries pms
JOIN projects p USING (project_id)
WHERE pms.source_kinds LIKE '%upcoming%'
  AND pms.source_kinds NOT LIKE '%upcoming_tentative%'
  AND pms.meeting_id NOT LIKE 'upcoming-tentative:%'
  AND pms.meeting_start_at IS NOT NULL
  AND pms.meeting_start_at > now()
  AND pms.meeting_start_at < now() + interval '7 days'
  AND p.status IN ('active', 'sales');
```

ended / frozen / `freeze_from_ym <= 当月ym` は対象外。recurring MTG は既に `calendar-sync` 段階で series 次回1件に絞り込まれている。

### 旧 Phase P-2: 各 MTG ごとに処理 (順次)

各対象 MTG について:

**A) ＋ prep 枠 (Calendar event) の作成 or 追従**

> **基本方針 (2026-06-24 まさ確定: F2+F3)**: prep 枠は deterministic に `meeting_start_at - 24h` 起点で作る。freebusy / get_colors / GAS color diagnostic などの外部依存に失敗しても **Phase P 全体を skip しない**。Calendar 書き込み自体が失敗した場合も spawn は進める (prep 枠は「動かせるタスク = まさが手動でドラッグ調整する」前提なので、枠が無くても worker session 自体は無条件で立ち上げる)。

- `prep_calendar_event_id` が **null** の場合:
  - **基準時刻**: `meeting_start_at - 24h` を prep 枠 start の基準として採用 (= 外部依存ゼロで必ず計算できる)
  - **freebusy が取れた時のみ前倒し**: `get_availability` が成功した場合のみ、`max(now, 同シリーズ前回 MTG +1日後 09:00 JST)` から `meeting_start_at - 24h` までの window で **最初の 30 分以上の空き枠** を探し、見つかればそこに前倒しする
  - **freebusy が取れない場合 (= `ACCESS_TOKEN_SCOPE_INSUFFICIENT` 等) は基準時刻のまま進める**。Phase P 全体を `review_required` に降ろさない
  - 所要時間見積: **1.5h 固定** (readiness 計算後の見積を待たない)
  - Calendar に `summary='＋ <PJコード> MTG準備: <MTG タイトル>'`、`description='meeting_id=<id>'`、`extendedProperties.private={'amd_os_prep_meeting_id': '<id>'}` で event を create
  - **Calendar 書き込み自体が失敗 (= `create_event` MCP エラー、scope 不足、その他) した場合**: `prep_calendar_event_id` は null のまま、ただし B 側の spawn 判定では「prep 枠が無いなら基準時刻 = `meeting_start_at - 24h` を spawn 起点として扱う」。**MTG を skip しない**
  - 作成成功時のみ event id を `prep_calendar_event_id` に保存
- `prep_calendar_event_id` が **NOT null** の場合 (= 既存):
  - Calendar から event を read
  - event が **削除されてた**ら `prep_calendar_event_id=null` にして当該 H-1 run 内では再生成 (= 1 run 内で create を再試行。それでも create 失敗なら B へ進む)
  - event の `start.dateTime` が変わってた (= まさがドラッグした) ら新 start time を採用
  - 既存 spawn 状態 (`prep_worker_status='ready'` 等) は維持

**B) spawn 判定**

- 「**spawn 起点時刻**」を決定:
  - `prep_calendar_event_id` が NOT null → その event の start time
  - null (= Calendar 書き込み失敗 or freebusy 経路で枠が立たなかった) → `meeting_start_at - 24h` を基準時刻として採用
- 現在時刻が spawn 起点時刻に達してるか?
  - 達してない → skip (= 次回 H-1 run まで待つ)
  - 達してる + `prep_worker_status IS NULL or 'failed'` → spawn 実行へ
  - 達してる + `prep_worker_status IN ('preparing', 'ready')` → skip (= 既に spawn 済み or 完了済み)

**C) codex exec で新規 session spawn**

```bash
codex exec --skip-git-repo-check --json \
  --output-last-message /tmp/amd-os-prep-{meeting_id_hash}-out.txt \
  -C /Users/masa/projects/AMD/amd-os \
  "あなたは {MTG タイトル} 専属の prep worker。pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md と pwa/scripts/l6_prep_notion_context_gate.cjs を読んで、meeting_id={meeting_id} project_id={project_id} で実行。Notion AI Meeting Notes context gate が needs_insert のままなら ready にしない。Phase 1-10 完遂後、対話可能な状態で待機する (= 自動で session を閉じない、まさが入ってきたら prep_draft_md を文脈に対話継続)。"
```

- subprocess 起動。終了を await しない (= H-1 はすぐ次の MTG に進む)
- ただし起動直後の最初の数秒は wait して `session id: <UUID>` 行が標準出力に出るのを catch
- catch した UUID を `prep_worker_session_id` に保存
- 同時に upsert: `prep_worker_status='preparing'` + `prep_worker_spawned_at=now()`
- subprocess は background で走り続ける。session 内の worker prompt は、Notion AI Meeting Notes context gate が `injected` / `already_present`、または完了扱いの失敗状態 (`not_found` / `write_failed` / `ambiguous` / `wrong_page` / `skipped_after_meeting`) になるまで `prep_worker_status='ready'` にしない。`needs_insert` のまま ready upsert するのは禁止。

**D) ready 達成検知**

H-1 run 内で `prep_worker_status='ready'` かつ `prep_concierge_nudged_at IS NULL` の MTG を集める (= 前回以前の run で spawn 済み + 今回 ready になったもの)。これは Phase P-3 で Slack DM 送信対象になる。

### 旧 Phase P-3: まさ専用 Slack DM nudge

「ready 達成 + 未通知」MTG が 1件以上あれば、まさ専用 Slack DM を投げる。

1. 送信先解決:
   ```sql
   SELECT slack_id FROM members
   WHERE is_admin = true AND code_name = 'まさ' AND slack_id IS NOT NULL
   LIMIT 1;
   ```
   - 取れない場合は nudge skip + run summary に `nudge_skipped: masa_slack_id_unresolved`
2. えいみ名義で本文生成 (deterministic template):
   ```
   まさ、prep セッション立ち上げといたよ

   📌 {MTG タイトル} ({日付} {HH:MM}, {project_name})
      readiness {score}/100  {🟢/🟡/🔴}
      codex で開いてね、待機してるよ
      {readiness < 50 なら 1行コメント: 「資料draftは作ったけど着地点要相談」}

   {failed の MTG があれば別ブロック:}
   ⚠️ {MTG タイトル} ({日付} {HH:MM}, {project_name})
      prep セッション起動失敗 ({reason})
      手動準備して
   ```
3. 送信は `node /Users/masa/projects/AMD/amd-os/scripts/send-eimi-slack.mjs --channel <masa_slack_id> --file <sanitized_body_file>` だけを使う
   - 既存のGAS WebApp経由のえいみBot送信ルートを使う。ChatGPT の Slack connector、Slack MCP、まさのログイン済みアカウント、汎用 `SLACK_BOT_TOKEN` へのfallbackはすべて禁止
   - script が成功して `persona='eimi'` を返した時だけ送信成功とする
4. 通知に含めた全 MTG (ready / failed) の `prep_concierge_nudged_at=now()` を upsert

### 旧 Phase P エラーハンドリング (実行しない)

| 状況 | 対応 |
|---|---|
| Calendar `get_availability` / freebusy 取得失敗 | **当該 MTG を skip しない**。基準時刻 = `meeting_start_at - 24h` のまま A 以降を続行 |
| Calendar `get_colors` 取得失敗 | Phase P は色を使わない (= Phase A の責務)。**Phase P 側では blocker にしない**、続行 |
| `get_availability` の Google OAuth `ACCESS_TOKEN_SCOPE_INSUFFICIENT` | 同上。OAuth scope 修正は別タスクとして残し、Phase P は基準時刻 fallback で進める |
| Calendar event create 失敗 | `prep_calendar_event_id` は null のまま。**spawn は進める** (= B で「枠 null なら `meeting_start_at - 24h` を起点」とする)。`prep_worker_status='failed'` にしない |
| `codex exec` 起動失敗 | `prep_worker_status='failed'` + `reason='codex_exec_failed'`、subprocess kill |
| `codex exec` で session id catch できず | `prep_worker_status='failed'` + `reason='session_id_not_captured'`、subprocess kill |
| Slack DM 送信失敗 | `prep_concierge_nudged_at` 触らない (= 次回 run で再送試行) |
| えいみBot送信失敗 | DMを送らない。`prep_concierge_nudged_at` は触らず、`nudge_skipped: eimi_sender_unavailable` を残す |
| まさ slack_id 解決失敗 | nudge skip、run summary に記録 |

**重要**: 過去 (2026-06-22〜24) に Phase P が毎回 `ACCESS_TOKEN_SCOPE_INSUFFICIENT` / `NEXT_PUBLIC_GAS_API_KEY` 不在 / freebusy 不能を blocker 扱いして全件 `review_required` に降ろし、11件の prep が 1度も spawn されない事故が発生 (2026-06-24 まさ確認)。本表の F2+F3 フォールバックはこの再発防止が目的。「freebusy が無いから何もしない」は禁止。

### 旧 Phase P 禁止事項

- worker session の subprocess を `wait` しない (= 各 MTG ごとに subprocess を fire-and-forget で起動して次へ)
- 同じ MTG に複数 session を spawn しない (= `prep_worker_status` で防御)
- ended / frozen PJ の MTG に prep 枠を作らない
- recurring MTG の同シリーズで連続 occurrence (= 次回1件 + その後の occurrence) を同時に spawn しない
- まさ以外の Calendar に prep 枠を作らない (= まさ 2026-06-22 確定)
- `claude code` で spawn しない (= まさ 2026-06-22 確定、codex 一本化)
- 定額外トークン課金経路 (= OpenAI API key 等) で worker を spawn しない (= `~/.codex/auth.json` の `auth_mode='chatgpt'` のままにする)
- 通知の link / URL を貼らない (= まさは codex desktop を自分で起動する)
- ChatGPT連携やまさ名義で Slack DM を送らない。えいみBotが使えない時は通知を保留し、別名義で代送しない。

═══════════════════════════════════════════════════
Phase E: run summary
═══════════════════════════════════════════════════

ログを集計:
- Phase A: `scanned` / `in_window` / `skipped_excluded` / `skipped_no_pj` / `processed`
- Phase B: source_kinds 別件数 (= notion / notion+gmail / notion+gmail+slack / gmail / drive / slack / none)
- Phase D: `saved` (= 新規 + 更新) / `saved_none` / `skipped_unchanged` / `errors`
- feedback applied 件数

**まさへの報告** (= notifyOnCompletion で表示される。件数だけで終わらせない):

1. 最初に「H-1の仕事」を短く書く。
   - 例: `H-1は、終わった会議の議事録を作る、直近の議事録なしを再確認する、前後24時間の予定カードを同期し、ノーション議事録のひも付けを補完する係。今回は対象なし。`
2. 件数を出すたびに、直後へ必ず内訳リストを書く。
3. リストには、会議名 / 日時 / PJ / 今回の扱いだけを書く。raw本文、ノーション本文、個人情報、secret、Drive URL、Calendar URL、会議参加URLは書かない。
4. 同じ報告をローカル `reports/` と automation memory に確定する。会議記録・予定・ノーションひも付けを更新した時、人の判断が必要な時、処理が止まった時だけOS通知へ送る。既存カードの確認だけ、候補なし、変更なしではOS通知を送らない。通常のCodex task runでは、通知が必要な場合は成功後に次操作で現在の毎時runをアーカイブする。日次まとめへの追記はH-1本体では行わず、毎時45分のreviewerが未集約reportをまとめて送る。

テンプレ:
```
H-1の仕事: 終わった会議の議事録化、議事録なしの再確認、前後24時間の予定カード同期、ノーション議事録のひも付け補完。

確認件数: N件
確認した開催済みMTG:
- <会議名>（<日時>、<PJ>）: <新規保存/本文更新/既存維持/議事録なし/見送り>。<要確認があれば短い理由>

再確認した議事録なしMTG: K件
- <会議名>（<日時>、<PJ>）: <再探索したが本文なし/本文が見つかり保存/要確認>

予定カード同期: U件
同期した予定カード:
- <会議名>（<日時>、<PJ>）: <新規作成/更新/変更なし/重複削除>

ノーション補完: B件
ノーションを補完したMTG:
- <会議名>（<日時>、<PJ>）: <eventId補完/PJひも付け補完/参加メンバー補完/既存維持/要確認>

要確認: R件
要確認になったMTG:
- <会議名>（<日時>、<PJ>）: <何が足りないかを短く>
```

═══════════════════════════════════════════════════
【禁止】
═══════════════════════════════════════════════════

- GAS WebApp 経由で何かを呼ぶ (= dryRun アプローチ廃止、Claude が MCP 直叩き)
- 列名を想像で書く (= 必ず `pwa/design/db_schema.md` を grep してから insert/upsert payload を組む)
- meeting_meta に書かれた `projectId` 以外の PJ の話題を混ぜる (= 汚染防御)
- LLM が「議事録なし」と勝手判定 (= source_kinds 30 chars 閾値で判定済み、その結果に従う)
- 1 event について複数回 upsert
- raw な Notion / Gmail / Drive / Slack 本文を `decided` 等の配列に丸ごとコピペ (= 必ず 1 文 1 項目に分解)
- past_feedbacks を無視 (= まさの修正依頼が反映されない事故防止)
- bot メール / bot Slack メッセージ / 自動配信を抽出対象に含める (= GAS と同じ noise reduction)
- service_role 以外で Supabase を叩く (= anon key は RLS で蹴られる、必ず SUPABASE_SERVICE_ROLE_KEY)
- Calendar `list_events` の `eventTypeFilter` で `outOfOffice` 等の noise type を含める (= default 値で OK)
- Notion 再認証を terminal blocker にする (= `blocked_notion_auth` / `waiting_for_reauth` 禁止。`pwa/design/h1_source_auth_fallback.md` の fallback ladder を実行する)

═══════════════════════════════════════════════════
【参考】
═══════════════════════════════════════════════════

- 既存 GAS の `MEETING_HOURLY_CRON_DISABLED_20260522 = true` は維持 (= GAS 完全 bypass、復活させない)
- 既存 routine `amd-os-management-dialogue-prep` (= daily 07:00 JST) と並列実行されることを想定
- `members` テーブルに `member_name` 列が無い (= 2026-05-25 #71 確認時点)。alias map は code_name + email local part だけで動かす (= GAS 079 想定の member_name 部分は skip)。後で migration で member_name 追加してまさが入れれば自動で alias 充実
- 5/22 〜 5/25 の取り込み穴期間は別 task で backfill (= `--backfill-from 2026-05-22` モード追加 or 一時手動キック routine 別建て)
- Calendar `list_events` MCP の `pageSize` は最大 250、過去 4 時間なら 50 で十分
- Notion `notion-search` の `data_source_url` には議事録 DB の collection URL を指定すると効率的、無くても workspace 全体検索で動く
- Gmail `search_threads` の query 構文は Gmail 標準 (= `after:YYYY/MM/DD`、`OR`、`from:`)
- 議事録 DB ID と PJ DB ID は GAS の ScriptProperties (= `NOTION_DATABASE_ID` / `NOTION_PJ_DATABASE_ID`) から取得していたが、Claude routine からは search の query で動く。固定したい場合は別 task で env 化
