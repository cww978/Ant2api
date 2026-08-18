// Ant2api Web Management Frontend App

const state = {
  adminToken: localStorage.getItem('ant2api_admin_token') || '',
  activeTab: 'dashboard',
  accounts: [],
  keys: [],
  mappings: [],
  logs: [],
  stats: null,
  pgProtocol: 'openai',
  pgMessages: []
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initTabs();
  initModals();
  initPlayground();
  initForms();
  initSettings();
});

// --- Auth Management ---
function initAuth() {
  const loginModal = document.getElementById('login-modal');
  const mainLayout = document.getElementById('main-layout');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');

  if (state.adminToken) {
    loginModal.classList.add('hidden');
    mainLayout.classList.remove('hidden');
    loadAllData();
  } else {
    loginModal.classList.remove('hidden');
    mainLayout.classList.add('hidden');
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('admin-password').value.trim();
    loginError.classList.add('hidden');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        state.adminToken = data.token;
        localStorage.setItem('ant2api_admin_token', data.token);
        loginModal.classList.add('hidden');
        mainLayout.classList.remove('hidden');
        loadAllData();
        showToast('登录成功！欢迎使用 Ant2api 控制台');
      } else {
        loginError.textContent = data.message || '登录失败，请检查密码';
        loginError.classList.remove('hidden');
      }
    } catch (err) {
      loginError.textContent = '网络请求失败，请确认服务已启动';
      loginError.classList.remove('hidden');
    }
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('ant2api_admin_token');
    state.adminToken = '';
    window.location.reload();
  });
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${state.adminToken}`
  };
}

// --- Navigation Tabs ---
function initTabs() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  document.getElementById('btn-refresh-stats').addEventListener('click', () => {
    loadStats();
    showToast('数据已刷新');
  });
}

function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-tab') === tabName);
  });
  document.querySelectorAll('.tab-pane').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tabName}`);
  });

  const titles = {
    dashboard: ['仪表盘概览', '实时流量监控与核心健康指标'],
    accounts: ['账号与凭证池', '管理 Antigravity、GeminiCLI 与 Google 账号凭据与负载均衡'],
    keys: ['API 密钥管理', '生成和管理分发给各客户端的应用访问令牌与配额'],
    mappings: ['模型别名映射', '配置模型重定向规则，让应用直接请求 gpt-4o 或 claude-3-7 等别名'],
    playground: ['在线 API 演练场', '实时测试 OpenAI、Claude 与 Gemini 格式的请求与流式返回'],
    logs: ['请求审计日志', '查看所有客户端请求的详细耗时、Token 消耗与错误排查'],
    deploy: ['Linux 部署与设置', '系统运行参数配置与服务端多环境部署指南']
  };

  if (titles[tabName]) {
    document.getElementById('page-heading').textContent = titles[tabName][0];
    document.getElementById('page-subheading').textContent = titles[tabName][1];
  }

  // Refresh tab specific data
  if (tabName === 'dashboard') loadStats();
  if (tabName === 'accounts') loadAccounts();
  if (tabName === 'keys') loadKeys();
  if (tabName === 'mappings') loadMappings();
  if (tabName === 'logs') loadLogs();
}

// --- Data Loading ---
async function loadAllData() {
  await Promise.all([
    loadStats(),
    loadAccounts(),
    loadKeys(),
    loadMappings(),
    loadLogs()
  ]);
}

async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats', { headers: authHeaders() });
    if (res.status === 401) return handleAuthExpire();
    const data = await res.json();
    if (data.success) {
      state.stats = data.data;
      renderStats(data.data);
    }
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
}

