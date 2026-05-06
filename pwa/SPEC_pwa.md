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
│   │   └── ...
│   ├── middleware.ts            ← `/((?!_next/static|...)).*` で auth check
│   └── types/
├── supabase/                    ← (モノレポ ios/supabase が正本)
├── vercel.json                  ← cron 定義
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

### `(app)/` 配下 (auth 必須、middleware が gate)

| パス | 機能 |
|---|---|
| `/dashboard` | トップ。PJ 一覧 + Atlas/Venture Map/MyPage/Admin への入口 |
| `/mypage` | 自分の参加 PJ × 今月の活動 + 月次報酬予定 (取り消し線 = 未完月次ルーティンによる除外) |
| `/project/[projectId]/cockpit` | PJ コックピット (MS / 月次カード / カンバン / ナッジ / 月次ルーティン) |
| `/reimburse` | 立替精算 |
| `/settings` | 設定 |
| `/atlas` | シグナル & ストーリー一覧 |
| `/atlas/inbox` | 未確認シグナル (政策/ニュース フィルタ + 一括 Accept) |
| `/atlas/inbox/submit` | 手動投入 (auto-tag 付) |
| `/atlas/map` | ストーリーノードグラフ |
| `/atlas/divergence` | マクロトレンドマップ (世界×日本 3 ビュー: カード / 散布図 / ヒートマップ) |
| `/atlas/decisions` | 判断ログ |
| `/atlas/admin/themes` | テーマクラスタリング管理 |
| `/venture-map` | 9 社 SU プロット (View A) |
| `/venture-map/su/[id]` | SU 個別ビュー (XRL × マクロ指数) |
| `/venture-map/oscillator` | (実験) coupled oscillator 可視化 |
| `/venture-map/state-space` | (実験) Triple Helix 状態空間 |
| `/admin/billing` | admin 立替/請求マトリクス (チップ操作で billing_cycles 直更新) |
| `/admin/payouts` | 報酬支払 |
| `/admin/projects` `/members` `/contexts` `/protocols` `/tsukuyomi` `/settings` | 各 admin |

### API routes (`/api/`)

**進捗:** `progress/estimate` `progress/confirm` `progress/unconfirmed` `progress/batch-save` `progress/events` `progress/revisions` `progress/reimbursement`
**Atlas:** `atlas/auto-tag` `atlas/backfill` `atlas/seed` `atlas/match-stories` `atlas/merge-stories` `atlas/move-signal` `atlas/themes/{cluster,apply,list}`
**請求/レポート:** `invoice/{create,preview}` `report/{generate,fix}`
**その他:** `activities/infer`

### Cron (`vercel.json`、UTC、Hobby plan で maxDuration=300 上限)

| path | schedule (UTC) | JST | 内容 |
|---|---|---|---|
| `cron/daily-estimate` | `0 18 * * *` | 03:00 daily | 全 active PJ の進捗推定 |
| `cron/atlas-collect` | `0 23 * * *` | 08:00 daily | マクロニュース 8-14 件 + auto-tag + insert |
| `cron/atlas-collect-policy` | `0 22 * * *` | 07:00 daily | 政府方針シグナル収集 (5 省庁) |
| `cron/atlas-daily` | `0 21 * * *` | 06:00 daily | atlas 日次レポート |
| `cron/atlas-weekly` | `0 8 * * 5` | 17:00 fri | atlas 週次 |
| `cron/atlas-monthly` | `0 22 1 * *` | 07:00 month-1 | atlas 月次 |
| `cron/atlas-divergence` | `0 21 * * 0` | 06:00 sun | テーマ単位 divergence 再生成 (54 テーマ ≈ 100s) |
| `cron/member-activities` | `0 19 * * *` | 04:00 daily | 月次レポート + responsibility → Haiku 推論 → member_activities |
| `cron/relearn-lane-weights` | `30 18 * * *` | 03:30 daily | macro lane weights 再学習 |
| `cron/macro-backfill-historical` | `0 3 * * 0` | 12:00 sun | 2010-2025 macro_index_log を Sonnet 推定で埋める |

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
| `reimbursements` | 立替 (status: `submitted` `pmapproved` `approved` ...) |

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
| `ventures` | 9 社 SU |
| `ventures_xrl_log` | TRL/BRL/HRL 時系列 + `bottleneck` |
| `seeds` | seed 管理 |
| `papers_log` | OpenAlex 論文数 (lane × month) |
| `macro_index_log` | マクロ指数 (lane × month、Atlas 集計 + Sonnet 2010-2025 推定) |
| `macro_lane_weights` | レーン重み (Sonnet が毎日再学習) |

### つくよみ / その他

`tsukuyomi_nudge_queue` `tsukuyomi_learnings` `ms_progress_revisions` `ms_revision_messages` `source_cache` (legacy / 実質空)

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

### 月次ルーティン
- 標準: `請求額確定 / 報告会日程調整 / 月次報告書FIX / 立替精算確認 / 請求書発行 / 請求書送付`
- CTB: `見積書送付` + 標準
- 並びは古い月が上
- 期限超過かつ未完なら mypage の月次報酬から **取り消し線** で除外
- ただし `billing_cycles.status` が `payment_confirmed` / `reward_paid` / `completed`、または `payment_confirmed_at` / `reward_paid_at` あれば admin 救済済みとして除外しない

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

- **AMD プロトコル本体**: Atlas (判断の地図) は完成、プロトコル (判断のフレーム) は未着手 (`design_log/2026-04_atlas.md` 参照)
- **Atlas タグ正規化 UI**: 表記揺れ (semiconductor / 半導体 等) 統合管理が数百シグナル超で必要 (`/admin/atlas/tags` 候補)
- **本番認証**: 現状 DEV_MODE。Supabase Auth + RLS ポリシー再構築 (再帰なし) が必要
- **`source_cache` 依存**: `/api/report/generate` が legacy 参照中。GAS L1 cron 廃止で空。レポートは MMO マシン Claude Code で生成 → `monthly_reports` 直接読みに置換するか、PWA 側 generate を廃止するか要決定
- **GAS bridge → PWA 直抽出**: Gmail/source 抽出を PWA サーバーから直接やる設計に置換
- **Supabase → スプシ逆同期**: 現在は GAS → Supabase 一方向のみ。バックアップ手段未定
- **Venture Map**: 数式モデルの未解決論点 5 点 (`design_log/2026-05_venture_map_model.md`)、競合密度 / 予算データ未投入

---

## 11. 関連ドキュメント

| 目的 | ファイル |
|---|---|
| 共通運用ルール (全クライアント) | `/Users/masa/projects/AMD/amd-os/CLAUDE.md` |
| iOS 全画面の正本仕様 | `/Users/masa/projects/AMD/amd-os/ios/DESIGN.md` |
| 既知バグ・教訓 (PWA) | `BUGS.md` |
| 直近セッション + 次の一手 | `HANDOFF_pwa_rebuild.md` |
| 過去セッションログ | `design_log/sessions_YYYY-MM.md` |
| Atlas 全体設計 | `design_log/2026-04_atlas.md` |
| 政策シグナル設計 | `design_log/2026-04_policy_signals.md` |
| 進捗推定設計 | `design_log/2026-04_progress_estimation.md` |
| Venture Map 数理モデル | `design_log/2026-05_venture_map_model.md` |
