#!/usr/bin/env python3
"""
游戏UI原型图分析脚本
通过阿里DashScope Qwen-VL视觉模型分析游戏UI原型图，输出组件清单和需求文档。

用法:
  python analyze_ui.py <图片路径> [--mode full|components|annotate] [--game-type 捕鱼|卡牌|RPG]

依赖:
  pip install requests Pillow
"""

import argparse
import base64
import json
import os
import sys
import re
import requests
from pathlib import Path

# ============ 配置 ============
DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "sk-ac466365ed804efebaafaa87fb81a326")
BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
MODEL_VL = "qwen-vl-max"  # 视觉理解模型
# ==============================


def encode_image_to_base64(image_path: str) -> str:
    """将本地图片编码为base64 Data URI"""
    ext = Path(image_path).suffix.lower()
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp"}
    mime = mime_map.get(ext, "image/png")
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime};base64,{b64}"


def call_qwen_vl(image_data: str, prompt: str, model: str = MODEL_VL) -> str:
    """调用Qwen-VL视觉模型"""
    headers = {
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_data}},
                    {"type": "text", "text": prompt}
                ]
            }
        ],
        "max_tokens": 4096
    }
    resp = requests.post(BASE_URL, headers=headers, json=payload, timeout=120)
    resp.raise_for_status()
    result = resp.json()
    return result["choices"][0]["message"]["content"]


# ============ 提示词模板 ============

PROMPT_COMPONENTS = """你是一位资深游戏系统策划。请仔细分析这张游戏UI原型图，完成以下任务：

## 任务：界面切分与组件标注

1. 识别图中所有的UI组件（按钮、文本、图片占位符、进度条、输入框、列表项、图标等）
2. 按从左到右、从上到下的顺序编号
3. 以表格形式输出

### 输出格式（严格使用Markdown表格）：

| 编号 | 组件名称 | 组件类型 | 位置描述 | 尺寸估算 | 功能说明 |
|------|----------|----------|----------|----------|----------|

### 然后按功能区域划分，描述界面的层级结构：

```
界面结构树：
├── 顶部区域
│   ├── ...
│   └── ...
├── 中间内容区
│   ├── ...
│   └── ...
└── 底部区域
    └── ...
```

请确保不遗漏任何可见的UI元素。"""


PROMPT_FULL_ANALYSIS = """你是一位拥有10年经验的资深游戏系统策划和技术总监。请针对这张{game_type}游戏的UI原型图，进行全面的专业分析。

## 第一步：界面切分与组件标注

识别所有UI组件，以表格形式列出：
| 编号 | 组件名称 | 组件类型 | 位置描述 | 功能说明 |
|------|----------|----------|----------|----------|

## 第二步：前端功能需求罗列 (Client Side)
- **界面布局**：描述各模块的位置、层级关系
- **交互逻辑**：详细描述点击、拖拽、滑动等操作后的反馈
- **本地逻辑**：需要前端本地计算的规则
- **异常处理**：网络断开、数据加载失败时的前端表现

## 第三步：服务器需求罗列 (Server Side)
- **数据结构**：需要新增或修改的数据库字段
- **接口定义**：列出需要的API接口及其功能
- **核心逻辑校验**：服务器需要验证的规则
- **定时任务**：是否需要开服/关服定时重置、排行榜结算等

## 第四步：美术需求罗列 (Art Side)
- **UI切图**：列出所有需要制作的静态图片资源
- **动效需求**：详细描述需要的动画效果
- **音效提示**：建议搭配的音效类型

输出语言：中文。格式要求：使用Markdown列表形式，条理清晰。
如果图中某些逻辑不明确，在对应项中标注"[需确认]"并给出合理推测。"""


PROMPT_ANNOTATE = """你是一位资深游戏UI分析师。请分析这张游戏UI原型图，为每个UI组件提供精确的位置信息。

对图中每个可识别的UI组件，输出以下JSON格式：

```json
{{
  "components": [
    {{
      "id": 1,
      "name": "组件名称",
      "type": "按钮|文本|图片|进度条|列表项|图标|输入框|容器",
      "position": "左上角|顶部居中|右上角|中间偏左|...",
      "estimated_bounds": {{"x_percent": 0, "y_percent": 0, "w_percent": 0, "h_percent": 0}},
      "description": "功能描述"
    }}
  ],
  "regions": [
    {{
      "name": "区域名称",
      "contains": [1, 2, 3],
      "description": "区域功能描述"
    }}
  ]
}}
```

其中 x_percent/y_percent 是组件左上角相对于整个界面的百分比位置(0-100)，
w_percent/h_percent 是组件宽高占界面的百分比。
请尽量准确估算。"""


