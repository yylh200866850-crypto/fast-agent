# 分析理解整个项目,维护永久性唯一文档(本文档),本句话永不移除,更新完用户需求后KISS原则迭代本文档(包含本项目的注意事项历史规则记忆-不要冗余)

# Fast-Agent 项目维护文档

> 本文档为项目唯一维护文档，记录架构、模块、构建和发布流程。

## 项目概述

Fast-Agent 是一个轻量级 LLM Agent 框架，支持多种大语言模型提供商，具备工具调用、技能扩展、本地数据库等能力。

### 核心特性

- 多 LLM 提供商支持（OpenAI、Claude、Gemini、DeepSeek、Qwen、Bailian、Ollama、Azure）
- 工具调用循环（支持流式和非流式）
- 可扩展的技能系统
- 内嵌 MongoDB 服务
- 跨平台可执行文件打包

---

## 目录结构

```
fast-agent/
├── index.js              # Agent 主类
├── interactive.js        # 交互式 CLI 入口
├── web.js               # Web 服务入口
├── web_server.js        # Web 服务器实现
├── config.js            # 配置管理
├── skills.js            # 技能管理器
├── logger.js            # 日志模块
├── conversation_store.js # 对话存储
├── mcp_http_server.js   # MCP HTTP 服务
│
├── providers/           # LLM 提供商
│   ├── base.js         # 基类
│   ├── openai.js       # OpenAI 兼容接口
│   ├── claude.js       # Claude
│   ├── gemini.js       # Gemini
│   └── azure.js        # Azure OpenAI
│
├── tools/              # 内置工具
│   ├── file.js        # 文件操作
│   ├── http.js        # HTTP 请求
│   ├── mongo.js       # MongoDB 操作
│   ├── mongod_service.js  # MongoDB 服务管理
│   ├── system.js      # 系统工具
│   ├── utils.js       # 实用工具
│   └── browser.js     # 浏览器自动化
│
├── skills/            # 技能模块
│   ├── system_context/ # 系统上下文（核心技能）
│   ├── model_manager/  # 模型管理（核心技能）
│   ├── skill_market/   # 技能市场（核心技能）
│   ├── skill_installer.js # 技能安装器
│   ├── mcp_client/     # MCP 客户端
│   ├── calculator/    # 计算器
│   ├── docx/         # Word 文档
│   ├── pdf/          # PDF 处理
│   ├── pptx/         # PPT 处理
│   ├── xlsx/         # Excel 处理
│   ├── txt/          # 文本处理
│   ├── web_search/   # 网页搜索
│   ├── http_request/ # HTTP 请求
│   ├── get_time/     # 获取时间
│   ├── edge_control/ # Edge 浏览器控制
│   ├── image/        # 图像处理
│   ├── memory/       # 知识图谱记忆
│   └── code/         # 代码执行
│
├── scripts/          # 构建脚本
│   └── build.mjs    # 主构建脚本
│
├── mongod/          # MongoDB 资源（不提交到 Git）
│   └── mongod-resources.json  # 资源配置（OSS URL）
│
├── public/          # Web 静态资源
│   ├── index.html    # 主 HTML 文件
│   ├── css/          # 样式文件
│   │   ├── variables.css   # CSS 变量
│   │   ├── base.css        # 基础样式
│   │   ├── layout.css      # 布局样式
│   │   ├── components.css  # 组件样式
│   │   └── responsive.css  # 响应式样式
│   ├── js/           # JavaScript 模块
│   │   ├── api.js          # API 调用封装
│   │   ├── state.js        # 状态管理
│   │   ├── ui.js           # UI 工具函数
│   │   ├── conversation.js # 对话管理
│   │   ├── skills.js       # 技能管理
│   │   ├── mcp.js          # MCP 配置
│   │   └── app.js          # 主应用入口
│   ├── logo.ico
│   └── logo.jpg
│
├── config.json      # 默认配置
├── .env            # 环境变量（不提交）
├── .env_r          # 环境变量模板
└── package.json
```

---

## Web 前端架构

Fast-Agent 的 Web 界面采用模块化设计，遵循 KISS 原则，将原本的单文件拆分为多个独立模块。

