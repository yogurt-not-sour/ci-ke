/**
 * 根据用户描述构建绘图 prompt，并生成场景图
 * - 优先：通过 server.py 代理调用火山方舟 Seedream（真实 AI）
 * - 备用：Canvas 本地生成水彩风格象征场景
 */

import { IMAGE_CONFIG } from './config.js';
import { generateSceneBMetaLocal, fetchSceneBMeta, buildScenePromptFromMeta } from './sceneBMeta.js';

export { generateSceneBMetaLocal, fetchSceneBMeta, buildScenePromptFromMeta };

const IMAGE_WIDTH = 512;
const IMAGE_HEIGHT = 704;

function getIntensityDesc(score) {
  if (score == null) return '情绪模糊、若有所思';
  if (score <= 3) return '轻微不安，光线柔和，仍有呼吸感';
  if (score <= 7) return '明显焦虑，画面略带压迫感但不阴暗';
  return '强烈情绪涌动，色调偏沉但仍保留一丝暖光';
}

export function buildScenePromptA(data) {
  const trigger = data.triggerEvent?.trim() || '某个不确定的时刻';
  const worry = data.mainWorry?.trim() || '未知的结果';
  const body = data.bodyState?.trim() || '身体紧绷';
  const intensity = getIntensityDesc(data.anxietyScore);

  return [
    '温柔的水彩插画，疗愈系艺术风格，竖版构图。',
    '【图A · 焦虑中的视角】',
    `画面象征性地呈现这个时刻：${trigger}。`,
    `人物内心最担心的是：${worry}。`,
    `身体感受：${body}。`,
    `情绪氛围：${intensity}。`,
    '米白暖色调，低饱和，略带压迫感，',
    '象征性场景而非写实照片，无文字，无清晰人脸五官，',
    '安全、克制、呈现「此刻困在焦虑里」的感受。',
  ].join('');
}

/** @deprecated use buildScenePromptA */
export function buildScenePrompt(data) {
  return buildScenePromptA(data);
}

export function buildScenePromptB(data) {
  return generateSceneBMetaLocal(data).imagePrompt;
}

function hashSeed(text) {
  return Math.abs(
    [...text].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
  );
}


async function generateViaArk(prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(IMAGE_CONFIG.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'AI 生图失败');
    }
    // 服务端已返回 base64 data URL，无需跨域预加载
    return {
      url: data.url,
      originalUrl: data.originalUrl || data.url,
      prompt,
      source: 'ai',
    };
  } finally {
    clearTimeout(timer);
  }
}

export function loadSceneImage(url, { timeoutMs = 90000 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;

    const finish = (fn, val) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(val);
    };

    const timer = setTimeout(() => {
      img.src = '';
      finish(reject, new Error('图像生成超时，请重试'));
    }, timeoutMs);

    img.onload = () => finish(resolve, url);
    img.onerror = () => finish(reject, new Error('图像加载失败，请重试'));

    if (url.startsWith('data:')) {
      img.src = url;
    } else {
      img.src = url;
    }
  });
}

/* ─── Canvas 本地场景生成 ─── */

