# Textbook Commander Tasks

> Last updated: 2026-06-01 JST
>
> Textbook司令塔のタスク台帳。タスク追加、方針変更、worker切り出し、
> 完了報告、差し戻し、archive のたびに更新する。

## 未完タスク（優先順位順）

- **販売前提の公開本としてTextbookを再定義する**
  - お願いした内容: 現状の「AMDが見ていること」中心の内部教材から、日本中の研究機関の産連担当者、URA、研究者、スタートアップを目指す若者が買って読める本へ作り直す。
  - 背景: まさの指摘どおり、今の本文はAMD/まさ/内部運用語が強く、読者から見ると宣伝や内部資料に見えるリスクがあるため。宣伝は極小に抑え、読者の課題解決を主役にする。
  - 現状: `pwa/bzm/textbook/PUBLICATION_STRATEGY.md` を追加し、読者定義、類書カテゴリ、差別化、公開/内部分離、禁止語、公開原稿の章構成、worker計画を明文化。2026-06-01に Public-Manuscript Audit worker が `pwa/bzm/textbook/runs/2026-06-01-public-manuscript-audit.md` を追加し、`pwa/bzm/*.md` を公開可能性別に分類済み。公開TOC workerで、販売本の全体目次案・章ごとの読者への約束・既存素材マップ・不足素材・理論接続を `pwa/bzm/textbook/runs/2026-06-01-public-toc-draft.md` に整理。出版ポジショニングは `pwa/bzm/textbook/PUBLICATION_POSITIONING.md` に切り出し、公開本文では `AMD` / `Team ARMADA` / `株式会社チームアルマダ` / `まさ` を原則出さない方針を明文化。publication narrative strategy workerで、現行 `00`〜`14` の読み物品質レビューと全体ナラティブ戦略を `pwa/bzm/textbook/runs/2026-06-01-publication-narrative-strategy.md` に整理。
  - 残課題: 以後のpublic manuscript workerには必ず `PUBLICATION_POSITIONING.md` と `2026-06-01-publication-narrative-strategy.md` を読ませる。case_seed は匿名シーン化し、会社紹介・事業紹介に見える表現を禁止する。

- **公開原稿と内部正本を分離する**
  - お願いした内容: `pwa/bzm/*.md` をそのまま販売原稿扱いせず、内部source-of-truthと公開manuscriptを分ける。
  - 背景: L2⑩、applier、routing、changelog、source path、production deployなどは運用には必要だが、販売本の本文には混ぜてはいけないため。
  - 現状: 方針は `PUBLICATION_STRATEGY.md` に記録済み。Public-Manuscript Audit で `8-1`、`8-2`〜`8-5` のL2/applier受け皿、`9-5`、`COMMANDER_TASKS.md`、内部path/changelogを `internal_only` として退避対象化済み。公開原稿layerとして `pwa/bzm/public-manuscript/00-prologue.md`〜`14-institution-as-nursery.md` を作成し、司令塔レビュー通過。
  - 残課題: `pwa/bzm/public-manuscript/*.md` に Chapter 15以降のBZM理論パートを展開する。現行 `pwa/bzm/*.md` は内部sourceとして維持し、future public layer にだけ禁止語 lint をかける。

- **TextbookをBefore Zero実践テキストへ広げる**
  - お願いした内容: BZMの概念説明だけでなく、Before Zeroの現場で起きる判断、失敗、迷い、仮説修正、関係構築、ケース、横断パターンを統合した実践テキストへ育てる。
  - 背景: まさの意図は「BZM理論書」ではなく、次のBefore Zeroでどう動くかを学べる実務知の蓄積にあるため。
  - 現状: 方針はOS司令塔レビューで採用済み。Phase 1として第8部に実践章 skeleton を追加済み。`Textbook whole-structure base` workerで、前半を「Before Zero の現場 → 鬼門 → 関係構築 → 現場要素からBZM変数へ」に組み替え、main取り込み・production deploy済み。
  - 残課題: 実ケース素材は公開本の読者向けに匿名化・一般化してから本文化する。販売原稿では内部イベント名やAMD視点を出さず、「現場で何が起きるか」と「読者が何を判断できるか」に変換する。

