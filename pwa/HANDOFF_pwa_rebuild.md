# HANDOFF - AMD OS PWA

- Last updated: 2026-06-18 (契約由来 月次請求額の Contract Apply pipeline + つくよみ月次自動確定 cron 実装 / KUTE(p25) apply / v0.27.0→v0.27.1)
- Topic: 「契約書を抽出できてるなら自動で金額を入れ、PM には確認 nudge だけ投げる」を **全 PJ 共通の billing 確定システム**として実装。設計判断①: `/admin/contracts` で `contract_terms` を `applied` にする操作が「人が契約金額を確認した」ポイント。以降の月次はつくよみ (月次 cron) が契約由来額を `budget_confirmed` まで自動で進め、PM には Slack DM で事後通知するだけ。
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `main`
- Production: 本セッション最終 deploy = **v0.27.1** (`build-info.ts` / git_sha `3e3e32d8`)。直前 = v0.27.0 (`373724b5`)。次セッションは必ず `git fetch` で並行セッションの push を取り込む。

## 直近セッション (2026-06-18 — Contract Apply pipeline + つくよみ月次自動確定 cron, v0.27.0/v0.27.1)

詳細は [`pwa/design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md) 2026-06-18 セクション。要点:

- **Phase A (pipeline, v0.27.0 = `373724b5`)**: ① Contract Apply writer (`src/lib/contracts-apply.ts`, REWARD_RATE=0.65, `deriveContractApplyPlan`/`applyContractTerms`) + API route (`/api/contracts/apply`)。② つくよみ月次自動確定 lib (`src/lib/contract-billing-auto.ts`) + cron route (`/api/cron/contract-billing-auto-confirm`) + `vercel.json` cron `"0 22 1 * *"` (毎月1日 JST 07:00、actor=`つくよみ(契約自動確定)`)。
- **Phase B (KUTE p25 apply + 台帳化, v0.27.1 = `3e3e32d8`)**: KUTE は monthly_average → monthly_fixed 反映 (SX p21 と同型)。② に税抜月額 654,545 を立て、③ billing_cycles は触らない (monthly_fixed は ③ 不変)。KUTE は **役員のみ PJ** なので capped 支払予定 = ¥0 が正しい。spec 5-6 に適用済み PJ 台帳 (p20 CX / p21 SX / p25 KUTE) を追加。
- **検証**: API route は admin auth gate のため、KUTE apply は lib の monthly_fixed 分岐を SQL で忠実に再現して実行 (認証入力は禁止行為)。projects p25 = fee_type=`monthly_fixed`/fee_amount=654545/start_ym=202605/end_ym=202703/contract_terms_json 投入、billing_cycles 不変、billing_log audit 行あり、を SQL で確認。tsc/build green。

## Repo State

- HEAD = `3e3e32d8` (v0.27.1)。未 push commit なし (`git log --branches --not --remotes` 空)。
- 作業ツリー: 本 handoff で `design_log/sessions_2026-06.md` + `design/L2_DATA.md` + `HANDOFF_pwa_rebuild.md` + `build-info.ts` を md として束ねて commit/push 予定。`pwa/proposals/` は別作業 = untracked のまま触らない。
- ⚠️ 次セッション開始時は必ず `git fetch` → 並行セッションが頻繁に push。deploy.sh が origin 乖離で止まったら `git rebase origin/main`。

## Unresolved / 次セッションへの申し送り

1. **(別セッション=起票済 task_48afedcf「Contract Apply を残り契約PJへ全展開」)** 今セッションで p20 CX / p21 SX / p25 KUTE は apply 済。残りの契約保有 PJ をこのタスクで全展開する。**最優先 = end_ym=null の無期限計上リスク PJ**: p06 CTB (variable) / p10 SE (¥100,000) / p19 ZMP (¥300,000)。次点 = 期間明示済みだが未 apply の p09 JC / p11 BWE / p22 OQC / p23 UST。billing_months=0 の PJ は対象外の可能性が高い (要確認)。**契約抽出 → Contract Apply まで通さないと、つくよみ cron の自動確定対象に入らない**。手順は spec 5-6 §Contract Apply / §月次請求額の自動確定 と KUTE 手順 (design_log 2026-06-18) を踏襲。
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
