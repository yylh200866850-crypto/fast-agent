// Google Gemini API 适配器
import { BaseProvider } from './base.js';
import { createLogger } from '../logger.js';

const logger = createLogger('Gemini');

export class GeminiProvider extends BaseProvider {
  constructor(config) {
    super(config);
    logger.info(`🔧 Gemini Provider 初始化`);
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    logger.debug(`📝 请求头：`, { 'Content-Type': 'application/json' });
    return headers;
  }

  async chat(messages, options = {}) {
    logger.info(`💬 Gemini Chat 请求`);
    
    const model = options.model || this.model;
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
    logger.debug(`🌐 请求 URL: ${url}`);
    
    const contents = this.convertMessages(messages);
    const body = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens
      },
      ...options.tools && { tools: [{ functionDeclarations: this.convertTools(options.tools) }] }
    };

    logger.debug(`📋 请求体:`, JSON.stringify({
      contents_count: body.contents.length,
      temperature: body.generationConfig.temperature,
      maxOutputTokens: body.generationConfig.maxOutputTokens,
      tools_count: body.tools?.[0]?.functionDeclarations?.length || 0
    }, null, 2));

    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      logger.error(`❌ Gemini API 错误：${res.status}`);
      throw new Error(`Gemini API 错误：${res.status}`);
    }
    
    const result = await res.json();
    logger.debug(`✅ Gemini API 响应状态码：${res.status}`);
    return this.normalizeResponse(result);
  }

  async *chatStream(messages, options = {}) {
    logger.info(`🌊 Gemini Stream 请求`);
    
    const model = options.model || this.model;
    const url = `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.apiKey}&alt=sse`;
    logger.debug(`🌐 流式请求 URL: ${url}`);
    
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ contents: this.convertMessages(messages) })
    });
    
    if (!res.ok) {
      logger.error(`❌ Gemini API 错误：${res.status}`);
      throw new Error(`Gemini API 错误：${res.status}`);
    }
    
    logger.info(`🌊 Gemini 流式请求已建立`);
    
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
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              chunkCount++;
              yield { type: 'content', content: text };
            }
          } catch {}
        }
      }
    }
    
    logger.info(`✅ Gemini 流式处理完成，接收 ${chunkCount} 个数据块`);
  }

  convertMessages(messages) {
    logger.debug(`🔄 转换消息格式：${messages.length} 条消息`);
    const converted = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    logger.debug(`📋 转换后的消息:`, JSON.stringify(converted.map(m => ({
      role: m.role,
      parts_length: m.parts[0]?.text?.length || 0
    })), null, 2));
    return converted;
  }

  convertTools(tools) {
    logger.debug(`🔧 转换工具格式：${tools.length} 个工具`);
    const converted = tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters
    }));
    logger.debug(`📋 转换后的工具:`, JSON.stringify(converted, null, 2));
    return converted;
  }

  normalizeResponse(result) {
    const candidate = result.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const textPart = parts.find(p => p.text);
    const funcParts = parts.filter(p => p.functionCall);

    logger.debug(`✅ 解析响应：`, JSON.stringify({
      content_length: textPart?.text?.length || 0,
      tool_calls_count: funcParts.length,
      finishReason: candidate?.finishReason,
      usage: result.usageMetadata
    }, null, 2));

    return {
      content: textPart?.text || '',
      toolCalls: funcParts.map((p, i) => ({
        id: `call_${i}`,
        type: 'function',
        function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args) }
      })),
      finishReason: candidate?.finishReason,
      usage: result.usageMetadata
    };
  }
}

export default GeminiProvider;
