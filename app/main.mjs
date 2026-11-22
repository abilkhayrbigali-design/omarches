import {formatDate, language, locale, localizeStaticCopy, numberFormat, prepareStaticCopy, setLanguage, storyLanguage, t} from './i18n.mjs';
import {audioStats, linkMusic, makeImprint, photoStats} from './atmosphere.mjs';
import {mountNarrator, narratorControls} from './narrator.mjs';
import {deleteDay, importDays, loadDays, saveDay, saveRecording, loadRecordings} from './storage.mjs';
import {demos, localizedDay} from './demos.mjs';
import {spectrumGroups} from './spectrum.mjs';
import {readingReason} from './own-model.mjs';
import {setupMusicPicker} from './music-picker.mjs';
import {setupImagePicker} from './image-picker.mjs';
import {setupVoiceEntry} from './voice-entry.mjs';
import {downloadArchive, downloadDay} from './export.mjs';
import {readBackup} from './restore.mjs';
import {IDS, emptyFeelings, feelingLabel, feelingName, foldDiary, motionLine, siteTokens} from './feelings.mjs';
import {contextPageHTML, contextSVG, occasionNames, weatherNames} from './context.mjs';
import {applySceneMoment, escape, layersHTML, momentLine, number, pairsHTML, placeLine, refreshSceneMoments, rulesHTML, sceneHTML, sceneStyle, stampSVG, themeVars, treatment, tuneHTML} from './scene.mjs';
import {readStory, readingStatus, warmServerModel} from './reading.mjs';
import {weatherLayer} from './weather.mjs';

const root = document.documentElement;
const main = document.querySelector('#main');
const editor = document.querySelector('#editor');
const form = document.querySelector('#day-form');
prepareStaticCopy(root);
localizeStaticCopy();
form.elements.dictationLanguage.value = language;
const musicPicker = setupMusicPicker(form);
const voiceEntry = setupVoiceEntry(form);
const imagePicker = setupImagePicker(form);
const alert = document.querySelector('#form-error');
const submit = form.querySelector('[type=submit]');
const localDate = () => {
  const now = new Date();
  return [now.getFullYear(), now.getMonth()+1, now.getDate()].map(x=>String(x).padStart(2,'0')).join('-');
};
const href = id => '#day/'+encodeURIComponent(id);
const genitive = {joy:'радости', sadness:'грусти', calm:'покоя', tension:'напряжения', festive:'праздника', quiet:'тишины', warmth:'тепла', solitude:'уединения'};
let days = [];
let galleryReturn = '#examples';
let renderCleanup = () => {};
let noticeTimer;
let busy = false;
let restoring = false;
let step = 1;
let editingDay = null;
let model = {available:false, model:'', server:true, hosted:false};

const announce = message => {
  clearTimeout(noticeTimer);
  const notice = document.querySelector('#status');
  notice.textContent=message;
  notice.hidden=false;
  noticeTimer=setTimeout(()=>notice.hidden=true,4500);
};

// The whole diary, oldest day first: every day moves the eight numbers a little.
function diary() {
  const ordered=days.filter(day=>!day.demo).sort((a,b)=>a.date.localeCompare(b.date)||a.created-b.created);
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
  document.querySelector('#brand-mark').innerHTML=stampSVG(diary().state,{title:t('Оттиск дневника')});
}

function leadLine(mood) {
  if (!mood.lead) return t('Сейчас дневник ровный: ни одно чувство не ведёт.');
  const label=feelingLabel(mood.state,mood.lead,mood.second).toLowerCase();
  return t`Сейчас в дневнике ${mood.second?t('ведут'):t('ведёт')} ${label}.`;
}

function shiftLine(mood) {
  if (!mood.latest) return '';
  const changes=IDS.map(id=>({id,change:mood.state[id]-mood.previous[id]})).filter(item=>Math.abs(item.change)>=.02)
    .sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,3);
  if (!changes.length) return t`Запись «${escape(localizedDay(mood.latest).imprint.title)}» почти не сдвинула числа.`;
  const parts=changes.map(({id,change})=>t`${change>0?t('прибавила'):t('убавила')} ${language==='ru'?genitive[id]:feelingName(id).toLowerCase()} на ${number(Math.abs(change))}`);
  return t`Запись «${escape(localizedDay(mood.latest).imprint.title)}» ${parts.join(', ')}.`;
}

function thumbnail(day, photo, key, showMood = true) {
  const {imprint}=day;
  const treat=treatment(imprint,key,.36);
  return `<div class="thumb" data-place="${imprint.place}"${day.participantExample ? ' data-photo-album' : ''}${treat.attr} style="${sceneStyle(imprint)}${treat.style}">
    ${treat.svg}<div class="frames"><img class="frame visible" src="${escape(photo(day,0))}" alt="" loading="${showMood?'lazy':'eager'}"></div>
    <div class="wash"></div><div class="leak"></div>${contextSVG(imprint.context,imprint,key,.36)}<div class="grain"></div>
    ${showMood?`<span class="mood-label">${stampSVG(imprint.feelings,{title:imprint.moodName})}${escape(imprint.moodName)}</span>`:''}</div>`;
}

function dayCard(day, photo, label = '', effect = '') {
  const name=day.imprint.title;
  const key=effect || 'c-'+day.id;
  let caption;
  if (effect) {
    caption=`<h3>${escape(label)}</h3><span class="spectrum-day-title">${escape(name)}</span>`;
  } else {
    const detail=label ? `<span class="spectrum-effect">${escape(label)}</span>`
      : `<time datetime="${day.date}">${formatDate(day.date)}</time>`;
    caption=`${detail}<h3>${escape(name)}</h3>`;
  }
  return `<a class="day-card" href="${href(day.id)}" ${effect?`data-example="${escape(effect)}"`:''}
      aria-label="${t("Открыть день:")} ${label?escape(label)+' · ':''}${escape(name)}">
    ${thumbnail(day,photo,key)}<div class="card-caption">${caption}</div></a>`;
}

