# HANDOFF — AMD OS PWA

最終更新: 2026-05-21
トピック: HUD Project Signal Board / Macrotrend ASPI 8 / 通知 / 立替精算 / Operations Settings

詳細ログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md)
関連仕様: [`design/README.md`](design/README.md), [`design/SPEC_pwa.md`](design/SPEC_pwa.md), [`design/cockpit.md`](design/cockpit.md), [`design/hud_visual_language.md`](design/hud_visual_language.md), [`design/cyber_dashboard_content_design.md`](design/cyber_dashboard_content_design.md), [`design/macrotrend_atlas_seeds_architecture.md`](design/macrotrend_atlas_seeds_architecture.md), [`design/notifications.md`](design/notifications.md), [`design/amd_score.md`](design/amd_score.md)
関連BUG/教訓: [`BUGS.md`](BUGS.md)

---

## Current Rules

- canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- ユーザー向け確認URL: `https://amd-os-pwa.vercel.app/hud/dashboard`
- hash付きVercel URL (`amd-os-<hash>-armada0130.vercel.app`) はinspect-only。確認URLとして案内しない。
- PWA変更後deployは必ず `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`。`--cwd .../pwa` は禁止。
- 作業ツリーはかなりdirty。未確認dirty filesはrevertしない。

---

## Repo State

- branch: `main`
- HEAD: `03d012e`
- unpushed commits: `git log --branches --not --remotes --oneline` は空で確認済み。
- 本handoff更新ではcommitしていない。dirtyが大きく、次にcleanup方針を決めてからまとめる。
- とくに注意する未整理領域:
  - `pwa/src/app/(app)/hud/**` と `pwa/src/components/hud/**` はHUD版OSの主要実装を含む。
  - `pwa/src/lib/amd-score-derived.ts` はM/X/FとAMD Scoreの共通算定helper。
  - `pwa/src/lib/operations-catalog.ts` と `/api/settings/cron-run` はOperations Settingsのcron実行UI。
  - `gas/155_L2KnowledgeExtractor.js` はAMDプロトコル個別通知化のsource修正済みだが、GAS本番pushは未完了。

---

## Latest Verified Deploy

最後のコード変更はProject Signal Board右側zoneのspacing調整。

```sh
cd /Users/masa/projects/AMD/amd-os/pwa
npx tsc --noEmit
npm run build
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
```

- `tsc`: 成功
- `npm run build`: 成功
- production deploy: 成功
- production HEAD check: `/hud/dashboard` は未ログイン時 `307 -> /auth/login?next=%2Fhud%2Fdashboard`

---

## Completed In This Pass

### Management Score / Finance Ops

- SX FY2026 の月次PL baselineを更新。`pj13` を `SX_FY26` とし、`202606-202703` に `2,570,000円/月` を売上計上、入金は2か月遅れ (`202608` 初回cash inflow) とした。
- `MonthlyPlProject` に `cashDelayMonths` / `cashStartYm` を追加し、売上発生月とcash inflow月を分離。
- `npm run import:monthly-pl-budget` を実行し、`company_budget_monthly` / `company_budget_inputs` / `company_budget_simulation_runs` を再import。`202606` SX_FY26 project_revenue = `2,570,000`, cashRevenue = `0`; `202608` cashRevenue = `2,570,000` をDB確認済み。
- admin経理台帳 `/admin/finance` を追加。`company_finance_recurring_items` でサブスク/固定継続費/自動振替/引落口座/budget forward-fillを管理し、`company_finance_receipt_events` でGmail/freee/manual領収書イベントを受ける。
- migration `068_finance_operations.sql` を適用済み。既存GAS baselineの固定費16件を `company_finance_recurring_items` にseed。二重計上防止のため `budget_forward_fill=false` で開始。
- 領収書イベントを `company_actual_monthly` に同期する `/api/admin/finance/receipts` と、継続費を `company_budget_monthly` にforward-fillする `/api/admin/finance/recurring` を追加。
- Management Score raw intakeが `company_finance_recurring_items` / `company_finance_receipt_events` をfinance signalとして読むよう変更。`202606` で `collect` 成功 (`407` internal signals)、`calculate` 成功 (`snapshotId=0926cfcf-6188-4c4f-b6b8-568d05a14f56`, total=44, finance=61)。
- verification: `npx tsc --noEmit` 成功、`npm run build` 成功、`bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` 成功。production alias `https://amd-os-pwa.vercel.app` 反映済み。
- production HEAD check: `https://amd-os-pwa.vercel.app/hud/dashboard` は未ログイン時 `307 -> /auth/login?next=%2Fhud%2Fdashboard`。

### Macrotrend

- `/atlas/macrotrends` / `/hud/atlas/macrotrends` をASPI Critical Technology Trackerの8 domain正本へ揃えた。
- 以前の5テーマ分類は正本扱いしない。UN 2030 Agenda / WEF Global Risks Report 2026はoverlay evidence、ASPI 8 domainはAMD ScoreのM算定・papers domainと揃う分類軸。
- mapは初期表示でdomain node配下のissue nodeまで展開。Seedsは全node化せず、issue node上のpapers/seeds件数と下段panelで扱う。
- interactionはAtlas Map寄せ。空白dragでpan、node dragで隣接nodeが連動、drag後clickの誤発火を抑止、他node clickで既存展開を閉じない。
- まさ指示に合わせ、`CLAUDE.md` に「メタ判断セルフチェック」を追加。UI都合で新概念を増やす前に、既存正本・DB・算定ロジックと整合するかを自問する。

