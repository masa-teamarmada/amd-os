# PWA ランタイム / ルート仕様

## 外部メールログインの配信前提（2026-10-08確認）

`/api/auth/email-start`は利用可能なaccount/付与の検査と送信claimの後にPKCEの`signInWithOtp`を呼ぶ。権限付与や申請の承認自体ではメールを送らない。HTTP 200は登録有無を漏らさない共通応答なので、配信成功を意味しない。運用の完了は権限、`email_start_sent`、本人の受信、`callback_login_success`、対象面の実閲覧を別々に確認する。

本番配信にはSupabase Authのcustom SMTP、または明示採用済みSend Email hookが必要。標準配信は試用向けで、組織メンバー外と送信数に制限がある（[公式仕様](https://supabase.com/docs/guides/auth/auth-smtp)）。2026-10-08に会社GoogleメールのSMTP（smtp.gmail.com:465、送信元masa@team-armada.jp、表示名チームアルマダ OS）を接続し、SMTP認証と本番設定の読戻しを確認。送信上限は30通/時、Send Email hookは未使用。まさ本人の操作でasahinaへの送信と受信を確認した。メール到着を認証完了と同一視しない。秘密値はrepoや監査detailへ保存しない。既存のreadonly/DD境界、共通応答、PKCEは維持する。

2026-10-07: AMD OSの`/auth/login`は全員共通のメール入力と「続ける」１つに統一。`resolveLoginEntry`がtrim/lowercaseと形式検証の後、メールのdomainが厳密に`team-armada.jp`なら既存portfolio Google OAuth（Calendar/Gmail readonly、offline、consent、入力メールをlogin_hint）へ、それ以外なら既存`/api/auth/email-start`へ進める。subdomainや似たdomainは社内扱いにしない。domainは認証方式の選択だけで、付与・利用可否は既存callback/DB/RLSが検査する。旧`audience`/`workspace`queryによるUIの並べ替えとPJログインボタンは廃止し、`next`は両方式で引き継ぐ。旧project callbackの認可は維持。書斎hostは既存管理者用Google入口を維持する。未登録・未許可・送信抑制の200応答は同じ案内を表示。通信失敗は入力を保った再試行案内にする。入力・主操作48px、入力文字16px、横溢れなし。メール実送信・権限変更を伴わない画面検証を行う。

2026-10-08: callbackのコード未付与・交換失敗・user取得失敗時は、`login_scope=workspace`なら`workspace_auth_failed`、他は`auth_failed`で共通入力へ戻す。`sanitizeNextPath`を通した`next`を失敗時も保存し、codeは戻さない。一般失敗にGoogle Workspaceを要求せず、外部認証失敗はメール入力と同じブラウザで最新リンクを開く案内にする。account不在・権限不足・activation失敗は管理者確認の案内を維持し、再入力だけで直ると扱わない。書斎の管理者専用入口はメール入力を要求しない。SMTP接続状態は上記の配信前提に従う。

2026-10-06: ホームとコックピットの全体メニューは左上のメニューアイコン「≡」で開く左ドロワー。常設の全体サイドバーは出さず、既存のホーム・研究機関・シーズ・管理・資料などの入口を保持する。閉じるボタン、背景クリック、Escape、リンク選択で閉じ、キーボードフォーカスを開くボタンへ戻す。ホームのPJカード（研究機関・シーズ・事業会社・PJ運用一覧）と全体メニューのPJリンクは別タブを既定とし、PJ未登録の候補詳細と一覧・ページ内アンカーは同じタブで開く。

2026-10-04: `GET /api/project/[projectId]/workspace-meetings` は `resolveSharedWorkspaceAccess(projectId)` の毎回判定後に当該PJの会議／動向だけを返す（private/no-store）。`GET /api/slack/messages?projectId=...` も当該PJの共有所属の読み取りを許す。DD付与だけの人は両APIへ入れない。

> **この章は何か**: AMD OS PWA の実行環境、主要 route、API / cron / auth の確定仕様。詳細な履歴や長い route 説明は `pwa/design/SPEC_pwa.md` にも残す。移行中は両方を更新する。

## ログインメールの件名と本文（2026-10-08）

共通Authのmagic_link/confirmationは日本語の件名と同じ本文を使用。件名は`AMD OS ログインリンク（{{ .Token }}）`で配信ごとに変わる。Gmailで同じ件名の会話にまとまり重複本文が省略されることを避ける。番号の入力は不要。本文正本は`ios/supabase/templates/workspace-login.html`、件名とcontent_pathは`ios/supabase/config.toml`。画像・非表示本文・引用を使わず、上部に56pxの「ログインする」を表示。ConfirmationURLを変更せず、attempt/nextを含む既存PKCEと認可を維持する。

本番は`python3.12 scripts/amie_auth_email_templates.py --apply`でsubject/contentの4項目のみPATCHし、読戻し一致と他Auth設定の不変を確認する。既に一致すれば再PATCHしない。秘密値・配信URL・OTP展開後の件名を出力しない。配信は本人の操作。設定一致/見本表示と実Gmailの省略有無は別々に検証する。2026-10-08 18:57 JSTの本番4項目一致、他Auth不変を確認済み。

## 外部メールの認証と共通ポータル（2026-10-08）

外部メール開始はrate-limit claim後にUUID v4のattemptを発行し、callbackへ引き継ぐ。PKCE cookieはattemptごとの`sb-workspace-<UUID>-auth-token`、HttpOnly/SameSite=Lax/Path=/、有効期間1時間、本番Secure。社内Googleログインや別のメール要求が既に配信したリンクのverifierを上書きしない。callbackは厳密に検証したattemptのcookieだけで交換する。attempt不正はfail closed、以前の配信済みリンク（attemptなし）は旧cookieを使う。コード交換失敗は既存監査のcallback_login_deniedへ理由とisolatedAttemptの真偽だけを記録し、リンク・code・verifier・未登録メールは残さない。アカウント有効化、停止/取消/期限の判定、local signOutと署名付き外部cookie、DDとworkspaceの独立認可は維持する。

外部ログインでnext=/なら許可済み一覧/workspaces、DDのみなら/ddへ進む。共有資料の検証済みnextは保持する。研究機関全体の/workspace/<slug>がnextに残っていても、DB確認済みの機関所属が無ければ本人の許可済み一覧へ進む。PJ単位の許可を機関全体の許可へ広げない。公開トップは自動転送しない。匿名入口は「ログイン」だけで、社内専用カードはDB確認済みメンバーだけに表示する。外部ログイン済みは許可済み一覧へのリンクを表示し、所属済み研究機関の行は直接そのworkspaceへ進む。表示の有無によって認可を成立させない。

## 実行環境

| 項目 | 値 |
|---|---|
| 種別 | Next.js App Router PWA |
| 技術 | Next.js 16 + React 19 + Tailwind CSS v4 |
| 正本パス | `/Users/masa/projects/AMD/amd-os/pwa` |
| 本番 | `https://amd-os-pwa.vercel.app` |
| Vercel project | `amd-os-pwa` / scope `armada0130` |
| Backend | Supabase `nbnhrhybjslbawdukvvk` + AMD OS GAS bridge |
| インストール版の表示 | `public/manifest.json` の `display_override: ["tabbed", "standalone"]`。Chrome のタブ付きアプリ窓で開く。Mac / Windows / Linux の Chrome では実験機能 `DesktopPWAsTabStrip`（ChromeOS 以外は標準 off）のため、`chrome://flags/#enable-desktop-pwas-tab-strip` を有効にした端末だけタブ列が出る。無効な端末は `standalone` の1画面窓になる。画面側のコードは表示形式（`display-mode`）で分岐しない |
| 書斎のアドレス（2026-10-04、v3.154.0） | `https://bookshelf-armada.vercel.app`。書斎（`/bzm/read`）を AMD OS とは別のアドレスの別アプリとして開く。サーバのプログラム（同じ Vercel project `amd-os-pwa`、同じ deploy）、ログインの仕組み、Supabase（同じプロジェクト）は AMD OS と共通で、費用は増えない。クッキーは AMD OS とは別なので、書斎アプリでは初回に1回ログインする（Google） |
| 書斎のアドレスの設定（コードの外） | Vercel project `amd-os-pwa` の Domains に `bookshelf-armada.vercel.app`（本番に割り当て）。Supabase の Authentication の URL Configuration の Redirect URLs に `https://bookshelf-armada.vercel.app/**`（ログイン後に書斎のアドレスの `/auth/callback` へ戻るため）。アドレスを変えるときは、`src/lib/bzm-reader/hosts.ts` の `SHOSAI_HOST`、Vercel の Domains、Supabase の Redirect URLs を同時に変える |
| アドレスの振り分け | `src/middleware.ts` が、ログインの判定（`updateSession`）より前に `readerHostRedirect`（`src/lib/bzm-reader/hosts.ts`）を呼び、307（一時的）で送る。書斎のアドレスでは、`/` を `/bzm/read`（棚）へ送り、`/bzm/read` 配下、`/api/bzm-reader/` 配下、`/auth` 配下、`/api/build-info` はそのまま出し、それ以外のパスは AMD OS のアドレス（`https://amd-os-pwa.vercel.app`）の同じパスと query へ送る（例: 章間リンクの別の本の章 `/bzm/<slug>`、管理者でない人が戻される `/dashboard`）。AMD OS のアドレスで `/bzm/read` 配下を開いたときは、書斎のアドレスの同じパスと query へ送る。上の2つ以外のアドレス（プレビューの deploy、手元の開発）は振り分けない |
| 書斎の専用アプリ（manifest） | `public/manifest-shosai.json`。`name`・`short_name` は「書斎」、`id`・`start_url` は `/bzm/read`、`scope` は `/`（書斎のアドレスは書斎の画面だけを出すので、ログイン画面もアプリの範囲に入る）、`display` は `standalone`、`background_color`・`theme_color` は `#ffffff`、アイコンは書斎専用の `/icons/shosai-*`（まさ提供の本の絵。192・512 の通常と maskable、apple-touch-icon 180、favicon 48。書斎の layout とログイン画面の layout も同じ絵を出す）。向きは固定しない。書斎の配下の `src/app/(app)/bzm/read/layout.tsx` だけが、ルートの `manifest: "/manifest.json"` を `/manifest-shosai.json` に差し替え、`appleWebApp`（title「書斎」）と `themeColor #ffffff` を出す |
| manifest の認証除外 | `src/middleware.ts` の matcher は `manifest.json` と `manifest-shosai.json`（`manifest-shosai\\.json`）を認証の対象から外す。外さないと manifest の取得がログイン画面への 307 になり、インストールが壊れる。静的ファイル、画像、`/auth/callback`、`/api/build-info` も matcher の外で、アドレスの振り分けも通らない |

## 複数タブの現在地（2026-10-06）

- インストール版のタブ列自体はChromeが描画する。画面CSSでタブ枠を上書きせず、文書タイトルとテーマ色を提供する。黒・淡いグレーでは選択中との差が弱いため、`manifest.json`とルートviewportの`theme_color`を白い選択タブとの差が分かる青灰色`#a8bdd3`へ統一し、起動背景を白にする。
- 開いているタブの文書タイトル先頭だけに`▶ `を付ける。`document.visibilityState === "visible"`が判定根拠。`visibilitychange`でタブを切り替えたら印を移す。窓がフォーカスを失うだけでは印を消さない。複数窓では各窓の選択タブが対象となる。通常Chromeタブも同じ契約で、`display-mode`で分岐しない。
- PJ本文は認可済みのデータを使い、`PJ名｜コックピット / ワークスペース / DD｜実際に表示中のページ名 - AMD OS`を`ProjectPageTitle`へ渡す。ページラベルは既存の`PROJECT_PAGE_LABELS` / メニュー定義 / `ddPageLabel`を使う。コックピットのquery、ワークスペースのhashや保存済み選択、DDのqueryから解決済みの表示状態へ追従し、URLから名前を推測する追加取得は行わない。
- `PageTitleSetter`はAppShellの通常画面で既存surface名を使う。コックピットとワークスペースの詳細では、外枠の一般名が本文の題名を上書きしないよう本文側だけが担当する。埋め込みワークスペースは親コックピットの題名を維持する。
- DDの未認可HTMLは引き続き`DD資料`だけ。認可済み`DdViewerShell`のクライアントがPJ名と資料名を表示する。DD一覧・権限・共有データ・公開範囲は変更しない。
- Next.jsの遅延metadata差し替えに対してheadのMutationObserverで題名を維持する。値が同じなら書き換えず、observer/listenerを離脱時に解除。`pageshow`でも復帰する。印刷routeは対象外で、通常画面もbeforeprint中は補正を止める。書斎とネイティブ埋め込みは既存AppShell除外を維持する。
- ネイティブタブ枠の最終色はChromeとインストール済み設定に依存するため、色に加えて文字の印と具体的な題名で現在地を示す。タブの再読込で題名と文書テーマは更新され、manifest保存値はChromeの更新に従う。
- Chrome公式の[タブ付きPWA仕様](https://developer.chrome.com/docs/capabilities/tabbed-application-mode)を確認。独自の擬似タブ管理は追加しない。

## ページの移動と履歴（2026-10-04）

- ホームのPJポートフォリオは、研究機関PJ・シーズPJ・事業会社PJとも、紐づくPJカードを `/project/[projectId]/cockpit` へつなぐ。研究機関/シーズの全件リンクは各一覧へ、PJ未登録の候補は元の機関/シーズ詳細へ進む。シーズに複数PJがある場合は、行のPJ番号と同じprimary（active優先、次にsales/draft）を開く。
- `PageHistoryToolbar` を社内の `AppShell`、認可済み共有ワークスペース、DD閲覧の共通枠に置く。Chrome型の左矢印「戻る」・右矢印「進む」はブラウザ自身の履歴を使い、検索条件・タブ・元ページへの戻りを保つ。独自の履歴保存・書換え、データ再登録はしない。
- ChromeなどNavigation APIのある環境は `canGoBack` / `canGoForward` と `currententrychange` を使い、行き先がない矢印を無効にする。API非対応ブラウザは `history.length` で戻るだけ判定し、進む先の有無を取得できないため進むは有効のままブラウザへ委譲する。`popstate` / `pageshow` も監視する。
- 操作の高さは狭い画面44px、広い画面36px。本文と同じ通常フローで配置し、既存の固定タブ/見出しと重ならない。印刷、ネイティブ埋込み、書斎の専用画面には追加しない。認証・閲覧範囲の判定は既存経路のまま。

## ディレクトリ契約

| path | 役割 |
|---|---|
| `pwa/src/app/(app)/` | 認証必須 route。middleware / server layout で auth/admin を gate する |
| `pwa/src/app/api/` | API route / cron / admin mutation |
| `pwa/src/components/` | 画面別 UI component |
| `pwa/src/lib/supabase/` | Supabase client / server / auth helper |
| `pwa/src/lib/*-data.ts` | 主な data access / domain logic |
| `pwa/scripts/migrations/` | PWA 起源の Supabase migration。DDL変更時に残す |
| `pwa/design/db_schema.md` | Supabase schema dump。列名を書く前の確認正本 |

## Auth / 権限

- 通常アプリ route は login 必須。
- `/spec` は admin (`members.is_admin=true`) 限定。
- `/manual` と `/bzm` は認証済みメンバーが読む前提。
- `/bzm/read` 配下（書斎）と `/api/bzm-reader/**` は admin (`members.is_admin=true`) 限定。管理者の判定は `requireReaderAdmin()`（`src/lib/bzm-reader/require-reader-admin.ts`）で、layout・3つの page・章ページの `generateMetadata` のすべてから呼び、管理者でなければ `/dashboard` へ戻す。図の API も管理者だけに配る。`/bzm/public` の公開例外には入れない（2026-10-03）。書斎は専用アプリとしてインストールして開いても、同じ判定が働く（2026-10-04）。書斎のアドレスで管理者でない人が戻される `/dashboard` は、書斎のアドレスに無いパスなので、middleware が AMD OS のアドレスの `/dashboard` へ送る。書斎のアドレスはクッキーが AMD OS とは別で、未ログインで開くと書斎のアドレスの `/auth/login?next=/bzm/read…` へ送り、ログイン後は書斎の画面へ戻る。
- `/api/*` の mutation は route ごとに `requireAuth` / admin check / `CRON_SECRET` を使い分ける。
- Google OAuth は Calendar / Gmail の readonly access を前提にし、server-side ingestion 用 token は `member_google_oauth_tokens` に保存する。
- 認証主体は3種類。(1) 内部メンバー = Google OAuth の Supabase authenticated session、(2) PJ限定メンバー = 旧 `amd_os_project_session` 署名cookie、(3) **外部の研究機関ユーザー (`workspace_user_accounts`) = `amd_os_workspace_session` 署名cookie**。
- 外部ユーザーはメールリンク (email OTP) でログインし、コールバックでSupabaseセッションが成立した直後に `signOut({ scope: "local" })` して30日固定のHTTP-only署名cookieへ交換する。以後Supabaseのauthenticatedセッションを持たない。cookieは毎リクエスト検証したうえで**必ずDBを引き直す**。アカウント停止、所属失効、ワークスペースのpauseは次のリクエストで効く。cookieの中身だけを信用しない。
- `amd_os_workspace_session` が通常セッションの代わりになるのは `/workspaces`、`/workspace/**`、`/project/[projectId]/workspace`、DD の面（`/dd`、`/dd/[slug]`、`/dd/[slug]/items/[itemId]`、`/dd/[slug]/items/[itemId]/file`）だけ。内部メンバー route では middleware がこのcookieを認証として扱わない。各面の中の認可は面ごとに DB を引き直す（ワークスペースは `project_access_memberships` / 機関所属、DD は `dd_package_grants`。互いの根拠にならない。`pwa/spec/5-17-dd-package-current-spec.md`）。
- 外部向けメールログインは PKCE（SSR のサーバクライアント）で送る。リンクはログイン画面を開いたのと同じブラウザで開く（2026-09-30 から。それまでの implicit ではトークンが URL フラグメントに付き、callback が完了しなかった）。
- 認可の根拠は明示的な付与だけ。メールのドメイン一致は根拠にしない。**機関ワークスペースの所属はPJアクセスを意味せず**、`/project/[projectId]/workspace` は `project_access_memberships` の `status='active'` 行が対象PJを名指しした場合だけ開く。
- 認可できない場合は閉じる側へ倒す。存在しないslug・権限のないPJはリダイレクトせず not found にして、機関やPJの存在自体を漏らさない。
- `/auth/callback` のログイン打ち切りは、必ず `supabase.auth.signOut({ scope: "local" })` で行う。`@supabase/auth-js` の `signOut()` は scope 省略時 `global` で、member 未登録・ドメイン不許可・PJ membership なし・Calendar 検証失敗のいずれか1回で、そのユーザーの**全デバイスのセッション**が失効する。callback の signOut はすべて「いま確立しかけた、このブラウザのセッションだけを捨てる」意図なので、scope は省略しない (2026-07-27)。

## 主要 route 群

| route | 役割 |
|---|---|
| `/` | 公開トップ (認証不要)。認証状態にかかわらずredirectせず、全員にポータルを表示する。`institution_workspaces` の `status='active'` かつ `is_publicly_listed=true` の行だけを、slug / ワークスペース名 / 機関の名称・種別・地域で一覧し、説明文、シーズ・PJ件数、ECR、AMD Score は公開しない。ログイン済み内部メンバーは明示ボタンから自分のARMADAホームへ、外部アカウントは明示リンクから `/workspaces` へ進む |
| `/workspaces` | 外部アカウント (`workspace_user_accounts`) の入口。所属する機関ワークスペースと、`project_access_memberships` で個別に許可されたPJだけを並べる。機関所属をPJ一覧の根拠にしない。PJ台帳の取得失敗は参加0件へ変換せず、参加状況を変更していないことと再読込案内を出す |
| `/workspace/[slug]` | 研究機関ワークスペース本体。内部アプリの chrome を共有しない独立シェル。対象機関のPJ、シーズ一覧、ECR を読み取り専用で表示する。シーズはPJ化済み → PJ化検討中 → PJなし・SPS算出済み → その他の順で、同区分内は表題の日本語順。ECR は1機関の縦並び (総合値 + 8軸) で、SPS とは別系列のまま合算しない。資料欄は BOX からの移行準備中の表示のみ (リンク / iframe / 署名トークンなし) |
| `/workspace/[slug]/project/[projectId]` | 研究機関の個別PJ面。機関所属と当該PJの個別membershipを両方確認し、kernelのactive principal・organization membership・party・`publication.view`をDB RPCで再確認する。最新publicationがviewer audienceを含む時だけ承認済み項目を表示し、未公開・読取失敗・audience除外時にAMD内部値や旧版へfallbackしない。先頭は研究機関が返すもの、相手待ち、次期限、現在地、4本柱を表示する |
| `/auth/login` | ログイン。共通のメール入力と「続ける」で、厳密な社内domainはGoogle OAuth、それ以外はメールリンクへ進む。旧`audience`/`workspace`queryで方式を選ばせない。失敗時は方式に応じた再試行案内と検証済み`next`を保持する。書斎のアドレス（`bookshelf-armada.vercel.app`）で開いたときは「書斎」の見出しと内部ログインだけを出し、題と manifest も書斎のもの（`auth/login/layout.tsx`、2026-10-04） |
| `/auth/logout` | 統一ログアウト。`amd_os_workspace_session` と旧 `amd_os_project_session` の両cookieを消し、Supabase も `scope:'local'` でログアウトして `/auth/login` へ戻す |
| `/dd` | DD の入口。外部アカウントは閲覧できるパッケージが1つならそのトップへ、複数なら一覧。AMD admin には全パッケージのプレビューと管理画面への入口。admin 以外の内部メンバーは not found |
| `/dd/[slug]` / `/dd/[slug]/items/[itemId]` | DDトップと項目1件（投資家・金融機関向け）。`dd_package_grants` の有効な付与（公開中のパッケージ・期限内・`dd.view`）か AMD admin のプレビューだけで開き、公開中（`is_published`）の有効な項目だけを出す（admin は非公開の項目も開ける）。中身は閲覧のたびに元データの最新を、ワークスペースと同じ部品で描く。非公開・外した・別パッケージ・権限なしはすべて not found |
| `/dd/[slug]/items/[itemId]/file` | DD の資料（資料室の最新の実体）。HTML はサンドボックスの CSP（`next.config.ts` が全体の CSP を上書き）、それ以外は60秒の署名URL（Google ドライブの資料は版ごとの写しから）。`?download=1` は `dd.download` だけ |
| `/dd/[slug]/print` | 正式版（PDF）の印刷画面（AMD admin 限定）。公開中の項目をいまの内容で1つの文書に並べ、「PDFに保存（印刷）」で出力の記録を残してから印刷画面を開く |
| `/project/[projectId]/dd` / `/project/[projectId]/dd/preview/[itemId]` | 独立したDD入口・管理（AMD admin・portfolio 限定、管理は `?tab=manage`）。登録済みの入口は `/dd/[slug]` へ、旧プレビューは `/dd/[slug]/items/[itemId]` へ送る |
| `/admin/access` | 外部アクセス権限の台帳 (内部admin限定)。外部アカウント、機関ワークスペース所属、PJ個別アクセスをここだけで付与・停止する。読み書きはすべて `/api/admin/workspace-access` 経由 |
| `/dashboard` | ARMADA内部メンバーの入口 = 研究ポートフォリオ中心IA (2026-08-02 まさ確定、旧 `/portfolio-preview` を統合)。上部の先手TODOバッジ直下に `PortfolioPulse` (研究機関・シーズ・PJ運用の統計strip + 3パネル優先キュー、パネル順は研究機関→シーズ→PJ運用) を置き、研究機関・シーズの全件は出さず上位候補だけを表示する (全件正本は `/institutions` `/seeds`)。データは `/api/dashboard/portfolio-pulse` (server-side `createAdminClient()` + `requireMember()` + `getCurrentMemberAccess().scope='portfolio'`、ECR/シーズを `Promise.allSettled` で障害分離) からだけ取り、project scope の外部PJメンバーへ横断母集団を返さない。default browser clientでの `fetchErsBundle`/`fetchAllResearchInstitutionSeeds` 直叩きは禁止 (migration 213 RLS下でシーズ0件になる既知障害の再発防止)。その下 `#pj-operations` アンカー配下に、AMD全体 (`p00`) だけを除くPJ台帳の全行を Active / Sales-Draft / Ended-Frozen で表示する (GlobalNav 「PJ運用」navと `PortfolioPulse` の「PJ運用を開く」はどちらもこのアンカーへ実接続)。`institution_projects` の p25 / p28 / p30 も除外せず、すべての行は内部用 `/project/[projectId]/cockpit` を開く。外部アカウントはこのrouteを使わず `/workspaces` から個別許可された面へ入る。PJ一覧の後に要対応 action queue、続けて折り畳み「経営指標・接続状況」(Management Score、全社実績、抽出・freee状態、既定open) を置き、下段全幅に Company Content shelf を置く。左メニューのボード (GlobalNav 最上位グループ「研究ポートフォリオ」のホーム) にマウスオーバーまたはフォーカスすると、全アクティブPJへのコックピットリンクを右側に出す。フライアウトはナビのスクロール領域でクリップされない上位レイヤーに出し、画面下端では一覧部分だけをスクロールする。右カラムの `MyPageContent` embed は desktop (xl+) で360–400pxの `sticky` + 独立 `overflow-y-auto`、mobile/tabletでは埋め込みを隠す代わりに「マイページを開く」実リンクカードを出す。埋込時の loading/error は `min-h-screen` を使わない。`MyPageContent` / `CompanyContentShelf` は `next/dynamic({ ssr:false })` で分離バンドル化し、Company Content (メンバー/沿革/写真/メディア掲載) の fetch は初回 `Promise.allSettled` に含めず、`IntersectionObserver` (`rootMargin: "600px 0px"`) で shelf アンカーが viewport 600px 圏内に入ってから `fetchCompanyContentPreview` を1回だけ起動する遅延ロードにする (v3.44.8)。取得完了までプレースホルダ表示、失敗時は空データへ fallback しダッシュボード主表示をブロックしない。配色は `amd-home-page-skin` (白/graphite/濃紺/AMD blue/cyan、borders-only、4pxベース) で、旧 `amd-desk-page-skin` の淡いベージュは使わない |
| `/portfolio-preview` | 旧仮設IA。2026-08-02 `/dashboard` へ統合済みのため `redirect("/dashboard")` だけを持つ。旧URLを踏んでも `/dashboard` の認証・role-based topがそのまま効く |
| `/project/[projectId]/cockpit` | PJ cockpit。Status / 現行SPS / XRL / MS / 資料 / 経営ハイライト / ガバナンス / 助成金 / 月次 / MTGサマリ。現行SPSは`sps-ind-v1`完全一致だけを表示し、無ければ最新版未評価。旧版へfallbackしない。BZM 2.2は同じBZMから出る別の出力として、SPSへ合算せず分けて表示する |
| `/project/[projectId]/workspace` | PJ実行の正規入口。コックピット（AMDメンバー限定）とは別に、当該PJのメンバー（AMD外を含む）へ同じURLで共有する。共通の分類名は`進捗管理 / 事業計画 / ドライブ / 会社情報`。`PJ管理`はAMD内部で定義する`PJ概要`だけのコックピット分類で、ワークスペースには置かない。外部accountは読み取り専用で、ゴールツリー / タスク / ガント / 関係先 / ドライブ、会社基本情報・資本政策、事業計画の技術 / 競合比較 / ビジネスモデル / 事業計画 / コスト試算 / コスト試算（燃料） / 知財 / 資本政策を読む。技術・競合比較・ビジネスモデル・事業計画・コスト試算・知財・資本政策は未登録でも空状態の入口を出し、コスト試算（燃料）だけは燃料試算があるPJに出す。`PJ概要`、経営会議を含む`動向・会議`、Slack、スコア詳細、週次介入、担当負荷はコックピットだけに残す。キラー要素はコックピット専用の独立ページ `?tab=killer-factors`。会社概要本文は3領域で共通にし、内部情報の部分表示分岐を持たない。ドライブは`WorkspaceDocumentRoom`を`scopeKind='project'`・同一`projectId`で再利用し、`surface='workspace'`として`workspace_shared`だけを一覧化する。外部の`contributor` / `manager`は資料追加、`readonly`は閲覧だけを行える。コックピット資料室だけが同じ`workspace_documents`・private Storage・認可/APIの内部資料と開示範囲管理を扱う。 |
| `/project/[projectId]/weekly-control` | 旧ブックマーク互換。`/project/[projectId]/workspace`へredirectし、独立した画面・writer・状態を持たない |
| `/project/[projectId]/navigation` | 正規workspaceと分離したPJ計画レンズ。重要経路を初期展開し、4本柱からマイルストーン・技術試験・論点・履歴へ掘る階層WBSガントと、共通7段階の関係先比較を表示する。工程、論点閉ループ、技術試験、関係先・保有事項を同じ画面で追加・更新できる。RSC境界へは`buildSxNavigationViewModel()`が作る最小view modelだけを渡し、`ProjectWorkspaceBundle`/`CurrentMemberAccess`全体はClient Componentへ渡さない |
| `/manual` | AMD OS マニュアル。使い方・運用者向け |
| `/spec` | 設計書。確定実装仕様。admin 限定 |
| `/bzm` | BZM テキストブック。理論・数式・rubric 導出 |
| `/bzm/map` | 理論マップ (論証台帳)。共有正本 `bzm_theory_nodes` / `bzm_theory_edges` を0件から本人が育てる。admin は空白クリックで作成、通常クリックで編集、通常ドラッグで配置変更、Cmd/Ctrl二点クリックで接続、線クリックで接続解除する。各panelはノードを覆わないマップ作業区画に表示し、memberは閲覧できる。旧Markdown 21ノード / 34関係は履歴資産で自動表示しない。件数・接続数は真偽・確信度を表さない。詳細契約は `/spec/2-6-bzm-theory-map-current-spec` |
| `/bzm/read` | 書斎（本棚）。管理者限定。執筆途中の本と論文6冊（BZM 3.0教科書、ディープテック起業の経営学、BZM 2.2教科書、BZM 批判的基礎講座、第1論文、第1論文 補足資料）を、書けた章の数・総文字数・通読の目安時間・この端末での読書位置つきのカードで並べる。AMD OS とは別のアドレス（`https://bookshelf-armada.vercel.app`）で開く別アプリの入口で、外枠（左ナビ・通知・チャット・月初合意ゲート）を載せず、上に「書斎」の見出し、白い背景、幅の上限 1200px、画面端（safe-area）の余白で表示する（外す判定は `AppShell` の `isBzmReaderRoute`）。AMD OS の左ナビには入口を置かず、書斎のアドレスか、インストールした「書斎」アプリから開く（AMD OS のアドレスで開くと書斎のアドレスへ送る）。この端末に位置があれば「続きから読む」（その章へ直接）と「最初から読む」（最初の書けている章の先頭、`?at=start`）、無ければ「最初から読む」だけ。章の選択は読書画面の左の目次で行い、棚には章の一覧を置かない（2026-10-04）。`/spec/5-18-bzm-reader-current-spec` |
| `/bzm/read/[book]` | 書斎の「続きから開く」入口。管理者限定。この端末に残った読書位置の章へ移り、無ければ最初の書けている章へ移る。外枠なし（`AppShell` の `isBzmReaderRoute` が外す） |
| `/bzm/read/[book]/[chapter]` | 書斎の読書画面。管理者限定。外枠（AppShell）を外した全画面で（外す判定はクライアントの `src/components/nav/AppShell.tsx` の `isBzmReaderRoute`。正規表現は `^\/bzm\/read(?:\/[^/]+){0,2}\/?$` で棚・続きから開く・読書画面の3つに合う。画面内リンクで移っても外れる。`(app)/layout.tsx` には置かない）、1ページずつのページ表示と縦のスクロール表示、目次・しおり・文字の設定を持つ。画面が 1100px 以上のときは、左に目次の列（幅 `min(280px, 22vw)`、開閉は端末ごとの `localStorage` `amd-os.bzm-reader.toc-open`、既定は開）を常設し、いま読んでいる見出しを強調する。見開きは本文の領域の幅が 1100px 以上のときだけで、左右のページの間は本文の領域の幅の 7%（72〜120px）、中央に細い仕切りの線を引く。未執筆の章を直接開いたときは「この章は未執筆」と、最初の書けている章・書斎へのリンクを出す。`?at=start` / `?at=end` で章の最初／最後のページから、`#見出しid` でその見出しのページから開く。読書位置・しおり・設定は端末ごとの `localStorage` に残し、サーバへ送らない（背景色の名前だけは、再読み込みの最初の描画のために Cookie `amd-os.bzm-reader.theme` にも書き、章ページがサーバで読む） |
| `/knowledge-map` | AMD Materials。高校生でも読める日本語で118元素を熱色・日本語主用途・供給警報から俯瞰し、元素の小窓で直近公表相場・5年推移・産出国円グラフを確認する。総合値は4指標合計（20点満点）で、周期表以外は合計の高い順。全材料横断の需給の崩れランキングは専用の偏りの強さ（5点満点）で並べ、不足側、供給過剰側、価格乱高下を区別し、原因、供給が詰まる工程、評価時点、確からしさを示す。全体の入口はカード全面で操作できる。元素・鉱物・樹脂は選択直後に要点の小窓を開き、詳細操作で同じ小窓を拡張する。樹脂の詳細では原料と製造方法も確認できる。比較、従来のノウハウ地図まで横断する読み取り専用の材料データベース |
| `/business-cards` | 名刺管理。スマホ撮影 / 写真選択 → Gemini OCR → 人の確認 → 1件以上のPJ紐付け → `business_cards` と D-3 `project_knowledge(category='people')` へ保存する。OCR結果は自動確定しない |
| `/native/business-cards` | iOS名刺タブ用のナビ無しnative shell。通常の月初合意overlayを重ねず、認証cookieつきWKWebViewから `/business-cards` と同じUI/APIを使う |
| `/seed-needs` | 社内portfolioの市場・企業ニーズ×既存シーズ一覧。記入例/実際の蓄積、追加編集、未接続、根拠・研究設計。RLSと詳細は5-19 |
| `/poc` | PoC案件化。Seeds とPoC先を入力し、その掛け合わせからヒアリング論点、PoC条件、謝礼、契約、資金、収益分配を追う |
| `/venture-map/amd-score` | 現行SPS一覧。`sps-ind-v1 / q-eval-v2 / rubric-v1.1 / p-ind-v1`だけを表示 |
| `/project/[projectId]/cockpit?tab=score-detail` | PJ cockpit 内の現行SPS詳細。BZM 2.2は同じBZMから出る別の出力として、合算せず続けて表示 |
| `/venture-map/amd-score/[projectId]` | 互換route。例外なくcockpitの現行SPS詳細へredirect |
| `/atlas` / `/atlas/*` | Atlas signal / story / divergence / map |
| `/admin/*` | 管理者向け台帳・設定・請求・支払・prompt |
| `/admin/japanese-culture-map` | 日本文化マップ。`jp_culture_items` の active 行を、admin layout gate 内でマインドマップ / 日本地図として読む。旧 `/japanese-culture-map` はこの route へ redirect |
| `/admin/management-knowledge` | 経営ノウハウ。事業化ルート、座組、価格、資金、法務論点などの再利用カードを保存する admin-only 台帳 |
| `/admin/private-wiki` | 裏wiki。人物単位の趣味・関係性メモを PJ 別に保存する admin-only 台帳 |
| `/admin/change-history` | OS全体のデータ変更履歴。adminだけが実行者・日時・PJ/対象・人が読める変更要約を密な台帳で確認する。同一transaction等の安全な連続行は件数にまとめ、詳細で元の各履歴と変更前後・戻す操作を確認できる |
| `/notifications` | L2 candidate / feedback の採否 |
| `/proactive` | admin 限定の先手 TODO リスト。`proactive_todos` の open / blocked / done / dismissed を期限順に確認し、完了・ブロック・関係ないの3ボタンで処理する |
| `/management-score` | AMD Management Score |
| `/institutions` / `/institutions/*` | ECR / 研究機関評価 |

## API / cron の境界

ZMP（p19）のワークスペースには「テーマ」タブが加わり、`#theme-progress`で直接開ける。
上表の外部アカウントへの表示制限は維持し、テーマ所属をアクセス権の根拠にしない。
読取は既存`GET /api/project-workspace/[projectId]`、テーマ固有の保存は`POST/PATCH /api/project-workspace/[projectId]/theme/[trackKey]`を使う。
タスク、運用MS、論点などは既存`/management` routeを再利用する。
保存はsame-origin、内部認証、PJアクセス、portfolio/adminの管理権限を確認する。
MTG新規作成と編集は安全側のフラグで一時停止している。
詳細は`3-16-project-weekly-control-current-spec.md`の「ZMPテーマ作業ハブ」を正本とする。

- LLM を使う定期抽出は PWA / Vercel cron へ戻さない。subscription automation / Codex automation / outbox applier へ寄せる。
- PWA cron に残すのは、原則として LLM 非依存の同期・集計・通知系。
- `/api/report/generate` と `/api/monthly-report/edit-by-tsukuyomi` は従量課金の誤実行防止で410停止。`/api/cron/monthly-reports-backfill` は重い手動復旧 route のため定期実行しない。
- 入金・支払・freee 連携などの運用 API は、既存の admin auth / signed token / `CRON_SECRET` 境界を崩さない。
- `/api/finance/live-cash-balances` は KAGAMI 等の外部クライアント向け read-only route。`/management-score` と同じ `buildLiveMonthlyPlInputs` + `runMonthlyPlSimulation` を server-side で実行し、月次の `cashBalance` だけを返す。過去月に `category='cash_balance'` の実績がある場合は実績残高を優先し、未来月は live 予算残高を返す。レスポンスは `ym`, `cashBalance`, `budgetCashBalance`, `actualCashBalance`, `runwayMonths`, `source(actual|forecast)` に限定し、PJ別・固定費・報酬内訳は返さない。
- `GET/POST /api/admin/dd` は DD パッケージの管理（`requireAdmin()` + service_role。POST は同一サイト確認も）。GET は独立したDD管理画面の中身（可変系、毎回読む）。`action` は `add_item` / `update_item` / `publish_item` / `withdraw_item`（公開する／公開をやめるの切り替え）/ `archive_item` / `restore_item` / `update_package` / `create_grant` / `update_grant` / `record_export`（正式版 PDF の出力の記録。サーバが公開中の項目を読み直す）だけ。画面から中身は受け取らない。付与の作成で停止・失効を復活させない。
- `GET /api/dd/summary` は、DD管理権限とパッケージの有無（並列のDD入口は管理者に常設）。AMD admin 限定の参照系（`src/lib/dd-client.ts` 経由）。
- `GET /api/bzm-reader/asset/[...path]` は書斎の原稿内の図（png / jpg / jpeg / svg / webp / gif）を配る read-only route。管理者だけ。`bzmContentDir()` の外へ出るパス（`..`、絶対パス）と対象外の拡張子を拒み、`Cache-Control: private, max-age=3600`、`nosniff` を付ける。書斎のアドレスでは `/api/bzm-reader/` 配下をそのまま出す。SVG には route が `default-src 'none'; style-src 'unsafe-inline'` の CSP を付け、全体の CSP に上書きされないよう `next.config.ts` の `headers()` が `/api/bzm-reader/asset/:path*` にだけ専用ヘッダ（`nosniff`、`X-Frame-Options: SAMEORIGIN`、`Referrer-Policy: no-referrer`、`Content-Security-Policy: default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox`）を当てる（2026-10-03）。
- `POST /api/tsukuyomi/chat` は先頭で `requireMember()`（PWA は cookie、macOS は Bearer）。未ログインでPJの context を読ませない（2026-09-30）。`GET /api/project-tech` / `project-cost-model` / `project-ip` の読み取りは `requireMember()` または当該PJのワークスペース権限（DB 再確認）だけ（Supabase にログインしているだけでは通さない）。
- `/api/auth/email-start` は外部ユーザーのログインリンク送信。DD の閲覧権限だけを持つ人も、公開中のパッケージへの有効な付与があれば送る。登録済みで、かつ失効していない所属がある場合だけメールを送る。登録の有無で応答の形も状態コードも変えない (メール列挙の防止)。ドメインで認可しない。送信前に `workspace_claim_email_otp_send` を呼び、登録account単位で60秒cooldown、15分5回までをDB transactionで直列化する。claim取得失敗または抑止時も同じ200応答を返す。
- `GET/POST /api/mypage/weekly-tasks` は本人の週次タスク専用。GET は本人またはadminの閲覧だけ、POST の作成・完了状態変更・月曜JSTの繰越・来週候補の明示追加は本人だけに限定する。GETの候補は、本人担当・`confirmed`・未完了・来週JST期限の `action_items` だけで、予定や議事録の自由文を自動タスク化しない。`member_activities(source='member_weekly')` は活動根拠のまま別管理し、タスク状態を書き込まない。`source_fusion` は保存経路で、UI表示は `raw_metadata.source_kinds` の実根拠種別にする。作成・状態変更・候補追加は楽観更新し、応答待ちで画面を止めない。繰越は直前週の `open` 行だけを現在週へ1回だけ作り、元週の未完了行を消さない。browserからのテーブル直接権限は与えず、認証済みAPIのservice roleだけが書く。
- `/api/admin/workspace-access` は `requireAdmin()` + `service_role` で外部アクセス台帳を読み書きする。`kind` (`account` / `institution_membership` / `project_membership`) を必須にし、汎用の upsert 経路を作らない。停止済み (suspended / revoked) の行は作成では復活せず、明示的な PATCH だけで戻る。機関ワークスペース所属の付与がPJアクセスを自動作成しない。`auth.users` の id は select も返却もしない。GETは全対象tableを1000件単位でpaginationし、上限到達時は明示失敗する。500件または1000件で黙って切らない。
- `POST/PATCH/PUT /api/workspace-documents/**` のcookie認証付き変更は `Origin`、`Sec-Fetch-Site`、`Referer` の順でsame-originを確認し、確認材料が無いrequestも403で閉じる。GETはこのmutation guardの対象外だが、資料単位の認可を毎回行う。
- `/api/admin/private-wiki` は `requireAdmin()` + `service_role` で `private_wiki_entries` を list/create/update/archive する。browser client から直接書かせない。
- `/api/admin/management-knowledge` は `requireAdmin()` + `service_role` で `management_knowledge_entries` を list/create/update/archive する。browser client から直接書かせない。source_excerpt は短い根拠だけで、メール全文・議事録全文・資料全文を保存しない。
- `/api/admin/change-history` は `requireAdmin()` で `amd_os_data_change_history` を新しい順に最大1000件ずつ読む（`project_management_field_audit` の二重監査行は表示対象から除外）。広い取得単位は、1行ごとに別transactionとなる同じ自動処理をページ境界で細切れにしないため。PJ IDと現存するPJタスク・PJアクションの対象名に加え、メンバー台帳の`member_name`/`code_name`/`member_id`を解決して要約の文脈に渡す（emailは表示用ラベルに使わない）。UIは同一transactionの連続行に加え、同じ実行者のservice roleが同じtable・操作・PJへ1秒以内に続けた行を表示上の自動batchへ集約するが、`members.last_login_at`は同一メンバー単位でまとめ、誰の何回の更新かと実効的な変更前→変更後を出す。監査日時と日時型の差分値はAsia/Tokyoで表示し、ミリ秒は同一秒内の差分を区別するときだけ付ける。undoは元の履歴行ごとに判定する。履歴はDB triggerが作り、画面routeから履歴行を作らない。秘密列は伏せ、大きい値は省略し、履歴table自体はappend-onlyとする。`POST {action:"undo",historyId}` はadmin専用の `amd_os_undo_data_change` RPCへ渡し、主キーあり・秘密/巨大値なし・現在値が変更後と一致する場合だけ逆操作する。競合・戻し済み・対象外は変更せず理由を返し、逆操作は元履歴へのリンク付きで新たな履歴になる。
- `/api/admin/workspace-access` の `action=access_request_decision` は `requireAdmin()` + `service_role` で、未許可アカウントのアクセス要求を承認/拒否する。申請先の研究機関/PJ workspaceへ`readonly`/`invited`で直接許可する。共有資料直リンクはactive・workspace_sharedの所有workspaceをサーバで特定し、既存の未特定要求もdecision RPC内で解決する。アカウント作成・grant・要求決定・監査は一つのトランザクション。PJ閲覧grantはproject_access_membershipsだけで、研究機関所属・共同正本grantを作らない。特定不能な要求は付与せず止める。停止済みaccount/grantは自動復活しない。
- `/tasks` 画面は廃止済み。`/api/tasks` は cockpit legacy kanban / H-1 互換のため残し、DB write は `service_role` 経由で、DELETE ではなく `active=false` を使う。通知 link は対象 PJ cockpit へ向ける。
- `/api/task-calendar/register-tasks` は H-1 が抽出した次アクションを `tasks` に自動登録し、担当者本人にだけ Slack DM nudge を送る。`CRON_SECRET` / `WORKFLOW_SECRET` または admin auth でのみ実行し、admin review queue は作らない。
- `/api/cron/governance-email-sweep` は D-14G の source sweep route。`CRON_SECRET` または admin auth でのみ実行し、`/admin/projects` の総会/役会フラグON PJに限定して Gmail を検索する。LLM定期cronではなく、source refs と `/api/governance/extract` への候補/確認済みhandoffを担う。
- `/api/guardrails/evaluate` は経営ガードレールのタグ照合 route。admin auth または `CRON_SECRET` でのみ実行し、`guardrail_cards.status='active'` と PJ / アクションタグを照合して `guardrail_matches` と `l2_notifications(l2_kind='guardrail_match')` を作る。LLMは使わず deterministic に評価する。
- `/api/cron/proactive-todo-extract` は先手TODOの非LLM lifecycle cron。新規候補は作らず、`due_basis='explicit'` の期限超過openをredへ上げ、3日経過したblockedをopenへ戻すだけ。汎用TODOの自動生成は停止中。既存 Codex automation `amd-os-proactive-heartbeat` は未審査L2 candidateを正本採否カードへ仕上げる。
- `/api/cron/reimbursement-reminders` は未承認立替の non-LLM リマインド cron (毎日 JST 10:00 = `0 1 * * *`)。`CRON_SECRET` の Bearer / `?secret=` または admin auth でのみ実行する。`reimbursements.status` が `approved` / `rejected` / `paid` 以外の行のうち、`reminder_last_sent_at` (null なら `created_at`) から 24 時間以上経過したものだけを対象に、active admin 全員と申請者本人へ Slack DM を送り、`reminder_last_sent_at` / `reminder_sent_count` を更新する。申請者が admin の場合は `slack_id` 一致で admin 宛から除外する。Slack 送信は best effort で、失敗は response の `errors[]` に返すだけで throw しない。従量課金 LLM は呼ばない。
- `POST /api/slack/reimbursement-decision` は Slack の承認ボタン押下を `reimbursements` へ反映する受け口。認証は共有シークレット `SLACK_DECISION_SECRET` (`x-amd-slack-secret` ヘッダまたは `Authorization: Bearer`) のみで、未設定なら常に 401。body は `{reimbursementId, action, approverEmail}`。`action` は `reimb_approve` / `reimb_reject` (PM) と `reimb_admin_approve` / `reimb_admin_reject` (admin) の 4 種。押した本人は `members.email` で解決し `status='active'` を必須とする。PM 系は `project_members` の `is_pm=true` かつ `is_active=true` かつ当該 `project_id` 一致を要求し、`reimbursements.status='submitted'` のときだけ `pmApproved` / `rejected` へ遷移させる。admin 系は `members.is_admin=true` を要求し、`status` が `pmApproved` / `pmapproved` のときだけ `approved` / `rejected` へ遷移させる。2026-08-13 以降の通常経路は `POST /api/slack/interactive` で、この route は切り戻し用に残す予備口。旧経路の呼び出し元は `gas/081_SlackInteractive.js` の `reimburseApplyDecisionViaPwa_`。GAS 側の旧 `reimburseApplyDecision` は旧スプレッドシート `DB_Reimbursements` を書くだけで Supabase 正本へ届かないため deprecated とし、通常経路から呼ばない。
- `POST /api/slack/interactive` は Slack の Block Kit ボタン押下を PWA が直接受ける正本の受け口 (2026-08-13 に Cloud Run → GAS キュー → 1 分トリガー worker の 3 ホップから移行)。認証は Slack 署名検証のみ: `x-slack-signature` / `x-slack-request-timestamp` と `SLACK_SIGNING_SECRET` で `v0:{ts}:{raw}` の HMAC-SHA256 を timing-safe 比較し、5 分より古い timestamp と `SLACK_SIGNING_SECRET` 未設定は常に 401。`SLACK_SIGNING_SECRET` はカンマ区切りで複数持て、どれか 1 つと一致すれば通る (2026-08-21)。Slack の payload は**そのメッセージを投稿したアプリ**の signing secret で署名されるため、立替カードを投稿する「つくよみ」(`A0A5Z2UETQD`) と他の通知を投稿する「えいみ」(`A0AC419BPGE`) の両方をこの route で受けるには両アプリぶんの secret が要る。body は `application/x-www-form-urlencoded` の `payload=<json>`。Slack の 3 秒制限に合わせ、検証後は本文を返さない空 200 を即返し、本処理は `after()` で走らせて `chat.postMessage` の `thread_ts` でスレッド返信する (元メッセージは書き換えない)。処理する `action_id` は `reimb_approve` / `reimb_reject` / `reimb_admin_approve` / `reimb_admin_reject` (value は `{reimbursementId}`、`applyReimbursementDecision` を呼ぶ) と `payment_confirm_expected` (value の `token` を `verifyPaymentConfirmationToken` で検証し `confirmPaymentGroup` を呼ぶ)。押した本人は `members.slack_id` を正本に、無ければ Slack `users.info` の `profile.email` で解決する。未知の `action_id` はリンクボタン等で毎回届くため黙って 200。二重押しは「同一インスタンス内 30 秒の dedupe」「`applyReimbursementDecision` の status ガード (409)」「`confirmPaymentGroup` の `alreadyConfirmed`」の三段で吸収する。Slack アプリ側の Interactivity Request URL をこの route に向けることが有効化条件で、切り戻しは URL を Cloud Run へ戻すだけ。
- `/api/business-cards` は認証済み AMD メンバー向け。GET は名刺一覧とPJ候補、POST は画像を private Storage へ保存して DB prompt `business_card.ocr` で OCR し、必ず `needs_review` に止める。`PATCH /api/business-cards/[cardId]` だけが人の修正内容を `confirmed` にし、選択PJの `project_knowledge` へ安全な人物情報を同期する。
- `/api/business-cards/[cardId]/image` は private bucket の画像を認証済み AMD メンバーだけへ返す。ブラウザから Storage 公開URLを生成しない。PJナレッジへ email / phone / address / raw OCR / 画像を複製しない。

## 外部ワークスペースアクセス

migration 212 / 213 / 216〜219 / 258 と対になる contract。212 / 213は2026-08-01、216〜219は2026-08-02、258は2026-08-11に本番適用済み。258の適用後readbackはOTP limiter tableとclaim function、audit trigger 4本、RESTRICT FK 2本、service_roleだけのclaim実行権限を確認した。詳細設計は `pwa/design/institution_seed_project_model.md` §6。

| 項目 | contract |
|---|---|
| route | `/` / `/workspaces` / `/workspace/[slug]` / `/project/[projectId]/workspace` (外部面) / `/auth/login?audience=institution` / `/auth/logout` / `/admin/access` / `/dd/**`（DD の面と正式版の印刷画面）/ `/project/[projectId]/dd`（独立したDD入口・管理） |
| API | `POST /api/auth/email-start` / `/auth/callback` / `GET/POST/PATCH /api/admin/workspace-access` / `GET/POST/PATCH/PUT /api/workspace-documents/**` / `GET/POST /api/admin/dd` / `GET /api/dd/summary` |
| table | 212の7テーブル `workspace_user_accounts` / `institution_workspaces` / `institution_workspace_memberships` / `institution_workspace_project_scopes` / `institution_workspace_seed_scopes` / `project_access_memberships` / `workspace_access_audit_logs`、216の `workspace_documents`、258の `workspace_email_otp_rate_limits`、455〜458 の `dd_packages` / `dd_package_grants` / `dd_package_items`（公開の切り替え `is_published`）/ `dd_item_publications`（初版の公開時点の記録。新しい行は作らない）、private Storage `dd-publication-files`（ドライブの資料の写し） |
| authority | access 7テーブルとOTP limiterは RLS 有効・anon / 一般 authenticated の直接権限なし。admin (`is_admin()`) と service_roleだけを使う。role名は権限そのものにせず、`workspace-capabilities.ts` の明示capability束へ変換してから資料操作を判定する |
| principal | 外部ユーザーの識別子はメールアドレスのみ。認可はアカウント登録・機関ワークスペース所属・PJ個別アクセスの3つの明示的な付与だけ |
| 暗黙付与の禁止 | 機関ワークスペース所属はPJアクセスを含意しない。ドメイン一致も認可の根拠にしない |
| session | email OTP（PKCE、2026-09-30〜）→ `signOut({scope:'local'})` → 30日固定の `amd_os_workspace_session` 署名cookie。同じブラウザでは期間内のメール再認証を不要にし、毎リクエストで cookie 検証 + DB 再検証する。権限失効は30日を待たず次のリクエストで即時反映 |
| failure mode | 未認可・不明slugは redirect せず not found。例外として、メールで共有した`workspace_shared`のHTML資料URLを未ログインで開いたときだけ、資料本文を返さず外部向け確認コード入口へ案内し、ログイン後に同じ資料URLへ戻す。署名済みworkspace sessionで対象外・失効の場合は従来どおりnot found。PJ一覧取得失敗と参加0件、進捗未登録と0%を区別する |
| 213 の閉鎖範囲 | `institutions` / `institution_assessments` / `projects` / `members` / `project_members` / `institution_projects` / `seed_projects` / `seeds` / `seed_funding` / `seed_news` / `seed_contact_log` / `seed_sps_assessments` / `value_plan_cycles` / `value_milestones` / `milestone_monthly_progress` の計15テーブルで anon read を撤去し、authenticated を `amd_os_is_member()` ゲートへ寄せる。内部ブラウザreadはログイン済みSupabase browser client、server routeは明示注入したservice clientを使う。write は `is_admin()` + service_role |
| scope (愛媛) | p30 は `ehime` ワークスペースへ `shared_surface='summary'` で登録 (サマリのみ、詳細ワークスペースは非共有)。p21 はPJ範囲に含めず個別付与のみ。シーズ範囲は `inst_ehime` 紐付け全件。公開一覧は現時点 `ehime` 1件 |
| 評価系列 | ECR は機関の縦並び (総合 + 8軸)、SPS はシーズごと。DTO 上も別プロパティで、合成スコア・相関・因果指標を作らない |
| 資料共有 | `workspace_documents` とprivate Storage `workspace-files`が正本。機関資料とPJ資料をscopeで分離し、外部は `workspace_shared` だけを読む。追加権限がある現在folderの資料一覧全体（空状態を含む）が外部file uploadのdrop先で、資料室内のFinder / Explorer file drag/dropはcapture段階でブラウザ既定のopen/downloadを止める。実際のuploadは検索中でない現在folderの資料一覧だけから既存upload処理を通して行い、内部資料行をパンくずへ移動するdragとは分ける。旧Project Shareは移行readback後の2026-08-26に全廃し、旧入口・Vercel project・Blob store・共有パスワード方式を再利用しない。公開後revisionの上書き禁止は未実装で、全体収束仕様の残課題 |
| audit | `workspace_access_audit_logs` にログイン要求・送信・成功・拒否・ログアウト・admin操作を記録する。258はaccount、機関grant、PJ grant、資料metadataのrow変更をDB triggerで同じtransactionに記録する。semantic audit insert失敗も成功扱いしない。メール本文、URL、トークン、未登録アドレス、Storage pathは残さない |
| access request | 未登録または利用可能membershipが無いメールの要求は`workspace_access_requests`へ保存し、一般auditには未登録メールを残さない。まさ（ID001）へのSlack DMは同一要求30分に1回・全体20件/時でclaimし、許可/拒否ボタンはSlack署名検証後に処理する。Slackからの決定はまさ本人の`members.slack_id`一致だけ。許可後の追加メールは送らず、本人の次回ログイン操作で既存OTPを送る |
| validation | `test:workspace-access-scope` / `test:workspace-access-session` / `test:workspace-email-start-contract` / `test:workspace-next-path` / `test:external-project-workspace` / `test:workspace-access-admin` / `test:workspace-rls-closure` / `test:workspace-documents-core` / `test:workspace-documents-contract` / `test:workspace-fact-origin-contract` / `test:workspace-security-migration-contract` / `test:workspace-capabilities` |

## Admin Private Wiki

| 項目 | contract |
|---|---|
| route | `/admin/private-wiki` |
| API | `GET/POST/PATCH /api/admin/private-wiki` |
| table | `private_wiki_entries` |
| authority | `members.is_admin=true` の authenticated admin と service_role のみ。anon / 一般 authenticated は不可 |
| grouping | `project_id` nullable。PJ紐付けありはPJ別、nullは AMD 全体 / 未紐付けで表示 |
| person fields | `person_name`, `person_kind`, `affiliation`, `relationship_context`, `birthday_label`, `origin_label`, `residence_label`, `contact_context`, `family_note`, `taboo_note`, `memo_body` |
| evidence fields | `source_kind`, `source_ref`, `source_excerpt`, `confidence`, `updated_by` |
| safety | `visibility='admin_private'` 固定。通常 PJ cockpit、公開ページ、研究機関外部 workspace へ表示しない。`source_excerpt` は短い抜粋だけで全文保存しない |
| lifecycle | `status` は `active` / `needs_review` / `archived` / `deleted`。UI は archive 導線を標準にする |
| retired surface | 旧 `tags` 列は既存互換のため DB に残すが、UI/API の編集・検索・フィルタ契約からは外す |

## Admin Management Knowledge

| 項目 | contract |
|---|---|
| route | `/admin/management-knowledge` |
| API | `GET/POST/PATCH /api/admin/management-knowledge` |
| table | `management_knowledge_entries` |
| authority | `members.is_admin=true` の authenticated admin と service_role のみ。anon / 一般 authenticated は不可 |
| scope | `project_id` nullable。PJ紐付けありはPJ別の知見、nullは AMD 全体で再利用する知見 |
| core fields | `title`, `category`, `route_type`, `maturity`, `summary`, `body_md`, `reusable_when`, `next_check`, `tags` |
| evidence fields | `source_kind`, `source_ref`, `source_excerpt`, `confidence`, `updated_by` |
| maturity | `raw_note` / `hypothesis` / `field_tested` / `playbook`。思いつきと再利用可能な型を混ぜない |
| seed | 2026-07-03 香川藻場回復メモから Proto-RT 型の初期カードを入れる |
| lifecycle | `status` は `active` / `needs_review` / `archived` / `deleted`。UI は archive 導線を標準にする |

## 変更ゲート

- route / API / cron / data model を変えたら、この章または該当 `/spec` 章に仕様を書く。
- 既存 `pwa/design/SPEC_pwa.md` は未移行項目を多く含むため、移行完了まで同時に参照・必要なら更新する。
- DB列を書く変更では `pwa/design/db_schema.md` を確認する。
- PWA 画面や route を触ったら `npx tsc --noEmit` と `npm run build` を通す。

## 2026-10-06 — PJポートフォリオの読み込み

ダッシュボードの初回effectでポートフォリオを先行取得し、PJ台帳の取得だけで主画面を開く。請求状況・現行SPS・経営指標・自分の担当PJを全部待ってからポートフォリオを読み始める直列待ちは廃止。読み込み中は見出し・統計枠・3分類の骨組みを表示する。

`portfolio-pulse-server.ts` はECR、表示用シーズ6項目とPJリンク、現行版完全一致かつ凍結済みのSPS帯4項目を並列取得する。シーズ全件を読んだ後にUUIDを200件ずつ追加問い合わせする経路はホームで使わない。評価履歴・説明文・rubric・評価noteはホームDTOへ送らない。SPS最新行の採用、評価件数、候補の並び順、PJ由来判定は従来と同じ。ECR/シーズ/SPSの障害を個別に返し、不完全な結果はサーバ・クライアントともキャッシュしない。全テーブルは安定順序の1000行ページ取得で上限を跨ぐ。

サーバは完全な結果を60秒保持し、同時取得を1本に束ねる。クライアントは `portfolio-pulse-client.ts` から共通参照キャッシュを60秒使い、再訪時はpeekで即描画。`?fresh=1` はサーバ再取得。ネットワークに出るたび `requireMember` とactiveなportfolio scopeを確認し、共有の横断データを権限変更後にHTTPから返さないため `Cache-Control: private, no-store` を維持する。無認証/PJ限定/無効メンバーはデータ取得前に拒否する。両層の `invalidatePortfolioPulseCache` で明示破棄できる。DB/評価式/通知は変更なし。

検証: 同じ本番データ3回のローカル直接読取り中央値は旧1093ms→新295ms。UTF-8の返却量は1,210,314→358,405 bytes（約70%削減）。サーバ保持中の追加DB問い合わせは0。65機関/815シーズ/736評価、ECR値、PJ由来・分類、候補順の旧新一致を確認。これらは画面全体の表示秒数とは別の測定。実行検査は `test:portfolio-home-contract`（>1000件、最新評価、同時取得、再取得、部分失敗後の回復、権限拒否）。参照キャッシュ検査にも登録し、deploy前に両検査を実行する。

2026-10-06: 組織図は全PJのコックピット `?tab=organization-chart`、ワークスペース `#organization-chart`、DD `?tab=organization-chart` から共通本文を開く。領域別入場認可は維持。詳細はspec 3-23。

### 2026-10-06 人ごとの外部アクセス管理
`/admin/access` は一人一行の検索可能な一覧と単一の編集ダイアログ。GET `/api/admin/workspace-access` にDD packages/grantsの全件paginationを追加。DD編集は既存 `/api/admin/dd` のcreate_grant/update_grant。POST action `grant_project_viewer` は既存accountへのreadonly PJ membershipのみを作り、機関所属/共同正本を作らない。停止account・既存membershipは拒否し、変更を監査する。account PATCHで表示名を変更できる。POST/PATCHはsame-origin必須。旧kind経路は互換維持。

## PJの３スペース権限管理（2026-10-07）

- メンバー識別は名前・email・affiliationの３列、続けてactive PJごと３スペース列。名前のみ横sticky、識別３列とPJ見出しは縦sticky。table末尾のtfootに名前・メール・所属の追加フォームを常設し、下端と横左端に固定。フォームは表示幅をResizeObserverで測りmax720px、mobileは２列２段で操作44px以上。空検索結果でも追加行は残る。Enter/追加で３項目必須の登録、成功時に入力クリア・検索解除・追加行直前へ新メンバーを表示して移動。登録後の一覧再取得が失敗しても承認済みaccountを表示して再読込みへ案内する。
- `workspace_user_accounts.display_name`（名前）・`email`（正規化した識別子）・`affiliation`（所属、nullable/max160字）は独立した列。追加行は既存admin-only POST `/api/admin/workspace-access` のkind=account/createOnly=trueを利用し、新規は３項目必須・displayName120字まで。社内登録済み・既存外部・停止中の同一emailは409で拒否し、既存の名前/所属/状態を上書きしない。accountをinvitedで作成し監査記録、PJ membership/DD grant/認証credential/通知は作成しない。所属は認可根拠にしない。古い呼出しは所属を省略可能、PATCHは明示された所属だけ更新。migration `20261007171000_workspace_account_affiliation` 本番適用・履歴登録済み。既存所属を推測して埋めない。未登録名は表示上「未登録」、email列で区別。３項目で検索可能。

- admin-only `/admin/permissions`、GET/POST `/api/admin/space-permissions`。GETは全件pagination・安全な列だけで内部members、project_members、個別付与、外部accounts、PJ memberships、DD packages/grantsを集約する。認証IDや秘密値は返さない。同じメールは同じ人へまとめる。表示は名前を先頭列・１人１行、PJをcolSpan=3の２段見出し、各PJ配下をcockpit/workspace/ddの３列とした横長matrix。projects.status=active、members.status=active、workspace_user_accounts.status=activeまたはinvitedを採用し、suspended/inactive/endedは除外。invitedは利用可能な招待済みaccountであり、付与済みのPJ membership/DD grantを一覧から落とさない。名前列の補助行で初回ログイン待ちを示し、未登録名はemailで識別する。権限未付与の有効な人も含める。名前/メール検索とactive PJ絞込み、名前列（mobile112px/desktop176px）と２段見出しのsticky、PJ名も自身の３列内で横sticky、65dvh以下の表内縦横スクロール。表外枠はw-fit/max-w-fullで内容幅へ合わせる。閲覧=青の「閲覧」、編集=赤の「編集」（viewを含む）、null=「—」。権限の根拠・失効・未公開はtitleとセル編集dialogで表示する。停止を復帰させる操作はこの一覧に追加しない。
- 内部の追加権限は `project_surface_member_permissions(project_id,member_id,surface,permission,granted_by_member_id,updated_at)`。surface=cockpit/workspace/dd、permission=view/edit。PK=(project_id,member_id,surface)。初期行なし、既存権限は独立した基準値。active memberだけが利用できる。admin管理権限は個別付与では変更しない。追加grantはPJ所属、報酬、エフォート対象を作らない。
- POSTはrequireAdmin＋same-origin＋active admin再照合の後、service_role専用RPC `amd_os_admin_grant_project_surface`。active target・FK・allowlistで検証し、権限と監査を同じtransactionで保存。tableはRLS有効、anon/authenticatedに直接権限なし。migration正本=`ios/supabase/migrations/20261007090000_project_surface_permissions.sql`。本番適用済み、再適用不要。
- `getCurrentMemberAccess` は毎requestで個別grantを読む。コックピット入口はapp layoutでPJ/surfaceを検証、`/api/project-surface/cockpit/[projectId]` は同じ認可後に既存共通loaderをservice clientで呼ぶ。署名付きPJ限定sessionでのコックピット付与も全社sessionへ昇格せず利用できる。workspace resolverはworkspaceの個別grantだけを採用する。
- 内部editの委譲は対象PJの共有management、技術、知財、コスト試算、事業概要、資料へ接続。admin専用の全社・会計・権限・契約確定APIは維持。技術/IP/コストは保存済み対象行からproject_idを解決し、他PJへのID差替え・project_id/親IDの移動を拒否する。read flagとwrite guardは共通の個別grantを読む。既存portfolioの共有編集を新規の技術/IP等の編集根拠にしない。
- 外部は既存 `project_access_memberships` にreadonly/managerを保存（manager=共有資料編集）。新規accountはinvited、初回ログインでactive化する。停止行は作成で復帰しない。内部用のコックピット付与を外部アカウントへ流用しない。
- DDの外部capabilityに `dd.edit` を追加。dd.view必須、期限・account停止・package状態の既存境界を維持。内部のDD個別viewはopenだけ、editはdraftも利用でき、closedはadmin以外不可。DD編集画面=`/dd/[slug]/edit`、API=`/api/dd/[slug]/edit`。毎回resolveDdPackageAccess＋dd.edit＋same-originを確認。allowed actions=add/update/publish/withdraw/archive/restore_itemだけ。package_idとitem所属をDBで検証する。package受付状態・権限・ログの操作を委譲しない。GETはgrants/events/exportsを除き、画面もその操作を隠す。既存admin APIは `dd-admin-actions.ts` の同じ実装をrequireAdminで呼ぶ。
- 「参加しているプロジェクト」へ個別付与のPJも含め、各スペースを独立に認可した入口を出す。マニュアル=2-6、共通画面正本=ios/DESIGN.md、pure判定の検査=`scripts/check_space_permissions.mts`、DD既存検査=`test:dd-package`。

内部コンテンツの委譲APIは `requireProjectContentEditor` でactive member、対象PJの明示cockpit/workspace edit（またはadmin）を確認する。cookie認証の変更はsame-origin必須。Cookie/Originを伴わないNative Bearerは検証済みの内部JWTで認証し、同じPJ認可を行う。PJの定義・権限付与・全社設定は委譲対象外。

社内の領域ナビは GET `/api/project-surface/navigation/[projectId]`（no-store）でcockpit/workspace/DDを独立に再照合する。DD管理リンクはadminだけ。DD個別付与は公開/編集可能状態の `/dd/[slug]` へ、workspace未付与ならそのリンクを出さない。表示中の領域だけは読み込み中も保持する。

権限一覧と付与先のDDは、既存loadDdAdminState/getDdPackageSummaryと同じく当該PJで最初に作成したpackageを選ぶ。created_atを取得し作成日時で選び、UUID順や後発の検証packageを根拠にしない。

### 2026-10-08 行き先未指定の承認
`requested_path=/` 等の未特定申請には対象を推測しない。Slackのstatic_select（workspace_access_destination/workspace_access_scope）またはadmin画面で管理者がscopeを明示する。scopeはinstitution:slug / project:id / dd:uuid / project_dd:uuid。`workspace_decide_access_request_scoped` はservice_role＋active admin（SlackはID001限定）でのみ実行でき、pending未特定申請をロックする。institution/projectは既存canonical decisionへ委譲、DDは公開中packageだけdd.viewをinvitedで付与する。project_ddは双方を同一transactionで付与し、停止・期限切れDDで失敗すればworkspace付与もrollbackする。既決定は再付与しない。通知の選択値はpayload.stateの固定block/actionから読み、dedupeに選択値を含める。過去の未特定カードは再押下でchat.updateして選択欄を出す。明確な申請先は従来の一回承認を維持。未知errorの英語本文をSlackへ表示しない。migration 20261008041500は2026-10-08に本番適用済み。

## 同じ画面の閲覧者と閲覧履歴（2026-10-08 16:40 JST）

共通`PageHistoryToolbar`右上の`PageViewing`に丸い頭文字と人数を表示し、「閲覧中」「閲覧履歴」を切り替える。社内共通枠、共有PJ、DDで共用。印刷・書斎・native専用枠は対象外。ネイティブUIは未移植。

- PJ・領域・選択済みページ名で区別する。`ProjectPageTitle`が`amie-page-selection`を通知。query/hashだけでなく解決済みの表示状態を使い、サーバでproject-formatsのタイプ別ページ、DD目録、外部タブの許可リストを検証する。URL/query/hash、メール、本文、入力、検索語を保存しない。一般画面はpathname単位。マイページ・月初合意・契約・立替・通知・参加PJは本人の名前空間。
- `POST /api/page-viewing`は表示中タブだけ10秒ごとに更新。非表示・pagehide・切替・アンマウント時にkeepalive退出。通信断は30秒TTL。1人の複数タブは1人。8秒timeout、失敗時は古い一覧を消す。200session超は＋表示。document.visibilityState基準であり、視線・読了・実作業時間を判定しない。
- `GET /api/page-viewing?pathname=...&pageLabel=...&history=1`は読取り専用。POSTは同一Origin、2KiB上限、UUID、単調増加revisionを検証。全応答private/no-store。毎回既存member/個別surface grant/PJ所属/外部membership/DD grantを再検証。DD項目は所属・active・公開を確認。失敗は一律404、未対応専用画面はUIを出さない。権限追加・対人通知なし。
- `os_page_viewer_sessions`はsession UUIDごとの一時状態、`os_page_viewing_visits`はvisit UUIDごとの永続履歴。service-only RPC `amie_update_page_viewer`は同一transactionで更新、revisionで遅れたheartbeat/leaveを拒否し別actorのsession上書きを拒否。heartbeatでは履歴を増やさない。退出後に戻ると新visit。1日超の一時sessionだけ通常更新時に掃除し、履歴は削除しない。
- 両tableはRLS有効でanon/authenticated権限なし。RPCもservice_roleのみ。外部の履歴は本人のactor_keyに限定。内部は認可された同一画面の履歴だけ。開始日時の降順50件、日本時間で表示。名前は登録済みmembers/display_nameから解決、未登録なら氏名未登録。横断監視や滞在時間推定は持たない。
- migration `20261008120000_page_viewing_presence_history`は本番適用・履歴登録済み。`test:page-viewing`、DB ROLLBACK試験`test_page_viewing_transaction.sql`、実APIの境界試験`check_page_viewing_live.mjs`。有効な外部アカウントがなく、外部本人の実ログイン正例は未検証。
