/** 089_ValueContributionAi.gs
 * AIで 進捗イベント -> milestone 貢献を算出する
 */

function reward_runContributionAi(payload){
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var ym = String(payload.ym || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ym) return { ok:false, message:"ym empty" };

  vcEnsureSchema();

  // ValuePlan fixed（年間マイルストーン）
  var vp = charter_valuePlan_loadLatestFixedByProject(projectId);
  if (!vp || !vp.planCycleId || !vp.version) {
    return { ok:false, message:"valuePlan fixed not found" };
  }

  var planCycleId = String(vp.planCycleId||"").trim();
  var version = Number(vp.version||0);
  var milestones = Array.isArray(vp.milestones) ? vp.milestones : [];
  if (!milestones.length){
    return { ok:false, message:"milestones empty" };
  }

  // 今月の進捗イベント（confirmed のみ対象）
  var events = reward_repo_listEvents_(projectId, ym);
  var confirmedEvents = events.filter(function(e){
    return String(e.status||"").trim() === "confirmed";
  });

  if (!confirmedEvents.length){
    return { ok:true, message:"no confirmed events", planCycleId:planCycleId, version:version, consumedPoints:0, contributions:[] };
  }

  // AI入力データを最小化
  var msInput = milestones.map(function(m){
    var title = String(m.title||"").trim();
    var orderNo = Number(m.orderNo||0);
    var points = Number(m.points||0);
    var isBuffer = /\(buffer\)/i.test(title);
    return { orderNo:orderNo, title:title, points:points, isBuffer:isBuffer };
  });

  var evInput = confirmedEvents.map(function(e){
    return {
      eventId: String(e.eventId||"").trim(),
      description: String(e.eventDescription||e.description||"").trim(),
      impact: Number(e.impact||0),
      depth: Number(e.depth||0),
      eventValue: Number(e.impact||0) * Number(e.depth||0)
    };
  });

  var promptVersion = "v2_event";
  var prompt = buildValueContributionPrompt_v2({
    projectId:projectId, ym:ym,
    planCycleId:planCycleId, version:version,
    milestones: msInput,
    events: evInput
  });

  var schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      contributions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            eventId: { type: "string" },
            links: {
              type: "array",
              maxItems: 2,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  milestoneOrderNo: { type: "integer" },
                  contribPoints: { type: "integer", minimum: 0, maximum: 5 },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  rationale: { type: "string" }
                },
                required: ["milestoneOrderNo","contribPoints","confidence","rationale"]
              }
            }
          },
          required: ["eventId","links"]
        }
      }
    },
    required: ["contributions"]
  };

  var ai = openaiResponsesJsonSchema(prompt, schema);
  var list = Array.isArray(ai && ai.contributions) ? ai.contributions : [];

  var msByOrder = {};
  msInput.forEach(function(m){ msByOrder[Number(m.orderNo||0)] = m; });

  // 既存消化済みpt
  var existing = vcListByProjectYm(projectId, ym);
  var consumedByKey = {};
  existing.forEach(function(r){
    var k = String(r.milestoneKey||"").trim();
    if (!k) return;
    consumedByKey[k] = (consumedByKey[k]||0) + Number(r.contribPoints||0);
  });

  var modelName = openaiGetModelName();
  var upserts = [];

  for (var ci = 0; ci < list.length; ci++){
    var c = list[ci];
    var eventId = String(c.eventId||"").trim();
    if (!eventId) continue;

    var ev = evInput.filter(function(x){ return x.eventId === eventId; })[0];
    if (!ev) continue;

    var links = Array.isArray(c.links) ? c.links : [];
    for (var li = 0; li < Math.min(links.length, 2); li++){
      var ln = links[li];
      var orderNo = Number(ln.milestoneOrderNo||0);
      var ms = msByOrder[orderNo];
      if (!ms) continue;

      var milestoneKey = planCycleId + ":" + String(version) + ":" + String(orderNo);
      var uniqueKey = projectId + ":" + ym + ":" + milestoneKey + ":" + eventId;

      var already = Number(consumedByKey[milestoneKey]||0);
      var remain = Math.max(0, Number(ms.points||0) - already);

      var pts = Number(ln.contribPoints||0);
      if (!Number.isFinite(pts)) pts = 0;
      if (ms.isBuffer && pts > 1) pts = 1;
      pts = Math.max(0, Math.min(pts, remain));
      if (!pts) continue;

      consumedByKey[milestoneKey] = already + pts;

      var conf = Number(ln.confidence||0);
      if (!Number.isFinite(conf)) conf = 0;

      upserts.push({
        contributionId: "VC-" + Utilities.getUuid(),
        uniqueKey: uniqueKey,
        projectId: projectId,
        ym: ym,
        planCycleId: planCycleId,
        version: version,
        milestoneKey: milestoneKey,
        milestoneOrderNo: orderNo,
        milestoneTitle: ms.title,
        eventId: eventId,
        eventDescription: ev.description,
        contribPoints: pts,
        confidence: conf,
        method: "ai",
        rationale: String(ln.rationale||"").trim(),
        modelName: modelName,
        promptVersion: promptVersion
      });
    }
  }

  var saveRes = vcUpsertMany(upserts);

  var after = vcListByProjectYm(projectId, ym);
  var byMs = {};
  var consumedPoints = 0;
  after.forEach(function(r){
    consumedPoints += Number(r.contribPoints||0);
    var k = String(r.milestoneKey||"").trim();
    if (!k) return;
    if (!byMs[k]) byMs[k] = { milestoneKey:k, orderNo:r.milestoneOrderNo, title:r.milestoneTitle, points:0 };
    byMs[k].points += Number(r.contribPoints||0);
  });

  var byMilestone = Object.keys(byMs).map(function(k){ return byMs[k]; }).sort(function(a,b){ return (a.orderNo||0)-(b.orderNo||0); });

  return {
    ok:true,
    message:"",
    projectId:projectId,
    ym:ym,
    planCycleId:planCycleId,
    version:version,
    saved: saveRes,
    consumedPoints:consumedPoints,
    byMilestone:byMilestone,
    contributions: after
  };
}

