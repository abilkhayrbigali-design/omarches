// A day is described by eight numbers from 0 to 1. They sit on a wheel so that
// every feeling faces its opposite: index i and index i + 4 form a pair.
export const FEELINGS = [
  {id:'joy', name:'Радость', hue:44, sat:72},
  {id:'festive', name:'Праздник', hue:334, sat:68},
  {id:'tension', name:'Напряжение', hue:6, sat:66},
  {id:'solitude', name:'Уединение', hue:202, sat:30},
  {id:'sadness', name:'Грусть', hue:226, sat:36},
  {id:'quiet', name:'Тишина', hue:256, sat:16},
  {id:'calm', name:'Покой', hue:156, sat:30},
  {id:'warmth', name:'Тепло', hue:24, sat:62}
];
export const IDS = FEELINGS.map(feeling => feeling.id);
const BY_ID = new Map(FEELINGS.map(feeling => [feeling.id, feeling]));
export const opposite = id => IDS[(IDS.indexOf(id) + 4) % 8];
export const feelingName = id => BY_ID.get(id).name;

// Each pair owns one layer of the design, so mixed days never fight over the same control.
export const PAIRS = [
  {a:'joy', b:'sadness', layer:'Свет и цвет', more:'светлее и насыщеннее', less:'темнее и приглушённее'},
  {a:'calm', b:'tension', layer:'Форма', more:'мягкие углы и шрифт с засечками', less:'острые углы, сетка и рубленый шрифт'},
  {a:'festive', b:'quiet', layer:'Движение', more:'быстрее, крупнее, со световыми следами', less:'медленнее и почти неподвижно'},
  {a:'warmth', b:'solitude', layer:'Фактура и воздух', more:'тёплая засветка и плёночное зерно', less:'холодные поля вокруг кадра'}
];

const NEUTRAL_HUE = 80;
export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const round2 = value => Math.round(value * 100) / 100;
export const hueBlend = (a, b, t) => (a + (((b - a + 540) % 360) - 180) * t + 360) % 360;
export const emptyFeelings = () => Object.fromEntries(IDS.map(id => [id, 0]));

