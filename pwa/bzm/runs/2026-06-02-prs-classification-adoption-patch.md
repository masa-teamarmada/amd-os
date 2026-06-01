# PRS classification adoption patch

作成日: 2026-06-02
作成者: BZM司令塔配下worker
ステータス: BZM司令塔レビュー待ち

## 0. この成果物の扱い

このpatchは、`PRS BZM judgement brief` のBZM採用判断を、PRS comparison layer の current truth と次worker順序へ反映するための分類表である。

- PRSは引き続き `comparison layer`。正式rubric、DB列、0-9 score、過去score再計算には進めない。
- 現行7軸AMD Scoreは正式モデルとして維持する。
- ここでの「採用」は、BZM/PRS検証用の比較レイヤー current truth としての暫定採用を意味する。
- `negative R_net` は正式用語にしない。JOYCLE型は `damage guard` / `本命毀損候補` と呼ぶ。
- `billing_cycles` / AMD billing / research contract / grants / debt / equity はSU本体売上・粗利から分離する。
- DB write、DDL、migration、extractor実装、code実装、deployは行わない。

## 1. adopted_as_comparison_layer_current_truth

| item | 暫定採用内容 | guard |
|---|---|---|
| PRSの位置づけ | PRSは現行7軸を置換せず、P/R_net/Survival観点を比較する layer として継続する。 | 正式AMD Score、DB列、過去score再計算へ進めない。 |
| 現行7軸 | 現行7軸AMD Scoreを正式モデルとして維持する。 | PRS差分を7軸で説明済みのTRL/BRL/HRL/FRL/SRL成果と二重計上しない。 |
| CTB Survival guard | CTB型の売上ゼロ成立構造はR_netから分離し、Survival guardとして継続する。 | AMED等の非希薄化資金をR_net粗利へ足さない。 |
| p20/p21 validation value | 利益度外視PoC、テスト販売、有料製作、評価データ獲得は `validation_value_source` として標準分類へ採用する。 | R_net粗利には入れず、BRL/SRL/顧客信頼/将来販売の補助sourceとして扱う。 |
| YD二重配置 | YD型はP側に低P/市場構造、R_net側にUE/粗利不成立を置く。 | 同じsourceを二重カウントしない。主分類と補助分類を分ける。 |
| finance/cash分離 | `billing_cycles`、AMD billing、research contract、grants、debt、equityはSU本体売上/粗利から分離する。 | cash timing、Survival、lane guardの補助には使えるが、R_net gross marginへ転記しない。 |
| 3値 `prs_use` | `usable source` / `review-only` / `exclude from PRS` の3値運用を継続する。 | `usable source` でも値付けや正式score化はしない。 |

## 2. review_only_until_source_join

| item | review-only維持内容 | review解除条件 |
|---|---|---|
| p07 bridge business | リサイクル商流、NDA/MOU、販売先候補、ブラックマス調達、初期費用/運営コストは `bridge_business_candidate` / `review-only`。 | 契約、請求、入金、原価、本命LISMIC影響の5点がsource単位で揃う。 |
| p11膜外販 | 膜外販は `bottleneck_external_sale_candidate` / `review-only`。 | 供給余力、粗利、本命RED影響を最低条件とし、可能なら外販先/契約/入金/原価も確認する。 |
| JOYCLE終結理由 | 株主/bizdev/R&D投資理解/まさ退任理由は口述由来が強いため、damage guard理由としてはreview-only。 | まさconfirmまたは追加sourceで、終結理由と本命R&D毀損の根拠強度を分けて確認する。 |
| p20/p21 validation valueの粗利転用 | 評価データ目的のPoC/テスト販売を粗利へ入れることはreview-only。 | 粗利目的、評価データ目的、研究契約cash、Survival cashがsource単位で分解される。 |
| p21 485円/L・従量課金 | UE sourceとしては置けるが、正式R_net値ではない。 | U1短期cashとU4/U5本命Pの二重カウント防止ラベル、原価、入金、継続性が揃う。 |
| p04 Adam MVP販売 | 本命MVP前倒し収益候補だがreview-only。 | 販売台数、単価、粗利、保守/導入負担、R&D速度への影響が確認される。 |
| p03商社/受託scenario | Cabot代理店、エアロゲル商社、開発受託はscenario/review-only。 | 当時の契約額、粗利、在庫/営業/与信コスト、本命再投資がsource化される。 |

