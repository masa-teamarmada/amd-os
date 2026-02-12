/** 183_TsukuyomiBillingPaymentDueAlerts.gs
 * 役割：
 * - DB_BillingCycle を日次で走査し、支払期日が「前日/当日」かつ未入金のみを admin にSlack通知する
 * - PM/メンバーへは通知しない
 * - リンクは BillingPage の projectId + ym + focus=paymentCheck に飛ばす
 *
 * 前提：
 * - DB_BillingCycle が正本
 * - 未入金判定：paymentConfirmedAt が空
 * - 支払期日：invoicePaymentDate があれば優先、なければ paymentDueRule + ym から計算
 * - Slack送信：既存の slack_post / slack_postDm を利用
 * - JST（Asia/Tokyo）運用
 */

// ===== 公開：日次トリガーから呼ぶ入口 =====
function cron_sendBillingPaymentDueAlertsDaily(){
  const nowJst = new Date(); // スクリプトTZがJST前提
  const todayYmd = _fmtYmd_(nowJst); // yyyymmdd
  const offsets = [-1, 0]; // 将来ここに -3 を足すだけ

  // 1) admin宛先（slackId）をDB_Membersから解決
  const adminSlackIds = _getAdminSlackIds_();
  if (!adminSlackIds.length) return;

  // 2) DB_BillingCycle を読む（薄読みがあればそれを使う）
  const rows = _readBillingCycleRows_(); // 配列（オブジェクト）
  if (!rows.length) return;

  // 3) 対象抽出
  const targets = [];
  for (const r of rows){
    const projectId = String(r.projectId || "").trim();
    const ym = String(r.ym || "").trim(); // yyyymm 想定（yyyy-mmは使わない）
    if (!projectId || !ym) continue;

    // 未入金判定
    const paidAt = String(r.paymentConfirmedAt || "").trim();
    if (paidAt) continue;

    // 期日決定
    const due = _getPaymentDueDateJst_(r, ym);
    if (!due) continue;

    const dueYmd = _fmtYmd_(due);
    for (const off of offsets){
      const checkYmd = _addDaysYmd_(dueYmd, off);
      if (checkYmd !== todayYmd) continue;

      // 同日重複防止（トリガー多重/手動実行対策）
      const dedupeKey = `paydue:${projectId}:${ym}:${off}:${todayYmd}`;
      if (_isAlreadySentToday_(dedupeKey)) continue;

      targets.push({
        projectId,
        ym,
        dueYmd,
        offset: off
      });
      _markSentToday_(dedupeKey);
    }
  }

  if (!targets.length) return;

  // 4) Slack通知（adminのみに送る）
  for (const t of targets){
    const msg = _buildSlackText_(t);
    const link = _buildBillingPaymentCheckUrl_(t.projectId, t.ym);

    // 既存関数を優先（存在しない環境でも落とさない）
    // DMで送る（adminチャンネル運用にしたくなったらここ1箇所だけ変える）
    for (const slackId of adminSlackIds){
      if (typeof slack_postDm === "function"){
        slack_postDm({ slackUserId: slackId, text: `${msg}\n${link}` });
      } else if (typeof slack_post === "function"){
        // フォールバック（チャンネルしか無い場合）
        // ※ここは運用で admin用チャンネルID を ScriptProperties 等に置くなら差し替え
        slack_post({ text: `${msg}\n${link}` });
      }
    }
  }
}

// ===== 期日計算 =====
function _getPaymentDueDateJst_(row, ym){
  // invoicePaymentDate があれば最優先
  const raw = String(row.invoicePaymentDate || "").trim();
  const d1 = _parseDateLooseJst_(raw);
  if (d1) return d1;

  // paymentDueRule + ym で計算（ルール形式が不明なので、まずは“対応できる範囲だけ”）
  const rule = String(row.paymentDueRule || "").trim();
  if (!rule) return null;

  return _calcDueFromRule_(ym, rule);
}

/**
 * paymentDueRule の最低限パーサ
 * 対応（例）：
 * - "EOM"      : 当月末
 * - "EOM+1"    : 翌月末
 * - "EOM+2"    : 2ヶ月後末
 * - "D15"      : 当月15日
 * - "D15+1"    : 翌月15日
 *
 * ここは“将来増える”前提で閉じ込めてる
 */
