# Textbook Commander Tasks

> Last updated: 2026-06-12 JST
>
> Textbook司令塔のタスク台帳。タスク追加、方針変更、worker切り出し、
> 完了報告、差し戻し、archive のたびに更新する。

## 司令塔継続運用ルール

- 未完タスクがあるのに、Textbook司令塔が作成したworkerが全員完了/停止/待機し、次アクションも切られていない状態を作らない。
- worker quiet modeを採用する。workerは原則として親司令塔チャットへ進捗・中間報告・自己判断の完了報告を送らない。
- workerが親司令塔へ送るのは、worker thread内でまさが「完全に完了」「OK」「これでよし」等と明示した後の最終closeout 1回だけにする。
- 例外は `UU` conflict、未分類dirty、権限/破壊的操作/外部判断、同じblocking conditionで進行不能など、司令塔側の介入が必要な場合のみ。その場合も短いblocker/handoffを1回だけ送る。
- 司令塔はworker報告で親チャットを流さず、必要ならheartbeat/read_threadで静かに確認する。
- `askuserquestion` / `request_user_input` はTextbook worker promptで禁止する。外部判断が本当に必要な場合は、workerが親へ短いblocker/handoffを1回だけ送り、司令塔が判断を束ねる。
- `COMMANDER_TASKS.md` は細かく更新する。worker起動、状態分類変更、司令塔判断、main/deploy gate、blocking condition、完了確認、次アクション変更は都度反映する。
- ただし `COMMANDER_TASKS.md` にworker詳細ログを長文転載しない。Active workerあり、worker id、状態、次回確認条件、まさ要判断、完了/差し戻し/次アクションを短く残す。
- AMD配下のworktree、`.worktrees`、`/private/tmp` のclean worktreeでmd/run note/ledgerを編集する場合、追加のまさ承認待ちは不要。dirty main worktreeだけ避け、必要ならclean worktreeでそのまま進める。
- Vercel deploy approval gateを最優先する。2026-06-04 まさ判断でdeploy上限は緩和され、deploy自体は再開OK。ただし少しの間、Vercel production deploy / preview deploy / Vercel自動deployを起こす可能性がある `git push` の直前には、必ず `askuserquestion` でまさの許可を取る。
- 許可質問にはdeploy bundleを含める。内容は、含める変更、除外する変更、local build/test/browser確認結果、deploy予定回数、push/deploy先、rollback/本番確認方法。
- てにをは、微細UI、軽微CSS、md、コメント、ログ文言などを1件ずつdeployする運用は禁止のまま。複数worker成果を束ねて1回でdeployする。
- 承認待ちで止まる場合は `approval pending` として台帳に残す。未分類blocker扱いにしない。
- deploy bundle候補 / askuserquestion承認状況 / deploy実施回数 / push保留の有無は、未完タスク欄に短く反映する。
- heartbeatや巡回で未完タスクが残っていて進められるものがある場合は、司令塔がworkerを切る、既存workerを再起動/差し戻す、または司令塔自身で次アクションを実行する。
- 進められる未完タスクがない場合は、まさ確認/判断/作業が必要なはずなので、具体的な質問または判断依頼としてまさを動かす。
- `未完あり・全worker停止・まさにも何も聞かない` 状態は禁止する。
- 今後のTextbook worker promptから `完了・停止・要判断時は必ず親司令塔へ能動報告` を削除/上書きし、worker quiet mode、`askuserquestion` / `request_user_input` 禁止、終了ゲート、`git add .` 禁止、dirty分類、`UU` conflict時archive禁止を必ず含める。

## 出版北極星 (2026-06-12 まさ確定で改訂)

