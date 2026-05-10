# BUGS.md — AMD OS PWA

バグ発見 → ここに記録、解決 → 解決策を追記してクローズ。
根本原因（なぜそうなったか）と解決策を必ずセットで書く。

---

### [GAS] SX (p21) 繰り返し MTG `int) SX 社内打ち合わせ` で議事録抽出が空になる
- **発見日**: 2026-05-10 (まさ指摘)
- **状態**: 🟡 原因特定済 (修正は次セッション)
- **症状**: PWA `/project/p21/cockpit` で SX の MTG サマリを開くと、3/24 の `SX)int-納品物相談` 以外は summary_short が空 / 「議事録なし」 / 「対象 PJ に関連する議事録が確認できず」
- **原因**:
  - 繰り返しイベント `timth289ausur5avf894qtpekl_*` / `738970jsaspt5h9vcv4l1ef2hk_*` の Notion 議事録ページが **cron テンプレ「Meet（ここで /meet を打つ）」のままで本文ゼロ**。`sourceAiPageId` 空 (= AI 議事録ページが生成されてない)
  - 3/24 だけ中身あるのは単発イベント `0tji7sracmp1lvgtkbbv15i3iq` で、別途 Notion AI ページか人手議事録があったため
  - Gmail thread 2 件取れるが、LLM が「SX に関連しない」と判定して空返却 (gas/074 v4_alias_feedback プロンプトが SX = solvioraX を alias resolve できない可能性)
  - cron テンプレ停止後 (`run_createMinutes_apply` trigger 削除済) Notion AI 一本化したが、SX 繰り返し MTG では Notion AI が議事録自動生成してない (= 録音 OFF or 機能未連携)
- **次セッションの修正候補**:
  - (a) **Notion AI 設定確認**: SX 系 MTG (繰り返し instance) で AI 議事録自動生成が有効になってるかまさが確認
  - (b) **Gmail 関連性判定の緩和**: gas/074 のプロンプトで「SX = solvioraX」alias を強める。`_meeting_resolveProjectName_` 拡張
  - (c) **Slack ingest**: SX 専用 Slack channel から MTG 周辺のメッセージを取り込む新ロジック (Phase 4.x で計画済)
- **教訓**:
  - 議事録抽出が空のとき「LLM が空返した」「Notion ページが空」「Gmail に関連 thread なし」を区別する必要
  - `nav_meeting_processOneEvent_` を `force:true` で叩くと sourceKinds / gmailThreads / summaryShort が分かるので原因切り分けに使える

---

### [AMD OS PWA] AMD Score 律速判定が α 小さい軸を常に選ぶ退化バグ
- **発見日**: 2026-05-09
- **状態**: ✅ 解決済み
- **症状**: AMD Score 詳細ページ・モーダルでどの PJ も律速軸が **SRL** にマークされていた。SRL は default で α=0.2 (最小)。
- **原因**: `pwa/src/lib/amd-score.ts` の `calculateAmdScore` で `bottleneck = argmin(contributionShares[axis])` としていた。寄与シェア = `α_i · log(X_i + 1) / Σ` なので、**α が小さい軸ほど share も小さい** → α が小さい軸が常に律速になる。値 X が低いから律速ではなく、重み α が小さいから律速、という退化した定義だった。
- **解決策**: Cobb-Douglas の偏微分から `∂S/∂X_i = α_i · S / (X_i + 1)` なので、`bottleneck = argmax_i α_i / (X_i + 1)` に修正。重み α が大きいのに値 X が低い軸 = 限界収益最大 = 経営アクションで最初に手当てすべき軸。
- **教訓**: 「律速」「ボトルネック」「rate-limiting」のような経済概念を実装するときは、原典の偏微分定義 (Cobb-Douglas なら `∂S/∂X_i`) から逆算する。シェアや寄与度から argmin/argmax を雑に取ると退化する可能性。理論ファイル `before-zero/theory/amd_score.md` §6.6 を新規追加して Cobb & Douglas (1928) の引用つきで定義した。

---

### [AMD OS PWA] amd_score_inputs に未来 retrofit seed が入って「最新」が未来評価になる罠
- **発見日**: 2026-05-09
- **状態**: ✅ 解決済み
- **症状**: SX (p21) の AMD Score 詳細ページで TRL=6 と表示してるのに subtitle 引用 (project_xrl_log) は「TRL4 が維持」と矛盾。CX (p20) も同様。
- **原因**: `amd_score_inputs` テーブルに retrofit 用の **未来予想 (2027-04, 2027-05, 2028-09 等)** seed が入っていた (理論検証用、Phase D セッションで投入)。`AmdScoreView` で `inputs[inputs.length - 1]` を「最新」として取ると、未来評価が選ばれる。一方 `project_xrl_log` の現在観測は 2026-05 時点なので、両者がミスマッチ。
- **解決策**: `evaluated_at <= today` でフィルタしてから最新を取る。経時グラフは全期間表示維持。
  ```ts
  const today = new Date().toISOString().slice(0, 10);
  const latest = (() => {
    for (let i = inputs.length - 1; i >= 0; i--) {
      if (inputs[i].evaluated_at.slice(0, 10) <= today) return inputs[i];
    }
    return null;
  })();
  ```
- **教訓**: retrofit / シミュレーション用の **未来データ** を本番テーブルに seed する場合、「最新」を取るロジックは **現在時刻でフィルタする必要がある**。同様の罠は他のテーブル (project_events, l2_extract_state 等) にも潜在。今後 `evaluated_at` / `observed_at` を持つテーブルで latest を取るときは today filter を意識する。

---

## フォーマット

```
### [AMD OS PWA] バグタイトル
- **発見日**: YYYY-MM-DD
- **状態**: 🔴 未解決 / 🟡 調査中 / ✅ 解決済み
- **症状**: ユーザーが体験した現象
- **原因**: 技術的な根本原因（症状ではなく「なぜ」を書く）
- **解決策**: 何をどう直したか
- **教訓**: 次のえいみが同じ間違いを犯さないために
```

---

### [GAS] BWE 株主総会の MTGサマリ枠に CX (Kiutra/CryoX) のメールが混入

- **発見日**: 2026-05-09
- **状態**: ✅ 解決済み (LLM プロンプト v3 化 + 会議メタ明示で再発防止)
- **症状**: PWA `/notifications` で 5/9 13:00 「BWE 臨時株主総会」のサマリを開いたら、決定事項に「NIMS 神谷氏と CEO 候補に関する打ち合わせを 5/7 14:00 に実施」「末永氏が神谷PJ に参画」、進捗に「Kiutra への質問事項に関する量子冷却技術の調査アップデート」、リスクに「CryoX が想定する初期市場と Kiutra の棲み分け整理が必要」など、**完全に CX (p20、神谷PJ) の話** が並んでいた。
- **原因 (Gmail 経由の他 PJ 混入)**:
  1. Notion 議事録ページは `cron_createMinutesFromCalendar` 由来のテンプレ ("Meet（ここで /meet を打つ）/ 背景 / 本日の着地点 / メモ") のままで本文 64 字。実議事録は書かれていなかった
  2. `mr_extractFromGmail_` が p11 (BWE) の `reportEmails` で会議日 ±1日 (5/8〜5/10) の Gmail を検索 → 3 thread 取得:
     - "お打ち合わせのお願い" (KAMIYA Koji ↔ 鮫島昌弘、CX の CEO 候補打合わせ)
     - "新メンバー「あき」着任" (神谷PJ メンバーへの末永氏アナウンス)
     - "【CryoX】量子冷却技術に関する調査アップデート（末永）"
  3. すべて CX の打ち合わせメール。BWE.reportEmails にヒットした理由は **NIMS 関係者 6 人** (`MATSUMOTO.Shinsuke@nims.go.jp` 等) が登録されており、CX の打ち合わせメールに NIMS 関係者が CC されると `(from:X OR to:X)` フィルタを通過するため
  4. LLM プロンプト (v2) には会議タイトル / PJ 名 / 日付が一切渡らず、`projectId: p11` という符号のみ。「これは BWE 株主総会で、CX/NIMS の話は別 PJ」を判別する材料がなかった
  5. → LLM が Gmail 3 thread の内容を「BWE 株主総会の議事録」として真面目に抽出し、4 軸すべて CX 内容で埋めた
