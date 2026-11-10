AMD OSの全PJ共通支払ルールを確認・保守する作業を再開する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションの作業場所にしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_COMMON_PAYOUT_POLICY_20261110.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/manual/7-1-reward-calc-spec.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-14-monthly-work-agreement-current-spec.md`
9. `/Users/masa/projects/AMD/amd-os/ios/DESIGN.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

状態スナップショット:

- 2026-10-02に、100円単位の切上げと、キャップ由来で残る税抜1万円以下の未払分を当月へまとめる規則を全PJ共通化した。202609以降の未確定稼働月へ100円切上げ、202610以降に条件を満たす少額残高を清算する。
- 切上げ分は会社負担。pt、発生報酬、契約予算、バッファは変えない。少額清算は当月に正の現金支払があり、残高がcap由来で、対象財布のcapが正である場合だけ。非現金配賦、積立、支払ゼロ月、丸めだけの端数は対象外。
- 発行済み通知書、保存済み支払、支払・入金確認済みの月は保護する。保護月の保存済み未払残高・未使用枠・相殺繰越を次月計算の起点にし、保護snapshotが無い場合は停止する。
- 日次更新は全PJ共通の計算経路を呼ぶ。初回の一括反映・照合も同じ経路を使う。通知書発行、送付、振込はこの更新に含めない。
- 実装は `e26b87483a44532927339225bacc96b70a359e88`。当時に全10PJ・120か月を照合し、確定済み1か月を保護したまま119か月を更新した。通知書・保存済み支払明細の変更なし、日次更新の再実行で二重加算なしを確認済み。
- ネイティブ側は共有報酬JSONを読むが、独自計算と切上げ加算表示は未移植。今回の最後のcloseoutではDB再計算、通知、振込、通知書発行、再配布を行っていない。

再開時の作業:

1. 最初に `git fetch origin --prune`、`git status -sb --untracked-files=all`、`git rev-list --left-right --count HEAD...origin/main`、未送信commit、worktree、local branchを確認する。現在のmainと一致しない、または別作業の変更があれば、その帰属を保ったまま進める。
2. 金額・繰越・保護の異常を調べる時は、まず現行仕様と対象月の保存値を読取りで比較する。PJ別の仮仕様や手作業の補正を追加しない。
3. 未確定月を再計算する必要がある場合は、日次更新と同じ `syncRewardSummaryForCycle` を経由する。一括照合には `pwa/scripts/refresh_common_payout_policy.mts` を使い、既定の読取り確認を先に行う。
4. 発行済み通知書、保存済み支払、支払・入金確認済み月がある場合は、その月を保護する。保護snapshotが無い状態を再計算で埋めない。通知書・振込・メール送信を報酬キャッシュ更新の副作用にしない。
5. 製品仕様を変える場合は、manual 7-1、spec 3-14、iOS DESIGN、両附則、回帰検査を同じ変更で更新する。PWA変更後は正規の反映手順でmainへ送り、本番の版情報とPCのChrome表示を確認する。スマホWeb確認は不要。

守ること:

- 同じ条件なら全PJで同じ計算結果になる。特定PJだけの例外をOSへ置かない。
- 切上げ加算は会社負担であり、後月に取り戻さない。少額清算は前倒しの元本で、未発生報酬の先払いではない。
- main一本。新しいbranchやworktreeを作らない。対象ファイルだけを記録し、`git add .`は使わない。
- えいみはメールを送らない。対人通知・振込・確定操作は、依頼された対象と条件を読取りで確定してから扱う。
