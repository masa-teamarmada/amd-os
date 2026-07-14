# Book A 組版技術検証 引き継ぎプロンプト (2026-07-14 Claude Code (えいみ) → Codex CLI)

*作成: 2026-07-14 (Claude Code / えいみ)。これは Codex CLI (このモノレポで並行稼働する別の AI コーディングツール) 向けに書いた、単体で完結する作業プロンプト。このファイル1本を読めば、他セッションの会話履歴を参照しなくても着手できるように書いてある。担当は Book A (自費出版準備中の書籍、製本版 + Kindle 版の両対応、A5判・総480〜550p想定・LaTeX数式を全編で多用する専門書) の**組版パイプライン技術検証**。出版経路・名義・ISBN取得要否 (R1、3点) はまさ (プロジェクトオーナー) の判断待ちで止まっているが、組版パイプラインの技術検証は原稿の中身とは無関係な純技術検証であり、`BOOK_A_PUBLISHING_PLAN.md` §6 工程表に「今すぐ (T0 前倒し可) = 組版技術検証」と明記されている通り R1 の結論を待たずに今すぐ着手してよい。Claude 側のトークン節約も目的の一つで、このタスクを Codex CLI に切り出した。まさの判断待ちなしで、今すぐ着手してよいタスク。*

---

## 最初に読む (この順)

