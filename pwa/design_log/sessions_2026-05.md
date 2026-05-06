# Sessions Log — 2026-05 (AMD OS PWA)

PWA セッションの作業ログを月単位で集約。
仕様は `SPEC_pwa.md`、バグは `BUGS.md`、直近の引き継ぎは `HANDOFF_pwa_rebuild.md` を参照。

---

## 2026-05-02 — Codex セッション (PWA 正本化 + Gmail bridge + MyPage 報酬除外 + admin.billing)

### PWA 正本・deploy
- `amd-os-pwa` 側を Atlas まで実装済の正本と判断、`/Users/masa/projects/AMD/amd-os/pwa` で継続
- build / deploy 複数回成功。最新本番 alias は `https://amd-os-pwa.vercel.app`
- 確認済 deploy: `dpl_HEVJAR3W4DZADXjwSUpcJk2EFkTo`

### Gmail / source extraction bridge
- 「つくよみ修正依頼」で実データ抽出が必要に → 短期経路として
  `PWA Next API → GAS pwaApi adapter → Gmail extraction → source_cache → member_activities` を実装
- GAS 側:
  - `gas/099_PwaApi.js`、`gas/001_Router.js` に `mode=pwaApi`
  - `gas/appsscript.json` を anonymous webapp 向けに調整
- `clasp login` 済、GAS push/deploy 済
- `.env.local` / `.env.production.local` / Vercel env `NEXT_PUBLIC_GAS_WEBAPP_URL` を anonymous deployment URL に更新
- ユーザー確認: 「ちゃんとメール読んでくれるようになった」
- TODO: 長期は PWA サーバー直接抽出に置換 (GAS bridge は temporary)

### MyPage
- ログイン中アカウントのメンバーで MyPage 表示する仕様に整理
- 過去月も表示、「いまやること」実装
- 月次ルーティン:
  - 古い月が上に来る並び
  - `入金確認` を月次ルーティンから削除
  - 標準: `請求額確定 / 報告会日程調整 / 月次報告書FIX / 立替精算確認 / 請求書発行 / 請求書送付`
  - CTB: `見積書送付` + 標準
- 当月報酬合計: 月次ルーティンのいずれかが期限超過 + 未完なら PJ 報酬を取り消し線で除外
  - ただし `billing_cycles.status` が `payment_confirmed` / `reward_paid` / `completed`、または `payment_confirmed_at` / `reward_paid_at` あれば admin 救済済として除外しない

### 月次モーダル・進捗
- モーダル内手動進捗変更が進捗バーとサマリーカードに反映
- 進捗バーに前月分・今月分・つくよみ推定分・本来ラインを復活
- 各 MS 右カードにその月抽出された仕事を表示
- つくよみ推定/修正依頼:
  - `/api/progress/revisions` が `ms_progress_revisions` / `ms_revision_messages` / `tsukuyomi_learnings` を扱う
  - Gmail/mail 系修正依頼は GAS 経由で source 取得
  - admin ページでつくよみ学習状況表示

### admin.billing (Swift 寄せ + インライン操作)
- 一旦 Swift 版に寄せ、横長表から「月ごとの PJ リスト + ステップ表示」に変更
- 小さいドット → タスク名入りチップを一覧に直接表示
- チップクリックでメニュー: `完了にする` / `未完にする`
- チップ操作で `billing_cycles` を直接更新、画面即時反映
- 右端矢印 or PJ 名クリックで詳細モーダルも残す
- ステップ定義:
  - 標準: `予算確定 / 報告会 / 報告書 / 立替確認 / 請求発行 / 請求送付 / 支払通知 / 入金確認 / 報酬支払`
  - CTB: `予算確定 / 見積送付 / 請求発行 / 報告会 / 請求送付 / 報告書 / 立替確認 / 支払通知 / 入金確認 / 報酬支払`
- `立替確認` は手動変更不可。Swift 同様、立替データから自動判定:
  - 翌月 4 日締切、土日なら前営業日に補正
  - 締切前は未完、締切以降 `submitted` / `pmapproved` の未処理がなければ完了
  - 例: `202606` → 2026-07-04 が土曜 → 2026-07-03 に判定

