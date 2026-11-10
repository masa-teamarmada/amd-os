AMD OSで、LSTの重要進捗をコックピットへ確実に記録し、必要なスコア再評価へつなぐ仕組みを設計する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションの作業場所にしない。

最初に読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_LST_IMPORTANT_PROGRESS_20261110.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `pwa/manual/1-1-intro.md`
6. `pwa/spec/1-3-reconstruction-coverage-audit.md`
7. `pwa/spec/3-8-cockpit-current-spec.md`
8. `pwa/design/cockpit.md`
9. `pwa/design/project_strategy_signals.md`
10. `pwa/design/L2_DATA.md`
11. `model/README.md`、`model/CURRENT.json`、`model/LOCK.json`
12. `pwa/BUGS.md`

状態:

- 経営会議で、LSTとEvonikのJDA締結という大きな進捗が共有された。
- 現状は、こうした重要進捗をコックピットへその場で確実に入れる簡単な導線がない。
- MTGサマリから自動抽出できる可能性はあるが、取りこぼしへの不安を消せないため、それだけを正本の入口にしない。
- 今回は設計相談だけで、コード、DB、スコア、manual、spec、model正本は変更していない。
- 推奨案は、コックピットの経営ハイライトに `重要進捗を記録` を置き、一回の登録からハイライト、証拠台帳、到達見込みの根拠候補、SPS再評価候補へ展開すること。
- MTGサマリ抽出は補助導線とし、手入力済み事実との重複時は新規加点せず根拠を統合する。
- 入力直後のスコア直接更新は禁止し、既存の独立レビューと追記型公開手順を通す。

次の作業:

1. Gitの未反映引き継ぎ資料を、所有タスクごとに分けて記録・pushする。現在の管理環境は`.git`書込み不可のため、このセッションでは実行できなかった。
2. 現行のコックピット、MTGサマリ取込、証拠台帳、SPS再評価・公開経路をコードとDB定義で確認する。
3. 重要進捗一件の流れを図にし、既存イベント構造へ接続できるかを先に判断する。
4. 画面配置、入力項目、重複判定、再評価承認者、公開時点をまさと合意する。
5. 合意後だけ、manual・spec・全画面仕様・附則・必要なモデル提案を同期して実装する。

守ること:

- main一本。新しいbranchやworktreeを作らない。対象ファイルだけを明示してstageする。
- 事実の保存、自動抽出、再評価候補、スコア確定を別の状態として扱う。
- JDA締結を理由に根拠なくスコアを上げない。同じ事実を二重加点しない。
- 新しい評価概念や数式が必要なら`model/proposals/`へ置き、承認・再ロック前に本番評価へ混ぜない。
- PWA変更時はmanual・spec・全画面仕様・附則を同じ変更で更新し、PC版Chromeで確認する。
