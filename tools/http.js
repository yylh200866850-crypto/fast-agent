// HTTP 工具定义 (使用 Node.js 内置 fetch)
export const httpTools = [
  {
    name: 'http_get',
    description: '发送 HTTP GET 请求',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '请求 URL' },
        headers: { type: 'object', description: '请求头', default: {} },
        timeout: { type: 'number', description: '超时时间(ms)', default: 30000 }
      },
      required: ['url']
    }
  },
  {
    name: 'http_post',
    description: '发送 HTTP POST 请求',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '请求 URL' },
        body: { type: 'object', description: '请求体' },
        headers: { type: 'object', description: '请求头', default: {} },
        timeout: { type: 'number', description: '超时时间(ms)', default: 30000 }
      },
      required: ['url']
    }
  },
  {
    name: 'http_put',
    description: '发送 HTTP PUT 请求',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '请求 URL' },
        body: { type: 'object', description: '请求体' },
        headers: { type: 'object', description: '请求头', default: {} },
        timeout: { type: 'number', description: '超时时间(ms)', default: 30000 }
      },
      required: ['url']
    }
  },
  {
    name: 'http_delete',
    description: '发送 HTTP DELETE 请求',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '请求 URL' },
        headers: { type: 'object', description: '请求头', default: {} },
        timeout: { type: 'number', description: '超时时间(ms)', default: 30000 }
      },
      required: ['url']
    }
  },
  {
    name: 'http_request',
    description: '发送自定义 HTTP 请求',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '请求 URL' },
        method: { type: 'string', description: '请求方法', default: 'GET' },
        body: { type: 'object', description: '请求体' },
        headers: { type: 'object', description: '请求头', default: {} },
        timeout: { type: 'number', description: '超时时间(ms)', default: 30000 }
      },
      required: ['url']
    }
  }
];

// 通用请求函数
async function doFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 30000);
  
  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
    
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json() : await res.text();
    
    return {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      data
    };
  } finally {
    clearTimeout(timeout);
  }
}

// 工具处理函数
export async function handleHttpTool(name, args) {
  const text = (content) => ({ content: [{ type: 'text', text: typeof content === 'string' ? content : JSON.stringify(content, null, 2) }] });
  
  const methodMap = {
    http_get: 'GET',
    http_post: 'POST',
    http_put: 'PUT',
    http_delete: 'DELETE'
  };
  
  try {
    if (name === 'http_request') {
      const result = await doFetch(args.url, {
        method: args.method,
        body: args.body,
        headers: args.headers,
        timeout: args.timeout
      });
      return text(result);
    }
    
    const method = methodMap[name];
    if (method) {
      const result = await doFetch(args.url, {
        method,
        body: args.body,
        headers: args.headers,
        timeout: args.timeout
      });
      return text(result);
    }
    
    return { content: [{ type: 'text', text: `Unknown http tool: ${name}` }], isError: true };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { content: [{ type: 'text', text: '请求超时' }], isError: true };
    }
    throw error;
  }
}
