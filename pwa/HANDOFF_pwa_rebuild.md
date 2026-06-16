# HANDOFF - AMD OS PWA

- Last updated: 2026-06-16 (月次収支シミュレータの OS ライブテーブル駆動化 / live builder 実装 + deploy)
- Topic: `/management-score` 月次収支シミュレータを凍結 snapshot から live テーブル直読みへ。次は予実表/グラフの5要望
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `main`
- Production: **v0.22.17 Ready 確認済み** (deploy.sh で git_sha 一致確認済)。その後別セッションが v0.23.0 を commit (HEAD=3178557d)。

## 直近セッション (2026-06-16 月次収支シミュレータ live builder)

#92 で起票した `task_2a17f76e` を実装・本番反映。`/management-score` の月次収支シミュレータを、凍結 snapshot (`company_budget_inputs` version=`gas-2026-05-18-baseline`、SX二重計上や実在しない「新規1/2/3」が残っていた化石) から **OS ライブテーブル直読み**へ切替。エンジン/パネルは無改修、入力ソースだけ live 化。

- **新ファイル** `pwa/src/lib/finance/live-monthly-pl-inputs.ts`: `buildLiveMonthlyPlInputs(supabase, options)`。固定収益=`projects.fee_type='monthly_fixed'`の`fee_amount` / 変動収益=`fee_type='variable'`PJの`billing_cycles`(reported優先、なければ`budget_yen÷0.65`) / 固定費=`company_finance_recurring_items`(active) / 将来メンバー原価=MS進捗を期間按分した **uncapped 報酬** (`computeForwardUncappedMemberCosts` in `reward-summary.ts`) を`projectRevenues[].internalMemberCost`に注入。`fallbackParams`(snapshotの繰越欠損・社保率・法人税前提)を`...`展開で流用。`persistForecast`フラグ=**今回 false(読み取り専用)**。
- **`page.tsx`**: `buildLiveGasSimulationResult(liveInputs, snapshotResult)` で live エンジンを server-side で回し snapshot 実績列をマージ、try/catch で snapshot fallback。
- **実データ検証→正本固定**: 516行制約(`pjRev===0`月は原価スキップ)が現行 active PJ 全件で無害 / `deriveRewardBudgetForPt`解決順 / 主要PJ uncapped月次原価(p19≈¥195k/p20≈¥50.7k/p21≈¥56.8k/p25≈¥654.5k)を `pwa/manual/4-5-*.md` に表で固定。

詳細: `pwa/design_log/sessions_2026-06.md` #93 エントリ。正本: `pwa/manual/4-5-management-score-and-finance-simulation-spec.md` / `pwa/manual/7-1-reward-calc-spec.md`。

## Repo State

- Production v0.22.17 (このセッションで deploy)。HEAD=3178557d で別セッションが v0.23.0 を commit 済み (`build-info.ts`=v0.23.0)。
- 作業ツリー: clean (origin/main と一致)。間違えて起動した background agent の `GasMonthlySimulationPanel.tsx` 中途編集は `git checkout` で破棄済み (新セッションがクリーンから着手すべきなので)。
- ⚠️ 次セッション開始時は必ず `git fetch` → 並行セッションが頻繁に push する。deploy.sh が origin 乖離で止まったら `git rebase origin/main`。

## Unresolved / 次セッションへの申し送り

1. **(別セッション=チップ済 task_caf24348)** `/management-score` 予実表/グラフの5要望 (= まさ 2026-06-16 依頼):
   - **#1 社保・法人税が予実表に出ていない** → エンジンにロジックはある(`socialIns` 425行 / `ctaxPayment`・`corpTaxPayment` 606行〜)。有力仮説=live builder の固定費が `costType:'taxable'` 固定(`live-monthly-pl-inputs.ts` 204行)で `executive`/`salary` 行が無く `socialInsBase=0`。`company_finance_recurring_items` の costType 実データ確認→実額で乗せる。
   - **#2 Slack等サブスク月額が古い** → Gmail レシート / freee から最新額抽出して更新 (本番データ書き換え=まさ提示後)。
   - **#3 予実表を全行表示** (`GasMonthlySimulationPanel.tsx` の `.table-wrap` max-height/overflow-y 除去)。
   - **#4 売上原価をトグルで内訳展開** (PJ別 `pjDetails[].internalMember/externalMember`)。
   - **#5 グラフに予算キャッシュ残高折れ線を追加**し予実比較。
   - DB書き換えなしの #3/#4/#5 から着手・deploy 推奨。
