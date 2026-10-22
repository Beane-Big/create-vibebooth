// 按选项把模板拼成一个模块目录。只做文件操作，不联网，方便测试。
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const templates = resolve(import.meta.dirname, "..", "templates");

// 生成的模块依赖的 SDK 版本，对应平台仓库的标签 packages/sdk-go/<版本>。
export const sdkVersion = "v0.1.0";

// 和平台 packages/manifest 的规则保持一致。
const idPattern = /^[a-z][a-z0-9-]{1,30}$/;
// 名称和说明会原样写进 YAML、HTML 和代码模板，这些字符会破坏其中某一种。
const unsafe = /[<>{}$`"\\\n]/;
const reservedIDs = new Set(["platform", "core", "portal", "traefik", "postgres", "socket", "installer"]);

export const frontends = { react: "React + TypeScript", vue: "Vue 3 + TypeScript", static: "纯静态页面", none: "不要前端" };
export const backends = { go: "Go", none: "不要后端" };

// validate 返回选项里的错误，没有错误时返回空字符串。
export function validate({ id, name, frontend, backend, data }) {
  if (!idPattern.test(id) || reservedIDs.has(id)) {
    return "模块 id 只能是小写字母开头的小写字母、数字和连字符（2 到 31 个字符），且不能是 " + [...reservedIDs].join("、");
  }
  if (!name?.trim()) return "名称不能为空";
  if (unsafe.test(name)) return "名称里不能有 < > { } $ ` 引号、反斜杠或换行";
  if (!(frontend in frontends)) return "前端只能是 " + Object.keys(frontends).join("、");
  if (!(backend in backends)) return "后端只能是 " + Object.keys(backends).join("、");
  if (frontend === "none" && backend === "none") return "前端和后端至少要有一个";
  if (data && backend === "none") return "存数据需要后端";
  return "";
}

// generate 在 dir 下生成模块，dir 必须不存在或为空。
export function generate(dir, opts) {
  const err = validate(opts);
  if (err) throw new Error(err);
  if (existsSync(dir) && readdirSync(dir).length > 0) throw new Error(`${dir} 已经存在且不为空`);
  const { id, frontend, backend, data } = opts;
  const name = opts.name.trim();
  const description = (opts.description ?? "").replace(new RegExp(unsafe, "g"), " ").trim() || `${name}，一个 Vibebooth 模块`;
  const vars = {
    __ID__: id,
    __NAME__: name,
    __DESCRIPTION__: description,
    __SDK_VERSION__: sdkVersion,
    __HAS_BACKEND__: String(backend !== "none"),
    __HAS_DATA__: String(Boolean(data)),
  };

  mkdirSync(dir, { recursive: true });
  copy("common", dir);
  if (frontend !== "none") {
    const fe = join(dir, "frontend");
    copy(`frontend-${frontend}`, fe);
    const styles = frontend === "static" ? join(fe, "public", "styles.css") : join(fe, "src", "styles.css");
    cpSync(join(templates, "shared", "styles.css"), styles);
  }
  if (backend === "go") {
    const be = join(dir, "backend");
    copy("backend-go", be);
    copy(data ? "backend-go-data" : "backend-go-basic", be);
  }
  writeFileSync(join(dir, "module.yaml"), moduleYaml(id, name, description, frontend !== "none", backend !== "none"));
  writeFileSync(join(dir, "compose.yaml"), composeYaml(id, frontend !== "none", backend !== "none", data));
  fill(dir, vars);
}

function copy(template, to) {
  cpSync(join(templates, template), to, { recursive: true });
}

// fill 替换所有文件里的占位符，并把 _gitignore 改名为 .gitignore（npm 发布时会丢掉 .gitignore）。
function fill(dir, vars) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      fill(path, vars);
      continue;
    }
    let text = readFileSync(path, "utf8");
    for (const [k, v] of Object.entries(vars)) text = text.replaceAll(k, v);
    writeFileSync(path, text);
    if (entry === "_gitignore") renameSync(path, join(dir, ".gitignore"));
  }
}

function moduleYaml(id, name, description, hasFrontend, hasBackend) {
  const lines = [
    "# 模块清单：平台靠它认识这个模块，规则见 https://github.com/Beane-Big/vibebooth/blob/main/docs/module-spec.md",
    "platform: 1              # 遵循的模块规范版本",
    `id: ${id}${" ".repeat(Math.max(1, 21 - id.length))}# 全局唯一，也是网址前缀 /apps/${id}/ 和 /api/${id}/`,
    `name: "${name}"`,
    `description: "${description}"`,
    "icon: icon.svg",
    "version: 0.1.0           # 发布新版本前改大",
    "services:                # 哪个容器接哪个网址前缀，安装器据此生成网关路由",
  ];
  if (hasFrontend) lines.push(`  frontend: {port: 80}   # 容器 ${id}-frontend → /apps/${id}/`);
  if (hasBackend) lines.push(`  backend: {port: 8000}  # 容器 ${id}-backend → /api/${id}/，健康检查 /api/${id}/health`);
  if (hasFrontend) {
    lines.push(
      "menus:                   # 模块的页面；管理员在门户“用户”页按人勾选，default 是默认拥有它的角色",
      `  - {id: home, name: "${name}", path: /apps/${id}/, default: [user]}`,
    );
  }
  lines.push("# requires: [people>=0.2]  # 要调用其他模块的对外接口时写上对方");
  return lines.join("\n") + "\n";
}

function composeYaml(id, hasFrontend, hasBackend, data) {
  const lines = [
    "# 模块的容器。npm run pack 按 build 构建镜像，打包时去掉 build、把 ${VERSION} 换成 module.yaml 里的版本号。",
    "# 网络、网关路由标签和 JWKS_URL 由安装器补上，这里不写；允许的字段见模块规范。",
    "services:",
  ];
  if (hasBackend) {
    lines.push(`  ${id}-backend:`, `    image: vb-${id}-backend:\${VERSION}`, "    build: ./backend");
    if (data) lines.push("    environment:", "      DATA_DIR: /data", "    volumes:", "      - data:/data");
  }
  if (hasFrontend) {
    if (hasBackend) lines.push("");
    lines.push(`  ${id}-frontend:`, `    image: vb-${id}-frontend:\${VERSION}`, "    build: ./frontend");
    if (hasBackend) lines.push("    depends_on:", `      - ${id}-backend`);
  }
  if (data) lines.push("", "volumes:", "  data:");
  return lines.join("\n") + "\n";
}
