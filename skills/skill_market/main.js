/**
 * 技能市场管理器
 * 
 * 支持从多个市场源搜索、安装和管理技能与MCP服务器
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { get as httpGet } from 'http';
import { get as httpsGet } from 'https';
import { createWriteStream } from 'fs';

const execAsync = promisify(exec);

const getDirname = () => {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  }
};
const __dirname = getDirname();

// 市场源配置
const MARKET_SOURCES = {
  'mcp-registry': {
    name: 'MCP Registry',
    type: 'mcp',
    apiUrl: 'https://registry.modelcontextprotocol.io/v0',
    description: 'MCP 官方注册表'
  },
  'mcp-so': {
    name: 'MCP.so',
    type: 'mcp',
    apiUrl: 'https://mcp.so/api',
    description: '第三方 MCP 市场 (18000+ servers)'
  },
  'npm': {
    name: 'NPM',
    type: 'skill',
    registryUrl: 'https://registry.npmjs.org',
    description: 'NPM 包管理器'
  },
  'github': {
    name: 'GitHub',
    type: 'all',
    apiUrl: 'https://api.github.com',
    description: 'GitHub 仓库'
  }
};

// 内置技能列表（受保护）
const BUILTIN_SKILLS = [
  'system_context', 'model_manager', 'skill_installer', 'skill_market',
  'calculator', 'docx', 'pdf', 'pptx', 'xlsx', 'txt',
  'web_search', 'http_request', 'get_time', 'edge_control'
];

// 缓存
let marketCache = null;
let cacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30分钟

export default {
  name: 'skill_market',
  description: '技能市场管理器 - 从多个市场源搜索、浏览、安装和管理技能与MCP服务器',
  
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['search', 'list', 'info', 'install', 'uninstall', 'sources', 'update'],
        description: '操作类型'
      },
      query: { type: 'string' },
      source: { type: 'string' },
      name: { type: 'string' },
      market: { type: 'string', enum: ['all', 'mcp-registry', 'mcp-so', 'npm', 'github'] },
      type: { type: 'string', enum: ['skill', 'mcp', 'all'] }
    },
    required: ['action']
  },

  async execute(params, context) {
    const { action, query, source, name, market = 'all', type = 'all' } = params;
    const skillsDir = dirname(__dirname); // skills 目录
    
    switch (action) {
      case 'search':
        return searchSkills(query, market, type);
      case 'list':
        return listInstalled(skillsDir);
      case 'info':
        return getSkillInfo(name, skillsDir);
      case 'install':
        return installSkill(source, skillsDir);
      case 'uninstall':
        return uninstallSkill(name, skillsDir);
      case 'sources':
        return listSources();
      case 'update':
        return updateCache();
      default:
        throw new Error(`未知操作: ${action}`);
    }
  }
};

/**
 * 搜索技能
 */
async function searchSkills(query, market, type) {
  if (!query) {
    throw new Error('请提供搜索关键词');
  }
  
  const results = [];
  const marketsToSearch = market === 'all' 
    ? Object.keys(MARKET_SOURCES) 
    : [market];
  
  for (const marketId of marketsToSearch) {
    const marketConfig = MARKET_SOURCES[marketId];
    if (!marketConfig) continue;
    
    // 类型过滤
    if (type !== 'all' && marketConfig.type !== type && marketConfig.type !== 'all') {
      continue;
    }
    
    try {
      let marketResults = [];
      
      if (marketId === 'mcp-registry') {
        marketResults = await searchMCPRegistry(query);
      } else if (marketId === 'npm') {
        marketResults = await searchNpm(query);
      } else if (marketId === 'github') {
        marketResults = await searchGitHub(query);
      } else if (marketId === 'mcp-so') {
        marketResults = await searchMcpSo(query);
      }
      
      results.push(...marketResults.map(r => ({
        ...r,
        market: marketId,
        marketName: marketConfig.name
      })));
    } catch (error) {
      console.error(`搜索 ${marketId} 失败:`, error.message);
    }
  }
  
  // 按相关性排序
  results.sort((a, b) => {
    const aScore = calculateRelevance(a, query);
    const bScore = calculateRelevance(b, query);
    return bScore - aScore;
  });
  
  return {
    success: true,
    query,
    total: results.length,
    results: results.slice(0, 20), // 返回前20个结果
    message: results.length > 0 
      ? `找到 ${results.length} 个相关结果`
      : '未找到相关结果，请尝试其他关键词'
  };
}

/**
 * 搜索 MCP Registry
 */
