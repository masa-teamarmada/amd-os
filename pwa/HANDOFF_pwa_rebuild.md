# HANDOFF — AMD OS PWA

次セッションが文脈を聞き直さずに再開できる **直近の引き継ぎだけ** をここに書く。
詳細は各正本 md / sessions log を参照。

- ⭐⭐⭐ **AMD OS 中核データ正本** → [`design/L2_DATA.md`](design/L2_DATA.md) (L2 6 種 + cron + 動作状況)
- ⭐⭐ **DB スキーマ正本** → [`design/db_schema.md`](design/db_schema.md) (列名は必ずここを grep、想像で書かない)
- 仕様 → [`design/SPEC_pwa.md`](design/SPEC_pwa.md) ([`design/README.md`](design/README.md) が入口)
- バグ・教訓 → [`BUGS.md`](BUGS.md)
- 過去セッションの作業ログ → [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md)
- 共通運用ルール → リポ root `CLAUDE.md`、PWA 確認方針 → [`AGENTS.md`](AGENTS.md)

---

## 最終更新

2026-05-09 (quirky-moore-b60501 セッション、長時間) — Phase 4 全 4 L2 + 通知 UI + 修正依頼ループ + Notion AI 議事録対応 + 名前正規化 + DB schema reference 自動生成 + 多数のバグ修正。

