# ドキュメント統制仕様

> **この章は何か**: AMD OS の manual / spec / bzm を、OS の再構築に耐える正本として維持するための確定仕様。使い方は `/manual`、確定実装仕様は `/spec`、理論・数式・rubric 導出は `/bzm` に置く。

## 再構築要件

設計書(`/spec`)は、それだけを読めば現在の AMD OS を再構築できる粒度を目標にする。

| 要素 | `/spec` に必ず書くこと |
|---|---|
| 画面 | route、表示条件、主要 component、権限、空状態、更新導線 |
| API | method、path、入力、出力、認証、DB write、失敗時挙動 |
| DB | 正本 table、重要 column、status 遷移、unique 制約、migration / schema dump 手順 |
| automation | 実行場所、schedule、input、output、outbox、applier、停止済み旧経路 |
| 状態遷移 | candidate / confirmed / rejected / archived などの意味と更新者 |
| 外部依存 | Supabase、GAS、Vercel、Codex automation、LaunchAgent、5 生データ connector |
| 保全ルール | 消してはいけない導線、禁止された旧経路、事故ログからの制約 |

未移行領域は `pwa/design/` と旧 manual の `*-spec.md` に残っていてよい。ただし「今から変更する箇所」は、同じ commit で `/spec` へ current truth を移す。

## 3 層分類

| 層 | path | 書く内容 | 書かない内容 |
|---|---|---|---|
| manual | `pwa/manual/*.md` | 使い方、画面の読み方、運用手順、非開発者が判断するための説明 | DB列、実装ファイル、deploy手順、内部 migration、詳細 API contract |
| spec | `pwa/spec/*.md` | 現行実装仕様、DB/API/route/automation/権限/状態遷移 | 理論導出、数式の証明、ユーザー向けチュートリアル |
| bzm | `pwa/bzm/*.md` | Before Zero Model の理論、数式、rubric、教科書的導出 | PWA 実装手順、deploy、Supabase migration |

迷う要素は、まさ指示により当面 **両方に置いてよい**。ただし重複させる場合は、片方を「読者向け説明」、片方を「実装 contract」に寄せる。

## 附則更新ゲート

manual / spec / bzm のどれかを変更したら、同じ層の附則に変更履歴を追記する。

| 層 | 附則 |
|---|---|
| manual | `/manual/9-3-appendix-changelog` |
| spec | `/spec/6-1-appendix-changelog` |
| bzm | `/bzm/9-5-appendix-changelog` |

記録項目:

- 日時
- 対象章
- 種別: 追加 / 変更 / 削除 / 移植 / 訂正
- 変更箇所
- 理由
- 変更者

削除は特に危険なので、削除元・移植先・まさ承認または明確な移行理由を書く。附則は append-only とし、過去行を書き換えない。

## 変更時の必須手順

1. 変更対象が manual / spec / bzm のどれかを分類する。
2. 確定実装仕様なら `/spec` に current truth を置く。
3. 未移行の `pwa/design/*.md` を触る場合は、冒頭に `/spec` 移行状態を書く。
4. 画面導線や章追加を触る場合は `pwa/src/app/(app)/*/*-chapters.ts` を更新する。
5. 変更した層の附則を同じ commit に含める。
6. PWA UI に影響する場合は `BUILD_VERSION` を bump し、`tsc` / `build` / deploy まで行う。

## 章番号と表示番号

manual / spec / bzm は、slug に章番号を含める。ただし画面表示の番号は `*-chapters.ts` の section / part 配列から動的に計算される。

| layer | metadata file | 表示番号関数 |
|---|---|---|
| manual | `pwa/src/app/(app)/manual/manual-chapters.ts` | `applyManualBookNumbering()` |
| spec | `pwa/src/app/(app)/spec/spec-chapters.ts` | `applySpecBookNumbering()` |
| bzm | `pwa/src/app/(app)/bzm/bzm-chapters.ts` | `applyBzmBookNumbering()` |

md 本文の h1 / h2 / h3 に手書き番号を混ぜない。番号参照が必要なら、できるだけタイトルまたは route で参照する。

## 現時点の不足

| 領域 | 不足 | 次にやること |
|---|---|---|
| manual 4〜8 | `*-spec.md` に DB/API/実装仕様が残っている | 報酬、請求、通知、Atlas、Venture Map を `/spec` へ章移行 |
| manual 9 | 開発者向け情報が残っていた | 本 commit で `/spec/5-*` に移植開始。manual 側は入口化 |
| design | `SPEC_pwa.md` / `L2_DATA.md` / `FEATURE_REGISTRY.md` に current truth が残る | 章単位で `/spec` へ移し、design は議論・履歴に寄せる |
| bzm | 理論変更の附則がなかった | `/bzm/9-5-appendix-changelog` を追加 |
