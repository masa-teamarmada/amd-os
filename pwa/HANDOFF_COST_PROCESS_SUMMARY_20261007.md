# 廃液コスト試算の工程サマリ

2026-10-07追加、10-08改訂。培養から配送・設置・処理・回収・返送後処理まで8設備を、一枚のつながった工場の絵に収める。トラック、コンベヤー上の容器、充填・設置・回収の3本のロボットアーム本体を動かす。幅950px以上では絵の上側①〜④・下側⑧〜⑤へ費用を重ねる。狭い画面では一枚の絵に設備番号を添え、その下に費用を2列で表示する。工程サマリは廃液画面の最上部、総額採算はその下にある。

正本は `spec/5-13-project-cost-model-current-spec.md`、使い方は `manual/2-3-pj-cockpit.md`。集計は `src/lib/cost-process-summary.ts`、UIは `src/components/cockpit/CostProcessSummary.tsx` / `CostProcessAnimation.tsx` / CSS module。背景PNGと透明な動作部品PNGを同じ1536×1024座標へ重ねる。画像は `public/illustrations/cost-process-factory-background-20261008.png` / `cost-process-factory-moving-parts-20261008.png`、生成記録は `design/cost-process-factory-asset-20261008.md`。

既存の計算エンジンと初期選択を維持し、選択中の条件・試算入力から各源泉明細を一度ずつ集計する。往復移動④、搬入・搬出⑤、培養・濃縮①、保管・輸送設備③は元明細が合算なので恣意的に分割しない。合計はSOLと顧客の登録済み原価で、売価・利益を含まない。顧客の汚泥処分・分析も含める。充填設備・工数、洗浄費等の未計上・未確定を表示する。今後確定するには源泉の明細・作業を登録してから同じ集計へ乗せる。絵の設備・搬送容器・動きは共通の模式図で、実設備形状・再使用の成立は断定しない。停止・動きを減らす設定は設備本体を含む全動作に効く。

集計の回帰検証は `scripts/check_cost_process_summary.mts` の96シナリオと既存コスト・燃料・汎用・DD契約検査、TypeScriptを通過。Chromeの390px・768px・通常幅で横はみ出しなし。トラック・3本のアーム・上下ラインの容器が時刻に応じて位置を変え、停止後は全変形が固定、再開で動作を再開することを確認。工程内訳の表示と見出しへのフォーカス、閉じた後の工程へのフォーカス復帰、循環カートリッジへの切替による工程名・金額更新も確認。今回の表示改訂で計算エンジン・DB・保存権限の変更なし。ネイティブ専用画面は未移植。ローカル確認用ページは削除済み。

本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。反映後に `/dd/sol?tab=cost-model` と `/api/build-info` を確認する。
