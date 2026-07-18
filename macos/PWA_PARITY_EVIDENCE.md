# PWA → macOS Swift 実装・実データ確認帳票

最終更新: 2026-07-19

この帳票は、PWAのsource route/API/componentと、独立SwiftUI macOS側の実装および認証済み実データ確認を突き合わせるための開発証跡。
画面には表示しない。`Swift実装` と `実データ確認` は、generic画面・外部リンク・mockだけでは完了にしない。

## 判定

| 記号 | 意味 |
|---|---|
| `未確認` | Swift画面、実データ、代表書込みの証拠がまだ揃っていない |
| `実装済み` | route固有のSwiftUI画面と現行PWA API/Edge Function境界を実装済み |
| `確認済み` | 認証済み実データでloading/empty/error/権限拒否と代表導線を確認済み |

## PWA source page 110件の正本一覧

以下は `pwa/src/app/**/page.tsx` の全110件を、source file単位で数えた一覧。alias / mock / HUD mirrorも省略しない。`未確認` はそのsource pageの固有UI・導線・実データ・代表更新をまだ完了と扱わない意味。

| source page | canonical path | NativeScreenID | 状態 |
|---|---|---|---|
| `page.tsx` | `/` | `today` | 未確認 |
| `(app)/admin/billing/page.tsx` | `/admin/billing` | `adminBilling` | 未確認 |
| `(app)/admin/company/page.tsx` | `/admin/company` | `adminCompany` | 実装済み・読み取り確認済み（4 query = 200、2026-07-18） |
| `(app)/admin/contexts/page.tsx` | `/admin/contexts` | `adminContexts` | 実装済み・読み取り確認済み（query = 200、2026-07-18） |
| `(app)/admin/contracts/page.tsx` | `/admin/contracts` | `adminContracts` | 未確認 |
| `(app)/admin/coverage-gaps/page.tsx` | `/admin/coverage-gaps` | `adminCoverageGaps` | 実装済み（Native静的確認。PWA同一の全列・5指標・通知採否導線、認証済み実データ読取は未確認） |
| `(app)/admin/finance/page.tsx` | `/admin/finance` | `adminFinance` | 未確認 |
| `(app)/admin/governance/page.tsx` | `/admin/governance` | `adminGovernance` | 実装済み（Native静的確認。PWA既存APIで株主/ラウンド/会議/要対応/助成金の追加・削除、認証済み実書込みは未確認） |
| `(app)/admin/invoices/page.tsx` | `/admin/invoices` | `adminInvoices` | 未確認 |
| `(app)/admin/ip/page.tsx` | `/admin/ip` | `adminIP` | 実装済み・読み取り確認済み（production bridge = 200、2026-07-18） |
| `(app)/admin/japanese-culture-map/page.tsx` | `/admin/japanese-culture-map` | `adminCultureMap` | 実装済み・読み取り確認済み（query = 200、2026-07-18） |
| `(app)/admin/management-knowledge/page.tsx` | `/admin/management-knowledge` | `adminManagementKnowledge` | 実装済み（Native静的確認。PWA同一の全編集fields、検索/絞り込み、作成・編集・archive。認証済み実書込みは未確認） |
| `(app)/admin/members/page.tsx` | `/admin/members` | `adminMembers` | 未確認 |
| `(app)/admin/monthly-work-agreements/page.tsx` | `/admin/monthly-work-agreements` | `adminMonthlyAgreements` | 実装済み（Native静的確認。年月・検索・7指標・詳細値・月初合意/mypage native遷移、認証済み実データ読取は未確認） |
| `(app)/admin/ms-overview/page.tsx` | `/admin/ms-overview` | `adminMsOverview` | 実装済み（Native静的確認。PWA同一のMS編集、POST検算→blocked保存不可→PUT保存、認証済み実書込みは未確認） |
| `(app)/admin/payouts/page.tsx` | `/admin/payouts` | `adminPayouts` | 未確認 |
| `(app)/admin/private-wiki/page.tsx` | `/admin/private-wiki` | `adminPrivateWiki` | 実装済み |
| `(app)/admin/projects/page.tsx` | `/admin/projects` | `adminProjects` | 未確認 |
| `(app)/admin/prompts/page.tsx` | `/admin/prompts` | `adminPrompts` | 実装済み |
| `(app)/admin/protocols/page.tsx` | `/admin/protocols` | `adminProtocols` | 未確認 |
| `(app)/admin/schedule/page.tsx` | `/admin/schedule` | `adminSchedule` | 実装済み |
| `(app)/admin/season-pl/page.tsx` | `/admin/season-pl` | `adminSeasonPL` | 実装済み（詳細payloadの実データ再確認はsession refresh後） |
| `(app)/admin/settings/page.tsx` | `/admin/settings` | `adminSettings` | 実装済み |
| `(app)/admin/tsukuyomi/page.tsx` | `/admin/tsukuyomi` | `adminTsukuyomi` | 実装済み |
| `(app)/admin/weekly/page.tsx` | `/admin/weekly` | `adminWeekly` | 実装済み・読み取り確認済み（PWA API shape/実データ = 200、2026-07-18） |
| `(app)/atlas/page.tsx` | `/atlas` | `atlasHome` | 未確認 |
| `(app)/atlas/admin/themes/page.tsx` | `/atlas/admin/themes` | `atlasThemes` | 未確認 |
| `(app)/atlas/decisions/page.tsx` | `/atlas/decisions` | `atlasDecisions` | 未確認 |
| `(app)/atlas/divergence/page.tsx` | `/atlas/divergence` | `atlasDivergence` | 未確認 |
| `(app)/atlas/inbox/page.tsx` | `/atlas/inbox` | `atlasInbox` | 未確認 |
| `(app)/atlas/inbox/submit/page.tsx` | `/atlas/inbox/submit` | `atlasInboxSubmit` | 未確認 |
| `(app)/atlas/macrotrends/page.tsx` | `/atlas/macrotrends` | `atlasDivergence` (PWA redirect) | 未確認 |
| `(app)/atlas/map/page.tsx` | `/atlas/map` | `atlasMap` | 未確認 |
| `(app)/business-cards/page.tsx` | `/business-cards` | `businessCards` | 未確認 |
| `(app)/bzm/page.tsx` | `/bzm` | `bzm` | 実装済み（member gate、PWA Markdown正本のchapter/part/未着手stub/前後章。Native静的確認、実読取未確認） |
| `(app)/bzm/[slug]/page.tsx` | `/bzm/[slug]` | `bzmDetail` | 実装済み（同じchapter本文とslug deep link。Native静的確認、実読取未確認） |
| `(app)/bzm/public/page.tsx` | `/bzm/public` | `bzmPublic` | 実装済み（PWA/Macとも未ログイン可。公開原稿のpart/章へ収束、Native静的確認） |
| `(app)/bzm/public/[slug]/page.tsx` | `/bzm/public/[slug]` | `bzmPublicDetail` | 実装済み（未ログインのslug deep link、公開Markdown本文と前後章。Native静的確認） |
| `(app)/company/page.tsx` | `/company` | `company` | 未確認 |
| `(app)/contracts/page.tsx` | `/contracts` | `adminContracts` (PWA redirect) | 未確認 |
| `(app)/dashboard/page.tsx` | `/dashboard` | `today` | 未確認 |
| `(app)/dashboard-cyber-3d-lab/page.tsx` | `/dashboard-cyber-3d-lab` | `cyber3DLab` | 実装済み（PWA同じHUD PJ信号を選択可能Native Canvasで表示。Native静的確認、実読取未確認） |
| `(app)/dashboard-cyber-glass-cube/page.tsx` | `/dashboard-cyber-glass-cube` | `cyberGlassCube` | 実装済み（PWA同じPJ選択/KPIをNative Cubeで表示。Native静的確認、実読取未確認） |
| `(app)/dashboard-cyber-hud-wall/page.tsx` | `/dashboard-cyber-hud-wall` | `cyberHudWall` | 実装済み（PWA同じPJ選択・status/monthly/signalをNative Wallで表示。Native静的確認、実読取未確認） |
| `(app)/hud/page.tsx` | `/hud` | `hudDashboard` | 実装済み（PWA redirect先のHUD dashboardへ収束。Native静的確認、実読取未確認） |
| `(app)/hud/dashboard/page.tsx` | `/hud/dashboard` | `hudDashboard` | 実装済み（PWA同じ認証済みHUD snapshot。Native静的確認、実読取未確認） |
| `hud/dashboard/embed/page.tsx` | `/hud/dashboard/embed` | `hudEmbedDashboard` | 実装済み（PWA同様、未ログインではprojects/billing_cycles/monthly_reportsのRLS read modelだけを表示。Native静的確認） |
| `(app)/hud/notifications/page.tsx` | `/hud/notifications` | `hudNotifications` | 実装済み（PWA re-exportと同じ通知Native実装へ接続し、操作をHUD read-onlyへ落とさない。Native静的確認） |
| `(app)/hud/project/[projectId]/cockpit/page.tsx` | `/hud/project/[projectId]/cockpit` | `hudProjectCockpit` | 実装済み（PWAのPJ/ym deep linkをNative cockpit文脈へ渡す。Native静的確認、実読取未確認） |
| `(app)/hud/atlas/page.tsx` | `/hud/atlas` | `hudAtlas` | 実装済み（PWA re-exportと同じAtlas homeへ接続。Native静的確認） |
| `(app)/hud/atlas/admin/themes/page.tsx` | `/hud/atlas/admin/themes` | `atlasThemes` | 実装済み（PWA re-exportと同じadmin theme画面・gateへ接続。Native静的確認） |
| `(app)/hud/atlas/decisions/page.tsx` | `/hud/atlas/decisions` | `atlasDecisions` | 実装済み（PWA re-exportと同じAtlas判断操作を維持。Native静的確認） |
| `(app)/hud/atlas/divergence/page.tsx` | `/hud/atlas/divergence` | `atlasDivergence` | 実装済み（PWA re-exportと同じAtlas乖離操作を維持。Native静的確認） |
| `(app)/hud/atlas/inbox/page.tsx` | `/hud/atlas/inbox` | `atlasInbox` | 実装済み（PWA re-exportと同じInbox採否操作を維持。Native静的確認） |
| `(app)/hud/atlas/inbox/submit/page.tsx` | `/hud/atlas/inbox/submit` | `atlasInboxSubmit` | 実装済み（PWA re-exportと同じsignal送信を維持。Native静的確認） |
| `(app)/hud/atlas/macrotrends/page.tsx` | `/hud/atlas/macrotrends` | `atlasMacrotrends` | 実装済み（PWA固有macrotrends read modelをNativeへ移植。Native静的確認、実読取未確認） |
| `(app)/hud/atlas/map/page.tsx` | `/hud/atlas/map` | `atlasMap` | 実装済み（PWA re-exportと同じAtlas mapを維持。Native静的確認） |
| `(app)/hud/seeds/page.tsx` | `/hud/seeds` | `hudSeeds` | 実装済み（PWA re-exportと同じSeeds一覧/操作を維持。Native静的確認） |
| `(app)/hud/seeds/[id]/page.tsx` | `/hud/seeds/[id]` | `seedDetail` | 実装済み（PWA re-exportと同じSeed detail deep link/操作を維持。Native静的確認） |
| `(app)/hud/seeds/inbox/page.tsx` | `/hud/seeds/inbox` | `seedInbox` | 実装済み（PWA re-exportと同じSeed Inbox採否操作を維持。Native静的確認） |
| `(app)/hud/vcs/page.tsx` | `/hud/vcs` | `hudVcs` | 実装済み（PWA re-exportと同じVC一覧/操作を維持。Native静的確認） |
| `(app)/hud/vcs/[id]/page.tsx` | `/hud/vcs/[id]` | `vcDetail` | 実装済み（PWA re-exportと同じVC detail deep linkを維持。Native静的確認） |
| `(app)/hud/vcs/[id]/edit/page.tsx` | `/hud/vcs/[id]/edit` | `vcEdit` | 実装済み（PWA re-exportと同じVC編集を維持。Native静的確認） |
| `(app)/hud/vcs/inbox/page.tsx` | `/hud/vcs/inbox` | `vcInbox` | 実装済み（PWA re-exportと同じVC Inbox採否操作を維持。Native静的確認） |
| `(app)/hud/venture-map/amd-score/retrofit/page.tsx` | `/hud/venture-map/amd-score/retrofit` | `hudAmdScoreRetrofit` | 実装済み（PWA re-exportと同じ既存認可済みScore refreshを維持。Native静的確認） |
| `(app)/institutions/page.tsx` | `/institutions` | `institutions` | 実装済み（PWA固定KUTE/NIMS対応、実データ読取は未確認） |
| `(app)/institutions/[institutionId]/page.tsx` | `/institutions/[institutionId]` | `institutionDetail` | 実装済み（ECR詳細、実データ読取は未確認） |
| `(app)/institutions/[institutionId]/cockpit/page.tsx` | `/institutions/[institutionId]/cockpit` | `institutionCockpit` | 実装済み（実PJ cockpit・月別MTGツリー、実データ読取は未確認） |
| `(app)/institutions/assess/page.tsx` | `/institutions/assess` | `institutionAssess` | 実装済み（ECR 8軸、実データ読取は未確認） |
| `(app)/japanese-culture-map/page.tsx` | `/japanese-culture-map` | `adminCultureMap` (PWA redirect) | 実装済み（PWA redirect先と同じadminCultureMapへ収束。一般Explore navには出さない。Native静的確認） |
| `(app)/knowledge-map/page.tsx` | `/knowledge-map` | `knowledgeMap` | 実装済み（Native静的確認、実データ読取は未確認） |
| `(app)/management-score/page.tsx` | `/management-score` | `managementScore` | 未確認 |
| `(app)/manual/page.tsx` | `/manual` | `manual` | 実装済み（Native静的確認、実データ読取は未確認） |
| `(app)/manual/[slug]/page.tsx` | `/manual/[slug]` | `manualDetail` | 実装済み（Native静的確認、実データ読取は未確認） |
| `(app)/monthly-agreement/page.tsx` | `/monthly-agreement` | `monthlyAgreement` | 未確認 |
| `(app)/mypage/page.tsx` | `/mypage` | `mypage` | 未確認 |
| `(app)/my-projects/page.tsx` | `/my-projects` | `myProjects` | 実装済み（参加PJ限定DTO、実データ読取は未確認） |
| `(app)/native/business-cards/page.tsx` | `/native/business-cards` | `nativeBusinessCards` | 未確認 |
| `(app)/notifications/page.tsx` | `/notifications` | `notifications` | 未確認 |
| `(app)/poc/page.tsx` | `/poc` | `poc` | 実装済み（PWAと同じRLSテーブル、検索/絞込、PoC先・シーズ追加、案件化、既存状態更新） |
| `(app)/proactive/page.tsx` | `/proactive` | `proactive` | 実装済み（admin gate、open/blocked/done/dismissed、期限/種別/detail、resolve API、PWA同一RLS reopen、cockpit deep link。Native静的確認、実書込み未確認） |
| `(app)/project/[projectId]/cockpit/page.tsx` | `/project/[projectId]/cockpit` | `projectCockpit` | 実装済み（PWA実データ/API静的照合。`ym`/`tab`/`meeting`/`document`、資料Upload/Markdown読取・更新、進捗・月次・会議・報告操作、戦略シグナルの履歴/対話型修正をNativeへ接続。実認証・実書込みは未確認） |
| `(app)/project/[projectId]/config/page.tsx` | `/project/[projectId]/config` | `projectConfig` | 未確認 |
| `(app)/project/[projectId]/report/[ym]/print/page.tsx` | `/project/[projectId]/report/[ym]/print` | `projectReportPrint` | 実装済み（admin gateと既存`monthly-report-print`集約API、生成/FIX、PWA印刷章立てをA4 native printへ接続。実認証・実印刷は未確認） |
| `(app)/project/[projectId]/workspace/page.tsx` | `/project/[projectId]/workspace` | `projectWorkspace` | 実装済み（PWA共有DTO / effort API、実データ読取・書込みは未確認） |
| `(app)/reimburse/page.tsx` | `/reimburse` | `reimbursements` | 未確認 |
| `(app)/scholar/page.tsx` | `/scholar` | `scholar` | 実装済み（`papers_log` のPWA同一select/order/limit、ASPI8領域・四半期/YoY/時系列。認証済み実データ読取は未確認） |
| `(app)/seeds/page.tsx` | `/seeds` | `seeds` | 未確認 |
| `(app)/seeds/[id]/page.tsx` | `/seeds/[id]` | `seedDetail` | 未確認 |
| `(app)/seeds/inbox/page.tsx` | `/seeds/inbox` | `seedInbox` | 未確認 |
| `(app)/spec/page.tsx` | `/spec` | `spec` | 実装済み（PWA同じsection/番号/章group/本文nav。Native/bridge双方のadmin gate。Native静的確認、実読取未確認） |
| `(app)/spec/[slug]/page.tsx` | `/spec/[slug]` | `specDetail` | 実装済み（PWA同じslug本文/前後章。Native/bridge双方のadmin gate。Native静的確認、実読取未確認） |
| `(app)/vcs/page.tsx` | `/vcs` | `vcs` | 未確認 |
| `(app)/vcs/[id]/page.tsx` | `/vcs/[id]` | `vcDetail` | 未確認 |
| `(app)/vcs/[id]/edit/page.tsx` | `/vcs/[id]/edit` | `vcEdit` | 未確認 |
| `(app)/vcs/inbox/page.tsx` | `/vcs/inbox` | `vcInbox` | 未確認 |
| `(app)/venture-map/page.tsx` | `/venture-map` | `ventureMap` | 実装済み（PWA基準SERIES + policy/NOW、同じログ上書き・公開SU deep link・View B/C。認証済み実データ読取は未確認） |
| `(app)/venture-map/amd-score/page.tsx` | `/venture-map/amd-score` | `amdScore` | 実装済み（public venture + active α + latest input、SPS/Legacy並び替え。認証済み実データ読取は未確認） |
| `(app)/venture-map/amd-score/[projectId]/page.tsx` | `/venture-map/amd-score/[projectId]` | `amdScoreDetail` | 実装済み（SPS P/R_net保存、評価時系列、根拠、つくよみ修正導線、XRL checklistの原典項目・積み上げ判定・同じ評価行へのupsert・再読込/失敗表示。認証済み実書込みは未確認） |
| `(app)/venture-map/amd-score/retrofit/page.tsx` | `/venture-map/amd-score/retrofit` | `amdScoreRetrofit` | 実装済み（全PJ Legacy αシミュレーション、現役α close + 新規行insert。認証済み実書込みは未確認） |
| `(app)/venture-map/cyberspace/page.tsx` | `/venture-map/cyberspace` | `ventureCyberspace` | 実装済み（PWA同じscore/log座標・選択・AMD Score詳細遷移。Native透視投影でISO/M×X/X×F/M×F preset、ドラッグ旋回、Option+ドラッグ平行移動、pinch/scrollズーム） |
| `(app)/venture-map/oscillator/page.tsx` | `/venture-map/oscillator` | `ventureOscillator` | 実装済み（PWA同じ6ノード・Velocity Verlet・11イベント・年月ジャンプ。ローカルモデル） |
| `(app)/venture-map/state-space/page.tsx` | `/venture-map/state-space` | `ventureStateSpace` | 実装済み（PWA現行Triple Helixの3状態/6観測/3外生入力、seed、ショック、A行列編集、安定判定。ローカルモデル） |
| `(app)/venture-map/su/[id]/page.tsx` | `/venture-map/su/[id]` | `ventureSuDetail` | 実装済み（target `project_id` を公開flagで絞らず取得、同じXRL/macro/マイルストーン。認証済み実データ読取は未確認） |
| `(app)/venture-map/timeline-3d/page.tsx` | `/venture-map/timeline-3d` | `ventureTimeline3D` | 実装済み（public venture IDsに限定したXRL、TRL/BRL/HRL/GRL/SRL積層、milestone、SU詳細遷移。Native透視投影で3D/T×SCORE/SU×SCORE/T×SU preset、PWA GizmoViewport相当の軸コントローラ、ドラッグ旋回、Option+ドラッグ平行移動、pinch/scrollズーム） |
| `auth/login/page.tsx` | `/auth/login` | `account` | 未確認 |
| `mock/dashboard-cyber-3d-lab/page.tsx` | `/mock/dashboard-cyber-3d-lab` | `cyber3DLab` | 実装済み（PWA mock aliasと同じNative 3D Labへ収束。Native静的確認） |
| `mock/dashboard-cyber-glass-cube/page.tsx` | `/mock/dashboard-cyber-glass-cube` | `cyberGlassCube` | 実装済み（PWA mock aliasと同じNative Glass Cubeへ収束。Native静的確認） |
| `mock/dashboard-cyber-hud-wall/page.tsx` | `/mock/dashboard-cyber-hud-wall` | `cyberHudWall` | 実装済み（PWA mock aliasと同じNative HUD Wallへ収束。Native静的確認） |
| `payment-confirm/page.tsx` | `/payment-confirm` | `paymentConfirm` | 未確認 |

