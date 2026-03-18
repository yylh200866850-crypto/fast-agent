import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, cpSync, existsSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import sharp from 'sharp';
import { platform, arch } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');
const releaseDir = join(rootDir, 'release');

// 确保目录存在
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// 清理目录
function cleanDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true });
  }
  ensureDir(dir);
}

// 获取所有依赖包名
function getDependencies() {
  const pkgJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
  return Object.keys(pkgJson.dependencies || {});
}

// 构建配置 - 打包所有代码和依赖
const createBuildOptions = (entryPoint, outfile) => ({
  entryPoints: [entryPoint],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: outfile,
  banner: {
    js: `#!/usr/bin/env node
// Bundled with esbuild

// Preserve __dirname and __filename for pkg
if (typeof __dirname === 'undefined') {
  try {
    global.__dirname = require('path').dirname(require('url').fileURLToPath(require('url').pathToFileURL(__filename).href));
  } catch (e) {
    global.__dirname = process.cwd();
  }
}
if (typeof __filename === 'undefined') {
  try {
    global.__filename = require('url').fileURLToPath(require('url').pathToFileURL(__filename).href);
  } catch (e) {}
}
`
  },
  // 排除原生模块
  external: [
    'fsevents',
    'cpu-features',
    'bcrypt',
    'ursa',
    'sharp',
    'better-sqlite3',
    '@mongodb-js/zstd',
    '@aws-sdk/credential-providers',
    'gcp-metadata',
    'snappy',
    'kerberos',
    'saslprep',
  ],
  sourcemap: false,
  minify: false,
  // 不使用 define，改用 banner 插入 polyfill
  // 解决某些包的 ESM/CJS 兼容问题
  mainFields: ['module', 'main'],
  conditions: ['node', 'require'],
});