- この本の中心は、特定企業や特定モデルの紹介ではなく「研究成果が社会に出る直前でなぜ止まるのか」「会社になる前の混乱をどう読めばいいのか」に置く (不変)。
- **構成は「章頭ストーリー型の教科書」** (2026-06-12 まさ確定)。各章 = 冒頭ストーリー (導入) → 解説 = メイン (概念・数式・図を章内で出す) → 実例 (匿名化ケース) → 章末の問い。詳細・新TOC (4部立て: I 現場 / II Before Zero Model = PRS × 戦略余力 / III 苗床 / IV 実践ツールキット) は `PUBLICATION_STRATEGY.md` §0。
- 旧方針「BZMは前半から説明しない」「理論は Method Appendix へ分離」は superseded。PRS の数式・戦略余力モデルの図は該当章の本文中に書く。
- 既存 public-manuscript の composite case アーク (Prologue〜Epilogue 一本線) は素材として再利用するが、アーク保全は要件ではない (まさ「使える素材は使っておけ。でも全体の流れなんかは気にせず崩して」)。
- 事例は**匿名化必須**。実名化は出版までに合意が取れたものだけ後から (まさ確定 2026-06-12)。
- 理論の正本は `BZSF/before_zero_theory.md` + `BZSF/PRS_STRATEGIC_SLACK_OVERVIEW_20260612.html` (PRS 正式採用 + 戦略余力 = S の動学層、2026-06-12 確定)。教科書 worker は repo 内の旧「PRS=候補」記述を信じない。
- GAPファンド/VC/CEO論などの強い現場シーンは、本の中心ではなく、Before Zero の構造を読者に体感させる代表例として扱う (不変)。
- OS上の `/bzm` 導線は、公開本づくりの混乱を避けるため表示名を `教科書` に寄せる。内部slugや既存URLは互換性維持のため当面 `/bzm` のままにする (不変)。
- deploy/push 運用は 2026-06-12 以降 `pwa/CLAUDE.md` の新ルール (main push = 本番、原則ノンストップ・事後報告。md-only push は Vercel build skip) に従う。本台帳の旧 approval gate 記述 (2026-06-04) より新ルールを優先する。

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
- 2026-06-02: `Textbook P0 narrative enrichment rewrite` worker完了。Ch01/06/09/19へ paid evidence / payment refusal / budget-owner absence / survival probability / earning body を場面として増補し、Ch04/08/13/18へ repeat-back / blank-cell / bad-news behavior によるfit/misfitを最小追加。Ch21〜Ch24はField Toolkit分離のH1/manifest alignmentのみ取り込み。成果記録は `pwa/bzm/textbook/runs/2026-06-02-p0-narrative-enrichment-rewrite.md`。
- 2026-06-02: `Textbook P0 consequence rewrite` を司令塔直接作業で実施。Ch01/06/09/19の paid evidence / payment refusal / RESOURCE_SHIFT が、資料・部屋・関係・次の条件を実際に変える場面になるよう局所改稿。Ch08/10/13/18にもbad-news owner、学習ログ後の関係の痛み、repeat-back重複圧縮を追加。成果記録は `pwa/bzm/textbook/runs/2026-06-02-p0-consequence-rewrite.md`。
- 2026-06-02: `Textbook P0 consequence cold-reader/editor review` worker完了。P0 consequence rewriteは7.4/10で前進、Ch01/06/09/19は資料・部屋・関係・RESOURCE_SHIFTの代償が増えた。一方でCh08は責任論へ戻り、Ch13/18はrepeat-back arcがまだ重複するため、次はCh08/13/18 overlap compression and actor-rationality passを推奨。成果記録は `pwa/bzm/textbook/runs/2026-06-02-p0-consequence-cold-reader-editor-review.md`。
- 2026-06-02: `Textbook P0 consequence rewrite` 司令塔レビュー通過。`9290057 docs(textbook): rewrite p0 consequence scenes` は差し戻しではなく、cold-reader/editor reviewでも7.4/10で前進判定。次は全体rewriteではなくCh08/13/18 overlap compressionへ進める。成果記録は `pwa/bzm/textbook/runs/2026-06-02-p0-consequence-commander-review.md`。main merge / deployは未実施。
- 2026-06-02: `Textbook Ch08/13/18 overlap compression and actor-rationality pass` worker完了。Ch08は弱い事実を戻す権限が若い事業化人材へ渡る行動で終わるよう圧縮。Ch13は外部経営候補の行動scene、Ch18はFRL/F_character/F_capabilityへのlean theory translationへ分離。成果記録は `pwa/bzm/textbook/runs/2026-06-02-ch08-13-18-overlap-compression.md`。md-onlyのためbuild/deployなし。
- 2026-06-02: `Textbook Ch19 RESOURCE_SHIFT artifact pass` worker完了。Ch19に横向きA4のRESOURCE_SHIFTメモを追加し、切る活動、曇る人、戻る時間/資源、下げる不確実性、九十日後の見直し日を本文内artifactとして具体化。Ch20へ投資家紹介を減らした代償を一文だけ接続。成果記録は `pwa/bzm/textbook/runs/2026-06-02-ch19-resource-shift-artifact-pass.md`。md-onlyのためbuild/deployなし。
- 2026-06-02: `Textbook Field Toolkit reference-mode cleanup Ch22-Ch24` worker完了。Ch22を現場メモ安全化の六手順、Ch23を結論直前の四枚の紙、Ch24を研究機関の九十日pilot charter / unknown-not_started / responsibility pipeline / stop-expand gateへ整理。成果記録は `pwa/bzm/textbook/runs/2026-06-02-field-toolkit-reference-mode-cleanup.md`。md-onlyのためbuild/deployなし。
- 2026-06-03: `Textbook support boundary pass` 司令塔直接作業で完了。Ch11/14/19/21へ、支援部署・企業・投資家・資金提供側・大学側の局所合理性を補強し、悪役化せず「正しい圧力同士の未調整」が研究者を急がせる構図へ寄せた。成果記録は `pwa/bzm/textbook/runs/2026-06-03-support-boundary-pass.md`。md-onlyのためbuild/deployなし。
- 2026-06-03: `Textbook full-book ruthless editor narrative appeal audit` worker完了。Ch00〜Ch24のpage-turner性は7.6/10で、Ch00〜10とCh19〜21は販売本の芯として成立、Ch11〜14とCh16〜18に読書疲労、理論名ステージング、hidden listが残るため、全体再rewriteではなく章別surgical orderへ分解。成果記録は `pwa/bzm/textbook/runs/2026-06-03-full-book-ruthless-editor-narrative-appeal-audit.md`。review noteのみのためbuild/deployなし。
- 2026-06-03: `Textbook Ch16-Ch18 theory-name demotion rewrite` 司令塔直接作業で完了。Ch16は `準備できています` の一文を五つの受け手へ書き直す場面へ、Ch17は8:12公募メールと地域corridorのホワイトボードへ、Ch18は創業者機能を九十日配置メモへ寄せ、理論名ステージングを後段の短い命名へ圧縮。成果記録は `pwa/bzm/textbook/runs/2026-06-03-ch16-18-theory-name-demotion-rewrite.md`。md-onlyのためbuild/deployなし。
- 2026-06-03: まさ方針「式は後でよい。まずは今のまま物語を仕上げる」を受け、`Textbook story finish midbook consequence pass` を実施。Ch11は公募申請書の危ない一文、Ch12は投資家アップデート予定の送信寸前、Ch13は外部候補のフォローアップメールで強い言葉へ戻る場面、Ch14は別研究者が支援メニューPDFでまた止まる場面を追加。成果記録は `pwa/bzm/textbook/runs/2026-06-03-story-finish-midbook-consequence-pass.md`。md-onlyのためbuild/deployなし。
- 2026-06-03: `Textbook epilogue story close` を実施。Prologueの「少し強すぎた一文」に呼応するEpilogueとして、半年後の別案件で若い事業化人材が企業返答の一文を少し弱く戻し、今回は研究者が黙らず送信できる場面を追加。Ch21後、Field Toolkit前にEpilogueをmanifest追加。成果記録は `pwa/bzm/textbook/runs/2026-06-03-epilogue-story-close.md`。
- 2026-06-03: `Textbook full-story readthrough bridge cleanup` を実施。Prologue〜Epilogueの一気読みで見えた章末の `次の章では` / `この章で` / `Act I` などの設計図の声を削り、次の場面へ自然につながる余韻へ変更。成果記録は `pwa/bzm/textbook/runs/2026-06-03-full-story-readthrough-bridge-cleanup.md`。

## 未完タスク（優先順位順）