## 3. exclude_from_prs_score_but_keep_as_context

| item | 除外理由 | 残す場所 |
|---|---|---|
| `billing_cycles` | AMD請求・invoice・入金確認であり、SU本体売上/粗利ではない。 | AMD billing / cash timing補助。 |
| AMD billing / AMD発注保留 | AMDとの業務委託・請求関係であり、SU本体PLではない。 | finance/cash context、Survival補助。 |
| research contract cash | NIMS、愛媛大学、PSII、SIP等の研究機関契約はSU本体販売粗利ではない。 | `amd_billing_or_research_contract` 下位ラベル。 |
| grants / policy cash | AMED、NEDO、SIP、Startup Global、PSI等は非希薄化資金/政策資金であり、粗利ではない。 | `survival_cash_or_grant`、lane-specific survival。 |
| debt / equity | 融資・投資はrunway補助であり、売上粗利ではない。 | runway / FRL / Survival context。 |
| future/draft/upcoming rows | future draft、candidate、upcomingを実績扱いするとcurrent truthが歪む。 | 観測予定、hypothesis、source hygiene context。 |
| JOYCLE販売前夜source | JB-02/JB-02A、装置見学会、有償テスト、量産計画は契約/請求/入金/原価/本命R&D影響が未接続。 | damage guard / review-only context。 |

## 4. os_db_hygiene_required

| item | hygiene issue | 推奨扱い |
|---|---|---|
| p09 JOYCLE support end date | `projects.status='ended'` / `projects.end_ym='202603'`、`project_ventures.narrative_text`、`master_md_text`、`jc.md` は終結側。一方で `project_ventures.amd_support_ended_at=NULL`。 | `amd_support_ended_at` 補正はOS/DB workerでread-only再確認後に判断する。BZM側では `support_end_db_gap` として持つ。 |
| JOYCLE終結理由 | 終結日はcurrent truth candidateだが、理由の口述由来部分はsource強度が違う。 | 終結日と終結理由を分離し、理由は `oral_history_pending_confirmation` 相当で扱う。 |
| ended PJのfuture rows | 終了後のdraft月次やfuture billing rowsがcurrent truthを誤読させる。 | ended PJ判定ではfuture-like draftを除外する運用をOS側で明文化候補にする。 |
| source label consistency | `research_contract_cash`、`grant_or_policy_cash`、`debt_or_equity_cash`、`validation_value_source` のラベルが比較レイヤー上の運用に留まる。 | DB列化せず、BZM run / evidence card の分類として保持する。 |
| SU本体PL join | `billing_cycles` や研究契約cashでSU本体売上欠損を補完する危険がある。 | `project_pl_monthly` 等のSU本体PLがある場合だけ別行で扱い、AMD請求を足さない。 |

## 5. blocked_from_formal_rubric

| blocked item | 理由 |
|---|---|
| 0-9 score表 | CTB/JOYCLE/YD/BWE guardが正式閉鎖しておらず、値表化すると誤判定が固定される。 |
| `r_net` DB列 | PRS正式採用済みと誤読され、現行7軸を置換する危険がある。 |
| PRS正式score | 少標本かつsource強度が混在している。comparison layer以上に上げない。 |
| 過去score再計算 | 既存判断ログと正式7軸履歴を上書きする危険がある。 |
| `negative R_net`正式語 | JOYCLE型を値付け語にすると、damage guardと実績粗利の境界が崩れる。 |
| R_net粗利への助成金/研究契約加算 | 売上粗利、非希薄化資金、研究契約cash、政策資金が混ざる。 |
| 現行7軸置換 | PRSは差分説明の比較レイヤーであり、正式AMD Scoreモデルではない。 |

