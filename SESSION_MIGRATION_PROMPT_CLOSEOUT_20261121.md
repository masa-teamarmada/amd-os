# 次セッション引き継ぎ — 2026-11-21 クローズ

作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションの作業場所にしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_CLOSEOUT_20261121.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. 依頼に対応する個別の `HANDOFF_*.md` と仕様・マニュアル
6. `pwa/BUGS.md` または `ios/BUGS.md`（変更対象に応じて）

状態:

- 2026-11-21のcloseout時点で、`main` と `origin/main` はHEAD `791a9b0e9` で一致。未送信commit・競合・追加worktree・ローカルbranchはない。
- 今回は月次報告書の完了記録を確認しただけで、新しい製品仕様、DB、外部送信、公開は行っていない。
- `S01_富士山_日本語.md` は2026-11-19からrepoルートに残る、別セッションの未追跡記事原稿。作成者と正本は未確認。内容は変更・削除・一括保存しない。

次の作業:

1. 新しい依頼の範囲に合わせて、最初に `git fetch origin main`、`HEAD..origin/main`、未追跡ファイルを確認する。
2. 富士山原稿を扱う必要がある場合は、原稿担当と正本を確認し、保存先・Git管理・削除可否を決めてから操作する。
3. PWAを変える場合は、利用手順・仕様・附則・必要な他プラットフォーム向け引き継ぎを同じ変更で更新し、PCのChromeで確認してから正規の反映手順で本番へ出す。

運用:

- main一本。別作業の未保存ファイルは保持し、対象ファイルだけを明示して記録する。`git add .`は使わない。
- メール送信、権限変更、外部共有は行わない。必要な連絡は下書きまで。
- SOL DDの本番データ・配布物・出力ジョブは、まさの明示的な本番反映指示まで変更しない。
