/***************************************
 * Project.gs（PJ詳細 v0：ステージ＆タスク表示）
 * 前提：
 * - DB_Projects: projectId, projectName, CurrentStageID, PM, 状態(Active/Hold/Closed) ...
 * - DB_Stages: stageId, stageName
 * - DB_Tasks: taskId, stageId, taskName, description ...
 * - DB_TaskInstances: projectId, taskId, status ...
 *
 * 依存：
 * - Billing.gs にある readTable_ / findMemberIdByEmail_ / getAllowedProjectIds_ / parseDateLoose_
 ***************************************/

const PROJECT_SHEETS = {
  STAGES: "DB_Stages",
  TASKS: "DB_Tasks",
  TASK_INSTANCES: "DB_TaskInstances",
};

function getProjectPageData(projectId) {
  projectId = String(projectId || "").trim();
  if (!projectId) throw new Error("projectIdが空");

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const members = readTable_(ss.getSheetByName(SHEETS.MEMBERS));
  const projects = readTable_(ss.getSheetByName(SHEETS.PROJECTS));
  const grants = readTable_(ss.getSheetByName(SHEETS.ACCESS));

  const shStages = ss.getSheetByName(PROJECT_SHEETS.STAGES);
  const shTasks = ss.getSheetByName(PROJECT_SHEETS.TASKS);
  const shTI = ss.getSheetByName(PROJECT_SHEETS.TASK_INSTANCES);

  if (!shStages) throw new Error(`シート無し: ${PROJECT_SHEETS.STAGES}`);
  if (!shTasks) throw new Error(`シート無し: ${PROJECT_SHEETS.TASKS}`);
  if (!shTI) throw new Error(`シート無し: ${PROJECT_SHEETS.TASK_INSTANCES}`);

  const stages = readTable_(shStages);
  const tasks = readTable_(shTasks);
  const taskInstances = readTable_(shTI);

  // ログインユーザー -> memberId
  const email = (Session.getActiveUser().getEmail() || "").toLowerCase();
  const actorMemberId = findMemberIdByEmail_(members, email);
  if (!actorMemberId) throw new Error(`memberId不明（email=${email}）。DB_Members.emailを確認して`);

  // 権限チェック：ReadOnly以上で閲覧可
  const allowed = getAllowedProjectIds_(grants, actorMemberId, "ReadOnly");
  const allowAll = allowed.has("*");
  if (!allowAll && !allowed.has(projectId)) {
    throw new Error(`権限なし：このPJは閲覧できない（projectId=${projectId} / memberId=${actorMemberId}）`);
  }

  // PJ行
  const pj = projects.find(p => String(p.projectId) === projectId);
  if (!pj) throw new Error(`DB_Projectsに存在しない projectId=${projectId}`);

  // ★ここ確定：CurrentStageID
  const currentStageId = String(pj["CurrentStageID"] || "").trim();

  const project = {
    projectId,
    projectName: pj.projectName || pj["PJ名"] || projectId,
    clientName: pj["クライアント名"] || pj.clientName || "",
    pm: pj["PM"] || pj.pm || "",
    status: pj["状態(Active/Hold/Closed)"] || pj.status || "",
    currentStageId,
  };

  // ステージ名
  const st = stages.find(s => String(s.stageId) === currentStageId);
  const stageName = st ? (st.stageName || "") : "";

  // タスク（現在ステージのもの）
  const stageTasks = tasks
    .filter(t => String(t.stageId) === currentStageId)
    .map(t => ({
      taskId: String(t.taskId),
      taskName: String(t.taskName || ""),
    }))
    .filter(t => t.taskId);

  // TaskInstanceからstatusを取る（なければTodo）
  const tiMap = new Map();
  taskInstances
    .filter(r => String(r.projectId) === projectId)
    .forEach(r => {
      const tid = String(r.taskId || "").trim();
      if (!tid) return;
      const stt = String(r.status || "").trim();
      if (stt) tiMap.set(tid, stt);
    });

  const tasksForView = stageTasks
    .sort((a,b)=> a.taskId.localeCompare(b.taskId))
    .map(t => ({
      taskId: t.taskId,
      taskName: t.taskName,
      status: tiMap.get(t.taskId) || "Todo",
    }));

  return {
    actor: { email, memberId: actorMemberId },
    project,
    stage: { stageId: currentStageId, stageName },
    tasks: tasksForView,
    links: {
      home: "?page=home",
      billing: "?page=billing",
      self: `?page=project&projectId=${encodeURIComponent(projectId)}`,
    }
  };
}
