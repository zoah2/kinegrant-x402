// 降低 PoW 难度：4 hex（16 bits）→ 3 hex（12 bits），比 agent402 快 16 倍
import fs from "node:fs";

let s = fs.readFileSync("pow.mjs", "utf8");
s = s.replace("const DIFFICULTY = 4;", "const DIFFICULTY = 3;");
s = s.replace(
  'return { challenge: c, difficulty: DIFFICULTY,',
  'return { challenge: c, difficulty: DIFFICULTY, difficultyBits: DIFFICULTY * 4, note: "12 bits ~ 4,096 hashes (agent402 uses 16 bits ~ 65,536): 16x faster to solve",',
);
fs.writeFileSync("pow.mjs", s, "utf8");
console.log("difficulty:", s.includes("const DIFFICULTY = 3;"));
console.log("note added:", s.includes("16x faster"));
