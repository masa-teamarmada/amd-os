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
- `/auth/callback` のログイン打ち切りは、必ず `supabase.auth.signOut({ scope: "local" })` で行う。`@supabase/auth-js` の `signOut()` は scope 省略時 `global` で、member 未登録・ドメイン不許可・PJ membership なし・Calendar 検証失敗のいずれか1回で、そのユーザーの**全デバイスのセッション**が失効する。callback の signOut はすべて「いま確立しかけた、このブラウザのセッションだけを捨てる」意図なので、scope は省略しない (2026-07-27)。

## 主要 route 群

| route | 役割 |
|---|---|
| `/dashboard` | PJ 一覧と主要機能への入口。上部に `proactive_todos` 由来の先手TODOバッジを出し、詳細は `/proactive` に送る。左/mainカラム内は PJ 一覧 → 研究機関ECRリスト、下段全幅は Company Content shelf の順に表示する。AMD 全体PJ (`p00`) は上部バイタルサイン枠から `/project/p00/cockpit` へ入るため、通常PJ一覧には表示しない。研究機関エコシステム構築PJは通常PJ一覧ではなく研究機関ECRリスト側へ寄せる。左メニューのボードにマウスオーバーまたはフォーカスすると、全アクティブPJへのコックピットリンクを右側に出す。フライアウトはナビのスクロール領域でクリップされない上位レイヤーに出し、画面下端では一覧部分だけをスクロールする。`MyPageContent` / `CompanyContentShelf` は `next/dynamic({ ssr:false })` で分離バンドル化し、Company Content (メンバー/沿革/写真/メディア掲載) の fetch は初回 `Promise.allSettled` に含めず、`IntersectionObserver` (`rootMargin: "600px 0px"`) で shelf アンカーが viewport 600px 圏内に入ってから `fetchCompanyContentPreview` を1回だけ起動する遅延ロードにする (v3.44.8)。取得完了までプレースホルダ表示、失敗時は空データへ fallback しダッシュボード主表示をブロックしない |
| `/project/[projectId]/cockpit` | PJ cockpit。Status / AMD Score / XRL / MS / 資料 / 経営ハイライト / ガバナンス / 助成金 / 月次 / MTGサマリ。旧 `proactive_outbox` TODO は表示しない |
| `/project/[projectId]/workspace` | 研究機関PJ向け統合ワークスペース。計画詳細、技術証明、論点、関係先、週次エフォートを扱う |
| `/project/[projectId]/weekly-control` | 既存workspaceと分離した週次管制。先週差分、今週の判断、介入、論点・仮説の放置防止を扱う。差分抽出未接続は0件でなく `抽出接続待ち` |
| `/manual` | AMD OS マニュアル。使い方・運用者向け |
| `/spec` | 設計書。確定実装仕様。admin 限定 |
| `/bzm` | BZM テキストブック。理論・数式・rubric 導出 |
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
- `/api/admin/private-wiki` は `requireAdmin()` + `service_role` で `private_wiki_entries` を list/create/update/archive する。browser client から直接書かせない。
- `/api/admin/management-knowledge` は `requireAdmin()` + `service_role` で `management_knowledge_entries` を list/create/update/archive する。browser client から直接書かせない。source_excerpt は短い根拠だけで、メール全文・議事録全文・資料全文を保存しない。
- `/tasks` 画面は廃止済み。`/api/tasks` は cockpit legacy kanban / H-1 互換のため残し、DB write は `service_role` 経由で、DELETE ではなく `active=false` を使う。通知 link は対象 PJ cockpit へ向ける。
- `/api/task-calendar/register-tasks` は H-1 が抽出した次アクションを `tasks` に自動登録し、担当者本人にだけ Slack DM nudge を送る。`CRON_SECRET` / `WORKFLOW_SECRET` または admin auth でのみ実行し、admin review queue は作らない。
- `/api/cron/governance-email-sweep` は D-14G の source sweep route。`CRON_SECRET` または admin auth でのみ実行し、`/admin/projects` の総会/役会フラグON PJに限定して Gmail を検索する。LLM定期cronではなく、source refs と `/api/governance/extract` への候補/確認済みhandoffを担う。
- `/api/guardrails/evaluate` は経営ガードレールのタグ照合 route。admin auth または `CRON_SECRET` でのみ実行し、`guardrail_cards.status='active'` と PJ / アクションタグを照合して `guardrail_matches` と `l2_notifications(l2_kind='guardrail_match')` を作る。LLMは使わず deterministic に評価する。
- `/api/cron/proactive-todo-extract` は先手 TODO の PWA non-LLM cron。開催済みMTG `next_actions[]`、7日以内の予定MTG準備、PJ `report_emails` から届く Gmail 期限つき依頼 (`email_action_request`) を `proactive_todos` に upsert する。Gmail API は読むが、Anthropic / OpenAI / Gemini 等の従量課金LLMは呼ばない。メール本文全文・URL・パスワードは保存しない。
- `/api/business-cards` は認証済み AMD メンバー向け。GET は名刺一覧とPJ候補、POST は画像を private Storage へ保存して DB prompt `business_card.ocr` で OCR し、必ず `needs_review` に止める。`PATCH /api/business-cards/[cardId]` だけが人の修正内容を `confirmed` にし、選択PJの `project_knowledge` へ安全な人物情報を同期する。
- `/api/business-cards/[cardId]/image` は private bucket の画像を認証済み AMD メンバーだけへ返す。ブラウザから Storage 公開URLを生成しない。PJナレッジへ email / phone / address / raw OCR / 画像を複製しない。

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
