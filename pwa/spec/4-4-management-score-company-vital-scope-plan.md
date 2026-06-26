# Management Score 会社バイタル分類 本修正

> **この章は何か**: `/management-score` に入れる材料を、AMD会社全体の経営バイタルとPJ個別情報へ分けるための確定仕様。2026-06-01に additive DB migration、L2/applier/API分類、initial backfill、202605/202606 snapshot再計算を実行済み。

## 背景

2026-06-01の調査で、Management Scoreの材料と表示に3つのズレが見つかった。

- `ym=202606` のsnapshotが2026-05-26時点の材料で作られており、6月開始前のsnapshotを当月最新として見せていた。
- 香川大はMTG実施前から高確度パイプラインだったが、現行材料はconfirmed signal / MTG後signalに寄り、`candidate` の高確度company pipelineを拾えていなかった。
- `project_strategy_signals` はPJ cockpit向けの経営ハイライトとしてPJ横断で蓄積されるが、company-level / project-level分類がなく、LST/p07などのPJ個別技術・設立・顧客論点がAMD会社全体の経営バイタルへ混入し得る。

暫定対応として、Management Score側では `project_id='p00'` を会社全体シグナルとして扱い、`p00` かつ高確度の `commercial_progress` candidateだけをpipeline材料へ入れるguardを入れた。根本修正後は `applies_to_company_score=true` を正本として読む。backfill前の古い row に限り `p00` guardを fallback として残す。

2026-06-26追記: `project_strategy_signals` だけでなく、`project_meeting_summaries` 由来の retention signal も同じ会社バイタル境界を守る。MTGの `risks` に「リスク」等の単語があるだけでは Management Score に入れない。契約継続、予算未確保、入金/請求、支援停止、稼働/体制など AMD会社全体の既存PJ継続へ直接効くものだけ `meeting:retention_risk` / `meeting:retention_positive` とし、技術実証・PoC・出資タイミング・知財・創業株主設計などPJ内部のriskは `meeting:context` として除外する。

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
- 個別PJの技術実証、PoC、出資タイミング、知財、創業株主設計など、契約継続・入金・支援停止に直結しないMTG risk。
- LST/p07など特定PJ内部の進捗や論点。
- Before Zero実践知として価値があっても、AMD会社全体の経営バイタルではないもの。

## DB migration

対象は `project_strategy_signals` を第一候補にする。`amd_management_score_evidence` はsnapshot生成結果なので、まず上流signalの分類を正す。

追加済みカラム:

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

制約:

- `signal_scope in ('company','project','cross_project')`。
- `pipeline_probability` はnullまたは0以上1以下。
- `applies_to_company_score=true` の場合は `signal_scope in ('company','cross_project')` を必須にする。
- `pipeline_status is not null` の場合は `company_score_axis is null or company_score_axis='pipeline'` を必須にする。

実装ファイル:

- `pwa/scripts/migrations/118_management_score_company_vital_scope.sql`
- `pwa/scripts/migrations/119_management_score_company_vital_initial_backfill.sql`
- `pwa/scripts/management_score_vital_scope_tool.mjs`

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

## 既存signals backfill

安全な順番:

1. read-onlyで `project_strategy_signals` を `ym >= 202501` から棚卸しする。
2. `project_id='p00'` は原則 `signal_scope='company'` 候補。ただし個人メモや雑談由来は除外確認する。
3. `project_id!='p00'` は原則 `signal_scope='project'`, `applies_to_company_score=false`。
4. 例外として、複数PJ横断の資源配分・AMD契約・資金繰り・営業pipelineへ効くものだけ `cross_project` へ昇格する。
5. 香川大のような高確度pipelineは、根拠source、見込み金額、契約時期、確度を埋めたうえで `pipeline_status='high_confidence'` とする。

backfillは全件自動applyしない。まず `management_score_vital_scope_tool.mjs --mode=backfill-dry-run` で候補JSONを作り、司令塔レビュー後に小さな migration としてDB writeする。

2026-06-01 initial backfill:

- 香川大100万円予算確保: `cross_project`, `applies_to_company_score=true`, `pipeline_status='high_confidence'`, `pipeline_probability=0.95`, `expected_amount_yen=1000000`, `company_score_axis='pipeline'`。
- 香川大学案件獲得/来年度AMD契約方針: `company`, `high_confidence`, `pipeline_probability=0.82`。
- KUTE受託3ミッション/承認導線: `cross_project`, `high_confidence`, `expected_contract_ym=202606`。
- NIMS見積/新規契約: `cross_project`, `high_confidence`, `expected_amount_yen=1000000`, `expected_contract_ym=202605/202606`。
- SX PoC/前売上方針: `cross_project`, `high_confidence`。
- CX/NIMSコンソーシアム戦略: `cross_project`, `company_score_axis='capacity'`。

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
6. 本番snapshotを再生成する。

2026-06-01実行結果:

| ym | total | 継続 | 新規 | 方向 | 主な確認 |
|---|---:|---:|---:|---:|---|
| 202605 | 66 | 22 | 75 | 24 | 香川大/KUTE/NIMS が pipeline evidence に入った。旧 `seed` / `project_knowledge` raw を掃除したため新規100の過大評価は解消。 |
| 202606 | 55 | 14 | 21 | 15 | KUTE/NIMS が 6月 pipeline evidence に入った。香川大は `expected_contract_ym=202605` のため5月根拠。 |

低すぎる原因:

- 継続: active 9/24、CTB freeze -18、進捗平均が202605=27%、202606=5%。式上も実データ上も低い。
- 新規: 202606は会社level pipelineが KUTE/NIMS 3件に留まり、`project_registry_diffs` / PJ派生 knowledge が0。過小評価の一部は backfill不足だが、旧raw掃除後は seed在庫加点が消えるため低めに出るのは仕様通り。
- 方向: monetizationは入るが、funding/研究機関数/OS導入/卒業/属人脱却が0。`project_partners` に研究機関 partner が入っていない、`amd_os_installations` 未実装が大きい。

再計算の停止条件:

- `applies_to_company_score=true` のsignalに `signal_scope='project'` が混ざる。
- `candidate` が高確度pipeline条件なしで会社スコアへ入る。
- 対象月より後の `signal_date` / `confirmed_at` が月次snapshotへ混ざる。
- pre-month snapshotが当月最新として採用される。

## 暫定guardを外す条件

以下が満たされるまで、PWA側の `p00` fallback は残す。

- DBにscope/pipeline分類が入っている。→ 118/119で開始済み。
- L2抽出とconfirm APIが分類を必ず書く。→ applier/API/prompt helper 修正済み。
- 既存signalsのbackfillが完了している。→ initial backfill済み、全件はdry-runレビュー継続。
- Management Score raw/calculateが `applies_to_company_score` を正本として読む。→ 実装済み。
- 202605/202606のsnapshot再計算と画面確認が完了している。→ DB再計算済み、UI deploy後に画面確認が必要。
