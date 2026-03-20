// 作品集 - Works Page

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
  const container = document.getElementById('works');
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
    day: 'numeric'
  });
}

// Render works list
function renderWorks(works) {
  const container = document.getElementById('works');

  if (works.length === 0) {
    container.innerHTML = '<div class="empty-state">还没有作品，发布你的第一篇长文吧</div>';
    return;
  }

  container.innerHTML = works.map(work => `
    <div class="work-item">
      <h3 class="work-title">${escapeHtml(work.title)}</h3>
      <div class="work-meta">${formatDate(work.time)}</div>
      <div class="work-content">${escapeHtml(work.content)}</div>
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
document.getElementById('work-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const titleInput = document.getElementById('work-title');
  const contentInput = document.getElementById('work-content');
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!title || !content) return;

  try {
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = '发布中...';

    await GitHubStore.saveWork(title, content);
    titleInput.value = '';
    contentInput.value = '';

    const works = await GitHubStore.loadWorks();
    renderWorks(works);
  } catch (err) {
    alert('发布失败: ' + err.message);
  } finally {
    const btn = e.target.querySelector('button');
    btn.disabled = false;
    btn.textContent = '发布';
  }
});

// Initial load
(async () => {
  const configured = await checkGitHubConfig();
  if (configured) {
    try {
      const works = await GitHubStore.loadWorks();
      renderWorks(works);
    } catch (err) {
      const container = document.getElementById('works');
      container.innerHTML = `<div class="empty-state">加载失败: ${err.message}</div>`;
    }
  }
})();