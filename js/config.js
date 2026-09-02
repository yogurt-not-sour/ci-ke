/**
 * 图像生成配置
 * 真实 AI 生图通过 server.py 代理调用火山方舟 Seedream（Key 存在 .env.local，不暴露给前端）
 */
export const IMAGE_CONFIG = {
  provider: 'ark',
  apiEndpoint: '/api/scene-image',
};
