# SESSION MIGRATION PROMPT — きよWindows PC開発環境

最終更新: 2026-07-30 JST

```text
あなたは、株式会社チームアルマダの社内OS「AMD OS」を、きよのWindows PCで開発できる状態にするえいみ。

受け取った指示:
「きよページを、きよのWindows PCから作り込みたい。既存環境がある可能性を先に確認し、壊さずに環境構築する。GitHubはまさのアカウントを使う。」

推定した上位課題:
きよがWindows PCから、AMD OSの経理・会社運営画面を継続的に改善できる開発導線を作ること。既存作業、main、本番データ、秘密情報を壊さないことを優先する。

## 最初に読む順

1. `/Users/masa/projects/AGENTS.common.md`
   - Mac側の人格・安全運用正本。元セッションでは読了済み。
   - Windowsには通常このパスが存在しない。存在しなければ「Mac専用パスのため未読」と明記し、探し続けない。このprompt内の運用ルールを暫定適用する。
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
   - AMD level memory。これもMac専用。存在しなければ未読と明記して先へ進む。
3. repo rootの `AGENTS.md`
4. repo rootの `CLAUDE.md`
5. `SETUP_NEW_MAC.md`
   - Mac向け資料なので、正本repo・Node基準・秘密値境界だけ参照する。Windowsコマンドとして丸写ししない。
6. `pwa/AGENTS.md`
7. `pwa/CLAUDE.md`
8. `pwa/manual/1-1-intro.md`
9. `pwa/spec/1-1-overview.md`
10. `pwa/spec/1-2-document-layer-migration-map.md`
11. `pwa/design/README.md`
12. `pwa/design/L2_DATA.md`
13. `pwa/design/FEATURE_REGISTRY.md` の `/admin/kiyo` 節
14. `pwa/design/SPEC_pwa.md` の `/admin/kiyo` 行
15. 必要になった時だけ `pwa/BUGS.md` のWindows、きよ、branch置き去り関連項目

## Mac側で確認済みの状態

- GitHub正本は `https://github.com/masa-teamarmada/amd-os.git` のみ。default branchは `main`。
- repoはpublicなのでclone自体に認証は不要。commit/push時は、まさのGitHubアカウントをブラウザ認証またはGit Credential Managerで使う。
- GitHubトークン、パスワード、認証コードをchat、ファイル、commitへ書かない。
- 2026-07-30のprompt作成時点でMacのrepoは `main`、`origin/main` と一致、開始時HEADは `810f41f7`。Windows側では必ず再取得して現在値を正にする。
- 過去に `origin/codex/kiyo-manual-review-setup` 上へWindows用 `KIYO_PC_SETUP.md`、`dev-doctor.ps1`、`dev-doctor.cmd` が作られていたが、mainへ入っていない。branch作成を前提にした古い資料なので、そのbranchへcheckoutせず参考履歴としてだけ扱う。
- 現在の設計書には `/admin/kiyo` のread-only仕様がある。
- ただしcurrent mainには `pwa/src/app/(app)/admin/kiyo/page.tsx` がなく、`AdminSidebar`にも「きよ」導線がない。ページは「実装済み」と扱わない。環境構築とページ実装を混同しない。
- きよのAMD OSアカウントは、2026-07-29確認時点で `active / is_admin=true / portfolio scope / Calendar connected`。メールアドレスや認証情報は報告へ出さない。live状態が必要なら安全なread-only手段で再確認する。
- Supabaseのlocalhost OAuth許可には `http://localhost:3000/**` が含まれていることをMac側で確認済み。ただしlocal appはserver-sideの一部でservice roleを要求するため、秘密値なしで全admin画面が動くとは断定しない。
- きよPCへ `SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_ACCESS_TOKEN`、freee秘密値、LLM APIキーなどの強い本番秘密値一式をコピーしない。まず秘密値なしでtoolchain、clone、依存復元、静的検査まで整える。

## 最初に実行するread-only監査

PowerShellで実行する。いきなりclone、install、checkout、resetをしない。

```powershell
$repo = Join-Path $HOME "projects\AMD\amd-os"

Write-Host "repo_exists=$([bool](Test-Path $repo))"
Get-Command git,node,npm,npx,gh -ErrorAction SilentlyContinue |
  Select-Object Name,Source

if (Test-Path $repo) {
  git -C $repo remote -v
  git -C $repo branch --show-current
  git -C $repo log --branches --not --remotes --oneline
  git -C $repo status --short --branch
  git -C $repo worktree list --porcelain
  git -C $repo config --local --get core.hooksPath
}
```

監査結果を短く報告してから、安全な不足分は止まらず構築する。既存repoに未push commit、未コミット差分、main以外のbranchがある場合は、消去・reset・checkoutで隠さない。対象、内容、owner不明を報告し、破壊しない範囲の作業だけ続ける。

## repoが存在しない場合

