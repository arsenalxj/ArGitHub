// 抓 GitHub Trending 榜单 + 近期新出的高星项目，写入 data/raw-{date}.json
import * as cheerio from 'cheerio';
import { todayStr, daysAgoStr, rawFile, writeJson, ghApi } from './lib.mjs';

const TRENDING_LIMIT = 25;
const NEW_REPO_LIMIT = 15;

function parseStarNum(text) {
  return parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
}

/** 抓 github.com/trending 页面并解析（无官方 API） */
async function fetchTrending() {
  const res = await fetch('https://github.com/trending', {
    headers: { 'user-agent': 'github-daily-bot' },
  });
  if (!res.ok) throw new Error(`trending 页面 -> ${res.status}`);
  const $ = cheerio.load(await res.text());
  const list = [];
  $('article.Box-row').each((_, el) => {
    const $el = $(el);
    const repo = $el.find('h2 a').attr('href')?.replace(/^\//, '').trim();
    if (!repo) return;
    list.push({
      repo,
      url: `https://github.com/${repo}`,
      description: $el.find('p').text().trim(),
      language: $el.find('[itemprop="programmingLanguage"]').text().trim() || '',
      stars: parseStarNum($el.find(`a[href="/${repo}/stargazers"]`).first().text()),
      starsToday: parseStarNum($el.find('span.d-inline-block.float-sm-right').text()),
    });
  });
  if (list.length === 0) throw new Error('trending 页面解析结果为空，页面结构可能已变化');
  return list.slice(0, TRENDING_LIMIT);
}

/** Search API 查最近 7 天创建且 star 数高的新项目 */
async function fetchNewRepos() {
  const q = encodeURIComponent(`created:>=${daysAgoStr(7)} stars:>100`);
  const data = await ghApi(`/search/repositories?q=${q}&sort=stars&order=desc&per_page=30`);
  return (data.items || []).map((it) => ({
    repo: it.full_name,
    url: it.html_url,
    description: it.description || '',
    language: it.language || '',
    stars: it.stargazers_count,
    createdAt: it.created_at,
  }));
}

async function main() {
  const date = todayStr();
  let trending = [];
  let newRepos = [];

  try {
    trending = await fetchTrending();
    console.log(`Trending：${trending.length} 条`);
  } catch (e) {
    console.error('Trending 抓取失败：', e.message);
  }

  try {
    newRepos = await fetchNewRepos();
    const trendingSet = new Set(trending.map((r) => r.repo));
    newRepos = newRepos.filter((r) => !trendingSet.has(r.repo)).slice(0, NEW_REPO_LIMIT);
    console.log(`新高星项目：${newRepos.length} 条`);
  } catch (e) {
    console.error('新高星项目抓取失败：', e.message);
  }

  if (trending.length === 0 && newRepos.length === 0) {
    console.error('两个来源全部失败，退出');
    process.exit(1);
  }

  writeJson(rawFile(date), { date, trending, newRepos, gemCandidates: [] });
  console.log(`已写入 ${rawFile(date)}`);
}

main();
