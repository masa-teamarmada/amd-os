# Project Share DEBUG

## 2026-07-31: Vercel上のHTML PDF化で日本語を確実に出す

### 症状

- ローカルではPDFを作れても、Vercel Functionでは起動に失敗する、またはPDF内の日本語が欠けることがある。

### 原因

- サーバーレスのChromiumには日本語フォントが前提として入っていない。
- npmパッケージ内のフォント素材を実行時に解決するだけでは、VercelのFunctionへ同梱されないことがある。

### 対応内容

- 全インスタンスのPDF変換処理で、`@fontsource-variable/noto-sans-jp` のCSSとフォントをデータとしてページへ埋め込む。
- `vercel.json` の `includeFiles` に同パッケージを指定し、Functionへ必ず同梱する。
- HTML内のJavaScriptと外部ネットワーク通信はPDF化時に実行しないまま、KUTE本番でアップロードした日本語HTMLをA4 PDFとして取得・描画確認した。

### 再発防止策

- ローカルのPDF生成成功だけで完了にしない。フォント依存を変えたら、本番へ一時HTMLを置き、PDFを取得して日本語の描画を確認してから、その検証用Blobを削除する。
- フォント素材の読み込み経路を変える場合は、Vercel Functionへ含まれる設定と日本語PDFの実描画をセットで確認する。