- **スタパイベント文字起こしをTextbook素材として掘り切る**
  - お願いした内容: `/Users/masa/projects/AMD/AMD/stapa/イベントの文字起こし.docx` を素材に、Before Zeroの現場課題、研究者支援の局所最適、GAPファンド/VC/CEO論、研究者理解、会社化前準備をTextbookへ反映する。
  - 背景: まさの指摘どおり、スタパイベントには「現場で何が起きているか」「どこが鬼門か」を伝える素材が多く含まれているため。
  - 現状: 2026-06-01に文字起こしを読み、初回として `1-3`、`1-4`、`1-6` へ「支援制度の局所最適」「GAPファンドとVCの要求矛盾」「研究者の真正性とCEO機能分解」を反映。素材メモ `pwa/bzm/textbook/runs/2026-06-01-stapa-event-textbook-source-notes.md` を追加。
  - 残課題: 研究者との初回関係構築、会社化前VC DD 6〜9か月問題、産学連携/URAを通す分岐、つくば型の研究集積地と経営人材育成を後続workerで本文化する。

- **L2⑩候補抽出・承認・追記フローを実運用に乗せる**
  - お願いした内容: Supabase内の既存L2/OSデータからTextbook追記候補を抽出し、通知で承認し、承認後にlocal applierで `pwa/bzm/*.md` へ安全に追記する。
  - 背景: Vercel runtimeやPWA APIからgit管理ファイルを直接編集せず、候補化、承認、local追記、commit/pushの二段階で事故を避けるため。
  - 現状: `textbook_insight_candidates`、通知feedback、`apply_approved_textbook_insights.mjs`、L10 SKILL、specは実装済み。migration 116も本番DBへ適用済みで、schema docsも同期済み。
  - 残課題: 既存候補のbackfill、実データでの候補品質確認、承認後の追記運用、applier実行後のcommit/deploy運用を実ケースで回す。

- **BZM司令塔レビューが必要な候補の扱いを固める**
  - お願いした内容: BZM理論、用語、rubric、数式、重み、章構成へ影響するTextbook候補を、Textbook司令塔だけで通さずBZM司令塔レビューへ回す。
  - 背景: Textbookは掲載形式と実践テキスト運用を持つが、BZM理論の一貫性やモデル変更判断はBZM司令塔の守備範囲だから。
  - 現状: `bzm_review_required`、`bzm_review_status`、`theory_change_scope` が候補DBに追加済み。applierはBZM未承認の理論候補をskipする。
  - 残課題: BZM司令塔がどうレビューし、誰が `bzm_review_status` を更新するかの運用UI/手順が未実装。通知UIから直接更新するか、司令塔レビュー経由にするか決める。

- **新章へのL2⑩ target routingを調整する**
  - お願いした内容: L2⑩候補の `practice_kind` や内容に応じて、追記先を新章 `8-2`〜`8-5` へ自然に振り分ける。
  - 背景: Phase 1実践章を追加したので、従来defaultの `8-1-amd-os-operations` に実務知見が集中すると、章の役割がまた曖昧になるため。
  - 現状: 新章slugはmainに反映済み。specにはtarget routingの考え方があるが、helper側の具体的な新章振り分けはまだ次候補。
  - 残課題: `decision_branch` は `8-2`、`failure_learning` は `8-3`、`relationship_playbook` は `8-4`、`reusable_question` / `field_transition` は `8-5` など、生成側とapplier側のfallback方針を実装・検証する。

## 完了済みタスク

- **公開本の前半をscene-firstで再構成する**
  - お願いした内容: `pwa/bzm/public-manuscript/00`〜`06` を、正しい説明の連続ではなく、ひとつの読書体験として読ませるためのscene-first rewrite briefを作る。
  - 背景: Publication narrative strategy workerで、現行公開原稿は会社紹介リスクはかなり減った一方、章ごとの説明が並び、前後の感情線と橋渡しがまだ弱いと診断したため。特に `GAPファンド -> スタートアップらしい発表 -> VCで外部経営者要求` は、1文の例ではなく本全体の中核シーンとして育てる必要がある。
  - 現状: `pwa/bzm/textbook/runs/2026-06-01-public-manuscript-00-06-scene-first-rewrite-brief.md` を追加。新公開スパイン、`05-gap-vc-ceo-function.md` のChapter 4昇格、`04-before-disclosure.md` のChapter 5移動、章別の残す/移動/膨らませる/削る素材、`GAP/VC/CEO case zero` の再登場設計、次 manuscript rewrite worker 向けの具体指示を整理済み。本文大改稿は未実施。
  - 残課題: 司令塔レビュー後、次workerで public manuscript `00`〜`06` を実際にscene-firstで改稿する。公開本文側では引き続き内部語・会社紹介化を禁止し、case zero は匿名composite sceneとして扱う。

