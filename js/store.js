// GitHub Gist 持久化存储（使用 Token 避免频率限制）

const GIST_ID = 'c54f62bb3a10ff3d8dc8689d06b4ff20';
const TOKEN_KEY = 'gh_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// 统一的 API 请求（读取和写入都使用 Token）
async function ghFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };

  // GET 不需要 Content-Type
  if (options.method === 'GET' || !options.method) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(err.message || '请求失败');
  }

  return response.json();
}

// 获取 Gist
async function getGist() {
  return ghFetch(`/gists/${GIST_ID}`);
}

// 更新 Gist
async function updateGist(files) {
  return ghFetch(`/gists/${GIST_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({ files })
  });
}

// 检查 Token 是否有效
async function checkToken() {
  const token = getToken();
  if (!token) return false;
  try {
    await ghFetch(`/gists/${GIST_ID}`);
    return true;
  } catch {
    return false;
  }
}

// ========== Thoughts ==========

async function loadThoughts() {
  const gist = await getGist();
  const file = gist.files['thoughts.json'];
  if (!file) return [];
  return JSON.parse(file.content).thoughts || [];
}

async function saveThought(content) {
  const thoughts = await loadThoughts();
  thoughts.unshift({
    id: Date.now(),
    content,
    time: new Date().toISOString()
  });
  await updateGist({
    'thoughts.json': { content: JSON.stringify({ thoughts }, null, 2) }
  });
  return thoughts[0];
}

// ========== Works ==========

async function loadWorks() {
  const gist = await getGist();
  const file = gist.files['works.json'];
  if (!file) return [];
  return JSON.parse(file.content).works || [];
}

async function saveWork(title, content) {
  const works = await loadWorks();
  works.unshift({
    id: Date.now(),
    title,
    content,
    time: new Date().toISOString()
  });
  await updateGist({
    'works.json': { content: JSON.stringify({ works }, null, 2) }
  });
  return works[0];
}

// 导出
window.GitHubStore = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t) => localStorage.setItem(TOKEN_KEY, t),
  checkToken,
  loadThoughts,
  saveThought,
  loadWorks,
  saveWork
};