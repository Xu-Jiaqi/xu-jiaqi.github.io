// GitHub Gist 持久化存储

const GIST_ID_KEY = 'blog_gist_id';
const TOKEN_KEY = 'gh_token';
const OWNER = 'Xu-Jiaqi';

// 获取 token
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// 异步请求封装
async function ghRequest(method, url, body = null) {
  const token = getToken();
  if (!token) throw new Error('未设置 GitHub Token');

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(err.message || '请求失败');
  }

  return response.json();
}

// 创建 Gist
async function createGist() {
  const gist = await ghRequest('POST', 'https://api.github.com/gists', {
    description: 'Xu-Jiaqi Blog Data',
    public: false,
    files: {
      'thoughts.json': { content: JSON.stringify({ thoughts: [] }, null, 2) },
      'works.json': { content: JSON.stringify({ works: [] }, null, 2) }
    }
  });
  localStorage.setItem(GIST_ID_KEY, gist.id);
  return gist;
}

// 获取 Gist
async function getGist() {
  let gistId = localStorage.getItem(GIST_ID_KEY);
  if (!gistId) {
    const gist = await createGist();
    return gist;
  }
  try {
    return await ghRequest('GET', `https://api.github.com/gists/${gistId}`);
  } catch (e) {
    // Gist 不存在或无权访问，创建新的
    localStorage.removeItem(GIST_ID_KEY);
    return createGist();
  }
}

// 更新 Gist
async function updateGist(files) {
  const gistId = localStorage.getItem(GIST_ID_KEY);
  if (!gistId) throw new Error('Gist 未初始化');

  return ghRequest('PATCH', `https://api.github.com/gists/${gistId}`, { files });
}

// 检查 token 是否有效
async function checkToken() {
  try {
    await ghRequest('GET', `https://api.github.com/repos/${OWNER}`);
    return true;
  } catch (e) {
    return false;
  }
}

// ========== Thoughts (日有所思) ==========

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

// ========== Works (作品集) ==========

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

// 导出给外部用
window.GitHubStore = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t) => localStorage.setItem(TOKEN_KEY, t),
  checkToken,
  loadThoughts,
  saveThought,
  loadWorks,
  saveWork
};