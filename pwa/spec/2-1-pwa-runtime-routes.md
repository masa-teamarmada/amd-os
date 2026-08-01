# PWA ランタイム / ルート仕様

> **この章は何か**: AMD OS PWA の実行環境、主要 route、API / cron / auth の確定仕様。詳細な履歴や長い route 説明は `pwa/design/SPEC_pwa.md` にも残す。移行中は両方を更新する。

## 実行環境

| 項目 | 値 |
|---|---|
| 種別 | Next.js App Router PWA |
| 技術 | Next.js 16 + React 19 + Tailwind CSS v4 |
| 正本パス | `/Users/masa/projects/AMD/amd-os/pwa` |
| 本番 | `https://amd-os-pwa.vercel.app` |
| Vercel project | `amd-os-pwa` / scope `armada0130` |
| Backend | Supabase `nbnhrhybjslbawdukvvk` + AMD OS GAS bridge |

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
- `/api/*` の mutation は route ごとに `requireAuth` / admin check / `CRON_SECRET` を使い分ける。
- Google OAuth は Calendar / Gmail の readonly access を前提にし、server-side ingestion 用 token は `member_google_oauth_tokens` に保存する。
- 認証主体は3種類。(1) 内部メンバー = Google OAuth の Supabase authenticated session、(2) PJ限定メンバー = 旧 `amd_os_project_session` 署名cookie、(3) **外部の研究機関ユーザー (`workspace_user_accounts`) = `amd_os_workspace_session` 署名cookie**。
- 外部ユーザーはメールリンク (email OTP) でログインし、コールバックでSupabaseセッションが成立した直後に `signOut({ scope: "local" })` してHTTP-only署名cookieへ交換する。以後Supabaseのauthenticatedセッションを持たない。cookieは毎リクエスト検証したうえで**必ずDBを引き直す**。アカウント停止、所属失効、ワークスペースのpauseは次のリクエストで効く。cookieの中身だけを信用しない。
- `amd_os_workspace_session` が通常セッションの代わりになるのは `/workspaces`、`/workspace/**`、`/project/[projectId]/workspace` だけ。内部メンバー route では middleware がこのcookieを認証として扱わない。
- 認可の根拠は明示的な付与だけ。メールのドメイン一致は根拠にしない。**機関ワークスペースの所属はPJアクセスを意味せず**、`/project/[projectId]/workspace` は `project_access_memberships` の `status='active'` 行が対象PJを名指しした場合だけ開く。
- 認可できない場合は閉じる側へ倒す。存在しないslug・権限のないPJはリダイレクトせず not found にして、機関やPJの存在自体を漏らさない。
- `/auth/callback` のログイン打ち切りは、必ず `supabase.auth.signOut({ scope: "local" })` で行う。`@supabase/auth-js` の `signOut()` は scope 省略時 `global` で、member 未登録・ドメイン不許可・PJ membership なし・Calendar 検証失敗のいずれか1回で、そのユーザーの**全デバイスのセッション**が失効する。callback の signOut はすべて「いま確立しかけた、このブラウザのセッションだけを捨てる」意図なので、scope は省略しない (2026-07-27)。

## 主要 route 群

