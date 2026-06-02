# Textbook Commander Tasks

> Last updated: 2026-06-02 JST
>
> Textbook司令塔のタスク台帳。タスク追加、方針変更、worker切り出し、
> 完了報告、差し戻し、archive のたびに更新する。

## 司令塔継続運用ルール

- 未完タスクがあるのに、Textbook司令塔が作成したworkerが全員完了/停止/待機し、次アクションも切られていない状態を作らない。
- worker完了/停止/要判断時は、worker内finalだけでなく、必ずTextbook司令塔へ能動報告させる。報告先頭は `【司令塔へ報告】<作業名> 完了` / `要判断` / `停止/ブロック` にする。
- 報告漏れは起きる前提で、Textbook司令塔heartbeatや定期確認が直近workerの状態、pending worktree、報告未確認、未完タスクと次アクション有無を確認する。
- heartbeatや巡回で未完タスクが残っていて進められるものがある場合は、司令塔がworkerを切る、既存workerを再起動/差し戻す、または司令塔自身で次アクションを実行する。
- 進められる未完タスクがない場合は、まさ確認/判断/作業が必要なはずなので、具体的な質問または判断依頼としてまさを動かす。
- `未完あり・全worker停止・まさにも何も聞かない` 状態は禁止する。
- 今後のTextbook worker promptには、この継続運用ルール、能動報告、終了ゲート、`git add .` 禁止、dirty分類、`UU` conflict時archive禁止を必ず含める。

## 出版北極星

- この本の中心は、特定企業や特定モデルの紹介ではなく「研究成果が社会に出る直前でなぜ止まるのか」「会社になる前の混乱をどう読めばいいのか」に置く。
- 読書体験は `違和感 → 現場で起きていること → 鬼門の構造 → 会社にする前の問い → 現場要素の分解 → BZM理論 → 実践ツール` の順に設計する。
- GAPファンド/VC/CEO論などの強い現場シーンは、本の中心ではなく、Before Zero の構造を読者に体感させる代表例として扱う。
- BZMは前半から説明しない。読者が現場の違和感と判断の難しさを掴んだ後に、その混乱を整理する理論地図として後半で出す。
- OS上の `/bzm` 導線は、公開本づくりの混乱を避けるため表示名を `教科書` に寄せる。内部slugや既存URLは互換性維持のため当面 `/bzm` のままにする。

## 本文拡充運用

- まさ確認待ちは解除済み。Textbook本文を書き進める作業自体は、まさ個別承認なしで進めてよい。
- `pwa/bzm/public-manuscript/*.md` の追加・修正、台帳/レビューnote更新、禁止語scan、司令塔レビューゲートは継続OK。
- 必須条件は `pwa/bzm/textbook/PUBLICATION_POSITIONING.md` を守ること。公開本はAMD/Team ARMADA/まさ/会社紹介ではなく、Before Zeroの普遍的な現場と読者を主人公にする。
- まさから直接出た「必ず残したい思想・現場知」は `pwa/bzm/textbook/AUTHOR_DIRECTIVES.md` に保存する。writer/editor workerは `PUBLICATION_POSITIONING.md` と合わせて必読にし、該当要素を削る場合は、削除ではなく移動・圧縮・代替反映として司令塔レビューへ回す。
- 章型は小見出し羅列ではなく `Scene → Tension → Diagnosis → Tool/Question → Bridge` に寄せる。
- DB write、external service write、local applier `--apply`、販売用公開の最終判断は引き続き禁止/要判断。
- 今後は `本文rewrite → 編集者批評 → AMD OS/生データ素材発掘 → rewrite差し戻し` の循環で進める。本文workerだけで「完成」と見なさず、編集者workerの落第基準と素材発掘workerの章別投入マップを次rewriteに反映する。
- 2026-06-01: `Textbook full-book artifact spine rewrite 00-21` worker作成が3回 `systemError` になったため、司令塔がclean worktreeで直接scoped rewriteを実施。00-21へtraveling artifact spineを追加し、22-24のtoolkit draftを追加。成果記録は `pwa/bzm/textbook/runs/2026-06-01-full-book-artifact-spine-rewrite-00-21.md`。
- 2026-06-02: まさ直指定の思想として「生存確率」「稼げる体質」「Jカーブ/IPO一律化への疑問」を受領。`AUTHOR_DIRECTIVES.md` に保存し、Ch06/Ch19へ一次反映。

## 未完タスク（優先順位順）

