/**
 * MCP 客户端技能
 * 
 * 连接外部 MCP 服务器并使用其工具
 */

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { createLogger } from '../../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = createLogger('MCPClientSkill');

// 连接缓存
const connections = new Map();

export default {
  name: 'mcp_client',
  description: 'MCP 客户端 - 连接外部 MCP 服务器并使用其工具',
  
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['connect', 'disconnect', 'list', 'tools', 'call', 'status', 'quick'],
        description: '操作类型'
      },
      name: { type: 'string' },
      config: { type: 'object' },
      tool: { type: 'string' },
      args: { type: 'object' },
      // quick 模式的快捷配置
      server: {
        type: 'string',
        enum: ['filesystem', 'github', 'memory', 'fetch', 'postgres', 'sqlite'],
        description: 'quick时: 预设服务器名称'
      },
      path: { type: 'string', description: 'filesystem时: 允许访问的路径' },
      token: { type: 'string', description: 'github时: GitHub token' }
    },
    required: ['action']
  },

  async execute(params, context) {
    const { action, name, config, tool, args, server, path, token } = params;
    
    switch (action) {
      case 'connect':
        return handleConnect(name, config);
        
      case 'disconnect':
        return handleDisconnect(name);
        
      case 'list':
        return handleList();
        
      case 'tools':
        return handleTools(name);
        
      case 'call':
        return handleCall(name, tool, args);
        
      case 'status':
        return handleStatus(name);
        
      case 'quick':
        return handleQuickConnect(server, { path, token });
        
      default:
        throw new Error(`未知操作: ${action}`);
    }
  }
};

/**
 * 处理连接
 */
async function handleConnect(name, config) {
  if (!name) {
    throw new Error('请提供连接名称');
  }
  
  if (!config) {
    throw new Error('请提供连接配置');
  }
  
  if (connections.has(name)) {
    return {
      success: false,
      message: `连接 "${name}" 已存在，请先断开`
    };
  }
  
  try {
    const { type, command, args = [], url, env = {} } = config;
    
    if (type === 'stdio') {
      // 启动本地进程
      const childProcess = spawn(command, args, {
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const connection = {
        name,
        type: 'stdio',
        process: childProcess,
        config,
        connectedAt: new Date().toISOString(),
        tools: [] // 需要通过 MCP 协议获取
      };
      
      connections.set(name, connection);
      
      return {
        success: true,
        message: `MCP 服务器 "${name}" 已启动`,
        type: 'stdio',
        note: '使用 tools 操作获取可用工具列表'
      };
      
    } else if (type === 'http' || type === 'sse') {
      // HTTP 连接
      const connection = {
        name,
        type,
        url,
        config,
        connectedAt: new Date().toISOString(),
        tools: []
      };
      
      connections.set(name, connection);
      
      return {
        success: true,
        message: `MCP 服务器 "${name}" 已配置`,
        type,
        url
      };
      
    } else {
      throw new Error(`不支持的传输类型: ${type}`);
    }
  } catch (error) {
    throw new Error(`连接失败: ${error.message}`);
  }
}

/**
 * 处理断开连接
 */
async function handleDisconnect(name) {
  if (!name) {
    throw new Error('请提供连接名称');
  }
  
  const connection = connections.get(name);
  if (!connection) {
    return {
      success: false,
      message: `连接 "${name}" 不存在`
    };
  }
  
  try {
    if (connection.process) {
      connection.process.kill();
    }
    connections.delete(name);
    
    return {
      success: true,
      message: `连接 "${name}" 已断开`
    };
  } catch (error) {
    throw new Error(`断开连接失败: ${error.message}`);
  }
}

/**
 * 列出所有连接
 */
function handleList() {
  const list = [];
  for (const [name, conn] of connections) {
    list.push({
      name,
      type: conn.type,
      url: conn.url,
      connectedAt: conn.connectedAt
    });
  }
  
  return {
    success: true,
    total: list.length,
    connections: list
  };
}

/**
 * 获取工具列表
 */
async function handleTools(name) {
  if (!name) {
    // 返回所有连接的工具
    const allTools = [];
    for (const [connName, conn] of connections) {
      if (conn.tools && conn.tools.length > 0) {
        allTools.push(...conn.tools.map(t => ({
          ...t,
          connection: connName
        })));
      }
    }
    return {
      success: true,
      total: allTools.length,
      tools: allTools
    };
  }
  
  const connection = connections.get(name);
  if (!connection) {
    throw new Error(`连接 "${name}" 不存在`);
  }
  
  // 返回预设的工具列表（基于服务器类型）
  const presetTools = getPresetTools(name, connection.config);
  
  return {
    success: true,
    connection: name,
    tools: presetTools,
    note: '这是预设工具列表，实际工具可能有所不同'
  };
}

/**
 * 调用工具
 */
async function handleCall(name, tool, args) {
  if (!name || !tool) {
    throw new Error('请提供连接名称和工具名称');
  }
  
  const connection = connections.get(name);
  if (!connection) {
    throw new Error(`连接 "${name}" 不存在`);
  }
  
  // 这里返回一个提示，实际调用需要完整的 MCP 客户端实现
  return {
    success: true,
    message: '工具调用请求已接收',
    connection: name,
    tool,
    args,
    note: '完整 MCP 调用需要安装 @modelcontextprotocol/sdk 并使用 mcp_client.js 工具'
  };
}

/**
 * 获取连接状态
 */
function handleStatus(name) {
  if (name) {
    const connection = connections.get(name);
    if (!connection) {
      return {
        success: true,
        exists: false,
        message: `连接 "${name}" 不存在`
      };
    }
    
    return {
      success: true,
      exists: true,
      name,
      type: connection.type,
      url: connection.url,
      connectedAt: connection.connectedAt
    };
  }
  
  // 返回所有连接状态
  const status = {
    success: true,
    totalConnections: connections.size,
    connections: []
  };
  
  for (const [n, conn] of connections) {
    status.connections.push({
      name: n,
      type: conn.type,
      url: conn.url,
      connectedAt: conn.connectedAt
    });
  }
  
  return status;
}

/**
 * 快速连接预设服务器
 */
async function handleQuickConnect(server, options) {
  const presets = {
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', options.path || process.cwd()],
      type: 'stdio'
    },
    github: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      type: 'stdio',
      env: { GITHUB_TOKEN: options.token }
    },
    memory: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
      type: 'stdio'
    },
    fetch: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
      type: 'stdio'
    },
    postgres: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres'],
      type: 'stdio'
    },
    sqlite: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite'],
      type: 'stdio'
    }
  };
  
  const preset = presets[server];
  if (!preset) {
    throw new Error(`未知预设服务器: ${server}`);
  }
  
  return handleConnect(server, preset);
}