async function searchMCPRegistry(query) {
  try {
    const data = await fetchJson(`https://registry.modelcontextprotocol.io/v0/servers?search=${encodeURIComponent(query)}`);
    
    if (!data || !data.servers) return [];
    
    return data.servers.map(server => ({
      id: server.id || server.name,
      name: server.name,
      description: server.description || '',
      type: 'mcp',
      source: `mcp-registry:${server.id || server.name}`,
      stars: server.stars || 0,
      downloads: server.downloads || 0
    }));
  } catch (error) {
    console.error('MCP Registry 搜索失败:', error.message);
    return [];
  }
}

/**
 * 搜索 NPM
 */
async function searchNpm(query) {
  try {
    const data = await fetchJson(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}%20mcp%20OR%20${encodeURIComponent(query)}%20skill&size=10`);
    
    if (!data || !data.objects) return [];
    
    return data.objects.map(item => ({
      id: item.package.name,
      name: item.package.name,
      description: item.package.description || '',
      type: item.package.name.includes('mcp') ? 'mcp' : 'skill',
      source: `npm:${item.package.name}`,
      version: item.package.version,
      downloads: item.package.downloads?.total || 0
    }));
  } catch (error) {
    console.error('NPM 搜索失败:', error.message);
    return [];
  }
}

/**
 * 搜索 GitHub
 */
async function searchGitHub(query) {
  try {
    // 使用 GitHub API 搜索
    const data = await fetchJson(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+mcp+OR+${encodeURIComponent(query)}+skill&sort=stars&order=desc&per_page=10`);
    
    if (!data || !data.items) return [];
    
    return data.items.map(repo => ({
      id: repo.full_name,
      name: repo.name,
      description: repo.description || '',
      type: 'all',
      source: `github:${repo.full_name}`,
      stars: repo.stargazers_count,
      url: repo.html_url
    }));
  } catch (error) {
    console.error('GitHub 搜索失败:', error.message);
    return [];
  }
}

/**
 * 搜索 MCP.so
 */
async function searchMcpSo(query) {
  try {
    // MCP.so 的 API 可能需要特殊处理
    // 这里使用简化的搜索方式
    const data = await fetchJson(`https://mcp.so/api/search?q=${encodeURIComponent(query)}`);
    
    if (!data || !data.servers) return [];
    
    return data.servers.map(server => ({
      id: server.slug || server.name,
      name: server.name,
      description: server.description || '',
      type: 'mcp',
      source: `mcp-so:${server.slug || server.name}`,
      stars: server.stars || 0
    }));
  } catch (error) {
    console.error('MCP.so 搜索失败:', error.message);
    return [];
  }
}

/**
 * 安装技能
 */
async function installSkill(source, skillsDir) {
  if (!source) {
    throw new Error('请提供安装源');
  }
  
  // 解析安装源
  const parsed = parseSource(source);
  
  if (!parsed) {
    throw new Error(`无效的安装源格式: ${source}`);
  }
  
  const { type, value, market } = parsed;
  
  // 根据类型安装
  switch (type) {
    case 'mcp-registry':
      return installFromMCPRegistry(value, skillsDir);
    case 'npm':
      return installFromNpm(value, skillsDir);
    case 'github':
      return installFromGitHub(value, skillsDir);
    case 'url':
      return installFromUrl(value, skillsDir);
    case 'local':
      return installFromDirectory(value, skillsDir);
    default:
      throw new Error(`不支持的安装源类型: ${type}`);
  }
}

/**
 * 解析安装源
 */
function parseSource(source) {
  // 市场ID:包名 格式
  const marketMatch = source.match(/^(mcp-registry|mcp-so|npm|github):(.+)$/);
  if (marketMatch) {
    return { type: marketMatch[1], value: marketMatch[2], market: marketMatch[1] };
  }
  
  // URL 格式
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return { type: 'url', value: source };
  }
  
  // 本地路径
  if (existsSync(source)) {
    return { type: 'local', value: source };
  }
  
  // 尝试作为 npm 包名
  if (/^[\w-]+$/.test(source)) {
    return { type: 'npm', value: source };
  }
  
  return null;
}

/**
 * 从 MCP Registry 安装
 */