- **page-turner編集レビューと素材発掘ループ**
  - お願いした内容: 公開原稿を「ついつい読み進めてしまう本」として磨くため、本文writerとは別に編集者workerと素材発掘workerを走らせる。
  - 背景: 現状はnarrative要素が入り始めたものの、販売本として読者を引っ張る魅力度と、AMDで培ったBefore Zero実務ノウハウの厚みがまだ足りないため。
  - 現状: 00-14 continuous rewrite、15-21 continuous theory rewrite、ruthless editor full-book audit v3、deep source mining v4を受け、司令塔直接作業で00-21のartifact spine rewriteと22-24 toolkit draftを作成・push済み。`Textbook cold-reader review artifact spine 00-24` と `Textbook source mining budget-owner / artifact scenes v5` のP0を受け、2026-06-02に `Textbook public manuscript artifact spine P0 rewrite` workerが本文へ直接反映済み。続けて `Textbook surgical editorial pass artifact spine` workerがCh04/Ch05 semantic order、scaffolding語、Toolkit A/B/C配置、Ch14/21/24重複をsurgical修正。2026-06-02のeditorial narrative reset auditでは、販売本としてはまだ章別説明/表/チェックリストが強く、さらにOSの `📚 教科書` 導線が旧BZM本文 `/bzm` を見せていることをP0 mismatchとして診断した。追加で `Textbook OS field knowhow harvest v6` が旧 `pwa/bzm/*.md` のAMD主語/AMD OS/AMD Score/L2語を読者主人公の現場ノウハウへ変換する素材台帳を作成し、`source phrase` / `public rewrite direction` / `do_not_publish_as_is` 付きの旧BZM公開化地図、composite case 15件、scene seed 40件、tool/question/checklist 42件、00-24全章投入マップを整理。2026-06-02に `public book architecture reset brief` workerが `pwa/bzm/textbook/runs/2026-06-02-public-book-architecture-reset-brief.md` を追加し、00-24を primary composite case + institutional echo thread、Act I-V、Field Toolkit、tables-to-appendix map、BZM reveal plan、opening rewrite orderへ再設計。続けて司令塔直接作業で `pwa/bzm/public-manuscript/00`〜`03` をAct Iとして、強くなりすぎたdeck sentenceが顧客証拠、時計衝突、研究者孤独へ進むnarrativeへ改稿し、`pwa/bzm/textbook/runs/2026-06-02-opening-act-i-narrative-rewrite.md` を追加。Act I cold-reader/editor reviewで、00-03は本の冒頭として継続可能、ただし `Act I` メタ表現と説明/list residueは後続surgical pass対象と判定し、`pwa/bzm/textbook/runs/2026-06-02-act-i-cold-reader-editor-review.md` を追加。 続けて司令塔直接作業でCh04〜Ch06をAct IIとして改稿し、外部CEO displacement、送信予約寸前の開示事故、登記/生存確率/稼げる体質の意思決定へつなぐnarrativeへ置換。run note `pwa/bzm/textbook/runs/2026-06-02-act-ii-narrative-rewrite.md` を追加。2026-06-02のAct I-II cold-reader/editor reviewで、00-06は通読可能なcomposite caseとして継続可、ただしCh06→Ch07が判断語/表へ戻る危険、Ch00-03の説明/list residue、Ch06 paid-signal dramatization不足をpublication-grade前の残課題として整理し、`pwa/bzm/textbook/runs/2026-06-02-act-i-ii-cold-reader-editor-review.md` を追加。
  - 残課題: 次はCh07〜Ch10をAct IIIとして同じcomposite caseで書き換える。Ch07はWAIT ledgerをday 12/day 37などの会議行動へ、Ch08は責任配置を若手事業化人材の失敗/修復へ、Ch09は投資家面談と予算者メールを証拠更新へ、Ch10は失敗/停滞を関係修復へ変える。その後、Act I-II line-level surgical pass、`table extraction / toolkit appendix`、`support boundary pass` を順に切り、v6素材台帳の素材を本文へ直接貼らずcomposite scene化して反映する。

- **public manuscript 00-06 scene-first rewrite**
  - お願いした内容: 北極星と `2026-06-01-public-manuscript-00-06-scene-first-rewrite-brief.md` に沿って、`pwa/bzm/public-manuscript/00`〜`06` を読み物としてつながる本文へ改稿する。
  - 背景: 現行draftは章ごとの論点整理としては進んだが、小見出し単位の説明が並びやすく、販売本として読者を惹きつける連続した読書体験がまだ弱い。
  - 現状: 00-06はscene-first rewrite、editorial integration、00-14 continuous rewriteを経て、今回artifact spine rewriteにも取り込み済み。
  - 残課題: 00-06単体タスクとしては完了扱いに寄せる。以後は00-24全体の通読レビューと必要箇所のsurgical rewriteで扱う。

