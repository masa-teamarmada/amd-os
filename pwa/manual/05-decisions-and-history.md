# 05. 過去判断と経緯

「**なぜそうなっているか**」が分かる場所。新セッションの開発担当が「これ動いてないけど何で?」となった時、まずここを読む。

## 5.1 cron 廃止経緯 (= 2026-05-22 仕様変更の本丸)

### 何が起きたか
2026-05 上旬まで、PWA は Vercel cron で毎時/毎日に **LLM 課金が発生する定期抽出** (= L1 / L2 抽出系) を回していた。GAS 側でも同様。

結果:
- Anthropic / Gemini / OpenAI のトークン課金が膨大化
- 2026-05-13 (= sessions_2026-05.md L2863) — `vc-news-ingest` が直近 7 日分を daily で cron かけていて過剰と判明 → 月 $128 → $1-2 (-99%)
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

### ⚠️ 新セッションの開発担当へ
- **「cron 復活すればいい」と提案するのは禁忌**。token 課金問題で慌てて止めた経緯あり
- データ取り込み不足を見つけたら、まず **Codex automation か Claude routine で実装** することを検討
- どうしても Vercel cron が必要なら、LLM 非依存 (= 純粋な DB 同期や fetch のみ) であることを確認

---

## 5.2 4 分類 → 経営ハイライト 改訂経緯 (= 2026-05-24)

### 何が起きたか
2026-05-24 PM に「経営・事業シグナル」を 9 種 → 3 分類 → 4 分類 と再設計したが、改訂中に **本質的なズレ**が判明:
- 「経営判断未了」のような **未了系の議題** が経営ハイライトに混入していた
- 「ダイキアクシスとの距離感を経営判断未了」が「経営全般」に入ってる違和感 → 真意は「**未了なのに進捗を書く場に書いてること**が違和感」

### 確定方針 (= 2026-05-24 夜)
- セクション名: **「経営ハイライト」** (旧「経営・事業シグナル」廃止)
- 中身ルール: **「進んだこと・起きたこと」だけ**書く (= done のみ、未了 / TODO / アイディアは別場所)
- 表示: polarity アイコン軸 (🎉/✨/🔄/⚠️、4 種類、🌐 中立は廃止) + 4 分類カラー + impact chip + 「⚠️ 未確認」(candidate のみ)
- AMD Score 影響併記: 各シグナルに「📊 影響: TRL 4→5、X 軸 +40pt」(score_impact_summary 列追加)
- 未了の議題は **TODO かんばん** (= TODO/Doing/Done、別 UI、別 task で実装)

### なぜこの設計か
- 最終目的: **株主説明会・事業報告書を「並んだハイライトをまとめるだけで自動生成」**できる状態
- そのために「起きた事象だけ」を時系列で蓄積する
- 「未了議題」は別軸 (= TODO かんばん) で管理 → Done に移動した瞬間に経営ハイライトに自動転記

---

## 5.3 提案前の論点整理セッション運用ルール (= 2026-05-24)

提案前の論点整理セッションは、レビュー担当が LLM と OS 上の candidate を読み、チームへ提案する前の論点・提案・残課題を整理する対話セッション。

### 確定方針
- UI / manual では **「提案前の論点整理セッション」** または **`dialogue`** と呼ぶ
- 会社の正式会議体として扱わず、チームへ提案する前の対話セッション / 提案整理として記録する
- cockpit の `project_meeting_summaries.source_kinds='dialogue'` に保存し、通常の PJ MTG サマリと同じ一覧で読めるようにする

### LLM への含意
- `decided[]` 配列は「**提案**」「整理した論点」のニュアンスで書く
- 「正式決定」「決まったこと」と断定しない

---

## 5.4 Codex / Claude Cloud / Vercel / LaunchAgent 責務分担マトリクス

「**どの自動処理がどこで動いてるか**」が分かる正本表。新セッションの開発担当は必ず確認。

**🚨 2026-05-26 大変更**: L2 ②〜⑨ 全 8 種を **claude.ai/code/routines (= Cloud / Remote routine、Anthropic-managed cloud infrastructure)** に統一移行 ([38 章](38-l2-extraction-routines-spec.md))。GAS 153/155/152 と Codex automation `amd-os-ms` / `amd-os` は段階的に停止 (= Cloud routine 動作確認後)。理由: Mac の Local routine (`~/.claude/scheduled-tasks/`) は **app open + 非スリープ中のみ発火** で MacBook Air 運用と相性悪い、Cloud routine は laptop closed でも動く。

