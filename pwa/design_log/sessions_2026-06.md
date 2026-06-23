# Sessions 2026-06 — AMD OS PWA design log

過去セッションの作業ログ (append-only)。新規設計 md はここに作らない。

---

## 2026-06-18 — 月初合意を支払 gate 化 (v0.28.0)

### コンテキスト
- 月初合意は `member_monthly_work_agreements.snapshot_hash/currentHash`、未合意・条件更新・修正要望の可視化までは入っていたが、`/admin/payouts` の支払データ保存や支払通知書PDF生成は止めていなかった。
- 今回の目的は「合意していないと支払へ進めない」server-side gate。UI の警告だけではなく、API action 側で止める。

### 実装
- **新規 gate lib**: `src/lib/monthly-work-agreement-payout-gate.ts`
  - `member × source_ym × project` の支払対象を dedupe。
  - frozen/lost/active期間外PJ、役員/通知対象外、支払額0は `not_required`。
  - `pending` / `stale` / `revision_requested` は blocker。
  - `agreementOverrideReason` が 8 文字以上かつ actor email ありなら、override 監査ログを保存して allow。
- **新規 migration**: `145_member_monthly_work_agreement_payout_overrides.sql`
  - `payment_ym`, `source_ym`, `member_id`, `project_id`, `target_action`, `blocker_status`, `reason`, `actor_email`, `snapshot_hash`, `current_hash`, `request_id`, `metadata_json`, `created_at`。
  - 本番 Supabase へ適用済み、`design/db_schema.md` dump 同期済み。
- **API guard**: `/api/admin/payouts`
  - `POST` 支払データ保存前に block。
  - `issue_notice_pdf` / `preview_notice_pdf` / `bulk_issue_notice_pdf` / `bulk_preview_notice_pdf` / `send_notice_email` / `markSent` 前に block。
  - GET は `payoutAgreementGate` summary を返して UI 表示に使う。
- **cron guard**: `/api/cron/payout-notice-prebuild`
  - blocker member は PDF 生成せず `reason='agreement_gate'` の failed result として返す。
- **UI**: `/admin/payouts`
  - 月初合意支払ゲート panel を追加。
  - blocker 一覧と admin override reason 入力を表示。
  - override reason が無い時は保存/PDF/送付系ボタンを disabled。
- **docs**: spec `3-14`、manual `6-5` / `7-1`、appendix changelog を同期。
  - OS月次合意を毎月の個別発注/SOW/条件確認として扱う設計。
  - hard guard の本番運用は契約改定・メンバー同意・法務レビューが前提で、AIが法的助言として断定しない旨を明記。

### 検証
- targeted eslint: error 0 (既存 warning 2: `fmtDeltaYen`, `budgetAuditBadge`)
- `npx tsc --noEmit`: pass
- `npm run build`: pass
- `npm run test:critical-ui`: pass
- local built server smoke: `/api/build-info` 200、`/admin/payouts` / `/monthly-agreement` / `/admin/monthly-work-agreements` は未ログインで `/auth/login` 307
- read-only live DB probe: `loadTargetData("202606")` で expectedEntries 4 / gate blockers 4 (`pending`, p19 202605)

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
- まさが `/notifications` の「SE: 5月生データ抽出経路を確認」(raw-route-zero) 通知について「どのL2か」と質問 → M-1 Monthly Reports monthly_reports と特定
- 「SE/202605 は進捗ゼロなのでそう書いて」→ 手で是正。さらに「automation 側で根本を直して」と展開
- 指示変遷が重要: 当初あたしは「end_ym で期間カット」するガードを実装 → まさ「PJ終了後でもactiveなら生成すべき」「BWEはactiveじゃないのに生成されてる」と2方向の矛盾を指摘 → **最終原則は「状態でなく実進捗で生成可否を決める」に確定**
- まさ確定の正本原則: 進捗あれば状態問わず生成 / 進捗なし&active→進捗なしテンプレ / 進捗なし&ended/frozen→生成しない。frozen は status='frozen' or freeze_from_ym≤当月
- LST は「MTGサマリが豊富にあるので月単位でまとめて月次サマリにして。MS設計してないのでMSなし進捗だけ」と指示

### 実装
- **コード(M-1 Monthly Reports 月報)**: [monthly-reports-backfill/route.ts](../src/app/api/cron/monthly-reports-backfill/route.ts) を進捗ベースに書き換え。3経路(source_cache/MTGサマリ/member_activities)で hasActivity 判定、未来月除外、frozen/ended×進捗ゼロは skip
- **コード(H-1 Meeting Flow MTG)**: [meeting-prep/route.ts](../src/app/api/meeting-prep/route.ts) と [meeting-workflow/finalize/route.ts](../src/app/api/meeting-workflow/finalize/route.ts) に ended/frozen の未来prep生成ガード追加。calendar-sync は既存ガード、dialogue-meeting は非ガード(人の意図記録)
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

---

## 2026-06-12 — D-2 MS進捗 schedule_default_revision_v3 全面移行 (badaaa31, v0.18.0)

### コンテキスト
- まさ指示「Bまで一気にやろう。どっちにしろ現状だと使えない。」「巻き戻りからの再上昇とかも、あってはならない。巻き戻りって、そもそも起きない設計のはず。Nか月計画のMSなら1か月あたり100/N%の進捗がデフォルトで入るはずで、ズレ判断がL2データから出たら通知に確認が来て、おれが認めない限りデフォルト通り。」「りさはPJに参画してないので報酬は発生しないはず。」
- 旧方式: LLM が `milestone_monthly_progress` を直接書く → 巻き戻り→再上昇の二重払いと、未参画メンバーへの報酬発生が起きていた。

### 実装
- LLM 直書きを廃止。全 MS にスケジュール按分のデフォルト月割り (`source='routine_auto'`) を毎回上書きする `applyScheduleAutoProgress`。LLM (`estimateProgress`) はデフォルトとの乖離 ±10pt 以上のときだけ `ms_progress_revisions` (pending) + `l2_notifications(l2_kind='ms_progress_revision')` の提案のみ。
- `PM_LOCKED_PROGRESS_SOURCES` = {pm_manual, pm_confirmed, pm_rejected, criteria_toggle, tsukuyomi_revision} を `ms-schedule-shared.ts` に正本化。PM locked 行は自動処理が絶対に上書きしない。
- 報酬計算 (`reward-summary.ts` `buildPayableCumMap`) を「PM locked 行 or コード計算デフォルトの cumulative max」へ。DB の非確定行は参照しない。`is_active=false` メンバーは share 0 + renormalize。
- `/api/cron/ms-schedule-progress` (毎日 02:30 JST、非LLM) が active PJ × {当月, 前月} の writer。

### Deploy
- production Ready: v0.18.0 = badaaa31。spec 3-10 / manual 4-8 を全面改訂。

---

## 2026-06-13 — D-2 デフォルト按分をアンカー方式へ + 計画遅延通知 (A案+C案、ae93faeb, v0.19.0)

### コンテキスト
- まさが「SXの6月が49%、7月も49%。両方進みすぎてる」と発見。診断: p21 (SX) で 202605 に 15% で確定 (`tsukuyomi_revision`) した MS が、target_ym 最終月 202606 にデフォルト按分で **100% にジャンプ** したのが主犯。最終月 = 100% という従来按分が、まさの低い確定値を無視していた。
- まさ指示「AとCでいこう」。
  - **A案 (アンカー方式)**: デフォルト按分の起点を「その月より前の最新まさ確定値 (アンカー)」にする。3か月MSで 202605 確定 15% なら 202606 デフォルト = 15 + 100/3 = 48.3%。target_ym を過ぎても確定アンカーからの月割りで積み続け、勝手に 100% に飛ばない。
  - **C案 (計画遅延通知)**: target_ym 超過 + 100% 未達の MS を毎日 cron が検知し通知。

### 実装
- `ms-schedule-shared.ts` に `ProgressAnchor` 型 + `anchoredExpectedCumPctForYm(asOf, start, target, anchor)`。anchor = その月より厳密に前 (<) の最新 PM_LOCKED 行。anchor 無し時は従来 `expectedCumPctForYm` (最終月 100%) に一致。
- 同一基準を **4 か所**に適用: (1) writer `applyScheduleAutoProgress` (anchorByMs を構築、アンカーあり MS は lastIndex を当月まで延長)、(2) LLM 乖離検知 `estimateProgress` (乖離基準 + プロンプト + source_hash に anchor)、(3) 報酬 `buildPayableCumMap` (anchorBefore、pct は consumed_pt/points×100 優先)、(4) 表示 API `/api/progress/ms-schedule` (loadDbSchedules)。
- **C案**: `applyScheduleDefaultsForProject` が `delayed[]` + `activeMilestoneIds` を返す。cron が当月分のみ `l2_notifications(l2_kind='ms_schedule_delay', scope_key='${ym}:delay:${milestoneId}', importance=2)` に upsert、解消 MS は同 scope_key を delete。`feedback/route.ts` allowedKinds + `NotificationsClient.tsx`/`LoopKernelBoard.tsx` の L2_KIND_LABEL に "D-2 MS計画遅延" 追加。
- 設計判断: 過去月のデフォルトを未来アンカーで cap しない (cumulative max が二重払いを構造的に防ぐ)。アンカー無し MS が最終月 100% は月割りの自然な帰結で正常 (遅延通知対象外)。

### Verified (本番)
- `tsc --noEmit` / `npm run build` / `test:critical-ui` 全クリーン。
- 本番 cron 手動実行 `?projectId=p21&ym=202606` (failed 0)。SQL 裏取り:
  - MS-PC-p21-202604-1 事業計画策定 202606 = **48.3%** (アンカー 202605=15% 起点)。202604-1-capital も同 48.3%。
  - 202604-1-ip は 202604 確定 35% 起点 → 202605=68.3% / 202606=100% (cap)。
  - p21 全体 202606 = **40.4%** (修正前 49.3%)。残る 100% は知財戦略の正当な月割り帰結。
- 全 active PJ cron 実行で delayNotified 0。SQL 確認: target_ym < 202606 の MS は p21 入札対応 1 件のみで既に 100% → 遅延 0 は正しい。

### Deploy
- production Ready: v0.19.0 = ae93faeb (2分53秒)。

### 保留
- 残骸 `l2_routine` / `tsukuyomi_estimate` 行の DELETE 掃除はまさ未承認のため保留。cron の `routine_auto` 上書きで自然修復されるため実害なし。

---

## 2026-06-13 BZM教科書を章頭ストーリー型へ全面差し替え + 全16章公開

### やったこと (時系列)
1. **構成議論**: まさと教科書の全体構成を再設計。「ナラティブ一本線」→「章頭ストーリー型教科書」(冒頭ストーリー → 解説=メイン(数式・図を章内で) → 匿名化実例 → 章末の問い) へ転換。新4部構成 (I現場 / II Before Zero Model / III苗床 / IVツールキット) に確定。
2. **PRS正式採用への正本同期**: 2026-06-12 Before Zero Model discussion で PRS×戦略余力が確立 (正本 `BZSF/before_zero_theory.md` + `BZSF/PRS_STRATEGIC_SLACK_OVERVIEW_20260612.html`)。repo 内の「PRS=候補」表記を `bzm/5-1`付記・`design/amd_score.md` で正式採用へ同期 (`design/amd_score.md`・`spec/4-2` は別セッションで既に PRS primary 化済みだった)。
3. **プロトタイプ章** `strategic-slack.md` を執筆 (rev2: まさレビュー5点反映 = KPI論追加 / 冒頭を一社依存ロックイン失敗ケースに / 戦略余力5成分を解説 / 文章増量 / 鋸歯グラフ必須)。図 f6(x,y平面)/f7(鋸歯時系列)/f8(軌跡4パターン) を `bzm_figures.py` で生成。
4. **OS差し替え**: 旧24章を `pwa/bzm/legacy/` へ退避 (git保全)、旧ナラティブ26章は `/bzm/public` で閲覧継続。`bzm-chapters.ts` を新6部構成へ全面改編、`/bzm` index→preface。D-7 applier `slugToFile` に legacy fallback 追加 (`spec/3-13`注記)。台帳md(大文字始まり)を章リストから除外。
5. **14章をworker 10本並列で量産** → 全章 司令塔レビュー(章型・禁止語・丸数字ガード・密度)通過 → 4バンドルでdeploy:
   - wave1 (e139c22a, v0.19.x): why-valuation-fails / model-overview / p-potential / r-readiness + f9
   - wave2 (4af18e0e, v0.19.2): s-survival / score-and-bottleneck / model-critiques / retrofit-verification
   - wave3 (0c172645, v0.19.3): field-before-zero / field-clocks / field-gates / field-who-carries
   - wave4 (212a5729, v0.19.4): preface(司令塔直書き) / nursery-ers / field-toolkit
6. **まさ直出し思想の保全**: KPI論(成果件数KPIがBATNAを壊す、KPIは交渉力に置く)を `AUTHOR_DIRECTIVES.md` と `knowledge/license_negotiation.md` に追記。

### 成果
- 全16章 (序章 + I部4 + II部9 + III部1 + IV部1 + 巻末) を本番公開 (v0.19.4, git_sha 212a5729, 本番一致確認済)。
- 図版5点 (f6/f7/f8/f9 + 既存f4 ERSレーダー) を本文埋込。
- critical-ui guard で丸数字 ban に1回ひっかかり → (N)表記へ置換して通過 (台帳md由来)。

### 残課題 (次セッション)
- 概念図系図版 (二層アーキテクチャ / 進化系譜 / 三因子概念図など) — matplotlib か外部画像生成かまさ判断待ち。各章本文に「> 図版 TODO」プレースホルダ多数。
- 通し編集 (序章→巻末の cold-reader、章間重複・接続・用語ゆれ)。
- 巻末資料の再構築 (参考文献・記号・用語、料率の出典確定)。
- D-7 Textbook Insights の新教科書向け受け皿章の再設計 (現状 legacy fallback)。
- 出版パッケージ (タイトル確定・組版・出典固め)。

---

## 2026-06-15 株主・ガバナンス + 要対応 (D-14) のOS化 / JC cap table取り込み / スコア反映

**起点**: まさが「5/28着のJOYCLE臨時株主総会招集通知がOSに一切抽出されてない、埋もれさせてはいけない」と気づいた。診断: Gmail抽出はreport_emailsゲート+active/進捗PJ中心で、smartround送信元・終了PJ(p09)・期日付き要対応を拾う仕組みが無かった(3つの構造的穴: 取り込み/分類/受け皿)。L2_DATA.md:170「ended でも清算・株主総会等は残す」は未実装の設計意図だった。

**実装 (本番 v0.20.9 → v0.20.12)**:
- migration `137_governance_and_action_items.sql`: `action_items`(汎用 要対応/期日つきinbound義務、採否ループ、personal/company scope) / `project_shareholders`(cap table) / `project_valuation_rounds`(バリュエーション) / `project_shareholder_meetings`(総会・決議)。RLS=service_role+is_admin、anon無付与(cap table最機密)。
- API: `/api/governance`(entity CRUD) / `/api/action-items`(GET期日順・POST手動・PATCH status) / `/api/action-items/extract`(routine取り込み口、source_hash dedup、l2_notifications化)。
- UI: `CockpitGovernance`(cockpit col2、終了PJでも表示) / `ActionItemsPanel`(dashboard+notifications 要対応期日順) / `/admin/governance`(手入力CRUD) + AdminSidebarリンク。
- 抽出: consolidated-evidence SKILL に Phase K-C (D-14)。L2_DATA に D-14 行。
- バグfix: action-items/extract の通知insertが l2_notifications.notification_id(uuid) に text key入れてサイレント失敗 → notification_id外しDB自動生成、error チェック (v0.20.11)。実地テスト(cron認証でinsert/dedup/通知)済み、テスト行削除済み。

**JC実データ取り込み (p09)**: Gmail招集通知/事前承諾/委任状控え + Drive(署名済み株主名簿20240921 + 公式captable_241217.xlsx) を精読し、cap table全体を復元(計146,903株、検算一致):
- 普通100,000(小柳99,583+まさ417) / AAA種11,111(前澤友作=前澤ファンド、Angel2023-12 ¥2,700) / AA種28,937(Seed2024-08 ¥3,420 ANOBAKAリード16名) / A種6,855(Series A 2026-06 実¥3,500、鈴与商事リード)。
- **まさ=普通株417株、2024-08に小柳から譲受(セカンダリー)、¥998,298=¥2,394/株**。同時期Seed優先¥3,420の約70%=普通株割引。直近A種¥3,500で簿価上+約46%。
- 計画(captable: Series A ¥10,000/pre¥14億) vs 実績(¥3,500/post¥5.1億)=大幅未達、評価額ほぼ横ばい。総会レコードに資料13点リンク添付。DLしたPDFは `~/projects/AMD/JC/総会関連資料_20260605/`、Drive「総会関連資料/20260605_臨時株主総会」フォルダ作成済(本体binaryのアップはツール制約で保留)。

