# SESSION MIGRATION PROMPT - AMD OS admin payouts closeout

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に `pwa/spec/3-14-monthly-work-agreement-current-spec.md`、`pwa/manual/6-5-admin-payouts-reward-notice-spec.md`、`pwa/design/FEATURE_REGISTRY.md` を読んで。その次に `pwa/BUGS.md` を読んで。必要なら `pwa/design_log/sessions_2026-06.md` の 2026-06-23〜2026-06-24 月初合意支払 gate セクションも読む。

作業開始前に必ず:
1. `git fetch origin main`
2. `git status -sb --untracked-files=all`
3. `git log --left-right --oneline main...origin/main`
4. `curl -fsS https://amd-os-pwa.vercel.app/api/build-info`

current truth:
- 月初合意支払 gate は server-side guard。保存・PDF発行・送付・送付済み確定など write action は gate blocker があると止める。
- 2026/05以前の稼働月 (`source_ym <= 202605`) は、月初合意機能の導入前/移行月として支払可能。DBに偽の `member_monthly_work_agreements` row は作らない。
- 移行月バイパス row は `status='agreed'` かつ `migrationBypass=true`。blocker が無く移行月バイパス行だけの場合、admin UI は個別メンバー表を出さず、`対象支払行` / `移行月スキップ` / `blocker 0` の summary を表示する。
- `/admin/payouts` の初期表示は SSR data を先に返し、月初合意 gate は `gateOnly=1` で後追い取得できる。write action は従来どおり server-side gate 必須。
- Production check 済み: `v0.34.19` / `35b618ff` で `/admin/payouts?ym=202606` が `対象支払行 4 / 移行月スキップ 4 / blocker 0`、個別メンバー表なし。

repo state at handoff:
- local / origin main: `3677cd33 fix(governance): hide unreviewed meeting action candidates`
- production at inventory: `v0.34.19` / `35b618ff` / `dirty=false`
- origin/main has later `1532f914` (`v0.34.21`) and `3677cd33` (`v0.34.22`) not yet observed in production at inventory.
- tracked dirty at handoff is only this handoff docs bundle until committed:
  - `HANDOFF.md`
  - `SESSION_MIGRATION_PROMPT.md`
  - `pwa/HANDOFF_pwa_rebuild.md`
- untracked: `gas-slack/.clasp.json`; do not commit until GAS/Slack owner decides.

次にやること:
1. handoff docs commit 後に、production がまだ `3677cd33` 以降へ追いついているか確認し、必要なら通常 deploy。
2. deploy 後、governance/cockpit confirmed surfaces が `review_status='confirmed'` + `status in ('open','in_progress')` の action items だけを表示し、`source='meeting_summary'` candidates を出していないことを確認する。
3. 月初合意支払 gate は `v0.34.19` / `35b618ff` で本番確認済みだが、deploy 後にも `/admin/payouts?ym=202606` の migration summary が崩れていないか smoke する。
4. `gas-slack/.clasp.json` は中身を晒さず、track / local exclude / safe remove の owner decision を取る。

注意:
- `git add .` は使わない。
- migration-month monthly agreement gate を個別4行の `合意済` 表示に戻さない。
- migration month 用の偽 agreement row を作らない。
- PWA deploy が必要なら handoff docs commit 後の clean tracked state で `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。
```
