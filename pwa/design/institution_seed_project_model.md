# 研究機関・シーズ・AMD PJ データモデル

最終更新: 2026-08-15

## 1. 確定した情報設計

AMD OSは、契約の有無に依存しない2つのカタログを持つ。

| カタログ | 正本 | 役割 |
|---|---|---|
| 研究機関リスト | `institutions` | 大学・国研等の機関、制度、地域、ECRを蓄積する |
| シーズリスト | `seeds` | 個別の技術×応用先、研究者、成熟度、SPSを蓄積する |

AMDが契約してもカタログ行を別リストへ移さず、同じ行へPJ運用レイヤーを重ねる。

```text
institutions ──< institution_projects >── projects
     ^                                      共通の契約・月次・タスク
     |
     +──< seeds ──< seed_projects >─────── projects
```

`projects` は共通運用の薄い親として残し、性格の違うPJ固有情報は物理的に別テーブルへ置く。

| PJ種別 | 子テーブル | 固有情報の例 |
|---|---|---|
| 研究機関PJ | `institution_projects` | 対象範囲、対象部局、エコシステム構築目標、シーズ発掘を含むか |
| シーズ事業化PJ | `seed_projects` | 事業化段階、事業化経路、ベンチャー名、対象市場 |

同じ `project_id` を両方へ登録することはDB triggerで禁止する。種別未確認のPJを名称から推測して自動分類しない。

## 2. 評価指標の境界

- ECRは研究機関環境の評価で、`institution_assessments` を正本にする。
- SPSは個別シーズの評価で、`seed_sps_assessments` を正本にする。
- 同じ画面で並べる場合も別系列の観測値として表示し、合成単一スコア、相関、因果指標を作らない。
- PJになってもECR/SPSの意味、計算式、時系列を変えない。
- 適用範囲の確定（2026-08-15 まさ）: この境界が守るのは「機関の評価とシーズの評価を一つの点数へ合成しない」ことであり、機関環境の情報をシーズ側の欠測補完の事前分布として使うことは禁止しない。シーズ一次選別（`pwa/bzm/BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md`）では機関環境をシーズの帯の幅にのみ寄与させてよい。条件は三つ: (i) シーズ固有文書が入った軸では機関由来補完を退役させる、(ii) 機関補完だけで構成された帯から「対象外」への層別を行わない、(iii) 帯の表示に機関補完の寄与率を併記する。なお本境界を2026-08-01に導入したのはOS実装セッションであり、まさの確定文書ではなかった。適用範囲は本日付でまさが確定した。

## 3. ライフサイクル

### カタログ

1. 機関またはシーズを発見する。
2. 契約前でもカタログへ追加し、取れる情報と評価を蓄積する。
3. 名称や同一性が未確認なら候補状態のまま保持する。

### 契約

1. `projects` に共通PJ行を作る。
2. 契約対象が機関全体なら `institution_projects`、個別シーズなら `seed_projects` に1行作る。
3. 研究機関一覧の固定優先度は `PJ化済み → PJ化検討中 → その他`。シーズ一覧は `PJ化済み → PJ化検討中 → PJなし・SPS評価済み → その他` とする。PJ化済みは `active/ended/frozen`、検討中は `sales/draft`（未紐付け時は機関 `draft/prospect`・シーズ `contacted/discussing`）、SPS評価済みは最新評価の `status='ready'` で判定する。
4. 終了後もカタログ行とPJ履歴を残す。別リストへの移動や複製はしない。

`seeds.status='spun_off'` はスピンアウト・法人化の状態であり、AMDとの契約PJ化を意味しない。旧 `spun_off_project_id` は互換列として残すが、新しい関係判定には使わない。

## 4. migration 207 / 209の移行範囲

### 確認済みで移行した関係

| PJ | 種別 | 対象 |
|---|---|---|
| p25 KUTE | 研究機関PJ | 工学院大学 `inst_kute` |
| p28 NIMS | 研究機関PJ | 物質・材料研究機構 `inst_nims` |
| p30 EHM | 研究機関PJ | 愛媛大学 `inst_ehime`。対象は愛媛大学全体、目標は大学全体のエコシステム構築。正式PJ化済みのため `projects.status='active'` |
| p21 SX | シーズ事業化PJ | 旧参照で厳密に一意だった愛媛大学の個別シーズ |

