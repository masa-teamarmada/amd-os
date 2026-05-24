# 03. データと抽出

AMD OS の **裏側**。「このデータはどこから来るか」「どう抽出されてるか」「用語と実装の対応」を扱う。

## 3.1 5 生データの取り込みフロー

### 5 ソース
| ソース | 取り込み元 | 主な内容 |
|---|---|---|
| **Slack** | `team-armada` ワークスペース | 議事録投稿 / メンバー間チャット / 長文報告 |
| **Notion** | チームアルマダ Workspace | 議事録 / 設計ドキュメント |
| **Calendar** | Google Workspace | MTG イベント |
| **Drive** | チームアルマダ Drive | 議事録 docs / 試算表 / 提案資料 PDF |
| **Gmail** | まさ + AMD メンバー受信箱 | 外部関係者連絡 |

### 🚨 現状 (= 2026-05-25 fact)

2026-05-22 に「LLM 課金が発生する定期抽出 cron を全廃止」した時に、**「Codex automation が全部カバーしてる前提」が間違ってた**ことが 5/25 判明。実態:

| L2 | 何を生成 | 元 writer | 現状 | 復旧方針 |
|---|---|---|---|---|
| ① monthly_reports | PJ 月次レポート | AMD-Report GAS R313 | ✅ 稼働 (= R313 は LLM 不使用、別 GAS で生きてる) | — |
| ② AMD プロトコル | `protocols` | GAS 155 | ⛔ **5/22 停止 (`L2_KNOWLEDGE_CRON_DISABLED_20260522`)**、Codex automation 受け皿無し | 🚧 Claude routine 新設予定 |
| ③ MS 進捗 | `milestone_monthly_progress` 等 | GAS 154 → Codex automation `amd-os-ms` | ✅ 稼働 (= `amd-os-ms` が 6h ごとに `outbox.revisions` 生成 → applier upsert) | — |
| ④ PJ ナレッジ | `project_knowledge` | GAS 155 | ⛔ **5/22 停止**、Codex automation は通知のみ (生成なし) | 🚧 Claude routine 新設予定 |
| ⑤ メンバーナレッジ | `member_knowledge` | GAS 155 | ⛔ **5/22 停止**、Codex automation は通知のみ | 🚧 Claude routine 新設予定 |
| ⑥ MTG サマリ (議事録) | `project_meeting_summaries` | GAS 153 (毎時 polling) | ⛔ **5/22 停止 (`MEETING_HOURLY_CRON_DISABLED_20260522`)**、Codex automation 受け皿無し | 🚧 Claude routine 新設予定 |
| ⑦ OS 台帳差分 | `project_registry_diffs` | Codex automation `amd-os-ms` | ✅ 稼働 (= `outbox.registryDiffs` 生成 → applier upsert) | — |
| ⑧ XRL 根拠 | `project_xrl_evidence` | Codex automation `amd-os-ms` | ✅ 稼働 (= `outbox.xrlEvidence` 生成 → applier upsert) | — |
| ⑨ 経営ハイライト | `project_strategy_signals` | Codex automation `amd-os` (daily 03:20) | ✅ 稼働 (= applier dir 修復済 2026-05-25)、ただし**修正依頼ループ未実装** | 別 task で `amd-os` prompt 拡張 |

つまり **②④⑤⑥ = 議事録 / プロトコル / PJ ナレッジ / メンバーナレッジ の 4 種が 5/22 以降 ghost 状態** (= 5/22 以前の row が cockpit に表示されるが、新規取り込みゼロ)。実 fact:
- `protocols`: 2026-05-22 が最後の created_at
- `project_knowledge`: 2026-05-23 が最後の updated_at (残留分)
- `member_knowledge`: 2026-05-22 が最後の updated_at
- `project_meeting_summaries`: 5/22 以降 created の自動取り込みは事実上ゼロ (= dialogue (まさえい手動) と manual_eimi のみ)

### 取り込み path 一覧 (= 稼働中 path だけ)

