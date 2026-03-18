// PDF Skill - PDF Document Generator (JavaScript Version)
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fontkit from '@pdf-lib/fontkit';

// 兼容 ES Module 和 CommonJS 环境
const getDirname = () => {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  }
};
const __dirname = getDirname();

export default {
  name: 'pdf',
  description: '生成 PDF 文档',
  parameters: {
    type: 'object',
    properties: {
      command: { 
        type: 'string', 
        enum: ['create', 'story'],
        description: '命令类型'
      },
      output_path: { type: 'string', description: '输出文件路径' },
      content: { type: 'string', description: '文档内容 (可选)' },
      story_text: { type: 'string', description: '故事文本 (用于 story 命令)' }
    },
    required: ['command', 'output_path']
  },
  
  execute: async (args) => {
    const { command, output_path, content, story_text } = args;
    
    try {
      if (command === 'create') {
        await createPDF(output_path, content);
      } else if (command === 'story') {
        await createStoryPDF(output_path, story_text);
      } else {
        return { success: false, error: `未知命令：${command}` };
      }
      
      return { success: true, message: `SUCCESS: Created ${output_path}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

async function createPDF(outputPath, content = null) {
  const pdfText = content || 'Hello World';
  
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const width = page.getWidth();
  const height = page.getHeight();
  
  // Add title
  page.drawText('PDF Document', {
    x: 72,
    y: height - 72,
    size: 16,
    font: boldFont,
  });
  
  // Add content with line wrapping
  let y = height - 108;
  const lines = wrapText(pdfText, 80, font, 12, width - 144);
  
  for (const line of lines) {
    if (y < 72) {
      // Need new page
      const newPage = pdfDoc.addPage([612, 792]);
      y = height - 72;
      page.drawText(line, {
        x: 72,
        y,
        size: 12,
        font,
      });
    } else {
      page.drawText(line, {
        x: 72,
        y,
        size: 12,
        font,
      });
    }
    y -= 18;
  }
  
  const pdfBytes = await pdfDoc.save();
  saveFile(outputPath, pdfBytes);
}

async function createStoryPDF(outputPath, storyText) {
  if (!storyText) {
    throw new Error('story_text 是必需的');
  }
  
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  
  // 尝试加载支持中文的字体
  let font = null;
  let boldFont = null;
  
  try {
    // 首先尝试加载系统字体文件（如果存在）
    const fontPaths = [
      join(__dirname, 'fonts', 'SimHei.ttf'), // 黑体 (Windows)
      join(__dirname, 'fonts', 'NotoSansSC-Regular.ttf'), // 思源黑体
      join(__dirname, 'fonts', 'SimSun.ttf'), // 宋体
      join(__dirname, 'fonts', 'MicrosoftYaHei.ttf'), // 微软雅黑
    ];
    
    for (const fontPath of fontPaths) {
      if (existsSync(fontPath)) {
        const fontBytes = readFileSync(fontPath);
        font = await pdfDoc.embedFont(fontBytes);
        boldFont = font; // 中文字体通常没有单独的粗体
        break;
      }
    }
  } catch (e) {
    console.warn('⚠️ 中文字体加载失败，使用备用方案:', e.message);
  }
  
  // 如果没有中文字体，使用标准字体（但不支持中文）
  if (!font) {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }
  
  let page = pdfDoc.addPage([612, 792]);
  const width = page.getWidth();
  const height = page.getHeight();
  
  // Title
  page.drawText('校园爱情故事', {
    x: width / 2 - 60,
    y: height - 72,
    size: 18,
    font: boldFont,
  });
  
  // Author
  page.drawText('作者：AI 助手', {
    x: width / 2 - 40,
    y: height - 95,
    size: 10,
    font,
  });
  
  // Split story into paragraphs
  const paragraphs = storyText.split(/\n\n+/);
  let y = height - 130;
  
  for (const para of paragraphs) {
    const lines = wrapText(para.trim(), 70, font, 12, width - 144);
    
    for (const line of lines) {
      if (y < 72) {
        page = pdfDoc.addPage([612, 792]);
        y = height - 72;
      }
      page.drawText(line, {
        x: 72,
        y,
        size: 12,
        font,
      });
      y -= 16;
    }
    
    y -= 8; // Space between paragraphs
  }
  
  const pdfBytes = await pdfDoc.save();
  saveFile(outputPath, pdfBytes);
}

function wrapText(text, maxCharsPerLine, font, fontSize, maxWidth) {
  const lines = [];
  
  // 检查是否包含中文字符（或其他非空格分隔的语言）
  const hasChinese = /[\u4e00-\u9fa5]/.test(text);
  
  if (hasChinese) {
    // 中文文本：按字符分割
    let currentLine = '';
    let currentWidth = 0;
    
    for (const char of text) {
      const charWidth = font.widthOfTextAtSize(char, fontSize);
      
      if (currentWidth + charWidth <= maxWidth) {
        currentLine += char;
        currentWidth += charWidth;
      } else {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = char;
        currentWidth = charWidth;
      }
    }
    
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }
  } else {
    // 英文文本：按单词分割
    const words = text.split(/\s+/);
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + word + ' ';
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      
      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = word + ' ';
      }
    }
    
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }
  }
  
  return lines;
}

function saveFile(outputPath, data) {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  writeFileSync(outputPath, data);
}
