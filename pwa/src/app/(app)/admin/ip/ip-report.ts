/**
 * AMD OS / AMDプロトコル 知財レポート (admin/ip 表示用)
 *
 * 正本は docs/ip/ 配下:
 *  - docs/ip/2026-05-27_amd_os_protocol_patent_proposal.md (.docx)  発明提案書
 *  - docs/ip/2026-05-27_amd_os_protocol_prior_art_screening.md (.docx)  先行特許スクリーニング
 *  - docs/ip/README.md  入口
 *  - docs/ip/HANDOFF_ip.md  知財作業 handoff
 *
 * このファイルは「まさが OS 上でひと通り読める要約レポート」。
 * 詳細・全公報リスト・請求項全文は上記正本 md / docx を参照。
 */
export const IP_REPORT_UPDATED = "2026-05-29";

export const IP_REPORT_MD = `# AMD OS / AMDプロトコル 知財レポート

弁理士相談前の社内まとめ。**機密 / NDA 前提**。外部共有・公開・登壇・note 投稿の前に、コア部分は弁理士へ確認すること (出願前に公開すると新規性を失う)。

---

## 0. 一枚サマリ

- 特許化を狙う中核は **「DeepTech / Before-Zero (法人設立前の研究シーズ段階) 事業化判断支援システム」のワークフロー + データ構造**。
- **スコアの値・式・軸 (Cobb-Douglas / TRL・BRL・GRL・SRL・HRL の 5 軸 / Triple Helix / FRL) は特許化対象外**。これらは論文・内閣府 SIP からの引用であり、明細書では「公知の引用元」として扱うだけ。
- 出願戦略は **主軸 = ワークフロー / データ構造 (WS-1〜WS-5) の AND 結合**、**補強 = Before-Zero 適用 + 法人設立タイミング判定 (WS-6) を独立従属項**。「適用先が新しいだけ」では進歩性が弱いため、技術構成の組み合わせで勝負する (まさ判断 2026-05-27)。
- 海外 (USPTO / Google Patents で 8 件 verify) + 国内 (J-PlatPat 全文検索 6 式) の二段調査で、**AMD のクレームを直接ブロックする登録特許は確認されず**。特に **Before-Zero / 設立タイミング判定は国内外とも空白**。
- 現状は **初回の弁理士相談を始められる状態**。ただし「出願準備完了」ではない (公報番号の最終 verify、新規性喪失チェック、発明者・権利帰属の整理が残る)。

---

## 1. 特許化候補 (3 要素 + 適用先)

| # | 要素 | 中身 | 既存実装 |
|---|---|---|---|
| 1 | 5 生データ → L2 → 承認 → 正本反映 | Gmail / Drive / Calendar / Slack / Notion から L2 候補を抽出し、証拠メタデータを付けて人手承認 (はい/いいえ/コメント) を経て正本 DB へ。却下・コメントは次回抽出に戻す | L2_DATA / project_strategy_signals / xrl_evidence / notifications |
| 2 | AMDプロトコルの普遍化 + 1:N 事例 + 結果 ledger | 経営判断を分岐点 / 判断材料 / アクションに構造化し、固有名詞除去 + 題目ハッシュで普遍 protocol に集約。結果は時系列 append-only で観測 | amd_protocol (protocols / protocol_examples / protocol_result_observations) |
| 3 | AMD Score revision feedback loop | スコア修正の理由を蓄積 → LLM が軸別ズレ傾向を集約 → 重み / 軸定義 / 閾値の変更候補 → 人手承認で新モデル version 昇格 | score_revision_feedback_loop |
| + | 適用先 | Before-Zero (= 法人設立前の研究シーズ段階) の DeepTech 事業化。出力に「法人設立すべき時期」を含む | amd_score / before-zero theory |

---

## 2. 出願戦略 (まさ判断 2026-05-27 確定)

> 「適用先が新しいというだけじゃ厳しいっしょ。おれも後者のが筋が良いと思う。」

- **主軸 = WS-1〜WS-5 のワークフロー / データ構造軸の AND 結合** (請求項 1-11) を新規性・進歩性の中心に置く。
- **Before-Zero 適用 + 法人設立タイミング判定 (WS-6 / 請求項 12) は補強的な独立従属項**。主請求項に格上げしない。
- スコア値 / スコア式 / 5-7 軸 readiness 定義 / Triple Helix 式 / 重みは新規性主張対象外 (明細書で公知文献として引用のみ)。
- 発明要素 3 は **基幹出願 (要素 1+2) + 連続/分割出願 (要素 3)** に分ける案を推奨 (引用リスクの隔離)。

---

## 3. ホワイトスペース (新規性主張の核)

調査範囲で直接の先行特許が見つからなかった、または組み合わせで差別化できる領域。

| WS | 内容 | 状態 |
|---|---|---|
| WS-1 | 全文非保存 + (snippet + hash + url + run_id + confidence) の 5 タプル証拠メタデータ | 注意: BigID US 11,100,252 B1 が「本文非保存 ML 予測」を押さえる。**単体クレームにせず、承認ゲート + 正本反映 + 普遍 protocol 化とのセットで書く** |
| WS-2 | 却下 / コメントが次回 LLM 抽出プロンプトに自動注入される継続学習ループ (重み更新しない) | 直接の登録特許なし。学術公開あり → 早期出願 |
| WS-3 | 同一意思決定に対する multi-horizon (immediate / 1m / 3m / 6m / 12m / 24m / long_term) × 5 値 valence × confidence の append-only 結果観測 ledger | FHIR Observation / OMOP CDM が schema 同型 (規格) → スキーマ単体でなくシステム複合クレームに |
| WS-4 | 固有名詞除去 + 題目ハッシュによる普遍 protocol 集約 + 1:N 事例構造 | CBR 系が概念的に近い → LLM 抽出パイプラインへの組込みで差別化 |
| WS-5 | AI 提案 → pending → 人手承認 → 設定 / ルール / プロンプト / モデルの新 version 昇格 (governance versioning chain) | Ciena US 10,965,527 が近いが blockchain / network 必須 → AMD は汎用 RDB 実装で回避 |
| WS-6 | Before-Zero 適用 + 法人設立タイミング判定出力 | 同一クレームの先行例なし (conditional yes)。補強従属項 |

---

## 4. 先行特許調査の結論

### 4.1 危険度マップ (2026-05-29 verify 反映)

| 公報 / 文献 | 出願人 | 危険度 | 差別化点 |
|---|---|---|---|
| BigID US 11,100,252 B1 (登録) | BigID | 🔴 高 | プライバシー用途。AMD は事業化判断 L2 抽出 + 承認 + 正本反映で用途・後段が異なる |
| FHIR Observation / OMOP CDM (規格) | HL7 / OHDSI | 🔴 高 (新規性破壊) | 医療規格。スキーマ単体でなく意思決定ドメイン + システム複合で書く |
| Ciena US 10,965,527 B2 (登録) | Ciena | 🟡 中 | blockchain + network 必須。AMD は使わないので回避可 |
| IBM US 7,730,005 B2 / HP US 9,299,025 B1 | IBM / HP | 🟡 中 | Lessons Learned / CBR。AMD は LLM 抽出 + ハッシュ集約 + multi-horizon ledger で差別化 |
| Glean US 12,050,712 B2 (登録) | Glean | 🟡 中 | 権限フィルタ必須。AMD が権限考慮を要素にしなければ回避余地 |
| Microsoft US 12,315,010 B2 (登録) | Microsoft | 🟡 中 | 予測対象は funding/exit/closure のみ。**法人設立 (incorporation) を含まない** → AMD は設立イベントで差別化 |
| Seek AI 米国特許 2 件 | Seek AI (IBM 買収) | 🔴 高 (要 verify) | 公報番号未特定。次回 USPTO Public Search |
| EQT Motherbrain | EQT | 🟢 低 (格下げ) | granted patent の証跡確認できず (報道に "patent" の語なし) |
| CB Insights Mosaic | CB Insights | 🟢 低 (格下げ) | 特許化の証跡なし (トレードシークレット保護の公算) |
| 内閣府 SIP 5 軸 / C2X XRL+ | 内閣府 / 一般社団法人C2X | 対象外 | スコア軸の公知文献。AMD は軸を特許化しないので問題にならない (引用元として記載) |

### 4.2 国内 (J-PlatPat 全文検索 6 式、2026-05-29 実施)

| 検索式 | 国内ヒット | 内容 |
|---|---|---|
| 研究シーズ AND 事業化 | 1 | 「科学技術情報流通支援システム」(2000, 特許消滅)。無関係 |
| (設立時期/設立タイミング/起業時期/創業時期) AND 事業化 | 1 | 「分散投資方法」(2002, 特許消滅)。無関係 |
| (事業化判定/事業化評価) AND (人工知能/機械学習) | 0 | AI 事業化判定の JP 特許はゼロ |
| (経営判断/意思決定) AND (議事録/会議録) | 364 | 一般的な意思決定支援分野 |
| 上記 + 抽出 + (AI/LLM) | 185 | 同上 (汎用 IPS)。AMD 固有 5 要素一致なし |
| 書誌的事項 = スマートシティ企画 | 1 | IoT-EX の IoT 接続システム。XRL+ 運営の関連特許なし |

→ **Before-Zero / 設立タイミング判定に直接ぶつかる JP 特許は確認できず**。XRL+ 陣営 (C2X / 早稲田小野田研 / スマートシティ企画) に関連特許なし。workflow 系は JP でも populated だが AMD 固有組合せ一致は浮上せず (海外調査と整合)。

---

## 5. 「設立タイミング判定は新しいか」への回答

**conditional yes**。「未法人化 (pre-incorporation) 研究シーズを入力 + 出力に法人設立推奨時点を含む」システムの先行例は、国内外とも確認できなかった。

- Microsoft US 12,315,010 は funding/exit/closure を予測するが **法人設立は含まない**。
- ReadyScore.ai / R.A.I.S.E. は post-founding (法人化後) のスタートアップ評価。
- JST START / NEDO TCP / AIST GAP は人手プロセス (AI 自動化なし)。

ただし「適用先の新しさだけ」では進歩性が弱い (容易想到と判断されうる)。**請求項 1-11 のワークフロー / データ構造の AND 結合 + 請求項 12 の Before-Zero 適用** の組み合わせで進歩性を主張する。

---

## 6. 日本で出願するときの新規性ルール (重要)

- 日本特許法 29 条 1 項は **世界公知主義 (絶対的新規性主義)**。**米国 / 欧州 / 中国 / WIPO の特許公報・公開公報、arXiv 論文、Web 公開資料が、すべて日本出願の新規性破壊資料になる**。
- 完全同一なら新規性違反、組み合わせ差なら進歩性違反 (容易想到) で拒絶されうる。
- **出願前に自分で公開すると自分の発明の新規性を失う**。日本は公開から 1 年以内なら新規性喪失の例外 (特許法 30 条) で救済できるが手続きが必要。grace period がない国もある → **早期出願 + 1 年以内 PCT を推奨**。
- 既に AMD が note / 登壇 / 営業資料 / Web でコア要素を公開していないか、出願前に棚卸しが必要。

---

## 7. 残課題 (弁理士相談前 / 相談時)

- 弁理士事務所の正式サーチャーによる先行技術調査 (Seek AI 2 件の番号、Optum US11620581 の権利者名、Ciena / Optum の Claim 1 逐語、早稲田 × レディネスの出願人 AND 検索)。
- **新規性喪失チェック** = AMD の既存外部公開資料の棚卸し (最優先・時間との戦い)。
- 発明者の特定と権利帰属の整理 (AI は発明者になれない / 職務発明 / AMD への帰属)。
- 明細書向けの実施例・図面 (Fig 形式) の整備。
- 1 出願 vs 基幹 + 分割、ドメイン限定をクレームに入れるか明細書実施例に留めるか、の方針確定。

---

## 8. 関連ファイル (正本)

- **発明提案書**: docs/ip/2026-05-27_amd_os_protocol_patent_proposal.md (.docx)
- **先行特許スクリーニング (全公報リスト + 危険度マトリクス + 請求項逃がし方)**: docs/ip/2026-05-27_amd_os_protocol_prior_art_screening.md (.docx)
- **入口**: docs/ip/README.md
- **知財作業 handoff**: docs/ip/HANDOFF_ip.md

このページは要約。請求項全文・全公報リスト・追加検索式は上記正本を参照。
`;
