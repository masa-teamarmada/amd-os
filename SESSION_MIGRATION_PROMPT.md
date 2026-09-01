# 次セッション用プロンプト — AMD OS PWA（2026-09-01 クローズ）

`/Users/masa/projects/AMD/amd-os` を cwd にして作業する。

最初に次をこの順で読む。

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/pwa/AGENTS.md`
5. `pwa/HANDOFF_CX_2026-09-01.md`
6. `HANDOFF_ZMP_WORKSPACE_2026-09-01.md`
7. `pwa/manual/1-1-intro.md`
8. `pwa/spec/1-3-reconstruction-coverage-audit.md`
9. `pwa/spec/2-7-ui-design-code-current-spec.md`
10. `pwa/spec/3-8-cockpit-current-spec.md`
11. `pwa/spec/3-16-project-weekly-control-current-spec.md`
12. `pwa/manual/2-3-pj-cockpit.md`
13. `pwa/BUGS.md` のPWA/project-workspace節
14. `pwa/design_log/sessions_2026-09.md`

## 現在地

- 正本は `main`。開始時に `git fetch origin main`、`git status --short --branch`、`git log --oneline -5` で fresh readback をする。
- CX p20 の論点追加は、`project_management_tracks` が空なのに表示だけ4分類へフォールバックしていた不整合を migration 358 で復旧済み。保存APIが許可する4分類は「事業開発・技術開発・資金調達・体制構築」。
- 論点・仮説リストは `f7495b7a`、本番 build `v3.100.14`。ユーザーの意図は列幅ではなく行の縦幅。8列と全文表示を維持し、空の補助行と44pxの共通ボタン最小高を除いて、短い行を浅くした。
- 認証済みの実画面での視覚確認は未実施。ローカルではログイン境界までを確認済み。次のUI変更ではログイン済みの検証環境で実画面も確認する。
- `HANDOFF_ZMP_WORKSPACE_2026-09-01.md` はZMPワークスペース作業の引き継ぎ。内容をこのCX作業と混ぜない。

## 共有作業ツリーの境界

- BZM P1原稿・監査（`bzm/PAPER_P1_*`、`bzm/SM_*`、`bzm/sm_v2/*`、`bzm/AUDIT_*`）と `pwa/design_log/sessions_2026-08.md` の未コミット差分は別作業。stage、revert、削除、整形をしない。
- PWA変更は `cd pwa` して実行する。共有dirtyの間は `pwa/scripts/deploy.sh` のclean-tree guardを回避しようとせず、所有者の作業を混ぜない。

## 次にやること

新しい依頼を待つ。PWAを変更するときは、該当する仕様・マニュアル・附則と `build-info.ts` を同じ変更に含め、型検査・対象契約テスト・critical UI・buildを通す。`main` pushが本番反映なので、push後は build-info をreadbackして確認する。ブランチは作らない。DBへの直書き、Vercel CLI直接deploy、共有dirtyのまとめstageはしない。
