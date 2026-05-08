# HANDOFF — AMD OS PWA

次セッションが文脈を聞き直さずに再開できる **直近の引き継ぎだけ** をここに書く。

- ⭐⭐⭐ **AMD OS 中核データ正本** → [`design/L2_DATA.md`](design/L2_DATA.md) (L2 6 種 + cron + 動作状況)
- 仕様 → [`design/SPEC_pwa.md`](design/SPEC_pwa.md) (設計フォルダ全体の入口は [`design/README.md`](design/README.md))
- バグ・教訓 (症状/原因/解決策/教訓) → [`BUGS.md`](BUGS.md)
- 過去セッションの作業ログ → [`design_log/sessions_YYYY-MM.md`](design_log/)
- 共通運用ルール → リポ root の `CLAUDE.md`、PWA 確認方針 → [`AGENTS.md`](AGENTS.md)

---

## 最終更新

2026-05-09 (funny-perlman セッション) — **MTGサマリ機能 Phase 1 + L2_DATA 正本化**。
- MTGサマリ枠を空ダミーから動作実装へ (Notion議事録単独抽出、Gemini 2.5 Flash、SX で 7 件保存・表示確認 OK、ただし大半は議事録本文薄くて空 items)
- 報告会日程調整の予約完了がタスク反映されないバグ修正 (router.refresh + localConfirmedISO)
- **AMD OS 中核データ正本 `pwa/design/L2_DATA.md` 新設** (L2 6 種 = monthly report / AMDプロトコル / MS進捗 / PJナレッジ / メンバーナレッジ / MTGサマリ + レポート + 全 cron + 動作状況)。AGENTS.common.md / pwa/CLAUDE.md / pwa/AGENTS.md / pwa/design/README.md / gas/CLAUDE.md / knowledge/amd_os_vision.md の **6 入口に導線**

詳細は [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) の末尾エントリ参照。

---

## リポ状態

- 作業 worktree: `/Users/masa/projects/AMD/amd-os/.claude/worktrees/funny-perlman-401669`
- 作業 branch: `claude/funny-perlman-401669` (main にも順次 merge + push 済 = `c1cea1c` まで)
- main HEAD: `898d218` (2026-05-09 終了時点。VC 別セッションの `9bb64b7` が間に挟まってる)
- 本番デプロイ: `https://amd-os-pwa.vercel.app` 反映済 (Vercel + GAS Web App v1421)
- 適用済 migrations: …022 / 023 / **024 (project_meeting_summaries)** / **025 (pms anon read)**
- GAS Web App deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` → v1421 (`v1421_maxItems_limit`)

⚠️ **本セッション末で未 commit の作業がある**: 上記の L2_DATA / 6入口導線 / GAS 改修 / その他は次セッション開始時にまだ worktree 上の uncommitted 状態の可能性あり (handoff の最後で commit + push する想定)。`git status -s` を必ず確認すること。

---

## L2 データ動作状況サマリ (詳細は [`design/L2_DATA.md`](design/L2_DATA.md))

| L2 | 状態 |
|---|---|
| ① monthly report | ✅ R313 (AMD-Report GAS, 05:00) |
| ② **AMDプロトコル** | ❌ **未稼働 (0 行、UI も削除済)** ← spawn 1 で復活作業中 |
| ③ MS進捗 | ✅ cron/daily-estimate (PWA, 03:00) |
| ④ PJナレッジ | ⚠️ 2024 行あるが流入元不明 ← spawn 2 で ReportGAS 実装予定 |
| ⑤ **メンバーナレッジ** | ❌ **未稼働 (0 行)** ← spawn 2 で同時実装 |
| ⑥ MTGサマリ | 🚧 Phase 1 稼働 (Notion単独, 7 行)、Phase 2 で 5 生データ統合へ |

---

## 残タスク (次セッションで対応)

### 高優先 — 別 worktree で並行可能 (chip 出てる)

1. **AMDプロトコル UI 復活 + スプシ掘り起こし** ← spawn task chip (1)
   - 元はトップメニューの Atlas 左にあった、復活要
   - Supabase `protocols` 0 行、過去スプシから掘り起こしてバックフィル
   - 詳細指示は spawn の prompt 参照

2. **PJナレッジ + メンバーナレッジ を AMD-Report GAS の cron で実装** ← spawn task chip (2)
   - 5 生データから抽出 → `project_knowledge` / `member_knowledge` に upsert
   - daily cron 新設、source_hash で差分検知
   - 詳細指示は spawn の prompt 参照

### 中優先 — 本セッションのスコープを次に引き継ぐ

3. **MTGサマリ Phase 2 実装** (本セッションで Phase 1 までで止めた)
   - 1 MTG = **1 カレンダーイベント** を主軸に再設計
   - Notion議事録 + Calendar + Slack + Gmail + Drive + GMeet を**全部集める**
   - データ収集の時間範囲は既存 305 / 306 / 307 / 308 / 309 / R320 のロジックをそのまま流用 (まさ指示)
   - 議事録なし MTG は `summary_short = "議事録なし"` で残す (まさ指示)
   - `gas/074_MeetingSummaryRepo.js` をほぼ全書き直し
   - `pwa/design/meeting_summaries.md` を Phase 2 仕様に書き直し
   - スキーマ調整: `meeting_id = Notion page id` → `meeting_id = calendar event id` 主軸 (migration 026)
   - 既存 7 件削除 + 全ソース合体で再バックフィル
   - 完了後 R313 monthly_reports cron も「会議サマリ集約方式」に書き換え (AMD-Report GAS、別セッション)

### 既存の残タスク (前セッションから引き継ぎ)

4. **CX (p20) / CTB (p06) / SE (p10) / p11 で次期 MS 期間 (2026 Q2 〜) を設定**
   - cockpit に「⚠️ 今期の MS 期間 終了」警告 + 次期 MS 設定バナーが出る
   - 設定すれば cron が member_activities を自動で埋める
5. **過去 monthly_reports (4月分等) の復元** — スプシ DB_MonthlyReports からの restore script 未実装
6. **5月分の monthly_reports 自動生成** (no report content) — cron 検討
7. `saveProjectMembers` 全削除→挿入をやめて incremental update に (将来事故防止)

---

## 次セッションの最初の一手

1. リポ状態 4 ステップ (`git fetch --all --prune` → `git log --branches --not --remotes --oneline` → `git branch -a` → `git status -s`) を必ず実行
2. **`pwa/design/L2_DATA.md` を読む** ← AMD OS 中核データ正本、ここに L2 6 種と全 cron が集約されてる
3. その後 `pwa/design/README.md` → 必要に応じて SPEC / cockpit / routine / meeting_summaries
4. `BUGS.md` の最新 6 エントリ (報告会日程調整 / SUPABASE_SERVICE_KEY 推測 / Gemini モデル名 / PostgREST URL 長 / RLS anon / GAS 6分制限) を読む
5. **MTGサマリ Phase 2 着手** — 上記「残タスク 3」の手順で
   - もしくはまさが別件 (spawn 1, 2 のレビュー含む) を優先するならその指示に従う

---

## 運用コマンド (前セッションから継続)

- **本番 deploy + 通知**: `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`
- **DDL 適用**: `python3 -X utf8 scripts/apply_ddl.py scripts/migrations/NNN_name.sql` (リポ pwa/ から)
- **cron 手動 trigger**: `curl -H "Authorization: Bearer $CRON_SECRET" "https://amd-os-pwa.vercel.app/api/cron/<name>?ym=YYYYMM"`
- **GAS Web App 経由で関数実行** (本セッションで確立、`pwa/design/L2_DATA.md` にも記載):
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
