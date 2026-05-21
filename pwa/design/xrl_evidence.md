# XRL根拠 (L2 ⑧) — 設計の正本

最終更新: 2026-05-15
正本ステータス: 定義確定、実装中。

---

## 定義

**XRL根拠** は、AMD Score / XRL 算定に使う構造化された観測根拠。

最終スコアそのものではなく、「なぜその TRL / BRL / GRL / SRL / HRL と見たか」を説明できる根拠データを L2 として保持する。

`project_founding_members` はこの L2 の一部で、HRL 推定の根拠として正式採用する。

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
- summary は「どの軸の根拠が増えたか」「XRL/AMD Score にどう効くか」を短く書く
- 全文は載せず、根拠 snippet と source refs を載せる

まさが「はい」を押した場合は `confirmed` に昇格し、必要に応じて `project_xrl_log` / `amd_score_inputs` の再計算対象にする。

まさが「いいえ」またはコメントした場合は、`l2_feedbacks` / つくよみ学習リストへ保存し、次回抽出の抑制・修正に使う。

---

## founding_members の扱い

`project_founding_members` は候補 L2 ではなく、L2 ⑧ XRL根拠の正式な一部。

ただし、HRL は創業メンバーだけで決めない。次も同じ L2 内で扱う:
- PI / 研究代表者のコミットメント
- 外部創業者候補の実在性・関与度
- 事業責任者候補
- AMD 側の伴走体制
- 採用候補・業務委託候補
- チームの意思決定速度や実行継続性

つまり、founding members は HRL の中心根拠のひとつだが、L2 ⑧ は HRL だけでなく TRL / BRL / GRL / SRL も含む。
