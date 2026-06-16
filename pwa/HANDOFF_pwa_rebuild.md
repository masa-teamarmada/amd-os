# HANDOFF - AMD OS PWA

- Last updated: 2026-06-16 (#2サブスク額 freee 棚卸し / CX無期限売上事故修正 / 契約Apply経路をspec化)
- Topic: `/management-score` 5要望クローズ。次は **ZMP(p19) 収支確認 + OkuDoor 別財布**
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `main`
- Production: **HEAD=cb8aa5dd**。`build-info.ts`=v0.23.3 (governance系別セッションが bump)。本セッションはコード変更なし (DB書き換え+mdのみ) のため deploy.sh 不使用、md commit を直 push。

## 直近セッション (2026-06-16 #94 — 5要望クローズ + CX修正 + 契約Apply spec化)

`task_caf24348` の5要望のうち #1/#3/#4/#5 は前セッション継続で `8cfcac23` (v0.23.1) 実装済み。本セッションは:

1. **#2 サブスク額を freee 取引実額で棚卸し** (本番DB書き換え, まさGO済): `company_finance_recurring_items.amount_yen` を freee `/api/1/deals?partner_id=` 実額で更新。slack→¥20,828 / claude→¥22,945 (freee正本, Max化前) / conduct→¥48,400 (税理士一本へ契約変更, 社労士2025-10解約) / co-en=つくばまちなかデザイン ¥38,500据置 (地代家賃)。commit `b1f95968`。
2. **CX(p20) 無期限売上計上事故を修正** (本番DB書き換え, まさGO済): `monthly_fixed ¥290,000 / end_ym=null` が 202702まで無期限計上 → 契約書実態 (contract_terms `1cf248e3`, 2026-06〜09, 税込¥990,000, masa確定6/15) に合わせ `fee_type='variable' / start_ym=202606 / end_ym=202610 / contract_terms_json投入`。売上は billing_cycles ÷0.65逆算で6月¥78,000・7-9月¥274,000、10月以降¥0。billing_cycles不変更。
3. **契約Apply経路をspec化**: `spec/5-6 §Contract Apply` 新設。contract_terms(applied)→①contract_terms_json ②fee系 ③billing_cycles の3層反映経路+end_ym必須ガードを定義。**自動反映は未実装** (applied=ステータス更新のみ=手編集依存)。実装は `task_20260616090543_vayt2` に起票。commit `cb8aa5dd`。

詳細: `pwa/design_log/sessions_2026-06.md` #94。教訓: `pwa/BUGS.md` (CX無期限計上)。正本: `pwa/spec/5-6-contracts-management-current-spec.md` / `pwa/manual/4-5-*.md`。

## Repo State

- HEAD=cb8aa5dd (push 済)。作業ツリー: `pwa/proposals/` のみ untracked (別作業, 触らない)。
- 本セッションの commit: `b1f95968` (サブスク) / `cb8aa5dd` (CX+契約Apply spec)。いずれも md + DB のみ、コード変更なし。
- ⚠️ 次セッション開始時は必ず `git fetch` → 並行セッション (governance系) が頻繁に push する。deploy.sh が origin 乖離で止まったら `git rebase origin/main`。

## Unresolved / 次セッションへの申し送り

1. **(次セッション=チップ済 task_ad1f0ea1) ★最優先** ZMP(p19, 葛飾ロード) 収支確認・修正 (まさ 2026-06-16 依頼):
   - **収支ゼロ問題**: 予算(売上)とメンバー支払いが同額で収支ゼロ。まさも参画なので少なくともまさへの支払い分は粗利プラスのはず。原因特定 (報酬予算が売上に張り付き / まさ稼働を外部メンバー原価扱い していないか)。
   - **OkuDoor 別財布**: ZMP は月次定額¥300,000以外に OkuDoor開発を別途受託 (別財布)。OkuDoor分の売上・原価がOSに正しく入っているか確認 (別project_id / billing_cycles / 別テーブル を調査)。
   - ZMP 現状: p19 / 葛飾ロード / monthly_fixed ¥300,000 / start_ym=202506 / end_ym=null / contract_terms_json=null。
2. **(別タスク=起票済 task_20260616090543_vayt2)** 契約 Apply 自動反映の実装。正本=`spec/5-6 §Contract Apply`。contract_terms(applied)→projects/billing_cycles 3層反映 writer を `/api/contracts` に。
3. **(保留・まさ承認待ち)** A案: `persistForecast: true` で将来月予測 uncapped 報酬を `billing_cycles.reward_summary_json` へ保存。本番書き込みなので別途まさGO後。
4. **(別セッション=チップ済 task_6027de9a)** coverage/gap scanner の設計 (脱・属人化)。
5. **(別セッション=チップ済 task_2eff788c)** AMD Scoreモデル改良v3.3。コアモデル変更=設計先行・まさ承認必須。
6. **(監視、過去継続)** 7月以降 p21 事業計画策定が未確定なら初の `ms_schedule_delay` 通知。`/notifications` "D-2 MS計画遅延" ラベル実地確認。
7. **(別ワークストリーム、過去継続)** payment PR #2 / ERS 根拠メモ「未確認」埋め。下記 pointer 参照。

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git log --branches --not --remotes --oneline   # 未 push 検知
git status -sb
```

ZMP(p19) の収支確認に着手。まず正本spec (`manual/7-1-reward-calc-spec.md` / `manual/4-5-*.md`) を読み、`live-monthly-pl-inputs.ts` で ZMP 売上=¥300,000 に対しメンバー原価がどう計上されるか確認。OkuDoor は projects を `ilike '%OkuDoor%'` で検索 + billing_cycles/contract_terms/freee(葛飾ロード) を当たる。本セッションの handoff doc は既に commit & push 済み (`cb8aa5dd` 以降に追加 commit する)。

## Pointers

- **株主・ガバナンス+要対応 (今回)**: 設計 `pwa/design/governance_action_items.md` / 使い方 `pwa/manual/2-3-pj-cockpit.md` / migration `pwa/scripts/migrations/137_governance_and_action_items.sql` / 導線保護 `pwa/design/FEATURE_REGISTRY.md` / D-14抽出 `pwa/scheduled-tasks/amd-os-l2-consolidated-evidence/SKILL.md` Phase K-C。SU資本知識は `knowledge/jc.md`。
- 確定仕様 (spec): `pwa/spec/3-10-l2-ms-progress-current-spec.md` (D-2 MS進捗の全契約)
- 使い方 (manual): `pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md`
- 中核データ正本: `pwa/design/L2_DATA.md` / コックピット: `pwa/design/cockpit.md`
- バグ・教訓: `pwa/BUGS.md` (今回: CX 無期限売上計上 / 契約抽出が projects に反映されない 教訓を追記)
- 契約管理 + Contract Apply: `pwa/spec/5-6-contracts-management-current-spec.md`
- 過去セッションログ: `pwa/design_log/sessions_2026-06.md` (#94 が本セッション)
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
