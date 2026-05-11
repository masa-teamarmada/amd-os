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

## 🎉 直近セッション 2026-05-11 (pensive-engelbart-7672ca、3 回目) — Atlas zoom 修正 + cron hybrid + GAS trigger

直前 Phase 2 commit で Atlas Map の縮尺が間違ってた問題を修正 + 残タスクを並列で進めた。

### Atlas Map 縮尺修正

- zoomToFit padding 80→**200**、engineStop 後に **1.6× ズームイン** (setTimeout 450ms)
- cooldownTicks 320→180、velocityDecay 0.22→0.28 (5秒後縮小の見え方解消)
- 結果: 表示時から「ノードが個別に読める」2 枚目相当の縮尺で固定、追加縮小なし

### Phase 2-C/D: web_search hybrid mode

- [`kaken-ingest`](src/app/api/cron/kaken-ingest/route.ts) / [`grant-ingest`](src/app/api/cron/grant-ingest/route.ts) cron に Anthropic web_search_20250305 tool 追加 (Sonnet 4.5、max_uses=3)
- Sonnet が KAKEN / NEDO / JST / AMED の公開統計を直接 web_search → 桁感を実数値に anchoring

### GAS 154 に ASPI weekly trigger 関数

- [`gas/154_PwaCronCaller.js`](../gas/154_PwaCronCaller.js) に `_nav_pwa_pingPath_` 共通 helper + 4 ping 関数 + 2 まとめ関数 + `nav_pwa_setupWeeklyAspiTriggers_`
- 毎週月曜 04:00 JST (lane + kaken) / 05:00 JST (grant + vc) で自動キック

### ⚠️ clasp deploy 未完了 (次セッション最優先)

GAS 154 のコードは push 済 (worktree)、ただし `clasp push` で **`invalid_rapt`** (Google OAuth 再認証要求) でエラー。本番 GAS には未反映。

**まさの作業 (次セッションで)**:

```sh
cd /Users/masa/projects/AMD/amd-os/.claude/worktrees/pensive-engelbart-7672ca/gas
npx --yes @google/clasp@latest login        # 再認証 (ブラウザで Google ログイン)
npx --yes @google/clasp@latest push --force
npx --yes @google/clasp@latest deploy \
  --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G \
  --description "v1455_aspi_weekly_triggers"

# trigger setup (one-time、runFunc 経由)
URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | cut -d= -f2- | tr -d '"')
KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | cut -d= -f2- | tr -d '"')
curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_pwa_setupWeeklyAspiTriggers_"
```

これで毎週月曜 04:00 JST + 05:00 JST に 4 cron が自動キックされる状態になる。

### 残タスク (本セッションでは scope 外、別セッションで)

- **atlas_signals.domain 新カテゴリ追加** (P. 量子、Q. センシング、R. 通信 etc) ─ atlas-collect-policy / collect の LLM プロンプト改修 + UI domain 色追加 + triple-helix-observations の LANE_DOMAIN_PREFIXES 拡張 (R 観測量を量子・センシング系も拾えるように)
- **BVAR Kalman filter** で μ_A/I/G 隠れ状態推定 (state_space_model.md §10、Python ベース or TS 実装)
- **Crunchbase 統合** (有償 API、契約後)
- **KAKEN/NEDO 公式 API/scrape 直接実装** (web_search 経由でなく構造化 fetch、Phase 2-C2/D2)

### deploy

main HEAD: `409c32d`、Vercel `amd-os-pdg6emk4d-armada0130` (production, 5m23s, Ready)。

---

## 旧 (2026-05-11 同日 2 回目) ASPI 8 domains 完全実装 + Atlas Map 分散化

AMD Score マクロトレンド (Triple Helix M カードの 7 観測量) の未抽出 3 つ (B / V / I_R) を取りに行く Phase 2 を **1 セッション内で全部完遂**。Atlas Map の中央密集も同時解消。

### Atlas Map 分散化 ([atlas/map/page.tsx](src/app/(app)/atlas/map/page.tsx))

- charge -450→-1800、link distance 140→280、cooldown 120→320、velocityDecay 0.3→0.22
- 自前 collision force 追加 (32px minDist)、孤立ノード引力 0.04→0.012
- MIN_OVERLAP 2→3 + TOP_K 3→2 で link 数を半減
- 結果: 中央密集解消、全体が散らばって読めるレイアウトに

### Phase 2-A: cron / lib を ASPI 8 domain 対応

