# HANDOFF — AMD OS PWA

次セッションが文脈を聞き直さずに再開できる **直近の引き継ぎだけ** をここに書く。

- ⭐⭐⭐ **AMD OS 中核データ正本** → [`design/L2_DATA.md`](design/L2_DATA.md) (L2 6 種 + cron + 動作状況 + Phase 4 構想)
- 仕様 → [`design/SPEC_pwa.md`](design/SPEC_pwa.md) (設計フォルダ全体の入口は [`design/README.md`](design/README.md))
- バグ・教訓 (症状/原因/解決策/教訓) → [`BUGS.md`](BUGS.md)
- 過去セッションの作業ログ → [`design_log/sessions_YYYY-MM.md`](design_log/)
- 共通運用ルール → リポ root の `CLAUDE.md`、PWA 確認方針 → [`AGENTS.md`](AGENTS.md)

---

## 最終更新

2026-05-09 (quirky-moore-b60501 セッション) — **Phase 4 ③ MS進捗 毎時 polling 化 完了**。

**Phase 4 ③ MS進捗 (毎時 polling + source_hash 差分検知)**:
- 旧 `cron/daily-estimate` (03:00 daily) を削除、新 `cron/hourly-estimate` を新設
- `progress_estimate_state` テーブル新設 (migration 029): PK=(project_id, ym), source_hash + last_processed_at で差分検知
- `estimateProgress(projectId, ym, { force?: boolean })` シグネチャ拡張。force=false (cron) なら hash 一致で LLM スキップ + last_processed_at touch + `unchanged: true` を return。手動 UI ボタン / report/generate fire-and-forget は force=true (既存挙動維持)
- target list = アクティブ PJ × {当月, 前月}、`last_processed_at` 古い順 sort、maxItems 14 で打ち切り
- ⚠️ **Vercel Hobby plan は cron schedule が "1日1回まで" 制約**で `0 * * * *` を deploy 時に reject される → vercel.json から外し、**本体GAS の毎時 trigger (`gas/154_PwaCronCaller.js` `nav_pwa_pingHourlyEstimate`) から `Bearer $CRON_SECRET` で curl** で叩く構成。Pro 移行後は vercel.json に戻すだけで切替可能
- 仕様正本: [`design/ms_progress.md`](design/ms_progress.md) 新規、[`design/L2_DATA.md`](design/L2_DATA.md) 状態列を Phase 4 で更新
- TS 型チェック OK / migration 029 適用済 / Vercel deploy + GAS deploy + ScriptProperties + trigger setup は本セッション内で実施
- 詳細: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾エントリ

---

## 1 つ前のセッション

2026-05-09 (brave-cohen-15d352 セッション) — **MTGサマリ Phase 2 + Phase 3 完了 + Phase 4 方針確定**。

**Phase 2 (前段)**: 1 MTG = 1 calendar event 主軸 / Notion 本文 + Gmail (`reportEmails` ±1日) 結合 / Gemini Flash 抽出 / 議事録なしマーカー / migration 027。動作確認 OK (p21 SX で `notion+gmail` 2 件 / `notion` 5 件 等)。

**Phase 3 (本セッションの本丸)**:
- **毎時 0 分 cron** ([gas/153_MeetingHourlyTrigger.js](../gas/153_MeetingHourlyTrigger.js) `nav_meeting_pollRecentlyEndedEvents`) で「過去 60-180 分に終わった PJ 関連 events」を polling
- 各 event を [074 `nav_meeting_processOneEvent_`](../gas/074_MeetingSummaryRepo.js) で抽出 → 拾えれば [migration 028](scripts/migrations/028_meeting_notifications.sql) `meeting_notifications` に upsert
- iOS Swift が polling/realtime sub で受けて APNs 通知 → [`ios/HANDOFF_meeting_notifications.md`](../ios/HANDOFF_meeting_notifications.md) へハンドオフ済 (実装は別セッション)
- 03:00 daily cron は **Phase 2 月単位 fallback** だけに簡素化
- UI: `source_kinds='none'` を「議事録なし」、それ以外で内容空を「議事録あり・抽出空」と区別表示
- ⚠️ 設計判断: 当初 ad-hoc trigger を試したが GAS time-trigger 上限で破綻 → polling 方式に切替 (BUGS.md 参照)

**Phase 4 方針 (まさ確定、次セッション着手)**:
- Phase 3 のパターン (毎時 polling + source_hash 差分検知) を **L2 全データ 6 種に横展開**
- 優先順: ③ MS進捗 → ⑤ メンバーナレッジ + ④ PJナレッジ → ② AMDプロトコル
- spawn task の chip 経由で次セッションに送信済 (詳細は [L2_DATA.md](design/L2_DATA.md) の Phase 4 セクション)

詳細は [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) の末尾エントリ。

---

## リポ状態

