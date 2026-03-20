// GitHub Gist 持久化存储
// 读取：公开 Gist，无需 Token（任何人都能读）
// 写入：需要 Token

const GIST_ID = 'c54f62bb3a10ff3d8dc8689d06b4ff20';
const TOKEN_KEY = 'gh_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// 公开读取 Gist（任何人无需认证）
async function fetchPublicGist() {
  const response = await fetch(`https://api.github.com/gists/${GIST_ID}`);
  if (!response.ok) throw new Error('获取数据失败');
  return response.json();
}

// 写入 Gist（需要 Token）
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
  const gist = await fetchPublicGist();
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
  await patchGist({
    'thoughts.json': { content: JSON.stringify({ thoughts }, null, 2) }
  });
  return thoughts[0];
}

// ========== Works ==========

async function loadWorks() {
  const gist = await fetchPublicGist();
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
  await patchGist({
    'works.json': { content: JSON.stringify({ works }, null, 2) }
  });
  return works[0];
}

window.GitHubStore = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t) => localStorage.setItem(TOKEN_KEY, t),
  checkToken: async () => !!getToken(),
  loadThoughts,
  saveThought,
  loadWorks,
  saveWork
};