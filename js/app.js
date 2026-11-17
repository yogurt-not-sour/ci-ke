import {
  EMOTIONS,
  BODY_STATES,
  detectCrisis,
  getScoreFeedback,
  generateCard,
  saveRecord,
  getRandomReminder,
} from './data.js';
import { generateSceneImageA, generateSceneImageB, isUsingAI } from './imageGen.js';
import { toggleSceneFlip, playSandDissolve } from './sceneTransition.js';

const state = {
  emotion: null,
  bodyState: null,
  calmingMethod: null,
  anxietyScore: null,
  triggerEvent: '',
  mainWorry: '',
  smallAction: '',
  cardText: '',
  sceneAUrl: null,
  sceneAOriginalUrl: null,
  sceneAPrompt: null,
  sceneBUrl: null,
  sceneBOriginalUrl: null,
  sceneBPrompt: null,
  sceneBMeta: null,
  sceneImageSource: null,
  sceneImageStatus: 'idle', // idle | loading-a | loading-b | ready-a | ready | error
  activeScene: 'a',
  sceneBRevealed: false,
  sandPlayed: false,
  saved: false,
  afterCalming: null,
  history: ['home'],
};

const mainEl = document.getElementById('app-main');
const titleEl = document.getElementById('page-title');
const backBtn = document.getElementById('back-btn');

let breathTimer = null;
let walkTimer = null;

function currentPage() {
  return state.history[state.history.length - 1];
}

function navigate(page, { replace = false } = {}) {
  if (page === currentPage()) return;
  if (replace) {
    state.history[state.history.length - 1] = page;
  } else {
    state.history.push(page);
  }
  render();
}

function goBack() {
  if (state.history.length <= 1) return;
  clearTimers();
  state.history.pop();
  render();
}

function goHome() {
  clearTimers();
  sceneGenToken++;
  Object.assign(state, {
    emotion: null,
    bodyState: null,
    calmingMethod: null,
    anxietyScore: null,
    triggerEvent: '',
    mainWorry: '',
    smallAction: '',
    cardText: '',
    sceneAUrl: null,
    sceneAOriginalUrl: null,
    sceneAPrompt: null,
    sceneBUrl: null,
    sceneBOriginalUrl: null,
    sceneBPrompt: null,
    sceneBMeta: null,
    sceneImageSource: null,
    sceneImageStatus: 'idle',
    activeScene: 'a',
    sceneBRevealed: false,
    sandPlayed: false,
    saved: false,
    afterCalming: null,
    history: ['home'],
  });
  render();
}

function clearTimers() {
  if (breathTimer) {
    clearInterval(breathTimer);
    breathTimer = null;
  }
  if (walkTimer) {
    clearInterval(walkTimer);
    walkTimer = null;
  }
}

function triggerCrisis() {
  clearTimers();
  state.history = ['crisis'];
  render();
}

function checkInputCrisis(value) {
  if (detectCrisis(value)) {
    triggerCrisis();
    return true;
  }
  return false;
}

backBtn.addEventListener('click', goBack);

function setTitle(text) {
  titleEl.textContent = text;
}

function showBack(show) {
  backBtn.hidden = !show;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') node.className = v;
    else if (k === 'textContent') node.textContent = v;
    else if (k === 'innerHTML') node.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  });
  children.forEach((c) => {
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else if (c) node.appendChild(c);
  });
  return node;
}

function renderParagraphs(text, className = 'body-text') {
  const container = el('div', { className });
  text.split('\n').filter(Boolean).forEach((line) => {
    container.appendChild(el('p', { textContent: line }));
  });
  return container;
}

function renderBtn(text, className, onClick) {
  return el('button', { className: `btn ${className}`, textContent: text, onClick });
}

/* ─── Pages ─── */

function renderHome() {
  setTitle('此刻');
  showBack(false);

  const page = el('section', { className: 'page welcome-page', 'aria-label': '欢迎来到此刻' }, [
    el('img', {
      className: 'welcome-landscape',
      src: 'assets/welcome-meadow.webp',
      alt: '蓝天下的草地上，一棵枝叶舒展的大树陪着一间红顶小屋',
      fetchpriority: 'high',
      decoding: 'async',
    }),
    el('div', { className: 'welcome-copy' }, [
      el('h1', { className: 'welcome-title', textContent: '此刻' }),
      el('p', { className: 'welcome-greeting', textContent: '嗨，欢迎你来。' }),
      el('p', { className: 'welcome-message', textContent: '在这棵树下，先歇一会儿。' }),
    ]),
    el('div', { className: 'welcome-actions' }, [
      renderBtn('进入此刻', 'welcome-enter', () => navigate('emotions')),
      el('p', { className: 'welcome-note', textContent: '带着现在的心情来，就好。' }),
    ]),
  ]);
  mainEl.replaceChildren(page);
}

