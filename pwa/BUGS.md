# BUGS.md — AMD OS PWA

バグ発見 → ここに記録、解決 → 解決策を追記してクローズ。
根本原因（なぜそうなったか）と解決策を必ずセットで書く。

---

## フォーマット

```
### [AMD OS PWA] バグタイトル
- **発見日**: YYYY-MM-DD
- **状態**: 🔴 未解決 / 🟡 調査中 / ✅ 解決済み
- **症状**: ユーザーが体験した現象
- **原因**: 技術的な根本原因（症状ではなく「なぜ」を書く）
- **解決策**: 何をどう直したか
- **教訓**: 次のえいみが同じ間違いを犯さないために
```

---

### [AMD OS PWA] annotation 付きスプライトシートの自動クリーンは沼る

- **発見日**: 2026-05-04
- **状態**: ✅ 解決済み (回避策で対応)
- **症状**: つくよみマスコット用に `tsukuyomi-sheet.png` (ラベル/区切り線/フレーム番号付の参考用シート) を pixel filter / 連結成分 / flood fill 等いろいろ試して自動クリーンしようとしたが、(a) キャラの髪まで透過処理してしまう / (b) 罫線がキャラと連結成分上つながっていて消せない / (c) 元シートに描かれた motion line を artifact と区別できない、で何度やってもユーザーOKラインに届かなかった
- **原因**: 元シートは「アニメーション参考用」であり、ゲーム実装用に切り出した素材ではない。annotation (ラベル/数字/罫線) と character art が同じレイヤに描かれていて、自動的な分離は本質的に困難
- **解決策**: ユーザーが Codex に依頼して **既にクリーンな素材** (`/Users/masa/projects/masa/output/tsukuyomi_animations_amd/`) を作ってもらった。各128×128透過済、足元アンカー揃い、4 アニメ × 18 frames。この素材を統合シートに組むだけで一発OK
- **教訓**: annotation 付き参考用シートを自動クリーンしようとして時間溶かさない。「クリーンな素材を作ってもらう」を最初に提案する。連結成分・flood fill などの工夫は最大2-3回試して駄目なら方針転換

---

### [AMD OS PWA] ログイン後に旧サイト（amd-os-v2-web）に飛ばされる

- **発見日**: 2026-04-16
- **状態**: ✅ 解決済み
- **症状**: `https://amd-os-pwa.vercel.app` でGoogleログインすると、OAuth後に `https://amd-os-v2-web.vercel.app/?code=...` にリダイレクトされてしまい、旧サイトが表示される
- **原因**: SupabaseのAuth設定 `site_url` が旧Vercelプロジェクト `amd-os-v2-web.vercel.app` のままだったため。ログインページの `redirectTo: window.location.origin + '/auth/callback'` は正しいURLを指定していたが、Supabaseの `uri_allow_list` に `amd-os-pwa.vercel.app` が入っておらず、`site_url` にフォールバックされた
- **解決策**: Supabase Management APIで以下を更新
  - `site_url` → `https://amd-os-pwa.vercel.app`
  - `uri_allow_list` に `https://amd-os-pwa.vercel.app/**` と `http://localhost:3000/**` を追加
  - 旧プロジェクト `amd-os-v2-web` をVercelから削除
- **教訓**: 新しいVercelプロジェクトを作成したら必ずSupabaseの `site_url` と `uri_allow_list` を同時に更新すること

---

### [AMD OS PWA] Vercel デプロイ後に全ルートが 404 になる

