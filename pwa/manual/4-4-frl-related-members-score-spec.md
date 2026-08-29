# FRL / HRL / 関連メンバー 詳細仕様

AMD Score の現行 primary は SPS (`M x P x R x S`)。この章は、そのうち **S (Survival)** の根拠になる **FRL (= Founding Readiness)** と、**R (Reach / Readiness)** の一部になる **HRL (= Human Resources Readiness)**、さらに PJ に関わる **関連メンバー** (= `project_founding_members` / `project_venture_members`) の見方を扱う。legacy 7 軸モデルでは FRL / HRL は M-X-F comparison の F / X に対応するが、現行主表示は SPS として読む。AMD Score 全体は [4-3 章](4-3-amd-score-spec.md) を見る。FRL の実装仕様・DB列・関数契約は [/spec/4-1-frl-ces-current-spec](/spec/4-1-frl-ces-current-spec)、理論導出は [/bzm/4-1-frl-founder-readiness](/bzm/4-1-frl-founder-readiness) が正本。

## FRL (= Founder Readiness Level)

CEO リーダーシップ readiness。SPS primary では **S (生存力) の一因子** (= 創業者の調達/自走力)。legacy 7 軸 comparison では最重要軸 (= α_F=1.5) として残る。「マクロトレンドに乗っていて、会社 XRL が整っていても、CEO の質が低ければ Scale しない」 (= Bernstein 2017 JF: Founder Quality が VC 意思決定の最大因子)。

### FRL 2 レイヤー構造 (= 2026-05-30 確定、CES 補完合成)

旧: 6 因子 (ALQ4 + Grit + Resilience) フラット平均で FRL 算出。 新: FRL を **委譲可能性で 2 レイヤーに分離**し、 **CES (補完性)** で合成する。

$$
\mathrm{FRL}_{\mathrm{final}}+1
=
\left(
a(F_{\mathrm{char}}+1)^\rho
+(1-a)(F_{\mathrm{cap}}+1)^\rho
\right)^{1/\rho},
\qquad \rho<0
$$

$$
F_{\mathrm{char}}
=0.6\cdot\overline{\mathrm{ALQ}_4}
+0.2\cdot\mathrm{Grit}
+0.2\cdot\mathrm{Resilience}
$$

$$
F_{\mathrm{cap}}
= \mathrm{best\ of}(\mathrm{経営実行力};\ \mathrm{active\ members})
$$

初期: `a=0.6`, `rho=-2`, `alpha_F=1.5` 据置 (= retrofit で校正)。

- **F_character (資質)**: CEO 固有・委譲不可。 旧 6 因子をそのまま使う。
- **F_capability (経営実行力)**: 経験 ≫ 知識 (IPO/Exit > 調達リード > PL責任運営 > 同業界 ≫ MBA/知識)。 COO/CFO・**AMD メンバー**で補完できる。
- **CES (ρ<0)**: 「**どちらの F も一定以下なら成立しない、 一定水準以下で全体が大きく下がる**」(= まさ確定 2026-05-30) を表現。 Cobb-Douglas の +1 シフト (代替的) では作れない補完性を CES ρ<0 で表す。 ρ→0 で Cobb-Douglas (甘い)、 ρ→-∞ で min (完全ゲート)、 初期 ρ=-2 は中庸。

> ⚠️ **S 全体は Cobb-Douglas (代替的)、 FRL 内部だけ CES (補完的)** の二層。 S 内の σ_SU・R_net・FRL は「どれか強ければ補える」代替関係、 FRL 内の char・cap は「両方必要」補完関係。 モデル正本: `knowledge/before_zero_theory.md`「FRL を F_char × F_cap に分離」セクション。 教科書: `pwa/bzm/4-1-frl-founder-readiness.md` §4。

### F_character 6 因子と学術根拠

| 因子 | 列名 | 学術根拠 |
|---|---|---|
| M-1 自己認識 | `alq_self_awareness` | Walumbwa 2008 JoM (Authentic Leadership Questionnaire) |
| D-1 関係的透明性 | `alq_relational_transparency` | 同上 |
| D-2 バランス情報処理 | `alq_balanced_processing` | 同上 |
| D-3 内在化道徳 | `alq_internalized_moral` | 同上 |
| D-4 Grit | `frl_grit` | Duckworth 2007 JPSP (Grit Scale, 長期目標への粘り強さ) |
| H-1 Resilience | `frl_resilience` | Markman 2005 JOB (起業家における Resilience) |

