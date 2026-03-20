// 日有所思 - 轮播卡片

(function() {
  let thoughts = [];
  let current = 0;
  let timer = null;

  const track = document.getElementById('track');
  const dots = document.getElementById('dots');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function esc(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  function render() {
    if (thoughts.length === 0) {
      track.innerHTML = '<div class="loading">还没有记录</div>';
      dots.innerHTML = '';
      return;
    }

    track.innerHTML = `
      <div class="carousel-slides" id="slides">
        ${thoughts.map(t => `
          <div class="carousel-slide">
            <div class="carousel-time">${formatDate(t.time)}</div>
            <div class="carousel-content">${esc(t.content)}</div>
          </div>
        `).join('')}
      </div>
    `;

    dots.innerHTML = thoughts.map((_, i) =>
      `<div class="carousel-dot ${i === 0 ? 'active' : ''}" data-i="${i}"></div>`
    ).join('');

    dots.querySelectorAll('.carousel-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        goTo(+dot.dataset.i);
      });
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

  (async function init() {
    try {
      thoughts = await GitHubStore.loadThoughts();
      render();
      startTimer();
    } catch (err) {
      track.innerHTML = `<div class="error-state">加载失败：${err.message}</div>`;
    }
  })();
})();