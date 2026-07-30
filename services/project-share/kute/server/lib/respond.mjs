export function sendJson(res, status, obj) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(obj));
}

export function sendHtml(res, status, html) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(status).send(html);
}

export function sendText(res, status, text) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.status(status).send(text);
}
