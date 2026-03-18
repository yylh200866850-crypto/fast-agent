/**
 * 系统上下文技能
 * 
 * 提供 Fast-Agent 系统的完整上下文信息，让 LLM 了解当前系统能力
 */

import os from 'os';
import { homedir, platform, arch, type, release, hostname, userInfo, cpus, totalmem, freemem, uptime } from 'os';
import { cwd } from 'process';
import { join } from 'path';

/**
 * 获取系统环境信息
 */
function getSystemEnv() {
  const home = homedir();
  return {
    platform: platform(),
    osType: type(),
    osRelease: release(),
    arch: arch(),
    hostname: hostname(),
    nodeVersion: process.version,
    cwd: cwd(),
    user: {
      username: userInfo().username,
      home: home,
      shell: userInfo().shell || 'N/A'
    },
    paths: {
      home,
      desktop: join(home, 'Desktop'),
      documents: join(home, 'Documents'),
      downloads: join(home, 'Downloads'),
      temp: os.tmpdir()
    }
  };
}

/**
 * 获取硬件信息（仅完整模式）
 */
function getHardwareInfo() {
  const cpuList = cpus();
  return {
    cpu: {
      model: cpuList[0]?.model || 'Unknown',
      cores: cpuList.length,
      speed: cpuList[0]?.speed ? `${cpuList[0].speed} MHz` : 'Unknown'
    },
    memory: {
      total: formatBytes(totalmem()),
      free: formatBytes(freemem()),
      used: formatBytes(totalmem() - freemem()),
      usagePercent: ((1 - freemem() / totalmem()) * 100).toFixed(1) + '%'
    },
    systemUptime: `${Math.floor(uptime() / 3600)} 小时`
  };
}

