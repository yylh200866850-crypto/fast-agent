/**
 * MCP Client - 连接外部 MCP 服务器
 * 
 * 支持:
 * - stdio 传输 (本地进程)
 * - HTTP 传输 (远程服务器)
 * - SSE 传输 (Server-Sent Events)
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';
import { createLogger } from '../logger.js';

const logger = createLogger('MCPClient');
const __dirname = dirname(fileURLToPath(import.meta.url));

// MCP 连接管理器
class MCPConnectionManager {
  constructor() {
    this.connections = new Map(); // name -> { client, transport, tools }
  }
  
  /**
   * 连接到 MCP 服务器
   */
  async connect(name, config) {
    if (this.connections.has(name)) {
      logger.warn(`MCP 连接已存在: ${name}`);
      return this.connections.get(name);
    }
    
    let transport;
    let client;
    
    try {
      // 根据传输类型创建连接
      if (config.type === 'stdio') {
        transport = await this.createStdioTransport(config);
      } else if (config.type === 'http' || config.type === 'sse') {
        transport = await this.createHTTPTransport(config);
      } else {
        throw new Error(`不支持的传输类型: ${config.type}`);
      }
      
      // 创建 MCP 客户端
      client = new Client(
        { name: 'fast-agent-mcp-client', version: '1.0.0' },
        { capabilities: {} }
      );
      
      // 连接
      await client.connect(transport);
      
      // 获取可用工具
      const toolsResult = await client.listTools();
      const tools = toolsResult.tools || [];
      
      const connection = {
        name,
        config,
        client,
        transport,
        tools,
        connected: true,
        connectedAt: new Date().toISOString()
      };
      
      this.connections.set(name, connection);
      
      logger.info(`✅ MCP 连接成功: ${name} (${tools.length} 个工具)`);
      
      return connection;
    } catch (error) {
      logger.error(`MCP 连接失败: ${name}`, error);
      throw error;
    }
  }
  
  /**
   * 创建 stdio 传输
   */
  async createStdioTransport(config) {
    const { command, args = [], env = {}, cwd } = config;
    
    // 合并环境变量
    const processEnv = {
      ...process.env,
      ...env
    };
    
    const transport = new StdioClientTransport({
      command,
      args,
      env: processEnv,
      cwd: cwd || process.cwd()
    });
    
    return transport;
  }
  
  /**
   * 创建 HTTP/SSE 传输
   */
  async createHTTPTransport(config) {
    const { url, headers = {} } = config;
    
    // 使用自定义 HTTP 传输
    return new HTTPTransport(url, headers);
  }
  
  /**
   * 断开连接
   */
  async disconnect(name) {
    const connection = this.connections.get(name);
    if (!connection) {
      return false;
    }
    
    try {
      if (connection.client) {
        await connection.client.close();
      }
      
      this.connections.delete(name);
      logger.info(`MCP 连接已断开: ${name}`);
      return true;
    } catch (error) {
      logger.error(`断开连接失败: ${name}`, error);
      return false;
    }
  }
  
  /**
   * 获取连接
   */
  getConnection(name) {
    return this.connections.get(name);
  }
  
  /**
   * 列出所有连接
   */
  listConnections() {
    return Array.from(this.connections.entries()).map(([name, conn]) => ({
      name,
      type: conn.config.type,
      tools: conn.tools.length,
      connected: conn.connected,
      connectedAt: conn.connectedAt
    }));
  }
  
  /**
   * 获取所有工具
   */
  getAllTools() {
    const allTools = [];
    
    for (const [connName, conn] of this.connections.entries()) {
      for (const tool of conn.tools) {
        allTools.push({
          ...tool,
          _connection: connName,
          // 重命名工具以避免冲突
          name: `${connName}_${tool.name}`
        });
      }
    }
    
    return allTools;
  }
  
  /**
   * 调用工具
   */
  async callTool(connectionName, toolName, args) {
    const connection = this.connections.get(connectionName);
    if (!connection) {
      throw new Error(`MCP 连接不存在: ${connectionName}`);
    }
    
    if (!connection.connected) {
      throw new Error(`MCP 连接已断开: ${connectionName}`);
    }
    
    try {
      const result = await connection.client.callTool({
        name: toolName,
        arguments: args
      });
      
      return result;
    } catch (error) {
      logger.error(`工具调用失败: ${connectionName}/${toolName}`, error);
      throw error;
    }
  }
}

/**
 * HTTP 传输实现
 */
class HTTPTransport {
  constructor(url, headers = {}) {
    this.url = url;
    this.headers = headers;
    this.messageId = 0;
    this.pendingRequests = new Map();
  }
  
  async connect() {
    // HTTP 不需要预连接
    return true;
  }
  