function renderStats(stats) {
  document.getElementById('stat-total-requests').textContent = (stats.totalRequests || 0).toLocaleString();
  document.getElementById('stat-total-tokens').textContent = (stats.totalTokens || 0).toLocaleString();
  document.getElementById('stat-success-rate').textContent = `${stats.successRate || 100}%`;
  document.getElementById('stat-total-errors').textContent = stats.totalErrors || 0;
  document.getElementById('stat-avg-latency').textContent = stats.avgLatencyMs || 0;

  // Render 24h traffic bars
  const barsContainer = document.getElementById('traffic-bars');
  barsContainer.innerHTML = '';
  const hourly = stats.hourlyRequests || [];
  const maxCount = Math.max(...hourly.map(h => h.count), 10);

  hourly.forEach(item => {
    const heightPercent = Math.max((item.count / maxCount) * 100, 4);
    const col = document.createElement('div');
    col.className = 'chart-bar-col';
    col.innerHTML = `
      <div class="chart-bar-inner" style="height: ${heightPercent}%" data-tooltip="${item.hour} - ${item.count}次 (${item.tokens} tokens)"></div>
      <div class="chart-bar-label">${item.hour.split(':')[0]}</div>
    `;
    barsContainer.appendChild(col);
  });
}

// --- Accounts Management ---
async function loadAccounts() {
  try {
    const res = await fetch('/api/admin/accounts', { headers: authHeaders() });
    if (res.status === 401) return handleAuthExpire();
    const data = await res.json();
    if (data.success) {
      state.accounts = data.data;
      renderAccounts(data.data);
    }
  } catch (e) {
    console.error('Failed to load accounts:', e);
  }
}

