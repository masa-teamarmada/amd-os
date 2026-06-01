# AMD OS / AMDプロトコル 請求項対応表（内部版）

- 作成日: 2026-06-01
- 位置づけ: 弁理士相談前の内部確認資料。外部送付用ではない。
- 対象請求項: `docs/ip/2026-06-01_patent_application_draft_internal.md` の請求項1〜16
- 参照資料:
  - `docs/ip/2026-06-01_patent_application_draft_internal.md`
  - `docs/ip/2026-06-01_claim_revision_internal.md`
  - `docs/ip/2026-06-01_patent_attorney_initial_consultation_pack.md`

## 0. 取り扱い注意

この対応表は、明細書本文・図面案・抽象テーブル・疑似処理フローが各請求項をどこまで支えているかを内部確認するためのもの。

以下は本資料にも書かない。

- prompt全文、few-shot、negative examples
- comment-to-guidance変換の具体ロジック
- score weight、threshold、calibration
- 実PJ事例本文、production DB row、source permalink、長いsnippet
- connector認証、監視、復旧、watch path等の運用詳細

## 1. 対応表

| Claim | claim summary | 明細書サポート箇所 | 図面サポート | 抽象テーブルサポート | 疑似フローサポート | support strength | retrofit不足 | 弁理士確認事項 |
|---|---|---|---|---|---|---|---|---|
| 1 | 複数業務データ源から候補生成、全文非保存の証拠メタデータ付与、HITL確認、承認済み正本反映、reject/comment feedback、抽象protocol生成までを一体化した方法 | 【課題を解決するための手段】、実施形態1〜8、請求項見直し案3 | Fig.1全体構成、Fig.2候補/evidence、Fig.3承認/feedback、Fig.4protocol | `candidate_data`, `evidence_metadata`, `review_feedback`, `master_record`, `commercialization_protocol` | 14.1, 14.2, 14.3, 14.4, 14.5 | strong | 主請求項が長く、protocol生成まで入れることで狭くなる可能性。全文非保存を必須要件にするかも未確定 | protocol生成を主請求項に入れるか。全文非保存を主請求項必須にするか。feedbackをどこまで広く書くか |
| 2 | 業務データ源の種類を、メール、文書、カレンダー、チャット、会議録、ナレッジ、月次レポート、台帳等に広げる従属項 | 実施形態2、請求項見直し案4、相談パック5 | Fig.1、Fig.2 | `evidence_metadata.source_type`, `evidence_metadata.source_identifier` | 14.1, 14.2 | strong | 外部制度情報を含めるか、請求項本文の列挙に残すかの整理余地 | データ源列挙が狭すぎないか。外部制度情報を従属項に入れるか |
| 3 | 証拠メタデータを抽出処理識別子ごとに永続化し、候補の承認/却下/コメント状態と関連付ける | 実施形態4、5、13、請求項見直し案4 | Fig.2、Fig.3、Fig.4 | `evidence_metadata`, `candidate_data.status`, `review_feedback` | 14.2, 14.3 | strong | `review_feedback` と `evidence_metadata` の関連を図4でより明示するとさらに強い | 抽出run単位の永続化がサポート要件として十分か |
| 4 | 未承認候補は正本DBへ反映せず、承認済みのみ反映する | 実施形態5、6、請求項見直し案4 | Fig.1、Fig.3、Fig.4 | `candidate_data.status`, `master_record.source_candidate_id`, `master_record.approved_by` | 14.3 | strong | 図3で「未承認は正本へ行かない」分岐を清書時に明確化するとよい | approved-only master DB reflectionを主請求項側にも十分入れるか |
| 5 | 却下/コメント由来のfeedbackを後続の抽出スコープ、条件、prompt、判定ルール、信頼度判定へ反映する | 実施形態7、請求項見直し案2〜4 | Fig.1、Fig.3 | `review_feedback` | 14.3, 14.4 | medium | 具体ロジックは営業秘密として出さないため、抽象的なfeedback適用例をもう1つ追加すると安定 | prompt注入と書くか、抽出条件/判定ルール/設定値への反映と広く書くか |
| 6 | 承認済み候補から固有名詞を除去/抽象化し、分岐点、判断材料、アクション、結果カテゴリを含むprotocolとして保存する | 実施形態8、請求項見直し案4、相談パック4〜5 | Fig.1、Fig.3、Fig.4 | `commercialization_protocol` | 14.5 | strong | identity determinationの説明を、hash等に限定しない書き方で維持する | protocol identityを広く書く表現 |
| 7 | 同一/類似の意思決定パターンをprotocol識別子に関連付け、複数PJ固有事例を1:Nで保存する | 実施形態8、9、請求項見直し案4、相談パック4〜5 | Fig.4 | `commercialization_protocol`, `protocol_example` | 14.5 | strong | 図4で1:N対応はあるが、特許図面清書時に複数事例のぶら下がりを強調する | 1:N構造を請求項6と分ける粒度でよいか |
| 8 | protocol又はPJ事例に紐づくアクション後の結果をmulti-horizon outcomeとしてappend-only保存する | 実施形態10、請求項見直し案4、相談パック4〜6 | Fig.4、Fig.5 | `outcome_observation` | 14.6 | strong | horizonカテゴリは抽象例として十分だが、医療系schemaとの差別化説明を厚くしたい | FHIR/OMOP回避のため、multi-horizon/経営判断文脈をどこまで請求項に入れるか |
| 9 | 同一horizonで異なるvalenceの結果観測が共存する場合、上書きせず確認UIへ併記する | 実施形態10、請求項見直し案4、相談パック5〜6 | Fig.5 | `outcome_observation.horizon`, `outcome_observation.valence` | 14.6 | strong | UI例はFig.5中心なので、明細書本文にも「確認インターフェースの表示態様」を少し補う余地 | 矛盾観測保持UIを独立従属項で十分に差別化できるか |
| 10 | outcomeの証拠メタデータが、会議録、月次レポート、KPI、戦略シグナル、状態変化、外部制度情報等の異種ソース参照を含む | 実施形態2、4、10、請求項見直し案4、相談パック4〜6 | Fig.1、Fig.4、Fig.5 | `evidence_metadata`, `outcome_observation.evidence_id` | 14.2, 14.6 | medium | outcome側の「複数evidence参照」構造がテーブルでは単数`evidence_id`寄り。抽象テーブルに`evidence_refs`又は中間関連の例を足すと強い | 異種evidence統合参照をどこまで明細書・請求項へ入れるか |
| 11 | prompt/rule/config/model/workflow等の複数種類のsystem parameterにpending proposal -> UI提示 -> 承認時のみ新version保存を適用する | 実施形態11、請求項見直し案4、相談パック4〜6 | Fig.1、Fig.6 | `system_parameter`, `parameter_proposal`, `parameter_version` | 14.7 | strong | score modelを含むが、具体weight等は出さない注意書きが必要 | 基幹出願へ含めるか、分割候補にするか |
| 12 | 複数種類のsystem parameterに同一のproposal/version処理パターンを統一適用する | 実施形態11、請求項見直し案4、相談パック5〜6 | Fig.6 | `system_parameter.parameter_type`, `parameter_proposal`, `parameter_version` | 14.7 | strong | 「統一的に適用」の実施形態を、抽象例の範囲でもう少し明文化できる | Cienaとの差分として、異種parameter横断governanceをどう書くか |
| 13 | 対象が法人設立前研究シーズの場合、候補/protocol/outcome等に基づいて法人設立時期推奨データを生成する | 実施形態12、15、請求項見直し案4、相談パック5〜7 | Fig.1、Fig.7 | `incorporation_timing_recommendation` | 14.8 | medium | 実weight/threshold/calibrationを出さないため、抽象ロジックだけで実施可能要件を満たす補足が必要 | Before-Zero/設立タイミングを従属項に留めるか、独立請求項も置くか |
| 14 | 確認UIが候補、evidence、信頼度、承認/却下/コメント、protocol、事例、outcome、proposal等を表示する | 実施形態5、10、11、請求項見直し案4、相談パック5 | Fig.1、Fig.3、Fig.5、Fig.6 | `candidate_data`, `evidence_metadata`, `review_feedback`, `protocol_example`, `outcome_observation`, `parameter_proposal` | 14.3, 14.6, 14.7 | medium | 各UI表示要素は散在している。請求項14用の統合UI例又は表示態様説明を補うと強い | 侵害検出上の実益と、UI限定で狭くなるリスクのバランス |
| 15 | 請求項1〜14の方法を実行するプロセッサ及びメモリを備える情報処理装置 | 実施形態1 | Fig.1 | 全抽象テーブルが装置のストレージ/DB構成を支える | 14.1〜14.8全体 | medium | 装置クレームとして、プロセッサ/メモリ/ストレージ/通信IF/表示制御部との対応を図面清書時に番号付けする | 方法クレームと装置クレームの形式を弁理士に整えてもらう |
| 16 | 請求項1〜14の方法をコンピュータに実行させるプログラム | 実施形態1、14 | Fig.1、各フローチャート | 全抽象テーブル | 14.1〜14.8全体 | medium | プログラム/記録媒体クレームとしての定型表現は未整備 | プログラム、記録媒体、装置の請求項セットをどう組むか |

