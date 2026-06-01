# AMD OS / AMDプロトコル 批判的弁理士レビュー（内部版）

- 作成日: 2026-06-01
- 位置づけ: 出願前の内部critical review。法的助言ではなく、弁理士相談前に弱点を潰すための検討材料。
- 共有制限: 外部送付禁止。弁理士送付禁止。このままメール添付、Drive共有、チャット共有しない。
- 作業範囲: 既存の明細書案、請求項案、請求項対応表、外部相談用削除版、開示制御版、図面清書指示メモ、現OS乖離チェック、合成実施例裏取り、公開棚卸し、2026-05-27提案書、先行技術一次スクリーニングをread-onlyで確認。
- 未実施: Web検索、正式公報サーチ、DB接続、production DB確認、外部送付。

## 0. 総評

このまま出すと刺される場所は、単体要素の新規性よりも、**「既存技術を横に並べただけではないか」** と **「強く書いた要素の実施可能性・現実装裏付けが薄いのではないか」** の2点。

辛口に言うと、以下が危ない。

1. **WS-1〜WS-5のAND結合が、審査官には「既存HITL抽出 + 既存evidence metadata + 既存case-base + 既存longitudinal observation + 既存MLOps approval」の寄せ集めに見える。**
   打ち返すには、各要素の横並びではなく、`reject/comment feedback -> approved-only master reflection -> abstract protocol -> outcome -> parameter governance` が同じ正本データ構造上で相互参照される必然性を厚く書く必要がある。

2. **請求項1が広くも狭くも危ない。**
   protocol生成まで入れると回避容易になる一方、外すとSeek AI / Glean / HITL extraction系に飲まれる。主請求項を1本だけで勝負せず、`HITL + feedback + approved-only master` の独立系と、`protocol/outcome` まで含む閉ループ系の二段構えを弁理士に検討してもらうべき。

3. **「全文非保存」はBigIDに刺される。**
   全文非保存だけで強く押すと危ない。`正本DBには全文を保存しない`、`証拠メタデータと短い抜粋`、`人間承認と正本反映の後段処理` のセットに落とすべき。

4. **outcome ledgerはFHIR/OMOPにかなり近い。**
   multi-horizon / valence / append-onlyだけでは医療系の観測データを事業化判断に置き換えただけに見える。矛盾観測を意思決定者に併記するUI、protocol/exampleとの結合、異種evidence参照を請求項と明細書で不可分にする必要がある。

5. **WS-5 / WS-6 / Fig.8は実装・実施例の薄さを突かれる。**
   汎用parameter governance、設立時期推奨、統合確認UIは現OSではpartial又はnot-found寄り。基幹出願に残すなら抽象実施例と図面を厚くする。強く取りにいくなら出願前retrofitも検討。

6. **外部相談用削除版は安全寄りだが、弁理士が「結局どこが発明なのか」を掴むにはまだ抽象的。**
   営業秘密を守る姿勢は正しい。ただし、相談前に1ページの「請求項ツリー案」「先行技術別の逃げ方」「未実装要素の扱い」を付けないと、初回相談が一般論で終わるリスクがある。

7. **権利行使moatとしては弱め。**
   相手の内部実装に入らないと侵害検出が難しい要素が多い。特許だけで競合排除を狙うより、NDA、共同研究契約、提案資料、営業秘密管理、出願中表示の交渉カードとして設計する方が現実的。

## 1. 重大ツッコミ表