### 目录结构

```
public/
├── index.html        # 主 HTML 文件（精简版）
├── css/              # 样式文件
│   ├── variables.css # CSS 变量定义
│   ├── base.css      # 基础样式重置
│   ├── layout.css    # 布局样式
│   ├── components.css # 组件样式
│   └── responsive.css # 响应式样式
├── js/               # JavaScript 模块
│   ├── api.js        # API 端点定义
│   ├── state.js      # 全局状态管理
│   ├── ui.js         # UI 工具函数
│   ├── conversation.js # 对话管理
│   ├── skills.js     # 技能管理
│   ├── mcp.js        # MCP 配置
│   └── app.js        # 主应用入口
├── logo.ico
└── logo.jpg
```

### 模块说明

| 模块 | 文件 | 职责 |
|------|------|------|
| API | api.js | 定义所有 API 端点 |
| State | state.js | 管理全局状态（对话、配置、流式传输） |
| UI | ui.js | UI 工具函数（渲染、格式化、通知） |
| Conversation | conversation.js | 对话的 CRUD 和流式聊天 |
| Skills | skills.js | 技能的加载、安装、卸载 |
| MCP | mcp.js | MCP HTTP Server 配置 |
| App | app.js | 应用初始化和全局函数导出 |

### CSS 模块说明

| 模块 | 文件 | 内容 |
|------|------|------|
| Variables | variables.css | CSS 变量（颜色、间距、圆角） |
| Base | base.css | 重置样式、滚动条、动画 |
| Layout | layout.css | 布局结构（侧边栏、头部、聊天区） |
| Components | components.css | 组件样式（模态框、卡片、按钮） |
| Responsive | responsive.css | 响应式适配 |

### 设计原则

1. **模块化**：每个功能独立成模块，便于维护和测试
2. **单一职责**：每个模块只负责一个功能领域
3. **全局导出**：通过 `window` 对象导出模块，供 HTML 调用
4. **渐进加载**：脚本按依赖顺序加载

---

## 核心模块说明

### 1. Agent 类 (`index.js`)

主入口类，负责：
- 初始化 LLM 提供商
- 管理对话历史
- 执行工具调用循环
- 支持流式和非流式聊天

#### 默认系统提示词

Agent 内置了默认系统提示词，告诉 LLM 它的身份和能力：

```javascript
const DEFAULT_SYSTEM_PROMPT = `你是 Fast-Agent，一个运行在 Fast-Agent 框架上的 AI 助手。

## 关于你自己
- 你可以使用 skill_system_context 技能查询当前系统状态（包括你正在使用的模型）
- 你可以使用 skill_model_manager 技能管理模型配置（切换、查看、测试）

## 重要提示
1. 当用户询问你是什么模型、你的能力、你的配置时，请使用工具来获取准确信息
2. 不要猜测或幻觉你的模型名称、版本或能力，始终通过工具查询
...`;
```

用户自定义的系统提示词会追加到默认提示词后面。

#### 使用示例

```javascript
import { createAgent } from './index.js';

const agent = await createAgent();
const response = await agent.chat('你好');
```

### 2. 配置系统 (`config.js`)

- 支持多级配置：默认配置 → 内置配置 → 外部配置 → 环境变量
- 自动加载 `.env` 文件
- 支持外部 skills 目录扩展

### 3. 技能系统 (`skills.js`)

- 纯 JavaScript 模块，无需 Python
- 自动发现和加载技能
- 支持多目录覆盖（内置 → 外部）
- 通过 `SKILL.md` 定义技能元数据

### 4. 工具系统 (`tools/`)

| 工具前缀 | 模块 | 功能 |
|---------|------|------|
| `file_` | file.js | 文件读写、目录操作 |
| `http_` | http.js | HTTP 请求 |
| `mongo_` | mongo.js | MongoDB CRUD |
| `system_` | system.js | 系统命令、进程管理 |
| `utils_` | utils.js | 哈希、UUID、编码等 |

### 5. 系统上下文技能 (`skills/system_context/`)

**核心技能**：让 LLM 了解当前系统的完整状态。

