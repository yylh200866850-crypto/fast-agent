import fs from 'fs/promises';
import path from 'path';

// 文件操作工具定义
export const fileTools = [
  {
    name: 'file_read',
    description: '读取文件内容',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' },
        encoding: { type: 'string', description: '编码格式', default: 'utf-8' }
      },
      required: ['path']
    }
  },
  {
    name: 'file_write',
    description: '写入内容到文件',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' },
        content: { type: 'string', description: '文件内容' },
        append: { type: 'boolean', description: '是否追加模式', default: false }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'file_delete',
    description: '删除文件',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' }
      },
      required: ['path']
    }
  },
  {
    name: 'file_list',
    description: '列出目录内容',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '目录路径' },
        recursive: { type: 'boolean', description: '是否递归', default: false }
      },
      required: ['path']
    }
  },
  {
    name: 'file_info',
    description: '获取文件信息',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' }
      },
      required: ['path']
    }
  },
  {
    name: 'file_copy',
    description: '复制文件',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: '源文件路径' },
        destination: { type: 'string', description: '目标文件路径' }
      },
      required: ['source', 'destination']
    }
  },
  {
    name: 'file_move',
    description: '移动/重命名文件',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: '源文件路径' },
        destination: { type: 'string', description: '目标文件路径' }
      },
      required: ['source', 'destination']
    }
  }
];

// 递归列出目录
async function listDir(dirPath, recursive) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const result = [];
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const item = { name: entry.name, path: fullPath, type: entry.isDirectory() ? 'dir' : 'file' };
    result.push(item);
    
    if (recursive && entry.isDirectory()) {
      item.children = await listDir(fullPath, true);
    }
  }
  return result;
}

// 工具处理函数
export async function handleFileTool(name, args) {
  const text = (content) => ({ content: [{ type: 'text', text: typeof content === 'string' ? content : JSON.stringify(content, null, 2) }] });
  
  switch (name) {
    case 'file_read': {
      const content = await fs.readFile(args.path, args.encoding || 'utf-8');
      return text(content);
    }
    
    case 'file_write': {
      const dir = path.dirname(args.path);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(args.path, args.content, { flag: args.append ? 'a' : 'w' });
      return text(`已${args.append ? '追加' : '写入'}: ${args.path}`);
    }
    
    case 'file_delete': {
      await fs.unlink(args.path);
      return text(`已删除: ${args.path}`);
    }
    
    case 'file_list': {
      const items = await listDir(args.path, args.recursive);
      return text(items);
    }
    
    case 'file_info': {
      const stat = await fs.stat(args.path);
      return text({
        size: stat.size,
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory(),
        created: stat.birthtime,
        modified: stat.mtime
      });
    }
    
    case 'file_copy': {
      const dir = path.dirname(args.destination);
      await fs.mkdir(dir, { recursive: true });
      await fs.copyFile(args.source, args.destination);
      return text(`已复制: ${args.source} -> ${args.destination}`);
    }
    
    case 'file_move': {
      const dir = path.dirname(args.destination);
      await fs.mkdir(dir, { recursive: true });
      await fs.rename(args.source, args.destination);
      return text(`已移动: ${args.source} -> ${args.destination}`);
    }
    
    default:
      return { content: [{ type: 'text', text: `Unknown file tool: ${name}` }], isError: true };
  }
}

