---
name: system_context
description: 获取系统上下文信息（环境、工具、技能、配置、数据库状态）
entry: main.js
parameters: |
  {
    "type": "object",
    "properties": {
      "detail": {
        "type": "string",
        "enum": ["brief", "full"],
        "description": "信息详细程度：brief=简要信息，full=完整信息"
      }
    }
  }
---

# 系统上下文技能

获取当前 Fast-Agent 系统的完整上下文信息，包括：

- **系统环境**：操作系统、Node.js 版本、运行目录等
- **可用工具**：文件、HTTP、MongoDB、系统、实用工具列表
- **已加载技能**：所有已安装的 Skills
- **配置状态**：当前使用的 LLM 提供商、模型等
- **数据库状态**：MongoDB 连接状态

## 使用场景

1. 用户询问"你有什么能力"时调用
2. 用户询问系统状态时调用
3. 需要了解当前环境信息时调用
4. 调试或排查问题时调用

## 参数说明

- `detail`: 
  - `brief`: 返回简要信息（默认）
  - `full`: 返回完整详细信息
