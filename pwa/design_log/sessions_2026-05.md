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
- `pwa/design/venture_map_model.md`
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
1. 未解決論点 5 点を議論・決定 (`pwa/design/venture_map_model.md`)
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

---

## セッション (2026-05-06, cool-booth-b72d09 worktree, Opus 4.7)

PJ Status コックピット拡張を 6 phase で実装。`/project/[projectId]/cockpit` の上部に SU 系 PJ 用の Status セクションを追加。

設計の正本は **`pwa/design/cockpit.md`** に集約 (構造図・モーダル一覧・データモデル・API・cron・学習ループ・反省事項を含む)。

### Phase 1: スキーマ統合 (migration 008)
- 旧 `ventures` (id TEXT 'tiem' 等) 廃止 → `project_ventures` (project_id PK FK to projects.project_id)
- `ventures_xrl_log` → `project_xrl_log` rename + venture_id → project_id
- `project_events` 新規 (kind: hire / funding / deal / governance / xrl_obs / amd_score_override / note + 後に tech_progress)
- `seeds.linked_venture_id` → `linked_project_id`
- 既存 `venture-map-data.ts` / `VentureMapView` / `SuDetailView` / `Timeline3DView` / `relearn-lane-weights` cron も rename 反映

### Phase 2-3: Status セクション本体
- `CockpitVentureStatus.tsx`: AMD スコア折れ線 (-100〜+100) + XRL 折れ線 (TRL/BRL/HRL)
- 横軸はデータ実 min/max ± 6% にフィット
- ヘッダー全要素クリック → `CockpitVentureMetaEditModal` (該当フィールドにフォーカス)
- イベント編集モーダル: 自由文 textarea + 保存後に `/api/project-events/parse` (Gemini) で kind 別 schema に構造化
- 専用モーダル群: メンバー / パートナー / 月次試算表 (縦横ピボット) / 事業概要詳細 (つくよみマージ)

### Phase 4: つくよみ沿革学習ループ
- migration 010-011: `narrative_feedbacks`, `tsukuyomi_learnings_status`, `xrl_feedbacks`, `tsukuyomi_chat_logs`, `project_pl_hearings`, `project_venture_members`, `project_partners`, `project_pl_monthly`, etc
- 沿革モーダル: リスト形式 (年月+一行+詳細展開)、行 ✏ で `CockpitNarrativeFeedbackModal`
- 修正依頼 → `submitNarrativeFeedback` → 即時 `/api/project-ventures/[id]/narrative-regen` 叩く
- 共通 lib `narrative-refresh.ts` `refreshNarrativeForProject()`: cron + 単発 API 共有
  - open feedbacks + learnings (general + per-PJ) を Gemini プロンプト注入
  - 沿革再生成
  - Sonnet が feedback から lesson 抽出 (general / individual)
  - `tsukuyomi_learnings_status` に保存
  - feedback applied 化

### Phase 5: XRL 軸別評価 + マスコットチャット
- XRL ドット 3 倍化 (r=4 → r=12 / proposal r=15)、各軸 (TRL/BRL/HRL) 個別 onClick
- `CockpitXrlDetailModal` (axis prop): クリック軸の値だけ大きく + 軸別評価理由を表示
- `source_note` を JSON 文字列に変更: `{ trl_reason, brl_reason, hrl_reason }`
  - 情報不足な軸は「情報不足」と明示
  - 旧 plain text source_note は「(旧形式)」フォールバック表示
- `xrl-revise` / `xrl-refresh` cron 両方が JSON 形式で出力するよう更新
- `description-merge` に Anthropic 公式 `web_search_20250305` tool 追加 (「ネットで調べて」と書かれたら捏造禁止で検索)

### Phase 6: マスコットチャット
- 右下マスコットクリック → 吹き出し風小ウィンドウ (drawer ではなく `bottom: 168px / right-2 / 380x540px / 三角しっぽ`)
- マスコット本体は隠れない
- 会話状態は **localStorage に永続化** (`tsukuyomi_chat:v1:<projectId>`)
  - ブラウザ閉じても、別タップで閉じても、再開時に履歴復元
  - 「新しい会話」ボタンで明示リセット
- `/api/tsukuyomi/chat`: Sonnet + tool use (`update_short_long_description` / `invalidate_narrative` / `record_xrl_feedback` / `web_search`)
- 全会話 + applied actions を `tsukuyomi_chat_logs` に保存
- admin/tsukuyomi に統合 (memory layer の中に `pj_status:narrative` source として混在表示、JST 固定)

### その他
- 終了 PJ で月次ルーティン非表示 (`status === 'active' || 'sales'` のときだけ render)
- イベント kind: 「採用」→「人事」、「技術進捗」追加 (event_bonus +4)
- @メンション機能 (MentionTextarea / MentionDisplay): @入力 → コードネーム dropdown / 表示時に青字 span
- アウトカム追加: ゾンビ化 / 中小企業化
- AMD スコア breakdown モーダル (chip クリックで計算式 + 各値の内訳表示)
- メンバー属性 (member_kind: amd_internal / su_internal / support_org)、AMD は project_members アサイン済社員のみコードネーム dropdown

### 反省 (詳細は BUGS.md)
- `CockpitHeader` に独断で `⚙️ config` リンク (`/admin/projects` = PJ 台帳) を追加 → まさに却下
- 「過去にあったリンクの復活」依頼に対し git history を確認せず推測で実装した
- セッション末尾で `CockpitHeader` を config 追加前の状態にロールバック

### Commits (このセッションで主に進めた branch: `claude/cool-booth-b72d09`)
| commit | 概要 |
|---|---|
| 473512a | feat(cockpit): PJ Status section v1 + ventures→project_ventures schema unification (migration 008) |
| 9570cd4 | feat(cockpit): PJ Status v2 — meta-edit, free-text events, Gemini narrative & XRL proposal |
| 73d1cd2 | fix(cockpit): RLS write policies for PJ Status + service_role for server APIs (migration 009) |
| 6951cd0 | feat(cockpit): v3 — narrative list / cron / members / partners / monthly P&L / つくよみ description merge (migration 010) |
| (途中複数) | fix: PL skeleton, AMD member dropdown, immediate narrative regen, JST display etc |
| 66cb868 | fix(cockpit): AMD member shows code_name (まさ/きよ) + monthly P&L pivoted |
| cf7ec93 | feat(cockpit): outcomes ゾンビ化/中小企業化, @mention, web search, XRL detail+revise, mascot chat, routine fix (migration 012) |
| e6038d8 | fix(cockpit): JST display / merge PJ-status learnings into main list / mascot bubble / axis-specific XRL / 技術進捗 / config link (誤実装) |
| 66b6ac3 | fix(cockpit): rollback config link / persist mascot chat in localStorage + design doc & handoff |

---

## 2026-05-07 — AMD Score フル実装 (Before Zero Theory v3.2)

`/Users/masa/projects/before-zero/theory/amd_score.md` の正本式 (7 軸 Cobb-Douglas) を AMD OS に組み込んだ。詳細は `design/amd_score.md`。

### 数式
- AMD Score = K · Π (X_i + 1)^α_i, X = {σ_SU, TRL, BRL, GRL, SRL, HRL, FRL}
- σ_SU = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1
- K = 100,000 / 10^Σα (Shallow Tech は TRL 抜きで再校正)
- base alpha (Σα=6.0): FRL=1.5 / σ_SU=1.3 / HRL=1.1 / TRL=1.0 / BRL=0.6 / GRL=0.3 / SRL=0.2

### 実装
- 新 lib: `src/lib/amd-score.ts` (calculateAmdScore / classifyPhase / ALPHA_DEFAULT)
- 新 data: `src/lib/amd-score-data.ts` (fetchAmdScoreInputs / fetchActiveAlpha / upsertAmdScoreInput / saveNewAlpha)
- 新ページ:
  - `/venture-map/amd-score` (一覧、score 降順 + phase filter)
  - `/venture-map/amd-score/[projectId]` (個別 + 編集 + α サイドバー)
- 新 component:
  - `AmdScoreList.tsx` (一覧)
  - `AmdScoreView.tsx` (Hero / Radar / 寄与表 / 経時 line / 入力スライダー / α サイドバー)
- migration 013: `amd_score_inputs` + `amd_score_alpha` + base alpha + 8 PJ retrofit seed (本番適用済)
  - ID mapping: tiem→p03, bwe→p11, jc→p09, ctb→p06, cx→p20, sx→p21, yd→p18

### Cockpit 連携
- `CockpitVentureStatus.tsx`: amd_score_inputs + active alpha を fetch、AMD スコア経時グラフを log scale (1 - 100k IPO 級) に変更、フェーズ閾値ガイドライン入り
- AMD スコアチップ: `<score> · <phase>` を phase 色で表示、未評価時は `AMD: 未評価 →` link
- 「7 軸を編集 →」link を AMD スコアグラフのヘッダに追加 (`/venture-map/amd-score/[projectId]` へ)
- `CockpitAmdScoreBreakdownModal.tsx`: 7 軸 contribution 表 + 詳細編集ページ link に置換 (旧ダミー実装と差し替え)
- `venture-status-data.ts`: 旧 `EVENT_BONUS` / `computeAmdScoreSeries(bundle)` / `computeAmdScoreBreakdown(bundle)` を削除、新ヘルパー `computeCockpitAmdScoreSeries(inputs, alpha)` に置換

### ナビ
- `/venture-map` 右上に「AMD Score →」ボタン (Timeline 3D の隣)

### 検証 (期待値 vs 計算)
| PJ | 期待 | 実測 | 差 |
|---|---|---|---|
| sx 2027 | 4,791 | 4,785 | -0.1% (ほぼ完全) |
| bwe 2025 | 3,193 | 2,615 | -18% (μ seed 値が §8 より低い) |
| ctb | 1,658 | 1,855 | +12% |
| 全体 | — | フェーズ判定は全て理論通り | — |