  async close() {
    // 清理待处理请求
    for (const [id, { reject }] of this.pendingRequests) {
      reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }
  
  async sendRequest(request) {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      
      // 构造 JSON-RPC 请求
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        ...request
      };
      
      this.pendingRequests.set(id, { resolve, reject });
      
      const body = JSON.stringify(jsonRpcRequest);
      const urlObj = new URL(this.url);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...this.headers
        }
      };
      
      const requester = urlObj.protocol === 'https:' ? https : http;
      
      const req = requester.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            this.pendingRequests.delete(id);
            
            if (response.error) {
              reject(new Error(response.error.message || 'MCP Error'));
            } else {
              resolve(response.result);
            }
          } catch (e) {
            this.pendingRequests.delete(id);
            reject(e);
          }
        });
      });
      
      req.on('error', (e) => {
        this.pendingRequests.delete(id);
        reject(e);
      });
      
      req.write(body);
      req.end();
    });
  }
  
  // MCP 协议方法
  async listTools() {
    return this.sendRequest({
      method: 'tools/list'
    });
  }
  
  async callTool(name, args) {
    return this.sendRequest({
      method: 'tools/call',
      params: { name, arguments: args }
    });
  }
}

// 单例
export const mcpConnectionManager = new MCPConnectionManager();

/**
 * MCP 连接技能
 */
export default {
  name: 'mcp_client',
  description: 'MCP 客户端 - 连接外部 MCP 服务器并使用其工具',
  
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['connect', 'disconnect', 'list', 'tools', 'call', 'status'],
        description: '操作类型: connect=连接, disconnect=断开, list=列出连接, tools=列出工具, call=调用工具, status=连接状态'
      },
      name: {
        type: 'string',
        description: '连接名称'
      },
      config: {
        type: 'object',
        description: 'connect时: 连接配置',
        properties: {
          type: {
            type: 'string',
            enum: ['stdio', 'http', 'sse'],
            description: '传输类型'
          },
          command: { type: 'string', description: 'stdio时: 命令' },
          args: { type: 'array', items: { type: 'string' }, description: 'stdio时: 参数' },
          url: { type: 'string', description: 'http时: 服务器URL' },
          env: { type: 'object', description: '环境变量' }
        }
      },
      tool: {
        type: 'string',
        description: 'call时: 工具名称'
      },
      args: {
        type: 'object',
        description: 'call时: 工具参数'
      }
    },
    required: ['action']
  },
  
  async execute(params, context) {
    const { action, name, config, tool, args } = params;
    
    switch (action) {
      case 'connect':
        if (!name || !config) {
          throw new Error('请提供连接名称和配置');
        }
        const connection = await mcpConnectionManager.connect(name, config);
        return {
          success: true,
          message: `MCP 服务器 "${name}" 连接成功`,
          tools: connection.tools.map(t => t.name),
          toolCount: connection.tools.length
        };
        
      case 'disconnect':
        if (!name) {
          throw new Error('请提供连接名称');
        }
        const disconnected = await mcpConnectionManager.disconnect(name);
        return {
          success: disconnected,
          message: disconnected 
            ? `MCP 连接 "${name}" 已断开`
            : `MCP 连接 "${name}" 不存在`
        };
        
      case 'list':
        const connections = mcpConnectionManager.listConnections();
        return {
          success: true,
          connections,
          total: connections.length
        };
        
      case 'tools':
        if (name) {
          const conn = mcpConnectionManager.getConnection(name);
          if (!conn) {
            throw new Error(`MCP 连接不存在: ${name}`);
          }
          return {
            success: true,
            connection: name,
            tools: conn.tools
          };
        } else {
          const allTools = mcpConnectionManager.getAllTools();
          return {
            success: true,
            tools: allTools,
            total: allTools.length
          };
        }
        
      case 'call':
        if (!name || !tool) {
          throw new Error('请提供连接名称和工具名称');
        }
        const result = await mcpConnectionManager.callTool(name, tool, args || {});
        return {
          success: true,
          connection: name,
          tool,
          result
        };
        
      case 'status':
        if (name) {
          const conn = mcpConnectionManager.getConnection(name);
          if (!conn) {
            return {
              success: true,
              exists: false,
              message: `MCP 连接 "${name}" 不存在`
            };
          }
          return {
            success: true,
            exists: true,
            connected: conn.connected,
            toolCount: conn.tools.length,
            config: {
              type: conn.config.type,
              url: conn.config.url,
              command: conn.config.command
            }
          };
        } else {
          const conns = mcpConnectionManager.listConnections();
          return {
            success: true,
            totalConnections: conns.length,
            connections: conns
          };
        }
        
      default:
        throw new Error(`未知操作: ${action}`);
    }
  }
};
