# 開発者向け

この章は、開発者が最初にどこを読むかを案内する入口。

開発手順・deploy・DDL・automation・GAS deploy の詳しい仕様は、設計書へ移行済み。

## 開発者がまず読む場所

| 知りたいこと | 正本 |
|---|---|
| 設計書だけで OS を再構築できるか | [/spec/1-3-reconstruction-coverage-audit](/spec/1-3-reconstruction-coverage-audit) |
| manual / spec / bzm / model の責務分離と附則ルール | [/spec/5-1-document-governance-current-spec](/spec/5-1-document-governance-current-spec) |
| モデル（BZM / SPS）の目的・要件・承認済みの内容 | [/model](/model) |
| repo / deploy / build version / DDL / GAS deploy | [/spec/5-2-development-operations-current-spec](/spec/5-2-development-operations-current-spec) |
| L2 automation / cron / outbox / 停止済み旧経路 | [/spec/5-3-automation-responsibility-current-spec](/spec/5-3-automation-responsibility-current-spec) |
| 過去判断と事故から来た実装制約 | [/spec/5-4-decision-history-current-spec](/spec/5-4-decision-history-current-spec) |
| PWA route / API surface | [/spec/2-2-pwa-surface-inventory-current-spec](/spec/2-2-pwa-surface-inventory-current-spec) |
| Supabase data model | [/spec/2-3-supabase-data-model-current-spec](/spec/2-3-supabase-data-model-current-spec) |

## 変更時の最低ルール

