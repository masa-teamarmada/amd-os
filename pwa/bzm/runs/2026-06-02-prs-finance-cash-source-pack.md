# P/R_net finance and cash source pack

作成日: 2026-06-02
作成者: BZM理論検証worker
ステータス: BZM司令塔レビュー待ち

## 0. この成果物の扱い

このファイルは、PRS comparison layer の `P/R_net/Survival guard` 検証に向けた finance / cash conversion / grant 系 source 候補 pack である。

- 対象PJ: p07 LiSTie / p20 CryoX / p21 SolvioraX / p06 CrestecBio / p11 BWE。
- 対象flag: `r_revenue_unverified`, `r_gross_margin_unverified`, `r_operating_cost_unverified`, `r_cash_conversion_unverified`, `s_grant_unverified`。補助として `s_policy_demo_unverified`。
- DB write、DDL、migration、extractor実装、deploy、0-9 score表作成、R_net値付け、正式rubric確定は行っていない。
- `billing_cycles` は AMD への業務委託請求 / 入金確認であり、SU本体の売上・粗利とは混同しない。使う場合は `billing_cycles AMD billing` と明示する。
- 助成金 / 政策資金 / 実証採択は R_net の粗利へ加算せず、Survival guard / cash runway evidence 候補として扱う。
- `candidate` / `draft` / `upcoming` は実績扱いしない。

確認したもの:

- `pwa/bzm/COMMANDER_TASKS.md`
- `pwa/bzm/runs/2026-06-01-prs-unverified-source-map.md`
- `pwa/bzm/runs/2026-06-01-prs-l2-source-inventory.md`
- `pwa/bzm/runs/2026-06-01-prs-pr-rnet-evidence-cards.md`
- `pwa/bzm/runs/2026-06-01-prs-rnet-guard-memo.md`
- `pwa/bzm/runs/2026-06-01-prs-pr-rnet-observation-items-draft.md`
- `pwa/design/L2_DATA.md`
- `pwa/design/db_schema.md`
- `pwa/spec/3-1-l2-data-extraction-current-spec.md`
- `pwa/spec/3-2-monthly-reports-current-spec.md`
- `pwa/spec/3-3-meeting-flow-current-spec.md`
- `pwa/spec/3-6-strategy-signals-current-spec.md`
- `pwa/manual/3-2-data-and-extraction.md`
- Supabase read-only SELECT: `projects`, `monthly_reports`, `project_meeting_summaries`, `project_strategy_signals`, `billing_cycles`, `project_knowledge`, `project_xrl_evidence`, `source_cache`, `project_pl_monthly`
- `/Users/masa/projects/knowledge/{ctb,LST,BWE,cx,sx}.md` 周辺検索
- `/Users/masa/.codex/automations/amd-os*/applied` / `outbox` 周辺の存在確認

## 1. 全体結論

| 結論 | 内容 |
|---|---|
| SU本体の売上・粗利に直結できる source はまだ限定的 | p07/p20/p21 は売上・契約・PoC・販売仮説の候補があるが、粗利 / 原価 / 入金サイトは join と人間レビューが必要。p06/p11 は助成金・政策・管理コストが中心。 |
| `billing_cycles` は cash conversion 補助に使えるが別ラベル必須 | p11/p20 などに AMD請求 row があるが、これは SU本体PLではなく AMDの業務委託請求 / 入金確認。R_net粗利 source としては `unsafe_to_infer`。 |
| 助成金・政策資金は Survival guard 側が主 | p06 AMED、p07 Startup Global/NEDO/SBIR、p11 SIP/東京都実証、p20 government grant/consortium、p21 PSI/国プロ接続候補は runway / policy demo source として有用。 |
| future draft が混じる | `monthly_reports` には 2026後半〜2027 draft が含まれる。事業計画・予定のsource候補にはなるが、現時点の実績扱いは禁止。 |
| `project_pl_monthly` は対象5PJで0件 | SU別PL / gross margin の直接テーブルとしては今回使えない。 |

## 2. Source 候補一覧

### p07 LiSTie

