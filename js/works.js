// 作品集 - 左侧导航列表 + 右侧文章展示

let worksData = [];

// 检查 GitHub 配置
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
  const list = document.getElementById('works-list');
  list.innerHTML = `
    <li class="setup-prompt-item">
      <div>
        <h3>需要配置 GitHub Token</h3>
        <p>请输入你的 GitHub Personal Access Token</p>
      </div>
    </li>
  `;
  list.querySelector('.setup-prompt-item').addEventListener('click', () => {
    const token = prompt('请输入 GitHub Token:');
    if (token) {
      localStorage.setItem('gh_token', token);
      location.reload();
    }
  });
}

// 格式化日期
function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// 转义 HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 渲染侧边栏列表
function renderSidebar() {
  const list = document.getElementById('works-list');

  if (!worksData || worksData.length === 0) {
    list.innerHTML = '<li class="empty-item">还没有作品</li>';
    return;
  }

  list.innerHTML = worksData.map((work, i) => `
    <li data-index="${i}">${escapeHtml(work.title)}</li>
  `).join('');

  // 点击列表项
  list.querySelectorAll('li[data-index]').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index);
      showWork(index);

      // 更新激活状态
      list.querySelectorAll('li').forEach(li => li.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

// 显示指定作品
function showWork(index) {
  const content = document.getElementById('works-content');
  const work = worksData[index];

  content.innerHTML = `
    <div class="work-display active">
      <h2 class="work-title">${escapeHtml(work.title)}</h2>
      <div class="work-meta">${formatDate(work.time)}</div>
      <div class="work-content">${escapeHtml(work.content)}</div>
    </div>
  `;
}

// 表单提交
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

    worksData = await GitHubStore.loadWorks();
    renderSidebar();

    // 显示最新发布的
    if (worksData.length > 0) {
      showWork(0);
      const firstItem = document.querySelector('li[data-index="0"]');
      if (firstItem) firstItem.classList.add('active');
    }
  } catch (err) {
    alert('发布失败: ' + err.message);
  } finally {
    const btn = e.target.querySelector('button');
    btn.disabled = false;
    btn.textContent = '发布';
  }
});

// 初始化
(async () => {
  const configured = await checkGitHubConfig();
  if (configured) {
    try {
      worksData = await GitHubStore.loadWorks();
      renderSidebar();

      // 默认显示第一篇
      if (worksData.length > 0) {
        showWork(0);
        const firstItem = document.querySelector('li[data-index="0"]');
        if (firstItem) firstItem.classList.add('active');
      }
    } catch (err) {
      console.error('加载失败:', err);
    }
  }
})();