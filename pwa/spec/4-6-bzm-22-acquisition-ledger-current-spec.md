# 4-6 BZM 2.2 獲得台帳 現行仕様

PJコックピット `スコア詳細` タブに置く「これまでのPJ活動のなかで得てきたもの」の台帳。
理論正本は [`pwa/bzm/bzm-2-2-strategic-slack-and-propulsion.md`](../bzm/bzm-2-2-strategic-slack-and-propulsion.md)。
表示契約は [`4-2 AMD Score`](4-2-amd-score-current-spec.md) の「Score detail 表示契約」に登録する。

## 1. 何のための台帳か

まさ確定 2026-08-13:

> 各PJのコックピットのスコア詳細タブ内に「これまでのPJ活動のなかで得てきたもの」をリストとして書いておくべきじゃないかなと思った。それは推進力や戦略余力の計算根拠にもなると思う。

> そのまま数えることはしないけど、でも並べて、それを2.2モデルに従って定量的に数式に入れていかないといけないじゃん。

つまりこの台帳の役目は2つある。

1. **人が読む**: そのPJが何を得てきたかを、時系列で省略せずに読める形にする。
2. **計算の入口になる**: 2.2 の $\sigma_j$（行動別制約の証拠状態）へ写像し、実行可能集合 $\Gamma_{\mathrm{exec}}^{\mathrm{reg}}$ を通じて推進力・戦略余力へ効かせる。

「得たものの件数を足して余力へ加点する」ことはしない。2.2 §7 の「経路数をそのまま加点しない」、§4 の「異なる単位を足して一つの点数へしない」に反するため。台帳が計算へ効く唯一の経路は、**どの制約が `不明`／`違反` から `充足` へ動いたか**である。

## 2. 二段階の運用

| 段 | `numeric_binding` | 計算への影響 | 状態 |
|---|---|---|---|
| 第1段 | `display_only` | なし。J / P / Q / S・SPS・戦略余力のどの式にも入らない | 現行 |
| 第2段 | `bound` | `closed_constraints` を $\sigma_j$ へ写像し、$\Gamma_{\mathrm{exec}}^{\mathrm{reg}}$ を動かす | 未着手 |

まさ確定:「最初はまだ数値を入れない、という意味ならOK。定量評価に使わないとだから、第二段階で数値を入れていくというなら問題なし。」

第2段へ進むときは、写像規則をこの章へ追記してから `numeric_binding='bound'` へ上げる。DB側の CHECK により、`bound` にするには `bound_target` が空文字であってはならない。写像規則が書かれていない `bound` 行を作れないようにするための機械的な防波堤。

## 3. データ正本

テーブル: `public.project_bzm_2_2_acquisitions`（migration `277_project_bzm_2_2_acquisitions.sql`）
列の実体は [`design/db_schema.md`](../design/db_schema.md) を正本とする。

**1行 = 1つの正規化事象**（2.2 §3）。同じ事象を支える契約書・議事録・銀行明細は複数の証拠であって複数の事象ではないので、1行にまとめて `evidence_refs` へ並べる。

| 列 | 型 | 意味 | 2.2 対応 |
|---|---|---|---|
| `acquisition_id` | uuid PK | 行の識別子 | — |
| `project_id` | text | PJ | — |
| `canonical_event_key` | text | PJ内で一意な事象キー。`UNIQUE (project_id, canonical_event_key)` | §3 正規化イベント |
| `occurred_on` | date | 事象が起きた日 | §3 |
| `title` / `summary` | text | 人が読む見出しと説明 | — |
| `audit_tags` | jsonb array | 監査用タグ。排他分類ではなく多重付与 | §3 |
| `evidence_stage` | text | `observed` / `calculated` / `estimated` / `conditional` / `missing` / `not_applicable` | §10 証拠段階 |
| `evidence_refs` | jsonb array | 証拠への参照 | §3 |
| `state_effects` | jsonb array | 状態8層のどこに効いたか | §4 状態ベクトル |
| `closed_constraints` | jsonb array | どの制約が動いたか | §5 行動別制約 |
| `consumed` | jsonb array | 何を消費したか | §6 推進力 / §8 危機判定 |
| `action_delta` | jsonb array | 行動集合の増減 | §6 |
| `numeric_binding` | text | `display_only` / `bound` | 本章 §2 |
| `bound_target` | text | `bound` のとき、どこへ写像したかを人が読める形で残す | 本章 §2 |
| `information_cutoff` | date | 情報締切 | §10 |
| `model_version` | text | 既定 `bzm2.2-acquisition/v1` | — |
| `source_origin` | text | `manual` / `extraction` | 本章 §6 |
| `status` | text | `active` / `superseded` / `rejected` | — |

