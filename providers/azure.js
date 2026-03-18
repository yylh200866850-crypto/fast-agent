// Azure OpenAI API 适配器
import { OpenAIProvider } from './openai.js';
import { createLogger } from '../logger.js';

const logger = createLogger('Azure');

export class AzureProvider extends OpenAIProvider {
  constructor(config) {
    super(config);
    this.apiVersion = config.apiVersion || '2024-02-15-preview';
    this.deployment = config.deployment || config.model;
    logger.info(`🔧 Azure Provider 初始化`);
    logger.debug(`📋 配置：apiVersion=${this.apiVersion}, deployment=${this.deployment}`);
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json', 'api-key': this.apiKey };
    logger.debug(`📝 请求头：`, { 'Content-Type': 'application/json', 'api-key': '***' });
    return headers;
  }

  async request(endpoint, body) {
    const url = `${this.baseUrl}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;
    logger.debug(`🌐 请求 URL: ${url}`);
    
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      logger.error(`❌ Azure API 错误：${res.status}`, errorText);
      throw new Error(`Azure API 错误：${res.status} ${errorText}`);
    }
    
    const result = await res.json();
    logger.debug(`✅ Azure API 响应状态码：${res.status}`);
    return result;
  }

  async *stream(endpoint, body) {
    const url = `${this.baseUrl}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;
    logger.debug(`🌐 流式请求 URL: ${url}`);
    
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ...body, stream: true })
    });
    
    if (!res.ok) {
      logger.error(`❌ Azure API 错误：${res.status}`);
      throw new Error(`Azure API 错误：${res.status}`);
    }
    
    logger.info(`🌊 Azure 流式请求已建立`);
    
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
            yield JSON.parse(line.slice(6));
            chunkCount++;
          } catch {}
        }
      }
    }
    
    logger.info(`✅ Azure 流式处理完成，接收 ${chunkCount} 个数据块`);
  }
}

export default AzureProvider;
