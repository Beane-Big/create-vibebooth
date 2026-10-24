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

生成的目录是 `vibebooth-module-<id>/`，并自动 `git init`、安装前端依赖。后端的 Go 依赖在构建镜像时下载，本机不用装 Go。

前提：Node.js 20.11 以上。打包有两种方式：

- `npm run pack:source`（推荐）：只要 Node.js，把源码打成 zip，上传到平台的“构建器”页面，由服务器构建出软件包。
- `npm run pack`：要 Docker，在本机构建出软件包，平台还没装构建器时用。不需要本机有平台：本机跑着平台时用平台自己的安装器镜像，没有时自动下载发布版 `ghcr.io/beane-big/vibebooth-installer`。

`npm run install:local` 和 `npm run dev` 才需要本机跑着平台。

生成后想换 id 或名称，在模块目录里运行 `npm run rename -- <新 id> [新名称]`，不用重新生成。id 要在第一次安装前定好：装过的模块改 id 会变成另一个应用，旧数据不会跟过去。

## 生成了什么

| 文件 | 内容 |
| --- | --- |
| `module.yaml` | 模块清单：名称、版本、端口、默认菜单 |
| `compose.yaml` | 镜像名、构建目录、数据卷，已经符合安装器规则 |
| `package.json` | `npm run pack` / `pack:source` / `install:local` / `dev` / `rename` |
| `scripts/vb.mjs` | 上面几条命令的实现，调用安装器镜像打包 |
| `AGENTS.md` | 给 AI 编码工具看的约定，链接到平台的模块规范 |
| `frontend/` | 选的前端模板，已配好 `/apps/<id>/` 路径和接口代理 |
| `backend/` | Go 后端，已接好 SDK 登录校验、健康检查；选了存数据时带一个 SQLite 示例接口 |

## 开发脚手架本身

```bash
npm test                 # 生成每种组合，检查文件
VB_E2E=1 npm test        # 再把每种组合装到本机平台（慢）
```

改模板时注意：模板里的 `__ID__`、`__NAME__`、`__DESCRIPTION__`、`__SDK_VERSION__`、`__INSTALLER_VERSION__`、`__HAS_BACKEND__`、`__HAS_DATA__` 由 `lib/generate.mjs` 替换；`_gitignore` 会改名为 `.gitignore`。平台的 SDK 或安装器镜像发新版本后，更新 `lib/generate.mjs` 里的 `sdkVersion` 或 `installerVersion`。
