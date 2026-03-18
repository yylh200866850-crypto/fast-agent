#!/usr/bin/env node
/**
 * mongod 资源打包脚本
 * 
 * 功能：
 * 1. 计算各平台 mongod 文件的 SHA256
 * 2. 更新 mongod-resources.json
 * 3. 打包成 zip 文件供上传到 OSS
 * 
 * 用法：
 *   node scripts/pack_mongod.mjs
 */

import { createHash } from 'crypto';
import { createReadStream, existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const mongodDir = join(rootDir, 'mongod');

// 平台配置
const PLATFORMS = [
  { key: 'win32-x64', file: 'mongod.win', execName: 'mongod.exe' },
  { key: 'darwin-x64', file: 'mongod.mac_x86', execName: 'mongod' },
  { key: 'darwin-arm64', file: 'mongod.mac_arm64', execName: 'mongod' },
  { key: 'linux-x64', file: 'mongod.linux', execName: 'mongod' }
];

// 计算文件 SHA256
async function calculateSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// 获取文件大小
function getFileSize(filePath) {
  try {
    const stats = statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

// 格式化文件大小
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  console.log('📦 mongod 资源打包工具\n');
  console.log('=' .repeat(50));
  
  // 检查 mongod 目录
  if (!existsSync(mongodDir)) {
    console.error('❌ mongod 目录不存在:', mongodDir);
    process.exit(1);
  }
  
  // 读取现有配置
  const configPath = join(mongodDir, 'mongod-resources.json');
  let config = {
    version: '7.0.4',
    description: 'MongoDB mongod binaries for Fast-Agent',
    baseUrl: 'https://your-oss-bucket.oss-cn-hangzhou.aliyuncs.com/fast-agent/mongod',
    platforms: {},
    downloadUrl: {}
  };
  
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch (e) {
      console.warn('⚠️ 读取现有配置失败，将创建新配置');
    }
  }
  
  console.log('\n📋 扫描 mongod 文件...\n');
  
  // 扫描并更新各平台信息
  for (const platform of PLATFORMS) {
    const filePath = join(mongodDir, platform.file);
    console.log(`🔍 ${platform.key} (${platform.file})`);
    
    if (existsSync(filePath)) {
      const size = getFileSize(filePath);
      const sha256 = await calculateSha256(filePath);
      
      config.platforms[platform.key] = {
        file: platform.file,
        execName: platform.execName,
        size: size,
        sha256: sha256,
        note: getNote(platform.key)
      };
      
      config.downloadUrl[platform.key] = `${config.baseUrl}/${platform.file}`;
      
      console.log(`   大小: ${formatSize(size)}`);
      console.log(`   SHA256: ${sha256.substring(0, 16)}...`);
      console.log(`   ✅ 已更新\n`);
    } else {
      console.log(`   ⚠️ 文件不存在\n`);
      
      // 保留现有配置或设置默认值
      if (!config.platforms[platform.key]) {
        config.platforms[platform.key] = {
          file: platform.file,
          execName: platform.execName,
          size: 0,
          sha256: '',
          note: getNote(platform.key)
        };
      }
    }
  }
  
  // 保存配置
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('✅ 配置已保存:', configPath);
  
  // 打包
  console.log('\n📦 打包文件...\n');
  
  const outputDir = join(rootDir, 'release', 'mongod-package');
  const outputFile = join(outputDir, 'mongod-all-platforms.zip');
  
  // 创建输出目录
  if (!existsSync(outputDir)) {
    execSync(`mkdir -p "${outputDir}"`, { shell: true });
  }
  
  // 收集存在的文件
  const filesToPack = [];
  for (const platform of PLATFORMS) {
    const filePath = join(mongodDir, platform.file);
    if (existsSync(filePath)) {
      filesToPack.push(platform.file);
    }
  }
  
  // 添加配置文件
  filesToPack.push('mongod-resources.json');
  
  if (filesToPack.length === 1) {
    console.log('⚠️ 没有找到 mongod 文件，只打包配置文件');
  }
  
  // 使用 PowerShell 打包 (Windows)
  if (process.platform === 'win32') {
    const filesArg = filesToPack.map(f => `"${f}"`).join(', ');
    const psCmd = `Compress-Archive -Path ${filesArg} -DestinationPath "${outputFile}" -Force`;
    try {
      execSync(`powershell -Command "cd '${mongodDir}'; ${psCmd}"`, { stdio: 'inherit' });
      console.log(`\n✅ 打包完成: ${outputFile}`);
    } catch (e) {
      console.error('❌ 打包失败:', e.message);
    }
  } else {
    // 使用 zip 命令 (Unix)
    try {
      execSync(`cd "${mongodDir}" && zip -r "${outputFile}" ${filesToPack.join(' ')}`, { stdio: 'inherit' });
      console.log(`\n✅ 打包完成: ${outputFile}`);
    } catch (e) {
      console.error('❌ 打包失败:', e.message);
    }
  }
  
  // 显示上传提示
  console.log('\n' + '='.repeat(50));
  console.log('📤 上传提示:\n');
  console.log('1. 将以下文件上传到 OSS:');
  console.log(`   - ${outputFile}`);
  console.log('   ');
  console.log('2. 或分别上传各平台文件:');
  for (const platform of PLATFORMS) {
    const filePath = join(mongodDir, platform.file);
    if (existsSync(filePath)) {
      console.log(`   - mongod/${platform.file}`);
    }
  }
  console.log('   ');
  console.log('3. 更新 mongod-resources.json 中的 baseUrl 为实际 OSS 地址');
  console.log('   ');
  console.log('4. OSS 目录结构:');
  console.log('   your-bucket/fast-agent/mongod/');
  console.log('   ├── mongod.win');
  console.log('   ├── mongod.mac_x86');
  console.log('   ├── mongod.mac_arm64');
  console.log('   └── mongod.linux');
  console.log('\n' + '='.repeat(50));
  
  // 显示配置摘要
  console.log('\n📋 配置摘要:\n');
  console.log(JSON.stringify(config, null, 2));
}

function getNote(platformKey) {
  const notes = {
    'win32-x64': 'Windows x64',
    'darwin-x64': 'macOS Intel (x86_64)',
    'darwin-arm64': 'macOS Apple Silicon (ARM64)',
    'linux-x64': 'Linux x64'
  };
  return notes[platformKey] || platformKey;
}

main().catch(console.error);
