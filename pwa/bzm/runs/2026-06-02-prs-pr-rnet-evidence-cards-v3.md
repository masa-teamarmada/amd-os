# P/R_net evidence cards v3 — JOYCLE current truth and damage guard refresh

作成日: 2026-06-02
作成者: BZM理論検証worker
ステータス: BZM司令塔レビュー待ち

## 0. この成果物の扱い

このファイルは、PRS候補を正式rubric化する前の evidence card である。

- P/R_net の 0-9 score は確定しない。
- 現行7軸AMD Scoreは正式モデルのまま扱う。
- PRSは `Adopt as comparison layer` の検証用に使う。
- `R_net = 粗利貢献 - 運営コスト - 本命PJへのリソース毀損` という見方は採用するが、まだrubricではない。
- 売上ゼロでも成立する創薬/外部資金/薬事/EXIT型を、R_net低値だけでNO_GOにしない。
- v2では finance/cash source pack と billing vs SU revenue join map を戻し、各PJに `Finance/Cash source classification` を追加した。
- v3では JOYCLE AMD support end current truth review と damage/reinvestment source pack を戻し、p09 JOYCLEを `damage guard` / `本命毀損候補` の `review-only` 対象として更新する。
- v3では p09 JOYCLEの分類を `db_stale_knowledge_current` とする。ただしDB全体が古いという意味ではなく、`project_ventures.amd_support_ended_at` 正規化カラムだけがstale候補である。
- `projects.status='ended'` / `projects.end_ym='202603'`、`project_ventures.narrative_text`、`project_ventures.master_md_text` は終結側のsourceとして扱う。
- JOYCLEの終結理由のうち、株主/bizdevや退任理由の口述由来部分は `confirmed_by_masa` 未満として扱い、damage guard理由には直接混ぜない。
- `PRSで使うなら` は `usable source` / `review-only` / `exclude from PRS` の3値に固定する。
- `billing_cycles` は原則 `exclude from PRS`。Survival/cash timing補助として扱う場合だけ `review-only`。
- p09の `billing_cycles` はAMD請求/cash timing補助に留め、PRS本体、JOYCLE本体粗利、damage/reinvestmentには使わない。
- `research_contract_cash` は `amd_billing_or_research_contract` の下位ラベルとして扱う。p20 NIMS / p21 愛媛大学・PSII / p11 SIP は、SU本体売上から恒久分離する。
- p21の処理単価485円/Lと従量課金モデルは `su_revenue_candidate` としてR_net欄に置ける。ただしU1短期cashとU4/U5本命Pの二重カウント防止ラベルを必須にする。

確認した主資料:

- `pwa/bzm/runs/2026-06-01-prs-seven-axis-alignment.md`
- `pwa/bzm/runs/2026-06-01-prs-9pj-delta-review.md`
- `pwa/scripts/prxs_9pj_inputs.py`
- `pwa/scripts/prxs_retrofit_test.py`
- `pwa/design/amd_score.md`
- `/Users/masa/projects/knowledge/{tiem,KT,ctb,LST,jc,BWE,yd,cx,sx}.md`
- `pwa/bzm/runs/2026-06-02-prs-finance-cash-source-pack.md`
- `pwa/bzm/runs/2026-06-02-prs-billing-vs-su-revenue-join-map.md`
- `pwa/bzm/runs/2026-06-02-prs-damage-reinvestment-source-pack.md`
- `pwa/bzm/runs/2026-06-02-joycle-amd-support-end-current-truth-review.md`
- `pwa/bzm/runs/2026-06-01-prs-l2-source-inventory.md`
- `pwa/bzm/runs/2026-06-01-prs-unverified-source-map.md`
- `pwa/bzm/runs/2026-06-01-prs-rnet-guard-memo.md`
- `pwa/bzm/runs/2026-06-01-prs-pr-rnet-observation-items-draft.md`

## 1. p03 ティエムファクトリ

### Pの仮説

- 仮説: high
- 確認済み根拠: 本命の透明モノリス断熱が窓へ載れば、断熱窓市場という大きな天井に届きうる。knowledgeでは、直接のエアロゲル断熱材市場は中規模だが、透明断熱窓の射程を含めるとPは大きいと整理されている。
- 未確認: 設立2012時点の市場実在性と、現在市場規模を将来到達上限として使う妥当性。Cabot代理店/商社化をした場合に、Pを本命モノリスの天井で見るのか、エアロゲル商社全体の天井で見るのか。

### R_netの仮説

- 粗利貢献: 史実では商社/受託を取らず、自走収益はほぼ立っていない。反実仮想ではCabot代理店、エアロゲル商社、開発受託が粗利源になりえた。
- 運営コスト: 本命モノリスR&Dは長く重い。シリーズA後に社員拡大し、資金枯渇とリストラに至ったため、固定費増がR_netを圧迫した可能性が高い。
- 本命PJへのリソース毀損: 商社/受託が本命を支える構造なら正のR_netだが、住友理工の自動車断熱のようにUEが合わない共同開発へ偏ると本命を毀損する危険がある。

### Finance/Cash source classification

今回のfinance分類で追加sourceは薄い。p03は実DB/L2の月次・MTG・finance行が薄く、Cabot代理店/商社化/開発受託は反実仮想を含むため、`future_or_draft_plan` または scenario source として次research対象に留める。

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| `/Users/masa/projects/knowledge/tiem.md` / `before_zero_theory.md` / 既存BZM runs | knowledge/scenario | `future_or_draft_plan` | `scenario_bridge_business_source` | `review-only` | 反実仮想の商社/受託を実績粗利にしない。本命モノリスPと商社粗利を足さない。 | 当時の契約額、粗利、在庫/営業/与信コスト、本命再投資が未確認。 |
| 追加finance source | not currently available | - | - | `exclude from PRS` | DB/L2に薄い状態を「売上なし確定」とも「高R_net」とも扱わない。 | next researchで当時資料・公開情報・まさ/BZM判断が必要。 |

### 7軸で説明できること

- 設立時に自社内製TRL=0だったこと、つまり「早すぎた」は7軸TRLゲートで十分説明できる。
- マクロ追い風は一定あったため、失敗主因はsigma_SUではなく自社内製TRL/HRL/BRLの不足として説明できる。

### PRSで追加説明できること

- 「Pは大きいが、R_netが立たず、会社として死なずに本命R&Dを続ける構造がなかった」を表現できる。
- 反省としての「商社+開発受託+ムーンショット」は、7軸よりR_net evidenceとして扱いやすい。

### 反例/危険な誤判定

- 「早すぎた」までPRSの成果として扱うのは誤り。これは7軸で説明済み。
- 商社/受託を常に正のR_netと見なすと危険。本命を支える粗利か、本命から経営注意を奪う仕事かを分ける必要がある。

### 次に必要な観測データ

- 当時のCabot代理店/商社化で想定できた粗利率、在庫/営業/与信コスト。
- 共同開発受託の契約額、粗利、サンプル作成装置などに吸われた実コスト。
- 商社/受託が本命モノリス開発へ再投資されたかを示す資金使途。

### rubric化してよいかの暫定判定

`needs_more_evidence`

ティエムはR_net概念の原型事例だが、反実仮想を含むため、そのままrubric化すると商社化万能論に過適合する。

## 2. p04 輝翠TECH

### Pの仮説

