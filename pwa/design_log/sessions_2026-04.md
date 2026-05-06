# Sessions Log — 2026-04 (AMD OS PWA)

PWA セッションの作業ログを月単位で集約。
仕様は `SPEC_pwa.md`、バグは `BUGS.md`、直近の引き継ぎは `HANDOFF_pwa_rebuild.md` を参照。

---

## Phase 0 — 基盤構築 (2026-04 初旬)

- Next.js 16 + Tailwind v4 + shadcn/ui で `pwa/` を立ち上げ
- Vercel project `amd-os-pwa` (scope: `armada0130`) 作成
- 本番 URL: https://amd-os-pwa.vercel.app

## Phase 1 — GAS API (legacy)

- `099_PwaApi.js` を ANYONE_ANONYMOUS WebApp として設計
- Supabase 移行後は参照のみ (Gmail 抽出 bridge として残存)

## Phase 2 — Supabase データ移行 (完了)

- プロジェクト: `amd-os-v2` (`nbnhrhybjslbawdukvvk`, Tokyo)
- 28 テーブル + RLS + トリガー
- 移行: members 28 / projects 22 / billing_cycles 126 / milestones 136 / 他
- DEV_MODE 用に全テーブル `anon_read (USING true)`、再帰ポリシー DROP 済み
- `src/lib/supabase-data.ts` で PWA から直接読み取り
- パフォーマンス: GAS API 8-10s → Supabase 0.5s 以下

## Phase 3 — GAS 双方向同期 (完了)

- 共通同期ユーティリティ `012_SupabaseSync.js` / `R012_*` / `S012_*` / `A012_*`
  - `sb_upsert_()` バッチ upsert (200 行/バッチ)
  - `sb_toIso_()` 日本語日時 → ISO 変換
- 主同期ポイント:
  - 本体 GAS `b_upsertRow_()` → BillingCycle 17 箇所自動同期
  - cockpit msProgressSummaryJson / rewardSummaryJson
  - `rv2_upsertProgress()` → milestone_monthly_progress
  - `tasks_upsert/updateStatus()` → tasks
- AMD-Report / Slack / Admin GAS にも同等の同期を実装
- ベストエフォート (Supabase 失敗してもスプシ巻き戻さない)

## Phase 4 — UI 改善 (2026-04-10 完了)

- 月次カード進捗バー: msProgressSummaryJson パース → MS 別内訳展開
- サブ MS 表示 + チェックボックス書き込み (Supabase 直)
- 担当者バッジ (codeName + share%)
- 月次モーダル進捗確認タブ充実 (StatCard 4 + 加重平均バー + MS 別バー)
- カンバン強化 (D&D ステータス変更、詳細モーダル、優先度/MS バッジ)

## Phase 5 — UI 改善 第 2 弾 (2026-04-15 完了)

- 次の期間 MS 設定 UI (`CockpitNextPeriodSetup.tsx`)
  - 現 PlanCycle 終了 3 か月前にバナー表示
  - モーダルから次 PlanCycle / 予算 / MS をフォーム入力
  - `value_plan_cycles` + `value_milestones` 直接書き込み
- admin ページ実データ化 (`/admin/projects` `/admin/members` の MOCK 廃止 → SSR で Supabase 取得)
- API ルートのビルドエラー修正 (createClient のモジュールレベル初期化 → 関数内遅延初期化)

## Phase 6 — 進捗推定 + UI 強化 (2026-04-17 完了)

- 進捗推定 API: `src/lib/progress-estimator.ts` + `src/app/api/progress/estimate/route.ts`
  - GAS `cron_progressEstimateDaily_()` の PWA 移植
  - **ただしソースは monthly_reports.{final,draft}_content** (GAS L1 cron 廃止で source_cache は空)
  - Sonnet 4.5 で MS 別 delta% 抽出 → 累積化
  - routine / pm_manual / criteria_toggle はスキップ、単調増加のみ保存
- レポート生成時に進捗も自動推定 (`/api/report/generate` 内 fire-and-forget)
- 月次モーダル拡張: 「🤖 AI で再推定」ボタン、診断情報メッセージ表示
- MS コミット % 編集 UI (DB 0.0-1.0 ↔ UI 0-100 の変換)
- 既存 MS のコミット表示 100 倍ずれを修正
- 現在/過去の期間 MS 切り替え (折りたたみ)
- draft/active どちらも編集可能 (`directCycleId` / `autoOpen`)
- Kanban done 列トグル
- FK 制約エラー修正 (value_milestones 削除前に responsibility / sub_items を先に DELETE)
- RLS 認証修正 (書き込みは `getAuthClient()` を使う)

