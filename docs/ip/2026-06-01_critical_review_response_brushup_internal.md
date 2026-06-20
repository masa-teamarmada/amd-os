# AMD OS / AMDプロトコル 批判的弁理士レビュー 打ち返し・ブラッシュアップ方針（内部版）

- 作成日: 2026-06-01
- 位置づけ: `2026-06-01_critical_patent_attorney_review_internal.md` を受けた司令塔側の打ち返し整理。
- 共有制限: 外部送付禁止。弁理士送付禁止。このままメール添付・Drive共有・チャット共有しない。

## 0. 結論

批判レビューは妥当。いまの出願準備は「出願不能」ではなく、弁理士相談前に以下を補えばかなり強くなる。

1. 主請求項を二段構えで相談する。
2. BigID / FHIR / OMOP / Ciena / Seek AI / Glean への逃げ方を明細書本文・図面・相談パックに明示する。
3. 合成実施例を、抽象レコード遷移で一段具体化する。
4. WS-5 generic parameter governance と WS-6 Before-Zero設立時期推奨は、基幹出願に強く入れすぎず、従属項・分割候補として扱う。
5. 外部相談用削除版に、1ページの請求項ツリーと先行技術別の打ち返しを添える。

## 1. 打ち返し方針

| 批判 | 打ち返し | 反映先 |
|---|---|---|
| WS-1〜WS-5が既存技術の寄せ集めに見える | 単体要素ではなく、同一対象PJ・同一候補系列で `evidence -> review -> master -> protocol -> outcome -> parameter` が連鎖する点を主張する | claim / spec / figure |
| 請求項1が広くも狭くも危ない | 独立請求項Aを `HITL + feedback + approved-only master`、独立又は従属請求項Bを `protocol/outcome閉ループ` として相談する | claim / attorney pack |
| 全文非保存がBigIDに刺さる | 「全文非保存」単体ではなく、「正本DBへ全文非保存 + 短い抜粋 + run単位evidence + HITL + 正本反映 + protocol化」のセットで書く | claim / spec |
| outcome ledgerがFHIR/OMOPに近い | `protocol/action後の観測`、`矛盾観測の並列表示`、`異種evidence参照` を不可分にする | claim / spec / figure |
| WS-5がCiena/MLOpsに近く、現OSもpartial | 基幹出願では従属項又は分割候補。残す場合は複数parameter type共通のproposal/version構造を抽象実施例で支える | claim / spec |
| WS-6が適用先変更に見える | 主軸にしない。法人設立前の欠落/矛盾カテゴリ、長期outcome、protocol参照に基づく補強項として扱う | claim / spec |
| 合成実施例が抽象的 | 実データなしで、入力カテゴリ、候補、feedback、master、protocol、outcome、proposal、recommendationの抽象レコード遷移表を追加する | spec |
| 外部相談用削除版が抽象的 | 1ページ請求項ツリー、先行技術別逃げ方、未実装要素の扱いを追加する | attorney pack |

## 2. 請求項ブラッシュアップ

弁理士相談では、次の二段構えを持っていく。

### 主請求項A候補: HITL正本化ループ

狙い:
- Seek AI / Glean / 一般HITL抽出との差分を、approved-only master reflection と reject/comment feedback の永続化で出す。
- protocol生成を必須にせず、競合がprotocolを外しても牽制できる形を検討する。

含める要素:
- 複数業務データ源。
- 事業化判断候補の生成。
- 証拠メタデータ付与。
- 確認インターフェース。
- 承認済みのみ正本反映。
- 却下/コメントを後続候補生成へ反映。

### 主請求項B候補: protocol/outcome閉ループ

狙い:
- HITL抽出一般からさらに離し、AMD OSらしい意思決定protocol資産化を押さえる。
- FHIR/OMOPやcase-baseとの差分として、事業化判断protocol、project-specific example、multi-horizon outcome、矛盾観測、異種evidence参照を連鎖させる。

含める要素:
- 承認済み正本レコード。
- 固有情報を抽象化したprotocol生成。
- 1 protocol : N project examples。
- action後のmulti-horizon outcome。
- 同一horizon異valenceの並列提示。
- 異種evidence参照。

### 分割候補

- WS-5: system parameter governance。
- WS-6: Before-Zero設立時期推奨。
- UI/audit trail/export系の侵害検出用従属項。

## 3. 明細書補強案

### 3.1 技術課題の言い換え

弱い表現:
- 研究シーズの事業化判断を支援する。

