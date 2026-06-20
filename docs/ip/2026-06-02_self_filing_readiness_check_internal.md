# AMD OS / AMDプロトコル 完全セルフ出願 readiness check（内部版）

- 作成日: 2026-06-02
- 位置づけ: 弁理士なしでも出願ドラフトを完成させるための内部準備チェック。法的助言ではない。
- 方針: 外部送付禁止。弁理士問い合わせ禁止。DB write禁止。production DB接続禁止。Web公開削除 / 変更禁止。
- 記載制限: 実案件名、顧客名、個人名、契約条件、未公開知財詳細、prompt全文、score weight / threshold / calibration、実DB行、source permalinkは入れない。

## 0. 結論

完全セルフ出願のreadinessは、現時点では **出願日を取りに行ける直前段階だが、そのまま提出はまだ危ない**。

理由は、請求項、明細書、要約、図面案、対応表、批判レビュー、公開資料棚卸し、発明者 / 出願人整理が一通り揃っている一方で、セルフ出願では出願後に新規事項を足せないリスクを自分で背負うため、以下の3点だけは出願前に完了させる必要がある。

1. Mermaid図を、特許図面として提出できる白黒線画へ清書する。
2. 明細書本文に、請求項A/B二段構え、先行技術別の逃げ方、抽象レコード遷移、各図面の参照説明を反映する。
3. 願書、出願人 / 発明者、電子出願環境、出願料、審査請求タイミング、公開済み資料メモを、出願当日の手続チェックリストへ落とす。

弁理士を使わない前提なら、次のゴールは「特許庁へ提出できる形式の願書 + 明細書 + 特許請求の範囲 + 要約書 + 図面」をrepo内で完成させること。弁理士を使う場合も、役割は発明づくりではなく、出願直前の1〜2時間の地雷チェックに限定する。

## 1. 完全セルフ出願方針のcurrent truth

- 本件は、競合を完全停止するmoatではなく、NIMS / 研究機関導入、投資家 / 提携先説明、外部開示前防御、後出し出願リスク低減、価格維持の交渉カードとして出願する。
- 請求項の中心は、複数業務データ源からの候補生成、証拠メタデータ、人間承認、approved-only正本反映、reject/comment feedback、抽象protocol化、outcome ledger、system parameter governanceのAND結合。
- score weight、threshold、calibration、prompt全文、few-shot、実データ、実PJ本文、source permalink、connector運用、導入先別ノウハウは営業秘密側に残す。
- Before-Zero / 設立タイミング推奨は補強。主軸にしすぎると単一性、発明該当性、先行技術との差分説明が散るため、従属項又は分割候補として扱う。
- 発明者はまさ単独、出願人は株式会社チームアルマダ、AI/Codexは補助ツールという内部整理で進める。

## 2. JPO一次情報ベースの出願手続チェックリスト

| 項目 | セルフ出願で必要な状態 | 現状 | 次アクション |
|---|---|---|---|
| 願書 | 出願人、発明者、発明の名称、代理人なしの場合の連絡先、手数料表示等を提出形式で作る | 未作成 | 願書ドラフトを作る。出願人名義はAMD、発明者はまさ単独の前提 |
| 明細書 | 技術分野、背景技術、課題、解決手段、効果、図面の簡単な説明、実施形態を提出水準で書く | `2026-06-01_patent_application_draft_internal.md`あり | 請求項A/B二段構え、先行技術別の逃げ方、抽象レコード遷移、図面参照番号を反映 |
| 特許請求の範囲 | 独立項 / 従属項を提出形式に整え、広さ、明確性、サポートを確認 | 請求項1〜16案、claim tree、support matrixあり | 独立候補A/Bに分けるか、1本 + 従属で出すかを決める |
| 図面 | 必要図を白黒線画で提出できる状態にする | Fig.1〜Fig.8のMermaid案と清書briefあり | Mermaidを特許図面用に清書。実画面や秘密情報は描かない |
| 要約書 | 400字以内、好ましくは200〜400字、課題 / 解決手段等に分けて記載。選択図も決める | 要約案あり | 400字以内に収め、選択図をFig.1又はFig.8候補で決める |
| 出願人 / 発明者 | 出願人AMD、発明者まさ単独、AIは補助ツールとして整理 | `2026-06-01_inventorship_ownership_internal.md`あり | AMDへの特許を受ける権利の承継メモ又は社内決裁メモを作る |
| 手数料 | 国内特許出願料は14,000円。審査請求は138,000円 + 請求項数 x 4,000円 | 未納付 | 出願時は出願料。審査請求を同日するか3年以内に後日するか決める |
| 電子出願 | インターネット出願ソフト、電子証明書、申請人利用登録、識別番号等が必要 | 未確認 | まさPC / AMD名義で電子証明書と申請人利用登録の準備状況を確認 |
| 紙出願 | 書面手続も可能だが電子化手数料がかかることがある | 未検討 | セルフ出願なら原則電子出願を推奨。紙は緊急退避 |
| 出願審査請求 | 出願日から3年以内。請求しないと実体審査に進まない | 未判断 | 出願日だけ先に取るか、同日審査請求するか判断 |
| 出願公開 | 原則として出願日から1年6か月後に公開 | 認識済み | 営業秘密が混入していないか、出願前に最終scan |
| 新規性喪失例外 | 必要なら出願と同時に適用を受ける旨の書面、出願から30日以内に証明書面 | 現時点では重い適用前提ではない | StartPass / 営業資料等の事実メモを残し、必要性を最終判断 |

