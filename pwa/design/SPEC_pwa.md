# SPEC — AMD OS PWA

AMD OS PWA の **正本仕様書**。
画面構成・データモデル・共通インフラ・運用コマンド・実装規約を 1 箇所にまとめる。

このファイルは「いま何があるか」を記述する。
- 各セッションの作業ログ → `design_log/sessions_YYYY-MM.md`
- バグ・教訓 → `BUGS.md`
- 直近セッション + 次の一手 → `HANDOFF_pwa_rebuild.md`
- 共通運用ルール → リポジトリ root の `CLAUDE.md`

仕様が変わったらここを **同じ commit** で更新する。

---

## 1. 概要

| 項目 | 値 |
|---|---|
| 種別 | Next.js (App Router) PWA |
| 技術 | Next.js 16 + React 19 + Tailwind v4 + shadcn/ui |
| 正本パス | `/Users/masa/projects/AMD/amd-os/pwa` |
| リポ | `https://github.com/masa-teamarmada/amd-os.git` (branch: `main`) |
| Vercel project | `amd-os-pwa` (scope: `armada0130`, projectId: `prj_raZW3HSKIszzPUwNTHfy7xDGzLHm`) |
| 本番 URL | https://amd-os-pwa.vercel.app |
| Supabase | `nbnhrhybjslbawdukvvk` (Tokyo) — モノレポ全クライアント共通 |
| ローカル dev | `npm run dev` (default port 3000) |

---

## 2. ディレクトリ構成

```
pwa/
├── SPEC_pwa.md                  ← この文書 (正本仕様)
├── HANDOFF_pwa_rebuild.md       ← 直近セッション + 次の一手だけ (slim)
├── BUGS.md                      ← バグ/教訓 (症状/原因/解決策/教訓 型)
├── CLAUDE.md / AGENTS.md        ← PWA 固有ルール
├── design_log/                  ← セッションログ・設計議論・MS knowledge 等
│   ├── sessions_2026-04.md
│   ├── sessions_2026-05.md
│   ├── 2026-04_atlas.md
│   ├── 2026-04_policy_signals.md
│   ├── 2026-04_progress_estimation.md
│   ├── 2026-05_venture_map_model.md
│   └── ...
├── public/
│   └── tsukuyomi/sheet-v4.png
├── scripts/
│   ├── apply_ddl.py             ← Supabase Management API で DDL 適用
│   └── migrations/NNN_name.sql  ← 全 migration 必ずここに残す
├── src/
│   ├── app/
│   │   ├── (app)/               ← 認証必須ルート (middleware で gate)
│   │   ├── api/                 ← API routes / cron
│   │   ├── auth/                ← Supabase Auth callback / login
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── admin/  cockpit/  dashboard/  nav/  tsukuyomi/  venture-map/  ui/
│   ├── lib/
│   │   ├── supabase/            ← client / server / middleware / api-auth
│   │   ├── supabase-data.ts     ← 主データアクセス層 (anon read-only + auth client)
│   │   ├── gas-api.ts           ← GAS bridge (legacy / 暫定)
│   │   ├── atlas-*.ts           ← Atlas 各機能
│   │   ├── venture-map-data.ts  ← Venture Map データ
│   │   ├── progress-estimator.ts
│   │   ├── exec_summary/        ← ⭐ 「📑 全 PJ 紹介資料作成」用テンプレ正本
│   │   │   ├── template_section.html         ← 雛形 04 CHALLENERGY section (= 文字置換ベース)
│   │   │   ├── template_section_challenergy.html  ← 雛形オリジナル (絶対パス未修正、参考用)
│   │   │   └── template.css                  ← 雛形 polish-styles + 本体 CSS (18KB)
│   │   └── ...
│   ├── middleware.ts            ← matcher で _next / favicon.ico / manifest.json / *.{ico,png,svg,...} を bypass
│   └── types/
├── public/
│   ├── AMD_logo_mark.png        ← team ARMADA ロゴマーク (= 雛形コピー、紹介資料 + favicon source)
│   ├── AMD_logotype.png         ← team ARMADA ロゴタイプ (= 雛形コピー、紹介資料用)
│   ├── favicon.ico / icon.png / apple-icon.png  ← public/ 直配信 (= app/ から移動、Next.js Route Handler 経由を停止)
│   ├── icons/                   ← PWA installable 用 192/512 + maskable
│   ├── manifest.json            ← 4 icons (any + maskable)
│   └── ...
├── AMD_allPJ_introduction.html  ← まさが渡した PJ 紹介資料の雛形 (= bundler tipo、template の出典元、編集禁止)
├── supabase/                    ← (モノレポ ios/supabase が正本)
├── vercel.json                  ← cron 定義 (sync-pj-facts 含む)
└── package.json
```

---

## 3. ルーティング

### 公開ルート (no auth)

| パス | 役割 |
|---|---|
| `/` | top → 認証済みなら `/dashboard`、未認証なら `/auth/login` |
| `/auth/login` | Google OAuth ログイン (Supabase Auth) |
| `/auth/callback` | OAuth callback |
| `/hud/dashboard/embed` | STAPA投影資料など外部プレゼン用の公開HUD埋め込みroute。通常の `/hud/dashboard` は認証必須のまま、embed routeのみ `frame-ancestors 'self' http://127.0.0.1:8766 http://localhost:8766` を許可する。 |

### `(app)/` 配下 (auth 必須、middleware が gate)