function _calcDueFromRule_(ym, rule){
  if (!/^\d{6}$/.test(ym)) return null;

  const y = Number(ym.slice(0,4));
  const m = Number(ym.slice(4,6)); // 1-12

  // EOM系
  const mEom = rule.match(/^EOM(?:\+(\d+))?$/i);
  if (mEom){
    const add = Number(mEom[1] || 0);
    const base = _addMonths_(y, m, add);
    return _endOfMonth_(base.y, base.m);
  }

  // Dxx系
  const mDx = rule.match(/^D(\d{1,2})(?:\+(\d+))?$/i);
  if (mDx){
    const day = Number(mDx[1]);
    const add = Number(mDx[2] || 0);
    const base = _addMonths_(y, m, add);
    const eom = _endOfMonth_(base.y, base.m);
    const dd = Math.max(1, Math.min(day, eom.getDate())); // 月末越えは丸め
    return new Date(base.y, base.m - 1, dd, 0, 0, 0);
  }

  // 未対応は安全にnull（誤通知しない）
  return null;
}

// ===== admin解決 =====
function _getAdminSlackIds_(){
  // DB_Members から isAdmin=TRUE の slackId を拾う
  const members = _readDbTable_("DB_Members");
  const out = [];
  for (const r of members){
    const isAdmin = String(r.isAdmin || "").toLowerCase();
    const slackId = String(r.slackId || "").trim();
    if (!slackId) continue;
    if (isAdmin === "true" || isAdmin === "1" || isAdmin === "yes") out.push(slackId);
  }
  return Array.from(new Set(out));
}

// ===== URL生成 =====
function _buildBillingPaymentCheckUrl_(projectId, ym){
  // WebApp URL（/exec）を取ってクエリを付ける
  const base = ScriptApp.getService().getUrl();
  const qs = [
    `page=billing`,
    `projectId=${encodeURIComponent(projectId)}`,
    `ym=${encodeURIComponent(ym)}`,
    `focus=paymentCheck`,
    `spa=0`
  ].join("&");
  return `${base}?${qs}`;
}

// ===== Slack文面 =====
function _buildSlackText_(t){
  const head =
    (t.offset === 0)
      ? "【入金確認】支払期日 今日"
      : "【入金確認】支払期日 前日";

  // PJ名を入れたいけど、DB_Projectsを別読みすると重くなるので、まずは projectId を出す
  // 将来、軽くPJ名を引くならここで projectName だけ付け足す
  return `${head} / PJ:${t.projectId} / ym:${t.ym} / 期限:${t.dueYmd}`;
}

// ===== DB読み（安全側の薄い実装） =====
function _readBillingCycleRows_(){
  return _readDbTable_("DB_BillingCycle");
}

/**
 * DB_* を「ヘッダ行→オブジェクト配列」で読む最小実装
 * 既存の b_readTableThin_ があるならそっち優先で使う
 */
function _readDbTable_(sheetName){
  if (typeof b_readTableThin_ === "function"){
    try{
      return b_readTableThin_(sheetName) || [];
    }catch(e){
      // フォールバックへ
    }
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const values = sh.getRange(1,1,lastRow,lastCol).getValues();
  const headers = values[0].map(h => String(h||"").trim());
  const out = [];
  for (let i=1;i<values.length;i++){
    const row = values[i];
    const obj = {};
    let hasAny = false;
    for (let c=0;c<headers.length;c++){
      const key = headers[c];
      if (!key) continue;
      obj[key] = row[c];
      if (row[c] !== "" && row[c] != null) hasAny = true;
    }
    if (hasAny) out.push(obj);
  }
  return out;
}

// ===== 日付ユーティリティ（JST前提で文字列化） =====
function _fmtYmd_(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const da = String(d.getDate()).padStart(2,"0");
  return `${y}${m}${da}`;
}

function _addDaysYmd_(ymd, addDays){
  const y = Number(ymd.slice(0,4));
  const m = Number(ymd.slice(4,6));
  const da = Number(ymd.slice(6,8));
  const dt = new Date(y, m-1, da, 0, 0, 0);
  dt.setDate(dt.getDate() + addDays);
  return _fmtYmd_(dt);
}

function _parseDateLooseJst_(s){
  if (!s) return null;
  // "2026/02/05", "2026-02-05", Dateオブジェクトなどをゆるく吸う
  if (Object.prototype.toString.call(s) === "[object Date]" && !isNaN(s.getTime())) return s;
  const str = String(s).trim();
  const m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]), 0, 0, 0);
}

function _endOfMonth_(y, m){
  // m: 1-12
  return new Date(y, m, 0, 0, 0, 0); // 翌月0日＝当月末
}

function _addMonths_(y, m, add){
  // m: 1-12
  let mm = (m - 1) + add;
  let yy = y + Math.floor(mm / 12);
  mm = (mm % 12 + 12) % 12; // 正規化
  return { y: yy, m: mm + 1 };
}

// ===== 重複防止（同日内） =====
function _isAlreadySentToday_(key){
  const cache = CacheService.getScriptCache();
  return !!cache.get(key);
}
function _markSentToday_(key){
  const cache = CacheService.getScriptCache();
  cache.put(key, "1", 6 * 60 * 60); // 6時間で十分
}