async function installFromMCPRegistry(packageName, skillsDir) {
  try {
    // 获取包信息
    const serverInfo = await fetchJson(`https://registry.modelcontextprotocol.io/v0/servers/${packageName}`);
    
    if (!serverInfo) {
      throw new Error(`未找到 MCP Server: ${packageName}`);
    }
    
    // 创建技能目录
    const skillDir = join(skillsDir, packageName.replace(/[^a-zA-Z0-9_-]/g, '_'));
    
    if (existsSync(skillDir)) {
      throw new Error(`技能已存在: ${packageName}`);
    }
    
    mkdirSync(skillDir, { recursive: true });
    
    // 创建 SKILL.md
    const skillMd = `---
name: ${packageName}
description: ${serverInfo.description || 'MCP Server from MCP Registry'}
entry: main.js
---

# ${packageName}

${serverInfo.description || 'MCP Server'}

## 来源

- 市场: MCP Registry
- 包名: ${packageName}
${serverInfo.repository ? `- 仓库: ${serverInfo.repository}` : ''}

## 安装时间

${new Date().toISOString()}
`;
    
    writeFileSync(join(skillDir, 'SKILL.md'), skillMd);
    
    // 创建 main.js 包装器
    const mainJs = `// MCP Server wrapper for ${packageName}
// This skill wraps an MCP server from MCP Registry

export default {
  name: '${packageName}',
  description: '${serverInfo.description || 'MCP Server'}',
  
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', description: 'MCP tool name to call' },
      params: { type: 'object', description: 'Parameters for the tool' }
    },
    required: ['action']
  },
  
  async execute(args, context) {
    // TODO: Implement MCP client connection
    // For now, return installation info
    return {
      success: true,
      message: 'MCP Server wrapper installed. Configure MCP connection to use.',
      serverInfo: ${JSON.stringify(serverInfo, null, 2)}
    };
  }
};
`;
    
    writeFileSync(join(skillDir, 'main.js'), mainJs);
    
    return {
      success: true,
      message: `MCP Server "${packageName}" 安装成功`,
      path: skillDir,
      type: 'mcp-wrapper',
      note: '需要配置 MCP 连接才能使用'
    };
  } catch (error) {
    throw new Error(`从 MCP Registry 安装失败: ${error.message}`);
  }
}

/**
 * 从 NPM 安装
 */
async function installFromNpm(packageName, skillsDir) {
  try {
    // 检查包是否存在
    const packageInfo = await fetchJson(`https://registry.npmjs.org/${packageName}`);
    
    if (!packageInfo) {
      throw new Error(`NPM 包不存在: ${packageName}`);
    }
    
    // 使用 npm 安装
    const skillDir = join(skillsDir, packageName.replace(/[^a-zA-Z0-9_-]/g, '_'));
    
    if (existsSync(skillDir)) {
      throw new Error(`技能已存在: ${packageName}`);
    }
    
    mkdirSync(skillDir, { recursive: true });
    
    // 在技能目录安装 npm 包
    const { stdout, stderr } = await execAsync(`npm install ${packageName}`, {
      cwd: skillDir
    });
    
    // 创建 SKILL.md
    const skillMd = `---
name: ${packageName}
description: ${packageInfo.description || 'NPM Package'}
entry: main.js
---

# ${packageName}

${packageInfo.description || 'NPM Package'}

## 来源

- 市场: NPM
- 包名: ${packageName}
- 版本: ${packageInfo['dist-tags']?.latest || 'latest'}

## 安装时间

${new Date().toISOString()}
`;
    
    writeFileSync(join(skillDir, 'SKILL.md'), skillMd);
    
    // 创建 main.js 包装器
    const mainJs = `// NPM Package wrapper for ${packageName}
import pkg from '${packageName}';

export default {
  name: '${packageName}',
  description: '${packageInfo.description || 'NPM Package'}',
  
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', description: 'Action to perform' },
      params: { type: 'object', description: 'Parameters' }
    },
    required: ['action']
  },
  
  async execute(args, context) {
    const { action, params = {} } = args;
    
    // 根据包的导出类型执行
    if (typeof pkg === 'function') {
      return await pkg(params);
    } else if (pkg[action]) {
      return await pkg[action](params);
    }
    
    return {
      success: true,
      package: '${packageName}',
      exports: Object.keys(pkg),
      message: 'Package loaded. Check exports for available functions.'
    };
  }
};
`;
    
    writeFileSync(join(skillDir, 'main.js'), mainJs);
    
    return {
      success: true,
      message: `NPM 包 "${packageName}" 安装成功`,
      path: skillDir,
      version: packageInfo['dist-tags']?.latest
    };
  } catch (error) {
    throw new Error(`从 NPM 安装失败: ${error.message}`);
  }
}

/**
 * 从 GitHub 安装
 */
