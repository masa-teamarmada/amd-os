# SESSION MIGRATION PROMPT — 月初合意UX closeout

```text
cd /Users/masa/projects/AMD/amd-os

最初に読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/CLAUDE.md
5. /Users/masa/projects/AMD/amd-os/AGENTS.md
6. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
7. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
8. /Users/masa/projects/AMD/amd-os/pwa/spec/3-14-monthly-work-agreement-current-spec.md
9. /Users/masa/projects/AMD/amd-os/pwa/manual/2-2-member-workflows-quick-start.md
10. /Users/masa/projects/AMD/amd-os/pwa/manual/6-6-member-billing-prompts-spec.md
11. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md
12. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
13. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md

状態スナップショット:
- 月初合意の状態は `合意状態：未合意 / 条件更新あり / 合意済み / 対象外` と理由の一文で表示する。
- 合意事項は全幅の `01 担当する仕事` → `02 その対価としての予定額`。小さい2列表へ戻さない。
- 01は全PJの担当内容、02は予定額合計と同じPJ順の内訳を表示する。
- 主操作は02の後、参考情報はさらに後ろで初期状態を閉じる。
- accepted implementation commit: `8b014291 fix(pwa): make monthly agreement items unmistakable`。
- 月初合意handoff commit: `c33d6f65 docs: hand off monthly agreement UX closeout`。
- closeout最終時点のmain/origin/main: `ca544b3078ca50753b7e88a67751edd59bb7f8e1`。`c33d6f65` と `8b014291` はそのancestor。
- production readback: `v3.43.9 / ca544b3078ca50753b7e88a67751edd59bb7f8e1 / main / dirty=false`。
- この最終handoff更新でmain/production SHAが進むため、次回は必ず `/api/build-info` を取り直す。
- まさがproduction画面を確認し、分かりやすくなったと受入確認済み。

今回確立した仕様:
- 必須領域の最小文字は12px。
- 番号14px、見出し18px mobile / 20px desktop、PJ名と担当内容14px、PJ別予定額16px、合計26px mobile / 28px desktop。
- mobile主操作は全幅48px。
- 01と02のPJ順を一致させる。担当内容・予定額を折りたたまない。
- 長いPJ名は省略せず折り返し、金額列を画面外へ押し出さない。
- `/monthly-agreement` ページと強制表示モーダルは同じ `MonthlyAgreementExperience` を使う。
- 受入条件は、5秒理解・縮小表示・computed font-size・`320 / 375 / 768 / 1280px` のdocument横overflowなし。

検証済み:
- node pwa/scripts/check_pwa_critical_ui.cjs -> pass
- npm --prefix pwa run build -> pass。TypeScriptと481 route生成を完了
- production browser 320 / 375 / 768 / 1280px -> document横overflowなし
- 必須領域 min font 12px、番号14px、mobile見出し18px、desktop見出し20px、担当内容14px、PJ別予定額16px、合計26/28px
- DOM順 `状態 → 01 → 02 → 主操作 → 参考情報`
- 旧 `確認して合意する2点` / `1. PJごとの担当内容` はproduction DOMに存在しない

次タスク:
1. 月初合意UI・仕様同期・deploy・responsive検証の必須残タスクはなし。
2. 新しいフィードバックが来た場合だけ、production `/monthly-agreement` と `/api/build-info` を読み直して再開する。
3. 01・02を小さい列ラベルへ戻す案は採用しない。情報密度より合意事項の発見可能性を優先する。
4. UI変更時はSolが反証レビューし、Sonnet workerが実装・ローカル検証、司令塔が統合・production確認を行う。

次回開始時に必ず実行:
git fetch origin main
git status -sb --untracked-files=all
git rev-list --left-right --count HEAD...origin/main
git log -1 --oneline
curl -fsS https://amd-os-pwa.vercel.app/api/build-info

残dirtyのowner lane:
- Book A再構成: pwa/bzm/BOOK_A_MASTER_PLAN.md, pwa/bzm/terminology_glossary.md, pwa/bzm/2026-07-16_narrative_rebuild_ch4_5_merged_v1.md
- Book A巻頭: pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md
- Atlas D-8: pwa/design/atlas_routine.md
- L6 extract: pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md
- H-1 reviewer: pwa/scheduled-tasks/amd-os-l6-meeting-reviewer/SKILL.md, pwa/scripts/check_h1_meeting_summary_reviewer.mjs, pwa/scripts/review_h1_meeting_summary.mjs
これらを月初合意bundleへ混ぜない。dirty一覧は変動しうるのでstage前に取り直す。
`amd-payment-obligations` は `ca544b30` でcommit/push/deploy済み、専用worktree撤収済み。

確立済み運用ルール:
- branch/worktreeを新規作成しない。dirtyならmainのdisposable clean cloneを使えるが、作業後に削除する。
- 対象ファイルだけ明示stageし、`git add .`を使わない。
- PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。
- local checkout、origin/main、production `/api/build-info` を並べてcurrent truthを決める。
- manual/spec/design/FEATURE_REGISTRY/BUGS/critical UI/changelogの同期を崩さない。
- raw本文、個人情報、secret、private URLをhandoffやdurable logへ残さない。
```
