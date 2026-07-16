# AMD OS Handoff

Last updated: 2026-07-16 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: 月初合意モーダルの確認事項を発見できるUIへ再設計

## Latest Session Summary

- 月初合意の `未確認` は `合意状態：未合意 / 条件更新あり / 合意済み / 対象外` と理由を示す状態欄へ修正済み。
- 合意事項を小さな2列表から、全幅の `01 担当する仕事` → `02 その対価としての予定額` へ再構成した。
- `01` は全PJの担当内容、`02` は予定額合計と同じPJ順の内訳を表示する。
- 主操作は02の後、参考情報は主操作の後ろで初期状態を閉じる。
- まさが本番画面を確認し、分かりやすくなったと受入確認済み。
- 詳細ログ: `pwa/design_log/sessions_2026-07.md` の「月初合意の合意事項を独立した01・02へ再設計」。

## Current Truth

- Accepted implementation: `8b014291 fix(pwa): make monthly agreement items unmistakable`。
- 月初合意handoff commit: `c33d6f65 docs: hand off monthly agreement UX closeout`。
- Closeout最終時点の `main` / `origin/main`: `ca544b3078ca50753b7e88a67751edd59bb7f8e1`。`c33d6f65` と `8b014291` はそのancestor。
- Production readback: `build_version=v3.43.9`, `git_sha=ca544b3078ca50753b7e88a67751edd59bb7f8e1`, `git_branch=main`, `dirty=false`。
- この最終handoff更新でdocs-only commitが積まれるため、次セッションは `/api/build-info` を再取得し、上記SHAを固定値として扱わない。
- 仕様正本は `pwa/spec/3-14-monthly-work-agreement-current-spec.md`。利用者向け導線はmanual 2-2、開発者向け契約はmanual 6-6。

## Verification Run

- `node pwa/scripts/check_pwa_critical_ui.cjs` -> pass。
- `npm --prefix pwa run build` -> pass。TypeScriptと481 route生成を完了。
- Production browserで `320 / 375 / 768 / 1280px` を確認し、全幅でdocument横overflowなし。
- 必須確認領域のcomputed font-size: 最小12px、番号14px、見出し18px mobile / 20px desktop、担当内容14px、PJ別予定額16px、合計26px mobile / 28px desktop。
- mobile主操作は全幅48px。DOM順は `状態 → 01 → 02 → 主操作 → 参考情報`。
- 旧 `確認して合意する2点` / `1. PJごとの担当内容` はproduction DOMに存在しない。

## Dirty State

今回の月初合意bundleはcommit/push済みで、対象10ファイルに未commit差分はない。root checkoutの残dirtyは別レーン。

| path group | status | class / owner | resolution action | next judgment condition | risk |
|---|---:|---|---|---|---|
| `pwa/bzm/BOOK_A_MASTER_PLAN.md`, `pwa/bzm/terminology_glossary.md`, `pwa/bzm/2026-07-16_narrative_rebuild_ch4_5_merged_v1.md` | M / ?? | other-worker / Book A再構成lane | Book A ownerが単独bundleで検証・commit/deployまたはrevert | 次回Book A closeout前 | medium |
| `pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md` | ?? | preexisting / Book A巻頭lane | まさ確認後にBook A ownerがregister/move/deleteを判断 | 次回Book A closeout前 | low-medium |
| `pwa/design/atlas_routine.md` | M | other-worker / Atlas D-8 lane | Atlas ownerが単独bundleでcommit/deployまたはrevert | 次回Atlas closeout前 | medium |
| `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` | M | other-worker / L6 extract lane | L6 ownerが検証して単独commit/deployまたはrevert | 次回L6 closeout前 | medium |
| `pwa/scheduled-tasks/amd-os-l6-meeting-reviewer/SKILL.md`, `pwa/scripts/check_h1_meeting_summary_reviewer.mjs`, `pwa/scripts/review_h1_meeting_summary.mjs` | M | other-worker / H-1 reviewer lane | H-1 ownerがテスト後に単独commit/deployまたはrevert | 次回H-1 closeout前 | medium |

`amd-payment-obligations` の後続bundleは `ca544b30` でcommit/push/deploy済み。専用worktreeもownerが撤収済み。現在のdirty一覧は変動しうるため、stage前に必ず取り直す。

## Repo / Cleanup State

- Canonical branch: `main`。
- 月初合意セッションが作ったbranch/worktree: none。
- 残っていたmain-alignedの古いClaude worktree 1つとbranch 1本は、証跡保存後に削除済み。
- 今回用のclean cloneと完了済みSonnet workerは削除・終了済み。
- Worktree: root checkout 1つ。Local branch: `main` 1本。Conflict: none。
- 残dirtyが別owner laneにあるため、repo全体のarchive判定は `do not archive`。月初合意lane自体の未処理はない。

## Unresolved Tasks

- 月初合意UI、仕様同期、deploy、responsive検証に必須残タスクなし。
- 新しいフィードバックが来た場合だけ、production current truthを読み直して再開する。

## First Next Action

1. 次セッション冒頭で `git fetch origin main`、`git status -sb --untracked-files=all`、`git rev-list --left-right --count HEAD...origin/main`、production `/api/build-info` を取り直す。
2. 月初合意を続ける場合は、ログイン済みproductionの `/monthly-agreement` と強制モーダルが同じ `MonthlyAgreementExperience` を使っていることを維持する。
3. 別ownerのdirtyを月初合意bundleへ混ぜず、対象ファイルだけ明示stageする。

## Pointers

- Current spec: `pwa/spec/3-14-monthly-work-agreement-current-spec.md`
- Member manual: `pwa/manual/2-2-member-workflows-quick-start.md`
- Developer manual: `pwa/manual/6-6-member-billing-prompts-spec.md`
- Feature registry: `pwa/design/FEATURE_REGISTRY.md`
- Bug / lesson: `pwa/BUGS.md`
- Critical UI guard: `pwa/scripts/check_pwa_critical_ui.cjs`
- Session log: `pwa/design_log/sessions_2026-07.md`
- Next-session prompt: `SESSION_MIGRATION_PROMPT.md`

## Guardrails

- 合意事項を小さい列ラベルやPJ単位の2列表へ戻さない。
- 必須領域で12px未満を使わず、01・02を補助情報より弱くしない。
- 01と02のPJ順を一致させ、担当内容と予定額は折りたたまない。
- 5秒理解、縮小表示、computed font-size、`320 / 375 / 768 / 1280px` の横overflowを完了条件にする。
- UI設計・最終レビューはSol、コード実装とローカル検証はSonnet worker、司令塔は統合とproduction確認を担当する。
- PWA deployはclean checkoutから `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。`git add .`は禁止。
