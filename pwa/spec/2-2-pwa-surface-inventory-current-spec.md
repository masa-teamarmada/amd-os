# PWA 画面 / API Surface 仕様

> **この章は何か**: 現行 PWA の route と API surface を、再構築時の入口として一覧化する。詳細 contract は各領域章に分ける。

## 画面 route

| route group | route | 役割 | authority |
|---|---|---|---|
| auth | `/auth/login`, `/auth/callback` | Supabase Google OAuth login / callback | `pwa/src/app/auth/*` |
| home | `/dashboard` | PJ一覧、抽出状況、Atlas / Venture Map / MyPage / Admin 入口 | `dashboard/page.tsx` |
| cockpit | `/project/[projectId]/cockpit` | PJ status、AMD Score、MS、経営ハイライト、月次カード/モーダル、MTGサマリ、kanban | `project/[projectId]/cockpit/page.tsx`, `CockpitView.tsx` |
| member | `/mypage`, `/reimburse` | メンバー活動、週次活動、立替精算 | `mypage/page.tsx`, `reimburse/page.tsx` |
| admin | `/admin/*` | invoices / finance / projects（Slack CHの「チャンネルなし」明示を含む） / contracts (契約ファミリー単位の1契約1行台帳。送付確認・微修正・DocuSign依頼行は統合元として束ね、現在状態を表示) / members / payouts / prompts / settings / protocols / tsukuyomi / weekly (週次活動×月次報酬マトリクス: `/api/admin/weekly` が member_activities(member_weekly) と表示月の `billing_cycles.reward_summary_json` の `members[].totalPay` を返し、右端列=メンバー別月合計・最下行=PJ別月合計・総合計を描画) / 日本文化マップ (`/admin/japanese-culture-map`)。共通 shell は `GlobalNav` を `AdminSidebar` に差し替え、admin layout は2枚目の左メニューを描画しない | `(app)/layout.tsx`, `admin/layout.tsx`, `AdminSidebar.tsx`, `admin/*/page.tsx` |
| admin knowledge | `/admin/japanese-culture-map` | `jp_culture_items` active 行をマインドマップ / 日本地図で読む admin-only 文化知識ビュー。旧 `/japanese-culture-map` は redirect | `admin/japanese-culture-map/page.tsx`, `jp-culture.ts` |
| docs | `/manual`, `/spec`, `/bzm` | manual / design spec / textbook を OS 画面で表示 | `manual/*`, `spec/*`, `bzm/*` |
| knowledge | `/knowledge-map` | AMD Materials。全118元素を淡黄→深紅のheatmap、日本語主用途、軸から独立した供給`警戒` / `危機`で俯瞰する。評価済み元素は、要点modalで用途・供給警報・直近公表相場・5年推移・産出国円グラフを表示し、詳細操作で同じmodalを拡張して埋蔵・需給 / 循環・代替 / AMD接点 / sourceを追加する。4評価軸の合計（20点満点）を総合値とし、周期表以外の一覧・比較は高得点順。全体tabの3入口はカード全面で操作する。樹脂detailは原料と重合・重縮合・硬化等の製造プロセスを追加表示する。代表鉱物・鉱石、代表樹脂・高分子、2〜4件比較、従来のL2 force graphも統合する。初期評価と未評価を分け、raw本文、画面内Q&A、DB write、LLM呼び出しは持たない | `knowledge-map/page.tsx`, `MaterialsKnowledgeView.tsx`, `KnowledgeMapView.tsx`, `materials-data.ts` |
| contacts | `/business-cards` | スマホ撮影 / 写真選択、OCR確認、複数PJ紐付け、名刺検索。確定時だけ D-3 PJナレッジへ人物情報を同期する | `business-cards/page.tsx`, `BusinessCardsClient.tsx` |
| contacts native | `/native/business-cards` | iOSの名刺タブが認証cookieつきWKWebViewで開く、GlobalNavなしのnative shell | `native/business-cards/page.tsx`, `ios/.../BusinessCardsView.swift` |
| notifications | `/notifications` | L2 / MTG / app notifications の確認と採否 | `notifications/page.tsx` |
| decision | `/venture-map/amd-score`, `/management-score`, `/institutions`, `/institutions/assess` | AMD Score / Management Score / ERS | related page files |
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
| ERS | `/api/institutions/assess` | `institution_assessments` upsert | `/spec/4-3-ers-current-spec` |
| business cards | `/api/business-cards`, `/api/business-cards/[cardId]`, `/api/business-cards/[cardId]/image` | private画像保存、Gemini OCR、確認済み名刺 / PJ紐付け / `project_knowledge` 同期 | `/spec/2-5-business-cards-current-spec` |
| cron | `/api/cron/*` | Vercel cron or on-demand batch | `/spec/5-3-automation-responsibility-current-spec` |

## Auth / Authority

- `(app)` route は middleware / layout で auth を要求する。
- `/spec` は admin 限定。
- `/notifications` は `members.is_admin=true` だけ表示する。
- `/admin/*` は admin layout gate。
- ERS assessment API、notification feedback API は auth user の email から `members` を引き、admin でない場合 403。
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
- production build: `npm run build`
- production deploy: `bash pwa/scripts/deploy.sh`
- auth protected route smoke: unauthenticated access should redirect to `/auth/login?next=...`

## 再構築可能性チェック

この章だけで route/API の全体像は再構築できる。ただし各画面の component layout、API body schema、DB column、status transition は各領域章へ分割する必要がある。
