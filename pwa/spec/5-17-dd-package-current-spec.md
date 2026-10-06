# DDパッケージ仕様（投資家・金融機関向けの開示面）

2026-10-06: DDの左メニューは一般DDの16項目をグループ分けせず、一段で常設する。順番は会社基本情報、株主・資本政策・投資条件、会社の意思決定、事業計画・開発計画、市場・競合、顧客・販売、技術・製品、技術実証の証拠、製造・品質・供給、知財・大学の利用権、経営陣・人員・雇用、重要契約、法規制・許認可・安全、紛争・関連当事者・利益相反、財務・税務・借入・採算、証憑・版・開示管理。資料の有無では入口を変えない。新規の7区分は未登録の空状態とし、説明記事があるだけで原本を登録済みと扱わない。既存の共通ページ本文はそのまま使い、ビジネスモデル・ガント・コスト試算・資金調達履歴・沿革は関連リンクと旧URLから開ける。コックピット・ワークスペースのメニュー、閲覧権限、DB、正式版PDFの選択項目は変更しない。


2026-10-06: コックピット・ワークスペース・DDパッケージは、左側に領域切替と分類・ページメニュー、右側に本文を置く。共通の `ProjectSpaceLayout` は幅768px以上で208pxの左列、狭い画面では「スペースメニュー」から左ドロワーを開く。分類を押すと既存の既定ページを開き、選択した分類の子ページを直下へ縦に展開する。子ページが1つだけなら入口を重ねない。ホバーのフロートは使わない。ページ選択で狭い画面のメニューを閉じる。操作領域は44px以上、選択中表示とキーボードフォーカスを保ち、既存URL・権限・ページ順・本文・保存操作は維持する。

2026-10-04: DDのページ本文を掲載項目の抜粋から共通ページへ修正。技術・競合比較・ビジネスモデルは全トピック・行・知識断片、試算表はPL/CF/資本計画/助成金/設立日/試算、資本政策表は全プランと版、コスト試算は廃液・燃料を共通部品で表示。会社概要も決算・総会を含む共通データを使用。キラー要素カタログは会社概要から独立したコックピット専用ページへ移した（2026-10-06修正）。会社概要本文は3領域で同じ。DDの入場認可は独立したまま、書込み権限は追加しない。資料の公開対象と正式版PDFの項目選択は維持。

> **この章は何か**: 投資家・金融機関が、共有対象に指定されたページ・資料だけを閲覧する「DDパッケージ」の確定仕様。入れる領域と操作の分け方、中身の出し方、画面、正式版（PDF）の出力、権限の検証、残課題を定める。初版は SOL（p21）で 2026-09-30 に実装した（migration 455〜458）。

## 1. 3つの領域

AMD OS の PJ 情報は、コックピット・ワークスペース・DDパッケージの並列の3領域に分ける。コックピットとワークスペースは「PJ見出し → 領域の選択 → 分類 → 子タブ → 本文」、DDは「PJ見出し → 領域の選択 → 16項目の一段メニュー → 本文」を使い、見られる人・ページ・操作を独立した権限で決める。DDを他領域の子タブには入れない（2026-10-04 まさ確定）。

| 領域 | 入れる人 | 根拠（毎リクエスト DB 再確認） | 中身 |
|---|---|---|---|
| コックピット `/project/[id]/cockpit` | AMD メンバー | `members`・`project_members`（Supabase の社内ログイン） | 経営管理・内部判断・交渉情報 |
| ワークスペース `/project/[id]/workspace` | 招待した研究者・事業化メンバー | `project_access_memberships`（外部アカウント）/ PJ限定メンバー | 共同作業に要る情報 |
| DD `/dd/[slug]` | 招待した投資家・金融機関 | `dd_package_grants`（外部アカウント） | DDで表示する共通ページと、公開対象の資料 |

- **入れる領域と、できる操作を別に持つ。** 領域は付与の表（どの表に行があるか）で決まり、操作は DD の付与行の `capabilities`（`dd.view` 閲覧 / `dd.download` 資料のダウンロード）で決まる。`dd.view` は必須。
- DD の付与はワークスペース・コックピットへ入る根拠にならない。ワークスペースの所属（`readonly` を含む）も DD へ入る根拠にならない。`workspace-access-scope-core.ts` の範囲判定は DD の付与を数えない。
- AMD の admin（`members.is_admin` かつ portfolio）は、未公開を含むすべてのパッケージと、設定画面で選んだ非公開の項目を同じページ構造で開ける。閲覧画面に管理者プレビューの帯や専用の閲覧モードを設けない。admin 以外の内部メンバーと PJ限定メンバーは DD を開けない。
- ログインの仕組みは外部ワークスペースと同じ（メールリンク → 署名 cookie `amd_os_workspace_session`、`pwa/design/institution_seed_project_model.md` §6.4）。

