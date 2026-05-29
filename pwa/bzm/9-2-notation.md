# 記号一覧

> **ねらい**：本書全体で使う数学記号を、登場順（マクロ → 個体 → 苗床）に整理します。各記号の意味・値域・初出の部を一覧にします。本書の数式は KaTeX で表示しています。

## 1. マクロ環境（σ_SU・Triple Helix）— 第 2 部

| 記号 | 読み / 名前 | 意味 | 値域 | 初出 |
|---|---|---|---|---|
| $\sigma_{SU}$ | シグマ SU | マクロ追い風スコア（Triple Helix 合成） | $0\!-\!9$ | 2-1 |
| $\mu_A$ | ミュー A | Academia momentum（学の勢い） | $0\!-\!9$ | 2-1 |
| $\mu_I$ | ミュー I | Industry momentum（産の勢い） | $0\!-\!9$ | 2-1 |
| $\mu_G$ | ミュー G | Government momentum（官の勢い） | $0\!-\!9$ | 2-1 |
| $y_p,\ \tilde{y}_p$ | 観測量 / 正規化観測量 | $p$ 番目の観測量と、その 16 四半期レンジ 0–9 正規化値 | $\tilde{y}\in[0,9]$ | 2-1 |
| $c_{xp}$ | C 行列負荷量 | 観測量 $p$ がモメンタム $x$ に与える loading | $0\!-\!1$ | 2-1 |
| $P,B,V,R,I_R,N,C$ | 観測量 7 種 | 政策密度／公募予算／VC 投資／言及・PR／研究費／論文／競合密度 | — | 2-1 |
| $\mathbf{x}_t$ | 状態ベクトル | 隠れ状態 $(\mu_A,\mu_I,\mu_G)^\top$ | $\in\mathbb{R}^3$ | 2-2 |
| $\mathbf{y}_t$ | 観測ベクトル | 7 観測量 | — | 2-2 |
| $\mathbf{u}_t$ | 外生入力 | 海外政策・災害・地政学ショック | — | 2-2 |
| $\mathbf{A}$ | 状態遷移行列 | 三螺旋の内部ダイナミクス（非対称非対角が螺旋を生む） | — | 2-2 |
| $\mathbf{B},\mathbf{C},\mathbf{D}$ | 伝達 / 観測 / 直達行列 | 外生→状態、状態→観測、外生→観測の写像 | — | 2-2 |
| $\mathbf{Q},\mathbf{R}$ | ノイズ共分散 | 内生ショック／測定誤差の共分散 | — | 2-2 |
| $\lambda_k=\alpha\pm i\beta$ | 固有値 | $\mathbf{A}$ の固有値（複素ペアで減衰螺旋） | — | 2-2 |
| $T_k=2\pi/\beta_k$ | 周期 | 固有モードの振動周期 | — | 2-2 |
| $\tau_k=-1/\alpha_k$ | 減衰時定数 | 固有モードが均衡へ向かう時定数 | — | 2-2 |
| $\theta_\sigma$ | σ ゲート閾値 | 立ち上げ判定のマクロ側閾値 | — | 2-2 |
| $g_{TRL}(t)$ | TRL ゲート関数 | 自社内製 TRL がゲート閾値以上かの指標関数 | $\{0,1\}$ | 2-2 |

**主要な式**

$$\sigma_{SU} = \bigl((\mu_A+1)(\mu_I+1)(\mu_G+1)\bigr)^{1/3} - 1 \qquad \mu_x = \frac{\sum_p c_{xp}\,\tilde{y}_p}{\sum_p c_{xp}}$$

$$\mathbf{x}_{t+1}=\mathbf{A}\mathbf{x}_t+\mathbf{B}\mathbf{u}_t+\boldsymbol\epsilon_t,\quad \mathbf{y}_t=\mathbf{C}\mathbf{x}_t+\mathbf{D}\mathbf{u}_t+\boldsymbol\eta_t \qquad \mathrm{GO}(t)=\mathbb{1}[\sigma_{SU}(t)\ge\theta_\sigma]\cdot g_{TRL}(t)$$

## 2. 個体レイヤー（XRL・FRL・AMD Score）— 第 3〜5 部