function renderAccounts(accounts) {
  const tbody = document.getElementById('accounts-tbody');
  tbody.innerHTML = '';

  if (!accounts || accounts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 40px;">暂无配置账号，请点击右上角「添加账号凭据」或「OAuth 授权助手」</td></tr>`;
    return;
  }

  accounts.forEach(acc => {
    const tr = document.createElement('tr');
    
    // Status Badge
    let statusBadge = '<span class="badge badge-success">正常运行</span>';
    if (!acc.enabled) {
      statusBadge = '<span class="badge badge-danger">已禁用</span>';
    } else if (acc.cooldownUntil && acc.cooldownUntil > Date.now()) {
      const remainSec = Math.ceil((acc.cooldownUntil - Date.now()) / 1000);
      statusBadge = `<span class="badge badge-warning">冷却中 (${remainSec}s)</span>`;
    }

    // Type Badge
    const typeBadges = {
      antigravity: '<span class="badge badge-primary">Antigravity (Cloud Code)</span>',
      gemini_cli: '<span class="badge badge-cyan">Gemini CLI (OAuth)</span>',
      google_oauth: '<span class="badge badge-purple">Google OAuth2</span>',
      gemini_api: '<span class="badge badge-emerald">Gemini Studio API</span>'
    };

    const lastUsed = acc.lastUsedAt ? new Date(acc.lastUsedAt).toLocaleTimeString() : '从未';

    tr.innerHTML = `
      <td><strong>${escapeHtml(acc.name)}</strong></td>
      <td>${typeBadges[acc.type] || acc.type}</td>
      <td>${statusBadge}</td>
      <td>${acc.totalRequests || 0} / <span class="text-danger">${acc.failedRequests || 0}</span></td>
      <td>${acc.consecutiveErrors || 0}</td>
      <td>${lastUsed}</td>
      <td class="text-right">
        <button class="btn btn-outline btn-sm" onclick="testAccount('${acc.id}')">测试</button>
        <button class="btn btn-outline btn-sm" onclick="refreshAccountToken('${acc.id}')">刷新Token</button>
        <button class="btn btn-outline btn-sm" onclick="toggleAccount('${acc.id}')">${acc.enabled ? '禁用' : '启用'}</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteAccount('${acc.id}')" style="color: var(--accent-rose);">删除</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.testAccount = async function(id) {
  showToast('正在测试上游连接...');
  try {
    const res = await fetch(`/api/admin/accounts/${id}/test`, {
      method: 'POST',
      headers: authHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ ' + data.message);
    } else {
      showToast('❌ ' + data.message);
    }
  } catch (e) {
    showToast('❌ 测试请求失败: ' + e.message);
  }
};

window.refreshAccountToken = async function(id) {
  showToast('正在向 Google OAuth 刷新 Token...');
  try {
    const res = await fetch(`/api/admin/accounts/${id}/refresh`, {
      method: 'POST',
      headers: authHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Token 刷新成功！');
      loadAccounts();
    } else {
      showToast('❌ ' + data.message);
    }
  } catch (e) {
    showToast('❌ 刷新失败: ' + e.message);
  }
};

window.toggleAccount = async function(id) {
  const acc = state.accounts.find(a => a.id === id);
  if (!acc) return;
  acc.enabled = !acc.enabled;
  await fetch('/api/admin/accounts', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(acc)
  });
  showToast(`账号已${acc.enabled ? '启用' : '禁用'}`);
  loadAccounts();
};

window.deleteAccount = async function(id) {
  if (!confirm('确定要删除该账号凭据吗？')) return;
  await fetch(`/api/admin/accounts/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  showToast('账号已删除');
  loadAccounts();
};

// --- API Keys Management ---
async function loadKeys() {
  try {
    const res = await fetch('/api/admin/keys', { headers: authHeaders() });
    if (res.status === 401) return handleAuthExpire();
    const data = await res.json();
    if (data.success) {
      state.keys = data.data;
      renderKeys(data.data);
    }
  } catch (e) {
    console.error('Failed to load keys:', e);
  }
}

function renderKeys(keys) {
  const tbody = document.getElementById('keys-tbody');
  tbody.innerHTML = '';

  if (!keys || keys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 40px;">暂无 API 密钥，请点击右上角「生成新 API Key」</td></tr>`;
    return;
  }

  keys.forEach(k => {
    const tr = document.createElement('tr');
    const maskedKey = k.key.length > 20 ? k.key.substring(0, 12) + '...' + k.key.substring(k.key.length - 6) : k.key;
    const quotaStr = k.quotaTokens > 0 ? `${k.usedTokens || 0} / ${k.quotaTokens}` : `${k.usedTokens || 0} / 无限制`;
    const rpmStr = k.rateLimitPerMin > 0 ? `${k.rateLimitPerMin} RPM` : '无限制';
    const statusBadge = k.enabled ? '<span class="badge badge-success">正常</span>' : '<span class="badge badge-danger">已停用</span>';

    tr.innerHTML = `
      <td><strong>${escapeHtml(k.name)}</strong></td>
      <td>
        <code>${maskedKey}</code>
        <button class="btn-copy" onclick="copyText('${k.key}')">复制</button>
      </td>
      <td>${rpmStr}</td>
      <td>${quotaStr}</td>
      <td>${new Date(k.createdAt).toLocaleDateString()}</td>
      <td>${statusBadge}</td>
      <td class="text-right">
        <button class="btn btn-outline btn-sm" onclick="toggleKey('${k.id}')">${k.enabled ? '停用' : '启用'}</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteKey('${k.id}')" style="color: var(--accent-rose);">删除</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.toggleKey = async function(id) {
  const k = state.keys.find(item => item.id === id);
  if (!k) return;
  k.enabled = !k.enabled;
  await fetch('/api/admin/keys', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(k)
  });
  showToast(`API Key 已${k.enabled ? '启用' : '停用'}`);
  loadKeys();
};

window.deleteKey = async function(id) {
  if (!confirm('确定要删除该 API Key 吗？相关客户端将无法继续访问。')) return;
  await fetch(`/api/admin/keys/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  showToast('API Key 已删除');
  loadKeys();
};

// --- Model Mappings ---
async function loadMappings() {
  try {
    const res = await fetch('/api/admin/mappings', { headers: authHeaders() });
    if (res.status === 401) return handleAuthExpire();
    const data = await res.json();
    if (data.success) {
      state.mappings = data.data;
      renderMappings(data.data);
    }
  } catch (e) {
    console.error('Failed to load mappings:', e);
  }
}

function renderMappings(mappings) {
  const tbody = document.getElementById('mappings-tbody');
  tbody.innerHTML = '';

  mappings.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${escapeHtml(m.sourceModel)}</code></td>
      <td><strong style="color: #38bdf8;">${escapeHtml(m.targetModel)}</strong></td>
      <td><span class="text-muted">${escapeHtml(m.description || '-')}</span></td>
      <td>${m.enabled ? '<span class="badge badge-success">生效中</span>' : '<span class="badge badge-danger">已禁用</span>'}</td>
      <td class="text-right">
        <button class="btn btn-outline btn-sm" onclick="toggleMapping('${m.id}')">${m.enabled ? '禁用' : '启用'}</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteMapping('${m.id}')" style="color: var(--accent-rose);">删除</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.toggleMapping = async function(id) {
  const m = state.mappings.find(item => item.id === id);
  if (!m) return;
  m.enabled = !m.enabled;
  await fetch('/api/admin/mappings', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(m)
  });
  showToast(`映射规则已${m.enabled ? '启用' : '禁用'}`);
  loadMappings();
};

window.deleteMapping = async function(id) {
  if (!confirm('确定要删除此映射规则吗？')) return;
  await fetch(`/api/admin/mappings/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  showToast('映射规则已删除');
  loadMappings();
};

// --- Logs Management ---
async function loadLogs() {
  try {
    const res = await fetch('/api/admin/logs?limit=100', { headers: authHeaders() });
    if (res.status === 401) return handleAuthExpire();
    const data = await res.json();
    if (data.success) {
      state.logs = data.data;
      renderLogs(data.data);
    }
  } catch (e) {
    console.error('Failed to load logs:', e);
  }
}

function renderLogs(logs) {
  const tbody = document.getElementById('logs-tbody');
  tbody.innerHTML = '';

  if (!logs || logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 40px;">暂无调用日志记录</td></tr>`;
    return;
  }

  logs.forEach(l => {
    const tr = document.createElement('tr');
    const protocolBadges = {
      openai: '<span class="badge badge-success">OpenAI</span>',
      claude: '<span class="badge badge-purple">Claude</span>',
      gemini: '<span class="badge badge-cyan">Gemini</span>'
    };

    const statusBadge = l.statusCode >= 400
      ? `<span class="badge badge-danger">${l.statusCode}</span>`
      : `<span class="badge badge-success">${l.statusCode}</span>`;

    const mappedStr = l.mappedModel && l.mappedModel !== l.model ? ` &rarr; <span class="text-muted">${l.mappedModel}</span>` : '';

    tr.innerHTML = `
      <td>${new Date(l.timestamp).toLocaleTimeString()}</td>
      <td>${protocolBadges[l.protocol] || l.protocol} <br><small class="text-muted">${l.endpoint}</small></td>
      <td><code>${escapeHtml(l.model)}</code>${mappedStr}</td>
      <td>${statusBadge}</td>
      <td>${l.latencyMs}ms</td>
      <td>${l.inputTokens || 0} / ${l.outputTokens || 0} / <strong>${l.totalTokens || 0}</strong></td>
      <td>${escapeHtml(l.accountName || l.accountId || '-')}</td>
      <td><small class="text-muted">${l.clientIp || '-'}</small></td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('btn-clear-logs').addEventListener('click', async () => {
  if (!confirm('确定清空所有请求审计日志吗？')) return;
  await fetch('/api/admin/logs', { method: 'DELETE', headers: authHeaders() });
  showToast('日志已清空');
  loadLogs();
});

document.getElementById('btn-refresh-logs').addEventListener('click', () => {
  loadLogs();
  showToast('日志已刷新');
});

// --- Playground ---
function initPlayground() {
  const protocolPills = document.querySelectorAll('#pg-protocol-tabs .pill');
  protocolPills.forEach(pill => {
    pill.addEventListener('click', () => {
      protocolPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.pgProtocol = pill.getAttribute('data-protocol');
    });
  });

  const tempSlider = document.getElementById('pg-temp');
  tempSlider.addEventListener('input', (e) => {
    document.getElementById('pg-temp-val').textContent = e.target.value;
  });

  const sendBtn = document.getElementById('btn-pg-send');
  const inputArea = document.getElementById('pg-user-input');

  sendBtn.addEventListener('click', () => sendPlaygroundMessage());
  inputArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPlaygroundMessage();
    }
  });
}

async function sendPlaygroundMessage() {
  const inputEl = document.getElementById('pg-user-input');
  const text = inputEl.value.trim();
  if (!text) return;

  const model = document.getElementById('pg-model-select').value;
  const stream = document.getElementById('pg-stream').checked;
  const temperature = parseFloat(document.getElementById('pg-temp').value);
  const systemPrompt = document.getElementById('pg-system').value.trim();

  // Append user message
  inputEl.value = '';
  appendChatMessage('user', text);
  state.pgMessages.push({ role: 'user', content: text });

  // Assistant placeholder message
  const assistantMsgEl = appendChatMessage('assistant', '思考中...');
  const msgBody = assistantMsgEl.querySelector('.msg-body');

  const statusEl = document.getElementById('pg-chat-status');
  const metricsEl = document.getElementById('pg-chat-metrics');
  statusEl.textContent = '请求中...';
  const start = Date.now();

  try {
    let endpoint = '/v1/chat/completions';
    let payload = {};

    if (state.pgProtocol === 'openai') {
      endpoint = '/v1/chat/completions';
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push(...state.pgMessages);

      payload = {
        model,
        messages,
        temperature,
        stream
      };
    } else if (state.pgProtocol === 'claude') {
      endpoint = '/v1/messages';
      payload = {
        model,
        system: systemPrompt || undefined,
        messages: state.pgMessages,
        temperature,
        max_tokens: 4096,
        stream
      };
    } else if (state.pgProtocol === 'codex') {
      endpoint = '/v1/completions';
      payload = {
        model,
        prompt: text,
        temperature,
        stream
      };
    } else {
      // Gemini native
      endpoint = `/v1beta/models/${model}:${stream ? 'streamGenerateContent' : 'generateContent'}`;
      payload = {
        contents: state.pgMessages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }))
      };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.adminToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      msgBody.innerHTML = `<p style="color: var(--accent-rose);">请求错误 (${res.status}): ${err.error?.message || err.message}</p>`;
      statusEl.textContent = '异常';
      return;
    }

    if (stream) {
      msgBody.innerHTML = '';
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.error) {
                const errMsg = parsed.error.message || JSON.stringify(parsed.error);
                fullText = `❌ 调用失败: ${errMsg}`;
                msgBody.innerHTML = `<p style="color: var(--accent-rose);">${escapeHtml(fullText)}</p>`;
                statusEl.textContent = '错误';
                return;
              }
              if (state.pgProtocol === 'openai') {
                const delta = parsed.choices?.[0]?.delta?.content || '';
                fullText += delta;
                msgBody.textContent = fullText;
              } else if (state.pgProtocol === 'claude') {
                if (parsed.type === 'content_block_delta') {
                  fullText += parsed.delta?.text || '';
                  msgBody.textContent = fullText;
                }
              } else if (state.pgProtocol === 'codex') {
                const delta = parsed.choices?.[0]?.text || '';
                fullText += delta;
                msgBody.textContent = fullText;
              } else {
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                fullText += text;
                msgBody.textContent = fullText;
              }
            } catch (e) {}
          }
        }
      }

      state.pgMessages.push({ role: 'assistant', content: fullText });
      const latency = Date.now() - start;
      statusEl.textContent = '完成';
      metricsEl.textContent = `耗时: ${latency}ms | 字符: ${fullText.length}`;
    } else {
      const data = await res.json();
      let reply = '';
      if (state.pgProtocol === 'openai') {
        reply = data.choices?.[0]?.message?.content || '';
      } else if (state.pgProtocol === 'claude') {
        reply = data.content?.[0]?.text || '';
      } else if (state.pgProtocol === 'codex') {
        reply = data.choices?.[0]?.text || '';
      } else {
        reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
      msgBody.textContent = reply;
      state.pgMessages.push({ role: 'assistant', content: reply });
      const latency = Date.now() - start;
      statusEl.textContent = '完成';
      metricsEl.textContent = `耗时: ${latency}ms | Tokens: ${data.usage?.total_tokens || '-'}`;
    }
  } catch (err) {
    msgBody.innerHTML = `<p style="color: var(--accent-rose);">网络错误: ${err.message}</p>`;
    statusEl.textContent = '错误';
  }
}

function appendChatMessage(role, text) {
  const container = document.getElementById('pg-chat-messages');
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${role}`;
  msgDiv.innerHTML = `
    <div class="msg-avatar">${role === 'user' ? '👤' : '🤖'}</div>
    <div class="msg-body"><p>${escapeHtml(text)}</p></div>
  `;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
  return msgDiv;
}

// --- Modals & Forms ---
function initModals() {
  document.getElementById('btn-add-account').addEventListener('click', () => {
    document.getElementById('form-account').reset();
    document.getElementById('acc-id').value = '';
    document.getElementById('modal-account-title').textContent = '添加账号凭据';
    openModal('modal-account');
  });

  document.getElementById('btn-add-key').addEventListener('click', () => {
    document.getElementById('form-key').reset();
    document.getElementById('key-id').value = '';
    openModal('modal-key');
  });

  document.getElementById('btn-add-mapping').addEventListener('click', () => {
    document.getElementById('form-mapping').reset();
    document.getElementById('map-id').value = '';
    openModal('modal-mapping');
  });

  // OAuth Helper
  document.getElementById('btn-open-oauth-helper').addEventListener('click', async () => {
    openModal('modal-oauth');
  });

  document.getElementById('btn-oauth-open-url').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/admin/oauth/url', { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.url) {
        window.open(data.url, '_blank', 'width=600,height=700');
      }
    } catch (e) {
      showToast('获取 OAuth URL 失败: ' + e.message);
    }
  });

  document.getElementById('btn-oauth-exchange').addEventListener('click', async () => {
    const code = document.getElementById('oauth-input-code').value.trim();
    if (!code) return showToast('请输入授权码 (Code)');

    showToast('正在向 Google 换取 Refresh Token...');
    try {
      const res = await fetch('/api/admin/oauth/exchange', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (data.success && data.data?.refresh_token) {
        document.getElementById('oauth-result-token').value = data.data.refresh_token;
        document.getElementById('oauth-result').classList.remove('hidden');
        showToast('🎉 成功获取 Refresh Token！');
      } else {
        showToast('❌ 换取失败: ' + (data.message || '无效授权码'));
      }
    } catch (e) {
      showToast('❌ 请求失败: ' + e.message);
    }
  });

  // Auto-listen for OAuth callback from popup window
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
      const token = event.data.refreshToken || event.data.accessToken;
      if (token) {
        document.getElementById('oauth-result-token').value = token;
        document.getElementById('oauth-result').classList.remove('hidden');
        showToast('🎉 Google OAuth 授权成功，已自动同步凭据！');
        
        // Auto switch to account modal
        setTimeout(() => {
          closeModal('modal-oauth');
          document.getElementById('form-account').reset();
          document.getElementById('acc-name').value = 'Google Account ' + Math.floor(Math.random() * 1000);
          document.getElementById('acc-type').value = 'antigravity';
          document.getElementById('acc-refresh-token').value = token;
          openModal('modal-account');
        }, 1000);
      }
    }
  });

  document.getElementById('btn-apply-token-to-account').addEventListener('click', () => {
    const token = document.getElementById('oauth-result-token').value;
    closeModal('modal-oauth');
    document.getElementById('form-account').reset();
    document.getElementById('acc-name').value = 'Google Account ' + Math.floor(Math.random() * 1000);
    document.getElementById('acc-type').value = 'antigravity';
    document.getElementById('acc-refresh-token').value = token;
    openModal('modal-account');
  });
}

