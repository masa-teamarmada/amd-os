# AMD OS macOS 開発用対応台帳

最終更新: 2026-08-26

> **現行SPS override（2026-08-18）**: `amdScore` / `amdScoreDetail` / HUD / dashboard / cyberspaceのactive routeは`/api/hud/dashboard`の現行SPS DTOだけを読む。完全版組は`sps-ind-tier0-v1 / sps-ind-v1 / q-eval-v2 / rubric-v1.1 / p-ind-v1 / rubric-v1.1+ind-v1`。旧スコアrouteは退役表示へ収束し、`AMDOSRESTClient`が旧3テーブルの読取・更新・追加・upsert・削除を拒否する。下表の旧AMD Score記述は履歴であり非規範。

このファイルは開発・レビュー専用。ユーザー向けのmacOS画面、空状態、エラー、アクセシビリティ文言へ台帳の語彙を渡さない。
NativeScreenID、読取元、書込み先、権限、回帰確認を全件残し、実装していない行を削除しない。

PWA移植の判定正本は「1. PWA route → NativeScreenID」と `PWA_PARITY_EVIDENCE.md`。
下の iOS 履歴表は旧画面名を追えるように残すだけで、PWA移植の未達を表すものではない。
旧PWA `/tasks` や旧月次ルーティンを復活させることは禁止。

## 0. macOS配布入口（アプリアイコン）

| NativeScreenID / 配布物 | 読取元 | 書込み先 | 権限 | 状態 / 回帰確認 |
|---|---|---|---|---|
| アプリケーションアイコン `AppIcon` | PWA既存の公式mark `pwa/public/AMD_logo_mark.png` → `SupportingFiles/Brand/AMDLogo-master.png` | `Assets.xcassets/AppIcon.appiconset` のmacOS 1x/2x派生画像 | 全ユーザー | 発光・グラデーションを加えない公式markへ同期済み。最終bundleで `CFBundleIconName` と表示を確認する |

PWAロゴ正本をプロジェクト内へ同期し、AppIconの各サイズはそこから縮小生成する。

## 1. PWA route → NativeScreenID

