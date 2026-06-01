# BZM Commander Tasks

Last updated: 2026-06-02
Owner: BZM司令塔
Scope: Before Zero Model / BZM theory / Textbook theory gate / L2⑩ Textbook Insights theory review

このファイルは、BZM司令塔が抱えているタスクの台帳。
まさがここを開けば、コードやworker報告を読まなくても「何を頼んだか / なぜ頼んだか / 今どうなっているか / 何が残っているか」が分かる状態にする。

## 運用ルール

- タスク追加、方針変更、worker切り出し、完了報告、差し戻し、archive のたびに更新する。
- worker報告をそのまま貼らず、BZM司令塔がまさ向けに要約し直す。
- まず `未完タスク（優先順位順）`、その下に `完了済みタスク` を置く。
- BZM司令塔からworkerを切る場合、worker promptにはBZM司令塔 thread id `019e7b97-ceb7-7ef1-9354-20cc017328f7` と能動報告ゲートを必ず入れる。
- worker完了 / 停止 / 要判断時は、worker自身が `【司令塔へ報告】<作業名> 完了` / `要判断` / `停止/ブロック` でBZM司令塔へ能動報告する。
- BZM司令塔は、報告漏れが起きる前提でheartbeat / 定期確認を置き、worker終了・停止・報告漏れを検知する。
- heartbeat時はこの台帳の未完タスクを確認し、進められるものがあればworkerを切る / 既存workerを再起動する / 差し戻す。
- 進められる未完タスクがないのに未完が残る場合は、まさへ具体的な質問または判断依頼を出す。
- 未完タスクがある状態で、全worker停止かつまさにも何も聞いていない状態を作らない。
- BZM司令塔は、重要報告・理論判断・差し戻し判断・OS側判断待ちをOS司令塔へ `send_message_to_thread` で転送する。
- `UU` conflict や未分類dirtyが残るworkerは archive しない。

## 未完タスク（優先順位順）

1. worker稼働監視 / heartbeat運用
   - お願いした内容: 未完タスクが残っている間は、worker全員が停止・完了・待機で次アクションもない状態を作らず、heartbeatで台帳とworker状態を確認する。
   - 背景: 未完タスクがあるのに司令塔側もworker側も動いていないと、BZM領域のcurrent truth管理とレビュー待ちが止まるため。
   - 現状: 全司令塔共通ルールとして採用。BZM司令塔の運用ルールへ反映済みで、次回worker promptにも入れる前提。
   - 残課題: 次にBZM workerを切る時、能動報告ゲートに加えてheartbeat確認・報告漏れ検知・未完タスク再起動方針をpromptへ明記する。

2. Textbookとの役割分担
   - お願いした内容: Textbook司令塔とBZM司令塔の担当境界を明確にし、BZM司令塔は理論接続・過剰一般化防止・rubric/数式/用語変更ゲートを担当する。
   - 背景: TextbookはBZM理論解説だけでなく、Before Zeroの現場事例・経営判断・失敗・迷い・仮説修正・横断傾向を扱う実践テキストへ広げる方針になったため。
   - 現状: OS司令塔判断で暫定採用済み。Textbook司令塔は実践テキストの章構成・ケース配置・読者体験を主導し、BZM司令塔は理論整合を担当する。
   - 残課題: Textbook司令塔のPhase 1章構成worker成果を見て、BZM理論章に入れるべきものとTextbook実践章に置くべきものを分類する。

3. Before Zero実践知をBZM理論へ入れる/入れない判断
   - お願いした内容: L2⑩やTextbook側workerが出す実践知について、BZM理論へ取り込むか、ケースに留めるか、Textbook司令塔へ渡すかを判定する。
   - 背景: 実践知を全部BZM理論に入れると理論が肥大化し、逆に全部ケース扱いにするとBZMが現場から学習できないため。
   - 現状: 判断軸として `practice_kind='theory_case'`、`metadata_json.theory_case_kind='edge_case' | 'update_candidate'`、`theory_change_scope`、`bzm_review_required` を使う方針が確定。
   - 残課題: Textbook側のL2⑩ metadata migration/spec worker成果を待ち、local applierがBZM review未承認候補をskipできる仕様になっているか確認する。

4. 理論変更候補のレビュー基準
   - お願いした内容: `theory_case_kind='update_candidate'` を、数式・rubric・重み・変数定義の更新候補として扱うためのレビュー基準を準備する。
   - 背景: 1つの事例だけでBZMの式やrubricを変えると、過去PJ retrofitや既存スコア解釈が壊れる可能性があるため。
   - 現状: 採用レビュー基準は `Evidence quality / Reusability / Mechanism clarity / Boundary clarity / Non-overfit / Actionability / Theory safety`。
   - 残課題: 複数PJ根拠、強い反例、観測可能性、既存理論で説明可能か、BZM附則更新要否をworkerレビュー時に必ず確認する。