### カタログ移行

- 大学・国研シーズ141件を、名称で監査した46研究機関へ `institution_id` で紐付けた。
- 既存4機関のIDを維持し、追加機関は名称から安定IDを生成した。
- `広島大学 (推定)` は `identity_status='candidate'` とし、正式名称未確認のまま保持した。

### migration 209で追加監査したもの

- 個別シーズ型PJ 19件（p01〜p11の対象、p16/p18/p20/p21/p22/p24/p26/p29）を `seed_projects` へ補完した。p21/p26は既存シーズを再利用し、17件だけ新規シーズ行を追加した。
- 機関型の p12/p23/p25/p28/p30、社内研究の p14、複数シーズ型の p19、社内PJの p00 は単一シーズへ潰していない。
- QSTと山口大学を研究機関カタログへ追加し、研究機関48件・シーズ175件・対象 `seed_projects` 19件になった。
- SXは会社未設立なので `seeds.status='discussing'`、`commercialization_stage='pre_incorporation'`。旧 `spun_off_project_id` はNULLにし、PJ関係は `seed_projects` に維持する。
- SXのSPSは、2026-04-30の既存 `amd_score_inputs` から同じ軸を保った評価行を `seed_sps_assessments` へ移した。ECRは更新・再計算していない。
- 研究機関の根拠のない一言はDBでNULLへ正規化した。香川大学は機関PJ契約済みではなくp26の個別シーズ検討なので、機関状態を `prospect` にした。

## 5. 画面情報設計

### `/institutions`

- 初期表示はECR順位表ではなく研究機関カタログ。
- PJ化済み → PJ化検討中 → その他の順で表示する。
- PJなしも全件表示し、契約前の情報蓄積を主目的として扱う。
- 一言descriptionは表示しない。ECR比較は1研究機関=1行、総合ECRと8軸を列にした同じ画面の別表示として残す。

### `/seeds`

- 175件を全件表示し、`spun_off` / `declined` を除外しない。
- 1シーズ=1行のフラット表にし、研究機関・研究者/PI・PJ状態は通常カラムとして持つ。機関/研究者/PJ有無のgroup rowは作らない。
- PJ化済み → PJ化検討中 → PJなし・SPS評価済み → その他の順で表示し、状態を行色とバッジで目立たせる。
- シーズ状態とAMD PJ状態を別ラベルで表示する。

### コックピット

- 研究機関コックピットは `institution_projects` から対象PJを解決する。
- 研究機関PJから所属シーズを読む場合も、PJ IDの固定表をコードに持たず `institution_projects.institution_id` を使う。
- シーズ詳細は `seed_projects` の契約固有情報を追加表示する。

## 6. 外部ワークスペースとアクセス境界

研究機関側の人がAMD OSへ入る経路を、このカタログ・PJモデルの上に重ねる。本節はmigration 212/213と対応する実装済みの設計であり、両migrationは2026-08-01に本番適用済み。

### 6.1 面の構成

| 面 | 認証 | 中身 |
|---|---|---|
| `/` | 不要 | 公開トップ。認証状態にかかわらず自動転送せず必ず表示する。`institution_workspaces` のうち `status='active'` かつ `is_publicly_listed=true` の行だけを、slug・ワークスペース名・機関の名称/種別/地域で一覧し、説明文、件数、ECR、AMD Scoreは公開しない。ログイン済み内部メンバーにはARMADA OSへの明示ボタン、外部アカウントには `/workspaces` への明示リンクを出す |
| `/workspaces` | 外部アカウント | 外部の人の入口。所属する研究機関ワークスペースと、個別に許可されたPJだけを並べる。機関に所属していることをPJ一覧の根拠にしない |
| `/workspace/[slug]` | 外部アカウント | 研究機関ワークスペース本体。対象機関のPJ、シーズ一覧、ECRを読み取り専用で表示する |
| `/project/[projectId]/workspace` | 内部メンバー または 外部アカウント | 同じURLの二面構成。内部メンバーには詳細バンドル、外部アカウントにはPJ名と共有資料室への入口だけを返す。内部の進捗・関係先・論点を出す外部DTOは未接続 |
| `/admin/access` | 内部admin | 外部アクセス権限の台帳。誰がどの機関ワークスペース・どのPJに入れるかをここだけで決める |

