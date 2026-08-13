# 重要情報抽出 / 正本化仕様

> **current truth（2026-08-12）**: D-15は決算書専用ではない。Gmail / Drive / Calendar / Slack / Notionの5生データと、PDF / Word / Excel / PowerPoint / Google Docs・Sheets・Slides / text系本文を同じ入口へ正規化し、会社・PJにとって重要な観測を候補化する。LSTの第3期事業報告・計算書類等は、最初の実データ回帰ケースである。

## 1. 問題と根因

LSTの正式PDFはDriveに同一内容3コピーあったが、既存L2とBZM入力根拠へ接続されていなかった。
この事実は決算書だけの問題ではなく、重要情報の入口全体の欠陥を示した。

- 旧`src/lib/sources/drive.ts`はGoogle native文書だけを本文化し、PDFとOffice fileはMIME表示で止めていた。
- 旧D-15はMIMEをPDF / Google Docsだけに限定し、「対象期間あり」「決算marker 4個以上」など年次決算書専用の条件で、それ以外の重要情報を捨てた。
- 検索で会社名がhitしても、本文後半の支援先・関係先名なのか、発行主体・PJ rootなのかを分離せず、条件を緩めると別PJへ誤帰属する危険があった。
- ファイル名、本文、親フォルダ、形式取得、重要度判定が一体化し、PDF読取失敗・Word対象外・分類不一致を同じ「非該当」にしていた。
- 個別抽出器は既知カテゴリだけを見るため、技術結果、事業計画、契約、資金調達、補助金、ガバナンス、期限などを横断する上位の安全網が弱かった。

一部の事実が既存DBに存在していても、原文の観測、既存構造化値、BZM計算入力は同一視しない。

## 2. 共通フロー

```text
5生データ
  ↓
形式別本文取得（PDF / Office / Google native / text / OCR）
  ↓
重要度判定（既知カテゴリ + 意味判定）
  ↓
PJ帰属判定（PJ root / title / parent / 発行主体）
  ↓
内容hash重複排除 + lineage + 版管理
  ↓
項目別根拠・期限・接続先候補
  ↓
coverageGaps[] candidate → non-LLM applier → 通知採否
  ↓
採用時だけ project_important_evidence へ追記
```

探索ではファイル名だけを条件にしない。
ただし全文を保持しない抜粋運用でも、正式なファイル名は本文・親フォルダ・MIME・会社帰属と合わせて書類種別の判定に使う。
会社正式名、会社alias、PJ alias、PJ Drive root、親フォルダ、MIME、本文、更新日時を組み合わせ、ページングする。
Gmail / Calendar / Slack / Notionも同じ重要度・帰属・根拠契約へ正規化する。

## 3. 本文取得

`src/lib/sources/source-material-text.ts`を共通readerとする。

| 形式 | 取得方法 |
|---|---|
| Google Docs / Sheets / Slides | Drive export |
| PDF | 原本bytesを取得し、全page textとpage markerを抽出 |
| Word `.docx / .docm` | OOXML本文・header・footer・脚注を抽出 |
| Excel `.xlsx / .xlsm` | shared stringsとsheet cellを抽出 |
| PowerPoint `.pptx / .pptm` | slideとspeaker noteのtextを抽出 |
| text / markdown / csv / json / xml / html | UTF-8 textとして抽出 |
| 画像PDF / image | 注入されたOCR経路を使う |
| 旧Office形式 / 大容量 / OCR未接続 | `missing`と理由を残し、0・非該当へ変換しない |

readerはraw本文をDBへ保存しない。
サイズ、page数、timeoutを制限し、未読は`needsOcr` / `text_read_required`として候補へ残す。

## 4. 重要度と分類

初期カテゴリは次のとおりで、決算書はこの一部にすぎない。

