# AGENTS.md

GitHub 每日热门/宝藏项目网页。**纯静态站 + GitHub Actions 定时采集**，无服务器、无构建步骤。

## 架构

```
GitHub Actions 每天 UTC 0:30 触发：
  node scripts/fetch.mjs      # 抓 Trending + 新高星 → data/raw-{date}.json（中间产物，不提交）
  node scripts/gems.mjs       # 宝藏候选池（HN / 小而美搜索 / 黑马检测）→ 追加进 raw 文件
  node scripts/summarize.mjs  # DeepSeek 评选宝藏 Top 10 + 中文简介/分类 → data/{date}.json + index.json
  → commit data/ 推回仓库，GitHub Pages 托管根目录
前端 index.html + app.js + style.css，运行时 fetch data/*.json 渲染
```

## 约定

- **前端禁止引入框架/构建工具**，保持纯 HTML/JS/CSS，Pages 直接托管根目录。
- 数据文件命名：`data/{YYYY-MM-DD}.json`（每日数据，提交）、`data/index.json`（日期列表，倒序）、`data/raw-*.json`（中间产物，已 gitignore）。
- 主题分类固定枚举：`AI / 游戏 / 开发工具 / 前端 / 资料教程 / 其他`，前后端、prompt 三处必须一致（定义在 `scripts/summarize.mjs` 顶部 `CATEGORIES`）。
- 宝藏 `source` 枚举：`hn`（HN 热议）/ `search`（小而美搜索）/ `dark-horse`（黑马涨星）。
- 推荐策略以可直接安装、部署或使用的应用、客户端、自托管服务和开发者工具为主。编译器/语言运行时、内核/驱动/固件、数据库/存储引擎、基础算法/协议库，以及无完整产品形态的基础模型/训练推理设施，必须在无 AI 路径也过滤；一般框架、SDK 和研究类项目降权。
- DeepSeek 调用失败**必须降级而不是报错中断**：简介留空、宝藏按信号加权排序，保证每日数据照常生成。
- 环境变量：`GITHUB_TOKEN`（可选，提高 API 限额；Actions 内置）、`DEEPSEEK_API_KEY`（可选，无则走降级路径）。
- 唯一 npm 依赖 cheerio（解析 Trending 页面），不随意加依赖。
- commit message 用中文。

## 本地调试

```powershell
node scripts/fetch.mjs
node scripts/gems.mjs
$env:DEEPSEEK_API_KEY='sk-...'; node scripts/summarize.mjs
npx http-server -p 8080   # 打开 http://localhost:8080
```
