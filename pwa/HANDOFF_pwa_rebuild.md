# HANDOFF: AMD OS PWA再構築

## 最終更新
2026-05-04 (えいみ・夜セッション) — つくよみマスコット本番投入完了

---

## 作業状態（2026-05-04 夜セッション）— つくよみマスコット本番投入

### 概要
`(app)` レイアウト全画面の右下にチビキャラのつくよみアニメーションを常駐させた。本番反映済・確認済。

### 直近で変更したファイル
- `pwa/src/components/tsukuyomi/Sprite.tsx` (新規) — CSS background-position で1アニメ描画、`flipX` prop 対応
- `pwa/src/components/tsukuyomi/Mascot.tsx` (新規) — corner常駐 + mood swap + タップ反応、左向き固定
- `pwa/public/tsukuyomi/sheet-v4.png` (新規、1.2MB) — 統合スプライトシート 2304×512
- `pwa/src/app/(app)/layout.tsx` (修正) — `<TsukuyomiMascot />` を `<main>` の後にマウント
- `pwa/HANDOFF_pwa_rebuild.md` (このファイル) — 引き継ぎ更新
- `pwa/BUGS.md` — 教訓追記

### 実行したビルド・テスト・デプロイ
- `tsc --noEmit` 合格 (各commit前)
- ローカル dev (port 3464) で `/tsukuyomi-test` を緑背景で目視確認
- `npx vercel --prod --yes` で本番デプロイ (4回: v4基本→18frame拡張→flipX→FPS半減)
- 中間で test page (`/tsukuyomi-test`) と middleware 例外を作って検証 → 本番投入時に両方revert
- main へ全 commit push 済

### 確認済み (実機/ブラウザ/本番)
- ✅ `https://amd-os-pwa.vercel.app/tsukuyomi-test` (削除前) — Chrome経由で緑背景に透過合成、足元アライン、4アニメ正常ループ確認
- ✅ corner mascot を Chrome で表示確認 (scale 0.9、左向き)
- ✅ `https://amd-os-pwa.vercel.app/tsukuyomi/sheet-v4.png` 200 OK (RGBA 2304×512)
- ⚠️ `/dashboard` 等の認証必須画面はえいみ環境からログインできないので、最終確認はまさが目視で実施 → OK 反応もらってる

### 採用した素材 (v2 / Codex生成)
- 場所: `/Users/masa/projects/masa/output/tsukuyomi_animations_amd/`
- 4 アニメ: idle / happy / thinking / wave
- 各 18 frames × 128×128px、足元アンカー (64, 124) で正規化済
- 全部透過処理済、artifact なし。`manifest.json` に詳細

### 実装ポイント
- 統合シートは `/tmp/combine_v2_frames.py` で生成 (FRAMES_PER_ROW=18, ROWS=4)
- FPS設定 (Mascot.tsx 内、最終): `{ idle: 5, happy: 7, thinking: 5, wave: 7 }`
- mood swap: 30-90s 間隔でランダムに happy/thinking/wave に 1.8s 切替 → idle に戻す
- タップ: wave 1.8s
- flipX: scale を負にする CSS transform (`scaleX(-1)`)、画像差し替え不要

### 経緯 (短く)
1. 元シート `tsukuyomi-sheet.png` (annotation付参考用) を pixel filter + 連結成分で自動クリーン → 線残り/透過抜け解決できずユーザーNG
2. 実装すべて削除 (commit `76bb5a6`)
3. ユーザーがCodexに依頼してクリーン素材生成 (`tsukuyomi_animations_amd/`)
4. その素材ベースで再実装 → 一発OK

### Commit ログ（時系列）
| commit | 概要 |
|---|---|
| `c9c7a1a` | (旧) PWA dashboard: add Tsukuyomi floating mascot — 自動クリーン版、後に rollback |
| `76bb5a6` | PWA: remove Tsukuyomi mascot (rolling back to pre-implementation) |
| `57d0fbd` | PWA: add Tsukuyomi mascot to (app) layout — **採用版** |
| `662fb94` | PWA: halve Tsukuyomi mascot FPS for calmer feel |
| `89d84b4` | HANDOFF: document Tsukuyomi mascot session (前回ハンドオフ) |

### 未解決タスク
- なし（つくよみ機能は本番に反映済・ユーザーOK）
- 将来やるかも:
  - 状態(loading/empty/error)に応じてアニメ切替 (Mascot に Context API 追加が必要)
  - mood pickup の重み付け / 時間帯依存
  - クリックでつくよみAI(`/admin/tsukuyomi` の知識ベース) と連携させる導線

### 次セッションの最初の一手
- まさから新しい指示を待つ。
- もしまさが「つくよみのアニメ追加・差し替え」を依頼してきたら:
  1. 新素材を `/Users/masa/projects/masa/output/tsukuyomi_animations_amd/` の構造に合わせてもらう
  2. `/tmp/combine_v2_frames.py` を frames数に合わせて編集 → 統合シート生成
  3. `Sprite.tsx` の `SHEET_W` / `ANIMATIONS` を更新
  4. `Mascot.tsx` の `FPS` / `pickMood()` の候補を更新
  5. `cd /Users/masa/projects/AMD/amd-os/pwa && npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os/pwa`
- もしまさが「PWA他箇所の修正」なら、CLAUDE.md と BUGS.md を先に読んで運用ルールを確認

### 注意・運用ルール (再発防止)
- **Vercel デプロイは CLI 直叩きが正本** (Git連携ではない)。コマンドは `npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os/pwa` (`--cwd` 必須、CLAUDE.md 参照)。
- main checkout には pwa/types/, pwa/design_log/ などの **uncommitted ファイルが大量にある** (まさの作業)。`git status` で見えても触らない・自分の commit に含めない。
- `tsukuyomi-sheet.png` (リポルートに置かれた annotation付参考用、git未追跡) はもう使わない。Codex生成素材を使う。
- 元シートのような annotation 付きシートを自動クリーンしようとすると線残りが消えない。BUGS.md 参照。

---

## 作業状態（2026-05-04 午後セッション）— Venture Map 本番反映完了

### 今回やったこと

1. **Vercel deploy 完了** (commit `3d67e05` 含む最新HEAD)
   - deployment id: `dpl_EuyyvrKdcmvUkTNjLSLk1ntXmW54`
   - alias: https://amd-os-pwa.vercel.app
   - SU個別ビュー (`/venture-map/su/[id]`) と macro-backfill cron が本番に反映

2. **macro-backfill-historical 手動キック完了**
   - 5レーン × 192月 = **960行** INSERT、所要 250秒（300s 上限内）
   - サンプル品質 OK: gx_energy 2020-10（菅カーボンニュートラル宣言）で 0.67→0.84 ジャンプ
   - 全レーン 192件ずつ揃った状態 (gx_circular/gx_energy/life/materials/robo)

3. **types/database.ts コミット** (`3d67e05`)
   - 4ファイル (CockpitKanban/Goals/Routine + mock-data) から import されてたが untracked だった
   - 別マシンで build 失敗するリスクを解消

4. **デモ動作確認 (Chrome MCP)**
   - View A: 9社全 `<a href="/venture-map/su/{id}">` リンク化確認
   - SU個別ビュー (tiem): h1/outcome/SVG 4 path/24 circle/年表7行/「ボトルネック: HRL」表示
   - SU個別ビュー (bwe): h1/SVG 4 path/17 circle/マクロ指数 path 2736 文字（2010-2025 連続データ）

### 前セッション (午前) でやったこと（すべて commit & push 済み: `feb45c9`, `4038e39`）

#### 1. ventures_xrl_log 9社シード値投入
- ファイル: `pwa/scripts/migrations/007_ventures_xrl_log_seeds.sql`
- Supabase に適用済み（`python3 -X utf8 scripts/apply_ddl.py` で OK 確認）
- 9社 × 複数観測点。`bottleneck` フィールドで XRL ボトルネックレイヤを記録
- ティエム: HRL2 で終了 / YD: BRL2 で終了 / JC: BRL3 で終了

#### 2. SU 個別ビュー
- `pwa/src/app/(app)/venture-map/su/[id]/page.tsx` — Server component
- `pwa/src/components/venture-map/SuDetailView.tsx` — Client component
  - SVG で TRL(青)/BRL(橙)/HRL(緑) 折れ線 × そのレーンのマクロ指数(破線)を重ね表示
  - ボトルネックポイントに輪を付与
  - マイルストーン年表テーブル付き