- 決算・財務
- 株主総会・取締役会・登記・監査
- 契約・押印・解除
- 資金調達・株式・評価額
- 補助金・採択・交付決定
- 技術結果・性能・特許・知財
- 事業計画・予算・ロードマップ
- 受注・PoC・提携など事業進展
- リスク・法令・事故・資金繰り
- 人事・代表・取締役変更
- 明示的な提出・回答・支払期限

キーワードは検索網へ上げるsignalであり、最終意味判定ではない。
意味抽出側は`semantic_classification`としてカテゴリ、理由、観測項目、接続先候補を渡せる。
意味抽出で得た値も、原文中の短い根拠表現が照合できない場合はfieldへ採用しない。

## 5. PJ帰属

会社名が本文のどこかに1回出ただけではPJ確定しない。

- PJ Drive root配下
- titleの会社・PJ名
- 親フォルダの会社・PJ名
- 本文先頭の発行主体

を強いanchorとする。
本文後半に支援先として「チームアルマダ」と書かれたLST資料をAMD資料へ誤帰属させない。
root / title / parentが確定せず、発行主体だけが一致する場合は帰属もcandidateとして残す。

## 6. 重複、lineage、版

本文が読めた文書はNFKC・空白正規化後の本文hashを内容同一性に使う。
同じ内容を別フォルダへコピーしても1候補へ束ね、全所在を`lineage`へ残す。
本文未読時だけraw bytes hashまたはsource identityを暫定キーにする。

同じPJ・分類・対象期間でも本文hashが違えば別版候補にし、最新を`canonical_candidate`、旧版を`superseded_candidate`とする。
元ファイルを削除・上書きしない。

## 7. field-level provenance

各fieldは、値だけでなく次を持つ。

- `observed / inferred / calculated / missing`
- 対象期間、基準日、明示期限と精度
- source、source ref、content hash、section、page、短い根拠表現、そのhash、本文取得方法
- 財務なら`monthly_actual / period_end_balance / annual_cumulative / financing_cash_flow / grant_deposit / grant_commitment_cap`
- 売上算入可否、会社価値への直算入可否、会計上の扱い

観測・推定・計算・欠測を混ぜない。
pageが不明なら`null`、本文が読めないなら`missing`であり、0ではない。

## 8. 財務・BZM 2.1の追加規則

| 書類上の値 | 分類 | 接続規則 |
|---|---|---|
| 現金及び預金 | 期末残高 | 期末日の観測。現行評価日の現預金へ時点補正なしで直結しない |
| 売上、損失、研究開発費、設備投資 | 年度累計 | 月次値や将来値へ自動外挿しない |
| J-KISS、借入 | 資金調達CF | 売上でも会社価値への直加点でもない |
| 補助金預り | 受領済み預り | 流動性の観測。売上・会社価値へ直加点しない |
| 補助事業上限 | 条件付き上限 | 受領額、売上、会社価値ではない |

金額に単位が無い場合は、直前の「単位: 千円」等を読めた場合だけ換算する。
補助金の完了・確定見込み日はfieldの時間属性であり、本人の対応期限へ流用しない。
年度決算から月次実績を作らない。

`bzm_input_candidates_json`は次版への接続候補であり、既存BZM revision、SPS、会社価値を自動更新しない。

## 9. 候補、採否、正本

