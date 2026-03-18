# Game System Designer - 游戏系统策划技能

一键分析游戏UI原型图、生成原型线框图、导出策划文档的 QoderWork 技能。

## 功能

- 上传原型图 → 自动识别所有UI组件（基于 Qwen-VL 视觉模型）
- 描述需求 → 从零设计活动系统并生成线框图
- 自动输出前端/服务器/美术三部分需求文档
- 一键导出 Word 策划文档 + Excel 需求清单

## 文件结构

```
game-system-designer/
├── SKILL.md              # 技能主文件（LLM 指令）
├── data-format.md        # JSON 数据格式规范
├── requirements.txt      # Python 依赖
├── install.sh            # Linux/macOS 安装脚本
├── install.bat           # Windows 安装脚本
└── scripts/
    ├── analyze_ui.py         # Qwen-VL 视觉分析
    ├── generate_wireframe.py # 线框图生成器
    ├── export_docx.js        # Word 文档导出
    ├── export_xlsx.py        # Excel 文档导出
    └── package.json          # Node 依赖
```

## 安装

### 方式1：运行安装脚本

```bash
# Linux / macOS
chmod +x install.sh && ./install.sh

# Windows
install.bat
```

### 方式2：手动安装

将整个 `game-system-designer` 文件夹复制到：

| 环境 | 路径 |
|------|------|
| QoderWork (Windows) | `C:\Users\{用户名}\.qoderwork\skills\game-system-designer` |
| QoderWork (macOS) | `~/.qoderwork/skills/game-system-designer` |
| Qoder CLI | `~/.qoder/skills/game-system-designer` |

然后安装依赖：

```bash
pip install requests Pillow openpyxl
cd scripts && npm install
```

## 配置

### DashScope API Key（视觉分析必需）

```bash
# 环境变量方式
export DASHSCOPE_API_KEY=sk-your-key-here

# 或直接修改 scripts/analyze_ui.py 中的 DASHSCOPE_API_KEY
```

### 中文字体（线框图生成必需）

脚本按以下优先级查找中文字体：

1. `/tmp/msyh.ttc` — 推荐预先拷贝到此
2. Windows: `C:/Windows/Fonts/msyh.ttc`
3. Linux: `wqy-microhei` 或 `NotoSansCJK`

如果在 Linux VM 中运行且宿主机是 Windows：
```bash
cp /mnt/host/c/Windows/Fonts/msyh.ttc /tmp/msyh.ttc
```

## 使用

安装后在 QoderWork 中直接使用：

- 上传游戏原型图 → 自动触发分析流程
- 输入"帮我设计一个双倍充值活动" → 自动进入设计模式
- 输出：组件表格 + 原型图(PNG) + 需求文档 + Word/Excel 文件

## 在其他 LLM 平台使用

`SKILL.md` 的内容可以直接作为 System Prompt 喂给任何 LLM。脚本工具需要运行环境支持 Python 和 Node.js。

对于不支持代码执行的平台，LLM 仍可完成分析和文档撰写，只是无法自动生成图片和导出文件。
