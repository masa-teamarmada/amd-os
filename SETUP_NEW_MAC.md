# AMD OS New Mac Setup

AMD OS を別 Mac / この Mac のどちらでも開発できるようにするための入口。
正本は GitHub の `masa-teamarmada/amd-os` だけ。Google Drive 配下や旧スタンドアロン repo は使わない。

## 0. 作業場所

現行の AMD 親フォルダ運用ではここを推奨する。

```sh
mkdir -p ~/projects/AMD
cd ~/projects/AMD
git clone https://github.com/masa-teamarmada/amd-os.git
cd amd-os
```

旧 docs に `~/projects/amd-os` が残っていることがある。いまのまさの workspace では `/Users/masa/projects/AMD/amd-os` を優先する。

## 1. 最初に必ず見る状態

別 Mac で作業を始める前に、未 push commit と未コミット差分を必ず確認する。

```sh
git fetch --all --prune
git log --branches --not --remotes --oneline
git branch -a
git status -s
```

`git log --branches --not --remotes --oneline` に出力があれば、その Mac にだけ残っている commit がある。勝手に消さない。

## 2. 必要ツール

最低限:

- Git
- Xcode + Command Line Tools
- Node.js `v24.13.0` / npm `11.6.2`
- Vercel CLI

必要になったら追加:

- `@google/clasp` CLI: GAS を push する時
- Supabase CLI: Supabase CLI 経由の作業をする時
- XcodeGen: `ios/project.yml` から project を再生成する時

この Mac で揃っている baseline は Node.js `v24.13.0` / npm `11.6.2`。別 Mac でもまずこの版に合わせる。

## 3. 環境チェック

clone 後に repo root でこれを叩く。

Windows (PowerShell / コマンドプロンプト):

```powershell
.\scripts\dev-doctor.cmd
```

`.cmd` が使えない環境だけ、PowerShell script を直接叩く。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-doctor.ps1
```

Mac / Linux / Git Bash:

```sh
bash scripts/dev-doctor.sh
```

もし PowerShell script ではなく Git Bash で進める場合は、以下。`「」` や先頭の説明文は入れず、コード部分だけを貼る。

PowerShell:

```powershell
& "C:\Program Files\Git\bin\bash.exe" "scripts/dev-doctor.sh"
```

コマンドプロンプト (cmd.exe):

```bat
"C:\Program Files\Git\bin\bash.exe" "scripts/dev-doctor.sh"
```

または、スタートメニューから **Git Bash** を開いて repo root に移動し、同じ `bash scripts/dev-doctor.sh` を実行する。

上のパスで見つからない場合は、Git Bash が入っていないか、Git のインストール先が違う。まず以下で確認する。

```powershell
where.exe git
where.exe bash
```

このスクリプトは以下を見る。

- Git remote / branch / dirty state
- Node / npm / npx
- PWA の env ファイル有無
- PWA dependencies (`npm ci` が必要か)
- Vercel project link
- GAS clasp 設定
- iOS の Xcode / project

## 4. PWA

依存復元:

```sh
cd pwa
npm ci
npm run build
```

Windows PowerShell で `このシステムではスクリプトの実行が無効になっています` と出る場合:

```powershell
cd pwa
npm.cmd ci
npm.cmd run build
```

開発サーバ:

```sh
cd pwa
npm run dev
```

Windows PowerShell では:

```powershell
cd pwa
npm.cmd run dev
```

本番 deploy は repo root から必ずこれ。

```sh
bash pwa/scripts/deploy.sh
```

`pwa/scripts/deploy.sh` は実行位置から repo root を自動判定する。別 Mac でも `/Users/masa/projects/AMD/amd-os` 固定にはしない。

### PWA secrets

`.env.local` と `.env.production.local` は git 管理しない。別 Mac ではこの Mac から安全な経路でコピーする。

必須系のキー:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `NEXT_PUBLIC_GAS_WEBAPP_URL`
- `NEXT_PUBLIC_GAS_API_KEY`
- `CRON_SECRET`
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY` (production 側で必要)
- `FREEE_CLIENT_ID`
- `FREEE_CLIENT_SECRET`
- `FREEE_COMPANY_ID`
- `FREEE_REFRESH_TOKEN`

Vercel の `VERCEL_*` 系は Vercel runtime が入れる値なので、local `.env.local` へ手で足さない。

## 5. Vercel

Vercel link は root の `.vercel/project.json` と `pwa/.vercel/project.json` に必要だが、`.vercel` は gitignore される。別 Mac では以下のどちらかで復元する。

1. この Mac から `.vercel/` と `pwa/.vercel/` を安全な経路でコピーする。
2. `npx vercel link` で `armada0130 / amd-os-pwa` に link する。

