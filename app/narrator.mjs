import {saveRecording} from './storage.mjs';
import {pickVoice, readingPace} from './feelings.mjs';

export const narratorControls = `
  <section class="narrator" aria-labelledby="narrator-title">
    <h3 id="narrator-title">Озвучка записи</h3>
    <p class="hint">Голос и общий темп подобраны по числам дня, паузы расставлены по тексту.</p>
    <p class="hint" id="narrator-pick"></p>
    <div class="narrator-settings">
      <label for="narrator-select">Голос <select id="narrator-select" disabled></select></label>
      <button id="voice-preview" class="plain bordered" type="button" disabled>Пример голоса</button>
    </div>
    <button id="voice" class="plain bordered" type="button" disabled>Прочитать запись</button>
    <audio id="narrator-audio" controls preload="none" aria-label="Озвучка записи" hidden></audio>
    <p id="narrator-status" class="hint" role="status"></p>
  </section>`;

export function mountNarrator(main, day, stopMusic) {
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
    read.disabled=busy || !(canSynthesize() || canUseDemo() || hasRecording());
    if (busy) read.textContent='Готовим озвучку…';
    else if (!audio.paused) read.textContent='Пауза';
    else read.textContent=audio.hidden ? 'Озвучить этим голосом' : 'Прочитать запись';
    sample.textContent=preview.paused?'Пример голоса':'Остановить пример';
  }
  function pause() {
    playWhenReady=false;
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
    catch {if(!disposed) status.textContent='Озвучка доступна в этой вкладке. Для сохранения скачайте папку дня.';}
  }

  async function loadChoices() {
    try {
      const response=await fetch('/api/voice/status',{cache:'no-store',signal:controller.signal});
      if (response.ok) {
        const server=await response.json();
        if (Array.isArray(server.voices)) config=server;
      }
    } catch { /* A previously saved recording can also play offline. */ }
    if (disposed) return;
    const choices=new Map(config.voices.map(voice=>[voice.id,voice.name]));
    if (day.narration && day.narrationVoice) choices.set(day.narrationVoice,day.narrationVoiceName || day.narrationVoice);
    if (day.voiceRecording) choices.set(day.voiceRecording.voiceId,day.voiceRecording.voiceName);
    // The system proposes a voice from the day's numbers; a saved or bundled reading keeps its own.
    const suggested=pickVoice(day.imprint.feelings,[...choices.keys()]);
    for (const [id,name] of choices) select.add(new Option(id===suggested?.id ? name+' · подобран' : name,id));
    if (choices.size) select.value=day.voiceRecording?.voiceId || day.narrationVoice || suggested?.id || config.defaultVoice || choices.keys().next().value;
    if (suggested) main.querySelector('#narrator-pick').textContent=`По числам дня подходит голос «${choices.get(suggested.id)}»: ${suggested.why}.`;
    else select.add(new Option('Нет установленных голосов',''));
    if (!config.available) status.textContent='Для выбора локальных голосов установите речевую модель по инструкции проекта.';
    setTrack();
  }

  select.addEventListener('change',()=>{
    pause();
    setTrack();
    status.textContent=hasRecording() || canUseDemo()?'':'При чтении выбранная озвучка сохранится с записью.';
  });
  sample.addEventListener('click',async()=>{
    if (!preview.paused) { preview.pause(); return; }
    pause();
    stopMusic();
    preview.src='./media/voice-samples/'+encodeURIComponent(select.value)+'.mp3';
    try {await preview.play();}
    catch (error) {if (!disposed && error.name!=='AbortError') status.textContent='Не удалось воспроизвести пример.';}
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
    if (!disposed && audio.hasAttribute('src')) status.textContent='Не удалось открыть озвучку. Выберите другой голос или повторите позже.';
  });

  read.addEventListener('click',async()=>{
    if (busy) return;
    if (!audio.paused) { audio.pause(); return; }
    preview.pause();
    stopMusic();
    status.textContent='';
    playWhenReady=true;
    try {
      if (!hasRecording() && !canUseDemo()) {
        busy=true;
        syncButtons();
        status.textContent='Голос читает рассказ с учётом его фраз и пунктуации…';
        const voiceId=select.value;
        const response=await fetch('/api/voice/render',{
          method:'POST', headers:{'Content-Type':'application/json'}, signal:controller.signal,
          body:JSON.stringify({text:day.story,voice:voiceId,pace:readingPace(day.imprint.feelings)})
        });
        if (!response.ok) {
          const info=await response.json().catch(()=>({}));
          throw Error(info.message || 'Озвучка не удалась. Попробуйте ещё раз.');
        }
        const blob=await response.blob();
        if (disposed) return;
        if (!blob.type.startsWith('audio/') || !blob.size) throw Error('Не удалось получить звуковую дорожку.');
        status.textContent='Готово. Озвучка будет в папке дня.';
        await persist({voiceId,voiceName:select.selectedOptions[0].text.replace(' · подобран',''),model:config.model,blob});
        if (!disposed) setTrack();
      } else if (canUseDemo() && day.voiceRecording && !hasRecording()) {
        await persist(null);
      }
      if (!disposed && playWhenReady) await audio.play();
    } catch (error) {
      if (!disposed && error.name!=='AbortError') status.textContent=error.name==='NotAllowedError'
        ? 'Озвучка готова. Нажмите воспроизведение.' : error.message;
    } finally {busy=false;if (!disposed) syncButtons();}
  });
  // Native controls can also start a bundled voice after another was saved.
  audio.addEventListener('play',()=>{
    if (canUseDemo() && day.voiceRecording && !hasRecording()) void persist(null);
  });

  loadChoices();
  return {pause,dispose() {
    disposed=true;
    controller.abort();
    pause();
    preview.removeAttribute('src');
    preview.load();
    audio.removeAttribute('src');
    audio.load();
    if (currentURL) URL.revokeObjectURL(currentURL);
  }};
}