- **2026-06-12: 章頭ストーリー型教科書への全面再構成 (出版プロジェクト本体) / `Active`**
  - お願いした内容: 本を「ナラティブ一本線」から「章頭ストーリー型教科書」(冒頭ストーリー → 解説・数式・図 = メイン → 匿名化実例 → 章末の問い) へ再構成し、出版可能な完成原稿まで育てる。
  - 背景: まさの理想構成 (2026-06-12 確定)。PRS モデルの数式を巻末でなく章内で全解説し、事業化到達度×戦略余力の (x,y) グラフも本文に置く。読者 = 全国の産連/URA、VC、研究者、学生。
  - 現状: 新TOC (4部立て) と章型を `PUBLICATION_STRATEGY.md` §0 に確定。PRS=正式モデル + 戦略余力 = S の動学層 (正本 `BZSF/before_zero_theory.md` / `PRS_STRATEGIC_SLACK_OVERVIEW_20260612.html`)。repo 内の旧「PRS=候補」表記は bzm/5-1 付記・design/amd_score.md で同期済み。プロトタイプ章 (第II部 戦略余力モデル章、かるべ案件由来の出口設計ケース込み) を司令塔直接作業で執筆中 → まさレビューで型確定後に章単位 fan-out。
  - 残課題: (1) 残り図版 (二層アーキテクチャ・進化系譜 ほか各章ぶん) (2) ケース台帳 (匿名化事例 bank) (3) 第I〜IV部の章単位 fan-out (worker 並列、納品章を bzm-chapters.ts へ登録) (4) D-7 routing target の新教科書受け皿再設計 (現状は legacy fallback) (5) 通し編集・禁止語lint・出版パッケージ。
  - 2026-06-13 **型確定 + OS差し替え実施**: まさが rev2 を承認 (「めっちゃ良くなった」「差し替えで入れちゃおう」)。プロトタイプを `pwa/bzm/strategic-slack.md` へ昇格し、`/bzm` を新教科書 (章頭ストーリー型) へ差し替え。旧24章は `pwa/bzm/legacy/` へ退避、旧ナラティブ版は `/bzm/public` で閲覧継続。applier は legacy fallback。bzm-chapters.ts は新6部構成 (序章/I現場/II Model/III苗床/IVツールキット/巻末)。v0.19.1 production 反映済み。
  - 2026-06-13 **第II部 wave1 (4章) 納品・公開**: worker 4本並列で why-valuation-fails / model-overview / p-potential / r-readiness を執筆。司令塔レビュー (丸数字ガード・禁止語・章型・密度) 通過、f9 (ハイプ乖離図) 生成・埋込、目次登録。第II部は5章に。残る図版TODO: 三因子概念図・二層アーキテクチャ図・進化系譜図 (概念図につき外部生成またはまさ判断)、TAM/SAM/SOM×証拠の質、P(t)階段、五枚に割れる図、TRLマトリクス、R/y分解図。wave2 worker (S生存確率 / 計算式と律速 / 批判と限界 / 検証retrofit) を起動。
  - 2026-06-13 進捗: プロトタイプ rev1 へのまさレビュー 5 点 (KPI論の追加 / 冒頭ストーリーを一社依存ロックイン失敗ケースとして拡張 / 戦略余力の全成分を解説 (交渉力偏重の解消) / 文章増量・新人URA/研究者/学部生が読める粒度 / 鋸歯グラフ必須) を rev2 へ反映。図版 f6 (x,y)平面・f7 鋸歯時系列・f8 軌跡4パターンを `bzm_figures.py` で生成し本文へ埋め込み。KPI論はまさ直出し思想として `AUTHOR_DIRECTIVES.md` (2026-06-13) と `knowledge/license_negotiation.md` に保全。

- 2026-06-04: `Textbook Vercel deploy approval gate` Active。Vercel deploy上限は緩和され、deploy自体は再開OK。ただし、production deploy / preview deploy / Vercel自動deployを起こす可能性があるpushの直前には、必ずdeploy bundle付きで `askuserquestion` 承認を取る。deploy bundle候補: Textbook story baseline、Field Toolkit UI、Method Appendix、static reader / Cloudflare reader記録、Vercel ignore gate、その他local検証済み変更をbundle候補として整理する。askuserquestion承認状況: 未承認。deploy実施回数: 2026-06-04 gate更新後 0回。push保留: あり。承認待ちになった場合は `approval pending` として記録する。成果物: `pwa/bzm/textbook/runs/2026-06-04-vercel-deploy-approval-gate.md`。

- 2026-06-03: `Textbook main integration execution` 完了。`codex/textbook-full-story-final-readthrough-polish` をcurrent Textbook story baselineとして `main` へ反映。`HEAD` / `origin/main` は `3fd31fa docs(textbook): audit final publication readiness` で一致。main反映前 `npm run build` passed、manifest consistencyはmissing/unlistedともに `[]`。release checkpointとしてproduction deployを1回だけ試行したが、Vercel quota blocker `Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day")` によりproduction未反映。retry連打は禁止方針に従い停止。2026-06-04 approval gateにより、次に本番へ出す場合はdeploy bundleを提示し、askuserquestion承認後に1回だけpush/deployする。成果物: `pwa/bzm/textbook/runs/2026-06-03-main-integration-deploy-checkpoint.md`。

- 2026-06-03: `Textbook final publication readiness audit` 完了。Prologue〜Epilogueの物語はbranch上で完成ラインに入り、Field Toolkit / Method Appendix / Model Notesも三層分離として成立。販売前完成ではないが、残課題はfull rewriteではなくModel Note表示、Method Appendix navigation、formula typography、production/staging visual check、sales package。main integration executionへ進める判定。成果物: `pwa/bzm/textbook/runs/2026-06-03-final-publication-readiness-audit.md`。

- 2026-06-03: `Textbook route/main integration review` 完了。story polish branchへ最新 `origin/main` の9コミットをmergeし、衝突なしで取り込み。`origin/main...HEAD` は `0 33` となり、main-only commitは残っていない。`npm run build` passed。main push/deployは未実施。成果物: `pwa/bzm/textbook/runs/2026-06-03-route-main-integration-review.md`。次は `main integration execution` または `final publication readiness audit`。

- 2026-06-03: `Textbook Appendix cold-reader review` 完了。Model NotesとMethod Appendixはconditional pass。物語本文を壊さずモデル説明の置き場所を作れているが、Model Note proseの「このModel Noteは」「巻末の...」はややscaffoldingが見えるため、次はroute/main integration reviewまたはlayout/readabilityで視覚的optional化を検討。成果物: `pwa/bzm/textbook/runs/2026-06-03-appendix-cold-reader-review.md`。次は `route/main integration review` または `Method Appendix layout/readability pass`。

- 2026-06-03: `Textbook Model Note prototype` 完了。Ch16とCh19にだけ短いoptional Model Noteを追加し、物語本文を壊さず補遺へ橋をかける試作を実施。Ch16はTRL/BRL/GRL/SRL/HRL、Ch19は統合準備度式とRESOURCE_SHIFTの関係を短く示し、詳細はMethod Appendixへ逃がした。成果物: `pwa/bzm/textbook/runs/2026-06-03-model-note-prototype.md`。次は `Appendix cold-reader review` または `route/main integration review`。

