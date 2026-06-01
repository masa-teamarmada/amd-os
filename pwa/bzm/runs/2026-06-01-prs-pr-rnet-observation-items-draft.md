# P/R_net observation items draft

作成日: 2026-06-01
作成者: BZM理論検証worker
ステータス: BZM司令塔レビュー待ち

## 0. この成果物の扱い

このファイルは、PRS候補を正式rubric化する前の観測項目draftである。現行7軸AMD Scoreは正式モデルのまま維持し、P/R_netは `Adopt as comparison layer` の検証用にだけ扱う。

今回やることは、P/R_net/Survival guardについて、観測項目・見るもの・source候補・入力主体候補・更新頻度候補・guard条件・未確認flagを並べることまで。0-9値、DB列、正式score、過去score再計算は作らない。

確認した主資料:

- `pwa/bzm/runs/2026-06-01-prs-seven-axis-alignment.md`
- `pwa/bzm/runs/2026-06-01-prs-9pj-delta-review.md`
- `pwa/bzm/runs/2026-06-01-prs-pr-rnet-evidence-cards.md`
- `pwa/bzm/runs/2026-06-01-prs-rnet-guard-memo.md`
- `pwa/design/amd_score.md`
- `pwa/bzm/COMMANDER_TASKS.md`

前提にしたBZM判断:

- CTB型はR_netではなく `Survival guard / lane-specific survival evidence` として分離する。
- JOYCLE型は、正式名称未確定のまま、観測項目draftでは `本命毀損 / damage guard` として扱う。
- Yellow Duck型は、P側の低P/市場構造の筋悪さと、R_net側の粗利不成立の両方にまたがる観測項目として扱う。
- BWE膜外販は、供給余力・粗利・本命RED装置への影響が揃うまで `未確定R_net` とする。

## 1. P observation items draft

Pは、単なるTAMや社会課題の大きさではなく、AMDがそのPJで狙える成功上限を観測する。出口可能性、政策資金、社会課題の大きさは重要だが、Pの本体に混ぜすぎると「大きな社会課題 = 高P」と誤読されるため、補助 evidence として扱う。

| 観測項目名 | 見るもの | 使うsource候補 | 入力主体候補 | 更新頻度候補 | guard条件 | 未確認flag |
|---|---|---|---|---|---|---|
| 市場/成功上限 | PJが成功した時に到達しうる売上・企業価値・市場占有余地 | 各PJ knowledge md、事業計画、公開市場レポート、VC/DDメモ、顧客候補ヒアリング | worker draft -> まさ/BZM承認 | 大きな市場前提変更時、資金調達/DD前、半期レビュー | TAMをそのままPにしない。PJ固有の勝ち筋・販路・採用障壁で割り引く | `p_market_ceiling_unverified` |
| 用途レーン別の天井 | 同じ技術でも、用途レーンごとの上限が違うか | 用途別事業計画、顧客セグメント、PoC一覧、競合用途比較 | worker draft + まさレビュー | 用途追加/撤退時、四半期 | U1短期キャッシュ層とU4/U5本命大市場を混ぜない。SX型で特に注意 | `p_lane_ceiling_unverified` |
| PJ固有の到達可能市場 | レーン全体ではなく、そのPJが実際に取れる市場 | 競合比較、特許/IP範囲、製造能力、営業チャネル、規制制約 | worker draft -> 承認制 | DD更新時、提携/量産条件変更時 | 波力レーン全体の低PとYellow Duck固有改善余地を混同しない | `p_project_capture_unverified` |
| UE/価格受容性 | 顧客が払える価格、LCOE、原価、導入/保守込みで成立するか | 見積書、顧客ヒアリング、VC DD、LCOE/COGS試算、海外類似SU分析 | worker draft + L2抽出候補 -> まさ承認 | 顧客PoC後、価格改定時、DD後 | 技術PoCを商用UE成立と混同しない。YD型はP/R_net両方のguardに使う | `p_ue_unverified` |
| 市場構造の筋悪さ | 需要はあっても、販売構造・規制・設置条件・保守負担で事業化が難しいか | DDメモ、VCコメント、顧客導入条件、類似SU失敗理由 | worker draft -> BZM承認 | NO_GO/保留判断時、外部DD後 | BRL不足だけに潰さない。Pの天井を削る構造要因として分離する | `p_market_structure_unverified` |
| 代替技術/競合圧力 | 同じ課題を別技術が安く速く解く可能性 | 競合DB、公開資料、論文/特許、顧客既存解 | L2抽出候補 + worker draft | 半期、競合資金調達/上市時 | 大市場でも代替技術が強ければPJ固有Pは下がる | `p_substitute_unverified` |
| 出口可能性補助 | IPO/M&A/ライセンス/製薬提携など、成功上限に影響する出口 | VC/DDメモ、提携候補、製薬ライセンス事例、M&A類似事例 | まさ + worker draft | 資金調達前、提携交渉時 | 出口可能性をP本体へ過剰加算しない。創薬ではSurvival guardとも分ける | `p_exit_path_unverified` |
| 政策・社会課題の大きさ補助 | 政策課題・社会課題が市場形成に効くか | atlas_signals、政策文書、補助金公募、社会課題レポート | L2抽出候補 -> worker draft -> 承認制 | 政策更新時、四半期 | 社会課題が大きいだけで価格受容や粗利が立つとは見ない | `p_policy_problem_unverified` |

