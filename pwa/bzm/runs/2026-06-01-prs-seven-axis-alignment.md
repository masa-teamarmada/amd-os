# 7軸AMD ScoreとPRS/9軸候補の整合メモ

作成日: 2026-06-01
作成者: BZM理論整理worker
ステータス: BZM司令塔レビュー待ち

確認した正本:

- `pwa/bzm/5-1-amd-score-integration.md`
- `pwa/bzm/6-1-retrofit-verification.md`
- `pwa/design/amd_score.md`
- `pwa/spec/4-2-amd-score-current-spec.md`
- `pwa/manual/4-3-amd-score-spec.md`
- `pwa/scripts/prxs_retrofit_test.py`
- `origin/codex/prs-comparison-layer` (`c101e6c`, `origin/main` にmerge済み)

## 0. 結論

現行BZM/AMD OSの正式モデルは、引き続き7軸AMD Scoreである。

```text
AMD Score = K * product((X_i + 1) ^ alpha_i)
X = {sigma_SU, TRL, BRL, GRL, SRL, HRL, FRL}
```

PRS (`P x R x S`) は、この7軸を廃止する置換モデルではなく、現行7軸を別の経営問いへ読み替えるための比較/シミュレーション層として扱う。現時点で採用できるのは「7軸の横にPRS候補を並べて、P/R_netを仮入力した時に判断がどう変わるかを見る」ことまで。

正式採用、DB schema化、P/R_net rubric確定、過去スコアの再解釈は、BZM review gateを通すまで行わない。

## 1. 7軸とPRS候補の対応

| 現行7軸 / 新候補 | 現行7軸での意味 | PRS上の主な置き場所 | 整合メモ |
|---|---|---|---|
| `sigma_SU` | マクロ追い風。Triple Helix由来の外部環境 | `S` Survival | 現行UIでは `M` として独立表示しているが、PRS候補では「生き残れる追い風」としてS側へ寄せる。Rへ入れると、準備度と外部追い風が混ざる。 |
| `TRL` | 技術成熟度 | `R` Reach / Readiness | 自社またはPJが届けられる状態かを見る中核軸。PRSでも7軸からそのまま継承できる。 |
| `BRL` | 事業化成熟度 | `R` Reach / Readiness | 顧客課題、事業仮説、商流の準備度。R_netとは別で、BRLは「事業化できる形に近づいているか」、R_netは「純キャッシュ貢献があるか」。 |
| `GRL` | 規制・制度成熟度 | `R` Reach / Readiness | 社会実装の到達可能性を制約する制度側readiness。 |
| `SRL` | 社会受容・市場受容 | `R` Reach / Readiness | 社会・市場に届く準備度。`sigma_SU`と重複しやすいので、PRS採用時はSRLとsigma_SUの境界を再確認する。 |
| `HRL` | チーム・人材・組織 readiness | `R` Reach / Readiness | 会社側の実行体制。FRLと混ぜない。HRLは組織/チーム、FRLは founder/CEOの不確実性耐性。 |
| `FRL` | founder / CEO readiness。現行はF_characterとF_capabilityのCES | `S` Survival | PRS候補では、会社が不確実性を越えて生き残る力の一因子。FRL内部のCESは維持し、S全体のCobb-Douglasとは階層を分ける。 |
| `P` | 現行7軸にはない | `P` Potential | 成功した時の潜在規模・上限を追加する軸。現行7軸は成熟度/成功確率寄りなので、Pを足すと「大きいが未成熟」と「小さいが堅い」を分けられる。 |
| `R_net` | 現行7軸にはない | `S` Survival | 収益化指数。粗利から運営コストと本命PJへのリソース毀損を引いた純キャッシュ貢献。BRLでは説明しきれない自走性/延命力を見る。 |

対応を圧縮すると、候補9軸は次の構造になる。

```text
P = Potential
R = TRL * BRL * GRL * SRL * HRL
S = sigma_SU * FRL * R_net

候補9軸 = {P, TRL, BRL, GRL, SRL, HRL, sigma_SU, FRL, R_net}
```

## 2. PRSを置換ではなく比較レイヤーに留める理由

