# AMD OS / AMDプロトコル 弁理士事前送付ショート版 営業秘密scanメモ（内部版）

- 作成日: 2026-06-01
- 対象: `docs/ip/2026-06-01_patent_attorney_short_pre_send_pack_internal.md`
- 位置づけ: まさ / 特許出願司令塔レビュー用の内部scanメモ
- 共有制限: 外部送付禁止。弁理士送付禁止。このまま添付・Drive共有・チャット共有しない。

## 0. 結論

ショート版候補は、初回打診後に必要なら共有候補にできる粒度まで短縮している。ただし、現時点では送付候補版であり、実送付版ではない。

本文は、抽象概要、請求項A/B二段構え、送付資料候補、弁理士への5問、まさ判断事項に絞った。明細書たたき台、内部相談パック、現OS乖離チェック、営業秘密境界メモ、worker報告の丸ごと送付は前提にしていない。

## 1. scan観点

### 禁止情報

- 実データ、実メール、議事録、チャット、クラウド文書、月次レポート本文。
- 実PJ本文、個別案件の判断材料、個別アクション、個別結果本文。
- 顧客名、研究機関名、個人名、契約条件、価格、商談ログ。
- source permalink、内部source id、実source所在、長いsnippet、raw transcript。
- prompt全文、few-shot、negative examples、comment-to-guidance変換ロジック。
- score weight、threshold、calibration、正解ラベル、教師データ。
- production DB row、実ログ、内部URL、管理画面詳細。
- connector認証、権限、監視、復旧、watch path、運用PC、抽出スケジュール細部。
- 未公開知財詳細、導入先別onboarding、レビュー会議体、担当者routing、訓練順序。

### 注意語の扱い

禁止語そのものは、チェックリストや「送らない」欄に注意書きとして出てよい。重要なのは、禁止情報の実体、実名、実source、実データ、設定値、全文、運用詳細が混入していないことである。

## 2. 送付可 / 口頭 / 送らないの最終整理

### 送付可候補

- 抽象化済みの相談目的と発明概要。
- 請求項A/B二段構えの要約。
- 公開済み資料確認候補の抽象棚卸し。
- 発明者 / 出願人 / 承継確認の要約。
- 国内出願までの費用、期間、追加サーチ、PCTや分割の確認事項。

### 初回は送らず口頭

- 現OS乖離、部分実装、retrofit候補。
- 匿名合成実施例の裏取り方針。
- moat、ROI、価格維持、後出し出願防止などの事業背景。
- 画面共有や追加資料の開示制御方針。
- 守秘義務又はNDA確認後に、追加削除版を作る必要性。

### 送らない

- prompt、few-shot、comment変換ロジック。
- score条件、weight、threshold、calibration、正解ラベル。
- 実データ、実PJ本文、実source所在、production DB row。
- 顧客名、研究機関名、個人名、契約条件、価格、商談ログ。
- 内部source、connector認証、監視、復旧、watch対象、運用PC、抽出スケジュール細部。
- 未公開知財詳細や導入先別の実運用ノウハウ。

## 3. 実行した確認

### 3.1 高リスク情報カテゴリscan

実行コマンド:

```sh
rg -n "prompt全文|few-shot|score|weight|threshold|calibration|production DB|source permalink|内部source|connector|watch|実データ|実PJ|顧客名|研究機関名|個人名|契約条件|価格|商談|未公開知財|運用PC|抽出スケジュール" docs/ip/2026-06-01_patent_attorney_short_pre_send_pack_internal.md docs/ip/2026-06-01_patent_attorney_short_pre_send_secret_scan.md
```

結果:

- ヒットあり。
- ただし、ヒット箇所は「送らない」「禁止情報」「送付前ゲート」などの注意書きとして列挙したもの。
- 実データ、実名、実source、source permalink、DB row、prompt本文、score設定値、connector認証情報そのものは記載していない。

### 3.2 URL / メール / 長いIDらしき文字列scan

実行コマンド:

```sh
rg -n "https?://|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}|[0-9a-f]{32,}|source_[A-Za-z0-9_-]+|row_[A-Za-z0-9_-]+" docs/ip/2026-06-01_patent_attorney_short_pre_send_pack_internal.md docs/ip/2026-06-01_patent_attorney_short_pre_send_secret_scan.md
```

結果:

- ヒットなし。
- 外部URL、メールアドレス、長いhash風ID、source id風文字列、row id風文字列は確認範囲では見つからない。

### 3.3 実名・固有相手先scan

実行コマンド:

```sh
rg -n "NIMS|StartPass|Stapa|大学|顧客|研究機関名|個人名|契約|価格|商談" docs/ip/2026-06-01_patent_attorney_short_pre_send_pack_internal.md docs/ip/2026-06-01_patent_attorney_short_pre_send_secret_scan.md
```

結果:

- `顧客名`、`研究機関名`、`個人名`、`契約条件`、`価格`、`商談ログ` は注意書きとしてヒットする想定。
- 具体的な外部相手先名、顧客名、個人名、契約条件、価格、商談ログ本文は記載していない。
- `大学` は対象領域の一般カテゴリとして本文に出るが、特定大学名は記載していない。

## 4. 残リスク

- 禁止語を注意書きとして明示しているため、単純な禁止語scanではヒットする。
- 実送付版にする場合、`internal` 表記、共有制限、scanメモへの参照、ファイル名、PDFメタデータを落とした別版が必要。
- 弁理士から明細書案や図面案を求められた場合も、内部版を丸ごと送らず、追加削除版を作って再scanする。

## 5. まさ判断事項（5個以内）

1. 初回は資料なしで打診し、求められた場合だけショート版を送付版へ整えるか。
2. 資料送付前にNDAを求めるか、弁理士の通常守秘義務確認で足りるか。
3. 初回送付候補をショート版 + 請求項ツリー要約までに絞るか。
4. 現OS乖離・retrofit・moat/ROI背景は口頭限定で進めるか。
5. 実送付版を作る前に、公開済み資料確認候補の存在・日付・外部性だけ別workerで棚卸しするか。
