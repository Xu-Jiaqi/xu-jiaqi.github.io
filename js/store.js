// GitHub Gist 持久化存储（只读）
// 读取：公开 Gist，无需 Token（任何人都能读）
// 缓存：sessionStorage，5分钟有效

const GIST_ID = 'c54f62bb3a10ff3d8dc8689d06b4ff20';
const CACHE_KEY = 'gist_cache_v2';
const CACHE_TTL = 5 * 60 * 1000;

function getCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data; // { thoughts, works, timestamp }
  } catch {
    return null;
  }
}

function setCache(partial) {
  try {
    const existing = getCache() || {};
    const merged = { ...existing, ...partial, timestamp: Date.now() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: merged }));
  } catch {}
}

async function fetchPublicGist() {
  const response = await fetch(`https://api.github.com/gists/${GIST_ID}`);
  if (!response.ok) throw new Error('获取数据失败');
  return response.json();
}

// ========== Thoughts ==========

async function loadThoughts() {
  const cached = getCache();
  if (cached && cached.thoughts) return cached.thoughts;

  const gist = await fetchPublicGist();
  const file = gist.files['thoughts.json'];
  const thoughts = file ? JSON.parse(file.content).thoughts || [] : [];

  setCache({ thoughts });
  return thoughts;
}

// ========== Works ==========

async function loadWorks() {
  const cached = getCache();
  if (cached && cached.works) return cached.works;

  const gist = await fetchPublicGist();
  const file = gist.files['works.json'];
  const works = file ? JSON.parse(file.content).works || [] : [];

  setCache({ works });
  return works;
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
  loadThoughts,
  loadWorks,
  preload
};