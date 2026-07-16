# Venture Status / Narrative / PL / XRL 仕様

`project_ventures` を中心とした SU の事業概要 / 沿革 narrative / PL hearing / XRL 修正導線。 PJ コックピットの「事業概要」 panel + Venture Map と接続。 関連メンバー側は [4-4 章](4-4-frl-related-members-score-spec.md)。

## `project_ventures` (= SU 1 行マスタ)

| column | 用途 |
|---|---|
| `project_id` | PK (= `projects.project_id` と一致) |
| `lane` | text (= 旧 1 lane 指定、 後方互換) |
| `lanes` | jsonb (= ASPI 8 domain weighted、 現行) |
| `founded_at` | 設立日 (= NULL なら pre-founding) |
| `outcome_pattern` | `planning` / `rocket` (= 成功卒業) / `ue_fail` (= 失敗) / `burnout` 等 |
| `origin_org` | 起源機関 (= 大学 / 国研) |
| `origin_pi` | 起源 PI |
| `amd_role` | AMD の役割 text |
| `short_description` | 1 行説明 |
| `long_description` | 詳細説明 |
| `short_label` | 補助ラベル (= UI の短縮表示用。PJ名の正本は常に `projects.project_name`) |
| `is_public` | 公開可否 |
| `amd_support_started_at` / `amd_support_ended_at` | AMD 伴走期間 (= ended が set されたら卒業) |
| `narrative_text` | 沿革 narrative (= LLM 生成 Markdown) |
| `narrative_generated_at` | 直近 narrate 時刻 |
| `narrative_invalidated_at` | 無効化時刻 (= 次回 narrate 必要 marker) |
| `master_md_text` | SU master document の Markdown |
| `master_md_slug` | master_md の slug |
| `master_md_updated_at` | master_md 更新時刻 |

### outcome_pattern

| value | 意味 |
|---|---|
| `planning` | 進行中 (= まだ卒業 / 失敗してない) |
| `rocket` | 成功卒業 (= AMD 育てたあと scale 達成、 [4-6 章 卒業フェーズ検出](4-6-graduation-detection-spec.md)) |
| `ue_fail` | 失敗卒業 |
| `burnout` | 燃え尽きフェード |
| `pivot` | 大きく方向転換した (= 履歴として残す) |

## 沿革 narrative (= `narrative_text`)

各 SU の「設立から現在までの大きな流れ」を LLM が生成する Markdown narrative。

### narrate API

`POST /api/venture/narrate` (= admin / project member 経由):

- 入力: `project_id` + 関連データ (= monthly_reports / project_meeting_summaries / xrl_log / strategy_signals)
- 処理: Sonnet 4.6 が「設立 → ピボット → 試験販売 → 提携 → 卒業」の流れを Markdown narrative に
- 出力: `project_ventures.narrative_text` を更新、 `narrative_generated_at` set
- 副作用: `narrative_feedbacks` の active feedback を prompt 注入 (= 修正依頼が次回反映される)

### 無効化と再生成

新しい大きなイベント (= 経営ハイライト確定 / monthly report 確定 等) が起きると、 cron / API が `narrative_invalidated_at` を set。 次回 admin が cockpit を開いた時に「narrative が古い、 再生成しますか?」ボタンが出る。

### narrative_feedbacks (= 修正依頼)

`narrative_feedbacks` 列:

| column | 用途 |
|---|---|
| `project_id` | 対象 SU |
| `feedback_text` | 修正依頼 (= 「2024 年の PJ pivot を入れて」 等) |
| `status` | `active` (= 次回 narrate 時に prompt 注入) / `archived` |
| `applied_count` | 反映回数 |

## PL hearing (= `project_pl_hearings`)

SU の事業計画 (= PL) を構造化抽出する loop。 Q&A 形式でつくよみが聞いて、 答えから PL を組み上げる。

### `project_pl_hearings` 列

| column | 用途 |
|---|---|
| `id` | UUID PK |
| `project_id` | 対象 SU |
| `q_a` | jsonb (= `[{ q, a, kind, ... }]` 配列) |
| `status` | `in_progress` / `completed` / `archived` |
| `generated_pl` | jsonb (= 完成版 PL 数値、 5 ヶ年売上 / 経費 / 営業利益 等) |

