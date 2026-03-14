---
name: clawhub
description: 使用 ClawHub CLI 从 clawhub.com 搜索、安装、更新和发布技能。需要时获取新技能，同步已安装技能到最新版本，或使用 npm 安装的 clawhub CLI 发布新的/更新的技能文件夹。
metadata:
  {
    "openaeon":
      {
        "requires": { "bins": ["clawhub"] },
        "install":
          [
            {
              "id": "node",
              "kind": "node",
              "package": "clawhub",
              "bins": ["clawhub"],
              "label": "安装 ClawHub CLI (npm)",
            },
          ],
      },
  }
---

# ClawHub CLI

安装

```bash
npm i -g clawhub
```

认证（发布）

```bash
clawhub login
clawhub whoami
```

搜索

```bash
clawhub search "postgres backups"
```

安装

```bash
clawhub install my-skill
clawhub install my-skill --version 1.2.3
```

更新（基于哈希匹配 + 升级）

```bash
clawhub update my-skill
clawhub update my-skill --version 1.2.3
clawhub update --all
clawhub update my-skill --force
clawhub update --all --no-input --force
```

列表

```bash
clawhub list
```

发布

```bash
clawhub publish ./my-skill --slug my-skill --name "My Skill" --version 1.2.0 --changelog "修复 + 文档"
```

注意事项

- 默认注册表：https://clawhub.com（使用 CLAWHUB_REGISTRY 或 --registry 覆盖）
- 默认工作目录：cwd（回退到 OpenAEON 工作区）；安装目录：./skills（使用 --workdir / --dir / CLAWHUB_WORKDIR 覆盖）
- update 命令对本地文件进行哈希解析，匹配对应版本，除非设置 --version 否则升级到最新版本