function renderEmotions() {
  setTitle('此刻');
  showBack(true);

  const page = el('div', { className: 'page' }, [
    el('div', { className: 'lead', textContent: '你现在还好吗？' }),
    renderParagraphs('不用急着解释。\n先选一个最接近你的状态。'),
    el('div', { className: 'emotion-grid' }, EMOTIONS.map((emo) =>
      el('button', {
        className: 'emotion-btn',
        'data-emotion': emo.id,
        textContent: emo.label,
        onClick: () => {
          state.emotion = emo.id;
          if (emo.id === 'anxiety') navigate('anxiety-entry');
          else navigate('coming-soon');
        },
      })
    )),
    el('p', {
      className: 'footer-note',
      innerHTML: '此刻不是心理诊断工具。<br>它只是陪你把这一刻慢慢撑过去。',
    }),
  ]);

  mainEl.replaceChildren(page);
}

function renderComingSoon() {
  setTitle('此刻');
  showBack(true);

  const page = el('div', { className: 'page coming-soon' }, [
    el('div', { className: 'coming-soon-icon', textContent: '🌿' }),
    el('div', { className: 'lead', textContent: '这个功能还在准备中' }),
    renderParagraphs('目前「我很焦虑」模式已经可以使用。\n其他情绪模式即将上线。'),
    renderBtn('返回首页', 'btn-secondary', goHome),
  ]);

  mainEl.replaceChildren(page);
}

function renderAnxietyEntry() {
  setTitle('我在。我们先慢一点。');
  showBack(true);

  const page = el('div', { className: 'page' }, [
    renderParagraphs(
      '你现在可能有点慌。\n也许脑子很吵，身体很紧，事情像一团线缠在一起。\n\n没关系。\n现在不用立刻解决所有问题。\n\n我们先把这一分钟过稳。'
    ),
    renderBtn('开始', 'btn-primary', () => navigate('body-state')),
  ]);

  mainEl.replaceChildren(page);
}

function renderBodyState() {
  setTitle('你的焦虑现在更像哪一种？');
  showBack(true);

  const page = el('div', { className: 'page' }, [
    renderParagraphs('不用选得很准确。\n选一个最接近的就好。'),
    el('div', { className: 'option-list' }, BODY_STATES.map((item) =>
      el('button', {
        className: 'option-item',
        onClick: () => {
          state.bodyState = item.label;
          state.calmingMethod = item.method;
          navigate(item.method);
        },
      }, [
        el('span', { className: 'option-num', textContent: String(item.id) }),
        el('span', { textContent: item.label }),
      ])
    )),
  ]);

  mainEl.replaceChildren(page);
}

function renderBreathing() {
  setTitle('我们先把呼吸放慢一点');
  showBack(true);

  const page = el('div', { className: 'page' }, [
    renderParagraphs('你不用马上平静。\n只要比刚才慢一点点，就已经很好了。\n\n跟着我做 3 轮：'),
    el('div', { className: 'breathing-container', id: 'breathing-root' }),
  ]);

  mainEl.replaceChildren(page);
  startBreathingExercise();
}

