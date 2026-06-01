# Textbook Source Mining Case Bank v2

> Date: 2026-06-01 JST
>
> Worker: `Textbook source mining case bank v2`
>
> Purpose: 公開本文そのものではなく、次の本文workerが使うための `case bank / scene bank / tool bank / theory bridge`。本文化時は `PUBLICATION_POSITIONING.md` を必ず優先し、公開本文では内部語・会社名・人名・path・event名を落とす。

## 0. Executive Use

このv2の結論は、公開本の厚みは「GAP/VC/CEOねじれ」だけでは足りない、ということ。

次の本文workerは、中心ケースを1本に固定せず、以下の5つのcomposite caseを繰り返し変形して使うとよい。

1. 研究者CEOねじれ
2. 開示順序事故寸前
3. 企業PoC誤読
4. 制度採択後の孤立
5. 研究機関の苗床不足

特に Chapter 15-21 の理論field-first化では、変数名や数式から入らず、先に「現場で何が起きるか」を置く。TRL/BRL/GRL/SRL/HRL、FRL、sigma_SU、AMD Score相当、ERSのすべてに、読者が見たことのある場面を対応させる。

## 1. 調査ソースと抽出方法

| source | used? | usable reason | unusable / caution |
|---|---:|---|---|
| `pwa/bzm/textbook/PUBLICATION_POSITIONING.md` | yes | 公開本文の主人公・禁止語・語り手位置のgate。case bankの公開化ルールに使える。 | 本文素材ではなく編集ルール。 |
| `pwa/bzm/textbook/PUBLICATION_STRATEGY.md` | yes | 販売本の章構成、public/internal split、Part 5-7への接続が明確。 | 市場調査リンクや内部strategy文体は本文へ直入れしない。 |
| `pwa/bzm/textbook/COMMANDER_TASKS.md` | yes | 未完タスク、Stapa素材の残課題、15-21理論field-first化の優先度確認に使える。 | 司令塔運用語は公開本文では internal_only。 |
| `origin/codex/textbook-public-manuscript-00-06-editorial-integration` run note | yes | 00-06のcase zero、三文書 tension、GO/WAIT/HOLD table、semantic-order debtを把握。 | branch noteなので本文へは出典として出さない。 |
| `origin/codex/textbook-field-knowledge-harvest` run note | yes | A-Iカテゴリ、chapter injection map、classificationの土台。v2では粒度をscene/tool単位へ増補。 | 既にある論点リストなので、v2ではそのまま再掲せず具体場面へ展開。 |
| `origin/codex/textbook-editorial-page-turner-audit` run note | yes | scene-first、recurring case、chapter ending bridge、reader pathwaysの品質基準。 | 内部批評文体は公開本文に出さない。 |
| `pwa/bzm/public-manuscript/00-14` | yes | 現行本文の論点、繰り返し、足りない場面を確認。 | `明日使える問い`型の終わりはpage-turnerとして弱い。後続でbridge型へ置換。 |
| `pwa/bzm/1-3`, `1-4`, `1-5`, `1-6` | yes | 現場の鬼門、判断分岐、関係学習、理論変数への翻訳に使える。 | AMD視点・内部語を公開本文から落とす必要あり。 |
| `pwa/bzm/3-1`, `4-1`, `5-1`, `7-1`, `9-4` | yes | XRL/FRL/統合score/ERSの理論側source。15-21 bridgeの核。 | 数式・内部例題から入ると読者が離れる。field-first化必須。 |
| `pwa/spec/3-13-l2-textbook-insights-current-spec.md` | yes | `decision_branch`, `failure_learning`, `relationship_playbook` などの分類をtool bankに転用。 | DB table、candidate、local applier、通知実装は公開本文では internal_only。 |
| `pwa/design/institution_readiness.md` | yes | ERS 8軸、unknown/not_started、制度比較、苗床不足caseに使える。 | 実機関名や内部評価は出さない。 |
| `docs/strategy/2026-06-nims-os-installation-gates-pricing.md` | yes | 研究機関pilot gate、データ境界、月次レビュー、拡張条件を一般化できる。 | NIMS、価格、個人名、契約条件、FY売上仮説は internal_only。 |
| `/Users/masa/projects/AMD/AMD/stapa/イベントの文字起こし.docx` | yes | 研究者理解、設立前DD 6-9か月、支援制度増加と孤立、GAP/VC/CEO、つくば地域の人材・資金不足、PoC地域実証の素材。 | event名、登壇者名、会社紹介、実績数字、固有地域の断定は公開本文でぼかす。 |

