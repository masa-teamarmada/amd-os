# SESSION MIGRATION PROMPT - AMD OS monthly agreement payout month

```text
cd /Users/masa/projects/AMD/amd-os

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/CLAUDE.md
5. /Users/masa/projects/AMD/amd-os/AGENTS.md
6. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
7. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
8. /Users/masa/projects/AMD/amd-os/pwa/design/L2_DATA.md
9. /Users/masa/projects/AMD/amd-os/pwa/spec/3-14-monthly-work-agreement-current-spec.md
10. /Users/masa/projects/AMD/amd-os/pwa/manual/2-2-member-workflows-quick-start.md
11. /Users/masa/projects/AMD/amd-os/pwa/manual/6-6-member-billing-prompts-spec.md
12. /Users/masa/projects/AMD/amd-os/pwa/manual/7-1-reward-calc-spec.md
13. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
14. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md

状態スナップショット:
- repo: /Users/masa/projects/AMD/amd-os
- canonical branch: main。新規 branch / worker worktree は禁止。
- current origin/main at handoff: 63737267d692230eda2fea9b45e7cd69184f4ebf
- current production: https://amd-os-pwa.vercel.app/api/build-info = v0.39.41 / 63737267d692230eda2fea9b45e7cd69184f4ebf / main / dirty=false
- 月初合意の `今月支払` 0円表示 bug は `7ef6f44c fix(pwa): use reward payment month for monthly agreements` で修正済み。後続の `b552c607` / `1cf3dd4a` / `63737267` にも含まれる。
- 修正の本質: `billing_cycles.invoice_ym` はクライアント請求書発行月であり、メンバー支払月ではない。月初合意の `projects[].payoutYen` / `/admin/monthly-work-agreements` の `今月支払` は、PJ/member 支払条件から計算する。
- read-only 再計算結果: 202607 の今月支払は合計 87,457円。内訳は しん 29,055円、あび 26,227円、こう 25,740円、うめ 6,435円。ZMP 202606 分。
- SX 202606 分は現行データ上 `invoice_received_60_days` 系の支払条件で 202607 には乗らない。これはコード不具合ではなく、支払条件/契約設定を見直す別判断。
- canonical root checkout は closeout inventory 時点で main==origin/main。ただし別件 dirty あり: pwa/design/FEATURE_REGISTRY.md、pwa/scripts/check_pwa_critical_ui.cjs、pwa/src/components/nav/GlobalNav.tsx、pwa/src/lib/build-info.ts。GlobalNav/board nav flyout refinement のWIPっぽいので、月初合意 lane には混ぜない。
- この handoff/closeout 文書更新は clean clone /tmp/amd-os-monthly-payout-fix-clone から作成。root の別件 dirty は触らない。

完了内容:
- `/admin/monthly-work-agreements` と月初合意 snapshot の支払月判定を修正。
- `payoutScheduleEntryFromCycle` と `buildMonthlyWorkAgreementBundle` が、報酬支払説明では `invoice_ym` を無視し、PJ/member 支払条件で支払月を決めるようになった。
- 明細は `monthly_reward_payout` を優先し、なければ `reward_summary_json.members[]` を読む既存方針は維持。
- `pwa/spec/3-14-monthly-work-agreement-current-spec.md`、`pwa/manual/6-6-member-billing-prompts-spec.md`、manual/spec changelog に、`invoice_ym` は請求書発行月で支払月ではないと明記済み。
- 後続 UI commit で、月初合意の必須確認は `発注条件` と `予定額` の2点へ整理され、支払い状況/未払残/pt は参考情報へ分離済み。

検証済み:
- `npx tsc --noEmit --pretty false` passed。
- `npm run build` passed。
- deploy script 内の `npm run test:critical-ui` passed。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で `7ef6f44c` を main push / Vercel production 反映し、当時 `v0.39.40` / dirty=false を確認。
- その後 current production は `63737267` / `v0.39.41`。修正 commit は ancestor。
- `npm run lint` は実行したが、既存の repo-wide lint error で失敗。今回触った月初合意支払月ロジック由来ではない。

次タスク:
- 月初合意 `今月支払` bug は既知残なし。
- まさが「SXも7月に払うべき」と見るなら、SX/PJ台帳の支払条件を確認し、契約/実運用に合わせる別タスクとして扱う。コード側で勝手にZMPと同じ扱いにしない。
- `/admin/monthly-work-agreements?ym=202607` を再確認するときは、まず production build-info が current origin/main と一致するかを見る。その後、ZMP 202606 の4名支払が表示されるかを確認する。
- root checkout の GlobalNav dirty を扱うなら、月初合意とは別 lane として `git diff` を読み、対象4ファイルだけで commit/deploy する。build-info の local dirty は `v0.39.42` だが production は `v0.39.41` なので、混ぜる前に意図を確認する。

運用ルール:
- まず /Users/masa/projects/AGENTS.common.md から読む。AMD OS では root/pwa AGENTS/CLAUDE と該当 spec/manual も先読みする。
- PWA本番反映は main push = Vercel自動deploy。直接 `npx vercel deploy` は使わない。必要な時は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`。
- dirtyを理由にbranch/worktreeを作らない。既存dirtyは戻さず、今回の対象ファイルだけ明示 stage する。`git add .`は禁止。
- finance / payment / agreement では、DBフィールド名を実務の意味と混同しない。請求書発行月、入金月、メンバー支払月、稼働月はそれぞれ別物として、契約・実データ・manual/specを見てから判断する。
- closeout時は `bash /Users/masa/.codex/skills/closeout/scripts/closeout_inventory.sh /Users/masa/projects/AMD/amd-os`、production `/api/build-info`、worktree/branch、dirty classification を必ず取り直す。
```