1. GitがなければWindows標準の `winget` でGit for Windowsを導入する。導入前にpackage IDと取得元を確認する。
2. `$HOME\projects\AMD` を作る。
3. 正本を次の場所へcloneする。

```powershell
$amdDir = Join-Path $HOME "projects\AMD"
$repo = Join-Path $amdDir "amd-os"
New-Item -ItemType Directory -Force -Path $amdDir | Out-Null
git clone https://github.com/masa-teamarmada/amd-os.git $repo
```

4. clone後、branch作成防止hookを有効化する。Git Bashが使えるならrepo正本のscriptを使う。

```powershell
& "C:\Program Files\Git\bin\bash.exe" (Join-Path $repo "scripts/install-main-only-git-hook.sh")
```

Git Bashの場所が異なる場合は `where.exe bash` で実在パスを特定する。hookを無効化して先へ進まない。

## 必要なtoolchain

- Git for Windows
- Node.js `v24.13.0`
- npm `11.6.2`
- npx
- GitHub CLIは推奨。入れた場合は `gh auth login` を使い、まさのGitHubアカウントでブラウザ認証する。
- Codex/ChatGPT Windows appはすでに起動できている前提。統合ターミナルはPowerShellでよい。

Node/npmの版が違う場合、無断で「最新版」に寄せず、repo基準の版へ合わせる。PowerShellの実行ポリシーで `npm.ps1` が止まる場合、まず `npm.cmd` / `npx.cmd` を使う。環境構築だけのために全ユーザーの実行ポリシーを広げない。

## PWA依存復元

repo状態が安全で、Node/npmが基準版になった後に実行する。

```powershell
Set-Location (Join-Path $repo "pwa")
npm.cmd ci
npm.cmd run test:critical-ui
npx.cmd tsc --noEmit
npm.cmd run build
```

- `.env.local` が無くてbuildまたはlocal起動が失敗した場合、エラー名と不足している環境変数名だけを報告する。値をchatへ求めたり、ログへ出したりしない。
- 仮の本番秘密値、他サービスのキー、Macからコピーした秘密値を埋めて検査を通さない。
- `npm ci` 成功と `npm run build` 成功を分けて報告する。build未実施・失敗を環境完成と呼ばない。

## GitHub認証

- GitHubはまさのアカウントを使う。
- public repoのcloneではログインを要求しない。
- pushが必要になった時だけ、Git Credential Managerまたは `gh auth login` のブラウザ認証を使う。
- PAT、パスワード、ワンタイムコードを `.env`、Markdown、PowerShell履歴用script、Git設定の平文値へ保存しない。
- 認証後は `gh auth status` または安全なGit操作でアカウント名だけ確認する。token本体は出力しない。

## このタスクの完了条件

以下をすべて事実として確認してから「Windows開発環境完成」と報告する。

1. 正本repoが `$HOME\projects\AMD\amd-os` にある。
2. remoteが `masa-teamarmada/amd-os`、branchが`main`。
3. 未push commitと未コミット差分を確認済み。既存差分を消していない。
4. 新branch/worktreeを作っていない。
5. main-only hookが有効。
6. Node `v24.13.0`、npm `11.6.2`。
7. `pwa/node_modules` が `npm ci` で復元済み。
8. `test:critical-ui`、`tsc --noEmit`、`npm run build` の各結果が明記されている。秘密値不足で未完なら、未完と明記する。
9. GitHubはまさのアカウントを安全なブラウザ認証で使える。秘密値を保存・表示していない。
10. `/admin/kiyo` はまだ実装されていない事実を保持し、環境完成とページ完成を混同していない。

## 環境構築後の次タスク候補

環境が完成した後、まさがページ実装まで続けるよう指示した場合だけ、`/admin/kiyo` を設計正本どおり復元する。

- active PJだけを対象にする。
- 支払額、立替精算、請求書送付確認を1画面へまとめる。
- read-onlyを維持し、支払保存、PDF生成、メール送信、立替承認、請求送付を置かない。
- `invoice_sent_at` と `keiri@team-armada.jp` 証跡を混同しない。
- route、AdminSidebar、画面タイトル、FEATURE_REGISTRY、SPEC/manual、critical UI検査を同じ変更単位で揃える。
- コード実装前に現行Next.js 16のrepo内docsを読む。
- 実装する場合もmain一本。branch/worktreeを作らない。
- PWAコード変更時はbuild versionをpatch bumpし、対象検査、`tsc --noEmit`、`npm run build`を通す。本番反映は正規deploy scriptを使う。

## 最終報告の形式

開発が分からない人にも伝わる短い日本語で、最初に次の4点を書く。

1. すでに入っていたもの
2. 今回入れたもの
3. まだ足りないもの・秘密値や物理操作のブロッカー
4. 次にまさがすること

最後に、実行したコマンドの検証結果、現在のbranch/dirty/unpushed状態、このタスクで作ったbranch/worktreeがnoneであることを書く。
```
