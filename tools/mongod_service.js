/**
 * MongoDB 服务管理模块
 * 管理内嵌的 mongod 服务进程
 * 支持从 OSS 自动下载 mongod 二进制文件
 */
import { spawn, exec } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, renameSync, createWriteStream, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { platform, arch, networkInterfaces } from 'os';
import { MongoClient } from 'mongodb';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { createConnection } from 'net';

// 兼容 ES Module 和 CommonJS 环境
const getDirname = () => {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  }
};

const __dirname = getDirname();

// 获取可执行文件所在目录
function getExeDir() {
  const isPkg = typeof process.pkg !== 'undefined';
  return isPkg ? dirname(process.execPath) : join(__dirname, '..');
}

// 获取当前平台标识
function getPlatformKey() {
  const currentPlatform = platform();
  const currentArch = arch();
  
  if (currentPlatform === 'win32') {
    return 'win32-x64';
  } else if (currentPlatform === 'darwin') {
    return currentArch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  } else if (currentPlatform === 'linux') {
    return 'linux-x64';
  }
  
  return null;
}

// 计算文件 SHA256
async function calculateSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = require('fs').createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// 下载文件
async function downloadFile(url, destPath, onProgress) {
  const https = await import('https');
  const http = await import('http');
  const client = url.startsWith('https') ? https : http;
  
  return new Promise((resolve, reject) => {
    const tempPath = destPath + '.downloading';
    const file = createWriteStream(tempPath);
    let downloadedBytes = 0;
    
    const request = client.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // 跟随重定向
        file.close();
        unlinkSync(tempPath);
        downloadFile(response.headers.location, destPath, onProgress).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        unlinkSync(tempPath);
        reject(new Error(`下载失败: HTTP ${response.statusCode}`));
        return;
      }
      
      const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (onProgress) {
          onProgress({
            downloaded: downloadedBytes,
            total: totalBytes,
            percent: totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0
          });
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        renameSync(tempPath, destPath);
        resolve(destPath);
      });
    });
    
    request.on('error', (err) => {
      file.close();
      try { unlinkSync(tempPath); } catch {}
      reject(err);
    });
    
    request.setTimeout(300000, () => { // 5分钟超时
      request.destroy();
      reject(new Error('下载超时'));
    });
  });
}

// 默认配置
const DEFAULT_CONFIG = {
  port: 27017,
  host: '127.0.0.1',
  dbName: 'fast_agent',
  dataDir: 'mongod/data',
  logDir: 'mongod/log',
  mongodDir: 'mongod',
  // 进程监控配置
  healthCheckInterval: 10000,  // 健康检查间隔（毫秒）
  autoRestart: true,           // 进程异常退出时自动重启
  maxRestartAttempts: 3,       // 最大重启尝试次数
  restartDelay: 3000,          // 重启延迟（毫秒）
  // 端口冲突处理策略: 'auto' | 'always_start' | 'use_existing'
  // auto: 检测到已有MongoDB服务则使用，否则启动新的
  // always_start: 总是尝试启动新服务（端口冲突时报错）
  // use_existing: 优先使用已有服务，没有才启动
  portConflictStrategy: 'auto'
};

/**
 * MongoDB 服务管理器
 */
export class MongodService {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.process = null;
    this.isRunning = false;
    this.startTime = null;
    
    // 进程监控相关
    this.healthCheckTimer = null;
    this.restartAttempts = 0;
    this.isShuttingDown = false;
    
    // 云数据库配置
    this.useCloudDatabase = this.config.cloud?.enabled || false;
    if (this.useCloudDatabase) {
      this.cloudUri = this.config.cloud.uri;
      this.cloudDbName = this.config.cloud.dbName || 'fast_agent';
      console.log('☁️ 已配置云数据库服务');
    }
    
    // 解析路径（每次实例化时重新计算，确保移动文件夹后路径正确）
    this.baseDir = getExeDir();
    this.mongodDir = join(this.baseDir, this.config.mongodDir);
    this.dataDir = join(this.baseDir, this.config.dataDir);
    this.logDir = join(this.baseDir, this.config.logDir);
    