各因子は 0-9 の連続値。 補助で `frl_notes` (= text) に自由記述の根拠。

### F_capability の算定 (= 経験 ≫ 知識、 AMD 価値の定量化)

経営実行力を 0-9 で評価。 **チームの経営中核メンバーの best-of** (= active + コミット度重み付け)。 CEO 一人に閉じない (= まさ「COO が IPO 経験者なら成り立つ」を表現)。

$$
F_{\mathrm{cap}}
= \mathrm{best\ of}(\mathrm{経営実行力};\ status=\mathrm{active},\ \mathrm{commitment})
$$

$$
\mathrm{AMD\ value}
= F_{\mathrm{cap}}(\mathrm{全員})
- F_{\mathrm{cap}}(\mathrm{AMD\ 除く})
$$

- **経験 ≫ 知識** (Hsu 2007 RP / Unger 2011 JBV: 経験的 human capital が知識的より成果相関強い)。 MBA/体系知識は「事故を減らす下方リスク低減」として軽く効かせる (ゼロにはしない)。
- **AMD 価値の定量化**: `F_cap_amd` で「AMD が入って経営 readiness を X→Y に上げた」分を PJ ごと・経時で追える。 LP 報告・営業資料に使える。
- **名義貸し対策**: 社外取・名義だけアドバイザーで釣り上げない。 `status='active'` + フルタイム的役割 (実意思決定権) で重み付け。 rubric は「IPO 経験者が *経営中核に* いる」のように役割の実質を観測項目にする。
- **HRL と算定対象が違う**: HRL は `category IN ('amd','startup','university')` で **vc 除外**。 F_cap は逆に **VC 出身者・シリアルアントレこそ中核** (経営実行力の源泉) として算入。

### 運用 (= えいみ初期投入 → まさ修正)

F_cap の 0-9 は **えいみが推測で初期投入 → まさが画面で修正** (= XRL チェックリストと同運用、 Tsukuyomi 不使用)。 データ源: `project_founding_members` (status='active') + `knowledge/{pj}.md` + L2 + Web。 rubric は `knowledge/xrl_rubric.md` の F_cap セクション。 OS 原則「初手手動入力はしない、 えいみが生データから推測」(= memory `feedback_tsukuyomi_builds_from_raw_data`) に従う。

### FRL 学術定義からの不足要素 (= 運用上の妥協)

完全な FRL 評価には以下も必要だが、 現状の F_char 6 因子 + F_cap で運用:

1. Cognitive Reframing 能力 (= 危機解釈の柔軟性)
2. Vision Articulation の明確度
3. Stakeholder Theory ベースの利害調整能力
4. Risk-Bearing Preference (= Cantillon 1755 起源)
5. Psychological Safety への寄与 (= Edmondson 1999 ASQ、 HRL とも一部重なる)
6. Network Centrality (= Hsu 2007 RP)
7. Founder Network 効果 (= 魅力的 CEO が技術/人材/資金を引き上げる間接効果、 FRL × 他軸交差項)
8. F_cap の経験データの一次ソース検証 (= IPO/調達/Exit 実績の裏取り、 入力精度に直結)

これらは現状 `frl_notes` に自由記述 + Tsukuyomi 対話で補強する運用。

## HRL (= Human Resources Readiness Level)

組織人材 readiness。SPS primary では **R (Reach / Readiness)** を構成する XRL の一部。legacy comparison では α_H=1.1 (= XRL 5 軸の中で 2 番目に重い、TRL=1.0 / BRL=0.6 / GRL=0.3 / SRL=0.2)。根拠: 内閣府 SIP「HRL > TRL/BRL」。

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
| `frl` | F_character (= 旧 FRL 0-9)。`frl_cap` が NULL の行では後方互換で最終 FRL として扱う |
| `alq_self_awareness` / `_relational_transparency` / `_balanced_processing` / `_internalized_moral` | ALQ 4 次元 (= F_character 構成) |
| `frl_grit` | Grit 次元 (= F_character 構成) |
| `frl_resilience` | Resilience 次元 (= F_character 構成) |
| `frl_cap` ⭐ | F_capability (= 経営実行力 0-9、 チーム best-of)。 migration 110 で実装済 |
| `frl_cap_amd` ⭐ | F_capability のうち AMD メンバー寄与分 (= AMD 価値定量化用)。 migration 110 で実装済。active/current 4 PJ は migration 111 で first pass backfill 済 |
| `frl_cap_notes` ⭐ | F_capability / AMD 寄与の根拠 |
| `frl_ces_a` / `frl_ces_rho` ⭐ | CES パラメータ (= 初期 a=0.6 / ρ=-2、 retrofit 校正)。 migration 110 で実装済 |
| `frl_notes` | 自由記述根拠 |
| `mu_notes` | JSONB `{a, b, g}` (= Triple Helix μ_A/I/G の評価根拠) |
| `xrl_notes` | JSONB `{trl, brl, grl, srl, hrl}` (= 5 XRL の評価根拠) |

