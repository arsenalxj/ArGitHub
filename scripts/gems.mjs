// 宝藏候选池：HN 热议 / 小而美搜索 / 黑马涨星检测，三渠道合并去重后追加进 raw 文件
import path from 'node:path';
import { todayStr, daysAgoStr, rawFile, readJson, writeJson, ghApi, DATA_DIR } from './lib.mjs';
import { lowLevelReason } from './project-preference.mjs';

const HN_STORY_LIMIT = 200; // 扫描 HN 热帖条数
const HN_MIN_SCORE = 60; // HN 分数门槛
const SEARCH_TOPICS = ['self-hosted', 'desktop-app', 'productivity', 'automation', 'visualization', 'game', 'ai-agent', 'developer-tools', 'home-automation', 'note-taking'];
const DARK_HORSE_MAX_STARS = 5000; // 黑马：总 star 上限
const DARK_HORSE_MIN_GROWTH = 0.3; // 黑马：周涨幅下限 30%
const GEM_MAX_STARS = 10000; // 宝藏定位是"还没火"，超过此 star 数的不算宝藏
const CANDIDATE_LIMIT = 40;

/** 从 url 提取 owner/repo，非 GitHub 仓库链接返回 null */
function repoFromUrl(url) {
  const m = /^https?:\/\/github\.com\/([\w.-]+\/[\w.-]+?)(?:\/|#|\?|$)/.exec(url || '');
  if (!m) return null;
  const repo = m[1];
  // 排除 github.com/orgs、github.com/sponsors 等非仓库路径
  if (['orgs', 'sponsors', 'topics', 'collections', 'features', 'about', 'blog'].includes(repo.split('/')[0])) return null;
  return repo;
}

/** HN 渠道：热帖 + Show HN 里指向 GitHub 仓库的链接 */
async function fromHackerNews() {
  const hn = (p) => fetch(`https://hacker-news.firebaseio.com/v0/${p}.json`).then((r) => r.json());
  const ids = [...new Set([...(await hn('topstories')), ...(await hn('showstories'))])].slice(0, HN_STORY_LIMIT);

  const items = [];
  // 分批并发拉详情，避免一次性 200 个请求
  for (let i = 0; i < ids.length; i += 25) {
    const batch = await Promise.all(ids.slice(i, i + 25).map((id) => hn(`item/${id}`).catch(() => null)));
    items.push(...batch);
  }

  const result = [];
  for (const it of items) {
    if (!it || it.score < HN_MIN_SCORE) continue;
    const repo = repoFromUrl(it.url);
    if (!repo) continue;
    result.push({ repo, source: 'hn', hnScore: it.score, hnComments: it.descendants || 0 });
  }
  return result;
}

/** 小而美搜索：低调但活跃的项目，topic 按日期轮换；限近 18 个月创建，避免捞回常年霸榜的老项目 */
async function fromSearch() {
  const topic = SEARCH_TOPICS[new Date().getDate() % SEARCH_TOPICS.length];
  const q = encodeURIComponent(`stars:100..3000 created:>=${daysAgoStr(550)} pushed:>=${daysAgoStr(7)} fork:false archived:false topic:${topic}`);
  const data = await ghApi(`/search/repositories?q=${q}&sort=stars&order=desc&per_page=15`);
  console.log(`小而美搜索 topic=${topic}`);
  return (data.items || []).map((it) => ({
    repo: it.full_name,
    source: 'search',
    url: it.html_url,
    description: it.description || '',
    language: it.language || '',
    stars: it.stargazers_count,
    topic,
    topics: it.topics || [],
  }));
}

/** 黑马检测：对比最近 7 天存档，找涨星快但总量不高的项目 */
function fromDarkHorse(today) {
  const dates = (readJson(path.join(DATA_DIR, 'index.json'), []) || [])
    .filter((d) => d < today)
    .slice(0, 7);
  if (dates.length === 0) {
    console.log('黑马检测：暂无历史存档，跳过（数据积累几天后自动生效）');
    return [];
  }

  // 旧快照：每个 repo 取最早一次出现的 star 数
  const oldStars = new Map();
  for (const d of dates.reverse()) {
    const day = readJson(path.join(DATA_DIR, `${d}.json`));
    if (!day) continue;
    for (const it of [...(day.trending || []), ...(day.newRepos || []), ...(day.gems || [])]) {
      if (it.stars && !oldStars.has(it.repo)) oldStars.set(it.repo, it);
    }
  }

  // 旧档 star 已超上限的不可能成为黑马，先过滤掉，再限量避免 enrich 阶段 API 调用过多
  const result = [];
  for (const [repo, old] of oldStars) {
    if (old.stars >= DARK_HORSE_MAX_STARS) continue;
    // 黑马的"当前 star"在 enrich 阶段从 GitHub API 取最新值，这里先按旧档信号入围
    result.push({ repo, source: 'dark-horse', oldStars: old.stars });
  }
  return result.slice(0, 50);
}

/** 补全候选的仓库信息（star/描述/语言），顺带完成黑马涨幅过滤 */
async function enrich(candidates) {
  const out = [];
  for (const c of candidates) {
    let info = c;
    if (!c.stars || c.source === 'dark-horse') {
      try {
        const r = await ghApi(`/repos/${c.repo}`);
        info = {
          ...c,
          url: r.html_url,
          description: r.description || '',
          language: r.language || '',
          stars: r.stargazers_count,
          topics: r.topics || [],
        };
      } catch {
        continue; // 仓库被删/改名/限流，丢弃该候选
      }
    }
    if (c.source === 'dark-horse') {
      const growth = (info.stars - c.oldStars) / Math.max(c.oldStars, 1);
      if (info.stars > DARK_HORSE_MAX_STARS || growth < DARK_HORSE_MIN_GROWTH) continue;
      info.growth = growth;
      info.starsGained = info.stars - c.oldStars;
    }
    if (info.stars > GEM_MAX_STARS) continue; // 已经火了的不算宝藏
    if (lowLevelReason(info)) continue;
    out.push(info);
  }
  return out;
}

/** 生成给前端展示的信号文案 */
function signalText(c) {
  if (c.source === 'hn') return `HN ${c.hnScore} 分 · ${c.hnComments} 评论`;
  if (c.source === 'dark-horse') return `周涨星 +${c.starsGained}（+${Math.round(c.growth * 100)}%）`;
  return `小而美 · ${c.topic}`;
}

async function main() {
  const date = todayStr();
  const raw = readJson(rawFile(date));
  if (!raw) {
    console.error(`未找到 ${rawFile(date)}，请先运行 fetch.mjs`);
    process.exit(1);
  }

  let hn = [];
  let search = [];
  let darkHorse = [];
  try {
    hn = await fromHackerNews();
    console.log(`HN 渠道：${hn.length} 条`);
  } catch (e) {
    console.error('HN 渠道失败：', e.message);
  }
  try {
    search = await fromSearch();
    console.log(`小而美搜索：${search.length} 条`);
  } catch (e) {
    console.error('小而美搜索失败：', e.message);
  }
  try {
    darkHorse = fromDarkHorse(date);
    console.log(`黑马入围：${darkHorse.length} 条`);
  } catch (e) {
    console.error('黑马检测失败：', e.message);
  }

  // 合并去重：同 repo 优先保留信号更强的渠道（hn > dark-horse > search）
  const seen = new Set([...raw.trending, ...raw.newRepos].map((r) => r.repo));
  const merged = [];
  for (const c of [...hn, ...darkHorse, ...search]) {
    if (seen.has(c.repo)) continue;
    seen.add(c.repo);
    merged.push(c);
  }

  const enriched = await enrich(merged.slice(0, CANDIDATE_LIMIT * 2));
  raw.gemCandidates = enriched.slice(0, CANDIDATE_LIMIT).map((c) => ({ ...c, signal: signalText(c) }));
  writeJson(rawFile(date), raw);
  console.log(`宝藏候选池：${raw.gemCandidates.length} 条，已更新 ${rawFile(date)}`);
}

main();
