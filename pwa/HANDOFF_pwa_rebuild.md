# HANDOFF - AMD OS PWA

- 更新: 2026-09-17 JST
- セッション: コックピット／共有ワークスペースの事業計画タブ整理
- 作業種別: development

## 最新セッションの到達点

- コックピット（AMDメンバー限定）と共有ワークスペース（当該PJメンバー限定、AMD外を含む）の権限・入口は変更していない。
- 両画面の「事業計画」グループで、`事業計画`、`試算表`、`資本政策表`を独立タブにした。`試算表`は月次・年次の事業計画試算、`資本政策表`は将来計画として随時更新するもの。
- 「会社情報」側にある過去ラウンドの事実記録は、旧`資本政策表`から`資金調達履歴`へ改名した。計画側の資本政策表とは別物として維持する。
- コードは `584e1f59 feat(pwa): separate projections and capital plan tabs`。後続mainへ祖先として取り込まれている。
- 変更箇所は `CockpitBusinessPlan.tsx`、新設の `CockpitFinancialProjection.tsx` と `CockpitCapitalPlan.tsx`、および共有ワークスペースのタブ定義。仕様・操作マニュアル・変更履歴も同期済み。

## 反映・検証

- この機能の本番readback時は `v3.143.2` / `584e1f59b02c2968c89535ac14df5d0abd3924ad` / `dirty:false`。
- 認証済み外部Chromeで、p21のコックピットと共有ワークスペースに同じ事業計画グループが表示されること、`資本政策表`・`試算表`・`資金調達履歴`の各コンテンツを確認した。
- 390x844でも共有ワークスペースの資本政策表を確認し、ナビゲーションの横あふれなし。外部ブラウザ確認を必ず使う。
- `npm run build`、`check_cockpit_navigation.mts`、`check_bzm_2_2_pilot_ui_contract.mts`、`check_pwa_critical_ui.cjs`、deploy wrapper検査が成功している。

## Repo状態

- closeout文書はこの後のmainへ積む。先に `git fetch origin` して、feature commitが`origin/main`の祖先であることを確認する。
- 正規checkout `/Users/masa/projects/AMD/amd-os` は別作業由来のdirty 29 pathと未push 3 commitを持つ。今回の作業と混ぜず、reset、stash、rebase、削除、`git add .`をしない。
- 今回のclean clone `/tmp/amie-capital-tabs.WdtGsf` はcloseoutで削除する。別workerのworktreeには触らない。

## 未解決

- 今回の依頼範囲に未解決はない。次の依頼から開始する。

## 次の最初の行動

事業計画のタブを変更する依頼では、先に「計画として更新する情報」と「会社の過去事実」のどちらかを確認する。共有面へ出す情報とAMD内部限定情報の境界を、権限モデルを変えずに判定する。

## 参照先

- 操作: `pwa/manual/2-3-pj-cockpit.md`
- 現行仕様: `pwa/spec/3-8-cockpit-current-spec.md` / `pwa/spec/3-16-project-weekly-control-current-spec.md`
- 変更履歴: `pwa/design_log/sessions_2026-09.md`
- バグ・教訓: `pwa/BUGS.md`