| issue | severity | attacked by | why it hurts | current support | recommended counter | modify |
|---|---|---|---|---|---|---|
| WS-1〜WS-5が既存技術の単純寄せ集めに見える | high | 審査官 / 競合 | BigID、Seek AI、Glean、FHIR/OMOP、Ciena、MLOps registryの組合せで容易想到と言われる | 請求項1〜12、先行技術screening、support matrix | 「単体要素」ではなく、同一対象PJ・同一候補・同一evidenceから正本、protocol、outcome、parameterへ連鎖するデータ依存を明細書に明記 | claim / spec / figure |
| 請求項1が長く、protocol生成まで必須にすると回避容易 | high | 競合 / 弁理士 | HITL抽出 + feedbackまでは真似して、protocol生成だけ外せば非侵害にしやすい | claim revisionでも論点化済み | 独立請求項AはHITL + feedback + approved-only master、独立又は従属請求項Bでprotocol/outcome閉ループを取る二段構えを相談 | claim |
| 請求項1からprotocol生成を落とすと先行技術に飲まれる | high | 審査官 | HITL extractionやenterprise knowledge assistantとの差が薄くなる | 請求項1、prior art A軸 | protocolを落とす場合でも、approved-only master reflectionとreject/comment feedbackの後続反映を不可欠要件にする | claim / spec |
| `全文非保存` がBigIDに直撃される | high | 審査官 / 競合 | 文書メタデータのみ、本文アクセスなし、confidenceという構成が近い | prior art C軸、OS gap audit | 「全文非保存」単体を発明の核にしない。正本DB非保存、短い抜粋、run単位evidence、HITL、正本反映、protocol化のセットで書く | claim / spec |
| feedbackを「prompt注入」と書くと営業秘密と回避容易性の両方が出る | high | 弁理士 / 競合 | prompt注入の具体を出すと秘密を失い、promptを使わない実装に回避される | claim 5、明細書7、14.4 | 「抽出条件、判定ルール、信頼度判定、設定値、ワークフロー定義への反映」に広げ、promptは例示に留める | claim / trade secret |
| outcome ledgerがFHIR/OMOPの置換に見える | high | 審査官 | append-only、horizon、valence、confidenceは医療観測schemaと機能的に近い | prior art E軸、claim 8-10 | protocol/exampleへの紐づき、矛盾観測の確認UI、異種evidence参照、経営判断アクション後の観測という4点を不可分にする | claim / spec / figure |
| WS-5 generic parameter governanceがCiena/MLOpsに近い | high | 審査官 / 競合 | AI提案、pending、人間承認、version保持は既存。MLOps registryも公知 | claim 11-12、prior art F軸 | 5種類以上ではなく「複数種類」だと弱い可能性。異種parameter横断、同一proposal/version pattern、事業化判断閉ループとの接続で差別化 | claim / figure |
| WS-5は現OS実装がscore-specificで、汎用parameter table/UIが薄い | high | 弁理士 / 審査官 | 実施可能要件・サポート要件で「できることを願望で書いている」と見られる | OS gap auditでpartial/not-found寄り | 基幹出願に残すなら抽象実施例を厚くし、可能なら最小retrofit。又は分割候補へ下げる | spec / figure / claim |
| WS-6設立時期推奨が「適用先が新しいだけ」に見える | high | 審査官 / 投資家 | Microsoft temporal prediction、人手GAP支援、post-founding readinessの適用変更と言われやすい | proposal、prior art G軸 | 主軸にしない。pre-incorporation固有の入力欠落、長期outcome、protocol参照、不足/矛盾カテゴリ識別を技術課題として厚く書く | claim / spec |
| 合成実施例が安全だが抽象的すぎる | medium | 弁理士 / 審査官 | 実施可能要件を満たすだけの具体的処理条件が見えにくい | application draft 15、traceability memo | 実データなしで、入力カテゴリ、処理ステップ、出力データ、UI表示、保存データをもう1段具体化する | spec / figure |
| Fig.8統合UIが現OSでは単一画面として未実装 | medium | 競合 / 弁理士 | 図面が現実より強く見える。単一画面限定なら狭い | figures brief、OS gap audit | 「同一画面又は関連画面群」「少なくとも一部」を維持し、単一画面に限定しない | claim / figure |
| 外部相談用削除版が安全すぎて、弁理士が請求項戦略を判断しづらい | medium | 弁理士 | 何を渡してよいかは分かるが、どの請求項を第一候補にするかが見えにくい | external review pack | 1ページで「主請求項候補A/B」「分割候補」「先行技術別逃げ方」を添付する | attorney pack |
| 公開済み資料棚卸しが未確認だらけ | high | 弁理士 / 投資家 | 新規性喪失、30条例外、外国出願リスクの判断ができない | public disclosure inventory | 資料名、日付、外部性、配布有無、NDA有無、発明コア有無だけの表を先に埋める | attorney pack |
| 侵害検出が内部処理依存で難しい | medium | 投資家 / 競合 | prompt反映、parameter version、evidence refsは外から見えない | claim 5, 10-12, 14 | UI、export、audit trail、提案書、NDA下説明で見える要素を従属項に残す。契約・営業秘密管理で補完 | claim / contract |
| 1出願にWS-1〜WS-6を詰め込みすぎ | medium | 弁理士 / 審査官 | 単一性、審査効率、補正余地、費用が悪化する | application draft、support matrix | 基幹はWS-1〜WS-4、WS-5は分割候補、WS-6は従属又は別独立候補として整理 | claim / attorney pack |

