# Book A 組版技術検証 round2 引き継ぎプロンプト (2026-07-15 Claude Code (えいみ) → Codex CLI)

*作成: 2026-07-15 (Claude Code / えいみ)。これは Codex CLI (このモノレポで並行稼働する別の AI コーディングツール) 向けに書いた、単体で完結する作業プロンプト。このファイル1本を読めば、他セッションの会話履歴を参照しなくても着手できるように書いてある。担当は Book A (自費出版準備中の書籍、製本版 + Kindle 版の両対応、A5判・総480〜550p想定・LaTeX数式を全編で多用する専門書) の**組版パイプライン技術検証 round2**。round1 (`2026-07-14_codex_handoff_typesetting_verification.md`、実施結果は `BOOK_A_PUBLISHING_PLAN.md` §4) で pandoc + LuaLaTeX による A5 印刷用 PDF 化と EPUB3 化 (MathML版・webtex版) の一次検証が完了し、そこで5件の残課題が判明した。この round2 はその5課題 ((a) epubcheck 導入・実施、(b) 8.5節の長い underbrace 数式2本の overfull hbox 解消、(c) EPUB webtex 版の外部 Codecogs 依存解消、(d) 図プレースホルダ→実画像埋め込み配管の検証、(e) 柱・ノンブル・目次・奥付など本番テンプレ要素の技術検証) を潰す作業。出版経路・名義・ISBN取得要否 (R1、3点) は既にまさ確定済み (D-PUB-001〜004、`BOOK_A_PUBLISHING_PLAN.md` §1) だが、本タスクはそれとも無関係な純粋な組版パイプライン技術検証であり、今すぐ着手してよい。Claude 側のトークン節約も目的の一つで、このタスクを Codex CLI に切り出した。まさの判断待ちなしで、今すぐ着手してよいタスク。*

---

## 最初に読む (この順)

1. `/Users/masa/projects/AGENTS.common.md` — えいみ共通ルール正本 (人格・共通ルール・安全運用・記憶管理)。プレーンな md ファイルなので Codex CLI からも読める。飛ばさない
2. **(参考情報、読めれば)** `/Users/masa/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/MEMORY.md` — Claude Code (えいみ) 側の AMD level memory 索引。Codex CLI の実行環境からは `~/.claude/` 配下を読めない可能性があるため必須ではない。読めなくてもこのタスクの着手・完了には影響しない
3. `/Users/masa/projects/AMD/amd-os/CLAUDE.md` — モノレポ全体ルール。特に「ブランチ作成は全面禁止」「commit したら即 push」
4. `/Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md` — PWA固有ルール。このタスクは Next.js アプリ本体や Vercel deploy には一切触れないが、bzm はこのディレクトリ配下にあるため、git fetch/push の運用部分だけ把握しておく (DDL適用・Vercel deploy・build version bump 等のアプリ運用記述はこのタスクには無関係)
5. **`/Users/masa/projects/AMD/amd-os/pwa/bzm/2026-07-14_codex_handoff_typesetting_verification.md`** — round1 の migration prompt そのもの。round2 はこの続きなので、前回どういう環境構築をしたか・どういう運用ルールで動いたか・`book-a-ch-8.md` 全体の構造 (見出し階層、数式記法、表の数など) をまず把握する。**「実際に何が起きたか」の記録はこのファイルではなく次項の `BOOK_A_PUBLISHING_PLAN.md` §4 にある** (このファイルは着手前に書かれた計画書)
6. `/Users/masa/projects/AMD/amd-os/pwa/bzm/BOOK_A_PUBLISHING_PLAN.md` — Book A 出版実務を統括する唯一の正本。このタスクの成果物もここに書き戻す。特に **§4 組版技術検証ログ** (round1 の実施結果。2026-07-15時点で192〜205行目付近、`### 2026-07-15 Ch8 技術検証 (数式最重量級サンプル)` という見出し) を熟読すること — 今回の5課題は全てこのログの「次の処置」から派生している。あわせて **§3.3 判型・仕様**・**§3.4 組版パイプライン** も目を通す
7. `/Users/masa/projects/AMD/amd-os/pwa/bzm/COMMANDER_TASKS.md` — Book A 出版の進捗を一望する司令塔ボード。「ストリーム K」(自費出版実務、2026-07-15時点で134〜143行目、`### K. 自費出版実務 (PF-015 §7-17) — 出版準備ストリーム稼働開始 (2026-07-13)` という見出し) が該当行
8. `/Users/masa/projects/AMD/amd-os/pwa/bzm/book-a-ch-8.md` — round1・round2共通の検証対象ファイル。**読み取り専用として扱う。絶対に編集しない**(詳細は後述)