## Phase 7 — AI 推定確認ワークフロー + 月次モーダル強化 (2026-04-17 完了)

- DDL: `milestone_monthly_progress.note TEXT` 追加
- `/api/progress/unconfirmed` (GET): `source=tsukuyomi_estimate` の MS を返す (prevPct も)
- `/api/progress/confirm` (POST): adopt / reject / modify / manual の 4 アクション
  - manual は tsukuyomi_estimate 不要で直接 `source→pm_manual` 書き込み
- `progress-estimator.ts`: upsert 時に `note: reason.substring(0, 500)` 追記
- `CockpitMonthlyModal.tsx` 大幅強化:
  - 未確認バナー (amber) + 縞々バー (前月分濃い緑 + 今月推定縞)
  - 採用/不採用/修正インライン UI、✏️ 手動編集ボタン
  - 進捗バー色: `pct>=80→emerald / pct>0→blue(#0066cc) / 0→gray` (黄/赤廃止)
  - 数値入力: `type="text" inputMode="numeric"` + `onFocus select()`
  - reason 復元: `data.details[].reason` を state にマージ (DB note=NULL 回避)

## Phase 8 — 月次モーダル完全実装 + バグ修正 (2026-04-23 完了)

GAS 版差分 41 項目を移植、その後追加改修:

- 「💰 今月の報酬予定額」セクション
  - 旧「翌月予算の参考 (均等割り)」を改名
  - `consumedPt 増分 × 担当割合 × pt 単価` (実績ベース)
  - MS 別テーブルに「今月増分」「前月→今月消化 pt」追加
- 進捗イベント・立替精算を eager loading + 常時展開
- 毎朝 3 時 cron (`/api/cron/daily-estimate`、JST 03:00 = UTC 18:00)
- バグ: 手動進捗変更が効かない → `confirm/route.ts` で `if (!target && action !== "manual")` に修正
- バグ: 手動変更が報酬予定額に即時反映されない → `setLocalProgress` で `consumedPt` も計算してセット

## Atlas Cron 修正 (2026-04-23)

- `CRON_SECRET` を Vercel 本番に設定
- atlas-daily/weekly/monthly route の認証パターンを `daily-estimate` と統一
- `src/lib/supabase/middleware.ts`: `/api/` パスを auth redirect から除外
- `atlas-report.ts` の `gemini-1.5-flash` (404) → `claude-haiku-4-5-20251001` に差し替え

## マイページ「今月の活動」(2026-04-25 完了)

- DDL: `milestone_responsibility` に `role TEXT DEFAULT '担当'` + `task_description TEXT`、UNIQUE を `(milestone_id, member_id, role)` に張り替え
- `member_activities` テーブル新設 (PK=UUID, source CHECK に 'inferred')
- `supabase-data.ts` 拡張: `MemberActivity` 型、`fetchMemberActivities()` / `upsertMemberActivities()` / `replaceInferredActivities()`
- `CockpitNextPeriodSetup` に役割・業務内容入力行 (担当/統括/レビュー/サポート + 業務内容テキスト)
- `/api/cron/member-activities`: 全 active PJ × monthly_reports + responsibility → Haiku 推論 → member_activities に削除+再挿入
- vercel.json `"0 19 * * *"` (毎日 04:00 JST)
- `/mypage/page.tsx`: 参加 PJ ごとに activities + billing_cycles.rewardSummaryJson 報酬額表示
- DEV_MODE: メンバー選択ドロップダウン (本番は Auth で自動特定)
- 「今すぐ推論」ボタンで cron API 手動キック可能

## Atlas 大規模拡張 (Session 9, 2026-04 後半)

### 運用基盤
- タグ自動付与 API `/api/atlas/auto-tag` (Haiku 4.5)
- submit ページに「✨ 自動でタグ付け」+ 投入時の空欄自動補完
- Inbox 簡素化: topic 選択モーダル廃止、Accept は 1 クリック
- Inbox 一括 Accept: `acceptAllInboxSignals()`
- メイン /atlas をシグナル一覧に (検索 + 重要度 + 分野 + タグ複数フィルタ)
- データモデルを「signal + tags 中心」に再設計 (PJ/topic 階層化禁止を継承)

