# HANDOFF — AMD OS PWA

次セッションが文脈を聞き直さずに再開できる **直近の引き継ぎだけ** をここに書く。

- 仕様 → `SPEC_pwa.md`
- バグ・教訓 (症状/原因/解決策/教訓) → `BUGS.md`
- 過去セッションの作業ログ → `design_log/sessions_YYYY-MM.md`
- 共通運用ルール → リポ root の `CLAUDE.md`

このファイルが 200 行を超えそうになったら、過去セッションを `design_log/sessions_YYYY-MM.md` へ切り出してスリム化する。

---

## 最終更新

2026-05-04 (夜) — つくよみマスコット本番投入完了

---

## 直近セッション要約

`(app)` レイアウト全画面の右下に、つくよみのチビキャラを 4 アニメ (idle / happy / thinking / wave) で常駐させた。本番反映済・まさ目視 OK。

- 採用素材: `/Users/masa/projects/masa/output/tsukuyomi_animations_amd/` (Codex 生成のクリーン素材、4 アニメ × 18 frames × 128×128px)
- 統合スプライトシート: `pwa/public/tsukuyomi/sheet-v4.png` (2304×512)
- 新規コンポーネント: `pwa/src/components/tsukuyomi/Sprite.tsx` + `Mascot.tsx`
- 統合点: `pwa/src/app/(app)/layout.tsx` の `<main>` 後に `<TsukuyomiMascot />` をマウント
- mood swap: 30-90s 間隔で happy/thinking/wave に 1.8s 切替、タップで wave 反応
- FPS: `{ idle: 5, happy: 7, thinking: 5, wave: 7 }`
- flipX: CSS `scaleX(-1)` で左右反転 (画像差し替え不要)

詳細は [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) の「2026-05-04 (夜) — つくよみマスコット本番投入」を参照。

---

## リポ状態

- main HEAD: `196e715` (HANDOFF + BUGS: redo Tsukuyomi mascot session per /handoff rules)
- 未 push commit: なし
- uncommitted: `?? design_log/` `?? tsukuyomi-sheet.png` (まさの作業 — **触らない**)

---

## 未解決タスク

なし。

将来やるかも (まさからの依頼があれば):
- つくよみの状態 (loading/empty/error) に応じてアニメ切替 (Mascot に Context API)
- mood pickup の重み付け / 時間帯依存
- クリックで `/admin/tsukuyomi` 知識ベースとの連携導線

中長期 TODO は `SPEC_pwa.md` の「10. 既知の TODO / 未着手」を見る。

---

## 次セッションの最初の一手

1. リポ状態 4 ステップ (`git fetch --all --prune` → `git log --branches --not --remotes --oneline` → `git branch -a` → `git status -s`)
2. `SPEC_pwa.md` で全体像を確認、必要に応じて `BUGS.md` で関連バグを確認
3. まさからの新指示を待つ
4. もしまさが「つくよみアニメ追加・差し替え」を依頼してきたら:
   1. 新素材を `tsukuyomi_animations_amd/` の構造に合わせてもらう
   2. `/tmp/combine_v2_frames.py` を frames 数に合わせて編集 → 統合シート生成
   3. `Sprite.tsx` の `SHEET_W` / `ANIMATIONS` を更新
   4. `Mascot.tsx` の `FPS` / `pickMood()` の候補を更新
   5. `npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os/pwa`
5. PWA 他箇所の修正なら、`SPEC_pwa.md` の該当ルートと `BUGS.md` を読んでから着手