| flag | source type | source id / path | source status | evidence summary | PRSで使うなら | 注意点 |
|---|---|---|---|---|---|---|
| `r_revenue_unverified` | xrl evidence | `ba404315-ee28-4f44-9156-9a2165103982` | candidate | Startup Global 最大2億円の契約締結とKPI確定が進み、海外展開支援の外部資金根拠になり得る。 | available_but_needs_join | 外部資金であり売上粗利ではない。Survival guard 寄りに分ける。 |
| `r_revenue_unverified` | xrl evidence | `0aa71b29-915c-43d8-86ee-060d87217f09` | candidate | 5/27取締役会で、リサイクラー3社とのNDA、MOU獲得方針、装置メーカー連携、ブラックマス調達先協議が共有された。 | available_now | MOU方針であり受注/入金実績ではない。 |
| `r_revenue_unverified` | project_knowledge | `04151001-a05c-489d-b961-a64ef6f49b1d` | active | マンガン系・LFP系ブラックマス買取とリサイクルリチウム販売先として関心。 | available_but_needs_join | 顧客/商流候補。販売単価・契約・入金は別sourceが必要。 |
| `r_gross_margin_unverified` | xrl evidence | `fb0bd2de-2c62-42bb-ae0f-020b620129cf` | candidate | 膜寿命を伸ばす間欠的な電圧印加データ、QC協力の加速試験、前処理コスト課題への代替技術検討が共有された。 | available_but_needs_join | 技術・コスト課題の候補。粗利率そのものではない。 |
| `r_gross_margin_unverified` / `r_operating_cost_unverified` | project_knowledge | `5d5525f5-21d4-49e2-a7ee-5e8dba396de1` | active | 数千tレベルがミニマムとされ、初期にはR&D費用回収が難しい可能性。 | available_now | R_netを押し下げる運営コスト / スケール制約 evidence 候補。 |
| `r_operating_cost_unverified` | project_knowledge | `cd5e86d0-ec74-45aa-9a15-d4237e974610` | active | 柏市柏田中の2,727平米物件、建物1,000平米、初期費用5,000万円程度見込み。 | available_now | CAPEX / fixed cost 候補。実支出ではなく見込み。 |
| `r_cash_conversion_unverified` / `s_grant_unverified` | xrl evidence | `7e6b65ac-5399-4dd9-b6f4-4ce35d5c2f19` | candidate | 日本政策金融公庫8,000万円融資完了、DG Daiwa Ventures 1億円投資委員会が6月に進む。 | available_now | 融資/投資であり粗利ではない。runway source。 |
| `s_grant_unverified` / `s_policy_demo_unverified` | xrl evidence | `ba404315-ee28-4f44-9156-9a2165103982` | candidate | Startup Global 最大2億円の契約締結とKPI確定。 | available_now | 後払い条件・自己負担・使途制限の確認が必要。 |
| `s_policy_demo_unverified` | xrl evidence | `1a79aa9b-f67a-4bef-b057-d78cca940cb1` | candidate | TYK向けベンチ実証機の設置が始まり、6月初旬まで試運転を行う段階。 | available_now | 実証進捗。売上 / 粗利には直結させない。 |

### p20 CryoX