### 自動収集 / 遡及 / 一括投入
- `/api/cron/atlas-collect` (毎朝 08:00 JST): Sonnet 4.6 + `web_search_20250305` (max_uses 8) → 8-14 件 → タグ付け → insert
- `/api/atlas/backfill?domain=X&months=N`: 分野別遡及 (A-O の 15 分野)
- `/api/atlas/seed`: 一括投入 (Bearer auth)
- 過去 3 ヶ月 × 15 ドメイン = 113 件 backfill 済み

### ストーリー化 (Phase 1-3, A 案完全実装)

**Phase 1 — DDL + 紐付け**
- migration `001_atlas_stories.sql`: `atlas_stories` + `atlas_signals.story_id`
- `attachStory()`: 投入時に Haiku が既存への紐付け or 新規作成を判定
- 既存 145 シグナル → 93 ストーリーに集約 (multi-signal 42, singleton 51)
- atlas-collect / backfill / seed すべてに統合

**Phase 2 — メイン /atlas ストーリー優先表示**
- ストーリーカード (signal_count 大表示) → クリックで時系列タイムライン展開
- 未紐付けは折り畳み「未紐付けシグナル」セクション
- Map ボタン primary 塗り

**Phase 3 — /atlas/map ストーリーノード集約**
- ノード: ストーリーのみ (タグノード廃止)、色=分野、サイズ=signal 数
- エッジ: 共通タグ ≥2 のストーリー対 (各から類似度上位 3 件)
- パルス演出: HIGH かつ signal≥3 に琥珀色波紋 (`autoPauseRedraw={false}` で常時 redraw)
- NEW バッジ: 直近 24h に新シグナル (last_updated_at ではなく内部 signals の最新 submitted_at)
- ピン留め: ドラッグ後 fx/fy 固定。他ノードドラッグで前固定が自動解除
- 複数選択フィルタ (Set ベース)

### ストーリー統合フィードバック学習
- migration `002_atlas_story_merges.sql`: `atlas_story_merges`
- `/api/atlas/merge-stories`: signals 移動 + tags/signal_count マージ + from 削除 + ログ
- 詳細パネル下部に「⇄ 他のストーリーと統合」ボタン (候補モーダル + 理由入力)
- `atlas-stories-server.ts` の story-matching プロンプトに **直近 12 件の merge log** を「過去にユーザーが同じとみなしたパターン」として注入

### DDL 自動適用フロー確立
- `scripts/apply_ddl.py`: Supabase Management API (`/v1/projects/{ref}/database/query`)
- `.env.local` の `SUPABASE_ACCESS_TOKEN` (sbp_…) 使用、**User-Agent 必須** (Cloudflare 1010 回避)
- migrations は `scripts/migrations/NNN_name.sql` に必ず残す

## Session 10 — Atlas 政府方針シグナル (2026-04 後半)

- 設計ログ: `design_log/2026-04_policy_signals.md` 新規
- 既存 `atlas_signals` に同居 (PJ/topic 階層化禁止を継承)
- 直近 1 か月 RSS で 125 件 / 65 ストーリー / high=18 件 投入

### DDL (migration 003)
- `atlas_signals.metadata jsonb` 追加
- `source_type` CHECK に `'policy'` 追加 (DO ブロックで動的張替)
- インデックス: source_url / source_type / metadata->>ministry / metadata->>announced_at

### 収集パイプライン
- `src/lib/atlas-policy-sources.ts`: 省庁ごと fetcher
  - 稼働: 厚労省・国交省・内閣府・首相官邸・文科省 (5 省庁、~180 件/取得)
  - RSS は fast-xml-parser、HTML は Gemini Flash 抽出に分岐
  - 未対応: 経産省 (Vercel から timeout)、環境省 (HTML 200KB+)、e-Gov パブコメ (403)
