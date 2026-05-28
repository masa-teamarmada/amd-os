# AMD OS / AMDプロトコル 先行特許一次スクリーニング (新版 = 2026-05-27 ピント修正後)

作成日: 2026-05-27 (新版)
対象: `2026-05-27_amd_os_protocol_patent_proposal.md` で整理した 3 発明要素のうち、**ワークフロー / システム / データ構造**軸のみ
位置づけ: 弁理士相談前の一次スクリーニング。

---

## 0. 重要な前提 (まさ判断 2026-05-27)

### 特許化対象外 (= 本スクリーニングの対象外)

以下は AMD が「論文・公的フレームワーク・既存学術定義の引用元」として明細書に書くだけで、**新規性主張対象には含めない**。

- **Cobb-Douglas 関数による集約**: Cobb & Douglas (1928)
- **TRL の 9 段階定義**: NASA Mankins (1995)
- **TRL/BRL/GRL/SRL/HRL の 5 軸構成と 9 段階定義**: 内閣府 SIP 第 3 期、EU H2020
- **Triple Helix (μ_A × μ_I × μ_G)**: Etzkowitz & Leydesdorff (2000)
- **FRL の構成要素 (ALQ / Grit / Resilience)**: Walumbwa 2008 / Duckworth 2007 / Markman 2005
- **AMD Score の 7 軸構成 (σ_SU × TRL × BRL × GRL × SRL × HRL × FRL)** 自体
- **α 重みの具体値**

→ 旧版 (initial 6 領域調査) で「危険」と挙げた CHI Research US6175824B1 (Cobb-Douglas)、内閣府 SIP、C2X XRL+、EQT Motherbrain、CB Insights Mosaic、arXiv 2407.04885 (LLM-powered VC) などは **AMD の請求項をブロックしない** ため、本スクリーニングから外す。

### 特許化対象 (= 本スクリーニングの対象)

ワークフロー / システム / データ構造軸 + 適用先・出力種別軸。具体的には以下 7 軸 (A-G):