- **発見日**: 2026-04-28
- **状態**: ✅ 解決済み
- **症状**: `vercel --prod` 実行直後から `/`, `/auth/login`, `/admin/payouts` などすべてのルートが 404 になった。ビルド出力が `○ /` と `○ /_not-found` の 2 ルートのみ（正常時は 40+ ルート）
- **原因**: **デプロイコマンドの正本が CLAUDE.md に記載されていなかった**。そのためえいみが毎回「どのディレクトリから実行するか」を判断し直し、`cd C:\Users\masa\amd-os-pwa && vercel --prod` という bash 的パターンを試みた。Claude Code の PowerShell ツールはシェルの CWD が `G:\共有ドライブ\...` にリセットされるため、CLI は設定ファイルのみ 18 件の G: ドライブディレクトリをスキャンし、本来の C: ドライブのソース（100+ ファイル）がアップロードされなかった
- **解決策（緊急）**: `vercel promote <正常だったデプロイID> --scope armada0130 --yes` でロールバック
- **解決策（恒久）**: CLAUDE.md にデプロイコマンドを `--cwd` 付きで正本として明記（このファイルの上部参照）
- **教訓**: 「どのディレクトリから実行するか」が自明でない CLI コマンドは **CLAUDE.md に正本コマンドを書く**。書かれていないと次のえいみが必ず同じ間違いを犯す

---

### [AMD OS PWA] admin.billing の未来月「立替確認」が完了表示になる

- **発見日**: 2026-05-02
- **状態**: ✅ 解決済み
- **症状**: admin.billing で `2026年6月` など未来の稼働月について、まだ立替確認が発生しないはずなのに `立替確認` が完了表示になっていた。さらに `立替確認` は自動判定扱いのため手動変更もできず、ユーザーには誤った完了状態に見えた。
- **原因**: Swift版の `fetchReimbursementCompletionMap` と同じ「`submitted` / `pmapproved` の未処理立替がなければ完了」という判定をPWAへ移植したが、締切日前の未来月を区別していなかった。未処理立替が存在しない未来月も `pendingなし = 完了` と解釈していた。
- **解決策**: PWAの `reimbursementCompletionMap()` を締切日ベースに変更。対象稼働月の翌月4日を締切とし、土日なら前営業日に補正。締切日前は未完、締切日以降に `submitted` / `pmapproved` がなければ完了にする。例: `202606` は `2026-07-04` が土曜なので `2026-07-03` に完了判定。
- **教訓**: 自動判定ステップは「未処理がない」と「まだ発生時期ではない」を分ける。特に未来月は `pendingなし` を即 `done` にしない。

---

### [AMD OS PWA] Vercel が GitHub push を検知せず、自動デプロイされない

- **発見日**: 2026-05-05
- **状態**: ✅ 解決済み
- **症状**: `git push origin main` しても Vercel が自動でビルドを開始しない。ダッシュボードで Source が `vercel deploy` (CLI) と表示され、最新デプロイが「1 日前」のまま。手動 `vercel --prod` でしか反映できない。
- **原因**: Vercel プロジェクトが GitHub repo と未連携状態だった。CLI で `vercel link` した時点では Git Integration は自動設定されない。
- **解決策**: `cd /Users/masa/projects/AMD/amd-os/pwa && vercel git connect https://github.com/masa-teamarmada/amd-os.git --yes` で GitHub と連携。さらに **Vercel ダッシュボード → Settings → Build and Deployment → Root Directory に `pwa` を設定**する必要があった (リポジトリのルートが `amd-os/`、Next.js プロジェクトが `amd-os/pwa/` のため)。
- **教訓**: モノレポ構造 (リポジトリ直下と Next.js プロジェクト位置がずれる) の場合、`vercel git connect` だけでは不十分。Root Directory の設定はダッシュボード GUI でしかできない。これを忘れると `Couldn't find any 'pages' or 'app' directory` エラーで Vercel ビルドが失敗する。

---

### [AMD OS PWA] Three.js Canvas の高さが 0 で何も描画されない

- **発見日**: 2026-05-05
- **状態**: ✅ 解決済み
- **症状**: `/venture-map/oscillator` で Canvas が表示されず、ボールも見えない。コンソールエラーなし。
- **原因**: Tailwind 4 の `h-[calc(100vh-160px)]` が flex 子要素の高さ計算に正しく伝播せず、Canvas の親 div が高さ 0 になっていた。
- **解決策**: 親 div に `style={{ height: "calc(100vh - 160px)", minHeight: 600 }}` を inline で指定。さらに flex item に `minWidth: 0, minHeight: 0` を追加して flex shrink 制約を外す。Canvas にも `style={{ width: "100%", height: "100%" }}` を明示。
- **教訓**: Tailwind 4 の任意値 `h-[calc(...)]` は flex レイアウト下で挙動が読みにくい。Three.js の Canvas のように親サイズに依存するコンポーネントでは inline style で確実に指定する方が安全。flex container の中で `minHeight: 0`/`minWidth: 0` を忘れると子が縮まない/拡大しない。

