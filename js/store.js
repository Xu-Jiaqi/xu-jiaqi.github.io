// GitHub API 持久化存储

const GITHUB_API = 'https://api.github.com';
const OWNER = 'Xu-Jiaqi';
const REPO = 'xu-jiaqi.github.io';
const LABEL_THOUGHT = 'thought';
const LABEL_WORK = 'work';

// 获取 token（从 localStorage）
function getToken() {
  return localStorage.getItem('gh_token');
}

// 保存 token
function setToken(token) {
  localStorage.setItem('gh_token', token);
}

// 异步请求封装
async function ghRequest(method, path, body = null) {
  const token = getToken();
  if (!token) throw new Error('未设置 GitHub Token');

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${GITHUB_API}${path}`, options);
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || '请求失败');
  }

  return response.json();
}

// 获取所有 issues
async function getIssues(label) {
  const issues = await ghRequest('GET', `/repos/${OWNER}/${REPO}/issues?labels=${label}&sort=created&direction=desc&per_page=100`);
  // Filter out pull requests (they have pull_request key)
  return issues.filter(issue => !issue.pull_request);
}

// 创建 issue
async function createIssue(title, body, label) {
  return ghRequest('POST', `/repos/${OWNER}/${REPO}/issues`, {
    title,
    body,
    labels: [label]
  });
}

// 更新 issue
async function updateIssue(issueNumber, title, body) {
  return ghRequest('PATCH', `/repos/${OWNER}/${REPO}/issues/${issueNumber}`, {
    title,
    body
  });
}

// 删除 issue (关闭它)
async function deleteIssue(issueNumber) {
  return ghRequest('PATCH', `/repos/${OWNER}/${REPO}/issues/${issueNumber}`, {
    state: 'closed'
  });
}

// ========== Thoughts (日有所思) ==========

async function loadThoughts() {
  const issues = await getIssues(LABEL_THOUGHT);
  return issues.map(issue => ({
    id: issue.number,
    content: issue.body || '',
    time: new Date(issue.created_at).getTime()
  }));
}

async function saveThought(content) {
  const issue = await createIssue(
    `Thought ${Date.now()}`,
    content,
    LABEL_THOUGHT
  );
  return {
    id: issue.number,
    content: issue.body,
    time: new Date(issue.created_at).getTime()
  };
}

// ========== Works (作品集) ==========

async function loadWorks() {
  const issues = await getIssues(LABEL_WORK);
  return issues.map(issue => ({
    id: issue.number,
    title: issue.title,
    content: issue.body || '',
    time: new Date(issue.created_at).getTime()
  }));
}

async function saveWork(title, content) {
  const issue = await createIssue(title, content, LABEL_WORK);
  return {
    id: issue.number,
    title: issue.title,
    content: issue.body,
    time: new Date(issue.created_at).getTime()
  };
}

// 检查 token 是否有效
async function checkToken() {
  try {
    await ghRequest('GET', `/repos/${OWNER}/${REPO}`);
    return true;
  } catch (e) {
    return false;
  }
}

// 导出给外部用
window.GitHubStore = {
  getToken,
  setToken,
  checkToken,
  loadThoughts,
  saveThought,
  loadWorks,
  saveWork
};