### DOCX extraction note

- `python-docx` はこのworktree環境に無かったため、`docx` をzipとして開き、`word/document.xml` の `w:t` を `xml.etree.ElementTree` で抽出した。
- 抽出結果: 827 paragraphs / 46,859 chars。
- 重点確認範囲:
  - paragraphs 220-305: 研究者理解、設立前DD 6-9か月、支援制度増加と研究者孤立、GAP/VC/CEOねじれ。
  - paragraphs 480-505: 初回面談前の論文読み込み、研究者本人へ直接行く前の産連/URA順序。
  - paragraphs 590-640: 地域に研究者はいるが経営者が足りない、研究者の中のCEO機能、authenticity。
  - paragraphs 720-755: 地域として足りない人と金、医療系PoCの地域内実証可能性。

## 2. public_ready / public_rewrite / internal_only

Classification keywords for validation: `public_ready / public_rewrite / internal_only`.

### public_ready

そのまま、または軽い匿名化で公開本文に使える素材。

- 「待つことは後退ではない。戻る条件のないWAITだけが先送りになる」
- 研究成果・論文を「研究者が長い時間をかけて育てたもの」と見る初回関係構築。
- 公開情報 / NDA前提 / まだ話さない情報の三層開示。
- 「面白いですね」を顧客検証と誤読しない企業ヒアリング。
- 会社設立前に、VC対話、知財ライセンス、株式シェア、登記事項、管理体制の準備を進める。
- 研究者の真正性をCEO機能の一部として扱い、経営実務と分ける。
- 研究機関を背景でなく「苗床」として見る。
- unknown と not_started を分ける。未確認はTODO、未整備は支援ギャップ。

### public_rewrite

価値は高いが、公開本文では内部語・実名・会社紹介を落とす必要がある素材。

- Stapa transcriptの会社紹介・実績説明。公開本文では「あるスタジオ型支援者の現場観察」ではなく、さらに一般化して「事業化支援の現場では」に変換。
- AMD OS / score / protocol / L2 workflow。公開本文では「field noteを問いとして残す仕組み」へ変換。
- NIMS導入gate。公開本文では「研究機関にBefore Zero支援の仕組みを入れる前のpilot gate」へ変換。
- FRLのALQ/Grit/Resilience/CES。公開本文では「委ねられない資質」と「補える経営実行力」の場面から入り、数式は後半かappendix。
- ERSの8軸rubric。公開本文では「支援メニューの数ではなく、責任pipelineを見る」へ変換。

### internal_only

公開本文へそのまま渡さない素材。

- AMD / Team ARMADA / 株式会社チームアルマダ / まさ / 登壇者名 / event名 / internal thread / worker / 司令塔 / branch / path。
- 実績数字、売上・価格・FY計画、契約条件、特定機関の準備責任者、NIMS/KUTE/香川大などの内部評価。
- DB schema、Supabase、Vercel、local applier、candidate IDs、source hash、notification実装。
- 個人評価・FRL実測・HRL抽出・ALQ/Grit/Resilienceの実個人スコア。
- 特許 claim strategy、prior-art評価、法務助言に見える具体判断。
- raw transcriptの長文引用。公開本文では必ずcomposite化する。

## 3. composite case bank 5本

### Case 1: 研究者CEOねじれ

**public status:** public_ready after anonymization

**Source families:** Stapa paragraphs 292-303, `pwa/bzm/1-3`, `1-4`, public Ch5/8/13, FRL chapter.

**Core scene:** ある研究者は、助成プログラムの二次面接に進む。これまで論文発表しかしてこなかった人が、突然、顧客、市場、成長、資金使途を語るピッチを求められる。支援者は懸命に資料を整え、研究者も少しずつ「起業家らしく」話せるようになる。部屋では評価される。ところが、その後の投資家面談では「この先生が経営するのは難しい。外部の経営者を連れてきた方がよい」と言われる。

**Tension:** 同じ支援の流れの中で、研究者は一方では前に出るよう訓練され、もう一方では退くよう求められる。どちらの部屋も合理的だが、研究者には「自分の研究を自分で語れと言われた直後に、自分は会社の中心ではないと言われた」ように響く。

**Diagnosis:** 問題は研究者CEOか外部CEOかの二択ではない。未分解なのはCEO機能である。技術の意味、社会に出す理由、研究として守る線、資金調達、採用、契約、管理、投資家対応、大学との調整のうち、誰が何を担うのかが見えていない。

**Tool insertion:** CEO function map / non-delegable vs complementable / role vacancy table。

