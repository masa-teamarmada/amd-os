# 状態空間モデルによるマクロ推定

> **ねらい**：観測量の背後にある三本の螺旋（μ_A・μ_I・μ_G）を、状態空間モデルとして定式化します。なぜ物理メタファー（連成振動）ではなく状態空間モデルなのか、その固有値構造が Triple Helix の「螺旋」をどう数学的に正当化するのかを示します。
>
> **前提**：第 2 部 2-1 章（σ_SU と Triple Helix の概念）。線形代数・確率過程の基礎があると読みやすいですが、各式には言葉の説明を添えています。

## 1. 経緯 — 連成振動モデルから状態空間モデルへ

BZM のマクロモデルは、当初 **連成振動モデル**（質量・ばね・減衰からなる物理メタファー）として書かれていました。しかし計量経済学・進化経済学のレビューから、次のような批判が出ました。

- 結合係数は対称な相関的観測であって、因果ではない。
- ショックの共分散構造を明示すべき。
- 物理メタファーは保存則を仮定するが、経済はゼロサムではない。

これらに包括的に答えるため、モデルを **状態空間モデル（state-space model）の一般形** で再定式化します。重要なのは、**連成振動モデルは状態空間モデルの特殊ケース** であり、一般形で書けば自動的に内包される、という点です。物理的な解釈に頼らずとも、状態遷移行列の固有値分解から「振動」は自然に現れます（§5）。

## 2. 定式化

### 2.1 一般形

離散時間の状態空間モデルは、次の二本の式で書けます。実際の推定はこの離散時間表現で行います。

$$
\begin{aligned}
\mathbf{x}_{t+1} &= \mathbf{A}\,\mathbf{x}_t + \mathbf{B}\,\mathbf{u}_t + \boldsymbol{\epsilon}_t, & \boldsymbol{\epsilon}_t &\sim \mathcal{N}(\mathbf{0}, \mathbf{Q}) \\
\mathbf{y}_t &= \mathbf{C}\,\mathbf{x}_t + \mathbf{D}\,\mathbf{u}_t + \boldsymbol{\eta}_t, & \boldsymbol{\eta}_t &\sim \mathcal{N}(\mathbf{0}, \mathbf{R})
\end{aligned}
$$

上の式を **状態方程式**（隠れ状態の時間発展）、下の式を **観測方程式**（隠れ状態が観測量にどう写るか）と呼びます。

| 記号 | 意味 | BZM での解釈 |
|---|---|---|
| $\mathbf{x}_t$ | 隠れ状態 | 学・産・官のモメンタム $(\mu_A, \mu_I, \mu_G)$ |
| $\mathbf{y}_t$ | 観測量 | $P, B, V, R, I_R, N, C$ |
| $\mathbf{u}_t$ | 外生入力 | 海外政策・災害・地政学 |
| $\mathbf{A}$ | 状態遷移行列 | 内部ダイナミクス（螺旋の動き） |
| $\mathbf{B}$ | 外生 → 状態 伝達 | 外生ショックが隠れ状態に与える影響 |
| $\mathbf{C}$ | 観測モデル | 隠れ状態を観測量へ写す（2-1 章の負荷量表） |
| $\mathbf{Q}, \mathbf{R}$ | ノイズ共分散 | 内生ショック／測定誤差の構造 |

### 2.2 base case — Triple Helix（n=3）

base case では、隠れ状態を三次元に取ります。

$$\mathbf{x}_t = (\mu_A, \mu_I, \mu_G)_t^\top \in \mathbb{R}^3$$

二次元（MLP の Regime/Niche）では政策と市場の位相差が消えてしまい、「政策は来ているが市場が来ない」というティエムのような状況を表現できません。三次元の Triple Helix を採ることで、この位相差が表現可能になります。

## 3. 状態遷移行列 A の役割交差

状態遷移行列 $\mathbf{A}$（3×3）は、三本の螺旋がどう影響し合うかを記述します。

