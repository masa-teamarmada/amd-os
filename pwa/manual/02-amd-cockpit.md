# 02. AMD 会社全体 (p00)

URL: `/project/p00/cockpit`。**会社全体 (= AMD 株式会社) を 1 つの PJ として扱う特殊ケース**。`project_id='p00'` で他の PJ と同じテーブル構造に乗る。

## 誰がいつ使うか
- **AMD 経営チーム**が会社全体の経営状況を見る
- **提案前の論点整理セッション**で会社全体の議題を扱うとき
- 月次の経営状況レビュー + 全 PJ 横断の戦略議論

## 2.1 Management Score

- 5 つの軸で会社全体を評価:
  - **先手力** (= 新規開拓スピード)
  - **財務耐久** (= キャッシュランウェイ)
  - **既存 PJ 継続** (= 動いてる PJ の健全性)
  - **新規獲得** (= 新 PJ パイプライン)
  - **戦略接近** (= 投資家/パートナー戦略実行度)
- Total スコア (= 5 軸の合成) と各軸スコアを月次推移グラフで表示
- スコア source: `amd_management_score_snapshots` テーブル
- 月次更新で計算 + 各 evidence (= `amd_management_score_evidence`) と紐付け

### 詳細ビュー
- `/management-score` で score history、5 軸 mini trend、runway / cash、月次試算表ビュー、差分メモを確認
- raw signal は `amd_management_score_raw_signals`、snapshot は `amd_management_score_snapshots`、短い根拠は `amd_management_score_evidence`
- 5 軸の重み・算出ロジック・finance simulation は **[29 章 Management Score / Finance Simulation](29-management-score-and-finance-simulation-spec.md)** が正本

---

## 2.2 提案前の論点整理セッション

提案前の論点整理セッションは、レビュー担当が LLM と OS 上の candidate を 1 件ずつ読み、チームへ提案する前の論点・提案・残課題を整理する対話セッション。

議事録 / MTG サマリでは、正式決定ではなく **提案**・**整理**・**相談前提の論点**として残す。

### トリガー
レビュー担当が以下のように指示したら開始する:
- 「提案前の論点整理をしよう」
- 「経営ハイライト見よう」
- 「signals レビュー」

(= 再起動不要、新セッション初回でも OK)

### レビュー支援AIがやる手順

1. **candidate を全 PJ 横断で読む**:
   - impact: `critical` > `high` > `medium` > `low`
   - 同 impact 内は signal_date desc

2. **最初の 1 件を提示** (= 全部一気に出さない、1 議題ずつ):
   - PJ コードネーム + signal_type chip + impact chip + title + summary 2-3 行
   - 「これどう?」と短く問う

3. **レビュー担当の反応に応じて反映する** (= その場で、後でやらない):
   - `進める` / `これで確定` / `decided` → 確定扱いにする
   - `違う` / `不採用` / `保留` → 却下扱いにする
   - `こう修正` → title / summary / impact などを差し替える
   - `これ別 signal で残したい` → 新しい confirmed signal として残す

4. **次の議題へ。1 セッションで 5-10 件目安**、レビュー担当が「これで終わり」と言うまで

5. **セッション終了時に議論ログを保存**:
   - PJ 単位、会社全体は `project_id='p00'`
   - cockpit の MTG サマリ欄に `source_kinds='dialogue'` で並ぶ
   - `decided[]` は「**提案**」のニュアンスで書く (= チームへの相談前提)

6. **narrative 化** (= 直後):
   - Sonnet 4.6 が raw 配列を「背景 → 議論の流れ → チームへの提案案 → 残課題」の Markdown に
   - cockpit の MTG サマリ詳細で主表示

### よくある間違い
- ❌ 議題を 10 件一気に箇条書きで出す → 1 件ずつ会話形式で
- ❌ レビュー担当が返事する前に勝手に confirm する → 明示判断後
- ❌ 議論ログ保存を後回しにする → セッション終了時に必ず叩く
- ❌ p00 を忘れる → AMD 全体の議題 (Management Score / freee / 月次運用) は p00

### candidate が空 / 古いとき
- `status='candidate'` 行が無い、または signal_date が 1 週間以上前 → レビュー支援AIが OS を横断 read して新規 candidate を `proposed` で積んでから議論開始 (= daily routine と同じ動作を手動)

---

## 2.3 会社全体の経営ハイライト (p00)

- 各 PJ で並んでる経営ハイライトと同じ仕組みで、`project_id='p00'` のものが並ぶ
- 例: 「AMD Management Score で direction_score 84→64 急減」「VC 投資委員会フェーズに 3 PJ 同時突入」
- 4 分類 (経営全般 / 事業開発 / 技術開発 / 外部環境) + polarity アイコンは同じ

---

## 2.4 月次運営

p00 でも他 PJ と同じ月次ルーティンが回る:
- 報告書 FIX (= 会社全体)
- 請求書発行 (= SU から AMD への業務委託費)
- 入金確認

→ 詳細は **[04 章 admin オペ](04-admin-ops.md)** へ。

---

## 関連
- **[01 章 PJ コックピット](01-pj-cockpit.md)**
- **[29 章 Management Score / Finance Simulation](29-management-score-and-finance-simulation-spec.md)**
- **[28 章 通知レビュー UI / 経営ハイライト確認](28-notification-review-and-strategy-signals-spec.md)**
