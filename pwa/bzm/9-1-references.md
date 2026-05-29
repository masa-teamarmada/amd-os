# 統合参考文献

> **ねらい**：本書の各部が引用した文献・一次資料・正本ドキュメントを一箇所に集約します。学術文献は著者姓のアルファベット順、政府・枠組み資料と内部正本は別立てで並べます。各エントリ末尾の〔 〕は、その文献を主に用いた部を示します。

## A. 学術文献

- Avolio, B. J., & Gardner, W. L. (2005). "Authentic leadership development: Getting to the root of positive forms of leadership." *The Leadership Quarterly*, 16(3), 315–338. 〔第 4 部〕
- Bernstein, S., Korteweg, A., & Laws, K. (2017). "Attracting early-stage investors: Evidence from a randomized field experiment." *The Journal of Finance*, 72(2), 509–538. 〔第 4・5 部〕
- Canova, F., & Ciccarelli, M. (2013). "Panel Vector Autoregressive Models: A Survey." *Advances in Econometrics*, 32, 205–246. 〔第 2 部〕
- Cobb, C. W., & Douglas, P. H. (1928). "A theory of production." *American Economic Review*, 18(1), 139–165. 〔第 1・5・6・8 部〕
- Duckworth, A. L., Peterson, C., Matthews, M. D., & Kelly, D. R. (2007). "Grit: Perseverance and passion for long-term goals." *Journal of Personality and Social Psychology*, 92(6), 1087–1101. 〔第 4 部〕
- Etzkowitz, H., & Leydesdorff, L. (1995). "The Triple Helix—University-industry-government relations: A laboratory for knowledge based economic development." *EASST Review*, 14(1), 14–19. 〔第 2 部〕
- Etzkowitz, H., & Leydesdorff, L. (2000). "The dynamics of innovation: from National Systems and 'Mode 2' to a Triple Helix of university-industry-government relations." *Research Policy*, 29(2), 109–123. 〔第 2・7 部〕
- Hsu, D. H. (2007). "Experienced entrepreneurial founders, organizational capital, and venture capital funding." *Research Policy*, 36(5), 722–741. 〔第 4・5 部〕
- Litterman, R. B. (1986). "Forecasting with Bayesian vector autoregressions—five years of experience." *Journal of Business & Economic Statistics*, 4(1), 25–38. 〔第 2 部〕
- Mankins, J. C. (1995). "Technology Readiness Levels: A White Paper." NASA, Office of Space Access and Technology. 〔第 3 部〕
- Markman, G. D., Baron, R. A., & Balkin, D. B. (2005). "Are perseverance and self-efficacy costless? Assessing entrepreneurs' regretful thinking." *Journal of Organizational Behavior*, 26(1), 1–19. 〔第 4 部〕
- Sims, C. A. (1980). "Macroeconomics and reality." *Econometrica*, 48(1), 1–48. 〔第 2 部〕
- Stock, J. H., & Watson, M. W. (2002). "Forecasting using principal components from a large number of predictors." *Journal of the American Statistical Association*, 97(460), 1167–1179. 〔第 2 部〕
- Walumbwa, F. O., Avolio, B. J., Gardner, W. L., Wernsing, T. S., & Peterson, S. J. (2008). "Authentic leadership: Development and validation of a theory-based measure." *Journal of Management*, 34(1), 89–126. 〔第 4 部〕

## B. 政府・公的枠組み資料

- 内閣府・ERCA（令和 5 年）「戦略的イノベーション創造プログラム（SIP）サーキュラーエコノミーシステムの構築 2023 年度公募要領」Ver1.1, PD: 伊藤耕三（東京大学）. 〔第 3 部〕— TRL/BRL/GRL/SRL/HRL の 9 段階定義の一次資料。
- European Commission, *Horizon Europe* における Societal Readiness Level（SRL）枠組み. 〔第 3 部〕— SRL の 9 段階の出所。

## C. AMD 内部正本ドキュメント

本書は次の正本を教科書として再構成したものです。仕様変更があれば正本側と本書を同じ更新で揃えます。

- `before-zero/theory/amd_score.md` — AMD Score（7 軸 Cobb-Douglas 統合）の理論正本。〔第 5・6・8 部〕
- `before-zero/theory/state_space_model.md` — マクロ状態空間モデル（BVAR / Kalman / 固有値分解）の理論正本。〔第 2 部〕
- `before-zero/theory/bvar_prior.md` — Minnesota prior + 階層 prior の prior 仕様。〔第 2 部〕
- `before-zero/theory/data_specification.md` — 観測量・データソースの仕様。〔第 2 部〕
- `pwa/design/amd_score.md` — AMD OS への AMD Score 実装設計（M×X×F、律速、Triple Helix 観測モデル）。〔第 5・8 部〕
- `pwa/design/institution_readiness.md` — ERS（8 軸 × サブ軸 × Lv1–5 rubric）の設計正本。〔第 7 部〕

## D. 実務ベースの一次情報

- AMD のスタジオ運営実務に基づく 9 PJ retrofit 分析（ティエムファクトリ、輝翠 TECH、CrestecBio、LiSTie、JOYCLE、BWE、Yellow Duck、CryoX、SolvioraX）。各 PJ の軸評価・時系列は AMD OS の `amd_score_inputs` および Before Zero retrofit メタデータに基づく。〔第 6 部〕

---

> 文献の引用方針：本書は教科書として通読性を優先し、本文中では「著者（年）」形式で軽く参照し、完全な書誌情報は本一覧に集約しています。論文版（IMRaD）では各主張に対する文中引用を厳密化します。
