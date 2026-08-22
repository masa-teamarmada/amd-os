# モデル版数台帳

> **状態**: ledger v1 / 2026-08-22 / 作成指示 = 承認台帳 [APPROVALS.md](./APPROVALS.md) #2026-08-22-1 / 台帳本文の内容承認はまさ未確認（確認後に承認行を追加する）

この1枚が、AMD OS のモデルについて「いまの正式版は何か」「過去はどんな式だったか」「いつ、誰の判断で変わったか」に答える入口である。

ここに載っていない式・変数・パラメータは、現行モデルではない。

正本の本文は `bzm/` 配下の各文書に置いたままで、この台帳は場所と版と確定の根拠を指す。

---

## 1. いまの正式版

| 系列 | 現行版 | 式 | 状態 | 正本ファイル |
|---|---|---|---|---|
| **SPS**（シーズ一次選別） | `sps-ind-tier0-v1` / `measure=sps-ind-v1` | $\mathrm{SPS}=\sum_o q_o P^{\mathrm{ind}}_o$ | まさ確定 2026-08-16。735件へ投入済み（うち108行は一文だけの証拠が残り見直し待ち。[変更履歴](../bzm/9-5-appendix-changelog.md) 2026-08-22行（:245））。用途は接触順の粗い下書き | [到達見込みモデル](../bzm/sps-2-0-reachability-model.md)（式とqの正本）／[産業創出価値への差し替え](../bzm/SPS_NAT_VALUE_MEASURE_PROPOSAL_2026-08-16.md)（$P^{\mathrm{ind}}$の定義）／[qルーブリック](../bzm/SEED_Q_RUBRIC_2026-08-15.md) |
| **BZM 2.2**（事業価値の動学） | `provisional-pilot-v0.1 / unvalidated` | 八層状態 $\mathbf s_t$ と、pilot表示の $J$・$P$・$Q$・$S$ | 前向き検証0件。本実装前（pilot 画面は内部 shadow 試算）。**測定済みの $q$ または $q_{\mathrm{rob}}$、PJ間比較、投資判断、資源配分に使わない** | [BZM 2.2 — 戦略余力と推進力の動学](../bzm/bzm-2-2-strategic-slack-and-propulsion.md) |

2系列は別の問いに答える。

SPS は「このシーズに接触する価値があるか」を桁で並べる一次選別である。

BZM は「このPJは何を選べば、余力を失う前に目標へ届くか」を状態と行動で解く動学である。

一つの合成スコアにしない。

---

## 2. 現行の式と記号

現行SPSは、価値実現経路ごとの到達確率と条件付き価値の積を、全経路にわたって足したものである。

$$
\mathrm{SPS}=\sum_{o\in\mathcal O} q_o\,P^{\mathrm{ind}}_o
$$

| 記号 | 意味 |
|---|---|
| $\mathcal O$ | 相互排他かつ網羅的な価値実現経路の集合 |
| $q_o$ | 経路 $o$ へ分類される実世界の条件付き確率 |
| $P^{\mathrm{ind}}_o$ | 経路 $o$ に到達した場合の産業創出価値（円建てストック） |

一次選別（Tier 0）の現行データは単一経路に縮退しているため、実際の計算は次の形になる。

$$
\mathrm{SPS}=P^{\mathrm{ind}}\times \frac{q}{100}
$$

DB は円の整数で持ち、画面は億円で出す（出典: [SPS 初回評価プレイブック](../bzm/SPS_INITIAL_ASSESSMENT_PLAYBOOK.md) §2）。

### SPS — シーズ有望度スコア {#var-sps}

到達見込みと産業創出価値の積で表す、円建ての量である。

`/model` ページ上部に出る式 $\mathrm{SPS}=q\times P^{\mathrm{ind}}$ は、Tier 0 の単一経路への縮退形である。正式は全経路の和 $\mathrm{SPS}=\sum_o q_o P^{\mathrm{ind}}_o$（§2）。

版の系譜は一本しかない（[用語集](../bzm/terminology_glossary.md) §1.7、まさ確定 2026-08-15）。

> 「SPSはひとつしかない。過去のモデルに欠陥があったからどんどん新しいモデルにバージョンアップしてるのに」
> — まさ、2026-08-15

帯（下限〜上限）で置き、OS一覧の表示とソートは中央値（算術中点・仮置き）を主、帯を括弧併記とする（まさ裁定 2026-08-15）。

用途境界は「接触順の粗い下書き」であり、投資判断と対外表示には使わない（[q評価台帳v2](../bzm/SEED_Q_EVAL_V2_AND_SPS_IND_LEDGER_2026-08-16.md)）。

### q — 到達見込み {#var-q}

理論上の $q$ は、計画期限内かつ戦略余力を失う前に資本自立へ着く確率である。

$$
q_{\mathrm{plan},\tau}(H_v)=\Pr^{\mathbb P}\!\left(T_C<T_Y,\ T_C\le H_v\mid\mathcal I_\tau\right)
$$

| 記号 | 意味 |
|---|---|
| $T_C$ | 資本自立の共通到達目標 $G_{\mathrm{self}}(12\mathrm m)$ へ初めて着くまでの時間 |
| $T_Y$ | 戦略余力を失うまでの時間 |
| $H_v$ | 計画版 $v$ の判定期限 |
| $\mathcal I_\tau$ | 情報締切 $\tau$ までに利用できた証拠の集合 |
| $\mathbb P$ | 実世界の確率測度 |

出典: [到達見込みモデル](../bzm/sps-2-0-reachability-model.md) §1・§3。

共通到達目標 $G_{\mathrm{self}}(12\mathrm m)$ は次の状態である（同 §2）。

> 反復可能な外部対価によって、新規の資金調達がなくても 12 か月は通常運営と既存債務の履行を継続でき、資金調達を生存条件ではなく成長選択として扱える状態。

判定は二段構えで、主要件は稼ぎが必要支出をまかなうこと、副次要件は途中の月に現金が尽きないことである。

$$
R_{\mathrm{rep}}[t,\ t+12]\ \ge\ E_{\mathrm{req}}[t,\ t+12]
$$

$$
C_{0}+R_{\mathrm{rep}}[t,\ s]-E_{\mathrm{req}}[t,\ s]\ \ge\ 0\qquad (s=t+1,\ \ldots,\ t+12)
$$

