# Field Knowledge Harvest: Textbook Source Mining

> Date: 2026-06-01 JST
>
> Worker: `Textbook source mining field-knowledge harvest`
>
> Scope: AMD OS local repository docs / scripts / design / manual / public manuscript / BZM source files only. No production DB read/write, no external service write, no local applier `--apply`.
>
> Purpose: 次の本文workerが、AMD OS内に埋もれているBefore Zero実務知を、公開本向けの匿名ケース・問い・判断分岐・プレイブックへ変換できるようにする素材マップ。

## 1. Harvest Summary

今回の発掘で見えた最重要素材は、既存のGAPファンド/VC/CEO論だけではない。AMD OS内には、Before Zeroを一冊の本として厚くするための現場知が次の形で蓄積されている。

| category | public conversion | strongest source families | public risk |
|---|---|---|---|
| 判断分岐と設立タイミング | GO / WAIT / HOLD / NO_GO / RESOURCE_SHIFT の章・チェックリスト | `pwa/bzm/1-4-*`, `8-2-*`, public ch6-7 | 内部PJ名、判断者名、未公開案件 |
| 開示・知財・共同研究・契約順序 | 「外に出す前に守るもの」ケース、pre-disclosure checklist | `pwa/bzm/public-manuscript/04-*`, `pwa/bzm/1-4-*`, patent docs | 法務助言に見える断定、具体出願情報 |
| CEO機能分解 / founder readiness | GAP/VCねじれ、研究者の真正性、補完人材の役割 | `05-gap-vc-ceo-function`, `4-1-frl-*`, founding member extraction | 実名・候補者評価・個人資質の露出 |
| 顧客検証 / PoC / VC接点 | 「反応は評価ではなく信号」ケース、投資家面談前 checklist | public ch4, ch9-10, `1-3-*`, `8-4-*` | 商談ログ、企業名、条件 |
| 失敗・ピボット・仮説修正 | 仮説 / 観測 / 見落とし / 修正 template | public ch10, `1-5-*`, `8-3-*` | 失敗の責任論、特定PJへの連想 |
| 研究機関ERS / 制度・人材・資金 | 機関を「苗床」として読む章、institution self-check | `7-1-ers-*`, `institution_readiness.md`, NIMS install gates | 実機関評価・価格・契約情報 |
| L2 / 通知 / 承認付き学習 | 支援者が暗黙知を育てる方法、human-in-the-loop column | `3-13-l2-textbook-insights`, `notifications.md`, patent proposal | AMD OS宣伝、内部運用語 |
| シーズ探索 / HRL抽出 | 起業前シーズの見つけ方、誰をHRL根拠にするか | `seeds-ingest`, `founding-members-extract`, `frl-grit-resilience-extract` | web_search実装・個人名・DB schema |
| 外部機関導入ゲート | 研究機関にBefore Zero OSを入れる前の合意・権限・データ境界 | `docs/strategy/2026-06-nims-os-installation-gates-pricing.md` | 価格表、相手先、契約・権限設計 |

Public manuscriptへ渡すときの基本方針:

- 固有名・機関名・PJ名・人名は出さず、`ある国立研究機関`, `ある大学`, `ある支援プログラム`, `ある企業候補`, `ある投資家面談` へ変換する。
- 内部語 `AMD`, `AMD OS`, `L2`, `candidate`, `local applier`, `Supabase`, `Vercel`, `司令塔`, `worker`, file path は本文に出さない。
- 本文では「仕組み自慢」ではなく「読者が次の面談で何を聞けるか」に寄せる。
- legal / investment / HR assessment advice に見えないよう、`判断の問い`, `確認観点`, `順序設計` として書く。

## 2. Material Categories

### A. Decision Branches: GO / WAIT / HOLD / NO_GO / RESOURCE_SHIFT

発見したノウハウ:

