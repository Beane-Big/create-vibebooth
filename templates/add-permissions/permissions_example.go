// 由 add permissions 生成的示例：功能权限 edit 声明在 module.yaml 的 permissions 里，管理员在门户“用户”页按人开关。
// 后端用 Has 检查，没有权限时返回 403；前端用 platform.ts 的 can(me, "edit") 隐藏按钮。换成自己的功能后删掉这个文件。
package main

import (
	"net/http"

	"github.com/Beane-Big/vibebooth/packages/sdk-go/auth"
)

func init() {
	routes = append(routes, func(api *http.ServeMux) {
		api.HandleFunc("POST /api/__ID__/edit-example", func(w http.ResponseWriter, r *http.Request) {
			if !auth.UserFrom(r.Context()).Has("edit") {
				writeError(w, http.StatusForbidden, "没有“编辑”权限")
				return
			}
			writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		})
	})
}