const examplesHash = group => group ? '#examples/'+group : '#examples';

function spectrumPreview(photo) {
  const coverIds={occasion:'halloween',weather:'storm',mood:'warmth'};
  const groups=spectrumGroups(days.filter(day=>day.demo).map(localizedDay));
  const covers=groups.map(group=>{
    const item=group.items.find(item=>item.id===coverIds[group.id]) ?? group.items[0];
    if (!item) return '';
    return `<a class="spectrum-category" data-category="${group.id}" href="${examplesHash(group.id)}">
      ${thumbnail(item.day,photo,'cover-'+group.id,false)}
      <div class="spectrum-category-caption"><h3>${escape(group.label)}</h3><span>${escape(item.day.imprint.title)}</span></div></a>`;
  }).join('');
  if (!covers) return '';
  return `<section class="spectrum-preview" aria-labelledby="spectrum-heading">
    <div class="spectrum-heading"><h2 id="spectrum-heading">${t('Галерея оформлений')}</h2>
      <a class="plain" href="#examples">${t('Все оформления')}</a></div>
    <div class="spectrum-categories">${covers}</div></section>`;
}

function archiveExport(button, records) {
  button.addEventListener('click',async()=>{
    button.disabled=true;
    try { await downloadArchive(records); announce(t('Архив скачан.')); }
    catch { announce(t('Не удалось скачать архив. Попробуйте скачать отдельный день.')); }
    finally { button.disabled=false; }
  });
}

async function restoreArchive(file, button) {
  if (!file || restoring) return;
  restoring=true;
  button.disabled=true;
  button.textContent=t('Восстанавливаем архив…');
  let message;
  let records;
  let added=[];
  try {
    records=await readBackup(file,new Set(demos.map(day=>day.id)));
    if (records.length) {
      added=await importDays(records);
      const addedIds=new Set(added.map(day=>day.id));
      days=days.filter(day=>!addedIds.has(day.id)).concat(added);
      sortDays();
      const count=records.length-added.length;
      message=t`Восстановлено записей: ${added.length}.`+(count?' '+t`Уже в дневнике: ${count}.`:'');
    } else message=t('В архиве нет личных записей.');
  } catch {
    message=records ? t('Не удалось сохранить восстановленные записи. Проверьте свободное место в браузере.')
      : t('Не удалось восстановить архив. Выберите ZIP, скачанный из «Оттиска».');
  } finally {
    restoring=false;
    const currentButton=main.querySelector('#restore-archive');
    if (currentButton) {
      if (added.length) {
        render();
        main.querySelector('#restore-archive').focus({preventScroll:true});
      } else {
        currentButton.disabled=false;
        currentButton.textContent=t('Восстановить из ZIP');
        currentButton.focus({preventScroll:true});
      }
    }
    announce(message);
  }
}

function renderExamples(photo, filter) {
  const mood=diary();
  applyTheme(mood.state,{keep:mood.lead,keepSecond:mood.second});
  const examples=days.filter(day=>day.demo).map(localizedDay);
  const groups=spectrumGroups(examples);
  const active=groups.find(group=>group.id===filter);
  galleryReturn=examplesHash(active?.id);
  const filters=[{id:'',label:t('Все дни')},...groups];
  const links=filters.map(({id,label})=>{
    const target=examplesHash(id);
    return `<a class="spectrum-filter" href="${target}"${target===galleryReturn?' aria-current="page"':''}>${escape(label)}</a>`;
  }).join('');
  let cards;
  if (active) {
    cards=active.items.map(item=>dayCard(item.day,photo,item.label,active.id+':'+item.id));
  } else {
    const occasions=new Map(occasionNames()), weather=new Map(weatherNames());
    const participantFirst = [...examples].sort((a,b)=>Number(Boolean(b.participantExample))-Number(Boolean(a.participantExample)));
    cards=participantFirst.map(day=>{
      const context=day.imprint.context;
      const tags=[day.participantExample && t('День участницы команды'),occasions.get(context.occasion),...context.weather.map(item=>weather.get(item.kind))].filter(Boolean);
      return dayCard(day,photo,tags.join(' · '));
    });
  }
  main.innerHTML=`
    <section class="examples" id="examples" aria-labelledby="examples-title" tabindex="-1">
      <div class="section-title"><div><h1 id="examples-title">${t('Галерея оформлений')}</h1><p>${t("Это демонстрационные дни. Личные записи хранятся в вашем архиве.")}</p></div>
      <button class="plain bordered" id="export-examples" type="button" ${examples.length?'':'disabled'}>${t("Скачать примеры")}</button></div>
      <nav class="spectrum-nav" aria-label="${t('Галерея оформлений')}">${links}</nav>
      <div class="grid" id="examples-grid">${cards.join('')}</div>
    </section>`;
  archiveExport(main.querySelector('#export-examples'),examples);
}

