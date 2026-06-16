# HANDOFF - AMD OS PWA

- Last updated: 2026-06-17 (/admin/payouts 支払予定を uncapped → capped + 役員除外(落とす一択) に修正 / KUTE¥0・マイナス月解消, v0.25.4)
- Topic: `/admin/payouts`「先12か月 PJ収支」表の支払予定 (支払額) を、v0.25.3 の uncapped 投影から **capped + 役員除外** へ修正。原価 (uncapped) と支払予定 (capped) は別概念で、支払予定列に uncapped を流用したのが誤りだった。役員が抜けた share は再配分せず**落とす一択** (再配分=倒産ロジック)
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `main`
- Production: 本セッション deploy = v0.25.4 (`build-info.ts`)。直前 deploy は v0.25.3。次セッションは `git fetch` で並行セッションの push を必ず取り込む。

## 直近セッション (2026-06-17 — /admin/payouts 支払予定を capped + 役員除外へ修正, v0.25.4)

v0.25.3 deploy 後、まさがスクショで3点指摘 — ① マイナス月があるのはおかしい (キャップが効いてるはず) ② OkuDoor分の支払いはうめ・あび2人で計¥40万のはず ③ KUTE(まさ・りり・きよ=全員支払対象外) で異常な支払いが出る、¥0でない時点で変。**真因2つ**: (1) v0.25.3 で /management-score の「原価=uncapped」を支払予定列に流用した (支払予定は **capped** が正本=spec 7-1)。(2) forward 投影に **役員除外**が無かった。

1. **新規 `computeForwardCappedMemberCosts` (`src/lib/reward-summary.ts`)**: 各月 `buildRewardSummary({ym,...,billingsByYm,planCycle,project})` を呼ぶ (cap+stock 繰越はコア内部で連鎖)。`is_officer || exclude_from_payout_notice` を `excludedMemberIds` で除外し `cappedTotalYen = Σ 非役員 totalPay`。DB 非書き込み。コア `buildRewardSummary` は無改修。
2. **route**: `forecastUncapped`/`computeForwardUncappedMemberCosts` → `forecastCapped: [{projectId,ym,cappedTotalYen}]`/`computeForwardCappedMemberCosts` に差し替え。
3. **client (`AdminPayoutsClient.tsx`)**: `cappedForecast != null ? cappedForecast : budgetYen フォールバック`。**`!= null` (0 含む)** が肝 — 役員のみ PJ (KUTE) は capped=¥0 が正しいので budgetYen に落とさない (`> 0` だと KUTE 巨額再発)。
4. **検証 (probe 実測)**: KUTE(p25) 全月 capped=**¥0** (指摘③解消)。ZMP(p19) 202609 uncapped ¥777,465 → **capped ¥215,169** に平準化、支払先は非役員 (あび/うめ/しん/こう) のみ、まさ(役員)は落ちる、**マイナス月消滅** (指摘①解消)。tsc/build green。
5. 正本: `manual/7-1-*.md` (支払予定=capped+役員除外) / `manual/4-5-*.md` ((A)原価=uncapped と (B)支払予定=capped を分離) / `BUGS.md` 2026-06-17 (先頭, v0.25.3 を ⚠️ 部分訂正 + v0.25.4 教訓) / changelog 9-3 / design_log。

**まさ叱責の教訓 (正本にも記録)**: ① 役員除外を「(i)落とす / (ii)再配分」の2択で提示したのが誤り — (ii)はAMD倒産ロジックで、選択肢に並べた判断自体が間違い。役員除外は**落とす一択**。② 原価(uncapped)と支払予定(capped)は別概念、流用禁止 (spec 7-1)。③ 役員除外がコア `buildRewardSummary` に無く各画面で後付け = 構造的な穴 (将来コアへ寄せる候補)。

**残課題**: 202701 以降 (plan 期間外) は capped が出ず budgetYen 決め打ちにフォールバック (v0.25.3 と同様、plan 延長 vs ロジック改修はまさ確認待ち)。

## 直近セッション (2026-06-17 — 別財布按分を両系統に反映 + 共通lib化, v0.25.2)

ZMP(p19) の別財布売上 (OkuDoor ¥200万) 開発期間按分を、`/management-score` だけでなく `/admin/payouts`「先12か月 PJ収支」表にも反映完了。直前 v0.25.1 で (A) live builder だけに按分を実装し (B) PJ収支表を verify 時に見落として横ばい表示になった問題 (BUGS.md 2026-06-17) の解決。

