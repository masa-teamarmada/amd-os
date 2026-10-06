# DD事業計画関連の追加

2026-10-06: DDの事業・市場・顧客を事業計画関連へ、事業計画書をフェーズマトリクスへ改名。ビジネスモデルとコスト試算の共通本文を目録に追加。短期計画はproject_config.short_term_plan_document_idで指定した既存ワークスペースHTML資料のwork区画とスタイルをそのまま表示。SOLは2026-10-06作成の15か月資料を指定し、旧進捗ガントはgantt URLを維持。長期計画はproject_business_plansの期間・予算・調達・4レーンの活動と到達条件を時系列表示。月次試算表は既存ProjectFinanceFormatの計画・ケース選択、月次P/L・C/F・資金推移、前提と注記を表示し、収支計画書の全体表示は維持。次回ラウンドの概要は採用中の資本政策に明示されたplannedの株式・転換型調達から順序が最初の1件を各計画ごとに表示。時期・金額・評価額・転換条件・注記は登録値のみ、未登録を推定しない。目録39件・7分類。公開状態・入場権限・正式版PDF掲載設定・DBデータ変更なし。コックピット・ワークスペースの全PJタイプでドライブを会社情報の後に移動。

OSマニュアル同期: manual/2-3・9-3、spec/3-23・3-24・5-17・6-1、ios/DESIGN更新。bzmは理論・数式変更なしのため対象外。


2026-10-06: 事業計画グループに開発課題ページを追加。大学発SU・新規事業・AMD本体のコックピット/ワークスペース、全DDで共通ProjectDevelopmentIssuesを表示。技術開発課題・事業開発課題・組織開発課題の3区分を常設し、課題/現状/対応方針/担当/目標期限/状態の表を配置。既存project_configのdevelopment_issuesにversion=1, sourceRef, issuesを明示登録して表示。issuesの各行はid/group(technology,business,organization)/title/current/approach/owner/dueOn/statusの文字列。誤形式・重複IDは拒否。空区分は課題未登録。GET /api/project-development-issuesは社内メンバーまたは当該PJ共有閲覧者のみ、DDは入場認可後serverで取得しAPIを呼ばない。クライアントはPJ別30秒参照キャッシュ。書込みAPI・課題の自動分類・DB移行・既存ゴールツリー移動なし。DD資料目録40件。


2026-10-06: 短期計画は資料正本のwork区画（静的SVGガント）を表示。DD入場認可後、指定HTMLのproject_id/scope_kind=project/upload_status=activeを再確認して読み、本文区画とスタイルを無改変で取り出す。毎リクエスト認可の/dd/[slug]/short-term-plan-documentをsandbox iframeで表示。スクリプト・外部通信・送信禁止CSPをnext.configにも適用。未指定・削除・別PJ・形式不正は旧ガントに代替せず未登録/失敗とする。SOLの参照はdb8569d4-b583-4840-a1ce-4183b909dd67。元資料の本文・共有権限・パッケージ公開状態は変更なし。