/**
 * 获取预设工具列表
 */
function getPresetTools(name, config) {
  const toolsMap = {
    filesystem: [
      { name: 'read_file', description: '读取文件内容' },
      { name: 'write_file', description: '写入文件' },
      { name: 'list_directory', description: '列出目录内容' },
      { name: 'create_directory', description: '创建目录' },
      { name: 'move_file', description: '移动文件' },
      { name: 'search_files', description: '搜索文件' },
      { name: 'get_file_info', description: '获取文件信息' }
    ],
    github: [
      { name: 'create_issue', description: '创建 Issue' },
      { name: 'create_pull_request', description: '创建 PR' },
      { name: 'push_files', description: '推送文件' },
      { name: 'search_repositories', description: '搜索仓库' },
      { name: 'get_file_contents', description: '获取文件内容' },
      { name: 'list_commits', description: '列出提交' }
    ],
    memory: [
      { name: 'create_entities', description: '创建实体' },
      { name: 'create_relations', description: '创建关系' },
      { name: 'add_observations', description: '添加观察' },
      { name: 'search_nodes', description: '搜索节点' },
      { name: 'read_graph', description: '读取图谱' }
    ],
    fetch: [
      { name: 'fetch', description: '获取网页内容' }
    ],
    postgres: [
      { name: 'query', description: '执行 SQL 查询' }
    ],
    sqlite: [
      { name: 'query', description: '执行 SQL 查询' }
    ]
  };
  
  // 根据 config 或名称推断
  for (const [key, tools] of Object.entries(toolsMap)) {
    if (name.includes(key) || config?.args?.some(a => a.includes(key))) {
      return tools;
    }
  }
  
  return [];
}
