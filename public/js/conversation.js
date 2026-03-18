/**
 * 对话管理模块
 */
const ConversationManager = {
  // 加载对话列表
  async loadConversations() {
    try {
      const res = await fetch(API.conversations);
      const data = await res.json();
      if (data.success) {
        AppState.conversations = data.data;
        this.renderConversations();
      }
    } catch (e) {
      UI.showToast('加载对话列表失败', 'error');
    }
  },

  // 渲染对话列表
  renderConversations() {
    const list = document.getElementById('conversationList');
    list.innerHTML = AppState.conversations.map(conv => `
      <div class="conversation-item ${AppState.currentConversation?.id === conv.id ? 'active' : ''}" 
           onclick="ConversationManager.selectConversation('${conv.id}')">
        <div class="icon">
          <i class="fas fa-message"></i>
        </div>
        <div class="info">
          <div class="title">${UI.escapeHtml(conv.title)}</div>
          <div class="meta">${conv.messageCount} 条消息 · ${UI.formatDate(conv.updatedAt)}</div>
        </div>
        <button class="delete-btn" onclick="event.stopPropagation(); ConversationManager.deleteConversation('${conv.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `).join('');
  },

  // 创建新对话
  async createNewConversation() {
    try {
      const res = await fetch(API.conversations, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新对话' })
      });
      const data = await res.json();
      if (data.success) {
        AppState.currentConversation = data.data;
        AppState.conversations.unshift({
          id: data.data.id,
          title: data.data.title,
          messageCount: 0,
          updatedAt: data.data.updatedAt
        });
        this.renderConversations();
        this.showConversation(data.data);
        UI.showToast('已创建新对话', 'success');
      }
    } catch (e) {
      UI.showToast('创建对话失败', 'error');
    }
  },

  // 选择对话
  async selectConversation(id) {
    try {
      const res = await fetch(`${API.conversations}/${id}`);
      const data = await res.json();
      if (data.success) {
        AppState.currentConversation = data.data;
        // 更新消息缓存（但如果对话正在流式传输中，保留缓存以避免丢失进度）
        if (!AppState.streamingConversations.has(id)) {
          AppState.conversationMessages.set(id, [...(data.data.messages || [])]);
        }
        this.renderConversations();
        this.showConversation(data.data);
      }
    } catch (e) {
      UI.showToast('加载对话失败', 'error');
    }
  },

  // 显示对话
  showConversation(conv) {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('messages').style.display = 'block';
    document.getElementById('conversationTitle').textContent = conv.title;
    document.getElementById('clearBtn').style.display = 'flex';
    document.getElementById('copyAllBtn').style.display = 'flex';
    
    // Update settings inputs
    document.getElementById('convTitleInput').value = conv.title;
    document.getElementById('systemPromptInput').value = conv.systemPrompt || '';

    // 获取消息列表（优先使用缓存，避免切换对话时消息丢失）
    let messages = AppState.conversationMessages.get(conv.id);
    if (!messages) {
      messages = conv.messages || [];
      AppState.conversationMessages.set(conv.id, [...messages]);
    }

    // Render messages
    const messagesDiv = document.getElementById('messages');
    messagesDiv.innerHTML = messages.map((msg, index) => UI.renderMessage(msg, index)).join('');
    
    // 恢复流式进度显示（如果有）
    const progress = AppState.conversationProgress.get(conv.id);
    if (progress && AppState.streamingConversations.has(conv.id)) {
      // 创建 AI 消息容器来显示进度（使用对话 ID 作为唯一标识）
      const aiMsgId = `ai-msg-${conv.id}`;
      messagesDiv.innerHTML += `
        <div class="message assistant" id="${aiMsgId}">
          <div class="message-avatar">
            <i class="fas fa-robot"></i>
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="message-name">AI</span>
            </div>
            <div class="message-text" id="${aiMsgId}-text">${progress.content || '<div class="loading-dots"><span></span><span></span><span></span></div>'}</div>
            <div class="tool-progress" id="${aiMsgId}-tools" style="display:${progress.toolCalls && progress.toolCalls.length > 0 ? 'block' : 'none'};"></div>
          </div>
        </div>
      `;
      // 恢复 tool_calls 进度
      if (progress.toolCalls && progress.toolCalls.length > 0) {
        UI.renderToolProgress(document.getElementById(`${aiMsgId}-tools`), progress.toolCalls);
      }
    }
    
    UI.scrollToBottom();
    
    // 更新发送按钮状态
    UI.updateSendButtonState();
    
    // 更新版本选择器
    UI.updateVersionSelector();
  },

  // 删除对话
  async deleteConversation(id) {
    if (!confirm('确定要删除这个对话吗？')) return;
    
    try {
      const res = await fetch(`${API.conversations}/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        AppState.conversations = AppState.conversations.filter(c => c.id !== id);
        // 清理相关缓存
        AppState.conversationMessages.delete(id);
        AppState.conversationProgress.delete(id);
        AppState.streamingConversations.delete(id);
        this.renderConversations();
        
        if (AppState.currentConversation?.id === id) {
          AppState.currentConversation = null;
          document.getElementById('welcomeScreen').style.display = 'flex';
          document.getElementById('messages').style.display = 'none';
          document.getElementById('conversationTitle').textContent = 'Fast-Agent 智能助手';
          document.getElementById('clearBtn').style.display = 'none';
          document.getElementById('copyAllBtn').style.display = 'none';
        }
        UI.showToast('已删除对话', 'success');
      }
    } catch (e) {
      UI.showToast('删除失败', 'error');
    }
  },

  // 清空对话
  async clearConversation() {
    if (!AppState.currentConversation) return;
    if (!confirm('确定要清空对话消息吗？')) return;
    
    try {
      const res = await fetch(`${API.conversations}/${AppState.currentConversation.id}/messages`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        AppState.currentConversation.messages = [];
        document.getElementById('messages').innerHTML = '';
        // 清理相关缓存
        AppState.conversationMessages.set(AppState.currentConversation.id, []);
        AppState.conversationProgress.delete(AppState.currentConversation.id);
        const conv = AppState.conversations.find(c => c.id === AppState.currentConversation.id);
        if (conv) {
          conv.messageCount = 0;
          this.renderConversations();
        }
        UI.showToast('已清空对话', 'success');
      }
    } catch (e) {
      UI.showToast('清空失败', 'error');
    }
  },

  // 保存对话设置
  async saveConversationSettings() {
    if (!AppState.currentConversation) {
      UI.showToast('请先选择对话', 'error');
      return;
    }
    
    const title = document.getElementById('convTitleInput').value;
    const systemPrompt = document.getElementById('systemPromptInput').value;
    
    try {
      const res = await fetch(`${API.conversations}/${AppState.currentConversation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, systemPrompt })
      });
      const data = await res.json();
      if (data.success) {
        AppState.currentConversation = data.data;
        document.getElementById('conversationTitle').textContent = title;
        const conv = AppState.conversations.find(c => c.id === AppState.currentConversation.id);
        if (conv) conv.title = title;
        this.renderConversations();
        UI.showToast('设置已保存', 'success');
      }
    } catch (e) {
      UI.showToast('保存失败', 'error');
    }
  },

  // 发送消息（流式）
  async sendMessage() {
    if (!AppState.currentConversation) {
      await this.createNewConversation();
      if (!AppState.currentConversation) return;
    }

    const conversationId = AppState.currentConversation.id;
    
    // 检查此对话是否正在流式传输
    if (AppState.streamingConversations.has(conversationId)) return;

    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    input.style.height = 'auto';
    
    // 标记此对话为流式传输中
    AppState.streamingConversations.add(conversationId);
    UI.updateSendButtonState();

    // 清空工具面板
    UI.clearToolsPanel();

    // Add user message to UI
    const userMsg = { role: 'user', content: message, timestamp: new Date().toISOString() };
    const messagesDiv = document.getElementById('messages');
    // 计算当前消息索引
    const currentMsgs = AppState.conversationMessages.get(conversationId) || [];
    messagesDiv.innerHTML += UI.renderMessage(userMsg, currentMsgs.length);
    UI.scrollToBottom();

    // Create AI message container for streaming (使用对话 ID 作为唯一标识)
    const aiMsgId = `ai-msg-${conversationId}`;
    // 先移除可能存在的旧元素（防止重复）
    const existingMsg = document.getElementById(aiMsgId);
    if (existingMsg) {
      existingMsg.remove();
    }
    messagesDiv.innerHTML += `
      <div class="message assistant" id="${aiMsgId}">
        <div class="message-avatar">
          <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-name">AI</span>
          </div>
          <div class="message-text" id="${aiMsgId}-text">
            <div class="loading-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
          <div class="tool-progress" id="${aiMsgId}-tools" style="display:none;"></div>
        </div>
      </div>
    `;
    UI.scrollToBottom();
    let fullContent = '';
    let toolCalls = [];
    const streamingState = { started: false };  // 追踪流式状态
    
    // 初始化此对话的进度状态
    AppState.conversationProgress.set(conversationId, {
      content: '',
      toolCalls: []
    });

    try {
      const res = await fetch(`${API.conversations}/${AppState.currentConversation.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              this.handleStreamEvent(event, toolCalls, streamingState, conversationId);
              
              if (event.type === 'done') {
                fullContent = event.content;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      // Update conversation list and local messages
      const conv = AppState.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.messageCount += 2;
        conv.updatedAt = new Date().toISOString();
        this.renderConversations();
      }
      
      // 更新本地消息缓存（用于切换对话后恢复）
      let msgs = AppState.conversationMessages.get(conversationId);
      if (!msgs) {
        msgs = [];
        AppState.conversationMessages.set(conversationId, msgs);
      }
      // 添加用户消息
      msgs.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });
      // 添加工具消息（如果有）
      for (const tc of toolCalls) {
        if (tc.status === 'success' || tc.status === 'error') {
          // 添加 assistant 消息（带 tool_calls）
          // 注意：这里需要重构，因为工具调用可能分散在多轮中
          // 我们在后端已经保存了完整消息，这里只是本地缓存
        }
      }
      // 添加 AI 回复（包含 tool_calls 信息）
      const assistantMsg = {
        role: 'assistant',
        content: fullContent,
        timestamp: new Date().toISOString()
      };
      // 如果有工具调用，也保存下来
      if (toolCalls && toolCalls.length > 0) {
        assistantMsg.tool_calls = toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: tc.rawArgs || tc.args
          }
        }));
      }
      msgs.push(assistantMsg);
      
      // 如果当前显示的是这个对话，也更新 currentConversation
      if (AppState.currentConversation && AppState.currentConversation.id === conversationId) {
        AppState.currentConversation.messages = [...msgs];
      }
    } catch (e) {
      const errorDiv = document.getElementById(`ai-msg-${conversationId}-text`);
      if (errorDiv) {
        errorDiv.innerHTML = '<span style="color: var(--error);">网络错误: ' + UI.escapeHtml(e.message) + '</span>';
      }
      UI.showToast('网络错误', 'error');
    } finally {
      // 清除此对话的流式状态
      AppState.streamingConversations.delete(conversationId);
      AppState.conversationProgress.delete(conversationId);
      UI.updateSendButtonState();
      
      // 移除流式消息容器并重新渲染消息列表（如果当前显示的是这个对话）
      if (AppState.currentConversation && AppState.currentConversation.id === conversationId) {
        const streamingMsg = document.getElementById(`ai-msg-${conversationId}`);
        if (streamingMsg) {
          streamingMsg.remove();
        }
        // 重新渲染消息列表
        const msgs = AppState.conversationMessages.get(conversationId) || [];
        const messagesDiv = document.getElementById('messages');
        messagesDiv.innerHTML = msgs.map((msg, index) => UI.renderMessage(msg, index)).join('');
        UI.scrollToBottom();
      }
    }
  },

  // 处理流式事件
  handleStreamEvent(event, toolCalls, streamingState, conversationId) {
    // 获取此对话的进度状态
    const progress = AppState.conversationProgress.get(conversationId);
    // 检查当前显示的对话是否是事件所属的对话
    const isCurrentConversation = AppState.currentConversation && AppState.currentConversation.id === conversationId;
    
    // 每次都动态获取 DOM 元素（基于对话 ID）
    const aiMsgId = `ai-msg-${conversationId}`;
    const activeTextDiv = document.getElementById(`${aiMsgId}-text`);
    const activeToolsDiv = document.getElementById(`${aiMsgId}-tools`);
    
    switch (event.type) {
      case 'text_chunk':
        // 流式文本块 - 实时追加显示
        if (!streamingState.started) {
          // 首次收到内容，清除 loading 动画
          if (activeTextDiv) {
            activeTextDiv.innerHTML = '';
          }
          streamingState.started = true;
        }
        // 累积内容到 progress（无论 DOM 是否存在）
        if (progress) {
          progress.content = (progress.content || '') + UI.escapeHtml(event.content);
        }
        // 更新 DOM（如果存在）
        if (activeTextDiv) {
          activeTextDiv.innerHTML = progress.content;
        }
        if (isCurrentConversation) {
          UI.scrollToBottom();
        }
        break;

      case 'content':
        // AI thinking content (usually not shown in UI)
        break;

      case 'tool_call':
        // Show tool progress in message
        if (activeToolsDiv) {
          activeToolsDiv.style.display = 'block';
        }
        const toolCallItem = {
          id: event.id || `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: event.name,
          args: event.args,
          rawArgs: event.rawArgs,
          status: 'pending',
          startTime: event.startTime || new Date().toISOString()
        };
        toolCalls.push(toolCallItem);
        if (activeToolsDiv) {
          UI.renderToolProgress(activeToolsDiv, toolCalls);
        }
        // 渲染到右侧工具面板
        UI.renderToolCard(toolCallItem, conversationId);
        // 保存进度
        if (progress) {
          progress.toolCalls = [...toolCalls];
        }
        break;

      case 'tool_result':
        // Update tool status - 使用 id 匹配
        const tool = toolCalls.find(t => t.id === event.id || t.status === 'pending');
        if (tool) {
          tool.status = event.success ? 'success' : 'error';
          tool.error = event.error;
          tool.result = event.result;
          tool.rawResult = event.rawResult;
          tool.duration = event.duration;
          tool.endTime = event.endTime || new Date().toISOString();
        }
        if (activeToolsDiv) {
          UI.renderToolProgress(activeToolsDiv, toolCalls);
        }
        // 更新右侧工具面板
        if (tool) {
          UI.renderToolCard(tool, conversationId);
        }
        // 保存进度
        if (progress) {
          progress.toolCalls = [...toolCalls];
        }
        break;

      case 'done':
        // Final response - 如果没有收到过 text_chunk，用 done 的内容
        if (!streamingState.started) {
          if (activeTextDiv) {
            activeTextDiv.innerHTML = UI.escapeHtml(event.content);
          }
        }
        break;

      case 'error':
        if (activeTextDiv) {
          activeTextDiv.innerHTML = '<span style="color: var(--error);">错误: ' + UI.escapeHtml(event.error) + '</span>';
        }
        break;

      case 'tool_log':
        // 工具执行日志 - 添加到工具卡片
        UI.addToolLog(event, conversationId);
        break;
    }
  }
};

// 导出
window.ConversationManager = ConversationManager;
