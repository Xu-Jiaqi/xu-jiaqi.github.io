// 日有所思 - 轮播卡片

(function() {
  let thoughts = [];
  let current = 0;
  let timer = null;

  const track = document.getElementById('track');
  const dots = document.getElementById('dots');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const form = document.getElementById('add-form');
  const input = document.getElementById('content-input');
  const submitBtn = document.getElementById('submit-btn');

  // 格式化日期
  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // 转义 HTML
  function esc(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  // 渲染轮播
  function render() {
    if (thoughts.length === 0) {
      track.innerHTML = '<div class="loading">还没有记录，记录你的第一个想法吧</div>';
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

    // 绑定圆点点击
    dots.querySelectorAll('.carousel-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        goTo(+dot.dataset.i);
      });
    });

    updateSlide();
  }

  // 更新轮播位置
  function updateSlide() {
    const slides = document.getElementById('slides');
    if (!slides) return;
    slides.style.transform = `translateX(-${current * 100}%)`;

    dots.querySelectorAll('.carousel-dot').forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
  }

  // 跳转到某页
  function goTo(i) {
    current = i;
    updateSlide();
    resetTimer();
  }

  // 自动播放
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

  // 上一页
  prevBtn.addEventListener('click', () => {
    current = (current - 1 + thoughts.length) % thoughts.length;
    updateSlide();
    resetTimer();
  });

  // 下一页
  nextBtn.addEventListener('click', () => {
    current = (current + 1) % thoughts.length;
    updateSlide();
    resetTimer();
  });

  // 提交
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = input.value.trim();
    if (!content) return;

    submitBtn.disabled = true;
    submitBtn.textContent = '保存中...';

    try {
      await GitHubStore.saveThought(content);
      input.value = '';
      thoughts = await GitHubStore.loadThoughts();
      current = 0;
      render();
      startTimer();
    } catch (err) {
      alert('保存失败：' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '保存';
    }
  });

  // 初始化
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