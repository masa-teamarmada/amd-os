AMD OSで、シーズの現行BZM 3.0評価と旧SPS凍結履歴の関係を確認する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションの作業場所にしない。

最初に読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_SPS_SCORING_CLOSEOUT_20261110.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `pwa/manual/1-1-intro.md` と `pwa/spec/1-3-reconstruction-coverage-audit.md`
6. `model/README.md`、`model/CURRENT.json`、`model/LOCK.json`、`model/MODEL_VERSION_LEDGER.md`
7. `model/cases/README.md`、`model/cases/SCORES.md`、`pwa/spec/4-8-bzm30-seed-score-panel-current-spec.md`
8. `pwa/design/seeds.md`、`pwa/design/SPEC_pwa.md`、`pwa/manual/5-1-research-assets-vc-seeds-scholar-spec.md`
9. `pwa/BUGS.md`

状態:

- 2026-08-25にNano Frontierをシーズ台帳へ登録し、同日に旧 `sps-ind-tier0-v1` の金額帯を凍結した。この帯はBZM 3.0の案件スコア `V` ではない。
- 正本ではSPSはBZM 3.0の出力であり、旧式を一次選別専用として運用し続ける決定は確認できない。
- 2026-09以降、BZM 3.0の案件スコアを保存・表示する経路がある。Nano Frontierに現行行があるか、旧帯が画面へどう出るかは未確認。
- 自動化導入の引き合いは、契約の有無、月額、拘束工数、本業との近さ、検証への寄与を分けて評価する。引き合い件数だけで価値を上げない。

次の作業:

1. `git fetch origin --prune` を実行し、mainとの先行・遅れ、未送信commit、共有checkoutのdirtyを確認する。
2. 現行BZM 3.0の正本とシーズ画面の仕様を読み、現在のスコア保存先・表示条件・旧SPS履歴の扱いを確認する。
3. 本番DBを読み取り専用で確認し、Nano Frontierのシーズ本体、旧SPS凍結行、現行BZM 3.0スコア行を分けて取得する。存在しない行を推定しない。
4. PC版ChromeでNano Frontierの詳細を確認し、利用者が見る現行スコアと履歴の表示を読む。
5. 評価を追加・訂正する必要が確認できた場合だけ、現行BZM 3.0の正規経路、候補・承認・追記・読戻しの順で進める。旧凍結行を直接更新・削除しない。

守ること:

- main一本。新しいbranchやworktreeを作らない。共有checkoutの他作業をstage、revert、整形、削除しない。
- BZMの定義、係数、評価規則は、提案、まさの承認、承認台帳、ロック更新の順で扱う。未承認の概念や数値を本番評価へ混ぜない。
- DBは読み取りから始め、候補化、承認、反映、読戻しを混同しない。根拠資料の本文、URL、個人情報、秘密値を記録や報告へ転載しない。
- PWAを変更する場合は、manual、spec、FEATURE_REGISTRY、必要な附則と検査を同じ変更単位で更新し、PC版Chromeで確認する。依頼がないスマホWeb確認は行わない。
