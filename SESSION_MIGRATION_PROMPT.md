# 次セッション migration prompt (2026-08-21 作成)

## 読む順
1. `/Users/masa/projects/AGENTS.common.md` — えいみ共通ルール正本
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — AMD level memory
3. `/Users/masa/projects/AMD/amd-os/HANDOFF.md` — 直近セッション(Slack署名検証)の状態
4. `/Users/masa/projects/AMD/amd-os/pwa/spec/2-1-pwa-runtime-routes.md` — Slack Interactive routeの現行仕様
5. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md` の `[slack/interactive-multi-app-signature]` — 今回の教訓

## 状態スナップショット (2026-08-21時点)
- canonical checkout: `/Users/masa/projects/AMD/amd-os`、branch `main` のみ
- `git status -sb`: clean（`## main...origin/main`）
- 直近push済みHEAD: `dd4d54eb docs(handoff): record Slack signing-secret fix in BUGS and HANDOFF`
- **重要**: このリポは常時複数セッション(司令塔+worker、Codex含む)が並行稼働する共有checkout。着手前に必ず `git fetch origin main` → `git log --oneline -15` → `git status -sb` で現在地を再確認すること。HANDOFF.md記載時点よりHEADが進んでいる可能性が高い。
- 今回セッションの成果(Slack Interactive署名検証の複数secret対応)は実装・本番反映・正本反映(spec/manual/BUGS/HANDOFF)まですべて完了済み。追加の未解決タスクなし。

## 次タスク
まさから明示の新規依頼はまだ無い。次セッションは、まさが新しく持ち込む依頼に対して、上記「読む順」でこのリポの現在地(HANDOFF.md最新版 + git最新HEAD)を確認してから着手する。

## このPJで確立済みの運用ルール
- main一本運用、ブランチ・worktree作成は全面禁止(`git status`がdirtyでも理由にならない)
- commitしたら即push、1機能=1commit
- PWAの本番反映 = `main` push → Vercel自動deploy。事前承認不要、push・deploy完了まで止めずに進める
- 設計変更は同じcommitで `pwa/spec/`(確定実装仕様) と `pwa/manual/`(利用者向け) を更新する。AMD OSの新仕様は必ず `pwa/manual/*.md` に反映してからhandoffを閉じる
- バグ・運用ミスは `pwa/BUGS.md` に症状/原因/対応内容/再発防止策の4項目形式で記録
- HANDOFF.mdはスリムに保つ(200行目安)。恒久仕様はspec/manualへ、開発セッション履歴は `design_log/` へ逃がす