**注意**: `BOOK_A_PUBLISHING_PLAN.md` と `COMMANDER_TASKS.md` は複数セッションが並行して触っているため、上記の行番号や引用文は着手時には多少ズレている可能性がある。実際に開いて現物を確認してから進めること (見出しテキストで検索すれば行番号のズレは問題にならない)。

## 現在の状態スナップショット

- **リポジトリ**: `github.com/masa-teamarmada/amd-os` monorepo。ブランチ作成は全面禁止、`main` 一本で直接 commit・push する運用
- **直近 commit** (2026-07-15時点、このハンドオフ作成直前): `1fdbf21b` (`docs(bzm): Book A組版技術検証ログを記録`)。並行セッションが同じ main へ push し続けているため、着手前に必ず `git fetch origin main && git log --oneline -5 origin/main` で最新化すること
- **dirty**: このハンドオフ作成時点で `pwa/bzm/` 配下に他セッション由来の未追跡ファイル (例: frontmatter 関連の下書き) が存在する場合があるが、いずれもこのタスクの対象外。**このタスクで stage するのは自分が触ったファイルだけ**にする (`git add .` は禁止)
- **worktree/branch**: 専用 worktree は無し。root checkout (`/Users/masa/projects/AMD/amd-os`) 上で `main` を直接編集する運用。Codex 側も新規 worktree/branch を作らず、同じ運用に従うこと (詳細は末尾「このセッションで作った branch/worktree」)
- **今回の担当範囲**: Book A 出版準備ストリーム (K) のうち、round1 で洗い出された **5件の残課題 (a)〜(e) の技術的検証のみ**。原稿本文 (章の中身・図の実際のビジュアル内容) には一切触れない。出版経路確定・ISBN申請などまさ判断待ちの論点、および図版の実際のデザイン生成 (ストリーム G の担当) はこのタスクの範囲外
- **環境確認結果** (2026-07-15時点、このハンドオフ作成にあたって実マシンで確認済み):
  - `pandoc` は導入済み: `/Users/masa/.local/bin/pandoc` (v3.9.0.2、`+server +lua` 付き)
  - **TinyTeX 導入済み**: `/Users/masa/Library/TinyTeX`。`lualatex` は `/Users/masa/Library/TinyTeX/bin/universal-darwin/lualatex` で実行可能。round1 で `collection-langjapanese` / `luatexja` / `jlreq` を user-local 追加済み
  - **Java (JDK) は不在**: `/usr/bin/java` はパススタブのみ存在し、実行すると `Unable to locate a Java Runtime` で exit code 1。タスク (a) の epubcheck 実施には JDK の user-local 導入が必須
  - **Homebrew (`brew`) は不在**。MacPorts も不在。sudo 前提のインストーラも極力避け、user-local 導入を優先すること (round1 の TinyTeX 導入と同じ思想)
  - **`dvisvgm` / `dvipng` は TinyTeX 配下に不在** (`find /Users/masa/Library/TinyTeX/bin -iname "*dvisvgm*" -o -iname "*dvipng*"` で該当なし)。タスク (c) で使う可能性があるため、必要なら `tlmgr install` で追加する
  - **`gladtex` は不在** (`which gladtex` で未検出)。タスク (c) の候補ツール、要導入検証
  - **`epubcheck` は不在** (`which` / `find` で未検出)
  - **round1 の生成物が `/tmp/book-a-typesetting-verification-20260715/` に残存している** (このハンドオフ作成時点で確認済み): `ch8-a5-ltjsbook.pdf` / `ch8-ltjsbook.tex` / `ch8-ltjsbook.log` / `ch8-mathml.epub` / `ch8-webtex.epub` 等。特に **`ch8-ltjsbook.tex`** は pandoc が吐いた中間 `.tex` ファイルで、タスク (b)/(d)/(e) のように LaTeX プリアンブルや本文を直接いじる検証の出発点として再利用できる可能性が高い。ただし `/tmp` は揮発領域なので、着手時に消えていたら `BOOK_A_PUBLISHING_PLAN.md` §4 ログに書いてあるコマンド例から再生成すればよい (再生成コストは低い)

