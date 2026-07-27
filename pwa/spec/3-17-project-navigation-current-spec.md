# 成立条件ナビゲーション画面 仕様

> **目的**: 週次会議直前のCOO/PMが、数秒でPJ全体の状況・遅延・クリティカルパス・関係先のボール・次の介入を掴む。計画の再作成や論点の逐次編集を扱う画面ではない（それは `/workspace` と `/weekly-control` の役割）。

## 正本境界

- 新画面は `/project/[projectId]/navigation`。
- 既存の `/project/[projectId]/workspace`（統合ワークスペース）・`/project/[projectId]/weekly-control`（週次管制）は変更・置換しない。UIファイルも流用しない — `src/components/project-navigation/` に完全独立した視覚コンポーネントを持つ。
- データ正本は既存の `sxManagement`（`getSxManagementBundle` / `SxManagementBundle`）。DB migration・API追加はしない。
- DBにない予定日・成立条件は捏造しない。日付不足やDAG不成立は「未評価」「日付未設定」「接続余白未算定」等で明示する。

## Route / Auth / RSC境界

| 項目 | contract |
|---|---|
| page | `src/app/(app)/project/[projectId]/navigation/page.tsx` |
| view | `SxNavigationDashboard`（`src/components/project-navigation/SxNavigationDashboard.tsx`） |
| auth | `getCurrentMemberAccess()`。未ログインは同URLを `next` に保持してloginへ送る |
| PJ境界 | `getProjectWorkspaceBundle(projectId, access)` と `projectScopedPathAllowed()`。PJ限定ユーザーは所属PJだけ閲覧可 |
| データ有無 | `bundle.sxManagement.hasData` が false なら `notFound()`。特定PJ IDのハードコードはしない |
| shell | `/workspace` `/weekly-control` と同じ埋め込みshell。月初合意overlayの対象外 |
| 導出層 | `src/lib/sx-navigation.ts`（server-only import なし・型のみ借用のplain module。テスト用nodeスクリプトからも安全に読める） |

### RSC最小化（重要）

`page.tsx` は `ProjectWorkspaceBundle` / `CurrentMemberAccess` をそのまま Client Component へ渡さない。`sx-navigation.ts` の `buildSxNavigationViewModel({ project, sxManagement })` が唯一の窓口で、画面が必要とする最小フィールドだけを持つ `SxNavigationViewModel` を組み立てて渡す。

- `SxNavigationDashboard` は `@/lib/sx-navigation` 以外（`@/lib/project-workspace` / `@/lib/sx-management`）を **type-onlyでもimportしない**。
- `SxNavigationViewModel` に含めるもの: `projectId` / `projectName` / `asOf` / `hasData` / `dataIssues` / `headline` / `timelineScale`(関数を持たないserializable版・軸目盛り事前計算済み) / `nodes` / `edges` / `criticalPath` / `partners` / `constraintFlags` / `pendingDecisions`(id/title/dueDate/ownerLabel/isThisWeekのみ) / `recentChanges`。
- 含めないもの: `sourceRef`、メンバー名簿・email、工数(`effort`)、`evidenceBySource`、契約・報酬、意思決定の `context`/`rationale`/`decisionText`、直近変化の更新者(`changedBy`)。
- `NavTimelineScale`（内部計算用、`pct` 関数を持つ）と `NavTimelineScaleView`（画面へ渡すserializable版、`axisTicks` 事前計算済み）を区別する。関数をpropsやRSC payloadへ絶対に混ぜない。

## 画面構成

1. **小さなヘッダ**: PJ名、基準日、主要警告表示（`未確認・更新切れN件` / `主要警告0件`）、`/workspace` `/weekly-control` への副導線。警告0件を台帳全体の整合済みとは断定しない。
2. **一目判定帯**: 予定内/要介入/判定不能（`SxJudgment.key` の3値集約: `on_track→予定内`、`attention・crisis→要介入`、`unassessed→判定不能`）＋最終ゲート＋次の期限＋最大ボトルネック＋**予測差分（対計画）**＋判断待ち件数を、単一の読み上げ帯（KPIカードの寄せ集めにしない）で表示する。
   - **予測差分は判定信頼度と独立した軸**。全マイルストーンが `unassessed`（判定不能）でも、`plannedEnd`→`forecastEnd` の乖離だけは `forecastComparableCount` / `forecastSlipCount` / `maxForecastSlipDays` / `maxForecastSlipTitle` として別集計し、「判定不能だから遅延も分からない」という見落としを防ぐ。比較可能な日付が0件なら「予測遅延なし」と断定せず「予測差分未算定」とする。