### Cloud routines (= L2 ②〜⑨ 統一、2026-05-26 entry 済)

| routine 名 | trigger ID | 動く場所 | 頻度 | 役割 | 状態 |
|---|---|---|---|---|---|
| L2 ② AMD プロトコル抽出 | `trig_01YEcyejLzKF7zYgmAiw3w8P` | claude.ai Cloud sandbox VM | daily 08:00 JST | `protocols` 抽出 (GAS 155 後継) | ✅ 動作テスト済 |
| L2 ③ MS 進捗抽出 | `trig_01MxR8nyEvJvSHaCwDcHoqmb` | 同上 | 毎時 0 分 | `milestone_monthly_progress` 推定 (PWA hourly-estimate 後継) | 🚧 並行稼働 |
| L2 ④ PJ ナレッジ抽出 | `trig_01DtARvCSkz99GsgG8xihceX` | 同上 | daily 08:15 JST | `project_knowledge` 抽出 (GAS 155 後継) | 🚧 未テスト |
| L2 ⑤ メンバーナレッジ抽出 | `trig_011FUoNE2YCLgVoZVa9C4q2m` | 同上 | daily 08:30 JST | `member_knowledge` 抽出 (GAS 155 後継) | 🚧 Connector 不完全 |
| L2 ⑥ MTG サマリ抽出 | `trig_01LHbVwy9KH2RNv1E7TtoaQd` | 同上 | 毎時 0 分 | `project_meeting_summaries` 抽出 (GAS 153 + 074 後継、5 ソース全部見る) | 🚧 Connector 不完全 (Supabase + Calendar 欠) |
| L2 ⑦ OS 台帳差分抽出 | `trig_01211WVhf1pVw7mMdCk2RZxr` | 同上 | `0 */6 * * *` (6h ごと) | `project_registry_diffs` 抽出 (Codex `amd-os-ms` 後継) | 🚧 Connector Docusign のみ |
| L2 ⑧ XRL 根拠抽出 | `trig_01QktXVABmg7ohA8NCUSFY9C` | 同上 | `15 */6 * * *` (L7+15 分) | `project_xrl_evidence` 抽出 (Codex `amd-os-ms` 後継) | 🚧 Connector Docusign のみ |
| L2 ⑨ 経営ハイライト抽出 | `trig_011hJJ17Do1bwb1ESXDMt8rH` | 同上 | daily 03:20 JST | `project_strategy_signals` 抽出 (Codex `amd-os` 後継) | 🚧 Connector 不完全 |

