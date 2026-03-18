# Documentation Deployment Guide

OpenAEON's documentation is powered by **Mintlify** (SaaS). Here is how you can deploy it to your own server or use a custom domain.

## 1. Using a Custom Domain (The Official Way)

If your goal is to have the documentation accessible at `docs.openaeon.ai`, follow these steps:

1.  **Point your DNS**: Go to your domain provider (e.g., Cloudflare, AliCloud) and add a **CNAME** record.
    - **Type**: `CNAME`
    - **Name**: `docs`
    - **Target**: `mintlify.com`
2.  **Configure Mintlify**: Log in to your Mintlify dashboard and add the `docs.openaeon.ai` domain to your project. Mintlify will automatically handle SSL/TLS certificates.
3.  **Syncing**: Mintlify stays synced with your GitHub repository. Any changes to the `docs/` folder in the `main` branch will be reflected automatically.

## 2. Self-Hosting on a Private Server

Mintlify's core engine is proprietary, so there is no official single-command "static build" for self-hosting in the standard tier. However, you can achieve independent hosting using these methods:

### Method A: Reverse Proxy (Recommended for custom servers)

Run an Nginx server on your VPS that proxies requests to the Mintlify-hosted site.

```nginx
server {
    listen 80;
    server_name docs.openaeon.ai;

    location / {
        proxy_pass https://docs.openaeon.ai; # Points to the Mintlify cloud
        proxy_set_header Host $host;
        proxy_ssl_server_name on;
    }
}
```

### Method B: Native Self-Hosting (SSG Migration)

If you want to host the site without Mintlify, you must migrate to an Open Source Static Site Generator (SSG).

- **Recommended**: [VitePress](https://vitepress.dev/) or [Docusaurus](https://docusaurus.io/).
- **Effort**: Moderate. You will need to move Markdown files and potentially rewrite Mintlify-specific components (like `<Card>`, `<Note>`, etc.) into the target SSG's components.

### Method C: Docker (Development Only)

You can run the Mintlify CLI inside a Docker container. **Note**: This is intended for local preview and may not be optimized for production traffic.

```dockerfile
FROM node:22-alpine
RUN npm install -g mintlify
WORKDIR /app
COPY docs /app
CMD ["mintlify", "dev", "--port", "80"]
```

## 3. Deployment Summary

| Requirement               | Best Solution                      |
| :------------------------ | :--------------------------------- |
| **Custom Domain Only**    | CNAME to `mintlify.com`            |
| **Server Control**        | Nginx Reverse Proxy                |
| **Offline / Independent** | Migrate to VitePress or Docusaurus |