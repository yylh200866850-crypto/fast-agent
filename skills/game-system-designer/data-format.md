# 分析数据JSON格式规范

导出Word/Excel文档时，需要先将分析结果整理为以下JSON格式。

## 完整结构

```json
{
  "activityName": "马上有礼",
  "gameType": "捕鱼游戏",
  "components": [
    {
      "name": "活动标题",
      "type": "文本",
      "position": "左上角",
      "size": "120x40",
      "description": "显示活动名称'马上有礼'"
    },
    {
      "name": "关闭按钮",
      "type": "按钮",
      "position": "右上角",
      "size": "40x40",
      "description": "关闭活动弹窗"
    }
  ],
  "structureTree": [
    "├── 顶部区域",
    "│   ├── 活动标题 + 活动时间",
    "│   ├── 货币显示栏",
    "│   └── 关闭按钮",
    "├── 左侧碎片展示区",
    "│   ├── 碎片拼图容器",
    "│   └── 终极奖励说明",
    "├── 右侧任务列表区",
    "│   ├── 任务行 x5",
    "│   └── 刷新倒计时",
    "└── 底部进度区",
    "    ├── 里程碑进度条",
    "    └── 当前碎片数"
  ],
  "clientSide": {
    "界面布局": [
      "弹窗式全屏活动面板，左侧40%为碎片拼图展示区",
      "右侧60%为任务列表，底部通栏进度条"
    ],
    "交互逻辑": [
      "点击'去完成'→关闭弹窗，跳转对应玩法场景",
      "点击'领取'→播放碎片飞入动画，按钮变灰"
    ],
    "本地逻辑": [
      "刷新倒计时由客户端本地计时，服务器下发目标时间戳"
    ],
    "异常处理": [
      "领取失败时Toast提示'网络异常，请重试'，按钮恢复可点击"
    ]
  },
  "serverSide": {
    "数据结构": [
      "player_activity表：player_id, fragment_count, milestone_claimed[], task_status[]"
    ],
    "接口定义": [
      "GET /activity/info：返回碎片数、任务列表、里程碑状态",
      "POST /activity/claim_task：领取任务奖励",
      "POST /activity/claim_milestone：领取里程碑奖励"
    ],
    "核心逻辑校验": [
      "防止重复领取，碎片数校验不可篡改，活动时间范围校验"
    ],
    "定时任务": [
      "任务列表按倒计时周期刷新重置"
    ]
  },
  "artSide": {
    "UI切图": [
      "活动背景底图、标题艺术字",
      "碎片拼图底图 + 各碎片单独切图",
      "里程碑进度条（底槽+填充+节点图标）",
      "按钮三态：去完成(蓝)、已完成(灰)、领取(黄)"
    ],
    "动效需求": [
      "领取碎片：碎片从按钮飞入拼图区域",
      "里程碑达成：节点发光+弹出奖励浮层",
      "进度条填充动画"
    ],
    "音效提示": [
      "碎片获得音效、里程碑庆祝音效、按钮点击反馈音"
    ]
  }
}
```

## 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| activityName | string | 是 | 活动名称 |
| gameType | string | 是 | 游戏类型 |
| components | array | 是 | UI组件清单 |
| components[].name | string | 是 | 组件名称 |
| components[].type | string | 是 | 组件类型(按钮/文本/图片/进度条/列表项/图标/容器) |
| components[].position | string | 是 | 位置描述 |
| components[].size | string | 否 | 尺寸估算 |
| components[].description | string | 是 | 功能说明 |
| structureTree | string[] | 否 | 界面结构树（每行一个字符串） |
| clientSide | object | 是 | 前端需求（key=类别, value=需求列表） |
| serverSide | object | 是 | 服务器需求 |
| artSide | object | 是 | 美术需求 |