### PL Q&A の流れ

1. つくよみが質問 (= 「初年度の想定顧客数は?」「顧客単価は?」「営業 cost の前提は?」)
2. PI / CEO 候補が回答
3. つくよみが回答から仮 PL を組み立て、 さらに追質問
4. 5 ヶ年 PL が固まったら `generated_pl` に保存、 `status='completed'`

`generated_pl` JSON schema (= 概略):

```json
{
  "years": [
    {
      "year": 1,
      "revenue_yen": 50000000,
      "cogs_yen": 20000000,
      "personnel_yen": 25000000,
      "rd_yen": 10000000,
      "marketing_yen": 5000000,
      "other_opex_yen": 3000000,
      "operating_profit_yen": -13000000
    },
    ...
  ],
  "assumptions": {...}
}
```

## `project_pl_monthly` (= 月次 PL)

実績ベースの per-month PL (= optional)。 `project_pl_hearings.generated_pl` が将来計画、 こちらは実績 / 見込みの月次ブレイクダウン。

| column | 用途 |
|---|---|
| `project_id` / `ym` | UNIQUE |
| `revenue_yen` | 売上 |
| `cogs_yen` | 売上原価 |
| `personnel_yen` | 人件費 |
| `rd_yen` | 研究開発費 |
| `marketing_yen` | マーケ費 |
| `other_opex_yen` | その他 opex |
| `notes` | 自由記述 |

設計議論: [`pwa/design/project_pl_monthly.md`](../design/project_pl_monthly.md)。 生データから未来予測抽出方針、 優先度は低めだが finance simulation との接続候補。

## XRL 修正導線 (= `project_xrl_log` + `project_xrl_evidence` + `xrl_feedbacks`)

XRL (= TRL/BRL/GRL/SRL/HRL) の評価値とその根拠を時系列で残す。

### `project_xrl_log` 列

| column | 用途 |
|---|---|
| `project_id` / `observed_at` | 観測点 |
| `trl` / `brl` / `hrl` / `grl` / `srl` | 5 軸 0-9 |
| `bottleneck` | ボトルネック軸 (= 律速判定、 `argmax α_i/(X_i+1)`) |
| `milestone_label` | 紐付け MS |
| `source_note` | 出典メモ |
| `source` | `manual` / `automation` / `tsukuyomi` |

### `project_xrl_evidence` (= M-2 根拠)

| column | 用途 |
|---|---|
| `evidence_id` | UUID PK |
| `project_id` / `ym` / `scope_key` | 対象 |
| `axis` | `trl` / `brl` / `grl` / `srl` / `hrl` |
| `evidence_kind` | `founding_member` / `technical_validation` / `customer_signal` / `grant_signal` / `governance_signal` / `stakeholder_signal` / `team_signal` / `other` |
| `summary` | 根拠要約 |
| `structured_value_json` | 構造化値 |
| `source_refs_json` | 5 生データ refs (= source id / date / snippet / hash) |
| `source_hash` | 冪等性 |
| `confidence` | 0-1 |
| `status` | `candidate` (= 通知未確認) → `confirmed` / `rejected` / `archived` |
| `created_by` | `automation` / `codex` / `manual` |
| `confirmed_at` | 確認時刻 |

抽出は Codex automation `amd-os-ms` + SKILL `amd-os-l8-xrl-evidence-extract` (= 6h ごと、 [8-3 章 §M-2](8-3-l2-extraction-routines-spec.md))。入力: 5 生データ + 既存 L2 (= monthly_reports / meeting_summaries / member_knowledge 等)。

### `xrl_feedbacks` 列 (= 修正依頼)

| column | 用途 |
|---|---|
| `project_id` | 対象 |
| `xrl_log_id` | 対象 `project_xrl_log` 行 |
| `axis` | 修正対象軸 |
| `feedback` | 修正依頼本文 |
| `status` | `open` / `applied` / `archived` |
| `applied_at` / `applied_note` | 反映情報 |

## 画面構成

