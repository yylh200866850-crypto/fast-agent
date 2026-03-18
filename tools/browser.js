// 浏览器工具定义 - 使用 Puppeteer-core 远程控制 Edge
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

// 浏览器实例缓存
const browserInstances = new Map();

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

// 浏览器工具定义
export const browserTools = [
  {
    name: 'browser_detect_edge',
    description: '检测 Edge 浏览器是否已安装，返回安装路径',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'browser_find_processes',
    description: '查找正在运行的 Edge 进程',
    inputSchema: {
      type: 'object',
      properties: {
        debugPort: { 
          type: 'integer', 
          description: '调试端口，用于查找特定端口的进程',
          default: null
        }
      }
    }
  },
  {
    name: 'browser_launch',
    description: '使用指定调试端口启动 Edge 浏览器',
    inputSchema: {
      type: 'object',
      properties: {
        debugPort: { 
          type: 'integer', 
          description: '调试端口',
          default: 9222
        },
        headless: { 
          type: 'boolean', 
          description: '是否无头模式',
          default: false
        },
        url: { 
          type: 'string', 
          description: '启动时打开的URL（可选）'
        },
        userDataDir: {
          type: 'string',
          description: '用户数据目录（可选）'
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: '额外的启动参数'
        }
      },
      required: ['debugPort']
    }
  },
  {
    name: 'browser_connect',
    description: '连接到已运行的 Edge 浏览器（通过调试端口）',
    inputSchema: {
      type: 'object',
      properties: {
        debugPort: { 
          type: 'integer', 
          description: '调试端口',
          default: 9222
        },
        host: {
          type: 'string',
          description: '浏览器所在主机',
          default: '127.0.0.1'
        }
      },
      required: ['debugPort']
    }
  },
  {
    name: 'browser_close',
    description: '关闭 Edge 浏览器进程',
    inputSchema: {
      type: 'object',
      properties: {
        debugPort: { 
          type: 'integer', 
          description: '调试端口（关闭特定实例）',
          default: null
        },
        force: {
          type: 'boolean',
          description: '是否强制关闭所有 Edge 进程',
          default: false
        },
        pid: {
          type: 'integer',
          description: '指定进程 PID 关闭'
        }
      }
    }
  },
  {
    name: 'browser_navigate',
    description: '在已连接的浏览器中导航到指定URL',
    inputSchema: {
      type: 'object',
      properties: {
        debugPort: { 
          type: 'integer', 
          description: '调试端口',
          default: 9222
        },
        url: { 
          type: 'string', 
          description: '目标URL'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'browser_screenshot',
    description: '对已连接的浏览器页面截图',
    inputSchema: {
      type: 'object',
      properties: {
        debugPort: { 
          type: 'integer', 
          description: '调试端口',
          default: 9222
        },
        selector: {
          type: 'string',
          description: 'CSS选择器，截取特定元素（可选）'
        },
        fullPage: {
          type: 'boolean',
          description: '是否截取整个页面',
          default: false
        },
        savePath: {
          type: 'string',
          description: '保存路径（可选，不填则返回base64）'
        }
      }
    }
  },
  {
    name: 'browser_evaluate',
    description: '在已连接的浏览器中执行JavaScript代码',
    inputSchema: {
      type: 'object',
      properties: {
        debugPort: { 
          type: 'integer', 
          description: '调试端口',
          default: 9222
        },
        script: { 
          type: 'string', 
          description: '要执行的JavaScript代码'
        }
      },
      required: ['script']
    }
  },
  {
    name: 'browser_get_content',
    description: '获取已连接浏览器的页面内容',
    inputSchema: {
      type: 'object',
      properties: {
        debugPort: { 
          type: 'integer', 
          description: '调试端口',
          default: 9222
        },
        selector: {
          type: 'string',
          description: 'CSS选择器，获取特定元素内容（可选）'
        },
        type: {
          type: 'string',
          enum: ['html', 'text'],
          description: '内容类型',
          default: 'html'
        }
      }
    }
  },
  {
    name: 'browser_click',
    description: '在已连接的浏览器中点击元素',
    inputSchema: {
      type: 'object',
      properties: {
        debugPort: { 
          type: 'integer', 
          description: '调试端口',
          default: 9222
        },
        selector: { 
          type: 'string', 
          description: 'CSS选择器'
        }
      },
      required: ['selector']
    }
  },
  {
    name: 'browser_type',
    description: '在已连接的浏览器中输入文本',
    inputSchema: {
      type: 'object',
      properties: {
        debugPort: { 
          type: 'integer', 
          description: '调试端口',
          default: 9222
        },
        selector: { 
          type: 'string', 
          description: 'CSS选择器'
        },
        text: { 
          type: 'string', 
          description: '要输入的文本'
        },
        delay: {
          type: 'integer',
          description: '输入间隔（毫秒）',
          default: 0
        }
      },
      required: ['selector', 'text']
    }
  },
  {
    name: 'browser_wait',
    description: '等待页面元素或导航完成',
    inputSchema: {
      type: 'object',
      properties: {
        debugPort: { 
          type: 'integer', 
          description: '调试端口',
          default: 9222
        },
        type: {
          type: 'string',
          enum: ['selector', 'navigation', 'timeout'],
          description: '等待类型',
          default: 'selector'
        },
        selector: {
          type: 'string',
          description: 'CSS选择器（type=selector时必填）'
        },
        timeout: {
          type: 'integer',
          description: '超时时间（毫秒）',
          default: 30000
        }
      },
      required: ['type']
    }
  },
  {
    name: 'browser_list_tabs',
    description: '列出浏览器中所有打开的标签页',
    inputSchema: {
      type: 'object',
      properties: {
        debugPort: { 
          type: 'integer', 
          description: '调试端口',
          default: 9222
        }
      }
    }
  },
  {
    name: 'browser_switch_tab',
    description: '切换到指定的标签页',
    inputSchema: {
      type: 'object',
      properties: {
        debugPort: { 
          type: 'integer', 
          description: '调试端口',
          default: 9222
        },
        index: {
          type: 'integer',
          description: '标签页索引（从0开始）'
        },
        url: {
          type: 'string',
          description: '通过URL匹配标签页'
        }
      }
    }
  },
  {
    name: 'browser_status',
    description: '获取浏览器连接状态',
    inputSchema: {
      type: 'object',
      properties: {
        debugPort: { 
          type: 'integer', 
          description: '调试端口',
          default: 9222
        }
      }
    }
  }
];

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
    if (cached.isConnected()) {
      return cached;
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

/**
 * 处理浏览器工具调用
 */
export async function handleBrowserTool(name, args) {
  const text = (content) => ({ 
    content: [{ 
      type: 'text', 
      text: typeof content === 'string' ? content : JSON.stringify(content, null, 2) 
    }] 
  });
  
  const error = (msg) => ({ 
    content: [{ type: 'text', text: msg }], 
    isError: true 
  });

  try {
    switch (name) {
      case 'browser_detect_edge': {
        const edgePath = findEdgePath();
        if (edgePath) {
          return text({
            installed: true,
            path: edgePath,
            platform: process.platform
          });
        }
        return text({
          installed: false,
          message: '未找到 Edge 浏览器',
          searchedPaths: DEFAULT_EDGE_PATHS[process.platform] || []
        });
      }
      
      case 'browser_find_processes': {
        let command;
        if (process.platform === 'win32') {
          if (args.debugPort) {
            command = `wmic process where "name='msedge.exe'" get ProcessId,CommandLine /format:list`;
          } else {
            command = 'tasklist /FI "IMAGENAME eq msedge.exe" /FO CSV';
          }
        } else {
          command = args.debugPort 
            ? `ps aux | grep -i "msedge.*--remote-debugging-port=${args.debugPort}"`
            : 'ps aux | grep -i msedge';
        }
        
        const { stdout } = await execAsync(command, { timeout: 10000 });
        
        // 解析进程列表
        const processes = [];
        if (process.platform === 'win32' && !args.debugPort) {
          const lines = stdout.trim().split('\n').slice(1); // 跳过标题行
          for (const line of lines) {
            const match = line.match(/"msedge.exe","(\d+)"/);
            if (match) {
              processes.push({ pid: parseInt(match[1]), name: 'msedge.exe' });
            }
          }
        } else {
          // 解析 ps 输出
          const lines = stdout.trim().split('\n').filter(l => l.includes('msedge'));
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
              const pidMatch = line.match(/(\d+)/);
              if (pidMatch) {
                processes.push({
                  pid: parseInt(pidMatch[1]),
                  command: line.trim()
                });
              }
            }
          }
        }
        
        return text({
          filter: args.debugPort ? `port:${args.debugPort}` : 'all',
          count: processes.length,
          processes
        });
      }
      
      case 'browser_launch': {
        const edgePath = findEdgePath();
        if (!edgePath) {
          return error('未找到 Edge 浏览器');
        }
        
        const debugPort = args.debugPort || DEFAULT_DEBUG_PORT;
        const launchArgs = [
          `--remote-debugging-port=${debugPort}`,
          '--no-first-run',
          '--no-default-browser-check'
        ];
        
        if (args.headless) {
          launchArgs.push('--headless');
        }
        
        if (args.userDataDir) {
          launchArgs.push(`--user-data-dir=${args.userDataDir}`);
        }
        
        if (args.args) {
          launchArgs.push(...args.args);
        }
        
        if (args.url) {
          launchArgs.push(args.url);
        }
        
        // 使用 start 命令在 Windows 上启动（不等待进程结束）
        let launchCommand;
        if (process.platform === 'win32') {
          launchCommand = `start "" "${edgePath}" ${launchArgs.join(' ')}`;
        } else {
          launchCommand = `"${edgePath}" ${launchArgs.join(' ')} &`;
        }
        
        await execAsync(launchCommand, { timeout: 5000 });
        
        // 等待浏览器启动
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return text({
          success: true,
          message: `Edge 浏览器已启动`,
          debugPort,
          edgePath,
          args: launchArgs
        });
      }
      
      case 'browser_connect': {
        const debugPort = args.debugPort || DEFAULT_DEBUG_PORT;
        const host = args.host || '127.0.0.1';
        
        try {
          const browser = await getBrowserConnection(debugPort, host);
          const version = await browser.version();
          const pages = await browser.pages();
          
          return text({
            success: true,
            message: '已连接到浏览器',
            debugPort,
            host,
            version,
            pagesCount: pages.length
          });
        } catch (e) {
          return error(`连接失败: ${e.message}。请确保浏览器已使用 --remote-debugging-port=${debugPort} 启动`);
        }
      }
      
      case 'browser_close': {
        if (args.pid) {
          // 通过 PID 关闭
          let killCommand;
          if (process.platform === 'win32') {
            killCommand = `taskkill /PID ${args.pid} /F`;
          } else {
            killCommand = `kill -9 ${args.pid}`;
          }
          await execAsync(killCommand);
          
          // 清理缓存
          for (const [key, browser] of browserInstances.entries()) {
            browserInstances.delete(key);
          }
          
          return text({
            success: true,
            message: `已关闭进程 PID: ${args.pid}`
          });
        }
        
        if (args.debugPort) {
          // 通过调试端口关闭
          const key = `127.0.0.1:${args.debugPort}`;
          if (browserInstances.has(key)) {
            const browser = browserInstances.get(key);
            await browser.close();
            browserInstances.delete(key);
            return text({
              success: true,
              message: `已关闭调试端口 ${args.debugPort} 的浏览器连接`
            });
          }
        }
        
        if (args.force) {
          // 强制关闭所有 Edge 进程
          let killCommand;
          if (process.platform === 'win32') {
            killCommand = 'taskkill /F /IM msedge.exe';
          } else {
            killCommand = 'pkill -9 -f msedge';
          }
          await execAsync(killCommand);
          
          // 清理所有缓存
          browserInstances.clear();
          
          return text({
            success: true,
            message: '已强制关闭所有 Edge 进程'
          });
        }
        
        return error('请指定 pid、debugPort 或 force=true');
      }
      
      case 'browser_navigate': {
        const debugPort = args.debugPort || DEFAULT_DEBUG_PORT;
        const page = await getPage(debugPort);
        await page.goto(args.url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        return text({
          success: true,
          url: args.url,
          title: await page.title()
        });
      }
      
      case 'browser_screenshot': {
        const debugPort = args.debugPort || DEFAULT_DEBUG_PORT;
        const page = await getPage(debugPort);
        
        let screenshot;
        if (args.selector) {
          const element = await page.$(args.selector);
          if (!element) {
            return error(`未找到元素: ${args.selector}`);
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
          return text({
            success: true,
            message: '截图已保存',
            path: args.savePath
          });
        }
        
        return text({
          success: true,
          message: '截图成功',
          base64: screenshot.substring(0, 100) + '...(已截断)',
          fullBase64Length: screenshot.length
        });
      }
      
      case 'browser_evaluate': {
        const debugPort = args.debugPort || DEFAULT_DEBUG_PORT;
        const page = await getPage(debugPort);
        const result = await page.evaluate(args.script);
        
        return text({
          success: true,
          result
        });
      }
      
      case 'browser_get_content': {
        const debugPort = args.debugPort || DEFAULT_DEBUG_PORT;
        const page = await getPage(debugPort);
        
        let content;
        if (args.selector) {
          const element = await page.$(args.selector);
          if (!element) {
            return error(`未找到元素: ${args.selector}`);
          }
          content = args.type === 'text' 
            ? await element.evaluate(el => el.textContent)
            : await element.evaluate(el => el.innerHTML);
        } else {
          content = args.type === 'text'
            ? await page.evaluate(() => document.body.innerText)
            : await page.content();
        }
        
        return text({
          success: true,
          type: args.type || 'html',
          content: content.substring(0, 5000) + (content.length > 5000 ? '...(已截断)' : ''),
          fullLength: content.length
        });
      }
      
      case 'browser_click': {
        const debugPort = args.debugPort || DEFAULT_DEBUG_PORT;
        const page = await getPage(debugPort);
        
        await page.click(args.selector);
        
        return text({
          success: true,
          message: `已点击元素: ${args.selector}`
        });
      }
      
      case 'browser_type': {
        const debugPort = args.debugPort || DEFAULT_DEBUG_PORT;
        const page = await getPage(debugPort);
        
        await page.type(args.selector, args.text, { delay: args.delay || 0 });
        
        return text({
          success: true,
          message: `已在 ${args.selector} 中输入文本`
        });
      }
      
      case 'browser_wait': {
        const debugPort = args.debugPort || DEFAULT_DEBUG_PORT;
        const page = await getPage(debugPort);
        const timeout = args.timeout || 30000;
        
        switch (args.type) {
          case 'selector': {
            if (!args.selector) {
              return error('等待 selector 类型需要提供 selector 参数');
            }
            await page.waitForSelector(args.selector, { timeout });
            return text({
              success: true,
              message: `元素已出现: ${args.selector}`
            });
          }
          case 'navigation': {
            await page.waitForNavigation({ timeout, waitUntil: 'networkidle2' });
            return text({
              success: true,
              message: '导航完成'
            });
          }
          case 'timeout': {
            await new Promise(resolve => setTimeout(resolve, args.timeout || 1000));
            return text({
              success: true,
              message: `等待 ${args.timeout || 1000}ms 完成`
            });
          }
          default:
            return error(`未知的等待类型: ${args.type}`);
        }
      }
      
      case 'browser_list_tabs': {
        const debugPort = args.debugPort || DEFAULT_DEBUG_PORT;
        const browser = await getBrowserConnection(debugPort);
        const pages = await browser.pages();
        
        const tabs = await Promise.all(pages.map(async (page, index) => ({
          index,
          url: page.url(),
          title: await page.title().catch(() => '')
        })));
        
        return text({
          success: true,
          count: tabs.length,
          tabs
        });
      }
      
      case 'browser_switch_tab': {
        const debugPort = args.debugPort || DEFAULT_DEBUG_PORT;
        const browser = await getBrowserConnection(debugPort);
        const pages = await browser.pages();
        
        let targetPage = null;
        
        if (args.index !== undefined) {
          targetPage = pages[args.index];
        } else if (args.url) {
          targetPage = pages.find(p => p.url().includes(args.url));
        }
        
        if (!targetPage) {
          return error('未找到指定的标签页');
        }
        
        await targetPage.bringToFront();
        
        return text({
          success: true,
          message: '已切换标签页',
          url: targetPage.url()
        });
      }
      
      case 'browser_status': {
        const debugPort = args.debugPort || DEFAULT_DEBUG_PORT;
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
        
        return text(status);
      }
      
      default:
        return error(`未知的浏览器工具: ${name}`);
    }
  } catch (err) {
    return error(`执行失败: ${err.message}`);
  }
}
