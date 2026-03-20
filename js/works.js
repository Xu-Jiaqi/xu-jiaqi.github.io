// 作品集 - 侧边栏导航 + 内容展示

(function() {
  let works = [];
  let activeIndex = -1;

  const listEl = document.getElementById('article-list');
  const contentEl = document.getElementById('content');

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
        <div class="article-body">${marked.parse(work.content)}</div>
      </div>
    `;

    listEl.querySelectorAll('li[data-i]').forEach((li, idx) => {
      li.classList.toggle('active', idx === i);
    });
  }

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