| パス | 機能 |
|---|---|
| `/dashboard` | トップ。PJ 一覧 + Atlas/Venture Map/MyPage/Admin への入口 |
| `/dashboard-cyber-3d-lab` | 実験中の3D Cyber Dashboard。`three.js` 空間上に X/F/M 軸、PJ球体、床面KPI、ホログラム投影コックピットを配置。仕様方針は [`cyber_hud_design_code.md`](cyber_hud_design_code.md) / [`cyber_dashboard_content_design.md`](cyber_dashboard_content_design.md) |
| `/dashboard-cyber-glass-cube` | 廃案比較用の旧 Cyber Dashboard 第2案。ガラスキューブPJ群は情報構造がカオス化したため、今後の正本候補にはしない。公開モックは `/mock/dashboard-cyber-glass-cube` |
| `/dashboard-cyber-hud-wall` | Cyber Dashboard 第2案の作り直し。固定視点の `three.js` 空間に、参考HUD画像のようなKPI/PJ/Proof/Alert HUDモジュールを固定配置し、PJ選択時は同一空間内にPJ Cockpit Spatial Viewを展開する。公開モックは `/mock/dashboard-cyber-hud-wall` |
| `/mypage` | 自分の参加 PJ × 今月の活動 + 月次報酬予定 (取り消し線 = 未完月次ルーティンによる除外) |
| `/project/[projectId]/cockpit` | PJ コックピット (PJ Status (SU 系のみ) / MS / 月次カード / カンバン / ナッジ / 月次ルーティン)。詳細は [`cockpit.md`](cockpit.md) |
| `/project/[projectId]/config` | PJ 設定 (基本情報 / メンバー / 契約・料金 / 請求書送付)。GAS `226_ProjectConfig.html` の PWA 移植 |
| `/reimburse` | 立替精算 |
| `/settings` | Operations Settings。admin限定で Raw Data / L2 Data / Cron Control を一覧化し、cronごとの条件JSONを変えて `Run Now` 可能 |
| `/atlas` | シグナル & ストーリー一覧 |
| `/atlas/inbox` | 未確認シグナル (政策/ニュース フィルタ + 一括 Accept) |
| `/atlas/inbox/submit` | 手動投入 (auto-tag 付) |
| `/atlas/map` | ストーリーノードグラフ |
| `/atlas/divergence` | マクロトレンドマップ (世界×日本 3 ビュー: カード / 散布図 / ヒートマップ) |
| `/atlas/decisions` | 判断ログ |
| `/atlas/admin/themes` | テーマクラスタリング管理 |
| `/venture-map` | 9 PJ プロット (View A) |
| `/venture-map/su/[id]` | SU 個別ビュー (XRL × マクロ指数) |
| `/venture-map/amd-score` | AMD Score 一覧 (Before Zero Theory v3.2、7 軸 Cobb-Douglas)。詳細は [`amd_score.md`](amd_score.md) |
| `/venture-map/amd-score/[projectId]` | AMD Score 個別 (Triple Helix M カード / X / F / 経時 / 軸クリックで Tsukuyomi) |
| `/venture-map/amd-score/retrofit` | α 重み調整 + 全 PJ シミュレーション (タブバー非表示、詳細ページからリンク) |
| `/management-score` | AMD Management Score (会社全体の経営状況スコア: 先手力 / 財務耐久 / 既存PJ継続 / 新規案件獲得 / 戦略接近度)。詳細は [`management_score.md`](management_score.md) |
| `/venture-map/oscillator` | (実験) coupled oscillator 可視化 |
| `/venture-map/state-space` | (実験) Triple Helix 状態空間 |
| `/scholar` | 学術トレンド (μ_A 観測量 N) — lane × quarter の論文数 line chart + 前年同期比。OpenAlex 由来。詳細は [`amd_score.md`](amd_score.md) Triple Helix 観測モデル参照 |
| `/reimburse` | 立替精算。PWAから申請/編集/削除、領収書添付、PM承認、admin承認まで実行。申請/編集は `/api/reimbursements` 経由で server-side 保存。status flow: `submitted` → `pmApproved` → `approved` |
| `/admin/billing` | admin 立替/請求マトリクス (チップ操作で billing_cycles 直更新) |
| `/admin/payouts` | 報酬支払 |
| `/admin/finance` | 経理オペ台帳。サブスク / 固定継続費 / 自動振替 / 引落口座 / budget forward-fill / Gmail領収書イベント |
| `/admin/projects` `/members` `/contexts` `/protocols` `/tsukuyomi` `/settings` | 各 admin |
| `/admin/prompts` | LLM プロンプト管理 (= AGENTS ルール「プロンプトをコードに書かない」執行 UI)。`llm_prompts` 3 件 (tsukuyomi.system / protocol.extract / monthly_report.r313_extract) + スプシ由来 `tsukuyomi_context` 20+ 件を併記。body 全文閲覧 + 編集 + is_active トグル可能。詳細は [`amd_protocol.md`](amd_protocol.md) と [`L2_DATA.md`](L2_DATA.md) |
| `/vcs` | VC リスト (国内ディープテック VC マスタ。ソート/ファセット/検索) |
| `/vcs/[id]` | VC 詳細 (4 ペイン: 特性 / ファンド + DPE残 / PJ 接点 / 出資先 + ニュース) |
| `/vcs/[id]/edit` | VC 編集 (基本情報 + amd_rating + funds/investments/contacts/relations モーダル CRUD) |
| `/vcs/inbox` | VC ニュース受信箱 (verify / dismiss / fundraise → ファンド情報反映)。詳細は [`vc_list.md`](vc_list.md) |
| `/seeds` | 研究シーズリスト (大学・国研・高専のシーズ × AMD 視点の事業化適性)。検索/ファセット/ソート/モーダル詳細編集。詳細は [`seeds.md`](seeds.md) |
| `/seeds/[id]` | シーズ詳細 (URL 直接アクセス用フォールバック)。リスト画面でのモーダルが正規 |
| `/seeds/inbox` | Seeds 受信箱 (cron 自動収集分の未確認シーズ)。verify/dismiss で消化。GlobalNav に sky 色バッジ |