## 2. 請求項別ツッコミ（請求項1〜16）

### 請求項1

**ツッコミ**: 主請求項としては要素が多く、`複数業務データ源 -> evidence -> HITL -> approved-only master -> feedback -> protocol` まで全部必要になる。審査官にはAND結合で差別化しやすい一方、競合には一部を外されやすい。

**打ち返し案**: 請求項1をこのまま維持する場合は、「候補データ、証拠メタデータ、review feedback、master record、protocolが同一の対象プロジェクト及び同一候補系列で連鎖する」ことを明細書と図1〜4で強調する。

**修正案**: 弁理士へ、独立請求項を2系統にできるか確認する。A案はHITL + feedback + approved-only master、B案はprotocol/outcomeまで含む閉ループ。

### 請求項2

**ツッコミ**: データ源列挙は普通。メール、文書、カレンダー、チャット、会議録、ナレッジ、月次レポート、台帳は、enterprise searchやCRM/BIでも自然に出る。

**打ち返し案**: 請求項2自体で勝たない。請求項1のevidence生成とreview状態、請求項10の異種evidence参照へ接続する従属項と位置づける。

**修正案**: 「少なくとも二以上」を維持。外部制度情報を入れる場合は、Before-Zero文脈の従属項側で扱う。

### 請求項3

**ツッコミ**: 抽出処理識別子ごとの永続化は監査ログとして一般的。単体では弱い。

**打ち返し案**: `candidate status`、`review feedback`、`master reflection` と同じ抽出runに紐づく点を強調する。

**修正案**: 図2/図3/図4で、evidence metadataが候補、review、master、outcomeへ再利用される関係線を明確化。

### 請求項4

**ツッコミ**: approved-only反映はHITLシステムの基本で、新規性は薄い。

**打ち返し案**: 単なる承認ではなく、未承認候補が正本DBへ行かず、却下/コメントが後続候補生成へ戻る閉ループの一部として主張する。

**修正案**: 請求項1と5との接続を明細書で補強。図3で未承認分岐を太くする。

### 請求項5

**ツッコミ**: feedback反映は強いが、promptに寄せると先行文献と営業秘密の両方が怖い。逆に抽象化しすぎると「単に人間のコメントを参考にする」だけに見える。

**打ち返し案**: `feedback data`を、候補種別、適用範囲、対象parameter type、application modeを持つ永続データとして定義する。

**修正案**: 「入力プロンプト」は例示に落とし、抽出条件、判定ルール、信頼度判定、設定値、ワークフロー定義を同列にする。

### 請求項6

**ツッコミ**: 固有名詞除去と抽象protocol化は、lessons learned、CBR、meeting knowledge baseで攻撃される。

**打ち返し案**: 承認済み正本レコード由来であり、結果を予測せず後追いoutcomeへ接続し、同一protocolへ複数事例を紐づける点を強調する。

**修正案**: 「プロジェクト固有名詞を除去」だけでなく、「出典証拠識別子を保持したまま抽象化する」と書く。

### 請求項7

**ツッコミ**: 1:N事例構造は一般的。protocol idの作り方をhashに限定すると回避容易。

**打ち返し案**: hash、類似度判定、クラスタ、手動タグ、UUID等を含む広いidentity determinationを明細書に残す。

**修正案**: 請求項本文では「同一又は類似の意思決定パターンを識別するプロトコル識別子」とし、hashは実施例へ。

### 請求項8

**ツッコミ**: multi-horizon append-onlyはFHIR/OMOP/longitudinal DBで強く攻撃される。schema単独は危険。

**打ち返し案**: protocol又はproject-specific exampleに紐づく「アクション後」の結果であり、事業化判断の再利用に使う点を強調する。

**修正案**: 請求項8単独ではなく、請求項9/10とセットで読む構成へ。必要なら請求項8に「事業化判断protocol又は事例に紐づくアクション後」をより強く入れる。

### 請求項9

**ツッコミ**: 矛盾観測の表示UIは差別化点だが、UI限定で狭くなる。現OSでは未実装寄りなので実施可能性も突かれる。