LLM 課金: claude.ai Pro/Max/Team/Enterprise sub 内 (= 追加課金なし、Sonnet 4.6 が default 実行モデル)
管理 URL: [claude.ai/code/routines](https://claude.ai/code/routines)
SKILL 正本: [`pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md`](../scheduled-tasks/)

### 並行稼働中 (= Cloud 動作確認後に停止予定)

| 自動処理 | 動く場所 | 頻度 | 役割 | LLM 課金 | 関連 file |
|---|---|---|---|---|---|
| **PWA hourly-estimate** | GAS 154 → PWA route | 毎時 0 分 | (Cloud L2 ③ 移管中) `milestone_monthly_progress` 推定の現 primary writer | あり (Sonnet 4.5、差分時のみ) | `gas/154_PwaCronCaller.js`, `pwa/src/app/api/cron/hourly-estimate/route.ts`, [36 章](36-ms-progress-monthly-report-revision-spec.md) |
| **amd-os-ms** | Codex automation | 6h ごと | (Cloud L2 ⑦⑧ 移管中) MS 進捗修正候補 / L2 ⑦ OS 台帳差分 / L2 ⑧ XRL 根拠の outbox 出力 | あり | `~/.codex/automations/amd-os-ms/automation.toml` |
| **amd-os** | Codex automation | daily 03:20 JST | (Cloud L2 ⑨ 移管中) L2 ⑨ 経営ハイライト outbox 出力 | あり | `~/.codex/automations/amd-os/automation.toml` |
| **outbox applier** | LaunchAgent | 5 分ごと | Codex outbox → Supabase POST。L2 ⑦⑧⑨ Cloud 移管完了後は不要 | なし (= 純粋 DB 反映) | `~/Library/LaunchAgents/jp.teamarmada.amd-os-ms-outbox-applier.plist` |

### Mac Local routines (= 並行稼働、Cloud 動作確認後に disable 予定)

| Mac scheduled task | 頻度 | 役割 | 状態 |
|---|---|---|---|
| amd-os-l2-protocol-extract | daily 08:00 JST | (L2 ② 旧 Mac 版、Cloud に移管済) | ⚠️ Mac スリープで実発火ゼロ、Cloud と重複 (idempotent) |
| amd-os-l3-ms-progress-extract | 毎時 0 分 | (L2 ③ 旧 Mac 版) | 同上 |
| amd-os-l4-project-knowledge-extract | daily 08:15 JST | (L2 ④ 旧 Mac 版) | 同上 |
| amd-os-l5-member-knowledge-extract | daily 08:30 JST | (L2 ⑤ 旧 Mac 版) | 同上 |
| amd-os-l6-meeting-extract | 毎時 0 分 | (L2 ⑥ 旧 Mac 版) | 同上 |
| amd-os-l7-registry-diff-extract | `0 */6 * * *` | (L2 ⑦ 旧 Mac 版) | 同上 |
| amd-os-l8-xrl-evidence-extract | `15 */6 * * *` | (L2 ⑧ 旧 Mac 版) | 同上 |
| amd-os-l9-strategy-signal-extract | daily 03:20 JST | (L2 ⑨ 旧 Mac 版) | 同上 |

### 残存・関連自動処理

| 自動処理 | 動く場所 | 頻度 | 役割 | LLM 課金 | 関連 file |
|---|---|---|---|---|---|
| **amd-atlas-2** | Codex automation | daily 08:10 JST | Atlas 外部マクロ抽出 + outbox 出力 | あり | `~/.codex/automations/amd-atlas-2/automation.toml` |
| **amd-macrotrend-evidence-review** | Codex automation | weekly Mon 07:30 | UN SDGs / WEF Global Risks 整理 | あり | `~/.codex/automations/amd-macrotrend-evidence-review/` |
| **amd-os-management-dialogue-prep** | Mac Local routine | daily 07:00 JST | 提案前 dialogue の議題プリペア (= まさえいMTG) | あり | `~/.claude/scheduled-tasks/amd-os-management-dialogue-prep/SKILL.md` |
| ~~**GAS 153 MeetingHourlyTrigger**~~ | ⛔ 2026-05-22 停止 | — | (旧) MTG サマリ取り込み → kill switch、Cloud L2 ⑥ に移管済 | あり (Gemini) | `gas/153_MeetingHourlyTrigger.js` |
| ~~**GAS 155 L2KnowledgeExtractor**~~ | ⛔ 2026-05-22 停止 | — | (旧) L2 ②④⑤ 抽出 → kill switch、Cloud L2 ②④⑤ に移管済 | あり (Gemini) | `gas/155_L2KnowledgeExtractor.js` |
| ~~**GAS 152 NavigatorCron 月次 extract**~~ | ⛔ 2026-05-22 停止 | — | (旧) 月単位 fallback 抽出 → kill switch | あり | `gas/152_NavigatorCron.js` |
| **freee-payment-sync** | Vercel cron | daily | freee API → Supabase 入金同期 | なし | `pwa/src/app/api/cron/freee-payment-sync/route.ts` |
| **payment-confirm-nudges** | Vercel cron | daily | 入金確認通知 | なし | `pwa/src/app/api/cron/payment-confirm-nudges/route.ts` |
| **member-weekly-activities** | Vercel cron | daily 18:00 | Gmail/Calendar 直接 fetch → `member_activities` 直書き | なし (= LLM 不使用、ルール抽出のみ) | `pwa/src/app/api/cron/member-weekly-activities/route.ts` |
| **payout-reward-cache-refresh** | Vercel cron | daily | 報酬キャッシュ再計算 | なし | `pwa/src/app/api/cron/payout-reward-cache-refresh/route.ts` |
| **papers-quarterly-ingest** | Vercel cron | quarterly | 論文 ingest | なし | `pwa/src/app/api/cron/papers-quarterly-ingest/route.ts` |
| **sync-pj-facts** | Vercel cron | daily | PJ メタ同期 | なし | `pwa/src/app/api/cron/sync-pj-facts/route.ts` |
| **macro-aggregate-indicators** | Vercel cron | daily | マクロ指標集計 | なし | `pwa/src/app/api/cron/macro-aggregate-indicators/route.ts` |
| ~~venture-xrl-refresh~~ | PWA route (schedule 停止中) | disabled | XRL 自動判定 (Gemini 2.5 Flash)。route は手動検証用に残す | あり ⚠️ | `pwa/src/app/api/cron/venture-xrl-refresh/route.ts`, `pwa/vercel.disabled-crons.json` |

### ⚠️ 現状の片肺
1. ~~**`amd-os/strategy-signals-outbox/` を拾う applier が無い**~~ → **✅ 2026-05-25 修復済** (= 修復後、2026-05-26 に Cloud routine L2 ⑨ へ移管予定で remaining 役割は段階停止)
1. ~~**`amd-atlas-2/outbox/` の staging artifact を applier が拾わない**~~ → **✅ 2026-05-25 修復済**
2. **GAS clasp push 未反映**: kill switch ソースは local commit 済だが GAS live には push されてない。live trigger は削除済みなので動作上は止まってる
3. ~~**XRL 自動判定だけは Vercel cron 例外として残る**~~ → **✅ 2026-05-25 訂正**: `pwa/vercel.disabled-crons.json` に退避済み
4. **LLM プロンプトのコード hardcode**: `venture-xrl-refresh/route.ts` などに prompt が hardcode されている。AGENTS.common.md ルール「LLM プロンプトは DB 管理」に違反。DB 化が別 task で必要
5. ~~**経営ハイライト (= L2 ⑨) の修正依頼ループ未実装**~~ → **🚧 2026-05-26 進行中**: Cloud routine `L2 ⑨ 経営ハイライト抽出` の SKILL に `l2_feedbacks` 読み込み手順を組み込み済。修正依頼ループは対話型 (= `/api/notifications/feedback/dialog/*` + CockpitStrategySignals UI 拡張) に置換予定 ([feedback_dialog.md](../design/feedback_dialog.md))
6. ~~**L2 ②④⑤⑥ の 4 種 自動取り込みが 5/22-5/25 完全 ghost 化**~~ → **🚧 2026-05-26 復旧進行中**: Cloud routine L2 ②④⑤⑥ を claude.ai/code/routines に entry 完了 (= §5.4 表)。明日朝の scheduled run で発火試行。L5/L6/L9 の Connector が claude.ai UI bug で不完全 (= Supabase 必須なのに追加できず)、別 session で補完予定
7. 🆕 **claude.ai UI bug (= Cloud routine 編集で Connector / repo 追加が反映されない)**: 2026-05-26 セッションで判明。L4 失敗時に Connector default が破損 → L5-L9 で Connector 1 個 (Docusign のみ) default、編集モーダルの dropdown option click が React state を更新しない。Anthropic に共有 + 修正待ち、または Connector を Cloud routine 内で動的に有効化する仕組みを別 routine 内で確認

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
- `design_log/` は次セッションの開発担当が「**何を変えたか**」を時系列で読めるよう追記
- 重要 UI は `pwa/design/FEATURE_REGISTRY.md` に anchor を追加 + `test:critical-ui` で機械検知

---

## 5.6 project_category に `new_business` 追加 (= 2026-05-25)

### 何が起きたか
2026-05-25 に「ZMP は新規事業創出モデルなので、これも PJ タイプに追加してほしい」と要望。

### 確定方針
- `projects.project_category` の選択肢に `new_business` を追加 (DB CHECK 制約 + UI + 分岐ロジック)
- 意味: **レガシー企業 (DX 化されていない既存事業会社) を AMD が伴走し、研究シーズ取込 + DX で新規事業を立ち上げるモデル**
- 既存 4 値: `dtsu` (学術発 SU 伴走) / `ecosystem` (研究機関 SU エコシステム) / `advisor` (社外役員/顧問) / **`new_business` (新規事業創出)**
- 初期該当 PJ: ZMP (`p19`、葛飾ロード) のみ
- ロジック扱い: **当面 DTSU と同じ** (AMD Score 対象 / MS 進捗対象 / 関連メンバー扱い)、実運用で違和感が出たら個別分岐

### なぜ DTSU と分けるか
- DTSU = 大学/研究所発のサイエンス SU 創出
- 新規事業創出 = 既存企業の中で新規事業を立てる (= レガシー DX + 研究シーズ取込)
- 関連メンバー / 投資家構造 / 出口戦略 / KPI が本質的に違う (= スピンアウト vs 既存子会社の事業創造)
- いまは `category` 区別だけ (= 一旦タグ化) で、ロジック差分は後段で見直す

### 触ったファイル (commit 単位で完結)
- DB: `pwa/scripts/migrations/089_project_category_new_business.sql`
- PWA: `AdminProjectsTable.tsx` / `progress-estimator.ts` / `activities/infer/route.ts` / `CockpitView.tsx` / `HudCockpitView.tsx` / `HudCockpitHeader.tsx`
- design: [`cockpit.md`](../design/cockpit.md) Project Category 表 + 今期 MS 対象、[`ms_progress.md`](../design/ms_progress.md) 対象 PJ 条件

### 新セッションの開発担当へ
- `project_category in ('dtsu','ecosystem')` のリテラルを見つけたら `new_business` を含めるべきか必ず判断する
- AMD Score 対象は `!== 'ecosystem'` で判定されてるので `new_business` は自然に含まれる (変更不要)
- ロジック差分が必要になったら、まず AMD 経営チームに相談 (= 「DTSU と同じ扱いで進めて後で見直す」前提のため)

---

## 5.7 L2 ②④⑤⑥ ghost 化と Claude routine 4 個新設計画 (= 2026-05-25)

### 何が起きたか
2026-05-25 に「議事録を取り込む automation/routines がない」と指摘 → 調査で発覚。**5/22 cron 廃止判断時の後継処理カバー範囲が不足していた**。

### 確定 fact
| L2 | テーブル | 最後の自動更新 | 停止位置 |
|---|---|---|---|
| ② AMD プロトコル | `protocols` | 2026-05-22 | GAS 155 line 612 `L2_KNOWLEDGE_CRON_DISABLED_20260522` |
| ④ PJ ナレッジ | `project_knowledge` | 2026-05-23 (= 残留分) | GAS 155 line 387 同 flag |
| ⑤ メンバーナレッジ | `member_knowledge` | 2026-05-22 | GAS 155 line 64 同 flag |
| ⑥ MTG サマリ (議事録) | `project_meeting_summaries` | 5/22 以降は dialogue (= 手動投入) のみ active | GAS 153 line 67 `MEETING_HOURLY_CRON_DISABLED_20260522` + GAS 152 line 11 `NAV_MONTHLY_EXTRACT_CRON_DISABLED_20260522` |

### なぜ後継処理のカバー範囲が不足したか
`amd-os-ms` automation の prompt 精読すると **抽出対象は ③⑦⑧ だけ**、②④⑤⑥ は「通知だけ」「生成しない」設計だった:
- A (= ⑦ OS 台帳差分) → `outbox.registryDiffs` ✅ 生成
- B (= ⑧ XRL 根拠) → `outbox.xrlEvidence` ✅ 生成
- C (= ③ MS 進捗) → `outbox.revisions` ✅ 生成
- D (= 生データ未取り込み) → `outbox.notifications` で **通知だけ**
- F (= 会議候補) → **通知だけ**

GAS 153 のソース冒頭コメントに「Use Codex automation/review batches」とあったが**実態として Codex 側に該当処理は実装されてなかった**。前任セッションが「未来の担当が拾ってくれるはず」と棚上げした形。

### 確定方針 (= 2026-05-25 採用、2026-05-25 #71 拡張)

**初期案 (= 2026-05-25 朝)**: Claude routine 4 個新設 (= ②④⑤⑥ ghost 4 種だけ)

**拡張版 (= 2026-05-25 お昼 #71、「すべて Claude routines で抽出する形に変更」)**: **Claude routine 8 個新設** で L2 ②〜⑨ 統一 (= 稼働中の ③⑦⑧⑨ も移管):

| Routine | 頻度 | 役割 | 既存 writer (停止/移管対象) | 状態 |
|---|---|---|---|---|
| `amd-os-meeting-extract` | **毎時 0 分** (= 終了 +60-180 分 window) | L2 ⑥ MTG サマリ | GAS 153 (= kill switch、完全 bypass) | ✅ SKILL.md inline 移植版 Write 済 #71、scheduled task 登録待ち |
| `amd-os-protocol-extract` | daily 08:00 JST | L2 ② AMD プロトコル | GAS 155 (= protocol_pollAll、kill switch) | 🚧 未作成 |
| `amd-os-project-knowledge-extract` | daily 08:15 JST | L2 ④ PJ ナレッジ | GAS 155 (= project_knowledge_pollAll、kill switch) | 🚧 未作成 |
| `amd-os-member-knowledge-extract` | daily 08:30 JST | L2 ⑤ メンバーナレッジ | GAS 155 (= member_knowledge_pollAll、kill switch) | 🚧 未作成 + member_knowledge schema gap (= status / source_hash 列なし) |
| `amd-os-ms-progress-extract` | 毎時 0 分 | L2 ③ MS 進捗 | GAS 154 → PWA `/api/cron/hourly-estimate` (稼働中) + Codex `amd-os-ms` (修正候補) | 🚧 未作成、**移管慎重** (= 既存 primary writer 動作中) |
| `amd-os-registry-diff-extract` | 6h ごと | L2 ⑦ OS 台帳差分 | Codex `amd-os-ms` の `outbox.registryDiffs` (稼働中) | 🚧 未作成、移管慎重 |
| `amd-os-xrl-evidence-extract` | 6h ごと | L2 ⑧ XRL 根拠 | Codex `amd-os-ms` の `outbox.xrlEvidence` (稼働中) | 🚧 未作成、移管慎重 |
| `amd-os-strategy-signal-extract` | daily 03:20 JST | L2 ⑨ 経営ハイライト | Codex `amd-os` (稼働中、5/25 applier 修復済) | 🚧 未作成、対話型修正依頼 (#34) と接続必要 |

各 routine の prompt は **`l2_feedbacks` 読み込み手順を最初から組み込む** (= 修正依頼ループ復活、§3.4 ⚠️ 現状ギャップ も解消)。MCP 経由で Calendar / Notion / Gmail / Drive / Slack に直接 access、LLM はサブスク内 Claude (= scheduled task 内で私自身が prompt 受けて JSON 生成)、Supabase は REST 直叩き。

**段階的停止**: Routine 5-8 が動作確認できてから既存 Codex automation `amd-os-ms` / `amd-os` + LaunchAgent applier を unload。

### 設計議論の正本
[`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md) — 設計議論 (= 2026-05-25 #71 で 8 routine 統一方針に改訂)。実装/登録/DB upsert の current truth は [38 章 L2 Extraction Routines](38-l2-extraction-routines-spec.md) を正本にする。Routine 1 は SKILL.md 完全 inline 移植版が ready、`mcp__scheduled-tasks__create_scheduled_task` で登録待ち。

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
| 2026-05-11 | 「1 時間放置するから動いてて」と明示された状況で Atlas Map zoom 確認だけで止まった | **半端で止めず、残タスクは最後まで進む** |
| 2026-05-13 | `member_knowledge` で列名を想像で書いて誤抽出が発生 | **列名は `db_schema.md` を必ず grep** |
| 2026-05-21 | Management Score 急減で慌てた | **指標を見るだけでなく、その指標が動いた原因を追う** |
| 2026-05-24 | 「鉱山調査が OS に取り込まれてない」を「Slack ingest 停止」と誤判定し cron 復活案を提案 | **cron 廃止経緯 (= 5.1) を読まずに復活提案するのは禁忌、本マニュアルを先に読む** |
| 2026-05-25 | LaunchAgent applier が `amd-os-strategy-signals/outbox` を監視してたが、`amd-os` automation の実出力先は `amd-os/strategy-signals-outbox`。dir 名不整合で経営ハイライトが flush されず手動 apply 必要だった | **5.4 責務分担マトリクスに「⚠️ 現状の片肺」として明記したら次セッションで構造修復まで進んだ。「短期復旧 + 構造修復未対応」状態を放置せず必ず修復タスクとして可視化する** |
| 2026-05-25 | p25 KUTE の `freee_partner_id` 列に Slack channel ID (`C0B3KB8L7B5`) が誤入力されていた (= 入れる列を間違えた) | **同種 ID (= 数値 / 英数字) でも列の意味が違うので、入力 UI 側で列ラベル明示 + 入力時バリデーション (= freee partner ID は数値のみ等) を仕込む** |
| 2026-05-25 | **5/22 「LLM 課金 cron 全廃止」の時に「Codex automation `amd-os-ms` が L2 ②④⑤⑥ も拾ってる」前提が間違っており、3 日間 ghost 化が発覚**。実態は `amd-os-ms` prompt は ②④⑤⑥ を「通知だけ」「生成しない」、GAS 153 / 155 / 152 は kill switch 停止 → 空中分解 | **大規模な path 切替を行う時は「停止対象 vs 後継担当」を 1 対 1 で対応表化してから止める**。今回は GAS 4 個停止 + Codex automation 2 個追加で「数」だけ整って見えたが「カバー範囲」が偏ってた。マニュアル 5.4 責務分担マトリクスを fact 検証 (= GAS source の kill switch flag を grep) してから止める運用に |

→ 詳細は [`pwa/BUGS.md`](../BUGS.md)
