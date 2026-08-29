# 次セッションへの引っ越しプロンプト（SX関係先リスト / 排液カラム）

cwd: `/Users/masa/projects/AMD/amd-os`

> 2026-08-29 の排液カラムの作業は**完了・本番反映済み**で、残作業はない。
> このプロンプトは「同じ画面（SXコックピットの関係先リスト）の続きを触る」ときの入口。
> AMD OS 全体の次タスクは `SESSION_MIGRATION_PROMPT.md`（BZM 3.0 モデル本体）が正本。

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`（えいみ共通ルールの正本）
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`（AMD階層の記憶）
3. `HANDOFF.md` の **D 節**（このセッションの現在地）
4. `pwa/spec/3-16-project-weekly-control-current-spec.md`
   — とくに「排液カラム: 成分は定型語彙だけ・メモ欄の新設・編集面の再設計 (migration 336、2026-08-29)」節と、
     その下に並ぶ関係先台帳の各節（列構成・幅の予算・並び順の正本）
5. `pwa/spec/2-7-ui-design-code-current-spec.md`（UIデザインコード。情報密度・4px基準・状態表現）
6. `pwa/BUGS.md` の 2026-08-29「排液の成分バッジが、閉じたプルダウンへのキー入力で黙って増えていた」
7. `pwa/manual/2-3-pj-cockpit.md`（まさが読む側の説明。仕様を変えたらここも直す）

## 状態スナップショット（2026-08-29 時点）

- git: `main` 一本。このセッションの commit は `b1a7acdd`（機能）→ `a93ad5d3`（監査反映）→ `541769b4`（正本）。
  すべて push 済みで、本番 `https://amd-os-pwa.vercel.app` に反映済みを実画面で確認した
- DB: migration 336 適用済み。`project_management_partners.effluent_note` が存在し、
  既存9行の作文はメモへ移動、`effluent_components` は語彙だけになっている
- 画面: `/project/p21/weekly-control` の「関係先」タブ →「排液」列。セルを押すと編集面が開く
- この checkout は 5〜10 セッションで共有している。着手前に `git fetch` して
  `git log --oneline HEAD..origin/main` が空であることを確認する

## 触るときの前提（この画面で確立済みのルール）

- **成分バッジに出せるのは `SX_EFFLUENT_COMPONENT_CHOICES`（pwa/src/lib/sx-partner-progress.ts）の語彙だけ。**
  語彙外を足す導線は作らない（作るとまた「プルダウンに無いバッジ」が生まれる）。増やすならこの配列を編集する
- 保存値の読み書きは `sxSplitEffluentComponents` を通す。表示とデータ移行で同じ判定を使う
- 一覧の cell には成分名だけを置く（まさ 2026-08-28「表の中ではもっとシンプルに成分名だけ。文章で書くのやめて」）。
  量・処理費・実験結果・メモは編集面の中で読む
- `.sx-management-workspace` は button/input/select に `min-height:44px` を強制している（globals.css）。
  バッジのような1行の表示要素は `!min-h-0` で外す
- `InlineCellEditor` は関係先台帳の全セルが共有する。器を変えるときは他セル（ゴール・次にやること・
  次回面談・接点の経緯・評価）への影響を実画面で確認する
- 自動保存の編集面では、閉じた `<select>` を初期フォーカスにしない（BUGS 2026-08-29）

## 検証手順（この画面で実際に使ったもの）

```
cd pwa && npx tsc --noEmit
npx eslint <触ったファイル>            # 既存errorが2件ある（localStorage復元のsetState）
```

実画面の確認は、Google OAuth しか無いので service role でセッションを起こして cookie を入れる
（手順の正本は記憶 `reference-local-pwa-screenshot-auth`）。`localhost:3000` は他セッションが
起動している場合がある。**CSS が効かないときは配信中の `.css` を curl して grep する**
（別セッションの dev server は `globals.css` の変更を拾わないことがある）。

本番の反映は `curl -s https://amd-os-pwa.vercel.app/api/build-info` の `git_sha` で確認する。

## 次に手をつけるなら（優先度順・いずれも未着手）

1. **関係先台帳の他のインライン編集面の見た目**。排液だけ白地・角丸・群見出しに直したので、
   次回面談（6項目）などは古い灰色の入力面のまま残っている。揃えるなら `INLINE_CONTROL_CLASS` 側を触る
   ＝ 全セルに影響するので、まさへ見せてから
2. **編集面が画面内に収まりきらないときの扱い**。いまは上下反転＋内側スクロール＋下端のぼかし。
   監査は「中央ダイアログへ分離」を推していた（今回は内容を縮めて収めたので不採用）
3. 語彙に無い成分が現場で増えてきたら `SX_EFFLUENT_COMPONENT_CHOICES` へ追加する