### JSON の形

```jsonc
// evidence_refs
[{ "source": "drive", "source_ref": "…", "important_evidence_id": "uuid|null", "note": "" }]

// state_effects — layer は x/r/c/k/n/l/e/b
[{ "layer": "k", "effect": "共同研究契約の締結権を得た", "note": "" }]

// closed_constraints — before/after は unknown|violated|met
[{ "constraint_key": "…", "constraint_type": "contract", "action_key": "…",
   "before": "unknown", "after": "met", "note": "" }]

// consumed — amount は null 可 (未計測)。null を 0 と読み替えない
[{ "resource_kind": "cash", "amount": null, "unit": "JPY", "irreversible": true, "note": "" }]

// action_delta
[{ "action_key": "…", "direction": "opened", "note": "" }]
```

`state_effects.layer` は 2.2 §4 の
$\mathbf s_t=(\mathbf x_t,\mathbf r_t,\widehat{\mathbf c}_t,\mathbf k_t,\mathbf n_t,\boldsymbol\ell_t,\mathbf e_t,\mathbf b_t)$
に対応する。

$$
\mathbf s_t=(\mathbf x_t,\ \mathbf r_t,\ \widehat{\mathbf c}_t,\ \mathbf k_t,\ \mathbf n_t,\ \boldsymbol\ell_t,\ \mathbf e_t,\ \mathbf b_t)
$$

| 記号 | 台帳の `layer` | 意味 |
|---|---|---|
| $\mathbf x_t$ | `x` | 進捗・技術知識の証拠 |
| $\mathbf r_t$ | `r` | 資源（現金・人・設備） |
| $\widehat{\mathbf c}_t$ | `c` | 能力の事後推定 |
| $\mathbf k_t$ | `k` | 権利・契約・統治・規制 |
| $\mathbf n_t$ | `n` | 相手方との関係・確約 |
| $\boldsymbol\ell_t$ | `l` | 受け手別の正当性 |
| $\mathbf e_t$ | `e` | 外部環境・期限 |
| $\mathbf b_t$ | `b` | 自分たちの信念 |

## 4. なぜ「得たもの」だけでなく消費も持つか

2.2 §8 の危機判定は「消費した資源に対して、残課題・残時間・不確実性・行動集合が改善していない」で定義される。獲得だけを並べた台帳ではこの判定が作れない。だから同じ行に `consumed` を持ち、獲得と消費を同じ事象の両面として記録する。

`consumed.amount` が `null` のときは未計測であり、0 ではない。0 として集計してはいけない。

## 5. DB 側の防波堤

migration 277 が持つ CHECK は、2.2 の禁止事項を文章ではなく機械で守るためにある。

- `evidence_stage` / `numeric_binding` / `source_origin` / `status` の値域 CHECK
- `bound_target` CHECK — `numeric_binding='bound'` なら `bound_target` が非空
- `json_arrays` CHECK — 6つの jsonb 列はすべて配列。オブジェクト直入れによる集計事故を防ぐ
- **合計列を持たない** — 異なる単位を足す場所を作らない

RLS は `project_management_tracks` と同方針（read は全員、書きは `is_admin()` と `service_role`）。

## 6. API

`GET /api/project/[projectId]/bzm-2-2-acquisitions`

- 認証: `requireMember()`
- `runtime = "nodejs"` / `dynamic = "force-dynamic"` / `Cache-Control: private, no-store, max-age=0`
- `status='active'` のみ、`occurred_on` 降順（点数順に並べ替えない）
- 返り値: `{ projectId, displayOnly, acquisitions[] }`。`displayOnly` は全行が `display_only` のとき true

