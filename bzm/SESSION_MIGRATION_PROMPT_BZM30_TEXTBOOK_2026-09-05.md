# 引っ越しプロンプト — BZM 3.0 教科書の並列起草（2026-09-05 中断分の再開）

cwd は `/Users/masa/projects/AMD/amd-os`（モノレポのルート。`pwa/` や `bzm/` を cwd にしない）。

## 読む順（全文）

1. `/Users/masa/projects/AGENTS.common.md`（えいみ共通ルール正本）
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`（AMD 横断 memory）
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`（モノレポ正本。末尾の「モデル（理論の正本）」の段落）
4. `/Users/masa/projects/AMD/amd-os/bzm/AGENTS.md`（BZM 構築セッションの研究規律。教科書化は理論を変えないので二重監査は省略可、ただし正本との整合検査は要る）
5. `/Users/masa/projects/AMD/amd-os/bzm/HANDOFF_BZM30_TEXTBOOK_2026-09-05.md`（現在地）
6. `/Users/masa/projects/AMD/amd-os/bzm/BZM_3_0_TEXTBOOK_PLAN.md`（**制作正本。章構成16件、正本との対応表、出版前提の規律、匿名化表。ワーカーへの共通指示書でもある**）
7. `/Users/masa/projects/AMD/amd-os/model/README.md`（(a)〜(f)。正本はモデルページ、md は読み込み元）
8. `/Users/masa/projects/AMD/amd-os/model/MODEL_VERSION_LEDGER.md`（**BZM 3.0 の正本本文、2,116行。全文 Read。** hook `guard_canon_read.py` がモデル定義を触る前の全文読みを要求する）
9. 既に書けた2章を読んで水準を掴む: `bzm/bzm-3-0-textbook-industrial-value.md`（第1章）、`bzm/bzm-3-0-textbook-observed-state.md`（第2章）
10. `/Users/masa/.claude/skills/japanese-tech-writing/SKILL.md`、`/Users/masa/.claude/skills/cognitive-rhythm-writing/SKILL.md`（執筆規範。ワーカーにも読ませる）
11. `bzm/BOOKS_PORTFOLIO.md` §2 の PF-001／PF-015／PF-016／PF-020、`bzm/BOOK_A_PUBLISHING_PLAN.md` §3.4〜3.5（出版パイプライン）、`bzm/textbook/PUBLICATION_POSITIONING.md`（匿名化の出版ゲート）
12. `pwa/BUGS.md` の `[git/multi-session]` 節（共有 checkout の事故）

## 状態スナップショット（2026-09-05 16:50 JST）

- まさの依頼（原文の趣旨）: 「一旦現状の BZM 3.0 をテキストブックに落とし込んでほしい。正式に本として出版する前提で準備を進めよう。各章を並列処理で一気に書き進めてほしい」
- 制作正本 `bzm/BZM_3_0_TEXTBOOK_PLAN.md` を新設し、**16ファイル（序＋第1〜14章＋付録）の章構成と正本の節対応、出版前提の規律を確定**した。
- 16本のワーカー（fable）を並列起動したが、**セッションのトークン上限（429、20:10 JST にリセット）で全ワーカーが途中停止**。書き切れたのは2章:
  - `bzm/bzm-3-0-textbook-industrial-value.md`（第1章、約33,000字。演習・次に読むもの・執筆メモまで完成）
  - `bzm/bzm-3-0-textbook-observed-state.md`（第2章、約38,000字。同上）
  - **残り14ファイル（序、第3〜14章、付録）は未着手**（ワーカーは正本を読んでいる途中で落ちた。ファイルは作られていない）
