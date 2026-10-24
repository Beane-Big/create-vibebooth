#!/usr/bin/env node
// 生成一个 Vibebooth 模块：npx github:Beane-Big/create-vibebooth <模块 id>
// 生成以后脚手架就不再参与，规则由平台安装器在打包和安装时检查。
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { backends, frontends, generate, validate } from "./lib/generate.mjs";

// 自己排队读行，而不用 rl.question：输入是管道时，提问之前就到达的行不会丢。
const rl = createInterface({ input: process.stdin });
const lines = [];
let waiting = null;
let closed = false;
rl.on("line", (line) => (waiting ? (waiting(line), (waiting = null)) : lines.push(line)));
rl.on("close", () => {
  closed = true;
  waiting?.(null);
});

async function ask(question, fallback = "") {
  process.stdout.write(fallback ? `${question}（默认 ${fallback}）：` : `${question}：`);
  const line = lines.length ? lines.shift() : closed ? null : await new Promise((r) => (waiting = r));
  if (line === null) throw new Error("输入已结束");
  if (!process.stdin.isTTY) process.stdout.write(line + "\n");
  return line.trim() || fallback;
}

async function choose(question, options, fallback) {
  const keys = Object.keys(options);
  console.log(question);
  keys.forEach((k, i) => console.log(`  ${i + 1}. ${options[k]}`));
  for (;;) {
    const answer = await ask("选一个编号", String(keys.indexOf(fallback) + 1));
    const key = keys[Number(answer) - 1];
    if (key) return key;
    console.log("请输入列表里的编号");
  }
}

async function main() {
  console.log("创建一个 Vibebooth 模块\n");
  let id = process.argv[2] ?? "";
  while (validate({ id, name: "x", frontend: "static", backend: "none" })) {
    if (id) console.log(validate({ id, name: "x", frontend: "static", backend: "none" }));
    id = await ask("模块 id（小写字母开头，例如 ledger）");
  }
  const name = await ask("显示名称", id);
  const description = await ask("一句话说明", "");
  const frontend = await choose("\n前端用什么？", frontends, "react");
  // 前端和后端至少要有一个，不要前端时后端只能选 Go。
  const backend = frontend === "none" ? "go" : await choose("\n后端用什么？", backends, "go");
  const data = backend !== "none" && (await ask("\n需要保存数据吗？会预置 SQLite（y/n）", "y")).toLowerCase().startsWith("y");
  rl.close();

  const opts = { id, name, description, frontend, backend, data };
  const err = validate(opts);
  if (err) throw new Error(err);
  const dir = resolve(process.cwd(), `vibebooth-module-${id}`);
  generate(dir, opts);
  console.log(`\n已生成 ${dir}`);

  // 下面几步失败不影响已经生成的文件，只提示怎么补做。
  const step = (label, cmd, args, cwd = dir) => {
    console.log(`\n${label}…`);
    // Windows 上的 npm 是 npm.cmd，要经过 shell 才能运行。
    const res = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" && cmd === "npm" });
    if (res.status !== 0) console.log(`（${label}没有成功，稍后可以在模块目录里重新运行 ${cmd} ${args.join(" ")}）`);
    return res.status === 0;
  };
  step("初始化 git 仓库", "git", ["init", "-q", "-b", "main"]);
  if (frontend === "react" || frontend === "vue") step("安装前端依赖", "npm", ["install", "--no-audit", "--no-fund"], resolve(dir, "frontend"));

  console.log(`
完成。接下来：
  cd vibebooth-module-${id}
  npm run pack:source     生成源码包，上传到平台的“构建器”，在服务器上构建（推荐，不要 Docker）
  npm run pack            在本机构建出要上传到“应用管理”页的 zip（要 Docker）
  npm run install:local   装到本机平台，然后打开 http://localhost:8080（要 Docker 和本机平台）

开发规范见 AGENTS.md；用 AI 编码工具时，让它先读这个文件。`);
}

main().catch((err) => {
  rl.close();
  console.error("错误: " + err.message);
  process.exit(1);
});
