# SESSION MIGRATION PROMPT - AMD OS ZMP Reward Liability Offset Closeout

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に仕様正本として `pwa/manual/7-1-reward-calc-spec.md`、`pwa/manual/6-5-admin-payouts-reward-notice-spec.md`、`pwa/design/season_budget_actual.md` を読んで。そのあと `pwa/BUGS.md`、`pwa/design/db_schema.md`、`CLAUDE.md`、`AGENTS.md`、`pwa/CLAUDE.md` を読んで。

最重要:
- `/Users/masa/projects/AMD/amd-os` のローカル checkout は、前回 handoff 時点で `origin/main` から 58 behind / 7 ahead、かつ大量の未整理変更があった。current truth としてそのまま信じない。
- 作業前に `git fetch origin main --prune`、`git status -sb --untracked-files=all`、`git rev-list --left-right --count origin/main...HEAD`、`curl -s https://amd-os-pwa.vercel.app/api/build-info` を確認する。
- 報酬 offset 実装は `v0.37.3` / commit `45cb4e551d4a1aa24dbb8e3d9dd428ac1f5fc580` で入った。その後 main は月初合意/MS安全系で進んでいるので、最新 sha は `origin/main` と build-info で確認する。

今回の current truth:
- ZMP 2026 の送付済み/支払済み過払いは、会社留保・他メンバー未払・PJ全体バッファでは吸収しない。
- 支払済み/送付済みの過去額は変更しない。
- 過払い調整は `reward_member_liability_offsets` に記録し、同一PJ・同一シーズン・同一メンバー本人の未払 stock からだけ相殺する。
- active offset は ID008 うめ 1,560円、ID009 あび 1,658円だけ。ID004 こう / ID026 しんの小額過払いはまさ判断で許容。
- migration 162 の監査メタに `ID010` typo があり、`ID010=らん` だった。migration 163 で本番DBの active 2行は `tolerated_members=["ID004","ID026"]` に修正済み。計算額は変えていない。
- production DB には p19 の `status='pending'` / `amount_yen=null` の liability offset 行が別作業由来で存在する。現行 reward code は `status='active'` だけ読むので計算には入らない。所有者不明なので勝手に削除しない。
- 月初合意入口モーダル closeout は `pwa/design_log/sessions_2026-07.md` と `pwa/BUGS.md` に残っている。そちらを触るなら `pwa/spec/3-14-monthly-work-agreement-current-spec.md` も読む。

最初の一手:
1. `HANDOFF.md` の Repo State と Important Warnings を読む。
2. `origin/main` と production `/api/build-info` の sha を合わせる。
3. finance/reward を触るなら、本番DBで `reward_member_liability_offsets` を `status` ごとに確認し、active と pending を混ぜない。
4. `/admin/payouts` や `/admin/season-pl` の数字を見る時は、先に報酬キャッシュが最新か確認する。必要なら `payout-reward-cache-refresh?ym=202601&lookahead=11` を current production build で実行してから見る。

守ること:
- 「会社留保を減らせば吸収できる」と説明しない。これは前回の誤判断。
- 他メンバーの未払残から差し引かない。
- 既に発行・送付・支払済みの通知書額を勝手に変えない。
- `git add .` は使わない。対象 bundle だけ個別 stage。
- PWA deploy が必要なら `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。
```
