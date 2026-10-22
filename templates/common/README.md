# __NAME__

__DESCRIPTION__

这是一个 [Vibebooth](https://github.com/Beane-Big/vibebooth) 模块，由 `create-vibebooth` 生成。

## 常用命令

都在本目录运行。前提是本机已经用 `docker compose up -d` 跑着 Vibebooth 平台。

| 命令 | 做什么 |
| --- | --- |
| `npm run install:local` | 打包并装到本机平台，打开 http://localhost:8080 就能看到。改完代码再运行一次即可 |
| `npm run dev` | 只启动前端开发服务器，接口转给本机平台，改界面时不用每次打包。先在 http://localhost:8080 登录一次，再打开终端里显示的地址 |
| `npm run pack` | 生成 `dist/__ID__-<版本>.zip`，上传到正式平台的“应用管理”页 |
| `npm run vendor` | 重新下载后端依赖（改了 `backend/go.mod` 之后运行） |

后端依赖的 SDK 在私有仓库里时，下载要用 GitHub 令牌：先 `export VIBEBOOTH_GITHUB_TOKEN=<令牌>`，或者让 git 记住 github.com 的登录。

发布新版本前，把 `module.yaml` 的 `version` 改大。
