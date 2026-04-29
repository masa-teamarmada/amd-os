// 522_IssuesTasksApi.gs
// 役割: Issues/Tasks機能のAPIエントリポイント
// コックピット画面（225_ProjectCockpit.html）から呼ばれる
// 依存: 520_IssuesRepo.gs, 521_TasksRepo.gs

// ---- Issues ----

function issuesApi_list(payload) {
  var projectId = typeof payload === 'string' ? payload : (payload || {}).projectId;
  var milestoneId = typeof payload === 'object' ? (payload.milestoneId || null) : null;
  var status = typeof payload === 'object' ? (payload.status || null) : null;
  var all = JSON.parse(JSON.stringify(issues_listByProject(projectId)));
  if (milestoneId) all = all.filter(function(r) { return r.milestoneId === milestoneId; });
  if (status) all = all.filter(function(r) { return r.status === status; });
  return all;
}

function issuesApi_upsert(payload) {
  // payload: { issueId?, projectId, milestoneId, title, description, source }
  if (!payload.issueId) payload.issueId = issues_generateId_();
  if (!payload.status) payload.status = 'open';
  issues_upsert(payload);
  return { success: true, issueId: payload.issueId };
}

function issuesApi_resolve(issueId) {
  const all = issues_readAll_();
  const issue = all.find(r => r.issueId === issueId);
  if (!issue) return { success: false, error: 'not found' };
  issue.status = 'resolved';
  issue.resolvedAtJst = issues_nowJst_();
  issues_upsert(issue);
  return { success: true };
}

function issuesApi_delete(issueId) {
  // soft delete: statusをdeletedに
  const all = issues_readAll_();
  const issue = all.find(r => r.issueId === issueId);
  if (!issue) return { success: false, error: 'not found' };
  issue.status = 'deleted';
  issues_upsert(issue);
  return { success: true };
}

// ---- Tasks ----
function tasksApi_list(payload) {
  var projectId = typeof payload === 'string' ? payload : (payload || {}).projectId;
  var milestoneId = typeof payload === 'object' ? (payload.milestoneId || null) : null;
  var status = typeof payload === 'object' ? (payload.status || null) : null;
  var all = JSON.parse(JSON.stringify(
    tasks_listByProject(projectId).filter(function(r) { return r.status !== 'deleted'; })
  ));
  if (milestoneId) all = all.filter(function(r) { return r.milestoneId === milestoneId; });
  if (status) all = all.filter(function(r) { return r.status === status; });
  return all;
}

function tasksApi_upsert(payload) {
  // payload: { taskId?, projectId, milestoneId, subItemId, title, description, assignee, dueDate, source }
  if (!payload.taskId) payload.taskId = tasks_generateId_();
  if (!payload.status) payload.status = 'todo';
  tasks_upsert(payload);
  return { success: true, taskId: payload.taskId };
}

function tasksApi_updateStatus(taskId, status) {
  // status: todo / doing / done
  const ok = tasks_updateStatus(taskId, status);
  return { success: ok };
}

function tasksApi_delete(taskId) {
  const all = tasks_readAll_();
  const task = all.find(r => r.taskId === taskId);
  if (!task) return { success: false, error: 'not found' };
  task.status = 'deleted';
  tasks_upsert(task);
  return { success: true };
}

function tasksApi_approvePending(taskId) {
  var all  = tasks_readAll_();
  var task = all.filter(function(r) { return r.taskId === taskId; })[0];
  if (!task) return { success: false, error: 'not found' };
  task.status = 'todo';
  tasks_upsert(task);
  return { success: true };
}

function tasksApi_rejectPending(taskId) {
  var all  = tasks_readAll_();
  var task = all.filter(function(r) { return r.taskId === taskId; })[0];
  if (!task) return { success: false, error: 'not found' };
  task.status = 'deleted';
  tasks_upsert(task);
  return { success: true };
}