## 検証タスク詳細

### STEP 0: 環境構築

#### 0-1. JDK の user-local 導入 (タスク (a) に必須)

sudo・Homebrew を使わず、round1 の TinyTeX 導入と同じ思想で user-local に入れる。Eclipse Temurin (Adoptium) の「常に最新の LTS を返す」API エンドポイントを使うのが一例:

```sh
mkdir -p ~/.local/jdk
curl -L -o /tmp/temurin-jdk.tar.gz \
  "https://api.adoptium.net/v3/binary/latest/21/ga/mac/aarch64/jdk/hotspot/normal/eclipse"
tar -xzf /tmp/temurin-jdk.tar.gz -C ~/.local/jdk
# macOS版のTemurin tar.gzは、展開後の内部が `<展開先>/jdk-XX.../Contents/Home/bin/java` という
# mac標準のバンドル構造になっていることが多い。展開後 `find ~/.local/jdk -name java -type f` 等で
# 実際のbinパスを確認してからJAVA_HOMEを組み立てること。
export JAVA_HOME="$(dirname "$(dirname "$(find ~/.local/jdk -name java -type f | head -1)")")"
export PATH="$JAVA_HOME/bin:$PATH"
java -version   # ここで動けばOK。シェルセッション内で有効なら十分、永続化は不要
```

これは出発点の一例。`21` の URL が失敗する (network 制限・エンドポイント仕様変更等) 場合は `17` / `11` / `8` 等の別バージョン番号で試してよい — epubcheck の実行には JDK 8 以上であればどれでも十分。Adoptium 以外の配布元 (Azul Zulu 等) を使っても構わない。ここで完全にブロックされた場合は「詰まった箇所」として正直に記録し、タスク (a) 以外を先に進めてよい (完走を無理強いしない、詳細は後述)。

#### 0-2. dvisvgm / dvipng の追加 (タスク (c) で使う可能性)

```sh
# TinyTeXのtlmgrで追加を試す (round1でjlreq等を追加したのと同じ要領)
tlmgr install dvisvgm dvipng gladtex
```

`gladtex` が tlmgr 経由で入らなければ、他の配布経路 (pip 等) も試してよい。全滅した場合はタスク (c) の「候補アプローチ2」(standalone クラス + dvisvgm 手動パイプライン) に切り替える。

### 対象ファイルについて (補足)

`/Users/masa/projects/AMD/amd-os/pwa/bzm/book-a-ch-8.md`。**read-only。絶対に編集しない** — 検証は repo 外の作業コピー、または pandoc が生成した中間 `.tex`/`.epub` 側で行う。全体構造 (344行、見出し階層、数式記法、表の数など) は round1 プロンプト (最初に読む 5番) に詳しいので、ここでは今回の5課題に直接関係する具体的な行だけを示す (2026-07-15時点、`wc -l` で344行確認済み。他セッションが手を入れていなければ以下の行番号は変わらないはずだが、着手時に念のため該当見出し文字列で grep して確認すること)。

