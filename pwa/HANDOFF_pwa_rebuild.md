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
- えいみ人格・共通ルール正本 → [`/Users/masa/projects/AGENTS.common.md`](/Users/masa/projects/AGENTS.common.md)

---

## ⚠️ 必読: 既存の AI 議事録抽出ロジック (= 早合点防止)

**「Notion 議事録が空」と早合点しない。** 2026-05-09 セッション ([`design_log/sessions_2026-05.md` L1495-1517](design_log/sessions_2026-05.md)) で BWE 議事録対応のために以下が **既に実装済**:

- [`gas/074_MeetingSummaryRepo.js`](../gas/074_MeetingSummaryRepo.js) L763 `_meeting_fetchAiNotesBody_`: Notion AI 自動生成議事録ページの `transcription` block → `summary_block_id` + `notes_block_id` の子 block を再帰取得 (paragraph / heading_1〜4 / bulleted_list_item / to_do / quote / callout を markdown 風に結合)
- L680 `_meeting_findNotionPageByEventId_`: 3 段階 fallback (eventId equals → タイトル contains → 同日付)、`last_edited_time 降順 sort` で先頭採用
- BWE 5/9 force 再抽出で **decided 4 件抽出成功** が確認済 (取締役辞任 / 株式譲渡 第1号 + 第2号議案 / 採決結果)
- `MEETING_EXTRACT_PROMPT_REV = "v4_alias_feedback"` (現状)

**つまり「Notion AI ページから transcription を読む仕組み」は動く**。SX で動いてないのは別レイヤの問題なので、まずそこを切り分ける。

---

## 🚨 次セッション最優先タスク — SX (p21) MTGサマリ抽出バグ修正

PWA `/project/p21/cockpit` で SX の繰り返し MTG (`int) SX 社内打ち合わせ`) のサマリが「議事録なし」 / 「対象 PJ に関連する議事録が確認できず」になる。3/24 の `SX)int-納品物相談` 単発のみ正常。

### 早合点しないこと

`project_meeting_summaries` を直接見ると 2026-04 の SX は 4/29 / 4/8 しか登録されていないが、**まさは 4/14 / 4/16 / 4/17 / 4/28 にも議事録があると言っている**。つまり:
- ❌ 「Notion 議事録が空」(= 2026-05-10 の前回調査結論) は誤りの可能性
- ⭕ 実際は **AI 議事録ページが eventId 紐付けなしで生成され、cron が拾えてない** が最有力

### 確認順 (優先順)

1. **【最有力】AI 議事録ページが eventId 紐付けなしで生成されてる**
   - Notion 議事録 DB を `name contains 'SX'` で 2026-04 全件 search
   - `eventId` プロパティ空 + `transcription` block ありの厚いページがあるか
   - 見つかったら → eventId を後付けする one-time script `nav_meeting_backfillEventIdToAiPages_` を gas/074 に追加 → 実行 → `nav_meeting_processOneEvent_(force:true)` で再抽出
2. **AI 議事録ページがそもそも生成されてない** → Notion AI 録音 OFF / 機能未連携 (まさ運用確認 = えいみ実行不可)
3. **Gmail alias 不足** → CFG_PJAlias シート (= alias 正本、外部スプシ) に SX/p21 alias 追加 (まさシート編集 or えいみが可能ならスプシ API 経由)。**コード内 alias 管理禁止**
4. **Slack ingest** (Phase 4.x、中長期)

### 推奨アプローチ (= debug-first)

`gas/157_MeetingDebugInspector.js` 既存に下記 2 関数追加 → push & deploy → 実行 → 事実を見てから修正方針確定:

- `debug_meeting_inspectYm(projectId, ym)`: 202604 全 Notion ページ → 各ページの `[pageId, title, eventId, lastEdited, pjRelationIds, resolvedProjectId, hasTranscriptionBlock, bodyChars]` を返す
- `debug_pjAliases_dump()`: `_loadPJAliasesForMinutes_()` で CFG_PJAlias シートを丸ごと dump、特に SX/p21 行があるか確認

これで仮説 (a)〜(d) のどれが真因か **事実ベース** で切れる。修正を急がず、まず観察。

### コード内 alias 管理は禁止 (まさルール、2026-05-11 強調)

`projects.project_name` / `project_ventures.display_name` / `origin_org` / `origin_pi` などの DB 列を resolve して prompt に渡す案を出したら却下された。**alias は外部スプシ `CFG_PJAlias` が唯一正本**。`gas/CalendarToNotionMinutes.js` `_loadPJAliasesForMinutes_` で読まれる構造 (alias / pjCode / priority / matchType 列) があるので、LLM 抽出側もこれを再利用する。

---

## 直近セッション 2026-05-10 (affectionate-easley-9b52b8) の主要成果

- **創業メンバー LLM 推定** (大新機能 / 雛形): migration 040 + cron + UI + HRL 簡易推定
  → 5 PJ で 66 名抽出 (SX 13 名で愛媛大 PI / VC パートナー / 堀渕さんまで全部)
