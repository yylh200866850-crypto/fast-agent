/**
 * Web Server - 提供Web界面和API
 */
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync, createReadStream, unlinkSync, renameSync } from 'fs';
import { execSync } from 'child_process';
import { Agent } from './index.js';
import ConversationStore from './conversation_store.js';
import loadConfig from './config.js';
import { createLogger } from './logger.js';

// 兼容 ES Module 和 CommonJS 环境
const getDirname = () => {
  // ES Module 环境
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    // CommonJS 或 pkg 打包环境
    if (typeof globalThis.__dirname !== 'undefined') {
      return globalThis.__dirname;
    }
    return process.cwd();
  }
};
const __dirname = getDirname();
const logger = createLogger('WebServer');

// 检查是否在 pkg 打包环境中运行
const isPkg = typeof process.pkg !== 'undefined';

// 内嵌的 index.html（构建时会被替换）
// eslint-disable-next-line no-constant-condition
const INDEX_HTML = "__EMBEDDED_INDEX_HTML__";
// hasEmbeddedHtml 将在构建时被直接替换为 true
const hasEmbeddedHtml = "__HAS_EMBEDDED_HTML__";

if (isPkg && hasEmbeddedHtml) {
  console.log('[WebServer] 使用内嵌的 index.html');
}

export class WebServer {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.host = options.host || '127.0.0.1';
    // this.host = options.host || '0.0.0.0';
    this.app = express();
    this.server = null;
    
    // 配置和存储
    this.config = loadConfig();
    this.conversationStore = new ConversationStore();
    
    // Agent 实例池（每个对话一个）
    this.agents = new Map();
    