- **8.5節** (155行目 `## 8.5 じわじわと、突然と——軌跡を動かす三つの力`) 内、165行目・167行目に overfull hbox の原因になっている underbrace 数式2本 (タスク (b) の対象、原文は後述)
- **8.7節** (228行目 `## 8.7 余力で、到達度を買う——交換レートと、手を緩めさせる目標`) 内、234行目に webtex 変換が失敗する数式1本 (タスク (c) の対象、原文は後述)
- 図プレースホルダは章内に4箇所 (`[図8-N: ...]` という角カッコ書式、実画像は無い): 99行目 (図8-1)・183行目 (図8-2)・203行目 (図8-3)・254行目 (図8-4)。本文中にこれらを指す「(図8-1参照)」のような相互参照テキストは現状存在しない (プレースホルダ行自体が唯一の言及)

### タスク (a): epubcheck で EPUB 2種を検証

STEP 0-1 で JDK を導入した後、epubcheck 本体を入れる (Java の jar を実行するだけなのでビルド不要):

```sh
mkdir -p /tmp/book-a-typesetting-verification-round2
cd /tmp/book-a-typesetting-verification-round2

# 最新リリースのzip配布URLをGitHub APIから取得して展開
curl -s https://api.github.com/repos/w3c/epubcheck/releases/latest \
  | grep "browser_download_url.*\.zip" | cut -d '"' -f4 | xargs -I{} curl -L -o epubcheck.zip {}
unzip -q epubcheck.zip

# round1のEPUB2種を念のため再生成 (round1の/tmp成果物が残っていれば流用してもよい)
pandoc /Users/masa/projects/AMD/amd-os/pwa/bzm/book-a-ch-8.md \
  -o /tmp/book-a-typesetting-verification-round2/ch8-mathml.epub --mathml
pandoc /Users/masa/projects/AMD/amd-os/pwa/bzm/book-a-ch-8.md \
  -o /tmp/book-a-typesetting-verification-round2/ch8-webtex.epub --webtex

java -jar epubcheck-*/epubcheck.jar /tmp/book-a-typesetting-verification-round2/ch8-mathml.epub
java -jar epubcheck-*/epubcheck.jar /tmp/book-a-typesetting-verification-round2/ch8-webtex.epub
```

確認すること:
- MathML版・webtex版それぞれのエラー数・警告数・代表的な内容
- webtex版は line234 の式が画像化に失敗して欠落したまま生成される (round1確認済み) — その「中身が欠けている」こと自体は epubcheck 上ではおそらく検出されない (構造的には valid になりうる) ので、epubcheck の valid/invalid だけでなく「内容が意図通りか」は別軸で記録する
- 2種の結果に構造的な差 (MathML特有のwarning等) があるか

### タスク (b): 8.5節 underbrace 数式2本の overfull hbox 解消

対象 (book-a-ch-8.md 165行目・167行目、read-only、原文):

```
$x\text{の毎月の変化}=\underbrace{\mu_x(R)}_{\text{ドリフト}}+\underbrace{(\Sigma\text{規模のランダムな揺れ})}_{\text{拡散}}+\underbrace{(\text{上向きジャンプ})}_{\text{頻度 }\lambda_x(\sigma_{SU},\ \text{機関の整備度})}$
```

```
$y\text{の毎月の変化}=\underbrace{\mu_y(R_{net}-B)}_{\text{ドリフト}}+\underbrace{(\Sigma\text{規模のランダムな揺れ})}_{\text{拡散}}-\underbrace{(\text{下向きジャンプ})}_{\text{頻度 }\lambda_y}$
```

round1 の `BOOK_A_PUBLISHING_PLAN.md` §4 ログによると、この2本が原因で A5 印刷用 PDF の lualatex ログに overfull hbox warning (5.53pt / 20.26pt) が出る。目視上は読めるが、印刷版としては解消したい。

