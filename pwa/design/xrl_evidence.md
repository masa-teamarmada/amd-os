# XRL根拠 (L2 ⑧) — 設計の正本

最終更新: 2026-05-22
正本ステータス: 定義確定、実装中。

---

## 定義

**XRL根拠** は、AMD Score / XRL 算定に使う構造化された観測根拠。

最終スコアそのものではなく、「なぜその TRL / BRL / GRL / SRL / HRL と見たか」を説明できる根拠データを L2 として保持する。

`project_founding_members` はこの L2 の一部で、HRL 推定の根拠として正式採用する。
ここに入れるのは創業者 / CEO候補 / 技術創業者 / PI などの創業コアだけで、
VC / 協業先 / 顧客 / 行政 / advisor-only / AMDサポートのみの人物は含めない。

---

## 対象軸

| 軸 | 意味 | 根拠例 |
|---|---|---|
| TRL | Technology Readiness Level | 技術実証、PoC、論文、特許、試作品、実験結果、技術課題 |
| BRL | Business Readiness Level | 顧客候補、用途仮説、価格、競合、事業計画、PoC候補 |
| GRL | Governance / Grant / Government Readiness Level | 補助金、規制、大学内承認、産連/URA、認定制度、公共調達 |
| SRL | Social / Stakeholder Readiness Level | ステークホルダー合意、導入先、社会実装経路、受容性、倫理・安全 |
| HRL | Human Readiness Level | 創業メンバー、PI、事業責任者候補、外部創業者、AMD伴走体制、採用候補 |

軸名の細部は AMD Score 側の定義に従う。ここでは「XRL 算定の根拠を束ねる L2」として扱う。

---

## 既存テーブルとの対応

| テーブル | L2 ⑧での位置づけ |
|---|---|
| `project_founding_members` | HRL 根拠。創業メンバー / 共同創業候補 / AMD伴走者 / 外部キーマンを保持 |
| `project_xrl_log` | XRL 時系列の評価ログ。LLM proposal や bottleneck を保持 |
| `amd_score_inputs` | AMD Score 入力値。XRL / FRL / Triple Helix 系入力と notes を保持 |
| `l2_notifications` | XRL根拠の新規抽出・更新・差分を通知 |

---

## 新設予定テーブル

`project_xrl_evidence`

推奨カラム:

| column | 意味 |
|---|---|
| `evidence_id` | UUID PK |
| `project_id` | 対象 PJ |
| `ym` | 対象年月。PJ全体根拠なら NULL |
| `axis` | `trl` / `brl` / `grl` / `srl` / `hrl` |
| `evidence_kind` | `founding_member` / `technical_validation` / `customer_signal` / `grant_signal` / `governance_signal` / `stakeholder_signal` / `team_signal` / `other` |
| `summary` | 根拠の短い要約 |
| `structured_value_json` | 根拠の構造化値 |
| `source_refs_json` | 5生データや既存L2への参照。全文ではなく source id / date / snippet / hash |
| `confidence` | 0-1 |
| `status` | `candidate` / `confirmed` / `rejected` / `archived` |
| `created_by` | `automation` / `codex` / `manual` |
| `created_at` | 作成日時 |
| `confirmed_at` | 確認日時 |

重複回避キーは `project_id + axis + evidence_kind + source_hash` を基本にする。

---

## 抽出元

入力は 5生データと既存 L2。

- Gmail
- Google Drive
- Google Calendar
- Slack
- Notion
- 既存 L2: `monthly_reports`, `project_meeting_summaries`, `project_knowledge`, `member_activities`, `project_founding_members`

GAS バックアップシートは正本ではない。人間確認用・非常時確認用として扱い、リアルタイム抽出の source of truth にはしない。

---

## 通知ルール

XRL根拠が新規作成・大幅更新されたら `/notifications` に出す。

