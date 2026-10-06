# SOL DD・3スペース引き継ぎ（2026-10-06）

仕事種別: mixed。調査・コンテンツ方針はSOLの目的別文書、製品仕様と実装履歴はOSへ分離。

## 現在地

- DD各項目の器、フラットメニュー、共通本文、キラー要素独立、専門家向け文言、3会議体の決議一覧を整備。
- 契約リストは3スペースに設置、内部2スペースで契約ごとのDD表示選択。SOLの掲載対象は指定いよぎんNDA1件のみ、未締結。ほか4件のAMD業務契約は元台帳に保持して一覧対象外。
- 契約範囲修正478f37be（v3.159.17）まで本番反映済み。migration482/483適用済み、再適用不要。
- 本番DB＋実server loaderで内部1/DD1と元台帳5件を照合。契約ルート回帰、DD回帰、型検査・配信ゲート成功。
- PCのコックピットで契約一覧・DD選択操作、決議3一覧を確認。その後の掲載範囲訂正はDB/loader確認まで。訂正後のワークスペース/DD実画面は未確認。Webスマホ検証は対象外、Swift変更なし。
- 別セッションの資料分割後、現在のDDナビは32項目。現行spec3-24を優先し、旧16項目へ戻さない。

## 保存先

- 調査と整備判断: /Users/masa/projects/AMD/SOL/SOL_DD_CONTENTS_PLAN.md
- 製品正本: spec/5-17-dd-package-current-spec.md、spec/3-24-project-surface-pages-current-spec.md、FEATURE_REGISTRY.md、db_schema.md、ios/DESIGN.md。
- 操作説明: manual/2-3-pj-cockpit.md、manual/2-6-admin-ops.md。
- 実装・検証履歴: design_log/sessions_2026-10.md。掲載境界の教訓: BUGS.md。
- 次セッションプロンプト: ../SESSION_MIGRATION_PROMPT.md。旧Function Storageプロンプトは ../SESSION_MIGRATION_PROMPT_FUNCTION_STORAGE_20261006.md に原文保持。

## 次の行動

共通ルール・AMDメモリ・現行仕様を読み、fetch/statusと本番build-infoを再取得。PCで3スペースの契約1件・DD選択・件数を照合し、SOL目的別文書の証憑不足を各ページへ対応付ける。コスト試算・月次数値は別セッション。未合意条件や未確認証憑を生成せず、対外公開・権限付与・メール送信を追加しない。

## Git・並行作業

共有mainのみ。終了照合時の実装HEAD/main/originはf6a0d3a4、本番同SHA/v3.159.23。高速化担当の先行commitを含むため固定SHAへ戻さない。最新状態は次回再取得する。旧未追跡タスクptプロンプトの保存可否はまさへ確認中。HANDOFF_pwa_rebuild.mdは別担当なので変更していない。

- 終了時、別担当の資本政策編集3パス（pwa/src/components/cockpit/CapitalPlanWorkspace.tsx、pwa/src/lib/capital-plan.ts、pwa/src/lib/capital-plan-issue-action.ts）が残る。内容は未変更・未stage。所有者は資本政策担当、担当のcommit/push後に再判定。引き継ぎ文書は16663fbeでpush済み。
終了判定: do not archive。旧未追跡資料の判断と、別担当の作業中差分の解消後に再判定。新規worktree/branchなし。
