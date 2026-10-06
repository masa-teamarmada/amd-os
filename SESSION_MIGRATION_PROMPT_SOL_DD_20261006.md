SOLのDDコンテンツ整備を引き継いで。作業場所は /Users/masa/projects/AMD/amd-os、調査・資料の保存先は /Users/masa/projects/AMD/SOL。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. リポジトリとpwaのAGENTS.md、pwa/HANDOFF_dd_spaces.md
4. /Users/masa/projects/AMD/SOL/SOL_DD_CONTENTS_PLAN.md、pwa/spec/5-17-dd-package-current-spec.md、pwa/spec/3-24-project-surface-pages-current-spec.md
5. pwa/BUGS.md、pwa/manual/2-3-pj-cockpit.md、pwa/manual/2-6-admin-ops.md

現在地:
- 調査と実装の混合作業。一般的なDDの確認領域・証憑不足はSOL_DD_CONTENTS_PLAN.mdに保存。初版素材はSOL/work/260930_dd_packageのSOURCE_RECONCILIATION.md、final/証憑一覧.csv、final/SolvioraX_DD資料_要点_v0.1.6_20260930.md。過去の不足評価は10月5日時点で、現在の収録状況は再確認する。
- DD各項目の器とフラットメニューを整備。別セッションが資料単位へ分割し、現行ナビは32項目。現行spec3-24を優先する。同一ページは全スペースで本文共通。キラー要素はコックピット専用の独立ページ。
- 読者は手練のキャピタリスト。高校生向けの説明口調、編集権限・更新日などのメタ情報を本文へ出さない。
- 決議は総会・役会・経営会議それぞれの一覧。未確認の決議は作らない。
- 契約リストはコックピット・ワークスペース・DDに設置。内部2スペースで契約ごとのDD表示チェックを保存。SOLは指定されたいよぎんキャピタルと株式会社チームアルマダのNDA1件のみ。未締結・確認中、DD表示オン。他4件はAMD業務契約なのでSOL一覧対象外、元台帳5件は保持。
- 契約主体または明示採用した関連契約だけを一覧・件数・更新対象にする。関連PJだけで自動採用しない。migration482/483は本番適用済み、再適用しない。
- 修正478f37be/v3.159.17は本番反映済み。型検査・契約route/loader回帰・DD回帰・配信ゲート成功、本番DBと実loaderで内部1/DD1を確認。PCコックピットの一覧・チェック操作と決議3一覧は確認済み。範囲訂正後のワークスペース/DD実画面は未確認。
- 引き継ぎ時の実装HEADと本番はf6a0d3a4/v3.159.23、main/originは一致。後続の引き継ぎ文書commitは本番コード変更なし。固定SHAへ戻さず開始時fetch/status/build-infoを再取得する。
- 旧未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdの内容不変Git保存をまさへ確認中。返答を確認してから処理し、無断削除・stageしない。旧Function StorageプロンプトはSESSION_MIGRATION_PROMPT_FUNCTION_STORAGE_20261006.mdへ原文保存。

- 終了時、別担当の資本政策編集3パス（pwa/src/components/cockpit/CapitalPlanWorkspace.tsx、pwa/src/lib/capital-plan.ts、pwa/src/lib/capital-plan-issue-action.ts）が残る。内容は未変更・未stage。所有者は資本政策担当、担当のcommit/push後に再判定。引き継ぎ文書は16663fbeでpush済み。

次の具体的な作業:
1. 未追跡の旧資料の判断を確認し、終了処理を確定する。
2. PCで3スペースの契約1件・件数・DD表示選択を照合する。スマホWebは検証しない。まさはスマホでSwiftだけを見る指定。
3. DDの各ページと原本を対応付け、技術原データ・反復結果・大学知財/ノウハウ利用条件・顧客別検証段階などの不足を優先して埋める。ページの存在を内容完成と扱わない。コスト試算と月次試算表は別セッションで進行中なので触れない。

運用:
- 共有mainの他担当差分をreset/stash/delete/一括commitしない。変更は現行仕様・マニュアルと同期し、対象パスだけ保存する。
- 開発履歴はpwa/design_log、非開発の調査・事業判断はSOL目的別文書へ保存。HANDOFFは現在地と次の行動に限定する。
- PWA変更はAMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.shで正規配信し、本番SHAを読む。未pushコードがある束に文書だけの[skip ci]判断を適用しない。
- 未合意条件を確定せず、対外公開・閲覧権限追加・メール送信を追加しない。認証や他アプリ操作で詰まった際は未確認範囲を明記する。
