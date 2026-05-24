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

### 取り込み経路 (2026-05-22 以降)

**重要**: Vercel cron は **廃止**。GAS cron も **kill switch + 停止済**。詳細経緯は **[05 章 5.1 cron 廃止経緯](05-decisions-and-history.md#51-cron-廃止経緯)**。

現在の経路:

```
[5 生データソース] (= Slack / Notion / Calendar / Drive / Gmail)
   │
   │ (= 6h ごとに Codex automation `amd-os-ms` が直接 fetch)
   │
   ▼
[Codex automation `amd-os-ms`]
   ├ 5 生データの差分検出
   ├ OS snapshot (= 既存 L2) との突合
   ├ outbox JSON 生成 (= L2 ① ② ③ ⑦ ⑧)
   └ ~/.codex/automations/amd-os-ms/outbox/{timestamp}.json
   │
   ▼
[LaunchAgent `jp.teamarmada.amd-os-ms-outbox-applier`] (= 5 分ごと)
   ├ ~/.codex/automations/amd-os-ms/outbox/ を polling
   ├ ms_progress_review_tool.mjs apply-outbox-dir で Supabase POST
   └ 適用済 outbox を /applied/ に移動
   │
   ▼
[Supabase] (= L2 ① ② ③ ⑦ ⑧)
   │
   ▼
[PWA cockpit] (= まさ / かる / ちこが見る)
```

経営ハイライト (= L2 ⑨) は別経路:
```
[Codex automation `amd-os`] (= daily 03:20 JST)
   ├ 5 生データ + OS snapshot から経営ハイライト candidate 抽出
   └ ~/.codex/automations/amd-os/strategy-signals-outbox/{timestamp}.json
   │
   ▼
[(本来は LaunchAgent applier が拾うべきだが、現在 dir 不整合あり)]
   ⚠️ 監視先 = ~/.codex/automations/amd-os-strategy-signals/outbox/ (= 空)
   ⚠️ 出力先 = ~/.codex/automations/amd-os/strategy-signals-outbox/  (= 実際の場所)
   ⚠️ → 手動 apply 必要 (別 task で修復予定)
```

→ 全責務分担は **[05 章 5.4 責務分担マトリクス](05-decisions-and-history.md#54-codex--claude--vercel--launchagent-責務分担マトリクス)**

---

## 3.2 L2 9 種の正本

| L2 # | テーブル | 用途 | 主な入力ソース | 主な writer |
|---|---|---|---|---|
| ① | `monthly_reports` | PJ 月次レポート | 5 ソース全部 | `amd-os-ms` |
| ② | `member_activities` | メンバー活動ログ | Gmail / Calendar 直接 fetch | `cron/member-weekly-activities` (= 残存運用系) |
| ③ | `project_milestones` + 進捗系 | MS 達成度 | 5 ソース | `amd-os-ms` |
| ④ | `project_knowledge` | PJ 知識ナレッジ | 議事録 / Slack 長文 | `amd-os-ms` (= 旧 GAS 155 から移管) |
| ⑤ | `member_knowledge` | メンバー個人のナレッジ | Gmail / Slack | `amd-os-ms` |
| ⑥ | `project_meeting_summaries` | MTG サマリ | Calendar + Drive 議事録 + Notion + dialogue API | GAS 153 (= 毎時 polling) + `amd-os-ms` |
| ⑦ | `os_ledger_diffs` (= 通知 nudge) | OS 台帳差分 | OS snapshot vs 5 ソース | `amd-os-ms` |
| ⑧ | `project_xrl_evidence` | XRL 根拠 | 5 ソース + OS snapshot | `amd-os-ms` (= 旧 `ms_progress_review_tool.mjs upsertXrlEvidence`) |
| ⑨ | `project_strategy_signals` | **経営ハイライト** | 5 ソース + OS snapshot | `amd-os` (= daily 03:20) + dialogue API (= まさえいMTG) |

→ 仕様詳細は [`pwa/design/L2_DATA.md`](../design/L2_DATA.md)。

---

## 3.3 抽出パイプライン

### Codex automation
- 場所: `~/.codex/automations/{name}/automation.toml`
- 主要 automation:
  - **`amd-os-ms`** (= 6h ごと) — L2 ② ③ ④ ⑤ ⑦ ⑧ 抽出 + outbox 書き出し
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
  - `~/.codex/automations/amd-os-strategy-signals/outbox/` ⚠️ (空、実際の出力は `amd-os/strategy-signals-outbox/`)
  - `~/.codex/automations/amd-atlas/outbox/` ✅
- apply ツール:
  - `pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir [--dir <path>]`
  - `pwa/scripts/atlas_signal_review_tool.mjs apply-outbox-dir`

### Claude routine (= scheduled task)
- 場所: `~/.claude/scheduled-tasks/{name}/SKILL.md`
- 主要 routine:
  - **`amd-os-management-dialogue-prep`** (= daily 07:00 JST) — まさえいMTG 議題プリペア (= 全 active PJ + p00 を横断 read → `project_strategy_signals` candidate 積み)

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

### ⚠️ 現状ギャップ (= 2026-05-24 確認)
- `l2_kind='project_strategy_signal'` (= 経営ハイライト) の修正依頼は **保存はされるが、Codex automation 側で読み込み未実装**
- 結果: まさが投げた修正依頼が反映されない、形跡も UI 上で見えない
- 対応: 
  1. 短期 (= UI 改修): `CockpitStrategySignals.tsx` の各シグナル下に「過去の修正依頼」セクションを追加して `l2_feedbacks` を表示
  2. 中期 (= automation 改修): `amd-os` automation の prompt に過去 feedback を含める実装追加 + `applied_count` 更新

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
| 「メンバー」(= cockpit 上のボタン) / `project_members` | **AMD 内部メンバー**で、この PJ に伴走 | まさ / かる / ちこ |
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
