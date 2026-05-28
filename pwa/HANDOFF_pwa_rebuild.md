# HANDOFF — AMD OS PWA

- Last updated: 2026-05-28 (claude session)
- Topic: `/admin/payouts` 送付ボタン実メール送信化 + PDF ラベル変更 + 強制再発行ボタン + TsukuyomiMascot 削除
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Build version: `v0.7.3` (本番反映済)
- GAS deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` @1479 (本番反映済)
- HEAD at handoff: `01f7305` (= `feat(pwa): add GreenPulse PJ (p26) + fix AmdScore detail page HUD→normal UI`)
- Unpushed commits: **なし** (`git log --branches --not --remotes --oneline` 空)。本セッションの自分作業は **uncommitted** のまま本番だけ進んでいる状態。

## Latest Summary (3-10 lines)

`/admin/payouts` の「送付」ボタンを「`sent_at` フラグを立てるだけ」から **`keiri@team-armada.jp` から実メール送信 + 確認モーダル + PDF添付 + Bcc: masa@/kyoko@** に差し替え。並行で支払通知書 PDF の右上ラベルを「支払通知日」→「作成日」に変更、差分検出で再生成スキップされる問題に対処する「強制再発行 (全員)」黄色ボタンを `/admin/payouts` に追加、`TsukuyomiMascot` を `layout.tsx` から削除 (右下発行ボタンに被るメンバーがいたため)。GAS clasp 再ログインを含む 4 つの GAS deploy + Vercel deploy を実行。本番動作確認はまさが完了 (`できてた！`)。

詳細: [`pwa/design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾「2026-05-28 (claude)」セクション。

## Verification / Deploy

Run and observed:

- `npx tsc --noEmit` → pass
- `npm run build` → pass
- `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` → v0.7.3 Ready (= 本番URL alias 切り替え済)
- まさが `/admin/payouts` の送付モーダルから実メール送信を実行し「できてた！」確認
- GAS `clasp push --force` + `clasp deploy --deploymentId AKfycbwzA...` を 4 回 (@1476 → @1477 → @1478 → @1479)
- `payoutAdmin_listMailAliases_` を runFunc で叩いて `keiri@team-armada.jp` が Gmail send-as に存在することを実機確認済

## Repo State

- Branch: `main`、未 push commit なし
- 本セッションで触ったが **未 commit** (= 本番だけ進んでいるので handoff 後に commit 必須):
  - GAS: `gas/064_PayoutFreeeNotice.js` / `gas/065_PayoutMailer.js`
  - GAS untracked: `gas/074f_MeetingWorkflow.js` (= 別えいみ作業中ファイルの typo fix も入った、clasp push のブロッカー解消のため)
  - PWA: `pwa/src/app/(app)/layout.tsx` (Mascot 削除完成形はまさ手当て) / `pwa/src/app/api/admin/payouts/route.ts` / `pwa/src/components/admin/AdminPayoutsClient.tsx` / `pwa/src/lib/build-info.ts`
  - Design / Manual: `pwa/design/SPEC_pwa.md` (MM) / `pwa/design/FEATURE_REGISTRY.md` (**UU = unmerged conflict ⚠️**) / `pwa/manual/6-5-admin-payouts-reward-notice-spec.md` (= 新 manual 配下、`pwa/manual/` フォルダ全体が untracked) / `pwa/BUGS.md` / `pwa/design_log/sessions_2026-05.md`
- **worktree 全体は別えいみセッションの作業途中で大量に dirty** (140+ ファイル、`pwa/manual/00-*.md` 〜 `39-*.md` の旧構造 deleted + 新 `pwa/manual/1-1-...md` 〜 `8-3-...md` untracked、大規模 reorganization が進行中)。**勝手に commit に巻き込まない**。
- 自分作業のみを stage する手順例:
  ```sh
  git add gas/064_PayoutFreeeNotice.js gas/065_PayoutMailer.js gas/074f_MeetingWorkflow.js \
          pwa/src/app/\(app\)/layout.tsx \
          pwa/src/app/api/admin/payouts/route.ts \
          pwa/src/components/admin/AdminPayoutsClient.tsx \
          pwa/src/lib/build-info.ts \
          pwa/manual/6-5-admin-payouts-reward-notice-spec.md \
          pwa/BUGS.md pwa/design_log/sessions_2026-05.md pwa/HANDOFF_pwa_rebuild.md
  # SPEC_pwa.md / FEATURE_REGISTRY.md は MM / UU なので個別判断 (= conflict resolution が必要)
  ```

## Open Tasks

- `pwa/design/FEATURE_REGISTRY.md` の `UU` conflict を解決。本セッションでは「作成日」記述を入れたつもりだが、現状ファイル中身を再確認して必要なら手で merge。
- `pwa/design/SPEC_pwa.md` も `MM` (staged が他人 + worktree が自分)。staged 側を `git diff --cached` で確認し、worktree 側を `git add` でまとめて commit するか、分割するか判断。
- 別えいみセッションの大量 dirty (新 manual 移行 / `meeting-workflow` API / migration 093/098/099 等) は本セッション handoff の対象外。担当セッションに引き継ぐ。

## First Read Next Session

1. **`pwa/HANDOFF_pwa_rebuild.md`** (= この文書、最新状態)
2. **`pwa/design_log/sessions_2026-05.md`** 末尾「2026-05-28 (claude)」(= 今セッション詳細)
3. **`pwa/BUGS.md`** 末尾 4 件 (clasp 罠 / 差分検出スキップ / Mascot 干渉 / version bump 過大)
4. `pwa/manual/6-5-admin-payouts-reward-notice-spec.md` (= 送付メール仕様 + 強制再発行ボタン仕様)
5. `pwa/design/SPEC_pwa.md` `/admin/payouts` 行
6. `pwa/design/FEATURE_REGISTRY.md` (= 要 conflict 確認)
7. `pwa/CLAUDE.md` (= デプロイ / DDL / bump up ルール)

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git status -s
git log --branches --not --remotes --oneline
```

未 push 自分作業を stage して commit + push する。SPEC_pwa.md / FEATURE_REGISTRY.md の MM/UU は中身を確認してから判断。GAS は既に `clasp deploy @1479` で本番反映済なので、`git push` 後の動作確認は不要。
