// GitHub Gist 持久化存储
// 读取：公开 Gist，无需 Token（任何人都能读）
// 写入：需要 Token
// 缓存：sessionStorage 避免重复请求

const GIST_ID = 'c54f62bb3a10ff3d8dc8689d06b4ff20';
const TOKEN_KEY = 'gh_token';
const CACHE_KEY = 'gist_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// 获取缓存
function getCache() {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// 设置缓存
function setCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch {}
}

// 公开读取 Gist
async function fetchPublicGist() {
  const response = await fetch(`https://api.github.com/gists/${GIST_ID}`);
  if (!response.ok) throw new Error('获取数据失败');
  return response.json();
}

// 写入 Gist
async function patchGist(files) {
  const token = getToken();
  if (!token) throw new Error('需要 GitHub Token 才能保存');

  const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ files })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(err.message || '保存失败');
  }
  return response.json();
}

// ========== Thoughts ==========

async function loadThoughts() {
  const cached = getCache();
  if (cached && cached.thoughts) return cached.thoughts;

  const gist = await fetchPublicGist();
  const file = gist.files['thoughts.json'];
  const thoughts = file ? JSON.parse(file.content).thoughts || [] : [];

  const cache = getCache() || {};
  cache.thoughts = thoughts;
  setCache(cache);

  return thoughts;
}

async function saveThought(content) {
  const thoughts = await loadThoughts();
  thoughts.unshift({
    id: Date.now(),
    content,
    time: new Date().toISOString()
  });
  await patchGist({
    'thoughts.json': { content: JSON.stringify({ thoughts }, null, 2) }
  });

  const cache = getCache() || {};
  cache.thoughts = thoughts;
  setCache(cache);

  return thoughts[0];
}

// ========== Works ==========

async function loadWorks() {
  const cached = getCache();
  if (cached && cached.works) return cached.works;

  const gist = await fetchPublicGist();
  const file = gist.files['works.json'];
  const works = file ? JSON.parse(file.content).works || [] : [];

  const cache = getCache() || {};
  cache.works = works;
  setCache(cache);

  return works;
}

async function saveWork(title, content) {
  const works = await loadWorks();
  works.unshift({
    id: Date.now(),
    title,
    content,
    time: new Date().toISOString()
  });
  await patchGist({
    'works.json': { content: JSON.stringify({ works }, null, 2) }
  });

  const cache = getCache() || {};
  cache.works = works;
  setCache(cache);

  return works[0];
}

// 预加载（首页调用，提前拉取数据）
async function preload() {
  try {
    const gist = await fetchPublicGist();
    const thoughtsFile = gist.files['thoughts.json'];
    const worksFile = gist.files['works.json'];
    const cache = {
      thoughts: thoughtsFile ? JSON.parse(thoughtsFile.content).thoughts || [] : [],
      works: worksFile ? JSON.parse(worksFile.content).works || [] : [],
      timestamp: Date.now()
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: cache }));
  } catch {}
}

window.GitHubStore = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t) => localStorage.setItem(TOKEN_KEY, t),
  checkToken: async () => !!getToken(),
  loadThoughts,
  saveThought,
  loadWorks,
  saveWork,
  preload
};