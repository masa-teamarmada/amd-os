# HANDOFF — AMD OS PWA

次セッションが文脈を聞き直さずに再開できる **直近の引き継ぎだけ** をここに書く。

- ⭐⭐⭐ **AMD OS 中核データ正本** → [`design/L2_DATA.md`](design/L2_DATA.md) (L2 6 種 + cron + 動作状況)
- 仕様 → [`design/SPEC_pwa.md`](design/SPEC_pwa.md) (設計フォルダ全体の入口は [`design/README.md`](design/README.md))
- バグ・教訓 (症状/原因/解決策/教訓) → [`BUGS.md`](BUGS.md)
- 過去セッションの作業ログ → [`design_log/sessions_YYYY-MM.md`](design_log/)
- 共通運用ルール → リポ root の `CLAUDE.md`、PWA 確認方針 → [`AGENTS.md`](AGENTS.md)

---

## 最終更新

2026-05-09 (brave-cohen-15d352 セッション) — **MTGサマリ Phase 2 移行完了**。
- 1 MTG = 1 calendar event を主軸 (`meeting_id` PK = calendar event id)
- 議事録ソース = Notion 本文 + Gmail (reportEmails ±1日) を結合 → Gemini Flash 抽出
- 議事録なし MTG は `summary_short = "議事録なし"` のマーカー行で残す
- migration 027 適用 (既存 7 行 DELETE + `notion_page_id` / `gmail_thread_ids` / `source_kinds` 追加)
- gas/074_MeetingSummaryRepo.js を全書き直し / gas/092 prompt v2 / GAS deploy v1425
- 仕様正本 [`pwa/design/meeting_summaries.md`](design/meeting_summaries.md) を Phase 2 で全書き直し (まさの指摘「md に書いてないのが問題」対応)
- 初回バックフィル p20 (SX) 202604: `inserted` 1 件 + `inserted_none` 多数。`gmailThreads: 0` が大半 → **Phase 2.1 で reportEmails 整備が必要** (CircleBack / GMeet 通知メールアドレス登録)

詳細は [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) の末尾エントリ参照。

---

## リポ状態

- 作業 worktree: `/Users/masa/projects/AMD/amd-os/.claude/worktrees/brave-cohen-15d352`
- 作業 branch: `claude/brave-cohen-15d352`
- main HEAD (本セッション開始時): `c5396c3` (`Merge branch 'claude/funny-perlman-401669'`)
- 適用済 migrations: …024 / 025 / 026 (seeds_data_round2, 別セッション) / **027 (pms phase2)**
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

### 高優先 (Phase 2 の積み残し)

1. **MTGサマリ Phase 2.1: reportEmails 整備**
   - 初回バックフィルで `gmailThreads: 0` が大半。CircleBack 通知メール / GMeet recording 通知メール / クライアント議事録メールが届く先を `DB_Projects.reportEmails` (カンマ区切り) に登録する運用が必要
   - 確認手順: GAS で `mr_gmail_getProjectInfo_("p20")` を呼んで reportEmails の現状を見る
   - CircleBack 通知メールの from アドレス確認 (まさのアカウントで届いてるはず)
   - 必要なら meeting_summaries.md に「reportEmails 標準セット」を追記

2. **MTGサマリ Phase 2.5: AMD-Report GAS R313 を会議サマリ集約方式に書き換え**
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
