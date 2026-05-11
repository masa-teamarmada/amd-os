# meeting backfill 全 source 統合 — 設計ドラフト (次セッション実装)

最終更新: 2026-05-11 (まさ指摘: 「議事録は過去 Notion にあまりない、他ソースのほうがデータある」)

## 背景 (問題)

現状の `074_MeetingSummaryRepo.js` (本体 GAS):
- meeting source = **Notion AI 議事録ページ + Gmail 議事録メール のみ**
- `nav_meeting_backfillAiPages_` で全 active PJ × 過去 90 日 backfill した結果:
  - p19 ZMP: 7 件成功
  - **p00 AMD / p06 CTB / p10 SE / p25 KUTE: 0 件**
  - 原因: Notion 議事録のタイトル alias 解決失敗 + そもそも該当 PJ の Notion 議事録ページが少ない

加えて、まさのフィードバック:
- 過去の SE 月次レポートで「2/18 2:47 山地→肥塚」誤抽出が起きた事故 → Notion ではなく **Slack DM** 由来の議事録だった可能性が高い
- 実運用では Slack スレッド / Drive ファイル / Calendar event description / Gmail 議事録メール の方がデータ豊富

## 新設計 (次セッションで実装)

### 構造

1. **`project_meeting_summaries` の source を多様化**
   - 既存: `source_kinds` column に "notion" / "gmail" の bitflag
   - 拡張: "slack" / "drive" / "calendar" を加える
2. **新規 GAS 関数 (本体 GAS 153/074 に追加)**:
   - `nav_meeting_backfillFromSlack_(projectId, sinceDays, opts)`:
     - 該当 PJ の Slack channel から長い thread (= reply_count ≥ 3) を抽出
     - 各 thread を 1 meeting として project_meeting_summaries に upsert
     - bot メッセージは R306 と同じ要領で除外 (= 既に AMD-Report 側で実装済を流用)
   - `nav_meeting_backfillFromCalendar_(projectId, sinceDays)`:
     - Calendar event で「定例」「MTG」「打合せ」を含むものを meeting として upsert
     - event の description / attendees を summary_short に
   - `nav_meeting_backfillFromDrive_(projectId, sinceDays)`:
     - PJ Drive folder の議事録系ファイル (= .docx, .gdoc, "議事録" を含むファイル名) を meeting として upsert
3. **AMD-Report の Multi-source extract を流用**:
   - R306_MonthlyReport_SlackExtract / R307_GmailExtract / R309_DriveExtract が既にあり、これらの meeting 抽出ロジックを本体 GAS 側に移植
4. **alias resolver 強化** (074 `_meeting_resolveProjectIdFromPage_`):
   - 「香川大学」→ p06、「KUTE」→ p25、「OkuDoor」→ p?? 等の人手 alias map を `nameAlias_buildBlock` の拡張で対応

### cron

- 毎週月曜 03:00 JST: `nav_meeting_multiSourceBackfillAll_` を起動
  - 全 active PJ × 過去 7 日 を Slack/Drive/Calendar から再抽出
  - source_hash 差分検知で重複防止

### Phase 2 (将来)

- Notion 自動 PJ relation set: GAS が Calendar event の `attendees` から PJ を逆引きして Notion に書き戻す
- AI 自動分類: タイトルから LLM で PJ alias 推定 (= alias map なしで動く)

## 次セッション TODO

1. R306 `mr_slack_getMessages_` を本体 GAS の `_meeting_loadSlackThreadsForMonth_` に移植
2. 同様に Drive / Calendar 用 loader を実装
3. project_meeting_summaries.source_kinds に "slack" / "drive" / "calendar" を許容
4. 全 active 7 PJ で初回 backfill を curl から起動 (= 過去 90 日)
5. cockpit の MTGサマリ列が全 PJ で出るか目視確認

---

## 関連
- pwa/design/meeting_summaries.md (現状の Notion + Gmail Phase 2 仕様)
- gas/074_MeetingSummaryRepo.js
- AMD-Report の R306/R307/R309