- Before Zeroの判断は一回で終わらない。`GO`か`NO_GO`だけでは粗く、`WAIT`, `HOLD`, `RESOURCE_SHIFT`を持つことで「進めない理由」と「次に下げる不確実性」が分かれる。
- `WAIT`は停止ではなく、技術検証、知財整理、顧客検証、CEO候補探索、大学側手続きなどを進めるための前向きな判断にできる。
- `HOLD`は情報不足。追加ヒアリング、専門家確認、契約確認、研究者意思確認が必要な状態として、放置と区別する。
- `RESOURCE_SHIFT`は、会社化そのものではなく、低い軸へ資源を寄せる判断。例: 技術検証へ寄せる、CEO候補探索を厚くする、大学側知財整理を先にする。

Public case conversion:

- Composite case: 「良い技術と関心ある投資家はいるが、出願とCEO機能が未整理なため、会社化GOではなくWAIT + CEO機能分解 + pre-disclosure設計にしたケース」
- Checklist: `判断 / 判断前の問い / 見た根拠 / 主な律速 / 次に見る条件 / 観測後の見直し予定`
- Hook: 「待つことは後退ではない。戻る条件のないWAITだけが、先送りになる。」

Chapter mapping:

- Ch6 `会社化は早すぎても、遅すぎても壊れる`
- Ch7 `いま会社にするべきか、待つべきか、しないべきか`
- Ch19 `統合スコアと律速軸`
- Ch23 `Decision branch checklist`

### B. Disclosure / IP / Collaboration Order

発見したノウハウ:

- 開示は「出す/出さない」ではなく、`何を / 誰に / どの順番で / どの範囲まで` の設計問題。
- 守るものは知財だけではない。論文、共同研究先との信頼、研究者の納得、大学側の手続き、企業候補との検証速度も守る対象。
- 企業ヒアリングでは、公開情報だけで話せる層、秘密保持の前提で話す層、まだ話さない層を分けると、顧客学習と知財保護を両立しやすい。
- 投資家面談は判定の場であると同時に、未整理論点を照らす設計の場にもできる。
- 発表資料は外に出る速度が速く、事実/仮説、公開/限定の線引きが必要。

Public case conversion:

- Composite scene: 「顧客に聞きたいが、出願前の中核データを出せない研究チーム。公開情報、NDA前提、非開示の三層に資料を分け、企業には課題と検証条件だけを聞く」
- Tool: `pre-disclosure review sheet`
  - 出願状況
  - 論文・学会・プレス予定
  - 共同研究先・第三者情報
  - 面談相手と目的
  - 使う資料の公開範囲
  - 研究者本人の納得

Chapter mapping:

- Ch4 `外に出す前に、守るものを決める`
- Ch9 `リスク資本に会う前に証明すること`
- Ch22 `Before Zero interview questions`
- Ch25 `Relationship playbook`

Internal-only caution:

- Patent consultation docs contain useful framing, but public manuscript must not expose claim strategy, prior-art strategy, patentability judgments, or specific legal positioning. Use only the abstract lesson: "score formulas are less defensible as proprietary claims than the evidence-backed human approval workflow."

### C. CEO Function Decomposition / FRL

発見したノウハウ:

- GAPファンドでは研究者に起業家らしい発表を求め、VC局面では外部CEOを求めることがある。このねじれは研究者の主体性と信頼を削る。
- `研究者CEOか外部CEOか` は粗すぎる。先に分解すべきなのはCEO機能。
- CEO機能には、技術の意味を語る、社会に出す理由を語る、顧客課題を読む、不確実性の中で決め続ける、資金調達、採用、契約/知財/管理実務、大学/企業/投資家/行政の期待調整、研究者の夢を中心に残す、などがある。
- 研究者の真正性は会社の推進力になりうるが、経営実務は補完可能な能力として切り分ける必要がある。
- FRLは `F_character` と `F_capability` を分けると、研究者の非委譲な資質と、COO/CFO/BD/EIR/支援者が補える実行力を同時に扱える。

