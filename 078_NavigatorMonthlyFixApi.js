/** 078_NavigatorMonthlyFixApi.gs
 * 役割：
 * - 月次サマリのフィールドを「誤り指摘→LLM修正→override保存」するAPI
 * - 修正指摘ログ（学習用）をDBへappendする（モデル学習じゃなく運用学習）
 */

function nav_fixMonthlyByFeedback(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const ymRaw = String(payload.ym || "").trim();
  const fieldKey = String(payload.fieldKey || "").trim();
  const currentText = String(payload.currentText || "");
  const feedback = String(payload.feedback || "").trim();

  if (!projectId) return { ok:false, message:"projectId empty" };
  const ymKey = normalizeYm(ymRaw);
  if (!ymKey) return { ok:false, message:"ym invalid" };
  if (!fieldKey) return { ok:false, message:"fieldKey empty" };
  if (!feedback) return { ok:false, message:"feedback empty" };

  // 根拠ログ（items）
  let monthly = {};
  try{
    monthly = (typeof nav_repo_getMonthlyExtract_ === "function")
      ? (nav_repo_getMonthlyExtract_(projectId, ymKey) || {})
      : {};
  }catch(e){
    monthly = {};
  }

  const items = Array.isArray(monthly.items) ? monthly.items : [];
  const itemsText = items.slice(0, 80).map(x=>{
    const t = String(x.itemType || "item");
    const b = String(x.body || "");
    return `- [${t}] ${b}`;
  }).join("\n");

  // ★学習（Human Fixesの正本＝DB_NavigatorMonthlyEdits）
  const past = nav_repo_listRecentMonthlyEditsForFeedback_(projectId, 12);
  const pastText = (past && past.length)
    ? past.map((x, i)=>{
        const fk = String(x.fieldKey||"");
        const afterText = String(x.afterText||"").trim();
        const note = String(x.note||"").trim();
        const cut = afterText.length > 220 ? (afterText.slice(0,220) + "…") : afterText;
        return [
          `#${i+1} field:${fk}`,
          note ? `note:${note}` : "",
          `preferred:${cut}`
        ].filter(s=>s).join(" | ");
      }).join("\n")
    : "";

  // LLM修正（090に入れたやつ：戻り値は {text, reason}）
  let fixed = null;
  try{
    if (typeof _openai_fixNavigatorMonthlyFieldByFeedback_ !== "function"){
      return { ok:false, message:"LLM fixer missing: _openai_fixNavigatorMonthlyFieldByFeedback_" };
    }

    fixed = _openai_fixNavigatorMonthlyFieldByFeedback_({
      projectId: projectId,
      ym: ymKey,
      fieldKey: fieldKey,
      currentText: currentText,
      feedback: feedback,
      itemsText: itemsText,
      pastCorrectionsText: pastText
    });

  }catch(e){
    return { ok:false, message:String(e && (e.message || e) || "LLM fix error") };
  }

  const fixedText = String(fixed && fixed.text ? fixed.text : "").trim();
  if (!fixedText) return { ok:false, message:"LLM returned empty text" };

  // override保存
  const save = nav_repo_saveMonthlyOverride_({
    projectId: projectId,
    ym: ymKey,
    fieldKey: fieldKey,
    text: fixedText,
    note: `llm_fix: ${feedback}`
  });

  if (!save || !save.ok){
    return save || { ok:false, message:"override save failed" };
  }

  // ★運用学習ログ（DB_NavigatorMonthlyEditsに積む）
  try{
    if (typeof nav_repo_appendMonthlyEditLogForFeedback_ === "function"){
      nav_repo_appendMonthlyEditLogForFeedback_({
        projectId: projectId,
        ym: ymKey,
        fieldKey: fieldKey,
        beforeText: currentText,
        afterText: fixedText,
        note: `llm_fix: ${feedback}`
      });
    }
  }catch(e){}

  // 観測ログ（あれば）
  try{
    if (typeof navObserveAppendSnapshot === "function"){
      navObserveAppendSnapshot(projectId, ymKey, "llm_fix");
    }
  }catch(e){}

  return { ok:true, projectId:projectId, ym:ymKey, fieldKey:fieldKey, text: fixedText };
}