- 2026-06-03: `Textbook Public notation rewrite` 完了。旧 `pwa/bzm/9-2-notation.md` の中核式と記号を、Method Appendix M1/M2/M3/M4/M5/M7へ公開安全な説明として反映。branded score名、内部章番号、組織固有例、過度な精密感は避け、integrated readinessはrankingではなく次に減らす不確実性として整理。成果物: `pwa/bzm/textbook/runs/2026-06-03-public-notation-rewrite.md`。次は `Model Note prototype` または `Appendix cold-reader review`。

- 2026-06-03: `Textbook Method Appendix stub implementation` 完了。`Method Appendix — モデル補遺` をpublic manuscript末尾に追加し、M0〜M8のstub本文とmanifest sectionを作成。物語本文とField Toolkit本文は未変更。成果物: `pwa/bzm/textbook/runs/2026-06-03-method-appendix-stub-implementation.md`。次は `Public notation rewrite` または `Model Note prototype`。

- 2026-06-03: `Textbook Model Appendix TOC draft` 完了。物語本文へ式を差し込まず、`Method Appendix — モデル補遺` として M0〜M8 の公開向け構成を設計。sigma_SU、TRL/BRL/GRL/SRL/HRL、FRL、integrated readiness、retrofit/evidence rule、ERS、misuse warningsを、Field Toolkit後または別appendix routeへ置く方針。成果物: `pwa/bzm/textbook/runs/2026-06-03-model-appendix-toc-draft.md`。次は `Method Appendix stub implementation` または `route/main integration review`。

- 2026-06-03: `Textbook model exposition placement brief` 完了。Prologue〜Epilogueの物語本文を壊さず、モデル説明・式・記号をどこへ置くかを設計。方針は、本文には短いoptional Model Noteだけ、式・重み・記号・境界条件は別のMethod Appendixへ分離。成果物: `pwa/bzm/textbook/runs/2026-06-03-model-exposition-placement-brief.md`。次は `Model Appendix TOC draft` または `route/main integration review`。

- 2026-06-03: `Textbook Field Toolkit layout/readability pass` 完了。Ch22〜Ch24を本文の続きではなくField Toolkit / 参照道具として見せるため、Toolkit章の本文上部と左ナビに控えめな付録表示を追加した。成果物: `pwa/bzm/textbook/runs/2026-06-03-field-toolkit-layout-readability-pass.md`。次は `model exposition placement brief` または `route/main integration review`。

- 2026-06-03: `Textbook Ch16-Ch18 theory aftertaste pass` 完了。full-story cold-reader reviewの次surgical orderに沿って、理論名は削らず、TRL/BRL/GRL/SRL/HRL、sigma_SU、F_character/F_capabilityの直後に紙やメモへ戻る一文を追加した。成果物: `pwa/bzm/textbook/runs/2026-06-03-ch16-18-theory-aftertaste-pass.md`。次は `Field Toolkit layout/readability pass` または `model exposition placement brief`。

- 2026-06-03: `Textbook Ch12-Ch14 breath pass` 完了。full-story cold-reader reviewの次surgical orderに沿って、Ch12〜Ch14の中盤疲労を全体rewriteせず、各章一箇所だけ紙・余白・線へ戻して息継ぎを作った。成果物: `pwa/bzm/textbook/runs/2026-06-03-ch12-14-breath-pass.md`。次は `Ch16-Ch18 theory aftertaste pass`。

- 2026-06-03: `Textbook full-story cold-reader review Prologue-Epilogue` 完了。Prologue〜Epilogueは、強すぎた一文から弱いまま送れる一文へ閉じる一冊の物語として継続可。販売前完成原稿ではないが、全体再rewriteではなくCh12〜14 breath pass、Ch16〜18 theory aftertaste pass、Field Toolkit layout/readability、model exposition placement briefへ進む判定。成果物: `pwa/bzm/textbook/runs/2026-06-03-full-story-cold-reader-review-prologue-epilogue.md`。

- 2026-06-03: `Textbook epilogue final question polish` 完了。Epilogue終盤の抽象まとめを、若い事業化人材が送信前の紙の端へ線を引く動作へ戻し、会社化すべきもの/待つべきもの/会社以外の形を、最後の問いへ向かう記憶として保持した。成果物: `pwa/bzm/textbook/runs/2026-06-03-epilogue-final-question-polish.md`。次は `full-story cold-reader review Prologue-Epilogue`。

- 2026-06-03: `Textbook full-story ending voice polish` 完了。Ch21/Epilogue終盤に残っていた `本編の会議` / `前の物語` / `成功物語` の本側の締め声を、会議室と半年前の沈黙へ戻した。成果物: `pwa/bzm/textbook/runs/2026-06-03-full-story-ending-voice-polish.md`。次は `full-story cold-reader review Prologue-Epilogue`。

- 2026-06-03: `Textbook full-story outline residue polish` 完了。Prologue〜EpilogueとField Toolkit冷読で残っていた `前の章` / `創業者を見る章` / `この本` 型のアウトライン声を、ホワイトボードに残った判断語、面談メモ、書き直した紙、九十日メモ横の地図、Toolkitの紙束へ戻した。成果物: `pwa/bzm/textbook/runs/2026-06-03-full-story-outline-residue-polish.md`。次は `full-story cold-reader review Prologue-Epilogue`。

- 2026-06-03: `Textbook full-story cold readthrough surgical polish` 完了。Prologue〜Epilogue冷読で速度が落ちたCh07/08/10/20の判断語・責任論・関係修復・苗床接続説明を、ホワイトボード、三十日行動メモ、学習ログ、研究機関側会議の入口へ戻した。成果物: `pwa/bzm/textbook/runs/2026-06-03-full-story-cold-readthrough-surgical-polish.md`。次は `full-story cold-reader review Prologue-Epilogue`。

- 2026-06-03: `Textbook Prologue-Epilogue story voice polish` 完了。Prologue/Ch02/Ch13/Ch18/Ch21に残る読者契約・理論予告・説明声を、若い事業化人材のノート、会議メモ、研究者との会話へ戻した。加えて章番号参照を出来事の記憶へ置換し、章末の結論文を面談メモ/九十日メモ/三つの紙へ戻した。成果物: `pwa/bzm/textbook/runs/2026-06-03-prologue-epilogue-story-voice-polish.md`。次は `full-story cold-reader review Prologue-Epilogue`。

- 2026-06-03: `Textbook full-story final readthrough polish` 完了。Prologue〜Epilogue方針を維持し、Ch06/15/21/Epilogueに残っていた説明声を、会議メモ・地図・紙・メールの場面へ戻した。成果物: `pwa/bzm/textbook/runs/2026-06-03-full-story-final-readthrough-polish.md`。次は `full-story cold-reader review Prologue-Epilogue` と `model exposition placement brief`。

