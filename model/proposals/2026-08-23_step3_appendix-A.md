# 付録A — 要件1 変換能力・2 戦略余力・3 自走力（手順3 既存理論の対応表）

> **状態**: `proposal / 未承認`（2026-08-23）。本文は [手順3 — 巨人の肩](/model/2026-08-23_step3_giants-shoulders)。
> モデルの定義・式・変数は変えない。出典はすべて WebSearch で実在と書誌を確認し URL を付けた。確認できなかったものは末尾の「未確認」に名前だけ残す。

---

# 手順3 group A — 要件1「変換能力」／要件2「戦略余力」／要件3「自走力」

作成 2026-08-23。担当 group A。
この文書は候補の提示であり、まさの合意を経ていない。モデルページ（正本）へは何も書き込んでいない。

**表記の規律**

- 「事実」＝出典の論文・書籍に書いてあること
- 「推奨」＝えいみの判断
- 「未確認」＝実在または書誌を確認できなかったもの（末尾にまとめる）
- 出典の URL は WebSearch で実在を確認したもののみ載せた。確認できなかったものは本文で使わず末尾へ回した
- 数式は既存文献にあるものだけを引き、新しい式は作っていない

**前提として読んだもの**

- `/Users/masa/projects/AMD/amd-os/model/MODEL_VERSION_LEDGER.md`（目的3件・要件12件）
- `/Users/masa/projects/AMD/amd-os/bzm/sps-current-domain-definition.md` §1〜§9
- `/Users/masa/projects/AMD/amd-os/bzm/book-a-backmatter.md` §読書案内
- `/Users/masa/projects/AMD/amd-os/bzm/bzm-2-2-strategic-slack-and-propulsion.md` §17（一次文献表と参考文献）
- `/Users/masa/projects/AMD/amd-os/bzm/book-a-ch-6.md`（第5章 生存の静学）、`book-a-ch-8.md`（第7章 生存の動学）

**Before Zero の条件（三要件に共通して効く制約）**

領域定義 §2〜§4 より。観測は「研究成果の公表から法人化まで」で行い、予測は資本自立 $G_{\mathrm{self}}(12\mathrm{m})$ まで届く。
つまり観測時点では、会社が無い／売上が無い／担い手が未定／技術を事業に使う権利が大学にある。
既存の経営学・ファイナンスの理論はほぼ例外なく「会社があり、財務諸表があり、経営者が決まっている」ことを前提に作られているので、
以下ではその前提が外れたときに何が使えなくなるかを、候補ごとに明記する。

---

## 要件1 変換能力

### 1-1. 要件の意味（モデルページの文言）

> **変換能力** — 技術と資本金を戦略余力に変える能力
> 根拠: まさ 2026-08-22「それらをいかに効率よく戦略余力に変換していくか、その変換能力が高ければSPSが高くなるべき」

要件の構造は「入力（技術・資本金）→ 変換 → 出力（戦略余力）」であり、変換の**効率**が高いほどスコアが上がるべき、という量的な関係を含む。
入力の質の判定でも、出力の残高でもなく、その間にある写像そのものを扱えという要件である。

### 1-2. 既存理論の候補

#### 候補 1-A. 資源と生産的サービスの分離（Penrose 1959）

- **出典**: Penrose, E. T. (1959) *The Theory of the Growth of the Firm*. Oxford University Press（初版 Blackwell, Oxford）。
  <https://global.oup.com/academic/product/the-theory-of-the-growth-of-the-firm-9780199573844>
- **何を与えるか**（事実）: 資源そのものは投入ではなく、資源が経営の下で生む**生産的サービス（productive services）**が投入である、という区別。
  同じ資源を持っていても、経営陣が違えば取り出せるサービスは違う。企業成長の限界は外部市場ではなく、内部の経営資源が生むサービスの供給速度で決まる。
  式は無い。定性的な概念区分である。
- **Before Zero に当てはめると足りないこと**: この区別は BZM 2.2 が既に採用しており（§17 の一次文献表「資源在庫 $\mathbf{r}$ と変換能力 $\mathbf{c}$ を状態として分離する」）、
  まさの言う「変換能力」の概念的な原型はここにある。ただし Penrose の主語は**既に存在し成長している企業**であり、
  経営陣が決まっていない段階の「誰の下でのサービスか」には答えない。測定手続きも無い。

#### 候補 1-B. 動的能力（dynamic capabilities）（Teece, Pisano & Shuen 1997 / Teece 2007）

- **出典**:
  - Teece, D. J., Pisano, G. & Shuen, A. (1997) "Dynamic Capabilities and Strategic Management", *Strategic Management Journal* 18(7): 509–533.
    DOI: 10.1002/(SICI)1097-0266(199708)18:7<509::AID-SMJ882>3.0.CO;2-Z
    <https://sms.onlinelibrary.wiley.com/doi/abs/10.1002/%28SICI%291097-0266%28199708%2918%3A7%3C509%3A%3AAID-SMJ882%3E3.0.CO%3B2-Z>
  - Teece, D. J. (2007) "Explicating dynamic capabilities: the nature and microfoundations of (sustainable) enterprise performance",
    *Strategic Management Journal* 28(13): 1319–1350. DOI: 10.1002/smj.640
    <https://sms.onlinelibrary.wiley.com/doi/10.1002/smj.640>
