# __NAME__

__DESCRIPTION__

这是一个 [Vibebooth](https://github.com/Beane-Big/vibebooth) 模块，由 `create-vibebooth` 生成。

## 常用命令

都在本目录运行，需要 Node.js。`pack:source` 只要 Node.js；`pack` 还要 Docker；`install:local` 和 `dev` 还要求本机已经用 `docker compose up -d` 跑着 Vibebooth 平台。

| 命令 | 做什么 |
| --- | --- |
| `npm run install:local` | 打包并装到本机平台，打开 http://localhost:8080 就能看到。改完代码再运行一次即可 |
| `npm run dev` | 只启动前端开发服务器，接口转给本机平台，改界面时不用每次打包。先在 http://localhost:8080 登录一次，再打开终端里显示的地址 |
| `npm run pack` | 在本机构建镜像，生成 `dist/__ID__-<版本>.zip`，上传到正式平台的“应用管理”页 |
| `npm run pack:source` | 不构建，只把源码打成 `dist/__ID__-<版本>-source.zip`（不含 `node_modules`、`dist`），上传到平台的“构建器”页面，由服务器构建出软件包 |
| `npm run rename -- <新 id> [新名称]` | 改模块 id，也可以同时改名称，代码、配置和文档里用到的地方一起改。只改名称就把 id 写成原来的。id 要在第一次装到平台前定好：装过的模块改 id 会变成另一个应用，旧数据不会跟过去 |

依赖在构建镜像时下载（Go 用 `GOPROXY`，npm 用 `NPM_REGISTRY`），本机不用装 Go。

本机没有平台时，`npm run pack` 会下载安装器镜像 `ghcr.io/beane-big/vibebooth-installer`。这个镜像还是私有的话，先用有 `read:packages` 权限的令牌运行一次 `docker login ghcr.io`。

发布新版本前，把 `module.yaml` 的 `version` 改大。
