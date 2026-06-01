# R_net guard memo

作成日: 2026-06-01
作成者: BZM理論検証worker
ステータス: BZM司令塔レビュー待ち

## 0. このメモの扱い

このメモは、P/R_net evidence cards を受けて、R_net を正式 rubric 化する前に必要な誤判定防止 guard を整理するもの。

- `guard`: 次の rubric draft で誤判定を避けるための境界条件。
- `rubric draft`: 観測項目案。0-9 値表、DB列、正式スコアではない。
- `formal adoption`: BZM/AMD Score の正式理論・正式DB・正式score履歴として採用すること。今回の対象外。

現時点の結論は、R_net を `粗利貢献 - 運営コスト - 本命PJへのリソース毀損` と見る方向性は使ってよい。ただし、CTB / JOYCLE / Yellow Duck / BWE の反例を guard 化するまで、0-9 rubric、DB schema、過去score再計算には進めない。

確認した主資料:

- `pwa/bzm/runs/2026-06-01-prs-seven-axis-alignment.md`
- `pwa/bzm/runs/2026-06-01-prs-9pj-delta-review.md`
- `pwa/bzm/runs/2026-06-01-prs-pr-rnet-evidence-cards.md`
- `pwa/design/amd_score.md`
- `pwa/bzm/COMMANDER_TASKS.md`

## 1. R_net の暫定3項

R_net は単なる売上可能性ではなく、少なくとも次の3項に分けて観測する。

| 暫定項目 | 見るもの | guard |
|---|---|---|
| 粗利貢献 | 本命またはつなぎ事業が、売上から原価・外注・導入・保守を引いた後に会社の生存へ貢献するか | 売上、補助金、実証採択、評価データ獲得をそのまま粗利扱いしない |
| 運営コスト | burn、CAPEX、人員、在庫、営業、導入支援、規制対応、実証管理、資金入金サイト | 売上額だけで正にせず、入金遅れ・後払い・固定費増を差し引く |
| 本命PJへのリソース毀損 | つなぎ収益や目先案件が、本命R&D・知財・規制・主要顧客開拓を遅らせるか | 目先収益が本命を支えず、R&D削減の言い訳になる場合は負のR_net候補 |

この3項は rubric draft の入力候補として使ってよいが、まだ値付け rubric ではない。

## 2. 誤判定 guard 4型

### 2.1 CTB guard: 売上ゼロ成立型を NO_GO にしない

CTB は創薬 long-cycle の反例。治験中売上がゼロでも、外部資金、薬事進捗、製薬提携、ライセンス/EXIT 期待で Survival を確保しうる。

危険な誤判定:

- `R_net low -> NO_GO` と単純化する。
- AMED などの非希薄化資金を粗利貢献として R_net に混ぜる。
- 薬事・ライセンス・EXIT 可能性を「売上がないから弱い」と一段低く扱う。

guard:

- R_net は低くても、創薬/薬事型では別枠で `売上ゼロでもSを確保する構造` を観測する。
- 非希薄化資金・助成金は R_net ではなく、Survival guard または lane-specific survival evidence として分ける。
- CTB は R_net rubric の失敗例ではなく、R_net rubric を作る前に必ず置くべき例外 guard として扱う。

次観測:

- AMED等の金額、期間、自己負担、後払い条件。
- 薬事マイルストーン、共同研究、ライセンス交渉、EXIT候補の確度。
- 外部資金が本命創薬を進めるための runway を何か月延ばすか。

### 2.2 JOYCLE guard: 目先売上を正のR_netと早合点しない

JOYCLE は負のR_net型の中核事例。装置販売前夜や目先収益化の気配があっても、それが本命 deeptech R&D を支えず、むしろR&D投資を削る口実になるなら負のR_netになりうる。

危険な誤判定:

- JB-02/JB-02A の販売前夜を、販売実績や正のR_netとして扱う。
- 「収益化に近い」ことを、本命R&D継続力の上昇と同一視する。
- 設立時NO_GOまでPRS/R_netの成果として扱う。そこは7軸TRLで説明済み。

guard:

- 売上候補は、`本命R&Dへ再投資される粗利` と `本命R&Dを縮小させる目先案件` に分ける。
- 本命R&D予算、研究開発人員、技術実装ロードマップが縮むなら、粗利候補があっても負のR_net guardを立てる。
- JOYCLEは `正の売上 != 正のR_net` を確認するための反例として使う。

次観測:

