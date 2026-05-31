# AMD OS / AMDプロトコル 特許 弁理士初回相談パック（内部版）

- 作成日: 2026-06-01
- 位置づけ: まさ確認用の内部準備メモ。外部送付用ではない。
- 対象: AMD OS / AMDプロトコル / AMD Score周辺の特許出願準備
- 注意: 本文書は法的助言ではなく、弁理士相談前の論点整理。弁理士へ送る場合は、共有範囲を削ってから使う。

## 1. 今回の狙い

今回の出願は、ロイヤリティ収益を短期で狙うものではない。

主目的は以下。

1. NIMS/研究機関導入で、AMD OSを「単なる議事録AI・CRM・業務管理ツール」ではなく、Before-Zero事業化判断OSとして説明する。
2. NDA下の営業、共同研究、導入契約、RFP、提携交渉で、コピーや後出し出願を牽制する。
3. 投資家・提携先に対して、AMDが属人的コンサルだけでなく、仕組みレイヤーの資産を持つことを示す。
4. 外部説明やNIMS Pilotの前に、最小限の優先日を押さえる。
5. AMDの実データ、prompt、calibration、運用ノウハウは営業秘密として残す。

期待値:
- 競合の内部実装を外から見つけて止めるmoatとしては中〜弱。
- 外部製品化、営業資料、導入提案、NDA後コピー、共同研究・RFP流用への牽制としては有効。
- 15〜30万円帯の国内ミニマム出願/初回相談ならROIは高い。
- 30〜50万円帯も基幹出願に絞るなら妥当。
- 100万円超の本格調査、PCT、分割戦略は、NIMS Pilot外部説明や次機関展開見込みが立ってから判断する。

## 2. 弁理士への相談目的

弁理士には、発明の中身をゼロから考えてもらうのではなく、以下を確認してもらう。

- 国内ミニマム出願の手続き、書式、図面、請求項形式
- WS-1〜WS-5のAND結合を主請求項に置く方針の妥当性
- BigID、FHIR/OMOP、Ciena、Seek AI、Glean等に対する請求項の逃がし方
- Before-Zero/設立タイミング判定を主軸ではなく従属・補強に置く方針の妥当性
- 出願書類に書くべき最小限と、営業秘密として書かない方がよい情報の境界
- 発明者、職務発明、共同発明、権利帰属の整理
- 15〜30万円/30〜50万円/100万円超のどの粒度で何ができるか

## 3. 持参資料

### そのまま見せてよい内部資料候補

- `docs/ip/2026-05-27_amd_os_protocol_patent_proposal.md`
- `docs/ip/2026-05-27_amd_os_protocol_patent_proposal.docx`
- `docs/ip/2026-05-27_amd_os_protocol_prior_art_screening.md`
- `docs/ip/2026-05-27_amd_os_protocol_prior_art_screening.docx`
- `docs/ip/HANDOFF_ip.md`
- `docs/ip/README.md`
- 本資料のうち、営業秘密を除いた相談目的・質問・予算レンジ部分

### 画面共有や口頭説明に留める候補

- `/admin/ip` 画面の概要
- AMD OS admin画面のうち、出願対象ワークフローを説明する最小画面
- WS-1〜WS-5が実装・設計上どうつながるかの抽象説明
- NIMS/研究機関導入で想定している使われ方の概要

### まだ渡さない候補

- 実PJの判断事例本文
- 実データ、source permalink、production DB行、長いsnippet
- prompt全文、few-shot、negative examples
- AMD Scoreの実weight、threshold、calibration dataset
- 導入先別の運用ルール、レビュー会議体、connector運用、監視・復旧手順

## 4. 開示範囲の切り分け

### 開示可

弁理士相談資料や明細書に入れてよい粒度。

- 複数種類の業務データ源から候補データを抽出する上位概念
- source種別、source識別子、所在、日付、title、snippet、hash、extraction run id、confidence等の証拠メタデータ
- 候補を正本DBへ直書きせず、人間の承認/却下/コメントを経る流れ
- reject/commentが後続抽出処理に反映される抽象的feedback loop
- 経営判断を「分岐点 / 判断材料 / アクション / 結果」等のprotocol dataへ抽象化する構造
- 1つの普遍protocolに複数PJ事例を紐づける1:N構造
- outcomeを immediate / 1m / 3m / 6m / 12m / 24m / long_term 等でappend-only保存する構造
- prompt/rule/config/model/workflow step等のsystem parameterを pending proposal -> human approval -> new version として昇格するgovernance loop
- 未法人化研究シーズに対して、法人設立推奨時期を出力するカテゴリ

