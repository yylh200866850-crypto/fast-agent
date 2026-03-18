// 配置管理模块
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// 加载 .env 文件 (支持多个位置)
// 优先级: exe 同级目录 > 内置目录
function loadEnvFile() {
  const envPaths = [];
  
  // pkg 打包检测
  const isPkg = typeof process.pkg !== 'undefined';
  const exeDir = isPkg ? dirname(process.execPath) : null;
  
  // 1. exe 同级目录的 .env (最高优先级，用户可自定义)
  if (exeDir) {
    envPaths.push(join(exeDir, '.env'));
  }
  
  // 2. 内置的 .env 文件
  try {
    const builtInDir = dirname(fileURLToPath(import.meta.url));
    envPaths.push(join(builtInDir, '.env'));
  } catch {}
  
  // 尝试加载第一个存在的 .env 文件
  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, 'utf-8');
        parseEnvContent(content);
        console.log(`✓ 已加载环境配置：${envPath}`);
        return;
      } catch (e) {
        console.warn(`环境配置加载失败：${envPath} - ${e.message}`);
      }
    }
  }
}

// 解析 .env 文件内容
function parseEnvContent(content) {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();
      
      // 移除引号
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // 只设置未定义的环境变量（系统环境变量优先）
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

// 启动时加载 .env
loadEnvFile();

// 兼容 ES Module 和 CommonJS 环境
const getDirname = () => {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  }
};
const __dirname = getDirname();

// pkg 打包检测
const isPkg = typeof process.pkg !== 'undefined';
const exeDir = isPkg ? dirname(process.execPath) : __dirname;

// 内置 skills 目录
const builtInSkillsDir = join(__dirname, 'skills');

// 默认配置
const defaults = {
  defaultProvider: 'deepseek',
  fallbackProviders: ['qwen', 'deepseek'],
  providers: {
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
    claude: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022' },
    azure: { baseUrl: '', model: 'gpt-4o', apiVersion: '2024-02-15-preview' },
    gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-pro' },
    deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-max' },
    bailian: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'glm-5' },
    ollama: { baseUrl: 'http://localhost:11434/v1', model: 'llama3' }
  },
  mcp: {
    // MCP HTTP Server 配置（对外提供 MCP 服务）
    httpServer: {
      enabled: false,
      host: '127.0.0.1',
      port: 8080,
      // 访问控制: 'all' | 'whitelist' | 'blacklist'
      accessControl: 'whitelist',
      whitelist: ['127.0.0.1', '::1'],
      blacklist: []
    }
  },
  // 数据库配置
  database: {
    type: 'local',           // 'local' | 'cloud'
    local: {
      enabled: true,         // 是否启用本地 MongoDB
      autoStart: true,       // 是否自动启动
      port: 27017,           // MongoDB 端口
      host: '127.0.0.1',     // 绑定地址
      dbName: 'fast_agent'   // 默认数据库名
    },
    cloud: {
      enabled: false,        // 是否启用云端数据库
      uri: '',               // 云端数据库连接字符串
      dbName: 'fast_agent'   // 数据库名
    }
  },
  // MongoDB 内置服务配置 (兼容旧配置)
  mongod: {
    enabled: true,           // 是否启用内置 MongoDB 服务
    autoStart: true,         // 是否自动启动
    port: 27017,             // MongoDB 端口
    host: '127.0.0.1',       // 绑定地址
    dbName: 'fast_agent',    // 默认数据库名
    dataDir: 'mongod/data',  // 数据目录 (相对于 exe 目录)
    logDir: 'mongod/log',    // 日志目录
    // 认证配置（可选，用于连接需要认证的 MongoDB）
    username: '',            // 用户名
    password: '',            // 密码
    authSource: 'admin',     // 认证数据库
    // 云数据库配置（可选，用于连接 MongoDB Atlas 等云服务）
    cloud: {
      enabled: false,        // 是否使用云数据库
      uri: '',               // 云数据库连接字符串（如 mongodb+srv://user:pass@cluster.mongodb.net/db）
      dbName: 'fast_agent'   // 数据库名
    },
    // 端口冲突处理策略: 'auto' | 'always_start' | 'use_existing'
    // auto: 检测到已有MongoDB服务则使用，否则启动新的
    // always_start: 总是尝试启动新服务（端口冲突时报错）
    // use_existing: 优先使用已有服务，没有才启动
    portConflictStrategy: 'auto',
    // 是否允许无数据库运行（强烈不建议）
    allowNoDatabase: false
  },
  // 外部扩展 skills 目录（exe 同级目录）
  externalSkillsDir: join(exeDir, 'skills')
};

// 加载配置文件
export function loadConfig(configPath = 'config.json') {
  let config = { ...defaults };
  
  // 1. 加载内置配置
  const builtInConfigPath = join(__dirname, configPath);
  let loadedConfigPath = null;
  if (existsSync(builtInConfigPath)) {
    try {
      const fileConfig = JSON.parse(readFileSync(builtInConfigPath, 'utf-8'));
      config = mergeConfig(defaults, fileConfig);
      loadedConfigPath = builtInConfigPath;
    } catch (e) {
      console.warn(`内置配置加载失败：${e.message}`);
    }
  }
  
  // 2. 加载外部配置（exe 同级目录，优先级更高）
  const externalConfigPath = join(exeDir, 'config.json');
  if (existsSync(externalConfigPath) && externalConfigPath !== builtInConfigPath) {
    try {
      const externalConfig = JSON.parse(readFileSync(externalConfigPath, 'utf-8'));
      config = mergeConfig(config, externalConfig);
      console.log(`✓ 已加载外部配置：${externalConfigPath}`);
    } catch (e) {
      console.warn(`外部配置加载失败：${e.message}`);
    }
  }
  
  // 3. 环境变量覆盖
  if (process.env.DEFAULT_PROVIDER) {
    config.defaultProvider = process.env.DEFAULT_PROVIDER;
  }
  
  // 4. 构建完整的 skills 目录列表
  config.allSkillsDirs = [builtInSkillsDir];
  
  // 添加外部 skills 目录（如果存在且不同于内置目录）
  if (config.externalSkillsDir && existsSync(config.externalSkillsDir)) {
    // 解析为绝对路径比较
    const externalPath = config.externalSkillsDir;
    if (externalPath !== builtInSkillsDir) {
      config.allSkillsDirs.push(config.externalSkillsDir);
      console.log(`✓ 检测到外部 skills 目录：${config.externalSkillsDir}`);
    }
  }
  
  // 5. 导出路径信息
  config._paths = {
    isPkg,
    exeDir,
    builtInSkillsDir,
    externalSkillsDir: config.externalSkillsDir,
    loadedConfigPath
  };
  
  return config;
}

// 深度合并配置
function mergeConfig(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = mergeConfig(target[key] || {}, source[key]);
    } else if (Array.isArray(source[key])) {
      const targetArray = Array.isArray(target[key]) ? target[key] : [];
      result[key] = [...targetArray, ...source[key]];
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export default loadConfig;