強い表現:
- 複数業務データ源からAI等により生成された候補を、根拠証拠、人間確認、正本反映、後続処理へのfeedback、抽象protocol化、結果観測へ一貫して接続し、誤抽出の正本混入と判断履歴の断絶を抑制する。

### 3.2 先行技術別の逃げ方

| 先行技術カテゴリ | 攻撃される点 | 明細書で厚くする差分 |
|---|---|---|
| BigID系 | 全文非保存、metadata、confidence | 正本DB非保存に加え、HITL、approved-only master、protocol/outcomeへの連鎖を強調 |
| Seek AI / Glean系 | 複数source抽出、enterprise knowledge | 事業化判断候補の正本化、reject/comment feedback、protocol化、outcome追跡を強調 |
| FHIR / OMOP系 | observation、horizon、append-only | 医療観測ではなく、事業化判断protocol/action後の矛盾観測と異種evidence参照を強調 |
| Ciena / MLOps系 | proposal、approval、version | model registryではなく、抽出・判定・workflow等の複数parameterを事業化判断ループへ接続 |
| CRM/BI/decision intelligence | dashboard、decision log | evidence付き候補の承認制、正本反映、再利用protocol、feedback loopを強調 |

### 3.3 合成実施例の抽象レコード遷移

| step | 抽象データ | 生成/更新内容 | 秘匿するもの |
|---|---|---|---|
| 1 | source reference | source type、日付、title、短い抜粋、hash、run id | 実source所在、全文、長いsnippet |
| 2 | candidate data | 顧客候補検証、知財状態、チーム状態等の候補 | 実PJ本文、顧客名 |
| 3 | review feedback | approve/reject/comment、comment summary、target category | 実コメント全文、prompt変換 |
| 4 | master record | 承認済み候補のみ正本化 | production DB row |
| 5 | protocol | 固有名詞を除いた分岐点、判断材料、action、result category | 実protocol本文、案件名 |
| 6 | outcome observation | horizon、valence、confidence、summary、evidence role | 実outcome本文、成功/失敗ラベル |
| 7 | parameter proposal | feedbackに基づく抽出条件/判定ルール等の変更候補 | prompt全文、score weight |
| 8 | recommendation | 不足/矛盾カテゴリに基づく設立時期推奨カテゴリ | 実判定条件、threshold |

## 4. 図面補強案

- Fig.1: WS-1〜WS-4を主ループ、WS-5/WS-6を補助/拡張として描く。
- Fig.2: evidence metadataだけで終えず、pending候補とreview状態へ接続する。
- Fig.3: 未承認候補が正本へ行かない分岐を太くする。
- Fig.4: `MASTER_RECORD -> PROTOCOL -> EXAMPLE -> OUTCOME -> EVIDENCE_REF` の鎖を明確化する。
- Fig.5: FHIR/OMOP回避の生命線として、同一horizon異valenceの並列表示と異種evidence refsを入れる。
- Fig.6: Ciena/MLOps回避として、複数parameter typeへの共通proposal/version構造を描く。
- Fig.7: Before-Zeroを主軸に見せすぎず、従属/補強として描く。
- Fig.8: 単一画面ではなく「確認インターフェース又は関連画面群」に統一する。

## 5. 外部相談パックへの反映

外部相談では、次の4点セットに絞る。

1. 1〜2ページ概要。
2. 請求項ツリー案。
3. 公開済み資料棚卸し要約。
4. 発明者/出願人整理。

送らず口頭で扱うもの:
- 現OS乖離チェック。
- 合成実施例裏取り。
- 図面清書指示メモ。
- 営業秘密境界の詳細。

## 6. まさ判断事項

1. 主請求項をA/B二段構えで弁理士に相談する前提でよいか。
2. WS-5を分割候補寄りに下げる前提でよいか。
3. WS-6を従属/補強に留め、独立化は弁理士相談後にする前提でよいか。
4. 出願前に outcome UI / 複数evidence ref / generic parameter governance の最小retrofitをやるか。
5. 初回相談資料を4点セットに絞るか。

## 7. 次アクション

1. `2026-06-01_claim_tree_external_review_internal.md` を外部相談前レビュー用の1ページ請求項ツリーとして追加する。
2. 明細書たたき台へ、技術課題、先行技術別の差分、抽象レコード遷移表を追加する。
3. 外部相談用削除版パックへ、請求項ツリーと正式サーチ確認事項への参照を追加する。
4. 批判レビュー反映後の資料をもう一度営業秘密scanする。