**Theory bridge:** FRL。F_characterは研究者の真正性、技術への愛、信頼の中心。F_capabilityは経営実務・調達・採用・管理で補完可能。HRLはチーム機能。ERSは外部CEO/CXO/EIR供給。

**Chapter map:** 00-06 center case, 07-14 role worksheet, 15-21 FRL field-first.

### Case 2: 開示順序事故寸前

**public status:** public_ready after anonymization

**Source families:** public Ch4, `pwa/bzm/1-4`, `1-6`, Stapa paragraphs 238-250, 480-498.

**Core scene:** 研究チームに企業候補との面談が入る。支援者は、技術の魅力を伝えるためにスライドを厚くしたい。研究者は、論文投稿前のデータと出願前の実施条件が混ざることを不安に思っている。大学側は、共同研究先の情報や発明届の順序をまだ確認していない。投資家向けの資料も並行して作られ、同じ図が複数の相手に渡りそうになっている。

**Tension:** 外に出なければ顧客学習は進まない。しかし、出し方を間違えると、知財、論文、共同研究、研究者との信頼が同時に傷つく。

**Diagnosis:** 開示は「勇気」ではなく順番の設計である。公開情報、秘密保持前提、まだ話さない情報を分ける。面談の目的ごとに資料を変える。研究者本人がどこまで話すことに同意しているかを確認する。

**Tool insertion:** pre-disclosure sheet / three disclosure layers / meeting-purpose × disclosure matrix。

**Theory bridge:** GRLは知財・規制・契約の順序、BRLは顧客学習、ERSはTLO/産学連携/共同研究処理能力。

**Chapter map:** 04/05 disclosure chapter, 09 before risk capital, 17 XRL, 21 ERS, 22 interview questions.

### Case 3: 企業PoC誤読

**public status:** public_ready after anonymization

**Source families:** public Ch1/9/10, `pwa/bzm/1-3`, `1-5`, Stapa paragraph 752.

**Core scene:** 大企業の探索部門が「面白いですね」と言う。支援者はPoCに進めそうだと感じる。だが次の面談で、相手は予算部署ではなく、現場の痛みも具体化されない。評価条件、導入時の制約、意思決定者、既存代替手段、誰が失敗を引き受けるのかが空白のままである。

**Tension:** 好反応はある。だが、好反応は顧客検証ではない。PoCという言葉だけが先に出ると、何を検証するのかが曖昧なまま契約・開示・期待が進む。

**Diagnosis:** 企業候補が最初に背負えるのは、関心ではなく検証条件である。どの現場で困っているのか、既存手段では何が足りないのか、どの条件が満たされれば次へ進むのか、誰が評価するのかを切り出す。

**Tool insertion:** PoC readiness sheet / interesting-to-commitment ladder / customer signal translation table。

**Theory bridge:** BRL。顧客課題、支払い主体、検証順序、予算化経路をBRLの証拠として置く。TRLが強くてもBRLが低いと、会社化の次アクションはPoC契約ではなく課題検証になる。

**Chapter map:** 01 false acceleration, 09 risk capital, 10 failure learning, 17 XRL, 19 bottleneck.

### Case 4: 制度採択後の孤立

**public status:** public_ready after anonymization

**Source families:** Stapa paragraphs 276-290, public Ch3, `pwa/bzm/1-3`, editorial audit.

**Core scene:** 研究者の周囲には、URA、EIR、アクセラレーター、助成金、補助金、VC、産学連携部門が増えている。それぞれが善意で助言する。ある人は助成金応募を勧め、ある人はピッチを磨き、ある人は知財を止め、ある人は企業面談を入れる。研究者は多くの部屋を回るが、最後に研究人生、知財、会社化リスクを背負うのは自分だと感じている。

**Tension:** 支援が増えるほど、研究者が孤独になることがある。支援メニューは増えているのに、責任pipelineがない。

**Diagnosis:** 欠けているのは善意ではなく統合者である。誰が時計を束ね、誰が順序を守り、誰が研究者の意思と会社化条件を同じ地図に戻すのかが空白になっている。

**Tool insertion:** responsibility-flow table / corridor-of-rooms scene / support menu vs responsibility pipeline checklist。

**Theory bridge:** ERS。研究機関側のURA/TLO/EIR/資金/規程/産学連携が「ある」だけでは不十分。機能がつながり、判断として閉じる必要がある。

**Chapter map:** 03 support isolation, 14 institution nursery, 21 ERS, 25 relationship playbook.