### API routes (`/api/`)

**進捗:** `progress/estimate` `progress/confirm` `progress/unconfirmed` `progress/batch-save` `progress/events` (= member_activities + 新列 initiative_origin/impact/depth/responsibilities を ProgressEvent にマップ、2026-05-12 復元) `progress/revisions` `progress/reimbursement`
**PJ 月次ノート:** `project/monthly-note` (= GET / POST。MS なし PJ でも月次モーダルで自由記述ノートを残せる。`project_monthly_notes` テーブル、PK `(project_id, ym)`、まさ 2026-05-12 タスク 3)
**Atlas:** `atlas/auto-tag` `atlas/backfill` `atlas/seed` `atlas/match-stories` `atlas/merge-stories` `atlas/move-signal` `atlas/themes/{cluster,apply,list}`
**請求/レポート:** `invoice/{create,preview}` `report/{generate,fix}`
**Admin:** `admin/projects/[id]` (= PATCH、AdminProjectsTable から projects + project_ventures 1 セル単位 update を service_role 経由)、`admin/project-members/bulk` (= POST、PJ メンバー一括 incremental update + 論理削除 (is_active=false)、`ProjectMembersEditor` から呼ばれる、admin/projects のメンバー列モーダルと project/[id]/config の両方で共有)、`admin/pj-introduction-html` (= ダッシュボード「📑 全 PJ 紹介資料作成」ボタンから POST、選択 PJ のエグゼクティブサマリー HTML を雛形 fmt で生成。Sonnet 4.5 で 1 PJ ごと JSON 集約 + concurrency 3。雛形 = `src/lib/exec_summary/template_section.html` + `template.css`、prompt = `llm_prompts.exec_summary.extract`)、`admin/lane-suggestions/[id]` (= LLM lane 提案の approve/reject)、`admin/seed-vcs` 等
**通知:** `notifications/feedback` (= admin限定。まさ/きよからの修正依頼を `l2_feedbacks` に保存)
**その他:** `activities/infer`

### Cron (`vercel.json`、UTC、Hobby plan で maxDuration=300 上限)

| path | schedule (UTC) | JST | 内容 |
|---|---|---|---|
| `cron/daily-estimate` | `0 18 * * *` | 03:00 daily | 全 active PJ の進捗推定 |
| `cron/atlas-collect` | disabled | 08:00 daily | 課金回避のため停止済み。旧定義は `vercel.disabled-crons.json` に保管。現在は Codex automation `AMD Atlas外部シグナルレビュー` が担当 |
| `cron/atlas-collect-policy` | `0 22 * * *` | 07:00 daily | 政府方針シグナル収集 (5 省庁) |
| `cron/atlas-daily` | `0 21 * * *` | 06:00 daily | atlas 日次レポート |
| `cron/atlas-weekly` | `0 8 * * 5` | 17:00 fri | atlas 週次 |
| `cron/atlas-monthly` | `0 22 1 * *` | 07:00 month-1 | atlas 月次 |
| `cron/atlas-divergence` | `0 21 * * 0` | 06:00 sun | テーマ単位 divergence 再生成 (54 テーマ ≈ 100s) |
| `cron/member-activities` | `0 19 * * *` | 04:00 daily | 月次レポート + responsibility → Haiku 推論 → member_activities |
| `cron/relearn-lane-weights` | `30 18 * * *` | 03:30 daily | macro lane weights 再学習 |
| `cron/macro-backfill-historical` | `0 3 * * 0` | 12:00 sun | 2010-2025 macro_index_log を Sonnet 推定で埋める |
| `cron/amd-score-l2-refresh` | `0 18 * * 0` | 03:00 mon | 6 ソース (Slack/Drive/Notion/Gmail/Calendar/WebSearch) から AMD Score / XRL根拠 (L2 ⑧) を Sonnet 抽出 → amd_score_inputs に upsert (全 SU 系 PJ) |
| `cron/seeds-ingest` | `0 0 * * 1` | 09:00 mon | GAP/NEP/AMED/D-Global/CREST/創発 等の直近採択を web_search で発見 → seeds (discovery_status='discovered')。/seeds/inbox に並ぶ、GlobalNav に未確認バッジ。詳細は [`seeds.md`](seeds.md) |
| `cron/vc-discover` | `0 0 * * 6` | 09:00 sat | 業界横断 web_search で VC ニュース 10-18 件 + 新規 VC stub 化 → vc_news (verified=false) + vcs。fundraise/fund_close は suggested_fund_patch で fund 更新提案。**旧 vc-news-ingest を 2026-05-13 に吸収**, ingested_by='discover_cron' |
| `cron/papers-quarterly-ingest` | `20 18 * * 1` | 03:20 火 | OpenAlex で 5 lane × 直近 16 quarter の論文数を papers_log に upsert (μ_A 観測量 N の供給)。Triple Helix 観測モデルの主入力。詳細は [`amd_score.md`](amd_score.md) |
| `cron/founding-members-extract` | `30 18 * * 1` | 03:30 火 | 全 PJ の monthly_reports + meeting_summaries + project_knowledge から **創業メンバー** (AMD 内外含む全員) を Sonnet 4.5 で抽出 → project_founding_members に upsert + l2_notifications (kind='founding_members')。L2 ⑧ XRL根拠のうち HRL 推定の主要根拠 |
| `cron/sync-pj-facts` | `0 19 * * *` | 04:00 daily | `project_ventures` の構造化フィールド (founded_at / outcome_pattern / origin_org / origin_pi / lane / amd_support_*) を `project_knowledge` に `category='basic_fact'` で同期。/admin/contexts や cockpit から見える状態に。**まさが PJ ナレッジで設立日 / outcome を見られる用途** |
| `cron/frl-grit-resilience-extract` | `0 18 1 * *` | 月初 03:00 JST | 全 active PJ × 過去 3 ヶ月 monthly_reports + project_meeting_summaries + project_founding_members を Sonnet 4.6 で集約 → `frl_grit` (Duckworth 2007) / `frl_resilience` (Markman 2005) を 0-9 推定 → `amd_score_inputs` に当日付で upsert。`llm_prompts.frl.grit_resilience.extract` v2 を fetch (= 外部創業者優先 / null 厳格化)。手動キックは `?projectId=p21` 可 |
| `cron/macro-aggregate-indicators` | `0 19 1 * *` | 月初 04:00 JST | observation_log + atlas_signals を ASPI lane × month で集計 → `macro_index_log` の `budget_amount` (= kaken/grant 集計) / `investment_amount` (= vc 集計) / `policy_mention_count` (= atlas_signals.source_type='policy' 件数) / `raw_signal_count` (= atlas_signals 全件) を update + 欠落 row を insert。`?since=YYYY-MM` 指定可 (= デフォルト過去 36 ヶ月)。atlas_signals.domain (= "I.ICT・AI" 等の ATL 独自) → ASPI domain mapping は cron 内 ATL_DOMAIN_TO_ASPI に定義 |
| `cron/management-score-raw-data` | (vercel cron 未登録) | on-demand / monthly | AMD Management Score 用 raw signal intake。OS内部データを `amd_management_score_raw_signals` に集約。`?includeFreee=1` で freee trial_pl → `company_actual_monthly` も同期。local: `npm run collect:management-score-raw -- --ym=YYYYMM [--include-freee]` |
| `cron/management-score-calculate` | (vercel cron 未登録) | on-demand / after raw | `amd_management_score_raw_signals` から `amd_management_score_snapshots` / evidence を算出。`?ym=YYYYMM` 指定可 |
| `cron/monthly-reports-backfill` | (vercel cron 未登録) | on-demand 手動 curl | billing_cycles LEFT JOIN monthly_reports IS NULL の row を Sonnet 4.6 で順次生成 → monthly_reports upsert。prompt = `llm_prompts.monthly_report.r313_extract` (Supabase fetch、is_active 無視、AGENTS 完遵)。`?limit=N&concurrency=M` で並列処理 (デフォルト 6 件 / 5 並列、Vercel maxDuration 300s soft timeout 260s)。文字化け検出 (= ? 比率 > 50% で reject)。AMD-Report GAS R313 と機能重複、R313 が動かない時の保険 + backfill 用 |

