# AMD OS macOS 移植台帳

最終更新: 2026-07-17

判定は「実装済み」「ネイティブ骨格」「未移植」の3段階。
行を消すこと、骨格を実装済みに読み替えること、旧PWA `/tasks` や旧月次ルーティンを復活させることは禁止。

## 1. PWA route → NativeScreenID

| PWA route（全件） | NativeScreenID | 読取元 | 書込み先 | 権限 | 状態 / 回帰確認 |
|---|---|---|---|---|---|
| `/auth/login`, `/auth/callback` | `account` | Supabase Auth | Supabase OAuth PKCE | 本人 | 実装済み。Google callback / session保存 |
| `/dashboard`, `/mypage` | `today`, `projects` | `projects`, `app_notifications`, iOS MyPage | 既存通知・PJ安全API | member | 実装済み。PJカードと通知件数 |
| `/project/[projectId]/cockpit`, `/project/[projectId]/config`, `/project/[projectId]/report/[ym]/print` | `projectDetail` | Cockpit / `projects`, `ms_*`, `billing_cycles`, `project_meeting_summaries` | 既存MS保存前検算・管理API | member / APIごとの権限 | ネイティブ骨格。選択PJ詳細を削除しない |
| `/notifications` | `notifications` | `l2_notifications`, `meeting_notifications`, `app_notifications` | `/api/notifications/feedback` 等の既存安全経路 | 通知対象 / admin | ネイティブ骨格。判断ボタンはPWA安全経路へ |
| `/reimburse` | `reimbursements` | `reimbursements`, `projects` | 立替申請API | member | ネイティブ骨格。申請write未接続 |
| `/business-cards`, `/native/business-cards` | `businessCards` | private Storage + `/api/business-cards` | 人確認後の `PATCH /api/business-cards/[cardId]` | member | ネイティブ骨格。ファイル / drop / paste受付 |
| `/monthly-agreement` | `monthlyAgreement` | agreement snapshot / `billing_cycles` | 合意API | member | ネイティブ骨格。状態欄と2点確認を維持 |
| `/atlas`, `/atlas/admin/themes`, `/atlas/decisions`, `/atlas/divergence`, `/atlas/inbox`, `/atlas/inbox/submit`, `/atlas/macrotrends`, `/atlas/map` | `atlas` | `atlas_*`, source refs | Atlas候補・採否API | member / admin API | ネイティブ骨格。外部本文を保存しない |
| `/knowledge-map` | `materials` | `materials-data`, `knowledge-map-data` | なし（read-only） | member | ネイティブ骨格。DB write/LLMを持たない |
| `/seeds`, `/seeds/[id]`, `/seeds/inbox` | `seeds` | `seeds` | seeds安全API | member | 未移植。Seeds導線を削除しない |
| `/poc` | `poc` | `poc_*`, `seeds`, `projects`, `members` | PoC台帳API | member | 未移植 |
| `/vcs`, `/vcs/[id]`, `/vcs/[id]/edit`, `/vcs/inbox` | `vcs` | `vcs`, investment signals | VC台帳API | member / admin API | 未移植 |
| `/scholar` | `scholar` | scholar / research signals | なし | member | 未移植 |
| `/institutions`, `/institutions/[institutionId]`, `/institutions/[institutionId]/cockpit`, `/institutions/assess` | `institutions` | `institution_*`, related projects | assessment API | member / APIごとの権限 | ネイティブ骨格 |
| `/venture-map`, `/venture-map/amd-score`, `/venture-map/amd-score/[projectId]`, `/venture-map/amd-score/retrofit`, `/venture-map/cyberspace`, `/venture-map/oscillator`, `/venture-map/state-space`, `/venture-map/su/[id]`, `/venture-map/timeline-3d` | `amdScore` | AMD Score / XRL / venture map data | score evidence / revision API | member / admin API | 未移植。旧互換routeを正規画面へ戻す |
| `/admin`, `/admin/company`, `/admin/contexts`, `/admin/settings`, `/admin/prompts`, `/admin/protocols`, `/admin/tsukuyomi`, `/admin/coverage-gaps`, `/admin/ip` | `adminHome` | admin台帳・prompt・coverage | 既存admin API / Edge Function | admin | ネイティブ骨格。prompt本文をコードへ直書きしない |
| `/admin/invoices`, `/admin/billing` | `adminInvoices` | `billing_cycles`, freee設定 | `issue-invoice` Edge Function | admin | 未移植。旧billingはinvoicesへredirectする |
| `/admin/finance` | `adminFinance` | `company_payment_obligations`, finance read model | 管理API | admin | 未移植。金額不明を0円にしない |
| `/admin/payouts` | `adminPayouts` | reward cache, `payout_notices`, GAS PDF | payout Edge/GAS | admin | ネイティブ骨格。送付済みPDFを上書きしない |
| `/admin/contracts`, `/contracts` | `adminContracts` | contracts ledger / project contracts | contracts apply API | admin / member read | 未移植。1契約1行 |
| `/admin/members` | `adminMembers` | `members`, `project_members` | member admin API | admin | 未移植。権限・通知対象境界を維持 |
| `/admin/governance`, `/company` | `adminGovernance` | company overview / equity / governance | `/api/governance` requireMember | member | ネイティブ骨格。全member編集可の契約を維持 |
| `/admin/private-wiki` | `adminPrivateWiki` | `private_wiki_entries` | `/api/admin/private-wiki` | admin | 未移植。admin_private固定、個人情報を外へ複製しない |
| `/admin/management-knowledge` | `adminManagementKnowledge` | `management_knowledge_entries` | `/api/admin/management-knowledge` | admin | 未移植。source_excerptは短く |
| `/admin/schedule` | `adminSchedule` | schedule read model | rebuild writer | admin | 未移植。画面から直接予定変更しない |
| `/admin/ms-overview` | `adminMsOverview` | `value_milestones`, `milestone_responsibility` | 保存前検算付きadmin API | admin | 未移植。blockedなら保存不可 |
| `/admin/season-pl` | `adminSeasonPl` | `computeSeasonPl`, reward cache | なし（検算） | admin | 未移植。支払額と設計額を混同しない |
| `/admin/weekly` | `adminWeekly` | `member_activities`, reward cache | なし | admin | 未移植 |
| `/hud`, `/hud/dashboard`, `/hud/notifications`, `/hud/project/[projectId]/cockpit`, `/hud/atlas`, `/hud/atlas/admin/themes`, `/hud/atlas/decisions`, `/hud/atlas/divergence`, `/hud/atlas/inbox`, `/hud/atlas/inbox/submit`, `/hud/atlas/macrotrends`, `/hud/atlas/map`, `/hud/seeds`, `/hud/seeds/[id]`, `/hud/seeds/inbox`, `/hud/vcs`, `/hud/vcs/[id]`, `/hud/vcs/[id]/edit`, `/hud/vcs/inbox`, `/hud/venture-map/amd-score/retrofit` | `hud` | HUD snapshots / monthly data | なし（表示専用） | member | ネイティブ骨格。計器目盛は静止 |
| `/manual`, `/manual/[slug]` | `manual` | bundled / PWA manual markdown | なし | member | ネイティブ骨格 |
| `/spec`, `/spec/[slug]` | `spec` | PWA spec markdown | なし | admin | 未移植。admin gate |
| `/bzm`, `/bzm/[slug]`, `/bzm/public`, `/bzm/public/[slug]` | `bzm` | bundled BZM markdown | なし | member | ネイティブ骨格。読み取り専用 |
| `/japanese-culture-map`, `/admin/japanese-culture-map` | `adminHome` | `jp_culture_items` | なし | admin | 未移植。旧routeはadmin routeへredirect |
| `/dashboard-cyber-3d-lab`, `/dashboard-cyber-glass-cube`, `/dashboard-cyber-hud-wall` | `hud` | cyber HUD demo data | なし | member | 未移植。投影用デモとして残す |
| `/proactive` | `today` | `proactive_todos` | `/api/proactive-todos` | admin | 未移植。旧proactive_outboxを復活させない |

