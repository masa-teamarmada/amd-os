# SESSION MIGRATION PROMPT — SX月次提出版と共通印刷組版

```text
cd /Users/masa/projects/AMD/amd-os

あなたは株式会社チームアルマダの社内OS「AMD OS」を引き継ぐえいみ。SX 2026年7月提出版は、SX自身の6月実提出版と同じ構造で再生成済み。各PJの月次提出版は、そのPJ自身の直前月実提出版をフォーマット正本にし、KUTE等の他PJ書式を共通適用しない。提出版PDFは各ページ上部へ提出先・対象月と「取扱注意 / Confidential」を置き、下部フッター・ページ番号・本文後の空白最終ページを出さない。

## 最初に読む順

1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/AGENTS.md
5. /Users/masa/projects/AMD/amd-os/CLAUDE.md
6. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
7. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
8. /Users/masa/projects/AMD/amd-os/pwa/spec/3-2-monthly-reports-current-spec.md
9. /Users/masa/projects/AMD/amd-os/pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md
10. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md の `[monthly-reports/submission-trailing-page]`、`submission-dignity`、月次品質項目
11. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md の「SX 7月提出版の再生成と全PJ共通の印刷組版修正」
12. /Users/masa/projects/knowledge/sx.md のPF factual guard、BNV、EWIR、知財戦略、2026年7月時系列

## 状態スナップショット

- canonical cwd / branchは `/Users/masa/projects/AMD/amd-os` / `main`。月次提出版の最終実装commitは `a9f398ec`、本番確認SHAは `208151dd`、当時のbuildは `v3.53.5`。後続mainにも修正は含まれる。開始時に `git status -sb --untracked-files=all`、`git rev-parse HEAD`、`git rev-parse origin/main`、`git rev-list --left-right --count HEAD...origin/main`、`git worktree list --porcelain`、`curl -fsS https://amd-os-pwa.vercel.app/api/build-info` を取り直す。
- SX提出本文の正本はAMD OS `monthly_reports_external` の `p21` / `202607`。BNV定例は投資検討に向けたDDの一環、PFは提案した経営体制でも出資検討可能との回答まで。出資内諾・条件合意・リード投資家化・着金は未合意。知財マッピングは以前に完了済みで、7月の追加対応なし。
- EWIRは初出で `Ehime Water Innovation Roundtable（愛媛水イノベーション・ラウンドテーブル）` と展開する。外部関係者のフルネーム、人物別の活動査定、相手を「動かす」「巻き込む」表現は提出版へ出さない。
- 印刷CSSは名前付き`@page`と`page: submission`を禁止し、提出版／社内版で唯一の既定`@page`を切り替える。条件分岐した`pageRule`はstyled-jsxへ補間せず、通常の`style`要素へ直接出力する。
- productionのログイン済みSX実DOMから作ったA4 PDFは3ページ。全ページに共通ヘッダー、フッター・ページ番号なし、4ページ目なし、最終ページに「以上のとおり報告する。」ありをPNGで確認済み。検証用一時fixture/PDF/PNGはcloseout時にTrashへ移動済みで、repoには残していない。
- DB schema、新規migration、環境変数、API route、権限変更はない。

## 次タスク

この修正に未解決はない。まさから追加フィードバックが来たときだけ、対象PJ・対象月の `/project/[projectId]/report/[ym]/print?template=submission` をログイン済み本番で開き、保存済み本文と本番CSSを確認してから直す。SXについて「6月と同じフォーマット」「最後のヘッダーだけの紙をなくす」「フッターを全ページから消す」という意図を崩さない。完了報告は、OS実データからPDFを生成し、先頭・中間・最終ページを目視して指摘が消えた後にだけ行う。途中で新しい不具合を見つけた場合は、以前から知っていたような言い方をせず、発見時点を明確にする。

## 確立済みの運用ルール

- main一本。branch/worktreeを新規作成しない。対象ファイルだけを明示stageし、`git add .` / `git add -A` は使わない。
- 月次生成は`kaku-report`を適用し、Fable 5をCode Routine内で動かす。別の従量課金API経路へ逃がさない。
- 各PJの直前月実提出版から構造・文体・情報密度だけを継承し、前月事実や他PJの書式を持ち込まない。初回seedと構造変更は人の明示承認が必要。
- 概要にはsource件数、draft生成・更新履歴、内部処理名を出さず、当月の主進展、判断・リスク、来月の焦点を3〜5文へ統合する。
- PWAコードまたはユーザー表示を変えるときはbuild versionをpatch bumpし、spec・manual・changelog・BUGS・development logを同じ変更単位で同期する。
- PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。push成功だけで終えず、Vercel Readyとproduction `/api/build-info`のSHAを確認する。
- PDFの完了条件は、ログイン済み本番DOM、実PDFのページ数、全ページのヘッダー、フッター0件、最終ページ本文、PNG目視。簡略fixtureやコード差分だけを根拠にしない。
```
