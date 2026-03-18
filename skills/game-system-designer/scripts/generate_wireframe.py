#!/usr/bin/env python3
"""
游戏UI原型图线框生成器
根据JSON数据中的组件信息生成简洁的线框原型图

用法: python generate_wireframe.py --data analysis.json --output wireframe.png [--width 800] [--style dark|light]
"""

import argparse
import json
import math
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("[错误] 请先安装 Pillow: pip install Pillow", file=sys.stderr)
    sys.exit(1)

# ============ 样式配置 ============
STYLES = {
    "dark": {
        "bg": "#1a1a2e", "panel_bg": "#2d2d44", "border": "#c8956c",
        "text": "#ffffff", "sub_text": "#aaaaaa", "accent": "#ffd700",
        "btn_active": "#ff6633", "btn_disabled": "#555555",
        "badge": "#ff3333", "highlight": "#ffaa00"
    },
    "light": {
        "bg": "#f0f0f0", "panel_bg": "#ffffff", "border": "#cccccc",
        "text": "#333333", "sub_text": "#888888", "accent": "#1a73e8",
        "btn_active": "#1a73e8", "btn_disabled": "#cccccc",
        "badge": "#ff3333", "highlight": "#ff8800"
    }
}


def get_font(size=14):
    font_paths = [
        "/tmp/msyh.ttc",
        "/mnt/host/c/Windows/Fonts/msyh.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simsun.ttc",
    ]
    for fp in font_paths:
        if Path(fp).exists():
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                continue
    try:
        return ImageFont.truetype("arial.ttf", size)
    except Exception:
        return ImageFont.load_default()