1. collector / meaning extractorが`amd-os-important-evidence-outbox-v2`の`coverageGaps[]`を作る。
2. `ms_progress_review_tool.mjs apply-outbox`が`l2_coverage_gaps(candidate)`と通知だけを作る。
3. 通知で採用された時だけ、非LLM feedback routeがallowlist済みmetadata、重要度、帰属根拠、lineage、facts、期限、接続先候補を`project_important_evidence`へ追記する。
4. 不採用はgapを`rejected`にし、正本行を作らない。
5. raw本文、URL、秘密値を正本表へ保存しない。
6. 同じsource hashの再投入でconfirmed / rejectedを上書きしない。未採否の`candidate`だけは、同じidentityを保ったまま決定論的な再抽出結果へ更新できる。候補0件は正常なno-opとする。
7. collectorがraw本文を保持せず判定用抜粋だけを渡す場合は`text_is_excerpt=true`とする。原文または原ファイルから確実に算出した`content_sha256`がある時だけ内容重複へ使い、hashがない短い同文は別sourceとして保持する。
8. OOXML本文readerは`.docx/.docm`、`.xlsx/.xlsm`、`.pptx/.pptm`を同じZIP/XML経路で扱う。旧binary Officeは変換待ちをmissingで残し、情報なしにしない。
9. 原文に明記されていても、計画・予測・見積・意向・審査中・未締結は実績`observed`ではなく`inferred`として保存する。`status`には計画、承認、契約済み、着金、完了、未確認等の原文上の段階を残す。
10. 抜粋・部分読取は`text_read_required=true`で保持し、画面でも全文未確認と出す。URL、メール、電話番号、認証情報は、候補・通知・正本へ入る短文を非LLMでsanitizeする。
11. 資金調達・借入・補助金は、売上と会社価値への算入が両方とも明示的に`false`の候補だけを正本化できる。保存処理が失敗した場合は通知を回答済みにしない。
12. `project_important_evidence`への正本化が成功した直後にだけ、同じ事象をBZM 2.2獲得台帳`project_bzm_2_2_acquisitions`へ表示専用の1行として派生させる。写像は非LLM (`src/lib/bzm-2-2-acquisition-from-evidence.ts`)、キーは`important_evidence:{content_sha256}`で冪等。閉じた条件・消費・行動の増減は抽出では埋めず空のまま残す (未取得であり「無し」ではない)。台帳への書き込みが失敗しても重要情報の正本化は取り消さず、通知の応答文言に失敗を添えるだけにする。契約は[`4-6 BZM 2.2 獲得台帳`](4-6-bzm-22-acquisition-ledger-current-spec.md) §6が正本。

`/notifications`では汎用coverage gapの「重要メモにコピー」表示を使わず、「重要情報として保存 / 保存しない」を出す。採否前に、分類、対象期間、監査、lineage数、本文読取状態、fieldごとの値・観測状態・短い根拠を展開表示する。

既存`project_important_documents`はv1決算書候補の互換正本として残し、新規v2は`project_important_evidence`を使う。

## 10. 合格条件と検証

fixture回帰は`cd pwa && npm run test:important-document-extraction`で行う。

- LSTの2025-04-01〜2026-03-31、監査ありPDFが候補になる。
- 同一内容3所在は候補1件、lineage 3件になる。
- 主要決算値、会計区分、根拠、status、根拠がある日付を保存する。
- Word / Excel / PowerPoint / PDFの実bytesから本文を取得できる。
- 画像PDFはOCR接続、または`text_read_required=true`で残り、事実を捏造しない。
- 決算以外の技術、計画、契約、資金調達、ガバナンスを候補化できる。
- 5生データを同じ共通候補へ流せる。
- 別会社文書の本文後半にAMD名があってもAMDへ誤帰属しない。
- 財務以外ではBZM候補を作らず、財務でも現行BZMを直接更新しない。

2026-08-12の全PJ live auditでは、27 PJを検索し、25 PJでtitleだけでも重要候補を確認した。
PDF、Word、Excel、Google文書を実読し、ZMPの画像PDFは本文0件ではなくOCR待ちとして識別した。
このauditは候補・DB・元ファイルへ書き込まないdry-runである。

## 11. 残課題

- 27 PJのうちDrive root未登録13 PJは、名前検索だけでなくrootを台帳へ補完する必要がある。
- 旧`.doc / .xls / .ppt`の変換経路を追加する。
- 画像PDFのOCR実行owner、上限、監視を現行subscription automationへ接続する。
- claimed source refsとの全件coverage照合を強化し、既に別L2へ入ったfactを二重候補化しない。
- `proposed_targets`を契約・ガバナンス・期限・経営ハイライトの既存正規writerへfield単位で接続する。
- 24-48時間の増分scanだけでなく、初回backfillとscan cursorを分ける。
