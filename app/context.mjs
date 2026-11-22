// What an entry is about besides how it felt: a holiday, the weather.
// The diary draws these as signs on the scene of the day.
//
// The four functions below are the whole contract with the rest of the diary:
// atmosphere.mjs stores readContext() in the imprint of a day, scene.mjs places
// contextSVG() among the layers of a scene and lists contextRules() under
// «Как собрана сцена», main.mjs adds contextSVG() to the cards of the archive and
// contextPageHTML() to the page of an open day. Everything returned is a plain
// string that carries its own styles, so the exported folder shows it as well.
import {signsSVG} from './context-signs.mjs';
import {pageDecor} from './context-page.mjs';

// Word edges by hand: \b does not know Cyrillic or Kazakh letters.
const A = '(?<![\\p{L}\\d])';
const Z = '(?![\\p{L}])';
const find = source => new RegExp(A + '(?:' + source + ')', 'giu');

// Idioms that name weather without meaning it. They are blanked (same length, so
// positions still point into the original text) before the weather is read.
const IDIOMS = find([
  'дед\\p{L}*\\s+мороз\\p{L}*', 'аяз\\s+ата\\p{L}*', 'как\\s+снег\\s+на\\s+голову', 'как\\s+гром\\s+среди\\s+ясного\\s+неба',
  'гром\\p{L}*\\s+(?:аплодисмент|оваци)\\p{L}*', 'бур\\p{L}*\\s+(?:эмоци|чувств|оваци|восторг)\\p{L}*',
  'туман\\p{L}*\\s+в\\s+голове', 'в\\s+голове\\s+(?:\\p{L}+\\s+)?туман\\p{L}*', 'туманн\\p{L}*\\s+(?:будущ|перспектив)\\p{L}*', 'дожд\\p{L}*\\s+из\\s+(?:конфетти|лепестк|блест)\\p{L}*',
  'ветер\\s+перемен', 'витать\\s+в\\s+облаках', 'в\\s+облак[оеа]' + Z, 'облак\\p{L}*\\s+(?:тегов|данных)',
  'солн\\p{L}*\\s+(?:очк|батаре|панел|ванн)\\p{L}*', 'солнышко\\s+мо\\p{L}*', 'солнцезащит\\p{L}*', 'brainstorm\\p{L}*', 'snowball\\p{L}*\\s+effect'
].join('|'));

// A sign is not drawn when a negation or a wish stands just before it ("без снега",
// "обещали дождь", "no rain") or a denial just after it ("дождя не было").
const BEFORE = new RegExp(A + '(?:не|нет|без|ни|no|not|without|never|didn\'t|wasn\'t|isn\'t|жоқ|емес|обещал\\p{L}*|прогноз\\p{L}*|если|вдруг|боял\\p{L}*|ждал\\p{L}*|хотел\\p{L}*|мечтал\\p{L}*|будто|словно|forecast|if|hope\\p{L}*)' + Z, 'iu');
const AFTER = new RegExp('^\\s*(?:\\p{L}+\\s+){0,2}?(?:не\\s+было|не\\s+был|не\\s+шел|не\\s+пош\\p{L}*|не\\s+выпал\\p{L}*|не\\s+случил\\p{L}*|так\\s+и\\s+не|нет|жоқ|болмады|емес|не\\s+дождал\\p{L}*|не\\s+состоял\\p{L}*|отменил\\p{L}*)' + Z, 'iu');
const STRONG = new RegExp(A + '(?:сильн|проливн|тяжел|густ|плотн|ужасн|жутк|страшн|сплошн|стеной|бешен|heavy|thick|strong|hard|қатты)', 'iu');
const SOFT = new RegExp(A + '(?:мелк|легк|слаб|тонк|немного|слегка|чуть|редк|тих|небольш|light|slight|little|gentle|soft|сәл)', 'iu');

// Where a match stands: its clause, the few words before and after it.
function around(text, index, length) {
  const stop = /[.!?…;\n]|,\s*(?:но|а|и|but|and|бірақ)\s/giu;
  let start = 0, end = text.length;
  for (const m of text.matchAll(stop)) {
    if (m.index < index) start = m.index + m[0].length;
    else if (m.index >= index + length) { end = m.index; break; }
  }
  const before = text.slice(start, index).split(',').pop();
  const after = text.slice(index + length, end).split(',')[0];
  return {before: before.split(/\s+/).filter(Boolean).slice(-3).join(' '), after, start, end};
}
const denied = (near) => BEFORE.test(near.before) || AFTER.test(near.after);

