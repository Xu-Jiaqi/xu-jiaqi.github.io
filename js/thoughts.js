// 日有所思 - 自动切换卡片轮播

let thoughtsData = [];
let currentIndex = 0;
let autoPlayInterval = null;

// 检查 GitHub 配置
async function checkGitHubConfig() {
  const token = localStorage.getItem('gh_token');
  if (!token) {
    showSetupPrompt();
    return false;
  }
  const valid = await GitHubStore.checkToken();
  if (!valid) {
    showSetupPrompt();
    return false;
  }
  return true;
}

function showSetupPrompt() {
  const container = document.getElementById('carousel');
  container.innerHTML = `
    <div class="carousel-card">
      <div class="setup-prompt">
        <h3>需要配置 GitHub Token</h3>
        <p>请输入你的 GitHub Personal Access Token 来启用持久化存储</p>
        <form id="token-form">
          <input type="password" id="token-input" placeholder="ghp_xxx" style="width: 100%;" />
          <button type="submit" style="margin-top: 1rem;">确认</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('token-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('token-input').value.trim();
    if (token) {
      localStorage.setItem('gh_token', token);
      const valid = await GitHubStore.checkToken();
      if (valid) {
        location.reload();
      } else {
        alert('Token 无效，请检查后重试');
      }
    }
  });
}

// 格式化日期
function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 转义 HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 渲染轮播卡片
function renderCarousel() {
  const carousel = document.getElementById('carousel');
  const dotsContainer = document.getElementById('carousel-dots');

  if (!thoughtsData || thoughtsData.length === 0) {
    carousel.innerHTML = `
      <div class="carousel-card">
        <div class="empty-state">还没有记录，记录你的第一个想法吧</div>
      </div>
    `;
    dotsContainer.innerHTML = '';
    return;
  }

  // Render cards
  carousel.innerHTML = thoughtsData.map((thought, i) => `
    <div class="carousel-card">
      <div class="thought-time">${formatDate(thought.time)}</div>
      <div class="thought-content">${escapeHtml(thought.content)}</div>
    </div>
  `).join('');

  // Render dots
  dotsContainer.innerHTML = thoughtsData.map((_, i) => `
    <div class="carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>
  `).join('');

  // Add dot click handlers
  dotsContainer.querySelectorAll('.carousel-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      goToSlide(parseInt(dot.dataset.index));
    });
  });

  updateCarousel();
}

// 更新轮播位置
function updateCarousel() {
  const carousel = document.getElementById('carousel');
  const dots = document.querySelectorAll('.carousel-dot');

  carousel.style.transform = `translateX(-${currentIndex * 100}%)`;

  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === currentIndex);
  });
}

// 切换到指定卡片
function goToSlide(index) {
  currentIndex = index;
  updateCarousel();
  resetAutoPlay();
}

// 自动播放
function startAutoPlay() {
  if (thoughtsData.length <= 1) return;
  autoPlayInterval = setInterval(() => {
    currentIndex = (currentIndex + 1) % thoughtsData.length;
    updateCarousel();
  }, 5000); // 每5秒切换
}

function resetAutoPlay() {
  if (autoPlayInterval) {
    clearInterval(autoPlayInterval);
  }
  startAutoPlay();
}

// 手动切换
document.getElementById('prev-btn').addEventListener('click', () => {
  currentIndex = (currentIndex - 1 + thoughtsData.length) % thoughtsData.length;
  updateCarousel();
  resetAutoPlay();
});

document.getElementById('next-btn').addEventListener('click', () => {
  currentIndex = (currentIndex + 1) % thoughtsData.length;
  updateCarousel();
  resetAutoPlay();
});

// 表单提交
document.getElementById('thought-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('thought-input');
  const content = input.value.trim();

  if (!content) return;

  try {
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = '保存中...';

    await GitHubStore.saveThought(content);
    input.value = '';

    thoughtsData = await GitHubStore.loadThoughts();
    currentIndex = 0;
    renderCarousel();
    startAutoPlay();
  } catch (err) {
    alert('保存失败: ' + err.message);
  } finally {
    const btn = e.target.querySelector('button');
    btn.disabled = false;
    btn.textContent = '保存';
  }
});

// 初始化
(async () => {
  const configured = await checkGitHubConfig();
  if (configured) {
    try {
      thoughtsData = await GitHubStore.loadThoughts();
      renderCarousel();
      startAutoPlay();
    } catch (err) {
      const carousel = document.getElementById('carousel');
      carousel.innerHTML = `
        <div class="carousel-card">
          <div class="empty-state">加载失败: ${err.message}</div>
        </div>
      `;
    }
  }
})();