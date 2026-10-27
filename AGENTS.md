# 仓库约定（给 AI 编码工具和自己看）

- 这里是 Vibebooth 模块的脚手架。生成的模块必须符合平台仓库 `docs/module-spec.md` 的规范；改模板后运行 `VB_E2E=1 npm test`，确认每种组合都能打包并装到本机平台。
- 模块的打包和校验逻辑在平台的安装器里，模板里的 `scripts/vb.mjs` 只负责调用它，不要在这里重复实现校验规则。
- 三个前端模板的页面、样式和接口调用保持一致；共用样式在 `templates/shared/styles.css`，和平台门户使用同一套颜色变量。
- 改了用法、选项或生成的文件，同步更新 `README.md`。
- `add` 命令在 `lib/add.mjs`：只加文件，改过的文件不覆盖。改模板时保证从低等级用 `add` 一级一级升上去，和直接生成的结果一样（`npm test` 会比较）。
- `theme` 命令在 `lib/theme.mjs`，模板在 `templates/theme/`。生成的主题必须符合平台仓库 `docs/theme-spec.md`；`templates/theme/src/vibebooth.d.ts` 是门户给主题的接口，和平台 `portal/src/themeHost.tsx`、`portal/src/theme.tsx` 保持一致，平台改了接口要同步改它，`src/preview/portal.tsx` 也要跟着门户的 `themeConfig` 改。
