#!/usr/bin/env python3
"""验证 ICO 文件结构"""
import os
import sys

ico_path = sys.argv[1] if len(sys.argv) > 1 else 'e:/code/mul-agent/dist/logo.ico'
print(f'文件: {ico_path}')
print(f'大小: {os.path.getsize(ico_path)} bytes')

with open(ico_path, 'rb') as f:
    # ICONDIR header (6 bytes)
    reserved = int.from_bytes(f.read(2), 'little')
    ico_type = int.from_bytes(f.read(2), 'little')
    count = int.from_bytes(f.read(2), 'little')
    
    type_name = "ICO" if ico_type == 1 else "CUR"
    print(f'\nICO文件头:')
    print(f'  类型: {type_name}')
    print(f'  图像数量: {count}')
    
    print(f'\n各尺寸信息:')
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
        print(f'  图像{i+1}: {w}x{h}, {bpp}位, 数据大小: {size} bytes')
