# PWA 画面 / API Surface 仕様

> **この章は何か**: 現行 PWA の route と API surface を、再構築時の入口として一覧化する。画面の名称、領域、利用者レンズ、移行状態は`src/lib/surface-catalog.ts`を正本とし、詳細 contract は各領域章に分ける。

## 画面 route

| route group | route | 役割 | authority |
|---|---|---|---|
| auth | `/auth/login`, `/auth/callback` | Supabase Google OAuth login / callback | `pwa/src/app/auth/*` |
| home | `/dashboard` | PJ一覧、抽出状況、Atlas / Venture Map / MyPage / Admin 入口 | `dashboard/page.tsx` |
| cockpit | `/project/[projectId]/cockpit` | PJ status、AMD Score、MS、経営ハイライト、月次カード/モーダル、MTGサマリ、kanban | `project/[projectId]/cockpit/page.tsx`, `CockpitView.tsx` |
| research workspace | `/project/[projectId]/workspace` | 計画詳細、技術証明、論点、関係先、週次エフォートを統合表示 | `project/[projectId]/workspace/page.tsx`, `ProjectWorkspaceDashboard.tsx` |
| weekly control | `/project/[projectId]/weekly-control` | 週次差分・判断・介入と、論点/仮説の要整理→検証中→判断待ち→決定/棄却を別画面で管制 | `project/[projectId]/weekly-control/page.tsx`, `SxWeeklyControlDashboard.tsx` |
| member | `/mypage`, `/reimburse` | メンバー活動、週次活動、立替精算 | `mypage/page.tsx`, `reimburse/page.tsx` |
| admin | `/admin/*` | 25画面を`組織・権限` / `契約・お金` / `PJ・実行` / `知識・AI` / `運用`の業務単位で表示する。表示名とURLはsurface catalogを共用し、追加順の独立配列を持たない。`AppShell` は現在pathnameで `GlobalNav` を `AdminSidebar` に差し替え、admin layoutは2枚目の左メニューを描画しない | `surface-catalog.ts`, `(app)/layout.tsx`, `AppShell.tsx`, `admin/layout.tsx`, `AdminSidebar.tsx`, `admin/*/page.tsx` |
| admin knowledge | `/admin/japanese-culture-map` | `jp_culture_items` active 行をマインドマップ / 日本地図で読む admin-only 文化知識ビュー。旧 `/japanese-culture-map` は redirect | `admin/japanese-culture-map/page.tsx`, `jp-culture.ts` |
| docs | `/manual`, `/spec`, `/bzm` | manual / design spec / textbook を OS 画面で表示 | `manual/*`, `spec/*`, `bzm/*` |
| docs | `/bzm/map` | 理論マップ (論証台帳)。DBだけを正本に0件から本人が育てる。admin は空白クリックでノード作成、通常クリックで編集、通常ドラッグで配置変更、Cmd/Ctrl二点クリックで接続、線クリックで解除する。全panelはノードを覆わないマップ作業区画。旧Markdownは履歴資産で自動表示しない。真理マップではなく件数・接続数は真偽・確信度を表さない | `bzm/map/page.tsx`, `BzmTheoryMapView.tsx`, `BzmTheoryComposerDialog.tsx`, `lib/bzm-theory-store.ts`, `/api/bzm/theory-map` |
| knowledge | `/knowledge-map` | AMD Materials。高校生が辞書なしで読める日本語を原則に、全118元素を淡黄→深紅の熱色、日本語主用途、軸から独立した供給`警戒` / `危機`で俯瞰する。評価済み元素は、要点の小窓で用途・供給警報・直近公表相場・5年推移・産出国円グラフを表示し、詳細操作で同じ小窓を拡張して埋蔵・需給 / 循環・代替 / AMD接点 / 出典を追加する。4評価軸の合計（20点満点）を総合値とし、周期表以外の一覧・比較は高得点順。全材料横断の需給の崩れランキングは専用の偏りの強さ（5点満点）で並べ、不足側、供給過剰側、価格乱高下を区別し、原因、供給が詰まる工程、評価時点、確からしさを示す。全体タブの3入口はカード全面で操作する。樹脂の詳細は原料と重合・重縮合・硬化等の製造方法を追加表示する。代表鉱物・鉱石、代表樹脂・高分子、2〜4件比較、従来のL2力学地図も統合する。初期評価と未評価を分け、原文全文、画面内Q&A、DB書き込み、生成AI呼び出しは持たない | `knowledge-map/page.tsx`, `MaterialsKnowledgeView.tsx`, `KnowledgeMapView.tsx`, `materials-data.ts` |
| contacts | `/business-cards` | スマホ撮影 / 写真選択、OCR確認、複数PJ紐付け、名刺検索。確定時だけ D-3 PJナレッジへ人物情報を同期する | `business-cards/page.tsx`, `BusinessCardsClient.tsx` |
| contacts native | `/native/business-cards` | iOSの名刺タブが認証cookieつきWKWebViewで開く、GlobalNavなしのnative shell | `native/business-cards/page.tsx`, `ios/.../BusinessCardsView.swift` |
| notifications | `/notifications` | L2 / MTG / app notifications の確認と採否 | `notifications/page.tsx` |
| decision | `/venture-map/amd-score`, `/management-score`, `/institutions`, `/institutions/assess` | AMD Score / Management Score / ECR | related page files |
| discovery | `/atlas/*`, `/seeds/*`, `/vcs/*`, `/scholar` | 外部シグナル、研究シーズ、VC、学術トレンド | related page files |
| HUD | `/hud/*` | mirror UI / projection UI | `hud/*` |