### Case 5: 研究機関の苗床不足

**public status:** public_rewrite

**Source families:** `pwa/design/institution_readiness.md`, `pwa/bzm/7-1`, `9-4`, NIMS install gates, Stapa paragraphs 590-640 and 720-755.

**Core scene:** ある地域には研究者、研究所、大学、企業研究所が集まっている。博士人材も多く、技術シーズも厚い。だが、研究者の近くに経営者候補が少ない。起業前資金も薄い。医療・製造・材料などのPoCを地域内で回せる可能性はあるが、誰が橋をかけるかは決まっていない。

**Tension:** シーズが集積していることと、会社が生まれることは違う。苗床に水、土、支柱、温度管理がなければ、強い種も外へ出た瞬間に弱る。

**Diagnosis:** 研究機関や地域のreadinessは、個別シーズの強さとは別に見る。シーズDB、URA、TLO、ギャップ資金、企業接続、EIR/CXO、COI/兼業/エクイティ規程、自治体・政策連携を一つの責任pipelineとして読む。

**Tool insertion:** institution nursery self-check / pilot gate / unknown vs not_started matrix。

**Theory bridge:** ERS and sigma_SU。ERSは苗床の充足率。sigma_SUは学・産・官の追い風。個別PJのscoreへERSを直接足さず、苗床と個体を分ける。

**Chapter map:** 14 institution nursery, 16 Triple Helix, 21 ERS, 25 relationship playbook, 26 case patterns.

## 4. scene bank 15本

### Scene 01: ピッチで前に出た研究者が、次の部屋で退くよう求められる

- **public status:** public_ready
- **Use:** 00 prologue / Ch5 hinge / Ch18 FRL
- **Transferable copy grain:** 研究者が助成面接のために事業説明を練習し、起業家らしく語れるようになる。その後の資金調達面談で、別の合理性から外部経営者を求められる。読者には「同じ支援の流れなのに、なぜ同じ人に逆の役割が求められるのか」という問いを残す。
- **Do not include:** Stapa, AMD, VC実名、登壇者名。

### Scene 02: 設立前に時限装置のスイッチを見ている

- **public status:** public_ready
- **Use:** Ch6 / Ch7 / Ch19
- **Transferable copy grain:** 法人設立はスタートではなく、固定費、会計、登記、資本政策、代表責任、採用、資金調達期待を動かすスイッチである。6-9か月かかるDDを会社設立後に初めて始めると、待ち時間の間に義務だけが進む。
- **Decision:** WAIT + pre-incorporation work.

### Scene 03: 論文を読まずに研究者へ会いに行く支援者

- **public status:** public_ready
- **Use:** Ch10 / Ch25
- **Transferable copy grain:** 支援者がピッチ資料だけを読んで研究者に会う。研究者は、自分が長い時間をかけて育てた問いを、表面だけで事業素材として扱われたと感じる。反対に、論文を読み、研究者の言葉で問いを返すと、会話の入口が変わる。
- **Tool:** first-meeting research respect checklist.

### Scene 04: 産連・URAを飛ばして信頼を失いかける

- **public status:** public_ready
- **Use:** Ch4 / Ch10 / Ch25
- **Transferable copy grain:** 昔なら研究者本人に直接行けば済んだかもしれない。しかし制度が整うほど、産学連携やURAを通す順序も信頼の一部になる。研究者の理解だけでなく、組織側の窓口を尊重することが、後の知財・共同研究・契約の摩擦を減らす。

### Scene 05: 企業の「面白い」がPoCに見えてしまう

- **public status:** public_ready
- **Use:** Ch1 / Ch9 / Ch17
- **Transferable copy grain:** 探索部門は好意的だが、現場、予算、検証条件、意思決定者が出てこない。支援者が「PoCが見えた」と読んだ瞬間に、BRLを過大評価する。

### Scene 06: 共同研究の成果が別の企業説明に混ざりかける

- **public status:** public_rewrite
- **Use:** Ch4 / Ch17 GRL
- **Transferable copy grain:** 企業ヒアリング用の資料に、別の共同研究先との未整理情報が混ざっている。悪意はないが、後で契約と信頼の問題になる。開示前に「誰の情報か」を見る場面にする。

### Scene 07: 支援メニューが増えた廊下

- **public status:** public_ready
- **Use:** Ch3 / Ch14
- **Transferable copy grain:** 研究者が、助成金の部屋、知財の部屋、企業面談の部屋、投資家準備の部屋、大学内説明の部屋を順に回る。どの部屋も正しいことを言うが、全部を一つの判断へ戻す人がいない。