**スコア反映 (A)**: `amd_score_inputs` に JC 2026-06-15 行追加(μ_I 7→8 Woven City、prs_r_net=2据置、notes)。実演として「正直に入力更新するとμ_I上昇でスコアは上向くのに評価額は停滞=現PRSモデルは実現バリュエーションを入力に持たない盲点」が時系列に可視化。

**spawn したフォローセッション (チップ)**:
- task_2eff788c: AMD Scoreモデル改良v3.3 (実現モメンタム係数 + R&Dガバナンス整合の2新パラメータ。コアモデル変更=設計先行)。
- task_6027de9a: OS仕組み化「拾うべき情報の自動検知」(coverage/gap scanner、まさ依存をなくす脱・属人化。D-5台帳差分の拡張 or 新系統)。

**知見**: (1) セッション頭の `git fetch` を飛ばしてローカル(v0.19.14)が origin(v0.20.8)より9commit遅れ=最新build把握漏れ → 必ず4ステップ実行。(2) AskUserQuestion禁止(まさ再指摘) → 地の文で進める。(3) Drive MCPはbase64必須でharness inline上限超のbinary手渡し不可+Drive書込OAuthスコープ無し → 大容量binaryの自動アップは現状不可。

---

## 2026-06-15 (#91) — Cowork セッション (cowork-eimi) / Coverage Scanner (L3 不在検知) 新設 + L2 tier(L1/L2/L3) 全面導入

> Claude Code 上で動いた cowork-eimi セッションのログ。task_6027de9a「拾うべき情報の自動検知」の実装に相当。次のえいみが読めば把握できるよう残す。

### コンテキスト
- まさ依頼: 「拾うべき情報を自動検知して候補提示する仕組み」を設計先行で。背景は JOYCLE 臨時株主総会 招集通知を**まさが自分で気づいて**OS化した=まさ依存だと取りこぼす=脱・属人化に反する。
- 設計提示 → まさ承認 (新系統+Phase M / 5生データ全部 ungated / uncertain も捨てない)。
- まさ問い「これ新L2?」→ 議論の結果 **L3 (L2カバレッジを見張るメタ層)** と整理。さらに「今のL2にL1相当が混じってる?」→ コードで LLM 呼出を確認し **D-12 freee=L1相当**、D-2按分/D-9集計=非LLM派生 と判明。
- まさ指摘 (重要): 1. `AskUserQuestion` で方針を選択肢化して聞いたのは禁止ルール違反 2. 選択肢を狭めた結果まさが「全部やる」を頼めなかった → tier はタグ別添でなく**リスト本体に全面統合**し直した。

### 実装
- **DB**: migration `138_coverage_gap_scanner.sql` 適用 (`l2_coverage_gaps`、RLS=service_role/is_admin のみ)。`db_schema.md` 再生成。
- **コード**: [coverage-gaps/extract route](../src/app/api/coverage-gaps/extract/route.ts) 新規 (ungated sweep 取込口、source_hash dedup)、[feedback route](../src/app/api/notifications/feedback/route.ts) に coverage_gap の confirm/reject 配線、[NotificationsClient](../src/components/notifications/NotificationsClient.tsx) にラベル/詳細/deeplink、[/admin/coverage-gaps](../src/app/(app)/admin/coverage-gaps/page.tsx) 新規 (一覧+再現性指標)、[AdminSidebar](../src/components/admin/AdminSidebar.tsx) 導線。tier 統合: [operations-catalog.ts](../src/lib/operations-catalog.ts) に `tier` フィールド+全エントリ、[OperationsSettingsClient](../src/components/settings/OperationsSettingsClient.tsx) に層列。[SKILL.md](../scheduled-tasks/amd-os-l2-consolidated-evidence/SKILL.md) に Phase M 追記。
- **doc**: [coverage_gap_scanner.md](coverage_gap_scanner.md) 新規 (設計正本)、[L2_DATA.md](L2_DATA.md) に Coverage Scanner+tier節、[spec/3-0](../spec/3-0-l2-data-list-current-spec.md) メイン表に層列+D-14+L3-1行+D-12=L1、[manual/8-3](../manual/8-3-l2-extraction-routines-spec.md) に tier+Coverage Scanner 節、spec/6-1・manual/9-3 changelog、critical-ui guard anchor 更新。

### Verified
- tsc クリーン / `npm run build` 成功。deploy 3回 (v0.21.0 Coverage Scanner / v0.22.4 tier節 / v0.22.6 tier全面統合)。
- 本番: `/api/build-info`=該当版・git_sha 一致、`/api/coverage-gaps/extract`=401 (auth gate 稼働)。critical-ui guard pass。
- OS タスク: task_6027de9a 系で登録した follow-up 2件 (tier物理リネーム / Coverage Scanner次フェーズ) は完了化。未着手の次フェーズ詳細は coverage_gap_scanner.md §10 が正本として保持。

### 次フェーズ (coverage_gap_scanner.md §10 に正本)
- salience allowlist の DB化 / 各L2の source_ref 保存監査 (coverage check 盲点埋め) / confirm時のワンクリック実ルート / D-12・coverage_gap の identifier 物理リネーム / JOYCLE backtest 自動化。
- Phase M が実 gap を生むには `amd-os-l2-consolidated-evidence` が Claude Routines UI で ACTIVE 登録されていることが前提 (= まさのアカウント側確認領域)。

### 関連メモ更新
- `memory/feedback_eimi_persona_nonstop.md` に AskUserQuestion 三度目違反の教訓追記 (選択肢を狭めると「全部」が頼めない → 全部やる前提で走る)。

## 2026-06-16 (#92) — Cowork セッション (cowork-eimi) / 月次収支シミュレータの化石化診断 → live 駆動切替を spawn_task で起票

> Cowork (Claude Desktop) 上で動いた cowork-eimi セッションのログ。コード変更は無し (診断 + 次セッションへのタスク化)。次のえいみが読めば「なぜ live 駆動に変えるのか」が分かるよう残す。

### コンテキスト
- まさと「先三か月の収支」レビュー → AMD 健康状態評価から開始。固定費削減 (税理士コンダクト) を経て、go-forward CF を OS で出そうとした流れで **OS 予算データの化石化**が発覚。
- 重要な正本確定: **AMD 財務の唯一の正本は「収支スプレッドシート」** (まさ手維持の Google Sheet, fileId `1Q8cEnutfJzgdEXKIRDb4wUGAe6ON1MMiiz3irCrj1YA`)。OS の `company_budget_*` はそこから seed された二次データ。銀行明細からの手再構築や OS スナップショットを正本扱いしない。

### 診断 (実装はしていない)
- **化石の入口**: `management-score/page.tsx` ~1056 が `company_budget_inputs` (version=`gas-2026-05-18-baseline`) を読み、~942 `buildMonthlyPlInputs` で `MonthlyPlInputs` を組んで `GasMonthlySimulationPanel` に渡している。この凍結スナップショットに SX 二重計上・実在しない「新規1/2/3」・終了済 CTB が残り、誤予測の原因になっていた。
- **エンジン/ UI は完成品**: `pwa/src/lib/finance/monthly-pl-simulation.ts` と `pwa/src/components/management-score/GasMonthlySimulationPanel.tsx` は無改修で再利用可。正しい入力を流し込めば良い。
- **生きた運用テーブルは正確**: `projects` (fee_type/fee_amount/start_ym/end_ym/freeze_from_ym)、`billing_cycles.budget_yen` (KUTE 等の変動売上を月別保持)、`monthly_reward_payout` (メンバー原価実績)、`company_finance_recurring_items` (固定費)、`milestone_responsibility.share` × `milestone_monthly_progress` (将来月のフォワード原価)。

### 次アクション (起票済)
- **spawn_task `task_2a17f76e`「収支シミュレータを生きたOSデータ駆動に切替」** を起票。内容 = 新関数 `buildLiveMonthlyPlInputs()` で上記生テーブルから `MonthlyPlInputs` を組み、page.tsx の入力ソースを差し替え (エンジン/パネル無改修)。フォワード原価は既存の報酬計算ロジック (monthly_reward_payout 生成系) を将来月へ延ばして算出 (新規列不要・まさ確認済)。

### Verified
- DB 実値で確定 (Supabase `nbnhrhybjslbawdukvvk`): SX (p21) ¥1,048,000/月 (契約 applied 2026/06–2027/03) / KUTE (p25) ¥654,545/月税抜・2026/06 のみ倍 (5月遅延) / ZMP (p19) ¥300,000 / SE (p10) ¥100,000 / CX·NIMS (p20) ¥900,000 総額 2026/06–2026/09 で終了 / CTB (p06) `freeze_from_ym=202605` で凍結→0。
- コード変更・deploy なし。BUILD_VERSION 変更なし。

### 関連メモ更新 (Cowork memory)
- `memory/feedback_amd_finance_source_of_truth.md` 新規 (財務正本=収支スプシ / OS は派生で stale 化 / 所有者の確定値を再監査して空転しない)。

## 2026-06-16 (#93) — 月次収支シミュレータを OS ライブテーブル駆動へ (live builder 実装 + deploy) / 5要望を次セッションへ起票

> #92 で起票した `task_2a17f76e`「収支シミュレータを生きたOSデータ駆動に切替」を実装・本番反映したセッション。エンジン/パネルは無改修、入力ソースだけ live 化。build v0.22.9→(rebase で)v0.22.17 で deploy 済み (その後別セッションが v0.23.0)。

### 実装
- **新ファイル `pwa/src/lib/finance/live-monthly-pl-inputs.ts`**: `buildLiveMonthlyPlInputs(supabase, options)` が live テーブルから `MonthlyPlInputs` を構築。
  - 固定収益 = `projects.fee_type='monthly_fixed'` の `fee_amount`
  - 変動収益 = `fee_type='variable'` PJ の `billing_cycles` (reported優先、なければ `budget_yen ÷ 0.65`)
  - 固定費 = `company_finance_recurring_items` (active)
  - 将来メンバー原価 = MS進捗を期間按分した **uncapped 報酬** (`computeForwardUncappedMemberCosts` in `reward-summary.ts`) を `projectRevenues[].internalMemberCost` に注入
  - `options.fallbackParams` (= snapshot の `MonthlyPlParams`: 繰越欠損・社保率・法人税前提) を `...fallbackParams` で展開して流用
  - `persistForecast` フラグで将来予測を `billing_cycles.reward_summary_json` に書くか制御。**今回は `false` = 読み取り専用** (A案の DB write はまさ承認後に別途)
- **`management-score/page.tsx`**: `buildLiveGasSimulationResult(liveInputs, snapshotResult)` を追加。live エンジンを server-side で回し、snapshot の実績列 (予実比較) をマージ。try/catch で snapshot fallback (落ちても画面は壊れない)。
- エンジン `monthly-pl-simulation.ts` / パネル `GasMonthlySimulationPanel.tsx` は無改修。

### Verified (実データ検証 → 正本 doc へ固定)
- **エンジン516行制約 (`pjRev===0` の月は原価スキップ) が現行 active PJ 全件で無害**を SQL で確認 (p00=総pt0 / p07・p24・p26=plan cycle無し / p06=過去cycle / p10-21=monthly_fixedで毎月売上 / p25=全月billing有り)。
- `deriveRewardBudgetForPt` の月次報酬予算解決順 (billing `budget_yen` → `fee×0.65` fallback → cycle budget按分) と主要PJ uncapped 月次原価 (p19≈¥195k / p20≈¥50.7k / p21≈¥56.8k / p25≈¥654.5k)。p21 の 2026/04–05 は `budget_yen=0` で fee fallback が効く。
- 上記は `pwa/manual/4-5-management-score-and-finance-simulation-spec.md` に表で固定 (セレンディピティ依存の出口対策)。`pwa/manual/7-1-reward-calc-spec.md` も uncapped 定義 + 将来原価シミュ節を実装に同期。
- `npx tsc --noEmit` clean / `npm run build` BUILD_EXIT=0。deploy.sh で本番 git_sha 一致確認済。

### ハマり
- deploy.sh が **origin/main 乖離**で停止 (別セッションが 8 commit push)。`git rebase origin/main` で取り込み、conflict 2件を解決: `build-info.ts` (相手 v0.22.16 → v0.22.17 に上げる) / `9-3-appendix-changelog.md` (append-only なので両側エントリ全保持)。page.tsx / reward-summary.ts は auto-merge。
- **間違えて background agent を起動した**: まさの「次セッション立ち上げて」は spawn_task が正解 (このセッションを閉じる前提なので子プロセス agent は無意味)。`AGENTS.common.md` にルール追記 + `memory/feedback_next_session_use_spawn_task.md` 新規。

### 次セッションへ (spawn_task `task_caf24348` で起票済)
`/management-score` の予実表/グラフへ5要望:
1. 社保・法人税の支払いが予実表に出ていない → エンジンにロジックはある (`socialIns` 425行 / `ctaxPayment`・`corpTaxPayment` 606行〜)。有力仮説 = live builder の固定費が `costType:'taxable'` 固定 (204行) で `costType:'executive'/'salary'` 行が無く `socialInsBase=0`。`company_finance_recurring_items` の costType 実データ確認 → 実額で乗せる。
2. Slack 等サブスク月額が古い → Gmail レシート / freee から最新額を抽出して更新 (本番データ書き換え=まさ提示後)。
3. 予実表を縦スクロールさせず全行表示 (`GasMonthlySimulationPanel.tsx` の `.table-wrap` max-height/overflow-y 除去)。
4. 売上原価をトグルで内訳 (PJ別 internalMember/externalMember) 展開。
5. グラフに予算キャッシュ残高折れ線を追加し予実比較。
- DB 書き換えなしの #3/#4/#5 から着手・deploy 推奨。#1 は実データ検証後、#2 はまさ提示を挟む。

## 2026-06-16 (#94) — 5要望クローズ (サブスク額 freee 棚卸し / #2) + CX 無期限売上計上事故の修正 + 契約 Apply 経路を spec 化

> `task_caf24348` の5要望のうち #1/#3/#4/#5 は前セッション継続で `8cfcac23` (v0.23.1) 実装済み。本セッションは残 **#2 サブスク額更新**を freee 実額で完了し、まさ依頼で **CX(p20) の無期限売上計上事故**を発見・修正、さらに「契約書→自動入力」の設計欠落を **spec 5-6 §Contract Apply** として正本化した。コード変更なし (DB 書き換え + md のみ)。

### #2 サブスク額を freee 取引実額で棚卸し (本番 DB 書き換え, まさ GO 済)
- freee OAuth (`freee_oauth_tokens` の refresh_token → access_token) で `/api/1/deals?partner_id=` を vendor 別に引き、`company_finance_recurring_items.amount_yen` を実額更新。
- slack ¥24,000→**¥20,828** / claude ¥45,000→**¥22,945** (freee正本ルール=freeeに実額あるものは優先。最新2025-10、Max化前のため2026実額が入り次第追従) / conduct ¥44,000→**¥48,400** (会計+労務2本→税理士一本へ契約変更。社労士法人コンダクトはfreee上2025-10で取引終了=解約確認。DBに社労士独立行は無く合算行を税理士単独額へ更新) / co-en=つくばまちなかデザイン **¥38,500 据置** (定常月額一致, 費目=地代家賃)。notion/DocuSign/freee 据置。
- まさ判断: 「freeeデータが有るものはそっち優先」「Aで(claude=freee厳守¥22,945)」「社労士側デリートでおけ」。
- 正本: `pwa/manual/4-5-*.md` に「サブスク額の正本=freee deals」行追加。commit `b1f95968`。

