# HANDOFF - AMD OS PWA

- Last updated: 2026-06-17 (別財布売上の一級市民化 + 開発期間按分(B-a) / ⚠️ /admin/payouts 表に未反映が発覚)
- Topic: ZMP(p19) 別財布売上の按分実装。次は **別財布按分を `/admin/payouts`「先12か月 PJ収支」表にも反映**
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `main`
- Production: **HEAD=87692fb1** (= meeting_summaries doc, 別セッション push)。`build-info.ts`=v0.25.1 (本セッション)。本セッションの deploy は `062fc2e8`=v0.25.1 で完了済み (live git_sha 確認済)。

## 直近セッション (2026-06-17 — 別財布売上 一級市民化 → 開発期間按分)

ZMP(p19) の「収支ゼロ」= OkuDoor開発の別契約原価(cap_extra)だけ乗り売上が無い問題を解決。

1. **別財布売上を一級市民化 (v0.25.0, commit `1cd08f78`)**: `billing_cycles.extra_revenue_json` (migration 142, 本番適用済) に別枠売上を構造化。live builder が全PJから読んで `extraRevenue` 注入、エンジンが売上計・粗利・消費税・CF に加算 (原価率は通さない)。当初は請求月一括計上。
2. **旧L2丸数字禁止チェック削除 (commit `efde3fab`)**: `expectNoCircledNumbering` はまさの意図取り違え (本来=旧L2ナンバリング参照禁止)。削除。spec/3-0 の `expectNotIncludes` は残す。
3. **計上方式を開発期間按分(B-a)へ修正 (v0.25.1, commit `062fc2e8`)**: まさ確定 A=202605〜202610(6ヶ月)/B=B-a(PL・CF同月)/C=B-2(総額+期間を正本、エンジン按分)。`extra_revenue_json` に `period_start_ym/end_ym` を持たせると live-inputs 層 (`monthsBetween`/`nextYmInt`) で各月按分展開。OkuDoor ¥200万を202605〜202610 各¥333,333(最終月¥333,335) に本番更新。end-to-end 検証済 (月次収支シミュレータで p19 が202605〜610 ¥633,333)。

詳細: `pwa/design_log/sessions_2026-06.md` (2026-06-17セクション)。正本: `pwa/manual/4-5-*.md`。

## Repo State

- HEAD=87692fb1 (push済, 別セッションの doc commit)。本セッション commit=`1cd08f78`/`efde3fab`/`062fc2e8` 全て push済。
- 作業ツリー: `pwa/proposals/` のみ untracked (別作業, 触らない)。本 handoff の md commit を追加 push する。
- ⚠️ 次セッション開始時は必ず `git fetch` → 並行セッションが頻繁に push。deploy.sh が origin 乖離で止まったら `git rebase origin/main`。

## Unresolved / 次セッションへの申し送り

1. **★最優先** 別財布按分を `/admin/payouts`「先12か月 PJ収支」表にも反映 (まさ 2026-06-17 発見、BUGS.md記録):
   - **症状**: 月次収支シミュレータ(`/management-score`)には按分反映済みだが、`/admin/payouts` の「先12か月 PJ収支」表は ZMP が横ばい(按分なし)。
   - **原因**: PJ収支コンポーネントが**2系統**。(A)`/management-score`=live builder経由(extraRevenue読む=反映済)。(B)`/admin/payouts`=`AdminPayoutsClient.tsx:2516`、`cycle.budget_yen`ベースの独自forecast(extra_revenue_json読まない=未反映)。
   - **対応**: (B) の forecast計算(`AdminPayoutsClient.tsx` line 720-760付近、`forecastCycles`)に按分を足す。`live-monthly-pl-inputs.ts` の `monthsBetween`/`nextYmInt`/按分ロジックを共通ヘルパー(`src/lib/finance/`)に切り出して両系統で共用するのが望ましい(ロジック二重実装回避)。