- `venture-map-data.ts` に `fetchXrlLog()` / `fetchVentureById()` 追加
- View A の SU ドットに `<a href="/venture-map/su/{id}">` でリンク追加

#### 3. マクロ指数遡及拡張 cron（Sonnet 駆動）
- `pwa/src/app/api/cron/macro-backfill-historical/route.ts`
- レーンごとに Sonnet へ政策マイルストーン文脈を渡し、2010-2025 の月次 index_value を推定
- 既存行は ON CONFLICT DO NOTHING で保護
- `vercel.json` に `"schedule": "0 3 * * 0"` (毎週日曜 03:00 UTC) 追加

#### 4. 数理モデル設計書
- `pwa/design_log/2026-05_venture_map_model.md`
- 数式①〜④ の変数定義・データソース・未解決論点を網羅
- 他セッションでモデルを議論する起点として整備

#### 5. ティエム・JC knowledge 追記
- `pwa/design_log/2026-05_su_knowledge_tiem_jc.md`
- デモナレーション向けの SU 背景・XRL 軌跡・AMD 教訓を記録

### Venture Map の現データ状態

| 要素 | 状態 |
|---|---|
| 9社プロット | ✅ Supabase ventures |
| XRL 時系列 | ✅ ventures_xrl_log（推定シード値）|
| 論文数 | ✅ papers_log（OpenAlex 2010-2026）|
| マクロ指数 2026- | ✅ macro_index_log（Atlas 集計）|
| マクロ指数 2010-2025 | ✅ Sonnet 推定 960行投入済み |
| XRL × マクロ SU個別ビュー | ✅ 本番反映済み |
| 重みパラメータ | ✅ macro_lane_weights（Sonnet 毎日 18:30 UTC 更新）|

### 次の最初のアクション

5/20 スタパデモまでの残課題：

1. **未解決論点5点を議論・決定**（`pwa/design_log/2026-05_venture_map_model.md` に結論追記）
2. **`B_i(t)` 予算データ投入** (NEDO/AMED 公開データから)
3. **競合密度 $C_i(t)$ の実装方法決定**
4. （状況に応じて）デモナレーション資料の確認（`2026-05_venture_map_theory_strategy.pptx` がリポに置かれている）

---

## 作業状態（2026-05-04 午前）— Venture Map Phase 7 完成

### 今回やったこと（すべて commit & push 済み: `feb45c9`, `4038e39`）

#### 1. ventures_xrl_log 9社シード値投入
- ファイル: `pwa/scripts/migrations/007_ventures_xrl_log_seeds.sql`
- Supabase に適用済み（`python3 -X utf8 scripts/apply_ddl.py` で OK 確認）
- 9社 × 複数観測点。`bottleneck` フィールドで XRL ボトルネックレイヤを記録
- ティエム: HRL2 で終了 / YD: BRL2 で終了 / JC: BRL3 で終了

#### 2. SU 個別ビュー
- `pwa/src/app/(app)/venture-map/su/[id]/page.tsx` — Server component
- `pwa/src/components/venture-map/SuDetailView.tsx` — Client component
  - SVG で TRL(青)/BRL(橙)/HRL(緑) 折れ線 × そのレーンのマクロ指数(破線)を重ね表示
  - ボトルネックポイントに輪を付与
  - マイルストーン年表テーブル付き
- `venture-map-data.ts` に `fetchXrlLog()` / `fetchVentureById()` 追加
- View A の SU ドットに `<a href="/venture-map/su/{id}">` でリンク追加

#### 3. マクロ指数遡及拡張 cron（Sonnet 駆動）
- `pwa/src/app/api/cron/macro-backfill-historical/route.ts`
- レーンごとに Sonnet へ政策マイルストーン文脈を渡し、2010-2025 の月次 index_value を推定
- 既存行は ON CONFLICT DO NOTHING で保護
- `vercel.json` に `"schedule": "0 3 * * 0"` (毎週日曜 03:00 UTC) 追加

#### 4. 数理モデル設計書
- `pwa/design_log/2026-05_venture_map_model.md`
- 数式①〜④ の変数定義・データソース・未解決論点を網羅
- 他セッションでモデルを議論する起点として整備

#### 5. ティエム・JC knowledge 追記
- `pwa/design_log/2026-05_su_knowledge_tiem_jc.md`
- デモナレーション向けの SU 背景・XRL 軌跡・AMD 教訓を記録

### ビルド・デプロイ状態
- `npx tsc --noEmit` → エラーなし ✅
- Vercel deploy: **未実行** ⚠️ 次セッションで deploy + 動作確認が必要

### Venture Map の現データ状態

| 要素 | 状態 |
|---|---|
| 9社プロット | ✅ Supabase ventures |
| XRL 時系列 | ✅ ventures_xrl_log（推定シード値）|
| 論文数 | ✅ papers_log（OpenAlex 2010-2026）|
| マクロ指数 2026- | ✅ macro_index_log（Atlas 集計）|
| マクロ指数 2010-2025 | ⚠️ cron 未実行（Sonnet 推定値は初回 cron 後に入る）|
| XRL × マクロ SU個別ビュー | ✅ 実装済み・未 deploy |
| 重みパラメータ | ✅ macro_lane_weights（Sonnet 毎日 18:30 UTC 更新）|

### 次の最初のアクション

1. **Vercel deploy** — `venture-map/su/[id]` を本番反映する
2. **macro-backfill-historical 手動キック** — `CRON_SECRET` を Authorization ヘッダーにセットして一度叩いて 2010-2025 の macro_index_log を埋める
3. **デモ通し確認** — View A ピンクリック → SU 個別ビューの遷移・グラフ表示を確認
4. （必要なら）投資データ `V_i(t)` の実数値投入 — 現在は仮値（macro と papers の平均）

### モデル議論が必要な未解決論点（`2026-05_venture_map_model.md` 参照）

1. $D'$ 極大 = 最適投入点か？（変曲点の少し後が良いという仮説あり）
2. $\sigma_{\mathrm{SU}}$ の積分窓 $\Delta t$ はレーン依存にすべきか
3. 競合密度 $C_i(t)$ の実装方法
4. XRL の $\kappa$ チューニング vs TRL 下限閾値ルール
5. $B_i(t)$ 予算データ投入（NEDO/AMED 公開データ）

---

## 最終更新（旧: 2026-05-02）
2026-05-02 (Codex) — PWA正本運用、Gmail抽出ブリッジ、MyPage報酬除外、admin.billing Swift寄せ + インライン操作

## 現在の正本パス
- **PWA正本**: `/Users/masa/projects/AMD/amd-os/pwa`
- **Vercel本番**: https://amd-os-pwa.vercel.app
- 古いメモや一部docには `/Users/masa/projects/amd-os/pwa` が残っている。次回作業は必ず `/Users/masa/projects/AMD/amd-os/pwa` を使う。
- Vercel deploy は `--cwd /Users/masa/projects/AMD/amd-os/pwa` 必須。cwd違いで全ルート404事故が過去にある。

## デプロイ方式・repo/branch
- **現在のPWA本番反映は、Vercel CLIでローカルから直接deployする運用**。
- **VercelのGit自動deploy、別repo、別branchを正本として使っていない**。Claude/Codexがdeployする場合はローカルcheckoutをそのままVercel CLIに渡す。
- 実装ベースは `main` checkout:
  - path: `/Users/masa/projects/AMD/amd-os/pwa`
  - remote: `https://github.com/masa-teamarmada/amd-os.git`
  - branch: `main`
- ただし現状は移行直後の大きな未コミット差分を含む。**リモート `main` のHEADだけを見ても本番相当とは限らない**。
- `.vercel/project.json` は `amd-os-pwa` にlink済み:
  - projectName: `amd-os-pwa`
  - projectId: `prj_raZW3HSKIszzPUwNTHfy7xDGzLHm`
- deploy正本:
```bash
PATH=/tmp/codex-npm-bin:/Users/masa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os/pwa
```

## 今回の作業状態（2026-05-02）

### PWA正本・deploy
- `amd-os-pwa` 側が Atlas まで実装済みの正本と判断され、AMD OS配下のPWA正本として `/Users/masa/projects/AMD/amd-os/pwa` で継続。
- build/deploy は複数回成功。最新の本番 alias は `https://amd-os-pwa.vercel.app`。
- 最新確認済みdeploy:
  - `dpl_HEVJAR3W4DZADXjwSUpcJk2EFkTo` / `https://amd-os-m5znlz9mj-armada0130.vercel.app`
  - alias: `https://amd-os-pwa.vercel.app`

