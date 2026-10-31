# このディレクトリに置くもの

本・論文・教科書の原稿と図の正本は書斎の専用リポジトリ `/Users/masa/projects/bookshelf-armada/bzm/`（`masa-teamarmada/bookshelf-armada`）にある。
原稿を書く・直す作業は書斎のリポジトリで行う。
2026-10-31 に、ここにあった原稿・論文・教科書・作業メモの写しを削除した（まさ「OSからは執筆途中のものを削除しておいてほしい」）。
削除した写しは、書斎のリポジトリの同じパス `bzm/` に、同じ中身かより新しい版がある。

ここに残すのは、AMD OS のモデルと採点が読む文書だけ。

| 種類 | ファイル | 読むもの |
|---|---|---|
| モデルの正本が指す文書 | `bzm-2-2-strategic-slack-and-propulsion.md`、`bzm-2-1-dynamic-business-value-model.md`、`bzm-1-0-to-2-1-evolution-guide.md`、`sps-current-*.md`、`terminology_glossary.md`、`BZM_2_0_*.md`、`score-and-bottleneck.md`、`SPS_NAT_VALUE_MEASURE_PROPOSAL_2026-08-16.md`、`SEED_Q_RUBRIC_2026-08-15.md` | `model/CURRENT.json` と `model/LOCK.json`、モデルの画面（`/model`）、数式の正本 |
| 採点の設計記録 | `BZM_2_1_*.md`、`BZM_2_2_*.md`、`BZM_SEED_*.md`、`BZM_THEORY_REAUDIT_2026-08-13.md`、`SEED_*.md`、`SPS_*.md`、`sps-2-0-sx-measurement-log.md` | シーズ評価の画面と部品のコメントが正本として指す |
| 試算データ | `pilot/` | BZM 2.2 の暫定値の生成と検査（`pwa/scripts`） |
| 作業記録 | `runs/` | シーズ評価の監査と候補の評価 |

AMD OS のモデルと理論の承認・ロックは `model/` で管理する。
OS の `/bzm` 配下には画面がなく、middleware が書斎へ送る（`pwa/spec/2-1-pwa-runtime-routes.md`）。
