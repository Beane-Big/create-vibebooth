# create-vibebooth

生成一个 [Vibebooth](https://github.com/Beane-Big/vibebooth) 模块或门户主题的骨架。生成的模块可以直接打包成合规的 zip，上传到 Vibebooth 的“应用管理”页安装。脚手架只管开头，生成之后就不再参与，规范由平台安装器在打包和安装时检查。

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

`npm run install:local` 和 `npm run dev` 才需要本机跑着平台。`npm run standalone` 离开平台单独运行：后端开独立模式（`STANDALONE=1`，所有请求都当成拥有全部权限的本地用户，要本机装 Go），前端接到这个后端。

## 升级：add 命令

生成后想往上加一级（耦合等级见平台的[模块规范](https://github.com/Beane-Big/vibebooth/blob/main/docs/module-spec.md)），在模块目录里运行：

| 命令 | 做什么 |
| --- | --- |
| `npx github:Beane-Big/create-vibebooth add backend` | 加 Go 后端，改好 `module.yaml`、`compose.yaml` 和前端的 `config`，升到第 2 级 |
| `npx github:Beane-Big/create-vibebooth add data` | 给后端加 SQLite 和数据卷 |
| `npx github:Beane-Big/create-vibebooth add permissions` | `module.yaml` 加功能权限示例，后端加一个用 `Has()` 检查的示例接口，升到第 3 级 |
| `npx github:Beane-Big/create-vibebooth add persons` | 后端加读取平台家庭成员的接口（独立模式下用本地名单），升到第 4 级 |

命令只加文件。脚手架生成后没改过的文件会重写；改过的不覆盖，而是打印要手工加的内容。生成的 `AGENTS.md` 写着模块当前是第几级，升级后跟着改。

生成后想换 id 或名称，在模块目录里运行 `npm run rename -- <新 id> [新名称]`，不用重新生成。id 要在第一次安装前定好：装过的模块改 id 会变成另一个应用，旧数据不会跟过去。

## 主题：theme 命令

```bash
npx github:Beane-Big/create-vibebooth theme aurora
```

生成一个门户主题 `vibebooth-theme-<id>/`（规范见平台的[主题规范](https://github.com/Beane-Big/vibebooth/blob/main/docs/theme-spec.md)）。主题能换门户的颜色、背景、表单和卡片的样式、玻璃效果，以及首页的应用列表；模块的页面不受影响。生成的主题是一个能直接用的玻璃效果示例，带本机预览页。

| 命令 | 做什么 |
| --- | --- |
| `npm run dev` | 本机预览：模拟门户的顶栏、首页和常见组件，可切换深浅色 |
| `npm run pack` | 构建并生成主题包 zip，上传到平台的“设置 → 主题”页 |
| `npm run install:local` | 打包并装到本机平台（要 Docker 和本机平台） |

生成的 `AGENTS.md` 写着主题能改什么、不能改什么，用 AI 编码工具时让它先读。

## 生成了什么

| 文件 | 内容 |
| --- | --- |
| `module.yaml` | 模块清单：名称、版本、端口、默认菜单 |
| `compose.yaml` | 镜像名、构建目录、数据卷，已经符合安装器规则 |
| `package.json` | `npm run pack` / `pack:source` / `install:local` / `dev` / `standalone` / `rename` |
| `scripts/vb.mjs` | 上面几条命令的实现，调用安装器镜像打包 |
| `AGENTS.md` | 给 AI 编码工具看的约定和模块当前的耦合等级，链接到平台的模块规范 |
| `frontend/` | 选的前端模板，已配好 `/apps/<id>/` 路径和接口代理；和平台打交道的代码（当前用户、权限）都在 `platform.ts`（纯静态页面是 `platform.js`） |
| `backend/` | Go 后端，已接好 SDK 登录校验、健康检查和独立模式；选了存数据时带一个 SQLite 示例接口 |

## 开发脚手架本身

```bash
npm test                 # 生成每种组合，检查文件
VB_E2E=1 npm test        # 再把每种组合装到本机平台（慢）
```

改模板时注意：主题模板在 `templates/theme/`，只替换 `__ID__`、`__NAME__`、`__DESCRIPTION__`（`lib/theme.mjs`）。模块模板里的 `__ID__`、`__NAME__`、`__DESCRIPTION__`、`__SDK_VERSION__`、`__INSTALLER_VERSION__`、`__HAS_BACKEND__`、`__HAS_DATA__`、`__LEVEL__` 由 `lib/generate.mjs` 替换；`_gitignore` 会改名为 `.gitignore`。平台的 SDK 或安装器镜像发新版本后，更新 `lib/generate.mjs` 里的 `sdkVersion` 或 `installerVersion`。