### Gmail/source extraction bridge
- 「つくよみ修正依頼」で実データ抽出が必要になり、短期経路として `PWA Next API -> GAS pwaApi adapter -> Gmail extraction -> source_cache -> member_activities` を実装。
- GAS側:
  - `/Users/masa/projects/AMD/amd-os/gas/099_PwaApi.js`
  - `/Users/masa/projects/AMD/amd-os/gas/001_Router.js` に `mode=pwaApi`
  - `/Users/masa/projects/AMD/amd-os/gas/appsscript.json` は anonymous webapp向けに調整済み
- `clasp login` 済み、GAS push/deploy済み。古いGAS deploymentは全部ではなく適度に削除し、バックアップを残す運用にした。
- `.env.local` / `.env.production.local` / Vercel env `NEXT_PUBLIC_GAS_WEBAPP_URL` は anonymous deployment URL に更新済み。
- ユーザー確認: 「ちゃんとメール読んでくれるようになった」。
- TODO: 長期的にはPWAサーバーから直接 Gmail/source を抽出する設計へ置き換える。GAS bridge は temporary adapter として扱う。

### MyPage
- ログイン中アカウントのメンバーでMyPage表示する仕様に整理済み。
- 過去月も表示。
- 「いまやること」実装済み。
- 月次ルーティン:
  - 古い月が上に来る並びに変更。
  - `入金確認` をPWA月次ルーティンから削除。
  - 標準: `請求額確定 / 報告会日程調整 / 月次報告書FIX / 立替精算確認 / 請求書発行 / 請求書送付`
  - CTB: `見積書送付` + 標準。
- 当月報酬合計:
  - 月次ルーティンのいずれかが期限超過かつ未完なら、そのPJ報酬を取り消し線表示し、合計から除外。
  - `billing_cycles.status` が `payment_confirmed` / `reward_paid` / `completed`、または `payment_confirmed_at` / `reward_paid_at` がある場合は admin救済済みとして除外しない。

### 月次モーダル・進捗
- モーダル内の手動進捗変更が進捗バーとサマリーカードに反映されるよう調整済み。
- 進捗バーは前月分・今月分・つくよみ推定分・本来ラインを復活済み。
- 各MS右カードに、その月に抽出された仕事を表示。
- つくよみ推定/修正依頼:
  - `/api/progress/revisions` が `ms_progress_revisions` / `ms_revision_messages` / `tsukuyomi_learnings` を扱う。
  - Gmail/mail系修正依頼はGAS経由でsourceを取りに行く。
  - adminページでつくよみ学習状況を表示。

### admin.billing
- いったんSwift版に寄せ、横長表から「月ごとのPJリスト + ステップ表示」に変更。
- 現在は小さいドットではなく、タスク名入りチップを一覧に直接表示。
- チップクリックでメニュー:
  - `完了にする`
  - `未完にする`
- チップ操作で `billing_cycles` を直接更新し、画面も即時反映。
- 右端矢印 or PJ名クリックで詳細モーダルも残している。
- ステップ定義:
  - 標準: `予算確定 / 報告会 / 報告書 / 立替確認 / 請求発行 / 請求送付 / 支払通知 / 入金確認 / 報酬支払`
  - CTB: `予算確定 / 見積送付 / 請求発行 / 報告会 / 請求送付 / 報告書 / 立替確認 / 支払通知 / 入金確認 / 報酬支払`
- `立替確認` は手動変更不可。Swift同様、立替データから自動判定。
- `立替確認` 判定の最新ルール:
  - 対象稼働月の翌月4日を締切にする。
  - 締切日が土日なら前営業日にする。
  - 締切日前は未完扱い。
  - 締切日以降、`reimbursements.status` が `submitted` / `pmapproved` の未処理立替がなければ完了。
  - 例: `202606` 稼働分は `2026-07-04` が土曜なので `2026-07-03` に完了判定。

## 直近で変更した主なファイル
- `/Users/masa/projects/AMD/amd-os/pwa/src/components/admin/AdminBillingMatrix.tsx`
- `/Users/masa/projects/AMD/amd-os/pwa/src/app/(app)/admin/billing/page.tsx`
- `/Users/masa/projects/AMD/amd-os/pwa/src/app/(app)/mypage/page.tsx`
- `/Users/masa/projects/AMD/amd-os/pwa/src/components/cockpit/CockpitRoutineGas.tsx`
- `/Users/masa/projects/AMD/amd-os/pwa/src/app/api/progress/revisions/route.ts`
- `/Users/masa/projects/AMD/amd-os/gas/099_PwaApi.js`
- `/Users/masa/projects/AMD/amd-os/gas/001_Router.js`
- `/Users/masa/projects/AMD/amd-os/gas/appsscript.json`

## 実行・確認したコマンド
build:
```bash
PATH=/tmp/codex-npm-bin:/Users/masa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH /Users/masa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run build
```

deploy:
```bash
PATH=/tmp/codex-npm-bin:/Users/masa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os/pwa
```

production smoke:
```bash
curl -I https://amd-os-pwa.vercel.app/admin/billing
curl -I https://amd-os-pwa.vercel.app/mypage
```

結果:
- Next.js production build は通過。
- Vercel production deploy 済み。
- `/admin/billing` / `/mypage` は未ログイン状態で `/auth/login` へ 307 redirect するところまで確認済み。
- ログイン後のブラウザ実操作はユーザー確認ベース。admin.billingの最新立替確認締切ロジックは未ログインでは未確認。

## 未解決 / 次の最初のアクション
1. `admin.billing` をログイン済みブラウザで開き、`2026年6月` の `立替確認` が `2026-05-02` 時点で未完表示になっているか確認する。
2. チップの `完了にする` / `未完にする` がSupabase RLS/権限で実際に更新できるか確認する。ビルドは通っているが、実DB書き込みはログインブラウザで未確認。
3. `立替確認` は今は「締切前=未完 / 締切後pendingなし=完了」。ユーザーが「対象なし」表示を望む場合は status を3値化する。
4. Gmail/source extraction bridge はGAS経由の暫定。PWAサーバー直接抽出TODOを設計ログまたはHANDOFFから実装タスク化する。

## 注意点・運用ルール
- ユーザーは「Swift版とPWA版でUIが違うと混乱する」ため、PWAをSwiftに寄せる方針が基本。
- ただしadmin.billingでは、ユーザーの最新要望で「一覧上のタスクチップを直接操作」が優先。Swift完全一致より操作性を優先した差分。
- `立替確認` は `submitted` / `pmapproved` を未処理扱いにする。`approved` 等は完了側。
- `payment` / `rewardPaid` を完了しようとして未完タスクがある場合、nudge送信してブロックする。
- worktreeは大きくdirty/untracked。移行後の正本化による差分が多く、無関係な削除/変更を戻さないこと。
- `AGENTS.md` / `CLAUDE.md` に古いパスが混ざる可能性がある。作業時は `pwd` で `/Users/masa/projects/AMD/amd-os/pwa` を確認する。

## 次セッション開始プロンプト（2026-05-04 更新版）

```text
AMD OS PWAの作業を `/Users/masa/projects/AMD/amd-os/pwa` で再開して。
まず `pwa/HANDOFF_pwa_rebuild.md`、`pwa/BUGS.md`、`pwa/AGENTS.md`、`CLAUDE.md` を読んで現状を確認して。

## 直近の作業状態（2026-05-04 時点）

Venture Map (5/20 スタパデモ向け) の実装が一通り完了している。
最終コミット: feb45c9（PWA rebuild + Venture Map Phase 1-7）, 4038e39（数理モデル設計書）

### やったこと（コミット済み）
- ventures_xrl_log 9社 TRL/BRL/HRL 時系列シード → Supabase 投入済み
- SU個別ビュー `/venture-map/su/[id]` (XRL折れ線 × マクロ指数)
- マクロ指数遡及拡張 cron (`/api/cron/macro-backfill-historical`) — Sonnet で 2010-2025 推定
- 数理モデル設計書: `pwa/design_log/2026-05_venture_map_model.md`
- ティエム/JC knowledge: `pwa/design_log/2026-05_su_knowledge_tiem_jc.md`

### 次にやること（優先順）
1. Vercel deploy（SU個別ビューを本番反映）
2. macro-backfill-historical を手動キック（CRON_SECRET 付きで叩いて 2010-2025 macro_index_log を埋める）
3. デモ動作確認（View A ピンクリック → SU 個別ビューの遷移・グラフ確認）

### build/deploy コマンド
```bash
# build
cd /Users/masa/projects/AMD/amd-os/pwa && npm run build

