# FRL / HRL / 関連メンバー 詳細仕様

AMD Score 7 軸のうち **FRL (= Founding Readiness)** と **HRL (= Human Resources Readiness)** に紐づく「人」評価軸と、 PJ に関わる **関連メンバー** (= `project_founding_members` / `project_venture_members`) のモデル正本。 AMD Score 全体は [21 章](21-amd-score-spec.md) を見る。

## FRL (= Founding Readiness Level)

CEO リーダーシップ readiness。 AMD Score 7 軸の最重要 (= α_F=1.5)。 「マクロトレンドに乗っていて、 会社 XRL が整っていても、 CEO の質が低ければ Scale しない」 (= Bernstein 2017 JF: Founder Quality が VC 意思決定の最大因子)。

### FRL 6 因子拡張 (= 2026-05-09 確定)

旧: ALQ 4 次元のみで FRL 算出。 新: **ALQ 4 + Grit + Resilience** の 6 因子で算出。

```text
FRL = 0.6 × ALQ_4_avg + 0.2 × Grit + 0.2 × Resilience
```

### 6 因子と学術根拠

| 因子 | 列名 | 学術根拠 |
|---|---|---|
| ① 自己認識 | `alq_self_awareness` | Walumbwa 2008 JoM (Authentic Leadership Questionnaire) |
| ② 関係的透明性 | `alq_relational_transparency` | 同上 |
| ③ バランス情報処理 | `alq_balanced_processing` | 同上 |
| ④ 内在化道徳 | `alq_internalized_moral` | 同上 |
| ⑤ Grit | `frl_grit` | Duckworth 2007 JPSP (Grit Scale, 長期目標への粘り強さ) |
| ⑥ Resilience | `frl_resilience` | Markman 2005 JOB (起業家における Resilience) |

各因子は 0-9 の連続値。 補助で `frl_notes` (= text) に自由記述の根拠。

### FRL 学術定義からの不足要素 (= 運用上の妥協)

完全な FRL 評価には以下も必要だが、 現状 6 因子で運用:

1. Cognitive Reframing 能力 (= 危機解釈の柔軟性)
2. Vision Articulation の明確度
3. Stakeholder Theory ベースの利害調整能力
4. Risk-Bearing Preference (= Cantillon 1755 起源)
5. Psychological Safety への寄与 (= Edmondson 1999 ASQ、 HRL とも一部重なる)
6. Network Centrality (= Hsu 2007 RP)
7. Founder Network 効果 (= 魅力的 CEO が技術/人材/資金を引き上げる間接効果、 FRL × 他軸交差項)

これらは現状 `frl_notes` に自由記述 + Tsukuyomi 対話で補強する運用。

## HRL (= Human Resources Readiness Level)

組織人材 readiness。 AMD Score では α_H=1.1 (= XRL 5 軸の中で 2 番目に重い、 TRL=1.0 / BRL=0.6 / GRL=0.3 / SRL=0.2)。 根拠: 内閣府 SIP「HRL > TRL/BRL」。

### HRL 1-9 段階定義

| level | 意味 |
|---|---|
| 1-3 | 創業期 1-3 名 |
| 4-6 | コア機能カバー (= CEO + CTO + CXO 等) |
| 7-9 | 複数階層 + 後継 plan |

実装: `src/lib/xrl-level-definitions.ts` に内閣府 SIP「サーキュラーエコノミーシステム構築」2023 公募要領 PDF p11-15 互換の 9 段階定義を全 5 XRL 軸で網羅。

## `amd_score_inputs` の FRL 関連列

| column | 用途 |
|---|---|
| `frl` | FRL 合成スコア (= 0-9、 6 因子の重み付け平均 or 直接入力) |
| `alq_self_awareness` / `_relational_transparency` / `_balanced_processing` / `_internalized_moral` | ALQ 4 次元 |
| `frl_grit` | Grit 次元 |
| `frl_resilience` | Resilience 次元 |
| `frl_notes` | 自由記述根拠 |
| `mu_notes` | JSONB `{a, b, g}` (= Triple Helix μ_A/I/G の評価根拠) |
| `xrl_notes` | JSONB `{trl, brl, grl, srl, hrl}` (= 5 XRL の評価根拠) |

