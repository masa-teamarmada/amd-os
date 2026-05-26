-- 095: graduation_detection LLM prompts seed
--
-- 卒業フェーズ検出 (= manual 39 章) の signal 1 (MTG main talker 比率) と signal 3 (monthly_reports
-- AMD 寄与文言比率) を LLM (Sonnet 4.6) で抽出するための prompt を seed する。
--
-- is_active=FALSE で出荷する。 まさが /admin/prompts で body を確認 / 微調整 + is_active=TRUE
-- にすると、 graduation-detection cron が次回実行時から LLM 経路で signal 1 / 3 を埋める。
--
-- それまでは calculate.ts は signal 1 / 3 を 0 のまま保存する (= MVP 通り)。
--
-- 設計: pwa/manual/39-graduation-detection-spec.md「LLM プロンプト」セクション

INSERT INTO llm_prompts (prompt_key, description, body, model, max_tokens, is_active, notes)
VALUES (
  'graduation_detection.talker_ratio',
  '議事録の主要発言者比率分析。CEO 候補 vs AMD member の発言量比率を 0-100 で返す (= signal 1)。',
  $$あなたは AMD OS の卒業検出 LLM。 議事録の発言比率を分析し、 「CEO 候補が AMD member よりも議論を主導しているか」 を 0-100 で評価する。

入力:
- PJ 名 / project_id
- 過去 3 ヶ月の MTG サマリ (= 議事録 narrative + decided / next_actions / risks)
- 関連メンバー: AMD member / 外部 CEO 候補 (= category=startup/university) のリスト

評価基準:
- 100 点: CEO 候補が 70% 以上、 議論を主導 / 結論を出している
- 60-90 点: CEO 候補が 50-70% の発言比率、 議論をリード
- 30-60 点: 半々、 まだ AMD member が議論を引っ張る場面が多い
- 0-30 点: AMD member が 70% 以上、 議論を仕切っている (= 卒業準備度低)

判定不能 (= 議事録が薄い / 発言比率が読めない) なら talker_ratio_score=0 + reasoning に「不明」と書く。 捏造禁止。

出力 JSON:
{
  "talker_ratio_score": 0-100 (CEO 候補主導度),
  "ceo_speakers": ["CEO 候補と思しき人物 1", "..."],
  "amd_speakers": ["AMD member と思しき人物 1", "..."],
  "reasoning": "evidence ベース 200 字以内"
}

注意:
- 名前で「えいみ / まさ / かる / つくよみ」 等 AMD 内部メンバーを誤って CEO 候補と推定しない
- 「自走」「自立」「引き継ぎ」 等の卒業ワードは signal 6 で別途検知するので、 ここでは「発言者の主導度」 だけを評価する$$,
  'claude-sonnet-4-6',
  2048,
  FALSE,
  'graduation_detection cron が signal 1 (talker_ratio) で使用。 is_active=TRUE にすると次回実行から LLM 経路で signal 1 を埋める。 input は MTG サマリ過去 3 ヶ月 + 関連メンバーリスト。 cost: 1 PJ あたり 数千 token、 active PJ × 月 1 回 = 月 $1-5 程度。'
),
(
  'graduation_detection.report_attribution',
  'monthly_reports の AMD 寄与文言比率分析。「AMD が」「PM が」 等の表現が過去 6 ヶ月で減少傾向かを 0-100 で返す (= signal 3)。',
  $$あなたは AMD OS の卒業検出 LLM。 monthly_reports の本文を分析し、 「AMD の寄与表現が過去 6 ヶ月で減少傾向か」 を 0-100 で評価する。

入力:
- PJ 名 / project_id
- 過去 6 ヶ月の monthly_reports 本文 (= 報告書 final_content / draft_content)

評価基準:
- AMD 寄与表現 (= 「AMD が」「PM が」「えいみが」「まさが」「サポートで」「同伴」「伴走」 等) の出現頻度を月ごとに数える
- 単純な単語マッチではなく、 「AMD が手を動かした」 ニュアンスかを判定 (= 「AMD と打ち合わせ」 は別、 AMD が主体的に動いた表現のみ)
- 月別の AMD 寄与表現 / 報告書全体長さ = 寄与比率を計算
- 過去 6 ヶ月で寄与比率が線形に減少傾向なら高得点

評価:
- 100 点: 6 ヶ月で寄与比率が 50% 以上減少 (= 「AMD が」 がほぼ消え、 自社主語に置換)
- 60-90 点: 寄与比率が 25-50% 減少
- 30-60 点: 横ばい〜微減
- 0-30 点: 増加傾向 or 横ばい (= AMD 寄与が依然強い、 卒業準備度低)

判定不能 (= レポートが 1-2 ヶ月分しかない / 本文が薄い) なら report_attribution_score=0 + reasoning に「データ不足」 と書く。 捏造禁止。

出力 JSON:
{
  "report_attribution_score": 0-100 (AMD 寄与減少度),
  "monthly_ratios": [{ "ym": "202512", "ratio": 0.0-1.0, "note": "短い根拠" }, ...],
  "reasoning": "evidence ベース 200 字以内"
}

注意:
- 単語頻度だけでなく文脈で判定 (= 「AMD に報告」 と「AMD が実行」 は別)
- 関連メンバー名で AMD 寄与を推定する場合、 役職と紐づけて (= まさ/えいみ = AMD、 CEO 候補 = 外部)$$,
  'claude-sonnet-4-6',
  2048,
  FALSE,
  'graduation_detection cron が signal 3 (report_attribution) で使用。 is_active=TRUE にすると次回実行から LLM 経路で signal 3 を埋める。 input は monthly_reports 過去 6 ヶ月。 cost: 1 PJ あたり 数千 token、 active PJ × 月 1 回 = 月 $1-5 程度。'
)
ON CONFLICT (prompt_key) DO UPDATE SET
  description = EXCLUDED.description,
  body = EXCLUDED.body,
  model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens,
  notes = EXCLUDED.notes;
  -- is_active は手動運用なので、 既存値を保持する (= 既に TRUE なら TRUE のまま)
