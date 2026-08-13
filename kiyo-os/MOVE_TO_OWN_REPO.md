# このフォルダを kiyo-os リポジトリへ移す手順

**この `kiyo-os/` フォルダは、amd-os の中に「一時的に」置いてあります。**

理由: このクラウドセッションは `masa-teamarmada/amd-os` に固定されていて、
GitHub の新しいリポジトリを作る権限がありませんでした（API が 403 を返す）。
成果物を失わないよう、いったん amd-os の作業ブランチに退避しています。

**amd-os の `main` には入っていません。** 入っているのは
`claude/kiyo-os-dev-setup-zf3mpo` ブランチだけです。

---

## 手順（まさ）

### ステップ 1. 空のリポジトリを作る

ブラウザで **https://github.com/new** を開いて:

| 項目 | 入れるもの |
|---|---|
| Repository name | `kiyo-os` |
| Description | `きよ専用OS — まさ×きよ 共同開発` |
| 公開設定 | **Private** を選ぶ |
| Add a README file | **チェックしない** |
| Add .gitignore | **None のまま** |
| Choose a license | **None のまま** |

→ 緑の **Create repository** を押す。

**中身は空っぽのままで大丈夫です。** 次のステップで全部入ります。

### ステップ 2-A. えいみにやってもらう（かんたん）

リポジトリを作ったら、このセッションに **「kiyo-os 作ったよ」** と返信するだけ。
えいみが中身を全部 push します。

### ステップ 2-B. 自分でやる場合（Mac のターミナル）

```sh
cd ~/projects/AMD/amd-os
git fetch origin claude/kiyo-os-dev-setup-zf3mpo

# kiyo-os フォルダだけを取り出す
mkdir -p ~/projects/kiyo-os
git archive origin/claude/kiyo-os-dev-setup-zf3mpo kiyo-os \
  | tar -x --strip-components=1 -C ~/projects/kiyo-os

# 新しいリポジトリとして push
cd ~/projects/kiyo-os
rm -f MOVE_TO_OWN_REPO.md          # この手順書はもう要らない
git init -b main
bash scripts/install-main-only-git-hook.sh
git add -A
git commit -m "feat: きよOS 初期セットアップ（骨組み + 共同開発ルール）

Worked-by: masa"
git remote add origin https://github.com/masa-teamarmada/kiyo-os.git
git push -u origin main
```

### ステップ 3. amd-os 側の後片付け

kiyo-os リポジトリに中身が入ったのを確認してから:

```sh
cd ~/projects/AMD/amd-os
git push origin --delete claude/kiyo-os-dev-setup-zf3mpo
```

これで amd-os から一時ブランチが消えます。
**amd-os の main は最初から一度も触っていません。**

### ステップ 4. きよのクラウド環境に追加

きよが claude.ai/code から使えるように、Claude Code の環境設定で
`masa-teamarmada/kiyo-os` を使えるようにする。
その後、きよに [`SETUP_KIYO.md`](SETUP_KIYO.md) を渡す。

---

## 確認: 移し終わったら

- [ ] `https://github.com/masa-teamarmada/kiyo-os` に中身が入っている
- [ ] `AGENTS.common.md` がリポジトリのトップに見えている
- [ ] amd-os の一時ブランチを消した
- [ ] amd-os の `main` に kiyo-os が入っていない（`git log origin/main -- kiyo-os` が空）
- [ ] この `MOVE_TO_OWN_REPO.md` を kiyo-os から削除した
