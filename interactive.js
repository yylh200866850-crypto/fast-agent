// 交互式命令行界面
import { createAgent } from './index.js';
import { createLogger, getLogFilePath } from './logger.js';
import { WebServer } from './web_server.js';
import { getMongodService } from './tools/mongod_service.js';
import * as readline from 'readline';
import { homedir, platform } from 'os';
import { join } from 'path';
import { exec } from 'child_process';

const logger = createLogger('Interactive');

// 获取用户环境信息
function getUserEnvInfo() {
  const home = homedir();
  const isWindows = platform() === 'win32';

  return {
    home,
    desktop: join(home, 'Desktop'),
    documents: join(home, 'Documents'),
    downloads: join(home, 'Downloads'),
    platform: platform(),
    isWindows
  };
}

// ANSI 颜色定义
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  red: '\x1b[31m',
  bgCyan: '\x1b[46m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
};

// 计算字符串显示宽度（中文字符占2个宽度）
function getDisplayWidth(str) {
  let width = 0;
  for (const char of String(str)) {
    // 中文字符和全角字符
    if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

// 填充字符串到指定显示宽度
function padToWidth(str, width) {
  const currentWidth = getDisplayWidth(str);
  const padding = width - currentWidth;
  return str + ' '.repeat(Math.max(0, padding));
}

// 打印表格
function printTable(title, headers, rows, color = colors.cyan) {
  const colWidths = headers.map((h, i) =>
    Math.max(getDisplayWidth(h), ...rows.map(r => getDisplayWidth(r[i] || ''))) + 2
  );

  const border = '┌' + colWidths.map(w => '─'.repeat(w)).join('┬') + '┐';
  const divider = '├' + colWidths.map(w => '─'.repeat(w)).join('┼') + '┤';
  const bottomBorder = '└' + colWidths.map(w => '─'.repeat(w)).join('┴') + '┘';

  console.log(`\n${color}${colors.bold} ${title} ${colors.reset}`);
  console.log(color + border + colors.reset);

  // 表头
  const headerRow = '│' + headers.map((h, i) => ' ' + padToWidth(h, colWidths[i] - 1)).join('│') + '│';
  console.log(color + colors.bold + headerRow + colors.reset);
  console.log(color + divider + colors.reset);

  // 数据行
  for (const row of rows) {
    const dataRow = '│' + row.map((cell, i) => ' ' + padToWidth(String(cell || ''), colWidths[i] - 1)).join('│') + '│';
    console.log(color + dataRow + colors.reset);
  }

  console.log(color + bottomBorder + colors.reset);
}

// 工具调用状态跟踪
let toolCallsData = [];
let toolTableDrawn = false;

// 打印工具调用进度表格
function printToolProgressTable() {
  if (toolCallsData.length === 0) return;

  const headers = ['序号', '工具名称', '状态', '耗时'];
  const colWidths = [6, 25, 12, 10];

  // 计算列宽
  for (const call of toolCallsData) {
    colWidths[1] = Math.max(colWidths[1], getDisplayWidth(call.name) + 2);
  }

  const border = '┌' + colWidths.map(w => '─'.repeat(w)).join('┬') + '┐';
  const divider = '├' + colWidths.map(w => '─'.repeat(w)).join('┼') + '┤';
  const bottomBorder = '└' + colWidths.map(w => '─'.repeat(w)).join('┴') + '┘';

  // 清除之前的表格（如果已绘制）
  if (toolTableDrawn) {
    // 移动光标到表格开始位置
    const linesToMove = toolCallsData.length + 4; // 边框 + 表头 + 分隔线 + 数据行
    process.stdout.write(`\x1b[${linesToMove}A\x1b[0J`);
  }

  console.log(colors.cyan + border + colors.reset);

  // 表头
  const headerRow = '│' + headers.map((h, i) => ' ' + padToWidth(h, colWidths[i] - 1)).join('│') + '│';
  console.log(colors.cyan + colors.bold + headerRow + colors.reset);
  console.log(colors.cyan + divider + colors.reset);

  // 数据行
  for (let i = 0; i < toolCallsData.length; i++) {
    const call = toolCallsData[i];
    const statusIcon = call.status === 'pending' ? '⏳' :
      call.status === 'success' ? '✅' : '❌';
    const statusText = call.status === 'pending' ? '执行中...' :
      call.status === 'success' ? '成功' : '失败';
    const statusColor = call.status === 'pending' ? colors.yellow :
      call.status === 'success' ? colors.green : colors.red;

    const row = [
      String(i + 1),
      call.name,
      statusIcon + ' ' + statusText,
      call.duration ? `${call.duration}ms` : '-'
    ];

    const dataRow = '│' + row.map((cell, j) => ' ' + padToWidth(String(cell), colWidths[j] - 1)).join('│') + '│';
    console.log(statusColor + dataRow + colors.reset);
  }

  console.log(colors.cyan + bottomBorder + colors.reset);
  toolTableDrawn = true;
}

// 处理进度回调
function handleProgress(event) {
  if (event.type === 'tool_call') {
    // 记录详细日志
    logger.info(`🔧 调用工具: ${event.name}`);
    logger.debug(`📋 参数: ${event.args}`);

    // 添加到跟踪列表
    toolCallsData.push({
      name: event.name,
      status: 'pending',
      startTime: Date.now()
    });
    printToolProgressTable();
  } else if (event.type === 'tool_result') {
    // 记录详细日志
    if (event.success) {
      logger.info(`✅ 工具执行成功: ${event.name}`);
      logger.debug(`📤 结果: ${event.result?.substring(0, 500)}...`);
    } else {
      logger.error(`❌ 工具执行失败: ${event.name} - ${event.error}`);
    }

    // 更新状态
    const call = toolCallsData.find(c => c.status === 'pending');
    if (call) {
      call.status = event.success ? 'success' : 'failed';
      call.duration = Date.now() - call.startTime;
      call.error = event.error;
    }
    printToolProgressTable();
  } else if (event.type === 'content') {
    // 思考内容记录到日志文件（完整内容，方便调试）
    logger.info(`💭 思考内容:\n${event.content}`);
  }
}

// 重置工具调用状态
function resetToolProgress() {
  toolCallsData = [];
  toolTableDrawn = false;
}

// 打印统计摘要
function printSummary(stats) {
  console.log(`\n${colors.bold}╔══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}║${colors.reset}  ${colors.green}✓${colors.reset} ${colors.bold}工具加载完成${colors.reset}                                              ${colors.bold}║${colors.reset}`);
  console.log(`${colors.bold}╠══════════════════════════════════════════════════════════╣${colors.reset}`);
  console.log(`${colors.bold}║${colors.reset}  ${colors.cyan}📁 文件工具${colors.reset}     ${String(stats.file).padStart(3)} 个                         ${colors.bold}║${colors.reset}`);
  console.log(`${colors.bold}║${colors.reset}  ${colors.yellow}🌐 HTTP 工具${colors.reset}     ${String(stats.http).padStart(3)} 个                         ${colors.bold}║${colors.reset}`);
  console.log(`${colors.bold}║${colors.reset}  ${colors.green}🍃 MongoDB 工具${colors.reset}   ${String(stats.mongo).padStart(3)} 个                         ${colors.bold}║${colors.reset}`);
  console.log(`${colors.bold}║${colors.reset}  ${colors.blue}💻 系统工具${colors.reset}     ${String(stats.system).padStart(3)} 个                         ${colors.bold}║${colors.reset}`);
  console.log(`${colors.bold}║${colors.reset}  ${colors.magenta}🔧 实用工具${colors.reset}     ${String(stats.utils).padStart(3)} 个                         ${colors.bold}║${colors.reset}`);
  console.log(`${colors.bold}║${colors.reset}  ${colors.white}🎯 Skills${colors.reset}        ${String(stats.skills).padStart(3)} 个                         ${colors.bold}║${colors.reset}`);
  console.log(`${colors.bold}║${colors.reset}  ${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}  ${colors.bold}║${colors.reset}`);
  console.log(`${colors.bold}║${colors.reset}  ${colors.bold}📊 总计${colors.reset}          ${String(stats.total).padStart(3)} 个                         ${colors.bold}║${colors.reset}`);
  console.log(`${colors.bold}╚══════════════════════════════════════════════════════════╝${colors.reset}`);
}

async function main() {
  console.log(`\n${colors.cyan}${colors.bold}🚀 正在初始化 Agent...${colors.reset}\n`);

  // 获取用户环境信息
  const userEnv = getUserEnvInfo();
  logger.info(`📍 用户环境信息: ${JSON.stringify(userEnv, null, 2)}`);

  // 创建 Agent
  const agent = await createAgent({
    systemPrompt: `你是一个有用的智能助手。你可以使用各种技能 (skills) 和工具来完成用户的任务。

## 系统上下文
你可以随时调用 \`skill_system_context\` 技能来获取当前系统的完整状态信息，包括：
- 系统环境（操作系统、Node.js 版本、工作目录等）
- 可用工具列表（文件、HTTP、MongoDB、系统工具等）
- 已加载的技能
- 配置状态（LLM 提供商、模型等）
- 数据库连接状态

**重要**：当用户询问你的能力、系统状态或环境信息时，请先调用 \`skill_system_context\` 获取准确信息。

## 用户环境信息
- 操作系统: ${userEnv.platform}
- 用户主目录: ${userEnv.home}
- 桌面路径: ${userEnv.desktop}
- 文档路径: ${userEnv.documents}
- 下载路径: ${userEnv.downloads}

重要提示：
- 当用户提到"桌面"、"文档"、"下载"等位置时，请使用上面提供的准确路径
- 不要猜测用户路径，始终使用提供的环境信息

## 内置 MongoDB 服务
- 本系统内置了 MongoDB 数据库服务
- 默认连接字符串: mongodb://127.0.0.1:27017
- 默认数据库: fast_agent
- 使用 mongo_* 工具时可以不传 uri 参数，会自动使用内置服务

可用能力：
- 系统上下文：查询系统状态和能力
- 计算器：进行数学计算
- 获取时间：查询当前时间
- HTTP 请求：发送网络请求
- 文档处理：Word/Excel/PDF/PPT 文档操作
- MCP 工具：文件操作、HTTP 请求、MongoDB 数据库操作等
- Skill 管理：安装/卸载/查看技能

请友好、专业地回答用户的问题。如果需要调用工具，请直接调用。`
  });

  // 数据库配置
  const dbConfig = agent.config.database || { type: 'local' };
  const mongodConfig = agent.config.mongod || {};
  
  // 检查是否使用云数据库
  const useCloudDatabase = mongodConfig.cloud?.enabled || false;
  const allowNoDatabase = mongodConfig.allowNoDatabase || false;
  const isLocalDb = !useCloudDatabase && mongodConfig.enabled !== false;

  // 启动/连接 MongoDB 服务
  if (useCloudDatabase) {
    // 使用云数据库
    console.log(`${colors.green}${colors.bold}☁️ 连接云数据库服务...${colors.reset}`);
    const mongodService = getMongodService(mongodConfig);
    const initialized = await mongodService.init();
    if (!initialized) {
      console.log(`${colors.red}❌ 云数据库连接失败${colors.reset}`);
      if (!allowNoDatabase) {
        console.log(`${colors.yellow}   请检查 config.json 中的云数据库配置${colors.reset}`);
      }
    }
  } else if (mongodConfig.enabled !== false) {
    // 使用本地 MongoDB
    console.log(`${colors.green}${colors.bold}🍃 初始化 MongoDB 服务...${colors.reset}`);
    const mongodService = getMongodService(mongodConfig);
    const initialized = await mongodService.init();
    
    if (initialized) {
      const info = mongodService.getInfo();
      
      if (info.useExternalService) {
        // 使用外部服务
        if (info.needsAuth) {
          console.log(`${colors.yellow}⚠️ 检测到 MongoDB 需要认证，请配置用户名密码${colors.reset}`);
        } else {
          console.log(`${colors.green}✅ 使用现有 MongoDB 服务: ${mongodService.getUri().replace(/:[^:@]+@/, ':****@')}${colors.reset}`);
          console.log(`${colors.dim}   检测到系统已有 MongoDB 服务，已自动连接${colors.reset}`);
        }
      } else {
        // 启动内置服务
        const started = await mongodService.start();
        if (started) {
          console.log(`${colors.green}✅ MongoDB 服务已启动: ${mongodService.getUri()}${colors.reset}`);
        } else {
          console.log(`${colors.yellow}⚠️ MongoDB 服务启动失败，请检查日志${colors.reset}`);
        }
      }
    } else {
      const info = mongodService.getInfo();
      
      if (info.portConflict) {
        console.log(`${colors.red}❌ MongoDB 服务初始化失败：端口冲突${colors.reset}`);
        console.log(`${colors.yellow}   解决方案：${colors.reset}`);
        console.log(`${colors.dim}   1. 修改 config.json 中的 mongod.port${colors.reset}`);
        console.log(`${colors.dim}   2. 配置使用云数据库: mongod.cloud.enabled = true${colors.reset}`);
        console.log(`${colors.dim}   3. 允许无数据库运行: mongod.allowNoDatabase = true${colors.reset}`);
        
        if (!allowNoDatabase) {
          console.log(`${colors.red}${colors.bold}   ⚠️ 强烈不建议无数据库运行，部分功能将不可用！${colors.reset}`);
        }
      } else if (info.needsAuth) {
        console.log(`${colors.yellow}⚠️ MongoDB 需要认证，请在 config.json 中配置用户名和密码${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠️ MongoDB 服务初始化失败${colors.reset}`);
      }
      
      if (allowNoDatabase) {
        console.log(`${colors.red}${colors.bold}⚠️ 警告：以无数据库模式运行，部分功能将不可用！${colors.reset}`);
        console.log(`${colors.dim}   这可能导致数据无法保存，强烈建议配置数据库${colors.reset}`);
      }
    }
  }

  // 数据库提示
  if (useCloudDatabase) {
    console.log(`${colors.green}☁️ 当前使用云端数据库${colors.reset}`);
  } else if (allowNoDatabase && !getMongodService().isRunning) {
    console.log(`${colors.red}⚠️ 当前无数据库运行，部分功能受限${colors.reset}`);
  } else {
    console.log(`${colors.cyan}💡 当前使用本地 MongoDB 数据库${colors.reset}`);
  }

  // 启动 Web 服务器
  const webServer = new WebServer({ port: 3000 });
  await webServer.start();

  // 显示日志文件路径
  const logPath = getLogFilePath();
  console.log(`${colors.dim}📝 日志文件: ${logPath}${colors.reset}`);

  const tools = await agent.getTools();

  // 分类工具
  const fileTools = tools.filter(t => t.function.name.startsWith('file_'));
  const httpTools = tools.filter(t => t.function.name.startsWith('http_'));
  const mongoTools = tools.filter(t => t.function.name.startsWith('mongo_'));
  const systemTools = tools.filter(t => t.function.name.startsWith('system_'));
  const utilsTools = tools.filter(t => t.function.name.startsWith('utils_'));
  const skillTools = tools.filter(t => t.function.name.startsWith('skill_'));

  // 打印统计摘要
  printSummary({
    file: fileTools.length,
    http: httpTools.length,
    mongo: mongoTools.length,
    system: systemTools.length,
    utils: utilsTools.length,
    skills: skillTools.length,
    total: tools.length
  });

  // 打印文件工具表格
  if (fileTools.length > 0) {
    printTable(
      '📁 文件工具',
      ['工具名称', '描述'],
      fileTools.map(t => [t.function.name, t.function.description.substring(0, 20)]),
      colors.cyan
    );
  }

  // 打印 HTTP 工具表格
  if (httpTools.length > 0) {
    printTable(
      '🌐 HTTP 工具',
      ['工具名称', '描述'],
      httpTools.map(t => [t.function.name, t.function.description]),
      colors.yellow
    );
  }

  // 打印 MongoDB 工具表格
  if (mongoTools.length > 0) {
    printTable(
      '🍃 MongoDB 工具',
      ['工具名称', '描述'],
      mongoTools.map(t => [t.function.name, t.function.description]),
      colors.green
    );
  }

  // 打印 Skills 表格
  if (skillTools.length > 0) {
    printTable(
      '🎯 Skills',
      ['技能名称', '描述'],
      skillTools.map(t => [
        t.function.name.replace('skill_', ''),
        (t.function.description || '').substring(0, 25)
      ]),
      colors.white
    );
  }

  // 打印系统工具表格
  if (systemTools.length > 0) {
    printTable(
      '💻 系统工具',
      ['工具名称', '描述'],
      systemTools.map(t => [
        t.function.name.replace('system_', ''),
        t.function.description.substring(0, 25)
      ]),
      colors.blue
    );
  }

  // 打印实用工具表格
  if (utilsTools.length > 0) {
    printTable(
      '🔧 实用工具',
      ['工具名称', '描述'],
      utilsTools.map(t => [
        t.function.name.replace('utils_', ''),
        t.function.description.substring(0, 25)
      ]),
      colors.magenta
    );
  }

  // 显示配置加载信息
  if (agent.config._paths?.loadedConfigPath) {
    console.log(`${colors.dim}✓ 已加载内置配置：${agent.config._paths.loadedConfigPath}${colors.reset}`);
  }


  // 启动内置 MongoDB 服务 (仅本地模式)
  if (isLocalDb) {
    // 本地数据库提示
    console.log(`\n${colors.cyan}${colors.bold}💡 提示：${colors.reset}当前使用本地 MongoDB 数据库`);
    console.log(`${colors.dim}   开通会员可使用云端数据库，数据更安全、跨设备同步${colors.reset}`);
    console.log(`${colors.dim}   会员详情：https://fast-agent.cn/membership${colors.reset}\n`);
  } else if (dbConfig.cloud?.enabled) {
    console.log(`${colors.green}☁️ 已配置云端数据库: ${dbConfig.cloud.dbName}${colors.reset}`);
  }

  console.log(`\n${colors.dim}💬 进入交互模式 (输入 "quit"/"exit" 退出，"clear" 清除历史，"open" 打开浏览器)${colors.reset}`);
  console.log(`${colors.dim}   💡 也支持自然语言："退出"、"再见"、"清屏"、"打开浏览器" 等${colors.reset}`);
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);

  // 创建 readline 接口
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `\n${colors.cyan}👤 你：${colors.reset}`
  });

  let processing = false;

  // 内置命令列表（供 LLM 分析使用）
  const builtinCommands = ['clear', 'exit', 'open'];

  // 让 LLM 分析用户输入是否为内置命令（不影响对话历史）
  async function analyzeBuiltinCommand(input) {
    // 先检查精确命令
    const normalizedInput = input.trim().toLowerCase();
    if (normalizedInput === 'quit' || normalizedInput === 'exit' || normalizedInput === 'clear' || normalizedInput === 'open') {
      return normalizedInput === 'quit' ? 'exit' : normalizedInput;
    }
    
    // 让 LLM 分析是否为内置命令（使用临时消息，不影响历史）
    try {
      const analysisMessages = [
        {
          role: 'system',
          content: `你是一个命令分析器。分析用户输入是否表示以下内置命令之一：
- clear: 清除对话历史/清屏
- exit: 退出程序
- open: 打开浏览器访问 http://localhost:3000

如果是内置命令，只回复命令名称（clear/exit/open）。如果不是内置命令，回复 "none"。
只回复一个词，不要其他内容。`
        },
        { role: 'user', content: input }
      ];
      
      const result = await agent.provider.chat(analysisMessages, { maxTokens: 10 });
      const command = result.content.trim().toLowerCase();
      
      if (builtinCommands.includes(command)) {
        return command;
      }
    } catch (error) {
      logger.error('分析命令失败:', error);
    }
    
    return null;
  }

  rl.prompt();

  rl.on('line', async (input) => {
    if (processing) return;

    // 让 LLM 分析是否为内置命令
    const builtinCommand = await analyzeBuiltinCommand(input);

    if (builtinCommand === 'exit') {
      console.log(`\n${colors.yellow}👋 用户退出！${colors.reset}`);
      await agent.close();
      rl.close();
      return;
    }

    if (builtinCommand === 'clear') {
      agent.clearHistory();
      console.log(`${colors.dim}🗑️  对话历史已清除${colors.reset}\n`);
      rl.prompt();
      return;
    }

    if (builtinCommand === 'open') {
      const url = 'http://localhost:3000';
      console.log(`${colors.cyan}🌐 正在打开浏览器: ${url}${colors.reset}\n`);

      // 根据操作系统选择打开命令
      const cmd = platform() === 'win32'
        ? `start "" "${url}"`
        : platform() === 'darwin'
          ? `open "${url}"`
          : `xdg-open "${url}"`;

      exec(cmd, (error) => {
        if (error) {
          console.log(`${colors.yellow}⚠️ 打开浏览器失败: ${error.message}${colors.reset}`);
        } else {
          console.log(`${colors.green}✅ 浏览器已打开${colors.reset}`);
        }
        rl.prompt();
      });
      return;
    }

    if (!input.trim()) {
      rl.prompt();
      return;
    }

    try {
      processing = true;
      rl.pause();

      // 重置工具调用状态
      resetToolProgress();

      console.log(`\n${colors.magenta}🤖 AI 思考中...${colors.reset}`);

      const reply = await agent.chat(input, {
        onProgress: handleProgress
      });

      // 如果有工具调用，打印最终表格摘要
      if (toolCallsData.length > 0) {
        const successCount = toolCallsData.filter(c => c.status === 'success').length;
        const failCount = toolCallsData.filter(c => c.status === 'failed').length;
        const totalDuration = toolCallsData.reduce((sum, c) => sum + (c.duration || 0), 0);
        console.log(`\n${colors.dim}📊 工具调用完成: ${successCount} 成功, ${failCount} 失败, 总耗时 ${totalDuration}ms${colors.reset}`);
        console.log(`${colors.dim}📁 详细日志已记录到日志文件${colors.reset}`);
      }

      console.log(`\n${colors.green}${colors.bold}🤖 AI：${colors.reset}${reply}`);
    } catch (error) {
      console.error(`\n${colors.yellow}❌ 错误：${error.message}${colors.reset}`);
    } finally {
      processing = false;
      rl.resume();
    }

    console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);
    rl.prompt();
  });

  // 优雅关闭函数
  async function gracefulShutdown(signal) {
    console.log(`\n${colors.yellow}收到 ${signal} 信号，正在关闭...${colors.reset}`);
    
    // 停止 MongoDB 服务
    const mongodService = getMongodService();
    if (mongodService.isRunning) {
      console.log(`${colors.dim}🛑 正在关闭 MongoDB 服务...${colors.reset}`);
      await mongodService.stop();
    }
    
    await agent.close();
    await webServer.stop();
    process.exit(0);
  }

  // 注册信号处理
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  
  // Windows 上 SIGINT 可能不会被正确触发，额外注册 beforeExit
  process.on('beforeExit', () => gracefulShutdown('beforeExit'));
  
  // 防止进程被强制终止时 mongod 残留
  process.on('exit', () => {
    const mongodService = getMongodService();
    if (mongodService.isRunning) {
      // exit 事件中不能使用异步操作，只能同步强制终止
      try {
        const { execSync } = require('child_process');
        if (platform() === 'win32') {
          execSync('taskkill /F /IM mongod.exe 2>nul', { timeout: 3000 });
        }
      } catch {
        // 忽略错误
      }
    }
  });

  rl.on('close', async () => {
    console.log(`\n${colors.yellow}👋 再见！${colors.reset}`);
    
    // 停止 MongoDB 服务
    const mongodService = getMongodService();
    if (mongodService.isRunning) {
      console.log(`${colors.dim}🛑 正在关闭 MongoDB 服务...${colors.reset}`);
      await mongodService.stop();
    }
    
    await agent.close();
    await webServer.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(`${colors.yellow}启动失败:${colors.reset}`, error);
  process.exit(1);
});