作業手順:
1. **book-a-ch-8.md 自体は絶対に編集しない**。検証は repo 外の作業コピーで行う。ファイル全体を `/tmp/book-a-typesetting-verification-round2/` 配下にコピーするか、round1 が残した中間 `.tex` (`ch8-ltjsbook.tex`、STEP0 のスナップショット参照) があればそれを出発点に LaTeX レベルで直接いじる方が効率的な可能性が高い (underbrace の折返しは LaTeX レベルの調整になりやすいため)。どちらの方法を取るかは判断に任せる。
2. 少なくとも次の3パターンを試す:
   - **(b-1) `aligned` 環境**: 各 `\underbrace{...}_{...}` 項を分割し、`+`/`-` の前で改行する
   - **(b-2) 強制改行**: `\\` や `\allowbreak` 等を underbrace 項の間に入れる
   - **(b-3) フォント縮小**: 数式全体、または長いラベル部分 (`\text{頻度 }\lambda_x(\sigma_{SU},\ \text{機関の整備度})` 等) だけを `\footnotesize`/`\small` で縮小する
   - (任意・上記で解決しなければ) `\resizebox{\linewidth}{!}{...}` で版面幅に強制フィットさせる方法も試してよい
3. 各パターンについて、round1と同じ A5 PDF 生成コマンド (pandoc + lualatex + `ltjsbook`、`BOOK_A_PUBLISHING_PLAN.md` §4 に実例あり) で再コンパイルし、ログで overfull hbox の有無・pt値を確認する: `grep -i "overfull" *.log`
4. 見た目も確認する: 生成 PDF の該当ページを Poppler 等 (`pdftoppm` / `pdftocairo`) で PNG レンダリングして目視 (round1 と同じ手法)。縮小しすぎて読みにくくないか、行送りが不自然に崩れていないかを見る。
5. 解消できた (またはpt値が大幅に縮小した) パターンを**すべて**記録する。**どのパターンを本番の原稿に採用するかはこのタスクの範囲外** — ここでの目的は「技術的にどの手法が overfull hbox を解消できるか」の選択肢と実例コードを正本に残すことであり、本文の書き方そのものを決定することではない。

### タスク (c): EPUB webtex 版の外部 Codecogs 依存解消

対象 (book-a-ch-8.md 234行目、read-only、原文):

```
$\text{交換効率} = \dfrac{x\text{の前進} + \text{事業化ラインを手前に寄せた量}}{\text{消費した } y}$
```

round1 の `BOOK_A_PUBLISHING_PLAN.md` §4 ログによると、`pandoc --webtex` はこの式を外部の Codecogs (`codecogs.com`) 経由で画像化しようとして HTTP 400 になり、この式だけ EPUB 内で欠落する。目的: **外部ネットワーク依存なしに** EPUB 内で数式を画像化する経路を確立すること。

まず安く確認できることとして、単純に `pandoc --webtex` を今日改めて実行し、この式が今日も同じ理由で失敗するか確認する (Codecogs側の一時的な問題だった可能性もゼロではないため)。失敗するなら、以下のローカル代替を試す:

- **候補アプローチ1 (最有力)**: `gladtex` — pandoc の `--gladtex` 出力 + `gladtex` コマンドでローカルに数式を SVG/PNG 化する、pandoc 互換のオフラインツール。STEP 0-2 で導入を試みる。導入できたら、ch8全体 (または line234 の式を含む断片) を `pandoc --gladtex` → `gladtex` の2段変換でEPUB化し、ネットワークなしで通るか確認する。
- **候補アプローチ2 (フォールバック)**: 個別の数式を `standalone` LaTeXクラスで単独コンパイルし、`lualatex` → PDF → `dvisvgm --pdf` (dvisvgmはPDF直接入力にも対応) でSVG化する自前パイプライン。STEP 0-2 で `dvisvgm` 導入が前提。この方法は数式1個ずつ手動処理になるため、章全体への汎用化 (スクリプト化) までは必須ではない — line234 の式1本で「オフライン経路が技術的に成立する」ことを示せれば十分。