### 主な変更ファイル
- `src/components/admin/AdminBillingMatrix.tsx`
- `src/app/(app)/admin/billing/page.tsx`
- `src/app/(app)/mypage/page.tsx`
- `src/components/cockpit/CockpitRoutineGas.tsx`
- `src/app/api/progress/revisions/route.ts`
- `gas/099_PwaApi.js`、`gas/001_Router.js`、`gas/appsscript.json`

---

## 2026-05-04 (午前) — Venture Map Phase 7 完成

すべて commit & push 済み (`feb45c9`, `4038e39`):

### ventures_xrl_log 9 社シード値投入
- `pwa/scripts/migrations/007_ventures_xrl_log_seeds.sql`
- Supabase 適用済 (`apply_ddl.py` で OK 確認)
- 9 社 × 複数観測点。`bottleneck` で XRL ボトルネックレイヤを記録
- ティエム HRL2 終了 / YD BRL2 終了 / JC BRL3 終了

### SU 個別ビュー
- `pwa/src/app/(app)/venture-map/su/[id]/page.tsx` (Server)
- `pwa/src/components/venture-map/SuDetailView.tsx` (Client)
  - SVG で TRL(青)/BRL(橙)/HRL(緑) 折れ線 × そのレーンのマクロ指数 (破線)
  - ボトルネックポイントに輪
  - マイルストーン年表テーブル
- `venture-map-data.ts` に `fetchXrlLog()` / `fetchVentureById()`
- View A の SU ドットに `<a href="/venture-map/su/{id}">`

### マクロ指数遡及拡張 cron (Sonnet)
- `pwa/src/app/api/cron/macro-backfill-historical/route.ts`
- レーンごとに Sonnet へ政策マイルストーン文脈を渡し 2010-2025 月次 index_value を推定
- 既存行は ON CONFLICT DO NOTHING で保護
- `vercel.json` に `"schedule": "0 3 * * 0"` (毎週日曜 03:00 UTC)

### 数理モデル設計書
- `pwa/design_log/2026-05_venture_map_model.md`
- 数式①〜④ の変数定義・データソース・未解決論点

### ティエム・JC knowledge
- `pwa/design_log/2026-05_su_knowledge_tiem_jc.md`
- デモナレーション向け SU 背景・XRL 軌跡・AMD 教訓

---

## 2026-05-04 (午後) — Venture Map 本番反映完了

### Vercel deploy (commit `3d67e05` 含む)
- deployment id: `dpl_EuyyvrKdcmvUkTNjLSLk1ntXmW54`
- alias: https://amd-os-pwa.vercel.app
- SU 個別ビュー + macro-backfill cron が本番反映

### macro-backfill-historical 手動キック
- 5 レーン × 192 月 = **960 行** INSERT、所要 250s (300s 上限内)
- サンプル品質 OK: gx_energy 2020-10 (菅カーボンニュートラル宣言) で 0.67→0.84 ジャンプ
- 全レーン 192 件揃った状態 (gx_circular / gx_energy / life / materials / robo)

### types/database.ts コミット (`3d67e05`)
- 4 ファイル (CockpitKanban / Goals / Routine + mock-data) から import されてたが untracked だった
- 別マシンで build 失敗するリスクを解消

### デモ動作確認 (Chrome MCP)
- View A: 9 社全 `<a href="/venture-map/su/{id}">` リンク化確認
- SU 個別ビュー (tiem): h1 / outcome / SVG 4 path / 24 circle / 年表 7 行 / 「ボトルネック: HRL」表示
- SU 個別ビュー (bwe): h1 / SVG 4 path / 17 circle / マクロ指数 path 2736 文字 (2010-2025 連続データ)

### Venture Map 現データ状態 (この時点)