- **何を与えるか**（事実）:
  - 1997 論文は、企業の競争力を **position（保有する資産の位置）／paths（経路依存）／processes（組織のやり方）** の三つに分け、
    そのうえで、内外の技能・資源・機能的能力を**統合し、構築し、再構成する**能力を dynamic capabilities と定義した。
    すなわち「持っているもの」と「持ちかえる力」を明示的に分ける。
  - 2007 論文はその能力を **sensing（機会の感知）／seizing（機会の捕捉）／reconfiguring（再構成）** の三機能へ分解し、
    それぞれを支える具体的な仕組み（意思決定ルール、組織構造、手続き、規律）を microfoundations として列挙した。
  - どちらも式は与えない。測定尺度も与えない。
- **Before Zero に当てはめると足りないこと**:
  - 「変換能力を機能へ分解してよい」という許可と語彙は取れるが、**分解の単位が企業組織**である。会社が無い段階では、
    sensing / seizing / reconfiguring を誰が担っているのかが定まらない（要件9「担い手」と直結する）。
  - 成果が良かった企業に事後的に「動的能力があった」と言う循環論（トートロジー批判）が付いて回る。
    Before Zero では帰結（資本自立）が数年先なので、そのまま持ち込むと判定時点で何も言えない。
  - 資本金という入力を扱わない。動的能力論は資金を能力の入力として明示的にモデル化していない。

#### 候補 1-C. 吸収能力（absorptive capacity）（Cohen & Levinthal 1990 / Zahra & George 2002 / 批判 Lane, Koka & Pathak 2006）

- **出典**:
  - Cohen, W. M. & Levinthal, D. A. (1990) "Absorptive Capacity: A New Perspective on Learning and Innovation",
    *Administrative Science Quarterly* 35(1): 128–152. DOI: 10.2307/2393553
    <https://openurl.ebsco.com/contentitem/doi:10.2307/2393553>
  - Zahra, S. A. & George, G. (2002) "Absorptive Capacity: A Review, Reconceptualization, and Extension",
    *Academy of Management Review* 27(2): 185–203. DOI: 10.5465/amr.2002.6587995
    <https://journals.aom.org/doi/10.5465/amr.2002.6587995>
  - Lane, P. J., Koka, B. R. & Pathak, S. (2006) "The Reification of Absorptive Capacity: A Critical Review and Rejuvenation of the Construct",
    *Academy of Management Review* 31(4): 833–863. DOI: 10.5465/amr.2006.22527456
    <https://journals.aom.org/doi/10.5465/amr.2006.22527456>
- **何を与えるか**（事実）:
  - Cohen & Levinthal は吸収能力を「外部の新しい情報の価値を認識し、同化し、**商業目的へ適用する**能力」と定義した。
    その能力は既存の関連知識の蓄積に依存し、経路依存で累積する（前に学んでいないと次が学べない）。
    実証では **R&D 集約度（研究開発費 ÷ 売上高）**を代理変数として使った。
  - Zahra & George は吸収能力を二層に分けた。**潜在的吸収能力**（獲得 acquisition ＋ 同化 assimilation）と
    **実現された吸収能力**（変換 transformation ＋ 活用 exploitation）である。
    両者の比を効率係数 $\eta$ として置く（$\eta = \mathrm{RACAP}/\mathrm{PACAP}$、記号の意味は RACAP＝実現された吸収能力、PACAP＝潜在的吸収能力）。
    **持っているのに使えていない量**を、比として明示的に扱える枠がここにある。
  - Lane らは 14 誌 289 本を分析し、この構成概念が「R&D 支出という代理変数そのもの」へ物象化（reification）していると批判した。
- **Before Zero に当てはめると足りないこと**:
  - 代理変数の分母が売上高である。**Before Zero には売上が無いので、標準的な測定手続きがそのままでは計算できない。**
  - 「外部知識の取り込み」の能力であって、「資本金を余力へ変える」ことは扱わない。要件1の入力の片方（資本金）が落ちる。
  - 二層構造（潜在／実現）と効率係数の発想だけは、入力を持っていることと余力へ変わっていることの差を扱う枠として流用できる。
    ただし Lane らの批判どおり、代理変数を安易に置くと同じ穴に落ちる。

#### 候補 1-D. 資源オーケストレーション（Sirmon, Hitt & Ireland 2007 / Sirmon, Hitt, Ireland & Gilbert 2011）

- **出典**:
  - Sirmon, D. G., Hitt, M. A. & Ireland, R. D. (2007) "Managing Firm Resources in Dynamic Environments to Create Value: Looking Inside the Black Box",
    *Academy of Management Review* 32(1): 273–292. <https://journals.aom.org/doi/10.5465/amr.2007.23466005>
  - Sirmon, D. G., Hitt, M. A., Ireland, R. D. & Gilbert, B. A. (2011) "Resource Orchestration to Create Competitive Advantage: Breadth, Depth, and Life Cycle Effects",
    *Journal of Management* 37(5): 1390–1412. DOI: 10.1177/0149206310385695
    <https://journals.sagepub.com/doi/abs/10.1177/0149206310385695>
- **何を与えるか**（事実）: 資源の**保有**と、資源を価値へ変える**管理過程**を分け、過程を三段に分解する。
  structuring（取得・蓄積・処分）→ bundling（安定化・拡充・開拓）→ leveraging（動員・調整・展開）。
  さらに 2011 論文は、この過程が企業のライフサイクル段階によって効き方が変わることを整理した。
  式は無い。過程の分類である。
- **Before Zero に当てはめると足りないこと**: BZM 2.2 が既に「PJ 行動と共有資源の実行契約へ落とす」として採用している。
  変換能力を**行動の系列**として書き下ろす語彙としては使える。ただし経営者が既に存在する企業の過程論であり、
  三段の各段を Before Zero の観測可能なイベント（共同研究契約、出願、試作、有償検証など）へ写像する部分は与えない。