```
✅ ① monthly_reports
   AMD-Report GAS R313_MonthlyReport_Cron (05:00 daily) → Supabase

✅ ③ MS 進捗 / ⑦ OS 台帳差分 / ⑧ XRL 根拠
   [Codex automation `amd-os-ms`] (= 6h ごと、subscription 内 LLM)
     ↓ outbox JSON
   [~/.codex/automations/amd-os-ms/outbox/]
     ↓ 5 分ごと polling
   [LaunchAgent `jp.teamarmada.amd-os-ms-outbox-applier`]
     ↓ pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir
   [Supabase] (= L2 ③⑦⑧)

✅ ⑨ 経営ハイライト (= L2 ⑨)
   [Codex automation `amd-os`] (= daily 03:20 JST)
     ↓ outbox JSON
   [~/.codex/automations/amd-os/strategy-signals-outbox/]   ← 監視先修復済 2026-05-25
     ↓ 5 分ごと polling
   [LaunchAgent applier (同上)]
     ↓ apply-outbox-dir --dir <そこ>
   [Supabase] (= L2 ⑨)
```

⛔ **②④⑤⑥ には現状 path 無し**。

→ 全責務分担は **[05 章 5.4 責務分担マトリクス](05-decisions-and-history.md#54-codex--claude--vercel--launchagent-責務分担マトリクス)** に正本表あり (= 上記マトリクスとの整合チェックは 5.4 を真とする)

→ 復旧計画は **[`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)** (= Claude routine 4 個新設、まさ案 C 採用 2026-05-25)

→ なぜ 5/22 cron 廃止したかの背景は **[05 章 5.1 cron 廃止経緯](05-decisions-and-history.md#51-cron-廃止経緯)**

---

## 3.2 L2 9 種の正本

| L2 # | テーブル | 用途 | 主な入力ソース | 主な writer | 状態 |
|---|---|---|---|---|---|
| ① | `monthly_reports` | PJ 月次レポート | 5 ソース全部 | AMD-Report GAS `R313_MonthlyReport_Cron` (= 別 clasp、05:00 daily) | ✅ 稼働 |
| ② | `protocols` | AMD プロトコル (= 経営判断の構造化記録) | 議事録の二次集約 | ~~GAS 155~~ ⛔ 5/22 停止 → 🚧 Claude routine `amd-os-protocol-extract` 新設予定 | ⛔ ghost |
| ③ | `milestone_monthly_progress` + 進捗系 | MS 達成度 | 5 ソース + OS snapshot | Codex automation `amd-os-ms` (= 6h ごと、`outbox.revisions`) | ✅ 稼働 |
| ④ | `project_knowledge` | PJ 知識ナレッジ | `monthly_reports` + 議事録 二次集約 | ~~GAS 155~~ ⛔ 5/22 停止 → 🚧 Claude routine `amd-os-project-knowledge-extract` 新設予定 | ⛔ ghost |
| ⑤ | `member_knowledge` | メンバー個人のナレッジ | `member_activities` + 議事録 二次集約 | ~~GAS 155~~ ⛔ 5/22 停止 → 🚧 Claude routine `amd-os-member-knowledge-extract` 新設予定 | ⛔ ghost |
| ⑥ | `project_meeting_summaries` | MTG サマリ (議事録) | Calendar + Notion 議事録 + Slack + Drive Docs + Gmail | ~~GAS 153 (= 毎時 polling)~~ ⛔ 5/22 停止 → 🚧 Claude routine `amd-os-meeting-extract` 新設予定。dialogue (= まさえい手動) は POST `/api/dialogue-meeting` で稼働 | ⛔ ghost (手動 dialogue 投入分を除く) |
| ⑦ | `project_registry_diffs` (= 通知 nudge) | OS 台帳差分 | OS snapshot vs 5 ソース | Codex automation `amd-os-ms` (= `outbox.registryDiffs`) | ✅ 稼働 |
| ⑧ | `project_xrl_evidence` | XRL 根拠 | 5 ソース + OS snapshot | Codex automation `amd-os-ms` (= `outbox.xrlEvidence`) | ✅ 稼働 |
| ⑨ | `project_strategy_signals` | **経営ハイライト** | 5 ソース + OS snapshot | Codex automation `amd-os` (= daily 03:20) + dialogue API (= まさえいMTG)、applier 監視先修復済 2026-05-25 | ✅ 稼働 (修正依頼ループ未実装) |

**📊 別 L2** (= `member_activities`、メンバー活動ログ): `cron/member-weekly-activities` (= LLM 不使用の残存運用 Vercel cron、daily 18:00 JST) で Gmail / Calendar から直接 fetch。これは厳密には L2 ②じゃないが、L2 ⑤ メンバーナレッジの入力ソースとして重要

→ 仕様詳細は [`pwa/design/L2_DATA.md`](../design/L2_DATA.md) (= 古い writer 記述あり、随時訂正中)。
→ ghost 4 種の復旧計画は [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)

---

## 3.3 抽出パイプライン

### Codex automation
- 場所: `~/.codex/automations/{name}/automation.toml`
- 主要 automation:
  - **`amd-os-ms`** (= 6h ごと) — L2 ③ MS 進捗 / L2 ⑦ OS 台帳差分 / L2 ⑧ XRL 根拠を outbox 書き出し。L2 ②④⑤⑥ は生成しない (= 2026-05-25 ghost 化の原因、[05 章 5.7](05-decisions-and-history.md#57-l2-②④⑤⑥-ghost-化と-claude-routine-4-個新設計画--2026-05-25) 参照)
  - **`amd-os`** (= daily 03:20 JST) — L2 ⑨ 経営ハイライト抽出 + outbox 書き出し
  - **`amd-atlas-2`** (= daily 08:10 JST) — 外部マクロ Atlas 抽出
  - **`amd-macrotrend-evidence-review`** (= weekly Mon 07:30) — UN SDGs / WEF Global Risks 整理
- それぞれ outbox に JSON を吐くだけ、Supabase 直接書き込みはしない
- prompt は `automation.toml` 内に記述 (= 将来 DB 化予定、現状は file)

### LaunchAgent applier
- 場所: `~/Library/LaunchAgents/jp.teamarmada.amd-os-ms-outbox-applier.plist`
- 実行スクリプト: `/Users/masa/projects/AMD/amd-os/scripts/run-ms-outbox-applier.sh`
- 5 分ごとに起動
- 監視 dir:
  - `~/.codex/automations/amd-os-ms/outbox/` ✅
  - `~/.codex/automations/amd-os/strategy-signals-outbox/` ✅ (= 2026-05-25 監視先修復済)
  - `~/.codex/automations/amd-atlas/outbox/` ✅
- apply ツール:
  - `pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir [--dir <path>]`
  - `pwa/scripts/atlas_signal_review_tool.mjs apply-outbox-dir`

### Claude routine (= scheduled task)
- 場所: `~/.claude/scheduled-tasks/{name}/SKILL.md`
- 登録: `mcp__scheduled-tasks__create_scheduled_task` (= ローカル時刻で cron 式)
- LaunchAgent と違い、Claude Code app が動いてる時に発火 (= app 閉じてた時は次回起動時に追いつき)
- 主要 routine (= 2026-05-25 時点):
  - ✅ **`amd-os-management-dialogue-prep`** (= daily 07:00 JST) — まさえいMTG 議題プリペア
  - 🚧 **`amd-os-meeting-extract`** (= **毎時 0 分発火 予定**) — L2 ⑥ MTG サマリ抽出、GAS 153 後継
  - 🚧 **`amd-os-protocol-extract`** (= daily 08:00 JST 予定) — L2 ② AMD プロトコル抽出、GAS 155 後継
  - 🚧 **`amd-os-project-knowledge-extract`** (= daily 08:15 JST 予定) — L2 ④ PJ ナレッジ抽出、GAS 155 後継
  - 🚧 **`amd-os-member-knowledge-extract`** (= daily 08:30 JST 予定) — L2 ⑤ メンバーナレッジ抽出、GAS 155 後継
- 各 routine の prompt は [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md) で議論中
- **🚨 重要**: routine 内では Codex automation outbox path を経由せず **直接 Supabase REST に upsert** する設計 (= subscription 帯域節約 + 冪等性は source_hash + 通知連携は `l2_notifications` / `meeting_notifications`)

### PWA cron (= Vercel)
- 場所: `pwa/vercel.json` の `crons` 配列
- 残ってる cron (= LLM 非依存の運用系のみ):
  - `freee-payment-sync` (= 入金同期)
  - `payment-confirm-nudges` (= 入金確認通知)
  - `member-weekly-activities` (= メンバー活動集計、直接 fetch、source_cache に書かず L2 ② に直接書く)
  - `payout-reward-cache-refresh`
  - `papers-quarterly-ingest`
  - `sync-pj-facts`
  - `macro-aggregate-indicators`
- **LLM 課金が発生する定期抽出 cron は全停止** (= `vercel.disabled-crons.json` に退避)

---

## 3.4 つくよみ修正依頼 → 学習ループ

### つくよみとは
- AMD OS 内の LLM 抽出担当キャラ
- 「ばっちこい」のえいみとは別人格 (= おっとり女子、月モチーフ、バッチ型担当)
- 普段「そうかなあ…」「別にいいよお〜」、満月の夜は神モード「人の子よ」

### 修正依頼フロー
```
[まさが cockpit でシグナル / 議事録の誤抽出を見つける]
   │
   │ 「⚠️ つくよみに修正依頼」ボタン → textarea に修正コメント
   │
   ▼
[POST /api/notifications/feedback]
   ├ l2_kind / target_id / scope_key / feedback_text
   ├ Supabase `l2_feedbacks` に INSERT
   └ Supabase `tsukuyomi_learnings` にも INSERT (= 学習リスト)
   │
   ▼
[次回 Codex automation 実行時]
   ├ prompt に「過去の修正依頼」を含める (= `_l2_loadFeedbackBlock_` 相当)
   ├ 抽出結果が改善
   └ `applied_count` を increment
```

### ⚠️ 現状ギャップ (= 2026-05-25 fact 訂正)

**当初の認識** (= 2026-05-24 時点): 「経営ハイライト (= L2 ⑨) だけ修正依頼ループ未実装、他 L2 は GAS 155 / 074 で動いてる」
**実態 (= 2026-05-25 判明)**: **他 L2 (= ②④⑤⑥) も GAS 155 / 153 kill switch で停止しており、修正依頼ループも実は止まってる**。L2 全種で再構築が必要。

| L2 | 修正依頼読込実装 | 現状 |
|---|---|---|
| ② AMD プロトコル | (旧) GAS 155 line 730 で `_l2_loadFeedbackBlock_("protocols", ...)` 実装あり | ⛔ GAS 155 kill switch で動作停止 |
| ④ PJ ナレッジ | (旧) GAS 155 line 523 で同上 | ⛔ 同上 |
| ⑤ メンバーナレッジ | (旧) GAS 155 line 321 で同上 | ⛔ 同上 |
| ⑥ MTG サマリ | (旧) GAS 074 line 1155 で同上 | ⛔ GAS 153 kill switch で動作停止 → GAS 074 helper が呼ばれない |
| ⑨ 経営ハイライト | Codex automation `amd-os` の prompt に未実装 | 抽出は動いてるが修正依頼が反映されない |

### 復旧計画

- **L2 ②④⑤⑥**: 新設 Claude routine 4 個 (= [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)) の prompt に `l2_feedbacks` 読み込み手順を最初から組み込む
- **L2 ⑨ 経営ハイライト**: `amd-os` automation の prompt に `l2_feedbacks` 読み込み手順を追加 (= 別 task)
- **UI 側**: CockpitStrategySignals 等の各 L2 表示部に「過去の修正依頼」セクション追加 (= まさが「形跡が残らない」と気づく問題への対処、別 task)

---

## 3.5 用語と実装の対応 ⭐

**ここは「変数名と UI 表記と実態の食い違い」を必ず参照する場所**。新セッションのえいみも必ず読む。

### foundingProposal / project_founding_members
- **変数名から想像する意味**: 創業メンバーリスト
- **実態**: **関連メンバー全体** (= SU 創業候補 + 事業会社担当 + VC 担当 + 大学 PI + その他関係者すべて)
- LLM が議事録 / Slack から抽出した「PJ に関係する人物全員」
- 「創業メンバー」かどうかはその中の一部にタグが付くだけ
- **マニュアルでは「関連メンバー (= LLM 抽出)」と呼ぶ**
- リネーム候補: `relatedMembersProposal` / `project_related_members` (= 別 task)

### 「メンバー」「創業メンバー」「事業会社」「VC」の使い分け
| UI / コード上の表記 | 実態 | 例 |
|---|---|---|
| 「メンバー」(= cockpit 上のボタン) / `project_members` | **AMD 内部メンバー**で、この PJ に伴走 | PJ を担当する AMD メンバー |
| 「関連メンバー」 (= 上記 foundingProposal の実態) / `project_founding_members` (misleading) | **PJ に関係する人物全員** | SU 創業候補 + 事業会社担当 + VC 担当 + 大学 PI |
| 「事業会社」 (= 🤝 ボタン) / `project_partners` | 興味事業会社 (= 法人レベル) | ファインケム / ダイキアクシス / 三浦工業 |
| 「VC」 / `vcs` テーブル | ベンチャーキャピタル (= 法人レベル) | JAFCO / DG ダイワ |
| 「投資家」 | 個人投資家 + VC 担当者 | (= 個人と法人で別管理) |

### signal_type
| signal_type (= DB 値) | 日本語表記 (= UI 表示) | 該当カテゴリ |
|---|---|---|
| `management_decision` | 方針決定 | 経営全般 |
| `business_progress` | 事業進捗 | 事業開発 |
| `strategic_pivot` | 戦略転換 | 経営全般 |
| `commercial_progress` | 商談/売上 | 事業開発 |
| `partnership` | 提携 | 事業開発 |
| `funding` | 資金 | 経営全般 |
| `ip_regulatory` | 外部規制 (= 他国規制動向 / 競合知財動向) | 外部環境 |
| `tech_progress` | 自社知財/技術 (= 自社特許出願 / 技術スタック進捗) | 技術開発 |
| `risk` | リスク | 外部環境 |
| `next_move` | 次の一手 | 経営全般 (= ただし「未了」系は経営ハイライト対象外、まさ #26 確定) |

### decision_state / status / impact_level / polarity の 4 軸
シグナルカードに表示される情報は紛らわしい (= まさ #29 指摘 2026-05-24)。整理:
| 軸 | 値 | UI 上の見た目 |
|---|---|---|
| **status** | `candidate` / `confirmed` / `rejected` / `archived` | candidate のみ「⚠️ 未確認」注釈、それ以外は表示なし (= まさ #29 整理後) |
| **decision_state** | `observed` / `proposed` / `decided` / `executing` / `revised` | **撤廃予定** (= まさ #26 確定、done のみ書く運用なので不要) |
| **impact_level** | `low` / `medium` / `high` / `critical` | chip 表示 |
| **polarity** (= 新規) | `breakthrough` (🎉) / `forward` (✨) / `pivot` (🔄) / `risk` (⚠️) | カード左端のアイコン (= まさ #29 確定) |

---

## 関連
- 設計議論: [`pwa/design/L2_DATA.md`](../design/L2_DATA.md), [`pwa/design/strategy_signals_redesign.md`](../design/strategy_signals_redesign.md), [`pwa/design/xrl_evidence.md`](../design/xrl_evidence.md)
- 経緯: **[05 章 5.1 cron 廃止経緯](05-decisions-and-history.md#51-cron-廃止経緯)**