| 要素 | 状態 |
|---|---|
| 9 社プロット | ✅ Supabase ventures |
| XRL 時系列 | ✅ ventures_xrl_log (推定シード) |
| 論文数 | ✅ papers_log (OpenAlex 2010-2026) |
| マクロ指数 2026- | ✅ macro_index_log (Atlas 集計) |
| マクロ指数 2010-2025 | ✅ Sonnet 推定 960 行 |
| XRL × マクロ SU 個別ビュー | ✅ 本番反映 |
| 重みパラメータ | ✅ macro_lane_weights (Sonnet 毎日 18:30 UTC 更新) |

### 残課題 (5/20 スタパデモまで)
1. 未解決論点 5 点を議論・決定 (`pwa/design_log/2026-05_venture_map_model.md`)
2. `B_i(t)` 予算データ投入 (NEDO/AMED 公開データ)
3. 競合密度 `C_i(t)` の実装方法決定
4. (状況次第) デモナレーション資料 `2026-05_venture_map_theory_strategy.pptx` 確認

---

## 2026-05-04 (夜) — つくよみマスコット本番投入

### 概要
`(app)` レイアウト全画面の右下にチビキャラのつくよみアニメを常駐させた。本番反映済・確認済。

### 直近変更ファイル
- `pwa/src/components/tsukuyomi/Sprite.tsx` (新規) — CSS background-position で 1 アニメ描画、`flipX` prop
- `pwa/src/components/tsukuyomi/Mascot.tsx` (新規) — corner 常駐 + mood swap + タップ反応、左向き固定
- `pwa/public/tsukuyomi/sheet-v4.png` (新規、1.2MB) — 統合スプライトシート 2304×512
- `pwa/src/app/(app)/layout.tsx` (修正) — `<TsukuyomiMascot />` を `<main>` の後にマウント
- `pwa/HANDOFF_pwa_rebuild.md`、`pwa/BUGS.md`

### ビルド・テスト・デプロイ
- `tsc --noEmit` 合格 (各 commit 前)
- ローカル dev (port 3464) で `/tsukuyomi-test` を緑背景で目視確認
- `npx vercel --prod --yes` で 4 回本番デプロイ (v4 基本→18frame 拡張→flipX→FPS 半減)
- 中間で test page と middleware 例外を作って検証 → 本番投入時に両方 revert
- main へ全 commit push 済

### 確認済 (実機/ブラウザ/本番)
- ✅ `https://amd-os-pwa.vercel.app/tsukuyomi-test` (削除前) Chrome で緑背景に透過合成、足元アライン、4 アニメ正常ループ
- ✅ corner mascot を Chrome で表示 (scale 0.9、左向き)
- ✅ `https://amd-os-pwa.vercel.app/tsukuyomi/sheet-v4.png` 200 OK (RGBA 2304×512)
- ⚠️ `/dashboard` 等の認証必須画面はえいみ環境からログイン不可 → まさが目視で OK 反応

### 採用素材 (v2 / Codex 生成)
- 場所: `/Users/masa/projects/masa/output/tsukuyomi_animations_amd/`
- 4 アニメ: idle / happy / thinking / wave
- 各 18 frames × 128×128px、足元アンカー (64, 124) で正規化
- 全部透過処理済、artifact なし。`manifest.json` に詳細

### 実装ポイント
- 統合シートは `/tmp/combine_v2_frames.py` で生成 (FRAMES_PER_ROW=18, ROWS=4)
- 最終 FPS: `{ idle: 5, happy: 7, thinking: 5, wave: 7 }`
- mood swap: 30-90s 間隔でランダムに happy/thinking/wave に 1.8s 切替 → idle に戻す
- タップ: wave 1.8s
- flipX: scale を負にする CSS transform (`scaleX(-1)`)、画像差し替え不要

### 経緯 (短く)
1. 元シート `tsukuyomi-sheet.png` (annotation 付参考用) を pixel filter + 連結成分で自動クリーン → 線残り/透過抜け解決できずユーザー NG
2. 実装すべて削除 (commit `76bb5a6`)
3. ユーザーが Codex に依頼してクリーン素材生成 (`tsukuyomi_animations_amd/`)
4. その素材ベースで再実装 → 一発 OK

