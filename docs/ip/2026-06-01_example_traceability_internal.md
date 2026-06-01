# AMD OS / AMDプロトコル 合成実施例 裏取りメモ（内部版）

- 作成日: 2026-06-01
- 位置づけ: 出願書類たたき台の「安全な実施例」が、AMDの実運用・設計経験のどこに裏打ちされているかを整理する内部メモ。
- 対象: `docs/ip/2026-06-01_patent_application_draft_internal.md` の「15. 安全な実施例」。
- 注意: 本資料は外部送付用ではない。弁理士へそのまま渡さない。

## 0. 取り扱い原則

このメモの目的は、実案件名を明細書に出すことではない。

むしろ、以下を分けるための裏取りである。

- 明細書に書いてよい抽象表現
- NDA下なら口頭説明可の実運用背景
- 口頭限定の事業・営業文脈
- 出願書類に書かない営業秘密

以下は本資料にも具体化して書かない。

- production DB row、source permalink、長いsnippet、議事録本文、Slack本文、Gmail本文
- prompt全文、few-shot、negative examples、comment-to-guidance変換ロジック
- AMD Scoreのweight、threshold、calibration、実判定条件
- 顧客名、研究機関名、個人名、契約条件、未公開知財の詳細
- 導入先別onboarding、connector認証、監視・復旧、watch path等の運用詳細

## 1. 合成実施例の構成要素分解

| 構成要素 | 合成実施例での表現 | 支えている請求項・実施形態 | この裏取りで確認すること |
|---|---|---|---|
| 研究シーズA | 匿名の研究シーズ | 請求項13、実施形態12、14.8 | AMDがBefore 0段階の研究シーズを扱っている実運用があるか |
| 会議録 / カレンダー / クラウド文書 / 月次レポート | 複数業務データ源への参照取得 | 請求項1, 2, 10、実施形態2, 4, 14.1, 14.2 | 5生データやL2仕様が複数source前提になっているか |
| 顧客候補検証 | 顧客候補との検証を優先すべき候補データ | 請求項1, 6, 13 | 研究シーズの事業化判断で顧客候補・用途・PoC先検証を扱っているか |
| comment feedback | 顧客候補の種別を限定しすぎている、というコメントを後続処理へ反映 | 請求項5、実施形態7、14.4 | 採否・コメント・feedback保存の設計があるか |
| protocol化 | 固有名詞を除いた事業化判断プロトコル生成 | 請求項6, 7、実施形態8, 9, 14.5 | AMDプロトコルが普遍pattern + 1:N事例の構造を持つか |
| outcome 1m / 6m / 24m | 複数時点の結果観測をappend-only保存 | 請求項8, 9, 10、実施形態10, 14.6 | 短期・中期・長期の結果観測を上書きしない設計があるか |
| pending proposal / version governance | 抽出ルール又は判定ルールの変更候補を承認後version化 | 請求項11, 12、実施形態11, 14.7 | system parameterやscore revisionの承認付き改訂構想があるか |
| Before-Zero設立時期推奨 | 法人設立前研究シーズの設立時期推奨 | 請求項13、実施形態12, 14.8 | 設立前シーズの段階判定・設立タイミング論点を扱っているか |

## 2. 実運用・設計による裏打ち

### 2.1 研究シーズA

裏取り候補:

- `pwa/design/seeds.md`: Before 0起点の研究シーズマスタ。候補、調査中、接触済、協議中、PJ化、見送りの状態遷移を持つ。
- `pwa/design/institution_readiness.md`: 研究機関側のシーズ発掘・事業化支援・EIR/CXO供給・認定制度等を評価する設計。
- `/Users/masa/projects/knowledge/amd_value_model.md`: AMDの価値はBefore 0で研究者を研究者のまま残し、横で経営機能を担うことにある、という戦略整理。
- 内部裏取り候補: CX、SX、VSXなどの未設立又は設立前後の研究シーズ案件。

外に出してよい抽象表現:

- 「法人設立前又は設立準備中の研究シーズ」
- 「大学、研究機関又は企業研究所に由来する技術シーズ」
- 「事業化判断に必要な技術成熟度、顧客候補、知財、チーム、資金等の情報が未整備な段階」

NDA下なら口頭説明可:

