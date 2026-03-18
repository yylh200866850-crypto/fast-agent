// 实用工具定义 - JS 擅长的功能
import { createHash, createHmac, randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv, webcrypto } from 'crypto';
import { promisify } from 'util';

// 实用工具定义
export const utilsTools = [
  // 编码/解码
  {
    name: 'utils_base64_encode',
    description: 'Base64 编码',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要编码的文本' }
      },
      required: ['text']
    }
  },
  {
    name: 'utils_base64_decode',
    description: 'Base64 解码',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要解码的 Base64 文本' }
      },
      required: ['text']
    }
  },
  {
    name: 'utils_url_encode',
    description: 'URL 编码',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要编码的文本' }
      },
      required: ['text']
    }
  },
  {
    name: 'utils_url_decode',
    description: 'URL 解码',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要解码的文本' }
      },
      required: ['text']
    }
  },
  {
    name: 'utils_html_encode',
    description: 'HTML 实体编码',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要编码的文本' }
      },
      required: ['text']
    }
  },
  {
    name: 'utils_html_decode',
    description: 'HTML 实体解码',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要解码的文本' }
      },
      required: ['text']
    }
  },
  
  // 哈希/加密
  {
    name: 'utils_hash',
    description: '计算文本哈希值（支持 md5, sha1, sha256, sha512）',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要哈希的文本' },
        algorithm: { type: 'string', description: '算法: md5, sha1, sha256, sha512', default: 'sha256' }
      },
      required: ['text']
    }
  },
  {
    name: 'utils_hmac',
    description: '计算 HMAC 值',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要签名的文本' },
        key: { type: 'string', description: '密钥' },
        algorithm: { type: 'string', description: '算法: sha256, sha512', default: 'sha256' }
      },
      required: ['text', 'key']
    }
  },
  {
    name: 'utils_uuid',
    description: '生成 UUID',
    inputSchema: {
      type: 'object',
      properties: {
        version: { type: 'string', description: '版本: v4(随机) 或 v1(时间)', default: 'v4' }
      }
    }
  },
  {
    name: 'utils_random',
    description: '生成随机字符串或数字',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: '类型: hex, base64, number', default: 'hex' },
        length: { type: 'number', description: '长度(字节数)', default: 16 }
      }
    }
  },
  
  // JSON 处理
  {
    name: 'utils_json_parse',
    description: '解析 JSON 字符串',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'JSON 字符串' }
      },
      required: ['text']
    }
  },
  {
    name: 'utils_json_stringify',
    description: '将对象序列化为 JSON',
    inputSchema: {
      type: 'object',
      properties: {
        object: { type: 'object', description: '要序列化的对象' },
        pretty: { type: 'boolean', description: '是否格式化', default: true }
      },
      required: ['object']
    }
  },
  {
    name: 'utils_json_path',
    description: '使用 JSONPath 提取数据',
    inputSchema: {
      type: 'object',
      properties: {
        object: { type: 'object', description: 'JSON 对象' },
        path: { type: 'string', description: 'JSONPath 表达式，如 $.store.book[*].author' }
      },
      required: ['object', 'path']
    }
  },
  
  // 正则/字符串
  {
    name: 'utils_regex_match',
    description: '正则表达式匹配',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要匹配的文本' },
        pattern: { type: 'string', description: '正则表达式' },
        flags: { type: 'string', description: '标志: g, i, m 等', default: '' }
      },
      required: ['text', 'pattern']
    }
  },
  {
    name: 'utils_regex_replace',
    description: '正则表达式替换',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '原始文本' },
        pattern: { type: 'string', description: '正则表达式' },
        replacement: { type: 'string', description: '替换文本' },
        flags: { type: 'string', description: '标志: g, i, m 等', default: 'g' }
      },
      required: ['text', 'pattern', 'replacement']
    }
  },
  {
    name: 'utils_string_template',
    description: '字符串模板渲染',
    inputSchema: {
      type: 'object',
      properties: {
        template: { type: 'string', description: '模板，如: Hello {{name}}!' },
        data: { type: 'object', description: '数据对象' }
      },
      required: ['template', 'data']
    }
  },
  
  // 时间处理
  {
    name: 'utils_timestamp',
    description: '时间戳转换',
    inputSchema: {
      type: 'object',
      properties: {
        value: { type: 'string', description: '时间戳或日期字符串，留空返回当前时间戳' },
        format: { type: 'string', description: '输出格式: iso, local, timestamp' }
      }
    }
  },
  {
    name: 'utils_date_calc',
    description: '日期计算',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: '起始日期，留空为当前时间' },
        operation: { type: 'string', description: '操作: add 或 subtract' },
        value: { type: 'number', description: '数值' },
        unit: { type: 'string', description: '单位: days, hours, minutes, seconds' }
      },
      required: ['operation', 'value', 'unit']
    }
  },
  
  // 数据转换
  {
    name: 'utils_convert_case',
    description: '字符串大小写转换',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '原始文本' },
        to: { type: 'string', description: '目标格式: upper, lower, camel, snake, kebab, pascal' }
      },
      required: ['text', 'to']
    }
  },
  {
    name: 'utils_number_base',
    description: '数字进制转换',
    inputSchema: {
      type: 'object',
      properties: {
        value: { type: 'string', description: '数值' },
        from: { type: 'number', description: '原进制', default: 10 },
        to: { type: 'number', description: '目标进制', default: 10 }
      },
      required: ['value']
    }
  },
  {
    name: 'utils_color_convert',
    description: '颜色格式转换',
    inputSchema: {
      type: 'object',
      properties: {
        color: { type: 'string', description: '颜色值，如 #FF0000 或 rgb(255,0,0)' },
        to: { type: 'string', description: '目标格式: hex, rgb, hsl' }
      },
      required: ['color', 'to']
    }
  },
  
  // 验证
  {
    name: 'utils_validate',
    description: '验证常见格式（邮箱、URL、IP等）',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要验证的文本' },
        type: { type: 'string', description: '类型: email, url, ip, phone, json, uuid' }
      },
      required: ['text', 'type']
    }
  }
];

