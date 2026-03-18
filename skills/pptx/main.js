// PPTX Skill - PowerPoint Presentation Generator (JavaScript Version)
import PptxGenJS from 'pptxgenjs';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

const Presentation = PptxGenJS;

export default {
  name: 'pptx',
  description: '生成 PowerPoint 演示文稿 (.pptx)',
  parameters: {
    type: 'object',
    properties: {
      command: { 
        type: 'string', 
        enum: ['create', 'story'],
        description: '命令类型'
      },
      output_path: { type: 'string', description: '输出文件路径' },
      slides_data: { 
        type: 'array', 
        description: '幻灯片数据数组',
        items: {
          type: 'object',
          properties: {
            layout: { type: 'string', enum: ['title', 'content'] },
            title: { type: 'string' },
            content: { type: 'string' }
          }
        }
      },
      story_text: { type: 'string', description: '故事文本 (用于 story 命令)' }
    },
    required: ['command', 'output_path']
  },
  
  execute: async (args) => {
    const { command, output_path, slides_data, story_text } = args;
    
    try {
      if (command === 'create') {
        await createPresentation(output_path, slides_data);
      } else if (command === 'story') {
        await createStoryPresentation(output_path, story_text);
      } else {
        return { success: false, error: `未知命令：${command}` };
      }
      
      return { success: true, message: `SUCCESS: Created ${output_path}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

async function createPresentation(outputPath, slidesData = null) {
  const pres = new Presentation();
  
  // Default slide if none provided
  const slides = slidesData || [
    { layout: 'title', title: 'Presentation', content: 'Created with PPTX Skill' }
  ];
  
  for (const slideData of slides) {
    let slide;
    
    if (slideData.layout === 'title' || !slideData.layout) {
      slide = pres.addSlide();
      if (slideData.title) {
        slide.addText(slideData.title, {
          x: 0.5,
          y: 1.5,
          w: '90%',
          fontSize: 32,
          bold: true,
          align: 'center'
        });
      }
      if (slideData.content) {
        slide.addText(slideData.content, {
          x: 0.5,
          y: 2.5,
          w: '90%',
          fontSize: 18,
          align: 'center'
        });
      }
    } else {
      slide = pres.addSlide();
      if (slideData.title) {
        slide.addText(slideData.title, {
          x: 0.5,
          y: 0.3,
          w: '90%',
          fontSize: 24,
          bold: true
        });
      }
      if (slideData.content) {
        slide.addText(slideData.content, {
          x: 0.5,
          y: 1.0,
          w: '90%',
          h: 5,
          fontSize: 14,
          valign: 'top'
        });
      }
    }
  }
  
  await pres.writeFile({ fileName: outputPath });
}

async function createStoryPresentation(outputPath, storyText) {
  if (!storyText) {
    throw new Error('story_text 是必需的');
  }
  
  const pres = new Presentation();
  
  // Split story into paragraphs
  const paragraphs = storyText.split(/\n\n+/);
  
  // Title slide
  const titleSlide = pres.addSlide();
  titleSlide.addText('校园爱情故事', {
    x: 0.5,
    y: 1.5,
    w: '90%',
    fontSize: 36,
    bold: true,
    align: 'center',
    color: '363636'
  });
  titleSlide.addText('作者：AI 助手', {
    x: 0.5,
    y: 2.5,
    w: '90%',
    fontSize: 18,
    align: 'center',
    color: '666666'
  });
  
  // Content slides (2-3 paragraphs per slide)
  const paragraphsPerSlide = 2;
  let slideNum = 1;
  
  for (let i = 0; i < paragraphs.length; i += paragraphsPerSlide) {
    const slide = pres.addSlide();
    const chunk = paragraphs.slice(i, i + paragraphsPerSlide);
    
    slide.addText(`第${slideNum}部分`, {
      x: 0.5,
      y: 0.3,
      w: '90%',
      fontSize: 20,
      bold: true
    });
    
    let yPos = 0.8;
    for (const para of chunk) {
      slide.addText(para.trim(), {
        x: 0.5,
        y: yPos,
        w: '90%',
        fontSize: 14,
        valign: 'top'
      });
      yPos += 1.2;
    }
    
    slideNum++;
  }
  
  await pres.writeFile({ fileName: outputPath });
}

function saveFile(outputPath, data) {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