5. 過剰一般化防止
   - お願いした内容: 現場事例を「理論更新」として過剰に一般化しないため、edge case / update candidate / operational knowhow の境界を守る。
   - 背景: Textbookが実践テキスト化すると強い事例ほど理論化したくなるが、BZMは再利用可能な判断原則だけを理論側に入れる必要があるため。
   - 現状: `theory_edge_case` / `theory_update_candidate` は独立practice_kindにせず、`practice_kind='theory_case'` のmetadataで表現する方針が確定。
   - 残課題: `relationship_playbook` / `field_transition` / `decision_branch` で足りるものを `theory_case` にしていないか、worker成果物ごとに差し戻し判定する。

6. Textbook側から来る理論関連候補のレビュー待ち
   - お願いした内容: Textbook司令塔配下workerから来る `theory_case` 関連候補をBZM司令塔でレビューする。
   - 背景: Textbook司令塔には、Textbook Phase 1 chapter skeleton と L2⑩ metadata migration/spec worker が切られているため。
   - 現状: BZM司令塔は直接編集せず、worker成果到着待ち。レビュー対象は `theory_case` / `theory_case_kind` / `theory_change_scope` / `bzm_review_required`。
   - 残課題: 成果物が来たら、BZM review required の漏れ、local applier skip条件、BZM式・rubric・用語への影響を確認し、必要ならworkerへ差し戻す。

7. FRL_cap_amd historical整理
   - お願いした内容: 終了済みPJやAMD関与終了後のPJについて、current active rowではなく当時のtimeline-specific rowで `frl_cap_amd` を扱う方針を整理する。
   - 背景: `frl_cap_amd` はAMD提供価値の定量化の本丸だが、ended PJを現在状態だけで見ると当時のAMD寄与を誤判定するため。
   - 現状: p07 LST / p20 CX / p21 SX はfirst pass反映済み。p06 CTBはfrozenでAMD activeなし、寄与0に補正済み。p04 KT / p09 JC / p11 BWE は保留。
   - 残課題: historical rowの対象時点、根拠、BZM/Textbook上の扱いを整理するworkerを切る。

