# AMD OS Handoff

Last updated: 2026-07-11 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: 月初合意モーダルの確認対象を「担当内容」と「予定額」に固定したUI改善・closeout

## Current truth

- Canonical checkout は `main`。handoff時点の `HEAD` / `origin/main` はともに `932e7e6fd9c371afad4e76a4a9b3a8a1136ade79`、ahead / behind は `0 / 0`。
- Production proof: `https://amd-os-pwa.vercel.app/api/build-info` は `v3.39.62 / 932e7e6fd9c371afad4e76a4a9b3a8a1136ade79 / main / dirty=false`。
- 月初合意UIの変更 commit `66572734 fix(pwa): simplify monthly agreement scope` は current `main` の ancestor。以後の main には別レーンのBZM docs変更も入っている。

## 月初合意 — 確定した見せ方

- 合意前に本人が確認するのは、各PJの**担当内容**と、その対価としての**予定額**だけ。未合意または条件更新ありのままでは、当該稼働月の支払いに進めないことを警告文と合意ボタン直下で明示する。
- 月次の到達目標は snapshot に存在しない。MS名 (`milestones[].title`) を目標として表示しない。PJごとに `担当内容` を一度だけ置き、右に `taskDescription`（無い場合はMS名）を複数並べる。
- 予定額は合計と全PJ分を必須枠へ集約。合計とPJ別の数値表は内容幅に合わせ、不要に広い列間余白を作らない。
- `確認して合意` を主ボタンにし、`修正要望` はその右に小さく置く。下段の重複PJカードと「直してほしいこと」常設枠は廃止した。
- 必須枠より下はカードではなく `参考情報` の短い区切り。`支払い状況と対象PJ` は初期状態で閉じ、開いた時だけPJ別の支払い内訳を出す。

## Verification already completed for this change

- `npx tsc --noEmit`、対象 ESLint、Prettier、`npm run test:critical-ui`、`npm run build` が通過。
- デスクトップ / 幅390px のブラウザ確認で、到達目標ラベルが無いこと、担当内容の複数表示、予定額表の横あふれが無いことを確認済み。
- UI仕様と運用文書は `pwa/spec/3-14-monthly-work-agreement-current-spec.md`、`pwa/manual/2-2-member-workflows-quick-start.md`、`pwa/manual/6-6-member-billing-prompts-spec.md`、`pwa/manual/7-1-reward-calc-spec.md`、`pwa/BUGS.md`、`pwa/design_log/sessions_2026-07.md`、両changelogへ同期済み。

## Dirty / cleanup state

| path | status | class | action |
|---|---:|---|---|
| `pwa/src/components/admin/AdminProjectsTable.tsx` | M | 他レーンの admin PJ Slack設定 | 触らない・stageしない。担当レーンで完了させる。 |

- 登録worktreeは root main checkout の1つだけ。ローカル branch も `main` だけ。
- このセッションで使った `/tmp/amd-os-monthly-agreement-scope.KvYcPh` は、状態証跡を `/Users/masa/.codex/cleanup_archives/amd-os-monthly-agreement-scope-20260711T090000JST.txt` に残して削除済み。

## Next action

- 追加のUIフィードバックが来るまでは、月初合意に未完了WIPはない。
- 次に触る時は、月次目標や独立した発注条件をデータに無いまま復活させない。表示語は snapshot の実データと一致させる。
- root の既存dirtyは理由に止まらず、対象bundleだけを明示stageする。`git add .` は禁止。

## Pointers

- 月初合意仕様: `pwa/spec/3-14-monthly-work-agreement-current-spec.md`
- メンバー運用: `pwa/manual/2-2-member-workflows-quick-start.md`
- 請求・支払い導線: `pwa/manual/6-6-member-billing-prompts-spec.md`
- 報酬計算: `pwa/manual/7-1-reward-calc-spec.md`
- UI実装: `pwa/src/components/monthly-agreement/MonthlyAgreementExperience.tsx`
- 回帰・教訓: `pwa/BUGS.md` / `pwa/design_log/sessions_2026-07.md`

## Guardrails

- PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`。直接 `npx vercel` は使わない。
- raw本文・private URL・secret・個人情報を handoff / BUGS / design log に残さない。
