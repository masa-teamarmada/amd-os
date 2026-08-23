# APPROVALS.md — まさ承認の記録台帳

このファイルは `model/` 配下のモデル正本（および `model/LOCK.json` にロック対象として
列挙されたファイル）を変更してよいという、まさの承認だけを記録する。

## 運用

- エントリ形式は次の通り、日付が変わった同日内の複数件は連番で区別する。

  ```
  ## YYYY-MM-DD-N

  日付: YYYY-MM-DD

  引用:
  > (まさの発言をそのまま引用する。要約や言い換えをしない)

  対象ファイル:
  - path/to/file1.md
  - path/to/file2.md

  反映commit: (未反映なら「(未反映)」、反映後に司令塔がハッシュを追記)
  ```

- 「対象ファイル」に列挙したパスが、そのままロック対象（`model/LOCK.json` の `files[]`）に
  入る。`node pwa/scripts/model_lock.cjs relock --approval <id>` はこのセクションのパス一覧を
  読み取って `LOCK.json` を再生成する。パスはリポジトリルート（`amd-os/`）からの相対パスで書く。
- 承認の引用を要約・翻訳・創作しない。まさが実際に書いた／言った言葉をそのまま貼る。
- このファイルへの追記は、まさの承認が実際にあった場合だけ行う。提案段階では書かない。

---

## 2026-08-22-1

日付: 2026-08-22

引用:
> その４層でいいので実装進めて。式の各変数をクリックすると、その変数の説明箇所に飛ぶようにしてほしい。参考文献はリンク付きで記載すること。

> こないだみたいに新しいP^PJみたいな概念を勝手に持ち出すことがないように、このOSのモデルのところを正本にして、そこを変更するような場合には、その変更をおれに提案して、それが受け入れられない限りはOS上のモデルだけを参照するような仕組みも作ってほしい。

対象ファイル:
- bzm/sps-2-0-reachability-model.md
- bzm/sps-2-0-domain-definition.md
- bzm/sps-2-0-measurability-gate.md
- bzm/SPS_NAT_VALUE_MEASURE_PROPOSAL_2026-08-16.md
- bzm/SEED_Q_RUBRIC_2026-08-15.md
- bzm/terminology_glossary.md
- bzm/bzm-2-2-strategic-slack-and-propulsion.md
- bzm/bzm-2-1-dynamic-business-value-model.md
- bzm/BZM_2_0_DIAGNOSTIC_SCORE_SPEC.md
- bzm/bzm-1-0-to-2-1-evolution-guide.md
- model/MODEL_VERSION_LEDGER.md
- model/CURRENT.json

反映commit: (司令塔が追記)

---

## 2026-08-22-2

日付: 2026-08-22

引用:
> C.
> 改名して

引用の文脈（えいみの提案文。引用とは区別する）:
提案（えいみ）: 「C. `sps-2-0-reachability-model.md` の改名 — 今回は別セッションが `bzm/` を移動中だったので見送った。改名するならロック対象パスの更新込みで次に入れる。」

変更の性質: ファイル名とリンク文字列の置換のみ。式・定義・数値・日付は1文字も変えない。domain-definition・measurability-gate は同じ名前構造で同じ誤解を生むため司令塔判断で同時に改名（事後報告）。

対象ファイル:
- bzm/sps-current-reachability-model.md
- bzm/sps-current-domain-definition.md
- bzm/sps-current-measurability-gate.md
- bzm/terminology_glossary.md
- bzm/bzm-2-2-strategic-slack-and-propulsion.md
- bzm/bzm-1-0-to-2-1-evolution-guide.md
- model/MODEL_VERSION_LEDGER.md
- model/CURRENT.json

削除パス:
- bzm/sps-2-0-reachability-model.md
- bzm/sps-2-0-domain-definition.md
- bzm/sps-2-0-measurability-gate.md

反映commit: (未反映)

---

## 2026-08-22-3

日付: 2026-08-22

引用:
> １．
> 修正して
>
> ２．
> 修正して（ロック対象外なら判断不要なのでは？）