# deploy
npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os/pwa
```

### macro backfill 手動キック
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://amd-os-pwa.vercel.app/api/cron/macro-backfill-historical
```

### 数式モデルについて議論したい場合
`pwa/design_log/2026-05_venture_map_model.md` を最初に読むこと。
未解決論点5点あり（D' 極大の解釈、Δt 最適化、競合密度実装、κ チューニング、予算データ投入）。
```

## 最終更新
2026-04-30 (セッション11) — マクロトレンドマップ（世界×日本）3ビュー実装 + 一人称ルール強化 + シグナル整理機能

## 完了タスク（セッション11: マクロトレンドマップ + 周辺整備）

### 一人称ルール強化（仕組み化）
- `~/.claude/CLAUDE.md` を新設して**全プロジェクト共通ルール**として配置（一人称・敬語・コスト見積もり・記憶管理・引き継ぎ運用）
- `amd-os-pwa/CLAUDE.md` を**プロジェクト固有部分のみ**にスリム化（Vercel コマンド・DDL適用方法）
- メモリに `feedback_first_person.md` 追加、`MEMORY.md` インデックス先頭に⚠️マーク付きで配置
- 一人称は「えいみ」「あたし」のみ。「おれ」「俺」「私」「ぼく」「うち」絶対禁止

### Atlas Map チューニング
- 初期 zoom が縮小すぎ → 収束後に `zoomToFit(0,0)` してから ×2.6 拡大、`centerAt(0,0)` で位置固定
- 孤立ノード（リンクなし）が外周に飛ばされる → カスタム力 `isolatedCenterForce`（α×0.04）で中央方向に弱く引く
- 反発 `-450` / リンク距離 `140` でノード間にゆとり
- `didInitialFitRef` で初回1回だけ fit（data 参照変化で再fitしないことで「2段階縮小」を解消）

### /atlas のストーリー操作強化
- ストーリーカード全体を `<button>` から `<div role="button">` に変えて、タイトル/サマリーに `select-text` + `stopPropagation` を当てて**コピー可能化**
- 各シグナルに「✕ 外す / → 他のストーリーに移植 / ✦ 新規ストーリー化」アクションボタン
- `/api/atlas/move-signal` 新規（detach / moveToExisting / createNew の3アクション、createNew は LLM がタイトル・サマリー提案）
- `MoveSignalModal` で別ストーリー候補リスト + 選択 + 移植実行

### マクロトレンドマップ（世界×日本ズレマップ） Phase 1-3 完成

**Phase 1: テーマ定義**
- migration `004_atlas_themes.sql`: `atlas_themes` + `atlas_story_themes`（多対多）
- `/api/atlas/themes/cluster`: 既存ストーリーを Sonnet 4.6 でクラスタリング → 30-50テーマ提案
- `/api/atlas/themes/apply`: 提案を確定して DB 保存 + 紐付け
- `/api/atlas/themes/list`: 既存テーマ + 紐付けストーリー数
- `/atlas/admin/themes` 管理UI: クラスタリング実行 / 提案編集 / 確定
- LLM JSON 出力に生制御文字が混ざる問題 → `sanitizeJsonControlChars()` で文字列内のみ sanitize する処理を追加（cluster + divergence cron 両方）
- **54テーマ確定済み**（水素・アンモニア / 電池材料 / 半導体 / AI規制 / 洋上風力 等）

**Phase 2: divergence 生成**
- migration `005_atlas_divergences.sql`: テーマ単位に世界/日本要約・乖離度・活発度を保存
- `/api/cron/atlas-divergence`: 週1（日曜21:00 UTC = 月曜06:00 JST）で全テーマ再生成
  - 各テーマの紐付けストーリー → 配下シグナル → `source_type='policy'` を日本、それ以外を世界として LLM (Sonnet 4.6) に投げる
  - 出力: global_summary / japan_summary / divergence_message / divergence_score / global_intensity / japan_intensity / signal_breakdown
  - 並列度4で処理（54テーマ ≈ 100秒で完了）
- `vercel.json` に cron 登録、Hobby plan 上限の maxDuration=300 に合わせる
- **初回 54テーマ全成功で生成済み**

**Phase 3: マクロトレンドマップUI（/atlas/divergence）**
- 3ビュー切替: 🃏 カード / 📍 散布図 / 🔥 ヒートマップ
- **フレーミングは「マクロトレンド主体」**: タイトル「マクロトレンドマップ」、サブ「世界×日本×ギャップ」
  - カード: 世界要約・日本要約を2カラム並列メイン、ギャップは末尾の補足
  - 散布図: x=世界活発度 y=日本活発度、対角線=同期、点サイズ=ギャップ。世界活発度0.65+ もラベル表示
  - ヒートマップ: 色軸トグル（世界活発度/ギャップ/日本活発度）+ 分野ごとグルーピング
  - ソート切替（カード）: 世界の動き順（デフォルト）/ ギャップ順 / 日本の動き順
- 詳細パネル: ズレの本質メッセージ・世界要約 + 一次ソースリンク・日本要約 + 省庁バッジ・タグキーワード

### Atlas ナビゲーション整理
- `/atlas` ヘッダーに「📊 トレンド」ボタン追加（amber primary）+ 「テーマ管理」リンク
- 旧 `/atlas/topics`（signal+tags 中心化で形骸化）、`/atlas/reports`（source_cache 依存で空振り）を**削除**
- 残りは: 一覧（/atlas）/ 🗺 Map / 📊 トレンド / 判断ログ / Inbox / テーマ管理 / Admin

---

## 完了タスク（セッション10: Atlas 政府方針シグナル）

### 設計ログ
- `design_log/2026-04_policy_signals.md` 新規作成
- 既存 `atlas_signals` テーブルに同居方針（PJ/topic 階層化禁止を継承）
- 直近1か月分 RSS で 125件 / 65ストーリー / high=18件 投入済み

### DDL（migration 003）
- `atlas_signals` に `metadata jsonb` 列追加
- `source_type` の CHECK 制約に `'policy'` を追加（DO ブロックで動的張替）
- `source_url` / `source_type` / `metadata->>ministry` / `metadata->>announced_at` インデックス

### 収集パイプライン
- **`src/lib/atlas-policy-sources.ts`**: 省庁ごとの fetcher（RSS は fast-xml-parser、HTML は Gemini Flash 抽出に分岐）
  - 稼働: 厚労省・国交省・内閣府・首相官邸・文科省（5省庁、合計 ~180件/取得）
  - 未対応: 経産省（Vercel から timeout）、環境省（HTML 200KB+ で遅い）、e-Gov パブコメ（403）
- **`src/lib/atlas-policy-filter.ts`**: Gemini 2.5 Flash で「事業判断に効くか」二値判定（バッチ並列、無料枠で実質無料）
- **`src/lib/atlas-policy-extract.ts`**: 詳細ページ HTML を取得して Sonnet 4.6 で AMD 視点 200-400字要約 + tags + importance + doc_type
- **`src/lib/atlas-policy-pdf.ts`**: 重要度 high のみ PDF を Anthropic document content block で深掘り強化
- **`/api/cron/atlas-collect-policy`**: 毎朝 07:00 JST (22:00 UTC)、`?since=YYYY-MM-DD&limit=N&step=...&dryrun=1` パラメータ対応
  - 多段 dedup: source_url 完全一致 + ministry×date×title先頭20字
  - 並列度4で attachStory + insert
  - vercel.json に cron スケジュール登録済み

### Inbox UI 拡張
- `AtlasSignal` 型に `source_type='policy'` と `metadata` フィールド追加
- `/atlas/inbox`: 全部 / ニュース / 政策 のフィルタトグル + 各シグナルに `📋 経済産業省` 等の省庁バッジ

### Phase 2 課題（次セッション）
- 経産省 RSS の Vercel 経路問題（別経路、関東経産局 RSS 等で代替検討）
- 環境省・e-Gov パブコメは別 cron で daily 1回のみ取得に分離
- 過去2か月分の backfill（press archive HTML スクレイプ）
- /atlas に policy 専用ピボットビュー（時系列・省庁別）

---

## 完了タスク（セッション9: Atlas 大規模拡張）

### Atlas シグナル運用基盤
- **タグ自動付与API** `/api/atlas/auto-tag` (Claude Haiku 4.5)
- **submit ページ強化**: ✨ 自動でタグ付け ボタン + 投入時の空欄自動補完
- **Inbox 簡素化**: topic 選択モーダル廃止、Accept は 1クリックで status=accepted
- **Inbox 一括Accept**: 「✓ 全件Accept (N)」ボタン → `acceptAllInboxSignals()`
- **メイン /atlas をシグナル一覧に**: 検索 + 重要度 + 分野 + タグの複数フィルタ
- **AMD Atlas データモデルを「signal + tags 中心」に再設計**: PJ/topic 階層化を完全廃止（PJ依存禁止の方針徹底）

### 自動収集 / 遡及投入 / 一括投入
- **`/api/cron/atlas-collect`** (毎朝 08:00 JST = 23:00 UTC): Sonnet 4.6 + `web_search_20250305` (max_uses 8) で過去24-72hのマクロニュースを 8-14件 → タグ付け → atlas_signals 投入
- **`/api/atlas/backfill?domain=X&months=N`**: 分野別の過去N月遡及投入（A-Oの15分野対応）
- **`/api/atlas/seed`**: 一括投入（Bearer auth、本文配列を受け取って auto-tag 後 insert）
- 過去3ヶ月分を 15ドメイン × 5-8件 = 113件 backfill 済み

### Atlas ストーリー化 (Phase 1-3) — A案完全実装

**Phase 1: DDL + 紐付けロジック**
- migration `001_atlas_stories.sql`: `atlas_stories` テーブル + `atlas_signals.story_id` カラム
- `src/lib/atlas-stories-server.ts` の `attachStory()`: 投入時に LLM (Haiku) が既存ストーリーへの紐付け or 新規作成を判定
- 既存145シグナルを `/api/atlas/match-stories` バッチで処理 → **93ストーリー**に集約（multi-signal 42, singleton 51）
- atlas-collect / backfill / seed すべてに attachStory 統合済み

**Phase 2: メイン /atlas ストーリー優先表示**
- ストーリーカード (signal_count 大表示・ドメイン色・importance) → クリックで時系列タイムライン展開
- シグナルの日付・タイトル・本文・ソース・タグを縦線+マーカーで表示
- 未紐付けシグナルは折り畳み「未紐付けシグナル」セクション
- Map ボタンを primary 塗りで目立たせる

**Phase 3: /atlas/map ストーリーノード集約**
- ノード: ストーリーのみ（タグノード廃止）。色=分野、サイズ=signal数
- エッジ: 共通タグ ≥2 のストーリー対（各ストーリーから類似度上位3件まで）→ 同じテーマが自然にクラスタ化
- パルス演出: HIGH かつ signal数≥3 のガチ重要ストーリーに琥珀色の波紋（`autoPauseRedraw={false}` で常時 redraw）
- NEW バッジ: 直近24h以内に**新しいシグナル**が入ったストーリーのみ（last_updated_at ではなく内部 signals の最新 submitted_at で判定）
- ピン留め: ドラッグ後 fx/fy 固定。**他ノードをドラッグすると前の固定は自動解除**（増え続け防止）
- 複数選択フィルタ: 分野・タグともに Set ベース、複数 ON 可

### ストーリー統合フィードバック学習
- migration `002_atlas_story_merges.sql`: `atlas_story_merges` テーブル（merge ログ）
- `/api/atlas/merge-stories`: signals 移動 → tags/signal_count マージ → from削除 → ログ記録
- /atlas 詳細パネル下部に「⇄ 他のストーリーと統合」ボタン → 同分野/タグ重複度が高いストーリーを上位に並べた候補モーダル + 「理由」入力欄
- `atlas-stories-server.ts` の story-matching プロンプトに**直近12件の merge log** を「過去にユーザーが同じとみなしたパターン」として注入 → LLM がパターン学習

### DDL 自動適用フロー確立
- `scripts/apply_ddl.py`: Supabase Management API (`/v1/projects/{ref}/database/query`) で DDL を自動適用
- `.env.local` の `SUPABASE_ACCESS_TOKEN` (sbp_…) を使用、**User-Agent ヘッダー必須**（Cloudflare 1010 回避）
- migrations は `scripts/migrations/NNN_name.sql` に必ず残す

## 完了タスク

### Phase 0: 基盤構築
- Next.js 16 + Tailwind + shadcn/ui（`/Users/masa/projects/amd-os/pwa/`）
- Vercelデプロイ: https://amd-os-pwa.vercel.app（armada0130）

### Phase 1: GAS API（レガシー — Supabase移行後は参照のみ）
- `099_PwaApi.js` — ANYONE_ANONYMOUS WebApp API

### Phase 2: Supabaseデータ移行（完了）
- **プロジェクト**: amd-os-v2 (nbnhrhybjslbawdukvvk, Tokyo)
- **マイグレーション**: 28テーブル+RLS+トリガー
- **データ移行**: `801_SupabaseMigration.js` → members 28, projects 22, billing_cycles 126, milestones 136件 等
- **RLSポリシー**: 全テーブルに`anon_read (USING true)`（DEV_MODE用）、再帰ポリシーはDROP済み
- **PWA Supabase直接読み取り**: `src/lib/supabase-data.ts`
- **パフォーマンス: GAS API 8-10秒 → Supabase 0.5秒以下**

### Phase 3: GAS双方向同期（完了）
- **共通ユーティリティ**: `012_SupabaseSync.js` / `R012_SupabaseSync.js` / `S012_SupabaseSync.js` / `A012_SupabaseSync.js`
  - `sb_upsert_()` — バッチupsert（200行/バッチ）
  - `sb_toIso_()` — 日本語日時→ISO変換
  - テーブル別同期関数: `sb_syncBillingCycle_`, `sb_syncMilestoneProgress_`, `sb_syncMonthlyReport_`, `sb_syncTask_`, `sb_syncNudge_`, `sb_syncSourceCacheBatch_`, `sb_syncProject_`, `sb_syncMember_`, `sb_syncProjectMember_`
- **同期ポイント（本体GAS）**:
  - `000_Sheets.js` `b_upsertRow_()` → BillingCycle書き込み全17箇所を自動同期
  - `055_ProjectCockpit_Api.js` `cockpit_updateMsProgressSummary_()` → msProgressSummaryJson同期
  - `055_ProjectCockpit_Api.js` `cockpit_updateRewardSummaryCache_()` → rewardSummaryJson同期
  - `058_RewardV2_Repo.js` `rv2_upsertProgress()` → milestone_monthly_progress同期
  - `521_TasksRepo.js` `tasks_upsert()` / `tasks_updateStatus()` → tasks同期
- **同期ポイント（AMD-Report GAS）**:
  - `R000_Sheets.js` `b_upsertRow_()` → BillingCycle/MonthlyReports自動同期
  - `R058_RewardV2_Repo.js` `rv2_upsertProgress()` → milestone_monthly_progress同期
  - `R304_MonthlyReport_Repo.js` `mr_repo_saveDraft_()` / approve / submit → monthly_reports同期
  - `R311_SourceCacheRepo.js` `srcCache_upsert()` → source_cache同期
  - `R540_IssuesTasksLlm.js` `itLlm_upsertTask_()` → tasks同期
- **同期ポイント（AMD-Slack GAS）**:
  - `S060_NudgePoster.js` `nudge_runPosterTick()` → tsukuyomi_nudge_queue同期
- **同期ポイント（AMD-Admin GAS）** — NEW:
  - `A090_AdminProjects.js` `admin_updateProjectStatus()` → projects同期
  - `A090_AdminProjects.js` `admin_updateProjectAllFields()` → projects同期
  - `A156_AdminUsers.js` `admin_updateMemberRoleStatus()` → members同期
- **ScriptProperties設定済み**: 本体・Report・Slack全てにSUPABASE_URL + SUPABASE_SERVICE_KEY
- **設計**: ベストエフォート同期。Supabase書き込み失敗してもSpreadsheet側は巻き戻さない

### Phase 4: UI改善（2026-04-10 完了）
- **月次カード進捗バー**: msProgressSummaryJsonをパースしてMS別内訳を展開表示
  - ▶クリックでMS名・ポイント・個別進捗バーを表示
  - カラーコード: 緑(80%+) / 黄(40-79%) / 赤(1-39%) / 灰(0%)
- **サブMS表示**: milestone_sub_itemsをSupabaseから取得 → CockpitGoalsCompactでチェックボックスUI展開
  - MS行クリックでサブアイテム一覧を表示、done/open表示、完了数カウント(x/y)
  - **チェックボックスクリックで完了/未完了トグル（Supabase直接書き込み）**
- **責任者表示**: milestone_responsibilityをSupabaseから取得 → codeName + share%バッジ表示
  - MS行右端と月次モーダルのMS別進捗に表示
- **月次モーダル進捗確認タブ充実**:
  - 4つのStatCard（ステータス/予算/会議/入金）
  - MS進捗（加重平均）の全体バー
  - MS別進捗バー（title, points, progressPct, 担当者バッジ）
- **カンバン強化**:
  - ドラッグ&ドロップでステータス変更（Supabase書き込み対応）
  - タスクカードクリックで詳細モーダル（MS紐付け・優先度・担当者・説明表示）
  - モーダル内のステータスボタンでも変更可能
  - 優先度バッジ（高/中/低）、MS紐付けバッジ表示
- **レポート全文表示**: 200文字抜粋→全文に変更
- **Supabase書き込み関数追加**: toggleSubItemStatus / updateTaskStatus

### Phase 7: AI推定確認ワークフロー + 月次モーダル強化（2026-04-17 完了）

- **Supabase DDL**: `milestone_monthly_progress` に `note TEXT` カラム追加
  - supabase-js REST ではDDL不可 → Chrome automation でSQL Editor実行
  - `ALTER TABLE milestone_monthly_progress ADD COLUMN IF NOT EXISTS note TEXT;`
- **`/api/progress/unconfirmed`** (GET): `source=tsukuyomi_estimate` のMSを返す
  - `prevPct`（前月累積）も含めてフロントに渡す
- **`/api/progress/confirm`** (POST): adopt / reject / modify / manual の4アクション
  - `adopt`: `source→pm_confirmed`、pct維持
  - `reject`: 前月値に戻して `source→pm_rejected`、note=理由
  - `modify`: 指定値で `source→pm_confirmed`、note=修正+AI推定元値
  - `manual`: tsukuyomi_estimate 不要で直接 `source→pm_manual` 書き込み
- **`progress-estimator.ts`**: upsert時に `note: reason.substring(0, 500)` 追記
- **`CockpitMonthlyModal.tsx` 全面強化**:
  - 未確認バナー（amber）: `unconfirmed.length > 0` 時に表示
  - 縞々バー（striped）: 前月分=濃い緑 + 今月推定増分=縞 で未確認MS を区別
  - 採用/不採用/修正インライン UI (右パネル)
  - ✏️手動編集ボタン（確認済みMSにも編集可能）
  - 進捗バー色修正: `pct>=80→emerald / pct>0→blue(#0066cc) / 0→gray`（黄/赤廃止）
  - 数値入力: `type="text" inputMode="numeric"` + `onFocus select()` でゼロ削除可能
  - fetchUnconfirmed後のreason復元: `data.details[].reason` をstateにマージ（DB note=NULL回避）
- **デプロイ済み**: `https://amd-os-pwa.vercel.app`
  - commit: `fix: bar color blue for progress, manual edit button, number input clear`

### Phase 6: 進捗推定 + UI強化（2026-04-17 完了）
- **進捗推定API**: `src/lib/progress-estimator.ts` + `src/app/api/progress/estimate/route.ts`
  - GAS `cron_progressEstimateDaily_()`（R060_RewardV2_Estimator.gs）のPWA移植
  - **ただしソースは `source_cache`→`monthly_reports.final_content/draft_content` に変更**
    - 理由: GAS L1 cron 廃止で `source_cache` は空。レポートはMMOマシンのClaude Code scheduled taskで生成済み
  - Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) でMS別delta%を抽出 → `newCumPct = min(100, prevCum + delta)` で累積化
  - routine / pm_manual / criteria_toggle はスキップ、単調増加のみ保存
  - 詳細は `design_log/amd_os/2026-04_progress_estimation.md`
