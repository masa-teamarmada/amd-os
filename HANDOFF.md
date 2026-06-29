# AMD OS Handoff

最終更新: 2026-06-29 JST
対象: `/Users/masa/projects/AMD/amd-os`
トピック: `/admin/payouts` 支払通知書の登録番号・再発行・送付確認UX修正

## 最新セッション要約

詳細ログは `pwa/design_log/sessions_2026-06.md` の「2026-06-29 — Admin Payouts 支払通知書 PDF / 送付確認 UX 修正」を見る。

- 支払通知書PDF上の宛先側・発行者側ラベルを `インボイス登録番号` から `登録番号` に変更済み。
- `/admin/members` の保存を API 経由へ寄せ、登録番号は保存時・PDF生成時に全角T / T風文字 / 空白 / ハイフンを正規化する。
- 未送付PDFの `last_generated_at` より `members.updated_at` が新しい場合は、金額差分がなくても再生成対象にした。
- 行の `PDF確認` は保存済み正式PDFを開くだけにし、生成はしない。
- 行の `送付` もPDF生成・再生成・支払データ同期をしない。保存済み正式PDFが最新DBと一致し、確認用PDFではなく、未送付の場合だけ確認モーダルを開く。
- `preview_notice_email` に残っていた `force: true` PDF再生成を撤去。`send_notice_email` は送信前に同じ照合と月初合意gateを通す。
- メール本文テンプレはまさ指定文へ更新済み。

## Repo / Production State

- branch: `main`
- accepted product commit: `3d90054e Stop payout send from regenerating PDFs`
- closeout docs are committed on top of `origin/main`; run `git log -1 --oneline` for the exact current HEAD.
- `origin/main`: aligned after closeout push
- production `/api/build-info`: `v0.36.32` / latest closeout git SHA after push / `dirty=false`
- Vercel deployment before closeout docs: `https://amd-os-pepgb3i1d-armada0130.vercel.app` / Ready / aliases include `https://amd-os-pwa.vercel.app`
- main alignment: `main aligned`

## Verification Run

- `npm exec tsc -- --noEmit` passed.
- `npm run test:critical-ui` passed.
- `git diff --check` passed for the payout bundle.
- `npm run build` passed.
- production `/api/build-info` confirmed `v0.36.32`.
- unauthenticated `PATCH /api/admin/payouts` returned `401 Unauthorized`, confirming the production route is live and protected.

## Dirty / Untracked Classification

Current task bundle is committed and pushed. Remaining dirty state is preexisting / other-worker WIP and must not be swept with `git add .`.

| group | class | owner guess | resolution action | risk |
|---|---|---|---|---|
| notification / L2 / meeting-flow docs and TS files | other-worker | notification / H-1 worker | send back to original worker or cleanup worker for bundle commit/revert decision | medium: accidental mixed commit can alter notification behavior |
| contract / monthly agreement docs + docx/proposal | other-worker | contract/legal worker | keep as WIP, commit only with contract bundle | medium: legal draft provenance can blur |
| Admin Kiyo / meeting-assets replace / project-labels / migration 153 | other-worker | admin/kiyo and meeting-assets worker | owner must finish tests/spec/manual or discard | high: untracked imports/routes can break production if partially committed |
| H-1 prep worker outbox markdowns | other-worker artifact | H-1 prep worker | decide gitignore vs artifact commit in that worker | low-medium: repo noise and privacy/provenance confusion |
| `gas-slack/.clasp.json` | deploy-link-local | GAS Slack worker | verify whether local-only; do not commit without owner | medium: local clasp link can point at wrong GAS project |
| `ios/supabase/.temp/project-ref` | deploy-link-local | local Supabase tooling | leave local or add ignore in dedicated cleanup | low |

## Unresolved Tasks

- None for the accepted payout notice fix.
- Remaining repo dirty state requires separate owner cleanup; do not archive the overall workspace as clean.

## First Next Action

1. Read this `HANDOFF.md`.
2. Then read `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`, `pwa/design/FEATURE_REGISTRY.md`, `pwa/design/SPEC_pwa.md`, and `pwa/BUGS.md`.
3. Run:

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch origin main --prune
git status -sb --untracked-files=all
curl -fsS 'https://amd-os-pwa.vercel.app/api/build-info'
```

4. If continuing payout work, test logged-in `/admin/payouts?ym=202606`: stale rows should require `支払通知書発行` / `強制再発行`, while `PDF確認` and `送付` should not generate PDFs.

## Archive 判定

handoff required.

理由: payout fix は main / production aligned だが、repo には別 worker の dirty / untracked WIP が残っている。今回 bundle は完了、workspace 全体は cleanup owner が必要。
