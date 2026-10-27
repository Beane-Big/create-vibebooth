// 由 add persons 生成：读取平台保存的家庭成员（契约见平台仓库的 contracts/openapi.yaml），模块只保存人员 id。
// 平台的人员接口只读，模块不能改人员资料和头像。
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/Beane-Big/vibebooth/packages/sdk-go/auth"
)

// person 是平台的一个人员。DisplayName 是给当前用户看的称呼：他在门户“用户”里写过备注时是备注，否则是姓名。
type person struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Photo       string `json:"photo"`
	DisplayName string `json:"displayName"`
}

// localPersons 是独立模式下的人员名单：离开平台取不到真实名单，用一个本地人员代替。
var localPersons = []person{{ID: 1, Name: "本地用户", DisplayName: "本地用户"}}

var personsClient = &http.Client{Timeout: 3 * time.Second}

// listPersons 返回全部人员。viewer 是当前账号 id（令牌里的 sub），平台据此把他写的备注填进 displayName。
func listPersons(ctx context.Context, viewer string) ([]person, error) {
	if os.Getenv("STANDALONE") == "1" {
		return localPersons, nil
	}
	u := env("PEOPLE_URL", "http://core:8080") + "/api/platform/ext/v1/persons?viewer=" + url.QueryEscape(viewer)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	resp, err := personsClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("人员接口返回 %s", resp.Status)
	}
	var list []person
	return list, json.NewDecoder(resp.Body).Decode(&list)
}

func init() {
	routes = append(routes, func(api *http.ServeMux) {
		// 前端显示人员时用 displayName，这样每个人看到的是自己写的备注。
		api.HandleFunc("GET /api/__ID__/persons", func(w http.ResponseWriter, r *http.Request) {
			list, err := listPersons(r.Context(), auth.UserFrom(r.Context()).ID)
			if err != nil {
				// 降级：平台暂时不可用时告诉前端，页面上其他功能照常用。
				slog.Error("读取人员失败", "err", err)
				writeError(w, http.StatusBadGateway, "暂时取不到家庭成员名单")
				return
			}
			writeJSON(w, http.StatusOK, list)
		})
	})
}