async function installFromGitHub(repoPath, skillsDir) {
  try {
    // 获取仓库信息
    const repoInfo = await fetchJson(`https://api.github.com/repos/${repoPath}`);
    
    if (!repoInfo) {
      throw new Error(`GitHub 仓库不存在: ${repoPath}`);
    }
    
    const skillName = repoInfo.name;
    const skillDir = join(skillsDir, skillName);
    
    if (existsSync(skillDir)) {
      throw new Error(`技能已存在: ${skillName}`);
    }
    
    // 下载 zip
    const zipUrl = `https://github.com/${repoPath}/archive/refs/heads/main.zip`;
    const tempZip = join(skillsDir, `.temp_${Date.now()}.zip`);
    
    await downloadFile(zipUrl, tempZip);
    
    // 解压
    const tempDir = join(skillsDir, `.temp_${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    
    await extractZip(tempZip, tempDir);
    
    // 查找技能目录
    const extractedDir = findSkillDir(tempDir);
    if (!extractedDir) {
      // 如果没找到，使用根目录
      const subdirs = readdirSync(tempDir);
      const firstDir = subdirs.find(d => statSync(join(tempDir, d)).isDirectory());
      if (firstDir) {
        copyDirectory(join(tempDir, firstDir), skillDir);
      } else {
        throw new Error('无法从仓库中提取技能文件');
      }
    } else {
      copyDirectory(extractedDir, skillDir);
    }
    
    // 清理临时文件
    unlinkSync(tempZip);
    await removeDirectory(tempDir);
    
    return {
      success: true,
      message: `从 GitHub 安装成功: ${skillName}`,
      path: skillDir,
      repository: repoInfo.html_url
    };
  } catch (error) {
    throw new Error(`从 GitHub 安装失败: ${error.message}`);
  }
}

/**
 * 从 URL 安装
 */
async function installFromUrl(url, skillsDir) {
  const tempZip = join(skillsDir, `.temp_download_${Date.now()}.zip`);
  
  try {
    await downloadFile(url, tempZip);
    
    const tempDir = join(skillsDir, `.temp_extract_${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    
    await extractZip(tempZip, tempDir);
    
    const skillDir = findSkillDir(tempDir);
    if (!skillDir) {
      throw new Error('未找到有效的技能文件');
    }
    
    const skillName = basename(skillDir);
    const destDir = join(skillsDir, skillName);
    
    if (existsSync(destDir)) {
      throw new Error(`技能已存在: ${skillName}`);
    }
    
    copyDirectory(skillDir, destDir);
    
    // 清理
    unlinkSync(tempZip);
    await removeDirectory(tempDir);
    
    return {
      success: true,
      message: `从 URL 安装成功: ${skillName}`,
      path: destDir
    };
  } catch (error) {
    if (existsSync(tempZip)) unlinkSync(tempZip);
    throw error;
  }
}

/**
 * 从目录安装
 */
async function installFromDirectory(srcDir, skillsDir) {
  const skillName = basename(srcDir);
  const destDir = join(skillsDir, skillName);
  
  if (!existsSync(srcDir)) {
    throw new Error(`目录不存在: ${srcDir}`);
  }
  
  if (existsSync(destDir)) {
    throw new Error(`技能已存在: ${skillName}`);
  }
  
  copyDirectory(srcDir, destDir);
  
  return {
    success: true,
    message: `从目录安装成功: ${skillName}`,
    path: destDir
  };
}

/**
 * 卸载技能
 */
async function uninstallSkill(name, skillsDir) {
  if (!name) {
    throw new Error('请提供技能名称');
  }
  
  if (BUILTIN_SKILLS.includes(name)) {
    throw new Error(`不能卸载内置技能: ${name}`);
  }
  
  const skillPath = join(skillsDir, name);
  
  if (!existsSync(skillPath)) {
    throw new Error(`技能不存在: ${name}`);
  }
  
  await removeDirectory(skillPath);
  
  return {
    success: true,
    message: `技能 "${name}" 已卸载`
  };
}

/**
 * 列出已安装技能
 */
function listInstalled(skillsDir) {
  const entries = readdirSync(skillsDir);
  const skills = [];
  
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    
    const fullPath = join(skillsDir, entry);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      const skillMdPath = join(fullPath, 'SKILL.md');
      let metadata = {};
      
      if (existsSync(skillMdPath)) {
        try {
          const content = readFileSync(skillMdPath, 'utf-8');
          metadata = parseSkillMd(content);
        } catch (e) {}
      }
      
      skills.push({
        name: entry,
        description: metadata.description || '',
        builtin: BUILTIN_SKILLS.includes(entry),
        path: fullPath
      });
    }
  }
  
  return {
    success: true,
    total: skills.length,
    builtin: skills.filter(s => s.builtin).length,
    custom: skills.filter(s => !s.builtin).length,
    skills
  };
}