function initForms() {
  // Account Form Submit
  document.getElementById('form-account').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      id: document.getElementById('acc-id').value || undefined,
      name: document.getElementById('acc-name').value.trim(),
      type: document.getElementById('acc-type').value,
      refreshToken: document.getElementById('acc-refresh-token').value.trim(),
      apiKey: document.getElementById('acc-api-key').value.trim(),
      cookie: document.getElementById('acc-cookie').value.trim(),
      clientId: document.getElementById('acc-client-id').value.trim(),
      clientSecret: document.getElementById('acc-client-secret').value.trim(),
      enabled: document.getElementById('acc-enabled').checked
    };

    const res = await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('账号保存成功！');
      closeModal('modal-account');
      loadAccounts();
    } else {
      showToast('保存失败: ' + data.message);
    }
  });

  // API Key Form Submit
  document.getElementById('form-key').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('key-name').value.trim(),
      key: document.getElementById('key-token').value.trim() || undefined,
      rateLimitPerMin: parseInt(document.getElementById('key-rpm').value || '0', 10),
      quotaTokens: parseInt(document.getElementById('key-quota').value || '0', 10)
    };

    const res = await fetch('/api/admin/keys', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('API Key 生成成功！');
      closeModal('modal-key');
      loadKeys();
    } else {
      showToast('生成失败: ' + data.message);
    }
  });

  // Mapping Form Submit
  document.getElementById('form-mapping').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      sourceModel: document.getElementById('map-source').value.trim(),
      targetModel: document.getElementById('map-target').value.trim(),
      description: document.getElementById('map-desc').value.trim()
    };

    const res = await fetch('/api/admin/mappings', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('模型映射规则保存成功！');
      closeModal('modal-mapping');
      loadMappings();
    } else {
      showToast('保存失败: ' + data.message);
    }
  });
}

