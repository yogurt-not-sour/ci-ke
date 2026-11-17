/**
 * 图像生成配置
 * 真实 AI 生图通过 server.py 代理调用火山方舟 Seedream（Key 存在 .env.local，不暴露给前端）
 */
export const IMAGE_CONFIG = {
  provider: 'ark',
  apiEndpoint: '/api/scene-image',
  // Public HTTPS backend origin, never an API key. Empty means same-origin.
  apiBaseUrl: '',
};

export function getApiEndpoint(path) {
  const base = IMAGE_CONFIG.apiBaseUrl.trim().replace(/\/$/, '');
  if (!base && window.location.hostname.endsWith('.github.io')) {
    throw new Error('当前在线版尚未连接 AI 服务，显示的是本地备用图，并非 AI 生图。');
  }
  if (base && !base.startsWith('https://')) throw new Error('AI 服务地址需要使用 HTTPS。');
  return base + path;
}