function renderArchive(photo) {
  const mood=diary();
  applyTheme(mood.state,{keep:mood.lead,keepSecond:mood.second});
  const records=days.filter(day=>!day.demo);
  const visibleDays=records.map(localizedDay);
  const [lead]=visibleDays;
  const leadTreat=lead && treatment(lead.imprint,'f-'+lead.id);
  const introduction=lead ? `
    <section class="welcome"><h1>${t("Дневник ощущений")}</h1><p>${t("Фотографии, слова и музыка. То, каким запомнился день.")}</p></section>
    <a href="${href(lead.id)}" class="featured" data-face="${lead.imprint.face}" data-place="${lead.imprint.place}"${leadTreat.attr} style="${sceneStyle(lead.imprint)}${leadTreat.style}" aria-label="${t("Открыть день:")} ${escape(lead.imprint.title)}">
      ${leadTreat.svg}<div class="frames"><img class="frame visible" src="${escape(photo(lead,0))}" alt=""></div>${layersHTML(lead.imprint,lead.id)}
      <div class="featured-text"><span class="eyebrow">${t("Последняя запись")}</span><h2>${escape(lead.imprint.title)}</h2><p>${formatDate(lead.date)} <span class="separator">·</span> ${lead.imprint.moodName}</p><span class="feature-action">${t("Пережить день")}</span></div>
    </a>
    ${spectrumPreview(photo)}
    <section class="diary-mood" aria-labelledby="mood-title">
      <div class="mood-stamp">${stampSVG(mood.state,{labels:true,title:t('Оттиск дневника: восемь чисел настроения')})}</div>
      <div class="mood-text"><h2 id="mood-title">${t("Настроение дневника")}</h2>
        <p class="mood-line">${leadLine(mood)} ${shiftLine(mood)}</p>
        ${pairsHTML(mood.state,mood.previous)}
        <p class="hint">${t("Каждая запись сдвигает числа понемногу. Чувство, которое вело день, заодно теснит свою противоположность: после грустного дня радости становится меньше, а грусти больше. От этих чисел зависят цвет, шрифт и форма дневника.")}</p>
      </div>
    </section>` : `
    <section class="welcome spectrum-intro">
      <h1>${t("Дневник ощущений")}</h1>
      <p>${t("Фотографии, слова и музыка. То, каким запомнился день.")}</p>
    </section>${spectrumPreview(photo)}`;
  main.innerHTML=`${introduction}
    <section class="archive" id="archive" aria-labelledby="archive-title" tabindex="-1">
       <div class="section-title"><div><h2 id="archive-title">${t("Мой архив")}</h2><p id="count"></p></div><div class="archive-actions">
         <label class="sr-only" for="search">${t("Поиск по дневнику")}</label><input id="search" type="search" placeholder="${t("Найти день")}" ${lead?'':'hidden'}>
         <button class="plain bordered" id="export-archive" type="button" ${lead?'':'disabled'}>${t("Скачать мой архив")}</button>
         <button class="plain bordered" id="restore-archive" type="button" ${restoring?'disabled':''}>${t(restoring?'Восстанавливаем архив…':'Восстановить из ZIP')}</button>
         <input id="archive-file" type="file" accept=".zip,application/zip" hidden>
       </div></div>
       <div class="grid" id="archive-grid"></div>
    </section>`;
  const restore=main.querySelector('#restore-archive');
  const upload=main.querySelector('#archive-file');
  restore.addEventListener('click',()=>upload.click());
  upload.addEventListener('change',()=>{
    const file=upload.files[0];
    upload.value='';
    void restoreArchive(file,restore);
  });
  archiveExport(main.querySelector('#export-archive'),records);
  const search = main.querySelector('#search');
  const grid = main.querySelector('#archive-grid');
  const update = () => {
    const query=search.value.toLocaleLowerCase(locale()).trim().split(/\s+/);
    const filtered=visibleDays.filter(day=>{
      const fields=[day.imprint.title,day.imprint.moodName,day.story,day.music.track,day.date,formatDate(day.date)].join(' ').toLocaleLowerCase(locale());
      return query.every(word=>fields.includes(word));
    });
    const unit = {one:t('запись'),few:t('записи'),many:t('записей'),other:t('записей')}[new Intl.PluralRules(locale()).select(filtered.length)];
    main.querySelector('#count').textContent=`${filtered.length} ${unit}`;
    grid.innerHTML = filtered.length ? filtered.map(day=>dayCard(day,photo)).join('')
      : lead ? `<p class="empty">${t("Ничего не найдено. Попробуйте другое слово или дату.")}</p>` : '';
  };
  search.addEventListener('input',update);
  update();
}

function sourceLine(day) {
  const reading=day.reading;
  const who=reading.source==='ai' ? t`Запись прочитала модель ${escape(reading.model)}.`
    : reading.source==='example' ? t('Настроение задано для примера.')
    : reading.source==='server' ? t('Запись прочитала модель «Оттиска» на сервере.')
    : reading.source==='own' ? t('Запись прочитала модель «Оттиска» на этом устройстве.')
    : reading.source==='manual' ? t('Числа поправлены вручную.')
    : reading.fallback ? t('OpenAI не ответил, поэтому настроение оценил словарь на устройстве.')
    : t('Настроение оценил словарь на устройстве.');
  const explanation = ['own','server'].includes(reading.source) && reading.evidence ? readingReason(reading.evidence) :
    ['ai','own'].includes(reading.source) && (reading.reasonLanguage ?? 'ru')===language ? reading.reason : '';
  return `${who}${explanation ? ' '+escape(explanation) : ''}`;
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
  return `${day.frameOrigins?.some(frame=>frame.type==='generated')?t('В сцене есть иллюстрация, созданная по рассказу. '):''}<span class="swatch" style="--sample:${imprint.photoHue} ${imprint.photoSat}% ${Math.max(28,Math.round(imprint.light))}%"></span> ${t("Оттенок кадра подмешан к цвету сцены, тем слабее, чем он дальше от цвета чувства и чем больше в дне грусти и уединения. Светлота")} ${Math.round(imprint.light)}%. `
    + (moved.length ? t`Теплота цвета, плотность и свет кадров сдвинули числа: ${moved.join(', ')}.` : t('Числа кадры не сдвинули.'));
}