$$\mathbf{A} = \begin{pmatrix} a_{AA} & a_{AI} & a_{AG} \\ a_{IA} & a_{II} & a_{IG} \\ a_{GA} & a_{GI} & a_{GG} \end{pmatrix}$$

- **対角成分** $a_{ii}$：各螺旋の慣性（persistence）。前期の勢いがどれだけ残るか。
- **非対角成分** $a_{ij}$（$i \neq j$）：Etzkowitz の言う「役割の引き受け合い」の定量表現。たとえば $a_{IA}$（学が産を引っ張る）は産学連携の強さ、$a_{GA}$（学が官を引っ張る）は「論文先行型の政策形成」を表します。

非対角を非対称にすると、$\mathbf{A}$ に **複素固有値** が現れます。これが §5 で見る「螺旋軌道」の源です。

## 4. 識別性と推定戦略

### 4.1 識別不能性の問題

一般形のモデルは、同じデータから複数の $(\mathbf{A}, \mathbf{C})$ を導けてしまいます（任意の正則行列 $\mathbf{T}$ で座標変換しても、観測されるデータ分布が変わらない）。これを **識別不能性** と呼び、学術モデルとして書くには正則化が必要です。

### 4.2 ベイズ的アプローチ

BZM の推定では、次の二段構えで識別性を確保します。

- **Minnesota prior**（Litterman 1986）：VAR 係数に「自己ラグはほぼ単位根、交差ラグはゼロから出発」という経済理論的な縮約（shrinkage）を入れる。
- **階層 prior**（Canova & Ciccarelli 2013）：9 社のデータをプールし、レーン（materials, gx_energy, …）ごとの特性を学習することで、1 社あたりの時系列が短くても識別性を確保する。

$$
\begin{aligned}
\text{Level 1 (SU)}: \quad & \boldsymbol{\theta}_i \sim \mathcal{N}(\boldsymbol{\mu}_{\ell(i)}, \mathbf{V}_\ell) \\
\text{Level 2 (Lane)}: \quad & \boldsymbol{\mu}_\ell \sim \mathcal{N}(\boldsymbol{\mu}_0, \mathbf{V}_0) \\
\text{Level 3 (Global)}: \quad & \boldsymbol{\mu}_0 \sim \mathcal{N}(\mathbf{0}, \tau \mathbf{I})
\end{aligned}
$$

推定パイプラインの詳細（VAR(p=4) ラグ拡張、Cholesky による構造ショック識別、ジャンプ過程、Kalman smoother による隠れ状態抽出）は、本書の範囲を超えるため理論正本 `state_space_model.md` / `bvar_prior.md` に譲ります。本書では「観測量から μ を推定する仕組みがある」ことを押さえれば十分です。

## 5. 固有値分解 — なぜ「螺旋」なのか

状態空間モデルの最大の美点は、物理メタファーに頼らずに「振動」と「螺旋」を導けることです。状態遷移行列 $\mathbf{A}$ を固有値分解します。

$$\mathbf{A} = \mathbf{V}\,\mathbf{\Lambda}\,\mathbf{V}^{-1}, \qquad \mathbf{\Lambda} = \mathrm{diag}(\lambda_1, \ldots, \lambda_n)$$

固有値 $\lambda_k$ の形から、系の振る舞いがすべて読めます。

| 固有値の形 | 振る舞い |
|---|---|
| 実数 $0 < \lambda < 1$ | 単調減衰（過減衰） |
| 複素ペア $\lambda = \alpha \pm i\beta,\ |\lambda| < 1$ | 減衰振動 |
| 複素ペア $|\lambda| = 1$ | 持続振動 |
| $|\lambda| > 1$ | 発散（系が不安定） |
| $\lambda = 1$ | 単位根（非定常、累積的） |

複素固有値ペアからは、周期と減衰時定数が直接読めます。