- 仮説: medium
- 確認済み根拠: 農業用AIロボAdamをMVPとして販売開始済み。2023年に多数農家でデモ、2024年3月販売開始、2024年5月シリーズA調達と量産・全国展開の文脈がある。
- 未確認: 農業ロボ市場全体の天井と、KT固有のAdamが取れる上限。まさ口述の10台程度販売は社内認識であり、公開情報上の累計台数は未確認。

### R_netの仮説

- 粗利貢献: Adam本体の販売が本命そのものの前倒し収益になりうる。
- 運営コスト: ロボ量産、サポート、保守、全国展開のコストが粗利をどの程度食うかは未確認。
- 本命PJへのリソース毀損: 本命そのものをMVP化しているため、ティエム型の別系統ライスワークより毀損は小さい仮説。ただし量産/導入対応がR&Dを圧迫する可能性は残る。

### Finance/Cash source classification

今回のfinance分類で追加sourceは薄い。p04はAdam販売の存在はP/R_net観測上の重要候補だが、今回のfinance/cash source pack対象外で、販売台数・単価・粗利・保守/導入負担は未確認。次research対象として扱う。

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| `/Users/masa/projects/knowledge/KT.md` / 既存BZM runs | knowledge/public-known | `su_revenue_candidate` | `mvp_revenue_candidate` | `review-only` | Adam販売を即高R_netにしない。本命MVP前倒し収益と導入/保守コストを分ける。 | 販売台数、単価、粗利、保守/導入支援コスト、R&D速度への影響が未確認。 |
| 追加finance source | not currently available | - | - | `exclude from PRS` | 実DB/L2が薄い状態を正式scoreの空欄補完に使わない。 | next researchで公開情報・内部販売情報・まさ/BZM判断が必要。 |

### 7軸で説明できること

- 月面ローバー技術から農業ロボへ転用し、TRL/BRL/HRLが段階的に上がった lifted 事例として説明できる。
- AMD関与はCOO派遣/体制構築で、HRL補完として説明しやすい。

### PRSで追加説明できること

- 本命を早期MVPとして有償展開する「系統II」の自走性を説明できる。
- ティエム/LiSTie/CryoXのような別系統つなぎ事業と区別する参照例になる。

### 反例/危険な誤判定

- KTの成長自体をPRSの証拠にしすぎると過剰。大筋は7軸成熟度で説明できる。
- MVP販売をただちに高R_netと見るのは危険。販売粗利、保守負担、量産不良、顧客対応コストを差し引く必要がある。

### 次に必要な観測データ

- Adamの販売台数、単価、粗利、保守/導入支援コスト。
- 販売開始後のR&D速度への影響。
- 量産資金とシリーズA資金の使途。

### rubric化してよいかの暫定判定

`needs_more_evidence`

本命前倒し収益型の良い参照例だが、粗利と導入コストが未確認。

## 3. p06 CrestecBio

### Pの仮説

- 仮説: high
- 確認済み根拠: 虚血性脳卒中治療薬は世界100億ドル超の大市場として整理されている。CTB211は神経保護薬で、既存薬との差別化余地がある。
- 未確認: CTB211固有の薬効、安全性、競合優位、ライセンス/EXIT確度。市場全体のPをCTB固有Pへどこまで割り引くか。

### R_netの仮説

- 粗利貢献: 治験中売上は基本ゼロ。現時点の生存はAMED等の外部資金に依存。
- 運営コスト: 創薬は非臨床/大動物/治験/薬事のコストが大きく、売上まで長い。
- 本命PJへのリソース毀損: 目先売上が本命を毀損するというより、売上ゼロ期間を外部資金・薬事プロセス・EXIT期待で耐える型。

### Finance/Cash source classification

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| strategy signal `20f2c8b9-563a-4504-9a8f-65b9f302c647` | candidate/decided | `amd_billing_or_research_contract` | `amd_order_pause_source` | `exclude from PRS` | AMD発注保留をSU本体売上・粗利の減少として直接転記しない。CTB型はR_net低値でNO_GOにしない。 | AMD発注/業務委託の停止情報であり、CTB本体PLではない。 |
| xrl evidence `ea743ad7-db44-48ae-a318-07b771746be7` | candidate | `amd_billing_or_research_contract` | `cash_stress_source` | `review-only` | cash stressをR_net粗利に混ぜない。Survival guardの補助に置く。 | 原薬異物混入とARMADA発注保留のsourceで、売上/粗利/入金実績ではない。 |
| project_knowledge `f91e59f3-b497-4a98-924d-a4d5cfd2ea09` | active | `survival_cash_or_grant` | `grant_or_policy_cash` | `usable source` | AMED研究資金を粗利に加算しない。営利業務不可制約をR_net加算禁止の根拠として扱う。 | 金額・期間・自己負担・後払い条件が未接続。 |
| project_knowledge `4a6d077e-d5d0-488f-8e64-9303de2c9017` | active | `survival_cash_or_grant` | `grant_or_policy_cash` | `usable source` | AMED外注可能契約をSU販売粗利にしない。 | 外注形態の制約sourceであり、粗利額ではない。 |
| monthly report `MR_p06_202604` | draft | `survival_cash_or_grant` | `grant_admin_burden_source` | `usable source` | AMED管理コストをR_net粗利ではなくSurvival/admin burdenに置く。 | draftであり、精算額・実入金・負担額の確認が必要。 |
| monthly report `MR_p06_202603` / project_knowledge `cf91eafa-949d-46db-89fe-2ff8c28804a8` | draft/active | `survival_cash_or_grant` | `cash_conversion_review_source` | `review-only` | freee/銀行入出金の確認運用を売上実績にしない。 | 決済済/未決済の確認方針で、実額PLではない。 |
| monthly report `MR_p06_202602` | draft | `survival_cash_or_grant` | `grant_or_policy_cash` | `usable source` | AMED収支管理体制を粗利加算しない。 | runway/admin sourceとしては有用だが金額・入金時期は未接続。 |
| xrl evidence `6253bafa-b797-4926-aaa0-2c3de1a1dbcf` / project_knowledge `04a9284c-8936-4923-8813-4af97e5cd9fe` | candidate/active | `grant_or_policy_cash` | `future_grant_path_source` | `review-only` | Go-Tech/NEDO DTSU検討を採択済み資金にしない。 | 検討・候補段階であり、採択/交付/入金未確認。 |

### 7軸で説明できること

- 創薬としては小動物試験完了後の設立/参画が普通のタイミングだった、というレーン固有readinessで説明できる。
- HRLは、資金調達失敗後のまさ退任とAMED採択後の事務対応への役割再配分という経時変化で説明すべき。

### PRSで追加説明できること

- R_netがゼロでも、創薬ではSを外部資金・薬事/ライセンス/EXIT構造で確保しうる、という重要な反例を提供する。
- P大/R_netゼロを単純に失敗としないガードを要求する。

### 反例/危険な誤判定

- `R_net=低い -> NO_GO` はCTBに対して危険。創薬の売上ゼロ期間は構造的であり、外部資金の獲得可能性を別観測する必要がある。
- AMED等の助成金をR_netに混ぜると、粗利貢献と非希薄化資金が混ざる。

### 次に必要な観測データ

- AMED資金の金額、期間、使途、自己負担/後払い条件。
- 次ラウンド/ライセンス/共同研究の確度。
- 創薬レーン専用のS観測項目: 非希薄化資金、薬事進捗、製薬提携、EXIT可能性。