| PWA route（全件） | NativeScreenID | 読取元 | 書込み先 | 権限 | 状態 / 回帰確認 |
|---|---|---|---|---|---|
| `/auth/login`, `/auth/callback` | `account` | Supabase Auth + 透過 `AMDLogoMark.imageset` | Supabase OAuth PKCE + PWA共有workspace access DTO | 本人 / PJ限定member | 実装済み。AppIconと同じAMDロゴmarkを白背景に表示。Google callbackはASWebAuthenticationSessionとSwiftUI `onOpenURL`の両方からPKCE sessionへ戻す。PWAと同じAMDメンバー / PJ限定の二入口を持ち、PJ限定時は通常OSではなくworkspaceだけを開く。実認証は未確認 |
| `/dashboard`, `/mypage` | `today`, `projects` | `projects`, iOS MyPage、認可済み通知配送結果 | 既存PJ安全API | member | 実装済み。PJ一覧と今日の確認件数。通知の直接テーブル取得はしない |
| `/my-projects`, `/project/[projectId]/workspace` | `myProjects`, `projectWorkspace` | PWA共有 `getCurrentMemberAccess` / `getProjectWorkspaceBundle` DTO | `POST /api/project-workspace/[projectId]/effort` | PJ限定member / portfolio member | **P0 Native 実装済み（テーマ進捗は未移植）**。参加設定済みPJのみの一覧、週次の予定/実績入力、メンバー別配分、MS、活動件数・source集計、6週推移をSwiftUIで実装。2026-08-26にPWAへ追加したp19の3テーマ（OkuDoor / 葛飾水素循環 / KR経営改革）、9成果目標の3/2/4接続、予定進行と確定進捗の区別、AMD内部のホーム/コックピット導線はNative未移植。PJ限定ユーザーは通常のSupabase table readを使わず共有DTOだけを読む。PWA実データでの確認・書込みは未実施 |
| `/project/[projectId]/cockpit`, `/project/[projectId]/config`, `/project/[projectId]/report/[ym]/print` | `projectCockpit`, `projectConfig`, `projectReportPrint` | Cockpit / `projects`, `ms_*`, `billing_cycles`, `project_meeting_summaries`、提出用月次集約 | PWA既存の進捗・月次ノート・報酬同期・MS修正・資料・会議・レポートAPI | member / APIごとの権限 | Native実装。`ym`/`tab`/`meeting`/`document` deep link (`tab=cost-model` = コスト試算)、PJ資料のDrive導線とMarkdown本文のPWA同一PATCH、助成金台帳への既存管理導線、戦略シグナルの修正履歴と `dialog/start → refine → confirm`、会議履歴の再読込・全件表示、`monthly-report-print`集約値をA4標準印刷で全章出力する。実認証・実書込み・実印刷は未確認 |
| `/notifications` | `notifications` | Codex審査済みかつまさ本人のaction contractが完全な`app_notifications`（直接再認証だけ例外）、`l2_notifications`の`attention_state='approved' AND requires_masa_decision=true`、各通知のPWA正本行、要対応API | `read_at` / `dismissed_at` のPWA同一RLS更新、`/api/action-items`、`/api/notifications/feedback` | admin | 実装済み。writerの宣言だけではOS通知へ出さず、L2もCodex審査済みのまさ判断だけ。`meeting_notifications`は会議記録として保持し、通知・未読数・判断キューへ混ぜない |
| `/reimburse` | `reimbursements` | `reimbursements`、active PJ、member role、private receipt Storage | `/api/reimbursements` の本人作成・更新・削除、PWA同一RLSのPM/admin承認 | member / PM / admin | 実装済み。submitted → PM承認 → admin承認、差戻し/却下、既存領収書の1時間署名URL、編集・削除確認を実装 |
| `/business-cards`, `/native/business-cards` | `businessCards` | private Storage + `/api/business-cards`、PJ候補 | `/api/business-cards` のOCR取込、`PATCH /api/business-cards/[cardId]`、private image API | member | 実装済み。検索・状態/PJ絞り込み、OCR/重複/信頼度確認、PJ複数選択、PWA同等の画像縮小・4MB制限・人確認後更新を実装 |
| `/monthly-agreement` | `monthlyAgreement` | `/api/monthly-work-agreement` snapshot、agreement / revision records | `/api/monthly-work-agreement/agree`、`/request-revision` | member | 実装済み。状態→担当する仕事→その対価としての予定額→参照情報→合意/修正要望を同じbundleとAPIで実装 |
| `/atlas`, `/atlas/admin/themes`, `/atlas/decisions`, `/atlas/divergence`, `/atlas/inbox`, `/atlas/inbox/submit`, `/atlas/macrotrends`, `/atlas/map` | `atlasHome`, `atlasThemes`, `atlasDecisions`, `atlasDivergence`, `atlasInbox`, `atlasInboxSubmit`, `atlasMacrotrends`, `atlasMap` | `atlas_*`, source refs | PWA既存の候補・採否・送信・theme API/RLS | member / admin API | 実装済み。PWAのrouteごとの一覧・詳細・絞り込み・採否・送信を対応Native画面へ接続。HUD aliasも同じ実装へ収束し、外部本文は保存しない。認証済み実読取・実書込みは未確認 |
| `/knowledge-map` | `materials` | `materials-data`, `knowledge-map-data` | なし（read-only） | member | 実装済み。PWA同じ118元素・材料台帳から全体/元素/鉱物/樹脂/知識マップ/比較、4軸・需給根拠・出典・比較trayを読取表示。実データ読取は未確認 |
| `/seeds`, `/seeds/[id]`, `/seeds/inbox` | `seeds`, `seed_projects`, `seed_funding`, `seed_news`, `seed_contact_log`, `members`, `projects`, `project_ventures` | `seeds`, `seed_funding`, `seed_news`, `seed_contact_log` | 既存RLS直書き + `/api/seeds/[seedId]/deep-dive` | member | **P0 Native 実装済み**。全175シーズを削らず1シーズ単位で表示し、PJ化済み→PJ化検討中→その他の順で並べる。機関・PI・PJ状態を同じ行に持ち、シーズ状態とAMD PJを分離。詳細、作成/編集/削除、資金・ニュース・接触履歴、深掘り、Inboxも維持。2026-08-19にPWAへ追加した明示的な事業化開始API、判断レール、MTG・資料室ワークベンチはNative未移植。認証済み実データの書込み操作は未実行 |
| `/poc` | `poc` | `poc_companies`, `poc_matches`, `seeds`, `projects`, `members` | PWA同一RLS直書き | member | **P0 Native 実装済み**。シーズ・PoC先・案件候補の検索/状態絞込/タグ絞込、PoC先とシーズの追加、既存の状態更新、シーズ×PoC先からの案件化、ヒアリング・謝礼・契約・資金・収益分配・担当/次アクションをPWAと同じテーブルと生成規則で実装。認証済み実データの書込み操作は未実行 |
| `/vcs`, `/vcs/[id]`, `/vcs/[id]/edit`, `/vcs/inbox` | `vcs` | `vcs`, `vc_funds`, `vc_investments`, `vc_contacts`, `project_vc_relations`, `vc_news` | PWA同一RLS直書き | member / admin API | 実装済み。VC一覧・詳細・編集・受信箱、基本情報（slug / ロゴURL / 備考 / AMD評価の値・メモ・更新者・時刻）、ファンド（クローズ日・DPE根拠）、出資先（紐づくファンド・出所・備考）、担当者・PJ接点・ニュース確認を同じデータ境界で実装。認証済み実データの書込み操作は未実行 |
| `/scholar` | `scholar` | `papers_log`（`lane, observed_at, paper_count, source`、時刻昇順・2000件） | なし（read-only） | member | 実装済み。PWA同じASPI 8領域、四半期集計、前年比、時系列・直近観測表をNativeで表示。認証済み実データ読取は未確認 |
| `/institutions`, `/institutions/[institutionId]`, `/institutions/[institutionId]/cockpit`, `/institutions/[institutionId]/regulations/[regulationId]`, `/institutions/assess` | `institutions` | `institution_*`, `institution_projects`, `projects` | assessment API / 既存PJ cockpit API / institution-regulations API | member read / regulation edit admin | PWA実装済み。契約前を含む48研究機関、ECR 8軸、関連PJ cockpit、月別MTGツリーに加え、全機関SU関連規程比較と機関別版管理を持つ。外部正本優先。規程比較・版管理はmacOS Native未移植 |
| `/venture-map`, `/venture-map/amd-score`, `/venture-map/amd-score/[projectId]`, `/venture-map/amd-score/retrofit`, `/venture-map/cyberspace`, `/venture-map/oscillator`, `/venture-map/state-space`, `/venture-map/su/[id]`, `/venture-map/timeline-3d` | `ventureMap`, `amdScore`, `ventureCyberspace`, `ventureOscillator`, `ventureStateSpace`, `ventureSuDetail`, `ventureTimeline3D` | `project_ventures`, `macro_index_log`, `papers_log`, `macro_lane_weights`, `amd_score_*`, `project_xrl_log` | PWA同一の `amd_score_inputs` upsert（`project_id,evaluated_at`）、`amd_score_alpha` RLS更新、つくよみ既存API | member / admin API | **Native実装済み（PWA source静的照合）**。View A-C、SPS/Legacy score・α再計算、Cyberspace、Coupled Oscillator、Triple Helix、SU deep link、XRLタイムラインをSwiftUI/Canvasへ移植。Cyberspace/TimelineはNativeの透視投影でPWAのISO/正投影preset、ドラッグ旋回、Option+ドラッグ平行移動、pinch/scrollズームを提供する。TimelineはPWA GizmoViewport相当の軸コントローラからも同じ4方向へ戻せる。SUは `project_id` 指定時に公開フラグで落とさない。XRL checklistは原典5軸・積み上げ判定・同じ評価行へのupsert・再読込/失敗表示まで実装。認証済み実データ読取・書込みは未確認 |
| `/admin`, `/admin/company`, `/admin/contexts`, `/admin/protocols`, `/admin/coverage-gaps`, `/admin/ip` | `adminHome`, `adminCompany`, `adminContexts`, `adminProtocols`, `adminCoverageGaps`, `adminIP` | admin台帳・prompt・coverage | 既存admin API / Edge Function | admin | 実装済み。AdminSidebarとNative入口の双方でadmin gateを通し、各routeは対応する実データ画面へ分岐する。個別の操作・実認証確認は下記行を正本にし、prompt本文をコードへ直書きしない |
| `/admin/invoices`, `/admin/billing` | `adminInvoices` | `billing_cycles`, `projects`, `reimbursements`, freee取引先 | invoice admin API / `issue-invoice` / `cancel-invoice` | admin | 実装済み。13か月キュー、全状態・フィルタ・並び順、請求月、freee取引先、preview・draft・発行・取消・再取得をPWAと同じ境界で実装。旧billingはinvoicesへredirect |
| `/admin/finance` | `adminFinance` | `company_payment_obligations`, `company_finance_recurring_items`, `company_finance_receipt_events`, officer reserve read model | finance admin API (`obligations` / `recurring` / `receipts`) | admin | 実装済み。PWA同一の集計・新規/編集・状態・支払済み・budget/actual同期・JST支払月の役員除外分を実装。金額不明を0円にしない |
| `/admin/payouts` | `adminPayouts` | reward cache, `payout_notices`, GAS PDF | PWA既存のpayout / PDF / notice mail / payment-confirm-nudge API | admin | 実装済み。PWA同一の報酬キャッシュ再計算、月次プレビュー、合意gate、正式PDF、通知メールの確認・編集・明示送信・送付取消、入金確認nudgeを既存APIへ委譲する。送付済みPDFは上書きせず、メール送信は画面内の「はい・送信」でのみ発火する。認証済み実書込みは未確認 |
| `/admin/contracts`, `/contracts` | `adminContracts` | contracts ledger / project contracts | contracts / documents / project mirror API | admin / member read | 実装済み。1契約1行、作成・全項目編集・状態・Drive metadata登録・GET dry-run・PWA同一フィルタ/並び順 |
| `/admin/projects` | `adminProjects` | `projects`、`project_ventures`、`lane_suggestions`、`project_members`、`members` | `/api/admin/projects/[id]`、`/api/admin/lane-suggestions/[id]`、既存 `projectConfig` のPJメンバー/請求経路 | admin | 実装済み。PWAと同じ検索・状態絞込・役割要約・管理fields・Slackなし・ガバナンス・月報/業務内容・ASPI lane/提案採否を実装。PJメンバーCRUDと基本契約/請求は既存 `projectConfig` を開く導線へ統合 |
| `/admin/members` | `adminMembers` | `members`、PJ限定アカウントの参加先は `project_members` | `/api/admin/members` のPOST/PATCH | admin | 実装済み。PWAと同じ在籍/権限/OS範囲/Calendar状態/最終ログイン/支払通知書属性の表示・編集、PJ限定アカウント作成を実装。口座情報は読み取り専用 |
| `/admin/governance`, `/company` | `adminGovernance` | company overview / equity / governance | `/api/governance`、`/api/grants`、`/api/action-items` | admin画面 / APIはmember | 実装済み。PWA同一のPJ選択、株主・ラウンド・会議・要対応・助成金の追加/削除を既存APIへ委譲。認証済み実書込みは未確認 |
| `/admin/coverage-gaps` | `adminCoverageGaps` | `l2_coverage_gaps` | なし（通知画面で採否） | admin | 実装済み。PWA同一の全列、candidate/precision/extractor-miss/structural/due-soon指標、通知への採否導線を実装。抽出実行や直接更新は提供しない。認証済み実データ読取は未確認 |
| `/admin/private-wiki` | `adminPrivateWiki` | `private_wiki_entries`、PJ候補 | `/api/admin/private-wiki` GET/POST/PATCH | admin | 実装済み。PWA同一の明示person fields、検索・PJ/人物種別/status絞り込み、PJ grouping、作成/編集/archiveをadmin APIで実装。admin_private固定の個人情報を外へ複製しない。認証済み実データ書込みは未確認 |
| `/admin/prompts` | `adminPrompts` | `llm_prompts`、active `tsukuyomi_context` | requireAdmin付き `/api/admin/prompts/[id]` PATCH | admin | 実装済み。prompt key一覧・本文/説明/model/max tokens/有効状態/notesの編集、active contextの読取を実装。PWA同様、promptの新規作成・削除は提供しない。認証済み実データ書込みは未確認 |
| `/admin/management-knowledge` | `adminManagementKnowledge` | `management_knowledge_entries`、PJ候補 | `/api/admin/management-knowledge` GET/POST/PATCH | admin | 実装済み。PWA同一の検索、PJ/category/maturity/tag/status絞り込み、全編集fields、作成・編集・archiveをadmin APIへ委譲。認証済み実書込みは未確認 |
| `/admin/monthly-work-agreements` | `adminMonthlyAgreements` | 月初合意bundle | `/api/admin/monthly-work-agreements` GET | admin | 実装済み。年月・member/PJ/status検索、7指標、hash/確認事項/修正要望/支払・stock、member別の月初合意・mypage native遷移を実装。認証済み実データ読取は未確認 |
| `/admin/schedule` | `adminSchedule` | schedule read model | schedule GET / rebuild / actions API | admin | 実装済み。PWA同一の期間再生成、カレンダー/運用一覧、category/PJ/owner/status絞り込み、詳細、完了・対象外・再開actionを実装。支払義務のactionと画面からの直接予定変更は許可しない。認証済み実データ書込みは未確認 |
| `/admin/ms-overview` | `adminMsOverview` | `value_milestones`, `milestone_responsibility` | 保存前検算付きadmin API | admin | 実装済み。PWA同一のMS/担当share/役割/タスク編集、POST保存前検算、blocked時の保存不可、PUT保存と支払差分・予算影響表示を実装。認証済み実書込みは未確認 |
| `/admin/settings` | `adminSettings` | `settings`、PWA operations catalog | `/api/admin/settings` CRUD + catalog DTO、`/api/settings/cron-run` | admin | 実装済み。PWA正本catalogのRaw/L2/Cron（source/input/outputを含む）と同一のkey/label/type/value/description作成・編集・削除、手動実行導線を実装。settings更新はrequireAdmin付き共有APIに集約。認証済み実データ書込みは未確認 |
| `/admin/tsukuyomi` | `adminTsukuyomi` | `tsukuyomi_context`、learning/status read model | `/api/admin/tsukuyomi/context` GET/POST/PATCH | admin | 実装済み。PWA同一のcontext検索・layer/status絞り込み、追加・編集・archive、learning/status読取を実装。学習投稿は対象外で、`/api/tsukuyomi/post` の501状態を維持。認証済み実データ書込みは未確認 |
| `/admin/season-pl` | `adminSeasonPl` | `computeSeasonPl`, reward cache | `/api/admin/season-pl` GET | admin | 実装済み。PWA同一のlist/detail検算、収入/配分・pt・member収束、member mypage native遷移を実装。認証済みdetail読取は未確認 |
| `/admin/weekly` | `adminWeekly` | `member_activities`, reward cache | `/api/admin/weekly` GET | admin | 実装済み。PWA同一の26週移動、PJ×member活動/報酬matrix、source URL、member mypage native遷移を実装。認証済み実データ読取は未確認 |
| `/hud`, `/hud/dashboard`, `/hud/dashboard/embed`, `/hud/notifications`, `/hud/project/[projectId]/cockpit`, `/hud/atlas/**`, `/hud/seeds/**`, `/hud/vcs/**`, `/hud/venture-map/amd-score/retrofit` | `hudDashboard` / routeごとの対応NativeScreenID | HUD snapshot、通知、Atlas、Seeds、VC、Score | dashboard/embedはPWA同一の匿名RLS read model。通知/Atlas/Seeds/VC/retrofitのaliasは対応するNative本体へ収束し、元routeの既存API/RLS操作を維持 | member（embedのみpublic、個別admin gateは元route準拠） | 実装済み。HUD dashboardはPWA同一の集約snapshot、embedは未ログインでも公開RLS read modelだけを読む。re-export aliasを静的HUDカードへ劣化させず、通知・Atlas・Seeds・VC・retrofitのNative実装へ渡す。認証済み実読取・実書込みは未確認 |
| `/manual`, `/manual/[slug]` | `manual` | PWA manual markdown | manual Q&A API（read-only） | member | 実装済み。PWAと同じ章順/番号、テーマ、全章本文検索、章本文・manual内リンク、前後章、ページ限定つくよみを実装。実データ読取は未確認 |
| `/spec`, `/spec/[slug]` | `spec`, `specDetail` | PWA spec Markdown正本 | read-only document bridge | admin | 実装済み。PWA同一のsection/番号/章group、本文、前後章を表示し、Native入口とbridgeの双方でnonadminを拒否。認証済み実読取は未確認 |
| `/bzm`, `/bzm/[slug]`, `/bzm/public`, `/bzm/public/[slug]` | `bzm`, `bzmDetail`, `bzmPublic`, `bzmPublicDetail` | bundled BZM Markdown正本 | read-only document bridge | 通常版member / 公開版public | 実装済み。通常版はmember境界を維持し、章/part/未着手stub/前後章をNative表示。公開版はPWA・Macとも未ログインで公開原稿のpart/章/前後章を読める。実読取は未確認 |
| `/japanese-culture-map`, `/admin/japanese-culture-map` | `adminCultureMap` | active `jp_culture_items` | read-only | admin | 実装済み。旧routeはPWA同様admin文化マップへ収束し、一般Explore navから除外。カテゴリtree・都道府県→市区町村geography・詳細（画像/link）を表示。認証済み実読取は未確認 |
| `/dashboard-cyber-3d-lab`, `/dashboard-cyber-glass-cube`, `/dashboard-cyber-hud-wall` | `cyber3DLab`, `cyberGlassCube`, `cyberHudWall` | PWA同一HUD PJ信号 | read-only `/api/hud/dashboard` | member | 実装済み。3D Lab / Glass Cube / HUD Wallを、実PJ HUD dataの選択可能Native Canvas/Cube/Wallとして表示。認証済み実読取は未確認 |
| `/proactive` | `proactive` | `proactive_todos`の`attention_state='approved' AND attention_type IN ('decision','masa_action')`、`projects` | done/block/dismissは既存`/api/proactive-todos/[id]/resolve`、reopenはPWA同一RLS PATCH | admin | 実装済み。未対応・ブロック中はCodex審査済みのまさ判断/本人行動だけ。`due_basis='explicit'`だけを期限超過・red扱いし、MTG prepはOSへ複製しない。履歴tab、解決操作、PJ cockpit deep linkは維持 |

