# HANDOFF - AMD OS PWA

- Last updated: 2026-06-18 (Contract Apply を active PJ 全件カバレッジで監査確定 / ZMP・SE 監査誤記の訂正 / v0.27.2→v0.27.5)
- Topic: 「active PJ すべてに Contract Apply が行き渡っているか」を `projects.status='active'` の SQL 全件 (11 件) を母集団に監査し、**apply すべき残契約は無い**ことを全件根拠つきで確定。あわせて前セッションの監査誤記 (ZMP ¥300,000 を「単発/契約書根拠なし→保留」と誤断 / SE end_ym を「まさ確認待ち」と誤記) を訂正。母集団を「契約保有候補」のサブセットに絞って p07/p24/p26 を取りこぼしていた監査不備も是正。
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `main`
- Production: 本セッション最終 deploy = **v0.27.5** (`build-info.ts` / git_sha `a9591334`)。直前 = v0.27.4 (`1c7c544b`) / v0.27.3 (`ac6f9bc3`)。次セッションは必ず `git fetch` で並行セッションの push を取り込む。

## 直近セッション (2026-06-18 後半 — Contract Apply active 全件カバレッジ監査 + 誤記訂正, v0.27.3〜v0.27.5)

正本は [`pwa/spec/5-6-contracts-management-current-spec.md`](spec/5-6-contracts-management-current-spec.md) §「active PJ 全件 Contract Apply カバレッジ監査」。要点:

- **active PJ 全 11 件の apply 状態を 1 表に確定** (母集団は `SELECT project_id FROM projects WHERE status='active'` で機械確定):
  - **フル apply 済**: p20 CX (variable, term×1 + billing×4) / p21 SX (monthly_fixed ¥1,048,000) / p25 KUTE (monthly_fixed ¥654,545, 役員のみ payout ¥0)。
  - **DB 反映済・触らない**: p06 CTB (variable, end_ym=202702 のみ) / p10 SE (monthly_fixed ¥100,000, end_ym=null=満了未定が最終) / p19 ZMP (monthly_fixed ¥300,000 本契約 + 別財布 extra_revenue_json で OkuDoor 開発 ¥2,000,000 を 202605〜202610 一定按分。**2 契約構造は過去セッションで抽出済**)。
  - **⏸ 対象外 (請求実体ゼロ)**: p07 LST / p24 CLG / p26 VasculaX。fee 全 null・billing_cycles 0・実契約 PDF なし。end_ym=null でも計上対象月が無いので無期限リスクなし。契約締結→請求開始の時点で apply する。
  - **結論: active PJ で apply すべき契約が残っている PJ は無い。**
- **誤記訂正 (v0.27.4)**: 前セッションが p19 ZMP の ¥300,000 を「単発/契約書根拠なし→apply 保留」、p10 SE を「満了月まさ確認待ち」と誤記していたのを訂正。原因 = **過去のえいみが既に抽出して DB 反映済みの 2 契約構造を、コード/source_cache 探索で再発見しようとした** (memory `feedback_read_spec_before_exploring_code` の典型失敗、再発実例を追記済)。
- **カバレッジ是正 (v0.27.5)**: 監査セクションを「契約保有候補 PJ 監査」→「active PJ 全件カバレッジ監査」に作り直し。当初 p07/p24/p26 を母集団から取りこぼしていた不備を是正し、以降は SQL で母集団を機械確定する方式に固定。
- **検証**: 全件 SQL (`projects` / `billing_cycles` / `contracts` / `contract_terms` / `project_members` / `source_cache`) で apply 状態・請求実体・契約有無を確認。本番 DB 書き込みはなし (= doc 確定のみ)。tsc/build green、deploy 済。

## 前セッション (2026-06-18 前半 — Contract Apply pipeline + つくよみ月次自動確定 cron, v0.27.0/v0.27.1)