認証: 全 cron route が `Authorization: Bearer ${CRON_SECRET}` を確認。`CRON_SECRET` 未設定なら処理スキップ。

---

## 4. データモデル (Supabase)

スキーマ正本は `ios/supabase/migrations/`。PWA 起源の追加分は `pwa/scripts/migrations/`。

### コア (GAS / iOS と共通)

| table | 用途 |
|---|---|
| `members` | メンバー (28 件) |
| `projects` | PJ (22 件) |
| `project_members` | 紐付け |
| `billing_cycles` | 月次請求 (126 件) — `rewardSummaryJson` / `msProgressSummaryJson` キャッシュ列あり |
| `value_plan_cycles` | PlanCycle |
| `value_milestones` | MS (136 件) |
| `milestone_sub_items` | サブ MS (138 件、チェックボックス) |
| `milestone_responsibility` | 担当割合 + role + task_description (209 件) — `UNIQUE(milestone_id, member_id, role)` |
| `milestone_monthly_progress` | 月次 % + `note` + `source` (`tsukuyomi_estimate` / `pm_confirmed` / `pm_rejected` / `pm_manual` / `routine` / `criteria_toggle`) |
| `monthly_reports` | 月次レポート (final_content / draft_content) |
| `tasks` | カンバン |
| `member_activities` | メンバー × 今月活動 (`source='inferred'` / `'slack'` 等) |
| `reimbursements` | 立替 (status: `submitted` `pmApproved` `approved` `paid` ...)。`receipt_storage_paths` / `receipt_file_names` で private Storage `reimbursement-receipts` の領収書添付を保持 |

### Atlas (PWA 起源)

| table | 内容 |
|---|---|
| `atlas_signals` | 個別シグナル (`source_type` に `'policy'` 含む)、`metadata` jsonb (省庁/announced_at)、`story_id` |
| `atlas_stories` | ストーリー (signals を集約) |
| `atlas_story_merges` | merge ログ (LLM が学習する) |
| `atlas_themes` / `atlas_story_themes` | テーマ (54 件確定) と story の多対多 |
| `atlas_divergences` | テーマ単位 世界/日本 要約 + 乖離度 + 活発度 |

### Venture Map (PWA 起源)

