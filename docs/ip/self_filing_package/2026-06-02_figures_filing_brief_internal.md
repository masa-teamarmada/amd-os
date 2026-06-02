# Fig.1〜Fig.8 提出図面清書指示（内部提出形式候補版）

- 作成日: 2026-06-02
- 位置づけ: 完全セルフ出願に向けた図面清書指示。提出図面そのものではない。
- 重要: 外部送付禁止。JPO提出禁止。弁理士問い合わせ禁止。
- 公式形式メモ: JPO「図面: 特許」は、図面を黒色で鮮明に記録し、着色しないこと、符号はアラビア数字を用いること、図表・線図等は原則GIF又はBMP形式のモノクロ2値で保存することを示している。

## 0. 全図共通方針

- 白黒線画で作成する。
- スクリーンショット、実UI、実URL、実DB名、実サービス名、実案件名は使わない。
- 構成要素番号は、100番台をシステム、200番台を候補 / evidence、300番台をreview / master、400番台をprotocol / example、500番台をoutcome、600番台をparameter governance、700番台をrecommendation、800番台をUI表示領域に割り当てる。
- 明細書と同じ用語を使う。
- 図中テキストは最小限にし、説明は明細書本文に寄せる。

## 1. 参照符号候補

| 符号 | 名称 |
|---|---|
| 100 | 情報処理装置 |
| 101 | プロセッサ |
| 102 | メモリ |
| 103 | ストレージ |
| 104 | 通信インターフェース |
| 105 | 表示制御部 |
| 110 | 複数業務データ源 |
| 120 | データ取得部 |
| 130 | 候補データ生成部 |
| 140 | 証拠メタデータ生成部 |
| 150 | 確認インターフェース制御部 |
| 160 | 正本データベース反映部 |
| 170 | フィードバック反映部 |
| 180 | 事業化判断プロトコル生成部 |
| 190 | 事例管理部 |
| 200 | 結果観測管理部 |
| 210 | システムパラメータ提案管理部 |
| 220 | 法人設立時期推奨部 |
| 230 | 候補データ |
| 240 | 証拠メタデータ |
| 250 | レビューフィードバック |
| 260 | 正本レコード |
| 270 | 事業化判断プロトコル |
| 280 | プロジェクト固有事例 |
| 290 | 結果観測データ |
| 300 | 異種証拠参照 |
| 310 | パラメータ変更候補 |
| 320 | パラメータversion |

## 2. Fig.1 全体構成例

- 目的: 複数業務データ源から候補生成、証拠メタデータ、確認、正本反映、feedback、protocol、outcome、parameter governance、設立時期推奨までの全体像を示す。
- 入れる: 100〜220の機能部。装置クレームを支えるため、101〜105も入れる。
- 入れない: 実connector名、実URL、実DB row、prompt、score条件、実案件名。
- 注意: WS-5 / WS-6は補助 / 拡張機能として末端に配置し、基幹ループに見せすぎない。

## 3. Fig.2 候補データ生成及び証拠メタデータ付与

- 目的: 複数業務データ源からソース参照を取得し、候補データと証拠メタデータを関連付ける流れを示す。
- 入れる: 対象プロジェクト特定、ソース参照取得、候補生成、証拠メタデータ生成、pending保存、確認インターフェース提示。
- 入れられる抽象項目: source type、source identifier、source date、title、short snippet、hash、extraction run identifier、confidence。
- 入れない: source permalink、全文、長い抜粋、connector認証、watch path。

## 4. Fig.3 人間承認、却下、コメント、正本反映

- 目的: 候補データが人間の承認を経て正本へ反映され、却下 / コメントが後続処理へ反映される閉ループを示す。
- 入れる: pending候補表示、証拠表示、承認、却下、コメント、承認済みのみ正本反映、feedback data保存、後続候補生成で参照。
- 入れない: 実担当者名、実コメント全文、comment-to-guidance具体ロジック、prompt全文。
- 注意: 未承認候補が正本データベースへ行かない分岐を明確にする。

## 5. Fig.4 事業化判断プロトコルデータ及びプロジェクト固有事例

- 目的: 承認済み正本レコードから抽象protocolが生成され、1つのprotocolに複数事例、結果観測、証拠参照がぶら下がる構造を示す。
- 入れる: 正本レコード、protocol、protocol identifier、branch point、criteria、action pattern、result category、project-specific example、source evidence identifier。
- 入れない: 実protocol本文、実PJ事例本文、実meeting id、実title hash固定、実source所在。
- 注意: 1:N構造を強調する。source_meeting_id等の実装名は使わない。

## 6. Fig.5 append-only outcome及び矛盾観測提示

- 目的: protocol又は事例に紐づく結果観測をappend-only保存し、同一horizonで異なるvalenceを上書きせず提示する態様を示す。
- 入れる: action後の結果候補、horizon、valence、confidence、summary、evidence refs、append-only保存、矛盾観測並列表示。
- 入れない: 実KPI row、成功 / 失敗教師ラベル、実outcome本文、実source所在。
- 注意: FHIR / OMOP風の医療観測に見えないよう、事業化判断protocol / project-specific exampleに紐づく結果観測として描く。

## 7. Fig.6 system parameter pending proposal / version governance

- 目的: prompt、rule、config、model、workflow等の複数種類parameterについて、pending proposalから承認時のみnew versionへ昇格する処理を示す。
- 入れる: system parameter、parameter type、変更候補、pending proposal、確認インターフェース、承認、却下 / 保留、新規version、過去version。
- 入れない: prompt全文、model選定、temperature、chunking、score weight、threshold、calibration、実設定値。
- 注意: WS-5は未判断。今回出願の従属項に残す場合も、分割候補に落とす場合も使える抽象図にする。

## 8. Fig.7 法人設立前研究シーズに対する法人設立時期推奨

- 目的: 法人設立前研究シーズについて、承認済み候補、protocol、outcome等を参照し、設立時期推奨カテゴリを生成する補助処理を示す。
- 入れる: 法人設立前判定、入力カテゴリ、承認済み正本参照、protocol / outcome参照、不足又は矛盾カテゴリ、推奨カテゴリ、確認インターフェース提示。
- 入れない: 実判定条件、weight、threshold、calibration、具体予定月、資金計画、顧客名、CEO候補。
- 注意: WS-6は従属 / 補強又は分割候補。主軸に見せすぎない。

## 9. Fig.8 統合確認インターフェース又は関連画面群

- 目的: 候補、証拠、review、protocol、outcome、proposal、recommendationの少なくとも一部を意思決定者が確認できる表示態様を示す。
- 入れる: 候補領域、証拠領域、レビュー領域、protocol領域、outcome領域、proposal領域、recommendation領域、承認 / 却下 / コメント入力。
- 入れない: 実画面スクリーンショット、実URL、実サービス名、実案件情報、long snippet、score詳細。
- 注意: 現OSは単一統合画面ではなく分散実装のため、「同一画面又は関連画面群」とする。

## 10. 清書後の検査項目

1. 全図が白黒線画になっている。
2. 主要構成要素に参照符号が付いている。
3. 同一構成要素に同一符号が使われている。
4. 実サービス名、実案件名、prompt、score、DB、source、個人情報が入っていない。
5. Fig.1が装置 / 方法 / プログラム請求項を支えられる。
6. Fig.2〜Fig.3がHITL正本化ループを支える。
7. Fig.4〜Fig.5がprotocol / outcome閉ループを支える。
8. Fig.6 / Fig.7は未判断要素として、従属項にも分割候補にも転用できる。

