// TXT Skill - 纯文本文件生成器
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

export default {
  name: 'txt',
  description: '生成纯文本文件 (.txt)，支持 UTF-8 编码，完美支持中文',
  parameters: {
    type: 'object',
    properties: {
      command: { 
        type: 'string', 
        enum: ['create', 'story'],
        description: '命令类型'
      },
      output_path: { type: 'string', description: '输出文件路径' },
      content: { type: 'string', description: '文本内容' },
      story_text: { type: 'string', description: '故事文本 (用于 story 命令)' },
      encoding: { 
        type: 'string', 
        description: '文件编码，默认 utf8',
        default: 'utf8'
      }
    },
    required: ['command', 'output_path']
  },
  
  execute: async (args) => {
    const { command, output_path, content, story_text, encoding = 'utf8' } = args;
    
    try {
      if (command === 'create') {
        await createTextFile(output_path, content, encoding);
      } else if (command === 'story') {
        await createStoryFile(output_path, story_text, encoding);
      } else {
        return { success: false, error: `未知命令：${command}` };
      }
      
      return { success: true, message: `SUCCESS: Created ${output_path}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

async function createTextFile(outputPath, content = '', encoding = 'utf8') {
  const text = content || '';
  saveFile(outputPath, text, encoding);
}

async function createStoryFile(outputPath, storyText, encoding = 'utf8') {
  if (!storyText) {
    throw new Error('story_text 是必需的');
  }
  
  // 添加标题和元信息
  const formattedText = `校园爱情故事

作者：AI 助手
创作时间：${new Date().toLocaleDateString('zh-CN')}

${storyText}

---
故事字数：${storyText.length}字
`;
  
  saveFile(outputPath, formattedText, encoding);
}

function saveFile(outputPath, content, encoding = 'utf8') {
  // 确保目录存在
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  // 使用 UTF-8 编码写入，确保中文正常显示
  writeFileSync(outputPath, content, { encoding: encoding });
}