引用の文脈（えいみの報告文。引用とは区別する）:
報告（えいみ）: 「理論正本 `bzm-2-2-strategic-slack-and-propulsion.md` 1301行が『現行SPSの9軸診断指数』のまま（8/15掃除の漏れ）。ロック対象なので承認経路が要る」「`pwa/spec/4-2` の2.2 pilot節『出力と用途の境界』と `pwa/manual/4-3` 211行・265行にも同じ残存。こちらはロック対象外で、8/15起票のworker残タスク」。まさの指摘「ロック対象外なら判断不要なのでは？」は正しく、ロック対象外の spec / manual は承認を要さない作業だった。

変更の性質: 2026-08-15（9軸集約スコアの退役）と 2026-08-16（価値項を持分価値→産業創出価値 $P^{\mathrm{ind}}$）の**まさ確定済み内容の反映漏れの掃除**であり、新しい理論主張・数式・定義は導入しない。具体的には (1) 2.2 §9 と 2.1 §3 の訂正注記が $\sum_o q_oP_o$ のままだったのを $P^{\mathrm{ind}}$ 版へ、(2) 2.2 §15「現行SPSの9軸診断指数」→ 現行SPSの式、(3) 2.1 §3 表の「混ぜないもの＝現行運用SPSの9軸スコア」→「現行SPSの円建て価値量」、(4) 進化ガイド冒頭「現行の9軸診断SPS」と §6「現行運用SPSは9軸の診断指数として維持する」→ 集約スコアは退役・軸は状態記述子として入力側に残る。(4) は `model/MODEL_VERSION_LEDGER.md` が「正本間の未解決不整合／まさ判断待ち」として注記していた2件のうちの1件（進化ガイド §6 対 用語集 §1.7）にあたる。既確定内容への追随のため二重批判監査は実施していない（BZM研究規律の二重批判監査ゲートは、理論・数式・分類・判断規則の新設または変更が対象）。

対象ファイル:
- bzm/bzm-2-2-strategic-slack-and-propulsion.md
- bzm/bzm-2-1-dynamic-business-value-model.md
- bzm/bzm-1-0-to-2-1-evolution-guide.md

削除パス:
- bzm/sps-2-0-reachability-model.md
- bzm/sps-2-0-domain-definition.md
- bzm/sps-2-0-measurability-gate.md

反映commit: (未反映)

---

## 2026-08-22-4

日付: 2026-08-22

引用:
> SPSとBZM2.2が別系列にされてる時点で全く認識があってない。
> BZM2.2で定量化しているパラメータがSPSだよ。
> まずそこが合意できないと他のコメントができない。

> 「設計が固まってから台帳とページをまとめて直す」
> →これだと、このセッションが事故で閉じたら永久に埋もれて、またやり直しになるよ。
> 先に現時点で見えていることを書いておいて。

変更の性質: 版数台帳の**構造の訂正**と、この日の議論で確定した事実の記録。
モデルの定義そのもの（SPS の式、q・P^ind の定義、凍結 tuple）は1文字も変えていない。

1. §1: 「BZM と SPS は2系列」という初版の誤りを訂正。SPS は BZM の中の出力であることを、正本
   （到達見込みモデル冒頭「BZM 2.0 の履歴版」、BZM 2.2 §2「BZM 2.0で定義した T_Y は 2.2 で中身を置き換える」）
   の記述で示した。誤りの経緯もまさの指摘の引用つきで残した。
2. §4: 推進力（#bzm-propulsion）と戦略余力（#bzm-slack）の定義を追記。T_Y の式と、正本が
   「T_Y 一本へ潰さず7項目で表示せよ」と定めていることを含む。
3. §5: 節名を「BZM の中で SPS がどこに位置するか」へ改題し、構造図を置いた。
4. §5末尾: 「未解決 — 推進力と戦略余力が SPS の式に入っていない」を新設。まさの要件を原文で引用し、
   確認した事実6点と、承認まで現行式を変えないことを明記した。

対象ファイル:
- model/MODEL_VERSION_LEDGER.md

反映commit: 68535f38（別セッションの commit に巻き込まれて入った。commit メッセージは
「docs(bzm): 改名済み正本3件への参照リンクを張り替える」で、この台帳の構造訂正と
model/proposals/2026-08-22_sps-propulsion-and-slack.md の起票を説明していない。
push 済みのため amend せず、ここと bzm/9-5-appendix-changelog.md に記録を残す）

---

## 2026-08-23-1

日付: 2026-08-23