## 2. PWA重要UI登録簿 → NativeScreenID

| FEATURE_REGISTRY | NativeScreenID | 回帰確認 |
|---|---|---|
| `/manual` | `manual` | 実装済み。章検索・本文・ページ限定つくよみを保持。実データ読取は未確認 |
| `/knowledge-map` | `materials` | 実装済み。118元素、材料レンズ、比較tray、read-only。実データ読取は未確認 |
| `/business-cards` | `businessCards` | file / drop / paste、OCR review、PJ複数選択、private境界 |
| `/poc` | `poc` | Seeds→PoC先→案件化キュー |
| `/admin/japanese-culture-map` | `adminCultureMap` | admin-only、一般資料ナビへ戻さない。tree / geography / detail |
| `/admin/* shell` | `adminHome` | AdminSidebar単一化、二重ナビ禁止 |
| `/admin/contracts` | `adminContracts` | 1契約1行、PJ/契約列固定、条件モーダル |
| `/admin/invoices` | `adminInvoices` | 発行前チェック、issue-invoice、旧billing redirect |
| `/monthly-agreement` | `monthlyAgreement` | 状態→担当→予定額→合意、320/375/768/1280幅 |
| `/admin/finance` | `adminFinance` | 支払義務、追加流出、exact-once通知 |
| `/admin/payouts` | `adminPayouts` | reward cache、支払通知PDF、税区分、送付境界 |
| `/admin/kiyo` | `adminFinance` | read-only、active PJ、keiri証跡境界 |
| `/admin/season-pl` | `adminSeasonPl` | closes、unassignedPt、budgetMatchesMonthlyCaps |
| `/admin/ms-overview` | `adminMsOverview` | MS編集、plannedShare、保存前検算、blocked保存不可 |
| `/admin/private-wiki` | `adminPrivateWiki` | explicit person fields、admin_private、tags非復活 |
| `/admin/management-knowledge` | `adminManagementKnowledge` | maturity、source_excerpt、admin-only |
| `/dashboard` | `today` | proactive badge、ECR list、company shelf、旧routine非復活 |
| `/tasks (deprecated)` | `today` | route/nav/helperを復活させない |
| `/project/[projectId]/cockpit` | `projectCockpit` | PWA同一APIのMS/月次/MTG/資料、`document` deep link、資料Markdown更新、助成金台帳への管理導線、戦略シグナルの対話型修正依頼と履歴 |
| `/project/[projectId]/cockpit?tab=cost-model`, `/project/[projectId]/workspace#cost-model` | 未割当 | コスト試算タブ (2026-08-23追加、全PJ常設)。`project_cost_models` / `_assumptions` / `_items` / `_questions` を読み、前提から4シナリオをクライアントで再計算する。想定系・CAPEX/OPEX内訳・成立ライン・確度別内訳を1画面で出す。PWA/ワークスペース共通コンポーネント。macOS Native未移植 |
| `株主・ガバナンス + 要対応` | `adminGovernance` | 会社概要タブ、cap table、action items、全member権限 |
| `/admin/schedule` | `adminSchedule` | 年間レール、元正本再生成、手入力禁止 |