function startBreathingExercise() {
  const root = document.getElementById('breathing-root');
  if (!root) return;

  const rounds = [
    { inhale: 4, hold: 2, exhale: 6 },
    { inhale: 4, hold: 2, exhale: 6 },
    { inhale: 4, hold: 2, exhale: 6 },
  ];

  let roundIdx = 0;
  let phase = 'inhale';
  let countdown = 4;
  let finished = false;

  const roundEl = el('div', { className: 'breath-round', textContent: '第 1 轮' });
  const labelEl = el('div', { className: 'breath-label', textContent: '吸气' });
  const circle = el('div', { className: 'breath-circle inhale' });
  const circleWrap = el('div', { className: 'breath-circle-wrap' }, [circle, labelEl]);

  const stepsEl = el('div', { className: 'breath-steps' });
  for (let r = 1; r <= 3; r++) {
    ['吸气 4 秒', '停住 2 秒', '呼气 6 秒'].forEach((s) => {
      stepsEl.appendChild(el('div', { className: 'breath-step-item', 'data-round': r }, [
        el('span', { className: 'step-dot' }),
        el('span', { textContent: `第 ${r} 轮 · ${s}` }),
      ]));
    });
  }

  root.append(roundEl, circleWrap, stepsEl);

  function setDuration(sec) {
    circle.style.setProperty('--breath-duration', `${sec}s`);
  }

  function updateSteps() {
    const items = stepsEl.querySelectorAll('.breath-step-item');
    const globalIdx = roundIdx * 3 + ['inhale', 'hold', 'exhale'].indexOf(phase);
    items.forEach((item, i) => {
      item.classList.remove('active', 'done');
      if (i < globalIdx) item.classList.add('done');
      else if (i === globalIdx) item.classList.add('active');
    });
  }

  function setPhase() {
    const r = rounds[roundIdx];
    roundEl.textContent = `第 ${roundIdx + 1} 轮`;

    if (phase === 'inhale') {
      countdown = r.inhale;
      labelEl.textContent = `吸气 ${countdown}`;
      circle.className = 'breath-circle inhale';
      setDuration(r.inhale);
    } else if (phase === 'hold') {
      countdown = r.hold;
      labelEl.textContent = `停住 ${countdown}`;
      circle.className = 'breath-circle hold';
      setDuration(0.3);
    } else {
      countdown = r.exhale;
      labelEl.textContent = `呼气 ${countdown}`;
      circle.className = 'breath-circle exhale';
      setDuration(r.exhale);
    }
    updateSteps();
  }

  function onComplete() {
    finished = true;
    clearInterval(breathTimer);
    breathTimer = null;

    const next = state.afterCalming === 'stay' ? 'stay' : 'anxiety-score';
    if (state.afterCalming === 'stay') state.afterCalming = null;

    const endPage = el('div', { className: 'page' });
    endPage.append(
      renderParagraphs('很好。\n你刚刚已经把自己从那团焦虑里，往外带了一点点。'),
      renderBtn('我完成了', 'btn-primary', () => navigate(next))
    );
    mainEl.replaceChildren(endPage);
    setTitle('我们先把呼吸放慢一点');
  }

  setPhase();

  breathTimer = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      const prefix = phase === 'inhale' ? '吸气' : phase === 'hold' ? '停住' : '呼气';
      labelEl.textContent = `${prefix} ${countdown}`;
      return;
    }

    if (phase === 'inhale') phase = 'hold';
    else if (phase === 'hold') phase = 'exhale';
    else {
      roundIdx++;
      if (roundIdx >= rounds.length) {
        onComplete();
        return;
      }
      phase = 'inhale';
    }
    setPhase();
  }, 1000);
}

function renderRelaxation() {
  setTitle('先让身体知道：现在可以松一点');
  showBack(true);

  const steps = [
    { title: '把肩膀轻轻耸起来', desc: '停 2 秒', sub: '慢慢放下' },
    { title: '把手轻轻握紧', desc: '停 2 秒', sub: '慢慢松开' },
    { title: '把下巴、眉心、舌头都放松一点', desc: '不需要很彻底', sub: '只要少用一点力' },
  ];

  const page = el('div', { className: 'page' }, [
    renderParagraphs('焦虑有时候会藏在身体里。\n我们不急着讲道理，先松开一点点。'),
    el('div', { className: 'steps-list' }, steps.map((s, i) =>
      el('div', { className: 'step-block' }, [
        el('div', { className: 'step-block-title', textContent: `${i + 1}. ${s.title}` }),
        el('div', { className: 'step-block-desc' }, [
          el('span', { textContent: s.desc }),
          el('em', { textContent: s.sub }),
        ]),
      ])
    )),
    renderParagraphs('你不需要一下子好起来。\n你只是在告诉身体：这一刻可以稍微安全一点。'),
    renderBtn('我完成了', 'btn-primary', () => navigate('anxiety-score')),
  ]);

  mainEl.replaceChildren(page);
}

function renderWalking() {
  setTitle('让那股慌有地方流动');
  showBack(true);

  const page = el('div', { className: 'page' }, [
    renderParagraphs('如果你现在坐立不安，不一定要逼自己安静下来。\n可以先让身体动一动。'),
    el('div', { className: 'steps-list' }, [
      el('div', { className: 'step-block' }, [
        el('div', { className: 'step-block-title', textContent: '如果条件允许，请站起来，慢慢走 30 秒。' }),
        el('ul', { className: 'bullet-list' }, [
          el('li', { textContent: '不刷手机' }),
          el('li', { textContent: '不立刻发消息' }),
          el('li', { textContent: '不做重大决定' }),
          el('li', { textContent: '只是走一走' }),
        ]),
      ]),
    ]),
    el('div', { className: 'walk-timer', id: 'walk-timer-root' }),
  ]);

  mainEl.replaceChildren(page);
  startWalkTimer();
}