Public case conversion:

- Composite scene: 「研究者は技術の意味を語れるが、資金調達・採用・契約実務は未経験。外部CEOを入れる前に、研究者が担う機能、経営人材が担う機能、支援者が一時的に補う機能を一枚に分ける」
- Worksheet: `CEO function map`
  - non-delegable: 技術の意味、社会に出す理由、重要技術判断、研究者コミュニティとの信頼
  - delegable/complementable: 資金調達実務、採用、管理、資本政策、契約交渉、事業開発
  - institution-owned: 知財、利益相反、研究継続、共同研究整理
  - still-empty: 誰も担っていない機能

Chapter mapping:

- Ch5 `GAPファンドとVCのあいだで、CEO機能がねじれる`
- Ch8 `誰が何を背負うのか`
- Ch13 `創業者を見るとは、人を見るだけではない`
- Ch18 `FRL: 創業者機能を分解する`

Internal-only caution:

- `founding-members-extract` and `frl-grit-resilience-extract` encode sensitive person-evaluation logic. Public manuscript can use the category lesson ("VC/customer/government are not HRL members; university PI can be key if committed") but must not expose individual scoring, prompts, or named examples.

### D. Customer / PoC / VC Signals

発見したノウハウ:

- 「面白いですね」は顧客検証ではない。見るべきものは、課題の深さ、代替手段、支払い主体、検証順序、意思決定者、予算化経路。
- VC feedback is not a verdict. It can be a signal that BRL, HRL, FRL, GRL, or timing is underdeveloped.
- PoC conditions must be designed before excitement hardens into vague collaboration.
- 企業候補との関係では、最初から大型契約条件ではなく、何を検証するか、どのデータを使えるか、誰が意思決定者かを先に握る。

Public case conversion:

- Composite scene: 「大企業の探索部門は好反応だったが、現場の痛み・予算・検証条件が出てこない。次回は意思決定者と現場担当を分けて聞く」
- Checklist: `before VC readiness`
  - 顧客課題が検証可能か
  - 資金で下げる不確実性が明確か
  - CEO機能の空白を説明できるか
  - 開示範囲が整っているか
  - 大学側の権利/契約が投資対話に耐えるか

Chapter mapping:

- Ch1 `研究成果は、熱意だけでは会社にならない`
- Ch9 `リスク資本に会う前に証明すること`
- Ch10 `関係を壊さず、学習に変える`
- Ch24 `Failure-learning template`

### E. Failure Learning / Pivot / Hypothesis Revision

発見したノウハウ:

- Before Zeroの失敗を責任論だけで読むと、次に使えない。
- 失敗は `仮説 / 観測 / 見落とし / 修正` に分けると学習になる。
- 企業ヒアリング失敗、VC拒絶、大学手続き停滞、研究者の距離、外部CEO候補との不一致は、それぞれ別の低い軸を示す信号になりうる。
- 支援者自身も仮説を外す。支援者が見立てを更新できるかが、次の研究者を守る。

Public case conversion:

- Template:
  - 起きたこと
  - 当初の仮説
  - 実際の観測
  - 見落とした信号
  - 修正した問い
  - 次回の赤信号
- Case seed: 「外部CEO候補は経営経験があったが、研究者の技術観を理解せず信頼形成に失敗した。次回は経歴だけでなく、研究者との対話、技術理解、役割境界を先に見る」

Chapter mapping:

- Ch10 `関係を壊さず、学習に変える`
- Ch20 `過去ケースで確かめる`
- Ch24 `Failure-learning template`
- Ch26 `Anonymized case patterns`

### F. Institution Readiness / ERS / Nursery Layer

発見したノウハウ:

- ベンチャー個体と研究機関の苗床は別レイヤー。個体のAMD Score的な乗法評価と、機関のERS的な充足率評価を混ぜない。
- ERSは「何が欠けているか」を見せるため、欠損が潰れない加重和が向いている。
- 研究機関を見る軸は、シーズ発掘、知財/TLO、インキュベーション、産学連携、資金、EIR/CXO、規程/ガバナンス、政策連携。
- `unknown` と `not_started` を混ぜない。未確認はヒアリングTODO、未整備は支援ギャップ。
- 認定制度、称号使用、知財利用、支援申請、利益相反、兼業、株式/SO/IP-equityなどは、Before Zeroの制度面の厚いケース素材になる。

Public case conversion:

- Composite case: 「個別シーズは強いが、機関側にEIR制度・知財移転・起業前資金・兼業整理がなく、研究者が一人で背負っている研究機関」
- Tool: `institution nursery self-check`
  - 事業化目利きURAはいるか
  - 出願/ライセンス/共同研究の順序を扱えるか
  - GAP/PoC資金はあるか
  - 外部CEO/CXO/EIRを供給できるか
  - 教員の経営参画や利益相反の運用があるか
  - 産業・自治体・政府との接続はあるか

Chapter mapping:

- Ch14 `苗床としての研究機関を見る`
- Ch21 `ERS: 研究機関の整備度`
- Ch25 `Relationship playbook`
- Ch26 `Anonymized case patterns`

Internal-only caution:

- NIMS/KUTE/Kagawa/Ehime/Tokyo Tech style specifics, pricing hypotheses, contract terms, named preparation owners, tenant/RLS design, and private institution scores are `internal_only`. Public manuscript should use "a national research institute", "a regional university", "a private university", etc.

### G. L2 / Notification / Human Approval Loop As Learning System

発見したノウハウ:

- AMD OSには、5生データからL2候補を作り、人間がyes/no/commentで承認し、次回抽出へfeedbackを戻す閉ループがある。
- Textbook Insightsは、Before Zero実務知を `decision_branch`, `failure_learning`, `cross_project_pattern`, `theory_case`, `reusable_question`, `relationship_playbook`, `field_transition` に分けて扱う。
- `confidentiality='internal_only'` は自動追記しない。`sanitized` / `publishable` だけが本文素材になりうる。
- BZM理論に影響する候補はTextbookだけで通さず、BZM review gateを通す。
- raw全文を保存せず、short snippet / hash / source metadata に留める思想は、公開本の「関係を壊さず学習する」方法論にも変換できる。

Public case conversion:

- Column idea: `暗黙知は、会議録の山ではなく、承認された問いとして残す`
- Public framing: "A support team needs a memory loop: observed event -> candidate lesson -> human review -> reusable question -> later validation."
- Tool: `field note to reusable question`
  - raw observation
  - candidate lesson
  - confidentiality
  - reusable question
  - theory impact
  - next validation

Chapter mapping:

- Ch10 `関係を壊さず、学習に変える`
- Ch24 `Failure-learning template`
- Ch26 `Anonymized case patterns`
- Afterword / methodology note

Internal-only caution:

- Do not expose DB table names, scripts, outbox path, automation names, or notification implementation in reader-facing body. A methodology appendix may mention "human-reviewed field-note workflow" after editorial approval.

### H. Seed Discovery / Before Zero Entry Funnel

発見したノウハウ:

- 公的採択情報、GAPファンド、NEDO/AMED/JSTなどは、法人化前シーズの入口として使える。
- シーズ探索では既に法人化済み大型調達ではなく、起業前段階の研究シーズを拾う。
- ただし公式一次情報に限定し、X/Twitter単独投稿や推測は入れない。
- `researcher_name + title` の重複、公式採択リスト、研究者/機関/分野/TRL/BRL/HRL初期仮説の構造化は、Before Zeroの入口章に使える。

Public case conversion:

- Column idea: `シーズはニュースではなく、未解決の問いとして拾う`
- Checklist: `seed discovery first pass`
  - 公式採択情報か
  - 起業前か
  - 技術と応用先が説明できるか
  - 代表研究者・機関・資金プログラムが分かるか
  - TRL/BRL/HRLは仮置きできるか
  - contact before disclosureの注意があるか

Chapter mapping:

- Ch1 `研究成果は、熱意だけでは会社にならない`
- Ch2 `関係者は同じ技術を見て、別の時計で動いている`
- Ch22 `Before Zero interview questions`

Internal-only caution:

- The actual web-search cron, prompts, and DB insert path are implementation detail. Public text should describe the practice, not the automation.

### I. External Institution Installation Gates

発見したノウハウ:

- 研究機関に事業化判断OSを導入する前に、日付ではなく開始ゲートを合意する必要がある。
- 重要ゲートは、内部運用安定、最小ユースケース、データ分離、外部ユーザー権限、契約/データ利用、月次レビュー運用、オンボーディング、事故対応。
- Pilot scopeを絞ることが大切。全研究者・全シーズ・全内部データの初期取り込みは避ける。
- 次機関展開は、月次レビュー2-3サイクル、対象シーズ複数、支援負荷低下、権限事故ゼロ、導入キット化などを条件にする。

Public case conversion:

- Composite case: 「研究機関がBefore Zero支援の仕組みを入れたいと言ったとき、最初に全学DXへ広げず、3-5シーズ・月次レビュー・ERSギャップ確認に絞った」
- Tool: `institution pilot gate`
  - purpose
  - target users
  - target seeds
  - data boundary
  - monthly review cadence
  - authority / approval path
  - accident response
  - expansion condition

Chapter mapping:

- Ch14 `苗床としての研究機関を見る`
- Ch21 `ERS`
- Ch25 `Relationship playbook`
- New proposed chapter: `研究機関にBefore Zeroの仕組みを入れる前に`

Internal-only caution:

- Pricing, named institutions, named people, contract details, and FY revenue assumptions stay internal. Public manuscript can use only the generalized "pilot gate before expansion" pattern.

## 3. Chapter Injection Map

| public chapter | material to inject | source category | output form |
|---|---|---|---|
| Prologue | "会社になる前に勝負が決まる" opening with no company subject | A, B, C | short composite scene |
| Ch1 | good technology / unclear first customer / seed discovery | D, H | scene + first questions |
| Ch2 | different actor clocks: researcher, university, company, VC, government, IP | A, B, F | actor-clock map |
| Ch3 | support systems can isolate researcher | C, F | GAP/VC/support-local-optimization scene |
| Ch4 | pre-disclosure design | B | checklist + scene |
| Ch5 | CEO function decomposition | C | worksheet |
| Ch6 | incorporation timing | A | GO/WAIT/HOLD/NO_GO/RESOURCE_SHIFT table |
| Ch7 | first-pass decision conversation | A | decision log template |
| Ch8 | who carries what | C, F | role decomposition worksheet |
| Ch9 | before risk capital | D | investor pre-readiness checklist |
| Ch10 | failure learning | E, G | hypothesis/observation/missed signal template |
| Ch11 | macro tailwinds | A, D | timing-gap mini cases |
| Ch12 | readiness axes | B, D, F | field examples by XRL axis |
| Ch13 | founder readiness | C | non-delegable vs complementable examples |
| Ch14 | institution as nursery | F, I | ERS self-check |
| Ch15 | readiness vs valuation | A, D, G | warning column: score is decision aid |
| Ch16 | Triple Helix | A, H | policy/industry/research timing mini cases |
| Ch17 | XRL | B, D, F | 0-9 public anchors |
| Ch18 | FRL | C | F_character / F_capability public explanation |
| Ch19 | integrated score and bottleneck | A | bottleneck next-action explanation |
| Ch20 | retrofit validation | E | anonymized timeline validation cases |
| Ch21 | ERS | F, I | institution self-diagnostic tool |
| Ch22 | interview questions | B, C, D, H | question bank by audience |
| Ch23 | decision branch checklist | A | template |
| Ch24 | failure-learning template | E, G | template + example |
| Ch25 | relationship playbook | B, C, D, F, I | stakeholder playbook |
| Ch26 | anonymized case patterns | A-I | composite cases |