#### 功能

- 系统环境信息（OS、Node.js 版本、工作目录等）
- 可用工具列表（文件、HTTP、MongoDB、系统工具等）
- 已加载的技能列表
- 配置状态（LLM 提供商、模型等）
- 数据库连接状态

#### 调用方式

```javascript
// 简要信息
{ "detail": "brief" }

// 完整信息（包含硬件、网络等）
{ "detail": "full" }
```

#### 使用场景

1. 用户询问"你有什么能力"时
2. 用户询问系统状态时
3. 需要了解当前环境信息时
4. 调试或排查问题时

### 6. 模型管理技能 (`skills/model_manager/`)

**核心技能**：让智能体自主管理 LLM 提供商和模型配置。

#### 功能

- **switch**: 切换到指定的提供商/模型
- **save**: 将当前配置保存为默认配置
- **list**: 列出所有可用的提供商和模型
- **current**: 显示当前使用的提供商和模型
- **test**: 测试当前模型连接是否正常

#### 调用方式

```javascript
// 列出可用提供商
{ "action": "list" }

// 切换模型
{ "action": "switch", "provider": "deepseek", "model": "deepseek-chat" }

// 切换并保存为默认
{ "action": "switch", "provider": "qwen", "saveAsDefault": true }

// 显示当前配置
{ "action": "current" }

// 测试连接
{ "action": "test" }
```

#### 使用场景

1. 用户要求使用特定模型时自动切换
2. 当前模型失败时自动切换到备用模型
3. 保存用户偏好的模型配置
4. 查看系统支持的模型列表

### 7. 技能市场技能 (`skills/skill_market/`)

**核心技能**：让智能体自主发现、搜索和安装新技能。

#### 支持的市场源

| 市场源 | 说明 | 类型 |
|--------|------|------|
| mcp-registry | MCP 官方注册表 | MCP Server |
| mcp-so | MCP.so 第三方市场 (18000+ servers) | MCP Server |
| npm | NPM 包管理器 | Skill/MCP |
| github | GitHub 仓库 | Skill/MCP |

#### 功能

- **search**: 搜索技能和 MCP 服务器
- **list**: 列出已安装技能
- **info**: 查看技能详情
- **install**: 安装新技能
- **uninstall**: 卸载技能
- **sources**: 列出市场源

#### 调用方式

```javascript
// 搜索文件相关技能
{ "action": "search", "query": "file", "type": "all" }

// 从 MCP Registry 安装
{ "action": "install", "source": "mcp-registry:filesystem" }

// 从 GitHub 安装
{ "action": "install", "source": "github:modelcontextprotocol/servers" }

// 查看已安装
{ "action": "list" }
```

#### 使用场景

1. 用户要求新功能时，搜索并安装相应技能
2. 发现当前能力不足时，主动搜索扩展
3. 管理和维护已安装的技能

### 8. MCP 客户端技能 (`skills/mcp_client/`)

**核心技能**：连接外部 MCP 服务器，扩展智能体能力。

#### 支持的传输类型

| 类型 | 说明 | 使用场景 |
|------|------|----------|
| stdio | 标准输入输出 | 本地 MCP 服务器进程 |
| http | HTTP 传输 | 远程 MCP 服务器 |
| sse | Server-Sent Events | 实时推送的服务器 |

#### 功能

- **connect**: 连接 MCP 服务器
- **disconnect**: 断开连接
- **list**: 列出所有连接
- **tools**: 列出可用工具
- **call**: 调用工具
- **status**: 查看连接状态

#### 调用方式

```javascript
// 连接本地 MCP 服务器
{
  "action": "connect",
  "name": "filesystem",
  "config": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
  }
}

// 列出工具
{ "action": "tools", "name": "filesystem" }

// 调用工具
{ "action": "call", "name": "filesystem", "tool": "read_file", "args": { "path": "/file.txt" } }
```

#### 常用 MCP 服务器

- `@modelcontextprotocol/server-filesystem` - 文件系统操作
- `@modelcontextprotocol/server-github` - GitHub API
- `@modelcontextprotocol/server-postgres` - PostgreSQL 数据库
- `@modelcontextprotocol/server-memory` - 知识图谱记忆

