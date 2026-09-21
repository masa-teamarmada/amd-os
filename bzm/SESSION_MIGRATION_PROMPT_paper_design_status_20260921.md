# BZSF 次セッション移行プロンプト — 論文（AMDスコア第1論文）の設計の現在地を1枚に（2026-09-21作成）

cwd: `/Users/masa/projects/AMD/amd-os/bzm` で起動して、以下をそのまま実行して。（2026-09-22 訂正: 論文の家は BZSF（ファンドの器）ではなく amd-os/bzm。BZSF には資金の話だけを置く）

## 共通ルール（全セッション）
- まず `/Users/masa/projects/AGENTS.common.md` と `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` を読む。
- 送信・投稿はしない（メールは下書きまで。Slack投稿はまさの明示指示があるときだけ）。
- 成果物は Google Drive の該当PJフォルダに `YYMMDD_件名/` の日付フォルダを作って置く（`~/Library/CloudStorage/GoogleDrive-masa@team-armada.jp/共有ドライブ/ARMADA/<pjフォルダ>/`）。既存の日付フォルダを改訂するときはその中で更新する。
- まさへの報告は、開発を知らない人に話すつもりで。ファイル名・関数名・テーブル名を本文に並べない。
- ワーカー（Agent/Workflow）を使うときは model を haiku か sonnet に明示する。

## 読む順
1. `/Users/masa/projects/AMD/amd-os/bzm/AGENTS.md`（BZM構築セッションの研究規律）、`/Users/masa/projects/AMD/amd-os-tree/bzm/HANDOFF_P1_2026-08-30.md`（P1論文の現在地: 稿 v4.1、模擬査読5人格への対応、図2凍結、入力分類の凍結）、`PAPER_P1_DRAFT_V2.md`、`PAPER_P1_OUTLINE_V2.md`、`PAPER_P1_MASTER_PLAN.md`（amd-os-tree/bzm にある。amd-os/bzm 側に同名があればそちらが最新か日付で確認）
2. `amd-os/bzm/HANDOFF_BZM30_TEXTBOOK_2026-09-05.md` と `BZM_3_0_TEXTBOOK_PLAN.md`（教科書の並列起草。第1・2章のみ完成、残り14ファイル未着手）
2b. `/Users/masa/projects/AMD/BZSF/BZM_THEORY_REAUDIT_2026-08-13.md`（理論の再検証）、`BZSF_PREREGISTRATION_RULE_DRAFT_2026-08-16.md`（事前登録の凍結ゲート）。`/Users/masa/projects/AMD/before-zero/`（6〜7月の理論プロジェクト。7/13以降更新なし）は履歴として読む
3. `/Users/masa/projects/masa/wealth_plan_2026/PLAN.md` の §12.1.11（BZM 3.0 で論文を設計し直す、旗艦・投稿先）と §7.5 / §9.1 / §10.1
4. ボードのカード `weekly_95c62824a54da68acd06e1bd`「BZM論文の設計」（ボール=えいみ、期限 10/31）と、5億ロードマップの分岐 `amd_score_paper1_scope`（10/31）
5. `/Users/masa/projects/knowledge/amd_os_vision.md`（教科書STEP1 / 論文STEP3 の位置づけ）

## 背景（まさ 2026-09-21）
- 「論文全然進んでない。この連休にある程度片付けなきゃ。」まさ本人が書く前提で、えいみは「いま何が決まっていて、何が未決で、次に何を書けばいいか」を1枚にして渡す。
- 2026-08-13 の対話で確定した目標は「BZM完全体」ではなく **「論文が通る固さ」＋事前登録2件目の分解能検証を凍結ゲートにする**（`masa/dialogues/2026-08-13_masa_eimi_weekly.md` §2）。

## 追加の宿題（まさ 2026-09-22「BZSFはファンドのディレクトリでは。一緒にした方がいいか。その場合 before-zero は廃止した方がいい」）
- 3か所（`before-zero/`、`BZSF/` の理論2ファイル、`amd-os/bzm/`）に散っている理論・論文の材料を照合し、**論文と理論は amd-os/bzm に一本化、BZSF は資金の器のみ、before-zero はアーカイブ（`AMD/_archive/before-zero_2026-07/`）**の案で、未反映の中身の有無を一覧にする。移動・削除はまさの承認後。

## 作るもの（`AMD/amd-os/bzm/PAPER1_DESIGN_STATUS_2026-09-22.md`、1枚）
1. **決まっていること**: 研究課題（問い）、仮説、対象データ（既存PJのretrofit、ERS二層、OSログ）、評価指標、投稿先候補、旗艦の位置づけ。各項目に出典（ファイル名・日付）。
2. **未決のこと**: 決めないと書き始められない順に並べ、それぞれ「まさが決める」「えいみが調べれば決まる」に分ける。
3. **次に書く節の順番と、連休3日（9/21〜9/23）の配分案**: 1日目に何を書けば2日目が進むか。
4. **えいみが先回りできる作業**: 文献リスト、データ抽出の下準備、図表の骨格など、まさの執筆と並列で進められるもの。承認されたら着手する。

## 完了条件
- 1枚に収まっている（A4 1〜2ページ相当）。長い分析は別ファイルへ逃がしてパスで示す。
- まさへの報告は「未決のうちまさが決めるもの」だけを1問ずつ。
