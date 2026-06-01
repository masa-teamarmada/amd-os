# FRL_cap_amd historical policy memo

作成日: 2026-06-02 JST
Owner: BZM司令塔 / FRL_cap_amd historical整理 worker
Scope: BZM current truth / Textbook case usage / AMD Score future implementation guard

## frl_cap_amd_historical_policy

`frl_cap_amd` は、AMD メンバーが PJ の `F_capability`（経営実行力）をどれだけ押し上げたかを表す。

```text
frl_cap_amd = F_cap(全員) - F_cap(AMD抜き)
```

ただし、この差分は「現在の company state」ではなく「その評価 row が表す時点の経営体制」に属する。したがって、終了済み PJ / AMD 関与終了済み PJ / company active after AMD relationship の PJ では、current active row に `frl_cap_amd` を載せてはいけない。AMD が関与していた当時の `amd_score_inputs` timeline row を作る、または既存 timeline row を選び、その時点の根拠と一緒に扱う。

この memo は方針整理であり、DB write / DDL / migration / extractor 実装 / score 再計算はしない。

## current_row_vs_timeline_row

| Row | 意味 | `frl_cap_amd` の扱い |
|---|---|---|
| current row | 現在の PJ / company の経営体制を表す row | 現在も AMD が active に経営中核へ入っている場合だけ載せる |
| historical / timeline row | 過去の特定時点の経営体制を表す row | AMD が当時 active に経営実行力を補完していた場合に載せる |

判断原則:

- current row は「今 AMD が経営実行力を補っているか」を見る。
- timeline row は「その時点で AMD が経営実行力を補っていたか」を見る。
- company が現在も active でも、AMD 関係が終わっているなら current row の `frl_cap_amd` は原則 0 / NULL 側に寄せる。
- 過去の AMD 寄与は消さず、AMD 関与時点の timeline row に残す。
- timeline row には、対象時点、AMD側メンバー、役割、根拠 source、関与終了条件を notes に残す。

## project_classification

| PJ | 分類 | current row policy | historical / timeline policy | current truth |
|---|---|---|---|---|
| p07 LST | active AMD support | current row で扱える | 後で経時展開するなら設立前後から別 row 化 | first pass: `frl_cap=6`, `frl_cap_amd=1`。まさ COO / CEO据付 / 体制構築 |
| p20 CX | active / pre-company AMD support | current row で扱える | 設立前・設立時・CEO候補着任後などで row 分割候補 | first pass: `frl_cap=5`, `frl_cap_amd=2`。まさ / あき / きよ / りり |
| p21 SX | active / pre-company AMD support | current row で扱える | PSI Step2、設立準備、NewCo設立時で row 分割候補 | first pass: `frl_cap=4`, `frl_cap_amd=1`。まさ / かる / ちこ / きよ |
| p06 CTB | frozen / light support only | current AMD active 寄与は 0 | COO参画時点の歴史 row は別途 case として残せるが、現 current row へ戻さない | migration 112 で `frl_cap=3`, `frl_cap_amd=0`、AMD row は `left` |
| p04 KT | support ended but company active | current row へ載せない | AMD COO / 体制構築時点の timeline row 候補 | AMD 関与終結後も会社は active、有償展開中 |
| p09 JC | support ended but company active | current row へ載せない | AMD deeptech 化試行 / 野田先生接続 / 退任前後の row 候補 | 2026-03 AMD関与終結、会社は存続 |
| p11 BWE | support ended / company active after AMD relationship | current row へ載せない | まさ CEO / 設立 / 移譲 / 2026-04-30退任前後の row 候補 | 立ち上げと移譲は case 化価値が高いが、退任後の活動を AMD 寄与にしない |

## ended_project_rule

終了済み PJ または AMD 関与終了済み PJ では、current row は「現在その PJ に AMD が active に入っていない」状態を表す。したがって、current row に過去の `frl_cap_amd` を残すと、今も AMD が経営実行力を押し上げているように見えてしまう。

ルール:

- current row: AMD active なしなら `frl_cap_amd` を載せない。
- historical row: AMD 関与期間中の row にだけ `frl_cap_amd` 候補を置く。
- notes: `AMD relationship ended at ...` / `support ended` / `company active after AMD relationship` を明記する。

対象候補:

- p04 KT: まさ COO / 経営体制構築の期間。
- p09 JC: AMD が shallow tech から deeptech 化を試み、野田先生接続を作った期間。
- p11 BWE: まさ CEO / SIP 取りまとめ / 設立 / 経営移管前後の期間。

