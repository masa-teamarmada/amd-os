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

PWA の本番反映は deploy gate 制。小刻みな実装・md修正ごとに production deploy しない。まず local build / lint / static check / 必要ならローカルまたはpreview相当の確認で固める。

production deploy は、まとまった変更単位、まさ確認が必要な節目、本当に本番確認が必要な時だけ司令塔が必要性を判断して実行する。実行する場合は必ず repo root から deploy script を使う。

```bash
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
```

契約:

- `--cwd` は repo root。`pwa/` を指定しない。
- `--archive=tgz` 必須。
- `.vercel/project.json` は `amd-os-pwa` / `prj_raZW3HSKIszzPUwNTHfy7xDGzLHm` を指す。
- script は deploy trigger 後、Ready まで polling し、macOS 通知を出す。
- 直接 `npx vercel` を叩かない。
- Vercel quota blocker が出たら retry 連打しない。quota 回復後の retry を Watch に置く。
- deploy しない最終報告では `deployなし。理由: quota温存 / local buildで十分 / main反映のみ` のように理由を書く。

rollback:

```bash
npx vercel promote <deployment-id> --scope armada0130 --yes
```

## Build version

コード修正して deploy gate を通し production deploy するたびに `pwa/src/lib/build-info.ts` の `BUILD_VERSION` を bump する。

| bump | 用途 |
|---|---|
| patch | 細かい修正、UI微調整、bug fix、refactor、既存挙動変更 |
| minor | 本物の新機能、新画面、新DB table |
| major | 大きな仕様変更、architecture刷新 |

迷ったら patch。画面左上の version 表示で、まさが Service Worker / CDN cache の切り替わりを確認する。

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

production deploy は deploy gate を通す。本番反映が本当に必要な作業だけ deploy script まで実行する。docs-only、local buildで十分な変更、quota温存中、またはmain反映だけで足りる変更は deploy しない。

## Git gate

- `git add .` は使わない。対象ファイルだけ stage する。
- 自分が触っていない dirty file は commit に混ぜない。
- conflict marker と `UU` は final 前に必ず解消する。
- commit したら push する。