## 2. PWA重要UI登録簿 → NativeScreenID

| FEATURE_REGISTRY | NativeScreenID | 回帰確認 |
|---|---|---|
| `/manual` | `manual` | 章検索・本文・ページ限定つくよみを落とさない |
| `/knowledge-map` | `materials` | 118元素、材料レンズ、比較tray、read-only |
| `/business-cards` | `businessCards` | file / drop / paste、OCR review、PJ複数選択、private境界 |
| `/poc` | `poc` | Seeds→PoC先→案件化キュー |
| `/admin/japanese-culture-map` | `adminHome` | admin-only、一般資料ナビへ戻さない |
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
| `/project/[projectId]/cockpit` | `projectDetail` | 案C幅、MS変更履歴、今シーズン収支、MTG添付 |
| `株主・ガバナンス + 要対応` | `adminGovernance` | 会社概要タブ、cap table、action items、全member権限 |
| `/admin/schedule` | `adminSchedule` | 年間レール、元正本再生成、手入力禁止 |

## 3. iOS画面 → NativeScreenID

| iOS画面 / 機能 | NativeScreenID | 状態 |
|---|---|---|
| `MainTabView`, `MyPageView`, `ProjectRewardCard` | `today` | 実装済み / ネイティブ再構成 |
| `CockpitView`, `CockpitDetailView`, `MonthlyModal` | `projects`, `projectDetail` | ネイティブ骨格 |
| `CockpitHUDView` | `hud` | ネイティブ骨格 |
| `NotificationInboxView`, `NotificationJudgmentCard` | `notifications` | ネイティブ骨格 |
| `RegistrationHubView`, `ReimburseListView`, `ReimburseFormView` | `reimbursements` | ネイティブ骨格 |
| `BusinessCardsView` | `businessCards` | ネイティブ骨格。Mac入力経路を追加 |
| `RoutineFlowView`, `BudgetStepView`, `InvoiceStepView`, `MeetingStepView`, `ReportFixStepView` | `monthlyAgreement`, `adminInvoices`, `projectDetail` | 旧月次ルーティンは復活させず、現行の合意・月次詳細へ分割 |
| `AdminTabView`, `MemberListView` | `adminHome`, `adminMembers` | admin gate / 画面骨格 |
| `BillingMatrixView`, `BudgetApprovalView` | `adminPayouts`, `adminFinance` | 未移植 |
| `PayoutNoticePerMemberView` | `adminPayouts` | 支払PDFの安全経路を維持 |
| `ProposalInboxView`, `ProposalComposeSheet`, `ProposalThreadView` | `adminHome`, `today` | 未移植 |
| `TsukuyomiLearningsView`, `TsukuyomiView` | `adminHome`, `manual` | 未移植 |
| `SettingsView`, `PayoutInfoEditView` | `account` | アカウント骨格 |
| `TextbookReaderView` | `bzm` | BZM読み取り骨格 |
| `ScoreDetailWebView` | `amdScore` | PWA正規スコア詳細へ集約予定 |

## 4. 権限・書込み境界

| 操作 | Macの扱い | 正本経路 |
|---|---|---|
| Googleログイン | PKCEで認証セッションを取得 | Supabase Auth |
| 通知の判断・コメント | Macから任意DB更新しない | `/api/notifications/feedback` /既存安全API |
| OCR候補の確定 | 氏名とPJを人が確認してから | `PATCH /api/business-cards/[cardId]` |
| MS進捗・設計 | 保存前検算を通す | 既存PWA admin API / Edge Function |
| 支払・請求・管理台帳 | admin gate + 既存API | PWA API / Edge Function / GAS |
| 教科書・材料・HUD | read-only | bundled markdown / read model |

