// 三个采集脚本共用的小工具：日期、文件读写、GitHub API 请求
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, 'data');

/** 今天日期 YYYY-MM-DD（UTC，与 Actions 运行时区一致） */
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** N 天前日期 YYYY-MM-DD */
export function daysAgoStr(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export function rawFile(date) {
  return path.join(DATA_DIR, `raw-${date}.json`);
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

/** 调 GitHub REST API，自动带 token（有则提限额），失败抛错由调用方容错 */
export async function ghApi(pathname) {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'github-daily-bot',
  };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com${pathname}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${pathname} -> ${res.status}`);
  return res.json();
}