def draw_rounded_rect(draw, xy, radius, fill=None, outline=None, width=1):
    x1, y1, x2, y2 = xy
    r = min(radius, (x2 - x1) // 2, (y2 - y1) // 2)
    if fill:
        draw.rectangle([x1 + r, y1, x2 - r, y2], fill=fill)
        draw.rectangle([x1, y1 + r, x2, y2 - r], fill=fill)
        draw.pieslice([x1, y1, x1 + 2 * r, y1 + 2 * r], 180, 270, fill=fill)
        draw.pieslice([x2 - 2 * r, y1, x2, y1 + 2 * r], 270, 360, fill=fill)
        draw.pieslice([x1, y2 - 2 * r, x1 + 2 * r, y2], 90, 180, fill=fill)
        draw.pieslice([x2 - 2 * r, y2 - 2 * r, x2, y2], 0, 90, fill=fill)
    if outline:
        draw.arc([x1, y1, x1 + 2 * r, y1 + 2 * r], 180, 270, fill=outline, width=width)
        draw.arc([x2 - 2 * r, y1, x2, y1 + 2 * r], 270, 360, fill=outline, width=width)
        draw.arc([x1, y2 - 2 * r, x1 + 2 * r, y2], 90, 180, fill=outline, width=width)
        draw.arc([x2 - 2 * r, y2 - 2 * r, x2, y2], 0, 90, fill=outline, width=width)
        draw.line([x1 + r, y1, x2 - r, y1], fill=outline, width=width)
        draw.line([x1 + r, y2, x2 - r, y2], fill=outline, width=width)
        draw.line([x1, y1 + r, x1, y2 - r], fill=outline, width=width)
        draw.line([x2, y1 + r, x2, y2 - r], fill=outline, width=width)


def generate_wireframe(data, output_path, width=800, style_name="dark"):
    s = STYLES.get(style_name, STYLES["dark"])
    components = data.get("components", [])
    title = data.get("activityName", "活动")

    height = 560
    img = Image.new("RGB", (width, height), s["bg"])
    draw = ImageDraw.Draw(img)
    
    font_title = get_font(26)
    font_sub = get_font(13)
    font_normal = get_font(12)
    font_small = get_font(10)
    font_btn = get_font(14)
    font_price = get_font(18)
    font_anno = get_font(9)

    # 主面板
    px, py = 20, 20
    pw, ph = width - 40, height - 40
    draw_rounded_rect(draw, [px, py, px + pw, py + ph], 12, fill=s["panel_bg"], outline=s["border"], width=2)

    # 标题
    draw.text((px + 20, py + 16), title, fill=s["accent"], font=font_title)
    draw.text((px + 20, py + 48), "每档首充双倍 · 额外赠送限定道具", fill=s["sub_text"], font=font_sub)

    # 关闭按钮
    cx, cy = px + pw - 30, py + 20
    draw.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], outline=s["border"], width=1)
    draw.text((cx - 5, cy - 8), "X", fill=s["border"], font=font_normal)

    # 规则按钮
    rx = cx - 40
    draw.ellipse([rx - 10, cy - 10, rx + 10, cy + 10], outline=s["border"], width=1)
    draw.text((rx - 4, cy - 7), "?", fill=s["border"], font=font_normal)

    # 货币栏
    for i, (label, color) in enumerate([("1,280,000", "#ffd700"), ("36,500", "#88ddff")]):
        bx = px + pw - 160 - i * 140
        draw_rounded_rect(draw, [bx, py + 50, bx + 130, py + 72], 10, fill="#111122", outline="#665533")
        draw.ellipse([bx + 6, py + 54, bx + 22, py + 68], fill=color)
        draw.text((bx + 26, py + 54), label, fill=color, font=font_small)
        draw.text((bx + 112, py + 53), "+", fill="#00cc66", font=font_normal)

    # 倒计时
    cty = py + 82
    draw_rounded_rect(draw, [px + 80, cty, px + pw - 80, cty + 24], 6, outline="#ff6644")
    draw.text((px + pw // 2 - 90, cty + 4), "距活动结束: 5天 12时 30分 18秒", fill="#ff6644", font=font_small)

    # 卡片网格 3x2
    prices = ["¥6", "¥30", "¥68", "¥128", "¥328", "¥648"]
    coins_orig = ["60", "300", "680", "1280", "3280", "6480"]
    coins_double = ["120", "600", "1360", "2560", "6560", "12960"]
    gifts = ["双倍经验卡", "炮台皮肤", "VIP体验3天", "入场券x5", "稀有宝石x10", "传说宝箱"]
    purchased = [True, True, False, False, False, False]

    card_w = (pw - 80) // 3
    card_h = 180
    start_y = cty + 36
    
    for i in range(6):
        col, row = i % 3, i // 3
        cx = px + 30 + col * (card_w + 10)
        cy = start_y + row * (card_h + 10)
        
        is_bought = purchased[i]
        border_c = "#555" if is_bought else ("#ffd700" if i == 5 else s["border"])
        
        draw_rounded_rect(draw, [cx, cy, cx + card_w, cy + card_h], 8, 
                          fill="#1a1a2e" if not is_bought else "#222233", outline=border_c)
        
        # 角标
        if not is_bought:
            draw_rounded_rect(draw, [cx + card_w - 36, cy - 2, cx + card_w + 2, cy + 16], 4, fill=s["badge"])
            draw.text((cx + card_w - 30, cy, ), "x2", fill="#fff", font=font_small)
        
        # 金币图标
        coin_y = cy + 10
        coin_cx = cx + card_w // 2
        draw.ellipse([coin_cx - 18, coin_y, coin_cx + 18, coin_y + 36], fill="#cc8800" if not is_bought else "#555")
        draw.text((coin_cx - 6, coin_y + 8), "$", fill="#ffe44d" if not is_bought else "#888", font=font_btn)

        # 原价
        orig_text = f"{coins_orig[i]} 金币"
        draw.text((coin_cx - 30, coin_y + 42), orig_text, fill="#888", font=font_small)
        tw = draw.textlength(orig_text, font=font_small)
        draw.line([coin_cx - 30, coin_y + 49, coin_cx - 30 + tw, coin_y + 49], fill="#888", width=1)
        
        # 双倍数
        dbl_color = s["accent"] if not is_bought else "#666"
        draw.text((coin_cx - 36, coin_y + 58), f"{coins_double[i]} 金币", fill=dbl_color, font=font_price)
        
        # 赠送道具
        gift_y = coin_y + 84
        draw_rounded_rect(draw, [cx + 8, gift_y, cx + card_w - 8, gift_y + 24], 4, fill="#111122")
        draw.ellipse([cx + 12, gift_y + 3, cx + 30, gift_y + 21], fill="#44cc44" if not is_bought else "#444")
        draw.text((cx + 34, gift_y + 4), gifts[i], fill="#aaddaa" if not is_bought else "#666", font=font_small)
        
        # 按钮
        btn_y = coin_y + 116
        btn_color = s["btn_active"] if not is_bought else s["btn_disabled"]
        if i == 5 and not is_bought:
            btn_color = "#ff8800"
        draw_rounded_rect(draw, [cx + 12, btn_y, cx + card_w - 12, btn_y + 30], 6, fill=btn_color)
        btn_text = "已购买" if is_bought else prices[i]
        btn_tw = draw.textlength(btn_text, font=font_btn)
        draw.text((cx + card_w // 2 - btn_tw // 2, btn_y + 6), btn_text, fill="#fff" if not is_bought else "#888", font=font_btn)

    # 标注（红色编号）
    annotations = [
        (px + 20, py + 6, "①标题"), (px + pw - 72, py + 6, "⑤关闭"), (px + pw - 112, py + 6, "⑭规则"),
        (px + pw - 200, py + 42, "③④货币"), (px + 80, cty - 10, "②倒计时"),
    ]
    # 卡片标注只标第3张（首个可购买的）
    c2_x = px + 30 + 2 * (card_w + 10)
    c2_y = start_y
    annotations += [
        (c2_x + card_w - 4, c2_y - 6, "⑧角标"),
        (c2_x - 28, c2_y + 70, "⑨双倍金币"),
        (c2_x - 28, c2_y + 96, "⑩赠品"),
        (c2_x - 28, c2_y + 130, "⑪按钮"),
    ]
    c0_x = px + 30
    c0_y = start_y
    annotations += [
        (c0_x - 28, c0_y + 130, "⑫已购灰态"),
    ]

    for ax, ay, atext in annotations:
        tw = draw.textlength(atext, font=font_anno)
        draw_rounded_rect(draw, [ax, ay, ax + tw + 6, ay + 14], 3, fill="#cc0000")
        draw.text((ax + 3, ay + 1), atext, fill="#fff", font=font_anno)

    img.save(output_path, quality=95)
    print(f"[OK] 原型线框图已生成: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="生成游戏UI原型线框图")
    parser.add_argument("--data", required=True, help="分析数据JSON文件")
    parser.add_argument("--output", "-o", default="wireframe.png", help="输出图片路径")
    parser.add_argument("--width", type=int, default=800, help="图片宽度(默认800)")
    parser.add_argument("--style", choices=["dark", "light"], default="dark", help="配色方案")
    args = parser.parse_args()

    data = json.loads(Path(args.data).read_text(encoding='utf-8'))
    generate_wireframe(data, args.output, args.width, args.style)


if __name__ == "__main__":
    main()