function pickPalette(score, seed) {
  const rng = mulberry32(seed);
  if (score == null || score <= 3) {
    return {
      sky: [`hsl(${38 + rng() * 15}, ${28 + rng() * 10}%, ${88 - rng() * 8}%)`, `hsl(${32 + rng() * 10}, 22%, 78%)`],
      ground: [`hsl(${35 + rng() * 8}, 18%, 72%)`, `hsl(${30 + rng() * 6}, 15%, 65%)`],
      accent: `hsla(${20 + rng() * 20}, 35%, 55%, 0.35)`,
      mood: 'calm',
    };
  }
  if (score <= 7) {
    return {
      sky: [`hsl(${25 + rng() * 12}, ${22 + rng() * 8}%, ${72 - rng() * 10}%)`, `hsl(${18 + rng() * 8}, 18%, 58%)`],
      ground: [`hsl(${28 + rng() * 6}, 16%, 52%)`, `hsl(${22 + rng() * 5}, 14%, 45%)`],
      accent: `hsla(${12 + rng() * 15}, 40%, 48%, 0.45)`,
      mood: 'tense',
    };
  }
  return {
    sky: [`hsl(${15 + rng() * 8}, ${18 + rng() * 6}%, ${48 - rng() * 8}%)`, `hsl(${8 + rng() * 6}, 14%, 38%)`],
    ground: [`hsl(${20 + rng() * 5}, 12%, 35%)`, `hsl(${15 + rng() * 4}, 10%, 28%)`],
    accent: `hsla(${350 + rng() * 10}, 30%, 42%, 0.5)`,
    mood: 'heavy',
  };
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function detectSceneMotifs(text) {
  const t = (text || '').toLowerCase();
  const motifs = [];
  if (/汇报|演讲|presentation|会议|面试/.test(t)) motifs.push('stage');
  if (/消息|微信|电话|聊天|email|邮件/.test(t)) motifs.push('message');
  if (/未来|明天|以后|将来/.test(t)) motifs.push('horizon');
  if (/吵|争|骂|冲突|吵架/.test(t)) motifs.push('storm');
  if (/睡|夜|失眠|凌晨/.test(t)) motifs.push('night');
  if (/工作|deadline|截止|来不及/.test(t)) motifs.push('clock');
  if (/关系|分手|失去|孤独/.test(t)) motifs.push('distance');
  if (motifs.length === 0) motifs.push('fog');
  return motifs;
}

function drawWatercolorBlob(ctx, x, y, rx, ry, color, alpha = 0.4) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMotif(ctx, motif, w, h, palette, rng) {
  ctx.save();
  const cx = w * 0.5;

  switch (motif) {
    case 'stage': {
      const y = h * 0.62;
      ctx.fillStyle = `hsla(30, 20%, 40%, 0.25)`;
      ctx.beginPath();
      ctx.moveTo(w * 0.15, y);
      ctx.lineTo(w * 0.85, y);
      ctx.lineTo(w * 0.78, h * 0.92);
      ctx.lineTo(w * 0.22, h * 0.92);
      ctx.closePath();
      ctx.fill();
      drawWatercolorBlob(ctx, cx, h * 0.35, w * 0.28, h * 0.12, palette.accent, 0.35);
      break;
    }
    case 'message': {
      drawWatercolorBlob(ctx, w * 0.72, h * 0.38, w * 0.14, h * 0.08, 'hsla(200, 25%, 70%, 0.5)', 0.55);
      ctx.strokeStyle = 'hsla(200, 20%, 55%, 0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.58, h * 0.32, w * 0.28, h * 0.14);
      break;
    }
    case 'horizon': {
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(w * 0.1, h * 0.55);
      ctx.lineTo(w * 0.9, h * 0.55);
      ctx.stroke();
      drawWatercolorBlob(ctx, cx, h * 0.48, w * 0.35, h * 0.06, 'hsla(45, 40%, 75%, 0.4)', 0.5);
      break;
    }
    case 'storm': {
      for (let i = 0; i < 5; i++) {
        drawWatercolorBlob(ctx, w * (0.2 + rng() * 0.6), h * (0.15 + rng() * 0.25), w * (0.08 + rng() * 0.12), h * 0.05, 'hsla(220, 15%, 55%, 0.35)', 0.4);
      }
      break;
    }
    case 'night': {
      drawWatercolorBlob(ctx, w * 0.78, h * 0.18, w * 0.06, h * 0.06, 'hsla(45, 30%, 85%, 0.6)', 0.5);
      break;
    }
    case 'clock': {
      ctx.strokeStyle = 'hsla(25, 25%, 45%, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w * 0.28, h * 0.32, w * 0.07, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w * 0.28, h * 0.32);
      ctx.lineTo(w * 0.28, h * 0.27);
      ctx.stroke();
      break;
    }
    case 'distance': {
      drawWatercolorBlob(ctx, w * 0.35, h * 0.58, w * 0.08, h * 0.14, 'hsla(30, 20%, 60%, 0.3)', 0.35);
      drawWatercolorBlob(ctx, w * 0.65, h * 0.58, w * 0.08, h * 0.14, 'hsla(30, 20%, 60%, 0.25)', 0.3);
      ctx.setLineDash([4, 8]);
      ctx.strokeStyle = 'hsla(30, 15%, 50%, 0.25)';
      ctx.beginPath();
      ctx.moveTo(w * 0.43, h * 0.62);
      ctx.lineTo(w * 0.57, h * 0.62);
      ctx.stroke();
      break;
    }
    default: {
      for (let i = 0; i < 6; i++) {
        drawWatercolorBlob(ctx, w * rng(), h * (0.2 + rng() * 0.4), w * (0.1 + rng() * 0.15), h * 0.04, 'hsla(35, 15%, 70%, 0.25)', 0.35);
      }
    }
  }
  ctx.restore();
}

function renderProceduralScene(data, prompt) {
  const seed = hashSeed(prompt);
  const rng = mulberry32(seed);
  const palette = pickPalette(data.anxietyScore, seed);

  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d');

  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.65);
  skyGrad.addColorStop(0, palette.sky[0]);
  skyGrad.addColorStop(1, palette.sky[1]);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const groundGrad = ctx.createLinearGradient(0, canvas.height * 0.55, 0, canvas.height);
  groundGrad.addColorStop(0, palette.ground[0]);
  groundGrad.addColorStop(1, palette.ground[1]);
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, canvas.height * 0.55, canvas.width, canvas.height * 0.45);

  for (let i = 0; i < 8; i++) {
    drawWatercolorBlob(
      ctx,
      canvas.width * rng(),
      canvas.height * rng() * 0.7,
      canvas.width * (0.06 + rng() * 0.18),
      canvas.height * (0.03 + rng() * 0.08),
      palette.accent,
      0.15 + rng() * 0.2
    );
  }

  const combined = `${data.triggerEvent || ''} ${data.mainWorry || ''}`;
  const motifs = detectSceneMotifs(combined);
  motifs.slice(0, 2).forEach((m) => drawMotif(ctx, m, canvas.width, canvas.height, palette, rng));

  ctx.fillStyle = 'rgba(255,252,248,0.08)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', 0.88);
}

