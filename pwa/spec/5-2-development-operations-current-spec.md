# 開発 / デプロイ運用仕様

> **この章は何か**: AMD OS PWA を再構築・変更・本番反映するための開発運用 contract。旧 `/manual/9-2-developer` から実装者向け情報を移植した。

## リポジトリ

| 項目 | 値 |
|---|---|
| 正本 repo | `github.com/masa-teamarmada/amd-os` |
| local 正本 | `/Users/masa/projects/AMD/amd-os` |
| PWA root | `/Users/masa/projects/AMD/amd-os/pwa` |
| remote | `https://github.com/masa-teamarmada/amd-os.git` |
| production app | `https://amd-os-pwa.vercel.app` |

旧 standalone repo (`amd-os-ios` / `amd-os-pwa` / `amd-os-android` / 旧 GAS 版 `amd-os`) は archive 扱いで参照しない。Google Drive 配下への clone も禁止。

## PWA 技術スタック

| 項目 | 現行仕様 |
|---|---|
| framework | Next.js 16 App Router |
| UI | React 19 + Tailwind CSS v4 |
| backend | Supabase direct access + AMD OS GAS Web App |
| deploy | main push = Vercel Git 自動 production deploy (2026-06-12〜、CLI 直接 deploy 廃止) |
| route root | `pwa/src/app/(app)` |

Next.js の挙動は version 依存が強い。実装前に必要なら `node_modules/next/dist/docs/` を確認する。

## Production deploy

**2026-06-12 まさ確定 (A案)**: PWA の本番反映 = `origin/main` への push。Vercel の GitHub 連携が main push を自動 production build する。Vercel CLI による直接 deploy (`npx vercel --prod` / `npx vercel deploy` / 旧 `--archive=tgz` 方式) は全面廃止。

目的: **「まさが画面で見る OS = origin/main」を常に成立させる**。未 push worktree からの CLI deploy は、git のどこにも固定されない本番を作り、正本巻き戻り事故を生むため (2026-06-12 L2 リネーム幽閉事故、`pwa/BUGS.md` 参照)。

本番反映は必ず repo root の deploy script を使う。

```bash
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
```

契約:

- script は push 前に次を検査し、満たさなければ hard-stop する: ①current branch = main ②tracked ファイルに未コミット変更なし ③`origin/main` がローカル main の ancestor (= 別マシンの push を取り込み済み) ④origin/main との差分 commit が 1 つ以上ある。
- script は push 前に rollback guard (`deploy-version-guard.cjs`) を実行し、local `BUILD_VERSION` が production current より古い deploy を止める。
- `bash pwa/scripts/deploy.sh --dry-run` は push せず、上記検査と rollback guard だけを確認する。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1` はまさの deploy bundle 承認後にのみ付与する。
- script は push 後、新しい production deployment が Ready になるまで polling し (最大 15 分)、macOS 通知を出す。
- **main 以外の branch は build されない**: `pwa/vercel.json` の `ignoreCommand: [ "$VERCEL_GIT_COMMIT_REF" != "main" ]` (exit 0 = build skip)。preview deploy は運用しない。
- **ブランチ作成は全面禁止** (root `CLAUDE.md` 2026-06-12 確定)。
- `.vercel/project.json` (`amd-os-pwa` / `prj_raZW3HSKIszzPUwNTHfy7xDGzLHm`) は緊急 rollback の `vercel promote` 用に維持する。

rollback (緊急時のみ CLI 使用可):

```bash
npx vercel promote <deployment-id> --scope armada0130 --yes
```

恒久復旧は revert commit を main に push して行い、本番と main の乖離を残さない。

## Build version

コード修正して deploy するたびに `pwa/src/lib/build-info.ts` の `BUILD_VERSION` を bump する。

| bump | 用途 |
|---|---|
| patch | 細かい修正、UI微調整、bug fix、refactor、既存挙動変更 |
| minor | 本物の新機能、新画面、新DB table |
| major | 大きな仕様変更、architecture刷新 |

迷ったら patch。画面左上の version 表示で、まさが Service Worker / CDN cache の切り替わりを確認する。

## Public build stamp

PWA は public unauthenticated route として `/api/build-info` を持つ。この route は middleware / Supabase auth を通さず、`Cache-Control: no-store` で以下だけを返す。

| field | 内容 |
|---|---|
| `build_version` | `pwa/src/lib/build-info.ts` の `BUILD_VERSION` |
| `git_sha` | deploy 時に注入された commit SHA |
| `git_branch` | deploy 時に注入された branch / named ref |
| `deployed_at` | deploy 時の UTC timestamp |
| `dirty` | deploy 元 worktree に未コミット差分があったか |

secret / env 値そのものは返さない。Vercel CLI deploy では deployment の `gitSource` が空になることがあるため、production regression 調査では `/api/build-info` を一次証拠として見る。

## Worker freshness gate

visible worker は実装やdeployの前に、作業baseが current line から古すぎないことを read-only で確認する。

```bash
git fetch --all --prune
AMD_OS_MIN_BUILD_VERSION=v0.16.20 \
  AMD_OS_BASE_REF=origin/codex/prs-docs-v01618 \
  scripts/worker-freshness-check.sh
