import {demos} from './demos.mjs';

// Each example pairs a journal entry with one of the six original recordings.
// Nearest-neighbour ranking uses the vocabulary and IDF learned from these pairs.
const profiles = [
  {
    id: 'maple',
    description: 'Медленный мягкий перебор оставляет место для тёплого воспоминания.',
    examples: [
      'В осеннем парке пили какао под клёном, ветер шуршал жёлтыми листьями.',
      'С подругой за чашкой кофе долго болтали в любимом кафе.',
      'Мы устроили уютный семейный ужин и обнимались на кухне.',
      'Мама испекла пирог, мы пили чай, вспоминали детство и смеялись вместе.',
      'Гуляли вдвоём по набережной на закате, держались за руки.',
      'Влюбилась снова. Свидание, поцелуй и нежность, с которой он меня обнял.',
      'После долгой разлуки встретилась с родными. Чувствую тепло и благодарность.',
      'Кот уснул у меня на коленях. Дома пахнет выпечкой, уютно и хорошо.',
      'У бабушки переплели тёплый плед и слушали старые пластинки.'
    ]
  },
  {
    id: 'office',
    description: 'Короткие ноты и частый пульс передают спешку и сосредоточенность.',
    examples: [
      'Ночью в офисе перед сдачей проекта горели мониторы и гудел ноутбук.',
      'На работе срочный дедлайн, тороплюсь закончить задачи к сроку.',
      'Код не собирался, команда искала ошибку, тесты прошли в последнюю минуту.',
      'Готовилась к экзамену без сна, перечитывала конспекты, нервничала.',
      'Тревожно, напряжённый день, весь вечер суета и ни минуты передышки.',
      'Бежал на встречу, опоздал, толкался в переполненном метро.',
      'Смена вымотала. Начальник позвонил, пришлось снова спешить в офис.',
      'Защита диплома. Руки трясутся, сердце стучит перед выступлением.',
      'На тренировке ускорялся на каждом круге, пульс бился в висках.'
    ]
  },
  {
    id: 'train',
    description: 'Восходящая мелодия и мерный шаг передают движение вперёд.',
    examples: [
      'Поезд отправился на рассвете, за окном вагона показывались первые дома.',
      'Впервые путешествую одна. Собрала чемодан и купила билет.',
      'Утром самолёт взлетел над облаками. Впереди новый город и приключения.',
      'Дорога к морю только началась. Открыли окна машины и смотрели вдаль.',
      'Первый день в университете. Новые лица и предвкушение перемен.',
      'Начинаю новую работу. Любопытно, сколько открытий ждёт впереди.',
      'Переезд в другую страну, вокзал, прощание с городом и новые планы.',
      'Вышли встречать восход солнца. Небо медленно становилось розовым.',
      'Выбрались в долгожданную поездку, по пути отмечали станции на карте.'
    ]
  },
  {
    id: 'rain',
    description: 'Редкие ноты и минорный оттенок подходят для задумчивой сцены.',
    examples: [
      'За окном дождь, капли на стекле. Тихо читала книгу на подоконнике.',
      'Хочется побыть в одиночестве. Скучаю и чувствую грусть.',
      'Я грущу после расставания. Пустая комната кажется особенно большой.',
      'Серый пасмурный день, мокрый асфальт, в лужах дрожат отражения.',
      'Молча сидела в библиотеке, листала страницы, слушала тишину.',
      'Устал, хочется покоя. Выключил телефон и слушал, как тикают часы.',
      'Перечитывал старые письма и вспоминал людей, которых больше рядом нет.',
      'Слёзы, печаль и тоска. Грустно прощаться, тяжело утешить друг друга.',
      'Спокойно сидела дома с книгой, отдыхала от шума и разговоров.'
    ]
  },
  {
    id: 'lake',
    description: 'Долгие созвучия и мягкое эхо дают пейзажу ощущение простора.',
    examples: [
      'На горном озере ветер рябил воду, тропа вывела нас на берег.',
      'Гуляли по лесу. Сосны пахли хвоей, птицы перекликались над поляной.',
      'Поднялись в горы, с вершины открылась долина в густом тумане.',
      'На пляже слушала волны моря, смотрела на линию горизонта.',
      'Дышал свежим воздухом. Природа, простор, бескрайнее поле и ветер.',
      'Ушли в поход с палатками, смотрели на звёзды, вдали шумела река.',
      'Водопад, скалы и лёгкая дымка над водой. Завораживает тишина природы.',
      'Весной вышли в сад слушать птиц, среди травы раскрылся первый цветок.',
      'На прогулке по степи шли за облаками, дышали свободно и глубоко.'
    ]
  },
  {
    id: 'cake',
    description: 'Быстрый танцевальный рисунок поддерживает праздничное настроение.',
    examples: [
      'На день рождения друзья принесли торт, задували свечи и пели хором.',
      'Весь вечер танцевали на вечеринке. Гремела музыка и мигали огни.',
      'Мы победили! Команда прыгала от радости, нас встретили аплодисментами.',
      'На концерте толпа подпевала, басы дрожали в груди.',
      'Праздник удался, было весело, хохотали, радовались и обнимали друзей.',
      'Выпускной, конфетти и громкий смех. Все поздравляли друг друга.',
      'Ура, я получил награду! Отмечали успех за большим шумным столом.',
      'Фестиваль разбудил весь квартал. Танцы, фейерверки, цветные огни.',
      'На свадьбе смеялись подруги, гости поднимали тосты и кричали горько.'
    ]
  }
];

