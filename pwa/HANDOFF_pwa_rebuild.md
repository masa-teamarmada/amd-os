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

**SX (p21) MTGサマリ抽出バグの対応**。詳細は [`BUGS.md`](BUGS.md) 最新エントリ参照。

### ⚠️ 必読: 既存の AI 議事録抽出ロジック (前回セッション 2026-05-09 で実装済)

「Notion 議事録ページが空」と早合点しないこと。gas/074 には **AI 議事録ページ (別 ID で生成される) を拾う仕組みが既に実装済**:

- `_meeting_findNotionPageByEventId_` ([gas/074_MeetingSummaryRepo.js](../../gas/074_MeetingSummaryRepo.js#L680)) の **3 段階 fallback**:
  1. eventId プロパティ equals
  2. 同日付 + タイトル contains
  3. **last_edited_time 降順** で先頭採用 (= AI ページが通常最新)
- `_meeting_fetchAiNotesBody_` ([gas/074_MeetingSummaryRepo.js](../../gas/074_MeetingSummaryRepo.js#L763)): AI 議事録ページの `transcription` block → `summary_block_id` + `notes_block_id` の子 block を再帰取得
- Notion 議事録 DB ページの `sourceAiPageId` プロパティ (= cron テンプレページが AI ページを参照する想定だが、実際は使われてない)

### 本セッションでの調査の限界 (= 次セッションで補完すべき)

- 4/29 の **cron テンプレページ** `34f97749c608812abbadcd2a4d6a8e0c` (Notion API で読み取り済) → 本文ゼロ確認
- **AI 議事録ページ (別 ID) が存在するかは未確認**: Notion 議事録 DB を直接 search してない
- `nav_meeting_processOneEvent_(force:true)` の出力 `sourceKinds=notion+gmail` は両者を見たことを示すが、AI ページ未発見の可能性が高い

### 真の原因候補 (優先順、確認方法つき)

1. **【最有力】AI 議事録ページが eventId 紐付けなしで生成されてる**
   - 確認: Notion 議事録 DB を `name contains 'SX'` で全件 search → eventId プロパティ空 + 本文厚いページがあるか
   - 修正: 既存 BUGS の TODO「**AI page に eventId を後付けする one-time script**」を実装 (gas/074 に新関数 `nav_meeting_backfillEventIdToAiPages_` 等を追加)
2. **AI 議事録ページがそもそも生成されてない** (Notion AI 録音 OFF)
   - 確認: Notion 設定でまさが SX 系 MTG (繰り返し instance) の AI 議事録生成が有効か確認 (= 運用タスク)
3. **Gmail alias 不足**: Sonnet が「SX = solvioraX」を判定できない
   - 確認: `_meeting_resolveProjectName_` ([gas/074_MeetingSummaryRepo.js](../../gas/074_MeetingSummaryRepo.js)) を読んで alias 候補生成ロジックを拡張
4. **Slack ingest 未実装** (Phase 4.x 計画) — 中長期

### 作業手順 (推奨)

```sh
# 1. SX 4/29 の現状を Notion API で再確認 (cron テンプレページ + AI ページ両方)
URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_WEBAPP_URL=//' | tr -d '"')
KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_API_KEY=//' | tr -d '"')

# 2. Notion 議事録 DB から SX 関連ページを全件取得 (eventId 空 + 本文厚いページの有無確認)
#    GAS に新規 debug 関数 nav_meeting_listNotionAiPages_(projectId, ymRange) を追加して
#    `eventId` 未設定 + body length > N のページを返す
ARGS=$(node -e 'console.log(encodeURIComponent(JSON.stringify(["p21","2026-04",{}])))')
curl -sL --max-time 120 "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_meeting_listNotionAiPages_&args=$ARGS"

# 3. AI ページが見つかったら eventId を後付ける one-time script を実装/実行
#    gas/074 に nav_meeting_backfillEventIdToAiPages_ を追加
#    → 議事録 DB を巡回 → eventId 空 + 本文厚 + 同日付 calendar event あり → eventId をプロパティ書き込み
#    → そのあと nav_meeting_processOneEvent_(force:true) で再抽出すれば AI 本文が取れる

# 4. Gmail alias 拡張も並行で対応
#    _meeting_resolveProjectName_ に project_ventures.display_name + lane + origin_org 等の alias 候補追加
#    → MEETING_EXTRACT_PROMPT_REV を v5_alias_extended にバンプ

# 5. SX 全 MTG で summary_short が「議事録なし」以外になるか検証 + 他 PJ への波及確認
```

```sql
-- 他 PJ で同じ問題があるかの検出 (Supabase)
SELECT project_id, COUNT(*) FILTER (WHERE summary_short IN ('議事録なし', '') OR summary_short LIKE '対象PJに関連する議事録%') AS empty_n,
       COUNT(*) AS total_n
FROM project_meeting_summaries GROUP BY project_id ORDER BY empty_n DESC;
```

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
