# Book A 出版準備セッション 引き継ぎプロンプト (2026-07-10 第3セッション → 次セッション)

BZM Book A『ディープテック起業の経営学』(仮) の出版準備専用セッション。第1章・第2章は**クローズ済み (completed)**。第3章は v1 完成・OS `/bzm/book-a-ch-3` 公開済み (まさ段落確定レビューのみ残、急がない)。**次の最優先タスクは第4章の起草** (潜在規模 P = 市場の天井と証拠の質)。

## 最初に読む (この順)

1. `/Users/masa/projects/AGENTS.common.md` — 大原則 (共通人格・作業姿勢・安全運用・記憶管理)。飛ばさない
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — **AMD level memory (cwd が AMD 配下なので冒頭必読)**
3. cwd が before-zero 配下なら そのセッションの auto-load memory も読む (**Fable 節約方針のカードあり — 必読**)
4. `cd /Users/masa/projects/AMD/amd-os && git fetch origin main && git show origin/main:pwa/bzm/HANDOFF_BOOK_A_2026-07-10.md` — 前セッション要約
5. 続けて同手順で `BOOK_A_MASTER_PLAN.md` (**§9 Ch 4**・§7 pipeline・§3 数式配置マップ) → `BOOK_A_CHAPTER_3_PROGRESS.md` (**最新の完成形手本** — verify 5/5 完走の実録・裁定粒度・事故対処) → `BOOKS_PORTFOLIO.md` (PF-015/016・§5 露出台帳) → `terminology_glossary.md` → 素材 `p-potential.md` + 前章接続用 `book-a-ch-3.md`

## 作業方式 (bzm ファイルの読み書き手順)

ローカル checkout に bzm ファイル群はない。
- **読む**: `cd /Users/masa/projects/AMD/amd-os && git fetch origin main && git show origin/main:pwa/bzm/<file>`
- **書く**: origin/main ベースの一時 worktree (`git worktree add --detach <tmp> FETCH_HEAD`) で対象ファイルだけ編集 → commit → `git push origin HEAD:main` (**push は単独実行して RC 判定、パイプ禁止**) → worktree remove。push が弾かれたら fetch → rebase → push。**ローカル main は触らない。新規ブランチは作らない**
- bzm の md / 台帳 / handoff 系の commit + push は**承認を取らず即実行** (まさ確定済み feedback)。**git commit 前に staged set を `git status` / `git diff --staged --stat` で必ず確認**
- **並走セッションあり**: push 前に必ず fetch。BUILD_VERSION は書く直前の値を見てから +1 (このセッション中も v0.39.18 → .37 まで並走が進めていた)

## 状態スナップショット (2026-07-10 第3セッション終了時点)

- **origin/main HEAD**: この handoff bundle の commit。まず `git fetch` で最新を取る
- **第1章**: ✅ クローズ (completed)。全論点確定。SVG 3点 (図1-1/1-2/1-3) の制作だけ別タスクで残る
- **第2章**: ✅ クローズ (completed)
- **第3章**: v1 公開済み (`book-a-ch-3.md`、9節・17,213字、status in-progress)。**まさ段落確定レビュー待ち** — 指摘が来たら反映して completed へ
- **第4章 (次の主戦場)**: 未着手。TOC 仕様 = `BOOK_A_MASTER_PLAN.md` §9 Ch 4。素材 = `pwa/bzm/p-potential.md` (実戦書ドラフト、リポに存在確認済み)。第II部「案件を測る」の開幕章
- **bzm-chapters.ts**: slug 登録済み。正本化時に book-a-ch-4 の status を not-started → in-progress に変えるだけ (第2-3章と同じ)
- **verify workflow scripts**: 第3章のものが手本 — skeleton `book-a-ch3-skeleton-wf_2d5adbbf-2a5.js` / draft `book-a-ch3-draft-wf_e394dfbf-d48.js` / verify+fix `book-a-ch3-verify-fix-wf_8c9f0b2d-f13.js` (いずれも前セッションの session dir 配下。パスは HANDOFF 参照ではなく中身の構造を真似るのが早い — L3 に全工程の記録あり)

## 次タスク詳細 (この順で実行)

### 1. 🔥 第4章の起草 (潜在規模 P — 市場の天井と証拠の質、26p 想定)

**同 pipeline** (第3章で完全実証済み): ①節 skeleton (3 persona 並列 [教科書編集者/MBA·MOT教員/BZM理論家]、Opus × 本体 synth) → ②まさ確定 (節構成レベル) → ③段落 outline/draft (Sonnet 5、9節前後並列) → ④adversarial verify (5 persona、Opus、**出力制約を全員に**) → ⑤must_fix 反映 (Sonnet) → ⑥本体裁定 → ⑦正本化 (book-a-ch-4.md、bzm-chapters status、BUILD_VERSION bump、push、表示確認)。