| 記号 | 読み / 名前 | 意味 | 値域 | 初出 |
|---|---|---|---|---|
| TRL | Technology Readiness Level | 技術成熟度 | $0\!-\!9$ | 3-1 |
| BRL | Business Readiness Level | 事業モデル成熟度 | $0\!-\!9$ | 3-1 |
| GRL | Governance Readiness Level | 規制・ガバナンス成熟度 | $0\!-\!9$ | 3-1 |
| SRL | Social Readiness Level | 社会受容成熟度 | $0\!-\!9$ | 3-1 |
| HRL | Human Resources Readiness Level | 人材・組織成熟度 | $0\!-\!9$ | 3-1 |
| FRL | Founder Readiness Level | 創業者リーダーシップ | $0\!-\!9$ | 4-1 |
| ALQ | Authentic Leadership Questionnaire | FRL の 4 次元 self-report 尺度 | 各 $0\!-\!9$ | 4-1 |
| Grit | グリット | 長期目標への粘り（Duckworth 2007） | $0\!-\!9$ | 4-1 |
| Resilience | レジリエンス | 失敗からの回復力（Markman 2005） | $0\!-\!9$ | 4-1 |
| $S$ | AMD Score | 7 軸統合スコア（個体の総合成熟度） | $\approx 0\!-\!100{,}000$ | 5-1 |
| $X_i$ | 軸の生値 | 各軸の評価値 | $0\!-\!9$ | 5-1 |
| $\widetilde{X}_i=X_i+1$ | シフト後の値 | ゼロ落ち防止の +1 シフト | $1\!-\!10$ | 5-1 |
| $\alpha_i,\ \alpha_X$ | 弾力性（重み） | 軸 $X$ の相対重要度。base case $\sum\alpha=6.0$ | $>0$ | 5-1 |
| $K$ | スケール校正定数 | $K=100{,}000/10^{\sum\alpha}$。base case $K=0.1$ | $>0$ | 5-1 |
| $M,\ X,\ F$ | UI 3 大要素 | Macro / XRL 積 / Founder の表示用分解 | — | 5-1 |
| $k$ | 3 要素式の定数 | $S=k\cdot M\cdot X\cdot F$ の定数（$K$ と同義） | $>0$ | 5-1 |
| $\partial S/\partial X_i$ | 限界感度 | 軸 $X_i$ を上げたときのスコア増分 | — | 5-1 |
| $\mathrm{bottleneck}(t)$ | 律速軸 | 次に手当てすべき軸 | — | 5-1 |

**主要な式**

$$S = K\cdot\!\!\prod_{X\in\{\sigma_{SU},TRL,BRL,GRL,SRL,HRL,FRL\}}\!\!(X_i+1)^{\alpha_X} \qquad K=\frac{100{,}000}{10^{\sum\alpha_i}}$$

$$S=k\cdot M\cdot X\cdot F,\quad M=(\sigma_{SU}+1)^{\alpha_\sigma},\ X=\!\!\prod_{x\in\{TRL,BRL,GRL,SRL,HRL\}}\!\!(x+1)^{\alpha_x},\ F=(FRL+1)^{\alpha_F}$$

$$\frac{\partial S}{\partial X_i}=\frac{\alpha_i\cdot S}{X_i+1} \qquad \mathrm{bottleneck}(t)=\arg\max_i\frac{\alpha_i}{X_i(t)+1} \qquad FRL=0.6\cdot\mathrm{ALQ}_{avg}+0.2\cdot\mathrm{Grit}+0.2\cdot\mathrm{Resilience}$$

**base case の重み**：$\alpha_{FRL}=1.5,\ \alpha_{\sigma}=1.3,\ \alpha_{HRL}=1.1,\ \alpha_{TRL}=1.0,\ \alpha_{BRL}=0.6,\ \alpha_{GRL}=0.3,\ \alpha_{SRL}=0.2$（合計 $6.0$）。

## 3. 苗床レイヤー（ERS）— 第 7 部

| 記号 | 読み / 名前 | 意味 | 値域 | 初出 |
|---|---|---|---|---|
| ERS | Ecosystem Readiness Score | 研究機関の整備度（充足率） | $0\!-\!100\%$ | 7-1 |
| $\mathrm{lv}$ | 到達レベル | サブ軸の rubric 到達段階 | $\{1,2,3,4,5\}$ | 7-1 |
| $s$ | サブ軸スコア | $s=(\mathrm{lv}-1)/4$ で 0–1 正規化 | $\{0,.25,.5,.75,1\}$ | 7-1 |
| $A_k$ | 軸スコア | 軸 $k$ のサブ軸 $s$ の平均 | $0\!-\!1$ | 7-1 |
| $w_k$ | 軸重み | 軸 $k$ の重み。当面 $1/8$ の等加重 | $\sum_k w_k=1$ | 7-1 |

**主要な式**

$$s=\frac{\mathrm{lv}-1}{4} \qquad A_k=\mathrm{mean}(\text{軸 }k\text{ のサブ軸 }s) \qquad \mathrm{ERS}=100\cdot\sum_k w_k\cdot A_k$$

---

> 表記の約束：軸の値は本書を通じて $0\!-\!9$（ERS のサブ軸のみ Lv $1\!-\!5$）に統一しています。`+1` シフトはマクロ（σ_SU）と個体（AMD Score）の両方で「ゼロを掛けて全体を消さない」中性化操作として共通に使われます。