1. 現行7軸は、BZM第5部・spec・manual・PWA実装で正式化済みで、既存のscore履歴、M/X/F表示、律速判定、alpha retrofitと接続している。
2. `P` と `R_net` は、まだ観測rubric、入力主体、DB列、履歴データが確定していない。
3. `R_net` は「ライスワーク実益」「純キャッシュ貢献」「本命PJへのリソース毀損」を含むため、PJ単体の成熟度だけでなくAMDの資源配分判断も混ざりやすい。
4. `sigma_SU` を現行の `M` からPRSの `S` へ読み替えるため、過去のM/X/F表示と完全同義ではない。
5. 現行7軸で説明できる差分と、P/R_netを追加しないと説明できない差分をまだ分離できていない。
6. 9PJ retrofitは少標本で、1事例、特にティエムの商社化仮説へ過適合する危険がある。

したがって、OS実装workerの `codex/prs-comparison-layer` が採った「保存しない仮P/R_netで横並び試算し、P/R_net missing時はnot enough dataにする」設計は、BZM一次レビューとしては採用圏内。これは正式採用ではなく、仮説を壊さず比較するための安全な置き場所である。

## 3. 今すぐ採用できること

| 採用できること | 理由 | 採用範囲 |
|---|---|---|
| PRSを「候補」かつ「比較レイヤー」と呼ぶ | 7軸正式モデルを壊さず、次の検証問いを置ける | BZM章末付記、manual/specの説明、retrofit画面 |
| 7軸から `R` / `S` への対応表を使う | 現行軸の意味を保ったまま読み替えられる | BZM司令塔レビュー、Textbook側の理論境界説明 |
| P/R_netを保存しない仮入力で試算する | rubric未確定でも、判断差分を見る実験はできる | `/venture-map/amd-score/retrofit` のsimulation |
| P/R_net missing時にscoreを出さない | 0点扱いによる誤読を避けられる | UI / derived logic |
| 「既存7軸で説明できない差分」をレビュー問いにする | PRS採用の必要性を過剰一般化せず検証できる | BZM review gate |

## 4. まだ採用しないこと

| まだ採用しないこと | 理由 | 必要条件 |
|---|---|---|
| 現行7軸AMD Scoreの正式廃止 | 既存仕様・履歴・UI・BZM第5部を壊す | 複数PJ retrofit、過去解釈への影響評価、OS司令塔判断 |
| `amd_score_inputs` への `p` / `r_net` 列追加 | rubric・入力主体・更新頻度が未確定 | DB schema案、manual/spec、入力UI、migration適用判断 |
| P/R_net rubric確定 | 根拠がまだティエム仮説と少数PJに偏る | 0-9段階定義、観測チェックリスト、反例検証 |
| 9PJ正式retrofit表の差し替え | 既存表の期待値/軸値/自己整合版との関係が複雑 | 全PJでP/R_net根拠を揃え、現行7軸との差分を説明 |
| 過去AMD Score履歴の再計算 | 既存の経営判断ログを後から別モデルで上書きする危険 | versioned score model、旧score表示保持、変更履歴 |

## 5. 正式採用に必要な条件

### 5.1 複数PJ retrofit

少なくとも9PJについて、現行7軸score、PRS候補score、判断差分を並べる。見るべき差分は「PRSで順位が変わったか」ではなく、「P/R_netを入れることで、現行7軸では説明できなかった経営判断が説明できるか」。

必要な比較観点:

- ティエム: 潜在市場Pは高いが、R_netが立たない場合に設立/商社化判断がどう変わるか。
- CTB / YD: 小さくても自走性がある/ないPJでR_netが過剰に効かないか。
- CX / SX: 会社化前のR_netをどこまで観測可能にするか。
- 終了済みPJ: hindsightでP/R_netを盛りすぎていないか。

### 5.2 P/R_net rubric

`P` は「市場規模っぽさ」だけでなく、AMDが狙う成功上限として定義する必要がある。TAM、政策予算、社会課題、代替技術、価格受容、出口可能性のどれを採るかを混ぜない。

`R_net` は、単なる売上可能性ではなく次の純貢献で定義する必要がある。

```text
R_net = gross margin contribution - operating cost - resource damage to main project
```