- **レポート生成時に進捗も自動推定**: `/api/report/generate` 内で fire-and-forget で `estimateProgress` を呼ぶ
- **月次モーダル強化**:
  - 幅を `max-w-3xl` → `!max-w-[1400px] sm:!max-w-[1400px] w-[95vw]` に拡大（shadcn baseの `sm:max-w-sm` を `!important` で上書き）
  - 「🤖 AIで再推定」ボタン追加 — ページリロード不要でローカルstateを更新して進捗バーが即反映
  - 診断情報を結果メッセージに表示: `[PC=✓, MS=9, report=1, svcRole=✓]`
- **MSコミット%編集UI**: `CockpitNextPeriodSetup.tsx` の拡張
  - 各MSごとにPJメンバーのコミット割合（%）を入力可能
  - DB側は 0.0-1.0 の小数、UI側は 0-100 の整数でやりとり（変換レイヤー）
  - `milestone_responsibility` テーブルに upsert
  - **既存MSのコミット表示バグ修正**: 0.3% → 30%（100倍ずれ）を `Math.round(r.share * 100)` に統一
- **現在/過去の期間MS切り替え**: 現在のPlanCycleに含まれる月はトップ表示、それ以外（過去）は折りたたみ
- **draft/activeどちらも編集可能に**: `directCycleId` パラメータで直接編集モード、 `autoOpen` でモーダル自動展開
- **Kanban done列トグル**: 完了タスクの表示/非表示切り替えボタン（`showDone` state）
- **FK制約エラー修正**: `value_milestones` 削除前に `milestone_responsibility` / `milestone_sub_items` を先にDELETE
- **RLS認証修正**: 書き込みには `getAuthClient()`（`createBrowserClient` from `@supabase/ssr`）を使用