### Reimbursements

- PWA `/reimburse` で立替精算の新規申請、submittedの編集・削除、PM承認、admin承認を復活。
- 領収書添付はSupabase private bucket `reimbursement-receipts`。
- 登録/編集はbrowser直INSERTではなく `/api/reimbursements` のserver-side保存へ変更。ログインuser確認後、service_roleでDB/Storageへ書く。
- 承認経路は `submitted` -> `pmApproved` -> `approved`。請求書発行対象は `approved` の立替。

### Notifications

- `l2_notifications` / `meeting_notifications` / `app_notifications` / `l2_feedbacks` はadmin authenticated限定へRLS修正済み。adminは `まさ`, `きよ`。
- iOS/APNs配信済みmarkerの `notified_at` と、人間既読markerの `read_at` を分離。
- 既読戻しを実施し、PWA未読は `read_at` 基準へ変更。
- `回答済み` タブを追加。はい/いいえ/コメント送信後は未対応/未読から外れ、回答済み側へ移動し、ボタンは再表示しない。
- AMDプロトコル通知は `project_id + ym` の複数件まとめをやめ、`scope_key=YYYYMM:protocol:<protocol_id>` の1候補1通知へ変更。
- 注意: PWA側は本番反映済み。GAS `155_L2KnowledgeExtractor.js` はsource修正済みだが、`npx @google/clasp push` がGoogle再認証 `invalid_rapt` で未反映。再ログイン後にGAS pushが必要。
- 既読通知は現状DBに蓄積し続ける。retention/archive jobは未設計。

### HUD Dashboard / Cockpit

- HUD Project Signal Boardの本体表示対象を `active` + `ended` に変更し、AMD SCORE降順にsort。
- `sales` / `draft` / `frozen` / `lost` / unknown は `Other Project Files` 折りたたみ。
- AMD ScoreとM/X/F表示の入力行を統一。`evaluated_at <= today` かつ `mu_A/mu_I/mu_G` がある最新行を使う。
- LST (`p07`, ended) はDB上は解析済み。`2026-04-30` rowから `M=15.71 / X=745.57 / F=27 / score=31,625`。
- HUD cockpitのsignal stripはDB算定へ変更。hardcoded snapshotはfallbackのみ。
- ended/frozen/lostなど非live PJでは、先手力ring数値・Step Modal Stack・月次ルーティン・次期MS設定を出さない。HUD headerはlifecycle sealを表示。
- Project Signal Board右側zoneは、AMD SCOREと先手力ringの空白を詰めた。ringを左へ寄せ、PL/PM/Closer blockを9px級に拡大。

### Operations Settings

- `/settings` をadmin-only Operations Settingsへ拡張。
- Raw Data sources / L2 datasets / Cron Controlを一覧化。
- Cron Controlはoperationごとに条件JSONを編集し、`Run Now` で `/api/settings/cron-run` を叩く。
- GAS runFuncはserver-sideで `NEXT_PUBLIC_GAS_WEBAPP_URL` + `NEXT_PUBLIC_GAS_API_KEY`、PWA cronは `CRON_SECRET` を付与。secretはclientへ出さない。
- LST経営会議の収集設計は、GAS hourly triggerが「終了後60-180分」のCalendar eventを拾い、Notion/Gmail抽出を実行。daily fallbackは03:00。

---

## Open Tasks

1. ログイン済みで `/admin/finance` を開き、16件のseed、auto debit未確認、budget forward-fill off、保存/同期ボタンの表示を目視確認する。
2. ログイン済みで `/settings` を確認し、Raw/L2/Cron Controlの表示を見たうえで、軽いoperationの `Run Now` を安全に試す。
3. `/reimburse` で領収書添付つき申請 -> PM承認 -> admin承認を1件実運用テストする。
4. 通知のadmin-onlyを非adminアカウントで確認し、`回答済み` タブ移動を実画面でも再確認する。
5. GAS再認証後、`gas/155_L2KnowledgeExtractor.js` のプロトコル個別通知化をclasp pushする。push前に `gas/CLAUDE.md` を読む。
6. dirty worktreeの整理方針を決める。HUD/PWA本体・GAS・docs・unrelated changesを混ぜてcommitしない。
7. ログイン済みで `https://amd-os-pwa.vercel.app/hud/dashboard` を開き、Project Signal Board右側zoneの詰まり具合、PL/PM/Closerの視認性、active+endedの高スコア順を目視確認する。
8. ログイン済みで `/hud/project/p07/cockpit` を開き、LST ended cockpitでM/X/Fが出ること、先手力数値・月次ルーティン・Step Modal Stackが出ないことを確認する。

---

## First Next Action

まず `https://amd-os-pwa.vercel.app/admin/finance` をログイン済みブラウザで開き、経理台帳のseed・自動振替欄・budget forward-fill欄を確認する。OKなら次に `/settings` の Raw/L2/Cron Control 確認へ進む。

---

## First Read Order

1. `pwa/HANDOFF_pwa_rebuild.md`
2. `pwa/design/README.md`
3. `pwa/design/SPEC_pwa.md`
4. `pwa/design/cockpit.md`
5. `pwa/design/hud_visual_language.md`
6. `pwa/design/cyber_dashboard_content_design.md`
7. `pwa/design/macrotrend_atlas_seeds_architecture.md`
8. `pwa/design/notifications.md`
9. `pwa/design/amd_score.md`
10. `pwa/BUGS.md`
11. `pwa/design_log/sessions_2026-05.md` の末尾
