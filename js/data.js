export const CRISIS_KEYWORDS = [
  '我不想活了',
  '我想死',
  '我想自杀',
  '我想伤害自己',
  '我想伤害别人',
  '我撑不下去了',
  '我想消失',
  '活着没意思',
  '我准备去死',
  '我已经想好怎么死了',
  '我控制不住自己了',
];

export const GENTLE_REMINDERS = [
  '你不用在最慌的时候做最重要的决定。',
  '现在先不解决人生，先照顾这一分钟。',
  '焦虑很吵，但它不是事实本身。',
  '你已经做了一件很重要的事：你没有一个人硬扛。',
  '慢一点没关系。慢一点也是在往前走。',
  '你不需要立刻变好。你只需要先被接住。',
];

export const BODY_STATES = [
  { id: 1, label: '心慌、胸口紧、呼吸有点乱', method: 'breathing' },
  { id: 2, label: '肩膀紧、胃不舒服、身体绷着', method: 'relaxation' },
  { id: 3, label: '坐立不安，很想逃开或做点什么', method: 'walking' },
  { id: 4, label: '脑子停不下来，一直在想坏结果', method: 'anchoring' },
  { id: 5, label: '说不清，就是很慌', method: 'breathing' },
];

export const EMOTIONS = [
  { id: 'anxiety', label: '我很焦虑' },
  { id: 'sad', label: '我很难过' },
  { id: 'angry', label: '我很生气' },
  { id: 'hyper', label: '我很亢奋' },
  { id: 'wronged', label: '我很委屈' },
  { id: 'unclear', label: '我说不清' },
];

export const STORAGE_KEY = 'cike_moment_records';

export function detectCrisis(text) {
  if (!text) return false;
  const normalized = text.trim();
  return CRISIS_KEYWORDS.some((kw) => normalized.includes(kw));
}

export function getScoreFeedback(score) {
  if (score <= 3) {
    return {
      level: 'mild',
      text: '好像已经稍微稳了一点。\n我们可以简单整理一下刚才发生了什么。',
    };
  }
  if (score <= 7) {
    return {
      level: 'moderate',
      text: '你现在可能还是有点紧。\n没关系，我们慢慢来，只问几个小问题。',
    };
  }
  return {
    level: 'severe',
    text: '这已经很难受了。\n我们不急着分析，只先把这一刻照顾好。\n下面的问题可以只回答一句话，甚至只写几个字。',
  };
}

export function generateCard(data) {
  const { anxietyScore, triggerEvent, mainWorry, smallAction } = data;
  const a1 = triggerEvent || '（未填写）';
  const a2 = mainWorry || '（未填写）';
  const a3 = smallAction || '我现在只想先缓一缓';

  if (anxietyScore <= 3) {
    return [
      '此刻，你可能有一点焦虑。',
      '',
      `刚才触发你的是：${a1}`,
      '',
      `你担心的是：${a2}`,
      '',
      '不过，你现在已经能开始观察它了。',
      '这说明你没有完全被焦虑带走。',
      '',
      `接下来 10 分钟，可以做这件小事：${a3}`,
      '',
      '慢慢来。',
      '你不需要把所有事情一次性想明白。',
    ].join('\n');
  }

  if (anxietyScore <= 7) {
    return [
      '此刻，你可能正在经历一阵明显的焦虑。',
      '',
      `刚才把你卷进去的是：${a1}`,
      '',
      `你最害怕的可能是：${a2}`,
      '',
      '这很难受。',
      '但这不代表事情一定会变坏，也不代表你处理不了。',
      '',
      '现在先不要逼自己立刻冷静。',
      '你可以先把事情缩小到一个动作。',
      '',
      `接下来 10 分钟，只做这一件小事：${a3}`,
      '',
      '你已经在往回走了。',
      '哪怕只是一点点，也算数。',
    ].join('\n');
  }

  return [
    '此刻，你可能非常难受。',
    '',
    `刚才发生的事情是：${a1}`,
    '',
    `你最担心的是：${a2}`,
    '',
    '先别急着解决它。',
    '现在最重要的，是让你安全地、慢慢地度过这一刻。',
    '',
    '接下来 10 分钟，不需要做很多。',
    `只做这一件小事：${a3}`,
    '',
    '如果你现在什么都做不了，也可以只做这一件事：',
    '把脚踩在地上，慢慢呼气。',
    '告诉自己：我先撑过这一分钟。',
    '',
    '你没有失败。',
    '你只是太累、太紧、太害怕了。',
    '我们先不往前冲，我们先接住你。',
  ].join('\n');
}

export function saveRecord(record) {
  const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  records.unshift({
    ...record,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function getRandomReminder() {
  return GENTLE_REMINDERS[Math.floor(Math.random() * GENTLE_REMINDERS.length)];
}
