SOLのDD表示改善を引き継ぐ。資料・素材は /Users/masa/projects/AMD/SOL、コードを変更する正規cwdは /Users/masa/projects/AMD/amd-os。仕事種別は開発。

読む順：
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md と HANDOFF_DD_LAYOUT_20261007.md
4. pwa/manual/1-1-intro.md、pwa/spec/1-3-reconstruction-coverage-audit.md、pwa/spec/3-23-project-format-current-spec.md、pwa/spec/2-7-ui-design-code-current-spec.md、pwa/spec/5-17-dd-package-current-spec.md
5. pwa/BUGS.md、pwa/manual/2-3-pj-cockpit.md、ios/DESIGN.md。開発履歴はpwa/design_log/sessions_2026-10.md。他案件はHANDOFF_ACCESS_LOGIN_20261007.mdを参照。

状態：
組織図はNewCoの会議体・代表者・部署を囲み、協業先3者を下段横一列、技術開発部との両矢印で接続。約684px幅、520px以下のみ折り返す。UIは見やすさ→情報密度→美しさの順で、空き横幅を埋める設計をしない。
共通フェーズマトリクスは17項目を全フェーズで同じ行へ揃え、目標と主要活動を初期表示。行の矢印で全フェーズの作業詳細を同時開閉。元の66活動・20移行条件、期間・予算・成熟度を保持。「到達指標」は「フェーズ」へ変更し、自明な計画値の注記を削除。生産量は未定、社員数は体制人数と区別する。
実装1e5dc53fはmainへ保存・送信済み。本番v3.161.15は同SHAでReadyを確認し、認証済みChromeで17行・20条件・詳細開閉・フェーズ移動まで検証。型/静的/標準フォーマット/画面契約/専用網羅・Excel検査とDB照合が成功。SQL485は適用済み。終了時の追加commitは文書のみなので、最新HEADはfetch後の履歴で確認する。
素材・検証はSOL/work/amie_org_layout_20261007/、amie_phase_matrix_20261007/、amie_phase_topics_20261007/、棚卸しはamie_dd_layout_closeout_20261007/INVENTORY.md。登録正本はOSのpwa/scripts/data/sol-phase-comparison-20261007.json、migration485。iOS/macOS同表UIは今回未変更。

次の行動：
まさが最終表示を受け入れ済みで、今回の残件はない。新しい依頼を受けてから対象を決める。17項目を作り直したり、SQLを再適用したり、未記載の生産量・社員数・金額を推定して埋めたりしない。追加修正では現行DD画面と登録値を先に照合し、指定箇所だけ進める。

運用：
着手前にgit fetch、HEAD/origin/main、未保存差分、配信版を再確認する。main一本、新branch/worktreeを作らず、共有差分をreset/stash/delete/一括保存しない。表示はPJ番号で分けず共通本文・フォーマットを使い、仕様・手引き・附則を同時更新。配布はAMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.shでまとめてpushし、Ready・SHA・実画面まで確認する。文書だけの終了記録は追加の実ビルドを作らない。
旧SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdの扱いは別担当のHANDOFF_ACCESS_LOGIN_20261007.mdとHANDOFF_DD_MINUTES_20261007.mdに従う。現行DD指示として実行しない。今回の成果は未保存0・未push0・新規枝/作業ツリー0で、共有フォルダ全体の整理と今回の完了を分ける。権限・公開範囲・対人通知・資本条件を依頼外に変更しない。