- 上記3ファイルは commit 済み（このセッションで push まで到達。SHA は HANDOFF を参照）。
- `pwa/src/app/(app)/bzm/bzm-chapters.ts` への登録は**まだしていない**（全章が揃ってから1回で登録し、Vercel の build を1回に束ねる。`/bzm` の左ナビには出ないが、slug 直打ち `/bzm/bzm-3-0-textbook-industrial-value` では読める）
- 附則 `bzm/9-5-appendix-changelog.md` に1行追記済み。
- 共有 checkout には別セッションの dirty（P1 論文 `PAPER_P1_*`、`sm_v2/`、`AUDIT_*`、`pwa/spec`・`pwa/manual` の L2 関連、`pwa/scripts/_support_programs_screenshot.mjs`）がある。**触らない。**

## 次タスク（この順で）

### 1. 残り14ファイルの並列起草

`BZM_3_0_TEXTBOOK_PLAN.md` §1 の表の行ごとに1ワーカー。**このセッションが使ったワーカー指示の型**を再現する（PLAN を読ませ、規範2本を読ませ、正本の担当節を行番号つきで全文読ませ、既存2章を体裁の見本にさせる）。ワーカー1本あたりの指示に必ず入れるもの:

- 担当 slug・h1・正本の担当節（PLAN §1 の行）と正本の行範囲。参考の行範囲: §1 41-46 / §2 49-113 / §3 117-131 / §4 134-157 / §5冒頭 160-207 / §5.2 210-273 / §5.3 276-300 / §5.4 303-425 / §5.5 428-438 / §5.6 441-463 / §5.7 466-537 / §5.8 540-592 / §5.9 595-611 / §5.10 614-633 / §5.11 635-650 / §5.12 652-655 / §5.13 657-673 / §6.0 676-696 / §6.A 699-755 / §6.B 758-791 / §6.C 795-868 / §6.D 871-902 / §6.E 905-967 / §6.F 970-1002 / §6.G 1005-1019 / §6.I-1 1051-1125 / §6.I-2 1128-1185 / §6.I-3 1188-1243 / §6.I-4 1246-1300 / §6.I-5 1303-1361 / §6.I-6 1364-1397 / §6.I-7 1400-1414 / §6.I-8 1417-1424 / §6.I-9 1427-1529 / §6.I-10 1532-1549 / §6.I-11 1553-1741 / §6.I-12 1744-1762 / §6.I-13 1766-1783 / §6.I-14 1787-1811 / §7 1832-1996 / §10 2019-2091（正本が改訂されていたら `grep -n '^## \|^### ' model/MODEL_VERSION_LEDGER.md` で取り直す）
- 前後の章の slug（PLAN §1 の順）
- 内容の柱（PLAN §1 の「正本の担当節」「主な式・記号」から起こす）
- 規律の再掲: である調／一文一行／KaTeX／式直後の記号表／表のセル内の縦棒は `\mid`／匿名化表 §2.3（AMD・まさ・えいみ・OS・画面・モデルページ・承認番号・正本・根拠印・実在案件名・BZSF・改訂の内部番号を出さない）／式・記号・値を1文字ずつ合わせる／LLM 空句禁止／節末の進行予告禁止／状態ブロック雛形 §2.2／到達目標3件／演習3〜5問／疑問は `<!-- 執筆メモ -->`
- 完了報告の形（パスと字数、節→§ の対応表、食い違いうる箇所、点検で直した点）

モデルは fable。**セッション上限に注意**: 16本同時で上限に当たった。上限が近いなら 4〜6本ずつに分けて回す（第3〜6章 → 第7〜10章 → 第11〜14章 → 序・付録の順。序と付録は全章が揃ってから書く方が整合が取りやすい）。

### 2. 正本との整合検査

全16ファイルが揃ったら、検査ワーカーを3本（第1〜5章／第6〜10章／第11〜14章＋序・付録）。各章の式・記号・係数の値・根拠レベルを正本の該当節と突き合わせ、食い違いを一覧にして直す。あわせて禁止語の機械検査:

```
grep -n -E 'AMD|まさ|えいみ|モデルページ|承認台帳|APPROVALS|#2026-|根拠\]\(#evidence|BZSF|OptQC|CryoX|LiSTie|マテリアル・コンセプト|KENQ|CrestecBio|JOYCLE|VasculaX|OPTMASS|SolvioraX|ORLIB|輝翠|ティエム|チャレナジー|Yellow Duck|r3kt|翔エンジニアリング|p0[0-9]|p[1-3][0-9]' bzm/bzm-3-0-textbook-*.md
```

（「AMD」は「AMD 目線」のような正本由来の語が混ざりうるので、ヒットは1件ずつ見る）

### 3. `/bzm` への登録と反映

`pwa/src/app/(app)/bzm/bzm-chapters.ts` の `BZM_PARTS` 先頭に部 `{ key: "bzm-3-0-textbook", label: "BZM 3.0 教科書 — 産業創出価値のスコアリングモデル", description: …, slugs: [16 slug を PLAN §1 の順] }` を足し、`BZM_CHAPTERS` に16件（slug・title・summary・status: "in-progress"）を足す。`cd pwa && npx tsc --noEmit && npm run build && npm run test:critical-ui`。**push は1回に束ねる**（Vercel は1日100デプロイ／アカウント）。`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で push と build 監視。本番 `https://amd-os-pwa.vercel.app/bzm` で左ナビ最上位に部が出て、各章の数式が KaTeX で描画されることを確認。

### 4. 出版準備の次の段（章が揃ったあと）

- PLAN §5 のとおり、`BOOK_A_PUBLISHING_PLAN.md` §3.4 の pandoc + LuaLaTeX（A5）で1章（第8章が数式最重量級）を試し組みし、崩れを見る
- 仮題の候補をまさへ提示（「Before Zero Model 3.0」を含む題。商標一次スクリーニングは `BOOK_A_TRADEMARK_RESEARCH_2026-07-09.md`）
- Book A（旧9軸の章）を BZM 3.0 へ差し替えるかは、まさの判断事項として選択肢を出す（PLAN §0 の注記）

## このPJで確立済みの運用ルール

- **編集したら即 commit、push は束ねて**。共有 checkout を5〜10セッションが使う。`git add` の前に `git diff --cached --name-status` で他セッションの stage が混ざっていないことを見る。`git add .` 禁止。今回の対象（`bzm/bzm-3-0-textbook-*.md`、`bzm/BZM_3_0_TEXTBOOK_PLAN.md`、`bzm/HANDOFF_BZM30_TEXTBOOK_*.md`、`bzm/SESSION_MIGRATION_PROMPT_BZM30_*.md`、`bzm/9-5-appendix-changelog.md`、`pwa/src/app/(app)/bzm/bzm-chapters.ts`）だけを名前で stage する。
- 着手前に `git fetch` → `git rev-list --left-right --count HEAD...origin/main` → `git log --branches --not --remotes --oneline`。behind があれば ff-only で解消してから触る。
- `bzm/9-5-appendix-changelog.md` は追記専用。Write で全文を書き直さず Edit で1行足し、commit 前に `git diff -- bzm/9-5-appendix-changelog.md` に `-` 行が無いことを確認。
- 正本 `model/MODEL_VERSION_LEDGER.md` と `model/LOCK.json` 対象ファイルは**書かない**（教科書は正本を写すだけ。食い違いを見つけたら教科書側を直すか、正本側の問題なら `model/proposals/` に提案を書く）。
- 教科書 md は `bzm/` 直下・小文字始まりの slug（大文字始まりは `/bzm` の目次に出ない台帳扱い）。
- 主張の地位は全章 `design-choice`＋`unvalidated`（前向き検証0件）。教科書化で証拠状態は変わらない。
- ワーカー起草物は「候補」。正本整合検査と禁止語検査を通してから「完成」と呼ぶ。
- まさへの報告は、画面で何が見えるようになったか（`/bzm` のどこに何章が出るか）から書く。ファイル名・SHA は末尾に一行。