### Commit ログ
| commit | 概要 |
|---|---|
| `c9c7a1a` | (旧) PWA dashboard: add Tsukuyomi floating mascot — 自動クリーン版、後に rollback |
| `76bb5a6` | PWA: remove Tsukuyomi mascot (rolling back to pre-implementation) |
| `57d0fbd` | PWA: add Tsukuyomi mascot to (app) layout — **採用版** |
| `662fb94` | PWA: halve Tsukuyomi mascot FPS for calmer feel |
| `89d84b4` | HANDOFF: document Tsukuyomi mascot session |

### 将来やるかも
- 状態 (loading/empty/error) に応じてアニメ切替 (Mascot に Context API 追加が必要)
- mood pickup の重み付け / 時間帯依存
- クリックでつくよみ AI (`/admin/tsukuyomi` の知識ベース) と連携させる導線

---

## 2026-05-06 — ドキュメント大整理 + Venture Map Timeline 3D + Vercel 正本コマンド修正

3 本立て。すべて main 反映 + 本番デプロイ完了 (`dpl_86rPErgtMCMMkGk3X45GY8DuPya2`)。

### A. ドキュメント大整理 (commit `4d9be8b`)

948 行の `HANDOFF_pwa_rebuild.md` を 4 ファイル責務分離に再編。

- 新規 `pwa/SPEC_pwa.md` (PWA 正本仕様 356 行: 画面・ルート・データモデル・cron・共通インフラ・運用コマンド・実装規約)
- 新規 `pwa/design_log/sessions_2026-04.md` (4 月セッション)
- 新規 `pwa/design_log/sessions_2026-05.md` (このファイル)
- HANDOFF を 948 → 68 行にスリム化
- `pwa/BUGS.md` に HANDOFF 内に埋もれていた教訓 5 件を追記:
  - Vercel 環境変数は `vercel env add` で明示登録必要
  - shadcn Dialog 幅は `!important` で variant 上書き
  - shadcn Dialog で `type="number"` の "0" が消せない → `type="text" inputMode="numeric"`
  - Google OAuth Client Secret のフォントで `I/l` 区別不能 → Chrome `read_page` で aria-label 取得
  - Supabase DDL は SQL Editor 手動でなく Management API 経由 + ファイル化
- `pwa/AGENTS.md` `pwa/CLAUDE.md` の冒頭に SPEC への入口を追加 (新セッションが最初にここを読む)
- `pwa/AGENTS.md` に **「PWA は常に本番で確認」** ワークフローを明記
  - 標準: 実装 → tsc → commit → push → main merge → `vercel --prod --cwd ...amd-os` → 本番 URL 目視
  - えいみへの含意: 確認質問で止まらず一気に通す

handoff skill (`~/.agents/skills/handoff/SKILL.md`) も同時更新:
- HANDOFF / SPEC / design_log / BUGS の役割を表で明示
- 「6 か月後も真であれば SPEC か BUGS、HANDOFF ではない」を cardinal rule に
- HANDOFF は 200 行以下、超えたら同じハンドオフで design_log に切り出す
- 既存 HANDOFF が肥大化してたら spec/log の分離を提案 (3 ファイル超の変更は確認)

### B. Venture Map Timeline 3D 新ページ (commit `b489494`)

`/venture-map/timeline-3d` 新設。現行 9 SU を 3D 折れ線で可視化。

**座標系**: ユーザー軸 (X=時間 / Y=SU並び / Z=スコア) を Three.js Y-up にマップ:
- Three.X = 時間
- Three.Z = SU 並び (奥行き)
- Three.Y = スコア (高さ)

**スコア**: `(TRL+BRL+HRL+GRL+SRL) / 25` を `computeScore(xrl)` 1 関数に閉じる (差し替え容易)

**折れ線**: `THREE.CatmullRomCurve3` (centripetal) + `tubeGeometry` で滑らかな光るパイプ。lane 別色:
- gx_energy = cyan, gx_circular = emerald, materials = orange, life = pink, robo = violet