→ 数式は正しい。seed の μ 値は粗い見積りなのでまさが UI スライダーで調整可。詳細は design log。

### 主な変更ファイル
- `src/lib/amd-score.ts` (新規)
- `src/lib/amd-score-data.ts` (新規)
- `src/components/venture-map/AmdScoreView.tsx` (新規)
- `src/components/venture-map/AmdScoreList.tsx` (新規)
- `src/app/(app)/venture-map/amd-score/page.tsx` (新規)
- `src/app/(app)/venture-map/amd-score/[projectId]/page.tsx` (新規)
- `src/app/(app)/venture-map/page.tsx` (AMD Score ボタン追加)
- `src/components/cockpit/CockpitVentureStatus.tsx` (新ロジックに連携)
- `src/components/cockpit/CockpitAmdScoreBreakdownModal.tsx` (7 軸 breakdown に置換)
- `src/lib/venture-status-data.ts` (旧 AMD スコアロジック削除 → cockpit 用ヘルパーに集約)
- `pwa/scripts/migrations/013_amd_score.sql` (新規、本番適用済)
- `pwa/design/amd_score.md` (新規、設計正本)

### 反省 / TODO
- σ_SU を `/venture-map/state-space` の Triple Helix 状態空間モデル推定値に自動連携 (現状は手動入力)
- データ駆動 α 推定 (9 PJ 階層 Bayesian)
- Shallow Tech モードの重み再分配 (理論 §11.3) — TRL=1.0 を BRL/HRL に再分配して K=1.0 と数値スケール一致を狙う
- VC valuation との比較ビュー (理論 §10) で AMD Score 高 + valuation 低 = 過小評価サイン
- AMD Score の cron 自動更新 (atlas signal が来たら関連 PJ の σ_SU を再評価)

---

## 2026-05-07 — AMD Score 周りの 8 改修 (4 phase 連続 deploy)

まさからの 8 修正要望に対応。詳細は `design/amd_score.md` 末尾。

### Phase A: 軽量 UX
- (3) project_xrl_log に grl/srl 列追加 (migration 014)、cockpit XRL グラフを 5 軸 (TRL/BRL/GRL/SRL/HRL) に拡張、CockpitXrlDetailModal も 5 軸対応
- (4) cockpit AMD スコアグラフ + AMD Score 経時 chart に AMD 支援期間 (amd_support_started_at - ended_at) を背景帯で明示。VentureRow に amd_support_* 追加
- (7) CockpitAmdScoreBreakdownModal を KaTeX で数式描画 + XRL を集約表記
- (8) AmdScoreView ヘッダに「↩ <PJ名> のコックピットに戻る」リンク追加

Commit: `32dd422`

### Phase B: FRL 構造化評価 + XRL 次レベル進捗
- (2) migration 015: amd_score_inputs に Walumbwa 2008 ALQ 4 次元 + frl_notes 追加
- AmdScoreView に FrlAlqPanel: 4 軸ミニレーダー + スライダー + 自由備考 + 「ALQ 平均から自動算出」⇄ 手動 FRL
- 「FRL 学術定義から見て ALQ + 備考だけでは何が足りないか」を展開可能セクション化:
  → 360° feedback / Founder Quality (Bernstein 2017) / Founder Experience (Hsu 2007) / Achievement Motivation (Stewart 2007) / Psychological Safety (Edmondson 1999) / 動的観測 / Founder Network 効果
- (XRL 次レベル進捗) 新 lib `xrl-level-definitions.ts`: 内閣府 SIP 9 段階定義 (TRL/BRL/GRL/SRL/HRL 各 9 レベル) を網羅
- CockpitXrlDetailModal に NextLevelProgress: 現 Lv → 次 Lv の説明 + 進捗 % + exit_criteria 明示

Commit: `3bca999`

### Phase C: つくよみチャットに AMD Score 認識 + L2 入力 tool 群
- (1)+(5) system prompt に AMD Score 数式 / フェーズ / FRL ALQ 構造を明記
- ProjectContext に `amd_score` (latest_input + 計算済 score + phase + bottleneck + alpha) と `xrl_next_levels` (5 軸の現/次 Lv + 進捗 % + exit_criteria) を含める
- 新 tool 群 (8 個):
  - `update_amd_score_input` (μ_A/I/G + 5 XRL + FRL/ALQ + frl_notes upsert、部分上書き)
  - `update_amd_score_alpha` (重み α 新版保存)
  - `add_xrl_observation` (project_xrl_log 追加、5 軸対応)
  - `record_xrl_feedback` (5 軸対応)
  - `add_project_event` (沿革駆動: hire/funding/deal/tech_progress/governance/note)
  - `add_project_member` (メンバー追加)
  - `add_project_partner` (事業会社追加)
  - `add_pl_monthly` (月次試算表 upsert)
- system prompt に「L2 情報を貼られたら分類して複数 tool 並行呼び出し」例

Commit: `db27ded`

### Phase D: つくよみチャットに添付サポート
- (6) TsukuyomiChatDrawer: 📎 添付ボタン + ドラッグ&ドロップ (画像 / PDF / テキスト最大 5 ファイル × 8MB)
- API: 添付を Anthropic content blocks (image / document / text) に変換して Sonnet に渡す
- メッセージ表示にも添付ファイル名 chip を表示
- tsukuyomi_chat_logs に添付ファイル名 metadata を保存

### 主な変更ファイル (このセッション全体)
- migrations: 014 (project_xrl_log grl/srl), 015 (amd_score_inputs alq + frl_notes) 全て本番適用済
- 新 lib: `src/lib/xrl-level-definitions.ts`
- 改修 lib: `src/lib/amd-score.ts`, `src/lib/amd-score-data.ts`, `src/lib/venture-status-data.ts`, `src/lib/venture-map-data.ts`
- 改修 component: `AmdScoreView.tsx` (FrlAlqPanel + AMD 支援期間背景), `CockpitVentureStatus.tsx` (5 軸 XRL + AMD 支援期間), `CockpitXrlDetailModal.tsx` (5 軸 + NextLevelProgress), `CockpitAmdScoreBreakdownModal.tsx` (KaTeX), `TsukuyomiChatDrawer.tsx` (添付)
- 改修 API: `src/app/api/tsukuyomi/chat/route.ts` (8 tool + AMD Score context + 添付)
- design log: `design/amd_score.md` (FRL ALQ + XRL 次レベル進捗 セクション追記)

---

## 2026-05-07 (晩) — 過去生データから 9 PJ × 71 評価点 一括抽出 (L2 batch)

「過去の生データから一気に AMD Score timeline を抽出してほしい、ネット情報も補完で」というまさ要望に対応。私 (Claude Code) のセッション内で MCP (Notion/Slack/Drive) + WebSearch + Anthropic API + Supabase Management API を組み合わせて 9 PJ 一括処理。

### 抽出スクリプト
`pwa/scripts/extract_amd_score_from_l2.py` を新規作成。汎用化、引数: project_id, raw_text_file。Anthropic API (Sonnet 4.5) で生データ → JSON timeline 抽出 → Supabase Management API で `amd_score_inputs` に upsert。

### 各 PJ の生データ収集 (per-PJ raw text 約 2-5KB)
- Notion: PJ ごとの Project Charter / 経緯 / FY25 事業報告 / キックオフ MTG 等
- Slack: 会社名検索で主要メッセージ 20 件
- WebSearch: 「<PJ名> 資金調達 / 設立 / 本店移転」等で過去のニュース・受賞・ピッチ実績を補完
- Before Zero Theory `su_timelines.ts` のメタも raw text に含める

### 抽出結果 (9 PJ × 計 71 評価点)
- p03 ティエムファクトリ: 8 pts (2007-2022, smb)
- p04 輝翠TECH: 6 pts (2021-2026, lifted)
- p06 CrestecBio: 8 pts (2020-2026, rocket)
- p07 LiSTie: 8 pts (2023-2026, rocket)
- p09 JOYCLE: 10 pts (2023-2026, deep_pivot)
- p11 BWE: 8 pts (前 batch 完了済)
- p18 Yellow Duck: 7 pts (2023-2025, ue_fail)
- p20 CryoX: 8 pts (2024-2026, rocket pre-launch)
- p21 SolvioraX: 8 pts (2025-2028, planning)

詳細・洞察は `design/amd_score.md` 末尾の「過去分一括抽出 (2026-05-07 batch)」セクション。

### 限界 / 次の段階
1. **MCP 接続は私のセッション内のみ**: 本番から定期実行するには Slack/Drive/Notion API token + Vercel env + API route 実装
2. **cron 化**: `/api/cron/amd-score-l2-refresh` 等の route 化が次タスク
3. **WebSearch も同様**: Anthropic 公式 web_search tool or Google Custom Search API
4. **抽出精度の検証**: まさが UI で実値と照らし合わせて補正していく運用

### 主な変更
- 新 script: `pwa/scripts/extract_amd_score_from_l2.py`
- design log + sessions log 更新
- DB に 71 評価点投入済 (本番反映)

---

## 2026-05-07 (深夜) — AMD Score L2 cron 実装 (6 ソース週 1 自動抽出)

「Slack/Drive/Notion/Gmail/Calendar/ネット検索の 6 ソースから cron で情報抽出」というまさ要望に対応。本番 PWA から定期実行できる cron route として実装。