#### 候補 1-E. 大学発スピンアウトの局面と臨界点（Vohora, Wright & Lockett 2004）

- **出典**: Vohora, A., Wright, M. & Lockett, A. (2004) "Critical junctures in the development of university high-tech spinout companies",
  *Research Policy* 33(1): 147–175. DOI: 10.1016/S0048-7333(03)00107-0
  <https://www.sciencedirect.com/science/article/abs/pii/S0048733303001070>
- **何を与えるか**（事実）: 大学発ハイテクスピンアウトが通る**五つの局面**（research → opportunity framing → pre-organization →
  re-orientation → sustainable returns）と、局面のあいだにある**四つの臨界点（critical junctures）**を、
  英国のケース研究から帰納的に取り出した。各臨界点で不足する資源・能力を獲得できなければ、次の局面へ進めない。
  **pre-organization 局面が、そのまま Before Zero に対応する。**
- **Before Zero に当てはめると足りないこと**: 局面の順序と、局面間に関門があることは与えるが、
  **量も確率も無い**。ケース研究であり、臨界点を越える確率や、越えるのに要る資源量を与えない。
  権利が大学にあることは前提として扱われている（この点は Before Zero と整合する数少ない文献）。

#### 候補 1-F.（補助）知識変換 SECI（Nonaka 1994）

- **出典**: Nonaka, I. (1994) "A Dynamic Theory of Organizational Knowledge Creation", *Organization Science* 5(1): 14–37.
  DOI: 10.1287/orsc.5.1.14 <https://pubsonline.informs.org/doi/10.1287/orsc.5.1.14>
- **何を与えるか**（事実）: 暗黙知と形式知の相互変換の四モード（共同化・表出化・連結化・内面化）と、その螺旋。
  研究室に溜まった言語化されていない技能が、他者へ渡せる形になる過程の語彙。
- **Before Zero に当てはめると足りないこと**: 変換の量も速度も測らない。余力という概念を持たない。
  第7章 7.4 が挙げる moat の成分「論文になっていない実験ノウハウ」の説明語としては使えるが、要件1の土台にはならない。

### 1-3. 総括（推奨）

**推奨**: 要件1の土台は **Penrose(1959) の「資源／生産的サービス」の分離を一階に、Teece ら(1997, 2007) の動的能力を二階に、
Vohora ら(2004) を Before Zero 固有の局面（pre-organization）を与える三階に置く**、という三層で組むのがよい。

理由。まさの要件は「入力を余力へ変える写像」であり、これは Penrose の「資源とサービスは別物」という区別そのものである。
BZM 2.2 が既にこの分離を状態設計へ採用している以上、土台をここに置けば教科書と正本の位置づけが矛盾しない。
そのうえで、変換能力を一つの塊にせず機能へ分解する許可と語彙は Teece(2007) の sensing / seizing / reconfiguring から取る
（要件9「担い手＝CEO 機能の分解」と接続できるのはこの層である）。
Vohora らは、会社が無い局面を明示的に扱っている数少ない実証であり、
「Before Zero の理論だから既存理論が無い」という主張を避けるための足場になる。
資源オーケストレーション（1-D）は変換を行動系列へ落とす段で使い、土台には置かない。
吸収能力（1-C）は、入力のうち**外部知識の取り込みに関わる部分だけ**に限定して使う。
Lane らの批判があるので、R&D 集約度型の代理変数は採らない。

**手順4で作るもの（既存理論に無い部分）**

1. 変換能力を**量**として定義すること。既存文献はどれも「能力がある／ない」の定性か、事後の成果からの逆算である。
   入力（技術の到達度・資本金の額）から出力（戦略余力の月数）への写像として、判定時点で測れる形は無い。
2. 売上ゼロ・財務諸表なしで測る手続き。吸収能力の標準代理変数（R&D 費 ÷ 売上）は Before Zero で定義できない。
3. 「誰の変換能力か」の帰属。担い手未定の段階で、大学・研究者・支援者（AMD）・将来の経営チームのどこに能力を帰属させるかは、
   どの文献も答えていない。要件9との接続点。

---

## 要件2 戦略余力

### 2-1. 要件の意味（モデルページの文言）

> **戦略余力** — 次の行動を起こすための燃料。金だけではない。減ってゼロと交差したら清算するしかない
> 根拠: まさ 2026-08-22「変換能力に次いで重要なのが戦略余力で、それ自体が高ければさらに加点されるべき」

同じページの「採らない主張」に、**戦略余力の逆U字（多すぎてもよくない）は採らない**と明記されている。
候補の位置づけは、この決定と矛盾しないように書く必要がある。

教科書側の既存定義も確認した。第7章 7.4 は $y$ を「主導権を保ったまま走れる残り月数」と置き、
現金・runway／moat／信用／選択肢（BATNA）／チームの実行力と集中力の五成分を**月へ換算して足す**。
BZM 2.2 §7 はこれを更新し、戦略余力を「目標到達経路の壊れにくさ」＝頑健捕捉領域からの退出時刻 $T_Y$ として定義し直している。

### 2-2. 既存理論の候補

#### 候補 2-A. 組織スラック（Cyert & March 1963 / Bourgeois 1981 / Nohria & Gulati 1996 / George 2005 / Mount ら 2024）