- 2026-06-02: `Textbook Act V Ch15-24 cold-reader/editor review` 完了。Ch15〜Ch21はmain narrative endingとして継続可、Ch22〜Ch24はField Toolkit appendixへ分離推奨。成果物: `pwa/bzm/textbook/runs/2026-06-02-act-v-ch15-24-cold-reader-editor-review.md`。
- 2026-06-02: `Textbook Field Toolkit reference-mode cleanup Ch22-Ch24` 完了。Ch22〜Ch24はField Toolkit A/B/Cとして、A=メモ安全化、B=判断/開示、C=機関pilotの役割差を明確化。成果物: `pwa/bzm/textbook/runs/2026-06-02-field-toolkit-reference-mode-cleanup.md`。
- 2026-06-03: `Textbook support boundary pass` 完了。Ch11/14/19/21で、支援者・投資家・企業・大学・資金提供側の合理性を保持しつつ、未調整圧力が premature GO / over-strong deck / RESOURCE_SHIFT friction を生む構図へ補強。成果物: `pwa/bzm/textbook/runs/2026-06-03-support-boundary-pass.md`。
- 2026-06-03: `Textbook full-book ruthless editor narrative appeal audit` 完了。Ch00〜Ch24は7.6/10。次はCh16〜Ch18 theory-name demotion、Ch11〜Ch14 midbook consequence source mining / surgical pass、Ch00〜Ch24 bridge/meta residue cleanupへ進む。成果物: `pwa/bzm/textbook/runs/2026-06-03-full-book-ruthless-editor-narrative-appeal-audit.md`。
- 2026-06-03: `Textbook Ch16-Ch18 theory-name demotion rewrite` 完了。Ch16〜Ch18の `あとでXと呼ぶ` 型の理論名ステージングを減らし、準備度・位相差・創業者機能を、文書/メール/配置メモが会議で変わる場面へ寄せた。成果物: `pwa/bzm/textbook/runs/2026-06-03-ch16-18-theory-name-demotion-rewrite.md`。
- 2026-06-03: `Textbook story finish midbook consequence pass` 完了。式/モデル説明追加はいったん後回しにし、Ch11〜Ch14へ各章一つずつ、追い風・準備・外部候補・支援メニューが具体的な文書/予定/メール/次研究者を変える場面を追加。成果物: `pwa/bzm/textbook/runs/2026-06-03-story-finish-midbook-consequence-pass.md`。
- 2026-06-03: `Textbook epilogue story close` 完了。Prologueと呼応するEpilogueを追加し、本編を「強すぎた一文」から「弱いまま送れる一文」へ閉じた。成果物: `pwa/bzm/public-manuscript/25-epilogue.md`, `pwa/bzm/textbook/runs/2026-06-03-epilogue-story-close.md`。
- 2026-06-03: `Textbook full-story readthrough bridge cleanup` 完了。物語の筋は変えず、Ch03/10/12/14/15/16/18/20の章末メタ語・講義的ブリッジを圧縮し、読者にアウトラインを見せずに次の場面へ進む文へ変更。成果物: `pwa/bzm/textbook/runs/2026-06-03-full-story-readthrough-bridge-cleanup.md`。


- **page-turner編集レビューと素材発掘ループ**
  - お願いした内容: 公開原稿を「ついつい読み進めてしまう本」として磨くため、本文writerとは別に編集者workerと素材発掘workerを走らせる。
  - 背景: 現状はnarrative要素が入り始めたものの、販売本として読者を引っ張る魅力度と、AMDで培ったBefore Zero実務ノウハウの厚みがまだ足りないため。
  - 現状: 2026-06-02までに、editorial narrative reset audit、OS field knowhow harvest v6、public book architecture reset briefをmainへ回収し、旧BZM/会社紹介寄りの導線をpublic manuscriptへ切り替え済み。司令塔直接作業でCh00〜Ch03をAct I、Ch04〜Ch06をAct II、Ch07〜Ch10をAct III、Ch11〜Ch14をAct IVとして、primary composite case「強くなりすぎたdeck sentence」が顧客証拠、時計衝突、研究者孤独、外部CEO displacement、開示事故寸前、登記/生存確率判断、90日WAIT、責任配置、投資家面談、学習ログ、追い風、公募、準備度の混同、外部経営候補、研究機関の苗床へ進むnarrativeに改稿。Act IV冷読レビューは `2026-06-02-act-iv-cold-reader-editor-review.md` として完了。2026-06-02にCh15〜Ch18をAct V前半 / theory-map entranceとして、同じ案件が期待・低い条件・人の傷・資金圧力で再び混ざり、現場語だけでは整理できなくなる流れからBZM、TRL/BRL/GRL/SRL/HRL、sigma_SU、mu_A/mu_I/mu_G、FRL/F_character/F_capabilityを導入する本文へ改稿。rewrite note `2026-06-02-act-v-theory-map-narrative-rewrite.md` を追加。Act III用 source mining workerも `2026-06-02-act-iii-source-mining.md` を追加し、Ch07〜Ch10向けに composite scene 16件、tool/question/checklist 24件、各章5件のinsertion mapを整理。Act V/Toolkit source mining workerが `2026-06-02-act-v-toolkit-source-mining.md` を追加し、Ch19〜Ch24向けに composite scene 14件、tool/question/checklist 30件、各章4件のinsertion map、Field Toolkit抽出候補、author directive投入点、安全分類を整理。Ch15〜Ch18冷読レビューは `2026-06-02-act-v-ch15-18-cold-reader-editor-review.md` として追加。Act V前半は7.8/10でCh19〜Ch24 rewriteへ進行可。ただしCh16/17/18にtheory-name staging、FRL定義ブロック、hidden listが残るため、Ch19〜Ch24後にCh00〜Ch24 surgical residue passが必要。2026-06-02にCh19〜Ch24をAct V後半 / Field Toolkit narrativeとして、統合地図をsurvival conversation / RESOURCE_SHIFTへ、retrofitをold evidence rule -> new evidence ruleへ、ERSを研究機関operating designへ、field note safety / decision-disclosure / nursery pilotを場面内で使われる道具へ改稿。run note `2026-06-02-act-v-field-toolkit-narrative-rewrite.md` を追加。Ch15〜Ch24冷読レビューは `2026-06-02-act-v-ch15-24-cold-reader-editor-review.md` として追加し、Act Vは8.0/10、全体再rewriteではなくCh00〜Ch24 surgical residue passとField Toolkit appendix extractionへ進む判定。
  - 残課題: 2026-06-03 full-book ruthless editor auditで、Ch00〜Ch10とCh19〜Ch21は本の芯として成立、Ch11〜Ch14は中盤の新しい代償不足、Ch22〜Ch24はField Toolkitとしてのappendix明確化が必要と判定。Ch16〜Ch18 theory-name demotionは2026-06-03に完了。全体再rewriteではなく、v6素材台帳、Act III source mining素材、Act V source mining素材を本文へ直接貼らずcomposite scene / tool artifact化して章別surgical passへ渡す。
  - 次worker候補: full-story cold-reader review Prologue〜Epilogue、Ch13/18 final repetition check、model exposition placement brief、Field Toolkit packaging / public route clarity。



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
  - 背景: D-7 Textbook Insights、applier、routing、changelog、source path、production deployなどは運用には必要だが、販売本の本文には混ぜてはいけないため。
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