## 2. 認証とログイン

| 段階 | DD のための動作 |
|---|---|
| `POST /api/auth/email-start` | ワークスペースの所属が無くても、公開中（`open`）パッケージへの有効な DD 付与（招待済み・有効、期限内、`dd.view` あり）があればログインリンクを送る（`hasLoginEligibleDdGrant`）。未公開・受付終了のパッケージへの付与だけではリンクを送らない |
| ログインリンクの方式 | **PKCE**（`@/lib/supabase/server` の SSR クライアント、コード検証値は cookie）。リンクはログイン画面を開いたのと同じブラウザで開く |
| `GET /auth/callback`（`login_scope=workspace`） | 招待済みの DD 付与を `active` にする（失敗したら閉じる）。ワークスペースの範囲と DD の範囲を両方引き直し、どちらかがあればログインを通す。DD だけの人は、戻り先の指定が `/` か `/workspaces` なら `/dd` へ送る |
| 関所 `src/lib/supabase/middleware.ts` | 外部アカウントの署名 cookie を認証として通すのは、ワークスペースの面と DD の閲覧の面（`isDdViewerPath`: `/dd`、`/dd/[slug]`、`/dd/[slug]/items/[itemId]`、`/dd/[slug]/items/[itemId]/file`）だけ。コックピット・管理画面・正式版の印刷画面（`/dd/[slug]/print`）は社内ログインへ戻す |
| `/workspaces`・`/` | DD だけの人は `/workspaces` から `/dd` へ案内し、`/` には「閲覧できるDD資料へ」を出す。両方を持つ人は `/workspaces` に DD の一覧も出す |

停止・失効は cookie の期限（30日）を待たず次のリクエストで効く。判定は `buildDdViewerScope`（`src/lib/dd-package-core.ts`）の純関数で固定し、アカウントが `active` で Supabase の認証と紐付き cookie のメールと一致すること、付与が `active` で期限内で `dd.view` を持つこと、パッケージが `open` であることをすべて満たす付与だけを数える。

## 3. データ（migration 455〜458・469）

| 表 | 役割 |
|---|---|
| `dd_packages` | パッケージ。`status`: `draft`（未公開・管理者だけ）/ `open`（付与された人だけ閲覧）/ `closed`（誰も閲覧できない）。`slug` は URL、`notice_text` は冒頭の注意書き |
| `dd_package_grants` | 閲覧権限。外部アカウント × パッケージ。`status`: invited / active / suspended / revoked、`capabilities`、`expires_at`、`organization_name`（投資家・金融機関名）。同じ人への2つ目の付与は作れず、停止・失効は作成で復活しない |
| `dd_package_items` | 掲載項目。区分 `section_key`、種類 `item_kind`、元データ `source_key`、表示の選択 `source_options`（自動の未確認事項を加えるか）、表題・一行説明・未確認事項・根拠資料。**`is_published` は資料の共有と正式版PDFの項目選択の切り替え。常設ページの本文表示には使わない**（公開した日時と admin を `published_at` / `published_by_member_id` に残す）。新しい項目は `false`（非公開）で作り、外した項目（archived）は公開できない（DB の制約） |
| `dd_item_publications` | 初版（2026-09-30 の最初の反映）で使った、公開時点の内容の記録。追記のみで、新しい行は作らない（記録として残す） |

- 4表とも RLS 有効、anon と一般 authenticated の直接権限なし、admin は SELECT だけ。書込みは service_role のサーバ経路。
- 行の変更は `workspace_record_security_row_mutation()` で同じ transaction の `workspace_access_audit_logs` に入り、OS 全体の変更履歴（`amd_os_data_change_history`）にも入る。物理削除はしない。
- private Storage `dd-publication-files` は、Google ドライブの資料を投資家へ渡すための写しの置き場（`cache/<package>/<document>/<ドライブの md5>`。同じ版なら使い回す）。
- DB 側の約束は `scripts/dd_package_db_readback.sql` で本番 DB 上を確かめる（最後に必ず ROLLBACK）。