8. BZM 7軸モデルとP×R×S/9軸候補の整合
   - お願いした内容: 現行BZM教科書の7軸AMD Scoreと、P・R_netを含むP×R×S/9軸候補の関係を整理する。
   - 背景: 現行教科書は7軸中心だが、知識側にはP×R×S再構成と収益化指数の議論があり、Textbook実践知と結びつきやすい論点になっているため。
   - 現状: workerが `pwa/bzm/runs/2026-06-01-prs-seven-axis-alignment.md` を作成。BZM一次判断は `Adopt as comparison layer`。続くworkerが `pwa/bzm/runs/2026-06-01-prs-9pj-delta-review.md` を作成し、9PJ差分としてティエム商社化/JOYCLE本命毀損/YD UE不成立/BWE初期自走性を強いPRS差分候補、CTBをR_net単純化の反例として整理した。さらにworkerが `pwa/bzm/runs/2026-06-01-prs-pr-rnet-evidence-cards.md` を作成し、9PJごとにP仮説、R_netの粗利貢献/運営コスト/本命毀損、7軸で説明できること、PRS追加説明、反例、次観測、rubric化暫定判定をカード化した。R_net guard workerが `pwa/bzm/runs/2026-06-01-prs-rnet-guard-memo.md` を作成し、CTB/JOYCLE/YD/BWEを中心に、売上ゼロ成立型・damage guard・低P/UE不成立・膜外販未確定の誤判定防止guard、R_netと混ぜない観測項目、次の観測項目draftへ渡せる/まだ使わない項目を整理した。P/R_net観測項目draft workerが `pwa/bzm/runs/2026-06-01-prs-pr-rnet-observation-items-draft.md` を作成し、P/R_net/Survival guardごとに観測項目・source候補・入力主体候補・更新頻度候補・guard条件・未確認flagを整理した。続くsource map workerが `pwa/bzm/runs/2026-06-01-prs-unverified-source-map.md` を作成し、未確認flagを9PJ evidence cardsへ戻し、各flagのsourceを `l2_extractable` / `worker_research` / `masa_or_bzm_judgement` に分類した。P/R_net L2 source inventory workerが `pwa/bzm/runs/2026-06-01-prs-l2-source-inventory.md` を作成し、既存L2/DB/docs/outbox/scriptから拾えるsource候補を `available_now` / `available_but_needs_join` / `not_currently_available` / `unsafe_to_infer` / `requires_masa_or_bzm_review` に分類した。finance/cash source pack workerが `pwa/bzm/runs/2026-06-02-prs-finance-cash-source-pack.md` を作成し、p07/p20/p21/p06/p11の売上・粗利・入金・助成金候補をsource id単位で整理した。billing vs SU revenue join map workerが `pwa/bzm/runs/2026-06-02-prs-billing-vs-su-revenue-join-map.md` を作成し、`billing_cycles` / 研究機関契約 / SU本体売上候補 / Survival cashを分けるラベル案と二重カウント防止ルールを整理した。PRS evidence cards v2 finance classification refresh workerが `pwa/bzm/runs/2026-06-02-prs-pr-rnet-evidence-cards-v2.md` を作成し、9PJ evidence cardsへ `Finance/Cash source classification`、3値の `prs_use`、`research_contract_cash` 下位ラベル、`billing_cycles` 原則除外、横断分類一覧を戻した。bridge/validation source pack workerとdamage/reinvestment source pack workerがsource候補を整理し、JOYCLE AMD support end current truth review workerが `project_ventures.amd_support_ended_at` のNULLをsource hygiene issueとして確認した。PRS evidence cards v3 current truth refresh workerが `pwa/bzm/runs/2026-06-02-prs-pr-rnet-evidence-cards-v3.md` を作成し、p09 JOYCLEへ `support_end_status=ended_current_truth_candidate`、`support_end_date=2026-03`、`support_end_db_gap=project_ventures.amd_support_ended_at_null`、`damage_guard_use=review-only`、分類 `db_stale_knowledge_current` を戻した。P/R_netは正式DB列・rubric未採用のまま扱う。
   - 残課題: BZM司令塔レビュー。司令塔判断事項は、JOYCLEの `project_ventures.amd_support_ended_at` 補正をOS/DB workerへ切るか、口述由来の終結理由を `confirmed_by_masa` 未満で追加source待ちにするか、CTB型のSurvival guard分離の強さ、JOYCLE型damage guardの名称/扱い、YD型をP側/粗利不成立側の両方へ置く粒度、BWE膜外販を未確定R_netから動かす条件、CX/SXの利益度外視PoC/テスト販売を粗利ではなく評価データ価値へ置くか、研究機関契約cashをSU本体売上から恒久分離するラベル採用。

## 完了済みタスク

1. 2026-05-31 BZM司令塔タスク台帳作成
   - お願いした内容: BZM司令塔のタスクを `COMMANDER_TASKS.md` として台帳化する。
   - 背景: AMD総司令塔から `司令塔タスク台帳ルール` が標準運用になり、BZM司令塔でもまさが状況を読める台帳が必要になったため。
   - 現状: このファイルを作成し、Textbook役割分担、実践知の理論取り込み判断、理論変更候補レビュー、過剰一般化防止、Textbook側レビュー待ちを未完タスクに整理した。
   - 残課題: 今後、worker切り出し・完了・差し戻し・archiveのたびに更新する。

2. 2026-06-01 P/R_net観測項目draft作成
   - お願いした内容: R_net guard memoを受けて、P/R_netの正式rubric化前の観測項目draftを作る。
   - 背景: PRSは正式理論ではなくcomparison layerとして継続し、0-9値表・DB列・PRS正式score・過去score再計算へ進まないため。
   - 現状: `pwa/bzm/runs/2026-06-01-prs-pr-rnet-observation-items-draft.md` を作成し、P/R_net/Survival guardの観測項目・source候補・入力主体候補・更新頻度候補・guard条件・未確認flagを整理した。
   - 残課題: BZM司令塔がdraftをレビューし、未確認flagを9PJ evidence cardsへ戻すか判断する。

3. 2026-06-01 P/R_net未確認flag source map作成
   - お願いした内容: P/R_net観測項目draftの未確認flagを9PJ evidence cardsへ戻し、L2抽出候補、worker調査候補、まさ/BZM判断事項へ分ける。
   - 背景: 0-9値表やDB化へ進む前に、どのsourceを埋めればcomparison layer検証が進むかを決める必要があったため。
   - 現状: `pwa/bzm/runs/2026-06-01-prs-unverified-source-map.md` を作成し、全flagのsource分類、9PJごとのflag対応、L2領域仮分類、次worker候補を整理した。
   - 残課題: BZM司令塔レビュー。次worker候補は L2 source inventory、public/knowledge research、BZM judgement brief。