const stop = new Set(('это этот этой этим этого эти тот там весь все всех вся мои моя мое мой свои свой наши наш '+
  'они она оно мне меня нас нам его ему ней них где уже был была были было быть стал стали стало '+
  'когда пока после перед потом вдруг снова очень еще тоже только просто как что чтобы потому если даже '+
  'для над под про при или без день сегодня вчера время вечер вечером утром наконец около кажется').split(/\s+/u));

function tokens(text) {
  const words = String(text ?? '').toLowerCase().match(/[а-яё]{3,}/gu) || [];
  return words.filter(word => !stop.has(word.replaceAll('ё', 'е')));
}

function features(token) {
  const word = token.replaceAll('ё', 'е');
  // Prefixes let different Russian inflections share evidence. Longer matches have more weight.
  return [3, 5, 7].filter(size => size < word.length).map(size => ['@'+word.slice(0, size), size / 8])
    .concat([[word, 1]]);
}

function counts(words) {
  const result = new Map();
  for (const word of new Set(words)) {
    for (const [key, weight] of features(word)) {
      result.set(key, Math.max(result.get(key) || 0, weight));
    }
  }
  return result;
}

const examples = profiles.flatMap(profile => profile.examples.map(text => ({
  id: profile.id, terms: counts(tokens(text))
})));
const df = new Map();
for (const {terms} of examples) {
  for (const term of terms.keys()) df.set(term, (df.get(term) || 0) + 1);
}
const idf = new Map([...df].map(([term, n]) => [term, 1 + Math.log((examples.length + 1) / (n + 1))]));

function vectorize(terms) {
  const vector = new Map();
  let sum = 0;
  for (const [term, frequency] of terms) {
    if (!idf.has(term)) continue;
    const weight = idf.get(term) * frequency;
    vector.set(term, weight);
    sum += weight * weight;
  }
  const norm = Math.sqrt(sum);
  if (norm) for (const [term, weight] of vector) vector.set(term, weight / norm);
  return vector;
}

const training = examples.map(({id, terms}) => ({ id, vector: vectorize(terms) }));

function similarity(query, example) {
  let sum = 0;
  for (const [term, weight] of example) sum += (query.get(term) || 0) * weight;
  return sum;
}

const recordings = new Map(demos.map(({id, music}) => [id, music]));
// With no textual evidence, give listeners a moderate, a gentle and an upbeat first choice.
const sampler = ['train', 'maple', 'cake', 'lake', 'rain', 'office'];

function musicalDistance(candidate, anchor) {
  const {bpm, energy, tone} = recordings.get(candidate.id).analysis;
  const reference = anchor.analysis;
  return .45 * Math.abs(bpm - reference.bpm) / 80
    + .4 * Math.abs(energy - reference.energy)
    + .15 * Math.abs(tone - reference.tone) / 2;
}

export function recommendTracks(story) {
  const words = [...new Set(tokens(story))];
  const query = vectorize(counts(words));
  const tracks = profiles.map(({id, description}) => {
    const neighbours = training.filter(example => example.id === id)
      .map(({vector}) => ({vector, score: similarity(query, vector)}))
      .sort((a, b) => b.score - a.score);
    const nearest = neighbours[0];
    const score = .8 * nearest.score + .2 * neighbours[1].score;
    // A shared three-letter prefix alone is too weak to explain a recommendation.
    const evidence = words.map(word => {
      const support = features(word).filter(([term]) => !term.startsWith('@') || term.length >= 6)
        .reduce((sum, [term]) => sum + (query.get(term) || 0) * (nearest.vector.get(term) || 0), 0);
      return {word, support};
    }).filter(item => item.support > 0).sort((a, b) => b.support - a.support).slice(0, 2);
    const matched = score >= .085 && evidence.length > 0;
    const cues = evidence.map(({word}) => '«'+word+'»').join(', ');
    const reason = matched ? `В записи есть ${cues}. ${description}` : description;
    return {id, reason, score: matched ? score : 0, matched};
  }).sort((a, b) => b.score - a.score);

  if (!tracks[0].matched) {
    return tracks.sort((a, b) => sampler.indexOf(a.id) - sampler.indexOf(b.id));
  }
  const anchor = recordings.get(tracks[0].id);
  const alternatives = tracks.filter(track => !track.matched)
    .sort((a, b) => musicalDistance(a, anchor) - musicalDistance(b, anchor))
    .map(track => ({...track, reason: `По звучанию трека «${anchor.track}». ${track.reason}`}));
  return [...tracks.filter(track => track.matched), ...alternatives];
}