詳細は [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾エントリ群。

### 本セッションの主要成果

1. **Phase 4 全 4 L2 (③⑤④②) 抽出 cron** 完成 — GAS 155 + PWA progress-estimator + GAS 154 (Vercel Hobby cron 制約の回避策で curl)
2. **Swift APNs 通知** 実装 (= iOS AMDOSApp.swift NotificationService 完成、masaiPhone install/launch 確認済)
3. **PWA `/notifications` 画面** 新規 (一覧 + 元データ展開 + 修正依頼フォーム)、ヘッダー 📬 ベル + Dashboard 通知バナー
4. **修正依頼ループ (l2_feedbacks)** — POST 直後に **即 force 再抽出を fire-and-forget**、`applied_count` で反映状況可視化
5. **Notion AI 議事録ページ対応** (gas/074): `transcription` block 内 `summary_block_id` を再帰取得して BWE 株主総会 採決まで完全抽出成功
6. **名前正規化マップ** (gas/079): `members.member_name` から動的生成、「山田氏=りょー」「山地=まさ」「chiko=ちこ」等
7. **DB schema reference 自動生成** (`pwa/design/db_schema.md`、88 テーブル/948 列、`scripts/dump_schema.py`)
8. **Notion 議事録 cron 停止** (= 1 会議 2 ページ生成事故対応、AI 一本化)
9. **既読折りたたみ + 即既読化 UI** (= 開いた瞬間 notified_at = now() PATCH、グループ分けは server 値固定)
10. **多数のバグ修正** (member_activities 列名 4 つ間違い / monthly_reports 他 PJ 内容汚染 防御 / Vercel Hobby cron 制約回避 / GAS time-trigger 上限整理)

---

## リポ状態

- 作業 worktree: `/Users/masa/projects/AMD/amd-os/.claude/worktrees/quirky-moore-b60501`
- 作業 branch: `claude/quirky-moore-b60501`
- main HEAD: **`a0db8c1`** (PJナレッジ汚染防御 + p10/202604 修復)
- 適用済 migrations: …028 / **029 (progress_estimate_state)** / **030 (l2_extract_state)** / **031 (l2_notifications)** / **032 (l2_feedbacks)**
- GAS Web App deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` → **v1447** (`v1447_pj_meta_strict_invalid_filter`)
- PWA Vercel deploy: ✅ 直近完了 (`amd-os-pwa.vercel.app`)
- 設置済 GAS trigger 17 個 (= MTGサマリ毎時 / Phase 4 ⑤④② 毎時 3 個 / PWA 毎時 ping / その他 既存)

---

## L2 データ動作状況サマリ (詳細は [`design/L2_DATA.md`](design/L2_DATA.md))

| L2 | 状態 |
|---|---|
| ① monthly report | ✅ R313 (AMD-Report GAS, 別 clasp、05:00 daily) |
| ② **AMDプロトコル** | ✅ **Phase 4 稼働** GAS 155 `nav_protocol_pollAll` 毎時 |
| ③ MS進捗 | ✅ **Phase 4 稼働** GAS 154 → PWA `cron/hourly-estimate` 毎時 |
| ④ PJナレッジ | ✅ **Phase 4 稼働** GAS 155 `nav_project_knowledge_pollAll` 毎時 (汚染防御 v4_meta_strict) |
| ⑤ メンバーナレッジ | ✅ **Phase 4 稼働** GAS 155 `nav_member_knowledge_pollAll` 毎時 (役割分担統合) |
| ⑥ MTGサマリ | ✅ **Phase 4 稼働** GAS 153 毎時 polling + AI 議事録対応 + alias + feedback |

通知: ⑥ → `meeting_notifications`、③⑤④② → `l2_notifications`、両方 Swift APNs 受信実装済 (= masaiPhone)。

---

## 残タスク (次セッションで対応)

### 高優先

1. **データ汚染検出 + 上流修正**:
   - 全 monthly_reports 汚染検出関数 (= projectName と無関係キーワード混入を測る)。`p10/202604` (CX 内容で SE PJ に保存) のような他事故も見つける
   - 汚染源 (AMD-Report GAS R313 / MMO マシンの Claude Code scheduled task / 手動投入) の調査と修正 ← **本リポ外なので別環境で**
2. **iOS Swift 通知タップ → 該当画面へ navigation**:
   - 当面 print のみ。l2_kind 別 (member_knowledge → メンバー詳細 / project_knowledge → cockpit / protocols → /admin/protocols / ms_progress → cockpit)
   - ios/HANDOFF_l2_notifications.md 参照

### 中優先

3. **AMDプロトコル UI に candidate → confirmed 昇格ボタン**: 現状 status='candidate' で蓄積されるが UI 上で確定昇格できない
4. **Phase 4.x = 5 生データ直結**:
   - ⑤ メンバーナレッジを Slack 個人 DM / mention search から直接抽出
   - ④ PJナレッジを Notion 経営戦略 page / Slack channel から直接抽出
5. **xcodegen 入れて iOS の Models/Service 別ファイル化** (= 現状 AMDOSApp.swift に同梱)
6. **MTGサマリ Phase 2.5: AMD-Report GAS R313 を会議サマリ集約方式に書き換え** (別 clasp、別セッション)
7. **本体GAS `cron_invoiceSendNudge_` 重複生成元の特定** (= grep で `newTrigger("cron_invoiceSendNudge_"` を find → 既存 delete を入れる)
8. **l2_feedbacks の archive UI** (古い指摘を archive)

### 低優先 / 既存

9. CX (p20) / CTB (p06) / SE (p10) / p11 で次期 MS 期間 (2026 Q2 〜) を設定
10. 5月分の monthly_reports 自動生成 検討
11. `saveProjectMembers` 全削除→挿入をやめて incremental update に

---

## 次セッションの最初の一手

1. リポ状態 4 ステップ (`git fetch --all --prune` → `git log --branches --not --remotes --oneline` → `git branch -a` → `git status -s`)
2. **`pwa/design/L2_DATA.md`** を読む ← 中核データ正本
3. **`pwa/design/db_schema.md`** を grep して列名確認 ← コード書く前に必ず
4. **`pwa/BUGS.md`** 最新 3 件を読む (= 直近事故の教訓)
5. **`pwa/design_log/sessions_2026-05.md`** 末尾セクションを読む ← 直近セッションの作業ログ詳細
6. やりたいタスクが Phase 4 関連なら該当機能 md (ms_progress / member_knowledge / project_knowledge / amd_protocol / notifications / meeting_summaries) を読む

---

## 運用コマンド (継続)

- **PWA Vercel deploy**: `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`
- **DDL 適用** (worktree から、main worktree の .env.local を使う):
  ```sh
  cd /Users/masa/projects/AMD/amd-os/pwa
  python3 -X utf8 scripts/apply_ddl.py /path/to/worktree/pwa/scripts/migrations/NNN_name.sql
  ```
- **DB schema 再生成** (DDL 変更時に同じ commit で再生成):
  ```sh
  cd /Users/masa/projects/AMD/amd-os/pwa
  python3 -X utf8 /path/to/worktree/pwa/scripts/dump_schema.py
  ```
- **GAS Web App 経由で関数実行**:
  ```sh
  URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_WEBAPP_URL=//' | tr -d '"')
  KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_API_KEY=//' | tr -d '"')
  curl -sL "$URL?mode=pwaApi&key=$KEY&action=listProps"
  curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_meeting_listAllProjectTriggers"
  ARGS=$(node -e 'console.log(encodeURIComponent(JSON.stringify(["arg1","arg2"])))')
  curl -sL --max-time 360 "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=FUNCTION_NAME&args=$ARGS"
  ```
- **GAS push + deploy update**:
  ```sh
  cd /Users/masa/projects/AMD/amd-os/.claude/worktrees/<worktree>/gas
  npx --yes @google/clasp@latest push --force
  npx --yes @google/clasp@latest deploy --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G --description "v<n>_<desc>"
  ```
- **手動 cron ping** (GAS):
  ```sh
  curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_pwa_pingHourlyEstimate"          # ③ MS進捗 (PWA cron)
  curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_member_knowledge_pollAll"        # ⑤ メンバー
  curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_project_knowledge_pollAll"       # ④ PJ
  curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_protocol_pollAll"                # ② プロトコル
  curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_meeting_pollRecentlyEndedEvents" # ⑥ MTGサマリ
  ```
