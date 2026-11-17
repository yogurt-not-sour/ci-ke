/**
 * 场景 B 元数据：深层冲突识别 + 重构视角 + 图像 prompt + 含义解释
 * 优先走服务端 LLM（/api/scene-b-meta），失败则本地规则生成
 */

import { getApiEndpoint } from './config.js';
import { describeSceneDetails } from './sceneDetails.js';

export const SCENE_B_SYSTEM_PROMPT = `你是「此刻」App 的场景 B 设计助手。根据用户的事件描述、担心内容和小行动，生成场景 B 的图像描述与含义解释。

场景 B 的目标不是安慰用户，也不是制造光明未来，而是在保留现实压力的基础上，帮助用户换一个更宽、更有行动空间的角度看问题。

请先识别用户的深层心理冲突，例如：
- 路径合法性焦虑
- 同辈比较焦虑
- 失控感
- 被否定感
- 价值感动摇
- 未来不确定感
- 关系中的委屈
- 对自我能力的怀疑

然后生成一个图像场景。这个图像必须：
1. 与用户原始事件有关；
2. 保留现实压力，不要突然变成阳光大团圆；
3. 加入一个「出口」或「可移动空间」的视觉元素；
4. 体现用户不是被困住，而是在慢慢重新获得一点主动权；
5. 风格为柔和插画、情绪真实、克制、不鸡汤。

禁止出现：夸张阳光、胜利姿势、灿烂大笑、大团圆、「光明未来」式画面、与用户事件无关的抽象安慰。

解释文字要求：语气温暖积极但不夸张；不否定用户原本的痛苦；不用空泛鸡汤；不说「你一定会成功」「一切都会好起来」；像温柔的人在轻轻解释。

请严格只输出 JSON，不要其他文字：
{
  "deepConflict": "用户深层心理冲突",
  "reframe": "新的理解角度",
  "sceneBDescription": "场景B中文描述",
  "imagePrompt": "用于生成图像的中文 prompt，柔和水彩插画风格，含出口/可移动空间元素",
  "caption": "图片下方的一句话，简短、温柔、有力量",
  "meaningExplanation": "一小段温柔的解释，说明这张图的含义"
}`;

