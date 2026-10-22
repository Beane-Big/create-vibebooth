#!/usr/bin/env node
// Vibebooth 模块命令：打包、装到本机平台、下载后端依赖、启动前端开发服务器。
// 校验和打 zip 都交给平台的安装器镜像完成，所以本地打出的包和平台安装时用的是同一套规则。
//
//   node scripts/vb.mjs pack      生成 dist/<id>-<版本>.zip
//   node scripts/vb.mjs install   打包并装到本机平台
//   node scripts/vb.mjs vendor    把后端依赖下载到 backend/vendor/
//   node scripts/vb.mjs dev       启动前端开发服务器
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
// 平台本体的 Compose 项目名，安装器镜像和容器都按它命名。
const platformProject = "home-platform";
const installerImage = `${platformProject}-installer`;
const goImage = "golang:1.26";
const sdkModule = "github.com/Beane-Big/vibebooth/packages/sdk-go";

function die(msg) {
  console.error("错误: " + msg);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { cwd: root, stdio: "inherit", ...opts });
  if (res.error) die(`${cmd} 无法运行：${res.error.message}`);
  if (res.status !== 0) die(`${cmd} ${args[0]} 失败`);
  return res;
}

function output(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { cwd: root, encoding: "utf8", ...opts });
  return res.status === 0 ? res.stdout.trim() : "";
}

function manifest() {
  const text = readFileSync(join(root, "module.yaml"), "utf8");
  const field = (name) => text.match(new RegExp(`^${name}:\\s*([^\\s#]+)`, "m"))?.[1];
  const id = field("id"), version = field("version");
  if (!id || !version) die("module.yaml 里缺少 id 或 version");
  return { id, version };
}

// GitHub 令牌：优先用环境变量，否则问 git 有没有记住 github.com 的登录。仓库公开后不需要。
function githubToken() {
  if (process.env.VIBEBOOTH_GITHUB_TOKEN) return process.env.VIBEBOOTH_GITHUB_TOKEN;
  const res = spawnSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return res.status === 0 ? (res.stdout.match(/^password=(.*)$/m)?.[1] ?? "") : "";
}

// vendor 在 Go 容器里运行 go mod tidy 和 go mod vendor，本机不用装 Go。
// VIBEBOOTH_SDK_DIR 指向本地的 sdk-go 目录时改用本地 SDK，只在开发平台本身时用。
function vendor() {
  const backend = join(root, "backend");
  if (!existsSync(join(backend, "go.mod"))) return;
  console.log("下载后端依赖…");
  const cache = join(root, ".cache", "gomod");
  mkdirSync(cache, { recursive: true });
  const args = ["run", "--rm", "--user", `${process.getuid()}:${process.getgid()}`,
    "-v", `${backend}:/src`, "-v", `${cache}:/gomod`, "-w", "/src",
    "-e", "HOME=/tmp", "-e", "GOMODCACHE=/gomod", "-e", "GOPRIVATE=github.com/Beane-Big/*",
    "-e", "GH_TOKEN"];
  let script = 'if [ -n "$GH_TOKEN" ]; then git config --global url."https://x-access-token:$GH_TOKEN@github.com/".insteadOf "https://github.com/"; fi && ';
  if (process.env.VIBEBOOTH_SDK_DIR) {
    args.push("-v", `${resolve(process.env.VIBEBOOTH_SDK_DIR)}:/sdk:ro`);
    script += `go mod edit -replace ${sdkModule}=/sdk && `;
  }
  script += "go mod tidy && go mod vendor";
  args.push(goImage, "sh", "-c", script);
  run("docker", args, { env: { ...process.env, GH_TOKEN: githubToken() } });
}

// vendor 目录过期（不存在，或 go.mod / go.sum 比它新）时才重新下载。
function vendorIfNeeded() {
  const backend = join(root, "backend");
  if (!existsSync(join(backend, "go.mod"))) return;
  const modules = join(backend, "vendor", "modules.txt");
  const mtime = (f) => (existsSync(f) ? statSync(f).mtimeMs : 0);
  if (mtime(modules) < Math.max(mtime(join(backend, "go.mod")), mtime(join(backend, "go.sum")))) vendor();
}

function pack() {
  const { id, version } = manifest();
  if (!output("docker", ["image", "inspect", installerImage])) {
    die(`找不到安装器镜像 ${installerImage}，请先在平台仓库里运行 docker compose up -d --build`);
  }
  vendorIfNeeded();
  // 前端镜像按 package-lock.json 安装依赖，还没有锁文件时先生成一个。
  const frontend = join(root, "frontend");
  if (existsSync(join(frontend, "package.json")) && !existsSync(join(frontend, "package-lock.json"))) {
    run("npm", ["install", "--no-audit", "--no-fund"], { cwd: frontend });
  }
  const env = { ...process.env, VERSION: version };
  const compose = ["compose", "-p", `mod-${id}`, "-f", "compose.yaml"];
  console.log(`构建 ${id} ${version} 的镜像…`);
  run("docker", [...compose, "build"], { env });
  const images = output("docker", [...compose, "config", "--images"], { env }).split(/\s+/).filter(Boolean);

  mkdirSync(join(root, "dist"), { recursive: true });
  const tmp = mkdtempSync(join(root, "dist", ".pack-"));
  try {
    console.log("导出镜像…");
    run("docker", ["save", "-o", join(tmp, "images.tar"), ...images]);
    const out = `dist/${id}-${version}.zip`;
    run("docker", ["run", "--rm", "--user", `${process.getuid()}:${process.getgid()}`, "-v", `${root}:/work`, "-w", "/work",
      installerImage, "pack", ".", `dist/${tmp.split("/").pop()}/images.tar`, out]);
    return out;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function install() {
  const zip = pack();
  const container = output("docker", ["ps", "-q", "--filter", `label=com.docker.compose.project=${platformProject}`,
    "--filter", "label=com.docker.compose.service=installer"]);
  if (!container) die("本机平台没有在运行，请先在平台仓库里运行 docker compose up -d");
  run("docker", ["cp", join(root, zip), `${container}:/tmp/package.zip`], { stdio: "ignore" });
  run("docker", ["exec", container, "installer", "install", "/tmp/package.zip"]);
}

function dev() {
  const frontend = join(root, "frontend");
  if (!existsSync(join(frontend, "package.json"))) die("这个模块的前端是纯静态页面，直接改 frontend/public/ 后运行 npm run install:local 即可");
  if (!existsSync(join(frontend, "node_modules"))) run("npm", ["install"], { cwd: frontend });
  run("npm", ["run", "dev"], { cwd: frontend });
}

const commands = { pack, install, vendor, dev };
const cmd = commands[process.argv[2]];
if (!cmd) die("用法: node scripts/vb.mjs pack | install | vendor | dev");
cmd();