- AMDが複数の研究機関発シーズをBefore 0段階から扱っていること。
- 研究者、研究機関、外部CEO候補、VC、事業会社候補を横断して事業化判断を行う実務があること。

口頭限定:

- どの案件で、どのタイミングで、どの相手と設立時期や顧客候補を議論したか。

出願書類に書かない営業秘密:

- 個別技術の未公開詳細、未公開出願内容、契約条件、個人名、顧客候補名、投資家名、具体的な資金計画。

### 2.2 会議録 / カレンダー / クラウド文書 / 月次レポート

裏取り候補:

- `pwa/design/L2_DATA.md`: Gmail、Drive、Calendar、Slack、Notionの5生データからL2へ直接抽出する正本フロー。
- `pwa/spec/3-2-monthly-reports-current-spec.md`: 月次レポートは5生データ + OS snapshotを入力にし、source refsやshort snippetを扱う。
- `pwa/spec/3-3-meeting-flow-current-spec.md`: Calendar、Notion、Gmail、Drive、Slack、PWAを横断するmeeting flow。
- `pwa/design/project_strategy_signals.md`: 経営ハイライトは5生データからsource refs、date、title、short snippet、hashを持つ。

外に出してよい抽象表現:

- 「電子メール、クラウド文書、カレンダーイベント、チャット、会議録、月次レポート等の複数業務データ源」
- 「全文を正本保存せず、source type、日付、title、short snippet、hash、extraction run id等の証拠メタデータを保持する」

NDA下なら口頭説明可:

- AMD OSが複数connector由来の情報をL2データに変換する設計を持つこと。
- 月次レポート、会議サマリ、経営ハイライト、プロトコル抽出が相互に入力になること。

口頭限定:

- 実際のconnector構成、運用PC、outbox/applierの運用状態、抽出スケジュールの細部。

出願書類に書かない営業秘密:

- connector認証、監視・復旧手順、watch対象path、source permalink、production DB row、具体的な抽出ログ。

### 2.3 顧客候補検証

裏取り候補:

- `/Users/masa/projects/knowledge/amd_value_model.md`: 研究機関発シーズの事業化において、顧客候補、用途、契約形態、資金経路を分けて整理する運用。
- `pwa/design/seeds.md`: 研究シーズのAMD視点評価、次アクション、接触履歴、PJ化の流れ。
- 内部裏取り候補: CX、SX、VSX、ZMP系の用途探索・PoC候補探索・事業会社接続の経験。

外に出してよい抽象表現:

- 「顧客候補又は用途候補との検証を優先すべき旨の候補データ」
- 「外部連携、顧客候補状態、検証進捗、知的財産関連状態を入力カテゴリに含む」
- 「候補の種別が狭すぎる場合にレビュー担当者がコメントし、後続の抽出条件又は判定ルールに反映する」

NDA下なら口頭説明可:

- AMDが研究シーズごとに、初期顧客、PoC候補、共同開発候補、資金提供候補を並べて検証していること。

口頭限定:

- 顧客候補の業界・企業名、商談の有望度、提案価格、投資家又は共同研究先との交渉状況。

出願書類に書かない営業秘密:

- 顧客候補リスト、個別企業の反応、商談ログ、価格、契約条件、未公開用途仮説。

### 2.4 comment feedback

裏取り候補:

- `pwa/spec/3-7-notifications-current-spec.md`: 候補は通知表示だけでは正本反映されず、「はい / いいえ / comment」が`l2_feedbacks`へ保存される。
- `pwa/design/project_strategy_signals.md`: コメントは`l2_feedbacks`に保存され、次回automationの入力に含める設計。
- `pwa/design/amd_protocol.md`: protocol候補ごとに修正依頼・却下・確定ができ、個別feedbackを抽出に取り込む設計。
- `pwa/design/feedback_dialog.md`: feedbackを単発でなく対話履歴として残す構想。

外に出してよい抽象表現:

- 「承認、却下、又はコメントを受け付ける確認インターフェース」
- 「却下又はコメントに基づくフィードバックデータを、後続候補生成処理の抽出スコープ、抽出条件、判定ルール、信頼度判定、設定値又はワークフロー定義へ反映する」

NDA下なら口頭説明可:

