# SESSION MIGRATION PROMPT — Book A 図版インベントリ closeout

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
12. /Users/masa/projects/AMD/amd-os/pwa/bzm/BOOK_A_FIGURE_INVENTORY.md
13. /Users/masa/projects/AMD/amd-os/pwa/bzm/BOOK_A_PUBLISHING_PLAN.md
14. /Users/masa/projects/AMD/amd-os/pwa/bzm/9-5-appendix-changelog.md
15. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md
16. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md

状態スナップショット:
- Book A 図版制作前の棚卸しは完了済み。
- 正本は /Users/masa/projects/AMD/amd-os/pwa/bzm/BOOK_A_FIGURE_INVENTORY.md。
- 図版インベントリ commit: 2b56d19d docs: Book A 図版インベントリ作成。main に push 済み。
- HANDOFF 更新 commit はこの prompt 保存後に積まれる可能性があるため、開始時に必ず current truth を取り直す。
- Stream G の現在地: 図リスト完成。次は各図の実制作フェーズ。
- まさ要判断: 図版ワーカーをいつ切るか。
- Book A 組版技術検証も完了済み。Ch8 A5 PDF 28p、MathML EPUB 成功、webtex は長い日本語入り数式1本が外部画像化に失敗。

図版インベントリの確定値:
- 総実制作見込み: 41点。
- 確定: 第1〜10章の本文プレースホルダ確認済み30点。
- 本文内プレースホルダ出現: 31箇所。図1-1は再掲を含むため、制作単位では1点として数える。
- 見込み: 第11〜16章のマスタープラン §9 由来11点。
- 制作方式目安: matplotlib向き16点 / SVG手描き向き25点。
- 優先度高: 14点。

制作フェーズで必ず見る注意:
- 図1-3 は本文プレースホルダが「15回」となっているため、現行16章構成との整合を確認する。
- 図10-2 は本文内では図10-1より先に登場する。図番号順を直すか、本文順を維持するかは制作フェーズで判断する。
- 既存公開図版は参照素材として使えるが、Book A の図番号・キャプション・教材値に合わせた再制作または翻案が必要。
- 第11〜16章は本文未起筆のため、図番号・点数・配置は本文起筆時に再確定する。

次タスク:
1. Stream G: まさ判断後、図版制作ワーカーを切る。
   - 最初は優先度高14点から着手。
   - 図ごとに「目的」「見せる変数」「配置」「データ有無」「本文キャプション」を先に文章で固める。
   - 本物の画像生成が必要な依頼では、画像生成ツールの有無を確認し、SVG/CSS装飾でごまかさない。
2. Stream K: 高品質印刷所の見積り取得準備。
   - A5 / 480・520・550p / モノクロ本文 / PUR無線綴じ候補 / 表紙加工 / 50・100・200部 / 背幅24〜30mm級。
3. ISBN/JAN申請情報整理。
   - 法人 Team Armada 発行、ISBN出版者記号自己取得、紙書籍はISBN+書籍JAN掲載。
4. EPUB実機系確認。
   - Java + epubcheck、Kindle Previewer。MathML版を本命、webtexはローカル数式画像化か式短縮を検討。
5. 印刷PDF本番パイプライン。
   - 長い数式の折り返し、図プレースホルダの実画像差し替え、柱・ノンブル・目次・奥付テンプレ。
6. pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md は別件の巻頭凡例下書き。勝手に削除/commitしない。Book A frontmatter laneで判断する。

repo状態 / dirty:
- 次回開始時は必ず以下を実行:
  git fetch origin main
  git status -sb --untracked-files=all
  git log -1 --oneline
  curl -fsS https://amd-os-pwa.vercel.app/api/build-info
- handoff時点では main と origin/main は一致しているが、別件 dirty がある。別作業が同じcheckoutで動いているため、正確な一覧は毎回 `git status -sb --untracked-files=all` を正とする。
- 既知の unrelated dirty group:
  - materials / research-assets lane: FEATURE_REGISTRY、SPEC_pwa、manual/spec appendix、MaterialsKnowledgeView、materials-data、build-info など
  - contracts operational answers lane: contracts API/UI/lib、check_contracts_ledger_grouping、check_pwa_critical_ui、contracts migration など
  - Atlas / routine lane: pwa/design/atlas_routine.md
  - Book A frontmatter lane: pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md
- これらはBook A図版インベントリ closeout には混ぜない。ownerごとに commit/deploy または revert 判断する。

確立済み運用ルール:
- まず /Users/masa/projects/AGENTS.common.md と AMD level memory を読む。
- branch/worktree作成は禁止。main直編集・main直push。
- dirtyを理由にbranchを切らない。今回触るファイルだけ明示stageする。git add . 禁止。
- BZM出版準備の生成物は repo に入れない。検証成果物は /tmp か明示された外部作業dirに置く。
- chapter body は、出版パイプライン検証では read-only。中身の改稿は司令塔/章ワーカーの別レーン。
- manual/spec/bzmの3層ルールを守る。今回は新UI/API/cronではないためOSマニュアル追記は対象外、BZM附則と出版計画/図版インベントリが正本。
- PWA実装を触る本番反映は deploy.sh 経由。今回のBook A docsはアプリ仕様変更なしだが、main push後はproduction build-infoで current truth を確認する。
```
