// 日有所思 - Thoughts Page

const STORAGE_KEY = 'blog_thoughts';

// Load thoughts from localStorage
function loadThoughts() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

// Save thoughts to localStorage
function saveThoughts(thoughts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(thoughts));
}

// Format date
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Render thoughts list
function renderThoughts() {
  const container = document.getElementById('thoughts');
  const thoughts = loadThoughts();

  if (thoughts.length === 0) {
    container.innerHTML = '<div class="empty-state">还没有记录，记录你的第一个想法吧</div>';
    return;
  }

  // Sort by time, newest first
  thoughts.sort((a, b) => b.time - a.time);

  container.innerHTML = thoughts.map(thought => `
    <div class="thought-item">
      <div class="thought-time">${formatDate(thought.time)}</div>
      <div class="thought-content">${escapeHtml(thought.content)}</div>
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
document.getElementById('thought-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('thought-input');
  const content = input.value.trim();

  if (!content) return;

  const thoughts = loadThoughts();
  thoughts.push({
    content,
    time: Date.now()
  });

  saveThoughts(thoughts);
  input.value = '';
  renderThoughts();
});

// Initial render
renderThoughts();