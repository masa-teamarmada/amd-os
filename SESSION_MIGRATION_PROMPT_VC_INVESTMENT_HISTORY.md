VC投資履歴の確認・追加収集を、2026-11-10の現行状態から再開する。作業場所は`/Users/masa/projects/AMD/amd-os`。`pwa/`をセッションの作業場所にしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_VC_INVESTMENT_HISTORY.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/design/vc_list.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-5-research-assets-quick-start.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

状態スナップショット:

- `/vcs/investments`は本番稼働中。VC一覧とは別タブで、SU、ラウンド、VC参加を同じ正本から表示する。
- VC個別出資額とラウンド総額、出資・完了日と公表日、成立状態と確認状態を別項目にしている。
- 収集はAMDのPJと接点があるVCだけ。人が呼ぶ処理で最大5社ずつ調べ、`gemini-3.5-flash-lite`以外では停止する。自動定期実行はない。
- 収集結果は必ず候補。根拠があっても人の確認前に確認済みへ上げない。
- 2026-11-10の本番DBは参加記録162件。候補10件、旧台帳124件、却下28件、確認済み0件。候補は5VC・10SU、VC個別額あり0件、ラウンド総額あり3件。
- 最終収集は2026-09-09。実装commit `793acfb7`はmainと本番の両方に含まれる。
- handoff作成前の`main`と`origin/main`は`923fb71ba`で一致。2026-11-10の本番は`v3.165.23`、版情報SHAは`8f14d083...`。間の1commitは画面へ出ない文書変更。

次タスク:

1. `git fetch origin main`を行い、`HEAD...origin/main`と未送信commitを確認する。遅れがあれば作業前にff-onlyで解消する。
2. PCのChromeで`/vcs/investments`を開き、確認状態を「収集候補」に絞る。スマホ幅のWeb確認は行わない。
3. 候補10件を一件ずつ開き、SU名、VC名、投資取引、ラウンド、日付、VC個別額、ラウンド総額を根拠本文と照合する。資料に無い値を推定しない。
4. 根拠が揃う行だけ`confirmed`、投資事実を支えない行は`dismissed`へ確定する。候補と確認済みを混在表示したままにしない。
5. 現行画面に採否操作が無い場合は、先に候補の詳細、根拠、確認・却下を安全に操作できる導線を設計する。状態変更は管理権限者だけにし、更新後のDB読戻しと監査記録を確認する。
6. 候補10件の採否が終わった後、まさが追加収集を望む場合だけ、AMDのPJと接点がある次の5VCを収集する。新規行は候補のまま保存し、同じ確認手順を繰り返す。
7. 製品仕様を変える場合は、利用手順、設計正本、必須導線、DB正本、両附則、開発履歴、必要な回帰検査を同じ変更で更新する。PWA変更後は正規の反映スクリプトでmainへ送り、本番の版情報とPC画面を読み戻す。

守ること:

- 初回収集では、検索結果の誤った遷移先やトップページを根拠として扱う誤りが起きた。根拠URLの最終遷移先、ページ本文、VCとSUの一致、投資取引の記載、日付・金額の本文存在を確認する。
- VC個別出資額とラウンド総額を相互に補完しない。発表と払込完了も相互に読み替えない。
- 旧台帳124件は`legacy_unreviewed`のまま保持し、今回の候補確認と混ぜて一括確定しない。
- main一本。新しいbranchや作業ツリーを作らない。対象ファイルだけを明示して記録し、`git add .`は使わない。
- PWAはPCのChromeで確認する。依頼がない限りスマホWeb確認やSwift版の変更を行わない。
