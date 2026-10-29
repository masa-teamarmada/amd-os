# 引っ越しプロンプト — ゴールツリー 承認フローと言葉の立て直し（終了済み）

このセッションは **2026-10-29 に閉じた。残作業は無い。**
続きを起こす必要は無く、下の内容は「ゴールツリーを次に触る人が、当時の決定を踏まないための前提」として残す。

---

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`（えいみ共通ルールの正本）
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`（AMD横断の記憶）
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-21-question-tree-current-spec.md`（ゴールツリーの実装仕様。これが正本）
5. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-9-question-tree.md`（使い方）
6. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md` の先頭2件（本番で押して見つけた5件、一括置換の罠）
7. `/Users/masa/projects/AMD/amd-os/HANDOFF_GOAL_TREE_2026-09-13.md`

## 状態スナップショット（2026-10-29 確認）

- 作業場所: `/Users/masa/projects/AMD/amd-os`。`main` 一本、`origin/main` と一致、未pushなし。
- 本番: `v3.163.66`。このセッションの作業（v3.110.0〜v3.115.0）はすべて取り込み済み。
- 当時使った使い捨てのclean cloneは消えている。再現には新しく clone する。
- 承認フローは稼働中。未承認TODOは p07 45件・p30 35件・SX 30件・p20 13件・p00 10件・p19 6件・p33 3件・p25 2件。未承認の論点/MSは p07 40件・SX 12件・p19 1件・p20 1件。
- DBに作業用の退避テーブルが2つ残っている（`ewir_rename_backup_20260912` 88行、`ewir_rename_targets_20260912`）。まさが不要と言えば削除してよい。

## ゴールツリーを触るときに踏んではいけない決定（まさ確定）

- **「木」「やること」「木に入れる」「いらない」を画面に出さない。** ツリー / TODO / 承認 / 却下 / 削除 / 先行 / 後続 / 追加 のような通用語をそのまま使う。標準語を柔らかい言い換えに置き換えない。比喩を書かない。`check_pwa_critical_ui.cjs` が禁止語を検査する。
- **未承認は上へ抜き出さない。** ツリーの中で、承認したら入る位置に描いて光らせる。「承認したらどこへいくか分からないのに承認できない」が理由。
- **未承認は数に入れない。** 件数・pt・MSの集計・ガント・TODOタブのすべてから外す。入力はツリー側がメインで、TODOとガントは確認するだけ。
- **MSは消さない。** 中身が空でも骨格として残す。MSを起点に論点を並べる場所。消すのはMSの下の作業TODO。
- **MSの置き場所は縛らない。** どの行でもMSにでき、MSの下にMSも置ける。縛ると、ある行をMSにするかを人が決められない。
- **仮説と「どれか1つでよい」は別の軸。** 仮説はそれぞれ検証する。「どれか1つで解ける」は親の性質（`children_logic`）。1つの列で兼ねない。
- **承認済みの行を提案へ戻すときは `parent_id` と `contribution` を `proposed_*` へ写す。** `proposal_accept` が `parent_id = proposed_parent_id` を書くので、写さないと承認した瞬間に根へ飛ぶ。

## 確立済みの運用ルール

- 反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。`git push` 単体だと検査を全部すり抜ける。`BUILD_VERSION` は毎回上げる。
- DBは MCP の `apply_migration` で反映し、同じ内容を `ios/supabase/migrations/` へ記録として残す（ローカルと本番の履歴が分かれているため `npx supabase db push` は使わない）。
- 本番データを変える前に、対象行を Drive の `<pj>/YYMMDD_件名/` へ `jsonb` で退避する。
- **実装したら本番で実際に押し、件数を数える。** 型検査・ビルド・契約テストが全部緑でも、画面に出ない行・効かないボタンは捕まらない（BUGS.md の5件がすべてこれ）。
- 本番で試したデータは元の値へ戻す。
- ワークスペース配下で行の中に小さなボタンを置くときは、最初から `.親 button.自分` と書く。クラス1つでは `.sx-management-workspace button { min-height:44px }` に負ける。
