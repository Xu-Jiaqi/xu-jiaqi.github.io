// 作品集 - 侧边栏导航 + 内容展示

(function() {
  let works = [];
  let activeIndex = -1;

  const listEl = document.getElementById('article-list');
  const contentEl = document.getElementById('content');
  const form = document.getElementById('add-form');
  const titleInput = document.getElementById('title-input');
  const contentInput = document.getElementById('content-input');
  const submitBtn = document.getElementById('submit-btn');

  // 格式化日期
  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // 转义 HTML
  function esc(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  // 渲染侧边栏列表
  function renderList() {
    if (works.length === 0) {
      listEl.innerHTML = '<li class="empty-state">还没有作品</li>';
      return;
    }

    listEl.innerHTML = works.map((w, i) =>
      `<li data-i="${i}">${esc(w.title)}</li>`
    ).join('');

    listEl.querySelectorAll('li[data-i]').forEach(li => {
      li.addEventListener('click', () => {
        showWork(+li.dataset.i);
      });
    });
  }

  // 显示指定作品
  function showWork(i) {
    activeIndex = i;
    const work = works[i];

    contentEl.innerHTML = `
      <div class="article-display active">
        <h2 class="article-title">${esc(work.title)}</h2>
        <div class="article-meta">${formatDate(work.time)}</div>
        <div class="article-body">${esc(work.content)}</div>
      </div>
    `;

    // 更新激活状态
    listEl.querySelectorAll('li[data-i]').forEach((li, idx) => {
      li.classList.toggle('active', idx === i);
    });
  }

  // 提交
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    if (!title || !content) return;

    submitBtn.disabled = true;
    submitBtn.textContent = '发布中...';

    try {
      await GitHubStore.saveWork(title, content);
      titleInput.value = '';
      contentInput.value = '';
      works = await GitHubStore.loadWorks();
      renderList();
      if (works.length > 0) {
        showWork(0);
      }
    } catch (err) {
      alert('发布失败：' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '发布';
    }
  });

  // 初始化
  (async function init() {
    try {
      works = await GitHubStore.loadWorks();
      renderList();
      if (works.length > 0) {
        showWork(0);
      }
    } catch (err) {
      listEl.innerHTML = `<li class="error-state">加载失败：${err.message}</li>`;
    }
  })();
})();