export function cleanFeelings(source) {
  const result = emptyFeelings();
  for (const id of IDS) {
    const value = Number(source?.[id]);
    result[id] = Number.isFinite(value) ? round2(clamp(value)) : 0;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Reading a story on the device. Used when no language model is connected.
// 'stem' matches the start of a word, '=word' the whole word, 'two words' a
// pair of neighbours. ':1.5' is the weight of the cue.
const LEXICON = {
  joy: ['радост:1.3','радов','обрадов','=рад','=рада','=рады','счаст:1.5','смея','смеял','смех','смеш','засме','хохот',
    'улыб','весел','восторг:1.3','ликова:1.3','прекрасн','чудесн','замечательн','отличн','здорово','классн','красив:0.7',
    'победи','выигра','получилось','удалось','повезло','нравит','понравил','вкусн:0.6','=ура','солнечн:0.6','солнц:0.5',
    'светл:0.5','сиял:0.6','наконец-то:0.7','вдохнов','горжусь','гордост','сбыл','свобод:0.7','облегчен'],
  sadness: ['груст:1.5','грущ:1.5','печал:1.5','тоск:1.3','слез','плака','плач','рыда:1.3','хорон:2','похорон:2','=умер:2',
    'умерл:2','смерт:1.8','потерял','потеря','расста:1.3','прощан','прощал','скуча','=жаль','жалко','обид','больно','=боль',
    'тяжело','уныл','разочаров','одиноко','не хватает','=горе:1.5','горев:1.5','утрат:1.5','сожале','=зря','безнадеж:1.3',
    'серый:0.5','серое:0.5','серо:0.5','пасмурн:0.6','хмур:0.6','устал:0.4'],
  calm: ['спокой:1.5','=покой:1.5','покое:1.2','умиротвор:1.5','безмятеж:1.5','неспеш','нетороп','размерен','расслаб',
    'отдых','отдохн','мирн','гармони','плавн:0.7','дышал:0.7','вдохн:0.7','выдохн','прогул:0.7','гуля:0.7','созерца',
    'медитац','книг:0.5','читал:0.5','=чай:0.5','чаем:0.5','закат:0.5','озер:0.6','берег:0.5','=лес:0.6','=лесу:0.6',
    'тих:0.6','тишин:0.6','долго сидели:0.8','долго говорили:0.6','уютн:0.6'],
  tension: ['злил:1.5','злюсь:1.5','злост:1.5','злой:1.5','злая:1.5','=зол:1.5','=зла:1.5','разозл:1.5','бесит:1.5','бесил:1.5',
    'взбес:1.5','раздраж:1.5','ярост:1.5','гнев:1.5','ненавиж:1.5','ссор:1.3','поссор:1.3','руга','поруга','скандал:1.3',
    'крича','накрич','орал','сроч','дедлайн:1.5','опазд','опозд','спеш','тороп','аврал:1.5','нерв','тревог','тревож',
    'стресс:1.5','паник:1.5','страх','страшно','боял','испуг','напряж:1.5','давлен:0.8','вымота','экзамен:0.7',
    'собеседован:0.7','начальник:0.6','ошибк:0.6','сломал','пробк:0.7','очеред:0.5','конфликт:1.3','бессонн','без сна',
    'не успе','перед сдачей','достало','достал:0.8','надоел','невыносим:1.3','кошмар','=ужас'],
  festive: ['праздн:1.5','день рожд:1.5','торт','свеч:0.6','вечеринк:1.5','танц:1.3','плясал:1.3','=пели','=пел','=пела',
    'хором','концерт:1.3','фестивал:1.5','салют:1.5','фейерверк:1.5','свадьб:1.5','новый год:1.5','новогод:1.5','елк:0.8',
    'подарк','подарил','гостей:0.7','=тост','тосты','шампанск','конфетти:1.5','громк','шумн','отмеча:1.3','отмети:1.3',
    'поздрав:1.3','карнавал:1.5','парад','толп','выпускн:1.3','юбилей:1.5','аплод','до утра:0.8','до полуночи:0.8',
    'музык:0.5','караоке:1.3','дискотек:1.5','побед:0.8'],
  quiet: ['тих:1.3','тишин:1.5','молч:1.2','шепот','шепта','безмолв:1.5','неподвиж','замер','сонн','дрем','уснул','засып',
    'никого:0.8','ни звука:1.5','дожд:0.8','капл:0.6','снег:0.6','ночью:0.4','медленн:0.7','пауз','пустой:0.6','пустая:0.6',
    'сумер:0.8','полумрак','библиотек','слушал:0.5','слушала:0.5'],
  warmth: ['тепл:1.4','уют:1.4','обня:1.5','обним:1.5','вместе','вдвоем:1.2','=мама','мамой','маме','маму','=папа','папой',
    'бабушк','дедушк','семья','семье','семьи','семью','семьей','семейн','родны','родител','друзья:0.8','друзей:0.8',
    'друзьями:0.8','подруг:0.8','любим','люблю','поцел:1.3','за руки:1.3','за руку:1.3','какао','плед','кухн:0.6',
    'дома:0.5','пирог:0.8','выпечк:0.8','камин','костер:0.8','костра:0.8','нежн:1.2','забот:0.8','детств:0.8',
    'вспомина:0.6','разговарива:0.7','болтали:0.8','долго говорили','рядом:0.6','свидани:1.2','влюб:1.3','кошк:0.5','собак:0.5'],
  solitude: ['=один:1.2','=одна:1.2','одиноч:1.5','одинок:1.5','наедине:1.2','пустой:0.8','пустая:0.8','пустын:1.2',
    'никого','далеко:0.8','вдали','вдаль','простор:1.5','горизонт:1.3','бескрай:1.5','=степь','=степи','=горы','горах',
    'горн:0.8','вершин','ветер:0.7','холодн:0.6','туман:0.8','троп:0.7','безлюд:1.5','=море:0.6','океан:0.8','=небо:0.5',
    'звезд:0.6','за окном:0.5']
};
const NEGATION = new Set(['не','ни','без','нет']);
const BOOST = new Set(['очень','так','такой','такая','такое','самый','самая','невероятно','ужасно','безумно','слишком','совсем']);
const cues = Object.entries(LEXICON).flatMap(([id, entries]) => entries.map(entry => {
  const [text, weight] = entry.split(':');
  return {id, weight: Number(weight) || 1, exact: text.startsWith('='), text: text.replace(/^=/, ''), phrase: text.includes(' ')};
}));

function words(story) {
  return String(story ?? '').toLowerCase().replaceAll('ё', 'е').match(/[a-zа-я]+(?:-[a-zа-я]+)*/g) || [];
}

function cueHits(list, index) {
  const word = list[index];
  const pair = index + 1 < list.length ? word + ' ' + list[index + 1] : '';
  // «Смеялись» matches both «смея» and «смеял»: one word is one piece of evidence per feeling.
  const strongest = new Map();
  for (const cue of cues) {
    if (!(cue.phrase ? pair.startsWith(cue.text) : cue.exact ? word === cue.text : word.startsWith(cue.text))) continue;
    if (!strongest.has(cue.id) || strongest.get(cue.id).weight < cue.weight) strongest.set(cue.id, cue);
  }
  return [...strongest.values()];
}

export function localFeelings(story) {
  const list = words(story);
  const score = emptyFeelings();
  list.forEach((word, index) => {
    const hits = cueHits(list, index);
    if (!hits.length) return;
    let before = index - 1;
    let boost = 1;
    if (BOOST.has(list[before])) { boost = 1.4; before--; }
    const negated = NEGATION.has(list[before]);
    // «Не спешили» is evidence of the opposite feeling, at a lower weight.
    for (const hit of hits) score[negated ? opposite(hit.id) : hit.id] += hit.weight * boost * (negated ? .6 : 1);
  });
  const shouts = Math.min(3, (String(story).match(/!/g) || []).length);
  if (shouts) {
    score.festive += .25 * shouts;
    score[score.tension > score.joy ? 'tension' : 'joy'] += .15 * shouts;
  }
  return cleanFeelings(Object.fromEntries(IDS.map(id => [id, 1 - Math.exp(-score[id] / 2)])));
}

// ---------------------------------------------------------------------------
// A folder name without a language model: the most concrete short clause.
const LEAD_DROP = new Set(('сегодня вчера потом затем утром вечером днем ночью мы я и а но было была был были это так еще уже ' +
  'когда пока после наконец просто очень все всё тут там вот тогда сначала зато однако').split(' '));
const TAIL_DROP = new Set(('в во на с со к ко по за из от до у о об под над при для без через и а но или что как где когда чтобы ' +
  'мы я он она они ее её его их мне меня нам нас не ни же бы ли то это этот эта очень так уже еще ещё только пока сих пор').split(' '));
const VERB = /(?:л|ла|ли|ло|лся|лась|лись|лось|ть|ться|тся|ешь|ете|ют|ут|ит|ят)$/;

function trimTitle(list) {
  const result = [...list];
  while (result.length && LEAD_DROP.has(result[0].toLowerCase())) result.shift();
  if (result.length > 6) result.length = 6;
  while (result.length && TAIL_DROP.has(result.at(-1).toLowerCase())) result.pop();
  return result;
}

export function localTitle(story) {
  const clauses = String(story ?? '').split(/[.!?…\n;:,—–]+/u)
    .map(clause => trimTitle(clause.match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) || []))
    .filter(list => list.length >= 3);
  let best = null;
  for (const list of clauses) {
    const lower = list.map(word => word.toLowerCase().replaceAll('ё', 'е'));
    const content = lower.filter(word => word.length > 2 && !TAIL_DROP.has(word) && !LEAD_DROP.has(word));
    const verbs = content.filter(word => VERB.test(word)).length;
    const vivid = lower.filter((word, index) => cueHits(lower, index).length).length;
    const score = (content.length - verbs) + vivid * .7 - verbs * .6 - Math.abs(list.length - 4) * .25;
    if (!best || score > best.score) best = {list, score};
  }
  const fallback = trimTitle(String(story ?? '').match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) || []).slice(0, 5);
  const chosen = best?.list || fallback;
  if (!chosen.length) return 'День без слов';
  const title = chosen.join(' ');
  return title[0].toLocaleUpperCase('ru') + title.slice(1);
}