## support_ended_but_company_active_rule

会社が今も active であることと、AMD が現在も経営実行力を補完していることは別である。KT / JC / BWE のように、AMD 関与終了後に会社が継続・成長・資金調達・販売をしていても、それを current `frl_cap_amd` として積んではいけない。

ルール:

- AMD 関与後の会社活動は、原則 `frl_cap_amd` ではなく、PJ 自身の BRL / HRL / R_net / outcome narrative として扱う。
- AMD が残した型・人材・体制が後続成果に影響した可能性は Textbook case にできる。
- ただし BZM 数式 / score 再計算へ使うには、当時の row と後続 row を分けたうえで「AMD 寄与」と「会社自走」を分離する。

## frozen_project_rule

frozen PJ では、current row を「AMD active support あり」と読ませない。CTB は、まさ指示により `frl_cap_amd=0`、AMD row `left` に補正済みのため、current truth はこの状態を維持する。

CTB の扱い:

- current row: `frl_cap=3`, `frl_cap_amd=0`。
- AMD の現関与: AMED 事務対応などの軽い関与はありうるが、F_capability を active に押し上げる current contribution とは扱わない。
- historical case: まさ COO として資金調達・体制構築に入った期間は、将来 timeline row で別途整理可能。

## textbook_case_usage

Textbook では、この論点を「AMD の価値を過大評価せず、消しもしない」ケースとして使える。

使えるケース:

- KT: COO 派遣型。AMD が体制構築し、会社は関与終了後も active。
- JC: deep_pivot 後のリバウンド失敗。AMD が研究者接続を作ったが、R&D 投資理解が定着せず関与終結。
- BWE: スタジオ設立・CEO移譲・卒業前カリキュラム不足の case。
- CTB: frozen / 軽関与 / current row に active AMD contribution を戻さない case。
- LST / CX / SX: active support 中の `frl_cap_amd` first pass case。

Textbook での書き方:

- narrative / case / lesson として使う。
- 「この時点では AMD が何を押し上げたか」と「その後 company が自走して何を達成したか」を分ける。
- 読者向けには、current company success をそのまま AMD contribution と誤読させない。

## do_not_use_as

この memo を以下として使ってはいけない。

- `frl_cap_amd` の正式再計算結果。
- 0-9 score 表。
- R_net 値付け。
- PRS 正式採用根拠。
- 現行 7 軸 AMD Score の置換根拠。
- 過去 score 再計算の migration 仕様。
- DB schema / DDL / extractor 実装仕様。
- current active row へ ended PJ の過去 AMD 寄与を戻す根拠。

## next_worker_candidates

1. `frl_cap_amd_timeline_row_source_pack`
   - p04 / p09 / p11 / p06 の AMD 関与期間を source-first で切り、候補 `evaluated_at` と notes を作る。
   - DB write なし。source pack と row proposal まで。

2. `frl_cap_amd_notes_rubric_guard`
   - `frl_cap_notes` に必須で残す fields を整理する。
   - 候補: `row_type`, `relationship_state`, `amd_members`, `amd_roles`, `evidence_sources`, `support_end_at`, `do_not_count_after`.

3. `textbook_case_boundary_pack`
   - KT / JC / BWE / CTB を Textbook case として使う場合の boundary note を作る。
   - AMD 宣伝ではなく、過大評価防止・卒業設計・リバウンド失敗・frozen handling の学習として整理する。

4. `os_score_implementation_design_only`
   - 将来実装する場合の設計だけを整理する。
   - migration / DB write / UI 実装なし。current row と timeline row の select policy、notes schema、guardrails だけ。

## source_notes

- `pwa/spec/4-1-frl-ces-current-spec.md`: `frl_cap_amd` は AMD 提供価値指標で、終了済み / historical PJ は timeline-specific row で別途整理する現行仕様。
- `pwa/HANDOFF_bzm_textbook.md`: FRL 2レイヤー、`frl_cap_amd` first pass、p04/p09/p11 保留理由、p06 frozen補正。
- `pwa/design_log/sessions_2026-05.md` #102: live DB 確認、migration 111/112、p06/p07/p20/p21 verify。
- `/Users/masa/projects/knowledge/{KT,jc,BWE,ctb,LST,cx,sx}.md`: PJ別の関与経緯と current truth。
