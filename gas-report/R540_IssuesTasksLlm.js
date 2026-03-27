// R540_IssuesTasksLlm.gs
// SourceCache → LLM → DB_Tasks(pending) パイプライン
// 依存: R311_SourceCacheRepo, R163_LlmRouter, R172_TsukuyomiContextRepo

function itLlm_runForProject(projectId, ym) {
  var cacheItems = srcCache_listByProjectYm(projectId, ym);
  if (!cacheItems || cacheItems.length === 0) return { skipped: true, reason: 'no_source_cache' };

  var systemPrompt = itLlm_getSystemPrompt_(projectId);
  if (!systemPrompt) return { error: 'no_system_prompt' };

  var subItems = itLlm_getSubItems_(projectId);
  var existing = itLlm_listPendingTitles_(projectId);

  var validItems = cacheItems.filter(function(item) { return item.contentText; });
  var combinedText = validItems
    .map(function(item) {
      return '[cacheId:' + item.cacheId + '][' + item.source + '] ' + (item.title || '') + '\n' + item.contentText;
    })
    .join('\n---\n')
    .slice(0, 6000);

  var userPrompt = itLlm_buildUserPrompt_(combinedText, subItems, ym, projectId);
  var result = llm_callJson('task_extract', systemPrompt, userPrompt, { maxTokens: 1000 });
  if (!result || !Array.isArray(result.tasks)) return { error: 'invalid_llm_response' };

  var saved = 0;
  var now = itLlm_jstNow_();
  for (var i = 0; i < result.tasks.length; i++) {
    var task = result.tasks[i];
    var titleNorm = (task.title || '').trim().toLowerCase();
    if (!titleNorm || existing.indexOf(titleNorm) !== -1) continue;
    itLlm_upsertTask_({
      taskId:        'task_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12),
      projectId:     projectId,
      milestoneId:   task.milestoneId   || '',
      subItemId:     task.subItemId     || '',
      title:         task.title,
      description:   task.description   || '',
      status:        'pending',
      assignee:      task.assignee      || '',
      dueDate:       '',
      source:        'llm_extract',
      createdAtJst:  now,
      updatedAtJst:  now,
      sourceCacheId: task.sourceCacheId || '',
      sourceQuote:   task.sourceQuote   || ''
    });
    saved++;
  }
    if (saved > 0) itLlm_distillFeedback_(projectId);
  return { saved: saved, total: result.tasks.length };
}

function run_itLlm_allProjects() {
  var projects = b_readTable_('DB_Projects')
    .filter(function(p) { return p.status === 'active'; });
  var ym = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMM');
  var results = [];
  for (var i = 0; i < projects.length; i++) {
    try {
      var r = itLlm_runForProject(projects[i].projectId, ym);
      results.push({ projectId: projects[i].projectId, result: r });
      Utilities.sleep(400);
    } catch(e) {
      results.push({ projectId: projects[i].projectId, error: e.message });
    }
  }
  Logger.log(JSON.stringify(results));
  return results;
}

// ---- private ----
function itLlm_getSystemPrompt_(projectId) {
  var res = tsukuyomi_listContextRows();
  var rows = (res && res.rows) ? res.rows : [];

  var base = rows.filter(function(r) {
    return String(r.tags || '').split(',').map(function(t) { return t.trim(); }).indexOf('task_extract') !== -1
      && r.status === 'active'
      && (!r.scope || r.scope === '');
  })[0];

  var pjRule = projectId ? rows.filter(function(r) {
    var tags = String(r.tags || '').split(',').map(function(t) { return t.trim(); });
    return tags.indexOf('task_feedback_summary') !== -1
      && r.status === 'active'
      && r.scope === 'project'
      && String(r.scopeKey) === String(projectId);
  })[0] : null;

  var prompt = base ? (base.systemPrompt || '') : '';
  if (pjRule && pjRule.systemPrompt) {
    prompt += '\n\n【このプロジェクト固有のルール（過去フィードバックから学習済み）】\n' + pjRule.systemPrompt;
  }
  return prompt;
}