| ファイル | 変更 |
|---|---|
| migration 042 | papers_log + macro_index_log を旧 5 lane → ASPI 8 domain に rewrite、macro_lane_weights を 8 domain で再 seed、observation_log + lane_suggestions 新規、triple_helix_loading.available B/V/I_R 全 TRUE |
| aspi-lanes.ts | helper (LEGACY_LANE_TO_ASPI / dominantDomain / weightForDomain) + キーワード集 (OPENALEX / KAKEN / GRANT) |
| papers-quarterly-ingest | ASPI 8 domain × OpenAlex キーワードで fetch |
| triple-helix-observations.ts | lane=AspiDomainId / lanes JSONB weighted C_compete / observation_log (B/V/I_R) 読込み |
| relearn-lane-weights / macro-backfill-historical | LANES と Sonnet プロンプトを 8 domain × 日本政策コンテキストに更新 |

### Phase 2-B/C/D/E: 新規 cron 4 つ + admin UI

- **lane-suggest cron**: PJ.lanes IS NULL の PJ を Sonnet で推定 → lane_suggestions テーブル + 通知
- **kaken-ingest cron**: KAKEN (科研費) 配分額を Sonnet 推定 (公開 API 限定的なので LLM 駆動) → observation_log (key=I_R)
- **grant-ingest cron**: NEDO/JST/AMED 採択額を Sonnet 推定 → observation_log (key=B)
- **vc-investment-ingest cron**: vc_news を context に Sonnet で VC 投資総額推定 → observation_log (key=V)
- **admin/projects 承認 UI**: Lane セル内に「💡 LLM 提案 + 採用/却下 ボタン」表示、採用で project_ventures.lanes に書き戻し

### 観測量カバレッジ — 7/7 完備

| 観測量 | データソース | 状態 |
|---|---|---|
| N (論文) | OpenAlex → papers_log | ✅ |
| P (政策) | atlas_signals | ✅ |
| R (言及) | atlas_signals (lane atlas prefix hit) | ✅ |
| C_compete (競合) | project_ventures.lanes weighted | ✅ |
| **B (予算)** | observation_log (key=B, source=grant) ← Phase 2-D | ✅ **新規** |
| **V (VC)** | observation_log (key=V, source=vc_news) ← Phase 2-E | ✅ **新規** |
| **I_R (研究費)** | observation_log (key=I_R, source=kaken) ← Phase 2-C | ✅ **新規** |

### cron 起動 (次セッション or 手動キック)

新 4 cron は Vercel Hobby 制約のため当面手動キック (curl):

```sh
URL="https://amd-os-pwa.vercel.app"
SECRET=$(grep '^CRON_SECRET=' pwa/.env.local | sed 's/^CRON_SECRET=//' | tr -d '"')
curl -sL "$URL/api/cron/kaken-ingest" -H "Authorization: Bearer $SECRET" | jq
curl -sL "$URL/api/cron/grant-ingest" -H "Authorization: Bearer $SECRET" | jq
curl -sL "$URL/api/cron/vc-investment-ingest" -H "Authorization: Bearer $SECRET" | jq
curl -sL "$URL/api/cron/lane-suggest" -H "Authorization: Bearer $SECRET" | jq
```

または本体 GAS の 154_PwaCronCaller.js に新 trigger 追加 (別セッション)。

### 残タスク (Phase 3)

- cron 4 つを GAS trigger に登録 (or Vercel Pro 移行 + vercel.json 更新)
- KAKEN 公式 API (`kaken.nii.ac.jp/grant/api/v1/...`) 直接 fetch への移行 (Phase 2-C2)
- NEDO / JST / AMED 採択リスト HTML scrape (Phase 2-D2)
- Crunchbase API 統合 (有償、Phase 2-E2)
- BVAR Kalman filter で μ_A/I/G 隠れ状態推定 (Phase 3、state_space_model.md §10 参照)
- atlas_signals.domain に量子・センシング系の新 domain 追加 (advanced_ict / quantum / sensing_timing_navigation の atlas 集計復活)

---

## 旧 (2026-05-11 同日 1 回目) ASPI 8 domains lane 移行 Phase 1

AMD Score マクロトレンド (Triple Helix M カードの 7 観測量) の未抽出 3 つ (B / V / I_R) を取りに行く前段として、**lane 分類体系を AMD 都合の旧 5 lane から論文・国際統計世界の標準 (ASPI Critical Technology Tracker 8 domains) に揃えた**。

### 実装 (Phase 1)

