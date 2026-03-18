// Edge 浏览器控制技能 - 使用 Puppeteer-core 远程控制 Edge
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

// 默认 Edge 路径
const DEFAULT_EDGE_PATHS = {
  win32: [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(os.homedir(), 'AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe')
  ],
  darwin: [
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ],
  linux: [
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable'
  ]
};

// 默认调试端口
const DEFAULT_DEBUG_PORT = 9222;

// 浏览器实例缓存
const browserInstances = new Map();

/**
 * 查找 Edge 浏览器路径
 */
function findEdgePath() {
  const paths = DEFAULT_EDGE_PATHS[process.platform] || [];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

/**
 * 获取 Puppeteer 连接
 */
async function getBrowserConnection(debugPort, host = '127.0.0.1') {
  const key = `${host}:${debugPort}`;
  
  if (browserInstances.has(key)) {
    const cached = browserInstances.get(key);
    try {
      if (cached.isConnected()) {
        return cached;
      }
    } catch (e) {
      // 连接已断开
    }
    browserInstances.delete(key);
  }
  
  // 动态导入 puppeteer-core
  const puppeteer = await import('puppeteer-core');
  
  const browser = await puppeteer.connect({
    browserURL: `http://${host}:${debugPort}`,
    defaultViewport: null
  });
  
  browserInstances.set(key, browser);
  return browser;
}

/**
 * 获取或创建页面
 */
async function getPage(debugPort, host = '127.0.0.1') {
  const browser = await getBrowserConnection(debugPort, host);
  const pages = await browser.pages();
  return pages.length > 0 ? pages[0] : await browser.newPage();
}

export default {
  name: 'edge_control',
  description: 'Edge 浏览器控制技能：检测、启动、连接、操作、关闭 Edge 浏览器',
  
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'detect',           // 检测 Edge 是否安装
          'find_processes',   // 查找运行中的 Edge 进程
          'launch',           // 启动 Edge（带调试端口）
          'connect',          // 连接到已运行的 Edge
          'close',            // 关闭 Edge
          'navigate',         // 导航到 URL
          'screenshot',       // 截图
          'evaluate',         // 执行 JS
          'get_content',      // 获取页面内容
          'click',            // 点击元素
          'type',             // 输入文本
          'wait',             // 等待
          'list_tabs',        // 列出标签页
          'switch_tab',       // 切换标签页
          'status'            // 连接状态
        ],
        description: '操作类型'
      },
      debugPort: {
        type: 'integer',
        description: '调试端口',
        default: 9222
      },
      host: {
        type: 'string',
        description: '浏览器所在主机',
        default: '127.0.0.1'
      },
      url: {
        type: 'string',
        description: 'URL（用于 navigate 或 launch 时打开）'
      },
      headless: {
        type: 'boolean',
        description: '是否无头模式（launch 时）',
        default: false
      },
      userDataDir: {
        type: 'string',
        description: '用户数据目录（launch 时可选）'
      },
      force: {
        type: 'boolean',
        description: '强制关闭所有 Edge 进程（close 时）',
        default: false
      },
      pid: {
        type: 'integer',
        description: '进程 PID（close 时指定）'
      },
      selector: {
        type: 'string',
        description: 'CSS 选择器'
      },
      text: {
        type: 'string',
        description: '要输入的文本'
      },
      script: {
        type: 'string',
        description: '要执行的 JavaScript 代码'
      },
      type: {
        type: 'string',
        description: '内容类型 (html/text) 或等待类型 (selector/navigation/timeout)'
      },
      fullPage: {
        type: 'boolean',
        description: '是否截取整个页面',
        default: false
      },
      savePath: {
        type: 'string',
        description: '截图保存路径'
      },
      timeout: {
        type: 'integer',
        description: '超时时间（毫秒）',
        default: 30000
      },
      index: {
        type: 'integer',
        description: '标签页索引（从 0 开始）'
      }
    },
    required: ['action']
  },

  execute: async (args, context) => {
    const { action, debugPort = DEFAULT_DEBUG_PORT, host = '127.0.0.1' } = args;
    
    try {
      switch (action) {
        case 'detect':
          return await detectEdge();
        
        case 'find_processes':
          return await findProcesses(args.debugPort);
        
        case 'launch':
          return await launchEdge(args);
        
        case 'connect':
          return await connectBrowser(debugPort, host);
        
        case 'close':
          return await closeBrowser(args);
        
        case 'navigate':
          return await navigate(debugPort, args.url);
        
        case 'screenshot':
          return await screenshot(debugPort, args);
        
        case 'evaluate':
          return await evaluate(debugPort, args.script);
        
        case 'get_content':
          return await getContent(debugPort, args);
        
        case 'click':
          return await click(debugPort, args.selector);
        
        case 'type':
          return await typeText(debugPort, args.selector, args.text, args.timeout);
        
        case 'wait':
          return await wait(debugPort, args);
        
        case 'list_tabs':
          return await listTabs(debugPort);
        
        case 'switch_tab':
          return await switchTab(debugPort, args);
        
        case 'status':
          return await getStatus(debugPort);
        
        default:
          return { success: false, error: `未知操作: ${action}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

/**
 * 检测 Edge 浏览器
 */
async function detectEdge() {
  const edgePath = findEdgePath();
  if (edgePath) {
    return {
      success: true,
      installed: true,
      path: edgePath,
      platform: process.platform
    };
  }
  return {
    success: true,
    installed: false,
    message: '未找到 Edge 浏览器',
    searchedPaths: DEFAULT_EDGE_PATHS[process.platform] || []
  };
}

/**
 * 查找 Edge 进程
 */
async function findProcesses(specificPort) {
  let command;
  if (process.platform === 'win32') {
    if (specificPort) {
      command = `wmic process where "name='msedge.exe'" get ProcessId,CommandLine /format:list`;
    } else {
      command = 'tasklist /FI "IMAGENAME eq msedge.exe" /FO CSV';
    }
  } else {
    command = specificPort 
      ? `ps aux | grep -i "msedge.*--remote-debugging-port=${specificPort}"`
      : 'ps aux | grep -i msedge';
  }
  
  const { stdout } = await execAsync(command, { timeout: 10000 });
  
  const processes = [];
  if (process.platform === 'win32' && !specificPort) {
    const lines = stdout.trim().split('\n').slice(1);
    for (const line of lines) {
      const match = line.match(/"msedge.exe","(\d+)"/);
      if (match) {
        processes.push({ pid: parseInt(match[1]), name: 'msedge.exe' });
      }
    }
  } else {
    const lines = stdout.trim().split('\n').filter(l => l.includes('msedge'));
    for (const line of lines) {
      const pidMatch = line.match(/(\d+)/);
      if (pidMatch) {
        processes.push({
          pid: parseInt(pidMatch[1]),
          command: line.trim()
        });
      }
    }
  }
  
  return {
    success: true,
    filter: specificPort ? `port:${specificPort}` : 'all',
    count: processes.length,
    processes
  };
}

/**
 * 启动 Edge 浏览器
 */
async function launchEdge(args) {
  const edgePath = findEdgePath();
  if (!edgePath) {
    return { success: false, error: '未找到 Edge 浏览器' };
  }
  
  const port = args.debugPort || DEFAULT_DEBUG_PORT;
  const launchArgs = [
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check'
  ];
  
  if (args.headless) {
    launchArgs.push('--headless');
  }
  
  if (args.userDataDir) {
    launchArgs.push(`--user-data-dir=${args.userDataDir}`);
  }
  
  if (args.url) {
    launchArgs.push(args.url);
  }
  
  let launchCommand;
  if (process.platform === 'win32') {
    launchCommand = `start "" "${edgePath}" ${launchArgs.join(' ')}`;
  } else {
    launchCommand = `"${edgePath}" ${launchArgs.join(' ')} &`;
  }
  
  await execAsync(launchCommand, { timeout: 5000 });
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    success: true,
    message: 'Edge 浏览器已启动',
    debugPort: port,
    edgePath,
    args: launchArgs
  };
}

/**
 * 连接到浏览器
 */
async function connectBrowser(debugPort, host) {
  try {
    const browser = await getBrowserConnection(debugPort, host);
    const version = await browser.version();
    const pages = await browser.pages();
    
    return {
      success: true,
      message: '已连接到浏览器',
      debugPort,
      host,
      version,
      pagesCount: pages.length
    };
  } catch (e) {
    return {
      success: false,
      error: `连接失败: ${e.message}。请确保浏览器已使用 --remote-debugging-port=${debugPort} 启动`
    };
  }
}

/**
 * 关闭浏览器
 */
async function closeBrowser(args) {
  if (args.pid) {
    let killCommand;
    if (process.platform === 'win32') {
      killCommand = `taskkill /PID ${args.pid} /F`;
    } else {
      killCommand = `kill -9 ${args.pid}`;
    }
    await execAsync(killCommand);
    
    for (const [key, browser] of browserInstances.entries()) {
      browserInstances.delete(key);
    }
    
    return { success: true, message: `已关闭进程 PID: ${args.pid}` };
  }
  
  if (args.debugPort) {
    const key = `127.0.0.1:${args.debugPort}`;
    if (browserInstances.has(key)) {
      const browser = browserInstances.get(key);
      await browser.close();
      browserInstances.delete(key);
      return { success: true, message: `已关闭调试端口 ${args.debugPort} 的浏览器连接` };
    }
  }
  
  if (args.force) {
    let killCommand;
    if (process.platform === 'win32') {
      killCommand = 'taskkill /F /IM msedge.exe';
    } else {
      killCommand = 'pkill -9 -f msedge';
    }
    await execAsync(killCommand);
    browserInstances.clear();
    
    return { success: true, message: '已强制关闭所有 Edge 进程' };
  }
  
  return { success: false, error: '请指定 pid、debugPort 或 force=true' };
}

/**
 * 导航到 URL
 */
async function navigate(debugPort, url) {
  if (!url) {
    return { success: false, error: '请提供 URL' };
  }
  const page = await getPage(debugPort);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  
  return {
    success: true,
    url,
    title: await page.title()
  };
}

/**
 * 截图
 */
async function screenshot(debugPort, args) {
  const page = await getPage(debugPort);
  
  let screenshot;
  if (args.selector) {
    const element = await page.$(args.selector);
    if (!element) {
      return { success: false, error: `未找到元素: ${args.selector}` };
    }
    screenshot = await element.screenshot({ encoding: 'base64' });
  } else {
    screenshot = await page.screenshot({ 
      encoding: 'base64',
      fullPage: args.fullPage || false
    });
  }
  
  if (args.savePath) {
    const buffer = Buffer.from(screenshot, 'base64');
    await fs.promises.writeFile(args.savePath, buffer);
    return { success: true, message: '截图已保存', path: args.savePath };
  }
  
  return {
    success: true,
    message: '截图成功',
    base64Length: screenshot.length
  };
}

/**
 * 执行 JavaScript
 */
async function evaluate(debugPort, script) {
  if (!script) {
    return { success: false, error: '请提供 JavaScript 代码' };
  }
  const page = await getPage(debugPort);
  const result = await page.evaluate(script);
  return { success: true, result };
}

/**
 * 获取页面内容
 */
async function getContent(debugPort, args) {
  const page = await getPage(debugPort);
  
  let content;
  if (args.selector) {
    const element = await page.$(args.selector);
    if (!element) {
      return { success: false, error: `未找到元素: ${args.selector}` };
    }
    content = args.type === 'text' 
      ? await element.evaluate(el => el.textContent)
      : await element.evaluate(el => el.innerHTML);
  } else {
    content = args.type === 'text'
      ? await page.evaluate(() => document.body.innerText)
      : await page.content();
  }
  
  return {
    success: true,
    type: args.type || 'html',
    content: content.substring(0, 5000) + (content.length > 5000 ? '...(已截断)' : ''),
    fullLength: content.length
  };
}

/**
 * 点击元素
 */
async function click(debugPort, selector) {
  if (!selector) {
    return { success: false, error: '请提供 CSS 选择器' };
  }
  const page = await getPage(debugPort);
  await page.click(selector);
  return { success: true, message: `已点击元素: ${selector}` };
}

/**
 * 输入文本
 */
async function typeText(debugPort, selector, text, delay = 0) {
  if (!selector || text === undefined) {
    return { success: false, error: '请提供 CSS 选择器和文本' };
  }
  const page = await getPage(debugPort);
  await page.type(selector, text, { delay });
  return { success: true, message: `已在 ${selector} 中输入文本` };
}

/**
 * 等待
 */
async function wait(debugPort, args) {
  const page = await getPage(debugPort);
  const timeout = args.timeout || 30000;
  
  switch (args.type) {
    case 'selector': {
      if (!args.selector) {
        return { success: false, error: '等待 selector 类型需要提供 selector 参数' };
      }
      await page.waitForSelector(args.selector, { timeout });
      return { success: true, message: `元素已出现: ${args.selector}` };
    }
    case 'navigation': {
      await page.waitForNavigation({ timeout, waitUntil: 'networkidle2' });
      return { success: true, message: '导航完成' };
    }
    case 'timeout':
    default: {
      await new Promise(resolve => setTimeout(resolve, args.timeout || 1000));
      return { success: true, message: `等待 ${args.timeout || 1000}ms 完成` };
    }
  }
}

/**
 * 列出标签页
 */
async function listTabs(debugPort) {
  const browser = await getBrowserConnection(debugPort);
  const pages = await browser.pages();
  
  const tabs = await Promise.all(pages.map(async (page, index) => ({
    index,
    url: page.url(),
    title: await page.title().catch(() => '')
  })));
  
  return { success: true, count: tabs.length, tabs };
}

/**
 * 切换标签页
 */
async function switchTab(debugPort, args) {
  const browser = await getBrowserConnection(debugPort);
  const pages = await browser.pages();
  
  let targetPage = null;
  
  if (args.index !== undefined) {
    targetPage = pages[args.index];
  } else if (args.url) {
    targetPage = pages.find(p => p.url().includes(args.url));
  }
  
  if (!targetPage) {
    return { success: false, error: '未找到指定的标签页' };
  }
  
  await targetPage.bringToFront();
  return { success: true, message: '已切换标签页', url: targetPage.url() };
}

/**
 * 获取连接状态
 */
async function getStatus(debugPort) {
  const key = `127.0.0.1:${debugPort}`;
  
  const status = {
    debugPort,
    connected: false,
    cached: browserInstances.has(key)
  };
  
  if (browserInstances.has(key)) {
    const browser = browserInstances.get(key);
    try {
      status.connected = browser.isConnected();
      if (status.connected) {
        status.version = await browser.version();
        status.pagesCount = (await browser.pages()).length;
      }
    } catch (e) {
      status.error = e.message;
    }
  }
  
  return { success: true, ...status };
}