> ⭐ 列は 2026-05-30 の FRL 2 レイヤー化で DB 実装済み。migration 110 で `amd_score_inputs` に追加され、`amd-score.ts` / `amd-score-derived.ts` は F_char/F_cap 2 入力 + CES 合成に対応済み。既存 `frl` は F_character 相当で、`frl_cap` が NULL の行は後方互換として従来どおり `frl` を最終 FRL に使う。

### 各軸の評価根拠 (= notes) 運用

- 入力: `AmdScoreView.tsx` の `AxisSliderWithNote` で各軸スライダーの直下に textarea
- 読み取り: `Factor3Breakdown` 内の 3 要素カードで各軸ラベル直下に italic で根拠表示
- Cockpit モーダル: `CockpitAmdScoreBreakdownModal.tsx` の `FactorRow.subtitle`
- Tsukuyomi 統合: `update_amd_score_input` tool に `mu_notes_a/i/g`, `xrl_notes_trl/brl/grl/srl/hrl` パラメータ追加、 LLM が **値だけでなく必ず根拠も書く** 運用

## 経営チームの八機能と《組織》 (= BZM 3.0、2026-08-28 新設)

**HRL は旧 AMD Score 系の指標で、産業創出価値（BZM 3.0）は別の測り方をする。**
BZM 3.0 は経営チームを八機能に分解し、各機能が誰かの責任になっているかを担い手の充足係数として計算に入れる。
空席は減点ではなく**工程の遅れ**として効く。

### どこで見るか

PJコックピット → **スコア詳細タブの最下段《組織》**。AMD 内部だけで、外部の共有ワークスペースからは開けない
（個人の評価を含むため）。3ブロック。

1. **担い手の機能** — 八機能ごとに 状態 / 担い手 / 直近の実働 / 判定の理由 / 空席の埋まり方
2. **人・組織の観測** — 機能の充足を判定した元の事実。良い観測（追い風）も悪い観測（重し）も同じ棚
3. **メンバー** — SU側の登録・議事録からの自動抽出・役職の台帳を名前で束ねた一覧

### 状態の読み方

| 状態 | 意味 |
|---|---|
| 充足 | 直近12か月に、3か月以上あけた2時点以上の実働の記録がある |
| 充足見込み | 記録はあるが時点数・間隔・出所が足りない。評価の確定では空席として扱う |
| 空席 | 実働の記録が無い、または直近12か月で途切れた |
| 未記帳 | **記録が薄いので判定を保留している。誰も担っていないという意味ではない** |

**肩書では充足にならない。** 「CEO」と登録されていることではなく、その機能の実働の記録があるかだけを見る。
対外説明の機能（機能1）は、相手方の記録か第三者の証言がある記録しか数えない。

**記録を積むこと自体がスコアを動かす。** 実際、SX で対外説明の見込みの値を範囲の端から端まで振っても
金額は13〜14億円しか動かなかった。他の6機能に記録が1件も無く、そちらが全体を押さえているため。

### 経営ハイライトとの線引き

人の性格・対人の癖・チームの成熟度・経営判断の構えは、**経営ハイライトに入れない**（日付を持つ事象ではないため）。
《組織》の観測へ入れる。起きたこと（担い手が会社を離れた、CEO候補と接触した）は経営ハイライトに残す。
判定表は設計書の [D-6 経営ハイライト仕様](/spec/3-6-strategy-signals-current-spec) にある。

### 書き足すには

