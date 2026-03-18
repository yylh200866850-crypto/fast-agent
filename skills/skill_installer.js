// Skill 安装器 - 支持从目录、zip文件、URL 安装新 skill
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, createWriteStream, unlinkSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { get as httpGet } from 'http';
import { get as httpsGet } from 'https';

const execAsync = promisify(exec);
// 兼容 ES Module 和 CommonJS 环境
const getDirname = () => {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  }
};
const __dirname = getDirname();

// Skill 安装器
export default {
  name: 'skill_installer',
  description: '安装新的 Skill 到引擎中。支持从本地目录、zip 文件或 URL 安装',
  
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['install', 'uninstall', 'list', 'info'],
        description: '操作类型: install=安装, uninstall=卸载, list=列出已安装, info=查看skill信息'
      },
      source: {
        type: 'string',
        description: 'install时: 安装源路径 (本地目录、zip文件路径或URL)'
      },
      name: {
        type: 'string',
        description: 'uninstall/info时: skill名称'
      }
    },
    required: ['action']
  },

  execute: async (args, context) => {
    const { action, source, name } = args;
    // skill_installer.js 在 skills 目录下，所以 __dirname 就是 skills 目录
    const skillsDir = __dirname;
    
    switch (action) {
      case 'install':
        return installSkill(source, skillsDir);
      case 'uninstall':
        return uninstallSkill(name, skillsDir);
      case 'list':
        return listSkills(skillsDir);
      case 'info':
        return getSkillInfo(name, skillsDir);
      default:
        throw new Error(`未知操作: ${action}`);
    }
  }
};

/**
 * 安装 Skill
 */
async function installSkill(source, skillsDir) {
  if (!source) {
    throw new Error('请提供安装源 (source)');
  }

  // 判断安装源类型
  if (source.startsWith('http://') || source.startsWith('https://')) {
    // URL 下载安装
    return installFromUrl(source, skillsDir);
  } else if (source.endsWith('.zip')) {
    // zip 文件安装
    return installFromZip(source, skillsDir);
  } else if (existsSync(source) && statSync(source).isDirectory()) {
    // 目录安装
    return installFromDirectory(source, skillsDir);
  } else {
    throw new Error(`无效的安装源: ${source}`);
  }
}

/**
 * 从目录安装
 */
async function installFromDirectory(srcDir, skillsDir) {
  const skillName = basename(srcDir);
  const destDir = join(skillsDir, skillName);
  
  // 验证是否为有效 skill
  const validation = validateSkillDir(srcDir);
  if (!validation.valid) {
    throw new Error(`无效的 Skill: ${validation.error}`);
  }
  
  // 检查是否已存在
  if (existsSync(destDir)) {
    throw new Error(`Skill 已存在: ${skillName}，请先卸载`);
  }
  
  // 复制目录
  copyDirectory(srcDir, destDir);
  
  return {
    success: true,
    message: `Skill "${skillName}" 安装成功`,
    type: validation.type,
    path: destDir
  };
}

/**
 * 从 zip 文件安装
 */
async function installFromZip(zipPath, skillsDir) {
  if (!existsSync(zipPath)) {
    throw new Error(`文件不存在: ${zipPath}`);
  }
  
  // 创建临时目录
  const tempDir = join(skillsDir, '.temp_install_' + Date.now());
  mkdirSync(tempDir, { recursive: true });
  
  try {
    // 解压 zip
    await extractZip(zipPath, tempDir);
    
    // 查找 skill 目录 (可能在子目录中)
    const skillDir = findSkillDir(tempDir);
    if (!skillDir) {
      throw new Error('zip 中未找到有效的 Skill');
    }
    
    // 安装
    const result = await installFromDirectory(skillDir, skillsDir);
    
    // 清理临时目录
    await removeDirectory(tempDir);
    
    return result;
  } catch (e) {
    // 清理临时目录
    await removeDirectory(tempDir);
    throw e;
  }
}

/**
 * 从 URL 下载安装
 */
async function installFromUrl(url, skillsDir) {
  // 创建临时文件
  const tempZip = join(skillsDir, '.temp_download_' + Date.now() + '.zip');
  
  try {
    // 下载文件
    await downloadFile(url, tempZip);
    
    // 从 zip 安装
    const result = await installFromZip(tempZip, skillsDir);
    
    // 删除临时文件
    if (existsSync(tempZip)) {
      unlinkSync(tempZip);
    }
    
    return result;
  } catch (e) {
    // 清理
    if (existsSync(tempZip)) {
      unlinkSync(tempZip);
    }
    throw e;
  }
}