## 4. Proposed Additions To Solve "Content Volume" Problem

### Add New Chapters / Sections

1. **研究者の夢を壊さず、会社の形へ移す**
   - Why: The current manuscript has CEO-function material, but a richer chapter can focus on researcher identity, dream, paper/lab/student constraints, and trust.
   - Sources: Stapa notes, public ch5, public ch10, FRL.

2. **顧客検証は、面白いと言われることではない**
   - Why: BRL needs more vivid public cases.
   - Sources: public ch4/ch9/ch10, `1-3`, `8-4`.

3. **研究機関の制度が、会社化の速度を決める**
   - Why: ERS material is deep enough for a standalone field chapter before the formal ERS theory chapter.
   - Sources: `institution_readiness.md`, NIMS install gates, ERS chapter.

4. **Before Zero Pilot Gate: 研究機関に仕組みを入れる前に**
   - Why: External institution rollout docs contain a reusable playbook for URA/EIR support systems.
   - Sources: NIMS install gates and pricing hypothesis, but publish only generalized gate.

5. **暗黙知を問いとして残す**
   - Why: L2/Textbook Insights workflow can become a public methodology note for learning organizations without becoming an AMD OS brochure.
   - Sources: L2⑩ spec, notifications, patent workflow docs.

### Add Columns

- `Column: WAIT is work`
  - WAITの間に進めるべき技術検証、知財、顧客、CEO候補、大学手続き。
- `Column: Three disclosure layers`
  - public / NDA-needed / do-not-disclose-yet.
- `Column: A VC no is not one signal`
  - rejection can mean BRL, HRL, FRL, GRL, timing, or thesis mismatch.
- `Column: Unknown is not Not Started`
  - ERSの `unknown` と `not_started` の違いを、機関ヒアリングの読み方にする。
- `Column: Do not turn a researcher into a mascot`
  - 研究者の真正性を会社中心に残すが、経営実務を一人へ押し込まない。

### Add Checklists / Tools

- Pre-disclosure review sheet
- CEO function map
- GO / WAIT / HOLD / NO_GO / RESOURCE_SHIFT decision log
- VC pre-readiness checklist
- Failure-learning template
- Institution nursery self-check
- Institution pilot gate
- Seed discovery first-pass sheet
- Field note to reusable question conversion sheet

## 5. Hook Candidates

1. `会社になる前に、会社の失敗は始まっている。`
2. `研究成果は強いのに、誰もまだ会社の時計を持っていない。`
3. `待つことは後退ではない。戻る条件のないWAITだけが、先送りになる。`
4. `CEOを決める前に、CEO機能を分ける。`
5. `開示は勇気ではなく、順番の設計である。`
6. `「面白いですね」は顧客検証ではない。`
7. `投資家のNOは、研究成果への判決ではなく、未整理論点への光かもしれない。`
8. `研究機関は、会社の外側にある環境ではなく、会社が生まれる苗床である。`
9. `失敗を責任論で閉じると、次の研究者を守れない。`
10. `Unknownと未整備を混ぜると、支援は空回りする。`

## 6. Public / Internal Classification

### public_ready / light rewrite

- Public manuscript ch4-10 material around disclosure, CEO function, incorporation timing, decision words, and failure learning.
- BZM source `1-3`, `1-4`, `1-5`, `1-6` when rewritten to remove internal subject and formula-first language.
- ERS concept of institution as nursery, after removing named institutions and service-selling tone.

### public_rewrite