### rubric化してよいかの暫定判定

`counterexample_guard_needed`

CTBはR_net rubricを作る前に必ずガード化するべき反例。

## 4. p07 LiSTie

### Pの仮説

- 仮説: high
- 確認済み根拠: 2030年売上300億円、IPO FY32、IPOまでの資金需要100億円級というロードマップがある。BESS/EV電池・リチウム資源安保の追い風も強い。
- 未確認: LiSTie固有の技術/販路が市場上限をどこまで取れるか。RecycLi/RiCube等との関係、大学シーズ起点は要確認。

### R_netの仮説

- 粗利貢献: 本命LISMICユニット装置販売前に、リチウムリサイクルで年4.2〜12億円規模の先行売上を立てる計画がある。
- 運営コスト: 原料調達、精製、販売スキーム、装置・ラボ・人員コストが必要。補助金は支出後入金で運転資金を圧迫する。
- 本命PJへのリソース毀損: リサイクル先行が本命装置販売への橋渡しなら正のR_net。短期商流対応でLISMIC開発が遅れるなら毀損あり。

### Finance/Cash source classification

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| xrl evidence `0aa71b29-915c-43d8-86ee-060d87217f09` | candidate | `su_revenue_candidate` | `bridge_business_revenue_candidate` | `review-only` | NDA/MOU方針を受注・入金実績にしない。リサイクル商流と本命LISMIC装置Pを足さない。 | 受注、契約、単価、粗利、入金条件、本命開発への影響が未確認。 |
| project_knowledge `04151001-a05c-489d-b961-a64ef6f49b1d` | active | `su_revenue_candidate` | `commercial_pipeline_source` | `review-only` | ブラックマス買取/リサイクルリチウム販売先候補を実績粗利にしない。 | 顧客/商流候補で、販売単価・契約・原価・入金が未接続。 |
| xrl evidence `fb0bd2de-2c62-42bb-ae0f-020b620129cf` | candidate | `su_revenue_candidate` | `cost_structure_source` | `review-only` | 技術/前処理コスト課題を粗利率そのものとして扱わない。 | コスト課題sourceであり、粗利額・原価表ではない。 |
| project_knowledge `5d5525f5-21d4-49e2-a7ee-5e8dba396de1` | active | `su_revenue_candidate` | `operating_cost_source` | `usable source` | 初期R&D費用回収難をR_net押し下げsourceとして置き、売上候補と相殺せず別表示する。 | 数千tミニマム等の制約は強いが、実支出・粗利値は未確認。 |
| project_knowledge `cd5e86d0-ec74-45aa-9a15-d4237e974610` | active | `su_revenue_candidate` | `capex_fixed_cost_source` | `usable source` | 柏市物件/初期費用5,000万円見込みを運営コスト候補に留め、実支出扱いしない。 | 見込み段階であり、契約・支払・資金繰りへの反映が未確認。 |
| xrl evidence `7e6b65ac-5399-4dd9-b6f4-4ce35d5c2f19` | candidate | `debt_or_equity_cash` | `debt_or_equity_cash` | `usable source` | 融資/投資をR_net粗利へ加算しない。runway/cash sourceとして分離する。 | 融資実行・投資委員会段階の混在、条件・入金時期・希薄化影響が未接続。 |
| xrl evidence `ba404315-ee28-4f44-9156-9a2165103982` | candidate | `survival_cash_or_grant` | `grant_or_policy_cash` | `usable source` | Startup Global最大2億円を売上粗利にしない。後払い/自己負担/使途制限を別確認する。 | 契約/KPI sourceであり、交付条件・入金時期・支出先行の影響が未確認。 |
| xrl evidence `1a79aa9b-f67a-4bef-b057-d78cca940cb1` | candidate | `validation_value_source` | `policy_demo_validation_source` | `review-only` | TYK実証を販売実績にしない。評価データ/BRL/SRL補助として扱う。 | 試運転段階で、売上/粗利/入金との接続が未確認。 |

### 7軸で説明できること

- リチウム資源安保、UMI/SBIR/QST、TRL/HRL/SRLの上昇は7軸で説明できる。
- 設立GO寄りの根拠はsigma_SU/TRL/HRL/FRLで大筋説明可能。

### PRSで追加説明できること

- GO後の生存設計として、リサイクル先行売上と補助金後払いのキャッシュ制約をR_netで表現できる。
- 系統I「本命前の別系統つなぎ事業」の代表例になる。

### 反例/危険な誤判定

- リサイクル売上をそのまま高R_netにしない。入金タイミング、原料/外注コスト、運転資金、装置開発への集中度を差し引く必要がある。
- LSTのrocket性そのものは7軸でも説明できる。PRS差分は自走性の中身に限定する。

### 次に必要な観測データ

- リサイクル商流別の売上、粗利、入金サイト、在庫/原料コスト。
- 補助金の後払い条件と資金繰り影響。
- 本命LISMIC開発リソースとの競合状況。

### rubric化してよいかの暫定判定

`ready_for_rubric_draft`

ただし「観測項目 draft」まで。値付けrubricや0-9表は、粗利/入金/毀損データを見てから。

## 5. p09 JOYCLE

### Pの仮説

- 仮説: medium
- 確認済み根拠: 産廃・GXサーキュラーの市場は大きい一方、JOYCLE固有では設立時SaaSで自社技術なし、後から群馬大野田先生の流動層熱分解へdeep化を試みた段階。
- 未確認: JB-02A完成後の本命deeptech装置が実際に取れる市場上限。産廃全体市場と熱分解油/装置市場をどう分けるか。

### R_netの仮説

- 粗利貢献: JB-02は完成済み、JB-02Aは設計中で販売前夜。現時点で販売実績は未確認。
- 運営コスト: 装置開発、野田先生技術の実装、産廃顧客獲得にはR&D投資が必要。
- 本命PJへのリソース毀損: 目先売上や装置販売前夜が本命deeptech R&Dを支えるか、逆にR&D投資縮小の口実になるかを分けて見る。株主/bizdev方針や退任理由の口述由来部分は `confirmed_by_masa` 未満なので、damage guard理由には直接混ぜない。

### AMD support end current truth

| field | value | source / guard |
|---|---|---|
| `support_end_status` | `ended_current_truth_candidate` | `projects.status='ended'`、`projects.end_ym='202603'`、`project_ventures.narrative_text`、`project_ventures.master_md_text`、`jc.md` |
| `support_end_date` | `2026-03` | `projects.end_ym='202603'` と knowledge `jc.md` の終了月が一致 |
| `support_end_db_gap` | `project_ventures.amd_support_ended_at_null` | `project_ventures.amd_support_ended_at` だけがstale候補。DB全体を古いとは扱わない |
| `current_truth_classification` | `db_stale_knowledge_current` | `projects.status/end_ym` と narrative/master md は終結側、正規化カラムだけNULL |
| `damage_guard_use` | `review-only` | support end日とdamage理由を分け、口述由来理由は正式damage根拠にしない |
| `do_not_use_as` | 正のR_net、販売実績、正式damage value | JB-02/JB-02A販売前夜、見学会、有償テスト、量産計画は契約/請求/入金/原価/本命R&D影響が揃うまで使わない |

補足: `billing_cycles` は202512/202601のAMD請求・入金確認と202602請求処理の補助sourceにはなるが、JOYCLE本体の売上・粗利、PRS本体、damage/reinvestmentには使わない。