| URL | 役割 |
|---|---|
| `/project/[projectId]/cockpit` | コックピット (= 事業概要 + MS + 経営ハイライト + XRL) |
| `/project/[projectId]/cockpit` 内 Venture Status panel | `project_ventures` 表示 + narrative 表示 / 再生成ボタン |
| `/project/[projectId]/cockpit` 内 XRL panel | `project_xrl_log` の最新値 + 各軸の `project_xrl_evidence` drilldown |
| `/project/[projectId]/cockpit` 内 PL panel | `project_pl_hearings` の Q&A 履歴 + `generated_pl` の 5 ヶ年表示 |
| `/venture-map` | 全 SU 一覧 + マクロトレンド地図 ([5-2 章](5-2-hud-and-venture-map-spec.md)) |

### Venture Status panel UI

- SU 表示名 / lane chip / outcome_pattern badge
- `narrative_text` (= 折りたたみ / 展開)
- 「narrative を再生成」ボタン (= `narrative_invalidated_at` set されてるとき active)
- 関連メンバー (= `project_founding_members` / `project_venture_members`) リンク

### XRL panel UI

- 5 軸 (= TRL/BRL/GRL/SRL/HRL) の最新値 + 評価日
- bottleneck 軸の赤ハイライト
- 各軸クリックで `project_xrl_evidence` drilldown (= summary / structured_value / source refs)
- 「修正依頼」ボタン → つくよみ chat / `xrl_feedbacks` insert

## narrative 自動 invalidate トリガ

以下のイベントで `narrative_invalidated_at = now()` set:

- 新しい `project_strategy_signals` が `status='confirmed'` で確定
- 大きな `monthly_reports.status='final'` 確定 (= 月次節目)
- `project_ventures.outcome_pattern` 変化 (= 卒業 / 失敗判定)
- `project_xrl_log` の bottleneck 軸変化
- `project_pl_hearings.status='completed'` 確定

invalidate されたら、 admin が cockpit を開いた時に「narrative が古い、 再生成しますか?」 cta が出る。

## 卒業フェーズとの接続

`project_ventures.amd_support_ended_at IS NOT NULL AND outcome_pattern='rocket'` が成功卒業判定。 [4-6 章 卒業フェーズ検出](4-6-graduation-detection-spec.md) の最終出口。 詳細は [29.6 戦略接近度 graduation_score](4-5-management-score-and-finance-simulation-spec.md#戦略接近度--v4--6-入力) で AMD Management Score (= バイタルサイン) にも貢献する。

## トラブル時

| 症状 | 確認場所 |
|---|---|
| narrative が古いまま | `narrative_invalidated_at` の有無、 `/api/venture/narrate` 実行履歴 |
| XRL panel が空 | `project_xrl_log` の最新行、 `project_xrl_evidence.status='confirmed'` の有無 |
| PL hearing Q&A が止まる | `project_pl_hearings.status='in_progress'`、 つくよみ chat session 接続 |
| outcome_pattern 不一致 | `project_ventures.amd_support_ended_at` と `outcome_pattern` の整合性 |
| 関連メンバーが出ない | `project_founding_members.category` フィルタ (= `('amd','startup','university')` のみ表示)、 [4-4 章](4-4-frl-related-members-score-spec.md) |

## 関連

- 設計: [`pwa/design/venture_map_model.md`](../design/venture_map_model.md) (= Venture Map 数理モデル)
- 設計: [`pwa/design/xrl_evidence.md`](../design/xrl_evidence.md) (= M-2 設計)
- 設計: [`pwa/design/project_pl_monthly.md`](../design/project_pl_monthly.md) (= 月次 PL)
- 4-3 章 [AMD Score 詳細仕様](4-3-amd-score-spec.md)
- 5-2 章 [HUD / Venture Map 仕様](5-2-hud-and-venture-map-spec.md)
- 4-4 章 [FRL / HRL / 関連メンバー詳細仕様](4-4-frl-related-members-score-spec.md)
- 8-3 章 [L2 Extraction Routines](8-3-l2-extraction-routines-spec.md) (= M-2 XRL 根拠抽出)
- 4-6 章 [卒業フェーズ検出](4-6-graduation-detection-spec.md) (= rocket 卒業の確定 path)
- 4-5 章 [Management Score](4-5-management-score-and-finance-simulation-spec.md) (= graduation_score 接続)