### 6.2 認可の3要素

migration 212で新設する7テーブルが認可の正本になる。

| テーブル | 役割 |
|---|---|
| `workspace_user_accounts` | 外部の人のアカウント。識別子はメールアドレスのみ。`invited` / `active` / `suspended` |
| `institution_workspaces` | 研究機関ワークスペース。slug、`status`（active/paused）、公開一覧掲載の可否 `is_publicly_listed` を独立に持つ |
| `institution_workspace_memberships` | アカウント × 機関ワークスペースの所属。役割は owner / member / readonly |
| `institution_workspace_project_scopes` | 機関ワークスペースが表示するPJの範囲。`shared_surface` で共有の深さを持つ |
| `institution_workspace_seed_scopes` | 機関ワークスペースが表示するシーズの範囲 |
| `project_access_memberships` | アカウント × PJの個別アクセス。役割は manager / contributor / readonly |
| `workspace_access_audit_logs` | ログイン要求・成功・拒否・ログアウト・admin操作の監査記録。メール本文、URL、トークンは残さない |

7テーブルとも RLS 有効で anon と一般 authenticated のポリシーを持たず、admin と service_role だけが触れる。

**明示的な付与しか認可の根拠にしない**。アカウントの登録、機関ワークスペースへの所属、PJへのアクセスは3つの独立した付与であり、メールのドメインが一致していることは認可の根拠にならない。**機関ワークスペースに所属していても、そのPJの詳細ワークスペースへは入れない**。PJ側は `project_access_memberships` の `status='active'` の行が対象PJを名指ししている場合だけ開く。admin APIでも、機関所属を与える操作がPJアクセスを自動作成することはない。停止済み（suspended / revoked）の行は、新規作成では復活せず明示的な更新だけで戻る。

### 6.3 愛媛のスコープ

- **p30（愛媛大学エコシステム構築PJ）**: `ehime` ワークスペースのPJ範囲へ `shared_surface='summary'` で登録する。機関ワークスペース上ではPJのサマリだけを見せ、詳細ワークスペースは共有しない。
- **p31（ZEO = ゼオライト / ナトリウムイオン二次電池材料テーマ）**: migration 269（2026-08-13適用）で `seed_projects` 経由でPJ化し、`ehime` のPJ範囲へ `shared_surface='summary'` で登録した。EHM OSの第2テーマ（`/Users/masa/projects/AMD/ehm-os/EHM_OS_DESIGN_DRAFT_20260813.md` 論点2-A）。PJ詳細面 `/project/p31/workspace` は p21 と同じく `project_access_memberships` の個別許可制。シーズ側の `researcher_name`（現登録: 野村信福教授）は未確認の不一致（まさ発言では中島先生のテーマ）が残るため書き換えていない。
- **p21**: 機関ワークスペースのPJ範囲に含めない。p21の詳細ワークスペースへは、`project_access_memberships` で個別に許可された人だけが入る。
- シーズ範囲は機関段階かPJ化済みかで絞り込まない。`inst_ehime` に紐づくシーズを現時点の全件登録する。機関ワークスペースからの可視性と、PJ個別ワークスペースの共有可否は別軸だから。
- 公開一覧に載るのは現時点で `ehime` の1件だけ。表示名は migration 272 で `EHM OS（愛媛大学）` に変更した（契約書に載る商品名と画面の名乗りを一致させる。slug・認可・中身は不変）。

### 6.3.1 業務デスク（機関キーパーソンの業務ポートフォリオ台帳）

EHM OS設計たたき台（2026-08-13 まさ承認）の論点11-A。機関側キーパーソン（愛媛では石原先生）の業務ポートフォリオを、AMDが代理管理する「業務デスク」として機関ワークスペース配下に持つ。migration 270（スキーマ）/ 271（愛媛29件の初期データ）で本番適用済み。

