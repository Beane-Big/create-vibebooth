// 生成一个 Vibebooth 主题：npx github:Beane-Big/create-vibebooth theme <主题 id>。只做文件操作，不联网，方便测试。
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { copy, fill } from "./generate.mjs";

// 和平台 packages/manifest 的 ParseTheme 保持一致：规则和模块 id 一样，内置皮肤的名字不能用。
const idPattern = /^[a-z][a-z0-9-]{1,30}$/;
const reservedIDs = new Set(["classic", "tiles"]);
// 名称和说明会原样写进 YAML、HTML 和代码模板，这些字符会破坏其中某一种。
const unsafe = /[<>{}$`"\\\n]/;

// validateTheme 返回选项里的错误，没有错误时返回空字符串。
export function validateTheme({ id, name }) {
  if (!idPattern.test(id) || reservedIDs.has(id)) {
    return "主题 id 只能是小写字母开头的小写字母、数字和连字符（2 到 31 个字符），且不能是 " + [...reservedIDs].join("、");
  }
  if (!name?.trim()) return "名称不能为空";
  if (unsafe.test(name)) return "名称里不能有 < > { } $ ` 引号、反斜杠或换行";
  return "";
}

// generateTheme 在 dir 下生成主题，dir 必须不存在或为空。
export function generateTheme(dir, opts) {
  const err = validateTheme(opts);
  if (err) throw new Error(err);
  if (existsSync(dir) && readdirSync(dir).length > 0) throw new Error(`${dir} 已经存在且不为空`);
  const name = opts.name.trim();
  const description = (opts.description ?? "").replace(new RegExp(unsafe, "g"), " ").trim() || `${name}，一个 Vibebooth 主题`;
  mkdirSync(dir, { recursive: true });
  copy("theme", dir);
  fill(dir, { __ID__: opts.id, __NAME__: name, __DESCRIPTION__: description });
}
