# BZM Commander Tasks

Last updated: 2026-06-04
Owner: BZM司令塔
Scope: Before Zero Model / BZM theory / Textbook theory gate / L2⑩ Textbook Insights theory review

このファイルは、BZM司令塔が抱えているタスクの台帳。
まさがここを開けば、コードやworker報告を読まなくても「何を頼んだか / なぜ頼んだか / 今どうなっているか / 何が残っているか」が分かる状態にする。

## 運用ルール

- タスク追加、方針変更、worker切り出し、完了報告、差し戻し、archive のたびに更新する。
- worker報告をそのまま貼らず、BZM司令塔がまさ向けに要約し直す。
- まず `未完タスク（優先順位順）`、その下に `完了済みタスク` を置く。
- 未完タスクの `現状` には `Active` / `Watch` / `Blocked by Masa` のどれかを必ず入れる。
- worker quiet modeを採用する。workerは原則として親司令塔チャットへ進捗・中間報告・自己判断の完了報告を送らない。
- workerが親司令塔へ送るのは、worker thread内でまさが「完全に完了」「OK」「これでよし」等と明示した後の最終closeout 1回だけにする。
- 例外は `UU` conflict、未分類dirty、権限/破壊的操作/外部判断、同じblocking conditionで進行不能など、司令塔側の介入が必要な場合のみ。その場合も短いblocker/handoffを1回だけ送る。
- BZM司令塔は、worker報告で親チャットを流さず、必要ならheartbeat / read_thread / 定期確認で静かに状態を確認する。
- `askuserquestion` / `request_user_input` はBZM worker promptで原則禁止する。例外は、Vercel production / preview deploy、またはVercel自動deployを起こす可能性がある `git push` の直前承認だけ。外部判断が本当に必要な場合は、workerが親へ短いblocker/handoffを1回だけ送り、司令塔が判断を束ねる。
- `COMMANDER_TASKS.md` は細かく更新する。worker起動、状態分類変更、司令塔判断、main/deploy gate、blocking condition、完了確認、次アクション変更は都度反映する。
- ただし `COMMANDER_TASKS.md` にworker詳細ログを長文転載しない。Active workerあり、worker id、状態、次回確認条件、まさ要判断、完了/差し戻し/次アクションを短く残す。
- AMD配下のworktree、`.worktrees`、`/private/tmp` のclean worktreeでmd/run note/ledgerを編集する場合、追加のまさ承認待ちは不要。dirty main worktreeだけ避け、必要ならclean worktreeでそのまま進める。
- Vercel deployは再開可。ただし少しの間、Vercel production / preview deploy、またはVercel自動deployを起こす可能性がある `git push` の直前には、必ず `askuserquestion` でまさの許可を取る。承認待ちは `approval pending` として台帳に残し、未分類blockerにしない。
- てにをは、微細UI、軽微CSS、md、コメント、ログ文言などを1件ずつdeployする運用は禁止する。複数worker成果を束ねて1回でdeployする。
- 許可質問には必ずdeploy bundleを含める。内容は、含める変更、除外する変更、local build/test/browser確認結果、deploy予定回数、push/deploy先、rollback/本番確認方法。
- heartbeat時はこの台帳の未完タスクを確認し、進められるものがあればworkerを切る / 既存workerを再起動する / 差し戻す。
- 進められる未完タスクがないのに未完が残る場合は、まさへ具体的な質問または判断依頼を出す。
- 未完タスクがある状態で、全worker停止かつまさにも何も聞いていない状態を作らない。
- BZM司令塔は、重要報告・理論判断・差し戻し判断・OS側判断待ちをOS司令塔へ `send_message_to_thread` で転送する。
- `UU` conflict や未分類dirtyが残るworkerは archive しない。

## 未完タスク（優先順位順）

1. Vercel deploy approval gate
   - お願いした内容: Vercel deploy上限は緩和されたが、当面はVercel production / preview deploy、またはVercel自動deployを起こす可能性があるpushの直前に、必ずまさ許可を取る運用へ切り替える。
   - 背景: deploy自体は再開OKになった一方、微細変更ごとのdeployやpreview乱発を戻すとquotaと確認負荷がすぐ再発するため。
   - 現状: Active。BZM司令塔の運用ルールをhard gateからapproval gateへ更新中。deploy bundle候補: BZM台帳/運用ルール更新のみ。askuserquestion承認状況: approval pending。deploy実施回数: 0。push保留: あり（branch `codex/bzm-vercel-quota-gate` のlocal commit群は未push）。
   - 残課題: push/deploy直前に、含める変更、除外する変更、local build/test/browser確認結果、deploy予定回数、push/deploy先、rollback/本番確認方法を含むdeploy bundleでまさへ許可質問を出す。承認まではpush/deployしない。