| flag | source type | source id / path | source status | evidence summary | PRSで使うなら | 注意点 |
|---|---|---|---|---|---|---|
| `r_revenue_unverified` / `r_cash_conversion_unverified` | meeting summary | `5hv3utbm3cn8vlkk4p3th3pios` | confirmed/candidate | 資金調達方針を政府系助成金・コンソーシアム優先に決定。あきが6月から週1〜2回NIMS現場訪問開始。NIMSとの新規契約を税込100万円未満で締結。 | available_but_needs_join | NIMS契約は実務契約候補として強いが、SU本体売上か AMD/NIMS業務委託かのラベル分けが必要。 |
| `r_revenue_unverified` | strategy signal | `aad6dc9e-240c-42ec-9f63-27bcea20a91d` | candidate | CryoX/NIMS案件で仕様書準備が完了し、神谷氏から税込100万円未満での見積依頼が届いた。 | available_now | 見積依頼であり入金済みではない。 |
| `r_revenue_unverified` / `r_cash_conversion_unverified` | strategy signal | `9b080419-4df5-4cd8-8578-cd78b8099c34` | candidate | NIMSとの新規契約を税込100万円未満で締結し、6月から現場活動開始予定。 | available_but_needs_join | 契約と請求・入金・原価の突合が必要。 |
| `r_gross_margin_unverified` / `r_operating_cost_unverified` | meeting summary | `slack-C092CF84CJV-1777271916_647919` | confirmed/candidate | CryoX線材とMgB2比較、露光関係スライド、コスト整理シート、調達額シミュレーション、MRI応用資料のやり取り。 | available_but_needs_join | コスト整理の存在。実数はシート/資料確認が必要。 |
| `r_operating_cost_unverified` | strategy signal | `91bf2e92-2383-4563-abc3-d0e812e5916e` | candidate | 資金調達額シミュレーション、販売原価・CAPEXの金額感すり合わせを整理。 | available_now | 原価/CAPEX論点の source 候補。値付け不可。 |
| `r_cash_conversion_unverified` | billing_cycles AMD billing | `e1c409f6-18d8-4729-8452-de208955e448` / `b15713d4-2175-41c1-8c6f-0091a0aa57f2` / `c98648e2-8d16-425c-b65e-a237cc1b6d79` | not_started | p20の202607-202609に `budget_yen=188500` の AMD billing rows が存在。 | unsafe_to_infer | AMD請求予定でありSU本体売上・粗利ではない。cash timing補助に限る。 |
| `s_grant_unverified` / `s_policy_demo_unverified` | meeting summary | `5jj2i4e0so5f4valupne18ujha` | confirmed/candidate | VC調達を再検討し、コンソーシアムモデルや助成金活用を並行検討する方針を確認。 | available_now | 方針であり採択/入金ではない。 |
| `s_policy_demo_unverified` | strategy signal | `c80306a5-b71a-4089-9430-892127f5fff1` | candidate | VC調達は時間短縮できる場合のみ検討し、大手企業コンソーシアムモデルを並行検討する方向へ転換。 | requires_masa_or_bzm_review | 政策/コンソーシアムをSurvival guardに置くか、資金調達戦略として別扱いにするか要判断。 |

### p21 SolvioraX

| flag | source type | source id / path | source status | evidence summary | PRSで使うなら | 注意点 |
|---|---|---|---|---|---|---|
| `r_revenue_unverified` | monthly report | `p21_202605` | draft | 愛媛大学との契約・発注確定、ファインケムとのPoC具体化、鉱山排水処理市場整理、VC向け論点が進展。 | available_but_needs_join | 設立準備中。契約/発注はAMD業務かSU本体かを分ける必要。 |
| `r_revenue_unverified` / `r_validation_value_unverified` | xrl evidence | `3fc6e490-9f4d-4d73-ac0b-a306ffb97edf` | candidate | Fine-Chem面談で、ガラスリソーシング経由の回収ルート、金属廃液サンプル、10件PoC、来年3月までの売上実績づくりが具体化。 | available_now | PoC/売上実績づくりの候補。実績扱い禁止。 |
| `r_gross_margin_unverified` | meeting summary | `77836j7np0dovhcns78av79qdq` | confirmed/candidate | SXのコスト分析・ビジネスモデル検討。処理単価485円/Lでは利益率が低く追加収益源が必要。 | available_now | UE / gross margin の強い候補。具体計算の出典確認が必要。 |
| `r_gross_margin_unverified` | meeting summary | `6ujslfj6rjb6htj00hgp5q2srt` | confirmed/candidate | 従量課金モデルを中心に展開する方針。重金属回収・色素分解を優先技術とする。 | available_but_needs_join | 価格体系候補。コスト・粗利・入金条件は未確認。 |
| `r_operating_cost_unverified` | monthly report | `p21_202607` ほか future draft series | draft | 市場調査・コスト試算・月次試算表・事業計画原案など、計画策定フェーズの活動が並行。 | available_but_needs_join | future draft は予定。実績扱い禁止。 |
| `r_cash_conversion_unverified` | meeting summary | `4qqkgiatvd0p2sm4mspqr8k920_20260331T070000Z` | confirmed/candidate | 2025年度納品物を愛媛大学へ納品完了。2026年度契約の見積書・仕様書を提出し手続き進行中。 | available_now | 愛媛大学契約のcash timing候補。SU本体収益ではなくAMD/大学契約の可能性が高い。 |
| `r_cash_conversion_unverified` | meeting summary | `43nvst4qu8ppdclf0heqd614u1` | confirmed/candidate | PSII予算1500万円で見積調整中、1月中提出・2月末支払予定。 | available_now | 入金サイト候補。ただしAMD業務委託 / 大学予算の分類が必要。 |
| `s_grant_unverified` / `s_policy_demo_unverified` | xrl evidence | `1388d1cc-8e18-4cb0-8561-b3ce9f3533d5` | confirmed | 閉鎖鉱山/南鳥島レアアース排水の処理テーマが、経産省担当・三菱総研/プラチナ構想ネットワーク経由の国プロ接続候補として拡張。 | available_now | 国プロ接続候補。助成金採択・入金ではない。 |
| `s_grant_unverified` / `s_policy_demo_unverified` | monthly report | `MR_p21_202604` | draft | PSI Step2 Year1完了、4月から資金調達・会社設立・PoC開拓・技術開発の本格フェーズへ移行。 | available_but_needs_join | PSIはSurvival guard。粗利加算禁止。 |

