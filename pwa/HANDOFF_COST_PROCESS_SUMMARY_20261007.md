# 廃液コスト試算の工程サマリ

2026-10-07追加、10-08改訂。DDのコスト試算を、培養からカートリッジ配送・設置・処理・回収・返送後処理まで8工程で見せる。工程ごとの箱を置かず、共有の床と立体設備、連続する一本のラインにした。広い画面は4列×2段（上段右向き、下段左向き）、狭い画面は2列×4段で交互に折り返す。共通の廃液画面 `CockpitCostModel` の上端に実装した。

正本は `spec/5-13-project-cost-model-current-spec.md`、使い方は `manual/2-3-pj-cockpit.md`。工程への集計は `src/lib/cost-process-summary.ts`、UIは `src/components/cockpit/CostProcessSummary.tsx` / `CostProcessAnimation.tsx` / `CostProcessConnectors.tsx` / CSS module。経路はResizeObserverで設備位置に追従する。設備PNGと生成記録は `public/illustrations/cost-process-atlas-20261007.png` / `design/cost-process-visual-asset-20261007.md`。

既存の計算エンジンと初期選択を維持し、選択中の条件・試算入力から各源泉明細を一度ずつ集計する。往復移動④、搬入・搬出⑤、培養・濃縮①、保管・輸送設備③は元明細が合算なので恣意的に分割しない。サマリ合計はSOLと顧客の登録済み原価で、売価・利益を含まない。顧客が持つリアクター以外の汚泥処分・分析も含める。充填設備・工数、洗浄費等の未計上・未確定を表示する。今後その費用を確定するには、源泉の明細・作業を登録してから同じ集計へ乗せる。工程の動きは模式図で、再使用が成立するとは断定しない。

検証：既存コスト・燃料・汎用コスト・DDの契約テスト、96シナリオの源泉原価との一致、TypeScript。Chromeで1366×768 / 768×1024 / 390×844の配置、入力変更、直接投入／循環、金属／色素、オフサイト、明細展開とフォーカス、停止を確認。確認用ページはローカルでのみ使用し、削除済み。DB変更なし。ネイティブ専用画面は未移植。

本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。反映後に `/dd/sol?tab=cost-model` と `/api/build-info` を確認する。
