---
name: memory
description: 知识图谱记忆技能 - 持久化存储和检索信息。支持实体、关系、观察的创建和查询，构建长期记忆系统。
entry: main.js
parameters: |
  {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["create_entities", "create_relations", "add_observations", "delete_entities", "delete_relations", "delete_observations", "read_graph", "search_nodes", "open_nodes", "clear"],
        "description": "操作类型"
      },
      "entities": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "entityType": { "type": "string" },
            "observations": { "type": "array", "items": { "type": "string" } }
          }
        },
        "description": "create_entities时: 实体列表"
      },
      "relations": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "from": { "type": "string" },
            "to": { "type": "string" },
            "relationType": { "type": "string" }
          }
        },
        "description": "create_relations时: 关系列表"
      },
      "observations": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "entityName": { "type": "string" },
            "contents": { "type": "array", "items": { "type": "string" } }
          }
        },
        "description": "add_observations时: 观察列表"
      },
      "entityNames": {
        "type": "array",
        "items": { "type": "string" },
        "description": "delete_entities时: 实体名称列表"
      },
      "relationIds": {
        "type": "array",
        "items": { "type": "string" },
        "description": "delete_relations时: 关系ID列表"
      },
      "deletions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "entityName": { "type": "string" },
            "observations": { "type": "array", "items": { "type": "string" } }
          }
        },
        "description": "delete_observations时: 删除列表"
      },
      "query": { "type": "string", "description": "search_nodes时: 搜索关键词" },
      "names": { "type": "array", "items": { "type": "string" }, "description": "open_nodes时: 节点名称列表" }
    },
    "required": ["action"]
  }
---

# 知识图谱记忆技能

为智能体提供持久化的记忆存储能力，支持构建知识图谱。

## 核心概念

- **实体 (Entity)**: 记忆中的对象，如人、地点、事件等
- **关系 (Relation)**: 实体之间的连接
- **观察 (Observation)**: 关于实体的事实或信息

## 使用场景

1. 记住用户的偏好和习惯
2. 存储项目相关的知识
3. 构建上下文记忆
4. 跨会话保持信息

## 操作说明

### 创建实体

```javascript
{
  "action": "create_entities",
  "entities": [
    {
      "name": "用户",
      "entityType": "person",
      "observations": ["喜欢使用 TypeScript", "正在开发 AI 项目"]
    }
  ]
}
```

### 创建关系

```javascript
{
  "action": "create_relations",
  "relations": [
    {
      "from": "用户",
      "to": "AI项目",
      "relationType": "正在开发"
    }
  ]
}
```

### 搜索节点

```javascript
{
  "action": "search_nodes",
  "query": "项目"
}
```

### 读取图谱

```javascript
{ "action": "read_graph" }
```

## 存储位置

数据存储在 MongoDB 数据库中，支持持久化。
