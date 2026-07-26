import { Readable } from "node:stream";

export function makeReq({ method = "GET", url = "/", headers = {}, body } = {}) {
  const stream = new Readable({
    read() {
      if (body !== undefined) {
        this.push(typeof body === "string" ? body : JSON.stringify(body));
      }
      this.push(null);
    },
  });
  stream.method = method;
  stream.url = url;
  stream.headers = { host: "zmp.example.com", ...headers };
  if (body !== undefined) {
    stream.body = body;
  }
  return stream;
}

export function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(key, value) {
      res.headers[key] = value;
    },
    getHeader(key) {
      return res.headers[key];
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(payload) {
      res.body = payload;
      return res;
    },
  };
  return res;
}
