// __NAME__ 的后端。网关已经校验过登录，这里用 SDK 拿到当前用户。
package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/Beane-Big/vibebooth/packages/sdk-go/auth"
)

const moduleID = "__ID__"

// routes 收集其他文件注册的对内接口：npx github:Beane-Big/create-vibebooth add 加的示例文件用它把接口挂上来。
var routes []func(api *http.ServeMux)

func main() {
	verifier := auth.NewVerifier(env("JWKS_URL", "http://core:8080/api/platform/.well-known/jwks.json"), moduleID)

	// 对内接口：只给本模块前端用，需要登录。
	api := http.NewServeMux()
	api.HandleFunc("GET /api/__ID__/me", func(w http.ResponseWriter, r *http.Request) {
		user := auth.UserFrom(r.Context())
		writeJSON(w, http.StatusOK, map[string]any{"name": user.Name, "menus": user.Menus, "perms": user.Perms, "all": user.All})
	})

	for _, add := range routes {
		add(api)
	}

	// 独立模式（npm run standalone）：离开平台单独运行时不校验令牌，当成一个拥有全部权限的本地用户。平台不会设这个变量。
	guard := verifier.Middleware
	if os.Getenv("STANDALONE") == "1" {
		slog.Warn("独立模式：不校验令牌，所有请求都是拥有全部权限的本地用户")
		guard = auth.Standalone("本地用户")
	}

	mux := http.NewServeMux()
	// 健康检查由平台在内部网络直接调用，不经过网关，也不需要令牌。
	mux.HandleFunc("GET /api/__ID__/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.Handle("/api/__ID__/", guard(api))

	srv := &http.Server{Addr: ":8000", Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	slog.Info("__ID__ 模块已启动", "addr", srv.Addr)
	if err := srv.ListenAndServe(); err != nil {
		slog.Error("服务退出", "err", err)
		os.Exit(1)
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
