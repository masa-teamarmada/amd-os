# AMD OS Handoff

Last updated: 2026-07-17 JST

Target: `/Users/masa/projects/AMD/amd-os`
Topic: authenticated PWA 全体の初回表示を軽くする恒久修正・closeout

## Latest Session Summary

- `89956e6f` で、全 authenticated route を止めていた月初合意ゲートの重い SSR 集計を外し、既存の認証済み API を `AppShell` mount 後に読む形へ移した。判定・表示条件は不変。
- 同 commit で、閉じた月初合意体験・つくよみ drawer・dashboard の My/Company Content を dynamic import 化。Company Content は画面近傍まで fetch しない。
- `351255cf` で critical UI guard を新しい client fetch 方式へ合わせた。
- hidden tab の緊急通知 polling を停止し、復帰時即 refresh + foreground 60 秒 fallback にした。Supabase Realtime 購読は維持。
- 同一 authenticated production `/dashboard` の安定後比較で、初回 DOM は `3108 -> 1409`、画像 request は `78 -> 1`。Company Content は scroll 後に画像 77 件を正常に遅延読込する。

## Current Truth

- 月初合意ゲートは SSR で先回り集計しない。`AppShell` が既存 `GET /api/monthly-work-agreement` を読む。必要時の必須モーダルと対象外/skip 判定は変えない。
- dashboard の Company Content は `IntersectionObserver` (`rootMargin: 600px`) で近づいた時だけ 1 回取得する。情報・導線を削らない。
- closed UI は静的 bundle へ常駐させず、必要時に dynamic import する。hidden tab の polling は停止する。
- docs closeout 開始直前の production readback は `v3.44.8 / c10b4af947a5142f8984cfc843a1e0b28f2d3b80 / main / dirty=false`。本 handoff の `v3.44.9` deploy 後は `/api/build-info` を必ず取り直す。

## Verification

- `./node_modules/.bin/tsc --noEmit --pretty false`: clean。
- `npm run lint`: 新規 regression なし（既存の許容パターン 1 件のみ）。
- `npm run build`: success。
- `npm run test:critical-ui`: success。`351255cf` で月初合意ゲート anchor の guard を client prop へ更新済み。
- production browser: 初回の軽量化と、scroll 後の Company Content 読込を確認済み。

## Durable Records

- runtime: `pwa/spec/2-1-pwa-runtime-routes.md`
- 月初合意: `pwa/spec/3-14-monthly-work-agreement-current-spec.md`
- member-facing manual: `pwa/manual/6-6-member-billing-prompts-spec.md`
- manual changelog: `pwa/manual/9-3-appendix-changelog.md`
- lesson: `pwa/BUGS.md`
- design decision: `pwa/design_log/sessions_2026-07.md`

## Shared Root / Cleanup State

- `/Users/masa/projects/AMD/amd-os` は multi-writer の shared root。reward-finance、notifications、H-1 reviewer、L6 extract、Atlas、Book A などの別レーン差分と active worktree がある。
- 本 task は disposable clean clone で docs/deploy を完了する。shared root の差分、branch、worktree は読むだけで、stage・reset・prune・削除しない。
- repo 全体の archive 判定は **do not archive**。今回起因の disposable clone だけを closeout 対象にする。

## Unresolved Tasks

- この performance bundle 自体に未解決の実装タスクはない。
- 次の変更前は、local checkout / `origin/main` / production `/api/build-info` を並べて current truth を更新する。

## First Next Action

1. `cd /Users/masa/projects/AMD/amd-os && git fetch origin main && git status -sb --untracked-files=all`。
2. `curl -fsS https://amd-os-pwa.vercel.app/api/build-info` を取り、`v3.44.9` deploy の SHA と `dirty=false` を確認する。
3. authenticated shell に重い fetch・静的 import・polling を足す変更なら、まず route scope / lazy import / hidden tab 停止の 3 点を検討する。

## Guardrails

- `git add .` は使わず対象ファイルだけを stage する。
- shared root の他レーン dirty をこの bundle に混ぜない。
- PWA production deploy は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` だけを使う。
- raw 本文、個人情報、secret、private URL を handoff / durable log へ残さない。
