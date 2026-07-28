# PAPER_P1_S6_PACKAGE.md — S6 投稿パッケージ素案 (L3 付属)

> **使用停止（2026-07-29）**：旧二層非可換性定理を含む本文に付随するため、この提出パッケージは使用しない。履歴保存のみ。P1再設計後に投稿先適合性から作り直す。

*2026-07-09、S6 の「まさの手を待たない部分」を前倒し起草 (まさ指示「Fable でいまできることを」)。正本: 本文 = `PAPER_P1_DRAFT.md` / SM = `PAPER_P1_SM.md` / 進捗 = `PAPER_P1_PROGRESS.md`。ここにあるのは提出付随物の**素案**で、まさ確定 (S6 本番) 前に石原先生共著確定・rubric 校正・AUTHOR-CONFIRM の反映で更新される。*

---

## 0. RP 投稿規定チェックリスト (2026-07-09 web 確認)

| 項目 | RP 規定 | 現状 | 判定 |
|---|---|---|---|
| 本文語数 | 8,000–10,000 (脚注・文献・表内テキスト込み、D-060 で確認済み) | 9,933w (Word相当=数式除外) / 10,079w (数式1トークン) | ✅ Word相当で適合 |
| Abstract | **≤250 words** | 264w | ⚠️ **超過 → §1 の 249w 修正案** |
| Keywords | **1–7個** | 8個 | ⚠️ **1個超過 → §2 の削除推奨案** |
| Highlights | 3–5 bullets、各 ≤85字 (スペース込み)、別ファイル提出 | 未作成 | → §3 素案 (5本、全て ≤83字) |
| CRediT 著者貢献 | 必須 | 未作成 | → §4 素案 (単著/共著の2案) |
| 利益相反宣言 | 必須 | 本文に配置済み (Declaration of competing interests) | ✅ AUTHOR-CONFIRM ⑥ の確認待ちのみ |
| SM の独立文献リスト | 明文規定は未発見 (Elsevier 一般則は単一リスト示唆、ただし SM は別ファイルで self-contained 運用が広い) | 本文46件 + SM 専用16件に分割済み | ⏳ 提出システムで確認。不可なら統合に戻す (+~350w、Word相当 10,283 → §1 abstract 縮小では吸収不能のため §4 lineage 段落の SM 送りで −120w 等の微調整で対応可) |

---

## 1. Abstract 修正案 (264w → 249w、規定 ≤250 に適合、SPS/ECR 正式名込み)

*3段構造 (問題 → 最強主張 → 生き残る設計) と全主張を維持したまま 15w 刈り込み。変更は修飾句の圧縮のみで、新しい主張・削られた主張はゼロ。まさ確認後に本文へ反映。*