### 各軸の評価根拠 (= notes) 運用

- 入力: `AmdScoreView.tsx` の `AxisSliderWithNote` で各軸スライダーの直下に textarea
- 読み取り: `Factor3Breakdown` 内の 3 要素カードで各軸ラベル直下に italic で根拠表示
- Cockpit モーダル: `CockpitAmdScoreBreakdownModal.tsx` の `FactorRow.subtitle`
- Tsukuyomi 統合: `update_amd_score_input` tool に `mu_notes_a/i/g`, `xrl_notes_trl/brl/grl/srl/hrl` パラメータ追加、 LLM が **値だけでなく必ず根拠も書く** 運用

## 関連メンバー (= `project_founding_members` / `project_venture_members`)

PJ に関わる人物のマスタ 2 表。 用途が違う:

| table | 用途 |
|---|---|
| `project_founding_members` | 創業候補メンバーの候補リスト (= L2 ⑦ OS 台帳差分 / L2 ⑧ XRL 根拠抽出の対象、 PI + AMD + VC + 顧客 + 行政 すべて) |
| `project_venture_members` | SU 実体の役員 / 従業員リスト (= 起業後の実体メンバー、 SU 法人台帳) |

### `project_founding_members` 列

| column | 用途 |
|---|---|
| `project_id` / `person_name` | UNIQUE |
| `affiliation` | 所属 (= 大学名 / 会社名 / 役所名) |
| `role` | text |
| `role_label_jp` | 表示 label |
| `category` | `amd` / `startup` / `university` / `vc` / `customer` / `government` / `unknown` |
| `responsibility` | 担当領域 |
| `contribution` | これまでの貢献 |
| `notes` | 自由メモ |
| `status` | `active` (= 採用) / `tentative` (= 候補、 通知未確認) / `invalid` (= 却下) |
| `extracted_by` | `llm` / `manual` |
| `source_documents` | JSONB (= 元データ refs) |
| `first_observed_at` / `last_observed_at` | 観測期間 |

### HRL 算定対象 (= まさ #過去 確定)

`project_founding_members.category IN ('amd', 'startup', 'university')` のみが HRL 算定対象。 `vc` / `customer` / `government` は **invalid** 扱い (= 創業メンバーとカウントしない)。 これは L2 ⑧ XRL 根拠抽出の prompt にも書かれてる: 「VC/顧客/行政は HRL 関連メンバーとして無効」 ([38 章 §⑧](38-l2-extraction-routines-spec.md))。

### `project_venture_members` 列 (= SU 法人台帳)

| column | 用途 |
|---|---|
| `project_id` / `full_name` | 紐付け |
| `role` | 役職 |
| `started_at` / `ended_at` | 期間 |
| `note` | 自由メモ |
| `member_kind` | `su_internal` (= SU 内部メンバー) / `amd_internal` (= AMD 兼任) 等 |
| `amd_member_id` | AMD 兼任の場合の `members.member_id` 参照 |

`project_founding_members` (= 候補リスト、 多くは未確定) と `project_venture_members` (= 起業後の実体、 法人台帳) は意図的に別表。 創業前の「候補」状態と、 起業後の「実メンバー」を混ぜない。

## 修正依頼 loop (= score_revision_feedback_loop)

AMD Score の各軸 (= TRL/BRL/GRL/SRL/HRL/FRL/μ) の値を誰かが「違うよ」と修正依頼を投げる loop。 `amd_score_revisions` テーブルに履歴を残す。

### `amd_score_revisions` 列