### 9. 图像处理技能 (`skills/image/`)

支持图像格式转换、压缩、裁剪、缩放、水印等操作。

#### 功能

| 操作 | 说明 | 参数 |
|------|------|------|
| convert | 格式转换 | format |
| resize | 调整大小 | width, height, fit |
| crop | 裁剪 | x, y, width, height |
| rotate | 旋转 | degrees |
| compress | 压缩 | quality |
| watermark | 添加水印 | watermarkPath |
| info | 获取信息 | - |
| thumbnail | 生成缩略图 | width, height |

#### 调用方式

```javascript
// 格式转换
{ "action": "convert", "input": "image.png", "format": "webp" }

// 调整大小
{ "action": "resize", "input": "large.jpg", "width": 800, "height": 600 }

// 压缩图片
{ "action": "compress", "input": "photo.jpg", "quality": 80 }
```

### 10. 知识图谱记忆技能 (`skills/memory/`)

为智能体提供持久化的记忆存储能力，支持构建知识图谱。

#### 核心概念

- **实体 (Entity)**: 记忆中的对象，如人、地点、事件等
- **关系 (Relation)**: 实体之间的连接
- **观察 (Observation)**: 关于实体的事实或信息

#### 功能

- **create_entities**: 创建实体
- **create_relations**: 创建关系
- **add_observations**: 添加观察
- **read_graph**: 读取整个图谱
- **search_nodes**: 搜索节点
- **delete_***: 删除操作

#### 调用方式

```javascript
// 创建实体
{
  "action": "create_entities",
  "entities": [{
    "name": "用户",
    "entityType": "person",
    "observations": ["喜欢 TypeScript"]
  }]
}

// 搜索节点
{ "action": "search_nodes", "query": "项目" }
```

### 11. 代码执行技能 (`skills/code/`)

安全执行 JavaScript/Python/Bash 代码片段。

#### 支持的语言

| 语言 | 执行方式 | 限制 |
|------|----------|------|
| JavaScript | Node.js vm | 无文件系统访问 |
| Python | 子进程 | 需要安装 Python |
| Bash | 子进程 | 仅限安全命令 |

#### 调用方式

```javascript
// JavaScript
{ "language": "javascript", "code": "return [1,2,3].map(x => x * 2);" }

// Python
{ "language": "python", "code": "print(sum([1,2,3,4,5]))" }
```

### 12. 对话版本管理

支持对话历史版本管理，编辑消息或重新生成AI回复时会创建新版本。

#### 功能

- **消息编辑**：点击用户消息旁的编辑按钮，修改后确认发送会创建新版本
- **重新生成**：点击AI回复旁的重新生成按钮，使用相同或不同模型重新生成
- **模型选择**：长按重新生成按钮可弹出模型选择器，选择指定模型重新生成
- **版本切换**：对话标题旁显示版本选择器，可切换到历史版本

#### API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/conversations/:id/versions` | GET | 获取对话版本列表 |
| `/api/conversations/:id/clone` | POST | 克隆对话创建新版本 |
| `/api/conversations/:id/messages/:msgIndex` | PUT | 编辑消息并创建新版本 |
| `/api/conversations/:id/regenerate` | POST | 重新生成AI回复并创建新版本 |

#### 使用场景

1. 用户想修改之前的消息重新提问
2. 用户对AI回复不满意想重新生成
3. 用户想尝试不同模型的回复效果
4. 用户想查看或恢复到之前的历史版本

### 13. 故障转移机制

当主模型请求失败时，系统会自动尝试切换到备用提供商重试。

#### 配置方式

```json
{
  "defaultProvider": "bailian",
  "fallbackProviders": ["deepseek", "qwen"],
  "providers": { ... }
}
```

#### 工作流程

1. 主模型请求失败
2. 自动切换到 `fallbackProviders` 列表中的第一个可用提供商
3. 重试请求
4. 如果仍失败，继续尝试下一个备用提供商
5. 所有提供商都失败时返回错误

#### 代码中使用

