# SESSION MIGRATION PROMPT - AMD OS Finance Payment Confirm closeout

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
8. /Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md
9. /Users/masa/projects/AMD/amd-os/pwa/spec/1-1-overview.md
10. /Users/masa/projects/AMD/amd-os/pwa/spec/1-2-document-layer-migration-map.md
11. /Users/masa/projects/AMD/amd-os/pwa/design/README.md
12. /Users/masa/projects/AMD/amd-os/pwa/manual/6-4-finance-payment-confirm-spec.md
13. /Users/masa/projects/AMD/amd-os/pwa/design/notifications.md
14. /Users/masa/projects/AMD/amd-os/pwa/design/SPEC_pwa.md
15. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
16. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md

状態スナップショット:
- repo: /Users/masa/projects/AMD/amd-os
- canonical branch: main
- accepted payment-confirm fix commit: df434cbf fix(pwa): send payment confirm nudges on due date
- current product line before this handoff docs refresh: d8934395 fix(pwa): widen monthly agreement unpaid flow
- df434cbf は d8934395 の ancestor。つまり current origin/main / production line に入金確認fixは含まれている。
- closeout inventory時点: local main vs origin/main は ahead 0 / behind 0、worktree registry は /Users/masa/projects/AMD/amd-os [main] のみ、local branch は main のみ。
- production: https://amd-os-pwa.vercel.app は post-fix line。再開時は必ず /api/build-info と git rev-parse origin/main を照合する。
- payment-confirm fix deploy直後の production proof: v0.39.33 / df434cbf0e42d22cb49ab5fa19e5d2a291498e0c。後続の月初合意UI commitで production は v0.39.34 系へ進んでいる。

今回完了した内容:
- まさの指摘: ZMP の入金確認Slack DMが、期日 2026-07-31 なのに 2026-07-09 に届いた。入金日前に来ても確認できない。さらに文面の `支払月` は `入金月` が自然。
- 原因: /api/cron/payment-confirm-nudges が入金月 ym の未入金候補を全部送り、候補ごとの dueDate が今日かを見ていなかった。
- `入金確認できなかった` 画面は、freee/銀行で入金が見つからないという意味ではなく、signed token の即時反映APIが例外を返した時の汎用エラー画面。DB read-back では ZMP p19 / 202606 の payment_confirmed_at は空のまま。
- 修正: payment-confirm-nudges は today(JST) と group.dueDate が一致する候補だけ送る。期日前・期日後・ゼロ金額候補は送信対象外。
- dry-run / 手動検証用に GET ?date=YYYY-MM-DD / POST { date } を追加。
- Slack文面、確認完了画面、金額入力画面、freee同期失敗DMの `支払月` を `入金月` に統一。
- manual/spec/design/BUGS/design_log/HANDOFF を同期済み。

検証済み:
- npx tsc --noEmit passed
- targeted eslint passed
- npm run build passed
- local dry-run:
  - date=2026-07-09: groupCount=0, skippedBeforeDue=6, skippedAfterDue=1
  - date=2026-07-31: groupCount=0, skippedZeroAmount=5
- AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh で v0.39.33 を main push / Vercel production反映
- production dry-run date=2026-07-09: groupCount=0

現在残っている別件dirty:
- /admin/invoices の freee取引先選択 / 請求書発行条件 WIP。payment-confirm fix とは別。巻き込まない。
- files:
  - M pwa/src/app/(app)/admin/invoices/page.tsx
  - ?? pwa/src/app/api/admin/freee-partners/route.ts
  - M pwa/src/app/api/invoice/create/route.ts
  - M pwa/src/components/admin/AdminInvoiceIssueDialog.tsx
  - M pwa/src/components/admin/AdminInvoiceIssueQueue.tsx
  - M pwa/src/components/admin/AdminProjectsTable.tsx
  - ?? pwa/src/components/admin/FreeePartnerPicker.tsx
  - M pwa/src/lib/build-info.ts
  - M pwa/design/FEATURE_REGISTRY.md
  - M pwa/design/SPEC_pwa.md
  - M pwa/manual/6-2-admin-projects-members-ledger-spec.md
  - M pwa/manual/6-3-invoice-and-billing-routine-spec.md
  - M pwa/manual/9-3-appendix-changelog.md
  - M pwa/spec/6-1-appendix-changelog.md
  - M pwa/scripts/check_pwa_critical_ui.cjs
- owner guess: invoice queue / freee取引先選択 worker
- 方向性は「請求書発行の blocker を freee取引先 / 請求額に絞り、報告書FIX・立替精算を blocker から外す。freee取引先は候補検索UIで選ぶ」。未コミットなので、次セッションで差分全体を確認し、必要なspec/manual/changelogを同期してから、対象ファイルだけ stage / commit / push / deployする。

次タスク:
- payment-confirm nudge は既知残タスクなし。
- もし `予定通り入金済み` の旧失敗を追加調査するなら、古いSlack tokenの再現ではなく、次回発生時に赤見出し下のエラーテキストを取得し、token payload / target billing_cycles / update exception を切り分ける。
- 現実的な次アクションは、別件dirtyの invoice queue freee取引先選択WIPを完成させること。

運用ルール:
- まず /Users/masa/projects/AGENTS.common.md を読む。AMD配下なので AMD level memory も冒頭で読む。
- PWA本番反映は main push = Vercel自動deploy。PWA product change は原則 deploy script: AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh。
- 直接 npx vercel deploy は使わない。
- ブランチ作成禁止。main で対象ファイルだけ編集・stage・commit・pushする。git add .は禁止。
- dirtyを理由に作業やpush/deployを止めない。既存dirtyは戻さず、自分の対象差分と他worker差分を分類して進める。
- closeout時は worktree/branch/ahead/dirty を必ず inventory し、dirtyには owner/action/risk を付ける。今回の archive status は、別件invoice dirtyがあるため do not archive。
```