1. **[`pwa/design/aspi_lanes.md`](design/aspi_lanes.md)** ─ ASPI 8 domain × 64+10 tech 正本 + 10 PJ 確定 mapping + 旧→新 lane mapping
2. **migration 041** ─ `project_ventures.lanes JSONB` 追加 + 10 PJ seed + check constraint (domain enum + weight 合計 = 1.0)
3. **`pwa/src/lib/aspi-lanes.ts`** ─ 型 + 定数 (client/server 両用)
4. **`pwa/src/components/lanes/LaneBadges.tsx`** ─ 共通 `<LaneBadges>` + `<LaneEditor>` (cell popover で domain checkbox + weight 編集 + 合計 1.0 バリデーション)
5. **PJ 台帳 `/admin/projects`** に「Lane (ASPI)」列追加 + cell click で LaneEditor 編集 (まさ要望)
6. **AMD Score 一覧 `/venture-map/amd-score`** の lane 表示を ASPI badge に置換

### 10 PJ 確定 mapping (まさ承認)

| 旧 lane | 新 lanes (ASPI) | PJ |
|---|---|---|
| materials | `advanced_materials_manufacturing 1.0` | p03 ティエム |
| robo | `defence_space_robotics_transport 1.0` | p04 輝翠TECH |
| life | `biotechnology 1.0` | p06 CrestecBio |
| gx_circular | `advanced_materials 0.5 + energy_environment 0.5` | p07 LiSTie |
| gx_circular | `energy_environment 1.0` | p09 JOYCLE / p21 SolvioraX |
| gx_energy | `energy_environment 1.0` | p11 BWE / p18 YD / p24 チャレナジー |
| gx_energy | `advanced_materials 0.5 + energy_environment 0.5` | p20 CryoX |

旧 5 lane → 新 ASPI: gx_energy + gx_circular → energy_environment, materials → advanced_materials_manufacturing, life → biotechnology, robo → defence_space_robotics_transport。**gx_circular は ASPI に独立 domain なし、energy_environment に統合**。

### 設計判断

- **weight 付き多重所属**: PJ が複数 domain にまたがるとき weight で按分 (合計 1.0、配列長 1〜3)
- **観測量集計**: domain D の N(t) = Σ_p (papers_p × weight_{p,D}) で weighted 寄与
- **旧 lane TEXT は cron 移行終わるまで残置** (cron 系 11 ファイル別セッションで段階移行)
- **新規 PJ の lane は LLM 推定 → まさ承認**: 人が選択する UI は使わない原則

### 残タスク (Phase 2)

- **🚨 Phase 2-A**: 既存 5 lane 触ってる cron / lib (papers-quarterly-ingest / triple-helix-observations / relearn-lane-weights / macro-backfill-historical / venture-map-data.ts / VentureMapView / SuDetailView / Timeline3DView 等 11 ファイル) を ASPI 8 domain weighted に書き換え
- **Phase 2-B**: 新規 PJ 起こす UI に LLM (Sonnet) lane 推定 + まさ承認フロー (admin/projects に「+ 新規 PJ」ボタン)
- **Phase 2-C**: KAKEN API ingest (I_R 研究費)
- **Phase 2-D**: NEDO/JST 採択 scrape (B 公募予算)
- **Phase 2-E**: Crunchbase or 代替 (V VC 投資)

### deploy

main HEAD: `2ec2bf1`、Vercel deploy `amd-os-ih3ox5156-armada0130` (production, 5m50s, Ready)。
本番 URL: <https://amd-os-pwa.vercel.app/admin/projects> で「Lane (ASPI)」列確認可能。

---

## 直近セッション 2026-05-11 (nervous-elbakyan-c1323e) の主要成果 — SX MTG バグ完全解決

**真因**: Notion AI が会議終了時に自動生成する議事録ページは「日付」「eventId」「PJ relation」**3 プロパティとも空のまま**生成される設計バグ。

**実装した 4 段の修正 (= 最終的に SX MTG サマリ復活率 67% へ改善)**:

1. **Phase A: 過去分救済 (one-time backfill)** — [`gas/160_MeetingAiBackfill.js`](../gas/160_MeetingAiBackfill.js) `nav_meeting_backfillAiPages_`:
   - title から ISO 日時 regex parse + CFG_PJAlias 経由 PJ 判定 + calendar event lookup → 空プロパティのみ patch
   - SX 35 件 patch 成功 (errors=0、ambig=0)