function startWalkTimer() {
  const root = document.getElementById('walk-timer-root');
  if (!root) return;

  let seconds = 30;
  const timeEl = el('div', { className: 'walk-time', textContent: '0:30' });
  const hintEl = el('div', { className: 'walk-hint', textContent: '慢慢走，不用赶' });
  const finishWalk = () => {
    clearInterval(walkTimer);
    walkTimer = null;
    const endSection = el('div', {});
    endSection.append(
      renderParagraphs('你刚刚没有被焦虑推着跑。\n你是在陪身体把那股慌慢慢放出来。'),
      renderBtn('继续', 'btn-primary', () => navigate('anxiety-score'))
    );
    root.replaceWith(endSection);
  };

  const doneBtn = renderBtn('我完成了', 'btn-primary', finishWalk);
  doneBtn.style.marginTop = '24px';

  root.append(timeEl, hintEl, doneBtn);

  walkTimer = setInterval(() => {
    seconds--;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    timeEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
    if (seconds <= 0) {
      clearInterval(walkTimer);
      walkTimer = null;
      timeEl.textContent = '完成';
      hintEl.textContent = '做得很好';
    }
  }, 1000);
}

function renderAnchoring() {
  setTitle('把注意力带回现在');
  showBack(true);

  const anchors = [
    { num: 5, text: '你现在能看到的 5 样东西。' },
    { num: 4, text: '你现在能摸到的 4 种触感。' },
    { num: 3, text: '你现在能听到的 3 种声音。' },
    { num: 2, text: '你现在能闻到的 2 种气味。' },
    { num: 1, text: '你现在能感受到的 1 个身体部位。' },
  ];

  const page = el('div', { className: 'page' }, [
    renderParagraphs('当脑子一直在想坏结果时，我们先把自己带回当下。\n\n请慢慢找：'),
    el('div', { className: 'anchor-steps' }, anchors.map((a) =>
      el('div', { className: 'anchor-item' }, [
        el('span', { className: 'anchor-num', textContent: String(a.num) }),
        el('span', { className: 'anchor-text', textContent: a.text }),
      ])
    )),
    renderParagraphs('焦虑会把人拖到未来。\n但你现在在这里。\n这一刻，你正在回来。'),
    renderBtn('我完成了', 'btn-primary', () => navigate('anxiety-score')),
  ]);

  mainEl.replaceChildren(page);
}

function renderAnxietyScore() {
  setTitle('现在的焦虑大概有多少？');
  showBack(true);

  const page = el('div', { className: 'page' });
  page.append(
    renderParagraphs('不用判断得很精确。\n凭直觉选一个数字就好。'),
    el('div', { className: 'score-labels' }, [
      el('span', { textContent: '0 = 完全不焦虑' }),
      el('span', { textContent: '10 = 快要撑不住了' }),
    ])
  );

  const feedbackBox = el('div', { className: 'feedback-box', hidden: true });
  const grid = el('div', { className: 'score-grid' });
  const nextBtn = renderBtn('下一步', 'btn-primary', () => navigate('questions'));
  nextBtn.hidden = true;
  nextBtn.style.marginTop = '8px';

  for (let i = 0; i <= 10; i++) {
    grid.appendChild(el('button', {
      className: 'score-btn',
      textContent: String(i),
      onClick: () => {
        state.anxietyScore = i;
        grid.querySelectorAll('.score-btn').forEach((b) => b.classList.remove('selected'));
        grid.querySelector(`.score-btn:nth-child(${i + 1})`).classList.add('selected');

        const fb = getScoreFeedback(i);
        feedbackBox.hidden = false;
        feedbackBox.replaceChildren(
          ...fb.text.split('\n').map((line) => el('p', { textContent: line }))
        );
        nextBtn.hidden = false;
      },
    }));
  }

  page.append(grid, feedbackBox, nextBtn);
  mainEl.replaceChildren(page);
}