---

### [AMD OS PWA] @react-three/drei の Text が silent fail する可能性

- **発見日**: 2026-05-05
- **状態**: ✅ 回避済み (Html overlay に切替)
- **症状**: drei の `<Text>` (Troika SDF Text) を使ったボールラベルが描画されず、ボール本体すら見えない状態になっていた可能性。コンソールエラーなし。
- **原因**: 不明 (フォント取得失敗、Next.js 16 + React 19 との互換性問題、Turbopack ビルドとの相性などの可能性)。
- **解決策**: `<Text>` をやめて drei の `<Html>` で HTML オーバーレイラベルに置換。
- **教訓**: drei の Text はフォントロードや WebGL シェーダー周りで silent fail する可能性がある。シンプルな 2D ラベルなら Html overlay の方が安全で、CSS で柔軟にスタイル可能。

---

### [AMD OS PWA] Vercel 環境変数を `.env.local` に書いても本番に反映されない

- **発見日**: 2026-04-17
- **状態**: ✅ 解決済み
- **症状**: ローカルでは動くが本番で `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY` / `FREEE_*` が undefined で API ルートが 500 になった
- **原因**: Vercel は `.env.local` を読まない。`vercel env add` で明示登録しないと production env に入らない
- **解決策**: `.env.local` をパースして `echo $value | vercel env add $key production` をループで一括追加
- **教訓**: 新しい env key を追加したら **同じ commit で Vercel にも追加する**。`vercel env ls --scope armada0130` で抜けが無いか定期的に確認

---

### [AMD OS PWA] shadcn Dialog の `max-w-[1400px]` が効かない

- **発見日**: 2026-04-17
- **状態**: ✅ 解決済み
- **症状**: 月次モーダルの幅を広げたいのに `max-w-[1400px]` を指定しても変わらない
- **原因**: shadcn Dialog の base に `sm:max-w-sm` が仕込まれていて、tailwind-merge はレスポンシブ variant を別グループとして扱うので overrides されない
- **解決策**: `!important` 付きで両方指定 → `!max-w-[1400px] sm:!max-w-[1400px] w-[95vw]`
- **教訓**: shadcn のレスポンシブ class を上書きする時は **同じブレークポイントの variant を `!` 付きで明示**。base の指定だけ書くと `sm:` 以上のサイズでしか効かないので注意

---

### [AMD OS PWA] shadcn Dialog で `type="number"` 入力の "0" が消せない

- **発見日**: 2026-04-17
- **状態**: ✅ 解決済み
- **症状**: 進捗 % の数値入力で初期値 "0" を消そうとしてもブラウザが消させない
- **原因**: HTML `input[type=number]` のブラウザ仕様 (空文字を許可しない実装が混在)
- **解決策**: `type="text" inputMode="numeric"` + `onFocus={(e)=>e.target.select()}` で代替。バリデーションは onChange 側で正規表現で弾く
- **教訓**: 数値入力は UX 重視で `type="text" inputMode="numeric"` を第一選択にする

---

### [AMD OS PWA] Google OAuth Client Secret のフォントで `I` と `l` が区別不能

