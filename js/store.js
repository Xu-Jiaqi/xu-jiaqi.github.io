// GitHub Gist persistent store (read-only)
// 读取：优先使用本地 /data/* 静态文件（如果存在），否则回退到公开 Gist
// 缓存：sessionStorage，TTL 5 分钟

const GIST_ID = 'c54f62bb3a10ff3d8dc8689d06b4ff20';
const CACHE_KEY = 'gist_cache_v2';
const CACHE_TTL = 5 * 60 * 1000;

function getCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // 兼容两种存储格式：{ data: {...} } 或 直接 data
    const data = parsed && parsed.data ? parsed.data : parsed;
    const timestamp = data && data.timestamp ? data.timestamp : 0;
    if (!timestamp || (Date.now() - timestamp) > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data; // { thoughts, works, timestamp }
  } catch (e) {
    return null;
  }
}

function setCache(partial) {
  try {
    let existingWrapped = {};
    try {
      existingWrapped = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}');
    } catch (e) {}
    const existing = existingWrapped && existingWrapped.data ? existingWrapped.data : (existingWrapped || {});
    const merged = Object.assign({}, existing, partial, { timestamp: Date.now() });
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: merged }));
  } catch (e) {}
}

async function fetchLocalData(path) {
  try {
    const resp = await fetch(path, { cache: 'no-cache' });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    return null;
  }
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

  // 尝试本地静态文件
  const local = await fetchLocalData('/data/thoughts.json');
  if (local && local.thoughts) {
    setCache({ thoughts: local.thoughts });
    return local.thoughts;
  }

  // 回退到 Gist
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

  const local = await fetchLocalData('/data/works.json');
  if (local && local.works) {
    setCache({ works: local.works });
    return local.works;
  }

  const gist = await fetchPublicGist();
  const file = gist.files['works.json'];
  const works = file ? JSON.parse(file.content).works || [] : [];

  setCache({ works });
  return works;
}

// 预加载（首页调用，提前拉取数据）
async function preload() {
  try {
    let cache = null;

    const localThoughts = await fetchLocalData('/data/thoughts.json');
    const localWorks = await fetchLocalData('/data/works.json');

    if (localThoughts || localWorks) {
      cache = {
        thoughts: localThoughts ? localThoughts.thoughts || [] : [],
        works: localWorks ? localWorks.works || [] : [],
        timestamp: Date.now()
      };
    } else {
      const gist = await fetchPublicGist();
      const thoughtsFile = gist.files['thoughts.json'];
      const worksFile = gist.files['works.json'];
      cache = {
        thoughts: thoughtsFile ? JSON.parse(thoughtsFile.content).thoughts || [] : [],
        works: worksFile ? JSON.parse(worksFile.content).works || [] : [],
        timestamp: Date.now()
      };
    }

    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: cache }));
  } catch (e) {}
}

window.GitHubStore = {
  loadThoughts,
  loadWorks,
  preload
};