2. PRSモデルOS実装worker監督
   - お願いした内容: PRSモデル（P×R×S / 9軸候補）を、現行7軸AMD Scoreの置換ではなく比較/シミュレーション層としてAMD OSに実装するworkerを監督する。
   - 背景: まさから「PRSモデルをOSに実装してほしい」と依頼があり、BZM理論側ではまだ正式置換ではなく理論更新候補として扱うのが安全なため。
   - 現状: Watch（OS司令塔側進行）。worker thread `019e8252-577c-7d90-a4be-2789a1500d71` が branch `codex/prs-comparison-layer` / commit `c101e6c` をpush済み。BZM一次レビューでは、現行7軸を壊さず、P/R_netを保存しない仮入力に留め、missing時にscoreを出さないため採用圏内。OS司令塔へmain取り込み/本番確認アクションを依頼済み。
   - 残課題: OS司令塔/まさ側でPRレビュー、認証済み環境での画面目視、正式採用する場合のP/R_net rubric・DB schema・9PJ retrofit表の別worker切り出し要否を判断する。

3. worker稼働監視 / heartbeat運用
   - お願いした内容: 未完タスクが残っている間は、worker全員が停止・完了・待機で次アクションもない状態を作らず、heartbeatで台帳とworker状態を確認する。
   - 背景: 未完タスクがあるのに司令塔側もworker側も動いていないと、BZM領域のcurrent truth管理とレビュー待ちが止まるため。
   - 現状: Active。全司令塔共通ルールとしてworker quiet modeを採用。BZM司令塔の運用ルールへ反映済みで、次回worker promptから旧能動報告ゲートを削除/上書きする。`askuserquestion` / `request_user_input` は原則禁止だが、Vercel push/deploy直前承認だけ例外にする。
   - 残課題: 次にBZM workerを切る時、親司令塔への進捗/中間/自己判断完了報告は禁止し、まさ承認後closeout 1回または司令塔介入が必要なblocker 1回だけ送る方針をpromptへ明記する。台帳は細かく更新するが、worker詳細ログを長文転載せず、状態と次アクションを短く残す。

4. Textbookとの役割分担
   - お願いした内容: Textbook司令塔とBZM司令塔の担当境界を明確にし、BZM司令塔は理論接続・過剰一般化防止・rubric/数式/用語変更ゲートを担当する。
   - 背景: TextbookはBZM理論解説だけでなく、Before Zeroの現場事例・経営判断・失敗・迷い・仮説修正・横断傾向を扱う実践テキストへ広げる方針になったため。
   - 現状: Watch（Textbook司令塔成果待ち）。OS司令塔判断で暫定採用済み。Textbook司令塔は実践テキストの章構成・ケース配置・読者体験を主導し、BZM司令塔は理論整合を担当する。
   - 残課題: Textbook司令塔のPhase 1章構成worker成果を見て、BZM理論章に入れるべきものとTextbook実践章に置くべきものを分類する。

5. Before Zero実践知をBZM理論へ入れる/入れない判断
   - お願いした内容: L2⑩やTextbook側workerが出す実践知について、BZM理論へ取り込むか、ケースに留めるか、Textbook司令塔へ渡すかを判定する。
   - 背景: 実践知を全部BZM理論に入れると理論が肥大化し、逆に全部ケース扱いにするとBZMが現場から学習できないため。
   - 現状: Watch（Textbook/L2⑩成果待ち）。判断軸として `practice_kind='theory_case'`、`metadata_json.theory_case_kind='edge_case' | 'update_candidate'`、`theory_change_scope`、`bzm_review_required` を使う方針が確定。
   - 残課題: Textbook側のL2⑩ metadata migration/spec worker成果を待ち、local applierがBZM review未承認候補をskipできる仕様になっているか確認する。

6. 理論変更候補のレビュー基準
   - お願いした内容: `theory_case_kind='update_candidate'` を、数式・rubric・重み・変数定義の更新候補として扱うためのレビュー基準を準備する。
   - 背景: 1つの事例だけでBZMの式やrubricを変えると、過去PJ retrofitや既存スコア解釈が壊れる可能性があるため。
   - 現状: Active。採用レビュー基準は `Evidence quality / Reusability / Mechanism clarity / Boundary clarity / Non-overfit / Actionability / Theory safety`。
   - 残課題: 複数PJ根拠、強い反例、観測可能性、既存理論で説明可能か、BZM附則更新要否をworkerレビュー時に必ず確認する。

7. 過剰一般化防止
   - お願いした内容: 現場事例を「理論更新」として過剰に一般化しないため、edge case / update candidate / operational knowhow の境界を守る。
   - 背景: Textbookが実践テキスト化すると強い事例ほど理論化したくなるが、BZMは再利用可能な判断原則だけを理論側に入れる必要があるため。
   - 現状: Active。`theory_edge_case` / `theory_update_candidate` は独立practice_kindにせず、`practice_kind='theory_case'` のmetadataで表現する方針が確定。
   - 残課題: `relationship_playbook` / `field_transition` / `decision_branch` で足りるものを `theory_case` にしていないか、worker成果物ごとに差し戻し判定する。