- **出典**:
  - Cyert, R. M. & March, J. G. (1963) *A Behavioral Theory of the Firm*. Prentice-Hall.
    （教科書巻末 §読書案内・BZM 2.2 §17 に既出。出版社の恒久ページは確認できなかったため末尾「未確認」参照）
  - Bourgeois, L. J. (1981) "On the Measurement of Organizational Slack", *Academy of Management Review* 6(1): 29–39.
    DOI: 10.5465/amr.1981.4287985 <https://journals.aom.org/doi/abs/10.5465/amr.1981.4287985>
  - Nohria, N. & Gulati, R. (1996) "Is Slack Good or Bad for Innovation?", *Academy of Management Journal* 39(5): 1245–1264.
    DOI: 10.2307/256998 <https://journals.aom.org/doi/abs/10.5465/256998>
  - George, G. (2005) "Slack Resources and the Performance of Privately Held Firms", *Academy of Management Journal* 48(4): 661–676.
    DOI: 10.5465/amj.2005.17843944 <https://journals.aom.org/doi/10.5465/amj.2005.17843944>
  - Mount, M., Ertug, G., Kavusan, K., George, G. & Zou, T. (2024) "Reeling in the Slack: An Integrative Review to Reinstate Slack as a
    Central Theoretical Construct for Management Research", *Academy of Management Annals* 18(2): 473–505.
    DOI: 10.5465/annals.2023.0087 <https://journals.aom.org/doi/10.5465/annals.2023.0087>
- **何を与えるか**（事実）:
  - Cyert & March はスラックを「組織を維持するのに必要な額を超えて、連合のメンバーへ支払われている分」と定義し、
    環境変動を吸収する緩衝材として位置づけた。
  - Bourgeois は「スラックは語られるが測られていない」と指摘し、**二次データ（財務諸表）から作れる操作的な測定**を提示した。
    要件2にとって重要なのは結論よりも、**余力を測るという問題設定を最初に主題化した論文である**という点である。
  - Nohria & Gulati は、二つの多国籍企業に属する 264 の機能部門のデータで、スラックと革新のあいだに逆U字の関係を報告した。
  - George は非公開企業 900 社の縦断データで、スラックを裁量度の高いもの・低いものに分け、
    公開企業で観察される関係が非公開企業ではそのまま成り立たないことを示した。
  - Mount らは 229 本のレビューから、スラックを **availability（すぐ使えるか）** と **fungibility（別の用途へ転用できるか）**
    という二次元で整理し直した。**「金だけではない」余力を、既存理論の枠内で二軸へ展開できる。**
- **Before Zero に当てはめると足りないこと**:
  - この系譜の測定はすべて**貸借対照表と損益計算書を前提**にしている。会社が無い Before Zero では一行も埋まらない。
  - moat・信用・選択肢・注意といった非財務の余力を、この系譜は成分として持たない（教科書 7.1 が既に指摘している）。
  - 月という共通単位への換算則は無い。
  - Nohria & Gulati の逆U字は、モデルページが「採らない主張」として明示的に棄却した内容である。
    BZM 2.2 §17 も「実証対象は二つの多国籍企業の 264 機能部門であり、ディープテック SU に普遍的な最適余力量を示したものではない」と注記済み。
    **推奨**: 引用はするが、実証範囲を明記したうえで Before Zero へ外挿しない、という位置づけを維持する。

#### 候補 2-B. 新興・小規模企業のスラック（Bradley, Wiklund & Shepherd 2011）

- **出典**: Bradley, S. W., Wiklund, J. & Shepherd, D. A. (2011) "Swinging a double-edged sword: The effect of slack on
  entrepreneurial management and growth", *Journal of Business Venturing* 26(5): 537–554.
  <https://www.sciencedirect.com/science/article/abs/pii/S0883902610000418>
- **何を与えるか**（事実）: スラックは成長に**正の直接効果**を持つ一方、企業家的マネジメント（entrepreneurial management）には
  **負の効果**を持ち、企業家的マネジメントは成長に正の効果を持つ、という媒介つきの構造を実証した。
  Penrose の成長理論と Stevenson の企業家的マネジメント論を接続している。
- **Before Zero に当てはめると足りないこと**: 「余力が多いことの弊害」を、逆U字（余力量そのものの非単調性）ではなく
  **媒介経路（余力が緊張感を弱め、行動の質を落とす）**として説明する。
  **注意（監査 2026-08-23 で訂正）**: まさの棄却理由（大企業が余力を活かせないのは規模が大きいとリスクを取れないから）と、
  Bradley らの媒介経路（余力が緊張感を弱める）は**別の因果**である。後者をモデルへ入れる案は、モデルページの「採らない主張」
  （戦略余力の逆U字）の実質的な再導入になるので採らない。実証範囲を明記した参照にとどめる。標本は既存の中小企業であり、会社前の段階ではない。

#### 候補 2-C. 柔軟性と待つ価値（Kreps 1979 / McDonald & Siegel 1986 / Dixit & Pindyck 1994 / McGrath 1999）

- **出典**:
  - Kreps, D. M. (1979) "A Representation Theorem for 'Preference for Flexibility'"（BZM 2.2 §17 に既出）
    <https://www.gsb.stanford.edu/faculty-research/publications/representation-theorem-preference-flexibility>
  - Dixit, A. K. & Pindyck, R. S. (1994) *Investment under Uncertainty*. Princeton University Press.
    <https://press.princeton.edu/books/hardcover/9780691034102/investment-under-uncertainty>
  - McGrath, R. G. (1999) "Falling Forward: Real Options Reasoning and Entrepreneurial Failure",
    *Academy of Management Review* 24(1): 13–30. DOI: 10.5465/amr.1999.1580438
    <https://journals.aom.org/doi/10.5465/amr.1999.1580438>
  - McDonald, R. & Siegel, D. (1986) "The Value of Waiting to Invest"（教科書巻末 §読書案内に既出。第9章の土台）