| 記号 | 意味 |
|---|---|
| $R_{\mathrm{rep}}[t,s]$ | 期間 $[t,s]$ に入る反復可能な外部対価。契約か12か月以上の実績で裏づけられるもの |
| $E_{\mathrm{req}}[t,s]$ | 期間 $[t,s]$ の必要支出。運営費、既存債務、事業継続に欠かせない維持更新投資を含み、成長投資は含めない |
| $C_0$ | 判定時点の手元資金。交付決定済み・契約済みの未受領分を含む |

一次選別で置く $q$ は、この理論量に対する評価者の判断帯である（[qルーブリック](../bzm/SEED_Q_RUBRIC_2026-08-15.md) §4の1「総合のq帯（資本自立への到達見込み、下限%〜上限%）」、[SPS 初回評価プレイブック](../bzm/SPS_INITIAL_ASSESSMENT_PLAYBOOK.md) §4「$q$ は『資本自立の経路へ到達する確率(%)』」）。

帯 $q$ と計画期限 $H_v$ の対応は、正本に記載がない（第2回二役監査が「qの時間地平未定義」を要対応として挙げたまま。[変更履歴](../bzm/9-5-appendix-changelog.md) 2026-08-15行（:223））。

判断の観点は11要因のルーブリックで固定する（[qルーブリック](../bzm/SEED_Q_RUBRIC_2026-08-15.md)、`rubric v1 / masa-agreed 2026-08-15 / frozen`、§5にv1.1運用指針）。

二大要素はユニットエコノミクス成立性と資本集約度で、他に9要因（スケール律速の型、再現性、誰の財布か、顧客の検証コスト、規制・認証の関門、代替解との差の桁、社会受容性、マイクロトレンド適合、特許の状態）を見る。

要因から帯への機械的な変換式は作らない（係数の発明禁止）。

研究者の事業化シグナルは帯に効かせない（まさ確定「そもそも研究者は経営に関わらせないのがAMDのデフォルトスタイル」）。

工程確率を入力とする $q_{\mathrm{plan},\tau}(H_v)$ について、正本 §5.1 は「現行の工程確率は単一評価者の確信度」であり「世界の性質の測定ではなく、単一評価者の構造化された信念の測定」であると位置づける（同モデル §5.1、2026-08-15追記）。

### P^ind — 産業創出価値 {#var-p-ind}

経路 $o$ に到達した場合に、そのシーズ事業が**日本国内に生む付加価値の割引現在価値の桁**である（円建てストック）。

出典: [SPS価値項の産業創出価値への差し替え](../bzm/SPS_NAT_VALUE_MEASURE_PROPOSAL_2026-08-16.md) §2.1（`v0.3 / dual-audited / masa-agreed 2026-08-16`）。

定義に含まれること、含まれないことを、正本の記述のまま置く。

- 主量は**国内付加価値のNPV一本**である。輸出額を付加価値へ加算しない（二重計上になるため、経済役P0-2で棄却）。
- 年次の付加価値ではなく**割引現在価値（ストック）**である。Tier 0では「年次付加価値の桁 × 継続年数の桁」の粗い掛け算で構成してよいが、記録する量はストックとする。
- **外需比率は属性として併記**する。財の輸出・サービス輸出・海外ライセンス収入・輸入代替の割合の桁を、高/中/低/なしで持つ。
- サプライチェーン波及・産業集積・地域乗数は**係数化しない**。記述子として特記に残す。
- 厚生成分（防災の被害回避など、支払いに現れない消費者余剰）は**測らないことを定義に明記**する。
- **分野による除外はしない**（まさ裁定 2026-08-16）。被害回避・国内効率化の便益も、顧客が対価を払う限り売上→国内付加価値として自然に入る。
- **実績限定**。研究者・機関側の「輸出予定」「量産予定」等の宣言・計画は根拠に数えない。

判断の観点は4つ（売り先の桁／国内付加価値の発生／輸入代替／継続の桁）で、24件の較正記録が [P^ind帯 判断記録](../bzm/SEED_P_IND_JUDGMENT_2026-08-16.md) にある。

$P^{\mathrm{ind}}$ と対になる持分価値量 $V^{\mathrm{eq}}=\sum_o q_o P^{\mathrm{eq}}_o$ は廃止せず内部量として保存するが、SPSとは呼ばず、OS一覧には表示しない。

$\mathrm{SPS}$ と $V^{\mathrm{eq}}$ を重みで合成しない（同 §2.3）。

割引率の置き方について、正本は評価方式を一つだけ選び、同じリスクを期待キャッシュフロー・経路確率・割引率へ重複投入しないことを規律として定めている（[到達見込みモデル](../bzm/sps-2-0-reachability-model.md) §1）。

$P^{\mathrm{ind}}$ に固有の割引率の値と、その置き方の手順は、正本に記載がない。

### o — 価値実現経路 {#var-o}

$H_{\mathrm{econ}}$ までに観測する、相互排他かつ網羅的な決着の型である。

計画期限内の資本自立 $G_{\mathrm{plan}}$、$H_v$後から $H_{\mathrm{econ}}$ までの資本自立 $G_{\mathrm{late}}$、ライセンス、M&A、知財売却、ピボット、撤退、清算、そして未決着の履歴を入れる残余経路 `unresolved_continuation` からなる。

同じ履歴が複数の名称へ当てはまりうるため、どの履歴をどの経路へ割り当てるかは計算前に固定する。

$q_o=0$ の経路では $P_o$ を定義できないため、その寄与 $q_oP_o$ だけを0とする。

未知の $P_o$ を0と置くことは、この規則に含まれない。

出典: [到達見込みモデル](../bzm/sps-2-0-reachability-model.md) §1、[BZM 2.0 改訂要求書](../bzm/BZM_2_0_REVISION_REQUIREMENTS.md) §4.2。

### τ — 情報締切 {#var-tau}

その評価が利用してよい証拠の締切時点である。

$\mathcal I_\tau$ は $\tau$ までに利用できた証拠の集合を指す。

結果を見てから入力を書き換える後知恵を排除するために置く。

計画版を表す $v$ とは別の添字である（同 §3.5）。

### H_econ — 共通経済評価地平 {#var-h-econ}

全PJへ同じ長さで置く、経路分類と継続価値評価の共通境界である。

計画版 $v$ のPJ固有期限 $H_v$ とは別で、統合測定では次の順序を満たす版だけを使う。

$$
0 < H_v \le H_{\mathrm{econ}}
$$

$H_{\mathrm{econ}}$ は、それ以後のキャッシュフローを0とする境界ではない。

