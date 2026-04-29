/***************************************
 * Home.gs（暫定：SHEETS依存を一旦停止）
 * 目的：
 * - 旧Home実装が Billing.gs の SHEETS に依存していて
 *   「ReferenceError: SHEETS is not defined」で全体が落ちるのを防ぐ
 * - いまは Home の新実装（TaskInstanceベース）に移行中なので、
 *   旧Homeは完全に止める
 ***************************************/

/*
/***************************************
 * Home.gs（全文）
 * - Home画面用データ生成
 * - 絶対URL(baseUrl)を返して、相対リンク事故を防ぐ
 * - 依存：Billing.gs にある SHEETS / readTable_ / findMemberIdByEmail_ / getAllowedProjectIds_ / parseDateLoose_
 ***************************************

function getHomeData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const members = readTable_(ss.getSheetByName(SHEETS.MEMBERS));
  const projects = readTable_(ss.getSheetByName(SHEETS.PROJECTS));
  const grants = readTable_(ss.getSheetByName(SHEETS.ACCESS));
  const cycles = readTable_(ss.getSheetByName(SHEETS.BILLING));

  const email = (Session.getActiveUser().getEmail() || "").toLowerCase();
  const actorMemberId = findMemberIdByEmail_(members, email);

  if (!actorMemberId) {
    throw new Error(`Home: memberIdが特定できない（email=${email}）。DB_Members.emailを確認して`);
  }

  // 権限（Comment）で触れるPJ
  const allowed = getAllowedProjectIds_(grants, actorMemberId, "Comment");
  const isAdmin = allowed.has("*");

  // PMが見るPJ一覧（adminなら全部）
  const myProjects = projects
    .filter(p => p.projectId)
    .filter(p => isAdmin || allowed.has(String(p.projectId)))
    .map(p => ({
      projectId: String(p.projectId),
      projectName: p.projectName || p["PJ名"] || p.projectId,
      status: p["状態(Active/Hold/Closed)"] || p.status || "",
    }));

  // 来月（YYYY-MM-01）
  const tz = Session.getScriptTimeZone();
  const nextMonth = firstDayOfNextMonth_(new Date(), tz);
  const nextMonthStr = formatYmd_(nextMonth, tz);

  // Home ToDo（薄く）
  const todos = [];
  const myPidSet = new Set(myProjects.map(p => p.projectId));

  // (1) 未入力：来月のBillingCycleが存在しないPJ
  const cycleKey = new Set(
    cycles
      .filter(c => c.cycleId && c.projectId && c["対象月(YYYY-MM-01)"])
      .map(c => `${String(c.projectId)}__${String(c["対象月(YYYY-MM-01)"]).slice(0,10)}`)
  );

  myProjects.forEach(p => {
    const key = `${p.projectId}__${nextMonthStr}`;
    if (!cycleKey.has(key)) {
      todos.push({
        severity: "red",
        title: "未入力：来月の請求/支払い",
        detail: `${p.projectName}（${p.projectId}） / 対象月 ${nextMonthStr}`,
        // ★絶対URL化はHTML側でやるので、ここは相対クエリだけ返す
        href: `?page=project&projectId=${encodeURIComponent(p.projectId)}`,
      });
    }
  });

  // (2) 未合意：全メンバー合意がFALSE/空のcycle
  cycles
    .filter(c => c.cycleId && c.projectId && myPidSet.has(String(c.projectId)))
    .filter(c => isFalsy_(c["全メンバー合意"]))
    .slice(0, 20)
    .forEach(c => {
      const pname = findProjectName_(myProjects, String(c.projectId));
      todos.push({
        severity: "orange",
        title: "未合意：報酬合意が未完了",
        detail: `${pname}（${c.projectId}） / 対象月 ${String(c["対象月(YYYY-MM-01)"]||"").slice(0,10)} / cycleId ${c.cycleId}`,
        // v0はPJへ飛ばす（cycle詳細は次）
        href: `?page=project&projectId=${encodeURIComponent(c.projectId)}`,
      });
    });

  // (3) 期限接近：支払予定日 or 入金予定日 が近い（列があれば）
  const today = startOfDay_(new Date(), tz);
  const alertDays = 7;

  cycles
    .filter(c => c.cycleId && c.projectId && myPidSet.has(String(c.projectId)))
    .forEach(c => {
      const payPlan = pickDate_(c, ["支払予定日(翌々月末)", "支払予定日", "支払予定"]);
      const payDone = pickAny_(c, ["支払実行日", "支払日"]);
      if (payPlan && !payDone) {
        const diff = diffDays_(today, payPlan);
        if (diff >= 0 && diff <= alertDays) {
          const pname = findProjectName_(myProjects, String(c.projectId));
          todos.push({
            severity: "yellow",
            title: "期限接近：支払予定日が近い",
            detail: `${pname}（${c.projectId}） / 支払予定 ${formatYmd_(payPlan, tz)} / cycleId ${c.cycleId}`,
            href: `?page=project&projectId=${encodeURIComponent(c.projectId)}`,
          });
        }
      }

      const inPlan = pickDate_(c, ["入金予定日", "入金予定"]);
      const inDone = pickAny_(c, ["入金日"]);
      if (inPlan && !inDone) {
        const diff = diffDays_(today, inPlan);
        if (diff >= 0 && diff <= alertDays) {
          const pname = findProjectName_(myProjects, String(c.projectId));
          todos.push({
            severity: "yellow",
            title: "期限接近：入金予定日が近い",
            detail: `${pname}（${c.projectId}） / 入金予定 ${formatYmd_(inPlan, tz)} / cycleId ${c.cycleId}`,
            href: `?page=project&projectId=${encodeURIComponent(c.projectId)}`,
          });
        }
      }
    });

  // メンバー表示名
  const me = members.find(m => String(m.memberId) === String(actorMemberId));
  const myName = (me && (me.codeName || me.memberName || me.memberId)) || actorMemberId;

  // 並び：赤→橙→黄
  const sevRank = { red: 1, orange: 2, yellow: 3, gray: 9 };
  todos.sort((a,b) => (sevRank[a.severity]||9) - (sevRank[b.severity]||9));

  return {
    baseUrl: getExecBaseUrl_(), // ★ここが追加
    actor: {
      email,
      memberId: actorMemberId,
      name: myName,
      isAdmin,
    },
    nextMonth: nextMonthStr,
    projects: myProjects,
    todos: todos.slice(0, 30),
  };
}

// ===== helpers (Home専用) =====

function getExecBaseUrl_() {
  // Webアプリとしてデプロイされてる時に /exec のURLが取れる
  const url = ScriptApp.getService().getUrl();
  if (!url) throw new Error("WebアプリURLが取得できない。デプロイ済みか確認して");
  return url;
}

function firstDayOfNextMonth_(d, tz) {
  const y = Number(Utilities.formatDate(d, tz, "yyyy"));
  const m = Number(Utilities.formatDate(d, tz, "MM"));
  return new Date(y, m, 1);
}

function formatYmd_(d, tz) {
  return Utilities.formatDate(d, tz, "yyyy-MM-dd");
}

function startOfDay_(d, tz) {
  const y = Number(Utilities.formatDate(d, tz, "yyyy"));
  const m = Number(Utilities.formatDate(d, tz, "MM")) - 1;
  const day = Number(Utilities.formatDate(d, tz, "dd"));
  return new Date(y, m, day);
}

function diffDays_(d1, d2) {
  const ms = 24 * 3600 * 1000;
  return Math.floor((d2.getTime() - d1.getTime()) / ms);
}

function isFalsy_(v) {
  if (v === false) return true;
  const s = String(v || "").trim().toLowerCase();
  return s === "" || s === "false" || s === "0" || s === "no" || s === "ng";
}

function pickAny_(row, keys) {
  for (const k of keys) {
    if (k in row && row[k] !== "" && row[k] !== null && row[k] !== undefined) return row[k];
  }
  return "";
}

function pickDate_(row, keys) {
  const v = pickAny_(row, keys);
  if (!v) return null;
  const d = parseDateLoose_(v); // Billing.gsの関数
  return d;
}

function findProjectName_(projectList, projectId) {
  const p = projectList.find(x => String(x.projectId) === String(projectId));
  return p ? p.projectName : projectId;
}
*/

//
// 新Home実装に移行中：暫定のダミー
// （getHomeDataという関数名が他所から呼ばれても落ちないようにする）
//
// 旧Home無害化のためのダミー（名前を変えて上書きしない）
function getHomeData_LegacyDisabled() {
  return {
    baseUrl: (ScriptApp.getService().getUrl() || ""),
    actor: { email: "", memberId: "", name: "", isAdmin: false },
    nextMonth: "",
    projects: [],
    todos: []
  };
}

function test_getHomeData() {
  const data = getHomeData();
  Logger.log(JSON.stringify(data, null, 2));
}
