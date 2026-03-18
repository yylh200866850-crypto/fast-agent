// LLM Agent 主入口
import loadConfig from './config.js';
import { createProvider } from './providers/index.js';
import SkillManager from './skills.js';
import { createLogger } from './logger.js';
import { fileTools, handleFileTool } from './tools/file.js';
import { httpTools, handleHttpTool } from './tools/http.js';
import { mongoTools, handleMongoTool } from './tools/mongo.js';
import { systemTools, handleSystemTool } from './tools/system.js';
import { utilsTools, handleUtilsTool } from './tools/utils.js';

const logger = createLogger('Agent');

// 所有内置工具
const builtInTools = [...fileTools, ...httpTools, ...mongoTools, ...systemTools, ...utilsTools];

// 默认系统提示词
const DEFAULT_SYSTEM_PROMPT = `你是 Fast-Agent，一个运行在 Fast-Agent 框架上的 AI 助手。

## 关于你自己
- 你是一个 AI 助手，运行在 Fast-Agent 框架上
- 你可以通过工具调用与用户交互，完成各种任务
- 你可以使用 skill_system_context 技能查询当前系统状态（包括你正在使用的模型）
- 你可以使用 skill_model_manager 技能管理模型配置（切换、查看、测试）

## 重要提示
1. 当用户询问你是什么模型、你的能力、你的配置时，请使用 skill_system_context 或 skill_model_manager 工具来获取准确信息
2. 不要猜测或幻觉你的模型名称、版本或能力，始终通过工具查询
3. 你可以使用以下类型的工具：
   - file_* : 文件操作工具
   - http_* : HTTP 请求工具
   - mongo_* : MongoDB 数据库工具
   - system_* : 系统工具
   - utils_* : 实用工具
   - skill_* : 技能调用工具

请根据用户的需求，合理使用这些工具来完成任务。`;

export class Agent {
  constructor(options = {}) {
    this.config = loadConfig(options.configPath);
    this.provider = null;
    this.skillManager = new SkillManager(null, this.config.allSkillsDirs);
    this.messages = [];
    // 合并默认系统提示词和用户自定义提示词
    this.systemPrompt = DEFAULT_SYSTEM_PROMPT + (options.systemPrompt ? '\n\n## 用户自定义设置\n' + options.systemPrompt : '');
    this.mcpHttpServer = null;
    
    // 故障转移配置
    this.fallbackProviders = options.fallbackProviders || this.config.fallbackProviders || [];
    this.currentProviderIndex = 0;
    this.failedProviders = new Set(); // 记录本次会话中失败的提供商
    
    // 打印运行环境信息
    if (this.config._paths?.isPkg) {
      console.log('='.repeat(50));
      console.log('运行环境信息:');
      console.log(`  isPkg: ${this.config._paths.isPkg}`);
      console.log(`  exeDir: ${this.config._paths.exeDir}`);
      console.log(`  内置 Skills: ${this.config._paths.builtInSkillsDir}`);
      console.log(`  外部 Skills: ${this.config._paths.externalSkillsDir}`);
      console.log('='.repeat(50));
    }
  }

  // 初始化 Agent
  async init() {
    logger.info('🚀 Agent 初始化开始');
      
    // 初始化 LLM 提供商
    const providerName = this.config.defaultProvider;
    logger.info(`🤖 使用 LLM 提供商：${providerName}`);
      
    const providerConfig = {
      ...this.config.providers[providerName],
      apiKey: process.env[`${providerName.toUpperCase()}_API_KEY`] || this.config.providers[providerName]?.apiKey
    };
    this.provider = createProvider(providerName, providerConfig);
    logger.info(`✅ LLM 提供商初始化完成`);
      
    // 启动 MCP HTTP Server (如果启用)
    if (this.config.mcp?.httpServer?.enabled) {
      logger.info(`🌐 正在启动 MCP HTTP Server...`);
      const { MCPHTTPServer } = await import('./mcp_http_server.js');
      this.mcpHttpServer = new MCPHTTPServer(this.config.mcp.httpServer);
      await this.mcpHttpServer.start();
      logger.info(`✅ MCP HTTP Server 已启动`);
    }
      
    // 加载本地 Skills
    logger.info(`📦 正在加载 Skills...`);
    const skillCount = await this.skillManager.load();
    logger.info(`✅ Skills 加载完成：${skillCount} 个`);
      
    // 设置 system prompt
    if (this.systemPrompt) {
      this.messages.push({ role: 'system', content: this.systemPrompt });
      logger.debug(`📝 System Prompt 已设置`);
    }
      
    logger.info(`✅ Agent 初始化完成`);
    return this;
  }