| table | 内容 |
|---|---|
| `project_ventures` | SU 系 PJ の基本情報 (`project_id` PK = `projects.project_id` FK)。9 PJ。`ventures` を廃止して 008 で統合 |
| `project_xrl_log` | TRL/BRL/HRL 時系列 + `bottleneck` (旧 `ventures_xrl_log`、008 で rename) |
| `project_events` | PJ ごとの汎用イベントログ (`kind` ∈ hire/funding/deal/governance/note 等、`occurred_on` + `meta` jsonb)。沿革生成の元データ + AMD スコアグラフのアノテーション |
| `amd_score_inputs` | AMD Score の 7 軸入力 (μ_A/I/G + 5 XRL + FRL, shallow_tech_mode)。`UNIQUE(project_id, evaluated_at)` (013 migration) |
| `amd_score_alpha` | 弾力性 α_i のバージョン管理 (`effective_from` / `effective_to`、jsonb)。base case を seed 済 |
| `seeds` | seed 管理 |
| `papers_log` | OpenAlex 論文数 (lane × **quarter**、UNIQUE lane+observed_at)。Triple Helix 観測量 N の供給。`cron/papers-quarterly-ingest` で投入 |
| `macro_index_log` | マクロ指数 (lane × month、Atlas 集計 + Sonnet 2010-2025 推定) |
| `macro_lane_weights` | レーン重み (Sonnet が毎日再学習) |
| `triple_helix_loading` | C 行列 (6 観測量 × 3 隠れ状態 μ_A/I/G の loading prior、bvar_prior §3.2)。AmdScoreView の M カードで参照 |
| `project_founding_members` | PJ 創業メンバー (AMD 内外含む)。L2 ⑧ XRL根拠のうち HRL 推定の主要根拠。LLM 抽出 (`cron/founding-members-extract`)。`(project_id, person_name)` UNIQUE。詳細は [`xrl_evidence.md`](xrl_evidence.md) / [`amd_score.md`](amd_score.md) |

### つくよみ / その他

`tsukuyomi_nudge_queue` `tsukuyomi_learnings` `ms_progress_revisions` `ms_revision_messages` `source_cache` (legacy / 実質空)

### 月次ノート / 進捗イベント拡張 (2026-05-12 追加)

| テーブル | 役割 |
|---|---|
| `project_monthly_notes` | PJ × ym 単位の自由記述進捗ノート (UNIQUE (project_id, ym))。MS plan_cycle 未設定 PJ でも月次モーダルから記録できる。`/api/project/monthly-note` GET/POST、CockpitMonthlyModal の MonthlyNoteSection から書き込み |
| `member_activities` (= 既存) の追加列 | `initiative_origin` (5 値 + unknown CHECK) / `impact` (1-5) / `depth` (0-1) / `reject_reason` / `origin_lost_reason`。member_id / milestone_id は NULL 許容に変更。/api/cron/member-activities が Sonnet で抽出 → /api/progress/events が ProgressEvent にマップ → CockpitMonthlyModal EventsSection で「先手力」スコア計算 |

### AMD Management Score (設計中)

| テーブル | 役割 |
|---|---|
| `amd_management_score_snapshots` | AMD会社全体の経営状況スコア snapshot。`total_score` + 5軸 (`initiative_score` / `finance_score` / `retention_score` / `pipeline_score` / `direction_score`) + weights / inputs / next_actions |
| `amd_management_score_evidence` | 各軸の短い根拠。full raw data は保存せず、source ref / snippet / confidence / impact を保存 |
| `amd_management_score_source_runs` | Management Score raw data intake の実行ログ。source別 counts / partial error を保存 |
| `amd_management_score_raw_signals` | Management Score 算出前の月次 raw signal。5軸ごとに既存OSデータ / freee / Atlas 等を source_hash + payload 付きで保持 |
| `company_budget_inputs` | GAS `CFG_*` 相当の予算 / 計画入力。PJ売上、固定費、変動費、借入、スポット収支、シナリオを保持 |
| `company_budget_simulation_runs` | GAS `runSimulation()` 相当の実行 snapshot。scenario / params / engine_version / ran_at を保持 |
| `company_budget_monthly` | GAS 月次試算表から移植する予算 / 計画の正本 |
| `company_actual_monthly` | freee API から正規化した月次実績 |
| `company_budget_actual_monthly` | 予算と実績を突合する view。finance_score / 予実管理 UI の主入力 |
| `company_budget_variance_notes` | 予実差分理由・未反映予定・L2根拠の短いメモ |
| `company_finance_recurring_items` | admin finance台帳。サブスク / 固定継続費 / 自動振替 / 引落口座 / budget forward-fill |
| `company_finance_receipt_events` | Gmail/freee/manual 由来の領収書イベント。実績同期・継続費候補の根拠 |
| `freee_oauth_tokens` | freee refresh_token rotation store。service_role 限定で、production cron が refresh 後の最新 token を次回も読めるようにする |

詳細は [`management_score.md`](management_score.md) / [`project_pl_monthly.md`](project_pl_monthly.md)。GAS 月次試算表を予算、freee を実績、AMD OS を予実管理と経営スコアの統合場所として扱う。

### VC List (PWA 起源)

| テーブル | 役割 |
|---|---|
| `vcs` | VC マスタ。`amd_rating` (★1-5) で AMD 視点の相性評価 |
| `vc_funds` | ファンド単位 (vc_id + fund_no 一意)。size / status / `dry_powder_*` (出所: estimated/heard_from_contact/public_disclosure) |
| `vc_investments` | 出資イベント。自社 PJ なら `our_project_id` で `projects` に紐付け |
| `vc_contacts` | VC 担当者 (投資家としての関係。GAP 事業化推進機関は `project_venture_members` を使う) |
| `project_vc_relations` | PJ × VC × AMD担当 × ステータス (not_contacted/pitching/evaluating/dd/term_sheet/invested/passed/declined) |
| `vc_news` | VC 関連ニュース (Atlas とは独立系統)。`verified` / `dismissed` で受信箱状態管理。`suggested_fund_patch` でファンド更新候補 |

