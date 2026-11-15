# 引っ越しプロンプト — ゴールツリーの期限・担当メモの置き場所を決める（2026-11-15）

次のブロックをそのまま新しいセッションへ貼る。cwd は `/Users/masa/projects/AMD/amd-os`。

```text
cwd は /Users/masa/projects/AMD/amd-os。まさへの話し方は えいみ（あたし／まさ）。開発を知らない人に話すつもりで、画面で何が変わったかから報告すること。

【読む順】
1. /Users/masa/projects/AGENTS.common.md（えいみ共通ルール正本）
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md（AMD横断memory）
3. /Users/masa/projects/AMD/amd-os/AGENTS.md
4. /Users/masa/projects/AMD/amd-os/HANDOFF_GOAL_TREE_2026-09-13.md（先頭の「2026-11-14」の節と未解決）
5. pwa/spec/3-21-question-tree-current-spec.md（現行仕様。詳細モーダルの表と「論点の詳細とTODOの詳細は同じ形にする」）
6. pwa/spec/3-22-goal-tree-plan.md（冒頭の2026-11-14確定の注記。§2・§4・§5 は古いまま）
7. pwa/BUGS.md の先頭2件（版の表示が消えた件、共有checkoutの片付け残り）

【状態スナップショット（2026-11-15 確認）】
- 本番は v3.165.27。ゴールツリーの詳細の簡素化と、上部バー右端の版の表示は本番で確認済み（SXの /project/p21/cockpit）。
- GitHub main は本番と一致。共有checkoutは origin/main と同期、未追跡の model/tools/bzm-sheet-pilot/ は別セッションの作業なので触らない。
- 作業フォルダ外の退避（git stash）が2件ある。他セッションのものなので触らない。
- 今回の反映は共有checkoutでなく使い捨てのclean cloneから deploy.sh で行った（共有checkoutに他セッションの未コミットがあると deploy.sh が止まる）。

【まさの確定（2026-11-14）】
「ゴールツリーは論点整理のためのツリー。時間軸は入れたくない。タイトルが出て、押すと詳細が見えるだけで十分。複雑にしないで。」
論点もTODOも、詳細は 種類・詳細・分かったこと だけ。担当・期限・着手予定・完了日・完了条件・完了の証跡・詰まっていること・確からしさ・最終更新は出さない。ガントで開くTODOだけ従来の詳細。

【次のタスク（判断待ち）】
到達点・論点・MSの期限（due_date）と、担当メモ（owner_label）を画面から付ける場所が無くなった（DBの値は残る）。
3-22 §5 のMSの到達見込みは期限を使う。選択肢は次の2つ。
 A. MSの期日は /admin/ms-overview 側だけで持つ。ゴールツリーには期限欄を戻さない（まさの確定に一番近い）。
 B. ガントの行で期限を付けられるようにする（ガントは日程を扱う面なので筋は通る）。
まず pwa/spec/3-10-l2-ms-progress-current-spec.md と /admin/ms-overview の現状を読み、MSの期日が今どこで決まっているかを実データで確かめてから、推しを添えてまさへ聞く。決まる前にゴールツリーへ期限欄を戻さない。
決まったら 3-22 の §2・§4・§5 の本文を、ガントのTODO詳細と「MS・月次」に合わせて書き直す（今は冒頭の注記だけ）。

【このPJで確立済みの運用】
- 全repoで main 一本。共有checkoutは別セッションが常時並行する。着手前に git fetch、HEAD..origin/main があれば ff-only で追従してから読む。
- commit は対象ファイルをパスで指定する（git commit -- <paths>）。git add の前後で git diff --cached --name-only を見る（他セッションのstageが index に残る）。
- 本番反映は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh。共有checkoutがdirtyなら main をcloneした使い捨てから行う。反映前に BUILD_VERSION を1つ上げる。docs だけの commit でも画面に出る場所（pwa/spec など）を含むなら [skip ci] を付けない。
- ブラウザ確認は claude-in-chrome（まさのログインが残っている）。内蔵ブラウザは使わない。PWAのスマホ幅は確認対象外。
- 画面を変えたら pwa/scripts/check_pwa_critical_ui.cjs の固定点検が通ること。spec 3-21、manual 2-9 を同じ commit で更新する。
- 他セッションへメッセージを送らない。別セッションを勝手に立ち上げない。メールは送らない。
```