## 4. 共通ページの本文

2026-10-04 まさ「ページの中身を３つのスペースで別々になってるのは設計上のミス」。3領域は表示するページと入れる人を変え、同じページは同じ元データ・表示部品・構成で描く。DDだけ掲載項目から本文を組み立てる処理を廃止した。

DDの入場認可を毎リクエスト確認した後、選択したページの当該PJデータをサーバで取得し、共通部品へ初期データとして渡す。ページ本文は `dd_package_items.is_published` の有無に依存しない。元データが本当にない場合のみ共通の空状態を表示する。DD付与を汎用PJ APIの権限へ流用しない。DDでは編集・保存・追加を表示しない。

2026-10-06: 同じページはどの領域でも同じ元データ・本文を表示する。社内専用情報は本文の部分非表示で分けず、独立したページにする。キラー要素カタログは会社概要から切り出したコックピット専用ページ `?tab=killer-factors`。DD・ワークスペースにはこのページを定義しない。会社概要部品には領域別の表示分岐を持たせず、カタログの定義・PJ状態・根拠・記録者・全体判定・件数を含めない。`loadDdProjectPage` はカタログを取得せず、DD用の型・初期データにも含めない。管理者DDプレビュー・会社概要PDF・正式版PDFも同じ会社概要本文を使う。`/api/governance/killer-factors` は `requireMember` と `getCurrentMemberAccess().scope === "portfolio"` で認可し、共有PJ所属やDD付与を根拠にせず、成功応答は `private, no-store`。DBの評価記録は保持する。

| ページ | 元データと共通部品 |
|---|---|
| 技術・競合比較・ビジネスモデル | `loadProjectTechData` → `CockpitTechnology`。全トピック・行・知識断片、ページ内の全体像・技術区分・トピック切替まで共通 |
| 試算表 | `loadProjectFinancePage` → `ProjectFinanceFormat`。PL、CF、最新active資本計画、助成金、設立日、BZM試算の6種類を共通表示へ渡す |
| 資本政策表 | `loadCapitalPlanPage` → `CapitalPlanWorkspace`。プラン選択・株主・イベント・計算結果・凍結版を共通表示。DDでは編集と復元不可 |
| コスト試算 | 廃液と燃料の両モデル → `CockpitCostTab`。選択と明細を共通化 |
| ガント | `getQuestionTreeBundle` → `QuestionTreeView`。gantt、canManage=false、pt権限なし |
| 関係先 | 当該PJの管理データ → `SxPartnerPipeline`。このページで使わない内部判断・週次差分・監査などは送らない |
| 事業計画 | `loadProjectBusinessPlan` → `CockpitBusinessPlan` |
| 知財 | 当該PJの資産・権利・期限・経過 → `CockpitIpPortfolio` |
| 会社概要 | `loadProjectGovernance` と事業概要 → `CockpitCompanyOverview`。基本情報・決算・総会・要対応を共通表示。キラー要素は独立ページへ移し、3領域すべての会社概要から外す |
| 資金調達履歴 | `loadProjectGovernance` → `CockpitCapitalPolicy` |
| 沿革 | 助成金・獲得台帳・活動履歴 → `CockpitGrants` / `Bzm22AcquisitionLedger` / `CockpitAmdContributions` |
| ドライブ | 公開対象の資料 → `WorkspaceDocumentRoom`。一覧と検索などは共通部品、表示・ダウンロードURLはDD認可経路 |

入場権限とファイル共有は別に保つ。ドライブは公開対象として選んだファイルだけを返し、直接URLにも公開状態・付与・`dd.download`の認可を行う。パッケージのdraft/open/closed、付与の停止・失効、外部ログインは変更しない。

設定画面の資料以外の掲載項目は正式版PDFに含める対象で、本文の表示条件にはならない。技術台帳の個別選択・未確認事項・根拠資料の編集は正式版PDFの整理用として残す。技術ページの一部を非掲載にしても、DDの共通技術ページから内容は消えない。ページ全体を開示することを設定画面に明記する。

旧 `/items/[itemId]` は項目の認可を保ったまま対応する共通ページを開く。資料の非公開・別パッケージの項目は引き続き拒否する。共通ページの閲覧入口は `?tab=`。