### NDA下のみ

弁理士にはNDAまたは守秘義務前提で説明してよいが、出願書類へそのまま書くかは要確認。

- `/admin/ip` 画面の詳細
- 実装済み/設計済みテーブルやUIの抽象図
- 実運用に近いが匿名化・合成化した例
- NIMS/研究機関導入の想定業務フロー
- 外部提案時に「出願中」と示したい機能境界

### 口頭限定

相談時に文脈として伝えるが、資料として渡さない。

- AMDがどの市場・研究機関・deeptech studioを牽制したいか
- NIMS Pilotや次機関展開の営業上の使い方
- 顧客ごとの導入可能性、価格、交渉上の弱み
- 競合に知られると模倣のヒントになるBefore-Zero市場仮説の詳細

### 出願書類に書かない営業秘密

特許公開後に競合へ渡すべきでない情報。

- system prompt / extractor prompt / evaluator prompt / score revision prompt の全文
- few-shot、negative examples、reject例、comment-to-guidance変換例
- reject/commentをpromptや抽出ルールへ変換する具体アルゴリズム
- model選定、fallback、temperature、chunking、retrieval条件
- Gmail / Slack / Drive / Calendar / Notion / meeting notes / monthly reports の実本文
- source permalink、内部source id、長いsnippet、embedding、raw transcript
- production DB行、顧客名、研究機関名、PJ固有文脈
- AMD Scoreの重み、閾値、イベント加点、FRL/TRL/BRL/HRL等の具体運用値
- 設立タイミング推奨の実判定条件
- 過去PJの正解ラベル、失敗/成功の教師データ、validation結果
- 分岐点 / 判断材料 / アクション / 結果 の実例本文
- 24か月以降の長期outcomeと、その解釈
- polling cadence、outbox/applier設計の具体運用、承認者routing
- 導入機関ごとのonboarding playbook、URA/EIR訓練順序
- connector認証、権限、障害対応、watch対象path、運用監視

## 5. 請求項の狙い

### 主軸

WS-1〜WS-5のワークフロー/データ構造AND結合を主軸にする。

- WS-1: full textを保存せず、snippet/hash/url/run_id/confidence等の証拠メタデータを持つ
- WS-2: 候補を人間が承認/却下/コメントし、承認済みのみ正本に反映する
- WS-2+: reject/commentが後続抽出処理へ反映される
- WS-3: 同一意思決定に対するmulti-horizon append-only outcome ledgerを持ち、矛盾観測も上書きせず提示する
- WS-4: 経営判断を抽象protocol化し、複数PJ事例を1:Nで紐づける
- WS-5: prompt/rule/config/model/workflow step等の異種system parameterに、pending proposal -> human approval -> new versionを統一適用する

### 補強

- WS-6: Before-Zero / pre-incorporation研究シーズへの適用
- 法人設立推奨時期の出力

ただし、WS-6は主請求項へ格上げしすぎない。
「適用先が新しい」だけでは進歩性が弱く、競合へ市場機会を教えるリスクもある。

### 従属項で増やしたい外から見える要素

- 複数業務ソース連携
- 承認/却下/コメントUI
- source snippet / permalink / confidence表示
- 分岐点 / 判断材料 / アクション / 結果の構造化UI
- 1つの普遍protocolに複数PJ事例をぶら下げる画面
- multi-horizon outcome timeline
- pending proposalを人間承認でversion昇格するadmin画面
- pre-incorporation研究シーズ向けの法人設立推奨時期出力

## 6. 先行技術上の注意点

現時点の一次スクリーニングで特に注意すべきもの。

- BigID US 11,100,252 B1: full text非保存 + metadata ML predictionがWS-1に近い。全文非保存単体では取らない。
- FHIR Observation / OMOP CDM: outcome observation schemaがWS-3に近い。医療ではなく経営判断、矛盾観測保持UI、異種evidence統合と組み合わせる。
- Ciena US 10,965,527: AI proposal -> approval -> version保持がWS-5に近い。blockchain/network前提との差分、異種system parameter横断のgovernanceで逃がす。
- Seek AI / Glean / Notion Labs: HITL LLM extraction、enterprise search、SaaS連携まわりに注意。
- Microsoft US 12,315,010 B2: funding/exit/closure予測で、incorporation/foundingは含まない。Before-Zero設立タイミングの差別化材料。

