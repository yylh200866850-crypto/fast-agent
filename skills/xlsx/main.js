// XLSX Skill - Excel Spreadsheet Generator (JavaScript Version)
import * as XLSX from 'xlsx';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

const { utils, writeFile } = XLSX;

export default {
  name: 'xlsx',
  description: '生成 Excel 电子表格 (.xlsx)',
  parameters: {
    type: 'object',
    properties: {
      command: { 
        type: 'string', 
        enum: ['create', 'story'],
        description: '命令类型'
      },
      output_path: { type: 'string', description: '输出文件路径' },
      data: { 
        type: 'object', 
        description: '表格数据',
        properties: {
          headers: { type: 'array', items: { type: 'string' } },
          rows: { type: 'array', items: { type: 'array' } }
        }
      },
      story_text: { type: 'string', description: '故事文本 (用于 story 命令)' }
    },
    required: ['command', 'output_path']
  },
  
  execute: async (args) => {
    const { command, output_path, data, story_text } = args;
    
    try {
      if (command === 'create') {
        await createSpreadsheet(output_path, data);
      } else if (command === 'story') {
        await createStorySpreadsheet(output_path, story_text);
      } else {
        return { success: false, error: `未知命令：${command}` };
      }
      
      return { success: true, message: `SUCCESS: Created ${output_path}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

async function createSpreadsheet(outputPath, data = null) {
  // Default data if none provided
  const spreadsheetData = data || {
    headers: ['Column A', 'Column B'],
    rows: [
      ['Value 1', 'Value 2'],
      ['Value 3', 'Value 4']
    ]
  };
  
  // Create worksheet
  const ws_data = [];
  
  // Add headers
  if (spreadsheetData.headers) {
    ws_data.push(spreadsheetData.headers);
  }
  
  // Add rows
  if (spreadsheetData.rows) {
    for (const row of spreadsheetData.rows) {
      ws_data.push(row);
    }
  }
  
  const ws = utils.aoa_to_sheet(ws_data);
  
  // Style headers (bold and yellow background)
  const range = utils.decode_range(ws['!ref']);
  for (let C = range.s.C; C <= range.e.C; ++C) {
    const address = utils.encode_cell({ r: 0, c: C });
    if (!ws[address]) continue;
    ws[address].s = {
      font: { bold: true },
      fill: {
        fgColor: { rgb: 'FFFF00' }
      },
      alignment: { horizontal: 'center' }
    };
  }
  
  // Auto-adjust column widths
  const colWidths = [];
  for (let i = 0; i < (spreadsheetData.headers?.length || 0); i++) {
    let maxWidth = (spreadsheetData.headers[i]?.length || 10) + 2;
    
    if (spreadsheetData.rows) {
      for (const row of spreadsheetData.rows) {
        if (row[i]) {
          const cellWidth = String(row[i]).length + 2;
          if (cellWidth > maxWidth) {
            maxWidth = cellWidth;
          }
        }
      }
    }
    
    colWidths.push({ wch: maxWidth });
  }
  
  ws['!cols'] = colWidths;
  
  // Create workbook and add worksheet
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Data');
  
  saveFile(outputPath, wb);
}

async function createStorySpreadsheet(outputPath, storyText) {
  if (!storyText) {
    throw new Error('story_text 是必需的');
  }
  
  // Split story into paragraphs
  const paragraphs = storyText.split(/\n\n+/);
  
  // Create worksheet with headers
  const ws_data = [
    ['段落', '内容']
  ];
  
  // Add paragraphs as rows
  for (let i = 0; i < paragraphs.length; i++) {
    ws_data.push([i + 1, paragraphs[i].trim()]);
  }
  
  const ws = utils.aoa_to_sheet(ws_data);
  
  // Style headers
  const headerStyle = {
    font: { bold: true },
    fill: {
      fgColor: { rgb: 'FFFF00' }
    },
    alignment: { horizontal: 'center' }
  };
  
  ws['A1'].s = headerStyle;
  ws['B1'].s = headerStyle;
  
  // Set column widths
  ws['!cols'] = [
    { wch: 10 },
    { wch: 80 }
  ];
  
  // Create workbook and add worksheet
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Story');
  
  saveFile(outputPath, wb);
}

function saveFile(outputPath, workbook) {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  writeFile(workbook, outputPath);
}