async function build() {
  console.log('🔨 开始构建...\n');

  // 清理并创建目录
  cleanDir(distDir);
  ensureDir(releaseDir);

  // 1. 打包主入口文件 (index.js)
  console.log('📦 打包 index.js...');
  await esbuild.build(createBuildOptions(
    join(rootDir, 'index.js'),
    join(distDir, 'index.cjs')
  ));
  console.log('✅ index.js 打包完成\n');

  // 2. 打包交互式入口 (interactive.js)
  console.log('📦 打包 interactive.js...');
  await esbuild.build(createBuildOptions(
    join(rootDir, 'interactive.js'),
    join(distDir, 'interactive.cjs')
  ));
  console.log('✅ interactive.js 打包完成\n');

  // 3. 打包 Web 服务器入口 (web_server.js)
  console.log('📦 打包 web_server.js...');
  await esbuild.build(createBuildOptions(
    join(rootDir, 'web_server.js'),
    join(distDir, 'web_server.cjs')
  ));
  console.log('✅ web_server.js 打包完成\n');

  // 4. 复制资源文件
  console.log('📋 复制资源文件...');
  
  // 复制 skills 目录
  cpSync(join(rootDir, 'skills'), join(distDir, 'skills'), { recursive: true });
  
  // 复制 public 目录
  cpSync(join(rootDir, 'public'), join(distDir, 'public'), { recursive: true });
  
  // 复制配置文件
  copyFileSync(join(rootDir, 'config.json'), join(distDir, 'config.json'));
  
  // 复制 .env 模板文件为 .env (供发布使用)
  const envTemplatePath = join(rootDir, '.env_r');
  if (existsSync(envTemplatePath)) {
    copyFileSync(envTemplatePath, join(distDir, '.env'));
    console.log('✅ 已生成 .env 配置文件');
  }
  
  // 复制 mongod 目录配置文件（不复制二进制文件）
  const mongodDir = join(rootDir, 'mongod');
  if (existsSync(mongodDir)) {
    console.log('📋 复制 MongoDB 配置...');
    const distMongodDir = join(distDir, 'mongod');
    ensureDir(distMongodDir);
    
    // 只复制配置文件，不复制二进制文件
    const resourcesConfig = join(mongodDir, 'mongod-resources.json');
    if (existsSync(resourcesConfig)) {
      copyFileSync(resourcesConfig, join(distMongodDir, 'mongod-resources.json'));
      console.log('✅ MongoDB 资源配置复制完成');
    }
    
    // 注意：mongod 二进制文件不再打包，首次运行时从 OSS 下载
    console.log('ℹ️ mongod 二进制文件将在首次运行时从 OSS 下载');
  }
  
  console.log('✅ 资源文件复制完成\n');

  // 5. 复制图标文件
  console.log('🎨 复制图标文件...');
  const icoSourcePath = join(rootDir, 'public', 'logo.ico');
  const pngSourcePath = join(rootDir, 'public', 'logo.png');
  const icoDistPath = join(distDir, 'logo.ico');
  const pngDistPath = join(distDir, 'logo.png');
  
  // 优先使用 public 目录下的 ico 文件
  if (existsSync(icoSourcePath)) {
    copyFileSync(icoSourcePath, icoDistPath);
    console.log('✅ 已复制 logo.ico (来自 public 目录)');
  } else {
    // 如果没有 ico 文件，尝试从 logo.jpg 生成
    const logoPath = join(rootDir, 'public', 'logo.jpg');
    if (existsSync(logoPath)) {
      try {
        // 生成多个尺寸的 PNG 然后合并为 ICO
        const sizes = [16, 32, 48, 64, 128, 256];
        const pngBuffers = await Promise.all(
          sizes.map(size => 
            sharp(logoPath)
              .resize(size, size)
              .png()
              .toBuffer()
          )
        );
        
        // ICO 文件格式
        const iconDir = Buffer.alloc(6);
        iconDir.writeUInt16LE(0, 0); // Reserved
        iconDir.writeUInt16LE(1, 2); // Type (1 = ICO)
        iconDir.writeUInt16LE(sizes.length, 4); // Number of images
        
        const iconDirEntries = [];
        let imageDataOffset = 6 + sizes.length * 16;
        const imageDataBuffers = [];
        
        for (let i = 0; i < sizes.length; i++) {
          const size = sizes[i];
          const pngData = pngBuffers[i];
          
          const entry = Buffer.alloc(16);
          entry.writeUInt8(size === 256 ? 0 : size, 0); // Width (0 = 256)
          entry.writeUInt8(size === 256 ? 0 : size, 1); // Height (0 = 256)
          entry.writeUInt8(0, 2); // Color palette
          entry.writeUInt8(0, 3); // Reserved
          entry.writeUInt16LE(1, 4); // Color planes
          entry.writeUInt16LE(32, 6); // Bits per pixel
          entry.writeUInt32LE(pngData.length, 8); // Size of image data
          entry.writeUInt32LE(imageDataOffset, 12); // Offset to image data
          
          iconDirEntries.push(entry);
          imageDataBuffers.push(pngData);
          imageDataOffset += pngData.length;
        }
        
        const icoBuffer = Buffer.concat([
          iconDir,
          ...iconDirEntries,
          ...imageDataBuffers
        ]);
        
        writeFileSync(icoDistPath, icoBuffer);
        console.log('✅ 已从 logo.jpg 生成 logo.ico');
      } catch (err) {
        console.warn('⚠️ 图标生成失败，将使用默认图标:', err.message);
      }
    } else {
      console.warn('⚠️ 未找到 logo.ico 或 logo.jpg，跳过图标生成');
    }
  }
  
  // 复制或生成 PNG 图标（用于 macOS 和 Linux）
  if (existsSync(pngSourcePath)) {
    copyFileSync(pngSourcePath, pngDistPath);
    console.log('✅ 已复制 logo.png');
  } else {
    const logoPath = join(rootDir, 'public', 'logo.jpg');
    if (existsSync(logoPath)) {
      try {
        await sharp(logoPath)
          .resize(256, 256)
          .png()
          .toFile(pngDistPath);
        console.log('✅ 已从 logo.jpg 生成 logo.png');
      } catch (err) {
        console.warn('⚠️ PNG 图标生成失败:', err.message);
      }
    }
  }
  console.log('');

  // 5. 内嵌 index.html 到代码中（用于 pkg 打包）
  console.log('📝 内嵌 index.html...');
  const indexHtmlPath = join(rootDir, 'public', 'index.html');
  const indexHtmlContent = readFileSync(indexHtmlPath, 'utf-8');
  
  // 替换 interactive.cjs 中的占位符（因为 esbuild 已经内联了所有代码）
  const interactivePath = join(distDir, 'interactive.cjs');
  let interactiveCode = readFileSync(interactivePath, 'utf-8');
  // 替换 INDEX_HTML 的值
  interactiveCode = interactiveCode.replace(/"__EMBEDDED_INDEX_HTML__"/g, JSON.stringify(indexHtmlContent));
  // 将 hasEmbeddedHtml 设为 true
  interactiveCode = interactiveCode.replace(/"__HAS_EMBEDDED_HTML__"/g, 'true');
  writeFileSync(interactivePath, interactiveCode);
  console.log('✅ index.html 已内嵌到 interactive.cjs\n');

  // 6. 创建 dist/package.json (用于 pkg)
  const pkgJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
  const distPkgJson = {
    name: pkgJson.name,
    version: pkgJson.version,
    main: 'interactive.cjs',
    bin: 'interactive.cjs',
    pkg: {
      targets: [
        'node18-win-x64',
        'node18-macos-x64',
        'node18-macos-arm64',
        'node18-linux-x64'
      ],
      // 注意：assets 中的文件会被嵌入到 exe 的虚拟文件系统
      // 但是 spawn/exec 无法执行虚拟文件系统中的程序
      // 动态 import() 也需要真实文件
      // 所以 mongod、skills 等需要作为外部文件复制到 release 目录
      assets: [
        'config.json',
        '.env'
      ]
    }
  };
  writeFileSync(join(distDir, 'package.json'), JSON.stringify(distPkgJson, null, 2));

  console.log('✅ 构建完成！');
  console.log(`📁 输出目录: ${distDir}`);
}

