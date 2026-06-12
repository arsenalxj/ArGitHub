// DeepSeek 加工：① 从候选池评选每日宝藏 Top 10（带推荐理由）② 全量生成中文简介 + 主题分类
// 没有 DEEPSEEK_API_KEY 或调用失败时走降级路径，保证每日数据照常生成
import path from 'node:path';
import { todayStr, rawFile, readJson, writeJson, DATA_DIR } from './lib.mjs';

export const CATEGORIES = ['AI', '游戏', '开发工具', '前端', '资料教程', '其他'];
const GEM_TOP_N = 10;
const API_KEY = process.env.DEEPSEEK_API_KEY || '';

/** 调 DeepSeek（OpenAI 兼容接口），要求返回 JSON */
async function deepseek(systemPrompt, userPrompt) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 1.0,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek API -> ${res.status} ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

function repoBrief(it) {
  return {
    repo: it.repo,
    description: (it.description || '').slice(0, 200),
    language: it.language || '',
    stars: it.stars,
    ...(it.signal ? { signal: it.signal } : {}),
  };
}

/** 宝藏评选：AI 按新颖性/实用性/有趣程度精选 Top 10 并给推荐理由 */
async function pickGems(candidates) {
  const result = await deepseek(
    `你是 GitHub 宝藏项目猎人，目标是从候选中挑出"质量高但还没火"的有意思项目。综合新颖性、实用性、有趣程度评判，警惕纯营销项目和 awesome 列表类。返回 JSON：{"picks":[{"repo":"owner/name","reasonZh":"一句话推荐理由，口语化、突出最大亮点，不超过 40 字"}]}，精选不超过 ${GEM_TOP_N} 个，按推荐度排序。`,
    JSON.stringify(candidates.map(repoBrief)),
  );
  const byRepo = new Map(candidates.map((c) => [c.repo, c]));
  const gems = [];
  for (const p of result.picks || []) {
    const c = byRepo.get(p.repo);
    if (c) gems.push({ ...c, reasonZh: p.reasonZh || '' });
  }
  if (gems.length === 0) throw new Error('AI 返回的精选结果为空');
  return gems.slice(0, GEM_TOP_N);
}

/** 降级评选：HN 分数 + 周涨幅加权排序 */
function pickGemsFallback(candidates) {
  const score = (c) => (c.hnScore || 0) + (c.growth || 0) * 300 + (c.stars || 0) / 100;
  return [...candidates]
    .sort((a, b) => score(b) - score(a))
    .slice(0, GEM_TOP_N)
    .map((c) => ({ ...c, reasonZh: '' }));
}

/** 批量生成中文简介 + 分类 */
async function summarizeAll(items) {
  const result = await deepseek(
    `给 GitHub 项目写一句话中文简介（不超过 50 字，说清它是干什么的、对谁有用），并从固定分类中选一个：${CATEGORIES.join(' / ')}。返回 JSON：{"items":[{"repo":"owner/name","summaryZh":"...","category":"..."}]}，必须覆盖输入的每一个项目。`,
    JSON.stringify(items.map(repoBrief)),
  );
  const map = new Map();
  for (const it of result.items || []) {
    map.set(it.repo, {
      summaryZh: it.summaryZh || '',
      category: CATEGORIES.includes(it.category) ? it.category : '其他',
    });
  }
  return map;
}

function applySummaries(list, map) {
  for (const it of list) {
    const s = map.get(it.repo);
    it.summaryZh = s?.summaryZh || '';
    it.category = s?.category || '其他';
  }
}

/** 整理输出字段，去掉中间数据 */
function clean(it) {
  const { repo, url, description, language, stars, summaryZh, category } = it;
  const out = { repo, url, description, language, stars, summaryZh, category };
  if (it.starsToday != null) out.starsToday = it.starsToday;
  if (it.createdAt) out.createdAt = it.createdAt;
  if (it.source) out.source = it.source;
  if (it.signal) out.signal = it.signal;
  if (it.reasonZh != null) out.reasonZh = it.reasonZh;
  return out;
}

async function main() {
  const date = todayStr();
  const raw = readJson(rawFile(date));
  if (!raw) {
    console.error(`未找到 ${rawFile(date)}，请先运行 fetch.mjs 和 gems.mjs`);
    process.exit(1);
  }

  // 1. 宝藏评选
  let gems = [];
  const candidates = raw.gemCandidates || [];
  if (candidates.length > 0) {
    if (API_KEY) {
      try {
        gems = await pickGems(candidates);
        console.log(`AI 精选宝藏：${gems.length} 条`);
      } catch (e) {
        console.error('AI 评选失败，走降级排序：', e.message);
        gems = pickGemsFallback(candidates);
      }
    } else {
      console.log('未配置 DEEPSEEK_API_KEY，宝藏走降级排序');
      gems = pickGemsFallback(candidates);
    }
  }

  // 2. 批量中文简介 + 分类
  const all = [...raw.trending, ...raw.newRepos, ...gems];
  let summaryMap = new Map();
  if (API_KEY && all.length > 0) {
    try {
      summaryMap = await summarizeAll(all);
      console.log(`AI 简介：${summaryMap.size}/${all.length} 条`);
    } catch (e) {
      console.error('AI 简介失败，留空降级：', e.message);
    }
  }
  applySummaries(raw.trending, summaryMap);
  applySummaries(raw.newRepos, summaryMap);
  applySummaries(gems, summaryMap);

  // 3. 写当日数据 + 更新日期索引
  writeJson(path.join(DATA_DIR, `${date}.json`), {
    date,
    trending: raw.trending.map(clean),
    newRepos: raw.newRepos.map(clean),
    gems: gems.map(clean),
  });
  const indexFile = path.join(DATA_DIR, 'index.json');
  const dates = readJson(indexFile, []) || [];
  if (!dates.includes(date)) dates.unshift(date);
  writeJson(indexFile, dates.sort().reverse());
  console.log(`已写入 data/${date}.json，索引共 ${dates.length} 天`);
}

main();
