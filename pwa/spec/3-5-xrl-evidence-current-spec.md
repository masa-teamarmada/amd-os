# L2⑧ XRL checklist audit / 根拠仕様

> **この章は何か**: AMD Score / XRL 算定のチェックリスト監査と根拠ログの確定仕様。理論は `/bzm`、画面の読み方は `/manual/4-4-frl-related-members-score-spec` と `/manual/4-7-venture-status-narrative-pl-xrl-spec` に置く。

## 定義

L2⑧の通常経路は、日次で XRL 根拠候補を貯めることではなく、月末 L2① monthly_reports 作成後に `pwa/src/lib/xrl-level-definitions.ts` のチェック項目を月次証拠へ照合する **XRL checklist audit**。

XRL は日々変動する運用指標ではなく、数ヶ月から年単位で変化する成熟度指標として扱う。`project_xrl_evidence` は強いイベント根拠や過去 confirmed 根拠を保持する例外ログであり、通常の daily writer 出力ではない。

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
| `amd_score_inputs.xrl_checklist` | XRL チェック項目の確認状態。スコア詳細UIの正本 |
| `amd_score_inputs.xrl_notes` | チェック / XRL 入力値の根拠 notes |
| `project_xrl_evidence` | 例外的な XRL 根拠ログ。`candidate -> confirmed/rejected` |
| `project_founding_members` | HRL の主要根拠。manual 上は「関連メンバー」 |
| `project_xrl_log` | XRL 時系列評価ログ |
| `l2_notifications` | checklist 更新候補、または例外的 `xrl_evidence` の承認カード |

## 現行 writer

| 項目 | 値 |
|---|---|
| writer | Month-end XRL checklist audit after L2① monthly_reports |
| input | L2① monthly report + Supabase internal L2 / OS snapshot |
| checklist source | `pwa/src/lib/xrl-level-definitions.ts` |
| output | review proposal for `amd_score_inputs.xrl_checklist` / `xrl_notes` |
| old path | `pwa/scheduled-tasks/amd-os-l8-xrl-evidence-extract/SKILL.md` / `outbox.xrlEvidence` is historical / exceptional only |

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

- XRL checklist audit の「はい」: `amd_score_inputs.xrl_checklist` / `xrl_notes` 更新候補を反映。
- XRL checklist audit の「いいえ」: 更新候補を破棄。
- 例外的 XRL evidence の「はい」: `project_xrl_evidence.status='confirmed'`。
- 例外的 XRL evidence の「いいえ」: `status='rejected'`。
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
