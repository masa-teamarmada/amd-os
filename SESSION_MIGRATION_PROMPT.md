# SESSION MIGRATION PROMPT — authenticated PWA performance closeout

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
8. /Users/masa/projects/AMD/amd-os/pwa/spec/2-1-pwa-runtime-routes.md
9. /Users/masa/projects/AMD/amd-os/pwa/spec/3-14-monthly-work-agreement-current-spec.md
10. /Users/masa/projects/AMD/amd-os/pwa/manual/6-6-member-billing-prompts-spec.md
11. /Users/masa/projects/AMD/amd-os/pwa/manual/9-3-appendix-changelog.md
12. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
13. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md

状態スナップショット:
- authenticated PWA 全体の初回表示を軽くする修正は `89956e6f` と `351255cf` で main に反映済み。
- `(app)/layout.tsx` は月初合意の重い bundle を SSR で実行しない。`AppShell` mount 後に既存の認証済み `GET /api/monthly-work-agreement` を読む。判定・必須モーダル・skip 条件は変えない。
- `MonthlyAgreementExperience`、`TsukuyomiChatDrawer`、dashboard の `MyPageContent` / `CompanyContentShelf` は必要時だけ dynamic import する。
- Company Content は `IntersectionObserver` (`rootMargin: 600px`) で shelf が近づいた時に 1 回だけ取得する。情報・導線を消さない。
- `CriticalRealtimeNotify` は hidden tab で polling を止め、visible 復帰で即 refresh、foreground fallback は 60 秒。Supabase Realtime 購読は維持。
- initial production dashboard の安定後比較は DOM `3108 -> 1409`、画像 request `78 -> 1`。scroll 後に Company Content の画像 77 件を読み込むことも確認済み。
- docs closeout 前の production readback は `v3.44.8 / c10b4af947a5142f8984cfc843a1e0b28f2d3b80 / main / dirty=false`。新しい deploy 後は必ず取り直す。

検証済み:
- `./node_modules/.bin/tsc --noEmit --pretty false`: clean。
- `npm run lint`: 新規 regression なし（既存許容パターン 1 件）。
- `npm run build`: success。
- `npm run test:critical-ui`: success。client fetch 版の月初合意 gate anchor を guard へ反映済み。

次回開始時に必ず実行:
git fetch origin main
git status -sb --untracked-files=all
git rev-list --left-right --count HEAD...origin/main
git log -1 --oneline origin/main
curl -fsS https://amd-os-pwa.vercel.app/api/build-info

運用ルール:
- local checkout、origin/main、production `/api/build-info` を並べて current truth を決める。
- shared root `/Users/masa/projects/AMD/amd-os` は multi-writer。reward-finance、notifications、H-1 reviewer、L6 extract、Atlas、Book A などの他レーン差分を stage・reset・削除しない。
- shared root の SHA や dirty が動く時は、main の disposable clean clone で対象ファイルだけを bundle 化する。
- `git add .` を使わない。対象ファイルだけを明示 stage する。
- authenticated shell へ重い fetch / static import / polling を足す時は、route scope、lazy import、hidden tab 停止を最初に検討する。
- PWA production deploy は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。CLI 直接 deploy はしない。
- raw 本文、個人情報、secret、private URL を durable artifact に残さない。
```
