# AMD OS IP / Patent Notes

AMD OS、AMDプロトコル、AMD Score まわりの知財検討メモ置き場。

このフォルダの文書は、弁理士相談・社内整理用のドラフトであり、公開資料ではない。外部共有する場合は NDA 前提にする。

## Current Files

- `2026-05-27_amd_os_protocol_patent_proposal.md`
  - 5 生データから L2 正本を生成する human-in-the-loop 抽出システム
  - 経営判断の普遍プロトコル化 + 1:N 事例 + 結果観測 ledger
  - AMD Score revision feedback loop (= ピント修正後は「複数種類のシステムパラメータの governance versioning loop」として汎用化)
  - 上記 3 要素の発明提案書ドラフト
  - 2026-05-27 ピント修正後に §1 結論 / §9 請求項たたき台 / §10 先行技術差分仮説 / §13 弁理士確認論点を改訂
  - **重要前提**: スコアロジック (Cobb-Douglas / TRL / 5-7 軸 readiness / Triple Helix / FRL 構成) は特許化対象外。論文・公的フレームワークの引用元として明細書に書くのみ
- `2026-05-27_amd_os_protocol_patent_proposal.docx`
  - 同内容の Word 版
- `2026-05-27_amd_os_protocol_prior_art_screening.md` (新版 = ピント修正後)
  - 先行特許一次スクリーニング結果 (Google Patents / USPTO / WIPO / arXiv)
  - 6 軸並列調査 (A: HITL 抽出ワークフロー / B: prompt-level 継続学習 / C: 証拠メタデータ原本非保存 / D: 意思決定 KB / E: multi-horizon outcome ledger / F: AI 提案 governance loop)
  - 危険度マトリクス、TOP 6 公報ハイライト、ホワイトスペース 5 領域、請求項逃がし方戦略、追加検索式、弁理士相談論点
  - **最大の発見**: 軸 E は FHIR Observation / OMOP CDM が schema 同型で新規性破壊リスク。軸 F は Ciena US 10,965,527 が 4 要素網羅 (ブロックチェーン必須が差別化点)
- `2026-05-27_amd_os_protocol_prior_art_screening.docx`
  - 同内容の Word 版

## Next Candidate

- 弁理士面談前の追加検索 (USPTO assignee 検索で Seek AI / BigID / Glean / Notion Labs / DataRobot の公報番号 verify、J-PlatPat 国内出願人検索)
- 既存外部公開資料の棚卸し (新規性喪失例外手続きの要否確認)
- 学術文献 5 件の精読 (arXiv 2408.04560 / 2405.17346 / 2601.04463 / 2511.17118 / 2504.06943)