$$T_k = \frac{2\pi}{\beta_k}, \qquad \tau_k = -\frac{1}{\alpha_k}$$

（ここでは連続時間形 $\dot{\mathbf{x}} = \mathbf{A}_c\mathbf{x}$ の固有値で書いています。§2.1 の離散遷移行列はその行列指数 $\mathbf{A} = e^{\mathbf{A}_c \Delta t}$ に対応し、固有値は $\lambda_{\text{離散}} = e^{\lambda_c \Delta t}$ で写ります。）

### 5.1 例題 2-2 — 非対称 A から螺旋が生まれることを確かめる

3 本のうち学・産の 2 軸に縮約して、慣性（対角）と役割の引き受け合い（非対角を非対称）を入れた連続時間の遷移行列を考えます（単位は四半期）。

$$\mathbf{A}_c = \begin{pmatrix} -0.1 & -0.6 \\ 0.6 & -0.1 \end{pmatrix}$$

固有値は特性方程式 $\lambda^2 - (\mathrm{tr}\,\mathbf{A}_c)\lambda + \det\mathbf{A}_c = 0$ から求めます。

$$
\begin{aligned}
\mathrm{tr}\,\mathbf{A}_c &= -0.2, \qquad \det\mathbf{A}_c = (-0.1)(-0.1) - (-0.6)(0.6) = 0.01 + 0.36 = 0.37 \\
\lambda &= \frac{-0.2 \pm \sqrt{(-0.2)^2 - 4(0.37)}}{2} = \frac{-0.2 \pm \sqrt{-1.44}}{2} = -0.1 \pm 0.6\,i
\end{aligned}
$$

複素ペア $\lambda = \alpha \pm i\beta$ で $\alpha = -0.1,\ \beta = 0.6$。ここから周期と減衰時定数を読みます。

$$T = \frac{2\pi}{\beta} = \frac{2\pi}{0.6} \approx 10.5\ \text{四半期（約 2.6 年）}, \qquad \tau = -\frac{1}{\alpha} = -\frac{1}{-0.1} = 10\ \text{四半期}$$

**読み方**：学と産は約 2.6 年周期で互いに勢いを渡し合いながら（非対角 $\pm0.6$）、約 10 四半期の時定数で均衡へ向かって減衰します。$\alpha < 0$ なので軌道は内向きに巻く **減衰螺旋** です。もし対角（慣性）が $0$ なら $\alpha = 0$ で持続振動、正なら発散します。非対角をゼロ（対称に潰す）にすると固有値は実数になり、螺旋は消えて単調減衰だけが残ります —— **螺旋は「役割の引き受け合い（非対称結合）」から生まれる** ことが、固有値計算から直接確認できます。

状態次元が 3 で複素ペアが現れると、軌道は **三次元空間で螺旋** を描きます。これがまさに Etzkowitz の "triple helix" の数学的実体です。

> **学術的主張**：Triple Helix の "helix"（螺旋）という比喩は、文学的修辞ではなく、状態空間モデルの固有モード構造によって厳密に正当化される。

## 6. マクロとミクロの二軸判定

状態空間モデルから出る $\sigma_{SU}(t)$ は **マクロ条件** だけを見ています。SU 個別の **ミクロ条件**（社内に技術を作れる人がいるか、という TRL ゲート）は別軸として持つ必要があります。立ち上げ判定は両者の AND で書けます。

$$\mathrm{GO}(t) = \mathbb{1}[\sigma_{SU}(t) \geq \theta_\sigma] \cdot g_{TRL}(t)$$

ここで $g_{TRL}(t)$ は「自社内製 TRL がゲート閾値（運用候補 4〜5）以上か」を表す指標関数です。**マクロが揃っていても、社内で技術を作れなければ GO は出ません**。

