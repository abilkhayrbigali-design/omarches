import {audioStats, linkMusic, makeImprint, photoStats} from './atmosphere.mjs';
import {mountNarrator, narratorControls} from './narrator.mjs';
import {deleteDay, loadDays, saveDay, saveRecording, loadRecordings} from './storage.mjs';
import {demos} from './demos.mjs';
import {setupMusicPicker} from './music-picker.mjs';
import {setupImagePicker} from './image-picker.mjs';
import {setupVoiceEntry} from './voice-entry.mjs';
import {downloadArchive, downloadDay} from './export.mjs';
import {IDS, emptyFeelings, feelingLabel, feelingName, foldDiary, localReading, siteTokens} from './feelings.mjs';
import {escape, layersHTML, motifSVG, number, pairsHTML, rulesHTML, sceneHTML, sceneStyle, stampSVG, themeVars, tuneHTML} from './scene.mjs';
import {readStory, readingStatus} from './reading.mjs';

const root = document.documentElement;
const main = document.querySelector('#main');
const editor = document.querySelector('#editor');
const form = document.querySelector('#day-form');
const musicPicker = setupMusicPicker(form);
const voiceEntry = setupVoiceEntry(form);
const imagePicker = setupImagePicker(form);
const alert = document.querySelector('#form-error');
const submit = form.querySelector('[type=submit]');
const dateFormat = new Intl.DateTimeFormat('ru-RU',{day:'numeric', month:'long', year:'numeric', timeZone:'UTC'});
const formatDate = date => dateFormat.format(new Date(date+'T12:00:00Z')).replace(' г.','');
const localDate = () => {
  const now = new Date();
  return [now.getFullYear(), now.getMonth()+1, now.getDate()].map(x=>String(x).padStart(2,'0')).join('-');
};
const href = id => '#day/'+encodeURIComponent(id);
const genitive = {joy:'радости', sadness:'грусти', calm:'покоя', tension:'напряжения', festive:'праздника', quiet:'тишины', warmth:'тепла', solitude:'уединения'};
let days = [];
let renderCleanup = () => {};
let noticeTimer;
let busy = false;
let step = 1;
let model = {available:false, model:''};

const announce = message => {
  clearTimeout(noticeTimer);
  const notice = document.querySelector('#status');
  notice.textContent=message;
  notice.hidden=false;
  noticeTimer=setTimeout(()=>notice.hidden=true,4500);
};

// The whole diary, oldest day first: every day moves the eight numbers a little.
function diary() {
  const ordered=[...days].sort((a,b)=>a.date.localeCompare(b.date)||a.created-b.created);
  return {...foldDiary(ordered.map(day=>day.imprint.feelings)), latest:ordered.at(-1)};
}

// Colour, type and shape of the site come from numbers: the diary's on the
// archive page, the open day's on its own page. The mark is always the diary.
function applyTheme(feelings, options) {
  const tokens=siteTokens(feelings, options);
  const vars=themeVars(tokens);
  for (const [name,value] of Object.entries(vars)) root.style.setProperty(name,value);
  root.dataset.face=tokens.face;
  document.querySelector('meta[name=theme-color]').content=vars['--paper'];
  document.querySelector('#brand-mark').innerHTML=stampSVG(diary().state,{title:'Оттиск дневника'});
}

function leadLine(mood) {
  if (!mood.lead) return 'Сейчас дневник ровный: ни одно чувство не ведёт.';
  const label=feelingLabel(mood.state,mood.lead,mood.second).toLowerCase();
  return `Сейчас в дневнике ${label.includes(' и ')?'ведут':'ведёт'} ${label}.`;
}