確認すること: いずれかの経路で、外部HTTPアクセスなしに line234 の式を含む EPUB が生成でき、生成された EPUB がタスク (a) で導入した epubcheck を通ることを確認する。

### タスク (d): 図プレースホルダ → 実画像埋め込み配管の検証

対象は前述の4箇所の図プレースホルダ (99/183/203/254行目)。**実際の図の中身 (matplotlib生成等のビジュアルデザイン) は別ストリーム (G) の担当でありこのタスクの範囲外。あくまで「画像を差し込む配管」の技術検証のみ**。中身が何であるかは問わないダミー画像 (単色PNG等、何でもよい) を使う。

作業手順:
1. book-a-ch-8.md は編集しない。作業コピー (`/tmp/book-a-typesetting-verification-round2/ch8-figures-test.md` 等) を作り、そちらで4箇所のプレースホルダを pandoc 標準の画像埋め込み Markdown 記法 (`![キャプション](path/to/dummy.png){#fig:8-1}` 等) に置き換える。ダミー画像はどんな方法で用意してもよい (1x1のPNGを適当に作る、既存のサンプル画像を流用する等)。
2. pandoc + LuaLaTeX で次を確認する: (i) 図番号が自動採番されるか (「図8-1」等)、(ii) キャプションが正しく表示されるか、(iii) 本文中からの相互参照が解決できるか。
3. 相互参照解決の検証のため、作業コピー側で試験的に1箇所「(図8-1参照)」のような一文を追加し、`pandoc-crossref` フィルタ (`--filter pandoc-crossref`、pandocの`[@fig:8-1]`記法) の有無・動作を確認する。導入されていなければ入手を試みる。入らなければ、素の LaTeX 変換 (`\caption`/`\label`/`\ref` に pandoc がどこまで自動変換するか) だけでどこまでできるかも合わせて確認する。**このテスト用の一文はあくまで検証用の一時テキストであり、正式な原稿の相互参照文言を決めるものではない** (本物の文言をどう書くかは原稿側の仕事で対象外)。
4. EPUB側 (`--mathml`/`--webtex` どちらの経路でも) でも同様の画像埋め込みが正しく機能するか確認する。

### タスク (e): 本番テンプレート要素の技術検証 (柱・ノンブル・目次・奥付)

**デザイン自体 (実際のタイトル・著者名・柱に何を書くか等) はまだ確定していない。ダミーデータのみを使い、「技術的に何が可能か」の検証にとどめること。本番の柱文言・タイトル・著者名等を確定させようとしないこと。**

検証する要素:
1. **柱 (running header)**: 奇数ページ/偶数ページで異なるヘッダー文言 (例: 偶数ページに仮のタイトル文字列、奇数ページに仮の章タイトル文字列) を出し分けられるか。`ltjsbook`/`jlreq` 標準の pagestyle 機構、または `fancyhdr` パッケージ (和文クラスとの相性は要確認) で試す。
2. **ノンブル (page number)**: ページ番号の位置・書式 (ノド側/小口側の配置、扉ページ・章扉でのノンブル省略等、一般的な書籍組版の慣習) が制御できるか。
3. **目次 (TOC)**: pandoc標準の `--toc` オプション、または LaTeX レベルの `\tableofcontents` で、ダミーの複数章構成 (book-a-ch-8.md 1本だけでなく、簡単なダミー章を2〜3個用意して連結する、または既存の見出し階層だけを使う) から自動生成されるか。章番号・節番号の階層が正しく出るか。
4. **奥付 (colophon)**: 書籍末尾の奥付ページ (発行日・発行者・印刷者等を記載する慣習ページ) をダミーデータで1ページ追加できるか。LaTeXレベルで独立ページとして挿入する技術的な方法を確認する (pandocのraw LaTeX埋め込み、または別ファイルを `\include` する方法等)。

確認すること: 上記4要素それぞれについて、pandoc + LuaLaTeX (`ltjsbook`) のパイプラインでダミーデータを使って再現できたか、できたなら実際に通ったコード例、できなかったなら何が具体的な障害だったか。

