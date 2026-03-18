// 示例技能: 计算器
export default {
  name: 'calculator',
  description: '执行数学运算',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: '数学表达式, 如 2+3*4' }
    },
    required: ['expression']
  },
  execute: async (args) => {
    // 安全计算 (仅允许数字和基本运算符)
    const expr = args.expression.replace(/[^0-9+\-*/().%\s]/g, '');
    if (!expr) return '无效表达式';
    try {
      return String(Function(`"use strict"; return (${expr})`)());
    } catch {
      return '计算错误';
    }
  }
};
