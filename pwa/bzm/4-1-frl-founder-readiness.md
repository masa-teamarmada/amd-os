# FRL — 創業者リーダーシップを独立軸にする

> **ねらい**：なぜ CEO の質を HRL から切り出して独立軸 FRL とするのか、その動機と学術的根拠を示し、FRL を構成する 6 因子（ALQ 4 次元 + Grit + Resilience）と計算式を定義します。
>
> **前提**：第 3 部（XRL 群、特に HRL との切り分け）。

## 1. 動機 — なぜ HRL では足りないのか

内閣府 SIP の HRL は「人材育成・組織体制」を扱いますが、**特定個人（CEO）のリーダーシップ・人間性** は扱いません。しかしディープテック・スタートアップでは、CEO の質が事業成果を決定的に左右します。代表のまさは、実務観察を次のように言語化しています。

> CEO のリーダーシップとか人間性、オーセンティシティとかも事業を大きく左右する。

そこで BZM は、HRL とは異なる挙動を示す独立変数として **FRL（Founder Readiness Level）** を追加します。

FRL には **間接効果** もあります。魅力的な CEO は、技術・人材・資金といった他軸を能動的に引き上げられるのです。これは Hsu（2007）の Founder Network 効果と一致します。「CEO が魅力的なら競合シーズも取り込める」というまさの直感は、ここに学術的な裏付けを持ちます。

## 2. 学術的正当化

FRL を独立軸とする根拠は、複数の研究系譜に支えられています。

### 2.1 Authentic Leadership Theory（オーセンティシティ）

- **Avolio & Gardner (2005)**：オーセンティック・リーダーシップを「ポジティブなリーダーシップの根」として理論化。
- **Walumbwa et al. (2008)**：**ALQ（Authentic Leadership Questionnaire）16 項目 × 4 次元** という標準測定ツールを開発・検証。FRL の評価に直接利用できます。

### 2.2 Founder Quality と Venture 成果

- **Bernstein, Korteweg & Laws (2017, JF)**：AngelList での無作為化フィールド実験により、**ファウンダーチームのクオリティが投資意思決定の最大要因** であることを実証。これが第 5 部で FRL の重みを最大に置く実証根拠です。
- **Hsu (2007, RP)**：起業家経験と VC 資金調達確率の関係を分析し、**Founder の質が他軸（技術・人材・資金）の調達能力に直接影響** することを実証。FRL の間接効果の根拠です。

### 2.3 Grit と Resilience

- **Duckworth et al. (2007, JPSP)**：Grit を「長期目標への情熱と粘り強さ」として定義・測定。
- **Markman, Baron & Balkin (2005, JOB)**：起業家の perseverance と venture 成果の関連を分析。

## 3. FRL の構成 — 6 因子

FRL の段階定義（0〜9）は、CEO 候補が定まっていない（0）から、社会的影響力を持つ（9）までを記述します。その中身を、次の 6 因子で操作化します。

### 3.1 ALQ 4 次元（オーセンティシティ）

| 次元 | 内容 |
|---|---|
| 自己認識（Self-awareness） | 自分の強み・弱み・価値観の理解 |
| 関係透明性（Relational transparency） | 本音と建前の一致、誠実性 |
| 均衡的処理（Balanced processing） | 反対意見を含む情報の客観評価 |
| 内在化された道徳観（Internalized moral perspective） | 倫理基準への一貫性 |

まさの実務観察「ルフィみたいな、明確に『あ、この人いまこう考えてるな』って分かる性質。裏表がないともいう」は、この ALQ の関係透明性・自己認識・内在化された道徳観の合成として測れます。**オーセンティシティに追加軸は不要** で、ALQ 4 次元でカバーできます。

### 3.2 Grit（脇目も振らない集中力）

> 脇目も振らずに事業化のために邁進できる集中力。（まさ）

ALQ には Grit 因子が含まれません。Duckworth の理論で、**数年スパンで脇目を振らない態度** を別軸として扱います。

### 3.3 Resilience（失敗・拒絶からの回復力）

> VC 50 社に断られてめげているようでは事業化なんて到底できっこない。（まさ）

これも ALQ には含まれない別軸です。失敗・拒絶からの回復、タフさを Resilience 理論で扱います。

## 4. FRL の計算式

6 因子を、次の重みで合成します。

$$\mathrm{FRL} = 0.6 \cdot \overline{\mathrm{ALQ}_4} + 0.2 \cdot \mathrm{Grit} + 0.2 \cdot \mathrm{Resilience}$$

- $\overline{\mathrm{ALQ}_4}$：ALQ 4 次元の単純平均（各 0〜9）
- $\mathrm{Grit}$：0〜9（Duckworth 2007 ベース）
- $\mathrm{Resilience}$：0〜9（Markman 2005 ベース）

重み（0.6 / 0.2 / 0.2）は、「人格の根っこに authenticity があり、その上で集中力と打たれ強さが事業化を支える」という構造をモデル化したものです。値は仮置きであり、9 PJ retrofit でキャリブレーションする予定です。

## 5. 運用上の妥協と限界

ALQ は自己申告（self-report）であり、self-bias を含みます。学術的に厳密を期すなら、本来は次も必要です。

- 外部評価データ（投資家・顧客・取締役・チームからの 360° フィードバック）
- 過去の起業経験・調達実績・M&A/IPO 実績
- 危機対応・ピボット時の意思決定スピード（静的 ALQ では取れない動的観測）

実用上は ALQ + 自由備考で「主成分」をカバーできるため、現状仕様で運用しつつ、不足項目は備考欄で補います。学術論文化する際には、360° 評価とアウトカム指標（調達額・ピボット成功率）との相関分析を追加する方針です。

## 6. まとめと次部への接続

これで BZM の 7 軸（σ_SU + 5 XRL + FRL）がすべて出揃いました。次の第 5 部では、これら 7 軸を **一つの数値（AMD Score）** に統合します。なぜ単純な平均ではなく Cobb-Douglas を使うのか、軸ごとの重みをどう決めるのか、そして「次に手当てすべき律速軸」をどう導くのかを説明します。

---

### 出典

- Avolio, B. J., & Gardner, W. L. (2005). "Authentic leadership development." *The Leadership Quarterly*, 16(3), 315–338.
- Walumbwa, F. O., et al. (2008). "Authentic leadership: Development and validation of a theory-based measure." *Journal of Management*, 34(1), 89–126.
- Bernstein, S., Korteweg, A., & Laws, K. (2017). "Attracting early-stage investors." *The Journal of Finance*, 72(2), 509–538.
- Hsu, D. H. (2007). "Experienced entrepreneurial founders, organizational capital, and venture capital funding." *Research Policy*, 36(5), 722–741.
- Duckworth, A. L., et al. (2007). "Grit: Perseverance and passion for long-term goals." *Journal of Personality and Social Psychology*, 92(6), 1087–1101.
- Markman, G. D., Baron, R. A., & Balkin, D. B. (2005). *Journal of Organizational Behavior*, 26(1), 1–19.
