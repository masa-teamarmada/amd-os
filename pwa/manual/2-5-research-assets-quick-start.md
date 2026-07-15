# 探索・知識アセット — Atlas / Seeds / PoC / VC / Scholar / Knowledge Map の使い方

AMD OS は、既存 PJ を管理するだけでなく、次の PJ 候補を探すための探索系アセットと、AMD 内に溜まったノウハウを眺める知識アセットを持つ。この章は、AMD メンバーが「どの画面を見れば何が分かるか」を最短で掴むための入口。

## 6 つの役割

| 画面 | 一言でいうと | 使う場面 |
|---|---|---|
| `/atlas` | 外部シグナルの地図 | 政策・市場・論文・投資ニュースが、どの領域や PJ に影響しそうかを見る |
| `/seeds` | 研究シーズ候補の棚 | 大学・国研・高専などの技術シーズを、AMD 視点で調査・接触・PJ 化まで追う |
| `/poc` | PoC案件化の棚 | シーズとPoC先を入力し、その掛け合わせからヒアリング、PoC条件、謝礼、契約、収益分配を設計する |
| `/vcs` | 国内 deeptech VC マスタ | どの VC がどの領域・ステージ・ファンド残にいるかを見る |
| `/scholar` | 学術トレンド | OpenAlex 論文数を lane x quarter で見て、AMD Score の M 軸根拠に使う |
| `/knowledge-map` | AMD ノウハウ地図 | OS 内の L2 / manual / spec / BZM 候補を横断して、判断軸・根拠・PJ事例を眺める |

この 6 つは似ているが、混ぜない。

```text
Atlas        = 外部マクロ signal / story / decision
Seeds        = 研究シーズそのもの
PoC          = シーズ x PoC先の案件化設計
VC           = 投資家・ファンド・接点
Scholar      = 学術活動量の時系列
KnowledgeMap = OS 内の L2 / manual / spec / BZM 候補を束ねる内部ノウハウ地図
```

## Atlas を見る

Atlas は、外部環境が AMD の判断にどう効くかを見る場所。

| 画面 | 役割 |
|---|---|
| `/atlas` | signal / story の一覧 |
| `/atlas/inbox` | 自動収集された候補の確認 |
| `/atlas/inbox/submit` | 手動 signal 投入 |
| `/atlas/map` | signal / project / decision の関係地図 |
| `/atlas/macrotrends` | 世界の構造課題と 10-30 年の変化仮説 |
| `/atlas/divergence` | 世界 / 日本差分 |
| `/atlas/decisions` | Atlas 由来の判断ログ |

見方:
1. まず `/atlas/macrotrends` で大きな構造課題を見る
2. 気になるテーマは `/atlas` と `/atlas/map` で根拠 signal を見る
3. PJ や Seeds への影響がありそうなら `/atlas/decisions` に判断ログとして残す

Atlas は VC 個別ニュースや Seeds 本体の棚ではない。VC のファンド動向は `/vcs`、研究シーズ本体は `/seeds` で扱う。

## Seeds を見る

Seeds は、AMD の Before 0 起点となる研究シーズリスト。

```text
candidate -> investigating -> contacted -> discussing
  -> spun_off / declined
```

| 操作 | 何を見る / 何をする |
|---|---|
| 検索 | シーズ名、機関、PI、ラボ、キーワードで探す |
| status filter | PJ 化済み・見送りを除いたアクティブ候補だけを見る |
| domain filter | `gx_energy`, `life`, `materials`, `robo` など lane で絞る |
| 担当 filter | AMD 側 owner ごとに見る |
| 行クリック | 詳細 modal で概要、機関・研究者、AMD 評価、補助金、接触履歴、ニュースを見る |
| 深掘り資料 | 一覧の資料アイコン、または詳細 modal から、確認済みの事業化検討資料をOS内Markdownモーダルで開く。左メニューは表示しない |
| `+ 新規シーズ` | 手入力で候補を追加する |
| `/seeds/inbox` | cron / automation で見つかった未確認 seed を verify / dismiss する |

`spun_off_project_id` が入った seed は PJ 化済みとして `projects` に紐づく。PJ 化済みでも情報資産として残す。

深掘り資料には、AMD内で確認済みの要約・判断資料だけを紐づける。メール本文、議事録本文、一次ソース本文やその生URLを置く場所ではない。

## PoC 案件化を見る

PoC は、Seeds の下流で「どのシーズをどのPoC先に当てると、ヒアリングや有償PoCになりそうか」を組む場所。一次入力は `シーズ` と `PoC先` の2つ。PoC先候補をタグ付きで整備し、タグ・検索・状態で絞った候補をシーズごとの案件化キューに出して、そこから案件候補を作る。

| 操作 | 何を見る / 何をする |
|---|---|
| 検索 | シーズ、PoC先、相性仮説、ヒアリング論点、次アクションで探す |
| 案件状態 filter | 候補、質問設計、紹介済、ヒアリング済、PoC設計中、PoC実施中、案件化を分ける |
| PoC先状態 filter | 候補、リスト化、接触済、ヒアリング中、PoC設計可を分ける |
| シーズを追加 | シーズ名、機関、研究者、用途・業界タグ、キーワード、概要、次アクションを保存する |
| PoC先を追加 | PoCを受けてくれそうな企業・事業所・組合・施設カテゴリ、業界タグ、過去PoC/紹介経路、謝礼メモを追加する |
| PoC先候補リスト | 候補先を表形式で比較し、業界タグ、地域、規模感、状態などのタグで絞る |
| 案件化キュー | シーズごとに既存案件と上位PoC先候補を見て、`案件化` から仮説・質問・条件の初期案を作る |