- **Textbook publication narrative strategy**
  - お願いした内容: 現行公開原稿 `00`〜`14` を販売本としての読み物品質でレビューし、本全体のナラティブ戦略、再構成案、章の書き方ルール、次タスクを作る。
  - 背景: まさの指摘どおり、現行原稿は小見出しごとの説明が並び、前後のつながりや読者を引っ張る編集戦略が弱かったため。特にGAPファンドとVC/CEO問題はイントロの1文で消費せず、本の中核シーンとして扱う必要があった。
  - 現状: `pwa/bzm/textbook/runs/2026-06-01-publication-narrative-strategy.md` を追加。章別レビュー、読者の感情線、GAP/VC/CEO central hinge、現行 `05` をChapter 4へ昇格する再構成案、Scene -> Tension -> Diagnosis -> Tool/Question -> Bridge 型、big field insight rule、次worker方針を整理済み。
  - 残課題: 次workerで `00`〜`06` のscene-first rewrite briefを作り、本文大改稿に入る前に司令塔レビューを通す。

- **Textbook public-manuscript audit**
  - お願いした内容: 現行 `pwa/bzm/*.md` を販売本の原稿として見たとき、公開可能、公開向け書き換え必須、内部退避、匿名化ケース素材に分類する。
  - 背景: 公開本は「AMDすごい」では売れず、読者主語で Before Zero の現場課題を解く必要があるため。
  - 現状: `pwa/bzm/textbook/runs/2026-06-01-public-manuscript-audit.md` を追加。全 `pwa/bzm/*.md` について章/section単位の分類、禁止語ヒット、置換案、AMD推しリスク、次worker方針を整理済み。
  - 残課題: 公開TOC draft、case_seed の匿名シーン化、公開原稿layer作成、publication lint。

- **Textbook public manuscript prologue ch1-3**
  - お願いした内容: 販売本として読める公開原稿layerの最初の4ファイルを作る。
  - 背景: まず「AMDの宣伝ではない本」として読者契約を固めるため。
  - 現状: `pwa/bzm/public-manuscript/00-prologue.md`、`01-research-results-are-not-companies.md`、`02-different-clocks.md`、`03-support-can-isolate-researchers.md` を追加。禁止語scanはno hits。司令塔レビューで公開原稿の入り口として通過。
  - 残課題: Chapter 4〜6へ展開し、外部開示、GAP/VC/CEO機能、会社化タイミングを同じ公開文体で本文化する。

- **Textbook public manuscript ch4-6**
  - お願いした内容: 公開原稿layerで、外部開示、GAP/VC/CEO機能、会社化タイミングを扱う Chapter 4〜6 を作る。
  - 背景: Before Zero の鬼門を、内部イベント名や会社宣伝ではなく、読者が現場で使える判断レンズとして書くため。
  - 現状: `pwa/bzm/public-manuscript/04-before-disclosure.md`、`05-gap-vc-ceo-function.md`、`06-incorporation-timing.md` を追加。禁止語scanはno hits。司令塔レビューで公開原稿として通過。
  - 残課題: Chapter 7〜10へ展開し、「会社にする前に聞く問い」を公開原稿化する。

- **Textbook public manuscript ch7-10**
  - お願いした内容: 公開原稿layerで、Part 3「会社にする前に聞く問い」の Chapter 7〜10 を作る。
  - 背景: 読者が研究成果の会社化前に使える問いと会話設計を、本として独立した章にするため。
  - 現状: `pwa/bzm/public-manuscript/07-company-now-later-or-never.md`、`08-who-carries-what.md`、`09-before-risk-capital.md`、`10-turning-failure-into-learning.md` を追加。禁止語scanはno hits。司令塔レビューで公開原稿として通過。
  - 残課題: Chapter 11〜14へ展開し、現場要素からモデル変数へつなぐ橋の章を公開原稿化する。