- テーブルは `workspace_work_cases`（業務ケース台帳）+ `workspace_work_case_deadlines`（締切 1:N）。`institution_workspaces` 配下の汎用構造で、石原先生専用にしない。
- 入力憲法どおり本人には入力させない。行はAMDが既存資料（Excel/Notion/会議メモ）から代理登録し、`data_status`（unconfirmed / confirmed / stale）で本人確認の状態を分ける。初期29件は `石原_業務一覧_研究開発OS用_1.xlsx`（2026-06末版スナップショット）由来で全件 unconfirmed。
- 締切は `due_precision`（day / month / vague）を持ち、月しか分からない期日を確定日に丸めない。期日経過かつ未確認は「期日経過・状況未確認」であり「遅延」と断定しない（SX関係先台帳と同じ規律）。
- `priority_wave`: 1=締切駆動（申請・論文・イベント工程）、2=定常運営、3=UA室横断支援。巻き取りの段階を表す。
- RLSは212の7テーブルと同じ default-deny（`is_admin()` + service_role のみ）。外部（本人）への表示面は、外部専用DTOを設計してから別途開ける。当面はAMD内部の `/institutions/[institutionId]/desk` で運用する。

### 6.4 認証の流れ

1. 公開トップまたはログイン画面で、外部向けの入口としてメールアドレスを受け取る。
2. 登録済みで、かつ失効していない所属がある場合だけログインリンクを送る。登録の有無で応答の形も状態コードも変えない（登録済みかどうかを外から判別させない）。
   送信前にDBのatomic claimを取り、登録account単位で60秒cooldown、15分5回までに制限する。抑止と内部失敗は同じ200応答にする。
3. メールリンクのコールバックでSupabaseのセッションが成立した直後に、`signOut({ scope: 'local' })` でそのブラウザのセッションだけを捨て、**30日固定の署名付きHTTP-only cookieへ交換する**。同じブラウザでは期間内のメール再認証を不要にし、以後、外部ユーザーはSupabaseのauthenticatedセッションを持たない。
4. cookieは毎リクエスト検証し、**さらにDBを引き直す**。アカウント停止、所属の失効、ワークスペースのpauseは次のリクエストで即座に効く。cookieの中身だけを信用しない。
5. 認可できない場合は常に閉じる側へ倒す。存在しないslug・権限のないPJは、リダイレクトではなく見つからない扱いにして、機関やPJの存在自体を漏らさない。
6. `/auth/logout` は署名cookieと旧PJセッションcookieの両方を消し、Supabase側も `scope:'local'` でログアウトする。

### 6.5 外部へ出すデータ

外部の面は、内部の取得経路を再利用せず専用の許可列DTOで組む。

- **PJの外部面**: 現在はPJ名と共有資料室への入口だけ。資料室は`workspace_shared`だけを表示し、`contributor` / `manager`は資料を追加できる。計画サイクル、マイルストーン、メンバー名、工数、根拠、出典、社内管理項目（目的・成果・論点・仮説・意思決定・資金・関係先）、連絡先は含めない。外部の進捗共有を増やす場合も、内部の詳細バンドルを呼ばず専用DTOを追加する。
- **機関ワークスペースDTO**: 要約・説明・URL・出典・連絡先・根拠の形をした列を含めない。ECRは軸の点数だけ、SPSは軸と算出結果だけを返し、評価者や軸ごとの根拠は返さない。
- **公開トップDTO**: slugと名称、機関の名称・種別・地域だけ。
- 外部の面はサーバー側で service_role として読む。migration 213で既存テーブルのanon読み取りを閉じても、外部画面の表示は壊れない。

### 6.6 一覧の並びとECRの見せ方

- 機関ワークスペースのシーズ一覧は、§5の共通ライフサイクルと同じ優先度で並べる。PJ化済み → PJ化検討中 → PJなし・SPS算出済み → その他とし、同じ区分の中は表題の日本語順にする。
- **ECRは1機関の縦並び**で総合値と8軸を上から読む。機関横断の比較表（1機関=1行×軸を列）とは別の見せ方であり、外部の面では自機関だけを表示する。
- **ECRとSPSは別系列のまま**。同じ画面に並べても合成スコア、相関、因果指標を作らない。DTO上も別プロパティに分ける。

### 6.7 資料室

研究機関とPJの資料共有はAMD OS内の共通資料室へ置く。画面は機関 `/workspace/[slug]/files` とPJ `/project/[projectId]/workspace/files` に分けるが、メタデータ正本は `workspace_documents`、file実体はprivate Storage `workspace-files` で共通化する。