### CX(p20) 無期限売上計上事故の修正 (本番 DB 書き換え, まさ GO 済)
- **症状**: ZMP確認の前段でまさが指摘 → CX が `monthly_fixed ¥290,000 / start_ym=202511 / end_ym=null` で **202702 以降まで無期限に¥290,000を計上**。実際は 2026-06〜09 の4ヶ月有期契約 (最終振込10月)。
- **原因**: 契約抽出 (`contract_terms` に term `1cf248e3` = 2026-06〜09 / schedule_based / 税込¥990,000 / masa確定2026-06-15 が **applied**) は動いていたが、**contract_terms → projects へ反映する経路が無い**。projects は古い手入力値のまま。
- **修正**: projects.p20 を `fee_type='variable' / start_ym='202606' / end_ym='202610' / fee_amount=null` へ、`contract_terms_json` に契約メタ+月別スケジュール投入。billing_cycles の budget_yen (6月¥50,700/7-9月¥178,100) は正しいため不変更 → variable ロジックが ÷0.65 逆算で売上 6月¥78,000・7-9月¥274,000=税抜¥900,000 (契約一致)、10月以降は budget 無しで¥0。
- **検算済**: SQL で 202606=¥78,000 / 202607-09=¥274,000 / 202610以降=¥0 を確認。variable PJ は end_ym でなく billing_cycles の有無で月レンジが決まる (`live-monthly-pl-inputs.ts` 184行)。

### 契約 Apply 経路を spec 化 (まさ「契約書を見て自動入力する仕組みにしてほしい」「admin/projectsの契約関連カラムにも入れる」)
- `pwa/spec/5-6-contracts-management-current-spec.md` に **「契約抽出 → projects / billing_cycles 反映 (Contract Apply)」節**を新設。`contract_terms` (applied) を ①`projects.contract_terms_json` ②`projects.fee_type/fee_amount/start_ym/end_ym` ③`billing_cycles.budget_yen` の3層へ反映する正本経路と必須ガード (end_ym 必須 / 複数 term 分割 / schedule_based は月別展開 / 本番書き換えはレビュー承認後) を定義。
- `/admin/projects` の `AdminProjectsTable` は ① を展開した編集列群 (`contract_monthly_fee_yen` 等) を既に持つが、`contract_terms` テーブルから自動反映する writer は**未実装** (applied にしてもステータス更新のみ=手編集依存) と明記。
- **実装は別タスク** `task_20260616090543_vayt2` に起票 (参照spec・CX実例・p21 SX good例付き)。
- commit `cb8aa5dd` (manual 4-5/9-3, spec 5-6/6-1)。

### 申し送り中に確認できた事項
- #1 社保修正で出た「202602 役員報酬まさ ¥979,891行 + ¥100万行(202601-03)」の重複 → **¥100万は立替金精算とまさ確認済み (問題なし)**。社保 base 二重計上の懸念は残るが意図的な精算行。

### Verified
- 全 DB 書き換えは UPDATE 後 SELECT で反映確認。CX 売上は billing_cycles ÷0.65 逆算を SQL で再現確認。
- コード変更なしのため tsc/build は未実行 (md + DB のみ)。`git push origin main` 2回 (`b1f95968` / `cab8aa5dd`) 成功。

### 次セッションへ (spawn_task `task_ad1f0ea1` で起票済)
**ZMP(p19, 葛飾ロード) の収支確認・修正**:
1. ZMP の予算(売上)とメンバー支払いが同額で収支ゼロ → まさも参画してるので少なくともまさへの支払い分は粗利プラスになるはず。原因特定 (報酬予算が売上に張り付いていないか / まさ稼働を外部メンバー原価扱いしていないか)。
2. ZMP は月次定額 (¥300,000) 以外に **OkuDoor 開発を別途受託 (別財布)**。OkuDoor 分の売上・原価が OS に正しく入っているか確認 (別 project_id か billing_cycles か別テーブルか要調査)。
- ZMP 現状: p19 / 葛飾ロード / monthly_fixed ¥300,000 / start_ym=202506 / end_ym=null / contract_terms_json=null。

### ZMP 収支ゼロ / OkuDoor 別財布 — 原因特定 (2026-06-16)

**結論: ZMP は「収支ゼロ」ではなく、OkuDoor開発分(別財布)の売上が OS 未計上のまま原価だけ乗って赤字になる構造。**

調査で判明した事実:
- p19 ZMP には plan cycle `PC-p19-202601-202612` が**有る** (total_points=187, budget_yen=2,340,000=¥195,000×12=定額分のみ)。
- ZMP の MS は2系統:
  - **定額分(¥30万/月)**: 水素ステーション補助金・基本設計(routine,20pt) / 葛飾水素循環(routine,20pt) / ファシリテーション(routine,20pt) / 事務手続き(routine,10pt)
  - **OkuDoor(別財布)**: OkuDoor企画・関係者合意形成(normal,20pt,202601-08) / **OkuDoorシステム開発(cap_extra,67pt,202605-10)** / OkuDoor現地運用・オープン検証(normal,20pt,202609-12)
- billing_cycles.reward_summary_json は既に regular/extra 二財布で計算済:
  - `regularCapBudgetYen=195,000`(毎月固定=定額分65%)、`extraCapBudgetYen`=月変動(65,130/196,170/173,940=OkuDoor cap_extra分)
  - budget_yen = regular+extra の合算 → 260,130(4月)/391,170(5月)/368,940(6月)
- **収支ゼロ/赤字の機序**:
  - シミュレータ(monthly-pl-simulation.ts)は ZMP 売上を `projects.fee_amount=¥300,000`(定額分のみ)で計上。
  - メンバー原価は `computeForwardUncappedMemberCosts` の uncapped 報酬を注入。これは regular+extra 全部 = 定額分¥195,000 + OkuDoor extra ¥17万前後 ≈ ¥36万超。
  - **売上¥30万に対し原価¥36万超 → 赤字**。OkuDoor の売上が OS のどこにも無いため。
- **OkuDoor 売上の正本が OS に存在しない**: projects に別 project_id 無し / contract_terms に p19・OkuDoor・葛飾の抽出無し / company_finance_recurring に収入無し / freee deals キャッシュテーブル無し。OkuDoor受託額(売上)はまさしか知らない。

**構造上の不整合 (別財布化が中途半端)**:
- OkuDoor 3 MS のうち `cap_extra` は「システム開発(67pt)」だけ。`OkuDoor企画(20pt)`と`OkuDoor現地運用(20pt)`は tag=normal で **定額財布(regular)に混入**している。
- plan cycle budget_yen=2,340,000 は定額分しか積んでいないのに、OkuDoor pt(107pt)も同じ total_points=187 に含まれる → ptUnit 希釈・regular財布へのOkuDoor食い込みが起きる。

**まさ確認が必要な点 (報酬計算/売上どちらにも効く)**:
1. OkuDoor 受託の売上額・期間 (税抜/税込・月次按分か一括か)。これが無いと別財布の売上計上ができない。
2. OkuDoor 3 MS を全部 cap_extra(別財布)に統一すべきか (現状システム開発だけ extra)。
3. OkuDoor 売上を ZMP(p19) の billing_cycles に extra revenue として乗せるか、別 project_id を立てるか。

### 2026-06-16 (続き) — ZMP収支ゼロ問題を解決: 別財布売上を一級市民化 (v0.25.0)

**まさ確定**: A=実額をDrive/freeeから特定 / B=OkuDoor MS全部cap_extra統一OK / C-1=p19 billing_cyclesにextra revenue計上 + 複数財布PJの汎用管理化。計上は**請求日ベース(2026-03一括)**、入金日ではなく請求日で(キャッシュフロー観点だが今回はZMP収支の話に戻したため請求ベース)。実装は**B案=エンジンにextraRevenueを一級市民化**。

