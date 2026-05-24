# OS 全体 UI ヒント (ツールチップ) 設計議論 (#22)

> **状態**: まさ #22 (2026-05-24) 「設計から相談しよう」段階。**次セッションで設計確定 → 実装着手**。
>
> 関連: [`os_manual.md`](os_manual.md) (= マニュアル本体は別途)

---

## 背景・問題

まさが指摘:

> 現状だと OS の使い方は、おれの頭の中に記憶されてるだけにとどまってる。
> これだとおれが忘れたらその機能使えなくなるし、えいみも開発しながら「そんな機能あったっけ？」ってなったりするし、他ユーザーもずっと使えないままになる。
> なので、マウスオーバーしたらポップアップヒントが出るようにしたい。

つまり「**機能の存在と使い方** が UI 上で発見できる」状態にしたい。OS マニュアル ([`os_manual.md`](os_manual.md)) は別途用意するとして、その手前の「**個別 UI 要素のヒント**」を全体に張り巡らせる。

## 設計検討案

### 案 A: ネイティブ `title` 属性のみ (最小実装)

`<button title="...">` で済ませる。

- **メリット**: 実装ゼロコスト、HTML 標準
- **デメリット**:
  - 出現遅い (= ブラウザ 1 秒待ち)
  - スタイル付けられない (= リッチコンテンツ不可)
  - キーボード操作で見えない
  - モバイル touch device で出ない

### 案 B: Radix Tooltip (= shadcn が依存している既存ライブラリ) でラップ (**推し**)

- shadcn の Tooltip コンポーネントを統一して使う (= 既に依存に入ってる)
- リッチコンテンツ可 (= markdown 風説明 / リンク可)
- アクセシブル (= キーボード hover + screen reader)
- スタイル統一可能 (= TooltipProvider で全体に設計を適用)

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <button>...</button>
  </TooltipTrigger>
  <TooltipContent>
    <div>説明文 + リンク</div>
  </TooltipContent>
</Tooltip>
```

### 案 C: カスタム Hint コンポーネント (= 案 B + プロジェクト固有のメタデータ管理)

```tsx
<Hint id="cockpit.strategy-signals.tsukuyomi-feedback" />
```

- ID をキーに、説明文を中央集権的に管理 (= `pwa/src/lib/ui-hints.ts` or DB)
- 改修時に説明だけ変えれば全箇所に反映 (= 編集容易性が高い)
- LLM (= つくよみ) が自動で hint を生成・更新するパスも作れる (= 「この button は何をする?」を Sonnet が答えて hint に保存)

### 案 D: 案 B + 案 C のハイブリッド (**強推し**)

- 通常は案 B (= Radix Tooltip を直接書く)
- 重要な機能 (= MS 進捗フロー / まさえいMTG 運用 / 月次ルーティン step / 経営シグナル採否 等) は案 C で `Hint` コンポーネントを使う
- `Hint` の説明文は `pwa/src/lib/ui-hints/` の TypeScript 定数 or DB (`ui_hints` テーブル) で管理
- 説明文には「機能名」「何ができる」「関連リンク (= マニュアル本体 / 設計 md / 過去議論)」を含める

## データ管理案

### A. TypeScript 定数 (= デプロイ毎に反映)

```ts
// pwa/src/lib/ui-hints/index.ts
export const UI_HINTS = {
  "cockpit.strategy-signals.tsukuyomi-feedback": {
    title: "つくよみに修正依頼",
    body: "この経営事業シグナルの抽出に誤りや方向違いがあれば、つくよみ (LLM) に修正依頼を送れます。`l2_feedbacks` に保存され、次回の抽出 prompt に含まれて学習されます。",
    docHref: "/manual/strategy-signals#feedback",
  },
  ...
};
```

### B. DB `ui_hints` テーブル

```sql
CREATE TABLE ui_hints (
  hint_id      TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  body_md      TEXT NOT NULL,
  doc_href     TEXT,
  updated_by   TEXT,
  updated_at   TIMESTAMPTZ DEFAULT now()
);
```

- まさ/えいみが /admin/ui-hints で hint を編集可能
- LLM 経由で自動生成・更新も
- ただし「説明文の更新 = deploy なし」になるので便利

### 推し: A から始めて B に拡張

- 初期は A (= TypeScript 定数) で開始 = 速い
- 数十個に増えたら B (= DB) に移行

## 実装スコープ (= まずどこに付ける?)

優先度:

1. **cockpit MS routine step ボタン** (= 6 step 全部): 「請求額確定とは何か」「報告会日程調整とは何か」等 (= まさ自身も使用法を忘れがち)
2. **経営事業シグナル 4 分類 chip + 「つくよみに修正依頼」ボタン**
3. **MS Gantt bar / 月次ルーティン**: hover で「このバーは何 / メンバー share の意味」
4. **AMD スコアグラフ要素**: pill / M/X/F / 破線 (= 「破線をクリックすると修正できる」を hover で明示)
5. **HUD 系**: signal strip / cockpit signal cards

ざっと **30-50 個** の hint を最初に投入。

## アクセシビリティ

- Hint は **常に keyboard focus でも開く** (= `aria-describedby`)
- 視覚障害者向け screen reader 対応 (= Radix Tooltip 標準)
- モバイル touch device は long-press で出す (= shadcn デフォルト挙動 OK)

## 残設計事項 (= 次セッション)

- 案 D の最終確認 (= まさ OK or 別案)
- 初期 hint リスト (= 30-50 個) の選定
- マニュアル本体 (`os_manual.md`) との関係 (= hint クリックで該当マニュアル章にジャンプする UX)
- DB `ui_hints` テーブル化のタイミング判断

## 関連設計 md

- [`os_manual.md`](os_manual.md) — OS 全体マニュアル本体の設計
- [`FEATURE_REGISTRY.md`](FEATURE_REGISTRY.md) — 既存の「消してはいけない業務導線」リスト (= ここに登録された機能には全部 hint を付ける運用が自然)