### Finance/Cash source classification

今回のfinance分類で追加sourceは薄い。p09はdamage guard/source pack側の対象であり、finance/cash source packのsource idを本体R_netへ採用しない。販売前夜・装置候補を実績R_netへ戻すのは危険なので、damage/reinvestment source packとcurrent truth reviewの分類を `review-only` で戻す。

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| `projects` p09 | confirmed DB row | `support_end_current_truth` | `projects_ended_202603` | `review-only` | AMD/ARMADA業務PJ終了の正規化DB current truth。damage理由やJOYCLE本体粗利へ転記しない。 | 終了月sourceであり、R_net値・damage値ではない。 |
| `project_ventures` p09 `narrative_text` / `master_md_text` | confirmed DB text | `support_end_current_truth` | `venture_text_support_end_202603` | `review-only` | narrative/master mdは終結側。`amd_support_ended_at=NULL`だけを継続根拠にしない。 | 非正規化text sourceなので、正規化カラム補正は別OS/DB判断が必要。 |
| `project_ventures.amd_support_ended_at` | stale candidate | `source_hygiene_issue` | `project_ventures.amd_support_ended_at_null` | `review-only` | NULLをAMD関与継続根拠にしない。DB全体が古いとは言わず、このカラムだけstale候補にする。 | DB補正は本成果物の対象外。 |
| `/Users/masa/projects/knowledge/jc.md` | confirmed knowledge / oral history mixed | `damage_guard_candidate` | `support_end_and_oral_reason_mixed` | `review-only` | 2026-03終結はcurrent truth候補。株主/bizdev・退任理由の口述部分は `confirmed_by_masa` 未満としてdamage理由へ直接混ぜない。 | support end日とdamage理由のsource statusが違う。 |
| p09 monthly_reports / project_knowledge / source_cache（source inventory上の候補） | mixed | `damage_guard_candidate` / `reinvestment_unverified` / `future_or_draft_plan` | `damage_guard_research_target` | `review-only` | JB-02/JB-02A販売前夜、装置見学会、有償テスト、量産計画を正のR_netにしない。売上候補と本命R&D毀損を分ける。 | 装置原価、販売予定単価、導入/保守、R&D予算推移、AMD関与終結前後ログが未接続。 |
| `billing_cycles` p09 rows | mixed / AMD billing | `amd_billing_or_research_contract` | `amd_billing_cash_timing_only` | `exclude from PRS` | AMD請求/cash timing補助に限定し、PRS本体・JOYCLE本体粗利・damage/reinvestmentへ使わない。 | AMD billingであり、SU本体PLでもdamage sourceでもない。 |

### 7軸で説明できること

- 設立時SaaSで自社技術なし、TRL=0のNO_GOは7軸で説明できる。
- AMD関与後に野田先生が入り、TRL/BRLが上がったdeep pivotは7軸で追える。

### PRSで追加説明できること

- TRLが上がった後に、目先収益・株主/bizdev方針が本命R&Dを毀損してAMD関与終結へ向かったことを説明できる。
- 「収益化」は正とは限らず、本命価値を壊す damage guard / 本命毀損候補になりうる、という強い差分。

### 反例/危険な誤判定

- 設立時NO_GOをPRSの成果にしない。7軸で十分。
- 装置販売前夜を正のR_netと早合点しない。販売が本命R&Dを支えるか、R&D削減の言い訳になるかを分ける。

### 次に必要な観測データ

- JB-02/JB-02Aの原価、販売予定単価、粗利、顧客候補、導入コスト。
- R&D予算の推移、AMD関与終結前後の研究開発投資方針。
- 株主/bizdevの意思決定ログと、本命技術実装の進捗停止/遅延の対応。ただし口述由来部分は `confirmed_by_masa` 未満の間、正式damage理由にはしない。

### rubric化してよいかの暫定判定

`counterexample_guard_needed`

JOYCLEは `damage guard` / `本命毀損候補` を作るための中核事例。正の売上候補と本命毀損候補を分けずにrubric化するのは危険。

## 6. p11 BWE

### Pの仮説

- 仮説: high
- 確認済み根拠: RED塩分濃度差発電は、公開資料上で原子力発電所約1,000基分相当のポテンシャルと整理されている。SIP採択、東京都実証など政策資金もある。
- 未確認: グローバルポテンシャルがBWE固有の取れる市場に変わる確度。装置面積、顧客設置条件、膜調達が市場上限をどこまで制限するか。

### R_netの仮説

- 粗利貢献: 本命RED装置販売は2029年目標で、設立初期の粗利はまだ見えにくい。膜外販がつなぎ収益候補。
- 運営コスト: 大型装置は初販売まで重く、イオン交換膜調達が最大ボトルネック。SIP/実証の管理コストも大きい。
- 本命PJへのリソース毀損: 膜外販はつなぎになりうるが、膜そのものが本命技術のボトルネックでもあるため、外販が本命装置開発を食う危険がある。

### Finance/Cash source classification

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| source_cache `p11_gmeet_minutes_198e5a68b13c43ea` | unknown | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | SIP収入・経理管理をSU本体販売粗利にしない。 | SIP/共同研究cash sourceで、BWE本体PL・粗利・入金条件との接続が未確認。 |
| source_cache `p11_gmeet_minutes_1990d8b496887caa` | unknown | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | SIP支払い/立替精算/遅延損害金をR_net粗利にしない。 | reimbursement/cash conversion sourceで、SU販売粗利ではない。 |
| `billing_cycles` `720566d5-64c3-4172-a00d-3f519e53da2b` ほか p11 future rows | not_started / invoice_sent mixed | `amd_billing_or_research_contract` | `amd_billing_row` | `exclude from PRS` | `billing_cycles` はAMD請求。SU本体売上・粗利へ転記しない。 | future/AMD billing rowであり、本体PLではない。 |
| `2026-06-01-prs-l2-source-inventory.md` / BWE GP30%メモ | candidate | `su_revenue_candidate` | `bottleneck_external_sale_candidate` | `review-only` | 膜外販GP30%候補を、供給余力・本命RED影響なしに正のR_netにしない。 | 元row、単価、原価、供給余力、外販先、本命装置影響が未確認。 |
| monthly report `p11_202612` | draft | `future_or_draft_plan` | `future_plan_source` | `review-only` | 住友理工条件交渉/10kW PoC/シード準備を実績扱いしない。 | future draftであり、契約・入金・粗利の確認がない。 |
| source_cache `p11_gmail_1987e26bfa8c4a6f` | unknown | `grant_or_policy_cash` | `grant_or_policy_cash` | `usable source` | SIP C(1)共同研究契約案を粗利にしない。政策実証/共同研究evidenceとして分離。 | 契約案であり、交付/入金/管理コストは未確認。 |
| monthly report `p11_202611` / `p11_202612` | draft | `grant_or_policy_cash` | `policy_demo_source` | `review-only` | SIP最終報告・PoC・行政対応をR_net粗利に混ぜない。 | future draftであり、実証資金の入金条件・自己負担が未確認。 |
| source_cache `p11_slack_1745979366_346149` | unknown | `validation_value_source` | `policy_demo_validation_source` | `review-only` | 試運転/山大契約/SPD訪問予定を売上実績にしない。 | 実証予定sourceで、販売・粗利・入金は未確認。 |

