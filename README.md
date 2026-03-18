# Fast-Agent

一个轻量级、可扩展的 AI Agent 框架，支持多种 LLM 提供商和插件化技能系统。

## 特性

- **多 LLM 提供商支持** - OpenAI、Claude、Gemini、Azure、DeepSeek、Qwen、Ollama 等
- **插件化技能系统** - 通过 Skill 扩展 Agent 能力，支持动态加载
- **内置工具集** - 文件操作、HTTP 请求、MongoDB、系统命令等
- **流式输出** - 支持流式响应和工具调用
- **故障转移** - 自动切换备用 LLM 提供商
- **Web 界面** - 内置 Web 服务器和聊天界面
- **MCP 协议** - 支持 Model Context Protocol

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Fast-Agent                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Agent     │  │  Providers  │  │    SkillManager     │  │
│  │  (核心引擎)  │──│ (LLM 适配)  │──│    (插件系统)        │  │
│  └──────┬──────┘  └─────────────┘  └──────────┬──────────┘  │
│         │                                      │             │
│         └──────────────────┬───────────────────┘             │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Tools (工具层)                      │   │
│  │  file_* │ http_* │ mongo_* │ system_* │ utils_*      │   │
│  └──────────────────────────────────────────────────────┘   │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Skills (技能层)                      │   │
│  │  pdf │ xlsx │ docx │ pptx │ image │ web_search │ ... │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 核心模块

| 模块 | 说明 |
|------|------|
| `Agent` | 核心 Agent 引擎，处理对话循环和工具调用 |
| `Providers` | LLM 提供商适配层，统一不同 API 接口 |
| `SkillManager` | 技能管理器，动态加载和执行 Skill |
| `Tools` | 内置工具集，提供基础能力 |

### 目录结构

```
fast-agent/
├── index.js              # Agent 主入口
├── web.js                # Web 服务入口
├── providers/            # LLM 提供商
│   ├── base.js           # 基类
│   ├── openai.js         # OpenAI 兼容
│   ├── claude.js         # Claude
│   └── gemini.js         # Gemini
├── skills/               # 技能插件
│   ├── pdf/              # PDF 处理
│   ├── xlsx/             # Excel 处理
│   ├── docx/             # Word 处理
│   ├── image/            # 图像处理
│   └── ...               # 更多技能
├── tools/                # 内置工具
│   ├── file.js           # 文件操作
│   ├── http.js           # HTTP 请求
│   ├── mongo.js          # MongoDB
│   └── system.js         # 系统命令
├── public/               # Web 界面
└── config.js             # 配置管理
```

## 快速开始

### 安装

```bash
git clone https://github.com/your-username/fast-agent.git
cd fast-agent
npm install
```

### 配置

创建 `.env` 文件：

```env
# 日志级别
LOG_LEVEL=INFO

# 默认 LLM 提供商
DEFAULT_PROVIDER=openai

# API Keys
OPENAI_API_KEY=sk-xxx
# 或其他提供商
DEEPSEEK_API_KEY=sk-xxx
QWEN_API_KEY=sk-xxx
```

### 运行

```bash
# 命令行交互模式
npm run interactive

# Web 界面模式
npm run web
```

## 技能开发

创建自定义技能非常简单：

```javascript
// skills/my_skill/main.js
export default {
  name: 'my_skill',
  description: '我的自定义技能',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: '输入内容' }
    },
    required: ['input']
  },
  async execute(params, context) {
    // 你的逻辑
    return { result: '处理完成' };
  }
};
```

## 多智能体架构（规划中）

Fast-Agent 正在开发多智能体协作架构，这是本项目的核心演进方向。敬请期待。

## 贡献

欢迎贡献代码、报告问题或提出建议！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

本项目采用 [GPL v3](LICENSE) 许可证开源。

## 致谢

感谢所有开源项目和贡献者让 Fast-Agent 成为可能。