function renderQuestions() {
  setTitle('我们把这团焦虑拆小一点');
  showBack(true);

  const q1 = el('textarea', {
    className: 'form-textarea',
    placeholder: '比如：明天要汇报 / 收到一条消息 / 想到未来 / 和别人吵架 / 不知道自己该怎么办',
    rows: '3',
  });
  const q2 = el('textarea', {
    className: 'form-textarea',
    placeholder: '比如：怕自己搞砸 / 怕被否定 / 怕失去关系 / 怕来不及 / 怕事情失控',
    rows: '3',
  });
  const q3 = el('textarea', {
    className: 'form-textarea',
    placeholder: '可以很小。比如：喝水 / 洗脸 / 列 3 个重点 / 发一条消息 / 先睡 20 分钟 / 暂时不做决定',
    rows: '3',
  });

  const onInputCheck = (e) => {
    if (checkInputCrisis(e.target.value)) e.target.value = '';
  };
  q1.addEventListener('input', onInputCheck);
  q2.addEventListener('input', onInputCheck);
  q3.addEventListener('input', onInputCheck);

  const page = el('div', { className: 'page' }, [
    renderParagraphs('你不用说得很完整。\n想到什么写什么就好。'),
    el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label', textContent: '刚刚是哪件事把你拽进焦虑里的？' }),
      q1,
    ]),
    el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label', textContent: '这件事里，你最担心发生什么？' }),
      q2,
    ]),
    el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label', textContent: '现在有没有一件你能做的小事？' }),
      q3,
    ]),
    el('p', {
      className: 'form-hint',
      innerHTML: '如果现在想不出来，也没关系。<br>你可以写：我现在只想先缓一缓。',
    }),
    renderBtn('生成此刻卡片', 'btn-primary', () => {
      if (checkInputCrisis(q1.value) || checkInputCrisis(q2.value) || checkInputCrisis(q3.value)) return;
      state.triggerEvent = q1.value.trim();
      state.mainWorry = q2.value.trim();
      state.smallAction = q3.value.trim();
      state.cardText = generateCard(state);
      state.sceneAUrl = null;
      state.sceneAOriginalUrl = null;
      state.sceneAPrompt = null;
      state.sceneBUrl = null;
      state.sceneBOriginalUrl = null;
      state.sceneBPrompt = null;
      state.sceneBMeta = null;
      state.sceneImageSource = null;
      state.sceneImageStatus = 'idle';
      state.activeScene = 'a';
      state.sceneBRevealed = false;
      state.sandPlayed = false;
      navigate('card');
    }),
  ]);

  mainEl.replaceChildren(page);
}

