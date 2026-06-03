# 附則（設計書変更履歴）

> **この章は何か**: `/spec` の追加・変更・削除を append-only で記録する変更履歴。設計書は「読めば current OS を再構築できる」粒度を求めるため、仕様変更のたびに必ずここへ追記する。

## 運用ルール

- `/spec` の章を追加・変更・削除したら、同じ commit でこの附則へ 1 行追記する。
- 記録項目は `日時 / 対象章 / 種別 / 変更箇所 / 理由 / 変更者`。
- 削除は、削除元・移植先・まさ承認または明確な移行理由を書く。
- この附則は append-only。過去行を書き換えない。
- manual / bzm の変更は、それぞれ `/manual/9-3-appendix-changelog`、`/bzm/9-5-appendix-changelog` にも記録する。

## 変更履歴

| 日時 | 対象章 | 種別 | 変更箇所 | 理由 | 変更者 |
|---|---|---|---|---|---|
| 2026-05-30 | 1-1 / 1-2 / 2-1 / 3-1 / 3-2 / 3-3 / 4-1 | 追加 | `/spec` 初期章を追加し、manual / spec / bzm 3層分割、PWA runtime、L2、monthly_reports、meeting flow、FRL CES を移行 | 現行 manual / design に混在していた確定実装仕様を設計書へ分離するため | えいみ |
| 2026-05-31 01:21 JST | 3-4 / 3-5 / 3-6 / 4-2 | 追加 | L2⑦ OS台帳差分、L2⑧ XRL根拠、L2⑨経営ハイライト、AMD Score実装仕様を追加 | L2 ⑦⑧⑨ と AMD Score の current contract を `/spec` へ移し、manual/design の重複を減らすため | えいみ |
| 2026-05-31 01:21 JST | 5-1 / 5-2 / 5-3 / 5-4 / 6-1 | 追加 | ドキュメント統制、開発/デプロイ運用、automation責務分担、判断履歴/事故ログ、設計書附則を追加 | まさ指摘「manual 9章に開発情報が残っている」「設計書だけでOSを再構築できる粒度が必要」「附則がないと勝手に消える事故を防げない」への対応 | えいみ |
| 2026-05-31 01:21 JST | 1-1 / 1-2 / 1-3 / 2-2 / 2-3 / 3-7 / 3-8 / 4-3 | 追加・変更 | 再構築品質バー、カバレッジ監査、PWA surface、Supabase data model、notifications、cockpit、ERS を追加し、移行マップを更新 | 司令塔追加指示「読むだけで current OS を再構築できるか」で監視する前提に合わせ、薄い整理ではなく不足と current truth を明示するため | えいみ |
| 2026-05-31 01:21 JST | 5-5 / 1-3 | 追加・変更 | GAS / iOS 役割境界仕様を追加し、カバレッジ監査の GAS / iOS 判定を `partial` に更新 | 合格条件に iOS 側の役割と GAS automation が含まれていたため、未確認点を明示しつつ現行境界を spec に上げるため | えいみ |
| 2026-05-31 | 3-8 | 変更 | `/project/[projectId]/cockpit` の Hero 下に `進捗管理` / `スコア詳細` タブを追加し、スコア詳細タブは `AmdScoreView embedded` と `/api/project/[projectId]/amd-score-detail` で既存詳細ページ相当の内容を表示する契約を追記 | cockpit に score detail を統合しつつ、AMD Score + XRL hero を常時表示するため | えいみ |
| 2026-05-31 | 3-1 | 追加 | L2⑥ MTGサマリの開催済みソース guard を追加。Calendar添付Gemini notes、Notion eventId空 fallback、report_emails空Gmail fallback、`prep_source_meeting_id`、`npm run test:l6-held-source-guard` を仕様化 | 飯野さんMTG欠落の再発防止を `/spec` だけで再構築できる粒度に上げるため | えいみ |
| 2026-05-31 01:41 JST | 3-8 / 3-9 / 3-10 / 3-11 / 3-12 / 1-3 | 追加・変更 | L2② AMD Protocol、L2③ MS Progress、L2④ Project Knowledge、L2⑤ Member Knowledge の個別 rebuild spec を追加し、Cockpit に routine stepId 全表 / monthly-reward modal / Edge Function bridge を追記。監査表で L2②〜⑤ を `rebuildable` に更新 | 司令塔レビューで L2②③④⑤ と Cockpit detail が partial と指摘されたため、DB/API/UI/automation を再構築できる粒度に上げるため | えいみ |
| 2026-05-31 03:20 JST | 3-13 / 3-1 / 3-7 / 5-3 / 1-3 | 追加・変更 | L2⑩ Textbook Insights 仕様を追加し、L2一覧・通知採否・automation責務・再構築監査へ candidate / approved / local BZM applier の contract を反映 | Before Zero 知見を Supabase 既存L2から候補化し、通知OK後に安全に `pwa/bzm` へ追記する導線を固定するため | えいみ |
| 2026-05-31 | 3-13 | 変更 | L2⑩ を Before Zero 実践テキストに拡張し、`metadata_json.practice_kind` 7分類、`confidentiality`、BZM review gate、`theory_change_scope`、migration未適用境界を追記 | Textbook implementation worker B で metadata / confidentiality / BZM review gate を repo 内に実装するため | えいみ |
| 2026-05-31 | 3-13 / db_schema | 変更 | OS司令塔が migration 116 を本番DBへ緊急適用済みであることを反映し、`textbook_insight_candidates` の metadata / confidentiality / BZM review gate 5カラムを schema dump で同期 | `metadata_json` 未存在による DB/code mismatch 解消後、production schema と docs を一致させるため | えいみ |
| 2026-05-31 | 4-3 / 3-8 | 変更 | ERS NIMSカードから `/institutions/inst_nims/cockpit` へ遷移し、既存CX (`p20`) の `CockpitView` とMTG treeを機関文脈で表示する contract を追記 | 新規NIMS PJを作らず、既存NIMSカードをPJコックピット相当に進化させるため | えいみ |
| 2026-05-31 | 3-8 | 変更 | コックピットの `進捗管理` / `スコア詳細` タブを横幅2等分にし、スコア詳細タブは hidden panel 先読み、client memory cache 5分TTL、private HTTP cache、active時の背景再取得を contract 化 | まさ指摘「スコア詳細タブのローディングに時間がかかる」「2タブしかないので横幅いっぱいを2分割」への対応 | えいみ |
| 2026-05-31 | 5-3 | 追加 | 先手力 heartbeat を L2 ではなく control layer として追加し、`amd-os-proactive-heartbeat` SKILL、helper `heartbeat`、send_message_to_thread 後の `mark-sent` 契約を記載 | `proactive_outbox` の queued/blocked を毎時15分に司令塔へ通知し、通知済みをDBに記録する運用を固定するため | えいみ |
| 2026-05-31 | 3-13 | 変更 | L2⑩ Textbook Insights の `practice_kind` routing を第8部新章へ同期。`decision_branch`→8-2、`failure_learning`→8-3、`relationship_playbook`→8-4、`reusable_question`/`field_transition`→8-5、`cross_project_pattern`→8-1 default、`theory_case`→6-1 + BZM review 前提を明記 | 第8部実践章追加後も helper / SKILL / spec の target routing が食い違わないようにするため | えいみ |
| 2026-05-31 | 2-1 / 3-8 | 変更 | Dashboard と PJ cockpit に `ProactiveQueuePanel` を追加し、`proactive_outbox` を authenticated admin read-only で表示する contract を追記 | 先手力維持ループを通知だけでなくPWA上でも確認できるようにするため | えいみ |
| 2026-05-31 | 3-8 / 4-3 | 変更 | 研究機関コックピットを `概要 + readiness snapshot + 進捗管理/スコア詳細タブ` の基本型へ変更し、MTGツリーを最上部から進捗管理下部へ移動する契約を追記 | NIMSコックピットでMTGツリーが最上部に出ていた違和感を解消し、研究機関でもPJ cockpitに近い情報設計に揃えるため | えいみ |
| 2026-06-01 | 4-4 | 追加 | Management Score会社バイタル分類の本修正案を追加し、`signal_scope` / `applies_to_company_score` / pipeline分類、L2抽出validator、既存signals backfill、snapshot再計算ゲートを整理 | 暫定guard採用後、PJ個別情報をAMD会社バイタルへ混ぜない根本修正の判断材料を固定するため | えいみ |
| 2026-06-01 | 3-6 / 4-4 | 変更 | `project_strategy_signals` に会社バイタル分類列を追加し、L2⑨/applier/API/Management Score raw collector が `applies_to_company_score` と高確度pipelineを扱う契約へ更新。香川大/KUTE/NIMS initial backfill と 202605/202606 再計算結果を追記 | 個別PJ除外だけでなく、香川大のような高確度pipelineを正式根拠に入れ、継続/新規/方向の低さを raw replacement と入力分解で検証できるようにするため | えいみ |
| 2026-06-01 | 3-8 | 変更 | Cockpit MTGサマリに Notion文字起こし CTA と `メモ再読込` を追加。`notion_url` / `source_url` の状態別表示と、PWAからNotion録音開始・Notion page自動作成・DDLをしない境界を contract 化 | MTG前/会議中にカードからNotionメモへ入れるようにしつつ、L6既存処理との責務境界を崩さないため | えいみ |
| 2026-06-01 17:43 JST | 4-2 | 変更 | AMD Score retrofit画面に PRS候補比較レイヤーを追加する契約を追記。`calculatePrsScore()` / `derivePrsComponents()`、P/R_net missing時はscoreを出さない、DB schema未採用、BZM review requiredを明記 | 現行7軸AMD Scoreを壊さず、P x R x S / 9軸候補を比較・シミュレーションとして検証するため | えいみ |
| 2026-06-01 | 2-1 | 追加 | `/admin/private-wiki` と `/api/admin/private-wiki`、`private_wiki_entries` の admin-only contract を追加 | センシティブな人物関係性メモを admin 境界内で扱い、通常cockpitや外部workspaceへ漏らさないため | えいみ-worker |
| 2026-06-01 | 3-8 | 変更 | `ProactiveQueuePanel` をTODO UIへ整理。Dashboardは未送信/要対応だけ最大3件、期限超過・blocked・queuedを優先し、`outbox_id` 重複排除後に優先TODOと一覧へ分ける。詳細モーダルは source / outbox history / artifact refs / 外部送付可否 / PJ導線を表示し、HUD側旧かんばんは主要導線から外す | 先手力UIを通知一覧ではなく、忘れていても再開できるread-only TODO入口にするため | えいみ-worker |
| 2026-06-01 23:45 JST | 3-9 | 変更 | `/admin/protocols` の outcome ledger read UI contract を追記。`protocol_result_observations` は read-only 表示、`evidence_url` / source permalink / prompt / score calibration は非表示、同一horizonの異valenceのみ矛盾chipを出す | 特許retrofit P0として、既存DBを上書きせず append-only結果観測をOS実態として見える化するため | えいみ-worker |
| 2026-06-03 | 3-2 | 追加 | L2① Monthly Reports に「生成対象ガード (writer 共通)」セクションを追加。no-activity (`source_cache` 0件→進捗なしテンプレ、断定しない) / 未来月 (当月JST超は生成しない) / PJ期間外 (start_ym前は不可、end_ym超過は status='ended'時のみ除外) の3ガードと、active PJ の end_ym 古残り例外 (LST p07)、既存row対象外・個別cleanup方針を contract 化 | billing_cycles の請求ライフサイクルに引きずられ、未来月・終了後PJ・活動ゼロ月の月報を LLM が捏造する事故 (raw-route-zero通知の根本原因) を再発防止し、設計を spec 正本に残すため | えいみ |
| 2026-06-03 | 3-2 | 変更 | L2① 月次サマリ生成ガードを「進捗ベース」正本原則に書き直し (まさ確定)。状態でなく実進捗 (source_cache/MTGサマリ/member_activities の3経路) で生成可否を決める: 進捗あり→状態問わず生成、進捗なし&active→進捗なしテンプレ、進捗なし&ended/frozen→生成しない。frozen は status='frozen' or freeze_from_ym≤当月。end_ymで機械的に切る旧ガードは撤廃 (active は end_ym 古残りあり=LST p07)。L2⑥ MTGサマリにも同原則適用と明記 | end_ym切りだとactive継続中PJ(LST)の月報を誤除外し、ended PJ(BWE)の進捗ある月まで消す誤判定が出たため、状態でなく進捗で切る正本に修正 | えいみ |
| 2026-06-03 | 3-3 | 追加 | L2⑥ MTGサマリにも進捗ベース生成ガードを追加。開催済み実MTGは状態問わず記録、未来の予定prep は ended/frozen PJ に自動生成しない。calendar-sync(既存) / meeting-prep / meeting-workflow finalize にガード、dialogue-meeting は人の意図記録なので非ガード。frozen=status='frozen' or freeze_from_ym<=ym | 月次サマリと同じ原則をMTGサマリにも揃え、終了/凍結PJに未来MTG prep が湧くのを止めるため(BWE p11 で発覚) | えいみ |
