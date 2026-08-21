# 次セッター引き継ぎプロンプト (2026-08-22 JST 作成)

## 0. 最初に読む (この順)

1. `/Users/masa/projects/AGENTS.common.md` — えいみ共通ルール正本
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — AMD レベルの記憶索引
3. `/Users/masa/projects/AMD/amd-os/CLAUDE.md` — モノレポ大原則 (main 一本 / ブランチ作成全面禁止 / `git add .` 禁止)
4. `/Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md` — PWA 固有 (BUILD_VERSION bump / deploy.sh / 3層 md 正本)
5. `/Users/masa/projects/AMD/amd-os/pwa/HANDOFF_pwa_rebuild.md` — 直近セッション状態と次の一手
6. `/Users/masa/projects/AMD/amd-os/pwa/design/cockpit.md` — 今回触ったコックピットの設計正本
7. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md` — 教訓 (今回 `[cockpit]` エントリを追加)

## 1. 状態スナップショット

- cwd: `/Users/masa/projects/AMD/amd-os`
- branch: `main` のみ。worktree も `/Users/masa/projects/AMD/amd-os` のみ。**このセッションで作った branch / worktree: none**
- HEAD: `f04b338d`（このセッションの handoff commit を積んだ後は最新を再確認すること）
- 未push commit: 0
- BUILD_VERSION: HEAD 上は `v3.89.1`（他セッションが並行 bump している。採用前に必ず `pwa/src/lib/build-info.ts` の現在値を読む）
- 本番: https://amd-os-pwa.vercel.app — 今回の変更 (v3.88.3) は p21 / p10 で目視確認済み

### 他セッションの dirty（**触らない・戻さない・commit しない**）

- staged deletion: `pwa/src/app/api/project/[projectId]/plan-value-check/route.ts` / `pwa/src/lib/project-plan-value.ts` / `pwa/src/types/project-plan-value.ts`
- modified: `pwa/src/components/cockpit/CockpitAmdScoreDetailTab.tsx` / `pwa/src/components/seeds/SeedDetailModal.tsx` / `pwa/src/components/sps/CurrentSpsAssessmentCard.tsx` / `pwa/src/components/sps/SpsFormulaPanel.tsx` / `pwa/src/components/sps/SpsScreeningBandSection.tsx`
- この dirty のせいで `npm run -s test:critical-ui` がローカルで落ちる（`SeedDetailModal.tsx missing critical UI anchors: project_links?.[0]?.project_id, /plan-value-check`）。**自分の変更由来ではない**。plan-value-check を消しているセッションが契約テストのアンカーも同時に外す責任を持つ。stash / revert しない。

## 2. 直前セッションでやったこと（完了済み）

まさの依頼:「各PJのコックピットに事業計画のタブがあったはずなんだけど、なんかUI上から消えてる…。復活させてほしい」→ 履歴を追うと事業計画タブは 2026-07-28 に **SX (p21) 専用**として作られたもので、全PJに存在したことは一度もなかった（まさの記憶違い）。要望の実質を「各PJで事業計画タブを見たい」と読んで全PJ常設化した。この判断はまさへ明示済み。

- `a92d4510` 事業計画タブを全PJ常設化。あわせて資本政策プラン (`CapitalPlanWorkspace`) の正本を会社概要タブ → 事業計画タブへ移動（編集導線は事業計画タブが唯一）
- `f8effee8` (v3.88.3) スコア詳細タブにあった「イベントと月次試算表」「年度別の事業・資金推移」(= `Bzm22TimeLedger`) を事業計画タブへ移設。両タブ共有の pilot ローダー `bzm-2-2-pilot-client.ts` を新設し、BZM 2.2 pilot 対象外PJ (p10 など) では 404 を `Bzm22PilotNotFoundError` で受けてセクションごと非表示にした
- 契約テストのアンカーは Observatory から新ホスト `Bzm22TimeLedgerSection.tsx` へ付け替え済み

## 3. 次セッションの最初の行動

**必須の宿題は無い。** 未解決タスクはゼロ。まさから新しい依頼が来たらそれを最優先にする。
コックピット周りを触る場合だけ、以下3つの契約を守ること（HANDOFF にも同文あり）:

1. **全PJ常設タブにPJ固有データを無条件で置かない。** 対象外PJでは 404 をエラーカードにせず「非表示」に倒す（今回の p10 事故と同型）
2. **契約テストのアンカーは消さずに新ホストへ付け替える。** `pwa/scripts/check_pwa_critical_ui.cjs` / `check_bzm_2_2_pilot_ui_contract.mts`
3. **資本政策プランの編集導線は事業計画タブが唯一の正本。** 会社概要タブへ戻さない

## 4. このPJで確立済みの運用ルール（違反すると事故る）

- **main 一本。ブランチ作成・worktree 作成は全面禁止。** `spawn_task` で次セッションを起票しない（起動導線が worktree を作る）
- **`git add .` 禁止。** 今回触ったファイルだけを列挙して stage する。他セッションの dirty は残したまま進める。「別件の dirty があるので push していない」は禁止
- **コード変更で deploy するなら `pwa/src/lib/build-info.ts` の `BUILD_VERSION` を bump。** 迷ったら patch
- **本番反映 = `main` push（Vercel 自動 deploy）。** 原則ノンストップ・事後報告。`npx vercel` 直叩きは禁止。`pwa/scripts/deploy.sh` は clean tree hard-stop があるので、他セッション dirty がある時は素の `git push origin main` を使う
- **md 3層正本**: 使い方 = `pwa/manual/`、確定実装仕様 = `pwa/spec/`（未移行は `pwa/design/`）、理論 = `pwa/bzm/`。変更した層の附則 changelog (`manual/9-3-appendix-changelog.md` / `spec/6-1-appendix-changelog.md` / `bzm/9-5-appendix-changelog.md`) に日時つきで必ず追記する。**今回この追記を1コミット分うっかり飛ばした** ので、handoff 前に changelog を必ず突き合わせること
- 列名・テーブル名は想像で書かず `pwa/design/db_schema.md` を grep する
- python heredoc に日本語を書くと UTF-8 エラーになる。bash heredoc は問題ない
