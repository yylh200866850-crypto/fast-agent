/**
 * Web Server 入口
 * 启动 Web 界面服务
 */
import { WebServer } from './web_server.js';
import { createLogger } from './logger.js';

const logger = createLogger('Main');

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║           🤖 Fast-Agent - Web Interface                  ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');

  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const host = process.env.HOST || '0.0.0.0';

  const server = new WebServer({ port, host });

  try {
    await server.start();
    
    // 优雅关闭
    process.on('SIGINT', async () => {
      console.log('\n正在关闭服务器...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('启动失败:', error);
    process.exit(1);
  }
}

main();