参照した公式情報は末尾の「公式情報源」にまとめた。

## 3. 既存成果物の対応状況

| 既存doc | 出願書類 / 手続上の使い道 | readiness |
|---|---|---|
| `2026-06-01_patent_application_draft_internal.md` | 明細書、請求項、要約、図面説明の母体 | Strong。ただし提出形式化と図面参照番号の整備が必要 |
| `2026-06-01_claim_revision_internal.md` | 主請求項と従属項の見直し方針 | Strong。独立A/B構成の最終判断が必要 |
| `2026-06-01_claim_support_matrix_internal.md` | サポート要件、実施可能要件、新規事項回避の内部対応表 | Strong。提出直前に請求項番号変更へ追随 |
| `2026-06-01_claim_tree_external_review_internal.md` | 請求項ツリー、分割候補、相談用の論点整理 | Strong。セルフ出願では「請求項設計の目次」として使う |
| `2026-06-01_critical_patent_attorney_review_internal.md` | 潰され方の想定 | Strong。拒絶理由通知を先読みする材料 |
| `2026-06-01_critical_review_response_brushup_internal.md` | 打ち返し方針、先行技術別の逃げ道、図面補強 | Strong。明細書本文へ反映が必要 |
| `2026-06-01_patent_figures_cleanup_brief_internal.md` | 図面清書指示 | Strong。ただし提出図面そのものではない |
| `2026-06-02_public_disclosure_evidence_checklist_internal.md` | 公開済み資料 / 外部共有の事実メモ | Medium。法的評価は未確定。出願前の事実メモとして使う |
| `2026-06-01_inventorship_ownership_internal.md` | 発明者 / 出願人 / AI補助の内部整理 | Medium。承継メモ又は社内決裁メモは未作成 |

## 4. 出願前に必ず完成させるTODO

### Must before filing

1. 願書ドラフトを作る。
   - 出願人: 株式会社チームアルマダ。
   - 発明者: まさ単独。
   - 代理人: なし、又は地雷チェックだけ依頼する場合は代理なし前提で要確認。
2. 明細書を提出形へ整える。
   - 批判レビューの打ち返し方針を本文に反映する。
   - Fig.1〜Fig.8を段落で参照し、各構成要素と処理の関係を説明する。
   - 抽象レコード遷移表を明細書本文に残す。
3. 請求項を最終版にする。
   - 独立項A: HITL正本化ループ。
   - 独立項B又は従属項群: protocol / outcome閉ループ。
   - WS-5、WS-6は従属項又は分割候補として扱う。
4. 特許図面を清書する。
   - 白黒線画。
   - 実画面、実DB、実source、実案件名、秘密設定値を入れない。
   - 選択図を決める。
5. 要約書を400字以内へ整える。
   - 課題、解決手段を中心にする。
   - 営業秘密、実例、過度な効果断定を入れない。