/**
 * 卸载 Skill
 */
async function uninstallSkill(name, skillsDir) {
  if (!name) {
    throw new Error('请提供 Skill 名称');
  }
  
  const skillPath = join(skillsDir, name);
  
  // 保护内置 skill
  const builtins = ['bin'];
  if (builtins.includes(name)) {
    throw new Error(`不能卸载内置组件: ${name}`);
  }
  
  if (!existsSync(skillPath)) {
    throw new Error(`Skill 不存在: ${name}`);
  }
  
  // 删除目录
  await removeDirectory(skillPath);
  
  return {
    success: true,
    message: `Skill "${name}" 已卸载`
  };
}

/**
 * 列出已安装的 Skills
 */
function listSkills(skillsDir) {
  const entries = readdirSync(skillsDir);
  const skills = [];
  
  for (const entry of entries) {
    // 跳过特殊目录
    if (entry.startsWith('.') || entry === 'bin') {
      continue;
    }
    
    const fullPath = join(skillsDir, entry);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      const validation = validateSkillDir(fullPath);
      skills.push({
        name: entry,
        type: validation.type || 'unknown',
        valid: validation.valid
      });
    } else if (entry.endsWith('.js')) {
      skills.push({
        name: entry.replace(/\.js$/, ''),
        type: 'js-file',
        valid: true
      });
    }
  }
  
  return { skills, total: skills.length };
}

/**
 * 获取 Skill 信息
 */
function getSkillInfo(name, skillsDir) {
  if (!name) {
    throw new Error('请提供 Skill 名称');
  }
  
  // 检查目录形式
  const dirPath = join(skillsDir, name);
  if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
    const validation = validateSkillDir(dirPath);
    const files = readdirSync(dirPath);
    
    return {
      name,
      type: validation.type,
      valid: validation.valid,
      files: files.slice(0, 20), // 最多显示20个文件
      path: dirPath
    };
  }
  
  // 检查单文件形式
  const jsPath = join(skillsDir, name + '.js');
  if (existsSync(jsPath)) {
    return {
      name,
      type: 'js-file',
      valid: true,
      path: jsPath
    };
  }
  
  throw new Error(`Skill 不存在: ${name}`);
}

/**
 * 验证目录是否为有效 Skill
 */
function validateSkillDir(dir) {
  // 检查 SKILL.md (文档型)
  if (existsSync(join(dir, 'SKILL.md'))) {
    return { valid: true, type: 'doc' };
  }
  
  // 检查 index.js / main.js (JS模块)
  if (existsSync(join(dir, 'index.js')) || existsSync(join(dir, 'main.js'))) {
    return { valid: true, type: 'js-module' };
  }
  
  // 检查是否有 md 文件
  const files = readdirSync(dir);
  if (files.some(f => f.endsWith('.md'))) {
    return { valid: true, type: 'pure-doc' };
  }
  
  return { valid: false, error: '目录中没有可识别的 Skill 文件' };
}

/**
 * 递归复制目录
 */
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
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 递归删除目录
 */
async function removeDirectory(dir) {
  if (!existsSync(dir)) return;
  
  // 使用系统命令删除 (更可靠)
  if (process.platform === 'win32') {
    await execAsync(`rmdir /s /q "${dir}"`);
  } else {
    await execAsync(`rm -rf "${dir}"`);
  }
}

/**
 * 解压 zip 文件
 */
async function extractZip(zipPath, destDir) {
  // 使用系统命令解压
  if (process.platform === 'win32') {
    // Windows PowerShell
    await execAsync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`);
  } else {
    // Unix
    await execAsync(`unzip -o "${zipPath}" -d "${destDir}"`);
  }
}

/**
 * 在目录中查找 skill 目录
 */
function findSkillDir(dir) {
  // 先检查当前目录是否为有效 skill
  const validation = validateSkillDir(dir);
  if (validation.valid) {
    return dir;
  }
  
  // 检查子目录
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const subDir = join(dir, entry);
    if (statSync(subDir).isDirectory()) {
      const subValidation = validateSkillDir(subDir);
      if (subValidation.valid) {
        return subDir;
      }
    }
  }
  
  return null;
}

/**
 * 下载文件
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const getter = url.startsWith('https') ? httpsGet : httpGet;
    
    getter(url, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        unlinkSync(dest);
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        unlinkSync(dest);
        reject(new Error(`下载失败: HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
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