## 7. 弁理士に聞く質問

1. WS-1〜WS-5のAND結合を国内ミニマム出願の主請求項に置く方針で、拒絶リスクと権利範囲のバランスは妥当か。
2. BigID、FHIR/OMOP、Ciena、Seek AI/Gleanを踏まえて、請求項1、outcome ledger、parameter governanceをどう組み直すべきか。
3. Before-Zero / 設立タイミング推奨は従属項・補強項に留めるべきか、それとも独立請求項として残す価値があるか。
4. 出願書類に書く実施例は、合成例・抽象例だけで足りるか。どの程度の実装詳細が必要か。
5. prompt、score重み、calibration、実PJ事例を営業秘密として外したまま、実施可能要件・サポート要件を満たせるか。
6. 発明者、職務発明、共同発明、AMDへの権利帰属をどう整理すべきか。
7. 15〜30万円、30〜50万円、100万円超で、それぞれ何をどこまで依頼できるか。
8. 先に国内出願し、1年以内にPCT判断する方針でよいか。
9. 出願前に追加で最低限やるべき正式サーチは何か。Seek AI、BigID、Ciena、Optum、国内J-PlatPatのどこが必須か。
10. 外部営業資料やNIMS説明で「出願中」と言う場合、どの表現なら安全か。

## 8. 予算レンジと依頼粒度

### 15〜30万円

目的:
- 国内ミニマム出願
- 既存ドラフトをもとにした形式整備
- 請求項レビュー
- 出願手続き代理

判断:
- 今回の初手として最もROIが高い。
- AMD側で発明提案書、先行技術メモ、請求項たたき台を用意済みなら現実的。

### 30〜50万円

目的:
- 基幹出願の請求項・明細書を少し厚く整える
- 図面・実施例・先行技術差分を最低限見る
- 出しすぎ防止と請求項逃がし方まで相談する

判断:
- 基幹出願に絞るなら妥当。
- NIMS/研究機関導入の価格維持に効けば回収余地は十分ある。

### 100万円超

目的:
- 正式先行技術調査
- 請求項/図面/実施例の本格整備
- PCT、分割、継続戦略
- 複数出願への分解

判断:
- 現時点では急がない。
- NIMS Pilot外部説明、次機関展開、投資家説明、共同研究契約のタイミングが見えたら判断する。

## 9. まさ判断事項

1. 国内ミニマム出願を、まず15〜30万円レンジで進めるか。
2. 今回の目的を、ロイヤリティではなく「防御・交渉・価格維持」に固定するか。
3. Before-Zero / 設立タイミング推奨は従属・補強に留めるか。
4. prompt / score重み / calibration / 実PJ事例は営業秘密として出願書類から外すか。
5. 弁理士を、発明設計者ではなく「手続き代理 + 請求項レビュー + 出しすぎ防止チェック」役として使うか。

## 10. 相談前チェックリスト

- [ ] 弁理士へ送る資料から営業秘密を外したか
- [ ] 弁理士へ送らず、画面共有/口頭説明に留める情報を分けたか
- [ ] 2026-05-20 StartPassイベントで話した内容を1ページメモにしたか
- [ ] NIMS/研究機関向けに、出願前に見せない情報を決めたか
- [ ] 発明者候補と権利帰属の未確認点を列挙したか
- [ ] 相談予算の上限を決めたか
- [ ] 弁理士へ「明細書をゼロから書いてほしい」ではなく「既存ドラフトの出願可能化」を依頼する方針にしたか

## 11. 相談時の言い方

今回の相談で最初に伝えるべきこと。

> AMD OSは、研究機関や大学の未法人化研究シーズを、事業化判断へ進めるための内部OSです。今回出願したいのは、スコア式そのものではなく、複数業務データ源から証拠メタデータ付き候補を抽出し、人間承認を通して正本化し、reject/commentを後続抽出に反映し、判断protocolと複数PJ事例、multi-horizon outcome、system parameter governanceをつなぐワークフロー/データ構造です。実データ、prompt、score重み、calibration、実PJ事例は営業秘密として残したいです。まず国内ミニマム出願として、請求項と明細書の出し方、出しすぎ防止、発明者/権利帰属、予算感を相談したいです。

この文面は、そのまま外部送付しない。相談前に、開示範囲を削る。