### Seeds (研究シーズリスト、PWA 起源 — 024_seeds_overhaul.sql)

| テーブル | 役割 |
|---|---|
| `seeds` | 研究シーズマスタ。機関 + PI + シーズ情報を 1 行に統合。`status` 候補→調査中→接触済→協議中→PJ化/見送り、`amd_rating` (★1-5)、`spun_off_project_id` で PJ 紐付け |
| `seed_funding` | 補助金履歴 (NEDO/AMED/JST GAP 等の採択) |
| `seed_news` | 関連ニュース・論文・プレス (Atlas とは独立系統) |
| `seed_contact_log` | AMD メンバー × シーズ の接触履歴 |

旧 `seeds` (006_venture_map.sql の予兆 4 件用) は 024 で破棄。Venture Map のグラフ予兆プロットも同時に削除。詳細は [`seeds.md`](seeds.md)。

データ流入: cron `vc-discover` (毎週土 09:00 JST、Claude + web_search、業界横断 + 新規 VC 発見 + suggested_fund_patch) / つくよみ chat tool 群 (`upsert_vc` `upsert_vc_fund` `update_vc_dry_powder` `add_vc_investment` `add_vc_contact` `add_vc_news` `link_project_vc`) / `/vcs/[id]/edit` 手動。詳細は [`vc_list.md`](vc_list.md)。

初期投入: `POST /api/admin/seed-vcs` (Bearer CRON_SECRET) で Claude + web_search に国内ディープテック VC を一括生成させ、`vcs` / `vc_funds` / `vc_investments` を upsert。再実行可。

---

## 5. 共通インフラ

### Supabase

- project ref: `nbnhrhybjslbawdukvvk`
- 認証: Google OAuth (team-armada.jp 限定の予定、現状 DEV_MODE)
- RLS: 多くのテーブルで `anon_read (USING true)` (DEV_MODE)。書き込みは `getAuthClient()` (auth 付き browser client) 経由
- 過去の RLS 再帰問題のため `member_pm_read` 等は DROP 済み

### GAS bridge (legacy / 暫定)

- `NEXT_PUBLIC_GAS_WEBAPP_URL` で anonymous webapp に到達
- 用途: Gmail からの修正依頼の source 抽出 (`mode=pwaApi` adapter)
- 長期: PWA サーバーから直接抽出する設計に置換予定 (TODO)

### つくよみマスコット

- スプライト: `pwa/public/tsukuyomi/sheet-v4.png` (2304×512)
- 4 アニメ × 18 frames × 128×128、足元アンカー (64, 124)
- `(app)/layout.tsx` 右下に常駐
- 30-90s 間隔で mood 切替 (happy/thinking/wave 1.8s)、タップで wave 反応
- 素材生成元: `/Users/masa/projects/masa/output/tsukuyomi_animations_amd/` (Codex 生成、annotation なし)
- 統合シート生成: `/tmp/combine_v2_frames.py` (FRAMES_PER_ROW=18, ROWS=4)

---

## 6. 認証

- 現状: Supabase Auth + middleware (`src/middleware.ts` → `src/lib/supabase/middleware.ts`)
- `(app)/layout.tsx` で `getUser()` を呼び未認証なら `/auth/login` へ redirect
- `/api/` は middleware で auth redirect から除外 (cron 401→redirect 事故回避)
- Google OAuth プロバイダ設定: Client IDs は `webクライアントID,iOSクライアントID` の順 (先頭が code flow で使用)

---

## 7. 環境変数

### `.env.local` (ローカル) と Vercel production env (両方必要)

| key | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client / SSR 共通 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (cron, server actions) |
| `SUPABASE_ACCESS_TOKEN` | DDL 適用 (`scripts/apply_ddl.py`) |
| `ANTHROPIC_API_KEY` | Claude (Sonnet/Haiku) |
| `GEMINI_API_KEY` | Gemini Flash (政策フィルタ) |
| `CRON_SECRET` | 全 cron の Authorization Bearer |
| `FREEE_CLIENT_ID` `FREEE_CLIENT_SECRET` `FREEE_COMPANY_ID` `FREEE_REFRESH_TOKEN` | freee invoice |
| `NEXT_PUBLIC_GAS_WEBAPP_URL` `NEXT_PUBLIC_GAS_API_KEY` | GAS bridge |
| `NEXT_PUBLIC_DEV_MODE` | `'true'` で DEV モード (anon read 全開) |
| `SLACK_BOT_TOKEN` | Slack Bot (xoxb-…)。AMD Score L2 cron 用。scopes: search:read, channels:history, channels:read, groups:history, groups:read |
| `NOTION_API_KEY` | Notion Integration (secret_…)。AMD Score L2 cron 用。Integration を root ページに招待 |
| `GOOGLE_OAUTH_CLIENT_ID` `GOOGLE_OAUTH_CLIENT_SECRET` `GOOGLE_OAUTH_REFRESH_TOKEN` | Google OAuth (個人 Gmail/Calendar 代理)。L2 cron で Drive/Gmail/Calendar 全部使う |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | (任意、OAuth refresh token の代替) Service Account JSON。Drive のみ用、Gmail/Calendar には domain-wide delegation 必須 |

**注意**: `.env.local` を変更しても Vercel に自動反映されない。`vercel env add <KEY> production` で明示追加が必要。

---

## 8. 運用コマンド

### Vercel デプロイ (正本)

```bash
npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os
```

