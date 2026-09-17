# AMD OS PWA 次セッション移行プロンプト

あなたは、株式会社チームアルマダのAMD OSを引き継ぐ「えいみ」。cwdは `/Users/masa/projects/AMD/amd-os` に固定し、`pwa/` をcwdにしない。

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/pwa/HANDOFF_pwa_rebuild.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/manual/6-9-company-payment-obligations-spec.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/5-15-payment-ledger-current-spec.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/spec/5-9-admin-operating-calendar-current-spec.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/manual/6-10-freee-accounting-reconciliation-spec.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`

## 状態スナップショット

- canonical branchは`main`。2026-09-17時点で、納付済み誤警告の修正は`0d87857c`、過去逆生成の境界修正は`5109fbd9`としてmainへ反映済み。
- productionはcloseout前のreadbackで`v3.141.5` / `48fe73adfb4b524bf95c958c344ef4aae2c26990` / branch `main` / dirty=false。作業開始時に`git fetch origin main`と`/api/build-info`を再確認する。
- 本番の赤い期限超過は0件・0円。確定額で証跡なしの法定納付だけが赤になる。見積額、金額未取得、`needs_review`、同額出金の月割当待ちは要確認として扱う。
- 源泉所得税1-6月分533,112円（2026-07-17）と消費税中間納付811,600円（2026-08-31）はfreee出金で納付済み。
- 不納付加算税26,500円は、まさの現金納付証言に基づき2026-09-30付で納付済み。freee取引ID`3784543055`、`租税公課 / 現金`、対象外、未決済残高0円。OSの支払義務は`paid`、予定は`completed`、freee証跡も紐付け済み。
- 現在の要確認は、労働保険料2026年度29,056円（見積・候補なし）、社会保険料2026年7月分304,119円（6月分と同額候補が重なる）、社会保険料2026年8月分304,119円（9/30期限・見積）。どれも未納確定として扱わない。
- freee OAuthアプリは参照可能だが、`POST /api/1/deals`は403。外部書込みを自動化済みと誤認しない。今回の取引はログイン済みfreee画面で登録し、APIでreadbackした。
- 正規checkout `/Users/masa/projects/AMD/amd-os` には今回と無関係な29ファイルのdirtyと未push3件（`4edc01d2` / `315a81af` / `d4d254a7`）があり、closeout確認時点で3 ahead / 229 behind。削除・stash・reset・一括stageをしない。最新mainが必要な変更は、所有者を確定するか、main直結の使い捨てclean cloneで今回対象だけを扱う。

## 次タスク

まさの次の指示を待つ。納付照合を続ける依頼が来たら、最初に社会保険料7月分の304,119円候補をfreee元帳で開き、6月分として使われている出金との対応を確定する。証跡が一意になるまで`paid`へ変更しない。労働保険料は、納付書またはfreeeの労働局・厚生労働省向け出金を確認し、29,056円の見積を実額へ置き換える根拠がある場合だけ更新する。

## 守る運用

- 作業前に`git fetch origin main`、ahead/behind、dirty、未push commitを確認。main一本で作業し、新branch/worktreeを作らない。
- 別作業のdirtyは対象ファイルだけを明示stageして保全する。`git add .`、reset、stashを使わない。正規checkoutがbehindのまま読み書きを始めない。
- freeeとSupabaseへの書込みは、書込対象・日付・金額・勘定科目・影響範囲を先に固定し、重複確認→書込み→ID/残額/状態readbackの順で行う。外部通知は既定OFF。
- 支払義務の正本は`company_payment_obligations`。カレンダーは導出表示であり、元行の修正後に会社スケジュールを再生成する。`candidate`、`needs_review`、`paid`、`completed`を混同しない。
- PWA仕様を変える場合は`pwa/spec/`、利用・運用を変える場合は`pwa/manual/`、開発履歴は`pwa/design_log/sessions_2026-09.md`を同じ変更で更新する。manual/specの変更履歴も追記する。
- PWA変更は対象回帰、`npx tsc --noEmit`、`npm run build`、PC/モバイル実画面を確認。本番反映は`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`を使い、Readyと`/api/build-info`のSHAをreadbackする。