- **解決策 (v3 化、再発防止)**:
  - **(A) LLM プロンプト v3 (`gas/092_AdminLLMExtractors.js` `meeting_extract_basePrompt_` + Protocol Store version `260509_03`)**:
    - 入力構造に `=== meeting_meta ===` セクション (projectId / projectName / meetingTitle / meetingDate / ym / sourceKinds) を冒頭追加し「これが**唯一の正解**」と明示
    - 「🚨 最重要ルール: 対象 PJ と無関係な内容は完全に無視する」を強調。NIMS / 大学 / 大企業など複数 PJ 重複組織の cc 経由混入の実例 (BWE/CX の事故そのもの) をプロンプトに明記
    - 関連が無ければ「対象 PJ に関連する議事録が確認できず」と書いて配列は空 [] を返せ、と命令
  - **(B) `gas/074_MeetingSummaryRepo.js`**:
    - 定数 `MEETING_EXTRACT_PROMPT_VERSION = "v3"` 追加
    - userPrompt に meeting_meta セクションを追加 (projectName は新 helper `_meeting_resolveProjectName_` で resolve、`mr_gmail_getProjectInfo_` の DB_Projects 経由)
    - `source_hash` 計算に prompt version を **混ぜる**: `sha256("prompt=v3\n" + combinedText)` → prompt 改訂で全行再抽出される
    - `nav_meeting_extractForProjectYm_` / `nav_meeting_processOneEvent_` 双方で適用
  - **(C) debug 関数 `gas/157_MeetingDebugInspector.js` 新規**:
    - `debug_meeting_inspectEvent(eventId, projectId)` で Notion 本文 + Gmail thread の subject/from/body 抜粋を返す。今後の汚染調査用に常設
  - **(D) 検算済**: BWE 5/9 event を `nav_meeting_processOneEvent_` で再抽出 → 4 軸すべて空 `[]`、`summary_short = "BWE臨時株主総会に関する具体的な議事録や関連情報は確認できませんでした。"` で上書き成功
- **教訓**:
  - **LLM に対象を判別させるなら、対象のメタ情報を必ずプロンプトに明示する**。`projectId: p11` のような符号だけ渡しても LLM は「p11 が BWE か CX か」分からない。`projectName` / `meetingTitle` / `meetingDate` は必須メタ
  - **メアドフィルタは内容フィルタではない**。`reportEmails` の OR フィルタは to/from ヒットだけで集めるので、複数 PJ 重複組織 (NIMS / 大学 / 大企業) の人を登録すると別 PJ メールが流入する。**運用ルール**: reportEmails には PJ 専属の人だけ登録するのが理想。重複組織の人を登録するなら LLM 側でフィルタする責務を持つ
  - **prompt version を source_hash に混ぜる**設計は、prompt 改訂時の自動再抽出 (差分検知だけだと永遠にスキップされる) を保証する。今後の MTGサマリ系 prompt 変更時もこのパターンに従う
  - **debug 関数を常設しておく**(`debug_meeting_inspectEvent`)。汚染が疑われたら 1 コマンドで Notion 本文 + Gmail thread の生テキストを取れる状態にしておくと、原因特定が一瞬で終わる
  - **修正依頼ループ (l2_feedbacks)** は症状を見つけてからの後処理。**根本原因 (プロンプト + メタ欠落)** と切り分けて、両方で対策する

---

### [GAS] time-trigger 上限 (1 script 20-100 個) を考慮せず ad-hoc trigger 設計してハマった

- **発見日**: 2026-05-09
- **状態**: ✅ 解決済み (設計変更)
- **症状**: MTGサマリ Phase 3 で「会議終了 +60 分にピンポイント発火」を実現するために、calendar event 1 個ごとに `ScriptApp.newTrigger.at(date)` で個別 time-trigger を作成する設計を実装。3 個 set した時点で `nav_meeting_setupHourlyScheduleTrigger_` が「このスクリプトに含まれているトリガーの数が多すぎます」エラーで弾かれた
- **原因**:
  - GAS の time-based trigger は **1 script あたり 20-100 個上限**
  - 本体GAS には既に 17+ 個の cron trigger があった (中には `cron_invoiceSendNudge_` が 4 重複してたものも)
  - そこに 1 週間ぶんの会議数 = 数十個の ad-hoc trigger を追加すれば確実に上限超え
  - 設計時にこの上限を考慮していなかった
- **解決策**:
  - ad-hoc trigger 方式を捨てて **「毎時 0 分の polling cron 1 個」** に切替
  - cron 内で「過去 60-180 分に終わった events」をスキャンする方式 (`nav_meeting_pollRecentlyEndedEvents`)
  - 重複処理は Supabase の `source_hash` 差分検知で防ぐ (=何度走らせても OK)
  - 終了 +60 分ピッタリには発火しないが +60 〜 +180 分のどこかで処理されるので実用上問題なし
- **教訓**:
  - GAS で「N 個のものに個別 trigger」設計は **絶対にダメ**。time-trigger は固定数 (= 数個) に抑え、callback 内で対象を loop する設計にする
  - 既存 trigger 数を `ScriptApp.getProjectTriggers().length` で先に確認するクセ
  - 重複 trigger (`cron_invoiceSendNudge_` × 4 等) は枠を浪費するので別途整理する (= TODO)

---

### [GAS] Web App curl 経由実行で `Session.getActiveUser().getEmail()` が空になる

- **発見日**: 2026-05-09
- **状態**: ✅ 解決済み
- **症状**: `nav_meeting_scheduleUpcomingTriggers_` を pwaApi 経由 curl で叩いたら `Error: calendarId empty (Session.getActiveUser().getEmail() returned "")` で失敗。ロジック内で「fallback で実行ユーザーのメール = まさのカレンダー」を取りに行ってたが空が返ってきた
- **原因**:
  - GAS Web App は実行モードが「Anyone (anonymous)」な場合、`Session.getActiveUser()` は空を返す
  - time-trigger 経由 (= deployment owner として実行) なら本来は取れるが、curl/Web App ルートでは取れない
- **解決策**:
  - `Session.getEffectiveUser().getEmail()` (= deployment owner = まさ) で代替
  - Web App 設定が "Execute as: Me" であれば effective user で deployment owner のメールが取れる
  - 加えて優先順位: 引数 override > CFG_CalendarImport > ScriptProperties.MAIN_CALENDAR_ID > Session.getEffectiveUser、で多段 fallback に
- **教訓**:
  - GAS の `Session.getActiveUser()` (実行者) と `Session.getEffectiveUser()` (script owner) の違いを覚える
  - Web App 経由でテストできるロジックは「引数 override」を実装してテスト容易性を上げる
  - 環境依存の値 (calendarId など) は ScriptProperties に逃がせる選択肢を作っておく

---

### [運用] worktree 取り違えで main worktree (作業ブランチ外) にコード書き込み事故

- **発見日**: 2026-05-09
- **状態**: ✅ 解決済み (リカバリ)
- **症状**: claude/brave-cohen-15d352 worktree で作業してたつもりが、Edit/Write ツールが `/Users/masa/projects/AMD/amd-os/` (= main worktree) のファイルに書いてしまった。`gas/074_MeetingSummaryRepo.js` の Phase 2 全書き直し / `gas/092_AdminLLMExtractors.js` / `pwa/scripts/migrations/026_pms_phase2_calendar_event.sql` (= 番号 026 が seeds_data_round2 と衝突！)
- **原因**:
  - 当セッションの worktree は `/Users/masa/projects/AMD/amd-os/.claude/worktrees/brave-cohen-15d352/` だが、Bash の cwd 操作や Edit パスで `/Users/masa/projects/AMD/amd-os/` (main worktree のルート) を直接指定してしまった
  - Migration 番号も別 worktree が既に 026 を取ってたが確認せず重複命名
- **解決策**:
  - main worktree の変更を brave-cohen worktree に `cp` でコピー、main の方は `git restore` + `rm` で巻き戻し
  - Migration を 026 → 027 にリネーム (中身の `-- 026:` も書き直し)
  - DDL apply は `.env.local` が main worktree にしか無いので main worktree から absolute path で実行する形に
- **教訓**:
  - worktree 内で作業中は **絶対パスでも worktree 配下を指す** こと。`/Users/masa/projects/AMD/amd-os/.claude/worktrees/<worktree>/` を起点にする習慣
  - Migration ファイル新規作成時は `ls scripts/migrations/` で **既存の番号を必ず確認** してから命名
  - `.env.local` が必要な script (= apply_ddl.py) は main worktree 経由で呼ぶ運用パターンを HANDOFF に明記

---

### [GAS] Notion 議事録ページが 1 会議で 2 つ生成される (cron テンプレ + Notion AI 自動生成) → cron 停止して一本化

- **発見日**: 2026-05-09 (BWE 臨時株主総会で cron テンプレ側が拾われて空抽出になる事故が継続発生)
- **状態**: ✅ 解決済 (cron 停止 + 074 fallback 強化、ただし既存 AI ページ救済は次セッション)
- **症状**: 1 会議で Notion 議事録 DB に 2 ページ並ぶ:
  - cron テンプレページ (35997749...): `eventId` プロパティ入り、本文は "Meet（ここで /meet を打つ）" の固定テンプレ 64 字
  - Notion AI / Meet 連携の自動生成ページ (35b97749...): `eventId` プロパティ空、本文は decided/採決結果まで詳細
  - `gas/074` の `_meeting_findNotionPageByEventId_` は eventId equals filter なので cron テンプレ側が掴まれて「議事録なし」抽出