function shiftLine(mood) {
  if (!mood.latest) return '';
  const changes=IDS.map(id=>({id,change:mood.state[id]-mood.previous[id]})).filter(item=>Math.abs(item.change)>=.02)
    .sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,3);
  if (!changes.length) return `Запись «${escape(mood.latest.imprint.title)}» почти не сдвинула числа.`;
  const parts=changes.map(({id,change})=>`${change>0?'прибавила':'убавила'} ${genitive[id]} на ${number(Math.abs(change))}`);
  return `Запись «${escape(mood.latest.imprint.title)}» ${parts.join(', ')}.`;
}

function renderArchive(photo) {
  const mood=diary();
  applyTheme(mood.state,{keep:mood.lead,keepSecond:mood.second});
  const [lead] = days;
  if (!lead) {
    main.innerHTML = '<section class="welcome first"><h1>Дневник ощущений</h1><p>Здесь пока нет ни одного дня. Расскажите, каким он был, добавьте фото и песню, и дневник соберёт из них воспоминание.</p><button class="primary" id="first-day">Записать день</button></section>';
    main.querySelector('#first-day').addEventListener('click',openEditor);
    return;
  }
  main.innerHTML = `
    <section class="welcome"><h1>Дневник ощущений</h1><p>Фотографии, слова и музыка. То, каким запомнился день.</p></section>
    <a href="${href(lead.id)}" class="featured" data-face="${lead.imprint.face}" data-place="${lead.imprint.place}" style="${sceneStyle(lead.imprint)}" aria-label="Открыть день: ${escape(lead.imprint.title)}">
      <div class="frames"><img class="frame visible" src="${escape(photo(lead,lead.id==='maple'?2:0))}" alt=""></div>${layersHTML(lead.imprint,lead.id)}
      <div class="featured-text"><span class="eyebrow">Последняя запись</span><h2>${escape(lead.imprint.title)}</h2><p>${formatDate(lead.date)} <span class="separator">·</span> ${lead.imprint.moodName}</p><span class="feature-action">Пережить день</span></div>
    </a>
    <section class="diary-mood" aria-labelledby="mood-title">
      <div class="mood-stamp">${stampSVG(mood.state,{labels:true,title:'Оттиск дневника: восемь чисел настроения'})}</div>
      <div class="mood-text"><h2 id="mood-title">Настроение дневника</h2>
        <p class="mood-line">${leadLine(mood)} ${shiftLine(mood)}</p>
        ${pairsHTML(mood.state,mood.previous)}
        <p class="hint">Каждая запись сдвигает числа понемногу. Чувство, которое вело день, заодно теснит свою противоположность: после грустного дня радости становится меньше, а грусти больше. От этих чисел зависят цвет, шрифт и форма дневника.</p>
      </div>
    </section>
    <section class="archive" id="archive" aria-labelledby="archive-title" tabindex="-1">
       <div class="section-title"><div><h2 id="archive-title">Архив дней</h2><p id="count"></p></div><div class="archive-actions"><label class="sr-only" for="search">Поиск по дневнику</label><input id="search" type="search" placeholder="Найти день"><button class="plain bordered" id="export-archive" type="button">Скачать архив</button></div></div>
       <div class="grid" id="archive-grid"></div>
    </section>`;
  const search = main.querySelector('#search');
  const grid = main.querySelector('#archive-grid');
  const update = () => {
    const query=search.value.toLocaleLowerCase('ru').trim().split(/\s+/);
    const filtered=days.filter(day=>{
      const fields=[day.imprint.title,day.imprint.moodName,day.story,day.music.track,day.date,formatDate(day.date)].join(' ').toLocaleLowerCase('ru');
      return query.every(word=>fields.includes(word));
    });
    const unit = {one:'запись',few:'записи',many:'записей'}[new Intl.PluralRules('ru').select(filtered.length)];
    main.querySelector('#count').textContent=`${filtered.length} ${unit}`;
    grid.innerHTML = filtered.length ? filtered.map(day=>`
      <a class="day-card" href="${href(day.id)}" aria-label="Открыть день: ${escape(day.imprint.title)}"><div class="thumb" style="${sceneStyle(day.imprint)}"><div class="frames"><img class="frame visible" src="${escape(photo(day,0))}" alt="" loading="lazy"></div><div class="wash"></div><div class="leak"></div><div class="grain"></div><span class="mood-label">${stampSVG(day.imprint.feelings,{title:day.imprint.moodName})}${day.imprint.moodName}</span></div><div class="card-caption"><time datetime="${day.date}">${formatDate(day.date)}</time><h3>${escape(day.imprint.title)}</h3></div></a>
    `).join('') : '<p class="empty">Ничего не найдено. Попробуйте другое слово или дату.</p>';
  };
  search.addEventListener('input',update);
  main.querySelector('#export-archive').addEventListener('click', async event=>{
    const button=event.currentTarget;
    button.disabled=true;
    try { await downloadArchive(days); announce('Архив скачан.'); }
    catch { announce('Не удалось скачать архив. Попробуйте скачать отдельный день.'); }
    finally { button.disabled=false; }
  });
  update();
}

