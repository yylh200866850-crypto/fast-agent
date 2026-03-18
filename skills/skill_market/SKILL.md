---
name: skill_market
description: 技能市场管理器 - 从多个市场源搜索、浏览、安装和管理技能与MCP服务器。支持 MCP Registry、MCP.so、npm 等多个市场源。
entry: main.js
parameters: |
  {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["search", "list", "info", "install", "uninstall", "sources", "update"],
        "description": "操作类型: search=搜索, list=列出已安装, info=查看详情, install=安装, uninstall=卸载, sources=列出市场源, update=更新市场缓存"
      },
      "query": {
        "type": "string",
        "description": "search时: 搜索关键词"
      },
      "source": {
        "type": "string",
        "description": "install时: 安装源 (市场ID:包名 或 URL 或 本地路径)"
      },
      "name": {
        "type": "string",
        "description": "uninstall/info时: 技能名称"
      },
      "market": {
        "type": "string",
        "enum": ["all", "mcp-registry", "mcp-so", "npm", "github"],
        "description": "search时: 指定搜索的市场源，默认all"
      },
      "type": {
        "type": "string",
        "enum": ["skill", "mcp", "all"],
        "description": "search时: 搜索类型，skill=技能, mcp=MCP服务器, all=全部"
      }
    },
    "required": ["action"]
  }
---

# 技能市场管理器

让智能体能够自主发现、评估和安装新的能力扩展。

## 功能

### 1. 多市场源支持

| 市场源 | 说明 | 类型 |
|--------|------|------|
| mcp-registry | MCP 官方注册表 | MCP Server |
| mcp-so | MCP.so 第三方市场 (18000+ servers) | MCP Server |
| npm | NPM 包管理器 | Skill/MCP |
| github | GitHub 仓库 | Skill/MCP |

### 2. 搜索功能

支持关键词搜索，可指定市场源和类型过滤。

### 3. 安装功能

支持多种安装方式：
- 市场ID:包名 (如 `mcp-registry:filesystem`)
- URL (如 `https://github.com/user/skill/archive.zip`)
- 本地路径
- npm 包名

### 4. 管理功能

- 列出已安装技能
- 查看技能详情
- 卸载技能
- 更新市场缓存

## 使用场景

1. 用户要求新功能时，搜索并安装相应技能
2. 发现当前能力不足时，主动搜索扩展
3. 管理和维护已安装的技能

## 示例

```javascript
// 搜索文件相关技能
{ "action": "search", "query": "file", "type": "all" }

// 从 MCP Registry 安装
{ "action": "install", "source": "mcp-registry:filesystem" }

// 从 GitHub 安装
{ "action": "install", "source": "github:modelcontextprotocol/servers/filesystem" }

// 查看已安装
{ "action": "list" }

// 卸载
{ "action": "uninstall", "name": "my_skill" }
```

## 注意事项

1. 安装前会验证技能来源和安全性
2. 内置技能受保护，不可卸载
3. 建议从官方市场源安装，确保稳定性