ただし、これはまだ式の方向性であってrubricではない。正式rubricには、0-9段階、観測データ、誰が入力するか、どの頻度で更新するか、PJフェーズ別の扱いが必要。

### 5.3 DB schema / 入力主体

正式化するなら、P/R_netをどこに置くかを決める必要がある。

候補:

- `amd_score_inputs` に列追加: AMD Scoreと同じ時点評価として扱えるが、正式採用に見えやすい。
- 別テーブル `amd_score_prs_scenarios`: comparison layerとして履歴と仮説を分けやすい。
- DBには入れず、BZM検証シート/runnerだけ: 初期検証として安全だが、OS画面との連携は弱い。

入力主体:

- えいみ/worker初期投入: 速いが推測が混ざる。
- まさレビュー入力: 精度は高いが負荷が大きい。
- L2抽出候補から自動提案: 将来向きだが、承認ゲートが必須。

### 5.4 既存7軸で説明できない差分

PRS採用の核心条件は、次の問いに答えられること。

> 現行7軸のsigma_SU / XRL / FRL / alpha調整では説明できないが、PまたはR_netを足すと説明できる判断差分は何か。

この差分がなければ、PRSは理論置換ではなく、現行7軸の表示名変更に留めるべき。

### 5.5 過去スコア解釈への影響

正式採用する場合、過去のAMD Scoreをどう扱うかを決める。

- 旧7軸scoreを残すのか。
- 新PRS scoreを別versionで併記するのか。
- 旧scoreのフェーズ閾値をどう読むのか。
- 過去の「早すぎた/GO/NO_GO」判断を上書きするのか。

結論: 過去scoreは上書きしない。採用する場合も `score_model_version` 相当で併記し、過去の判断ログを後から消さない。

## 6. BZM review gate

PRS候補をBZM理論へ進める時は、次のgateをすべて確認する。

| Gate | 確認すること | 不合格なら |
|---|---|---|
| 1. Scope clarity | これは正式理論変更か、比較レイヤーか、UI説明か | `候補` と明記して差し戻す |
| 2. Evidence breadth | 複数PJ・複数フェーズ・反例を見たか | 1事例のcase noteに留める |
| 3. Existing-model sufficiency | 現行7軸/alpha/FRL CESで説明できない差分か | 7軸の解釈改善に戻す |
| 4. Rubric observability | P/R_netを0-9で観測可能にできるか | DB化せず仮入力に留める |
| 5. Boundary clarity | BRLとR_net、HRLとFRL、SRLとsigma_SUを混ぜていないか | 軸定義を再分解する |
| 6. Historical safety | 過去score/判断ログを上書きしないか | versioned併記へ変更する |
| 7. Actionability | PRSで次の打ち手が具体化するか | 理論採用ではなく補助表示に留める |
| 8. Theory safety | BZM第5部・6部・FRL章との矛盾がないか | BZM附則に未決として残す |

レビュー結果の分類:

- `Adopt as comparison layer`: 画面/メモ/章末付記で候補として使う。
- `Hold as theory candidate`: BZM理論候補として証拠待ち。
- `Case-only`: ティエムなど個別事例の解釈として残す。
- `Reject / merge into 7-axis`: 現行7軸で説明できるため独立採用しない。

## 7. 司令塔判断事項

1. PRS候補の次段階を「BZM理論候補」として進めるか、「OS比較レイヤーの観察」に留めるか。
2. P/R_net rubric workerを切るか。切る場合、先に9PJのP/R_net evidence収集を行うか、rubric draftを先に作るか。
3. DB化の前に、`amd_score_prs_scenarios` のような別テーブル案を検討するか。
4. Textbook側には「PRSはまだ正式理論ではない」と明示した上で、実践章の問いとしてだけ使わせるか。

## 8. 次アクション案

1. BZM司令塔がこのメモをレビューし、`Adopt as comparison layer` でよいか判断する。
2. 次workerで `P/R_net rubric draft` を作る。ただし確定ではなく、9PJ evidence収集用の観測項目案に留める。
3. 別workerで9PJについて「現行7軸で説明できない差分」だけを抽出する。
4. その結果が揃うまで、DB migration、正式score置換、過去score再計算は行わない。
