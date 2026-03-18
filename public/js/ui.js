/**
 * UI 工具函数
 */
const UI = {
  // 侧边栏状态
  leftSidebarCollapsed: false,
  toolsPanelCollapsed: false,

  // 滚动到底部
  scrollToBottom() {
    const container = document.getElementById('chatContainer');
    container.scrollTop = container.scrollHeight;
  },

  // 切换左侧边栏
  toggleLeftSidebar() {
    const sidebar = document.getElementById('leftSidebar');
    const expandBtn = document.getElementById('leftSidebarExpand');
    
    // 小屏幕使用 open 类，大屏幕使用 collapsed 类
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('open');
    } else {
      this.leftSidebarCollapsed = !this.leftSidebarCollapsed;
      if (this.leftSidebarCollapsed) {
        sidebar.classList.add('collapsed');
        expandBtn.classList.add('visible');
      } else {
        sidebar.classList.remove('collapsed');
        expandBtn.classList.remove('visible');
      }
    }
  },

  // 切换工具面板
  toggleToolsPanel() {
    const panel = document.getElementById('toolsPanel');
    const expandBtn = document.getElementById('toolsPanelExpand');
    
    // 小屏幕使用 open 类，大屏幕使用 collapsed 类
    if (window.innerWidth <= 768) {
      panel.classList.toggle('open');
    } else {
      this.toolsPanelCollapsed = !this.toolsPanelCollapsed;
      if (this.toolsPanelCollapsed) {
        panel.classList.add('collapsed');
        expandBtn.classList.add('visible');
      } else {
        panel.classList.remove('collapsed');
        expandBtn.classList.remove('visible');
      }
    }
  },

  // 格式化日期
  formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
    
    return date.toLocaleDateString('zh-CN');
  },

  // HTML 转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // 复制到剪贴板
  async copyToClipboard(text, buttonEl) {
    try {
      await navigator.clipboard.writeText(text);
      // 显示复制成功状态
      const originalHtml = buttonEl.innerHTML;
      buttonEl.innerHTML = '<i class="fas fa-check"></i>';
      buttonEl.classList.add('copied');
      setTimeout(() => {
        buttonEl.innerHTML = originalHtml;
        buttonEl.classList.remove('copied');
      }, 1500);
      this.showToast('已复制到剪贴板', 'success');
    } catch (e) {
      this.showToast('复制失败', 'error');
    }
  },

  // 复制工具卡片值
  copyToolValue(elementId, fullText) {
    const container = document.getElementById(elementId);
    if (!container) return;
    
    // 获取完整内容（优先从 value-full，否则从传入的 fullText）
    const full = container.querySelector('.value-full');
    const copyBtn = container.closest('.tool-card-section').querySelector('.copy-btn');
    
    let text = fullText;
    if (full && full.style.display !== 'none') {
      text = full.textContent;
    }
    
    this.copyToClipboard(text, copyBtn);
  },

  // 直接复制文本
  copyText(text, buttonEl) {
    this.copyToClipboard(text, buttonEl);
  },

  // 显示 Toast 通知
  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // 自动调整文本框高度
  autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  },

   // 渲染消息
  renderMessage(msg, msgIndex) {
    const isUser = msg.role === 'user';
    const isTool = msg.role === 'tool';
    const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 工具消息不单独显示（会在 assistant 消息中显示）
    if (isTool) {
      return '';
    }
    
    // 处理助手消息中的工具调用
    let toolCallsHtml = '';
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      toolCallsHtml = `
        <div class="tool-progress" style="display:block;">
          ${msg.tool_calls.map(tc => {
            const toolName = tc.function?.name || 'unknown';
            return `<div class="tool-progress-item success">
              <i class="fas fa-check" style="color: var(--success);"></i>
              <span>${this.escapeHtml(toolName)}</span>
              <span class="status">已执行</span>
            </div>`;
          }).join('')}
        </div>
      `;
    }
    
    // 用户消息：编辑按钮
    const userActions = isUser ? `
      <button class="msg-action-btn edit-btn" onclick="UI.startEditMessage('${msgId}', ${msgIndex})" title="编辑消息">
        <i class="fas fa-pen"></i>
      </button>
    ` : '';
    
    // AI消息：重新生成按钮（支持长按选择模型）
    const aiActions = !isUser ? `
      <button class="msg-action-btn regen-btn" 
              onclick="UI.regenerateMessage(event, ${msgIndex})" 
              onmousedown="UI.startRegenLongPress(event, ${msgIndex})"
              onmouseup="UI.endRegenLongPress()"
              onmouseleave="UI.endRegenLongPress()"
              title="重新生成（长按选择模型）">
        <i class="fas fa-rotate-right"></i>
      </button>
    ` : '';
    
    return `
      <div class="message ${msg.role}" id="${msgId}" data-msg-index="${msgIndex}">
        <div class="message-avatar">
          <i class="fas fa-${isUser ? 'user' : 'robot'}"></i>
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-name">${isUser ? '你' : 'AI'}</span>
            <span class="message-time">${time}</span>
            <div class="message-actions">
              <button class="copy-btn msg-copy-btn" onclick="UI.copyMessage('${msgId}')" title="复制消息">
                <i class="fas fa-copy"></i>
              </button>
              ${userActions}
              ${aiActions}
            </div>
          </div>
          <div class="message-text" id="${msgId}-text">${this.escapeHtml(msg.content || '')}</div>
          ${toolCallsHtml}
        </div>
      </div>
    `;
  },

  // 复制单条消息
  copyMessage(msgId) {
    const msgEl = document.getElementById(msgId);
    if (!msgEl) return;
    
    const nameEl = msgEl.querySelector('.message-name');
    const textEl = msgEl.querySelector('.message-text');
    const copyBtn = msgEl.querySelector('.msg-copy-btn');
    
    if (!textEl) return;
    
    const name = nameEl ? nameEl.textContent : '';
    const text = textEl.textContent;
    const fullText = `【${name}】\n${text}`;
    
    this.copyToClipboard(fullText, copyBtn);
  },

  // 复制全部消息
  copyAllMessages() {
    const messagesDiv = document.getElementById('messages');
    if (!messagesDiv) return;
    
    const messages = messagesDiv.querySelectorAll('.message');
    if (messages.length === 0) {
      this.showToast('没有消息可复制', 'error');
      return;
    }
    
    const lines = [];
    messages.forEach(msg => {
      const nameEl = msg.querySelector('.message-name');
      const textEl = msg.querySelector('.message-text');
      if (nameEl && textEl) {
        lines.push(`【${nameEl.textContent}】`);
        lines.push(textEl.textContent);
        lines.push(''); // 空行分隔
      }
    });
    
    const fullText = lines.join('\n');
    const copyBtn = document.getElementById('copyAllBtn');
    this.copyToClipboard(fullText, copyBtn);
  },

  // 渲染工具进度（消息内的简化版本）
  renderToolProgress(container, toolCalls) {
    container.innerHTML = toolCalls.map(tool => {
      const icon = tool.status === 'pending' ? '<div class="spinner"></div>' :
                   tool.status === 'success' ? '<i class="fas fa-check" style="color: var(--success);"></i>' :
                   '<i class="fas fa-times" style="color: var(--error);"></i>';
      const statusText = tool.status === 'pending' ? '执行中...' :
                        tool.status === 'success' ? '成功' : '失败';
      return `<div class="tool-progress-item ${tool.status}">
        ${icon}
        <span>${this.escapeHtml(tool.name)}</span>
        <span class="status">${statusText}</span>
      </div>`;
    }).join('');
  },

  // 渲染工具卡片到右侧面板
  renderToolCard(tool, conversationId) {
    const container = document.getElementById('toolsPanelContent');
    
    // 移除空状态提示
    const empty = container.querySelector('.tools-empty');
    if (empty) empty.remove();
    
    // 查找或创建工具卡片
    let card = document.getElementById(`tool-card-${tool.id}`);
    
    const statusIcon = tool.status === 'pending' ? '<div class="spinner"></div>' :
                       tool.status === 'success' ? '<i class="fas fa-check-circle"></i>' :
                       '<i class="fas fa-times-circle"></i>';
    const statusText = tool.status === 'pending' ? '执行中' :
                       tool.status === 'success' ? '成功' : '失败';
    
    // 解析参数
    let rawArgsStr = tool.rawArgs || '';
    let parsedArgsStr = '';
    if (tool.args) {
      try {
        const parsed = typeof tool.args === 'string' ? JSON.parse(tool.args) : tool.args;
        parsedArgsStr = JSON.stringify(parsed, null, 2);
        if (!rawArgsStr) rawArgsStr = tool.args;
      } catch (e) {
        parsedArgsStr = tool.args;
      }
    }
    
    // 结果
    const resultStr = tool.rawResult || tool.result || '';
    const errorStr = tool.error || '';
    
    // 耗时
    const durationStr = tool.duration ? `${tool.duration}ms` : '';
    
    const cardHtml = `
      <div class="tool-card" id="tool-card-${tool.id}">
        <div class="tool-card-header" onclick="UI.toggleToolCardBody('${tool.id}')">
          <div class="tool-card-name">
            <i class="fas fa-cog"></i>
            ${this.escapeHtml(tool.name)}
          </div>
          <div class="tool-card-status ${tool.status}">
            ${statusIcon}
            <span>${statusText}</span>
            ${durationStr ? `<span class="tool-duration">${durationStr}</span>` : ''}
          </div>
        </div>
        <div class="tool-card-body" id="tool-card-body-${tool.id}">
          <!-- LLM 原始传参 -->
          ${rawArgsStr ? `<div class="tool-card-section">
            <div class="tool-card-label">
              <span>LLM 传参 (原始)</span>
              <button class="copy-btn" onclick="event.stopPropagation(); UI.copyToolValue('raw-args-${tool.id}', '${this.escapeHtml(rawArgsStr).replace(/'/g, "\\'")}')" title="复制">
                <i class="fas fa-copy"></i>
              </button>
            </div>
            <div class="tool-card-value collapsible" id="raw-args-${tool.id}" data-full-value="${this.escapeHtml(rawArgsStr).replace(/"/g, '&quot;')}">
              <div class="value-preview" onclick="UI.toggleValueExpand('raw-args-${tool.id}')">
                ${this.escapeHtml(rawArgsStr.substring(0, 200))}${rawArgsStr.length > 200 ? '... <span class="expand-hint">[点击展开]</span>' : ''}
              </div>
              <div class="value-full" style="display:none;">${this.escapeHtml(rawArgsStr)}</div>
            </div>
          </div>` : ''}
          <!-- 解析后的参数 -->
          ${parsedArgsStr && parsedArgsStr !== rawArgsStr ? `<div class="tool-card-section">
            <div class="tool-card-label">
              <span>参数 (解析后)</span>
              <button class="copy-btn" onclick="event.stopPropagation(); UI.copyToolValue('parsed-args-${tool.id}', '${this.escapeHtml(parsedArgsStr).replace(/'/g, "\\'")}')" title="复制">
                <i class="fas fa-copy"></i>
              </button>
            </div>
            <div class="tool-card-value collapsible" id="parsed-args-${tool.id}" data-full-value="${this.escapeHtml(parsedArgsStr).replace(/"/g, '&quot;')}">
              <div class="value-preview" onclick="UI.toggleValueExpand('parsed-args-${tool.id}')">
                ${this.escapeHtml(parsedArgsStr.substring(0, 300))}${parsedArgsStr.length > 300 ? '... <span class="expand-hint">[点击展开]</span>' : ''}
              </div>
              <div class="value-full" style="display:none;">${this.escapeHtml(parsedArgsStr)}</div>
            </div>
          </div>` : ''}
          <!-- 执行结果 -->
          ${resultStr && tool.status === 'success' ? `<div class="tool-card-section">
            <div class="tool-card-label">
              <span>LLM 收到的结果</span>
              <button class="copy-btn" onclick="event.stopPropagation(); UI.copyToolValue('result-${tool.id}', '${this.escapeHtml(resultStr).replace(/'/g, "\\'")}')" title="复制">
                <i class="fas fa-copy"></i>
              </button>
            </div>
            <div class="tool-card-value collapsible success" id="result-${tool.id}" data-full-value="${this.escapeHtml(resultStr).replace(/"/g, '&quot;')}">
              <div class="value-preview" onclick="UI.toggleValueExpand('result-${tool.id}')">
                ${this.escapeHtml(resultStr.substring(0, 300))}${resultStr.length > 300 ? '... <span class="expand-hint">[点击展开]</span>' : ''}
              </div>
              <div class="value-full" style="display:none;">${this.escapeHtml(resultStr)}</div>
            </div>
          </div>` : ''}
          <!-- 错误信息 -->
          ${errorStr && tool.status === 'error' ? `<div class="tool-card-section">
            <div class="tool-card-label" style="color: var(--error);">
              <span>错误信息</span>
              <button class="copy-btn" onclick="event.stopPropagation(); UI.copyText('${this.escapeHtml(errorStr).replace(/'/g, "\\'")}', this)" title="复制">
                <i class="fas fa-copy"></i>
              </button>
            </div>
            <div class="tool-card-value error">${this.escapeHtml(errorStr)}</div>
          </div>` : ''}
          <!-- 时间信息 -->
          <div class="tool-card-meta">
            ${tool.startTime ? `<span><i class="fas fa-play"></i> ${new Date(tool.startTime).toLocaleTimeString('zh-CN')}</span>` : ''}
            ${tool.endTime ? `<span><i class="fas fa-stop"></i> ${new Date(tool.endTime).toLocaleTimeString('zh-CN')}</span>` : ''}
            ${durationStr ? `<span><i class="fas fa-clock"></i> ${durationStr}</span>` : ''}
          </div>
        </div>
      </div>
    `;
    
    if (card) {
      card.outerHTML = cardHtml;
    } else {
      container.insertAdjacentHTML('beforeend', cardHtml);
    }
    
    // 滚动到底部
    container.scrollTop = container.scrollHeight;
  },

  // 切换值展开/折叠
  toggleValueExpand(elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;
    
    const preview = container.querySelector('.value-preview');
    const full = container.querySelector('.value-full');
    
    if (full.style.display === 'none') {
      preview.style.display = 'none';
      full.style.display = 'block';
    } else {
      preview.style.display = 'block';
      full.style.display = 'none';
    }
  },

  // 切换工具卡片展开/折叠
  toggleToolCardBody(toolId) {
    const body = document.getElementById(`tool-card-body-${toolId}`);
    if (body) {
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
    }
  },

  // 清空工具面板
  clearToolsPanel() {
    const container = document.getElementById('toolsPanelContent');
    container.innerHTML = `
      <div class="tools-empty">
        <i class="fas fa-cog"></i>
        <p>工具调用将在这里显示</p>
      </div>
    `;
  },

  // 添加工具执行日志
  addToolLog(event, conversationId) {
    // 找到对应的工具卡片
    const cards = document.querySelectorAll('.tool-card');
    let targetCard = null;
    
    // 查找匹配的工具卡片（按名称匹配最后一个 pending 状态的）
    for (const card of cards) {
      const nameEl = card.querySelector('.tool-card-name');
      if (nameEl && nameEl.textContent.trim().includes(event.toolName)) {
        const statusEl = card.querySelector('.tool-card-status');
        if (statusEl && statusEl.classList.contains('pending')) {
          targetCard = card;
        }
      }
    }
    
    if (!targetCard) return;
    
    // 查找或创建日志容器
    let logsContainer = targetCard.querySelector('.tool-logs');
    if (!logsContainer) {
      const body = targetCard.querySelector('.tool-card-body');
      if (!body) return;
      
      logsContainer = document.createElement('div');
      logsContainer.className = 'tool-logs';
      body.appendChild(logsContainer);
    }
    
    // 添加日志条目
    const logEntry = document.createElement('div');
    logEntry.className = `tool-log-entry ${event.level}`;
    logEntry.innerHTML = `
      <span class="log-time">${new Date(event.timestamp).toLocaleTimeString('zh-CN')}</span>
      <span class="log-level">${event.level.toUpperCase()}</span>
      <span class="log-message">${this.escapeHtml(event.message)}</span>
    `;
    logsContainer.appendChild(logEntry);
    
    // 滚动到底部
    logsContainer.scrollTop = logsContainer.scrollHeight;
  },

  // 更新发送按钮状态
  updateSendButtonState() {
    const btn = document.getElementById('sendBtn');
    if (!AppState.currentConversation) {
      btn.disabled = false;
      return;
    }
    btn.disabled = AppState.streamingConversations.has(AppState.currentConversation.id);
  },

  // ==================== 消息编辑功能 ====================
  
  // 开始编辑消息
  startEditMessage(msgId, msgIndex) {
    const msgEl = document.getElementById(msgId);
    if (!msgEl) return;
    
    const textEl = msgEl.querySelector('.message-text');
    const originalText = textEl.textContent;
    
    // 替换为编辑框
    textEl.innerHTML = `
      <div class="edit-container">
        <textarea class="edit-textarea" id="${msgId}-edit-input">${this.escapeHtml(originalText)}</textarea>
        <div class="edit-actions">
          <button class="edit-btn cancel" onclick="UI.cancelEditMessage('${msgId}', '${this.escapeHtml(originalText).replace(/'/g, "\\'")}')">
            <i class="fas fa-times"></i> 取消
          </button>
          <button class="edit-btn confirm" onclick="UI.confirmEditMessage('${msgId}', ${msgIndex})">
            <i class="fas fa-check"></i> 确认发送
          </button>
        </div>
      </div>
    `;
    
    // 聚焦并调整高度
    const textarea = document.getElementById(`${msgId}-edit-input`);
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    this.autoResize(textarea);
  },
  
  // 取消编辑消息
  cancelEditMessage(msgId, originalText) {
    const msgEl = document.getElementById(msgId);
    if (!msgEl) return;
    
    const textEl = msgEl.querySelector('.message-text');
    textEl.textContent = originalText;
  },
  
  // 确认编辑消息（克隆对话产生新版本）
  async confirmEditMessage(msgId, msgIndex) {
    const textarea = document.getElementById(`${msgId}-edit-input`);
    if (!textarea) return;
    
    const newContent = textarea.value.trim();
    if (!newContent) {
      this.showToast('消息内容不能为空', 'error');
      return;
    }
    
    if (!AppState.currentConversation) {
      this.showToast('请先选择对话', 'error');
      return;
    }
    
    try {
      // 调用后端API编辑消息（会自动克隆对话）
      const res = await fetch(`/api/conversations/${AppState.currentConversation.id}/messages/${msgIndex}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent })
      });
      
      const data = await res.json();
      if (data.success) {
        // 切换到新对话
        AppState.currentConversation = data.data;
        AppState.conversationMessages.set(data.data.id, data.data.messages || []);
        
        // 刷新对话列表
        await ConversationManager.loadConversations();
        
        // 显示新对话
        ConversationManager.showConversation(data.data);
        
        // 发送编辑后的消息获取新回复
        await this.sendEditedMessage(newContent);
        
        this.showToast('已创建新版本', 'success');
      }
    } catch (e) {
      this.showToast('编辑失败', 'error');
      console.error('编辑消息失败:', e);
    }
  },
  
  // 发送编辑后的消息
  async sendEditedMessage(message) {
    const conversationId = AppState.currentConversation.id;
    
    if (AppState.streamingConversations.has(conversationId)) return;
    
    AppState.streamingConversations.add(conversationId);
    this.updateSendButtonState();
    this.clearToolsPanel();
    
    const messagesDiv = document.getElementById('messages');
    
    // 创建AI消息容器
    const aiMsgId = `ai-msg-${conversationId}`;
    const existingMsg = document.getElementById(aiMsgId);
    if (existingMsg) existingMsg.remove();
    
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
    this.scrollToBottom();
    
    let toolCalls = [];
    const streamingState = { started: false };
    
    AppState.conversationProgress.set(conversationId, { content: '', toolCalls: [] });
    
    try {
      const res = await fetch(`${API.conversations}/${conversationId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      
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
              ConversationManager.handleStreamEvent(event, toolCalls, streamingState, conversationId);
              if (event.type === 'done') fullContent = event.content;
            } catch (e) {}
          }
        }
      }
      
      // 更新消息缓存
      let msgs = AppState.conversationMessages.get(conversationId) || [];
      msgs.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
      msgs.push({ role: 'assistant', content: fullContent, timestamp: new Date().toISOString() });
      AppState.conversationMessages.set(conversationId, msgs);
      
    } catch (e) {
      const errorDiv = document.getElementById(`${aiMsgId}-text`);
      if (errorDiv) {
        errorDiv.innerHTML = '<span style="color: var(--error);">网络错误: ' + this.escapeHtml(e.message) + '</span>';
      }
    } finally {
      AppState.streamingConversations.delete(conversationId);
      AppState.conversationProgress.delete(conversationId);
      this.updateSendButtonState();
      
      // 重新渲染
      const streamingMsg = document.getElementById(`ai-msg-${conversationId}`);
      if (streamingMsg) streamingMsg.remove();
      
      const msgs = AppState.conversationMessages.get(conversationId) || [];
      const messagesDiv = document.getElementById('messages');
      messagesDiv.innerHTML = msgs.map((msg, index) => this.renderMessage(msg, index)).join('');
      this.scrollToBottom();
    }
  },

  // ==================== 重新生成功能 ====================
  
  longPressTimer: null,
  longPressTriggered: false,
  
  // 开始长按检测
  startRegenLongPress(event, msgIndex) {
    this.longPressTriggered = false;
    this.longPressTimer = setTimeout(() => {
      this.longPressTriggered = true;
      this.showModelSelector(event, msgIndex);
    }, 500); // 500ms 触发长按
  },
  
  // 结束长按检测
  endRegenLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  },
  
  // 显示模型选择器
  async showModelSelector(event, msgIndex) {
    event.preventDefault();
    event.stopPropagation();
    
    // 获取可用提供商
    try {
      const res = await fetch(API.providers);
      const data = await res.json();
      if (!data.success) return;
      
      const providers = data.data;
      
      // 创建模型选择器
      let selector = document.getElementById('model-selector-popup');
      if (!selector) {
        selector = document.createElement('div');
        selector.id = 'model-selector-popup';
        selector.className = 'model-selector-popup';
        document.body.appendChild(selector);
      }
      
      selector.innerHTML = `
        <div class="model-selector-header">
          <i class="fas fa-robot"></i> 选择模型重新生成
        </div>
        <div class="model-selector-list">
          ${providers.map(p => `
            <div class="model-selector-item" onclick="UI.regenerateWithModel('${p.name}', '${p.model || ''}', ${msgIndex})">
              <span class="model-name">${p.name}</span>
              <span class="model-info">${p.model || '默认'}</span>
            </div>
          `).join('')}
        </div>
      `;
      
      // 定位
      const rect = event.target.getBoundingClientRect();
      selector.style.top = `${rect.bottom + 5}px`;
      selector.style.left = `${Math.max(10, rect.left - 100)}px`;
      selector.classList.add('active');
      
      // 点击其他地方关闭
      const closeHandler = (e) => {
        if (!selector.contains(e.target)) {
          selector.classList.remove('active');
          document.removeEventListener('click', closeHandler);
        }
      };
      setTimeout(() => document.addEventListener('click', closeHandler), 100);
      
    } catch (e) {
      console.error('获取模型列表失败:', e);
    }
  },
  
  // 使用指定模型重新生成
  async regenerateWithModel(provider, model, msgIndex) {
    // 关闭选择器
    const selector = document.getElementById('model-selector-popup');
    if (selector) selector.classList.remove('active');
    
    await this.doRegenerate(msgIndex, provider, model);
  },
  
  // 重新生成消息（普通点击）
  async regenerateMessage(event, msgIndex) {
    if (this.longPressTriggered) return; // 长按已触发，不处理点击
    await this.doRegenerate(msgIndex);
  },
  
  // 执行重新生成
  async doRegenerate(msgIndex, provider = null, model = null) {
    if (!AppState.currentConversation) {
      this.showToast('请先选择对话', 'error');
      return;
    }
    
    const conversationId = AppState.currentConversation.id;
    if (AppState.streamingConversations.has(conversationId)) return;
    
    AppState.streamingConversations.add(conversationId);
    this.updateSendButtonState();
    this.clearToolsPanel();
    
    const messagesDiv = document.getElementById('messages');
    
    // 创建AI消息容器
    const aiMsgId = `ai-msg-${conversationId}`;
    const existingMsg = document.getElementById(aiMsgId);
    if (existingMsg) existingMsg.remove();
    
    messagesDiv.innerHTML += `
      <div class="message assistant" id="${aiMsgId}">
        <div class="message-avatar">
          <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-name">AI</span>
            ${provider ? `<span class="model-badge">${provider}</span>` : ''}
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
    this.scrollToBottom();
    
    let toolCalls = [];
    const streamingState = { started: false };
    AppState.conversationProgress.set(conversationId, { content: '', toolCalls: [] });
    
    try {
      // 调用重新生成API
      const res = await fetch(`/api/conversations/${conversationId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, msgIndex })
      });
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let newConversationId = null;
      
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
              ConversationManager.handleStreamEvent(event, toolCalls, streamingState, conversationId);
              if (event.type === 'done') {
                fullContent = event.content;
                newConversationId = event.newConversationId;
              }
            } catch (e) {}
          }
        }
      }
      
      // 如果创建了新对话，切换到新对话
      if (newConversationId && newConversationId !== conversationId) {
        await ConversationManager.selectConversation(newConversationId);
        await ConversationManager.loadConversations();
        this.showToast('已创建新版本', 'success');
      } else {
        // 更新当前对话的消息缓存
        const conv = await fetch(`${API.conversations}/${conversationId}`);
        const convData = await conv.json();
        if (convData.success) {
          AppState.conversationMessages.set(conversationId, convData.data.messages || []);
          AppState.currentConversation = convData.data;
        }
      }
      
    } catch (e) {
      const errorDiv = document.getElementById(`${aiMsgId}-text`);
      if (errorDiv) {
        errorDiv.innerHTML = '<span style="color: var(--error);">重新生成失败: ' + this.escapeHtml(e.message) + '</span>';
      }
      this.showToast('重新生成失败', 'error');
    } finally {
      AppState.streamingConversations.delete(conversationId);
      AppState.conversationProgress.delete(conversationId);
      this.updateSendButtonState();
      
      // 重新渲染
      const streamingMsg = document.getElementById(`ai-msg-${conversationId}`);
      if (streamingMsg) streamingMsg.remove();
      
      const msgs = AppState.conversationMessages.get(AppState.currentConversation?.id) || [];
      messagesDiv.innerHTML = msgs.map((msg, index) => this.renderMessage(msg, index)).join('');
      this.scrollToBottom();
    }
  },

  // ==================== 版本管理功能 ====================
  
  // 切换版本列表显示
  toggleVersionList() {
    const list = document.getElementById('versionList');
    if (!list) return;
    
    if (list.classList.contains('active')) {
      list.classList.remove('active');
    } else {
      this.loadVersions();
      list.classList.add('active');
    }
  },
  
  // 加载版本列表
  async loadVersions() {
    if (!AppState.currentConversation) return;
    
    try {
      const res = await fetch(`/api/conversations/${AppState.currentConversation.id}/versions`);
      const data = await res.json();
      if (data.success) {
        this.renderVersionList(data.data);
      }
    } catch (e) {
      console.error('加载版本列表失败:', e);
    }
  },
  
  // 渲染版本列表
  renderVersionList(versions) {
    const list = document.getElementById('versionList');
    if (!list) return;
    
    if (versions.length <= 1) {
      // 只有一个版本，隐藏选择器
      document.getElementById('versionSelector').style.display = 'none';
      return;
    }
    
    // 显示选择器
    document.getElementById('versionSelector').style.display = 'block';
    
    // 更新当前版本号
    const current = versions.find(v => v.isCurrent);
    if (current) {
      document.getElementById('currentVersion').textContent = current.versionId;
    }
    
    list.innerHTML = versions.map(v => `
      <div class="version-item ${v.isCurrent ? 'current' : ''}" onclick="UI.switchToVersion('${v.id}')">
        <div class="version-info">
          <span class="version-id">${v.versionId}</span>
          <span class="version-meta">${v.messageCount} 条消息 · ${this.formatDate(v.updatedAt)}</span>
        </div>
        ${v.isCurrent ? '<span class="version-badge">当前</span>' : ''}
      </div>
    `).join('');
  },
  
  // 切换到指定版本
  async switchToVersion(conversationId) {
    // 关闭版本列表
    const list = document.getElementById('versionList');
    if (list) list.classList.remove('active');
    
    // 切换对话
    await ConversationManager.selectConversation(conversationId);
    await ConversationManager.loadConversations();
  },
  
  // 更新版本选择器状态
  updateVersionSelector() {
    if (!AppState.currentConversation) {
      document.getElementById('versionSelector').style.display = 'none';
      return;
    }
    
    // 异步加载版本
    this.loadVersions();
  }
};

// 导出 UI
window.UI = UI;