残る価値は $H_{\mathrm{econ}}$ 時点の継続価値または残存価値として現在価値へ含める。

$H_v>H_{\mathrm{econ}}$ なら地平契約が閉じていないため、その版の三段価値を計算しない。

**実際に使う長さは未固定である**（同 §5の6）。値を固定する前は $q_{G,\tau}(H_{\mathrm{econ}})$、$P_{G,\tau}(H_{\mathrm{econ}})$、$\mathrm{SPS}_{\mathrm{all},\tau}(H_{\mathrm{econ}})$ を計算しない。

PJ比較には、同じ経過時間 $h$ を使う累積到達曲線を用いる。

$$
Q_\tau(h)=\Pr^{\mathbb P}\!\left(T_C<T_Y,\ T_C\le h\mid\mathcal I_\tau\right)\qquad(0\le h\le H_{\mathrm{econ}})
$$

---

## 3. 版の系譜 — SPS {#lineage-sps}

| 時期 | 呼び名 | 式 | 何が変わったか | 確定の根拠 | 正本ファイル |
|---|---|---|---|---|---|
| 〜2026-08-15 | 旧9軸（Cobb-Douglas型） | $\text{統合スコア}=K\cdot\prod_{i=1}^{9}(X_i+1)^{\alpha_i}$（$\sum\alpha_i=7.8$、$K=10^5/10^{7.8}\approx0.00158$）。四群へ括ると $M\times P\times R\times S$ | — | 2026-08-15 まさ裁定で**退役**（表示・計算・選別から外す。履歴は監査規律に従い保存） | [計算式と律速診断](../bzm/score-and-bottleneck.md)（式の本体）／[BZM 2.0 改訂要求書](../bzm/BZM_2_0_REVISION_REQUIREMENTS.md) §4.2（四群との代数的同一性） |
| 2026-08-04（試行採点の開始）〜2026-08-11（`theory-fixed v1.4` へ改訂・凍結） | SPS 2.0 世代（BZM 2.0 の価値層） | $\mathrm{SPS}_{\mathrm{all},\tau}(H_{\mathrm{econ}})=\sum_{o\in\mathcal O}q_{o,\tau}P_{o,\tau}$（円建て・**持分価値**） | 単一の順序尺度スコアから、経路別の確率 × 条件付き正味現在価値へ。単位が円になった | [BZM 2.0 診断スコア暫定仕様](../bzm/BZM_2_0_DIAGNOSTIC_SCORE_SPEC.md) §1の16・§2 | [到達見込みモデル](../bzm/sps-2-0-reachability-model.md)（`theory-fixed v1.4`） |
| 2026-08-15 | 版番号を廃止し「現行SPS」単一系譜へ | 同上（式は不変） | 「SPSはひとつしかない」。9軸を旧版として退役させ、到達見込みモデル章の式を現行と確定。円建て量を $V_{\mathrm{all}}/V_G$ へ改名する案は撤回 | まさ確定 2026-08-15 → [用語集 §1.7](../bzm/terminology_glossary.md) | [用語集](../bzm/terminology_glossary.md) §1.7 |
| 2026-08-16 | 現行（産業創出価値版） | $\mathrm{SPS}=\sum_o q_o P^{\mathrm{ind}}_o$ | **式の形と次元は不変のまま、$P_o$ の中身を持分価値から産業創出価値へ差し替え**。持分価値は $V^{\mathrm{eq}}$ として内部保存 | まさ裁定3点（名前・分野除外の撤回・版統治）→ [提案 §8](../bzm/SPS_NAT_VALUE_MEASURE_PROPOSAL_2026-08-16.md) | [SPS価値項の産業創出価値への差し替え](../bzm/SPS_NAT_VALUE_MEASURE_PROPOSAL_2026-08-16.md)（`v0.3 / masa-agreed`） |
| 2026-08-18 | latest-only 統治 | 同上 | OSの active 版を凍結tuple完全一致に固定。旧9軸・`sps-eq-v0`・SPS 2.1・旧 project registry を表示・sort・API・writer から退役。欠測は「最新版未評価」 | まさの latest-only 確定 → [変更履歴](../bzm/9-5-appendix-changelog.md) 2026-08-18行 | [q評価台帳v2 + SPS一覧](../bzm/SEED_Q_EVAL_V2_AND_SPS_IND_LEDGER_2026-08-16.md)「2026-08-18 現行版の統治と再評価入口」 |

### 名前についての注意

**「SPS 2.1」は、現行SPSの版名ではない。**

ただし呼称の履歴はある。2026-08-12 に、BZM 2.1 の方針条件付き価値を「SPS 2.1」と呼び、旧SPSを退避したうえで active 版として表示した（[変更履歴](../bzm/9-5-appendix-changelog.md) 2026-08-12行（:205）「全12PJの推定SPS 2.1 v0.1」「旧SPSとBZM 2.0は削除せず復元可能なarchiveへ退避し、SPS 2.1のactive版とは版・根拠・hashで分離する」）。

呼ばれていた量は「会社を権限主体とする一つの方針の下で、評価日時点以後に生じる会社保有PJの正味キャッシュフローを集計した**方針条件付き将来正味PJ価値**」である（[SPS_2_1_ALL_PJ_RAW_EXTRACTION_2026-08-12.md](../bzm/SPS_2_1_ALL_PJ_RAW_EXTRACTION_2026-08-12.md) :21。同ファイル冒頭の版は `estimated-v0.1 / shadow`）。

この呼び名は 2026-08-18 の latest-only 統治で退役した（[変更履歴](../bzm/9-5-appendix-changelog.md) 2026-08-18行（:235）「旧9軸、sps-eq-v0、SPS 2.1、旧project registryを表示・sort・API・writerから退役し、欠測は最新版未評価」）。

**「SPS 2.3」というモデル版は存在しない。**

この台帳が確認した SPS の版は、旧9軸／SPS 2.0 世代／版番号廃止後の単一系譜（`sps-ind-tier0-v1`）だけである。

**`sps-2-0-reachability-model.md` は、ファイル名に世代名 2-0 が残っているが中身は現行である。**

状態は `theory-fixed v1.4`（2026-08-11 改訂、2026-08-15 に §5.1 追記）で、この章の $\mathrm{SPS}_{\mathrm{all}}$／$\mathrm{SPS}_G$ が現行SPSの式である。

### 旧9軸の式（退役済み・参照専用）

退役した式そのものは次である。

$$
\text{統合スコア}=K\cdot\prod_{i=1}^{9}(X_i+1)^{\alpha_i}
$$