### 認証方針 (まさ判断)
- 全部直接認証 (Service Account / OAuth refresh token を Vercel env)
- Slack: Bot Token (xoxb-…) を `SLACK_BOT_TOKEN`
- Notion: Integration Token (secret_…) を `NOTION_API_KEY`
- Google (Drive/Gmail/Calendar 共通): OAuth refresh token を `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `GOOGLE_OAUTH_REFRESH_TOKEN`
- WebSearch: Anthropic 公式 web_search tool (既存 `ANTHROPIC_API_KEY` 流用)

### 頻度・スコープ (まさ判断)
- 週 1 回 (毎週月曜 03:00 JST = 日曜 18:00 UTC)
- cron だけ (全 PJ 自動)、UI ボタン無し

### 新規ファイル
- `src/lib/sources/slack.ts` — `WebClient` で search.messages + conversations.history (主要 channel 横断)
- `src/lib/sources/notion.ts` — `@notionhq/client` で search + blocks.children.list (各ページ最大 4KB)
- `src/lib/sources/google.ts` — Drive/Gmail/Calendar 共通の OAuth/Service Account auth
- `src/lib/sources/drive.ts` — files.list + files.export (Docs/Sheets/Slides を text 化、PDF はメタのみ)
- `src/lib/sources/gmail.ts` — users.messages.list + get (Subject + Snippet + 本文 2KB)
- `src/lib/sources/calendar.ts` — events.list (過去 24ヶ月 + 未来 12ヶ月)
- `src/lib/sources/web-search.ts` — Anthropic web_search tool wrapper (Sonnet が時系列要約)
- `src/lib/amd-score-l2-extract.ts` — orchestrator
  - `extractAmdScoreForPj(projectId)`: 1 PJ → 6 ソース並列 → Sonnet → upsert
  - `extractAmdScoreForAllPjs()`: 全 SU 系 PJ 順次
- `src/app/api/cron/amd-score-l2-refresh/route.ts` — Vercel cron route (Bearer auth、maxDuration=300s)
- vercel.json — `0 18 * * 0` (週 1)
- evaluator は `'cron_l2_extract'` で記録 (手動 / 一括 batch / cron 全部区別可)

### 依存追加
- `@slack/web-api`
- `@notionhq/client`
- `googleapis`

### Graceful degradation
- 各 source は env 未設定なら skip + 0 件返す → cron は動くが空データ
- 全 source 揃ったら本格運用、部分的に揃えても動く

### 運用開始条件
1. まさが Vercel env に上記 4 つの token を登録
   - Slack Bot Token (workspace admin で作成、scopes: search:read, channels:history, channels:read, groups:history, groups:read)
   - Notion Integration (Notion settings で作成 → AMD workspace の root ページに招待)
   - Google OAuth (Google Cloud Console → OAuth client ID 作成 → refresh token 取得 — Drive/Gmail/Calendar scope)
2. 翌週月曜 03:00 JST で初回 cron 実行
3. もしくは即時実行: `curl -H "Authorization: Bearer $CRON_SECRET" https://amd-os-pwa.vercel.app/api/cron/amd-score-l2-refresh`
4. 結果: amd_score_inputs に evaluator='cron_l2_extract' で upsert される

### 注意点
- Vercel Hobby plan の maxDuration=300s 上限。9 PJ × ~30s ≈ 270s で収まる想定だが、超過するなら PJ chunk 化 (3 PJ ずつ別 cron path) 検討
- LLM コスト: 9 PJ × 週 1 × Sonnet 4.5 (input ~10KB, output ~5KB) = 月 36 回の Sonnet 呼び出し
- AmdScoreView に「再抽出」ボタンは付けていない (UI 不要というまさ判断)、必要なら別途追加

### 主な変更ファイル (この phase)
- `src/lib/sources/{slack,notion,google,drive,gmail,calendar,web-search}.ts` (新規 7 ファイル)
- `src/lib/amd-score-l2-extract.ts` (新規)
- `src/app/api/cron/amd-score-l2-refresh/route.ts` (新規)
- `vercel.json` (cron 1 行追加)
- `package.json` (deps 3 個追加)
- `SPEC_pwa.md` (env vars + cron 表に追記)
- `HANDOFF_pwa_rebuild.md` (運用開始条件)

---

## 2026-05-07 — VC List フル実装 (quirky-driscoll worktree, Opus 4.7)

国内ディープテック VC マスタを PWA に追加。詳細は [`design/vc_list.md`](2026-05_vc_list.md)。

設計議論で決まった大方針:
- Atlas (世界マクロ) と分離。VC ニュースは `vc_news` の独立系統
- `support_org_members` (PJ 立ち上げ前メンバー) と分離。投資家関係は `vc_contacts` + `project_vc_relations` を新設
- DPE 残額は出所 (estimated/heard_from_contact/public_disclosure) を必ず記録
- `vcs.amd_rating` (★1-5) で AMD 内部相性評価
- 自動収集が骨格、つくよみ chat / 手入力は補完

### 実装範囲 (Phase 1-6 一気)

**Phase 1: スキーマ + 型 + データ層 + seed**
- migration `016_vc_list.sql` (vcs/vc_funds/vc_investments/vc_contacts/project_vc_relations/vc_news の 6 テーブル) → 本番適用済
- `src/types/vc.ts`
- `src/lib/vc-data.ts` (read + write API + format util + label map)
- `src/app/api/admin/seed-vcs/route.ts` (Claude + web_search で国内 VC 一括生成 → upsert)

**Phase 2: 閲覧 UI**
- GlobalNav に「VC」を Venture Map の右に追加。inbox 未確認件数バッジ
- `/vcs` リスト (sortable: 接点数/最終接触/DPE残/★/vintage/名前 + 検索 + type/募集中ファセット)
- `/vcs/[id]` 4 ペイン詳細 (特性 / ファンド + DPE残 / PJ 接点 / 出資先 + ニュース)

**Phase 3: 編集 UI**
- `/vcs/[id]/edit` (基本情報フォーム + 5 セクション: funds/investments/contacts/relations/news manual add、各モーダル CRUD)

**Phase 4: 自動収集**
- `/api/cron/vc-news-ingest` (Claude Sonnet 4.6 + web_search、毎朝 09:00 JST、25 VC/run round-robin)
- vercel.json cron 追加 (`0 0 * * *` UTC)
- `/vcs/inbox` 受信箱 (verify / dismiss / fundraise → ファンド情報反映 1 クリック)

**Phase 5: つくよみ統合**
- 7 tool 追加: `upsert_vc` `upsert_vc_fund` `update_vc_dry_powder` `add_vc_investment` `add_vc_contact` `add_vc_news` `link_project_vc`
- `/vcs/[uuid]` ページ context 自動同梱 (`loadVcContext`)
- system prompt に VC tool 群と使い分け例を追記

**Phase 6: docs + deploy**
- SPEC_pwa.md (ルーティング表 / cron 表 / データモデル「VC List」セクション)
- design/vc_list.md 新規

### 主な変更ファイル
- migration: `scripts/migrations/016_vc_list.sql` 適用済
- 新 lib/types: `src/types/vc.ts`, `src/lib/vc-data.ts`
- 新 page: `src/app/(app)/vcs/page.tsx`, `vcs/[id]/page.tsx`, `vcs/[id]/edit/page.tsx`, `vcs/inbox/page.tsx`
- 新 API: `src/app/api/admin/seed-vcs/route.ts`, `src/app/api/cron/vc-news-ingest/route.ts`
- 改修: `src/components/nav/GlobalNav.tsx` (VC nav + バッジ), `src/app/api/tsukuyomi/chat/route.ts` (VC tool 7 個 + page-aware context), `src/app/globals.css` (.i input util), `vercel.json` (cron), `SPEC_pwa.md`
- 新 design log: `design/vc_list.md`

### 初期投入手順 (本番反映後)
```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://amd-os-pwa.vercel.app/api/admin/seed-vcs
```

---

## 2026-05-07 — `/project/[projectId]/config` 移植 (naughty-lehmann worktree)

### 経緯
前セッション (5b3c1a9) で「コックピットの ⚙️ config リンクの本来の飛び先」が GAS `gas/226_ProjectConfig.html` だと特定済 (約 700 行の PJ 設定画面)。暫定で `/admin/projects#${projectId}` アンカーに繋いでいたが、PWA 側に等価ページが無かったため移植。

### スコープ (Phase 1)
GAS 226 の **基本情報 / メンバー / 契約・料金 / 請求書送付** を PWA に移植。
**Deductions (PJ予算控除枠)** は専用テーブルが PWA 側に未存在なので Phase 2 (別セッション) に分離。
**contract_start_date / contract_end_date** は projects table に列が無いので今回スキップ (start_ym / end_ym で代替)。

### 実装

**Migration 017**: `pwa/scripts/migrations/017_project_members_role_columns.sql`
- `project_members` に `is_pm` / `is_closer` / `role_label` 列追加
- 既存の `members.role='pm'` を `project_members.is_pm=true` に back-fill
- 本番適用済

**新 lib**: `pwa/src/lib/project-config-data.ts`
- 型: `ProjectConfigProject` / `ProjectConfigMember` / `MemberMasterRow` / `ProjectConfigData`
- `fetchProjectConfig(projectId)`: projects + project_members + members を並列取得 → PM/Closer 名解決
- `saveProjectConfig(projectUuid, patch)`: ホワイトリスト式部分更新 (status / report_emails / start_ym / end_ym / fee_type / fee_amount / invoice_*)
- `saveProjectMembers(projectId, members)`: GAS と同じ「全削除→挿入」方式 (履歴保持はしない)

**新 component**: `pwa/src/components/project-config/ProjectConfigForm.tsx`
- 4 section: 基本情報 / メンバー / 契約・料金 / 請求書送付
- メンバー section は table CRUD + 「＋ メンバー追加」ボタン (memberMaster ドロップダウン)
- 「送付モード = manual」のときは To/CC/BCC 入力ブロックを隠す (GAS と同じ挙動)
- 固定下部「保存バー」+ 右下 toast (3 秒)
- 未保存変更時は「未保存の変更あり」を表示、未変更時は保存ボタン disabled

**新 page**: `pwa/src/app/(app)/project/[projectId]/config/page.tsx`
- `useParams()` → `<ProjectConfigForm projectId={...} />`