### p06 CrestecBio

| flag | source type | source id / path | source status | evidence summary | PRSで使うなら | 注意点 |
|---|---|---|---|---|---|---|
| `r_revenue_unverified` | strategy signal | `20f2c8b9-563a-4504-9a8f-65b9f302c647` | candidate/decided | 原薬異物混入に伴う状況共有。5月以降のアルマダへの発注を一旦保留し、契約は継続しつつ状況好転後に再開検討。 | unsafe_to_infer | AMD発注の保留でありSU本体売上ではない。CTB型はR_net低値でNO_GOにしない。 |
| `r_revenue_unverified` / `r_cash_conversion_unverified` | xrl evidence | `ea743ad7-db44-48ae-a318-07b771746be7` | candidate | 原薬異物混入とキャッシュフロー影響により、5月以降のARMADA発注は一旦保留。契約は維持しAMED照会後に再判断。 | available_now | cash stress source。R_net粗利ではない。 |
| `r_gross_margin_unverified` | project_knowledge | `f91e59f3-b497-4a98-924d-a4d5cfd2ea09` | active | CTB社への研究資金の出資元。外注はバイアウト契約かつ営利業務を含まないものに限定。 | unsafe_to_infer | 営利業務を含まない制約。粗利sourceではなくR_net加算禁止の根拠。 |
| `r_gross_margin_unverified` | project_knowledge | `4a6d077e-d5d0-488f-8e64-9303de2c9017` | active | AMED事業で外注可能な契約形態。研究開発に注力できる内容かつ営利業務を含まないもの。 | unsafe_to_infer | AMED外注は粗利ではない。 |
| `r_operating_cost_unverified` | monthly report | `MR_p06_202604` | draft | AMED追加確認事項への返答、収支簿・証憑・人件費精査、最終報告に向けた収支決算書作成。 | available_now | AMED管理コスト / admin burden source。 |
| `r_cash_conversion_unverified` | monthly report | `MR_p06_202603` | draft | 会計freeeからの銀行入出金履歴エクスポート運用を固め、収支簿管理の効率化へ。 | available_now | cash evidence候補。実入金額の直接sourceではない。 |
| `r_cash_conversion_unverified` | project_knowledge | `cf91eafa-949d-46db-89fe-2ff8c28804a8` | active | freeeで10/1〜3/31の収支との整合性チェックと書き出しが完了。3/31決済済データを抽出し、未決済分は4月末以降に銀行明細で確認する方針。 | available_now | 入金 / 決済確認source候補。 |
| `s_grant_unverified` | monthly report | `MR_p06_202602` | draft | AMED助成事業に関わる収支管理体制の精緻化、収支簿と銀行明細の整合性確認、証憑管理フロー見直し。 | available_now | AMED runway / admin source。粗利加算禁止。 |
| `s_policy_demo_unverified` | xrl evidence | `6253bafa-b797-4926-aaa0-2c3de1a1dbcf` | candidate | Go-Tech と NEDO DTSU grant paths を次の financing plan と並行検討。 | available_now | 採択ではなく検討。 |
| `s_policy_demo_unverified` | project_knowledge | `04a9284c-8936-4923-8813-4af97e5cd9fe` | active | CrestecBioが獲得を目指す大型補助金の一つ。原薬異物混入による資金影響を受け、資金調達戦略の一環として並行して進める方針。 | available_but_needs_join | 補助金候補。runway evidence に留める。 |

