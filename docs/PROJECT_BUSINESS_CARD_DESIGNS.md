# PJ管理で自社名刺案を保存する設計

更新: 2026-10-12。状態: 設計案完成・未実装。DB・API・画面の変更はまだ行っていない。

## 目的と現状

各PJのコックピット「PJ管理 > 名刺案」から、最新の案、承認済みの入稿版、編集元、発注記録を再発掘せず開けるようにする。全PJ共通の機能とし、名刺がないPJにも「未登録」を表示する。

2026-10-12、本番の `projects`、`workspace_documents`、`project_important_documents`、旧 `project_documents` を読み取り確認。AMD(p00)・SOL(p21)の今回の名刺は資料台帳に登録されていない。既存 `/business-cards` は交換した相手の名刺の撮影・OCR・人物台帳であり、自社名刺の制作物を混在させない。旧 `project_documents` は退役した資料UIの台帳なので、新規保存経路にしない。

PJ管理は社内コックピットの分類。共有ワークスペース・DDへ自動追加しない。既存仕様は `pwa/spec/3-23-project-format-current-spec.md`、`3-16-project-weekly-control-current-spec.md`、`src/lib/project-formats.ts`、`cockpit-tabs.ts` を読む。

## 画面

PJ管理の子タブに「名刺案」を追加する。まず一名刺一行で、氏名、ブランド構成、最新版の日付・版数、承認状態、発注状態、表裏プレビュー、編集元、入稿PDF、履歴を比較できるようにする。選択行の詳細で用紙・数量・金額・注文番号・出荷予定・到着確認を開く。スマホでは同じ列の優先順を保ち、操作は44px以上とする。

「最新版の案」と「最新の承認済み版」を並べて示す。Driveの更新日時やファイル名の辞書順だけで最新版を決めない。未承認の新版が追加されても、発注できる承認版は切り替えない。承認済み・発注済みの印刷用PDFは変更せず、新版を作成する。編集用Slidesを修正しただけでは承認済み印刷版を更新しない。

名刺の種類は単独ブランド・併記ブランドを分ける。同じ人の異なる名刺を一つに上書きしない。AMD＋SOLのような併記版は一つの版を関連PJへ紐付け、参照先を明示する。関係する大学や肩書の会社を、名刺の保存先PJと自動解釈しない。

## 提案するDB契約（新設・未適用）

| テーブル案 | 主な内容・制約 |
|---|---|
| `project_card_designs` | design_id、owner_project_id、holder_label、variant_key、ブランド構成、latest_draft_version_id、latest_approved_version_id、version。名刺の系列。owner PJ＋対象者キー＋variant_keyを一意にする |
| `project_card_design_versions` | version_id、design_id、version_no、revision_label、status(draft/review/approved/superseded)、created_at、approved_at、approved_by、検査結果、用紙・サイズ・部数・発注記録のJSON。系列＋版数を一意にする。発注記録に住所・支払カード情報を入れない |
| `project_card_design_projects` | design_id、project_id。系列とPJの多対多リンク。複合主キー。片面ずつのブランドの関係を残す |
| `project_card_design_assets` | version_id、role、drive_file_id、drive_folder_id、project_id、mime_type、byte_size、sha256、workspace_document_id(任意)、checked_at。roleはpreview/front_print/back_print/editable/source_zip/spec/order_evidence。版＋role＋project_idを一意にする |

OSの構造化台帳が版と採用状態の正本、Driveがファイルの正本。保存先は `projects.drive_folder_id` を起点に解決する。PDFから電話・メール・住所を抽出してDBへ複製しない。sha256は取得した実ファイルから計算できた場合だけ記録し、Driveコネクタが返さないchecksumを照合済みにしない。

資料室へのリンクを作る場合は現行 `workspace_documents` を再利用する。同名フォルダ行が必要な既存契約に従い、単なるfile行だけの挿入で見えると思い込まない。名刺台帳は資料室の表示名や更新日時に依存させず、asset/document_idで結ぶ。

## Drive保存契約

各PJの登録ルート直下に、厳密な名前で `0_名刺` を一つだけ置く。AMD(p00)は `a0_management` が登録ルートであり、`a3_backoffice` へ例外保存しない。SOL(p21)は `p21_sol`。ルート未登録・書込不可ならその理由を表示し、他PJやMy Driveへ黙って保存しない。

フォルダ解決はparent ID＋完全一致名＋folder MIME＋trashed=falseで行う。0件なら作成、1件なら再利用、複数件なら競合として停止し、任意の先頭を採用しない。新しいファイルは名刺系列・版・役割を識別できる名前にする。過去版は履歴として保持する。今回の既存ファイルはID・URLを保ったまま移動済み。

