// 在已经生成的模块里升一级：npx github:Beane-Big/create-vibebooth add <backend | data | permissions | persons>
// 只加文件；脚手架生成后没改过的文件才会重写，改过的就打印要手工加的内容，不覆盖。
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { composeYaml, copy, fill, fillText, levels, templates, templateVars } from "./generate.mjs";

export const features = {
  backend: "加 Go 后端（第 2 级：认人）",
  data: "给后端加 SQLite 和数据卷",
  permissions: "加功能权限示例（第 3 级：分权）",
  persons: "读取平台的家庭成员（第 4 级：用平台数据）",
};

const permissionsBlock = [
  "permissions:             # 功能权限；管理员在门户“用户”页按人开关，后端用 Has(\"<id>\") 检查",
  '  - {id: edit, name: "编辑", description: "示例：换成你自己的功能", default: [user]}',
].join("\n");

// add 在 dir 里加上 feature，返回做了什么和要手工做什么。出错时抛出异常，什么都不改。
export function add(dir, feature) {
  if (!(feature in features)) throw new Error("能加的有：" + Object.keys(features).join("、"));
  const m = readModule(dir);
  const done = [];
  const manual = [];
  const vars = (data) => templateVars({ ...m, hasBackend: true, data });
  const path = (...p) => join(dir, ...p);
  const read = (...p) => readFileSync(path(...p), "utf8");
  const write = (rel, text) => {
    writeFileSync(path(rel), text);
    done.push(`写入 ${rel}`);
  };
  const writeNew = (rel, text) => (existsSync(path(rel)) ? manual.push(`${rel} 已经存在，没有覆盖`) : write(rel, text));
  // fromTemplate 读一个模板文件并替换占位符。
  const fromTemplate = (rel, data = m.hasData) => fillText(readFileSync(join(templates, rel), "utf8"), vars(data));
  const needBackend = () => {
    if (!m.hasBackend) throw new Error("这个模块还没有后端，先运行 add backend");
  };
  const needRoutes = (file) => {
    if (!read("backend", "main.go").includes("range routes")) {
      manual.push(`backend/main.go 是旧版脚手架生成的，没有 routes：把 backend/${file} 里 init 注册的接口挂到 main.go 的 api 上`);
    }
  };

  if (feature === "backend") {
    if (m.hasBackend) throw new Error("已经有后端了");
    copy("backend-go", path("backend"));
    copy("backend-go-basic", path("backend"));
    fill(path("backend"), vars(false));
    done.push("生成 backend/");
    const line = `  backend: {port: 8000}  # 容器 ${m.id}-backend → /api/${m.id}/，健康检查 /api/${m.id}/health`;
    const manifest = read("module.yaml");
    if (/^ {2}frontend:.*$/m.test(manifest)) write("module.yaml", manifest.replace(/^ {2}frontend:.*$/m, (fe) => `${fe}\n${line}`));
    else manual.push(`module.yaml 的 services 里加一行：\n${line}`);
    regenerate(dir, "compose.yaml", composeYaml(m.id, true, false, false), composeYaml(m.id, true, true, false), done, manual);
    setFlag(m, dir, "hasBackend", done, manual);
    setLevel(dir, 2, done, manual);
  }

  if (feature === "data") {
    needBackend();
    if (m.hasData) throw new Error("已经有数据了");
    write("backend/store.go", fromTemplate("backend-go-data/store.go", true));
    if (read("backend", "main.go") === fromTemplate("backend-go-basic/main.go", false)) {
      write("backend/main.go", fromTemplate("backend-go-data/main.go", true));
    } else {
      manual.push("backend/main.go 改过了，没有重写：参考脚手架模板 backend-go-data/main.go，在 main 里用 OpenStore 打开数据库");
    }
    regenerate(dir, "compose.yaml", composeYaml(m.id, m.hasFrontend, true, false), composeYaml(m.id, m.hasFrontend, true, true), done, manual);
    if (m.hasFrontend) setFlag(m, dir, "hasData", done, manual);
  }

  if (feature === "permissions") {
    needBackend();
    const manifest = read("module.yaml");
    if (/^permissions:/m.test(manifest)) {
      manual.push("module.yaml 里已经有 permissions，没有改");
    } else if (/^# permissions:.*$/m.test(manifest)) {
      write("module.yaml", manifest.replace(/^# permissions:.*$/m, permissionsBlock));
    } else if (/^#? ?requires:/m.test(manifest)) {
      write("module.yaml", manifest.replace(/^#? ?requires:/m, (r) => `${permissionsBlock}\n${r}`));
    } else {
      write("module.yaml", manifest.replace(/\n*$/, "\n") + permissionsBlock + "\n");
    }
    writeNew("backend/permissions_example.go", fromTemplate("add-permissions/permissions_example.go"));
    needRoutes("permissions_example.go");
    if (m.hasFrontend) manual.push('前端按权限隐藏按钮：const me = await getMe(); 然后用 can(me, "edit") 判断（在 platform 文件里）');
    setLevel(dir, 3, done, manual);
  }

  if (feature === "persons") {
    needBackend();
    writeNew("backend/persons.go", fromTemplate("add-persons/persons.go"));
    needRoutes("persons.go");
    if (m.hasFrontend) manual.push(`前端用 GET /api/${m.id}/persons 取人员，显示 displayName（每个人看到的是自己写的备注）`);
    setLevel(dir, 4, done, manual);
  }

  return { done, manual };
}

// readModule 从 module.yaml 和目录结构认出模块现在的样子。
function readModule(dir) {
  const file = join(dir, "module.yaml");
  if (!existsSync(file)) throw new Error("当前目录没有 module.yaml，请在模块目录里运行");
  const text = readFileSync(file, "utf8");
  const id = text.match(/^id:\s*([^\s#]+)/m)?.[1];
  if (!id) throw new Error("module.yaml 里缺少 id");
  const frontend = join(dir, "frontend");
  const config = [join(frontend, "src", "config.ts"), join(frontend, "public", "config.js")].find(existsSync);
  return {
    id,
    name: text.match(/^name:\s*"([^"]*)"/m)?.[1] ?? id,
    description: text.match(/^description:\s*"([^"]*)"/m)?.[1] ?? "",
    hasFrontend: existsSync(frontend),
    hasBackend: existsSync(join(dir, "backend", "main.go")),
    hasData: existsSync(join(dir, "backend", "store.go")),
    config,
  };
}

// regenerate 在文件还是脚手架生成的样子（等于 before）时改写成 after，否则把 after 打印出来让人对照着改。
function regenerate(dir, rel, before, after, done, manual) {
  const path = join(dir, rel);
  if (readFileSync(path, "utf8") === before) {
    writeFileSync(path, after);
    done.push(`写入 ${rel}`);
  } else {
    manual.push(`${rel} 改过了，没有重写，对照下面的内容手工改：\n${after}`);
  }
}

// setFlag 把前端 config 里的 hasBackend 或 hasData 改成 true。
function setFlag(m, dir, flag, done, manual) {
  const pattern = new RegExp(`(\\b${flag}\\b[^=\\n]*=\\s*)false`);
  const text = m.config && readFileSync(m.config, "utf8");
  if (text && pattern.test(text)) {
    writeFileSync(m.config, text.replace(pattern, "$1true"));
    done.push(`前端 config 里的 ${flag} 改成 true`);
  } else if (m.hasFrontend) {
    manual.push(`把前端 config 里的 ${flag} 改成 true`);
  }
}

// setLevel 把 AGENTS.md 里的“当前等级”升到 level，已经更高时不变。
function setLevel(dir, level, done, manual) {
  const path = join(dir, "AGENTS.md");
  const text = existsSync(path) ? readFileSync(path, "utf8") : "";
  const current = text.match(/^当前等级：(\d)/m);
  if (!current) {
    manual.push(`AGENTS.md 里没有“当前等级”，手工写明模块现在是第 ${level} 级`);
    return;
  }
  if (Number(current[1]) >= level) return;
  writeFileSync(path, text.replace(/^当前等级：.*$/m, `当前等级：${levels[level]}`));
  done.push(`AGENTS.md 的当前等级改成 ${levels[level]}`);
}
