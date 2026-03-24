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
      // use buttons inside li for accessibility and focus
      listEl.innerHTML = items.map(w => {
        const globalIndex = works.indexOf(w);
        return `<li><button data-i="${globalIndex}" class="article-link">${esc(w.title || '无标题')}</button></li>`;
      }).join('');
    };

    renderOne(paperList, papers);
    renderOne(noteList, notes);

    [paperList, noteList].forEach(listEl => {
      listEl.querySelectorAll('button.article-link').forEach(btn => {
        btn.addEventListener('click', () => {
          showWork(+btn.dataset.i);
        });
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            showWork(+btn.dataset.i);
          }
        });
      });
    });
  }

  function typesetMath(scopeEl) {
    const run = () => {
      if (!window.MathJax || typeof window.MathJax.typesetPromise !== 'function') return;
      try {
        if (typeof window.MathJax.typesetClear === 'function') {
          window.MathJax.typesetClear([scopeEl]);
        }
      } catch (e) {
        // no-op: typesetClear is best effort
      }
      window.MathJax.typesetPromise([scopeEl]).catch((err) => {
        console.error('MathJax render error:', err);
      });
    };

    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
      run();
      return;
    }

    // Queue re-render until MathJax script is available.
    if (Array.isArray(window.__mathjaxWaiters)) {
      window.__mathjaxWaiters.push(run);
    }
  }

  function showWork(i) {
    activeIndex = i;
    const work = works[i];
    if (!work) return;

    try {
      const raw = converter.makeHtml(work.content || '');
      // sanitize HTML produced by the markdown converter
      const body = (window.DOMPurify && window.DOMPurify.sanitize) ?
        window.DOMPurify.sanitize(raw) : raw.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');

      contentEl.innerHTML = `
        <div class="article-display active">
          <h2 class="article-title">${esc(work.title || '无标题')}</h2>
          <div class="article-meta">${formatDate(work.time)}</div>
          <div class="article-body">${body}</div>
        </div>
      `;

      typesetMath(contentEl);
    } catch(e) {
      contentEl.innerHTML = `<div class="error-state">渲染失败：${e.message}</div>`;
    }

    [paperList, noteList].forEach(listEl => {
      listEl.querySelectorAll('button.article-link').forEach(btn => {
        const idx = +btn.dataset.i;
        btn.classList.toggle('active', idx === i);
        if (idx === i) btn.setAttribute('aria-current', 'true'); else btn.removeAttribute('aria-current');
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