// 获取当前系统的 pkg target 和输出文件名
function getSystemTarget() {
  const currentPlatform = platform();
  const currentArch = arch();
  
  if (currentPlatform === 'win32') {
    return {
      target: 'node18-win-x64',
      outputFile: 'fast-agent-win-x64.exe',
      icon: 'logo.ico'
    };
  } else if (currentPlatform === 'darwin') {
    // macOS: 检测架构
    if (currentArch === 'arm64') {
      return {
        target: 'node18-macos-arm64',
        outputFile: 'fast-agent-macos-arm64',
        icon: 'logo.png'
      };
    } else {
      return {
        target: 'node18-macos-x64',
        outputFile: 'fast-agent-macos-x64',
        icon: 'logo.png'
      };
    }
  } else if (currentPlatform === 'linux') {
    return {
      target: 'node18-linux-x64',
      outputFile: 'fast-agent-linux-x64',
      icon: 'logo.png'
    };
  } else {
    throw new Error(`不支持的操作系统: ${currentPlatform}`);
  }
}

// 执行 pkg 打包
function runPkg(target, outputFile, icon) {
  console.log(`\n📦 执行 pkg 打包...`);
  console.log(`   目标: ${target}`);
  console.log(`   输出: ${join(releaseDir, outputFile)}`);
  
  // 注意：pkg 的 --icon 参数在 5.x 版本中不可靠，改用 rcedit 设置图标
  const pkgCmd = `npx pkg interactive.cjs --targets ${target} --compress GZip --no-warnings --output ../release/${outputFile}`;
  
  try {
    execSync(pkgCmd, { 
      cwd: distDir,
      stdio: 'inherit'
    });
    console.log('✅ pkg 打包完成');
  } catch (err) {
    throw new Error(`pkg 打包失败: ${err.message}`);
  }
}

