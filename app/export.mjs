import {foldDiary, siteTokens} from './feelings.mjs';
import {escape, rulesHTML, sceneHTML, stampSVG, themeStyle} from './scene.mjs';

const encoder = new TextEncoder();
const dateFormat = new Intl.DateTimeFormat('ru-RU',{day:'numeric', month:'long', year:'numeric', timeZone:'UTC'});
const formatDate = date => dateFormat.format(new Date(date+'T12:00:00Z')).replace(' г.','');

const crcTable = Uint32Array.from({length:256},(_,index)=>{
  let value=index;
  for(let bit=0;bit<8;bit++) value=(value>>>1)^((value&1)?0xedb88320:0);
  return value;
});

function crc32(bytes) {
  let value=0xffffffff;
  for (const byte of bytes) value=(value>>>8)^crcTable[(value^byte)&255];
  return (value^0xffffffff)>>>0;
}

function writeRecord(size, words, shorts) {
  const view=new DataView(new ArrayBuffer(size));
  for (const [position,value] of words) view.setUint32(position,value,true);
  for (const [position,value] of shorts) view.setUint16(position,value,true);
  return view.buffer;
}

async function zip(entries) {
  const contents=[];
  const directory=[];
  let offset=0, directoryLength=0;
  if(entries.length>65535) throw Error('Слишком много файлов.');
  for (const [filename, entry] of entries) {
    const path=encoder.encode(filename);
    const bytes=typeof entry==='string'?encoder.encode(entry):new Uint8Array(await entry.arrayBuffer());
    const checksum=crc32(bytes);
    const size=bytes.length;
    if(offset+size+30+path.length>=0xffffffff) throw Error('Архив слишком велик.');
    const flags=0x800;
    contents.push(writeRecord(30,[[0,0x04034b50],[14,checksum],[18,size],[22,size]],[[4,20],[6,flags],[12,33],[26,path.length]]),path,bytes);
    // Marked as made on Unix with ordinary file permissions: Info-ZIP on Linux then keeps Cyrillic folder names.
    directory.push(writeRecord(46,[[0,0x02014b50],[16,checksum],[20,size],[24,size],[38,0x81a40000],[42,offset]],[[4,0x0314],[6,20],[8,flags],[14,33],[28,path.length]]),path);
    offset+=30+path.length+size;
    directoryLength+=46+path.length;
  }
  if(offset+directoryLength+22>=0xffffffff) throw Error('Архив слишком велик.');
  const end=writeRecord(22,[[0,0x06054b50],[12,directoryLength],[16,offset]],[[8,entries.length],[10,entries.length]]);
  return new Blob([...contents,...directory,end],{type:'application/zip'});
}

const clean = text => text.replace(/[^\p{L}\p{N} ._–-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,90).replace(/[. ]+$/u,'');
const folderName = day => `${clean(day.imprint.title)} — ${day.date}`;
const ext = name => /^\w{1,8}$/u.test(name.split('.').at(-1)) && name.includes('.') ? '.'+name.split('.').at(-1).toLowerCase() : '';
async function asset(url) {
  const response=await fetch(url);
  if(!response.ok) throw Error('Файл недоступен.');
  return response.blob();
}

function offlineScene() {
  const scene=document.querySelector('.memory');
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
  }
  function play(value) {
    clearInterval(timer);
    active=value;
    toggle.textContent=value?'Пауза':'Воспроизвести';
    toggle.setAttribute('aria-pressed',String(value));
    scene.classList.toggle('playing',value);
    if(value && frames.length>1) timer=setInterval(()=>show(frame+1),Number(scene.dataset.duration)*1000);
  }
  document.querySelector('#next')?.addEventListener('click',()=>show(frame+1));
  dots.forEach((dot,index)=>dot.addEventListener('click',()=>show(index)));
  toggle.addEventListener('click',()=>{
    if(!audio) {if(!active) voice?.pause();play(!active);return;}
    if(active) {
      audio.pause();
      play(false);
      return;
    }
    audio.play().catch(()=>{
      if(audio.dataset.stream==='true') {
        play(true);
        document.querySelector('#stream-status').textContent='Показ кадров без звука. Для прослушивания подключитесь к интернету или откройте страницу трека.';
      } else toggle.textContent='Аудио недоступно';
    });
  });
  audio?.addEventListener('play',()=>{voice?.pause();play(true);});
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
  const source = creditLink(music.sourceUrl || music.url, music.provider || 'Страница трека');
  const license = creditLink(music.licenseUrl, music.license || music.rights?.label || 'Условия использования');
  const description = music.rights?.description ? `<p>${escape(music.rights.description)}</p>` : '';
  return `<section class="reading"><h2>Музыка в записи</h2><p>${escape(music.track)} · ${escape(music.artist || 'Автор не указан')}</p><p>Источник — ${source}. Лицензия — ${license}.</p>${description}<a href="music-rights.txt">Сведения для публикации</a></section>`;
}

async function narrationForExport(day) {
  const recording = day.voiceRecording?.blob?.size ? day.voiceRecording : null;
  if (!recording && !day.narration) return null;

  const audio = recording ? recording.blob : await asset(day.narration);
  const mime = recording ? audio.type.toLowerCase().split(';')[0] : 'audio/mpeg';
  const formats = {'audio/mpeg':'mp3', 'audio/mp3':'mp3', 'audio/wav':'wav', 'audio/x-wav':'wav', 'audio/wave':'wav'};
  if (!formats[mime]) throw Error('Неизвестный формат озвучки.');
  const file = 'voice.'+formats[mime];
  const voiceId = recording ? recording.voiceId : day.narrationVoice;
  const voiceName = recording ? recording.voiceName : day.narrationVoiceName;
  const model = recording ? recording.model : day.narrationModel;
  return {audio, metadata:{file, voiceId, voiceName, model, mode:voiceId ? 'auto' : undefined}};
}

