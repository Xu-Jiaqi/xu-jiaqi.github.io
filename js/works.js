// 作品集 - Works Page

const STORAGE_KEY = 'blog_works';

// Load works from localStorage
function loadWorks() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

// Save works to localStorage
function saveWorks(works) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(works));
}

// Format date
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Render works list
function renderWorks() {
  const container = document.getElementById('works');
  const works = loadWorks();

  if (works.length === 0) {
    container.innerHTML = '<div class="empty-state">还没有作品，发布你的第一篇长文吧</div>';
    return;
  }

  // Sort by time, newest first
  works.sort((a, b) => b.time - a.time);

  container.innerHTML = works.map(work => `
    <div class="work-item">
      <h3 class="work-title">${escapeHtml(work.title)}</h3>
      <div class="work-meta">${formatDate(work.time)}</div>
      <div class="work-content">${escapeHtml(work.content)}</div>
    </div>
  `).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle form submit
document.getElementById('work-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const titleInput = document.getElementById('work-title');
  const contentInput = document.getElementById('work-content');
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!title || !content) return;

  const works = loadWorks();
  works.push({
    title,
    content,
    time: Date.now()
  });

  saveWorks(works);
  titleInput.value = '';
  contentInput.value = '';
  renderWorks();
});

// Initial render
renderWorks();