1. `/Users/masa/projects/AGENTS.common.md` — えいみ共通ルール正本 (人格・共通ルール・安全運用・記憶管理)。プレーンな md ファイルなので Codex CLI からも読める。飛ばさない
2. **(参考情報、読めれば)** `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — Claude Code (えいみ) 側の AMD level memory 索引。Codex CLI の実行環境からは `~/.claude/` 配下を読めない可能性があるため必須ではない。読めなくてもこのタスクの着手・完了には影響しない (このプロンプト単体で自己完結するように設計してある)
3. `/Users/masa/projects/AMD/amd-os/CLAUDE.md` — モノレポ全体ルール。特に「ブランチ作成は全面禁止」「commit したら即 push」
4. `/Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md` — PWA固有ルール。このタスクは Next.js アプリ本体や Vercel deploy には一切触れないが、bzm はこのディレクトリ配下にあるため、git fetch/push の運用部分だけ把握しておく (DDL適用・Vercel deploy・build version bump 等のアプリ運用記述はこのタスクには無関係)
5. `/Users/masa/projects/AMD/amd-os/pwa/bzm/BOOK_A_PUBLISHING_PLAN.md` — Book A 出版実務を統括する唯一の正本。このタスクの成果物もここに書き戻す。特に **§3.3 判型・仕様** (背幅概算の現状値)・**§3.4 組版パイプライン**・**§4 組版技術検証ログ** (検証結果の書き戻し先、2026-07-14時点で185〜193行目付近)・**§6 工程表** (このタスクが R1 確定を待たず今すぐ着手してよい根拠、210〜222行目付近) を読む
6. `/Users/masa/projects/AMD/amd-os/pwa/bzm/COMMANDER_TASKS.md` — Book A 出版の進捗を一望する司令塔ボード。「ストリーム K」(自費出版実務、2026-07-14時点で133〜139行目) が該当行

**注意**: `BOOK_A_PUBLISHING_PLAN.md` と `COMMANDER_TASKS.md` は複数セッションが並行して触っているため、上記の行番号や引用文は着手時には多少ズレている可能性がある。実際に開いて現物を確認してから進めること。

## 現在の状態スナップショット

- **リポジトリ**: `github.com/masa-teamarmada/amd-os` monorepo。ブランチ作成は全面禁止、`main` 一本で直接 commit・push する運用
- **直近 commit** (2026-07-14時点、このハンドオフ書き直し直前): `97d2ab83` (`docs(bzm): Codex CLI 向け組版技術検証タスクの引き継ぎプロンプト追加` — このファイル自体を main に追加した commit)。並行セッションが同じ main へ push し続けているため、着手前に必ず `git fetch origin main && git log --oneline -5 origin/main` で最新化すること
- **dirty**: このハンドオフ書き直し時点で `pwa/bzm/` 配下に他セッション由来の未追跡ファイルが存在する場合があるが、いずれもこのタスクの対象外。**このタスクで stage するのは自分が触ったファイルだけ**にする (`git add .` は禁止)
- **worktree/branch**: 専用 worktree は無し。root checkout (`/Users/masa/projects/AMD/amd-os`) 上で `main` を直接編集する運用。Codex 側も新規 worktree/branch を作らず、同じ運用に従うこと (詳細は末尾「このセッションで作った branch/worktree」)
- **今回の担当範囲**: Book A 出版準備ストリーム (K) のうち、**組版パイプラインの技術的挙動の検証のみ**。原稿本文 (章の中身) には一切触れない。出版経路確定 (R1)・ISBN申請などまさ判断待ちの論点はこのタスクの範囲外
- **この検証の位置づけ**: 検証結果は、後続の意思決定 (R2-2: Kindle 形式をリフロー+数式画像にするか固定レイアウトにするか / R2-3: 組版パイプライン確定 / R3-1: 表紙の背幅計算) の一次材料になる
- **環境確認結果** (このマシンで確認済み、2026-07-14時点):
  - `pandoc` は導入済み: `/Users/masa/.local/bin/pandoc` (v3.9.0.2)
  - **LuaLaTeX / XeLaTeX / pdfLaTeX 等の TeX 処理系は未導入** (`lualatex` command not found)
  - Homebrew (`brew`) は未導入。MacPorts も未導入
  - ネットワーク疎通は正常 (CTAN ミラーへの到達を確認済み)
  - マシンは Apple Silicon (arm64)、macOS 26.5.1、ディスク空き 500GB+ — 容量は問題にならない

## 検証タスク詳細

### STEP 0: 環境構築 (TeX 処理系の導入)

Homebrew が無いので、CTAN 配布の **BasicTeX** (最小構成インストーラ) を直接落として入れるのが最短:

```sh
curl -L -o /tmp/BasicTeX.pkg https://mirror.ctan.org/systems/mac/mactex/BasicTeX.pkg
sudo installer -pkg /tmp/BasicTeX.pkg -target /
eval "$(/usr/libexec/path_helper)"   # PATH に /Library/TeX/texbin を通す
sudo tlmgr update --self
sudo tlmgr install collection-langjapanese luatexja jlreq
```

- `jlreq` (日本語ドキュメントクラス) と `luatexja` (LuaLaTeX 日本語エンジン、ltjsbook 系クラス同梱) は CTAN 上の実在パッケージ名として確認済み。`collection-langjapanese` で日本語フォント・パッケージ一式が入る。
- 和文フォント: macOS 標準搭載のヒラギノ (Hiragino) を LuaLaTeX から使うのが一般的 (`luatexja-preset` の `hiragino-pron` 等)。フォント関連のエラーが出たらまずここを疑う。
- **重要**: `sudo installer` / `sudo tlmgr` は管理者権限が要る。Codex の実行環境で sudo が使えない・パスワード入力が挟まって自動化できない場合、それ自体を「詰まった箇所」として下記「完了条件・書き戻し先」に明記し、TeX が無くてもできる範囲 (pandoc 単体の変換確認、EPUB3 構造検証など) だけ進めて報告してよい。**完走を無理強いしない** — どこまで到達したか・何が具体的な障害だったかを正確に書き残すことの方が価値がある。

### 対象ファイル

`/Users/masa/projects/AMD/amd-os/pwa/bzm/book-a-ch-8.md`(Book A の中で数式密度が最も高い章。検証対象として最も厳しい条件になるため選定済み)。**読み取り専用として扱う。変換の入力に使うだけで絶対に編集しない。**

このファイルについて事前に把握しておくこと:
- 約344行・60KB。見出し構造は `# 第8章 ...` → `## 8.0`〜`## 8.9` + 演習・到達目標等。
- 数式は `$...$` (インライン) と別行立ての標準 LaTeX 記法。
- 表は標準 markdown テーブル記法 (`|...|`) が18行分ある。
- **図は実在しない**: `![...]` のような画像埋め込み構文は本章に一つも無い。Book A は図版生成にまだ着手しておらず (`COMMANDER_TASKS.md` ストリーム G が `not-started`)、その代わりに `[図8-1: ...説明文...]` のような**角カッコで囲んだ説明文のプレースホルダ**が地の文に埋め込まれている。以下のタスクで言う「図参照の検証」は、**実画像の埋め込み・配置ではなく、この角カッコ付きプレースホルダ文字列が改行・折り返し・EPUB表示上どう振る舞うかの確認**を指す。実画像ファイルを探す・用意する必要は無い。

### タスク (a): pandoc + LuaLaTeX で A5 印刷用 PDF 化

```sh
pandoc /Users/masa/projects/AMD/amd-os/pwa/bzm/book-a-ch-8.md \
  -o <作業ディレクトリ>/ch8-a5.pdf \
  --pdf-engine=lualatex \
  -V documentclass=ltjsbook \
  -V classoption=a5paper
```