function renderSceneCard() {
  const card = el('div', { className: 'moment-card moment-card-scene' });
  card.appendChild(el('p', { className: 'scene-card-label', textContent: '此刻场景' }));
  card.appendChild(el('p', {
    className: 'scene-card-desc',
    textContent: isUsingAI()
      ? '图 A 是你此刻的角度；图 B 是另一个可能'
      : '图 A 是你此刻的角度；图 B 是另一个可能',
  }));

  const status = state.sceneImageStatus;

  if (status === 'error') {
    const wrap = el('div', { className: 'scene-image-wrap scene-error-wrap' });
    wrap.appendChild(el('div', { className: 'scene-error' }, [
      el('p', { textContent: '场景图暂时没能画出来' }),
      el('button', {
        className: 'btn btn-secondary scene-retry-btn',
        textContent: '重新生成',
        onClick: () => startSceneGeneration(true),
      }),
    ]));
    card.appendChild(wrap);
    return card;
  }

  if (status === 'idle' || status === 'loading-a') {
    const wrap = el('div', { className: 'scene-image-wrap' });
    wrap.appendChild(el('div', { className: 'scene-loading' }, [
      el('div', { className: 'scene-loading-shimmer' }),
      el('p', { className: 'scene-loading-text', textContent: 'AI 正在描绘图 A（此刻的角度）…' }),
      el('p', { className: 'scene-loading-sub', textContent: '大约 15–30 秒' }),
    ]));
    card.appendChild(wrap);
    return card;
  }

  const flipContainer = el('div', {
    className: 'scene-flip-container',
    id: 'scene-flip-container',
  });
  const flipInner = el('div', {
    className: `scene-flip-inner${state.activeScene === 'b' ? ' flipped' : ''}`,
    id: 'scene-flip-inner',
  });

  const faceA = el('div', { className: 'scene-flip-face front' });
  faceA.appendChild(el('img', { className: 'scene-image', src: state.sceneAUrl, alt: '图A 此刻的角度' }));
  faceA.appendChild(el('span', { className: 'scene-tag', textContent: '图 A · 此刻的角度' }));
  flipInner.appendChild(faceA);

  const faceB = el('div', { className: 'scene-flip-face back' });
  if (state.sceneBUrl) {
    faceB.appendChild(el('img', { className: 'scene-image', src: state.sceneBUrl, alt: '图B 另一个可能' }));
    faceB.appendChild(el('span', { className: 'scene-tag scene-tag-b', textContent: '图 B · 另一个可能' }));
  } else {
    faceB.appendChild(el('div', { className: 'scene-loading scene-loading-inline' }, [
      el('div', { className: 'scene-loading-shimmer' }),
      el('p', { className: 'scene-loading-text', textContent: '图 B 正在形成…' }),
    ]));
  }
  flipInner.appendChild(faceB);
  flipContainer.appendChild(flipInner);

  if (status === 'ready' && state.sceneBRevealed) {
    flipContainer.addEventListener('click', () => toggleSceneView());
  }

  card.appendChild(flipContainer);

  if (status === 'loading-b') {
    card.appendChild(el('p', {
      className: 'scene-status-hint',
      textContent: '图 A 已就绪。正在理解你的困境，并描绘另一个角度…',
    }));
  }

  if (status === 'ready' && state.sceneBUrl && !state.sceneBRevealed) {
    card.appendChild(el('button', {
      className: 'btn btn-secondary scene-switch-btn',
      textContent: '看看另一个角度',
      onClick: (e) => {
        e.stopPropagation();
        revealSceneB();
      },
    }));
  }

  if (state.sceneBRevealed && state.sceneBMeta) {
    const meta = state.sceneBMeta;
    const cap = el('p', { className: 'scene-b-caption', textContent: meta.caption || '' });
    cap.hidden = state.activeScene !== 'b';
    if (meta.caption) card.appendChild(cap);
    card.appendChild(el('div', { className: 'scene-b-copy' }, [
      el('p', { className: 'scene-b-reframe', textContent: meta.reframe }),
      el('p', { className: 'scene-b-meaning', textContent: meta.meaningExplanation }),
    ]));
    card.appendChild(el('button', {
      className: 'btn btn-ghost scene-toggle-btn',
      textContent: state.activeScene === 'a' ? '翻到图 B · 另一个可能' : '回到图 A · 此刻的角度',
      onClick: (e) => {
        e.stopPropagation();
        toggleSceneView(true);
      },
    }));
  }

  return card;
}

async function revealSceneB() {
  if (!state.sceneBUrl || state.sceneBRevealed) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    state.sandPlayed = true;
    state.sceneBRevealed = true;
    state.activeScene = 'b';
    renderCard();
    return;
  }

  const container = document.getElementById('scene-flip-container');
  if (!container || state.sandPlayed) {
    state.sceneBRevealed = true;
    state.activeScene = 'b';
    renderCard();
    return;
  }

  const btn = container.parentElement?.querySelector('.scene-switch-btn');
  if (btn) btn.disabled = true;

  await playSandDissolve(container, state.sceneAUrl, state.sceneBUrl);
  state.sandPlayed = true;
  state.sceneBRevealed = true;
  state.activeScene = 'b';
  renderCard();
}

function toggleSceneView(useFlipOnly = false) {
  if (!state.sceneBUrl) return;
  if (!state.sceneBRevealed) {
    revealSceneB();
    return;
  }

  state.activeScene = state.activeScene === 'a' ? 'b' : 'a';
  const flipInner = document.getElementById('scene-flip-inner');
  if (flipInner) {
    toggleSceneFlip(flipInner, state.activeScene === 'b');
  } else {
    renderCard();
  }

  const toggleBtn = document.querySelector('.scene-toggle-btn');
  if (toggleBtn) {
    toggleBtn.textContent = state.activeScene === 'a'
      ? '翻到图 B · 另一个可能'
      : '回到图 A · 此刻的角度';
  }
  const cap = document.querySelector('.scene-b-caption');
  if (cap) cap.hidden = state.activeScene !== 'b';
  void useFlipOnly;
}

let sceneGenToken = 0;