def analyze_components(image_path: str) -> str:
    """仅分析UI组件"""
    image_data = encode_image_to_base64(image_path)
    return call_qwen_vl(image_data, PROMPT_COMPONENTS)


def analyze_full(image_path: str, game_type: str = "捕鱼") -> str:
    """完整分析：组件标注 + 前端/服务器/美术需求"""
    image_data = encode_image_to_base64(image_path)
    prompt = PROMPT_FULL_ANALYSIS.format(game_type=game_type)
    return call_qwen_vl(image_data, prompt)


def analyze_annotate(image_path: str) -> str:
    """输出组件位置JSON（用于生成标注图）"""
    image_data = encode_image_to_base64(image_path)
    return call_qwen_vl(image_data, PROMPT_ANNOTATE)


def draw_annotations(image_path: str, json_data: str, output_path: str):
    """根据JSON数据在图片上绘制标注框"""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("[警告] 未安装Pillow库，跳过标注图生成。运行: pip install Pillow")
        return

    # 解析JSON
    json_match = re.search(r'```json\s*(.*?)\s*```', json_data, re.DOTALL)
    if json_match:
        json_str = json_match.group(1)
    else:
        json_str = json_data

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError:
        print("[警告] 无法解析模型返回的JSON，跳过标注图生成")
        return

    img = Image.open(image_path)
    draw = ImageDraw.Draw(img)
    w, h = img.size

    # 尝试加载字体
    font = None
    font_paths = [
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simsun.ttc",
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, max(14, h // 40))
                break
            except Exception:
                continue
    if font is None:
        try:
            font = ImageFont.truetype("arial.ttf", max(14, h // 40))
        except Exception:
            font = ImageFont.load_default()

    colors = ["#FF0000", "#00CC00", "#0066FF", "#FF6600", "#CC00CC", "#009999",
              "#FF3366", "#6633CC", "#339933", "#CC6600"]

    for comp in data.get("components", []):
        idx = comp.get("id", 0)
        bounds = comp.get("estimated_bounds", {})
        x = bounds.get("x_percent", 0) / 100 * w
        y = bounds.get("y_percent", 0) / 100 * h
        cw = bounds.get("w_percent", 5) / 100 * w
        ch = bounds.get("h_percent", 5) / 100 * h

        color = colors[idx % len(colors)]

        # 画矩形框
        draw.rectangle([x, y, x + cw, y + ch], outline=color, width=2)

        # 画编号标签
        label = f"{idx}:{comp.get('name', '')}"
        draw.text((x + 2, y - 18 if y > 20 else y + 2), label, fill=color, font=font)

    img.save(output_path)
    print(f"[OK] 标注图已保存: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="游戏UI原型图分析工具")
    parser.add_argument("image", help="原型图路径")
    parser.add_argument("--mode", choices=["full", "components", "annotate"], default="full",
                        help="分析模式: full=完整分析, components=仅组件, annotate=生成标注图")
    parser.add_argument("--game-type", default="捕鱼", help="游戏类型（默认: 捕鱼）")
    parser.add_argument("--output", "-o", help="输出文件路径（默认输出到终端）")
    parser.add_argument("--annotate-output", help="标注图输出路径（仅annotate模式）")
    args = parser.parse_args()

    if not os.path.exists(args.image):
        print(f"[错误] 文件不存在: {args.image}", file=sys.stderr)
        sys.exit(1)

    print(f"[分析中] 模式={args.mode}, 图片={args.image}", file=sys.stderr)

    if args.mode == "components":
        result = analyze_components(args.image)
    elif args.mode == "annotate":
        result = analyze_annotate(args.image)
        # 如果指定了标注图输出路径，自动生成标注图
        ann_output = args.annotate_output or str(Path(args.image).stem) + "_annotated.png"
        draw_annotations(args.image, result, ann_output)
    else:
        result = analyze_full(args.image, args.game_type)

    if args.output:
        Path(args.output).write_text(result, encoding="utf-8")
        print(f"[OK] 分析结果已保存: {args.output}", file=sys.stderr)
    else:
        print(result)


if __name__ == "__main__":
    main()
