// Neonmind AI — Clean UI Controller & Adapter Layer
const API_ENDPOINT = 'https://neonmindnewai.vercel.app/api/chat';

const state = {
  chats: JSON.parse(localStorage.getItem('neonmind_chats') || '[]'),
  activeChatId: null,
  settings: JSON.parse(localStorage.getItem('neonmind_settings') || JSON.stringify({
    apiEndpoint: API_ENDPOINT,
    systemPrompt: 'You are a helpful, concise AI assistant.',
    stream: true,
    theme: 'dark',
    handedness: 'right'
  }))
};

if (!state.settings.apiEndpoint || state.settings.apiEndpoint === '/api/chat') {
  state.settings.apiEndpoint = API_ENDPOINT;
}

// DOM Elements
const els = {
  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebarBackdrop'),
  openSidebarBtn: document.getElementById('openSidebarBtn'),
  closeSidebarBtn: document.getElementById('closeSidebarBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  chatHistoryList: document.getElementById('chatHistoryList'),
  chatScrollArea: document.getElementById('chatScrollArea'),
  emptyState: document.getElementById('emptyState'),
  messagesContainer: document.getElementById('messagesContainer'),
  promptInput: document.getElementById('promptInput'),
  sendBtn: document.getElementById('sendBtn'),
  modelSelect: document.getElementById('modelSelect'),
  settingsModal: document.getElementById('settingsModal'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  apiEndpointInput: document.getElementById('apiEndpointInput'),
  systemPromptInput: document.getElementById('systemPromptInput'),
  streamToggle: document.getElementById('streamToggle'),
  themeSelect: document.getElementById('themeSelect'),
  handednessSelect: document.getElementById('handednessSelect'),
  checkUpdatesBtn: document.getElementById('checkUpdatesBtn')
};

// Configure Marked & Highlight.js
marked.setOptions({
  breaks: true,
  gfm: true,
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  }
});

function renderMarkdownWithCodeHeaders(markdownText) {
  const rawHtml = marked.parse(markdownText || '');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = rawHtml;

  wrapper.querySelectorAll('pre').forEach((pre) => {
    const codeEl = pre.querySelector('code');
    const langClass = Array.from(codeEl?.classList || []).find(c => c.startsWith('language-'));
    const lang = langClass ? langClass.replace('language-', '') : 'code';

    const container = document.createElement('div');
    container.className = 'code-block-wrapper';

    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.innerHTML = `<span>${lang}</span><button class="copy-code-btn" type="button">Copy</button>`;

    header.querySelector('.copy-code-btn').addEventListener('click', (e) => {
      navigator.clipboard.writeText(codeEl.innerText);
      e.target.textContent = 'Copied';
      setTimeout(() => (e.target.textContent = 'Copy'), 1500);
    });

    pre.parentNode.insertBefore(container, pre);
    container.appendChild(header);
    container.appendChild(pre);
  });

  return wrapper.innerHTML;
}

// Chat State Management
function applyPreferences() {
  const theme = ['dark', 'light', 'oled', 'ocean', 'material'].includes(state.settings.theme) ? state.settings.theme : 'dark';
  const handedness = state.settings.handedness === 'left' ? 'left' : 'right';
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.handedness = handedness;
  document.documentElement.classList.toggle('handed-left', handedness === 'left');
}

function saveChats() {
  localStorage.setItem('neonmind_chats', JSON.stringify(state.chats));
}

function getActiveChat() {
  return state.chats.find(c => c.id === state.activeChatId) || null;
}

function createNewChat() {
  const chat = {
    id: 'chat_' + Date.now(),
    title: 'New conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: []
  };
  state.chats.unshift(chat);
  state.activeChatId = chat.id;
  saveChats();
  renderHistory();
  renderMessages();
  closeMobileSidebar();
}

function renderHistory() {
  els.chatHistoryList.innerHTML = '';
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const groups = [
    { label: 'Today', chats: [] },
    { label: 'Previous 7 days', chats: [] },
    { label: 'Older', chats: [] }
  ];

  state.chats.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  state.chats.forEach(chat => {
    const age = now - (chat.updatedAt || chat.createdAt || now);
    const group = age < day ? groups[0] : age < 7 * day ? groups[1] : groups[2];
    group.chats.push(chat);
  });

  groups.forEach(group => {
    if (!group.chats.length) return;
    const heading = document.createElement('div');
    heading.className = 'history-group-label';
    heading.textContent = group.label;
    els.chatHistoryList.appendChild(heading);

    group.chats.forEach(chat => {
      const btn = document.createElement('button');
      btn.className = `history-item ${chat.id === state.activeChatId ? 'active' : ''}`;
      btn.type = 'button';
      btn.innerHTML = `<span class="history-item-title">${escapeHtml(chat.title || 'New conversation')}</span>`;
      btn.onclick = () => {
        state.activeChatId = chat.id;
        renderHistory();
        renderMessages();
        closeMobileSidebar();
      };
      els.chatHistoryList.appendChild(btn);
    });
  });

  if (!state.chats.length) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'Your conversations will appear here';
    els.chatHistoryList.appendChild(empty);
  }
}