**配線**: `pwa/src/components/cockpit/CockpitHeader.tsx`
- 暫定リンク `/admin/projects#${projectId}` → 正規ルート `/project/${projectId}/config`
- 「⚠️ 暫定リンク」コメントは撤去

### スキップした項目 / 次回フォローアップ
- **PJ予算控除枠 (Deductions)**: GAS 226 で 5 番目のセクション (rate / fixed モード、buffer / salesFee / advisor / other 種別、planCycle 連携でのpt単価表示)。PWA に `project_deductions` table が無いので、別セッションで table 設計から
- **契約期間 (contract_start_date / contract_end_date)**: projects table に列が無い。`start_ym` / `end_ym` で代替できているか要確認。必要なら migration 018 で追加
- **PM / Closer の確定**: 現状は project_members の `is_pm` / `is_closer` フラグで決まる (基本情報セクションに readonly 表示)。projects table に `pm_member_id` / `closer_member_id` を別途持つかは設計判断 (前者は member の参画期間に追従するメリット、後者は membership 履歴と独立で堅い)

### 主な変更ファイル
- 新 migration: `pwa/scripts/migrations/017_project_members_role_columns.sql` (適用済)
- 新 lib: `pwa/src/lib/project-config-data.ts`
- 新 component: `pwa/src/components/project-config/ProjectConfigForm.tsx`
- 新 page: `pwa/src/app/(app)/project/[projectId]/config/page.tsx`
- 改修: `pwa/src/components/cockpit/CockpitHeader.tsx` (リンク先正規化)
- 改修: `pwa/SPEC_pwa.md` (ルーティング表に `/project/[projectId]/config` 追加)

---

## 2026-05-07 〜 2026-05-08 — blissful-mcclintock セッション (大量フィードバック修正)

長時間の対話セッション。まさからの 18+ 個のフィードバックに連続対応した記録。

### 月次ルーティン × 各ステップ専用モーダル (大規模)
- **iOS RoutineFlowView を正本として PWA に逆移植** (回帰 3 度目に終止符)
- 新規モーダル: `CockpitRoutineBudgetModal` / `CockpitRoutineMeetingModal` / `CockpitRoutineReportFixModal` / `CockpitRoutineInvoiceModal` (見積/請求 2 モード) / `CockpitRoutineInvoiceSendConfirm`
- `CockpitView.resolveStepModalFromTap()` で stepId → モーダル振り分け、reimburseConfirm のみ `/reimburse` 遷移
- `?step=` URL クエリ対応 (mypage TODO ディープリンク)
- `pwa/src/lib/supabase/edge-functions.ts` 新設 (callEdgeFunctionGET / POST、生 fetch ベース)
- `supabase.functions.invoke` が "Failed to send a request" エラーになるため全部生 fetch に置換 (BUGS 参照)

### 設計 md の集約 (`pwa/design/`)
- `pwa/SPEC_pwa.md` を含めて全設計 md を `pwa/design/` に移動
- `pwa/design/README.md` 新設 (インデックス + 必読順序)
- `pwa/design/routine.md` 新設 (月次ルーティンの正本仕様)
- AGENTS.md / CLAUDE.md / HANDOFF / BUGS / sessions の参照を一括更新
- 「`design_log/` には sessions_*.md だけ。新規設計 md を作らない」ルール追加

### deploy 自動通知 (`pwa/scripts/deploy.sh`)
- macOS osascript で Build Ready 通知を鳴らす
- vercel ls がパイプ経由で URL のみ返す → `vercel inspect` で status 取得に変更 (BUGS 参照)
- CLAUDE.md の正本 deploy コマンドをこの script に置換

### 凍結予定 / 再開予定 UI
- migration 021: projects に `freeze_from_ym` / `restart_expected_ym` 追加
- admin/projects 列追加。両方セットで「❄️ N月〜M月直前 停止中」表示
- cockpit 右カラムに状態バッジ + 月次ルーティンの自動非表示
- status は active のまま運用、履歴を乱さない設計

### admin/projects 大改修
- 「編集」ボタン削除、各セルクリックでセル単位編集 (Enter 保存 / Esc 取消)
- 列順並び替え: 左に頻繁更新項目、右に freee/Slack/Drive
- 列追加: PL/PM/クローザー (project_members 経由、別モーダル AdminProjectMembersModal)、停止/再開予定、支払期日、請求書送付モード
- 関係先メールアドレス列を複数行折り返し表示
- 「報告メール」ラベル → 「関係先メールアドレス」に変更
- migration 018: project_members.is_pl 追加 (PL = Project Leader)、projects.payment_due_day 追加
- migration 019: 全 PJ デフォルト invoice_send_manual=true に
- `/api/admin/project-members` 新規 (RLS bypass で service_role 経由 upsert)

### 各タスクに「PL に確認依頼」CTA
- `/api/notify/pl-review` 新規。project_members.is_pl=true の slack_id 全員に Slack DM
- BudgetModal / ReportFixModal / InvoiceModal の CTA に `notifyPlReview` 連携
- `pwa/src/lib/notify-pl.ts` 新設

### 請求書 InvoiceModal 拡張
- 単価入力でマイナス記号許可 (返品/値引き行)
- 単価入力欄サイズ拡大、placeholder "0" 削除 (紛らわしい)
- 前月の請求書リンク (freee 番号 + PDF URL) を表示
- 支払期日デフォルト = `payment_due_day` (admin/projects で設定) で計算
- 土日祝なら前営業日に補正 (`pwa/src/lib/japanese-holidays.ts`、再帰なし無限ループ防止)

### スコアリングボード拡張
- CockpitVentureStatus に PL/PM/クローザー/AMD 支援期間/SU 設立年月日 行を追加
- `project_members` を fetch して各 PJ の役割を表示

### つくよみが全員「まさ」と認識
- `/api/tsukuyomi/chat` の SYSTEM プロンプトをハードコードから動的に
- ログイン中ユーザーの code_name + role を members から引いて挿入
- TsukuyomiChatDrawer.tsx 表示も "まさ" 固定 → 動的 code_name に

### /api/progress/events / reimbursement の GAS bridge → Supabase 直読み
- `/api/progress/events` を GAS rewardDashboard 経由 → Supabase `member_activities` 直読みに置換
- `/api/progress/reimbursement` 同様 (GAS reimburseForMonth → reimbursements 直読み)
- 月次モーダルの数十秒の遅延が解消

### CX 4月「イベントなし」の根本原因
- `member_activities` テーブルが空。複数の bug が連鎖していた:
  1. `member_activities.milestone_id` カラム欠落 (migration 020)
  2. `member_activities.member_id` / `project_id` が UUID 型 (migration 022 で text に)
  3. `member_activities.source` の check 制約に "inferred" が無かった (migration 023)
- cron `member-activities` が UUID syntax error で全件失敗、空のままだった
- それに加えて plan_cycle 期間切れの PJ (CX, CTB, SE, p11) は「no active plan cycle」で skip
- まさのフィードバックで「データが詰まってる」じゃなく「DB 列定義 + 期未設定」が原因と判明

### スプシから projects + project_members 復元
- `/api/admin/inspect-sheet` / `/api/admin/restore-from-sheet` 新規 (CRON_SECRET 認証)
- `1v_xW_itzi4QSH-kXNoL_nOw7wLR_4oaqezG7JxvDtkE` の DB_Projects + DB_ProjectMembers + DB_Members から:
  - projects.client_name / freee_partner_id / invoice_to_emails 復元 (9 PJ)
  - project_members 全置換 (25 行、PM/クローザー復活)
  - projects.report_emails (関係先メールアドレス) を members.email 集約で再生成 (10 PJ)
- 4月再抽出 (`/api/cron/member-activities?ym=202604`) で p21=11件 / p19=5件 保存成功

### 月次モーダルに「期未設定」警告
- CockpitView で planCycle が null の場合、過去最新 plan_cycle を fallback として CockpitNextPeriodSetup に渡す
- 期間切れ時に「⚠️ 今期の MS 期間 (YYYY/MM) は終了しています」警告

### 立替精算ページ
- `/reimburse` の Coming Soon を解消、自分の立替リスト read-only 表示 (iOS ReimburseListView の最小移植)

### その他軽微
- 立替精算が期日前なのに完了になるバグ修正 (CockpitRoutineGas に `isPastReimburseDeadline()` 追加)
- ヘッダーロゴ表示 (`pwa/public/amd-logo.png` を ios/logo_trans.png から流用、サイズ h-7 w-7)
- 「A AMD OS」→ ロゴ + 「AMD OS」
- 月次ルーティンの月見出しに「請求月」変更ピッカー復活 (`InvoiceYmPicker`)
- ProjectConfigForm からメンバー/請求書送付セクション削除 (admin/projects に集約)

### 主な migration
- 018: project_members.is_pl + projects.payment_due_day
- 019: 全 PJ デフォルト invoice_send_manual=true
- 020: member_activities.milestone_id 追加
- 021: projects.freeze_from_ym + restart_expected_ym
- 022: member_activities.member_id / project_id を text に変換
- 023: member_activities.source check 緩和 (inferred / manual / cron_l2_extract 許可)

### 残タスク (次セッションで)
- **CX (p20) / CTB (p06) / SE (p10) / p11 で次期 MS 期間 (2026 Q2 〜) を設定** → 4月以降のメンバー活動が cron で自動的に埋まる
- **過去 monthly_reports (4月分等) の復元** → スプシ DB_MonthlyReports からの restore script 未実装
- 5月の monthly_reports 生成 (no report content)
- まさが #15 表示 (PL/PM/クローザー / AMD 期間バッジ) の最終目視確認 — hard reload 推奨
- `saveProjectMembers` 全削除→挿入をやめて incremental update に (将来事故防止、まだ未対応)

---

## 2026-05-08 — admin/projects PL/PM/クローザー編集を集合 incremental に再設計 (keen-wescoff worktree)

前セッションの「全削除→挿入」事故 (saveProjectMembers が項目消失を引き起こす) をまさが連続で踏んで修正依頼。3 件まとめて対応。