- L2⑩ categories and learning loop: useful as methodology, but must be stripped of DB/script/automation language.
- Patent proposal workflow: useful as "evidence-backed human approval loop", but patent strategy stays out.
- Founding member / HRL extraction rules: useful as role-boundary concept, but prompts and person-evaluation details stay out.
- Seeds ingest: useful as seed discovery practice, but implementation details stay out.
- External institution install gates: useful as pilot gate, but named institution/pricing/contract data removed.

### internal_only

- Specific institution names, named people, preparation owners, pricing hypotheses, FY revenue assumptions, contract structure, tenant/RLS design.
- Any production DB row, source URL/permalink, meeting transcript, Gmail/Slack/Notion raw content, private snippets, candidate IDs, local applier markers.
- Patent claim strategy, prior-art risk scoring, legal advice-like conclusions.
- FRL individual scoring, ALQ/Grit/Resilience extraction outputs for real people.
- Internal automation names, script paths, outbox paths, schema details, service-role behavior.

## 7. Missing Information / Additional Research Needed

| need | why | suggested next research |
|---|---|---|
| More publishable customer-validation cases | BRL chapters need stronger scenes than "interesting reaction" | Mine public-safe monthly report summaries or ask for 2-3 anonymized cases |
| WAIT decisions with later outcome | WAIT must feel active, not avoidance | Find cases where delayed incorporation improved outcome |
| External CEO fit / misfit anonymized cases | CEO function chapter needs both success and failure | Mine meeting summaries after explicit approval or ask Masa for sanitized examples |
| Institution type variants | ERS should cover university, national lab, private university differences | Create three composite institution personas |
| Regulatory/social acceptance examples | GRL/SRL chapters need more vivid public material | Use public cases, not internal DB |
| Public legal/IP caveats | Disclosure chapter must avoid legal advice tone | Add editorial caveat and maybe external source review later |
| Theory math placement | BZM theory chapters may be too technical for commercial book | Decide main text vs appendix split |
| Reader-facing case permission | Some internal cases may be powerful but risky | Editorial decision: composite only vs named public cases |

## 8. Next Manuscript Worker Instructions

1. Start from this harvest plus `PUBLICATION_POSITIONING.md`; do not write AMD/Team ARMADA/Masa as protagonist.
2. For 00-06 rewrite, use A-C as the main expansion source:
   - Prologue: hook from decision-before-company.
   - Ch4: use disclosure three-layer checklist.
   - Ch5: promote CEO function map, not researcher/external CEO binary.
   - Ch6: make WAIT/HOLD/RESOURCE_SHIFT concrete.
3. For 07-14 expansion, use D-F:
   - Ch9 needs VC feedback as signal, not verdict.
   - Ch10 needs the failure-learning template.
   - Ch14 needs ERS self-check and `unknown != not_started`.
4. For 15-21 theory chapters, write field-first mini scenes before formulas:
   - XRL axes each need a public example.
   - FRL should explain non-delegable vs complementable functions before CES/math.
   - ERS should emphasize support gaps, not institution ranking.
5. For tools/cases/checklists, draft standalone artifacts:
   - pre-disclosure sheet
   - CEO function map
   - decision branch log
   - VC pre-readiness sheet
   - failure-learning template
   - institution nursery self-check
6. Keep `internal_only` material out of public body. If a case cannot be anonymized without losing meaning, mark it as `internal_only` and use only its pattern.
7. Run forbidden-term scan after drafting. Watch especially for internal words: `AMD`, `Team ARMADA`, `まさ`, `L2`, `candidate`, `local applier`, `Supabase`, `Vercel`, `pwa/`, `/spec`, `正本`, `司令塔`, `worker`.
8. End each chapter with reader-usable questions, not a summary of internal operations.

## 9. Validation Notes

- Source read was local repo/docs/scripts only.
- No production DB connection was used.
- No DB write, external service write, or local applier `--apply` was executed.
- Internal/public classification is included in section 6.
- This file is an internal editorial artifact, not reader-facing copy.