この二軸構造は、第 6 部のティエム retrofit で決定的な役割を果たします。ティエムが「早すぎた」のは σ_SU の意味で早かったのではなく、TRL ゲート未達という **別軸** の問題だった、という分離が、状態空間モデル + TRL ゲートの組み合わせで初めて構造的に説明できるのです。

## 7. まとめと次部への接続

ここまでで、マクロ環境 σ_SU を観測量から推定する枠組みが揃いました。次の第 3 部では、視点を個社に移し、ベンチャー自身の成熟度を測る **XRL 群（5 つの Readiness Level）** に進みます。

## 8. 本章のまとめ

- マクロモデルは連成振動（物理メタファー）から **状態空間モデルの一般形** へ再定式化した。連成振動はその特殊ケースで、物理的解釈に頼らず固有値分解から「振動」が自然に出る。
- 状態方程式 $\mathbf{x}_{t+1} = \mathbf{A}\mathbf{x}_t + \mathbf{B}\mathbf{u}_t + \epsilon$、観測方程式 $\mathbf{y}_t = \mathbf{C}\mathbf{x}_t + \mathbf{D}\mathbf{u}_t + \eta$。隠れ状態 $\mathbf{x}=(\mu_A,\mu_I,\mu_G)$、観測 $\mathbf{y}$ は 7 観測量、$\mathbf{C}$ は 2-1 章の負荷量表。
- base case は $n=3$（Triple Helix）。2 次元では政策と市場の位相差が消え、ティエム型の「政策は来たが市場は来ない」が表現できない。
- 識別不能性は **Minnesota prior**（Litterman 1986）＋ **階層 prior**（Canova & Ciccarelli 2013、9 社プール）で解消する。
- 遷移行列 $\mathbf{A}$ の **非対称な非対角成分**（役割の引き受け合い）が複素固有値を生み、軌道が螺旋になる。"helix" は修辞でなく固有モード構造として正当化される。
- σ_SU はマクロのみ。立ち上げ判定は TRL ゲートとの AND：$\mathrm{GO} = \mathbb{1}[\sigma_{SU}\ge\theta_\sigma]\cdot g_{TRL}$。

## 9. 練習問題

1. **固有値と螺旋**：$\mathbf{A}_c = \begin{pmatrix} 0 & -0.4 \\ 0.4 & 0 \end{pmatrix}$ の固有値を求め、周期 $T$ を計算せよ。対角（慣性）がゼロのとき軌道が「持続振動」になることを確かめよ。<br>（答え：$\lambda = \pm 0.4i$、$T = 2\pi/0.4 \approx 15.7$ 四半期、$\alpha=0$ で減衰しない）
2. **対称化で螺旋が消える**：例題 2-2 の非対角を対称 $\begin{pmatrix} -0.1 & 0.6 \\ 0.6 & -0.1 \end{pmatrix}$ に変えると固有値はどうなるか。実数になり螺旋が消えることを示せ。
3. **次元の必要性**：なぜ 2 次元（Regime/Niche）では Triple Helix の位相差を表現できないのか。ティエムの「政策先行・市場遅行」を例に説明せよ。
4. **二軸判定**：σ_SU が GO 閾値を超えていても $g_{TRL}=0$ なら立ち上げ GO が出ない。これがティエム 2012 の「早すぎた」をどう構造的に説明するか、第 6 部の retrofit と結びつけて述べよ。

---

### 出典

- Litterman, R. B. (1986). "Forecasting with Bayesian vector autoregressions—five years of experience." *Journal of Business & Economic Statistics*, 4(1), 25–38.
- Canova, F., & Ciccarelli, M. (2013). "Panel Vector Autoregressive Models: A Survey." *Advances in Econometrics*, 32.
- Stock, J. H., & Watson, M. W. (2002). "Forecasting using principal components from a large number of predictors." *Journal of the American Statistical Association*, 97(460), 1167–1179.
- Sims, C. A. (1980). "Macroeconomics and reality." *Econometrica*, 48(1), 1–48.
