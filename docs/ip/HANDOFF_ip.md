# HANDOFF — 知財 / IP (トピック別 handoff)

- Last updated: 2026-05-29
- Topic: AMD OS / AMDプロトコル 特許化検討 (発明提案書 + 先行特許調査 + admin IP ページ)
- Scope: このファイルは **知財トピック専用の handoff**。OS 実装 (L2 / PWA / deploy 等) の handoff は ルートの `HANDOFF.md` を参照 (= 別トピック / 別セッションが管理)。

## 現在地

- 特許化候補 3 要素 (5生データ→L2→承認→正本反映 / AMDプロトコル普遍化+1:N事例+結果ledger / AMD Score revision feedback loop) + Before-Zero 適用 を整理済み。
- **まさ判断 (2026-05-27)**: スコアロジック (Cobb-Douglas / 5-7軸 readiness / Triple Helix / FRL) は特許化対象外。主軸 = ワークフロー/データ構造 (WS-1〜5) の AND 結合、補強 = Before-Zero 適用 + 設立タイミング判定 (WS-6) を独立従属項。
- 先行特許調査: 6 軸 (A-F) + 軸 G (設立タイミング) を並列 agent で実施 → 危険度マトリクス化。
- 公報番号 verify (2026-05-29): 海外 8 件 (Google Patents/USPTO) + 国内 J-PlatPat 全文検索 6 式 (Chrome MCP 手動)。
  - 格下げ: EQT Motherbrain / CB Insights Mosaic (granted patent 証跡なし)。
  - 確定 🔴: BigID US 11,100,252 B1 (WS-1 全文非保存に直撃)。
  - 差別化点確定: Microsoft US 12,315,010 (incorporation 含まず) / Glean US 12,050,712 (権限フィルタ必須) / Ciena US 10,965,527 (blockchain/network 必須)。
  - **Before-Zero / 設立タイミング判定は国内外とも空白 (conditional yes)**。
- OS admin に **/admin/ip ページ新設** (= まさ依頼)。要約レポートを表示。v0.9.0 deploy 済 (本番反映 + 目視確認済)。

## 成果物

| ファイル | 内容 |
|---|---|
| `docs/ip/2026-05-27_amd_os_protocol_patent_proposal.md` (.docx) | 発明提案書 (請求項たたき台 1-12 / 先行技術差分 / 弁理士確認論点 / 出願戦略) |
| `docs/ip/2026-05-27_amd_os_protocol_prior_art_screening.md` (.docx) | 先行特許スクリーニング (危険度マトリクス A-G / TOP公報 / WS-1〜6 / §3.8 verify結果 + J-PlatPat / 追加検索式) |
| `docs/ip/README.md` | 知財メモ入口 |
| `pwa/src/app/(app)/admin/ip/page.tsx` + `ip-report.ts` | OS admin IP ページ (要約レポート表示) |

## 残課題 (弁理士相談前 / 相談時)

- [ ] 弁理士事務所の正式サーチャーで先行技術調査: Seek AI 2件の番号 (USPTO Public Search、IBM買収後) / Optum US11620581 の権利者名 (Optum vs IBM、USPTO Assignment DB) / Ciena・Optum の Claim 1 逐語 (USPTO PDF) / 早稲田大学 × レディネスの出願人 AND 検索。
- [ ] **新規性喪失チェック (最優先・時間との戦い)**: AMD の既存外部公開資料 (note / 登壇 / 営業資料 / Web / pwa) の棚卸し → 公開済みコア要素があれば特許法30条の例外手続き (公開から1年以内) 要否を判定。
- [ ] 発明者の特定と権利帰属 (AI は発明者不可 / 職務発明 / AMD への帰属)。
- [ ] 明細書向けの実施例・図面 (Fig 形式) の整備。
- [ ] 1出願 vs 基幹+分割、ドメイン限定をクレームに入れるか実施例に留めるかの方針確定 (提案書 §13 論点参照)。
- [ ] 弁理士面談予約 + 提案書 + スクリーニングレポート (md+docx) を NDA 前提で共有。

## 次セッション最初に読む

1. `docs/ip/HANDOFF_ip.md` (このファイル)
2. `docs/ip/README.md`
3. `docs/ip/2026-05-27_amd_os_protocol_patent_proposal.md`
4. `docs/ip/2026-05-27_amd_os_protocol_prior_art_screening.md`
5. `pwa/src/app/(app)/admin/ip/ip-report.ts` (OS 上の要約レポート正本)

## メモ

- 日本出願は世界公知主義 (特許法29条1項)。米国/EU/中国/WIPO の公報・arXiv・Web も新規性破壊資料になる。早期出願 + 1年以内 PCT 推奨。
- 並行セッション注意: ルート `HANDOFF.md` は別トピック (L2抽出ルート整理 / PWA deploy) を codex セッションが管理している。知財作業はこのファイルに閉じる。