// The words of the entry that justify a sign, as the author wrote them.
function quote(original, index, length, near) {
  const clause = original.slice(near.start, near.end).trim();
  if (clause.length <= 56) return clause.replace(/^[\s,—–-]+|[\s,:—–-]+$/gu, '');
  const left = original.slice(Math.max(near.start, index - 26), index).replace(/^\S*\s/u, '');
  const right = original.slice(index + length, Math.min(near.end, index + length + 26)).replace(/\s\S*$/u, '');
  return (left + original.slice(index, index + length) + right).trim().replace(/[\s,:—–-]+$/u, '');
}

// ---------------------------------------------------------------------------
// Holidays: a name counts 2, a sign of it less; the date adds 1 only when the text
// already speaks of the holiday or a celebration. Two points draw it.
const HOLIDAYS = {
  halloween: {date: ['10-31', '11-01'], words: [
    ['х[эе]л+оуин\\p{L}*|halloween\\p{L}*', 2], ['сладость\\s+или\\s+гадость|trick\\s+or\\s+treat|jack-o', 2],
    ['тыкв\\p{L}*|pumpkin\\p{L}*', .75], ['призрак\\p{L}*|привидени\\p{L}*|ghost\\p{L}*', .75], ['скелет\\p{L}*|skeleton\\p{L}*|череп\\p{L}*', .75],
    ['ведьм\\p{L}*|witch\\p{L}*|вампир\\p{L}*', .75], ['летуч\\p{L}*\\s+мыш\\p{L}*', .75], ['паутин\\p{L}*', .5], ['костюм\\p{L}*', .5]]},
  newyear: {date: ['12-31', '01-01'], words: [
    ['нов(?:ый|ому|ым)\\s+год(?:у|ом)?' + Z + '|(?<!(?:^|\\s)(?:с|до)\\s)нового\\s+года' + Z + '|новогодн\\p{L}*|жаңа\\s+жыл\\p{L}*|жана\\s+жыл\\p{L}*|new\\s+year\\p{L}*', 2],
    ['курант\\p{L}*', 2], ['дед\\p{L}*\\s+мороз\\p{L}*|аяз\\s+ата\\p{L}*', 2], ['снегурочк\\p{L}*', 1.5],
    ['елк(?:а|и|у|ой|е)' + Z + '|елочк\\p{L}*|шырша\\p{L}*', 1], ['оливье', 1], ['бенгальск\\p{L}*', 1], ['мандарин\\p{L}*', .5],
    ['гирлянд\\p{L}*', .5], ['салют\\p{L}*|фейерверк\\p{L}*|fireworks?', .5], ['шампанск\\p{L}*', .5]]},
  birthday: {date: [], words: [
    ['д(?:ень|ня|нем|не|ню)\\s+рождени\\p{L}*|днюх\\p{L}*|днюшк\\p{L}*|именин\\p{L}*|туған\\s+күн\\p{L}*|туган\\s+кун\\p{L}*|birthday\\p{L}*', 2],
    ['торт\\p{L}*\\s+со\\s+свеч\\p{L}*|свеч\\p{L}*\\s+на\\s+торт\\p{L}*|задул\\p{L}*\\s+свеч\\p{L}*|задува\\p{L}*\\s+свеч\\p{L}*|blew\\s+out\\s+the\\s+candles', 2],
    ['исполнилось\\s+\\d+|стукнуло\\s+\\d+', 1], ['воздушн\\p{L}*\\s+шар\\p{L}*|шарик\\p{L}*|balloons?', .75], ['торт\\p{L}*|cake', .5], ['подар\\p{L}*', .5]]},
  nauryz: {date: ['03-21', '03-22', '03-23'], words: [
    ['(?<!\\d\\s*)наурыз(?!\\p{L}*\\s*(?:ай|\\d))\\p{L}*|nauryz|navruz|nowruz|навруз\\p{L}*|новруз\\p{L}*', 2], ['алтыба[кқ]ан\\p{L}*', 2],
    ['көже\\p{L}*', 1], ['көрісу|корису', 1], ['равноденств\\p{L}*', 1], ['дастархан\\p{L}*', .5], ['бауырса[кқ]\\p{L}*', .5], ['киіз\\s+үй\\p{L}*|юрт\\p{L}*', .5]]}
};
// "Новый год мы не праздновали": the whole clause says no.
const REFUSED = new RegExp(A + '(?:не|didn\'t|did\\s+not|never)\\s+(?:\\p{L}+\\s+)?(?:праздн|отмеч|отпраздн|встреча|celebrat|тойла)', 'iu');
const CELEBRATE = find('праздн\\p{L}*|отмеча\\p{L}*|отметил\\p{L}*|мейрам\\p{L}*|той' + Z + '|celebrat\\p{L}*|party|вечеринк\\p{L}*|поздрав\\p{L}*|застоль\\p{L}*');