- 作業 worktree: `/Users/masa/projects/AMD/amd-os/.claude/worktrees/brave-cohen-15d352`
- 作業 branch: `claude/brave-cohen-15d352`
- main HEAD: **`e200e2c`** (Phase 4 方針 md commit まで反映済)
- 適用済 migrations: …024 / 025 / 026 (seeds_data_round2、別セッション) / **027 (pms phase2)** / **028 (meeting_notifications)**
- GAS Web App deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` → **v1430** (`v1430_phase3_hourly_polling`)
- 設置済 trigger: `nav_meeting_pollRecentlyEndedEvents` 毎時 0 分 1 個 (本番で次の正時に発火)
- PWA Vercel deploy: ✅ 完了 5分51秒 / 本番 URL `amd-os-pwa.vercel.app` 反映済

---

## L2 データ動作状況サマリ (詳細は [`design/L2_DATA.md`](design/L2_DATA.md))

| L2 | 状態 |
|---|---|
| ① monthly report | ✅ R313 (AMD-Report GAS, 05:00) — 集計性が強いので Phase 4 では別扱い |
| ② **AMDプロトコル** | ❌ **未稼働 (0 行、UI も削除済)** ← Phase 4 で復活予定 |
| ③ MS進捗 | ✅ **Phase 4 完了** cron/hourly-estimate (PWA, 毎時 0 分) + source_hash 差分検知 ([ms_progress.md](design/ms_progress.md)) |
| ④ PJナレッジ | ⚠️ 2024 行あるが流入元不明 ← Phase 4 で新規実装 |
| ⑤ **メンバーナレッジ** | ❌ **未稼働 (0 行)** ← Phase 4 で新規実装 |
| ⑥ MTGサマリ | ✅ **Phase 3 稼働** (毎時 polling、Notion + Gmail 結合) |

---

## 残タスク (次セッションで対応)

### 高優先

1. **Phase 4 残り** (詳細は [L2_DATA.md](design/L2_DATA.md) Phase 4 セクション):
   - ③ MS進捗 ✅ **完了 2026-05-09 (本セッション)** ([ms_progress.md](design/ms_progress.md))
   - ⑤ メンバーナレッジ — 新規実装 (5 生データ → Sonnet → member_knowledge upsert、毎時 polling)
   - ④ PJナレッジ — 流入元新規実装 (同上、project_knowledge upsert)
   - ② AMDプロトコル — UI 復活 + 自動抽出 cron
2. **iOS Swift 側の APNs 受信実装** ← 別セッション、ios/ worktree で ([`ios/HANDOFF_meeting_notifications.md`](../ios/HANDOFF_meeting_notifications.md))

### 並行 / 既存

3. **MTGサマリ Phase 2.5: AMD-Report GAS R313 を会議サマリ集約方式に書き換え** (別 clasp、別セッション)
4. **MTGサマリ Phase 2.1: pickup ウィンドウ ±1日 → ±3〜±7日 拡大検討** (任意、議事録メールが遅れて届く運用なら効く)
5. **CX (p20) / CTB (p06) / SE (p10) / p11 で次期 MS 期間 (2026 Q2 〜) を設定**
6. **過去 monthly_reports (4月分等) の復元** — restore script 未実装
7. **5月分の monthly_reports 自動生成** (no report content) — cron 検討
8. `saveProjectMembers` 全削除→挿入をやめて incremental update に (将来事故防止)
9. 本体GAS `cron_invoiceSendNudge_` が 4 重複 → 整理 (GAS time-trigger 枠浪費)

---

## 次セッションの最初の一手

1. リポ状態 4 ステップ (`git fetch --all --prune` → `git log --branches --not --remotes --oneline` → `git branch -a` → `git status -s`)
2. **`pwa/design/L2_DATA.md` を読む** ← Phase 4 仕様の正本
3. **`pwa/design/ms_progress.md` を読む** ← ③ MS進捗 Phase 4 完了仕様 (横展開のパターン元)
4. **`pwa/design/meeting_summaries.md` を読む** ← Phase 3 のパターン (横展開元)
5. **`gas/153_MeetingHourlyTrigger.js` を読む** ← Phase 3 参考実装
6. **`BUGS.md` 最新 3 件を読む** (worktree 取り違え / GAS trigger 上限 / Web App Session)
7. Phase 4 残り (⑤ メンバーナレッジ → ④ PJナレッジ → ② AMDプロトコル) 着手

---

## 運用コマンド (継続)

- **本番 deploy + 通知**: `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`
- **DDL 適用** (worktree からだと .env.local が無いので main worktree 経由):
  ```sh
  cd /Users/masa/projects/AMD/amd-os/pwa
  python3 -X utf8 scripts/apply_ddl.py /path/to/worktree/pwa/scripts/migrations/NNN_name.sql
  ```
- **GAS Web App 経由で関数実行**:
  ```sh
  URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_WEBAPP_URL=//' | tr -d '"')
  KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_API_KEY=//' | tr -d '"')
  curl -sL "$URL?mode=pwaApi&key=$KEY&action=listProps"        # ScriptProperties 一覧
  curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_meeting_listAllProjectTriggers"  # trigger 一覧
  ARGS=$(node -e 'console.log(encodeURIComponent(JSON.stringify(["arg1","arg2"])))')
  curl -sL --max-time 360 "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=FUNCTION_NAME&args=$ARGS"
  ```
- **GAS push + deploy update**:
  ```sh
  cd /Users/masa/projects/AMD/amd-os/.claude/worktrees/<worktree>/gas
  npx --yes @google/clasp@latest push --force
  npx --yes @google/clasp@latest deploy --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G --description "v<n>_<desc>"
  ```
