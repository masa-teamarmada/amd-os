/** 074_SettingsApi.gs
 * Settings API
 *
 * 目的：
 * - ログイン中ユーザーの「通知先チャネル（gmail/slack）」を取得/保存する
 *
 * 依存：
 * - settings_getByGoogleId（075_SettingsRepo.gs）
 * - settings_saveMyNotifyChannelByGoogleId（075_SettingsRepo.gs）
 *
 * ポリシー：
 * - 自分の設定しか触れない（adminで他人をいじるのは別口にする）
 * - slackId が無いのに slack を選んでも保存自体はOK（送信側でフォールバックする想定）
 */

function api_getMySettings(payload){
  payload = payload || {};

  const email = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  if (!email) return { ok:false, message:"no active user email", settings:null };

  const got = settings_getByGoogleId(email);
  if (!got.ok) {
    // DBにいないケースでも画面は動かしたい（最低限の表示）
    return {
      ok:true,
      message:"member not found; fallback",
      settings:{
        googleId: email,
        slackId: "",
        notifyChannel: "gmail",
        memberId: "",
        name: ""
      }
    };
  }

  const s = got.settings || {};
  return {
    ok:true,
    message:"ok",
    settings:{
      googleId: s.googleId || email,
      slackId: s.slackId || "",
      notifyChannel: (s.notifyChannel || "gmail"),
      memberId: s.memberId || "",
      name: s.name || ""
    }
  };
}

function api_saveMySettings(payload){
  payload = payload || {};
  const email = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  if (!email) return { ok:false, message:"no active user email" };

  const notifyChannel = String(payload.notifyChannel || "").trim().toLowerCase();
  if (!notifyChannel) return { ok:false, message:"notifyChannel empty" };

  const res = settings_saveMyNotifyChannelByGoogleId(email, notifyChannel);
  if (!res || !res.ok) return { ok:false, message: (res && res.message) ? res.message : "save failed" };

  // 保存後の最新を返す（UIの表示揃える）
  const got = settings_getByGoogleId(email);
  const s = (got && got.ok && got.settings) ? got.settings : { googleId: email, slackId:"", notifyChannel: notifyChannel };

  return {
    ok:true,
    message:"saved",
    settings:{
      googleId: s.googleId || email,
      slackId: s.slackId || "",
      notifyChannel: (s.notifyChannel || notifyChannel || "gmail"),
      memberId: s.memberId || "",
      name: s.name || ""
    }
  };
}
