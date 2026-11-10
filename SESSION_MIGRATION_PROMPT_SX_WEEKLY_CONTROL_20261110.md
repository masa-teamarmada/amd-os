AMD OSのSX週次管制を、管制帯の判断から再開する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションの作業場所にしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_SX_WEEKLY_CONTROL_20261110.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-16-project-weekly-control-current-spec.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

状態:

- 関係先リストは、排液調達の行内チェック、名前だけで開始できる追加、役割欄の廃止、全分類共通のPJ優先度まで実装済み。
- 論点・仮説リストはAMDブルー、種類・期限・議論履歴、全文表示に対応済み。
- 論点詳細は、左に背景と親子仮説、中央に過去と今回の議論・派生仮説、右に判断と次の一手を置く高密度3領域。解決済みは一覧下部へ移る。
- migration 247〜250とbuild v3.70.4で初回反映済み。2026-11-10の現行コードと正本にも実装が残っている。
- 未決は週次差分タブの「期限なし」バケットだけ。実装当時76件で、押しても行動につながりにくかった。
- closeout時のGitは `main`、HEAD `12bac35ad`、`origin/main` と一致。未保存ファイルはない。

次タスク:

1. `git fetch origin main`を行い、先行・遅れ・未送信記録を確認する。別作業の変更を戻さず、必要なら対象ファイルだけを扱う。
2. PCのChromeで `/project/p21/weekly-control` を開き、週次差分タブの「期限なし」を押す。件数、元項目、押した後に実際の編集や判断へ進める割合を確認する。
3. 画面を見ながら、まさが「残す」「マイルストーンに接続する工程だけへ絞る」「削除」のどれかを決める。決定前に変更へ着手しない。
4. 決定後、判断待ち／停止／期限超過／7日以内も1つずつ、押した後に行動へ進めるかを点検する。
5. 変更する場合は、現行仕様・利用手順・各附則・業務導線・必要な回帰検査を同じ変更で更新し、対象ファイルだけを記録する。
6. PWA変更後はPC表示だけを確認し、正規の反映スクリプトで本番の版情報まで読戻す。依頼がない限りスマホWeb確認や追加実装は行わない。

守ること:

- main一本で進め、新しいbranchや作業ツリーを作らない。
- 作業前と送信前に共有先を更新し、他作業の未保存ファイルを混ぜない。`git add .`は使わない。
- 管制帯は週次差分タブだけに表示する。担当概念は復活させない。
- 文字を省略記号で切らず、背景・議論・判断・次の一手を同じ論点ワークベンチ内で読める状態を維持する。
- PWAはPCのChromeで確認する。まさはスマホではSwift版を使うため、スマホ幅のWeb確認は行わない。
