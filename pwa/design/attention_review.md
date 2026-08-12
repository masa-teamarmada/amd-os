# 注意・判断の生成境界

更新日: 2026-08-12

## current truth

通知の主目的は、L2 candidateをOS正本へ採用するか不採用にするかの最終判断。
先手TODOや本人作業の一般通知ではない。

各L2抽出ownerがcandidateを作り、既存 automation id `amd-os-proactive-heartbeat` がcandidateを最終判断カードへ仕上げる。
同じautomation idを使い、別automationは作らない。

## 表示してよいもの

`l2_notifications` は次を全部満たす場合だけapprovedにする。

1. 具体的なcandidateがある
2. 実際の追加・更新先が分かる
3. 追加・更新する情報を列挙できる
4. はいで起きる正本変更が分かる
5. いいえで候補を不採用にできる
6. feedback APIに対象kindの安全な採否処理がある

`protocols.status='candidate'` は代表例。はいで`confirmed`、いいえで`rejected`。
candidate行がDBへ保存済みでも、まだ正本採用済みではない。

## 表示しないもの

- 先手TODO、本人作業、チーム作業
- 会議記録、保存・同期・抽出完了
- 復旧、設定不足、相手待ち
- raw data gap
- 反映先または採否処理がない候補
- 回答済み、重複、根拠不足

根拠不足は `needs_source` とし、まさへ判断を投げない。

## source別の役割

| source | 役割 |
|---|---|
| `l2_notifications` | approvedかつ`requires_masa_decision=true`の正本採否カード |
| `proactive_todos` | 業務TODO。採否通知へ混ぜない |
| `app_notifications` | connector再認証など、直接実行できる復旧例外だけ |
| `meeting_notifications` | 会議記録。通知・未読数へ混ぜない |

## 実行境界

- LLM: Codex automation自身。従量課金provider APIは禁止
- prompt: `llm_prompts.attention.l2.final_decision.v1`
- writer: `pwa/scripts/proactive_heartbeat_tool.mjs` の非LLM applier
- candidate tableのstatusや正本は変えない
- candidate内容と操作契約が変わった時だけ再審査する
- 件数0は正常。空payloadや「何もなかった」通知は作らない