### p11 BWE

| flag | source type | source id / path | source status | evidence summary | PRSで使うなら | 注意点 |
|---|---|---|---|---|---|---|
| `r_revenue_unverified` | monthly report | `p11_202612` | draft | 住友理工との条件交渉、SIP最終報告書、10kWモジュールPoC、シードラウンド投資家開拓を並行。 | available_but_needs_join | future draft。実績扱い禁止。 |
| `r_revenue_unverified` / `r_cash_conversion_unverified` | source_cache | `p11_gmeet_minutes_198e5a68b13c43ea` | unknown | BWE月次報告会で、SIPからの収入をプロジェクトと一緒に並べ、経理管理の運用を開始する次アクション。 | available_now | SIP収入とAMD/BWE間契約の整理が必要。 |
| `r_revenue_unverified` / `r_cash_conversion_unverified` | source_cache | `p11_gmeet_minutes_1990d8b496887caa` | unknown | BWE請求金額調整MTG。SIPからの支払い状況確認、BWが立て替えている経費の精算方法、遅延損害金、株主総会議題などを議論。 | available_now | cash conversion / reimbursement source。SU粗利ではない。 |
| `r_gross_margin_unverified` | pwa/bzm run / project_knowledge | `2026-06-01-prs-l2-source-inventory.md` / BWE GP30%メモ | candidate | 既存inventoryでは BWE に GP30%メモがあると整理。 | available_but_needs_join | 元row特定・膜外販単価/原価/供給余力の突合が必要。 |
| `r_operating_cost_unverified` | source_cache | `p11_gmeet_minutes_199033acd75f8965` | unknown | 協和機電-BWE weekly。山口大学契約遅れ、設計図面未着、膜作業、NIMS専門家の現地対応など、実証・開発運営コストに関わる課題。 | available_now | コスト / 遅延 source。数値化不可。 |
| `r_cash_conversion_unverified` | billing_cycles AMD billing | `720566d5-64c3-4172-a00d-3f519e53da2b` ほか p11 future rows | not_started | p11の `billing_cycles` に future / not_started rows があり、一部 `invoice_sent_at` が入る。 | unsafe_to_infer | AMD請求。SU本体売上・粗利ではない。 |
| `s_grant_unverified` / `s_policy_demo_unverified` | monthly report | `p11_202611` / `p11_202612` | draft | SIP最終報告、行政対応、10kWモジュールPoC、住友理工条件交渉、シードラウンド準備。 | available_but_needs_join | future draft。SIP/実証はSurvival guardへ。 |
| `s_policy_demo_unverified` | source_cache | `p11_gmail_1987e26bfa8c4a6f` | unknown | SIP C(1) 三者共同研究契約書案。NIMS・山口大学・BWEの共同研究契約。 | available_now | 政策実証 / 共同研究 evidence。粗利ではない。 |
| `s_policy_demo_unverified` | source_cache | `p11_slack_1745979366_346149` | unknown | KKMTGメモ。下水制御盤、試運転、単板設計、山大契約、SPD訪問など実証運営の予定。 | available_now | 実証予定。売上実績扱い禁止。 |

## 3. flag別の読み方