- **`--cwd` はリポジトリ root** (`pwa/` ではない)。Vercel project `amd-os-pwa` の Settings → Build → Root Directory が `pwa` のため、`--cwd .../pwa` だと `pwa/pwa` 二重で失敗する
- リポ root に `.vercel/project.json` (amd-os-pwa を指す) があること。無いと `--yes` で誤って `amd-os` 新プロジェクトが作られる (2026-05-06 BUGS 参照)
- 復元: `cp -r /Users/masa/projects/AMD/amd-os/pwa/.vercel /Users/masa/projects/AMD/amd-os/.vercel`
- 確認は **常に本番環境** (`amd-os-pwa.vercel.app`) で行う方針 (`pwa/AGENTS.md` 参照)

ロールバック:
```bash
npx vercel ls --scope armada0130                   # デプロイ ID 確認
npx vercel promote dpl_<ID> --scope armada0130 --yes
```

### Supabase DDL

```bash
python -X utf8 scripts/apply_ddl.py scripts/migrations/NNN_name.sql
```

- Management API (`/v1/projects/{ref}/database/query`) を直叩く
- `.env.local` の `SUPABASE_ACCESS_TOKEN` (sbp_…) 使用
- **User-Agent ヘッダー必須** (Cloudflare 1010 回避)
- migration は必ず `scripts/migrations/NNN_name.sql` に残す
- `supabase-js REST + rpc("exec_sql")` は存在しない

### ローカル

```bash
cd /Users/masa/projects/AMD/amd-os/pwa
npm run dev          # 開発
npm run build        # 本番ビルド (deploy 前の確認)
npx tsc --noEmit     # 型チェック
```

---

## 9. 実装規約 (引っかかりやすい点)

### 進捗 % の扱い
- LLM (`progress-estimator.ts`) が返す `progressPct` は **今月の delta**
- DB `milestone_monthly_progress.progressPct` に保存するのは **累積**
- 変換: `newCumPct = min(100, prevCum + delta)`
- 単調増加のみ保存。`routine` / `pm_manual` / `criteria_toggle` はスキップ

### コミット % の扱い
- DB `milestone_responsibility.share` は **0.0-1.0 の小数**
- UI は **0-100 の整数**
- 表示: `Math.round(r.share * 100)`

### `立替確認` 自動判定 (admin.billing)
- 対象稼働月の翌月 4 日を締切 (土日なら前営業日に補正)
- 締切日前: 必ず未完
- 締切日以降、`reimbursements.status` が `submitted` / `pmapproved` の未処理がなければ完了
- 例: `202606` → 2026-07-04 が土曜 → 2026-07-03 に判定
- 手動変更は不可 (Swift 版と同じ)

### 通知 admin-only
- `/notifications` / `/hud/notifications` は server-side で `members.is_admin` を確認し、admin以外は404扱い。
- `l2_notifications` / `meeting_notifications` / `app_notifications` / `l2_feedbacks` は migration 066 で admin authenticated のみ SELECT/UPDATE/INSERT 可能。
- iOS/APNs 配信済みは `notified_at`、PWA上の人間の既読は `read_at`。既読は削除ではなく状態更新。現状はDBに蓄積し続け、UI側で最新100件 + 既読折りたたみとして扱う。

### 月次ルーティン
- 標準: `請求額確定 / 報告会日程調整 / 月次報告書FIX / 立替精算確認 / 請求書発行 / 請求書送付`
- CTB: `見積書送付` + 標準
- 並びは古い月が上
- 期限超過かつ未完なら mypage の月次報酬から **取り消し線** で除外
- ただし `billing_cycles.status` が `payment_confirmed` / `reward_paid` / `completed`、または `payment_confirmed_at` / `reward_paid_at` あれば admin 救済済みとして除外しない

#### 各ステップクリック時の挙動 ⭐

cockpit 右カラムの月次ルーティンで「タスク行」をクリックしたら **stepId 別に専用モーダル/遷移を開く**。**月次モーダル (CockpitMonthlyModal) は開かない**。月次モーダルが開くのは**月見出し (`YYYY.MM稼働分`) クリック時のみ**。

正本は iOS `RoutineFlowView.handleTap()` ([ios/AMDOS/Features/Routine/RoutineFlowView.swift](../ios/AMDOS/Features/Routine/RoutineFlowView.swift))。PWA では `CockpitView.resolveStepModalFromTap()` ([pwa/src/components/cockpit/CockpitView.tsx](src/components/cockpit/CockpitView.tsx)) で振り分ける。

| stepId | 開く UI | 実装 |
|---|---|---|
| `budget` (請求額確定) | `CockpitRoutineBudgetModal` | billing_cycles 直叩き / Edge Fn `send-budget-approval-nudge` |
| `estimateSend` (見積書送付・CTBのみ) | `CockpitRoutineInvoiceModal` (documentType=`quotation`) | billing_cycles 直叩き / Edge Fn `issue-invoice` `cancel-invoice` |
| `meeting` (報告会日程調整) | `CockpitRoutineMeetingModal` | Edge Fn `meeting-slots` (GET) / `schedule-meeting` (GET) |
| `reportFix` (月次報告書FIX) | `CockpitRoutineReportFixModal` | monthly_reports 直読み + billing_cycles UPDATE / Edge Fn `send-slack-dm` |
| `reimburseConfirm` (立替精算確認) | `/reimburse` ページに **遷移** (モーダルではない) | iOS は `navigation.selectedTab = .reimburse` |
| `invoiceIssue` (請求書発行) | `CockpitRoutineInvoiceModal` (documentType=`invoice`) | 同上 estimateSend |
| `invoiceSend` (請求書送付) | `CockpitRoutineInvoiceSendConfirm` 確認ダイアログ | billing_cycles UPDATE (`invoice_sent_at`) |

