# SESSION MIGRATION PROMPT - AMD OS monthly_fixed contract cap reconciliation

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に `pwa/spec/5-6-contracts-management-current-spec.md`、`pwa/manual/6-7-contracts-management-spec.md`、`pwa/manual/7-1-reward-calc-spec.md`、`pwa/BUGS.md`、`pwa/design_log/sessions_2026-07.md` を読んで。そのあと `AGENTS.md`、`CLAUDE.md`、`pwa/CLAUDE.md` を読む。

最重要:
- `/Users/masa/projects/AMD/amd-os` のローカル checkout は、前回 closeout 時点で stale/dirty だった。current truth としてそのまま信じない。
- 作業前に `git fetch origin main --prune`、`git status -sb --untracked-files=all`、`git rev-list --left-right --count origin/main...HEAD`、`curl -s https://amd-os-pwa.vercel.app/api/build-info` を確認する。
- 今回の finance 修正は `b6be05295f91d73d8afef5d821880e1e893a3e4f` (`fix(finance): reconcile fixed contract budgets`) で本番投入済み。初回確認は `v0.39.1 / b6be0529`。その後 main は BZM/他作業で `v0.39.5 / bd209e00` まで進んでおり、この修正は main 履歴に含まれる。

今回の current truth:
- KUTE p25 の「月によってPJ予算の計上が違う」原因は手入力ではない。
- 2026-05-08 の一括生成で gross client monthly amount が `billing_cycles.budget_yen` に入り、2026-06-18 の旧 Contract Apply が `monthly_fixed` 月別行を触らず、2026-07-01 の自動確定だけが当月を65% capへ直した。つまり自動経路が混ざった事故。
- `monthly_fixed` Contract Apply は、バッファなし契約では未確定 `billing_cycles.budget_yen` と現行 `value_plan_cycles.budget_yen` を契約cap (= 月額税抜×65%) へ整合する。
- 確定済み/進行済み月の budget が契約capと不一致なら、隠して進まず apply を止める。
- SX のように explicit buffer / season reserve がある PJ は単純な `月額×65%` 上書き禁止。`buffer_breakdown_json` と契約バッファ設計を先に読む。
- AMD運営側が認識しないところで運営費・会社留保を勝手に削って「ゼロ着地」に見せる設計は禁止。

最初の一手:
1. `HANDOFF.md` の Summary / Repo State / Open Risks を読む。
2. `origin/main` と production `/api/build-info` の sha を合わせる。
3. finance を触るなら、client payment / buffer / PJ budget / member payment / company reserve / ending unpaid balance を同じ画面・同じ説明で分ける。
4. monthly_fixed の Contract Apply を変更する場合は、KUTE型の bufferless path と SX型の buffer path を混ぜない。

守ること:
- 「会社留保を削ればゼロ着地できる」と説明しない。
- `/admin/payouts` や season PL で不足があるのに、平気な表示・緑表示にしない。
- MS編集/Contract Apply の終端では、シーズン末 unpaid が不可視に残らないことを検算する。
- `git add .` は使わない。対象 bundle だけ個別 stage。
- PWA deploy が必要なら `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` のルールを確認して使う。
```