```

この script は git state を変更しない。local `BUILD_VERSION`、required base ref、known ref max、dirty file数を表示し、`v0.16.20` 未満や required base ref を含まない checkout では実装 / DB write / deploy / push 前に停止する。

## Supabase DDL

| 項目 | 契約 |
|---|---|
| project | `nbnhrhybjslbawdukvvk` |
| migration path | `pwa/scripts/migrations/NNN_name.sql` |
| apply | `python3 -X utf8 pwa/scripts/apply_ddl.py pwa/scripts/migrations/NNN_name.sql` |
| schema dump | `python3 -X utf8 pwa/scripts/dump_schema.py` |
| schema 正本 | `pwa/design/db_schema.md` |

`db_schema.md` は自動生成なので手動編集しない。DDL を変えたら migration と schema dump を同じ commit に含める。列名・テーブル名は想像で書かない。

## GAS Web App deploy

PWA が `NEXT_PUBLIC_GAS_WEBAPP_URL` 経由で呼ぶ本体 GAS は、`clasp push` だけでは production `/exec` に反映されない。

```bash
cd /Users/masa/projects/AMD/amd-os/gas
npx --yes @google/clasp@latest push --force
npx --yes @google/clasp@latest deploy \
  --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G \
  --description "vNNNN_short_desc"
```

支払通知書PDFを触った時は `/api/cron/payout-notice-prebuild` を `force:true` で再生成し、実PDFの数字と表記を確認する。

## Manual / Spec / BZM UI

| route | content root | metadata |
|---|---|---|
| `/manual` | `pwa/manual/*.md` | `pwa/src/app/(app)/manual/manual-chapters.ts` |
| `/spec` | `pwa/spec/*.md` | `pwa/src/app/(app)/spec/spec-chapters.ts` |
| `/bzm` | `pwa/bzm/*.md` | `pwa/src/app/(app)/bzm/bzm-chapters.ts` |

章を増やしたら、本文 md と metadata を同じ commit で更新する。UI route は auth / admin gate の対象が違うので、移植時に visibility を混同しない。

## Verification gate

PWA UI 導線、章追加、metadata、runtime code を触ったら最低限:

```bash
npx tsc --noEmit
npm run build
```

本番反映が必要な作業は deploy script まで実行する。

deploy guard を触ったら最低限:

```bash
npm run test:deploy-version-guard
bash pwa/scripts/deploy.sh --dry-run
```

## Git gate

- `git add .` は使わない。対象ファイルだけ stage する。
- 自分が触っていない dirty file は commit に混ぜない。
- conflict marker と `UU` は final 前に必ず解消する。
- commit したら push する。
