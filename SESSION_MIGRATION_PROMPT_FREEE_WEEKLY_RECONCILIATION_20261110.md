freee週次会計照合の確認を再開する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションの作業場所にしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/HANDOFF_FREEE_WEEKLY_RECONCILIATION_20261110.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/manual/6-10-freee-accounting-reconciliation-spec.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/spec/5-3-automation-responsibility-current-spec.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

状態:

- 毎週木曜10:00 JSTにAMD OSでfreee週次会計照合が動く設計。
- この会話で最後に確認したのは2026-09-03分。`review_only #3`、検出21件、口座残高差7件、同期状態11件、役員報酬未消込2件、照合元不足1件、未処理明細0件、内部振替候補0件、自動反映0件だった。
- 照合元不足のため、振替伝票の異常仕訳検査は0件ではなく未実施だった。
- 2026-09-03以降の実行状況、参照権限不足、役員報酬候補の解消状況は未確認。必ず最新のAMD OSデータを読み直す。
- きよの収支スプレッドシートは読み取り専用の参考資料。AMD OSの財務テーブルが正本。
- closeout前のリポジトリは`main`、HEAD `042e37acf`、`origin/main`と一致し、未反映変更・競合・追加branch・追加作業場所は無かった。

次の作業:

1. 確認時点のJST週に対応する会計照合の実行をAMD OSで探す。
2. 成功、review-only段階、検出件数、口座残高差、役員報酬候補、内部振替候補、停止・エラーを集計する。
3. 今週分が無い、失敗、または異常仕訳検査が未実施なら、原因を調べてまさへ知らせる。
4. 再実行が必要な場合は、仕様に記載された週単位の重複防止と30分の実行中判定を確認できた経路だけを使う。

守ること:

- freeeへ直接書き込まない。
- 残高差を直接補正しない。勘定科目や仕訳を推測しない。
- Slackとメールへ通知しない。
- 最初の成功4回は必ず`review_only`。5回目以降も完全一致条件以外は要レビューのままにする。
- 役員報酬候補と内部振替候補が完全一致でも、現行仕様ではfreeeへの書込みは停止固定。
- 生データ、口座名、個人情報、秘密値を報告へ出さない。
- 候補0件と、取得失敗・参照権限不足・未検査を混同しない。
- リポジトリを変更する場合はmain一本、着手前と送信前に共有先を確認し、対象ファイルだけを明示して記録する。`git add .`は使わない。
- 今回の再開が読み取り確認だけなら、コード、仕様、DB、freee、スプレッドシートを変更しない。