```javascript
// 设置备用提供商
agent.setFallbackProviders(['deepseek', 'qwen', 'openai']);

// 添加单个备用提供商
agent.addFallbackProvider('gemini');
```

### 14. MongoDB 服务 (`tools/mongod_service.js`)

- 内嵌 mongod 进程管理
- 跨平台支持（Windows/macOS/Linux）
- 自动健康检查和重启
- 优雅关闭
- **端口冲突智能处理**
- **连接测试和认证支持**
- **云数据库支持**

#### 完整配置选项

```json
{
  "mongod": {
    "enabled": true,
    "autoStart": true,
    "port": 27017,
    "host": "127.0.0.1",
    "dbName": "fast_agent",
    "dataDir": "mongod/data",
    "logDir": "mongod/log",
    
    // 认证配置（连接需要认证的 MongoDB）
    "username": "",
    "password": "",
    "authSource": "admin",
    
    // 云数据库配置
    "cloud": {
      "enabled": false,
      "uri": "mongodb+srv://user:pass@cluster.mongodb.net/db",
      "dbName": "fast_agent"
    },
    
    // 端口冲突处理策略
    "portConflictStrategy": "auto",
    
    // 无数据库运行（强烈不建议）
    "allowNoDatabase": false
  }
}
```

#### 端口冲突处理策略

当检测到 27017 端口被占用时，系统会自动判断并处理：

| 情况 | 处理方式 |
|------|----------|
| 端口未被占用 | 启动内置 mongod 服务 |
| 端口被 MongoDB 占用（无认证） | 自动使用现有服务 |
| 端口被 MongoDB 占用（需认证） | 提示配置用户名密码 |
| 端口被其他程序占用 | 报错并提示解决方案 |

`portConflictStrategy` 取值：
- `auto`: 自动检测并处理（默认）
- `always_start`: 总是尝试启动新服务
- `use_existing`: 优先使用已有服务

#### 连接认证 MongoDB

如果系统中的 MongoDB 需要认证：

```json
{
  "mongod": {
    "username": "your_username",
    "password": "your_password",
    "authSource": "admin"
  }
}
```

#### 使用云数据库

支持 MongoDB Atlas 等云数据库服务：

```json
{
  "mongod": {
    "cloud": {
      "enabled": true,
      "uri": "mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/fast_agent",
      "dbName": "fast_agent"
    }
  }
}
```

#### 无数据库运行

如果确实无法配置数据库，可以允许无数据库运行：

```json
{
  "mongod": {
    "allowNoDatabase": true
  }
}
```

⚠️ **强烈不建议**：无数据库运行会导致部分功能不可用，数据无法保存。

---

## MongoDB 资源管理

### 概述

由于 mongod 二进制文件体积较大（约 200MB+），不提交到 Git 仓库。采用以下策略：

1. **开发环境**：从 OSS 下载到 `mongod/` 目录
2. **发布版本**：首次运行时自动下载对应平台的 mongod

### 资源配置文件

`mongod/mongod-resources.json`:

```json
{
  "version": "7.0.4",
  "baseUrl": "https://your-oss-bucket.oss-cn-hangzhou.aliyuncs.com/fast-agent/mongod",
  "platforms": {
    "win32-x64": {
      "file": "mongod.win",
      "sha256": "..."
    },
    "darwin-x64": {
      "file": "mongod.mac_x86",
      "sha256": "..."
    },
    "darwin-arm64": {
      "file": "mongod.mac_arm64",
      "sha256": "..."
    },
    "linux-x64": {
      "file": "mongod.linux",
      "sha256": "..."
    }
  }
}
```

### 下载流程

1. 检测当前平台
2. 读取资源配置
3. 检查本地是否已存在
4. 不存在则从 OSS 下载
5. 验证 SHA256（可选）

### 开发环境下载

```bash
# 下载当前平台的 mongod
npm run download:mongod

# 下载所有平台
npm run download:mongod:all

# 下载指定平台
node scripts/download_mongod.mjs --platform=darwin-arm64
```

---

## 构建和发布

### 开发命令

```bash
# 交互式运行
npm run interactive

# Web 服务
npm run web

# 测试不同提供商
npm run test:deepseek
npm run test:claude
```