  // 获取所有可用工具
  async getTools() {
    const skillTools = await this.skillManager.getTools();
    
    // 内置工具 (file, http, mongo)
    const internalTools = builtInTools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema
      }
    }));
    
    return [...internalTools, ...skillTools];
  }

  // 执行工具调用
  async executeTool(name, args, onProgress = null) {
    logger.logCall('executeTool', { name, args });
    
    // 发送工具执行开始日志
    if (onProgress) {
      onProgress({
        type: 'tool_log',
        toolName: name,
        level: 'info',
        message: `开始执行工具: ${name}`,
        timestamp: new Date().toISOString()
      });
    }
    
    try {
      let result;
      
      // 内置工具
      if (name.startsWith('file_')) {
        logger.debug(`📁 调用文件工具：${name}`);
        if (onProgress) {
          onProgress({ type: 'tool_log', toolName: name, level: 'debug', message: `文件工具: ${name}`, timestamp: new Date().toISOString() });
        }
        result = await handleFileTool(name, args);
      } else if (name.startsWith('http_')) {
        logger.debug(`🌐 调用HTTP工具：${name}`);
        if (onProgress) {
          onProgress({ type: 'tool_log', toolName: name, level: 'debug', message: `HTTP工具: ${name}`, timestamp: new Date().toISOString() });
        }
        result = await handleHttpTool(name, args);
      } else if (name.startsWith('mongo_')) {
        logger.debug(`🍃 调用MongoDB工具：${name}`);
        if (onProgress) {
          onProgress({ type: 'tool_log', toolName: name, level: 'debug', message: `MongoDB工具: ${name}`, timestamp: new Date().toISOString() });
        }
        result = await handleMongoTool(name, args);
      } else if (name.startsWith('system_')) {
        logger.debug(`💻 调用系统工具：${name}`);
        if (onProgress) {
          onProgress({ type: 'tool_log', toolName: name, level: 'debug', message: `系统工具: ${name}`, timestamp: new Date().toISOString() });
        }
        result = await handleSystemTool(name, args);
      } else if (name.startsWith('utils_')) {
        logger.debug(`🔧 调用实用工具：${name}`);
        if (onProgress) {
          onProgress({ type: 'tool_log', toolName: name, level: 'debug', message: `实用工具: ${name}`, timestamp: new Date().toISOString() });
        }
        result = await handleUtilsTool(name, args);
      } else if (name.startsWith('skill_')) {
        logger.debug(`🎯 调用 Skill: ${name}`);
        if (onProgress) {
          onProgress({ type: 'tool_log', toolName: name, level: 'debug', message: `Skill: ${name}`, timestamp: new Date().toISOString() });
        }
        result = await this.skillManager.execute(name, args, { agent: this });
      } else {
        throw new Error(`未知工具：${name}`);
      }
      
      // 处理结果格式
      let resultStr;
      if (result?.content?.[0]?.text) {
        resultStr = result.content[0].text;
      } else if (typeof result === 'string') {
        resultStr = result;
      } else if (result?.data) {
        resultStr = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
      } else {
        resultStr = JSON.stringify(result, null, 2);
      }
      
      // 发送工具执行完成日志
      if (onProgress) {
        onProgress({
          type: 'tool_log',
          toolName: name,
          level: 'info',
          message: `工具执行完成: ${name}`,
          resultLength: resultStr.length,
          timestamp: new Date().toISOString()
        });
      }
      
      logger.logReturn('executeTool', { result: resultStr.substring(0, 200) });
      return resultStr;
    } catch (error) {
      // 发送工具执行错误日志
      if (onProgress) {
        onProgress({
          type: 'tool_log',
          toolName: name,
          level: 'error',
          message: `工具执行失败: ${error.message}`,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
      logger.logError('executeTool', error, { name, args });
      throw error;
    }
  }

  // 聊天 (支持工具调用循环) - 非流式
  async chat(userMessage, options = {}) {
    logger.info(`💬 收到消息：${userMessage.substring(0, 100)}...`);
    logger.debug(`📋 完整参数：`, { userMessage, options });
    
    // 重置失败记录（新对话）
    if (this.messages.length === 0 || this.messages[this.messages.length - 1].role !== 'user') {
      this.failedProviders.clear();
    }
      
    this.messages.push({ role: 'user', content: userMessage });
      
    const tools = await this.getTools();
    const maxIterations = options.maxIterations || 1024;
    let iteration = 0;
      
    const onProgress = options.onProgress;
  
    while (iteration++ < maxIterations) {
      logger.debug(`🔄 第 ${iteration} 轮对话`);
        
      // 记录 LLM 调用
      logger.logCall('LLM.chat', { 
        messages: this.messages.map(m => ({ role: m.role, contentLength: m.content?.length || 0 })),
        toolsCount: tools.length,
        options 
      });
      
      // 带故障转移的 LLM 调用
      let response;
      try {
        response = await this.provider.chat(this.messages, {
          ...options,
          tools: tools.length ? tools : undefined
        });
      } catch (error) {
        // 尝试故障转移
        const fallbackResult = await this.handleProviderError(error, options);
        if (fallbackResult.switched) {
          // 重试当前轮次
          iteration--;
          continue;
        }
        throw error;
      }
        
      logger.debug(`✅ LLM 响应完成`);
        
      // 无工具调用，返回结果
      if (!response.toolCalls?.length) {
        logger.info(`✅ 无工具调用，直接返回结果`);
        this.messages.push({ role: 'assistant', content: response.content });
        return response.content;
      }
        
      // 输出中间思考内容
      if (response.content && onProgress) {
        onProgress({ type: 'content', content: response.content });
      }
  
      // 处理工具调用
      logger.info(`🔧 需要执行 ${response.toolCalls.length} 个工具调用`);
      logger.debug(`📋 工具调用详情:`, JSON.stringify(response.toolCalls, null, 2));
        
      this.messages.push({
        role: 'assistant',
        content: response.content || null,
        tool_calls: response.toolCalls
      });
        
      for (const call of response.toolCalls) {
        logger.info(`⚡ 执行工具：${call.function.name}`);
        
        // 记录开始时间
        const startTime = Date.now();
          
        // 发送详细的 tool_call 事件
        if (onProgress) {
          onProgress({ 
            type: 'tool_call', 
            id: call.id,
            name: call.function.name, 
            args: call.function.arguments,
            rawArgs: call.function.arguments,
            startTime: new Date().toISOString()
          });
        }
        try {
          const args = JSON.parse(call.function.arguments || '{}');
          logger.debug(`📋 解析后的参数:`, args);
            
          const result = await this.executeTool(call.function.name, args, onProgress);
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
          
          // 计算执行耗时
          const duration = Date.now() - startTime;
            
          this.messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: resultStr
          });
            
          logger.info(`✅ 工具执行成功`);
          if (onProgress) {
            onProgress({ 
              type: 'tool_result', 
              id: call.id,
              name: call.function.name, 
              success: true, 
              result: resultStr,
              rawResult: resultStr,
              duration,
              endTime: new Date().toISOString()
            });
          }
        } catch (e) {
          const duration = Date.now() - startTime;
          logger.error(`❌ 工具执行失败：${e.message}`);
          this.messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: `错误：${e.message}`
          });
          if (onProgress) {
            onProgress({ 
              type: 'tool_result', 
              id: call.id,
              name: call.function.name, 
              success: false, 
              error: e.message,
              duration,
              endTime: new Date().toISOString()
            });
          }
        }
      }
    }
      
    logger.warn(`⚠️ 达到最大迭代次数`);
    return '达到最大迭代次数';
  }

  // 流式聊天 (支持工具调用 + 流式内容输出)
  async chatStreamWithTools(userMessage, options = {}) {
    logger.info(`🌊 流式聊天：${userMessage.substring(0, 100)}...`);
    
    // 重置失败记录（新对话）
    if (this.messages.length === 0 || this.messages[this.messages.length - 1].role !== 'user') {
      this.failedProviders.clear();
    }
    
    this.messages.push({ role: 'user', content: userMessage });
    
    const tools = await this.getTools();
    const maxIterations = options.maxIterations || 1024;
    let iteration = 0;
    const onProgress = options.onProgress;
    
    while (iteration++ < maxIterations) {
      logger.debug(`🔄 第 ${iteration} 轮流式对话`);
      
      // 流式请求
      let fullContent = '';
      let toolCalls = [];
      let hasToolCalls = false;
      
      try {
        // 使用流式 API
        const body = {
          model: options.model || this.provider.model,
          messages: this.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          ...tools.length && { tools }
        };
        
        const res = await fetch(`${this.provider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.provider.getHeaders(),
          body: JSON.stringify({ ...body, stream: true })
        });
        
        if (!res.ok) {
          throw new Error(`API 错误：${res.status}`);
        }
        
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const chunk = JSON.parse(line.slice(6));
                const delta = chunk.choices?.[0]?.delta;
                
                // 流式内容 - 实时发送
                if (delta?.content) {
                  fullContent += delta.content;
                  if (onProgress) {
                    onProgress({ type: 'text_chunk', content: delta.content });
                  }
                }
                
                // 工具调用（流式）
                if (delta?.tool_calls) {
                  hasToolCalls = true;
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index || 0;
                    if (!toolCalls[idx]) {
                      toolCalls[idx] = { id: tc.id || '', type: 'function', function: { name: '', arguments: '' } };
                    }
                    if (tc.id) toolCalls[idx].id = tc.id;
                    if (tc.function?.name) toolCalls[idx].function.name = tc.function.name;
                    if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                  }
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      } catch (e) {
        // 尝试故障转移
        const fallbackResult = await this.handleProviderError(e, options);
        if (fallbackResult.switched) {
          // 重试当前轮次
          iteration--;
          continue;
        }
        
        logger.warn(`流式请求失败，回退到非流式: ${e.message}`);
        // 回退到非流式
        try {
          const response = await this.provider.chat(this.messages, { ...options, tools: tools.length ? tools : undefined });
          fullContent = response.content || '';
          toolCalls = response.toolCalls || [];
          hasToolCalls = toolCalls.length > 0;
        } catch (fallbackError) {
          // 再次尝试故障转移
          const retryResult = await this.handleProviderError(fallbackError, options);
          if (retryResult.switched) {
            iteration--;
            continue;
          }
          throw fallbackError;
        }
        // 非流式时一次性发送内容
        if (fullContent && onProgress) {
          onProgress({ type: 'text_chunk', content: fullContent });
        }
      } 
      
      // 无工具调用，返回结果
      if (!hasToolCalls || toolCalls.length === 0) {
        logger.info(`✅ 流式完成，无工具调用`);
        this.messages.push({ role: 'assistant', content: fullContent });
        return fullContent;
      }
      
      // 有工具调用
      logger.info(`🔧 需要执行 ${toolCalls.length} 个工具调用`);
      
      this.messages.push({
        role: 'assistant',
        content: fullContent || null,
        tool_calls: toolCalls
      });
      
      for (const call of toolCalls) {
        logger.info(`⚡ 执行工具：${call.function.name}`);
        
        // 记录开始时间
        const startTime = Date.now();
        
        // 发送详细的 tool_call 事件
        if (onProgress) {
          onProgress({ 
            type: 'tool_call', 
            id: call.id,
            name: call.function.name, 
            args: call.function.arguments,
            rawArgs: call.function.arguments,
            startTime: new Date().toISOString()
          });
        }
        
        try {
          const args = JSON.parse(call.function.arguments || '{}');
          const result = await this.executeTool(call.function.name, args, onProgress);
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
          
          // 计算执行耗时
          const duration = Date.now() - startTime;
          
          this.messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: resultStr
          });
          
          logger.info(`✅ 工具执行成功`);
          if (onProgress) {
            onProgress({ 
              type: 'tool_result', 
              id: call.id,
              name: call.function.name, 
              success: true, 
              result: resultStr,
              rawResult: resultStr,
              duration,
              endTime: new Date().toISOString()
            });
          }
        } catch (e) {
          const duration = Date.now() - startTime;
          logger.error(`❌ 工具执行失败：${e.message}`);
          this.messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: `错误：${e.message}`
          });
          if (onProgress) {
            onProgress({ 
              type: 'tool_result', 
              id: call.id,
              name: call.function.name, 
              success: false, 
              error: e.message,
              duration,
              endTime: new Date().toISOString()
            });
          }
        }
      }
    }
    
    return '达到最大迭代次数';
  }

  // 流式聊天 (不支持工具调用)
  async *chatStream(userMessage, options = {}) {
    this.messages.push({ role: 'user', content: userMessage });
    
    let fullContent = '';
    for await (const chunk of this.provider.chatStream(this.messages, options)) {
      if (chunk.type === 'content') {
        fullContent += chunk.content;
        yield chunk.content;
      }
    }
    
    this.messages.push({ role: 'assistant', content: fullContent });
  }

  // 清除对话历史
  clearHistory() {
    this.messages = this.systemPrompt ? [{ role: 'system', content: this.systemPrompt }] : [];
  }

  // 切换 LLM 提供商
  switchProvider(name, overrideConfig = {}) {
    const config = {
      ...this.config.providers[name],
      apiKey: process.env[`${name.toUpperCase()}_API_KEY`] || this.config.providers[name]?.apiKey,
      ...overrideConfig
    };
    this.provider = createProvider(name, config);
    logger.info(`🔄 已切换到提供商: ${name} (模型: ${config.model})`);
  }
  
  // 处理提供商错误，尝试故障转移
  async handleProviderError(error, options = {}) {
    const currentProvider = this.config.defaultProvider;
    logger.warn(`⚠️ 提供商 ${currentProvider} 请求失败: ${error.message}`);
    
    // 标记当前提供商失败
    this.failedProviders.add(currentProvider);
    
    // 查找可用的备用提供商
    const fallbackList = this.fallbackProviders.length > 0 
      ? this.fallbackProviders 
      : Object.keys(this.config.providers).filter(p => p !== currentProvider);
    
    for (const fallbackName of fallbackList) {
      // 跳过已失败的提供商
      if (this.failedProviders.has(fallbackName)) {
        continue;
      }
      
      // 检查是否有 API Key
      const hasApiKey = process.env[`${fallbackName.toUpperCase()}_API_KEY`] || 
                        this.config.providers[fallbackName]?.apiKey;
      if (!hasApiKey) {
        logger.debug(`跳过 ${fallbackName}: 未配置 API Key`);
        continue;
      }
      
      // 尝试切换
      try {
        logger.info(`🔀 尝试故障转移到: ${fallbackName}`);
        this.switchProvider(fallbackName);
        this.config.defaultProvider = fallbackName;
        
        // 通知用户
        if (options.onProgress) {
          options.onProgress({ 
            type: 'provider_switch', 
            from: currentProvider, 
            to: fallbackName,
            reason: error.message
          });
        }
        
        return { switched: true, newProvider: fallbackName };
      } catch (switchError) {
        logger.warn(`切换到 ${fallbackName} 失败: ${switchError.message}`);
        this.failedProviders.add(fallbackName);
      }
    }
    
    // 所有备用提供商都失败
    logger.error(`❌ 所有提供商都不可用`);
    return { switched: false, error: '所有提供商都不可用' };
  }
  
  // 添加备用提供商
  addFallbackProvider(name) {
    if (!this.fallbackProviders.includes(name)) {
      this.fallbackProviders.push(name);
    }
  }
  
  // 设置备用提供商列表
  setFallbackProviders(providers) {
    this.fallbackProviders = providers;
  }

  // 关闭
  async close() {
    if (this.mcpHttpServer) {
      await this.mcpHttpServer.stop();
    }
  }
}

// 便捷创建函数
export async function createAgent(options = {}) {
  const agent = new Agent(options);
  await agent.init();
  return agent;
}

export default Agent;
