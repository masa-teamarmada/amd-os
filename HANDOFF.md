# AMD OS Handoff

Last updated: 2026-08-01 JST

Topic: SX 2026年7月提出版の再生成、PJ別前月フォーマット継承、提出版PDFの共通組版修正

Work type: `mixed`（月次生成・印刷の製品開発 + SX提出本文と長期事実の整理）

## Latest Session Summary

- SX 2026年7月提出版を、SX自身の6月実提出版と同じ構造で再生成した。他PJ、とくにKUTEの章立てをSXへ共通適用しない。
- 月次生成は`kaku-report`を適用し、Fable 5をCode Routine内で動かす。概要へsource件数やdraft更新履歴を出さず、当月の進展・判断・残る論点・次月の焦点へ統合する。
- SX本文には、BNV定例を投資検討に向けたDDの一環、PFとの経営体制協議をその体制でも出資検討可能との確認として反映した。知財マッピングは以前に完了済み、7月の追加対応なしと記載した。
- 外部関係者のフルネーム、人物別活動評価、相手を動かす・巻き込む表現を提出版で禁止した。EWIRは初出で`Ehime Water Innovation Roundtable（愛媛水イノベーション・ラウンドテーブル）`と展開する。
- 提出版PDFは各ページ上部に提出先・対象月と`取扱注意 / Confidential`を置き、下部フッター・ページ番号・本文後の空白最終ページを出さない共通組版へ修正した。
- 最終実装は、名前付き`@page`と`page: submission`を使わず、提出版／社内版で唯一の既定`@page`を切り替え、そのCSSを通常の`style`要素へ直接出力する。

## Repo / Production State

- canonical cwd / branch: `/Users/masa/projects/AMD/amd-os` / `main`。月次提出版の確定実装は`a9f398ec`、Vercel再トリガを含む本番確認SHAは`208151dd`（build `v3.53.5`）。以後のmainにもこの修正は含まれる。
- handoff着手時のmainは`ea2bd330`まで進んでおり、後続のBZM変更を含む。次セッション開始時はmain / origin / productionをread-onlyで取り直す。
- DB schema、新規migration、環境変数、API route、権限変更はない。
- 月次仕様正本は`pwa/spec/3-2-monthly-reports-current-spec.md`、利用者向け運用は`pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md`、事故履歴は`pwa/BUGS.md`、実装履歴は`pwa/design_log/sessions_2026-07.md`へ同期済み。
- SXのBNV・PF・知財マッピングの長期事実は`/Users/masa/projects/knowledge/sx.md`へ同期済み。提出本文の正本はAMD OSの`monthly_reports_external`（`p21` / `202607`）。

## Verification

- `node pwa/scripts/test_monthly_report_quality.mjs` 成功。
- `npx tsc --noEmit` 成功。
- production `v3.53.5` / `208151dd`で、ログイン済みSX印刷画面の実DOMに既定`@page`、提出版ヘッダー、下部`content: none`が存在し、名前付きpage、`page: submission`、社内版フッターが存在しないことを確認した。
- 同じ本番DOMからA4 PDFを生成し、全3ページをPNGで目視した。全ページに共通ヘッダーあり、フッター・ページ番号・4ページ目なし、3ページ目に「以上のとおり報告する。」あり。
- 簡略fixtureやコード差分だけで完了判定せず、本番DOMと最終PDF全ページを確認する再発防止を`pwa/BUGS.md`へ固定した。

## Unresolved Tasks

- この月次提出版修正に未解決はない。
- 新しい月次フィードバックが来た場合だけ、対象PJ・対象月のログイン済み提出版画面から再現し、実PDFの先頭・中間・最終ページまで確認する。

## First Next Action

追加指摘がなければ作業なし。指摘が来たら、まず`/project/[projectId]/report/[ym]/print?template=submission`を再読み込みし、保存済み本文・本番CSS・ブラウザ印刷PDFの3点を同じ版で確認する。直ったと報告するのは、実PDFの全ページで指摘箇所が消えた後だけ。

## Pointers

- 現行仕様: [`pwa/spec/3-2-monthly-reports-current-spec.md`](pwa/spec/3-2-monthly-reports-current-spec.md)
- OSマニュアル: [`pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md`](pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md)
- バグ・再発防止: [`pwa/BUGS.md`](pwa/BUGS.md) の`[monthly-reports/submission-trailing-page]`ほか月次項目
- 実装・検証履歴: [`pwa/design_log/sessions_2026-07.md`](pwa/design_log/sessions_2026-07.md) の「SX 7月提出版の再生成と全PJ共通の印刷組版修正」
- SX長期事実: `/Users/masa/projects/knowledge/sx.md`

## Established Rules

- main一本。新規branch / worktreeを作らず、対象ファイルだけを明示stageする。
- PWA本番反映は`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`を使い、Readyとproduction `/api/build-info`のSHAまで確認する。
- 提出版はPJごとに同じPJの直前月実提出版をフォーマット正本とする。初回や構造変更は人の明示承認が必要。
- FableはRoutine内で動かし、従量課金の別API経路へ逃がさない。
- PDF修正はブラウザ上の見た目だけで閉じず、実際にPDFを生成してページ数・ヘッダー・フッター・最終本文を確認する。