function sourceLine(day) {
  const reading=day.reading;
  const who=reading.source==='ai' ? `Запись прочитала модель ${escape(reading.model)}.`
    : reading.source==='manual' ? 'Числа поправлены вручную.'
    : reading.fallback ? 'Модель не ответила, поэтому настроение оценил словарь на устройстве.'
    : 'Настроение оценил словарь на устройстве.';
  return `${who}${reading.source==='ai' && reading.reason ? ' '+escape(reading.reason) : ''}`;
}

// Which numbers moved between two readings of the same day, largest first.
function shifts(from, to) {
  return IDS.map(id=>({id,change:to[id]-from[id]})).filter(item=>Math.abs(item.change)>=.02)
    .sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,4)
    .map(({id,change})=>`${feelingName(id).toLowerCase()} ${change>0?'↑':'↓'}\u2009${number(Math.abs(change))}`);
}

function framesLine(day) {
  const {imprint}=day;
  const moved=shifts(imprint.text,imprint.pictured);
  return `${day.frameOrigins?.some(frame=>frame.type==='generated')?'В сцене есть иллюстрация, созданная по рассказу. ':''}<span class="swatch" style="--sample:${imprint.photoHue} ${imprint.photoSat}% ${Math.max(28,Math.round(imprint.light))}%"></span> Оттенок кадра смешан с цветом ведущего чувства, светлота ${Math.round(imprint.light)}%. `
    + (moved.length ? `Теплота цвета, плотность и свет кадров сдвинули числа: ${moved.join(', ')}.` : 'Числа кадры не сдвинули.');
}

function musicLine(day) {
  const {imprint,music}=day;
  const moved=shifts(imprint.pictured,imprint.feelings);
  const mode={major:'мажор',minor:'минор'}[music.analysis.mode];
  return `${music.origin!=='catalog'?'':music.analysis.heard?'Трек из каталога разобран по звуку. ':'Характер трека взят из его описания. '}Темп даёт ${imprint.duration.toLocaleString('ru',{maximumFractionDigits:1})} с на кадр.`
    + (mode ? ` Лад: ${music.analysis.key} ${mode}.` : (music.kind==='file' && music.origin!=='generated') || music.analysis.heard ? ' Лад не выражен ясно.' : '')
    + (moved.length ? ` Музыка сдвинула числа: ${moved.join(', ')}.` : ' Числа музыка не сдвинула.');
}

// Deleting is permanent, so it is always confirmed in a dialog.
function ask(title, text) {
  const dialog=document.querySelector('#confirm');
  dialog.querySelector('#confirm-title').textContent=title;
  dialog.querySelector('#confirm-text').textContent=text;
  dialog.returnValue='cancel';
  dialog.showModal();
  return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='ok'),{once:true}));
}

