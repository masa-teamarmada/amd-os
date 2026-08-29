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

- script は push 前に次を検査し、満たさなければ hard-stop する: M-1current branch = main D-1tracked ファイルに未コミット変更なし D-2`origin/main` がローカル main の ancestor (= 別マシンの push を取り込み済み) D-3origin/main との差分 commit が 1 つ以上ある。
- script は push 前に rollback guard (`deploy-version-guard.cjs`) を実行し、local `BUILD_VERSION` が production current より古い deploy を止める。
- `bash pwa/scripts/deploy.sh --dry-run` は push せず、上記検査と rollback guard だけを確認する。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1` は承認済みを示す値ではなく、誤実行防止の明示スイッチ。原則、deploy 前の事前確認で止めず、deploy bundle は事後報告に残す。
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

## Codex session の main-only 境界

AMD OS では、Codex Desktop で repo を target にした Local 子タスク作成・UI の Handoff を使わない。Codex アプリは作業者へ repo 指示を渡す前に `codex/<thread-id>` branch を作り、正本 checkout 自体を切り替えることがあるため、プロンプト上の「branch 禁止」だけでは防げない。

防止は次の二層で行う。

1. `.codex/config.toml` の `[features] multi_agent = false` で、この repo の Codex 子タスク機能を無効にする。
2. `.githooks/reference-transaction` で `main` 以外の local branch 作成を Git ref transaction の時点で拒否する。clone 後は `bash scripts/install-main-only-git-hook.sh` を1回実行する。

新セッション開始時は次を確認する。

```bash
git fetch origin main
git status -sb --untracked-files=all
git rev-list --left-right --count HEAD...origin/main
git worktree list --porcelain
git branch --format='%(refname:short)'
scripts/worker-freshness-check.sh
```

期待値は `main`、dirty 0、ahead/behind `0 0`、registered worktree 1、local branch `main` だけ。Codex が「ブランチを切り替えるには変更をコミットしてください」と表示した場合はキャンセルし、`コミットしてブランチを切り替える` を押さない。差分を archive して帰属を確認し、価値ある変更だけ main へ畳んでから branch / worktree を消す。

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
- Codex の Local 子タスク / UI Handoff をこの repo で起動しない。
- closeout は worktree 1、local branch `main` だけ、stash 0、ahead/behind `0 0` まで確認する。

## LLM クライアントの経路封鎖 (2026-07-01 まさ確定)

まさ確定 2026-07-01:「定額トークンが余ってるのに Anthropic API 従量課金を使う意味がない。背景抽出は Codex automation (定額枠) に一本化しろ」。

- PWA/Vercel 側で `new Anthropic()` を**直接書かない**。必ず共通ファクトリ [`src/lib/anthropic-client.ts`](pwa/src/lib/anthropic-client.ts) 経由にする。
  - `getBackgroundAnthropic(caller)` = cron / routine / 背景 lib 用。`ALLOW_PWA_LLM_CRONS !== "1"` のとき **throw** する (= デフォルト封鎖)。呼び出し側 (route) は `BackgroundAnthropicDisabledError` を catch して `{ ok:true, disabled:true }` を返す。
  - `getInteractiveAnthropic()` = まさが能動操作する対話 UI 用 (つくよみチャット / 月報 narrate / PL hearing / report 生成 等)。封鎖しない。
- 背景 L2 抽出の唯一経路は **Codex automation** (`~/.codex/automations`)。受け皿は D-6〜D-14 / W-1 / H-1 が ACTIVE 稼働済み。PWA cron route は封鎖されても抽出は死なない。
- `ALLOW_PWA_LLM_CRONS=1` は Vercel 本番 env に**設定しない**。どうしても PWA 側で従量課金 LLM を使う必要が出たときだけ、owner (まさ) 承認の上で明示する。
- 新しく LLM を使う route/lib を足すときも、背景実行系なら必ず `getBackgroundAnthropic()` 経由にする。`new Anthropic()` をベタ書きすると、うっかり課金経路が復活する。
- 背景 cron を退避した履歴は [`vercel.disabled-crons.json`](pwa/vercel.disabled-crons.json)。vercel.json に LLM cron を戻さない (`pwa/design/L2_DATA.md` の「PWA/Vercel LLM cron 禁止」も参照)。

---

## メンバーコードネームリンク (admin-only)

- OS内でAMDメンバーの `code_name` を文章・通知・カード・台帳セルに表示するときは、原則 `/mypage?memberId=<members.member_id>` にリンクする。
- `<members.member_id>` は Supabase の `members.member_id` をそのまま使う。例: `ID001`。`001` のように `ID` prefix を落としたURLは禁止。
- 他メンバーのマイページ閲覧は admin (`members.is_admin=true`) 専用。一般ユーザー向けの相互閲覧導線として扱わない。
- 自由文は共通UI `LinkedMemberText` を使い、構造化されたメンバー台帳・一覧では行の `member_id` から明示的に `Link` を組む。
- `/admin/members` の codeName セルはこの rule の基準UI。コードネームをクリックすると対象メンバーのマイページへ飛び、編集はセル内の編集ボタンから行う。

---

## 列名・テーブル名を想像で書かない

新規 cron / API route / Edge Function / GAS 関数で Supabase テーブルを叩く前に、
**[`design/db_schema.md`](pwa/design/db_schema.md) を必ず grep して実際の列名を確認**してから
select / filter / insert / upsert を書くこと。

過去事故: `member_activities` の列を `code_name` / `created_at` / `activity_text` / `kind` と
想像で書いたら全部間違ってて (実体は `member_id` / `extracted_at` / `content_preview` /
`source`)、PostgREST 42703 エラーで `actsRes.ok=false` → 入力ゼロで進行 → 他人の活動が
本人のものとして LLM 抽出される事故 (BUGS.md `[GAS] member_knowledge 抽出で「きよ」に他人の活動が紐付くカオス` 参照)。

**運用**:
- DDL を変更したら同じ commit で `python3 -X utf8 scripts/dump_schema.py` を実行して `design/db_schema.md` を再生成 → commit に含める
- 他の md (HANDOFF / 設計 md) で「テーブル X の列 Y」を書くときも、必ず `db_schema.md` から正しい列名をコピーする (= 二次情報を参照しない)
- えいみが新セッション開始時に「列名を書く必要があるなら必ず先に `db_schema.md` を grep する」セルフルールを徹底

`db_schema.md` は自動生成 (Supabase Management API → information_schema.columns)。
手動編集禁止 (= 次回再生成で消える)。

---