**打ち返し案**: UIは「同一horizonで異なるvalenceを上書きせず提示する表示制御」として、単一画面に限定しない。

**修正案**: Fig.5と明細書10に、矛盾観測の並列表示、時系列表示、確認インターフェース又は関連画面群を明記。

### 請求項10

**ツッコミ**: 異種evidence参照は強いが、source permalinkや実DB行を書けないため、サポートが抽象に見える。

**打ち返し案**: `outcome_evidence_ref`のような中間関連データを抽象構造として示し、source category、evidence role、basis summaryで十分実施できることを説明する。

**修正案**: 図4/図5でevidence roleとsource categoryを入れる。ただし実source所在は出さない。

### 請求項11

**ツッコミ**: Ciena、SageMaker、MLflow、DataRobot、Dominoなどから「pending proposal -> approval -> version」は公知と言われる。

**打ち返し案**: MLOps modelだけではなく、prompt、rule、config、model、workflowなど複数種類を同一proposal/version patternで扱う点、かつ候補生成feedbackと接続する点を押す。

**修正案**: 基幹出願に残すなら、請求項11は従属項として弱め、分割候補の主請求項案を別途作る。

### 請求項12

**ツッコミ**: 「統一的に適用」は抽象的。どう統一するのか、どのデータ構造で統一されるのかが薄い。

**打ち返し案**: pending proposal、approval state、approved version、past version、effective_fromを共通フィールドとして扱うと明記。

**修正案**: 図6と抽象テーブルの対応を強化。現OSがpartialであることは外部相談で正直に伝える。

### 請求項13

**ツッコミ**: Before-Zero設立時期推奨は魅力的だが、審査官にはpost-founding readinessやtemporal predictionの適用先変更に見える。現OSの専用機能も薄い。

**打ち返し案**: 法人設立前ゆえに法人財務・顧客履歴が存在しない、入力が欠落・矛盾する、長期outcomeが必要、という技術的課題を明細書に厚く書く。

**修正案**: 従属項・補強扱いを基本にする。独立請求項化は弁理士相談後。

### 請求項14

**ツッコミ**: UI表示項目は侵害検出には効くが、狭くなる。競合はUIに表示せず内部処理だけにできる。

**打ち返し案**: 「少なくとも一部」を維持し、同一画面ではなく関連画面群も含める。UIは外部観測可能な従属項として割り切る。

**修正案**: Fig.8を「統合確認インターフェース又は関連画面群」に統一。

### 請求項15

**ツッコミ**: 装置クレームとしては定型だが、機能部とハードウェア構成要素番号が未整理。

**打ち返し案**: 図1でプロセッサ、メモリ、ストレージ、通信IF、表示制御部、各機能部に番号を振る。

**修正案**: 弁理士に形式整備依頼。内部では図1清書指示を補強。

### 請求項16

**ツッコミ**: プログラムクレームとしては定型。日本出願では表現を弁理士に任せるべき。

**打ち返し案**: 方法請求項のサポートをそのまま転用できるよう、疑似フロー14.1〜14.8を請求項に対応させる。

**修正案**: 必要なら記録媒体クレームも弁理士に確認。

## 3. 明細書・実施例へのツッコミ

1. **課題が広い。**
   「研究シーズの事業化判断を支援する」だけだとビジネス課題に見える。技術課題として、複数業務データ源から生成されたAI候補を、証拠メタデータ、人間承認、正本反映、feedback、protocol/outcomeに一貫接続するデータ整合性の問題として書く。

2. **先行技術との差分が本文にまだ薄い。**
   BigID、FHIR/OMOP、Ciena、Seek AI/Gleanに対する逃げ方は別資料にはあるが、明細書本文の背景・課題・効果にまだ十分入っていない。出願版では、公知技術を直接名指しするかは弁理士判断として、少なくとも差分構造は本文に入れる。

3. **合成実施例A/Bは安全だが、処理の入出力が抽象的。**
   実案件名を出さずに、`入力カテゴリ -> 候補データ -> review feedback -> master record -> protocol -> outcome -> recommendation` のデータがどう変化するかを表で示すと強い。

4. **WS-5の実施例が願望に見える。**
   `system_parameter`、`parameter_proposal`、`parameter_version`は抽象テーブルとしてあるが、現OSはscore-specific寄り。基幹に入れるなら、少なくともprompt/rule/config/model/workflowのうち2〜3種類に同じ処理を適用する抽象例を加える。

