import {cleanFeelings, feelingLabel, localReading, localTitle, sceneTokens, withMusic, withPhotos} from './feelings.mjs';

const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
const mean = numbers => numbers.reduce((sum, n) => sum+n, 0)/numbers.length;

export function RGBtoHSL(r,g,b) {
  const rgb = [r,g,b].map(v=>v/255);
  const [red,green,blue] = rgb, max = Math.max(...rgb), min = Math.min(...rgb), span = max-min, light=(max+min)/2;
  if (!span) return [0,0,light*100];
  const hue = max===red ? (green-blue)/span : max===green ? (blue-red)/span+2 : (red-green)/span+4;
  return [(hue*60+360)%360, span/(1-Math.abs(2*light-1))*100, light*100];
}

export async function photoStats(source) {
  // createImageBitmap decodes off the rendering path, so the diary also opens in a background tab.
  let blob = source;
  if (typeof source === 'string') {
    const response = await fetch(source);
    if (!response.ok) throw Error('Фотография недоступна.');
    blob = await response.blob();
  }
  const image = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width=48; canvas.height=48;
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    ctx.drawImage(image,0,0,48,48);
    const data = ctx.getImageData(0,0,48,48).data;
    const bins = Array.from({length:24},()=>({count:0,x:0,y:0,sat:0}));
    const lightness = new Float32Array(48*48);
    let light=0, total=0, warm=0, colour=0;
    for (let i=0;i<data.length;i+=4) {
      if (data[i+3]<128) { lightness[i/4]=-1; continue; }
      const [h,s,l] = RGBtoHSL(data[i],data[i+1],data[i+2]);
      lightness[i/4]=l;
      light+=l;
      total++;
      // Warm light sits around orange, cold light opposite it; grey pixels say nothing.
      const vivid = l<8 || l>95 ? 0 : s/100;
      warm+=Math.cos((h-30)*Math.PI/180)*vivid;
      colour+=vivid;
      if (s<13 || l<12 || l>92) continue;
      const bin = bins[Math.min(23,Math.floor(h/15))];
      const weight=s/100;
      bin.count+=weight;
      bin.x+=Math.cos(h*Math.PI/180)*weight;
      bin.y+=Math.sin(h*Math.PI/180)*weight;
      bin.sat+=s*weight;
    }
    if (!total) throw Error('Фотография полностью прозрачна.');
    const dominant=bins.reduce((a,b)=>a.count>b.count?a:b);
    const average=light/total;
    let spread=0, edges=0, pairs=0;
    for (let y=0;y<48;y++) for (let x=0;x<48;x++) {
      const here=lightness[y*48+x];
      if (here<0) continue;
      spread+=(here-average)**2;
      for (const next of [x<47 ? lightness[y*48+x+1] : -1, y<47 ? lightness[(y+1)*48+x] : -1]) {
        if (next>=0) { edges+=Math.abs(here-next); pairs++; }
      }
    }
    return {
      hue:(Math.atan2(dominant.y,dominant.x)*180/Math.PI+360)%360, sat:dominant.count ? dominant.sat/dominant.count:0, light:average, weight:dominant.count/total,
      // From -1 (cold) to 1 (warm); the rest from 0 to 1.
      warm:clamp(warm/total*1.4,-1,1), colourful:clamp(colour/total*1.6,0,1),
      contrast:clamp(Math.sqrt(spread/total)/40,0,1), detail:clamp(pairs ? edges/pairs/16 : 0,0,1)
    };
  } finally {
    image.close();
  }
}

export function linkMusic(bpm, character) {
  const profile = {soft:[.24,-.2], driving:[.90,0], wistful:[.35,-.65], bright:[.69,.65]}[character];
  return {bpm:+bpm, energy:profile[0], tone:profile[1], confidence:1};
}

// Major or minor, by the Krumhansl–Schmuckler method: fold the spectrum into twelve
// pitch classes and compare the result with the profile of every key.
const MAJOR = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
const KEYS = ['до','до-диез','ре','ми-бемоль','ми','фа','фа-диез','соль','ля-бемоль','ля','си-бемоль','си'];

