(function () {
  let thoughts = [];
  let current = 0;
  let timer = null;

  const stage = document.getElementById('stage');
  const dotsEl = document.getElementById('dots');

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function render() {
    if (thoughts.length === 0) {
      stage.innerHTML = '<div class="status-msg">还没有记录</div>';
      dotsEl.innerHTML = '';
      return;
    }

    // Build track
    const track = document.createElement('div');
    track.className = 'slider-track';

    const slides = document.createElement('div');
    slides.className = 'slider-slides';
    slides.id = 'slides';

    thoughts.forEach(t => {
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.innerHTML = `
        <div class="slide-time">${formatDate(t.time)}</div>
        <div class="slide-content">${esc(t.content)}</div>
      `;
      slides.appendChild(slide);
    });
    track.appendChild(slides);

    // Arrows
    const prev = document.createElement('button');
    prev.className = 'slider-arrow prev';
    prev.innerHTML = '&#8249;';
    prev.addEventListener('click', () => { goTo((current - 1 + thoughts.length) % thoughts.length); });

    const next = document.createElement('button');
    next.className = 'slider-arrow next';
    next.innerHTML = '&#8250;';
    next.addEventListener('click', () => { goTo((current + 1) % thoughts.length); });

    stage.innerHTML = '';
    stage.appendChild(prev);
    stage.appendChild(track);
    stage.appendChild(next);

    // Dots
    dotsEl.innerHTML = thoughts.map((_, i) =>
      `<button class="dot${i === 0 ? ' active' : ''}" data-i="${i}"></button>`
    ).join('');

    dotsEl.querySelectorAll('.dot').forEach(dot => {
      dot.addEventListener('click', () => goTo(+dot.dataset.i));
    });

    updateSlide();
  }

  function updateSlide() {
    const slides = document.getElementById('slides');
    if (slides) slides.style.transform = `translateX(-${current * 100}%)`;
    dotsEl.querySelectorAll('.dot').forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
  }

  function goTo(i) {
    current = i;
    updateSlide();
    resetTimer();
  }

  function startTimer() {
    if (thoughts.length <= 1) return;
    timer = setInterval(() => {
      current = (current + 1) % thoughts.length;
      updateSlide();
    }, 5000);
  }

  function resetTimer() {
    clearInterval(timer);
    startTimer();
  }

  (async function init() {
    try {
      thoughts = await GitHubStore.loadThoughts();
      render();
      startTimer();
    } catch (err) {
      stage.innerHTML = `<div class="status-msg error">加载失败：${err.message}</div>`;
    }
  })();
})();