| PJ・版 | 保存先 | 現行ファイル |
|---|---|---|
| AMD単独 r8・発注済み | `a0_management/0_名刺` folder `1lF-E6zDWefhFiD2zyBzQ7VfgF6iv8k3M` | editable `13xrYhn2v3tOnRoqEzk9nvxcuKaqqkE4seyIXssBpNRU`、preview `1tO3LxIvZ4g_1PSLPj8kdJas8qeefSaHA`、front `1HObKyb0avPoXeYieKuLvFir2q6Y3Oo5n`、back `1N_zxG4djc0L_vxSuSX4wnuP-ueFLnjSL` |
| SOL＋AMD r7・案、未発注 | `p21_sol/0_名刺` folder `1_q6Y1N3ulefw0n-KsnciYjjqB_s07kVC` | editable `1zJBAOzoTWH8RuwIme8LzyEVC5jWfooBsdtzTaJwPs7w`、preview `1RhhzgCo-ldHS5YPZmN_KfzPXFj6rirCg`、front `1krsSWy8ehbYBL9B-PvSYohtm7FpgUExq`、back `1pUrfuH_3FOwDYT2-LZeo44y9Dziadg-C` |
| SOL単独 2026-09-27・承認済み | 同じSOLフォルダ | 従来PDF3件・制作元ZIP・正本mdの5件を保持 |

共通の制作元ZIP・比較画像・制作仕様はAMDのフォルダに残す。SOL側の正本mdから参照できるようにする。併記版の関連PJで表示する際、所有PJの社内権限を迂回して共通の編集素材・発注情報を返さない。

## 保存・更新・認可

1. PJと名刺系列を選び、前版のexpected_versionと再送識別キーを送る。
2. PJの実効権限でread/edit/approveを確認する。更新・承認はAMD管理者または対象PJのcockpit edit権限を持つ内部メンバーに限定。認可は既存 `project-surface-permissions.ts`、`workspace-document-access.ts` の能力判定に統合する。RLSも同条件にし、ログイン済みだけの全PJアクセスは許さない。
3. Driveの `0_名刺` を解決し、案のファイルを保存。ID、親フォルダ、存在、サイズ、PDF寸法・埋込フォント・描画を確認して保存receiptを残す。
4. OSで候補版・assetsを登録し、全て揃った時だけ一トランザクションで系列の最新版pointerを更新する。DriveとDBを一つの原子的transactionと偽らない。途中失敗はpending/errorにし、前の利用可能版を維持する。
5. 承認は人が対象版を確認して実行。印刷に必要なfront/back、3mm塗り足し、版の一致、編集元を検証し、approved pointerだけを更新する。409では最新版を取り直して対象版を再確認する。
6. 保存後はDB、API、対象PJ画面、Driveを読み戻す。画面まで確認した時だけ「OSに保存済み」とする。

API案は `/api/project-card-designs?project_id=...` GET/POST、`/[designId]/versions` POST、`/[designId]/approve` POST、`/[designId]/assets/[assetId]/open` GET。既存資料openの認可・監査を再利用する。GETで作成しない。利用者向けにservice roleや期限付き署名URLを渡さない。内部AMDメンバーの対象PJ閲覧権限が既定。共有ワークスペースへの公開は、承認済み閲覧版だけを別の明示操作で行う。制作元・発注情報は社内限定。

この機能はファイル保存と版管理まで。カード注文や支払い・共有設定の変更・通知を自動実行しない。印刷を依頼された時は対象版・部数・用紙・見積と注文結果を別に確定する。

## 実装順・受入条件

本依頼で完成したのは設計とDrive整理。次に実装を依頼されたら、新設migration→RLS→API→PJ管理タブ→初期登録の順。`project-formats.ts` の全PJタイプへ共通登録する。p00/p21の条件分岐でUIを増やさない。

受入: 全PJでタブあり／未登録表示、AMDとSOLの最新版案が別々に開く、SOL単独と併記を区別、旧版保持、未承認版が承認版を上書きしない、権限外PJと外部ユーザーに編集元・発注情報が漏れない、Drive重複・権限不足・保存断・409・再送で前版が維持される、PDF/編集元/親フォルダ/DB/API/画面のreadbackが揃うこと。

実装時は `pwa/spec/3-23`、機能登録簿・schema・API contract・該当OSマニュアル章を同時更新し、必要な実装テストと外部ChromeでPC/スマホ画面確認を行う。現在のマニュアル同期は対象外（未実装案を利用可能な機能として記載しない）。

## 保存と引き継ぎ

名刺の制作・内容正本は `/Users/masa/projects/AMD/BUSINESS_CARDS.md`、SOL単独版は `SOL/BUSINESS_CARD.md`。現況・次の一手は `/Users/masa/projects/AMD/HANDOFF_BUSINESS_CARDS.md`。技術実装案は本書へ集約し、名刺制作の履歴をdevelopmentのdesign_logへ移さない。