function renderDay(day, photo, fileURL) {
  const {music} = day;
  const count = day.photos?.length || day.photoSources.length;
  const sources = Array.from({length:count},(_,index)=>photo(day,index));
  const inlineAudio = music.kind !== 'link';
  const musicSource=music.kind==='file'?fileURL(music.blob):music.source;
  applyTheme(day.imprint.feelings,{hue:day.imprint.hue});
  main.innerHTML = `
    <div class="day-toolbar"><a class="back" href="#archive">Архив дней</a><div class="day-actions">${day.demo?'':'<button class="plain" id="edit-text" type="button">Изменить текст</button><button class="plain" id="delete-day" type="button">Удалить день</button>'}<button class="plain bordered" id="download" type="button">Скачать папку дня</button></div></div>
    <article aria-labelledby="day-heading">${sceneHTML(day,sources,formatDate(day.date))}
    <div class="transport"><button class="primary" type="button" id="play" aria-pressed="false">Воспроизвести</button><div class="track"><strong>${escape(music.track)}</strong><span>${music.analysis.bpm ? (music.kind==='link'?'Около ':'')+music.analysis.bpm+' уд/мин':'Свободный ритм'}</span>
      ${music.rights?`<span title="${escape(music.rights.description)}">${escape(music.rights.label)}</span>`:''}</div>
    ${inlineAudio?`<audio controls preload="${music.kind==='remote'?'none':'metadata'}" src="${escape(musicSource)}" aria-label="Песня дня"></audio>`:`<a class="plain bordered" target="_blank" rel="noopener noreferrer" href="${escape(music.url)}">Открыть песню</a>`}</div>
    ${music.origin==='catalog'?`<p class="catalog-links">${escape(music.artist)} · <a href="${escape(music.sourceUrl)}" target="_blank" rel="noopener noreferrer">Страница трека</a> · <a href="${escape(music.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escape(music.license)}</a>. Музыка играет через интернет.</p>`:''}
    <div class="notes"><section><h2>Запись дня</h2><p class="story" id="story-text">${escape(day.story)}</p>
      <form id="story-form" hidden><label class="sr-only" for="story-edit">Текст записи</label><textarea id="story-edit" maxlength="6000" rows="7"></textarea>
        <div class="form-bottom"><button class="plain bordered" type="button" id="story-cancel">Отмена</button><button class="primary" type="submit">Сохранить текст</button></div></form>
      ${narratorControls}</section>
      <section class="reading"><h2>Как собрана сцена</h2>
        <div class="mood-stamp" id="day-stamp"></div>
        <p class="reading-source" id="reading-source"></p>
        <div id="day-rules"></div>
        ${tuneHTML(day.reading.feelings)}
        <button class="plain bordered" id="reread" type="button" hidden>Прочитать запись через OpenAI</button>
        <dl><div><dt>Кадры</dt><dd id="frames-line"></dd></div>
        <div><dt>Музыка</dt><dd id="music-line"></dd></div></dl>
        <p class="hint">${day.demo?'Это пример: правки чисел действуют до перезагрузки страницы. ':''}Числа описывают текст записи, а не состояние автора.</p>
      </section></div>
    </article>`;

  const scene = main.querySelector('.memory');
  const frames = [...scene.querySelectorAll('.frame')];
  const dots = [...scene.querySelectorAll('.dot')];
  const audio = main.querySelector('.transport audio');
  const play = main.querySelector('#play');
  const tune = main.querySelector('.tune');
  const reread = main.querySelector('#reread');
  let interval;
  let current=0;
  let playing=false;
  const narrator=mountNarrator(main,day,()=>{audio?.pause();playback(false);});
  const composeButton=document.querySelector('#compose');
  composeButton.addEventListener('click',narrator.pause);

  // Everything that depends on the numbers is drawn here, so moving a slider redraws the day in place.
  function describe() {
    const {imprint}=day;
    main.querySelector('#day-stamp').innerHTML=stampSVG(imprint.feelings,{labels:true,title:'Оттиск дня: '+imprint.moodName});
    main.querySelector('#reading-source').innerHTML=sourceLine(day);
    main.querySelector('#day-rules').innerHTML=rulesHTML(imprint);
    main.querySelector('#frames-line').innerHTML=framesLine(day);
    main.querySelector('#music-line').textContent=musicLine(day);
    reread.hidden=!model.available || day.reading.source==='ai';
  }
  function restyle() {
    day.imprint=makeImprint(day.story,day.photoData,day.music.analysis,day.reading);
    const {imprint}=day;
    scene.style.cssText=sceneStyle(imprint);
    Object.assign(scene.dataset,{face:imprint.face,place:imprint.place,duration:imprint.duration});
    scene.querySelector('.motif').outerHTML=motifSVG(imprint,day.id);
    scene.querySelector('h1').textContent=imprint.title;
    scene.querySelector('.scene-text p').textContent=imprint.excerpt;
    document.title=`${imprint.title} — Оттиск`;
    describe();
    applyTheme(imprint.feelings,{hue:imprint.hue});
    if (playing) playback(true);
  }
  async function keep() {
    if (day.demo) return;
    const {voiceRecording,...record}=day;
    try { await saveDay(record); }
    catch { announce('Не удалось сохранить изменения в этом браузере.'); }
  }
  describe();
  tune.addEventListener('input',event=>{
    const input=event.target;
    if (input.type!=='range') return;
    input.nextElementSibling.textContent=number(input.value);
    day.reading={...day.reading,source:'manual',feelings:{...day.reading.feelings,[input.name]:Number(input.value)}};
    restyle();
  });
  tune.addEventListener('change',keep);
  reread.addEventListener('click',async()=>{
    reread.disabled=true;
    reread.textContent='Читаем запись…';
    const reading=await readStory(day.story,true);
    reread.disabled=false;
    reread.textContent='Прочитать запись через OpenAI';
    if (!main.contains(reread)) return;
    if (reading.source!=='ai') { announce('Модель не ответила. Числа остались прежними.'); return; }
    day.reading=reading;
    for (const input of tune.querySelectorAll('input')) {
      input.value=reading.feelings[input.name];
      input.nextElementSibling.textContent=number(input.value);
    }
    restyle();
    await keep();
  });

  function show(index) {
    frames[current].classList.remove('visible');
    dots[current]?.setAttribute('aria-pressed','false');
    current=index;
    frames[current].classList.add('visible');
    dots[current]?.setAttribute('aria-pressed','true');
  }
  function playback(active) {
    clearInterval(interval);
    playing=active;
    play.textContent=active?'Пауза':'Воспроизвести';
    play.setAttribute('aria-pressed',String(active));
    scene.classList.toggle('playing',active);
    if (active && count>1) interval=setInterval(()=>show((current+1)%count),day.imprint.duration*1000);
  }
  playback(false);
  dots.forEach((dot,index)=>dot.addEventListener('click',()=>{
    show(index);
    if (playing) playback(true);
  }));
  play.addEventListener('click',()=>{
    if (audio) {
      if (playing) { audio.pause(); playback(false); }
      else if (audio.paused) audio.play().catch(()=>{
        if (music.kind==='remote') {
          playback(true);
          announce('Идёт показ кадров. Для музыки проверьте соединение или откройте страницу трека.');
        } else announce('Браузер не смог воспроизвести аудио.');
      });
      else audio.pause();
    } else {narrator.pause();playback(!playing);}
  });
  if (audio) {
    audio.addEventListener('play',()=>{narrator.pause();playback(true);});
    audio.addEventListener('pause',()=>playback(false));
    audio.addEventListener('ended',()=>playback(false));
  }
  // The author can correct the words of a day or remove the day altogether.
  const storyText=main.querySelector('#story-text');
  const storyForm=main.querySelector('#story-form');
  const storyEdit=main.querySelector('#story-edit');
  const editing=open=>{storyForm.hidden=!open;storyText.hidden=open;};
  main.querySelector('#edit-text')?.addEventListener('click',()=>{
    storyEdit.value=day.story;
    editing(true);
    storyEdit.focus();
  });
  main.querySelector('#story-cancel').addEventListener('click',()=>editing(false));
  storyForm.addEventListener('submit',async event=>{
    event.preventDefault();
    const story=storyEdit.value.trim();
    if (!story) { announce('Текст записи не может быть пустым.'); return; }
    if (story===day.story) { editing(false); return; }
    // New words are read on the device; the model reads them only when the author presses its button.
    day.story=story;
    day.reading=localReading(story);
    day.imprint=makeImprint(story,day.photoData,day.music.analysis,day.reading);
    day.voiceRecording=null;
    await keep();
    await saveRecording(day.id,null).catch(()=>{});
    render();
    announce(model.available?'Текст сохранён. Настроение пересчитал словарь; модель прочитает запись по кнопке «Прочитать запись через OpenAI».':'Текст сохранён, настроение пересчитано.');
  });
  main.querySelector('#delete-day')?.addEventListener('click',async()=>{
    const sure=await ask(`Удалить день «${day.imprint.title}»?`,'Текст, кадры, песня и озвучка исчезнут из этого браузера. Вернуть их будет нельзя.');
    if (!sure) return;
    try {
      await deleteDay(day.id);
      await saveRecording(day.id,null).catch(()=>{});
    } catch { announce('Не удалось удалить день. Попробуйте ещё раз.'); return; }
    days=days.filter(record=>record.id!==day.id);
    location.hash='#archive';
    announce('День удалён.');
  });
  main.querySelector('#download').addEventListener('click',async event=>{
    const button=event.currentTarget;
    button.disabled=true;
    try { await downloadDay(day); announce('Папка дня скачана.'); }
    catch { announce('Не удалось скачать папку дня. Попробуйте ещё раз.'); }
    finally { button.disabled=false; }
  });
  return () => {
    clearInterval(interval);
    composeButton.removeEventListener('click',narrator.pause);
    audio?.pause();
    narrator.dispose();
  };
}

function render(navigate=false) {
  renderCleanup();
  const urls = new Map();
  function fileURL(file) {
    if (!urls.has(file)) urls.set(file,URL.createObjectURL(file));
    return urls.get(file);
  }
  function photo(day,index) { return day.photos ? fileURL(day.photos[index]) : day.photoSources[index]; }
  const isDay = location.hash.startsWith('#day/');
  const day=days.find(record=>href(record.id)===location.hash);
  const cleanup=day?renderDay(day,photo,fileURL):null;
  if (!day) renderArchive(photo);
  if (isDay && !day) announce('Запись не найдена в этом браузере.');
  document.title=day?`${day.imprint.title} — Оттиск`:'Оттиск — личный дневник';
  // On a day's page the one accented action is playing the memory, not writing a new one.
  root.dataset.view=day?'day':'archive';
  renderCleanup=()=>{cleanup?.();for(const url of urls.values()) URL.revokeObjectURL(url);};
  if (location.hash==='#archive') {
    main.querySelector('#archive')?.scrollIntoView();
    if(navigate) main.querySelector('#archive')?.focus({preventScroll:true});
  } else if(navigate){
    window.scrollTo(0,0);
    main.focus({preventScroll:true});
  }
}

function musicMode() {
  const mode=form.elements.musicType.value;
  const useLink=mode==='link';
  document.querySelector('#music-assist').hidden=mode!=='assist';
  document.querySelector('#music-link').hidden=!useLink;
  document.querySelector('#music-file').hidden=mode!=='file';
  for (const name of ['url','track','tempo','character']) {
    form.elements[name].disabled=!useLink;
    form.elements[name].required=useLink;
  }
  form.elements.audio.disabled=mode!=='file';
  form.elements.audio.required=mode==='file';
  document.querySelector('#music-generate-panel').hidden=mode!=='generate';
  musicPicker.setMode(step===3 && editor.open ? mode : '');
}

const stepTitles = ['Каким был день?', 'Какие кадры сохранить?', 'Как звучал этот день?'];
const nextStep = form.querySelector('#next-step');
const previousStep = form.querySelector('#previous-step');
function goToStep(number) {
  if (step===2) imagePicker.leave();
  step = number;
  form.querySelectorAll('[data-step]').forEach(section => {
    section.hidden = Number(section.dataset.step)!==number;
  });
  form.querySelector('#step-count').textContent='Шаг '+number+' из 3';
  const heading = form.querySelector('#editor-title');
  heading.textContent=stepTitles[number-1];
  previousStep.hidden=number===1;
  nextStep.hidden=number===3;
  nextStep.textContent=number===1?'Добавить фотографии':'Подобрать музыку';
  submit.hidden=number!==3;
  alert.hidden=true;
  musicMode();
  if (number===2) imagePicker.enter();
  editor.scrollTop=0;
  if (editor.open) heading.focus({preventScroll:true});
}

async function advanceStep() {
  if (busy || nextStep.disabled || step===3) return;
  const from = step;
  nextStep.disabled=true;
  alert.hidden=true;
  try {
    if (from===1) {
      await voiceEntry.finish();
      if (!form.elements.date.reportValidity()) return;
      if (!form.elements.story.value.trim()) {
        form.elements.story.focus();
        throw Error('Расскажите о дне голосом или напишите несколько слов.');
      }
    }
    if (from===2) imagePicker.files();
    if (editor.open && from===step) goToStep(from+1);
  } catch (error) {
    alert.textContent=error.message;
    alert.hidden=false;
  } finally {nextStep.disabled=false;}
}

// The author decides whether the entry leaves the device to be read by a model.
function paintReadingChoice() {
  document.querySelector('#ai-consent').hidden=!model.available;
  document.querySelector('#reading-hint').textContent=model.available
    ? 'С галочкой при сборке воспоминания текст записи отправится в OpenAI: модель оценит настроение дня и назовёт папку. Без галочки текст останется на устройстве, а настроение оценит встроенный словарь.'
    : 'Настроение дня оценит встроенный словарь на устройстве. Чтобы запись читала модель, подключите ключ OpenAI по инструкции проекта и перезапустите дневник.';
}
// Show what is already known at once, then check again in case the key changed.
async function showReadingChoice() {
  paintReadingChoice();
  model=await readingStatus();
  paintReadingChoice();
}

function openEditor() {
  if (!form.elements.date.value) form.elements.date.value=localDate();
  main.querySelectorAll('audio').forEach(player=>player.pause());
  editor.showModal();
  goToStep(step);
  showReadingChoice();
}
nextStep.addEventListener('click',advanceStep);
previousStep.addEventListener('click',()=>{if(!busy && step>1)goToStep(step-1);});
form.addEventListener('change', event=>{if(event.target.name==='musicType')musicMode();});
document.querySelector('#compose').addEventListener('click',openEditor);
document.querySelector('#close-editor').addEventListener('click',()=>{if(!busy)editor.close();});
editor.addEventListener('close',()=>{musicPicker.pause();imagePicker.leave();});
editor.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if (busy) return;
  if (step<3) { await advanceStep(); return; }
  if (!form.reportValidity()) return;
  busy=true;
  alert.hidden=true;
  submit.disabled=true;
  submit.textContent='Собираем сцену…';
  try {
    const data=new FormData(form);
    const story=data.get('story').trim();
    if (!story) throw Error('Добавьте описание дня.');
    const photos=imagePicker.files();
    const sound=data.get('audio');
    let music;
    if(['assist','generate'].includes(data.get('musicType'))){
      music=await musicPicker.selectedMusic();
    } else if(data.get('musicType')==='link'){
      const url=new URL(data.get('url'));
      if(!['https:','http:'].includes(url.protocol)||url.username||url.password) throw Error('Укажите обычную HTTP или HTTPS ссылку на трек.');
      const track=data.get('track').trim();
      if(!track) throw Error('Укажите название трека.');
      music={kind:'link',track,url:url.href,analysis:linkMusic(data.get('tempo'),data.get('character'))};
    } else {
      if(!sound?.size || sound.size>25*1024*1024) throw Error('Добавьте аудиофайл до 25 МБ.');
      music={kind:'file',track:sound.name.replace(/\.[^.]+$/u,''),blob:sound,analysis:await audioStats(sound)};
    }
    let photoData;
    try { photoData=await Promise.all(photos.map(photoStats)); }
    catch { throw Error('Не удалось открыть один из кадров. Попробуйте JPEG, PNG или WebP.'); }
    const askModel=model.available && form.elements.useAI.checked;
    if (askModel) submit.textContent='Читаем запись…';
    const reading=await readStory(story,askModel);
    const day={id:crypto.randomUUID(),date:data.get('date'),story,photos,photoData,frameOrigins:imagePicker.origins(),music,reading,
      imprint:makeImprint(story,photoData,music.analysis,reading),created:Date.now()};
    await saveDay(day);
    days.push(day);
    sortDays();
    form.reset();
    imagePicker.reset();
    goToStep(1);
    editor.close();
    location.hash=href(day.id);
    announce(reading.fallback?'Папка дня сохранена. Модель не ответила, настроение оценил словарь.':'Папка дня сохранена.');
  } catch (error) {
    alert.textContent=error instanceof DOMException?'Браузер не смог сохранить запись. Проверьте доступное место и режим браузера.':error.message;
    alert.hidden=false;
  } finally {
    busy=false;
    submit.disabled=false;
    submit.textContent='Собрать воспоминание';
  }
});
function sortDays() {days.sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created);}

// Days saved by an earlier version have no numbers yet: read them on the device once.
async function upgrade(day) {
  const measured=day.photoData?.every(photo=>photo.warm!=null);
  if (day.imprint?.v===3 && day.reading?.feelings && measured) return day;
  const photoData=measured ? day.photoData : await Promise.all(day.photos.map(photoStats));
  const reading=day.reading?.feelings ? day.reading : localReading(day.story);
  const next={...day,photoData,reading,imprint:makeImprint(day.story,photoData,day.music.analysis,reading)};
  saveDay(next).catch(()=>{});
  return next;
}

applyTheme(emptyFeelings());
main.innerHTML='<p class="loading" role="status">Открываем дневник…</p>';
const settle=jobs=>Promise.allSettled(jobs).then(items=>({failed:items.some(item=>item.status==='rejected'),
  values:items.flatMap(item=>item.status==='fulfilled'?[item.value]:[])}));
const results=await Promise.allSettled([
  loadDays().then(stored=>settle(stored.map(upgrade))),
  settle(demos.map(async demo=>{
    const photoData=await Promise.all(demo.photoSources.map(photoStats));
    return {...demo,photoData,imprint:makeImprint(demo.story,photoData,demo.music.analysis,demo.reading)};
  })),
  loadRecordings(),
  readingStatus()
]);
const [stored,examples]=results;
if (examples.status==='fulfilled' && examples.value.failed) announce('Часть примеров недоступна.');
days=[stored,examples].flatMap(result=>result.status==='fulfilled'?result.value.values:[]);
if (results[2].status==='fulfilled') {
  const tracks=new Map(results[2].value.map(({id,recording})=>[id,recording]));
  for (const day of days) if (tracks.has(day.id)) day.voiceRecording=tracks.get(day.id);
}
sortDays();
if (results[3].status==='fulfilled') model=results[3].value;
render();
if (results.some(result=>result.status==='rejected') || (stored.status==='fulfilled' && stored.value.failed)) announce('Не удалось загрузить часть дневника.');
window.addEventListener('hashchange',()=>render(true));
musicMode();
