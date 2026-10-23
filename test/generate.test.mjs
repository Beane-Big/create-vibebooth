// 运行：npm test。把每种前后端组合都生成一遍，检查文件和占位符。
// 设置 VB_E2E=1 时，再对每个组合运行 npm run install:local，装到本机正在运行的平台上（需要 Docker 和平台）。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
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