### 7軸で説明できること

- SIP採択、政策マクロ、SU設立要請、TRL4/BRL3/HRL3程度の設立GOは7軸で説明できる。
- CEO/COOの経営未熟はHRL/FRLで説明できる。

### PRSで追加説明できること

- GOはできるが、設立後の初期キャッシュ自走が細いことを説明できる。
- 「高P・政策資金あり」でも、本命販売まで長い大型装置PJではR_net観測が必要と示せる。

### 反例/危険な誤判定

- BWEをR_net不足だけでNO_GOにするのは早い。SIP/政策資金/実証は7軸上のGO根拠。
- 膜外販をR_net候補と見ても、未確定かつ本命ボトルネックなので、安易に正のR_netへ置かない。

### 次に必要な観測データ

- 膜単体の量産可否、単価、粗利、外販先、供給余力。
- RED装置の初号機販売までのburn、実証資金の入金条件。
- 膜外販が本命RED装置開発に与えるリソース影響。

### rubric化してよいかの暫定判定

`needs_more_evidence`

初期自走性の弱さは重要だが、膜外販が未確定のためrubric draftにはまだ早い。

## 7. p18 Yellow Duck

### Pの仮説

- 仮説: low
- 確認済み根拠: 波力発電は原理的にコストが合いにくく、公開情報でも発電コストが高い。各VCのDDでUE成立せず、ue_failとしてAMD関与が終結した。
- 未確認: Yellow Duck固有技術が波力レーン全体の構造的不利を覆せる余地。設立日・現状も不明。

### R_netの仮説

- 粗利貢献: 販売未到達。CEO自己資金で試作品を作っていた段階。
- 運営コスト: 海上実証、製造、設置、腐食/付着対策、維持管理コストが重い。
- 本命PJへのリソース毀損: 本命自体のUEが成立しにくく、つなぎ収益以前に本命販売が立たない。短期収益による毀損というより、低P/UE不成立。

### Finance/Cash source classification

今回のfinance分類で追加sourceは薄い。p18は実DB/L2が薄く、finance/cash source pack対象外。Yellow Duck型はfinance分類よりもUE/LCOE/市場構造researchを優先する。

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| `/Users/masa/projects/knowledge/yd.md` / `before_zero_theory.md` | knowledge | `future_or_draft_plan` | `ue_margin_research_target` | `review-only` | 低P/UE不成立をP側とR_net側で二重加点/二重減点しない。技術PoCを商用UE成立にしない。 | LCOE、製造/設置/保守、VC DD論点、類似SU failureが未接続。 |
| 追加finance source | not currently available | - | - | `exclude from PRS` | finance source不足をもってR_net値を確定しない。 | next research対象。 |

### 7軸で説明できること

- BRL/HRLの弱さ、資金調達サポートに留まった限定関与は7軸でも一部説明できる。
- ただしTRL=4の試作進捗だけではNO_GOを出しにくい。

### PRSで追加説明できること

- 技術PoCが進んでも、事業の天井やユニットエコノミクスが弱いと成立しないことをP/R_netで説明できる。
- 「TRLゲートを通るが事業として筋が悪い」対照群になる。

### 反例/危険な誤判定

- YDを単なるBRL不足に潰すと、UE不成立という本質が消える。
- 波力レーン全体のP評価とYellow Duck固有Pを混同しない。

### 次に必要な観測データ

- Yellow Duck固有のLCOE、製造/設置/保守コスト、想定売電/販売単価。
- VC DDでNO_GOになった具体論点。
- 海外類似SUの失敗理由を、P/R_net観測項目へどう反映するか。

### rubric化してよいかの暫定判定

`ready_for_rubric_draft`

ただし低P/UE不成立の観測項目に限定。一般的なR_net値付けにはまだ使わない。

## 8. p20 CryoX

### Pの仮説

- 仮説: high
- 確認済み根拠: 量子コンピュータ冷却、極低温分析装置、データセンター冷却など複数の大きな射程がある。NIMS神谷氏の長期研究、Kiutra競合実績、量子/極低温のマクロ追い風もある。
- 未確認: CryoXのプランBがどの市場から実際に収益化するか。データセンター冷却とアカデミア向け冷却機ではPの天井が異なる。

### R_netの仮説

- 粗利貢献: 初期はTES自社生産×冷却機パッケージで、アカデミア市場向けテスト販売を想定。利益度外視で事例・評価データ獲得を優先するため、短期粗利は限定的かもしれない。
- 運営コスト: TES自社生産、テスト販売CAPEX、CEO体制、NIMS実施許諾、自社IP、月500-600万円程度のburn仮置きがある。
- 本命PJへのリソース毀損: アカデミア向け販売が評価データと資金を生むなら正。ただし受託/個別対応で人手を奪う場合は本命CryoX開発を毀損しうる。

### Finance/Cash source classification

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| meeting summary `5hv3utbm3cn8vlkk4p3th3pios` | confirmed/candidate | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | NIMS税込100万円未満契約をSU本体売上・粗利にしない。本命冷却機市場PとNIMS契約cashを分ける。 | 契約/請求/入金/原価と、AMD/NIMS業務委託かSU本体売上かの最終ラベル確認が必要。 |
| strategy signal `aad6dc9e-240c-42ec-9f63-27bcea20a91d` | candidate | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | 見積依頼を売上実績にしない。 | 見積依頼段階で、契約・入金・原価未確認。 |
| strategy signal `9b080419-4df5-4cd8-8578-cd78b8099c34` | candidate | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | 6月現場活動予定をR_net粗利にしない。 | 契約/請求/入金/原価の突合が必要。 |
| `billing_cycles` `e1c409f6-18d8-4729-8452-de208955e448` / `b15713d4-2175-41c1-8c6f-0091a0aa57f2` / `c98648e2-8d16-425c-b65e-a237cc1b6d79` | not_started | `amd_billing_or_research_contract` | `amd_billing_row` | `exclude from PRS` | 202607-202609 `budget_yen=188500` AMD billing rowsをSU本体PLに転記しない。 | AMD請求予定で、SU本体売上・粗利ではない。 |
| meeting summary `slack-C092CF84CJV-1777271916_647919` | confirmed/candidate | `su_revenue_candidate` | `cost_structure_source` | `review-only` | コスト整理/調達額シミュレーションの存在を正式粗利値にしない。 | シート/資料の実数、販売単価、原価、CAPEXが未接続。 |
| strategy signal `91bf2e92-2383-4563-abc3-d0e812e5916e` | candidate | `su_revenue_candidate` | `capex_margin_review_source` | `review-only` | 販売原価/CAPEXすり合わせをR_net値にしない。 | 金額感のsource候補で、正式値ではない。 |
| meeting summary `5jj2i4e0so5f4valupne18ujha` | confirmed/candidate | `survival_cash_or_grant` | `grant_or_policy_cash` | `review-only` | VC/コンソーシアム/助成金方針を粗利にしない。 | 方針であり、採択・契約・入金ではない。 |
| strategy signal `c80306a5-b71a-4089-9430-892127f5fff1` | candidate | `grant_or_policy_cash` | `consortium_policy_source` | `review-only` | コンソーシアムモデルをSU販売粗利にしない。 | 資金調達/政策連携候補で、入金実績ではない。 |
| CX利益度外視テスト販売/有料製作候補 | candidate/mixed | `validation_value_source` | `validation_value_source` | `review-only` | 評価データ獲得を粗利として二重カウントしない。BRL/SRL/Survival補助へ分ける。 | 粗利目的か評価データ目的か、単価/原価/人員負担が未確認。 |