function spectrum(real, imaginary) {
  const size=real.length;
  for (let i=1, j=0; i<size; i++) {
    let bit=size>>1;
    for (; j&bit; bit>>=1) j^=bit;
    j^=bit;
    if (i<j) { [real[i],real[j]]=[real[j],real[i]]; [imaginary[i],imaginary[j]]=[imaginary[j],imaginary[i]]; }
  }
  for (let length=2; length<=size; length<<=1) {
    const angle=-2*Math.PI/length;
    const stepR=Math.cos(angle), stepI=Math.sin(angle);
    for (let start=0; start<size; start+=length) {
      let wr=1, wi=0;
      for (let k=0; k<length/2; k++) {
        const a=start+k, b=a+length/2;
        const tr=real[b]*wr-imaginary[b]*wi, ti=real[b]*wi+imaginary[b]*wr;
        real[b]=real[a]-tr; imaginary[b]=imaginary[a]-ti;
        real[a]+=tr; imaginary[a]+=ti;
        [wr,wi]=[wr*stepR-wi*stepI, wr*stepI+wi*stepR];
      }
    }
  }
}

function correlation(a, b) {
  const meanA=mean(a), meanB=mean(b);
  let top=0, da=0, db=0;
  for (let i=0;i<a.length;i++) { top+=(a[i]-meanA)*(b[i]-meanB); da+=(a[i]-meanA)**2; db+=(b[i]-meanB)**2; }
  return da && db ? top/Math.sqrt(da*db) : 0;
}

export function audioTone(samples, sampleRate) {
  const step=Math.max(1,Math.round(sampleRate/11025));
  const rate=sampleRate/step;
  const length=Math.min(Math.floor(samples.length/step),Math.round(rate*75));
  const size=4096;
  if (length<size*2) return {tone:0, mode:null, key:null, strength:0};
  const sound=new Float32Array(length);
  for (let i=0;i<length;i++) { let sum=0; for (let k=0;k<step;k++) sum+=samples[i*step+k]; sound[i]=sum/step; }
  const chroma=new Array(12).fill(0);
  const real=new Float64Array(size), imaginary=new Float64Array(size), magnitude=new Float64Array(size/2);
  for (let start=0; start+size<=length; start+=size/2) {
    for (let i=0;i<size;i++) { real[i]=sound[start+i]*(.5-.5*Math.cos(2*Math.PI*i/(size-1))); imaginary[i]=0; }
    spectrum(real,imaginary);
    for (let k=0;k<size/2;k++) magnitude[k]=Math.hypot(real[k],imaginary[k]);
    // Only spectral peaks between A2 and A6 count as notes.
    for (let k=Math.ceil(110*size/rate); k<Math.min(size/2-1,Math.floor(1760*size/rate)); k++) {
      if (magnitude[k]<=magnitude[k-1] || magnitude[k]<magnitude[k+1]) continue;
      const note=Math.round(69+12*Math.log2(k*rate/size/440));
      chroma[((note%12)+12)%12]+=magnitude[k];
    }
  }
  if (!chroma.some(Boolean)) return {tone:0, mode:null, key:null, strength:0};
  let major={score:-2}, minor={score:-2};
  for (let root=0; root<12; root++) {
    const turned=chroma.map((_,index)=>chroma[(index+root)%12]);
    const asMajor=correlation(turned,MAJOR), asMinor=correlation(turned,MINOR);
    if (asMajor>major.score) major={score:asMajor,root};
    if (asMinor>minor.score) minor={score:asMinor,root};
  }
  const lead=major.score>=minor.score ? major : minor;
  const gap=major.score-minor.score;
  // A major key and its relative minor share their notes. When the two readings are
  // this close the method cannot tell them apart, so it abstains instead of guessing.
  if (Math.abs(gap)<.06) return {tone:0, mode:null, key:null, strength:Math.round(lead.score*100)/100};
  const tone=clamp(gap*3.2,-1,1)*clamp(lead.score*1.25,0,1);
  return {tone:Math.round(tone*100)/100, mode:gap>0 ? 'major' : 'minor', key:KEYS[lead.root], strength:Math.round(lead.score*100)/100};
}