// 复制资源文件到 release 目录
function copyAssetsToRelease() {
  console.log('\n📋 复制资源文件到 release 目录...');
  
  const assets = ['skills', 'public'];
  const files = ['config.json', '.env'];
  
  for (const asset of assets) {
    const src = join(distDir, asset);
    const dest = join(releaseDir, asset);
    if (existsSync(src)) {
      cpSync(src, dest, { recursive: true });
      console.log(`   ✅ ${asset}/`);
    }
  }
  
  // 复制 mongod 配置文件（创建目录）
  const mongodDistDir = join(distDir, 'mongod');
  const mongodReleaseDir = join(releaseDir, 'mongod');
  if (existsSync(mongodDistDir)) {
    ensureDir(mongodReleaseDir);
    const resourcesConfig = join(mongodDistDir, 'mongod-resources.json');
    if (existsSync(resourcesConfig)) {
      copyFileSync(resourcesConfig, join(mongodReleaseDir, 'mongod-resources.json'));
      console.log('   ✅ mongod/mongod-resources.json');
    }
  }
  
  for (const file of files) {
    const src = join(distDir, file);
    const dest = join(releaseDir, file);
    if (existsSync(src)) {
      copyFileSync(src, dest);
      console.log(`   ✅ ${file}`);
    }
  }
}

// 使用 resedit 设置 Windows exe 图标
async function setExeIcon(exePath, iconPath) {
  if (platform() !== 'win32') {
    console.log('   非 Windows 系统，跳过图标设置');
    return;
  }
  
  console.log(`🎨 设置 exe 图标...`);
  console.log(`   exe: ${exePath}`);
  console.log(`   icon: ${iconPath}`);
  
  try {
    const fs = await import('fs');
    const resedit = await import('resedit');
    
    // 读取 exe 和 ico 文件
    const exeData = fs.readFileSync(exePath);
    const icoData = fs.readFileSync(iconPath);
    
    // 解析 exe
    const NtExecutable = resedit.NtExecutable;
    const NtExecutableResource = resedit.NtExecutableResource;
    const IconGroupEntry = resedit.Resource.IconGroupEntry;
    const IconFile = resedit.Data.IconFile;
    
    const exe = NtExecutable.from(exeData);
    const res = NtExecutableResource.from(exe);
    const iconFile = IconFile.from(icoData);
    
    // 替换/添加图标资源
    // 参数：entries, icon group ID, language ID, icon data array
    IconGroupEntry.replaceIconsForResource(
      res.entries,
      1,      // icon group ID
      1033,   // language ID (English US)
      iconFile.icons.map(icon => icon.data)
    );
    
    // 重新生成 exe
    res.outputResource(exe);
    const newExe = exe.generate();
    
    // 写回文件
    fs.writeFileSync(exePath, Buffer.from(newExe));
    
    console.log('✅ 图标设置成功');
  } catch (err) {
    console.warn('⚠️ 图标设置失败:', err.message);
    console.warn('   将使用默认图标');
  }
}

// 主流程
async function main() {
  const args = process.argv.slice(2);
  const pkgOnly = args.includes('--pkg-only');
  
  // 1. esbuild 打包（除非指定 --pkg-only）
  if (!pkgOnly) {
    await build();
  } else {
    console.log('⏭️ 跳过 esbuild 打包，直接执行 pkg...');
  }
  
  // 2. 获取系统信息并执行 pkg 打包
  const { target, outputFile, icon } = getSystemTarget();
  runPkg(target, outputFile, icon);
  
  // 3. 设置 exe 图标 (Windows) - 必须在复制资源文件之前
  const exePath = join(releaseDir, outputFile);
  const iconPath = join(distDir, icon);
  await setExeIcon(exePath, iconPath);
  
  // 4. 复制资源文件
  copyAssetsToRelease();
  
  console.log('\n🎉 全部完成！');
  console.log(`📁 发布目录: ${releaseDir}`);
  console.log(`🚀 可执行文件: ${exePath}`);
}

main().catch(err => {
  console.error('❌ 构建失败:', err);
  process.exit(1);
});
