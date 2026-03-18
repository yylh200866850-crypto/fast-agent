#!/usr/bin/env python3
"""
将图片转换为标准多尺寸ICO文件
包含常用尺寸：16, 24, 32, 48, 64, 128, 256

使用方法:
    python scripts/convert_ico.py                    # 使用默认 logo.jpg
    python scripts/convert_ico.py path/to/image.png  # 使用指定图片
"""

from PIL import Image
import os
import sys

# 项目根目录
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)

# 标准 ICO 尺寸
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]


def convert_to_ico(input_path, output_path=None):
    """
    将图片转换为多尺寸ICO文件
    
    Args:
        input_path: 输入图片路径
        output_path: 输出ICO路径（默认为项目根目录的 logo.ico）
    
    Returns:
        输出文件路径
    """
    # 验证输入文件
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"找不到输入文件: {input_path}")
    
    # 设置默认输出路径
    if output_path is None:
        output_path = os.path.join(ROOT_DIR, "logo.ico")
    
    # 确保输出目录存在
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)
    
    # 打开原始图片
    img = Image.open(input_path)
    print(f"原始图片: {img.size[0]}x{img.size[1]}, 模式: {img.mode}")
    
    # 确保图片是 RGBA 模式以支持透明度
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
        print(f"转换后模式: {img.mode}")
    
    # 保存为 ICO 文件
    # Pillow 9.x+ 使用 bitmap_dimensions 参数
    img.save(
        output_path,
        format='ICO',
        bitmap_dimensions=[(size, size) for size in ICO_SIZES]
    )
    
    # 验证生成的文件
    file_size = os.path.getsize(output_path)
    print(f"\n✅ ICO 文件已生成: {output_path}")
    print(f"   文件大小: {file_size:,} bytes")
    print(f"   包含尺寸: {ICO_SIZES}")
    
    return output_path


def verify_ico(ico_path):
    """
    验证 ICO 文件结构
    
    Args:
        ico_path: ICO 文件路径
    """
    with open(ico_path, 'rb') as f:
        # ICONDIR header (6 bytes)
        reserved = int.from_bytes(f.read(2), 'little')
        ico_type = int.from_bytes(f.read(2), 'little')
        count = int.from_bytes(f.read(2), 'little')
        
        type_name = "ICO" if ico_type == 1 else "CUR"
        print(f"\n📋 ICO 文件验证:")
        print(f"   类型: {type_name}")
        print(f"   图像数量: {count}")
        
        # 读取每个图像的目录条目
        print(f"   各尺寸:")
        for i in range(count):
            width = int.from_bytes(f.read(1), 'little')
            height = int.from_bytes(f.read(1), 'little')
            colors = int.from_bytes(f.read(1), 'little')
            reserved2 = int.from_bytes(f.read(1), 'little')
            planes = int.from_bytes(f.read(2), 'little')
            bpp = int.from_bytes(f.read(2), 'little')
            size = int.from_bytes(f.read(4), 'little')
            offset = int.from_bytes(f.read(4), 'little')
            
            w = 256 if width == 0 else width
            h = 256 if height == 0 else height
            print(f"     - {w}x{h}, {bpp}位, {size:,} bytes")


def main():
    # 确定输入文件
    if len(sys.argv) > 1:
        input_path = sys.argv[1]
    else:
        # 默认使用项目中的 logo.jpg
        input_path = os.path.join(ROOT_DIR, "logo.jpg")
        if not os.path.exists(input_path):
            # 尝试 public 目录
            input_path = os.path.join(ROOT_DIR, "public", "logo.jpg")
    
    # 确定输出文件
    if len(sys.argv) > 2:
        output_path = sys.argv[2]
    else:
        output_path = os.path.join(ROOT_DIR, "logo.ico")
    
    print(f"输入: {input_path}")
    print(f"输出: {output_path}\n")
    
    # 转换
    ico_path = convert_to_ico(input_path, output_path)
    
    # 验证
    verify_ico(ico_path)


if __name__ == "__main__":
    main()
