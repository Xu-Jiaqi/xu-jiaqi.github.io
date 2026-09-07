(function() {
  let works = [];
  let selectedIndex = 0;

  let railPosition = 0;
  let railVisualPosition = 0;
  let railVelocity = 0;
  let railRaf = null;
  let railLastFrame = 0;
  let railIdleUntil = 0;
  let railSnapTarget = null;
  let railInteracting = false;

  let pointerStartY = null;
  let pointerLastY = null;
  let pointerLastT = null;
  let pointerVelocity = 0;
  let pointerMoved = false;
  let pointerId = null;
  let suppressClickUntil = 0;

  let selectionToken = 0;
  const railCards = new Map();
  const converter = new showdown.Converter();

  const deck = document.getElementById('works-deck');
  const progress = document.getElementById('deck-progress');
  const selectedWrap = document.querySelector('.works-selected-wrap');
  const featureCover = document.getElementById('feature-cover');
  const featureBack = featureCover.querySelector('.selected-card-back');
  const featureCoverLabel = document.getElementById('feature-cover-label');
  const featureCoverYear = document.getElementById('feature-cover-year');
  const featureCoverTitle = document.getElementById('feature-cover-title');
  const selectedCopy = document.querySelector('.works-selected-copy');

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

  const desktopPath = [
    { p: -2.5, x: -0.22, y: 1.18, w: 0.15,  ar: 0.72, ry: -31, rz: 16, z: 0, o: 0.00 },
    { p: -2.0, x: -0.14, y: 0.98, w: 0.189, ar: 0.72, ry: -30, rz: 13, z: 1, o: 0.45 },
    { p: -1.0, x:  0.052,y: 0.77, w: 0.249, ar: 0.72, ry: -26, rz:-11, z: 2, o: 0.82 },
    { p:  0.0, x:  0.15, y: 0.67, w: 0.22,  ar: 0.66, ry: -22, rz: -6, z: 0, o: 0.00 },
    { p:  1.0, x:  0.235,y: 0.53, w: 0.234, ar: 0.62, ry: -18, rz:  8, z: 5, o: 1.00 },
    { p:  2.0, x:  0.38, y: 0.22, w: 0.260, ar: 0.57, ry: -10, rz:  4, z: 4, o: 0.97 },
    { p:  3.0, x:  0.49, y:-0.18, w: 0.355, ar: 0.72, ry: -23, rz:  5, z: 2, o: 0.86 },
    { p:  4.0, x:  0.683,y:-0.31, w: 0.327, ar: 0.72, ry: -29, rz:  8, z: 1, o: 0.66 },
    { p:  5.0, x:  0.86, y:-0.70, w: 0.26,  ar: 0.66, ry: -31, rz: 10, z: 0, o: 0.00 }
  ];

  const mobilePath = [
    { p: -2.5, x: -0.35, y: 1.18, w: 0.34, ar: 0.72, ry: -31, rz: 16, z:-160, o:0.0 },
    { p: -2.0, x: -0.20, y: 1.02, w: 0.38, ar: 0.72, ry: -29, rz: 13, z:-130, o:0.35 },
    { p: -1.0, x:  0.00, y: 0.82, w: 0.46, ar: 0.72, ry: -25, rz:-11, z: -80, o:0.78 },
    { p:  0.0, x:  0.10, y: 0.69, w: 0.43, ar: 0.66, ry: -22, rz: -6, z: -30, o:0.0 },
    { p:  1.0, x:  0.08, y: 0.52, w: 0.58, ar: 0.62, ry: -18, rz:  8, z:  45, o:1.0 },
    { p:  2.0, x:  0.30, y: 0.22, w: 0.62, ar: 0.57, ry: -10, rz:  4, z:  20, o:0.96 },
    { p:  3.0, x:  0.50, y:-0.10, w: 0.68, ar: 0.72, ry: -23, rz:  5, z: -55, o:0.84 },
    { p:  4.0, x:  0.72, y:-0.48, w: 0.58, ar: 0.62, ry: -28, rz:  8, z:-120, o:0.62 },
    { p:  5.0, x:  0.88, y:-0.80, w: 0.48, ar: 0.62, ry: -31, rz: 10, z:-170, o:0.0 }
  ];

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function wrap(index) {
    if (!works.length) return 0;
    return ((index % works.length) + works.length) % works.length;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
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
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#>*_\[\]()$\\-]/g, ' ')
      .replace(/`/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!plain) return '暂无摘要';
    return plain.length > 150 ? plain.slice(0, 150).trim() + '…' : plain;
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function cardMarkup(seq) {
    const index = wrap(seq);
    const work = works[index];
    return '<button class="deck-card flow-card" type="button" data-seq="' + seq + '" data-index="' + index + '" aria-label="查看 ' + escapeHtml(work.title || 'Untitled') + '">' +
      '<div class="deck-card-border"></div>' +
      '<div class="deck-card-art" aria-hidden="true">' +
        '<span class="deck-axis deck-axis-x"></span>' +
        '<span class="deck-axis deck-axis-y"></span>' +
        '<span class="deck-ring deck-ring-a"></span>' +
        '<span class="deck-ring deck-ring-b"></span>' +
        '<span class="deck-core"></span>' +
      '</div>' +
      '<div class="deck-card-top"><span>' + escapeHtml(categoryLabel(work)) + '</span><span>' + escapeHtml(yearOf(work.time)) + '</span></div>' +
      '<div class="deck-card-bottom"><span>' + escapeHtml(work.title || 'Untitled') + '</span><span>' + pad(index + 1) + '</span></div>' +
    '</button>';
  }

  function syncRailCards() {
    if (!works.length) return;

    const center = Math.floor(railPosition);
    const start = center - 4;
    const end = center + 7;

    for (let seq = start; seq <= end; seq += 1) {
      if (railCards.has(seq)) continue;
      deck.insertAdjacentHTML('beforeend', cardMarkup(seq));
      const card = deck.lastElementChild;
      railCards.set(seq, card);

      card.addEventListener('click', (event) => {
        if (performance.now() < suppressClickUntil || pointerMoved) {
          event.preventDefault();
          return;
        }
        selectWork(Number(card.dataset.index), true);
      });
    }

    for (const [seq, card] of railCards.entries()) {
      if (seq < start || seq > end) {
        card.remove();
        railCards.delete(seq);
      }
    }
  }

  function pathStateAt(p) {
    const path = window.innerWidth <= 820 ? mobilePath : desktopPath;

    if (p <= path[0].p) return { ...path[0] };
    if (p >= path[path.length - 1].p) return { ...path[path.length - 1] };

    for (let i = 0; i < path.length - 1; i += 1) {
      const a = path[i];
      const b = path[i + 1];
      if (p < a.p || p > b.p) continue;
      const t = (p - a.p) / (b.p - a.p);
      return {
        p,
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        w: lerp(a.w, b.w, t),
        ar: lerp(a.ar, b.ar, t),
        ry: lerp(a.ry, b.ry, t),
        rz: lerp(a.rz, b.rz, t),
        z: lerp(a.z, b.z, t),
        o: lerp(a.o, b.o, t)
      };
    }

    return { ...path[path.length - 1] };
  }

  function renderRail() {
    if (!works.length) return;

    deck.dataset.railPosition = railPosition.toFixed(4);
    deck.dataset.railVisualPosition = railVisualPosition.toFixed(4);
    deck.dataset.railVelocity = railVelocity.toFixed(4);
    syncRailCards();
    const rect = deck.getBoundingClientRect();

    for (const [seq, card] of railCards.entries()) {
      const p = seq - railVisualPosition;
      const s = pathStateAt(p);
      const width = Math.max(64, s.w * rect.width);
      const zOrder = Math.round(100 + s.z);

      card.style.left = (s.x * 100) + '%';
      card.style.top = (s.y * 100) + '%';
      card.style.width = width + 'px';
      card.style.aspectRatio = String(s.ar);
      card.style.opacity = String(clamp(s.o, 0, 1));
      card.style.zIndex = String(zOrder);
      card.style.pointerEvents = s.o < 0.08 ? 'none' : 'auto';
      card.style.transform = 'translate3d(0,0,' + s.z + 'px) rotateY(' + s.ry + 'deg) rotateZ(' + s.rz + 'deg)';
      card.dataset.variant = String(Math.abs(seq) % 5);
    }
  }

  function railTick(now) {
    if (!railLastFrame) railLastFrame = now;
    const dt = clamp((now - railLastFrame) / 1000, 0.001, 0.034);
    railLastFrame = now;

    if (!railInteracting) {
      const canSnap = now >= railIdleUntil;

      if (!canSnap) {
        railPosition += railVelocity * dt;
        railVelocity *= Math.exp(-2.15 * dt);
      } else {
        if (railSnapTarget == null) {
          railSnapTarget = Math.round(railPosition + railVelocity * 0.30);
        }

        const displacement = railSnapTarget - railPosition;
        const spring = 34.0;
        const damping = 8.1;
        railVelocity += (spring * displacement - damping * railVelocity) * dt;
        railPosition += railVelocity * dt;
      }
    }

    const visualFollow = 1 - Math.exp(-(railInteracting ? 24 : 18) * dt);
    railVisualPosition += (railPosition - railVisualPosition) * visualFollow;
    renderRail();

    const snapError = railSnapTarget == null ? 1 : Math.abs(railSnapTarget - railPosition);
    const visualError = Math.abs(railPosition - railVisualPosition);
    const stillMoving =
      railInteracting ||
      now < railIdleUntil ||
      Math.abs(railVelocity) > 0.006 ||
      snapError > 0.0015 ||
      visualError > 0.0015;

    if (!stillMoving) {
      railPosition = railSnapTarget == null ? railPosition : railSnapTarget;
      railVelocity = 0;
      railSnapTarget = null;
      railVisualPosition = railPosition;
      railLastFrame = 0;
      renderRail();
      railRaf = null;
      return;
    }

    railRaf = requestAnimationFrame(railTick);
  }

  function ensureRailTick() {
    if (railRaf == null) {
      railLastFrame = 0;
      railRaf = requestAnimationFrame(railTick);
    }
  }

  function kickRail(velocityImpulse, idleDelay) {
    railSnapTarget = null;
    railVelocity = clamp(railVelocity + velocityImpulse, -5.4, 5.4);
    railIdleUntil = performance.now() + idleDelay;
    ensureRailTick();
  }

  function onWheel(event) {
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    event.preventDefault();

    const abs = Math.abs(event.deltaY);
    const magnitude = abs >= 80
      ? clamp(abs * 0.0085, 1.50, 2.60)
      : clamp(abs * 0.0120, 0.12, 0.68);
    const impulse = Math.sign(event.deltaY) * magnitude;
    kickRail(impulse, 145);
  }

  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    pointerStartY = event.clientY;
    pointerLastY = event.clientY;
    pointerLastT = performance.now();
    pointerVelocity = 0;
    pointerMoved = false;
    pointerId = event.pointerId;

    railInteracting = true;
    railSnapTarget = null;
    railVelocity *= 0.28;
    ensureRailTick();
  }

  function onPointerMove(event) {
    if (pointerStartY == null) return;

    const now = performance.now();
    const totalDelta = pointerStartY - event.clientY;

    if (!pointerMoved && Math.abs(totalDelta) > 5) {
      pointerMoved = true;
      try { deck.setPointerCapture(pointerId); } catch (_) {}
    }

    if (!pointerMoved) return;

    const dy = event.clientY - pointerLastY;
    const dt = Math.max(8, now - pointerLastT) / 1000;
    const cardDelta = dy / 168;
    const instantVelocity = cardDelta / dt;

    railPosition += cardDelta;
    pointerVelocity = pointerVelocity * 0.66 + instantVelocity * 0.34;
    railVelocity = pointerVelocity;

    pointerLastY = event.clientY;
    pointerLastT = now;
  }

  function onPointerUp(event) {
    if (pointerStartY == null) return;

    const moved = pointerMoved;
    pointerStartY = null;
    railInteracting = false;

    try {
      if (moved && deck.hasPointerCapture(pointerId)) deck.releasePointerCapture(pointerId);
    } catch (_) {}

    pointerId = null;

    if (moved) {
      suppressClickUntil = performance.now() + 150;
      railVelocity = clamp(pointerVelocity * 0.82, -4.7, 4.7);
      railIdleUntil = performance.now() + 72;
      railSnapTarget = null;
      ensureRailTick();
    } else {
      railVelocity = 0;
      railSnapTarget = Math.round(railPosition);
      railIdleUntil = performance.now();
      ensureRailTick();
    }

    setTimeout(() => {
      pointerMoved = false;
    }, 0);
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault();
      kickRail(2.05, 70);
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      kickRail(-2.05, 70);
    }
  }

  function updateSelectedContent(index) {
    const work = works[index];
    if (!work) return;

    selectedIndex = index;
    progress.querySelectorAll('span').forEach((dot, i) => {
      dot.classList.toggle('active', i === selectedIndex);
    });
    currentEl.textContent = pad(index + 1);
    totalEl.textContent = pad(works.length);
    categoryEl.textContent = categoryLabel(work);
    titleEl.textContent = work.title || 'Untitled';
    dateEl.textContent = formatDate(work.time);
    summaryEl.textContent = summaryOf(work);

    featureCoverLabel.textContent = categoryLabel(work);
    featureCoverYear.textContent = yearOf(work.time);
    featureCoverTitle.textContent = work.title || 'Untitled';
    featureCover.dataset.variant = String(index % 5);

    if (!articleShell.hidden) renderArticle();
  }

  function runRingAnimation() {
    const ring = selectedWrap.querySelector('.works-flip-ring');
    if (!ring) return;

    const orbitA = ring.querySelector('.ring-orbit-a');
    const orbitB = ring.querySelector('.ring-orbit-b');
    const ghost = selectedWrap.querySelector('.works-flip-ghost');

    ring.getAnimations().forEach(a => a.cancel());
    if (orbitA) orbitA.getAnimations().forEach(a => a.cancel());
    if (orbitB) orbitB.getAnimations().forEach(a => a.cancel());
    if (ghost) ghost.getAnimations().forEach(a => a.cancel());

    if (ghost) {
      ghost.animate([
        { opacity: 0, transform: 'translate(-50%,-50%) translate3d(94px,-54px,0) rotateY(-62deg) rotateZ(16deg) scale(.64)' },
        { opacity: .30, offset: .20 },
        { opacity: .18, transform: 'translate(-50%,-50%) translate3d(36px,-22px,0) rotateY(-24deg) rotateZ(8deg) scale(.90)', offset: .55 },
        { opacity: 0, transform: 'translate(-50%,-50%) translate3d(3px,-2px,0) rotateY(5deg) rotateZ(3deg) scale(1.03)' }
      ], {
        duration: 470,
        easing: 'cubic-bezier(.16,.72,.18,1)',
        fill: 'both'
      });
    }

    ring.animate([
      { opacity: 0, transform: 'translate(-50%, -50%) scale(.12) rotate(-32deg)' },
      { opacity: .78, transform: 'translate(-50%, -50%) scale(.38) rotate(-18deg)', offset: .18 },
      { opacity: .94, transform: 'translate(-50%, -50%) scale(.88) rotate(5deg)', offset: .52 },
      { opacity: .58, transform: 'translate(-50%, -50%) scale(1.10) rotate(18deg)', offset: .76 },
      { opacity: 0, transform: 'translate(-50%, -50%) scale(1.28) rotate(28deg)' }
    ], {
      duration: 590,
      easing: 'cubic-bezier(.16,.72,.18,1)',
      fill: 'both'
    });

    if (orbitA) {
      orbitA.animate([
        { opacity: 0, transform: 'translate(-50%, -50%) rotate(-50deg) scale(.45)' },
        { opacity: .72, offset: .25 },
        { opacity: .38, transform: 'translate(-50%, -50%) rotate(34deg) scale(1.12)', offset: .76 },
        { opacity: 0, transform: 'translate(-50%, -50%) rotate(56deg) scale(1.28)' }
      ], {
        duration: 620,
        easing: 'cubic-bezier(.2,.65,.16,1)',
        fill: 'both'
      });
    }

    if (orbitB) {
      orbitB.animate([
        { opacity: 0, transform: 'translate(-50%, -50%) rotate(42deg) scale(.30)' },
        { opacity: .55, offset: .20 },
        { opacity: .26, transform: 'translate(-50%, -50%) rotate(-34deg) scale(1.18)', offset: .72 },
        { opacity: 0, transform: 'translate(-50%, -50%) rotate(-58deg) scale(1.34)' }
      ], {
        duration: 560,
        easing: 'cubic-bezier(.15,.7,.2,1)',
        fill: 'both'
      });
    }
  }

  async function selectWork(index, animated) {
    if (!works.length) return;

    const next = wrap(index);
    if (next === selectedIndex && animated) return;

    if (!animated) {
      updateSelectedContent(next);
      return;
    }

    const token = ++selectionToken;

    featureCover.getAnimations().forEach(a => a.cancel());
    selectedCopy.getAnimations().forEach(a => a.cancel());
    featureBack.classList.remove('visible');

    const outCard = featureCover.animate([
      {
        opacity: 1,
        filter: 'blur(0px)',
        transform: 'translate3d(0,0,0) rotateY(7deg) rotateZ(2.5deg) scale(1)'
      },
      {
        opacity: .72,
        filter: 'blur(.15px)',
        transform: 'translate3d(-10px,5px,0) rotateY(15deg) rotateZ(0deg) scale(.97)',
        offset: .48
      },
      {
        opacity: 0,
        filter: 'blur(.8px)',
        transform: 'translate3d(-34px,14px,0) rotateY(28deg) rotateZ(-5deg) scale(.88)'
      }
    ], {
      duration: 150,
      easing: 'cubic-bezier(.42,0,.86,.34)',
      fill: 'both'
    });

    selectedCopy.animate([
      { opacity: 1, translate: '0 0' },
      { opacity: 0, translate: '-16px 2px' }
    ], {
      duration: 135,
      easing: 'cubic-bezier(.35,0,.7,.2)',
      fill: 'both'
    });

    try { await outCard.finished; } catch (_) {}
    if (token !== selectionToken) return;

    updateSelectedContent(next);
    runRingAnimation();
    featureBack.classList.add('visible');

    const inCard = featureCover.animate([
      {
        opacity: 0,
        filter: 'blur(1.4px)',
        boxShadow: '0 10px 24px rgba(0,0,0,.06)',
        transform: 'translate3d(82px,-48px,0) rotateY(-72deg) rotateZ(14deg) scale(.66)'
      },
      {
        opacity: .78,
        filter: 'blur(.5px)',
        boxShadow: '0 20px 48px rgba(0,0,0,.13)',
        transform: 'translate3d(62px,-36px,0) rotateY(-58deg) rotateZ(11deg) scale(.76)',
        offset: .18
      },
      {
        opacity: 1,
        filter: 'blur(0px)',
        boxShadow: '0 30px 68px rgba(0,0,0,.17)',
        transform: 'translate3d(35px,-20px,0) rotateY(-24deg) rotateZ(8deg) scale(.91)',
        offset: .40
      },
      {
        opacity: 1,
        filter: 'blur(0px)',
        boxShadow: '0 32px 72px rgba(0,0,0,.17)',
        transform: 'translate3d(7px,-4px,0) rotateY(4deg) rotateZ(4deg) scale(1.045)',
        offset: .67
      },
      {
        opacity: 1,
        filter: 'blur(0px)',
        boxShadow: '0 25px 61px rgba(0,0,0,.145)',
        transform: 'translate3d(-5px,3px,0) rotateY(11deg) rotateZ(1.5deg) scale(1.012)',
        offset: .82
      },
      {
        opacity: 1,
        filter: 'blur(0px)',
        boxShadow: '0 26px 65px rgba(0,0,0,.13)',
        transform: 'translate3d(0,0,0) rotateY(7deg) rotateZ(2.5deg) scale(1)'
      }
    ], {
      duration: 565,
      easing: 'cubic-bezier(.16,.76,.17,1)',
      fill: 'both'
    });

    setTimeout(() => {
      if (token === selectionToken) featureBack.classList.remove('visible');
    }, 205);

    selectedCopy.animate([
      { opacity: 0, translate: '22px 3px' },
      { opacity: .35, translate: '10px 1px', offset: .35 },
      { opacity: 1, translate: '0 0' }
    ], {
      duration: 330,
      delay: 205,
      easing: 'cubic-bezier(.18,.68,.2,1)',
      fill: 'both'
    });

    try { await inCard.finished; } catch (_) {}
    if (token !== selectionToken) return;

    featureCover.getAnimations().forEach(a => a.cancel());
    selectedCopy.getAnimations().forEach(a => a.cancel());
    featureCover.style.opacity = '';
    featureCover.style.filter = '';
    featureCover.style.boxShadow = '';
    featureCover.style.transform = '';
    featureBack.classList.remove('visible');
    selectedCopy.style.opacity = '';
    selectedCopy.style.translate = '';
  }

  function typesetMath(scopeEl) {
    const run = () => {
      if (!window.MathJax || typeof window.MathJax.typesetPromise !== 'function') return;
      try {
        if (typeof window.MathJax.typesetClear === 'function') window.MathJax.typesetClear([scopeEl]);
      } catch (_) {}
      window.MathJax.typesetPromise([scopeEl]).catch(() => {});
    };

    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') run();
    else if (Array.isArray(window.__mathjaxWaiters)) window.__mathjaxWaiters.push(run);
  }

  function renderArticle() {
    const work = works[selectedIndex];
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

  deck.classList.add('flow-mode');
  deck.addEventListener('wheel', onWheel, { passive: false });
  deck.addEventListener('pointerdown', onPointerDown);
  deck.addEventListener('pointermove', onPointerMove);
  deck.addEventListener('pointerup', onPointerUp);
  deck.addEventListener('pointercancel', onPointerUp);
  deck.addEventListener('keydown', onKeyDown);

  window.addEventListener('resize', () => renderRail());

  (async function init() {
    try {
      works = await SiteStore.loadWorks();

      if (!works.length) {
        titleEl.textContent = '暂无作品';
        summaryEl.textContent = 'No works yet.';
        return;
      }

      totalEl.textContent = pad(works.length);
      progress.innerHTML = works.map((_, i) => '<span data-progress="' + i + '"></span>').join('');
      updateSelectedContent(0);
      renderRail();
    } catch (err) {
      console.error('Load error:', err);
      titleEl.textContent = '加载失败';
      summaryEl.textContent = err.message;
    }
  })();
})();