**AMD 参画期間**: `founded_at 〜 (active なら今日 / 終了なら最終 xrl)` の範囲を:
- 太い (radius 0.13) + emissiveIntensity 1.8
- 期間外は radius 0.08 + intensity 0.4 で暗く

期間データの正本は `projects.start_ym` / `end_ym` だが `ventures ↔ projects` の直接 FK が無いため fallback。後で `ventures.project_id` カラム追加するのが TODO。

**5RL 内訳棒**: 各 SU の最新観測点を 5 段積層 (TRL/BRL/HRL/GRL/SRL の色付き box) で X 軸右端に立てる → Y-Z プリセット (SU × スコア) で正面から並んで見える

**イベント**: `milestone_label` を持つ観測点に琥珀色の球。X-Y (沿革) プリセットでだけ HTML ラベル展開

**カメラプリセット** (smooth lerp + 完了後 OrbitControls 自由回転):
| ボタン | カメラ位置 | 見える視点 |
|---|---|---|
| 時間 × スコア (xz) | (0, 0, +30) | 全 SU 折れ線が 2D で重なる |
| 3D iso | (18, 13, 22) | 等角視点、奥行きに SU が並ぶ |
| SU × スコア (yz) | (+30, 0, 0) | 5RL 内訳棒が並ぶ |
| 時間 × SU 沿革 (xy) | (0, +30, 0) | top-down、AMD 参画期間 + milestone ラベル |

**サイバー感**: dark radial bg + drei `<Grid>` floor (cyan section line) + `<fog>` + `<GizmoViewport>` + emissive material + `toneMapped: false`。Bloom postprocessing は MVP では未導入 (要なら `@react-three/postprocessing` を追加)。

**新規/変更ファイル**:
- 新規 `pwa/src/components/venture-map/Timeline3DView.tsx` (577 行)
- 新規 `pwa/src/app/(app)/venture-map/timeline-3d/page.tsx`
- 変更 `pwa/src/lib/venture-map-data.ts` (`fetchAllVenturesWithXrl({ activeOnly })` 追加)
- 変更 `pwa/src/app/(app)/venture-map/page.tsx` (Timeline 3D へのリンク追加)

完成度上がったら dashboard トップに移植する予定。

### C. Vercel デプロイ正本コマンド変更 + 事故記録

事故: `--cwd /Users/masa/projects/AMD/amd-os/pwa` で deploy したら `Error: The provided path "~/projects/AMD/amd-os/pwa/pwa" does not exist`。リトライで `--cwd` をリポ root にしたら、リポ root に `.vercel/project.json` が無かったため `--yes` で勝手に **新プロジェクト `amd-os` (`amd-os.vercel.app`)** が作られた。

原因: 2026-05-05 で Vercel project `amd-os-pwa` の Settings → Build → Root Directory に `pwa` を入れた (Git Integration 用)。CLI の `--cwd` は project 設定の Root Directory と結合されるので二重になる。CLAUDE.md と SPEC の正本コマンドは Git Integration 入る前のままで時代遅れだった。

対処:
1. リポ root に `.vercel/project.json` (amd-os-pwa を指す) を配置: `cp -r pwa/.vercel ./.vercel`
2. 正本コマンドを **リポ root を `--cwd`** に変更: `npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os`
3. 誤プロジェクト `amd-os` を `npx vercel projects rm amd-os` で削除
4. `pwa/CLAUDE.md` `pwa/SPEC_pwa.md` の正本コマンドを更新
5. `pwa/BUGS.md` に詳細エントリ追加

新本番デプロイ: `dpl_86rPErgtMCMMkGk3X45GY8DuPya2` (`https://amd-os-pwa.vercel.app`)。スモーク `/venture-map/timeline-3d` で `307` (auth redirect) 返る = ルート存在 + auth gate OK。

### Commit ログ
| commit | 概要 |
|---|---|
| `4d9be8b` | docs(pwa): split HANDOFF into SPEC + design_log + slim handoff |
| `b489494` | feat(venture-map): add Timeline 3D view (cyber-style three.js) |
| (この後 commit) | docs(pwa): update Vercel deploy command + record cwd accident in BUGS |