function documentHTML(day, names, soundtrack, narration) {
  const {imprint,music}=day;
  const rightsLabel=music.rights?.label
    ? `<span><a href="music-rights.txt" title="Условия использования трека">${escape(music.rights.label)}</a></span>`
    : '';
  const media=music.kind==='link'
    ? `<a class="plain bordered" href="${escape(externalUrl(music.url || music.sourceUrl))}" target="_blank" rel="noopener noreferrer">${music.origin==='catalog'?'Послушать в интернете':'Открыть песню'}</a>`
    : `<audio id="track" controls preload="${music.kind==='remote'?'none':'metadata'}" data-stream="${music.kind==='remote'}" src="${escape(soundtrack)}"></audio>`;
  const streamingDetails = music.kind==='remote'
    ? `<p class="hint"><span id="stream-status" role="status">Для прослушивания музыки нужен интернет.</span> ${creditLink(music.sourceUrl || music.url,'Открыть страницу трека')}</p>`
    : '';
  const voiceLabel = narration?.voiceName
    ? `<p>${escape(narration.voiceName)} · автоматическая подача</p>` : '';
  const voicePlayer = narration
    ? `${voiceLabel}<audio id="voice" controls preload="none" src="${escape(narration.file)}" aria-label="Озвучка текста"></audio>` : '';
  // The folder carries its own numbers, so the page looks the same without the diary.
  const site=siteTokens(imprint.feelings,{hue:imprint.hue});
  return `<!doctype html>
<html lang="ru" data-face="${site.face}" style="${themeStyle(site)}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(imprint.title)} — Оттиск</title><link rel="stylesheet" href="../assets/style.css">
<body><header class="top"><span class="brand"><span class="mark">${stampSVG(imprint.feelings)}</span> Оттиск</span></header>
<main style="padding-top:24px">
${sceneHTML(day,names,formatDate(day.date))}
<div class="transport"><button id="play" class="primary" type="button" aria-pressed="false">Воспроизвести</button>${names.length>1?'<button id="next" class="plain bordered">Следующий кадр</button>':''}<div class="track"><strong>${escape(music.track)}</strong>${rightsLabel}</div>${media}</div>
${streamingDetails}
<section class="notes"><div><h2>Запись дня</h2><p class="story">${escape(day.story)}</p>${voicePlayer}</div><div class="reading"><h2>Как собрана сцена</h2><div class="mood-stamp">${stampSVG(imprint.feelings,{labels:true,title:'Оттиск дня: '+imprint.moodName})}</div>${rulesHTML(imprint)}<p class="hint">${imprint.duration.toFixed(1)} с на кадр по темпу музыки.</p></div></section>
${catalogCredit(music)}
</main><script>(${offlineScene.toString()})();</script></body></html>`;
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
    entries.push([`${folder}/music.txt`,`${music.track}\nДля прослушивания музыки нужен интернет.\nАудиопоток — ${soundtrack}\nСтраница трека — ${source}\n`]);
  } else if(music.kind==='link') {
    const instructions=music.origin==='catalog'?'Для прослушивания откройте ссылку при подключении к интернету.\n':'';
    entries.push([`${folder}/music.txt`,`${music.track}\n${instructions}${externalUrl(music.url || music.sourceUrl)}\n`]);
  } else {
    const mime=music.blob?.type?.split(';')[0];
    const suffix=ext(music.blob?.name || music.source || '') || ({'audio/mpeg':'.mp3','audio/ogg':'.ogg','audio/flac':'.flac','audio/wav':'.wav','audio/mp4':'.m4a','audio/webm':'.webm','audio/aac':'.aac'})[mime] || '';
    soundtrack='music'+suffix;
    entries.push([folder+'/'+soundtrack,music.blob||await asset(music.source)]);
  }
  if(music.rights?.label || music.origin==='catalog') {
    const credits = music.origin==='catalog' ? [
      music.artist && 'Автор — '+music.artist,
      music.provider && 'Каталог — '+music.provider,
      externalUrl(music.sourceUrl || music.url),
      music.license && 'Лицензия — '+music.license,
      externalUrl(music.licenseUrl)
    ] : [];
    const text=['Условия использования музыки',music.track,...credits,music.rights?.label,music.rights?.description].filter(Boolean).join('\n\n');
    entries.push([`${folder}/music-rights.txt`,text+'\n']);
  }
  const voice = await narrationForExport(day);
  if (voice) entries.push([`${folder}/${voice.metadata.file}`,voice.audio]);
  const {kind,track,url,analysis,origin,styleId,rights,sourceUrl,artist,license,licenseUrl,provider}=music;
  const metadata={date:day.date,id:day.id,imprint:day.imprint,music:{kind,track,url,source:kind==='remote'?soundtrack:undefined,analysis,origin,styleId,rights,sourceUrl,artist,license,licenseUrl,provider},photos:names,frameOrigins:day.frameOrigins,narration:voice?.metadata,reading:day.reading};
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
  entries.push(['index.html',`<!doctype html><html lang="ru" style="${themeStyle(siteTokens(mood.state,{keep:mood.lead,keepSecond:mood.second}))}"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Архив — Оттиск</title><link rel="stylesheet" href="assets/style.css"><body><main class="welcome"><h1>Архив дней</h1><ul>${links.join('')}</ul></main></body></html>`]);
  const url=URL.createObjectURL(await zip(entries));
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`${filename}.zip`;
  anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),30_000);
}

export const downloadDay = day => download([day],folderName(day));
export const downloadArchive = days => download(days,'Оттиск — архив');
