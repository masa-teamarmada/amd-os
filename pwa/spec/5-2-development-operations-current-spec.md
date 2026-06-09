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
| deploy | Vercel CLI local production deploy |
| route root | `pwa/src/app/(app)` |

Next.js の挙動は version 依存が強い。実装前に必要なら `node_modules/next/dist/docs/` を確認する。

## Production deploy

PWA の本番反映は必ず repo root から deploy script を使う。

```bash
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
```

契約:

- `--cwd` は repo root。`pwa/` を指定しない。
- `--archive=tgz` 必須。
- `.vercel/project.json` は `amd-os-pwa` / `prj_raZW3HSKIszzPUwNTHfy7xDGzLHm` を指す。
- deploy script は Vercel CLI を起動する前に `.vercel/project.json` を検査し、`amd-os-pwa` 以外や missing の場合は hard-stop する。worker worktreeから誤って新規Vercel projectを作らないため、この guard を外してdeployしてはいけない。
- deploy script は Vercel を呼ぶ前に rollback guard を実行し、local `BUILD_VERSION` が deploy minimum、production current、または既知 git ref max より古い production deploy を止める。
- `bash pwa/scripts/deploy.sh --dry-run` は Vercel を呼ばず、rollback guard と build stamp 準備だけを確認する。
- preview deploy は production alias を動かさないため rollback guard は warning に留める。production deploy は hard-stop。
- script は deploy trigger 後、Ready まで polling し、macOS 通知を出す。
- 直接 `npx vercel` を叩かない。

rollback:

```bash
npx vercel promote <deployment-id> --scope armada0130 --yes
```

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
