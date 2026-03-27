// D104_DevAppApi.gs
// アプリ定義のgoogle.script.run公開API

function api_getApps() {
  try {
    return toClientSafe_(getAllApps_());
  } catch(e) {
    return { error: e.message };
  }
}

function api_upsertApp(params) {
  try {
    const appId = upsertApp_(params);
    return toClientSafe_({ ok: true, appId });
  } catch(e) {
    return { error: e.message };
  }
}

function api_deleteApp(appId) {
  try {
    deleteApp_(appId);
    return { ok: true };
  } catch(e) {
    return { error: e.message };
  }
}