- AMD OSでは、候補L2の採否とコメントを保存し、次回抽出に参照する設計があること。

口頭限定:

- 実際のレビュー担当者、レビュー会議体、どの案件でどんな修正指示が出たか。

出願書類に書かない営業秘密:

- comment-to-guidance変換ロジック、promptへの具体注入方式、実コメント全文、few-shot、negative examples。

### 2.5 protocol化

裏取り候補:

- `/Users/masa/projects/knowledge/amd_os_vision.md`: AMDプロトコルは、分岐点、判断材料、アクション、結果・学習で経営判断を構造化する差別化資産。
- `pwa/design/amd_protocol.md`: `protocols`は普遍的な意思決定パターン、`protocol_examples`は具体事例、1 protocol : N examplesで管理する。
- `pwa/spec/3-9-l2-protocol-current-spec.md`: meeting summaries、monthly reports、feedbackを入力に、固有名詞を避けたprotocolをcandidateとして作る。

外に出してよい抽象表現:

- 「プロジェクト固有名詞を除去又は抽象化した意思決定パターン」
- 「分岐点、判断材料、アクション、結果カテゴリを含む事業化判断プロトコル」
- 「同一又は類似の意思決定パターンに複数のプロジェクト固有事例を関連付ける」

NDA下なら口頭説明可:

- AMDが複数案件の経営判断をプロトコル化し、URA/EIR等へ移転可能な判断知にする戦略を持つこと。

口頭限定:

- どの実案件がどのprotocolの裏取りになっているか。

出願書類に書かない営業秘密:

- 実PJ事例本文、個別の分岐点・判断材料・アクション・結果の詳細、案件名と結果の紐付け。

### 2.6 outcome 1m / 6m / 24m

裏取り候補:

- `pwa/design/amd_protocol.md`: `protocol_result_observations`はappend-onlyで、1m / 3m / 6m / 12m / 24m / long_termのhorizonを持つ。
- `pwa/spec/3-9-l2-protocol-current-spec.md`: 結果は`result=NULL`から後追いし、観測時点、horizon、valence、confidence、summaryを保存する。
- `pwa/design/project_strategy_signals.md`: 経営ハイライトが、状態変化や戦略シグナルを短い根拠付きで保持する。
- `pwa/spec/3-2-monthly-reports-current-spec.md`、`pwa/spec/3-3-meeting-flow-current-spec.md`: 月次レポートと会議サマリが後追い観測の入力になり得る。

外に出してよい抽象表現:

- 「アクション後の結果を、1か月、6か月、24か月等の複数評価期間カテゴリでappend-onlyに保存する」
- 「同一判断についてpositive及びnegative等の異なる観測が共存しても上書きしない」
- 「会議録、月次レポート、状態変化記録、戦略シグナル等の異種証拠参照を関連付ける」

NDA下なら口頭説明可:

- AMDの案件では、短期では良く見えた判断が長期で副作用を持つ、又は短期では弱く見えた判断が長期で効く、という実務経験があり、単一の最終結果では足りないこと。

口頭限定:

- どの判断がどの時点でpositive / negative / mixedに見えたか。

出願書類に書かない営業秘密:

- 24か月以降の具体outcome、成功/失敗ラベル、教師データ、案件別の解釈、投資・顧客・契約の実結果。

### 2.7 pending proposal / version governance

裏取り候補:

- `docs/ip/2026-06-01_patent_application_draft_internal.md`: 抽象テーブルとして`system_parameter`、`parameter_proposal`、`parameter_version`を定義済み。
- `pwa/design/score_revision_feedback_loop.md`: 未来予測修正、alpha proposal、承認後反映というpending proposal型の設計。
- `pwa/design/amd_protocol.md`、`pwa/spec/3-9-l2-protocol-current-spec.md`: prompt authorityをコードに直書きせず管理し、feedbackを後続抽出へ反映する思想。
- `pwa/design/project_strategy_signals.md`: candidate / confirmed / rejectedの採否とfeedbackを通じた改善ループ。

外に出してよい抽象表現:

- 「抽出ルール、判定ルール、設定値、スコアリングモデル、ワークフロー定義等の複数種類のシステムパラメータ」
- 「変更候補をpending proposalとして保存し、確認インターフェースで承認された場合に限り新規versionとして保存する」

