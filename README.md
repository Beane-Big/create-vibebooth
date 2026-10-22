# create-vibebooth

生成一个 [Vibebooth](https://github.com/Beane-Big/vibebooth) 模块的骨架。生成的模块可以直接打包成合规的 zip，上传到 Vibebooth 的“应用管理”页安装。脚手架只管开头，生成之后就不再参与，规范由平台安装器在打包和安装时检查。

## 用法

```bash
npx github:Beane-Big/create-vibebooth ledger
```

`ledger` 是模块 id，不写会提示输入。接下来会依次问：

1. 显示名称、一句话说明
2. 前端：React + TypeScript / Vue 3 + TypeScript / 纯静态页面 / 不要前端
3. 后端：Go / 不要后端
4. 需不需要保存数据（预置 SQLite 和一个数据卷）

生成的目录是 `vibebooth-module-<id>/`，并自动 `git init`、安装前端依赖、下载后端依赖。

前提：Node.js 20.11 以上、Docker，以及本机跑着 Vibebooth 平台（`npm run pack` 要用平台的安装器镜像）。仓库是私有的时候，`npx github:` 和下载 SDK 都需要 GitHub 登录：在 WSL 里让 git 记住 github.com 的登录，或者设置环境变量 `VIBEBOOTH_GITHUB_TOKEN`。

## 生成了什么

| 文件 | 内容 |
| --- | --- |
| `module.yaml` | 模块清单：名称、版本、端口、默认菜单 |
| `compose.yaml` | 镜像名、构建目录、数据卷，已经符合安装器规则 |
| `package.json` | `npm run pack` / `install:local` / `dev` / `vendor` |
| `scripts/vb.mjs` | 上面几条命令的实现，调用平台的安装器镜像打包 |
| `AGENTS.md` | 给 AI 编码工具看的约定，链接到平台的模块规范 |
| `frontend/` | 选的前端模板，已配好 `/apps/<id>/` 路径和接口代理 |
| `backend/` | Go 后端，已接好 SDK 登录校验、健康检查；选了存数据时带一个 SQLite 示例接口 |

## 开发脚手架本身

```bash
npm test                 # 生成每种组合，检查文件
VB_E2E=1 npm test        # 再把每种组合装到本机平台（慢）
```

测试平台本身的 SDK 改动时，可以设置 `VIBEBOOTH_SDK_DIR=<平台仓库>/packages/sdk-go`，下载依赖时改用本地 SDK。

改模板时注意：模板里的 `__ID__`、`__NAME__`、`__DESCRIPTION__`、`__SDK_VERSION__`、`__HAS_BACKEND__`、`__HAS_DATA__` 由 `lib/generate.mjs` 替换；`_gitignore` 会改名为 `.gitignore`。平台的 SDK 发新版本后，更新 `lib/generate.mjs` 里的 `sdkVersion`。