| route | 役割 |
|---|---|
| `/` | 公開トップ (認証不要)。`institution_workspaces` の `status='active'` かつ `is_publicly_listed=true` の行だけを、slug / ワークスペース名 / 機関の名称・種別・地域で一覧する。説明文、シーズ・PJ件数、ECR、AMD Score は公開しない。内部メンバーのセッションがあれば従来のホームへ、外部アカウントのセッションがあれば `/workspaces` へ redirect する |
| `/workspaces` | 外部アカウント (`workspace_user_accounts`) の入口。所属する機関ワークスペースと、`project_access_memberships` で個別に許可されたPJだけを並べる。機関所属をPJ一覧の根拠にしない |
| `/workspace/[slug]` | 研究機関ワークスペース本体。内部アプリの chrome を共有しない独立シェル。対象機関のPJ、シーズ一覧、ECR を読み取り専用で表示する。シーズはPJ化済み → PJ化検討中 → PJなし・SPS算出済み → その他の順で、同区分内は表題の日本語順。ECR は1機関の縦並び (総合値 + 8軸) で、SPS とは別系列のまま合算しない。資料欄は BOX からの移行準備中の表示のみ (リンク / iframe / 署名トークンなし) |
| `/auth/login` | ログイン。`audience` で内部 (`armada` = Google Workspace OAuth) と外部 (`institution` = メールリンク) を出し分ける。`?audience=institution` または `?workspace=` があれば外部入口として開く |
| `/auth/logout` | 統一ログアウト。`amd_os_workspace_session` と旧 `amd_os_project_session` の両cookieを消し、Supabase も `scope:'local'` でログアウトして `/auth/login` へ戻す |
| `/admin/access` | 外部アクセス権限の台帳 (内部admin限定)。外部アカウント、機関ワークスペース所属、PJ個別アクセスをここだけで付与・停止する。読み書きはすべて `/api/admin/workspace-access` 経由 |
| `/dashboard` | PJ 一覧と主要機能への入口。上部に `proactive_todos` 由来の先手TODOバッジを出し、詳細は `/proactive` に送る。左/mainカラム内は PJ 一覧 → 研究機関ECRリスト、下段全幅は Company Content shelf の順に表示する。AMD 全体PJ (`p00`) は上部バイタルサイン枠から `/project/p00/cockpit` へ入るため、通常PJ一覧には表示しない。研究機関エコシステム構築PJは通常PJ一覧ではなく研究機関ECRリスト側へ寄せる。左メニューのボードにマウスオーバーまたはフォーカスすると、全アクティブPJへのコックピットリンクを右側に出す。フライアウトはナビのスクロール領域でクリップされない上位レイヤーに出し、画面下端では一覧部分だけをスクロールする。`MyPageContent` / `CompanyContentShelf` は `next/dynamic({ ssr:false })` で分離バンドル化し、Company Content (メンバー/沿革/写真/メディア掲載) の fetch は初回 `Promise.allSettled` に含めず、`IntersectionObserver` (`rootMargin: "600px 0px"`) で shelf アンカーが viewport 600px 圏内に入ってから `fetchCompanyContentPreview` を1回だけ起動する遅延ロードにする (v3.44.8)。取得完了までプレースホルダ表示、失敗時は空データへ fallback しダッシュボード主表示をブロックしない |
| `/project/[projectId]/cockpit` | PJ cockpit。Status / AMD Score / XRL / MS / 資料 / 経営ハイライト / ガバナンス / 助成金 / 月次 / MTGサマリ。旧 `proactive_outbox` TODO は表示しない |
| `/project/[projectId]/workspace` | **同じURLの二面構成**。アクセス解決の後にどちらの面を出すかを決める。内部メンバー (`members` + PJ membership) には従来どおりの詳細バンドル (計画詳細、技術証明、論点、関係先、週次エフォート、編集導線) を出す。外部アカウントには、PJ名・状態、計画サイクル、マイルストーンの表題・目標年月・進捗率だけの読み取り専用DTOを出す。外部側は内部バンドルの取得経路を呼ばず、メンバー名、工数、根拠、出典、社内管理項目 (目的 / 成果 / 論点 / 仮説 / 意思決定 / 資金 / 関係先)、連絡先を含めない。外部アカウントが到達できるのは `project_access_memberships` の active 行が名指ししたPJだけで、機関ワークスペース所属では到達しない (p21 の詳細ワークスペースはこの個別付与のみ) |
| `/project/[projectId]/weekly-control` | 既存workspaceと分離した週次管制。先週差分、今週の判断、介入、論点・仮説の放置防止を扱う。差分抽出未接続は0件でなく `抽出接続待ち` |
| `/project/[projectId]/navigation` | 既存workspace/weekly-controlと分離したPJ管制ダッシュボード。重要経路を初期展開し、4本柱からマイルストーン・技術試験・論点・履歴へ掘る階層WBSガントと、共通7段階の関係先比較を表示する。工程、論点閉ループ、技術試験、関係先・保有事項を同じ画面で追加・更新できる。RSC境界へは`buildSxNavigationViewModel()`が作る最小view modelだけを渡し、`ProjectWorkspaceBundle`/`CurrentMemberAccess`全体はClient Componentへ渡さない |
| `/manual` | AMD OS マニュアル。使い方・運用者向け |
| `/spec` | 設計書。確定実装仕様。admin 限定 |
| `/bzm` | BZM テキストブック。理論・数式・rubric 導出 |
| `/bzm/map` | 理論マップ (論証台帳)。共有正本 `bzm_theory_nodes` / `bzm_theory_edges` を0件から本人が育てる。admin は空白クリックで作成、通常クリックで編集、通常ドラッグで配置変更、Cmd/Ctrl二点クリックで接続、線クリックで接続解除する。各panelはノードを覆わないマップ作業区画に表示し、memberは閲覧できる。旧Markdown 21ノード / 34関係は履歴資産で自動表示しない。件数・接続数は真偽・確信度を表さない。詳細契約は `/spec/2-6-bzm-theory-map-current-spec` |
| `/knowledge-map` | AMD Materials。高校生でも読める日本語で118元素を熱色・日本語主用途・供給警報から俯瞰し、元素の小窓で直近公表相場・5年推移・産出国円グラフを確認する。総合値は4指標合計（20点満点）で、周期表以外は合計の高い順。全材料横断の需給の崩れランキングは専用の偏りの強さ（5点満点）で並べ、不足側、供給過剰側、価格乱高下を区別し、原因、供給が詰まる工程、評価時点、確からしさを示す。全体の入口はカード全面で操作できる。元素・鉱物・樹脂は選択直後に要点の小窓を開き、詳細操作で同じ小窓を拡張する。樹脂の詳細では原料と製造方法も確認できる。比較、従来のノウハウ地図まで横断する読み取り専用の材料データベース |
| `/business-cards` | 名刺管理。スマホ撮影 / 写真選択 → Gemini OCR → 人の確認 → 1件以上のPJ紐付け → `business_cards` と D-3 `project_knowledge(category='people')` へ保存する。OCR結果は自動確定しない |
| `/native/business-cards` | iOS名刺タブ用のナビ無しnative shell。通常の月初合意overlayを重ねず、認証cookieつきWKWebViewから `/business-cards` と同じUI/APIを使う |
| `/poc` | PoC案件化。Seeds とPoC先を入力し、その掛け合わせからヒアリング論点、PoC条件、謝礼、契約、資金、収益分配を追う |
| `/venture-map/amd-score` | AMD Score 一覧 |
| `/project/[projectId]/cockpit?tab=score-detail` | PJ cockpit 内の AMD Score 詳細 |
| `/venture-map/amd-score/[projectId]` | 旧 AMD Score 詳細の互換 route。cockpit の `スコア詳細` へ redirect (`p99` デモを除く) |
| `/atlas` / `/atlas/*` | Atlas signal / story / divergence / map |
| `/admin/*` | 管理者向け台帳・設定・請求・支払・prompt |
| `/admin/japanese-culture-map` | 日本文化マップ。`jp_culture_items` の active 行を、admin layout gate 内でマインドマップ / 日本地図として読む。旧 `/japanese-culture-map` はこの route へ redirect |
| `/admin/management-knowledge` | 経営ノウハウ。事業化ルート、座組、価格、資金、法務論点などの再利用カードを保存する admin-only 台帳 |
| `/admin/private-wiki` | 裏wiki。人物単位の趣味・関係性メモを PJ 別に保存する admin-only 台帳 |
| `/notifications` | L2 candidate / feedback の採否 |
| `/proactive` | admin 限定の先手 TODO リスト。`proactive_todos` の open / blocked / done / dismissed を期限順に確認し、完了・ブロック・関係ないの3ボタンで処理する |
| `/management-score` | AMD Management Score |
| `/institutions` / `/institutions/*` | ECR / 研究機関評価 |

