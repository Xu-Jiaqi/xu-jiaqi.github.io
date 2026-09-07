// Local static JSON store with sessionStorage cache.
// data/*.json is generated from _thoughts/_works by scripts/site.py.

const CACHE_KEY = 'site_data_v1';
const CACHE_TTL = 5 * 60 * 1000;

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed.timestamp || Date.now() - parsed.timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return {};
    }
    return parsed;
  } catch (_) {
    return {};
  }
}

function writeCache(partial) {
  try {
    const current = readCache();
    const next = Object.assign({}, current, partial, { timestamp: Date.now() });
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch (_) {}
}

async function loadDataset(name) {
  const cached = readCache();
  if (Array.isArray(cached[name])) return cached[name];

  const response = await fetch(`data/${name}.json`, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Failed to load data/${name}.json (${response.status})`);
  }

  const payload = await response.json();
  const items = payload[name];
  if (!Array.isArray(items)) {
    throw new Error(`Invalid data/${name}.json format`);
  }

  writeCache({ [name]: items });
  return items;
}

async function preload() {
  await Promise.allSettled([loadDataset('thoughts'), loadDataset('works')]);
}

window.SiteStore = {
  loadThoughts: () => loadDataset('thoughts'),
  loadWorks: () => loadDataset('works'),
  preload
};