async function startSceneGeneration(force = false) {
  if (!force && !['idle', 'error'].includes(state.sceneImageStatus)) return;

  const token = ++sceneGenToken;
  state.sceneImageStatus = 'loading-a';
  state.sceneAUrl = null;
  state.sceneBUrl = null;
  state.sceneBRevealed = false;
  state.sandPlayed = false;
  state.activeScene = 'a';

  if (currentPage() === 'card') renderCard();

  try {
    const resultA = await generateSceneImageA(state);
    if (token !== sceneGenToken) return;

    state.sceneAUrl = resultA.url;
    state.sceneAOriginalUrl = resultA.originalUrl || resultA.url;
    state.sceneAPrompt = resultA.prompt;
    state.sceneImageSource = resultA.source;
    state.sceneImageStatus = 'ready-a';

    if (currentPage() === 'card') renderCard();

    state.sceneImageStatus = 'loading-b';
    if (currentPage() === 'card') renderCard();

    const resultB = await generateSceneImageB(state);
    if (token !== sceneGenToken) return;

    state.sceneBUrl = resultB.url;
    state.sceneBOriginalUrl = resultB.originalUrl || resultB.url;
    state.sceneBPrompt = resultB.prompt;
    state.sceneBMeta = resultB.meta;
    state.sceneImageStatus = 'ready';

    if (currentPage() === 'card') renderCard();
  } catch {
    if (token !== sceneGenToken) return;
    state.sceneImageStatus = 'error';
    if (currentPage() === 'card') renderCard();
  }
}

function renderCard() {
  setTitle('这是你的此刻卡片');
  showBack(false);

  const cardContent = el('div', { className: 'moment-card' });
  cardContent.appendChild(el('p', { className: 'text-card-label', textContent: '此刻文字' }));
  state.cardText.split('\n').forEach((line) => {
    if (line === '') {
      cardContent.appendChild(el('div', { className: 'divider' }));
    } else {
      cardContent.appendChild(el('p', { textContent: line }));
    }
  });

  const page = el('div', { className: 'page card-page' }, [
    renderSceneCard(),
    cardContent,
    el('div', { className: 'btn-group' }, [
      renderBtn('保存这些卡片', 'btn-primary', () => {
        if (!state.saved) {
          saveRecord({
            emotion: '焦虑',
            bodyState: state.bodyState,
            calmingMethod: state.calmingMethod,
            anxietyScore: state.anxietyScore,
            triggerEvent: state.triggerEvent,
            mainWorry: state.mainWorry,
            smallAction: state.smallAction,
            cardText: state.cardText,
            sceneAUrl: state.sceneAOriginalUrl || state.sceneAUrl,
            sceneAPrompt: state.sceneAPrompt,
            sceneBUrl: state.sceneBOriginalUrl || state.sceneBUrl,
            sceneBPrompt: state.sceneBPrompt,
            sceneBMeta: state.sceneBMeta,
            sceneImageSource: state.sceneImageSource,
          });
          state.saved = true;
        }
        navigate('saved');
      }),
      renderBtn('再陪我待一会儿', 'btn-secondary', () => navigate('stay')),
      renderBtn('我现在好一点了', 'btn-ghost', goHome),
      renderBtn('返回首页', 'btn-ghost', goHome),
    ]),
  ]);

  mainEl.replaceChildren(page);

  if (state.sceneImageStatus === 'idle') {
    startSceneGeneration();
  }
}

function renderStay() {
  setTitle('好，我还在');
  showBack(true);

  const page = el('div', { className: 'page' }, [
    renderParagraphs('你不用马上离开。\n我们可以再安静地待一会儿。\n\n现在你可以选一个：'),
    el('div', { className: 'option-list' }, [
      el('button', {
        className: 'option-item',
        onClick: () => {
          state.afterCalming = 'stay';
          navigate('breathing');
        },
      }, [
        el('span', { className: 'option-num', textContent: '1' }),
        el('span', { textContent: '再做一次呼吸' }),
      ]),
      el('button', {
        className: 'option-item',
        onClick: () => navigate('feeling'),
      }, [
        el('span', { className: 'option-num', textContent: '2' }),
        el('span', { textContent: '写一句现在的感受' }),
      ]),
      el('button', {
        className: 'option-item',
        onClick: () => navigate('reminder'),
      }, [
        el('span', { className: 'option-num', textContent: '3' }),
        el('span', { textContent: '看一句轻轻的提醒' }),
      ]),
      el('button', {
        className: 'option-item',
        onClick: goHome,
      }, [
        el('span', { className: 'option-num', textContent: '4' }),
        el('span', { textContent: '回到首页' }),
      ]),
    ]),
  ]);

  mainEl.replaceChildren(page);
}

