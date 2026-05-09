# HANDOFF — AMD OS PWA

次セッションが文脈を聞き直さずに再開できる **直近の引き継ぎだけ** をここに書く。
詳細は各正本 md / sessions log を参照。

- ⭐⭐⭐ **AMD OS 中核データ正本** → [`design/L2_DATA.md`](design/L2_DATA.md) (L2 6 種 + cron + 動作状況)
- ⭐⭐ **DB スキーマ正本** → [`design/db_schema.md`](design/db_schema.md) (列名は必ずここを grep、想像で書かない)
- 仕様 → [`design/SPEC_pwa.md`](design/SPEC_pwa.md) ([`design/README.md`](design/README.md) が入口)
- AMD Score 仕様 → [`design/amd_score.md`](design/amd_score.md)
- バグ・教訓 → [`BUGS.md`](BUGS.md)
- 過去セッションの作業ログ → [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md)
- 共通運用ルール → リポ root `CLAUDE.md`、PWA 確認方針 → [`AGENTS.md`](AGENTS.md)

---

## 最終更新

2026-05-09 〜 10 (elegant-swanson-7a0123) — **AMD Score 詳細ページ全面改修 + Tsukuyomi 連携 + 内閣府 SIP 定義 embed**。

### 本セッションの主要成果

- **律速判定ロジック修正**: `argmin(share)` → `argmax(α/(X+1))` (Cobb-Douglas 偏微分根拠)。詳細は [`BUGS.md`](BUGS.md) の該当エントリ
- **FRL 6 因子拡張**: ALQ 4 + Grit (Duckworth 2007) + Resilience (Markman 2005)。migration 031 / theory `amd_score.md` §3.F.5
- **詳細ページ全面改修**: ScoreHero / BalanceBar / FormulaPanel(引用文献つき) / Factor3Breakdown / TimeSeries / FrlAlqPanel
- **スコア入力 UI 完全廃止 → Tsukuyomi 軸クリック連携**: `window.dispatchEvent("tsukuyomi:open", { detail: { message } })` で drawer 起動 + prefill
- **α 編集を `/venture-map/amd-score/retrofit` 別ページに移設** (タブバー非表示、詳細から link、全 PJ シミュレーション)
- **「最新評価」を `evaluated_at <= today` でフィルタ** (BUGS.md 参照: 未来 retrofit seed が latest になる罠)
- **根拠 fallback**: XRL は `xrl_notes` → `project_xrl_log.source_note` の `{axis}_reason` JSON parse → 仮置き / μ_I/μ_G は `mu_notes` → `atlas_signals` (domain 分類) → 仮置き
- **Tsukuyomi tool に内閣府 SIP 9 段階定義 embed**: TRL/BRL/GRL/SRL/HRL の各 level 文章を `update_amd_score_input` description に
- migration: `030_amd_score_axis_notes` / `031_amd_score_frl_grit_resilience` 本番適用済 (※同番号で別ファイルが quirky-moore 側にある: `030_l2_extract_state` 等。ファイル名識別なので衝突なし)
- 詳細: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾エントリ

### ⚠️ 次セッション必須: μ_A (学術) の根拠データ DB 構築

`atlas_signals` には学術専用 domain がなく、μ_A の根拠を Atlas からは拾えない。次セッションで:

- 論文 DB 構築 (Crossref / Semantic Scholar API + 該当 lane キーワードで論文 metadata 取得)
- 研究費データ取り込み (科研費 KAKEN API / NEDO / SIP / JST 採択リスト)
- 論文 / 特許 / 学会発表の時系列カウント → μ_A の数値根拠
- `atlas_papers` (or 同等) テーブル新設、`fetchAtlasMacroSignals` を拡張して `mu_a` 配列を返す
- `AmdScoreView` の μ_A 行 fallback を「atlas_papers の最新 N 件」を使うように更新

現状 μ_A subtitle は "Atlas に学術 domain 未対応 — 論文 DB 連携は今後" の仮置き。

仕様: [`design/amd_score.md`](design/amd_score.md) 末尾「次セッション TODO」参照。

---

## リポ状態 (2026-05-10)

