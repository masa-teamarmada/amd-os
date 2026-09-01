# 2026-09 開発セッション

## 2026-09-01 ZMP共有ワークスペース再設計・目的構造の役割色

- まさの指摘「ワークスペース側はデザインコードが無視されているので大幅に作り直す。色はコックピット側で調整」に対応した。閲覧対象はAMD内部に限定せず、外部を含む当該PJメンバーのまま。認可・データ可視性・writerは変更していない。
- 共有ワークスペースの方眼背景と白黒中心の外枠を撤去し、skyからslateへ移るpage面、sky識別帯つきwhite header、AMD Blueの選択tab、white panel、見出し左railへ再構成した。コックピット埋込時は外枠を重ねず、同じcomponentの目的構造と状態色だけを共有する。
- 目的構造はAMD Blueを最上位目的・成立条件・選択枝・接続線へ使い、emeraldは完了、amberは当方action待ち・注意、slateは停止・中立へ限定した。色だけに依存せず既存の状態文言・件数を併記する。
- 本番で`--amd-action`が未解決になり、選択カードが透明背景・黒borderへ落ちていた。global CSS chunkだけに依存せず、共有ページとcockpit埋込のmount rootへ確定`--amd-*` tokenとfallbackを置き、`test:ui-design-code`と`test:zmp-workspace-themes`で回帰を止める。
- mobile 391×844では主tabとガント／目的構造切替を44px、目的枝を1列へ変形。desktop 1440×900とmobileで横overflow 0。テーマ・ガント・関係先の外枠、本番cockpitの目的構造を認証済み画面で確認した。
- `npm run test:ui-design-code`、`npm run test:zmp-workspace-themes`、`npm run test:critical-ui`、production build、deploy wrapper全ゲートを通過。commit `d2e305e9`とmobile polish `96d04c63`をmainへpushし、本番`v3.100.13`のbuild-info readbackまで完了した。
- 仕様は`pwa/spec/2-7-ui-design-code-current-spec.md`と`pwa/spec/3-16-project-weekly-control-current-spec.md`、利用説明は`pwa/manual/2-3-pj-cockpit.md`、附則は`manual/9-3`と`spec/6-1`へ同期済み。モデル、DB、iOS/macOS/Android、GASは変更していない。

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
