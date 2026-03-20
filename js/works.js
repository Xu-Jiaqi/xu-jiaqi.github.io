// 作品集 - 侧边栏导航 + 内容展示

(function() {
  let works = [];
  let activeIndex = -1;
  const converter = new showdown.Converter();

  const paperList = document.getElementById('paper-list');
  const noteList = document.getElementById('note-list');
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

  function renderLists() {
    const papers = works.filter(w => (w.category || 'paper') === 'paper');
    const notes = works.filter(w => w.category === 'note');

    const renderOne = (listEl, items) => {
      if (items.length === 0) {
        listEl.innerHTML = '<li class="empty-item">暂无 / None</li>';
        return;
      }
      listEl.innerHTML = items.map(w => {
        const globalIndex = works.indexOf(w);
        return `<li data-i="${globalIndex}">${esc(w.title || '无标题')}</li>`;
      }).join('');
    };

    renderOne(paperList, papers);
    renderOne(noteList, notes);

    [paperList, noteList].forEach(listEl => {
      listEl.querySelectorAll('li[data-i]').forEach(li => {
        li.addEventListener('click', () => {
          showWork(+li.dataset.i);
        });
      });
    });
  }

  function showWork(i) {
    activeIndex = i;
    const work = works[i];
    if (!work) return;

    try {
      const body = converter.makeHtml(work.content || '');

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

    [paperList, noteList].forEach(listEl => {
      listEl.querySelectorAll('li[data-i]').forEach(li => {
        li.classList.toggle('active', +li.dataset.i === i);
      });
    });
  }

  (async function init() {
    try {
      works = await GitHubStore.loadWorks();
      renderLists();
      if (works.length > 0) {
        showWork(0);
      }
    } catch (err) {
      console.error('Load error:', err);
      paperList.innerHTML = `<li class="error-state">加载失败 / Load failed</li>`;
    }
  })();
})();