# PRS BZM judgement brief

作成日: 2026-06-02
作成者: BZM司令塔配下worker
ステータス: BZM司令塔 / OS司令塔 / まさ判断待ち

## 0. Executive decision summary

### 今すぐ決めること

1. p09 JOYCLE の `project_ventures.amd_support_ended_at` を `2026-03-01` に補正するOS/DB workerを切るか。
2. JOYCLE終結理由のうち、株主/bizdev/R&D投資理解/まさ退任理由の口述由来部分を `confirmed_by_masa` 扱いにするか、追加source待ちにするか。
3. CTB型の `Survival guard` をR_netから分離し、売上ゼロ成立型をR_net低値でNO_GOにしない方針を正式に守るか。
4. p20/p21の利益度外視PoC/テスト販売/有料製作を、粗利ではなく `validation_value_source` として標準分類にするか。
5. p07 bridge business、p11膜外販、YD低P/UE不成立の扱いを、正式rubric前のreview条件として固定するか。

### まだ決めないこと

- PRSの正式採用、現行7軸AMD Scoreの置換、過去score再計算。
- 0-9 score表、`r_net` DB列、正式rubric、extractor実装、migration。
- JOYCLEを正のR_netまたは正式な負値として値付けすること。
- `billing_cycles` / AMD billing / 研究機関契約 / 助成金 / 融資 / 投資をSU本体売上・粗利へ混ぜること。

## 1. Adopted current truth

- PRSは正式置換ではなく、現時点では `comparison layer`。
- 現行7軸AMD Scoreは正式モデルとして維持する。
- JOYCLEは `damage guard` / `本命毀損候補` の `review-only`。JB-02/JB-02A、装置見学会、有償テスト、量産計画を正のR_netにしない。
- `negative R_net` は正式用語にしない。対外/正本表現は `damage guard` / `本命毀損候補`。
- `billing_cycles` はAMD請求・入金確認・cash timing補助であり、SU本体売上/粗利から分離する。
- `research_contract_cash` は `amd_billing_or_research_contract` の下位ラベル。p20 NIMS、p21 愛媛大学/PSII、p11 SIPはSU本体売上から恒久分離する。
- grant / policy cash / AMED / NEDO / SIP / Startup Global / PSI / 融資 / 投資はR_net粗利に加算せず、`survival_cash_or_grant` または `Survival guard` へ置く。
- p21の処理単価485円/Lと従量課金モデルは `su_revenue_candidate` のUE sourceとして置けるが、正式R_net値ではない。U1短期cash層とU4/U5本命Pの二重カウント防止ラベルが必須。
- p09 JOYCLEは `projects.status='ended'` / `projects.end_ym='202603'`、`project_ventures.narrative_text`、`project_ventures.master_md_text`、`jc.md` を終結側sourceとする。`project_ventures.amd_support_ended_at=NULL` は継続根拠ではなく、正規化カラムのsource hygiene issue。

## 2. Decision items

### 2.1 OS/DB側で `project_ventures.amd_support_ended_at='2026-03-01'` 補正workerを切るか

- Recommended option: 切る。OS司令塔配下のDB補正workerで、read-only再確認後に最小migration/patchとして扱う。
- Why: `projects.status='ended'` / `end_ym='202603'` と `project_ventures.narrative_text` / `master_md_text` / `jc.md` は終結側で一致しており、NULLの正規化カラムだけがstale候補。
- Risk if wrong: AMD関与継続と誤読され、JOYCLEのdamage guardやended PJのcurrent truthが歪む。一方で、口述由来の終結理由までDB確定扱いすると、根拠強度を過大評価する。
- Source/artifact references: `2026-06-02-joycle-amd-support-end-current-truth-review.md`, `2026-06-02-prs-pr-rnet-evidence-cards-v3.md`.

### 2.2 JOYCLE終結理由の口述由来部分を `confirmed_by_masa` とするか、追加source待ちにするか

- Recommended option: 終結日と終結理由を分離する。終結日はcurrent truth候補として採用し、理由は当面 `oral_history_pending_confirmation` または `confirmed_by_masa_pending_source` に留める。
- Why: 終結日はDB内sourceとknowledgeで整合するが、株主/bizdevがR&D投資を理解しなかった、まさが消耗して退任した、という理由部分は口述由来が強い。
- Risk if wrong: 追加sourceなしにdamage理由へ混ぜると、PRSが事実認定ではなく解釈を正式根拠化する。逆に待ちすぎると、JOYCLE型の本命毀損guardが進まない。
- Source/artifact references: `2026-06-02-joycle-amd-support-end-current-truth-review.md`, `2026-06-02-prs-damage-reinvestment-source-pack.md`, `2026-06-02-prs-pr-rnet-evidence-cards-v3.md`.

### 2.3 CTB型 Survival guard をR_netから分離継続するか

- Recommended option: 分離継続する。CTB型は `売上ゼロでもSを確保する構造` として、R_net粗利とは別guardに置く。
- Why: 創薬/薬事型は治験中売上がゼロでも、AMED等の外部資金、薬事進捗、ライセンス/EXIT可能性で成立しうる。
- Risk if wrong: `R_net low -> NO_GO` の単純化で、創薬long-cycleを誤判定する。AMED等を粗利に混ぜると、売上自走性と非希薄化資金が混ざる。
- Source/artifact references: `2026-06-01-prs-rnet-guard-memo.md`, `2026-06-02-prs-billing-vs-su-revenue-join-map.md`, `2026-06-02-prs-pr-rnet-evidence-cards-v3.md`.

