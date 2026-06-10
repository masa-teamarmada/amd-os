# Sessions 2026-06 — AMD OS PWA design log

過去セッションの作業ログ (append-only)。新規設計 md はここに作らない。

---

## 2026-06-02 — 通知の文字化け (mojibake) 調査・恒久 fix・DB 掃除

### きっかけ
まさが `/notifications` で OS台帳差分通知のスクショを共有。「?? ZMP: ??????」とタイトル・ヘッドライン・evidence snippet が `?` だらけ。「どうしてハテナがいっぱい出てるの?」

### 調査 (原因特定)
- 表示コンポーネント `pwa/src/components/notifications/NotificationsClient.tsx` を確認 → `i.data.title` / `i.data.summary` をそのまま表示。表示ロジックの化けではない。
- DB を直接 `repr()` で確認: `l2_notifications.title = '?? ZMP: ???'`。ASCII (`ZMP`, メールアドレス, `source_kind`) は無傷で **multibyte だけ `?`** → 書き込み時の lossy 変換確定。
- `created_by = codex-automation`、6/1 00:46 の同一 run で書かれた行に集中。
- automation `amd-os-ms` の prompt は「Gmail 等を直接検索して snippet 抽出 → outbox JSON」指示。**LLM が outbox を書く段で日本語を `?` に潰した**一過性の事故。同 run の strategy_signal 等は正常 = 恒常バグではない。
- applier `pwa/scripts/ms_progress_review_tool.mjs` の `requestJson` は `setEncoding("utf8")` 済みで無実、`writeJson` も無実。snapshot `os-latest.json` の化け 88 件は、化けた `l2_notifications` を export で読み戻した二次現象 (7343 件の日本語は無傷)。

### A. 恒久 fix (再発防止)
- `ms_progress_review_tool.mjs` に `assertNoMojibake(payload, file)` を追加。`?{3,}` を再帰 walk で検知し throw。
- `applyOutbox` 冒頭と `notify` 入口で呼ぶ。`applyOutboxDir` が throw を拾って outbox を `failed/` へ退避 → DB 非汚染、次回 run が再生成。
- 実データ (化けた行 / 正常 KUTE タイトル) でゲート動作をテスト済み。`node --check` syntax OK。

### B. DB 掃除
- 全テーブル横断スキャンで化け行を特定: `l2_notifications` 7 / `project_registry_diffs` 2 / `project_xrl_evidence` 1 / `ms_progress_revisions` 2。
- p21 `ms_progress_revisions` (af79cb2d…) は **まさ confirm 済み・revised_note の "kyoko????" は文字化け部分を指す意図的注記**と判明 → 除外。
- 残り 11 行を削除 (全て pending/candidate で未採否、生データ無事で再生成可能)。削除前バックアップを `pwa/scripts/_mojibake_cleanup_2026-06-02_backup.json` に保存。
- 削除後再スキャンで、化け残りは p21 の正規 1 件のみ (期待通り) を確認。

### 残課題・次の一手
- 削除した候補 (KUTE のPJメンバー候補 / ZMP の関係先メール候補 / SE の TRL根拠 / p25 のMS進捗) は **次回 Codex automation run (6h ごと) が生データから自動再生成する想定**。まさは「待っとく」判断。
- 次セッションで `/notifications` を見て、再生成された候補が正常な日本語で入っているか確認すると良い。もし入っていなければ手動で automation を走らせる。

### commit
- `99c4324 fix(automation): reject mojibake outbox before writing to DB + clean 11 garbled rows` (push 済み)
  - `pwa/scripts/ms_progress_review_tool.mjs` (ゲート追加)
  - `pwa/scripts/_mojibake_cleanup_2026-06-02_backup.json` (削除バックアップ)
- 詳細・教訓は `pwa/BUGS.md` の `[automation/mojibake] ... (2026-06-02)` 参照。

