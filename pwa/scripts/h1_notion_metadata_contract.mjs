const DEFAULT_LIMIT = 25;

export function resolveMinutesSchema(schemaProperties = {}, configuredMemberProperty = "") {
  const entries = Object.entries(schemaProperties);
  const find = (names, type) => {
    for (const name of names.filter(Boolean)) {
      const property = schemaProperties[name];
      if (property?.type === type) return { name, type };
    }
    return null;
  };
  const eventId = entries.find(([name, value]) => name === "eventId" && ["rich_text", "text"].includes(value?.type));
  const pj = find(["PJ"], "relation")
    || entries.filter(([name, value]) => value?.type === "relation" && name.includes("PJ"))
      .map(([name]) => ({ name, type: "relation" }))[0]
    || null;
  return {
    eventId: eventId ? { name: eventId[0], type: eventId[1].type } : null,
    pj,
    member: find([configuredMemberProperty, "メンバー", "参加メンバー"], "relation"),
    date: find(["日付"], "date"),
  };
}

export function boundBlankCandidates(pages, schema, limit = DEFAULT_LIMIT) {
  const safeLimit = Math.max(0, Math.min(DEFAULT_LIMIT, Number(limit) || DEFAULT_LIMIT));
  const candidates = pages.filter((page) => missingFields(page.properties || {}, schema).length > 0);
  return { candidates: candidates.slice(0, safeLimit), deferred: Math.max(0, candidates.length - safeLimit) };
}

export function buildBlankOnlyPatch({ properties = {}, schema, calendarEventId, meetingStartAt, pjPageId, memberPageIds = [] }) {
  const patch = {};
  const skipped = [];
  if (schema.eventId) {
    const current = textValue(properties[schema.eventId.name]);
    if (!current && calendarEventId) patch[schema.eventId.name] = richText(calendarEventId);
    else if (current && calendarEventId && current !== calendarEventId) skipped.push("notion_event_id_conflict");
    else if (!current) skipped.push("notion_event_id_unresolved");
  }
  if (schema.date) {
    const current = dateValue(properties[schema.date.name]);
    if (!current && meetingStartAt) patch[schema.date.name] = { date: { start: jstDate(meetingStartAt) } };
    else if (!current) skipped.push("notion_date_unresolved");
  }
  if (schema.pj) {
    const current = relationIds(properties[schema.pj.name]);
    if (current.length === 0 && pjPageId) patch[schema.pj.name] = { relation: [{ id: pjPageId }] };
    else if (current.length > 0 && pjPageId && !current.includes(pjPageId)) skipped.push("notion_pj_relation_conflict");
    else if (current.length === 0) skipped.push("notion_pj_relation_unresolved");
  }
  if (schema.member) {
    const current = relationIds(properties[schema.member.name]);
    const union = [...new Set([...current, ...memberPageIds.filter(Boolean)])];
    if (union.length > current.length) patch[schema.member.name] = { relation: union.map((id) => ({ id })) };
    else if (current.length === 0 && memberPageIds.length === 0) skipped.push("notion_member_relation_unresolved");
  }
  return { patch, skipped };
}

export function verifyReadback({ before = {}, after = {}, patch = {}, schema }) {
  const failed = [];
  for (const name of Object.keys(patch)) {
    if (name === schema.eventId?.name && textValue(after[name]) !== textValue(patch[name])) failed.push("eventId");
    if (name === schema.date?.name && dateValue(after[name]) !== dateValue(patch[name])) failed.push("date");
    if (name === schema.pj?.name && !sameSet(relationIds(after[name]), relationIds(patch[name]))) failed.push("PJ");
    if (name === schema.member?.name && !sameSet(relationIds(after[name]), relationIds(patch[name]))) failed.push("member");
  }
  return { ok: failed.length === 0, failed, changed: Object.keys(patch).length, before };
}

export function isJstScheduleHour(hour, weekday = 1) {
  const h = Number(hour);
  const day = Number(weekday);
  return Number.isInteger(h) && Number.isInteger(day) && day >= 1 && day <= 5 && h >= 9 && h <= 21;
}

function missingFields(properties, schema) {
  const missing = [];
  if (schema.eventId && !textValue(properties[schema.eventId.name])) missing.push("eventId");
  if (schema.pj && relationIds(properties[schema.pj.name]).length === 0) missing.push("PJ");
  if (schema.member && relationIds(properties[schema.member.name]).length === 0) missing.push("member");
  if (schema.date && !dateValue(properties[schema.date.name])) missing.push("date");
  return missing;
}

function richText(value) {
  return { rich_text: [{ type: "text", text: { content: value } }] };
}

function textValue(property) {
  const values = property?.rich_text || property?.text || [];
  return values.map((value) => value?.plain_text || value?.text?.content || "").join("").trim();
}

function dateValue(property) {
  return property?.date?.start || "";
}

function relationIds(property) {
  return (property?.relation || []).map((value) => value?.id).filter(Boolean);
}

function jstDate(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value)).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function sameSet(left, right) {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}