// HTML 实体映射
const htmlEntities = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

// 工具处理函数
export async function handleUtilsTool(name, args) {
  const text = (content) => ({ content: [{ type: 'text', text: typeof content === 'string' ? content : JSON.stringify(content, null, 2) }] });
  
  try {
    switch (name) {
      // 编码/解码
      case 'utils_base64_encode': {
        const encoded = Buffer.from(args.text, 'utf-8').toString('base64');
        return text({ original: args.text, encoded });
      }
      case 'utils_base64_decode': {
        const decoded = Buffer.from(args.text, 'base64').toString('utf-8');
        return text({ encoded: args.text, decoded });
      }
      case 'utils_url_encode': {
        return text({ original: args.text, encoded: encodeURIComponent(args.text) });
      }
      case 'utils_url_decode': {
        return text({ encoded: args.text, decoded: decodeURIComponent(args.text) });
      }
      case 'utils_html_encode': {
        const encoded = args.text.replace(/[&<>"']/g, c => htmlEntities[c]);
        return text({ original: args.text, encoded });
      }
      case 'utils_html_decode': {
        const decoded = args.text
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        return text({ encoded: args.text, decoded });
      }
      
      // 哈希/加密
      case 'utils_hash': {
        const algorithm = args.algorithm || 'sha256';
        const hash = createHash(algorithm).update(args.text, 'utf-8').digest('hex');
        return text({ text: args.text, algorithm, hash });
      }
      case 'utils_hmac': {
        const algorithm = args.algorithm || 'sha256';
        const hmac = createHmac(algorithm, args.key).update(args.text, 'utf-8').digest('hex');
        return text({ text: args.text, algorithm, hmac });
      }
      case 'utils_uuid': {
        if (args.version === 'v1') {
          // 简化版 v1 UUID
          const now = Date.now();
          const random = randomBytes(8).toString('hex');
          const uuid = `${(now & 0xFFFFFFFF).toString(16).padStart(8, '0')}-${((now >> 32) & 0xFFFF).toString(16).padStart(4, '0')}-1${random.substring(0, 3)}-${random.substring(3, 7)}-${random.substring(7, 15).padEnd(12, '0')}`;
          return text({ uuid, version: 'v1' });
        }
        // v4 UUID
        const bytes = randomBytes(16);
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
        const uuid = [
          bytes.toString('hex', 0, 4),
          bytes.toString('hex', 4, 6),
          bytes.toString('hex', 6, 8),
          bytes.toString('hex', 8, 10),
          bytes.toString('hex', 10, 16)
        ].join('-');
        return text({ uuid, version: 'v4' });
      }
      case 'utils_random': {
        const length = args.length || 16;
        const type = args.type || 'hex';
        const bytes = randomBytes(length);
        const result = type === 'number' 
          ? Math.floor(Math.random() * Math.pow(10, length))
          : bytes.toString(type === 'base64' ? 'base64' : 'hex');
        return text({ type, length, result: type === 'number' ? result : result.substring(0, length * 2) });
      }
      
      // JSON 处理
      case 'utils_json_parse': {
        const parsed = JSON.parse(args.text);
        return text({ parsed });
      }
      case 'utils_json_stringify': {
        const result = args.pretty !== false 
          ? JSON.stringify(args.object, null, 2) 
          : JSON.stringify(args.object);
        return text({ stringified: result });
      }
      case 'utils_json_path': {
        // 简化版 JSONPath 实现
        const result = jsonPathQuery(args.object, args.path);
        return text({ path: args.path, result });
      }
      
      // 正则/字符串
      case 'utils_regex_match': {
        const regex = new RegExp(args.pattern, args.flags || '');
        const matches = args.text.match(regex);
        return text({ 
          pattern: args.pattern, 
          flags: args.flags,
          matches: matches || [],
          matchCount: matches ? matches.length : 0
        });
      }
      case 'utils_regex_replace': {
        const regex = new RegExp(args.pattern, args.flags || 'g');
        const result = args.text.replace(regex, args.replacement);
        return text({ original: args.text, pattern: args.pattern, result });
      }
      case 'utils_string_template': {
        const result = args.template.replace(/\{\{(\w+)\}\}/g, (_, key) => args.data[key] ?? '');
        return text({ template: args.template, data: args.data, result });
      }
      
      // 时间处理
      case 'utils_timestamp': {
        let date;
        if (args.value) {
          date = /^\d+$/.test(args.value) ? new Date(parseInt(args.value)) : new Date(args.value);
        } else {
          date = new Date();
        }
        const format = args.format || 'iso';
        const result = format === 'timestamp' ? date.getTime() 
          : format === 'local' ? date.toLocaleString('zh-CN') 
          : date.toISOString();
        return text({ 
          input: args.value || 'now',
          format,
          result,
          iso: date.toISOString(),
          local: date.toLocaleString('zh-CN'),
          timestamp: date.getTime()
        });
      }
      case 'utils_date_calc': {
        const date = args.date ? new Date(args.date) : new Date();
        const value = args.operation === 'subtract' ? -args.value : args.value;
        const unitMs = { days: 86400000, hours: 3600000, minutes: 60000, seconds: 1000 };
        const newDate = new Date(date.getTime() + value * unitMs[args.unit]);
        return text({
          original: date.toISOString(),
          operation: args.operation,
          value: args.value,
          unit: args.unit,
          result: newDate.toISOString(),
          resultLocal: newDate.toLocaleString('zh-CN')
        });
      }
      
      // 数据转换
      case 'utils_convert_case': {
        const result = convertCase(args.text, args.to);
        return text({ original: args.text, format: args.to, result });
      }
      case 'utils_number_base': {
        const num = parseInt(args.value, args.from || 10);
        const result = num.toString(args.to || 10);
        return text({ 
          original: args.value, 
          fromBase: args.from || 10, 
          toBase: args.to || 10, 
          result,
          decimal: num
        });
      }
      case 'utils_color_convert': {
        const result = convertColor(args.color, args.to);
        return text({ original: args.color, format: args.to, result });
      }
      
      // 验证
      case 'utils_validate': {
        const result = validateFormat(args.text, args.type);
        return text({ text: args.text, type: args.type, valid: result.valid, message: result.message });
      }
      
      default:
        return { content: [{ type: 'text', text: `Unknown utils tool: ${name}` }], isError: true };
    }
  } catch (error) {
    return text({ error: error.message });
  }
}

// 简化版 JSONPath 查询
function jsonPathQuery(obj, path) {
  if (!path.startsWith('$')) return null;
  
  path = path.substring(2); // 移除 $.
  const parts = path.split(/\.|\[|\]/).filter(p => p);
  
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return null;
    
    if (part === '*') {
      if (Array.isArray(current)) {
        return current;
      } else if (typeof current === 'object') {
        return Object.values(current);
      }
    } else if (/^\d+$/.test(part)) {
      current = current[parseInt(part)];
    } else {
      current = current[part];
    }
  }
  return current;
}

// 大小写转换
function convertCase(text, to) {
  switch (to) {
    case 'upper': return text.toUpperCase();
    case 'lower': return text.toLowerCase();
    case 'camel': 
      return text.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '').replace(/^(.)/, c => c.toLowerCase());
    case 'snake':
      return text.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[-\s]+/g, '_').toLowerCase();
    case 'kebab':
      return text.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase();
    case 'pascal':
      return text.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '').replace(/^(.)/, c => c.toUpperCase());
    default:
      return text;
  }
}