## 2026-06-03 (#90) — 月次サマリ生成を「進捗ベース」原則に全面是正 + LST 月次9ヶ月 backfill

> Claude Code セッションのログ。次のえいみが読めば把握できるよう残す。

### コンテキスト
- まさが `/notifications` の「SE: 5月生データ抽出経路を確認」(raw-route-zero) 通知について「どのL2か」と質問 → L2① monthly_reports と特定
- 「SE/202605 は進捗ゼロなのでそう書いて」→ 手で是正。さらに「automation 側で根本を直して」と展開
- 指示変遷が重要: 当初あたしは「end_ym で期間カット」するガードを実装 → まさ「PJ終了後でもactiveなら生成すべき」「BWEはactiveじゃないのに生成されてる」と2方向の矛盾を指摘 → **最終原則は「状態でなく実進捗で生成可否を決める」に確定**
- まさ確定の正本原則: 進捗あれば状態問わず生成 / 進捗なし&active→進捗なしテンプレ / 進捗なし&ended/frozen→生成しない。frozen は status='frozen' or freeze_from_ym≤当月
- LST は「MTGサマリが豊富にあるので月単位でまとめて月次サマリにして。MS設計してないのでMSなし進捗だけ」と指示

### 実装
- **コード(L2① 月報)**: [monthly-reports-backfill/route.ts](../src/app/api/cron/monthly-reports-backfill/route.ts) を進捗ベースに書き換え。3経路(source_cache/MTGサマリ/member_activities)で hasActivity 判定、未来月除外、frozen/ended×進捗ゼロは skip
- **コード(L2⑥ MTG)**: [meeting-prep/route.ts](../src/app/api/meeting-prep/route.ts) と [meeting-workflow/finalize/route.ts](../src/app/api/meeting-workflow/finalize/route.ts) に ended/frozen の未来prep生成ガード追加。calendar-sync は既存ガード、dialogue-meeting は非ガード(人の意図記録)
- **DB**: 未来月の捏造 draft 84件削除。過去の捏造/期間外 draft 整理(実データは保持)。**LST(p07) の月次サマリを1件→9ヶ月分(202305〜202605)に backfill** = MTGサマリから集約、MS無し進捗のみ、subagent3体で生成。LST end_ym=202507(active継続中の誤り)→null
- **doc**: spec [3-2](../../spec/3-2-monthly-reports-current-spec.md)/[3-3](../../spec/3-3-meeting-flow-current-spec.md) に進捗ベース原則を正本記載、L2_DATA.md と 6-1 changelog 同期

### Verified
- DB: LST 月報 9件(全 source='meeting_summaries')、状態境界後の捏造 draft 残存0 を SELECT 確認
- コード: tsc + npm run build 通過(v0.14.2)
- deploy: Vercel production Ready 確認(7vn5wgws8)。本番ドメイン 307(auth) 正常
- commit: b4513fe/83feaf0/6dbe051/b959bdd/25ce12a/2b2ff55/9dc9405 (全push済)

### 教訓
- **状態(end_ym)で機械的に切るな**。active PJ は end_ym が古いまま放置されることがある(LST: end_ym=202507 だが継続中)。「進捗の有無」で判定するのが正しい
- 削除前に必ず中身 Read で確認。end_ym だけ見て LST/202605 を消しかけた(実データだった)
- billing_cycles は請求ライフサイクルで動き PJ状態と一致しない。月次サマリ生成の根拠にすると未来月・終了後を捏造する

### 関連
- 別ブランチ(codex/bzm-worker-quiet-mode)に commit が乗る事故が一度あり、cherry-pick で main に救出。作業中は main 固定を毎回確認すべし

## 2026-06-04 — Vercel deploy approval gate / Cloudflare Textbook reader / Claude handoff