export function localReading(story) {
  return {feelings: localFeelings(story), title: localTitle(story), source: 'local',
    reason: 'Настроение оценил словарь на устройстве по словам записи.'};
}

// ---------------------------------------------------------------------------
// Music moves the two pairs it can actually be heard in: pace and brightness.
export function withMusic(text, audio) {
  const energy = clamp(audio?.energy ?? .5);
  const tone = clamp(audio?.tone ?? 0, -1, 1);
  const heard = {festive: Math.max(0, (energy - .5) * 2), quiet: Math.max(0, (.5 - energy) * 2),
    joy: Math.max(0, tone), sadness: Math.max(0, -tone)};
  const result = {...text};
  for (const [id, value] of Object.entries(heard)) result[id] = round2(clamp(text[id] + .25 * (value - text[id])));
  return result;
}

// Photographs are measured, not understood. Three measurements are clear enough to
// act on: how warm the colours are, how dense and saturated the frame is, and whether
// it is bright and colourful or dark and grey. Each leans one pair a little, and only
// when the measurement is clearly on one side: a dark frame lit by candles is not sad.
const beyond = (value, dead) => Math.abs(value) <= dead ? 0 : Math.sign(value) * (Math.abs(value) - dead) / (1 - dead);
export function withPhotos(text, photos) {
  if (!photos?.length || photos.some(photo => photo.warm == null)) return {...text};
  const average = key => photos.reduce((sum, photo) => sum + photo[key], 0) / photos.length;
  const warm = average('warm'), light = average('light') / 100, colourful = average('colourful'), detail = average('detail');
  const bright = Math.max(0, (light - .5) * 2 + (colourful - .4));
  const gloom = Math.max(0, (.3 - light) * 2 + (.35 - colourful) * 1.5);
  const leans = [
    ['warmth', 'solitude', beyond(clamp(warm, -1, 1), .15), .15],
    ['festive', 'quiet', beyond(clamp((detail - .5) * 1.2 + (colourful - .5) * 1.2, -1, 1), .2), .1],
    ['joy', 'sadness', beyond(clamp(bright - gloom, -1, 1), .2), .1]
  ];
  const result = {...text};
  for (const [more, less, lean, weight] of leans) {
    const [up, down] = lean >= 0 ? [more, less] : [less, more];
    const push = weight * Math.abs(lean);
    result[up] = round2(clamp(result[up] + push * (1 - result[up])));
    result[down] = round2(clamp(result[down] - push * result[down]));
  }
  return result;
}

