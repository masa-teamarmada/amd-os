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

## 2026-09-01 CX論点追加の復旧・論点リスト行密度

- CX (`p20`) では、画面が互換表示した標準4分類と、保存APIが受け付ける実登録分類が食い違っていた。`project_management_tracks`が0件のため、論点追加フォームは分類を選べても保存時だけ`trackが不正だよ`で拒否された。
- migration `pwa/scripts/migrations/358_seed_cx_management_tracks.sql`で事業開発・技術開発・資金調達・体制構築を追加登録した。既存の業務記録を更新しない追加のみで、本番readbackでCXの4分類と追加APIの保存条件が一致することを確認した。commit `ad5918cd`。
- 論点・仮説リストは列幅ではなく短い論点の行高が縦に間延びしていた。タイトルが共通44px操作高を引き継いでいたため、タイトルだけは表の行高へ戻し、担当未設定の空の補助行、セル上下余白、見出し、詳細ボタンを詰めた。全文表示と8列構成は維持する。commit `f7495b7a`、本番build `v3.100.14`のbuild-info SHA readback済み。
- 検証: `npx tsc --noEmit`、`npm run test:sx-weekly-control`、`npm run test:sx-management-save-contract`、`npm run test:critical-ui`、`npm run build`。認証境界を越える自動ブラウザ操作は行わず、ログイン入口の正常表示だけを確認した。

## 2026-09-01 シーズ一覧の会社名に但し書き（KUTE認定第1号）

- まさから「シーズリストの永井先生のところにも認定第1号の情報を入れて」。最初は `seeds.internal_notes` / `amd_rating_note` / `next_action` へ書いたが、シーズ一覧は `SEED_PUBLIC_VIEW_COLUMNS` のホワイトリスト取得で社内メモ系を読まないため、行の見た目は変わらなかった。まさの「まだ何も変わってなさそう」で判明した。書く前に画面がどの列を読むかを確認していれば防げた。
- 会社名セルに但し書きを出す `seeds.company_note` を追加した。migration `ios/supabase/migrations/20260901234500_seed_company_note.sql`、本番適用済み。`SEED_PUBLIC_VIEW_COLUMNS` に含めて研究機関向け公開ビューにも出す。社内限定の内容は従来どおり `internal_notes`。
- 表示先は一覧の会社名セル直下の小さい注記、`SeedDetailModal`（表示＋編集欄）、`KuteSeedDetailModal`。KUTE seed 19（永井裕己先生）に「※設立予定（工学院大学認定第1号）」を投入した。
- 根拠は 2026-08-07 眞鍋課長の学内メール（第1号案件＝永井先生、16号館1室を2025年6月運営委決裁で原則3年無償貸与）と 2026-07-08 平本さんメール（7/13ピッチ審査員の吉本様が認定SU第1号の社長予定、研究者の同級生）。大学側文書は「永井先生」表記のみで、`seeds` 側の永井裕己先生とのフルネーム一致は未確認。
- 検証: `npx tsc --noEmit`、`npm run build`、`test:seed-list-display`、`test:kute-seeds-tab-contract`、deploy wrapper の全ゲート。commit `e37e115a`、本番 `v3.100.18` の build-info SHA readback と `/seeds` 実画面で行の表示を確認した。
- 既知の未解決2件。(1) `npm run test:kute-seeds-scope` が本変更の前から失敗している。`FilterSelect` / `confidenceFilter` を探すが現行実装は `statusFilter` + `EVALUATION_FILTER_OPTIONS`。deploy ゲートには含まれないため反映は止まらないが、シーズ画面の防波堤が効いていない。(2) `output/seed_cockpits_20260901` は22件成功と記録が残るのに、本番に残る「事業化検討｜」コックピットは桑折先生の1件のみ。原因未調査で、作り直しは二重作成の恐れがあるため未実施。
- 正規checkoutに他セッションのdirty（bzm論文、8月design_log）があり `deploy.sh` が停止したため、使い捨てclean cloneから push した。push後に正規checkoutで fetch し、`origin/main` と `e37e115a` で一致を確認済み。

## 2026-09-01 シーズカードに経営チーム・リファラル

- まさ「CEOが経営経験者だし、そもそも研究者のリファラルって結構加点ポイントだと思うので、そういう情報もモーダルの中に入れておけるようにしてほしい」。
- `seeds.management_team_note` と `seeds.referral_note` を追加した。migration `ios/supabase/migrations/20260901235500_seed_team_and_referral.sql`、本番適用済み。AMDはBefore Zeroで経営機能を外から供給するため、CEO候補の経営経験と、研究者本人の人脈から経営人材が出ているか（リファラル）は移植可能性の評価に直結する。
- 機微なので `SEED_PUBLIC_VIEW_COLUMNS` には含めない。内部モーダル `SeedDetailModal` の「AMD 評価」セクションで表示と編集のみ。一覧と研究機関向け公開面には出ない。
- KUTE seed 19（永井裕己先生）へ投入。社長予定の吉本さんはまさの認識で経営経験者、2026-07-13ピッチでまさと同席した審査員の1人、永井先生の同級生。フルネーム・所属・現職・経歴の裏取りはAMD未実施であることを本文に明記した。
- あわせて `check_kute_seeds_scope` のフィルタ検査を現行実装（`ColumnFilter` + `statusFilter`）へ更新した。旧 `FilterSelect` / `confidenceFilter` を探し続けて失敗しており、シーズ画面の防波堤が効いていなかった。deploy ゲート対象外のため反映は素通りしていた。実装側は変更していない。
- 検証: `npx tsc --noEmit`、`npm run build`、`test:kute-seeds-scope`（今回から通過）、`test:seed-list-display`、`test:kute-seeds-tab-contract`、deploy wrapper 全ゲート。commit `7c20db20`、本番 `v3.100.19` の build-info SHA readback と実画面でカード表示を確認した。
- 正規checkoutは他セッションのdirtyが続いているため、今回も使い捨てclean cloneから push し、push後に正規checkoutで fetch して `7c20db20` 一致を確認した。