これは出発点の一例。`ltjsbook` が使えなければ `jlreq` を `-V documentclass=jlreq` で試す。**pandoc のデフォルト LaTeX テンプレートは和文クラスと相性が悪いことがある** (プリアンブルの二重読み込み等でコケることがある) — 詰まったら `pandoc ... -t latex -s -o ch8.tex` で中間 `.tex` を出力し、プリアンブルを手で調整してから `lualatex ch8.tex` を直接叩く方法に切り替えてよい。オプションは試行錯誤して構わない — 最終的に**通ったコマンドをそのまま「完了条件・書き戻し先」に書き残す**ことが目的。

確認すること:
- 数式 (インライン・別行立て) が正しく組版されるか。エラーで落ちる数式表現があるか。
- 表が崩れず入るか。
- `[図8-N: ...]` プレースホルダ文字列が不自然に改ページ・分断されないか。
- 日本語の禁則処理・見出し階層・目次生成が自然か。
- A5 判で余白・版面が破綻しないか。

### タスク (b): EPUB3 化 + 数式表示の判断材料集め

```sh
pandoc /Users/masa/projects/AMD/amd-os/pwa/bzm/book-a-ch-8.md \
  -o <作業ディレクトリ>/ch8-mathml.epub \
  --mathml

# 比較用に数式を画像化する版も試す
pandoc /Users/masa/projects/AMD/amd-os/pwa/bzm/book-a-ch-8.md \
  -o <作業ディレクトリ>/ch8-webtex.epub \
  --webtex
```

- **Kindle Previewer** (Amazon 公式ツール) がマシンに入っていれば、それで開いて数式表示を確認するのが理想。入っていなければ無理にインストールする必要はない (アカウント等が絡む可能性があるため) — 代わりに **EPUB3 として構造的に valid か** (`epubcheck` があれば使う、無ければ pandoc 変換が warning/error なく通るか・macOS の「ブック」アプリ等の主要 EPUB リーダーで開けるか) を代替の確認手段とする。
- 目的: 「MathML によるリフロー数式表示」vs「数式を画像化してリフロー本文に埋め込む」のどちらが Book A 級の数式密度で実用に耐えるかの一次判断材料を得ること。両方試して比較所感を書く。

### タスク (c): ページ数実測 → 全体見積り → 背幅計算

- タスク (a) で生成した PDF の実ページ数を数える (`pdfinfo` 等)。
- 第8章の実測ページ数から、Book A 全体 (想定480〜550p、全16章) の精度を上げた見積りを出す。
- 背幅計算: `BOOK_A_PUBLISHING_PLAN.md` §3.3 に「550p級の紙厚: 背幅概算25〜30mm (要検証、用紙依存)」とある。実測ページ数を使って、より精密な概算式・数値を出す (一般的な書籍用紙の連量を仮定してよい。KDP ペーパーバック公式ヘルプに紙厚の目安値がある — URL は `BOOK_A_PUBLISHING_PLAN.md` §3.0 に既出)。

### 完了条件・書き戻し先

以下を全部やって初めて完了。

1. **`BOOK_A_PUBLISHING_PLAN.md` の `## 4. 組版技術検証ログ` に追記** (2026-07-14 時点で187〜192行目付近、「(未着手。着手したら日付・検証内容・結果・判明した制約をここに追記する)」というプレースホルダ文になっている箇所):
   - 日付
   - 何を試したか (実行した pandoc/LuaLaTeX コマンドの実例つきで)
   - 結果 (通った/落ちた、見た目の所感)
   - 判明した制約・注意点 (例: 特定の LaTeX 記法が非対応だった、フォント設定が要る、等)
   - タスク(c) のページ数実測・背幅計算の数値
   - **詰まった場合はどこまで到達したか・何が具体的な障害だったかを明記** (完走を無理強いしない)
   - 同じファイル末尾の `## Changelog` 表 (2026-07-14 時点で240行目付近、書式は `| Date | What | By |`) にも1行追記する。
2. **`COMMANDER_TASKS.md` のストリーム K セクションを1行更新** (2026-07-14 時点で133〜139行目、`### K. 自費出版実務 (PF-015 §7-17) — 出版準備ストリーム稼働開始 (2026-07-13)` 節):
   - 「次アクション」の一文を、組版技術検証が着手・完了 (or 部分完了) した旨を反映して更新する (例:「組版技術検証 (Ch8級) 着手・完了。結果は `BOOK_A_PUBLISHING_PLAN.md` §4 参照。次アクションは...」のように簡潔な1行で)。
   - **詳細ログをここに貼らない** — この盤の運用ルールは「1行 = ストリーム/状態/担当/次アクション/まさ要判断」だけ、詳細は正本ファイル側 (`BOOK_A_PUBLISHING_PLAN.md` §4) に置く。