2. **(別セッション継続)** ZMP 残課題: ① OkuDoor企画(20pt)・現地運用(20pt)MSが tag=normal で regular財布混入。② plan cycle total_points=187 に OkuDoor pt 含まれ ptUnit希釈。③ 他PJ別財布売上を順次 extra_revenue_json 投入(今後は `period_*` 付きで自動按分)。
3. **(別タスク=起票済 task_20260616090543_vayt2)** 契約 Apply 自動反映の実装。正本=`spec/5-6 §Contract Apply`。
4. **(保留・まさ承認待ち)** A案: `persistForecast: true` で将来月予測 uncapped 報酬を `billing_cycles.reward_summary_json` へ保存。本番書き込みなので別途まさGO後。
5. **(別セッション=チップ済 task_6027de9a)** coverage/gap scanner の設計 (脱・属人化)。
6. **(別セッション=チップ済 task_2eff788c)** AMD Scoreモデル改良v3.3。コアモデル変更=設計先行・まさ承認必須。
7. **(監視、過去継続)** 7月以降 p21 事業計画策定が未確定なら初の `ms_schedule_delay` 通知。`/notifications` "D-2 MS計画遅延" ラベル実地確認。
8. **(別ワークストリーム、過去継続)** payment PR #2 / ERS 根拠メモ「未確認」埋め。下記 pointer 参照。

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git log --branches --not --remotes --oneline   # 未 push 検知
git status -sb
```

別財布按分を `/admin/payouts`「先12か月 PJ収支」表にも反映する。まず正本 `manual/4-5-*.md` の別財布売上節 + `BUGS.md` 2026-06-17エントリを読み、按分ロジック (`live-monthly-pl-inputs.ts` の `monthsBetween`/`nextYmInt` + `extra_revenue_json` 展開、L242-300) を把握。`AdminPayoutsClient.tsx:2516`「先12か月 PJ収支」の forecast 計算 (L720-760, `cycle.budget_yen`ベース) を読み、按分ロジックを共通ヘルパーに切り出して両系統で共用する形で (B) に extraRevenue を加算。実装後は `/management-score` と `/admin/payouts` の**両方**で ZMP(p19) 202605〜202610 に¥333,333が乗ることを目視確認 (= 今回の verify 漏れの再発防止)。

## Pointers

- **別財布売上 (今回)**: 使い方/仕様 `pwa/manual/4-5-management-score-and-finance-simulation-spec.md` (別財布売上節) / 教訓 `pwa/BUGS.md` 2026-06-17 / changelog `pwa/manual/9-3-appendix-changelog.md` / セッションログ `pwa/design_log/sessions_2026-06.md` 2026-06-17。
- **按分実装ファイル**: `pwa/src/lib/finance/live-monthly-pl-inputs.ts` (按分展開 L242-300, `monthsBetween`/`nextYmInt`) / `pwa/src/lib/finance/monthly-pl-simulation.ts` (`extraRevenueForYm`, エンジン本体は無改修)。
- **2系統のPJ収支コンポーネント**: (A) `pwa/src/components/management-score/GasMonthlySimulationPanel.tsx` (反映済) / (B) `pwa/src/components/admin/AdminPayoutsClient.tsx:2516` (先12か月表, **未反映=次タスク**)。
- DB列: `billing_cycles.extra_revenue_json` (migration 142)。形式 `[{label, amount_tax_excl, period_start_ym, period_end_ym, freee_invoice_number, billing_date, memo}]`。
- 中核データ正本: `pwa/design/L2_DATA.md` / コックピット: `pwa/design/cockpit.md` / 重要UI登録簿: `pwa/design/FEATURE_REGISTRY.md`
- 契約管理 + Contract Apply: `pwa/spec/5-6-contracts-management-current-spec.md`
- 報酬計算正本: `pwa/manual/7-1-reward-calc-spec.md` (pt消化=期間按分のルール)

### 別ワークストリーム (過去 handoff からの継続事項)

- payment PR #2 (`https://github.com/masa-teamarmada/amd-os/pull/2`): 古い base のため直 merge せず main-based で作り直す方針。詳細は `pwa/design_log/sessions_2026-05.md` #96 / `pwa/BUGS.md`。
- ERS 実データ本評価 / 制度比較マトリクス: `pwa/design_log/sessions_2026-05.md` #103〜#106。`/institutions/assess` 根拠メモの「未確認」項目 (香川大 軸5/6/7、工学院大 軸5/6/7、NIMS 軸3/5/6/7-d) が残課題。

## Deploy / Verification コマンド (今セッションで実行したもの)

```bash
# 本番反映 (push 方式、CLI deploy は廃止) — 本セッションは v0.25.1=062fc2e8 で完了
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh

# DDL適用 (今回 migration 142 は前セッションで適用済、新規DDLがあれば)
python3 -X utf8 scripts/apply_ddl.py scripts/migrations/NNN_name.sql

# 別財布按分の end-to-end 検証 (tsx で live builder を直叩き、cwd=pwa)
# ※ tsx はモジュールキャッシュで古い結果を返すことがある → 新規プロセスで再実行して確認
#   buildLiveMonthlyPlInputs → runMonthlyPlSimulation で pjDetails.extraRevenue を見る
```

⚠️ **検証の網羅性**: finance の数字を変えたら必ず `/management-score`(A) と `/admin/payouts`(B) の**両画面**で目視確認する。今回 (A) だけ確認して deploy し、(B) 未反映を見落とした。
