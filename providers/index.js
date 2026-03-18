// 提供商注册表
import { OpenAIProvider } from './openai.js';
import { ClaudeProvider } from './claude.js';
import { GeminiProvider } from './gemini.js';
import { AzureProvider } from './azure.js';

// 提供商映射 (OpenAI 兼容的用 OpenAIProvider)
const providerMap = {
  openai: OpenAIProvider,
  claude: ClaudeProvider,
  gemini: GeminiProvider,
  azure: AzureProvider,
  deepseek: OpenAIProvider,
  qwen: OpenAIProvider,
  bailian: OpenAIProvider,
  ollama: OpenAIProvider
};

// 创建提供商实例
export function createProvider(name, config) {
  const Provider = providerMap[name];
  if (!Provider) throw new Error(`未知提供商: ${name}`);
  return new Provider(config);
}

export { OpenAIProvider, ClaudeProvider, GeminiProvider, AzureProvider };
