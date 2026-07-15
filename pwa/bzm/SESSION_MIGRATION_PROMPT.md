# SESSION MIGRATION PROMPT — Book A 組版技術検証 closeout

```text
cd /Users/masa/projects/AMD/amd-os

最初に読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/CLAUDE.md
5. /Users/masa/projects/AMD/amd-os/AGENTS.md
6. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
7. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
8. /Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md
9. /Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md
10. /Users/masa/projects/AMD/amd-os/pwa/bzm/HANDOFF_BOOK_A_2026-07-16.md
11. /Users/masa/projects/AMD/amd-os/pwa/bzm/COMMANDER_TASKS.md
12. /Users/masa/projects/AMD/amd-os/pwa/bzm/BOOK_A_PUBLISHING_PLAN.md
13. /Users/masa/projects/AMD/amd-os/pwa/bzm/BOOK_A_FIGURE_INVENTORY.md
14. /Users/masa/projects/AMD/amd-os/pwa/bzm/9-5-appendix-changelog.md
15. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md
16. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md

状態スナップショット:
- Book A 出版準備ストリームKで、Ch8 組版技術検証は完了済み。
- 対象は /Users/masa/projects/AMD/amd-os/pwa/bzm/book-a-ch-8.md。本文は read-only で、章本文への編集はしていない。
- 検証 commit: 1fdbf21b docs(bzm): Book A組版技術検証ログを記録。main に push 済み。
- 検証結果は BOOK_A_PUBLISHING_PLAN.md §4、COMMANDER_TASKS.md Stream K、9-5-appendix-changelog.md に記帳済み。
- 生成物は repo 外 /tmp/book-a-typesetting-verification-20260715/ にある。PDF/EPUB/TeX/render PNG は commit していない。
- user-local TeX 環境として /Users/masa/Library/TinyTeX を入れ、日本語組版パッケージ collection-langjapanese / luatexja / jlreq を追加済み。
- handoff作成時点の production readback は v3.41.4 / git_sha=71e63060 / git_branch=main / dirty=false。ただし handoff docs commit が後続で積まれるので、次回開始時に必ず current truth を取り直す。
- その後 main には 2b56d19d docs: Book A 図版インベントリ作成 も入っている。図版作業に入る場合は BOOK_A_FIGURE_INVENTORY.md を読む。

検証結果:
- A5 PDF: pandoc + LuaLaTeX + ltjsbook + a5paper で生成成功、実測28ページ、A5サイズ。
- PopplerでPDFをPNGレンダーし、表8-1、表8-3、主要数式、参照一覧を目視確認。大きな欠けや重なりは見えない。
- PDF警告: 8.5節の長い underbrace 数式2本に overfull hbox (5.53pt / 20.26pt)。印刷版では aligned / 改行 / 小さめ指定で折り返す。
- 図はまだ [図8-x] のプレースホルダ文字列。実画像ではない。
- EPUB MathML: 生成成功。content.opf に properties="mathml" を確認。Kindle用の本命候補。
- EPUB webtex: 生成自体は成功。ただし長い日本語入りの交換効率式1本が外部画像化に失敗し、式画像が欠落。最終採用にはローカル画像生成か式短縮が必要。
- Java がないため epubcheck は未実施。Kindle Previewer も未検出で、実機系確認は未実施。

ページ・背幅:
- Ch8実測: 28p。
- 16章単純換算: 448p。
- 巻頭巻末25pを足すと約473p。
- 本番テンプレ、目次、奥付、図版実物、柱/ノンブル調整を考慮し、見積りケースは480 / 520 / 550pを維持。
- 紙厚0.10〜0.11mm/枚なら背幅は480p=24.0〜26.4mm、520p=26.0〜28.6mm、550p=27.5〜30.3mm。最終値は印刷所確認。

次タスク:
1. 高品質印刷所の見積り取得準備
   - A5 / 480・520・550p / モノクロ本文 / PUR無線綴じ候補 / 表紙加工 / 50・100・200部 / 背幅24〜30mm級。
2. ISBN/JAN申請情報整理
   - 法人 Team Armada 発行、ISBN出版者記号自己取得、紙書籍はISBN+書籍JAN掲載。
3. EPUB実機系確認
   - Java + epubcheck、Kindle Previewer。MathML版を本命、webtexはローカル数式画像化か式短縮を検討。
4. 印刷PDF本番パイプライン
   - 長い数式の折り返し、図プレースホルダの実画像差し替え、柱・ノンブル・目次・奥付テンプレ。
5. pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md は別件の巻頭凡例下書き。勝手に削除/commitしない。Book A frontmatter laneで判断する。

repo状態 / dirty:
- 次回開始時は必ず以下を実行:
  git fetch origin main
  git status -sb --untracked-files=all
  git log -1 --oneline
  curl -fsS https://amd-os-pwa.vercel.app/api/build-info
- handoff時点では main と origin/main は一致していたが、別件 dirty がある。別作業が同じcheckoutで動いているため、正確な一覧は毎回 `git status -sb --untracked-files=all` を正とする。
- 既知の unrelated dirty group:
  - materials / research-assets lane: FEATURE_REGISTRY、SPEC_pwa、manual/spec appendix、MaterialsKnowledgeView、materials-data、build-info など
  - contracts operational answers lane: contracts API/UI/lib、check_contracts_ledger_grouping、check_pwa_critical_ui、contracts migration など
  - Atlas / routine lane: pwa/design/atlas_routine.md
  - Book A frontmatter lane: pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md
- これらはBook A組版検証には混ぜない。ownerごとに commit/deploy または revert 判断する。

確立済み運用ルール:
- まず /Users/masa/projects/AGENTS.common.md と AMD level memory を読む。
- branch/worktree作成は禁止。main直編集・main直push。
- dirtyを理由にbranchを切らない。今回触るファイルだけ明示stageする。git add . 禁止。
- BZM出版準備の生成物は repo に入れない。検証成果物は /tmp か明示された外部作業dirに置く。
- chapter body は、出版パイプライン検証では read-only。中身の改稿は司令塔/章ワーカーの別レーン。
- manual/spec/bzmの3層ルールを守る。今回は新UI/API/cronではないためOSマニュアル追記は対象外、BZM附則と出版計画が正本。
- PWA実装を触る本番反映は deploy.sh 経由。今回のBook A docsはアプリ仕様変更なしだが、main push後はproduction build-infoで current truth を確認する。
```