- **原因**:
  - `gas/CalendarToNotionMinutes.js` の `cron_createMinutesFromCalendar` (実 trigger handler は `run_createMinutes_apply`) が前日 03:00 に「明日分の calendar event について議事録枠を自動生成」して Notion AI と分裂
  - 当初は Notion AI が議事録 DB にページを作ってくれない前提だったが、最近 Notion AI / Meet 連携が会議終了時に自動でページ生成するようになって (= eventId プロパティが空のまま) 重複に
- **解決策**:
  - **(A) cron 停止** (まさ判断): `nav_l2_pruneDuplicateTriggers("run_createMinutes_apply", 0)` で trigger 全削除 (1 → 0 個)
  - **(B) gas/CalendarToNotionMinutes.js 冒頭に DEPRECATED 警告**: 復活時の注意書き
  - **(C) gas/074 fallback 強化**: `_meeting_findNotionPageByEventId_` を eventId equals + 同日付 + タイトル contains の 3 段階 fallback に拡張。本文厚いページ優先採用
  - **(D) prompt v4_alias_meta 化**: meeting_meta セクション (projectId/projectName/meetingTitle/meetingDate) + alias block を userPrompt に追加、source_hash 入力に prompt rev を混ぜて全行再抽出を保証
  - GAS deploy v1438→v1441
  - 既存 AI ページ (35b97749...) の救済: title contains fallback でもなぜか Notion API から取れない (integration permission か filter 仕様の問題)。**次セッションで Notion connection の AI page access を確認 + AI page に eventId を後付けする one-time script を実装する** タスクが残る
- **教訓**:
  - **複数の自動生成主体が同じ DB に書き込む設計はダメ**。Notion AI が議事録を作る時代に、cron で空テンプレを並行生成すると分裂事故になる
  - L2_DATA.md / meeting_summaries.md に「議事録の自動生成は Notion AI 一本化、cron テンプレ自動生成は廃止」を明記する (運用ルール)
  - cron を止める判断は早めに。「念のため作っておく」が事故の元になることがある

---

### [GAS] PJナレッジ抽出で SE に CryoX/神谷 が紛れ込む (上流 monthly_reports の他 PJ 内容汚染)

- **発見日**: 2026-05-09 (まさからの直接指摘「SE のナレッジに CX の情報が入ってる」)
- **状態**: ✅ 解決済 (gas/155 防御強化 + 汚染レポートを status='invalid' で隔離)
- **症状**: PWA `/notifications` で「🗂️ SE (202604) PJナレッジ更新 (19 件)」展開すると CryoX/神谷/磁気冷凍/プランB/高砂 など **完全に CX (p20、神谷PJ) の内容**が SE PJ の knowledge として保存されていた (people: 神谷 / org: NIMS / strategy: MOU 先行 など 27 件)
- **原因**:
  - **PJナレッジ抽出のバグではなく、その入力ソース monthly_reports (= L2 ①) の汚染**
  - p10 (SE) 202604 の `draft_content` 全体が CX (CryoX/神谷/磁気冷凍) の内容で書かれていた
  - p20 (CX) 202604 も同じ CX 内容だが mojibake (= "?" だらけ、charset 失敗)
  - generated_at は p10 が 2026-04-01T10:31:15、p20 が 11:14:24 (= 約 43 分差で連続)
  - → **誰か (本リポ外: AMD-Report GAS R313 cron / MMO マシンの Claude Code scheduled task / 手動投入) が 4/1 に CX レポートを書こうとして project_id を p10 と誤紐付け、43 分後に p20 で再書き込みするも mojibake、最初の p10 行は削除されず残った** という事故痕跡
  - 仮説 A (reportEmails 経由 CX メール混入) は却下: SE.report_emails には CX 関係者は含まれていない
  - LLM はそれを「SE PJ のレポート」として渡されているので、書かれている CryoX/神谷 を SE のナレッジとして真面目に抽出 → 当然の挙動
- **解決策**:
  - **(A) PJナレッジ抽出の防御強化** (`gas/155_L2KnowledgeExtractor.js` `nav_project_knowledge_extractOneForYm_`):
    - userPrompt 冒頭に `=== project_meta ===` セクション (projectId / projectName / ym) を追加
    - systemPrompt に「monthly_report が他 PJ 内容で汚染されているケースがある (例: projectName='SE' なのに CryoX/NIMS神谷 が書かれている)。この場合は items: [] を返せ」と明示
    - source_hash 入力に `pv: "v4_meta_strict"` を混ぜて全行再抽出
    - これで上流データ汚染があっても LLM が他 PJ 内容を抽出しない二段防御
  - **(B) status='invalid' フィルタ**:
    - gas/155 の monthly_reports SELECT に `&status=neq.invalid` 追加 → `status='invalid'` のレポートは cron 入力対象外
    - 汚染レポートを発見したら `status='invalid'` でマーク → 自動的に再抽出対象外
  - **(C) データ修復** (= 即時):
    - p10/202604 monthly_report.status = 'invalid' に PATCH (= 1 行)
    - p10 source='l2_hourly_extract' な project_knowledge 27 行 DELETE
    - l2_extract_state (project_knowledge / p10) 2 行 DELETE → 次回 cron で fresh 再抽出
    - l2_notifications (project_knowledge / p10) 1 行 DELETE
  - GAS deploy v1447
- **教訓**:
  - **L2 抽出の防御は入力データの汚染を前提にする**。monthly_reports が手動 or リポ外 cron で汚染される可能性は常にあるので、抽出側で「project_meta と無関係な内容は抽出 0 件」防御を入れる (= 議事録 v3 化と同じパターン)
  - **手動投入 / リポ外 cron は project_id 取り違えが起きうる**。書き込み時に `draft_content` の冒頭に projectName を含める運用ルールにすると、後から汚染検出が容易
  - **次のタスク**: 全 monthly_reports をスキャンして汚染を検出する関数 (= projectName と無関係なキーワード混入を測る) を作る、上流の生成プロセス (R313 / MMO Claude Code task) の調査と修正は別セッション (= 本リポ外)
  - 同様に汚染している可能性: 他 monthly_reports 全件を探したいときは `draft_content ilike '%キーワード%'` で suspect を出して目視確認

---

### [GAS] member_knowledge 抽出で「きよ」に他人の活動が紐付くカオス (member_activities 列名 4 つ間違い)

- **発見日**: 2026-05-09 (Phase 4 メンバーナレッジ稼働後、まさからの直接指摘)
- **状態**: ✅ 解決済み (列名修正 + プロンプト強化 + 既存誤データ削除 + force 再抽出で確認)
- **症状**: PWA `/notifications` で `👤 きよ のメンバーナレッジ更新 (3件)` を展開したら以下が抽出されていた:
  - episodes: "NIMS 神谷氏との CEO 候補面談を調整、新メンバー末永氏のプロジェクト参画をサポート、プレシードからシリーズ A までの資金調達..."
  - skills: "資金調達ラウンド別の財務モデル設計、ピッチデック準備、VC 関係構築..."
  - work_style: "株主総会や資金調達に関する戦略的な打ち合わせに参加..."
  - **きよ は経営戦略系の活動はしていない事務担当**。BWE (p11) や SX (p21) の会議で議論された他人の活動が「きよ自身の活動」として抽出されていた
- **原因**:
  - `gas/155_L2KnowledgeExtractor.js` の `nav_member_knowledge_extractOne_` で `member_activities` テーブルから select する際、列名を 4 つ間違えていた:
    | 私が書いた | 実スキーマ |
    |---|---|
    | `code_name` | **`member_id`** |
    | `created_at` | **`extracted_at`** |
    | `activity_text` | **`content_preview`** (or `title`) |
    | `kind` | **`source`** |
  - PostgREST は存在しない列で filter すると `42703` エラーで返す → `actsRes.ok = false` → `acts = []` で進行
  - 結果、本人の活動 0 件 + そのメンバーが PJ メンバーである **全 PJ の会議サマリ** だけが LLM 入力に
  - きよ の場合 p10/p11/p20/p21 の 4 PJ の会議サマリ全部が入力になり、BWE 臨時株主総会 (= 神谷氏 / 末永氏の話) や SX) int-納品物相談 (= 資金調達ラウンド議論) を「きよの活動」として LLM が誤抽出
  - 設計時に member_activities の実スキーマを確認せず、HANDOFF の文章 (「member_activities テーブル」) だけ見て想像で書いた
