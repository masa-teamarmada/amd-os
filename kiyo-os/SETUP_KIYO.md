# SETUP_KIYO.md — きよが開発を始めるまで

きよ向けの手順書。**開発の知識は要りません。** 上から順にやれば動きます。

---

## どっちの方法でやる？

| | A. ブラウザだけ（おすすめ） | B. 自分の PC にインストール |
|---|---|---|
| 準備 | ほぼ不要 | Git と Node.js を入れる |
| 場所 | claude.ai/code | Windows PC |
| 向いてる用途 | ふだんの作業 | 画面を手元でぐりぐり試したいとき |

**まずは A だけでいいです。** B は必要になってからで大丈夫。

---

## A. ブラウザだけで開発する（おすすめ）

1. ブラウザで **https://claude.ai/code** を開く
2. まさのアカウントでログインする（アカウントはまさと共有）
3. 新しいセッションを作る画面で、リポジトリに **`masa-teamarmada/kiyo-os`** を選ぶ
4. 最初のメッセージにこれを貼る:

   ```
   AGENTS.common.md を読んでから作業して。私はきよです。
   ```

5. あとは日本語で「こういう画面がほしい」と話すだけ。えいみが作ります。

**きよがやること**: 何が欲しいかを言うこと。コマンドを覚える必要はありません。

> リポジトリの一覧に `kiyo-os` が出てこないときは、まさに
> 「Claude Code の環境に kiyo-os を追加して」と伝えてください。

---

## B. Windows PC に入れて動かす

### B-1. 必要なものを入れる

PowerShell を開いて（スタートメニューで「PowerShell」と検索）、1 行ずつ実行します。

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
```

インストールが終わったら、**PowerShell を一度閉じて開き直します**（これをしないと反映されません）。

確認:

```powershell
git --version
node -v
```

`git version 2.x.x` と `v22.x.x`（以上）が出れば成功です。

### B-2. リポジトリを持ってくる

```powershell
New-Item -ItemType Directory -Force -Path "$HOME\projects"
Set-Location "$HOME\projects"
git clone https://github.com/masa-teamarmada/kiyo-os.git
Set-Location "$HOME\projects\kiyo-os"
```

途中で GitHub のログインを求められたら、ブラウザが開くので、まさのアカウントでログインしてください。
**パスワードやコードをチャットや file に貼らないでください。**

### B-3. 動かす

```powershell
npm.cmd install
npm.cmd run dev
```

`npm install` は 3 分くらいかかります。終わったら、ブラウザで
**http://localhost:3000** を開くと画面が出ます。

止めるときは PowerShell で `Ctrl` + `C`。

### B-4. ブランチを作らない設定を入れる（1回だけ）

```powershell
& "C:\Program Files\Git\bin\bash.exe" scripts/install-main-only-git-hook.sh
```

「うっかり枝分かれを作ってしまう」事故を防ぐためのものです。

---

## 作業のはじめと終わり（毎回)

### はじめ

```powershell
git pull origin main
```

まさが先に何か直しているかもしれないので、**触る前に必ず**これをします。

### おわり

```powershell
git add <さわったファイル>
git commit -m "feat: やったことを1行で

Worked-by: kiyo"
git push origin main
```

**その日のうちに必ず push してください。** push していない作業は、まさからは見えません。

> `git add .` は使わないでください（関係ないファイルまで巻き込むため）。
> ブラウザ（A の方法）で作業している場合は、えいみが代わりにやります。

---

## 困ったとき

- エラーが出た → **メッセージをそのままコピーして、えいみに貼る**。自分で直そうとしなくて大丈夫
- 何を作ればいいか分からない → `docs/INTAKE.md` を開いて、思いつくことを書き足す
- 画面が真っ白 → PowerShell に赤い文字が出ていないか見て、そのまま貼る
- どうしようもない → まさに聞く

## やってはいけないこと

- パスワード・API キー・トークンをファイルやチャットに書く
- `git push --force` を使う
- よく分からない変更を「消せば直る」で消す（まさの作業かもしれません）
