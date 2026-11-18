// 合并 OpenAI 兼容端点 + 加 express.json
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes("OPENAI_ROUTES")) {
  console.log("already merged");
  process.exit(0);
}

// 1. import
s = s.replace(
  'import { AI_ENDPOINTS, AI_ROUTES, AI_PATHS } from "./ai-proxy.mjs";',
  'import { AI_ENDPOINTS, AI_ROUTES, AI_PATHS } from "./ai-proxy.mjs";\nimport { OPENAI_ROUTES, OPENAI_PATHS, handleChatCompletions, handleModels } from "./openai-compat.mjs";',
);

// 2. express.json() 放在第一个 paymentMiddleware 之前
s = s.replace(
  "const app = express();\napp.set(\"trust proxy\", true);",
  "const app = express();\napp.set(\"trust proxy\", true);\napp.use(express.json({ limit: \"64kb\" }));",
);

// 3. 注册 OpenAI 路由（在 TOOLS 之后、openapi.json 之前）
s = s.replace(
  "app.use(paymentMiddleware(TOOLS_ROUTES, resourceServer));",
  "app.use(paymentMiddleware(OPENAI_ROUTES, resourceServer));\napp.post(\"/v1/chat/completions\", handleChatCompletions);\napp.get(\"/v1/models\", handleModels);\n\napp.use(paymentMiddleware(TOOLS_ROUTES, resourceServer));",
);

// 4. openapi 合并
s = s.replace(
  "...EXTENDED_PATHS, ...TOOLS_PATHS, ...AI_PATHS },",
  "...EXTENDED_PATHS, ...TOOLS_PATHS, ...AI_PATHS, ...OPENAI_PATHS },",
);

fs.writeFileSync("app.mjs", s, "utf8");
console.log("merged:", s.includes("OPENAI_ROUTES"), s.includes("express.json"), s.includes("OPENAI_PATHS"));