- 使い方は `/manual`、実装仕様は `/spec`、教科書（本の原稿）は `/bzm`、**モデルそのもの（目的・要件・式）は `/model`** に置く（2026-08-22 新設）。
- **`/model` の正本は「ページそのもの」**（2026-08-23 まさ確定）。画面が読み込む md はあくまで読み込み元で、**画面に出ていない内容は正本ではない**。会話や報告では「モデルページ」と呼び、md のファイル名で呼ばない。
- **正本の本文に、まさの発言の引用をそのまま書かない**（2026-08-24 まさ指示「ものすごく読みにくい」）。本文には印だけを置き、`[根拠](#evidence "まさ 2026-08-23「…」")` と書く。画面（`BzmMarkdown`）はこの印にマウスを載せたときだけ引用を出す。表に「根拠」列を作らず、意味の末尾に印を付ける。`/bzm`・`/spec` の各ページでも同じ記法が使える。
- **`/model` にはまさが合意した内容だけを書く。** 正本 md から抽出した内容であっても、合意を経ていないものは置かない。表示物を足すときは、先に `model/APPROVALS.md` へまさの合意を記録する。
- **モデルの定義・式・値は、すべてモデルページ本体（`model/MODEL_VERSION_LEDGER.md`）に書く**（2026-08-24 設計変更、`model/APPROVALS.md` #2026-08-24-12）。別ファイルへ切り出して本文からリンクする形にしない。同じ定義を二か所に置くと必ず片方が古くなる——実際に、承認済みの定義を別文書に置いていたため、改訂がリンク先にだけ入り、モデルページ本体が6時間半のあいだ古い式のままになった。文書一覧のナビは `/model/<文書>` を開いた後の画面にしか出ないので、リンク先は本文中のリンクを踏まない限り存在に気づけない。
- **`model/proposals/` には提案中のものだけを置く。** 承認したら中身をモデルページ本体へ統合し、提案ファイルは「統合済み・書き戻し禁止」のスタブにする（全文は git 履歴に残る）。**`model/LOCK.json` に `model/proposals/` 配下を入れない**——`model_lock.cjs check` が機械的に検査して落とす。経緯の文書（監査報告・改訂の記録）は定義を持たないので別ファイルのままでよい。規律の全文は `model/README.md` (a-2)。
- **モデルページの表現は直接的に書く**（2026-08-24 まさ指示「ぼかした表現、比喩的な表現は一切しないで」）。比喩（体質・盤面・燃料・道筋・帯・窓・壁）は使わず、案件パラメータ・観測状態・資金・シナリオ・推定値・資金調達の機会・確定した期限と書く。ステージゲート、バーンレート、事前分布のように通用する用語を選ぶ。新しい記号や期間を出したら、その場で定義を書く。
- **モデルページの根拠は2種類あり、混ぜない**（2026-08-25、`model/APPROVALS.md` #2026-08-25-1）。まさの発言の根拠は「根拠」の印（マウスオーバーで引用が出る）、外部の文献の根拠は**上付きの番号**（マウスオーバーで書誌、押すと §10 参考文献へ飛ぶ）。文献は実在を確認した書誌だけを載せ、確認が取れていないものは「書誌のみ・URL 未取得」と記して根拠の柱にしない。自著（教科書）と外部の査読文献の地位を分け、「文献が示している」と書けるのは後者だけ。**文献が支えるのはモデルの構造（どの量がどこに効くか、関数の形）であって、係数の水準ではない。**
- **較正で精度を上げるパラメータは §7 の台帳で管理する**（2026-08-25、#2026-08-25-2）。「正本の値（承認済み）」と「提案中の値（未承認）」を**別の列**に置き、混ざらないようにしている。**値を変えるときは §7.2 の変更履歴に必ず1行足す。承認 ID を書かない変更は入れない。** 提案の中での値の動きは提案文書の側に記録し、台帳には承認された変更だけを載せる。
- **モデルページの冒頭には現行モデル（BZM 3.0）の式を出す**（2026-08-25、#2026-08-25-3）。ページ下部の「すべての式」は `bzm/` から抽出している**旧 BZM 2.2 系列**（退役済み、画面に札あり）なので、冒頭に上げてはならない。冒頭の一覧は台帳本文の `$$` を出現順に拾ったもので、説明（何の式か・主な記号）も正本から拾う。**画面側で式や説明を書き起こさない。** 左ナビの「モデル」にマウスを載せると節の一覧が出る（正本の `##` 見出しから生成。参照系なのでキャッシュを通す）。
- **モデル正本（`model/LOCK.json` の12件）は、まさの承認記録なしに変更できない。** 変更したい内容は `model/proposals/` に提案として書き、まさの承認を `model/APPROVALS.md` へ引用つきで記録し、`node pwa/scripts/model_lock.cjs relock --approval <id>` を通す。迂回フラグは用意していない。ロックは critical-ui guard / `.githooks/pre-commit` / Claude Code の PreToolUse hook の3層で検査する。
- どれかを変更したら、対応する附則に日時つきで追記する。
- 画面導線や章 metadata を触ったら `npx tsc --noEmit` と `npm run build` を通す。
- **本番反映 = main への push** (2026-06-12〜、Vercel Git 自動 deploy)。CLI 直接 deploy は廃止、ブランチ作成は全面禁止。本番反映するなら build version を bump し、原則 deploy 前の事前確認で止めない。
- deploy bundleには、含める変更、除外する変更、local build/test/browser確認結果、push先、rollback/本番確認方法を含め、事後報告として残す。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` で main を push する (= 検査 + rollback guard + push + build 監視)。この env は承認フラグではなく誤実行防止の明示スイッチ。
- push 前の安い確認は `bash pwa/scripts/deploy.sh --dry-run`。push せずに、main/clean/origin 整合と BUILD_VERSION rollback guard だけを見る。
- 本番の出どころ確認は `/api/build-info`。`build_version` / `git_sha` / `git_branch` / `deployed_at` / `dirty` だけを返し、secret は出さない。
- 自分が触っていない dirty file を commit に混ぜない。
- Codex Desktop では、この repo を指定した Local 子タスク作成・UI の Handoff を使わない。アプリ側が作業開始前に `codex/*` branch を作ることがあるため。
- clone 後は `bash scripts/install-main-only-git-hook.sh` を実行する。新セッションは `main`、dirty 0、worktree 1、local branch `main` だけを確認して始める。
- 「ブランチを切り替えるには変更をコミットしてください」と出たらキャンセルする。コミットして切り替えず、Git状態を監査して main を復旧する。

## 再構築可能性チェック

この manual 章だけでは OS は再構築できない。目的は「開発者の入口」。再構築に必要な contract は `/spec` の各章を読む。
