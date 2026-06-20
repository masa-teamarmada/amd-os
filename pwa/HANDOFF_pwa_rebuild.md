# HANDOFF - AMD OS PWA

- Last updated: 2026-06-20 (別財布 cap_extra 汎用化: **完了・deploy済 v0.29.2**)
- Topic: ZMP(p19) の別財布 OkuDoor が本契約の pt単価・cap を汚染していた件を、別財布を「同一 plan cycle 内の別プール (cap_extra)」として汎用処理する仕組みで解決。エンジン + 予実表 + DB是正 + ドキュメント全部完了、本番 deploy 済。
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app` (v0.29.2 / git_sha d1de9502 / dirty:false 確認済)
- Current branch: `main`

## 直近セッション要約 (2026-06-20) — 別財布是正 完了

詳細は [`design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md) の 2026-06-20 別財布セクション、設計正本は [`design/season_budget_actual.md`](design/season_budget_actual.md) §5.1+§5.2、教訓は [`BUGS.md`](BUGS.md) の別財布エントリ。

**やったこと (全完了):**
- エンジン (`reward-summary.ts`, 前commit 82deb78a): `billing_cycles.extra_budget_yen` を別プール月次cap、extra pt単価を別財布原資から独立化。完了月だけ満額cap → 完了時一括支払。
- **ZMP DB是正 (本番適用済)**: `value_plan_cycles.PC-p19-202601-202612.total_points` 187→**177** / OkuDoor MS `MS-p19-2026-02-okudoor-system` の share **まさ0.6923 / うめ0.1538 / あび0.1538** / `billing_cycles.extra_budget_yen` **202610=130万・202605〜202609=0**。
- **要確定論点を whatif で解決 → A案採用**: 完了月cap=**満額130万**。202605 の旧即払い (うめ/あび各32,760・まさ会社留保152,685) を残したまま残額capにすると二重計上で各23万に膨らむため、**202605 の保護フラグ (reward_paid_at/payout_notice_uploaded_at) を一時 NULL → `syncRewardSummariesForProject` で全期間再計算 → フラグ復元**して旧即払いを新ロジックで打ち消した。`monthly_reward_payout` に202605の実支払行が無い (現金未払い) ため上書き無害。
- 結果: **うめ/あび各199,850 (≈20万)・OkuDoor総消化1,299,998 (≈原資130万) にぴったり収束**、regular pt単価 21,273 で汚染解消、extra pt単価 19,403 独立、最終月 extraStock=0 (別財布完済)。
- **予実表 `computeSeasonPl` も別財布対応に改修** (commit d1de9502): pt単価 regular/extra 分離、member 予算取り分を `regularEarnedPt×regular単価 + extraEarnedPt×extra単価` で算出、検算④を regular 分母で突合。`AdminSeasonPlClient.tsx` に extra pt単価・member 別財布取り分の表示追加。是正後の検算: ①closes ②pt完全割当 ③原資=Σcap ④pt単価整合 **全✅**、全member収束Δ ±5円。
- **汎用プレイブック正本化**: `design/season_budget_actual.md` §5.2 (別財布3ステップ手順) / manual 7-1「別財布 (cap_extra) プール」章 / 6-5 別財布手順 / FEATURE_REGISTRY / 9-3 changelog。**次に別財布案件が来たら §5.2 に沿うだけ**。
- **計算ルール (65%/pt単価/cap/繰越) は全PJ共通のまま不変。別財布も特殊計算しない** (まさ確定)。

## Repo State

- HEAD: `d1de9502 feat(reward): 別財布 cap_extra 汎用化を予実表へ波及 + ZMP是正 (v0.29.2)` (push済)
- production: **v0.29.2 / d1de9502 / dirty:false 反映確認済**。
- 未push commit: **なし** (`git log origin/main..HEAD` 空)。
- **dirty (触らない)**: `COMMANDER_TASKS.md` (branch cleanup worker の司令塔台帳・別タスク)。あたしの commit には含めていない。

## Unresolved / 次アクション (次セッション)

別財布是正そのものは完了。残るは**別件・別タスク**:

1. **ZMP regular プールの timing 残課題** (OS task `task_20260620015628_8lzmx`): regular プールが 202609〜 で単月需要 > 単月cap (195k) となり、フラットcapでは末月までに払い切れず年末 regStock 約21.3万 (役員stock まさ65,411+きよ15,216 = 80,627 含む) 残る。**OkuDoor別財布とは無関係** (最終月で全員 extraStock=0、残るのは全部 regularStock)。本契約 MS スケジュールが後半偏り × 月次capフラットの timing 問題。cycle 延長 or 翌cycleへ繰越許容 or 後半cap増 を検討。
2. **別財布の入力UI自動化** (合意スコープ外・次段階): 今回は「仕組み + ルール + 手順」確立まで。別財布が来たとき extra_revenue_json / cap_extra MS / extra_budget_yen を OS UI から入れる導線は未実装 (今は DB 直書き or プレイブック手動)。
3. **他PJ監査の残り** (別タスク): SX 1pt 穴 (total_points→119 or MS 1pt補完) / KUTE budget_yen 設定異常 ((請求×65%)になっていない)。予実表が検知役。

## First Next Action

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git log --branches --not --remotes --oneline   # 別タスクのもの以外に未push が無いか
git status -sb
curl -fsS https://amd-os-pwa.vercel.app/api/build-info   # v0.29.2 のはず
```

別財布案件が来たら [`design/season_budget_actual.md`](design/season_budget_actual.md) §5.2 プレイブックに沿う。

## Pointers

- 設計正本: [`design/season_budget_actual.md`](design/season_budget_actual.md) §5.1 (ZMP解析・是正実証) + **§5.2 別財布処理プレイブック (汎用)**
- 予実表: [`design/FEATURE_REGISTRY.md`](design/FEATURE_REGISTRY.md) `/admin/season-pl`
- 報酬計算正本: [`manual/7-1-reward-calc-spec.md`](manual/7-1-reward-calc-spec.md) 「別財布 (cap_extra) プール」章 / [`manual/6-5-admin-payouts-reward-notice-spec.md`](manual/6-5-admin-payouts-reward-notice-spec.md) 別財布手順
- 教訓: [`BUGS.md`](BUGS.md) 別財布 cap_extra エントリ
- セッションログ: [`design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md)

## Verification Run (2026-06-20)

```bash
npx tsc --noEmit --pretty false          # exit 0
npm run test:critical-ui                  # green
npm run build                             # OK (route 全生成)
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh  # v0.29.2 deploy 成功 (2分40秒)
```

- ZMP DB是正は本番適用済 (total_points 177 / OkuDoor share 0.6923系 / extra_budget_yen 202610=130万)。
- 是正後 reward 再計算 (202605保護一時解除→全期間→復元) で実DB値を検証: うめ/あび各199,850・OkuDoor総消化1,299,998・最終月 extraStock=0。
- `computeSeasonPl(p19)` 実データ検算: ①②③④全✅、全member収束Δ ±5円、別財布 pt単価 regular21,273/extra19,403 分離表示。