## API / cron の境界

- LLM を使う定期抽出は PWA / Vercel cron へ戻さない。subscription automation / Codex automation / outbox applier へ寄せる。
- PWA cron に残すのは、原則として LLM 非依存の同期・集計・通知系。
- `/api/report/generate` と `/api/monthly-report/edit-by-tsukuyomi` は従量課金の誤実行防止で410停止。`/api/cron/monthly-reports-backfill` は重い手動復旧 route のため定期実行しない。
- 入金・支払・freee 連携などの運用 API は、既存の admin auth / signed token / `CRON_SECRET` 境界を崩さない。
- `/api/finance/live-cash-balances` は KAGAMI 等の外部クライアント向け read-only route。`/management-score` と同じ `buildLiveMonthlyPlInputs` + `runMonthlyPlSimulation` を server-side で実行し、月次の `cashBalance` だけを返す。過去月に `category='cash_balance'` の実績がある場合は実績残高を優先し、未来月は live 予算残高を返す。レスポンスは `ym`, `cashBalance`, `budgetCashBalance`, `actualCashBalance`, `runwayMonths`, `source(actual|forecast)` に限定し、PJ別・固定費・報酬内訳は返さない。
- `/api/auth/email-start` は外部ユーザーのログインリンク送信。登録済みで、かつ失効していない所属がある場合だけメールを送る。登録の有無で応答の形も状態コードも変えない (メール列挙の防止)。ドメインで認可しない。
- `/api/admin/workspace-access` は `requireAdmin()` + `service_role` で外部アクセス台帳を読み書きする。`kind` (`account` / `institution_membership` / `project_membership`) を必須にし、汎用の upsert 経路を作らない。停止済み (suspended / revoked) の行は作成では復活せず、明示的な PATCH だけで戻る。機関ワークスペース所属の付与がPJアクセスを自動作成しない。`auth.users` の id は select も返却もしない。
- `/api/admin/private-wiki` は `requireAdmin()` + `service_role` で `private_wiki_entries` を list/create/update/archive する。browser client から直接書かせない。
- `/api/admin/management-knowledge` は `requireAdmin()` + `service_role` で `management_knowledge_entries` を list/create/update/archive する。browser client から直接書かせない。source_excerpt は短い根拠だけで、メール全文・議事録全文・資料全文を保存しない。
- `/tasks` 画面は廃止済み。`/api/tasks` は cockpit legacy kanban / H-1 互換のため残し、DB write は `service_role` 経由で、DELETE ではなく `active=false` を使う。通知 link は対象 PJ cockpit へ向ける。
- `/api/task-calendar/register-tasks` は H-1 が抽出した次アクションを `tasks` に自動登録し、担当者本人にだけ Slack DM nudge を送る。`CRON_SECRET` / `WORKFLOW_SECRET` または admin auth でのみ実行し、admin review queue は作らない。
- `/api/cron/governance-email-sweep` は D-14G の source sweep route。`CRON_SECRET` または admin auth でのみ実行し、`/admin/projects` の総会/役会フラグON PJに限定して Gmail を検索する。LLM定期cronではなく、source refs と `/api/governance/extract` への候補/確認済みhandoffを担う。
- `/api/guardrails/evaluate` は経営ガードレールのタグ照合 route。admin auth または `CRON_SECRET` でのみ実行し、`guardrail_cards.status='active'` と PJ / アクションタグを照合して `guardrail_matches` と `l2_notifications(l2_kind='guardrail_match')` を作る。LLMは使わず deterministic に評価する。
- `/api/cron/proactive-todo-extract` は先手 TODO の PWA non-LLM cron。開催済みMTG `next_actions[]`、7日以内の予定MTG準備、PJ `report_emails` から届く Gmail 期限つき依頼 (`email_action_request`) を `proactive_todos` に upsert する。Gmail API は読むが、Anthropic / OpenAI / Gemini 等の従量課金LLMは呼ばない。メール本文全文・URL・パスワードは保存しない。
- `/api/business-cards` は認証済み AMD メンバー向け。GET は名刺一覧とPJ候補、POST は画像を private Storage へ保存して DB prompt `business_card.ocr` で OCR し、必ず `needs_review` に止める。`PATCH /api/business-cards/[cardId]` だけが人の修正内容を `confirmed` にし、選択PJの `project_knowledge` へ安全な人物情報を同期する。
- `/api/business-cards/[cardId]/image` は private bucket の画像を認証済み AMD メンバーだけへ返す。ブラウザから Storage 公開URLを生成しない。PJナレッジへ email / phone / address / raw OCR / 画像を複製しない。

