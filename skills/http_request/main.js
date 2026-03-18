// 示例技能: HTTP请求
export default {
  name: 'http_request',
  description: '发送HTTP请求',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '请求URL' },
      method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' },
      body: { type: 'string', description: 'POST请求体' }
    },
    required: ['url']
  },
  execute: async (args) => {
    const { url, method = 'GET', body } = args;
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: method === 'POST' ? body : undefined
    });
    const text = await res.text();
    return text.length > 2000 ? text.slice(0, 2000) + '...(truncated)' : text;
  }
};