**Ch 4 の中身 (L1 §9 Ch 4 の要点)**:
- **章頭ケース**: p-potential.md 章頭 (「世界の水処理市場は1兆円」スライドと投資家の4つの問い) を A/B 分割 — A: 研究者に同行した担当者として、次の面談までに何を用意させるか。実例「不整地ロボット (天井の書き換え)」は演習素材に回す。⚠️ **「発電方式」実例は YD 素材 = 第10章の領土なので本章では使わない** (露出台帳整合)
- **was**: TAM/SAM/SOM の実務標準、トップダウン/ボトムアップ推定、Bass (1969) 拡散モデル、機会の発見 vs 創造 (Alvarez & Barney 2007 — **第3章 3.1/3.8 で名指し済み**。本章が「天井の測り方」の領土なので、ここで中身を回収する接続に注意)
- **therefore**: TAM は最も盛られやすい数字 / 天井は主張でなく**証拠の質**で刻む rubric (第三者データ / ユニットエコノミクス / 最初の顧客) / 天井は用途集合 U(t) の関数 = 戦略の関数であり**書き換え可能** — ただし書き換えとは証拠を作り直す作業 / 「P で落とすべき案件」の文書化 / 絶対スケール+達成率の**2読み方式は先出しのみ** (正本 = 第14章、前方参照規律)
- **数式アイテム**: P = 市場規模 × 到達可能ポジション × 波及射程 の構成 / 証拠の質の順序尺度 rubric (3尺度) / 用途集合 U(t) の拡張による天井の書き換え / 2読み方式の予告
- **前章接続**: 第3章 3.7・3.8 末尾が「『市場が大きい』という主張と『天井の証拠がある』ことは別物 — 測り方を第4章で作る」で閉じている。第4章の開幕はこれを受ける。第II部の開幕章でもある (部の扉の一言を置くかは skeleton 論点)
- **演習**: シーズカード2枚の P 採点 (証拠の質つき) — **カード No.2 の新設が必要になる見込み** (No.1 = 多孔質セラミック分離膜は継続。2枚目の設計は skeleton 論点として本体 synth → まさ確定に載せる) + 「政府調達数億円」と言われた案件の U(t) 拡張提案書 (不整地ロボット型)
- **到達目標**: P を証拠の質で採点し、「市場が大きい」と「天井の証拠がある」を区別して天井の改善提案ができる
- **帯域**: 15,000〜18,000字。**設計は 16,400〜16,600字が安全** (draft は設計比 +5〜9% 膨らむ実績 [第2章 +9%、第3章 +4%]。各節 ±10% 指示で起草)

### 2. 第3章のまさ段落確定レビュー対応

公開中 `/bzm/book-a-ch-3` v1 への段落レベル指摘が来たら反映 → status completed へ。指摘が無ければ触らない。

### 3. (低優先・まさ指示待ち) 石原先生打診パッケージ

Book A **監修**依頼 + P1 **共著**依頼の1パッケージ (D-061 / PF-015 で共著→監修に変わり得る点に注意)。えいみドラフト可。

## このPJで確立済みの運用ルール (事故防止)

- **執筆規律 (絶対)**: 数式全部入り (PF-001)、教育的順序 = 直感→式→worked example→演習。worked example は架空パラメータ・校正定数の採用値非公開 (PF-010)。定理の初出禁止 (学術書言及は「本書の理論的基盤を与える学術書 (刊行準備中)」の一般形のみ)。素材は実戦書ドラフト17章のみ (PF-004)。章頭ストーリー冊子間0%共有・露出台帳 (BOOKS_PORTFOLIO §5) を必ず確認
- **対外本文にプロセスを混入させない**: persona / workflow / skeleton / must_fix / PF-xxx / D-xxx / モノグラフ / Book B / **BZM** / 実名 / PJ略称 / validation 語彙は本文禁止 (機械検査 BANNED リストあり — 第3章 L3 参照)。数式水位は章ごとに許可記号リストを skeleton 時に確定する (第3章の例: PV, CF_t, r, E[V], P, R, S のみ)
- **制作モデルミックス (PF-016) + Fable 節約方針 (まさ指示 2026-07-09、memory 化済み)**: outline/draft/fix = Sonnet 5 / verify = Opus 4.8 / skeleton persona = Opus / **本体 (Fable) = 統合・裁定・記帳・報告のみ**。本体で長文を直接書かない (裁定と一体の微修正のみ例外)
- **⚠️ verify workflow の教訓 (第3章で更新 — 必ず適用)**:
  - **出力制約 (findings 最大10件・引用50字以内・fix_suggestion 2文以内) を5 persona 全員に最初から入れる** → 第3章で初の 5/5 完走 (第1-2章は student/auditor/instructor が JSON 肥大で落ちていた)
  - 本文は素材ファイル (`ch<N>-body-v1.md`) に書き出してから verify persona に Read させる (プロンプト埋め込みより軽く、クラッシュ安全)
  - workflow の resumeFromRunId は同一セッション限定。verify は1セッション内で完走させる
- **⚠️ 新教訓 (第3章 §3.6 事故)**: fix agent の StructuredOutput は稀に**途中破損**する (キリル文字混入・数百字で切断)。組み立て後に必ず機械検査を回す — ①全節の結び文が正常か ②文字種検査 (キリル文字等の混入) ③BANNED 語 ④図表番号の存在。破損した節は **workflow resume でなく単発 agent で再修正** (resume の cache は破損結果をそのまま返す)
- **⚠️ must_fix の裁定は本体が前後章の実文言と突合してから採用方向を決める**: 第3章で fix agent が指摘を逆方向に適用した実例あり (3.0 の「四語」は第2章 2.7 の逐語エコーで正しく、直すべきは 3.7 側だった)。verify の指摘が「AとBが食い違う」形のときは、どちらが正本かを自分で確かめる
- **記帳の順序**: 決定・成果は必ず正本 md (L1 / L3 / glossary / PF 判例) に記帳してから commit + push
- **コスト意識**: 完了通知のたびに細かく動かず、まとめて処理してターン数を最小化

## このセッションで作った branch/worktree

なし (origin/main ベースの一時 worktree で編集 → push → remove。新規ブランチなし。closeout 時に `git worktree list` = amd-os 本体のみを確認済み)。
