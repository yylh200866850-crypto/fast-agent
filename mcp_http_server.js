// MCP HTTP Server - 通过 HTTP 提供 MCP 服务
import { Server as MCPServer } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import http from 'http';
import { fileTools, handleFileTool } from './tools/file.js';
import { httpTools, handleHttpTool } from './tools/http.js';
import { mongoTools, handleMongoTool } from './tools/mongo.js';
import { systemTools, handleSystemTool } from './tools/system.js';
import { utilsTools, handleUtilsTool } from './tools/utils.js';
import { browserTools, handleBrowserTool } from './tools/browser.js';

export class MCPHTTPServer {
  constructor(config = {}) {
    this.config = {
      host: config.host || '127.0.0.1',
      port: config.port || 8080,
      // 访问控制：'all' | 'whitelist' | 'blacklist'
      accessControl: config.accessControl || 'all',
      // IP 白名单
      whitelist: config.whitelist || ['127.0.0.1', '::1'],
      // IP 黑名单
      blacklist: config.blacklist || [],
      // API Key 认证（可选）
      apiKey: config.apiKey || null,
      // 禁用的工具（安全考虑）
      disabledTools: config.disabledTools || [],
      // 只读模式（禁用写入类工具）
      readOnly: config.readOnly || false,
      ...config
    };
    
    this.server = null;
    this.mcpServer = null;
    this.allTools = [];
    
    // 创建 MCP Server
    this.mcpServer = new MCPServer(
      { name: 'mcp-http-server', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );
    
    // 合并所有工具
    this.allTools = [...fileTools, ...httpTools, ...mongoTools, ...systemTools, ...utilsTools, ...browserTools];
    
    // 过滤禁用的工具
    if (this.config.disabledTools.length > 0) {
      this.allTools = this.allTools.filter(t => !this.config.disabledTools.includes(t.name));
    }
    
    // 只读模式：禁用写入类工具
    if (this.config.readOnly) {
      const writeTools = ['file_write', 'file_delete', 'file_move', 'file_copy', 
                          'http_post', 'http_put', 'http_delete',
                          'mongo_insertOne', 'mongo_insertMany', 'mongo_updateOne', 
                          'mongo_updateMany', 'mongo_deleteOne', 'mongo_deleteMany',
                          'mongo_createDatabase', 'mongo_createUser', 'mongo_updateUserPassword', 
                          'mongo_deleteUser', 'system_exec'];
      this.allTools = this.allTools.filter(t => !writeTools.includes(t.name));
    }
    
    // 设置 MCP 请求处理器
    this.setupMCPHandlers();
    
    // 直接注册工具列表和调用处理器（不通过 MCP SDK 的 request）
    this.toolsListHandler = async () => ({
      tools: this.allTools
    });
    
    this.toolCallHandler = async (name, args) => {
      try {
        // 检查工具是否被禁用
        if (this.config.disabledTools.includes(name)) {
          return { content: [{ type: 'text', text: `Tool ${name} is disabled` }], isError: true };
        }
        
        // 只读模式检查
        if (this.config.readOnly) {
          const writeTools = ['file_write', 'file_delete', 'file_move', 'file_copy', 
                              'http_post', 'http_put', 'http_delete',
                              'mongo_insertOne', 'mongo_insertMany', 'mongo_updateOne', 
                              'mongo_updateMany', 'mongo_deleteOne', 'mongo_deleteMany',
                              'mongo_createDatabase', 'mongo_createUser', 'mongo_updateUserPassword', 
                              'mongo_deleteUser', 'system_exec'];
          if (writeTools.includes(name)) {
            return { content: [{ type: 'text', text: `Tool ${name} is disabled in read-only mode` }], isError: true };
          }
        }
        
        // 文件工具
        if (name.startsWith('file_')) {
          return await handleFileTool(name, args);
        }
        // HTTP 工具
        if (name.startsWith('http_')) {
          return await handleHttpTool(name, args);
        }
        // MongoDB 工具
        if (name.startsWith('mongo_')) {
          return await handleMongoTool(name, args);
        }
        // 系统工具
        if (name.startsWith('system_')) {
          return await handleSystemTool(name, args);
        }
        // 实用工具
        if (name.startsWith('utils_')) {
          return await handleUtilsTool(name, args);
        }
        // 浏览器工具
        if (name.startsWith('browser_')) {
          return await handleBrowserTool(name, args);
        }
        
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
      }
    };
  }
  
  // 设置 MCP 请求处理器
  setupMCPHandlers() {
    // 列出所有可用工具
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.allTools
    }));
    
    // 处理工具调用
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        // 检查工具是否被禁用
        if (this.config.disabledTools.includes(name)) {
          return { content: [{ type: 'text', text: `Tool ${name} is disabled` }], isError: true };
        }
        
        // 只读模式检查
        if (this.config.readOnly) {
          const writeTools = ['file_write', 'file_delete', 'file_move', 'file_copy', 
                              'http_post', 'http_put', 'http_delete',
                              'mongo_insertOne', 'mongo_insertMany', 'mongo_updateOne', 
                              'mongo_updateMany', 'mongo_deleteOne', 'mongo_deleteMany',
                              'mongo_createDatabase', 'mongo_createUser', 'mongo_updateUserPassword', 
                              'mongo_deleteUser', 'system_exec'];
          if (writeTools.includes(name)) {
            return { content: [{ type: 'text', text: `Tool ${name} is disabled in read-only mode` }], isError: true };
          }
        }
        
        // 文件工具
        if (name.startsWith('file_')) {
          return await handleFileTool(name, args);
        }
        // HTTP 工具
        if (name.startsWith('http_')) {
          return await handleHttpTool(name, args);
        }
        // MongoDB 工具
        if (name.startsWith('mongo_')) {
          return await handleMongoTool(name, args);
        }
        // 系统工具
        if (name.startsWith('system_')) {
          return await handleSystemTool(name, args);
        }
        // 实用工具
        if (name.startsWith('utils_')) {
          return await handleUtilsTool(name, args);
        }
        // 浏览器工具
        if (name.startsWith('browser_')) {
          return await handleBrowserTool(name, args);
        }
        
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
      }
    });
  }
  
  // 检查 IP 访问权限
  checkIPAccess(ip) {
    // 移除 IPv6 前缀
    const cleanIP = ip.replace(/^::ffff:/, '');
    
    if (this.config.accessControl === 'all') {
      return true;
    }
    
    if (this.config.accessControl === 'blacklist') {
      return !this.config.blacklist.includes(cleanIP);
    }
    
    if (this.config.accessControl === 'whitelist') {
      return this.config.whitelist.includes(cleanIP);
    }
    
    return true;
  }
  
  // 处理 HTTP 请求
  async handleRequest(req, res) {
    const clientIP = req.socket.remoteAddress;
    console.log(`[MCP HTTP] 收到请求：${req.method} ${clientIP}`);
    
    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }
    
    // 检查 IP 访问权限
    if (!this.checkIPAccess(clientIP)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access denied', ip: clientIP }));
      console.log(`[MCP HTTP] 拒绝访问：${clientIP}`);
      return;
    }
    
    // API Key 认证检查
    if (this.config.apiKey) {
      const authHeader = req.headers['authorization'] || '';
      const providedKey = authHeader.replace('Bearer ', '');
      
      if (providedKey !== this.config.apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid API key' }));
        console.log(`[MCP HTTP] API Key 认证失败：${clientIP}`);
        return;
      }
    }
    
    // 解析请求体
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console.log(`[MCP HTTP] 请求体：${body.substring(0, 100)}`);
        const message = JSON.parse(body);
        
        // 处理不同的 MCP 方法（遵循 JSON-RPC 2.0 规范）
        let result;
        if (message.method === 'tools/list') {
          const toolsResponse = await this.toolsListHandler();
          result = toolsResponse;  // toolsListHandler 已返回 {tools: [...]}
          console.log(`[MCP HTTP] tools/list 响应：${JSON.stringify(result).substring(0, 100)}`);
        } else if (message.method === 'tools/call') {
          const callResult = await this.toolCallHandler(message.params.name, message.params.arguments);
          result = callResult;
        } else if (message.method === 'initialize') {
          // MCP 初始化握手
          result = {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'mcp-http-server', version: '1.0.0' }
          };
        } else if (message.method === 'notifications/initialized') {
          // 通知，不需要响应
          console.log('[MCP HTTP] 收到 initialized 通知');
          res.writeHead(200);
          res.end();
          return;
        } else {
          result = { error: `Unknown method: ${message.method}` };
        }
        
        // 发送 JSON-RPC 响应
        const response = {
          jsonrpc: '2.0',
          id: message.id,
          result
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        console.error(`[MCP HTTP] 处理错误：`, error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    
    req.on('error', error => {
      console.error(`[MCP HTTP] 请求错误：`, error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    });
  }
  
  // 启动 HTTP 服务器
  async start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));
      
      this.server.listen(this.config.port, this.config.host, () => {
        console.log(`[MCP HTTP Server] 已启动`);
        console.log(`  地址：http://${this.config.host}:${this.config.port}`);
        console.log(`  访问控制：${this.config.accessControl}`);
        
        if (this.config.accessControl === 'whitelist') {
          console.log(`  白名单：${this.config.whitelist.join(', ')}`);
        } else if (this.config.accessControl === 'blacklist') {
          console.log(`  黑名单：${this.config.blacklist.join(', ')}`);
        }
        
        if (this.config.apiKey) {
          console.log(`  API Key：已启用`);
        }
        
        if (this.config.readOnly) {
          console.log(`  只读模式：已启用`);
        }
        
        if (this.config.disabledTools.length > 0) {
          console.log(`  禁用工具：${this.config.disabledTools.join(', ')}`);
        }
        
        console.log(`  可用工具：${this.allTools.length} 个`);
        
        resolve();
      });
      
      this.server.on('error', reject);
    });
  }
  
  // 停止服务器
  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[MCP HTTP Server] 已停止');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export default MCPHTTPServer;
