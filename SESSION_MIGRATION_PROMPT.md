# SESSION MIGRATION PROMPT - AMD OS contracts handoff

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に仕様正本として `pwa/spec/5-6-contracts-management-current-spec.md` を読み、そのあと `pwa/manual/6-7-contracts-management-spec.md`、`pwa/BUGS.md`、`CLAUDE.md`、`AGENTS.md`、`pwa/CLAUDE.md` を読んで。

今回の current truth:
- local branch: `main`
- local HEAD / origin/main functional base: `8f252f2451188c03518bd67afa859f14b90e575c`
- latest functional commit: `fix(pwa): normalize member names in proactive todos`
- production deployment for `8f252f2451188c03518bd67afa859f14b90e575c`: `dpl_Cx1saiVY2Kn5Qcy91rB4hvJt7f85`
- production `/api/build-info` checked 2026-06-28 JST: `v0.36.20` / `8f252f2451188c03518bd67afa859f14b90e575c` / `dirty=false`
- working tree: dirty mixed WIP
- 契約管理の正本方針: `/admin/contracts` は契約台帳。1行は Drive file / folder / MTG / 議事録ではなく、1契約または契約ファミリー。

契約管理の重要仕様:
- 初期表示は `ledger` filter。
- 表示対象は `registry_status IN ('accepted','candidate')` かつ `status!='cancelled'`。
- `evidence_only` / `rejected` は初期台帳に出さない。
- Drive folder、MTG、議事録、テンプレート、契約語を含むだけの周辺資料は `contract_documents` / `contract_signals` / `contract_terms` の証跡であり、`contracts` 行ではない。
- 台帳列は契約名、種別、相手先、PJ、状態、締結/発効、終了/更新、文書。
- `metadata不足` filter で、相手先・締結/発効日・終了/更新日などを補うべき行を確認する。

作業開始前に必ず:
1. `git fetch origin main --prune`
2. `git status -sb --untracked-files=all`
3. `git log --left-right --oneline main...origin/main`
4. `curl -fsSL https://amd-os-pwa.vercel.app/api/build-info`
5. `git diff --name-status`

最初の一手:
1. ログイン済みブラウザで `/admin/contracts` を開き、MTG/議事録/folder が初期台帳に出ないことを確認する。
2. 契約docsを閉じるなら、`HANDOFF.md`、`SESSION_MIGRATION_PROMPT.md`、`pwa/spec/5-6-contracts-management-current-spec.md`、`pwa/manual/6-7-contracts-management-spec.md`、`pwa/design_log/sessions_2026-06.md`、`pwa/BUGS.md` だけを確認する。
3. `pwa/BUGS.md` は既存 notification 差分との mixed dirty。既存差分の owner を確認してから stage する。
4. `git add .` は絶対に使わない。選んだ bundle のファイルだけ個別 stage。

残っている別bundle dirty:
- notification stop / meeting flow / task notification WIP
- Atlas UI WIP
- Admin/Kiyo WIP
- meeting-assets / project-label WIP
- contract / monthly agreement docs WIP
- H-1 prep outbox markdowns
- `gas-slack/.clasp.json` local artifact

守ること:
- AMD OS は main 一本。BUILD_VERSIONを巻き戻さない。
- PWA deploy が必要なら `.vercel/project.json` が `amd-os-pwa / prj_raZW3HSKIszzPUwNTHfy7xDGzLHm` であることを確認し、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。
- Drive folder / MTG / 議事録を契約行として再昇格させない。
```
