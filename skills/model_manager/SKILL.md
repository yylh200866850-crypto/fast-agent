---
name: model_manager
description: 模型管理技能，支持切换LLM提供商/模型、保存配置、查看可用模型
entry: main.js
parameters: |
  {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["switch", "save", "list", "current", "test"],
        "description": "操作类型：switch=切换模型，save=保存当前配置为默认，list=列出可用提供商，current=显示当前配置，test=测试连接"
      },
      "provider": {
        "type": "string",
        "description": "提供商名称（如 openai, deepseek, qwen, bailian 等）"
      },
      "model": {
        "type": "string",
        "description": "模型名称（可选，不填则使用提供商默认模型）"
      },
      "saveAsDefault": {
        "type": "boolean",
        "description": "切换后是否保存为默认配置"
      }
    },
    "required": ["action"]
  }
---

# 模型管理技能

让智能体能够自主管理 LLM 提供商和模型配置。

## 功能

- **switch**: 切换到指定的提供商/模型
- **save**: 将当前配置保存为默认配置
- **list**: 列出所有可用的提供商和模型
- **current**: 显示当前使用的提供商和模型
- **test**: 测试当前模型连接是否正常

## 使用场景

1. 用户要求使用特定模型时自动切换
2. 当前模型失败时自动切换到备用模型
3. 保存用户偏好的模型配置
4. 查看系统支持的模型列表