- **解決策**:
  1. **列名修正**: `member_id` / `extracted_at` / `title` / `content_preview` / `source` で select + filter に修正。memberId が無いケースは early return (= no_member_id action)
  2. **プロンプト強化**: 入力テキストを `=== A) 本人の活動ログ ===` (= 自由抽出 OK) と `=== B) PJ 全体の会議サマリ ===` (= **本人が主体として明示されている事項のみ抽出**) で明確に分離。systemPrompt にも「セクション B は本人が主体とは限らない、確証なければ skip」と強調
  3. **既存誤データ削除**: `member_knowledge WHERE source='l2_hourly_extract'` (12 行) + `l2_extract_state WHERE l2_kind='member_knowledge'` (13 行) + `l2_notifications WHERE l2_kind='member_knowledge'` (2 行) を全 DELETE → 次回 cron で fresh 再抽出
  4. **検証**: きよ を `force=true` で 1 件再抽出 → 結果 `work_style: "愛媛大学との業務委託契約において、完了報告書や請求書の準備・送付など事務処理..."` (= きよの実業務として正しい)。skills/episodes が出ないのは「確証あるものだけ」の正しい挙動
  5. GAS deploy v1436 (clasp deploy 実体は @1438)
- **教訓**:
  - **新規 cron 実装時は対象テーブルの実スキーマを必ず Supabase 直叩きで確認** (= 列名を想像で書かない)。`curl ".../rest/v1/<table>?limit=1"` で 1 行取れば全列名がわかる
  - PostgREST の filter 不正列エラーは `.ok = false` で握り潰されると気づきにくい → 開発時は body を Logger.log するクセが欲しい
  - LLM 抽出系では「**入力ソースの主体性**」が常に焦点。複数ソースを混ぜるなら「これは本人主体」「これは PJ 全体 (本人主体とは限らない)」と LLM に明示分離する
  - フィードバック (l2_feedbacks) で個別に直すのではなく、**根本の入力ロジックを直す**ことが必要なケース (= まさの「ロジック見直して」が正解)

---

### [GAS] Phase 4 完成時点で cron_invoiceSendNudge_ が 5 重複に増えてた (汎用 prune 関数を追加)

- **発見日**: 2026-05-09 (Phase 4 ⑤④② 一括完了セッション)
- **状態**: ✅ 解決済み (今回 4 削除、根本原因の重複生成元の整理は別タスク)
- **症状**: `nav_l2_setupAllL2HourlyTriggers_` を実行したら GAS time-trigger 上限 (1 script 20 個) に達して 2 個目以降の作成が失敗。trigger 一覧確認したら `cron_invoiceSendNudge_` が **5 重複** (前回 brave-cohen セッションでは 4 重複と記録、間で 1 増えた)
- **原因**:
  - どこかの cron 内で `ScriptApp.newTrigger("cron_invoiceSendNudge_").timeBased()...create()` が無条件で呼ばれており、既存削除なしで毎回 1 個追加されている
  - GAS time-trigger 上限 = 20 個 (Workspace アカウントでも上限は変わらない)
- **解決策**:
  - 汎用整理関数 `nav_l2_pruneDuplicateTriggers(handlerName, keepCount)` を `gas/155_L2KnowledgeExtractor.js` 末尾に追加
  - 今回 `cron_invoiceSendNudge_` を keep=1 で 4 削除 → 18 個に減って Phase 4 用 3 trigger を追加できた
  - 汎用関数なので、将来も「重複 trigger N → keep M 個に整理」を curl 一発でできる
- **教訓**:
  - GAS で `newTrigger` を呼ぶ前は **必ず同名 trigger を delete してから create** する。ms_progress / Phase 4 各 setup 関数は既にそのパターンを採用済
  - 上限事故が起きたら `nav_l2_pruneDuplicateTriggers(handlerName, keepCount)` で即整理可能
  - **根本原因の重複生成元を特定して止める** タスクが残ってる (= grep で `newTrigger("cron_invoiceSendNudge_"` を find → 既存 delete を入れる)

---

### [AMD OS PWA] Vercel Hobby plan は cron schedule が daily 1 回までという制約

- **発見日**: 2026-05-09
- **状態**: ✅ 解決済み (GAS 経由構成で回避)
- **症状**: Phase 4 ③ MS進捗を毎時化するため `vercel.json` の `crons[].schedule` を `"0 * * * *"` に変更して `npx vercel --prod --yes` したら deploy が即時失敗:
  ```
  Error: Hobby accounts are limited to daily cron jobs.
  This cron expression (0 * * * *) would run more than once per day.
  Upgrade to the Pro plan to unlock all Cron Jobs features on Vercel.
  ```
- **原因**:
  - Vercel Hobby plan の cron 制約は「**個々の cron schedule が "1 日 1 回まで"**」(回数の制約)。cron **数** の上限ではない
  - 既存 14 cron は全て daily 1 回未満 (毎日 1 回 / 週 1 / 月 1 等) だったので Hobby のまま動いてた → 「14 cron あるから Pro plan」と誤推測した
  - cron schedule をチェックしていれば事前に分かった (`0 * * * *` は 1 時間ごと = 1 日 24 回 → NG)
- **解決策**:
  - `vercel.json` から `/api/cron/hourly-estimate` を削除 (route 自体は残す)
  - 本体GAS に `gas/154_PwaCronCaller.js` 新規:
    - `nav_pwa_pingHourlyEstimate(opts?)` — UrlFetchApp で `${PWA_BASE_URL}/api/cron/hourly-estimate` を `Bearer $CRON_SECRET` で叩く
    - `nav_pwa_setupHourlyPwaTrigger_()` — 毎時 0 分 time-trigger 設置
    - `nav_pwa_setProps_(props)` — ScriptProperties (PWA_BASE_URL / CRON_SECRET) を curl 経由で設定
  - GAS の毎時 trigger が PWA route を叩くことで、Vercel Hobby のままで毎時 polling を実現
  - Pro 移行後は vercel.json に schedule を戻して GAS trigger を消すだけで切替可能
- **教訓**:
  - Vercel plan の制約を確認するときは「cron 数」ではなく「個々の cron schedule の頻度」を必ず見る
  - Hobby plan で複数回/日 cron が必要なら、GAS / Cloud Scheduler / Lambda 等の外部 trigger から PWA route を `Bearer $CRON_SECRET` で叩く構成にする (route 自体は plan 非依存)
  - 「設定に阻まれたらまさに設定変更を依頼する」より「自動化で完結する代替案を検討する」を先に考える ([feedback memory] のセットアップ最小化方針に従う)

---

### [AMD OS PWA] PL/PM/クローザー編集で project_members が全部消える (全削除→挿入の副作用)

- **発見日**: 2026-05-08
- **状態**: ✅ 解決済み
- **症状**: admin/projects の「PL / PM / クローザー」列「✏️ 編集」で開く `AdminProjectMembersModal` で保存すると、これまでアサインしていた情報が「すべて削除されたように見える」現象。まさが連続で踏んだ
- **原因**:
  - `/api/admin/project-members` POST が "全削除→挿入" 方式: `DELETE FROM project_members WHERE project_id=?` → `INSERT` 渡された rows
  - INSERT する row には `role`, `id`, 既存の `role_label`, `join_ym` などが含まれず、副作用で値がリセットされる (`id` は新 UUID 再生成)
  - モーダル側でメンバー行が空配列になりうるパス (race / autocomplete blank / silent fetch fail) があると、削除だけ走って挿入 0 件 → 全行消失
  - HANDOFF 残タスクに「saveProjectMembers 全削除→挿入をやめて incremental update に」が放置されていた
- **解決策**:
  - `/api/admin/project-members` (POST) と `AdminProjectMembersModal` を **削除**
  - **新 API** `/api/admin/project-members/role` 新設: ロール (`pl|pm|closer`) 単位で集合を incremental 更新
    - 既存行 + 集合外 → `is_<role>=false` に UPDATE (行は残す)
    - 既存行 + 集合内 → `is_<role>=true` に UPDATE
    - 行なし + 集合内 → 新規行 INSERT (`is_<role>=true`、他フラグ false)
    - **他のフラグ・他のメンバー行・他の列 (role / role_label / join_ym / id) は一切触らない**
  - **新モーダル** `AdminProjectRoleEditModal`: ロール 1 つだけのチェックリスト + 「修正」ボタン
  - admin/projects テーブルの「PL / PM / クローザー」列を 3 列に分割、列セルクリックで該当ロール用モーダル
  - `lib/project-config-data.ts` の `saveProjectMembers` 関数を削除 (`MemberInput` 型は ProjectConfigForm の dead code が依存しているため互換目的で残す)
  - テーブル `min-width: 1200px → 1600px` に拡張 (列増分の横スクロール許容)
- **教訓**:
  - 「全削除→挿入」は同テーブルの他列を巻き込んで破壊する。incremental update が原則
  - 「all-or-nothing」型の API は、UI 側のどんな race / blank state でも全消失を引き起こす。書き込みは「触る列だけ更新」「触らない列は読まない」で書く
  - HANDOFF 残タスクで「再発防止」が書かれていたら優先度を上げる。同じ事故が起きた

---