## 3. iOS画面 → NativeScreenID（履歴参照。PWA対応の判定対象外）

この表の「旧iOS固有」は、現行PWAに同名 route / workflow がないため移植対象外という意味。
現行PWAと重なるものは、上のPWA route表で対応するSwiftUI実装を確認する。

| iOS画面 / 機能 | NativeScreenID | 状態 |
|---|---|---|
| `MainTabView`, `MyPageView`, `ProjectRewardCard` | `today` | 実装済み / ネイティブ再構成 |
| `CockpitView`, `CockpitDetailView`, `MonthlyModal` | `projects`, `projectDetail` | 旧iOS画面名。現行PWA相当は `projectCockpit` / `projectReportPrint` のNative実装を正本とする |
| `CockpitHUDView` | `hudDashboard`, `hudProjectCockpit` | 実装済み。PWA HUD dashboard / PJ cockpitの実データ表示・deep linkへ再構成。認証済み実読取は未確認 |
| `NotificationInboxView`, `NotificationJudgmentCard` | `notifications` | 旧iOS画面名。現行PWA通知Native実装を正本とする |
| `RegistrationHubView`, `ReimburseListView`, `ReimburseFormView` | `reimbursements` | 旧iOS画面名。現行PWA立替Native実装を正本とする |
| `BusinessCardsView` | `businessCards` | 旧iOS画面名。現行PWAのOCR / PJ複数選択を含むNative実装を正本とする |
| `RoutineFlowView`, `BudgetStepView`, `InvoiceStepView`, `MeetingStepView`, `ReportFixStepView` | `monthlyAgreement`, `adminInvoices`, `projectDetail` | 旧月次ルーティンは復活させず、現行の合意・月次詳細へ分割 |
| `AdminTabView`, `MemberListView` | `adminHome`, `adminMembers` | 旧iOS画面名。現行PWA admin Native実装を正本とする |
| `BillingMatrixView`, `BudgetApprovalView` | `adminPayouts`, `adminFinance` | 旧iOS固有。現行PWAの支払 / 財務は上段のNative実装で対応 |
| `PayoutNoticePerMemberView` | `adminPayouts` | 支払PDFの安全経路を維持 |
| `ProposalInboxView`, `ProposalComposeSheet`, `ProposalThreadView` | `adminHome`, `today` | 旧iOS固有。現行PWA routeなし |
| `TsukuyomiLearningsView`, `TsukuyomiView` | `adminHome`, `manual` | 旧iOS固有。現行PWAの `adminTsukuyomi` / manual Native実装を正本とする |
| `SettingsView`, `PayoutInfoEditView` | `account` | 旧iOS画面名。現行PWA account Native実装を正本とする |
| `TextbookReaderView` | `bzm` | 旧iOS画面名。現行PWA BZM document reader Native実装を正本とする |
| `ScoreDetailWebView` | `amdScore` | 旧iOS WebViewは移植しない。現行PWA score detailのSwiftUI実装を正本とする |

## 4. 権限・書込み境界

| 操作 | Macの扱い | 正本経路 |
|---|---|---|
| Googleログイン | PKCEで認証セッションを取得 | Supabase Auth |
| 通知の判断・コメント | Macから任意DB更新しない | `/api/notifications/feedback` /既存安全API |
| OCR候補の確定 | 氏名とPJを人が確認してから | `PATCH /api/business-cards/[cardId]` |
| MS進捗・設計 | 保存前検算を通す | 既存PWA admin API / Edge Function |
| 支払・請求・管理台帳 | admin gate + 既存API | PWA API / Edge Function / GAS |
| 教科書・材料・HUD | read-only | bundled markdown / read model |

PWAへ委譲する確認導線はSwiftUI `Link`で保持する。通常クリックは既定ブラウザで開き、Commandクリックは既定ブラウザの新しいタブへ開くmacOS標準操作に委譲する。