| column | 用途 |
|---|---|
| `revision_id` | UUID PK |
| `project_id` / `score_input_id` | 対象 |
| `axis` | `trl` / `brl` / `frl` / `hrl` 等 |
| `old_value` / `new_value` | 変更内容 |
| `evaluated_at` | 評価日 |
| `reason_md` / `discussion_md` | 修正理由 + 議論内容 |
| `revised_by` | 修正者 |
| `applied_to_alpha` | α 重み再推定に反映済か |
| `alpha_proposal_id` | 関連 `amd_score_alpha_proposals` |
| `source` | `manual` / `tsukuyomi` 等 |
| `status` | `active` / `archived` |
| `confidence` | 0-1 |

### α 重み再推定との接続

複数の `amd_score_revisions` が `applied_to_alpha=false` で蓄積されると、 `amd_score_alpha_proposals` に「α を 〜 に変えるべき」候補が提案される。 まさ承認で `amd_score_alpha` に新 row が insert され、 古い α は `effective_to` でクローズ。

詳細は [`pwa/design/score_revision_feedback_loop.md`](../design/score_revision_feedback_loop.md)。

## SU 知識昇格 loop (= su_knowledge_promotion_loop)

`project_founding_members` の status 遷移 (= `tentative` → `active`) と、 `project_knowledge` への昇格 (= `category='members'` 等) の loop。

```text
通知 (l2_kind='founding_members')
   ↓
status='tentative' で保存
   ↓
まさ "はい" → status='active', project_knowledge に member 知識として昇格 (= active)
まさ "いいえ" → status='invalid'
```

詳細は [`pwa/design/su_knowledge_promotion_loop.md`](../design/su_knowledge_promotion_loop.md)。

## 画面

| URL | 役割 |
|---|---|
| `/venture-map/amd-score` | 全 SU PJ の AMD Score 一覧 (= score 降順 / phase filter) |
| `/venture-map/amd-score/[projectId]` | 個別 PJ の AMD Score 詳細 + FRL 6 因子 panel + 関連メンバー一覧 + score 経時 |
| `/project/[projectId]/cockpit` | cockpit 内に AMD Score chip + breakdown modal (= 3 要素 M × X × F カード) |

詳細 page の `FrlAlqPanel` は FRL 6 因子表示 + ALQ radar (= 各因子クリックで Tsukuyomi 起動)。

## トラブル時

| 症状 | 確認場所 |
|---|---|
| FRL スコアが極端に低い | ALQ 4 + Grit + Resilience の値、 `frl_grit` / `frl_resilience` が NULL なら 0 扱いで合成が下がる |
| HRL が想定と違う | `project_founding_members.category` 別件数、 `category IN ('amd','startup','university')` で絞ったあとの人数 / 階層 |
| 関連メンバーの抽出に VC / 顧客が混じる | L2 ⑧ XRL 根拠抽出 prompt の「VC/顧客/行政無効」ルール、 [38 章](38-l2-extraction-routines-spec.md) を確認 |
| 修正依頼が反映されない | `amd_score_revisions.status='active'`、 `applied_to_alpha` が false でも `amd_score_inputs.frl` 自体は更新されるか |
| 評価根拠 (notes) が表示されない | `mu_notes` / `xrl_notes` / `frl_notes` の値、 `AxisSliderWithNote` の textarea 連携 |

## 関連

- 21 章 [AMD Score 詳細仕様](21-amd-score-spec.md) (= 7 軸全体)
- 設計: [`pwa/design/amd_score.md`](../design/amd_score.md) (= Before Zero Theory v3.2)
- 設計: [`pwa/design/score_revision_feedback_loop.md`](../design/score_revision_feedback_loop.md) (= 修正依頼 loop)
- 設計: [`pwa/design/su_knowledge_promotion_loop.md`](../design/su_knowledge_promotion_loop.md) (= founding_members 昇格)
- 理論層: `before-zero/theory/amd_score.md` (= 学術根拠)
- 38 章 [L2 Extraction Routines](38-l2-extraction-routines-spec.md) (= ⑧ XRL 根拠抽出での member 評価)
- 37 章 [Venture Status / Narrative / PL / XRL](37-venture-status-narrative-pl-xrl-spec.md) (= venture members 側)
- 39 章 [卒業フェーズ検出](39-graduation-detection-spec.md) (= 関連メンバー成熟度との接続)
