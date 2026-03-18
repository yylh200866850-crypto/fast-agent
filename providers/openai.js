// OpenAI 兼容 API (OpenAI, DeepSeek, Qwen, Ollama 等)
import { BaseProvider } from './base.js';
import { createLogger } from '../logger.js';

const logger = createLogger('OpenAI');

export class OpenAIProvider extends BaseProvider {
  async chat(messages, options = {}) {
    logger.info(`💬 OpenAI Chat 请求`);
    
    const body = {
      model: options.model || this.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      ...options.tools && { tools: options.tools },
      ...options.toolChoice && { tool_choice: options.toolChoice }
    };
    
    logger.debug(`📋 请求体:`, JSON.stringify({
      model: body.model,
      messages_count: body.messages.length,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      tools_count: body.tools?.length || 0,
      tool_choice: body.tool_choice
    }, null, 2));
    
    logger.debug(`📝 Messages:`, JSON.stringify(body.messages.map(m => ({
      role: m.role,
      content_length: m.content?.length || 0,
      has_tool_calls: !!m.tool_calls
    })), null, 2));
    
    const result = await this.request('/chat/completions', body);
    
    logger.debug(`✅ 响应:`, JSON.stringify({
      content_length: result.choices?.[0]?.message?.content?.length || 0,
      tool_calls_count: result.choices?.[0]?.message?.tool_calls?.length || 0,
      finish_reason: result.choices?.[0]?.finish_reason,
      usage: result.usage
    }, null, 2));
    
    return this.normalizeResponse(result);
  }

  async *chatStream(messages, options = {}) {
    logger.info(`🌊 OpenAI Stream 请求`);
    
    const body = {
      model: options.model || this.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens
    };
    
    logger.debug(`📋 流式请求参数:`, JSON.stringify({
      model: body.model,
      messages_count: body.messages.length,
      temperature: body.temperature,
      max_tokens: body.max_tokens
    }, null, 2));
    
    for await (const chunk of this.stream('/chat/completions', body)) {
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) yield { type: 'content', content: delta.content };
      if (delta?.tool_calls) yield { type: 'tool_call', toolCalls: delta.tool_calls };
    }
  }

  normalizeResponse(result) {
    const choice = result.choices?.[0];
    return {
      content: choice?.message?.content || '',
      toolCalls: choice?.message?.tool_calls || [],
      finishReason: choice?.finish_reason,
      usage: result.usage
    };
  }
}

export default OpenAIProvider;
