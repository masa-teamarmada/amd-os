# HANDOFF - AMD OS PWA

- Last updated: 2026-06-20 (別財布 cap_extra 汎用化: エンジン実装 + ZMP是正方針確定 / WIP・未push・未deploy)
- Topic: ZMP(p19) の別財布 OkuDoor が本契約の pt単価・cap を汚染して予実表が不一致を出していた件。別財布を「同一 plan cycle 内の別プール (cap_extra)」として汎用処理する仕組みをエンジンに実装。ZMP是正値も確定済み。**DB是正と deploy は次セッション**。
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `main`

## 直近セッション要約 (2026-06-20)

詳細は [`design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md) の 2026-06-20 別財布セクション、設計正本は [`design/season_budget_actual.md`](design/season_budget_actual.md) §5.1、教訓は [`BUGS.md`](BUGS.md) の別財布エントリ。

- 別財布 (cap_extra) を本契約と分離する汎用エンジン実装 (`reward-summary.ts`): `billing_cycles.extra_budget_yen` を別プールの月次cap にし、extra pt単価を別財布原資から独立化。完了月だけ満額cap → 「完了時一括支払」。
- **計算ルール (65%/pt単価/cap/繰越) は全PJ共通のまま不変**。別財布も特殊計算せず共通ルールで処理する (まさ確定)。支払額が先に決まる場合は share/pt を後付け調整。
- migration 149 (`billing_cycles.extra_budget_yen`) は**本番DB適用済 + dump_schema 済**。列は全行NULL=従来挙動なので無害。
- コード変更は commit 済 (`82deb78a`, ローカルのみ・**未push・未deploy**)。tsc/critical-ui green。
- ZMP是正の確定値は下記「次アクション」に記載。DBはまだ触っていない。

## Repo State

- HEAD: `82deb78a feat(reward): 別財布 cap_extra プールに月次cap機構 + extra pt単価独立化 (WIP, 未deploy)` (ローカルのみ, 未push)
- 直前: `d681dafb` (v0.29.1, シーズン予実表 manual sync, push済), `082fd765` (v0.29.0, /admin/season-pl, push済)
- Live production (未確認, 要 `curl /api/build-info`): v0.29.1 想定。今セッションのエンジン変更は未deploy。
- **未push commit**: `82deb78a` (あたしの今回分) + `019cdc4c feat(contracts): add contract terms cap source` (別ブランチ `codex/cx-contract-terms-cap-fix`, 別タスク由来・触らない)。
- **別タスク由来の dirty (触らない)**: `COMMANDER_TASKS.md`, `gas/CLAUDE.md`, `gas/DEBUG.md`, `pwa/design/notifications.md`, `scripts/send-eimi-slack.mjs`。あたしの commit には含めていない。

## Unresolved / 次アクション (次セッション)

合意スコープ: 今回は **別財布処理の「汎用の仕組み + ルール + 手順 (プレイブック)」を確立して ZMP で実証** まで。**入力UIの自動化は次段階の別タスク** (今はやらない)。

1. **コード push + deploy**: `82deb78a` を push。ただし下記 ZMP DB是正と**セットで** deploy する (エンジン変更だけ先行deployは中途半端)。`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` (BUILD_VERSION bump 必要)。
2. **ZMP DB是正** (確定値, B案 = 65%もptも原資も変えない):
   - `value_plan_cycles` `PC-p19-202601-202612` の `total_points` 187 → **177**。
   - OkuDoor MS `MS-p19-2026-02-okudoor-system` の `milestone_responsibility.share`: **まさ 0.6923 / うめ 0.1538 / あび 0.1538** (= 原資130万・pt単価19,403固定で あび・うめ各20万)。
   - `billing_cycles.extra_budget_yen`: **202610 に 130万**、202605〜202609 は **0**。
   - **要確定**: 202605 は既払い保護 (reward_paid_at=Y, OkuDoor分 あび/うめ各32,760 既出)。まさ方針「202605はそのまま保護、完了月capは残額」→ 202610 の extra_budget_yen を 130万から既払い分(65,520)差引くか、満額130万にして既払い込みで収束させるか、再シミュレーションで決める。
   - reward再計算 (paid月 202601/202604/202605 は `syncRewardSummariesForProject` が自動 skip = 保護)。
3. **予実表/payouts 確認**: `/admin/season-pl` で ZMP本契約が closes/原資=Σcap/役員収束 ✅、OkuDoor が分離・202610一括になるか検算。
4. **別財布処理プレイブックを正本mdに残す** (汎用化の核): 別財布が来たら「①extra_revenue_json売上 ②cap_extra MS(pt/share) ③extra_budget_yen(支払タイミング)」をどう設定するか手順化。次回はこれに沿うだけ。置き場は `design/season_budget_actual.md` か新規 `design/extra_pocket_playbook.md`。
5. **spec/manual 同期**: 仕様確定後に `manual/7-1-reward-calc-spec.md` (別財布プール cap / extra pt単価) と `manual/6-5` に反映。FEATURE_REGISTRY に extra_budget_yen 契約追記。
6. **別件残課題 (本fix対象外)**: ZMP regular プールが 202609〜 単月需要(248k)>cap(195k) で年末 regStock 約213k 残る (本契約MSスケジュール後半偏り×フラットcap)。OkuDoor無関係。別タスクで cycle延長 or 後半cap増 を検討。

## First Next Action

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git log --branches --not --remotes --oneline   # 82deb78a と 019cdc4c が見えるはず
git status -sb
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

その後、[`design/season_budget_actual.md`](design/season_budget_actual.md) §5.1 と [`design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md) の 2026-06-20 別財布セクションを読んでから ZMP DB是正に着手する。

## Pointers

- 設計正本: [`design/season_budget_actual.md`](design/season_budget_actual.md) §5.1 (別財布是正方針・シミュレーション結果)
- 予実表: [`design/FEATURE_REGISTRY.md`](design/FEATURE_REGISTRY.md) `/admin/season-pl`
- 報酬計算正本: [`manual/7-1-reward-calc-spec.md`](manual/7-1-reward-calc-spec.md)
- 教訓: [`BUGS.md`](BUGS.md) 別財布 cap_extra エントリ
- セッションログ: [`design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md)

## Verification Already Run (2026-06-20)

```bash
npx tsc --noEmit --pretty false          # exit 0
npm run test:critical-ui                  # green
python3 -X utf8 scripts/apply_ddl.py scripts/migrations/149_billing_cycles_extra_budget.sql  # OK (本番適用済)
python3 -X utf8 scripts/dump_schema.py    # db_schema.md 再生成済
```

- whatif シミュレーション (tsx, 本番データ read): total_points=177 + extra cap 202610=130万 で regular pt単価 21,273 / extra pt単価 19,403 / OkuDoor 202610一括 extraStock=0 を確認済。
- **未実施**: push / deploy / 本番 build-info 確認 / ZMP DB是正 / 予実表での最終検算。