- **D-7 Textbook Insights候補抽出・承認・追記フローを実運用に乗せる**
  - お願いした内容: Supabase内の既存L2/OSデータからTextbook追記候補を抽出し、通知で承認し、承認後にlocal applierで `pwa/bzm/*.md` へ安全に追記する。
  - 背景: Vercel runtimeやPWA APIからgit管理ファイルを直接編集せず、候補化、承認、local追記、commit/pushの二段階で事故を避けるため。
  - 現状: `textbook_insight_candidates`、通知feedback、`apply_approved_textbook_insights.mjs`、L10 SKILL、specは実装済み。migration 116も本番DBへ適用済みで、schema docsも同期済み。
  - 残課題: 既存候補のbackfill、実データでの候補品質確認、承認後の追記運用、applier実行後のcommit/deploy運用を実ケースで回す。

- **BZM司令塔レビューが必要な候補の扱いを固める**
  - お願いした内容: BZM理論、用語、rubric、数式、重み、章構成へ影響するTextbook候補を、Textbook司令塔だけで通さずBZM司令塔レビューへ回す。
  - 背景: Textbookは掲載形式と実践テキスト運用を持つが、BZM理論の一貫性やモデル変更判断はBZM司令塔の守備範囲だから。
  - 現状: `bzm_review_required`、`bzm_review_status`、`theory_change_scope` が候補DBに追加済み。applierはBZM未承認の理論候補をskipする。
  - 残課題: BZM司令塔がどうレビューし、誰が `bzm_review_status` を更新するかの運用UI/手順が未実装。通知UIから直接更新するか、司令塔レビュー経由にするか決める。

- **新章へのD-7 Textbook Insights target routingを調整する**
  - お願いした内容: D-7 Textbook Insights候補の `practice_kind` や内容に応じて、追記先を新章 `8-2`〜`8-5` へ自然に振り分ける。
  - 背景: Phase 1実践章を追加したので、従来defaultの `8-1-amd-os-operations` に実務知見が集中すると、章の役割がまた曖昧になるため。
  - 現状: 新章slugはmainに反映済み。specにはtarget routingの考え方があるが、helper側の具体的な新章振り分けはまだ次候補。
  - 残課題: `decision_branch` は `8-2`、`failure_learning` は `8-3`、`relationship_playbook` は `8-4`、`reusable_question` / `field_transition` は `8-5` など、生成側とapplier側のfallback方針を実装・検証する。

## 完了済みタスク

- **Textbook Act V Ch15-24 cold-reader/editor review**
  - お願いした内容: main反映済みのCh15〜Ch24を、Act I〜IVから続く本の後半として読めるか、理論説明/tool dumpへ戻っていないか、author directiveとappendix分離判断、Ch00〜Ch24 surgical residue範囲を冷読者・編集者目線でレビューする。
  - 背景: Ch15〜Ch18はBZM理論地図の入口、Ch19〜Ch24はsurvival conversation / evidence-rule update / institution operating design / Field Toolkitとして改稿済みだが、販売本の終盤では理論名・toolkit・チェックリストが前に出ると読書体験が落ちるため。
  - 現状: `pwa/bzm/textbook/runs/2026-06-02-act-v-ch15-24-cold-reader-editor-review.md` を追加。Act V全体は8.0/10で、Ch15〜Ch21はcomposite caseの終盤として成立、Ch19は生存確率・稼げる体質・小さなpaid evidence・Jカーブ/IPO一律化への疑問を判断イベントとして保持。Ch21が自然なnarrative closeで、Ch22〜Ch24はField Toolkit / appendix sectionとして分離すべきと判定。残る問題は会社名漏れではなく、Ch15〜18のtheory-name staging、Ch20のold/new evidence rule hidden list、Ch21の責任pipeline、Ch22〜24のtool density。
  - 残課題: 次workerはCh00〜Ch24 surgical residue pass、Field Toolkit appendix extraction、support boundary pass。全体再rewriteは禁止寄りで、本文内の強いsceneを壊さず、hidden list / 説明見出し / 理論名早出しだけを圧縮・移動する。

- **Textbook Act V Ch15-18 cold-reader/editor review**
  - お願いした内容: main反映済みのCh15〜Ch18を、Act I〜IVから続く読み物としてBZM理論地図へ自然に入れているか、定義/表/hidden list/理論名の早出しが残っていないか、Ch19〜Ch24へ何をrewriteすべきかを冷読者・編集者目線でレビューする。
  - 背景: Ch15〜Ch18はBZM、TRL/BRL/GRL/SRL/HRL、sigma_SU、mu_A/mu_I/mu_G、FRL/F_character/F_capabilityを出すAct V前半だが、販売本では理論名が本文を乗っ取ると読者が離れるため。
  - 現状: `pwa/bzm/textbook/runs/2026-06-02-act-v-ch15-18-cold-reader-editor-review.md` を追加。Ch15〜Ch18は7.8/10でCh19〜Ch24 rewriteへ進行可。Ch15のBZM entrance、Ch17のsame-week clock、Ch18のrepeat-back testは強い。一方でCh16/17の「あとで呼ぶ」型、Ch18のFRL/F_character/F_capability定義ブロック、90日役割紙のhidden listをsurgical residue対象に指定。
  - 残課題: 次workerはCh19〜Ch24をsurvival conversation / evidence rule update / institution operating design / Field Toolkit extractionとしてrewriteする。特にCh19で小さなpaid evidenceまたはpaid-signal refusalを場面化し、AUTHOR_DIRECTIVESの生存確率、稼げる体質、早すぎる起業、Jカーブ/IPO一律化への違和感を判断の中に残す。

