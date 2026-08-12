# 重要書類抽出 / 正本化仕様

> **current truth（2026-08-12）**: LSTの第3期事業報告・計算書類等を最初の再現ケースとして、Drive上の正式書類を内容hash単位で候補化する。collectorはrawを上書きせず、`coverageGaps[]` outbox、非LLM applier、通知採否を経て、採用時だけ`project_important_documents`へ追記する。

## 1. 起点と根因

LSTの同一PDFが、株主総会2フォルダと取締役会書面決議1フォルダの計3所在にあったが、既存L2へ入っていなかった。

原因は次の経路の隙間である。

- `src/lib/sources/drive.ts`の旧readerはGoogle native documentだけを本文化し、PDFはMIME markerしか返さない。
- 旧Drive探索はPJ alias一語、更新順上位6件で、親フォルダ、対象会社、対象期間、監査有無、全ページングを検索条件にしていない。
- H-1は会議1回のsummary、D-14はGmail由来ガバナンス候補が主対象で、Driveだけにある正式な計算書類一式を独立した重要書類として分類しない。
- LST SPS 2.1 v0.2のsource anchorは既存構造化値を中心に作られ、このPDF自体、期末残高、年度累計、資金調達CF、補助金預りのfield-level provenanceへ接続していなかった。

一部のSBIR、J-KISS、借入事実が別テーブルに存在していても、PDF原文の観測、既存構造化値、BZM計算入力は同一視しない。

## 2. 探索契約

collectorはPJごとに、会社正式名、会社alias、PJ aliasを検索語へ使う。
これと「事業報告」「計算書類」「附属明細」「監査報告」「決算」、親フォルダの「株主総会」「取締役会」「書面決議」「監査」を組み合わせ、PDFとGoogle Docsを全ページングする。

候補判定はファイル名だけで行わない。
MIME、本文、親フォルダ、会社一致、対象期間、監査報告の6面を使う。
PDF本文は`pdf_text`、画像PDFは`ocr`として取得方法を残す。
本文を取得できないPDFは`document_text_missing`で止め、値0や非該当へ変換しない。

実装正本は`pwa/scripts/lib/important_document_extraction.mts`の`buildImportantDocumentSearchPlan`と`extractImportantDocuments`である。

## 3. 重複と版

NFKC・空白正規化した本文hash、またはcollectorが渡すcontent SHA-256を内容同一性の正本にする。

- 同じPJ、同じcontent hashの複数所在は1候補へ束ねる。
- `lineage`にはfile ID、全親フォルダ、作成・更新時刻、本文取得方法、取得statusを残す。
- 代表所在は更新時刻、作成時刻、file IDの順で決定する。代表以外を削除しない。
- 同じPJ・書類class・対象期間でもcontent hashが違えば別版候補にする。最新を`canonical_candidate`、それ以前を`superseded_candidate`とし、採否前に上書きしない。

## 4. field-level provenance

各factは最低限、次を持つ。

- `fact_key`、金額、`observed / calculated / partial / missing`
- `monthly_actual / period_end_balance / annual_cumulative / financing_cash_flow / grant_deposit / grant_commitment_cap`
- 対象期間または基準日、根拠がある締切と精度、status
- 売上算入可否、会社価値への直算入可否、会計上の扱い
- file ID、content hash、section、page、短い根拠表現、そのhash、本文取得方法

年度書類から月次実績を補間しない。
pageが不明なら`null`であり0にしない。
2項目から合計した値は`calculated`、片方だけなら`partial`とする。

## 5. 財務分類とBZM 2.1接続

| 書類上の値 | 分類 | 接続規則 |
|---|---|---|
| 現金及び預金 | 期末残高 | 期末日の観測。現行valuation dateの`C0`へ時点補正なしで直結しない |
| 売上、営業損失、純損失、研究開発費、設備投資 | 年度累計 | 過年度実績。月次値、将来burn、将来売上へ自動外挿しない |
| J-KISS、借入 | 資金調達CF | 売上ではなく、会社価値へ直加点しない |
| 受領済み補助金の預り金 | 補助金預り | 流動性の観測。売上・会社価値へ直加点しない |
| SBIR / NEDO / SusHi Techの上限 | 条件付きgrant cap | 受領額でも売上でもない。確定見込み日は根拠精度つきで保持する |

`bzm_input_candidates_json`は次版への接続候補であり、既存`bzm_2_1_input_observations`、現行SPS、会社価値を自動更新しない。
観測、計算、欠測を保ったまま、次のBZM revisionで採用するか別レビューする。

## 6. outbox、採否、正本

1. collectorが`amd-os-important-document-outbox-v1`の`coverageGaps[]`を作る。
2. `ms_progress_review_tool.mjs apply-outbox`が`l2_coverage_gaps(review_status='candidate')`と`l2_notifications(l2_kind='coverage_gap')`だけを書く。
3. 通知の「はい」で、allowlist済みmetadata、lineage、facts、BZM入力候補を`project_important_documents(status='confirmed')`へ1件追加する。
4. 「いいえ」はgapを`rejected`にし、重要書類正本を作らない。
5. 正本行のevidence列はimmutableで、訂正は別content hashの新しい版として追加する。

raw PDF本文、URL、秘密値は正本表へ保存しない。
同じsource hashを再投入してもconfirmed/rejectedを上書きしない。
候補0件は正常なno-opで、空payloadを作らない。

## 7. LST再現の合格条件

- LiSTie第3期、2025-04-01〜2026-03-31、監査報告ありのannual financial packageとして候補化される。
- 同じ内容3所在は候補1件、lineage 3件になる。
- 現預金、売上、営業損失、純損失、研究開発費、設備投資、J-KISS、借入、補助金預り、3補助事業上限を、期間区分・status・根拠・根拠がある締切とともに保持する。
- 年度書類から月次実績を作らず、欠測の締切やpageを0にしない。
- J-KISS、借入、補助金、grant capは売上・会社価値へ直算入されない。
- outbox適用後のreadbackが`candidate`、対象PJ、content hash、lineage 3、facts件数、BZM接続候補件数を返す。

fixture回帰は`cd pwa && npm run test:important-document-extraction`で行う。

## 8. 全PJへの一般化

抽出器はPJ固有の数値を持たず、project identityとdocument batchを入力にするため、同じ契約を他PJへ使える。
次段階では次の順で広げる。

1. ガバナンス監視ON/OFFとは別に、全PJ台帳の会社aliasとDrive rootを入力化する。
2. 株主総会、取締役会、書面決議、事業報告、計算書類、監査報告を同じ探索面で全ページングする。
3. scan cursorとcontent hash台帳で増分化し、PDF text失敗をOCR queueへ分ける。
4. 会社名・対象期間・監査署名の日本語表記差をfixtureで増やす。
5. 本番automation登録、cadence、通知上限は別の運用変更として承認後に追加する。今回、新しい定期writerは登録しない。

残課題は、スキャンcursorの永続化、画像PDFのOCR品質、連結計算書類・修正版の版優先規則、既存DB断片とのfield単位照合UI、BZM次版の採用操作である。