### 7軸で説明できること

- NIMS神谷氏の研究、プランB転換、特許出願準備、顧客候補、CEO/VC準備は7軸で説明できる。
- 設立GO/準備判断の主根拠は、sigma_SU/TRL/BRL/HRL/FRLでよい。

### PRSで追加説明できること

- 設立前後に「小さく自走しながら本命へ行く」設計をR_netで監視できる。
- 利益度外視テスト販売を、売上ではなく事例/評価データ獲得込みでどう扱うかという観測論点を出せる。

### 反例/危険な誤判定

- テスト販売があるから高R_netと見ない。利益度外視なら粗利貢献は小さく、評価データ獲得は別価値として扱う必要がある。
- CXの設立準備判断をPRSだけで説明しない。主軸は7軸。

### 次に必要な観測データ

- TES/ADR/冷却機テスト販売の単価、原価、粗利、開発人員負担。
- NIMS内製造と外部拠点のCAPEX/粗利差。
- アカデミア販売が本命市場への評価データとして機能する証拠。

### rubric化してよいかの暫定判定

`needs_more_evidence`

R_net候補はあるが、利益度外視テスト販売を粗利貢献として扱うかが未整理。

## 9. p21 SolvioraX

### Pの仮説

- 仮説: high
- 確認済み根拠: 排水処理TAM、FY35売上200億円、事業価値1,000億円という目標があり、U1〜U5まで複数ユースケースを整理済み。U4/U5には兆円級/長期のアップサイドがある。
- 未確認: U1キャッシュ層からU4/U5へ拡張できる確度。シアノバクテリア技術が各用途でどこまで勝てるか。

### R_netの仮説

- 粗利貢献: 装置販売とシアノバクテリアサブスク/重量課金の2本立て。U1メッキ・化学排水は設立後即のキャッシュ層候補。
- 運営コスト: 初期投資、O&M、固定化担体、CO2濃縮、排水前処理、GMO閉鎖系、アライアンス管理など実装レイヤが多い。
- 本命PJへのリソース毀損: U1〜U3キャッシュ層が本命への橋渡しなら正。個別PoC/受託消化、ダイキ等パートナー調整、周辺レイヤ対応でコア開発が遅れるなら毀損。

### Finance/Cash source classification

| source_id_or_path | source_status | classification | evidence_label | prs_use | double_count_guard | why_not_formal_score_yet |
|---|---|---|---|---|---|---|
| monthly report `p21_202605` | draft | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | 愛媛大学契約・発注確定をSU本体売上にしない。設立準備中の大学/AMD契約cashとして分離。 | draftで、契約主体・請求・入金・原価が未確認。 |
| meeting summary `4qqkgiatvd0p2sm4mspqr8k920_20260331T070000Z` | confirmed/candidate | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | 愛媛大学納品/見積/仕様書提出をSU販売粗利にしない。 | cash timing候補だが、SU本体収益ではなくAMD/大学契約の可能性が高い。 |
| meeting summary `43nvst4qu8ppdclf0heqd614u1` | confirmed/candidate | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | PSII予算1500万円・支払予定をU1売上/粗利に混ぜない。 | 大学/研究予算の契約・入金候補で、SU本体売上とは分離が必要。 |
| xrl evidence `3fc6e490-9f4d-4d73-ac0b-a306ffb97edf` | candidate | `su_revenue_candidate` | `poc_revenue_candidate` | `review-only` | 10件PoC・売上実績づくりを実績扱いしない。U1短期cashとU4/U5本命Pを分ける。 | PoC候補で、契約・単価・原価・入金条件は未確認。 |
| meeting summary `77836j7np0dovhcns78av79qdq` | confirmed/candidate | `su_revenue_candidate` | `unit_economics_margin_source` | `usable source` | 処理単価485円/LをU1短期cash層のUE sourceとして置き、U4/U5本命Pへ二重カウントしない。 | 出典・計算前提・処理量・O&M/導入コストの確認が必要で、正式R_net値ではない。 |
| meeting summary `6ujslfj6rjb6htj00hgp5q2srt` | confirmed/candidate | `su_revenue_candidate` | `pricing_model_source` | `review-only` | 従量課金モデルを価格体系候補として置き、粗利実績扱いしない。 | コスト・粗利・入金条件とのjoinが必要。 |
| monthly report `p21_202607` ほか future draft series | draft/future | `future_or_draft_plan` | `future_plan_source` | `review-only` | 事業計画/コスト試算/future draftを実績値にしない。 | future draftで、正式契約・実績・原価未確認。 |
| xrl evidence `1388d1cc-8e18-4cb0-8561-b3ce9f3533d5` | confirmed | `grant_or_policy_cash` | `grant_or_policy_cash` | `usable source` | 国プロ接続候補を粗利にしない。Survival/policy evidenceへ分離。 | 採択・交付・入金ではなく接続候補。 |
| monthly report `MR_p21_202604` | draft | `survival_cash_or_grant` | `grant_or_policy_cash` | `review-only` | PSI Step2をrunway/policy guardに置き、SU粗利加算しない。 | draftで、資金条件・会社設立後のPL接続が未確認。 |
| Fine-Chem/オンサイトPoC/評価データ系候補 | candidate/mixed | `validation_value_source` | `validation_value_source` | `review-only` | 利益度外視PoC/評価データをR_net粗利にしない。BRL/SRL/Survival補助へ分ける。 | PoC目的、価格、原価、コア開発への負荷が未確認。 |

### 7軸で説明できること

- PSI Step2、オンサイトPoC、TRL5到達条件、設立準備チーム、VC/DD準備は7軸で説明できる。
- 設立準備中のready状態はTRL/BRL/HRL/FRLで追える。

### PRSで追加説明できること

- U1キャッシュ層、PoC/前売上、サブスク計画をR_net候補として監視できる。
- GMO規制や顧客実装負荷による本命毀損を、S側の追加リスクとして扱える。

### 反例/危険な誤判定

- SXはまだ設立準備中で、R_net実績値を置いたふりをしない。
- U1の短期売上可能性と、U4/U5の大きなPを混ぜると、PもR_netも過大評価になりやすい。

### 次に必要な観測データ

- U1 PoCごとの単価、粗利、導入/O&Mコスト、入金条件。
- サブスク/重量課金の価格受容性、処理量、継続率。
- PoC消化がコア技術/知財/規制対応へ与えるリソース影響。

### rubric化してよいかの暫定判定

`needs_more_evidence`

監視項目としては有用だが、実績前の計画値をrubric根拠にしすぎない。

## 10. 横断メモ

### 10.1 Finance/Cash横断分類

#### R_netに入れてよい候補

ここでの「入れてよい」は正式値ではなく、R_net欄の `source candidate` として置けるという意味。契約・請求・入金・原価が揃うまでは `review-only` を基本にする。

