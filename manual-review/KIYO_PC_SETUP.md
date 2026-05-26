# きよPC OSマニュアルレビュー setup

OS マニュアルを、きよが自分の PC と AI で読みながらブラッシュアップするための入口。

レビューだけなら本番 URL を見ればよい。ローカルディレクトリが必要なのは、きよPC側で AI と一緒に `pwa/manual/*.md` を直接直す場合。

## 0. 前提

- GitHub の正本 repo は `masa-teamarmada/amd-os` だけ。
- 旧 standalone repo (`amd-os-pwa` / `amd-os-ios` / 古い `~/projects/amd-os`) は使わない。
- Google Drive 配下には clone しない。
- きよPCの推奨 path は `~/projects/AMD/amd-os`。
- 本番 deploy は、原則まさPC / えいみ側で最後にまとめて行う。

## 1. まず見るだけの場合

ローカル setup は不要。

- ユーザー向け: https://amd-os-pwa.vercel.app/manual
- 開発者向け: https://amd-os-pwa.vercel.app/manual?audience=developer

きよが見る観点:

- 初めて見る人が、最初の 5 分で「何の OS か」分かるか
- メンバーの日常導線が、実際の行動順に並んでいるか
- admin / 開発者向けの裏事情が、ユーザー向けに混ざっていないか
- 「はい・反映」「つくよみ修正依頼」などの操作が怖くない説明になっているか

## 2. きよPCに repo を作る

```sh
mkdir -p ~/projects/AMD
cd ~/projects/AMD
git clone https://github.com/masa-teamarmada/amd-os.git
cd amd-os
```

既に `~/projects/AMD/amd-os` がある場合は clone し直さず、先に状態を見る。

```sh
cd ~/projects/AMD/amd-os
git fetch --all --prune
git log --branches --not --remotes --oneline
git status -s
```

`git log --branches --not --remotes --oneline` に出力があれば、きよPCだけに残っている commit がある。消さずに内容を見る。

## 3. OSマニュアル作業 branch

まさPC側で manual snapshot branch が push 済みなら、きよPCではその branch に入る。

```sh
git fetch --all --prune
git checkout codex/kiyo-manual-review-setup
```

きよが修正を入れる時は、そこから自分用 branch を切る。

```sh
git checkout -b kiyo/os-manual-brushup
```

## 4. 環境チェック

```sh
bash scripts/dev-doctor.sh
```

最低限、OS マニュアルの Markdown を直すだけなら、PWA secrets はなくても作業できる。
ただし full PWA build / local preview / deploy までやるなら、`pwa/.env.local` と `pwa/.env.production.local`、Vercel link が必要になる。

PWA 依存を復元する。

```sh
cd pwa
npm ci
npm run test:critical-ui
npm run build
```

ローカルで見たい場合:

```sh
npm run dev
```

## 5. きよAIに渡す最初の prompt

```text
AMD OS の OSマニュアルを、きよ視点で分かりやすくブラッシュアップしたい。

まず以下を読んで current truth を確認して:
- AGENTS.md
- CLAUDE.md
- SETUP_NEW_MAC.md
- manual-review/KIYO_PC_SETUP.md
- pwa/AGENTS.md
- pwa/CLAUDE.md
- pwa/design/os_manual.md
- pwa/manual/00-intro.md
- pwa/manual/08-member-quick-start.md
- pwa/manual/10-member-workflows-quick-start.md
- pwa/manual/01-pj-cockpit.md
- pwa/manual/22-notifications-and-tsukuyomi.md

目的は、ユーザー向けマニュアルを「初めて触る AMD メンバーが迷わず使える」状態にすること。
まずはコードを触らず、分かりにくい章・順番が変な章・言葉が怖い章・ユーザー向けに裏事情が混ざっている箇所を洗い出して。

その後、必要な箇所だけ `pwa/manual/*.md` を直接直して。
章構成・UI・audience 分離の方針を変える必要がある場合だけ `pwa/design/os_manual.md` も更新して。

変更後は:
- npm run test:critical-ui
- npm run build

まで確認して、変更内容と残課題を短くまとめて。
本番 deploy はまさPC / えいみ側でやるので、きよPCから勝手に deploy しない。
```

## 6. レビュー結果の残し方

小さい文言修正は、該当する `pwa/manual/*.md` を直接直す。

大きい構成相談や未確定メモは、repo root に次の形で置く。

```text
manual-review/kiyo-notes-YYYY-MM-DD.md
```

書き方:

```md
# きよ OSマニュアルレビュー YYYY-MM-DD

## まず直した方がよさそう

- 対象: `pwa/manual/00-intro.md`
  - 気になる点:
  - 直し案:

## あとで相談

- 対象:
  - 論点:
```

## 7. きよPCから戻す時

```sh
git status -s
git add pwa/manual pwa/design/os_manual.md manual-review
git commit -m "docs(manual): brush up os manual from kiyo review"
git push origin kiyo/os-manual-brushup
```

push 後、まさPC / えいみに branch 名を渡す。

