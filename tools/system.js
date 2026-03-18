// 系统工具定义
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createHash, randomBytes } from 'crypto';

const execAsync = promisify(exec);

// 系统工具定义
export const systemTools = [
  {
    name: 'system_info',
    description: '获取系统信息（CPU、内存、操作系统等）',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'system_env',
    description: '获取用户环境变量',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '指定环境变量名，不填则返回全部' }
      }
    }
  },
  {
    name: 'system_paths',
    description: '获取用户常用路径（桌面、文档、下载等）',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'system_network',
    description: '获取网络接口信息',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'system_exec',
    description: '执行系统命令（谨慎使用）',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的命令' },
        timeout: { type: 'number', description: '超时时间(ms)', default: 30000 },
        cwd: { type: 'string', description: '工作目录' }
      },
      required: ['command']
    }
  },
  {
    name: 'system_disk_usage',
    description: '获取磁盘使用情况',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '磁盘路径，如 C:\\ 或 /' }
      }
    }
  },
  {
    name: 'system_processes',
    description: '获取运行中的进程列表',
    inputSchema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: '进程名过滤（可选）' }
      }
    }
  },
  {
    name: 'system_datetime',
    description: '获取当前日期时间信息',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', description: '日期格式，如 YYYY-MM-DD' },
        timezone: { type: 'string', description: '时区，如 Asia/Shanghai' }
      }
    }
  }
];

