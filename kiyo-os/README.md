# きよOS

きよ専用の個人OS。まさ × きよ の共同開発。

> **最初に読むのは [`AGENTS.common.md`](AGENTS.common.md)。** ルールは全部そこにある。

---

## 動かす

```sh
npm install     # 最初の1回だけ（3分くらい）
npm run dev     # http://localhost:3000 が立ち上がる
```

**データベースの設定は要りません。** 何も設定しなくても、ダミーのデータで画面が全部出ます。

## 確認する（変更したら必ず）

```sh
npm run typecheck   # 型のミスがないか
npm run build       # 本番と同じビルドが通るか
```

## 何がどこにあるか

| 場所 | 中身 |
|---|---|
| `AGENTS.common.md` | **共通ルールの正本。まずここ** |
| `CLAUDE.md` | AI（えいみ）向けの行動ルール |
| `SETUP_KIYO.md` | きよが開発を始める手順 |
| `docs/DESIGN.md` | 画面の正本。作ると決まったものだけ載る |
| `docs/INTAKE.md` | きよの「こんなの欲しい」置き場。実装前の候補 |
| `src/lib/modules.ts` | 画面（モジュール）の一覧。ナビとカードはここから自動生成 |
| `src/app/(os)/` | 各画面 |
| `supabase/migrations/` | DB のスキーマ案（まだ本番未適用） |

## いまの状態

- ✅ 骨組み（レイアウト / ナビ / ダッシュボード / モジュールの追加口）
- ✅ Supabase 未接続でも動く
- 🔲 きよ用の中身 — **これから決める**（`docs/INTAKE.md` を埋めるところから）
- 🔲 Supabase 本番プロジェクト（未作成。月額 $10 かかるので中身が固まってから）
- 🔲 Vercel デプロイ（未設定）
