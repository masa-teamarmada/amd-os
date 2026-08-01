const MAX_FORM_BODY_BYTES = 8 * 1024;
const MAX_JSON_BODY_BYTES = 16 * 1024;

function assertObjectBodyWithinLimit(body, maxBytes) {
  const size = Buffer.byteLength(JSON.stringify(body), "utf8");
  if (size > maxBytes) throw new Error("request body too large");
}

async function readRawBody(req, maxBytes) {
  const body = req.body;
  if (Buffer.isBuffer(body)) {
    if (body.length > maxBytes) throw new Error("request body too large");
    return body.toString("utf8");
  }
  if (typeof body === "string") {
    if (Buffer.byteLength(body, "utf8") > maxBytes) throw new Error("request body too large");
    return body;
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error("request body too large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function credentialsFromParams(params) {
  return {
    email: params.get("email") ?? "",
    password: params.get("password") ?? "",
  };
}

export async function readFormCredentials(req) {
  const body = req.body;

  if (body instanceof URLSearchParams) {
    assertObjectBodyWithinLimit(Object.fromEntries(body), MAX_FORM_BODY_BYTES);
    return credentialsFromParams(body);
  }
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) {
    assertObjectBodyWithinLimit(body, MAX_FORM_BODY_BYTES);
    return {
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : "",
    };
  }

  const raw = await readRawBody(req, MAX_FORM_BODY_BYTES);
  return credentialsFromParams(new URLSearchParams(raw));
}

export async function readJsonBody(req) {
  const body = req.body;
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) {
    assertObjectBodyWithinLimit(body, MAX_JSON_BODY_BYTES);
    return body;
  }

  const raw = await readRawBody(req, MAX_JSON_BODY_BYTES);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("invalid JSON body");
  }
}