const CONFLICT_RULES = [
  {
    id: 'path_legitimacy',
    label: '路径合法性焦虑',
    patterns: /汇报|答辩|面试|考核|标准|正规|路径|资格|认可|学历|简历/,
    reframe: '你在意的不是「完美表现」，而是「这条路是否还属于我」——而归属不一定只由一次结果决定。',
    sceneTemplate: (d) =>
      `同一间${matchContext(d.trigger, '会议室|办公室|教室|房间', '房间')}仍在，汇报/考核的压力还在桌上。但画面里多了一扇半开的侧门，或一条通向走廊的窄道，光线不灿烂，只是安静地亮着。人物不在舞台中央，而是站在可以离开或调整的位置——不是逃离，是「这里还有别的走法」。`,
    exit: '半开的侧门或窄道',
  },
  {
    id: 'peer_comparison',
    label: '同辈比较焦虑',
    patterns: /别人|同学|同事|比较|落后|同辈|差距|别人都|赶不上/,
    reframe: '比较让你以为只有一条跑道，但你的节奏和路径本来就可以不同——落后感不等于没有位置。',
    sceneTemplate: (d) =>
      `背景里仍有他人前行的暗示（模糊人影或并排轨道），压力真实存在。但前景有一条只属于用户的稍宽小径，分岔处没有胜负标志，只有可以继续走的一小步。${d.action ? `小径旁有象征「${d.action}」的小物件。` : ''}`,
    exit: '分岔处的小径',
  },
  {
    id: 'loss_of_control',
    label: '失控感',
    patterns: /失控|来不及|不知道怎么办|一团|混乱|兜不住|没法|撑不住/,
    reframe: '事情确实多且乱，但失控感往往来自「必须一次搞定全部」——而你现在只需要握住下一小步。',
    sceneTemplate: (d) =>
      `画面仍保留缠在一起的线团或散落的纸张，混乱没有消失。但在混乱边缘，有一只手或一个角落正在整理「一件小事」——${d.action || '先停一下'}。旁边有可移动的空间：一张可挪动的椅子、一个可以走开的台阶。`,
    exit: '可挪动的椅子或台阶',
  },
  {
    id: 'rejection',
    label: '被否定感',
    patterns: /否定|批评|骂|看不起|瞧不起|拒绝|丢脸|羞辱|说我不/,
    reframe: '被否定的刺痛是真的，但一次反应不等于你的全部价值——你仍可以决定下一步如何回应自己。',
    sceneTemplate: (d) =>
      `画面保留冷淡的色调和一道阴影（象征那句批评或冷落），没有消失。但用户侧旁有一小块属于自己的安静区域——一杯水、一扇窗、或可以坐下的边角。阴影没有退散，但人不在阴影正中央。`,
    exit: '窗边的安静角落',
  },
  {
    id: 'value_shake',
    label: '价值感动摇',
    patterns: /没用|没价值|意义|贡献|值得|存在感|可有可无/,
    reframe: '价值感动摇时，你会把「一件事的结果」当成「我整个人」——但它们不是同一件事。',
    sceneTemplate: (d) =>
      `画面里仍有一块空白或未完成的工作区，压力真实。但旁边有一个已经在进行的小动作：${d.action || '一件很小的事'}。空白没有填满，但有一个可见的、进行中的痕迹——证明「我在动」，不是「我没了」。`,
    exit: '进行中的小痕迹',
  },
  {
    id: 'future_uncertainty',
    label: '未来不确定感',
    patterns: /未来|明天|以后|不确定|会怎样|前途|未知/,
    reframe: '未来确实看不清，但「看不清」不等于「一定会糟」——你此刻能做的，是给下一分钟一个落脚点。',
    sceneTemplate: (d) =>
      `远处仍是模糊的地平线或未亮的区域，不确定感保留。但近处有一盏不刺眼的灯、或一段清晰可见的地面——${d.trigger} 仍在背景，而脚边是「${d.action || '先照顾这一分钟'}」可以发生的空间。`,
    exit: '近处可见的一小段路',
  },
  {
    id: 'relationship_wrong',
    label: '关系中的委屈',
    patterns: /委屈|不公平|吵架|理解|关系|误会|冷战|不理/,
    reframe: '委屈里往往藏着「我希望被看见」——这不代表你矫情，只代表这段关系对你很重要。',
    sceneTemplate: (d) =>
      `画面保留两人之间的距离或一扇关上的门，张力还在。但用户这边有一个可以表达或暂停的空间：一条待发送后可以先不发的消息、或一个可以独自喘口气的阳台/走廊。没有和解大团圆，只有「我可以先照顾自己的边界」。`,
    exit: '可以暂停的独立空间',
  },
  {
    id: 'self_doubt',
    label: '对自我能力的怀疑',
    patterns: /搞砸|做不到|能力|不够|失败|我不行|怀疑|配不上/,
    reframe: '怀疑能力时，大脑会把「还没做好」直接跳到「我不配」——中间其实还有练习、调整、和再试一次的空间。',
    sceneTemplate: (d) =>
      `画面里仍有未完成的任务或倾斜的堆叠物（象征「怕搞砸」），压力真实。但有一个被刻意缩小、可以着手的一格：${d.action || '一件很小的事'}。不是全部搞定，只是「这一格我可以碰」。`,
    exit: '可以着手的一小格',
  },
];

function matchContext(text, pattern, fallback) {
  const m = (text || '').match(new RegExp(pattern));
  return m ? m[0] : fallback;
}

function detectConflict(data) {
  const combined = `${data.triggerEvent || ''} ${data.mainWorry || ''} ${data.smallAction || ''}`;
  for (const rule of CONFLICT_RULES) {
    if (rule.patterns.test(combined)) return rule;
  }
  return {
    id: 'general_anxiety',
    label: '焦虑中的窄化视角',
    patterns: null,
    reframe: '焦虑会把注意力压到最窄的地方——好像只有最坏的结果。但视野其实还可以稍微打开一点点。',
    sceneTemplate: (d) =>
      `画面仍与「${d.trigger}」相关，担心的「${d.worry}」以阴影或紧束的线条保留在画面中。但构图里留出一处可移动的空间——一条通道、一扇未锁的门、或一个可以停下的小角落。${d.action ? `近处有象征「${d.action}」的元素。` : ''}`,
    exit: '一处可移动的空间',
  };
}

