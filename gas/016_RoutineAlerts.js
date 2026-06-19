function cron_checkRoutineAlertsDaily_(){
  return { ok: true, disabled: true, reason: "pm monthly routine abolished 2026-06-19" };
}

function setupRoutineAlertTrigger(){
  const handler = "cron_checkRoutineAlertsDaily_";
  const triggers = ScriptApp.getProjectTriggers();

  // 既存を消す（9時の残骸を確実に除去）
  let removed = 0;
  triggers.forEach(t => {
    try{
      if (t.getHandlerFunction && t.getHandlerFunction() === handler){
        ScriptApp.deleteTrigger(t);
        removed++;
      }
    } catch(e){}
  });

  return { ok:true, disabled:true, message:"monthly routine alert trigger removed; no new trigger created", removed };
}