> Deep-tech ventures born from universities accumulate — or fail to accumulate — most of their value before incorporation, yet this "Before Zero" stage has no measurement theory. Evaluation practice fills the vacuum with institution-adjusted single scores — a project's rating adjusted by its host's capabilities — and committees debate the correct weighting. We prove the debate has no answer. Under four requirements any committee member would separately endorse (a dead venture is worth zero anywhere; a better host never hurts; hosts act through what they do to the venture; value moves continuously) together with two facts of technology-transfer practice (institutional capabilities bind at different venture stages, and act over the venture's remaining journey), no monotone single score merging the two can represent venture value — not the current weighting, not any weighting: an Arrow-style impossibility. Fields that rank and fund by such scores anyway leave statistical scars, derived and pre-registered here — including a Simpson reversal manufactured by score-based selection itself. What survives is a complete design: a multiplicative seed prospect score (SPS = potential × realization × survival), an additive ecosystem construction rate (ECR, the unique admissible aggregate), a shared Triple-Helix macro state, and a founding-timing rule that reads both ledgers without merging them. Conditional gating — the design serious agencies already run — is thereby proven right rather than customary. A retrospective calibration on eight deep-tech projects (2007–2026) illustrates the system; a registered falsification program, Before Zero Studies, states in advance what evidence would prove it wrong.

差分メモ: "born from universities" 維持 / "its host institution's capabilities"→"its host's capabilities" / "hosts act on value through"→"hosts act through" / "merging venture and institution can represent venture value"→"merging the two can represent venture value" / "which we derive and pre-register"→"derived and pre-registered here" / "the field's most serious agencies already run"→"serious agencies already run" / "proven right rather than merely customary"→"proven right rather than customary" / 末文を接続圧縮 / "in the Arrow mold"→"Arrow-style" / "complete working design"→"complete design"。

## 2. Keywords 7個案 (8→7)

**推奨**: `technology readiness levels` を削除 (= "readiness measurement" と検索面で重複。TRL は §2 冒頭で正面から扱うので発見性は落ちない)。

> deep-tech ventures; university spin-outs; readiness measurement; Triple Helix; impossibility theorem; real options; research commercialization

代替案: `research commercialization` を削る (university spin-outs と近い)。まさ選択。

## 3. Highlights 素案 (5本、各 ≤85字・スペース込み)

1. `Proves no single score can merge venture and institution readiness before founding` (82)
2. `Mild axioms plus two technology-transfer facts yield an Arrow-style impossibility` (81)
3. `Score-based selection itself manufactures a Simpson reversal in funded samples` (78)
4. `Two ledgers survive: a multiplicative seed score and an additive ecosystem rate` (81)
5. `Founding timing becomes an optimal-stopping rule on an auditable macro state` (76)

## 4. CRediT 著者貢献 素案

**A 案 (石原先生共著確定時、D-061 の役割分担どおり)**:
> **Masahiro Yamaji**: Conceptualization, Methodology, Formal analysis, Investigation, Data curation, Software, Visualization, Writing – original draft, Writing – review & editing. **[Ishihara]**: Investigation (prior-literature positioning and institutional practice), Validation, Writing – review & editing.

**B 案 (単著時)**:
> **Masahiro Yamaji**: 全項目 (Conceptualization, Methodology, Formal analysis, Investigation, Data curation, Software, Visualization, Writing – original draft, Writing – review & editing).

*gift authorship 回避 (D-061): A 案の石原先生の3項目は「実質貢献をお願いする設計」の反映。共著打診パッケージ (Book A 合流、BOOKS_PORTFOLIO §7-6) の合意内容で最終化。*

## 5. Cover letter 素案 (英語、まさ名義で editor 宛)

> Dear Editors,
>
> Please consider the enclosed manuscript, "The Before Zero Model: measuring deep-tech ventures and their institutional nurseries before day zero," for publication in Research Policy as a research article.
>
> The paper addresses a practice your readership will recognize immediately: evaluation systems that merge a venture-level score with an institution-level score into a single "institution-adjusted" ranking. We prove this object cannot exist. Under four requirements any committee member would separately endorse, together with two observable facts of technology-transfer practice — institutional capabilities bind at different venture stages, and act over the venture's remaining journey — no monotone single score merging the two layers can represent venture value. The impossibility is constructive rather than nihilistic: the paper derives what legitimately survives (additive shortlists with public weights, conditional institutional gates, two-ledger governance), proves the institutional ledger's weighted-sum form unique under practice-grounded axioms, and closes the system with a founding-timing rule welded to an auditable measurement layer. A registered falsification program — including a Simpson-reversal diagnostic that score-based selection itself manufactures — states in advance the evidence that would prove the framework wrong.
>
> The paper is built on literatures this journal has hosted: the composite-indicator critique (Grupp and Mogee, 2004; Grupp and Schubert, 2010), the Triple Helix program (Etzkowitz and Leydesdorff, 2000), and the university spin-out tradition (Bozeman, 2000; Vohora, Wright and Lockett, 2004; Grimaldi et al., 2011). What it adds is the missing aggregation theory at their intersection.
>
> Three transparency notes. First, the empirical section is retrospective calibration under explicit discipline — outcomes were known when rubrics were scored — and is claimed as illustration, not validation; the predictive test is pre-registered and prospective. Second, the authors operate the venture studio whose records the calibration uses; a full competing-interest declaration is included, and the editors are offered audit access to the un-composited records under confidentiality. Third, during development we subjected the manuscript to adversarial internal review, and our own numerical verification reversed two comparative-statics claims from an early draft: the runway effect on the founding threshold is two-signed (dip-shaped under external financing), and making a dormant macro-regime stickier acts as a founding tax rather than a subsidy. The published claims are the corrected ones, and the full numerical run record is deposited in the supplementary material. We flag these reversals ourselves because a paper about honest measurement should be measured honestly.
>
> The manuscript is approximately 9,900 words including footnotes, references and table text, with proofs and technical development in supplementary material. It is not under consideration elsewhere. [Suggested reviewers to be added.]
>
> Sincerely, / Masahiro Yamaji (Team Armada Inc.; Ehime University; Kogakuin University) [+ co-author]

## 6. 想定査読対応骨子 (response scaffold — 実査読が来た時の下敷き)

模擬査読 (6並列、2026-07-03) の収束指摘と、R1–R11 でどう解いたか。実査読で同種の指摘が来たらここから引く。

| 想定指摘 (模擬査読の収束点) | 対応 (改稿済み) | 本文の場所 |
|---|---|---|
| Theorem 3 が「強すぎる主張×弱すぎる証明」(静的公理系では min(SPS,κ) が生存) | R1: f を養育環境の価値関数として動学的に再定義、SH/ED 豊富性条件下で弱単調合成を排除する形に新規証明。静的域での反例の生存も本文で明示 (dynamics are not decoration) | §4、SM-B.1–B.4 |
| C3 (チャネル公理) の型エラー + 論文自身の自己違反 + certification effects 反証文献 | R1/R2: C3′ をクラス定義に変換 (型エラーと自己違反が同時解消)。certification 3文献と正面対決 — price/value 区別、残差ハローのみ排除 = Hansen-J の標的、graceful degradation | §4、SM-B.8 |
| Simpson 反転 (Cor 3.1(i)) が現仮定から導出不能 | R5: score-selected sampling (collider) を明示した DGP から閉形式で再導出。conditional gating では依存恒等ゼロ = 推奨設計がオフスイッチである事実も定理化 | §4 Cor 3.1、SM-B.6 |
| Theorem 4 の証明が別モデルを解いている / ∂θ*/∂F 符号が文献・自§7 と衝突 | R4: 2D free-boundary curve θ*(k;F) に再ステート、(E)/(J) 資金規約2本立てで符号問題を解剖 — **旧 uniform 主張 ∂θ*/∂F<0 は撤回し、dip 型 (計算版 Fig.3) に訂正**。Boyle–Guthrie と正面対峙 | §5、SM-C |
| §6 の検証可能性ゼロ / hindsight 非開示 | R6: P/R/S 操作化を §3 に新設、開示5本 (composite/retrospective/selected/asymmetric/circularity)、misfire honesty、単一評価者+結果既知の2欠陥を明記し registry 側の設計 (2名盲検+第三者判定) で対置 | §3, §6, SM-D.4/D.5 |
| 理論:政策比の偏り (52% vs 6.6%) | R7: §7 を3倍増強 — 実務装置 (Horizon Europe / KEF / HEInnovate / AUTM·ASTP) との対応、負のタイミング装置 (設立期限補助金)、監査防御論 | §7、SM-D.6 |
| モノグラフ deferral 13件 | R9: SM 内で全て閉じた (live GAP は SM-B.7 instrument list の registered-program 委譲1件のみ = 査読 acceptable 判定) | SM 全体 |
| **rebut (突っぱね)**: N=8 で何も言えない | illustration と明示宣言した上で維持 (Tier 規律)。効果主張はゼロ、記述的読みのみ | §6 |
| **rebut**: 機関実名を出せ | composite + type 名 + editor への非合成記録の監査アクセス提供で防衛 | §6, COI |
| **rebut**: 数理を削れ | 削らず §7 を増やして比率を是正済み + 全証明を SM へ (本文は定理文+直感のみ) | 全体 |

**R4 反転を own する段落** (cover letter 第4段落に組込済み): 査読で「投稿版から主張が反転している」と指摘される前に自己申告する。反転2点 = ①runway 効果は2符号 (dip 型、外部調達時) ②dormant regime の stickiness は founding tax。数値検証が理論を訂正した事実は弱点ではなく、SM-C.5 の再現パッケージと合わせて「検証可能性の実演」として提示する。

## 7. S6 完了までの残作業 (このパッケージの外)

1. まさ: rubric 校正 (→ Table 2 値列) / AUTHOR-CONFIRM 9項目 (→ §6・COI hedge 解除) — **blocking**
2. [verify at S6] 16 tags: **照合は保留中** (2026-07-11 照合エージェントをまさが手動停止 → 再開はまさ判断待ち。タグは全16個維持されており実害なし)
3. ✅ ~~引用62件 (本文46+SM16) 最終照合~~ (2026-07-11 完了: **59 OK / FIX 3件反映済み / 幻覚ゼロ維持**。FIX = Zhang–Guo 2004 著者順 (SIAM/Crossref/DBLP 3ソースでバイライン確認、本文 in-text 2箇所 + SM 5箇所も修正) / Perkmann et al. 2013 全16著者列挙 / Fishburn 1976 = Synthese 33 (2/4)。軽微メモ: 書籍の出版地表記が不統一 (S6 style 統一で処理) / Décamps 2005 に正誤表あり (エントリ変更不要))
4. 石原先生共著の確定 → 著者行・CRediT・COI・cover letter 更新
5. タイトルページ整備 (対外表記 PF-007: 愛媛大学および工学院大学にてイノベーションマネージャー、香川大学にて客員研究員)
6. instrument 5件書誌 (SM-B.7 の deposit プロトコル側) — R10 (OSF) とセット、まさ判断後
7. 提出システムでの SM 文献リスト分割可否確認 → 不可なら統合リストへ戻す
8. suggested reviewers 3–5名の選定 (まさと) — **ロングリスト §8 完成済み (2026-07-11)**、まさは選ぶだけ


## 8. Suggested reviewers ロングリスト (2026-07-11 調査、公開学術情報のみ)

Compiled 2026-07-11 from public academic sources only (university staff pages, Google Scholar, publisher/RePEc indexes). No Japan-based scholars; all candidates show 2022+ activity (exceptions flagged). Coverage: 3 evaluation/composite indicators, 3 tech transfer/academic entrepreneurship, 1 real options, 1 measurement/decision theory (+1 overlap), 2 TRL/engineering management.

| # | Name | Affiliation (public) | Expertise match (1 line) | Referees which part | Flags |
|---|------|----------------------|--------------------------|---------------------|-------|
| 1 | Alison Olechowski | University of Toronto, Mechanical & Industrial Engineering (Ready Lab) | Lead author of the canonical "TRL shortcomings" paper (Systems Engineering 2020); engineering design process measurement | Readiness-scale critique; engineering-management side of the ERS construct | Cited (approvingly) in the manuscript. Very active (15-18 pubs/yr, 2023-2025). No Japan ties visible. |
| 2 | Mihály Héder | Budapest University of Technology and Economics (BME) | Historian/critic of the TRL scale's migration from NASA into EU innovation policy ("From NASA to EU") | TRL as institutional policy instrument; the institution-side readiness argument | Recent output (2022-2024) centers on AI ethics rather than TRL; TRL work is 2017-2020 but uniquely on-point. Verify responsiveness. |
| 3 | Menelaos Tasiou | University of Surrey, Surrey Business School (Senior Lecturer in Finance) | Co-author of the standard methodological review of composite indices (weighting, aggregation, robustness; Soc. Ind. Res. 2019) | Composite-indicator aggregation assumptions; robustness/uncertainty analysis of ERS | Cited in the manuscript. Moved Portsmouth → Surrey (profiles differ; use Surrey). Active: EJOR 2026, JBE/BJM 2024. |
| 4 | Marco Cinelli | Leiden University (Leiden University College + Institute of Environmental Sciences CML) | Composite-indicator construction and MCDA method-selection tools (CIAO, MCDA-MSS); EJOR 2025 on CI via multi-criteria | Indicator methodology, sensitivity/robustness claims, method-choice justification | None visible. EURO MCDA summer-school instructor (2026) — methodologically current. |
| 5 | Giuseppe Munda | European Commission, Joint Research Centre (JRC) | Non-compensatory aggregation and social-choice (Condorcet/Arrow) issues in composite indicators; SMCE/SOCRATES | The Arrow-style impossibility result as it bears on evaluation practice; compensability axioms | Policy-institution affiliation (EC JRC), not a university dept — still a standard reviewer in this space. Active 2023 (Notas Económicas; fuzzy MCE work). |
| 6 | Thierry Marchant | Ghent University, Dept. of Data Analysis | Axiomatic measurement/conjoint-measurement and social choice; axiomatics of bibliometric rankings (with Bouyssou) | The ERS additive-representation theorem and impossibility proof machinery | Active (2024 SSRN with Gravel, rank-dependent utility axiomatization). Same university as alternate Knockaert (different faculty) — avoid suggesting both. |
| 7 | Benoît Chevalier-Roignant | emlyon business school | Real options and strategic investment timing under uncertainty (Operations Research 2024, JEDC 2024; co-author of MIT Press *Competitive Strategy* with Trigeorgis) | The real-options founding-timing rule (option value of waiting vs. entry) | None visible. Note his frequent co-author L. Trigeorgis is deceased — Chevalier-Roignant is the active torchbearer. |
| 8 | Einar Rasmussen | Nord University Business School, Bodø (Professor of Technology Management) | University spin-off development processes and evolution of venture competencies | Venture-side readiness constructs; realism of the registered falsification program | 2024 AMP paper co-authored with alternate Knockaert — do not suggest both. Highly cited; no Japan ties visible. |
| 9 | Federico Munari | University of Bologna, Dept. of Management (Full Professor, Technology & Innovation Management) | Gap-funding/proof-of-concept program design and evaluation; finance for technology transfer | Institution-side instruments (the "institutional nursery" readiness dimension) | Cited in the manuscript. Core gap-fund work 2015-2021; recent co-authored output (JTT 2024, SBE 2025) indexed under his name — re-verify pipeline at submission. |
| 10 | Christopher S. Hayter | Georgia Institute of Technology, Jimmy and Rosalynn Carter School of Public Policy (Associate Professor) | Academic entrepreneurship ecosystems and microfoundations (moved from Arizona State ~2024-25) | Ecosystem/nursery conceptual framing; knowledge-intermediary claims | Cited in the manuscript. Active 2024-2025 (SBE 2024; JTT and Science & Public Policy 2025). Use Georgia Tech affiliation, not ASU. |

## Alternates (if a slot opens)

| Name | Affiliation | Match | Flags |
|------|-------------|-------|-------|
| Mirjam Knockaert | Ghent University (+ visiting TUM) | Support actors for early-stage high-tech ventures; academic spin-off governance | Co-author of Rasmussen (AMP 2024) — mutually exclusive with #8. Active. |
| Martin Meyer | University of Vaasa (Vice-Rector; Professor, School of Technology and Innovations) | Triple Helix indicators and patent/scientometric measurement (Leydesdorff's active co-author lineage) | Editor roles (co-editor Prometheus; boards of Scientometrics, J. Informetrics; EiC Triple Helix journal). Admin role may slow reviews; recent first-authored output thinner. |

## Conflict/proximity screening notes

- None of the 12 are based at Japanese institutions. Top-level co-authorship screening surfaced no visible collaborations with Ehime/Kagawa/Kogakuin-affiliated technology-transfer scholars (checked in search-result depth only, not full CV audits).
- Research Policy editorial-board page (ScienceDirect) returned HTTP 403 to automated access, so RP-editor status could not be machine-confirmed for any candidate; no candidate self-lists an RP editorship on their public profile. Editorial roles found elsewhere are noted per candidate (not conflicts, per journal norms — but worth stating in the cover letter if used).
- Internal pairing constraints: (#8 Rasmussen ↔ Knockaert) recent co-authors; (#6 Marchant ↔ Knockaert) same university. Olechowski, Tasiou, Munari, Hayter are cited in the manuscript — this is normal for suggested reviewers but flag if the editor asks.

## How activity was verified (3 lines)

1. Current affiliation taken from each person's own university staff page or institutional research portal (fetched July 2026), not from stale aggregator profiles; two moves caught this way (Tasiou Portsmouth→Surrey; Hayter ASU→Georgia Tech).
2. 2022+ activity confirmed by locating at least one named 2023-2026 output per candidate in publisher/RePEc/SSRN indexes (e.g., Olechowski 2025 JMD/PACM-HCI; Tasiou 2026 EJOR; Cinelli 2025 EJOR; Munda 2023; Marchant 2024; Chevalier-Roignant 2024 Operations Research; Rasmussen/Knockaert 2024 AMP; Hayter 2024 SBE; Meyer via current Vaasa role), with two soft cases flagged in-table (Héder, Munari).
3. Deceased/retired screening: M. Wright, L. Leydesdorff, L. Trigeorgis excluded as deceased; A. Vohora excluded (left academia); no candidate shows an emeritus/retired status on their institutional page.

## Key public sources

- Olechowski: readylab.mie.utoronto.ca/publications
- Tasiou: surrey.ac.uk/people/menelaos-tasiou
- Rasmussen: nord.no/en/about/employees/einar-agur-rasmussen
- Munari: unibo.it/sitoweb/federico.munari/en; innovationgrowthlab.org profile
- Hayter: spp.gatech.edu/people (Carter School faculty listing)
- Marchant: users.ugent.be/~tmarchan; SSRN 4900187 (2024)
- Munda: JRC/ResearchGate profile; OECD KEP note on SMCE/SOCRATES
- Cinelli: universiteitleiden.nl/en/staffmembers/marco-cinelli; EJOR 2025 (ideas.repec.org/a/eee/ejores/v326y2025i2p326-342.html)
- Chevalier-Roignant: em-lyon.com faculty page; SSRN 5002210 (2024); hal.science/hal-04817939
- Héder: filozofia.bme.hu/people/mihaly.heder
- Knockaert: ugent.be/eb/mio/cer/en/team/mirjamknockaert.htm
- Meyer: uwasa.fi/en/person/2119490

## Changelog

| Date | What | By |
|---|---|---|
| 2026-07-09 | 初版 (S6 前倒し)。規定チェックリスト (abstract 264→250 超過と keywords 8→7 超過を発見)、abstract 247w 案、keywords 案、highlights 5本、CRediT 2案、cover letter 素案 (R4 反転 own 段落込み)、想定査読対応骨子 | えいみ |
| 2026-07-11 | レンズ名改称 SPS/ECR を反映 (abstract 案は正式名込みに再調整、highlights #4 改稿) | えいみ |
| 2026-07-11 | 引用照合完了 (59 OK / FIX 3件) を §7 に反映、§8 査読者ロングリスト (10名+補欠2名) 収載。verify タグ照合はまさ停止により保留と記帳 | えいみ |
