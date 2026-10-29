// 构建镜像时把模块图标 icon.svg 画成 180px 的 apple-touch-icon.png（iOS 添加到主屏幕只认 PNG）。
// iOS 会自己切圆角，透明的地方会变成黑色，所以铺一层白底。规则和 React、Vue 模板里的 vite-icon.ts 一样。
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const svg = readFileSync("icon.svg", "utf8");
// 文字的样子取决于电脑上装了什么字体，平台、浏览器和 iOS 上会不一样，所以要求先转成路径。
if (/<text[\s>]/.test(svg)) throw new Error("icon.svg 里有 <text>，请先把文字转成路径");
const png = new Resvg(svg, { fitTo: { mode: "width", value: 180 }, background: "#ffffff" }).render().asPng();
writeFileSync("apple-touch-icon.png", png);
