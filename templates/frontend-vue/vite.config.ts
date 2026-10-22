import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 页面挂在 /apps/__ID__/ 下；本地开发时把接口请求转给本机平台的网关（8080 端口）。
export default defineConfig({
  base: "/apps/__ID__/",
  plugins: [vue()],
  server: {
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
});