- **販売前提の公開本としてTextbookを再定義する**
  - お願いした内容: 現状の「AMDが見ていること」中心の内部教材から、日本中の研究機関の産連担当者、URA、研究者、スタートアップを目指す若者が買って読める本へ作り直す。
  - 背景: まさの指摘どおり、今の本文はAMD/まさ/内部運用語が強く、読者から見ると宣伝や内部資料に見えるリスクがあるため。宣伝は極小に抑え、読者の課題解決を主役にする。
  - 現状: `pwa/bzm/textbook/PUBLICATION_STRATEGY.md` を追加し、読者定義、類書カテゴリ、差別化、公開/内部分離、禁止語、公開原稿の章構成、worker計画を明文化。2026-06-01に Public-Manuscript Audit worker が `pwa/bzm/textbook/runs/2026-06-01-public-manuscript-audit.md` を追加し、`pwa/bzm/*.md` を公開可能性別に分類済み。公開TOC workerで、販売本の全体目次案・章ごとの読者への約束・既存素材マップ・不足素材・理論接続を `pwa/bzm/textbook/runs/2026-06-01-public-toc-draft.md` に整理。出版ポジショニングは `pwa/bzm/textbook/PUBLICATION_POSITIONING.md` に切り出し、公開本文では `AMD` / `Team ARMADA` / `株式会社チームアルマダ` / `まさ` を原則出さない方針を明文化。
  - 残課題: 以後のpublic manuscript workerには必ず `PUBLICATION_POSITIONING.md` を読ませる。case_seed は匿名シーン化し、会社紹介・事業紹介に見える表現を禁止する。

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

- **Textbook Act I-II cold-reader/editor review**
  - お願いした内容: main反映済みの public manuscript Ch00〜Ch06を、Act I-IIとして冷読者・編集者目線で通読レビューし、まだ「読み進めたくなる本」になっていない箇所とAct III rewrite orderを出す。
  - 背景: まさ指摘のとおり、Ch00〜Ch06 rewrite後も箇条書き/説明/ワークブック臭が残っていないか、Ch04〜Ch06が場面として読ませているか、survival/earning directiveが説教臭くないかを本文編集前に判定する必要があったため。
  - 現状: `pwa/bzm/textbook/runs/2026-06-02-act-i-ii-cold-reader-editor-review.md` を追加。Act I-IIはdeck sentence composite caseとして継続可、Ch05は最も場面化に成功。ただしCh06→Ch07が判断語/表へ戻る危険、Ch00〜Ch03の説明/list residue、Ch06 paid-signal dramatization不足を指摘。
  - 残課題: Ch07〜Ch10をAct IIIとしてrewriteする。Ch07はWAITを行動へ、Ch08は責任配置を具体失敗へ、Ch09は資本面談を証拠更新へ、Ch10は失敗ログを関係修復へ変える。

- **Textbook Act II CEO/disclosure/incorporation narrative rewrite**
  - お願いした内容: Ch04〜Ch06を、Act Iから続くcomposite caseとして、CEO機能、開示、会社化タイミングの章から「説明/表/チェックリスト」の残り香を抜き、読ませる本文へ改稿する。
  - 背景: Act I cold-reader/editor reviewで、次はCh04を外部CEO displacement、Ch05をdeck sentenceの開示事故寸前、Ch06を生存確率/稼げる体質の意思決定として書き換えるべきとされたため。
  - 現状: 2026-06-02に司令塔直接作業で、Ch04を研究者が外部CEO要求を聞く場面、Ch05を送信予約寸前で止まる開示事故、Ch06を登記提案とpaid-signal/Jカーブ批判/WAIT return conditionの意思決定へ改稿。run note `pwa/bzm/textbook/runs/2026-06-02-act-ii-narrative-rewrite.md` を追加。
  - 残課題: Act I-IIを通読レビューし、Ch07〜Ch10も同じcomposite caseで書き換える。