### 完了条件・書き戻し先

以下を全部やって初めて完了。

1. **`BOOK_A_PUBLISHING_PLAN.md` の `## 4. 組版技術検証ログ` に追記**: 既存の round1 エントリ (`### 2026-07-15 Ch8 技術検証 (数式最重量級サンプル)`、末尾は「次の処置」の箇条書きで終わる) の直後、`## 4.` セクション全体を閉じる `---` 区切りの前に、新しい見出し (例: `### <着手日> Ch8 技術検証 round2 (epubcheck / overfull hbox / webtex オフライン化 / 図配管 / 本番テンプレ要素)`) で追記する。中身は:
   - 日付
   - タスク (a)〜(e) それぞれについて: 何を試したか (実行したコマンド実例つきで)・結果 (通った/落ちた)・判明した制約
   - **詰まった箇所があれば、どこまで到達したか・何が具体的な障害だったかを明記** (完走を無理強いしない、round1と同じ方針)
   - 同ファイル末尾の `## Changelog` 表 (書式は `| Date | What | By |`) にも1行追記する
2. **`COMMANDER_TASKS.md` のストリーム K セクションを1行更新** (`### K. 自費出版実務 (PF-015 §7-17) — 出版準備ストリーム稼働開始 (2026-07-13)` 節の「次アクション」の一文)。2026-07-15時点の現状は:
   > 「次アクション: Ch8 組版技術検証は A5 PDF 28p / EPUB MathML 成功 / webtex 長式1本欠落まで完了。次は高品質印刷所候補の見積り取得準備 (A5 / 480・520・550p / 背幅24〜30mm級 / モノクロ本文 / PUR無線綴じ候補 / 表紙加工 / 50〜100〜200部) → ISBN/JAN申請情報整理 → Kindle Previewer / epubcheck 環境が揃い次第 EPUB 実機系確認。」

   これを round2 の結果 (epubcheck 実施済みか、overfull hbox 解消済みか等、5課題の進捗) を反映した簡潔な1行に更新する。**詳細ログをここに貼らない** — この盤の運用ルールは「1行 = ストリーム/状態/担当/次アクション/まさ要判断」だけ、詳細は正本ファイル側 (`BOOK_A_PUBLISHING_PLAN.md` §4) に置く。ファイル冒頭の🚦全体サマリ表にKストリームの行があれば、そちらも整合する形で軽く更新する。
3. **`9-5-appendix-changelog.md` の変更履歴表に1行追記** (書式は `| 日時 | 対象章 | 種別 | 変更箇所 | 理由 | 変更者 |`)。round1 も同じ表に追記している (2026-07-15 00:57 JST の行が実例) ので、同じ粒度・書式で書く。この附則は append-only — 過去行を書き換えない。
4. **commit & push**:
   - `main` で直接 commit (ブランチ禁止)
   - push 前に `git fetch origin main` を必ず実行、rejected なら `git pull --rebase --autostash` → 再push
   - commit message は日本語で簡潔に。例: `docs(bzm): Book A 組版技術検証 round2 (epubcheck/overfull hbox/webtexオフライン化/図配管/テンプレ要素) ログ追記`
   - 生成物 (PDF/EPUB/JDKバイナリ/epubcheck本体等) は絶対に `git add` しない (下記「生成物の扱い」厳守)

### 詰まったときの心構え

- 5つのタスクは難易度も相互独立性もバラバラ (例: (a) は JDK 導入という外部要因に依存、(b) は純粋な LaTeX トライアンドエラー、(c) は (a)(b) より不確実性が高い、(d)(e) は比較的見通しが良い)。**全部を完走させる必要はない**。一部が完了、一部がブロックのままでも構わない。「何をどこまで試して、何が具体的な障害だったか」を正直に書けば、それ自体がこのタスクの価値ある成果になる。
- 特にタスク (c) はローカル数式画像化の技術的難度が読めない。`gladtex` も `dvisvgm` 手動パイプラインも両方うまくいかなかった場合は、「オフライン化は現時点でこの環境では確立できなかった、外部Codecogs依存を許容するか式を簡略化するかの判断が必要」という結論を書くこと自体が正しい成果物になる。
- このファイル外の会話履歴やまさへの質問には頼れない前提で、書いてある情報の範囲内で合理的に判断して進める (自己完結タスクとして設計されている)。

