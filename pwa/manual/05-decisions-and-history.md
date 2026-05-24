# 05. 過去判断と経緯

「**なぜそうなっているか**」が分かる場所。新セッションのえいみが「これ動いてないけど何で?」となった時、まずここを読む。

## 5.1 cron 廃止経緯 (= 2026-05-22 仕様変更の本丸)

### 何が起きたか
2026-05 上旬まで、PWA は Vercel cron で毎時/毎日に **LLM 課金が発生する定期抽出** (= L1 / L2 抽出系) を回していた。GAS 側でも同様。

結果:
- Anthropic / Gemini / OpenAI のトークン課金が膨大化
- 2026-05-13 (= sessions_2026-05.md L2863) — まさが「`vc-news-ingest` が直近 7 日分を daily で cron かけてて明らかに無駄」と指摘 → 月 $128 → $1-2 (-99%)
- 2026-05-17 (= L4481) — `atlas-collect` も停止、`vercel.disabled-crons.json` に退避
- **2026-05-22 (= L5582) PWA/GAS background cron 全廃止の本丸**:
  - `pwa/vercel.json` の `crons` を **空配列に変更** + 15 件 `disabled-crons.json` に退避
  - GAS 側 live trigger 7 個削除 + source 5 ファイルに kill switch 追加
    - `gas/056_RewardScoring_Trigger.js`
    - `gas/060_RewardV2_Estimator.js`
    - `gas/152_NavigatorCron.js`
    - `gas/153_MeetingHourlyTrigger.js`
    - `gas/155_L2KnowledgeExtractor.js`
  - 仕様変更: **「LLM 課金が発生する定期抽出 cron は停止。Codex automation を一次実行系にする」**

### なぜこの判断か
- LLM 課金は使用量比例 → 自動 cron で「念のため毎時走らせる」が一番無駄
- Codex automation は **手元マシンの cron で走る** → Anthropic 課金は走った時のみ + サブスク内
- 結果: Anthropic 課金が予測可能になり、サブスク + 必要時の手動キックでカバー

### vercel.disabled-crons.json のヘッダ
```json
{
  "reason": "Codex automation is the primary raw-data extraction path. LLM-backed Vercel/GAS background cron jobs are disabled to stop unintended Anthropic spend."
}
```

### 残ってる Vercel cron (= LLM 非依存の運用系のみ)
- `freee-payment-sync`
- `payment-confirm-nudges`
- `member-weekly-activities`
- `payout-reward-cache-refresh`
- `papers-quarterly-ingest`
- `sync-pj-facts`
- `macro-aggregate-indicators`

### ⚠️ 新セッションのえいみへ
- **「cron 復活すればいい」と提案するのは禁忌**。token 課金問題で慌てて止めた経緯あり
- データ取り込み不足を見つけたら、まず **Codex automation か Claude routine で実装** することを検討
- どうしても Vercel cron が必要なら、LLM 非依存 (= 純粋な DB 同期や fetch のみ) であることを確認

---

## 5.2 4 分類 → 経営ハイライト 改訂経緯 (= 2026-05-24)

### 何が起きたか
2026-05-24 PM に「経営・事業シグナル」を 9 種 → 3 分類 → 4 分類 と再設計したが、改訂中に **本質的なズレ**が判明:
- 「経営判断未了」のような **未了系の議題** が経営ハイライトに混入していた
- まさ「ダイキアクシスとの距離感を経営判断未了」が「経営全般」に入ってる違和感 → 真意は「**未了なのに進捗を書く場に書いてること**が違和感」