## 5. 画面

| route | 誰 | 中身 |
|---|---|---|
| `/project/[id]/dd?tab=manage` | admin（portfolio） | 独立したDD領域の管理。パッケージの設定と状態、掲載項目・公開設定・元データから追加、閲覧権限、PDF出力と閲覧の記録。「掲載内容」「PDFを出力」への入口。外部の参加者には出さない |
| `/dd` | 外部アカウント / admin | 閲覧できるパッケージが1つならそのトップへ、複数なら一覧。admin には全パッケージを開く入口と設定への入口 |
| `/dd/[slug]` | 付与のある外部アカウント / admin | PJ見出し・領域選択・16項目の一段左メニュー・本文。`?tab=`で直接開く。初期ページは会社基本情報。新規7項目は未登録の空状態。旧ビジネスモデル・ガント・コスト試算・資金調達履歴・沿革も関連リンクと旧URLで開く。専用のプレビュー帯・概要一覧・グループ・子メニューは置かない |
| `/dd/[slug]/items/[itemId]` | 同上（非公開の項目は admin だけ） | 互換の項目URL。該当する共通ページを同じ構造で開き、同じ元データの本文を表示。認可前のデータ読取はしない |
| `/dd/[slug]/items/[itemId]/file` | 同上 | 資料の最新の実体。HTML はスクリプト・外部通信・フォーム送信を止めたサンドボックスで返し（`next.config.ts` の `ddPublicationFileSecurityHeaders` が全体の CSP を上書きする）、それ以外は60秒の署名URLへ送る。`?download=1` は `dd.download` を持つ人だけ |
| `/dd/[slug]/print` | admin | 正式版（PDF）の印刷画面（§6） |
| `/admin/access` の「DD閲覧権限」 | admin | 全パッケージの付与の一覧（読むだけ）。付与・停止・失効は独立したDD管理画面で行う |
| `/project/[projectId]/dd` | admin（portfolio） | 独立したDD入口。登録済みなら `/dd/[slug]` へ送る。未登録でも入口を残し、DD管理画面の空状態を出す |
| `/project/[projectId]/dd/preview/[itemId]` | admin | 旧URL。DDの項目画面へ送る |

- 社内画面の並列のDD入口は `GET /api/dd/summary`（admin限定、既存の参照系キャッシュ経由）で管理権限を確認して出す。パッケージの有無では入口を隠さない。管理の中身は `GET /api/admin/dd`（可変系、毎回読む）。
- 3領域の選択は `ProjectSurfaceNav` を共用する。領域ごとの既存認可を確認できた入口だけを出し、遷移先は毎回DBで権限を確認する。DDの一段メニューは `DdNavigation`、本文は他領域と同じ表示部品を使う。
- 画面台帳 `surface-catalog.ts` も独立したDD管理を正式な入口（canonical、題名「DDパッケージ管理」）として扱う。旧項目プレビューだけを互換経路（deprecated）として分ける。
- 旧 `cockpit?tab=dd`・ワークスペースの `#dd-package` は独立した `/project/[id]/dd` へ送る。コックピット・ワークスペースにDD管理部品を描かない。
- 閲覧者の面は社内の枠（AppShell）を使わず、タイトルに PJ 名・パッケージ名を出さない（権限の確認より先に描かれるため）。権限が無い・非公開・外した・別パッケージはすべて「見つからない」で閉じ、存在を区別させない。
- DD には検索の入口を置かない。
- DDの左メニュー16項目は鍵付きの `DD_ITEM_PAGES`（`DD_TAB_FORMAT`は旧共通ページキーの互換用）、3領域の表示名は `PROJECT_PAGE_LABELS`、元データの振り分けは `dd-pages.ts` と技術台帳の `techLedgerTabOf`。旧7区分は設定・正式版PDFの整理用に保持し、閲覧の分類には使わない。ページ対照表は spec/3-24。
- DD本文は当該PJの共通ページの元データを同じ表示部品へ渡す。元データがないときにタブを隠さず、未登録を表示する。閲覧権限・公開設定・停止/失効・正式版PDFの認可は変更なし。

## 6. 正式版（PDF）の出力

2026-09-30 まさ「とある時点のバージョンを正式版として提出しなきゃいけないので、PDFとして出力できる機能もつけておけばいい」。

