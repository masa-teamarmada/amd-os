# HANDOFF — AMD OS PWA

次セッションが文脈を聞き直さずに再開できる **直近の引き継ぎだけ** をここに書く。

- ⭐⭐⭐ **AMD OS 中核データ正本** → [`design/L2_DATA.md`](design/L2_DATA.md) (L2 6 種 + cron + 動作状況)
- 仕様 → [`design/SPEC_pwa.md`](design/SPEC_pwa.md) (設計フォルダ全体の入口は [`design/README.md`](design/README.md))
- バグ・教訓 (症状/原因/解決策/教訓) → [`BUGS.md`](BUGS.md)
- 過去セッションの作業ログ → [`design_log/sessions_YYYY-MM.md`](design_log/)
- 共通運用ルール → リポ root の `CLAUDE.md`、PWA 確認方針 → [`AGENTS.md`](AGENTS.md)

---

## 最終更新

2026-05-09 (brave-cohen-15d352 セッション) — **MTGサマリ Phase 2 + Phase 3 完了**。

**Phase 3 (会議終了 +60 分 ad-hoc trigger + iOS APNs 通知用テーブル)**:
- 03:00 daily cron で「今日 〜 7 日先」の calendar event 各々について **終了 +60 分に発火する 1 回限り time-trigger** を ScriptApp.newTrigger.at(date) でセット
- trigger callback で `nav_meeting_processOneEvent_(eventId, projectId)` (074 新設) を呼び 1 event ピンポイント抽出
- 拾えたら `meeting_notifications` テーブル (migration 028 新設) に upsert → iOS Swift が polling して APNs 通知 → [`ios/HANDOFF_meeting_notifications.md`](../ios/HANDOFF_meeting_notifications.md) で別セッションへハンドオフ
- 03:00 cron の Phase 2 月単位抽出は **拾い漏れ救済 fallback** として残す
- UI: `source_kinds='none'` は「議事録なし」、それ以外で内容空は「議事録あり・抽出空」と区別表示
- GAS deploy v1428 / 初回 scheduling: 24 scan / 3 trigger set (p19 ZeMA / p07 LiSTie / p21 SX-JAFCO) / 13 excluded / 6 no_pj / 2 errored

**Phase 2 (前段で完了済)**:
- 1 MTG = 1 calendar event を主軸 (`meeting_id` PK = calendar event id)
- 議事録ソース = Notion 本文 + Gmail (reportEmails ±1日) を結合 → Gemini Flash 抽出
- 議事録なし MTG は `summary_short = "議事録なし"` のマーカー行で残す
- migration 027 適用 (既存 7 行 DELETE + `notion_page_id` / `gmail_thread_ids` / `source_kinds` 追加)
- gas/074_MeetingSummaryRepo.js を全書き直し / gas/092 prompt v2 / GAS deploy v1425
- 仕様正本 [`pwa/design/meeting_summaries.md`](design/meeting_summaries.md) を Phase 2 で全書き直し (まさの指摘「md に書いてないのが問題」対応)
- p20 (**CX**, NIMS 関係) 202604 バックフィル: `inserted` 1 / `inserted_none` 多数 / `gmailThreads:0` 大半。p20 は議事録 Notion メイン (まさ確認) で想定通り
- **p21 (SX, 愛媛大) 202604 バックフィルで Phase 2 動作確認 OK**: 月単位 Gmail 取得 15 thread、`sourceKinds: "notion+gmail"` で 2 件、`notion` で 5 件、`inserted_none` 13 件、`skipped_no_event_id` 14 件、`deferred_maxItems` 19 件 (= 後続 daily cron で順次処理される)、`error_llm` 1 件 (次回再試行)
- **Phase 2 は成功**: Gmail 議事録経路 (CircleBack/メール議事録) が `reportEmails` (`@ehime-u.ac.jp` ワイルドカード等) を通じて拾われ、Notion 本文と結合されて Gemini で抽出されている

詳細は [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) の末尾エントリ参照。

---

## リポ状態