5. **WS-6の設立時期推奨は、営業秘密を避けるほど実施可能性が薄くなる。**
   weight/thresholdを出さないのは正しい。その代わり、不足カテゴリ、矛盾カテゴリ、参照record、推奨カテゴリの生成フローをもう少し具体化する。

6. **「全文非保存」の表現が強すぎる。**
   現OSでは短文cacheや抜粋の扱いがある。明細書は「正本データベースには元データ全文を保存しない」「所定長以下の抜粋又はメタデータを保存」に寄せる。

7. **効果の記載が経営効果に寄りすぎる可能性。**
   技術効果として、誤抽出の正本混入防止、証拠参照の省容量保存、feedback dataの再利用、矛盾観測の非破壊保持、parameter version監査を前面に出す。

## 4. 図面へのツッコミ

1. **Fig.1は全部入りで、1発明に見えにくい。**
   WS-5/WS-6は末端又は補助機能として描き、主ループはWS-1〜WS-4に見えるようにする。

2. **Fig.2はBigID回避の線が弱い。**
   evidence metadataだけでなく、pending候補、review状態、approved-only反映への接続を示す。metadataだけの図にしない。

3. **Fig.3は最重要。**
   未承認候補が正本に行かない分岐、reject/commentがfeedback dataとして永続化される分岐、feedbackが後続候補生成へ戻る分岐を明確にする。

4. **Fig.4はprotocol/outcome/evidenceの関係が強み。**
   `MASTER_RECORD -> PROTOCOL -> EXAMPLE -> OUTCOME -> EVIDENCE_REF` の接続を、請求項6〜10の対応として残す。

5. **Fig.5はFHIR/OMOP回避の生命線。**
   単なるappend-only保存ではなく、同一horizon異valenceの併存、意思決定者への並列表示、異種evidence refsを入れる。

6. **Fig.6はCiena/MLOps回避が必要。**
   blockchainやmodel registry風ではなく、複数種類parameterに同一処理を横断適用する抽象図にする。

7. **Fig.7は主軸に見せすぎない。**
   Before-Zeroは補強。Fig.1の末端機能又は従属処理として描く。

8. **Fig.8は単一画面だと現OS乖離が出る。**
   「統合確認インターフェース又は関連画面群」として、画面群の概念図にする。

## 5. 外部相談用削除版へのツッコミ

1. **安全性は高いが、相談効率が落ちる。**
   営業秘密はかなり落ちている。ただし、弁理士が初回で「どの請求項をどう組むか」を判断するには、請求項ツリーが弱い。

2. **「渡してよい候補」と「口頭限定」の境界はよいが、資料の優先順位がまだ多い。**
   初回は、請求項見直し案の削除版、明細書たたき台の要約、公開棚卸し1ページ、発明者/出願人メモの4点以内に絞る方がよい。

3. **現OS乖離チェックを口頭限定にするのは安全。ただし弁理士には未実装要素の有無を隠さない。**
   「実装済み」「設計済み」「partial」「not-found」の分類だけは安全要約として伝える。

4. **公開済み資料棚卸しが未確認のまま。**
   弁理士はここを必ず気にする。公開候補、日付、外部性、配布有無、NDA有無、発明コア有無の表を埋める。

5. **正式サーチ確認事項が初回質問に埋もれている。**
   Seek AI、BigID、Glean、Ciena、DataRobot、Notion Labs、国内AI抽出系は、弁理士に正式サーチ範囲として明示する。

## 6. 打ち返し優先順位 top 10

1. **請求項1の二段構えを作る。**
   A: HITL + feedback + approved-only master。B: protocol/outcomeまで含む閉ループ。弁理士にどちらを主軸にするか確認。

2. **BigID回避文言を確定する。**
   全文非保存単体ではなく、正本DB非保存、短い抜粋、run単位evidence、HITL、正本反映、protocol化とのセットにする。

3. **FHIR/OMOP回避として、請求項8〜10を一体で再整理する。**
   outcome schemaではなく、protocol/action後の観測、矛盾観測UI、異種evidence参照まで含める。

4. **WS-5を基幹出願に残すか分割候補にするか決める。**
   現状は分割候補寄り。残すなら抽象実施例を厚くし、claim 11-12を従属に弱める。

