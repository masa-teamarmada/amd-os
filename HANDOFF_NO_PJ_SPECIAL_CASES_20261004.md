# HANDOFF: 特定のPJだけの処理の撤去（2026-10-04、2026-11-14 に閉じた）

## 最新の状態
- 実験ダッシュボード3つの削除（v3.157.0）と、PJ別の特例の撤去（v3.158.0、migration 475〜477）は本番反映・確認済み。経緯は `pwa/design_log/sessions_2026-10.md` の 2026-10-04 節。
- 正本: `pwa/spec/3-23-project-format-current-spec.md` §6（PJごとの違いは DB の設定に置き、処理は全PJ同じ）。検査 `npm run test:no-project-special-cases` が deploy 前に走る（2026-11-14 時点でも OK）。
- AMD 横断 memory: `feedback_no_project_special_cases.md`。

## リポジトリの状態（2026-11-14 確認）
- `/Users/masa/projects/AMD/amd-os` main = origin/main（8f8f53f7f）、未push なし。
- 未コミット: `pwa/src/components/question-tree/QuestionTreeView.tsx`・`question-tree.module.css` は別セッションの作業。触らない。

## 未解決
1. まさの判断待ち（2026-10-04 に提示、返答未確認）:
   - タスクptの検収をほかのPJでも始めるか（A: SOLだけ / B: 全PJで翌月分から / C: PJを選ぶ）。設定 `projects.task_point_review_from_ym` を入れるだけで始まる。報酬の決まり方が変わる。
   - 外部リサーチを全PJへ広げるか（A: 今の7PJ / B: 全PJ。テーマは各PJの定義から下書き→まさ確認）。設定 `projects.external_research_topics`。
   - 現在の DB の設定値は 2026-11-14 時点で未確認。
2. SOL の廃液・燃料のコスト試算は SOL 専用の画面のまま（spec 3-23 §6・§7 の「次の段」）。
3. `gas-slack/S100_MacroNewsToSlack.js` の PJ略称表（p21: "SX" など）が残る。GAS は反映手順が別。
4. Mac アプリの KUTE 固定ロードマップ削除は、次にアプリを入れ直したときに反映（未確認）。

## 次の最初の行動
まさに未解決1の2つの判断を聞く。返答があれば、管理画面または migration で設定値を入れ、spec 3-23 §6 の表の「SOL は 202610」「前の7PJ」の記述を更新する。
