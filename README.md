# 此刻 · Mobile H5 Prototype

焦虑模式完整流程原型。当前版本已经整理成可部署到 Vercel 的结构：静态页面由 Vercel 托管，AI 调用通过 `/api` 下的 Python Functions 代理，避免把火山方舟 API Key 暴露给前端。

## 本地预览

请使用 `server.py` 启动，本地服务内置静态文件服务和 AI 代理：

```bash
python server.py
```

浏览器访问：<http://localhost:8081>

本地 AI 功能需要在 `.env.local` 中配置：

```env
ARK_API_KEY=ark-你的Key
ARK_IMAGE_MODEL=doubao-seedream-4-5-251128
ARK_CHAT_ENDPOINT=ep-你的文本接入点
```

`.env.local` 不要提交到 Git。可以参考 `.env.example`。

## Vercel 部署

1. 把本项目提交到 GitHub。
2. 打开 <https://vercel.com/>，选择 `Import Git Repository`。
3. 选择这个仓库并部署。
4. 在 Vercel 项目设置的 Environment Variables 里添加：

```env
ARK_API_KEY=ark-你的Key
ARK_IMAGE_MODEL=doubao-seedream-4-5-251128
ARK_CHAT_ENDPOINT=ep-你的文本接入点
```

5. 重新部署 Production。
6. 用 Vercel 给出的 `https://xxx.vercel.app` 链接在手机上测试。

## 完整路径

打开先显示自然照片欢迎页，点击「进入此刻」后选择情绪。欢迎页采用用户提供的树与小屋照片，网页资源位于 `assets/welcome-meadow.webp`。

各情绪使用不同的柔和配色：焦虑为鼠尾草绿、难过为浅杏、生气为青绿、亢奋为雾蓝、委屈为柔粉、说不清为淡紫。配色是视觉舒适度设计，不宣称能够治疗或抑制情绪；除焦虑之外的模式仍处于准备中。

设计参考：[Jonauskaite & Mohr 的颜色与情绪系统综述](https://pmc.ncbi.nlm.nih.gov/articles/PMC12325498/)。综述区分了颜色与情绪的联想和颜色对实际情绪体验的影响，后者仍需更多研究。

本地界面验证：安装 Playwright 后运行 `node scripts/check-ui.cjs`，需可用的 Microsoft Edge；也可用环境变量 `PLAYWRIGHT_MODULE` 指向已有 Playwright 模块。截图保存到 `.local-qa/`，不上传到 GitHub。

首页 → 我很焦虑 → 接住用户 → 身体状态 → 安抚练习 → 焦虑评分 → 三个问题 → 此刻卡片（场景图 + 文字）→ 保存 / 再陪一会 / 返回

## 功能说明

- **四种安抚流程**：呼吸（含动画计时）、身体放松、走动（30 秒计时）、感官锚定
- **双场景图卡**：图 A（此刻的焦虑角度）+ 图 B（重构后的另一可能）
  - 首次切换：沙散过渡动画；如果 AI 图片跨域导致 Canvas 无法读取，会自动退化为普通切换
  - 之后切换：3D 翻转动画
- **危机模式**：输入框检测高风险关键词，立即跳转安全页
- **本地存储**：保存文字 + 场景图 URL 至 `localStorage`

## 文件结构

```text
ci-ke/
├── api/
│   ├── scene_image.py    # Vercel AI 生图代理
│   └── scene_b_meta.py   # Vercel 场景 B 文案/Prompt 代理
├── css/style.css
├── js/
│   ├── app.js
│   ├── config.js
│   ├── data.js
│   ├── imageGen.js
│   ├── sceneBMeta.js
│   └── sceneTransition.js
├── index.html
├── server.py             # 本地预览服务
├── vercel.json
└── .env.example
```