- **Textbook Act V / Field Toolkit narrative rewrite Ch19-24**
  - お願いした内容: Ch19〜Ch24を、tool dump / checklist集ではなく、Act I〜V前半から続く読書体験の後半として、survival conversation / evidence-rule update / institution operating design / field-note safety / decision-disclosure tools / nursery pilot charterへ改稿する。
  - 背景: Ch19〜Ch24は統合判断、retrofit、機関準備度、field note safety、decision/disclosure toolkit、nursery checklistの役割を持つが、旧稿は表・チェックリスト・道具集の比重が高く、販売本の結末として読み物の熱が落ちる危険があったため。
  - 現状: 2026-06-02に本文を改稿し、Ch19は高期待の会議がGOへ戻りかけたところで統合地図を点数ではなく生存会話として使い、稼げる体質、小さな対価の良し悪し、Jカーブ/IPO一律化への疑問をRESOURCE_SHIFT判断へ接続。Ch20は外れた地図を人の失敗ではなく古い証拠ルールから新しい証拠ルールへの更新として扱い、Ch21は個別案件の低さと苗床の低さを分け、unknown / not_started / 責任pipelineへ進めた。Ch22〜Ch24は現場メモ安全化、deck sentence / 開示色分け / WAIT ledger / 予算者確認、九十日pilot charterを場面内で使われる道具として再配置。run note `pwa/bzm/textbook/runs/2026-06-02-act-v-field-toolkit-narrative-rewrite.md` を追加。
  - 残課題: Ch15〜Ch24 cold-reader/editor review、Field Toolkit appendix extraction、Ch00〜Ch24 surgical residue passへ進む。

- **Textbook Act V theory-map narrative rewrite Ch15-18**
  - お願いした内容: Ch15〜Ch18を、理論説明章/表/ワークブックではなく、Act I〜IVから続くcomposite caseが現場語だけでは整理できなくなることでBZM理論地図へ入る読み物に改稿する。
  - 背景: Ch15〜Ch18はBZM、readiness axes、macro alignment、founder readinessの理論語を出す必要があるが、理論語から始めると販売本では glossary / workbook に戻るため。
  - 現状: 2026-06-02に本文を改稿し、Ch15は期待・低い条件・人の傷・資金圧力が同じ案件に戻る会議からBZMを地図として導入、Ch16は研究者/企業/病院/産学連携/若手人材が違う準備を見ている会議からTRL/BRL/GRL/SRL/HRLへ接続、Ch17は公募メール/研究者/病院/企業/自治体の速度差からsigma_SUとmu_A/mu_I/mu_Gへ接続、Ch18は外部経営候補のrepeat-backと最初の90日からFRL/F_character/F_capabilityへ接続した。run note `pwa/bzm/textbook/runs/2026-06-02-act-v-theory-map-narrative-rewrite.md` を追加。
  - 残課題: Ch15〜Ch18 cold-reader/editor review、Ch19〜Ch24のAct V/Field Toolkit rewrite、Field Toolkit extractionへ進む。

- **Textbook Act IV cold-reader/editor review**
  - お願いした内容: main反映済みの public manuscript Ch11〜Ch14を、Act I〜IIIから続く読み物として成立しているか、理論説明章へ戻っていないか、composite case continuity / author directive retention / Act Vへの未解決問いを冷読者・編集者目線でレビューする。
  - 背景: Act IV rewriteで追い風、公募、準備度混同、外部経営候補、研究機関の土壌へ進んだため、Ch15〜Ch18のBZM理論地図へ入る前に、本としての接続と説明残りを判定する必要があった。
  - 現状: `pwa/bzm/textbook/runs/2026-06-02-act-iv-cold-reader-editor-review.md` を追加。Act IVは同じcomposite caseとして継続可、overall 7.4/10、Ch11とCh14のcontinuityは強い。一方でCh12〜Ch14にhidden list / theory-name leakage / explanatory heading residueが残るため、Act V後にCh00〜Ch18 surgical residue passとField Toolkit extractionが必要。
  - 残課題: 次workerはCh15〜Ch18をAct V前半として、同じcaseからBZM理論地図へ進める。理論名は現場語が足りなくなった後に出し、生存確率 / 稼げる体質 / 早すぎる起業 / Jカーブ一律化への違和感を判断軸として保持する。

- **Textbook Act IV macro/readiness/founder/institution narrative rewrite**
  - お願いした内容: Ch11〜Ch14を、Act I〜IIIから続くcomposite caseとして、追い風、準備度、創業者機能、研究機関の苗床を説明章ではなく読み物へ改稿する。
  - 背景: 旧Ch11〜Ch14は論点は正しいが、表・分類・チェックリストが多く、販売本としての流れが弱かったため。
  - 現状: 2026-06-02に司令塔直接作業で、Ch11を公募/企業/投資家の三通メールでWAIT条件が揺れる場面、Ch12を「準備できていますか」が五つの不安に割れる会議、Ch13を外部経営候補との二回目面談、Ch14を第三章の研究者孤独へ戻る研究機関の土壌として改稿。run note `pwa/bzm/textbook/runs/2026-06-02-act-iv-narrative-rewrite.md` を追加。
  - 残課題: Act IV冷読レビュー、またはCh15〜Ch18のAct V narrative rewriteへ進む。

- **Textbook Act I-III cold-reader/editor review**
  - お願いした内容: main反映済みの public manuscript Ch00〜Ch10を、Act I-IIIとして冷読者・編集者目線で通読レビューし、説明/箇条書き/ワークブックへの逆戻り、composite case continuity、AUTHOR_DIRECTIVES保持、Act IVへの未解決問いを判定する。
  - 背景: Ch00〜Ch10 rewrite後に、本としての連続読書体験が成立したか、deck sentence / budget owner / disclosure risk / WAIT as work / relationship repairが自然に接続しているかを本文編集前に判定する必要があったため。
  - 現状: `pwa/bzm/textbook/runs/2026-06-02-act-i-iii-cold-reader-editor-review.md` を追加。Act I-IIIは一冊の本の前半として継続可、overall 7.9/10、Act IVへ進行可。ただしCh00〜Ch10にはagenda compression、stakeholder enumeration、judgment vocabulary teaching、tool rehearsal、Ch03の`Act I`メタ語が残るため、Act IV後にsurgical residue passとField Toolkit extractionが必要。
  - 残課題: 次workerはCh11〜Ch14 Act IV narrative rewrite。Act IVはmacro/readiness/founder/institutionを説明章として始めず、同じcaseが一つの判断語では読めなくなる場面からreadiness mapへ進める。


