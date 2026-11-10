AMD OSのキラー要素カタログについて、暫定実装を確定へ進める検証設計を行う。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションの作業場所にしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_KILLER_FACTOR_VALIDATION_20261110.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `pwa/manual/1-1-intro.md`、`pwa/spec/1-3-reconstruction-coverage-audit.md`
6. `model/README.md`、`model/MODEL_VERSION_LEDGER.md`、`model/CURRENT.json`、`model/LOCK.json`
7. `model/proposals/2026-11-10_killer-factor-validation-protocol.md`
8. `bzm/sps-current-reachability-model.md` §3.4
9. `bzm/BZM_2_0_MULTIDISCIPLINARY_AUDIT_2026-08-11.md` §3.2、§4.1、§4.2、§5
10. `pwa/spec/3-8-cockpit-current-spec.md`、`pwa/manual/2-3-pj-cockpit.md`
11. `pwa/BUGS.md`

状態:

- PWAのキラー要素ページにある四段階と全体判定は暫定実装で、BZMの確定尺度として承認されていない。
- 現行モデルで確定しているのは、キラー要素を数値化した予測因子ではなく、影響工程の入力を聞き直す契機として扱うこと。
- 候補ごとの定義票、過去事例の独立評価、既存工程への追加価値、前向き検証、候補単位の採用・統合・棄却を未承認提案へまとめた。モデル正本とPWAは変更していない。
- まさは最初から暫定実装として扱っていた。確定仕様のように扱ったのはえいみ側であり、まさ側へ暫定扱いを求める説明をしない。
- 新しいモデルの構築中なので、まさの発言をそのまま仕様へ変換せず、BZMとして妥当かを実例と複数評価者で検証する。
- この引き継ぎ、検証提案、再開文は2026-11-10のcloseoutでmainへ記録する。次回は現在のmainと未保存ファイルを取り直す。

次の作業:

1. `git fetch origin --prune`を行い、main、dirty、ahead/behindを確認する。別作業のdirtyを混ぜない。
2. `model/proposals/2026-11-10_killer-factor-validation-protocol.md`を現行モデルと多分野監査に照らして精査する。
3. まさとの議論で、検証単位、対象PJ、評価者、採用・統合・棄却の判定条件を決める。四段階を前提にしない。
4. 最初の三候補は「経営陣の意思疎通」「プロジェクト管理」「経理体制」。各候補を独立キラー要素、既存工程の入力、AMDの予防作業、症状、重複へ分類する。
5. ORB、tiem、r3ktだけに結論を合わせず、当時資料を確保できる追加PJを含める。複数の情報締切を置き、二人以上が結果を伏せた状態で独立評価する。
6. 提案が承認されるまでは、モデル正本、承認台帳、ロック、PWAの段階と全体判定、DBを変更しない。
7. 承認された場合だけ、まさの承認原文を承認台帳へ記録し、正本反映、再ロック、附則、本番表示の順で進める。

運用:

- main一本。対象ファイルだけを明示してstageする。
- 新しい概念・尺度・判定条件は`model/proposals/`へ置き、承認前に正本や本番評価へ混ぜない。
- 承認された場合だけ、承認原文の記録、正本反映、再ロック、附則、本番表示の順で進める。
- 件数や順序段階を、そのまま減衰率、PJ間比較、全体危険度へ変換しない。
- PWA仕様を変更した場合はmanual・spec・全画面仕様・附則を同期し、PCのChromeで本番を確認する。依頼がない限りスマホWeb確認を行わない。