function itLlm_getSubItems_(projectId) {
  var navSs = itLlm_getNavSs_();
  var cycleSheet = navSs.getSheetByName('DB_ValuePlanCycles');
  if (!cycleSheet || cycleSheet.getLastRow() < 2) return [];
  var cycles = itLlm_sheetToObjects_(cycleSheet);
  var cycle = cycles.filter(function(r) {
    return String(r.projectId) === String(projectId) && r.status === 'active';
  })[0];
  if (!cycle) return [];

  var msSheet = navSs.getSheetByName('DB_ValueMilestones');
  if (!msSheet || msSheet.getLastRow() < 2) return [];
  var milestones = itLlm_sheetToObjects_(msSheet).filter(function(r) {
    return String(r.planCycleId) === String(cycle.planCycleId);
  });
  var msIds = milestones.map(function(m) { return String(m.milestoneId); });
  if (msIds.length === 0) return [];

  var siSheet = navSs.getSheetByName('DB_MilestoneSubItems');
  if (!siSheet || siSheet.getLastRow() < 2) return [];
  return itLlm_sheetToObjects_(siSheet).filter(function(r) {
    return msIds.indexOf(String(r.milestoneId)) !== -1;
  });
}

function itLlm_listPendingTitles_(projectId) {
  var sheet = itLlm_getNavSs_().getSheetByName('DB_Tasks');
  if (!sheet || sheet.getLastRow() < 2) return [];
  return itLlm_sheetToObjects_(sheet)
    .filter(function(r) { return String(r.projectId) === String(projectId) && r.status === 'pending'; })
    .map(function(r) { return (r.title || '').trim().toLowerCase(); });
}

function itLlm_upsertTask_(task) {
  var sheet = itLlm_getNavSs_().getSheetByName('DB_Tasks');
  if (!sheet) throw new Error('DB_Tasks not found');
  var headers = ['taskId','projectId','milestoneId','subItemId','title','description','status','assignee','dueDate','source','createdAtJst','updatedAtJst','sourceCacheId','sourceQuote'];
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  var row = headers.map(function(h) { return task[h] !== undefined ? task[h] : ''; });
  sheet.appendRow(row);
}

function itLlm_buildUserPrompt_(combinedText, subItems, ym, projectId) {
  var subLines = subItems.map(function(s) {
    return '- subItemId:' + s.subItemId + ' milestoneId:' + s.milestoneId + ' title:' + s.title;
  }).join('\n');
  var members = b_readTable_('DB_Members')
    .filter(function(m) { return m.status === 'active'; })
    .map(function(m) { return '- codeName:' + (m.codeName || '') + ' / 実名:' + (m.memberName || ''); })
    .join('\n');

  return '対象年月: ' + ym
    + '\n\n【メンバーcodeName一覧】\n' + (members || '（なし）')
    + '\n\n【サブMS一覧】\n' + (subLines || '（なし）')
    + '\n\n【一次情報】\n' + combinedText;
}

function itLlm_buildFeedbackBlock_(projectId) {
  try {
    var sheet = itLlm_getNavSs_().getSheetByName('DB_TaskFeedback');
    if (!sheet || sheet.getLastRow() < 2) return '';
    var rows = itLlm_sheetToObjects_(sheet).filter(function(r) {
      return String(r.projectId) === String(projectId);
    });
    if (rows.length === 0) return '';

    var rejects = rows.filter(function(r) { return r.feedbackType === 'reject'; });
    var edits   = rows.filter(function(r) { return r.feedbackType === 'edit'; });
    var approves = rows.filter(function(r) { return r.feedbackType === 'approve'; });

    var lines = ['【過去のフィードバック（学習用）】'];

    if (rejects.length > 0) {
      lines.push('■ 却下されたパターン（これに近いものはTODOとして抽出しない）:');
      rejects.slice(-10).forEach(function(r) {
        lines.push('- 「' + r.originalTitle + '」→ 理由: ' + r.rejectReason);
      });
    }

    if (edits.length > 0) {
      lines.push('■ 修正されたパターン（より良いタスクの例）:');
      edits.slice(-10).forEach(function(r) {
        var parts = [];
        if (r.editedTitle && r.editedTitle !== r.originalTitle) {
          parts.push('タイトル: 「' + r.originalTitle + '」→「' + r.editedTitle + '」');
        }
        if (r.editedDesc && r.editedDesc !== r.originalDesc) {
          parts.push('説明: 「' + r.originalDesc + '」→「' + r.editedDesc + '」');
        }
        if (parts.length > 0) lines.push('- ' + parts.join(' / '));
      });
    }

    if (approves.length > 0) {
      lines.push('■ 承認されたパターン（良いTODOの例）:');
      approves.slice(-10).forEach(function(r) {
        lines.push('- 「' + r.originalTitle + '」: ' + r.originalDesc);
      });
    }

    return lines.join('\n');
  } catch(e) {
    return '';
  }
}

