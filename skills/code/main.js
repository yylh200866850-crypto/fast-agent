/**
 * 代码执行技能
 * 
 * 安全执行 JavaScript/Python/Bash 代码
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createContext, runInContext } from 'vm';
import { createLogger } from '../../logger.js';

const execAsync = promisify(exec);
const logger = createLogger('Code');

// 允许的 Bash 命令白名单
const ALLOWED_BASH_COMMANDS = [
  'echo', 'printf', 'date', 'cal', 'whoami', 'pwd',
  'ls', 'dir', 'cat', 'head', 'tail', 'wc', 'sort', 'uniq',
  'grep', 'find', 'which', 'whereis',
  'node', 'npm', 'npx', 'python', 'python3', 'pip',
  'git', 'gh',
  'curl', 'wget'
];

export default {
  name: 'code',
  description: '代码执行技能 - 安全执行 JavaScript/Python/Bash 代码',
  
  parameters: {
    type: 'object',
    properties: {
      language: {
        type: 'string',
        enum: ['javascript', 'python', 'bash']
      },
      code: { type: 'string' },
      timeout: { type: 'integer', minimum: 1000, maximum: 60000 },
      context: { type: 'object' }
    },
    required: ['language', 'code']
  },

  async execute(params, context) {
    const { language, code, timeout = 10000, context: execContext = {} } = params;
    
    switch (language) {
      case 'javascript':
        return executeJavaScript(code, execContext, timeout);
      case 'python':
        return executePython(code, timeout);
      case 'bash':
        return executeBash(code, timeout);
      default:
        throw new Error(`不支持的语言: ${language}`);
    }
  }
};

/**
 * 执行 JavaScript 代码
 */
async function executeJavaScript(code, context, timeout) {
  const startTime = Date.now();
  
  try {
    // 创建沙箱上下文
    const sandbox = {
      ...context,
      console: {
        log: (...args) => sandbox.__logs.push(args.map(formatValue).join(' ')),
        error: (...args) => sandbox.__errors.push(args.map(formatValue).join(' ')),
        warn: (...args) => sandbox.__logs.push('[WARN] ' + args.map(formatValue).join(' '))
      },
      __logs: [],
      __errors: [],
      __result: undefined,
      // 提供一些安全的工具函数
      JSON,
      Math,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Date,
      RegExp,
      Map,
      Set,
      Promise,
      setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, timeout / 2)),
      clearTimeout
    };
    
    // 包装代码
    const wrappedCode = `
      (function() {
        ${code.includes('return') ? code : `; ${code}`}
      })()
    `;
    
    // 创建上下文并执行
    const vmContext = createContext(sandbox);
    
    const result = runInContext(wrappedCode, vmContext, {
      timeout,
      displayErrors: true
    });
    
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      language: 'javascript',
      result: formatValue(result),
      logs: sandbox.__logs,
      errors: sandbox.__errors,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      language: 'javascript',
      error: error.message,
      duration
    };
  }
}

/**
 * 执行 Python 代码
 */
async function executePython(code, timeout) {
  const startTime = Date.now();
  
  try {
    // 使用 python3 或 python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    // 使用 -c 执行代码
    const { stdout, stderr } = await execAsync(`${pythonCmd} -c "${code.replace(/"/g, '\\"')}"`, {
      timeout,
      maxBuffer: 1024 * 1024 // 1MB
    });
    
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      language: 'python',
      result: stdout.trim(),
      stderr: stderr.trim(),
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      language: 'python',
      error: error.message,
      stderr: error.stderr || '',
      duration
    };
  }
}

/**
 * 执行 Bash 命令
 */
async function executeBash(code, timeout) {
  const startTime = Date.now();
  
  // 安全检查：只允许白名单命令
  const firstCommand = code.trim().split(/\s+/)[0];
  const baseCommand = firstCommand.replace(/^\.?\//, '');
  
  if (!ALLOWED_BASH_COMMANDS.includes(baseCommand)) {
    return {
      success: false,
      language: 'bash',
      error: `命令不允许: ${baseCommand}`,
      allowedCommands: ALLOWED_BASH_COMMANDS
    };
  }
  
  try {
    const { stdout, stderr } = await execAsync(code, {
      timeout,
      maxBuffer: 1024 * 1024,
      cwd: process.cwd()
    });
    
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      language: 'bash',
      result: stdout.trim(),
      stderr: stderr.trim(),
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      language: 'bash',
      error: error.message,
      stderr: error.stderr || '',
      duration
    };
  }
}

/**
 * 格式化值
 */
function formatValue(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'function') return '[Function]';
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'bigint') return value.toString() + 'n';
  if (value instanceof Error) return value.stack || value.message;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Map) return `Map(${value.size})`;
  if (value instanceof Set) return `Set(${value.size})`;
  if (Array.isArray(value)) {
    return value.map(formatValue);
  }
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }
  return value;
}