2. **(保留・まさ承認待ち)** A案: `persistForecast: true` で将来月の予測 uncapped 報酬を `billing_cycles.reward_summary_json` へ保存 (予実管理用)。本番データ書き込みなので別途まさ GO 後。
3. **(別セッション=チップ済 task_6027de9a)** coverage/gap scanner の設計 (脱・属人化)。
4. **(別セッション=チップ済 task_2eff788c)** AMD Scoreモデル改良v3.3。コアモデル変更=設計先行・まさ承認必須。
5. **(保留・まさ承認待ち、過去継続)** 残骸 `l2_routine` / `tsukuyomi_estimate` 行の DELETE 掃除 (実害なし)。
6. **(監視、過去継続)** 7月以降 p21 事業計画策定が未確定なら初の `ms_schedule_delay` 通知が出る。`/notifications` の "D-2 MS計画遅延" ラベル実地確認。
7. **(別ワークストリーム、過去継続)** payment PR #2 / ERS 根拠メモ「未確認」埋め。下記 pointer 参照。

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git log --branches --not --remotes --oneline   # 未 push 検知
git status -sb
```

この handoff の doc 更新 (design_log + HANDOFF) を commit & push してから、次の依頼に入る。

## Pointers

- **株主・ガバナンス+要対応 (今回)**: 設計 `pwa/design/governance_action_items.md` / 使い方 `pwa/manual/2-3-pj-cockpit.md` / migration `pwa/scripts/migrations/137_governance_and_action_items.sql` / 導線保護 `pwa/design/FEATURE_REGISTRY.md` / D-14抽出 `pwa/scheduled-tasks/amd-os-l2-consolidated-evidence/SKILL.md` Phase K-C。SU資本知識は `knowledge/jc.md`。
- 確定仕様 (spec): `pwa/spec/3-10-l2-ms-progress-current-spec.md` (D-2 MS進捗の全契約)
- 使い方 (manual): `pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md`
- 中核データ正本: `pwa/design/L2_DATA.md` / コックピット: `pwa/design/cockpit.md`
- バグ・教訓: `pwa/BUGS.md` (今回のセッションは新規バグなし)
- 過去セッションログ: `pwa/design_log/sessions_2026-06.md` (6/12 v3移行 / 6/13 アンカー方式)
- 実装ファイル: `pwa/src/lib/ms-schedule-shared.ts` (`anchoredExpectedCumPctForYm`) / `progress-estimator.ts` / `reward-summary.ts` / `src/app/api/cron/ms-schedule-progress/route.ts` / `src/app/api/progress/ms-schedule/route.ts`

### 別ワークストリーム (過去 handoff からの継続事項)

- payment PR #2 (`https://github.com/masa-teamarmada/amd-os/pull/2`): 古い base のため直 merge せず main-based で作り直す方針。詳細は `pwa/design_log/sessions_2026-05.md` #96 / `pwa/BUGS.md`。
- ERS 実データ本評価 / 制度比較マトリクス: `pwa/design_log/sessions_2026-05.md` #103〜#106。`/institutions/assess` 根拠メモの「未確認」項目 (香川大 軸5/6/7、工学院大 軸5/6/7、NIMS 軸3/5/6/7-d) が残課題。

## Deploy / Verification コマンド (今セッションで実行したもの)

```bash
# 本番反映 (push 方式、CLI deploy は廃止)
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh

# D-2 デフォルト按分 cron 手動実行 (CRON_SECRET は .env.local、チャットに出さない)
SECRET=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)
curl -s -H "Authorization: Bearer $SECRET" \
  "https://amd-os-pwa.vercel.app/api/cron/ms-schedule-progress?projectId=p21&ym=202606"
```