- main HEAD: `cea9ace` (Merge `claude/elegant-swanson-7a0123` で AMD Score 改修まで反映)
- 適用済 migrations: …029 / **030 (l2_extract_state)** + **030 (amd_score_axis_notes)** / **031 (l2_notifications)** + **031 (amd_score_frl_grit_resilience)** / **032 (l2_feedbacks)** ← 同番号で別ファイル名、apply_ddl はファイル名識別
- GAS Web App deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` → `v1447`
- PWA Vercel deploy: ✅ 直近完了 (`amd-os-pwa.vercel.app`、AMD Score 改修反映済)

---

## L2 データ動作状況サマリ (詳細は [`design/L2_DATA.md`](design/L2_DATA.md))

| L2 | 状態 |
|---|---|
| ① monthly report | ✅ R313 (AMD-Report GAS, 別 clasp、05:00 daily) |
| ② AMDプロトコル | ✅ Phase 4 稼働 GAS 155 `nav_protocol_pollAll` 毎時 |
| ③ MS進捗 | ✅ Phase 4 稼働 GAS 154 → PWA `cron/hourly-estimate` 毎時 |
| ④ PJナレッジ | ✅ Phase 4 稼働 GAS 155 `nav_project_knowledge_pollAll` 毎時 |
| ⑤ メンバーナレッジ | ✅ Phase 4 稼働 GAS 155 `nav_member_knowledge_pollAll` 毎時 |
| ⑥ MTGサマリ | ✅ Phase 4 稼働 GAS 153 毎時 polling + AI 議事録対応 + alias + feedback |

通知: ⑥ → `meeting_notifications`、③⑤④② → `l2_notifications`、両方 Swift APNs 受信実装済 (= masaiPhone)。

---

## 残タスク (次セッションで対応)

### 高優先 (次セッションのメインタスク)

1. **μ_A 論文 DB 構築** (上記「⚠️ 次セッション必須」参照)

### 中優先 (前セッションから継続)

2. **データ汚染検出 + 上流修正**: 全 monthly_reports 汚染検出関数。汚染源 (AMD-Report GAS R313 / MMO マシンの Claude Code scheduled task / 手動投入) 調査と修正
3. **iOS Swift 通知タップ → 該当画面へ navigation**: 当面 print のみ。l2_kind 別 (member_knowledge → メンバー詳細 / project_knowledge → cockpit / protocols → /admin/protocols / ms_progress → cockpit)
4. **AMDプロトコル UI に candidate → confirmed 昇格ボタン**: 現状 status='candidate' で蓄積されるが UI 上で確定昇格できない
5. **Phase 4.x = 5 生データ直結**: ⑤ メンバーナレッジを Slack 個人 DM / mention search から直接抽出 / ④ PJナレッジを Notion 経営戦略 page / Slack channel から直接抽出
6. **xcodegen 入れて iOS の Models/Service 別ファイル化**
7. **MTGサマリ Phase 2.5: AMD-Report GAS R313 を会議サマリ集約方式に書き換え**
8. **本体GAS `cron_invoiceSendNudge_` 重複生成元の特定**
9. **l2_feedbacks の archive UI**

### 低優先 / 既存

10. CX (p20) / CTB (p06) / SE (p10) / p11 で次期 MS 期間 (2026 Q2 〜) を設定
11. 5月分の monthly_reports 自動生成 検討
12. `saveProjectMembers` 全削除→挿入をやめて incremental update に

---

## 次セッションの最初の一手

1. リポ状態 4 ステップ (`git fetch --all --prune` → `git log --branches --not --remotes --oneline` → `git branch -a` → `git status -s`)
2. **`pwa/HANDOFF_pwa_rebuild.md`** (このファイル) の最新更新を確認
3. **`pwa/design/amd_score.md`** 末尾の「次セッション TODO: μ_A 用 論文 DB 構築」を読む ← 次タスクの仕様
4. **`pwa/BUGS.md`** 最新 2 件 (律速 argmin / retrofit seed 罠) を読む
5. **`pwa/design_log/sessions_2026-05.md`** 末尾セクション (AMD Score 改修) を読む ← 直近セッション詳細
6. **`pwa/design/db_schema.md`** で既存 atlas_*  / project_* 列名を確認 ← migration 設計の前
7. **`pwa/src/lib/atlas-macro-signals.ts`** を読む ← μ_A 拡張のテンプレ
8. 論文 DB 設計案を出す → まさ承認 → migration 033 〜 投入 → fetcher 拡張 → AmdScoreView 連携 → deploy

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
