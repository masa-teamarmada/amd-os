# SESSION MIGRATION PROMPT — D-7通知 / 経営ノウハウ保存

```text
cd /Users/masa/projects/AMD/amd-os

あなたは、株式会社チームアルマダの社内OS「AMD OS」を引き継ぐえいみ。D-7通知の保存先と採用結果が分からないというまさの指摘を受け、BZM追記と経営ノウハウ追加を明確に分けた実装・仕様・マニュアルを引き継ぐ。同じ実装をやり直さず、以下の順で現在の正本を確認してから着手する。

## 最初に読む順

1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/AGENTS.md
5. /Users/masa/projects/AMD/amd-os/CLAUDE.md
6. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
7. /Users/masa/projects/AMD/amd-os/pwa/spec/1-1-overview.md
8. /Users/masa/projects/AMD/amd-os/pwa/spec/1-2-document-layer-migration-map.md
9. /Users/masa/projects/AMD/amd-os/pwa/design/README.md
10. /Users/masa/projects/AMD/amd-os/pwa/design/L2_DATA.md のD-7節
11. /Users/masa/projects/AMD/amd-os/pwa/spec/3-7-notifications-current-spec.md
12. /Users/masa/projects/AMD/amd-os/pwa/spec/3-13-l2-textbook-insights-current-spec.md
13. /Users/masa/projects/AMD/amd-os/pwa/design/notifications.md
14. /Users/masa/projects/AMD/amd-os/pwa/manual/3-3-notifications-and-tsukuyomi.md
15. /Users/masa/projects/AMD/amd-os/ios/DESIGN.md の通知・D-7節
16. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md の `[notifications/D-7]` 項目
17. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md の「2026-07-26〜30 — D-7通知」節

## 状態スナップショット

- canonical cwd / branch は `/Users/masa/projects/AMD/amd-os` / `main`。開始時に `git status -sb --untracked-files=all`、`git rev-parse HEAD`、`git rev-parse origin/main`、`git worktree list --porcelain`、production `/api/build-info` をread-onlyで確認する。
- D-7の実装基準は `919c8a8c`、`9b684106`、`6f3dc4b2`。schema migration 193は適用済み。current productionは `v3.51.23` を基準にし、実SHAは開始時に読み直す。
- `textbook_insight_candidates.metadata_json.destination_kind` が必須。`bzm_textbook` と `management_knowledge` の二択で、候補の型 `practice_kind` から保存先を推測しない。
- `bzm_textbook`: 通知は「BZM追記候補」。yesはcandidateを`approved`にするだけ。BZM本文はVercel runtime/iOS/PWAから直接編集せず、必要なreview後にlocal applierだけが追記する。
- `management_knowledge`: 通知は「経営ノウハウ追加候補」。カードは `管理 → 経営ノウハウ`、本文とは別の `分類 / 成熟度 / タグ / 再利用する場面 / 次に確認すること`、yes時の保存結果を表示する。yesは `management_knowledge_entries` に重複なしで1件保存しcandidateを`applied`にする。元会議メモ・AMDプロトコル・BZM本文は変更しない。
- iOSの判断キューはカードを縦に連続表示する。先頭だけで止まると決めつけず、下へスクロールして各カードの `n / total` を確認する。
- 既存候補 `bfc4b8a8-5b3f-420a-b82c-0fc09663f410` は経営ノウハウ候補へ再分類済み。BZM slug/sectionはNULL、分類operations、成熟度hypothesis、タグは許認可・開業準備。通知は1件、経営ノウハウ行は0件なので、まさが採用を選ぶまで正本は増えない。

## 次タスク

1. まさから新しい通知の見え方・保存内容・採用結果について報告があった時だけ、その通知ID/候補IDを特定し、`destination_kind`、カードの「追加先」「追加・更新する情報」「押すと起きること」、candidate status、関連正本行をread-onlyで照合する。
2. `management_knowledge` のyes後は、同一source refで `management_knowledge_entries` がちょうど1件、candidateが`applied`、BZMファイル/元会議メモ/AMDプロトコルに変更なしを確認する。重複やBZM変更があれば即不具合として扱う。
3. 保存先が空、候補本文だけで何を保存するか分からない、契約・開催履歴などの対象正本が特定できない通知は、肯定採用を可能にしない。生成側で`needs_source`または非通知に戻し、UIに「確認を記録するだけ」「追加先未定義」を出して判断を丸投げしない。
4. 新しい通知仕様を変える場合は、実装だけで閉じない。該当spec/design、`pwa/manual/3-3-notifications-and-tsukuyomi.md`、manual/spec changelog、`pwa/BUGS.md`、development design_logを同じcommitで同期する。

## 確立済みの運用ルール

- main一本。branch/worktreeを新規作成しない。共有checkoutに他taskのdirtyがあっても、対象ファイルだけを明示stageし、`git add .` / `git add -A`は使わない。
- 通知は内部名や曖昧な候補名を表示せず、まさが押す前に「どこに」「何が」「どの状態で」入るかを明示する。結果報告・空振り・内部再試行は通知しない。
- DBの候補・outbox・notificationは正本反映ではない。採用操作のwrite boundaryとreadbackを分け、候補を見ただけで正本へ保存しない。
- PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。生の`git push`や`npx vercel`は使わない。PWAコード/表示内容を変えるdeployでは `pwa/src/lib/build-info.ts` をpatch bumpする。
- 変更後は少なくとも対象回帰検査、`npm run test:critical-ui`、`npx tsc --noEmit`、`npm run build`、production `/api/build-info` を確認する。iOSを変更したらbuildだけで済ませず、実機install/launchまで確認する。
- 本番データを推測で直接書き換えない。候補採用の実データ更新は既存feedback APIか明示されたapplierを使い、書込み後は対象件数と副作用なしをreadbackする。
```