// 颜色转换
function convertColor(color, to) {
  let r, g, b;
  
  // 解析输入
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    r = parseInt(hex.substr(0, 2), 16);
    g = parseInt(hex.substr(2, 2), 16);
    b = parseInt(hex.substr(4, 2), 16);
  } else if (color.startsWith('rgb')) {
    const match = color.match(/(\d+)/g);
    [r, g, b] = match.map(Number);
  } else {
    return { error: '不支持的颜色格式' };
  }
  
  // 转换输出
  switch (to) {
    case 'hex':
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    case 'rgb':
      return `rgb(${r}, ${g}, ${b})`;
    case 'hsl': {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;
      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
    }
    default:
      return { error: '不支持的目标格式' };
  }
}

// 格式验证
function validateFormat(text, type) {
  const patterns = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    url: /^https?:\/\/[^\s<>"]+$/,
    ip: /^(\d{1,3}\.){3}\d{1,3}$/,
    phone: /^1[3-9]\d{9}$/,
    json: /^[\s\S]*$/,
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  };
  
  const messages = {
    email: '邮箱格式',
    url: 'URL 格式',
    ip: 'IP 地址格式',
    phone: '手机号格式',
    json: 'JSON 格式',
    uuid: 'UUID 格式'
  };
  
  if (type === 'json') {
    try {
      JSON.parse(text);
      return { valid: true, message: '有效的 JSON' };
    } catch {
      return { valid: false, message: '无效的 JSON' };
    }
  }
  
  const pattern = patterns[type];
  if (!pattern) {
    return { valid: false, message: '未知的验证类型' };
  }
  
  const valid = pattern.test(text);
  return { valid, message: valid ? `有效的${messages[type]}` : `无效的${messages[type]}` };
}
