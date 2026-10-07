# DD表示改善の引き継ぎ

最終更新：2026-10-07 JST。作業種別：開発。まさが最終表示を受け入れ済み。

## 現在地

- 組織図は約684px幅。会議体・代表者・部署をNewCo枠内、協業先3者を枠外下段の横一列に配置。技術開発部との両矢印を保持。520px以下のみ折り返す。
- 共通フェーズマトリクスは17比較行。元の66活動・20出口条件を保持し、行の矢印で全フェーズの詳細を同時開閉。上の5フェーズ図と成熟度バー、期間・予算を保持。
- 到達指標をフェーズへ改名。計画値に関する自明な注記を除去。生産量は未定、社員数は体制人数と区別。元の事業条件は新しく決めていない。
- UI優先順位は見やすさ→情報密度→美しさ。空き横幅を埋めるために図・表を引き伸ばさない。共通ルール・画面設計正本へ記録済み。

## 保存・検証

正規Git：/Users/masa/projects/AMD/amd-os、main。確認時HEAD/origin/mainは6f024687、ahead/behind各0。実装1e5dc53fはmain祖先、本番v3.161.15はそのSHAに一致。後続は終了記録のみ。本引き継ぎの保存commitはGit履歴で確認する。
SQL485は適用済み。DBの追加キーを外すと元の全フェーズと一致する。型・静的検査、標準フォーマット、画面契約、必須配布検査、66活動の網羅と旧データ/Excel保持の専用検査が成功。通常Chrome幅と390×844を目視確認。本番DDで17行・20条件・注記削除・詳細開閉・フェーズ4移動を確認。iOS/macOSネイティブの同表UIは未変更。

## 未完了・最初の次の行動

今回の依頼の残件はなし。まさの次の依頼を受けてから対象を絞る。未記載の定量目標を勝手に決めず、適用済みSQLを再実行しない。再開前にfetch、状態、配信版を再確認する。

## 所有権と終了状態

今回の未保存差分・未push・競合0。新規枝/作業ツリー0、既存ローカル枝はmainのみ。検証タブ・サーバー停止、一時配布cloneは復元可能なゴミ箱へ保全済み。
終了処理中、別担当のDD議事録修正文書が更新された。BUGS/design_logの別担当追記は保存担当へ残し、今回分のみ選択してcommit。所有者：DD議事録担当。処置：同担当が保存・送信、次判定：その終了時のgit状態。旧移行文は同担当が回復可能に保管済み（HANDOFF_DD_MINUTES_20261007.md参照）。共有checkoutはdo not archive、今回の作業はcommitted success / main aligned。
会話の検討材料: 0件。製品UI規則を個人特性の材料にしない。

## 読む資料

- pwa/spec/3-23-project-format-current-spec.md：17行・JSON・共通表示の仕様。
- pwa/spec/2-7-ui-design-code-current-spec.md：幅と優先順位。
- pwa/manual/2-3-pj-cockpit.md、manual/9-3：使い方・履歴。新章なし。
- pwa/spec/5-17-dd-package-current-spec.md、ios/DESIGN.md：DD・他プラットフォーム境界。
- pwa/BUGS.md：過剰幅・独立箇条書き・固定項目の不足の再発防止。
- pwa/design_log/sessions_2026-10.md：開発履歴。事業戦略は今回未変更。
- SOL/work/amie_org_layout_20261007/DEPLOY_BUNDLE.md、amie_phase_matrix_20261007/VERIFICATION.md・VERIFICATION_VISUAL.md、amie_phase_topics_20261007/STATUS.md・before.json・after.json・deploy.log：検証・素材。
- SOL/work/amie_dd_layout_closeout_20261007/INVENTORY.md：全成果物と記録先の棚卸し。