5. **WS-6を従属・補強に固定する。**
   独立化は弁理士相談後。適用先の新しさだけでは押さない。

6. **合成実施例をデータ遷移表で補強する。**
   実データなしで、各テーブル/抽象データがどう生成・更新されるかを示す。

7. **図5、図6、図8を清書前に補強する。**
   ここが先行技術回避と現OS乖離の焦点。

8. **外部相談用削除版に1ページの請求項ツリーを追加する。**
   弁理士が初回で判断しやすい形へ。

9. **公開棚卸しを未確認のままにしない。**
   少なくとも資料の存在、日付、外部性、配布有無、NDA有無、発明コア記載有無を埋める。

10. **権利行使の現実を相談パックに残す。**
    訴訟moatではなく、NDA下営業、共同研究、RFP、導入価格維持、後出し出願防止のカードとして位置づける。

## 7. まさ判断事項5個以内

1. **主請求項を1本で閉ループ全部入りにするか、HITL系とprotocol/outcome系の二段構えにするか。**

2. **WS-5 generic parameter governanceを基幹出願に残すか、分割候補に下げるか。**

3. **WS-6 Before-Zero設立時期推奨を従属項に留めるか、独立請求項候補も弁理士に見せるか。**

4. **出願前にoutcome UI / 複数evidence ref / generic parameter governanceの最小retrofitをやるか。**

5. **弁理士初回相談の資料を、請求項ツリー + 明細書要約 + 公開棚卸し + 発明者/出願人メモの4点に絞るか。**

## 8. 次に特許出願司令塔がやるべきブラッシュアップ案

1. **請求項ツリー削除版を作る。**
   `主請求項A / 主請求項B / 従属項 / 分割候補 / 出願書類に書かないもの` の1ページ。

2. **明細書の差分補強メモを作る。**
   BigID、FHIR/OMOP、Ciena、Seek AI/Gleanに対し、本文のどこへ差分構造を入れるか整理。

3. **合成実施例のデータ遷移表を追加する。**
   候補、evidence、feedback、master、protocol、outcome、proposal、recommendationの抽象レコード変化だけを書く。

4. **図面清書ブリーフを外部相談用に削る。**
   Fig.1〜Fig.8の目的、請求項対応、入れる/入れない情報だけ残す。Mermaidや内部運用ニュアンスは削る。

5. **公開棚卸しを1ページで埋めるworkerを切る。**
   Web検索ではなく、まさの手元資料・登壇資料・送付履歴の存在確認が中心。未確認は未確認のまま。

6. **正式サーチ確認事項リストを弁理士向けに整える。**
   Seek AI 2件、BigID全件、Glean、Ciena claim 1、DataRobot、Notion Labs、国内AI抽出/議事録/意思決定系、医療outcome schema、MLOps governanceを対象にする。

7. **出願目的の表現を固定する。**
   「競合を止める」ではなく、「出願中ステータス、共同研究/NDA下説明、後出し出願防止、価格維持、提携交渉カード」として説明する。

## 9. 正式サーチ確認事項

このworkerではWeb検索しない前提のため、以下は正式サーチ又は弁理士確認事項として残す。

- Seek AI米国特許2件の公報番号とClaim 1。
- BigID関連登録特許全件のClaim 1、特に本文非保存/metadata/confidenceの範囲。
- Glean US 12,050,712 B2及び関連係属出願の権限フィルタ必須性。
- Ciena US 10,965,527 B2のClaim 1逐語、blockchain/network限定の強さ。
- DataRobot、Opendoor、Domino、SageMaker、MLflow周辺のapproval/versioning公知技術。
- FHIR/OMOP以外のlongitudinal outcome / observation schema特許。
- 国内の議事録、意思決定、AI抽出、承認、プロンプトfeedback系JP文献。

## 10. 禁止情報チェック

- production DB row: 記載なし。
- 実source permalink / 内部source id: 記載なし。
- prompt全文 / few-shot / comment変換ロジック: 記載なし。
- score weight / threshold / calibration: 記載なし。
- 実PJ本文 / 顧客名 / 研究機関名 / 個人名 / 契約条件 / 価格: 記載なし。
- connector認証 / 監視 / 復旧 / watch path: 記載なし。
- DB write / production DB接続 / 外部送付: 未実施。