### Scene 08: WAITが作業計画に変わる

- **public status:** public_ready
- **Use:** Ch6 / Ch7 / Ch23
- **Transferable copy grain:** 会議で「まだ設立しない」と決める。ただし終わりではない。90日以内に、出願、顧客課題、CEO機能、大学手続き、DD準備の5つを進め、戻る条件を明記する。

### Scene 09: 投資家のNOが一つの判決として響く

- **public status:** public_ready
- **Use:** Ch9 / Ch10 / Ch19
- **Transferable copy grain:** 投資家が「チームが弱い」と言う。研究者には自分への否定として響く。支援者は、そのNOをFRLなのかHRLなのかBRLなのかGRLなのか、投資領域の不一致なのかへ分解する。

### Scene 10: 外部CEO候補の履歴書は強いが、研究者との信頼が弱い

- **public status:** public_rewrite
- **Use:** Ch10 / Ch13 / Ch18
- **Transferable copy grain:** 経営経験はある。資金調達も語れる。だが研究者の技術観を軽く扱い、大学の制約を面倒なものとして扱う。穴を埋めるはずの人材が、会社の中心を壊す場面。

### Scene 11: 地域には研究者がいるが、経営人材の道がない

- **public status:** public_ready after anonymization
- **Use:** Ch14 / Ch18 / Ch21
- **Transferable copy grain:** 研究所や大学は集積している。だが、技術と経営の両方を理解する人材のキャリアパスが見えない。外からCEOを連れてくるだけでは再現性が弱い。地域の苗床には人材育成が必要になる。

### Scene 12: 医療系PoCを地域内で回せそうなのに、橋がない

- **public status:** public_rewrite
- **Use:** Ch9 / Ch14 / Ch16 / Ch21
- **Transferable copy grain:** 研究所、大学、病院、メーカーが近くにある。用途展開の可能性はあるが、誰が臨床現場、研究者、企業、規制、PoC条件をつなぐのかが決まっていない。

### Scene 13: Unknownを未整備として叱ってしまう

- **public status:** public_ready
- **Use:** Ch14 / Ch21
- **Transferable copy grain:** 機関ヒアリングでEIR制度が確認できない。未確認なのに「制度がない」と決めつけると、支援者は誤ったギャップを提案する。unknownは確認TODO、not_startedは整備課題として分ける。

### Scene 14: Scoreが高いのに次の一手が分からない

- **public status:** public_rewrite
- **Use:** Ch15 / Ch19
- **Transferable copy grain:** 技術、政策、資金の見栄えはよい。総合点も高そうに見える。だが、最初の顧客とCEO機能が空いている。点数をランキングとして読むと進めたくなるが、律速軸として読むと資源配分が変わる。

### Scene 15: 研究者の真正性が人を動かす

- **public status:** public_ready
- **Use:** Ch13 / Ch18
- **Transferable copy grain:** 経営経験が豊富な外部人材より、研究者本人が心から技術の意味を語ることで、良い採用候補や企業候補が動くことがある。ただし真正性は会計、採用、契約、資本政策を代替しない。

## 5. tool/question bank 20本

### Tool 01: CEO Function Map

| function | current carrier | must stay with researcher? | can be complemented? | risk if empty |
|---|---|---|---|---|
| 技術の意味を語る | 研究者 | yes | no | 会社の中心が空洞化 |
| 社会に出す理由 | 研究者 | yes | partial | 採用・企業・投資家が動かない |
| 顧客課題を読む | 未定 | no | yes | BRL過大評価 |
| 資金調達実務 | 未定 | no | yes | DDが進まない |
| 採用・組織 | 未定 | no | yes | HRLが伸びない |
| 知財・契約順序 | 研究機関/TLO | no | support possible | GRL事故 |

### Tool 02: GO / WAIT / HOLD / NO_GO / RESOURCE_SHIFT Log

```md
- 判断:
- なぜ今この判断か:
- 戻る条件:
- 次の30-90日で進める作業:
- 主な律速:
- 誰が持つか:
- 見直し日:
```

### Tool 03: WAIT Is Work Checklist

- 技術: 次の実験・再現性・試作条件は何か。
- 知財: 出願、発明届、共同研究整理は何が残るか。
- 顧客: 次に聞く相手は探索部門か現場か意思決定者か。
- CEO機能: 誰が空白機能を埋める候補か。
- 大学: COI、兼業、ライセンス、研究継続は誰が確認するか。
- 資金: DD前に何を揃えればよいか。

