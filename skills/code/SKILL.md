---
name: code
description: 代码执行技能 - 安全执行 JavaScript/Python 代码片段。支持代码运行、结果返回、超时控制。
entry: main.js
parameters: |
  {
    "type": "object",
    "properties": {
      "language": {
        "type": "string",
        "enum": ["javascript", "python", "bash"],
        "description": "编程语言"
      },
      "code": {
        "type": "string",
        "description": "要执行的代码"
      },
      "timeout": {
        "type": "integer",
        "minimum": 1000,
        "maximum": 60000,
        "default": 10000,
        "description": "超时时间(毫秒)"
      },
      "context": {
        "type": "object",
        "description": "执行上下文变量"
      }
    },
    "required": ["language", "code"]
  }
---

# 代码执行技能

安全地执行代码片段并返回结果。

## 支持的语言

| 语言 | 执行方式 | 限制 |
|------|----------|------|
| JavaScript | Node.js vm | 无文件系统访问 |
| Python | 子进程 | 需要安装 Python |
| Bash | 子进程 | 仅限安全命令 |

## 使用示例

### JavaScript

```javascript
{
  "language": "javascript",
  "code": "const sum = (a, b) => a + b; return sum(1, 2);"
}
```

### Python

```javascript
{
  "language": "python",
  "code": "print(sum([1, 2, 3, 4, 5]))"
}
```

### 带上下文

```javascript
{
  "language": "javascript",
  "code": "return data.map(x => x * 2);",
  "context": { "data": [1, 2, 3] }
}
```

## 安全措施

1. JavaScript 在沙箱环境中执行
2. 所有执行都有超时限制
3. 禁止访问文件系统（JavaScript）
4. 内存使用限制

## 注意事项

- 代码执行有超时限制（默认10秒）
- Python 需要系统安装 Python 环境
- Bash 仅允许执行白名单命令