function buildValueContributionPrompt_v2(input){
  var projectId = String(input.projectId||"").trim();
  var ym = String(input.ym||"").trim();
  var planCycleId = String(input.planCycleId||"").trim();
  var version = Number(input.version||0);
  var milestones = Array.isArray(input.milestones) ? input.milestones : [];
  var events = Array.isArray(input.events) ? input.events : [];

  var lines = [];
  lines.push("あなたはAMDの価値会計アシスタント。目的は『今月確定した進捗イベントが、年間価値マイルストーンにどれだけ貢献したか』を説明可能な形で割り当てること。");
  lines.push("");
  lines.push("制約:");
  lines.push("- 各イベントは最大2つのマイルストーンにだけ紐づける");
  lines.push("- contribPoints は整数 0〜5。基本は 1〜3 を使い、強い貢献だけ 4〜5");
  lines.push("- bufferマイルストーン（isBuffer=true）には原則 0〜1 に抑える");
  lines.push("- イベントの eventValue（= impact × depth）が高いほど大きいcontribPointsを与えてよい");
  lines.push("- 不確実な推測を避け、根拠が薄い場合は confidence を下げて contribPoints も控える");
  lines.push("- 出力は指定JSONスキーマに厳密準拠。余計なキーを出さない");
  lines.push("");
  lines.push("コンテキスト:");
  lines.push("- projectId: " + projectId);
  lines.push("- ym: " + ym);
  lines.push("- planCycleId: " + planCycleId);
  lines.push("- version: " + version);
  lines.push("");
  lines.push("マイルストーン一覧（orderNo, title, points, isBuffer）:");
  lines.push(JSON.stringify(milestones));
  lines.push("");
  lines.push("今月の確定済み進捗イベント（eventId, description, impact, depth, eventValue）:");
  lines.push(JSON.stringify(events));
  lines.push("");
  lines.push("割当方針:");
  lines.push("- description とマイルストーン title の意味的近さで選ぶ");
  lines.push("- eventValue が高いイベントは大きい contribPoints を与えてよいが、マイルストーンの残りpointsを超えない");
  lines.push("- 1つ目を主、2つ目は補助（ある場合）");
  lines.push("- rationale は1〜2行で『なぜそのマイルストーンか』を具体語で書く");
  lines.push("");
  lines.push("出力:");

  return lines.join("\n");
}

/** テスト用 */
function TEST_reward_runContributionAi() {
  var result = reward_runContributionAi({
    projectId: "p21",
    ym: "202601"
  });
  Logger.log(JSON.stringify(result, null, 2));
}