2. **Phase B: 恒久対応 (cron 内 self-healing)** — [`gas/074_MeetingSummaryRepo.js`](../gas/074_MeetingSummaryRepo.js) `nav_meeting_processOneEvent_` 改修:
   - opts.eventTitle / eventStartAt 追加 + page hit 後の空プロパティ patch
   - [`gas/153_MeetingHourlyTrigger.js`](../gas/153_MeetingHourlyTrigger.js) から calendar event 情報を渡すよう修正

3. **Phase C: LLM 切替 (まさ承認)** — `DB_LlmModelConfig.meeting_extract` を `gemini-2.5-flash` → `claude-sonnet-4-5-20250929` に upsert。Gemini が AI 議事録ページで `error_llm` 連発した問題を解決

4. **Phase D: `_meeting_findNotionPageByEventId_` の段階的 fallback 化** — Sonnet テストで判明した「3 段 merge sort で異月ページ誤選択」事故を修正。各段で hit したら return、空なら次段へ降りる純粋な段階フォールバックに

### 検証結果

- SX 全 35 件 force 再抽出: **OK=22 / SKIP=13 / ERR=0** (Sonnet + 段階 fallback で全件成功)
- supabase project_meeting_summaries (SX, p21):
  - 修正前: have=11 / empty=17 / total=28 (誤った meeting_id 紐付けあり)
  - 修正後: **have=30 / empty=16 / total=46**
  - 4/14 / 4/16 / 4/28 / 3/31 / 3/24 / 3/19 / 1/20 / 1/16 / 12/24 / 11/14 等まさ認知の MTG 全部復活
  - 残 16 件 empty は (a) Notion + Gmail 両方なし (b) Gmail のみで LLM が真に PJ 無関係と判定 (両方とも内容的に正しい)

### 補助 debug 関数 5 個追加 (次回以降の調査用に常設)
- [`gas/158`](../gas/158_NotionDebugQuery.js): `debug_meeting_inspectYm` / `debug_meeting_inspectPage` / `debug_meeting_dumpAiBody` / `debug_llm_geminiRaw`
- [`gas/159`](../gas/159_PJAliasDebug.js): `debug_pjAliases_dump`

### 副次修正
- [`gas/074`](../gas/074_MeetingSummaryRepo.js) `_meeting_extractWithLLM_` の戻り値に `modelName` 追加 → upsert 時の `generated_by_model` をハードコード `gemini-2.5-flash` から `llm_getConfig` 由来 (例: `anthropic:claude-sonnet-4-5-20250929`) に動的化

### GAS deploy 推移
`@1448` → `@1449` → `@1450` (backfillAiPages) → `@1451` (dumpAiBody) → `@1452` (self-healing) → `@1453` (staged fallback) → **`@1454_dynamic_model_label`**

---

## 🚨 次セッション最優先タスク

### 1. self-healing の本番運用検証

毎時 cron `nav_meeting_pollRecentlyEndedEvents` が実機で `opts.eventTitle/eventStartAt` 渡しで動くか観察:
- AI ページの空プロパティが自動 patch されるか
- 次の SX MTG (例: 5/12 定例) で AI ページが自動補修されてサマリ生成されるか

GAS Apps Script Editor の Executions で `nav_meeting_pollRecentlyEndedEvents` の Logger.log に `[processOneEvent] self-heal patched: pageId=... eventId=...` が出てれば成功。

### 2. 4/17 SX-インタビュー (title ISO 無し) パターン

AI ページ id `34597749c6088011b49bd771cc21e606` は title=`SX-インタビュー（原田様）` で ISO 日時無し。backfill 第 1 弾 regex から漏れた。

self-healing (Phase B) が cron で回り始めれば、calendar event 起点で title contains "SX-インタビュー" でヒット → 自動補修される可能性 (= cron 1 サイクル待ち)。それでも解決しなければ backfill 第 2 弾で `created_time` から日付推定 set する拡張を追加。

### 3. Gemini error_llm の真因究明 (低優先、Sonnet で運用復旧済)

Sonnet 切替で運用上は解決したが、Gemini が AI 議事録で何故 null 返したか (= safety filter / JSON 不正 / token 超え) は未究明。`debug_llm_geminiRaw` は追加済だが GAS Web App URL 長すぎ (HTTP 400) で使えてない。POST 対応 or `debug_meeting_attemptExtract(eventId, projectId)` を gas/158 に新設 (= eventId だけ内部で combinedText 構築 + Gemini 直叩き + 生 response 返す) で次の調査が可能。

### 4. cockpit に「議事録なし」表示の改善 (UX)

empty 16 件のうち `gmail のみで LLM が無関係判定` のものは title 上は SX MTG だが内容空。cockpit 上で「議事録 source は集まったが対象 PJ 関連内容なし」が分かる UI 化を検討 (例: アイコン分け or コメント付き)

