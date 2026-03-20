# Fast-Agent

一个轻量级的 LLM Agent 框架，支持多种大语言模型提供商。

## 项目愿景

通过工程化架构设计，让国产大模型在复杂任务场景下发挥超越其参数规模的实战能力。

## 快速开始

### 1. 下载

从 [Releases](https://github.com/user/fast-agent/releases) 页面下载对应平台的版本：

- **Windows**: `fast-agent-win-x64.zip`
- **macOS (Intel)**: `fast-agent-macos-x64.zip`
- **macOS (Apple Silicon)**: `fast-agent-macos-arm64.zip`
- **Linux**: `fast-agent-linux-x64.zip`

### 2. 解压并运行

解压下载的压缩包，双击可执行文件启动。

### 3. 配置

首次启动会自动弹出配置向导：

1. **选择 AI 模型提供商**（如 DeepSeek、OpenAI、Claude 等）
2. **输入 API Key**
3. **测试连接**
4. **保存配置**

配置完成后即可开始对话！

## 支持的 LLM 提供商

| 提供商 | 获取 API Key |
|--------|-------------|
| OpenAI | https://platform.openai.com/api-keys |
| Claude (Anthropic) | https://console.anthropic.com/ |
| Google Gemini | https://aistudio.google.com/apikey |
| DeepSeek | https://platform.deepseek.com/ |
| 通义千问 (Qwen) | https://dashscope.console.aliyun.com/ |
| 阿里百炼 | https://bailian.console.aliyun.com/ |
| Azure OpenAI | https://portal.azure.com/ |
| Ollama (本地) | 无需 API Key |

## 功能特性

- 🤖 **多模型支持**：OpenAI、Claude、Gemini、DeepSeek、Qwen 等
- 🛠️ **工具调用**：支持函数调用和工具循环
- 📦 **技能系统**：可扩展的技能模块
- 💾 **本地存储**：内嵌 MongoDB，数据本地存储
- 🌐 **Web 界面**：现代化的 Web 界面
- 🔒 **隐私安全**：所有数据本地存储，不上传云端

## 手动配置（可选）

如果需要手动配置，可以复制 `.env_r` 为 `.env` 并填写：

```bash
# 复制模板
cp .env_r .env

# 编辑 .env 文件
DEEPSEEK_API_KEY=sk-your-api-key
DEFAULT_PROVIDER=deepseek
```

## MongoDB 说明

程序首次启动时会自动下载 MongoDB（约 80-220MB，视平台而定）。

下载地址：`https://fast-agent.oss-cn-hangzhou.aliyuncs.com/mongod/`

如果下载失败，可以手动下载对应平台的 mongod 文件放到 `mongod/` 目录。

## 系统要求

- **Windows**: Windows 10/11 (x64)
- **macOS**: macOS 11+ (Intel 或 Apple Silicon)
- **Linux**: glibc 2.17+ (x64)

## 常见问题

### Q: 启动后无法访问 Web 界面？

确保端口 3000 没有被占用。可以在 `.env` 文件中修改端口：

```
PORT=3001
```

### Q: MongoDB 启动失败？

1. 检查端口 27017 是否被占用
2. 在 `config.json` 中修改 `mongod.port`
3. 或使用云数据库：设置 `mongod.cloud.enabled = true`

### Q: API Key 无效？

1. 确认 API Key 是否正确
2. 确认账户是否有余额
3. 尝试在配置向导中测试连接

## 更多信息

- [完整文档](https://github.com/user/fast-agent/blob/main/MAINTAINER.md)
- [问题反馈](https://github.com/user/fast-agent/issues)

## 致谢

感谢以下企业和机构对国产大模型发展的贡献：

- 静申数字
- [阿里云](https://www.aliyun.com/) - 通义千问，百炼，瑶池数据库
- [智谱GLM](https://www.zhipuai.cn/) - 智谱AI
- [DeepSeek](https://www.deepseek.com/) - 深度求索

## License

MIT
