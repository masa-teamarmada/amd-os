SOLのDD表示改善・生産量補完を引き継ぐ。仕事種別は開発。コードの正規cwdは /Users/masa/projects/AMD/amd-os、素材は /Users/masa/projects/AMD/SOL。

読む順：
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md、HANDOFF_DD_LAYOUT_20261007.md
4. pwa/manual/1-1-intro.md、pwa/spec/3-23-project-format-current-spec.md、pwa/spec/2-7-ui-design-code-current-spec.md
5. pwa/BUGS.md、pwa/manual/2-3-pj-cockpit.md、ios/DESIGN.md
6. /Users/masa/projects/AMD/SOL/LONG_TERM_PLAN.md、work/amie_phase_production_20261007/VERIFICATION.md。開発履歴はOSのpwa/design_log/sessions_2026-10.md。他案件はHANDOFF_DD_MINUTES_20261007.mdとHANDOFF_ACCESS_LOGIN_20261007.md。

状態：
組織図はNewCoを囲み、協業先3者を下段横一列と両矢印で接続。必要な幅を使い、見やすさ→情報密度→美しさを優先する。フェーズマトリクスは17共通行、66活動・20条件を保持し、詳細を行単位で同時開閉。「到達指標」は「フェーズ」へ改名、自明な計画値注記を削除。
生産量5セルは、登録長期計画v0.5（9ff624dc-8abd-4cad-8073-4de4b6078bed）に沿って補完。フェーズ0はラボ再現性と菌体量測定、1は2027/9の3ロット・必要量確認と10月から顧客別使用量記録、2は2029/6必要量算定と2030/7〜12量産供給評価、3は旧設備供給を継続し2033/3までに新設備認定、4は認定能力内の供給と2033/4〜2034/3の12か月評価。菌体の年産重量は未確定。排水処理量を生産重量へ転記しない。
実装は1e5dc53f、生産量補完は62d1c322でmainへ送信済み。SQL485・486は適用済み。本番の生産量5セルとDBを確認し、変更は5キーだけ。型・静的・既存契約・66活動・Excel保持、通常幅と390pxの表示確認済み。生産量補完はDB登録のみで再ビルド不要。終了文書の最新commitはgit履歴で確認する。
素材・検証はSOL/work/amie_org_layout_20261007/、amie_phase_matrix_20261007/、amie_phase_topics_20261007/、amie_phase_production_20261007/。最新根拠はOSのpwa/scripts/data/sol-phase-production-20261007.json、SQL486。before/after/expectedと原資料照合はproductionフォルダに保存。iOS/macOSの同表UIは今回未変更。

次の行動：
まさ受入済みで今回の残件なし。新しい依頼から対象を決める。17項目や適用済みSQLを作り直さず、未記載の重量・社員数・金額を推定しない。生産量の数量化を頼まれたら、顧客別需要、菌体必要量、実生産性、歩留まり、稼働、供給頻度と重量基準を照合してから決める。長期計画・コスト精査は別担当の正本を読む。

運用：
着手前にgit fetch、HEAD/origin/main、未保存差分、本番配信版と登録値を確認。main一本、新branch/worktree禁止。共有差分をreset/stash/delete/一括保存しない。表示は共通フォーマットを使い、必要な仕様・マニュアル・附則を同時更新。生産量補完の手引き更新は対象外：既存登録内容のみで操作変更なし。
アプリ反映はAMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.shでまとめ、Ready・SHA・実画面を確認。DBは記録した限定SQLと読戻しで確認。今回の検証タブは終了し、新規枝/作業ツリーなし。別担当の旧移行文は復元用の控えで、現行指示へ戻さない。権限・公開範囲・対人通知・資本条件を依頼外に変更しない。
