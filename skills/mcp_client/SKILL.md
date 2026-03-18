---
name: mcp_client
description: MCP 客户端技能 - 连接外部 MCP 服务器，扩展智能体能力。支持 stdio、HTTP 等传输方式。
entry: main.js
parameters: |
  {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["connect", "disconnect", "list", "tools", "call", "status"],
        "description": "操作类型: connect=连接服务器, disconnect=断开连接, list=列出连接, tools=列出工具, call=调用工具, status=连接状态"
      },
      "name": {
        "type": "string",
        "description": "连接名称"
      },
      "config": {
        "type": "object",
        "description": "connect时: 连接配置",
        "properties": {
          "type": { "type": "string", "enum": ["stdio", "http", "sse"] },
          "command": { "type": "string" },
          "args": { "type": "array" },
          "url": { "type": "string" },
          "env": { "type": "object" }
        }
      },
      "tool": { "type": "string", "description": "call时: 工具名称" },
      "args": { "type": "object", "description": "call时: 工具参数" }
    },
    "required": ["action"]
  }
---

# MCP 客户端技能

让智能体能够连接和使用外部 MCP 服务器提供的工具。

## 支持的传输类型

| 类型 | 说明 | 使用场景 |
|------|------|----------|
| stdio | 标准输入输出 | 本地 MCP 服务器进程 |
| http | HTTP 传输 | 远程 MCP 服务器 |
| sse | Server-Sent Events | 实时推送的服务器 |

## 使用示例

### 连接本地 MCP 服务器

```javascript
{
  "action": "connect",
  "name": "filesystem",
  "config": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
  }
}
```

### 连接远程 MCP 服务器

```javascript
{
  "action": "connect",
  "name": "my-server",
  "config": {
    "type": "http",
    "url": "https://api.example.com/mcp"
  }
}
```

### 列出可用工具

```javascript
{ "action": "tools", "name": "filesystem" }
```

### 调用工具

```javascript
{
  "action": "call",
  "name": "filesystem",
  "tool": "read_file",
  "args": { "path": "/path/to/file.txt" }
}
```

### 断开连接

```javascript
{ "action": "disconnect", "name": "filesystem" }
```

## 常用 MCP 服务器

- `@modelcontextprotocol/server-filesystem` - 文件系统操作
- `@modelcontextprotocol/server-github` - GitHub API
- `@modelcontextprotocol/server-postgres` - PostgreSQL 数据库
- `@modelcontextprotocol/server-memory` - 知识图谱记忆

## 注意事项

1. 连接前确保 MCP 服务器可用
2. 某些服务器需要配置环境变量（如 API Key）
3. 建议使用受信任的 MCP 服务器