## 6. decision brief 7項目の暫定分類

| # | decision item | BZM暫定分類 | 採用/保留/OS判断待ち |
|---|---|---|---|
| 1 | p09 JOYCLE `project_ventures.amd_support_ended_at='2026-03-01'` 補正workerを切るか | OS/DB hygiene candidate | **OS判断待ち**。BZMでは `support_end_db_gap` として採用し、DB writeはOS司令塔へ渡す。 |
| 2 | JOYCLE終結理由を `confirmed_by_masa` とするか追加source待ちにするか | oral/source split required | **保留**。終結日はcurrent truth candidate、理由は追加source/まさconfirm待ち。 |
| 3 | CTB Survival guard をR_netから分離継続するか | lane-specific survival guard | **暫定採用**。R_net低値でNO_GOにしない。 |
| 4 | p20/p21 validation valueを標準分類にするか | validation_value_source | **暫定採用**。ただしR_net粗利には入れない。 |
| 5 | p07 bridge business昇格条件 | bridge_business_candidate gate | **暫定採用**。5点セットが揃うまでreview-only。 |
| 6 | p11膜外販 review解除条件 | bottleneck_external_sale_candidate gate | **暫定採用**。供給余力/粗利/本命RED影響までreview-only。 |
| 7 | YD低P/粗利不成立二重配置 | low-P / UE guard dual placement | **暫定採用**。二重カウント禁止。 |

## 7. 次worker順序

1. JOYCLE damage source split
   - 終結日、終結理由、R&D予算/人員、JB-02/JB-02A販売前夜、装置導入/保守を分ける。
   - 口述由来、DB current truth、raw source、future/draft sourceを分離する。

2. p07 bridge validation
   - リサイクル商流について、契約、請求、入金、原価、本命LISMIC影響の5点をsource単位で埋める。
   - NDA/MOU/販売先候補を実績粗利にしない。

3. p20-p21 validation value
   - 利益度外視PoC、テスト販売、有料製作を、粗利目的、評価データ目的、研究契約cash、Survival cashへ分解する。
   - p21 485円/L・従量課金モデルのUE sourceは二重カウント防止ラベルつきで扱う。

4. p11 membrane gate
   - 膜外販の供給余力、粗利、本命RED影響、外販先、契約、入金、原価を確認する。
   - 政策資金/SIP/共同研究cashをbridge revenueへ混ぜない。

5. YD low-P-UE guard
   - LCOE、設置/保守、腐食/付着、売電/販売単価、VC DD論点をsource化する。
   - P側の低P/市場構造とR_net側のUE不成立を主分類/補助分類で分ける。

6. lane-specific survival
   - CTB型の創薬/薬事、政策資金型、研究契約cash型、補助金後払い型をR_net粗利から分ける。
   - Survival guard / lane guardとして、cash/runway、薬事、ライセンス/EXIT、政策資金の扱いを整理する。

## 8. 検証

- 指定されたAGENTS/CLAUDE/HANDOFF/BZM runsをread-onlyで確認した。
- `git status -sb` を確認した。
- DB write、DDL、migration、extractor実装、code実装、deployは行っていない。
- 0-9 score表、R_net値付け、PRS正式採用、現行7軸置換、過去score再計算は行っていない。
- `negative R_net` は正式用語として採用していない。
- `billing_cycles` / AMD billing / research contract / grants / debt / equity はSU本体売上/粗利から分離した。

## 9. 未解決

- JOYCLEの `project_ventures.amd_support_ended_at` 補正をOS/DB workerへ切るかは、BZM司令塔/OS司令塔判断待ち。
- JOYCLE終結理由の口述由来部分を `confirmed_by_masa` として扱うか、追加source待ちにするかは未確定。
- p07/p11/p20/p21/YDのsource joinは次worker待ち。
- PRS formal rubric、DB化、0-9化、過去score再計算は明示的に未着手。