// 格式化字节
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(2)} ${units[i]}`;
}

// 工具处理函数
export async function handleSystemTool(name, args) {
  const text = (content) => ({ content: [{ type: 'text', text: typeof content === 'string' ? content : JSON.stringify(content, null, 2) }] });
  
  switch (name) {
    case 'system_info': {
      const cpus = os.cpus();
      const info = {
        platform: os.platform(),
        type: os.type(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: `${Math.floor(os.uptime() / 3600)} 小时`,
        cpu: {
          model: cpus[0]?.model || 'Unknown',
          cores: cpus.length,
          speed: cpus[0]?.speed ? `${cpus[0].speed} MHz` : 'Unknown'
        },
        memory: {
          total: formatBytes(os.totalmem()),
          free: formatBytes(os.freemem()),
          used: formatBytes(os.totalmem() - os.freemem()),
          usagePercent: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(1) + '%'
        },
        user: {
          username: os.userInfo().username,
          homedir: os.homedir(),
          shell: os.userInfo().shell || 'N/A'
        },
        nodeVersion: process.version
      };
      return text(info);
    }
    
    case 'system_env': {
      if (args.name) {
        const value = process.env[args.name];
        return text({ name: args.name, value: value || null });
      }
      // 返回常用环境变量
      const envVars = {
        PATH: process.env.PATH,
        HOME: process.env.HOME || process.env.USERPROFILE,
        USER: process.env.USER || process.env.USERNAME,
        TEMP: process.env.TEMP || process.env.TMP,
        JAVA_HOME: process.env.JAVA_HOME,
        NODE_PATH: process.env.NODE_PATH,
        PYTHONPATH: process.env.PYTHONPATH,
        LANG: process.env.LANG,
        // Windows 特有
        APPDATA: process.env.APPDATA,
        LOCALAPPDATA: process.env.LOCALAPPDATA,
        PROGRAMFILES: process.env.ProgramFiles,
        SYSTEMROOT: process.env.SystemRoot,
        // 其他常用
        EDITOR: process.env.EDITOR,
        SHELL: process.env.SHELL
      };
      // 过滤掉 undefined
      Object.keys(envVars).forEach(key => {
        if (envVars[key] === undefined) delete envVars[key];
      });
      return text(envVars);
    }
    
    case 'system_paths': {
      const home = os.homedir();
      const paths = {
        home,
        desktop: `${home}/Desktop`,
        documents: `${home}/Documents`,
        downloads: `${home}/Downloads`,
        pictures: `${home}/Pictures`,
        music: `${home}/Music`,
        videos: `${home}/Videos`,
        temp: os.tmpdir(),
        // Windows 特有
        appData: process.env.APPDATA,
        localAppData: process.env.LOCALAPPDATA,
        programFiles: process.env.ProgramFiles
      };
      // 过滤掉 undefined
      Object.keys(paths).forEach(key => {
        if (paths[key] === undefined) delete paths[key];
      });
      return text(paths);
    }
    
    case 'system_network': {
      const interfaces = os.networkInterfaces();
      const result = {};
      for (const [name, nets] of Object.entries(interfaces)) {
        result[name] = nets.map(net => ({
          family: net.family,
          address: net.address,
          netmask: net.netmask,
          mac: net.mac,
          internal: net.internal
        }));
      }
      return text(result);
    }
    
    case 'system_exec': {
      try {
        const options = { 
          timeout: args.timeout || 30000,
          maxBuffer: 1024 * 1024 * 10 // 10MB
        };
        if (args.cwd) options.cwd = args.cwd;
        
        const { stdout, stderr } = await execAsync(args.command, options);
        return text({
          command: args.command,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          success: true
        });
      } catch (error) {
        return text({
          command: args.command,
          error: error.message,
          stdout: error.stdout || '',
          stderr: error.stderr || '',
          success: false
        });
      }
    }
    
    case 'system_disk_usage': {
      const path = args.path || (os.platform() === 'win32' ? 'C:\\' : '/');
      try {
        const { execSync } = await import('child_process');
        if (os.platform() === 'win32') {
          const output = execSync(`wmic logicaldisk where "DeviceID='${path.charAt(0)}:'" get Size,FreeSpace /format:csv`, { encoding: 'utf-8' });
          const lines = output.trim().split('\n').filter(l => l.trim());
          if (lines.length >= 2) {
            const [, free, total] = lines[1].split(',');
            return text({
              path: path.charAt(0) + ':',
              total: formatBytes(parseInt(total)),
              free: formatBytes(parseInt(free)),
              used: formatBytes(parseInt(total) - parseInt(free)),
              usagePercent: ((1 - parseInt(free) / parseInt(total)) * 100).toFixed(1) + '%'
            });
          }
        } else {
          const output = execSync(`df -h "${path}" | tail -1`, { encoding: 'utf-8' });
          const parts = output.trim().split(/\s+/);
          return text({
            path,
            total: parts[1],
            used: parts[2],
            available: parts[3],
            usagePercent: parts[4]
          });
        }
      } catch (error) {
        return text({ error: error.message });
      }
      return text({ error: '无法获取磁盘信息' });
    }
    
    case 'system_processes': {
      try {
        let command;
        if (os.platform() === 'win32') {
          command = args.filter 
            ? `tasklist /FI "IMAGENAME eq ${args.filter}*"`
            : 'tasklist';
        } else {
          command = args.filter 
            ? `ps aux | grep -i "${args.filter}"`
            : 'ps aux';
        }
        const { stdout } = await execAsync(command, { timeout: 10000 });
        return text({
          filter: args.filter || 'all',
          processes: stdout.trim()
        });
      } catch (error) {
        return text({ error: error.message });
      }
    }
    
    case 'system_datetime': {
      const now = new Date();
      const result = {
        iso: now.toISOString(),
        local: now.toLocaleString('zh-CN'),
        utc: now.toUTCString(),
        timestamp: now.getTime(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: now.getTimezoneOffset(),
        components: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
          hour: now.getHours(),
          minute: now.getMinutes(),
          second: now.getSeconds(),
          dayOfWeek: now.getDay(),
          dayOfWeekName: ['日', '一', '二', '三', '四', '五', '六'][now.getDay()]
        }
      };
      
      if (args.format) {
        let formatted = args.format
          .replace('YYYY', now.getFullYear())
          .replace('MM', String(now.getMonth() + 1).padStart(2, '0'))
          .replace('DD', String(now.getDate()).padStart(2, '0'))
          .replace('HH', String(now.getHours()).padStart(2, '0'))
          .replace('mm', String(now.getMinutes()).padStart(2, '0'))
          .replace('ss', String(now.getSeconds()).padStart(2, '0'));
        result.formatted = formatted;
      }
      
      return text(result);
    }
    
    default:
      return { content: [{ type: 'text', text: `Unknown system tool: ${name}` }], isError: true };
  }
}
