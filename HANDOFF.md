# AMD OS Handoff

Last updated: 2026-07-30 JST

Target: `/Users/masa/projects/AMD/amd-os`

Topic: D-7通知をBZM追記と経営ノウハウ追加へ分離し、説明・iPhone導線・closeoutを同期

## Latest Session Summary

- D-7 (`textbook_insight`) は、候補ごとに `metadata_json.destination_kind` を明示する。候補の型 `practice_kind` から保存先を推測しない。
- `bzm_textbook` は「BZM追記候補」。yesは候補を承認済みにし、BZM本文はlocal applierだけが後続で追記する。
- `management_knowledge` は「経営ノウハウ追加候補」。yesは `管理 → 経営ノウハウ` に本文、分類、成熟度、タグ、再利用する場面、次に確認することを1件保存し、候補を反映済みにする。元会議メモ・AMDプロトコル・BZM本文は変更しない。
- 通知カードは候補本文を重複表示せず、保存先・保存項目・押した結果を先に示す。保存先未定義の候補を採用操作として見せない。
- iOS判断キューは先頭1件で止まらず、下へスクロールして次の通知を連続確認できる。D-7のラベル・追加先・結果もPWAと合わせた。
- 実装履歴と既存候補の状態は [`pwa/design_log/sessions_2026-07.md`](pwa/design_log/sessions_2026-07.md) の「2026-07-26〜30 — D-7通知」節にある。

## Repo / Production State

- canonical branch: `main`。このHANDOFFを含むcloseout文書は current `HEAD` としてmainへ反映し、PWA production `v3.51.23` を確認済み。
- D-7の実装基準commit: `919c8a8c`（経営ノウハウへのrouting）、`9b684106`（通知型の整理）、`6f3dc4b2`（経営ノウハウ保存先を許可）。いずれもmainに含まれる。
- schema migration 193 は適用済み。経営ノウハウ候補の `target_bzm_slug` と `proposed_section` はNULLにできる。
- 既存候補 `bfc4b8a8-5b3f-420a-b82c-0fc09663f410` は `management_knowledge` へ再分類済み。BZM追記先はNULL、通知は1件、経営ノウハウ正本はまだ0件。まさが採用を選んだ時だけ1件保存される。
- worktree: root 1件のみ。旧detached `b108` は状態と空patchを `/Users/masa/.codex/cleanup_archives/20260730-amd-os-b108-closeout/` に保全して削除済み。

## Unresolved Tasks

- 実装の未解決はなし。
- 上記の既存候補は、OS上でまさが内容を見て採用/不採用を判断する対象。採用時は必ず `management_knowledge_entries` がちょうど1件増え、BZM・元資料が増えていないことをreadbackする。

## First Next Action

新しいD-7候補または採用後の不整合が報告された時だけ、最初に `destination_kind`、カードの追加先/保存項目/押すと起きること、候補status、経営ノウハウ行数をread-onlyで突合する。保存先が空・曖昧なら候補生成側を止め、通知で推測採用させない。

## Pointers

- 通知の採否・画面仕様: [`pwa/spec/3-7-notifications-current-spec.md`](pwa/spec/3-7-notifications-current-spec.md)
- D-7候補・保存先・outbox仕様: [`pwa/spec/3-13-l2-textbook-insights-current-spec.md`](pwa/spec/3-13-l2-textbook-insights-current-spec.md)
- L2実行経路: [`pwa/design/L2_DATA.md`](pwa/design/L2_DATA.md)
- 通知UI設計: [`pwa/design/notifications.md`](pwa/design/notifications.md)
- OSマニュアル: [`pwa/manual/3-3-notifications-and-tsukuyomi.md`](pwa/manual/3-3-notifications-and-tsukuyomi.md)
- iOS正本 / Android移植条件: [`ios/DESIGN.md`](ios/DESIGN.md) / [`ios/HANDOFF_ios_to_android.md`](ios/HANDOFF_ios_to_android.md)
- バグ・再発防止: [`pwa/BUGS.md`](pwa/BUGS.md)
- 開発履歴: [`pwa/design_log/sessions_2026-07.md`](pwa/design_log/sessions_2026-07.md)
- 次セッション用prompt: [`SESSION_MIGRATION_PROMPT.md`](SESSION_MIGRATION_PROMPT.md)

## Verification Evidence

- 実装時: `npm run test:textbook-destination-contract`、`npm run test:governance-candidate-gate`、`npm run test:critical-ui`、`npx tsc --noEmit`、`npm run build` 成功。iOSは実機install/launchを確認済み。
- 今回の文書同期: `npm run test:textbook-destination-contract`、`npm run test:critical-ui`、`git diff --check` を実行。PWA productionは `v3.51.23` / `main` / `dirty=false` を確認済み。

## Closeout Classification

- work type: `development`
- durable note: `pwa/spec/3-7`、`pwa/spec/3-13`、`pwa/design/notifications`、`pwa/design/L2_DATA`、`pwa/manual/3-3`、`pwa/BUGS.md`
- design_log: 更新あり。製品の通知採否・保存境界・iOS導線・schema/API/UI実装の履歴だから。
- main alignment: `main aligned`
- archive condition: `archive ok`。rootはclean、ahead/behind 0/0、conflictなし、worktreeはrootのみ、local branchはmainのみ。