## このPJで確立済みの運用ルール

### 絶対に守ること (スコープ限定・例外なし)

1. **原稿の中身に一切触れない**: 章本文 (`book-a-ch-*.md` の文章・数式内容・図版プレースホルダの記述内容) を一文字も書き換えない。読んで変換テストの入力に使うだけ。誤字等に気づいても直さず、検証ログに書き添える程度に留める。
2. **検証対象は組版パイプラインの技術的挙動だけ**: 「pandoc / LuaLaTeX / epubcheck / EPUB 変換がどう動くか」を確認するタスク。「本の内容がどうか」には一切踏み込まない・コメントしない。
3. **禁止語彙** (Book A 全体の用語統一ルール):
   - 「鬼門」は使わない。その概念に触れる必要が万一あれば「不可逆点」を使う。
   - 社内コードネーム (「BZM」「Book B」「PF-xxx」等の PJ 略称) を書かない。プロジェクト名は常に「Book A」と書く。
   - これは検証ログ本文・commit message の両方に適用する。
4. **ブランチを作らない**: このリポジトリ (`amd-os` monorepo) はブランチ作成を全面禁止している。**必ず `main` で直接作業し、直接 commit・push する**。一時ブランチも例外なく禁止。
5. **生成物 (PDF/EPUB/JDK/epubcheck本体等) をリポジトリに commit しない** (詳細は次項)。
6. **1機能 = 1 commit**、commit の度に push。環境構築・タスク(a)〜(e)・正本反映で分けても、まとめても良い (判断は Codex に任せる)。
7. **fetch を挟む**: 着手前に `git fetch origin main && git status -s` で作業ツリーが最新かを確認 (並行稼働セッションが多いため)。push 前にも必ず `git fetch origin main`。rejected されたら `git pull --rebase --autostash` → 再度 push。
8. bzm 配下ファイルの commit・push は事前承認不要。このタスクの範囲内 (既存ロジック削除や本番データ操作を伴わない) なら、まさに確認を取らずそのまま進めてよい。

### 生成物の扱い (置き場所ルール、厳守)

- PDF/EPUB/JDK/epubcheck 本体等のプロトタイプ・中間ファイル・ツールは**このリポジトリの外**に置く。例: `/tmp/book-a-typesetting-verification-round2/` や `$HOME/book-a-typesetting-verification-round2/` 等、都合の良い場所でよい。round1 の生成物は `/tmp/book-a-typesetting-verification-20260715/` に残っている可能性がある (STEP 0 前のスナップショット参照) — 消えていたら気にせず再生成すればよい。
- **リポジトリ内には生成バイナリを一切置かない** (`git add` の対象にしない)。このリポジトリは軽量な md ベースの正本管理が前提で、大きいバイナリを履歴に混ぜたくない。
- リポジトリに書き戻すのは**テキストのログ・数値・所感・実際に通ったコマンド例だけ** (上記「完了条件・書き戻し先」参照)。

以上の内容で着手してよい。まさへの追加確認は不要 — このファイル単体で完結するように設計されている。

## このセッションで作った branch/worktree

なし。このハンドオフの作成は root checkout (`/Users/masa/projects/AMD/amd-os`) 上での `main` 直接編集のみで、新規 branch/worktree は作っていない。Codex 側がこの後どう作業するかは Codex 自身の実行環境の裁量だが、上記「絶対に守ること」4番の通り、このリポジトリではブランチ作成が全面禁止されている — Codex も新規ブランチは作らないこと。

---

*最終更新日: 2026-07-15*
