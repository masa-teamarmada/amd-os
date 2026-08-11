# AMD OS Handoff

最終更新: 2026-08-11 JST

対象: MTG prep通知の二重管理廃止、正規checkout同期、つくよみ外部リサーチ初回自然実行の確認待ち

作業種別: 開発・自動化運用・本番反映

## 今回の到達点

- 予定MTGのagenda / 進行案準備はCodexのW-Prep / prep workerへ一本化した。`/api/cron/proactive-todo-extract`は`next_meeting_prep`を新規生成しない。
- 既存のopen / blocked準備TODOは削除せず`dismissed`へ退役し、system解決者・理由・時刻を残す。本番readbackはopen / blocked 0件。
- 開催済みMTGの`next_actions[]`とGmail期限つき依頼の先手TODO抽出は維持した。
- 正規checkout `/Users/masa/projects/AMD/amd-os`を`ahead 3 / behind 122`から`ahead 0 / behind 0`へ復旧した。patch-equivalent / 完全一致 / 後継版をファイル単位で照合し、古い差分を再注入していない。
- 同期後に残った唯一の有意差分は、SX成立条件ナビで`未着手`を`未評価`ではなく中立トーンにする1行だった。build `v3.71.8`の回帰修正としてテスト付きで本流へ統合する。

## 正本と現在地

- MTG prep退役の確定仕様: `pwa/spec/2-4-proactive-todo-current-spec.md`。
- 人向け運用: `pwa/manual/2-6-admin-ops.md` の「/proactive」。
- cron一覧: `pwa/design/L2_DATA.md`、`pwa/design/SPEC_pwa.md`、`pwa/scheduled-tasks/README.md`。
- 仕様回帰: `npm run test:proactive-mtg-prep-retirement`。
- SX未着手の状態契約: `pwa/spec/3-16-project-weekly-control-current-spec.md`、`npm run test:sx-navigation`。
- 実装履歴: `pwa/design_log/sessions_2026-08.md`。事故と再発防止: `pwa/BUGS.md`。
- MTG prep退役実装commit: `41151f12`、production build `v3.71.3`で反映・DB readback済み。
- handoff作成前のcurrent main / productionは`4636fa90`、build `v3.71.7`で一致。closeout bundleのpush後は`git rev-parse HEAD`と`/api/build-info`を再確認する。

## Repo状態

- canonical path: `/Users/masa/projects/AMD/amd-os`。
- branch: `main`のみ。worktree: 正規checkout 1件のみ。
- closeout bundleは、このHANDOFF、`SESSION_MIGRATION_PROMPT.md`、BUGS、開発履歴、SX未着手トーン修正・テスト・spec・build bumpで構成する。
- commit / push後は、未push commit 0、uncommitted / conflict / untracked 0、ahead 0 / behind 0をcloseout inventoryで再確認する。
- `/tmp/amd-os-behind-sync.OeyQry`は同期中だけの復旧用一時バックアップ。closeout完了前に削除する。

## 検証済み

- `npm run test:proactive-mtg-prep-retirement`
- MTG prep退役cronの本番実行と、`next_meeting_prep` open / blocked 0件のreadback
- `git diff --check`
- production `/api/build-info`で`v3.71.7` / `4636fa90` / main / dirty=falseを確認（closeout bundle前）
- 正規checkoutの`HEAD == origin/main`、ahead 0 / behind 0、main以外のbranch・worktreeなしを確認

## 未解決

- つくよみ外部リサーチautomation作成後の最初の自然な平日09:00実行は未観測。2026-08-12 09:00 JST以降にread-onlyで確認する。
- 新規候補0件は正常。通知もoutboxも作らない。まさの明示判断なしに候補の`採用`または`見送り`を押さない。

## 次セッションで最初にすること

2026-08-12 09:00 JST以降なら、つくよみ外部リサーチautomationの自然実行1回だけをread-onlyで確認する。
成功または候補0件、Slack送信なし、新規候補がある場合だけOS通知が1候補1件で作られたことを、件数・skip・error・未確認点だけで報告する。
MTG prepの先手TODOを復活させず、新しいprep automationも作らない。

## 参照先

- 次セッション用プロンプト: `SESSION_MIGRATION_PROMPT.md`
- つくよみ運用: `pwa/manual/3-3-notifications-and-tsukuyomi.md`
- 外部リサーチ仕様: `pwa/spec/3-6-strategy-signals-current-spec.md`、`3-7-notifications-current-spec.md`、`3-8-cockpit-current-spec.md`
- 先手TODO仕様: `pwa/spec/2-4-proactive-todo-current-spec.md`
- 開発履歴: `pwa/design_log/sessions_2026-08.md`
- 再発防止: `pwa/BUGS.md`
