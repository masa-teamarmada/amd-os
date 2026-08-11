---
name: amd-os-external-research
description: つくよみの平日外部リサーチを、SlackではなくAMD OSの通知レビューへ1件ずつ出す。URLと出来事の全履歴重複を除き、採用された候補だけを該当PJ cockpitの「経営ハイライト → 採用リサーチ」に残す。
---

# つくよみ 外部リサーチ候補

## 目的と境界

- 平日09:00 JSTに、対象PJへ直接効く新しい公開情報だけを探す。
- 出力先は `project_strategy_signals` + `l2_notifications` のreview-first経路。Slackへ送らない。
- LLMはDBへ直接書かない。候補ごとにoutboxを作り、非LLM helperで反映する。
- 通知の「採用」で `status='confirmed'` になった情報だけがPJ cockpitへ残る。「見送り」は表示しない。
- 新情報ゼロは正常終了。空outbox、日次まとめ、古い代替記事を作らない。

## 最初に読む

日常運用の人向け正本は、AMD OSマニュアルの3-3章。
このSKILLはautomationが読む実行手順であり、まさが運用を確認する入口にはしない。

1. `pwa/manual/3-3-notifications-and-tsukuyomi.md` の「つくよみ外部リサーチ」
2. `pwa/spec/3-6-strategy-signals-current-spec.md`
3. `pwa/spec/3-7-notifications-current-spec.md`
4. `pwa/spec/3-8-cockpit-current-spec.md`
5. `pwa/design/project_strategy_signals.md`
6. `pwa/design/notifications.md`
7. `pwa/design/db_schema.md`

## 対象PJ

旧 `gas-external-research` の対象を、現行DBで確認済みのproject_idへ対応させる。実行時も `projects` で存在を確認し、名称を推測しない。

| project_id | code | 主な検索対象 |
|---|---|---|
| `p00` | AMD | ディープテック支援、大学発事業化、GAPファンド、START/NEDO/SBIR |
| `p10` | SE | マイクロ波ワイヤレス給電、インフラ防災・自立型センシング |
| `p11` | BWE | 濃度差発電、塩分濃度差発電、関係組織の動き |
| `p06` | CTB | 虚血性脳卒中、ラジカル捕捉、創薬公募・関係組織 |
| `p19` | ZMP | 水素特殊車両・水素ステーション、道路保守DX、東京都/葛飾区GX |
| `p20` | CX | 磁気冷凍、データセンター冷却、量子・極低温冷却、NIMS関連 |
| `p21` | SX | シアノバクテリア、重金属/染色排水処理、愛媛大学関連 |

`p11` は終了PJだが、旧リサーチlaneの継続対象として明示的に含める。statusだけで自動除外しない。

## 検索窓と採用条件

- 火〜金: 実行時点から過去24時間に公開された情報。
- 月曜: 週末を含む過去72時間。
- source pageの公開日または公式更新日を確認できない情報は候補にしない。
- 検索結果の要約文ではなく、公式発表・公募ページ・当事者発表など確認可能なsource pageを開く。
- 一般論、業界概況、過去イベントの振り返り、PJの具体的判断につながらない情報は除外する。
- 古い記事を「関連情報」として穴埋めしない。

### 3分類

- `industry_market`: 規制変更、競合の具体的動き、技術ブレイクスルー。`signal_type='ip_regulatory'`を基本にする。
- `grant`: 応募可能な公募中または近日公募予定の助成金。`signal_type='funding'`。
- `partner`: 関係組織・人物、具体的な協業候補の動き。`signal_type='partnership'`。

## 重複判定

候補ごとに一時JSONを作り、次を実行する。

```bash
node pwa/scripts/ms_progress_review_tool.mjs external-research-check --file /tmp/external-research-candidate.json
```

入力は最低限、`project_id`, `title`, `entity`, `event_date`, `source_url`。重要な事実差分がある続報だけ `material_update` を付ける。

- URLは追跡query、fragment、末尾slashを除いたcanonical URLで比較する。
- `title + entity + event_date + material_update` のsemantic fingerprintを `source_hash` にする。
- DBのcandidate/confirmed/rejected/archived全履歴と、未反映outboxの両方を見る。
- `accepted=false` は出力しない。同じ情報の言い換え、転載、URL差し替えも再通知しない。
- 続報は、締切確定・採択結果・金額変更など意思決定に効く新事実を `material_update` に明記した場合だけ別候補にできる。

## outbox

保存先:

`/Users/masa/.codex/automations/amd-os/strategy-signals-outbox/<YYYYMMDD-HHmmss>-external-research-<project_id>-<hash12>.json`

1ファイルに `strategySignals` 1件、`notifications` 1件だけ入れる。本文・記事全文・検索結果全文は保存しない。

```json
{
  "generatedAt": "ISO-8601",
  "ym": "YYYYMM",
  "source": "codex-automation:tsukuyomi-external-research",
  "strategySignals": [{
    "project_id": "p21",
    "ym": "YYYYMM",
    "signal_date": "YYYY-MM-DD",
    "signal_type": "ip_regulatory|funding|partnership",
    "title": "日本語の短い事実",
    "summary": "PJへの具体的な意味を含む日本語の要約",
    "impact_level": "low|medium|high|critical",
    "decision_state": "observed",
    "status": "candidate",
    "origin_kind": "external_research",
    "research_category": "industry_market|grant|partner",
    "source_refs_json": [{
      "source": "発表主体",
      "date": "YYYY-MM-DD",
      "title": "source page title",
      "canonical_url": "canonical URL",
      "snippet": "判断に必要な短い根拠のみ"
    }],
    "source_hash": "external-research-checkが返した64桁hash",
    "confidence": 0.5,
    "created_by": "codex_automation:tsukuyomi_external_research"
  }],
  "notifications": [{
    "l2_kind": "project_strategy_signal",
    "target_id": "p21",
    "scope_key": "YYYYMM:strategy:<hash12>",
    "title": "外部リサーチ候補: <title>",
    "summary": "<summary>",
    "saved_count": 1,
    "total_count": 1,
    "importance": 2,
    "metadata_json": {
      "origin_kind": "external_research",
      "research_category": "industry_market|grant|partner",
      "signal_type": "ip_regulatory|funding|partnership",
      "signal_source_hash": "64桁hash"
    }
  }]
}
```

全候補を書いたら、非LLM helperで反映する。

```bash
node pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir --dir /Users/masa/.codex/automations/amd-os/strategy-signals-outbox
```

`writtenCount` と通知の `ok` を確認する。重複skipは成功。秘密値、raw本文、source URLをrun summaryへ出さない。

## 完了報告

日本語で件数だけを短く出す。

- 対象PJ数
- 新規候補数（3分類別）
- 重複skip数
- 期間外/根拠不足skip数
- apply成功数、エラー数
- 新規ゼロなら「新規候補なし。通知・outboxなし」

## 禁止

- Slack API、Slack connector、GAS Report APIへ投稿する。
- 検索結果の文章をsource page未確認で候補にする。
- 同じ情報を日付だけ変えて再提出する。
- candidateをcockpitへ直接表示・confirmedへ自動昇格する。
- DBへ直接insert/updateする。
- candidateゼロ時に空outboxを作る。
