// PoW 免费层：纯 CPU 工具用工作量证明换取免费调用（抄 Agent402 的引流机制）
// 流程：GET /pow/challenge → 客户端找 nonce 使 sha256(challenge:nonce) 前缀为 0 → 带 X-PoW 调用免费端点
import crypto from "node:crypto";

const DIFFICULTY = 3; // 前 4 个十六进制 0（约 65,536 次哈希）
const TTL_MS = 5 * 60 * 1000;
const challenges = new Map(); // challenge -> { created, used }

// 免费端点（纯 CPU，无外部依赖）
export const FREE_PATHS = new Set([
  "/x402/time", "/x402/uuid", "/x402/random", "/x402/echo", "/x402/hash",
  "/x402/keccak", "/x402/base64", "/x402/slug", "/x402/wordcount",
  "/x402/ping", "/x402/status", "/x402/network", "/x402/payment", "/x402/quote",
  "/text/wordcount", "/selector",
]);

export function issueChallenge() {
  const c = crypto.randomBytes(16).toString("hex");
  challenges.set(c, { created: Date.now(), used: false });
  // 清理过期
  for (const [k, v] of challenges) if (Date.now() - v.created > TTL_MS) challenges.delete(k);
  return { challenge: c, difficulty: DIFFICULTY, difficultyBits: DIFFICULTY * 4, note: "12 bits ~ 4,096 hashes (agent402 uses 16 bits ~ 65,536): 16x faster to solve", expiresInSec: Math.floor(TTL_MS / 1000), algorithm: "sha256(challenge + ':' + nonce) must start with N hex zeros" };
}

export function verifyPow(header) {
  if (!header || typeof header !== "string") return { ok: false, reason: "missing_pow" };
  const [challenge, nonce] = header.split(":");
  if (!challenge || !nonce) return { ok: false, reason: "bad_format" };
  const rec = challenges.get(challenge);
  if (!rec) return { ok: false, reason: "unknown_challenge" };
  if (Date.now() - rec.created > TTL_MS) return { ok: false, reason: "expired" };
  if (rec.used) return { ok: false, reason: "already_used" };
  const h = crypto.createHash("sha256").update(challenge + ":" + nonce).digest("hex");
  if (!h.startsWith("0".repeat(DIFFICULTY))) return { ok: false, reason: "insufficient_work" };
  rec.used = true; // 一次性
  return { ok: true, hash: h.slice(0, 12) };
}

// Express 中间件：免费路径 + 有效 PoW → 放行（跳过付费）
export function powFreeMiddleware(req, res, next) {
  const path = req.path;
  if (!FREE_PATHS.has(path)) return next();
  const pow = req.headers["x-pow"];
  const v = verifyPow(pow);
  if (v.ok) {
    req.powBypass = true;
    return next();
  }
  // 无 PoW 或无效 → 继续走付费流程（402）
  return next();
}

export const POW_PATHS = {
  "/pow/challenge": {
    get: {
      summary: "Get a proof-of-work challenge to call CPU-only endpoints for free",
      security: [],
      responses: { "200": { description: "challenge + difficulty" } },
    },
  },
};