---

## 直近セッション 2026-05-10 (affectionate-easley-9b52b8) の主要成果 (継続中)

- **創業メンバー LLM 推定** (大新機能 / 雛形): migration 040 + cron + UI + HRL 簡易推定 → 5 PJ で 66 名抽出 (SX 13 名)
- **Triple Helix 観測モデル M カード**: migration 036-040、観測量カバレッジ 4/7、紫枠 FormulaPanel 4 段、6×3 マトリクス
- **UI 改善**: プログレスバー 1k-50k log scale、XRL 整数表示、経時グラフ popup、Cockpit モーダル LaTeX 化

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

## リポ状態 (2026-05-11 夕)

- main HEAD: 本ハンドオフ commit 後に `git log -1 --oneline` で確認
- GAS Web App deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` → **`@1452_self_healing`**
- 適用済 migrations: …035 (廃止前) / 036 / 037 / 038 / 039 / 040
- PWA Vercel deploy: ✅ `amd-os-pwa.vercel.app`
- 未 push commit: なし

---

## 残タスク

### 高優先 (次セッション)
1. **🚨 error_llm 真因究明** (上記 1)
2. **🚨 self-healing 本番運用検証** (上記 3、cron 1 サイクル待ち)
3. **4/17 SX-インタビュー パターン対応** (上記 2、self-healing 待ちで自動解決の可能性)

### 中優先 (Phase 2 観測量網羅)
4. Phase 2-C: KAKEN API ingest (I_R 研究費)
5. Phase 2-D: NEDO/SIP/JST 採択 scrape (B 公募予算)
6. Phase 2-E: Crunchbase / INITIAL ingest (V VC 投資)
7. 創業メンバー全 PJ 検算 (66 名のまさ感覚との整合)
8. AMD Score 詳細ページ HRL 行に LLM 推定値併記
9. Phase 3: BVAR Kalman filter で μ_A(t)/μ_I(t)/μ_G(t) 推定

### 中優先 (前セッションから継続)
10. 全 monthly_reports 汚染検出関数 (R313 / MMO / 手動投入の汚染源調査)
11. iOS Swift 通知タップ → 該当画面 navigation
12. AMDプロトコル UI candidate → confirmed 昇格ボタン
13. Phase 4.x = ⑤ メンバーナレッジ Slack DM / ④ PJナレッジ Notion 経営戦略 page 直結
14. xcodegen で iOS Models/Service 別ファイル化
15. MTGサマリ Phase 2.5: R313 を会議サマリ集約方式に
16. 本体GAS `cron_invoiceSendNudge_` 重複生成元 特定
17. l2_feedbacks の archive UI

### 低優先
18. CX/CTB/SE/p11 で次期 MS 期間 (2026 Q2 〜) 設定
19. 5月分 monthly_reports 自動生成 検討
20. `saveProjectMembers` を incremental update に

---

## 次セッションの最初の一手

1. リポ状態 4 ステップ (`cd /Users/masa/projects/AMD/amd-os && git fetch --all --prune && git log --branches --not --remotes --oneline && git branch -a && git status -s`)
2. このファイル冒頭「直近セッション 2026-05-11 主要成果」を読む (= 解決済バグ詳細)
3. [`BUGS.md`](BUGS.md) 冒頭の SX エントリ (= 解決済構造) と「`error_llm` エントリ」(= 残課題) を読む
4. **error_llm 調査**: `gas/158` に `debug_meeting_attemptExtract(eventId, projectId)` を追加 (URL 長すぎ問題回避) → push & deploy → SX 4/14 等で実行 → `finishReason` / `safetyRatings` で safety block か parse 失敗か切り分け
5. **self-healing 検証**: 1 時間待って `nav_meeting_pollRecentlyEndedEvents` の出力 (Logger.log の `[processOneEvent] self-heal patched: ...`) を確認
6. **暫定回避**: もし error_llm の根本対応に時間かかるなら `DB_LlmModelConfig` の `meeting_extract` を Anthropic Sonnet 4.5 に切り替えてまさに承認取って即解決

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
- **Notion AI ページ backfill (one-time)**:
  ```sh
  ARGS=$(node -e 'console.log(encodeURIComponent(JSON.stringify([{"projectIdFilter":"p21","dryRun":true,"sinceDays":365}])))')
  curl -sL --max-time 290 "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_meeting_backfillAiPages_&args=$ARGS"
  ```
