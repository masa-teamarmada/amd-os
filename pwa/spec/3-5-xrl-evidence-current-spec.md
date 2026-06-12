# L2M-2 XRL 根拠仕様

> **この章は何か**: AMD Score / XRL 算定の根拠を構造化して保持する L2M-2 の確定仕様。理論は `/bzm`、画面の読み方は `/manual/4-4-frl-related-members-score-spec` と `/manual/4-7-venture-status-narrative-pl-xrl-spec` に置く。

## 定義

XRL 根拠は、最終スコアではなく「なぜその TRL / BRL / GRL / SRL / HRL と見たか」を説明する観測データ。

| axis | 根拠例 |
|---|---|
| `trl` | 技術実証、PoC、論文、特許、試作品、実験結果 |
| `brl` | 顧客候補、用途仮説、価格、競合、事業計画 |
| `grl` | 補助金、規制、大学承認、URA、認定制度 |
| `srl` | ステークホルダー合意、導入経路、社会受容性、倫理・安全 |
| `hrl` | CEO候補、PI、事業責任者候補、AMD伴走体制、採用候補 |

## 正本テーブル

| table | 用途 |
|---|---|
| `project_xrl_evidence` | XRL 根拠候補。`candidate -> confirmed/rejected` |
| `project_founding_members` | HRL の主要根拠。manual 上は「関連メンバー」 |
| `project_xrl_log` | XRL 時系列評価ログ |
| `amd_score_inputs.xrl_notes` | AMD Score 入力値の根拠 notes |
| `l2_notifications` | `l2_kind='xrl_evidence'` の承認カード |

## 現行 writer

| 項目 | 値 |
|---|---|
| writer | Codex automation `amd-os-ms` |
| SKILL | `pwa/scheduled-tasks/amd-os-l8-xrl-evidence-extract/SKILL.md` |
| input | 5 生データ + existing L2 + OS snapshot |
| output | `outbox.xrlEvidence` |
| apply | LaunchAgent + `ms_progress_review_tool.mjs apply-outbox-dir` |

## `project_founding_members` の HRL 境界

HRL に算入するのは SU 立ち上げに直接コミットする人物だけ。

| category | HRL 算入 | 例 |
|---|---|---|
| `amd` | yes | AMD 伴走メンバー。`members.code_name` に寄せる |
| `startup` | yes | SU 社員 / 社員候補 / 創業候補 |
| `university` | yes | PI / 共同創業者 / 技術リード / 大学キーパーソン |
| `vc` | no | VC / 投資家 |
| `customer` / `partner_company` | no | 顧客候補 / 産業パートナー |
| `government` | no | 行政 / 支援機関 |

VC / 顧客 / 行政 / advisor-only を HRL 根拠として active 化しない。誤抽出は `invalid` にする。

## 採否

- XRL evidence の「はい」: `project_xrl_evidence.status='confirmed'`。
- XRL evidence の「いいえ」: `status='rejected'`。
- founding members の「はい」: `project_founding_members.status='active'`。
- founding members の「いいえ」: `status='invalid'`。
- コメントは `l2_feedbacks` に保存し、次回抽出に反映する。

## 保存契約

- `source_refs_json` は source id / date / title / short snippet / hash に留める。
- evidence summary は「XRL / AMD Score にどう効くか」を短く書く。
- 1 notification 1 candidate にする場合、`scope_key` は `YYYYMM:<slug>` を許可する。ただし DB 側の generated scope と照合できる metadata を持たせる。

## 禁止事項

- HRL を人数だけで決めない。
- AMD メンバーを本名や姓だけで保存しない。`members.code_name` に寄せる。
- `project_founding_members` を SU 法人台帳 (`project_venture_members`) と混同しない。
- XRL score そのものと XRL 根拠を混ぜない。
