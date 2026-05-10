# HANDOFF — AMD OS PWA

次セッションが文脈を聞き直さずに再開できる **直近の引き継ぎだけ** をここに書く。
詳細は各正本 md / sessions log を参照。

- ⭐⭐⭐ **AMD OS 中核データ正本** → [`design/L2_DATA.md`](design/L2_DATA.md) (L2 6 種 + 候補 ⑦ 創業メンバー)
- ⭐⭐ **DB スキーマ正本** → [`design/db_schema.md`](design/db_schema.md) (列名は必ずここを grep、想像で書かない)
- 仕様 → [`design/SPEC_pwa.md`](design/SPEC_pwa.md) ([`design/README.md`](design/README.md) が入口)
- AMD Score 仕様 (Triple Helix 観測モデル含む) → [`design/amd_score.md`](design/amd_score.md)
- コックピット仕様 → [`design/cockpit.md`](design/cockpit.md)
- バグ・教訓 → [`BUGS.md`](BUGS.md)
- 過去セッションの作業ログ → [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md)
- 共通運用ルール → リポ root `CLAUDE.md`、PWA 確認方針 → [`AGENTS.md`](AGENTS.md)

---

## 🚨 次セッション最優先タスク

**SX (p21) MTGサマリ抽出バグの対応**。詳細は [`BUGS.md`](BUGS.md) 最新エントリ「SX (p21) 繰り返し MTG `int) SX 社内打ち合わせ` で議事録抽出が空になる」参照。

### 原因 (調査済)
- 繰り返しイベント `timth289ausur5avf894qtpekl_*` / `738970jsaspt5h9vcv4l1ef2hk_*` の Notion 議事録ページが **cron テンプレ「Meet（ここで /meet を打つ）」のままで本文ゼロ**。`sourceAiPageId` 空 (= AI 議事録ページ未生成)
- Gmail thread 2 件取れるが LLM が「SX に関連しない」と判定 (gas/074 v4_alias_feedback プロンプトが SX = solvioraX を alias resolve できない可能性)
- 3/24 の `SX)int-納品物相談` だけ中身あるのは **単発イベント** (別 Notion ページ存在)

### 修正候補 3 案 (優先順)
1. **(b) Gmail 関連性判定の緩和**: gas/074 のプロンプトで「SX = solvioraX」alias を強める。`_meeting_resolveProjectName_` を拡張 (DB_Projects + project_ventures.display_name 両方から alias 候補を生成)
2. **(a) Notion AI 設定確認**: SX 系 MTG (繰り返し instance) で AI 議事録自動生成が有効になってるかまさが Notion 側で確認 (= 運用タスク)
3. **(c) Slack ingest**: SX 専用 Slack channel から MTG 周辺のメッセージを取り込む新ロジック (Phase 4.x で計画済)

### 作業手順 (推奨)
1. `nav_meeting_processOneEvent_` を `force:true` で SX の各 meeting_id を叩いて sourceKinds / gmailThreads / summaryShort を確認
2. gas/074 の `_meeting_resolveProjectName_` を読む → alias 拡張箇所を特定
3. プロンプト v5 化 (alias 強化、source_hash に prompt rev 含める) → deploy → 再抽出
4. SX 各 meeting で summary_short が「議事録なし」以外になるか検証
5. 同じ問題が他 PJ で起きてないかも合わせて確認 (`SELECT project_id, COUNT(*) FILTER (WHERE summary_short = '議事録なし') FROM project_meeting_summaries GROUP BY 1`)

---

## 直近セッション (2026-05-10、affectionate-easley-9b52b8)

### 主要成果
- **創業メンバー LLM 推定** (大新機能 / 雛形完成、L2 候補 ⑦):
  - migration 040 + `cron/founding-members-extract` + `CockpitFoundingMembersModal` + `estimateHrlFromMembers` (HRL ルールベース 0-9)
  - 5 PJ で 66 名抽出成功 (SX 13 名で愛媛大 PI / VC パートナーズ / 堀淵さんまで全部)
  - l2_notifications (kind='founding_members') 連携、毎週月曜 03:30 JST cron
- **Triple Helix 観測モデル M カード**:
  - migration 036 (scholar 廃止) / 037 (papers_log quarter 化) / 038 (triple_helix_loading) / 039 (C_compete available) / 040 (founding_members)
  - 観測量カバレッジ 4/7 (N=papers_log / P=atlas policy / R=atlas news / C_compete=project_ventures)
  - 紫枠 FormulaPanel が Triple Helix 4 段 (M / σ_SU / μ_x / ỹ_p) に拡張、全数式 LaTeX 化
  - C 行列 6×3 ヒートマップ + 観測値 bar + 寄与値 hover が AMD Score 詳細ページ M カードに
- **UI 改善 (まさフィードバック対応)**:
  - プログレスバー 1k-50k log scale (3.5k = 設立 GO マーカー)
  - XRL 整数表示 (詳細ページ + Cockpit モーダル)
  - 経時グラフプロットクリック → S + M/X/F popup
  - retrofit ページに FormulaPanel 折り畳み + 数式 LaTeX
- **SX MTGサマリ原因調査** → BUGS.md に記録 (上記「最優先タスク」参照)

詳細: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾セクション

---

## 観測量カバレッジ (Triple Helix M カード)