## 2. R_net observation items draft

R_netは、単なる売上可能性ではなく、会社の生存へ効く純貢献を観測する。暫定構造は `粗利貢献 - 運営コスト - 本命PJへのリソース毀損`。ただし、この式は観測整理の方向性であり、まだ0-9値表ではない。

| 観測項目名 | 見るもの | 使うsource候補 | 入力主体候補 | 更新頻度候補 | guard条件 | 未確認flag |
|---|---|---|---|---|---|---|
| 売上/受注実績 | 本命またはつなぎ事業で実売上・受注があるか | 請求/入金情報、契約書、受注管理、事業計画、月次報告 | L2抽出候補 + worker draft -> まさ承認 | 月次、受注/失注時 | 売上候補や販売前夜を実績扱いしない。JOYCLE型で特に注意 | `r_revenue_unverified` |
| 粗利貢献 | 売上から原価・外注・導入・保守を引いた後に残る額 | 見積/原価表、freee、販売計画、契約条件、製造コスト | worker draft -> finance/まさ承認 | 月次、価格/原価変更時 | 売上額、補助金、実証採択、評価データ獲得を粗利扱いしない | `r_gross_margin_unverified` |
| 運営コスト | burn、固定費、CAPEX、人件費、在庫、営業、導入支援、保守、規制対応 | freee、予算表、採用計画、設備計画、月次報告 | worker draft + finance確認 | 月次、資金計画更新時 | 粗利があっても固定費増・後払い・導入負担を差し引く | `r_operating_cost_unverified` |
| 入金サイト/運転資金負荷 | 売上/補助金/実証費がいつ入り、先払い支出を耐えられるか | 契約書、補助金条件、請求/入金予定、資金繰り表 | finance/まさ + worker draft | 月次、契約/公募採択時 | 後払い補助金や大型顧客の検収遅れを正のR_netにしない | `r_cash_conversion_unverified` |
| 本命PJへの再投資 | つなぎ収益が本命R&D・知財・規制・主要顧客開拓へ戻るか | 資金使途、研究開発予算、採用計画、経営会議ログ | まさ承認必須 + worker draft | 四半期、資金調達/方針変更時 | 商社/受託/PoC収益が本命へ戻らないなら正のR_netに寄せない | `r_reinvestment_unverified` |
| 本命PJへのリソース毀損 / damage guard | 目先案件が本命R&D、人員、予算、知財、技術ロードマップを遅らせるか | R&D計画、開発進捗、意思決定ログ、AMD関与終結ログ、チーム稼働 | worker draft -> BZM/まさ承認 | 重要方針変更時、月次/四半期 | 正の売上と正のR_netを混同しない。JOYCLE型はdamage guardとして独立表示 | `r_damage_guard_unverified` |
| 低P/UE由来の粗利不成立 | 原理的に価格・原価・保守が合わず粗利が立たないか | LCOE、COGS、DDメモ、顧客価格受容、類似SU失敗事例 | worker draft -> BZM承認 | DD後、価格/原価更新時 | Yellow Duck型はP側の市場構造とR_net側の粗利不成立の両方で見る | `r_ue_margin_unverified` |
| 本命前つなぎ事業の独立性 | つなぎ収益が本命と別系統か、本命MVP前倒しか | 事業計画、プロダクトロードマップ、顧客一覧、技術依存関係 | worker draft + まさレビュー | 事業モデル変更時 | 別系統つなぎは本命を支える場合のみ正。個別受託消化なら毀損候補 | `r_bridge_business_unverified` |
| ボトルネック資源の外販影響 | 膜・部材・研究人員など本命律速資源を外販へ回していないか | 生産計画、供給余力、部材原価、開発ロードマップ | worker draft -> 技術/まさ承認 | 供給計画更新時、外販検討時 | BWE膜外販は供給余力・粗利・本命RED装置影響が揃うまで未確定R_net | `r_bottleneck_external_sale_unverified` |
| 評価データ獲得の補助メモ | 利益度外視販売や実証が、将来販売・薬事・提携に効くか | 実証報告、顧客評価、共同研究、BRL/SRL evidence | L2抽出候補 + worker draft | 実証完了時、顧客評価取得時 | 評価データ獲得を粗利扱いしない。R_net補助メモまたはBRL/SRL evidenceへ分ける | `r_validation_value_unverified` |

