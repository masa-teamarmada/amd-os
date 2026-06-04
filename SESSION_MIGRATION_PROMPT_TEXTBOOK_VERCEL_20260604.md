# Session Migration Prompt - Textbook / Vercel Approval Gate / Cloudflare Reader

```text
あなたはClaude側でAMD OS / Textbook / Vercel approval gate の作業を引き継ぐ。

まず次を読む:
1. /Users/masa/projects/AMD/amd-os/HANDOFF_TEXTBOOK_VERCEL_CLOUDFLARE_20260604.md
2. /Users/masa/projects/AMD/amd-os/pwa/design/SPEC_pwa.md
3. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
4. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-06.md
5. /Users/masa/projects/AMD/amd-os/AGENTS.md
6. /Users/masa/projects/AMD/amd-os/CLAUDE.md
7. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
8. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md

状況:
- Textbook本文推敲の小刻みpush/deployでVercel daily deploy quotaを消費し、まさが「24時間開発が止まる致命的タイムロス」と判断した。
- Textbook下書き確認はPWA productionではなくCloudflare Pages static readerへ逃がした。
- Cloudflare reader URL: https://textbook-draft.pages.dev/
- 2026-06-04時点でVercel deploy上限は緩和。deploy自体は再開OK。
- ただしVercel production deploy / preview deploy / Vercel自動deployを起こす可能性があるpushは、deploy bundleが準備できた時点で必ずaskuserquestion承認を取る。

絶対ルール:
- Textbook本文md編集と台帳更新は通常どおり進めてOK。md承認待ちは不要。
- Vercel production deploy / preview deploy / Vercel自動deploy対象pushは、deploy bundleが準備できた時点で承認ゲートを通す。
- deploy bundleには、含める変更、除外する変更、local build/test/browser確認結果、deploy予定回数、push/deploy先、rollback/本番確認方法を含める。
- 微細UI、軽微CSS、md、コメント、ログ文言などを1件ずつdeployしない。複数worker成果を束ねる。
- deploy bundleが準備できたら、push/deployはまだしてない、で止まらず、必ず実際にaskuserquestionを投げる。
- 承認待ちは approval pending として台帳に残す。未分類blockerにしない。止めるのはそのdeploy bundleだけで、local実装、local build/test、レビュー、台帳更新、次タスク整理、別worker切り出し、差し戻しは進め続ける。
- `pwa/scripts/deploy.sh` は `AMD_OS_VERCEL_DEPLOY_APPROVED=1` なしでVercelに到達する前に停止する。

最初に実行:
cd /Users/masa/projects/AMD/amd-os
git status -sb
git diff --stat
git log --branches --not --remotes --oneline

現在の未完:
1. push/deployはまだ未承認。deploy bundleなしでpushしない。
2. 次にAMD OS PWAへ出す場合は、local build/test/browser確認後、deploy bundleを作り、準備できた時点で必ずaskuserquestion承認を取る。
3. Textbook読書確認は https://textbook-draft.pages.dev/ を使う。Vercel fallback禁止。

確認済み:
- Cloudflare reader: HTTP 200。
- deploy script: approval envなしで exit 1。
- Vercel deploy: このhandoffでは未実施。
- git push: このhandoffでは未実施。

完了時:
- git diff --checkを通す。
- conflict marker scanを通す。
- local commitまで。push/deployが必要ならdeploy bundle承認後だけ。
- finalには push/deploy有無と理由を明記する。
```