- 装置原価、販売予定単価、導入/保守コスト、販売実績。
- R&D予算・人員・外部研究連携の推移。
- AMD関与終結前後の意思決定ログと、本命技術進捗の停止/遅延。

### 2.3 Yellow Duck guard: 技術PoCを事業の筋良さと混同しない

Yellow Duck は低P/UE不成立型。TRL=4相当の技術PoCがあっても、波力発電のLCOE、設置・保守、腐食・付着、売電/販売単価が合わないなら、事業として筋が悪い。

危険な誤判定:

- YD を単なるBRL不足として潰し、UE不成立という本質を見失う。
- 技術PoCがあるため、PやR_netの筋悪さを軽く見る。
- 波力レーン全体の構造的不利と、Yellow Duck固有技術の改善余地を混ぜる。

guard:

- R_net rubric draft では、低P/UE不成立を `粗利貢献が立たない理由` として明示する。
- BRL不足とは別に、事業上限、LCOE、製造/設置/保守コスト、価格受容性を観測する。
- 技術PoCは7軸TRLの根拠に留め、P/R_netでは商用UEへ変換できるかだけを見る。

次観測:

- Yellow Duck固有のLCOE、製造・設置・保守コスト、想定売電/販売単価。
- VC DDでNO_GOになった具体論点。
- 海外類似SUの失敗理由と、Yellow Duck固有技術で覆せる範囲。

### 2.4 BWE guard: 膜外販・政策資金を正のR_netと早合点しない

BWE は高P・政策資金ありでも、初期R_netが未確定な大型装置PJ。膜外販はつなぎ収益候補だが、膜は本命RED装置のボトルネックでもある。

危険な誤判定:

- SIP、政策資金、東京都実証を粗利貢献としてR_netへ混ぜる。
- 膜外販がありそうというだけで正のR_netにする。
- R_net不足だけでBWEの設立GOを覆す。設立GOは7軸の政策・TRL・BRL・HRL側で説明できる。

guard:

- 政策資金・実証採択は、7軸またはSurvival guardの evidence とし、R_netの粗利には混ぜない。
- 膜外販は、供給余力、粗利、外販先、本命RED装置への供給影響を確認するまで未確定扱い。
- 膜が本命ボトルネックである限り、外販は正のR_net候補であると同時に本命毀損候補でもある。

次観測:

- 膜単体の量産可否、単価、粗利、外販先、供給余力。
- RED装置の初号機販売までのburnと、実証資金の入金条件。
- 膜外販が本命RED装置開発に与えるリソース影響。

## 3. R_net と混ぜない観測項目

次の項目は Survival や Potential の重要 evidence になりうるが、R_net の粗利貢献へ直接混ぜない。

| 混ぜない項目 | なぜ混ぜないか | 置き場所候補 |
|---|---|---|
| 非希薄化資金 / 助成金 | 売上粗利ではなく、使途・自己負担・後払い条件に左右される runway evidence | Survival guard / lane-specific survival evidence |
| 薬事・ライセンス・EXIT可能性 | 創薬/長期DeepTechでは売上ゼロ期間の生存条件だが、短期粗利ではない | Survival guard / Pの出口可能性補助 |
| 政策資金 / 実証採択 | GO根拠や外部追い風にはなるが、管理コスト・入金条件・自己負担がある | 7軸 sigma_SU / GRL / Survival guard |
| 評価データ獲得価値 | 将来販売・提携・薬事・顧客信頼に効くが、利益度外視なら粗利貢献ではない | BRL/SRL evidence / R_net補助メモ |

これらをR_netに混ぜると、「売上ゼロでも成立する型」と「粗利で自走する型」と「政策/実証で耐える型」が区別できなくなる。

## 4. 次のP/R_net観測項目 draft へ渡す分類

### 4.1 使ってよい項目

次の項目は、rubric draft の観測項目候補として使ってよい。

