# HANDOFF — AMD OS PWA

次セッションが文脈を聞き直さずに再開できる **直近の引き継ぎだけ** をここに書く。

- 仕様 → `SPEC_pwa.md`
- バグ・教訓 (症状/原因/解決策/教訓) → `BUGS.md`
- 過去セッションの作業ログ → `design_log/sessions_YYYY-MM.md`
- 共通運用ルール → リポ root の `CLAUDE.md`、PWA 確認方針 → `pwa/AGENTS.md`

このファイルが 200 行を超えそうになったら、過去セッションを `design_log/sessions_YYYY-MM.md` へ切り出してスリム化する。

---

## 最終更新

2026-05-07 — AMD Score (Before Zero Theory v3.2 — 7 軸 Cobb-Douglas) フル実装 + config リンク調査結果反映

---

## 直近セッション要約

### 1) AMD Score フル実装 (このセッション)

理論正本 [`/Users/masa/projects/before-zero/theory/amd_score.md`](../../../before-zero/theory/amd_score.md) (Before Zero Theory v3.2) の AMD Score を AMD OS に実装。設計詳細は `pwa/design_log/2026-05_amd_score.md`。

主な変更:

- 新 lib `src/lib/amd-score.ts` (`calculateAmdScore` / `computeSigmaSU` / `classifyPhase` / `ALPHA_DEFAULT`)
- 新 data `src/lib/amd-score-data.ts` (amd_score_inputs / amd_score_alpha CRUD)
- 新ページ:
  - `/venture-map/amd-score` — 全 SU PJ 一覧 (score 降順 + phase filter)
  - `/venture-map/amd-score/[projectId]` — 個別 (Hero / Radar / 寄与表 / 経時 / 軸スライダー / α サイドバー)
- migration 013 (本番適用済): `amd_score_inputs` + `amd_score_alpha` + base alpha + 8 PJ retrofit seed
- cockpit 連携: AMD スコアグラフ log scale (1 → 100k)、phase 色チップ、breakdown モーダル 7 軸版に置換、`/venture-map/amd-score/[projectId]` への「7 軸を編集 →」link
- `/venture-map` ヘッダに「AMD Score →」ボタン
- 旧 `EVENT_BONUS` / `computeAmdScoreSeries(bundle)` / `computeAmdScoreBreakdown(bundle)` 削除、`computeCockpitAmdScoreSeries(inputs, alpha)` に集約

数式:
```
AMD Score = K · Π (X_i + 1)^α_i,  X = {σ_SU, TRL, BRL, GRL, SRL, HRL, FRL}
σ_SU      = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1
K         = 100,000 / 10^Σα   (Shallow Tech は TRL 抜きで再校正)
base α    = FRL=1.5 / σ_SU=1.3 / HRL=1.1 / TRL=1.0 / BRL=0.6 / GRL=0.3 / SRL=0.2 (Σ=6.0)
```

期待値 vs 計算 (理論 §8 表):
- sx 2027: 4,791 vs 4,785 = -0.1% (ほぼ完全)
- bwe 2025: 3,193 vs 2,615 = -18% (seed の μ 値が §8 想定より低い)
- ctb: 1,658 vs 1,855 = +12%
- フェーズ判定は全て理論通り

→ **数式は正しい**。seed の μ_A/μ_I/μ_G は粗い見積りなので、まさが UI スライダーで PJ ごとに調整する運用方針。

詳細: `design_log/sessions_2026-05.md` の 2026-05-07 セクション。

### 2) config リンクの正体特定 (前 commit `5b3c1a9`、まさ + 私で共同調査)

PWA の git 履歴では「config リンク」は私が e6038d8 で追加したのが初出だが、**GAS版 cockpit に元ページが存在する**ことを確認:

- [`gas/500_CockpitPage.html:139`](../gas/500_CockpitPage.html:139): cockpit ヘッダー右に `Chronicle →` (沿革) と `Config →` の 2 リンク
- `?page=config&projectId=X` → [`gas/226_ProjectConfig.html`](../gas/226_ProjectConfig.html) (約 700 行) に飛ぶ
- 中身 = **PJ ごとに一括管理する専用画面**:
  - 基本情報 (project_name / client_name / status / start_ym / end_ym 等)
  - メンバー (project_members の一覧編集)
  - 契約条件
  - 請求書送付先
  - Deductions (控除情報)

