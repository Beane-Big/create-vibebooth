// __NAME__ 的后端。网关已经校验过登录，这里用 SDK 拿到当前用户；数据存在本模块卷里的 SQLite 文件。
package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Beane-Big/vibebooth/packages/sdk-go/auth"
)

const moduleID = "__ID__"

func main() {
	store, err := OpenStore(filepath.Join(env("DATA_DIR", "/data"), "__ID__.db"))
	if err != nil {
		slog.Error("打开数据库失败", "err", err)
		os.Exit(1)
	}
	verifier := auth.NewVerifier(env("JWKS_URL", "http://core:8080/api/platform/.well-known/jwks.json"), moduleID)

	// 对内接口：只给本模块前端用，需要登录。
	api := http.NewServeMux()
	api.HandleFunc("GET /api/__ID__/me", func(w http.ResponseWriter, r *http.Request) {
		user := auth.UserFrom(r.Context())
		writeJSON(w, http.StatusOK, map[string]any{"name": user.Name, "menus": user.Menus})
	})
	api.HandleFunc("GET /api/__ID__/notes", func(w http.ResponseWriter, r *http.Request) {
		notes, err := store.List(r.Context())
		if err != nil {
			slog.Error("读取笔记失败", "err", err)
			writeError(w, http.StatusInternalServerError, "读取失败")
			return
		}
		writeJSON(w, http.StatusOK, notes)
	})
	api.HandleFunc("POST /api/__ID__/notes", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Text string `json:"text"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&in); err != nil || strings.TrimSpace(in.Text) == "" {
			writeError(w, http.StatusBadRequest, "内容不能为空")
			return
		}
		note, err := store.Add(r.Context(), strings.TrimSpace(in.Text), auth.UserFrom(r.Context()).Name)
		if err != nil {
			slog.Error("保存笔记失败", "err", err)
			writeError(w, http.StatusInternalServerError, "保存失败")
			return
		}
		writeJSON(w, http.StatusCreated, note)
	})

	mux := http.NewServeMux()
	// 健康检查由平台在内部网络直接调用，不经过网关，也不需要令牌。
	mux.HandleFunc("GET /api/__ID__/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.Handle("/api/__ID__/", verifier.Middleware(api))

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

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