- 作業 worktree: `/Users/masa/projects/AMD/amd-os/.claude/worktrees/brave-cohen-15d352`
- 作業 branch: `claude/brave-cohen-15d352`
- main HEAD (本セッション開始時): `c5396c3` (`Merge branch 'claude/funny-perlman-401669'`)
- 適用済 migrations: …024 / 025 / 026 (seeds_data_round2, 別セッション) / **027 (pms phase2)** / **028 (meeting_notifications)**
- GAS Web App deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` → **v1425** (`v1422_meeting_phase2_combined_sources` description だが actual is 1425)
- PWA は Phase 2 で **コード変更なし** (CockpitMeetingSummary は notion_url が NULL でも安全に動く既存実装) → Vercel deploy 不要

---

## L2 データ動作状況サマリ (詳細は [`design/L2_DATA.md`](design/L2_DATA.md))

| L2 | 状態 |
|---|---|
| ① monthly report | ✅ R313 (AMD-Report GAS, 05:00) |
| ② **AMDプロトコル** | ❌ **未稼働 (0 行、UI も削除済)** ← 別セッションで復活作業中 |
| ③ MS進捗 | ✅ cron/daily-estimate (PWA, 03:00) |
| ④ PJナレッジ | ⚠️ 2024 行あるが流入元不明 ← AMD-Report GAS 別セッションで実装予定 |
| ⑤ **メンバーナレッジ** | ❌ **未稼働 (0 行)** ← 同上 |
| ⑥ MTGサマリ | ✅ **Phase 2 稼働** (Notion + Gmail 結合)、reportEmails 整備は Phase 2.1 |

---

## 残タスク (次セッションで対応)

### 高優先 (Phase 3 のフォロー)

1. **iOS Swift 側の APNs 受信実装** (別セッション、ios/ worktree で)
   - ハンドオフ doc: [`ios/HANDOFF_meeting_notifications.md`](../ios/HANDOFF_meeting_notifications.md)
   - Supabase `meeting_notifications` テーブルから notified_at IS NULL を polling or realtime sub
   - APNs ローカル通知 → notified_at = now() で UPDATE
   - 通知タップ → CockpitView (該当 PJ) に遷移

2. **本番 03:00 cron の動作確認** (明朝)
   - 明日 03:00 JST に nav_cronMonthlyExtractAt3 が走る → Phase 3 scheduling が automatically 走る
   - 同日中の 3 trigger (p19/p07/p21) が発火するはず
   - 翌々日にもう一度 `nav_meeting_listPendingTriggers` を見て、pending が消化されてるか確認

3. **MTGサマリ Phase 2 残バッチの消化** (低工数、放置でも OK)
   - p21 202604 で `deferred_maxItems` 19 件あり、daily cron で順次処理される

4. **MTGサマリ Phase 2.1: pickup ウィンドウ拡大検討** (任意)
   - 現状 calendar event 日 ±1日で Gmail thread を pickup
   - 議事録メールが「会議の翌日 〜 1週間後」に届く運用なら、ウィンドウを ±3日 〜 ±7日に拡大する余地あり

5. **MTGサマリ Phase 2.5: AMD-Report GAS R313 を会議サマリ集約方式に書き換え**
   - 別 clasp project (このリポ外) なので別セッションで対応
   - 集約ロジック: `project_meeting_summaries.where(project_id, ym=当月).order(meeting_date)` → Sonnet で集約 → `monthly_reports.draft_content / final_content` 更新
   - これで Phase 1 の navigator_extract (月単位フラット) は完全廃止できる

### 並行タスク (前セッションから継続、別 worktree で進行中の可能性)

3. **AMDプロトコル UI 復活 + スプシ掘り起こし** (chip)
4. **PJナレッジ + メンバーナレッジ を AMD-Report GAS の cron で実装** (chip)

### 既存の残タスク (前セッションから引き継ぎ)

5. **CX (p20) / CTB (p06) / SE (p10) / p11 で次期 MS 期間 (2026 Q2 〜) を設定**
6. **過去 monthly_reports (4月分等) の復元** — スプシ DB_MonthlyReports からの restore script 未実装
7. **5月分の monthly_reports 自動生成** (no report content) — cron 検討
8. `saveProjectMembers` 全削除→挿入をやめて incremental update に (将来事故防止)

---

## 次セッションの最初の一手

1. リポ状態 4 ステップ (`git fetch --all --prune` → `git log --branches --not --remotes --oneline` → `git branch -a` → `git status -s`) を必ず実行
2. **`pwa/design/L2_DATA.md` を読む** ← AMD OS 中核データ正本
3. **`pwa/design/meeting_summaries.md` を読む** ← MTGサマリ Phase 2 仕様の正本 (Phase 2.1 で reportEmails 整備するならここを更新)
4. `BUGS.md` の最新エントリを読む
5. Phase 2.1 (reportEmails 整備) または別件に着手

---

## 運用コマンド (継続)

- **本番 deploy + 通知**: `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`
- **DDL 適用** (worktree からだと .env.local が無いので main worktree 経由):
  ```sh
  cd /Users/masa/projects/AMD/amd-os/pwa
  python3 -X utf8 scripts/apply_ddl.py /path/to/worktree/pwa/scripts/migrations/NNN_name.sql
  ```
- **cron 手動 trigger**: `curl -H "Authorization: Bearer $CRON_SECRET" "https://amd-os-pwa.vercel.app/api/cron/<name>?ym=YYYYMM"`
- **GAS Web App 経由で関数実行**:
  ```sh
  URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_WEBAPP_URL=//' | tr -d '"')
  KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_API_KEY=//' | tr -d '"')
  # ScriptProperties 一覧
  curl -sL "$URL?mode=pwaApi&key=$KEY&action=listProps"
  # 任意関数実行 (引数は JSON 配列を URL encode)
  ARGS=$(node -e 'console.log(encodeURIComponent(JSON.stringify(["arg1","arg2"])))')
  curl -sL --max-time 360 "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=FUNCTION_NAME&args=$ARGS"
  ```
- **GAS push + deploy update**:
  ```sh
  cd /Users/masa/projects/AMD/amd-os/.claude/worktrees/<worktree>/gas
  npx --yes @google/clasp@latest push --force
  npx --yes @google/clasp@latest deploy --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G --description "v<n>_<desc>"
  ```
