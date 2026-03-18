// DOCX Skill - Word Document Generator (JavaScript Version)
import { Document, Packer, Paragraph, HeadingLevel, AlignmentType } from 'docx';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

export default {
  name: 'docx',
  description: '生成 Word 文档 (.docx)',
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
        await createDocument(output_path, content);
      } else if (command === 'story') {
        await createStoryDocument(output_path, story_text);
      } else {
        return { success: false, error: `未知命令：${command}` };
      }
      
      return { success: true, message: `SUCCESS: Created ${output_path}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

async function createDocument(outputPath, content = null) {
  const docText = content || 'Hello World';
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: 'Document',
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: docText,
        }),
      ],
    }],
  });
  
  const buffer = await Packer.toBuffer(doc);
  saveFile(outputPath, buffer);
}

async function createStoryDocument(outputPath, storyText) {
  if (!storyText) {
    throw new Error('story_text 是必需的');
  }
  
  // 将故事分成段落
  const paragraphs = storyText.split(/\n\n+/);
  
  const docChildren = [
    new Paragraph({
      text: '校园爱情故事',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: '作者：AI 助手',
      alignment: AlignmentType.CENTER,
    }),
  ];
  
  // 添加故事段落
  for (const para of paragraphs) {
    docChildren.push(new Paragraph({
      text: para.trim(),
      spacing: {
        after: 200,
      },
    }));
  }
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: docChildren,
    }],
  });
  
  const buffer = await Packer.toBuffer(doc);
  saveFile(outputPath, buffer);
}

function saveFile(outputPath, buffer) {
  // 确保目录存在
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  writeFileSync(outputPath, buffer);
}