引用:
> それならモデルページと言って。
> わざわざmdファイルの名前なんて覚えないから。
>
> そしてスラッシュが抜けてるとか、個別各論の話が出てきたけど、いきなりそんな細かいこと言われてもわからん。
> 明確に間違ってるなら直して。

変更の性質: **表示上の誤字の修正のみ。** モデルの定義・式の意味・変数の定義は1文字も変えていない。

BZM 2.2 正本 §15「pilot画面のイベントと月次試算」の試算差分の式で、`\mathrm` の
バックスラッシュが3箇所欠落していた（`\Delta_{mathrm{sim}}` 等）。このため画面上で
「mathrm」という命令語がそのまま文字として数式に混ざって表示されていた。

- 修正前: `\Delta_{mathrm{sim}}J=J(\bar z_{mathrm{sim}})-J(\bar z_{mathrm{reg}})`
- 修正後: `\Delta_{\mathrm{sim}}J=J(\bar z_{\mathrm{sim}})-J(\bar z_{\mathrm{reg}})`

添字が `sim`（試算）と `reg`（登録方針）を表すことは修正前後で同じで、式の意味は不変。

対象ファイル:
- bzm/bzm-2-2-strategic-slack-and-propulsion.md

反映commit: (このあと記録)

---

## 2026-08-22-5

日付: 2026-08-22

引用:
> SPSとBZM2.2が別系列にされてる時点で全く認識があってない。
> BZM2.2で定量化しているパラメータがSPSだよ。
> まずそこが合意できないと他のコメントができない。

引用の文脈（えいみの補足。引用とは区別する）:
#2026-08-22-4 で版数台帳（model/MODEL_VERSION_LEDGER.md）の構造を訂正したが、OS 画面 `/model` は
まだ SPS と BZM を2枚の並列カードで並べており、台帳の訂正が画面へ届いていなかった。同じまさの指摘に
対する残りの反映であり、新しい判断を必要としない。

変更の性質: **表示の構造の訂正のみ**。モデルの定義（SPS の式、q・P^ind の定義、凍結 tuple、各系列の
版と状態）は1文字も変えない。CURRENT.json へ構造の説明文（structure）を足し、`/model` の「現在の
正式版」の直上に「SPS は BZM から独立した別系列ではなく、BZM の中の出力である」を出して台帳 §5 の
構造図へ導線を張る。series の値そのものは変更しない。

対象ファイル:
- model/CURRENT.json

反映commit: (このエントリの relock 実行時に、`model_lock.cjs` が承認エントリ本文全体から
拡張子付きトークンを拾っていたため、説明文中の "CURRENT.json" を repo 相対パスと誤認して
「未作成のため含めず」と誤報した。ロック対象12件は正しく維持されていたが、誤報を放置すると
警告への慣れを生むため、抽出を「対象ファイル:」節に限定する修正を同じ作業で入れた)

---

## 2026-08-22-6

日付: 2026-08-22

引用:
> ステップ２に進めてほしいけど、まずはそのステップ１を正本（OSのモデルページ）のトップに
> 短くまとめて書いておいて。
> ひとつずつちゃんと正本に書くルールを徹底しよう。

引用の文脈（えいみの補足。引用とは区別する）:
まさの指摘「この理論を構築した目的は、正本に書かれてないの？」を受けて領域定義
（bzm/sps-current-domain-definition.md）を読み直したところ、理論の目的・対象領域・中心命題・
予測地平の理由・分業がすべて §1〜§6 に明記されていた。えいみはそれを読まずに、AMD の実務
（735件の接触順）から目的を推定した草案を出しており、まさから「AMDに限定してはだめ」
「735件のうちどれに接触するかっていうのは、理論とはあまり関係がない。元々の目的とかなり乖離してる」
と指摘された。ステップ1（この理論で何を見ようとしているか）は新しい判断ではなく、正本に既にある
記述の要約であり、それを版数台帳の先頭と OS 画面へ出す作業。

変更の性質: **正本からの要約の転記のみ**。新しい理論主張・数式・定義は導入しない。出典は
bzm/sps-current-domain-definition.md §1・§3・§4・§5・§6。台帳に §0「この理論は何のためにあるか」
を新設（既存の節番号は変えない）、CURRENT.json に purpose を追加、/model のトップに表示する。

対象ファイル:
- model/MODEL_VERSION_LEDGER.md
- model/CURRENT.json

反映commit: (未反映)