- `l2_kind = 'xrl_evidence'`
- `target_id = project_id`
- `scope_key = ym` または `global`
  - 1通知1候補にしたい場合は `202605:sx-miura-finechem-brl` のような `YYYYMM:<slug>` を許可する。
  - ただし正本 `project_xrl_evidence.scope_key` は generated column で `ym` 由来 (`202605`) になるため、UI/APIは `YYYYMM` 部分 + `metadata_json.axis/evidence_kind/evidence_source_hash` で候補行を特定する。
- summary は「どの軸の根拠が増えたか」「XRL/AMD Score にどう効くか」を短く書く
- 全文は載せず、根拠 snippet と source refs を載せる

まさが「はい」を押した場合は `confirmed` に昇格し、必要に応じて `project_xrl_log` / `amd_score_inputs` の再計算対象にする。

まさが「いいえ」またはコメントした場合は、`l2_feedbacks` / つくよみ学習リストへ保存し、次回抽出の抑制・修正に使う。

---

## 関連メンバー (旧 founding_members) の扱い

`project_founding_members` は L2 ⑧ XRL根拠の正式な一部で、**HRL 評価のベース**となる関連メンバー台帳。

### 対象範囲 (まさ判断 2026-05-22)

HRL 根拠に算入するのは **「該当SUの社員 (社員候補 / 創業候補を含む) + AMD の伴走メンバー」だけ**。
このスコープに合致するものだけが HRL を動かす。

含める (category 値):
- `amd`: AMD の伴走メンバー (= `members.code_name` に一致する人物)
- `startup`: 該当SU の社員 / 社員候補 / 創業候補 (= AMD 外で SU 側に入る人物)

含めない (category 値、status='invalid' 化 / HRL 算定から除外):
- `university`: 大学 / 研究機関の PI / 共同研究者 / 特許保有者
- `vc`: VC / ファンド / 投資家 / 出資検討者
- `partner_company`: 産業パートナー / 顧客候補 / サプライヤー / 委託先
- `government`: 補助金 / 行政 / 支援機関 / 採択担当
- `individual`: 個人 (フリーランス等で SU+AMD 外)

「協業」「窓口」「相談」「アドバイザ」など曖昧な関与はすべて除外する。

### 表記ルール

- AMD メンバーは必ず `members.code_name` で記録する (例: `まさ` / `きよ` / `かる`)。
  本名 (`山地正洋`) / 姓のみ (`山地`) / スペース付き表記は invalid 化して `code_name` 1 行に集約する。
- 関連メンバー抽出cronが読む md は、`/Users/masa/projects/knowledge/<slug>.md` を
  `project_ventures.master_md_text` に同期した SU 別正本。AMD メンバー一覧 md は抽出promptへ直接渡さず、
  `members.code_name` + `members.member_name` をDBから読んで alias map を作る。
- AMD code_name に該当しない person で SU 側人物は `category='startup'` + `affiliation=<SU名>`。
  「JOYCLE / AMD」のような AMD 二重表記は使わない (= 誤分類の温床になる)。
- 同一人物の別表記 (例: `野田` / `野田先生`) は LLM 抽出時に集約する。

### ステータス遷移

LLM 抽出は `status='tentative'` で保存。`/notifications` から「はい」で `active`、「いいえ」で `invalid`。
コックピットの関連メンバーモーダル (`CockpitMembersModal`) からつくよみ修正依頼を出すと、
`/api/founding-members/revise` が提案 → OK確定で upsert / invalid 化。

### HRL は関連メンバーだけで決めない

`project_founding_members` は HRL の主要根拠だが、HRL 自体は次の要素も合わせて決める:
- 関連メンバーの役割充足度 (CEO / 技術 / 事業 が揃っているか)
- 該当SU + AMD 両カテゴリの多様性
- 創業候補の実在性 / コミットメント / 採用候補 / 業務委託候補
- チームの意思決定速度や実行継続性

L2 ⑧ XRL根拠は HRL だけでなく TRL / BRL / GRL / SRL の根拠 (`project_xrl_evidence`) も含む。