### [AMD OS PWA] member_activities が UUID 型 + source check 制約で cron が空のまま (連鎖 3 件)

- **発見日**: 2026-05-08
- **状態**: ✅ 解決済み
- **症状**: 「CX 4月のイベントなし」とまさがフィードバック。member_activities テーブル全件 0 行で、cron `/api/cron/member-activities` を手動 trigger しても全 PJ で失敗していた
- **原因**: 連鎖 3 件
  1. `member_activities.milestone_id` カラムが DB に存在しなかった (cron は upsert key として使用)
  2. `member_activities.member_id` / `project_id` が **UUID 型** だった。PWA 全体は text "ID001" / "p20" で扱っているのに、insert で UUID syntax error
  3. `source` の check 制約が `slack | notion | gmail | gmeet | drive` のみ。cron は `inferred` を書こうとして check 違反
- **解決策**:
  - migration 020 で `milestone_id text` 追加
  - migration 022 で `member_id` / `project_id` を text に変換 (RLS policy / FK を一旦 DROP → ALTER → 再作成)
  - migration 023 で source check に `inferred` / `manual` / `cron_l2_extract` を追加
  - cron route 側でも LLM 出力の memberId が code_name (例: "まさ") の場合 member_id (ID001) に変換する fallback 追加
  - 結果: 4月再抽出で p21=11件 / p19=5件 保存成功
- **教訓**:
  - スプシ起源 (GAS が created) のテーブル + PWA で書き込む場合、列の型がアプリ側の前提と違ってないか **migration 適用前に必ず確認** する。`information_schema.columns` で SELECT すれば一発
  - check 制約は migration ファイルだけでは追いづらい。`pg_get_constraintdef()` で出力するスクリプトを残しておく
  - 「データが詰まってる」とユーザーが言っても、まず DB 列定義 / RLS / check 制約を疑う。表面の挙動だけ見ると遠回りする

---

### [AMD OS PWA] supabase.functions.invoke が "Failed to send a request to the Edge Function"

- **発見日**: 2026-05-07
- **状態**: ✅ 解決済み
- **症状**: 月次ルーティンの「請求書発行」ボタンを押すと `Failed to send a request to the Edge Function` エラーで発行できない。BudgetModal の admin nudge 送信なども同様
- **原因**: `supabase-js` の `client.functions.invoke()` が PWA + Vercel 本番環境で動作不安定。CORS / Network レイヤで失敗するケースがある (再現条件は不明)
- **解決策**: `pwa/src/lib/supabase/edge-functions.ts` に `callEdgeFunctionGET` / `callEdgeFunctionPOST` を新設。`fetch` で直接 `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}` を叩く。Authorization は anon key を Bearer で。iOS 版 (`URLSession` 直叩き) と同じ方式
- **教訓**: Edge Function 呼び出しは `supabase.functions.invoke` を使わず、生 fetch のヘルパーで統一する。POST/GET 両対応。GET (URL パラメータ) は `functions.invoke` ではそもそも叩けないので必須

---

### [AMD OS PWA] vercel ls がパイプ経由で URL のみ返す → deploy 通知が timeout

- **発見日**: 2026-05-07
- **状態**: ✅ 解決済み
- **症状**: `pwa/scripts/deploy.sh` の Build Ready polling が 10 分 timeout になり「ピコン」音が鳴らない (Build 自体は 5 分弱で成功してるのに)
- **原因**: `vercel ls --scope X projectName` を tty 以外 (パイプ) から呼ぶと、表ヘッダや status 列を出力せず **URL の行だけ** 返す仕様。awk / grep でステータス検出ができなかった
- **解決策**: `vercel inspect <deployment-url> --scope X` で個別 deployment の `status\t● Ready` 行を grep する方式に変更。これは tty 非依存で安定
- **教訓**: `vercel ls` は CLI tool として表示用。スクリプトから個別 deployment の状態を取りたい時は `vercel inspect` か Vercel REST API。CLI の挙動が tty 有無で変わるツールには注意

---

### [AMD OS PWA] /api/progress/events / reimbursement が GAS bridge 経由で数十秒の遅延

- **発見日**: 2026-05-07
- **状態**: ✅ 解決済み
- **症状**: 月次モーダルを開いてから「読み込み中」が出て、データが出るまで数十秒。まさが「supabase じゃなくてスプシ見に行ってない?」と疑問
- **原因**: `/api/progress/events` も `/api/progress/reimbursement` も `NEXT_PUBLIC_GAS_WEBAPP_URL` 経由で GAS の `rewardDashboard` / `reimburseForMonth` を叩いていた。GAS はスプシ読み出しなので遅い (1 リクエスト 5-15 秒)
- **解決策**:
  - `/api/progress/events` を Supabase の `member_activities` テーブル直読みに置換
  - `/api/progress/reimbursement` を `reimbursements` テーブル直読みに置換
  - 両方とも auth.supabase 経由 (RLS で安全)
- **教訓**: PWA は「Supabase 直読みが正本、GAS bridge は legacy」の方針 (`design/SPEC_pwa.md`)。GAS bridge 残ってるルートは順次 Supabase 直読みに置き換える

---

### [AMD OS PWA] project_members の編集が anon RLS で書き込めない

- **発見日**: 2026-05-07
- **状態**: ✅ 解決済み
- **症状**: AdminProjectMembersModal で PM/クローザーチェック変更 → 保存で `new row violates row-level security policy for table "project_members"` エラー
- **原因**: `saveProjectMembers` が browser anon クライアントで delete/insert していた。RLS が anon の write を弾く
- **解決策**: `/api/admin/project-members` route 新設 (createAdminClient で service_role)。`saveProjectMembers` は fetch でこの route を叩く形に
- **教訓**: 書き込みが必要な admin 機能はすべて API route 経由 + service_role。client-side で書こうとしない (RLS にあたる)

---

### [AMD OS PWA] 月次ルーティンの各ステップが全部「月次モーダル」を開く回帰 (3度目)

- **発見日**: 2026-05-07
- **状態**: ✅ 解決済み
- **症状**: cockpit 右カラムの「月次ルーティン」内の各タスク (請求額確定 / 報告会日程調整 / 月次報告書FIX / 立替精算確認 / 請求書発行 / 請求書送付) を **どれをクリックしても同じ月次モーダル** が開く。本来は stepId 別に専用モーダル/遷移を開くべき
- **原因**:
  - 元実装は別リポ (archive 済 `amd-os-pwa`) にあり、それを Swift に移植した。さらに今のモノレポでは PWA を rebuild した際に **PJ コックピット周りは作り直し** たが、月次ルーティンのステップ別モーダル (BudgetStepView 相当 4種) は **PWA 側に作られなかった**
  - `CockpitRoutineGas.tsx` の各ステップ button が `onOpenModal?.(ym)` (月次モーダルを開く関数) を呼ぶ実装になっており、stepId 別の振り分けが無かった
  - SPEC_pwa.md の「月次ルーティン」節には「並び順」「期限超過の取消線」しか書かれておらず、**「各タスクをクリックしたら何が開くか」の正本仕様が無かった** ため、新セッションが触るたび「全部月次モーダルでいいや」に戻る
  - まさは「3 度目くらい」と言ってる。SPEC に書かれてないと、次のセッションでも同じ回帰が起きる
- **解決策**:
  - iOS `RoutineFlowView.handleTap()` を正本として、PWA に **逆移植**:
    - `CockpitRoutineBudgetModal.tsx` (請求額確定: billing_cycles + project_members 直叩き、申告/取り下げ)
    - `CockpitRoutineMeetingModal.tsx` (報告会: Edge Fn `meeting-slots` / `schedule-meeting` GET)
    - `CockpitRoutineReportFixModal.tsx` (月次報告書FIX: monthly_reports 直読み、Edge Fn `send-slack-dm` for PC編集依頼)
    - `CockpitRoutineInvoiceModal.tsx` (請求書/見積書発行: documentType `invoice`/`quotation` 2モード、明細編集、Edge Fn `issue-invoice`/`cancel-invoice`)
    - `CockpitRoutineInvoiceSendConfirm.tsx` (請求書送付: 確認ダイアログのみ、billing_cycles UPDATE)
  - GET 用 Edge Function 呼び出しヘルパー `pwa/src/lib/supabase/edge-functions.ts` を新設 (`supabase.functions.invoke` は POST 専用)
  - `CockpitView.resolveStepModalFromTap()` で stepId → モーダル種別を振り分け。`reimburseConfirm` だけは `/reimburse` に router.push (iOS と同じ)
  - cockpit/page.tsx で `?step=` query param を読み取って `initialStep` として `CockpitView` に渡す → mypage TODO からのディープリンクが各ステップ専用モーダルを起動時に開く
  - **SPEC_pwa.md** の「月次ルーティン」節に **stepId × クリック挙動表** + 回帰防止注意書きを追記