    // 根据操作系统平台选择 mongod 可执行文件
    // Windows: mongod.exe, macOS/Linux: mongod
    const mongodExe = platform() === 'win32' ? 'mongod.exe' : 'mongod';
    this.mongodExe = mongodExe;
    this.mongodPath = join(this.mongodDir, mongodExe);
    this.configPath = join(this.mongodDir, 'mongod.cfg');
    this.resourcesConfigPath = join(this.mongodDir, 'mongod-resources.json');
    this.mongodDownloaded = false;
    
    // 连接字符串（基础URI，不含认证信息）
    this.uri = `mongodb://${this.config.host}:${this.config.port}`;
  }

  /**
   * 加载资源配置
   */
  _loadResourcesConfig() {
    try {
      if (existsSync(this.resourcesConfigPath)) {
        const content = readFileSync(this.resourcesConfigPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (e) {
      console.warn('⚠️ 加载 mongod 资源配置失败:', e.message);
    }
    return null;
  }

  /**
   * 确保 mongod 可执行文件存在（必要时从 OSS 下载）
   */
  async ensureMongodBinary() {
    // 检查 mongod 是否已存在
    if (existsSync(this.mongodPath)) {
      console.log('✅ mongod 已存在:', this.mongodPath);
      return true;
    }
    
    // 尝试查找平台特定的文件名（如 mongod.win, mongod.linux 等）
    const platformKey = getPlatformKey();
    if (!platformKey) {
      console.warn('⚠️ 不支持的平台:', platform(), arch());
      return false;
    }
    
    const config = this._loadResourcesConfig();
    if (!config) {
      console.warn('⚠️ 未找到 mongod 资源配置文件');
      return false;
    }
    
    const platformInfo = config.platforms?.[platformKey];
    const downloadUrl = config.downloadUrl?.[platformKey];
    
    if (!downloadUrl) {
      console.warn('⚠️ 未找到平台的下载地址:', platformKey);
      return false;
    }
    
    // 检查是否有原始文件（如 mongod.win）
    const originalFile = join(this.mongodDir, platformInfo?.file || '');
    if (existsSync(originalFile)) {
      console.log('📋 找到 mongod 文件，正在重命名...');
      renameSync(originalFile, this.mongodPath);
      // 设置可执行权限 (Unix)
      if (platform() !== 'win32') {
        try {
          const { chmodSync } = await import('fs');
          chmodSync(this.mongodPath, 0o755);
        } catch (e) {
          console.warn('⚠️ 设置可执行权限失败:', e.message);
        }
      }
      console.log('✅ mongod 已就绪');
      return true;
    }
    
    // 从 OSS 下载
    console.log('📥 mongod 不存在，正在从 OSS 下载...');
    console.log('   平台:', platformKey);
    console.log('   URL:', downloadUrl);
    
    try {
      await downloadFile(downloadUrl, this.mongodPath, (progress) => {
        if (progress.percent % 10 === 0 || progress.percent === 100) {
          console.log(`   下载进度: ${progress.percent}% (${Math.round(progress.downloaded / 1024 / 1024)}MB)`);
        }
      });
      
      // 设置可执行权限 (Unix)
      if (platform() !== 'win32') {
        try {
          const { chmodSync } = await import('fs');
          chmodSync(this.mongodPath, 0o755);
        } catch (e) {
          console.warn('⚠️ 设置可执行权限失败:', e.message);
        }
      }
      
      console.log('✅ mongod 下载完成');
      this.mongodDownloaded = true;
      return true;
    } catch (e) {
      console.error('❌ mongod 下载失败:', e.message);
      return false;
    }
  }

  /**
   * 检测端口是否被占用
   * @returns {Promise<boolean>} true 表示端口被占用
   */
  async _isPortInUse() {
    return new Promise((resolve) => {
      const tester = createConnection(this.config.port, this.config.host);
      tester.on('connect', () => {
        tester.destroy();
        resolve(true);
      });
      tester.on('error', () => {
        resolve(false);
      });
      tester.setTimeout(2000);
      tester.on('timeout', () => {
        tester.destroy();
        resolve(false);
      });
    });
  }

  /**
   * 检测端口上是否运行着 MongoDB 服务
   * @returns {Promise<{inUse: boolean, isMongo: boolean, version?: string}>}
   */
  async _detectMongoService() {
    const portInUse = await this._isPortInUse();
    
    if (!portInUse) {
      return { inUse: false, isMongo: false };
    }
    
    // 尝试连接并检测是否是 MongoDB
    const client = new MongoClient(this.uri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000
    });
    
    try {
      await client.connect();
      const adminDb = client.db('admin');
      const result = await adminDb.command({ buildInfo: 1 });
      await client.close();
      
      return {
        inUse: true,
        isMongo: true,
        version: result.version,
        isSelfManaged: false  // 外部管理的 MongoDB
      };
    } catch (err) {
      // 检查是否是认证错误（说明是MongoDB但需要认证）
      const errMsg = err.message || '';
      if (errMsg.includes('Authentication') || errMsg.includes('auth') || 
          errMsg.includes('unauthorized') || errMsg.includes('login')) {
        return {
          inUse: true,
          isMongo: true,
          needsAuth: true,
          error: 'MongoDB服务需要认证'
        };
      }
      // 端口被占用但不是 MongoDB 或其他错误
      return {
        inUse: true,
        isMongo: false,
        error: err.message
      };
    } finally {
      try { await client.close(); } catch {}
    }
  }

  /**
   * 测试数据库连接
   * @returns {Promise<{success: boolean, error?: string, suggestion?: string}>}
   */
  async testConnection() {
    // 构建连接URI（支持认证）
    const uri = this._buildConnectionUri();
    
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    
    try {
      await client.connect();
      
      // 测试基本操作
      const db = client.db(this.config.dbName);
      await db.command({ ping: 1 });
      
      // 尝试列出集合（测试读写权限）
      try {
        await db.listCollections().toArray();
      } catch (e) {
        // 没有权限列出集合，但ping成功
        console.warn('⚠️ 数据库连接成功，但可能缺少读写权限');
      }
      
      await client.close();
      return { success: true };
    } catch (err) {
      const errMsg = err.message || '';
      
      // 认证失败
      if (errMsg.includes('Authentication') || errMsg.includes('auth failed') || 
          errMsg.includes('unauthorized') || errMsg.includes('wrong credentials')) {
        return {
          success: false,
          error: '认证失败：用户名或密码错误',
          suggestion: '请在 config.json 中配置正确的 MongoDB 用户名和密码：\n' +
            JSON.stringify({
              mongod: {
                username: "your_username",
                password: "your_password",
                authSource: "admin"
              }
            }, null, 2)
        };
      }
      
      // 网络错误
      if (errMsg.includes('ECONNREFUSED') || errMsg.includes('connect ETIMEDOUT')) {
        return {
          success: false,
          error: '无法连接到数据库服务',
          suggestion: '请检查数据库服务是否正在运行'
        };
      }
      
      // 权限错误
      if (errMsg.includes('not authorized') || errMsg.includes('permission denied')) {
        return {
          success: false,
          error: '权限不足',
          suggestion: '请确保数据库用户有足够的权限访问数据库 ' + this.config.dbName
        };
      }
      
      // 其他错误
      return {
        success: false,
        error: errMsg,
        suggestion: '请检查数据库配置或联系技术支持'
      };
    } finally {
      try { await client.close(); } catch {}
    }
  }

  /**
   * 构建连接URI（支持认证和云数据库）
   */
  _buildConnectionUri() {
    // 如果使用云数据库，直接返回云URI
    if (this.useCloudDatabase && this.cloudUri) {
      return this.cloudUri;
    }
    
    const { host, port, username, password, authSource, dbName } = this.config;
    
    // 如果有用户名密码，构建认证URI
    if (username && password) {
      const authDb = authSource || 'admin';
      return `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${dbName}?authSource=${authDb}`;
    }
    
    // 无认证
    return `mongodb://${host}:${port}`;
  }

  /**
   * 获取数据库名
   */
  getDbName() {
    if (this.useCloudDatabase) {
      return this.cloudDbName;
    }
    return this.config.dbName;
  }

  /**
   * 获取连接字符串（带认证信息）
   */
  getUri() {
    return this._buildConnectionUri();
  }

  /**
   * 初始化服务（创建必要的目录和配置文件）
   */
  async init() {
    console.log('🍃 初始化 MongoDB 服务...');
    
    // 如果使用云数据库，直接测试连接
    if (this.useCloudDatabase) {
      console.log('☁️ 使用云数据库服务...');
      console.log(`   连接: ${this.cloudUri.replace(/:[^:@]+@/, ':****@')}`); // 隐藏密码
      
      const testResult = await this.testConnection();
      if (testResult.success) {
        this.isRunning = true;
        this.startTime = new Date();
        console.log('✅ 云数据库连接成功');
        return true;
      } else {
        console.error('❌ 云数据库连接失败:', testResult.error);
        console.error('   建议:', testResult.suggestion);
        return false;
      }
    }
    
    // 首先检测端口状态
    const portStatus = await this._detectMongoService();
    this.portStatus = portStatus;
    
    if (portStatus.inUse) {
      if (portStatus.isMongo) {
        // 检测到需要认证的 MongoDB
        if (portStatus.needsAuth) {
          console.log(`✅ 检测到端口 ${this.config.port} 已有 MongoDB 服务运行（需要认证）`);
          console.log('   请在 config.json 中配置用户名和密码');
          this.useExternalService = true;
          this.needsAuth = true;
          
          // 如果已配置认证信息，测试连接
          if (this.config.username && this.config.password) {
            const testResult = await this.testConnection();
            if (testResult.success) {
              this.isRunning = true;
              this.startTime = new Date();
              console.log('✅ MongoDB 认证成功');
              return true;
            } else {
              console.error('❌ MongoDB 认证失败:', testResult.error);
              console.error('   建议:', testResult.suggestion);
              return false;
            }
          }
          return false;
        }
        
        console.log(`✅ 检测到端口 ${this.config.port} 已有 MongoDB 服务运行 (版本: ${portStatus.version})`);
        console.log('   将使用现有的 MongoDB 服务，不再启动新的实例。');
        
        // 测试连接
        const testResult = await this.testConnection();
        if (!testResult.success) {
          console.error('⚠️ 连接测试失败:', testResult.error);
          console.error('   建议:', testResult.suggestion);
        }
        
        this.useExternalService = true;
        this.isRunning = true;
        this.startTime = new Date();
        console.log('✅ MongoDB 服务初始化完成（使用外部服务）');
        return true;
      } else {
        // 端口被非 MongoDB 服务占用
        console.error(`❌ 端口 ${this.config.port} 已被非 MongoDB 服务占用`);
        console.error('   可能的原因：');
        console.error('   1. 其他程序占用了该端口');
        console.error('   2. 系统中已安装并运行了其他数据库服务');
        console.error('');
        console.error('   解决方案：');
        console.error(`   1. 在 config.json 中修改 mongod.port 为其他端口`);
        console.error('   2. 关闭占用端口的程序');
        console.error(`   3. 配置使用云数据库: mongod.cloud.enabled = true`);
        console.error(`   4. 允许无数据库运行: mongod.allowNoDatabase = true (强烈不建议)`);
        
        // 返回 false 表示初始化失败，但不阻止程序继续
        this.useExternalService = false;
        this.portConflict = true;
        return false;
      }
    }
    
    // 端口未被占用，准备启动自己的 mongod
    this.useExternalService = false;
    
    // 确保 mongod 目录存在
    if (!existsSync(this.mongodDir)) {
      mkdirSync(this.mongodDir, { recursive: true });
      console.log('📁 创建 mongod 目录:', this.mongodDir);
    }
    
    // 确保 mongod 可执行文件存在
    const mongodReady = await this.ensureMongodBinary();
    if (!mongodReady) {
      console.warn('⚠️ mongod 可执行文件未找到且无法下载');
      console.warn('   MongoDB 服务将不会启动。');
      console.warn('   请手动下载 mongod 到:', this.mongodDir);
      return false;
    }
    
    // 创建数据目录
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
      console.log(`📁 创建数据目录: ${this.dataDir}`);
    }
    
    // 创建日志目录
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
      console.log(`📁 创建日志目录: ${this.logDir}`);
    }
    
    // 检查是否有异常关闭的锁文件
    await this._checkUncleanShutdown();
    
    // 创建配置文件
    this._createConfigFile();
    
    console.log('✅ MongoDB 服务初始化完成');
    return true;
  }

  /**
   * 检查异常关闭（检测 lock 文件）
   */
  async _checkUncleanShutdown() {
    const lockFile = join(this.dataDir, 'mongod.lock');
    const WiredTigerLockFile = join(this.dataDir, 'WiredTiger.lock');
    
    // 检查是否存在 lock 文件（非空表示异常关闭）
    if (existsSync(lockFile)) {
      try {
        const content = readFileSync(lockFile, 'utf-8').trim();
        if (content) {
          console.warn('⚠️ 检测到 MongoDB 异常关闭（存在非空 lock 文件）');
          console.warn('   建议在启动后检查数据完整性');
          // MongoDB 会自动恢复，但我们记录这个情况
        }
      } catch {
        // 忽略读取错误
      }
    }
    
    // WiredTiger 引擎的 lock 文件
    if (existsSync(WiredTigerLockFile)) {
      console.log('📋 检测到 WiredTiger lock 文件（正常）');
    }
  }

  /**
   * 创建 mongod 配置文件
   */
  _createConfigFile() {
    const configContent = `# MongoDB 配置文件 (由 fast-agent 自动生成)

# 数据存储路径
storage:
  dbPath: ${this.dataDir.replace(/\\/g, '/')}

# 日志配置
systemLog:
  destination: file
  logAppend: true
  path: ${join(this.logDir, 'mongod.log').replace(/\\/g, '/')}

# 网络配置
net:
  port: ${this.config.port}
  bindIp: ${this.config.host}
`;
    
    writeFileSync(this.configPath, configContent, 'utf-8');
    console.log(`📝 配置文件: ${this.configPath}`);
  }

  /**
   * 启动 MongoDB 服务
   */
  async start() {
    if (this.isRunning) {
      console.log('🍃 MongoDB 服务已在运行中');
      return true;
    }
    
    // 如果使用外部服务，不需要启动
    if (this.useExternalService) {
      console.log('🍃 使用外部 MongoDB 服务，跳过启动');
      return true;
    }
    
    // 如果端口冲突，不尝试启动
    if (this.portConflict) {
      console.error('❌ 端口冲突，无法启动 MongoDB 服务');
      return false;
    }
    
    // 重置关闭标志
    this.isShuttingDown = false;
    
    // 检查 mongod 是否存在
    if (!existsSync(this.mongodPath)) {
      console.warn(`⚠️ mongod 可执行文件未找到，跳过启动: ${this.mongodPath}`);
      return false;
    }
    
    console.log(`🚀 启动 MongoDB 服务...`);
    console.log(`   端口: ${this.config.port}`);
    console.log(`   数据: ${this.dataDir}`);
    console.log(`   日志: ${this.logDir}`);
    
    return new Promise((resolve, reject) => {
      try {
        // 使用 detached 模式启动后台进程（跨平台兼容）
        this.process = spawn(this.mongodPath, [
          '--config', this.configPath
        ], {
          cwd: this.mongodDir,
          stdio: ['ignore', 'ignore', 'ignore'],
          detached: true,
          windowsHide: true
        });
        
        // 让进程独立运行
        this.process.unref();
        
        // 监听进程退出
        this.process.on('exit', (code, signal) => {
          this._handleProcessExit(code, signal);
        });
        
        this.process.on('error', (err) => {
          console.error('❌ MongoDB 启动失败:', err.message);
          this.isRunning = false;
          resolve(false);
        });
        
        // 等待服务启动
        setTimeout(async () => {
          const running = await this.checkStatus();
          if (running) {
            this.isRunning = true;
            this.startTime = new Date();
            this.restartAttempts = 0;  // 重置重启计数
            console.log('✅ MongoDB 服务启动成功');
            console.log(`   连接字符串: ${this.uri}`);
            
            // 启动健康检查
            this._startHealthCheck();
            
            resolve(true);
          } else {
            console.error('❌ MongoDB 服务启动失败');
            resolve(false);
          }
        }, 2000);
        
      } catch (err) {
        console.error('❌ MongoDB 启动异常:', err.message);
        resolve(false);
      }
    });
  }

  /**
   * 停止 MongoDB 服务（优雅关闭）
   */
  async stop() {
    if (!this.isRunning) {
      return true;
    }
    
    // 如果使用外部服务，不关闭
    if (this.useExternalService) {
      console.log('🍃 使用外部 MongoDB 服务，跳过关闭');
      this.isRunning = false;
      return true;
    }
    
    // 设置关闭标志，防止自动重启
    this.isShuttingDown = true;
    
    // 停止健康检查
    this._stopHealthCheck();
    
    console.log('🛑 停止 MongoDB 服务...');
    
    return new Promise((resolve) => {
      if (platform() === 'win32') {
        // Windows 下优雅关闭：使用 mongod --shutdown 或 admin 命令
        this._gracefulShutdown()
          .then(() => {
            this.isRunning = false;
            this.process = null;
            console.log('✅ MongoDB 服务已优雅停止');
            resolve(true);
          })
          .catch(() => {
            // 优雅关闭失败，强制终止
            console.warn('⚠️ 优雅关闭失败，使用强制终止...');
            exec('taskkill /F /IM mongod.exe', (err) => {
              if (err) {
                console.warn('⚠️ 停止 MongoDB 时出错:', err.message);
              }
              this.isRunning = false;
              this.process = null;
              console.log('✅ MongoDB 服务已停止（强制）');
              resolve(true);
            });
          });
      } else {
        // Linux/Mac 使用 SIGTERM 优雅关闭
        if (this.process && this.process.pid) {
          process.kill(this.process.pid, 'SIGTERM');
          this.isRunning = false;
          this.process = null;
          console.log('✅ MongoDB 服务已停止');
        }
        resolve(true);
      }
    });
  }

  /**
   * 优雅关闭 MongoDB（通过 admin 命令）
   */
  async _gracefulShutdown() {
    const client = new MongoClient(this.uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    
    try {
      await client.connect();
      const adminDb = client.db('admin');
      // 使用 shutdown 命令优雅关闭，force: false 等待操作完成
      await adminDb.command({ shutdown: 1, force: false });
    } finally {
      await client.close();
    }
  }

  /**
   * 检查 MongoDB 服务状态
   */
  async checkStatus() {
    return new Promise((resolve) => {
      const client = new MongoClient(this.uri, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000
      });
      
      client.connect()
        .then(() => {
          client.close();
          resolve(true);
        })
        .catch(() => {
          resolve(false);
        });
    });
  }

  /**
   * 获取服务信息
   */
  getInfo() {
    return {
      running: this.isRunning,
      uri: this.uri,
      dbName: this.config.dbName,
      port: this.config.port,
      host: this.config.host,
      dataDir: this.dataDir,
      logDir: this.logDir,
      startTime: this.startTime,
      restartAttempts: this.restartAttempts,
      useExternalService: this.useExternalService || false,
      useCloudDatabase: this.useCloudDatabase || false,
      portConflict: this.portConflict || false,
      needsAuth: this.needsAuth || false,
      portStatus: this.portStatus || null
    };
  }

  /**
   * 启动健康检查定时器
   */
  _startHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(async () => {
      if (this.isShuttingDown) {
        return;
      }
      
      const running = await this.checkStatus();
      if (!running && this.isRunning) {
        console.warn('⚠️ MongoDB 服务健康检查失败，进程可能已退出');
        this.isRunning = false;
        this._handleProcessExit(1, null);
      }
    }, this.config.healthCheckInterval);
    
    console.log(`🔄 健康检查已启动（间隔: ${this.config.healthCheckInterval}ms）`);
  }

  /**
   * 停止健康检查定时器
   */
  _stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * 处理进程退出
   */
  async _handleProcessExit(code, signal) {
    console.log(`📋 MongoDB 进程退出 (code: ${code}, signal: ${signal})`);
    this.isRunning = false;
    this._stopHealthCheck();
    
    // 如果是正常关闭，不重启
    if (this.isShuttingDown) {
      console.log('✅ MongoDB 正常关闭，不进行重启');
      return;
    }
    
    // 自动重启
    if (this.config.autoRestart && this.restartAttempts < this.config.maxRestartAttempts) {
      this.restartAttempts++;
      console.log(`🔄 尝试自动重启 MongoDB (${this.restartAttempts}/${this.config.maxRestartAttempts})...`);
      
      await new Promise(resolve => setTimeout(resolve, this.config.restartDelay));
      
      const restarted = await this.start();
      if (restarted) {
        console.log('✅ MongoDB 自动重启成功');
      } else {
        console.error('❌ MongoDB 自动重启失败');
      }
    } else if (this.restartAttempts >= this.config.maxRestartAttempts) {
      console.error(`❌ MongoDB 重启次数已达上限 (${this.config.maxRestartAttempts})，停止尝试`);
    }
  }
}

// 单例实例
let serviceInstance = null;

/**
 * 获取 MongoDB 服务单例
 */
export function getMongodService(config = {}) {
  if (!serviceInstance) {
    serviceInstance = new MongodService(config);
  }
  return serviceInstance;
}

export default MongodService;