function initSettings() {
  // Load Settings
  fetch('/api/admin/settings', { headers: authHeaders() })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        document.getElementById('setting-strategy').value = d.data.loadBalanceStrategy || 'round_robin';
        document.getElementById('setting-cooldown').value = d.data.maxCooldownSeconds || 60;
        document.getElementById('setting-proxy').value = d.data.proxyUrl || '';
        document.getElementById('server-port').textContent = d.data.port || 8080;
      }
    });

  // Save Settings
  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      loadBalanceStrategy: document.getElementById('setting-strategy').value,
      maxCooldownSeconds: parseInt(document.getElementById('setting-cooldown').value, 10),
      proxyUrl: document.getElementById('setting-proxy').value.trim() || undefined
    };

    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const d = await res.json();
    if (d.success) {
      showToast('系统设置已保存！');
    }
  });

  // Backup & Restore
  document.getElementById('btn-export-backup').addEventListener('click', () => {
    window.open(`/api/admin/backup?admin_key=${state.adminToken}`, '_blank');
  });

  const fileInput = document.getElementById('file-import');
  document.getElementById('btn-trigger-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target.result);
        const res = await fetch('/api/admin/restore', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(json)
        });
        const d = await res.json();
        if (d.success) {
          showToast('数据导入成功！');
          loadAllData();
        } else {
          showToast('导入失败: ' + d.message);
        }
      } catch (err) {
        showToast('JSON 文件解析失败');
      }
    };
    reader.readAsText(file);
  });
}

// --- Helpers ---
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制到剪贴板: ' + text);
  }).catch(() => {
    showToast('复制失败，请手动复制');
  });
}

function copyProtocolUrl(path, label) {
  const fullUrl = window.location.origin + path;
  navigator.clipboard.writeText(fullUrl).then(() => {
    showToast(`已复制 ${label || '地址'}: ${fullUrl}`);
  }).catch(() => {
    showToast('复制失败，请手动复制');
  });
}
window.copyProtocolUrl = copyProtocolUrl;

function handleAuthExpire() {
  localStorage.removeItem('ant2api_admin_token');
  state.adminToken = '';
  showToast('登录状态已失效，请重新登录');
  setTimeout(() => window.location.reload(), 1000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