| PJ | source_id_or_path | classification | evidence_label | prs_use | double_count_guard |
|---|---|---|---|---|---|
| p07 LiSTie | xrl `0aa71b29-915c-43d8-86ee-060d87217f09` / knowledge `04151001-a05c-489d-b961-a64ef6f49b1d` | `su_revenue_candidate` | `bridge_business_revenue_candidate` / `commercial_pipeline_source` | `review-only` | MOU/販売先候補を受注・入金実績にしない。本命LISMIC装置Pとリサイクル商流を足さない。 |
| p07 LiSTie | knowledge `5d5525f5-21d4-49e2-a7ee-5e8dba396de1` / `cd5e86d0-ec74-45aa-9a15-d4237e974610` | `su_revenue_candidate` | `operating_cost_source` / `capex_fixed_cost_source` | `usable source` | R_net押し下げsourceとして使い、売上候補と別表示する。 |
| p20 CryoX | meeting `slack-C092CF84CJV-1777271916_647919` / signal `91bf2e92-2383-4563-abc3-d0e812e5916e` | `su_revenue_candidate` | `cost_structure_source` / `capex_margin_review_source` | `review-only` | 原価/CAPEX整理を正式粗利値にしない。 |
| p20 CryoX | CX利益度外視テスト販売/有料製作候補 | `validation_value_source` | `validation_value_source` | `review-only` | 評価データ獲得を粗利扱いしない。BRL/SRL/Survival補助との二重カウントを避ける。 |
| p21 SolvioraX | xrl `3fc6e490-9f4d-4d73-ac0b-a306ffb97edf` | `su_revenue_candidate` | `poc_revenue_candidate` | `review-only` | 10件PoC/売上実績づくりを実績扱いしない。U1短期cashとU4/U5本命Pを分ける。 |
| p21 SolvioraX | meeting `77836j7np0dovhcns78av79qdq` | `su_revenue_candidate` | `unit_economics_margin_source` | `usable source` | 処理単価485円/LはU1短期cash層のUE source。U4/U5本命Pへ二重カウントしない。 |
| p21 SolvioraX | meeting `6ujslfj6rjb6htj00hgp5q2srt` | `su_revenue_candidate` | `pricing_model_source` | `review-only` | 従量課金モデルを価格体系候補に留め、粗利実績にしない。 |
| p04 輝翠TECH | `KT.md` / 既存BZM runs | `su_revenue_candidate` | `mvp_revenue_candidate` | `review-only` | Adam販売を高R_netに直結せず、保守/導入負担を差し引く。 |
| p11 BWE | BWE GP30%メモ | `su_revenue_candidate` | `bottleneck_external_sale_candidate` | `review-only` | 膜外販は供給余力・粗利・本命RED影響が揃うまで未確定R_net。 |

#### Survivalに置く候補

| PJ | source_id_or_path | classification | evidence_label | prs_use | double_count_guard |
|---|---|---|---|---|---|
| p06 CrestecBio | AMED関連 project_knowledge / monthly_reports | `survival_cash_or_grant` | `grant_or_policy_cash` / `grant_admin_burden_source` | `usable source` / `review-only` | AMED等をR_net粗利へ加算しない。売上ゼロ成立型のSurvival guardとして扱う。 |
| p07 LiSTie | xrl `7e6b65ac-5399-4dd9-b6f4-4ce35d5c2f19` | `debt_or_equity_cash` | `debt_or_equity_cash` | `usable source` | 融資/投資を粗利にしない。runway sourceへ分離する。 |
| p07 LiSTie | xrl `ba404315-ee28-4f44-9156-9a2165103982` / `1a79aa9b-f67a-4bef-b057-d78cca940cb1` | `survival_cash_or_grant` / `validation_value_source` | `grant_or_policy_cash` / `policy_demo_validation_source` | `usable source` / `review-only` | Startup Global/TYK実証を販売粗利にしない。 |
| p20 CryoX | meeting `5jj2i4e0so5f4valupne18ujha` / signal `c80306a5-b71a-4089-9430-892127f5fff1` | `survival_cash_or_grant` / `grant_or_policy_cash` | `grant_or_policy_cash` / `consortium_policy_source` | `review-only` | コンソーシアム/助成金方針を粗利にしない。 |
| p21 SolvioraX | xrl `1388d1cc-8e18-4cb0-8561-b3ce9f3533d5` / monthly `MR_p21_202604` | `grant_or_policy_cash` / `survival_cash_or_grant` | `grant_or_policy_cash` | `usable source` / `review-only` | 国プロ/PSIを粗利加算しない。 |
| p11 BWE | source_cache `p11_gmail_1987e26bfa8c4a6f` / p11 SIP・実証draft | `grant_or_policy_cash` | `grant_or_policy_cash` / `policy_demo_source` | `usable source` / `review-only` | SIP/共同研究/政策実証をR_net粗利にしない。 |

#### PRSから除外する候補

| PJ | source_id_or_path | classification | evidence_label | prs_use | double_count_guard |
|---|---|---|---|---|---|
| p20 CryoX | `billing_cycles` `e1c409f6-18d8-4729-8452-de208955e448` / `b15713d4-2175-41c1-8c6f-0091a0aa57f2` / `c98648e2-8d16-425c-b65e-a237cc1b6d79` | `amd_billing_or_research_contract` | `amd_billing_row` | `exclude from PRS` | AMD請求予定をSU本体PLへ転記しない。 |
| p11 BWE | `billing_cycles` `720566d5-64c3-4172-a00d-3f519e53da2b` ほか p11 future rows | `amd_billing_or_research_contract` | `amd_billing_row` | `exclude from PRS` | invoice/future rowがあってもAMD請求でありSU売上ではない。 |
| p06 CrestecBio | strategy signal `20f2c8b9-563a-4504-9a8f-65b9f302c647` | `amd_billing_or_research_contract` | `amd_order_pause_source` | `exclude from PRS` | AMD発注保留をSU本体売上・粗利として扱わない。 |
| p09 JOYCLE | `billing_cycles` p09 rows | `amd_billing_or_research_contract` | `amd_billing_cash_timing_only` | `exclude from PRS` | AMD請求/cash timing補助に限定し、JOYCLE本体粗利・damage/reinvestment・PRS本体へ使わない。 |
| p03/p18 | 追加finance sourceなし | - | - | `exclude from PRS` | finance source不足を正式R_net値に変換しない。 |

#### 研究契約cashとしてreview-onlyに置く候補

| PJ | source_id_or_path | classification | evidence_label | prs_use | double_count_guard |
|---|---|---|---|---|---|
| p20 CryoX | meeting `5hv3utbm3cn8vlkk4p3th3pios` / signal `aad6dc9e-240c-42ec-9f63-27bcea20a91d` / `9b080419-4df5-4cd8-8578-cd78b8099c34` | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | NIMS契約/見積/現場活動をSU本体売上から恒久分離する。 |
| p21 SolvioraX | monthly `p21_202605` / meeting `4qqkgiatvd0p2sm4mspqr8k920_20260331T070000Z` / `43nvst4qu8ppdclf0heqd614u1` | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | 愛媛大学・PSII契約cashをU1 PoC売上やU4/U5本命Pへ混ぜない。 |
| p11 BWE | source_cache `p11_gmeet_minutes_198e5a68b13c43ea` / `p11_gmeet_minutes_1990d8b496887caa` | `amd_billing_or_research_contract` / `research_contract_cash` | `research_contract_cash` | `review-only` | SIP収入/立替精算をSU販売粗利として扱わない。 |

#### JOYCLE current truth gap / source hygiene