## 3. Survival guard observation items draft

Survival guardは、R_netだけでは生存可能性を誤判定するレーンを分離するための観測項目である。特にCTB型の創薬/薬事/ライセンス/EXIT、BWE型の政策資金・実証、CX型の評価データ獲得は、R_net粗利へ混ぜず、lane-specific survival evidenceとして扱う。

| 観測項目名 | 見るもの | 使うsource候補 | 入力主体候補 | 更新頻度候補 | guard条件 | 未確認flag |
|---|---|---|---|---|---|---|
| 非希薄化資金 / 助成金 | AMED/NEDO/SIP/SBIR等が何か月のrunwayを延ばすか | 採択通知、交付条件、資金計画、月次報告 | worker draft + finance/まさ承認 | 採択/入金/精算時、月次 | 助成金をR_net粗利へ加算しない。自己負担・後払い・使途制限も見る | `s_grant_unverified` |
| 薬事 / ライセンス / EXIT可能性 | 売上ゼロ期間を、薬事進捗・提携・ライセンス・EXITで耐えられるか | 薬事計画、製薬提携ログ、共同研究、ライセンス類似事例 | worker draft -> まさ/BZM承認 | 薬事milestone更新時、提携交渉時 | CTB型はR_net低値でNO_GOにしない。Pの出口可能性とも混ぜすぎない | `s_regulatory_exit_unverified` |
| 政策資金 / 実証採択 | 政策・実証がGO根拠や生存期間を支えるか | SIP/東京都実証/政策公募、atlas_signals、交付条件 | L2抽出候補 + worker draft -> 承認制 | 採択/公募更新時 | 政策資金や実証採択を粗利貢献にしない。管理コスト・入金条件を別に見る | `s_policy_demo_unverified` |
| 評価データ獲得価値 | 利益度外視テスト販売や実証で、次の販売・提携・薬事に必要な証拠が得られるか | 実証レポート、顧客評価、試験データ、共同研究成果 | L2抽出候補 + worker draft | 実証完了時、顧客評価取得時 | 粗利と混ぜない。BRL/SRL evidenceまたはSurvival guard補助として扱う | `s_validation_data_unverified` |
| lane-specific survival evidence | 創薬、政策実証、大型装置、アカデミア装置など、レーン固有の生存条件 | レーン別事業計画、DDメモ、規制/補助金/顧客導入条件 | worker draft -> BZM承認 | レーン変更時、半期レビュー | 全PJに同じR_net観測を当てない。創薬/大型装置/設立前PJは例外条件を明示 | `s_lane_guard_unverified` |

