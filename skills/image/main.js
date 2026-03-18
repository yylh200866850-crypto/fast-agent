/**
 * 图像处理技能
 * 
 * 使用 sharp 库进行高性能图像处理
 */

import { existsSync, statSync } from 'fs';
import { dirname, extname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

// 检查 sharp 是否可用
let sharp = null;
try {
  sharp = await import('sharp');
} catch (e) {
  console.log('⚠️ sharp 库未安装，图像处理功能受限');
}

export default {
  name: 'image',
  description: '图像处理技能 - 支持图像格式转换、压缩、裁剪、缩放等操作',
  
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['convert', 'resize', 'crop', 'rotate', 'compress', 'watermark', 'info', 'thumbnail']
      },
      input: { type: 'string' },
      output: { type: 'string' },
      format: { type: 'string', enum: ['jpeg', 'png', 'webp', 'gif', 'tiff', 'avif'] },
      width: { type: 'integer' },
      height: { type: 'integer' },
      quality: { type: 'integer', minimum: 1, maximum: 100 },
      x: { type: 'integer' },
      y: { type: 'integer' },
      degrees: { type: 'integer' },
      watermarkPath: { type: 'string' },
      fit: { type: 'string', enum: ['cover', 'contain', 'fill', 'inside', 'outside'] }
    },
    required: ['action', 'input']
  },

  async execute(params, context) {
    const { action, input, output, format, width, height, quality, x, y, degrees, watermarkPath, fit = 'cover' } = params;
    
    // 验证输入文件
    if (!existsSync(input)) {
      throw new Error(`输入文件不存在: ${input}`);
    }
    
    // 如果 sharp 不可用，使用 ImageMagick 作为后备
    if (!sharp) {
      return executeWithImageMagick(params);
    }
    
    try {
      let image = sharp.default(input);
      const info = await image.metadata();
      
      switch (action) {
        case 'info':
          return {
            success: true,
            info: {
              format: info.format,
              width: info.width,
              height: info.height,
              channels: info.channels,
              size: statSync(input).size,
              hasAlpha: info.hasAlpha,
              space: info.space
            }
          };
          
        case 'convert':
          if (!format) throw new Error('请指定目标格式');
          const outputPath = output || input.replace(/\.[^.]+$/, `.${format}`);
          await sharp.default(input)
            .toFormat(format)
            .toFile(outputPath);
          return {
            success: true,
            message: `格式转换成功: ${input} -> ${format}`,
            output: outputPath
          };
          
        case 'resize':
          if (!width && !height) throw new Error('请指定宽度或高度');
          const resizeOutput = output || input.replace(/\.[^.]+$/, `_resized${extname(input)}`);
          await sharp.default(input)
            .resize(width, height, { fit })
            .toFile(resizeOutput);
          return {
            success: true,
            message: `调整大小成功`,
            output: resizeOutput,
            originalSize: `${info.width}x${info.height}`,
            newSize: `${width || 'auto'}x${height || 'auto'}`
          };
          
        case 'crop':
          if (x === undefined || y === undefined || !width || !height) {
            throw new Error('裁剪需要 x, y, width, height 参数');
          }
          const cropOutput = output || input.replace(/\.[^.]+$/, `_cropped${extname(input)}`);
          await sharp.default(input)
            .extract({ left: x, top: y, width, height })
            .toFile(cropOutput);
          return {
            success: true,
            message: `裁剪成功`,
            output: cropOutput
          };
          
        case 'rotate':
          const rotateOutput = output || input.replace(/\.[^.]+$/, `_rotated${extname(input)}`);
          await sharp.default(input)
            .rotate(degrees || 90)
            .toFile(rotateOutput);
          return {
            success: true,
            message: `旋转成功`,
            output: rotateOutput,
            degrees: degrees || 90
          };
          
        case 'compress':
          const compressOutput = output || input.replace(/\.[^.]+$/, `_compressed${extname(input)}`);
          const q = quality || 80;
          let compressed = sharp.default(input);
          
          if (info.format === 'jpeg' || info.format === 'jpg') {
            compressed = compressed.jpeg({ quality: q });
          } else if (info.format === 'png') {
            compressed = compressed.png({ compressionLevel: Math.floor((100 - q) / 10) });
          } else if (info.format === 'webp') {
            compressed = compressed.webp({ quality: q });
          }
          
          await compressed.toFile(compressOutput);
          
          const originalSize = statSync(input).size;
          const compressedSize = statSync(compressOutput).size;
          
          return {
            success: true,
            message: `压缩成功`,
            output: compressOutput,
            originalSize,
            compressedSize,
            savedBytes: originalSize - compressedSize,
            savedPercent: ((1 - compressedSize / originalSize) * 100).toFixed(1) + '%'
          };
          
        case 'watermark':
          if (!watermarkPath || !existsSync(watermarkPath)) {
            throw new Error('请提供有效的水印图片路径');
          }
          const watermarkOutput = output || input.replace(/\.[^.]+$/, `_watermarked${extname(input)}`);
          
          const mainImage = sharp.default(input);
          const watermark = sharp.default(watermarkPath);
          const watermarkInfo = await watermark.metadata();
          
          // 将水印缩放到合适大小
          const watermarkBuffer = await watermark
            .resize(Math.floor(info.width / 4))
            .toBuffer();
          
          await mainImage
            .composite([{
              input: watermarkBuffer,
              gravity: 'southeast'
            }])
            .toFile(watermarkOutput);
          
          return {
            success: true,
            message: `水印添加成功`,
            output: watermarkOutput
          };
          
        case 'thumbnail':
          const thumbWidth = width || 200;
          const thumbHeight = height || 200;
          const thumbOutput = output || input.replace(/\.[^.]+$/, `_thumb${extname(input)}`);
          
          await sharp.default(input)
            .resize(thumbWidth, thumbHeight, { fit: 'cover' })
            .toFile(thumbOutput);
          
          return {
            success: true,
            message: `缩略图生成成功`,
            output: thumbOutput,
            size: `${thumbWidth}x${thumbHeight}`
          };
          
        default:
          throw new Error(`未知操作: ${action}`);
      }
    } catch (error) {
      throw new Error(`图像处理失败: ${error.message}`);
    }
  }
};

/**
 * 使用 ImageMagick 作为后备方案
 */
async function executeWithImageMagick(params) {
  const { action, input, output, format, width, height, quality, degrees } = params;
  
  const outputPath = output || input.replace(/\.[^.]+$/, `_processed${format ? '.' + format : extname(input)}`);
  
  let command = '';
  
  switch (action) {
    case 'info':
      const { stdout } = await execAsync(`identify -verbose "${input}"`);
      return {
        success: true,
        info: stdout,
        note: '使用 ImageMagick 获取信息'
      };
      
    case 'convert':
      command = `convert "${input}" "${outputPath}"`;
      break;
      
    case 'resize':
      command = `convert "${input}" -resize ${width || ''}x${height || ''} "${outputPath}"`;
      break;
      
    case 'rotate':
      command = `convert "${input}" -rotate ${degrees || 90} "${outputPath}"`;
      break;
      
    case 'compress':
      command = `convert "${input}" -quality ${quality || 80} "${outputPath}"`;
      break;
      
    default:
      throw new Error(`ImageMagick 不支持此操作: ${action}`);
  }
  
  await execAsync(command);
  
  return {
    success: true,
    message: `处理成功 (使用 ImageMagick)`,
    output: outputPath
  };
}