詳細は [`pwa/design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md) 2026-06-18 セクション。要点:

- **Phase A (pipeline, v0.27.0 = `373724b5`)**: ① Contract Apply writer (`src/lib/contracts-apply.ts`, REWARD_RATE=0.65, `deriveContractApplyPlan`/`applyContractTerms`) + API route (`/api/contracts/apply`)。② つくよみ月次自動確定 lib (`src/lib/contract-billing-auto.ts`) + cron route (`/api/cron/contract-billing-auto-confirm`) + `vercel.json` cron `"0 22 1 * *"` (毎月1日 JST 07:00、actor=`つくよみ(契約自動確定)`)。
- **Phase B (KUTE p25 apply + 台帳化, v0.27.1 = `3e3e32d8`)**: KUTE は monthly_average → monthly_fixed 反映 (SX p21 と同型)。② に税抜月額 654,545 を立て、③ billing_cycles は触らない (monthly_fixed は ③ 不変)。KUTE は **役員のみ PJ** なので capped 支払予定 = ¥0 が正しい。spec 5-6 に適用済み PJ 台帳 (p20 CX / p21 SX / p25 KUTE) を追加。
- **検証**: API route は admin auth gate のため、KUTE apply は lib の monthly_fixed 分岐を SQL で忠実に再現して実行 (認証入力は禁止行為)。projects p25 = fee_type=`monthly_fixed`/fee_amount=654545/start_ym=202605/end_ym=202703/contract_terms_json 投入、billing_cycles 不変、billing_log audit 行あり、を SQL で確認。tsc/build green。

## Repo State

- HEAD = `a9591334` (v0.27.5)。未 push commit なし (`git log --branches --not --remotes` 空)。作業ツリー clean (`pwa/proposals/` のみ untracked = 別作業、触らない)。
- このセッションの変更は spec (5-6 / 6-1) + `build-info.ts` の 3 ファイルのみ。本番 DB 書き込みなし。
- ⚠️ 次セッション開始時は必ず `git fetch` → 並行セッションが頻繁に push。deploy.sh が origin 乖離で止まったら `git rebase origin/main`。

## Unresolved / 次セッションへの申し送り

1. **(✅ 完了 2026-06-18 後半 — task_48afedcf / task_20260616090543_vayt2 / task_20260614143623_mt5jd)** Contract Apply を **active PJ 全件カバレッジで監査確定**。フル apply 済 = p20 CX / p21 SX / p25 KUTE、DB 反映済 = p06 CTB / p10 SE / p19 ZMP、⏸ 対象外 (請求実体ゼロ) = p07 LST / p24 CLG / p26 VasculaX。**apply すべき残契約は無い**。詳細は spec 5-6 §active PJ 全件カバレッジ監査。**次に apply が要るのは p07/p24/p26 の契約締結→請求開始のタイミング** (= 新規 active PJ が請求を立て始めたら、spec 5-6 の母集団 SQL で再監査する)。
2. **(構造的穴・将来対応候補)** 役員除外 (`is_officer || exclude_from_payout_notice`) がコア `buildRewardSummary` に無く各画面で後付け (v0.25.4 教訓)。支払系 forward 投影を書くたび再実装が要る。コアへ寄せると安全。
3. **(別セッション継続)** ZMP 残課題: ① OkuDoor企画(20pt)・現地運用(20pt)MS が tag=normal で regular財布混入。② plan cycle total_points=187 に OkuDoor pt 含まれ ptUnit希釈。③ 他PJ別財布売上を順次 `extra_revenue_json` 投入。
4. **(保留・まさ承認待ち)** A案: `persistForecast: true` で将来月予測 uncapped 報酬を `billing_cycles.reward_summary_json` へ保存 (本番書き込みなので別途まさGO後)。
5. **(別セッション=チップ済 task_6027de9a)** coverage/gap scanner の設計 (脱・属人化)。
6. **(別セッション=チップ済 task_2eff788c)** AMD Scoreモデル改良v3.3 (コアモデル変更=設計先行・まさ承認必須)。
7. **(監視、過去継続)** 7月以降 p21 事業計画策定が未確定なら初の `ms_schedule_delay` 通知。`/notifications` "D-2 MS計画遅延" ラベル実地確認。
8. **(別ワークストリーム、過去継続)** payment PR #2 / ERS 根拠メモ「未確認」埋め (下記 pointer 参照)。

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git log --branches --not --remotes --oneline   # 未 push 検知
git status -sb
```

Contract Apply 全展開を続けるなら、まず正本 [`spec/5-6-contracts-management-current-spec.md`](spec/5-6-contracts-management-current-spec.md) (§Contract Apply / §月次請求額の自動確定 / 適用済み PJ 台帳) と [`design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md) 2026-06-18 の KUTE 手順を読む。**API route は admin auth gate でブラウザ実行不可** (認証入力は禁止行為)。lib の分岐 (schedule_based=③月別 budget_yen / monthly_fixed=②のみ) を SQL で忠実に再現して apply し、必ず billing_log audit 行・projects ②・billing_cycles ③ を SQL で検証する。**end_ym 必須**: Contract Apply は必ず end_ym を埋める (無期限計上事故の再発防止、つくよみ cron も end_ym 内の月だけ対象)。

## Pointers

- **契約管理 + Contract Apply + つくよみ月次自動確定 (今回の正本)**: [`pwa/spec/5-6-contracts-management-current-spec.md`](spec/5-6-contracts-management-current-spec.md) (§Contract Apply / §月次請求額の自動確定 / 適用済み PJ 台帳) / 使い方 [`pwa/manual/6-3-invoice-and-billing-routine-spec.md`](manual/6-3-invoice-and-billing-routine-spec.md) §つくよみ自動確定 + [`pwa/manual/6-7-contracts-management-spec.md`](manual/6-7-contracts-management-spec.md) / cron 正本 [`pwa/design/L2_DATA.md`](design/L2_DATA.md) レポート系 cron 表 / changelog `spec/6-1` + `manual/9-3` / セッションログ [`pwa/design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md) 2026-06-18。
- **Contract Apply 実装ファイル**: `pwa/src/lib/contracts-apply.ts` (writer, `deriveContractApplyPlan`/`applyContractTerms`, REWARD_RATE=0.65) / `pwa/src/app/api/contracts/apply/route.ts` (admin auth) / つくよみ自動確定 `pwa/src/lib/contract-billing-auto.ts` + `pwa/src/app/api/cron/contract-billing-auto-confirm/route.ts` / cron 登録 `pwa/vercel.json`。
- **報酬計算正本**: [`pwa/manual/7-1-reward-calc-spec.md`](manual/7-1-reward-calc-spec.md) (REWARD_RATE=0.65 / budget_yen=報酬cap / pt消化=期間按分 / 役員除外=落とす一択 L292)。
- **支払予定 capped 投影 (v0.25.4)**: `pwa/src/lib/reward-summary.ts` `computeForwardCappedMemberCosts` (役員除外込) / route `pwa/src/app/api/admin/payouts/route.ts`。原価=uncapped と支払予定=capped を取り違えない (spec/manual 7-1 が正本)。
- 中核データ正本: [`pwa/design/L2_DATA.md`](design/L2_DATA.md) / コックピット: `pwa/design/cockpit.md` / 重要UI登録簿: `pwa/design/FEATURE_REGISTRY.md`
- DB列: `billing_cycles.extra_revenue_json` (migration 142) / `billing_cycles.contract_source_term_id` (契約由来 budget_yen の出所) / `projects.contract_terms_json` / `contract_terms` (PK=`term_id`, review_status に `applied` 許容)。

### 別ワークストリーム (過去 handoff からの継続事項)

- payment PR #2 (`https://github.com/masa-teamarmada/amd-os/pull/2`): 古い base のため直 merge せず main-based で作り直す方針。詳細は `pwa/design_log/sessions_2026-05.md` #96 / `pwa/BUGS.md`。
- ERS 実データ本評価 / 制度比較マトリクス: `pwa/design_log/sessions_2026-05.md` #103〜#106。`/institutions/assess` 根拠メモの「未確認」項目 (香川大 軸5/6/7、工学院大 軸5/6/7、NIMS 軸3/5/6/7-d) が残課題。

## Deploy / Verification コマンド (今セッションで実行したもの)

```bash
# 本番反映 (push 方式、CLI deploy は廃止) — 本セッションは v0.27.1=3e3e32d8 で完了
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh

# DDL適用 (新規DDLがあれば)
python3 -X utf8 scripts/apply_ddl.py scripts/migrations/NNN_name.sql

# Contract Apply の検証 (admin auth gate でブラウザ不可 → SQL で end-to-end 確認)
#   Supabase MCP execute_sql (project nbnhrhybjslbawdukvvk):
#   projects (② fee_type/fee_amount/start_ym/end_ym/contract_terms_json) / billing_cycles (③) / billing_log (audit 行) を SQL で確認
```

⚠️ **検証の網羅性**: 契約由来の額を触ったら、つくよみ cron が拾う条件 (`end_ym` 内 + Contract Apply 済み) を満たすか必ず SQL で確認する。`end_ym=null` の PJ は cron 対象外 = 自動確定されないので、apply 時に必ず end_ym を埋める。
