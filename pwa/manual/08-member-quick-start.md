# 08. はじめて使う人向け — ざっくり使い方

AMD OS をまだよく分かっていないメンバーが、最初に迷わないための章。細かい仕様は後半の「全体設計・細かい仕様」へ回し、ここでは **どの画面で何を見るか** だけを掴む。

## 8.1 まず見る順番

```text
ログイン
  ↓
/dashboard
  ↓
自分に関係ある PJ を開く
  ↓
/project/{project_id}/cockpit
  ↓
必要に応じて /mypage / notifications / reimburse
```

| やりたいこと | 開く場所 | 見るもの |
|---|---|---|
| 自分の担当 PJ を確認したい | `/dashboard` | PJ 一覧、各 PJ cockpit への入口 |
| 自分の今週の活動・報酬予定を見たい | `/mypage` | 参加 PJ、今週やったこと、月次報酬予定、月次TODO |
| PJ の状況を見たい | `/project/{project_id}/cockpit` | AMD Score、MS、経営ハイライト、月次ルーティン、MTG サマリ |
| OS からの確認依頼に答えたい | `/notifications` | L2 候補、MS差分、台帳差分、XRL根拠、修正依頼 |
| 立替を申請したい | `/reimburse` | 領収書添付、金額、用途、PJ 紐付け |
| 請求・支払・PJ台帳を触りたい | `/admin/*` | admin 権限が必要 |

`/mypage` と `/reimburse` の日常作業をもう少し具体的に見るなら [10 章 メンバーの日常ワークフロー](10-member-workflows-quick-start.md)。

## 8.2 日常の使い方

### 自分の仕事を見る

1. `/mypage` を開く
2. 今週の活動ログを確認する
3. 月次報酬予定に取り消し線が出ていたら、未完の月次ルーティンがないか見る
4. 参加 PJ の cockpit へ移動する

`/mypage` は「自分のための OS 入口」。全社の管理画面ではなく、自分の参加 PJ と月次TODOを確認する場所。

### PJ を見る

1. `/dashboard` から PJ cockpit を開く
2. 上段で AMD Score / XRL / PJ メタを確認する
3. 左カラムで年間 MS と月次サマリを見る
4. 中央カラムで経営ハイライトと MTG サマリを見る
5. 右カラムで月次ルーティンとつくよみメモを見る

細かい見方は [01 章 PJ コックピット](01-pj-cockpit.md)。

### 月次ルーティンを進める

標準 PJ は次の順番。

```text
請求額確定 -> 報告会日程調整 -> 月次報告書FIX
  -> 立替精算確認 -> 請求書発行 -> 請求書送付
```

各 step は行をクリックすると専用モーダル / ページが開く。月見出しをクリックした時だけ、月次の集約モーダルが開く。

締切日、CTB 例外、報酬取り消し線との関係は [10 章](10-member-workflows-quick-start.md#103-月次todoの流れ) にもまとめている。

### 通知に答える

`/notifications` は、OS が「これを正本に入れていい?」と聞いてくる場所。

| ボタン | 意味 |
|---|---|
| はい・反映 | 候補を正本に昇格する |
| いいえ・不採用 | 候補を rejected / invalid にする |
| コメント | つくよみに修正依頼として残す |

通知は事後報告ではなく、**正本反映前の確認ゲート**。迷ったらコメントだけ送る。

## 8.3 役割別の最短導線

| 役割 | 最初に見る | 次に見る |
|---|---|---|
| PJ 担当メンバー | `/mypage` | 担当 PJ cockpit |
| PM | 担当 PJ cockpit | 月次ルーティン / `/notifications` |
| PL | `/mypage` | 請求額確定の承認通知 |
| AMD 経営チーム | `p00 cockpit` / `/notifications` | 各 PJ cockpit / 提案前の論点整理 |
| admin | `/admin/projects` / `/admin/billing` | `/admin/payouts` / `/admin/members` |

## 8.4 探索系の画面

| 画面 | 役割 |
|---|---|
| `/atlas` | 外部マクロシグナルと判断材料 |
| `/atlas/macrotrends` | 世界の構造課題と 10-30 年の変化仮説 |
| `/seeds` | 研究シーズ候補 |
| `/vcs` | 国内ディープテック VC マスタ |
| `/scholar` | 学術トレンド。AMD Score の μ_A 根拠 |
| `/venture-map/amd-score` | PJ / SU の AMD Score 一覧 |
| `/management-score` | AMD 全社の経営健康度 |

探索系の詳しい使い方は [09 章 探索系アセット](09-research-assets-quick-start.md)。

## 8.5 これはやらない

- OS が勝手に経営判断を決めるわけではない
- 通知の候補は、人間が確認するまで正本ではない
- Slack / Gmail / 議事録の全文を OS に丸ごと見せる画面ではない。必要な snippet / evidence / hash だけを扱う
- admin 権限のないメンバーが、全社の請求・支払・台帳を自由に変更する場所ではない

## 8.6 分からなくなった時

| 困りごと | 読む章 |
|---|---|
| PJ cockpit の見方が分からない | [01 章](01-pj-cockpit.md) |
| 月次ルーティンの締切が分からない | [01 章 1.5](01-pj-cockpit.md#15-月次ルーティン--報告書--請求--会計) |
| `/mypage` の報酬や立替の流れを知りたい | [10 章](10-member-workflows-quick-start.md) |
| 通知の「はい / いいえ」が怖い | [22 章](22-notifications-and-tsukuyomi.md) |
| どのデータがどこから来るか知りたい | [00 章 0.3](00-intro.md#03-5-生データの俯瞰) |
| AMD Score の式まで知りたい | [21 章](21-amd-score-spec.md) |
