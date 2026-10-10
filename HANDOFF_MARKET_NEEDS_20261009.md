# 市場ニーズ一覧（2026-10-09）

今回の変更: 一市場一行の一覧。市場・企業の複数出典、国内/世界の年別年間市場規模、ニーズ情報の確度、市場から既存シーズへの直接リンク。
正本仕様はpwa/spec/5-19-seed-needs-current-spec.md、使い方はpwa/manual/2-5-research-assets-quick-start.md。

DB migration499/500は本番適用済み。既存データを削除・新しい推計値を補完しない。既存シーズは参照のみ。

検証: 620件の合成データで一市場一行・重複排除・地域年別順位・未評価を0にしないことを検査。Chromeのローカル表示で25件ずつの表示、検索、確度順、地域切替、出典と国内/世界両推計の保存（表示用模擬保存）を検証。実DBのtransaction rollbackで出典/推計/直接リンク、JSONの型・不正参照・外部/匿名・重複/FK・競合を確認。

## 配布と確認

- 本番: https://amd-os-pwa.vercel.app/seed-needs 。v3.162.8、配信SHA `74243e38925c64d6c003ae5888abfb51263f692c`、main、dirty=falseを配信情報で確認。
- 実装commit `1fab5211`。配布前に別作業のログイン改善を取り込んだmerge commitが上記配信SHA。
- 正規の `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` による検査・push・本番Ready確認を完了。
- 型検査、対象lint、test:seed-needs、実DBのrollback試験、本番用build、deployの必須検査が通過。取り込んだログイン変更のcheck_workspace_email_codeも通過。
- 本番Chromeで一市場一行の4件、企業ニーズと正本シーズへのリンク、国内/世界切替、816件から選べる直接リンク入力を確認。
- 記入例「設備監視センサーの保守負担」に出所「シーズ・ニーズ一覧の議論用原案」(議論・構想、AMD内部検討、2026-10-09) と確度C・理由を保存し、再読込後の詳細表示まで確認。内容は内部で作った仮説であることを明示。企業要望や市場調査で裏付け済みとはしていない。
- 市場規模の実数は未投入。国内/世界とも未評価。両地域の推計保存は実DBのrollback試験で検証済み。本番に検証用金額は残していない。
- 本番1440px幅で表の行高88px、説明のある行96px。390px幅で文書幅390px、表内のみ横スクロール。ブラウザーのconsole errorは0件。
- 本番画面の控え: `/Users/masa/projects/AMD/amd-os/.jez/artifacts/market-needs-20261009.jpg`。

## 作業場所と残る同期

作業はmainの使い捨てcloneで実施。新branch・worktreeなし。今回の変更はorigin/mainと本番へ反映済み。仕様・手順は上記正本に保存し、iOS設計・macOS対応表も更新。design_logは未変更。会話の検討材料は0件。

正規checkout `/Users/masa/projects/AMD/amd-os` は `f2a08962` のまま、2026-10-09 00:23 JST時点でahead3 / behind18、未commit差分なし。以下3件は今回より前の契約・メール改善で、patch-equivalentではないため保持。今回の画面変更と一括pushしない。

- `c0f23546`: 契約承認と契約メール通知
- `3f11241e`: メール本文抽出
- `f2a08962`: 契約の押印状態判定と配布の阻害記録

正規checkoutの同期は未完。次の担当はこの3件を所有する契約・メール改善の作業。次回その作業を再開するとき、現行origin/mainと差分を照合して統合・検証・配布してから正規checkoutを同期する。所有者の変更をreset/rebase/stashで消さない。この確認記録のpush後はbehindが1件増える見込みなので、終了時の実数はローカル検証控えにも記録する。