- **何を与えるか**（事実）:
  - Kreps は、将来の選好が不確かなとき、より広い機会集合を好むこと（柔軟性選好）が効用表現として書けることを示した。
    **「選択肢そのものが価値である」ことの公理的な根拠**であり、教科書 7.4 の第四成分（選択肢＝BATNA）を支える。
  - Dixit & Pindyck は、不可逆な投資・不確実性・待てること、の三条件が揃うと「待つ価値」が生じ、
    正味現在価値が正でも直ちに投資すべきでない場合があることを体系化した（実物オプションの標準教科書）。
  - McGrath は、失敗を避けようとする偏りに対して、実物オプションの論理を起業へ持ち込み、
    分散の大きい機会を追いながら条件が良いときだけ投資を進めれば、利益の上振れを保ったまま費用を抑えられると論じた。
- **Before Zero に当てはめると足りないこと**:
  - 実物オプションの標準的な評価には**原資産の価格過程**が要る。Before Zero には市場価格も比較可能な取引も無い
    （領域定義 §5 が「Before Zero から出口までの一発予測は校正の見込みが立たない」として、地平を延ばさない判断を既に置いている）。
  - 選択肢の**本数**を加点すると、共通の故障点（同じ一社に全部ぶら下がっている状態）を見落とす。
    この落とし穴は BZM 2.2 §17 が既に「選択肢数を加点せず、登録済み行動集合と共通故障点を管理する」として塞いでいる。

#### 候補 2-D. 生存可能性理論（Aubin 1991）

- **出典**: Aubin, J.-P. (1991) *Viability Theory*. Birkhäuser.
  <https://link.springer.com/book/10.1007/978-0-8176-4910-4>（この DOI は 2009 年の Modern Birkhäuser Classics 再刊版。初版は 1991 年 Birkhäuser）
- **何を与えるか**（事実）: 制約集合の内側に留まりながら目標へ到達できる軌道が存在するか、を扱う数学の枠。
  viability kernel（生存核）と capture basin（捕捉領域）という概念を与える。
- **Before Zero に当てはめると足りないこと**: BZM 2.2 §7 が既に採用し、戦略余力を「目標到達経路の壊れにくさ」＝
  頑健捕捉領域からの退出時刻 $T_Y$ として運用している。数学の枠は与えるが、
  **SU の状態変数が何で、制約が何で、どの生データから観測するか**は与えない。そこは自前である。

#### 候補 2-E. 二つの停止時刻の競争（first-passage / ギャンブラーの破産）

- **位置づけ**（事実）: 教科書 第7章 7.6 が既に採用済み。到達時刻 $\tau_x$ と余力切れ時刻 $\tau_y$ を置き、
  生存確率を $S = \Pr(\tau_x < \tau_y)$ と定義している（記号の意味は $\tau_x$＝到達度が事業化ラインへ初めて届く時刻、
  $\tau_y$＝戦略余力が 0 に落ちる時刻）。原典は確率論の古典的なギャンブラーの破産問題であり、特定の一論文ではない。
- **Before Zero に当てはめると足りないこと**: 古典が扱うのは**片側の吸収壁（元手が尽きる）だけ**である。
  「ゼロと交差したら清算するしかない」という要件2の後半はこれで表せるが、
  到達との競争として二次元で解く部分は既存の古典には無い（教科書 7.1 が同じことを指摘している）。

### 2-3. 総括（推奨）

**推奨**: 要件2の土台は **Bourgeois(1981) の「余力を測る」という問題設定と、Mount ら(2024) の availability × fungibility の二次元**
を概念層に置き、動学層は **Aubin(1991) の捕捉領域と first-passage の競争**で受ける、という二層構成にするのがよい。

理由。まさの定義は二つの主張を含んでいる。「金だけではない」（＝多成分）と「ゼロと交差したら清算」（＝吸収壁）である。
前者を既存理論だけで支えようとすると、財務スラックの系譜は成分が足りない。
Mount らの二次元は、財務・非財務を問わず「すぐ使えるか」「別の用途へ転用できるか」で余力を並べ直せるので、
教科書 7.4 の五成分（現金・moat・信用・選択肢・集中力）を**恣意的な列挙ではなく既存の枠の上の配置**として説明できる。
後者は Aubin の枠がそのまま受け、BZM 2.2 が既にその運用を書いている。
Kreps(1979) は「選択肢が余力である」ことの根拠として引き続き必要だが、単体では土台にならない。
Nohria & Gulati は、モデルページが逆U字を採らないと決めている以上、**実証範囲を明記した参照**にとどめる。

**手順4で作るもの（既存理論に無い部分）**

1. **財務諸表を持たない主体の余力の測定**。スラック研究の測定はすべて会計データが前提で、Before Zero では成立しない。
2. **異なる性質の成分を同じ単位へ揃える換算則**。教科書 7.4 は「月」に揃えて足しているが、
   moat や信用を何か月と見るかの換算は「校正の手続き」として先送りされている。既存文献はここを一切与えない。
3. **二次元の停止時刻の競争**を、SU の観測可能なイベントから組み立てること。
   （旧4「余力が多いことの弊害を媒介経路の形でモデルへ入れるかの判断」は、監査 2026-08-23 で「採らない主張」の再導入にあたると判定し削除）

---

## 要件3 自走力

### 3-1. 要件の意味（モデルページの文言）

> **自走力** — 外の資金が止まっても、自分の力で稼いで走り続けられる体質。シーズの事業化がうまくいかなくても、
> 稼げる産業を作れるなら産業創出効果がある
> 根拠: まさ 2026-08-23「これが要件から外れることは想定できない。DTSU とはいえ営利法人を作るわけだから、自力で稼げることは大きく評価しないといけない」

