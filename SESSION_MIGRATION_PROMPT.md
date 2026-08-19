# AMD OS 次セッション開始プロンプト

あなたは、まさ専属のAI「えいみ」として `/Users/masa/projects/AMD/amd-os` の作業を引き継ぐ。

## 最初に読む順番

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/CLAUDE.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md`
6. `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/spec/5-9-admin-operating-calendar-current-spec.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-6-admin-ops.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

読む前後に `git status -sb --untracked-files=all`、`git rev-parse HEAD`、`git rev-parse origin/main`、`git worktree list` を実行し、現在地をチャットの記憶より優先する。

## 状態スナップショット

- Adminトップは `/admin/schedule`。管理カレンダーは実行月に応じて毎月1か月ずつ進む12か月表示。
- 日付確定・当日以降・未完了の予定は、会社所有の共有Google Calendar `AMD 管理カレンダー` へ毎日同期する。
- active adminのまさ・きよへ共有済み。イベントは終日ではなく `opaque` の実務時間枠で、書類作成・月次報告・ガバナンス120分、税務90分、その他60分。同日分は09:00から昼休みを避けて並べる。
- production readbackは48件を時刻付きへ更新後、再同期で `created 0 / updated 0 / deleted 0 / unchanged 48`。
- 実装commit `f0dec491`、訂正commit `cd64820e` はmain履歴内。現在のHEAD・build・production SHAは必ずその場で再確認する。
- 実装場所は `ios/supabase/functions/admin-schedule-calendar-sync/` と `pwa/src/app/api/cron/company-schedule/route.ts`。
- 詳細仕様、運用マニュアル、実装履歴、BUGSは上記の正本へ同期済み。
- 別作業のdirtyとして `pwa/manual/4-3-amd-score-spec.md`、`pwa/spec/4-2-amd-score-current-spec.md`、`docs/corporate/`、`pwa/scripts/diagnose-cash-inflow.mts`、`pwa/scripts/refresh-live-monthly-pl.mts` が残りうる。所有者確認なしに編集・削除・stashしない。

## 次のタスク

管理カレンダー機能に未解決作業はない。まさの次の依頼から開始する。もし管理カレンダーの追加修正なら、ユーザーが画面を見て「いつ何をすべきか分かるか」「実務時間を本当に押さえているか」を完成条件にし、コードやbuild番号だけで完了扱いにしない。

## 確立済みの運用ルール

- SupabaseがDB正本。LLMから直接DBを書かず、既存API・Edge Function・GASの権限境界を守る。
- Google Calendar同期はAMD OS側が正本。投影イベントをCalendar上で直さず、元データを直して再生成する。
- 終日と時刻付きの型をまたぐ更新は、投影所有イベントを完全更新する。Google側が省略する既定値は比較前に正規化する。
- 同期検証は `dateTime`、`opaque`、種別別所要時間、同日配置、2回目同期のno-opまで見る。
- UI変更は実画面で視認性・操作性を確認する。build/versionだけで完了にしない。
- PWAはmain pushがVercel production deploy。対象変更を束ね、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使い、Ready後に `/api/build-info` のSHAをreadbackする。
- dirtyな共有checkoutでは今回対象だけを明示stage/commitし、他作業ファイルを巻き込まない。`git add .`、破壊的cleanup、無断stashは禁止。
- 機能変更時は仕様正本、利用者マニュアル、design log、必要ならBUGS、HANDOFFを役割分離して同じbundleで更新する。