NDA下なら口頭説明可:

- AMD OSでは、評価モデルや抽出設定を人間承認なしに本番反映しない設計思想があること。

口頭限定:

- どの設定種別を、どの頻度で、誰が見直しているか。

出願書類に書かない営業秘密:

- 実weight、threshold、calibration、model選定、fallback、temperature、chunking、retrieval条件、実prompt。

### 2.8 Before-Zero設立時期推奨

裏取り候補:

- `/Users/masa/projects/knowledge/amd_value_model.md`: AMDはBefore 0に特化し、研究者を研究者のまま残して経営機能を引き受ける。
- `/Users/masa/projects/knowledge/amd_os_vision.md`: AMD OSはBefore Zero Modelの実証ベースであり、URA/EIRが事業化前段階で当事者として参画する基盤。
- `pwa/design/seeds.md`: 研究シーズのstatus遷移とPJ化。
- `pwa/design/institution_readiness.md`: 研究機関側の制度・EIR/CXO・資金・支援体制を評価するERS。
- 内部裏取り候補: CX、SX、VSX等で、技術成熟度、顧客候補、CEO/CXO、資金、知財、制度対応を見ながら設立時期を検討した経験。

外に出してよい抽象表現:

- 「法人設立前研究シーズについて、研究シーズ段階、検証進捗、知財状態、外部連携又は顧客候補状態、チーム状態、資金又は制度対応状態、結果観測カテゴリに基づき、設立時期推奨データを生成する」
- 「推奨カテゴリは即時設立、一定期間後、追加検証後、保留等でよい」

NDA下なら口頭説明可:

- AMDが複数のBefore 0案件で、技術成熟度、PoC、知財、CEO候補、資金、研究者コミットメントを見ながら設立時期を判断していること。

口頭限定:

- 案件ごとの設立予定月、資金調達の見込み、CEO候補、研究機関又はVCとのやりとり。

出願書類に書かない営業秘密:

- 設立時期推奨の実判定条件、weight、threshold、案件別の設立延期/前倒し理由、個別資金計画、未公開技術・知財戦略。

## 3. 開示区分まとめ

| 構成要素 | 明細書に書いてよい抽象表現 | NDA下なら口頭説明可 | 口頭限定 | 出願書類に書かない営業秘密 |
|---|---|---|---|---|
| 研究シーズA | 法人設立前又は設立準備中の研究シーズ | 複数の研究機関発シーズを扱う実務 | どの案件が該当するか | 未公開技術、契約、個人名、案件固有文脈 |
| 複数source | メール、文書、カレンダー、チャット、会議録、月次レポート等 | L2が5生データから構成されること | connector運用の実態 | source permalink、本文、DB row、認証・監視 |
| 顧客候補検証 | 顧客候補又は用途候補の検証を優先する候補 | PoC候補や用途探索の実務 | 顧客・業界・商談状況 | 顧客リスト、価格、契約条件、商談ログ |
| feedback | コメントを抽出条件又は判定ルールへ反映 | 採否・コメントを次回抽出へ参照する設計 | レビュー会議体・実コメント | prompt変換ロジック、few-shot、実コメント全文 |
| protocol化 | 分岐点、判断材料、アクション、結果カテゴリの抽象protocol | AMDプロトコルの社内運用 | 案件とprotocolの対応 | 実PJ事例本文、判断材料詳細、結果詳細 |
| outcome | multi-horizon append-only観測 | 長期で解釈が変わる実務経験 | どの判断がどう変わったか | 成功/失敗ラベル、教師データ、案件別outcome |
| governance | pending proposal -> approval -> version | 人間承認付き設定改訂思想 | 誰がどう見直すか | weight、threshold、calibration、prompt、model条件 |
| 設立時期推奨 | 入力カテゴリと推奨カテゴリ | Before 0設立判断の実務 | 具体予定月・資金・CEO候補 | 実判定条件、案件別判断、資金計画 |

## 4. 実施例を少し具体化する安全案

以下はいずれも、実案件名なし、実データなし、source permalinkなし、prompt / score weight / calibrationなしで使える案。

### 安全案A: 顧客候補検証の広狭をfeedbackで直す例