### Phase 5: UI改善 第2弾（2026-04-15 完了）
- **次の期間MS設定UI**: `CockpitNextPeriodSetup.tsx` — 現在のPlanCycle終了3か月前からバナー表示
  - バナークリックでモーダル表示：次のPeriod/予算/MSをフォームで設定
  - Supabase `value_plan_cycles` + `value_milestones` に直接書き込み（anon key）
  - 既存の次のPlanCycleがある場合は読み込んで編集モードに
  - 表示ロジック: `currentYm + 3ヶ月 >= periodEndYm` で判定
- **adminページ実データ化**: `admin/projects/page.tsx` / `admin/members/page.tsx`
  - MOCK_PROJECTS / MOCK_MEMBERSを廃止 → Supabase server client（SSR）で直接取得
  - 実データ: projects:22件、members:28件
- **Supabaseデータ確認**: 全テーブルにスプシからの移行データが正常に存在することを確認
  - billing_cycles:126, value_milestones:136, milestone_sub_items:138, milestone_responsibility:209等
- **APIルートビルドエラー修正**: createClientをモジュールレベルで初期化するとVercelビルドで `supabaseKey is required` エラー → 関数内遅延初期化に変更（invoice/create, invoice/preview, report/fix, report/generate）

### Phase 8: 月次モーダル完全実装 + バグ修正（2026-04-23 完了）

GAS版との差分41項目をPWAに移植（前セッションで実施）、その後以下の追加改修：

- **今月の報酬予定額セクション**:
  - 「翌月予算の参考（均等割り）」→「💰 今月の報酬予定額」に改名
  - 計算ロジック刷新: 均等割り → `consumedPt増分 × 担当割合 × pt単価`（実績ベース）
  - MS別テーブルに「今月増分」「前月→今月消化pt」カラム追加
- **Eager loading**: 進捗イベント・立替精算をモーダル開時に即時フェッチ（展開待ち廃止）
- **毎朝3時 Cron**: `vercel.json` に cron追加 + `/api/cron/daily-estimate` ルート新規作成
  - 全アクティブPJに対して `estimateProgress()` を直列実行（3:00 JST = 18:00 UTC）
  - `Authorization: Bearer CRON_SECRET` 認証対応
- **今月の報酬予定額・進捗イベント・立替精算を常時展開**（アコーディオン廃止）
- **バグ修正: 手動進捗変更が効かない**
  - `confirm/route.ts` で全アクションが `tsukuyomi_estimate` 行の存在を必須にしていた
  - `if (!target && action !== "manual")` に修正 → 推定未実行MSでも手動入力可能に
- **バグ修正: 手動変更が報酬予定額に即時反映されない**
  - `handleBatchSave` / `handleAction` の `setLocalProgress` が `progressPct` しか更新していなかった
  - `consumedPt = ms.points × newPct / 100` を計算してセット → 保存直後に報酬欄も更新

## 完了タスク（セッション7追加）

### マイページ「今月の活動」機能（2026-04-25）

- **Supabase DDL適用済み**（Management API経由）:
  - `milestone_responsibility` に `role TEXT DEFAULT '担当'`, `task_description TEXT` 追加
  - `UNIQUE(milestone_id, member_id)` → `UNIQUE(milestone_id, member_id, role)` に張り替え
  - `member_activities` テーブル新設（PK=UUID, FK=TEXT, source='inferred'を含むCHECK, anon_read RLS）