### Tool 04: Three Disclosure Layers

| layer | content | allowed audience | owner check |
|---|---|---|---|
| Public | 技術概要、解く課題、公開済み成果 | イベント、初回企業面談 | 研究者 + 支援者 |
| NDA-needed | 性能条件、実験詳細、共同検証案 | 企業候補、投資家DD | 研究者 + TLO/産連 |
| Do-not-disclose-yet | 出願前中核、論文前データ、共同研究先情報 | 原則出さない | TLO/研究者 |

### Tool 05: Pre-Disclosure Review Sheet

- 出願状況は何か。
- 論文・学会・プレス予定はいつか。
- 共同研究先や第三者情報は混ざっていないか。
- 面談相手は誰で、目的は何か。
- 使う資料はどの公開範囲か。
- 研究者本人はどこまで話すことに納得しているか。

### Tool 06: Customer Signal Translation Table

| heard from company | not enough yet | next question |
|---|---|---|
| 面白い | 課題の深さ不明 | どの業務で困っているか |
| PoCしたい | 検証条件不明 | 何が満たされれば次に進むか |
| 担当部署につなぐ | 意思決定者不明 | 予算と評価者は誰か |
| 既存手段がある | 代替比較不明 | 何が不足しているか |

### Tool 07: Before VC Readiness Sheet

- 資金で下げる不確実性は何か。
- 顧客課題は検証可能か。
- CEO機能の空白を説明できるか。
- 開示範囲は整っているか。
- 大学側の権利・契約・COIは投資対話に耐えるか。
- 会社設立前にDDを進められる範囲は何か。

### Tool 08: Failure-Learning Template

```md
- 起きたこと:
- 当初の仮説:
- 実際の観測:
- 見落とした信号:
- どのreadinessを過大/過小評価したか:
- 修正した問い:
- 次回の赤信号:
```

### Tool 09: Responsibility Pipeline Check

- 支援メニューはいくつあるかではなく、誰が判断を統合するか。
- 研究者が背負っている未整理リスクは何か。
- URA/TLO/EIR/支援者/企業/投資家の入力は、どこで一枚の判断表に戻るか。
- 最後に決める人と、最後まで伴走する人は同じか違うか。

### Tool 10: Institution Nursery Self-Check

- シーズの棚卸しはあるか。
- 事業化目利きURAはいるか。
- TLO/知財が事業化順序を扱えるか。
- GAP/PoC資金はあるか。
- EIR/CXO供給はあるか。
- 共同研究・NDA・ライセンス処理は速いか。
- COI/兼業/エクイティ規程はあるか。
- 政策・自治体・企業接続はあるか。

### Tool 11: Unknown vs Not Started Matrix

| item | unknown | not_started | drafting | established |
|---|---|---|---|---|
| EIR制度 | 資料未確認 | 制度なし | 草案あり | 運用中 |
| IP-equity | 規程未確認 | 不可 | 検討中 | 規程化 |
| GAP資金 | ヒアリング前 | なし | 設計中 | 実績あり |

### Tool 12: Institution Pilot Gate

- 目的は全学DXではなくBefore Zero判断支援か。
- 対象シーズは3-5件に絞れているか。
- 利用者と権限は最小化されているか。
- データ境界と公開禁止範囲は文書化されているか。
- 月次レビュー2サイクルで何を見るか。
- 拡張条件と停止条件は何か。

### Tool 13: First Meeting Respect Checklist

- 論文・公開資料を読んだか。
- 研究者の言葉で質問できるか。
- 研究として守りたいものを先に聞いたか。
- 産連/URA/TLOの順序を確認したか。
- 事業化したい理由が研究者本人の人生方向と合うか。

### Tool 14: Role Vacancy Questions

- 誰が毎週の意思決定をするか。
- 誰が悪い知らせを受け止めるか。
- 誰が顧客の痛みを聞きに行くか。
- 誰が大学の手続きを前に進めるか。
- 誰が投資家との宿題を持ち帰るか。
- 誰が研究者の守る線を守るか。

### Tool 15: Theory Bridge Paragraph Builder

```md
現場では、まず [scene] が起きる。
この時点で読者が見ているのは [field signal] であり、まだ [theory term] という名前は要らない。
しかし同じ種類の場面が繰り返されると、これは [axis/parameter] として分けて扱う必要が出てくる。
後半では、この [field signal] を [theory term] と呼ぶ。
```

### Tool 16: Investor Feedback Translation

