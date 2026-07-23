# SESSION MIGRATION PROMPT — AMD運営カレンダー

```text
cd /Users/masa/projects/AMD/amd-os

AMD運営カレンダー (`/admin/schedule`) の保守・改善を引き継ぐ。

最初にこの順で読む。

1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md
4. /Users/masa/projects/AMD/amd-os/CLAUDE.md
5. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
6. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
7. /Users/masa/projects/AMD/amd-os/HANDOFF_ADMIN_OPERATING_CALENDAR_2026-07-23.md
8. /Users/masa/projects/AMD/amd-os/pwa/spec/5-9-admin-operating-calendar-current-spec.md
9. /Users/masa/projects/AMD/amd-os/pwa/manual/6-9-company-payment-obligations-spec.md
10. /Users/masa/projects/AMD/amd-os/pwa/manual/4-5-management-score-and-finance-simulation-spec.md
11. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md
12. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md の process/codex-local-child と支払義務関連

状態スナップショット（2026-07-23確認）:

- accepted implementationは `8bb41d2009ab8276a21cc12ddb8775cd4d50c836`。mainへ統合済み。
- productionは `v3.47.13 / e4ea6759535ac920ae7155c78f5b43231bf0fadb / main / dirty=false`。上記commitを祖先に含む。
- local branchはmainのみ、registered worktreeはroot 1件。新branch/worktreeは絶対に作らない。Codex Desktopのrepo-targeted Local子タスクとUI Handoffも使わない。
- rootにはBook A本文の未commit差分が残る可能性がある。最初にgit statusとgit diffを読み、他作業の差分を戻さない。dirtyは自分の変更のcommit/push/deployを止める理由にしないが、Book A本文は絶対に巻き込まない。
- rootの一般HANDOFFと一般migration promptは他レーンの正本。AMD運営カレンダーではこのpromptと専用handoffを優先し、他レーンの文書を上書きしない。

完成済みの仕様:

- この画面の目的は、きよがAMD運営として年間にいつ・何を・いくら納めるかを一目で把握すること。予定を手入力する場所ではなく、契約・支払義務・報告などの正本から生成する読み取りモデル。
- 主役は税務署、年金事務所、労働局などへの会社単位の法定納付。PJごとの請求書発行、送付、入金確認は表示しない。
- 必要資金は「要照合」と「これからの口座流出」だけで算出する。納付済みを未来の支払いに混ぜない。納付行では日付、正式名称、支払先、完全な金額、確定/概算、状態を省略しない。
- 社会保険料のカレンダー上の金額は、会社の口座から出る納付総額。本人預り分を含むため、会社のPLコストと同一視しない。
- 貸付元本返済は`loan_payment`。PL固定費、役員報酬、社会保険算定ベースから外し、月次CF・cash balance・runwayだけに反映する。名称の推測で役員報酬へ分類しない。
- 支払義務の自動DMは既定OFF。通知を追加・変更する時は、まさへ事前に発火条件、宛先、件数、影響範囲を示す。調査だけで `/api/cron/payment-obligations` を実行しない。

作業ルール:

- コード変更前に、関連するspec/manual/design/current truthを読む。カレンダー上の予定・日付・金額・担当者を直接編集できる機能は追加しない。誤りは元正本を直して再生成する。
- 変更したら、必要に応じて `pwa/spec/5-9-...`、`pwa/manual/6-9-...`、`pwa/manual/4-5-...`、`pwa/design/FEATURE_REGISTRY.md`、`pwa/design/db_schema.md`、`pwa/manual/9-3-appendix-changelog.md`、`pwa/design_log/sessions_2026-07.md` を同じ変更束で更新する。
- `git add .` / `git add -A`は禁止。対象ファイルだけstageする。mainへcommit/pushし、PWA変更は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で本番まで確認する。直接のVercel CLI deployは使わない。
- 最低限の回帰確認は `npm run test:admin-schedule`、`npm run test:payment-obligations`、`npm run test:critical-ui`、型検査、必要に応じてbuild。画面変更は認証済み状態でデスクトップとmobileを確認する。
- closeoutではmain/origin一致、local branch=mainのみ、worktree=rootのみを確認する。他workerのdirtyはowner/action/riskをhandoffへ残し、勝手に消さない。
```
