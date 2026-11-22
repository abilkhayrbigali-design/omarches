import {recommendTracks} from './recommend.mjs';

// The nearest diary examples suggest sound, not a particular recording. Only
// public musical terms from this vocabulary are sent to the music catalogue.
const atmospheres = {
  maple: {name:'тёплым моментам', terms:['acoustic', 'folk', 'guitar', 'mellow']},
  office: {name:'напряжённому ритму', terms:['electronic', 'synth', 'techno', 'driving']},
  train: {name:'ощущению движения', terms:['cinematic', 'uplifting', 'indie', 'instrumental']},
  rain: {name:'тихой, задумчивой сцене', terms:['piano', 'ambient', 'minimal', 'downtempo']},
  lake: {name:'ощущению простора', terms:['ambient', 'atmospheric', 'instrumental', 'acoustic']},
  cake: {name:'праздничному настроению', terms:['dance', 'funk', 'disco', 'upbeat']}
};

// Explicit instruments and genres take precedence over an inferred atmosphere.
const instruments = [
  ['piano', /пианино|фортепиано|роял[ьяеию]|\bpiano\b/u],
  ['guitar', /гитар|\bguitar\b/u],
  ['violin', /скрипк|\bviolin\b/u],
  ['cello', /виолончел|\bcello\b/u],
  ['saxophone', /саксофон|\bsax(?:ophone)?\b/u],
  ['flute', /флейт|\bflute\b/u],
  ['jazz', /джаз|\bjazz\b/u],
  ['blues', /блюз|\bblues\b/u],
  ['classical', /классическ.{0,12}музык|оркестр|симфони|\bclassical\b/u],
  ['rock', /(?:^|[^а-яa-z])рок(?:[^а-яa-z]|$)|роков[а-я]*\s+музык|\brock\b/u],
  ['metal', /металл?кор|хеви.{0,3}метал|метал.{0,4}групп|\bmetal\b/u],
  ['electronic', /электронн[а-я]*\s+(?:музык|бит|звуч)|электроник[ауи]|\belectronic\b/u],
  ['techno', /(?:^|[^а-я])техно(?:[^а-я]|$)|\btechno\b/u],
  ['hip hop', /хип.{0,2}хоп|(?:^|[^а-я])[рp][еэ]п(?:[^а-я]|$)|\bhip[ -]?hop\b/u],
  ['lofi', /лоу?.{0,2}ф[аи]й?|\blo[ -]?fi\b/u],
  ['ambient', /эмбиент|эмбиэнт|амбиент|\bambient\b/u],
  ['reggae', /регги|\breggae\b/u],
  ['acoustic', /акустич|акустик[ауе]|\bacoustic\b/u],
  ['drums', /ударн(?:ые|ых|ыми)|барабан|\bdrums?\b/u]
];

const alternatives = {
  piano:['keys','keyboard'], guitar:['guitars','guitarra'], violin:['strings','fiddle'],
  saxophone:['sax'], synth:['synthesizer','synthwave'], electronic:['electronica','electro'],
  mellow:['soft','calm','warm'], minimal:['minimalist','minimalism'],
  cinematic:['soundtrack','orchestral'], uplifting:['hopeful','inspiring'], driving:['energetic','intense'],
  atmospheric:['soundscape','ethereal'], upbeat:['happy','joyful'], dance:['danceable','dancing'],
  instrumental:['instrumentals'], lofi:['lo fi','lofi'], 'hip hop':['hiphop','rap'], drums:['percussion']
};
const defaultTerms = ['instrumental', 'acoustic', 'electronic', 'ambient'];

function musicSignals(story) {
  const text = String(story ?? '').toLocaleLowerCase('ru').replaceAll('ё','е').slice(0,6000);
  const requested = [];
  const omitted = new Set();
  for (const [term, pattern] of instruments) {
    const match = pattern.exec(text);
    if (!match) continue;
    const before = text.slice(Math.max(0, match.index - 35), match.index).trimEnd();
    if (/(?:^|\s)(?:без|кроме|никаког[оа]|никаких|не хочу|не люблю|не нравится|не надо|только не)\s*$/u.test(before)) {
      omitted.add(term);
    } else {
      requested.push(term);
    }
  }
  const closest = recommendTracks(text).filter(match=>match.matched);
  const primary = closest.length ? atmospheres[closest[0].id] : null;
  const secondary = closest.length>1 && closest[1].score >= closest[0].score * .60
    ? atmospheres[closest[1].id] : null;
  const terms = [...new Set([...requested, ...(primary?.terms || []), ...(secondary?.terms || []), ...defaultTerms])]
    .filter(term => !omitted.has(term));
  return {requested, omitted, primary, terms};
}

export function musicQuery(story) {
  const {requested, primary, terms} = musicSignals(story);
  let reason = 'Подборка инструментальной музыки для вашей записи.';
  if (requested.length) {
    reason = 'В рассказе упоминается музыка. Поисковые теги — '+requested.join(', ')+'.';
  } else if (primary) {
    reason = 'По описанию дня ищем музыку к '+primary.name+'.';
  }
  return {terms, reason};
}

function indexedText(value) {
  return ' ' + String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/gu,' ').trim() + ' ';
}

function trackTags(record) {
  const metadata = [record.tags || [], record.genres || []].flat();
  return indexedText(metadata.map(tag => typeof tag === 'string' ? tag : tag?.name).join(' '));
}

function containsTerm(field, term) {
  return [term, ...(alternatives[term] || [])].some(word=>field.includes(' '+word+' '));
}

export function rankOnlineTracks(story, records) {
  const {terms, omitted} = musicSignals(story);
  return records.map((record, index)=>{
    const tags = trackTags(record);
    const title = indexedText(record.title);
    const description = indexedText(record.description);
    let score = 0;
    for (const [i, term] of terms.entries()) {
      const evidence = Math.max(containsTerm(tags, term) ? 1 : 0,
        containsTerm(title, term) ? .75 : 0, containsTerm(description, term) ? .4 : 0);
      score += evidence / (i + 1);
    }
    for (const term of omitted) {
      if (containsTerm(tags, term) || containsTerm(title, term)) score -= 2;
    }
    return {record, index, score};
  }).sort((a,b)=> b.score - a.score || a.index - b.index).map(item=>item.record);
}