// The voice is chosen by the same numbers. Each voice has feelings it suits best;
// the strongest match reads the entry. The author can still pick another one.
const VOICES = [
  {id: 'baya', suits: {warmth: 1, festive: .7, joy: .3}, why: 'для тёплых и праздничных записей'},
  {id: 'kseniya', suits: {joy: 1, calm: .5, quiet: .2}, why: 'для светлых и радостных записей'},
  {id: 'xenia', suits: {quiet: 1, sadness: 1, calm: .2}, why: 'для тихих и грустных записей'},
  {id: 'aidar', suits: {solitude: 1.3, quiet: .5}, why: 'для уединённых записей и больших пространств'},
  {id: 'eugene', suits: {tension: 1.6}, why: 'для напряжённых записей'}
];
export function pickVoice(feelings, available) {
  const allowed = VOICES.filter(voice => !available || available.includes(voice.id));
  if (!allowed.length || !ranking(feelings).lead) return null;
  const scored = allowed.map(voice => ({...voice, score: Object.entries(voice.suits).reduce((sum, [id, weight]) => sum + feelings[id] * weight, 0)}));
  return scored.sort((a, b) => b.score - a.score)[0];
}
// A festive or tense day is read a little faster, a quiet one a little slower.
export const readingPace = feelings => round2(clamp(1 + .07 * (feelings.festive - feelings.quiet) + .04 * (feelings.tension - feelings.calm), .9, 1.1));

