# シーズ文書自動補完パイプライン 設計草案

> **状態**：`draft v0.1 / 未監査 / まさレビュー前`
>
> **作成日**：2026-08-15
>
> **位置づけ**：[一次選別設計正本](BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md)の5章3項「文書自動補完のパイプライン」の詳細設計。補完三種（2章3項）のうち`document`の生成器。
>
> **関連正本**：[段階→軸帯対応表 v0.3](SEED_STAGE_AXIS_TEMPLATE_2026-08-15.md)、`pwa/design/db_schema.md`（seeds / seed_funding / seed_news）
>
> **API実地確認**：本文書のresearchmapとKAKENのAPI記述は2026-08-15にえいみが実際にアクセスして確認した結果に基づく（各節に実測ログを添付）。確認できなかった項目は「未確認」と明記する。

---

## 1. 目的と適用範囲

### 1.1 目的

一次選別の帯は、シーズ固有文書（`document`）だけが帯の**位置**を動かせる（設計正本2章2項）。
ところが現状、未PJ化156件のうちinvestigating 131件は要約文しか持たず、TRL 0件、研究者URL・資金歴ほぼゼロ、`seed_funding.amount_jpy`は全件nullである。
documentが無い限り、帯は機関補完と分野補完でできた「幅だけの帯」に留まり、層別は動かない。

本パイプラインの目的は、researchmapと公的採択DB（KAKEN・JST・NEDO・AMED）からシーズ固有文書を機械的に取り込み、`document`タグ付き入力を全シーズへ供給することである。

### 1.2 全件走査の原則

**層別と無関係に全件へ走らせる**（設計正本5章3項）。
帯上位だけに補完を走らせると、下位層の情報が永久に増えず（探索の枯渇、設計正本2章7項）、層別が初期情報量の写像になる。
機械走査は接触キャパシティと違い希少資源ではないので、無作為枠2割のような配分設計は不要であり、単純に全件を同じ深さで走査する。

対象母集団：`seed_projects`に紐づかない`seeds`全行（2026-08-15時点156件）＋以後の新規登録行。照会日を走行台帳に必ず記録する。

### 1.3 やらないこと

- 帯そのものの計算・保存はしない。本パイプラインの出力は`seeds`（空列の充填）・`seed_funding`・`seed_news`への書き込みまで。帯の再計算は一次選別層の責務。
- q帯の評価には関与しない（q はルーブリック評価者入力。設計正本§6の10）。
- その場の感覚での数値の生成をしない。書き込むのは出典URLを添えられる事実のみ（測定可能性ゲート問6と同じ規律）。

## 2. データ源の目録

### 2.1 researchmap

**実地確認結果（2026-08-15、えいみがcurlで確認）**：

| 項目 | 確認結果 |
|---|---|
| ベースURL | `https://api.researchmap.jp`（設計書2.5.1節。直下アクセスは404のJSONエラー、実測一致） |
| 個別研究者の公開データ取得 | `GET /{permalink}` → **認証不要で200**、JSON-LD形式。所属・氏名（かな・英字含む）・公開設定を返す（実測：公開プロフィールで確認済み） |
| 業績リスト取得 | `GET /{permalink}/{achievement_type}` → **認証不要で200**。`research_projects`（共同研究・競争的資金）、`published_papers`、`misc`、`awards`等。`start`/`limit`でページング、`total_items`と`_links.next`付き（実測：`research_projects?limit=2`で確認済み） |
| 研究者検索API | `GET /researchers?...` → **401 invalid_token（実測）**。アクセストークン必須 |
| 認証方式 | OAuth2 JWT Bearer Flow。`POST /oauth2/token`にJWT（RS256署名）を送りアクセストークンを取得（V2 API設計書2.2.3節） |
| APIキー | JSTへの利用申請書（機関用PDF様式）で発行。**年度単位の申請、承認IPアドレスからのみ利用可** |
| **検索・一括取得の範囲制限** | 設計書2.4節「制限事項」：APIキーで可能な公開情報の取得・一括取得・更新・検索の範囲は「**APIキーに紐づいた機関に所属する一般会員**」に限定。つまりAMDが申請しても**他機関の研究者を検索APIで探すことはできない見込み** |
| レート制限 | 数値の明記はV2 API設計書（204ページ版、2026-04-07更新）内に**未確認**。保守的に1リクエスト/秒以下＋夜間実行とする |
| 利用規約上の注意 | API利用は申請ベース。一方、`GET /{permalink}`系は申請なしで応答することを実測したが、**無認証利用が規約上明示的に許容されているかの文言は未確認**。パイプライン本実装前にresearchmap利用規約の該当条項を確認する（§8） |

