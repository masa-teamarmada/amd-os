BZM 2.2 の獲得台帳と、AMDの貢献記録を、2026-11-15 の状態から引き継ぐ。作業場所は `/Users/masa/projects/AMD/amd-os`。

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`（特に「まさへの報告の書き方」。技術に詳しくない人へ話すように、画面で何が変わったかから書く）
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/pwa/HANDOFF_pwa_rebuild.md` の先頭「獲得台帳」節
4. `/Users/masa/projects/AMD/amd-os/pwa/spec/4-6-bzm-22-acquisition-ledger-current-spec.md`（台帳の仕様正本。§2 に第1段／第2段の約束）
5. `/Users/masa/projects/AMD/amd-os/pwa/spec/4-7-amd-contributions-current-spec.md`（貢献記録）
6. `/Users/masa/projects/AMD/amd-os/pwa/bzm/bzm-2-2-strategic-slack-and-propulsion.md`（理論。§5 行動別制約 σ_j、§6 推進力、§7 戦略余力、§10 証拠段階を全文読む）
7. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md` の末尾から「[運用] git stash -u」「[検査] 参照系キャッシュ」の2件

## 状態スナップショット（2026-11-15 確認）

- 自分の作業はすべて origin/main にあり、本番に反映済み。台帳の表と抽出由来の書き込み、貢献記録、進捗タブへの移設。
- 画面: PJコックピット → 進捗管理タブの最下部に「これまでに得てきたもの（獲得台帳）」と「AMDがこのPJへ行ってきたこと」が隣り合う。スコア詳細タブからは台帳を移設した（廃止ではない）。
- 本番DBの `project_bzm_2_2_acquisitions` は 0 件（2026-08-14 確認）。行が増える経路は、通知画面で「重要情報として保存」を押した時の1経路だけ。まさが通知を捌くまで空。
- 貢献記録は専用テーブルを持たない。`member_activities`（週次記録・カレンダー・メール）と `project_meeting_summaries` からその場で組む。p21 で223件の実データがある。
- 同じフォルダで別セッションが動いている。作業中の別セッションの変更（`question-tree.module.css` の未コミット差分、docs(model) の未push commit）には触らない。Codex の stash 2件（`codex-temp-preserve-*`）も残っている。消さない。

## 次の仕事（第2段。まさと約束済み）

まさの言葉: 「並べて、2.2モデルに従って定量的に数式に入れていかないといけない」。第1段で並べるところまで終わった。第2段で、台帳を推進力と戦略余力に効かせる。

1. `closed_constraints`（どの制約が 不明／違反 から 充足 へ動いたか）を、2.2 §5 の σ_j（met / violated / unknown）へ写す規則を spec 4-6 §2 に先に書く。件数を足して加点しない（§7「経路数をそのまま加点しない」）。効くのは σ_j が動いた時だけ。
2. 規則を書いてから、`numeric_binding='bound'` と非空の `bound_target` を使う。DB の CHECK が、`bound_target` 空の `bound` を機械的に止める。
3. `bound` を使い始めたら、スコア詳細タブに「この値の根拠は進捗管理タブの獲得台帳」と辿れる導線を足す（spec 4-6 §8 の変更ゲート）。
4. 抽出由来の行は、閉じた条件・消費・行動の増減が空のまま。ここを誰がどう埋めるか（人の判断か、モデルの判断か）を、まさに選択肢で聞く。機械的な写像で埋めない。「未取得」を「無し」に見せるため。
5. 並行して、台帳が空のままでは第2段が動かないので、通知に溜まっている重要情報の候補の数を実データで数え、まさに「何件採用待ちか」を知らせる。

## 確立済みの運用ルール

- ブランチを作らない。main 一本。`git add .` は使わない。今回の対象ファイルだけを stage する。
- 本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。共有フォルダに他セッションの未コミット変更があると止まる。その場合に限り、自分のファイルだけ commit して `git push origin main` で反映し、監視は祖先判定（`git merge-base --is-ancestor`）で行う。
- **検査の原因切り分けに `git stash` を使わない。** 共有フォルダでは他セッションの作業中ファイルを巻き込んで衝突する（2026-08-15 に13ファイルを壊しかけた）。
- 表示を変えるたびに `BUILD_VERSION` を上げる。
- 抽出由来の行や貢献記録に、手入力の口を作らない。足りない時は抽出側を直す。
- 画面が読むデータは、書く前に参照系か可変系かを分類する。参照系は `reference-data-cache` 経由の client 層を通す。
- 未確認: `npm run test:model-formula-canon` は 2026-08-15 時点で、モデル担当セッションの作業途中により落ちていた。今も落ちているかは未確認。自分の変更とは無関係。
