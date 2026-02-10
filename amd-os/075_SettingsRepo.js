/** 075_SettingsRepo.gs
 * Settings Repo
 *
 * 目的：
 * - DB_Members を正として、個人設定（通知先チャネルなど）の読み書きを行う
 *
 * 扱うデータ：
 * - DB_Members
 *   - googleId    : 通知先メール（ログインメール）
 *   - slackId     : Slack User ID（Uxxxx）
 *   - notifyChannel : "gmail" | "slack"（デフォは gmail 想定）
 *
 * ポリシー：
 * - このファイルは「DBの読み書き」だけを担当し、UIや権限制御は扱わない
 * - notifyChannel が不正な値なら保存しない
 */

function settings_getByGoogleId(googleId) {
  googleId = String(googleId || "").trim().toLowerCase();
  if (!googleId) return { ok:false, message:"googleId empty", rowIndex:0, settings:null };

  const sh = getSheet_("DB_Members");

  // 必要列を保証（既存運用に寄せる）
  ensureHeader_(sh, ["memberId","name","googleId","slackId","notifyChannel"]);

  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) {
    return { ok:false, message:"DB_Members empty", rowIndex:0, settings:null };
  }

  const header = values[0].map(x => String(x || "").trim());
  const idx = _idxMap(header);

  const colGoogle = idx["googleId"];
  const colSlack  = idx["slackId"];
  const colChan   = idx["notifyChannel"];
  const colMember = idx["memberId"];
  const colName   = idx["name"];

  if (!colGoogle || !colSlack || !colChan) {
    return { ok:false, message:"required columns missing", rowIndex:0, settings:null };
  }

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const g = String(row[colGoogle-1] || "").trim().toLowerCase();
    if (g !== googleId) continue;

    const chan = String(row[colChan-1] || "").trim().toLowerCase() || "gmail";

    return {
      ok:true,
      message:"ok",
      rowIndex: r + 1, // シート行番号
      settings: {
        memberId: colMember ? String(row[colMember-1] || "").trim() : "",
        name:     colName ? String(row[colName-1] || "").trim() : "",
        googleId: googleId,
        slackId:  String(row[colSlack-1] || "").trim(),
        notifyChannel: chan
      }
    };
  }

  return { ok:false, message:"member not found: " + googleId, rowIndex:0, settings:null };
}

function settings_saveMyNotifyChannelByGoogleId(googleId, notifyChannel) {
  googleId = String(googleId || "").trim().toLowerCase();
  notifyChannel = String(notifyChannel || "").trim().toLowerCase();

  if (!googleId) return { ok:false, message:"googleId empty" };

  // 許可値だけ
  const allow = new Set(["gmail","slack"]);
  if (!allow.has(notifyChannel)) return { ok:false, message:"invalid notifyChannel: " + notifyChannel };

  const got = settings_getByGoogleId(googleId);
  if (!got.ok) return { ok:false, message: got.message };

  const sh = getSheet_("DB_Members");
  const values = sh.getDataRange().getValues();
  const header = values[0].map(x => String(x || "").trim());
  const idx = _idxMap(header);

  const colChan = idx["notifyChannel"];
  if (!colChan) return { ok:false, message:"notifyChannel column missing" };

  // 1セルだけ更新
  sh.getRange(got.rowIndex, colChan).setValue(notifyChannel);

  return { ok:true, message:"saved", googleId:googleId, notifyChannel:notifyChannel };
}

/** 内部：ヘッダ -> 1始まりの列番号Map */
function _idxMap(headerRow) {
  const m = {};
  for (let i = 0; i < headerRow.length; i++) {
    const key = String(headerRow[i] || "").trim();
    if (!key) continue;
    m[key] = i + 1;
  }
  return m;
}
