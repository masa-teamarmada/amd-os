/** 165_ContractWorkflowWatch.js — 非LLMの契約メール監視を5分ごとに呼ぶ。
 * 正本: pwa/spec/5-6-contracts-management-current-spec.md
 * 旧LLM cronの停止設定には触れない。メール送信・共有権限変更なし。
 */
function amie_contractWorkflowWatch() {
 var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {ok:true,busy:true};
 try {
  var props=PropertiesService.getScriptProperties();
  var base=String(props.getProperty('PWA_BASE_URL')||'https://amd-os-pwa.vercel.app').replace(/\/+$/,'');
  var secret=String(props.getProperty('CRON_SECRET')||'');
  if(!secret)throw new Error('CRON_SECRET missing');
  var response=UrlFetchApp.fetch(base+'/api/cron/contract-mail-watch',{method:'get',headers:{Authorization:'Bearer '+secret},muteHttpExceptions:true});
  var result=JSON.parse(response.getContentText());
  Logger.log('[contract-workflow] status='+response.getResponseCode()+' ok='+!!result.ok);
  return result;
 } finally {lock.releaseLock();}
}
function amie_setupContractWorkflowWatch() {
 var fn='amie_contractWorkflowWatch';var triggers=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()===fn;});
 if(!triggers.length)ScriptApp.newTrigger(fn).timeBased().everyMinutes(5).create();
 return amie_contractWorkflowWatchStatus();
}
function amie_contractWorkflowWatchStatus() {
 return {ok:true,handler:'amie_contractWorkflowWatch',intervalMinutes:5,triggerCount:ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='amie_contractWorkflowWatch';}).length,credentialConfigured:!!PropertiesService.getScriptProperties().getProperty('CRON_SECRET')};
}