## 2. support strength別の所感

### strong

請求項1〜4、6〜9、11〜12は、明細書本文、図面案、抽象テーブル、疑似フローが概ね揃っている。

特に、請求項1の閉ループ、請求項6〜9のprotocol/example/outcome、請求項11〜12のparameter governanceは、図面とテーブルとフローの三点がそろっている。

### medium

請求項5、10、13〜16は、発明の方向性としては支えられているが、弁理士相談前に補うと強くなる余地がある。

- 請求項5: feedbackの具体ロジックを営業秘密に残すため、抽象的な実施可能性の説明がやや薄い。
- 請求項10: 異種evidence統合参照は本文にあるが、抽象テーブルが単数`evidence_id`寄り。
- 請求項13: 設立時期推奨は図・表・フローがある一方、実weight等を出さないため実施可能要件の確認が必要。
- 請求項14: UI表示項目は散在しており、統合UI例があるとよい。
- 請求項15〜16: 装置/プログラムの定型的な支えはあるが、弁理士側の形式整備が前提。

### weak

現時点で明確にweakと判定する請求項はない。
ただし、請求項10と13は、営業秘密を出さずにどこまで実施可能要件を満たすかの確認が重要。

## 3. 補強TODO（weak/medium優先）

1. 請求項10: `outcome_observation` が複数の異種evidenceを参照できる抽象構造を追加する。例: `outcome_evidence_ref` 又は `evidence_refs` の抽象表現。ただしsource permalinkや実DB行は出さない。
2. 請求項13: 設立時期推奨の「抽象ロジックで実施可能」な説明を1段足す。入力カテゴリ、出力カテゴリ、参照する正本レコード種別だけに留め、weight/threshold/calibrationは書かない。
3. 請求項14: 統合確認UIの表示態様を、営業秘密を含まない抽象画面例として追加する。候補/evidence/review/protocol/outcome/proposalを全部出す必要はなく、少なくとも外部検出可能な表示要素を整理する。
4. 請求項5: reject/comment feedbackの抽象実施例を補う。具体prompt変換ではなく、「feedback_scope」「comment_summary」「適用先parameter type」程度に限定する。
5. 請求項15〜16: 図1清書時に、プロセッサ、メモリ、ストレージ、通信インターフェース、表示制御部、DBを構成要素番号として振る前提を置く。
6. 請求項1: 主請求項にprotocol生成まで入れるか、HITL + feedbackまでを独立請求項にしてprotocolを従属項に下げるか、弁理士へ確認する。
7. 請求項11〜12: system parameter governanceを基幹出願に含めるか、分割候補にするかを相談論点として明示する。

## 4. 外部相談前の確認メモ

- 本対応表は外部送付用ではない。
- 弁理士に見せる場合も、本文から営業秘密リストと内部運用ニュアンスを削る。
- 対応表としては、まず「どの請求項のsupportが薄いか」を確認する用途に留める。
- 特許図面清書時は、Fig.1〜Fig.7に構成要素番号を振り、請求項1〜16の対応関係を再確認する。
