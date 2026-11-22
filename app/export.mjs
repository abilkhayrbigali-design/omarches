import {formatDate, language, numberFormat, storyLanguage, t} from './i18n.mjs';
import {foldDiary, motionLine, siteTokens} from './feelings.mjs';
import {applySceneMoment, escape, momentLine, placeLine, rulesHTML, sceneHTML, stampSVG, themeStyle} from './scene.mjs';
import {contextPageHTML} from './context.mjs';
import {weatherLayer} from './weather.mjs';
import {writeZip} from './zip.mjs';

const clean = text => text.replace(/[^\p{L}\p{N} ._–-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,90).replace(/[. ]+$/u,'');
const folderName = day => `${clean(day.imprint.title)} — ${day.date}`;
const ext = name => /^\w{1,8}$/u.test(name.split('.').at(-1)) && name.includes('.') ? '.'+name.split('.').at(-1).toLowerCase() : '';
const fileMetadata = entry => typeof entry==='string' || !entry ? undefined : {type:entry.type,name:entry.name,lastModified:entry.lastModified};
async function asset(url) {
  const response=await fetch(url);
  if(!response.ok) throw Error('Файл недоступен.');
  return response.blob();
}

function offlineScene(labels, applyMoment) {
  // The page enters once in the character of the day, as it does in the diary.
  const page=document.querySelector('main');
  page.classList.add('entering');
  setTimeout(()=>page.classList.remove('entering'),3200);
  const scene=document.querySelector('.memory');
  // The caption under the photograph gets exactly the room it takes.
  const caption=scene.querySelector('.scene-text');
  const fit=()=>scene.style.setProperty('--band',Math.ceil(caption.offsetHeight)+'px');
  fit(); addEventListener('resize',fit); addEventListener('load',fit);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(caption);
  const frames=[...scene.querySelectorAll('.frame')];
  const dots=[...scene.querySelectorAll('.dot')];
  const audio=document.querySelector('#track');
  const voice=document.querySelector('#voice');
  const toggle=document.querySelector('#play');
  let timer, active=false, frame=0;
  function show(index) {
    frames[frame].classList.remove('visible');
    dots[frame]?.setAttribute('aria-pressed','false');
    frame=(index+frames.length)%frames.length;
    frames[frame].classList.add('visible');
    dots[frame]?.setAttribute('aria-pressed','true');
    applyMoment(scene,frame,frames.length);
  }
  function scheduleFrame() {
    clearTimeout(timer);
    if (!active || frames.length<2 || (scene.dataset.moment && frame===frames.length-1)) return;
    timer=setTimeout(()=>{
      show(frame+1);
      scheduleFrame();
    },Number(scene.dataset.duration)*1000);
  }
  function play(value) {
    active=value;
    toggle.textContent=value?labels.pause:labels.play;
    toggle.setAttribute('aria-pressed',String(value));
    scene.classList.toggle('playing',value);
    scheduleFrame();
  }
  function playWithoutStream() {
    if (scene.dataset.moment && frame===frames.length-1) show(0);
    voice?.pause();
    play(true);
    document.querySelector('#stream-status').textContent=labels.silent;
  }
  document.querySelector('#next')?.addEventListener('click',()=>{show(frame+1);scheduleFrame();});
  dots.forEach((dot,index)=>dot.addEventListener('click',()=>{show(index);scheduleFrame();}));
  toggle.addEventListener('click',()=>{
    if(!audio) {
      if(!active) {
        if (scene.dataset.moment && frame===frames.length-1) show(0);
        voice?.pause();
      }
      play(!active);
      return;
    }
    if(active) {
      audio.pause();
      play(false);
      return;
    }
    if (audio.dataset.stream==='true' && !navigator.onLine) {
      playWithoutStream();
      return;
    }
    audio.play().catch(()=>{
      if(audio.dataset.stream==='true') playWithoutStream();
      else toggle.textContent=labels.noAudio;
    });
  });
  audio?.addEventListener('play',()=>{
    if (audio.currentTime<.1 && scene.dataset.moment && frame===frames.length-1) show(0);
    voice?.pause();
    play(true);
  });
  audio?.addEventListener('pause',()=>play(false));
  audio?.addEventListener('ended',()=>play(false));
  voice?.addEventListener('play',()=>{audio?.pause();play(false);});
}

function externalUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

function creditLink(url, label) {
  const target = externalUrl(url);
  return target
    ? `<a href="${escape(target)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`
    : escape(label);
}

function catalogCredit(music) {
  if (music.origin !== 'catalog') return '';
  const source = creditLink(music.sourceUrl || music.url, music.provider || t('Страница трека'));
  const license = creditLink(music.licenseUrl, music.license || music.rights?.label || t('Условия использования'));
  const description = music.rights?.description ? `<p>${escape(t(music.rights.description))}</p>` : '';
  return `<section class="reading"><h2>${t("Музыка в записи")}</h2><p>${escape(music.track)} · ${escape(music.artist || t('Автор не указан'))}</p><p>${t("Источник —")} ${source}${t(". Лицензия —")} ${license}.</p>${description}<a href="music-rights.txt">${t("Сведения для публикации")}</a></section>`;
}

async function narrationForExport(day) {
  const recording = day.voiceRecording?.blob?.size ? day.voiceRecording : null;
  if (!recording && !day.narration) return null;

  const audio = recording ? recording.blob : await asset(day.narration);
  const mime = recording ? audio.type.toLowerCase().split(';')[0] : 'audio/mpeg';
  const formats = {'audio/mpeg':'mp3', 'audio/mp3':'mp3', 'audio/wav':'wav', 'audio/x-wav':'wav', 'audio/wave':'wav'};
  if (!formats[mime]) throw Error(t('Неизвестный формат озвучки.'));
  const file = 'voice.'+formats[mime];
  const voiceId = recording ? recording.voiceId : day.narrationVoice;
  const voiceName = recording ? recording.voiceName : day.narrationVoiceName;
  const model = recording ? recording.model : day.narrationModel;
  return {audio, metadata:{file, voiceId, voiceName, model, storyRevision:recording?.storyRevision, mode:voiceId ? 'auto' : undefined}};
}

function documentHTML(day, names, soundtrack, narration) {
  const {imprint,music}=day;
  const rightsLabel=music.rights?.label
    ? `<span><a href="music-rights.txt" title="${t("Условия использования трека")}">${escape(t(music.rights.label))}</a></span>`
    : '';
  const media=music.kind==='link'
    ? `<a class="plain bordered" href="${escape(externalUrl(music.url || music.sourceUrl))}" target="_blank" rel="noopener noreferrer">${music.origin==='catalog'?t('Послушать в интернете'):t('Открыть песню')}</a>`
    : `<audio id="track" controls preload="${music.kind==='remote'?'none':'metadata'}" data-stream="${music.kind==='remote'}" src="${escape(soundtrack)}"></audio>`;
  const streamingDetails = music.kind==='remote'
    ? `<p class="hint"><span id="stream-status" role="status">${t("Для прослушивания музыки нужен интернет.")}</span> ${creditLink(music.sourceUrl || music.url,t('Открыть страницу трека'))}</p>`
    : '';
  const voiceLabel = narration?.voiceName
    ? `<p>${escape(narration.voiceName)} ${t("· автоматическая подача")}</p>` : '';
  const voicePlayer = narration
    ? `${voiceLabel}<audio id="voice" controls preload="none" src="${escape(narration.file)}" aria-label="${t("Озвучка текста")}"></audio>` : '';
  // The folder carries its own numbers, so the page looks the same without the diary.
  const site=siteTokens(imprint.feelings,{hue:imprint.hue,light:imprint.place==='print'});
  const controls = {play:t('Воспроизвести'), pause:t('Пауза'), noAudio:t('Аудио недоступно'),
    silent:t('Показ кадров без звука. Для прослушивания подключитесь к интернету или откройте страницу трека.')};
  return `<!doctype html>
<html lang="${language}" data-face="${site.face}" style="${themeStyle(site)}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(imprint.title)} ${t("— Оттиск")}</title><link rel="stylesheet" href="../assets/style.css">
<body><header class="top"><span class="brand"><span class="mark">${stampSVG(imprint.feelings)}</span> ${t("Оттиск")}</span></header>
<main style="padding-top:24px">
${sceneHTML(day,names,formatDate(day.date))}
<div class="transport"><button id="play" class="primary" type="button" aria-pressed="false">${t("Воспроизвести")}</button>${names.length>1 || imprint.moments?`<button id="next" class="plain bordered">${t("Следующий кадр")}</button>`:''}<div class="track"><strong>${escape(music.track)}</strong>${rightsLabel}</div>${media}</div>
${streamingDetails}
<section class="notes"><div><h2>${t("Запись дня")}</h2><p class="story" lang="${storyLanguage(day.story)}">${escape(day.story)}</p>${voicePlayer}</div><div class="reading"><h2>${t("Как собрана сцена")}</h2><div class="mood-stamp">${stampSVG(imprint.feelings,{labels:true,title:t('Оттиск дня: ')+imprint.moodName})}</div>${rulesHTML(imprint)}${imprint.moments?`<p class="hint">${escape(momentLine(imprint))}</p>`:''}<p class="hint">${numberFormat(imprint.duration,{maximumFractionDigits:1})} ${t("с на кадр по темпу музыки.")} ${escape(motionLine(imprint.feelings))} ${escape(placeLine(imprint))}</p></div></section>
${catalogCredit(music)}
${contextPageHTML(imprint.context, imprint)}</main><script>(${offlineScene.toString()})(${JSON.stringify(controls).replace(/</g, '\\u003c')},(${applySceneMoment.toString()}));(${weatherLayer.toString()})();</script></body></html>`;
}

async function dayEntries(day, folder) {
  const entries=[];
  const names=[];
  const photos=day.photos || day.photoSources;
  for (const [i,photo] of photos.entries()) {
    const name=`photo-${i+1}${ext(photo.name||photo)}`;
    names.push(name);
    entries.push([folder+'/'+name, typeof photo==='string'?await asset(photo):photo]);
  }
  let soundtrack;
  const {music}=day;
  if(music.kind==='remote') {
    soundtrack=externalUrl(music.source);
    const source=externalUrl(music.sourceUrl || music.url);
    entries.push([`${folder}/music.txt`,`${music.track}\n${t('Для прослушивания музыки нужен интернет.')}\n${t('Аудиопоток —')} ${soundtrack}\n${t('Страница трека —')} ${source}\n`]);
  } else if(music.kind==='link') {
    const instructions=music.origin==='catalog'?t('Для прослушивания откройте ссылку при подключении к интернету.\n'):'';
    entries.push([`${folder}/music.txt`,`${music.track}\n${instructions}${externalUrl(music.url || music.sourceUrl)}\n`]);
  } else {
    const mime=music.blob?.type?.split(';')[0];
    const suffix=ext(music.blob?.name || music.source || '') || ({'audio/mpeg':'.mp3','audio/ogg':'.ogg','audio/flac':'.flac','audio/wav':'.wav','audio/mp4':'.m4a','audio/webm':'.webm','audio/aac':'.aac'})[mime] || '';
    soundtrack='music'+suffix;
    entries.push([folder+'/'+soundtrack,music.blob||await asset(music.source)]);
  }
  if(music.rights?.label || music.origin==='catalog') {
    const credits = music.origin==='catalog' ? [
      music.artist && t('Автор — ')+music.artist,
      music.provider && t('Каталог — ')+music.provider,
      externalUrl(music.sourceUrl || music.url),
      music.license && t('Лицензия — ')+music.license,
      externalUrl(music.licenseUrl)
    ] : [];
    const text=[t('Условия использования музыки'),music.track,...credits,music.rights?.label && t(music.rights.label),music.rights?.description && t(music.rights.description)].filter(Boolean).join('\n\n');
    entries.push([`${folder}/music-rights.txt`,text+'\n']);
  }
  const voice = await narrationForExport(day);
  if (voice) entries.push([`${folder}/${voice.metadata.file}`,voice.audio]);
  const {kind,track,url,analysis,origin,styleId,rights,sourceUrl,artist,license,licenseUrl,provider,creatorUrl,catalogId}=music;
  const metadata={
    date:day.date,id:day.id,created:day.created,demo:day.demo,customTitle:day.customTitle,storyRevision:day.storyRevision,
    imprint:day.imprint,reading:day.reading,frameOrigins:day.frameOrigins,narration:voice?.metadata,
    music:{kind,track,url,source:kind==='remote'?soundtrack:undefined,analysis,origin,styleId,rights,
      sourceUrl,artist,license,licenseUrl,provider,creatorUrl,catalogId,file:kind==='file'?soundtrack:undefined,
      fileMetadata:fileMetadata(music.blob)},
    photos:names,photoFiles:photos.map(fileMetadata)
  };
  entries.push([`${folder}/story.txt`,day.story],[`${folder}/memory.json`,JSON.stringify(metadata,null,2)],[`${folder}/index.html`,documentHTML(day,names,soundtrack,voice?.metadata)]);
  return entries;
}

async function download(days, filename) {
  const entries = await Promise.all(['style.css','media/title.woff2','media/sans.woff2','media/grain.webp','media/OFL.txt','media/AdwaitaSans-OFL.txt'].map(async path=>[`assets/${path}`,await asset('./'+path)]));
  const folders=new Set();
  const links=[];
  for(const day of days) {
    const base=folderName(day);
    let folder=base;
    for(let i=2;folders.has(folder);i++) folder=`${base} (${i})`;
    folders.add(folder);
    links.push(`<li><a href="${encodeURIComponent(folder)}/index.html">${escape(day.imprint.title)}</a> · ${formatDate(day.date)}</li>`);
    entries.push(...await dayEntries(day,folder));
  }
  const ordered=[...days].sort((a,b)=>a.date.localeCompare(b.date)||a.created-b.created);
  const mood=foldDiary(ordered.map(day=>day.imprint.feelings));
  entries.push(['ottisk-backup.json',JSON.stringify({format:'ottisk-archive',version:1,folders:[...folders]})]);
  entries.push(['index.html',`<!doctype html><html lang="${language}" style="${themeStyle(siteTokens(mood.state,{keep:mood.lead,keepSecond:mood.second}))}"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${t("Архив — Оттиск")}</title><link rel="stylesheet" href="assets/style.css"><body><main class="welcome"><h1>${t("Архив дней")}</h1><ul>${links.join('')}</ul></main></body></html>`]);
  const url=URL.createObjectURL(await writeZip(entries));
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`${filename}.zip`;
  anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),30_000);
}

export const downloadDay = day => download([day],folderName(day));
export const downloadArchive = days => download(days,t('Оттиск — архив'));