- **教訓**:
  - **「画面の何がどこを開くか」は SPEC に表で書く**。「各タスクをクリックしたらモーダルが開く」だけだとどのモーダルか分からず、毎回同じ regression が起きる
  - PWA の Routine 周りは iOS が事実上の正本になってる (PWA rebuild で消えた → iOS から逆移植する形になってる)。新規モーダル追加時はまず iOS の対応 View を読む
  - `supabase.functions.invoke` は POST 前提。GET の Edge Function (`meeting-slots` / `schedule-meeting` 等) は `fetch` で URL パラメータ付きで叩く
  - PWA worktree は node_modules が無いので、tsc 叩くまえに `npm install --prefer-offline` 必要 (今回 6秒、キャッシュ済)

---

### [AMD OS PWA] 「過去にあったリンクの復活」を推測で実装して別の場所に飛ばした

- **発見日**: 2026-05-06
- **状態**: ✅ 解決済み (rollback)
- **症状**: まさが「コックピットから config に飛ぶリンクが消えてる、復活させて」と指示。Claude が `CockpitHeader` に `⚙️ config` リンクを追加したが、href を `/admin/projects#${projectId}` (= PJ 台帳ページ) にした → まさが「PJ 台帳に飛んじゃってる、元通りにして」と却下
- **原因**:
  - 「config」というラベルだけ受け取って、過去の飛び先を `git log -S "config"` 等で確認せずに推測で実装した
  - 実際に `git log -p --all -S "config" -- pwa/src/components/cockpit/` を遡ると、CockpitHeader にリンクが存在した形跡は無く (今回の `e6038d8` が初出)、まさの記憶ベースの「config」がどこを指していたか特定できなかった
  - それなのに「とりあえず admin/projects」と妥協で実装してしまった
- **解決策**:
  - 一度 CockpitHeader からリンクを削除したが、まさから「削除すると次セッションで情報が無くなる」と再指摘 → 暫定リンクとして残し、title 属性とコードコメントで「本来の飛び先要確認」を明記
  - **まさと一緒に PWA だけでなく GAS 側も探した結果、過去のリンク先が特定できた**:
    - `gas/500_CockpitPage.html:139` に `Config →` リンク (PWA 移植時に消えていた)
    - 飛び先: `?page=config&projectId=X` → `gas/226_ProjectConfig.html` (約 700 行)
    - 中身: PJ ごとの基本情報 / メンバー / 契約条件 / 請求書送付先 / Deductions の一括管理ページ
    - PWA には等価ページが存在しない → 次セッションで `/project/[projectId]/config` を新規作成して移植する話に
  - PWA 全体設計を `pwa/design/cockpit.md` に集約、冒頭に「既存 UI を勝手に消すな」セクションを追加
  - SPEC_pwa.md からも cockpit ルート説明にリンクを追加
  - AdminProjectsTable に hash anchor + ハイライト (`<tr id={p.project_id}>` + `target:bg-amber-50`) を実装、暫定リンク先として機能するように
- **教訓**:
  - 「過去にあった〇〇を復活させて」と頼まれたら、まず `git log -p -S` で履歴を確認。**PWA だけでなく GAS / iOS / 旧リポ も含めて探す** (今回 PWA だけ調べてハマった)
  - 履歴に該当物が見つからなかったら、まさに飛び先・仕様を確認する。推測で代用しない
  - リンクラベルだけ合っていても、**飛び先が違うと UI として壊れている**
  - 「シンプルにしたい」「不要そう」と独断で UI を消すのは禁止。一度追加されたものは、まさが意図して入れたもの。削除前に確認

---

### [AMD OS PWA] annotation 付きスプライトシートの自動クリーンは沼る

- **発見日**: 2026-05-04
- **状態**: ✅ 解決済み (回避策で対応)
- **症状**: つくよみマスコット用に `tsukuyomi-sheet.png` (ラベル/区切り線/フレーム番号付の参考用シート) を pixel filter / 連結成分 / flood fill 等いろいろ試して自動クリーンしようとしたが、(a) キャラの髪まで透過処理してしまう / (b) 罫線がキャラと連結成分上つながっていて消せない / (c) 元シートに描かれた motion line を artifact と区別できない、で何度やってもユーザーOKラインに届かなかった
- **原因**: 元シートは「アニメーション参考用」であり、ゲーム実装用に切り出した素材ではない。annotation (ラベル/数字/罫線) と character art が同じレイヤに描かれていて、自動的な分離は本質的に困難
- **解決策**: ユーザーが Codex に依頼して **既にクリーンな素材** (`/Users/masa/projects/masa/output/tsukuyomi_animations_amd/`) を作ってもらった。各128×128透過済、足元アンカー揃い、4 アニメ × 18 frames。この素材を統合シートに組むだけで一発OK
- **教訓**: annotation 付き参考用シートを自動クリーンしようとして時間溶かさない。「クリーンな素材を作ってもらう」を最初に提案する。連結成分・flood fill などの工夫は最大2-3回試して駄目なら方針転換

---

### [AMD OS PWA] ログイン後に旧サイト（amd-os-v2-web）に飛ばされる

- **発見日**: 2026-04-16
- **状態**: ✅ 解決済み
- **症状**: `https://amd-os-pwa.vercel.app` でGoogleログインすると、OAuth後に `https://amd-os-v2-web.vercel.app/?code=...` にリダイレクトされてしまい、旧サイトが表示される
- **原因**: SupabaseのAuth設定 `site_url` が旧Vercelプロジェクト `amd-os-v2-web.vercel.app` のままだったため。ログインページの `redirectTo: window.location.origin + '/auth/callback'` は正しいURLを指定していたが、Supabaseの `uri_allow_list` に `amd-os-pwa.vercel.app` が入っておらず、`site_url` にフォールバックされた
- **解決策**: Supabase Management APIで以下を更新
  - `site_url` → `https://amd-os-pwa.vercel.app`
  - `uri_allow_list` に `https://amd-os-pwa.vercel.app/**` と `http://localhost:3000/**` を追加
  - 旧プロジェクト `amd-os-v2-web` をVercelから削除
- **教訓**: 新しいVercelプロジェクトを作成したら必ずSupabaseの `site_url` と `uri_allow_list` を同時に更新すること

---

### [AMD OS PWA] Vercel デプロイ後に全ルートが 404 になる

- **発見日**: 2026-04-28
- **状態**: ✅ 解決済み
- **症状**: `vercel --prod` 実行直後から `/`, `/auth/login`, `/admin/payouts` などすべてのルートが 404 になった。ビルド出力が `○ /` と `○ /_not-found` の 2 ルートのみ（正常時は 40+ ルート）
- **原因**: **デプロイコマンドの正本が CLAUDE.md に記載されていなかった**。そのためえいみが毎回「どのディレクトリから実行するか」を判断し直し、`cd C:\Users\masa\amd-os-pwa && vercel --prod` という bash 的パターンを試みた。Claude Code の PowerShell ツールはシェルの CWD が `G:\共有ドライブ\...` にリセットされるため、CLI は設定ファイルのみ 18 件の G: ドライブディレクトリをスキャンし、本来の C: ドライブのソース（100+ ファイル）がアップロードされなかった
- **解決策（緊急）**: `vercel promote <正常だったデプロイID> --scope armada0130 --yes` でロールバック
- **解決策（恒久）**: CLAUDE.md にデプロイコマンドを `--cwd` 付きで正本として明記（このファイルの上部参照）
- **教訓**: 「どのディレクトリから実行するか」が自明でない CLI コマンドは **CLAUDE.md に正本コマンドを書く**。書かれていないと次のえいみが必ず同じ間違いを犯す

---

### [AMD OS PWA] admin.billing の未来月「立替確認」が完了表示になる

- **発見日**: 2026-05-02
- **状態**: ✅ 解決済み
- **症状**: admin.billing で `2026年6月` など未来の稼働月について、まだ立替確認が発生しないはずなのに `立替確認` が完了表示になっていた。さらに `立替確認` は自動判定扱いのため手動変更もできず、ユーザーには誤った完了状態に見えた。
- **原因**: Swift版の `fetchReimbursementCompletionMap` と同じ「`submitted` / `pmapproved` の未処理立替がなければ完了」という判定をPWAへ移植したが、締切日前の未来月を区別していなかった。未処理立替が存在しない未来月も `pendingなし = 完了` と解釈していた。
- **解決策**: PWAの `reimbursementCompletionMap()` を締切日ベースに変更。対象稼働月の翌月4日を締切とし、土日なら前営業日に補正。締切日前は未完、締切日以降に `submitted` / `pmapproved` がなければ完了にする。例: `202606` は `2026-07-04` が土曜なので `2026-07-03` に完了判定。
- **教訓**: 自動判定ステップは「未処理がない」と「まだ発生時期ではない」を分ける。特に未来月は `pendingなし` を即 `done` にしない。

---

### [AMD OS PWA] Vercel が GitHub push を検知せず、自動デプロイされない

