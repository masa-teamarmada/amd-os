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
- critical-ui guard で丸数字(①②) banに1回ひっかかり → (N)へ置換して通過 (台帳md由来)。

### 残課題 (次セッション)
- 概念図系図版 (二層アーキテクチャ / 進化系譜 / 三因子概念図など) — matplotlib か外部画像生成かまさ判断待ち。各章本文に「> 図版 TODO」プレースホルダ多数。
- 通し編集 (序章→巻末の cold-reader、章間重複・接続・用語ゆれ)。
- 巻末資料の再構築 (参考文献・記号・用語、料率の出典確定)。
- D-7 Textbook Insights の新教科書向け受け皿章の再設計 (現状 legacy fallback)。
- 出版パッケージ (タイトル確定・組版・出典固め)。
