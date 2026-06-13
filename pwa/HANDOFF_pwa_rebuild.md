# HANDOFF - AMD OS PWA

- Last updated: 2026-06-13 (D-2 MS進捗 アンカー方式 + 計画遅延通知 A案+C案)
- Topic: SX「進みすぎ」問題の根治 — デフォルト按分の起点をまさ確定値 (アンカー) にし、target_ym 超過は通知で知らせる
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `main`
- Current HEAD: `ae93faeb feat(pwa): MS進捗デフォルト按分をアンカー方式へ + 計画遅延通知 (A案+C案) v0.19.0`
- Production: **v0.19.0 = ae93faeb Ready 確認済み**

## 直近セッション (2026-06-13 アンカー方式 + 計画遅延通知)

まさが「SXの6月が49%、7月も49%、両方進みすぎ」と発見 → 診断: p21 で 202605 確定 15% の MS が target_ym 最終月 202606 にデフォルト按分で 100% にジャンプしていた。まさ指示「AとCでいこう」で:

- **A案 (アンカー方式)**: デフォルト按分の起点を「その月より前の最新まさ確定値」に。3か月MSで 202605 確定 15% なら 202606 = 48.3%。target_ym 超過後も確定アンカーから月割り継続、勝手に 100% に飛ばない。
- **C案 (計画遅延通知)**: target_ym 超過 + 100% 未達 MS を毎日 cron が `l2_kind='ms_schedule_delay'` (D-2 MS計画遅延) で通知、解消で自動 delete。
- 計算 `anchoredExpectedCumPctForYm` を writer / LLM 乖離検知 / 報酬 / 表示 API の 4 か所に統一。
- 本番検証済み: p21 事業計画策定 202606 = 48.3%、PJ 全体 49.3% → 40.4%。遅延通知は対象 MS が無く 0 件 (SQL 裏取り済)。

詳細: `pwa/design_log/sessions_2026-06.md` 2026-06-13 エントリ。確定仕様: `pwa/spec/3-10-l2-ms-progress-current-spec.md` / 使い方: `pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md`。

> この前段 (2026-06-12 schedule_default_revision_v3 = LLM 直書き廃止・デフォルト按分+revision提案方式への全面移行、v0.18.0 = badaaa31) も同 design_log に記録済み。今回の A案+C案はその上に乗るアンカー化。

## Repo State

- HEAD: `ae93faeb` (push 済み、production Ready)。未 push commit なし (要 `git log --branches --not --remotes` で再確認)。
- 作業ツリー: この handoff で `design_log/sessions_2026-06.md` + `HANDOFF_pwa_rebuild.md` を更新 (未 commit)。次の commit に含める。

## Unresolved / 次セッションへの申し送り

1. **(保留・まさ承認待ち)** 残骸 `l2_routine` / `tsukuyomi_estimate` 行の DELETE 掃除。本番データ削除なので未承認のまま。cron の `routine_auto` 上書きで自然修復されるため実害はないが、明示的に消すならまさの承認を取る。
2. **(監視)** 7月以降、p21 事業計画策定 (target 202606) が 6月中にまさ確定されなければ、7月の cron が初の `ms_schedule_delay` 通知を出す。通知が `/notifications` に正しく "D-2 MS計画遅延" ラベルで出るか実地確認するとよい。
3. **(別ワークストリーム・本件と無関係、過去 handoff から継続)** payment PR #2 の扱い / ERS 根拠メモの「未確認」項目埋め。下記 pointer 参照。

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git log --branches --not --remotes --oneline   # 未 push 検知
git status -sb
```

この handoff の doc 更新 (design_log + HANDOFF) を commit & push してから、次の依頼に入る。

## Pointers

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
