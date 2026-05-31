# Management Score 会社バイタル分類 本修正案

> **この章は何か**: `/management-score` に入れる材料を、AMD会社全体の経営バイタルとPJ個別情報へ分けるための未適用設計案。2026-06-01時点では暫定guardを採用済みだが、DB schema / L2抽出 / backfill / snapshot再計算はまだ実行していない。

## 背景

2026-06-01の調査で、Management Scoreの材料と表示に3つのズレが見つかった。

- `ym=202606` のsnapshotが2026-05-26時点の材料で作られており、6月開始前のsnapshotを当月最新として見せていた。
- 香川大はMTG実施前から高確度パイプラインだったが、現行材料はconfirmed signal / MTG後signalに寄り、`candidate` の高確度company pipelineを拾えていなかった。
- `project_strategy_signals` はPJ cockpit向けの経営ハイライトとしてPJ横断で蓄積されるが、company-level / project-level分類がなく、LST/p07などのPJ個別技術・設立・顧客論点がAMD会社全体の経営バイタルへ混入し得る。

暫定対応として、Management Score側では `project_id='p00'` を会社全体シグナルとして扱い、`p00` かつ高確度の `commercial_progress` candidateだけをpipeline材料へ入れるguardを入れた。これは最低限の防波堤であり、根本修正ではない。

## 入れてよい情報 / 入れてはいけない情報

Management Scoreに入れてよい情報:

- AMD会社全体の売上、入金、支払い、固定費、報酬、資金繰り、Runway。
- AMD全体の営業・新規案件獲得活動、提案先、商談、契約、請求、採択、アライアンス。
- AMDの人員、稼働、PM/外注/採用、組織運営。
- AMD全体の経営判断、資源配分、優先順位、撤退/保留/注力判断。
- 複数PJ横断でAMDの経営状態を変えるもの。

Management Scoreに入れてはいけない情報:

- 個別PJの技術進捗、実験結果、シーズ評価。
- 個別PJの設立予定、事業内容インプット、特許、顧客、装置、研究論点。
- LST/p07など特定PJ内部の進捗や論点。
- Before Zero実践知として価値があっても、AMD会社全体の経営バイタルではないもの。

## DB migration案

対象は `project_strategy_signals` を第一候補にする。`amd_management_score_evidence` はsnapshot生成結果なので、まず上流signalの分類を正す。

追加候補カラム:

| column | type | 目的 |
|---|---|---|
| `signal_scope` | text | `company` / `project` / `cross_project`。signalが効く範囲。 |
| `applies_to_company_score` | boolean | Management Scoreへ入れてよいかの明示flag。 |
| `pipeline_status` | text | `prospect` / `high_confidence` / `contracting` / `contracted` / `lost` / `deferred`。契約前pipelineの状態。 |
| `pipeline_probability` | numeric | 0.0〜1.0。契約見込み確度。 |
| `expected_amount_yen` | numeric | 見込み金額。未確認ならnull。 |
| `expected_contract_ym` | text | 契約・請求・開始が見込まれる年月。`YYYYMM`。 |
| `company_score_axis` | text | `pipeline` / `funding` / `runway` / `capacity` / `decision` など、会社スコア側の軸。 |
| `scope_reason` | text | なぜcompany score対象/非対象かの短い根拠。 |

制約案:

- `signal_scope in ('company','project','cross_project')`。
- `pipeline_probability` はnullまたは0以上1以下。
- `applies_to_company_score=true` の場合は `signal_scope in ('company','cross_project')` を必須にする。
- `pipeline_status is not null` の場合は `company_score_axis='pipeline'` を原則にする。

## L2抽出 / まさえいMTG確定時の分類案

L2抽出promptに追加する判定:

1. このsignalはAMD会社全体の経営状態を変えるか。
2. 個別PJの技術・実験・設立・顧客論点だけで完結していないか。
3. 複数PJ横断、またはAMDの売上・資金繰り・人員・営業pipeline・資源配分へ直接効くか。
4. 契約前pipelineの場合、見込み確度・金額・契約時期を根拠付きで推定できるか。

validator案:

- `project_id !== 'p00'` かつ `signal_scope='company'` の場合は、`scope_reason` に「AMD全体へ効く理由」を必須にする。
- `applies_to_company_score=true` なのに `company_score_axis` がnullならrejectまたはcandidate差し戻し。
- `candidate` を会社スコアに入れる場合は、`signal_scope='company'`、`company_score_axis='pipeline'`、`pipeline_probability >= 0.75`、`expected_contract_ym is not null` の全条件を満たす。
- PJ個別の技術・研究・設立・顧客論点は、`signal_scope='project'`、`applies_to_company_score=false` をdefaultにする。

まさえいMTG確定時:

- confirm APIで `signal_scope` / `applies_to_company_score` / `company_score_axis` を編集可能にする。
- まさが「これは会社全体に効く」と判断した場合だけ `applies_to_company_score=true` へ昇格する。
- confirmed化は「PJ cockpitへ出す」意味と「Management Scoreへ入れる」意味を分離する。

## 既存signals backfill方針

安全な順番:

1. read-onlyで `project_strategy_signals` を `ym >= 202501` から棚卸しする。
2. `project_id='p00'` は原則 `signal_scope='company'` 候補。ただし個人メモや雑談由来は除外確認する。
3. `project_id!='p00'` は原則 `signal_scope='project'`, `applies_to_company_score=false`。
4. 例外として、複数PJ横断の資源配分・AMD契約・資金繰り・営業pipelineへ効くものだけ `cross_project` へ昇格する。
5. 香川大のような高確度pipelineは、根拠source、見込み金額、契約時期、確度を埋めたうえで `pipeline_status='high_confidence'` とする。

backfillは自動一括applyしない。まず候補CSV/JSONを作り、まさまたは司令塔レビュー後にDB writeする。

## Snapshot再計算手順と安全ゲート

再計算対象:

- 分類backfill後の `amd_management_score_raw_data`。
- `amd_management_score_snapshots`。
- `amd_management_score_evidence`。

手順:

1. DB migration適用前にschema dumpとbackup queryを保存。
2. staging相当のdry-runで、対象月ごとのraw材料件数とaxis別寄与を出す。
3. `202605` / `202606` について、暫定guard前後、本修正後の差分を比較する。
4. p07/LSTなどPJ個別signalが会社スコアへ入らないことを件数とsampleで確認する。
5. 香川大高確度pipelineが、MTG実施前の対象月でもpipeline材料として入ることを確認する。
6. まさ/司令塔承認後に本番snapshotを再生成する。

再計算の停止条件:

- `applies_to_company_score=true` のsignalに `signal_scope='project'` が混ざる。
- `candidate` が高確度pipeline条件なしで会社スコアへ入る。
- 対象月より後の `signal_date` / `confirmed_at` が月次snapshotへ混ざる。
- pre-month snapshotが当月最新として採用される。

## 暫定guardを外す条件

以下が満たされるまで、PWA側の `p00` guard と高確度candidate例外は残す。

- DBにscope/pipeline分類が入っている。
- L2抽出とconfirm APIが分類を必ず書く。
- 既存signalsのbackfillが完了している。
- Management Score raw/calculateが `applies_to_company_score` を正本として読む。
- 202605/202606のsnapshot再計算と画面確認が完了している。
