# 构建目录是模块根目录，要用到 icon.svg。先把它画成 iOS 添加到主屏幕用的 PNG（只认 PNG），再和页面一起放进 nginx。
FROM node:22-alpine AS icon
# 服务器上的构建器可以传入国内的 npm 镜像源，不传时用官方源。
ARG NPM_REGISTRY=https://registry.npmjs.org/
WORKDIR /icon
RUN --mount=type=cache,target=/root/.npm npm install --registry="$NPM_REGISTRY" --no-audit --no-fund --no-save @resvg/resvg-js@2.6.2
COPY icon.svg frontend/touch-icon.mjs ./
RUN node touch-icon.mjs

FROM nginx:1.29-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/public /usr/share/nginx/html/apps/__ID__
COPY icon.svg /usr/share/nginx/html/apps/__ID__/icon.svg
COPY --from=icon /icon/apple-touch-icon.png /usr/share/nginx/html/apps/__ID__/apple-touch-icon.png
