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

## 5.3 まさえいMTG 命名経緯 (= 2026-05-24)

### 何が起きたか
当初「**まさ × えいみ 経営会議**」と呼んでいた。

2026-05-24 まさが指摘: 「経営会議」呼びは:
- かる / ちこ等チームメンバーが疎外感を持つ (= 「経営会議に呼ばれてない」)
- チーム外の人が読んだとき「2 人で議論してるセッション」だと分からない

### 確定方針
- **「まさえいMTG」**と呼ぶ (= まさ + えいみ + MTG)
- 全ドキュメント (= `pwa/CLAUDE.md`、`pwa/AGENTS.md`、各 design md、SYSTEM_PROMPT、Slack 投稿) で統一
- 既存 DB 3 件 + Slack 過去投稿 1 件も update (= 旧 ts 削除 + 新 ts 再投稿)

### LLM への含意
- `decided[]` 配列は「**提案**」のニュアンスで書く (= チームへの相談前提)
- 「決定」「決まったこと」と書かない

---

## 5.4 Codex / Claude / Vercel / LaunchAgent 責務分担マトリクス

「**どの自動処理がどこで動いてるか**」が分かる正本表。新セッションのえいみは必ず確認。

| 自動処理 | 動く場所 | 頻度 | 役割 | LLM 課金 | 関連 file |
|---|---|---|---|---|---|
| **amd-os-ms** | Codex automation | 6h ごと | L2 ② ③ ④ ⑤ ⑦ ⑧ 抽出 + outbox 出力 | あり | `~/.codex/automations/amd-os-ms/automation.toml` |
| **amd-os** | Codex automation | daily 03:20 JST | L2 ⑨ 経営ハイライト抽出 + outbox 出力 | あり | `~/.codex/automations/amd-os/automation.toml` |
| **amd-atlas-2** | Codex automation | daily 08:10 JST | Atlas 外部マクロ抽出 + outbox 出力 | あり | `~/.codex/automations/amd-atlas-2/automation.toml` |
| **amd-macrotrend-evidence-review** | Codex automation | weekly Mon 07:30 | UN SDGs / WEF Global Risks 整理 | あり | `~/.codex/automations/amd-macrotrend-evidence-review/` |
| **outbox applier** | LaunchAgent | 5 分ごと | Codex outbox → Supabase POST | なし (= 純粋 DB 反映) | `~/Library/LaunchAgents/jp.teamarmada.amd-os-ms-outbox-applier.plist` |
| **amd-os-management-dialogue-prep** | Claude routine | daily 07:00 JST | まさえいMTG 議題プリペア | あり | `~/.claude/scheduled-tasks/amd-os-management-dialogue-prep/SKILL.md` |
| **GAS 153 MeetingHourlyTrigger** | GAS (= 半生) | 毎時 | MTG サマリ取り込み (= Calendar + 議事録 → `project_meeting_summaries` 直書き) | なし (= テンプレ整形のみ) | `gas/153_MeetingHourlyTrigger.js` |
| **freee-payment-sync** | Vercel cron | daily | freee API → Supabase 入金同期 | なし | `pwa/src/app/api/cron/freee-payment-sync/route.ts` |
| **payment-confirm-nudges** | Vercel cron | daily | 入金確認通知 | なし | `pwa/src/app/api/cron/payment-confirm-nudges/route.ts` |
| **member-weekly-activities** | Vercel cron | daily 18:00 | Gmail/Calendar 直接 fetch → `member_activities` 直書き | なし (= LLM 不使用、ルール抽出のみ) | `pwa/src/app/api/cron/member-weekly-activities/route.ts` |
| **payout-reward-cache-refresh** | Vercel cron | daily | 報酬キャッシュ再計算 | なし | `pwa/src/app/api/cron/payout-reward-cache-refresh/route.ts` |
| **papers-quarterly-ingest** | Vercel cron | quarterly | 論文 ingest | なし | `pwa/src/app/api/cron/papers-quarterly-ingest/route.ts` |
| **sync-pj-facts** | Vercel cron | daily | PJ メタ同期 | なし | `pwa/src/app/api/cron/sync-pj-facts/route.ts` |
| **macro-aggregate-indicators** | Vercel cron | daily | マクロ指標集計 | なし | `pwa/src/app/api/cron/macro-aggregate-indicators/route.ts` |
| **venture-xrl-refresh** | Vercel cron | daily 03:15 JST | XRL 自動判定 (Gemini 2.5 Flash) | あり ⚠️ | `pwa/src/app/api/cron/venture-xrl-refresh/route.ts` |

### ⚠️ 現状の片肺
1. **`amd-os/strategy-signals-outbox/` を拾う applier が無い** (= LaunchAgent は `amd-os-ms` と `amd-atlas` のみ監視)、`amd-os-strategy-signals/outbox` を見るが空。→ 経営ハイライト抽出結果が手動 apply 必要、別 task で構造修復
2. **GAS clasp push 未反映**: kill switch ソースは local commit 済だが GAS live には push されてない。live trigger は削除済みなので動作上は止まってる
3. **venture-xrl-refresh は Vercel cron + LLM 課金**: cron 廃止方針からは例外。XRL 自動判定だけ毎日走るためここに残ってる
4. **LLM プロンプトのコード hardcode**: `venture-xrl-refresh/route.ts` などに prompt が hardcode されている。AGENTS.common.md ルール「LLM プロンプトは DB 管理」に違反。DB 化が別 task で必要

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

## 5.6 過去の重要なバグ・事故ログ (= 抜粋)

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

→ 詳細は [`pwa/BUGS.md`](../BUGS.md)