### 2.4 p20/p21 validation valueを標準分類にするか

- Recommended option: `validation_value_source` を標準分類にする。ただしR_net粗利には加算しない。
- Why: p20/p21の利益度外視PoC、テスト販売、有料製作、評価データ獲得は、BRL/SRL/顧客信頼/将来販売に効くが、粗利目的とは限らない。
- Risk if wrong: 評価データ目的のPoCを高R_netと誤読し、利益の薄い活動を自走性として過大評価する。逆に全部除外すると、deeptech early commercializationの学習価値を見落とす。
- Source/artifact references: `2026-06-02-prs-bridge-validation-source-pack.md`, `2026-06-02-prs-damage-reinvestment-source-pack.md`, `2026-06-02-prs-pr-rnet-evidence-cards-v3.md`.

### 2.5 p07 bridge businessを昇格させる条件

- Recommended option: p07リサイクル商流は `bridge_business_candidate` / `review-only` のまま、契約・請求・入金・原価・本命LISMIC影響の5点が揃った時だけ昇格する。
- Why: NDA/MOU、販売先候補、初期費用5,000万円見込み、初期R&D費用回収難などはsourceとして強いが、実績粗利・再投資・本命毀損の突合が未完。
- Risk if wrong: リサイクル商流を早く高R_net化すると、本命LISMIC装置Pと短期商流粗利を足し算してしまう。逆に厳しすぎると、LST型の本命前bridge設計を観測できない。
- Source/artifact references: `2026-06-02-prs-bridge-validation-source-pack.md`, `2026-06-02-prs-damage-reinvestment-source-pack.md`, `2026-06-02-prs-pr-rnet-evidence-cards-v3.md`.

### 2.6 p11膜外販 review解除条件

- Recommended option: 供給余力・粗利・本命RED影響の3条件を最低条件にし、可能なら外販先/契約/入金/原価も確認するまで `bottleneck_external_sale_candidate` / `review-only` を維持する。
- Why: 膜は本命RED装置のボトルネックでもあり、外販は正のR_net候補であると同時に本命毀損候補でもある。
- Risk if wrong: GP30%候補だけで正のR_netにすると、政策資金・膜外販・本命RED装置の生存設計を混ぜる。逆に除外固定にすると、BWEの初期自走性候補を見落とす。
- Source/artifact references: `2026-06-01-prs-rnet-guard-memo.md`, `2026-06-02-prs-bridge-validation-source-pack.md`, `2026-06-02-prs-billing-vs-su-revenue-join-map.md`, `2026-06-02-prs-pr-rnet-evidence-cards-v3.md`.

### 2.7 YDの低P/粗利不成立二重配置ルール

- Recommended option: YD型はP側に `低P/市場上限・価格受容性`、R_net側に `粗利/UE不成立` を二重配置する。ただし二重カウントではなく、同じsourceに主分類と補助分類を付ける。
- Why: 技術PoCがあっても、波力発電のLCOE、設置/保守、腐食/付着、売電/販売単価が合わないなら、単なるBRL不足ではなく事業上限とUEの問題。
- Risk if wrong: P側だけに置くと粗利不成立が消え、R_net側だけに置くと市場構造の弱さが見えなくなる。技術PoCを事業の筋良さと誤読する危険が残る。
- Source/artifact references: `2026-06-01-prs-rnet-guard-memo.md`, `2026-06-02-prs-pr-rnet-evidence-cards-v3.md`.

## 3. Next worker candidates in priority order

1. OS/DB JOYCLE support end補正worker: `project_ventures.amd_support_ended_at='2026-03-01'` の再確認、migration/patch、schema/doc更新範囲を整理する。実DB writeはOS司令塔承認後。
2. PRS classification adoption patch worker: evidence cards v3の分類をBZM司令塔判断後に、`comparison layer` の採用/保留/差し戻し一覧へ反映する。DB列・正式rubric化はしない。
3. JOYCLE damage source split worker: 終結日、終結理由、R&D予算/人員、JB-02/JB-02A販売前夜、装置導入/保守を分け、口述由来とraw sourceを分離する。
4. p07 bridge validation worker: 契約・請求・入金・原価・本命LISMIC影響の5点をsource単位で埋める。
5. p20/p21 validation value worker: 利益度外視PoC/テスト販売/有料製作を、粗利目的・評価データ目的・研究契約cash・Survival cashに分解する。
6. p11 membrane external sale gate worker: 膜外販の供給余力・粗利・本命RED影響・契約/入金/原価を確認する。
7. YD low-P/UE guard worker: LCOE、設置/保守、腐食/付着、売電/販売単価、VC DD論点をsource化し、P側/R_net側の主分類・補助分類案を作る。

## 4. Verification

- Read-onlyで指定AGENTS/CLAUDE/HANDOFF/BZM runsを確認した。
- DB write、DDL、migration、extractor実装、code実装、deployは行っていない。
- 0-9 score表、R_net値付け、PRS正式採用、現行7軸置換、過去score再計算は行っていない。
- `negative R_net` は正式用語として採用していない。
