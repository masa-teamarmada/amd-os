# 次セッションへの引き継ぎ（2026-09-16 ゴールツリーTODO移動／closeout済み）

あなたは株式会社チームアルマダのAMD OSを引き継ぐえいみ。cwdは `/Users/masa/projects/AMD/amd-os` に固定し、`pwa/` をcwdにしない。

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/pwa/HANDOFF_pwa_rebuild.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-21-question-tree-current-spec.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-9-question-tree.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md` の 2026-09-16 ゴールツリーTODO移動の節

## 状態スナップショット

- ゴールツリーでTODOを動かせなかった原因は、TODOを論点間で付け替える経路が実装されていなかったこと。TODO移動を禁止する仕様や記録は無かった。
- 機能commitは `bf0a34c374de53fa2fbc6ca80c552487ed0a116b`。このcommitは後続の `origin/main` に祖先として入っている。次の作業開始時は `git fetch origin main` し、最新HEADを正本として扱う。
- 最上位TODOの左つまみを、承認済みで開いている論点へ落とせる。1リンクなら移し替え、複数リンクなら `移し替える` / `両方に残す` を選択。未承認TODOは提案先だけを替える。親子・日程・担当・前後関係は変えない。
- DB関数 `move_project_action_question_link` は migration `ios/supabase/migrations/20260916070000_move_goal_tree_actions.sql` で本番適用済み。同一PJ・最上位TODO・承認済みかつ開いた論点だけを許可する。
- 本番確認は `v3.140.4` で行った。SOLの「愛媛大学名義の基本合意書のベース作成と学内承認確認」に操作つまみが出ることをデスクトップと390px幅で確認済み。実データは移動していない。
- 直前の単独TODO採否復旧は `3df5371a`。`POST { resource: "proposal_bulk", decision, ids }` が正本で、承認は単独タスクを残し、却下は論理削除する。
- 正規checkout `/Users/masa/projects/AMD/amd-os` は他セッション作業を含むdirtyと分岐を持つ。開始時に `git status -sb` で実数を確認する。reset、stash、`git add .`、他人の変更のcommitをしない。実装が必要なら最新mainから使い捨てclean cloneを作る。

## 検証と運用

- 今回は `npm run test:question-tree-action-move`、`npm run test:issue-reorder`、`npx tsc --noEmit`、変更箇所のESLint、`npm run build`、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`、本番の操作表示を確認済み。
- PWA反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。`npx vercel` は使わない。production確認は `/api/build-info` のSHAで行う。
- `npm run lint` は今回と無関係な既存違反310件で失敗する。直すなら別タスクとして原因を分類する。

## 未解決

TODO移動に残作業はない。実データを動かす必要が出たときは、まさが対象と移動先を指定してから実行する。


## SOLガント 引き継ぎ（2026-09-16）

SOLのガントを引き継いで。作業分類は開発。読む順は① /Users/masa/projects/AGENTS.common.md ② /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md ③ /Users/masa/projects/AMD/SOL/HANDOFF_GANTT.md ④ 最新origin/mainのHANDOFF_SOL_GANTT_2026-09-16.md → pwa/spec/3-21-question-tree-current-spec.md → pwa/manual/2-9-question-tree.md → pwa/BUGS.md → CLOSEOUT_SOL_GANTT_2026-09-16.md。

正規repoは /Users/masa/projects/AMD/amd-os、検証用main cloneは /tmp/sol-gantt-20260916。機能11db2794はmainへpush済み。本番確認v3.140.9、終了時build-infoは後続cbc56159。共有元は3未pushコミット・29dirtyで復旧統合未完了。復旧patchの場所と全パス、隔離担当・判断条件はCLOSEOUT文書にある。共有元をreset/stash/一括pushしない。現在値はfetch/statusで確認する。

依頼された機能は完了。ガントの各工程で「＋ タスク追加」→新規作成／既存から選択が使える。次は追加依頼があるときだけ実装し、既存のゴールツリー関係・親子・承認を維持する。共有元の整理は対象の統合判断を得てから差分単位で進める。工程を開いたらMSかタスク、親期間は子の最小〜最大。元のUIを守り、資料の見た目へ寄せない。資料画像は /Users/masa/projects/AMD/SOL/work/20260916_gantt_reference.png。

migration 20260916160000 / 20260916210000は適用済み、再適用不要。検証は工程投影・実route・型検査・build、作成/紐付け/移動/解除と狭幅表示。今回の本番確認ではテストタスクを保存していない。実装者レビューと独立監査を混同しない。反映はrepoルートで AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh、公開build-infoとログイン画面でreadback。既存の別案件の引き継ぎ節を消さない。