| PJ | source_id_or_path | classification | evidence_label | prs_use | double_count_guard |
|---|---|---|---|---|---|
| p09 JOYCLE | `projects.status='ended'` / `projects.end_ym='202603'` | `support_end_current_truth` | `projects_ended_202603` | `review-only` | support end日確認に使い、damage理由・R_net値・JOYCLE本体粗利に転記しない。 |
| p09 JOYCLE | `project_ventures.narrative_text` / `project_ventures.master_md_text` / `jc.md` | `support_end_current_truth` | `venture_text_support_end_202603` | `review-only` | 終結側sourceとして使う。ただし口述由来の終結理由は `confirmed_by_masa` 未満のままdamage guard理由へ直接混ぜない。 |
| p09 JOYCLE | `project_ventures.amd_support_ended_at=NULL` | `source_hygiene_issue` | `project_ventures.amd_support_ended_at_null` | `review-only` | NULLを継続根拠にしない。DB全体ではなく正規化カラムだけstale候補として扱う。 |

### 10.2 事例型メモ

| 型 | 該当PJ | PRSで見る意味 | ガード |
|---|---|---|---|
| 高P・低/未確定R_net | ティエム、BWE | 本命の天井は大きいが生存設計が弱い | 7軸のGO/NO_GOを上書きしない |
| 本命前つなぎ自走 | LiSTie、CryoX、ティエム反実仮想 | 本命前の粗利でburnを支える | つなぎが本命を遅らせないかを見る |
| 本命前倒し収益 | 輝翠TECH、SolvioraX計画 | 本命MVP/PoC/サブスクを早期収益化する | 導入/保守/個別対応コストを差し引く |
| damage guard / 本命毀損候補 | JOYCLE | 目先収益が本命R&Dを毀損する可能性をreview-onlyで見る | 正の売上候補と正のR_netを混同しない。口述由来理由は正式damage理由にしない |
| 低P/UE不成立 | Yellow Duck | 技術PoCがあっても事業の筋が悪い | BRL不足だけに潰さない |
| R_netゼロでも成立 | CrestecBio | 創薬は売上ゼロ期間を外部資金/薬事/EXITで耐える | R_net低値でNO_GOにしない |

## 11. 司令塔判断事項

1. `research_contract_cash` は `amd_billing_or_research_contract` の下位ラベルとして採用済み前提でv3へ継続反映した。今後のreviewでは、p20 NIMS / p21 愛媛大学・PSII / p11 SIPをSU本体売上から分離する運用を継続するか確認する。
2. `billing_cycles` は原則 `exclude from PRS` とした。cash timing補助にだけ `review-only` を許す運用でよいか、BZM司令塔レビューで再確認する。
3. p21の処理単価485円/Lは `usable source` としてR_net欄へ置いたが、正式R_net値ではない。U1短期cash層とU4/U5本命Pの二重カウント防止ラベルを必須にする。
4. p07/p20/p21の `su_revenue_candidate` を、いつ `review-only` から正式なusable sourceへ上げるか。最低条件は、契約/請求/入金/原価/本命毀損の突合。
5. p09 JOYCLEは `support_end_status=ended_current_truth_candidate` / `support_end_date=2026-03` / `support_end_db_gap=project_ventures.amd_support_ended_at_null` / `damage_guard_use=review-only` として採用するか。あわせて `project_ventures.amd_support_ended_at` 補正はOS/DB workerへ切り出すか。
6. p09の終結理由のうち、口述由来部分を `confirmed_by_masa` 未満として追加source待ちにする運用でよいか。
7. p03/p04/p18は今回のfinance分類で追加sourceが薄い。次に進めるなら public/knowledge research、UE/LCOE research に分ける。
8. R_net rubric draftへ進む場合も、0-9値表、DB列、正式score、過去score再計算は引き続き行わない。

## 12. 次アクション

1. BZM司令塔が本v3カードをレビューし、finance/cash分類と JOYCLE current truth / damage guard分類の `classification` / `evidence_label` / `prs_use` / `double_count_guard` を採用・差し戻し判定する。
2. OS司令塔へ渡すなら、p09の `project_ventures.amd_support_ended_at=NULL` を source hygiene issue としてDB補正worker化する。
3. p09はsupport end日と終結理由を分け、口述由来理由は `confirmed_by_masa` 未満として追加source確認またはまさ/BZM判断待ちにする。
4. p21は処理単価485円/L・従量課金モデルの出典/計算前提、U1とU4/U5分離を追加確認する。
5. p20はNIMS研究契約cashと利益度外視テスト販売/評価データ価値を分ける。
6. p07はリサイクル商流の契約/粗利/入金サイト/補助金後払い/本命LISMIC影響をjoinする。
7. p06/p11はSurvival guard中心で、AMED/SIP/政策実証をR_net粗利に混ぜない運用を維持する。

## 13. 自己レビュー

- P/R_netの正式rubricは作っていない。
- 0-9 score表は作っていない。
- 各PJでP仮説、R_netの3項分解、7軸で説明できること、PRSで追加説明できること、反例/危険な誤判定、次に必要な観測データ、rubric化暫定判定を入れた。
- 各PJに `Finance/Cash source classification` を追加した。
- 各sourceに、できる範囲で `source_id_or_path` / `source_status` / `classification` / `evidence_label` / `prs_use` / `double_count_guard` / `why_not_formal_score_yet` を付けた。
- `prs_use` は `usable source` / `review-only` / `exclude from PRS` の3値で統一した。
- `research_contract_cash` を `amd_billing_or_research_contract` の下位ラベルとして反映し、p20 NIMS / p21 愛媛大学・PSII / p11 SIPをSU本体売上から分離した。
- `billing_cycles` は原則 `exclude from PRS` とし、R_net粗利に混ぜていない。
- p09 JOYCLEの `billing_cycles` はAMD請求/cash timing補助に限定し、PRS本体・JOYCLE本体粗利・damage/reinvestmentには使わないと明記した。
- p21の処理単価485円/Lと従量課金モデルは `su_revenue_candidate` として置き、U1短期cashとU4/U5本命Pの二重カウント防止を明記した。
- 9PJ横断で、R_netに入れてよい候補、Survivalに置く候補、PRSから除外する候補、研究契約cashとしてreview-onlyに置く候補、JOYCLE current truth gap / source hygiene issueを一覧化した。
- CTBをR_net低値でNO_GOにしていない。
- JOYCLEの本命毀損を `damage guard` / 本命毀損候補として明示し、正式用語はその表現に統一した。
- JOYCLEは `support_end_status=ended_current_truth_candidate`、`support_end_date=2026-03`、`support_end_db_gap=project_ventures.amd_support_ended_at_null`、`damage_guard_use=review-only` として戻した。
- JOYCLEの分類は `db_stale_knowledge_current`。ただしDB全体ではなく、`project_ventures.amd_support_ended_at` 正規化カラムだけがstale候補であると明記した。
- `projects.status='ended'` / `projects.end_ym='202603'`、`project_ventures.narrative_text`、`project_ventures.master_md_text` は終結側sourceとして扱った。
- 終結理由の口述由来部分は `confirmed_by_masa` 未満として扱い、damage guard理由には直接混ぜていない。
- 確認済み根拠、仮説、未確認、反例を見出し単位で分け、同じ文で混ぜないようにした。
- DB write、DDL、migration、extractor実装、コード実装、deploy、0-9 score表作成、R_net値付け、正式rubric確定、現行7軸AMD Score置換、過去score再計算は行っていない。
