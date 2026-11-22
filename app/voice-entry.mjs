const voiceAssets = new URL('./vendor/voice/', import.meta.url);
let modelPromise;

async function loadRussianModel() {
  if (!window.Vosk) await import(new URL('vosk-0.0.8.js', voiceAssets).href);
  const model = new window.Vosk.Model(new URL('ru-0.22.tar.gz', voiceAssets).href, -2);
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(reject, 90_000);
      const done = success => {
        clearTimeout(timer);
        if (success) resolve();
        else reject(new Error('Vosk model unavailable'));
      };
      model.on('load', event => done(event.result));
      model.on('error', () => done(false));
    });
    return model;
  } catch (error) {
    model.terminate();
    throw error;
  }
}

function getModel() {
  if (!modelPromise) modelPromise = loadRussianModel().catch(error => {
    modelPromise = undefined;
    throw error;
  });
  return modelPromise;
}

export function setupVoiceEntry(form) {
  const story = form.elements.story;
  const button = form.querySelector('#dictate-story');
  const status = form.querySelector('#dictation-status');
  let current;

  function idle(label = '') {
    button.textContent = 'Надиктовать день';
    button.setAttribute('aria-pressed', 'false');
    button.disabled = false;
    status.textContent = label;
  }

  function endAudio(session) {
    session.stream?.getTracks().forEach(track => track.stop());
    session.source?.disconnect();
    session.node?.disconnect();
    if (session.context && session.context.state !== 'closed') session.context.close().catch(() => {});
  }

  function close(session, message) {
    if (current !== session) return;
    current = undefined;
    endAudio(session);
    session.recognizer?.remove();
    clearTimeout(session.timer);
    session.resolveFinish?.();
    idle(message);
  }

  function append(session, words) {
    const text = words.trim();
    if (!text) return;
    const phrase = text.charAt(0).toLocaleUpperCase('ru') + text.slice(1);
    const separator = story.value && !/\s$/.test(story.value) ? ' ' : '';
    const combined = story.value + separator + phrase + '.';
    story.value = story.maxLength < 0 ? combined : combined.slice(0, story.maxLength);
    story.dispatchEvent(new Event('input', {bubbles:true}));
    session.hasWords = true;
    session.partial = '';
  }

  function cancel() {
    if (current) close(current, '');
  }

  function finish() {
    const session = current;
    if (!session) return Promise.resolve();
    if (!session.ready) {
      cancel();
      return Promise.resolve();
    }
    if (session.finishing) return session.finishing;
    session.finishing = new Promise(resolve => { session.resolveFinish = resolve; });
    button.disabled = true;
    status.textContent = 'Завершаем расшифровку…';
    session.node.port.postMessage('finish');
    session.timer = setTimeout(() => {
      append(session, session.partial);
      close(session, 'Распознавание завершилось досрочно. Проверьте текст.');
    }, 12_000);
    return session.finishing;
  }

  async function start() {
    const session = {partial:'', outstanding:0};
    current = session;
    status.textContent = 'Подготавливаем русскую модель. Речь обрабатывается на устройстве.';
    button.textContent = 'Отменить диктовку';
    try {
      const model = await getModel();
      if (current !== session) return;
      status.textContent = 'Разрешите браузеру доступ к микрофону.';
      const stream = await navigator.mediaDevices.getUserMedia({audio:{channelCount:1, echoCancellation:true, noiseSuppression:true}});
      if (current !== session) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      session.stream = stream;
      const context = new AudioContext({sampleRate:16000});
      session.context = context;
      await context.audioWorklet.addModule(new URL('./voice-worklet.mjs', import.meta.url));
      if (current !== session) return;
      const recognizer = new model.KaldiRecognizer(context.sampleRate);
      session.recognizer = recognizer;
      recognizer.on('result', ({result}) => {
        if (current !== session) return;
        append(session, result.text || '');
        if (session.sentFinal && session.outstanding === 0) {
          close(session, session.hasWords ? 'Готово. Текст можно отредактировать.' : 'Речь не распознана. Попробуйте ещё раз.');
        } else {
          session.outstanding--;
          if (!session.finishing) status.textContent = 'Слушаю. Остановите диктовку, когда закончите.';
        }
      });
      recognizer.on('partialresult', ({result}) => {
        if (current !== session) return;
        session.outstanding--;
        session.partial = result.partial || '';
        if (session.partial && !session.finishing) status.textContent = 'Слышу: ' + session.partial;
      });
      recognizer.on('error', () => {
        if (current === session) close(session, 'Не удалось распознать звук. Попробуйте ещё раз.');
      });
      session.source = context.createMediaStreamSource(stream);
      session.node = new AudioWorkletNode(context, 'ottisk-voice');
      session.node.port.onmessage = ({data}) => {
        if (current !== session) return;
        if (data === 'finished') {
          endAudio(session);
          session.sentFinal = true;
          recognizer.retrieveFinalResult();
        } else {
          session.outstanding++;
          recognizer.acceptWaveformFloat(data, context.sampleRate);
        }
      };
      session.source.connect(session.node).connect(context.destination);
      await context.resume();
      if (current !== session) return;
      session.ready = true;
      stream.getAudioTracks()[0]?.addEventListener('ended', () => {
        if (current === session) finish();
      });
      button.textContent = 'Остановить диктовку';
      button.setAttribute('aria-pressed', 'true');
      status.textContent = 'Слушаю. Остановите диктовку, когда закончите.';
    } catch (error) {
      const help = {
        NotAllowedError:'Доступ к микрофону закрыт. Разрешите его в настройках сайта или введите текст.',
        NotFoundError:'Браузер не нашёл микрофон. Подключите его или введите текст.',
        NotReadableError:'Микрофон недоступен. Проверьте устройство ввода или введите текст.'
      };
      close(session, help[error?.name] || 'Не удалось начать диктовку. Попробуйте ещё раз или введите текст.');
    }
  }

  idle('Можно продиктовать по-русски. Распознавание работает на устройстве.');
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode || !window.WebAssembly) {
    button.disabled = true;
    status.textContent = 'Для диктовки откройте дневник в современном браузере через localhost или HTTPS.';
  } else {
    button.addEventListener('click', () => { if (current) finish(); else start(); });
  }
  form.addEventListener('reset', () => { cancel(); if (!button.disabled) idle(); });
  form.closest('dialog')?.addEventListener('close', cancel);
  window.addEventListener('pagehide', cancel);
  return {finish, cancel};
}