| flag | 今回拾えたsource | source status | PRSで使うなら | 注意点 |
|---|---|---|---|---|
| `r_revenue_unverified` | p07のリサイクラーMOU/販売先候補、p20のNIMS税込100万円未満契約/見積、p21の愛媛大学契約・Fine-Chem PoC、p11のSIP/契約整理、p06のAMD発注保留 | confirmed/candidate/draft mixed | available_but_needs_join | SU本体売上、AMD業務委託、助成/共同研究費、PoC予定を分ける。 |
| `r_gross_margin_unverified` | p21処理単価485円/Lでは利益率が低い、p07前処理コスト・初期R&D費用回収難、p20販売原価/CAPEXすり合わせ、p11 GP30%メモ候補、p06外注は営利業務不可 | mostly candidate/draft | available_but_needs_join | gross margin はほぼ直接値なし。見積/原価表/freee/契約条件との join が必要。 |
| `r_operating_cost_unverified` | p07初期費用5000万円物件、p20コスト試算/CAPEX、p21事業計画・コスト試算、p06 AMED管理コスト、p11実証/契約遅延/立替精算 | active/candidate/draft | available_now for candidate source, unsafe for value | operating cost source は多いが、実支出・予定・future draftの分離が必要。 |
| `r_cash_conversion_unverified` | p06 freee/銀行入出金/未決済確認、p07融資/投資/Startup Global、p20 NIMS契約とAMD billing、p21愛媛大学見積・支払予定、p11 SIP支払い状況/立替精算 | confirmed/candidate/unknown | available_but_needs_join | 入金確認ベースとforecastを分ける。billing_cyclesはAMD請求として別扱い。 |
| `s_grant_unverified` | p06 AMED/Go-Tech/NEDO、p07 Startup Global/NEDO/SBIR、p11 SIP、p20助成金/コンソーシアム方針、p21 PSI/国プロ接続候補 | confirmed/candidate/draft | available_now as Survival source | R_net粗利に加算しない。自己負担・後払い・使途制限が重要。 |
| `s_policy_demo_unverified` | p07 TYK実証、p11 SIP/東京都/共同研究、p20コンソーシアム、p21 PSI/国プロ、p06 Go-Tech/NEDO検討 | candidate/draft/unknown | available_now as policy/demo source | 実証採択や政策接続は7軸/Survival補助。販売実績ではない。 |

## 4. 司令塔判断事項

1. p20 NIMS税込100万円未満契約と p21 愛媛大学契約は、PRS上で `SU本体売上` ではなく `AMD/研究機関契約 cash source` として別ラベルにするか。
2. p07 Startup Global / 融資 / 投資は Survival guard へ置く方針でよいか。リサイクルMOU/販売先候補だけをR_net候補に残すのが安全そう。
3. p21 の処理単価485円/L・従量課金モデルは、R_net gross margin sourceとして強いが、P側のUE評価と二重カウントしない整理が必要。
4. p06 CTB は AMED管理・freee/収支簿・外注制約が厚い一方、売上/粗利 source ではない。CTB guard を今回のpackでも Survival first として固定するか。
5. p11 BWE のSIP/共同研究/膜外販/GP30%候補は、元row特定と膜供給余力・本命RED装置影響が揃うまで `requires_masa_or_bzm_review` のままにするか。

## 5. 次アクション

1. BZM司令塔が、このpackの候補を `usable source` / `review-only` / `exclude from PRS` に分類する。
2. 次workerでやるなら、`billing_cycles AMD billing` と `SU本体売上/粗利` を分ける join map を作る。
3. p21の処理単価485円/L、p20の税込100万円未満NIMS契約、p07のリサイクラーMOU、p11のSIP支払い/GP30%、p06のAMED後払い/外注制約を、source id単位で evidence card v2 へ戻す。
4. 0-9値、DB列、正式rubric、過去score再計算は引き続き保留。

## 6. 検証

- Supabaseは read-only SELECT のみ実行した。
- 対象5PJの `project_pl_monthly` は0件で、SU別PLの直接sourceとしては使えないことを確認した。
- `billing_cycles` を AMD billing として別ラベル化した。
- candidate / draft / upcoming / unknown を実績扱いしない注意を各表に残した。
- DB write、DDL、migration、deploy、extractor実装、0-9 score表作成は行っていない。
