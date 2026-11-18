import http from "node:http";
import { app } from "./app.mjs";

const PORT = 19000;
const ready = new Promise((resolve) => app.listen(PORT, "127.0.0.1", resolve));

function decodeEvent(event) {
  if (Buffer.isBuffer(event)) return JSON.parse(event.toString("utf8"));
  if (event && typeof event === "object" && event.type === "Buffer" && Array.isArray(event.data)) {
    return JSON.parse(Buffer.from(event.data).toString("utf8"));
  }
  return event;
}

export const handler = async (event, context) => {
  await ready;
  const ev = decodeEvent(event) || {};
  const rc = ev.requestContext || {};
  const httpCtx = rc.http || {};
  const method = httpCtx.method || ev.httpMethod || "GET";
  const path = ev.rawPath || httpCtx.path || ev.path || "/";
  const params = ev.queryParameters || ev.queryStringParameters || {};
  const qs = new URLSearchParams(params).toString();
  const headers = { ...(ev.headers || {}) };
  const fwdHost = headers["x-forwarded-host"] || headers["X-Forwarded-Host"] || "";
  const origHost = fwdHost || headers.Host || headers.host || rc.domainName || "";
  if (origHost) headers.host = origHost;
  headers["x-forwarded-host"] = origHost;
  headers["x-forwarded-proto"] = "https";
  const bodyRaw = ev.isBase64Encoded && ev.body ? Buffer.from(ev.body, "base64") : Buffer.from(ev.body || "");

  return new Promise((resolve) => {
    const req = http.request(
      { host: "127.0.0.1", port: PORT, method, path: qs ? `${path}?${qs}` : path, headers },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 502,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("base64"),
            isBase64Encoded: true,
          });
        });
      },
    );
    req.on("error", (e) => {
      resolve({ statusCode: 502, headers: { "content-type": "text/plain" }, body: `upstream: ${e.message}` });
    });
    if (bodyRaw.length) req.write(bodyRaw);
    req.end();
  });
};