- **supabase-data.ts 拡張**:
  - `MemberActivity` 型追加
  - `MilestoneResponsibility` に `role?`, `taskDescription?` フィールド追加
  - `fetchMemberActivities()` / `upsertMemberActivities()` / `replaceInferredActivities()` 追加
  - 既存 fetchResponsibilitiesForPlanCycle / upsertMilestoneResponsibilities に role/taskDescription 対応
- **CockpitNextPeriodSetup 拡張**:
  - `roleMap` state追加（msIdx → memberId → { role, taskDescription }）
  - コミット%入力欄の下に「役割・業務内容」入力行を追加（担当/統括/レビュー/サポート選択 + 業務内容テキスト）
  - コミット > 0 のメンバーのみ役割入力欄を表示
  - handleSave で respRows に role/taskDescription を含めてupsert
- **`/api/cron/member-activities/route.ts` 新規作成**:
  - 認証: `Authorization: Bearer CRON_SECRET`
  - 全アクティブPJに対して monthly_reports + milestone_responsibility → Claude Haiku で推論
  - member_activities(source='inferred') に削除+再挿入
  - vercel.json に `"0 19 * * *"` (毎日 04:00 JST) で追加
- **`/mypage/page.tsx` 新規作成**:
  - DEV_MODE: メンバー選択ドロップダウン（本番はAuth後に自動特定）
  - 参加PJごとにグループ化 → activities一覧 + billing_cycles.rewardSummaryJsonから報酬額表示
  - 「今すぐ推論」ボタンでcron APIを手動呼び出し可能
  - GlobalNavに「マイページ」リンク追加
- **デプロイ済み**: `https://amd-os-pwa.vercel.app/mypage`
  - commit: `feat: マイページ「今月の活動」機能追加`

---

## 完了タスク（セッション6追加）

### 月次ルーティン改善（2026-04-23）
- `CockpitRoutineGas.tsx`: カードに `max-h + overflow-y-auto` 追加 → スクロール対応
- 月見出し・各ステップを `<button>` 化 → クリックで `CockpitMonthlyModal` を開く
- `CockpitView.tsx` から `onOpenModal={(ym) => setModalYm(ym)}` を渡すだけで動作

### Atlas Cron 修正（2026-04-23）
- `CRON_SECRET` をVercel本番に設定（`9hTa4...`）
- atlas-daily/weekly/monthly route: 認証パターンを `daily-estimate` と統一（CRON_SECRET未設定時スキップ）
- `src/lib/supabase/middleware.ts`: `/api/` パスをauth redirectから除外（cron等が401→リダイレクトになっていた）
- `src/lib/atlas-report.ts`: `gemini-1.5-flash`（404エラー）→ `claude-haiku-4-5-20251001` に差し替え
- 3本とも手動実行で `{"ok":true}` 確認済み

---

## 未完了・継続タスク

### 【次セッション】AMDプロトコル の実装
- AMD OS の2本柱のもう一方（design_log/2026-04_atlas.md 参照）
  - Atlas = 判断の地図（"何を" 見て考えるか）→ 完了
  - **AMDプロトコル = 判断のフレーム（"どう" 考えるか）** ← これから
- 現状ベースの設計はまだ薄い。design_log に専用ファイル無し。AMD_OS 親側 GAS の Protocol 概念を確認する必要があるかも
- Atlas との統合（topic 文脈が判断時に注入される）も視野に

### Atlas タグ正規化（件数増えたら着手）
- AIが付けたタグの表記揺れ（例「半導体 / semiconductor / セミコン」「中国 / China / 中国本土」）を統合する管理画面が必要
- 現状32件では問題ないが、シグナル数が数百を超えたあたりでフィルタが機能しなくなるので、その前に：
  - 全タグ一覧 + 出現件数の管理ページ
  - エイリアス定義（A=B として扱う）
  - 一括リネーム（「semiconductor」を全シグナルで「半導体」に置換）
  - 投入時の正規化フック（atlas-collect / submit / seed で同一語に寄せる）
- 場所候補: `/admin/atlas/tags` を新設



### マイページ（今月の活動）— 次のステップ
- **推論精度向上**: milestone_responsibilityに役割・業務内容を実際に入力する（ValuePlan編集から）
- **MS名表示**: member_activitiesのmilestone_idからMS titleを引いて表示（現在はIDそのまま）
- **source_cacheデータ到着後**: source='slack'/'notion'等の実生データが入れば表示UIは既に対応済み

### UI改善
- Settings, Reimburse画面
- MTGサマリ表示（旧`source_cache`のgmeet_minutes → 新ソース要検討）

### `source_cache` 依存の残存
- `src/app/api/report/generate/route.ts` はまだ `source_cache` を参照している
- GAS L1 cron 廃止で source_cache は実質空 → レポート生成時のLLM入力が空ソース状態
- レポートは実際にはMMOマシンのClaude Code scheduled taskで生成されてmonthly_reportsに入るので、PWAの`/api/report/generate`自体が不要な可能性
- 要検討: PWAのreport generateも廃止するか、monthly_reportsベースのフィードバック修正に絞るか

### 認証
- 現在DEV_MODE（認証スキップ、RLS全テーブルanon_read）
- 本番: Supabase Auth + RLSポリシー再構築（再帰なし）

### 双方向同期の補完
- ナッジキューの初期データ移行（DB_TsukuyomiNudgeQueueのシート名がNavigatorスプシ内で違う可能性）
- **Admin GASのclasp pushが未完了**: RAPT再認証が必要
  - `clasp login` を実行してブラウザ認証 → `.clasprc.json` 更新
  - その後 `cd gas-admin && clasp push --force`
- **Admin GASのScriptProperties設定が必要**:
  - GASエディタ → プロジェクト設定 → スクリプトプロパティ
  - `SUPABASE_URL` = `https://nbnhrhybjslbawdukvvk.supabase.co`
  - `SUPABASE_SERVICE_KEY` = （他プロジェクトと同じ値、.env.localのSUPABASE_SERVICE_ROLE_KEY）

## 既知の問題

### RLSポリシー再帰
- `member_project_read` → `project_members` → 再帰 → anon keyでエラー
- 対処: 再帰ポリシーDROP + `anon_read (USING true)` で代替（DEV_MODE限定）

### clasp認証
- Google Workspace RAPT（Re-Authentication）で定期的にclasp pushが失敗する
- 対処: `clasp login` → ブラウザ認証 → `.clasprc.json` 更新

### Supabase Access Token期限
- `amd-os-pwa-migration` トークン: 2026-05-10失効（30日）

## 次のアクション（優先順）

### 【最優先】月次モーダル — メンバー報酬欄の実装
GASの `504_CockpitReward.html` に実装済みだが PWA 未移植。
- 元GAS仕様: `cpRenderPayoutSection()` が描画
  - メンバー別テーブル: codeName / 獲得pt / 基本報酬 / ボーナス / 合計
  - 行展開でMS別内訳: MSタイトル / share% / consumed_pt / 獲得額
  - 月次上限がある場合はキャップ表示
- データソース候補:
  - `billing_cycles.rewardSummaryJson` — GASが生成したキャッシュJSON（最有力）
  - `milestone_monthly_progress` + `milestone_responsibility` — リアルタイム計算
- **実装前に必ず確認**: `rewardSummaryJson` の構造を実際のDBから読んで仕様確定

0. **Supabase→スプシのバックアップ未実装**: GASのSync関数はスプシ→Supabase（一方向）のみ。Supabase→スプシの逆方向バックアップは未実装。Supabaseには Pro以上のDaily Backupがあるが、GASベースの定期バックアップは要検討。
1. **Admin GAS ScriptProperties設定**: GASエディタから `temp_setSupabaseProps()`（A999_DevTemp.js）を手動実行
2. **本番認証設計**: Supabase Auth（Google OAuth → team-armada.jp限定）
3. **報告書生成機能**: LLM連携で月次レポートを生成するUI
4. **請求書発行機能**: freee連携でインボイス発行
5. **データ移行**: source_cache / project_knowledge のデータをSpreadsheet→Supabaseに移行
6. **MTGサマリ表示**: source_cacheからGMeet議事録を表示

## ディレクトリ構成