## 外部ワークスペースアクセス

migration 212 / 213 と対になる contract。両migrationは2026-08-01に本番適用済み。詳細設計は `pwa/design/institution_seed_project_model.md` §6。

| 項目 | contract |
|---|---|
| route | `/` / `/workspaces` / `/workspace/[slug]` / `/project/[projectId]/workspace` (外部面) / `/auth/login?audience=institution` / `/auth/logout` / `/admin/access` |
| API | `POST /api/auth/email-start` / `/auth/callback` / `GET/POST/PATCH /api/admin/workspace-access` |
| table (212 新設7件) | `workspace_user_accounts` / `institution_workspaces` / `institution_workspace_memberships` / `institution_workspace_project_scopes` / `institution_workspace_seed_scopes` / `project_access_memberships` / `workspace_access_audit_logs` |
| authority | 7テーブルとも RLS 有効・anon / 一般 authenticated のポリシーなし。admin (`is_admin()`) と service_role のみ |
| principal | 外部ユーザーの識別子はメールアドレスのみ。認可はアカウント登録・機関ワークスペース所属・PJ個別アクセスの3つの明示的な付与だけ |
| 暗黙付与の禁止 | 機関ワークスペース所属はPJアクセスを含意しない。ドメイン一致も認可の根拠にしない |
| session | email OTP → `signOut({scope:'local'})` → `amd_os_workspace_session` 署名cookie。毎リクエストで cookie 検証 + DB 再検証。失効は次のリクエストで即時反映 |
| failure mode | 未認可・不明slugは redirect せず not found。失敗時は常に閉じる側へ倒し、機関・PJの存在を漏らさない |
| 213 の閉鎖範囲 | `institutions` / `institution_assessments` / `projects` / `members` / `project_members` / `institution_projects` / `seed_projects` / `seeds` / `seed_funding` / `seed_news` / `seed_contact_log` / `seed_sps_assessments` / `value_plan_cycles` / `value_milestones` / `milestone_monthly_progress` の計15テーブルで anon read を撤去し、authenticated を `amd_os_is_member()` ゲートへ寄せる。write は `is_admin()` + service_role |
| scope (愛媛) | p30 は `ehime` ワークスペースへ `shared_surface='summary'` で登録 (サマリのみ、詳細ワークスペースは非共有)。p21 はPJ範囲に含めず個別付与のみ。シーズ範囲は `inst_ehime` 紐付け全件。公開一覧は現時点 `ehime` 1件 |
| 評価系列 | ECR は機関の縦並び (総合 + 8軸)、SPS はシーズごと。DTO 上も別プロパティで、合成スコア・相関・因果指標を作らない |
| 資料共有 | BOX からの移行は未実装。資料欄は移行準備中の表示のみで、リンク / iframe / 署名トークンのいずれも実装していない |
| audit | `workspace_access_audit_logs` にログイン要求・送信・成功・拒否・ログアウト・admin操作を記録する。メール本文、URL、トークン、未登録アドレスは残さない |
| validation | `test:workspace-access-scope` / `test:workspace-access-session` / `test:workspace-email-start-contract` / `test:workspace-next-path` / `test:external-project-workspace` / `test:workspace-access-admin` / `test:workspace-rls-closure` |

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