- **発見日**: 2026-05-05
- **状態**: ✅ 解決済み
- **症状**: `git push origin main` しても Vercel が自動でビルドを開始しない。ダッシュボードで Source が `vercel deploy` (CLI) と表示され、最新デプロイが「1 日前」のまま。手動 `vercel --prod` でしか反映できない。
- **原因**: Vercel プロジェクトが GitHub repo と未連携状態だった。CLI で `vercel link` した時点では Git Integration は自動設定されない。
- **解決策**: `cd /Users/masa/projects/AMD/amd-os/pwa && vercel git connect https://github.com/masa-teamarmada/amd-os.git --yes` で GitHub と連携。さらに **Vercel ダッシュボード → Settings → Build and Deployment → Root Directory に `pwa` を設定**する必要があった (リポジトリのルートが `amd-os/`、Next.js プロジェクトが `amd-os/pwa/` のため)。
- **教訓**: モノレポ構造 (リポジトリ直下と Next.js プロジェクト位置がずれる) の場合、`vercel git connect` だけでは不十分。Root Directory の設定はダッシュボード GUI でしかできない。これを忘れると `Couldn't find any 'pages' or 'app' directory` エラーで Vercel ビルドが失敗する。

---

### [AMD OS PWA] Three.js Canvas の高さが 0 で何も描画されない

- **発見日**: 2026-05-05
- **状態**: ✅ 解決済み
- **症状**: `/venture-map/oscillator` で Canvas が表示されず、ボールも見えない。コンソールエラーなし。
- **原因**: Tailwind 4 の `h-[calc(100vh-160px)]` が flex 子要素の高さ計算に正しく伝播せず、Canvas の親 div が高さ 0 になっていた。
- **解決策**: 親 div に `style={{ height: "calc(100vh - 160px)", minHeight: 600 }}` を inline で指定。さらに flex item に `minWidth: 0, minHeight: 0` を追加して flex shrink 制約を外す。Canvas にも `style={{ width: "100%", height: "100%" }}` を明示。
- **教訓**: Tailwind 4 の任意値 `h-[calc(...)]` は flex レイアウト下で挙動が読みにくい。Three.js の Canvas のように親サイズに依存するコンポーネントでは inline style で確実に指定する方が安全。flex container の中で `minHeight: 0`/`minWidth: 0` を忘れると子が縮まない/拡大しない。

---

### [AMD OS PWA] @react-three/drei の Text が silent fail する可能性

- **発見日**: 2026-05-05
- **状態**: ✅ 回避済み (Html overlay に切替)
- **症状**: drei の `<Text>` (Troika SDF Text) を使ったボールラベルが描画されず、ボール本体すら見えない状態になっていた可能性。コンソールエラーなし。
- **原因**: 不明 (フォント取得失敗、Next.js 16 + React 19 との互換性問題、Turbopack ビルドとの相性などの可能性)。
- **解決策**: `<Text>` をやめて drei の `<Html>` で HTML オーバーレイラベルに置換。
- **教訓**: drei の Text はフォントロードや WebGL シェーダー周りで silent fail する可能性がある。シンプルな 2D ラベルなら Html overlay の方が安全で、CSS で柔軟にスタイル可能。

---

### [AMD OS PWA] Vercel 環境変数を `.env.local` に書いても本番に反映されない

- **発見日**: 2026-04-17
- **状態**: ✅ 解決済み
- **症状**: ローカルでは動くが本番で `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY` / `FREEE_*` が undefined で API ルートが 500 になった
- **原因**: Vercel は `.env.local` を読まない。`vercel env add` で明示登録しないと production env に入らない
- **解決策**: `.env.local` をパースして `echo $value | vercel env add $key production` をループで一括追加
- **教訓**: 新しい env key を追加したら **同じ commit で Vercel にも追加する**。`vercel env ls --scope armada0130` で抜けが無いか定期的に確認

---

### [AMD OS PWA] shadcn Dialog の `max-w-[1400px]` が効かない

- **発見日**: 2026-04-17
- **状態**: ✅ 解決済み
- **症状**: 月次モーダルの幅を広げたいのに `max-w-[1400px]` を指定しても変わらない
- **原因**: shadcn Dialog の base に `sm:max-w-sm` が仕込まれていて、tailwind-merge はレスポンシブ variant を別グループとして扱うので overrides されない
- **解決策**: `!important` 付きで両方指定 → `!max-w-[1400px] sm:!max-w-[1400px] w-[95vw]`
- **教訓**: shadcn のレスポンシブ class を上書きする時は **同じブレークポイントの variant を `!` 付きで明示**。base の指定だけ書くと `sm:` 以上のサイズでしか効かないので注意

---

### [AMD OS PWA] shadcn Dialog で `type="number"` 入力の "0" が消せない

- **発見日**: 2026-04-17
- **状態**: ✅ 解決済み
- **症状**: 進捗 % の数値入力で初期値 "0" を消そうとしてもブラウザが消させない
- **原因**: HTML `input[type=number]` のブラウザ仕様 (空文字を許可しない実装が混在)
- **解決策**: `type="text" inputMode="numeric"` + `onFocus={(e)=>e.target.select()}` で代替。バリデーションは onChange 側で正規表現で弾く
- **教訓**: 数値入力は UX 重視で `type="text" inputMode="numeric"` を第一選択にする

---

### [AMD OS PWA] Google OAuth Client Secret のフォントで `I` と `l` が区別不能

- **発見日**: 2026-04-21
- **状態**: ✅ 解決済み (回避策あり)
- **症状**: Google Console は 2026-04 時点でシークレットの「表示・ダウンロード」を廃止。新規作成直後だけ一度表示されるが、画面の `I` (大文字 i) と `l` (小文字 L) がフォント上区別できず Supabase に貼り間違える
- **原因**: Google Console UI のフォント仕様 + シークレット表示制限
- **解決策**: Chrome の `read_page` (アクセシビリティツリー取得) を使う。コピーボタンの `aria-label` に `クリップボードにコピー: GOCSPX-xxxxx` というフルテキストが入っていて機械可読
  1. Google Console の OAuth クライアントページを開く
  2. 既存シークレット 2 つあれば 1 つを無効化→削除してスロットを空ける (上限 2 つ)
  3. 「+ Add secret」→ シークレット新規作成
  4. `read_page(filter="interactive")` で `button "クリップボードにコピー: GOCSPX-..."` の aria-label からフルテキストを取得
  5. Supabase Auth プロバイダーの Client Secret に貼り付け
- **教訓**: 視覚的に曖昧な文字列はアクセシビリティツリーから取る。あと **Supabase Google プロバイダ設定の Client IDs は `web,iOS` の順** (先頭が OAuth code flow で使われる)

---

### [AMD OS PWA] Supabase DDL を SQL Editor から手動投入し続けて事故

- **発見日**: 2026-04 中旬
- **状態**: ✅ 解決済み (Management API ベースのフローを確立)
- **症状**: マイグレーション履歴がローカルにもリポにも残らず、別マシンで再現できない / 適用済か不明
- **原因**: `supabase-js` REST には `rpc("exec_sql")` が存在しない、`npx supabase db push` は PAT が要る、SQL Editor 手動は履歴が残らない
- **解決策**: `scripts/apply_ddl.py` で Supabase Management API (`/v1/projects/{ref}/database/query`) を直叩く。`SUPABASE_ACCESS_TOKEN` (sbp_…) を使い、**User-Agent ヘッダー必須** (Cloudflare 1010 回避)。migration は必ず `scripts/migrations/NNN_name.sql` に残す
- **教訓**: DDL は人間の手作業に頼らない。Management API + ファイル化したマイグレーション + リポ commit の 3 点セットを徹底

---

### [AMD OS PWA] vercel deploy で `--cwd .../pwa` が "pwa/pwa does not exist" で失敗 + 誤プロジェクトが作られる

- **発見日**: 2026-05-06
- **状態**: ✅ 解決済み
- **症状**:
  1. `npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os/pwa` を実行すると `Error: The provided path "~/projects/AMD/amd-os/pwa/pwa" does not exist` で失敗
  2. リトライで `--cwd` をリポ root にすると、リポ root に `.vercel/project.json` が無かったため `--yes` フラグで勝手に **新プロジェクト `amd-os` (`amd-os.vercel.app`)** が作られて、本番 `amd-os-pwa.vercel.app` ではなくそちらに 1 秒で空ビルドがデプロイされた