- **Textbook public manuscript ch11-14**
  - お願いした内容: 公開原稿layerで、Part 4「現場要素からモデル変数へ」の Chapter 11〜14 を作る。
  - 背景: 理論パートに入る前に、マクロ追い風、準備度軸、創業者準備度、研究機関の苗床性を現場語で読者に渡すため。
  - 現状: `pwa/bzm/public-manuscript/11-macro-tailwinds-as-conditions.md`、`12-readiness-axes.md`、`13-founder-readiness-field-language.md`、`14-institution-as-nursery.md` を追加。禁止語scanはno hits。司令塔レビューで公開原稿として通過。
  - 残課題: Chapter 15〜18へ展開し、BZM理論パートの前半を公開原稿化する。

- **Textbook whole-structure base**
  - お願いした内容: Textbook の入口を BZM 理論説明から Before Zero 実践テキストへ変え、既存理論章を後半の理論パートとして温存する。
  - 背景: まさの意図は、まず現場で何が起き、どこが鬼門で、どう判断し、その奥に BZM 理論があるかを伝える構成にすること。
  - 現状: worker branch `codex/textbook-structure-base` で、前半5部の新規章 skeleton、序章、BZM chapter registry、8-1案内、附則を更新。既存理論本文と L2⑩ target slug `8-2`〜`8-5` は温存。
  - 残課題: 司令塔レビュー待ち。実ケース本文は承認済み L2⑩候補から追記する。

- **Phase 1実践章追加**
  - お願いした内容: 既存slugを壊さず、第8部にBefore Zero実践章 skeleton を追加する。
  - 背景: Textbookを実践テキスト化するには、判断、失敗、関係構築、チェックポイントを受ける章が必要だったため。
  - 現状: `8-2-field-decisions-and-branches`、`8-3-failures-pivots-and-revisions`、`8-4-relationship-playbook`、`8-5-before-zero-checkpoints` を追加済み。`bzm-chapters.ts`、preface、`8-1`、changelogも更新済み。main反映済みでVercel productionもREADY確認済み。
  - 残課題: skeletonなので実ケース本文は未記入。今後のL2⑩承認候補で本文を育てる。

- **L2⑩ metadata / confidentiality / BZM review gate 実装**
  - お願いした内容: Textbook候補に実践分類、機密区分、BZMレビュー要否、理論影響範囲を持たせる。
  - 背景: Before Zero実践テキストでは、単なるBZM理論補足だけでなく、機密度や理論変更リスクを分けて扱う必要があるため。
  - 現状: migration 116で `metadata_json`、`confidentiality`、`bzm_review_required`、`bzm_review_status`、`theory_change_scope` を追加済み。helper、applier、notifications最小表示、spec、SKILLも更新済み。
  - 残課題: 既存候補のmetadata backfill、BZMレビュー状態更新の運用UI、実データでのvalidation tuningが残っている。

- **migration 116本番適用とschema/docs同期**
  - お願いした内容: migration 116を本番DBへ適用し、`db_schema.md` とspecを現状へ同期する。
  - 背景: worker Bのmain pushによりproduction codeが新カラムを読む状態になり、migration未適用だとDB/code mismatchが起きたため。
  - 現状: OS司令塔がmigration 116を本番適用済み。`metadata_json` missingのRESTエラーは解消済み。worker Cがschema dumpを実行し、`pwa/design/db_schema.md` とspec/changelogを同期済み。
  - 残課題: 今回の事故を踏まえ、main push後のVercel production確認とDB/code compatibility確認をworker終了ゲートに入れ続ける。

- **Textbook worker完了報告ゲートの強化**
  - お願いした内容: worker完了/停止/要判断時に、worker内finalだけでなくTextbook司令塔へ能動報告させる。
  - 背景: heartbeatやread_threadだけでは報告漏れを拾う保険にしかならず、司令塔が統合判断を遅らせるため。
  - 現状: Textbook worker prompt標準に、報告タイトル `【司令塔へ報告】<作業名> 完了/要判断/停止/ブロック`、送信先thread id、必須報告項目を追加済み。worker A main取り込みでも新形式の報告を受領済み。
  - 残課題: 今後新規workerを切るたびにこの台帳とworker promptへ反映する。`UU` conflictや未分類dirtyが残るworkerはarchiveしない。