### コンテキスト
- Textbook推敲で小刻みなpush/deployが続き、Vercel daily deploy quotaを消費。まさが「24時間開発が止まる致命的タイムロス」と判断。
- 2026-06-03に一時hard gate。2026-06-04にquota緩和後、全面禁止ではなく `deploy bundle + askuserquestion承認` に移行。
- Textbook下書きはPWA productionではなく、Cloudflare Pagesの静的readerで読む方針へ移した。

### 実施
- Cloudflare Pages project `textbook-draft` を作成し、静的Textbook readerをproduction branch `main` としてdeploy。
  - URL: `https://textbook-draft.pages.dev/`
  - Vercel deploy / GitHub pushなし。
- `pwa/scripts/deploy.sh` に承認ガードを追加。`AMD_OS_VERCEL_DEPLOY_APPROVED=1` なしではVercelを呼ぶ前に停止。
- Textbook台帳に、deploy bundle候補 / askuserquestion承認状況 / deploy実施回数 / push保留の有無を記録する運用を追記。
- `pwa/design/SPEC_pwa.md`、`pwa/manual/9-2-developer.md`、`pwa/manual/9-3-appendix-changelog.md`、`pwa/BUGS.md`へ恒久仕様・事故教訓を反映。

### Verified
- `curl -I -L https://textbook-draft.pages.dev/`: HTTP 200。
- `bash pwa/scripts/deploy.sh`: approval envなしで exit 1、Vercel到達前に停止。
- `git diff --check`: pass。
- push/deployは未実施。理由: Vercel auto-deploy対象pushはapproval gate対象。

### 残課題
- Claude側で作業再開中。次セッションは `HANDOFF_TEXTBOOK_VERCEL_CLOUDFLARE_20260604.md` を読む。
- 次にpush/deployする時は、deploy bundleを提示し、`askuserquestion` 承認を取る。承認待ちは `approval pending`。

## 2026-06-04 — KUTE重複解消 / v0.15.3復元 / 研究機関カード表示名

### コンテキスト
- KUTE が通常 PJ リストと研究機関 ERS リストの両方に出ていた。まさ要望は、KUTE を研究機関側へ寄せつつ、既存 KUTE PJ cockpit content と研究機関 ERS content のどちらも消さないこと。
- 途中で別セッション `019e9176-2ea9-7ee3-8946-9d6dfe384fba` の v0.15.3 company content landing zone を認識せず、古い worktree から deploy して一度巻き戻した。直後に現行 v0.15.3 の中身を読み直して統合し直した。

### 実装
- `inst_kute -> p25` の institution project mapping を追加し、KUTE (`p25`) など研究機関エコシステム構築 PJ を通常 PJ 一覧から除外。KUTE は研究機関 ERS リストから `/institutions/inst_kute/cockpit` へ入り、既存 `p25` cockpit content を同画面で参照する。
- `inst_nims -> p20` の既存導線は維持。研究機関 ERS リストは Dashboard 左/main カラムの PJ 一覧直下へ戻し、Company Content shelf はその下の全幅段へ置いた。
- `019e9176` の company content landing zone を再統合。`/company`、`/admin/company`、`124_company_content_tables.sql`、Dashboard shelf の approved row 読み + fallback、Notion dry-run memo を含めた。DB migration apply/import は未実施。
- 研究機関リストのカード表示名を PJ 名寄りに変更。title は `KUTE` / `KGW` / `NIMS`、subtitle は `工学院大学` / `香川大学` / `物質・材料研究機構`。
- `BUILD_VERSION` は最終的に `v0.15.5`。

### Verified
- `npx eslint src/components/dashboard/InstitutionReadinessList.tsx src/lib/build-info.ts`
- `npx tsc --noEmit`
- `npm run test:critical-ui`
- `npm run build`
- local smoke: `/dashboard`、`/institutions/inst_kute/cockpit`、`/company` が login redirect / status 200 / Runtime Error false。
- production smoke: `https://amd-os-pwa.vercel.app/dashboard`、`/institutions/inst_kute/cockpit`、`/company` が login redirect / status 200 / Runtime Error false。