1. **按分ロジックを共通 lib に集約 (新規 `src/lib/finance/extra-revenue.ts`)**: `expandExtraRevenue(rows, {minYm, maxYm})` + `ymToInt`/`nextYmInt`/`monthsBetween`。`extra_revenue_json` を持つ全行から period 按分を展開し `(projectId, ym)` で集約。**両系統がこの1関数を呼ぶ** = 収支表が増えても按分を取りこぼさない構造。
2. **(A) `live-monthly-pl-inputs.ts`**: ローカル按分ループ・型を削除し共通 lib を呼ぶようリファクタ (挙動不変)。
3. **(B) `/admin/payouts`**: route が `extra_revenue_json IS NOT NULL` の全行を `extraRevenueRows` で返却 (按分元 ym=202603 が表示窓より前でも取りこぼさないため全行取得→展開後 minYm/maxYm フィルタ)。`AdminPayoutsClient.tsx` の `buildProjectMonthlyFinanceRows` が `expandExtraRevenue` で各月セルに `extraRevenueYen` 加算、`別財布 ¥…` を sky-blue 表示。
4. **検証**: 本番 DB のソース行を共通関数に通すと p19 = 202605〜609 各¥333,333 / 202610 ¥333,335 / 計¥200万。両画面が同一ソース・同一関数を共有するためこの値が両方に出る。`/admin/payouts` は admin auth gate でブラウザスクショ不可 (認証入力は禁止行為)、データ経路を end-to-end 検証して代替。tsc/build green。

直前セッション (v0.25.0〜v0.25.1, commits `1cd08f78`/`efde3fab`/`062fc2e8`): 別財布売上の一級市民化 (`billing_cycles.extra_revenue_json` migration 142) → 開発期間按分 (B-a) 実装。詳細は `pwa/design_log/sessions_2026-06.md` の同日エントリ群。

詳細: `pwa/design_log/sessions_2026-06.md` (2026-06-17セクション)。正本: `pwa/manual/4-5-*.md` / `pwa/BUGS.md`。

## Repo State

- 本セッション = /admin/payouts 支払予定を capped + 役員除外へ修正 (v0.25.4)。`src/lib/reward-summary.ts` (新 `computeForwardCappedMemberCosts`) + route/AdminPayoutsClient/build-info を1 commit に束ねて push + deploy.sh で本番反映。
- 作業ツリー: `pwa/proposals/` のみ untracked (別作業, 触らない)。
- ⚠️ 次セッション開始時は必ず `git fetch` → 並行セッションが頻繁に push。deploy.sh が origin 乖離で止まったら `git rebase origin/main`。

## Unresolved / 次セッションへの申し送り

1. ✅ **解決済 (v0.25.4)** /admin/payouts 支払予定を capped + 役員除外へ修正 (KUTE¥0 / マイナス月解消)。✅ **解決済 (v0.25.2)** 別財布按分を `/admin/payouts` PJ収支表にも反映 (共通 lib `src/lib/finance/extra-revenue.ts`)。詳細は上の直近セッション / BUGS.md 2026-06-17。
   - **構造的穴 (将来対応候補)**: 役員除外 (`is_officer || exclude_from_payout_notice`) がコア `buildRewardSummary` に無く各画面で後付け。支払系 forward 投影を書くたびに再実装が要る。コアへ寄せると安全。
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

直近の支払予定 capped 修正 (v0.25.4) は完了・deploy 済。次セッションがこの領域を続けるなら、まず正本 `manual/7-1-*.md` (支払予定=capped+役員除外) と `manual/4-5-*.md` ((A)原価=uncapped / (B)支払予定=capped の分離) を読む。**原価 (uncapped) と支払予定 (capped) を取り違えない** — /management-score の原価数字を /admin/payouts の支払予定に流用しない。役員除外は再配分せず**落とす一択** (再配分=倒産ロジック)。残課題は plan 期間外 (202701〜) の capped 未投影と、ZMP 財布混入 (下記 2)。

## Pointers

- **別財布売上 (今回)**: 使い方/仕様 `pwa/manual/4-5-management-score-and-finance-simulation-spec.md` (別財布売上節) / 教訓 `pwa/BUGS.md` 2026-06-17 / changelog `pwa/manual/9-3-appendix-changelog.md` / セッションログ `pwa/design_log/sessions_2026-06.md` 2026-06-17。
- **按分実装ファイル**: `pwa/src/lib/finance/live-monthly-pl-inputs.ts` (按分展開 L242-300, `monthsBetween`/`nextYmInt`) / `pwa/src/lib/finance/monthly-pl-simulation.ts` (`extraRevenueForYm`, エンジン本体は無改修)。
- **2系統のPJ収支コンポーネント**: (A) `pwa/src/components/management-score/GasMonthlySimulationPanel.tsx` (原価=uncapped) / (B) `pwa/src/components/admin/AdminPayoutsClient.tsx` (先12か月表, 支払予定=capped+役員除外, v0.25.4 反映済)。
- **支払予定の capped 投影**: `pwa/src/lib/reward-summary.ts` の `computeForwardCappedMemberCosts` (役員除外込) / route `pwa/src/app/api/admin/payouts/route.ts` (`forecastCapped`)。原価の uncapped 投影は同 lib `computeForwardUncappedMemberCosts`。spec 7-1 が capped/uncapped の正本。
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