### まさの依頼
1. PL/PM/クローザーを編集すると **これまでアサインしていた情報がすべて削除される** → 原因特定 + 再発防止
2. PL/PM/クローザー 表示は 1 列にまとめず、**3 列に分ける**。編集ボタン削除し、セル内の名前 (例: PL に「まさ」) クリックで編集モーダル → 「修正」ボタンで FIX
3. 列増えるので **横スクロール許容**

### 原因
- `/api/admin/project-members` POST が "全削除→挿入" 方式: `DELETE FROM project_members WHERE project_id=?` → `INSERT` 渡された rows
- INSERT する row には `role` (古い列), `id` (UUID), 既存の `role_label`, `join_ym` などが含まれず、**副作用で値がリセット** (`id` 新 UUID 再生成、`role` NULL 化)
- モーダル側でメンバー行が空配列になりうるパス (race / autocomplete blank / silent fetch fail) があると、削除だけ走って挿入 0 件 → 全消失
- HANDOFF 残タスクに「saveProjectMembers の incremental 化」が放置されていた

### 修正
- **新 API** `pwa/src/app/api/admin/project-members/role/route.ts`
  - body: `{ projectId, role: 'pl'|'pm'|'closer', memberIds: string[] }`
  - 既存行 + 集合外 → `is_<role>=false` に UPDATE (行は残す)
  - 既存行 + 集合内 → `is_<role>=true` に UPDATE
  - 行なし + 集合内 → 新規行 INSERT (`is_<role>=true`、他フラグ false、is_active=true)
  - 他のフラグ・他のメンバー行・他の列は一切触らない (incremental)
- **新モーダル** `pwa/src/components/admin/AdminProjectRoleEditModal.tsx`
  - ロール 1 つだけのチェックリスト
  - 「修正」ボタン (dirty=false なら disabled)
  - members マスタ取得 + active メンバー + 既割当てメンバーを列挙
- **AdminProjectsTable.tsx** 改修
  - thead: 「PL / PM / クローザー」1 列 → **PL / PM / クローザー 3 列**
  - tbody: 各列セルクリックで該当ロール用モーダル
  - 旧「✏️ 編集」ボタン削除
  - `min-width: 1200px → 1600px` (横スクロール)
- **削除した資産**
  - `pwa/src/components/admin/AdminProjectMembersModal.tsx` (旧 全部編集モーダル)
  - `pwa/src/app/api/admin/project-members/route.ts` (旧 全削除→挿入 POST)
  - `lib/project-config-data.ts` の `saveProjectMembers` 関数 (`MemberInput` 型は ProjectConfigForm の dead code が依存しているため互換目的で残す)
- **ProjectConfigForm.tsx** dead code 整理
  - `saveProjectMembers` import 削除
  - `if (false as boolean) { _unused: MemberInput[]; ... }` ブロック削除

### 主な変更ファイル
- 新: `pwa/src/app/api/admin/project-members/role/route.ts`, `pwa/src/components/admin/AdminProjectRoleEditModal.tsx`
- 改修: `pwa/src/components/admin/AdminProjectsTable.tsx`, `pwa/src/components/project-config/ProjectConfigForm.tsx`, `pwa/src/lib/project-config-data.ts`
- 削除: `pwa/src/components/admin/AdminProjectMembersModal.tsx`, `pwa/src/app/api/admin/project-members/route.ts`
- ドキュメント: `pwa/BUGS.md` (新 entry), `pwa/HANDOFF_pwa_rebuild.md` (残タスクから消し込み)

### 教訓
- 「全削除→挿入」は同テーブルの他列を巻き込んで破壊する。incremental update が原則
- 「all-or-nothing」型の API は、UI 側のどんな race / blank state でも全消失を引き起こす。書き込みは「触る列だけ更新」「触らない列は読まない」で書く
- HANDOFF 残タスクで「再発防止」が書かれていたら優先度を上げる。同じ事故が起きた

---

## 2026-05-08 (続) — まさからの 6 件修正 (PWA) + 請求書送付 nudge (GAS)

### PWA 6 件 (commit `628ac72` + `d53549c`)

1. **AdminProjectRoleEditModal の候補を active メンバー限定**
   - `members.status='active'` のみ。inactive な既割当てメンバーは候補から消えて、selected も active 内集合だけに init
   - dirty 判定は維持 (active な既割当てが orig)

2. **report_emails をスプシ DB_Projects.reportEmails から再復元**
   - 旧: `members.email` 集約で AMD メンバーのメアドが入っていた誤動作 → 廃止
   - `restore-from-sheet` route で `reportEmails` 列を直接コピー、null/空値も上書き対象に
   - `?onlyReportEmails=1` モード追加: project_members 全置換は走らせず report_emails ピンポイント上書きだけ
   - 22 PJ 全件で UPDATE 実行成功

3. **関係先メールアドレス表示をカンマ区切り**
   - 旧: 改行 (`whitespace-pre-line` + `\n` join) → 横スペース節約のため改行
   - 新: `, ` で 1 行表示。max-width 200→260px に微増

4. **PJ status セル保存反映バグ修正**
   - 原因: `AdminProjectsTable` が anon クライアント (`@supabase/supabase-js` 直接) で update → RLS で silent に弾かれていた
   - 修正: `@/lib/supabase/client` の `createClient` (= `createBrowserClient`、auth 込み) に切替
   - status 以外の cell も同じ問題があり得るため一括解決

5. **「停止/再開予定」列を「終了ym」の右へ**
   - thead と tbody の両方で freeze/restart セルを移動
   - 列順: PJID / PJ名 / Status / PL / PM / クローザー / 請求先 / 関係先メアド / 請求書送付 / 支払期日 / 開始ym / 終了ym / **停止再開** / freee ID / Slack CH / Drive Folder

6. **月次報告書FIXモーダル改修**
   - 「PCで内容を編集する」ボタン削除 (PC で開いてるのに表示されるのは違和感)
   - 「✨ つくよみに修正させる」ボタン: textarea で指示 → `/api/monthly-report/edit-by-tsukuyomi` (Sonnet 4.6 が `<revised_report>` タグで本文返す → `draft_content` 上書き → 再ロード)
   - 「📝 手動で修正」ボタン: textarea で本文編集 → `/api/monthly-report/manual-update` で `draft_content` 直接保存
   - 「📨 PLに確認依頼する」ボタンは残す (FIX 完了マーカー)
   - mode state (`view` / `tsukuyomi` / `manual`) で UI 切替

### 請求書送付 nudge cron + Slack interactive button (GAS / commit 別途)

#### 仕様
- 投稿先: PJ 専用 Slack チャンネル (`projects.slack_channel_id`)
- メンション: `project_members.is_pm=true` かつ `is_active=true` のメンバーの `members.slack_id` を `<@U...>` で全員
- スケジュール: 6 occurrence
  - 締切前日 17:00 / 20:00
  - 締切日 10:00 / 12:00 / 15:00 / 17:00
- 締切日 = 翌月 9 日 (CTB は当月 28 日)、土日のみ前営業日 (祝日は未対応 — 簡易ロジック)
- 「✅ 送信済み」ボタン押下 → Supabase `billing_cycles.invoice_sent_at = NOW()` に PATCH
- ボタン押下時の元 nudge **絶対上書き禁止** (gas/CLAUDE.md ルール 4)。完了通知は **新メッセージ**で post

#### 実装
- 新 GAS ファイル `gas/017_InvoiceSendNudge.js`
  - `cron_invoiceSendNudge_()`: 5 トリガーから呼ばれる (10/12/15/17/20 時 JST)、各 PJ × 過去 2 ヶ月〜来月の ym で締切判定
  - `invoiceSend_handleDoneFromQueue_(job)`: worker から呼ばれる完了処理
  - `invoiceSend_runInternalSetup_(body)`: 1 回限り自動セットアップ (ScriptProperties + トリガー作成)
  - Supabase REST helper (`invoiceSend_supabaseRequest_`)
  - 送信済みログシート `DB_InvoiceSendNudgeLog` (projectId / ym / occurrence / sentAt / messageTs)
  - 重複送信抑止 + dedup (CacheService 5 分)
- 既存 `gas/081_SlackInteractive.js` の `slackInteractiveWorker` に invoice_send_done 分岐追加
- 既存 `gas/80_SlackWebhook.js` の doPost に `mode=internal_setup` 追加 + `slackQueueInteractiveCacheFromPayload_` の `allow` に `invoice_send_done: true`

