# 開発者向け

この章は、開発者が最初にどこを読むかを案内する入口。

開発手順・deploy・DDL・automation・GAS deploy の詳しい仕様は、設計書へ移行済み。

## 開発者がまず読む場所

| 知りたいこと | 正本 |
|---|---|
| 設計書だけで OS を再構築できるか | [/spec/1-3-reconstruction-coverage-audit](/spec/1-3-reconstruction-coverage-audit) |
| manual / spec / bzm の責務分離と附則ルール | [/spec/5-1-document-governance-current-spec](/spec/5-1-document-governance-current-spec) |
| repo / deploy / build version / DDL / GAS deploy | [/spec/5-2-development-operations-current-spec](/spec/5-2-development-operations-current-spec) |
| L2 automation / cron / outbox / 停止済み旧経路 | [/spec/5-3-automation-responsibility-current-spec](/spec/5-3-automation-responsibility-current-spec) |
| 過去判断と事故から来た実装制約 | [/spec/5-4-decision-history-current-spec](/spec/5-4-decision-history-current-spec) |
| PWA route / API surface | [/spec/2-2-pwa-surface-inventory-current-spec](/spec/2-2-pwa-surface-inventory-current-spec) |
| Supabase data model | [/spec/2-3-supabase-data-model-current-spec](/spec/2-3-supabase-data-model-current-spec) |

## 変更時の最低ルール

- 使い方は `/manual`、実装仕様は `/spec`、理論・数式・rubric は `/bzm` に置く。
- どれかを変更したら、対応する附則に日時つきで追記する。
- 画面導線や章 metadata を触ったら `npx tsc --noEmit` と `npm run build` を通す。
- 本番反映するなら build version を bump する。ただしVercel production deploy / preview deploy / Vercel自動deployを起こす可能性があるpushの直前には、deploy bundleを作り、`askuserquestion` でまさ承認を取る。
- deploy bundleには、含める変更、除外する変更、local build/test/browser確認結果、deploy予定回数、push/deploy先、rollback/本番確認方法を含める。承認待ちは `approval pending` として台帳に残す。
- 承認後だけ `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` で本番deployする。
- deploy 前の安い確認は `bash pwa/scripts/deploy.sh --dry-run`。Vercelを呼ばずに、BUILD_VERSION rollback guard と build stamp 準備だけを見る。
- 本番の出どころ確認は `/api/build-info`。`build_version` / `git_sha` / `git_branch` / `deployed_at` / `dirty` だけを返し、secret は出さない。
- 自分が触っていない dirty file を commit に混ぜない。

## 再構築可能性チェック

この manual 章だけでは OS は再構築できない。目的は「開発者の入口」。再構築に必要な contract は `/spec` の各章を読む。
