import {locale, serviceMessage, storyLanguage, t} from './i18n.mjs';
import {saveRecording} from './storage.mjs';
import {pickVoice, readingPace} from './feelings.mjs';

export const narratorControls = () => `
  <section class="narrator" aria-labelledby="narrator-title">
    <h3 id="narrator-title">${t("Озвучка записи")}</h3>
    <p class="hint">${t("Голос и общий темп подобраны по числам дня, паузы расставлены по тексту.")}</p>
    <p class="hint" id="narrator-pick"></p>
    <div class="narrator-settings">
      <label for="narrator-select">${t("Голос")} <select id="narrator-select" disabled></select></label>
      <button id="voice-preview" class="plain bordered" type="button" disabled>${t("Пример голоса")}</button>
    </div>
    <button id="voice" class="plain bordered" type="button" disabled>${t("Прочитать запись")}</button>
    <audio id="narrator-audio" controls preload="none" aria-label="${t("Озвучка записи")}" hidden></audio>
    <p id="narrator-status" class="hint" role="status"></p>
  </section>`;

export function mountNarrator(main, day, stopMusic, displayedStory = day.story) {
  const select=main.querySelector('#narrator-select');
  const read=main.querySelector('#voice');
  const sample=main.querySelector('#voice-preview');
  const audio=main.querySelector('#narrator-audio');
  const status=main.querySelector('#narrator-status');
  const preview=new Audio();
  let config={available:false,voices:[]};
  let currentURL;
  let busy=false;
  let disposed=false;
  let playWhenReady=false;
  const controller=new AbortController();
  const storyLang=storyLanguage(displayedStory);
  const speech=window.speechSynthesis;
  let spoken;
  const browserVoices=()=>speech?.getVoices().filter(voice=>voice.lang.split('-')[0]===storyLang) || [];
  const browserVoice=()=>browserVoices().find(voice=>voice.voiceURI===select.value);
  const voiceNames=new Map();

  function canUseDemo() {
    return Boolean(day.narration && day.narrationVoice && select.value===day.narrationVoice);
  }
  function hasRecording() {
    return day.voiceRecording?.voiceId===select.value && Boolean(day.voiceRecording?.blob);
  }
  function canSynthesize() {
    return config.available && config.voices.some(voice=>voice.id===select.value);
  }
  function syncButtons() {
    select.disabled=busy || select.options.length<2;
    sample.disabled=busy || !canSynthesize();
    read.disabled=busy || !(canSynthesize() || canUseDemo() || hasRecording() || browserVoice());
    if (busy) read.textContent=t('Готовим озвучку…');
    else if (!audio.paused || spoken) read.textContent=t('Пауза');
    else read.textContent=audio.hidden ? t('Озвучить этим голосом') : t('Прочитать запись');
    sample.textContent=preview.paused?t('Пример голоса'):t('Остановить пример');
  }
  function pause() {
    playWhenReady=false;
    if (spoken) {
      spoken=undefined;
      speech.cancel();
      syncButtons();
    }
    preview.pause();
    audio.pause();
  }
  function setTrack() {
    audio.pause();
    audio.removeAttribute('src');
    if (currentURL) URL.revokeObjectURL(currentURL);
    currentURL=null;
    if (hasRecording()) {
      currentURL=URL.createObjectURL(day.voiceRecording.blob);
      audio.src=currentURL;
    } else if (canUseDemo()) audio.src=day.narration;
    audio.hidden=!audio.hasAttribute('src');
    audio.load();
    syncButtons();
  }

  async function persist(recording) {
    day.voiceRecording=recording;
    try {await saveRecording(day.id,recording);}
    catch {if(!disposed) status.textContent=t('Озвучка доступна в этой вкладке. Для сохранения скачайте папку дня.');}
  }

  async function loadChoices() {
    try {
      const response=storyLang==='ru' && await fetch('/api/voice/status',{cache:'no-store',signal:controller.signal});
      if (response?.ok) {
        const server=await response.json();
        if (Array.isArray(server.voices)) config=server;
      }
    } catch { /* A previously saved recording can also play offline. */ }
    if (disposed) return;
    paintChoices();
  }

  function paintChoices() {
    if (disposed) return;
    const previous = select.value;
    const choices=new Map(config.voices.map(voice=>[voice.id,voice.name]));
    if (day.narration && day.narrationVoice) {
      const name = day.narrationVoiceName || day.narrationVoice;
      choices.set(day.narrationVoice,storyLang==='ru' ? name : name + ' · ' + t('Озвучка примера на русском'));
    }
    if (day.voiceRecording) choices.set(day.voiceRecording.voiceId,day.voiceRecording.voiceName);
    for (const voice of browserVoices()) choices.set(voice.voiceURI, voice.name + ' · ' + t('Голос браузера'));
    voiceNames.clear();
    select.replaceChildren();
    // The system proposes a voice from the day's numbers; a saved or bundled reading keeps its own.
    const suggested=pickVoice(day.imprint.feelings,[...choices.keys()]);
    for (const [id,name] of choices) {
      voiceNames.set(id,name);
      select.add(new Option(id===suggested?.id ? name+t(' · подобран') : name,id));
    }
    if (choices.size) select.value=choices.has(previous) ? previous : day.voiceRecording?.voiceId || (storyLang!=='ru' && browserVoices()[0]?.voiceURI) || day.narrationVoice || suggested?.id || config.defaultVoice || choices.keys().next().value;
    if (suggested) main.querySelector('#narrator-pick').textContent=t`По числам дня подходит голос «${choices.get(suggested.id)}»: ${t(suggested.why)}.`;
    else if (!choices.size) select.add(new Option(t('Нет установленных голосов'),''));
    if (storyLang==='ru' && !config.available) status.textContent=t('Для выбора локальных голосов установите речевую модель по инструкции проекта.');
    else if (!choices.size) status.textContent=t('Для этого языка нет подходящего голоса браузера.');
    else if (browserVoice()) status.textContent=t('Озвучка браузера воспроизводится в этой вкладке.');
    setTrack();
  }

  select.addEventListener('change',()=>{
    pause();
    setTrack();
    status.textContent=hasRecording() || canUseDemo() ? '' : browserVoice()
      ? t('Озвучка браузера воспроизводится в этой вкладке.') : t('При чтении выбранная озвучка сохранится с записью.');
  });
  sample.addEventListener('click',async()=>{
    if (!preview.paused) { preview.pause(); return; }
    pause();
    stopMusic();
    preview.src='./media/voice-samples/'+encodeURIComponent(select.value)+'.mp3';
    try {await preview.play();}
    catch (error) {if (!disposed && error.name!=='AbortError') status.textContent=t('Не удалось воспроизвести пример.');}
  });
  preview.addEventListener('play',syncButtons);
  preview.addEventListener('pause',syncButtons);
  preview.addEventListener('ended',syncButtons);

  audio.addEventListener('play',()=>{
    stopMusic();
    preview.pause();
    syncButtons();
  });
  audio.addEventListener('pause',syncButtons);
  audio.addEventListener('ended',syncButtons);
  audio.addEventListener('error',()=>{
    if (!disposed && audio.hasAttribute('src')) status.textContent=t('Не удалось открыть озвучку. Выберите другой голос или повторите позже.');
  });

  read.addEventListener('click',async()=>{
    if (busy) return;
    if (!audio.paused || spoken) { pause(); return; }
    const voice=browserVoice();
    if (voice) {
      stopMusic();
      preview.pause();
      const utterance=new SpeechSynthesisUtterance(displayedStory);
      utterance.lang=locale(storyLang);
      utterance.voice=voice;
      utterance.rate=readingPace(day.imprint.feelings);
      utterance.onend=utterance.onerror=()=>{if (spoken===utterance) {spoken=undefined;syncButtons();}};
      spoken=utterance;
      speech.speak(utterance);
      syncButtons();
      return;
    }
    preview.pause();
    stopMusic();
    status.textContent='';
    playWhenReady=true;
    try {
      if (!hasRecording() && !canUseDemo()) {
        busy=true;
        syncButtons();
        status.textContent=t('Голос читает рассказ с учётом его фраз и пунктуации…');
        const voiceId=select.value;
        const response=await fetch('/api/voice/render',{
          method:'POST', headers:{'Content-Type':'application/json'}, signal:controller.signal,
          body:JSON.stringify({text:day.story,voice:voiceId,pace:readingPace(day.imprint.feelings)})
        });
        if (!response.ok) {
          const info=await response.json().catch(()=>({}));
          throw Error(serviceMessage(info.message, 'Озвучка не удалась. Попробуйте ещё раз.'));
        }
        const blob=await response.blob();
        if (disposed) return;
        if (!blob.type.startsWith('audio/') || !blob.size) throw Error(t('Не удалось получить звуковую дорожку.'));
        status.textContent=t('Готово. Озвучка будет в папке дня.');
        await persist({voiceId,voiceName:voiceNames.get(voiceId),model:config.model,blob,storyRevision:day.storyRevision});
        if (!disposed) setTrack();
      } else if (canUseDemo() && day.voiceRecording && !hasRecording()) {
        await persist(null);
      }
      if (!disposed && playWhenReady) await audio.play();
    } catch (error) {
      if (!disposed && error.name!=='AbortError') status.textContent=error.name==='NotAllowedError'
        ? t('Озвучка готова. Нажмите воспроизведение.') : error.message;
    } finally {busy=false;if (!disposed) syncButtons();}
  });
  // Native controls can also start a bundled voice after another was saved.
  audio.addEventListener('play',()=>{
    if (canUseDemo() && day.voiceRecording && !hasRecording()) void persist(null);
  });

  speech?.addEventListener('voiceschanged',paintChoices);
  loadChoices();
  return {pause,dispose() {
    disposed=true;
    controller.abort();
    speech?.removeEventListener('voiceschanged',paintChoices);
    pause();
    preview.removeAttribute('src');
    preview.load();
    audio.removeAttribute('src');
    audio.load();
    if (currentURL) URL.revokeObjectURL(currentURL);
  }};
}