function musicLine(day) {
  const {imprint,music}=day;
  const moved=shifts(imprint.pictured,imprint.feelings);
  const sound=music.analysis;
  const mode={major:t('мажор'),minor:t('минор')}[sound.mode];
  const seconds=numberFormat(imprint.duration,{maximumFractionDigits:1});
  return `${music.origin!=='catalog'?'':sound.heard?t('Трек из каталога разобран по звуку. '):t('Характер трека взят из его описания. ')}`
    + (sound.bpm ? t`Темп ${sound.bpm} уд/мин: кадр держится восемь долей, это ${seconds} с.` : t`Ровного пульса нет, поэтому время кадра, ${seconds} с, взято из энергии трека.`)
    + t` Энергия ${number(sound.energy)}.`
    + (mode ? t` Лад: ${t(sound.key)} ${mode}.` : (music.kind==='file' && music.origin!=='generated') || sound.heard ? t(' Лад не выражен ясно.') : '')
    + (moved.length ? t` Музыка сдвинула числа: ${moved.join(', ')}.` : t(' Числа музыка не сдвинула.'));
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
  const display = localizedDay(day);
  const {music} = display;
  const count = day.photos?.length || day.photoSources.length;
  const sources = Array.from({length:count},(_,index)=>photo(day,index));
  const inlineAudio = music.kind !== 'link';
  const musicSource=music.kind==='file'?fileURL(music.blob):music.source;
  applyTheme(day.imprint.feelings,{hue:day.imprint.hue,light:day.imprint.place==='print'});
  main.innerHTML = `
    <div class="day-toolbar"><a class="back" href="${day.demo?galleryReturn:'#archive'}">${t(day.demo?'Примеры':'Мой архив')}</a><div class="day-actions">${day.demo?'':`<button class="plain" id="edit-day" type="button">${t("Редактировать день")}</button><button class="plain" id="delete-day" type="button">${t("Удалить день")}</button>`}<button class="plain bordered" id="download" type="button">${t("Скачать папку дня")}</button></div></div>
    <article aria-labelledby="day-heading">${sceneHTML(display,sources,formatDate(day.date))}
    <div class="transport"><button class="primary" type="button" id="play" aria-pressed="false">${t("Воспроизвести")}</button><div class="track"><strong>${escape(music.track)}</strong><span>${music.analysis.bpm ? (music.kind==='link'?t('Около '):'')+music.analysis.bpm+t(' уд/мин'):t('Свободный ритм')}${music.analysis.mode ? ' · '+escape(t(music.analysis.key))+' '+({major:t('мажор'),minor:t('минор')})[music.analysis.mode] : ''}</span>
      ${music.rights?`<span title="${escape(t(music.rights.description))}">${escape(t(music.rights.label))}</span>`:''}</div>
    ${inlineAudio?`<audio controls preload="${music.kind==='remote'?'none':'metadata'}" src="${escape(musicSource)}" aria-label="${t("Песня дня")}"></audio>`:`<a class="plain bordered" target="_blank" rel="noopener noreferrer" href="${escape(music.url)}">${t("Открыть песню")}</a>`}</div>
    ${music.origin==='catalog'?`<p class="catalog-links">${escape(music.artist)} · <a href="${escape(music.sourceUrl)}" target="_blank" rel="noopener noreferrer">${t("Страница трека")}</a> · <a href="${escape(music.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escape(music.license)}</a>${t(". Музыка играет через интернет.")}</p>`:''}
    <div class="notes"><section><h2>${t("Запись дня")}</h2><p class="story" id="story-text" lang="${storyLanguage(display.story)}">${escape(display.story)}</p>
      ${narratorControls()}</section>
      <section class="reading"><h2>${t("Как собрана сцена")}</h2>
        <div class="mood-stamp" id="day-stamp"></div>
        <p class="reading-source" id="reading-source"></p>
        <div id="day-rules"></div>
        <p class="hint" id="moment-line" hidden></p>
        ${tuneHTML(day.reading.feelings)}
        <button class="plain bordered" id="server-reread" type="button" title="${t('Текст отправится на сервер «Оттиска» для анализа.')}" hidden>${t('Прочитать запись заново')}</button>
        <button class="plain bordered" id="reread" type="button" hidden>${t("Прочитать запись через OpenAI")}</button>
        <dl><div><dt>${t("Кадры")}</dt><dd id="frames-line"></dd></div>
        <div><dt>${t("Музыка")}</dt><dd id="music-line"></dd></div>
        <div><dt>${t("Движение")}</dt><dd id="motion-line"></dd></div>
        <div><dt>${t("Композиция")}</dt><dd id="place-line"></dd></div></dl>
        <p class="hint">${day.demo?t('Это пример: правки чисел действуют до перезагрузки страницы. '):''}${t("Числа описывают текст записи, а не состояние автора.")}</p>
      </section></div>
    </article>${contextPageHTML(day.imprint.context,day.imprint)}`;

  const scene = main.querySelector('.memory');
  const frames = [...scene.querySelectorAll('.frame')];
  const dots = [...scene.querySelectorAll('.dot')];
  const audio = main.querySelector('.transport audio');
  const play = main.querySelector('#play');
  const tune = main.querySelector('.tune');
  const reread = main.querySelector('#reread');
  const serverReread = main.querySelector('#server-reread');
  let frameTimer;
  let current=0;
  let playing=false;
  // Where the caption stands under the photograph (a print, a small or a cut frame), the frame leaves it exactly the room it takes.
  const caption=scene.querySelector('.scene-text');
  const fit=()=>scene.style.setProperty('--band',Math.ceil(caption.offsetHeight)+'px');
  const band=new ResizeObserver(fit);
  band.observe(caption);
  // Snow and rain named in the entry (or the light snow of a New Year page) fall over the whole window.
  const stopWeather=weatherLayer();
  const narrator=mountNarrator(main,day,()=>{audio?.pause();playback(false);},display.story);
  const composeButton=document.querySelector('#compose');
  composeButton.addEventListener('click',narrator.pause);

  // Everything that depends on the numbers is drawn here, so moving a slider redraws the day in place.
  function describe() {
    const {imprint}=day;
    main.querySelector('#day-stamp').innerHTML=stampSVG(imprint.feelings,{labels:true,title:t('Оттиск дня: ')+feelingLabel(imprint.feelings)});
    main.querySelector('#reading-source').innerHTML=sourceLine(localizedDay(day));
    main.querySelector('#day-rules').innerHTML=rulesHTML(imprint);
    const chronology=main.querySelector('#moment-line');
    chronology.textContent=momentLine(imprint);
    chronology.hidden=!imprint.moments;
    main.querySelector('#frames-line').innerHTML=framesLine(day);
    main.querySelector('#music-line').textContent=musicLine(day);
    main.querySelector('#motion-line').textContent=motionLine(imprint.feelings);
    main.querySelector('#place-line').textContent=placeLine(imprint);
    reread.hidden=!model.available || day.reading.source==='ai';
    serverReread.hidden=!model.enhanced || day.demo || day.reading.source==='server';
  }
  function restyle() {
    day.imprint=imprintForDay(day);
    const {imprint}=day;
    if (Boolean(scene.dataset.moment)!==Boolean(imprint.moments)) {
      render();
      return;
    }
    refreshSceneMoments(scene,day,current,frames.length);
    const display = localizedDay(day);
    scene.querySelector('h1').textContent=display.imprint.title;
    scene.querySelector('.scene-text p').textContent=display.imprint.excerpt;
    document.title=t`${display.imprint.title} — Оттиск`;
    describe();
    applyTheme(imprint.feelings,{hue:imprint.hue,light:imprint.place==='print'});
    fit();
    if (playing) playback(true);
  }
  async function keep() {
    if (day.demo) return;
    const {voiceRecording,...record}=day;
    try { await saveDay(record); }
    catch { announce(t('Не удалось сохранить изменения в этом браузере.')); }
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
  async function rereadDay(mode, button) {
    const label=button.textContent;
    reread.disabled=serverReread.disabled=true;
    button.textContent=t('Читаем запись…');
    const reading=await readStory(day.story,mode);
    reread.disabled=serverReread.disabled=false;
    button.textContent=label;
    if (!main.contains(button)) return;
    if (reading.source!==mode) {
      announce(t(mode==='server' ? 'Сервер не ответил. Числа остались прежними.' : 'OpenAI не ответил. Числа остались прежними.'));
      return;
    }
    day.reading=reading;
    for (const input of tune.querySelectorAll('input')) {
      input.value=reading.feelings[input.name];
      input.nextElementSibling.textContent=number(input.value);
    }
    restyle();
    await keep();
  }
  reread.addEventListener('click',()=>rereadDay('ai',reread));
  serverReread.addEventListener('click',()=>rereadDay('server',serverReread));

  function show(index) {
    frames[current].classList.remove('visible');
    dots[current]?.setAttribute('aria-pressed','false');
    current=index;
    frames[current].classList.add('visible');
    dots[current]?.setAttribute('aria-pressed','true');
    applySceneMoment(scene,current,frames.length);
  }
  function scheduleFrame() {
    if (frames.length<2 || (scene.dataset.moment && current===frames.length-1)) return;
    frameTimer=setTimeout(()=>{
      show((current+1)%frames.length);
      scheduleFrame();
    },Number(scene.dataset.duration)*1000);
  }
  function playback(active) {
    clearTimeout(frameTimer);
    playing=active;
    play.textContent=active?t('Пауза'):t('Воспроизвести');
    play.setAttribute('aria-pressed',String(active));
    scene.classList.toggle('playing',active);
    if (active) scheduleFrame();
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
          announce(t('Идёт показ кадров. Для музыки проверьте соединение или откройте страницу трека.'));
        } else announce(t('Браузер не смог воспроизвести аудио.'));
      });
      else audio.pause();
    } else {
      if (!playing && scene.dataset.moment && current===frames.length-1) show(0);
      narrator.pause();
      playback(!playing);
    }
  });
  if (audio) {
    audio.addEventListener('play',()=>{
      if (audio.currentTime<.1 && scene.dataset.moment && current===frames.length-1) show(0);
      narrator.pause();
      playback(true);
    });
    audio.addEventListener('pause',()=>playback(false));
    audio.addEventListener('ended',()=>playback(false));
  }
  main.querySelector('#edit-day')?.addEventListener('click',()=>{
    narrator.pause();
    openEditor(day);
  });
  main.querySelector('#delete-day')?.addEventListener('click',async()=>{
    const sure=await ask(t`Удалить день «${day.imprint.title}»?`,t('Текст, кадры, песня и озвучка исчезнут из этого браузера. Вернуть их будет нельзя.'));
    if (!sure) return;
    try {
      await deleteDay(day.id);
      await saveRecording(day.id,null).catch(()=>{});
    } catch { announce(t('Не удалось удалить день. Попробуйте ещё раз.')); return; }
    days=days.filter(record=>record.id!==day.id);
    location.hash='#archive';
    announce(t('День удалён.'));
  });
  main.querySelector('#download').addEventListener('click',async event=>{
    const button=event.currentTarget;
    button.disabled=true;
    try { await downloadDay(localizedDay(day)); announce(t('Папка дня скачана.')); }
    catch { announce(t('Не удалось скачать папку дня. Попробуйте ещё раз.')); }
    finally { button.disabled=false; }
  });
  return () => {
    clearTimeout(frameTimer);
    composeButton.removeEventListener('click',narrator.pause);
    audio?.pause();
    band.disconnect();
    stopWeather();
    narrator.dispose();
  };
}

// A view enters once, moving in the character of its mood (see the Arrival rules in
// style.css). The class is taken off afterwards, so redrawing a part of the page
// later, a slider or a search, does not replay the entrance.
const stillness = matchMedia('(prefers-reduced-motion: reduce)');
let entering;
function enter(lead=0) {
  clearTimeout(entering);
  main.classList.remove('entering');
  void main.offsetWidth;
  main.style.setProperty('--lead',lead+'s');
  main.classList.add('entering');
  entering=setTimeout(()=>main.classList.remove('entering'),3200);
}

// Moving between the archive and a day keeps hold of the photograph: the card that
// was opened grows into the scene, and the scene goes back to its card. Where the
// browser cannot do this, or the visitor asked for less motion, the view just changes.
let opened=null;
main.addEventListener('click',event=>{opened=event.target.closest?.('a.featured, a.day-card')||null;});
const linksTo = id => [...main.querySelectorAll('a.featured, a.day-card')].filter(link=>link.getAttribute('href')===href(id));
const onScreen = element => {
  const box=element.getBoundingClientRect();
  return box.bottom>0 && box.top<innerHeight;
};
function hold(link) {
  const picture=link?.classList.contains('featured') ? link : link?.querySelector('.thumb');
  if (picture) picture.style.viewTransitionName='scene';
  return picture;
}
function travel() {
  const leaving=main.querySelector('.memory') ? shownDay : null;
  const target=days.find(record=>href(record.id)===location.hash);
  if (!document.startViewTransition || stillness.matches || (!target && !leaving)) { render(true); return; }
  if (target && !leaving) hold(opened && main.contains(opened) && opened.getAttribute('href')===href(target.id) ? opened : linksTo(target.id).find(onScreen));
  let held;
  const transition=document.startViewTransition(()=>{
    render(true,.14);
    if (leaving && !target) held=hold(linksTo(leaving).find(onScreen));
  });
  transition.ready.catch(()=>{});
  transition.finished.catch(()=>{}).then(()=>held?.style.removeProperty('view-transition-name'));
}

let shownDay=null;
function render(navigate=false,lead=0) {
  renderCleanup();
  const urls = new Map();
  function fileURL(file) {
    if (!urls.has(file)) urls.set(file,URL.createObjectURL(file));
    return urls.get(file);
  }
  function photo(day,index) { return day.photos ? fileURL(day.photos[index]) : day.photoSources[index]; }
  const isDay = location.hash.startsWith('#day/');
  const day=days.find(record=>href(record.id)===location.hash);
  const galleryRoute=/^#examples(?:\/(occasion|weather|mood))?$/u.exec(location.hash);
  const onExamples=Boolean(galleryRoute);
  const changingFilter=onExamples && root.dataset.view==='examples';
  const cleanup=day?renderDay(day,photo,fileURL):null;
  if (onExamples) renderExamples(photo,galleryRoute[1]);
  else if (!day) renderArchive(photo);
  if (isDay && !day) announce(t('Запись не найдена в этом браузере.'));
  document.title=day?t`${localizedDay(day).imprint.title} — Оттиск`
    : onExamples?t`${t('Галерея оформлений')} — Оттиск`:t('Оттиск — личный дневник');
  for (const link of document.querySelectorAll('.nav-pages a')) {
    if (link.hash===(onExamples || day?.demo?'#examples':'#archive')) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  // On a day's page the one accented action is playing the memory, not writing a new one.
  root.dataset.view=day?'day':onExamples?'examples':'archive';
  // The entrance plays when a view is opened, not when the open view is redrawn.
  if (shownDay!==(day?.id??null) || !main.dataset.shown) enter(lead);
  shownDay=day?.id??null;
  main.dataset.shown='1';
  renderCleanup=()=>{cleanup?.();for(const url of urls.values()) URL.revokeObjectURL(url);};
  if (location.hash==='#archive') {
    const section=main.querySelector('#archive');
    section?.scrollIntoView();
    if(navigate) section?.focus({preventScroll:true});
  } else if(navigate){
    window.scrollTo(0,0);
    const focusTarget=changingFilter?main.querySelector('.spectrum-filter[aria-current]'):onExamples?main.querySelector('#examples'):main;
    focusTarget.focus({preventScroll:true});
  }
}

function musicMode() {
  const mode=form.elements.musicType.value;
  const useLink=mode==='link';
  const keptMusic=form.querySelector('#kept-music');
  keptMusic.hidden=mode!=='keep';
  if (editingDay) keptMusic.textContent=t`Текущая песня: ${localizedDay(editingDay).music.track}`;
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
  form.querySelector('#step-count').textContent=t`Шаг ${number} из 3`;
  const heading = form.querySelector('#editor-title');
  heading.textContent=t(number===1 && editingDay?'Редактировать день':stepTitles[number-1]);
  previousStep.hidden=number===1;
  nextStep.hidden=number===3;
  nextStep.textContent=number===1?t('Добавить фотографии'):t('Подобрать музыку');
  submit.hidden=number!==3 && !editingDay;
  submit.textContent=t(editingDay?'Сохранить день':'Собрать воспоминание');
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
        throw Error(t('Расскажите о дне голосом или напишите несколько слов.'));
      }
    }
    if (from===2) imagePicker.files();
    if (editor.open && from===step) goToStep(from+1);
  } catch (error) {
    alert.textContent=error.message;
    alert.hidden=false;
  } finally {nextStep.disabled=false;}
}

// Where the diary's server model is published it reads every entry, and the form says
// that the text goes there. OpenAI stays the author's own choice.
function paintReadingChoice() {
  document.querySelector('#ai-consent').hidden=!model.available;
  document.querySelector('#reading-hint').textContent=model.enhanced
    ? t('Настроение дня оценит модель «Оттиска» на сервере: текст записи отправится туда для анализа и там не хранится.')
    : model.available
    ? t('Без галочки запись читает собственная модель «Оттиска» прямо на этом устройстве, и текст никуда не уходит. С галочкой текст отправится в OpenAI: её модель оценит настроение дня и назовёт папку.')
    : t('Настроение дня оценит собственная модель «Оттиска» прямо на этом устройстве: текст никуда не отправляется.');
}
// Show what is already known at once, then check again in case the key changed.
async function showReadingChoice() {
  paintReadingChoice();
  model=await readingStatus();
  paintReadingChoice();
  if (model.enhanced) warmServerModel();
}

function setEditorDay(day) {
  editingDay=day;
  form.reset();
  imagePicker.reset();
  const keepMusic=form.querySelector('#keep-music-choice');
  keepMusic.hidden=!day;
  keepMusic.querySelector('input').disabled=!day;
  form.querySelector('#day-title-field').hidden=!day;
  form.elements.date.readOnly=Boolean(day);
  if (day) {
    form.elements.story.value=day.story;
    form.elements.date.value=day.date;
    form.elements.dayTitle.value=day.customTitle || '';
    form.elements.dayTitle.placeholder=day.reading.title || day.imprint.title;
    form.elements.musicType.value='keep';
    imagePicker.restore(day.photos,day.frameOrigins);
  }
}

function imprintForDay(day) {
  const reading=day.customTitle ? {...day.reading,title:day.customTitle} : day.reading;
  return makeImprint(day.story,day.photoData,day.music.analysis,reading,day.date);
}

function openEditor(day) {
  if (day?.id && !day.demo) {
    setEditorDay(day);
    step=1;
  }
  if (!form.elements.date.value) form.elements.date.value=localDate();
  main.querySelectorAll('audio').forEach(player=>player.pause());
  editor.showModal();
  goToStep(step);
  showReadingChoice();
}
nextStep.addEventListener('click',advanceStep);
previousStep.addEventListener('click',()=>{if(!busy && step>1)goToStep(step-1);});
form.addEventListener('change', event=>{
  if (event.target.name==='musicType') musicMode();
});
document.querySelector('#compose').addEventListener('click',openEditor);
document.querySelector('#close-editor').addEventListener('click',()=>{if(!busy)editor.close();});
editor.addEventListener('close',()=>{
  musicPicker.pause();
  imagePicker.leave();
  if (editingDay) {
    setEditorDay(null);
    goToStep(1);
  }
});
editor.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if (busy) return;
  const original=editingDay;
  if (step<3 && !original) { await advanceStep(); return; }
  if (step<3 && form.elements.musicType.value!=='keep') { goToStep(3); return; }
  busy=true;
  alert.hidden=true;
  submit.disabled=true;
  submit.textContent=t('Собираем сцену…');
  try {
    if (step===1) await voiceEntry.finish();
    const invalid=[...form.elements].find(field=>field.willValidate && !field.validity.valid);
    if (invalid) {
      const section=invalid.closest('[data-step]');
      if (section && section.hidden) goToStep(Number(section.dataset.step));
      invalid.reportValidity();
      return;
    }
    const data=new FormData(form);
    const story=data.get('story').trim();
    if (!story) {
      if (step!==1) goToStep(1);
      form.elements.story.focus();
      throw Error(t('Добавьте описание дня.'));
    }
    let photos;
    try { photos=imagePicker.files(); }
    catch (error) { if (step!==2) goToStep(2); throw error; }
    const sound=data.get('audio');
    const musicType=data.get('musicType');
    let music;
    if (musicType==='keep' && original) {
      music=original.music;
    } else if (['assist','generate'].includes(musicType)){
      music=await musicPicker.selectedMusic();
    } else if(musicType==='link'){
      const url=new URL(data.get('url'));
      if(!['https:','http:'].includes(url.protocol)||url.username||url.password) throw Error(t('Укажите обычную HTTP или HTTPS ссылку на трек.'));
      const track=data.get('track').trim();
      if(!track) throw Error(t('Укажите название трека.'));
      music={kind:'link',track,url:url.href,analysis:linkMusic(data.get('tempo'),data.get('character'))};
    } else {
      if(!sound?.size || sound.size>25*1024*1024) throw Error(t('Добавьте аудиофайл до 25 МБ.'));
      music={kind:'file',track:sound.name.replace(/\.[^.]+$/u,''),blob:sound,analysis:await audioStats(sound)};
    }
    let photoData;
    const samePhotos=original?.photos.length===photos.length && photos.every((file,index)=>file===original.photos[index]);
    try { photoData=samePhotos ? original.photoData : await Promise.all(photos.map(photoStats)); }
    catch { throw Error(t('Не удалось открыть один из кадров. Попробуйте JPEG, PNG или WebP.')); }
    const askedOpenAI=model.available && form.elements.useAI.checked;
    const requestedModel=askedOpenAI ? 'ai' : model.enhanced ? 'server' : '';
    const storyChanged=original && story!==original.story;
    // Saving an edit that left the story alone keeps its reading, and with it any numbers set by hand.
    const shouldRead=!original || storyChanged || askedOpenAI;
    if (shouldRead && requestedModel) submit.textContent=t('Читаем запись…');
    const reading=shouldRead ? await readStory(story,requestedModel) : original.reading;
    const customTitle=data.get('dayTitle').trim() || undefined;
    const day={...original,id:original?.id ?? crypto.randomUUID(),date:original?.date ?? data.get('date'),
      created:original?.created ?? Date.now(),story,photos,photoData,frameOrigins:imagePicker.origins(),music,reading,customTitle};
    if (storyChanged) {
      day.storyRevision=(original.storyRevision ?? 0)+1;
      day.voiceRecording=null;
    }
    day.imprint=imprintForDay(day);
    const {voiceRecording,...record}=day;
    await saveDay(record);
    if (storyChanged) await saveRecording(day.id,null).catch(()=>{});
    if (original) days=days.map(previous=>previous.id===day.id?day:previous);
    else days.push(day);
    sortDays();
    setEditorDay(null);
    goToStep(1);
    editor.close();
    if (location.hash===href(day.id)) render();
    else location.hash=href(day.id);
    announce(t(shouldRead && reading.fallback==='server' ? 'Папка дня сохранена. Сервер не ответил, запись прочитала модель на устройстве.'
      : shouldRead && reading.fallback ? 'Папка дня сохранена. OpenAI не ответил, запись прочитала модель «Оттиска».'
      : original ? 'Изменения сохранены.' : 'Папка дня сохранена.'));
  } catch (error) {
    alert.textContent=error instanceof DOMException?t('Браузер не смог сохранить запись. Проверьте доступное место и режим браузера.'):error.message;
    alert.hidden=false;
  } finally {
    busy=false;
    submit.disabled=false;
    submit.textContent=t(editingDay?'Сохранить день':'Собрать воспоминание');
  }
});
function sortDays() {days.sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created);}

// Rebuild old saved scenes on the device, keeping any reading and title already chosen.
async function upgrade(day) {
  const measured=day.photoData?.every(photo=>photo.warm!=null);
  if (day.imprint?.v===7 && day.reading?.feelings && measured) return day;
  const photoData=measured ? day.photoData : await Promise.all(day.photos.map(photoStats));
  let reading=day.reading;
  if (!reading?.feelings) reading=await readStory(day.story,false);
  else if (!reading.moments) {
    const {moments}=await readStory(day.story,false);
    if (moments) reading={...reading,moments};
  }
  const next={...day,photoData,reading};
  next.imprint=imprintForDay(next);
  saveDay(next).catch(()=>{});
  return next;
}

applyTheme(emptyFeelings());
main.innerHTML=`<p class="loading" role="status">${t("Открываем дневник…")}</p>`;
const settle=jobs=>Promise.allSettled(jobs).then(items=>({failed:items.some(item=>item.status==='rejected'),
  values:items.flatMap(item=>item.status==='fulfilled'?[item.value]:[])}));
const results=await Promise.allSettled([
  loadDays().then(stored=>settle(stored.map(upgrade))),
  settle(demos.map(async demo=>{
    const photoData=await Promise.all(demo.photoSources.map(photoStats));
    return {...demo,photoData,imprint:makeImprint(demo.story,photoData,demo.music.analysis,demo.reading,demo.date)};
  })),
  loadRecordings(),
  readingStatus()
]);
const [stored,examples]=results;
if (examples.status==='fulfilled' && examples.value.failed) announce(t('Часть примеров недоступна.'));
days=[stored,examples].flatMap(result=>result.status==='fulfilled'?result.value.values:[]);
if (results[2].status==='fulfilled') {
  const tracks=new Map(results[2].value.map(({id,recording})=>[id,recording]));
  for (const day of days) {
    const recording=tracks.get(day.id);
    if (recording && recording.storyRevision===day.storyRevision) day.voiceRecording=recording;
  }
}
sortDays();
if (results[3].status==='fulfilled') model=results[3].value;
function localizeFooter() {
  // A copy opened without the local server still keeps a diary, but says plainly what it cannot do.
  if (model.hosted) document.querySelector('footer span:last-child').textContent=t(model.enhanced
    ? 'Версия в интернете: запись читает модель «Оттиска» на сервере. Новая озвучка создаётся при запуске на компьютере. Записи хранятся в этом браузере'
    : 'Версия в интернете: запись читает собственная модель «Оттиска» на устройстве. Новая озвучка создаётся при запуске на компьютере. Записи хранятся в этом браузере');
  else if (!model.server) document.querySelector('footer span:last-child').textContent=t('Версия без сервера: запись читает собственная модель «Оттиска» на устройстве, генерация картинок и новая озвучка недоступны. Записи хранятся в этом браузере');
}
localizeFooter();
document.querySelector('#language').addEventListener('change', event => {
  const search = main.querySelector('#search')?.value;
  const scroll = window.scrollY;
  setLanguage(event.target.value);
  localizeStaticCopy();
  localizeFooter();
  form.elements.dictationLanguage.value = language;
  voiceEntry.refresh();
  document.querySelector('#status').hidden = true;
  render();
  const field = main.querySelector('#search');
  if (field && search) {
    field.value = search;
    field.dispatchEvent(new Event('input'));
  }
  window.scrollTo(0, scroll);
});
goToStep(1);
render();
if (results.some(result=>result.status==='rejected') || (stored.status==='fulfilled' && stored.value.failed)) announce(t('Не удалось загрузить часть дневника.'));
window.addEventListener('hashchange',travel);
musicMode();