// ---------------------------------------------------------------------------
// Weather: each pattern carries how much of it a plain mention means.
const WEATHER = {
  rain: [['лив(?:ень|ня|ню|нем|не|ни|ней|невый|невого)' + Z + '|downpour|pouring|нөсер\\p{L}*|как\\s+из\\s+ведра', 1],
    ['дожд(?:ь|я|ю|ем|е|и|ей|ям|ями|ях|ик|ичек|ичк\\p{L}*|лив\\p{L}*)' + Z + '|rain(?:s|y|ing|ed)?' + Z + '|жаңбыр\\p{L}*|жанбыр\\p{L}*', .6],
    ['морос\\p{L}*|изморос\\p{L}*|drizzl\\p{L}*', .3]],
  snow: [['метел(?:ь|и|ью)' + Z + '|вьюг\\p{L}*|пург\\p{L}*|буран\\p{L}*|blizzard\\p{L}*', 1], ['снегопад\\p{L}*', .9],
    ['снежинк\\p{L}*|снежок|пороша\\p{L}*|первый\\s+снег\\p{L}*|snowflake\\p{L}*', .4],
    ['снег(?!урочк)\\p{L}*|снеж\\p{L}*|snow(?:s|y|ing|ed)?' + Z + '|қар' + Z + '|қарлы\\p{L}*', .6]],
  storm: [['гроз(?:а|ы|у|ой|е|ами)' + Z + '|грозов\\p{L}*|гром(?!к|оз|адн)\\p{L}*|молни(?:я|и|ей|ю)' + Z + '|thunder\\p{L}*|lightning|storm' + Z + '|найзағай\\p{L}*|шторм' + Z, .8]],
  clouds: [['туч(?:а|и|у|ей|ами|ах)' + Z + '|пасмурн\\p{L}*|overcast', .8], ['облачк\\p{L}*', .35],
    ['облак\\p{L}*|облачн\\p{L}*|хмур\\p{L}*\\s+(?:небо|день|утро|погод\\p{L}*)|небо\\s+(?:было\\s+)?(?:серое|серым|затянул\\p{L}*)|сер(?:ое|ым)\\s+небо\\p{L}*|cloud(?:s|y)?' + Z + '|gr[ae]y\\s+sky|бұлт\\p{L}*', .6]],
  sun: [['безоблачн\\p{L}*|cloudless', .8], ['солн(?:це|ца|цу|цем)' + Z + '|солнечн\\p{L}*|солнышк\\p{L}*|ясн(?:ый|ое|ая|ую|ом)\\s+(?:день|небо|утро|погод\\p{L}*|вечер)|sunny|sunshine|sunlight|the\\s+sun' + Z + '|шуақ\\p{L}*|күн\\s+ашық', .7]],
  wind: [['ураган\\p{L}*|шквал\\p{L}*|порыв\\p{L}*\\s+ветр\\p{L}*|gale' + Z, 1], ['ветер(?:ок|к\\p{L}*)|breez\\p{L}*', .35],
    ['ветер' + Z + '|ветр(?!ов)\\p{L}*|wind(?:y|s)?' + Z + '|жел' + Z + '|желді\\p{L}*', .6]],
  fog: [['дымк\\p{L}*|haze|hazy', .4], ['туман\\p{L}*|мгл\\p{L}*|fog(?:gy)?' + Z + '|mist(?:y)?' + Z + '|тұман\\p{L}*', .65]],
  heat: [['жар(?:а|у|ой|е)' + Z + '|зно(?:й|я|ю|ем)' + Z + '|знойн\\p{L}*|пекл(?:о|а)' + Z + '|духот\\p{L}*|жарк(?:о|ий|ая|ое|ую|им|ом)\\s+(?:было|день|лето|погод\\p{L}*|солнц\\p{L}*)|было\\s+жарко|heatwave|scorching|аптап\\p{L}*', .75]],
  frost: [['мороз\\p{L}*|заморозк\\p{L}*|иней|инея|инеем|изморозь\\p{L}*|гололед\\p{L}*|холодрыг\\p{L}*|минус\\s+\\d+|frost\\p{L}*|freezing|аяз\\p{L}*', .7]]
};
const compiled = Object.fromEntries(Object.entries(WEATHER).map(([kind, list]) => [kind, list.map(([source, amount]) => [find(source), amount])]));
const holidays = Object.fromEntries(Object.entries(HOLIDAYS).map(([id, {date, words}]) => [id, {date, words: words.map(([source, weight]) => [find(source), weight])}]));

const round = value => Math.round(value * 100) / 100;

