/**
 * 统一日志工具
 * 
 * 功能：
 * - 统一的日志格式
 * - 支持不同级别（info, warn, error）
 * - 自动格式化复杂对象
 * - 时间戳和模块标识
 * - 支持文件输出
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// 日志级别
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// 当前日志级别（可通过环境变量配置）
const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.INFO;

// 文件日志配置（默认启用）
const LOG_TO_FILE = process.env.LOG_TO_FILE !== 'false' && process.env.LOG_TO_FILE !== '0';
const LOG_DIR = process.env.LOG_DIR || join(process.cwd(), 'logs');

// 控制台静默模式（只输出 ERROR 级别到控制台，详细日志只写文件）
const CONSOLE_QUIET = process.env.CONSOLE_QUIET !== 'false' && process.env.LOG_TO_FILE !== '0';

/**
 * 生成日志文件名（同一天使用同一个文件）
 * 格式：agent-YYYY-MM-DD.log
 */
function generateLogFileName() {
  const datePrefix = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `agent-${datePrefix}.log`;
}

// 日志文件路径（延迟初始化，确保整个进程只有一个日志文件）
let LOG_FILE_PATH = null;
let LOG_FILE_NAME = null;

/**
 * 获取日志文件路径（延迟初始化）
 * 确保整个进程生命周期内只创建一个日志文件
 */
function getLogFilePath() {
  if (LOG_FILE_PATH) {
    return LOG_FILE_PATH;
  }
  
  // 如果环境变量指定了文件名，直接使用
  if (process.env.LOG_FILE_NAME) {
    LOG_FILE_NAME = process.env.LOG_FILE_NAME;
  } else {
    // 否则生成新的带索引的文件名
    LOG_FILE_NAME = generateLogFileName();
  }
  
  LOG_FILE_PATH = join(LOG_DIR, LOG_FILE_NAME);
  
  // 确保日志目录存在
  if (!existsSync(LOG_DIR)) {
    try {
      mkdirSync(LOG_DIR, { recursive: true });
      console.log(`[Logger] 创建日志目录：${LOG_DIR}`);
    } catch (e) {
      console.error('[Logger] 创建日志目录失败:', e.message);
    }
  }
  
  return LOG_FILE_PATH;
}

/**
 * 格式化日志参数
 * @param {any} params - 要格式化的参数
 * @returns {string} - 格式化后的字符串
 */
function formatParams(params) {
  if (!params) return '';
  
  try {
    // 如果是对象或数组，格式化 JSON
    if (typeof params === 'object') {
      return JSON.stringify(params, null, 2);
    }
    // 如果是字符串，尝试解析 JSON
    if (typeof params === 'string') {
      try {
        const parsed = JSON.parse(params);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return params;
      }
    }
    // 其他类型直接返回
    return String(params);
  } catch (e) {
    return `[无法格式化]: ${params}`;
  }
}

/**
 * 生成带时间戳的日志前缀（使用本地时间）
 * @param {string} module - 模块名称
 * @param {string} level - 日志级别
 * @returns {string} - 格式化的前缀
 */
function formatPrefix(module, level) {
  const now = new Date();
  // 格式化为本地时间：YYYY-MM-DD HH:mm:ss.SSS
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  
  const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  return `[${timestamp}] [${level}] [${module}]`;
}

/**
 * 写日志到文件
 * @param {string} message - 日志消息
 */
function writeToFile(message) {
  if (!LOG_TO_FILE) return;
  
  try {
    const logPath = getLogFilePath();
    appendFileSync(logPath, message + '\n');
  } catch (e) {
    // 文件写入失败不影响控制台输出
    console.error('[Logger] 写入文件失败:', e.message);
  }
}

/**
 * 日志类
 */
export class Logger {
  constructor(module) {
    this.module = module;
  }

  /**
   * Debug 级别日志
   */
  debug(...args) {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.DEBUG) {
      const message = formatPrefix(this.module, 'DEBUG') + ' ' + args.map(a => 
        typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
      ).join(' ');
      // Debug 只写文件，不输出到控制台
      writeToFile(message);
    }
  }

  /**
   * Info 级别日志
   */
  info(...args) {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.INFO) {
      const message = formatPrefix(this.module, 'INFO') + ' ' + args.map(a => 
        typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
      ).join(' ');
      // Info 只写文件，不输出到控制台（静默模式）
      writeToFile(message);
    }
  }

  /**
   * Warn 级别日志
   */
  warn(...args) {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.WARN) {
      const message = formatPrefix(this.module, 'WARN') + ' ' + args.map(a => 
        typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
      ).join(' ');
      // Warn 只写文件，不输出到控制台
      writeToFile(message);
    }
  }

  /**
   * Error 级别日志
   */
  error(...args) {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.ERROR) {
      const message = formatPrefix(this.module, 'ERROR') + ' ' + args.map(a => 
        typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
      ).join(' ');
      console.error(formatPrefix(this.module, 'ERROR'), ...args);
      writeToFile(message);
    }
  }

  /**
   * 记录函数调用（包含参数）
   * @param {string} functionName - 函数名称
   * @param {any} params - 函数参数
   */
  logCall(functionName, params = {}) {
    this.info(`▶️ 调用：${functionName}`);
    this.info(`📋 参数:\n${formatParams(params)}`);
  }

  /**
   * 记录函数返回结果
   * @param {string} functionName - 函数名称
   * @param {any} result - 返回结果
   */
  logReturn(functionName, result) {
    this.info(`✅ 完成：${functionName}`);
    if (result !== undefined) {
      this.info(`📤 返回:\n${formatParams(result)}`);
    }
  }

  /**
   * 记录错误
   * @param {string} functionName - 函数名称
   * @param {Error} error - 错误对象
   * @param {any} context - 上下文信息
   */
  logError(functionName, error, context = {}) {
    this.error(`❌ 失败：${functionName}`);
    this.error(`💥 错误：${error.message}`);
    if (Object.keys(context).length > 0) {
      this.error(`🔍 上下文:\n${formatParams(context)}`);
    }
    if (error.stack) {
      this.debug(`📋 堆栈:\n${error.stack}`);
    }
  }
}

/**
 * 创建日志实例的便捷函数
 * @param {string} module - 模块名称
 * @returns {Logger} - Logger 实例
 */
export function createLogger(module) {
  return new Logger(module);
}

// 导出获取日志文件路径的函数
export { getLogFilePath };

export default Logger;