PoC 画面は、議事録や外部ソースの全文を保管する場所ではない。保存するのは、次の提案やヒアリングで使う構造化された仮説とメモだけ。

## VC List を見る

VC List は、国内 deeptech VC のファンド・接点・ニュースをまとめる。

| 見るもの | 内容 |
|---|---|
| VC 本体 | `name`, `type`, `thesis`, `amd_rating` |
| ファンド | 号数、サイズ、vintage、status、DPE 残 |
| 接点 | AMD PJ との関係、担当者、最終接触 |
| 投資 | 自社 PJ への出資、ポートフォリオ |
| ニュース | fundraise / fund close / 投資ニュース |

DPE 残は出所を分けて見る。

| `dry_powder_source` | 意味 |
|---|---|
| `estimated` | 公開情報などからの推定 |
| `heard_from_contact` | VC 担当者から直接聞いた情報 |
| `public_disclosure` | 公開資料で確認できる情報 |

`/vcs/inbox` は VC ニュース候補の受信箱。verify すると `vc_news` の確認済み情報として使える。

## Scholar を見る

Scholar は、個別論文の文献管理ではなく、学術活動量の観測画面。

- データソース: OpenAlex -> `papers_log`
- 粒度: lane x quarter
- 指標: `paper_count`
- 用途: AMD Score の M 軸、特に Triple Helix の学術観測量 `N`

読む時は「この論文が良い」ではなく、「この lane で学術活動が増えているか / 鈍っているか」を見る。

## Venture Map との接続

Venture Map は、探索系アセットを使って「どの波にいつ PJ を投入するか」を見る場所。

| 画面 | 役割 |
|---|---|
| `/venture-map` | macro lane、過去 PJ、論文、政策シグナルの統合マップ |
| `/venture-map/amd-score` | PJ / SU 単位の AMD Score 一覧 |
| `/venture-map/timeline-3d` | 過去 PJ と macro wave の 3D timeline |
| `/venture-map/state-space` | Triple Helix 状態空間 |
| `/venture-map/cyberspace` | 実験ビュー |

細かいモデルは [5-2 章 HUD / Venture Map 仕様](5-2-hud-and-venture-map-spec.md)、AMD Score の式は [4-3 章](4-3-amd-score-spec.md) を見る。

## AMD Materials を見る

`/knowledge-map` は、元素・鉱物・鉱石・樹脂・高分子を、特徴だけでなく供給・用途・AMDとの接点まで辿る材料インテリジェンス画面。従来の Obsidian 風 Knowledge Map も `材料マップ` tab に残している。

| tab | 見るもの |
|---|---|
| 全体 | いま注目すべき材料、供給不安が強い材料、AMDと相性がよい材料の入口 |
| 元素 | 全118元素の周期表。総合注目度 / 需要 / 供給不安 / AMD相性の色を切り替え、cell内の日本語主用途と、常時表示される供給`警戒` / `危機`で全体を読む |
| 鉱物・鉱石 | 元素がどの鉱物・鉱石から得られ、精製後にどの用途へ向かうか |
| 樹脂・高分子 | 原料、物性、用途、循環性、規制・代替、AMDとの接点 |
| 材料マップ | L2 / manual / spec / BZM 候補と正本への入口をマインドマップで見る |
| 比較 | 比較trayへ入れた2〜4材料を共通軸で横に並べる |

使い方:
1. `/knowledge-map` を開き、まず `全体` か `元素` を見る。`元素`では淡黄→黄→橙→赤→深紅ほど注目度が高く、cell上端の`警戒` / `危機`は選択中の色軸に関係なく供給不安を示す
2. 周期表cellの主用途で候補を絞り、cell / row を選んで特徴、供給国、埋蔵・需給メモ、代替・循環性、材料チェーン、source を確認する。`GaN power device`や`RF`のような略語だけでなく、`電力を高効率に変換する窒化ガリウム半導体`、`通信・レーダー用の高周波半導体`のように用途の意味を日本語で表示する
3. 候補を `比較に追加` し、最大4件まで同じ軸で比べる
4. AMD OS 内のノウハウやPJ事例を探すときだけ `材料マップ` を開き、検索・domain filter・node detailから正本画面へ戻る

色は将来予測の確定値ではなく、評価時点の情報をまとめた初期の定性評価。`未評価` は低評価や需要ゼロを意味しない。精密な市況・埋蔵量・生産量を判断に使うときは、detailのsourceから最新の一次資料を確認する。

AMD Materials は読み取り専用。DB write、LLM 呼び出し、画面内Q&A、外部 NotebookLM への自動同期はしない。質問や追加分析は Codex のえいみに依頼し、画面は探索・比較・根拠確認に集中させる。

## 注意

- Atlas 候補、Seeds inbox、VC news inbox は、確認前は正本ではない
- Seeds は外部公開ショーケースではなく、まず AMD 内部の探索台帳
- PoC は Seeds の代替ではない。研究シーズ本体は Seeds、PoC先や条件設計は PoC に分ける
- VC の `amd_rating` は「世間的に良い VC」ではなく「AMD にとっての相性」
- Scholar は論文本文の要約ではなく、学術活動量の観測
- Macrotrend は単発ニュースではなく、構造課題と変化仮説を見るレイヤー
- AMD Materials の材料評価は一次資料への入口であり、投資・調達判断の確定値ではない。生産国・埋蔵量・需給は source の最新版を確認する
- 材料マップは正本そのものではなく、OS 正本への入口。メール全文・Slack全文・議事録全文を保存/表示する場所にしない