6. 営業秘密scanを実施する。
   - prompt、score、DB、source、顧客、契約、未公開知財詳細が混入していないか確認。
7. 公開済み資料メモを出願ファイルに同梱する。
   - StartPass / 営業資料 / Web / NIMS / admin画面共有について、日付、外部性、配布有無、発明コア接触有無だけ。
8. 電子出願環境を確認する。
   - 電子証明書、インターネット出願ソフト、申請人利用登録、識別番号、支払方法。

### Can be after filing

- 出願審査請求。出願日から3年以内。ただし早く権利化したい場合は同日又は早期に行う。
- 早期審査の利用検討。通常の審査請求料は別途必要。
- 拒絶理由通知への意見書 / 補正書。
- 分割出願の検討。

## 5. 出願後 / 拒絶理由通知後に備えて、出願時に仕込む逃げ道

セルフ出願では、出願時の明細書・図面に書いていないことを後で足しにくい。よって、以下は出願時の明細書に抽象的に入れておく。

1. 独立項A/Bの二段構え
   - A: evidence metadata + HITL + approved-only master + feedback。
   - B: protocol + example + multi-horizon outcome + contradictory observation + heterogeneous evidence refs。
2. 従属項の退避階段
   - 複数データ源。
   - 証拠メタデータの保存項目。
   - 未承認候補を正本へ反映しない制御。
   - feedbackの後続処理反映。
   - protocol / example / outcome / parameter governance / UI表示態様。
3. 先行技術別の差分説明
   - 単なるDWH / data catalogではなく、HITL正本反映とfeedback閉ループ。
   - 医療系データ標準ではなく、事業化判断protocolとoutcomeの再利用。
   - MLOps governanceではなく、経営判断プロトコル / outcome / parameter proposalのversion管理。
   - 検索 / RAG / 社内ナレッジ検索ではなく、approved-only masterとprotocol化。
4. 分割候補
   - WS-5 system parameter governance。
   - WS-6 Before-Zero / 設立時期推奨。
   - UI / export / admin画面に関する外部検出可能態様。
5. 図面の逃げ道
   - 単一画面に限定せず「確認インターフェース又は関連画面群」として説明する。
   - 実DB名ではなく抽象データ構造として描く。
   - outcome evidence refsとparameter versionを図示しておく。

## 6. セルフ出願で特に危ない地雷

| 地雷 | 本件での具体リスク | 回避策 |
|---|---|---|
| 新規事項追加 | 出願後に「outcome evidence refs」「parameter governance」「Before-Zero入力カテゴリ」を足したくなる | 出願時の明細書・図面に広めの抽象実施形態を入れる |
| サポート要件 | 請求項が広いのに明細書の実施形態が薄い | support matrixを請求項最終版へ追随させる |
| 明確性 | 「事業化判断」「protocol」「evidence」などが曖昧になりやすい | 用語定義と抽象データ構造を本文に置く |
| 単一性 | HITL、outcome、parameter governance、Before-Zeroが一出願内で散る | 主軸をA/B二段に固定し、WS-5/WS-6は従属又は分割候補 |
| 発明該当性 | 経営判断方法、ビジネスルール、抽象概念だけに見える | コンピュータの処理部、データ構造、保存、表示、version管理として書く |
| 新規性 / 進歩性 | BigID、FHIR/OMOP、Ciena、Seek AI、Glean、MLOps governance等に近いと言われる | AND結合と先行技術別の差分を明細書に明記 |
| 営業秘密の出しすぎ | prompt、score、実データ、実source、顧客名、契約条件が公開される | 出願前secret scan。抽象カテゴリと合成例だけ使う |
| 公開済み資料 | StartPass、営業資料、画面共有が発明公開と評価される可能性 | 事実メモを残し、必要なら新規性喪失例外手続を検討 |
| 手続期限 | 審査請求3年、30条証明30日、拒絶理由通知対応期限を落とす | 出願日ベースのdeadline ledgerを作る |
| 電子出願環境 | 出願当日に電子証明書 / 申請人利用登録で止まる | 出願前にインターネット出願ソフトでテスト準備 |

## 7. まさ判断事項（5個以内）