function renderFeeling() {
  setTitle('写一句现在的感受');
  showBack(true);

  const input = el('textarea', {
    className: 'form-textarea feeling-area',
    placeholder: '随便写几个字就好…',
    rows: '4',
  });
  input.addEventListener('input', (e) => {
    if (checkInputCrisis(e.target.value)) e.target.value = '';
  });

  const page = el('div', { className: 'page' }, [
    renderParagraphs('不用写得很完整。\n此刻最真实的感受就好。'),
    input,
    renderBtn('写好了', 'btn-primary', () => navigate('stay')),
  ]);

  mainEl.replaceChildren(page);
}

function renderReminder() {
  setTitle('轻轻的提醒');
  showBack(true);

  const page = el('div', { className: 'page' }, [
    el('div', { className: 'reminder-box' }, [
      el('p', { className: 'reminder-text', textContent: getRandomReminder() }),
    ]),
    el('div', { className: 'btn-group' }, [
      renderBtn('再看一句', 'btn-secondary', () => renderReminder()),
      renderBtn('回到陪伴页', 'btn-ghost', () => navigate('stay')),
    ]),
  ]);

  mainEl.replaceChildren(page);
}

function renderSaved() {
  setTitle('已经帮你保存好了');
  showBack(false);

  const page = el('div', { className: 'page' }, [
    renderParagraphs(
      '文字卡片和场景图（图 A + 图 B）都会留在你的此刻记录里。\n\n以后你也许会发现：\n很多难熬的时刻，后来真的被你一点点走过去了。'
    ),
    renderBtn('回到首页', 'btn-primary', goHome),
  ]);

  mainEl.replaceChildren(page);
}

function renderCrisis() {
  setTitle('现在，先保证你的安全');
  showBack(false);

  const smsText = '我现在状态很危险，可能会伤害自己。我需要你现在联系我，或者来陪我一下。请不要让我一个人待着。';

  const copyBtn = el('button', { className: 'copy-btn', textContent: '复制' });
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(smsText);
      copyBtn.textContent = '已复制';
      copyBtn.classList.add('copied');
    } catch {
      copyBtn.textContent = '请手动复制';
    }
  });

  const page = el('div', { className: 'page crisis-page' }, [
    renderParagraphs(
      '我很在意你现在的安全。\n\n如果你现在可能会伤害自己，或者已经处在危险中，请先不要一个人待着。\n\n现在最重要的不是把事情想明白，\n而是让你安全地度过这一刻。'
    ),
    el('div', { className: 'crisis-actions' }, [
      el('p', { className: 'highlight', textContent: '请立刻做下面三件事中的一件：', style: 'margin-bottom:12px;font-size:0.9rem;color:var(--text)' }),
      el('ol', {}, [
        el('li', { textContent: '拨打 110 或 120，寻求紧急帮助；' }),
        el('li', { textContent: '马上联系一个你信任的人，让 TA 现在陪你；' }),
        el('li', { textContent: '可尝试拨打 12356 心理援助热线，寻求专业支持。' }),
      ]),
    ]),
    el('p', { textContent: '可复制求助短信', style: 'font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px' }),
    el('div', { className: 'sms-box' }, [
      el('p', { className: 'sms-text', textContent: smsText }),
      copyBtn,
    ]),
    el('p', {
      className: 'footer-note',
      innerHTML: '你不用一个人撑过这一刻。<br>先让一个真实的人来到你身边。',
    }),
  ]);

  mainEl.replaceChildren(page);
}

const pages = {
  home: renderHome,
  emotions: renderEmotions,
  'coming-soon': renderComingSoon,
  'anxiety-entry': renderAnxietyEntry,
  'body-state': renderBodyState,
  breathing: renderBreathing,
  relaxation: renderRelaxation,
  walking: renderWalking,
  anchoring: renderAnchoring,
  'anxiety-score': renderAnxietyScore,
  questions: renderQuestions,
  card: renderCard,
  stay: renderStay,
  feeling: renderFeeling,
  reminder: renderReminder,
  saved: renderSaved,
  crisis: renderCrisis,
};

function render() {
  const page = currentPage();
  const theme = ['home', 'emotions', 'crisis'].includes(page) ? 'neutral' : (state.emotion || 'neutral');
  document.documentElement.dataset.emotion = theme;
  document.body.classList.toggle('is-welcome', page === 'home');
  document.getElementById('app-header').hidden = page === 'home';
  document.querySelector('meta[name="theme-color"]').content =
    getComputedStyle(document.documentElement).getPropertyValue('--bg-warm').trim();
  const renderer = pages[page];
  if (renderer) renderer();
  else goHome();
  window.scrollTo(0, 0);
}

render();