この要件は**二つの主張**を含む。
(a) 外部資金が止まっても走れる体質（会社としての自走）。
(b) シーズの事業化が失敗しても、稼げる産業ができれば産業創出効果がある（目的3との接続）。
既存文献の蓄積は (a) に厚く、(b) には薄い。

教科書側の既存定義も確認した。第5章 5.2 の生存条件式
$B_{\mathrm{gross}} - R_{\mathrm{net}} \le C_{\mathrm{cash}} + F_{\mathrm{fin}}$
（$B_{\mathrm{gross}}$＝本命開発の総費用、$R_{\mathrm{net}}$＝つなぎ事業と先行事業の純キャッシュ貢献、
$C_{\mathrm{cash}}$＝自由に使える現金、$F_{\mathrm{fin}}$＝支配を失わずに調達できる上限）が既に金額で置かれており、
$F_{\mathrm{fin}}=0$ の特殊ケースが完全自給に当たると明記されている。

### 3-2. 既存理論の候補

#### 候補 3-A. 財務ブートストラッピング（Winborg & Landström 2001 / Bhidé 1992）

- **出典**:
  - Winborg, J. & Landström, H. (2001) "Financial bootstrapping in small businesses: Examining small business managers'
    resource acquisition behaviors", *Journal of Business Venturing* 16(3): 235–254. DOI: 10.1016/S0883-9026(99)00055-5
    <https://ideas.repec.org/a/eee/jbvent/v16y2001i3p235-254.html>
  - Bhidé, A. (1992) "Bootstrap Finance: The Art of Start-ups", *Harvard Business Review* 70(6): 109–117.
    <https://hbr.org/1992/11/bootstrap-finance-the-art-of-start-ups>
- **何を与えるか**（事実）:
  - Winborg & Landström は、外部の金融機関からの資金に頼らずに資源を確保する行動を **32 の手法**として列挙し、
    スウェーデンの小企業を対象とした調査へクラスター分析をかけて **6 つの類型**（支払いの遅延、売掛金の最小化、
    在庫への投下資本の最小化、経営者個人による資金供給、補助金の活用、関係志向）を取り出した。
    **要件3の観測項目としてそのまま使える、既存の測定用リストがある**という点で、この文献の価値は高い。
  - Bhidé は Inc.500 の 100 社を分析し、7 つの原則（早く動かす、早期の損益分岐とキャッシュ創出を狙う、
    直販が成り立つ高付加価値の製品・サービスを持つ、精鋭チームを最初から雇い揃えない、成長を抑える、
    キャッシュに集中する、銀行と早く付き合う）を示した。実務誌であり、統計的な検証は無い。
- **Before Zero に当てはめると足りないこと**:
  - 対象は**既に営業している小企業**である。研究成果しかない段階で、支払いの遅延も売掛金の最小化も定義できない。
  - ディープテックの遅行性（製造・実証・規制対応・設備・知財に年単位の時間がかかる）が標本に入っていない。
  - 権利が大学にある条件を扱わない。
  - 産業創出効果（(b)）は一切扱わない。

#### 候補 3-B. 内部資金の優先と資金制約（Myers & Majluf 1984 / Carpenter & Petersen 2002）

- **出典**:
  - Myers, S. C. & Majluf, N. S. (1984) "Corporate financing and investment decisions when firms have information that
    investors do not have", *Journal of Financial Economics* 13(2): 187–221.
    <https://www.sciencedirect.com/science/article/abs/pii/0304405X84900230>
  - Carpenter, R. E. & Petersen, B. C. (2002) "Is the Growth of Small Firms Constrained by Internal Finance?",
    *The Review of Economics and Statistics* 84(2): 298–309. DOI: 10.1162/003465302317411541
    <https://direct.mit.edu/rest/article-abstract/84/2/298/57331/Is-the-Growth-of-Small-Firms-Constrained-by>
- **何を与えるか**（事実）:
  - Myers & Majluf は、経営者が投資家より企業価値をよく知っている状況で株式発行の均衡モデルを立て、
    企業が内部資金を最も好み、外部資金が要るなら株式より負債を好むこと、
    そして**価値ある投資機会を見送ってでも株式発行を避けることがある**ことを導いた（後にペッキングオーダー理論と呼ばれる）。
    **「自走が交渉力を守る」という要件3の含意に、理論的な因果を与える。**
  - Carpenter & Petersen は 1600 社超のパネルで、多くの小企業の成長が内部資金に制約されていること
    （内部キャッシュフローの増分がほぼそのまま資産の増分に対応すること）を実証した。
    **「稼ぎが無ければ走れない」の実証側の根拠。**
- **Before Zero に当てはめると足りないこと**:
  - どちらも財務諸表と実績のある企業の分析である。売上ゼロの段階に降りない。
  - Myers & Majluf の含意（希薄化を避けるために内部資金を優先する）は、
    教科書 5.2 が $F_{\mathrm{fin}}$ の定義（支配を失う条件や破壊的な希薄化を伴う資金は入手可能でも $F_{\mathrm{fin}}$ の外に置く）で
    既に実務語へ翻訳している。**理論的な裏づけを与える文献として引くのが正しい使い方であり、新しい式は要らない。**

#### 候補 3-C. エフェクチュエーションとブリコラージュ（Sarasvathy 2001 / Baker & Nelson 2005）