    // 设置中间件和路由
    this.setupMiddleware();
    this.setupRoutes();
  }

  // 设置中间件
  setupMiddleware() {
    // JSON 解析
    this.app.use(express.json({ limit: '10mb' }));
    
    // 静态文件服务 - 支持 pkg 打包
    const publicDir = join(__dirname, 'public');
    
    // 检查是否在 pkg 打包环境中运行
    const isPkg = typeof process.pkg !== 'undefined';
    
    if (isPkg) {
      // pkg 打包后，使用自定义静态文件服务
      const { createReadStream } = require('fs');
      const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject'
      };
      
      this.app.use((req, res, next) => {
        // 只处理 GET 和 HEAD 请求
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          return next();
        }
        
        // 获取请求路径
        let filePath = req.path;
        if (filePath === '/') {
          filePath = '/index.html';
        }
        
        const fullPath = join(publicDir, filePath);
        const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
        
        // 检查文件是否存在
        if (!existsSync(fullPath)) {
          return next();
        }
        
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        
        const stream = createReadStream(fullPath);
        stream.on('error', (err) => {
          res.statusCode = 500;
          res.end('Internal Server Error');
        });
        stream.pipe(res);
      });
    } else {
      // 开发模式，使用 express.static
      if (existsSync(publicDir)) {
        this.app.use(express.static(publicDir));
      }
    }
    
    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // 请求日志
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  // 设置路由
  setupRoutes() {
    // ==================== 页面路由 ====================
    this.app.get('/', (req, res) => {
      // pkg 打包环境：使用内嵌的 HTML
      if (hasEmbeddedHtml) {
        res.setHeader('Content-Type', 'text/html');
        return res.send(INDEX_HTML);
      }
      
      // 开发环境：从文件系统读取
      const indexPath = join(__dirname, 'public', 'index.html');
      try {
        const html = readFileSync(indexPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
      } catch (err) {
        res.status(500).send('Failed to load index.html');
      }
    });

    // ==================== 对话 API ====================
    
    // 获取对话列表
    this.app.get('/api/conversations', (req, res) => {
      try {
        const { query } = req.query;
        const conversations = query 
          ? this.conversationStore.searchConversations(query)
          : this.conversationStore.listConversations();
        res.json({ success: true, data: conversations });
      } catch (error) {
        logger.error('获取对话列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 创建新对话
    this.app.post('/api/conversations', async (req, res) => {
      try {
        const { title, systemPrompt, provider, model } = req.body;
        const conversation = this.conversationStore.createConversation(
          title || '新对话',
          systemPrompt || ''
        );
        
        // 更新设置
        if (provider || model) {
          this.conversationStore.updateConversation(conversation.id, { provider, model });
        }
        
        res.json({ success: true, data: conversation });
      } catch (error) {
        logger.error('创建对话失败:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 获取对话详情
    this.app.get('/api/conversations/:id', (req, res) => {
      try {
        const conversation = this.conversationStore.getConversation(req.params.id);
        if (!conversation) {
          return res.status(404).json({ success: false, error: '对话不存在' });
        }
        res.json({ success: true, data: conversation });
      } catch (error) {
        logger.error('获取对话详情失败:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 更新对话设置
    this.app.put('/api/conversations/:id', (req, res) => {
      try {
        const conversation = this.conversationStore.updateConversation(
          req.params.id,
          req.body
        );
        res.json({ success: true, data: conversation });
      } catch (error) {
        logger.error('更新对话失败:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 删除对话
    this.app.delete('/api/conversations/:id', async (req, res) => {
      try {
        // 清理对应的 Agent
        if (this.agents.has(req.params.id)) {
          const agent = this.agents.get(req.params.id);
          await agent.close();
          this.agents.delete(req.params.id);
        }
        
        const deleted = this.conversationStore.deleteConversation(req.params.id);
        res.json({ success: deleted });
      } catch (error) {
        logger.error('删除对话失败:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 清空对话消息
    this.app.delete('/api/conversations/:id/messages', (req, res) => {
      try {
        const conversation = this.conversationStore.clearMessages(req.params.id);
        res.json({ success: true, data: conversation });
      } catch (error) {
        logger.error('清空对话消息失败:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 获取对话版本列表
    this.app.get('/api/conversations/:id/versions', (req, res) => {
      try {
        const versions = this.conversationStore.getConversationVersions(req.params.id);
        res.json({ success: true, data: versions });
      } catch (error) {
        logger.error('获取对话版本失败:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 克隆对话（创建新版本）
    this.app.post('/api/conversations/:id/clone', (req, res) => {
      try {
        const { messages, title } = req.body;
        const cloned = this.conversationStore.cloneConversation(req.params.id, { messages, title });
        res.json({ success: true, data: cloned });
      } catch (error) {
        logger.error('克隆对话失败:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 编辑消息（克隆对话并修改消息）
    this.app.put('/api/conversations/:id/messages/:msgIndex', async (req, res) => {
      try {
        const { content } = req.body;
        const msgIndex = parseInt(req.params.msgIndex);
        
        const conversation = this.conversationStore.getConversation(req.params.id);
        if (!conversation) {
          return res.status(404).json({ success: false, error: '对话不存在' });
        }
        
        if (msgIndex < 0 || msgIndex >= conversation.messages.length) {
          return res.status(400).json({ success: false, error: '消息索引无效' });
        }
        
        // 克隆对话，保留编辑点之前的消息
        const newMessages = conversation.messages.slice(0, msgIndex + 1);
        newMessages[msgIndex] = {
          ...newMessages[msgIndex],
          content,
          editedAt: new Date().toISOString()
        };
        
        const cloned = this.conversationStore.cloneConversation(req.params.id, { messages: newMessages });
        res.json({ success: true, data: cloned });
      } catch (error) {
        logger.error('编辑消息失败:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 重新生成AI回复（克隆对话并重新生成）
    this.app.post('/api/conversations/:id/regenerate', async (req, res) => {
      const conversationId = req.params.id;
      const { provider, model, msgIndex } = req.body;
      
      try {
        const conversation = this.conversationStore.getConversation(conversationId);
        if (!conversation) {
          return res.status(404).json({ success: false, error: '对话不存在' });
        }
        
        // 找到要重新生成的消息索引（默认为最后一条AI消息）
        let targetIndex = msgIndex;
        if (targetIndex === undefined || targetIndex === null) {
          // 找到最后一条assistant消息
          for (let i = conversation.messages.length - 1; i >= 0; i--) {
            if (conversation.messages[i].role === 'assistant') {
              targetIndex = i;
              break;
            }
          }
        }
        
        if (targetIndex === undefined || targetIndex === null) {
          return res.status(400).json({ success: false, error: '未找到可重新生成的消息' });
        }
        
        // 找到对应的用户消息（AI回复的前一条）
        let userMsgIndex = targetIndex - 1;
        while (userMsgIndex >= 0 && conversation.messages[userMsgIndex].role !== 'user') {
          userMsgIndex--;
        }
        
        if (userMsgIndex < 0) {
          return res.status(400).json({ success: false, error: '未找到对应的用户消息' });
        }
        
        // 克隆对话，保留到用户消息为止
        const newMessages = conversation.messages.slice(0, userMsgIndex + 1);
        const cloned = this.conversationStore.cloneConversation(conversationId, { messages: newMessages });
        
        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.flushHeaders();
        
        // 创建Agent并恢复历史
        const agent = new Agent({
          systemPrompt: conversation.systemPrompt || ''
        });
        await agent.init();
        
        if (conversation.systemPrompt) {
          agent.messages = [{ role: 'system', content: conversation.systemPrompt }];
        } else {
          agent.messages = [];
        }
        
        for (const msg of newMessages) {
          if (msg.role === 'user') {
            agent.messages.push({ role: 'user', content: msg.content });
          } else if (msg.role === 'assistant') {
            const assistantMsg = { role: 'assistant', content: msg.content };
            if (msg.tool_calls) {
              assistantMsg.tool_calls = msg.tool_calls;
            }
            agent.messages.push(assistantMsg);
          } else if (msg.role === 'tool') {
            agent.messages.push({
              role: 'tool',
              tool_call_id: msg.tool_call_id,
              content: msg.content
            });
          }
        }
        
        // 如果指定了provider/model，临时切换
        const originalProvider = agent.provider?.name;
        if (provider && this.config.providers?.[provider]) {
          agent.setProvider(provider);
          if (model) {
            agent.setModel(model);
          }
        }
        
        const userMessage = conversation.messages[userMsgIndex].content;
        
        const onProgress = (event) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
          if (typeof res.flush === 'function') {
            res.flush();
          }
        };
        
        try {
          const reply = await agent.chatStreamWithTools(userMessage, { onProgress });
          
          // 保存新消息到克隆的对话
          const systemMsgCount = 1;
          const historyMsgCount = newMessages.length;
          const startIndex = systemMsgCount + historyMsgCount;
          const generatedMessages = agent.messages.slice(startIndex);
          
          for (const msg of generatedMessages) {
            if (msg.role === 'assistant') {
              const assistantMsgData = { role: 'assistant', content: msg.content };
              if (msg.tool_calls) {
                assistantMsgData.tool_calls = msg.tool_calls;
              }
              this.conversationStore.addMessage(cloned.id, assistantMsgData);
            } else if (msg.role === 'tool') {
              this.conversationStore.addMessage(cloned.id, {
                role: 'tool',
                tool_call_id: msg.tool_call_id,
                content: msg.content
              });
            }
          }
          
          // 返回新对话ID
          res.write(`data: ${JSON.stringify({ type: 'done', content: reply, newConversationId: cloned.id })}\n\n`);
          res.end();
          
          await agent.close();
        } catch (error) {
          logger.error('重新生成失败:', error);
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
          res.end();
          await agent.close();
        }
      } catch (error) {
        logger.error('重新生成初始化失败:', error);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: error.message });
        } else {
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
          res.end();
        }
      }
    });

    // 发送消息（对话）- 流式响应
    this.app.post('/api/conversations/:id/chat', async (req, res) => {      const { message } = req.body;
      const conversationId = req.params.id;
      
      try {
        const conversation = this.conversationStore.getConversation(conversationId);
        if (!conversation) {
          return res.status(404).json({ success: false, error: '对话不存在' });
        }

        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        // 禁用 Express 的压缩缓冲
        res.setHeader('Transfer-Encoding', 'chunked');
        // 立即发送头部
        res.flushHeaders();

        // 为此请求创建独立的 Agent 实例（避免多对话状态冲突）
        const agent = new Agent({
          systemPrompt: conversation.systemPrompt || ''
        });
        await agent.init();

        // 恢复历史消息到新 Agent（包含完整的工具调用历史）
        if (conversation.systemPrompt) {
          agent.messages = [{ role: 'system', content: conversation.systemPrompt }];
        } else {
          agent.messages = [];
        }
        for (const msg of conversation.messages) {
          // 保留完整消息结构，包括工具调用
          if (msg.role === 'user') {
            agent.messages.push({ role: 'user', content: msg.content });
          } else if (msg.role === 'assistant') {
            // 助手消息可能包含 tool_calls
            const assistantMsg = { role: 'assistant', content: msg.content };
            if (msg.tool_calls) {
              assistantMsg.tool_calls = msg.tool_calls;
            }
            agent.messages.push(assistantMsg);
          } else if (msg.role === 'tool') {
            // 工具返回消息
            agent.messages.push({
              role: 'tool',
              tool_call_id: msg.tool_call_id,
              content: msg.content
            });
          }
        }

        // 保存用户消息
        this.conversationStore.addMessage(conversationId, {
          role: 'user',
          content: message
        });

        // 发送用户消息确认
        res.write(`data: ${JSON.stringify({ type: 'user_message', content: message })}\n\n`);

        // 流式进度回调
        const onProgress = (event) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
          // 强制刷新缓冲区，确保实时发送
          if (typeof res.flush === 'function') {
            res.flush();
          }
        };

        try {
          // 使用流式聊天方法
          const reply = await agent.chatStreamWithTools(message, { onProgress });
          
          // 保存工具调用历史
          // 获取本次对话新增的消息（排除 system 消息和历史消息）
          // agent.messages 结构: [system, ...历史消息, user, ...工具调用循环消息]
          const systemMsgCount = 1; // system 消息
          const historyMsgCount = conversation.messages.length; // 历史消息数量
          const userMsgCount = 1; // 刚添加的用户消息
          const startIndex = systemMsgCount + historyMsgCount + userMsgCount;
          const newMessages = agent.messages.slice(startIndex);
          
          // 按顺序保存所有新增消息
          for (const msg of newMessages) {
            if (msg.role === 'assistant') {
              // 保存助手消息（可能包含 tool_calls）
              const assistantMsgData = {
                role: 'assistant',
                content: msg.content
              };
              if (msg.tool_calls) {
                assistantMsgData.tool_calls = msg.tool_calls;
              }
              this.conversationStore.addMessage(conversationId, assistantMsgData);
            } else if (msg.role === 'tool') {
              // 保存工具返回消息
              this.conversationStore.addMessage(conversationId, {
                role: 'tool',
                tool_call_id: msg.tool_call_id,
                content: msg.content
              });
            }
          }

          // 发送完成事件
          res.write(`data: ${JSON.stringify({ type: 'done', content: reply })}\n\n`);
          res.end();
          
          // 清理 Agent
          await agent.close();
        } catch (error) {
          logger.error('对话失败:', error);
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
          res.end();
          await agent.close();
        }
      } catch (error) {
        logger.error('对话初始化失败:', error);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: error.message });
        } else {
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
          res.end();
        }
      }
    });

    // ==================== 配置 API ====================
    
    // 获取配置
    this.app.get('/api/config', (req, res) => {
      try {
        // 读取最新配置
        const configPath = join(__dirname, 'config.json');
        let config = {};
        if (existsSync(configPath)) {
          config = JSON.parse(readFileSync(configPath, 'utf-8'));
        }
        res.json({ success: true, data: config });
      } catch (error) {
        logger.error('获取配置失败:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 更新配置
    this.app.put('/api/config', (req, res) => {
      try {
        const configPath = join(__dirname, 'config.json');
        const currentConfig = existsSync(configPath) 
          ? JSON.parse(readFileSync(configPath, 'utf-8'))
          : {};
        
        // 深度合并
        const newConfig = this.deepMerge(currentConfig, req.body);
        
        writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
        
        // 重新加载配置
        this.config = loadConfig();
        
        res.json({ success: true, data: newConfig });
      } catch (error) {
        logger.error('更新配置失败:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 获取 Providers 列表
    this.app.get('/api/providers', (req, res) => {
      try {
        const providers = Object.keys(this.config.providers || {}).map(name => ({
          name,
          model: this.config.providers[name]?.model,
          baseUrl: this.config.providers[name]?.baseUrl
        }));
        res.json({ success: true, data: providers });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 切换默认 Provider
    this.app.put('/api/providers/default', (req, res) => {
      try {
        const { provider } = req.body;
        if (!this.config.providers?.[provider]) {
          return res.status(400).json({ success: false, error: 'Provider 不存在' });
        }
        
        const configPath = join(__dirname, 'config.json');
        const currentConfig = existsSync(configPath)
          ? JSON.parse(readFileSync(configPath, 'utf-8'))
          : {};
        
        currentConfig.defaultProvider = provider;
        writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf-8');
        
        this.config = loadConfig();
        
        res.json({ success: true, data: { defaultProvider: provider } });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // ==================== Skills API ====================
    
    // 内置技能列表（受保护）
    const BUILTIN_SKILLS = [
      'system_context', 'model_manager', 'skill_installer', 'skill_market',
      'calculator', 'docx', 'pdf', 'pptx', 'xlsx', 'txt',
      'web_search', 'http_request', 'get_time', 'edge_control',
      'mcp_client', 'image', 'memory', 'code'
    ];

    // 技能状态存储
    const skillsStatusPath = join(__dirname, 'data', 'skills_status.json');
    const getSkillsStatus = () => {
      try {
        if (existsSync(skillsStatusPath)) {
          return JSON.parse(readFileSync(skillsStatusPath, 'utf-8'));
        }
      } catch (e) {}
      return { disabled: [] };
    };
    const saveSkillsStatus = (status) => {
      const dataDir = dirname(skillsStatusPath);
      if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
      writeFileSync(skillsStatusPath, JSON.stringify(status, null, 2));
    };

    // 获取 Skills 列表
    this.app.get('/api/skills', async (req, res) => {
      try {
        const skillsDir = join(__dirname, 'skills');
        
        if (!existsSync(skillsDir)) {
          return res.json({ success: true, data: [] });
        }
        
        const skillsStatus = getSkillsStatus();
        
        const skills = readdirSync(skillsDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
          .map(dirent => {
            const skillPath = join(skillsDir, dirent.name);
            const skillMdPath = join(skillPath, 'SKILL.md');
            let description = '';
            let metadata = {};
            
            if (existsSync(skillMdPath)) {
              try {
                const content = readFileSync(skillMdPath, 'utf-8');
                const descMatch = content.match(/#\s*(.+?)(?:\n|$)/);
                if (descMatch) description = descMatch[1].trim();
                // 解析 frontmatter
                const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
                if (fmMatch) {
                  const lines = fmMatch[1].split('\n');
                  for (const line of lines) {
                    const [key, ...valueParts] = line.split(':');
                    if (key && valueParts.length > 0) {
                      metadata[key.trim()] = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
                    }
                  }
                }
              } catch (e) {}
            }
            
            const isBuiltin = BUILTIN_SKILLS.includes(dirent.name);
            const isDisabled = skillsStatus.disabled?.includes(dirent.name);
            
            return {
              name: dirent.name,
              description,
              enabled: !isDisabled,
              builtin: isBuiltin,
              version: metadata.version || '1.0.0',
              author: metadata.author || 'unknown',
              path: skillPath
            };
          });
        
        res.json({ success: true, data: skills });
      } catch (error) {
        logger.error('获取 Skills 列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 获取 Skill 详情
    this.app.get('/api/skills/:name', async (req, res) => {
      try {
        const skillPath = join(__dirname, 'skills', req.params.name);
        if (!existsSync(skillPath)) {
          return res.status(404).json({ success: false, error: 'Skill 不存在' });
        }
        
        const skillMdPath = join(skillPath, 'SKILL.md');
        let metadata = {};
        
        if (existsSync(skillMdPath)) {
          const content = readFileSync(skillMdPath, 'utf-8');
          // 解析 frontmatter
          const match = content.match(/^---\n([\s\S]*?)\n---/);
          if (match) {
            const lines = match[1].split('\n');
            for (const line of lines) {
              const [key, ...valueParts] = line.split(':');
              if (key && valueParts.length > 0) {
                metadata[key.trim()] = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
              }
            }
          }
          metadata.readme = content;
        }
        
        // 获取文件列表
        const files = [];
        const scanDir = (dir, prefix = '') => {
          const items = readdirSync(dir, { withFileTypes: true });
          for (const item of items) {
            if (item.name.startsWith('.')) continue;
            const fullPath = join(dir, item.name);
            if (item.isDirectory()) {
              scanDir(fullPath, prefix + item.name + '/');
            } else {
              const stat = statSync(fullPath);
              files.push({
                name: prefix + item.name,
                size: stat.size
              });
            }
          }
        };
        scanDir(skillPath);
        
        const skillsStatus = getSkillsStatus();
        
        res.json({ 
          success: true, 
          data: { 
            name: req.params.name, 
            builtin: BUILTIN_SKILLS.includes(req.params.name),
            enabled: !skillsStatus.disabled?.includes(req.params.name),
            files,
            ...metadata 
          } 
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 启用/禁用 Skill
    this.app.put('/api/skills/:name/status', (req, res) => {
      try {
        const { enabled } = req.body;
        const skillName = req.params.name;
        const skillPath = join(__dirname, 'skills', skillName);
        
        if (!existsSync(skillPath)) {
          return res.status(404).json({ success: false, error: 'Skill 不存在' });
        }
        
        const skillsStatus = getSkillsStatus();
        if (!skillsStatus.disabled) skillsStatus.disabled = [];
        
        if (enabled) {
          skillsStatus.disabled = skillsStatus.disabled.filter(s => s !== skillName);
        } else {
          if (!skillsStatus.disabled.includes(skillName)) {
            skillsStatus.disabled.push(skillName);
          }
        }
        
        saveSkillsStatus(skillsStatus);
        
        res.json({ 
          success: true, 
          message: enabled ? `Skill "${skillName}" 已启用` : `Skill "${skillName}" 已禁用`,
          enabled 
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 卸载 Skill
    this.app.delete('/api/skills/:name', (req, res) => {
      try {
        const skillName = req.params.name;
        const skillPath = join(__dirname, 'skills', skillName);
        
        if (!existsSync(skillPath)) {
          return res.status(404).json({ success: false, error: 'Skill 不存在' });
        }
        
        if (BUILTIN_SKILLS.includes(skillName)) {
          return res.status(403).json({ success: false, error: '不能卸载内置 Skill' });
        }
        
        // 删除目录
        rmSync(skillPath, { recursive: true, force: true });
        
        // 从禁用列表移除
        const skillsStatus = getSkillsStatus();
        if (skillsStatus.disabled) {
          skillsStatus.disabled = skillsStatus.disabled.filter(s => s !== skillName);
          saveSkillsStatus(skillsStatus);
        }
        
        res.json({ success: true, message: `Skill "${skillName}" 已卸载` });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 导出 Skill (zip)
    this.app.get('/api/skills/:name/export', (req, res) => {
      try {
        const skillName = req.params.name;
        const skillPath = join(__dirname, 'skills', skillName);
        
        if (!existsSync(skillPath)) {
          return res.status(404).json({ success: false, error: 'Skill 不存在' });
        }
        
        // 创建临时 zip 文件
        const tempDir = join(__dirname, 'data', 'temp');
        if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
        const zipPath = join(tempDir, `${skillName}.zip`);
        
        // 使用系统命令打包
        const { execSync } = require('child_process');
        if (process.platform === 'win32') {
          execSync(`powershell -Command "Compress-Archive -Path '${join(skillPath, '*')}' -DestinationPath '${zipPath}' -Force"`);
        } else {
          execSync(`cd "${skillPath}" && zip -r "${zipPath}" .`);
        }
        
        // 发送文件
        res.download(zipPath, `${skillName}.zip`, (err) => {
          // 清理临时文件
          if (existsSync(zipPath)) unlinkSync(zipPath);
          if (err) logger.error('导出 Skill 失败:', err);
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 导入 Skill (zip 上传)
    this.app.post('/api/skills/import', express.raw({ type: 'application/zip', limit: '50mb' }), async (req, res) => {
      try {
        const tempDir = join(__dirname, 'data', 'temp');
        if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
        
        const tempZip = join(tempDir, `import_${Date.now()}.zip`);
        const extractDir = join(tempDir, `extract_${Date.now()}`);
        
        // 保存上传的 zip
        writeFileSync(tempZip, req.body);
        mkdirSync(extractDir, { recursive: true });
        
        // 解压
        if (process.platform === 'win32') {
          execSync(`powershell -Command "Expand-Archive -Path '${tempZip}' -DestinationPath '${extractDir}' -Force"`);
        } else {
          execSync(`unzip -o "${tempZip}" -d "${extractDir}"`);
        }
        
        // 查找 skill 目录
        const findSkillDir = (dir) => {
          const items = readdirSync(dir, { withFileTypes: true });
          // 检查当前目录
          if (items.some(i => i.name === 'SKILL.md' || i.name === 'main.js' || i.name === 'index.js')) {
            return dir;
          }
          // 检查子目录
          for (const item of items) {
            if (item.isDirectory()) {
              const found = findSkillDir(join(dir, item.name));
              if (found) return found;
            }
          }
          return null;
        };
        
        const skillDir = findSkillDir(extractDir);
        if (!skillDir) {
          rmSync(tempZip, { force: true });
          rmSync(extractDir, { recursive: true, force: true });
          return res.status(400).json({ success: false, error: '未找到有效的 Skill 文件' });
        }
        
        const skillName = basename(skillDir);
        const destDir = join(__dirname, 'skills', skillName);
        
        if (existsSync(destDir)) {
          rmSync(tempZip, { force: true });
          rmSync(extractDir, { recursive: true, force: true });
          return res.status(400).json({ success: false, error: `Skill "${skillName}" 已存在` });
        }
        
        // 移动到 skills 目录
        renameSync(skillDir, destDir);
        
        // 清理临时文件
        rmSync(tempZip, { force: true });
        rmSync(extractDir, { recursive: true, force: true });
        
        res.json({ 
          success: true, 
          message: `Skill "${skillName}" 导入成功`,
          name: skillName
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 从 URL 安装 Skill
    this.app.post('/api/skills/install', async (req, res) => {
      try {
        const { url } = req.body;
        if (!url) {
          return res.status(400).json({ success: false, error: '请提供 URL' });
        }
        
        const tempDir = join(__dirname, 'data', 'temp');
        if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
        
        const tempZip = join(tempDir, `download_${Date.now()}.zip`);
        const extractDir = join(tempDir, `extract_${Date.now()}`);
        
        // 下载文件
        const https = require('https');
        const http = require('http');
        const getter = url.startsWith('https') ? https : http;
        
        await new Promise((resolve, reject) => {
          const file = require('fs').createWriteStream(tempZip);
          getter.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
              // 跟随重定向
              const redirectUrl = response.headers.location;
              getter.get(redirectUrl, file).on('error', reject);
              file.on('finish', resolve);
              return;
            }
            response.pipe(file);
            file.on('finish', resolve);
          }).on('error', reject);
        });
        
        mkdirSync(extractDir, { recursive: true });
        
        // 解压
        const { execSync } = require('child_process');
        if (process.platform === 'win32') {
          execSync(`powershell -Command "Expand-Archive -Path '${tempZip}' -DestinationPath '${extractDir}' -Force"`);
        } else {
          execSync(`unzip -o "${tempZip}" -d "${extractDir}"`);
        }
        
        // 查找 skill 目录
        const findSkillDir = (dir) => {
          const items = readdirSync(dir, { withFileTypes: true });
          if (items.some(i => i.name === 'SKILL.md' || i.name === 'main.js' || i.name === 'index.js')) {
            return dir;
          }
          for (const item of items) {
            if (item.isDirectory()) {
              const found = findSkillDir(join(dir, item.name));
              if (found) return found;
            }
          }
          return null;
        };
        
        const skillDir = findSkillDir(extractDir);
        if (!skillDir) {
          rmSync(tempZip, { force: true });
          rmSync(extractDir, { recursive: true, force: true });
          return res.status(400).json({ success: false, error: '未找到有效的 Skill 文件' });
        }
        
        const skillName = basename(skillDir);
        const destDir = join(__dirname, 'skills', skillName);
        
        if (existsSync(destDir)) {
          rmSync(tempZip, { force: true });
          rmSync(extractDir, { recursive: true, force: true });
          return res.status(400).json({ success: false, error: `Skill "${skillName}" 已存在` });
        }
        
        // 移动到 skills 目录
        const { renameSync } = require('fs');
        renameSync(skillDir, destDir);
        
        // 清理
        rmSync(tempZip, { force: true });
        rmSync(extractDir, { recursive: true, force: true });
        
        res.json({ 
          success: true, 
          message: `Skill "${skillName}" 安装成功`,
          name: skillName
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // ==================== MCP 配置 API ====================
    
    // 获取 MCP 配置
    this.app.get('/api/mcp', (req, res) => {
      try {
        const mcpConfig = this.config.mcp || {};
        res.json({ success: true, data: mcpConfig });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 更新 MCP 配置
    this.app.put('/api/mcp', (req, res) => {
      try {
        const configPath = join(__dirname, 'config.json');
        const currentConfig = existsSync(configPath)
          ? JSON.parse(readFileSync(configPath, 'utf-8'))
          : {};
        
        currentConfig.mcp = {
          ...currentConfig.mcp,
          ...req.body
        };
        
        writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf-8');
        this.config = loadConfig();
        
        res.json({ success: true, data: currentConfig.mcp });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 更新白名单
    this.app.put('/api/mcp/whitelist', (req, res) => {
      try {
        const { whitelist } = req.body;
        const configPath = join(__dirname, 'config.json');
        const currentConfig = existsSync(configPath)
          ? JSON.parse(readFileSync(configPath, 'utf-8'))
          : {};
        
        if (!currentConfig.mcp) currentConfig.mcp = {};
        if (!currentConfig.mcp.httpServer) currentConfig.mcp.httpServer = {};
        
        currentConfig.mcp.httpServer.whitelist = whitelist;
        
        writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf-8');
        this.config = loadConfig();
        
        res.json({ success: true, data: { whitelist } });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 更新黑名单
    this.app.put('/api/mcp/blacklist', (req, res) => {
      try {
        const { blacklist } = req.body;
        const configPath = join(__dirname, 'config.json');
        const currentConfig = existsSync(configPath)
          ? JSON.parse(readFileSync(configPath, 'utf-8'))
          : {};
        
        if (!currentConfig.mcp) currentConfig.mcp = {};
        if (!currentConfig.mcp.httpServer) currentConfig.mcp.httpServer = {};
        
        currentConfig.mcp.httpServer.blacklist = blacklist;
        
        writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf-8');
        this.config = loadConfig();
        
        res.json({ success: true, data: { blacklist } });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 更新禁用工具列表
    this.app.put('/api/mcp/disabled-tools', (req, res) => {
      try {
        const { disabledTools } = req.body;
        const configPath = join(__dirname, 'config.json');
        const currentConfig = existsSync(configPath)
          ? JSON.parse(readFileSync(configPath, 'utf-8'))
          : {};
        
        if (!currentConfig.mcp) currentConfig.mcp = {};
        if (!currentConfig.mcp.httpServer) currentConfig.mcp.httpServer = {};
        
        currentConfig.mcp.httpServer.disabledTools = disabledTools;
        
        writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf-8');
        this.config = loadConfig();
        
        res.json({ success: true, data: { disabledTools } });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // ==================== 工具 API ====================
    
    // 获取可用工具列表
    this.app.get('/api/tools', async (req, res) => {
      try {
        // 创建临时 Agent 获取工具
        const agent = new Agent();
        await agent.init();
        const tools = await agent.getTools();
        await agent.close();
        
        const categorizedTools = {
          file: tools.filter(t => t.function.name.startsWith('file_')),
          http: tools.filter(t => t.function.name.startsWith('http_')),
          mongo: tools.filter(t => t.function.name.startsWith('mongo_')),
          system: tools.filter(t => t.function.name.startsWith('system_')),
          utils: tools.filter(t => t.function.name.startsWith('utils_')),
          skill: tools.filter(t => t.function.name.startsWith('skill_'))
        };
        
        res.json({ success: true, data: categorizedTools });
      } catch (error) {
        logger.error('获取工具列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // ==================== 统计 API ====================
    
    this.app.get('/api/stats', (req, res) => {
      try {
        const stats = this.conversationStore.getStats();
        res.json({ success: true, data: stats });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }

  // 深度合并
  deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  // 启动服务器
  async start() {
    return new Promise((resolve, reject) => {
      this.server = createServer(this.app);
      
      this.server.listen(this.port, this.host, () => {
        console.log('');
        console.log('='.repeat(50));
        console.log('🌐 Web Server 已启动');
        console.log(`📍 地址: http://localhost:${this.port}`);
        console.log('='.repeat(50));
        console.log('');
        
        logger.info(`Web Server started on http://${this.host}:${this.port}`);
        resolve();
      });
      
      this.server.on('error', reject);
    });
  }

  // 停止服务器
  async stop() {
    // 关闭所有 Agent
    for (const [id, agent] of this.agents) {
      try {
        await agent.close();
      } catch (e) {
        logger.error(`关闭 Agent ${id} 失败:`, e);
      }
    }
    this.agents.clear();
    
    // 关闭服务器
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Web Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export default WebServer;