```
/Users/masa/projects/amd-os/pwa/
  src/lib/supabase-data.ts         ← Supabaseデータアクセスレイヤー
  src/lib/gas-api.ts               ← GAS APIクライアント（レガシー）
  src/components/cockpit/
    CockpitView.tsx                ← メインコンテナ
    CockpitGoalsCompact.tsx        ← マイルストーン（サブMS+責任者表示付き）
    CockpitMonthlyList.tsx         ← 月次カード一覧（MS別内訳展開付き）
    CockpitMonthlyModal.tsx        ← 月次モーダル（MS別進捗バー付き）
    CockpitKanbanGas.tsx           ← TODOカンバン
    CockpitRoutineGas.tsx          ← 月次ルーティン
    CockpitNudge.tsx               ← AIナッジ

G:/共有ドライブ/claude/AMD_OS/
  gas-main/012_SupabaseSync.js     ← Supabase同期ユーティリティ（本体）
  gas-main/801_SupabaseMigration.js ← データ移行スクリプト（ワンタイム）
  gas-report/R012_SupabaseSync.js  ← Supabase同期ユーティリティ（Report）
  gas-slack/S012_SupabaseSync.js   ← Supabase同期ユーティリティ（Slack）
  gas-admin/A012_SupabaseSync.js   ← Supabase同期ユーティリティ（Admin）★NEW
```

## このセッションで得た知見（2026-04-28 セッション8追加）

### Vercel CLI が全ルート 404 になった原因と解決策

**症状**:
- `vercel --prod --scope armada0130` を実行した直後から `/`, `/auth/login`, `/admin/payouts` など全ルートが 404
- `vercel inspect` で確認すると、ビルド出力が `○ /` と `○ /_not-found` の 2 ルートのみ（正常時は 94 ルート超）
- デプロイされた Lambda も `index`（545KB）と `_not-found` の 2 つだけ（正常時は 1.29MB × 94 以上）

**根本原因: デプロイコマンドの正本が CLAUDE.md に記載されていなかった**

CLAUDE.md / HANDOFF に「どこからどのコマンドでデプロイするか」が明記されていなかったため、えいみが毎回その場で判断し直した結果、別ディレクトリを起点に `vercel --prod` を実行してしまった。CLI が設定ファイルだけのディレクトリをスキャンし、本来の `/Users/masa/projects/amd-os/pwa`（ソース込み 100+ ファイル）がアップロードされなかった。

`--debug` フラグで判明:
```
[client-debug] Found 26 rules in .vercelignore
[client-debug] Building file tree...
[client-debug] Found 18 files in the specified directory   ← 18件 = 設定ファイルだけ（異常）
```

**解決策: `--cwd` フラグで明示的にプロジェクトルートを指定する（CLAUDE.md に正本を記載済み）**

```bash
# NG: シェルのCWDに依存する
vercel --prod --yes --scope armada0130

# OK: --cwd で必ず正しいパスを渡す
npx vercel --prod --yes --scope armada0130 --cwd /Users/masa/projects/amd-os/pwa
```

**ロールバック方法（緊急時）**:
```bash
# 直前の正常デプロイIDを vercel ls で確認し promote
npx vercel promote dpl_<ID> --scope armada0130 --yes
```

**デプロイ成功の確認ポイント**: アップロードサイズが 228KB 以上（全ソース込み）かつ Route 一覧に 40 件以上出ていれば OK。

---

## このセッションで得た知見（2026-04-21 セッション4追加）

### Google OAuth Client Secret の取得方法（フォント曖昧さ回避）

**問題**: Google Console は 2026-04 時点でシークレットの「表示・ダウンロード」を廃止。新規作成直後のみ一度だけ表示されるが、画面では `I`（大文字アイ）と `l`（小文字エル）がフォント上まったく区別できない。

**解決策**: Chrome の `read_page`（アクセシビリティツリー取得）を使う。コピーボタンの `aria-label` に
```
クリップボードにコピー: GOCSPX-xxxxx
```
というフルテキストが入っており、機械可読な正確な文字列が取得できる。

**手順**:
1. Google Console の OAuth クライアントページを開く
2. 既存シークレットが2つある場合、1つを無効化→削除してスロットを空ける（上限2つ）
3. 「+ Add secret」をクリック → シークレットが新規作成される
4. `read_page(filter="interactive")` を実行 → `button "クリップボードにコピー: GOCSPX-..."` の aria-label からフルテキストを読む
5. その値を Supabase の Client Secret フィールドに設定

### Supabase Google プロバイダーの設定順序

- **Client IDs**: `webクライアントID,iOSクライアントID` の順（カンマ区切り）。**先頭が OAuth code flow で使われる**。
- **Client Secret**: Web クライアントのシークレットのみ設定

---

## このセッションで得た知見（2026-04-17 セッション3追加）

- **Supabase DDL の唯一の抜け道**: supabase-js REST + `rpc("exec_sql")` は存在しない。npx supabase は PAT必要。→ Chrome automation で Supabase SQL Editor を直接操作が最速
- **reason が消える問題の根本**: DB upsert時に `note` 列がないと暗黙無視→後から列追加してもexistingレコードはNULL。対処: `fetchUnconfirmed` 後に `estimateProgress` の `details[].reason` をstateにマージして、DBからnullが返ってもメモリで補完
- **shadcn Dialog の数値input**: `type="number"` は "0" を削除できない（ブラウザ仕様）。`type="text" inputMode="numeric"` + `onFocus={(e)=>e.target.select()}` で解消
- **進捗バー色設計**: 進捗が低い = 遅れとは限らない（期初は全MS 0%正常）。黄/赤は「遅れ」専用。「進んでいる」は青のまま。80%以上だけ緑
- **manual action**: 既存の `adopt/reject/modify` は `tsukuyomi_estimate` レコード必須だったが、`manual` は不問で `pm_manual` として保存。フロント型を `"adopt"|"reject"|"modify"|"manual"` に拡張

## このセッションで得た知見（2026-04-17追加）

- **Vercel環境変数**: ローカル `.env.local` に書いてもVercelには自動反映されない。デプロイ前に `vercel env add <KEY> production` で明示追加が必要
  - 今回漏れていた: `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `FREEE_*`
  - 一括追加する際は `.env.local` をパースして `echo $value | vercel env add $key production` をループ
- **GAS L1/L2 cron は廃止済み**（2026-04以前）。つくよみレポート・日次インテリジェンス・進捗推定はすべて MMO マシンの Claude Code scheduled task に移行
- **PWA側の `source_cache` 依存は要見直し**。実質空振りで動いているだけ
- **shadcn Dialog の幅上書き**: `sm:max-w-sm` が base に仕込まれていて `max-w-[1400px]` では上書き効かない。`!important` 必要: `!max-w-[1400px] sm:!max-w-[1400px]`
  - tailwind-merge はレスポンシブvariantを別グループとして扱うのが原因
- **LLM選定**: 複雑な抽出タスク（レポート本文からMS別%抽出）は Haiku だと精度不足。GAS と同じく Sonnet 4.5 (`claude-sonnet-4-5-20250929`) を使う
- **進捗%の扱い**: LLMが返す `progressPct` は「今月の増分(delta)」、DBに保存するのは「累積」。変換式: `newCumPct = min(100, prevCum + delta)`
- **コミット%の扱い**: DB は 0.0-1.0 の小数、UI は 0-100 の整数。画面表示時は必ず `Math.round(r.share * 100)` で整数に変換
- **FK順序**: `value_milestones` を DELETE する前に `milestone_responsibility` / `milestone_sub_items` を先に削除（CASCADE なし）
- **RLS書き込み**: module-level `supabase` (anon) では `is_admin()` が false → INSERT 拒否。`createBrowserClient` from `@supabase/ssr` で auth 付きクライアントを都度生成
- Supabase CLI non-TTY: SUPABASE_ACCESS_TOKEN環境変数が必須
- 本体GASはコンテナバインドスクリプト: BILLING_SPREADSHEET_IDがScriptPropertiesにない → getActiveSpreadsheet()フォールバック
- RLSの再帰問題: `current_member_id()` → project_members → member_pm_read → project_members で無限再帰
- `b_upsertRow_`にSync hookを入れることで17箇所のBillingCycle書き込みを一括対応
- clasp RAPT再認証: `clasp login` → ブラウザ認証で対処
- Supabase REST API upsert: `Prefer: resolution=merge-duplicates` + `on_conflict`
- 日本語日時「2026年3月9日 20:45」→ ISO変換が必要（sb_toIso_関数）
- msProgressSummaryJsonの構造: `{ periodStartYm, periodEndYm, items: [{ title, tag, points, progressPct }] }`
- milestone_sub_items / milestone_responsibilityはanon keyで読取可能（DEV_MODE anon_readポリシー適用済み）
- Vercelデプロイはgitリモート未設定のため `npx vercel --prod` CLI直接デプロイ