- **発見日**: 2026-04-21
- **状態**: ✅ 解決済み (回避策あり)
- **症状**: Google Console は 2026-04 時点でシークレットの「表示・ダウンロード」を廃止。新規作成直後だけ一度表示されるが、画面の `I` (大文字 i) と `l` (小文字 L) がフォント上区別できず Supabase に貼り間違える
- **原因**: Google Console UI のフォント仕様 + シークレット表示制限
- **解決策**: Chrome の `read_page` (アクセシビリティツリー取得) を使う。コピーボタンの `aria-label` に `クリップボードにコピー: GOCSPX-xxxxx` というフルテキストが入っていて機械可読
  1. Google Console の OAuth クライアントページを開く
  2. 既存シークレット 2 つあれば 1 つを無効化→削除してスロットを空ける (上限 2 つ)
  3. 「+ Add secret」→ シークレット新規作成
  4. `read_page(filter="interactive")` で `button "クリップボードにコピー: GOCSPX-..."` の aria-label からフルテキストを取得
  5. Supabase Auth プロバイダーの Client Secret に貼り付け
- **教訓**: 視覚的に曖昧な文字列はアクセシビリティツリーから取る。あと **Supabase Google プロバイダ設定の Client IDs は `web,iOS` の順** (先頭が OAuth code flow で使われる)

---

### [AMD OS PWA] Supabase DDL を SQL Editor から手動投入し続けて事故

- **発見日**: 2026-04 中旬
- **状態**: ✅ 解決済み (Management API ベースのフローを確立)
- **症状**: マイグレーション履歴がローカルにもリポにも残らず、別マシンで再現できない / 適用済か不明
- **原因**: `supabase-js` REST には `rpc("exec_sql")` が存在しない、`npx supabase db push` は PAT が要る、SQL Editor 手動は履歴が残らない
- **解決策**: `scripts/apply_ddl.py` で Supabase Management API (`/v1/projects/{ref}/database/query`) を直叩く。`SUPABASE_ACCESS_TOKEN` (sbp_…) を使い、**User-Agent ヘッダー必須** (Cloudflare 1010 回避)。migration は必ず `scripts/migrations/NNN_name.sql` に残す
- **教訓**: DDL は人間の手作業に頼らない。Management API + ファイル化したマイグレーション + リポ commit の 3 点セットを徹底

---

### [AMD OS PWA] vercel deploy で `--cwd .../pwa` が "pwa/pwa does not exist" で失敗 + 誤プロジェクトが作られる

- **発見日**: 2026-05-06
- **状態**: ✅ 解決済み
- **症状**:
  1. `npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os/pwa` を実行すると `Error: The provided path "~/projects/AMD/amd-os/pwa/pwa" does not exist` で失敗
  2. リトライで `--cwd` をリポ root にすると、リポ root に `.vercel/project.json` が無かったため `--yes` フラグで勝手に **新プロジェクト `amd-os` (`amd-os.vercel.app`)** が作られて、本番 `amd-os-pwa.vercel.app` ではなくそちらに 1 秒で空ビルドがデプロイされた
- **原因**: 2026-05-05 の Vercel Git Integration 設定で project `amd-os-pwa` の Settings → Build → Root Directory に `pwa` を入れた。CLI の `--cwd` は project 設定の Root Directory と結合されるので、`--cwd .../pwa` を渡すと `pwa/pwa` を探しに行って失敗。CLAUDE.md / SPEC の正本コマンドは Git Integration 入る前のままで時代遅れになっていた
- **解決策**:
  1. リポ root の `.vercel/project.json` を amd-os-pwa を指すように設定: `cp -r /Users/masa/projects/AMD/amd-os/pwa/.vercel /Users/masa/projects/AMD/amd-os/.vercel`
  2. 正本コマンドを **リポ root を `--cwd` に渡す** に変更: `npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os`
  3. 誤って作られた `amd-os` プロジェクトは `npx vercel projects rm amd-os` (対話 y) で削除
  4. CLAUDE.md / SPEC_pwa.md の正本コマンドを更新
- **教訓**:
  - Vercel project 設定 (Root Directory 等) を変えたら CLI deploy の正本コマンドも同じ commit で更新する
  - `--yes` を使うときは事前に `cat .vercel/project.json` で対象プロジェクトを必ず確認する。空なら新プロジェクトが作られる
  - 「全ルート 404」事故と同型: `--cwd` が想定と違うパスを指すと、誤った場所にデプロイされる