出典：[researchmap V2 API設計書PDF](https://researchmap.jp/outline/v2api/v2API.pdf)、[仕様書類ページ](https://researchmap.jp/public/other-document/specification)、[申請書類ページ](https://researchmap.jp/public/other-document/application)

**帰結**：permalinkが判明しているシーズは無申請で文書取得まで到達できる。**ボトルネックはpermalinkの発見**（検索APIが機関限定のため使えない）。permalink発見の経路は§3で設計する。なおWeb画面の検索（`https://researchmap.jp/researchers?q=…`、200応答を実測）はスクレイピングの規約適合が未確認のため、確認までパイプラインに組み込まない。

**フィールド対応表**（列名は`db_schema.md`からコピー）：

| researchmapフィールド | 書き込み先 | 備考 |
|---|---|---|
| `permalink`（確定後のURL `https://researchmap.jp/{permalink}`） | `seeds.researcher_url` | 空の場合のみ（§4） |
| `family_name`/`given_name`（ja） | `seeds.researcher_name` | 空の場合のみ（国研2件のnull対策。ただし§3の同定が前提） |
| `affiliations[].job`（職名） | `seeds.researcher_title` | 空の場合のみ |
| `affiliations[].section` | `seeds.lab_name` | 空の場合のみ |
| `research_interests` | `seeds.keywords` | 既存配列への追記はせず、空の場合のみ（§4） |
| `research_projects[]`（課題名・提供機関・期間） | `seed_funding.program`（課題名＋事業名）、`program_short`、`fiscal_year`（開始年度）、`status`、`source_url`（researchmapの当該業績URL）、`notes` | 金額はresearchmap側に原則無い→KAKEN側で補う |
| `published_papers[]` / `awards[]` / プレス相当の`misc[]` | `seed_news.kind`／`title`／`body`／`occurred_on`／`source_url` | 直近3年など件数上限を設ける（§5） |

### 2.2 KAKEN（科研費データベース、NII）

**実地確認結果（2026-08-15）**：

| 項目 | 確認結果 |
|---|---|
| エンドポイント | 課題検索 `https://kaken.nii.ac.jp/opensearch/`、研究者検索 `https://nrid.nii.ac.jp/opensearch/`（[NII公式APIドキュメント](https://support.nii.ac.jp/ja/kaken/api/api_outline)） |
| 認証 | `appid`必須。**無appidアクセスは403「Exceeds allowed rate」を実測**（課題・研究者とも） |
| appid取得 | CiNiiのAPI利用者登録（Web登録）で取得。**アカウント登録はまさ対応が要る**（§8） |
| 出力形式 | XML（公式ドキュメント明記）。JSON対応の有無・詳細パラメータ定義は公式のXML定義リポジトリ参照が必要で**未確認** |
| レート制限 | 具体的な数値は**未確認**（403の文言が「rate」であることから、appid無し=rate 0の扱いと推定）。利用規程の確認を本実装前に行う |

**取れるフィールドと対応**（KAKEN課題レコードの一般的構成。appid取得後にXML定義で列対応を最終確認する）：

| KAKENフィールド | 書き込み先 | 備考 |
|---|---|---|
| 研究種目（基盤・挑戦的・若手等） | `seed_funding.program`／`program_short` | §6のstage_funding導出のキー |
| 配分額（直接経費・総額） | `seed_funding.amount_jpy` | **全件null問題の主たる解消源** |
| 研究期間 | `seed_funding.fiscal_year`（開始年度） | 期間終了年は`notes`に |
| 採択・完了等 | `seed_funding.status` | KAKEN側の語彙→OS語彙の写像表を実装時に固定 |
| 課題ページURL | `seed_funding.source_url` | 必須（§4） |
| 研究者番号・研究者名・所属機関 | 突合キー（§3）。DB列へは直接書かない | 研究者番号の保存先は§8の未解決 |
| 研究概要・実績報告の要旨 | `seed_news`（`title`=課題名、`body`=要旨、`source_url`=課題URL） | 段階仮説の`stage_document`引用元になる |

### 2.3 JST採択課題・GRANTS

- [JSTプロジェクトデータベース](https://projectdb.jst.go.jp/)：JSTの競争的資金（A-STEP、創発、CREST等）の課題検索。**登録不要・無料**（公式サポートページ明記）。APIの有無は**未確認**→当面HTML取得。
- [GRANTS 研究課題統合検索](https://grants.jst.go.jp/)：JSTプロジェクトDB＋KAKEN＋AMEDfindの横断検索。APIの有無は**未確認**。
- 対応：課題名・事業名→`seed_funding.program`、年度→`fiscal_year`、金額（掲載時）→`amount_jpy`、課題URL→`source_url`。

### 2.4 NEDO

- 採択テーマはニュースリリース（HTML/PDF）での公表が主。[成果報告書データベース](https://seika.nedo.go.jp/)はWeb検索画面のみでAPIは**未確認**（2026-08-15の検索で公開APIの記述は見つからず）。
- 対応はJSTと同じ（`seed_funding`行の生成）。構造化度が低いため優先度は第3層（§5.2）。

### 2.5 AMED

- [AMEDfind（AMED研究開発課題データベース）](https://amedfind.amed.go.jp/amed/index.html)：課題検索ポータル。APIは**未確認**。GRANTS経由の横断検索にも含まれる。
- 対応はJSTと同じ。

### 2.6 大学プレスリリース

- 各大学サイト・PR TIMES等。構造化されておらず全文検索頼み。取り込み先は`seed_news`（`kind`はプレス相当、`ingested_by`でパイプライン由来を明示、`verified=false`）。
- SRLの根拠には**使わない**（対応表v0.3 §3：機関自身のプレスは SRL に含めない）。段階仮説の`stage_document`引用元としてのみ使う。
- 第3層（§5.2）。初期走行では対象外にしてもよい。

## 3. 突合規則（シーズ⇔外部レコードの同定）

### 3.1 主経路

researchmap検索APIが機関限定で使えない（§2.1）ため、同定の主経路は次の順とする。

1. **既知URL**：`seeds.researcher_url`が既にresearchmapを指す場合、そのpermalinkを確定IDとする（以後この行の突合は不要）。
2. **KAKEN研究者検索**（appid取得後）：`researcher_name`＋`org_name`で`nrid.nii.ac.jp`を検索し、候補の**研究者番号**を得る。研究者番号は日本の公的資金系で安定した個人IDであり、KAKEN課題との突合はこの番号で行う。
3. **研究者番号→researchmap**：KAKEN研究者ページ等からresearchmapへの導線があればpermalinkを取得する（導線の有無・形式は**未確認**、appid取得後に実地確認）。導線が無い場合、permalink推定はせず`researcher_url`は空のまま残す（推定permalinkへのアクセスによる誤同定を避ける）。

### 3.2 曖昧一致の規則

- 氏名の正規化：全半角・空白・旧字体（髙/高、邊/辺等）の正規化テーブルを固定する。
- 機関名の正規化：法人格（国立大学法人等）・キャンパス表記の除去、`org_name`の別名辞書（実装時に156件の実データから作る）。
- **第2キー必須**：氏名＋機関の一致だけでは確定しない。シーズの`domain_lane`／`keywords`／`summary`と、候補研究者の研究分野・課題キーワードの**分野照合**を必ず併用する（同姓同名・同機関の防止）。

### 3.3 同定確信度タグと書き込み可否

| タグ | 条件 | 書き込み |
|---|---|---|
| `match_confirmed` | 既知URL一致、または人手承認済み | 全対応列へ書き込み可 |
| `match_exact` | 氏名完全一致＋機関一致＋分野照合が正 ＋ 候補が1人 | `seed_funding`／`seed_news`へ書き込み可。`seeds`本体の充填も可 |
| `match_probable` | 氏名完全一致＋機関の部局違い等＋分野照合が正 | `seed_news`への証跡保存のみ（`verified=false`）。`seeds`／`seed_funding`へは書かず人手確認キューへ |
| `match_ambiguous` | 候補複数、または分野照合が負 | 一切書き込まない。候補一覧を走行台帳に残し人手確認キューへ |
| `match_none` | 候補ゼロ | 走行台帳に記録（次回走行の対象に残す） |

- 確信度タグは書き込む全行の`notes`（seed_funding）／`body`末尾のメタ行（seed_news）に残す。
- `researcher_name`がnullの行（国研2件）は突合の起点が無い。**タイトル・要約からの研究者の自動特定はしない**（誤同定の最悪形）。人手確認キューへ回すことをパイプラインの正規出力とする。
- 接触時に誤同定が判明した場合、当該シーズのパイプライン由来行を`source_url`起点で棚卸しして修正し、誤同定事例として§7の監視に記録する。

## 4. 書き込み契約

1. **人手入力優先（上書き禁止）**：`seeds`の各列は**nullの場合のみ**充填する。既存の非null値と外部値が食い違う場合は上書きせず、`seed_news`へ差異記録の行を証跡として残す（人手レビュー対象）。`seed_funding`／`seed_news`は追記型なので上書き自体が発生しない設計とする（既存行の`amount_jpy`だけは例外：**人手由来でない**既存行に限りnull→値の充填を許す。人手由来か否かは`notes`・`created_at`で判定できない場合は充填しない）。
2. **出所の必須化**：パイプラインが書く全行に (a) `source_url`（`seed_funding.source_url`／`seed_news.source_url`。null不可として扱う）、(b) 取得日時（`created_at`は自動now()。取得実行IDを`notes`／`body`メタ行に併記）、(c) 出所タグ（`document:<source>`形式。例 `document:kaken`、`document:researchmap`）を付ける。
3. **証跡はseed_newsへ**：`seeds`本体への充填（researcher_url等）は`seeds`側に出所列が無いため、必ず同時に`seed_news`へ「何をどの出典からいつ書いたか」の証跡行を残す。`ingested_by`は`doc_pipeline_v<版>`で固定（既定値`manual`と機械区別できる）。`verified`は**false**で入れる（既定値trueを明示的に倒す。人手確認で昇格）。
4. **冪等性**：
   - `seed_news`：UNIQUE `(seed_id, source_url)`（db_schema.md記載の既存制約）を使ったupsert（on conflict do nothing）。再実行で重複しない。
   - `seed_funding`：UNIQUE制約が無い（db_schema.md確認済み）。自然キー`(seed_id, program, fiscal_year)`でselect-then-insertする。UNIQUE制約の追加はまさ判断（§8）。
   - `seeds`：null充填のみなので再実行は自然に冪等。
5. **削除しない**：パイプラインは既存行を削除・無効化しない。誤同定の修正も人手（またはまさ承認済みの修正スクリプト）で行う。

## 5. 実行形態

### 5.1 実行基盤

- **Codex automation（定額枠）での背景実行**を前提とする。AMD OSの制約（いずれも確定済み運用ルール）：PWA/VercelでのLLM cron禁止、Anthropic API従量課金の直叩き封鎖（`getBackgroundAnthropic`はデフォルトthrow）。したがってVercel cronにもEdge Functionにも載せない。
- 取得（HTTP）とパース・正規化はスクリプトで行い、LLMは (a) 曖昧一致の分野照合の判定補助、(b) 非構造ソース（プレス・採択発表HTML）からの抽出、に限定する。
- 書き込みはSupabaseへ直接（service_role）。書き込みロジックは§4の契約をコードで強制する（null充填のみ・source_url必須・verified=false）。

### 5.2 バッチ粒度・頻度

| 層 | 内容 | 頻度 |
|---|---|---|
| 第1層 | researchmap（permalink既知の行の業績同期）＋KAKEN課題（研究者番号既知の行） | 週1周（156件÷7日≒23件/日。1件あたり数リクエストなので余裕） |
| 第2層 | 未同定行の突合試行（KAKEN研究者検索→確信度タグ付け→人手キュー生成） | 週1周。`match_none`／`match_ambiguous`の再試行は月1（外部DB側の更新を待つ） |
| 第3層 | JST projectdb／NEDO／AMED／大学プレス（HTML取得） | 月1周から開始（構造化度が低く歩留まりが読めないため、第1・2層の成果を見て調整） |

- 外部APIへのリクエスト間隔は1req/秒以下＋夜間帯実行。KAKENはappidの利用規程確認後、規程側の上限があればそれに従う。
- 1バッチ=シーズ単位で完結させる（1シーズの取得→抽出→書き込みを1トランザクション相当として扱い、途中失敗でも他シーズに波及させない）。

### 5.3 走行台帳と失敗時の再開

- 走行台帳（シーズごとの`last_run_at`、層、結果=書き込み行数、確信度タグ、エラー）を保存する。保存先は新テーブル（例：`seed_doc_pipeline_runs`）を第一候補とするが、テーブル新設はまさ判断（§8）。それまではリポジトリ内のrun log md（`pwa/bzm/runs/`慣例に合わせる）で代替する。
- 再開規則：`last_run_at`最古優先で再走査。§4の冪等性により、失敗地点の特定なしに同じシーズを頭から再実行してよい。
- 失敗の分類：(a) ネットワーク・レート（リトライ、次周へ持ち越し）、(b) 突合不能（人手キュー行きが正規出力。失敗扱いしない）、(c) スキーマ想定外（走行停止し人手へ。書き込み契約違反の恐れがあるため続行しない）。

## 6. 段階仮説への接続（stage_fundingの機械導出）

`seed_funding`へ取り込んだプログラム名を、対応表v0.3 §1の「資金プログラム→段階」表で写像し、根拠タグ`stage_funding`付きの段階仮説を機械生成する。

1. **写像は対応表の凍結版のみを使う**。パイプライン側でプログラム→段階の独自判断をしない。対応表に無いプログラムは写像せず「未写像プログラム」として台帳へ積む（対応表の次版改訂の入力になる）。
2. **幅の規則は対応表に従う**：科研費（基盤・挑戦的・若手）=S0、JST創発=S0〜S1（単独でS1を確定しない）、A-STEP／GAPステップ1=S1、GAPステップ2／NEDO実用化・若手=S2、SBIR=フェーズ記載に従う。**AMED橋渡し・NEDO先導は機械確定しない**（対応表指定の個別判定）→段階を書かず「個別判定要」フラグのみ生成。
3. **複数プログラム保有時は包絡**（該当段階の最小下限〜最大上限）。ただし対応表§2の規律どおり、材料の強さに応じ幅は最小1・最大2段階に収める（包絡が3段階以上に広がる場合は`stage_unknown`側に倒して幅規律を守る）。
4. **上書きしない**：既に`stage_document`（実績記述の引用）による段階仮説がある行では、`stage_funding`はそれを上書きせず併記に留める。根拠強度は`stage_document` > `stage_funding` > `stage_inferred`。
5. **鮮度の注記**：終了後5年以上経過した資金しか無い場合、段階仮説に「情報が古い」注記を付ける（段階を下げる操作はしない。下げる規則を作るならまさと別途合意）。
6. 併産物：最後の資金の終了年度は「資金の崖」の近似情報としてTier 1昇格時に使えるため、`seed_funding.notes`に期間終了年度を必ず残す。

## 7. 検証と反証条件

1. **層別ごとの帯縮小の監視**：走行の前後で、帯上位層と下位層それぞれの平均帯幅・document件数を記録する。**走行後も下位層の帯だけが縮まらない場合**は設計正本7章2項が発動する（無作為枠の比率引き上げ）。ただしその前に本パイプライン固有の原因（下位層で突合失敗率・`match_ambiguous`率が高い＝情報が薄い層は突合も難しい、という構造）を切り分ける。突合失敗が原因なら、無作為枠引き上げではなく突合規則の改訂（人手キューの優先処理を下位層へ配分する等）が正しい対処になる。
2. **誤同定率の監視**：各走行から無作為10件（`match_exact`書き込み分）を抜き取り人手検証する。誤同定率が5%を超えたら`match_exact`の自動書き込みを停止し、全件人手承認（`match_confirmed`のみ書き込み）へ格下げして規則を改訂する。閾値5%は暫定値でまさレビュー対象。
3. **接触時のフィードバック**：接触で判明した誤同定・段階仮説の外れは、走行台帳へ事例として記録する（段階仮説の的中記録は設計正本2章9項のとおり最速の較正データ）。
4. **補完寄与率の相関監視**（設計正本7章4項の分担）：documentが増えたのに補完寄与率と層別順位の相関が高止まりする場合、パイプラインの供給が層別に効いていない。取り込みフィールドの優先度（金額・段階根拠を最優先にしているか）を見直す。

## 8. 未解決事項

**まさ対応が要るもの**：

1. **KAKEN appidの取得**：CiNii API利用者登録（Webでのアカウント登録）。えいみはアカウント作成を代行できないため、まさ本人の登録が必要。これが無いとKAKEN経路（金額補完の主経路）が動かない。
2. **researchmap API利用申請の要否判断**：検索APIは申請しても「APIキー機関の所属会員」限定の見込み（§2.1）で、他機関シーズの探索には効かない可能性が高い。申請の費用対効果を判断してほしい（えいみの現時点の見立て：申請せず、公開GET＋KAKEN経路で足りる）。
3. **DB拡張の判断**（DDL自体は事前承認不要ルールだが、設計としての採否）：(a) 外部ID列（researchmap permalink・KAKEN研究者番号・KAKEN課題番号）の専用列 vs notes運用、(b) `seed_funding`のUNIQUE `(seed_id, program, fiscal_year)`追加、(c) 走行台帳テーブル`seed_doc_pipeline_runs`の新設。
4. 誤同定率の停止閾値5%（§7.2）と、`seed_news.kind`の機械取り込み用語彙の追加可否。

**技術的に未確認のもの**：

5. researchmap公開GET（無認証）の**規約上の許容の明文**。実測では応答するが、利用規約の該当条項を本実装前に確認する。
6. researchmapのレート制限の数値、KAKENの利用規程上のレート上限。
7. KAKEN XMLの正確なフィールド定義（公式XML定義リポジトリ。appid取得後に実地確認）と、KAKEN研究者ページ→researchmap permalinkの導線の有無。
8. JST projectdb／GRANTS／NEDO／AMEDfindのAPI有無（2026-08-15の調査ではいずれも公開APIの記述を発見できず）。
9. `seed_news.kind`の既存語彙（既存144行の実データ照会が必要。機械取り込み語彙はそれを見てから決める）。
10. researcher_name nullの国研2件の研究者特定（人手。自動特定は§3.3で禁止した）。

---

### 付録：API実地確認ログ（2026-08-15）

```
GET https://api.researchmap.jp/                          → 404 JSON {"error":"not_found"}（設計書どおり）
GET https://api.researchmap.jp/{公開permalink}            → 200 JSON-LD（researcher profile。無認証）
GET https://api.researchmap.jp/{公開permalink}/research_projects?limit=2
                                                         → 200 JSON-LD（total_items・_links.nextでページング。無認証）
GET https://api.researchmap.jp/researchers?format=json   → 401 {"error":"invalid_token","error_description":"アクセストークンを指定してください。"}
GET https://kaken.nii.ac.jp/opensearch/?kw=AI            → 403 XML <error>Exceeds allowed rate</error>（appid無し）
GET https://nrid.nii.ac.jp/opensearch/?qm=…              → 403（appid無し）
GET https://researchmap.jp/researchers?q=…（Web画面）     → 200（HTML。規約未確認のため未採用）
```

参照文書：researchmap V2 API設計書（204頁、2026-04-07版PDF）2.2.3節（OAuth2 JWT Bearer Flow）、2.4節（制限事項：APIキー範囲は発行機関の所属会員限定）、2.5.1節（ベースURL）、3章（`GET /{permalink}/{achievement_type}`、`GET /researchers`、`GET /_bulk`）。