## 4. 入力主体と承認フローの候補

| 入力主体候補 | 使いどころ | guard |
|---|---|---|
| worker draft | 初期観測項目の抽出、source候補の整理、未確認flag付与 | 推測を正式値にしない。必ず `draft` として扱う |
| L2抽出候補 | 売上/受注/助成金/実証/顧客評価など、事実候補の自動抽出 | 自動採用しない。source linkとconfidenceを付け、承認制にする |
| まさ入力 | Pの天井、R_netの本命毀損、資源配分、反実仮想の判断 | まさの判断負荷が高いので、workerが先に論点を絞る |
| finance確認 | 粗利、入金サイト、運転資金、助成金後払い、burn | 入金確認ベースとforecastを分ける |
| BZM司令塔承認 | 理論境界、P/R_net/Survival guardの置き場所判断 | 0-9値・DB列・正式scoreへ進める承認ではない |

## 5. まだやらないこと

| まだやらないこと | 理由 |
|---|---|
| 0-9値表 | CTB/JOYCLE/YD/BWEのguard処理と入力主体が未確定 |
| DB列 | `p` / `r_net` 列追加はformal adoptionと誤読されやすい |
| PRS正式score | 現行7軸AMD Scoreが正式モデル。PRSはcomparison layer |
| 過去score再計算 | 過去の経営判断ログを後から上書きする危険がある |
| 既存7軸の置換 | 7軸で説明できる判断とP/R_net差分の分離がまだ途中 |
| 助成金/政策資金のR_net加算 | 粗利貢献とSurvival guardが混ざる |
| 評価データ獲得の粗利扱い | 利益度外視販売を高R_netに誤読する危険がある |

## 6. BZM司令塔への判断事項

1. CTB型を `Survival guard / lane-specific survival evidence` として分離する方針を、この観測項目draftでも継続してよいか。
2. JOYCLE型は、正式名称を決める前に `本命毀損 / damage guard` として観測項目化してよいか。
3. Yellow Duck型は、P側の低P/市場構造の筋悪さとR_net側の粗利不成立の両方に置く方針でよいか。
4. BWE膜外販は、供給余力・粗利・本命RED装置への影響が揃うまで `未確定R_net` とする方針でよいか。
5. 次に進む場合、0-9値表ではなく、9PJ evidence cardsへこの未確認flagを戻して「どのsourceを埋めるか」を決める順でよいか。

## 7. 次アクション

1. BZM司令塔がこのdraftをレビューする。
2. 承認または差し戻し後、9PJ evidence cardsへ未確認flagを対応づける。
3. L2抽出候補で拾えるsourceと、まさ判断が必要なsourceを分ける。
4. 0-9値表、DB列、正式score、過去score再計算は、BZM/OS司令塔の明示判断が出るまで保留する。

## 8. 自己レビュー

- 0-9値表は作っていない。
- DB migration、コード実装、deployは行っていない。
- PRSを正式scoreとして扱っていない。
- P/R_netの観測項目draftと、Survival guardのlane-specific evidenceを分けた。
- CTB、JOYCLE、Yellow Duck、BWEのguard条件を表内に入れた。
- `observation item`、`rubric`、`formal adoption` を混同しないよう、今回の成果物を正式rubric前の観測項目draftとして明記した。
