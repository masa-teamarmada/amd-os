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
