/**
 * MCP 配置模块
 */
const MCPManager = {
  // 加载 MCP 配置
  loadMCPConfig() {
    const mcp = AppState.config.mcp?.httpServer || {};
    
    // Toggle states
    document.getElementById('mcpEnabled').classList.toggle('active', mcp.enabled);
    document.getElementById('readOnlyMode').classList.toggle('active', mcp.readOnly);
    
    // Access control
    document.getElementById('accessControl').value = mcp.accessControl || 'all';
    this.toggleAccessControlUI();
    
    // Whitelist
    this.renderTags('whitelistTags', mcp.whitelist || [], 'MCPManager.removeWhitelist');
    
    // Blacklist
    this.renderTags('blacklistTags', mcp.blacklist || [], 'MCPManager.removeBlacklist');
    
    // Disabled tools
    this.renderTags('disabledToolsTags', mcp.disabledTools || [], 'MCPManager.removeDisabledTool');
  },

  // 切换 MCP 启用状态
  toggleMCPEnabled() {
    const toggle = document.getElementById('mcpEnabled');
    toggle.classList.toggle('active');
  },

  // 切换只读模式
  toggleReadOnly() {
    document.getElementById('readOnlyMode').classList.toggle('active');
  },

  // 切换访问控制 UI
  toggleAccessControlUI() {
    const mode = document.getElementById('accessControl').value;
    document.getElementById('whitelistGroup').style.display = mode === 'whitelist' ? 'block' : 'none';
    document.getElementById('blacklistGroup').style.display = mode === 'blacklist' ? 'block' : 'none';
  },

  // 更新 MCP 配置
  updateMCPConfig() {
    this.toggleAccessControlUI();
  },

  // 渲染标签
  renderTags(containerId, tags, removeFn) {
    const container = document.getElementById(containerId);
    const input = container.querySelector('.tag-input');
    container.innerHTML = tags.map(tag => `
      <span class="tag">
        ${tag}
        <button class="tag-remove" onclick="${removeFn}('${tag}')">&times;</button>
      </span>
    `).join('') + '<input type="text" class="tag-input" placeholder="输入后按 Enter" onkeydown="MCPManager.handleTagInput(event, \'' + containerId + '\')">';
  },

  // 处理标签输入
  handleTagInput(e, containerId) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const input = e.target;
      const value = input.value.trim();
      if (value) {
        const container = document.getElementById(containerId);
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.innerHTML = `${value}<button class="tag-remove" onclick="this.parentElement.remove()">&times;</button>`;
        container.insertBefore(tag, input);
        input.value = '';
      }
    }
  },

  // 添加白名单
  addWhitelist(e) {
    this.handleTagInput(e, 'whitelistTags');
  },

  // 移除白名单
  removeWhitelist(ip) {
    event.target.closest('.tag').remove();
  },

  // 添加黑名单
  addBlacklist(e) {
    this.handleTagInput(e, 'blacklistTags');
  },

  // 移除黑名单
  removeBlacklist(ip) {
    event.target.closest('.tag').remove();
  },

  // 添加禁用工具
  addDisabledTool(e) {
    this.handleTagInput(e, 'disabledToolsTags');
  },

  // 移除禁用工具
  removeDisabledTool(tool) {
    event.target.closest('.tag').remove();
  },

  // 获取标签列表
  getTags(containerId) {
    const container = document.getElementById(containerId);
    return Array.from(container.querySelectorAll('.tag')).map(t => t.textContent.replace('×', '').trim());
  },

  // 保存 MCP 配置
  async saveMCPConfig() {
    const mcpConfig = {
      httpServer: {
        enabled: document.getElementById('mcpEnabled').classList.contains('active'),
        accessControl: document.getElementById('accessControl').value,
        whitelist: this.getTags('whitelistTags'),
        blacklist: this.getTags('blacklistTags'),
        readOnly: document.getElementById('readOnlyMode').classList.contains('active'),
        disabledTools: this.getTags('disabledToolsTags')
      }
    };
    
    try {
      const res = await fetch(API.mcp, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mcpConfig.httpServer)
      });
      const data = await res.json();
      if (data.success) {
        UI.showToast('MCP 配置已保存', 'success');
      }
    } catch (e) {
      UI.showToast('保存失败', 'error');
    }
  }
};

// 导出
window.MCPManager = MCPManager;