## 全PWA画面 route

| PWA route | Swift NativeScreenID | 読み取り / 権限 | 書き込み境界 | Swift実装 | 実データ確認 |
|---|---|---|---|---|---|
| `/auth/login`, `/auth/callback` | `account` | Supabase Auth / 本人 | Supabase OAuth PKCE | 未確認 | 未確認 |
| `/payment-confirm` | `paymentConfirm` | signed token（PWAと同じ公開確認導線。MacでもGoogleログイン不要） | `POST /api/admin/payment-confirm` に実額・メモ・signed token を送る | 未確認 | 未確認 |
| `/dashboard` | `today` | projects, management score, ECR, proactive / member・admin | 既存PJ/API・proactive API | 未確認 | 未確認 |
| `/mypage` | `mypage` | member activity, monthly reward / member | weekly refresh API | 未確認 | 未確認 |
| `/my-projects` | `myProjects` | PWA workspace access DTO / PJ限定member・portfolio member | read-only shared DTO | 実装済み（参加設定済みPJのみ、実データ読取は未確認） | 未確認 |
| `/project/[projectId]/workspace` | `projectWorkspace` | PWA workspace bundle DTO / PJ限定member・portfolio member | `POST /api/project-workspace/[projectId]/effort` | 実装済み（週次予定/実績、配分、MS・活動集計、実データ読取・書込みは未確認） | 未確認 |
| `/project/[projectId]/cockpit` | `projectCockpit` | cockpit domain / member | 既存進捗・MTG・資料API、`PATCH /api/project-documents/[documentId]/content`、strategy feedback dialog API | 実装済み（PWA API/RLS境界を維持。資料Markdown更新はPJ member/adminのPWA側認可へ委譲し、strategy signalはPWAの `start → refine → confirm` だけで確定更新） | 実認証・実書込みは未確認 |
| `/project/[projectId]/config` | `projectConfig` | project config / admin | admin project API | 未確認 | 未確認 |
| `/project/[projectId]/report/[ym]/print` | `projectReportPrint` | monthly report / member・admin | `GET /api/project/monthly-report-print`、report fix/generate API、native A4 print | 実装済み（PWA集約の表紙/進捗/体制/次月/添付を印刷対象へ渡す） | 実認証・実書込み・実印刷は未確認 |
| `/notifications` | `notifications` | delivery result / admin | notifications feedback API | 未確認 | 未確認 |
| `/reimburse` | `reimbursements` | reimbursements, projects / member | `/api/reimbursements` | 未確認 | 未確認 |
| `/business-cards`, `/native/business-cards` | `businessCards` | private image + card API / member | business card POST/PATCH | 未確認 | 未確認 |
| `/monthly-agreement` | `monthlyAgreement` | agreement snapshot / member | agree / revision API | 未確認 | 未確認 |
| `/atlas` | `atlasHome` | atlas signals/stories/themes / member | atlas safe APIs | 未確認 | 未確認 |
| `/atlas/admin/themes` | `atlasThemes` | atlas themes / admin | theme cluster/apply API | 未確認 | 未確認 |
| `/atlas/decisions` | `atlasDecisions` | atlas decisions / member | decision API | 未確認 | 未確認 |
| `/atlas/divergence` | `atlasDivergence` | divergence / member | move/merge safe API | 未確認 | 未確認 |
| `/atlas/inbox` | `atlasInbox` | signal inbox / member | verify/dismiss API | 未確認 | 未確認 |
| `/atlas/inbox/submit` | `atlasInboxSubmit` | source input / member | atlas ingest API | 未確認 | 未確認 |
| `/atlas/macrotrends` | `atlasMacrotrends` | macro indicators / member | read-only | 未確認 | 未確認 |
| `/atlas/map` | `atlasMap` | nodes/edges / member | read-only | 未確認 | 未確認 |
| `/knowledge-map` | `knowledgeMap` | `materials-data` + `knowledge-map-data` / member | read-only | 実装済み（118元素、材料詳細、比較tray、知識ノード） | 実データ読取は未確認 |
| `/seeds` | `seeds` | seeds / member | seed create/update API | 未確認 | 未確認 |
| `/seeds/[id]` | `seedDetail` | seed + deep dive / member | deep-dive API | 未確認 | 未確認 |
| `/seeds/inbox` | `seedInbox` | seed inbox / member | verify/dismiss API | 未確認 | 未確認 |
| `/poc` | `poc` | seeds, poc companies/matches / member | PWA同一のRLS `POST` / `PATCH` | 実装済み（検索/絞込、PoC先・シーズ追加、案件化、既存状態更新） | 未確認 |
| `/company` | `company` | company profile, members, history, approved/review media / member | read-only | 実装済み（PWAと同じ5 query・認可付き媒体取得） | 読み取り確認済み（5 query = 200、2026-07-18） |
| `/vcs` | `vcs` | VC list / member | VC safe API | 未確認 | 未確認 |
| `/vcs/[id]` | `vcDetail` | VC detail / member | read-only | 未確認 | 未確認 |
| `/vcs/[id]/edit` | `vcEdit` | VC edit / admin API | VC update API | 未確認 | 未確認 |
| `/vcs/inbox` | `vcInbox` | VC inbox / member | verify/dismiss API | 未確認 | 未確認 |
| `/scholar` | `scholar` | `papers_log` / member | read-only | 実装済み（PWA同じselect/order/limit、ASPI8領域・四半期/YoY/時系列） | 認証済み実データ読取は未確認 |
| `/institutions` | `institutions` | ECR institutions / member | read-only | 実装済み（PWA固定KUTE/NIMS対応） | 未確認 |
| `/institutions/[institutionId]` | `institutionDetail` | institution / member | read-only | 実装済み（ECR詳細） | 未確認 |
| `/institutions/[institutionId]/cockpit` | `institutionCockpit` | ECR + linked PJ cockpit / member | existing cockpit APIs | 実装済み（実PJ cockpit・月別MTGツリー） | 未確認 |
| `/institutions/assess` | `institutionAssess` | ECR rubric / member・admin | assessment API | 実装済み（ECR 8軸詳細） | 未確認 |
| `/venture-map` | `ventureMap` | `project_ventures`, `macro_index_log`, `papers_log`, `macro_lane_weights` / member | read-only | 実装済み（PWA基準SERIES、policy/NOW、実ログ上書き、View B/C、SU detail遷移） | 認証済み実データ読取は未確認 |
| `/venture-map/amd-score` | `amdScore` | public `project_ventures`, `amd_score_inputs`, active `amd_score_alpha` / member | read-only | 実装済み（SPS/Legacy score、並び替え） | 認証済み実データ読取は未確認 |
| `/venture-map/amd-score/[projectId]` | `amdScoreDetail` | score/XRL evidence / member | `amd_score_inputs` PWA同一upsert（`project_id,evaluated_at`）/ つくよみ修正API | 実装済み（SPS P/R_net、XRL checklist原典項目・積み上げ判定・値反映・upsert・再読込/失敗表示） | 認証済み実データ読取・書込みは未確認 |
| `/venture-map/amd-score/retrofit` | `amdScoreRetrofit` | score inputs / admin | active α close + new α RLS insert | 実装済み（全PJシミュレーションと保存） | 認証済み実書込みは未確認 |
| `/venture-map/cyberspace` | `ventureCyberspace` | public ventures + score rows / member | read-only | 実装済み（M/X/F、log座標、選択、詳細遷移、ISO/正投影preset、Native drag/pan/pinch/scroll camera） | 認証済み実データ読取は未確認 |
| `/venture-map/oscillator` | `ventureOscillator` | PWA deterministic local model / member | read-only | 実装済み（Velocity Verlet、11イベント） | ローカルモデル確認済み |
| `/venture-map/state-space` | `ventureStateSpace` | PWA deterministic local model / member | read-only | 実装済み（Triple Helix 3×3、ショック、安定判定） | ローカルモデル確認済み |
| `/venture-map/su/[id]` | `ventureSuDetail` | selected `project_ventures`, `project_xrl_log`, `macro_index_log` / member | read-only | 実装済み（private/publicをroute IDで読み分けずPWA同じtarget取得） | 認証済み実データ読取は未確認 |
| `/venture-map/timeline-3d` | `ventureTimeline3D` | public ventures + project-ID-filtered XRL / member | read-only | 実装済み（5軸積層、milestone、SU詳細遷移、3D/正投影preset、PWA GizmoViewport相当の軸コントローラ、Native drag/pan/pinch/scroll camera） | 認証済み実データ読取は未確認 |
| `/management-score` | `managementScore` | company management score / admin | `persist:false` simulation preview API | 実装済み（PWA同一live-input bridge、シナリオ選択、再計算結果） | 確認済み（production SHA `3b924780`、Bearer GET 200、`persist:false` POST 200・18行、2026-07-18） |
| `/admin` | `adminHome` | admin ledgers / admin | existing admin APIs | 未確認 | 未確認 |
| `/admin/company` | `adminCompany` | profile / member / history / media のNotion import review queue / admin | 読み取り専用（媒体は既存認可済み `GET /api/company-media/file/[assetId]`） | 実装済み（PWA同一の4区分・レビュー待ち集計・gate/source metadata・写真媒体取得） | 読み取り確認済み（4 query = 200、2026-07-18。媒体は該当承認済み行が無いためファイル本体未確認） |
| `/admin/contexts` | `adminContexts` | `tsukuyomi_context` / admin | RLS `POST` / `PATCH`（追加・編集・archive） | 実装済み（PWA同一の検索・status/tag絞り込み・展開・編集・追加・archive確認） | 読み取り確認済み（query = 200、2026-07-18。書込みは安全な対象がないため未実行） |
| `/admin/contracts`, `/contracts` | `adminContracts` | contracts / admin・member read | contracts apply API | 未確認 | 未確認 |
| `/admin/coverage-gaps` | `adminCoverageGaps` | coverage gaps / admin | read-only `l2_coverage_gaps`、採否はnotifications | 実装済み（PWA全列・5指標・通知導線。抽出実行/直接更新なし） | Native静的確認。認証済み実データ読取は未確認 |
| `/admin/finance` | `adminFinance` | payment obligations/finance / admin | finance admin API | 未確認 | 未確認 |
| `/admin/governance` | `adminGovernance` | company/equity/governance / admin | `/api/governance`、`/api/grants`、`/api/action-items` | 実装済み（PWA同一のPJ選択、追加/削除、既存API境界） | Native静的確認。認証済み実書込みは未確認 |
| `/admin/invoices`, `/admin/billing` | `adminInvoices` | billing cycles/freee / admin | invoice preview/create/issue | 未確認 | 未確認 |
| `/admin/ip` | `adminIP` | PWA `IP_REPORT_MD` / admin | read-only `GET /api/macos/ip`（同一source module） | 実装済み（PWA同一の機密注意・進捗badge・Markdown report） | 確認済み（production SHA `0cb300ba`、Bearer GET 200、2026-07-18） |
| `/admin/japanese-culture-map`, `/japanese-culture-map` | `adminCultureMap` | `jp_culture_items` active rows / admin | read-only | 実装済み（PWA同一のカテゴリ階層展開、コンテンツ詳細/画像/link、都道府県→市区町村drill-down） | 確認済み（query = 200、7件・links schema確認、2026-07-18） |
| `/admin/management-knowledge` | `adminManagementKnowledge` | management knowledge / admin | GET/POST/PATCH `/api/admin/management-knowledge` | 実装済み（全編集fields、検索/絞り込み、作成/編集/archive） | Native静的確認。認証済み実書込みは未確認 |
| `/admin/members` | `adminMembers` | members/project_members / admin | member admin API | 未確認 | 未確認 |
| `/admin/monthly-work-agreements` | `adminMonthlyAgreements` | agreement statuses / admin | read-only `GET /api/admin/monthly-work-agreements` | 実装済み（年月/検索、7指標、hash・支払/stock、member native遷移） | Native静的確認。認証済み実データ読取は未確認 |
| `/admin/ms-overview` | `adminMsOverview` | milestones/plans / admin | protected MS POST preview / PUT API | 実装済み（POST検算→blocked保存不可→PUT、差分・予算影響） | Native静的確認。認証済み実書込みは未確認 |
| `/admin/payouts` | `adminPayouts` | reward cache/payout notices / admin | PWA既存のpayout/PDF/notice mail/payment-confirm-nudge API | 実装済み（報酬キャッシュ再計算、プレビュー、合意gate、正式PDF、メール確認/編集/明示送信/送付取消、入金確認nudge。メール送信は明示操作のみ） | Native静的確認。認証済み実書込みは未確認 |
| `/admin/private-wiki` | `adminPrivateWiki` | `private_wiki_entries`、PJ候補 / admin | `GET` / `POST` / `PATCH /api/admin/private-wiki` | 実装済み（PWA同一の明示person fields、検索・PJ/人物種別/status絞り込み、PJ grouping、作成/編集/archive。admin_private固定） | 未確認 |
| `/admin/projects` | `adminProjects` | projects/members/config / admin | project admin API | 未確認 | 未確認 |
| `/admin/prompts` | `adminPrompts` | `llm_prompts`、active `tsukuyomi_context` / admin | requireAdmin付き `PATCH /api/admin/prompts/[id]` | 実装済み（PWA同一のprompt key一覧・本文/説明/model/max tokens/有効状態/notes編集、active context読取。新規作成・削除なし） | 未確認 |
| `/admin/protocols` | `adminProtocols` | protocols, 事例, 結果観測, PJ / admin | create / status update / legacy archive / Tsukuyomi revision | 実装済み（PWAの絞り込み・追加・確定/却下/archive・結果観測・修正依頼） | 読み取り確認済み（4 query = 200、2026-07-18。書込みは安全な対象がないため未実行） |
| `/admin/schedule` | `adminSchedule` | derived operating calendar / admin | schedule GET / rebuild / actions API | 実装済み（期間再生成、カレンダー/運用一覧、category/PJ/owner/status絞り込み、詳細、完了・対象外・再開action。支払義務actionと直接予定変更は不可） | 未確認 |
| `/admin/season-pl` | `adminSeasonPL` | season PL / admin | read-only `/api/admin/season-pl`（list / `planCycleId` detail） | 実装済み（PWA同一のlist検算、cycle detail、収入/配分・pt・member収束表示） | list確認済み（Bearer GET 200、11 rows、2026-07-18）。detailは再確認時に保存sessionが期限切れのため未確認 |
| `/admin/settings` | `adminSettings` | `settings`、PWA operations catalog / admin | `GET` / `POST` / `PATCH` / `DELETE /api/admin/settings`（catalog DTO含む）、`POST /api/settings/cron-run` | 実装済み（PWA正本catalogのRaw/L2/Cron、source/input/outputと同一のkey/label/type/value/description CRUD、手動実行。settings writerはrequireAdmin付き共有APIへ集約） | 未確認 |
| `/admin/tsukuyomi` | `adminTsukuyomi` | `tsukuyomi_context`、learning/status read model / admin | `GET` / `POST` / `PATCH /api/admin/tsukuyomi/context` | 実装済み（PWA同一のcontext検索・layer/status絞り込み、追加・編集・archive、learning/status読取。学習投稿は対象外で`/api/tsukuyomi/post`の501を維持） | 未確認 |
| `/admin/weekly` | `adminWeekly` | `member_weekly`活動・`billing_cycles`月次報酬 / admin | read-only `/api/admin/weekly?weekStart=` | 実装済み（PWA同一の週移動、活動/PJ/メンバー/報酬集計、PJ × メンバーmatrix、source URL） | 確認済み（Bearer GET 200、11 member / 7 PJ / 72 activity / 6 reward、2026-07-18） |
| `/hud`, `/hud/dashboard` | `hudDashboard` | HUD dashboard / member | read-only `GET /api/hud/dashboard` | 実装済み（PWA同じPJ・請求・score・Management Score snapshot） | Native静的確認。認証済み実読取は未確認 |
| `/hud/dashboard/embed` | `hudEmbedDashboard` | projects / billing_cycles / monthly_reports の公開RLS範囲 | read-only direct RLS（PWAと同じ3 source） | 実装済み（未ログインでも公開read modelだけを表示。通常HUD API/管理scoreを呼ばない） | Native静的確認。公開RLS実読取は未確認 |
| `/hud/notifications` | `hudNotifications` | notification mirror / admin | PWA `/notifications` と同じ既存API/RLS | 実装済み（re-export元と同じ通知実装・操作へ接続） | Native静的確認。認証済み実書込みは未確認 |
| `/hud/project/[projectId]/cockpit` | `hudProjectCockpit` | cockpit domain / member | PWA HUD cockpitと同じPJ/ym deep link、既存cockpit API/RLS | 実装済み（HUDの操作を静的snapshotに落とさずNative cockpit文脈へ渡す） | Native静的確認。認証済み実読取・実書込みは未確認 |
| `/hud/atlas`, `/hud/atlas/admin/themes`, `/hud/atlas/decisions`, `/hud/atlas/divergence`, `/hud/atlas/inbox`, `/hud/atlas/inbox/submit`, `/hud/atlas/macrotrends`, `/hud/atlas/map` | routeごとの`hudAtlas` / `atlas*` | HUD Atlas mirror / member・admin | PWA再export元と同じAtlas API/RLS（macrotrends/mapはread-only） | 実装済み（aliasごとに同じNative実装へ収束し、採否・送信・theme操作をread-onlyへ劣化させない） | Native静的確認。認証済み実読取・実書込みは未確認 |
| `/hud/seeds`, `/hud/seeds/[id]`, `/hud/seeds/inbox` | `hudSeeds`, `seedDetail`, `seedInbox` | HUD seeds mirror / member | PWA再export元と同じSeeds API/RLS | 実装済み（一覧・detail・Inboxの既存操作を維持） | Native静的確認。認証済み実書込みは未確認 |
| `/hud/vcs`, `/hud/vcs/[id]`, `/hud/vcs/[id]/edit`, `/hud/vcs/inbox` | `hudVcs`, `vcDetail`, `vcEdit`, `vcInbox` | HUD VC mirror / member・admin | PWA再export元と同じVC API/RLS | 実装済み（一覧・detail・edit・Inboxの既存操作を維持） | Native静的確認。認証済み実書込みは未確認 |
| `/hud/venture-map/amd-score/retrofit` | `hudAmdScoreRetrofit` | HUD score mirror / admin | PWA再export元と同じ既存認可済みrefresh | 実装済み（HUD aliasでもScore refreshをread-onlyへ劣化させない） | Native静的確認。認証済み実書込みは未確認 |
| `/dashboard-cyber-3d-lab` | `cyber3DLab` | cyber HUD data / member | read-only `GET /api/hud/dashboard` | 実装済み（選択可能Native Canvas、M/X/Fとscore history） | Native静的確認。認証済み実読取は未確認 |
| `/dashboard-cyber-glass-cube` | `cyberGlassCube` | cyber HUD data / member | read-only `GET /api/hud/dashboard` | 実装済み（PJ選択・Cube・KPI） | Native静的確認。認証済み実読取は未確認 |
| `/dashboard-cyber-hud-wall` | `cyberHudWall` | cyber HUD data / member | read-only `GET /api/hud/dashboard` | 実装済み（PJ選択・status/monthly/signal Wall） | Native静的確認。認証済み実読取は未確認 |
| `/manual`, `/manual/[slug]` | `manual`, `manualDetail` | PWA manual markdown / member | manual Q&A API | 実装済み（章順/番号、テーマ、全章本文検索、本文/内リンク、前後章、Q&A） | 実データ読取は未確認 |
| `/spec`, `/spec/[slug]` | `spec`, `specDetail` | PWA spec Markdown / admin | read-only document bridge（bridgeも`is_admin`確認） | 実装済み（section/番号/章group/本文/前後章、Native gate） | Native静的確認。認証済み実読取は未確認 |
| `/bzm`, `/bzm/[slug]` | `bzm`, `bzmDetail` | bundled BZM Markdown / member | read-only document bridge | 実装済み（chapter/part/未着手stub/本文/前後章） | Native静的確認。認証済み実読取は未確認 |
| `/bzm/public`, `/bzm/public/[slug]` | `bzmPublic`, `bzmPublicDetail` | public BZM Markdown / public | 未ログインread-only document bridge | 実装済み（PWA middleware・app shell・Mac rootの全てで公開境界を保持） | Native静的確認。公開実読取は未確認 |
| `/proactive` | `proactive` | proactive_todos / admin | done/block/dismiss=`POST /api/proactive-todos/[id]/resolve`、reopen=PWA同一RLS PATCH | 実装済み（4 tab、detail、期限/種別、cockpit deep link） | Native静的確認。認証済み実書込みは未確認 |