つまり、まさが「コックピットから config に飛ぶリンク」と呼んでいたのは **GAS の `226_ProjectConfig.html` 相当の PJ 個別設定ページ**。PWA にはまだ存在しない。

#### 暫定実装 (前 commit `5b3c1a9` で main に入った)

- `CockpitHeader` に `⚙️ config` リンクを残してある
- href: `/admin/projects#${projectId}` (PJ 台帳の当該行に hash anchor)
- `AdminProjectsTable` の `<tr>` に `id={p.project_id}` + `target:bg-amber-50` でハイライト
- title 属性に「暫定: PJ 台帳の当該行 — 本来の飛び先要確認」と明記
- コードコメントに「次セッションで直す」旨

→ **次セッションの最大タスク: PWA に `/project/[projectId]/config` ページを新規作成**して、GAS `226_ProjectConfig.html` を移植する。CockpitHeader の Link 先を `/admin/projects#...` から新ページに直す。

---

## リポ状態

- 作業 worktree: `/Users/masa/projects/AMD/amd-os/.claude/worktrees/blissful-kepler-9e95b0`
- 作業 branch: `claude/blissful-kepler-9e95b0` (main にも merge + push 済)
- main HEAD: `ad0e1e0` 起点 + AMD Score commit + まさの config 暫定 commit (`5b3c1a9`、すでに main)
- 本番デプロイ: `https://amd-os-pwa.vercel.app` (deploy 後に AMD Score ページが見える)
- uncommitted (まさの作業 — **触らない**): main checkout 側に `?? design_log/` `?? tsukuyomi-sheet.png` 等あり

---

## 未解決タスク

### 設計層 (まさの判断待ち)

- **PWA `/project/[projectId]/config` ページ新規作成** (config リンクの飛び先) — GAS `226_ProjectConfig.html` を移植する。基本情報 / メンバー / 契約条件 / 請求書送付先 / Deductions の 5 セクション。完了後 `CockpitHeader` の href を `/admin/projects#${projectId}` から直す
- **AMD Score 期待値とのズレ**: bwe / yd など `~20%` 低く出る (seed の μ 値が §8 表より小さい)。まさが UI スライダーで PJ ごとに合わせる方針だが、希望なら seed 行を直接書き換えるオプションあり
- **Shallow Tech モードの重み再分配**: 理論 §11.3 で TRL=1.0 を BRL/HRL に再分配して K=1.0 にする案。現状は単純に TRL 軸を除外しているだけ。jc が 1,226 (期待 100-300) と高めに出ている件と関連
- Timeline 3D 拡張 (前々セッションの継続): スコア式を AMD Score にも反映するか、過去 22 PJ への拡張、AMD 参画期間の正確化、Bloom postprocessing
- Venture Map モデル: 数式モデルの未解決論点 5 点 (`design_log/2026-05_venture_map_model.md`)

### 実装層

- σ_SU を `/venture-map/state-space` の Triple Helix 状態空間モデル推定値に自動連携 (現状は amd_score_inputs に手動入力した μ_A/μ_I/μ_G)
- データ駆動 α 推定 (9 PJ 階層 Bayesian)
- VC valuation との比較ビュー (理論 §10) で AMD Score 高 + valuation 低 = 過小評価サイン
- AMD Score の cron 自動更新 (atlas signal が来たら関連 PJ の σ_SU を再評価)

中長期 TODO は `SPEC_pwa.md` の「10. 既知の TODO / 未着手」。

---

## 次セッションの最初の一手

1. リポ状態 4 ステップ (`git fetch --all --prune` → `git log --branches --not --remotes --oneline` → `git branch -a` → `git status -s`)
2. **`design_log/2026-05_amd_score.md`** と **`design_log/2026-05_pj_status_cockpit.md`** を読む (両方とも冒頭に「既存 UI を勝手に消すな」ルール)
3. `SPEC_pwa.md` で全体像、`BUGS.md` で 2026-05-06 の config 事故 + 過去事故を確認
4. まさに優先順位確認 → 候補:
   a. **GAS `gas/226_ProjectConfig.html` を PWA 移植して `/project/[projectId]/config` 新規作成** (CockpitHeader リンク先を直す)
   b. **AMD Score の本番触ってもらってフィードバック** (μ・α 調整、閾値、Shallow Tech 再分配など)
   c. その他 (Timeline 3D 拡張、Venture Map モデル深化、etc)
5. **PWA は常に本番で確認** (`pwa/AGENTS.md`)。tsc 通ったら commit → push → main merge → `npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os` まで一気に通す
