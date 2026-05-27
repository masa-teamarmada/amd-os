# PWA Feature Registry

AMD OS PWA の重要機能を、画面単位で「消してはいけない契約」として列挙する。

このファイルは実装の詳細仕様ではなく、回帰防止用の登録簿。画面・API・DBのいずれかから機能を削る場合は、同じ commit でこの登録を更新し、理由を残す。未更新のまま UI を削除しない。

## 運用ルール

- 新しい業務導線を追加したら、このファイルか該当 `pwa/design/*.md` に機能契約を残す。
- `design_log/` は作業ログであり正本ではない。恒久仕様は `pwa/design/` 配下へ入れる。
- `npm run test:critical-ui` は、この登録簿と実装内の重要 anchor を検査する。
- 重要 UI を置き換える場合は、旧 anchor を消す前に新 UI の anchor と仕様を登録する。

## /admin/payouts

目的: 支払月単位で、対象cycleの報酬確認、PJ別収支確認、支払データ保存、支払通知書発行、入金確認nudgeを一画面で運用する。

必須機能:

- 支払月選択: `ym=YYYYMM` で対象月を選び、`billing_cycles.invoice_ym` を優先する。未設定cycleは `/admin/projects` の `projects.payment_due_rule` から支払月を判定する。
- 高速初期表示: 通常GETは `billing_cycles.reward_summary_json` の報酬キャッシュを読むだけにする。毎回 `syncRewardSummariesForBillingCycles()` を再計算しない。
- 報酬キャッシュ再計算: 明示的な「報酬キャッシュ再計算」操作または保存系処理だけが `refreshRewards=1` / `refreshRewards: true` で再計算する。
- MSなしPJ 強制報酬確定: MSが未設定または月次MSが空のPJでも、admin確認済みの例外支払は `admin_manual_payout` として明示保存し、通常のMS報酬計算と混ざらないようにする。
- 報酬キャッシュ日次更新: `payout-reward-cache-refresh` cron が毎日03:05 JSTに、前月・当月・翌月の支払月について `billing_cycles.reward_summary_json` を再生成する。
- 縦型PJ収支表: 「全体収支」列とPJ列を並べ、クライアント支払、バッファ、PJ予算、支払予定、役員分、役員相殺、最終収支、メンバー別支払を確認できる。
- 後追いPJ予算確定: 契約や支払額が後から確定したPJは、支払月画面から確定委託料とバッファを入れ、対象稼働月の `billing_cycles.budget_yen` / `budget_reported_amount` / `budget_buffer_amount` へ配分する。
- 支払データ保存: `monthly_reward_payout` に明細、`payout_notices.total_yen` にメンバー別通知額を保存する。役員または `exclude_from_payout_notice` のメンバーは通知対象外にする。
- 支払通知書発行: 「メンバー別支払」行に `支払通知書発行` / `PDF確認` / `送付` の3操作を置く。`PDF確認` は支払データ確定前でも改善版フォーマットの確認用PDFを生成して開くが、`payout_notices` には保存しない。正式な `支払通知書発行` は `monthly_reward_payout` 保存後に活性化し、`payout_notices.notice_no` / `pdf_url` を保存する。`送付` はPDF保存後に `sent_at` を保存する。PDF URLの手入力欄は置かない。
- 支払通知書PDFフォーマット: 正本は `gas/064_PayoutFreeeNotice.js` の `payoutBuildNoticePdfBlob_`。2026-04改善版の白地・青アクセント・正本ロゴ画像フォーマットを維持する。必須要素は、中央青見出し `支払通知書`、青ライン、右上の `支払通知日` / `通知書番号`、公式ロゴ画像 (`PAYOUT_LOGO_FILE_ID` / `PAYOUT_LOGOTYPE_FILE_ID`)、「お支払金額」サマリbox、青ヘッダ明細表 (`摘要` / `数量` / `単価` / `金額`)、右寄せ合計 (`小計（税抜）` / `消費税（10%）` / `合計（税込）`)、`支払予定日` / `支払方法` / `振込先` / `備考`。旧GASの黒罫線フォーマット、テキストで作った `team ARMADA` ロゴ、PDF URL手入力欄へ戻さない。
- 入金確認nudge: `payment-confirm-nudges` を手動実行でき、Slack DMの `/payment-confirm` とつながる。
- 月次モーダル導線: cycle明細やPJ収支表の稼働月から `CockpitMonthlyModal` を開き、報酬根拠に戻れる。

回帰防止:

