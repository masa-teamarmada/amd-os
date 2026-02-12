/***************************************
 * Bot.gs（まさBOT v0）
 * - DB_KnowledgeCards を検索して関連カードを返す（RAGの入口）
 * - projectId指定があればPJサマリも返す（DB_Projects/Stages/Tasks/TaskInstances）
 * - 生成AIは使わない：まず“OSに刺さる”感を出す
 *
 * 依存：Billing.gs の readTable_ / findMemberIdByEmail_ / getAllowedProjectIds_ / parseDateLoose_
 ***************************************/

const BOT_SHEETS = {
  KNOWLEDGE: "DB_KnowledgeCards",
  STAGES: "DB_Stages",
  TASKS: "DB_Tasks",
  TASK_INSTANCES: "DB_TaskInstances",
};

function getBotInitData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const members = readTable_(ss.getSheetByName(SHEETS.MEMBERS));
  const projects = readTable_(ss.getSheetByName(SHEETS.PROJECTS));
  const grants = readTable_(ss.getSheetByName(SHEETS.ACCESS));

  const email = (Session.getActiveUser().getEmail() || "").toLowerCase();
  const actorMemberId = findMemberIdByEmail_(members, email);
  if (!actorMemberId) throw new Error(`BOT: memberId不明（email=${email}）。DB_Members.emailを確認して`);

  const allowed = getAllowedProjectIds_(grants, actorMemberId, "ReadOnly");
  const isAdmin = allowed.has("*");
  const canProjects = projects
    .filter(p => p.projectId)
    .filter(p => isAdmin || allowed.has(String(p.projectId)))
    .map(p => ({
      projectId: String(p.projectId),
      projectName: p.projectName || p["PJ名"] || p.projectId,
    }));

  const me = members.find(m => String(m.memberId) === String(actorMemberId));
  const myName = (me && (me.codeName || me.memberName || me.memberId)) || actorMemberId;

  return {
    baseUrl: ScriptApp.getService().getUrl(),
    actor: { email, memberId: actorMemberId, name: myName, isAdmin },
    projects: canProjects,
  };
}

/**
 * メイン：BOT応答
 * payload: { query: string, projectId?: string }
 */
function botAsk(payload) {
  payload = payload || {};
  const query = String(payload.query || "").trim();
  const projectId = String(payload.projectId || "").trim();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const members = readTable_(ss.getSheetByName(SHEETS.MEMBERS));
  const grants = readTable_(ss.getSheetByName(SHEETS.ACCESS));

  const email = (Session.getActiveUser().getEmail() || "").toLowerCase();
  const actorMemberId = findMemberIdByEmail_(members, email);
  if (!actorMemberId) throw new Error(`BOT: memberId不明（email=${email}）`);

  const allowed = getAllowedProjectIds_(grants, actorMemberId, "ReadOnly");
  const isAdmin = allowed.has("*");

  const cards = searchKnowledgeCards_(query, isAdmin);
  const projectSummary = projectId ? buildProjectSummary_(projectId, actorMemberId, isAdmin) : null;

  const actions = buildNextActions_(query, projectSummary);

  return {
    ok: true,
    query,
    projectId: projectId || "",
    cards,
    projectSummary,
    actions,
  };
}

// ===== Knowledge Cards =====

function searchKnowledgeCards_(query, isAdmin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(BOT_SHEETS.KNOWLEDGE);
  if (!sh) return [];

  const rows = readTable_(sh);
  const q = normalize_(query);

  // visibility フィルタ
  const allow = (vis) => {
    vis = String(vis || "").toLowerCase();
    if (vis === "" || vis === "public") return true;
    if (vis === "pm") return true;
    if (vis === "admin") return isAdmin;
    if (vis === "confidential") return isAdmin; // v0はadminのみ
    return false;
  };

  // スコアリング（v0：包含 + タグ一致）
  const scored = rows
    .filter(r => r.cardId && allow(r.visibility))
    .map(r => {
      const title = String(r.title || "");
      const tags = String(r.tags || "");
      const body = String(r.body || "");

      const hay = normalize_(title + " " + tags + " " + body);
      let score = 0;

      if (q) {
        if (hay.includes(q)) score += 5;
        // クエリをゆるく分割
        tokenize_(q).forEach(tok => {
          if (!tok) return;
          if (hay.includes(tok)) score += 1;
        });
      } else {
        // クエリ空なら更新日順に
        score += 0;
      }

      // タグ強め
      tokenize_(normalize_(tags)).forEach(tok => {
        if (tok && q.includes(tok)) score += 2;
      });

      return {
        cardId: String(r.cardId),
        title,
        tags,
        visibility: String(r.visibility || "public"),
        body,
        driveFileId: String(r.driveFileId || ""),
        updatedAt: String(r.updatedAt || ""),
        _score: score,
      };
    })
    .sort((a,b)=> (b._score - a._score));

  // 上位だけ返す（v0）
  return scored.slice(0, 5).map(x => {
    delete x._score;
    return x;
  });
}

