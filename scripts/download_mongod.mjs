#!/usr/bin/env node
/**
 * mongod 下载脚本
 * 
 * 从 OSS 下载 mongod 二进制文件
 * 
 * 用法：
 *   node scripts/download_mongod.mjs              # 下载当前平台
 *   node scripts/download_mongod.mjs --all        # 下载所有平台
 *   node scripts/download_mongod.mjs --platform win32-x64
 */

import { createHash } from 'crypto';
import { createWriteStream, createReadStream, existsSync, readFileSync, renameSync, unlinkSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { platform, arch } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const mongodDir = join(rootDir, 'mongod');

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
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// 格式化文件大小
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// 下载文件
async function downloadFile(url, destPath, expectedSize) {
  const https = await import('https');
  const http = await import('http');
  const client = url.startsWith('https') ? https : http;
  
  return new Promise((resolve, reject) => {
    const tempPath = destPath + '.downloading';
    const file = createWriteStream(tempPath);
    let downloadedBytes = 0;
    let lastPercent = 0;
    
    const request = client.get(url, (response) => {
      // 跟随重定向
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        unlinkSync(tempPath);
        downloadFile(response.headers.location, destPath, expectedSize).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        unlinkSync(tempPath);
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      const totalBytes = parseInt(response.headers['content-length'], 10) || expectedSize;
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const percent = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
        if (percent - lastPercent >= 5 || percent === 100) {
          process.stdout.write(`\r   下载进度: ${percent}% (${formatSize(downloadedBytes)}/${formatSize(totalBytes)})`);
          lastPercent = percent;
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(''); // 换行
        renameSync(tempPath, destPath);
        resolve(destPath);
      });
    });
    
    request.on('error', (err) => {
      file.close();
      try { unlinkSync(tempPath); } catch {}
      reject(err);
    });
    
    request.setTimeout(600000, () => { // 10分钟超时
      request.destroy();
      reject(new Error('下载超时'));
    });
  });
}

// 下载指定平台的 mongod
async function downloadMongod(platformKey, config) {
  const platformInfo = config.platforms[platformKey];
  const downloadUrl = config.downloadUrl[platformKey];
  
  if (!platformInfo || !downloadUrl) {
    console.error(`❌ 未知平台: ${platformKey}`);
    return false;
  }
  
  const destPath = join(mongodDir, platformInfo.file);
  
  console.log(`\n📦 下载 ${platformKey} (${platformInfo.note})`);
  console.log(`   文件: ${platformInfo.file}`);
  console.log(`   大小: ${formatSize(platformInfo.size)}`);
  console.log(`   URL: ${downloadUrl}`);
  
  // 检查是否已存在
  if (existsSync(destPath)) {
    console.log('   文件已存在，验证 SHA256...');
    const sha256 = await calculateSha256(destPath);
    if (sha256 === platformInfo.sha256) {
      console.log('   ✅ 文件完整，跳过下载');
      return true;
    } else {
      console.log('   ⚠️ 文件损坏，重新下载...');
      unlinkSync(destPath);
    }
  }
  
  // 下载
  try {
    await downloadFile(downloadUrl, destPath, platformInfo.size);
    
    // 验证 SHA256
    console.log('   验证 SHA256...');
    const sha256 = await calculateSha256(destPath);
    if (sha256 !== platformInfo.sha256) {
      console.error(`   ❌ SHA256 不匹配!`);
      console.error(`   期望: ${platformInfo.sha256}`);
      console.error(`   实际: ${sha256}`);
      return false;
    }
    
    console.log('   ✅ 下载完成，SHA256 验证通过');
    return true;
  } catch (e) {
    console.error(`   ❌ 下载失败: ${e.message}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const downloadAll = args.includes('--all');
  const platformArg = args.find(a => a.startsWith('--platform'));
  const specificPlatform = platformArg ? platformArg.split('=')[1] || args[args.indexOf(platformArg) + 1] : null;
  
  console.log('📥 mongod 下载工具\n');
  console.log('='.repeat(50));
  
  // 加载配置
  const configPath = join(mongodDir, 'mongod-resources.json');
  if (!existsSync(configPath)) {
    console.error('❌ 配置文件不存在:', configPath);
    process.exit(1);
  }
  
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  console.log(`配置版本: ${config.version}`);
  console.log(`OSS 地址: ${config.baseUrl}`);
  
  // 确保目录存在
  if (!existsSync(mongodDir)) {
    const { mkdirSync } = await import('fs');
    mkdirSync(mongodDir, { recursive: true });
  }
  
  let success = 0;
  let failed = 0;
  
  if (downloadAll) {
    // 下载所有平台
    console.log('\n📋 下载所有平台...\n');
    for (const platformKey of Object.keys(config.platforms)) {
      if (await downloadMongod(platformKey, config)) {
        success++;
      } else {
        failed++;
      }
    }
  } else if (specificPlatform) {
    // 下载指定平台
    if (await downloadMongod(specificPlatform, config)) {
      success++;
    } else {
      failed++;
    }
  } else {
    // 下载当前平台
    const currentPlatform = getPlatformKey();
    if (!currentPlatform) {
      console.error('❌ 不支持的平台:', platform(), arch());
      process.exit(1);
    }
    console.log(`\n当前平台: ${currentPlatform}`);
    
    if (await downloadMongod(currentPlatform, config)) {
      success++;
    } else {
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 下载完成: 成功 ${success}, 失败 ${failed}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