- **原因**: 2026-05-05 の Vercel Git Integration 設定で project `amd-os-pwa` の Settings → Build → Root Directory に `pwa` を入れた。CLI の `--cwd` は project 設定の Root Directory と結合されるので、`--cwd .../pwa` を渡すと `pwa/pwa` を探しに行って失敗。CLAUDE.md / SPEC の正本コマンドは Git Integration 入る前のままで時代遅れになっていた
- **解決策**:
  1. リポ root の `.vercel/project.json` を amd-os-pwa を指すように設定: `cp -r /Users/masa/projects/AMD/amd-os/pwa/.vercel /Users/masa/projects/AMD/amd-os/.vercel`
  2. 正本コマンドを **リポ root を `--cwd` に渡す** に変更: `npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os`
  3. 誤って作られた `amd-os` プロジェクトは `npx vercel projects rm amd-os` (対話 y) で削除
  4. CLAUDE.md / SPEC_pwa.md の正本コマンドを更新
- **教訓**:
  - Vercel project 設定 (Root Directory 等) を変えたら CLI deploy の正本コマンドも同じ commit で更新する
  - `--yes` を使うときは事前に `cat .vercel/project.json` で対象プロジェクトを必ず確認する。空なら新プロジェクトが作られる
  - 「全ルート 404」事故と同型: `--cwd` が想定と違うパスを指すと、誤った場所にデプロイされる


---

### [AMD OS PWA] 報告会日程調整の予約完了がタスクに反映されない

- **発見日**: 2026-05-08
- **状態**: ✅ 解決済み
- **症状**: CockpitRoutineMeetingModal で日程予約しても、月次ルーティンの「報告会日程調整」が done にならない。再オープン時も「日程選択」UI が出て、予約完了状態にならない
- **原因**: `CockpitView.cockpit.billingCycles` が SSR fetch のスナップショットで、Edge Function `schedule-meeting` が `billing_cycles.meeting_event_id` / `meeting_start_at` を upsert した後も親の状態は古いまま。`isDone = !!cycle?.meetingEventId || !!cycle?.meetingStartAt` がずっと false
- **解決策**: モーダル成功時に `router.refresh()` で親 (cockpit page サーバーコンポーネント) を再フェッチ。即時 UI フィードバックは `localConfirmedISO` で予約直後すぐ「予約完了」表示に切替。自動 close (1.3秒) は削除して、ユーザーが完了画面を確認してから閉じる流れに
- **教訓**:
  - Next.js App Router の SSR fetch スナップショットは Client Component から能動的にしか reload できない。サーバー側を変えた直後は `router.refresh()` をセットで呼ぶ
  - 即時 UI フィードバックと「正規データの再フェッチ」を**両方**セットでやらないと、ユーザーが「効いてないように見える」体験になる
  - 「自動 close + サーバー反映待ち」は race condition の温床。完了画面で意図的に止める方が事故率低い

---

### [AMD OS PWA / GAS] ScriptProperties キー名を推測で書いて事故 (`SUPABASE_SERVICE_ROLE_KEY` ≠ `SUPABASE_SERVICE_KEY`)

- **発見日**: 2026-05-08
- **状態**: ✅ 解決済み
- **症状**: 新規 GAS Supabase client が「`SUPABASE_SERVICE_ROLE_KEY` missing in ScriptProperties」と起動時エラー。まさから「もう入ってる、SUPABASE_SERVICE_KEY という名前で」と指摘されて発覚
- **原因**: PWA 側の `.env.local` が `SUPABASE_SERVICE_ROLE_KEY` という名前なのに引きずられて、GAS の ScriptProperties も同じ名前と推測してハードコード。GAS 側の正しい名前は `SUPABASE_SERVICE_KEY` (`_ROLE` 無し)
- **解決策**:
  1. `gas/180_SupabaseClient.js` の参照を `SUPABASE_SERVICE_KEY` に修正
  2. `gas/099_PwaApi.js` に `listProps` admin action を追加して、現状の ScriptProperties キー一覧を Web App 経由で取得できるようにした
  3. `pwa/design/L2_DATA.md` 新設 + 6 入口に導線追加で「次のえいみは推測しなくて済む」状態に
- **教訓**:
  - **`gas/CLAUDE.md` ルール9「ScriptPropertiesキー名は推測しない」を破った**。同じ過ちを繰り返さない
  - キー名の正本リストが md に無いと推測事故が起きる → 今後は新キーを追加したら必ず L2_DATA.md or 該当 spec md に記録する
  - 不明なキー名は `listProps` action (`?action=listProps`) で確認可能、ハードコード前に必ず叩く

---

### [AMD OS PWA / GAS] Gemini モデル名 `gemini-2.0-flash` が 404 (新規ユーザー利用不可で廃止)

- **発見日**: 2026-05-08
- **状態**: ✅ 解決済み
- **症状**: `_meeting_extractWithLLM_` で全議事録の Gemini 抽出が `Gemini API 404: This model models/gemini-2.0-flash is no longer available to new users` で失敗
- **原因**: 私の知識カットオフでは gemini-2.0-flash が現役だったが、Google が新規ユーザー向けには廃止していた
- **解決策**: `gemini-2.5-flash` に変更 (LlmRouter デフォルト + DB_LlmModelConfig の meeting_extract レコード + 074_MeetingSummaryRepo.js の generated_by_model)
- **教訓**:
  - LLM のモデル名は知識カットオフを超えて変わるので、ハードコードしたら必ず DB_LlmModelConfig の usageKey 経由で差し替え可能にしておく
  - 失敗時のエラーメッセージに「This model X is no longer available」が含まれていれば即モデル名更新の判断ができる

---

### [AMD OS PWA / GAS] PostgREST `in.(...)` で URL 長制限超過 (UrlFetchApp 落ち)

- **発見日**: 2026-05-08
- **状態**: ✅ 解決済み
- **症状**: `nav_meeting_extractForProjectYm_` 実行時に「Exception: 上限を超えています: URLFetch URL の長さ」で落ちる
- **原因**: `_meeting_loadExistingByIds_` で議事録 ID (UUID 36 文字) を全件 `meeting_id=in.("uuid1","uuid2",...)` に詰めて URL に含めていた。1 PJ 27 件 × ~50 文字 で URL 長制限超え
- **解決策**: `_meeting_loadExistingForProjectYm_(projectId, ymKey)` に置き換え。`project_id=eq.X&ym=eq.Y` で取得して meeting_id を Map 化
- **教訓**:
  - PostgREST `in.()` は ID 数が多くなると URL 長制限に引っかかる。**インデックスがあるなら別のフィルタで絞ってから取得する方が安全**
  - GAS の UrlFetchApp は URL 長制限が厳しい (~2KB?)。fetch 系の URL は短く保つのを基本に

---

### [AMD OS PWA] migration の RLS policy を `TO authenticated` だけにすると anon key で読めない

- **発見日**: 2026-05-09
- **状態**: ✅ 解決済み
- **症状**: PWA Cockpit の MTGサマリ枠が「直近1年データなし」のまま。Supabase には 7 行入ってるのに表示されない
- **原因**: migration 024 で `CREATE POLICY ... TO authenticated USING (true)` だけにしていた。`pwa/src/lib/supabase-data.ts` の冒頭コメント通り「PWA は anon key で read-only」なので、anon が SELECT 出来なくて空配列が返ってた
- **解決策**: migration 025 で `DROP POLICY ... CREATE POLICY ... TO anon, authenticated USING (true)` に修正
- **教訓**:
  - 新規テーブル + RLS を作るときは **PWA の readクライアントが anon か authenticated か** を必ず先に確認する。`pwa/src/lib/supabase-data.ts` のコメントが正本
  - 「anon でも read-only」は AMD OS の標準パターン (書き込みは service_role 経由)。`TO anon, authenticated` で SELECT、書き込みは policy 無し (service_role が RLS バイパス)

---

### [AMD OS PWA / GAS] GAS Web App 6 分実行制限 (議事録1件 ~60秒で大量バックフィル不可)

- **発見日**: 2026-05-09
- **状態**: ✅ 緩和 (maxItems=8 で対応)
- **症状**: `nav_meeting_extractForProjectYm_` を SX 1 PJ × 1 ym で実行すると 6 分超えて Web App が「起動時間の最大値を超えました」エラー HTML を返す
- **原因**: 議事録 1 件あたり Notion API call (本文取得 + relation page title 解決) + Gemini API call で平均 60 秒。27 件処理しようとして 6 分超え
- **解決策**:
  - `maxItems` パラメータ (default 8) を追加して 1 関数呼び出し当たりの LLM コール数を制限
  - `hasMore: true` を返して、上位ループで同関数を繰り返し呼ぶことで全件処理
  - source_hash で変更なし議事録は LLM 呼ばずスキップする差分検知ロジックも維持
- **教訓**:
  - GAS Web App の同期実行は 6 分制限。それ以上かかる処理は必ずバッチ分割する設計にする
  - daily cron (`nav_cronMonthlyExtractAt3`) は実行制限が緩い (6分超えても trigger 単独だと 30 分まで OK な場合あり) が、Web App 経由の手動 trigger は厳格に 6 分
  - LLM コールが遅い理由は別途調査の余地 (Notion API 直列が時間食ってる可能性、並列化検討)
