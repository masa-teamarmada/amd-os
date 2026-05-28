# 探索系アセット — Atlas / Seeds / VC / Scholar の使い方

AMD OS は、既存 PJ を管理するだけでなく、次の PJ 候補を探すための探索系アセットも持つ。この章は、AMD メンバーが「どの画面を見れば何が分かるか」を最短で掴むための入口。

## つの役割

| 画面 | 一言でいうと | 使う場面 |
|---|---|---|
| `/atlas` | 外部シグナルの地図 | 政策・市場・論文・投資ニュースが、どの領域や PJ に影響しそうかを見る |
| `/seeds` | 研究シーズ候補の棚 | 大学・国研・高専などの技術シーズを、AMD 視点で調査・接触・PJ 化まで追う |
| `/vcs` | 国内 deeptech VC マスタ | どの VC がどの領域・ステージ・ファンド残にいるかを見る |
| `/scholar` | 学術トレンド | OpenAlex 論文数を lane x quarter で見て、AMD Score の M 軸根拠に使う |

この 4 つは似ているが、混ぜない。

```text
Atlas   = 外部マクロ signal / story / decision
Seeds   = 研究シーズそのもの
VC      = 投資家・ファンド・接点
Scholar = 学術活動量の時系列
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
| `+ 新規シーズ` | 手入力で候補を追加する |
| `/seeds/inbox` | cron / automation で見つかった未確認 seed を verify / dismiss する |

`spun_off_project_id` が入った seed は PJ 化済みとして `projects` に紐づく。PJ 化済みでも情報資産として残す。

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

## 注意

- Atlas 候補、Seeds inbox、VC news inbox は、確認前は正本ではない
- Seeds は外部公開ショーケースではなく、まず AMD 内部の探索台帳
- VC の `amd_rating` は「世間的に良い VC」ではなく「AMD にとっての相性」
- Scholar は論文本文の要約ではなく、学術活動量の観測
- Macrotrend は単発ニュースではなく、構造課題と変化仮説を見るレイヤー
