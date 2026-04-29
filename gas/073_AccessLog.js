/** 73_AccessLog.gs
 * AMD OS内のアクセスログ担当。
 * DB_AccessLogへの記録と、アクセスログからDB_Members.osLastSeenAtを更新する処理を扱う。
 */
// ======================================================================
// Access Log (AMD OS)
// ======================================================================

function _getAccessLogSheet_(){
  const sh = getSheetOrCreate_("DB_AccessLog");
  ensureHeader_(sh, ["at","userEmail","event","page","mode","projectId","metaJson"]);
  return sh;
}
function logAccessEvent_(event, ctx){
  try{
    const sh = _getAccessLogSheet_();
    const userEmail = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();

    // ★JST (+09:00) のタイムゾーン付き文字列で固定
    const now = new Date();
    const atJst = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX");

    const c = ctx || {};
    const page = String(c.page || "");
    const mode = String(c.mode || "");
    const projectId = String(c.projectId || "");
    const metaJson = JSON.stringify(c.meta || {});

    sh.appendRow([atJst, userEmail, String(event||""), page, mode, projectId, metaJson]);
  } catch(e){
    // ログで本体止めない
  }
}
function _ensureMembersOsLastSeenHeader_(){
  const sh = getSheet_("DB_Members");
  ensureHeader_(sh, ["osLastSeenAt"]); // 末尾に足す
  return sh;
}
/**
 * DB_AccessLog からユーザーごとの最終アクセス日時を集計して
 * DB_Members.osLastSeenAt に反映する
 */
function updateOsLastSeenFromAccessLog_(){
  _ensureMembersOsLastSeenHeader_();

  const logSh = _getAccessLogSheet_();
  const logLastRow = logSh.getLastRow();
  const logLastCol = logSh.getLastColumn();
  if (logLastRow < 2) return { ok:true, updated:0, scanned:0, note:"no access logs" };

  const logHeader = logSh.getRange(1,1,1,logLastCol).getValues()[0].map(x => String(x||"").trim());
  const liAt = logHeader.indexOf("at");
  const liEmail = logHeader.indexOf("userEmail");
  if (liAt < 0 || liEmail < 0) throw new Error("DB_AccessLog header missing: at/userEmail");

  const logVals = logSh.getRange(2,1,logLastRow-1,logLastCol).getValues();

  // userEmail -> max(at)
  const maxByEmail = Object.create(null);
  let scanned = 0;

  function toDate_(v){
    if (!v) return null;
    if (v instanceof Date && !isNaN(v.getTime())) return v;
    const s = String(v || "").trim();
    if (!s) return null;

    // "2026-01-14T12:34:56+09:00" はここで確実にDate化される
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;

    return null;
  }

  for (let i=0; i<logVals.length; i++){
    const row = logVals[i];
    const email = String(row[liEmail] || "").toLowerCase().trim();
    const d = toDate_(row[liAt]);

    if (!email || !d) continue;

    scanned++;
    const prev = maxByEmail[email];
    if (!prev || d.getTime() > prev.getTime()) maxByEmail[email] = d;
  }

  const memSh = getSheet_("DB_Members");
  const memLastRow = memSh.getLastRow();
  const memLastCol = memSh.getLastColumn();
  if (memLastRow < 2) return { ok:true, updated:0, scanned, note:"no members" };

  const memHeader = memSh.getRange(1,1,1,memLastCol).getValues()[0].map(x => String(x||"").trim());
  const miEmail = memHeader.indexOf("email");
  const miOsLast = memHeader.indexOf("osLastSeenAt");
  const miUpdated = memHeader.indexOf("updatedAt");

  if (miEmail < 0) throw new Error("DB_Members header missing: email");
  if (miOsLast < 0) throw new Error("DB_Members header missing: osLastSeenAt");
  if (miUpdated < 0) throw new Error("DB_Members header missing: updatedAt");

  const memRange = memSh.getRange(2,1,memLastRow-1,memLastCol);
  const memVals = memRange.getValues();

  const osLastCol = [];
  const updatedAtCol = [];
  let updated = 0;

  for (let r=0; r<memVals.length; r++){
    const row = memVals[r];
    const email = String(row[miEmail] || "").toLowerCase().trim();

    const prevOs = row[miOsLast];
    const logDate = email ? (maxByEmail[email] || null) : null;

    // ログにエントリがなければ既存値を維持（上書き消去しない）
    const prevOsDate = toDate_(prevOs);
    const useLog = logDate && (!prevOsDate || logDate.getTime() > prevOsDate.getTime());
    const nextOs = useLog ? logDate : (prevOs || "");

    const prevTime = prevOsDate ? prevOsDate.getTime() : NaN;
    const nextTime = (nextOs instanceof Date && !isNaN(nextOs.getTime()))
      ? nextOs.getTime()
      : (nextOs ? new Date(String(nextOs)).getTime() : NaN);

    const changed = (
      (isNaN(prevTime) && !isNaN(nextTime)) ||
      (!isNaN(prevTime) && isNaN(nextTime)) ||
      (!isNaN(prevTime) && !isNaN(nextTime) && prevTime !== nextTime)
    );

    osLastCol.push([nextOs || ""]);
    if (changed){
      updated++;
      updatedAtCol.push([new Date()]);
    } else {
      updatedAtCol.push([row[miUpdated]]);
    }
  }

  memSh.getRange(2, miOsLast+1, memLastRow-1, 1).setValues(osLastCol);
  memSh.getRange(2, miUpdated+1, memLastRow-1, 1).setValues(updatedAtCol);

  return { ok:true, updated, scanned };
}

function initMonthlyReportDB() {
  mr_repo_ensureMonthlyReportsHeader_();
  Logger.log('DB_MonthlyReports initialized');
}

function testMonthlyReportGeneration() {
  const projectId = 'YOUR_PROJECT_ID';
  const ym = '202501'; // 2025年1月
  
  // データ収集テスト
  const collectionResult = api_collectMonthlyData(projectId, ym);
  Logger.log('=== 収集結果 ===');
  Logger.log(JSON.stringify(collectionResult, null, 2));
  
  // 報告書生成テスト
  const generateResult = api_generateMonthlyReport(projectId, ym);
  Logger.log('=== 生成結果 ===');
  Logger.log(JSON.stringify(generateResult, null, 2));
}