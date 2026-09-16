# SOL 定例工程ガント

## 状態
- SOLのガントは定例資料の4区分・13工程を初期表示。工程を開くと既存ゴールツリーの論点・TODOを表示し、詳細を折り畳むと全体計画へ戻る。
- 工程計画は `project_gantt_roadmaps` のp21行。migration `20260916160000_sol_meeting_gantt_roadmap.sql` は本番適用済み。実行TODO・論点・依存関係・旧ガントを変更していない。
- 法人設立2027-04、プレシード2027-05は月精度。月内の端点は資料の概算。実線／破線は計画の範囲であり実績ではない。
- 通常PJのゴールツリー型ガントと、単独TODOをタスクタブへ分離した直近変更を維持。

## 正本と検査
- 仕様: `pwa/spec/3-21-question-tree-current-spec.md` のSOL節。
- 利用手順: `pwa/manual/2-9-question-tree.md` のSOL節。両層の変更履歴を同時更新。理論層は変更なし。
- 検査: `test:project-gantt-roadmap` / `test:question-tree-action-move` / `test:sx-gantt-drag`、型検査・本番ビルド、deploy.sh所定検査。
- 手元画面: 実DBの束で4区分13工程、全展開時26論点・重複0・未承認0、詳細モーダルで既存の祖先を確認。1440×900と390×844で確認。検証専用ページとmiddleware例外は削除済み。
- ネイティブ表示は変更なし。共有DBの新テーブルとAPI束の任意roadmapフィールドを追加。既存クライアントは従来どおり動作。

## リポジトリ境界
- 作業はmainの使い捨てclone `/tmp/sol-gantt-20260916`。新branch/worktreeなし。
- 正規checkoutは着手時 d4d254a7、origin/main bf0a34c3より194件遅れ・未push3件・他作業の未commit差分あり。既存担当の作業を巻き込まず保全。終了時に再fetchし差分件数を再確認する。正規checkout同期は既存担当が未push3件と未commit差分を分類して行う。

## 反映記録
- 本番配信・反映後画面の検証結果は最終応答に記録。DBと型の導入後にPWAを配信。