## API route groups

| group | route examples | DB / external side effect | current truth |
|---|---|---|---|
| progress | `/api/progress/*` | MS進捗、活動、月次進捗、revision | `pwa/src/app/api/progress/**/route.ts` |
| notifications | `/api/notifications/feedback` | `l2_feedbacks`, candidate採否、`tsukuyomi_learnings` | `/spec/3-7-notifications-current-spec` |
| strategy dialogue | `/api/strategy-signals`, `/api/dialogue-meeting`, `/api/dialogue-meeting/narrate` | `project_strategy_signals`, `project_meeting_summaries` | `/spec/3-6-strategy-signals-current-spec` |
| monthly report | `/api/monthly-report/*`, `/api/report/*` | `monthly_reports` / revision | `/spec/3-2-monthly-reports-current-spec` |
| meeting workflow | `/api/meeting-*` | MTG assets / summary / workflow | `/spec/3-3-meeting-flow-current-spec` |
| task data/API | `/api/tasks`, `/api/task-calendar/register-tasks`, `/api/task-calendar/schedule-plan` | `/tasks` 画面は廃止済み。`tasks` 互換 read/write、H-1次アクション自動登録+担当者Slack nudge、Calendar作業枠dry-runだけ残す | `/spec/5-7-task-management-current-spec`, `/spec/3-3-meeting-flow-current-spec` |
| admin finance | `/api/admin/finance/*`, `/api/admin/payment-confirm`, `/api/invoice/*` | finance tables, billing, freee / GAS | TODO spec |
| payouts / reward | `/api/admin/payouts`, `/api/cron/payout-*`, `/api/rewards/sync` | reward cache, payout notices, GAS PDF | TODO spec |
| Atlas | `/api/atlas/*` | atlas signals / stories / themes | TODO spec |
| Seeds / VC | `/api/cron/seeds-ingest`, `/api/cron/vc-*`, admin seed/vc helpers | seeds / vcs / investments | TODO spec |
| ECR | `/api/institutions/assess` | `institution_assessments` upsert | `/spec/4-3-ers-current-spec` |
| BZM theory | `/api/bzm/theory-map` | member read、admin の `bzm_theory_nodes` / `bzm_theory_edges` / `bzm_theory_node_memos` 明示保存 | `/spec/2-6-bzm-theory-map-current-spec` |
| business cards | `/api/business-cards`, `/api/business-cards/[cardId]`, `/api/business-cards/[cardId]/image` | private画像保存、Gemini OCR、確認済み名刺 / PJ紐付け / `project_knowledge` 同期 | `/spec/2-5-business-cards-current-spec` |
| cron | `/api/cron/*` | Vercel cron or on-demand batch | `/spec/5-3-automation-responsibility-current-spec` |

## Auth / Authority

- `(app)` route は middleware / layout で auth を要求する。
- `/spec` は admin 限定。
- `/notifications` は `members.is_admin=true` だけ表示する。
- `/admin/*` は admin layout gate。
- ECR assessment API、notification feedback API は auth user の email から `members` を引き、admin でない場合 403。
- BZM theory map は AMD member が閲覧でき、追加・編集・接続解除は admin に限定する。DB fallback 中は admin でも読み取り専用。
- 名刺APIは auth user が `members` に存在することを要求する。画像は private Storage に置き、認証済み AMD メンバー以外へ公開しない。

## Failure Mode

| failure | 挙動 |
|---|---|
| unauthenticated | 401 or auth redirect |
| non-admin on admin/spec/notifications | 403 or `notFound()` |
| Supabase read error | page/component error state or API 500 |
| LLM-backed route accidentally scheduled | `vercel.disabled-crons.json` / guard env / `/spec/5-3` の復活禁止 contract を確認 |
| OCR失敗 | 名刺行を `ocr_failed` で残し、画像を見ながら手入力して確定できる。OCR失敗だけで登録全体を失敗扱いにしない |
| PJ未選択 / 氏名空欄 | `PATCH` を 400 で拒否し、`needs_review` のまま保存する |

## Validation

- route 追加・metadata 更新: `npx tsc --noEmit`
- surface catalogとadmin分類: `npm run test:surface-catalog-contract`
- 理論マップ: `npm run test:bzm-theory-graph` と `npm run test:bzm-theory-editor`
- production build: `npm run build`
- production deploy: `bash pwa/scripts/deploy.sh`
- auth protected route smoke: unauthenticated access should redirect to `/auth/login?next=...`

## 再構築可能性チェック

この章だけで route/API の全体像は再構築できる。ただし各画面の component layout、API body schema、DB column、status transition は各領域章へ分割する必要がある。