export async function audioStats(file) {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) throw Error('Этот браузер не поддерживает анализ аудио. Можно добавить песню ссылкой.');
  const audio = new Audio();
  let buffer;
  try {
    buffer = await audio.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw Error('Не удалось открыть аудио. Попробуйте MP3, WAV или ссылку на трек.');
  } finally {
    await audio.close().catch(()=>{});
  }
  const samples = buffer.getChannelData(0);
  const hop = Math.round(buffer.sampleRate/50);
  const size = Math.min(Math.floor(samples.length/hop),1500);
  const heard=audioTone(samples,buffer.sampleRate);
  if (!size) return {bpm:100,energy:.5,tone:heard.tone,mode:heard.mode,key:heard.key,confidence:0};
  const signal = [];
  let peakAccent = 0;
  let pre = 0;
  for(let t=0;t<size;t++){
    let square=0, high=0;
    for(let i=t*hop;i<(t+1)*hop;i+=4){
      square+=samples[i]**2; high+=(samples[i]-(samples[i-4]||0))**2;
    }
    const loud = Math.sqrt(square / Math.ceil(hop/4));
    const level = Math.log1p(15*loud+8*Math.sqrt(high/Math.ceil(hop/4)));
    const onset = Math.max(0, level-pre);
    signal.push(onset);
    if (t>1) peakAccent = Math.max(peakAccent,onset);
    pre=level;
  }
  const avg=mean(signal);
  const power = signal.reduce((sum,value)=>sum+(value-avg)**2,0)||1;
  let best=0, lag=30;
  for(let d=17;d<=50 && d<size/4;d++){
    let score=0;
    for(let i=d;i<size;i++) score+=(signal[i]-avg)*(signal[i-d]-avg);
    score/=power;
    if(score>best){best=score;lag=d;}
  }
  const confidence=peakAccent>.025 && best>.18 ? best:0;
  let accents=0;
  for(let i=2;i<size-1;i++){
    if(signal[i]>Math.max(.035,avg+peakAccent*.22) && signal[i]>=signal[i-1] && signal[i]>signal[i+1]) accents++;
  }
  return {bpm:confidence ? Math.round(3000/lag):null, energy:clamp(accents/(size/50*6),.10,1), tone:heard.tone, mode:heard.mode, key:heard.key, confidence};
}

// Text gives the eight numbers. Photographs lean them by the warmth, density and light of
// the frames, then music nudges pace and brightness. The photo also gives the scene its hue.
// `reading` is {feelings, title, ...} from the language model or from the dictionary on the device.
export function makeImprint(story, photos, audio, reading) {
  if (!story.trim() || !photos.length) throw Error('Добавьте текст и хотя бы один кадр.');
  const read = reading?.feelings ? reading : localReading(story);
  const text = cleanFeelings(read.feelings);
  const pictured = withPhotos(text, photos);
  const feelings = withMusic(pictured, audio);
  const photo = photos.reduce((a,b)=>a.weight>b.weight?a:b);
  const light = mean(photos.map(frame=>frame.light));
  const sentences = story.trim().split(/(?<=[.!?…])\s+|\n+/u).filter(Boolean);
  const caption = [...sentences].sort((a,b)=>Math.abs(a.length-83)-Math.abs(b.length-83))[0];
  const excerpt = caption.length > 152 ? caption.slice(0,148).replace(/\s+\S*$/u,'')+'…' : caption;
  return {
    v:3, title:String(read.title || '').trim() || localTitle(story), excerpt, text, pictured, feelings, moodName:feelingLabel(feelings),
    light, photoHue:Math.round(photo.hue), photoSat:Math.round(photo.sat), ...sceneTokens(feelings, {...photo, light}, audio)
  };
}
