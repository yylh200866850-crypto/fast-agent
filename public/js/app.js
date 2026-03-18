/**
 * 主应用入口
 */
const App = {
  // 加载提供商列表
  async loadProviders() {
    try {
      const res = await fetch(API.providers);
      const data = await res.json();
      if (data.success) {
        this.renderProviders(data.data);
      }
    } catch (e) {}
  },

  // 渲染提供商列表
  renderProviders(providers) {
    const list = document.getElementById('providerList');
    list.innerHTML = providers.map(p => `
      <div class="provider-card ${p.name === AppState.config.defaultProvider ? 'active' : ''}" 
           onclick="App.setDefaultProvider('${p.name}')">
        <div class="provider-info">
          <h4>${p.name}</h4>
          <p>${p.model || 'N/A'}</p>
        </div>
        ${p.name === AppState.config.defaultProvider ? '<span class="provider-badge">默认</span>' : ''}
      </div>
    `).join('');
  },

  // 设置默认提供商
  async setDefaultProvider(provider) {
    try {
      const res = await fetch(`${API.providers}/default`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      });
      const data = await res.json();
      if (data.success) {
        AppState.config.defaultProvider = provider;
        this.loadProviders();
        UI.showToast('已切换到 ' + provider, 'success');
      }
    } catch (e) {
      UI.showToast('切换失败', 'error');
    }
  },

  // 加载配置
  async loadConfig() {
    try {
      const res = await fetch(API.config);
      const data = await res.json();
      if (data.success) {
        AppState.config = data.data;
        MCPManager.loadMCPConfig();
      }
    } catch (e) {}
  },

  // 打开设置模态框
  openSettings() {
    document.getElementById('settingsModal').classList.add('active');
  },

  // 关闭设置模态框
  closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
  },

  // 切换标签页
  switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById('tab-' + tabName).classList.add('active');
  },

  // 处理键盘事件
  handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ConversationManager.sendMessage();
    }
  },

  // 初始化
  init() {
    // 加载数据
    ConversationManager.loadConversations();
    this.loadProviders();
    SkillsManager.loadSkills();
    this.loadConfig();
    
    // 设置拖放功能
    SkillsManager.setupDragDrop();
    
    // 设置模态框点击外部关闭
    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') {
        this.closeSettings();
      }
    });
  }
};

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => App.init());

// 导出
window.App = App;

// 全局函数（供 HTML onclick 调用）
function createNewConversation() {
  ConversationManager.createNewConversation();
}

function selectConversation(id) {
  ConversationManager.selectConversation(id);
}

function deleteConversation(id) {
  ConversationManager.deleteConversation(id);
}

function clearConversation() {
  ConversationManager.clearConversation();
}

function sendMessage() {
  ConversationManager.sendMessage();
}

function saveConversationSettings() {
  ConversationManager.saveConversationSettings();
}

function openSettings() {
  App.openSettings();
}

function closeSettings() {
  App.closeSettings();
}

function switchTab(tabName) {
  App.switchTab(tabName);
}

function handleKeyDown(e) {
  App.handleKeyDown(e);
}

function autoResize(el) {
  UI.autoResize(el);
}

function setDefaultProvider(provider) {
  App.setDefaultProvider(provider);
}

function loadSkills() {
  SkillsManager.loadSkills();
}

function showImportFromUrl() {
  SkillsManager.showImportFromUrl();
}

function hideImportFromUrl() {
  SkillsManager.hideImportFromUrl();
}

function installFromUrl() {
  SkillsManager.installFromUrl();
}

function importSkillFromZip(event) {
  SkillsManager.importSkillFromZip(event);
}

function exportSkill(name) {
  SkillsManager.exportSkill(name);
}

function exportAllSkills() {
  SkillsManager.exportAllSkills();
}

function uninstallSkill(name) {
  SkillsManager.uninstallSkill(name);
}

function toggleSkillStatus(name, enabled) {
  SkillsManager.toggleSkillStatus(name, enabled);
}

function toggleMCPEnabled() {
  MCPManager.toggleMCPEnabled();
}

function toggleReadOnly() {
  MCPManager.toggleReadOnly();
}

function updateMCPConfig() {
  MCPManager.updateMCPConfig();
}

function addWhitelist(e) {
  MCPManager.addWhitelist(e);
}

function removeWhitelist(ip) {
  MCPManager.removeWhitelist(ip);
}

function addBlacklist(e) {
  MCPManager.addBlacklist(e);
}

function removeBlacklist(ip) {
  MCPManager.removeBlacklist(ip);
}

function addDisabledTool(e) {
  MCPManager.addDisabledTool(e);
}

function removeDisabledTool(tool) {
  MCPManager.removeDisabledTool(tool);
}

function saveMCPConfig() {
  MCPManager.saveMCPConfig();
}

function toggleLeftSidebar() {
  UI.toggleLeftSidebar();
}

function toggleToolsPanel() {
  UI.toggleToolsPanel();
}

function copyAllMessages() {
  UI.copyAllMessages();
}