### Deploy
- production Ready: `https://amd-os-pwa.vercel.app`
- deployment id: `dpl_42byLRKSTZEfrQGo5bDfWargtUyx`
- inspect URL: `https://amd-os-788b8fwh1-armada0130.vercel.app`
- git push は未実施。

### Commit
- `039a823 fix(pwa): restore institution list placement and KUTE routing`
- `ac13324 feat(company): restore Notion content landing zone`
- `40f021b fix(dashboard): use project labels for institutions`

### 教訓
- 既にまさが見ている production version を基準にする。`BUILD_VERSION` の bump だけを見て「次は v0.15.3」と判断せず、現行 production と直近別セッションの HEAD を確認してから bundle を作る。
- dirty/local direct deploy で一度本番に出た内容は、次の deploy 前に必ず commit graph と該当セッションの成果物を確認する。未確認の古い worktree deploy は production rollback 事故になる。

## 2026-06-10 — ZMP/ZeMA 6/10定例MTGカード「日程調整中」復旧

### コンテキスト
- まさ依頼: 2026-06-10 の ZMP 定例MTGカードが「日程調整中」になっている原因を特定して修正する。
- worker quiet mode。root local checkout `/Users/masa/projects/AMD/amd-os` は実装起点にせず、専用 worktree `/Users/masa/.codex/worktrees/5689/amd-os` で作業した。

### 調査
- Calendar で `【ZeMA】定例MTG` を確認。2026-06-10 09:00-10:00 JST、event id `bivl92dr7vhaa1fmi7325lnlis_20260610T000000Z`、recurring instance。
- DB `project_meeting_summaries` に `meeting_id='upcoming:bivl92dr7vhaa1fmi7325lnlis_20260610T000000Z'`、`project_id='p19'`、同じ `calendar_event_id` の row が存在。
- 直接原因は UI 判定。`source_kinds='upcoming+calendar+manual-prep'` が exact `upcoming` ではないため日時確定済み扱いから外れ、`meeting_id` の `upcoming:` prefix によって prep/tentative 側へ寄っていた。

### 対応
- DB は該当 row のみ非破壊 PATCH で `source_kinds='upcoming'` へ戻した。
- `CockpitMeetingSummary.tsx` / `CockpitMeetingDetailModal.tsx` に `sourceKindTokens` を追加し、`upcoming` token を含む row を確定予定、`upcoming_tentative` token を含む row を日程調整中として扱うよう修正。
- `calendar-sync` に p19 固有 alias `ZeMA` / `葛飾水素循環` を追加。dry-run で `matched:ZeMA` を確認。
- `check_pwa_critical_ui.cjs` に再発防止 anchor を追加。
- `pwa/spec/3-3-meeting-flow-current-spec.md`、`pwa/manual/2-3-pj-cockpit.md`、各 changelog を同期。`BUILD_VERSION` は `v0.16.23`。

### Verified
- `npm ci`
- `npm run test:critical-ui`
- `npx tsc --noEmit`
- `npm run build`
- `npm run test:l6-held-source-guard`
- `npm run test:color-pj-resolution`
- `git diff --check`

### Commit / Deploy
- commit: `2fb37412 fix(meeting): treat upcoming source tokens as scheduled`
- branch: `codex/zmp-meeting-card-v01623`
- push: 未実施
- deploy: 未実施。`.vercel/project.json` はこの worktree では absent。deploy 前に現行 line へ取り込み、Vercel project guard と deploy bundle 承認が必要。

### 教訓
- `source_kinds` を拡張可能フィールドとして使うなら、完全一致で UI 状態を決めない。
- Calendar title と OS PJ 名が違う recurring MTG は alias を明示し、dry-run reason で routing を確認する。
- DB 緊急復旧だけで閉じず、UI 再発防止・alias・guard・spec/manual を同じ closeout に含める。
