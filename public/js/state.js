/**
 * 状态管理
 */
const AppState = {
  currentConversation: null,
  conversations: [],
  config: {},
  // 每个对话独立的流式状态（Set 存储正在流式传输的对话ID）
  streamingConversations: new Set(),
  // 每个对话的流式进度状态（用于切换对话后恢复显示）
  conversationProgress: new Map(),
  // 每个对话的消息列表缓存（用于切换对话后恢复）
  conversationMessages: new Map()
};

// 导出状态
window.AppState = AppState;
