// 作品集 - 侧边栏导航 + 内容展示

(function() {
  let works = [];
  let activeIndex = -1;

  const listEl = document.getElementById('article-list');
  const contentEl = document.getElementById('content');

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  function esc(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  function renderList() {
    if (works.length === 0) {
      listEl.innerHTML = '<li class="empty-state">还没有作品</li>';
      return;
    }

    listEl.innerHTML = works.map((w, i) =>
      `<li data-i="${i}">${esc(w.title || '无标题')}</li>`
    ).join('');

    listEl.querySelectorAll('li[data-i]').forEach(li => {
      li.addEventListener('click', () => {
        showWork(+li.dataset.i);
      });
    });
  }

  function showWork(i) {
    activeIndex = i;
    const work = works[i];
    if (!work) return;

    try {
      const body = typeof marked !== 'undefined' && marked.parse
        ? marked.parse(work.content || '')
        : esc(work.content || '');

      contentEl.innerHTML = `
        <div class="article-display active">
          <h2 class="article-title">${esc(work.title || '无标题')}</h2>
          <div class="article-meta">${formatDate(work.time)}</div>
          <div class="article-body">${body}</div>
        </div>
      `;
    } catch(e) {
      contentEl.innerHTML = `<div class="error-state">渲染失败：${e.message}</div>`;
    }

    listEl.querySelectorAll('li[data-i]').forEach((li, idx) => {
      li.classList.toggle('active', idx === i);
    });
  }

  (async function init() {
    try {
      works = await GitHubStore.loadWorks();
      console.log('Loaded works:', works);
      renderList();
      if (works.length > 0) {
        showWork(0);
      }
    } catch (err) {
      console.error('Load error:', err);
      listEl.innerHTML = `<li class="error-state">加载失败：${err.message}</li>`;
    }
  })();
})();