- **出典**:
  - Sarasvathy, S. D. (2001) "Causation and Effectuation: Toward a Theoretical Shift from Economic Inevitability to
    Entrepreneurial Contingency", *Academy of Management Review* 26(2): 243–263.
    <https://journals.aom.org/doi/10.5465/amr.2001.4378020>
  - Baker, T. & Nelson, R. E. (2005) "Creating Something from Nothing: Resource Construction through Entrepreneurial
    Bricolage", *Administrative Science Quarterly* 50(3): 329–366. DOI: 10.2189/asqu.2005.50.3.329
    <https://journals.sagepub.com/doi/10.2189/asqu.2005.50.3.329>
- **何を与えるか**（事実）:
  - Sarasvathy は、予測に基づく論理（causation）と、統制に基づく論理（effectuation）を対比し、
    後者の原理として**許容可能な損失（affordable loss）**を先に決めること、競争分析より提携（事前のコミットメント）を使うこと、
    偶発事象を機会として取り込むことを挙げた。出発点は手持ちの手段（自分は誰か、何を知っているか、誰を知っているか）である。
  - Baker & Nelson は資源の乏しい環境の 29 社を質的に追い、**手元にあるものを本来の用途と違う形で組み合わせて価値を作る**
    ブリコラージュを記述した。すべての領域で並行的にブリコラージュを続けた企業は成長が止まり、
    領域を選んで使った企業は成長した、という対比を報告している。
- **Before Zero に当てはめると足りないこと**:
  - どちらも量的モデルではない。原理と類型であって、自走の**強さ**を測らない。
  - Sarasvathy は教科書が第12章（円卓）と第4章で既に採用しており、要件3の土台に置くと役割が重なる。
    **推奨**: 自走力の土台には置かず、要件3の観測項目（対価を取る行動が発生する条件）の説明語として使う。

#### 候補 3-D. 生存の閾値と新しさの不利（Gimeno, Folta, Cooper & Woo 1997 / Stinchcombe 1965）

- **出典**:
  - Gimeno, J., Folta, T. B., Cooper, A. C. & Woo, C. Y. (1997) "Survival of the Fittest? Entrepreneurial Human Capital and
    the Persistence of Underperforming Firms", *Administrative Science Quarterly* 42(4): 750–783. DOI: 10.2307/2393656
    <https://doi.org/10.2307/2393656>（書誌は Google Scholar の書誌照会と Semantic Scholar で一致を確認）
  - Stinchcombe, A. L. (1965) "Social Structure and Organizations", in March, J. G. (ed.) *Handbook of Organizations*,
    Rand McNally.（教科書巻末 §読書案内に既出。恒久 URL は確認できず、末尾「未確認」参照）
- **何を与えるか**（事実）:
  - Gimeno らは、組織の生存が経済的な成果だけで決まるのではなく、**その企業自身の「成果の閾値（threshold of performance）」**
    にも依存することをモデル化し、実証した。人的資本が厚い創業者ほど外部の機会費用が高く、閾値も高いので、
    同じ業績でも先に撤退しやすい。つまり**同じ数字でも、誰がやっているかで生き残りが変わる**。
  - Stinchcombe は「新しさの不利」（若い組織ほど死にやすい）を論じた。教科書は第2章でこれを採用し、
    法人化境界 $\tau_B$ の議論へ引き継いでいる。
- **Before Zero に当てはめると足りないこと**:
  - Gimeno らの標本は設立後の企業である。Before Zero では**閾値の担い手が未定**（研究者か、外から来る経営者か）なので、
    閾値そのものが観測できない。要件9「担い手」との接続点。
  - Stinchcombe は生存の観察であって、自走の測定を与えない。

#### 候補 3-E.（(b) 産業創出効果の側）スピンアウトによる知識の継承（Agarwal, Echambadi, Franco & Sarkar 2004）

- **出典**: Agarwal, R., Echambadi, R., Franco, A. M. & Sarkar, M. B. (2004) "Knowledge Transfer Through Inheritance:
  Spin-Out Generation, Development, and Survival", *Academy of Management Journal* 47(4): 501–522. DOI: 10.5465/20159599
  <https://journals.aom.org/doi/10.5465/20159599>
- **何を与えるか**（事実）: ディスクドライブ産業の 1977–97 年のデータで、既存企業が持つ技術面・市場開拓面の知識が、
  元従業員による新会社（スピンアウト）へ継承され、その発生数と生存に効くことを実証した。
  **一社の事業が閉じても、人と知識が次の会社へ渡って産業が形成される**という経路を、実証で押さえている。
- **Before Zero に当てはめると足りないこと**:
  - 産業が既に存在する成熟領域の分析であり、産業がまだ無い段階の「産業創出効果」の測定は与えない。
  - **注意**: モデルページは「先行 PJ からの引き継ぎ」を**要件にしないと決めている**（受け取る側の PJ の評価に自動的に入るため）。
    したがってこの文献を**新しい要件の根拠として使ってはいけない**。要件3の後半 (b) を支える理論的な足場としてのみ位置づける。

### 3-3. 総括（推奨）

**推奨**: 要件3の土台は **Winborg & Landström(2001) の bootstrapping 類型を観測項目の一階に、
Myers & Majluf(1984) を「なぜ自走が交渉力を守るのか」の因果の二階に、Carpenter & Petersen(2002) を
「稼ぎが無ければ走れない」の実証の三階に置く**のがよい。
Gimeno ら(1997) は、自走力を稼ぎだけでなく**担い手の受忍水準まで含めて読む**ための補助として置く（要件9と共有する）。