/**
 * 格式化字节
 */
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(2)} ${units[i]}`;
}

/**
 * 获取工具分类
 */
function getToolCategories(context) {
  // 从 agent 获取工具列表
  const agent = context?.agent;
  if (!agent) {
    return { note: '无法获取工具列表（Agent 未传入）' };
  }

  // 返回简要的工具分类信息
  return {
    file: '文件操作（读写、目录管理等）',
    http: 'HTTP 请求（GET、POST 等）',
    mongo: 'MongoDB 数据库操作（CRUD、聚合等）',
    system: '系统工具（命令执行、进程管理等）',
    utils: '实用工具（哈希、UUID、编码等）',
    skills: '技能调用（各种扩展能力）'
  };
}

/**
 * 获取已加载技能列表
 */
function getLoadedSkills(context) {
  const agent = context?.agent;
  if (!agent?.skillManager) {
    return { note: '无法获取技能列表' };
  }

  const skills = [];
  for (const [name, info] of agent.skillManager.cache.entries()) {
    skills.push({
      name,
      description: info.metadata?.description || '无描述',
      type: info.type
    });
  }
  return skills;
}

/**
 * 获取配置信息
 */
function getConfigInfo(context) {
  const agent = context?.agent;
  if (!agent?.config) {
    return {
      note: '无法获取配置信息',
      defaultProvider: 'Unknown',
      currentModel: 'Unknown',
      providers: []
    };
  }

  const config = agent.config;
  return {
    defaultProvider: config.defaultProvider || 'Unknown',
    currentModel: config.providers?.[config.defaultProvider]?.model || 'Unknown',
    providers: Object.keys(config.providers || {}),
    mongod: {
      enabled: config.mongod?.enabled !== false,
      port: config.mongod?.port || 27017,
      dbName: config.mongod?.dbName || 'fast_agent',
      cloudEnabled: config.mongod?.cloud?.enabled || false
    }
  };
}

/**
 * 获取数据库状态
 */
async function getDatabaseStatus(context) {
  // 尝试获取 mongod 服务状态
  try {
    // 动态导入避免循环依赖
    const { getMongodService } = await import('../../tools/mongod_service.js');
    const mongodService = getMongodService();
    const info = mongodService.getInfo();
    
    return {
      status: mongodService.isRunning ? 'running' : 'stopped',
      uri: mongodService.isRunning ? mongodService.getUri().replace(/:[^:@]+@/, ':****@') : null,
      useExternalService: info.useExternalService || false,
      needsAuth: info.needsAuth || false,
      portConflict: info.portConflict || false
    };
  } catch (e) {
    return {
      status: 'unknown',
      error: e.message
    };
  }
}

/**
 * 主执行函数
 */
export default {
  name: 'system_context',
  
  // 参数定义（供 SkillManager 使用）
  parameters: {
    type: 'object',
    properties: {
      detail: {
        type: 'string',
        enum: ['brief', 'full'],
        description: '信息详细程度：brief=简要信息，full=完整信息'
      }
    }
  },

  async execute(params, context) {
    const detail = params.detail || 'brief';
    const isFull = detail === 'full';

    // 构建上下文信息
    const result = {
      timestamp: new Date().toISOString(),
      system: getSystemEnv(),
      tools: getToolCategories(context),
      skills: getLoadedSkills(context),
      config: getConfigInfo(context),
      database: await getDatabaseStatus(context)
    };

    // 完整模式添加更多信息
    if (isFull) {
      result.hardware = getHardwareInfo();
      result.network = {
        interfaces: Object.entries(os.networkInterfaces()).map(([name, nets]) => ({
          name,
          addresses: nets.map(n => ({
            family: n.family,
            address: n.address,
            internal: n.internal
          }))
        }))
      };
    }

    // 生成人类可读的摘要
    const summary = generateSummary(result, isFull);

    return {
      success: true,
      data: result,
      summary
    };
  }
};

/**
 * 生成人类可读的摘要
 */
function generateSummary(info, isFull) {
  const lines = [];
  
  lines.push('## 🖥️ 系统环境');
  lines.push(`- 操作系统: ${info.system.platform} (${info.system.osType} ${info.system.osRelease})`);
  lines.push(`- 架构: ${info.system.arch}`);
  lines.push(`- Node.js: ${info.system.nodeVersion}`);
  lines.push(`- 工作目录: ${info.system.cwd}`);
  lines.push(`- 用户: ${info.system.user.username}`);
  
  if (isFull && info.hardware) {
    lines.push('');
    lines.push('## 💾 硬件信息');
    lines.push(`- CPU: ${info.hardware.cpu.model} (${info.hardware.cpu.cores} 核)`);
    lines.push(`- 内存: ${info.hardware.memory.used} / ${info.hardware.memory.total} (${info.hardware.memory.usagePercent})`);
  }

  lines.push('');
  lines.push('## 🛠️ 可用工具');
  for (const [cat, desc] of Object.entries(info.tools)) {
    lines.push(`- ${cat}: ${desc}`);
  }

  lines.push('');
  lines.push('## 🎯 已加载技能');
  if (Array.isArray(info.skills)) {
    for (const skill of info.skills) {
      lines.push(`- ${skill.name}: ${skill.description}`);
    }
  } else {
    lines.push('- 无法获取技能列表');
  }

  lines.push('');
  lines.push('## ⚙️ 配置状态');
  lines.push(`- LLM 提供商: ${info.config.defaultProvider}`);
  lines.push(`- 当前模型: ${info.config.currentModel}`);
  lines.push(`- 可用提供商: ${info.config.providers.join(', ')}`);

  lines.push('');
  lines.push('## 🍃 数据库状态');
  if (info.database.status === 'running') {
    lines.push(`- 状态: ✅ 运行中`);
    lines.push(`- 连接: ${info.database.uri}`);
    if (info.database.useExternalService) {
      lines.push(`- 类型: 外部服务`);
    }
  } else {
    lines.push(`- 状态: ❌ 未运行`);
  }

  return lines.join('\n');
}
