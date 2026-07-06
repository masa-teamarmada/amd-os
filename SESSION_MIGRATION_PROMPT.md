# SESSION MIGRATION PROMPT - AMD OS MS/payment actuals

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に仕様正本として `pwa/spec/3-14-monthly-work-agreement-current-spec.md`、`pwa/manual/6-8-admin-ms-overview-spec.md`、`pwa/manual/7-1-reward-calc-spec.md` を読んで。そのあと `pwa/BUGS.md`、`pwa/design/FEATURE_REGISTRY.md`、`CLAUDE.md`、`AGENTS.md`、`pwa/CLAUDE.md` を読んで。

最重要:
- `/Users/masa/projects/AMD/amd-os` のローカル checkout は、2026-07-06 closeout 時点で `origin/main` から ahead/behind し、大量の unrelated dirty state があった。current truth としてそのまま信じない。
- 作業前に `git fetch origin main --prune`、`git status -sb --untracked-files=all`、`git rev-list --left-right --count origin/main...HEAD`、`curl -s https://amd-os-pwa.vercel.app/api/build-info` を確認する。
- 支払実績照合修正自体は `v0.38.3 / 7a7b0ddc70439cc977c80fc6593f467eba0e89d9` で入っており、その後の main に含まれている。最新本番 sha は必ず `/api/build-info` で確認する。
- 直前の `origin/main` には monthly_fixed contract cap closeout (`34973b68`) も入っている。KUTE/SX/契約capを触るなら `pwa/spec/5-6-contracts-management-current-spec.md`、`pwa/manual/6-7-contracts-management-spec.md`、`pwa/design_log/sessions_2026-07.md` の該当節も読む。

今回の current truth:
- `monthly_reward_payout.total_pay` は税抜の保存済み明細で、実際の振込額そのものではない。
- `支払実績` として扱えるのは、`round(monthly_reward_payout.total_pay * 1.1)` が freee `wallet_txns.amount` と一致し、かつ `billing_cycles.reward_paid_by` が `freee_wallet_txn_verified:<wallet_txn_ids>` を持つ月だけ。
- `reward_paid_at` だけある月、または銀行出金は見えるがPJ別明細と一致しない月は `要照合` / `実績未照合`。実績にも未来予定にも混ぜない。
- `/monthly-agreement` は `支払済み実績(税込)` / `実績未照合(税込)` / `これから支払予定(税込)` を分離し、明細は税抜/税込を併記する。
- `/admin/ms-overview` の保存前支払検算は、照合済み実績だけを固定支払にし、未照合月がある場合は保存 `blocked`。
- ZMP p19 / ID026 は 202604 と 202605 だけ照合済み実績。202601〜202603 は `要照合`、202606 は証跡未確認で `保存済み`。

最初の一手:
1. `HANDOFF.md` の Repo State / Open Risks を読む。
2. `origin/main` と production `/api/build-info` の sha を合わせる。
3. MS編集や月初合意を触るなら、`pwa/spec/3-14-monthly-work-agreement-current-spec.md` と `pwa/manual/6-8-admin-ms-overview-spec.md` の「freee照合済み実績 / 実績未照合」の境界を先に確認する。
4. ZMP p19 202601〜202603 の `要照合` を解くなら、freee `wallet_txns` と保存済み `monthly_reward_payout` の税込一致を証拠として確認する。計算キャッシュの再補完だけで actual にしない。

守ること:
- 支払済み印 (`reward_paid_at`) だけで支払実績にしない。
- 計算キャッシュや再計算値を実振込額として扱わない。
- 既に発行・送付・支払済みの通知書額を勝手に変えない。
- `git add .` は使わない。対象 bundle だけ個別 stage。
- PWA deploy が必要なら `.vercel/project.json` が `amd-os-pwa / prj_raZW3HSKIszzPUwNTHfy7xDGzLHm` であることを確認し、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。
```