- **Textbook Act I cold-reader/editor review**
  - お願いした内容: main反映済みの public manuscript Act I（00-03）を、冷読者・編集者目線で「箇条書き/説明/ワークブック」ではなく一冊の本の冒頭として読めるかレビューする。
  - 背景: まさ指摘のとおり、Act I rewrite後も本当に reader-first narrative になっているか、本文編集前に別worker視点で落第基準とAct IIへのrewrite orderを出す必要があったため。
  - 現状: `pwa/bzm/textbook/runs/2026-06-02-act-i-cold-reader-editor-review.md` を追加。Act Iは会社紹介・著者紹介に寄らず、冒頭5分で現場の話として読めるため継続可。ただし説明/list residue、`Act I` メタ表現、生存確率/稼げる体質のdramatization不足は後続surgical対象。
  - 残課題: Act II rewriteは司令塔直接作業で完了。次はAct I-II通読レビューまたはCh07〜Ch10のAct III narrative rewriteへ進む。

- **Textbook opening and Act I narrative rewrite**
  - お願いした内容: `public book architecture reset brief` に沿って、`pwa/bzm/public-manuscript/00`〜`03` を「実務メモ」ではなく読み物としてのAct Iへ改稿する。
  - 背景: まさから「全くnarrativeじゃない」「箇条書きの本は見たことない」と強い差し戻しがあり、00-24を一冊の本として作り直す必要があったため。
  - 現状: 2026-06-02に司令塔直接作業で、00 Prologue、01、02、03を全面改稿。primary composite case「強くなりすぎたdeck sentence」を、拍手後の違和感、企業の「面白い」誤読、金曜資料締切の複数時計衝突、支援メニュー増加による責任中心の空白へ通した。run note `pwa/bzm/textbook/runs/2026-06-02-opening-act-i-narrative-rewrite.md` を追加。
  - 残課題: Ch04〜Ch06のAct II rewriteは完了。次はCh07〜Ch10をAct IIIとして、判断、責任配置、資本面談、失敗学習を同じcase threadでつなぐ。

- **Textbook public book architecture reset brief**
  - お願いした内容: 現行00-24を本文rewriteせず、一冊の本としてcomposite case arc、Act構成、tables-to-appendix map、BZM登場タイミングへ再設計する。
  - 背景: まさから「全くnarrativeじゃない」「実務メモ集に見える」と強い差し戻しがあり、editorial narrative reset auditも章別説明/表/チェックリストからのarchitecture resetをP0としていたため。
  - 現状: `pwa/bzm/textbook/runs/2026-06-02-public-book-architecture-reset-brief.md` を追加。primary composite case「強くなりすぎたdeck sentence」とinstitutional echo threadを設計し、Act I-V + Field Toolkit、Chapter 00-24 remap、Tables and toolkit extraction map、BZM theory reveal plan、Opening rewrite order、Next rewrite worker promptを整理。
  - 残課題: 次workerは `Textbook opening and Act I rewrite from architecture reset` として00-03を先に書き換える。その後、main narrativeから表/チェックリストをField Toolkitへ逃がす抽出workerへ進む。

- **Textbook editorial narrative reset audit**
  - お願いした内容: 公開原稿00-24とOS上の教科書/BZM導線を、販売本編集者criticとして「本としてまだ読ませられていない」前提で酷評し、rewrite orderを出す。
  - 背景: まさから、現状原稿はnarrativeではなく箇条書き/章ごとの説明に見える、さらに冒頭がAMD紹介に見えるという強い差し戻しがあったため。
  - 現状: `pwa/bzm/textbook/runs/2026-06-02-editorial-narrative-reset-audit.md` を追加。`GlobalNav.tsx` の `📚 教科書` が `/bzm` に向き、`/bzm` が旧 `pwa/bzm/0-1-preface.md` を表示するため、読者がpublic manuscriptではなくAMD/内部運用語の残る旧BZM本文へ送られるP0 mismatchを特定。本文面では、public manuscriptもまだ章別説明・表・チェックリスト密度が高く、composite case arcへのarchitecture resetが必要と診断。
  - 残課題: 次workerは `OS route/content mismatch fix` を最優先で切る。続けて `public book architecture reset brief`、opening rewrite、tables/toolkit appendix extractionへ進める。

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
  - 現状: `pwa/bzm/public-manuscript/04-gap-vc-ceo-function.md`、`05-before-disclosure.md`、`06-incorporation-timing.md` を追加。禁止語scanはno hits。司令塔レビューで公開原稿として通過。2026-06-02 surgical passでCh04/Ch05のfilename/title semantic orderを修正。
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
