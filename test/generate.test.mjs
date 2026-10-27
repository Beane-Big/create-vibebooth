// 运行：npm test。把每种前后端组合都生成一遍，检查文件和占位符；再检查 add 命令。
// 设置 VB_E2E=1 时，再对每个组合运行 npm run install:local，装到本机正在运行的平台上（需要 Docker 和平台）。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { add } from "../lib/add.mjs";
import { backends, frontends, generate, validate } from "../lib/generate.mjs";

const combos = [];
for (const frontend of Object.keys(frontends)) {
  for (const backend of Object.keys(backends)) {
    for (const data of backend === "go" ? [false, true] : [false]) {
      if (frontend !== "none" || backend !== "none") combos.push({ frontend, backend, data });
    }
  }
}

function files(dir) {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

test("validate 拒绝不合规的选项", () => {
  const ok = { id: "ledger", name: "记账", frontend: "react", backend: "go", data: true };
  assert.equal(validate(ok), "");
  for (const bad of [
    { id: "core" },
    { id: "Ledger" },
    { id: "a" },
    { name: " " },
    { name: "记<账" },
    { frontend: "svelte" },
    { frontend: "none", backend: "none", data: false },
    { backend: "none", data: true },
  ]) {
    assert.notEqual(validate({ ...ok, ...bad }), "", JSON.stringify(bad));
  }
});

for (const combo of combos) {
  const label = `${combo.frontend} + ${combo.backend}${combo.data ? " + 数据" : ""}`;
  test(`生成 ${label}`, () => {
    const root = mkdtempSync(join(tmpdir(), "vb-test-"));
    const id = `t-${combo.frontend}-${combo.backend}${combo.data ? "-d" : ""}`;
    const dir = join(root, id);
    try {
      generate(dir, { id, name: "测试", description: "测试用的模块", ...combo });
      for (const f of files(dir)) {
        assert.doesNotMatch(readFileSync(f, "utf8"), /__[A-Z_]+__/, `${f} 里还有没替换的占位符`);
      }
      assert.ok(existsSync(join(dir, ".gitignore")));
      assert.equal(existsSync(join(dir, "frontend")), combo.frontend !== "none");
      assert.equal(existsSync(join(dir, "backend", "main.go")), combo.backend === "go");
      assert.equal(existsSync(join(dir, "backend", "store.go")), combo.data);
      const manifest = readFileSync(join(dir, "module.yaml"), "utf8");
      assert.match(manifest, new RegExp(`^id: ${id} `, "m"));
      assert.equal(/^menus:/m.test(manifest), combo.frontend !== "none");
      const compose = readFileSync(join(dir, "compose.yaml"), "utf8");
      assert.equal(compose.includes(`image: vb-${id}-backend:\${VERSION}`), combo.backend === "go");
      assert.equal(/^volumes:/m.test(compose), combo.data);
      assert.throws(() => generate(dir, { id, name: "测试", ...combo }), /不为空/);

      // 改名后不应再留下旧 id 和旧名称。新 id 带上原 id，开着 VB_E2E 时各组合装到本机也不会互相覆盖。
      const renamed = spawnSync("node", ["scripts/vb.mjs", "rename", `${id}-renamed`, "新名字"], { cwd: dir, encoding: "utf8" });
      assert.equal(renamed.status, 0, renamed.stderr);
      for (const f of files(dir)) {
        const text = readFileSync(f, "utf8");
        assert.doesNotMatch(text, new RegExp(`(?<![a-z0-9-])${id}(?![a-z0-9-])`), `${f} 里还有旧 id`);
        assert.doesNotMatch(text, />测试<|"测试"|^# 测试$|^\/\/ 测试 /m, `${f} 里还有旧名称`);
      }
      assert.match(readFileSync(join(dir, "module.yaml"), "utf8"), new RegExp(`^id: ${id}-renamed .*\nname: "新名字"`, "m"));

      if (process.env.VB_E2E) {
        const res = spawnSync("npm", ["run", "install:local"], { cwd: dir, stdio: "inherit" });
        assert.equal(res.status, 0, `${label} 安装失败`);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("add 一级一级升上去，和直接生成的一样", () => {
  const root = mkdtempSync(join(tmpdir(), "vb-test-"));
  try {
    const up = join(root, "up");
    const direct = join(root, "direct");
    const opts = { id: "t-add", name: "测试", description: "测试用的模块", frontend: "react" };
    generate(up, { ...opts, backend: "none", data: false });
    generate(direct, { ...opts, backend: "go", data: true });
    assert.match(readFileSync(join(up, "AGENTS.md"), "utf8"), /^当前等级：0/m);
    assert.match(readFileSync(join(direct, "AGENTS.md"), "utf8"), /^当前等级：2/m);
    assert.throws(() => add(up, "permissions"), /先运行 add backend/);

    for (const feature of ["backend", "data", "permissions", "persons"]) {
      assert.deepEqual(add(up, feature).manual.filter((m) => !m.startsWith("前端")), [], feature);
    }
    assert.throws(() => add(up, "backend"), /已经有后端/);
    for (const f of ["compose.yaml", "backend/main.go", "backend/store.go", "backend/go.mod", "frontend/src/config.ts"]) {
      assert.equal(readFileSync(join(up, f), "utf8"), readFileSync(join(direct, f), "utf8"), f);
    }
    assert.ok(existsSync(join(up, "backend", ".gitignore")));
    assert.ok(existsSync(join(up, "backend", "persons.go")));
    assert.match(readFileSync(join(up, "AGENTS.md"), "utf8"), /^当前等级：4/m);
    assert.match(readFileSync(join(up, "module.yaml"), "utf8"), /^permissions: .*\n {2}- \{id: edit/m);
    for (const f of files(up)) assert.doesNotMatch(readFileSync(f, "utf8"), /__[A-Z_]+__/, `${f} 里还有没替换的占位符`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("add 不覆盖改过的文件", () => {
  const root = mkdtempSync(join(tmpdir(), "vb-test-"));
  try {
    const dir = join(root, "m");
    generate(dir, { id: "t-keep", name: "测试", frontend: "static", backend: "go", data: false });
    const compose = join(dir, "compose.yaml");
    const main = join(dir, "backend", "main.go");
    writeFileSync(compose, readFileSync(compose, "utf8") + "# 自己改的\n");
    writeFileSync(main, readFileSync(main, "utf8") + "// 自己改的\n");
    const { manual } = add(dir, "data");
    assert.match(readFileSync(compose, "utf8"), /# 自己改的/);
    assert.match(readFileSync(main, "utf8"), /\/\/ 自己改的/);
    assert.ok(manual.some((m) => m.startsWith("compose.yaml 改过了")));
    assert.ok(manual.some((m) => m.startsWith("backend/main.go 改过了")));
    assert.ok(existsSync(join(dir, "backend", "store.go")));
    assert.match(readFileSync(join(dir, "frontend", "public", "config.js"), "utf8"), /hasData = true/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