// ===== Project Summary =====

function buildProjectSummary_(projectId, actorMemberId, isAdmin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 権限：ReadOnly以上（*は全許可）
  const members = readTable_(ss.getSheetByName(SHEETS.MEMBERS));
  const grants = readTable_(ss.getSheetByName(SHEETS.ACCESS));
  const allowed = getAllowedProjectIds_(grants, actorMemberId, "ReadOnly");
  const allowAll = allowed.has("*");
  if (!allowAll && !allowed.has(projectId)) {
    throw new Error(`BOT: 権限なし projectId=${projectId}`);
  }

  const projects = readTable_(ss.getSheetByName(SHEETS.PROJECTS));
  const stages = readTable_(ss.getSheetByName(BOT_SHEETS.STAGES));
  const tasks = readTable_(ss.getSheetByName(BOT_SHEETS.TASKS));
  const tis = readTable_(ss.getSheetByName(BOT_SHEETS.TASK_INSTANCES));

  const pj = projects.find(p => String(p.projectId) === String(projectId));
  if (!pj) throw new Error(`BOT: DB_Projectsに存在しない projectId=${projectId}`);

  const currentStageId = String(pj["CurrentStageID"] || "").trim();
  const st = stages.find(s => String(s.stageId) === currentStageId);
  const stageName = st ? String(st.stageName || "") : "";

  const stageTasks = tasks
    .filter(t => String(t.stageId) === currentStageId)
    .map(t => ({ taskId: String(t.taskId), taskName: String(t.taskName || "") }));

  const tiMap = new Map();
  tis
    .filter(r => String(r.projectId) === String(projectId))
    .forEach(r => tiMap.set(String(r.taskId), String(r.status || "Todo")));

  const taskStats = stageTasks.map(t => ({
    ...t,
    status: tiMap.get(t.taskId) || "Todo",
  }));

  const done = taskStats.filter(t => String(t.status).toLowerCase() === "done").length;
  const total = taskStats.length;

  return {
    projectId: String(projectId),
    projectName: pj.projectName || pj["PJ名"] || projectId,
    pm: pj["PM"] || "",
    clientName: pj["クライアント名"] || "",
    status: pj["状態(Active/Hold/Closed)"] || "",
    currentStageId,
    stageName,
    progress: total ? `${done}/${total}` : "-",
    tasks: taskStats.slice(0, 20),
  };
}

// ===== Next Actions (rule-based v0) =====

function buildNextActions_(query, projectSummary) {
  const actions = [];

  if (projectSummary) {
    actions.push({
      title: `PJ詳細を見る（${projectSummary.projectName}）`,
      href: `?page=project&projectId=${encodeURIComponent(projectSummary.projectId)}`,
    });
    actions.push({
      title: "請求/支払い入力へ（v0）",
      href: `?page=billing`,
    });

    // ステージ未設定なら
    if (!projectSummary.currentStageId) {
      actions.push({
        title: "CurrentStageIDを設定する（DB_Projects）",
        href: "#",
      });
    } else {
      // Todoが多いなら
      const todo = (projectSummary.tasks || []).filter(t => String(t.status).toLowerCase() !== "done").length;
      if (todo > 0) {
        actions.push({
          title: "次にDoneにするタスクを決める（v0は閲覧）",
          href: `?page=project&projectId=${encodeURIComponent(projectSummary.projectId)}`,
        });
      }
    }
  } else {
    actions.push({ title: "PJを選んで状況要約してみる", href: "?page=bot" });
    actions.push({ title: "請求/支払い入力へ", href: "?page=billing" });
    actions.push({ title: "Homeへ戻る", href: "?page=home" });
  }

  // クエリに応じたヒント（超薄い）
  const q = normalize_(query);
  if (q.includes("請求") || q.includes("支払") || q.includes("予算")) {
    actions.unshift({ title: "来月予算・配賦・報告書を登録する", href: "?page=billing" });
  }
  if (q.includes("合意") || q.includes("承認")) {
    actions.unshift({ title: "合意フロー（承認リンク）を入れる予定：v0では未実装", href: "#" });
  }

  // 上位3件に絞る（v0）
  return actions.slice(0, 3);
}

// ===== tiny utils =====
function normalize_(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize_(s) {
  // v0：スペース区切り＋記号除去の超簡易
  return String(s || "")
    .split(/[ \n\t,、。・/]+/)
    .map(x => x.trim())
    .filter(Boolean);
}