| 軸 | 内容 |
|---|---|
| A | 業務マルチソース HITL LLM 構造化抽出 + 承認ワークフロー + 正本 DB 反映 |
| B | 却下 / コメントが次回 LLM プロンプトに自動注入される prompt-level 継続学習ループ |
| C | 証拠メタデータ (snippet + hash + url + run_id + confidence) で原本非保存・監査可能 |
| D | 意思決定 / 教訓 / 議事録ナレッジベース (抽象化 + 1:N 事例構造) |
| E | multi-horizon append-only outcome ledger (横展開: 医療 / 投資 / 教育 / 臨床試験) |
| F | AI 提案 → 人手承認 → 設定 / ルール / プロンプト / モデルの new version 昇格 governance loop |
| **G** | **Before-Zero (= 法人設立前研究シーズ段階) ドメインへの適用 + 法人設立タイミング判定出力** (= まさ #q1 で追加) |

---

## 1. 結論サマリ

本スクリーニングで、AMD 案の 3 発明要素について、**特許そのものが請求項を直接ブロックするケースは現時点で発見されなかった**。一方で、以下 3 系統の阻害材料が深刻である。

1. **軸 E (multi-horizon outcome ledger) は医療系で schema が事実上の標準として公知**。**FHIR Observation リソース** と **OMOP CDM OBSERVATION テーブル** が `(subject + concept + effectiveDateTime + interpretation/valence + status/confidence)` でほぼ同型。**請求項 5 単独では新規性主張困難** → 「経営判断ドメイン」「矛盾観測の同時保持」「異種 evidence 統合参照」の複合クレームに組み直しが必須。
2. **軸 F (governance loop) は Ciena US 10,965,527 (2021) が「AI 提案 → pending → 人手承認 → version 保持」の 4 要素を網羅**。ブロックチェーン必須 + ネットワーク機器限定が差別化ポイント。AMD は「異種オブジェクト (prompt / rule / config / model / workflow) を統一的に扱う汎用 governance」として書くことで回避可能。
3. **軸 A (HITL extraction workflow) は Seek AI 2 件 (2024-12 登録) と Glean US20240256582A1 が要警戒**。Seek AI の請求項全文 verify が最優先タスク。

しかし、AMD 案を以下 **5 要素の AND 結合** + **「Before-Zero deep-tech 事業化」のドメイン文脈** で書けば、現時点では新規性・進歩性とも主張可能なホワイトスペースが残っている:

1. **WS-1 改**: 全文非保存 + 5 タプル証拠メタデータ (snippet + hash + url + run_id + confidence)
2. **WS-2 改**: 却下 / 自由文コメントが次回 LLM 抽出プロンプトに自動注入される (重み更新なし、抽出器スコープごとに永続管理)
3. **WS-3 改**: 同一意思決定 (= 経営判断ドメイン) に対する multi-horizon × 5 値 valence × confidence の append-only 結果観測 ledger + **矛盾観測 (positive 1m と negative 24m の同時) を保持したまま意思決定者に呈示する UI/ワークフロー** + **異種 evidence 統合参照**
4. **WS-4 改**: 固有名詞除去 + 題目ハッシュ (sha12) による普遍 protocol 集約 + 1:N 事例構造 (各 example が source_meeting_id を持つ) + 4 要素 (分岐点 / 判断材料 / アクション / 結果)
5. **WS-5 改**: AI 提案 → pending UI → 人手承認 → 新 version 昇格 という governance loop を **複数種類の system parameter (prompt / rule / config / model / workflow step) に統一的に適用するメタ機構**

---

## 2. 調査範囲と方法

| 観点 | 方法 |
|---|---|
| データベース | Google Patents, USPTO PPUBS, WIPO Patentscope, J-PlatPat (一部未踏)、arXiv |
| 対象期間 | 主に 2019-2026 (LLM era、cross-domain は 2010-2026) |
| 検索領域 | 6 軸 (A-F) 並列で general-purpose agent に投入 |
| 言語 | 英語 + 日本語 (J-PlatPat は語彙ミスマッチで未踏、次セッション必須) |
| 学術ソース | arXiv / SSRN / 学会論文も「新規性破壊文献」として記録 |

---

## 3. 危険度マトリクス (全公報・文献 一覧)

凡例: 🔴 high (主請求項を直接阻害しうる) / 🟡 medium (請求項範囲次第) / 🟢 low (ドメイン違い・差別化容易)

### 3.1 軸 A: HITL LLM 構造化抽出 + 承認ワークフロー + 正本 DB 反映

| # | 公報 | 出願人 | 法域 | 公開年 | 危険度 |
|---|---|---|---|---|---|
| A-1 | **Seek AI 米国特許 2 件 (公報番号未 verify)** | Seek AI Inc. | US | 2024-12 登録 | 🔴 high (HITL+LLM 上位概念) |
| A-2 | **US20240256582A1 — Search with Generative AI** | Glean Technologies | US | 2024-08 公開 | 🟡 medium (検索+生成 上位概念) |
| A-3 | US10361981B2 — Auto-extraction of commitments/requests | Microsoft | US | 2019 登録 | 🟡 medium (LLM 以前の NLP 系、親特許) |
| A-4 | US12131115B2 — Summarization for recorded audio | IBM | US | 2024-10 登録 | 🟢 low (単一会議内に閉じる) |
| A-5 | Notion Labs 関連 (XML 検証付き LLM 命令、DB×LLM、外部 SaaS 連携) | Notion Labs | US | 出願多数 | 🟡 medium (Notion 中心 API、要 verify) |

### 3.2 軸 B: 却下 / コメント → 次回 LLM プロンプト注入 (prompt-level)

| # | 公報 / 文献 | 出願人 | 法域 | 公開年 | 危険度 |
|---|---|---|---|---|---|
| B-1 | **arXiv 2408.04560 (Conversational Prompt Engineering)** | IBM Research | — | 2024 | 🔴 high (新規性破壊文献) |
| B-2 | **US 2025/0111147 A1 — Auto LM Input Optimization Using Textual Gradients (ProTeGi)** | Microsoft | US | 2025-04 公開 | 🟡 medium (LLM 自己批評型、人間 reject なら区別可) |
| B-3 | US 2025/0005224 A1 — Prompt engineering for industrial automation | (未 verify) | US | 2025-01 公開 | 🟡 medium (要 verify) |
| B-4 | US 12,511,495 — Training data from GenAI + user feedback | Salesforce 系 (未 verify) | US | (未 verify) | 🟢 low (weight 更新型、AMD は no-weight-update) |
| B-5 | US 2025/0363380 — RL Networks with Iterative Preference Learning | (未 verify) | US | 2025-11 公開 | 🟢 low (RLHF 型) |
| B-6 | arXiv 2405.17346 (APOHF), 2505.07886 (PLHF) | (Academic) | — | 2024-2025 | 🔴 high (新規性破壊文献) |
| B-7 | Reflexion / Self-Refine (arXiv 2303.11366 / 2303.17651) | (Academic) | — | 2023 | 🟢 low (LLM 自己反省、人間 reject ではない) |

### 3.3 軸 C: 証拠メタデータ (snippet + hash + url + run_id) 原本非保存

| # | 公報 / 文献 | 出願人 | 法域 | 公開年 | 危険度 |
|---|---|---|---|---|---|
| C-1 | **BigID 関連特許 ("ML for Confidence Levels of Personal Information Findings", 公報番号未 verify)** | BigID Inc. | US | 出願多数 | 🔴 high (no-copy + hash + confidence の思想最接近) |
| C-2 | US8576283B1 — Hash-based chain of custody | Sensormatic (Tyco) | US | 2013 登録 | 🟢 low (原本保存前提) |
| C-3 | US9779284B2 — Privacy-preserving evidence (ALPR) | Conduent (Xerox) | US | 2017 登録 | 🟢 low (原本暗号保存) |
| C-4 | WO2021043144A1 — Blockchain evidence collection | 中国系 | WO | 2021 | 🟢 low (原本別 DB 保存) |
| C-5 | US7861049B2 / US8788519B2 / US8560503B1 — CAS 系 | EMC | US | 各年 | 🟢 low (原本保存前提のストレージ層) |
| C-6 | US12443638 — RAG validation framework | (未 verify) | US | 2025 | 🟡 medium (要 verify) |
| C-7 | US12111859B2 — Enterprise GenAI architecture | (未 verify) | US | 2024 登録 | 🟡 medium (要 verify) |
| C-8 | Anthropic Citations API (2025-01 公表) | Anthropic | (非特許) | 2025-01 | 🟢 low (API 応答層、永続化なし) |
| C-9 | **arXiv 2511.17118 (Constant-Size Crypto Evidence Structures for AI)** | (Academic) | — | 2025-11 | 🔴 high (新規性破壊リスク、早期出願必須) |

### 3.4 軸 D: 意思決定 / 教訓 / 議事録ナレッジベース (抽象化 + 1:N)

| # | 公報 / 文献 | 出願人 | 法域 | 公開年 | 危険度 |
|---|---|---|---|---|---|
| D-1 | **US 12,494,933 — Meeting tapestries (AI)** | Microsoft | US | 2024-2025 | 🟡 medium (LLM + 議事録 + 構造抽出 上位概念) |
| D-2 | US 12,475,304 — Meeting summarization w/ accuracy control | (未 verify) | US | 2024-2025 | 🟡 medium |
| D-3 | US 12,132,580 — Interactive meeting tapestries | Microsoft 系 | US | 2024 | 🟡 medium |
| D-4 | US 10,318,636 — Action items via neural networks from KB | Accenture/Wipro 系 | US | 2019 | 🟢 low |
| D-5 | **US 10,521,224 — Cross-project software learning** | IBM | US | 2019 | 🟡 medium (cross-project learning の先行思想最接近、ただし逆向き構造) |
| D-6 | **US 11,082,310 — Multi-instance hash aggregation** | ServiceNow | US | 2021 | 🟡 medium (`protocol_id = sha12(title)` 上位概念) |
| D-7 | US 9,202,078 — One-way hash anonymization | IBM | US | 2015 | 🟢 low (汎用匿名化) |
| D-8 | US 10,614,248 — Cross-organizational anonymization | (未 verify) | US | 2020 | 🟢 low |
| D-9 | US 11,748,639 — CBR as cloud service | (米企業) | US | 2023 | 🟡 medium (CBR + 1:N case linking) |
| D-10 | **arXiv 2601.04463 (ProMem 2026)** | (Academic) | — | 2026 | 🔴 high (新規性破壊文献、4 要素テンプレ構造に酷似) |
| D-11 | arXiv 2504.06943 (CBR for LLM Agents review 2025) | (Academic) | — | 2025 | 🟡 medium |
| D-12 | (既出) IBM US 7,730,005 (Lessons Learned closed loop) | IBM | US | 2010 | 🔴 high (4 要素構造に最接近、過去調査で既出) |
| D-13 | (既出) HP US 9,299,025 (CBR case generalization) | HP 系 | US | 2016 | 🔴 high (抽象化に直撃、過去調査で既出) |

### 3.5 軸 E: multi-horizon append-only outcome ledger

| # | 公報 / 文献 | 出願人 | 法域 | 公開年 | 危険度 |
|---|---|---|---|---|---|
| E-1 | **FHIR Observation リソース (HL7 規格)** | HL7 International | (非特許の規格) | 2014- | 🔴 **最高** (`subject + code + effectiveDateTime + interpretation + status` がほぼ AMD schema と同型、新規性破壊) |
| E-2 | **OMOP CDM OBSERVATION テーブル (OHDSI)** | OHDSI | (非特許の標準) | 2010- | 🔴 **最高** (append-only 縦断保持の事実上の標準、新規性破壊) |
| E-3 | EP3274811A1 — Multi-segment longitudinal database queries | (未 verify) | EP | (要 verify) | 🟡 medium-high (ユーザ定義時点ごと outcome 保持構造) |
| E-4 | US20080065452A1 — Longitudinal EHR | (未 verify) | US | 2008 | 🟡 medium (problem-oriented 縦断記録、AMD の decision-oriented と構造同型) |
| E-5 | US8380531 — Clinical trial endpoint development | (未 verify) | US | 2013 | 🟢 low (endpoint 設計プロセス、ただし PRO 縦断蓄積の公知例) |
| E-6 | US10642854 — ThoughtSphere CDM | ThoughtSphere | US | 2020 | 🟢 low (データ標準化) |
| E-7 | US8533029 — Clinical monitoring w/ time shifting | (未 verify) | US | 2013 | 🟢 low |
| E-8 | US20120094265A1 — Student performance monitoring | (未 verify) | US | 2012 | 🟡 medium (教育ドメインの縦断 outcome 追跡公知性) |
| E-9 | EP2019992A1 — Immutable audit log | (未 verify) | EP | 2009 | 🟢 low (append-only 性は古くから公知) |
| E-10 | US20210034590A1 — Ledger-based ML | — | US | 2021 | 🟢 low (汎用 append-only ledger) |

### 3.7 軸 G: Before-Zero 適用 + 設立タイミング判定出力 (まさ #q1 後追加)

| # | 公報 / 文献 | 出願人 | 法域 | 公開年 | 危険度 |
|---|---|---|---|---|---|
| G-1 | **US 12,315,010 B2 — ML-based temporal startup predictive system** | Microsoft | US | 2025 登録 | 🟡 medium (テンポラル予測モデル方法論一致、ただし対象イベントに incorporation 含まず) |
| G-2 | **ReadyScore.ai (SaaS, 2025)** | ReadyScore Inc. | (非特許) | 2025 | 🟡 medium (40+ ファクター + 投資準備度ギャップ、ただし post-founding) |
| G-3 | JST START / NEDO TCP / AIST GAP | JST / NEDO / AIST | (政策・非特許) | 継続中 | 🟢 low (人手プロセス、AI 自動化なし) |
| G-4 | CRL (Commercial Readiness Level) フレームワーク | Univ. of Sydney 等 | (学術・非特許) | — | 🟢 low (静的フレームワーク、タイミング出力なし) |
| G-5 | NIH SBIR/STTR CRP / NSF I-Corps | NIH / NSF | (政策・非特許) | 継続中 | 🟢 low (政策プログラム、AI なし) |
| G-6 | **R.A.I.S.E. (arXiv 2504.12090, 2025)** | (Academic) | — | 2025 | 🟢 low (LLM ベース early-stage 評価だが投資判定、設立タイミングではない) |
| G-7 | CN102890753A (TRL 自動算定) | Beijing Info Control Inst. | CN | 2013 | 🟢 low (TRL 単軸のみ、タイミング出力なし) |

### 3.6 軸 F: AI 提案 → 人手承認 → version 昇格 governance

| # | 公報 / 文献 | 出願人 | 法域 | 公開年 | 危険度 |
|---|---|---|---|---|---|
| F-1 | **US 10,965,527 B2 — Collaborative configuration changes in blockchain ledger** | Ciena Corp | US | 2021-03 登録 | 🔴 **最高** (4 要素全て揃った唯一の登録特許、ブロックチェーン必須が差別化点) |
| F-2 | US 11,494,703 B2 — ML model registry | Opendoor Labs | US | 2020-2022 登録 | 🟡 medium (acceptance test 自動、AMD の human approval と区別可) |
| F-3 | US 11,972,337 / US 12,437,241 (Opendoor 継続出願) | Opendoor Labs | US | (継続) | 🟡 medium (要 verify) |
| F-4 | US 12,418,417 / US 12,483,411 — Blockchain-based AI agent lifecycle | (未 verify) | US | (要 verify) | 🟡 medium (要 verify) |
| F-5 | US 11,574,234 B2 — Blockchain for data and model governance | (未 verify) | US | (要 verify) | 🟡 medium (要 verify) |
| F-6 | US 2025/0292093 A1 — Human-AI Collaborative Prompt Engineering | Google | US | 2025 公開 | 🟡 medium (プロンプト最適化フォーカス) |
| F-7 | WO 2025/024326 A2 — GenAI for Digital Workflows | (未 verify) | WO | 2025 公開 | 🟡 medium (要 verify) |
| F-8 | Amazon SageMaker Model Registry `PendingManualApproval` (製品仕様) | Amazon | (公知機能) | 2020- | 🟡 medium (周辺特許の有無未確認) |
| F-9 | MLflow Model Registry (Databricks, OSS) | Databricks | (OSS 公知) | 2018- | 🟡 medium (自明性攻撃材料) |
| F-10 | DataRobot Model Deployment Approval Workflow (製品仕様) | DataRobot | (周辺特許多数あり、特定未) | — | 🟡 medium (37 件出願 / 30 件登録、要精査) |
| F-11 | Domino Governance (製品、2024-10 発表) | Domino Data Lab | (製品) | 2024-10 | 🟡 medium (公知文献として強い) |

---

## 4. 公報・文献ハイライト解説 (TOP 6)

### 4.1 FHIR Observation リソース (HL7 規格) — 🔴 最高

**何が近いか**:
- 同一 subject × code に対し、`effectiveDateTime` 付きで複数 Observation が時系列で並ぶ
- **`interpretation` の有限カテゴリ値**: H (high), L (low), N (normal), A (abnormal), etc. が AMD の `valence` ∈ {positive, negative, mixed, neutral, unknown} と機能的に等価
- **`status`**: registered, preliminary, final, amended, corrected, cancelled, entered-in-error, unknown → AMD の `confidence` 様

**AMD への影響**: AMD の `(decision_id, observed_on, horizon, valence, confidence, summary, evidence)` という schema は、医療→意思決定にリマップしただけと審査官に判断される懸念が大。**請求項 5 単独では新規性主張困難**。

**逃がし方**:
- スキーマ単独クレームを諦め、以下の複合クレームに組み直す:
  1. **マネジメント意思決定ドメイン**限定
  2. **horizon ラベルが事前定義された離散集合** (`immediate / 1m / 3m / 6m / 12m / 24m / long_term` の 7 値固定)
  3. **同一 (decision_id, horizon) に複数行が共存** し、**矛盾観測 (positive 1m × negative 24m) を保持したまま意思決定者に呈示する UI/ワークフロー**
  4. **evidence refs** が決定書類・会議録・KPI 等の異種ソースを統合参照する

### 4.2 OMOP CDM OBSERVATION テーブル (OHDSI) — 🔴 最高

**何が近いか**: `OBSERVATION` / `MEASUREMENT` / `CONDITION_OCCURRENCE` は `observation_date` 付きで同一 (person, concept) に対し複数行が共存可能 (append-only 縦断保持)。

**AMD への影響**: FHIR と並ぶ事実上の標準。新規性破壊の最強の引例。

**逃がし方**: 同上 (4.1)。

### 4.3 Ciena US 10,965,527 B2 (2021) — 🔴 最高

**Claim 1 の構造**:
1. AI エージェントが構成変更を提案
2. Supervising agent (人間) が "at least partially acceptable" を判定
3. 承認後、ブロックチェーン台帳にブロックとして追記 (旧バージョン保持、各ブロックは過去全ブロックを暗号化包含)

**AMD への影響**: 「AI 提案 → pending → 人間承認 → 新バージョン保持」の 4 要素が完全に揃った唯一の登録特許。

**差別化ポイント**: (a) ネットワーク機器構成に限定 (b) ブロックチェーン必須

**逃がし方**:
- AMD は対象を「複数異種オブジェクト (LLM プロンプト / スコアリングルール / 抽出ルール / Slack workflow step / config) を統一的に扱う汎用 governance」として書く
- 「**RDB 上の version カラム + pending_proposals テーブル**」という Supabase 通常テーブル実装で、ブロックチェーン必須要件を回避
- 「同一の pending → approve → new_version パターンを 5 種類以上の異種オブジェクトに横断適用するメタ機構」をクレームすれば回避可能性高

### 4.4 Seek AI 米国特許 2 件 (2024-12 登録) — 🔴 high

**何が近いか**: LLM が生成したクエリに人手承認を挟む HITL workflow。2 件目は「任意のデータセット」対象と広く取っており、抽出系 HITL に広範に効く可能性。

**AMD への影響**: HITL × LLM の上位概念クレームが広く効く可能性。

**差別化ポイント**:
- AMD は **「ソースイベント駆動の構造化レコード候補生成」** (Seek AI はクエリ生成)
- **「通知 UI による push 型 yes/no/comment」** (Seek AI は pull 型)
- **「複数業務スキーマ並列出力」** (Seek AI は単一データセット)
- **「承認済みのみがマスタ DB + 下流カスケード」**

**最優先タスク**: USPTO PPUBS で公報番号特定 + Claim 1 全文取得。

### 4.5 BigID 関連特許 (公報番号未 verify) — 🔴 high

**何が近いか**: 「個人データのハッシュ化グラフ表現のみを保持し、原本 (PII 本体) は顧客環境から一切コピーしない」アーキテクチャ。エンタープライズ多データソース横断 + confidence scoring。**思想として AMD に最も近い**。

**AMD への影響**: 「no-copy + hash representation + enterprise multi-source + confidence」の思想が AMD と重なる。

**差別化ポイント**:
- BigID は「PII identity correlation」目的、AMD は「LLM 抽出根拠の証跡」目的
- BigID は **snippet (短縮抽出)** や **source URL / permalink** や **extraction run_id** を中心概念として持っていない
- AMD は LLM 抽出パイプラインに特化、BigID は汎用データ発見プラットフォーム

**逃がし方**: AMD のクレームを「**LLM 抽出ランごとに run_id 単位で、snippet (短縮抜粋、所定長以下) + 原本ハッシュ + permalink + 抽出時 confidence + 抽出日時を 1 レコードとして永続化し、原本本文は一切保持しない**」と書く。

### 4.7 軸 G: Microsoft US 12,315,010 B2 (2025) — 🟡 medium

**Claim 概要**: 企業に関する特徴量から、次のイベント (funding ラウンド / Exit / 廃業) とそのタイミングを同時予測する RNN/GRU テンポラル予測モデル。

**AMD への影響**: 「いつ何が起こるか」を出力する設計思想は AMD と方法論的に重なる。

**AMD 案との差分**:
1. 入力データが Crunchbase 系の **既存法人の財務 / 投資履歴**に限定。「会社が存在する」前提
2. 出力イベントに **「会社設立 (incorporation)」が含まれていない** (Seed / Series A 以降のみ)
3. 応用先は VC 投資判断であり、研究シーズの法人化判断ではない

**逃がし方**: 請求項 12 で「未法人化研究シーズを入力 + incorporation イベントの最適時期を出力」と明記。Microsoft クレームに「founding」が無いため差別化容易。

### 4.8 軸 G: pre-founding 設立タイミング判定の調査結論 (まさ #q1 後)

**まさの仮説 = conditional yes**: 「pre-incorporation 研究シーズに対して法人設立の推奨時点を出力するシステム」を直接クレーム化した先行例は、本スクリーニング範囲内で発見できなかった。

**ただし以下は進歩性審査で「動機づけ (motivation)」として引用される可能性**:
- JST START / NEDO TCP / AIST GAP の人手 Due Diligence プロセス (= AI 化が容易想到と判断されうる)
- ReadyScore.ai / R.A.I.S.E. の post-founding AI 評価 (= 適用先変更が容易想到と判断されうる)
- Microsoft US 12,315,010 のテンポラル予測モデル (= イベント種別変更が容易想到と判断されうる)

**防御線**: 請求項 1-11 のワークフロー / データ構造軸の AND 結合 + 請求項 12 の Before-Zero + 法人設立タイミング判定の組合せで進歩性主張。

### 4.6 IBM US 7,730,005 + HP US 9,299,025 + Microsoft US 12,494,933 + ProMem 2026 (axis D 群) — 🔴 high

**統合的な影響**: 議事録 → 構造抽出 (Microsoft meeting tapestries 2024) + CBR case generalization (HP 2016) + Lessons Learned closed loop (IBM 2010) + 4 要素テンプレート (ProMem arXiv 2601.04463 2026) で、AMD の発明要素 2 のホワイトスペースが狭まりつつある。

**差別化ポイント (組み合わせ)**:
- 4 要素「分岐点 / 判断材料 / アクション / 結果」を抽出するだけでなく、**結果を予測せず後追い記録**する
- **同パターンを protocol_id ハッシュ (sha12(title)) で束ね、cross-project で 1:N 集約**する
- **同一意思決定に対する multi-horizon append-only 結果観測 ledger** と統合

→ いずれか単独では先行があるが、AND 結合 + LLM 抽出パイプラインへの組込みで新規性主張可能。

---

## 5. AMD のホワイトスペース (新規性主張可能領域、改訂版)

軸 A-F の再調査結果を踏まえて、AMD のホワイトスペースを以下に再定義する。

### WS-1: 全文非保存 + 5 タプル証拠メタデータ (snippet + hash + url + run_id + confidence)

- 直接の先行特許は見つからない (BigID は思想接近だが目的・データ構造が異なる)
- 学術文献 (arXiv 2511.17118, 2025-11) が同思想を発表しつつあり、**早期出願が必須**
- 請求項 1 の核に維持

### WS-2: 却下 / コメントが次回 LLM プロンプトに自動注入 (prompt-level 継続学習)

- 直接の登録特許は見つからない (RLHF / DPO は weight 更新型で区別可、ProTeGi は LLM 自己批評型で区別可)
- 学術文献 (IBM Conversational Prompt Engineering arXiv 2408.04560, APOHF arXiv 2405.17346) が新規性破壊リスク → **抽出器スコープ分離 + reject イベント永続化 + 自由文 comment の自然言語ガイダンス化**で差別化
- 「**weight 更新を行わない**」「**LLM 自己批評ではない**」を明示否定的限定として含める

### WS-3 改: multi-horizon append-only 結果観測 ledger + 矛盾観測の同時保持 UI + 異種 evidence 統合参照

- FHIR Observation / OMOP CDM が schema 単独では新規性破壊
- **スキーマ単独ではなくシステム複合クレームに組み直し**:
  1. マネジメント意思決定ドメイン限定
  2. horizon の事前定義離散集合 (7 値固定)
  3. 矛盾観測 (positive 1m × negative 24m) を保持したまま意思決定者に呈示する UI/ワークフロー
  4. 異種 evidence (会議録 / 月次レポート / KPI / 戦略シグナル) 統合参照

### WS-4 改: 固有名詞除去 + 題目ハッシュ + 1:N 事例 + 4 要素構造 + LLM 抽出パイプラインへの組込み

- 個別技術 (匿名化, ハッシュ集約, 意思決定抽出, CBR) はそれぞれ既存
- **1 パイプラインで結合し、4 要素テンプレートに落とし、protocol_id で 1:N 事例集約する具体的データ構造 + LLM 抽出**で新規性
- 「**結果を予測せず後追い記録する**」「**結果を上書きしない**」を独立従属項として明示

### WS-5 改: AI 提案 → pending → 人手承認 → new version 昇格を異種オブジェクトに統一適用

- Ciena US 10,965,527 が 4 要素を網羅 (ブロックチェーン + ネットワーク限定が差別化点)
- **対象を異種オブジェクト (LLM プロンプト / スコアリングルール / 抽出ルール / Slack workflow step / config) に拡張**
- 「**RDB の version カラム + pending_proposals テーブル**」という汎用実装
- 「**統一的 governance を 5 種類以上のオブジェクトに横断適用するメタ機構**」をクレームの中心に置く

### WS-6 新規: Before-Zero (pre-incorporation 研究シーズ) ドメインへの適用 + 法人設立タイミング判定出力 (まさ #q1 後)

- 軸 G で同一クレームの先行例は発見できず
- AMD の独自性は **「未法人化研究シーズを入力 + 法人設立推奨時点を出力」+ 上記 WS-1〜WS-5 の AND 結合**
- 動機づけリスクへの対策: 「Before-Zero 固有の技術的課題 (法人化前なので組織財務データなし / TRL 1-3 段階での評価 / 結果観測が 24m+ の長期 / 評価軸が法人化済 startup と異なる) を解決した」と明細書に詳述
- 請求項 12 として独立クレーム化

---

## 6. 請求項の逃がし方戦略 (改訂版)

### 6.1 請求項 1 (主請求項) — 維持

「全文非保存 + 5 タプル証拠メタ」と「却下/コメント → 次回 LLM プロンプト自動注入」は維持。BigID と Seek AI を意識した補強として:
- 「**所定長以下の抜粋 (例: 200 文字以下)**」を明示
- 「**抽出処理識別子 (run_id) 単位で 1 レコードとして永続化**」を明示
- 「**前記候補データを生成する際に用いる大規模言語モデルへの入力プロンプトに、過去の却下入力又はコメント入力を所定の形式で組み込む**」と書く (「前記後続の」ではなく「前記」で表現することで Seek AI のクエリ生成系と区別)

### 6.2 請求項 3-4 (発明要素 2) — 補強

「固有名詞除去 + 題目ハッシュ + 1:N 事例」を維持し、追加で:
- 「**前記アクションの後に実際に起きた結果は、抽出処理が予測した値ではなく、後発の観測データに基づいて記録される**」を明示 (ProMem 2026 との区別)

### 6.3 請求項 5 (multi-horizon ledger) — 大改訂

スキーマ単独ではなく、システム複合クレームに組み直す:

> 請求項 3 又は 4 の方法において、前記コンピュータは、前記プロトコルデータ又は前記プロジェクト固有事例に紐づくアクション後の結果を、observed_on, horizon (immediate / 1m / 3m / 6m / 12m / 24m / long_term のいずれか), valence (positive / negative / mixed / neutral / unknown のいずれか), confidence, summary, 及び証拠メタデータを含む結果観測データとして append-only に保存し、**同一の (プロトコル識別子, horizon) に対して valence が異なる複数の結果観測データが共存する場合、当該複数の結果観測データを上書きすることなく時系列に並べて意思決定者の確認インターフェースに呈示し**、かつ、**前記証拠メタデータは、会議録、月次レポート、組織内キーパフォーマンス指標、及び戦略シグナルのうち少なくとも二以上の異種ソースからの参照を含む**。

→ FHIR / OMOP との区別: 「**矛盾観測を保持したまま意思決定者に呈示する UI**」 + 「**異種 evidence 統合参照**」が specific limitation。

### 6.4 請求項 6-8 (発明要素 3) — 大改訂

スコアモデルに限定せず、異種オブジェクトに統一適用する形に組み直す:

> 請求項 1 から 5 のいずれかの方法において、前記コンピュータは、
> 1. **大規模言語モデルの入力プロンプト、抽出ルール、判定ルール、設定値、又はスコアリングモデルのうち少なくとも二以上を含む複数種類のシステムパラメータ**に対して、AI が生成した変更候補を pending proposal として保存し、
> 2. 前記 pending proposal を確認インターフェースに提示し、
> 3. **承認入力を受けた場合に限り、当該変更候補を反映した新たなシステムパラメータを新規 version として保存し、過去 version を保持する**、
> 4. 当該複数種類のシステムパラメータに対して、上記 1-3 と**同一の処理パターンを統一的に適用する**。

→ Ciena との区別: 「**5 種類以上のシステムパラメータに統一適用するメタ機構**」 + 「**ブロックチェーンに依存しない RDB version カラム実装**」。

### 6.5 請求項 9 (旧 Cobb-Douglas 言及) — 削除済み

まさ判断によりスコアロジックは特許化対象外。削除済み。

---

## 7. 追加検索式 (弁理士相談前までに実施推奨)

### 7.1 USPTO PPUBS 公報番号 verify (最優先)

- `AN/"Seek AI"` または `IN/Nagy-Sarah AND ABST/(human-in-the-loop)` → Seek AI 2 件の番号特定 + Claim 1 取得
- `assignee:"BigID"` 全件 + Claim 取得
- `assignee:"Glean Technologies"` 全件
- `assignee:"Notion Labs"` 全件
- `assignee:"DataRobot"` 全件 (30 件登録)
- `assignee:"Opendoor"` 継続出願全件

### 7.2 学術文献の精読 (新規性破壊文献としての差分整理)

- arXiv 2408.04560 (IBM Conversational Prompt Engineering)
- arXiv 2405.17346 (APOHF) / 2505.07886 (PLHF)
- arXiv 2601.04463 (ProMem 2026)
- arXiv 2511.17118 (Constant-Size Cryptographic Evidence Structures)
- arXiv 2504.06943 (CBR for LLM Agents review 2025)

### 7.3 医療系 schema 特許の精査 (軸 E)

- `assignee:"Epic Systems"` outcome ledger
- `assignee:"Veeva Systems"` longitudinal
- `assignee:"Medidata Solutions"` endpoint
- `assignee:"Oracle Health"` outcome
- `assignee:"Flatiron Health"` longitudinal

### 7.4 J-PlatPat (前回未踏)

- IPC `G06Q10/10` × `G06F40/30` × 「議事録 抽出 承認」「LLM 抽出 業務 承認」「Slack Notion Gmail 横断 抽出」
- IPC `G06N3/0475` (生成 AI) × 「プロンプト 履歴 承認」「フィードバック プロンプト 抽出」
- 出願人「Stockmark」「ABEJA」「FRONTEO」「AnyTech」「Sansan」「日本マイクロソフト」

### 7.5 EPO Espacenet / WIPO Patentscope

- `IPC=G06Q10/10 AND ("large language model" OR LLM) AND ("human" AND ("approval" OR "review"))`
- `"evidence ledger" AND "LLM"` 全文
- `"prompt registry" AND "approval"` 全文

---

## 8. 弁理士に確認したい論点 (改訂版)

### 高優先

1. **3 要素を 1 出願にまとめるか、基幹出願 (要素 1+2) + 連続/分割出願 (要素 3) に分けるか**
2. **Seek AI 2 件 の Claim 1 全文 verify** をどう進めるか
3. **FHIR Observation / OMOP CDM の公知文献としての扱い** — multi-horizon ledger 請求項をシステム複合クレームに組み直す方向で OK か
4. **Ciena US 10,965,527 との区別** — 「異種オブジェクトに統一適用するメタ機構」を主請求項に置く方向で OK か
5. **BigID 関連特許の Claim verify** + 区別記載

### 中優先

6. 5 生データの列挙を請求項に入れるか、「複数種類の業務データ源」と広く書くか
7. snippet 長さの具体値 (例 200 字以下) をクレームに入れるか、明細書実施例にとどめるか
8. 「却下 / コメントが次回 LLM プロンプトに注入」を独立従属項化 (請求項 1 の最後の要件として組み込み済み、独立化要否確認)
9. 「異種オブジェクトに統一適用 governance」をどの粒度で書くか (5 種類以上を列挙するか「2 種類以上」「複数種類」と広く書くか)

### 低優先

10. AI / LLM を明示するか、一般的な抽出器として書くか
11. 国内優先で先に出して 1 年以内 PCT が良いか (学術公開が進んでいるため早期出願強く推奨)
12. AMD 既存外部公開資料の棚卸し (新規性喪失例外手続きの要否判定)

---

## 9. 残課題 (次の作業単位)

### 必須 (弁理士面談前)

- [ ] USPTO PPUBS で Seek AI 2 件、BigID 全件、Glean 全件、Notion Labs 全件、DataRobot 全件の公報番号 + Claim 1 取得
- [ ] J-PlatPat で日本国内出願人検索 (Stockmark / ABEJA / FRONTEO / AnyTech / Sansan / 日本マイクロソフト)
- [ ] EPO Espacenet で multi-horizon outcome ledger + governance loop 関連
- [ ] 学術文献 5 件 (arXiv 2408.04560 / 2405.17346 / 2601.04463 / 2511.17118 / 2504.06943) の図と要約を AMD 案と比較し、差分整理を文書化
- [ ] AMD 既存外部公開資料の棚卸し (新規性喪失例外手続きの要否判定)
- [ ] 弁理士面談予約 + 提案書 + スクリーニングレポート (md + docx) 共有

### 推奨 (中期)

- [ ] 医療系 schema 特許の精査 (Epic / Veeva / Medidata / Oracle Health / Flatiron Health)
- [ ] MLOps governance 系の精査 (DataRobot 30 件 / Opendoor 継続出願 / Domino / SageMaker)
- [ ] 韓国 KIPRIS / 中国 CNIPA での同種出願精査

---

## 10. 参考 URL (本スクリーニングで参照)

### 軸 A
- https://www.businesswire.com/news/home/20241204361426/en/ (Seek AI press release)
- https://patents.google.com/patent/US20240256582A1/en (Glean)
- https://patents.google.com/patent/US10361981B2/en (Microsoft commitment extraction)
- https://patents.google.com/patent/US12131115/en (IBM meeting summarization)
- https://patents.justia.com/assignee/notion-labs-inc (Notion Labs)
- https://patents.justia.com/assignee/glean-technologies-inc (Glean)

### 軸 B
- https://www.freepatentsonline.com/y2025/0111147.html (Microsoft ProTeGi)
- https://patents.justia.com/patent/20250363380 (Iterative Preference Learning)
- https://patents.google.com/patent/US20250005224A1/en (Industrial automation prompt)
- https://patents.justia.com/patent/20240330579 (Dynamic LLM Prompt Generation)
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12511495 (Training data from GenAI + user feedback)
- https://arxiv.org/pdf/2405.17346 (APOHF)
- https://arxiv.org/html/2505.07886v1 (PLHF)
- https://arxiv.org/html/2408.04560v1 (IBM Conversational Prompt Engineering)
- https://www.microsoft.com/en-us/research/publication/automatic-prompt-optimization-with-gradient-descent-and-beam-search/ (Microsoft ProTeGi research)
- https://arxiv.org/pdf/2603.19935 (Memori)

### 軸 C
- https://patents.google.com/patent/US8576283B1/en (Sensormatic chain of custody)
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9779284 (Conduent ALPR)
- https://patents.google.com/patent/WO2021043144A1/en (Blockchain evidence)
- https://www.prnewswire.com/news-releases/bigid-pioneers-breakthrough-patent-for-identity-aware-ai-to-classify-and-correlate-identity-data-in-privacy-and-security-302033701.html (BigID)
- https://patents.google.com/patent/US8788519B2/en (CAS)
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12443638 (RAG validation)
- https://patents.google.com/patent/US12111859B2/en (Enterprise GenAI architecture)
- https://www.anthropic.com/news/introducing-citations-api (Anthropic Citations API)
- https://arxiv.org/pdf/2511.17118 (Constant-Size Crypto Evidence Structures)

### 軸 D
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12494933 (Microsoft meeting tapestries)
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12475304 (Meeting summarization w/ accuracy)
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12132580 (Interactive meeting tapestries)
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10318636 (Action items via NN)
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10521224 (IBM cross-project software learning)
- https://uspto.report/patent/grant/11,082,310 (ServiceNow multi-instance hash aggregation)
- https://patents.google.com/patent/US9202078B2/en (IBM one-way hash anonymization)
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10614248 (Cross-org anonymization)
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11748639 (CBR cloud service)
- https://arxiv.org/pdf/2601.04463 (ProMem)
- https://arxiv.org/html/2504.06943v1 (CBR for LLM Agents review)
- https://arxiv.org/pdf/2110.05261 (Lessons Learned auto-recall)

### 軸 E
- https://patents.google.com/patent/US20190180372A1/en (Append-only ledger / securities)
- https://patents.google.com/patent/US20210034590A1/en (Ledger-based ML)
- https://patents.google.com/patent/EP3274811A1/en (Multi-segment longitudinal DB)
- https://patents.google.com/patent/US20080065452A1/en (Longitudinal EHR)
- https://patents.justia.com/patent/8380531 (Clinical trial endpoint)
- https://patents.google.com/patent/EP1082693B1/en (Clinical trial data mgmt)
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8533029 (Clinical monitoring w/ time shifting)
- https://patents.google.com/patent/EP2019992A1 (Immutable audit logs)
- https://patents.google.com/patent/US20120094265A1/en (Student performance monitoring)
- https://hl7.org/fhir/R4/observation.html (FHIR Observation)
- https://www.ohdsi.org/web/wiki/doku.php?id=documentation:cdm:single-page (OMOP CDM)

### 軸 F
- https://patents.google.com/patent/US10965527B2/en (Ciena collaborative config blockchain)
- https://patents.google.com/patent/US11494703B2/en (Opendoor ML model registry)
- https://patents.justia.com/patent/20250292093 (Google Human-AI Collaborative Prompt Engineering)
- https://docs.datarobot.com/en/docs/mlops/governance/dep-admin.html (DataRobot)
- https://www.dominodatalab.com/news/domino-launches-domino-governance (Domino Governance)
- https://www.patsnap.com/resources/blog/articles/rlhf-vs-dpo-in-llm-fine-tuning-60-patent-analysis-2/ (PatSnap RLHF analysis)

---

## 11. 改訂履歴

| 日付 | 変更 |
|---|---|
| 2026-05-27 | 初版 (旧 6 領域)。スコアロジック軸 (#1 #2 #3) も含めて調査していたが、まさ判断「スコア値・式・軸は特許化対象外」によりピント外れと判明。破棄。 |
| 2026-05-27 (新版) | ピント修正後の 6 軸 (A-F) で再調査。スコアロジック関連の公報 (CHI Research / 内閣府 SIP / C2X / EQT / CB Insights / arXiv VC scoring 系) を全て除外。最大の発見は FHIR Observation / OMOP CDM が軸 E の schema と同型 (新規性破壊リスク) と Ciena US 10,965,527 が軸 F の 4 要素を網羅 (ブロックチェーン必須が差別化点)。Seek AI 2 件、BigID、Glean、Notion Labs、Microsoft meeting tapestries も要警戒。AMD の請求項 5 と 6-8 は新規性主張を強化するためにシステム複合クレームに組み直す改訂方針を提示。 |
| 2026-05-27 (新版 + 軸 G) | まさ #q1「いつ設立すべきかを判断できるという点は新しいかなと思ったけど、すでにある？」に対応するため、軸 G (Before-Zero / pre-incorporation 研究シーズの法人設立タイミング判定 AI) を追加調査。**結論 conditional yes**: 同一クレームの先行例は発見されず。Microsoft US 12,315,010 B2 (2025) がテンポラル予測モデル方法論で最接近だが対象イベントに incorporation 含まず。ReadyScore.ai / JST START / NEDO TCP / R.A.I.S.E. はいずれも post-founding か 人手か フレームワーク定義。WS-6 (Before-Zero 適用 + 設立タイミング判定出力) を新規ホワイトスペースとして追加、請求項 12 として独立クレーム化を提案。 |