function itLlm_getNavSs_() {
  var id = PropertiesService.getScriptProperties().getProperty('NAVIGATOR_SPREADSHEET_ID');
  if (!id) throw new Error('NAVIGATOR_SPREADSHEET_ID未設定');
  return SpreadsheetApp.openById(id);
}

function itLlm_sheetToObjects_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    var any = false;
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
      if (data[i][j] !== '' && data[i][j] !== null) any = true;
    }
    if (any) result.push(obj);
  }
  return result;
}

function itLlm_jstNow_() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年M月d日 HH:mm');
}

function itLlm_distillFeedback_(projectId) {
  try {
    var sheet = itLlm_getNavSs_().getSheetByName('DB_TaskFeedback');
    if (!sheet || sheet.getLastRow() < 2) return;
    var rows = itLlm_sheetToObjects_(sheet).filter(function(r) {
      return String(r.projectId) === String(projectId);
    });
    if (rows.length === 0 || rows.length % 10 !== 0) return;

    var systemPrompt = itLlm_getDistillPrompt_();
    if (!systemPrompt) return;

    var lines = ['以下はこのプロジェクトのタスク提案に対する過去のフィードバック全件です。'];
    rows.forEach(function(r) {
      if (r.feedbackType === 'reject') {
        lines.push('【却下】「' + r.originalTitle + '」理由: ' + r.rejectReason);
      } else if (r.feedbackType === 'edit') {
        if (r.editedTitle) lines.push('【修正】タイトル「' + r.originalTitle + '」→「' + r.editedTitle + '」');
        if (r.editedDesc)  lines.push('【修正】説明「' + r.originalDesc + '」→「' + r.editedDesc + '」');
      } else if (r.feedbackType === 'approve') {
        lines.push('【承認】「' + r.originalTitle + '」: ' + r.originalDesc);
      }
    });

    var result = llm_call('task_feedback_summary', systemPrompt, lines.join('\n'), { maxTokens: 800 });
    if (!result) return;

    var contextId = 'task_feedback_' + projectId;
    var now = itLlm_jstNow_();
    itLlm_upsertContextRow_({
      contextId:   contextId,
      tags:        'task_extract,task_feedback_summary',
      status:      'active',
      scope:       'project',
      scopeKey:    projectId,
      systemPrompt: result,
      updatedAtJst: now
    });
  } catch(e) {
    Logger.log('itLlm_distillFeedback_ error: ' + e);
  }
}

function itLlm_getDistillPrompt_() {
  var res = tsukuyomi_listContextRows();
  var rows = (res && res.rows) ? res.rows : [];
  var row = rows.filter(function(r) {
    return String(r.tags || '').split(',').map(function(t) { return t.trim(); }).indexOf('task_feedback_summary') !== -1
      && r.status === 'active'
      && (!r.scope || r.scope === '');
  })[0];
  return row ? (row.systemPrompt || '') : '';
}

function itLlm_upsertContextRow_(payload) {
  var ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('MAIN_SPREADSHEET_ID')
  );
  var sheet = ss.getSheetByName('DB_TsukuyomiContext');
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var contextIdCol = headers.indexOf('contextId');
  if (contextIdCol < 0) return;

  var targetRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][contextIdCol]) === String(payload.contextId)) {
      targetRow = i + 1;
      break;
    }
  }

  var row = headers.map(function(h) {
    if (payload[h] !== undefined) return payload[h];
    if (targetRow > 0) return data[targetRow - 1][headers.indexOf(h)];
    return '';
  });

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}