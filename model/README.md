# model/ — AMD OS モデル正本

AMD OS の BZM（事業価値の動学）/ SPS（シーズ一次選別）モデルの**正本は、OS のモデルページ `/model`**
である（まさ確定 2026-08-23「正本はmdじゃなくてOSのモデルページと定義しておいて」「おれはUIしか見ないので」）。
このディレクトリは、そのページが読み込む md と、まさの承認記録、ロックの置き場。
画面に出ていない内容は正本ではない。まさの明示の承認なしに、ここが指す内容を変更してはならない。

## (a) ここは何か、bzm/ や pwa/spec と何が違うか

- `bzm/` … Book A（教科書）の原稿置き場。読み物としての解説・比喩・章立てが主。
- `pwa/spec` 相当（各PJの設計正本） … アプリの実装仕様。DB契約、API、UI仕様。
- `model/`（ここ） … **モデルページ `/model` の読み込み元**。どの版のどの式・どの変数定義・どのパラメータが
  「現行」かを一意に決める入口。`bzm/` の中の該当 md へ `model/LOCK.json` でパス参照してロックする
  （md を物理的にここへ移動はしない）。

モデルページ `/model` が描画する本文は `model/MODEL_VERSION_LEDGER.md`（台帳）。画面はこの md を
そのまま描画し、画面側で要約・再構成しない。正本はあくまで画面（モデルページ）であり、md はその
読み込み元。会話・報告では「モデルページ」と呼び、md のファイル名で呼ばない（まさ 2026-08-23
「それならモデルページと言って。わざわざmdファイルの名前なんて覚えないから」）。
`/model` ページが読む機械可読サマリは `model/CURRENT.json`。

## (b) 参照規律

- えいみの評価・表示・会話は、`model/LOCK.json` に載った確定文書（と、そこが指す `bzm/` 内の該当 md）
  だけを現行モデルの前提にする。
- `model/proposals/` にある提案中の概念・変数・式は、承認されるまで評価にも本番表示にも
  会話の前提にも使わない。「まだ承認されていない」ことを明示せずに使うのは禁止。
- モデル版・パラメータに触れる作業（実装・診断・レビュー）の前に、`model/MODEL_VERSION_LEDGER.md`
  を先に Read してから動く（`AGENTS.common.md` の「重要モデル定義を触る前に正本 md を全文 Read」と同じ規律）。

## (c) 変更手順（提案 → 承認 → 反映）

1. 変更したい内容を `model/proposals/YYYY-MM-DD_<件名>.md` として書く。冒頭に状態行
   `状態: proposal / 未承認` を必ず入れる。
2. その提案をまさへ本文（チャット）で提示する。要約や骨格だけでなく、実際の変更文面を見せる。
3. まさが承認したら、その発言をそのまま `model/APPROVALS.md` に新しいエントリとして記録する
   （引用は要約・言い換えをしない。対象ファイルのパスを列挙する）。
4. 正本（`bzm/` 内の該当 md、または `model/MODEL_VERSION_LEDGER.md` / `model/CURRENT.json`）を変更する。
5. `node pwa/scripts/model_lock.cjs relock --approval <id>` を実行して `model/LOCK.json` を更新する。
6. 同じ commit で `bzm/9-5-appendix-changelog.md` に変更点を1行追記する。
7. 却下された提案は `model/proposals/` から `model/withdrawn/` へ移し、冒頭に撤回 notice を追加する。

`model/LOCK.json` を先に書き換えて後から承認を取る、という順序の逆転はしない。

## (d) ロックの3層

正本の無断変更を、性質の違う3つの場所で機械的に止める。どれか1つが外れても他が残る。

1. **critical-ui guard**（`pwa/scripts/check_pwa_critical_ui.cjs` → `model_lock.cjs` の `require`）
   `npm run test:critical-ui`（CI・ビルド前チェックに組込済み）で、`model/LOCK.json` に載った
   ファイルの sha256 とコード側の凍結版タプルを照合する。不一致ならテストが落ちる。
2. **pre-commit フック**（`.githooks/pre-commit`）
   staged ファイルが `model/` 配下、または `model/LOCK.json` に列挙されたファイルに触れていたら、
   commit 前に `model_lock.cjs check` を強制的に通す。落ちたら commit できない。
3. **Claude Code の PreToolUse フック**（`/Users/masa/.claude/hooks/guard_model_canon.py`）
   Edit / Write / MultiEdit / NotebookEdit の書き込み先や、Bash コマンドの対象が
   `model/LOCK.json` に載ったファイルと一致したら、その場で `ask`（確認）にする。
   `model/proposals/` 配下への書き込みは止めない。

## (e) やってはいけないこと

- 迂回用の環境変数・フラグを追加すること（`.githooks/pre-commit` に迂回変数は存在しない。
  同じ設計を保つ）。
- `model/LOCK.json` を手で編集して sha256 やファイル一覧を合わせること。必ず
  `node pwa/scripts/model_lock.cjs relock --approval <id>`（または `init`）経由で生成する。
- `model/APPROVALS.md` にまさが実際には言っていない承認引用を書くこと（創作・要約・先回りの禁止）。
- 提案段階の概念・変数・パラメータを、承認前に本番の評価ロジックや会話の前提へ混ぜること。

## (f) モデルページの書き方 — 根拠は印にする

まさ 2026-08-24「根拠となるおれの発言は、文章の中にそのまま入れるのはやめて。ものすごく読みにくい。マウスオーバーしたら出るとかにしてよ」。

- 本文・表の中に、まさの発言の引用や出典の説明をそのまま書かない。
- 根拠は `[根拠](#evidence "まさ YYYY-MM-DD「発言をそのまま」。出典: 文書名 §n")` という印で書く。
  画面（`pwa/src/components/bzm/BzmMarkdown.tsx` の `a` 描画）は、この印にマウスを載せたとき引用を表示する。
- 引用の文言は承認台帳（`model/APPROVALS.md`）と一致させる。要約・言い換えをしない。
- 表に「根拠」列を作らない。出典の文書リンクが要るときは短い「出典」列にし、引用は印へ入れる。
- 印の中で二重引用符 `"` を使わない（title 属性が壊れる）。引用は「」、補足は（）で書く。