3. **commit & push**:
   - `main` で直接 commit (ブランチ禁止)。
   - push 前に `git fetch origin main` を必ず実行、rejected なら `git pull --rebase --autostash` → 再push。
   - commit message は日本語で簡潔に。例: `docs(bzm): Book A 組版技術検証ログ追記 (pandoc+LuaLaTeX A5 PDF / EPUB3 検証)`
   - 生成 PDF/EPUB バイナリは絶対に `git add` しない (下記「生成物の扱い」厳守)。

### 詰まったときの心構え

- TeX 環境構築で管理者権限が無くて止まった、特定の数式が変換エラーになった、Kindle Previewer が使えない、等の障害は**失敗ではなく検証結果そのもの**。「何をどこまで試して、何が具体的な障害だったか」を正直に「完了条件・書き戻し先」に書けば、それがこのタスクの価値ある成果になる。無理に全部を完走させようとして時間を溶かすより、正確な記録を残すことを優先する。
- このファイル外の会話履歴やまさへの質問には頼れない前提で、書いてある情報の範囲内で合理的に判断して進める (自己完結タスクとして設計されている)。

## このPJで確立済みの運用ルール

### 絶対に守ること (スコープ限定・例外なし)

1. **原稿の中身に一切触れない**: 章本文 (`book-a-ch-*.md` の文章・数式内容・図版プレースホルダの記述内容) を一文字も書き換えない。読んで変換テストの入力に使うだけ。誤字等に気づいても直さず、検証ログに書き添える程度に留める。
2. **検証対象は組版パイプラインの技術的挙動だけ**: 「pandoc / LuaLaTeX / EPUB 変換がどう動くか」を確認するタスク。「本の内容がどうか」には一切踏み込まない・コメントしない。
3. **禁止語彙** (Book A 全体の用語統一ルール):
   - 「鬼門」は使わない。その概念に触れる必要が万一あれば「不可逆点」を使う。
   - 社内コードネーム (「BZM」「Book B」「PF-xxx」等の PJ 略称) を書かない。プロジェクト名は常に「Book A」と書く。
   - これは検証ログ本文・commit message の両方に適用する。
4. **ブランチを作らない**: このリポジトリ (`amd-os` monorepo) はブランチ作成を全面禁止している。**必ず `main` で直接作業し、直接 commit・push する**。一時ブランチも例外なく禁止。
5. **生成物 (PDF/EPUB プロトタイプ) をリポジトリに commit しない** (詳細は次項)。
6. **1機能 = 1 commit**、commit の度に push。環境構築・タスクa・タスクb・タスクc・正本反映で分けても、まとめても良い (判断は Codex に任せる)。
7. **fetch を挟む**: 着手前に `git fetch origin main && git status -s` で作業ツリーが最新かを確認 (並行稼働セッションが多いため)。push 前にも必ず `git fetch origin main`。rejected されたら `git pull --rebase --autostash` → 再度 push。
8. bzm 配下ファイルの commit・push は事前承認不要。このタスクの範囲内 (既存ロジック削除や本番データ操作を伴わない) なら、まさに確認を取らずそのまま進めてよい。

### 生成物の扱い (置き場所ルール、厳守)

- PDF/EPUB のプロトタイプ・中間ファイルは**このリポジトリの外**に置く。例: `/tmp/book-a-typesetting-verification/` や `$HOME/book-a-typesetting-verification/` 等、都合の良い場所でよい。
- **リポジトリ内には生成バイナリを一切置かない** (`git add` の対象にしない)。このリポジトリは軽量な md ベースの正本管理が前提で、大きいバイナリを履歴に混ぜたくない。
- リポジトリに書き戻すのは**テキストのログ・数値・所感だけ** (上記「完了条件・書き戻し先」参照)。

以上の内容で着手してよい。まさへの追加確認は不要 — このファイル単体で完結するように設計されている。

## このセッションで作った branch/worktree

なし。このハンドオフの書き直しは root checkout (`/Users/masa/projects/AMD/amd-os`) 上での `main` 直接編集のみで、新規 branch/worktree は作っていない。Codex 側がこの後どう作業するかは Codex 自身の実行環境の裁量だが、上記「絶対に守ること」4番の通り、このリポジトリではブランチ作成が全面禁止されている — Codex も新規ブランチは作らないこと。

---

*最終更新日: 2026-07-14*