ある法人設立前の研究シーズについて、情報処理装置は、会議記録、予定イベント、クラウド文書、及び月次活動記録への参照から、顧客候補検証に関する候補データを生成する。候補データは、例えば「特定用途の顧客候補との検証を優先する」という要約を含む。

確認インターフェースにおいて、レビュー担当者は、当該候補の根拠となるsource type、日付、短い抜粋、hash、抽出処理識別子、信頼度を確認する。レビュー担当者が「用途候補を狭く限定しすぎている」とコメントした場合、情報処理装置は、当該コメントを、後続の候補生成処理における抽出条件又は判定ルールの変更候補として保存する。

当該候補が承認された場合、情報処理装置は、個別シーズ名及び顧客名を除去し、「初期用途候補の探索幅を狭めすぎないための検証優先度判断」という事業化判断プロトコルを生成又は更新する。後続の別シーズで類似判断が生じた場合、当該別シーズの事例を同一又は類似のプロトコル識別子に関連付ける。

### 安全案B: 設立時期推奨とmulti-horizon outcomeの例

ある法人設立前の研究シーズについて、情報処理装置は、技術成熟度に関する候補、知的財産関連状態、顧客候補又は外部連携状態、チーム状態、資金又は制度対応状態、及び過去の結果観測カテゴリを参照する。情報処理装置は、不足又は矛盾するカテゴリを識別し、当該研究シーズについて「追加検証後に設立」等の設立時期推奨カテゴリを生成する。

その後、情報処理装置は、当該推奨に基づくアクション後の結果を、1か月後、6か月後、24か月後等の評価期間カテゴリでappend-onlyに保存する。1か月後に外部連携が進んだことを示すpositive観測があり、24か月後に資金又はチームに関するnegative観測が生じた場合でも、情報処理装置は一方を上書きせず、異なるhorizon及びvalenceを持つ結果観測として確認インターフェースへ提示する。

この例では、実案件名、顧客名、研究機関名、個人名、実スコア、判定weight、threshold、calibration、実source本文は使用しない。

## 5. 弁理士に確認すべき質問（5個以内）

1. 上記の「安全案A/B」程度の具体性で、prompt、score weight、実データ、実案件名を出さずに実施可能要件・サポート要件を満たせるか。
2. 「顧客候補の種別を限定しすぎている」というfeedback例は、抽出条件・判定ルールへの抽象反映として十分か。prompt注入まで書く必要があるか。
3. `研究シーズA` の裏取りとして、NDA下口頭で実案件カテゴリを説明するだけで足りるか。明細書には完全匿名の合成例だけでよいか。
4. multi-horizon outcomeの1m / 6m / 24m例は、FHIR/OMOP等の一般的な観測データとの差別化として、経営判断protocol及び矛盾観測UIと組み合わせれば十分か。
5. Before-Zero設立時期推奨は、入力カテゴリと推奨カテゴリの抽象例だけで足りるか。実weight、threshold、calibrationを出さない場合に補うべき図面・フロー表現はあるか。

## 6. 参照した内部資料

内部確認で参照した資料。外部送付時は、この一覧も共有範囲を削る。

- `docs/ip/2026-06-01_patent_application_draft_internal.md`
- `docs/ip/2026-06-01_claim_support_matrix_internal.md`
- `docs/ip/2026-06-01_patent_attorney_initial_consultation_pack.md`
- `docs/ip/2026-06-01_claim_revision_internal.md`
- `commander_tasks/ip_patent_COMMANDER_TASKS.md`
- `pwa/design/L2_DATA.md`
- `pwa/spec/3-2-monthly-reports-current-spec.md`
- `pwa/spec/3-3-meeting-flow-current-spec.md`
- `pwa/spec/3-7-notifications-current-spec.md`
- `pwa/spec/3-9-l2-protocol-current-spec.md`
- `pwa/design/amd_protocol.md`
- `pwa/design/project_strategy_signals.md`
- `pwa/design/score_revision_feedback_loop.md`
- `pwa/design/seeds.md`
- `pwa/design/institution_readiness.md`
- `/Users/masa/projects/knowledge/amd_os_vision.md`
- `/Users/masa/projects/knowledge/amd_value_model.md`
- `/Users/masa/projects/knowledge/cx.md`
- `/Users/masa/projects/knowledge/sx.md`
