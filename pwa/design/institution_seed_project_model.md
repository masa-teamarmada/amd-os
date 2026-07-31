# 研究機関・シーズ・AMD PJ データモデル

最終更新: 2026-08-01

## 1. 確定した情報設計

AMD OSは、契約の有無に依存しない2つのカタログを持つ。

| カタログ | 正本 | 役割 |
|---|---|---|
| 研究機関リスト | `institutions` | 大学・国研等の機関、制度、地域、ECRを蓄積する |
| シーズリスト | `seeds` | 個別の技術×応用先、研究者、成熟度、SPSを蓄積する |

AMDが契約してもカタログ行を別リストへ移さず、同じ行へPJ運用レイヤーを重ねる。

```text
institutions ──< institution_projects >── projects
     ^                                      共通の契約・月次・タスク
     |
     +──< seeds ──< seed_projects >─────── projects
```

`projects` は共通運用の薄い親として残し、性格の違うPJ固有情報は物理的に別テーブルへ置く。

| PJ種別 | 子テーブル | 固有情報の例 |
|---|---|---|
| 研究機関PJ | `institution_projects` | 対象範囲、対象部局、エコシステム構築目標、シーズ発掘を含むか |
| シーズ事業化PJ | `seed_projects` | 事業化段階、事業化経路、ベンチャー名、対象市場 |

同じ `project_id` を両方へ登録することはDB triggerで禁止する。種別未確認のPJを名称から推測して自動分類しない。

## 2. 評価指標の境界

- ECRは研究機関環境の評価で、`institution_assessments` を正本にする。
- SPSは個別シーズの評価で、`seed_sps_assessments` を正本にする。
- 同じ画面で並べる場合も別系列の観測値として表示し、合成単一スコア、相関、因果指標を作らない。
- PJになってもECR/SPSの意味、計算式、時系列を変えない。

## 3. ライフサイクル

### カタログ

1. 機関またはシーズを発見する。
2. 契約前でもカタログへ追加し、取れる情報と評価を蓄積する。
3. 名称や同一性が未確認なら候補状態のまま保持する。

### 契約

1. `projects` に共通PJ行を作る。
2. 契約対象が機関全体なら `institution_projects`、個別シーズなら `seed_projects` に1行作る。
3. 契約中は元のカタログ一覧で最上位に表示し、PJ帯を重ねる。
4. 終了後もカタログ行とPJ履歴を残す。別リストへの移動や複製はしない。

`seeds.status='spun_off'` はスピンアウト・法人化の状態であり、AMDとの契約PJ化を意味しない。旧 `spun_off_project_id` は互換列として残すが、新しい関係判定には使わない。

## 4. migration 207の移行範囲

### 確認済みで移行した関係

| PJ | 種別 | 対象 |
|---|---|---|
| p25 KUTE | 研究機関PJ | 工学院大学 `inst_kute` |
| p28 NIMS | 研究機関PJ | 物質・材料研究機構 `inst_nims` |
| p30 EHM | 研究機関PJ | 愛媛大学 `inst_ehime`。対象は愛媛大学全体、目標は大学全体のエコシステム構築 |
| p21 SX | シーズ事業化PJ | 旧参照で厳密に一意だった愛媛大学の個別シーズ |

### カタログ移行

- 大学・国研シーズ141件を、名称で監査した46研究機関へ `institution_id` で紐付けた。
- 既存4機関のIDを維持し、追加機関は名称から安定IDを生成した。
- `広島大学 (推定)` は `identity_status='candidate'` とし、正式名称未確認のまま保持した。

### 自動分類しなかったもの

- p20 / p26は対象概念を確定できなかったため、どちらの子テーブルにも入れていない。
- `contract_status` が契約中なのに子テーブル関係がない機関は、画面で「PJ紐付け要確認」と表示する。

## 5. 画面情報設計

### `/institutions`

- 初期表示はECR順位表ではなく研究機関カタログ。
- 稼働中の研究機関PJ → PJ履歴 → PJなしの順で表示する。
- PJなしも全件表示し、契約前の情報蓄積を主目的として扱う。
- ECR比較は同じ画面の別表示として残す。

### `/seeds`

- 158件を全件表示し、`spun_off` / `declined` を除外しない。
- 稼働中のシーズPJ → PJ履歴 → PJなし・カタログ蓄積の順で表示する。
- 稼働中PJは色帯で最も目立たせる。
- シーズ状態とAMD PJ状態を別ラベルで表示する。

### コックピット

- 研究機関コックピットは `institution_projects` から対象PJを解決する。
- 研究機関PJから所属シーズを読む場合も、PJ IDの固定表をコードに持たず `institution_projects.institution_id` を使う。
- シーズ詳細は `seed_projects` の契約固有情報を追加表示する。

## 6. 検証

- migration内で機関46件、大学・国研シーズ141件、確定4PJ、二重分類0件をassertする。
- `npm run test:institution-seed-project-domains` でテーブル分離、確認済み移行、固定対応の不在、全件表示、ECR/SPS非更新を検査する。
- `npm run test:kute-seeds-scope` と `npm run test:institution-soil-seeds` で表示スコープと評価系列を検査する。
- PWAは型検査・本番build・desktop/mobile実画面、macOSはXcode buildで確認する。

## 7. ロールバック

本変更は既存 `projects`、`seeds`、ECR、SPSを削除しない追加型移行。問題が出た場合は次の順で戻す。

1. 画面を直前版へ戻し、旧列を読むコードへ戻す。新しい2子テーブルは残してよい。
2. `institution_projects` / `seed_projects` をCSVまたはSQLで退避する。
3. 新しい書込みを停止し、参照元がないことを確認してから子テーブルと専用triggerを撤去する。
4. `seeds.institution_id` の141紐付けは機関カタログの資産なので原則維持する。戻す必要がある場合だけ、migration 207で追加された機関IDと参照件数を監査して個別に戻す。
5. ECR/SPSはmigration 207で更新していないため、再計算や復元は行わない。

本番DBの `DROP` や一括NULL化は自動ロールバックに含めず、退避内容と参照元を確認した上で別migrationとして実行する。