| 記号 | 意味 |
|---|---|
| $X_i$ | 9本の軸それぞれの値（0〜9の順序段階） |
| $\alpha_i$ | 軸ごとの重み。$F$=1.5、$\sigma_{SU}$=1.3、$HRL$=1.1、$TRL$=1.0、$P$=1.0、$R_{\mathrm{net}}$=0.8、$BRL$=0.6、$GRL$=0.3、$SRL$=0.2（合計7.8） |
| $K$ | 目盛り合わせの定数。全軸最高でスコア100,000となるよう $K=10^5/10^{7.8}\approx0.00158$ |

$+1$ シフトは、ゼロの軸があってもスコアが消えないようにするためと、シフト後の各軸を1〜10のちょうど一桁に収めるための細工である。

この式は現行の計算・表示・選別に使わない。

TRL 等の指標は、段階仮説と状態の記述子として入力側に残ってよいが、スコアの集約には使わない（[用語集 §1.7の3](../bzm/terminology_glossary.md)）。

---

## 4. 版の系譜 — BZM {#lineage-bzm}

四つの版は置き換え関係ではなく、別の問いに答える層として並存する（[進化ガイド](../bzm/bzm-1-0-to-2-1-evolution-guide.md) §6）。

| 版 | 呼び名 | 動くもの | 中核式 | 状態 | 正本ファイル |
|---|---|---|---|---|---|
| 1.x | 動的観測モデル | 観測値と診断スコア | $\text{統合スコア}=K\cdot\prod_{i=1}^{9}(X_i+1)^{\alpha_i}$ | 9軸スコアは 2026-08-15 に退役（[用語集 §1.7の2](../bzm/terminology_glossary.md)）。**下の「正本間の未解決不整合」を参照** | [計算式と律速診断](../bzm/score-and-bottleneck.md) |
| 2.0 | 動的到達予測モデル | 固定した計画の到達経路と到達見込み | $q_{\mathrm{plan},\tau}(H_v)=\Pr^{\mathbb P}(T_C<T_Y,\ T_C\le H_v\mid\mathcal I_\tau)$、$\mathrm{SPS}_{\mathrm{all},\tau}=\sum_o q_{o,\tau}P_{o,\tau}$ | `theory-fixed v1.4`。前向き検証0件。凍結状態は [BZM 2.0 凍結スナップショット](../bzm/BZM_2_0_FROZEN_SNAPSHOT_2026-08-11.md) | [到達見込みモデル](../bzm/sps-2-0-reachability-model.md)／[BZM 2.0 診断スコア暫定仕様](../bzm/BZM_2_0_DIAGNOSTIC_SCORE_SPEC.md)（`draft v0.7`） |
| 2.1 | 動的事業価値モデル | 行動選択、次の状態、到達見込み、正味価値 | $V^*_{u_d,\tau}(n)=\max_{a\in\mathcal A_d(n)}J^*_{u_d,\tau}(n,a)$ | `theory-open v2.1 / implementation-prototype`。前向き検証0件 | [BZM 2.1 — 動的な事業価値モデル](../bzm/bzm-2-1-dynamic-business-value-model.md) |
| 2.2 | 戦略余力と推進力の動学 | 資源、能力、行動別制約、状態遷移、目標到達経路 | 八層状態 $\mathbf s_t$、$T_Y^{2.2,\pi_d^*}$、pilot表示の $J$・$P$・$Q$・$S$ | **`provisional-pilot-v0.1 / unvalidated`。前向き検証0件。本実装前（pilot 画面は内部 shadow 試算）。測定済みの $q$ または $q_{\mathrm{rob}}$、PJ間比較、投資判断、資源配分に使わない** | [BZM 2.2 — 戦略余力と推進力の動学](../bzm/bzm-2-2-strategic-slack-and-propulsion.md) |

### 正本間の未解決不整合（まさ判断待ち）— 1.x の9軸

1.x 行の扱いについて、正本の記述が二つに割れている。

- [用語集](../bzm/terminology_glossary.md) §1.7の2（:116）: 「9軸Cobb-Douglas型のスコア（旧運用SPS、$K\cdot M\cdot P\cdot R\cdot S$）は旧版であり、現役の表示・計算・選別から退役させる」（2026-08-15 まさ確定）。
- [進化ガイド](../bzm/bzm-1-0-to-2-1-evolution-guide.md) §6（:175）: 「現行運用SPSは、企業価値、成功確率、投資価値ではなく、9軸の診断指数として維持する」（`concept-guide v1.1`）。

2026-08-15 に BZM 2.1 §3・BZM 2.2 §9・一次選別設計 §6 の同種記述は掃除されたが、進化ガイド §6 は未修正である（[変更履歴](../bzm/9-5-appendix-changelog.md) 2026-08-15行（:218））。

この台帳は、まさの確定発言を直接記録している用語集 §1.7 を優先し、「退役」と書く。進化ガイド §6 の該当文を errata とするか据え置くかは、まさの判断を待つ。どちらかを正しいと決めたわけではない。

BZM 2.1 の行動価値は、行動 $a$ を一度だけ選び、その後は方針 $\pi$ に従う正味価値として定める。

$$
J^{\pi}_{r,\tau}(n,a)=-C^{\mathrm{now}}_{r,\tau}(n,a)+\sum_{n'}w_{r,\tau}(n,a,n')\left[CF_r(n,a,n')+V^{\pi}_{r,\tau}(n')\right]
$$

| 記号 | 意味 |
|---|---|
| $r$ | 会社、BZSF、公的支援者のいずれかの評価視点 |
| $d$ | ノードで行動を選ぶ法的・契約上の権限主体 |
| $n$、$n'$ | 現在ノードと次ノード |
| $C^{\mathrm{now}}_r$ | 現在時点で発生する視点 $r$ の正味費用 |
| $CF_r$ | 現在判断の直後から次の判断までに発生する正味キャッシュフロー |
| $w_r$ | 事前登録した、遷移確率と割引を合わせた価値評価重み |
| $\mathcal A_d(n)$ | 主体 $d$ がノード $n$ で実行権限を持つ行動集合 |

三視点（会社・BZSF・公的支援者）の価値を一つへ合成して「最適」と呼ばない（同 §8）。

### 八層状態 {#bzm-state}

BZM 2.2 は、評価時点 $t$ の情報状態を八つの層に分ける。