- `src/lib/atlas-policy-filter.ts`: Gemini 2.5 Flash で「事業判断に効くか」二値判定 (バッチ並列、無料枠で実質無料)
- `src/lib/atlas-policy-extract.ts`: 詳細 HTML → Sonnet 4.6 で AMD 視点 200-400 字要約 + tags + importance + doc_type
- `src/lib/atlas-policy-pdf.ts`: 重要度 high のみ PDF を Anthropic document content block で深掘り
- `/api/cron/atlas-collect-policy`: 毎朝 07:00 JST、`?since=YYYY-MM-DD&limit=N&step=...&dryrun=1` 対応
  - 多段 dedup: source_url 完全一致 + ministry×date×title 先頭 20 字
  - 並列度 4 で attachStory + insert

### Inbox UI
- `AtlasSignal` 型に `source_type='policy'` + `metadata` 追加
- /atlas/inbox: 全部 / ニュース / 政策 トグル + 各シグナルに `📋 経済産業省` 等の省庁バッジ

## Session 11 — マクロトレンドマップ + 周辺整備 (2026-04-30 完了)

### 一人称ルール強化 (仕組み化)
- `~/.claude/CLAUDE.md` を全プロジェクト共通ルールとして配置
- `pwa/CLAUDE.md` を PWA 固有のみにスリム化
- メモリに `feedback_first_person.md` 追加
- 一人称: 「えいみ」「あたし」のみ

### Atlas Map チューニング
- 初期 zoom 縮小すぎ → `zoomToFit(0,0)` 後 ×2.6 拡大、`centerAt(0,0)`
- 孤立ノード対策: カスタム力 `isolatedCenterForce` (α×0.04) で中央方向に弱く引く
- 反発 -450 / リンク距離 140
- `didInitialFitRef` で初回 1 回だけ fit

### /atlas ストーリー操作強化
- ストーリーカード `<button>` → `<div role="button">` + `select-text` + `stopPropagation` でコピー可
- 各シグナルに「✕ 外す / → 移植 / ✦ 新規ストーリー化」
- `/api/atlas/move-signal` (detach / moveToExisting / createNew、createNew は LLM がタイトル提案)
- `MoveSignalModal` で候補リスト + 移植実行

### マクロトレンドマップ Phase 1-3

**Phase 1 — テーマ定義**
- migration `004_atlas_themes.sql`: `atlas_themes` + `atlas_story_themes`
- `/api/atlas/themes/cluster`: Sonnet 4.6 で 30-50 テーマ提案
- `/api/atlas/themes/apply`: 確定 + 紐付け
- `/atlas/admin/themes` 管理 UI
- LLM JSON の生制御文字混入対策 → `sanitizeJsonControlChars()` (cluster + divergence)
- **54 テーマ確定** (水素・アンモニア / 電池材料 / 半導体 / AI 規制 / 洋上風力 等)

**Phase 2 — divergence 生成**
- migration `005_atlas_divergences.sql`: テーマ単位 世界/日本 要約 + 乖離度 + 活発度
- `/api/cron/atlas-divergence` (週 1, 日曜 21:00 UTC)
  - 紐付け story → 配下 signals → `source_type='policy'` を日本、それ以外を世界として Sonnet 4.6
  - 出力: global_summary / japan_summary / divergence_message / divergence_score / global_intensity / japan_intensity / signal_breakdown
  - 並列度 4 (54 テーマ ≈ 100s)
- vercel.json で maxDuration=300

**Phase 3 — UI (`/atlas/divergence`)**
- 3 ビュー: 🃏 カード / 📍 散布図 / 🔥 ヒートマップ
- フレーミング = 「マクロトレンド主体」、サブ「世界×日本×ギャップ」
- カード: 世界/日本要約 2 カラム並列メイン、ギャップは末尾補足
- 散布図: x=世界活発度 y=日本活発度、対角線=同期、点サイズ=ギャップ
- ヒートマップ: 色軸トグル + 分野グルーピング
- ソート: 世界の動き順 / ギャップ順 / 日本の動き順
- 詳細パネル: ズレ本質メッセージ + 世界/日本要約 + 一次ソース + 省庁バッジ + タグ

### Atlas ナビ整理
- /atlas ヘッダーに「📊 トレンド」(amber primary) + 「テーマ管理」
- 旧 `/atlas/topics` (signal+tags 中心化で形骸化) と `/atlas/reports` (source_cache 依存で空) を削除
- 残存: 一覧 / 🗺 Map / 📊 トレンド / 判断ログ / Inbox / テーマ管理 / Admin