// story: the text of the entry; date: 'YYYY-MM-DD' or undefined.
// Returns a small serialisable object; `occasion` is null when no holiday is named.
export function readContext(story, date) {
  const original = String(story || '');
  const text = original.toLowerCase().replace(/ё/g, 'е');
  const evidence = [];

  // Holidays read the text as written (Дед Мороз is a sign of New Year, not of frost).
  const celebrated = [...text.matchAll(CELEBRATE)].some(m => !denied(around(text, m.index, m[0].length)));
  const day = String(date || '').slice(5, 10);
  let occasion = null, best = 0, why = '';
  for (const [id, {date: dates, words}] of Object.entries(holidays)) {
    let score = 0, strongest = 0, said = '';
    for (const [pattern, weight] of words) {
      for (const m of text.matchAll(pattern)) {
        const near = around(text, m.index, m[0].length);
        if (denied(near) || REFUSED.test(text.slice(near.start, near.end))) continue;
        score += weight;
        if (weight > strongest) { strongest = weight; said = quote(original, m.index, m[0].length, near); }
        break;
      }
    }
    if (dates.includes(day) && (score > 0 || celebrated)) score += celebrated ? 1.5 : 1;
    if (score >= 2 && score > best) { best = score; occasion = id; why = said; }
  }
  if (occasion) evidence.push({of: occasion, text: why});

  // Weather reads the text with idioms blanked out.
  const plain = text.replace(IDIOMS, m => ' '.repeat(m.length));
  const weather = [];
  for (const [kind, list] of Object.entries(compiled)) {
    let amount = 0, said = '';
    for (const [pattern, base] of list) {
      for (const m of plain.matchAll(pattern)) {
        const near = around(plain, m.index, m[0].length);
        if (denied(near)) continue;
        const words = near.before + ' ' + near.after.split(/\s+/).slice(0, 3).join(' ');
        const value = STRONG.test(words) ? Math.max(base, .95) : SOFT.test(words) ? Math.min(base, .35) : base;
        if (value > amount) { amount = value; said = quote(original, m.index, m[0].length, near); }
      }
    }
    if (amount) { weather.push({kind, amount: round(amount)}); evidence.push({of: kind, text: said}); }
  }
  // A storm is drawn as a cloud with lightning; a cloudless sky has no clouds.
  return {occasion, weather, evidence};
}

// The signs for one scene: '' when there is nothing to draw, otherwise one
// <svg class="decor" …> that fills the scene (it is positioned by the page).
// imprint carries the feelings and tokens of the day, seed is the day's id,
// size is the width of the picture relative to a full scene (a card is about .36).
export function contextSVG(context, imprint, seed, size = 1) {
  if (!context || (!context.occasion && !context.weather?.length)) return '';
  return signsSVG(context, imprint || {}, seed, size);
}

const OCCASION = {
  halloween: ['Хэллоуин', 'тыквы, призраки, летучие мыши и паутина по краям кадра и по всей странице'],
  newyear: ['Новый год', 'ёлки, снежинки, шары и гирлянда по верху кадра и страницы'],
  birthday: ['День рождения', 'воздушные шары, свечи, флажки и конфетти в кадре и на полях страницы'],
  nauryz: ['Наурыз', 'тюльпаны, подснежники, шаңырақ, орнамент «қошқар мүйіз» и алтыбақан']
};
// [light, plain, strong] wording of each sign.
const SKY = {
  sun: ['солнце с лучами'], clouds: ['лёгкие облака', 'облака', 'тяжёлые тучи'], storm: ['туча с молнией'],
  rain: ['морось из облака', 'дождь из облака', 'ливень из двух туч'], snow: ['редкий снег из облака', 'снег из облака и снежинки по верху кадра', 'сильный снег из двух туч'],
  wind: ['лёгкий ветер: две линии с завитком', 'ветер: линии с завитком', 'сильный ветер: три линии с завитком'],
  fog: ['дымка: тонкие полосы тумана', 'полосы тумана', 'густой туман: плотные полосы'],
  heat: ['жара: солнце с дрожащими лучами'], frost: ['иней в углу кадра']
};
const wording = (kind, amount) => { const w = SKY[kind]; return w.length === 1 ? w[0] : w[amount <= .4 ? 0 : amount >= .9 ? 2 : 1]; };

// Lines for «Как собрана сцена»: [{label: 'Хэллоуин', text: 'тыквы и призраки по краям кадра'}].
export function contextRules(context) {
  if (!context) return [];
  const said = of => context.evidence?.find(item => item.of === of)?.text;
  const rules = [];
  if (OCCASION[context.occasion]) {
    const [label, text] = OCCASION[context.occasion];
    rules.push({label, text: `${text}: в записи ${said(context.occasion) ? `«${said(context.occasion)}»` : 'назван праздник'}`});
  }
  for (const {kind, amount} of context.weather || []) {
    const words = said(kind);
    rules.push({label: 'Погода', text: `${wording(kind, amount)}${words ? `: в записи «${words}»` : ''}`});
  }
  return rules;
}

// The day's signs over the whole page of an open day: '' when the entry names neither a holiday nor weather.
export function contextPageHTML(context, imprint) {
  if (!context || (!context.occasion && !context.weather?.length)) return '';
  return pageDecor(context, imprint || {});
}