- **Textbook Act III decision/responsibility/capital/learning narrative rewrite**
  - お願いした内容: Ch07〜Ch10を、Act I-IIから続くcomposite caseとして、判断語、責任配置、リスク資本面談、失敗学習を説明章ではなく読み物へ改稿する。
  - 背景: Ch07〜Ch10は正しい実務章ではあるが、表と説明が多く、本としての推進力が弱かったため。
  - 現状: 2026-06-02に司令塔直接作業で、Ch07を90日WAITが崩れかける会議、Ch08を予算者へ誰が会うかという責任の空欄、Ch09を投資家面談前夜の資料修正、Ch10を面談後の関係修復と学習ログへ改稿。run note `pwa/bzm/textbook/runs/2026-06-02-act-iii-narrative-rewrite.md` を追加。
  - 残課題: Act I-IIIを通読レビューし、Ch11〜Ch14も同じcase threadで書き換える。

- **Textbook Act I-II cold-reader/editor review**
  - お願いした内容: main反映済みの public manuscript Ch00〜Ch06を、Act I-IIとして冷読者・編集者目線で通読レビューし、まだ「読み進めたくなる本」になっていない箇所とAct III rewrite orderを出す。
  - 背景: まさ指摘のとおり、Ch00〜Ch06 rewrite後も箇条書き/説明/ワークブック臭が残っていないか、Ch04〜Ch06が場面として読ませているか、survival/earning directiveが説教臭くないかを本文編集前に判定する必要があったため。
  - 現状: `pwa/bzm/textbook/runs/2026-06-02-act-i-ii-cold-reader-editor-review.md` を追加。Act I-IIはdeck sentence composite caseとして継続可、Ch05は最も場面化に成功。ただしCh06→Ch07が判断語/表へ戻る危険、Ch00〜Ch03の説明/list residue、Ch06 paid-signal dramatization不足を指摘。
  - 残課題: Ch07〜Ch10をAct IIIとしてrewriteする。Ch07はWAITを行動へ、Ch08は責任配置を具体失敗へ、Ch09は資本面談を証拠更新へ、Ch10は失敗ログを関係修復へ変える。

- **Textbook Act II CEO/disclosure/incorporation narrative rewrite**
  - お願いした内容: Ch04〜Ch06を、Act Iから続くcomposite caseとして、CEO機能、開示、会社化タイミングの章から「説明/表/チェックリスト」の残り香を抜き、読ませる本文へ改稿する。
  - 背景: Act I cold-reader/editor reviewで、次はCh04を外部CEO displacement、Ch05をdeck sentenceの開示事故寸前、Ch06を生存確率/稼げる体質の意思決定として書き換えるべきとされたため。
  - 現状: 2026-06-02に司令塔直接作業で、Ch04を研究者が外部CEO要求を聞く場面、Ch05を送信予約寸前で止まる開示事故、Ch06を登記提案とpaid-signal/Jカーブ批判/WAIT return conditionの意思決定へ改稿。run note `pwa/bzm/textbook/runs/2026-06-02-act-ii-narrative-rewrite.md` を追加。
  - 残課題: Ch07〜Ch10のAct III rewriteは完了。次はAct I-IIIを通読レビューし、Ch11〜Ch14も同じcase threadで書き換える。

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
  - 現状: worker branch `codex/textbook-structure-base` で、前半5部の新規章 skeleton、序章、BZM chapter registry、8-1案内、附則を更新。既存理論本文と D-7 Textbook Insights target slug `8-2`〜`8-5` は温存。
  - 残課題: 司令塔レビュー待ち。実ケース本文は承認済み D-7 Textbook Insights候補から追記する。

- **Phase 1実践章追加**
  - お願いした内容: 既存slugを壊さず、第8部にBefore Zero実践章 skeleton を追加する。
  - 背景: Textbookを実践テキスト化するには、判断、失敗、関係構築、チェックポイントを受ける章が必要だったため。
  - 現状: `8-2-field-decisions-and-branches`、`8-3-failures-pivots-and-revisions`、`8-4-relationship-playbook`、`8-5-before-zero-checkpoints` を追加済み。`bzm-chapters.ts`、preface、`8-1`、changelogも更新済み。main反映済みでVercel productionもREADY確認済み。
  - 残課題: skeletonなので実ケース本文は未記入。今後のD-7 Textbook Insights承認候補で本文を育てる。

- **D-7 Textbook Insights metadata / confidentiality / BZM review gate 実装**
  - お願いした内容: Textbook候補に実践分類、機密区分、BZMレビュー要否、理論影響範囲を持たせる。
  - 背景: Before Zero実践テキストでは、単なるBZM理論補足だけでなく、機密度や理論変更リスクを分けて扱う必要があるため。
  - 現状: migration 116で `metadata_json`、`confidentiality`、`bzm_review_required`、`bzm_review_status`、`theory_change_scope` を追加済み。helper、applier、notifications最小表示、spec、SKILLも更新済み。
  - 残課題: 既存候補のmetadata backfill、BZMレビュー状態更新の運用UI、実データでのvalidation tuningが残っている。

- **migration 116本番適用とschema/docs同期**
  - お願いした内容: migration 116を本番DBへ適用し、`db_schema.md` とspecを現状へ同期する。
  - 背景: worker Bのmain pushによりproduction codeが新カラムを読む状態になり、migration未適用だとDB/code mismatchが起きたため。
  - 現状: OS司令塔がmigration 116を本番適用済み。`metadata_json` missingのRESTエラーは解消済み。worker Cがschema dumpを実行し、`pwa/design/db_schema.md` とspec/changelogを同期済み。
  - 残課題: 今回の事故を踏まえ、main push後のVercel production確認とDB/code compatibility確認をworker終了ゲートに入れ続ける。

- **Textbook worker quiet mode**
  - お願いした内容: workerが親司令塔チャットへ進捗・中間報告・自己判断の完了報告を送らないquiet modeへ運用変更する。
  - 背景: worker報告で親司令塔チャットが流れ、まさと司令塔が見るべきcurrent truthが埋もれやすくなったため。
  - 現状: 2026-06-03にTextbook司令塔継続運用ルールをquiet modeへ更新。workerは、まさがworker thread内で完全完了/OK等を明示した後だけ最終closeoutを1回送る。例外は `UU` conflict、未分類dirty、権限/破壊的操作/外部判断、進行不能blockerなど司令塔介入が必要な場合のみ。
  - 残課題: 今後新規worker promptから旧 `完了・停止・要判断時は必ず親司令塔へ能動報告` を削除/上書きし、`askuserquestion` / `request_user_input` も禁止する。台帳は細かく更新するが、worker詳細ログを長文転載せず、worker id、状態、次回確認条件、まさ要判断、完了/差し戻し/次アクションを短く残す。
