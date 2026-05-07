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

---

## セッション (2026-05-06, cool-booth-b72d09 worktree, Opus 4.7)

PJ Status コックピット拡張を 6 phase で実装。`/project/[projectId]/cockpit` の上部に SU 系 PJ 用の Status セクションを追加。

設計の正本は **`pwa/design_log/2026-05_pj_status_cockpit.md`** に集約 (構造図・モーダル一覧・データモデル・API・cron・学習ループ・反省事項を含む)。

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

`/Users/masa/projects/before-zero/theory/amd_score.md` の正本式 (7 軸 Cobb-Douglas) を AMD OS に組み込んだ。詳細は `design_log/2026-05_amd_score.md`。

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
- `pwa/design_log/2026-05_amd_score.md` (新規、設計正本)

### 反省 / TODO
- σ_SU を `/venture-map/state-space` の Triple Helix 状態空間モデル推定値に自動連携 (現状は手動入力)
- データ駆動 α 推定 (9 PJ 階層 Bayesian)
- Shallow Tech モードの重み再分配 (理論 §11.3) — TRL=1.0 を BRL/HRL に再分配して K=1.0 と数値スケール一致を狙う
- VC valuation との比較ビュー (理論 §10) で AMD Score 高 + valuation 低 = 過小評価サイン
- AMD Score の cron 自動更新 (atlas signal が来たら関連 PJ の σ_SU を再評価)

---

## 2026-05-07 — AMD Score 周りの 8 改修 (4 phase 連続 deploy)

まさからの 8 修正要望に対応。詳細は `design_log/2026-05_amd_score.md` 末尾。

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
- design log: `design_log/2026-05_amd_score.md` (FRL ALQ + XRL 次レベル進捗 セクション追記)

## 2026-05-07 — VC List フル実装 (quirky-driscoll worktree, Opus 4.7)

国内ディープテック VC マスタを PWA に追加。詳細は [`design_log/2026-05_vc_list.md`](2026-05_vc_list.md)。

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
- design_log/2026-05_vc_list.md 新規

### 主な変更ファイル
- migration: `scripts/migrations/016_vc_list.sql` 適用済
- 新 lib/types: `src/types/vc.ts`, `src/lib/vc-data.ts`
- 新 page: `src/app/(app)/vcs/page.tsx`, `vcs/[id]/page.tsx`, `vcs/[id]/edit/page.tsx`, `vcs/inbox/page.tsx`
- 新 API: `src/app/api/admin/seed-vcs/route.ts`, `src/app/api/cron/vc-news-ingest/route.ts`
- 改修: `src/components/nav/GlobalNav.tsx` (VC nav + バッジ), `src/app/api/tsukuyomi/chat/route.ts` (VC tool 7 個 + page-aware context), `src/app/globals.css` (.i input util), `vercel.json` (cron), `SPEC_pwa.md`
- 新 design log: `design_log/2026-05_vc_list.md`

### 初期投入手順 (本番反映後)
```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://amd-os-pwa.vercel.app/api/admin/seed-vcs
```
