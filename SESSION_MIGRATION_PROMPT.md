# SESSION MIGRATION PROMPT - AMD OS invoice queue / ZMP closeout

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
8. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md
9. /Users/masa/projects/AMD/amd-os/pwa/design/SPEC_pwa.md
10. /Users/masa/projects/AMD/amd-os/pwa/spec/2-2-pwa-surface-inventory-current-spec.md
11. /Users/masa/projects/AMD/amd-os/pwa/manual/6-3-invoice-and-billing-routine-spec.md
12. /Users/masa/projects/AMD/amd-os/pwa/manual/6-6-member-billing-prompts-spec.md
13. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md

状態スナップショット:
- repo: /Users/masa/projects/AMD/amd-os
- branch: main
- branch/worktree policy: 新規branch禁止。dirtyを理由にbranch/worktreeを作らない。PWA変更は正規deploy scriptでmain pushまで進める。
- build version: v0.39.24
- deploy path: AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
- current productionは必ず /api/build-info の build_version / git_sha / dirty で確認する。

完了内容:
- /admin/invoices の中身を旧 billing matrix から請求書発行キューへ変更。
- 初期表示は未発行。filter は 未発行 / 発行済み / 送付済み / 入金済み / すべて。
- 行の主操作は 発行 / 請求書を発行。AdminInvoiceIssueDialog から明細確認、下書き保存、freee 発行へ進む。
- 発行前確認は 予算 / 報告書 / 立替 のみ。支払通知 / 報酬支払などの全ステップ横並び matrix は戻さない。
- 請求額表示は invoice_base_lines_json の明細合計、budget_reported_amount、budget_yen / 0.65 の順。
- 狭い画面では表本体を横スクロールさせ、列とボタンを潰さない。
- ZMP cockpit の 立替精算 は「契約可否」ではなく「発生額 / 不可」。ZMP は実務上OK、金額未入力時は 0円。契約本文には明示条項がないため、巻き直し候補。

検証済み:
- git diff --check
- npm run test:critical-ui
- ./node_modules/typescript/bin/tsc --noEmit --pretty false
- npm run build

次タスク:
- /admin/invoices は、まさが本番で未発行キューを見て使い勝手を確認する。
- ZMPの実際の月次立替金額をOSに残すなら、/admin/projects の ZMP 行の 立替精算 セルに金額を入れる。
- ZMP契約巻き直しを検討するなら、立替精算条項と利益上乗せ条件を明記する。

運用ルール:
- PWA本番反映は main push = Vercel自動deploy。直接 npx vercel deploy は使わない。
- build version は deploy対象のPWA変更時に patch bump。まさが画面左上のversionで反映確認する。
- 契約・請求・支払条件の質問では、DBフィールド名だけで説明しない。契約書・請求実績・実務運用のどれが正本かまで見る。
- 本番反映は origin/main と production /api/build-info の version / SHA / dirty で判断する。ローカル差分だけで本番状態を断定しない。
```