| 項目 | 使い方 | 注意 |
|---|---|---|
| 売上実績 / 受注実績 | 粗利貢献の入口 | 売上額だけでなく原価・入金・導入/保守を同時に見る |
| 粗利率 / 粗利額 | R_netの正方向 evidence | まだ0-9化しない。PJフェーズ別に必要水準が違う |
| burn / 固定費 / CAPEX | 運営コスト evidence | 後払い補助金や実証管理コストも含める |
| 入金サイト / 運転資金負荷 | 生存設計の実効性 | 補助金・大型顧客・実証費の後払いに注意 |
| 本命R&Dへの再投資 | 正のR_netの質を確認 | つなぎ収益が本命を支える場合だけ正に寄せる |
| 本命R&Dの遅延 / 人員流出 / 予算削減 | 負のR_netまたは毀損 guard | JOYCLE型の本命毀損を検出する |
| LCOE / unit economics / 価格受容性 | 低P/UE不成立の検出 | YD型ではBRL不足とは別に見る |
| 供給余力 / bottleneck資源の外販影響 | BWE型の本命毀損検出 | 膜・部材・研究人員など本命律速資源に限定して確認 |

### 4.2 まだ使わない項目

次の項目は重要だが、R_net rubric draft の値付けにはまだ使わない。補助メモまたは別guardとして扱う。

| 項目 | まだ使わない理由 | 今回の扱い |
|---|---|---|
| 0-9 score値 | 反例処理と入力主体が未確定 | 作らない |
| DB列 `r_net` | formal adoption と誤読される | 作らない |
| PRS正式score / 過去score再計算 | 7軸正式モデルと過去判断ログを上書きする危険 | 行わない |
| 助成金額をR_netへ加算 | 粗利と非希薄化資金が混ざる | Survival guardへ分離 |
| 薬事進捗をR_netへ加算 | 売上粗利ではなく創薬laneの生存/出口 evidence | lane-specific guardへ分離 |
| 実証採択をR_netへ加算 | 政策追い風・GRL/SRL evidenceであり、管理コストもある | 7軸/Survival guardへ分離 |
| 評価データ獲得を粗利扱い | 利益度外視テスト販売を高R_netに誤読する | BRL/SRL補助メモへ分離 |
| 事業計画上の将来売上だけ | 実績・粗利・入金・本命毀損が未確認 | forecastとして別管理 |

## 5. DB化・0-9 rubric化をまだしない理由

1. 反例処理が未完成。CTBの売上ゼロ成立型、JOYCLEの負のR_net、YDの低P/UE不成立、BWEの膜外販未確定を分ける前に値表を作ると誤判定が固定される。
2. 入力主体が未確定。まさ入力、えいみ/worker仮説、L2抽出候補のどれを正本にするか決まっていない。
3. 時点評価が未確定。ended PJ、frozen PJ、設立前PJ、設立後PJで同じ観測項目を同じ重みで扱えるか未確認。
4. 既存7軸AMD Scoreが正式モデル。R_netをDB列化すると、PRSがformal adoption済みと誤読される。
5. R_netにはAMD資源配分判断が混ざる。PJ単体の成熟度ではなく、AMDがどこへ人・資金・経営注意を置くかの判断を含むため、DB化前に scope と責任者を決める必要がある。
6. 9PJ evidence はまだ少標本。ティエム商社化仮説やJOYCLE反例に過適合する危険がある。

## 6. BZM司令塔への判断事項

1. 次workerは `P/R_net観測項目 draft` に進んでよい。ただし 0-9 rubric ではなく、観測項目・入力根拠・guard条件の表までに留める。
2. CTB型の `売上ゼロでもSを確保する構造` を R_net ではなく別guardとして扱う方針でよいか。
3. JOYCLE型の本命毀損を `負のR_net` と呼ぶか、0-9 rubric外の `damage guard` として扱うか。
4. YD型の低P/UE不成立は、P rubric側へ寄せるか、R_netの粗利不成立としても見るか。
5. BWE型の膜外販は、供給余力と本命RED装置への影響が揃うまで `未確定R_net` とするか。

## 7. 次アクション

1. BZM司令塔がこの guard memo をレビューする。
2. 差し戻しがなければ、次workerで `P/R_net観測項目 draft` を作る。
3. 観測項目 draft では、`使ってよい項目` を中心に、各項目の source、入力主体、更新頻度、未確認flagを整理する。
4. DB migration、0-9 score表、formal adoption は、少なくともこの guard memo の判断事項が閉じるまで保留する。

## 8. 自己レビュー

- R_net rubric は確定していない。
- 0-9 score表は作っていない。
- DB migration、コード実装、deployは行っていない。
- `guard` は誤判定防止条件、`rubric draft` は次の観測項目案、`formal adoption` は正式採用として分けて書いた。
- CTB / JOYCLE / Yellow Duck / BWE の4型を、R_net低値、売上候補、技術PoC、政策資金/膜外販の誤判定 guard として分離した。