function buildImagePrompt(sceneDesc) {
  return [
    '柔和水彩插画，竖版构图，情绪真实、克制、不鸡汤。',
    sceneDesc,
    '保留现实压力，不要大团圆，不要夸张阳光，不要胜利姿势，不要灿烂大笑。',
    '低饱和米白暖色调，象征性场景，无文字，无清晰人脸五官，安全、有呼吸感。',
  ].join('');
}

function buildMeaningExplanation(conflict, reframe, trigger, worry, action, exit) {
  return [
    `这张图没有否定你正在经历的「${trigger || '这件事'}」，也没有假装「${worry || '你的担心'}」不存在。`,
    `${reframe}`,
    `画面里的「${exit}」不是逃避，而是提醒你：在原来的困境里，其实还有一点点可以移动、可以选择的缝隙。`,
    action ? `接下来，「${action}」就是把这个缝隙变成真实的一步——很小，但算数。` : '你不需要一次想明白全部，只需要先看见这个缝隙。',
  ].join('');
}

function buildCaption(reframe) {
  const short = reframe.split('——')[0].replace(/^你在意的不是「[^」]+」，而是「([^」]+)」.*$/, '$1').slice(0, 40);
  if (short.length > 5 && short.length < 35) return `${short}——而你现在还可以动一点点。`;
  return '困境还在，但你不是完全被困住的。';
}

/**
 * 本地规则生成场景 B 元数据（LLM 不可用时的备用）
 */
export function generateSceneBMetaLocal(data) {
  const trigger = data.triggerEvent?.trim() || '某件让你挂心的事';
  const worry = data.mainWorry?.trim() || '不确定的结果';
  const action = data.smallAction?.trim() || '先缓一缓，照顾这一分钟';

  const conflict = detectConflict({
    triggerEvent: trigger,
    mainWorry: worry,
    smallAction: action,
  });

  const ctx = { trigger, worry, action };
  const sceneBDescription = conflict.sceneTemplate(ctx);
  const reframe = conflict.reframe;
  const imagePrompt = buildImagePrompt(sceneBDescription);
  const meaningExplanation = buildMeaningExplanation(
    conflict.label, reframe, trigger, worry, action, conflict.exit
  );
  const caption = buildCaption(reframe);

  return {
    deepConflict: conflict.label,
    reframe,
    sceneBDescription,
    imagePrompt,
    caption,
    meaningExplanation,
  };
}

/**
 * 请求服务端 LLM 生成，失败则降级本地
 */
export async function fetchSceneBMeta(data) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(getApiEndpoint('/api/scene-b-meta'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        triggerEvent: data.triggerEvent,
        mainWorry: data.mainWorry,
        smallAction: data.smallAction,
        bodyState: data.bodyState,
        anxietyScore: data.anxietyScore,
        sceneDetails: describeSceneDetails(data.sceneDetails),
      }),
      signal: controller.signal,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'meta failed');
    validateMeta(json);
    return json;
  } catch {
    return generateSceneBMetaLocal(data);
  } finally {
    clearTimeout(timer);
  }
}

function validateMeta(m) {
  const required = ['deepConflict', 'reframe', 'sceneBDescription', 'imagePrompt', 'caption', 'meaningExplanation'];
  for (const k of required) {
    if (!m[k] || typeof m[k] !== 'string') throw new Error(`missing ${k}`);
  }
}

export function buildScenePromptFromMeta(meta, data = {}) {
  const details = describeSceneDetails(data.sceneDetails);
  return meta.imagePrompt + (details ? `。保留与图A一致的用户场景细节：${details}。保留地点、人物和关键物件，仅调整视角、人物位置或可行动的空间，不凭空变成无关风景。` : '');
}