- 1資料は `scope_kind='institution'` または `scope_kind='project'` のどちらか一方だけを所有先にする。機関、シーズ、PJの区別をfolder名で代用しない。
- 機関資料は明示された `institution_workspace_memberships`、PJ資料は明示された `project_access_memberships` を毎request再検証する。**機関所属はPJ資料へのアクセスを含意しない**。
- `visibility='workspace_shared'` は対象scopeの外部メンバーにも共有、`amd_internal` はAMD内部だけ。外部の一覧・open APIは内部資料をnot foundとして扱う。
- role名は権限そのものにせず、`workspace-capabilities.ts` が `document.view_shared` / `document.view_internal` / `document.upload` / `document.manage` などのcapability束へ変換する。未実装のPJ共同編集、所属管理、相手方主権データ確定をmanager / ownerという名前だけから推定して付与しない。
- `document.upload`（PJのmanager / contributor、機関のowner / member、AMDの対象PJメンバー/admin）はfile・folder・linkの追加に加え、既存HTMLの本文編集と、file・link・folderを資料室から削除できる。HTML本文の取得・保存は専用source APIが毎requestで同じscope・visibility・capabilityを再確認し、署名URLを返さない。本文はHTMLソースとしてtextareaへ渡すだけで実行・整形・sanitizeせず、空欄不可・UTF-8で5MBまでをserver側でも検証する。保存成功後に同じprivate Storage objectを上書きし、`file_size_bytes` / `mime_type='text/html'` / `content_sha256` / `updated_at`を更新する。本文そのものはaudit detailへ記録しない。
- 名称変更・移動・共有範囲変更などの整理は従来どおり`canManage`（PJ manager、機関owner、AMDの対象PJメンバー/admin）だけに限る。資料室からの削除はarchiveであり、Storage実体を物理削除しない。通常一覧・共有画面から外して保護領域に残すが、復元画面はまだ提供しない。
- fileを追加またはドロップしたとき、同じ資料室・同じfolderにactiveな大小文字非区別の同名entryがあれば、書込み前にFinder型の確認（中止／両方残す／置き換える）を出す。両方残すは既存entryと同時追加queueの両方を避けて`資料 2.pdf`のような名前を作る。置き換えは`canUpload`だけで行えるが、同じfolder・同名・activeな**file**へ明示した場合に限る。link/folderや同時追加中の資料はファイルで置き換えず、両方残すか中止を案内する。通常追加と置き換え準備はserverが毎回名前・scope・accessを再確認し、競合raceでの無言上書きをしない。置き換え完了は元行をpending/failedへ戻さずMIME・サイズ・更新時刻だけを実体に合わせ、移行由来のhash/source referenceを消して本文なしのauditを残す。
- fileのStorage path、外部link URL、署名tokenを一覧DTOへ含めない。open APIが権限を再確認し、通常fileだけ60秒の署名URLを発行する。`mime_type='text/html'` と `.html` / `.htm` の保存fileは、資料名からは再認可済みのsandbox HTMLプレビューを別タブに表示する（5MBまで、script・外部通信・form送信を止める）。右端の明示的なPDF化ダウンロードだけが専用PDF APIで再認可後にPDFへ変換し、元資料ごとの決定的なprivate Storage pathへ上書き保存する。通常文書はA4幅のまま、A4幅で横組みのgrid/flexが縦積みに崩れるHTMLだけは実測したデスクトップ幅を保つ。見出し、比較カード、表などページ内に収まる論理ブロックは途中で割らず、section全体を固定で改ページして空白を作らない。PDF APIはPDF本体をFunction応答に載せず、60秒だけ有効な署名ダウンロードURLで配布する。既定応答は署名URLへの転送なので、旧画面コードでも本物のPDFを受け取れる。現行画面だけが`delivery=json`を明示してURLを受け取り、資料室内のエラー表示を維持する。PDF化ではHTML内のscriptと外部通信を止め、日本語フォントを埋め込む。入力は8MB、返却PDFは16MBまでとする。
- AMD内部のPJコックピットは資料名・件数・最新資料を本文へ展開せず、`WorkspaceDocumentLauncher` の1ボタンだけを置く。押下時はURLを変更せず `WorkspaceDocumentRoom(presentation='modal')` を大きなモーダルで開き、閉じた時にコックピットの作業位置と文脈を保つ。独立routeは直接URL・外部共有面・復旧用に残す。
- 資料室の視覚トークンは白、graphite、deep navy、AMD blue、cyanを基調にし、旧Project Share由来のivory / green / amberの全面配色を使わない。赤はarchiveなど破壊性を伴う意味だけに限定する。
- migration 216〜219は2026-08-02に本番適用済み。VSX/CX/SE/SX/ZMP/KUTEの旧Project Shareはproject scopeへ非破壊コピーし、既存 `project_documents` は `AMD内部/Drive資料` の内部限定linkとして併記した。内容ハッシュを保存し、file全件を移行先から再取得して一致検証する。
- 旧Project Shareと旧Drive行は削除・上書きしない。外部メールアカウントとPJ個別grantを登録し、対象者の到達を確認するまで旧入口を閉じない。切替失敗時は新規導線を止めて旧入口を継続できる。
- cookie認証付きの資料変更はsame-origin guardを必須とする。`Origin`があればrequest URLのoriginと完全一致させ、無い場合は`Sec-Fetch-Site='same-origin'`、さらに無ければ同一originの`Referer`を要求する。三つとも無いrequestは閉じる。
- account、機関grant、PJ grant、資料metadataはDB triggerでrow変更と監査insertを同じtransactionにする。監査にはtable、操作、row idだけを置き、email、本文、URL、Storage pathは置かない。workspaceまたはPJの削除で資料metadataをcascade削除せず、Storage orphanを作り得る削除をRESTRICTする。

