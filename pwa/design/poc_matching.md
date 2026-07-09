# PoC Matching

`/poc` は、研究シーズとPoCを受けてくれそうな企業候補を組み合わせ、ヒアリング、PoC設計、謝礼、契約、資金、収益分配まで案件化するための台帳。

## 位置づけ

| レイヤー | 役割 |
|---|---|
| `/seeds` | 研究シーズそのものの棚 |
| `/poc` | シーズ x 企業候補の案件化設計 |
| `/project/[projectId]/cockpit` | PJ化した後の実行管理 |
| `/admin/management-knowledge` | PoC設計で再利用できる型・座組ノウハウ |

2026-07-09 のPoCサービスMTGを起点に追加。Notion議事録はsourceだが、OSへは全文・URLを入れない。保存するのは短い参照名、構造化された仮説、次アクションだけ。

## データ

| table | 役割 |
|---|---|
| `poc_companies` | PoCを受けてくれそうな企業候補。業界タグ、地域、規模感、PoC相性、過去PoC/紹介経路、謝礼メモ、担当、次アクションを持つ |
| `poc_matches` | シーズ x 企業候補のマッチ案件。相性仮説、ヒアリング論点、PoCで確認すること、謝礼、契約、資金、収益分配、状態、優先度を持つ |

`seeds` は研究シーズ側の正本として再利用し、PJ化済み案件は `projects.project_id` に任意で紐づける。PoC企業候補は、過去のAMD接点、かるちゃん側の企業ネットワーク、公開PoC事例の調査結果などから手入力または将来の候補抽出で増やす。

## 状態

企業候補:

```text
candidate -> listed -> contacted -> hearing -> poc_ready -> archived
```

マッチ案件:

```text
candidate -> hearing_design -> introduced -> hearing_done
  -> poc_design -> poc_running -> deal / archived
```

## UI

`/poc` は左ナビの探索グループに置く。

必須要素:

- 上段メトリクス: 企業候補、マッチ案件、進行中、PoC設計以降
- 検索と状態フィルタ: シーズ、企業、仮説、次アクションを横断検索
- マッチ案件追加: シーズ、企業候補、関連PJ、状態、優先度、相性仮説、ヒアリング論点、謝礼・PoC費用、契約、資金、PoC目標、収益分配、次アクションを保存
- 企業候補追加: 企業名、規模感、地域、業界タグ、PoC相性、過去PoC/紹介経路、謝礼、担当、状態、次アクションを保存
- シーズ x 企業マトリックス: 既存マッチをセル表示し、空白セルで未検討の組み合わせを見つける
- 一覧: マッチ案件と企業候補の状態を画面上で更新できる

## Source Hygiene

- Notion、Gmail、Slack、Drive、Webの本文・URLをこの台帳へ直接保存しない
- `source_ref` / `source_note` は `2026-07-09 PoCサービスMTG` のような短い参照名に留める
- 議事録由来のメモは、相性仮説、質問、契約論点、収益分配メモなど、次に使う構造へ落としてから保存する

## 回帰防止

- route、GlobalNav導線、`poc_companies` / `poc_matches` のdata access、マトリックス、マッチ追加、企業追加を消す変更は `FEATURE_REGISTRY.md` と `pwa/scripts/check_pwa_critical_ui.cjs` も同時に更新する
- `/poc` はSeedsの代替ではない。シーズ情報そのものは `/seeds` に残し、PoC固有の企業・条件・質問だけを `/poc` に置く