function renderMessages() {
  const chat = getActiveChat();
  els.messagesContainer.innerHTML = '';

  if (!chat || chat.messages.length === 0) {
    els.emptyState.style.display = 'block';
    return;
  }

  els.emptyState.style.display = 'none';
  chat.messages.forEach(msg => appendMessageElement(msg.role, msg.content));
  scrollToBottom();
}

function appendMessageElement(role, content, isLoading = false) {
  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  if (role === 'user') {
    const bubble = document.createElement('div');
    bubble.className = 'user-bubble';
    bubble.textContent = content;
    row.appendChild(bubble);
  } else {
    const body = document.createElement('div');
    body.className = 'assistant-content';
    if (isLoading) {
      body.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
    } else {
      body.innerHTML = renderMarkdownWithCodeHeaders(content);
    }
    row.appendChild(body);
  }

  els.messagesContainer.appendChild(row);
  return row;
}

function scrollToBottom() {
  els.chatScrollArea.scrollTop = els.chatScrollArea.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================================
// AI PROVIDER ADAPTER — Wire your existing API call inside sendToAIProvider()
// ============================================================================
async function sendToAIProvider(messages, model) {
  const { apiEndpoint, systemPrompt } = state.settings;
  const endpoint = (apiEndpoint || '/api/chat').trim();

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, systemPrompt })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);
  return data.choices?.[0]?.message?.content || 'No response returned.';
}

async function handleSend() {
  const text = els.promptInput.value.trim();
  if (!text) return;

  if (!getActiveChat()) createNewChat();

  const chat = getActiveChat();
  if (chat.messages.length === 0) {
    chat.title = text.slice(0, 38) + (text.length > 38 ? '...' : '');
  }

  chat.messages.push({ role: 'user', content: text });
  chat.updatedAt = Date.now();
  saveChats();
  renderHistory();
  els.emptyState.style.display = 'none';
  appendMessageElement('user', text);

  els.promptInput.value = '';
  els.promptInput.style.height = 'auto';
  els.sendBtn.disabled = true;
  scrollToBottom();

  const loadingRow = appendMessageElement('assistant', '', true);
  scrollToBottom();

  try {
    const reply = await sendToAIProvider(chat.messages, els.modelSelect.value);
    loadingRow.remove();
    chat.messages.push({ role: 'assistant', content: reply });
    chat.updatedAt = Date.now();
    saveChats();
    renderHistory();
    appendMessageElement('assistant', reply);
  } catch (err) {
    loadingRow.remove();
    appendMessageElement('assistant', `**Error:** ${err.message}`);
  }
  scrollToBottom();
}

// Sidebar & Responsive Handlers
function toggleSidebar() {
  if (window.innerWidth <= 768) {
    els.sidebar.classList.toggle('mobile-open');
    els.sidebarBackdrop.classList.toggle('visible');
  } else {
    els.sidebar.classList.toggle('collapsed');
  }
}

function closeMobileSidebar() {
  els.sidebar.classList.remove('mobile-open');
  els.sidebarBackdrop.classList.remove('visible');
}

// Event Listeners
els.openSidebarBtn.addEventListener('click', toggleSidebar);
els.closeSidebarBtn.addEventListener('click', closeMobileSidebar);
els.sidebarBackdrop.addEventListener('click', closeMobileSidebar);
els.newChatBtn.addEventListener('click', createNewChat);

els.clearChatBtn.addEventListener('click', () => {
  const chat = getActiveChat();
  if (!chat) return;
  chat.messages = [];
  saveChats();
  renderMessages();
});

els.promptInput.addEventListener('input', () => {
  els.promptInput.style.height = 'auto';
  els.promptInput.style.height = Math.min(els.promptInput.scrollHeight, 180) + 'px';
  els.sendBtn.disabled = els.promptInput.value.trim().length === 0;
});

els.promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

els.sendBtn.addEventListener('click', handleSend);

document.querySelectorAll('.suggestion-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    els.promptInput.value = chip.dataset.prompt;
    els.sendBtn.disabled = false;
    handleSend();
  });
});

// Settings Modal
els.openSettingsBtn.addEventListener('click', () => {
  els.apiEndpointInput.value = state.settings.apiEndpoint || '';
  els.systemPromptInput.value = state.settings.systemPrompt || '';
  els.streamToggle.checked = state.settings.stream !== false;
  els.themeSelect.value = state.settings.theme || 'dark';
  els.handednessSelect.value = state.settings.handedness || 'right';
  els.settingsModal.hidden = false;
});

els.closeSettingsBtn.addEventListener('click', () => {
  els.settingsModal.hidden = true;
});

els.saveSettingsBtn.addEventListener('click', () => {
  state.settings = {
    apiEndpoint: els.apiEndpointInput.value.trim(),
    systemPrompt: els.systemPromptInput.value.trim(),
    stream: els.streamToggle.checked,
    theme: els.themeSelect.value,
    handedness: els.handednessSelect.value
  };
  localStorage.setItem('neonmind_settings', JSON.stringify(state.settings));
  applyPreferences();
  els.settingsModal.hidden = true;
});

els.checkUpdatesBtn.addEventListener('click', () => {
  window.open('https://github.com/ilo966/Neonmind-new/releases', '_blank', 'noopener');
});

applyPreferences();

// Init
if (state.chats.length > 0) {
  state.activeChatId = state.chats[0].id;
}
renderHistory();
renderMessages();