3. **依存航路（全体依存ガント）**: `sxManagement.milestones` と `dependencies` / `judgment.criticalPathSlugs` を正本にする。
   - 節点は基準計画(`baselineSegment` = plannedStart〜plannedEnd)・完了帯(`completeSegment`)・**予測延伸**(`slipSegment` = plannedEnd〜forecastEnd、計画を超えて延びた分だけを独立レイヤーで可視化。`+N日` ラベルと `aria-label` を持つ)・**前倒し**(`pulledInDays`、forecastEndが計画より早い場合の日数、延伸と別扱いで小さいマーカーのみ)を区別する。
   - 依存線は重要経路(実線・太・green)と前提のつながり(破線・細・quiet)を区別。track はレーン分類として控えめに使う（色チップのみ、大きなカード化はしない）。
   - 横スクロールはガント内部（`ganttScrollOuter`）だけ。ラベル列は別カラムで固定し、ページ全体は横溢れしない。
   - 日付不足の節点は線を捏造せず「日程未設定」と表示する。
4. **クリティカルパス**: 順序・次に詰まる節点・遅延理由・次工程との接続余白。連続する重要経路ノード間の接続余白（次ノードのplannedStart − 自ノードのforecastEnd − lag）が算出できる時だけ日数を出す。これはCPMの総余裕とは呼ばない。算出不能なら「接続余白未算定」、DAG不成立時は数値を一切出さず「DAG不成立」と明示する。
5. **関係先リスト（全件表示・検索・役割グルーピング）**:
   - 表示順序は **識別 → 完了済み/直近接点 → 現在（関係段階・ボール） → 次の受け渡し → 期限・目標**。
   - **完了済みとinteractionsを混同しない**: `completedSteps` は完了済み commitment/workItem だけから構成する。直近のやり取り(`latestInteraction`)は別フィールドとして常に独立表示し、完了扱いに混ぜない。
   - **役割グルーピングは捏造しない**: primary role（`partner.roles` の `isPrimary`、無ければ先頭）があれば `roleKind × relationshipState` の構造化ラベルでグルーピングする。primary roleが無い場合、自由記述の `roleLabel` に「PoC候補」「PoC接触」が明記されている時だけ `PoC候補・接触（表示ラベル由来）` とし、由来が表示ラベルであることを明示する。それ以外は正式分類を作らず「役割未分類」とする（`groupKind`: `structured_role` / `display_label_poc` / `unclassified`）。
   - **現在状態にrelationship stageを含める**: `currentStateLabel` は関係段階(`候補`〜`実行中`〜`保留`)とボール(`当方`/`先方`/`共同`/`未確認`)を合成する。合意状態(`agreementState`)はDB値をそのまま表示し、段階から逆算・推測しない。
   - デフォルトで全件表示（56件規模でも省略しない）。役割グループ見出し＋件数、検索input（名称・役割・分類で絞り込み）を持つ。行は最小44pxのタップ領域。
   - 当方がボールを持つ行は左に赤罫線で強調し、優先度の高い順（保留でない ＞ 当方ボール ＞ 期限順）に並べる。
6. **制約ボード**: `capacity` / `organizationRoles` / `fundingSnapshots` / `technicalTests` から研究開発人員・資金・技術証明の制約を可視化。データが無ければ `unknown`、根拠なしの順位付けはしない（カテゴリ間の優劣は付けない）。
7. **判断待ちと直近変化**: `decisions`（open のみ、`id`/`title`/`dueDate`/`ownerLabel`/`isThisWeek` の最小フィールド）と `history`/`actions`（完了分）を同一面で確認する。

## レスポンシブ

- desktop 1440x900: ガントが画面の主役。
- tablet 768x1024: 関係先リストは1100px未満で1カラムのカード表示へ切り替え、意図した縦積みにする。
- mobile 390x844: 判定帯→ガント（内部横スクロール、ラベル列は別カラムで固定）→クリティカルパス→関係先カード（1カラム）の順。タップ領域44px以上。
- `prefers-reduced-motion` 時はtransition/scroll-behaviorを無効化する。すべての選択・強調はaria属性/文言でも判別でき、hover専用の情報は無い。キーボード操作（Tab + Enter/Space）で節点・関係先の選択・相互強調ができる。

## 視覚言語

- 独自のCSS変数（`navigation.module.css`）: オフホワイト/ラボ白・ステンレス灰・藻類の深緑・水の青緑を基調にし、注意は鈍い琥珀、遅延は酸化赤、未確認は灰青。グラデーション・大きい影は使わない。境界線と面差中心。
- `<button>` ベースの節点/関係先行は `appearance: none` で明示リセットし、`text-align: left` を明示する。日付・数値は `font-variant-numeric: tabular-nums` を継承する。

## 検証

- `npm run test:sx-navigation`（`scripts/test_sx_navigation.mjs`）: 判定・タイムライン・節点(基準計画/予測延伸/前倒しの分離)・依存線・クリティカルパス・関係先(完了/直近接点の分離・役割グルーピングの捏造禁止)・制約ボード・pending decisionの最小フィールド化・view modelのserializable性（`JSON.stringify` 可能・`sourceRef` 非含有）を検査する。
- `npm run test:critical-ui`（`scripts/check_pwa_critical_ui.cjs`）: route/component/access/title/shellのanchorを検査する。