| investor feedback | possible meaning | next action |
|---|---|---|
| team weak | FRL/HRL vacancy | CEO function map |
| market unclear | BRL low | customer problem interview |
| too early | TRL/GRL/timing | WAIT with milestone |
| IP concern | GRL low | disclosure/IP review |
| not our thesis | fit issue | do not over-diagnose |

### Tool 17: Composite Case Safety Filter

- 3つ以上の実ケース要素を混ぜたか。
- 固有名・地域名・会社名を落としたか。
- 金額・契約・個人評価を落としたか。
- 1社/1機関に特定される組み合わせを避けたか。
- 教訓が読者の問いになっているか。

### Tool 18: Chapter Ending Bridge

- 今日できる行動を1つだけ置く。
- まだ解けていない不安を1つ残す。
- 次章でなぜそれを見る必要があるかを1文でつなぐ。

### Tool 19: Seed Discovery First Pass

- 公式採択情報か。
- 起業前か。
- 技術と応用先が説明できるか。
- 代表研究者・機関・資金プログラムが分かるか。
- TRL/BRL/HRLの初期仮説を置けるか。
- 接触前の開示注意があるか。

### Tool 20: Field Note To Reusable Question

- raw observation: 何が起きたか。
- candidate lesson: 何を学べるか。
- confidentiality: publishable / sanitized / internal_only。
- reusable question: 次回使う問い。
- theory impact: どの理論要素に触れるか。
- validation: 後で何を見て正誤確認するか。

## 6. 15-21理論field-first bridge

### Ch15: Readiness is not valuation

- **Field first scene:** 投資家や支援制度の期待が高まり、valuationや採択可能性だけが先に動く。しかし顧客、CEO機能、開示順序が空いている。
- **Bridge:** 期待値と準備度は違う。準備度は「次に何を直すか」を出すための地図であり、価格を正当化する飾りではない。
- **Use cases:** Scene 14, Case 3, Case 4.
- **Public caution:** investment adviceにしない。

### Ch16: sigma_SU / Triple Helix

- **Field first scene:** 研究集積地にシーズがあり、政策予算もあり、企業研究所も近い。それでも会社が自然には生まれない。学・産・官の波が同じ方向を向くか、そしてつなぎ手がいるかが問題になる。
- **Bridge:** sigma_SUは「世の中が追い風っぽい」という感覚を、政策・産業・学術の向きとして分ける言葉。
- **Mini examples:** 医療PoC地域実証、政策予算があるが顧客現場が弱い、研究だけ強く産業接続が弱い。

### Ch17: XRL field anchors

| axis | field signal before term | trap | public mini case |
|---|---|---|---|
| TRL | 論文では成立、実環境では未確認 | 論文成立を会社成立と誤認 | 試作前なのに企業PoCを約束 |
| BRL | 企業が面白いと言うが課題が浅い | 好反応を顧客検証と誤認 | 探索部門で止まる |
| GRL | 出願/論文/共同研究/NDAが絡む | 開示順序を勇気の問題にする | 共同研究情報が資料に混ざる |
| SRL | 患者・地域・消費者・現場が不安を持つ | 政策/産業が前向きなら社会も受け入れると誤認 | 医療用途で現場受容が未確認 |
| HRL | 人はいるが機能が埋まらない | 肩書きで役割充足と誤認 | CEO候補はいるがBD/ops不在 |

### Ch18: FRL field-first

- **Field first scene:** 研究者が技術の意味を語ると人が動く。しかし経理、契約、採用、調達は回らない。外部経営者は経験があるが、研究者の言葉を軽く扱うこともある。
- **Bridge:** FRLは人を裁く軸ではなく、委ねられない資質と補える実行力を分ける軸。
- **Use:** Case 1, Scene 10, Scene 15.
- **Avoid:** ALQやCESから始めない。数式は「なぜ片方だけでは足りないか」を読者が体感した後。

### Ch19: Integrated score / bottleneck

- **Field first scene:** 総合的には有望に見える案件で、実際に次の一手が詰まっているのは顧客検証か、知財か、CEO機能か、大学手続きか。
- **Bridge:** 統合scoreはランキングではなく、低い軸と伸びしろを見て資源配分を決めるための道具。
- **Tool:** bottleneck next-action table.
- **Public language:** 「点数」より「律速」「次に下げる不確実性」。

### Ch20: Retrofit validation

- **Field first scene:** 過去の判断を「成功/失敗」で閉じず、当時の仮説、観測、見落とし、修正に戻す。
- **Bridge:** retrofitは過去を正当化するためではなく、判断地図が現実とどれだけ合っていたかを確かめる作業。
- **Use:** failure-learning logs from Scene 09/10.
- **Caution:** 実PJ名を出さない。composite timelineにする。

