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

2026-05-10 (affectionate-easley-9b52b8、深夜) — **創業メンバー LLM 推定 + Triple Helix Phase 2-A/B + UI 改善多数**。

### 本セッション 後半の主要成果

- **創業メンバー LLM 推定** (大新機能): migration 040 + `/api/cron/founding-members-extract` + `CockpitFoundingMembersModal` + `estimateHrlFromMembers`
  - **AMD 内外含む全員** (大学 PI / VC / 産業パートナー / 政府担当者) を Sonnet 4.5 で抽出
  - 5 PJ (p06/p09/p11/p20/p21) で **66 名抽出成功**: SX 13 名 (杉浦先生・中島先生・石原・戒能・種市・黒田・堀淵 等まさ期待通り)
  - HRL 簡易推定 (ルールベース 0-9): 0-3 (1-3 名) / 3-6 (4-9 名) / 5-9 (10+ 名 + 多様性)
  - l2_notifications (kind='founding_members') 連携、毎週月曜 03:30 JST cron
- **Phase 2-A: C_compete (競合密度)**: project_ventures 集計、観測量カバレッジ 3/7 → 4/7
- **Phase 2-B: lane 個別フィルタ**: atlas_signals.domain prefix → lane mapping、P/R を lane 個別に
- **プログレスバー**: 1k-50k log scale (3.5k 設立 GO マーカー)
- **XRL 整数表示**: 詳細 + Cockpit モーダル両方
- **数式 LaTeX 化**: 紫枠 (M 4 段に拡張) + 詳細 + Cockpit モーダル全部
- **経時グラフプロットクリック → S+M/X/F popup**
- **SX MTGサマリ原因調査** → BUGS.md (繰り返し MTG の Notion 議事録放置 + AI 議事録未生成)

---

## 前回 (2026-05-10 夜) — Triple Helix 観測モデル全面再設計

### モデル定義の確立 (理論正本との整合)

まさ判断: 個別論文の蓄積 (旧 scholar) は μ_A の根拠にならない。μ_A は **Triple Helix の隠れ状態**で、観測量 N (lane × 期間の論文数) を主観測量とする **マクロ指標**。

- `before-zero/theory/state_space_model.md §4.1`: 隠れ状態 (μ_A, μ_I, μ_G) と観測量 (P, B, V, R, I_R, N) の C 行列 loading
- `before-zero/theory/data_specification.md §3, §N`: 各観測量の操作的定義 (四半期粒度、データソース)
- `before-zero/theory/bvar_prior.md §3.2`: C 行列の数値 prior

### 本セッションの主要成果

- **scholar テーブル + 個別論文 cron 廃止** (migration 036_scholar_drop): μ_A 定義から外れる
- **papers_log を quarter 単位に再構築** (migration 037): UNIQUE (lane, observed_at) 追加、既存 85 行 (year 単位) クリア
- **OpenAlex weekly cron** [`/api/cron/papers-quarterly-ingest`](src/app/api/cron/papers-quarterly-ingest/route.ts): 5 lane × 直近 16 quarter → upsert。vercel.json に毎週月曜 18:20 UTC (= 03:20 JST 火曜) 登録
- **`triple_helix_loading` テーブル新設** (migration 038): bvar_prior §3.2 の C 行列を 7 行 seed (P/B/V/R/I_R/N/C_compete × μ_A/μ_I/μ_G + available フラグ + データソース)
- **`src/lib/triple-helix-observations.ts` 新設**: 観測量 fetcher + min-max 正規化 (過去 16 Q) + 重み付き μ 計算 + 未取得観測量除外
- **`src/components/venture-map/TripleHelixMatrix.tsx` 新設**: 詳細ページ M カード本体。数式 4 段 (Tex) / μ ラダー (μ_A→σ_SU→M) / 6×3 マトリクス (loading 強度ヒートマップ + 寄与値 hover) / 観測値 bar / 被覆率
- **`AmdScoreView` の M カード書き換え**: 旧 μ_A/I/G 単純行 → TripleHelixMatrix 全部入り。人間入力 notes (Tsukuyomi) は補助表示として下部に
- **`/scholar` ページ作り変え**: 個別論文一覧 → 5 lane × quarter trend chart (SVG line + 前年同期比カード + Quarterly テーブル)。タブ名は Scholar のまま (まさ指定)
- 詳細: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾エントリ

### Phase 1 で実装した観測量

| 観測量 | データソース | 状態 |
|---|---|---|
| **N** (論文) | OpenAlex → papers_log (weekly cron) | ✅ 取れてる (lane × quarter) |
| **P** (政策) | atlas_signals.domain LIKE 'B.%' | ✅ 取れてる (全社共通、lane フィルタ Phase 2) |
| **R** (言及) | atlas_signals.status='accepted' 全件 | ✅ 取れてる (全社共通) |
| **B** (予算) | atlas_signals.source_type='grant' | ❌ Phase 2 (NEDO/AMED scrape) |
| **V** (VC) | Crunchbase / INITIAL | ❌ Phase 2 |
| **I_R** (研究費) | KAKEN API | ❌ Phase 2 |
| **C_compete** (競合) | project_ventures 集計 | ❌ Phase 2 |

被覆率 = 3/7 (43%)。AmdScoreView 内で「データ被覆率: X/7」と透明化表示。

### ⚠️ 次セッションの最初の確認

1. 初回 cron 投入: `curl -H "Authorization: Bearer $CRON_SECRET" https://amd-os-pwa.vercel.app/api/cron/papers-quarterly-ingest` (一度キックして papers_log を埋める)
2. `/scholar` で 5 lane × 16 quarter trend chart が表示されるか
3. AMD Score 詳細ページ (例 `/venture-map/amd-score/p20`) の M カードに 6×3 マトリクス、数式 4 段、μ ラダー、観測値 bar、被覆率 3/7 が表示されるか
4. C 行列の loading が `triple_helix_loading` テーブルから引かれてるか (`SELECT * FROM triple_helix_loading;` で 7 行)

### Phase 2 (次セッション以降) — 観測量の網羅

- **KAKEN API ingest** で I_R (研究費) 取得 → C 行列 loading に追加
- **NEDO / SIP / JST scrape** で B (公募予算)
- **Crunchbase or INITIAL** で V (VC 投資)
- **`project_ventures` 内部集計**で C_compete (競合密度)
- **PJ.lane × atlas_signals.suggested_tags 突合**で P/R を lane 個別に絞る (現状は全社共通)
- **Phase 3**: BVAR Kalman filter で隠れ状態 μ_A(t)/μ_I(t)/μ_G(t) を観測量から逆推定 (state_space_model.md §4.5)

仕様: [`design/amd_score.md`](design/amd_score.md)「Triple Helix 観測モデル」セクション参照。

---

## リポ状態 (2026-05-10 夜)

- main HEAD: 本セッション merge で更新予定
- 適用済 migrations: …035 (scholar、廃止前) → **036 (scholar_drop) / 037 (papers_log_quarterly) / 038 (triple_helix_loading)** ← 本セッション追加
- GAS Web App deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` → `v1447`
- PWA Vercel deploy: ✅ Triple Helix 観測モデル反映 deploy 予定 (`amd-os-pwa.vercel.app`)

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
