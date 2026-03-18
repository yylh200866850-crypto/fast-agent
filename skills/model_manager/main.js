/**
 * 模型管理技能
 * 
 * 支持 LLM 提供商/模型的切换、配置保存、查看等功能
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 获取配置文件路径
 */
function getConfigPath(context) {
  const agent = context?.agent;
  if (agent?.config?._paths?.exeDir) {
    // 优先使用 exe 同级目录的配置
    const externalPath = join(agent.config._paths.exeDir, 'config.json');
    if (existsSync(externalPath)) {
      return externalPath;
    }
  }
  // 回退到内置配置
  return join(__dirname, '../../..', 'config.json');
}

/**
 * 获取环境变量文件路径
 */
function getEnvPath(context) {
  const agent = context?.agent;
  if (agent?.config?._paths?.exeDir) {
    const externalPath = join(agent.config._paths.exeDir, '.env');
    if (existsSync(externalPath)) {
      return externalPath;
    }
  }
  return join(__dirname, '../../..', '.env');
}

/**
 * 列出可用提供商
 */
function listProviders(context) {
  const agent = context?.agent;
  if (!agent?.config?.providers) {
    return { success: false, error: '无法获取提供商列表' };
  }

  const providers = [];
  const currentProvider = agent.config.defaultProvider;

  for (const [name, config] of Object.entries(agent.config.providers)) {
    const hasApiKey = !!process.env[`${name.toUpperCase()}_API_KEY`] || !!config.apiKey;
    providers.push({
      name,
      model: config.model,
      hasApiKey,
      isDefault: name === currentProvider,
      baseUrl: config.baseUrl
    });
  }

  return {
    success: true,
    data: {
      current: currentProvider,
      providers
    },
    summary: generateListSummary(providers, currentProvider)
  };
}

/**
 * 生成列表摘要
 */
function generateListSummary(providers, current) {
  const lines = ['## 📋 可用 LLM 提供商', ''];
  for (const p of providers) {
    const marker = p.isDefault ? '✅ ' : '   ';
    const apiKeyStatus = p.hasApiKey ? '🔑' : '❌无Key';
    lines.push(`${marker}${p.name}: ${p.model} ${apiKeyStatus}`);
  }
  lines.push('');
  lines.push('提示: ✅ = 当前默认, 🔑 = 已配置API Key');
  return lines.join('\n');
}

/**
 * 显示当前配置
 */
function showCurrent(context) {
  const agent = context?.agent;
  if (!agent?.provider) {
    return { success: false, error: '无法获取当前配置' };
  }

  const providerName = agent.config.defaultProvider;
  const providerConfig = agent.config.providers[providerName];

  return {
    success: true,
    data: {
      provider: providerName,
      model: agent.provider.model,
      baseUrl: agent.provider.baseUrl,
      hasApiKey: !!agent.provider.apiKey
    },
    summary: `## 🤖 当前 LLM 配置

- 提供商: ${providerName}
- 模型: ${agent.provider.model}
- API: ${providerConfig.baseUrl}
- API Key: ${agent.provider.apiKey ? '已配置' : '未配置'}`
  };
}

/**
 * 切换提供商/模型
 */
async function switchProvider(params, context) {
  const { provider, model, saveAsDefault } = params;
  const agent = context?.agent;

  if (!agent) {
    return { success: false, error: '无法访问 Agent' };
  }

  if (!provider) {
    return { success: false, error: '请指定提供商名称' };
  }

  // 检查提供商是否存在
  if (!agent.config.providers[provider]) {
    const available = Object.keys(agent.config.providers).join(', ');
    return { 
      success: false, 
      error: `未知的提供商: ${provider}。可用提供商: ${available}` 
    };
  }

  try {
    // 切换提供商
    const overrideConfig = model ? { model } : {};
    agent.switchProvider(provider, overrideConfig);

    // 更新配置对象
    agent.config.defaultProvider = provider;
    if (model) {
      agent.config.providers[provider].model = model;
    }

    const result = {
      success: true,
      data: {
        provider,
        model: agent.provider.model,
        saved: false
      },
      summary: `✅ 已切换到 ${provider} (${agent.provider.model})`
    };

    // 如果需要保存为默认
    if (saveAsDefault) {
      const saveResult = saveConfig(context);
      result.data.saved = saveResult.success;
      if (saveResult.success) {
        result.summary += '\n📝 已保存为默认配置';
      } else {
        result.summary += `\n⚠️ 保存失败: ${saveResult.error}`;
      }
    }

    return result;
  } catch (e) {
    return { success: false, error: `切换失败: ${e.message}` };
  }
}

/**
 * 保存配置到文件
 */
function saveConfig(context) {
  const agent = context?.agent;
  if (!agent?.config) {
    return { success: false, error: '无法访问配置' };
  }

  try {
    const configPath = getConfigPath(context);
    
    // 读取现有配置
    let existingConfig = {};
    if (existsSync(configPath)) {
      existingConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    }

    // 更新默认提供商
    existingConfig.defaultProvider = agent.config.defaultProvider;

    // 更新各提供商的模型配置
    for (const [name, config] of Object.entries(agent.config.providers)) {
      if (!existingConfig.providers) {
        existingConfig.providers = {};
      }
      if (!existingConfig.providers[name]) {
        existingConfig.providers[name] = {};
      }
      existingConfig.providers[name].model = config.model;
      // 保留其他配置如 baseUrl
      if (config.baseUrl && !existingConfig.providers[name].baseUrl) {
        existingConfig.providers[name].baseUrl = config.baseUrl;
      }
    }

    // 写入文件
    writeFileSync(configPath, JSON.stringify(existingConfig, null, 2), 'utf-8');

    return { 
      success: true, 
      data: { path: configPath },
      summary: `✅ 配置已保存到 ${configPath}`
    };
  } catch (e) {
    return { success: false, error: `保存失败: ${e.message}` };
  }
}

/**
 * 测试当前模型连接
 */
async function testConnection(context) {
  const agent = context?.agent;
  if (!agent?.provider) {
    return { success: false, error: '无法访问 Provider' };
  }

  try {
    // 发送一个简单的测试请求
    const response = await agent.provider.chat([
      { role: 'user', content: 'Hi' }
    ], { maxTokens: 10 });

    return {
      success: true,
      data: {
        provider: agent.config.defaultProvider,
        model: agent.provider.model,
        responsePreview: response.content?.substring(0, 100)
      },
      summary: `✅ 连接正常: ${agent.config.defaultProvider} (${agent.provider.model})`
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
      summary: `❌ 连接失败: ${e.message}`
    };
  }
}

/**
 * 主执行函数
 */
export default {
  name: 'model_manager',

  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['switch', 'save', 'list', 'current', 'test'],
        description: '操作类型'
      },
      provider: {
        type: 'string',
        description: '提供商名称'
      },
      model: {
        type: 'string',
        description: '模型名称'
      },
      saveAsDefault: {
        type: 'boolean',
        description: '是否保存为默认配置'
      }
    },
    required: ['action']
  },

  async execute(params, context) {
    const { action } = params;

    switch (action) {
      case 'list':
        return listProviders(context);
      
      case 'current':
        return showCurrent(context);
      
      case 'switch':
        return await switchProvider(params, context);
      
      case 'save':
        return saveConfig(context);
      
      case 'test':
        return await testConnection(context);
      
      default:
        return { 
          success: false, 
          error: `未知操作: ${action}。支持的操作: list, current, switch, save, test` 
        };
    }
  }
};
