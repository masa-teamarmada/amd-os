# SESSION MIGRATION PROMPT - AMD OS Monthly Agreement Modal Gate

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に仕様正本として `pwa/spec/3-14-monthly-work-agreement-current-spec.md` を読んで。そのあと `pwa/BUGS.md`、`pwa/manual/2-2-member-workflows-quick-start.md`、`pwa/manual/6-6-member-billing-prompts-spec.md`、`pwa/manual/6-5-admin-payouts-reward-notice-spec.md`、`pwa/manual/7-1-reward-calc-spec.md`、`CLAUDE.md`、`AGENTS.md`、`pwa/CLAUDE.md` を読んで。

今回の current truth:
- 月初合意が未完了または条件更新ありのメンバーがOS内の他画面を開くと、開いた画面を背景に残して月初合意モーダルを前面に出す。
- このモーダルは必須確認。背景クリック、Esc、閉じるボタンで先送りできるUIにしない。
- 合意保存が成功した時だけモーダルを閉じ、通常画面へ戻す。
- adminメンバーもテスト確認のため月初合意対象に含める。
- 2026年6月以前の稼働月は、契約改定前かつシステム未完成期間のため、支払gateでは移行月として合意済み扱いにする。合意rowを偽造しない。
- 今回の closeout ではDB write、実合意保存、本番データ変更はしていない。
- `/Users/masa/projects/AMD/amd-os` のroot checkoutは unrelated dirty state が多い。今回の月初合意modal修正と混ぜない。

作業開始前に必ず:
1. `git fetch origin main --prune`
2. `git status -sb --untracked-files=all`
3. `git log --left-right --oneline main...origin/main`
4. `rg -n "MonthlyAgreementGateOverlay|月初合意|背景クリック|dismissedGateKey|onBackdropClick" pwa/src pwa/spec pwa/manual pwa/BUGS.md`

最初の一手:
1. 月初合意入口を触るなら、`pwa/src/components/monthly-agreement/MonthlyAgreementGateOverlay.tsx` を見て、背景クリックで閉じる処理が戻っていないことを確認する。
2. 画面内容を変えるなら、`pwa/src/components/monthly-agreement/MonthlyAgreementExperience.tsx` と `pwa/spec/3-14-monthly-work-agreement-current-spec.md` を同時に更新する。
3. 仕様変更なら `pwa/manual/2-2-member-workflows-quick-start.md`、`pwa/manual/6-6-member-billing-prompts-spec.md`、appendix changelog、必要なら `pwa/BUGS.md` に同期する。
4. 認証済みadmin画面で確認できるなら、未合意/条件更新ありの状態で `/dashboard` などを開き、モーダルが前面表示され、背景クリックで閉じないことを確認する。

検証:
```bash
cd /Users/masa/projects/AMD/amd-os/pwa
npm run test:critical-ui
npm run build
```

守ること:
- 開発が分からない人への報告では、内部ファイル名や英語の技術語を先に出さず、「何ができているか」「何が危ないか」「次に何をするか」を日本語で説明する。
- 月初合意は報酬計算を変更しない。本人が見る当月の遂行内容・予定額への確認レイヤーとして扱う。
- 6月以前の支払を未合意で止めない。
- `git add .` は使わない。選んだbundleのファイルだけ個別stageする。
- PWA本番反映が必要なら `.vercel/project.json` が `amd-os-pwa / prj_raZW3HSKIszzPUwNTHfy7xDGzLHm` であることを確認し、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。
```
