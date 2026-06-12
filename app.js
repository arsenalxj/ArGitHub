// 渲染逻辑：读 data/index.json 拿日期列表，按选中日期加载 data/{date}.json 渲染三个 Tab
const CATEGORIES = ['全部', 'AI', '游戏', '开发工具', '前端', '资料教程', '其他'];
const SOURCE_LABEL = { hn: 'HN 热议', search: '小而美', 'dark-horse': '黑马涨星' };
// GitHub 语言色（常见的几种，缺省灰色）
const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Go: '#00ADD8',
  Rust: '#dea584', Java: '#b07219', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600',
  Swift: '#F05138', Kotlin: '#A97BFF', Ruby: '#701516', PHP: '#4F5D95', Shell: '#89e051',
  HTML: '#e34c26', CSS: '#563d7c', Vue: '#41b883', Dart: '#00B4AB', Zig: '#ec915c', Lua: '#000080',
};

const state = { date: '', tab: 'gems', category: '全部', data: null };

const $ = (sel) => document.querySelector(sel);

async function loadJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function fmtStars(n) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n ?? 0);
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s || '';
  return div.innerHTML;
}

function card(it, tab) {
  const lang = it.language
    ? `<span class="meta-item"><i class="dot" style="background:${LANG_COLORS[it.language] || '#8b949e'}"></i>${esc(it.language)}</span>`
    : '';
  const badges = [];
  if (tab === 'trending' && it.starsToday) badges.push(`<span class="badge hot">今日 +${it.starsToday} ★</span>`);
  if (tab === 'newRepos' && it.createdAt) badges.push(`<span class="badge new">${it.createdAt.slice(0, 10)} 创建</span>`);
  if (tab === 'gems' && it.source) badges.push(`<span class="badge gem">${SOURCE_LABEL[it.source] || it.source}${it.signal ? ' · ' + esc(it.signal) : ''}</span>`);

  const summary = it.summaryZh || it.description || '（暂无描述）';
  const reason = tab === 'gems' && it.reasonZh ? `<p class="reason">💡 ${esc(it.reasonZh)}</p>` : '';

  return `<article class="card">
    <div class="card-head">
      <a class="repo" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.repo)}</a>
      <span class="category-tag">${esc(it.category || '其他')}</span>
    </div>
    ${reason}
    <p class="summary">${esc(summary)}</p>
    <div class="meta">
      ${lang}
      <span class="meta-item">★ ${fmtStars(it.stars)}</span>
      ${badges.join('')}
    </div>
  </article>`;
}

function render() {
  const listEl = $('#list');
  if (!state.data) {
    listEl.innerHTML = '<p class="empty">加载中…</p>';
    return;
  }
  let items = state.data[state.tab] || [];
  if (state.category !== '全部') items = items.filter((it) => (it.category || '其他') === state.category);
  listEl.innerHTML = items.length
    ? items.map((it) => card(it, state.tab)).join('')
    : '<p class="empty">这一天该分类下没有项目，换个分类或日期看看</p>';
}

async function loadDate(date) {
  state.date = date;
  state.data = null;
  render();
  try {
    state.data = await loadJson(`data/${date}.json`);
  } catch {
    $('#list').innerHTML = '<p class="empty">这一天的数据加载失败</p>';
    return;
  }
  render();
}

function initChips() {
  const chipsEl = $('#category-chips');
  chipsEl.innerHTML = CATEGORIES.map(
    (c) => `<button class="chip${c === state.category ? ' active' : ''}" data-cat="${c}">${c}</button>`,
  ).join('');
  chipsEl.addEventListener('click', (e) => {
    const cat = e.target.dataset?.cat;
    if (!cat) return;
    state.category = cat;
    chipsEl.querySelectorAll('.chip').forEach((el) => el.classList.toggle('active', el.dataset.cat === cat));
    render();
  });
}

function initTabs() {
  $('#tabs').addEventListener('click', (e) => {
    const tab = e.target.dataset?.tab;
    if (!tab) return;
    state.tab = tab;
    document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el.dataset.tab === tab));
    render();
  });
}

async function init() {
  initChips();
  initTabs();
  let dates = [];
  try {
    dates = await loadJson('data/index.json');
  } catch {
    $('#list').innerHTML = '<p class="empty">还没有任何数据，等定时任务跑完第一轮吧</p>';
    return;
  }
  const sel = $('#date-select');
  sel.innerHTML = dates.map((d) => `<option value="${d}">${d}</option>`).join('');
  sel.addEventListener('change', () => loadDate(sel.value));
  if (dates.length > 0) loadDate(dates[0]);
}

init();
