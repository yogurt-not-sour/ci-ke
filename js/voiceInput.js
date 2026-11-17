let activeSession = null;
let nextId = 0;

export function stopVoiceInput() {
  activeSession?.cancel();
}

// A session owns its callbacks so late results cannot write into another page.
export function createVoiceInput(input, label) {
  const root = document.createElement('div');
  root.className = 'voice-input';
  const row = document.createElement('div');
  row.className = 'voice-actions';
  const status = document.createElement('p');
  status.className = 'voice-status';
  status.id = `voice-status-${++nextId}`;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = Boolean(Recognition && window.isSecureContext);

  function button(text, iconName) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'voice-button';
    const icon = document.createElement('img');
    icon.src = `assets/icons/${iconName}.svg`;
    icon.alt = '';
    icon.width = 18;
    icon.height = 18;
    const caption = document.createElement('span');
    caption.textContent = text;
    node.append(icon, caption);
    node.setAttribute('aria-describedby', status.id);
    return node;
  }

  const mic = button(supported ? '语音输入' : '键盘语音输入', 'mic');
  mic.setAttribute('aria-label', `${label}：${supported ? '语音输入' : '键盘语音输入'}`);
  mic.setAttribute('aria-pressed', 'false');
  const keyboard = button('键盘语音', 'keyboard');
  keyboard.hidden = !supported;
  keyboard.addEventListener('click', focusKeyboard);
  input.addEventListener('input', event => {
    if (event.isTrusted && activeSession?.input === input) stopVoiceInput();
  });
  const privacy = document.createElement('p');
  privacy.className = 'voice-privacy';
  privacy.textContent = supported
    ? '语音识别由浏览器提供，音频可能发送至其语音服务。'
    : '当前浏览器不支持直接语音识别，可使用手机输入法的语音功能。';
  root.append(row, status, privacy);
  row.append(mic, keyboard);

  function focusKeyboard() {
    stopVoiceInput();
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    status.textContent = '请点手机键盘上的麦克风，再说出你的回答；电脑上可使用系统听写。';
  }

  function display(recording, starting = false) {
    mic.classList.toggle('is-listening', recording);
    mic.setAttribute('aria-pressed', String(recording));
    const text = recording ? (starting ? '取消等待' : '结束说话') : '语音输入';
    mic.querySelector('span').textContent = text;
    mic.querySelector('img').src = `assets/icons/${recording ? 'square' : 'mic'}.svg`;
    mic.setAttribute('aria-label', `${label}：${text}`);
  }

  mic.addEventListener('click', () => {
    if (!supported) { focusKeyboard(); return; }
    if (activeSession?.input === input) { activeSession.finish(); return; }
    stopVoiceInput();
    let recognition;
    try { recognition = new Recognition(); } catch {
      status.textContent = '当前浏览器无法使用语音服务，请使用键盘语音。';
      return;
    }
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    const before = input.value;
    let heard = false;
    let failed = false;
    let finished = false;
    let startTimer;
    let limitTimer;
    let endTimer;
    const session = {
      input,
      cancel() {
        if (activeSession !== session) return;
        clean();
        try { recognition.abort(); } catch { /* Already ended. */ }
      },
      finish() {
        if (finished) return;
        finished = true;
        clearTimeout(startTimer);
        clearTimeout(limitTimer);
        display(true);
        mic.disabled = true;
        status.textContent = '正在整理刚刚的话…';
        try { recognition.stop(); } catch { clean(); }
        endTimer = setTimeout(() => {
          if (activeSession !== session) return;
          session.cancel();
          status.textContent = heard ? '已填入，可以修改或继续说。' : '没有识别到声音，可以重试或使用键盘语音。';
        }, 3000);
      },
    };
    function clean() {
      clearTimeout(startTimer);
      clearTimeout(limitTimer);
      clearTimeout(endTimer);
      recognition.onstart = recognition.onresult = recognition.onerror = recognition.onend = null;
      if (activeSession === session) activeSession = null;
      mic.disabled = false;
      display(false);
    }
    activeSession = session;
    display(true, true);
    status.textContent = '正在连接麦克风，请允许浏览器使用麦克风…';
    recognition.onstart = () => {
      if (activeSession !== session || finished) return;
      clearTimeout(startTimer);
      display(true);
      status.textContent = '正在听，你可以慢慢说。';
      limitTimer = setTimeout(() => session.finish(), 60000);
    };
    recognition.onresult = event => {
      if (activeSession !== session || !input.isConnected) return;
      // Rebuild the current utterance to replace interim words instead of duplicating them.
      const spoken = Array.from(event.results, result => result[0]?.transcript || '').join('');
      if (!spoken.trim()) return;
      heard = true;
      input.value = before + (before && !/\s$/.test(before) ? '\n' : '') + spoken;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    recognition.onerror = event => {
      if (activeSession !== session) return;
      failed = true;
      const messages = {
        'not-allowed': '麦克风未获授权。可在浏览器设置中允许，或使用键盘语音。',
        'service-not-allowed': '当前浏览器无法使用语音识别服务，请使用键盘语音。',
        'audio-capture': '无法使用麦克风，请检查是否被其他应用占用，或使用键盘语音。',
        network: '语音服务连接失败，已保留文字。可以重试或使用键盘语音。',
        'no-speech': '没有听清，可以重新说一次，或使用键盘语音。',
      };
      status.textContent = messages[event.error] || '本次语音未完成，已保留文字。可重试或使用键盘语音。';
      session.cancel();
    };
    recognition.onend = () => {
      if (activeSession !== session) return;
      clean();
      if (!failed) status.textContent = heard ? '已填入，可以修改或继续说。' : '没有识别到声音，可以重试或使用键盘语音。';
    };
    startTimer = setTimeout(() => {
      if (activeSession !== session) return;
      status.textContent = '语音服务暂时没有响应，可重试或使用键盘语音。';
      session.cancel();
    }, 15000);
    try { recognition.start(); } catch {
      status.textContent = '无法启动语音输入，可重试或使用键盘语音。';
      session.cancel();
    }
  });
  return root;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopVoiceInput();
});
window.addEventListener('pagehide', stopVoiceInput);