| 観測量 | データソース | 状態 |
|---|---|---|
| **N** (論文) | OpenAlex → papers_log (lane × quarter, weekly) | ✅ 取れてる |
| **P** (政策) | atlas_signals.source_type='policy' OR domain LIKE 'B.%' | ✅ 取れてる |
| **R** (言及) | atlas_signals.source_type='news' (lane domain ヒットのみ) | ✅ 取れてる |
| **C_compete** | project_ventures (lane × quarter alive count) | ✅ 取れてる |
| **B** (予算) | atlas_signals.source_type='grant' / NEDO/AMED scrape | ❌ Phase 2-D |
| **V** (VC) | Crunchbase / INITIAL | ❌ Phase 2-E |
| **I_R** (研究費) | KAKEN API | ❌ Phase 2-C |

---

## リポ状態 (2026-05-10 深夜)

- main HEAD: `3ac5cad` (Merge claude/affectionate-easley-9b52b8)
- 適用済 migrations: …035 (scholar、廃止前) / **036 / 037 / 038 / 039 / 040** ← 本セッション 5 個追加
- GAS Web App deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` → `v1447`
- PWA Vercel deploy: ✅ 4 連発全完了 (`amd-os-pwa.vercel.app`)
- 未 push commit: なし

---

## 残タスク

### 高優先 (次セッションのメイン)
1. **🚨 SX MTGサマリ抽出バグ修正** (上記「最優先タスク」参照)

### 中優先 (Phase 2 観測量網羅)
2. **Phase 2-C: KAKEN API ingest** (I_R 研究費、認証なし、和文 researcher 紐付き)
3. **Phase 2-D: NEDO/SIP/JST 採択 scrape** (B 公募予算、scraping)
4. **Phase 2-E: Crunchbase / INITIAL ingest** (V VC 投資、API key 必要)
5. **創業メンバー全 PJ 検算**: 66 名抽出のまさ感覚との整合確認 (特に役割・所属判定)
6. **AMD Score 詳細ページ HRL 行に LLM 推定値併記**: 現状は CockpitFoundingMembersModal 末尾のみ表示
7. **Phase 3: BVAR Kalman filter** で μ_A(t)/μ_I(t)/μ_G(t) を観測量から逆推定 ([`state_space_model.md §4.5`](../../before-zero/theory/state_space_model.md))

### 中優先 (前セッションから継続)
8. **データ汚染検出**: 全 monthly_reports 汚染検出関数 (R313 / MMO scheduled task / 手動投入の汚染源調査)
9. **iOS Swift 通知タップ → 該当画面 navigation** (l2_kind 別)
10. **AMDプロトコル UI candidate → confirmed 昇格ボタン**
11. **Phase 4.x = 5 生データ直結**: ⑤ メンバーナレッジ Slack DM / ④ PJナレッジ Notion 経営戦略 page
12. **xcodegen で iOS Models/Service 別ファイル化**
13. **MTGサマリ Phase 2.5: R313 を会議サマリ集約方式に**
14. **本体GAS `cron_invoiceSendNudge_` 重複生成元 特定**
15. **l2_feedbacks の archive UI**

### 低優先
16. CX/CTB/SE/p11 で次期 MS 期間 (2026 Q2 〜) 設定
17. 5月分 monthly_reports 自動生成 検討
18. `saveProjectMembers` を incremental update に

---

## 次セッションの最初の一手

1. リポ状態 4 ステップ (`cd /Users/masa/projects/AMD/amd-os && git fetch --all --prune && git log --branches --not --remotes --oneline && git branch -a && git status -s`)
2. このファイル (HANDOFF) の「🚨 次セッション最優先タスク」を読む
3. [`BUGS.md`](BUGS.md) 冒頭の SX MTGサマリ エントリを読む
4. [`design/db_schema.md`](design/db_schema.md) で `project_meeting_summaries` の列名を grep
5. SX (p21) の現状確認: `nav_meeting_processOneEvent_` を `force:true` で叩いて sourceKinds / gmailThreads を取る
6. gas/074 の `_meeting_resolveProjectName_` + プロンプト v4_alias_feedback を読んで alias 拡張案を出す → まさ承認 → 実装 → deploy → 再抽出 → 検証

---

## 運用コマンド (常用)

- **PWA Vercel deploy**: `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`
- **DDL 適用**: `cd /Users/masa/projects/AMD/amd-os/pwa && python3 -X utf8 scripts/apply_ddl.py /path/to/worktree/pwa/scripts/migrations/NNN_name.sql`
- **DB schema 再生成**: `cd /Users/masa/projects/AMD/amd-os/pwa && python3 -X utf8 /path/to/worktree/pwa/scripts/dump_schema.py`
- **GAS Web App 経由で関数実行**:
  ```sh
  URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_WEBAPP_URL=//' | tr -d '"')
  KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_API_KEY=//' | tr -d '"')
  ARGS=$(node -e 'console.log(encodeURIComponent(JSON.stringify(["meeting_id","p21",{"force":true}])))')
  curl -sL --max-time 360 "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_meeting_processOneEvent_&args=$ARGS"
  ```
- **GAS push + deploy update**:
  ```sh
  cd /Users/masa/projects/AMD/amd-os/.claude/worktrees/<worktree>/gas
  npx --yes @google/clasp@latest push --force
  npx --yes @google/clasp@latest deploy --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G --description "v<n>_<desc>"
  ```
- **手動 cron キック** (PWA、Bearer 認証):
  ```sh
  SECRET=$(grep '^CRON_SECRET=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^CRON_SECRET=//' | tr -d '"')
  curl -sL --max-time 290 -H "Authorization: Bearer $SECRET" https://amd-os-pwa.vercel.app/api/cron/founding-members-extract
  curl -sL --max-time 290 -H "Authorization: Bearer $SECRET" https://amd-os-pwa.vercel.app/api/cron/papers-quarterly-ingest
  ```
