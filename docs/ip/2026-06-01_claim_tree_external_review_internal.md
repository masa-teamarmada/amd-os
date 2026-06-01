# AMD OS / AMDプロトコル 請求項ツリー案（外部相談前レビュー用・内部版）

- 作成日: 2026-06-01
- 位置づけ: 弁理士初回相談で請求項構成を議論するための内部ドラフト。
- 共有制限: 外部送付禁止。弁理士送付禁止。このまま送らない。

## 0. 目的

批判的レビューを踏まえ、主請求項を1本に詰め込みすぎず、弁理士へ次の二段構えを相談する。

## 1. 請求項ツリー

```text
独立候補A: HITL正本化ループ
  A1 複数業務データ源から事業化判断候補を生成
  A2 証拠メタデータを候補に関連付け
  A3 候補と証拠を確認インターフェースへ提示
  A4 承認済み候補のみ正本へ反映
  A5 却下/コメントを後続候補生成へ反映

独立候補B: protocol/outcome閉ループ
  B1 承認済み正本レコードから抽象protocolを生成
  B2 1 protocol : N project examples を保存
  B3 protocol/exampleに紐づくaction後outcomeをmulti-horizonでappend-only保存
  B4 同一horizon異valenceを上書きせず並列提示
  B5 outcomeに複数異種evidence refsを関連付け

従属/分割候補C: system parameter governance
  C1 複数種類parameterのpending proposal
  C2 human approval後のみnew version
  C3 past version保持
  C4 feedback loopとの接続

従属/補強候補D: Before-Zero設立時期推奨
  D1 法人設立前研究シーズ
  D2 欠落/矛盾カテゴリ識別
  D3 protocol/outcome参照
  D4 設立時期推奨カテゴリ生成

従属候補E: UI / audit / infringement visibility
  E1 候補、証拠、review状態の表示
  E2 protocol、outcome、proposalの少なくとも一部表示
  E3 同一画面又は関連画面群
```

## 2. 弁理士に確認すること

| 論点 | 確認したいこと |
|---|---|
| 独立候補A | HITL正本化ループだけで先行技術との差が出るか |
| 独立候補B | protocol/outcome閉ループを独立候補にするか、Aの従属にするか |
| WS-5 | 基幹出願に従属項で残すか、分割候補として温存するか |
| WS-6 | 従属/補強に留めるか、別独立候補も残すか |
| UI項 | 侵害検出用に有効か、不要に狭くなるか |

## 3. 先行技術別の逃げ方

| 攻撃される相手 | 逃げ方 |
|---|---|
| BigID系 | 全文非保存ではなく、正本DB非保存、短い抜粋、run単位evidence、HITL、正本反映、protocol化のセット |
| Seek AI / Glean系 | 単なるenterprise extractionではなく、事業化判断候補の正本化、feedback、protocol/outcomeまでの閉ループ |
| FHIR / OMOP系 | observation schemaではなく、事業化判断protocol/action後のmulti-horizon outcome、矛盾観測UI、異種evidence参照 |
| Ciena / MLOps系 | model/version approvalではなく、抽出/判定/workflow等の複数parameterを事業化判断ループへ接続 |
| CRM/BI系 | dashboardではなく、証拠付き候補、approved-only master、reusable protocol、feedback loop |

## 4. 出願書類に書かないもの

- prompt全文、few-shot、comment-to-guidance変換ロジック。
- score weight、threshold、calibration。
- 実PJ本文、実source所在、production DB row。
- 顧客名、個人名、契約条件、未公開知財詳細。
- connector認証、監視、復旧、watch path。

## 5. 相談時の推奨スタンス

- 基幹はA/Bのどちらを主にするかを弁理士と決める。
- WS-5は分割候補寄り。
- WS-6は従属/補強寄り。
- 侵害検出はUI/audit系の従属項と契約/NDAで補完する。
