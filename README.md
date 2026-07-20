# 💎 GitHub 每日宝藏

每天自动搜集 GitHub 热门项目和「质量高但还没火」的宝藏项目，生成中文榜单网页。选稿优先可直接使用的应用、客户端、自托管服务和开发者工具，过滤编译器、内核、底层引擎与基础算法库等项目。

- **💎 每日宝藏**：从 Hacker News 热议、应用向搜索、黑马涨星检测三个渠道捞候选，由 AI（DeepSeek）按应用价值、新颖性和实用性精选 Top 10，每条带一句中文推荐理由。
- **🔥 今日热榜**：GitHub Trending 当日榜单。
- **✨ 新晋高星**：最近 7 天创建且 star 数高的新项目。

全部项目带 AI 生成的中文简介和主题分类（AI / 游戏 / 开发工具 / 前端 / 资料教程 / 其他），历史数据按日期存档可回看。

由 GitHub Actions 每天北京时间 8:30 自动更新，GitHub Pages 托管，无服务器、零维护。

## 上线步骤（只需做一次）

1. **建仓库并推送**：在 GitHub 新建仓库 `github-daily`，把本目录推上去：

   ```powershell
   git remote add origin https://github.com/<你的用户名>/github-daily.git
   git push -u origin master
   ```

2. **配置 DeepSeek key**（可选但推荐）：仓库页 → Settings → Secrets and variables → Actions → New repository secret，名称填 `DEEPSEEK_API_KEY`，值填你的 key。
   不配也能跑：宝藏按信号加权排序，简介显示英文原描述。

3. **开启 Pages**：仓库页 → Settings → Pages → Source 选 `Deploy from a branch`，分支选 `master`、目录选 `/ (root)`，保存。

4. **跑第一次数据**：仓库页 → Actions → 「每日采集」→ Run workflow。跑完后访问 `https://<你的用户名>.github.io/github-daily/`。

之后每天早上 8:30 自动更新，无需任何操作。

## 本地调试

```powershell
npm install
node scripts/fetch.mjs        # 抓 Trending + 新高星
node scripts/gems.mjs         # 宝藏候选池（HN 渠道国内网络不可达，会自动跳过，不影响其他渠道）
$env:DEEPSEEK_API_KEY='sk-...'; node scripts/summarize.mjs   # 不设 key 则走降级路径
npx http-server -p 8080       # 打开 http://localhost:8080 看页面
```

## 说明

- 黑马涨星检测依赖历史存档，上线积累几天数据后自动生效。
- 数据文件在 `data/{日期}.json`，`data/index.json` 是日期索引。
- 改采集策略看 `scripts/` 三个脚本顶部的常量；项目约定见 `CLAUDE.md`。
