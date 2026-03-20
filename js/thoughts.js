// 日有所思 - Thoughts Page

const STORAGE_KEY = 'blog_thoughts';

// 检查是否已配置 GitHub Token
async function checkGitHubConfig() {
  const token = localStorage.getItem('gh_token');
  if (!token) {
    showSetupPrompt();
    return false;
  }
  const valid = await GitHubStore.checkToken();
  if (!valid) {
    showSetupPrompt();
    return false;
  }
  return true;
}

function showSetupPrompt() {
  const container = document.getElementById('thoughts');
  container.innerHTML = `
    <div class="setup-prompt">
      <h3>需要配置 GitHub Token</h3>
      <p>请输入你的 GitHub Personal Access Token 来启用持久化存储</p>
      <form id="token-form">
        <input type="password" id="token-input" placeholder="ghp_xxx" style="width: 100%;" />
        <button type="submit" style="margin-top: 1rem;">确认</button>
      </form>
      <p style="margin-top: 1rem; font-size: 0.85rem; color: #666;">
        <a href="https://github.com/settings/tokens/new?scopes=repo&description=blog-data" target="_blank">创建 Token →</a>
      </p>
    </div>
  `;

  document.getElementById('token-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('token-input').value.trim();
    if (token) {
      localStorage.setItem('gh_token', token);
      const valid = await GitHubStore.checkToken();
      if (valid) {
        location.reload();
      } else {
        alert('Token 无效，请检查后重试');
      }
    }
  });
}

// Format date
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Render thoughts list
function renderThoughts(thoughts) {
  const container = document.getElementById('thoughts');

  if (thoughts.length === 0) {
    container.innerHTML = '<div class="empty-state">还没有记录，记录你的第一个想法吧</div>';
    return;
  }

  container.innerHTML = thoughts.map(thought => `
    <div class="thought-item">
      <div class="thought-time">${formatDate(thought.time)}</div>
      <div class="thought-content">${escapeHtml(thought.content)}</div>
    </div>
  `).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle form submit
document.getElementById('thought-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('thought-input');
  const content = input.value.trim();

  if (!content) return;

  try {
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = '保存中...';

    await GitHubStore.saveThought(content);
    input.value = '';

    const thoughts = await GitHubStore.loadThoughts();
    renderThoughts(thoughts);
  } catch (err) {
    alert('保存失败: ' + err.message);
  } finally {
    const btn = e.target.querySelector('button');
    btn.disabled = false;
    btn.textContent = '保存';
  }
});

// Initial load
(async () => {
  const configured = await checkGitHubConfig();
  if (configured) {
    try {
      const thoughts = await GitHubStore.loadThoughts();
      renderThoughts(thoughts);
    } catch (err) {
      const container = document.getElementById('thoughts');
      container.innerHTML = `<div class="empty-state">加载失败: ${err.message}</div>`;
    }
  }
})();