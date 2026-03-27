/** 10_Utils.gs
 * 全体共通のユーティリティ担当。
 * HTMLエスケープ、型変換、JSON安全化、日付/ym計算など、どの機能にも属さない汎用関数を置く。
 */

function b_formatJst_(date, fmt) {
  return Utilities.formatDate(
    date instanceof Date ? date : new Date(date),
    'Asia/Tokyo',
    fmt || 'yyyy年MM月dd日 HH:mm'
  );
}

function escapeHtml_(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
function safeJsonParse_(v, fallback){
  try {
    if (v === null || v === undefined || v === "") return fallback;
    if (typeof v === "object") return v; // すでにobjectならそのまま
    return JSON.parse(String(v));
  } catch (e) {
    return fallback;
  }
}
function toBool_(v) {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v || "").trim().toLowerCase();
  return (s === "true" || s === "1" || s === "yes" || s === "y" || s === "on" || s === "✅");
}
function formatJPY_(n){
  const x = Number(n || 0);
  return "¥" + x.toLocaleString("ja-JP");
}
function buildBillingSummary_(projectName, ym, budget, memberPays, statusLabel){
  const total = (memberPays || []).reduce((s,r)=>s+Number(r.amount||0),0);
  const lines = (memberPays || [])
    .filter(r => Number(r.amount || 0) !== 0)
    .map(r => `${r.name || r.memberId}:${formatJPY_(r.amount)}`)
    .join(", ");
  return `[${statusLabel}] ${projectName} / ${ym} 予算:${formatJPY_(budget)} 合計:${formatJPY_(total)} | ${lines}`;
}
function getDefaultCharterJson_(){
  return {
    contract: {
      status: "unsigned",        // unsigned | signed | terminated
      signedAt: "",              // yyyy-mm-dd
      counterpartyName: "",
      signedPdf: { fileId: "", url: "", fileName: "", uploadedAt: "" }
    },
    goals: {
      midLongTermGoals: "",
      graduationState: ""
    },
    governance: {
      decisionRule: "",
      raciText: ""               // MVPはテキストでOK（後で表にする）
    },
    plan: {
      overallPlan: "",
      milestonesText: ""         // MVPはテキストでOK
    },
    risks: {
      risksText: ""              // MVPはテキストでOK
    }
  };
}
//ヘルパー関数 fmtYmdJa_(d)まで5つ
//listProjects() が “次にやるタスクと期限危険度” を返すようにする
function ymKeyToDate_(ymKey, day){
  // ymKey: YYYYMM
  const s = String(ymKey || "").trim();
  const y = Number(s.slice(0,4));
  const m = Number(s.slice(4,6));
  return new Date(y, (m||1)-1, day||1, 0,0,0,0);
}
function addMonthsYmKey_(ymKey, delta){
  const s = String(ymKey || "").trim();
  const y = Number(s.slice(0,4));
  const m = Number(s.slice(4,6));
  const d = new Date(y, (m||1)-1, 1, 0,0,0,0);
  d.setMonth(d.getMonth() + (delta||0));
  const yy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  return `${yy}${mm}`;
}
function endOfMonthYmKey_(ymKey){
  const s = String(ymKey || "").trim();
  const y = Number(s.slice(0,4));
  const m = Number(s.slice(4,6));
  return new Date(y, m, 0, 0,0,0,0);
}
function daysDiffLocal_(a, b){
  // 今日→期限 何日
  const ms = 24*60*60*1000;
  const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.floor((bb - aa) / ms);
}
function fmtYmdJa_(d){
  const y = d.getFullYear();
  const m = d.getMonth()+1;
  const day = d.getDate();
  return `${y}年${m}月${day}日`;
}
// ======================================================================
// Admin: inactiveDays auto-calc
// ======================================================================
function _parseDateLoose_(v){
  if (!v) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v;

  const s = String(v || "").trim();
  if (!s) return null;

  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;

  return null;
}
function _floorLocalDate_(d){
  // ローカル日付の 00:00 に丸める（diffのズレ防止）
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0,0);
}
function _daysBetweenLocal_(a, b){
  const ms = 24*60*60*1000;
  const aa = _floorLocalDate_(a).getTime();
  const bb = _floorLocalDate_(b).getTime();
  return Math.floor((bb - aa) / ms);
}
function _maxDate_(a, b){
  if (!a && !b) return null;
  if (a && !b) return a;
  if (!a && b) return b;
  return (a.getTime() >= b.getTime()) ? a : b;
}