### Ch21: ERS

- **Field first scene:** 個別シーズは強い。研究者も前向き。だが、TLO、EIR、ギャップ資金、共同研究契約、COI/兼業、企業接続が途切れており、研究者に負荷が流れる。
- **Bridge:** ERSは研究機関をランキングするためではなく、苗床のどこが乾いているかを見るためのもの。
- **Use:** Case 4, Case 5, Tool 10-12.
- **Key distinction:** unknownは未確認、not_startedは未整備。個体scoreと苗床scoreを混ぜない。

## 7. 章別投入マップ

| range | injection priority | concrete material |
|---|---|---|
| 00-06 | case zero pressure | Case 1を中心に、Scene 02と08で設立タイミング、Scene 04と06で開示順序を入れる。GAP/VC/CEOだけに寄らず、開示と設立前DDを同じcase threadへ足す。 |
| 07-14 | worksheets and reader pathways | Tool 01, 02, 06, 08, 09, 10を、空表ではなくfilled exampleで入れる。Ch14はCase 5で「支援メニュー数ではなく責任pipeline」へ寄せる。 |
| 15-21 | theory field-first | Section 6のbridge bankを章頭に置く。各章は scene -> field signal -> theory name -> optional formula の順。特にCh17 XRLとCh21 ERSを厚くする。 |
| 22-26 | tools/cases/checklists | Tool 03-20をappendix化。Case 1-5をcomposite case patternsとして再登場させ、読者別に「研究者/URA/venture builder/VC/機関リーダー」の使い方を分ける。 |

## 8. リスクと公開本文への渡し方

- **会社紹介化risk:** Stapa素材は会社紹介が強い。公開本文では「支援者がすごい」ではなく「現場で支援が局所最適化すると何が起きるか」に変換する。
- **実名risk:** 登壇者名、研究機関名、地域名、特定PJ名は落とす。地域集積の話は「ある研究集積地」へ一般化する。
- **法務risk:** 知財・開示・共同研究は法務助言に見えないよう、チェック観点と順序設計に留める。
- **投資助言risk:** VC/DD/valuationは投資判断ではなく、会社化前の準備度と対話設計として扱う。
- **人事評価risk:** FRL/HRLは人物の優劣ではなく、機能・負荷・補完可能性として書く。
- **機関評価risk:** ERSは研究機関ランキングにしない。ギャップを責めるのではなく、次に整える支援条件として書く。
- **raw transcript risk:** event名・話者名・長文引用は本文に出さない。composite化し、3ケース以上の要素を混ぜる。

## 9. 次worker指示

### Next manuscript worker

1. `PUBLICATION_POSITIONING.md` を先に読む。
2. 00-06では Case 1 を中心にするが、Case 2 の開示、Scene 02 のDD 6-9か月、Scene 08 のWAITを必ず混ぜる。
3. 07-14では説明を増やすのではなく、filled worksheetを増やす。
4. 15-21では変数名から始めない。必ず Section 6 の field first scene から始める。
5. `AMD`, `Team ARMADA`, `まさ`, `AMD OS`, `L2`, `candidate`, `local applier`, `routing`, `pwa/`, `/spec`, `正本`, `司令塔`, `worker`, event名を公開本文へ出さない。
6. Ch17 XRLは各軸1 scene、Ch18 FRLは2 contrasting profiles、Ch21 ERSはunknown/not_startedとself-checkを入れる。
7. 章末は Tool 18 の3点で終える。質問リストだけで閉じない。

### Next source mining worker

1. BRLをさらに厚くするため、公開可能な企業ヒアリング/PoC誤読のcomposite素材を追加で探す。
2. SRL/GRLを厚くするため、医療・規制・社会受容のpublic-safe caseを外部公開情報から探す。
3. WAITが後でGOになったケースを探す。戻る条件つきWAITの説得力が上がる。
4. 外部CEO候補のfit/misfitは個人評価riskが高いので、必ずcomposite化する。
5. ERSは機関type別のpersonaを作る。大学、国研、地域エコシステムの3つ。

### Commander review points

- This artifact is internal editorial material, not public copy.
- It meets minimum counts: 5 composite cases, 15 scenes, 20 tools/questions.
- It includes `public_ready`, `public_rewrite`, `internal_only`.
- It includes docx extraction method and reviewed ranges.
- It intentionally skips deploy because this is markdown editorial/run-note only.