$$
\mathbf s_t=(\mathbf x_t,\mathbf r_t,\widehat{\mathbf c}_t,\mathbf k_t,\mathbf n_t,\boldsymbol\ell_t,\mathbf e_t,\mathbf b_t)
$$

| 状態 | 意味 |
|---|---|
| $\mathbf x_t$ | 検証済みの進捗と知識証拠 |
| $\mathbf r_t$ | 現在利用できる資源（使途別現金、工数、設備時間、試料、データ） |
| $\widehat{\mathbf c}_t$ | 組織に蓄積した実行能力の推定分布の要約 |
| $\mathbf k_t$ | 権利、契約、統治、規制上の状態 |
| $\mathbf n_t$ | 相手方ごとの関係と確約状態 |
| $\boldsymbol\ell_t$ | 受け手別の正当性と受容状態 |
| $\mathbf e_t$ | 外部環境と期限 |
| $\mathbf b_t$ | 未確定事象についての信念 |

各状態はベクトルであり、異なる単位を足して一つの点数にしない。

八層は資源の棚卸しではない。同じ対象でも意味の違う層へ分ける（設備そのものは $\mathbf r_t$、設備で確認した性能は $\mathbf x_t$、設備を使う権利と条件は $\mathbf k_t$）。

戦略余力は固定成分の合計ではなく、目標到達方針の壊れにくさから導く。

$$
T_Y^{2.2,\pi_d^*}=\inf\left\{h\in\mathcal H_{\mathrm{dec}}^{\pi_d^*}\;\middle|\;\mathbf s_{t+h}^{\pi_d^*}\notin\mathcal K_{\mathcal T}^{-}(\alpha,H-h;\Delta)\right\}
$$

| 記号 | 意味 |
|---|---|
| $\mathcal K_{\mathcal T}^{-}$ | 頑健捕捉領域。最悪登録ショックの下でも目標へ届く登録方針を必要な確度で保持できる状態の集合 |
| $\mathcal H_{\mathrm{dec}}^{\pi_d^*}$ | 目標到達・許容不能状態への到達より前の判断時点までの経過時間集合 |
| $\Delta$ | 登録ショックの集合 |
| $\alpha$ | 必要な確度 |

これは、BZM 2.0 の固定五成分（資金・顧客信用・チーム・知財・代替選択肢）の $\min$ ではない。

以下の $J$・$P$・$Q$・$S$ は、OS の pilot 画面で式を読むための四記号である（同 §16）。

**SPS の $P^{\mathrm{ind}}$・$q$ とは別量であり、同じ文字でも読み替えない。**

### J — 全経路を重みづけした現在価値 {#bzm-j}

登録方針と全分岐を固定し、途中CF・成功時価値・停止時価値を数える。

$$
J=\sum_{t=1}^{H}d_tW_tCF_t+d_HQ\,TV+\sum_i d_{t_i}\left(\prod_{j<i}p_j\right)(1-p_i)RV_i
$$

| 記号 | 意味 |
|---|---|
| $d_t=(1+r_d)^{-t/12}$ | 評価日から $t$ か月後の金額を現在価値へ直す割引係数 |
| $W_t=\prod_{i\in G:t_i\le t}p_i$ | その月まで経路が続いている重み |
| $CF_t$ | 月次経済CF |
| $TV$ | 目標到達後の終端価値 |
| $RV_i$ | gate $i$ で停止したときの残存価値 |
| $G$、$t_i$、$p_i$ | 登録gateの集合、gate $i$ の判定月、先行gate通過を条件にした通過値 |

### P — 成功条件付きの現在価値 {#bzm-p}

登録方針と全gate通過を固定したときの現在価値である。

$$
P=\sum_{t=1}^{H}d_tCF_t+d_HTV
$$

### Q — gate積 {#bzm-q}

登録gateの順序を固定したときの、全gateを通り切る代理指数である。

$$
Q=\prod_{i\in G}p_i
$$

現pilotでは**未校正**であり、確率と呼ばない。

$J\ne QP$ であり、差は次で表される。

$$
J-QP=\sum_t d_t(W_t-Q)CF_t+\sum_i d_{t_i}\left(\prod_{j<i}p_j\right)(1-p_i)RV_i
$$

$QP$ では、失敗が確定する前に発生したCFと、どのgateで止まったかに応じて残る価値が消える。

内部pilotのp03では $Q=0.13572$、$P=¥384M$、$J=¥12M$、停止寄与 $-¥20M$ で、$QP\approx¥52M$ との差 約$¥40M$ は計算誤差ではない。

### S — 逆風耐久指数 {#bzm-s}

登録gateと登録stressを固定したときの、最悪stress下のgate積である。

$$
S=\min_{\delta\in\Delta_{\mathrm{reg}}}\prod_{i\in G}(p_im_{i\delta})
$$

| 記号 | 意味 |
|---|---|
| $\Delta_{\mathrm{reg}}$ | 登録stressの集合 |
| $m_{i\delta}$ | stress $\delta$ の下でgate $i$ の通過値へ掛ける補正 |

この $S$ は戦略余力そのものではない。

戦略余力は実行可能行動集合・頑健捕捉領域・方針を失う時点を含む診断であり、$S$ はその一部を画面用に射影した値にすぎない。

---

## 5. 2系列の関係

**価値の物差しは 2026-08-16 に分かれた。**

それ以前の SPS の価値項 $P_o$ は、BZM 2.0 が定義した「評価日時点で存在する全持分証券への条件付き正味現在価値」だった（[到達見込みモデル](../bzm/sps-2-0-reachability-model.md) §1）。

2026-08-16 以降、SPS の価値項は $P^{\mathrm{ind}}$（国内付加価値のNPV）に替わり、持分価値は $V^{\mathrm{eq}}$ として別量になった。

$V^{\mathrm{eq}}$ の用途は、BZSFフロア型ファンドの関門（期待リターン下限の判定）、資本政策、SX/LST 本測定の既存結果である（[提案 §2.2](../bzm/SPS_NAT_VALUE_MEASURE_PROPOSAL_2026-08-16.md)）。

**$q$ の機構は価値尺度と独立で不変である。**

ルーブリック・帯・根拠Lv・凍結・決着時採点の規律は、価値項の差し替え後もそのまま乗る（同 §2.2）。

**BZM 2.2 の pilot 出力を SPS の入力にしない。**

