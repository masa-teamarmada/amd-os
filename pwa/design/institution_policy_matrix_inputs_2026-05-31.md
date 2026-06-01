# ERS 制度比較マトリクス 実データ入力記録 (2026-05-31)

対象: 香川大学 / 工学院大学 (KUTE) / 物質・材料研究機構 (NIMS)
DB反映/再構築用seed: `pwa/scripts/migrations/120_institution_policy_assessments_seed.sql`

## 入力方針

- 推測で埋めない。
- `unknown` は未確認、`not_started` は根拠を見た上で未整備、`drafting` は草案/検討/審議中、`established` は規程/制度として整備済み。
- `institution_policy_assessments` は admin read 限定なので、内部資料パスは `source_path` に入れる。
- 香川大は公開公式PDFで埋められる認定規則まわりだけ入力し、制度運用・エクイティ・伴走体制は次回ヒアリングTODOとして `unknown` に残す。

## 主要根拠

| 機関 | source_type | 根拠 |
|---|---|---|
| 香川大学 | official | `https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf` |
| 工学院大学 (KUTE) | official | `https://www.kogakuin.ac.jp/research/collaboration/startup.html` |
| 工学院大学 (KUTE) | internal_doc | `/Users/masa/projects/AMD/kute/tmp/extract/venture_rule_comment.txt` |
| 工学院大学 (KUTE) | internal_doc | `/Users/masa/projects/AMD/kute/tmp/extract/20260430（チームアルマダ様）工学院大学_ver2.txt` |
| 工学院大学 (KUTE) | internal_doc | `/Users/masa/projects/AMD/kute/docs/20260512_大学発ベンチャー認定規程_作業記録.md` |
| 工学院大学 (KUTE) | internal_doc | `/Users/masa/projects/AMD/kute/output/mtg_20260526/03_決裁者pros_cons比較.md` |
| 工学院大学 (KUTE) | internal_doc | `/Users/masa/projects/AMD/kute/output/mtg_20260526/04_シーズ掘り起こし_ファンド形成_ヒアリング設計.md` |
| NIMS | official | `https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf` |
| NIMS | official | `https://www.nims.go.jp/business/venture-lab.html` |
| NIMS | internal_doc | `/Users/masa/projects/AMD/CX/docs/20260507_CX_funding_path_comparison.md` |

## 入力サマリ

| 機関 | established | drafting | not_started | unknown | 判断メモ |
|---|---:|---:|---:|---:|---|
| 香川大学 | 16 | 0 | 1 | 15 | 公式認定規則は整備済み。登記前申請は規則上確認できないため `not_started`。支援運用/エクイティ/人材/VCは未確認。 |
| 工学院大学 (KUTE) | 7 | 24 | 0 | 1 | 公式スタートアップ支援は稼働中。認定規程・株式/SO・共有機器等は内部草案/検討中のため `drafting`。EIRは未確認。 |
| NIMS | 25 | 0 | 0 | 7 | NIMSベンチャー援助等規程が強い根拠。GAP/POC資金、EIR/CXO、IP-equity等は今回確認範囲では未確認。 |

## 香川大学 次回ヒアリング質問票

1. 株式/SO取得規程の有無と実運用
   - 国立大学法人として株式・新株予約権を取得、保有、処分できる規程はあるか。
   - 認定大学発ベンチャーからの株式/SO取得実績はあるか。
   - 決裁者、理事会/経営協議会の関与、議決権行使方針、売却方針はどうなっているか。

2. IPライセンス対価としての株式/SO
   - 香川大学保有知財の実施許諾対価として、現金ではなく株式/SOを受けられるか。
   - 発明者還元、知財部門/産学連携部門の会計処理、利益相反処理はどう設計しているか。

3. 外部CEO/CXO/EIR
   - 外部CEO/CXO候補の紹介、マッチング、人材プールはあるか。
   - EIR/客員起業家/起業家メンターの制度はあるか。
   - AMDが入る場合、特任、客員、アドバイザー、業務委託のどれが制度上自然か。

4. PSI/GAP後の伴走主体
   - GAP/PSI/START等の採択後、誰が事業化を伴走するか。
   - 産学連携・知的財産センター、研究推進課、URA、外部支援者の役割分担はどうなっているか。
   - 認定ベンチャー制度と起業前GAP支援は連動しているか。

5. VC/金融接続
   - 香川大学としてVC、地域金融機関、自治体、公庫、CVC等への紹介導線はあるか。
   - ピッチ機会、金融機関連携、自治体補助金連携の定例枠はあるか。
   - 大学名を出した資金調達支援で避けたい表現/禁止事項はあるか。

6. 大学発ベンチャー認定後3年間支援の実態
   - 認定有効期間3年の間に、実際にどんな支援を提供しているか。
   - 施設、商業登記、研究設備、知財相談、広報、紹介、メンタリング、資金申請支援はあるか。
   - 支援メニューごとに、申請書、審査、契約、利用料、支援期間を分けているか。

7. 報告・変更届の実務
   - 年次報告書の提出実績はあるか。
   - 代表者、所在地、事業内容、資本構成、大学関係者の関与変更を届け出る運用はあるか。

## KUTE 未確認リスト

- 認定規程の最終主体: 学校法人 / 大学 / ハイブリッドのどれで固まったか。
- 認定、称号授与、更新、解除、取消、支援決定、改廃、株式/SO取得の最終決裁者。
- 登記前申請、認定予定通知、条件付認定を条文化するか。
- 退職・卒業後3年要件に残る「他職に就かず」要件を削除/緩和するか。
- 称号使用制限を本文に新設するか、様式/誓約で処理するか。
- 変更届を本文・様式どちらに置くか。
- 株式/SO取得規程、新株予約権規程、IP-equityの可否。
- EIR制度の有無。スタートアップ推進フェローとEIRを同一視してよいか。
- CEO/CXO人材プールを制度として作るか、外部紹介の運用に留めるか。
- 大学独自ファンド、共同ファンド、マッチングファンド、LP出資の意向。

## NIMS 未確認リスト

- NIMSベンチャー名称使用/援助対象の審査主体、審議会、決裁フローの詳細。
- 規程改廃決裁者。
- NIMS発ベンチャーにおける退職後期限や兼業/利益相反の具体手続。
- GAP/POC資金の制度有無。
- EIR/客員起業家制度の有無。
- CEO/CXO候補プールやマッチングの制度有無。CX案件の個別運用と制度の切り分け。
- 特許等実施許諾の対価として株式/SOを受けられるか。今回確認できたのは施設等利用料の株式/SO支払い。
- NIMS成果活用ベンチャーとNIMS発ベンチャーで支援期間・継続支援がどこまで違うか。

## 反映方法

- `120_institution_policy_assessments_seed.sql` を Supabase Management API (`pwa/scripts/apply_ddl.py`) で適用する。
- `institution_policy_assessments` は `(institution_id, policy_item_id)` unique の upsert。
- 適用後は REST service role で件数、機関別status分布、サンプル根拠を確認する。
- 画面確認は `/institutions/assess` の「制度整備」「規程比較」「根拠資料」タブで行う。