いまは `project_org_observations` へ直接入れる（画面からの入力口はまだ無い）。
1件1行で、出来事の日付・種類（着任退任実働 / 異動定年 / 体制の変化）・誰・効く機能・要旨・出所・効き先を入れる。
詳しい契約は設計書の [《組織》セクション](/spec/4-9-project-org-section-current-spec)。

---

## 関連メンバー (= `project_founding_members` / `project_venture_members`)

PJ に関わる人物のマスタ 2 表。 用途が違う:

| table | 用途 |
|---|---|
| `project_founding_members` | 創業候補メンバーの候補リスト (= D-5 OS 台帳差分 / M-2 XRL 根拠抽出の対象、 PI + AMD + VC + 顧客 + 行政 すべて) |
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
| `status` | `active` (= 採用) / `tentative` (= 候補、 通知未確認) / `invalid` (= 却下) / `left` (= 離脱)。 ※実 DB の現行 4 値 (db_schema で裏取り) |
| `extracted_by` | `llm` / `manual` |
| `source_documents` | JSONB (= 元データ refs) |
| `first_observed_at` / `last_observed_at` | 観測期間 |

### HRL 算定対象 (= まさ #過去 確定)

`project_founding_members.category IN ('amd', 'startup', 'university')` のみが HRL 算定対象。 `vc` / `customer` / `government` は **invalid** 扱い (= 創業メンバーとカウントしない)。 これは M-2 XRL 根拠抽出の prompt にも書かれてる: 「VC/顧客/行政は HRL 関連メンバーとして無効」 ([8-3 章 §M-2](8-3-l2-extraction-routines-spec.md))。

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
| `/venture-map/amd-score` | 全 SU PJ の AMD Score 一覧。主表示は SPS primary、legacy AMD は comparison |
| `/project/[projectId]/cockpit?tab=score-detail` | 個別 PJ の SPS primary / SPS history / legacy M-X-F / FRL 6 因子 panel / 関連メンバー一覧 / XRL チェックリスト |
| `/venture-map/amd-score/[projectId]` | 互換URL。PJ cockpit の score detail tab へ自動転送 (`p99` デモを除く) |

cockpit の score detail tab にある `FrlAlqPanel` は FRL 6 因子表示 + ALQ radar (= 各因子クリックで Tsukuyomi 起動)。

## トラブル時

| 症状 | 確認場所 |
|---|---|
| FRL スコアが極端に低い | ALQ 4 + Grit + Resilience の値、 `frl_grit` / `frl_resilience` が NULL なら 0 扱いで合成が下がる |
| HRL が想定と違う | `project_founding_members.category` 別件数、 `category IN ('amd','startup','university')` で絞ったあとの人数 / 階層 |
| 関連メンバーの抽出に VC / 顧客が混じる | M-2 XRL 根拠抽出 prompt の「VC/顧客/行政無効」ルール、 [8-3 章](8-3-l2-extraction-routines-spec.md) を確認 |
| 修正依頼が反映されない | `amd_score_revisions.status='active'`、 `applied_to_alpha` が false でも `amd_score_inputs.frl` 自体は更新されるか |
| 評価根拠 (notes) が表示されない | `mu_notes` / `xrl_notes` / `frl_notes` の値、 `AxisSliderWithNote` の textarea 連携 |

## 関連

- 4-3 章 [AMD Score 詳細仕様](4-3-amd-score-spec.md) (= SPS primary / legacy 7 軸 comparison 全体)
- 設計: [`pwa/design/amd_score.md`](../design/amd_score.md) (= Before Zero Theory v3.2)
- 設計: [`pwa/design/score_revision_feedback_loop.md`](../design/score_revision_feedback_loop.md) (= 修正依頼 loop)
- 設計: [`pwa/design/su_knowledge_promotion_loop.md`](../design/su_knowledge_promotion_loop.md) (= founding_members 昇格)
- 理論層: `before-zero/theory/amd_score.md` (= 学術根拠)
- 8-3 章 [L2 Extraction Routines](8-3-l2-extraction-routines-spec.md) (= M-2 XRL 根拠抽出での member 評価)
- 4-7 章 [Venture Status / Narrative / PL / XRL](4-7-venture-status-narrative-pl-xrl-spec.md) (= venture members 側)
- 4-6 章 [卒業フェーズ検出](4-6-graduation-detection-spec.md) (= 関連メンバー成熟度との接続)