- `pwa/scripts/check_pwa_critical_ui.cjs` が `/admin/payouts` の支払通知書PDF確認、報酬キャッシュ、報酬キャッシュ日次cron、縦型PJ収支表、GAS側の改善版支払通知書PDFフォーマット anchor を検査する。
- 支払通知書PDFの golden PNG は `pwa/scripts/__fixtures__/payout_notice_golden.png` (改善版フォーマットの 1 ページ目を PNG 化したもの) を正本とし、`pwa/scripts/__fixtures__/payout_notice_golden.png.sha256` に SHA256 を固定する。`npm run test:critical-ui` が golden の存在と SHA256 一致を検査し、 fixture が壊れていれば落ちる。
- 改善版PDFを意図的に更新したら、まさが新PNGを目視確認したうえで `payout_notice_golden.png` と `payout_notice_golden.png.sha256` を再生成して commit する。新規 PDF を PNG 化したファイルとの突合は `npm run test:payout-notice-pdf -- --diff <input.png>` で同じスクリプトを再利用する。
- この画面で UI を削る変更は、`FEATURE_REGISTRY.md` と `SPEC_pwa.md` を同時に更新する。

## /project/[projectId]/cockpit

目的: PJの現在地、MS進捗、経営・事業シグナル、月次ルーティン、TODO/nudgeを一画面で見る。

必須機能:

- レイアウト: `max-w-[1600px]` の幅広 container、上 Header → hero (PJ Status) → 3 カラム grid (`今期MS / 経営・事業シグナル / 月次ルーティン (sticky)`) → 下段 2 カラム (`月次カード / 休止期間 + MTGサマリ`) → 最下段全幅カンバンの 案C 構成。`max-w-[1060px]` + 左 720 / 右 220 の旧 2 カラムには戻さない。
- 上 hero: PJ ごとに出し分け。p00 (= AMD 会社全体) は `CockpitManagementScoreHero` で AMD Management Score の時系列折れ線 + 最新値カード。SU 系 PJ は `CockpitVentureStatus` 内で AMD Score 折れ線と XRL 折れ線を `xl:flex-row` で横並びにする。`xl` 未満では縦並びへ自動 fallback する。
- 今期MSリスト: `CockpitGoalsCompact` / `MilestoneGanttChart` でMS期間、pt、担当、sub itemを表示する。
- 経営・事業シグナル: MSリスト横の col2 として `CockpitStrategySignals` を表示し、`project_strategy_signals` の candidate/confirmed を日付・type・impact・summary・source refs付きで表示する。
- 月次モーダル: 月次カードやroutine stepから `CockpitMonthlyModal` を開き、report / reward / invoice を確認できる。p00 (= AMD 会社全体) でも他 PJ と同じく月次カード + 月次モーダルが出る (`billing_cycles` を 12 行 backfill 済)。
- 月次ルーティン: active/sales PJのみ表示し、PM/admin以外は読み取り専用にする。col3 内で `lg:sticky` で固定する。
- MTGサマリ: `CockpitMeetingSummary` 各行に source link (Notion / Slack / Drive / Gmail / Calendar event の元データへ直リンク) を `元 ↗` の形で出す。`dialogue:*` で始まる meeting_id は「まさ×えいみ」チップ付きで識別し、`CockpitMeetingDetailModal` でラベルを「2人で出した提案 (チームへの相談)」に置き換える (= 「決まったこと」と書かない)。dialogue meeting は `narrative_md` があれば 1 本の Markdown narrative として表示し、raw decided/progress/next_actions/risks は折りたたみ「元データ」として残す。`narrative_md` は `POST /api/dialogue-meeting/narrate` で生成する。各 TopicList の項目は border-l フレーム枠ではなく、`<ul>` + 太字 / マーカー / 見出しの強弱で読ませる。
- MTG添付資料: `CockpitMeetingDetailModal` には `MeetingAssetsPanel` を置き、画像/PDFの選択、ドラッグ&ドロップ、クリップボード貼り付け、画面キャプチャを `meeting_assets` + private Storage `meeting-assets` に保存する。`/api/meeting-assets/insert-markdown` は添付を `narrative_md` の `<!-- meeting-assets:start -->` セクションとして差し込み、画像は `/api/meeting-assets/file/[assetId]` 経由でadminだけが短期signed URLにアクセスできる。

回帰防止:

- `pwa/scripts/check_pwa_critical_ui.cjs` が `経営・事業シグナル`、`CockpitStrategySignals`、`project_strategy_signals`、`project_strategy_signal` の anchor を検査する。
- 案C レイアウト anchor (`max-w-[1600px]`、`lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_300px]`、`xl:flex-row` Hero) も `check_pwa_critical_ui.cjs` で検査する。`max-w-[1060px]` や旧 left/right 2 カラム構造に巻き戻ったら `npm run test:critical-ui` で落ちる。