## 7. 検証

- migration 207は機関46件・大学/国研シーズ141件・確定4PJ、migration 209は対象seed PJ 19件・二重分類0件・SX未設立/SPS ready・description全NULLをassertする。
- `npm run test:institution-seed-project-domains` でテーブル分離、19PJ移行、固定対応の不在、フラット全件表示、ECR/SPS非合算を検査する。
- `npm run test:kute-seeds-scope` と `npm run test:institution-soil-seeds` で表示スコープと評価系列を検査する。
- §6の外部アクセスは契約テストで検査する。`test:workspace-access-scope`（所属・失効・機関からPJへの暗黙付与なし）、`test:workspace-access-session`（署名cookieの検証）、`test:workspace-email-start-contract`（登録有無を漏らさない応答とOTP claim）、`test:workspace-next-path`（遷移先の絞り込み）、`test:external-project-workspace`（外部DTOが内部バンドルへ広がらないこと）、`test:workspace-access-admin`（admin API の権限、自動復活禁止、完全pagination）、`test:workspace-rls-closure`（migration 213の閉鎖範囲）、`test:workspace-documents-core`（path/URL/storage key・HTML本文byte・Finder連番）、`test:workspace-documents-contract`（資料単位の再認可、明示置き換えだけのStorage上書き、同名raceの非上書き、HTML本文の署名URL非返却、capabilityでのHTML編集・archive、非破壊archive）、`test:workspace-fact-origin-contract`（未登録と0、取得失敗と0件、same-origin）、`test:workspace-security-migration-contract`（atomic rate limit、transactional audit、資料owner RESTRICT）、`test:workspace-capabilities`（role bundle）で検査する。
- PWAは型検査・本番build・desktop/mobile実画面、macOSはXcode buildで確認する。

## 8. ロールバック

本変更は既存 `projects`、ECRを削除しない。migration 209は17シーズ追加、2機関追加、状態補正、SXのSPS行追加を含む。問題が出た場合は次の順で戻す。

1. 画面を直前版へ戻し、旧列を読むコードへ戻す。新しい2子テーブルは残してよい。
2. `institution_projects` / `seed_projects` をCSVまたはSQLで退避する。
3. 新しい書込みを停止し、参照元がないことを確認してから子テーブルと専用triggerを撤去する。
4. `seeds.institution_id` の141紐付けは機関カタログの資産なので原則維持する。戻す必要がある場合だけ、migration 207で追加された機関IDと参照件数を監査して個別に戻す。
5. ECRはmigration 207/209とも更新していない。SXのSPS 1行を戻す場合も、他シーズやECRを再計算せず、対象 `(seed_id, evaluated_at)` だけを退避確認後に別migrationで扱う。

本番DBの `DROP` や一括NULL化は自動ロールバックに含めず、退避内容と参照元を確認した上で別migrationとして実行する。