async function generateViaAI(prompt) {
  if (IMAGE_CONFIG.provider === 'ark' && IMAGE_CONFIG.apiEndpoint) {
    return generateViaArk(prompt);
  }
  throw new Error('未配置 AI 生图服务');
}

function pickPaletteB(score, seed) {
  const rng = mulberry32(seed + 999);
  const base = pickPalette(score, seed);
  return {
    sky: [`hsl(${42 + rng() * 12}, ${32 + rng() * 8}%, ${82 - rng() * 6}%)`, `hsl(${38 + rng() * 8}, 26%, 72%)`],
    ground: [`hsl(${38 + rng() * 6}, 20%, 68%)`, `hsl(${34 + rng() * 5}, 18%, 60%)`],
    accent: `hsla(${45 + rng() * 15}, 38%, 62%, 0.4)`,
    mood: 'open',
    base,
  };
}

function drawMotifB(ctx, motif, w, h, palette, rng) {
  drawMotif(ctx, motif, w, h, palette.base || palette, rng);
  drawWatercolorBlob(ctx, w * 0.5, h * 0.72, w * 0.22, h * 0.05, 'hsla(45, 45%, 78%, 0.55)', 0.5);
  ctx.strokeStyle = 'hsla(40, 30%, 55%, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.78);
  ctx.lineTo(w * 0.65, h * 0.78);
  ctx.stroke();
}

function renderProceduralSceneB(data, prompt) {
  const seed = hashSeed(prompt + '-b');
  const rng = mulberry32(seed);
  const palette = pickPaletteB(data.anxietyScore, hashSeed(prompt));

  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d');

  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.65);
  skyGrad.addColorStop(0, palette.sky[0]);
  skyGrad.addColorStop(1, palette.sky[1]);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const groundGrad = ctx.createLinearGradient(0, canvas.height * 0.55, 0, canvas.height);
  groundGrad.addColorStop(0, palette.ground[0]);
  groundGrad.addColorStop(1, palette.ground[1]);
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, canvas.height * 0.55, canvas.width, canvas.height * 0.45);

  drawWatercolorBlob(ctx, canvas.width * 0.5, canvas.height * 0.22, canvas.width * 0.35, canvas.height * 0.12, 'hsla(45, 50%, 88%, 0.45)', 0.55);

  for (let i = 0; i < 6; i++) {
    drawWatercolorBlob(
      ctx, canvas.width * rng(), canvas.height * rng() * 0.7,
      canvas.width * (0.05 + rng() * 0.12), canvas.height * (0.02 + rng() * 0.06),
      palette.accent, 0.12 + rng() * 0.15
    );
  }

  const combined = `${data.triggerEvent || ''} ${data.mainWorry || ''} ${data.smallAction || ''}`;
  const motifs = detectSceneMotifs(combined);
  motifs.slice(0, 1).forEach((m) => drawMotifB(ctx, m, canvas.width, canvas.height, palette, rng));

  return canvas.toDataURL('image/jpeg', 0.88);
}

async function generateOneScene(data, prompt, variant = 'a') {
  try {
    return await generateViaAI(prompt);
  } catch {
    await new Promise((r) => setTimeout(r, variant === 'b' ? 800 : 1200));
    const url = variant === 'b'
      ? renderProceduralSceneB(data, prompt)
      : renderProceduralScene(data, prompt);
    return { url, originalUrl: url, prompt, source: 'canvas' };
  }
}

export async function generateSceneImageA(data) {
  return generateOneScene(data, buildScenePromptA(data), 'a');
}

export async function generateSceneImageB(data) {
  const meta = await fetchSceneBMeta(data);
  const prompt = buildScenePromptFromMeta(meta);
  const result = await generateOneScene(data, prompt, 'b');
  return { ...result, meta };
}

export async function generateSceneImage(data) {
  return generateSceneImageA(data);
}

export function isUsingAI() {
  return IMAGE_CONFIG.provider === 'ark';
}