- 設定画面の「PDFを出力」から `/dd/[slug]/print` を開く。PDF対象の項目を、いまの元データで、従来の項目用部品で1つの文書に並べる（共通ページ全体の印刷とは別）（表紙に表題・注意書き・出力日時・項目数・目次）。印刷の設定は A4 横、項目ごとに改ページ。
- 「PDFに保存（印刷）」を押すと、サーバが公開中の項目と、それぞれの元データの更新日時を読み直して、出力の記録（`workspace_access_audit_logs` の `dd_package_exported`。detail はパッケージの id・項目数・項目の id と元データの更新日時だけ）を残してから、ブラウザの印刷画面を開く。印刷先で「PDFに保存」を選ぶ。
- 出力した PDF の置き場は、提出物として Google ドライブの該当PJフォルダ（`YYMMDD_件名/`）。
- 管理の「PDFの出力の記録」に、日時・出力した人・項目数を出す。

## 7. 閲覧記録

外部アカウントのトップ閲覧・項目閲覧・資料の表示・ダウンロードを `workspace_access_audit_logs` に `dd_package_viewed` / `dd_item_viewed` / `dd_file_opened` / `dd_file_downloaded` で残す（detail はパッケージ・付与・項目の ID だけ）。内部管理者の閲覧は記録しない。admin の操作は `admin_dd_mutation` と行変更の監査に残る。管理の「閲覧記録」にそのパッケージの直近200件を出す（同じPJの別パッケージの記録は混ぜない）。

## 8. 権限の検証

| 検査 | 内容 |
|---|---|
| `npm run test:dd-package`（deploy 前ゲート） | 純関数（閲覧範囲・ログイン可否・関所の path・直列化）、表示データ（部品が表示する値は削らず、作成者・メモ・重複した summary に仕込んだ目印が残らないこと、未確認事項の自動抽出）、コードの契約（領域の分離、データを読む前の権限確認、閲覧者には公開中の項目だけ、非公開は管理者だけ、固定した版の仕組みを使わない、投資家の画面が汎用の API を叩かない、部品は見るだけ、印刷画面は管理者だけ、出力の記録はサーバが読み直す、管理 API の requireAdmin と同一サイト確認、停止・失効の非復活、関所・ログイン・受け口の閉鎖、migration） |
| `scripts/dd_package_db_readback.sql` | 本番 DB 上で ROLLBACK 付き（新しい項目は非公開、PJ不一致の拒否、外した項目は公開できない、公開の日時の必須、公開の切り替え、物理削除の拒否、付与の操作の制約、重複付与の拒否、ワークスペース所属を作らない、同一 transaction の監査） |
| 実リクエストの確認（2026-09-30、ローカルの本番ビルド + 本番 DB、33項目） | 確認用パッケージ `dd-verification`（公開しない。確認のあとで受付終了）と確認用の外部アカウント（`@example.invalid`、確認のあとで停止）で、ログインなしの拒否、DD だけの人のトップ・項目（ワークスペースと同じ部品で描かれる）・資料（サンドボックス・キャッシュ禁止・ダウンロード権限）、非公開の項目・付与の無いパッケージ・印刷画面の拒否、コックピット・ワークスペース・旧管理画面・コスト試算・技術台帳・資本政策・DD管理・DDの有無の API への直接アクセスの拒否、公開をやめると次の閲覧から消え・公開し直すと戻ること、付与の停止・受付終了が同じログイン状態のまま次のリクエストで効くことを確かめた |

2026-10-04共通化の検収: `test:dd-package` に未掲載の競合比較を含む正本読み取りとPJ範囲・失敗応答の再現試験を追加。全deployゲート、型検査、production build、資本政策ワークスペース契約を確認。本番Chromeで技術の全体像（20トピック/247行）、競合比較（13トピックと星取り表）の3領域一致、desktop/mobileの切替、DD編集操作の制限を確認した。

## 9. 同時に閉じた経路（2026-09-30）

DD の「内部の値を外へ出さない」を満たすために、既存の次の経路を閉じた。

- `POST /api/tsukuyomi/chat` はログインの有無を名前の表示にしか使っておらず、未ログインでも `project_id` を指定すると PJ コックピットの内部 context を読み込めた。先頭で `requireMember()` を必須にした（PWA は cookie、macOS アプリは同じ Supabase の Bearer で通る）。
- `GET /api/project-tech` / `project-cost-model` / `project-ip` は `requireAuth()`（Supabase にログインしているだけ）で通っていた。`requireMember()` または当該PJのワークスペース権限（DB 再確認）に絞った。
- 外部向けメールログインを PKCE にした（§2）。

