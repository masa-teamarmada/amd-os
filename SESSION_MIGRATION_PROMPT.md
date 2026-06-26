# SESSION MIGRATION PROMPT - AMD OS favicon / closeout

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に `pwa/design/SPEC_pwa.md`、`pwa/BUGS.md`、`pwa/design_log/sessions_2026-06.md` の 2026-06-26 favicon セクションを読んで。その次に `pwa/CLAUDE.md` / `pwa/AGENTS.md` を読んで。

作業開始前に必ず:
1. `git fetch origin main`
2. `git status -sb --untracked-files=all`
3. `git log --left-right --oneline main...origin/main`
4. `curl -fsS https://amd-os-pwa.vercel.app/api/build-info`

current truth:
- Chrome tab favicon は Vercel default から AMD mark へ差し替え済み。
- 変更 commit: `daa44ea3 fix(pwa): replace default favicon with AMD mark`
- closeout時点の production: `v0.34.29` / `25b69730409426e70804836f253b4785a742db07` / `dirty=false`
- HTML は `/favicon-amd.ico` を `shortcut icon` / `icon` として参照する。
- `/favicon-amd.ico` と `/favicon.ico` は同一 AMD mark payload。確認済み SHA-256 は `3d58f56c4c7e2c2a93460156d7652d6b2c953f43c6f36952552822c72f153071`。

repo state at handoff:
- local `main` / `origin/main` は `25b69730 fix(pwa): rebuild management score guards` で一致している想定。
- favicon作業のファイルは commit/push/deploy 済み。
- handoff closeout commit が追加されている場合は、その commit も main に push 済みか確認する。
- 既存 dirty は favicon作業外:
  - H-1 / L6 meeting flow docs and scheduled-task SKILL diffs
  - L6 meeting prep outbox markdown files
  - meeting-assets replacement helper/API untracked files
  - `gas-slack/.clasp.json`

次にやること:
1. favicon関連で追加作業があるなら、まず production HTML と `/favicon-amd.ico` hash を確認する。
2. 残dirtyはそれぞれの owner worker に返す。favicon closeoutへ混ぜない。
3. `gas-slack/.clasp.json` は中身を晒さず、GAS/Slack owner に track / local exclude / safe remove の判断を渡す。

注意:
- `git add .` は使わない。
- 既存dirtyファイルを勝手にrevert / checkout / cleanしない。
- PWA deploy が必要なら clean tracked state で `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。
```
