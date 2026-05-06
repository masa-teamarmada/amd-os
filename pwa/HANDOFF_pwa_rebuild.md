# HANDOFF — AMD OS PWA

次セッションが文脈を聞き直さずに再開できる **直近の引き継ぎだけ** をここに書く。

- 仕様 → `SPEC_pwa.md`
- バグ・教訓 (症状/原因/解決策/教訓) → `BUGS.md`
- 過去セッションの作業ログ → `design_log/sessions_YYYY-MM.md`
- 共通運用ルール → リポ root の `CLAUDE.md`、PWA 確認方針 → `pwa/AGENTS.md`

このファイルが 200 行を超えそうになったら、過去セッションを `design_log/sessions_YYYY-MM.md` へ切り出してスリム化する。

---

## 最終更新

2026-05-06 — Timeline 3D 実装 + ドキュメント整理 + Vercel deploy コマンド修正

---

## 直近セッション要約

3 本立て。すべて本番反映済 (`https://amd-os-pwa.vercel.app`)。

### 1. PWA ドキュメント大整理

948 行の `HANDOFF_pwa_rebuild.md` を 4 ファイル責務分離に再編。

- 新規 `SPEC_pwa.md` (PWA 正本仕様: 画面・データモデル・cron・運用コマンド・実装規約)
- 新規 `design_log/sessions_2026-04.md` `sessions_2026-05.md` (過去セッションログ)
- HANDOFF を 68 行にスリム化 (直近 + 次の一手のみ)
- `BUGS.md` に HANDOFF 内に埋もれていた教訓 5 件を症状/原因/解決策/教訓 形式で追記
- `pwa/AGENTS.md` `pwa/CLAUDE.md` の冒頭に SPEC への入口を追加
- handoff skill (`~/.agents/skills/handoff/SKILL.md`) を 4 ファイル責務分離前提に書き換え
- `pwa/AGENTS.md` に「**PWA は常に本番で確認**」方針を明記

詳細: `design_log/sessions_2026-05.md` の 2026-05-06 セクション

### 2. Venture Map Timeline 3D 新ページ

`/venture-map/timeline-3d` 新設。現行 9 SU を 3D で可視化:

- 各 SU = `THREE.CatmullRomCurve3` + `tubeGeometry` で光るパイプ (lane 別色)
- AMD 参画期間 (founded_at 〜 active=今日 / 終了=最終 xrl) は太く emissive 強め (radius 0.13 / intensity 1.8)、期間外は細く暗く
- スコア = `(TRL+BRL+HRL+GRL+SRL)/25`、`computeScore()` 1 関数に閉じてる (差し替えやすい)
- 5RL 内訳棒を X 軸右端に積層配置 (Y-Z 視点で正面に並ぶ)
- milestone marker を琥珀色球で配置、X-Y (沿革) 視点で HTML ラベル展開
- 4 プリセットボタン (時間×スコア / 3D / SU×スコア / 時間×SU 沿革) + smooth lerp + OrbitControls 自由回転

新規ファイル: `src/components/venture-map/Timeline3DView.tsx`、`src/app/(app)/venture-map/timeline-3d/page.tsx`
変更: `src/lib/venture-map-data.ts` に `fetchAllVenturesWithXrl({ activeOnly })` 追加、`/venture-map` ページに導線リンク

完成度上がったら dashboard トップに移植予定。

### 3. Vercel デプロイコマンドの正本変更 (事故あり)

`--cwd .../pwa` でデプロイすると `pwa/pwa does not exist` で失敗、リトライで誤って **新プロジェクト `amd-os` (`amd-os.vercel.app`)** が作られた。原因は 2026-05-05 で Vercel project 設定の Root Directory に `pwa` を入れた影響。

新正本コマンド: `npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os` (リポ root を渡す)。
誤プロジェクトは `npx vercel projects rm amd-os` で削除済。CLAUDE.md / SPEC / BUGS 全部更新済。

詳細は `BUGS.md` の 2026-05-06 エントリ。

---

## リポ状態

- main HEAD: `b489494` (feat(venture-map): add Timeline 3D view) ← この commit の時点
- 未 push commit: なし (main 反映 + push 済)
- 本番デプロイ: `dpl_86rPErgtMCMMkGk3X45GY8DuPya2` (`https://amd-os-pwa.vercel.app`)
- uncommitted (まさの作業 — **触らない**): `?? design_log/` (worktree のは commit 済、main checkout 側に他のがある可能性)、`?? tsukuyomi-sheet.png`

---

## 未解決タスク

Timeline 3D 拡張候補 (まさからの指示待ち):
- スコア式の正式定義 (現状 `(TRL+BRL+HRL+GRL+SRL)/25` 暫定)
- 過去 13 PJ (現行 9 + 過去 = 22 PJ) の追加可視化
- AMD 参画期間の正確化: `ventures` に `project_id` カラムを追加 → `projects.start_ym/end_ym` と join (現状 fallback)
- ダッシュボード (トップ) への移植
- イベント (milestone) の中身を充実させる
- Bloom postprocessing 追加 (`@react-three/postprocessing`)

中長期 TODO は `SPEC_pwa.md` の「10. 既知の TODO / 未着手」。

---

## 次セッションの最初の一手

1. リポ状態 4 ステップ (`git fetch --all --prune` → `git log --branches --not --remotes --oneline` → `git branch -a` → `git status -s`)
2. `SPEC_pwa.md` で全体像、`BUGS.md` で関連バグを確認
3. まさからの新指示を待つ
4. **PWA は常に本番で確認** (`pwa/AGENTS.md` 参照)。tsc 通ったら commit → push → main merge → `npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os` まで一気に通す。確認質問の連発で時間を溶かさない