## API surface

PWA `pwa/src/app/api/**/route.ts` の全 route は、macOSのBearer sessionで同じ認証・admin・member境界を通し、ネイティブ画面から既存の安全な書込みAPIを呼ぶ。
代表操作の証拠は、各NativeScreenIDの実装ファイルと、成功したHTTP応答・更新後再取得を同じ行へ追記する。

| API群 | 対象 | Swift実装 | 実データ確認 |
|---|---|---|---|
| progress / monthly report / meeting workflow | cockpit, report, mypage | 未確認 | 未確認 |
| notifications / action items / proactive | notifications, today, proactive | 未確認 | 未確認 |
| payment confirm | paymentConfirm | 未確認 | 未確認 |
| reimbursements / business cards | reimbursements, businessCards | 未確認 | 未確認 |
| monthly agreement / payout / invoice / finance | monthlyAgreement, admin* | 未確認 | 未確認 |
| Atlas / Seeds / VC / Scholar / ECR | explore screens | 未確認 | 未確認 |
| AMD Score / Venture Map / Management Score | decision screens | 未確認 | 未確認 |
| governance / contracts / members / prompts / schedule | admin screens | 未確認 | 未確認 |
| manual Q&A / docs | manual | PWA manual Markdown bridge + `/api/manual/tsukuyomi/ask` を実装 | 実データ読取・Q&A応答は未確認 |