正しい project:

- org/team: `armada0130`
- project: `amd-os-pwa`
- projectId: `prj_raZW3HSKIszzPUwNTHfy7xDGzLHm`
- rootDirectory: `pwa`

deploy 前にログイン確認:

```sh
npx vercel whoami --scope armada0130
```

## 6. GAS

GAS 作業は `gas/` で行う。

```sh
cd gas
npx @google/clasp --version
npx @google/clasp status
```

`invalid_grant` / `invalid_rapt` が出たら、先に Google Workspace reauth をする。

```sh
npx @google/clasp login
```

push:

```sh
cd gas
npx @google/clasp push
```

## 7. iOS

Xcode が入っていることを確認する。

```sh
xcodebuild -version
cd ios
xcodebuild -project AMDOS.xcodeproj -scheme AMDOS -destination 'generic/platform=iOS' build
```

`project.yml` を変更した時だけ XcodeGen を使う。

```sh
cd ios
xcodegen generate
```

## 8. 作業終了時

この repo は別 Mac 併用前提なので、commit したらすぐ push する。

```sh
git status -s
git add <必要なファイル>
git commit -m "<scope>: <message>"
git push origin <branch>
```

PWA を触ったら Vercel deploy、GAS を触ったら `clasp push`、iOS を触ったら実機 install / launch までを完了条件にする。

## 9. 2台運用の基本ルール

2台の Mac で AMD OS を開発する時は、GitHub を唯一の正本にする。Mac 間で repo を AirDrop / Drive / rsync 直同期しない。

作業開始時:

```sh
cd ~/projects/AMD/amd-os
git fetch --all --prune
git log --branches --not --remotes --oneline
git status -s
git pull --ff-only
```

- `git log --branches --not --remotes --oneline` に出力がある時は、その Mac だけに残っている commit がある。内容を見るまで消さない。
- `git status -s` に差分がある時は、その Mac の未コミット作業がある。別 Mac の状態だけを見て上書きしない。
- 片方の Mac で作業を始めたら、もう片方では同じブランチ・同じファイルを並行編集しない。

作業中:

- 作業単位ごとに branch を切る。途中作業なら `wip/...` branch で push してよい。
- commit したらすぐ `git push origin <branch>` する。日末まで push を溜めない。
- もう片方の Mac で続きをやる時は、push 済み branch を pull してから続ける。

例:

```sh
git checkout -b wip/pwa-hud-fix
git add <files>
git commit -m "wip: pwa hud fix"
git push origin wip/pwa-hud-fix
```

避けること:

- Google Drive 配下の clone で作業する。
- 旧 `amd-os-pwa` / `amd-os-ios` / 古い `~/projects/amd-os` を正本扱いする。
- 未コミット差分がある Mac で `git reset --hard` や `git checkout --` を使う。
- PWA を `pwa/` 直下から直接 `vercel` deploy する。必ず repo root から `bash pwa/scripts/deploy.sh` を使う。
- `.env.local` / `.env.production.local` / `.vercel/` を git に入れる。

## 10. 別 Mac 初回プロンプト

別 Mac で最初に Codex / Claude に渡すプロンプト。

```text
AMD OS をこの Mac でも開発できる状態にしたい。

まず /Users/masa/projects/AMD/amd-os を正本として扱って、なければ github.com/masa-teamarmada/amd-os から clone して。
旧 standalone repo や Google Drive 配下のコピーは参照しないで。

最初に以下を読んで current truth を確認して:
- AGENTS.md
- CLAUDE.md
- SETUP_NEW_MAC.md
- pwa/CLAUDE.md
- gas/CLAUDE.md
- ios/CLAUDE.md

その後、repo root で:
- git fetch --all --prune
- git log --branches --not --remotes --oneline
- git status -s
- bash scripts/dev-doctor.sh

を実行して、足りないものを整理して。
低リスクな依存復元は止まらず実行していい。たとえば PWA の node_modules がなければ `cd pwa && npm ci` して。
ただし既存の未コミット差分や未push commit は絶対に消さないで。

最終的に、この Mac で PWA / GAS / iOS のどこまで開発可能か、足りない secret / login / CLI が何かを短く報告して。
```

## 11. きよPCで OS マニュアルをレビューする時

OS マニュアルのブラッシュアップだけをきよPCで行う場合は、まず
[`manual-review/KIYO_PC_SETUP.md`](manual-review/KIYO_PC_SETUP.md) を読む。

見るだけなら本番 URL でよい。きよPC側の AI と一緒に `pwa/manual/*.md` を直接直す場合だけ、repo を
`~/projects/AMD/amd-os` に clone して branch 作業する。
