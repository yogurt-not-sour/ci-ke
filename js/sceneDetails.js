export function getSceneQuestions(story = '') {
  const setting = /汇报|会议|面试|答辩/.test(story)
    ? '那次汇报或交流，会在怎样的房间里？'
    : /消息|微信|电话|邮件/.test(story)
      ? '看到消息或接到电话时，你在哪里？'
      : '如果把这件事画下来，它发生在什么地方？';
  return [
    { key: 'setting', label: setting, placeholder: '比如：有一扇窗的会议室、夜里的卧室、回家的路上。不确定也可以说一个你想到的地方。' },
    { key: 'people', label: '画面里有谁？你们分别在做什么？', placeholder: '比如：我坐在桌边，其他人看着屏幕。可以只说角色，不需要真实姓名。' },
    { key: 'visuals', label: '你最想留下哪个画面细节？', placeholder: '比如：天快黑了、手里的手机、桌上的纸、窗外的雨，或者你当时的姿势。' },
  ];
}

export function describeSceneDetails(details = {}) {
  return [['setting', '地点和环境'], ['people', '人物和动作'], ['visuals', '时间、光线或物件']]
    .filter(([key]) => typeof details[key] === 'string' && details[key].trim())
    .map(([key, label]) => `${label}：${details[key].trim().slice(0, 300)}`)
    .join('；');
}