人が直接叩く書き込み API は第1段では設けない。投入経路は次の2つだけ。

1. migration（`source_origin='manual'`）
2. 重要情報の正本化に相乗りする派生書き込み（`source_origin='extraction'`）

### 抽出由来の派生書き込み

通知で「重要情報として保存する」が採用され、`project_important_evidence` への正本化が成功した直後にだけ、
同じ事象を獲得台帳へ1行写す。実装は
[`src/lib/bzm-2-2-acquisition-from-evidence.ts`](../src/lib/bzm-2-2-acquisition-from-evidence.ts) の
`buildBzm22AcquisitionFromImportantEvidence()` と、
`src/app/api/notifications/feedback/route.ts` の `upsertBzm22AcquisitionFromEvidence()`。
LLM を呼ばない純粋写像で、判断は一切しない。

| 台帳の列 | 抽出由来での埋め方 |
|---|---|
| `canonical_event_key` | `important_evidence:{content_sha256}` |
| `occurred_on` | 監査日 → 決算日 → 対象期間末 → 資料の更新日/作成日 → 検知日 の順で最初に採れたもの |
| `audit_tags` | 重要度カテゴリ → 監査タグの写像（多重付与。排他分類にしない） |
| `state_effects` | 重要度カテゴリ → 状態8層の写像。`effect` は「この層の証拠が増えた」だけを書き、量を書かない |
| `evidence_stage` | 文書自身の日付が採れ、かつ全文読取済みのときだけ `observed`。それ以外は `estimated` |
| `evidence_refs` | `lineage` をそのまま参照へ。原文取得が未了なら `note` に明記 |
| `closed_constraints` / `consumed` / `action_delta` | **常に空**（後述） |
| `numeric_binding` | 常に `display_only` |

**三点セットを抽出で埋めない理由**: どの制約が `不明`／`違反` から `充足` へ動いたかは意味判断であり、
カテゴリの allowlist 写像で機械的に埋めると「未取得」を「無し」あるいは「充足」に見せてしまう。
2.2 §10 の「missing を 0 に読み替えない」に反する。空配列は未取得であって 0 ではなく、
UI は「記録なし（未取得）」と描く。ここを埋めるのは第2段（§2）で、人またはモデルの判断を経てからにする。

**冪等性と失敗時の扱い**: `UNIQUE (project_id, canonical_event_key)` に対する upsert なので、
同じ資料を何度採用しても行は増えない。既に正本化済みの重要情報を再採用した場合も同じ写像を通すので、
台帳追加より前に正本化した分をここで拾える。台帳への書き込みが失敗しても重要情報の正本化は取り消さず、
API 応答の `message` に失敗した旨だけを足す（獲得台帳は重要情報の従属物であり、逆ではない）。

契約テストは `npm run test:bzm-2-2-acquisition-from-evidence`。

## 7. UI

`Bzm22AcquisitionLedger`（`src/components/cockpit/Bzm22AcquisitionLedger.tsx`）を
`Bzm22ProvisionalObservatory` の中に置く。

守ること:

- **日付順**に並べる。スコア順・重要度順に並べ替えない
- **合計欄・件数バッジを出さない**（数えたものを成果指標に見せない）
- `display_only` のあいだは「この台帳はまだどの計算にも入っていない」と明示する
- `evidence_stage` は行ごとにラベル表示し、`missing` を空欄や 0 に見せない
- 三点セット（閉じた条件 / 消費 / 行動の増減）は同じ行の中で並べ、獲得だけを切り出さない

## 8. 変更ゲート

- この台帳の表示項目を増やすときは、[`4-2`](4-2-amd-score-current-spec.md) の「Score detail 表示契約」にも行を足す
- 列を足すときは migration + `python3 -X utf8 scripts/dump_schema.py` を同じ作業単位に含める
- `numeric_binding='bound'` を初めて使うときは、本章 §2 に写像規則を追記してからにする
