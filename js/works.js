(function() {
  let works = [];
  let activeIndex = 0;
  let dragY = 0;
  let pointerStartY = null;
  let pointerId = null;
  let pointerCaptured = false;
  let lastWheelAt = 0;
  const converter = new showdown.Converter();

  const deck = document.getElementById('works-deck');
  const progress = document.getElementById('deck-progress');
  const featureCover = document.getElementById('feature-cover');
  const featureCoverLabel = document.getElementById('feature-cover-label');
  const featureCoverYear = document.getElementById('feature-cover-year');
  const featureCoverTitle = document.getElementById('feature-cover-title');
  const currentEl = document.getElementById('work-current');
  const totalEl = document.getElementById('work-total');
  const categoryEl = document.getElementById('work-category');
  const titleEl = document.getElementById('work-title');
  const dateEl = document.getElementById('work-date');
  const summaryEl = document.getElementById('work-summary');
  const readBtn = document.getElementById('work-read');
  const articleShell = document.getElementById('works-article-shell');
  const articleBody = document.getElementById('article-body');
  const articleHeading = document.getElementById('article-heading');
  const articleClose = document.getElementById('article-close');

  function esc(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function yearOf(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.getFullYear();
  }

  function categoryLabel(work) {
    return (work.category || 'work').toUpperCase();
  }

  function summaryOf(work) {
    const plain = (work.content || '')
      .replace(/\x60\x60\x60[\s\S]*?\x60\x60\x60/g, ' ')
      .replace(/[#>*_\[\]()$\\-]/g, ' ')
      .replace(/\x60/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!plain) return '暂无摘要';
    return plain.length > 150 ? plain.slice(0, 150).trim() + '…' : plain;
  }

  function cardMarkup(work, index) {
    return '<button class="deck-card" type="button" data-index="' + index + '" aria-label="查看 ' + esc(work.title || 'Untitled') + '">' +
      '<div class="deck-card-border"></div>' +
      '<div class="deck-card-art" aria-hidden="true">' +
        '<span class="deck-axis deck-axis-x"></span>' +
        '<span class="deck-axis deck-axis-y"></span>' +
        '<span class="deck-ring deck-ring-a"></span>' +
        '<span class="deck-ring deck-ring-b"></span>' +
        '<span class="deck-core"></span>' +
      '</div>' +
      '<div class="deck-card-top"><span>' + esc(categoryLabel(work)) + '</span><span>' + esc(yearOf(work.time)) + '</span></div>' +
      '<div class="deck-card-bottom"><span>' + esc(work.title || 'Untitled') + '</span><span>' + pad(index + 1) + '</span></div>' +
    '</button>';
  }

  function renderDeck() {
    totalEl.textContent = pad(works.length);
    deck.innerHTML = works.map(cardMarkup).join('');
    progress.innerHTML = works.map((_, i) => '<span data-progress="' + i + '"></span>').join('');

    deck.querySelectorAll('.deck-card').forEach(card => {
      card.addEventListener('click', () => {
        const index = Number(card.dataset.index);
        if (index !== activeIndex) selectWork(index);
      });
    });

    deck.addEventListener('wheel', onWheel, { passive: false });
    deck.addEventListener('pointerdown', onPointerDown);
    deck.addEventListener('pointermove', onPointerMove);
    deck.addEventListener('pointerup', onPointerUp);
    deck.addEventListener('pointercancel', onPointerUp);
    deck.addEventListener('keydown', onKeyDown);
  }

  function applyDeckTransforms(immediate) {
    const cards = [...deck.querySelectorAll('.deck-card')];
    deck.classList.toggle('is-dragging', immediate);
    deck.style.setProperty('--deck-drag-y', dragY + 'px');

    cards.forEach((card, i) => {
      let offset = i - activeIndex;
      if (works.length > 2) {
        const half = works.length / 2;
        if (offset > half) offset -= works.length;
        if (offset < -half) offset += works.length;
      }

      let slot = 'hidden';
      if (offset === 0) slot = 'top-far';
      else if (offset === 1) slot = 'mid-right';
      else if (offset === -1) slot = 'lower-left';
      else if (offset === 2) slot = 'bottom-far';
      else if (offset === -2) slot = 'top-back';

      card.dataset.slot = slot;
      card.dataset.variant = String((i + Math.abs(offset) * 2) % 5);
      card.style.setProperty('--drag-y', dragY + 'px');
      card.style.opacity = slot === 'hidden' ? '0' : '1';
      card.style.pointerEvents = slot === 'hidden' ? 'none' : 'auto';
      card.classList.toggle('active', i === activeIndex);
      card.setAttribute('aria-current', i === activeIndex ? 'true' : 'false');
    });

    progress.querySelectorAll('span').forEach((dot, i) => {
      dot.classList.toggle('active', i === activeIndex);
    });
  }

  function updateFeature(work, index) {
    currentEl.textContent = pad(index + 1);
    categoryEl.textContent = categoryLabel(work);
    titleEl.textContent = work.title || 'Untitled';
    dateEl.textContent = formatDate(work.time);
    summaryEl.textContent = summaryOf(work);
    featureCoverLabel.textContent = categoryLabel(work);
    featureCoverYear.textContent = yearOf(work.time);
    featureCoverTitle.textContent = work.title || 'Untitled';
    featureCover.dataset.variant = String(index % 5);
  }

  function selectWork(index) {
    if (!works.length) return;
    const next = ((index % works.length) + works.length) % works.length;
    if (!works[next]) return;
    activeIndex = next;
    dragY = 0;
    updateFeature(works[activeIndex], activeIndex);
    applyDeckTransforms(false);
    if (!articleShell.hidden) renderArticle();
  }

  function onWheel(event) {
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    event.preventDefault();
    const now = performance.now();
    if (now - lastWheelAt < 280) return;
    lastWheelAt = now;
    if (event.deltaY > 0) selectWork(activeIndex + 1);
    else if (event.deltaY < 0) selectWork(activeIndex - 1);
  }

  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerStartY = event.clientY;
    pointerId = event.pointerId;
    pointerCaptured = false;
    dragY = 0;
  }

  function onPointerMove(event) {
    if (pointerStartY == null) return;
    const nextDrag = event.clientY - pointerStartY;
    if (!pointerCaptured && Math.abs(nextDrag) > 5) {
      pointerCaptured = true;
      try { deck.setPointerCapture(pointerId); } catch (_) {}
    }
    if (!pointerCaptured) return;
    dragY = Math.max(-130, Math.min(130, nextDrag));
    applyDeckTransforms(true);
  }

  function onPointerUp(event) {
    if (pointerStartY == null) return;
    const distance = dragY;
    const wasCaptured = pointerCaptured;
    pointerStartY = null;
    dragY = 0;
    pointerCaptured = false;
    try {
      if (wasCaptured && deck.hasPointerCapture(pointerId)) deck.releasePointerCapture(pointerId);
    } catch (_) {}
    pointerId = null;

    if (!wasCaptured) return;
    if (distance < -48) selectWork(activeIndex + 1);
    else if (distance > 48) selectWork(activeIndex - 1);
    else applyDeckTransforms(false);
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault();
      selectWork(activeIndex + 1);
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      selectWork(activeIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectWork(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      selectWork(works.length - 1);
    }
  }

  function typesetMath(scopeEl) {
    const run = () => {
      if (!window.MathJax || typeof window.MathJax.typesetPromise !== 'function') return;
      try {
        if (typeof window.MathJax.typesetClear === 'function') {
          window.MathJax.typesetClear([scopeEl]);
        }
      } catch (_) {}
      window.MathJax.typesetPromise([scopeEl]).catch(() => {});
    };

    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') run();
    else if (Array.isArray(window.__mathjaxWaiters)) window.__mathjaxWaiters.push(run);
  }

  function renderArticle() {
    const work = works[activeIndex];
    if (!work) return;
    const raw = converter.makeHtml(work.content || '');
    const safe = window.DOMPurify ? DOMPurify.sanitize(raw) : raw;
    articleHeading.textContent = work.title || 'Article';
    articleBody.innerHTML = safe;
    typesetMath(articleBody);
  }

  readBtn.addEventListener('click', () => {
    renderArticle();
    articleShell.hidden = false;
    articleShell.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  articleClose.addEventListener('click', () => {
    articleShell.hidden = true;
    document.querySelector('.works-scene').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  (async function init() {
    try {
      works = await SiteStore.loadWorks();
      if (!works.length) {
        titleEl.textContent = '暂无作品';
        summaryEl.textContent = 'No works yet.';
        return;
      }
      renderDeck();
      selectWork(0);
    } catch (err) {
      console.error('Load error:', err);
      titleEl.textContent = '加载失败';
      summaryEl.textContent = err.message;
    }
  })();
})();