- **Triple Helix 観測モデル M カード**: migration 036-040、観測量カバレッジ 4/7、紫枠 FormulaPanel 4 段、6×3 マトリクス
- **UI 改善**: プログレスバー 1k-50k log scale、XRL 整数表示、経時グラフ popup、Cockpit モーダル LaTeX 化
- **SX MTG バグ調査** (= 本最優先タスクの起点) → 当時は「Notion 議事録テンプレ放置 + AI 議事録なし」と結論したが、**本セッション 2026-05-11 で再検証** が必要

詳細: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾セクション

---

## 観測量カバレッジ (Triple Helix M カード)

| 観測量 | データソース | 状態 |
|---|---|---|
| **N** (論文) | OpenAlex → papers_log (lane × quarter, weekly) | ✅ |
| **P** (政策) | atlas_signals.source_type='policy' OR domain LIKE 'B.%' | ✅ |
| **R** (言及) | atlas_signals.source_type='news' (lane domain ヒットのみ) | ✅ |
| **C_compete** | project_ventures (lane × quarter alive count) | ✅ |
| **B** (予算) | atlas_signals.source_type='grant' / NEDO/AMED scrape | ❌ Phase 2-D |
| **V** (VC) | Crunchbase / INITIAL | ❌ Phase 2-E |
| **I_R** (研究費) | KAKEN API | ❌ Phase 2-C |

---

## リポ状態 (2026-05-11 朝)

- main HEAD: 本ハンドオフ commit 後に `git log -1 --oneline` で確認 (hash は commit 時に動的)
- 適用済 migrations: …035 (廃止前) / **036 / 037 / 038 / 039 / 040** (5/10 セッション追加)
- GAS Web App deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` → `v1447`
- PWA Vercel deploy: ✅ `amd-os-pwa.vercel.app`
- 未 push commit: なし (5/10 終了時点)

---

## 残タスク

### 高優先 (次セッションのメイン)
1. **🚨 SX MTGサマリ抽出バグ修正** (上記「最優先タスク」参照、AI ページ eventId backfill が最有力)

### 中優先 (Phase 2 観測量網羅)
2. **Phase 2-C: KAKEN API ingest** (I_R 研究費、認証なし、和文 researcher 紐付き)
3. **Phase 2-D: NEDO/SIP/JST 採択 scrape** (B 公募予算)
4. **Phase 2-E: Crunchbase / INITIAL ingest** (V VC 投資、API key 必要)
5. **創業メンバー全 PJ 検算**: 66 名抽出のまさ感覚との整合確認
6. **AMD Score 詳細ページ HRL 行に LLM 推定値併記**: 現状は CockpitFoundingMembersModal 末尾のみ
7. **Phase 3: BVAR Kalman filter** で μ_A(t)/μ_I(t)/μ_G(t) 推定

### 中優先 (前セッションから継続)
8. **データ汚染検出**: 全 monthly_reports 汚染検出関数 (R313 / MMO / 手動投入の汚染源調査)
9. **iOS Swift 通知タップ → 該当画面 navigation** (l2_kind 別)
10. **AMDプロトコル UI candidate → confirmed 昇格ボタン**
11. **Phase 4.x = ⑤ メンバーナレッジ Slack DM / ④ PJナレッジ Notion 経営戦略 page 直結**
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
2. このファイル冒頭 ⚠️ セクション (= 既存 AI 議事録抽出ロジック) を読む
3. [`BUGS.md`](BUGS.md) 冒頭 SX エントリの「本セッションで確認したこと」「未確認」を読む
4. `gas/157_MeetingDebugInspector.js` に `debug_meeting_inspectYm(projectId, ym)` + `debug_pjAliases_dump()` を追加
5. clasp push + deploy → 関数を pwaApi 経由 curl で実行 → 結果から仮説 (a)〜(d) のどれが真因か特定
6. 真因に応じて修正 (eventId backfill / PJAlias シート追記 / PJ resolve バグ fix のいずれか)
7. SX 全 meeting で `nav_meeting_processOneEvent_(force:true)` 再抽出 → cockpit で目視

---

## 運用コマンド (常用)

- **PWA Vercel deploy**: `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`
- **DDL 適用**: `cd /Users/masa/projects/AMD/amd-os/pwa && python3 -X utf8 scripts/apply_ddl.py /path/to/worktree/pwa/scripts/migrations/NNN_name.sql`
- **DB schema 再生成**: `cd /Users/masa/projects/AMD/amd-os/pwa && python3 -X utf8 /path/to/worktree/pwa/scripts/dump_schema.py`
- **GAS Web App 経由で関数実行**:
  ```sh
  URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_WEBAPP_URL=//' | tr -d '"')
  KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_API_KEY=//' | tr -d '"')
  ARGS=$(node -e 'console.log(encodeURIComponent(JSON.stringify(["p21","202604"])))')
  curl -sL --max-time 360 "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=debug_meeting_inspectYm&args=$ARGS"
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
  ```