// The lead feeling colours the base, the runner-up colours the accent. Hues are
// chosen, never averaged, so two strong feelings give two clean colours.
// `keep` and `keepSecond` are the feelings that held the base and the accent
// before: each stays until another one is ahead by a clear margin, so a single
// entry moves the numbers but does not flip the palette.
const STICK = .1;
// Quiet, calm and solitude are present on most ordinary days. They count for a
// little less when choosing colours, otherwise every diary would end up grey-violet.
const PRESENCE = {quiet: .55, calm: .85, solitude: .9};
export function ranking(feelings, keep = null, keepSecond = null) {
  const order = IDS.map(id => ({id, value: feelings[id], weight: (feelings[id] - .5 * feelings[opposite(id)]) * (PRESENCE[id] ?? 1)}))
    .sort((a, b) => b.weight - a.weight || b.value - a.value);
  const held = order.find(item => item.id === keep);
  const top = held && held.value >= .15 && order[0].weight - held.weight < STICK ? held : order[0];
  const lead = top.value >= .15 ? top.id : null;
  const able = lead ? order.filter(item => item.id !== lead && item.value >= Math.max(.15, .4 * feelings[lead])) : [];
  const heldSecond = able.find(item => item.id === keepSecond);
  const next = heldSecond && able[0].weight - heldSecond.weight < STICK ? heldSecond : able[0];
  return {lead, second: next ? next.id : null};
}

export function feelingLabel(feelings, keep = null, keepSecond = null) {
  const {lead, second} = ranking(feelings, keep, keepSecond);
  if (!lead) return 'Ровный день';
  return second ? `${feelingName(lead)} и ${feelingName(second).toLowerCase()}` : feelingName(lead);
}

function accentFor(feelings, lead, second) {
  const source = BY_ID.get(second || lead);
  if (!source) return {accentHue: 65, accentSat: 69, accentLight: 79};
  const red = source.hue >= 320 || source.hue <= 20;
  return {accentHue: source.hue, accentSat: Math.round(clamp(source.sat + 14, 38, 86)),
    accentLight: red ? 70 : source.hue > 30 && source.hue < 70 ? 78 : 76};
}

// Shared by the scene and by the site: shape and type come from the same numbers.
function formTokens(f) {
  const press = f.tension - f.calm;
  const face = f.tension >= .5 && press > 0 ? 'grotesk' : 'serif';
  return {
    face,
    radius: Math.round(clamp(8 + 14 * f.calm + 6 * f.warmth - 12 * f.tension, 0, 26)),
    // Heavier with tension, but short of billboard weight.
    titleWeight: face === 'grotesk' ? Math.round(clamp(540 + 220 * f.tension + 80 * f.festive, 520, 780)) : 400,
    // Serif display is set tight; a heavy grotesk needs more air or its letters touch.
    tracking: face === 'grotesk' ? round2(-.02 - .02 * f.tension) : round2(-.045 + .02 * f.solitude + .015 * f.quiet),
    titleScale: round2(clamp(1 + .16 * f.festive + .06 * f.joy - .2 * f.quiet - .14 * f.solitude, .7, 1.2))
  };
}