### 构建命令

```bash
# 构建当前平台
npm run build

# 构建所有平台
npm run build:all
```

### 构建流程

1. **esbuild 打包**
   - 入口：`index.js`, `interactive.js`, `web_server.js`
   - 输出：`dist/` 目录
   - 格式：CommonJS（兼容 pkg）

2. **pkg 打包**
   - 目标：Windows x64, macOS x64/arm64, Linux x64
   - 输出：`release/` 目录

3. **资源复制**
   - `skills/` → `release/skills/`
   - `public/` → `release/public/`
   - `config.json` → `release/`
   - `.env` → `release/`

### 发布目录结构

```
release/
├── fast-agent-win-x64.exe
├── fast-agent-macos-x64
├── fast-agent-macos-arm64
├── fast-agent-linux-x64
├── skills/
├── public/
├── mongod/              # 首次运行时下载
│   └── mongod-resources.json
├── config.json
└── .env
```

---

## 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DEFAULT_PROVIDER` | 默认 LLM 提供商 | `deepseek` |
| `OPENAI_API_KEY` | OpenAI API Key | `sk-...` |
| `CLAUDE_API_KEY` | Claude API Key | `sk-ant-...` |
| `GEMINI_API_KEY` | Gemini API Key | `...` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | `sk-...` |
| `QWEN_API_KEY` | 通义千问 API Key | `sk-...` |
| `BAILIAN_API_KEY` | 阿里百炼 API Key | `sk-...` |
| `AZURE_API_KEY` | Azure OpenAI Key | `...` |
| `AZURE_ENDPOINT` | Azure 端点 | `https://xxx.openai.azure.com` |

---

## 添加新技能

1. 在 `skills/` 下创建目录：

```
skills/my_skill/
├── SKILL.md      # 技能描述
└── main.js       # 入口文件
```

2. `SKILL.md` 格式：

```markdown
---
name: my_skill
description: 技能描述
entry: main.js
parameters: |
  {
    "type": "object",
    "properties": {
      "input": { "type": "string" }
    }
  }
---

# 我的技能

详细说明...
```

3. `main.js` 格式：

```javascript
export default {
  async execute(params, context) {
    // 实现逻辑
    return { result: '...' };
  }
};
```

---

## 添加新 LLM 提供商

1. 在 `providers/` 下创建文件：

```javascript
// providers/my_provider.js
import { BaseProvider } from './base.js';

export class MyProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.example.com/v1';
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  // 实现其他方法...
}
```

2. 在 `providers/index.js` 中注册：

```javascript
export function createProvider(name, config) {
  switch (name) {
    case 'my_provider':
      return new MyProvider(config);
    // ...
  }
}
```

---

## 故障排查

### MongoDB 端口冲突

**症状**: 启动时提示 `端口 27017 已被非 MongoDB 服务占用`

**解决方案**:

1. **修改端口** (推荐)
   ```json
   // config.json
   {
     "mongod": {
       "port": 27018  // 改为其他端口
     }
   }
   ```

2. **使用现有 MongoDB 服务**
   如果系统已安装 MongoDB，程序会自动检测并使用

3. **关闭占用端口的程序**
   ```bash
   # Windows
   netstat -ano | findstr 27017
   taskkill /PID <进程ID> /F
   
   # Linux/Mac
   lsof -i :27017
   kill -9 <PID>
   ```

### MongoDB 启动失败

1. 检查端口占用：`netstat -an | grep 27017`
2. 检查数据目录权限
3. 查看日志：`mongod/log/mongod.log`
4. 检查是否有异常关闭的锁文件：删除 `mongod/data/mongod.lock`

### MongoDB 认证失败

**症状**: 提示 `认证失败：用户名或密码错误`

**解决方案**:

1. 确认 MongoDB 用户名和密码
2. 在 config.json 中配置正确的认证信息：
   ```json
   {
     "mongod": {
       "username": "correct_username",
       "password": "correct_password",
       "authSource": "admin"
     }
   }
   ```
3. 确认用户有访问目标数据库的权限

### 云数据库连接失败

**症状**: 提示 `云数据库连接失败`

