/** 11_Profiler.gs
 * パフォーマンス計測（簡易プロファイラ）担当。
 * 処理時間のマーク取得と記録を提供し、UIの重さやボトルネック特定に使う。
 */

function _profStart_(){
  return { t0: Date.now(), marks: [] };
}
function _profMark_(p, label){
  p.marks.push({ label: String(label||""), ms: Date.now() - p.t0 });
}