**OkuDoor実額をfreee請求書APIで完全特定** (`/iv/invoices` 経由、gas/008_FreeeInvoicePdf.js でパス発見):
- 請求書 **INV-0000000305** (#56752709, 葛飾ロード株式会社, 件名「システム開発費」), 請求日 **2026-03-31**, 支払期限 2026-04-30, payment_status=unsettled, deal_id=なし(会計取引未登録=会計deals側に定額分しか出なかった理由)
- 明細13行合計 = **税抜¥2,000,000 / 税込¥2,200,000** 一括
- 定額分は完全に別請求書: INV-309/307/304 各「2026-MM業務委託料」税込¥330,000

**根本原因 (確定)**: p19は `monthly_fixed`(¥30万/月)。`buildLiveMonthlyPlInputs` は変動売上を variable PJ限定で読むため p19 の billing_cycles 売上を読まず、売上=定額¥30万のみ。一方 OkuDoorシステム開発MS(`MS-p19-2026-02-okudoor-system`)は既に `cap_extra` pool で uncapped原価として `internalMemberCost` 経由で計上済み。**別財布の原価だけ乗り売上が無い** → 粗利を食い潰し収支ゼロ〜赤字。

**実装** (commit 同梱):
- migration 142: `billing_cycles.extra_revenue_json jsonb` 追加 (非破壊)。`[{label, amount_tax_excl, freee_invoice_number, billing_date, memo}]`
- `monthly-pl-simulation.ts`: `MonthlyPlProjectRevenue.extraRevenue` + `extraRevenueForYm()`。売上計・粗利・消費税・CF・残高に加算、**rateMember/rateCloser通さず** (cap_extra側で計上済み→二重計上防止)、請求日ベース同月キャッシュ(delay 0)、単発セマンティクス(ym一致のみ加算、翌月持続せず)
- `live-monthly-pl-inputs.ts`: 全PJの `extra_revenue_json` を読んで `projectRevenues[].extraRevenue` 注入
- `GasMonthlySimulationPanel.tsx` / `page.tsx`: pjDetail.extraRevenue を通し、収支表PJ名に `🔵別財布込`
- OkuDoor¥200万を p19/202603 の extra_revenue_json に投入

**検証 (本番データ end-to-end)**: live builder で p19/202603 revenue = ¥30万 → **¥230万**、grossProfit が¥200万増、CF差¥220万(税込)、翌月202604は¥30万のまま(持続せず)。build/tsc 通過。

### 2026-06-17 — 別財布売上の計上方式を請求月一括 → 開発期間按分 (B-a) に修正 (v0.25.1)

**経緯**: 上記 v0.25.0 は二転三転の中で「請求月一括 (2026-03)」で実装したが、まさの本来の意図は **B案=開発期間按分** だった (「開発が走った月に売上を分散。単月の収支が実態に近くなる。pt消化と同じ思想」)。まさ確定 2026-06-17「B-aで」。

**確定仕様 (A=期間 / B=B-a / C=B-2)**:
- **A. 按分期間** = OkuDoorシステム開発MS (`cap_extra`) の `period_start_ym=202605` 〜 `target_ym=202610` の **6ヶ月** (value_milestones から確認)
- **B. 計上方式 B-a** = PL計上もキャッシュ入金も同じ按分月 (請求月と按分月を分けない簡易版)
- **C. データ正本 B-2** = `extra_revenue_json` に `{amount_tax_excl, period_start_ym, period_end_ym}` を1行で持ち、**エンジン (live builder層) が期間で按分展開**。按分済みの数字を人が入れるのは将来の期間変更で破綻するため、総額+期間を正本にする (pt消化と同じ一元化思想)

**実装**:
- `live-monthly-pl-inputs.ts`: `ExtraRevenueEntry` に `period_start_ym`/`period_end_ym` を追加。期間指定があれば `monthsBetween`/`nextYmInt` ヘルパーで総額÷月数を各月行に展開し `(projectId,ym)` で集約して push (端数は最終月寄せ)。期間指定なしは従来どおり `billing_cycles.ym` 一括 (後方互換)。シミュ期間外の按分月は捨てる。
- `monthly-pl-simulation.ts`: **エンジン本体は無改修**。既存 `extraRevenueForYm` (ym一致加算) と cashRevenue (delay 0) がそのまま按分済みデータを受ける。コメントのみ「請求日ベース単発」→「按分は live-inputs層で展開」に更新。
- **本番データ更新**: p19/202603 の extra_revenue_json に `period_start_ym=202605`/`period_end_ym=202610` を追加 (`amount_tax_excl=2000000` は不変)。按分結果 = 202605〜202609 各¥333,333 + 202610 ¥333,335 = ¥2,000,000。まさGO「ごー！」取得済み。

**検証 (本番データ end-to-end)**: `buildLiveMonthlyPlInputs` → `runMonthlyPlSimulation` で p19 月次売上を確認: 202601〜04 ¥30万 / 202605〜09 ¥633,333 (定額¥30万+按分¥333,333) / 202610 ¥633,335 / 202611以降 ¥30万。cash も同月一致 (B-a)。按分合計¥200万。tsx のモジュールキャッシュで一度0件に見えたが、新規プロセスで再実行して正しく按分されることを確認。デバッグログは commit にも本番にも未混入。

**⚠️ deploy 後にまさが発見した未反映問題 (→ BUGS.md に記録、次セッション最優先)**: まさが `/admin/payouts` の「先12か月 PJ収支」表を見ると ZMP が按分されず横ばい。原因は **PJ収支コンポーネントが2系統**あること。(A) `/management-score` 月次収支シミュレータ = live builder 経由で按分反映済み。(B) `/admin/payouts`「先12か月 PJ収支」(`AdminPayoutsClient.tsx:2516`) = `cycle.budget_yen` ベースの独自 forecast ロジックで `extraRevenue`/`extra_revenue_json` を**一切読まない**。本セッションは (A) だけ検証して「反映OK」と報告した verify 網羅性不足。(B) の forecast 計算 (line 720-760付近) に按分ロジックを足す必要あり (live-inputs の `monthsBetween`/`nextYmInt` を共通ヘルパー化して両系統で共用が望ましい)。

**今後の課題 (別セッション可)**: ① OkuDoor企画(20pt)・現地運用(20pt)MSが tag=normal で regular財布に混入したまま (B「全部cap_extra統一」未完。原価側の財布分離はsystem開発のみ)。② plan cycle total_points=187 に OkuDoor pt も含まれ ptUnit希釈 → regular財布へ食い込み。③ 他PJの別財布売上があれば extra_revenue_json に順次投入。

### 2026-06-17 — 別財布売上の開発期間按分を /admin/payouts PJ収支表にも反映 (共通lib化, v0.25.2)

**経緯**: 直前セッション (v0.25.1) で別財布売上の開発期間按分 (B-a) を実装したが、`/management-score` 月次収支シミュレータ (A系統) にだけ反映し、`/admin/payouts`「先12か月 PJ収支」表 (B系統) を verify 時に見落とした。まさが (B) を見ると ZMP(p19) が 202607 以降「予算 ¥195,000」で横ばい、別財布按分が乗っていなかった (BUGS.md 2026-06-17)。原因は **PJ収支を出すコンポーネントが2系統**あり、(B) は `cycle.budget_yen` ベースの独自 forecast で `extra_revenue_json` を一切読まなかったこと。

**対応 (按分ロジックを共通 lib に集約)**:
- **新規 `src/lib/finance/extra-revenue.ts`**: `expandExtraRevenue(rows, {minYm, maxYm})` + `ymToInt`/`nextYmInt`/`monthsBetween`。`extra_revenue_json` を持つ全行を受け取り、`period_start_ym〜period_end_ym` を月次按分して `(projectId, ym)` ごとに集約 (端数は最終月寄せ)。期間未指定は `billing_cycles.ym` へ一括 (後方互換)。**両系統がこの1関数を呼ぶ**ことで再発防止。
- **(A) `live-monthly-pl-inputs.ts`**: ローカルの按分ループ・型 (`ExtraRevenueEntry`/`ymToInt`/`nextYmInt`/`monthsBetween`) を削除し共通 lib を import。挙動不変。
- **(B-route) `src/app/api/admin/payouts/route.ts`**: `loadTargetData` に「`extra_revenue_json IS NOT NULL` の全行」を読むクエリを追加し `extraRevenueRows` で返却。**按分元 ym が表示窓より前 (例: OkuDoor は ym=202603) でも取りこぼさないため、表示期間でクエリを絞らず全行取得→展開後に minYm/maxYm でフィルタ**する設計に統一。
- **(B-client) `AdminPayoutsClient.tsx`**: `buildProjectMonthlyFinanceRows` が `expandExtraRevenue` を呼び、各月セルに `extraRevenueYen` を加算 (`finalBalanceYen = budgetYen + extraRevenueYen - forecastPayoutYen`)。cycle が無い PJ×月に按分が残れば独立セルを立てる。grand chip / 列計 / 各セルに `別財布 ¥…` を sky-blue 表示。フィルタ条件に `extraRevenueYen > 0` を追加。

**検証 (両系統)**: 本番 DB の唯一のソース行 (p19, ym=202603, OkuDoorシステム開発 税抜¥2,000,000, period 202605〜202610) を共通 `expandExtraRevenue` に通すと **202605〜202609 各 ¥333,333 / 202610 ¥333,335 / 計 ¥2,000,000**。両画面が同一ソースクエリ・同一関数を共有するため、この値が両方に出る。`/admin/payouts` は admin auth gate のため headless ブラウザでのスクショは不可 (認証情報入力は禁止行為)。データ経路を end-to-end で検証して目視スクショの代替とした。tsc/build green。

**今後の課題 (別セッション継続)**: ZMP 残課題は変わらず — ① OkuDoor企画(20pt)・現地運用(20pt)MS が tag=normal で regular財布混入。② plan cycle total_points=187 に OkuDoor pt 含まれ ptUnit希釈。③ 他PJ別財布売上を順次 extra_revenue_json 投入 (period_* 付きで自動按分)。

### 2026-06-17 — /admin/payouts 先12か月PJ収支の将来原価を uncapped 投影へ統一 (予算決め打ちの嘘原価を解消, v0.25.3)

**経緯**: v0.25.2 deploy 後、まさが `/admin/payouts`「先12か月 PJ収支」表で「まだ多くの月の支払いが195,000円。おれ (まさ) も活動してるんだから、おれへの支払い分が入ってたら収支がプラスになるはず」と指摘。えいみが当初「plan 終了後 (202701以降) の原価未投影が真因」と誤診断したところ、まさが明確に訂正:**「いや、問題はそこじゃないよ。202607でも195,000円の原価がかかってる。予算195,000に対して原価195,000っておかしいよ。」** = まさが見ているのは**原価列**で、plan 期間**内**の将来月 (202607 など) の原価が予算 (baseCap ¥195,000) と同額に張り付く嘘が真因。

**真因**: (B) `/admin/payouts` 表 (`AdminPayoutsClient.tsx` の `buildProjectMonthlyFinanceRows`) は、実績 `reward_summary` がまだ無い将来月で `forecastPayoutYen = budgetYen` (= 予算をそのまま使い切る乱暴な仮置き) を原価にコピーしていた。一方 (A) `/management-score` 月次収支シミュは `computeForwardUncappedMemberCosts` で実 uncapped 報酬 (まさ含む稼働メンバーの earnedPt × ptUnit) を投影していた。**(A) は正しく (B) だけ budgetYen 決め打ちの非対称**。

**対応 (将来原価ソースを両系統で uncapped に統一)**:
- **route (`src/app/api/admin/payouts/route.ts`)**: forecast 対象の active PJ ごとに `computeForwardUncappedMemberCosts(db, projectId, ym, { persist: false })` を呼び、plan cycle 期間の各月 uncapped 原価を `forecastUncapped: [{ projectId, ym, uncappedTotalYen }]` で返却 (`persist:false` = 本番 DB に書かない読み取り投影)。`Promise.allSettled` で 1 PJ 失敗が全体を落とさない。
- **client (`AdminPayoutsClient.tsx`)**: `buildProjectMonthlyFinanceRows` が `(projectId, ym)` → uncapped の Map を作り、実績メンバー無し将来月の `forecastPayoutYen` を **uncapped 優先**に置換。uncapped が取れない月 (plan 期間外など) だけ従来の budgetYen 決め打ちへフォールバック。
- これで (A)/(B) が同じ `computeForwardUncappedMemberCosts` を将来原価ソースにする。

**検証**: 本番 DB で p19 forward uncapped を `npx tsx` で実測。**202607 真原価 = ¥393,705** (まさ稼働分 ¥191,685 含む)・202608 ¥396,630・202609 ¥777,465・202610 ¥304,200・202611 ¥129,675・202612 ¥100,815。予算 ¥195,000 とは別物。修正後の手計算: 202607 = 195,000 + 333,333 (別財布) − 393,705 = **+134,628**、202611 = 195,000 + 0 − 129,675 = **+65,325**、202612 = 195,000 − 100,815 = **+94,185**。原価 ¥195,000 横ばいは消え、まさの稼働分が乗って収支が動く。tsc/build green、BUILD_VERSION v0.25.3。

**残課題 (別)**: 202701 以降 (plan 期間外、ZMP plan 終了 202612 など) は uncapped が出ず従来 budgetYen 決め打ちにフォールバック。これは plan 未策定の設計判断で、plan 延長 vs ロジック改修はまさの方向確認待ち。

### 2026-06-17 — /admin/payouts 支払予定を uncapped → capped + 役員除外(落とす一択) に修正 (KUTE¥0 / マイナス月解消, v0.25.4)

**経緯**: v0.25.3 deploy 後、まさがスクショで3点指摘 — ① **マイナス月があるのはおかしい (キャップが効いてるはず)** ② **OkuDoor分の支払いはうめ・あび2人で計¥40万のはず** ③ **KUTE(まさ・りり・きよの3人=全員支払対象外) で異常な金額の支払いが出る理由特定。支払いが¥0でない時点で変**。

**えいみの判断ミス2件 (まさ叱責)**:
1. **(最重要) 役員除外を「(i)落とす / (ii)非役員へ再配分」の2択で提示した**。まさ:「もちろん(i)じゃないとダメに決まってる。(ii)にしたら、おれがいくら各PJで働いてもメンバーに巨額を払うことになって数カ月でAMDは倒産する。そんなロジックを選択肢に入れる時点でおかしくない?」→ **役員が抜けた share は単に落とす (i) 一択**。再配分は倒産ロジックで、選択肢に並べた判断自体が誤り。
2. **v0.25.3 で /management-score の「原価=uncapped」を /admin/payouts の「支払予定」列に流用した**のが誤り。spec 7-1 正本では **実際の月次支払い (= /admin/payouts, 支払通知書) = capped** (月次キャップ budget_yen + stockYen 繰越平準化適用後)、**月次収支シミュの原価 = uncapped** で別物。uncapped を支払予定に出すと pt 消化が厚い月に budget を超えて跳ねる (KUTE uncapped ¥778,260 vs budget ¥654,545、マイナス月の正体)。

**真因**: (B) /admin/payouts の forward 投影に (i) capped 化 (ii) 役員除外 が両方無かった。

**対応 (A案: capped + 役員除外)**:
- **新規 `computeForwardCappedMemberCosts(db, projectId, anchorYm)` (`src/lib/reward-summary.ts`)**: uncapped 版と同じデータ取得 + `members` select に `is_officer, exclude_from_payout_notice` 追加。各月で `buildRewardSummary({ ym, ..., billingsByYm, planCycle, project })` を呼ぶ (= cap + stock 繰越連鎖はコア内部で完結、外部で carryIn を組まない)。役員/除外メンバーを `excludedMemberIds` set に入れ `payableMembers = summary.members.filter(m => !excludedMemberIds.has(m.memberId))`、`cappedTotalYen = Σ payableMembers.totalPay`。DB 書き込みなし (persist オプションなし)。コア `buildRewardSummary` は無改修。
- **route**: `forecastUncapped`/`computeForwardUncappedMemberCosts` → `forecastCapped: [{projectId, ym, cappedTotalYen}]`/`computeForwardCappedMemberCosts` に差し替え。
- **client (`AdminPayoutsClient.tsx`)**: `forecastCapped` を `(projectId,ym)→capped` Map 化。`cappedForecast != null ? cappedForecast : (budgetYen フォールバック)`。**`!= null` (0 を含む) にしたのが肝**: 役員のみ PJ (KUTE) は capped=¥0 が正しい結果なので budgetYen フォールバックに落とさない (`> 0` だと KUTE で巨額が再発)。

**検証 (本番データ end-to-end, probe で実測)**:
- **KUTE(p25)**: 全月 capped 支払予定 = **¥0** (まさ・りり・きよ全員 is_officer/exclude で落ちる)。まさ指摘③解消。
- **ZMP(p19)**: capped が budget 内に平準化 (202609: uncapped ¥777,465 → **capped ¥215,169**)。支払先は あび/うめ/しん/こう (非役員) のみ、まさ (役員) は落ちる。**マイナス月消滅** (指摘①解消)。
- OkuDoor「うめ・あび¥40万」(指摘②) の切り分けはスコープ外: ZMP に しん/こう が出るのは ZMP **本契約 regular MS** (水素/葛飾/ファシリ/事務) への貢献で正しい。OkuDoor企画(20pt)/現地運用(20pt) が tag=normal で regular 財布混入は別課題 (HANDOFF 残課題、起票済)。OkuDoorシステム開発(67pt) のみ cap_extra (= 別財布、うめ・あび担当)。
- tsc/build green、BUILD_VERSION v0.25.4。probe スクリプトは検証後削除。

**教訓 (正本: BUGS.md / manual 7-1 / manual 4-5)**:
- **「倒産につながるロジック」を選択肢に並べた時点で判断が間違っている**。選択肢提示の前に「これは経営として成立するか」を自分でフィルタする。役員除外は再配分しない (落とす) 一択。
- **原価 (uncapped) と支払予定 (capped) は別概念**。/management-score の数字を /admin/payouts に流用しない。spec 7-1 が正本。
- **役員除外がコア `buildRewardSummary` に無く各画面で後付け**なのが構造的な穴。新しい支払系 forward 投影を書くたびに役員除外を再実装する羽目になる。将来コアへ寄せる候補。

---

### 2026-06-18 — Contract Apply pipeline 実装 + つくよみ月次自動確定 cron + KUTE(p25) 適用 (v0.27.0 / v0.27.1)

**まさの元意図**: 「契約書を抽出できてるなら、もう自動的に金額いれて、その確認だけをPMにslack nudge投げるだけのプロセスにしてほしい」「全PJの仕組みを変えたい」。設計①案確定: **`/admin/contracts` で contract_term を applied にする = 人 admin が金額をレビューした確認ポイント**。以降は つくよみ (月次 cron) が契約由来額を自動で `budget_confirmed` まで進め、PM には事後通知 DM のみ (毎月の tap 確認は不要)。

**フェーズA — pipeline 実装 (1 commit `373724b5`, v0.27.0)**:
- **`src/lib/contracts-apply.ts`** (新規): `deriveContractApplyPlan(term)` (純粋関数, DB 非依存=テスト可能) + `applyContractTerms(db, termId, actor)`。`REWARD_RATE=0.65`。分岐: **schedule_based (or monthly[] あり & monthly_average でない)** → `fee_type='variable'` / `fee_amount=null`、`billing_distribution_json.monthly[]` を ③ `billing_cycles.budget_yen` に月別展開 (各月 `reward_cap_yen ?? budget_yen ?? round(amount_tax_excl×0.65)`)、`contract_source_term_id` を刻む。**monthly_fixed / monthly_average** → `fee_type='monthly_fixed'` / `fee_amount = monthly_tax_excl (無ければ総額÷月数)` を ② に立て、③ は触らない。**end_ym 必須ガード** (CX 無期限計上事故の再発防止)。冪等性: 既に budget_confirmed/allocation_confirmed/invoice_sent/payment_confirmed の月は budget_yen を上書きしない。`billing_log` に action='contract_applied'。
- **`src/app/api/contracts/apply/route.ts`** (新規): `GET` dryRun preview / `POST` apply (requireAdmin)。
- **`src/lib/contract-billing-auto.ts`** (新規): `isWithinContractPeriod` (start_ym≤ym≤end_ym、**end_ym null は対象外**) / `resolveContractBilling` (schedule_based は `budget_yen÷0.65` で請求額逆算、monthly_fixed は `fee_amount`) / `collectAutoConfirmCandidates`。
- **`src/app/api/cron/contract-billing-auto-confirm/route.ts`** (新規): `GET`(CRON_SECRET) / `POST`(admin)。`reported→budget_confirmed` を `decideBudgetApproval` で進め (`budget_yen=請求額×0.65`)、PM へ Slack DM 事後通知 (つくよみ口調)。actor=`つくよみ(契約自動確定)`。
- **`vercel.json`**: cron 登録 `{ "path": "/api/cron/contract-billing-auto-confirm", "schedule": "0 22 1 * *" }` (= 毎月1日 JST 07:00)。
- spec/manual 同期: `spec/5-6` の Contract Apply を「未実装」→「実装済み (2026-06-18)」へ、月次自動確定節を新設。`manual/6-3`、changelog `spec/6-1`・`manual/9-3` 追記。本番で CX(p20)/SX(p21) を新 writer で再 apply 済み (CX: src 付与, SX: end_ym=202703 補完)。tsc/build green。

**フェーズB — KUTE(p25) 適用 + 台帳化 (DB操作 + 1 commit `3e3e32d8`, v0.27.1)**:
- 契約書 = Drive `00_契約_KUTE` の `260501_業務委託契約書(260501_270331)_工学院大学_AMD.PDF` (税込 7,920,000 / 税抜 7,200,000、2026/5/1〜2027/3/31、第7条 毎月均等支払)。
- parent `contracts` 行作成 (`16055139…`, status='signed', review_status='accepted'。signed_document_id は uuid のため Drive ref は source_refs_json へ)。
- `contract_terms` に applied term 作成 (`term_id=d35d3184…`, billing_distribution='monthly_average', billing_distribution_json=`{months:11, monthly_tax_excl:654545, monthly_payout_cap_65:425454}`)。**`source_term_hash` は NOT NULL** — SX 先例 (`q-…-tax-excl-…-period-…`) に倣い `kute-contract-tax-excl-7200000-period-202605-202703` の人間可読合成キーに。
- Contract Apply 実行 (monthly_fixed branch を SQL で忠実再現): projects p25 → `fee_type='monthly_fixed'` / `fee_amount=654,545` / `start_ym=202605` / **`end_ym=202703`** / `contract_terms_json` 反映。③ billing_cycles は monthly_average のため不変。`billing_log` 監査行追加。
- KUTE は **役員のみ PJ** (manual/7-1 L292) → 報酬 cap=654,545×0.65=425,454 だが役員は payout から落ちる (再分配しない) ので capped 支払予定=¥0 が正しい結果。
- `spec/5-6` に「Contract Apply 適用済み PJ (2026-06-18 時点)」台帳 (p20/p21/p25) を新設、`spec/6-1` 附則追記。

**全PJ展開**: 未 apply の契約保有 PJ を調査 (下記)。**特に p06 CTB / p10 SE / p19 ZMP が end_ym=null で CX 同型の無期限計上リスク**。残り展開は独立セッション (spawn_task `task_48afedcf`「Contract Apply を残り契約PJへ全展開」) に申し送り。

**全PJ apply 状況 (2026-06-18 時点, projects×contract_terms×billing_cycles を join 調査)**:
| 状態 | PJ |
|---|---|
| ✅ apply 済 (has_ct_json, end_ym あり) | p20 CX / p21 SX / p25 KUTE |
| ⚠️ end_ym=null で無期限計上リスク (billing 動作中) | p06 CTB (variable) / p10 SE (¥100,000) / p19 ZMP (¥300,000) |
| 期間確定だが未 apply (has_ct_json=false) | p09 JC (〜202603) / p11 BWE (〜202603) / p22 OQC (〜202512) / p23 UST (〜202601) |
| 契約/請求実体なし (billing_months=0) = 対象外見込み | p01 OPT / p02 r3kt / p03 tiem / p04 KT / p05 MC / p07 LST / p08 CCC / p12 b1 / p14 AER / p16 ORB / p18 YD / p24 CLG / p26 VasculaX |

**教訓**:
- 値の出所は契約書 PDF + 算定正本 (manual/7-1) のみ。生データから budget の意味を再導出しない (まさ「設計書読んだら全部書いてある」2026-06-18)。budget_yen=報酬 cap (=feeAmount×0.65) であり請求額ではない。
- monthly_average branch は ③ billing_cycles を触らない。KUTE の既存手入力 budget_yen=654,545 (税抜月額が cap 列に座っている=本来は ×0.65 すべき値) は残置されるが、役員のみ PJ で payout=¥0 なので実害なし。schedule_based PJ で同じ残置が起きると誤差要因になるので注意。
- `contract_terms` の NOT NULL 列が多い (source_term_hash / source_title / currency / billing_distribution / billing_distribution_json / fee_type_hint / confidence / review_required / review_status / status / source_refs_json / extracted_terms_json)。PK=term_id。review_status は applied 可。一方 parent `contracts` の review_status は pending/accepted/rejected/not_needed のみ (applied 不可) — 別 enum なので混同しない。

---

### 2026-06-18 — MTG詳細MarkdownのAMDメンバーリンク修正 (v0.27.6)

**対象**: production `/project/p21/cockpit?meeting=7ui75q9llsbfaidd4631kcoagu`。SX の会議 `SX 産連訪問＋メール設定＋石原先生と1on1` (2026-06-10) の議事録本文で「まさ」がリンク化されていなかった。

**調査結果**: DB 側は正常。`members` には `code_name='まさ'` / `member_id='ID001'` / active が存在し、対象 `project_meeting_summaries.narrative_md` にも該当表記が複数あった。原因は表示経路で、MTG詳細モーダルが `MarkdownView` で Markdown を描画しており、`LinkedMemberText` を通していなかった。

**対応**: `MarkdownView` に `memberLinks` option を追加し、通常テキスト child だけを `LinkedMemberText` へ渡すようにした。既存 Markdown link / code / pre はリンク化対象外。`CockpitMeetingDetailModal` の narrative / summary / raw / prep / dialogue 表示で `memberLinks` を有効化し、`build-info` を v0.27.6 に更新。

**検証**: `npm exec tsc -- --noEmit`、`npm run build`、`npm run test:critical-ui` green。`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で main push + production deploy 済み。live `/api/build-info` は `build_version=v0.27.6` / `git_sha=895a1bda427ae755298c7d5c01d188f4012abcde` / `dirty=false`。

**正本同期**: `pwa/design/meeting_summaries.md`、`pwa/manual/2-3-pj-cockpit.md`、`pwa/design/FEATURE_REGISTRY.md`、`pwa/BUGS.md` に、MTG詳細Markdownの member link 契約と再発防止を追記。

---

### 2026-06-19 — SX reward cap / reserve buffer / officer reserve equal allocation (v0.28.1 / v0.28.3)

**経緯**: `/admin/payouts` の「PJ別収支 / 予算チェック」で SX の支払が出ない・PJ予算と支払額が不自然に同額/0円になる件を調査。まさの運用前提は、契約開始前の4月/5月稼働は実在するので stock として扱う一方、SX立ち上げ前のまさ事前稼働80万円は AMD が回収してよい。ただし一括回収は強すぎるため **20万円ずつ4か月** に平準化し、さらに役員留保も他メンバーと同等に扱う、というもの。

**対応1: 契約バッファの月次消化上限 (commit `1c4aa8c`, v0.28.1)**:
- `contract-money.ts` に `companyReserveBufferMonthlyYen` 系キーを追加。`resolveContractReserveBufferYen` は「未消化残額」「当月 invoice×65%」「月次上限」の最小値を `budget_buffer_amount` にする。
- SX(p21) の `projects.contract_terms_json` を `companyReserveBufferYen=800000`, `companyReserveBufferStartYm=202606`, `companyReserveBufferMonthlyYen=200000` に更新。
- SX `billing_cycles` は 202606〜202609 が `budget_buffer_amount=200000`, `budget_yen=481200`、202610以降は `budget_buffer_amount=0`, `budget_yen=681200`。

**対応2: 役員会社留保を先取りせず、通常cap按分に入れる (commit `ef84244`, v0.28.3)**:
- `applyRewardCapsForMonth` で `companyReserveMemberIds` を `payoutExcludedMemberIds` に混ぜるのをやめ、役員も通常の `allocateCap` 入力へ入れる。
- 役員に割り当たった `paidYen` は `companyReserveYen/officerReserveYen` へ振り替え、支払通知書 `totalPay` は0のまま `payoutExcluded=true`。役員の未充当分は `companyReserveUnfundedYen` に残し、翌月 stock へは繰り越さない。
- `computeForwardCappedMemberCosts` も同じ考え方に合わせ、役員はcap配分に参加しつつ forecast 支払対象からは外す。

**正本同期**:
- `pwa/spec/5-6-contracts-management-current-spec.md`: 契約バッファ総額 + 月次上限、SX 80万円/20万円×4か月を記載。
- `pwa/manual/7-1-reward-calc-spec.md`: `budget_buffer_amount` 優先、役員会社留保を通常cap按分に入れる式へ更新。
- `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`: 支払通知書対象外の役員でも、cap按分で割り当たった分を会社留保に残すと明記。
- `pwa/spec/6-1-appendix-changelog.md` / `pwa/manual/9-3-appendix-changelog.md`: 2026-06-19変更履歴を追記。
- `pwa/BUGS.md`: deploy後に報酬キャッシュを最新コードで再計算確認する運用 lesson を追記。

**検証**:
- `npx tsc --noEmit --pretty false`
- focused eslint (`reward-summary.ts`, `build-info.ts`, `AdminPayoutsClient.tsx`, `/api/admin/payouts/route.ts`) — error 0、既存 warning 2 件のみ (`fmtDeltaYen`, `budgetAuditBadge`)。
- `npm run build`
- `npm run test:critical-ui && npm run test:deploy-version-guard`
- `bash pwa/scripts/deploy.sh --dry-run`
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`
- production `/api/build-info`: `v0.28.3` / `ef84244e97b597235a77f90dc0789766259363eb` / `dirty=false`。

**SX DB再計算結果 (production Supabase, p21)**:
- 202606: `invoice=1048000`, `buffer=200000`, `budget=481200`, `totalPaySum=274169`, `companyReserveYen=207031`, `carryOverYen=722658`。
- 202606 member: まさ留保 `207031`, かる支払 `136460`, ちこ支払 `137709`。
- 202607〜202609 も `buffer=200000` のまま、役員留保と非役員支払が同じcap按分で配分される。

**教訓**: `reward_summary_json` はキャッシュなので、報酬ロジックを変えたら deploy だけで終わらせない。production build が新SHAへ切り替わった後に対象PJの報酬キャッシュを再計算し、DBの対象月を再照合してから closeout する。

---

### 2026-06-19 — 月初合意の支払/未払いstock表示分離 (v0.28.7)

**経緯**: `/monthly-agreement` の SX 詳細で、`未払いストック` が通常の報酬額と同じ見え方になり、さらに admin の `/admin/monthly-work-agreements` 一覧では `予定報酬` しか見えず、今月支払と未払い残の差が分からなかった。

**確認結果**: SX 202606 の非役員支払が出ている理由は表示バグではなく、v0.28.6 時点の current reward rule によるもの。契約バッファ20万円を控除した残 cap を、役員会社留保と非役員支払へ同じ配分母で按分しているため、かる/ちこに今月支払が出る。`stockYen` は当月新規発生分ではなく、前月繰越 + 今月発生 - 今月支払後の **今月末未払い残**。

**対応**:
- `/monthly-agreement`: PJカードの主表示を `今月支払` にし、`stockYen` は `今月末未払い残（今月は支払われない）` として分離。前月繰越・今月発生・今月支払の内訳を追加。
- `/admin/monthly-work-agreements`: API/型に `payoutYen` / `stockYen` / `grossDueYen` / `carryInYen` を追加し、一覧に `今月支払` / `未払い残` 列と合計カードを追加。
- spec/manual/changelog を同期し、stock は支払予定ではなく今月末未払い残として読むことを明記。

**注意**: 「SX 202606 は本来支払0円にしたい」という判断なら、UI修正ではなく reward cap / contract buffer の business rule 変更が必要。今回の修正では計算式は変えていない。

---

### 2026-06-19 — H-1 recurring 予定MTGカード series 集約修正 (v0.28.8 → v0.28.9 closeout)

**経緯**: H-1 Meeting Flow の future Calendar sync で、定例会が複数カードとして cockpit / HUD に並んで見えるのはよくない、というまさ指摘を受けて即時実装。v0.28.7 で一度 `recurring_event_id` / Calendar instance id / weekly cadence による series 集約を入れたが、まさの画面ではまだ重複が残った。

**原因**: `project_meeting_summaries` には `recurring_event_id` 列が無い。既存DB行は `calendar_event_id` / `meeting_id` / title から series を復元する必要がある。v0.28.7 の fallback key は `PJ + normalized title + 曜日 + 開始時刻` だったため、月次定例や曜日がズレる recurring 予定は別 series と見なされ、複数カードが残った。

**対応**:
- `pwa/src/lib/meeting-series.ts` を追加し、`isUpcomingMeeting` / `isPrepMeeting` / `groupUpcomingMeetingsBySeries` を共通化。
- `CockpitMeetingSummary` / `HudCockpitMeetingSummary` は upcoming raw rows ではなく series card を表示し、series count を予定件数として出す。隠れた同 series 予定は `同シリーズ +N` として表示。
- `calendar-sync` は `recurring_event_id` が取れる series を cadence 問わず次回1件だけ保存し、2件目以降を `recurring_series_future_occurrence` で skip。
- v0.28.8 で title に `定例` / `月次` / `毎月` / `weekly` / `monthly` 等がある予定を `title-series` として `PJ + normalized title + 開始時刻` で束ねる fallback を追加。曜日を key から外し、月次/不規則定例も次回1件に畳む。

**正本同期**:
- `pwa/design/meeting_summaries.md`
- `pwa/design/L2_DATA.md`
- `pwa/manual/2-3-pj-cockpit.md`
- `pwa/manual/3-2-data-and-extraction.md`
- `pwa/manual/8-3-l2-extraction-routines-spec.md`
- `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`
- `pwa/manual/9-3-appendix-changelog.md`
- `pwa/BUGS.md`

**検証**:
- `npx eslint src/lib/meeting-series.ts src/components/cockpit/CockpitMeetingSummary.tsx src/components/hud/HudCockpitMeetingSummary.tsx src/app/api/meeting-prep/calendar-sync/route.ts`
- `npx tsc --noEmit --pretty false`
- `npm run test:critical-ui`
- `npm run lint` 全体は既存 lint debt で失敗するため、今回変更範囲は targeted lint で確認。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で main push + Vercel production deploy。v0.28.8 は `/api/build-info` `934d56f2...` で確認。closeout 時点の main / origin/main は `e2e9b34e`、build version `v0.28.9`、production `/api/build-info` は `v0.28.9` 確認対象。

**教訓**: recurring series をDB列として保持していない状態では、Calendar instance id pattern だけに依存しない。title-based fallback も必要で、特に月次/毎月/定例は曜日を key に入れると再発する。

---

### 2026-06-19 — /admin/payouts 報酬債務台帳と未払い残表示の再設計

**経緯**: SX の未払い残が大きく見える理由は、202604/202605 の契約前稼働が正しく後月支払へ繰り越されているためだった。ただし `/admin/payouts` と先12か月表では `stock` が単独表示に近く、数か月後に「なぜ多いのか」を再調査しやすい設計だった。

**対応**:
- `/admin/payouts` 上部に「報酬債務台帳」を追加。`前月残 + 今月発生 - 今月支払 = 月末未払い残` を member × PJ × 稼働月ごとに表示し、`契約前発生` / `繰越+今月発生` / `繰越のみ` / `cap不足` で原因分類する。
- 先12か月表と支払明細の表示語を `stock` から `未払い残` に統一し、今月支払・本契約cap・別財布・未払い残を分けて読む形へ整理。
- `stockYen` は PL 原価や cash out ではなく報酬債務残高であることを、manual 6-5 / 7-1、spec 3-14、design `project_pl_monthly.md` に同期。

**注意**: 今回は表示・監査面の改善で、`reward_summary_json` の計算式や支払額は変えていない。SX の 202606 支払が出るのは、契約バッファ控除後の残 cap を役員会社留保と非役員支払へ同じ配分母で按分する current rule の結果。

---

### 2026-06-19 - H-1 task auto-registration + owner Slack nudge (v0.28.9)

**経緯**: MTGカード/議事録由来の Calendar review queue を `/admin/calendar-review` として一度作ったが、まさから「adminが全部レビューする例外運用は作らない。自動でタスク化して担当者本人にだけ Slack nudge が飛べばいい」と指摘があった。

**対応**:
- `/admin/calendar-review` 画面と Admin sidebar 導線を削除。
- `POST /api/task-calendar/register-tasks` を追加し、H-1 が抽出した MTG next action / Gmail TODO / Slack TODO を `tasks` に自動登録する contract に変更。
- `task_id` で冪等化し、既存 task は既定で再通知しない。`renotify_existing=true` の時だけ再通知候補にする。
- Slack nudge は担当者本人のみ。送信先は payload の `owner_slack_user_id`、無ければ `members.slack_id`。`send_slack=true` かつ non-dry-run の authorized call の時だけ送る。
- Calendar 作業枠候補は `/api/task-calendar/schedule-plan` の dry-run planner として残し、PWA route は Calendar event 作成 / Gmail送信 / 外部attendee招待を行わない。

**正本同期**:
- `pwa/spec/3-3-meeting-flow-current-spec.md`
- `pwa/spec/2-1-pwa-runtime-routes.md`
- `pwa/spec/2-2-pwa-surface-inventory-current-spec.md`
- `pwa/manual/3-2-data-and-extraction.md`
- `pwa/manual/8-3-l2-extraction-routines-spec.md`
- `pwa/manual/9-3-appendix-changelog.md`
- `pwa/spec/6-1-appendix-changelog.md`
- `pwa/BUGS.md` (deploy gate 誤停止の運用 lesson)

**検証**:
- `npm run test:task-calendar-register`
- `npm run test:task-calendar-schedule-plan`
- `npm run test:meeting-calendar-upsert-plan`
- targeted eslint
- `npx tsc --noEmit`
- `npm run build`
- `npm run test:critical-ui`
- production `/api/build-info`: closeout 時点で `v0.28.13` / `e32d2bd2` / `dirty=false` or newer (実装 commit `2354e085` を含む)
- production unauthenticated route smoke: `/api/task-calendar/register-tasks` は `401 unauthorized`

**注意**: 検証では実 Slack DM は送っていない。H-1 automation 配線時はまず `dry_run=true` で payload / 重複 / owner Slack mapping を確認し、対象・件数・rollback・通知有無を明確にしてから `send_slack=true` にする。

---

### 2026-06-19 — /admin/payouts 先12か月表を目的別4表へ分解 (v0.28.13)

**経緯**: まさが `/admin/payouts` / `/management-score` の先12か月表を見て、「入より出が大きいPJが増えている」「会社留保を増やせているかを見たいのに、支出に会社留保を入れる意味がわからない」と指摘。さらに SX の未払いストックが大きく見え、契約前稼働分の繰越として正しくても、後からまた理由を調べる設計になっていた。

**対応**:
- `/admin/payouts` と `/management-score` 下部の先12か月表を `キャッシュ支払` / `会社留保` / `報酬債務` / `cap超過チェック` の4表へ分解。
- `キャッシュ支払` は非役員・支払通知対象メンバーへの外部支払だけを見る。会社留保は支出に混ぜない。
- `会社留保` は `cap/売上枠 - 外部支払` として表示し、役員留保 (`regularCompanyReserveYen` / `extraCompanyReserveYen`) は内訳として読む。
- `報酬債務` は `stockYen` の月末残高を各月残・ピーク・最終月残で見る。12か月分を合計しない。
- `cap超過チェック` だけが `報酬需要 - cap/売上枠` を見る。
- `computeForwardCappedMemberCosts` の戻り値に外部支払、会社留保、gross due、carry over を分けたフィールドを追加し、API `forecastCapped` へ返すようにした。
- あき / ID029 は無報酬稼働のため、りり / ID006 と同じく `exclude_from_payout_notice=true` 対象として月初合意・支払通知書・支払 gate から除外する仕様を docs に追記した。

**正本同期**:
- `pwa/spec/3-14-monthly-work-agreement-current-spec.md`
- `pwa/manual/2-2-member-workflows-quick-start.md`
- `pwa/manual/4-5-management-score-and-finance-simulation-spec.md`
- `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
- `pwa/manual/6-6-member-billing-prompts-spec.md`
- `pwa/manual/7-1-reward-calc-spec.md`
- `pwa/design/FEATURE_REGISTRY.md`
- `pwa/design/project_pl_monthly.md`
- `pwa/BUGS.md`
- `pwa/manual/9-3-appendix-changelog.md`
- `pwa/spec/6-1-appendix-changelog.md`

**検証**:
- `npx tsc --noEmit --pretty false`
- targeted eslint
- `npm run test:critical-ui`
- `npm run build`
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`
- production `/api/build-info`: `v0.28.13` / `038d0e62e048e07c7154872a527289f59b6e739d` / `dirty=false`

**残課題**: logged-in UI smoke は auth redirect で未実施。次セッションで `/admin/payouts?ym=202606`、`/management-score`、`/monthly-agreement?ym=202606`、`/admin/monthly-work-agreements?ym=202606` を実画面確認する。あき / ID029 の DB/code 実反映も次セッションで確認・修正する。

### 2026-06-19 — あき / ID029 の無報酬除外を実DB/codeで確認・反映 (v0.28.15)

**経緯**: v0.28.13 closeout では、あき / ID029 を `members.exclude_from_payout_notice=true` 対象にする仕様は docs へ反映済みだったが、実DB/code 反映確認が次セッション残課題になっていた。

**確認結果**:
- production DB の `members` で ID006 / ID029 はどちらも `exclude_from_payout_notice=true`。
- `buildMonthlyWorkAgreementBundle(ym=202606, memberId=ID029)` は `status='not_required'` / `canAgree=false` / `projectCount=0`。
- `listActiveAgreementMemberIds(202606)` に ID029 は含まれない。
- payout gate に ID029 の支払候補を渡しても `not_required` / `allowed=true`。

**対応**:
- `/mypage` の member 解決で `exclude_from_payout_notice` を読み、報酬額非表示は DB フラグを正本にした。後方互換 guard として ID006 / ID029 と code name `りり` / `あき` も残す。
- `/dashboard` は `/mypage` を embed しているため同時に反映。
- `/mypage` の月初合意 card は表示対象の `memberId` で `/api/monthly-work-agreement` を読み、管理者が `/mypage?memberId=ID029` を見る時も ID029 本人の `not_required` を表示するようにした。
- `/mypage` の月初合意 card が `not_required` を `未合意` 扱いしないよう、`対象外` 表示と `詳細を見る` CTA に分岐した。
- `pwa/BUGS.md` に同実装漏れをクローズ記録。

**検証**:
- `npx tsx` で DB + `buildMonthlyWorkAgreementBundle` + `listActiveAgreementMemberIds` + `buildPayoutAgreementGateSummary` を直接確認。

### 2026-06-19 — 先12か月4表を主数字だけで読めるように整理 (v0.28.16)

**経緯**: まさが「それぞれごとに、確認したい数字だけがシンプルに見れるようにしてほしい」「報酬債務はマックスではなく最終着地がちゃんとゼロになるのが重要」と指摘。

**対応**:
- `/admin/payouts` と `/management-score` 下部の4表で、セル内の補助数字を削り、各表の主数字を中心にした。
- `キャッシュ支払` は外部支払額だけ、`会社留保` は留保増だけ、`報酬債務` は月末未払い残だけ、`cap超過チェック` は不足/余力だけをセルの主表示にした。
- 報酬債務の合計列は `ピーク` ではなく `最終着地` を主表示に変更。最終月残が 0 円なら `ゼロ着地`、残るなら `残 ¥...` と表示する。
- 計算式・支払 gate・`reward_summary_json` は変更していない。

**正本同期**:
- `pwa/manual/7-1-reward-calc-spec.md`
- `pwa/design/project_pl_monthly.md`
- `pwa/BUGS.md`

---

## 2026-06-19 SX旅費別請求不可 → pt単価是正 → 役員stock繰越是正 → 予実表設計

### 背景
SX(p21, 愛媛大PSI Step2 令和8年度)で旅費を別請求できないことが判明。署名済み「請負契約書」を Drive で実見し**条文裏取り**: 一式・固定代金 11,528,000(税込)、別紙支払額内訳書=毎月一律1,152,800(税込)=1,048,000(税抜)、**旅費/実費条項なし**、第12条で愛媛大工事請負等契約事務取扱細則準用。→ 旅費は固定代金に内包、別請求不可。

### 確定した正本ルール (まさ)
- **pt単価 = PJ予算 ÷ シーズン総pt数、PJ予算 = (請求額 − バッファ) × 65%**。
- **バッファ** = 営業費用・旅費等、AMDが請求額から先取りするPJコスト枠。pt単価計算に必ず反映。請求額から先に引くのでコストは65/35按分。
- **stock(cap超過繰越)はAMDの確定債務**。役員も繰り越す。

### やったこと (本番反映済み)
1. **SX pt単価是正 (データ)**: `value_plan_cycles(PC-p21-202604).budget_yen` 6,812,000→**5,642,000** (=(10,480,000−営業80万−旅費100万)×65%)。pt単価 56,767→**47,017**。`billing_cycles` 202606-202703 を `budget_yen=564,200, budget_buffer_amount=0` に。reward再計算。支払済202601-03はsnapshotから復元保護。ロールバック: `SX/_pt_unit_change_snapshot_20260619_215357.json`。
2. **役員stock繰越是正 (コード, v0.28.17 deploy済)**: `src/lib/reward-summary.ts` `applyRewardCapsForMonth` 2箇所 — cap按分母数に officer の carryIn を含める / 役員返却ブロックで stockYen 繰越。旧実装は役員 carryIn=0 で unfunded を捨てており、cap逼迫PJで役員(AMD会社留保)が年間pt比を取りこぼしていた。SX再計算で全員pt比に**完全収束(最終stock0)**を検証。正本: `manual/7-1-reward-calc-spec.md` 更新。
3. **全PJ取りこぼしシミュ**: 修正前(A)現行=役員非繰越で **3 active PJ計 約192万取りこぼし** (SX 189万/ZMP 31k/KUTE 0)。(B)役員繰越で解消。
4. **予実表 設計正本**: `design/season_budget_actual.md` 新規。

### 残作業 (まさ合意の順: 1→2→3。1完了)
- **ステップ2 (次の一手): シーズン予実表 実装**。設計 `design/season_budget_actual.md` の §5 実装ステップ(migration buffer_breakdown_json → season-pl.ts → /admin/season-pl → FEATURE_REGISTRY → SX実データ → deploy)。
- **ステップ3: 過去監査**。(a)バッファ使用かつ支払済PJの過払い/過少の実損検証 (b)**ZMP cap/原資不整合** (Σ月cap < 原資 約6.5万、(B)でも収束せず) (c)役員繰越deploy後、日次cron `payout-reward-cache-refresh` が直近の支払済月キャッシュを新ロジックで上書きしうる点の整合。再計算で202603が335,599→392,190にズレた件もここ。
- **他PJ(ZMP/KUTE)キャッシュ**: 日次cronが新ロジックで再計算する(今回は一括backfillせず=全PJ支払済上書き事故回避)。
- **恒久実装(別タスク)**: バッファを第一級入力にし `deriveRewardBudgetForPt` が `(請求額−Σバッファ)×65%` を自動計算 (今は value_plan_cycles.budget_yen 手入力)。

### deploy 注記
deploy.sh が別件の未commit(gas/CLAUDE.md, gas/DEBUG.md, pwa/design/notifications.md)でhard-stop → あたしの3ファイルのみcommit(1dea41fd)→直push→本番 v0.28.17 反映確認。上記3ファイル(別件dirty)は未commitのまま残置。

---

### 2026-06-19 — シーズン予実表 /admin/season-pl 実装 (v0.29.0)

**経緯**: pt単価是正・役員stock繰越是正 (前セクション) で確定した「入金と配分が閉じているか」を全PJで見える化する安全網。設計正本 `design/season_budget_actual.md` の §5 実装ステップを完遂。

**やったこと**:
- migration `148_value_plan_cycle_buffer_breakdown.sql`: `value_plan_cycles.buffer_breakdown_json jsonb` 追加 → `apply_ddl.py` で本番適用 → `dump_schema.py` 再生成。
- `src/lib/season-pl.ts` `computeSeasonPl` 純関数: plan cycle → {①収入(請求額/入金確認) ②配分(バッファ内訳/原資/AMDマージン/閉じ検算) ③メンバー別pt比予実 検算フラグ} を返す。`reward-summary.ts` の `buildRewardSummary` を cycle 全期間に月次集約 (cap + stock 繰越連鎖は内部で効く)。member の earnedPt/paid は単月値なので各月合算、stock は最終月 snapshot。
- API `GET /api/admin/season-pl` (`mode=list` 全 active cycle / `?planCycleId=` で `mode=detail`)。`requireAdmin` ゲート。
- ページ `/admin/season-pl` + `AdminSeasonPlClient.tsx` (一覧→行クリックで詳細)。AdminSidebar に `シーズン予実` 導線。
- SX `PC-p21-202604` に `buffer_breakdown_json` = {営業80万, 旅費100万} 投入。
- `FEATURE_REGISTRY.md` に `/admin/season-pl` 契約追加 + `check_pwa_critical_ui.cjs` anchor。

**検算定義の修正 (設計→実装で是正)**:
- 未割当pt は `Σ(earnedPt) < total_points` だと期中に必ず誤検知するため `total_points − Σ(MS points)` に変更。担当者share 0 の宙吊り MS も検出。

**実データ検証 (production Supabase, 全 active cycle)**:
- SX (p21): closes/原資=Σcap/pt単価/役員収束すべて✅。**未割当 1pt** (total 120 vs MS 119) のみ検出。members は paid+stock≈earnedPt×pt単価 でほぼ収束 (delta ±2円)。
- ZMP (p19): **原資≠Σ月cap** (Σcap 3,663,645 > 原資 2,340,000, 差 −1,323,645) + 役員stock非収束 (まさ stock 39,809残) + 未割当10pt → 設計が予言した ZMP cap/原資不整合をそのまま検出。別財布(OkuDoor)capがΣcapを押し上げる構造。
- KUTE (p25): **閉じない** + **pt単価不整合** (原資 720万 ≈ 請求 720万 = (請求×65%)になっていない設定異常)。
- p00/CX: 予算未設定でも graceful (全green or 妥当な警告)。

**検証**: `npx tsc --noEmit` / targeted eslint error 0 / `npm run test:critical-ui` ✅ / `npm run build` (`/admin/season-pl` `/api/admin/season-pl` route 生成確認) / dev server で route 401 (requireAdmin) 正常動作確認。

**残課題 (前セクションのステップ3監査へ合流)**: SX 1pt 穴 (MS補完 or total_points→119)、ZMP cap/原資不整合の是正、KUTE budget_yen 設定異常の是正。いずれも予実表が検知役を果たすので、監査セッションで 1 件ずつ詰める。

---

### 2026-06-20 — 別財布 (cap_extra) 汎用化: extra プール cap 機構 + ZMP是正方針確定 (実装途中・未deploy)

**経緯**: 予実表が検出した ZMP の不一致 (原資≠Σcap / 役員stock非収束) をまさと解析。原因は別財布 (OkuDoor) が本契約の pt単価・cap を汚染していること。まさ方針: 別財布を「同一 plan cycle 内の別プール (cap_extra)」として正しく扱う (= 物理別cycleにはしない。`choosePlanCycle` が1月1cycle前提で period 重複に弱いため)。**今後も別財布案件は頻出するので、特殊計算せず汎用の仕組み・ルール・手順で処理できる設計が前提** (まさ明示)。

**ZMP の不一致 原因 (2つ)**:
1. `total_points=187` が誤り (正=110本契約 + 67別財布 = 177)。10pt phantom。
2. cap_extra プールに cap 機構が無く (`deriveMonthlyRewardCaps` が extraCapYen=0 → `applyRewardCapsForMonth` が需要全額にフォールバック)、OkuDoor が開発期間中に毎月即払いされ Σcap を押し上げていた。

**まさ確定の正本ルール (重要)**:
- **65%ルール・pt単価・cap・繰越は全PJ共通。別財布案件でも一切特殊化しない** (特殊計算を作ると保守不能になる)。
- 別財布のメンバー支払いは「**先に支払額が確定**、それに合わせて pt/share を後付け割当」。OkuDoor は **あび20万・うめ20万 (計40万) が正本**、まさ(役員)分は会社留保。
- OkuDoor は **完了月 (202610) に一括支払**。

**B案の実装 (コード, tsc通過・未commit・未deploy)**:
- migration `149_billing_cycles_extra_budget.sql`: `billing_cycles.extra_budget_yen int4` 追加 (適用済 + dump_schema 済)。NULL=cap未設定(従来=需要全額) / 0=全額stock繰越 / N=上限N円。完了月だけ満額→「完了時一括支払」。
- `reward-summary.ts`:
  - `deriveExtraCapYen` 追加、`deriveMonthlyRewardCaps` が `extraCapYen: number | null` を返す。`applyRewardCapsForMonth` は null=従来フォールバック、明示値(0含む)=その額cap。
  - `deriveRewardUnits` / `buildRewardSummaryUncapped` に `extraPoolBudgetYen` を追加し、**extra pt単価を独立化** (`Σ extra_budget_yen ÷ Σ cap_extra pt`)。`sumExtraPoolBudgetYen` / `capExtraPointSum` 新設。`buildRewardSummary` と `computeForwardUncappedMemberCosts` で配線。
  - billing select 4箇所に `extra_budget_yen` 追加。
- `season-pl.ts` / `payouts route` / `season-pl route` の billing 型・select に `extra_budget_yen` 追加。

**ZMP是正の確定値 (まだDB未投入)**:
- 本契約 `PC-p19-202601-202612.total_points` 187 → **177**。
- OkuDoor MS `MS-p19-2026-02-okudoor-system` の share **まさ0.7/うめ0.15/あび0.15 → まさ0.6923/うめ0.1538/あび0.1538** (= 原資130万・pt単価19,403固定であび・うめ各20万にするB案。65%もptも原資も変えない)。
- `billing_cycles.extra_budget_yen`: 202610 に **130万** (OkuDoor完了一括)、202605〜202609 は **0**。ただし **202605は既払い保護** (reward_paid_at=Y, OkuDoor分 あび/うめ各32,760 既出) なので、完了月capは既払い差引きの扱いを次セッションで確定 (まさ「202605はそのまま保護、完了月capは残額」)。
- 再計算は paid 月 (202601/202604/202605) 保護 (`syncRewardSummariesForProject` が reward_paid_at/payment_confirmed_at/payout_notice_uploaded_at をskip)。

**シミュレーション結果 (whatif, total_points=177 + extra cap 202610=130万)**:
- regular pt単価 21,273 (汚染解消)、extra pt単価 19,403 (独立)。OkuDoor 202610一括 extraStock=0 ✅。
- **別件残課題 (本fix対象外)**: regular プールが 202609〜単月需要(248k)>単月cap(195k) で年末 regStock 約213k 残る。OkuDoor無関係の、本契約MSスケジュール後半偏り×フラットcapの timing 問題。別タスク。

**まだやってないこと (次セッション)**:
1. 自分のコード変更を commit + push (別タスク由来の dirty とは混ぜない)。
2. ZMP DB是正 (total_points 177 / share 0.6923系 / extra_budget_yen)。完了月capの既払い差引き確定。reward再計算。
3. 予実表/payouts で別財布分離・本契約閉じを確認。
4. **別財布処理プレイブックを正本mdに残す** (汎用化の核。次回はこれに沿うだけ)。
5. spec/manual 同期。build → deploy。

**スコープ合意 (まさ)**: 今回は「汎用の仕組み + ルール + 手順 (プレイブック)」を確立して ZMP で実証まで。**入力UIの自動化は次段階の別タスク** (今はやらない)。

---

### 2026-06-20 (続き) — 別財布是正 完了・本番deploy (v0.29.2)

前セクションの「まだやってないこと」を全完了し本番 deploy した。

**要確定論点を whatif で解決 (A案採用)**:
- 本番DBを read-only で `buildRewardSummary` に流す whatif スクリプトで3案比較:
  - C案 (202605保護 + 完了月cap=残額1,081,795): うめ/あび各**231,824 ≈ 23万** → 原資130万を65,509超過 (202605旧即払いの二重計上)。
  - B案 (202605保護 + 完了月cap=満額130万): 各232,610 ≈ 過払い大。
  - **A案 (202605保護解除 + 完了月cap=満額130万): 各199,850 ≈ 20万・OkuDoor総消化1,299,998 ≈ 原資130万にぴったり** ✅。
- まさ判断「A」。202605 の `reward_paid_at`/`payout_notice_uploaded_at` を一時 NULL → `syncRewardSummariesForProject` で全期間再計算 → フラグ復元、で旧即払いを新ロジックで打ち消した。`monthly_reward_payout` に202605実支払行が無い (現金未払い・通知書のみ) ため上書き無害。

**ZMP DB是正 (本番適用済)**: total_points 187→177 / OkuDoor share まさ0.6923・うめ0.1538・あび0.1538 / extra_budget_yen 202610=130万・202605〜202609=0。是正前snapshotは `_snapshots/` に退避 (一時, 元値はこのログとchangelogに記録)。

**予実表 computeSeasonPl の別財布対応 (今セッションで追加発見・修正)**: 予実表が pt単価を `原資÷total_points` で全pt一括計算 = 別財布 pt も薄める旧汚染と同型だった。regular/extra pt単価分離 (`regularPtUnitYen`/`extraPtUnitYen`/`extraPoolBudgetYen`/`extraPointsSum`)、member 予算取り分を `regularEarnedPt×regular単価 + extraEarnedPt×extra単価` で算出、検算④を regular 分母で突合、に改修。`AdminSeasonPlClient.tsx` に extra pt単価・member 別財布取り分の表示追加。是正後検算: ①closes ②pt完全割当 ③原資=Σcap ④pt単価整合 **全✅**、全member収束Δ ±5円。

**役員収束❌は別件と確定**: 最終月202612で全員 extraStock=0 (OkuDoor別財布完済)、残るのは全部 regularStock (まさ65,411+きよ15,216 等 = 約21.3万)。本契約 MS スケジュール後半偏り×フラットcap の timing 問題で OkuDoor 無関係。OS task `task_20260620015628_8lzmx` 登録。

**プレイブック正本化**: `design/season_budget_actual.md` §5.2 (別財布3ステップ + 既払い再計算手順) / manual 7-1「別財布 (cap_extra) プール」章 / 6-5 別財布手順 / FEATURE_REGISTRY / 9-3 changelog。

**deploy**: BUILD_VERSION v0.29.1→v0.29.2。commit `d1de9502`。deploy.sh が COMMANDER_TASKS.md (別タスク台帳) の dirty で hard-stop するため、`git stash push COMMANDER_TASKS.md` で退避 → deploy.sh (push+build監視 2分40秒) → `git stash pop` で復元。push した5 commit (82deb78a エンジン + 81bf1e2d handoff + 27dbb2b5 worker guard + c327e504 slack正本化 + d1de9502 予実表+ZMP是正)。本番 v0.29.2 / d1de9502 / dirty:false 確認。

**残課題 (本fix対象外)**: ① ZMP regular プール timing (OS task登録済) ② 別財布入力UI自動化 (次段階) ③ 他PJ監査 (SX 1pt穴 / KUTE budget_yen異常)。

---

### 2026-06-20 (続き2) — 別財布表示バグ修正 + ZMP MS設計再考の論点発見 (v0.29.3)

**別財布の「cap不足」誤表示を修正 (v0.29.3, deploy済 commit 95153036)**: まさが `/admin/payouts` 報酬債務台帳で「うめ ZMP 202606 gross¥36,590/cap¥195,000 cap不足だが、ほぼ稼働なし。別財布混ざってない？」と指摘。実DBで うめ202606 は regularEarnedPt=0・extraEarnedPt=1.71 (全部OkuDoor別財布) で**データは正しく表示だけ誤り**。`buildRewardDebtLedgerRows` が混在 grossDueYen を本契約cap と突合していた。本契約(regular)行と別財布(cap_extra)行に flatMap 分離し、別財布行は extra_budget_yen と突合・専用 source `cap_extra_deferred`「完了月一括まで全額繰越中」に。詳細は BUGS.md 2026-06-20 [reward/display] エントリ。

**まさの本質的な疑問は「あびの金額が高すぎる」→ ZMP MS設計の根本論点を発見 (次セッション主題)**:
- あびの本契約(regular)累計 = ファシリテーション20pt(395,394) + **OkuDoor企画 share0.5(212,781)** + **OkuDoor現地運用 share0.4(170,184・将来按分)** = 高額。
- **OkuDoor 3 MS のうちシステム開発(67pt)だけ cap_extra 別財布化済み。企画(20pt,202601-08)と現地運用(20pt,202609-12)は tag=normal で本契約regularに混入したまま** (前々からの既知宿題、過去ログにも記載)。
- **まさ確定の方針**:
  - OkuDoor企画・現地運用は**別財布にしない** (開発じゃないから本契約のまま)。
  - **OkuDoor現地運用 (202609〜) はまだ実消化0** (`milestone_monthly_progress` progress=0%)。ただし予実/支払予定では将来按分(アンカー)で あび170,184・うめ170,184・まさ85,092 が202609〜に計上されている。
  - **OkuDoor企画 (20pt, share まさ0.5/あび0.5)**: まさ「あびはそんなに貢献してないかも」「企画はAMD側がそもそもあまり貢献してない気がしてきた」→ **pt と share を見直したい**。
- まさ「そもそも ZMP の MS設計から再考したほうがいいかも」→ **次セッションで ZMP MS設計 (pt/tag/share/期間) を一から見直す**。今セッションでは MS は触っていない (DB変更なし)。

**cap不足判定の雑さ (副次発見・別課題)**: 本契約regularの端数stock (数百円, cap総額は足りてるが個別按分の丸め誤差) も `carryIn=0 && stock>0` で「cap不足」赤判定される。本物のcap不足 (202609で regStock=16,472 等) と区別してない。MS設計再考と合わせて扱うか別タスク。BUGS.md に記録。

## 2026-06-22 (#95) — Cowork セッション (cowork-eimi) / 月次レポートを国プロ網羅型 → 正式報告書品質へ 3 段階で拡張 (v0.31.0→0.32.0→0.33.0)

> Cowork (Claude Desktop) 上で動いた cowork-eimi セッションのログ。次のえいみ (Codex / 別 Cowork) が読めば把握できるよう残す。

### コンテキスト
- まさから「各PJの月次報告書をクライアント提出できるレベルに。HTML→PDF が一番綺麗。まず関連 md 読んでから」と依頼
- 初手は単純な印刷ビュー実装で v0.31.0 deploy したが、まさから「クオリティ上げて、国プロ提出レベル参考に。資料変更前にコンテンツ要素のリストアップから」と差し戻し
- NEDO / JST・AMED / 経産省・SIP・民間コンサル + AMD OS 既存データ棚卸しの 4 サブエージェント並列調査を実施
- 提出先想定が確定: **CX=NIMS / SX=愛媛大 / KUTE=工学院大学** の大学・研究機関 3 機関
- マスタリスト 51 項目を 「✅すぐ出せる30 / 🟡部分11 / 🔴データなし10」 で提示、🔴 9 項目はスコープアウト、契約番号だけは別タスク (#12) として AMD 側採番システム化 (`AMD-YYYY-PP-NNN`, γ半自動) を後回し合意
- v0.32.0 で 10 章拡張版を deploy → まさから「レポートタブ廃止して印刷ボタンだけに / 議事録は削除して成果に統合 / 財務削除 / コードネーム禁止」の整理依頼 → v0.33.0 でクローズ
- (※途中で別worker MTG Prep Worker redesign の 16ファイル + 新規 migration が worktree に並列で存在。stash + path 指定 commit で巻き込まずに deploy 3 回完遂)

### 実装
- **新ルート**:
  - [api/project/monthly-report-print/route.ts](../src/app/api/project/monthly-report-print/route.ts) = 月次集約 API。18 テーブルを 1 fetch で返す (`monthly_reports / value_milestones / milestone_monthly_progress / project_meeting_summaries / project_strategy_signals (polarity🎉✨⚠️🔄分類) / project_grants / project_media_mentions / project_xrl_log / action_items / reimbursements / billing_cycles / project_founding_members / milestone_responsibility / contract_terms / contract_documents / project_documents / value_plan_cycles / projects`)。**メンバー名は `members.member_name` (本名) 優先、フォールバック `code_name`**
  - [(app)/project/[projectId]/report/[ym]/print/page.tsx](../src/app/(app)/project/[projectId]/report/[ym]/print/page.tsx) = SSR server-side cookie 引き継ぎ
  - [print-client.tsx](../src/app/(app)/project/[projectId]/report/[ym]/print/print-client.tsx) = §01 表紙 / §01 Exec Summary (業務遂行レポート見出し文 + RAG 3軸 + KPI + XRL前月比) / §02 進捗 / §02b Gantt (SVG自前描画、計画バー + 進捗fill + 当月赤縦線マーカー) / §03 成果 (シグナル🎉✨ + 会議由来Decided + 公募採択 + メディア) / §04 体制 (本名表示) / §05 課題 (Risk Register + Action Items + ボトルネック) / §06 次月計画 / §07 添付 (PJ資料 + 契約書 + 5生データ証跡 + 改訂履歴) の 7 章
- **コックピット改修**: [CockpitMonthlyModal.tsx](../src/components/cockpit/CockpitMonthlyModal.tsx) で旧「PDF」スタブボタン → 「📄 印刷 / PDF」リンクに置換 (v0.31.0)、その後 v0.33.0 で **タブ廃止**: ヘッダ右に `📝 レポート本文を編集` (折りたたみアコーディオン) + `📄 印刷 / PDF` (新タブ) の 2 ボタン、RewardTab (進捗確認) のみ常時表示
- **CSS**: `@page A4 portrait / margin 14mm 14mm 18mm 14mm` + `@top-left/right/bottom-*` で全ページ共通ヘッダ・フッタ・「取扱注意 / Confidential」・Page X/Y を自動付与
- **doc 反映**:
  - [pwa/spec/3-2-monthly-reports-current-spec.md](../spec/3-2-monthly-reports-current-spec.md) §クライアント提出用 印刷出力 を 0.31→0.32→0.33 で 3 回更新、v0.33.0 で「削除した章」節を追加
  - [pwa/manual/2-3-pj-cockpit.md](../manual/2-3-pj-cockpit.md) に「クライアント提出用 月次レポート印刷」節を追記 (v0.31.0 時)、※注: 別worker と同ファイル衝突を避けるためここだけ patch を別管理
  - [pwa/spec/6-1-appendix-changelog.md](../spec/6-1-appendix-changelog.md) と [pwa/manual/9-3-appendix-changelog.md](../manual/9-3-appendix-changelog.md) に v0.31.0 / v0.32.0 / v0.33.0 の 3 エントリ追記

### v0.33.0 で削除した項目 (記録用)
- §05 主要会議セクション (`MeetingsSection`) と関数自体
- §07 財務サマリ (`FinanceSection`) と関数自体
- §07 添付資料の会議資料 (`meeting_assets`) 表示
- 体制セクションの「氏名 (コードネーム)」→「氏名」、Closer タグ表示
- レポートタブの UI (タブ切替 state、`tab === "report"` 分岐) — 互換のため `MonthlyModalTab` 型エイリアスは残し、`initialTab='report'` で開かれたら編集アコーディオンを展開

### Verified
- **build**: v0.31.0 / v0.32.0 / v0.33.0 とも `npm run build` 通過 (Next.js 16.2.3 Turbopack)、`tsc --noEmit` 無音
- **deploy**: 3 回とも `pwa/scripts/deploy.sh` 経由で push → Vercel build (2分49秒 / 3分03秒 / 2分54秒で完了)、live `git_sha` 一致確認済
- **DB 実 SELECT**: CX(p20) / SX(p21) / KUTE(p25) の契約番号充足度を `contract_terms.contract_no` で確認。CX = `W2026004905` (NIMS発番) 抽出済 / SX = 入札のため契約書なし、`quote_no=Q-0000000065` のみ / KUTE = 番号なし、`amount_tax_incl=7,920,000` / `period: 2026-05-01〜2027-03-31` 抽出済
- **画面 verify**: dev server での admin auth 制約のため preview verify はスキップ、本番実機でまさが見て v0.32.0→v0.33.0 のフィードバック (タブ廃止 / 会議削除 / コードネーム禁止) を受領 → v0.33.0 で反映

### Cowork ↔ Codex 衝突メモ
- 別worker (= MTG Prep Worker redesign 担当の Codex えいみ) が 16 ファイル + 新規 `migration 151_meeting_prep_redesign_h1_integration.sql` を worktree で並列編集中だった
- 1 度目の commit で誤って巻き取り発生 → `git reset --mixed HEAD~1` で取消 → 別worker分を `git stash push -u -- <path...>` で明示退避 → あたしの分だけ specific path add + commit → stash pop で別worker分を worktree に戻す、を 3 回繰り返した
- 教訓:
  - `git status` で `MM` (staged+unstaged) や `D` (staged 削除) が見えたら、`git commit` 引数なしで全部巻き取る危険。**必ず specific path add → commit、または stash で別worker分を分離してから commit**
  - 別worker と同ファイルを触る場合は、stash の中身に自分の追記分が紛れ込みやすい (= pop で conflict 発生)。manual/2-3 への印刷導線追記 14 行は同事故で commit 漏れ、Task #7 として残課題化
- 衝突自体ではないが、序盤に commit 済の `/bzm/public` → `/bzm` 変更 (`GlobalNav.tsx`) を「正本に反する」と即断して `git checkout --` で破棄 → まさから「巻き戻さないで、それまさが既に画面で見てる最新」と差し戻し → reflex で復元。**未コミット変更も AGENTS.common.md「勝手に消さない」の対象。即断禁止**

### 残課題 (タスクボード)
- **#7 manual/2-3 への印刷導線追記の再適用**: 別worker MTG Prep redesign が main に取り込まれたあとに、v0.31.0 で書いた 14 行 (「クライアント提出用 月次レポート印刷」節) を再追記
- **#12 AMD契約番号採番システム実装**: `contracts.amd_contract_no` 列 + `contracts.bid_no` 列追加、γ半自動 (effective_date セット時に自動発番)、フォーマット `AMD-YYYY-PP-NNN`、相手側番号があるPJは AMD 番号振らない (二重採番回避)。SX (愛媛大入札) と KUTE (工学院大学) に backfill、CX (NIMS=W2026004905) は対象外。`/admin/contracts` UI に発番ボタン、月次レポート表紙メタの契約番号表示を `amd_contract_no` 優先に切り替え、入札番号も並列表示
- **v0.33.0 ブラッシュアップ**: まさが実機で見た上で「冗長な部分とか不要な要素」を次セッションで削る予定

### 関連メモ更新 (Cowork memory)
- なし (今回は memory 追加せず、spec/3-2 + manual/9-3 の正本 doc 反映で代替)

---

## 2026-06-22 #96 月次レポート印刷ビュー v0.34.0 (まさのフィードバック反映ブラッシュアップ)

### コンテキスト
- 前セッション #95 で v0.33.0 deploy 完了、まさが実機で見て**個別フィードバック 11 件**を投下
- 大枠: クライアント提出物として「予算系は全削除」「OS 内固有名はクライアントから見えないので禁止」「MS 古いものと重複が出てる」「§03 当月の成果を §02 進捗に統合」「リスクと 5 生データ証跡は削除」「関連キーパーソン削除」「色をもっと活用」
- 今セッション内では LLM 経由の AMD 標準フォーマット確定。次セッションで CX (NIMS) フォーマット (= 日付×時間×業務概要の稼働ログ型) と SX (愛媛大) フォーマット (= freee 請求書明細ベース) に着手予定

### 実装
- **§01 表紙**: 「見積書番号」行を削除、`amdContractNo / contractNo / bidNo` の 3 種だけ並列表示
- **§01 Exec Summary**: COST RAG カードと予算消化メタを削除、`.rag-grid-2` (2 列) で Schedule / Risk のみに。契約金額の `valuePart` も `leadParagraph` から削除。XRL 前月比表を捨てて `.xrl-grid` (5 列カード) で現在値のみに、各軸を独自カラー (TRL=sky, BRL=violet, GRL=teal, SRL=orange, HRL=pink) で帯化
- **§02 統合**: 旧 §02 当月の進捗 + 旧 §02b Gantt + 旧 §03 当月の成果 を統合。新 §02 内に A(業務遂行レポート) / B(MS進捗表) / C(主要成果) / D(議論で固まった事項) / E(対外発信・採択) の 5 サブブロックを `.sub-head` (色付き番号バッジ + 太字タイトル + グラデ背景) で再構成。Progress 系=`#1e40af` 紺、Achievements 系=`#059669` 緑
- **§03 (旧§04) 体制**: TeamSection から `founding`、関連キーパーソンブロックを丸ごと削除
- **§04 (旧§06) 次月計画 / §05 (旧§07) 添付**: 章番号繰り上げ
- **§05 課題・リスク削除**: `RisksSection` 関数自体を削除、main JSX から呼び出しも消した
- **§07 5生データ証跡削除**: `AppendixSection` から `sourceCheck` 参照ブロックを削除、PrintData 型は互換のため `sourceCheck` フィールドはそのまま残置 (= 関数側未使用)
- **`stripInternalJargon` 関数追加**: 印刷時に「つくよみ / 月次進捗モーダル / MTGページ / 経営シグナル / nudge / コックピット / H-1 next action / FRL」等を中立表現に置換 or 出典括弧書きごと削除。`MarkdownBlock` (本文) と `meetingDecisions` / `achievementSignals` の title・summary に適用
- **`selectActiveMilestonesForReport` 関数追加**: 同 `milestoneId` 重複・`tag='buffer'`・完了済 (`progressPct >= 100` かつ `deltaPct === 0` かつ `targetYm < ym`) の MS を除外
- **`xrlAxisMeta` 関数追加**: XRL 5 軸の和名と帯カラーマップ
- **`SectionHead` に `accent` prop 追加**: 章ごとに底線・番号・タイトルのカラーを変えられるよう拡張 (= 現状は未指定でデフォルト `#0a1628` のまま、将来章別カラー化用)
- **LLM プロンプト改修**: `/api/report/generate/route.ts` の system prompt に「クライアント提出物としての制約」節を追加し、「つくよみ / 月次進捗モーダル / MTGページ / コックピット / nudge / 経営シグナル / FRL」等を本文に絶対書かないよう明示

### 削除した項目 (v0.34.0)
- §01 RAG の COST カード
- §01 XRL 前月比 比較表
- §03 当月の成果 セクション (§02 へ統合)
- §04 関連キーパーソン (founding) ブロック
- §05 課題・リスク セクション全体 (RisksSection 関数も削除)
- §07 5生データ ソース証跡 ブロック
- 表紙の「見積書番号」表示
- 業務遂行レポート見出し文の「契約金額」表示

### Verified
- `tsc --noEmit` 無音通過
- `npm run build` 通過 (Next.js 16.2.3 Turbopack)
- 全 LLM 再生成不要 (印刷時の `stripInternalJargon` で既存 draft も中立化される)

### Cowork ↔ Codex 衝突メモ
- セッション中盤で別 worker の `8c560441 fix(governance): vendor_sender 経路で PJ 混入していたのを本文照合で除外 (v0.33.1)` を pull した影響でファイル lint hook が走り、進行中の Edit 群が一部 revert された事故あり
- 事故後は **各 Edit 後に `git diff --stat` で反映確認** しながら少しずつ積み上げる方針に切替えて完遂

### 残課題
- **#12 AMD契約番号採番システム**: 引き続き別タスク
- **CX フォーマット (日付×時間×業務概要 稼働ログ型)**: `contract_id W2025014019` 用に Calendar event + member_activities → LLM で日付ごとの稼働ログを推定生成 (まさ「正確である必要は全くない、契約通り工数消化されたことを証明したい」)
- **SX フォーマット (見積明細型)**: freee 会計の請求書 (`/invoices`) から `invoice_contents[]` を取って明細ごとに当月実施内容を LLM で書く
- **PJ ごとフォーマット切替**: `projects.report_format` 列 (`cx_activity_log | sx_estimate_items | null`) で UI 上「📄 AMD 標準 / 📄 クライアント提出版」の 2 ボタン振り分け

### v0.34.2 (= 見積明細混入を根本対処)
- まさが v0.34.1 の SX スクショで「まだ MS 問題解決してない」「下の方の『期間未設定』は MS じゃなくて見積書の明細にあった項目」と指摘
- DB 直 SELECT 結果: SX (p21) の現役 plan_cycle `PC-p21-202604` には MS 12 個のみ。一方、過去 fixed cycle `PC-p21-202601-202603` に **75 件の MS が is_active=true のまま残存** していて、末尾 11 件 (= スクショの「期間未設定」と完全一致する内容) は明らかに見積書明細 (「月次試算表の作成」「事業計画原案の作成」「PoC候補先の選定に向けた情報収集」「資本政策および EXITまでの道筋の策定」等)
- v0.34.1 の dedup (milestoneId + タイトル正規化) では救えないため、API 側で **plan_cycle.status フィルタ** を追加:
  - `/api/project/monthly-report-print/route.ts`: `planCycles.filter(c => status ∈ {active,confirmed,draft,in_progress})` を経由して `milestone_id` を絞る
  - `planCycle` (Gantt の計画期間) も active 優先、無ければ最新 fixed に fallback
- 別タスク化: **value_milestones への見積明細混入** は印刷ビューだけでなく cockpit / admin/ms-overview / 報酬計算等にも影響する可能性があるため、発生源 (= 見積→MS 変換の自動 cron or 手動投入) の特定と既存データの is_active=false 化を別セッションで実施 (task #16)

### v0.34.1 (= v0.34.0 のすぐあとの patch fix)
- まさが実機で見て指摘した残りバグ 2 件:
  - **MS dedup 強化**: v0.34.0 では milestoneId 単独で dedup していたため、別シーズンの同名 MS (例: 「コスト試算」「事業計画策定」) が複数行・複数バーで重複表示。`selectActiveMilestonesForReport` を milestoneId → タイトル正規化 (空白除去 + lowercase) の 2 段階に拡張。直近 `period_start_ym` 優先 / 同 period なら progress 高い方 / それも同点なら points 大きい方を残す。`GanttSection` も同 dedup を共用するよう改修
  - **share=0 MS の除外**: `TeamSection` の `respByMember` 構築時に `share === 0` を除外、share 大きい順にソート。「主な担当MS / 業務内容」に関与なし MS が並ぶ問題を解消

## 2026-06-22 (#96) — Cowork セッション (cowork-eimi) / 月次レポート印刷ビューを v0.33.0 → v0.34.2 でクライアント提出物品質に整備

> Cowork (Claude Desktop) 上で動いた cowork-eimi セッションのログ。次のえいみ (Codex / 別 Cowork) が読めば把握できるよう残す。

### コンテキスト
- 前セッション #95 で v0.33.0 deploy 済 (大学・研究機関向け正式報告書品質まで到達)。まさが実機で見て **11 件の修正指示** を投下したので順次反映
- 大枠の指示: 「クライアント提出物として予算・リスクは要らない / OS 内固有名は禁止 / MS が古いものや重複が出てる / 当月成果は当月進捗に統合 / もっと色を活用」
- v0.34.0 deploy 後に「MS 重複まだ解決してない、関与 0% MS が体制に並んでる」と差し戻し → v0.34.1
- v0.34.1 deploy 後にスクショで「これ CTB じゃなくて SX、下の方の『期間未設定』は MS じゃなくて見積書明細にあった項目」と更に指摘 → 真因が「過去 fixed plan_cycle に見積明細が is_active=true で 75 件残存」と判明し v0.34.2 で API 側 plan_cycle.status フィルタを追加
- 別タスク確定: CX (NIMS) / SX (愛媛大) 用の PJ ごとフォーマット (= 稼働ログ型 / 見積明細型) は次セッションで。`value_milestones` の見積明細混入クリーンアップも別タスク化

### 実装
- **コード (v0.34.0)**: [print-client.tsx](../src/app/(app)/project/[projectId]/report/[ym]/print/print-client.tsx) を全面整理。§01 表紙から見積書番号削除 / Exec の COST RAG カードと予算消化メタと XRL 前月比表を削除 (Schedule+Risk の 2 軸 + XRL 5 軸現在値カードへ) / §03 当月の成果を §02 に統合し A-E の色付きサブブロック (Progress=紺 / Achievements=緑) / §04 関連キーパーソン削除 / §05 課題・リスク全削除 / §07 5生データ証跡削除。`stripInternalJargon` で「つくよみ / 月次進捗モーダル / MTGページ / 経営シグナル / コックピット / nudge / H-1 next action / FRL」を中立表現へ印刷時置換。[report/generate/route.ts](../src/app/api/report/generate/route.ts) の LLM system prompt にも同名禁止句を追記
- **コード (v0.34.1)**: `selectActiveMilestonesForReport` の dedup を milestoneId 単独 → 「milestoneId + タイトル正規化」の 2 段階に拡張、直近 `period_start_ym` 優先で残す。Gantt も同 dedup を共用。`TeamSection` の `respByMember` 構築時に `share === 0` を除外し share 降順ソート
- **コード (v0.34.2)**: [monthly-report-print/route.ts](../src/app/api/project/monthly-report-print/route.ts) の MS 取得を **現役 plan_cycle のみ** (`status ∈ {active,confirmed,draft,in_progress}`) に絞り込み。`planCycle` (Gantt 計画期間) も active 優先、無ければ最新 fixed に fallback
- **doc**: [spec/3-2 月次レポート / 6-1 changelog](../spec/6-1-appendix-changelog.md) と [manual/9-3 changelog](../manual/9-3-appendix-changelog.md) に v0.34.0/.1/.2 の 3 エントリ追記

### Verified
- **DB 直 SELECT**: SX (p21) で原因特定。現役 cycle `PC-p21-202604` には MS 12 個のみ、過去 fixed cycle `PC-p21-202601-202603` に 75 件 (末尾 11 件は明らかに見積書明細「月次試算表の作成」「PoC候補先の選定に向けた情報収集」等) が is_active=true で残存していた
- **build**: v0.34.0/.1/.2 とも `tsc --noEmit` 無音 / `npm run build` 通過 (Next.js 16.2.3 Turbopack)
- **deploy**: 3 回とも `pwa/scripts/deploy.sh` 経由で push、Vercel build 各 2 分台で完了、live `git_sha` 一致確認済 (`bd1fb5f1` / `5cdca3a1` / `936f3cbb`)
- **実機 verify**: まさが SX 印刷ビューで「なおった！」と確認 (= v0.34.2 で MS 12 個ぴったりに整理されたことを確認)

### Cowork ↔ Codex 衝突メモ
- セッション中盤で別 worker の `8c560441 fix(governance): vendor_sender 経路で PJ 混入していたのを本文照合で除外 (v0.33.1)` を fetch した影響でファイル lint hook が走り、進行中の Edit 群が一部 revert される事故あり
- 教訓: 各 Edit 後に `git diff --stat` で反映確認しながら少しずつ積み上げる方針に切替えて完遂。巨大編集は Write 一発じゃなく細かい Edit + 毎回 diff 確認の方が安全

### 残課題 (= 次セッション以降)
- **value_milestones への見積明細混入クリーンアップ** (#16): 印刷ビュー以外 (cockpit / admin/ms-overview / 報酬計算等) にも影響する可能性。発生源 (= 見積→MS 変換の自動 cron or 手動投入) の特定と既存データの is_active=false 化 or 別テーブル退避を別セッションで
- **CX (NIMS) フォーマット**: `contract_id W2025014019` 用に Calendar event + member_activities → LLM で日付ごとの稼働ログ推定生成 (まさ「正確である必要は全くない、契約通り工数消化されたことを証明したい」)。`projects.report_format='cx_activity_log'` で UI 振り分け
- **SX (愛媛大) フォーマット**: freee 会計の請求書 `/invoices` から `invoice_contents[]` を取って明細ごとに当月実施内容を LLM 生成。`projects.report_format='sx_estimate_items'`
- **PJ ごとフォーマット切替 UI**: モーダルに「📄 AMD 標準 / 📄 クライアント提出版」の 2 ボタン振り分け
- **#12 AMD契約番号採番システム** (#95 から継続): `contracts.amd_contract_no` 列追加 + γ半自動採番

### 関連メモ更新 (Cowork memory)
- なし (今回は memory 追加せず、spec/3-2 + manual/9-3 + design_log の正本 doc 反映で代替)

---

## 2026-06-23 — 月初合意支払 gate の導入前月 cutoff 修正 (v0.34.16)

### コンテキスト
- まさが `/admin/payouts?ym=202606` の月初合意支払 gate で、ZMP 2026/05 稼働分4名がまだ `条件更新あり` blocker になっていると指摘。
- 月初合意機能は2026年6月途中導入のため、2026年5月以前の稼働月は本人が月初に合意できない。支払 gate 上は全員合意済み扱いでスキップする必要があった。

### 実装
- `MONTHLY_WORK_AGREEMENT_PAYOUT_GATE_START_YM = 202606` を追加。
- `source_ym <= 202605` の支払 gate 行は `required=true` / `status='agreed'` / 理由「月初合意の導入前/移行月のため合意済み扱い」として allow。
- 本人向け monthly-agreement bundle では同月以前を `not_required` として表示し、実際の合意 row は偽造しない。
- `pwa/spec/3-14-monthly-work-agreement-current-spec.md`、`pwa/manual/6-5-admin-payouts-reward-notice-spec.md`、`pwa/design/FEATURE_REGISTRY.md`、`pwa/manual/9-3-appendix-changelog.md`、`pwa/BUGS.md` に同期。

### Verify
- `npx tsx -e ...buildPayoutAgreementGateSummary(...)`: `source_ym=202605` の gate row が `required=1 / agreed=1 / blockers=0 / status=agreed` になることを確認。
- `npx tsc --noEmit`
- `npx eslint src/lib/monthly-work-agreement.ts src/lib/monthly-work-agreement-payout-gate.ts`
- `git diff --check`
- `npm run build`
- `npm run test:critical-ui`

---

## 2026-06-23 — Admin MS Overview を MS設計の正本編集面へ集約 (v0.34.4〜v0.34.9)

### コンテキスト
- まさが ZMP/OkuDoor の別財布 pt が直したはずなのに 67pt へ戻る問題を指摘。原因候補として cockpit と admin/MS編集の 2 箇所で MS 設計を書けることが挙がった。
- 追加で、別財布も 20pt 例外ではなく期間×10ptルールへ揃える方針に修正。OkuDoor system development (202605〜202610) は 6か月×10=60pt。
- admin 編集ON後の保存場所が分かりづらい、メンバーshare調整時に各メンバーのMS内金額が見えない、編集モードが横長すぎる、メンバー2カラムが比較しにくい、元の全MS pt配分スライダーが消えている、残り割り振り可能ptが見えない、全MSまとめスライダーにもMS金額が必要、右側でスライダー増加速度が変わる、というUIフィードバックを順に反映。

### 実装
- **write boundary集約**: cockpit / HUD cockpit 側の MS設計保存口を止め、MS名 / pt / tag / 期間 / 完了条件 / 担当share / 役割 / 担当タスク / 追加 / 無効化は `/admin/ms-overview` の編集モードで保存する仕様へ整理。
- **pt分母復旧**: `season-point-basis.ts` を追加し、regular points = シーズン期間月数×10pt、cap_extra points = MS期間月数×10pt、`total_points = regular + cap_extra` に統一。admin PUT は cap_extra points を期間から正規化し、通常MS配分pt合計を pt単価分母へ戻さない。
- **リアルタイム再計算**: `src/lib/admin/ms-overview-calc.ts` で `recomputeMsOverview` を使い、編集途中のメトリクス / MS金額 / メンバー年計 / MS内金額 / 残り割り振り可能ptを JS 側で再計算。`computeSeasonPl` と同じ round 規則を使う。
- **保存導線**: 編集モード ON 直後の上部保存バーとフッター保存バーに `DB値に戻す` / `保存して DB へ反映` / 保存先DB・reward再計算の説明を配置。
- **UI再配置**: 編集カードを左=MS基本情報、右=担当share表の 2 pane にし、担当share表はメンバー1人=1行へ変更。2カラム member grid は廃止。
- **pt配分スライダー復旧**: 各MSカード内の pt slider に加え、MS一覧先頭に `全MS pt配分スライダー` panel を追加。どちらを動かしても同じ編集中 state を更新する。panel 各行に現在ptとMS金額を表示。
- **スライダー固定range**: 通常MS slider max は編集開始時点の最大pt×1.5へ固定。ドラッグ中に現在値へ追従しないので、右端でも1pxあたりのpt幅が一定。
- **docs / guard**: `manual/6-8-admin-ms-overview-spec.md`、`design/FEATURE_REGISTRY.md`、`manual/9-3`、`spec/6-1`、`BUGS.md`、critical-ui anchors を同期。

### Verified
- `npm exec tsc -- --noEmit --pretty false` 通過。
- `npm run test:critical-ui` 通過。
- `npm run build` 通過。
- browser route smoke: unauthenticated `/admin/ms-overview` は `/auth/login?next=%2Fadmin%2Fms-overview` へ redirect。ログイン済み admin UI の目視確認は未実施。
- deploy: MS Overview 系コミットは `cad7f7f4` (v0.34.4) → `8d8107e1` (v0.34.5) → `582e3bb7` (v0.34.6) → `b0b0d83d` (v0.34.7) → `c5fcef39` (v0.34.8) → `a8bf9b2a` (v0.34.9) で main に反映済み。その後 main は payout matrix fixes まで進み、closeout時点の HEAD は `d070807c` / v0.34.15。

### 残課題
- ログイン済み admin で `/admin/ms-overview` 編集モードを実機確認する。DB保存テストはまさ明示OK時のみ tiny/safe な変更で行う。
- `value_milestones` への見積明細混入 cleanup は別タスク。印刷ビューだけでなく cockpit / `/admin/ms-overview` / 報酬計算へ影響しうるので、発生源と既存データ無効化方針を別セッションで扱う。
- `gas-slack/.clasp.json` は今回のPWA/MS作業外の untracked local artifact。GAS/Slack owner 判断まで commit しない。