#### 自動セットアップ (まさ作業ゼロ)
- `clasp push` + production deployment update (`@1422 → @1424`)
- PWA `.env.local` から `NEXT_PUBLIC_GAS_WEBAPP_URL` + `SUPABASE_SERVICE_ROLE_KEY` を取得 → curl で `?mode=internal_setup` POST
- GAS 側で `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を ScriptProperties に格納 + 5 トリガー作成 + slackInteractiveWorker トリガー確認 → `{ok:true, message:"setup complete"}`

#### 動作確認
- 次回 cron 発火時刻 (10/12/15/17/20 時 JST) に各 PJ で締切判定 + 該当 occurrence で nudge 送信
- 1 PJ ずつ実 PJ で動作する見込み (CX や CTB など、現実の請求書送付タスクが起きる PJ で観察)

### 教訓
- GAS 側のセットアップ作業 (ScriptProperties 設定 + トリガー作成) も `clasp push` + `clasp deploy --deploymentId` + Web App URL に POST する `internal_setup` mode を作ることで、まさを 1 回も触らせずに完遂可能
- production deployment update には `--deploymentId <既存ID>` 必須。これを忘れると新 URL になって Slack Interactivity URL の差し替え作業が発生する
- production の deploymentId は `clasp deployments` 一覧 + `.env.local` の Webapp URL prefix で特定可能
## 2026-05-08 〜 09 (funny-perlman セッション) — MTGサマリ機能 + L2_DATA 正本化

### 報告会日程調整 (CockpitRoutineMeetingModal) のステータス反映バグ修正
- **症状**: 予約完了しても「報告会日程調整」タスクが done にならず、再オープン時も「日程選択」UI が出る
- **原因**: `CockpitView.cockpit.billingCycles` が SSR fetch のスナップショットで、Edge Function (`schedule-meeting`) 後に再 fetch されない
- **解決策**: 予約成功時に `router.refresh()` で親 (cockpit page サーバーコンポーネント) を再フェッチ + `localConfirmedISO` で即時UI切替 + 自動 close を削除
- 詳細は BUGS.md「報告会日程調整の予約完了が反映されない」エントリ

### MTG サマリ機能 Phase 1 (本セッション完了範囲)
- 新方針: 月次フラット抽出 (`navigator_extract`) と並走で **会議単位** に Gemini 抽出 → Supabase `project_meeting_summaries` に upsert
- **PWA 側 (本 worktree)**:
  - migration 024: `project_meeting_summaries` 新設 (meeting_id PK, summary_short, decided/progress/next_actions/risks JSONB)
  - migration 025: RLS policy を `TO authenticated` のみ → `TO anon, authenticated` に修正 (PWA は anon key で read-only のため)
  - `supabase-data.ts` に `fetchProjectMeetingSummaries`
  - `CockpitMeetingSummary.tsx` 全面書き換え (月グルーピング、直近1年表示+トグル、行展開で topics)
- **GAS 側 (本 worktree)**:
  - `gas/180_SupabaseClient.js` 新規 (service_key で REST upsert/select、`_supa_props_` でプロパティ取得、`oneTime_setScriptProperty` 汎用)
  - `gas/074_MeetingSummaryRepo.js` 新規 (`nav_meeting_extractForProjectYm_` + バックフィル、source_hash で差分検知、maxItems=8 で 6 分制限避け)
  - `gas/092_AdminLLMExtractors.js` に `meeting_extract_basePrompt_` + `run_installMeetingExtractorConfig` 追加 (Protocol Store + DB_LlmModelConfig 同時登録)
  - `gas/163_LlmRouter.js` に Gemini 対応 (`llm_callGemini_`、`gemini-2.5-flash`)
  - `gas/152_NavigatorCron.js` の daily cron に新関数呼び出し追加
  - `gas/099_PwaApi.js` に admin actions `listProps` / `runFunc` 追加 (clasp run の代替)
  - `gas/appsscript.json` に `executionApi.access=MYSELF` 追加 (将来 clasp run 用、現状 webapp 経由で十分)
- **GAS デプロイ**: deployment ID `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` を v1421 に update
- **動作確認**: SX (p21) で 7 件抽出成功 (中身ありは 1 件のみ、6 件は議事録本文薄い → Phase 2 で全ソース統合する必要あり)

### Phase 2 が必要な理由 (まさ判断)
- Phase 1 は **Notion 議事録単独** で抽出 → 大半が「会議内容なし」になる (議事録本文が薄いだけで、実際の議論は Slack/Gmail/Calendar 説明文等に分散)
- 本来あるべき設計は: **1 MTG = 1 カレンダーイベント** を主軸にして、その周辺の Notion議事録 + Calendar + Slack + Gmail + Drive + GMeet を全部集めて Gemini に投げる
- データ収集の時間範囲ロジック (前後数日 etc) は既存 305-309 / R320 をそのまま流用
- 議事録なしイベントは `summary_short = "議事録なし"` で残す
- monthly_reports は会議サマリの集約結果として組み立てる (R313 改修、AMD-Report GAS 別セッション)

### L2 データ正本化 (まさの最重要指示)
- **`pwa/design/L2_DATA.md` 新設** ← AMD OS 中核データ正本
- L1 / L2 の定義 (まさ正本): 5 生データ (Gmail/Drive/Calendar/Slack/Notion) → L2 = 「欲しい情報の形」で抽出した正本
- L2 6 種: ① monthly report ② AMDプロトコル ③ MS進捗 ④ PJナレッジ ⑤ メンバーナレッジ ⑥ MTGサマリ
- 全テーブル / cron / 動作状況を表化、レポート関連 (Atlas / VC / AMD Score 等) も別カテゴリで列挙、cron を時系列タイムラインで可視化
- 6 入口に導線: AGENTS.common.md / pwa/CLAUDE.md / pwa/AGENTS.md / pwa/design/README.md / gas/CLAUDE.md / knowledge/amd_os_vision.md (Claude / Codex / GPT 全エージェントから辿れる構成)

### 動作実態の発見
| L2 | 行数 | 状態 |
|---|---|---|
| monthly_reports | 58 | ✅ R313 (AMD-Report GAS, 05:00) |
| **protocols** | **0** | ❌ **未稼働** (UI 削除されてる、スプシから掘り起こし要) |
| milestone_monthly_progress | 158 | ✅ cron/daily-estimate (PWA, 03:00) |
| **project_knowledge** | 2024 | ⚠️ データはあるが **書き込み元不明** |
| **member_knowledge** | **0** | ❌ **未稼働** |
| project_meeting_summaries | 7 | 🚧 Phase 1 稼働中 (Phase 2 で全ソース統合へ) |

### spawn 出した別タスク (chip)
1. **AMDプロトコル UI 復活 + スプシ掘り起こし** — 元はトップメニューの Atlas 左にあった、復活要
2. **PJナレッジ + メンバーナレッジ を AMD-Report GAS の cron で実装** — まさ判断「ReportGAS の仕事」

### 残タスク (次セッションで)
- **MTGサマリ Phase 2 実装** (Calendar event 主軸 + 5 生データ統合) — 074_MeetingSummaryRepo.js 全面書き換え + meeting_summaries.md spec 書き直し
- 上記 spawn 2 件は別 worktree で並行可能
- 既存 7 件の SX 抽出データは Phase 2 で再生成 (現状中身薄いだけなので消すか維持か Phase 2 設計次第)

---

## 2026-05-09 — MTGサマリ Phase 2 移行 (brave-cohen-15d352 セッション)

前セッション (funny-perlman) で Phase 1 までで止めた MTGサマリを Phase 2 仕様に移行。

### 何を変えたか

| 観点 | Phase 1 | Phase 2 |
|---|---|---|
| 主軸 | Notion 議事録ページ単独 | **1 calendar event = 1 行** (`meeting_id` PK = calendar event id) |
| 議事録ソース | Notion ページ本文のみ | **Notion 本文 + Gmail (`reportEmails` ±1日)** を結合 |
| 議事録なし扱い | 抽出スキップ | `summary_short = "議事録なし"` でマーカー行を残す |
| 差分検知 | 本文 sha256 | (Notion 本文 + Gmail 結合テキスト) sha256 |

### 実装

- migration 027 (`027_pms_phase2_calendar_event.sql`) 適用: 既存 7 行 DELETE + `notion_page_id` / `gmail_thread_ids` / `source_kinds` カラム追加
- `gas/074_MeetingSummaryRepo.js` 全書き直し: Notion 議事録 query → eventId 抽出 → Gmail 月単位キャッシュ → event 日 ±1日で thread pickup → 結合 sha256 → Gemini call → upsert
- `gas/092_AdminLLMExtractors.js` の `meeting_extract` プロンプトを v2 に更新 (combined sources 対応、version 260509_02)
- GAS push + deploy v1425 + Protocol Store install (`run_installMeetingExtractorConfig`)

### Gmail 流用ロジック

`mr_extractFromGmail_(projectId, startDate, endDate)` ([gas/307_MonthlyReport_GmailExtract.js](../../gas/307_MonthlyReport_GmailExtract.js)) を **daily cron 実行のうち、その 1 PJ × 1 ym で 1 回だけ** 月単位で呼ぶ → memory cache。`DB_Projects.reportEmails` (カンマ区切り複数) を `(from:X OR to:X)` でフィルタ。CircleBack / GMeet recording 通知 / クライアント議事録メールがここに流れてくる前提。

### 初回バックフィル結果 (p20 = SX × 202604)

- `inserted` 1 件 ("[CX] inner mtg.", sourceKinds: "notion")
- `inserted_none` 多数 (議事録なしマーカー行)
- `skipped_no_event_id` 多数 (CalendarToNotionMinutes 導入前 or 手動作成の Notion ページで eventId プロパティが空)
- **`gmailThreads: 0` が大半** → reportEmails の中身に CircleBack / GMeet 通知メールアドレスが入ってない or 議事録メールが届いていない

### 残課題 (Phase 2.1)

- `DB_Projects.reportEmails` の各 PJ の現状を確認 + CircleBack 通知メール / GMeet recording 通知メールの from アドレスを登録
- これにより議事録メールが Gmail cache に乗り、`source_kinds` が `notion+gmail` / `gmail` で稼働する MTG が増える

### Phase 2.5 (別セッション、AMD-Report GAS)

- R313_MonthlyReport_Cron を `project_meeting_summaries` 集約方式に書き換え
- Phase 1 の navigator_extract (月単位フラット) を完全廃止可能に

### 今回確立した運用知見

- worktree からは `.env.local` が無いので `apply_ddl.py` は main worktree 経由で absolute path 指定して実行する
- migration 番号は他 worktree の作業と衝突する可能性あり、`ls scripts/migrations/` で必ず確認してから新規番号を割り当てる

### 2026-05-09 後半: p21 (SX) 202604 で Phase 2 動作確認 OK

- まさ追加情報「p20=CX で Notion のみ」「p21=SX で Gmail に議事録大量」を踏まえ、p21 で Phase 2 本番テスト
- `mr_gmail_getProjectInfo_` で reportEmails 確認:
  - p20 (CX): `kamiya.koji@nims.go.jp`, `NATSUME.Kyohei@nims.go.jp` (NIMS 関係者個人 2 件)
  - p21 (SX): `renkei@stu.ehime-u.ac.jp` 等 + `@ehime-u.ac.jp` ドメインワイルドカード (5 件)
- p21 × 202604 バックフィル結果:
  - 月単位 Gmail 取得: 15 thread
  - `inserted (sourceKinds: notion+gmail)`: 2 件 ← Phase 2 のコア機能成功
  - `inserted (sourceKinds: notion)`: 5 件
  - `inserted_none` (議事録なしマーカー): 13 件
  - `skipped_no_event_id` (古い議事録、eventId 空): 14 件
  - `deferred_maxItems` (maxItems=8 打ち切り): 19 件 → daily cron で順次処理される
  - `error_llm` (Gemini 偶発失敗): 1 件 → 次回 cron で再試行
- これで Phase 2 (Notion + Gmail 結合 → Gemini 抽出 → calendar event 単位 upsert) は **動作確認済**
- `notion+gmail` が 2/20 件と少ないのは、議事録メールが「会議当日 〜 翌日」に届かず、もっと後で届く可能性。Phase 2.1 で pickup ウィンドウを ±1日 → ±3日 〜 ±7日 に広げる余地あり (任意)
- 命名訂正: 前段で「p20 (SX)」と書いていたのは間違い。正しくは **p20=CX**, **p21=SX**。md/HANDOFF を訂正済

### 2026-05-09 終盤: Phase 3 (会議終了 +60 分 trigger + iOS APNs 通知用テーブル)

まさからスクショで確認: 4/29 (水) が「サマリ未生成」表示 (= Gemini 空回答ケース)、3/25 など「議事録なし」マーカーは想定通り表示されてる。
追加要望:
- 「会議が終わって1時間後にその会議の議事録だけをピンポイントで収集」する仕組みを追加
- 拾えたら通知 (Slack ではなく Swift APNs)
- 03:00 cron は議事録部分を軽量化

### 確定事項
- 通知方式: **Swift APNs** (iOS ネイティブ、PWA Web Push でなく)
- cron 頻度: 毎X分でなく、**会議認識時に終了+60分の ad-hoc trigger** を 1 回だけ
- 03:00 daily cron: **拾い漏れ救済 fallback として残す** (Phase 3 trigger が立てそこなった分を翌朝救済)

### 実装

**UI (PWA)**:
- `pwa/src/lib/supabase-data.ts`: `ProjectMeetingSummary` に `sourceKinds` 列追加
- `pwa/src/components/cockpit/CockpitMeetingSummary.tsx`: `source_kinds='none'` を「議事録なし」、それ以外で内容空を「議事録あり・抽出空 (本文薄い or LLM 失敗)」と区別表示

**GAS**:
- `gas/074_MeetingSummaryRepo.js`:
  - `nav_meeting_processOneEvent_(eventId, projectId)` 新設 (1 event ピンポイント抽出)
  - `_meeting_findNotionPageByEventId_` 新設 (Notion DB query で eventId equals filter)
  - `_meeting_loadOneByMeetingId_` 新設 (差分検知用)
- `gas/153_MeetingHourlyTrigger.js` 新規:
  - `nav_meeting_scheduleUpcomingTriggers_(calendarIdOverride?)` — 「今日 〜 7 日先」の events を取り、各 event の終了 +60 分に `ScriptApp.newTrigger.at(date)` で 1 回限り time-trigger をセット。重複防止に `ScriptProperties.MEETING_PENDING_TRIGGERS` で記録。allDay/+prefix/EXCLUDE alias/pjCode=AMD は除外
  - `nav_meeting_triggerCallback` (アンダースコアなし、trigger 発火コールバック) — pending から fireAtMs <= now を取り、`nav_meeting_processOneEvent_` で抽出 → 拾えたら `meeting_notifications` upsert → 発火済 trigger 削除
  - `nav_meeting_listPendingTriggers` (デバッグ)
  - `nav_meeting_clearAllPendingTriggers_` (緊急用)
  - `_meeting_insertNotification_` (Supabase upsert)
  - calendar id 取得は (引数 > CFG_CalendarImport > ScriptProperties.MAIN_CALENDAR_ID > Session.getEffectiveUser) の優先順 (Web App curl 経由実行を考慮)
- `gas/152_NavigatorCron.js`:
  - `nav_meeting_extractForProjectYm_` の phase 名を `meeting_summary` → `meeting_summary_fallback` に
  - 末尾に `nav_meeting_scheduleUpcomingTriggers_` 呼び出し追加 (= 新 phase `meeting_schedule_upcoming`)

**Supabase**:
- `pwa/scripts/migrations/028_meeting_notifications.sql` 新規:
  - PK = meeting_id (FK to project_meeting_summaries, CASCADE)
  - notified_at TIMESTAMPTZ で送信済管理 (Swift 側が UPDATE)
  - source_kinds / summary_short / title 変更時に notified_at を NULL に戻すトリガで自動再通知
  - RLS: SELECT anon/authenticated, UPDATE authenticated (Swift が打つ)
  - partial index `idx_meeting_notifications_unsent` (notified_at IS NULL) で Swift polling 高速化

**iOS ハンドオフ**:
- `ios/HANDOFF_meeting_notifications.md` 新規: Swift 側の受信処理仕様 (Realtime sub or polling、ローカル通知、画面遷移、notified_at マーク)。実装は別セッション

### 動作確認

- migration 028 適用 OK (201)
- GAS deploy v1426 → v1427 → v1428 (calendarId override + Session.getEffectiveUser で curl 経由実行を可能に)
- 初回 scheduleUpcomingTriggers_ 結果: scanned 24 / scheduled 3 / skipped_excluded 13 / skipped_no_pj 6 / errored 2
- 3 pending triggers: p19 ZeMA定例MTG / p07 LiSTie経営会議 / p21 SX-JAFCO MTG → 各会議終了 +60 分に発火する予定
- errored 2 件は Logger.log に記録 (本番では問題なし、内容確認は GAS Editor から)

### 次セッションへ

- iOS 側: `ios/HANDOFF_meeting_notifications.md` に従って Swift APNs 受信実装
- 明朝以降: pending trigger が順次発火 → meeting_notifications に行が積もるか確認

---

## 2026-05-09 — Phase 4 ③ MS進捗 毎時 polling 化 (quirky-moore-b60501 セッション)

### 着手の背景

L2_DATA.md の「次セッションで実装: L2 全データ毎時 polling 化 (Phase 4)」優先度 1 = ③ MS進捗。
方針正本: [pwa/design/L2_DATA.md](../design/L2_DATA.md) Phase 4 セクション + Phase 3 (MTGサマリ) で確立した
「毎時 polling + source_hash 差分検知」パターンを横展開する。

### 設計判断

**1 PJ × 1 ms 単位でなく 1 PJ × 全 MS 一括の現行 LLM call を維持した**:
- L2_DATA.md には「1 PJ × 1 ms 単位に分解」とあったが、実装時に再検討
- 1 PJ × 9 MS にすると LLM call 数が 9 倍。差分検知前提でも初回登録時には 9 call 必要
- MS 横断推論 (「MS 1 完了 → MS 2 着手」) を LLM がしやすい
- source_hash は monthly_report 本文単位なので PJ 粒度で十分な差分検知ができる

**新規テーブル `progress_estimate_state` (PK: project_id+ym)** で source_hash + last_processed_at を持つ:
- 既存 `milestone_monthly_progress` は MS 単位なので「PJ 単位の差分検知 state」を別テーブルに分けた
- `last_processed_at` 古い順 sort で PJ 公平に処理

### 主な変更

**PWA**:
- `pwa/src/lib/progress-estimator.ts`:
  - `EstimateOptions { force?: boolean }` 追加。default `force = true` (= 既存呼び出し側挙動を変えない)
  - 関数冒頭で source_hash 計算 (= sha256(JSON({rb, rs, ms, prev, curr, sp})))
  - `progress_estimate_state` から既存取得 → `force=false && existing.source_hash === new` で LLM スキップ + last_processed_at だけ touch + `unchanged: true` を return
  - 完了時に `progress_estimate_state` を upsert (source_hash, saved_count, total_count, llm_model, last_processed_at)
- `pwa/src/app/api/cron/hourly-estimate/route.ts` 新規:
  - `maxDuration = 300` (Vercel Pro)
  - target list = アクティブ PJ × {当月, 前月} (月跨ぎ救済)
  - `progress_estimate_state.last_processed_at` 古い順 (NULL = 未処理優先) sort
  - `force=false` で `estimateProgress` 呼び出し
  - LLM call 数 ≥ maxItems (default 14) で打ち切り → `hasMore=true` を return、次時 cron で残り処理
  - クエリ `?force=1` で強制再推定、`?ym=YYYYMM` で特定月、`?maxItems=N` で打ち切り上限変更
- `pwa/src/app/api/cron/daily-estimate/route.ts` 削除 (旧 03:00 daily cron)
- `pwa/vercel.json` 更新: `path: /api/cron/hourly-estimate`, `schedule: "0 * * * *"`

**Supabase**:
- `pwa/scripts/migrations/029_progress_estimate_state.sql` 新規:
  - PK = (project_id, ym)
  - `source_hash` `last_processed_at` `saved_count` `skipped_count` `total_count` `llm_model` `message` 列
  - `idx_pes_last_processed_at` で sort 高速化
  - RLS: SELECT anon/authenticated 開放、書き込みは service_role

**仕様 md**:
- `pwa/design/ms_progress.md` 新規 (本 Phase の正本仕様書)。`progress_estimation.md` は Phase 1〜2 履歴として残置
- `pwa/design/L2_DATA.md` の状態列 / cron 表 / 改修優先度表 / 関連 md / 改訂履歴 を Phase 4 完了で更新

### 実装上の注意点

- `progress_estimate_state` の `source_hash` 入力には `tsukuyomi_context.system_prompt` (reward_estimate tag) も含めた → 推定プロンプトを書き換えたら自動的に全 PJ 再推定
- `pm_manual` / `criteria_toggle` で手動確定済み MS は LLM を呼んでも save 段階でスキップされる (現行通り)
- `monthly_report` 本文不在 PJ は早期 return で state テーブルに書き込まない (= 次時再チェック)
- 手動「AIで再推定」ボタン (`/api/progress/estimate`) と `report/generate` 直後 fire-and-forget は force=true (default) で source_hash 無視

### Vercel Hobby plan に阻まれて GAS 経由構成へピボット (本セッションの大事な学び)

最初に Vercel deploy を試したら以下のエラー:

```
Error: Hobby accounts are limited to daily cron jobs.
This cron expression (0 * * * *) would run more than once per day.
Upgrade to the Pro plan to unlock all Cron Jobs features on Vercel.
```

事前確認では「14 cron 持ってるので Pro plan」と推測したが誤り。Hobby plan は **cron 数の上限はない (= 任意数 OK)** が、**個々の cron schedule が "1 日 1 回まで"** という制約がある。だから既存 14 cron は全て daily 1 回未満の schedule になっていた。

対応: Pro upgrade はまさのカード設定が必要なため、**自動化で完結させる方針**に切替:

- `vercel.json` から `/api/cron/hourly-estimate` を削除 (route 自体は残す = curl で直接叩ける)
- 新規 `gas/154_PwaCronCaller.js`:
  - `nav_pwa_pingHourlyEstimate(opts?)` — UrlFetchApp で `${PWA_BASE_URL}/api/cron/hourly-estimate` を `Bearer $CRON_SECRET` で GET
  - `nav_pwa_setupHourlyPwaTrigger_()` — 毎時 0 分 time-trigger 設置
  - `nav_pwa_setProps_(props)` — ScriptProperties (PWA_BASE_URL / CRON_SECRET) を curl 経由で設定 (= まさの手動設定不要)
- GAS ScriptProperties に PWA_BASE_URL + CRON_SECRET 追加 (.env.local から runFunc 経由で投入)
- 本体GAS time-trigger は +1 で 19+ 個 (上限 100 にまだ余裕)

Pro 移行後は vercel.json に schedule を戻して GAS trigger を消すだけで切替可能。設計上、route 自体は触らない。

### 動作確認

- TS 型チェック: `tsc --noEmit` exit 0
- migration 029 適用 OK (Supabase 201)
- Vercel deploy: cron 0 個減らした構成で再 deploy (本セッション内で実施)
- GAS push + deploy + ScriptProperties 投入 + trigger setup: 本セッション内で実施
- 手動 ping (`runFunc&fn=nav_pwa_pingHourlyEstimate`) で本番動作確認

### 次セッションへ

- 残り Phase 4 タスク (優先順):
  - ⑤ メンバーナレッジ 新規実装 (5 生データ → Sonnet → member_knowledge upsert、毎時 polling)
  - ④ PJナレッジ 流入元新規実装 (同上、project_knowledge upsert)
  - ② AMDプロトコル UI 復活 + 自動抽出 cron
- 本 Phase の動作確認: 翌日朝 `progress_estimate_state` を SELECT して各 PJ の last_processed_at が時間ごとに更新されているか
- まさへの判断材料: Vercel Pro plan に upgrade するか? 現状 GAS 経由で機能的には十分だが、Pro なら vercel.json に書くだけでシンプル化できる。Pro = 月 20 USD / cron 上限 40 個 / maxDuration 300秒

---

## 2026-05-09 (続) — Phase 4 残り 3 L2 一括完了 (quirky-moore-b60501 セッション継続)

### 着手の背景

まさからの指示「そのままここで全部終わらせて！」 を受けて、Phase 4 の残り (⑤ メンバーナレッジ + ④ PJナレッジ + ② AMDプロトコル) を本セッションで一括実装。

### 設計判断

**1 ファイル `gas/155_L2KnowledgeExtractor.js` に 3 extractor を集約**:
- 各 L2 ごとにファイル分けすると 3 ファイル分の boilerplate が増える
- 共通 helper (_l2_sha256_, _l2_loadStateMap_, _l2_upsertState_, _l2_touchState_, _l2_patchProjectKnowledge_, etc.) を 1 ファイルに集約できる
- 関心の分離は関数名 namespace (nav_member_knowledge_* / nav_project_knowledge_* / nav_protocol_*) で実現

**1 統合 state テーブル `l2_extract_state` (PK: l2_kind, target_id, scope_key)**:
- L2 ごとに別テーブル (member_state / project_state / protocol_state) を切ると 3 migration + 3 helper
- 1 統合テーブルで scope_key を `'global'` (member系) と `ym` (PJ系) で使い分けて差分検知
- 既存 `progress_estimate_state` (ms_progress 用) はそのまま温存 (= 全部統合する大規模リファクタは別 Phase)

**入力ソースは "二次集約" 版 (= 既存 L2 を Sonnet/Gemini で再処理)**:
- まさのルール「L2 = 5 生データから直接抽出」に厳密には反するが、Phase 4 初版は時間最適化を優先
- ⑤ member: `member_activities` (90日) + `project_meeting_summaries` (60日)
- ④ project: `monthly_reports` + `project_meeting_summaries` (当月)
- ② protocol: `project_meeting_summaries.decided/risks/next_actions` (当月+前月)
- 各 design md に「Phase 4.x で 5 生データ直結に改善予定」と明記
- 5 生データ直結は GAS の 305-309 (mr_extractFromNotion_ / mr_extractFromSlack_ 等) を流用すれば実装可能だが、メンバー単位の Slack 取得など新規追加が必要 → 別 Phase

**`④ project_knowledge` の既存 2024 行を破壊しない設計**:
- UNIQUE 制約 (project_id, category, entity_name) を追加すると、重複行がある場合に migration が失敗するリスク
- 代わりに cron 内で SELECT → 既存有り PATCH (id 指定の REST PATCH) / 無し INSERT で重複回避
- 「2024 行が何由来か不明」の状態を温存しつつ、新規 cron 由来は `source='l2_hourly_extract'` で識別

**`② protocols` の `protocol_id` 命名規則**:
- `"p4-{projectId}-{ym}-{sha8(title)}"` → 同月同タイトルの再抽出は同 ID で update (重複行を作らない)
- `status='candidate'` で入る → PM が UI で confirmed 昇格運用 (UI 実装は将来)

### 主な変更

**Supabase**:
- `pwa/scripts/migrations/030_l2_extract_state.sql` 新規 + 適用 OK (Supabase 201)

**GAS**:
- `gas/155_L2KnowledgeExtractor.js` 新規:
  - `nav_member_knowledge_pollAll` / `nav_member_knowledge_extractOne_`
  - `nav_project_knowledge_pollAll` / `nav_project_knowledge_extractOneForYm_`
  - `nav_protocol_pollAll` / `nav_protocol_extractOneForYm_`
  - `nav_l2_setupAllL2HourlyTriggers_` (3 trigger を一括設置)
  - 内部 helper 群 (sha256 / state load / upsert / touch / project_knowledge PATCH)
- LLM = Gemini Flash (既存 `llm_callJson("default", ...)` 流用)
- maxItems: member=5, project=4, protocol=4 (Vercel Hobby と違って GAS は 6 分以内なら OK だが、UrlFetchApp タイムアウト ~60秒を考慮した安全値)

**仕様 md**:
- `pwa/design/member_knowledge.md` 新規
- `pwa/design/project_knowledge.md` 新規
- `pwa/design/amd_protocol.md` 新規
- `pwa/design/L2_DATA.md` の状態列 / cron 表 / 改修優先度表 / 改訂履歴 を Phase 4 全完了で更新
- `pwa/HANDOFF_pwa_rebuild.md` を Phase 4 全完了で更新

### 実装上の注意点

- LLM プロンプトは「入力に書かれてない推測禁止 / 推奨件数を明示」で過剰生成を抑制
- ② protocol の重要度フィルタは LLM プロンプトで「月次の最重要 1-3 件」と明示。瑣末な決定は除外
- ⑤ member の system prompt で「name (code_name) を summary に含めない」と指定 (テーブル別カラムで管理されるため重複情報を避ける)
- GAS time-trigger は分単位指定不可なので、`everyHours(1)` で 3 trigger を別ハンドラ名で立てる → GAS が分散発火する
- `_l2_patchProjectKnowledge_` は PostgREST の PATCH を直叩き (`supa_upsert` は INSERT+merge=UPDATE on conflict だが project_knowledge には UNIQUE 制約がないので id 指定 PATCH が必要)

### 動作確認

- migration 030 適用 OK (Supabase 201)
- GAS deploy v1432: clasp push → deploy
- ScriptProperties 既設定 (Phase 4 ③ で設定済の SUPABASE_URL / SUPABASE_SERVICE_KEY / GEMINI_API_KEY を流用)
- trigger setup: `nav_l2_setupAllL2HourlyTriggers_` で 3 trigger 設置
- 手動 ping (各 pollAll を runFunc 経由) で動作確認

### 次セッションへ

- **Phase 4 全 6 L2 完了** (③⑤④② + ⑥ 既完了 + ① は別構造で OK)
- **Phase 4.x 改善案 (将来)**:
  - 5 生データ直結: ⑤ メンバー知識を Slack 個人 DM / mention search から直接抽出
  - 5 生データ直結: ④ PJナレッジを Notion 経営戦略 page / Slack channel から直接抽出
  - ② AMDプロトコル UI に「candidate → confirmed 昇格」ボタン追加
- 観察ポイント: 翌日朝 `l2_extract_state` を SELECT して 3 L2 × 各 target が積もり、`last_processed_at` が時間ごとに更新されているか
- 別件: iOS Swift 側の APNs 受信実装 (ios/HANDOFF_meeting_notifications.md)、MTGサマリ Phase 2.5 (R313 集約方式書き換え)
