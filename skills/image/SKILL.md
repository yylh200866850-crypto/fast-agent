---
name: image
description: 图像处理技能 - 支持图像格式转换、压缩、裁剪、缩放、水印等操作。使用 sharp 库进行高性能图像处理。
entry: main.js
parameters: |
  {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["convert", "resize", "crop", "rotate", "compress", "watermark", "info", "thumbnail"],
        "description": "操作类型"
      },
      "input": { "type": "string", "description": "输入文件路径" },
      "output": { "type": "string", "description": "输出文件路径" },
      "format": {
        "type": "string",
        "enum": ["jpeg", "png", "webp", "gif", "tiff", "avif"],
        "description": "convert时: 目标格式"
      },
      "width": { "type": "integer", "description": "resize时: 目标宽度" },
      "height": { "type": "integer", "description": "resize时: 目标高度" },
      "quality": { "type": "integer", "minimum": 1, "maximum": 100, "description": "压缩质量 (1-100)" },
      "x": { "type": "integer", "description": "crop时: 裁剪起始X坐标" },
      "y": { "type": "integer", "description": "crop时: 裁剪起始Y坐标" },
      "degrees": { "type": "integer", "description": "rotate时: 旋转角度" },
      "watermarkPath": { "type": "string", "description": "watermark时: 水印图片路径" },
      "fit": {
        "type": "string",
        "enum": ["cover", "contain", "fill", "inside", "outside"],
        "description": "resize时: 适应模式"
      }
    },
    "required": ["action", "input"]
  }
---

# 图像处理技能

提供强大的图像处理能力，支持常见图像操作。

## 支持的操作

| 操作 | 说明 | 参数 |
|------|------|------|
| convert | 格式转换 | format |
| resize | 调整大小 | width, height, fit |
| crop | 裁剪 | x, y, width, height |
| rotate | 旋转 | degrees |
| compress | 压缩 | quality |
| watermark | 添加水印 | watermarkPath |
| info | 获取信息 | - |
| thumbnail | 生成缩略图 | width, height |

## 使用示例

### 格式转换

```javascript
{
  "action": "convert",
  "input": "image.png",
  "output": "image.webp",
  "format": "webp"
}
```

### 调整大小

```javascript
{
  "action": "resize",
  "input": "large.jpg",
  "output": "small.jpg",
  "width": 800,
  "height": 600,
  "fit": "cover"
}
```

### 压缩图片

```javascript
{
  "action": "compress",
  "input": "photo.jpg",
  "output": "photo_compressed.jpg",
  "quality": 80
}
```

### 获取图像信息

```javascript
{
  "action": "info",
  "input": "image.png"
}
```

## 依赖

需要安装 sharp 库: `npm install sharp`
