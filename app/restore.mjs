import {makeImprint, photoStats} from './atmosphere.mjs';
import {cleanFeelings, IDS} from './feelings.mjs';
import {readZip, validFileName} from './zip.mjs';

const decoder=new TextDecoder('utf-8',{fatal:true});
const megabyte=1024*1024;
const invalid=()=>new Error('Invalid Ottisk backup');
const string=(value,max)=>typeof value==='string' && value.length<=max ? value : undefined;
const revision=value=>Number.isSafeInteger(value) && value>=0 ? value : undefined;
const language=value=>['ru','kk','en'].includes(value) ? value : undefined;
const within=(value,min,max)=>Number.isFinite(value) && value>=min && value<=max;
const feelingIds=new Set(IDS);
const mimeByExtension={
  jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', gif:'image/gif', avif:'image/avif',
  heic:'image/heic', heif:'image/heif', bmp:'image/bmp', ico:'image/x-icon',
  mp3:'audio/mpeg', ogg:'audio/ogg', opus:'audio/ogg', flac:'audio/flac', wav:'audio/wav', m4a:'audio/mp4',
  mp4:'audio/mp4', webm:'audio/webm', aac:'audio/aac', aif:'audio/aiff', aiff:'audio/aiff'
};

function safeUrl(value) {
  if (!string(value,4096)) return undefined;
  try {
    const url=new URL(value);
    if (['https:','http:'].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch { /* Missing or malformed URLs cannot become links or media sources. */ }
}

async function readText(zip,name,max) {
  return decoder.decode(await (await zip.get(name,max)).arrayBuffer());
}

function restoreReading(data,title,imprint) {
  const saved=data?.feelings ?? imprint?.text;
  if (!saved || !IDS.every(id=>within(saved[id],0,1))) throw invalid();
  const source=['own','server','ai','local','manual'].includes(data?.source) ? data.source : 'local';
  const quotes=data?.evidence?.quotes, ids=data?.evidence?.feelings;
  const evidence=Array.isArray(quotes) && quotes.length<=8 && quotes.every(quote=>typeof quote==='string' && quote.length<=1000)
    && Array.isArray(ids) && ids.length<=8 && ids.every(id=>feelingIds.has(id)) ? {quotes,feelings:ids} : undefined;
  const values=data?.moments;
  const moments=Array.isArray(values) && values.length===2 && values.every(moment=>moment && IDS.every(id=>within(moment[id],0,1)))
    ? values.map(cleanFeelings) : undefined;
  return {title:string(data?.title,6000)?.trim() || title, feelings:cleanFeelings(saved), moments, source, evidence, model:string(data?.model,300),
    language:language(data?.language), reasonLanguage:language(data?.reasonLanguage), reason:string(data?.reason,6000),
    fallback:['ai','server'].includes(data?.fallback) ? data.fallback : undefined};
}

async function mediaFile(zip,folder,name,metadata,group,max) {
  if (!validFileName(name)) throw invalid();
  const blob=await zip.get(folder+'/'+name,max*megabyte);
  if (!blob.size) throw invalid();
  const originalName=validFileName(metadata?.name) ? metadata.name : name;
  const extension=name.split('.').at(-1).toLowerCase();
  const declared=string(metadata?.type,100)?.split(';')[0].toLowerCase();
  const type=[declared,mimeByExtension[extension]].find(value=>value?.startsWith(group+'/') && value!=='image/svg+xml') ?? '';
  return new File([blob],originalName,{type,lastModified:revision(metadata?.lastModified) ?? 0});
}

async function restoreMusic(zip,folder,data) {
  const {kind,analysis}=data ?? {};
  const track=string(data?.track,1024);
  if (!track || !['file','remote','link'].includes(kind) || !analysis
    || !(analysis.bpm==null || within(analysis.bpm,1,300))
    || !within(analysis.energy,0,1) || !within(analysis.tone,-1,1)
    || !within(analysis.confidence,0,1)) throw invalid();
  const music={
    kind,track,origin:string(data.origin,80),styleId:string(data.styleId,80),artist:string(data.artist,1024),
    provider:string(data.provider,120),catalogId:string(data.catalogId,300),license:string(data.license,300),
    sourceUrl:safeUrl(data.sourceUrl),licenseUrl:safeUrl(data.licenseUrl),creatorUrl:safeUrl(data.creatorUrl),
    rights:string(data.rights?.label,300) ? {label:data.rights.label,description:string(data.rights.description,2000) || ''} : undefined,
    analysis:{bpm:analysis.bpm ?? null, energy:analysis.energy,tone:analysis.tone,confidence:analysis.confidence,
      heard:analysis.heard===true,mode:['major','minor'].includes(analysis.mode)?analysis.mode:undefined,key:string(analysis.key,30)}
  };
  if (kind==='file') {
    // Earlier Ottisk archives stored the media but did not include its filename in memory.json.
    const filename=data.file ?? zip.names.find(name=>name.startsWith(folder+'/') && /^music(?:\.\w{1,8})?$/u.test(name.slice(folder.length+1)))?.slice(folder.length+1);
    if (!/^music(?:\.\w{1,8})?$/u.test(filename)) throw invalid();
    music.blob=await mediaFile(zip,folder,filename,data.fileMetadata,'audio',25);
  } else {
    music.url=safeUrl(data.url) || music.sourceUrl;
    music.source=safeUrl(data.source);
    if (kind==='remote' ? !music.source : !music.url) throw invalid();
  }
  return music;
}

async function restoreDay(zip,folder,metadata) {
  const {id,date,photos}=metadata;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(id) || !/^\d{4}-\d{2}-\d{2}$/u.test(date)
    || !Array.isArray(photos) || !photos.length || photos.length>12 || new Set(photos).size!==photos.length) throw invalid();
  const timestamp=new Date(date+'T12:00:00Z');
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString().slice(0,10)!==date) throw invalid();
  const story=await readText(zip,folder+'/story.txt',24_000);
  const title=string(metadata.imprint?.title,6000)?.trim();
  if (!story.trim() || story.length>6000 || !title) throw invalid();
  const customTitle=string(metadata.customTitle,250)?.trim() || undefined;
  const reading=restoreReading(metadata.reading,title,metadata.imprint);
  const frames=[];
  const photoData=[];
  // Decode serially, since each source may be a full-sized photograph.
  for (const [index,name] of photos.entries()) {
    if (!/^photo-\d+(?:\.\w{1,8})?$/u.test(name)) throw invalid();
    const frame=await mediaFile(zip,folder,name,metadata.photoFiles?.[index],'image',20);
    photoData.push(await photoStats(frame));
    frames.push(frame);
  }
  const music=await restoreMusic(zip,folder,metadata.music);
  const frameOrigins=photos.map((_,index)=>{
    const origin=metadata.frameOrigins?.[index];
    return origin?.type==='generated' ? {type:'generated',provider:string(origin.provider,300),model:string(origin.model,300),style:string(origin.style,300)} : {type:'upload'};
  });
  const storyRevision=revision(metadata.storyRevision);
  let voiceRecording=null;
  if (metadata.narration) {
    const {file,voiceId,voiceName,model}=metadata.narration;
    if (!/^voice\.(?:mp3|wav)$/u.test(file)) throw invalid();
    voiceRecording={blob:await mediaFile(zip,folder,file,null,'audio',128), voiceId:string(voiceId,120) || 'recording',
      voiceName:string(voiceName,300) || string(voiceId,120) || 'Оттиск', model:string(model,300),
      storyRevision:revision(metadata.narration.storyRevision) ?? storyRevision};
  }
  const imprint=makeImprint(story,photoData,music.analysis,reading,date);
  imprint.title=customTitle || title;
  return {id,date,created:revision(metadata.created) ?? timestamp.getTime(),story,storyRevision,customTitle,
    photos:frames,photoData,frameOrigins,reading,music,imprint,voiceRecording};
}

export async function readBackup(file,demoIds) {
  const zip=await readZip(file);
  let folders;
  if (zip.names.includes('ottisk-backup.json')) {
    const manifest=JSON.parse(await readText(zip,'ottisk-backup.json',4*megabyte));
    if (manifest?.format!=='ottisk-archive' || manifest.version!==1 || !Array.isArray(manifest.folders)) throw invalid();
    folders=manifest.folders;
  } else {
    folders=zip.names.filter(name=>/^[^/]+\/memory\.json$/u.test(name)).map(name=>name.split('/')[0]);
  }
  if (!folders.length || !folders.every(validFileName) || new Set(folders).size!==folders.length) throw invalid();
  const days=[];
  for (const folder of folders) {
    const metadata=JSON.parse(await readText(zip,folder+'/memory.json',256*1024));
    if (!metadata || typeof metadata!=='object') throw invalid();
    if (metadata.demo===true || demoIds.has(metadata.id)) continue;
    days.push(await restoreDay(zip,folder,metadata));
  }
  return days;
}
