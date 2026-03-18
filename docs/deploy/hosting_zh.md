# 文档独立部署指南 / Documentation Self-Hosting Guide

OpenAEON 的文档系统基于 **Mintlify**。如果你希望将 `docs` 目录提取出来并独立部署到自己的服务器（如 `docs.openaeon.ai`），请参考以下方案。

---

## 方案一：使用 Mintlify 官方自定义域名（推荐）

这是最简单且维护成本最低的方式。

1.  **无需提取目录**：直接将 GitHub 仓库连接到 Mintlify。
2.  **解析域名**：在你的域名提供商（如 Cloudflare, 阿里云）处添加一条 **CNAME** 记录：
    - **主机记录**: `docs`
    - **记录值**: `mintlify.com`
3.  **配置 Mintlify**：在 Mintlify 面板中关联 `docs.openaeon.ai`。

---

## 方案二：完全独立部署 (Docker + VitePress)

如果你希望完全脱离 Mintlify 平台，在自己的 VPS 上运行，你需要将 Markdown 文档“提取”并构建为静态网页。由于 Mintlify 引擎是闭源的，我们推荐将其迁移到 **VitePress**。

### 1. 提取文档目录

你只需要复制仓库中的 `docs` 目录到你的服务器上。

### 2. 使用 Docker 快速部署

你可以创建一个简单的 `Dockerfile` 来完成构建和托管。创建一个名为 `Dockerfile.docs` 的文件：

```dockerfile
# 使用 Node 进行构建
FROM node:22-slim AS builder
WORKDIR /app
COPY docs ./docs
# 安装 VitePress (轻量级静态文档工具)
RUN npm install -g vitepress
# 将 docs 目录构建为静态 HTML
RUN vitepress build docs

# 使用 Nginx 托管静态文件
FROM nginx:alpine
COPY --from=builder /app/docs/.vitepress/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 3. Nginx 配置 (`docs.openaeon.ai`)

如果你直接在 VPS 上使用 Nginx，可以使用以下配置：

```nginx
server {
    listen 80;
    server_name docs.openaeon.ai;

    location / {
        root /path/to/your/extracted/docs/dist; # 构建后的目录
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 方案总结

| 需求         | 解决方案         | 优点                             |
| :----------- | :--------------- | :------------------------------- |
| **快速上线** | Mintlify + CNAME | 自动同步 GitHub，无需维护服务器  |
| **完全掌控** | 迁移至 VitePress | 数据完全在自己服务器，无三方依赖 |
| **私有部署** | Docker + Nginx   | 容器化管理，适合私有网络         |

> [!IMPORTANT]
> 注意：从 Mintlify 迁移到 VitePress 时，某些 Mintlify 特有的组件（如 `<Card>`, `<Step>`）可能需要替换为标准的 Markdown 或对应的 VitePress 组件。