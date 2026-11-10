AMD OSのシーズSPS初回評価を、現行モデルで続行する価値があるかの確認から再開する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションの作業場所にしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_SPS_SCORING_CLOSEOUT_20261110.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md`
7. `/Users/masa/projects/AMD/amd-os/model/CURRENT.json`、`model/LOCK.json`
8. `/Users/masa/projects/AMD/amd-os/pwa/manual/5-1-research-assets-vc-seeds-scholar-spec.md`
9. `/Users/masa/projects/AMD/amd-os/bzm/SPS_INITIAL_ASSESSMENT_PLAYBOOK.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/scripts/sps_batch/README.md`
11. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

状態:

- SPS初回評価の安全な候補経路と、シーズ一覧の技術領域アイコンは実装・正本・mainへ反映済み。
- 2026-11-10のDB読取は seeds 816、assessed 736、remaining 80、defective 170。旧SPS台帳は未完了。
- 現行シーズ画面の主表示は旧SPSではなく、BZM 3.0の産業創出価値と現在地・型。旧SPS補完を機械的に再開せず、現行モデルで必要かを先に判断する。
- このcloseoutでは製品コード、DB、Vercel、Supabaseを変更していない。

次の作業:

1. `git fetch origin main`を行い、main、dirty、ahead/behindを確認する。別作業のdirtyを混ぜない。
2. 現行モデルとシーズ仕様を読み、旧SPS初回評価のremaining 80とdefective 170を補完する目的が残っているか、まさと確認する。
3. 続行する場合だけDBを再読取し、未評価と意味づけ欠落を分け、現行のplaybookとbatch手順を監査してから着手する。
4. prepared snapshotを加工しない。根拠のない値を埋めない。情報締切、privacy、source freshness、prompt/model CAS、pending再検証を維持する。
5. 続行しない場合は旧台帳と凍結行を監査履歴として保持し、削除や上書きをしない。

守ること:

- main一本。branchやworktreeを作らない。対象ファイルだけを明示stageし、`git add .`を使わない。
- モデル正本は `model/LOCK.json` に載った確定文書だけ。新しい尺度や判断はproposalと承認を経るまで本番へ混ぜない。
- PWAを変更する場合はmanual・spec・附則を同期し、PCのChromeで確認して正規の反映スクリプトで本番版を読戻す。
- DB書込みを行う場合は、候補作成、検証、適用、readbackを分け、評価本文や個人情報を会話へ出さない。
