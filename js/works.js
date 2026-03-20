(function () {
  let works = [];
  let activeIndex = -1;
  const converter = new showdown.Converter({ tables: true, strikethrough: true });

  const sidebarEl = document.getElementById('sidebar');
  const mainEl = document.getElementById('main');

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function renderSidebar() {
    sidebarEl.innerHTML = '';
    if (works.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'sidebar-empty';
      empty.textContent = '还没有作品';
      sidebarEl.appendChild(empty);
      return;
    }
    works.forEach((w, i) => {
      const btn = document.createElement('button');
      btn.className = 'sidebar-item' + (i === activeIndex ? ' active' : '');
      btn.textContent = w.title || '无标题';
      btn.addEventListener('click', () => showWork(i));
      sidebarEl.appendChild(btn);
    });
  }

  function showWork(i) {
    activeIndex = i;
    const work = works[i];
    if (!work) return;

    let body;
    try {
      body = converter.makeHtml(work.content || '');
    } catch (e) {
      mainEl.innerHTML = `<p class="status-msg error">渲染失败：${e.message}</p>`;
      return;
    }

    mainEl.innerHTML = `
      <article class="works-article">
        <h1>${esc(work.title || '无标题')}</h1>
        <div class="article-meta">${formatDate(work.time)}</div>
        <div class="article-body">${body}</div>
      </article>
    `;

    // Update active state
    sidebarEl.querySelectorAll('.sidebar-item').forEach((btn, idx) => {
      btn.classList.toggle('active', idx === i);
    });
  }

  (async function init() {
    try {
      works = await GitHubStore.loadWorks();
      renderSidebar();
      if (works.length > 0) showWork(0);
    } catch (err) {
      sidebarEl.innerHTML = `<span class="sidebar-empty">加载失败</span>`;
      mainEl.innerHTML = `<p class="status-msg error">加载失败：${err.message}</p>`;
    }
  })();
})();
