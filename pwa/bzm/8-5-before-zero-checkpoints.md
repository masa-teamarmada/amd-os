# Before Zero チェックポイント — 次に何を見るか

> この章は何か: Before Zero の各フェーズで、次に何を確認し、どの赤信号が出たら止まり、何が見えたら次へ進むかを整理する章です。実ケース本文は、承認済み L2⑩ candidate から一般化できるものだけを追記します。

## 扱う insight

この章は、Before Zero を進めるときの確認項目・赤信号・次アクションを扱います。

- フェーズごとの確認項目
- 次に見るべき BZM 軸・L2・外部信号
- 赤信号と、その時点で止める / 待つ / 深掘る条件
- field transition の判断: 探索から検証、検証から設立準備へ移る条件
- 誰に何を聞けば次の不確実性が下がるか
- 繰り返し使える問いのテンプレ

主な L2⑩ `practice_kind` は `reusable_question` と `field_transition` です。既存 schema では `insight_type='before_zero_knowhow'` を基本に、複数 PJ で再利用できる問いは `cross_project_pattern` として受けます。

## 掲載基準

この章に載せるチェックポイントは、次の条件を満たすものです。

- いつ使う問いかが分かる
- 何を見れば答えられるかが分かる
- 赤信号・保留条件・次アクションのいずれかに変換できる
- BZM の軸、AMD Score、ERS、L2 データのどれに接続するかが明確である

載せないもの:

- 「気をつける」だけで、確認方法がない注意書き
- 具体 PJ の ToDo そのもの
- 既存章の理論説明の重複
- 承認前の L2⑩ candidate 本文

## L2⑩ 追記ブロックの受け方

local applier が承認済み候補を追記するときは、この章では次の形を基本にします。

```md
### <チェックポイント名>

<!-- textbook-insight:<candidate_id> -->

- 使うタイミング: <phase>
- 問い: <reusable question>
- 見るデータ: <L2 / BZM axis / external signal>
- 赤信号: <red flag>
- 次アクション: <next action>
```

問いは、次の PJ でもそのまま使える文にします。個別ケースでしか成立しない ToDo は、教科書本文ではなく OS 側の PJ タスク・protocol・meeting summary に残します。

## まだ未記入 / これから集めるもの

- 探索フェーズの確認項目
- 技術検証フェーズの赤信号
- 顧客仮説検証フェーズの問い
- 設立準備へ移る前の最低条件
- WAIT から GO へ戻すために必要な観測

## 読めばできること

- Before Zero の各局面で、次に何を見るかを決められる
- L2⑩ candidate を reusable question / field transition として整理できる
- 赤信号を見つけたとき、止める・待つ・深掘るを分けられる
- 個別 ToDo ではなく、再利用できるチェックポイントとして知見を残せる