1. **審査請求タイミング**: 出願日だけ先に取り、審査請求は後日にするか。同日審査請求まで行うか。
2. **請求項構成**: 独立項A/Bの二本立てで出すか、独立項1本 + 従属項で出すか。
3. **WS-6の扱い**: Before-Zero / 設立時期推奨を今回の従属項に残すか、分割候補へ下げるか。
4. **弁理士地雷チェック**: 出願直前に1〜2時間だけ使うか、完全に弁理士なしで出すか。
5. **電子出願名義準備**: AMD名義の電子証明書 / 申請人利用登録 / 支払方法をこの出願用に準備するか、紙出願退避も許容するか。

## 8. 弁理士を地雷チェック係に限定する場合の使い方

弁理士を使う場合でも、依頼範囲は以下に限定する。

### 渡すもの

- 願書ドラフト。
- 明細書提出版ドラフト。
- 特許請求の範囲提出版ドラフト。
- 図面清書版。
- 要約書。
- 請求項ツリー。
- 営業秘密を抜いた公開資料棚卸しメモ。

### 聞くこと

1. 新規事項追加リスクを避けるため、出願時明細書に足すべき抽象実施形態はあるか。
2. 請求項A/B、WS-5、WS-6の単一性と分割候補の切り方は危なくないか。
3. ソフトウェア関連発明として、発明該当性の書きぶりは足りるか。
4. 要約、図面、願書の形式ミスはないか。
5. 公開済み資料について、特許法30条例外手続を念のため取るべきか。

### 渡さないもの

- prompt全文、few-shot、score weight / threshold / calibration。
- 実DB行、source permalink、実案件本文。
- 顧客名、個人名、契約条件。
- connector認証、監視、復旧、運用ノウハウ。
- まさとAI/Codexの全会話ログ。

## 9. 未確認 / 要確認

- AMD名義で電子出願するための電子証明書、識別番号、申請人利用登録、支払方法の準備状況。
- 願書提出形式の実ファイル化。
- Fig.1〜Fig.8の提出用清書。
- 出願審査請求を同日実施するかどうか。
- 新規性喪失例外手続を念のため使うかどうか。
- 発明者まさからAMDへの特許を受ける権利の承継メモ又は社内決裁メモ。
- 出願日から3年以内の審査請求deadline、出願から1年6か月後の公開予定日、30条例外を使う場合の30日deadlineを管理する台帳。

## 10. 公式情報源

- JPO「特許出願手続ガイドライン: 特許」: https://www.pcinfo.jpo.go.jp/guide/Content/Guide/Patent/PGuide.htm
- JPO「願書: 特許」: https://www.pcinfo.jpo.go.jp/guide/Content/Guide/Patent/Gansho/Kyotsu/PShoruiMei.htm
- 特許庁「明細書・図面等の作成について」: https://www.jpo.go.jp/system/patent/shutugan/sakusei/index.html
- 特許庁「要約書の概要」: https://www.jpo.go.jp/system/patent/shutugan/sakusei/ygaiyo.html
- 特許庁「産業財産権関係料金一覧」: https://www.jpo.go.jp/system/process/tesuryo/hyou.html
- 特許庁「初めてだったらここを読む～特許出願のいろは～」: https://www.jpo.go.jp/system/basic/patent/index.html
- 特許庁「初心者のための電子出願ガイド」: https://www.jpo.go.jp/system/process/shutugan/pcinfo/hajimete/shutsugan02.html
- 特許庁「発明の新規性喪失の例外規定の適用を受けるための手続について」: https://www.jpo.go.jp/system/laws/rule/guideline/patent/hatumei_reigai.html
- 特許庁審査基準「新規事項を追加する補正」: https://www.jpo.go.jp/system/laws/rule/guideline/patent/tukujitu_kijun/ht/04_0200.html
- 特許庁審査基準「特許請求の範囲の記載要件」: https://www.jpo.go.jp/system/laws/rule/guideline/patent/tukujitu_kijun/ht/02_0200.html
- 特許庁審査基準「発明の単一性」: https://www.jpo.go.jp/system/laws/rule/guideline/patent/tukujitu_kijun/ht/02_0300.html
- 特許庁審査基準「発明該当性及び産業上の利用可能性」: https://www.jpo.go.jp/system/laws/rule/guideline/patent/tukujitu_kijun/ht/03_0100.html
