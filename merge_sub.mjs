// 合并订阅层
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes("SUB_ROUTES")) { console.log("already"); process.exit(0); }

s = s.replace(
  'import { GPT_ROUTES, GPT_PATHS, handleGpt, GPT_MODELS } from "./gpt-upstream.mjs";',
  'import { GPT_ROUTES, GPT_PATHS, handleGpt, GPT_MODELS } from "./gpt-upstream.mjs";\nimport { SUB_ROUTES, SUB_PATHS, subHandler, makeSubMiddleware, SUB_COVERED_PREFIXES } from "./subscription.mjs";',
);

// 早期订阅中间件（在 powFreeMiddleware 之后、所有 paymentMiddleware 之前）
const subHandlers = `
// 订阅 handler 映射（skill packs + bsc 独占）
const SUB_HANDLERS = Object.fromEntries([
  ...SKILLS.map((ep) => [ep.path, ep.handler]),
  ...SKILLS2.map((ep) => [ep.path, ep.handler]),
  ...BSC_EXCLUSIVE.map((ep) => [ep.path, ep.handler]),
]);
app.use(makeSubMiddleware(SUB_HANDLERS));

// /sub/daily（$1，24h unlimited）
app.use(paymentMiddleware(SUB_ROUTES, resourceServer));
app.get("/sub/daily", subHandler);
`;
s = s.replace(
  "app.use(powFreeMiddleware);",
  "app.use(powFreeMiddleware);\n" + subHandlers,
);
s = s.replace(
  "...BSC_EXCLUSIVE_PATHS, ...CLAUDE_PATHS, ...GPT_PATHS,",
  "...BSC_EXCLUSIVE_PATHS, ...CLAUDE_PATHS, ...GPT_PATHS, ...SUB_PATHS,",
);
fs.writeFileSync("app.mjs", s, "utf8");
console.log("merged:", s.includes("SUB_ROUTES"), s.includes("makeSubMiddleware"));