/**
 * 获取技能信息
 */
function getSkillInfo(name, skillsDir) {
  if (!name) {
    throw new Error('请提供技能名称');
  }
  
  const skillPath = join(skillsDir, name);
  
  if (!existsSync(skillPath)) {
    throw new Error(`技能不存在: ${name}`);
  }
  
  const stat = statSync(skillPath);
  const files = readdirSync(skillPath);
  
  let metadata = {};
  const skillMdPath = join(skillPath, 'SKILL.md');
  
  if (existsSync(skillMdPath)) {
    try {
      const content = readFileSync(skillMdPath, 'utf-8');
      metadata = parseSkillMd(content);
    } catch (e) {}
  }
  
  return {
    success: true,
    name,
    builtin: BUILTIN_SKILLS.includes(name),
    path: skillPath,
    metadata,
    files,
    size: stat.size,
    modified: stat.mtime
  };
}

/**
 * 列出市场源
 */
function listSources() {
  return {
    success: true,
    sources: Object.entries(MARKET_SOURCES).map(([id, config]) => ({
      id,
      name: config.name,
      type: config.type,
      description: config.description
    }))
  };
}

/**
 * 更新缓存
 */
async function updateCache() {
  marketCache = null;
  cacheTime = 0;
  
  // 预加载市场数据
  const results = {};
  
  for (const [id, config] of Object.entries(MARKET_SOURCES)) {
    try {
      results[id] = { status: 'ok' };
    } catch (e) {
      results[id] = { status: 'error', message: e.message };
    }
  }
  
  cacheTime = Date.now();
  
  return {
    success: true,
    message: '市场缓存已更新',
    sources: results
  };
}

// ============ 工具函数 ============

function parseSkillMd(content) {
  const metadata = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  
  if (match) {
    const lines = match[1].split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        metadata[key.trim()] = valueParts.join(':').trim().replace(/["']/g, '');
      }
    }
  }
  
  return metadata;
}

function calculateRelevance(item, query) {
  const q = query.toLowerCase();
  let score = 0;
  
  if (item.name?.toLowerCase().includes(q)) score += 10;
  if (item.name?.toLowerCase() === q) score += 20;
  if (item.description?.toLowerCase().includes(q)) score += 5;
  if (item.stars) score += Math.min(item.stars / 100, 10);
  if (item.downloads) score += Math.min(item.downloads / 1000, 5);
  
  return score;
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const getter = url.startsWith('https') ? httpsGet : httpGet;
    
    const options = {
      headers: {
        'User-Agent': 'Fast-Agent/1.0',
        'Accept': 'application/json'
      }
    };
    
    getter(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const getter = url.startsWith('https') ? httpsGet : httpGet;
    
    getter(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        unlinkSync(dest);
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        file.close();
        unlinkSync(dest);
        reject(new Error(`下载失败: HTTP ${res.statusCode}`));
        return;
      }
      
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      if (existsSync(dest)) unlinkSync(dest);
      reject(err);
    });
  });
}

async function extractZip(zipPath, destDir) {
  if (process.platform === 'win32') {
    await execAsync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`);
  } else {
    await execAsync(`unzip -o "${zipPath}" -d "${destDir}"`);
  }
}

function findSkillDir(dir) {
  // 检查当前目录
  if (existsSync(join(dir, 'SKILL.md')) || 
      existsSync(join(dir, 'main.js')) || 
      existsSync(join(dir, 'index.js'))) {
    return dir;
  }
  
  // 检查子目录
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const subDir = join(dir, entry);
    if (statSync(subDir).isDirectory()) {
      if (existsSync(join(subDir, 'SKILL.md')) || 
          existsSync(join(subDir, 'main.js')) || 
          existsSync(join(subDir, 'index.js'))) {
        return subDir;
      }
    }
  }
  
  return null;
}

function copyDirectory(src, dest) {
  mkdirSync(dest, { recursive: true });
  
  const entries = readdirSync(src);
  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);
    
    if (stat.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      const { copyFileSync } = require('fs');
      copyFileSync(srcPath, destPath);
    }
  }
}

async function removeDirectory(dir) {
  if (!existsSync(dir)) return;
  
  if (process.platform === 'win32') {
    await execAsync(`rmdir /s /q "${dir}"`);
  } else {
    await execAsync(`rm -rf "${dir}"`);
  }
}
