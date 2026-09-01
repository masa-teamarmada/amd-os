# 2026-09 開発セッション

## 2026-09-01 KUTE今期タスク再編

- KUTE (`p25`) の旧ロードマップ6件を、契約、開催後議事録、規程台帳、8月業務報告、作成済み成果物から再検討した。
- 「認定制度」7件、「関連6規程」12件、「シーズ発掘」6件、「桑折先生」8件、「自走化・連携」4件、「年度報告」1件の計38件へ再編した。
- 文書案の作成と大学の決裁・施行、候補調査と研究者への接触承認、調査完了と実証受注・事業化を別タスクにした。
- 証跡を確認できたR01/R02/R03/R08/S01/K01/K02/K03/K04の9件だけを完了、進捗100%、実績日ありで登録した。日程根拠がない行は日付NULLのままにした。
- 旧6件は移行後の編集・依存関係がないことを本番preflightで確認し、物理削除せずsoft-deleteした。旧2レーンの内部キーとIDは参照整合性のため保持し、表示名だけ更新した。
- data migration `ios/supabase/migrations/20260901184500_kute_fy2026_task_rebuild.sql` を本番適用。スキーマ、RLS、API、シーズ評価正本、他PJは変更していない。
- 共通仕様は `pwa/spec/3-8-cockpit-current-spec.md`、利用説明は `pwa/manual/2-3-pj-cockpit.md`、KUTE側の業務正本は `/Users/masa/projects/AMD/kute/docs/FY2026_TASK_REVIEW.md`。
- commit `38a1c7e6` をmainへpush。本番データreadbackは6区分・38件・完了9件・旧6件soft-delete・依存0件。KUTEタブ契約検査と完了色検査を通過し、Vercel deployment `dpl_CFNctc8rtLV2wouaVRWj11VusaV4` のREADYを確認した。
- 一括critical UI検査は、同時進行中だった共有ワークスペースの別差分が既存anchorを外していたため、この時点ではKUTE変更単独の判定に使わなかった。KUTE専用検査とVercel production buildは成功している。
- 最初に内部track key自体を変更する案を試したが、親整合性triggerがcascade途中のoutcome/milestone不一致を検知してトランザクション全体をrollbackした。表示labelだけ更新する方式へ変更し、再適用した。失敗した試行による本番データ変更はない。

