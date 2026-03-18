// Claude API 适配器
import { BaseProvider } from './base.js';
import { createLogger } from '../logger.js';

const logger = createLogger('Claude');

export class ClaudeProvider extends BaseProvider {
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01'
    };
    logger.debug(`📝 请求头：`, { 'Content-Type': 'application/json', 'x-api-key': '***', 'anthropic-version': '2023-06-01' });
    return headers;
  }

  async chat(messages, options = {}) {
    logger.info(`💬 Claude Chat 请求`);
    
    // 提取 system 消息
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

    const body = {
      model: options.model || this.model,
      max_tokens: options.maxTokens || 4096,
      messages: chatMessages,
      ...systemMsg && { system: systemMsg.content },
      ...options.tools && { tools: this.convertTools(options.tools) }
    };

    logger.debug(`📋 请求体:`, JSON.stringify({
      model: body.model,
      max_tokens: body.max_tokens,
      messages_count: body.messages.length,
      has_system: !!body.system,
      tools_count: body.tools?.length || 0
    }, null, 2));
    
    logger.debug(`📝 Messages:`, JSON.stringify(body.messages.map(m => ({
      role: m.role,
      content_length: typeof m.content === 'string' ? m.content.length : 'complex'
    })), null, 2));

    const result = await this.request('/messages', body);
    
    logger.debug(`✅ 响应:`, JSON.stringify({
      content_length: result.content?.[0]?.text?.length || 0,
      tool_use_count: result.content?.filter(c => c.type === 'tool_use')?.length || 0,
      stop_reason: result.stop_reason,
      usage: result.usage
    }, null, 2));
    
    return this.normalizeResponse(result);
  }

  async *chatStream(messages, options = {}) {
    logger.info(`🌊 Claude Stream 请求`);
    
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

    const body = {
      model: options.model || this.model,
      max_tokens: options.maxTokens || 4096,
      messages: chatMessages,
      ...systemMsg && { system: systemMsg.content }
    };

    logger.debug(`📋 流式请求参数:`, JSON.stringify({
      model: body.model,
      max_tokens: body.max_tokens,
      messages_count: body.messages.length,
      has_system: !!body.system
    }, null, 2));

    for await (const chunk of this.stream('/messages', body)) {
      if (chunk.type === 'content_block_delta') {
        yield { type: 'content', content: chunk.delta?.text || '' };
      }
    }
  }

  // 转换 OpenAI 工具格式到 Claude 格式
  convertTools(tools) {
    logger.debug(`🔧 转换工具格式：${tools.length} 个工具`);
    const converted = tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters
    }));
    logger.debug(`📋 转换后的工具:`, JSON.stringify(converted, null, 2));
    return converted;
  }

  normalizeResponse(result) {
    const textContent = result.content?.find(c => c.type === 'text');
    const toolUse = result.content?.filter(c => c.type === 'tool_use') || [];
    
    return {
      content: textContent?.text || '',
      toolCalls: toolUse.map(t => ({
        id: t.id,
        type: 'function',
        function: { name: t.name, arguments: JSON.stringify(t.input) }
      })),
      finishReason: result.stop_reason,
      usage: { prompt_tokens: result.usage?.input_tokens, completion_tokens: result.usage?.output_tokens }
    };
  }
}

export default ClaudeProvider;
