// 示例技能: 获取当前时间
export default {
  name: 'get_time',
  description: '获取当前日期时间',
  parameters: {
    type: 'object',
    properties: {
      timezone: { type: 'string', description: '时区, 如 Asia/Shanghai' }
    }
  },
  execute: async (args) => {
    const tz = args.timezone || 'Asia/Shanghai';
    return new Date().toLocaleString('zh-CN', { timeZone: tz });
  }
};
