# Specification Governance — AMD OS PWA

AMD OS PWA の機能がセッション間で勝手に変わることを防ぐための設計運用。

この文書は「どの粒度まで書くか」と「書いた仕様をどう壊れにくくするか」の正本。
実装詳細の正本は各 `pwa/design/*.md`、回帰防止の登録簿は `FEATURE_REGISTRY.md` に置く。

---

## 採用する型

AMD OS PWA は、一般的な spec-driven development / ADR / BDD / traceability の考え方を、軽量な repo markdown + 自動テストに落とす。

| 層 | AMD OSでの置き場 | 書くこと | 目的 |
|---|---|---|---|
| Capability Catalog | `FEATURE_REGISTRY.md` から開始し、全画面へ拡張 | 画面ごとの業務導線、消してはいけない操作、主要DB/API、guard test anchor | 機能の存在を失わない |
| Functional Spec | `SPEC_pwa.md` + 画面別md (`cockpit.md`, `mypage.md`, etc.) | ルート、ユーザー操作、状態遷移、エラー時表示、権限 | 実装前後の期待値を固定する |
| Data/API Contract | `db_schema.md`, `L2_DATA.md`, API route仕様 | テーブル、主キー、status遷移、cron、外部連携境界 | データ正本と責務をずらさない |
| ADR / Decision Log | `pwa/design/adr/NNN-title.md` (新設時) | 重要な設計判断、選択肢、決定、結果 | なぜそうしたかを後から読めるようにする |
| Executable Spec | `npm run test:critical-ui` / routeごとのtest | 重要UI anchor、API action、cron登録、schema参照 | mdだけでなく機械的に壊れを検知する |
| Traceability | `FEATURE_REGISTRY.md` の各画面ブロック | 機能 -> route/component/API/table/test/docs | 変更影響を追えるようにする |

---

## 書く粒度

すべての実装詳細を文章化するのではなく、消えると困る「業務上の契約」を必ず書く。

- 画面: どのユーザーが、どの操作で、何を保存/発行/確認できるか
- API: action名、入力、出力、失敗時の扱い、更新するテーブル
- DB: 正本テーブル、candidate/confirmedなどの状態遷移、手動編集可否
- cron/automation: schedule、入力、出力、LLM利用有無、手動実行方法
- UI guard: 消えると業務が止まるラベル・ボタン・リンク・モーダル

見た目の細部や一時的な作業ログは `design_log/` に置いてよいが、恒久仕様に昇格したものは `pwa/design/` へ移す。

---

## 変更ルール

1. 機能を追加したら、同じcommitで該当design mdか `FEATURE_REGISTRY.md` に機能契約を追加する。
2. 機能を置き換えるときは、旧導線を消す前に新導線の契約とguard test anchorを登録する。
3. 重要な設計判断はADRに残す。古いADRは消さず、新ADRで supersede する。
4. `test:critical-ui` が落ちる変更は、仕様変更としてmdを更新したうえでtest anchorも更新する。
5. `design_log/` は履歴であり正本ではない。最終仕様として参照させたい内容は `pwa/design/` に残す。

---

## 次にやること

`FEATURE_REGISTRY.md` は `/admin/payouts` から始めた暫定版なので、次に以下の画面へ拡張する。

- `/project/[projectId]/cockpit`
- `/mypage`
- `/notifications`
- `/admin/projects`
- `/admin/settings`
- `/payment-confirm`

各画面で「機能 -> route/component/API/table/test/docs」の対応を埋め、重要UIが消えたら `npm run test:critical-ui` で検知できる状態にする。