## 10. 残課題

- **ログインなしで読める表**: 公開用の鍵だけで、`project_monthly_cashflow`（SOL の資金計画を含む）、`project_pl_monthly`、`project_knowledge`、`monthly_reports`、`company_budget_monthly`、`member_activities`、`tsukuyomi_chat_logs`、`llm_prompts` など多数の表が読める（`{public}` に `USING (true)` の読み取り方針が125件）。ワークスペースの試算表タブの資金計画も、ブラウザからこの表を直接読んでいる（DD はサーバで読む）。**DD を投資家へ開く前に閉じる**。ログインなしで動く画面が依存している可能性があり、影響を洗ってから閉じる（まさの判断待ち）。
- `requireAuth()` だけで通る受け口がほかにも残る（`funding-stats`、`progress/unconfirmed`、`atlas/*`、`business-cards/*` など）。外部アカウントの Supabase ユーザーでも通り得るので、上と合わせて点検する。
- 既存の資料室の HTML プレビュー（`/api/workspace-documents/[id]/render`）も、route の付けたサンドボックスの CSP が全体の CSP に上書きされている（DD の資料表示と同じ仕組み。DD 側は `next.config.ts` で上書きし直した）。資料室側を直すと、スクリプトや外部の画像に頼る既存の HTML の表示が変わるので、まさの確認を取ってから直す。
- ワークスペースの資本政策表は、当該PJの参加者の読み取りにも対応済み。書込みはAMDメンバーのみ。DDは独立認可後にサーバで取得する。
- 検査 `test:workspace-documents-contract`・`test:workspace-fact-origin-contract`・`check_project_workspace_route_contract.mjs`（資金調達履歴タブの名前が古い）・`check_zmp_workspace_themes.mjs` は、この変更の前の main でも落ちている（deploy 前ゲートの外）。
- 将来拡張（初回は作らない）: 投資家ごとの追加開示（パッケージを分けるか、項目の audience を持たせる）、質問対応、PDF をサーバで作って保存すること。

## 11. SOL（p21）の状態

- パッケージ `sol`（SolvioraX DD資料）は `draft`（未公開・内部管理者だけが開ける）。閲覧権限は0件。投資家への招待・付与はしていない。
- 掲載項目は、DD初版（Drive `p21_sol/260930_DD資料パッケージ`）の構成を参考に、現在の SOL のコックピット・ワークスペースの元データから選んである（10件、どれも非公開）。公開はまさが中身を確認してから行う。
- 2026-10-03 に「よく聞かれる質問と答え（QA集）」（技術台帳 `ptt_sol_qa`、形は QA集、spec 3-20 §5.7）を「事業概要」の先頭に足し、公開にした（まさ「見せていいよ。むしろ見てもらうために作った」、migration 461）。パッケージは未公開のままで、閲覧権限は0件なので、投資家にはまだ見えない。

## 確認した current truth

- `pwa/src/lib/dd-package-core.ts` / `dd-access.ts` / `dd-payload.ts` / `dd-sources.ts` / `dd-package-server.ts` / `dd-package-summary.ts` / `dd-client.ts` / `dd-format.ts`
- `pwa/src/app/dd/**`、`pwa/src/app/(app)/project/[projectId]/dd/**`、`pwa/src/app/api/admin/dd/route.ts`、`pwa/src/app/api/dd/summary/route.ts`
- `pwa/src/components/dd/**`、`pwa/src/components/cockpit/CockpitTechnology.tsx`（`TopicCard`）、`CapitalPlanMatrix.tsx`（`readOnly`）、`CockpitView.tsx`、`pwa/src/components/project-workspace/SxWeeklyControlDashboard.tsx`、`pwa/src/lib/cockpit-tabs.ts`、`pwa/src/components/admin/DdGrantLedger.tsx`
- `pwa/scripts/migrations/455_dd_packages.sql`〜`458_dd_drop_fixed_publications.sql`、`pwa/scripts/dd_package_db_readback.sql`
- `pwa/scripts/check_dd_package_core.mts` / `check_dd_payload.mts` / `check_dd_package_contract.mjs`
