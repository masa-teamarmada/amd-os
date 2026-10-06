# 左ナビ・複数タブ・DD資料目録の引き継ぎ

2026-10-06 JST更新。仕事種別:開発。まさが本番表示を受入済み。

## 現在地
- 全体メニュー「≡」、並列の3スペース左入口、ホームからの別タブ起動を反映済み。
- DDは33資料。資本政策表・株主名簿・次回ラウンドタームシート等を独立。従業員名簿は他2スペースに限定。
- Chrome PWAの選択タブが白、非選択枠が青灰色。現在ページを題名へ反映。
- 3スペース共通の縦型組織図。登録表示の後続仕様は[組織図引き継ぎ](HANDOFF_ORGANIZATION_CHART_20261006.md)。
- PC左ナビの行高と全幅ホバーを統一。本番ワークスペースのリンク・分類・子ページすべて28pxと確認。
- PWAの画面検証はPCだけ。スマホはSwift版の利用範囲。

## 反映・検証
製品変更17d15894d57dbcd0a80fec1b72228c31c14b6d85はmainへpush済み。本番v3.160.7/main/dirty=falseのSHA一致、PC実画面・DOM計測を確認。通常deploy.shは5分47秒で成功。test:critical-uiと配布ゲート成功。この引き継ぎ後のHEADは文書commitへ進むため、開始時にfetchして現状を確認する。
実装履歴は[pwa/design_log/sessions_2026-10.md](pwa/design_log/sessions_2026-10.md)、問題と教訓は[pwa/BUGS.md](pwa/BUGS.md)。ローカル確認の画像はignored .jez/artifactsへ保持。今回の一時route・サーバ・タブ・cloneは除去済み。

## Repoと残り
確認時:main、ahead0/behind0、本件の未コミット・未push・競合0、ローカルbranchはmainのみ、追加worktree0。履歴上のリモート枝は本件で作成していない。
既存未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは別件の移行担当資料。前の引き継ぎにGit保存の判断待ちとある。保護保持しstage・削除しない。隔離管理者:移行担当／まさ。次の判断条件:当該移行の再開またはまさの明示判断。保持リスクは低い。本件の実装残は0、全repoの未追跡0とは報告しない。

## 次の最初の行動
新しい依頼を待つ。再開時はSESSION_MIGRATION_PROMPT.mdの読む順を守り、fetch/status/build-infoを確認する。追加依頼がないままNative移植・DD開示変更・別件移行を始めない。

## 保存先とマニュアル同期
| 変更・成果物 | 正本・記録先 | OSマニュアル章 | 状態 |
|---|---|---|---|
| 全体メニュー・並列3スペース・別タブ | spec2-1/3-24、FEATURE_REGISTRY | manual2-1 | 同期済み |
| DD資料分割・33資料・従業員名簿の範囲 | spec5-17/3-24、ios/DESIGN | manual2-1 | 同期済み |
| タブの色・現在ページ題名 | spec2-1 | manual2-1 | 同期済み |
| 共通組織図ひな形 | spec3-23/3-24/5-17、ios/DESIGN | manual2-1 | 同期済み |
| PC28pxとホバー・44px競合修正 | spec2-7/5-17、BUGS | manual2-1 | 同期済み |
| 検証・経緯・片付け | design_log/sessions_2026-10 | 対象外:製品挙動の変更なし | 記録済み |
| Native/DB/モデル/鍵/環境変数 | 今回変更なし | 対象外 | 確認済み |

共通入口はpwa/HANDOFF_pwa_rebuild.md。今回の恒久仕様はそこでなく上記spec/manualが正本。会話の検討材料:0件。
