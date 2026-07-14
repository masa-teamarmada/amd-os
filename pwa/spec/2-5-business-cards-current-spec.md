# 名刺管理 / OCR / PJ Knowledge 連携仕様

> **この章は何か**: スマホ撮影した名刺を保護された台帳へ保存し、OCR結果を人が確認してからPJへ紐づけ、D-3 `project_knowledge(category='people')` へ反映する現行仕様。

## Current Truth

| 項目 | 現行仕様 |
|---|---|
| 画面 | `/business-cards` |
| iOS native shell | `/native/business-cards`。iOS `BusinessCardsView` が認証cookieつきWKWebViewで開き、タブはPJ進捗と設定の間 |
| 対象ユーザー | Googleログイン済みかつ `members` に存在するAMDメンバー |
| 名刺正本 | `business_cards` |
| PJ紐づけ | `business_card_project_links` |
| 画像 | 非公開 Storage bucket `business-cards` |
| OCR | Gemini。指示文は `llm_prompts.prompt_key='business_card.ocr'` |
| PJ knowledge | 確認後に `project_knowledge(category='people', source='business_card', status='active')` を作成/更新 |
| 実行形 | PWA Route Handler。定期cronは持たない |

## ユーザーフロー

1. `/business-cards` の「スマホで名刺を撮る」を押す。
2. ブラウザの背面カメラで撮影する。大きい画像はクライアントで長辺1800px以内・JPEGへ縮小する。
3. `POST /api/business-cards` が画像を非公開Storageへ保存し、`business_cards.status='processing'` を作る。
4. DB管理の `business_card.ocr` prompt と画像をGeminiへ渡し、氏名・所属・役職・連絡先を構造化する。
5. 成功時は `needs_review`、失敗時は `ocr_failed` にする。失敗しても画像と手入力欄は残す。
6. ユーザーが読み取り結果を確認し、接点日・接点メモ・1つ以上のPJを選ぶ。
7. `PATCH /api/business-cards/[cardId]` が名刺を `confirmed` にし、選んだ各PJへD-3人物知識を同期する。

iOSではトップレベルの「名刺」タブから同じフローを開く。旧「月次ルーティン」タブは廃止済みで、名刺タブを `PJ進捗` と `設定` の間に置く。

## DB Contract

### `business_cards`

| 列群 | 契約 |
|---|---|
| 人物 | `full_name`, `full_name_kana`, `company_name`, `department`, `job_title` |
| 連絡先 | `email`, `phone`, `mobile`, `postal_code`, `address`, `website` |
| 接点 | `relationship_note`, `met_on` |
| OCR | `raw_ocr_text`, `field_confidence`, `ocr_confidence`, `ocr_model`, `ocr_prompt_key`, `ocr_error` |
| 画像 | `storage_bucket`, `storage_path`, `mime_type`, `file_size_bytes`, `image_sha256` |
| 監査 | `created_by_user_id`, `created_by_email`, `confirmed_by_email`, `confirmed_at`, `updated_by_email` |

status遷移:

```text
processing -> needs_review -> confirmed
          \-> ocr_failed  -> confirmed (手入力で復旧)
confirmed -> confirmed (内容/PJ更新)
任意状態 -> archived (将来の保管終了導線用。現UIには未実装)
```

### `business_card_project_links`

`(business_card_id, project_id)` を主キーにする多対多表。`project_knowledge_id` で、この名刺確認から作られたD-3人物行を追跡する。

PJ紐づけを外した場合:

- 同じ `project_knowledge_id` を参照する別名刺が無ければ、その人物行を `status='inactive'` にする。
- 連絡先や画像は削除しない。

## OCR Contract

- prompt本文はコードに置かない。`llm_prompts` のactive行が空/無効ならOCRを実行しない。
- modelはprompt行の `model`、出力上限は `max_tokens` を使う。
- 出力はJSON限定。読めない値は空/nullとし、推測で補完しない。
- `field_confidence < 0.7` はUIで「要確認」を表示する。
- OCR失敗は名刺登録全体の失敗にしない。`ocr_failed` で手入力へフォールバックする。

## D-3 PJ Knowledge Contract

確定名刺1枚につき、選択した各PJへ以下を同期する。

| column | value |
|---|---|
| `project_id` | 選択PJ |
| `category` | `people` |
| `entity_name` | 確認済み氏名 |
| `fact_text` | 所属 / 部署 / 役職 / 接点日 / 接点メモ + 「連絡先は名刺管理で確認」 |
| `confidence` | `high` |
| `source` | `business_card` |
| `status` | `active` |

重要な境界:

- メール、電話、住所、画像、OCR全文は `project_knowledge.fact_text` へコピーしない。
- `project_knowledge` は人物関係の判断材料、`business_cards` は連絡先の正本。
- 同じ `project_id + people + entity_name + source='business_card'` があれば更新し、名刺再確認で無制限に重複行を増やさない。

## API Contract

| endpoint | method | input | output / write |
|---|---|---|---|
| `/api/business-cards` | GET | なし（任意filter対応） | 名刺一覧、active PJ一覧、件数 |
| `/api/business-cards` | POST | `multipart/form-data file` | Storage保存、OCR、`processing -> needs_review/ocr_failed` |
| `/api/business-cards/[cardId]` | PATCH | 確認済み人物項目 + `projectIds[]` | 名刺確定、PJ link、D-3人物知識同期 |
| `/api/business-cards/[cardId]/image` | GET | cardId | 認証後に非公開画像をinline返却 |

## Auth / Privacy

- app layoutのGoogle認証だけに依存せず、全APIで `requireAuth()` を再確認する。
- さらに `members.email` に存在するAMDメンバーだけを許可する。
- テーブルとStorageはクライアントから直接読ませず、`service_role` Route Handler経由に限定する。
- bucketは `public=false`。画像URLは認証つき `/api/business-cards/[cardId]/image` を使う。
- OCR本文・連絡先・画像をログ、通知、PJ knowledge、マニュアルへ出さない。

## Failure Mode

| failure | behavior |
|---|---|
| 非画像 / 4MB超 | 400。保存しない |
| Storage保存失敗 | 500。DB行を作らない |
| DB insert失敗 | 保存済みStorage objectを削除して500 |
| prompt無効 / Gemini失敗 / JSON不正 | 名刺は`ocr_failed`で残し、手入力可能 |
| 氏名なし | 確定PATCHを400で止める |
| PJ未選択 | 確定PATCHを400で止める |
| activeでないPJ | knowledge同期を止め、名刺は未確定のまま再試行可能 |
| knowledge同期途中失敗 | `confirmed`へ進めない。再実行はlink/upsertで復旧可能 |

## Validation

1. `npm exec tsc -- --noEmit`
2. `npm run test:critical-ui`
3. `npm run build`
4. スマホ幅で撮影inputが背面カメラを開くこと。
5. OCR後に氏名・所属を修正できること。
6. PJ未選択では確定できず、選択後に`business_card_project_links`と`project_knowledge`が作られること。
7. `project_knowledge.fact_text`へメール・電話・住所が入らないこと。
8. 未ログインで画像APIが401になること。

## 実装ファイル

- `pwa/src/app/(app)/business-cards/page.tsx`
- `pwa/src/components/business-cards/BusinessCardsClient.tsx`
- `pwa/src/app/api/business-cards/**`
- `pwa/src/lib/business-card-ocr.ts`
- `pwa/src/lib/business-card-server.ts`
- `pwa/scripts/migrations/172_business_cards.sql`
