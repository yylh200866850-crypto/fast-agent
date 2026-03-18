/**
 * 对话历史存储模块
 * 支持多组对话、多轮对话，本地文件存储
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// 兼容 ES Module 和 CommonJS 环境
const getDirname = () => {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  }
};
const __dirname = getDirname();

// 默认存储目录
const DEFAULT_STORAGE_DIR = join(__dirname, 'conversations');

export class ConversationStore {
  constructor(storageDir = DEFAULT_STORAGE_DIR) {
    this.storageDir = storageDir;
    this.ensureDir();
  }

  // 确保存储目录存在
  ensureDir() {
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
  }

  // 生成唯一ID
  generateId() {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取对话文件路径
  getFilePath(conversationId) {
    return join(this.storageDir, `${conversationId}.json`);
  }

  // 创建新对话
  createConversation(title = '新对话', systemPrompt = '') {
    const id = this.generateId();
    const conversation = {
      id,
      title,
      systemPrompt,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provider: 'deepseek',
      model: null,
      // 版本管理
      versionId: 'v1',
      parentVersionId: null,
      versionHistory: []
    };
    
    this.saveConversation(conversation);
    return conversation;
  }

  // 克隆对话（创建新版本）
  cloneConversation(conversationId, options = {}) {
    const original = this.getConversation(conversationId);
    if (!original) {
      throw new Error(`对话不存在: ${conversationId}`);
    }
    
    // 生成新版本ID
    const currentVersion = original.versionId || 'v1';
    const versionNum = parseInt(currentVersion.replace('v', '')) + 1;
    const newVersionId = `v${versionNum}`;
    
    // 创建新对话（克隆）
    const newId = this.generateId();
    const cloned = {
      ...original,
      id: newId,
      versionId: newVersionId,
      parentVersionId: conversationId,
      parentVersionNumber: currentVersion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // 保留原始对话的版本历史
      versionHistory: [
        ...(original.versionHistory || []),
        { id: conversationId, versionId: currentVersion, title: original.title, createdAt: original.createdAt }
      ]
    };
    
    // 应用选项覆盖（如修改消息、标题等）
    if (options.messages !== undefined) {
      cloned.messages = options.messages;
    }
    if (options.title !== undefined) {
      cloned.title = options.title;
    }
    
    this.saveConversation(cloned);
    return cloned;
  }

  // 获取对话的所有版本
  getConversationVersions(conversationId) {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return [];
    }
    
    // 构建版本历史链
    const versions = [];
    
    // 添加历史版本
    if (conversation.versionHistory && conversation.versionHistory.length > 0) {
      for (const v of conversation.versionHistory) {
        const histConv = this.getConversation(v.id);
        if (histConv) {
          versions.push({
            id: histConv.id,
            versionId: histConv.versionId || 'v1',
            title: histConv.title,
            messageCount: histConv.messages?.length || 0,
            createdAt: histConv.createdAt,
            updatedAt: histConv.updatedAt,
            isCurrent: false
          });
        }
      }
    }
    
    // 添加当前版本
    versions.push({
      id: conversation.id,
      versionId: conversation.versionId || 'v1',
      title: conversation.title,
      messageCount: conversation.messages?.length || 0,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      isCurrent: true
    });
    
    // 按版本号排序
    versions.sort((a, b) => {
      const aNum = parseInt(a.versionId.replace('v', ''));
      const bNum = parseInt(b.versionId.replace('v', ''));
      return aNum - bNum;
    });
    
    return versions;
  }

  // 保存对话
  saveConversation(conversation) {
    conversation.updatedAt = new Date().toISOString();
    const filePath = this.getFilePath(conversation.id);
    writeFileSync(filePath, JSON.stringify(conversation, null, 2), 'utf-8');
    return conversation;
  }

  // 获取对话
  getConversation(conversationId) {
    const filePath = this.getFilePath(conversationId);
    if (!existsSync(filePath)) {
      return null;
    }
    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error(`读取对话失败: ${conversationId}`, e);
      return null;
    }
  }

  // 删除对话
  deleteConversation(conversationId) {
    const filePath = this.getFilePath(conversationId);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      return true;
    }
    return false;
  }

  // 获取所有对话列表
  listConversations() {
    this.ensureDir();
    const files = readdirSync(this.storageDir).filter(f => f.endsWith('.json'));
    
    const conversations = files.map(file => {
      try {
        const content = readFileSync(join(this.storageDir, file), 'utf-8');
        const conv = JSON.parse(content);
        // 只返回摘要信息
        return {
          id: conv.id,
          title: conv.title,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          messageCount: conv.messages?.length || 0,
          provider: conv.provider,
          model: conv.model
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    // 按更新时间倒序排列
    conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return conversations;
  }

  // 添加消息到对话
  addMessage(conversationId, message) {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`对话不存在: ${conversationId}`);
    }
    
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      role: message.role,
      content: message.content,
      timestamp: new Date().toISOString(),
      ...message
    };
    
    conversation.messages.push(msg);
    this.saveConversation(conversation);
    return msg;
  }

  // 更新对话设置
  updateConversation(conversationId, updates) {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`对话不存在: ${conversationId}`);
    }
    
    // 允许更新的字段
    const allowedFields = ['title', 'systemPrompt', 'provider', 'model'];
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        conversation[key] = updates[key];
      }
    }
    
    this.saveConversation(conversation);
    return conversation;
  }

  // 清空对话消息
  clearMessages(conversationId) {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`对话不存在: ${conversationId}`);
    }
    
    conversation.messages = [];
    this.saveConversation(conversation);
    return conversation;
  }

  // 搜索对话
  searchConversations(query) {
    const conversations = this.listConversations();
    if (!query) return conversations;
    
    const lowerQuery = query.toLowerCase();
    return conversations.filter(conv => 
      conv.title.toLowerCase().includes(lowerQuery)
    );
  }

  // 获取存储统计
  getStats() {
    const conversations = this.listConversations();
    return {
      totalConversations: conversations.length,
      totalMessages: conversations.reduce((sum, c) => sum + c.messageCount, 0),
      storageDir: this.storageDir
    };
  }
}

export default ConversationStore;