export function sceneTokens(feelings, photo, audio) {
  const f = feelings;
  const {lead, second} = ranking(f);
  const strength = lead ? f[lead] : 0;
  const valence = f.joy - f.sadness;
  const press = f.tension - f.calm;
  const anchor = lead ? BY_ID.get(lead) : {hue: NEUTRAL_HUE, sat: 14};
  const energy = clamp(audio?.energy ?? .5);
  const tone = clamp(audio?.tone ?? 0, -1, 1);
  const drive = clamp(.35 * (f.festive - f.quiet + 1) / 2 + .65 * energy);
  const tempo = audio?.bpm || 72 + drive * 60;
  const duration = clamp(60 / tempo * 8, 2.5, 9);
  const form = formTokens(f);
  const place = form.face === 'grotesk' ? 'grid'
    : (f.solitude >= .5 || (f.quiet >= .7 && f.warmth < .5)) && f.festive < .4 ? 'air'
    : f.festive >= .55 ? 'burst' : 'base';
  return {
    lead, second, place, ...form, ...accentFor(f, lead, second),
    hue: Math.round(hueBlend(anchor.hue, photo.hue, Math.min(.6, photo.weight * 3.2))),
    saturation: Math.round(clamp(anchor.sat * (.45 + .55 * strength) * .7 + photo.sat * .3 + tone * 8 + valence * 8, 10, 80)),
    dark: Math.round(clamp(12 + (photo.light - 45) * .1 + valence * 4, 7, 22)),
    wash: round2(.08 + .2 * strength),
    grain: round2(clamp(.1 + .16 * f.warmth + .08 * f.sadness + .05 * f.quiet - .07 * f.tension + (photo.light < 35 ? .03 : 0), .04, .32)),
    contrast: round2(clamp(1 + .22 * f.tension - .08 * f.calm - .06 * f.quiet + (energy - .5) * .1, .9, 1.3)),
    filterSat: round2(clamp(.95 + .35 * f.joy + .3 * f.festive - .4 * f.sadness - .25 * f.solitude - .15 * f.quiet + tone * .08, .45, 1.5)),
    sepia: round2(clamp(.38 * f.warmth - .2 * f.tension, 0, .4)),
    bright: round2(clamp(1 + .07 * f.joy - .1 * f.sadness, .86, 1.1)),
    inset: round2(clamp(f.solitude * 7 + f.quiet * 3 - f.festive * 4 - f.warmth * 3, 0, 9)),
    tilt: round2(f.festive > .5 ? -(f.festive - .5) * 3 : 0),
    energy: round2(drive), duration: round2(duration),
    fade: round2(clamp(duration * (.34 - .3 * drive) * (1 - .5 * Math.max(0, press)), .12, 2.2)),
    drift: round2(1.03 + .05 * drive)
  };
}

// The site takes the same numbers at a lower volume: it has to stay a place to read.
export function siteTokens(feelings, {hue, keep, keepSecond} = {}) {
  const f = feelings;
  const {lead, second} = ranking(f, keep, keepSecond);
  const strength = lead ? f[lead] : 0;
  const anchor = lead ? BY_ID.get(lead) : {hue: NEUTRAL_HUE, sat: 30};
  const form = formTokens(f);
  return {
    lead, second, ...form, ...accentFor(f, lead, second),
    hue: Math.round(hue ?? anchor.hue),
    paperSat: Math.round(clamp(anchor.sat * .34 * (.4 + .6 * strength), 6, 24)),
    paperLight: round2(clamp(9.5 + 3 * f.joy - 3 * f.sadness + 1.5 * f.warmth - 1.5 * f.tension, 6, 14)),
    glow: round2(.08 + .24 * strength),
    lines: round2(f.tension * .1),
    pageGrain: round2(clamp(f.warmth * .1 + f.sadness * .04, 0, .12)),
    // How long the site takes to change its mood; pointer feedback stays instant.
    tempo: round2(clamp(.42 - .14 * f.festive + .22 * f.quiet, .28, .7))
  };
}

// ---------------------------------------------------------------------------
// The diary as a whole. Days are replayed in order and each one moves the
// numbers a little: it pulls the diary a tenth of the way towards itself, and a
// feeling that clearly led that day also pushes its opposite down slightly.
// After a sad day joy drops and sadness rises, by about a tenth, never by half.
// Equal numbers of calm and angry days do not blur into a grey middle: both
// numbers stay visible, the one that led first keeps the base colour, the
// other becomes the accent, and form sits between soft and sharp.
const PULL = .1;
const PUSH = .12;

export function foldDiary(days) {
  let state = emptyFeelings();
  let lead = null;
  let second = null;
  const trail = [];
  days.forEach((day, index) => {
    // The first entries of a new diary count for more, like a running average.
    const rate = Math.max(PULL, 1 / (index + 1));
    const next = {};
    for (const id of IDS) next[id] = state[id] + rate * (day[id] - state[id]);
    for (const id of IDS) {
      const ahead = day[opposite(id)] - day[id];
      if (ahead > 0) next[id] = clamp(next[id] * (1 - PUSH * ahead));
    }
    state = next;
    ({lead, second} = ranking(state, lead, second));
    trail.push(state);
  });
  return {state: cleanFeelings(state), previous: cleanFeelings(trail.at(-2) || emptyFeelings()), lead, second};
}
