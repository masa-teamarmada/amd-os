# 現場判断と分岐 — Before Zero を進める意思決定

> この章は何か: Before Zero の現場で繰り返し出てくる GO / WAIT / NO_GO、設立時期、律速軸、資源配分の判断を、後から再利用できる意思決定パターンとして整理する章です。実ケース本文は、L2⑩ Textbook Insights の承認済み候補が来てから追記します。

## 扱う insight

この章は、現場で「次に進むか、待つか、止めるか」を決めるための知見を扱います。

- GO / WAIT / NO_GO の分岐理由
- 法人設立・PoC・共同研究・資金調達へ進む時期の判断
- 律速軸が TRL / BRL / GRL / SRL / HRL / FRL / σ_SU のどこにあるか
- 限られた AMD リソースをどの PJ / どの軸へ配分するか
- 現場で迷った問いと、その時点で使った根拠

主な L2⑩ `practice_kind` は `decision_branch` です。既存の L2⑩ schema では `insight_type='before_zero_knowhow'` を中心に受け、横断傾向が強い場合は `cross_project_pattern` として扱います。

## 掲載基準

この章に載せるのは、単なる感想ではなく、次のいずれかを満たす判断パターンです。

- 判断前の選択肢が明確である
- どの BZM 軸・AMD Score・ERS・外部環境を根拠にしたかが追える
- 判断後の観測結果や次アクションがある
- 他の Before Zero PJ でも使える問い・ルールに変換できる

載せないもの:

- 根拠がない成功談・失敗談
- 具体的な PJ 名や関係者名だけで意味が閉じるメモ
- 承認前の L2⑩ candidate 本文
- まだ守秘・精度確認が必要な実ケース本文

## L2⑩ 追記ブロックの受け方

local applier が承認済み候補を追記するときは、この章では次の形を基本にします。

```md
### <判断テーマ>

<!-- textbook-insight:<candidate_id> -->

- 判断タイプ: GO / WAIT / NO_GO / RESOURCE_SHIFT / TIMING
- 主な律速軸: <axis>
- 判断前の問い: <question>
- 使った根拠: <evidence summary>
- 判断ルール: <reusable rule>
- 次に見る指標: <next signal>
```

`candidate_id` marker は二重追記防止のために残します。具体的な PJ 名・人物名・商談名は、source refs で根拠を追える場合でも、教科書本文として一般化できる粒度へ変換します。

## まだ未記入 / これから集めるもの

- GO / WAIT / NO_GO の代表的な分岐テンプレ
- 設立時期を遅らせる判断の条件
- 律速軸が変わったときの資源配分ルール
- 「現場の迷い」を BZM の問いへ変換する例示テンプレ
- 判断後の観測結果をどのタイミングで見直すか

## 読めばできること

- Before Zero の判断を、単発の勘ではなく分岐ルールとして記録できる
- L2⑩ candidate をこの章へ入れるべきか判断できる
- GO / WAIT / NO_GO の根拠を BZM 軸と接続して説明できる
- 次に似た局面が来たとき、過去の判断を再利用できる
