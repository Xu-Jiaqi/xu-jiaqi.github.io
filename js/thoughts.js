// 日有所思 - 轮播卡片 + 长文阅读态

(function() {
  let thoughts = [];
  let current = 0;
  let timer = null;
  let lastFocus = null;

  const track = document.getElementById('track');
  const dots = document.getElementById('dots');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function esc(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  function isLongThought(thought) {
    return thought.content.length > 220 || thought.content.includes('\n\n');
  }

  function renderThought(thought, index) {
    if (!isLongThought(thought)) {
      return `
        <div class="carousel-slide">
          <div class="carousel-time">${formatDate(thought.time)}</div>
          <div class="carousel-content">${esc(thought.content)}</div>
        </div>
      `;
    }

    return `
      <div class="carousel-slide carousel-slide--long">
        <button class="thought-preview" type="button" data-thought-index="${index}" aria-label="阅读全文：${esc(thought.title || '思考')}">
          <span class="carousel-time">${formatDate(thought.time)}</span>
          <span class="thought-preview-title">${esc(thought.title || 'Untitled thought')}</span>
          <span class="thought-preview-excerpt">${esc(thought.excerpt || '')}</span>
          <span class="thought-preview-action">阅读全文</span>
        </button>
      </div>
    `;
  }

  function ensureReader() {
    let reader = document.getElementById('thought-reader');
    if (reader) return reader;

    reader = document.createElement('div');
    reader.id = 'thought-reader';
    reader.className = 'thought-reader';
    reader.hidden = true;
    reader.innerHTML = `
      <button class="thought-reader-backdrop" type="button" aria-label="关闭阅读"></button>
      <aside class="thought-reader-panel" role="dialog" aria-modal="true" aria-labelledby="thought-reader-title">
        <button class="thought-reader-close" type="button" aria-label="关闭">×</button>
        <div class="thought-reader-time"></div>
        <h2 class="thought-reader-title" id="thought-reader-title"></h2>
        <div class="thought-reader-body"></div>
      </aside>
    `;
    document.body.appendChild(reader);

    reader.querySelector('.thought-reader-backdrop').addEventListener('click', closeReader);
    reader.querySelector('.thought-reader-close').addEventListener('click', closeReader);
    return reader;
  }

  function openReader(index) {
    const thought = thoughts[index];
    if (!thought) return;

    const reader = ensureReader();
    lastFocus = document.activeElement;
    clearInterval(timer);

    const body = thought.title && thought.content.startsWith(thought.title)
      ? thought.content.slice(thought.title.length).trimStart()
      : thought.content;

    reader.querySelector('.thought-reader-time').textContent = formatDate(thought.time);
    reader.querySelector('.thought-reader-title').textContent = thought.title || 'Thought';
    reader.querySelector('.thought-reader-body').textContent = body;
    reader.hidden = false;
    document.body.classList.add('thought-reader-open');

    reader.querySelector('.thought-reader-panel').scrollTop = 0;
    reader.querySelector('.thought-reader-close').focus();
  }

  function closeReader() {
    const reader = document.getElementById('thought-reader');
    if (!reader || reader.hidden) return;

    reader.hidden = true;
    document.body.classList.remove('thought-reader-open');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    resetTimer();
  }

  function render() {
    if (thoughts.length === 0) {
      track.innerHTML = '<div class="loading">还没有记录 / No records yet</div>';
      dots.innerHTML = '';
      return;
    }

    track.innerHTML = `
      <div class="carousel-slides" id="slides">
        ${thoughts.map(renderThought).join('')}
      </div>
    `;

    track.querySelectorAll('.thought-preview').forEach(preview => {
      preview.addEventListener('click', () => openReader(+preview.dataset.thoughtIndex));
    });

    dots.innerHTML = thoughts.map((_, i) =>
      `<button class="carousel-dot ${i === 0 ? 'active' : ''}" data-i="${i}" aria-label="切换到第 ${i+1} 条思考"></button>`
    ).join('');

    dots.querySelectorAll('.carousel-dot').forEach(dot => {
      dot.addEventListener('click', () => goTo(+dot.dataset.i));
    });

    updateSlide();
  }

  function updateSlide() {
    const slides = document.getElementById('slides');
    if (!slides) return;
    slides.style.transform = `translateX(-${current * 100}%)`;

    dots.querySelectorAll('.carousel-dot').forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
  }

  function goTo(i) {
    current = i;
    updateSlide();
    resetTimer();
  }

  function startTimer() {
    if (thoughts.length <= 1 || document.body.classList.contains('thought-reader-open')) return;
    timer = setInterval(() => {
      current = (current + 1) % thoughts.length;
      updateSlide();
    }, 5000);
  }

  function resetTimer() {
    clearInterval(timer);
    startTimer();
  }

  prevBtn.addEventListener('click', () => {
    current = (current - 1 + thoughts.length) % thoughts.length;
    updateSlide();
    resetTimer();
  });

  nextBtn.addEventListener('click', () => {
    current = (current + 1) % thoughts.length;
    updateSlide();
    resetTimer();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeReader();
  });

  (async function init() {
    try {
      thoughts = await SiteStore.loadThoughts();
      render();
      startTimer();
    } catch (err) {
      track.innerHTML = `<div class="error-state">加载失败：${esc(err.message)} / Load failed</div>`;
    }
  })();
})();
