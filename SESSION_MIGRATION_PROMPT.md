# SESSION MIGRATION PROMPT - AMD OS Admin Payouts payout notice handoff

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に仕様正本として `pwa/manual/6-5-admin-payouts-reward-notice-spec.md` を読み、そのあと `pwa/design/FEATURE_REGISTRY.md`、`pwa/design/SPEC_pwa.md`、`pwa/BUGS.md`、`CLAUDE.md`、`AGENTS.md`、`pwa/CLAUDE.md` を読んで。

今回の current truth:
- `/admin/payouts` の支払通知書PDFは、宛先側・発行者側ともラベルを `登録番号` に統一済み。
- `/admin/members` の登録番号は admin API 経由で保存し、保存時・PDF生成時に全角T / T風文字 / 空白 / ハイフンを正規化する。
- `支払通知書発行` / `強制再発行` が生成入口。金額差分がなくても、再生成時は最新DBの `members` 情報を必ず読み直す。
- 未送付PDFは `members.updated_at > last_generated_at` なら stale。住所・登録番号など member 情報の変更だけでも再生成対象。
- `PDF確認` は保存済み正式PDFを開くだけ。確認用PDFや正式PDFを生成しない。
- `送付` / `preview_notice_email` / `send_notice_email` はPDF生成・支払データ同期をしない。保存済み正式PDFが最新DBと一致し、確認用PDFではなく、未送付であることを照合してからメール送信する。
- メール本文テンプレは、まさ指定の確認締切付き文面へ更新済み。
- 実装 product commit `3d90054e Stop payout send from regenerating PDFs` は main 履歴に入っている。closeout docs / prompt はその後の main commit に入っている。

作業開始前に必ず:
1. `git fetch origin main --prune`
2. `git status -sb --untracked-files=all`
3. `git log --left-right --oneline main...origin/main`
4. `curl -fsSL https://amd-os-pwa.vercel.app/api/build-info`
5. `git diff --name-status`

最初の一手:
1. production が `v0.36.32` / latest main git_sha / `dirty=false` になっているか確認する。
2. ログイン済みブラウザで `/admin/payouts?ym=202606` を開く。
3. stale rows は `支払通知書発行` / `強制再発行` を促し、`PDF確認` と `送付` がPDF生成を走らせないことを確認する。
4. 送付確認モーダルは保存済み正式PDFだけを使う。送付押下後に再生成しない。

残っている別bundle dirty:
- notification / L2 / meeting-flow docs and TS files
- contract / monthly agreement docs + docx/proposal
- Admin Kiyo / meeting-assets replace / project-labels / migration 153
- H-1 prep worker outbox markdowns
- `gas-slack/.clasp.json` local artifact
- `ios/supabase/.temp/project-ref` local Supabase artifact

守ること:
- AMD OS は main 一本。BUILD_VERSIONを巻き戻さない。
- PWA deploy が必要なら `.vercel/project.json` が `amd-os-pwa / prj_raZW3HSKIszzPUwNTHfy7xDGzLHm` であることを確認し、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。
- `git add .` は絶対に使わない。選んだ bundle のファイルだけ個別 stage。
- 支払通知書の生成入口を増やさない。`PDF確認` と `送付` は read/validate/send のみ。
```