既存PJのSPS retrofit では、台帳の `q_gate_product_proxy`・成功条件付き価値 $J$・旧 `amd_rating`・旧9軸を**評価の入力にしない**盲検規律を置いた（[SPS_IND_RETROFIT_EXISTING_PJ_2026-08-17.md](../bzm/SPS_IND_RETROFIT_EXISTING_PJ_2026-08-17.md) :12 の字面のまま転記）。

**正本間の未解決不整合（まさ判断待ち）**: この「成功条件付き価値 $J$」という呼び方は、[BZM 2.2](../bzm/bzm-2-2-strategic-slack-and-propulsion.md) §16 の記号定義と合わない。同 §16 の表では、成功条件付きの現在価値は $P$（:1405）、$J$ は全経路を重みづけした現在価値（:1408）である。この台帳の [#bzm-j](#bzm-j)・[#bzm-p](#bzm-p) は §16 に従っている。retrofit 側を errata とするかは、まさの判断を待つ。盲検規律の中身（この4つを入力にしない）は、どちらの読み方でも変わらない。

**診断・予測・価値・判断を混ぜない。**

SPS の一次選別は接触順の下書き、BZM 2.2 は状態と行動の動学であり、二つを合成した単一スコアを作らない。

**予測地平の分業。**

BZM の第一地平は $G_{\mathrm{self}}(12\mathrm m)$ であり、回収・出口・投資収益はBZM の地平外で、BZSF 投資層が受け持つ（[領域定義](../bzm/sps-2-0-domain-definition.md) §4・§5、[用語集 §6](../bzm/terminology_glossary.md)）。

投資判定は BZM 出力（$q$、$\mathbf P$）と BZSF 投資層の**二階建て**で、BZM 単体でGO・投資額・投入人月を決めない。

---

## 6. 凍結tuple と参照規律

現行版のデータは、次のタグの**完全一致**でのみ有効である。

| 列 | 値 |
|---|---|
| `model_version` | `sps-ind-tier0-v1` |
| `measure_version` | `sps-ind-v1` |
| `q_model_version` | `q-eval-v2` |
| `q_ruleset_version` | `rubric-v1.1` |
| `p_model_version` | `p-ind-v1` |
| `assessment_ruleset_version`（※列名が揺れている） | `rubric-v1.1+ind-v1` |

出典: [SPS 初回評価プレイブック](../bzm/SPS_INITIAL_ASSESSMENT_PLAYBOOK.md) §2、[SPS_IND_SPUNOFF_AND_TARGETED_2026-08-20.md](../bzm/SPS_IND_SPUNOFF_AND_TARGETED_2026-08-20.md) :9。

※ 6列目の列名は正本のあいだで揺れている。値はどれも `rubric-v1.1+ind-v1` で同じ。

- DB 列名は `ruleset_version`（テーブル `seed_screening_bands`）。出典: [既存PJ retrofit](../bzm/SPS_IND_RETROFIT_EXISTING_PJ_2026-08-17.md) :16、[変更履歴](../bzm/9-5-appendix-changelog.md) 2026-08-22行（:245）。
- プレイブック表記は `assessment_ruleset_version`（[プレイブック](../bzm/SPS_INITIAL_ASSESSMENT_PLAYBOOK.md) :37）。第3便も `ruleset_version`（[SPS_IND_SPUNOFF_AND_TARGETED_2026-08-20.md](../bzm/SPS_IND_SPUNOFF_AND_TARGETED_2026-08-20.md) :9）、q評価台帳v2は `assessment=`（[同](../bzm/SEED_Q_EVAL_V2_AND_SPS_IND_LEDGER_2026-08-16.md) :40）と書く。

列名が確定していないため、機械可読サマリ `CURRENT.json` の `versions` には上の5列だけを載せ、この6列目は台帳側の注記として持つ。

旧版は監査履歴として保持するが、欠測時の代替値、表示、ソート、書き込みに使わない。

旧 measure（`sps-eq-v0`）の数値と新 measure の数値を歴史比較しない。

### 参照規律

1. **モデルの定義**は、[LOCK.json](./LOCK.json) に載った文書（この台帳が挙げる正本のうち、ロック対象のもの）だけを出典にする。評価記録・プレイブック・変更履歴は、定義を変えない運用側の記録である。参照してよいが、定義の出典にはしない。`CURRENT.json` の `documents.canonical` では、各文書に `locked` を付けて区別している。
2. 新しい概念・変数・パラメータ・数式を、正本の外で持ち出さない。提案は `model/proposals/` へ置く。
3. 提案がまさに承認されるまで、OS上のモデルは変更しない。承認は [APPROVALS.md](./APPROVALS.md) に、まさの発言の引用つきで記録する。
4. ロック対象ファイルの改変検知は [LOCK.json](./LOCK.json) の sha256 で行う。
5. 撤回された概念は §7 に残し、復活させる場合は新しい提案として出し直す。

---

## 7. 撤回済み

| 撤回日 | 対象 | 何だったか | 撤回の理由 | 記録場所 |
|---|---|---|---|---|
| 2026-08-22 | **含意年数 $T_{\text{含意}}$** | $T_{\text{含意}}=P^{\mathrm{ind}}_{\min}/\max_{\mathrm{FY}}VA^{\mathrm{PJ}}_{\mathrm{FY}}$。置いた $P^{\mathrm{ind}}$ 下限がPJ単体のピーク年度の何年分かを表示する照合 | まさ指摘。(1) 判断層方式の規律に触れる新しい導出量を二重批判監査を通さず本番表示した、(2) 割引現在価値を無割引の単年フロー（しかも計画値）で割った商で「年数」として整合しない、(3)「事業計画からは計算できない」という結論自体が短絡 | [SPS_IND_PLAN_VALUE_CHECK_2026-08-21.md](../bzm/SPS_IND_PLAN_VALUE_CHECK_2026-08-21.md) 冒頭の撤回notice。PWA からは v3.89.2 で全撤去 |
| 2026-08-16 | **「国民経済価値」という名称** | $P^{\mathrm{nat}}$ の当初案。国内付加価値＋外貨獲得の加算 | 二役監査P0。構成概念より広い名で、被害回避価値・消費者余剰を測っていないのに測っている顔をする。加算は輸出分の二重計上かつ粗・純の混算 | [提案 §9](../bzm/SPS_NAT_VALUE_MEASURE_PROPOSAL_2026-08-16.md)。「産業創出価値」へ改名 |
| 2026-08-16 | **分野除外規則**（被害回避・国内効率化を $P^{\mathrm{ind}}$ から除く案）と**「効率化＝移転」説** | v0.1/v0.2 の案 | まさ裁定で棄却。顧客が対価を払う便益は売上→国内付加価値として自然に入るため、特別な線引き規則を置かない | [提案 §2.1・§8の2](../bzm/SPS_NAT_VALUE_MEASURE_PROPOSAL_2026-08-16.md) |
| 2026-08-15 | **円建て量を $V_{\mathrm{all}}/V_G$ へ改名する案**、および「SPSの名は9軸系譜に限る」という記録 | 同日早い時刻の記録 | えいみの取り違え。まさ訂正「（到達見込みモデル章の式が）正しい式。それ以外のSPSの式は古いバージョンで抹消されるべき情報」 | [用語集 §1.7の4](../bzm/terminology_glossary.md) |
| 2026-08-11 | **`P measurement v0.1`**（社会・経済の二成分指数） | $P_{o,\tau}$ の代替として作った指数 | 定義と単位が一致しない。指数値と根拠状態は履歴として残すが、現行 $P_{o,\tau}$ またはSPSに使わない | [到達見込みモデル](../bzm/sps-2-0-reachability-model.md) §1 |
| 2026-08-04 | **試行 v0.1**（SX 2/10,000、CX 0/10,000） | 初回のモンテカルロ試行 | 有効な試行ではない。成功確率・モデル整合性の警報・投資判断・GO判定のいずれにも使わない | [到達見込みモデル](../bzm/sps-2-0-reachability-model.md) §6 |

### 未提案・未承認の概念（撤回ではない）

撤回とは別に、正規経路を通っていないため使えない概念をここへ置く。撤回済みではないので、提案し直せば採否を判断できる。

| 対象 | 何だったか | 現在の位置づけ | 記録場所 |
|---|---|---|---|
| **$P^{\mathrm{PJ}}$（1社の国内付加価値NPV）を中間部品として持ち出すこと** | 事業計画・資本政策から $P^{\mathrm{ind}}\ge P^{\mathrm{PJ}}$ の下界チェックを作る構想 | **未提案・未承認**。提案ファイルが作られていない（この台帳の作成時点で `model/proposals/` は空）。`model/proposals/` の正規経路を通り、まさの承認を得ない限り、評価にも表示にも会話の前提にも使わない | [SPS_IND_PLAN_VALUE_CHECK_2026-08-21.md](../bzm/SPS_IND_PLAN_VALUE_CHECK_2026-08-21.md) :9「二重批判監査を通した設計として別 note で提案する」。承認台帳の引用「こないだみたいに新しいP^PJみたいな概念を勝手に持ち出すことがないように」（[APPROVALS.md](./APPROVALS.md) #2026-08-22-1）は、勝手な持ち出しを禁じた発言であり、この構想の採否そのものを述べたものではない |

---

## 8. 参考文献 {#references}

上の正本文書が引用している一次文献を、系列ごとに集めた。

正本に URL の記載がないものは、著者・年・題のみを載せている。

### SPS 系列（到達見込みモデルの脚注）

- Hansen, Lars Peter, and Scott F. Richard. 1987. "The Role of Conditioning Information in Deducing Testable Restrictions Implied by Dynamic Asset Pricing Models." *Econometrica* 55(3): 587–613. [著者公開版](https://larspeterhansen.org/lph_research/the-role-of-conditioning-information-in-deducing-testable-restrictions-implied-by-dynamic-asset-pricing-models/) — 引用元: 到達見込みモデル（確率的割引因子 $m_{\tau,u}$ の根拠）
- Financial Accounting Standards Board. 2000, amended 2021. *Concepts Statement No. 7: Using Cash Flow Information and Present Value in Accounting Measurements*. [原文PDF](https://storage.fasb.org/Concepts_Statement_7_As_Amended.pdf) — 引用元: 到達見込みモデル（同じリスクを期待CFと割引率へ重複して入れない規律）
- Financial Accounting Standards Board. *FAS 157 付録*. [原文PDF](https://storage.fasb.org/aop_fas157.pdf) — 引用元: 到達見込みモデル（同上）
- International Private Equity and Venture Capital Valuation Board. 2022. *International Private Equity and Venture Capital Valuation Guidelines*. [原文PDF](https://www.privateequityvaluation.com/Portals/0/Documents/Guidelines/IPEV%20Valuation%20Guidelines%20-%20December%202022.pdf) — 引用元: 到達見込みモデル（清算優先権とウォーターフォール）
- Gornall, Will, and Ilya A. Strebulaev. 2020. "Squaring Venture Capital Valuations with Reality." *Journal of Financial Economics* 135(1): 120–143. [論文ページ](https://www.sciencedirect.com/science/article/abs/pii/S0304405X19301692) — 引用元: 到達見込みモデル（証券ごとの契約権利が公称評価額と公正価値をずらす実証）
- Arrow, Kenneth J. 1962. "Economic Welfare and the Allocation of Resources for Invention." In *The Rate and Direction of Inventive Activity*, 609–626. [NBER原文PDF](https://www.nber.org/system/files/chapters/c2144/c2144.pdf) — 引用元: 到達見込みモデル（外部便益の扱い）
- Pástor, Ľuboš, Robert F. Stambaugh, and Lucian A. Taylor. 2021. "Sustainable Investing in Equilibrium." *Journal of Financial Economics* 142(2): 550–571. [NBER版](https://www.nber.org/papers/w26549) — 引用元: 到達見込みモデル（投資家の環境選好が価格と期待収益率へ作用する条件）
- Morgan, M. Granger. 2014. "Use (and Abuse) of Expert Elicitation in Support of Decision Making for Public Policy." *Proceedings of the National Academy of Sciences* 111(20): 7176–7184. [DOI](https://doi.org/10.1073/PNAS.1319946111) — 引用元: 到達見込みモデル（主観確率を規律の下で入力に使う標準）
- Cochrane, John H., and Jesús Saa-Requejo. 2000. "Beyond Arbitrage: Good-Deal Asset Price Bounds in Incomplete Markets." *Journal of Political Economy* 108(1): 79–119. [DOI](https://www.journals.uchicago.edu/doi/10.1086/262112) — 引用元: 到達見込みモデル（不完備市場で $m_{\tau,u}$ を一意に識別できないこと）
- Cooke, Roger M. 1991. *Experts in Uncertainty: Opinion and Subjective Probability in Science*. Oxford University Press. — 引用元: 到達見込みモデル §5.1（較正データにもとづく性能加重の集約が単純平均に勝る条件）。正本にURLの記載なし

### BZM 2.1 系列

- Hsu, Jason C., and Eduardo S. Schwartz. 2003. "A Model of R&D Valuation and the Design of Research Incentives." NBER Working Paper 10041. [原文PDF](https://www.nber.org/system/files/working_papers/w10041/w10041.pdf) — 引用元: BZM 2.1 §17、BZM 2.2 §17、進化ガイド §7
- Longstaff, Francis A., and Eduardo S. Schwartz. 2001. "Valuing American Options by Simulation: A Simple Least-Squares Approach." *Review of Financial Studies* 14(1): 113–147. [論文ページ](https://academic.oup.com/rfs/article/14/1/113/1587472) — 引用元: BZM 2.1 §17（最小二乗モンテカルロ）
- Pindyck, Robert S. 1993. "Investments of Uncertain Cost." *Journal of Financial Economics* 34(1): 53–76. [DOI](https://doi.org/10.1016/0304-405X(93)90040-I) — 引用元: BZM 2.1 §17、BZM 2.2 §17

### BZM 2.2 系列

- [Penrose, 1959, The Theory of the Growth of the Firm](https://academic.oup.com/book/25306) — 資源と、経営の下で資源が生む生産的サービスを分ける
- [Teece, Pisano and Shuen, 1997, Dynamic Capabilities and Strategic Management](https://sms.onlinelibrary.wiley.com/doi/10.1002/%28SICI%291097-0266%28199708%2918%3A7%3C509%3A%3AAID-SMJ882%3E3.0.CO%3B2-Z) — asset positions と dynamic capabilities を分ける
- [Brush, Greene and Hart, 2001, From Initial Idea to Unique Advantage: The Entrepreneurial Challenge of Constructing a Resource Base](https://journals.aom.org/doi/10.5465/AME.2001.4251394) — 新規事業の資源の六類型（必要十分性は未立証）
- [Hunt and Morgan, 1995, The Comparative Advantage Theory of Competition](https://journals.sagepub.com/doi/10.1177/002224299505900201) — 別の資源分類（普遍的な唯一分類がないことの根拠）
- [Kreps, 1979, A Representation Theorem for Preference for Flexibility](https://www.gsb.stanford.edu/faculty-research/publications/representation-theorem-preference-flexibility) — 柔軟性選好の表現
- [Aubin, 1991, Viability Theory](https://link.springer.com/book/10.1007/978-0-8176-4910-4) — viability と capture basin（戦略余力の $\mathcal K_{\mathcal T}^{-}$ の土台）
- [Nohria and Gulati, 1996, Is Slack Good or Bad for Innovation?](https://journals.aom.org/doi/10.5465/256998) — 組織slackが少なすぎても多すぎても革新を損ないうる関係
- [Sirmon, Hitt and Ireland, 2007, Managing Firm Resources in Dynamic Environments to Create Value](https://journals.aom.org/doi/10.5465/amr.2007.23466005) — 資源の保有と管理過程を分ける
- [Sarasvathy, 2001, Causation and Effectuation: Toward a Theoretical Shift from Economic Inevitability to Entrepreneurial Contingency](https://journals.aom.org/doi/10.5465/amr.2001.4378020) — 手元資源から目的と行動を形成しうること
- [Baker and Nelson, 2005, Creating Something from Nothing: Resource Construction through Entrepreneurial Bricolage](https://journals.sagepub.com/doi/10.2189/asqu.2005.50.3.329) — 起業家的ブリコラージュ
- [Ocasio, 1997, Towards an Attention-Based View of the Firm](https://sms.onlinelibrary.wiley.com/doi/10.1002/%28SICI%291097-0266%28199707%2918%3A1%2B%3C187%3A%3AAID-SMJ936%3E3.0.CO%3B2-K) — 注意の配分と構造
- [Baum, Calabrese and Silverman, 2000, Don't Go It Alone: Alliance Network Composition and Startups' Performance in Canadian Biotechnology](https://sms.onlinelibrary.wiley.com/doi/10.1002/%28SICI%291097-0266%28200003%2921%3A3%3C267%3A%3AAID-SMJ89%3E3.0.CO%3B2-8) — 提携ネットワークの構成と成果
- [Suchman, 1995, Managing Legitimacy: Strategic and Institutional Approaches](https://journals.aom.org/doi/10.5465/amr.1995.9508080331) — 正当性と資源獲得
- [Zimmerman and Zeitz, 2002, Beyond Survival: Achieving New Venture Growth by Building Legitimacy](https://journals.aom.org/doi/10.5465/amr.2002.7389921) — 同上
- [Garg, 2013, Venture Boards: Distinctive Monitoring and Implications for Firm Performance](https://journals.aom.org/doi/10.5465/amr.2010.0193) — venture board の監督
- [Kerr, 1975, On the Folly of Rewarding A, While Hoping for B](https://journals.aom.org/doi/abs/10.5465/255378) — 望む行動と報酬される指標のずれ（戦略余力を単独KPIにしない根拠）
- [Heckman, 1979, Sample Selection Bias as a Specification Error](https://www.jstor.org/stable/1912352) — 非ランダムな標本選択
- [Rubin, 1976, Inference and Missing Data](https://academic.oup.com/biomet/article-abstract/63/3/581/270932) — 欠測過程を無視できる条件
- [March, 1991, Exploration and Exploitation in Organizational Learning](https://pubsonline.informs.org/doi/10.1287/orsc.2.1.71) — 活用への過剰適応が探索を失わせうること

### 旧9軸の重みに関する出典

- Bernstein, Korteweg, and Laws. 2017. *Journal of Finance*.（創業チームの質が投資判断の最大要因であることを示した実験研究）と、内閣府 SIP の readiness 体系における HRL の位置づけ — 引用元: [計算式と律速診断](../bzm/score-and-bottleneck.md)。正本では**出典注が TODO のまま未確定**であり、URL・巻号は記載されていない

---

## 9. 変更履歴

この台帳は append-only とする。過去行を書き換えない。

| 日時 | 版 | 変更 | 根拠 | 変更者 |
|---|---|---|---|---|
| 2026-08-22 | ledger v1 | 初版。SPS と BZM の2系列について、現行版・現行の式と記号・版の系譜・2系列の関係・凍結tuple・撤回済み・参考文献を1枚へ集約した。既存の正本（`bzm/` 配下）は移動も改変もしていない | 作成指示 = [APPROVALS.md](./APPROVALS.md) #2026-08-22-1。台帳本文の内容承認はまさ未確認 | えいみ |