8. Textbook側から来る理論関連候補のレビュー待ち
   - お願いした内容: Textbook司令塔配下workerから来る `theory_case` 関連候補をBZM司令塔でレビューする。
   - 背景: Textbook司令塔には、Textbook Phase 1 chapter skeleton と L2⑩ metadata migration/spec worker が切られているため。
   - 現状: Watch（Textbook司令塔成果待ち）。BZM司令塔は直接編集せず、worker成果到着待ち。レビュー対象は `theory_case` / `theory_case_kind` / `theory_change_scope` / `bzm_review_required`。
   - 残課題: 成果物が来たら、BZM review required の漏れ、local applier skip条件、BZM式・rubric・用語への影響を確認し、必要ならworkerへ差し戻す。

9. FRL_cap_amd historical整理
   - お願いした内容: 終了済みPJやAMD関与終了後のPJについて、current active rowではなく当時のtimeline-specific rowで `frl_cap_amd` を扱う方針を整理する。
   - 背景: `frl_cap_amd` はAMD提供価値の定量化の本丸だが、ended PJを現在状態だけで見ると当時のAMD寄与を誤判定するため。
   - 現状: Watch（OS/DB判断待ち）。p07 LST / p20 CX / p21 SX はfirst pass反映済み。p06 CTBはfrozenでAMD activeなし、寄与0に補正済み。p04 KT / p09 JC / p11 BWE はcurrent rowではなくtimeline-specific candidate rowに分離する方針。`FRL_cap_amd historical policy memo`、`frl_cap_amd timeline row source pack`、`frl_cap_amd timeline date source lookup`、`frl_cap_amd notes rubric guard`、`frl_cap_amd DB hygiene handoff` はBZMレビュー採用。DB hygiene handoffでは p18 YD / p11 BWE / p06 CTB / p09 JC の stale/conflicting DB fact をOS/DBへ渡せる issue_id 単位に整理済み。候補SQLはすべて未実行で、今回もscore採用には進めない。
   - 残課題: OS/DB側で `project_ventures.founded_at` の意味を公式/legal company founded dateに固定するか、`amd_support_started_at` にinternal month anchorを入れてよいか、`project_knowledge` に `needs_review` / `source_conflict` を使うかを判断する。DB補正、正式FRL再計算、DB化、過去score再計算はまだしない。

10. BZM 7軸モデルとP×R×S/9軸候補の整合
   - お願いした内容: 現行BZM教科書の7軸AMD Scoreと、P・R_netを含むP×R×S/9軸候補の関係を整理する。
   - 背景: 現行教科書は7軸中心だが、知識側にはP×R×S再構成と収益化指数の議論があり、Textbook実践知と結びつきやすい論点になっているため。
   - 現状: Watch（OS/DB判断待ち）。整合メモ、9PJ差分レビュー、P/R_net evidence cards、R_net guard memo、P/R_net観測項目draft、未確認flag source map、L2 source inventory、finance/cash source pack、billing vs SU revenue join map、evidence cards v2 finance classification refresh、bridge/validation source pack、damage/reinvestment source pack、JOYCLE AMD support end current truth review、PRS BZM judgement brief、classification adoption patch、JOYCLE damage source split、evidence cards v3/v4/v5/v6/v7/v8/v9/v10/v11/v12 refresh、p11 GP30 raw source lookup、p11 system GP30 source join、p11 Sumitomo Riko transaction proof lookup、p11 Sumitomo Riko management meeting result lookup、YD low-P / UE guard source split、YD UE/LCOE source join、YD founded_at current truth review は作成済み。公式設立日 `2023-08-04` とDB `2019-01-01` の衝突は `official_company_founded_at_conflicts_with_db_current_value` としてBZMレビュー採用。DB `2019-01-01` は `unknown_db_origin`、`project_knowledge` は `pj_basic_facts_sync` 派生factで独立sourceではない。
   - 残課題: OS/DB側で `project_ventures.founded_at` を公式sourceに合わせて `2023-08-04` へ補正するか判断する。補正する場合は `project_knowledge` basic fact同期確認と、`project_xrl_log` 2019 manual timelineを法人設立日補正から分離する。BZM側ではこのままPRS comparison layerのreview-only current truthとして保持し、0-9値表、DB化、過去score再計算はまだしない。

## 完了済みタスク

1. 2026-05-31 BZM司令塔タスク台帳作成
   - お願いした内容: BZM司令塔のタスクを `COMMANDER_TASKS.md` として台帳化する。
   - 背景: AMD総司令塔から `司令塔タスク台帳ルール` が標準運用になり、BZM司令塔でもまさが状況を読める台帳が必要になったため。
   - 現状: このファイルを作成し、Textbook役割分担、実践知の理論取り込み判断、理論変更候補レビュー、過剰一般化防止、Textbook側レビュー待ちを未完タスクに整理した。
   - 残課題: 今後、worker切り出し・完了・差し戻し・archiveのたびに更新する。
