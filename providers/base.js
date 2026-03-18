// LLM 提供商基类
import { createLogger } from '../logger.js';

const logger = createLogger('LLM');

export class BaseProvider {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.model = config.model;
    logger.info(`🤖 LLM 提供商初始化：${this.constructor.name}`);
    logger.debug(`📋 配置：baseUrl=${this.baseUrl}, model=${this.model}`);
  }

  // 构建请求头
  getHeaders() {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` };
    logger.debug(`📝 请求头：`, { 'Content-Type': 'application/json', Authorization: 'Bearer ***' });
    return headers;
  }

  // 统一请求方法
  async request(endpoint, body) {
    logger.logCall('request', { endpoint, body: this.sanitizeBody(body) });
    const startTime = Date.now();
    
    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });
      
      const duration = Date.now() - startTime;
      logger.info(`⏱️ API 请求耗时：${duration}ms`);
      
      if (!res.ok) {
        const errorText = await res.text();
        logger.error(`❌ API 错误：${res.status}`, errorText);
        throw new Error(`API 错误：${res.status} ${errorText}`);
      }
      
      const result = await res.json();
      logger.debug(`✅ API 响应状态码：${res.status}`);
      return result;
    } catch (error) {
      logger.logError('request', error, { endpoint, body: this.sanitizeBody(body) });
      throw error;
    }
  }

  // 流式请求
  async *stream(endpoint, body) {
    logger.logCall('stream', { endpoint, body: this.sanitizeBody(body) });
    const startTime = Date.now();
    
    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ ...body, stream: true })
      });
      
      if (!res.ok) {
        logger.error(`❌ API 错误：${res.status}`);
        throw new Error(`API 错误：${res.status}`);
      }
      
      logger.info(`🌊 流式请求已建立`);
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const chunk = JSON.parse(line.slice(6));
              chunkCount++;
              yield chunk;
            } catch {}
          }
        }
      }
      
      const duration = Date.now() - startTime;
      logger.info(`✅ 流式处理完成，接收 ${chunkCount} 个数据块，耗时 ${duration}ms`);
    } catch (error) {
      logger.logError('stream', error, { endpoint, body: this.sanitizeBody(body) });
      throw error;
    }
  }

  // 清理敏感信息（用于日志）
  sanitizeBody(body) {
    const sanitized = { ...body };
    // 可以添加更多敏感字段过滤逻辑
    return sanitized;
  }

  // 子类需实现：聊天完成
  async chat(messages, options = {}) { throw new Error('需实现 chat 方法'); }
  
  // 子类需实现：流式聊天
  async *chatStream(messages, options = {}) { throw new Error('需实现 chatStream 方法'); }
}

export default BaseProvider;