理由。まさの定義の (a) は「外部資金が止まっても走れる体質」であり、これは
「外部資金に頼らずに資源を確保する行動の集合」として既に類型化と測定項目がある（Winborg & Landström）。
教科書 5.3 が既に $R_{\mathrm{net}}$ の中身を「稼ぎの種類で差別せず、純で測る」と定めているので、
bootstrapping の 6 類型はその観測項目として素直に接続する。
そして「なぜ自走が価値なのか」の答えは、稼げること自体ではなく、
**不利な条件を断れることで支配権と将来の選択肢が守られること**にある。この因果は Myers & Majluf が理論として与えている。
教科書 5.2 の $F_{\mathrm{fin}}$ の定義は既にこの含意を実務語で書いており、既存理論との接続を明示すれば足りる。

**手順4で作るもの（既存理論に無い部分）**

1. **売上ゼロの段階で、将来の自走力を先に測る手続き**。教科書 5.2 は金額の不等式を置いているが、
   Before Zero の観測（技術の到達度、用途、需要家との接触、権利の状態）から $R_{\mathrm{net}}$ を予測する部分は既存文献に無い。
   bootstrapping 研究は「いま何をしているか」の記述であって、「これから稼げるか」の予測ではない。
2. **ディープテック固有の遅行性を織り込んだ自走の速度**。既存の内部資金成長の議論（3-B）は
   短い開発サイクルの企業を暗黙に前提しており、実証・規制・設備に年単位を要する場合の自走を扱わない。
3. **(b) 産業創出効果**。「シーズの事業化が失敗しても、稼げる産業を作れれば価値がある」という主張を支える測定は、
   自走力の文献のどれにも無い。スピンアウトによる知識の継承（3-E）が最も近いが、
   産業が既にある領域の分析であり、産業創出そのものの測定ではない。ここは要件10（天井）・目的3と一緒に設計する必要がある。
4. **担い手が未定の段階の閾値**（Gimeno らの threshold を、誰の閾値として置くか）。要件9と共有する未解決点。

---

## 三要件をまたぐ所見（推奨・注意）

1. **BZM 2.2 §17 は既に 21 本の一次文献を URL 付きで整理している**。
   要件1（Penrose、Teece ら、Sirmon ら）と要件2（Nohria & Gulati、Kreps、Aubin、March）の候補の多くは、そこに既に載っている。
   手順3の成果は「新しく探してきた文献」ではなく、**要件ごとにどれを土台に据えるかの選定**として書くのが正確である。
   新規に持ち込む価値が高いのは、要件1では Cohen & Levinthal・Zahra & George・Vohora ら、
   要件2では Mount ら(2024) と George(2005)、要件3では Winborg & Landström・Myers & Majluf・Carpenter & Petersen・Gimeno ら。

2. **三要件は同じ穴を共有している**。すなわち、既存理論の測定はほぼ全て
   「会社がある／財務諸表がある／経営者が決まっている」を前提にする。
   Before Zero で使えるのは**概念の区分と関数形**であって、**測定手続きではない**。
   手順4で作るべきものの大半は、新しい概念ではなく**観測手続きと換算則**である、と整理しておくと設計が散らからない。

3. **要件1と要件2は循環しないように定義を分ける必要がある**。
   要件1は「入力を余力へ変える能力」、要件2は「その結果としての余力」なので、
   変換能力を「余力の増分」で測ると、二つの要件が同じ量の別名になり、乗算で二重計上になる。
   教科書 7.4 末尾が既に同じ注意を書いている（創業者機能 $F$ ＝能力、$y$ の第五成分＝燃料、両者は別物）。
   Penrose の「資源／生産的サービス」の分離を土台に選ぶべき最大の理由がこれである。

---

## 未確認（実在または書誌は妥当と思われるが、DOI・出版社の恒久ページを確認できなかったもの）

このセクションの文献は、本文の推奨の根拠としては使っていない。

- **Higgins, R. C. (1977) "How Much Growth Can a Firm Afford?", *Financial Management* 6(3): 7–16.**（監査で巻号を 6(1)→6(3) に訂正。Semantic Scholar で書誌一致を確認: <https://www.semanticscholar.org/paper/c07640ec9fd066d949dc7edd7eb3614dd1407ece>。DOI は未取得）
  持続可能成長率（外部株式を発行せず、配当性向と資本構成を保ったまま支えられる売上成長率）を定式化した論文。
  要件3の「外部資金なしで支えられる速度」の形式的な土台として最有力の候補だが、
  複数の二次情報で書誌は一致するものの、DOI と出版社の恒久ページを確認できなかった。**要追加確認**。
- **Klepper, S. (2007) "Disagreements, Spinoffs, and the Evolution of Detroit as the Capital of the U.S. Automobile Industry",
  *Management Science* 53(4): 616–631.** 一社の事業が閉じても人材の分岐で産業が形成される経路の実証。
  要件3の (b)（産業創出効果）に近い。書誌は複数の二次情報で一致するが、DOI の確認が取れなかった。**要追加確認**。
- **Cyert, R. M. & March, J. G. (1963) *A Behavioral Theory of the Firm*, Prentice-Hall.**
  スラックの定義（組織の維持に必要な額を超える支払い）は複数の二次情報で一致し、教科書巻末にも既出だが、
  出版社の恒久ページを確認できなかった。**書誌は確定、URL のみ未取得**。
- **Stinchcombe, A. L. (1965) "Social Structure and Organizations", in March, J. G. (ed.) *Handbook of Organizations*, Rand McNally.**
  書籍の一章のため DOI が無い。教科書巻末 §読書案内に既出。**書誌は確定、URL のみ未取得**。
- **McDonald, R. & Siegel, D. (1986) "The Value of Waiting to Invest", *Quarterly Journal of Economics*.**
  教科書巻末 §読書案内（第9章）に既出。本作業では URL の確認をしていない。