**解决方案**:

1. 检查网络连接
2. 确认云数据库 URI 格式正确
3. 检查 IP 白名单设置
4. 确认云数据库服务正常运行

### 技能加载失败

1. 检查 `SKILL.md` 格式
2. 检查 `main.js` 导出格式
3. 查看控制台错误信息

### 构建失败

1. 检查 Node.js 版本（需要 18+）
2. 清理 `dist/` 和 `release/` 目录
3. 重新安装依赖：`rm -rf node_modules && npm install`

---

## 技能市场生态

### 概述

Fast-Agent 支持从多个技能市场源搜索和安装技能，让智能体能够自主扩展能力。

### 支持的市场源

#### 1. MCP Registry（官方）

- **URL**: https://registry.modelcontextprotocol.io/
- **说明**: MCP 官方注册表，提供官方和社区 MCP 服务器
- **特点**: 权威、稳定、API 标准化

#### 2. MCP.so（第三方）

- **URL**: https://mcp.so/
- **说明**: 第三方 MCP 市场，收集了 18000+ MCP 服务器
- **特点**: 数量多、分类全、更新快

#### 3. NPM

- **URL**: https://www.npmjs.com/
- **说明**: Node.js 包管理器
- **特点**: 丰富的 JavaScript 生态

#### 4. GitHub

- **URL**: https://github.com/
- **说明**: 代码托管平台
- **特点**: 开源、可追踪、可贡献

### 推荐的 MCP 服务器

| 服务器 | 说明 | 安装命令 |
|--------|------|----------|
| filesystem | 文件系统操作 | `npx -y @modelcontextprotocol/server-filesystem /path` |
| github | GitHub API | `npx -y @modelcontextprotocol/server-github` |
| postgres | PostgreSQL 数据库 | `npx -y @modelcontextprotocol/server-postgres` |
| memory | 知识图谱记忆 | `npx -y @modelcontextprotocol/server-memory` |
| fetch | 网页抓取 | `npx -y @modelcontextprotocol/server-fetch` |
| puppeteer | 浏览器自动化 | `npx -y @modelcontextprotocol/server-puppeteer` |

### 技能开发规范

#### 目录结构

```
skills/my_skill/
├── SKILL.md      # 技能描述（必需）
├── main.js       # 入口文件（必需）
├── package.json  # 依赖（可选）
└── lib/          # 库文件（可选）
```

#### SKILL.md 格式

```markdown
---
name: my_skill
description: 技能描述
entry: main.js
parameters: |
  {
    "type": "object",
    "properties": {
      "action": { "type": "string" }
    },
    "required": ["action"]
  }
---

# 技能标题

详细说明...
```

#### main.js 格式

```javascript
export default {
  name: 'my_skill',
  description: '技能描述',
  
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string' }
    },
    required: ['action']
  },

  async execute(params, context) {
    const { action } = params;
    
    // 实现逻辑
    
    return { success: true, result: '...' };
  }
};
```

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.3.0 | 2026-03 | 对话版本管理：消息编辑、AI回复重新生成、版本切换 |
| 1.2.1 | 2026-03 | 添加默认系统提示词，防止智能体幻觉自身身份，引导使用工具查询模型信息 |
| 1.2.0 | 2026-03 | Web 前端模块化拆分（KISS 原则），CSS/JS 独立文件 |
| 1.1.0 | 2026-03 | 新增技能市场、MCP客户端、图像处理、知识图谱记忆、代码执行技能 |
| 1.0.0 | - | 初始版本 |

---

## 维护者注意事项

1. **mongod 资源更新**：更新后需重新计算 SHA256 并上传到 OSS
2. **新增依赖**：检查是否与 pkg 打包兼容
3. **跨平台测试**：发布前在目标平台测试
4. **配置变更**：同步更新 `.env_r` 模板
5. **技能开发**：遵循 SKILL.md + main.js 规范
6. **MCP 集成**：新技能可考虑同时支持 MCP 协议
7. **市场同步**：定期同步官方 MCP Registry 更新
8. **Web 前端修改**：遵循模块化原则，修改对应模块文件而非 index.html