### 確定方針 (= 2026-05-24 夜)
- セクション名: **「経営ハイライト」** (旧「経営・事業シグナル」廃止、まさ #27)
- 中身ルール: **「進んだこと・起きたこと」だけ**書く (= done のみ、未了 / TODO / アイディアは別場所、まさ #26)
- 表示: polarity アイコン軸 (🎉/✨/🔄/⚠️、4 種類、🌐 中立は廃止) + 4 分類カラー + impact chip + 「⚠️ 未確認」(candidate のみ) (= まさ #29)
- AMD Score 影響併記: 各シグナルに「📊 影響: TRL 4→5、X 軸 +40pt」(= まさ #31、案 A 確定、score_impact_summary 列追加)
- 未了の議題は **TODO かんばん** (= TODO/Doing/Done、別 UI、別 task で実装、まさ #26 派生)

### なぜこの設計か
- まさの最終目的: **株主説明会・事業報告書を「並んだハイライトをまとめるだけで自動生成」**できる状態
- そのために「起きた事象だけ」を時系列で蓄積する
- 「未了議題」は別軸 (= TODO かんばん) で管理 → Done に移動した瞬間に経営ハイライトに自動転記

---

## 5.3 まさえいMTG 運用ルール (= 2026-05-24)

まさえいMTGは、まさとえいみが OS 上の candidate を読み、チームへ提案する前の論点・提案・残課題を整理する対話セッション。

### 確定方針
- 呼称は **「まさえいMTG」** に統一する
- 会社の正式会議体として扱わず、対話セッション / 提案整理として記録する
- cockpit の `project_meeting_summaries.source_kinds='dialogue'` に保存し、通常の PJ MTG サマリと同じ一覧で読めるようにする

### LLM への含意
- `decided[]` 配列は「**提案**」「整理した論点」のニュアンスで書く
- 「正式決定」「決まったこと」と断定しない

---

## 5.4 Codex / Claude / Vercel / LaunchAgent 責務分担マトリクス

「**どの自動処理がどこで動いてるか**」が分かる正本表。新セッションのえいみは必ず確認。

| 自動処理 | 動く場所 | 頻度 | 役割 | LLM 課金 | 関連 file |
|---|---|---|---|---|---|
| **amd-os-ms** | Codex automation | 6h ごと | L2 ③ MS 進捗 / L2 ⑦ OS 台帳差分 / L2 ⑧ XRL 根拠の抽出 + outbox 出力。L2 ②④⑤⑥ は生成しない | あり | `~/.codex/automations/amd-os-ms/automation.toml` |
| **amd-os** | Codex automation | daily 03:20 JST | L2 ⑨ 経営ハイライト抽出 + outbox 出力 | あり | `~/.codex/automations/amd-os/automation.toml` |
| **amd-atlas-2** | Codex automation | daily 08:10 JST | Atlas 外部マクロ抽出 + outbox 出力 | あり | `~/.codex/automations/amd-atlas-2/automation.toml` |
| **amd-macrotrend-evidence-review** | Codex automation | weekly Mon 07:30 | UN SDGs / WEF Global Risks 整理 | あり | `~/.codex/automations/amd-macrotrend-evidence-review/` |
| **outbox applier** | LaunchAgent | 5 分ごと | Codex outbox → Supabase POST | なし (= 純粋 DB 反映) | `~/Library/LaunchAgents/jp.teamarmada.amd-os-ms-outbox-applier.plist` |
| **amd-os-management-dialogue-prep** | Claude routine | daily 07:00 JST | まさえいMTG 議題プリペア | あり | `~/.claude/scheduled-tasks/amd-os-management-dialogue-prep/SKILL.md` |
| ~~**GAS 153 MeetingHourlyTrigger**~~ | ⛔ **2026-05-22 停止** | — | (旧) MTG サマリ取り込み (Calendar + Notion 議事録 → `project_meeting_summaries` 直書き) → **kill switch (`MEETING_HOURLY_CRON_DISABLED_20260522`) + live trigger 削除済**、コメントに「Use Codex automation/review batches」と書いたが**実態として Codex 側に受け皿無し**、5/22-5/25 議事録 ghost 化の原因 | あり (Gemini) — 停止中 | `gas/153_MeetingHourlyTrigger.js` |
| ~~**GAS 155 L2KnowledgeExtractor**~~ | ⛔ **2026-05-22 停止** | — | (旧) L2 ② AMD プロトコル / ④ PJ ナレッジ / ⑤ メンバーナレッジ を毎時 polling で抽出 → **kill switch (`L2_KNOWLEDGE_CRON_DISABLED_20260522`) で全 4 関数 (= member_knowledge / project_knowledge / protocol / 設定) が即 disabled return**、5/22-5/25 ②④⑤ ghost 化の原因 | あり (Gemini) — 停止中 | `gas/155_L2KnowledgeExtractor.js` |
| ~~**GAS 152 NavigatorCron 月次 extract**~~ | ⛔ **2026-05-22 停止** | — | (旧) 月単位 fallback 抽出 → kill switch (`NAV_MONTHLY_EXTRACT_CRON_DISABLED_20260522`) | あり | `gas/152_NavigatorCron.js` |
| 🚧 **`amd-os-meeting-extract`** (新設予定) | Claude routine | 毎時 0 分予定 | L2 ⑥ MTG サマリ 復旧 (= GAS 153 後継、終了 +60-180 分の窓で拾う) | あり (Sonnet 4.6 サブスク内) | `~/.claude/scheduled-tasks/amd-os-meeting-extract/SKILL.md` (= 設計中、[`l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)) |
| 🚧 **`amd-os-protocol-extract`** (新設予定) | Claude routine | daily 08:00 JST 予定 | L2 ② AMD プロトコル 復旧 (= GAS 155 後継) | あり (Sonnet 4.6 サブスク内) | 同上 |
| 🚧 **`amd-os-project-knowledge-extract`** (新設予定) | Claude routine | daily 08:15 JST 予定 | L2 ④ PJ ナレッジ 復旧 | あり (Sonnet 4.6 サブスク内) | 同上 |
| 🚧 **`amd-os-member-knowledge-extract`** (新設予定) | Claude routine | daily 08:30 JST 予定 | L2 ⑤ メンバーナレッジ 復旧 | あり (Sonnet 4.6 サブスク内) | 同上 |
| **freee-payment-sync** | Vercel cron | daily | freee API → Supabase 入金同期 | なし | `pwa/src/app/api/cron/freee-payment-sync/route.ts` |
| **payment-confirm-nudges** | Vercel cron | daily | 入金確認通知 | なし | `pwa/src/app/api/cron/payment-confirm-nudges/route.ts` |
| **member-weekly-activities** | Vercel cron | daily 18:00 | Gmail/Calendar 直接 fetch → `member_activities` 直書き | なし (= LLM 不使用、ルール抽出のみ) | `pwa/src/app/api/cron/member-weekly-activities/route.ts` |
| **payout-reward-cache-refresh** | Vercel cron | daily | 報酬キャッシュ再計算 | なし | `pwa/src/app/api/cron/payout-reward-cache-refresh/route.ts` |
| **papers-quarterly-ingest** | Vercel cron | quarterly | 論文 ingest | なし | `pwa/src/app/api/cron/papers-quarterly-ingest/route.ts` |
| **sync-pj-facts** | Vercel cron | daily | PJ メタ同期 | なし | `pwa/src/app/api/cron/sync-pj-facts/route.ts` |
| **macro-aggregate-indicators** | Vercel cron | daily | マクロ指標集計 | なし | `pwa/src/app/api/cron/macro-aggregate-indicators/route.ts` |
| **venture-xrl-refresh** | Vercel cron | daily 03:15 JST | XRL 自動判定 (Gemini 2.5 Flash) | あり ⚠️ | `pwa/src/app/api/cron/venture-xrl-refresh/route.ts` |

### ⚠️ 現状の片肺
1. ~~**`amd-os/strategy-signals-outbox/` を拾う applier が無い**~~ → **✅ 2026-05-25 修復済** (= `scripts/run-ms-outbox-applier.sh` の監視 dir 変数を `STRATEGY_OUTBOX_DIR="/Users/masa/.codex/automations/amd-os/strategy-signals-outbox"` に書き換え、実出力先と一致。LaunchAgent plist は変更不要、次回 5 分 polling で新 shell が自動で読まれる)。明日 03:30 以降の経営ハイライト outbox は手動 apply 不要で自動 flush される
2. **GAS clasp push 未反映**: kill switch ソースは local commit 済だが GAS live には push されてない。live trigger は削除済みなので動作上は止まってる
3. **venture-xrl-refresh は Vercel cron + LLM 課金**: cron 廃止方針からは例外。XRL 自動判定だけ毎日走るためここに残ってる
4. **LLM プロンプトのコード hardcode**: `venture-xrl-refresh/route.ts` などに prompt が hardcode されている。AGENTS.common.md ルール「LLM プロンプトは DB 管理」に違反。DB 化が別 task で必要
5. **経営ハイライト (= L2 ⑨ `project_strategy_signal`) だけ修正依頼ループ未実装**: 経営ハイライトを抽出する Codex automation `amd-os` の prompt には `l2_feedbacks` 読み込み手順が入ってない。→ まさの修正依頼が次回抽出に反映されない問題。別 task で対応 (= prompt に手順追加 or Claude routine 5 個目として移管)。⚠️ **当初「他 L2 は GAS 155 / 074 で動いてる」と書いたが、5/25 調査で GAS 155 自体が 5/22 kill switch で停止、つまり他 L2 の修正依頼ループも実際は止まってる**ことが判明、項目 6 参照
6. 🚨 **L2 ②④⑤⑥ の 4 種 自動取り込みが 5/22-5/25 完全 ghost 化**: 5/22 「LLM 課金が発生する定期抽出 cron 全廃止」の判断時に**「Codex automation `amd-os-ms` が全部カバーしてる」前提が間違ってた**ことが 5/25 判明。実態は `amd-os-ms` prompt は ②④⑤⑥ を「通知だけ」「生成しない」、GAS 153 / 155 / 152 は kill switch 停止 → **空中分解**。**復旧方針**: Claude routine 4 個新設 (= まさ案 C 採用 2026-05-25)、設計は [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)

---

## 5.5 design_log と本マニュアルの関係

| 区分 | 役割 | 場所 |
|---|---|---|
| **本マニュアル** | **正本**。最新仕様 / 経営判断ログ / 開発手順 / 用語定義 | `pwa/manual/*.md` |
| **design/** | 設計議論ログ (= 「なぜこの設計にしたか」「どの案を採用したか」) | `pwa/design/*.md` |
| **design_log/** | セッション記録 (= 履歴、時系列) | `pwa/design_log/sessions_YYYY-MM.md` |

### 読み順
1. **新規セッション開始時**: まず本マニュアル → 必要に応じて `design/` の関連 md
2. **「なぜ?」と思った時**: `design/` で議論経緯確認 → `design_log/` で時系列確認
3. **過去経緯が必要**: `design_log/sessions_YYYY-MM.md` を grep

### 設計変更を入れる時
- **同じ commit で本マニュアル + `design/` 両方を更新**
- `design_log/` は次セッションのえいみが「**何を変えたか**」を時系列で読めるよう追記
- 重要 UI は `pwa/design/FEATURE_REGISTRY.md` に anchor を追加 + `test:critical-ui` で機械検知

---

## 5.6 project_category に `new_business` 追加 (= 2026-05-25)

### 何が起きたか
2026-05-25 まさ「ZMP は新規事業創出モデルなので、これも PJ タイプに追加してほしい」と指示。

### 確定方針
- `projects.project_category` の選択肢に `new_business` を追加 (DB CHECK 制約 + UI + 分岐ロジック)
- 意味: **レガシー企業 (DX 化されていない既存事業会社) を AMD が伴走し、研究シーズ取込 + DX で新規事業を立ち上げるモデル**
- 既存 4 値: `dtsu` (学術発 SU 伴走) / `ecosystem` (研究機関 SU エコシステム) / `advisor` (社外役員/顧問) / **`new_business` (新規事業創出)**
- 初期該当 PJ: ZMP (`p19`、葛飾ロード) のみ
- ロジック扱い: **当面 DTSU と同じ** (AMD Score 対象 / MS 進捗対象 / 関連メンバー扱い)、実運用で違和感が出たら個別分岐 (まさ判断)

### なぜ DTSU と分けるか
- DTSU = 大学/研究所発のサイエンス SU 創出
- 新規事業創出 = 既存企業の中で新規事業を立てる (= レガシー DX + 研究シーズ取込)
- 関連メンバー / 投資家構造 / 出口戦略 / KPI が本質的に違う (= スピンアウト vs 既存子会社の事業創造)
- いまは `category` 区別だけ (= 一旦タグ化) で、ロジック差分は後段で見直す

### 触ったファイル (commit 単位で完結)
- DB: `pwa/scripts/migrations/089_project_category_new_business.sql`
- PWA: `AdminProjectsTable.tsx` / `progress-estimator.ts` / `activities/infer/route.ts` / `CockpitView.tsx` / `HudCockpitView.tsx` / `HudCockpitHeader.tsx`
- design: [`cockpit.md`](../design/cockpit.md) Project Category 表 + 今期 MS 対象、[`ms_progress.md`](../design/ms_progress.md) 対象 PJ 条件

### 新セッションのえいみへ
- `project_category in ('dtsu','ecosystem')` のリテラルを見つけたら `new_business` を含めるべきか必ず判断する
- AMD Score 対象は `!== 'ecosystem'` で判定されてるので `new_business` は自然に含まれる (変更不要)
- ロジック差分が必要になったら、まずまさに相談 (= 「DTSU と同じ扱いで進めて後で見直す」前提のため)

---

## 5.7 L2 ②④⑤⑥ ghost 化と Claude routine 4 個新設計画 (= 2026-05-25)

### 何が起きたか
2026-05-25 まさが「議事録を取り込む automation/routines がないって別セッションで気づいてた」と指摘 → 調査で発覚。**5/22 cron 廃止判断時の前提 (= Codex automation `amd-os-ms` が全 L2 をカバーしてる) が虚偽**だった。

### 確定 fact
| L2 | テーブル | 最後の自動更新 | 停止位置 |
|---|---|---|---|
| ② AMD プロトコル | `protocols` | 2026-05-22 | GAS 155 line 612 `L2_KNOWLEDGE_CRON_DISABLED_20260522` |
| ④ PJ ナレッジ | `project_knowledge` | 2026-05-23 (= 残留分) | GAS 155 line 387 同 flag |
| ⑤ メンバーナレッジ | `member_knowledge` | 2026-05-22 | GAS 155 line 64 同 flag |
| ⑥ MTG サマリ (議事録) | `project_meeting_summaries` | 5/22 以降は dialogue (= 手動投入) のみ active | GAS 153 line 67 `MEETING_HOURLY_CRON_DISABLED_20260522` + GAS 152 line 11 `NAV_MONTHLY_EXTRACT_CRON_DISABLED_20260522` |

### なぜ「Codex automation がカバーしてる」前提が違ったか
`amd-os-ms` automation の prompt 精読すると **抽出対象は ③⑦⑧ だけ**、②④⑤⑥ は「通知だけ」「生成しない」設計だった:
- A (= ⑦ OS 台帳差分) → `outbox.registryDiffs` ✅ 生成
- B (= ⑧ XRL 根拠) → `outbox.xrlEvidence` ✅ 生成
- C (= ③ MS 進捗) → `outbox.revisions` ✅ 生成
- D (= 生データ未取り込み) → `outbox.notifications` で **通知だけ**
- F (= 会議候補) → **通知だけ**

GAS 153 のソース冒頭コメントに「Use Codex automation/review batches」とあったが**実態として Codex 側に該当処理は実装されてなかった**。これを書いた人 (= 前任セッションのえいみ) が「未来の自分が拾ってくれるはず」と棚上げした形。

### 確定方針 (= まさ案 C 採用、2026-05-25)

**Claude routine 4 個新設** で復旧:

| Routine | 頻度 | 役割 | 既存 GAS 後継 |
|---|---|---|---|
| `amd-os-meeting-extract` | **毎時 0 分発火** | L2 ⑥ MTG サマリ (= 終了 +60-180 分の窓で拾う) | GAS 153 |
| `amd-os-protocol-extract` | daily 08:00 JST | L2 ② AMD プロトコル | GAS 155 (= protocol_pollAll) |
| `amd-os-project-knowledge-extract` | daily 08:15 JST | L2 ④ PJ ナレッジ | GAS 155 (= project_knowledge_pollAll) |
| `amd-os-member-knowledge-extract` | daily 08:30 JST | L2 ⑤ メンバーナレッジ | GAS 155 (= member_knowledge_pollAll) |

各 routine の prompt は **`l2_feedbacks` 読み込み手順を最初から組み込む** (= 修正依頼ループ復活、§3.4 ⚠️ 現状ギャップ も解消)。

### 設計議論の正本
[`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md) — Routine 1 SKILL.md prompt 完全版を inline で書いた、まさレビュー後に `mcp__scheduled-tasks__create_scheduled_task` で登録する。

### 教訓
- 大規模な path 切替 (= cron 停止 / writer 移管) を行う時は **「停止対象 → 後継担当」を 1 対 1 の対応表化** して fact 検証してから止める
- 「GAS X 個停止 + Codex automation Y 個追加」で「数」だけ揃ってても「カバー範囲」が偏ってる可能性、各 L2 の最新 created_at / updated_at を毎週可視化して ghost 早期検知
- マニュアル 5.4 責務分担マトリクスは **GAS source の kill switch flag を grep + Codex automation の prompt 精読** で書き起こす

---

## 5.8 過去の重要なバグ・事故ログ (= 抜粋)

新セッションで同じ事故を繰り返さないために、特に学んだ教訓:

| 日付 | 何が起きた | 教訓 |
|---|---|---|
| 2026-04-28 | 9 commit 未 push のまま origin/main 起点でビルドし直して機能消失 | **1 機能 = 1 commit、commit のたびに push** |
| 2026-05-06 | `--cwd .../pwa` 二重指定で Vercel deploy 失敗 | **deploy.sh は repo root の `.vercel/project.json` を指す、`--cwd .../pwa` 禁止** |
| 2026-05-07 | 「画像生成して」依頼に対して SVG で「それっぽい画像」を自作してごまかした | **画像生成 MCP がなければ「外部で生成して PNG を返してくれれば public に配置する」と明示する** |
| 2026-05-11 | 「1 時間放置するから動いてて」と明示された状況で Atlas Map zoom 確認だけで止まった | **半端で止めるのはまさを裏切る、残タスクは最後まで進む** |
| 2026-05-13 | `member_knowledge` で列名を想像で書いて誤抽出が発生 | **列名は `db_schema.md` を必ず grep** |
| 2026-05-21 | Management Score 急減で慌てた | **指標を見るだけでなく、その指標が動いた原因を追う** |
| 2026-05-24 | 「鉱山調査が OS に取り込まれてない」を「Slack ingest 停止」と誤判定し cron 復活案を提案 | **cron 廃止経緯 (= 5.1) を読まずに復活提案するのは禁忌、本マニュアルを先に読む** |
| 2026-05-25 | LaunchAgent applier が `amd-os-strategy-signals/outbox` を監視してたが、`amd-os` automation の実出力先は `amd-os/strategy-signals-outbox`。dir 名不整合で経営ハイライトが flush されず手動 apply 必要だった | **5.4 責務分担マトリクスに「⚠️ 現状の片肺」として明記したら次セッションで構造修復まで進んだ。「短期復旧 + 構造修復未対応」状態を放置せず必ず修復タスクとして可視化する** |
| 2026-05-25 | p25 KUTE の `freee_partner_id` 列に Slack channel ID (`C0B3KB8L7B5`) が誤入力されていた (= 入れる列を間違えた) | **同種 ID (= 数値 / 英数字) でも列の意味が違うので、入力 UI 側で列ラベル明示 + 入力時バリデーション (= freee partner ID は数値のみ等) を仕込む** |
| 2026-05-25 | **5/22 「LLM 課金 cron 全廃止」の時に「Codex automation `amd-os-ms` が L2 ②④⑤⑥ も拾ってる」前提が間違っており、3 日間 ghost 化が発覚**。実態は `amd-os-ms` prompt は ②④⑤⑥ を「通知だけ」「生成しない」、GAS 153 / 155 / 152 は kill switch 停止 → 空中分解 | **大規模な path 切替を行う時は「停止対象 vs 後継担当」を 1 対 1 で対応表化してから止める**。今回は GAS 4 個停止 + Codex automation 2 個追加で「数」だけ整って見えたが「カバー範囲」が偏ってた。マニュアル 5.4 責務分担マトリクスを fact 検証 (= GAS source の kill switch flag を grep) してから止める運用に |

→ 詳細は [`pwa/BUGS.md`](../BUGS.md)