**🚨 回帰防止ルール**: PWA に新機能を載せるとき、各ステップ用モーダルが「全部 CockpitMonthlyModal を開くようになる」回帰が **過去 3 回起きてる** (BUGS.md 参照)。月次モーダルへフォールバックするコードを追加するときは、上の表が崩れていないか必ず手動で確認する。

#### 請求月延期時のスキップ動作 (`invoice_ym !== ym`)

`billing_cycles.invoice_ym` を翌月以降に設定した cycle では、当月の月次ルーティンは `reportFix` (月次報告書FIX) 以外を**全部スキップ表示** (= UI から非表示) にする。
詳細は [routine.md](routine.md#請求月延期時のスキップ動作-invoice_ym--ym) 参照。`progressPct` も `reportFix` 1 個基準。月見出し横の `→X月` バッジ (オレンジ) が翌月まとめ請求のシグナル。

#### URL クエリでステップを直接開く

`/project/[projectId]/cockpit?ym=YYYYMM&step=<stepId>` で、起動時にそのステップ用モーダルを開ける。mypage の TODO カード ([pwa/src/app/(app)/mypage/page.tsx:593](src/app/(app)/mypage/page.tsx)) からこの URL に飛ばしてる。`?ym=` だけなら従来通り月次モーダル。

### admin.billing のステップ定義
- 標準: `予算確定 / 報告会 / 報告書 / 立替確認 / 請求発行 / 請求送付 / 支払通知 / 入金確認 / 報酬支払`
- CTB: `予算確定 / 見積送付 / 請求発行 / 報告会 / 請求送付 / 報告書 / 立替確認 / 支払通知 / 入金確認 / 報酬支払`

### shadcn / Tailwind v4 での落とし穴
- `Dialog` 幅: `sm:max-w-sm` が base に仕込まれていて `max-w-[1400px]` で上書き不可。`!important` 必須 → `!max-w-[1400px] sm:!max-w-[1400px]`
- 数値入力で "0" を消したい: `type="number"` ではなく `type="text" inputMode="numeric"` + `onFocus={(e)=>e.target.select()}`
- flex 子の `h-[calc(100vh-Npx)]` が高さ 0 になることがある → `style={{ height: ..., minHeight: 600 }}` で inline 指定 + flex item に `minWidth/minHeight: 0`

### LLM 選定
- 複雑な抽出 (レポート → MS 別 % delta、cluster、divergence): **Sonnet** (`claude-sonnet-4-5-20250929` / 4.6)
- 軽量分類 (auto-tag、ストーリー紐付け、メンバー活動推論): **Haiku** (`claude-haiku-4-5-20251001`)
- 政策シグナルの「事業判断に効くか」二値判定: **Gemini 2.5 Flash** (無料枠で実質無料)
- LLM JSON 出力に生制御文字が混入する → `sanitizeJsonControlChars()` で文字列内のみ sanitize (cluster + divergence で使用)

### RLS / Supabase クライアント
- 読み取り (DEV_MODE): module-level `supabase` (anon)
- 書き込み: 必ず `getAuthClient()` (`createBrowserClient` from `@supabase/ssr`) を都度生成。anon では `is_admin()` が false で INSERT 拒否される
- FK 削除順: `value_milestones` 削除前に `milestone_responsibility` / `milestone_sub_items` を先に DELETE (CASCADE なし)

---

## 10. 既知の TODO / 未着手

設計レベルで残っている課題。新規実装着手時はここを更新する。

- **AMD プロトコル本体**: Atlas (判断の地図) は完成、プロトコル (判断のフレーム) は未着手 (`atlas.md` 参照)
- **Atlas タグ正規化 UI**: 表記揺れ (semiconductor / 半導体 等) 統合管理が数百シグナル超で必要 (`/admin/atlas/tags` 候補)
- **本番認証**: 現状 DEV_MODE。Supabase Auth + RLS ポリシー再構築 (再帰なし) が必要
- **`source_cache` 依存**: `/api/report/generate` が legacy 参照中。GAS L1 cron 廃止で空。レポートは MMO マシン Claude Code で生成 → `monthly_reports` 直接読みに置換するか、PWA 側 generate を廃止するか要決定
- **GAS bridge → PWA 直抽出**: Gmail/source 抽出を PWA サーバーから直接やる設計に置換
- **Supabase → スプシ逆同期**: 現在は GAS → Supabase 一方向のみ。バックアップ手段未定
- **Venture Map**: 数式モデルの未解決論点 5 点 (`venture_map_model.md`)、競合密度 / 予算データ未投入

---

## 11. 関連ドキュメント

| 目的 | ファイル |
|---|---|
| 共通運用ルール (全クライアント) | `/Users/masa/projects/AMD/amd-os/CLAUDE.md` |
| iOS 全画面の正本仕様 | `/Users/masa/projects/AMD/amd-os/ios/DESIGN.md` |
| 既知バグ・教訓 (PWA) | `BUGS.md` |
| 直近セッション + 次の一手 | `HANDOFF_pwa_rebuild.md` |
| 過去セッションログ | `design_log/sessions_YYYY-MM.md` |
| Atlas 全体設計 | `atlas.md` |
| 政策シグナル設計 | `policy_signals.md` |
| 進捗推定設計 | `progress_estimation.md` |
| Venture Map 数理モデル | `venture_map_model.md` |
| PJ Status コックピット (SU 系 PJ の上部セクション) | `cockpit.md` ⭐ |
| AMD Score (Before Zero Theory v3.2、7 軸 Cobb-Douglas) | `amd_score.md` ⭐ |
