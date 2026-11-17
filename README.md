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

### GitHub Pages 与 AI 服务

GitHub Pages 仅托管静态前端，不能运行本项目的 Python API。只有 Pages 地址时，页面会直接显示明确标注的本地备用图，不会假装 AI 生图成功。

若前端继续使用 Pages，需要单独部署本项目的 AI 后端，并将 `js/config.js` 中的 `IMAGE_CONFIG.apiBaseUrl` 设置为该后端的公网 HTTPS 地址（不含 `/api` 后缀）。图片和场景 B 文案接口都会使用这个地址；该地址不是 API Key。Key 只配置在后端环境变量中。

本地运行需要 `.env.local`，它已被 Git 忽略且本地预览服务禁止通过 HTTP 读取隐藏文件。恢复本地配置后需要重新启动服务。接口失败、无密钥、图片加载失败时会回退到备用图并显示提示。

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

### 场景追问

三个问题之后新增可跳过的场景追问，按故事中的汇报、消息等线索调整地点问题，补充地点环境、人物动作和关键视觉细节。支持语音输入，返回修改时保留草稿，跳过时清空这轮细节。补充内容参与 A/B 生图提示词、场景 B 文案请求和本地记录保存；本地与 Vercel 接口都接收细节。这里的追问使用本地规则，不额外调用大模型，也不改变 GitHub Pages 尚无 AI 后端的限制。

### 语音输入

三个问题与感受输入框提供语音入口。在支持 SpeechRecognition 的安全上下文（HTTPS 或 localhost）中使用浏览器语音服务，识别语言为普通话；再次点击结束，每次最长一分钟。结果回填原输入框，支持继续编辑，且沿用输入安全检测。切换输入框、离开页面和切入后台时取消监听。

此功能不向本项目 AI 接口上传录音，但浏览器可能调用自己的远程语音服务，页面会在启动前展示说明。浏览器不支持、拒绝权限或服务连接失败时提供输入法语音提示并保留已有文字；网页不能替用户开启系统键盘的麦克风。微信内置浏览器及国内网络下不能保证直接识别成功，若要求统一支持，需要另接可用的语音识别后端或微信 JS-SDK。

自动测试使用模拟识别器检查回填、去重、字段切换、权限错误、手工编辑、离页清理及高风险输入跳转；不代表已完成真实手机麦克风验证。参考：[MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)。

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
